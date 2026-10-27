"use client";

import { Fragment, useEffect, useLayoutEffect, useRef } from "react";
import {
  ArrowLeft,
  CircleHelp,
  File,
  Image as ImageIcon,
  LoaderCircle,
  MapPin,
  Mic,
  Sticker,
  UserPlus,
  UserX,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "./Avatar";
import { Composer } from "./Composer";
import { useLang } from "./LangProvider";
import { dayKey, formatClock, formatDay, formatWait, shortId, waitLevel } from "@/lib/format";
import { typeLabel } from "@/lib/i18n";
import type { Conversation, MessageType } from "@/lib/types";
import type { UIMessage } from "@/hooks/useInbox";

const TYPE_ICON: Partial<Record<MessageType, LucideIcon>> = {
  sticker: Sticker,
  image: ImageIcon,
  video: Video,
  audio: Mic,
  file: File,
  location: MapPin,
  unknown: CircleHelp,
};

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
  const { t, lang } = useLang();
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const wait = c.waitingSince ? now - c.waitingSince : 0;
  const level = waitLevel(wait);

  // Open each conversation at its latest message.
  useLayoutEffect(() => {
    stickToBottom.current = true;
  }, [c.userId]);

  // Follow new messages only when the agent is already at the bottom.
  useEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, c.userId]);

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
          <p className="mt-0.5 font-mono text-xs text-ink-3" title={c.userId}>
            LINE · {shortId(c.userId)}
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

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5"
        aria-live="polite"
        aria-relevant="additions"
      >
        {!messages && (
          <div className="flex h-full items-center justify-center text-ink-3">
            <LoaderCircle className="size-5 animate-spin" aria-hidden />
          </div>
        )}
        {messages?.length === 0 && <p className="py-10 text-center text-ink-3">{t("noMessages")}</p>}
        <ol className="flex flex-col">
          {messages?.map((m, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const newDay = !prev || dayKey(prev.at) !== dayKey(m.at);
            const endsGroup = !next || next.dir !== m.dir || next.at - m.at > 5 * 60000 || next.type === "follow" || next.type === "unfollow";
            return (
              <Fragment key={m.id}>
                {newDay && (
                  <li className="my-4 flex items-center gap-3 text-xs text-ink-3" aria-hidden>
                    <span className="h-px flex-1 bg-rule" />
                    {formatDay(m.at, now, lang, t("today"), t("yesterday"))}
                    <span className="h-px flex-1 bg-rule" />
                  </li>
                )}
                <MessageRow message={m} endsGroup={endsGroup} onRetry={onRetry} onDiscard={onDiscard} />
              </Fragment>
            );
          })}
        </ol>
      </div>

      {c.blocked && (
        <p role="status" className="border-t border-red/40 bg-red-dim px-5 py-2.5 text-[13px] text-red">
          {t("blocked")}
        </p>
      )}
      {/* Keyed by user so a draft never carries over to someone else. */}
      <Composer
        key={c.userId}
        ref={composerRef}
        recipient={c.displayName}
        disabled={c.blocked}
        onSend={onSend}
        onEscape={onBack}
      />
    </section>
  );
}

function MessageRow({
  message: m,
  endsGroup,
  onRetry,
  onDiscard,
}: {
  message: UIMessage;
  endsGroup: boolean;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
}) {
  const { t, lang } = useLang();

  if (m.type === "follow" || m.type === "unfollow") {
    const Icon = m.type === "follow" ? UserPlus : UserX;
    return (
      <li className="my-3 flex items-center justify-center gap-2 text-xs text-ink-3">
        <Icon className="size-3.5" aria-hidden />
        {typeLabel(lang, m.type)} · <span className="font-mono">{formatClock(m.at, lang)}</span>
      </li>
    );
  }

  const out = m.dir === "out";
  const Icon = TYPE_ICON[m.type];
  return (
    <li className={`rise flex flex-col ${out ? "items-end" : "items-start"} ${endsGroup ? "mb-3" : "mb-1"}`}>
      <div
        className={`max-w-[min(42rem,75%)] rounded-2xl px-3.5 py-2 text-[15px] leading-6 whitespace-pre-wrap [overflow-wrap:anywhere] ${
          out ? "rounded-br-md bg-rule-strong text-ink" : "rounded-bl-md bg-raised text-ink"
        } ${m.status === "sending" ? "opacity-60" : ""} ${m.status === "failed" ? "ring-1 ring-red/60" : ""}`}
      >
        {Icon ? (
          <span className="flex items-center gap-2 text-ink-2">
            <Icon className="size-4 shrink-0" aria-hidden />
            <span>
              {typeLabel(lang, m.type)}
              {m.text && <span className="text-ink-1"> · {m.text}</span>}
            </span>
          </span>
        ) : (
          m.text
        )}
      </div>
      {m.status === "failed" ? (
        <div className="mt-1 flex items-center gap-3 text-xs" role="alert">
          <span className="text-red">
            {m.error ? t("err_line_push_failed", { detail: m.error }) : t("err_generic")}
          </span>
          <button type="button" onClick={() => onRetry(m.id)} className="font-medium text-ink underline underline-offset-2 hover:text-go">
            {t("retry")}
          </button>
          <button type="button" onClick={() => onDiscard(m.id)} className="text-ink-3 hover:text-ink-1">
            {t("discard")}
          </button>
        </div>
      ) : (
        (endsGroup || m.status === "sending") && (
          <div className="mt-1 px-1 font-mono text-[11px] text-ink-3">
            {out && m.agent ? `${m.agent} · ` : ""}
            {formatClock(m.at, lang)}
            {m.status === "sending" && ` · ${t("sending")}`}
          </div>
        )
      )}
    </li>
  );
}
