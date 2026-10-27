"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { useLang } from "./LangProvider";
import { MAX_TEXT } from "@/lib/types";

interface Props {
  recipient: string;
  disabled?: boolean;
  onSend: (text: string) => void;
  onEscape: () => void;
}

export const Composer = forwardRef<HTMLTextAreaElement | null, Props>(function Composer(
  { recipient, disabled, onSend, onEscape },
  ref,
) {
  const { t } = useLang();
  const [text, setText] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => area.current as HTMLTextAreaElement);

  // Grow with content up to ~8 lines.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const trimmed = text.trim();
  const over = text.length > MAX_TEXT;
  const canSend = !disabled && trimmed.length > 0 && !over;

  function submit() {
    if (!canSend) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="border-t border-rule bg-panel px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5"
    >
      <div className="flex items-end gap-2 rounded-xl border border-rule-strong bg-ground p-1.5 pl-3 focus-within:border-ink-3">
        <label htmlFor="composer" className="sr-only">
          {t("replyTo", { name: recipient })}
        </label>
        <textarea
          id="composer"
          ref={area}
          rows={1}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape") {
              onEscape();
            }
          }}
          placeholder={t("replyTo", { name: recipient })}
          className="max-h-[200px] min-h-9 flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-6 text-ink placeholder:text-ink-3 focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-go px-3.5 font-semibold text-on-go transition-colors hover:bg-go-hover disabled:bg-raised disabled:text-ink-3"
        >
          <SendHorizontal className="size-4" aria-hidden />
          {t("send")}
        </button>
      </div>
      <div className="mt-1.5 flex justify-between gap-3 px-1 text-xs text-ink-3">
        <span className="hidden sm:inline">{t("sendHint")}</span>
        {text.length > MAX_TEXT - 500 && (
          <span className={`ml-auto font-mono ${over ? "text-red" : ""}`}>
            {over ? t("tooLong", { n: MAX_TEXT }) : `${text.length}/${MAX_TEXT}`}
          </span>
        )}
      </div>
    </form>
  );
});
