"use client";

import { ArrowLeft, BellOff, Globe, MoreHorizontal, Pin } from "lucide-react";
import { Avatar } from "./Avatar";
import { Composer } from "./Composer";
import { useLang } from "./LangProvider";
import { MessageList } from "./MessageList";
import { formatWait, shortId, waitLevel } from "@/lib/format";
import { channelOf, type Conversation } from "@/lib/types";
import type { UIMessage } from "@/hooks/useInbox";

const WAIT_CHIP = {
  calm: "border-rule-strong text-ink-1",
  warn: "border-amber/50 bg-amber-dim text-amber",
  late: "border-red/50 bg-red-dim text-red",
} as const;

interface Props {
  conversation: Conversation;
  messages: UIMessage[] | undefined;
  now: number;
  composerRef: React.Ref<HTMLTextAreaElement | null>;
  onBack: () => void;
  onSend: (text: string) => void;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
  onMenu: (position: { top: number; left: number }) => void;
  me: string;
  /** Staff usernames that can own a chat (empty in development = only "me"). */
  staff: string[];
  onAssign: (assignee: string | null) => void;
}

export function Thread({
  conversation: c,
  messages,
  now,
  composerRef,
  onBack,
  onSend,
  onRetry,
  onDiscard,
  onMenu,
  me,
  staff,
  onAssign,
}: Props) {
  const { t } = useLang();
  const wait = c.waitingSince ? now - c.waitingSince : 0;
  const level = c.muted ? "calm" : waitLevel(wait);
  const web = channelOf(c.userId) === "web";
  // Everyone who can own a chat, plus the current owner if they left the staff list.
  const owners = [...new Set([...(staff.length ? staff : [me]), ...(c.assignee ? [c.assignee] : [])])];

  return (
    <section aria-label={c.displayName} className="flex h-full min-h-0 flex-col">
      {/* Recipient header: who you are replying to is never in doubt. */}
      <header className="flex items-center gap-3 border-b border-rule px-3 py-3 sm:px-5">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("back")}
          className="-ml-1 flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-raised hover:text-ink md:hidden"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <Avatar userId={c.userId} name={c.displayName} src={c.pictureUrl} size={40} />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-lg leading-tight font-semibold tracking-[-0.01em] text-ink">
            <span className="truncate">{c.displayName}</span>
            {c.pinned && <Pin className="size-3.5 shrink-0 text-ink-3" aria-label={t("pinned")} />}
            {c.muted && <BellOff className="size-3.5 shrink-0 text-ink-3" aria-label={t("muted")} />}
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-ink-3" title={c.userId}>
            {web ? (
              <>
                <Globe className="size-3" aria-hidden />
                {t("webGuest")}
              </>
            ) : (
              <>
                LINE · {shortId(c.userId)}
                {c.web && ` · ${t("alsoOnWeb")}`}
              </>
            )}
          </p>
        </div>
        <label className="hidden shrink-0 items-center gap-2 text-xs text-ink-3 sm:flex">
          {t("assignee")}
          <select
            value={c.assignee ?? ""}
            onChange={(e) => onAssign(e.target.value || null)}
            className={`h-8 rounded-md border border-rule-strong bg-ground px-2 font-mono text-xs focus:border-ink-3 focus:outline-none ${
              c.assignee ? (c.assignee === me ? "text-go" : "text-ink-1") : "text-ink-3"
            }`}
          >
            <option value="">{t("unassigned")}</option>
            {owners.map((name) => (
              <option key={name} value={name}>
                {name === me ? `${name} (${t("you")})` : name}
              </option>
            ))}
          </select>
        </label>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-xs ${
            c.waitingSince ? WAIT_CHIP[level] : "border-rule text-ink-3"
          }`}
        >
          {c.waitingSince ? t("waitingFor", { t: formatWait(wait) }) : t("replied")}
        </span>
        <button
          type="button"
          aria-label={t("moreActions", { name: c.displayName })}
          aria-haspopup="menu"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            onMenu({ top: r.bottom + 4, left: r.right - 208 });
          }}
          className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-raised hover:text-ink"
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
      </header>

      <MessageList
        resetKey={c.userId}
        messages={messages}
        now={now}
        perspective="agent"
        empty={<p className="py-10 text-center text-ink-3">{t("noMessages")}</p>}
        onRetry={onRetry}
        onDiscard={onDiscard}
      />

      {c.blocked && !c.web && (
        <p role="status" className="border-t border-red/40 bg-red-dim px-5 py-2.5 text-[13px] text-red">
          {t("blocked")}
        </p>
      )}
      {/* Keyed by user so a draft never carries over to someone else. */}
      <Composer
        key={c.userId}
        ref={composerRef}
        recipient={c.displayName}
        disabled={c.blocked && !c.web}
        onSend={onSend}
        onEscape={onBack}
      />
    </section>
  );
}
