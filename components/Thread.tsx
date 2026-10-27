"use client";

import { ArrowLeft, Globe } from "lucide-react";
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
}

export function Thread({ conversation: c, messages, now, composerRef, onBack, onSend, onRetry, onDiscard }: Props) {
  const { t } = useLang();
  const wait = c.waitingSince ? now - c.waitingSince : 0;
  const level = waitLevel(wait);
  const web = channelOf(c.userId) === "web";

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
          <h2 className="truncate text-lg leading-tight font-semibold tracking-[-0.01em] text-ink">{c.displayName}</h2>
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
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-xs ${
            c.waitingSince ? WAIT_CHIP[level] : "border-rule text-ink-3"
          }`}
        >
          {c.waitingSince ? t("waitingFor", { t: formatWait(wait) }) : t("replied")}
        </span>
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
