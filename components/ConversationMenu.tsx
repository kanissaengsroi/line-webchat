"use client";

import { useEffect, useRef } from "react";
import { Bell, BellOff, Pin, PinOff, Trash2, UserCheck, UserMinus, type LucideIcon } from "lucide-react";
import { useLang } from "./LangProvider";
import type { Conversation } from "@/lib/types";

export type ConversationAction = "pin" | "mute" | "delete" | "assign-me" | "unassign";

interface Props {
  conversation: Conversation;
  /** The signed-in agent, to offer "assign to me". */
  me: string;
  onAction: (action: ConversationAction) => void;
  onClose: () => void;
  /** Where to anchor: below the trigger, or at a right-click point. */
  position: { top: number; left: number };
}

/** Pin / mute / delete menu for one conversation. Closes on outside click or Escape. */
export function ConversationMenu({ conversation: c, me, onAction, onClose, position }: Props) {
  const { t } = useLang();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const items = () => [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    items()[0]?.focus();

    function onPointer(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        const list = items();
        const i = list.indexOf(document.activeElement as HTMLElement);
        list[(i + (e.key === "ArrowDown" ? 1 : list.length - 1)) % list.length]?.focus();
      } else if (e.key === "Tab") {
        onClose();
      }
    }
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  // Keep the menu on screen.
  const left = Math.min(position.left, (typeof window !== "undefined" ? window.innerWidth : 9999) - 216);
  const top = Math.min(position.top, (typeof window !== "undefined" ? window.innerHeight : 9999) - 200);

  const item = (action: ConversationAction, Icon: LucideIcon, label: string, danger = false) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        onClose();
        onAction(action);
      }}
      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left focus:outline-none focus-visible:outline-none ${
        danger ? "text-red hover:bg-red-dim focus:bg-red-dim" : "text-ink-1 hover:bg-hover focus:bg-hover"
      }`}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </button>
  );

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={c.displayName}
      style={{ top, left }}
      className="rise fixed z-50 w-52 rounded-xl border border-rule-strong bg-raised p-1 shadow-[0_12px_32px_-8px_oklch(0_0_0/0.6)]"
    >
      {c.assignee !== me && item("assign-me", UserCheck, t("assignToMe"))}
      {c.assignee && item("unassign", UserMinus, t("unassign"))}
      {item("pin", c.pinned ? PinOff : Pin, t(c.pinned ? "unpin" : "pin"))}
      {item("mute", c.muted ? Bell : BellOff, t(c.muted ? "unmute" : "mute"))}
      <div className="my-1 h-px bg-rule" aria-hidden />
      {item("delete", Trash2, t("deleteChat"), true)}
    </div>
  );
}
