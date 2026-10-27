"use client";

import { forwardRef, useEffect, useRef } from "react";
import { Globe, Search } from "lucide-react";
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

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  query: string;
  onQuery: (q: string) => void;
  onSelect: (id: string) => void;
  now: number;
}

export const ConversationList = forwardRef<HTMLInputElement, Props>(function ConversationList(
  { conversations, selectedId, query, onQuery, onSelect, now },
  searchRef,
) {
  const { t, lang } = useLang();
  const listRef = useRef<HTMLUListElement>(null);
  const waitingCount = conversations.filter((c) => c.waitingSince).length;

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
          const level = waitLevel(wait);
          const preview = c.lastType === "text" ? c.lastText : typeLabel(lang, c.lastType);
          return (
            <li key={c.userId} data-id={c.userId}>
              <button
                type="button"
                aria-current={selected ? "true" : undefined}
                onClick={() => onSelect(c.userId)}
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
                      className={`min-w-5 rounded-full px-1.5 text-center font-mono text-[11px] leading-5 font-medium ${WAIT_PILL[level]}`}
                    >
                      {c.unread > 99 ? "99+" : c.unread}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
        {conversations.length === 0 && query && (
          <li className="px-4 py-6 text-ink-3">{t("noMatches", { q: query })}</li>
        )}
      </ul>
    </div>
  );
});
