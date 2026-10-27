"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { CustomerChat } from "@/components/CustomerChat";
import { useLang } from "@/components/LangProvider";

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;

interface Me {
  convId: string;
  username: string;
  picture?: string;
  oa: { name: string; pictureUrl?: string; id: string };
}

type State =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; me: Me; sendViaLine?: (text: string) => Promise<boolean> };

/**
 * The customer chat running inside LINE (LIFF). Signs in with the LIFF ID token, and when the page
 * was opened from a LINE chat, sends messages as the user into that chat with liff.sendMessages.
 */
export default function LiffPage() {
  const { t } = useLang();
  const [state, setState] = useState<State>({ phase: "loading" });

  const start = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      if (!LIFF_ID) throw new Error("NEXT_PUBLIC_LIFF_ID is not set");
      const { default: liff } = await import("@line/liff");
      await liff.init({ liffId: LIFF_ID });
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
        return;
      }

      const idToken = liff.getIDToken();
      if (!idToken) throw new Error("no ID token");
      const auth = await fetch("/api/auth/liff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!auth.ok) throw new Error(`liff auth ${auth.status}`);
      const meRes = await fetch("/api/me", { cache: "no-store" });
      if (!meRes.ok) throw new Error(`me ${meRes.status}`);
      const me = (await meRes.json()) as Me;

      // sendMessages only works inside the LINE app, opened from a chat (with the OA).
      const type = liff.getContext()?.type;
      const inChat = liff.isInClient() && (type === "utou" || type === "room" || type === "group");
      const sendViaLine = inChat
        ? async (text: string) => {
            try {
              await liff.sendMessages([{ type: "text", text }]);
              return true;
            } catch (err) {
              console.error("[liff] sendMessages failed", err);
              return false;
            }
          }
        : undefined;
      setState({ phase: "ready", me, sendViaLine });
    } catch (err) {
      console.error("[liff]", err);
      setState({ phase: "error" });
    }
  }, []);

  useEffect(() => {
    start();
  }, [start]);

  if (state.phase === "ready") {
    return (
      <CustomerChat
        convId={state.me.convId}
        username={state.me.username}
        picture={state.me.picture}
        oa={state.me.oa}
        sendViaLine={state.sendViaLine}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <BrandMark className="size-8 text-go" />
      {state.phase === "loading" ? (
        <p className="flex items-center gap-2 text-ink-2">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          {t("liffLoading")}
        </p>
      ) : (
        <>
          <p role="alert" className="font-medium text-ink">
            {t("liffFailed")}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={start}
              className="h-10 rounded-lg bg-go px-4 font-semibold text-on-go hover:bg-go-hover"
            >
              {t("liffRetry")}
            </button>
            <a href="/login" className="flex h-10 items-center rounded-lg border border-rule-strong px-4 text-ink-1 hover:bg-raised">
              {t("liffUseWeb")}
            </a>
          </div>
        </>
      )}
    </div>
  );
}
