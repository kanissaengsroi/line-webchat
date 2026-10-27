"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useLang } from "./LangProvider";
import { channelOf, type Conversation } from "@/lib/types";

interface Props {
  conversation: Conversation;
  onConfirm: () => Promise<boolean>;
  onClose: () => void;
}

/** Destructive confirmation as a native modal dialog (focus trapped, Escape cancels). */
export function ConfirmDelete({ conversation: c, onConfirm, onClose }: Props) {
  const { t } = useLang();
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  async function confirm() {
    setBusy(true);
    setFailed(false);
    const ok = await onConfirm();
    if (ok) onClose();
    else {
      setBusy(false);
      setFailed(true);
    }
  }

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself) cancels.
        if (e.target === ref.current && !busy) onClose();
      }}
      aria-labelledby="delete-title"
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-rule-strong bg-raised p-0 text-ink shadow-[0_24px_64px_-16px_oklch(0_0_0/0.7)] backdrop:bg-[oklch(0.1_0.01_255/0.7)]"
    >
      <div className="p-5">
        <h2 id="delete-title" className="text-lg font-semibold tracking-[-0.01em]">
          {t("deleteTitle", { name: c.displayName })}
        </h2>
        <p className="mt-2 text-ink-2">
          {t(channelOf(c.userId) === "web" ? "deleteBodyWeb" : "deleteBodyLine")}
        </p>
        {failed && (
          <p role="alert" className="mt-3 text-[13px] text-red">
            {t("deleteFailed")}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-rule px-5 py-3">
        <button
          type="button"
          autoFocus
          disabled={busy}
          onClick={onClose}
          className="h-9 rounded-lg px-3.5 font-medium text-ink-1 hover:bg-hover disabled:opacity-60"
        >
          {t("cancel")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={confirm}
          className="flex h-9 items-center gap-2 rounded-lg bg-red px-3.5 font-semibold text-ground hover:brightness-110 disabled:opacity-70"
        >
          {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {t("deleteChat")}
        </button>
      </div>
    </dialog>
  );
}
