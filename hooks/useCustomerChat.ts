"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, MessageEvent } from "@/lib/types";
import { upsertMessage, type Connection, type UIMessage } from "./useInbox";

const POLL_MS = 4000;
const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

function newId() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

const upsert = upsertMessage;

// How long to wait for LINE's webhook copy of a message sent with liff.sendMessages.
const ECHO_TIMEOUT_MS = 15000;

/**
 * The signed-in customer's own thread with the OA, kept live.
 * With `sendViaLine` (inside LINE, LIFF), messages are posted as the user into their LINE chat;
 * LINE then delivers them to our webhook, and that copy replaces the local placeholder.
 */
export function useCustomerChat(convId: string, sendViaLine?: (text: string) => Promise<boolean>) {
  const [messages, setMessages] = useState<UIMessage[] | undefined>(undefined);
  /** Local placeholder id → text, for messages sent through LINE and not yet echoed back. */
  const awaitingEcho = useRef(new Map<string, string>());
  const [connection, setConnection] = useState<Connection>(PUSHER_KEY ? "connecting" : "polling");
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/me/messages", { cache: "no-store" });
      if (res.status === 401) return window.location.assign("/login");
      if (!res.ok) return;
      const data = (await res.json()) as { messages: ChatMessage[] };
      // Keep unsent local messages when the server copy arrives.
      setMessages((current) => {
        let merged: UIMessage[] = [...data.messages].sort((a, b) => a.at - b.at);
        for (const p of current ?? []) if (p.status && !merged.some((m) => m.id === p.id)) merged = upsert(merged, p);
        return merged;
      });
    } catch {}
  }, []);

  useEffect(() => {
    load();
    if (PUSHER_KEY) return;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!PUSHER_KEY || !PUSHER_CLUSTER) return;
    let disposed = false;
    let cleanup = () => {};
    import("pusher-js").then(({ default: Pusher }) => {
      if (disposed) return;
      const pusher = new Pusher(PUSHER_KEY, {
        cluster: PUSHER_CLUSTER,
        channelAuthorization: { endpoint: "/api/pusher/auth", transport: "ajax" },
      });
      let wasLive = false;
      pusher.connection.bind("state_change", ({ current }: { current: string }) => {
        if (current === "connected") {
          setConnection("live");
          if (wasLive) load();
          wasLive = true;
        } else {
          setConnection(wasLive ? "reconnecting" : "connecting");
        }
      });
      const channel = pusher.subscribe(`private-user-${convId}`);
      channel.bind("message:new", (event: MessageEvent) => {
        if (event.truncated) return void load();
        // LINE's copy of a message we sent through LINE: swap it in for the placeholder.
        let placeholder: string | undefined;
        if (event.message.dir === "in" && !event.message.via) {
          for (const [id, text] of awaitingEcho.current) {
            if (text === event.message.text) {
              placeholder = id;
              awaitingEcho.current.delete(id);
              break;
            }
          }
        }
        setMessages((current) =>
          upsert((current ?? []).filter((m) => m.id !== placeholder), event.message),
        );
      });
      // Staff deleted this conversation: start over with an empty chat.
      channel.bind("conv:delete", () => setMessages([]));
      cleanup = () => pusher.disconnect();
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [convId, load]);

  const deliver = useCallback(async (message: UIMessage) => {
    setMessages((current) => upsert(current ?? [], { ...message, status: "sending", error: undefined }));
    try {
      const res = await fetch("/api/me/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message.text, clientId: message.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: ChatMessage };
      if (!res.ok || !data.message) throw new Error(String(res.status));
      setMessages((current) => upsert(current ?? [], data.message!));
    } catch {
      setMessages((current) =>
        (current ?? []).map((m) => (m.id === message.id ? { ...m, status: "failed" } : m)),
      );
    }
  }, []);

  const send = useCallback(
    async (text: string) => {
      const message: UIMessage = { id: newId(), dir: "in", type: "text", text, at: Date.now() };
      if (sendViaLine) {
        setMessages((current) => upsert(current ?? [], { ...message, status: "sending" }));
        if (await sendViaLine(text)) {
          awaitingEcho.current.set(message.id, text);
          // No echo (e.g. realtime down): drop the placeholder and reload from the server.
          setTimeout(() => {
            if (!awaitingEcho.current.delete(message.id)) return;
            setMessages((current) => (current ?? []).filter((m) => m.id !== message.id));
            load();
          }, ECHO_TIMEOUT_MS);
          return;
        }
        // Not inside a LINE chat after all: send it to staff from the website instead.
      }
      deliver({ ...message, via: "web" });
    },
    [sendViaLine, deliver, load],
  );

  const retry = useCallback(
    (id: string) => {
      const message = messagesRef.current?.find((m) => m.id === id);
      if (message) deliver({ ...message, at: Date.now() });
    },
    [deliver],
  );

  const discard = useCallback(
    (id: string) => setMessages((current) => (current ?? []).filter((m) => m.id !== id)),
    [],
  );

  return { messages, connection, send, retry, discard };
}
