"use client";

import { forwardRef, useEffect, useRef } from "react";
import { BellOff, Globe, MoreHorizontal, Pin, Search } from "lucide-react";
import { Avatar } from "./Avatar";
import { useLang } from "./LangProvider";
import { formatListTime, formatWait, waitLevel } from "@/lib/format";
import { typeLabel } from "@/lib/i18n";
import { channelOf, type Conversation } from "@/lib/types";

const WAIT_TEXT = { calm: "text-ink-2", warn: "text-amber", late: "text-red" } as const;
const WAIT_PILL = {
  calm: "bg-hover text-ink",
  warn: "bg-amber text-ground",
  late: "bg-red text-ground",
} as const;

/** Which chats the list shows: everyone's, the signed-in agent's, or nobody's yet. */
export type Scope = "all" | "mine" | "unassigned";

interface Props {
  conversations: Conversation[];
  scope: Scope;
  onScope: (scope: Scope) => void;
  /** Chats per scope, before the search filter. */
  counts: Record<Scope, number>;
  me: string;
  selectedId: string | null;
  query: string;
  onQuery: (q: string) => void;
  onSelect: (id: string) => void;
  /** Opens the pin / mute / delete menu for a row at a screen position. */
  onMenu: (id: string, position: { top: number; left: number }) => void;
  now: number;
}

export const ConversationList = forwardRef<HTMLInputElement, Props>(function ConversationList(
  { conversations, scope, onScope, counts, me, selectedId, query, onQuery, onSelect, onMenu, now },
  searchRef,
) {
  const { t, lang } = useLang();
  const listRef = useRef<HTMLUListElement>(null);
  const waitingCount = conversations.filter((c) => c.waitingSince && !c.muted).length;

  // Keep the selected row in view when moving with the keyboard.
  useEffect(() => {
    if (!selectedId) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-id="${selectedId}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-baseline justify-between px-4 pt-4 pb-3">
        <h2 className="font-semibold text-ink">{t("conversations")}</h2>
        {waitingCount > 0 && (
          <span className="font-mono text-xs text-amber">
            {waitingCount} {t("waiting")}
          </span>
        )}
      </div>
      <div role="tablist" aria-label={t("conversations")} className="mx-3 mb-3 grid grid-cols-3 rounded-md border border-rule p-0.5 text-[13px]">
        {(["all", "mine", "unassigned"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={scope === s}
            onClick={() => onScope(s)}
            className={`flex h-7 items-center justify-center gap-1.5 rounded transition-colors ${
              scope === s ? "bg-hover text-ink" : "text-ink-3 hover:text-ink-1"
            }`}
          >
            {t(s === "all" ? "scopeAll" : s === "mine" ? "scopeMine" : "scopeUnassigned")}
            <span className="font-mono text-[11px] text-ink-3">{counts[s]}</span>
          </button>
        ))}
      </div>
      <div className="px-3 pb-3">
        <label className="relative block">
          <span className="sr-only">{t("search")}</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={t("search")}
            className="h-9 w-full rounded-md border border-rule bg-ground pr-10 pl-9 text-ink placeholder:text-ink-3 focus:border-rule-strong focus:outline-none"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-rule px-1.5 font-mono text-[11px] text-ink-3">
            /
          </kbd>
        </label>
      </div>

      <ul ref={listRef} aria-label={t("conversations")} className="min-h-0 flex-1 overflow-y-auto pb-2">
        {conversations.map((c) => {
          const selected = c.userId === selectedId;
          const wait = c.waitingSince ? now - c.waitingSince : 0;
          // Muted chats never escalate to amber / red.
          const level = c.muted ? "calm" : waitLevel(wait);
          const preview = c.lastType === "text" ? c.lastText : typeLabel(lang, c.lastType);
          return (
            <li key={c.userId} data-id={c.userId} className="group relative">
              <button
                type="button"
                aria-current={selected ? "true" : undefined}
                onClick={() => onSelect(c.userId)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onMenu(c.userId, { top: e.clientY, left: e.clientX });
                }}
                className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 text-left transition-colors focus-visible:-outline-offset-2 ${
                  selected ? "bg-hover" : "hover:bg-raised"
                }`}
              >
                <Avatar userId={c.userId} name={c.displayName} src={c.pictureUrl} />
                <span className="min-w-0 overflow-hidden">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={`truncate font-medium ${selected ? "text-ink" : "text-ink-1"}`}>
                      {c.displayName}
                    </span>
                    {(channelOf(c.userId) === "web" || c.web) && (
                      <span
                        className="flex shrink-0 items-center gap-1 rounded border border-rule-strong px-1 font-mono text-[10px] leading-4 text-ink-2"
                        title={channelOf(c.userId) === "web" ? t("webGuest") : t("alsoOnWeb")}
                      >
                        <Globe className="size-2.5" aria-hidden />
                        WEB
                      </span>
                    )}
                    {c.pinned && <Pin className="size-3 shrink-0 text-ink-3" aria-label={t("pinned")} />}
                    {c.muted && <BellOff className="size-3 shrink-0 text-ink-3" aria-label={t("muted")} />}
                    {c.assignee && (
                      <span
                        title={t("assignee")}
                        className={`shrink-0 truncate font-mono text-[10px] leading-4 ${
                          c.assignee === me ? "text-go" : "text-ink-3"
                        }`}
                      >
                        @{c.assignee === me ? t("you") : c.assignee}
                      </span>
                    )}
                  </span>
                  <span
                    key={c.lastAt}
                    className={`board-roll truncate text-[13px] ${
                      c.lastType === "text" ? "text-ink-2" : "text-ink-3"
                    } ${c.unread > 0 ? "font-medium text-ink-1" : ""}`}
                  >
                    {c.lastDir === "out" && c.lastType === "text" ? `${t("you")}: ` : ""}
                    {preview || " "}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1 self-start pt-0.5">
                  {c.waitingSince ? (
                    <span className={`font-mono text-xs ${WAIT_TEXT[level]}`} title={t("waitingFor", { t: formatWait(wait) })}>
                      {formatWait(wait)}
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-ink-3">{c.lastAt ? formatListTime(c.lastAt, now, lang) : ""}</span>
                  )}
                  {c.unread > 0 && (
                    <span
                      className={`min-w-5 rounded-full px-1.5 text-center font-mono text-[11px] leading-5 font-medium ${
                        c.muted ? "bg-hover text-ink-3" : WAIT_PILL[level]
                      }`}
                    >
                      {c.unread > 99 ? "99+" : c.unread}
                    </span>
                  )}
                </span>
              </button>
              {/* Shown on hover / keyboard focus. On touch screens use the menu in the chat header. */}
              <button
                type="button"
                aria-label={t("moreActions", { name: c.displayName })}
                aria-haspopup="menu"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  onMenu(c.userId, { top: r.bottom + 4, left: r.right - 208 });
                }}
                className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md border border-rule-strong bg-raised text-ink-2 pointer-events-none opacity-0 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 hover:text-ink focus-visible:pointer-events-auto focus-visible:opacity-100"
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </button>
            </li>
          );
        })}
        {conversations.length === 0 && (
          <li className="px-4 py-6 text-ink-3">{query ? t("noMatches", { q: query }) : t("noneInScope")}</li>
        )}
      </ul>
    </div>
  );
});
