"use client";

import { LogOut, MessageCircle, UserPlus } from "lucide-react";
import { Avatar } from "./Avatar";
import { Composer } from "./Composer";
import { ConnectionBadge } from "./Inbox";
import { LangToggle } from "./LangToggle";
import { useLang } from "./LangProvider";
import { MessageList } from "./MessageList";
import { useCustomerChat } from "@/hooks/useCustomerChat";
import { useNow } from "@/hooks/useNow";
import { channelOf } from "@/lib/types";

const OA_URL = process.env.NEXT_PUBLIC_LINE_OA_URL;
const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;

interface Props {
  convId: string;
  username: string;
  picture?: string;
  oa: { name: string; pictureUrl?: string; id: string };
  /** Inside LINE (LIFF): posts as the user into the LINE chat. Resolves false if it could not. */
  sendViaLine?: (text: string) => Promise<boolean>;
}

export function CustomerChat({ convId, username, picture, oa, sendViaLine }: Props) {
  const { t } = useLang();
  const now = useNow();
  const chat = useCustomerChat(convId, sendViaLine);
  const viaLine = channelOf(convId) === "line";

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign("/login");
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-rule bg-panel px-3 sm:px-4">
        <Avatar userId={oa.id} name={oa.name} src={oa.pictureUrl} size={32} />
        <div className="min-w-0">
          <h1 className="truncate leading-tight font-semibold text-ink">{t("chatWith", { name: oa.name })}</h1>
          <div className="mt-0.5 hidden sm:block">
            <ConnectionBadge connection={chat.connection} />
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-2 text-[13px] text-ink-2 sm:flex">
            <Avatar userId={convId} name={username} src={picture} size={22} />
            <span className="max-w-40 truncate font-medium text-ink-1">{username}</span>
          </span>
          <LangToggle />
          <button
            type="button"
            onClick={logout}
            className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-ink-2 hover:bg-raised hover:text-ink"
          >
            <LogOut className="size-4" aria-hidden />
            <span className="hidden sm:inline">{t("logout")}</span>
            <span className="sr-only sm:hidden">{t("logout")}</span>
          </button>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <MessageList
          resetKey={convId}
          messages={chat.messages}
          now={now}
          perspective="customer"
          empty={
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <Avatar userId={oa.id} name={oa.name} src={oa.pictureUrl} size={56} />
              <p className="mt-4 text-lg font-semibold text-ink">{t("customerEmptyTitle", { name: oa.name })}</p>
              <p className="mt-1 text-ink-2">{t("customerEmptyLead")}</p>
            </div>
          }
          onRetry={chat.retry}
          onDiscard={chat.discard}
        />

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pb-2 text-[13px] text-ink-3 sm:px-5">
          <span>{sendViaLine ? t("liffNote") : viaLine ? t("customerLineNote") : t("guestNote")}</span>
          {viaLine && !sendViaLine && LIFF_ID && (
            <a
              href={`https://liff.line.me/${LIFF_ID}`}
              className="inline-flex items-center gap-1.5 font-medium text-go hover:text-go-hover"
            >
              <MessageCircle className="size-4" aria-hidden />
              {t("openInLine")}
            </a>
          )}
          {viaLine && !sendViaLine && OA_URL && (
            <a
              href={OA_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-go hover:text-go-hover"
            >
              <UserPlus className="size-4" aria-hidden />
              {t("addFriend")}
            </a>
          )}
        </div>

        <Composer recipient={oa.name} mode="message" onSend={chat.send} onEscape={() => {}} />
      </div>
    </div>
  );
}
