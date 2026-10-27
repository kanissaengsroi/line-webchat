"use client";

import { Fragment, useEffect, useLayoutEffect, useRef } from "react";
import {
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
import { useLang } from "./LangProvider";
import { dayKey, formatClock, formatDay } from "@/lib/format";
import { typeLabel } from "@/lib/i18n";
import type { MessageType } from "@/lib/types";
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

/** Whose side of the conversation the reader is on. */
export type Perspective = "agent" | "customer";

interface Props {
  /** Changes when a different conversation is shown, to jump back to the latest message. */
  resetKey: string;
  messages: UIMessage[] | undefined;
  now: number;
  perspective: Perspective;
  empty: React.ReactNode;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
}

export function MessageList({ resetKey, messages, now, perspective, empty, onRetry, onDiscard }: Props) {
  const { t, lang } = useLang();
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useLayoutEffect(() => {
    stickToBottom.current = true;
  }, [resetKey]);

  // Follow new messages only when the reader is already at the bottom.
  useEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, resetKey]);

  return (
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
      {messages?.length === 0 && empty}
      <ol className="flex flex-col">
        {messages?.map((m, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const newDay = !prev || dayKey(prev.at) !== dayKey(m.at);
          const endsGroup =
            !next ||
            next.dir !== m.dir ||
            next.at - m.at > 5 * 60000 ||
            next.type === "follow" ||
            next.type === "unfollow";
          return (
            <Fragment key={m.id}>
              {newDay && (
                <li className="my-4 flex items-center gap-3 text-xs text-ink-3" aria-hidden>
                  <span className="h-px flex-1 bg-rule" />
                  {formatDay(m.at, now, lang, t("today"), t("yesterday"))}
                  <span className="h-px flex-1 bg-rule" />
                </li>
              )}
              <MessageRow
                message={m}
                endsGroup={endsGroup}
                perspective={perspective}
                onRetry={onRetry}
                onDiscard={onDiscard}
              />
            </Fragment>
          );
        })}
      </ol>
    </div>
  );
}

function MessageRow({
  message: m,
  endsGroup,
  perspective,
  onRetry,
  onDiscard,
}: {
  message: UIMessage;
  endsGroup: boolean;
  perspective: Perspective;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
}) {
  const { t, lang } = useLang();

  if (m.type === "follow" || m.type === "unfollow") {
    if (perspective === "customer") return null;
    const Icon = m.type === "follow" ? UserPlus : UserX;
    return (
      <li className="my-3 flex items-center justify-center gap-2 text-xs text-ink-3">
        <Icon className="size-3.5" aria-hidden />
        {typeLabel(lang, m.type)} · <span className="font-mono">{formatClock(m.at, lang)}</span>
      </li>
    );
  }

  // The reader's own messages sit on the right.
  const mine = perspective === "agent" ? m.dir === "out" : m.dir === "in";
  const Icon = TYPE_ICON[m.type];

  const meta: string[] = [];
  if (perspective === "agent") {
    if (m.dir === "out" && m.agent) meta.push(m.agent);
    meta.push(formatClock(m.at, lang));
    if (m.dir === "in" && m.via === "web") meta.push(t("viaWeb"));
    if (m.echoed === true) meta.push(t("echoedToLine"));
    if (m.webOnly || m.echoed === false) meta.push(t("webOnly"));
  } else {
    meta.push(formatClock(m.at, lang));
    if (m.dir === "in" && m.via !== "web") meta.push(t("fromLineApp"));
    if (m.echoed === true) meta.push(t("echoedToLine"));
    if (m.echoed === false) meta.push(t("notInLine"));
  }
  const warn = m.webOnly || m.echoed === false;
  if (m.status === "sending") meta.push(t("sending"));

  return (
    <li className={`rise flex flex-col ${mine ? "items-end" : "items-start"} ${endsGroup ? "mb-3" : "mb-1"}`}>
      <div
        className={`max-w-[min(42rem,75%)] rounded-2xl px-3.5 py-2 text-[15px] leading-6 whitespace-pre-wrap [overflow-wrap:anywhere] ${
          mine ? "rounded-br-md bg-rule-strong text-ink" : "rounded-bl-md bg-raised text-ink"
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
          <button
            type="button"
            onClick={() => onRetry(m.id)}
            className="font-medium text-ink underline underline-offset-2 hover:text-go"
          >
            {t("retry")}
          </button>
          <button type="button" onClick={() => onDiscard(m.id)} className="text-ink-3 hover:text-ink-1">
            {t("discard")}
          </button>
        </div>
      ) : (
        (endsGroup || m.status === "sending" || warn) && (
          <div className={`mt-1 px-1 font-mono text-[11px] ${warn ? "text-amber" : "text-ink-3"}`}>
            {meta.join(" · ")}
          </div>
        )
      )}
    </li>
  );
}
