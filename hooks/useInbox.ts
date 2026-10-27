"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  compareConversations,
  type ChatMessage,
  type Conversation,
  type ConversationFlags,
  type MessageEvent,
} from "@/lib/types";

export type SendStatus = "sending" | "failed";
export interface UIMessage extends ChatMessage {
  status?: SendStatus;
  error?: string;
}

export type Connection = "connecting" | "live" | "reconnecting" | "polling";

interface State {
  conversations: Record<string, Conversation>;
  messages: Record<string, UIMessage[]>;
  listLoaded: boolean;
  listError: boolean;
}

type Action =
  | { type: "list"; conversations: Conversation[] }
  | { type: "listError" }
  | { type: "thread"; userId: string; conversation: Conversation; messages: ChatMessage[] }
  | { type: "receive"; event: MessageEvent }
  | { type: "read"; userId: string }
  | { type: "update"; conversation: Conversation }
  | { type: "remove"; userId: string }
  | { type: "sending"; userId: string; message: UIMessage }
  | { type: "sendFailed"; userId: string; id: string; error: string }
  | { type: "discard"; userId: string; id: string };

/**
 * Orders a thread by server time. Unsent local messages carry the browser's clock, which can
 * be off from the server's, so they always stay at the bottom until the server copy replaces them.
 */
function byTime(a: UIMessage, b: UIMessage) {
  const pa = a.status ? 1 : 0;
  const pb = b.status ? 1 : 0;
  return pa - pb || a.at - b.at;
}

/** Adds or replaces a message (matched by id) and keeps the thread in order. */
export function upsertMessage(list: UIMessage[], message: UIMessage): UIMessage[] {
  return [...list.filter((m) => m.id !== message.id), message].sort(byTime);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "list": {
      const conversations: Record<string, Conversation> = {};
      for (const c of action.conversations) conversations[c.userId] = c;
      return { ...state, conversations, listLoaded: true, listError: false };
    }
    case "listError":
      return { ...state, listLoaded: true, listError: true };
    case "thread": {
      // Keep unsent local messages when the server copy arrives.
      const pending = (state.messages[action.userId] ?? []).filter((m) => m.status);
      let merged: UIMessage[] = [...action.messages].sort(byTime);
      for (const p of pending) if (!merged.some((m) => m.id === p.id)) merged = upsertMessage(merged, p);
      return {
        ...state,
        conversations: { ...state.conversations, [action.userId]: action.conversation },
        messages: { ...state.messages, [action.userId]: merged },
      };
    }
    case "receive": {
      const { conversation, message } = action.event;
      const id = conversation.userId;
      const current = state.messages[id];
      return {
        ...state,
        conversations: { ...state.conversations, [id]: conversation },
        messages: current ? { ...state.messages, [id]: upsertMessage(current, message) } : state.messages,
      };
    }
    case "read": {
      const conv = state.conversations[action.userId];
      if (!conv || conv.unread === 0) return state;
      return { ...state, conversations: { ...state.conversations, [action.userId]: { ...conv, unread: 0 } } };
    }
    case "update": {
      const { conversation } = action;
      if (!state.conversations[conversation.userId]) return state;
      return { ...state, conversations: { ...state.conversations, [conversation.userId]: conversation } };
    }
    case "remove": {
      const conversations = { ...state.conversations };
      const messages = { ...state.messages };
      delete conversations[action.userId];
      delete messages[action.userId];
      return { ...state, conversations, messages };
    }
    case "sending":
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.userId]: upsertMessage(state.messages[action.userId] ?? [], action.message),
        },
      };
    case "sendFailed":
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.userId]: (state.messages[action.userId] ?? []).map((m) =>
            m.id === action.id ? { ...m, status: "failed", error: action.error } : m,
          ),
        },
      };
    case "discard":
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.userId]: (state.messages[action.userId] ?? []).filter((m) => m.id !== action.id),
        },
      };
  }
}

const POLL_MS = 4000;
const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

function newId() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function useInbox(selectedId: string | null) {
  const [state, dispatch] = useReducer(reducer, {
    conversations: {},
    messages: {},
    listLoaded: false,
    listError: false,
  });
  const [connection, setConnection] = useState<Connection>(PUSHER_KEY ? "connecting" : "polling");
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      if (res.status === 401) return window.location.assign("/login");
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { conversations: Conversation[] };
      dispatch({ type: "list", conversations: data.conversations });
    } catch {
      dispatch({ type: "listError" });
    }
  }, []);

  const markRead = useCallback((userId: string) => {
    dispatch({ type: "read", userId });
    fetch(`/api/conversations/${userId}/read`, { method: "POST" }).catch(() => {});
  }, []);

  /** Loads a thread; the open thread counts as read while the tab is visible. */
  const loadThread = useCallback(
    async (userId: string) => {
      try {
        const res = await fetch(`/api/conversations/${userId}/messages`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { conversation: Conversation; messages: ChatMessage[] };
        dispatch({ type: "thread", userId, ...data });
        if (
          data.conversation.unread > 0 &&
          userId === selectedRef.current &&
          document.visibilityState === "visible"
        ) {
          markRead(userId);
        }
      } catch {}
    },
    [markRead],
  );

  // Initial load + polling fallback when Pusher is not configured.
  useEffect(() => {
    loadList();
    if (PUSHER_KEY) return;
    const timer = setInterval(() => {
      loadList();
      if (selectedRef.current) loadThread(selectedRef.current);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [loadList, loadThread]);

  // Opening a conversation loads its thread (which clears its unread count).
  useEffect(() => {
    if (selectedId) loadThread(selectedId);
  }, [selectedId, loadThread]);

  // Realtime via Pusher.
  useEffect(() => {
    if (!PUSHER_KEY || !PUSHER_CLUSTER) return;
    let disposed = false;
    let cleanup = () => {};
    import("pusher-js").then(({ default: Pusher }) => {
      if (disposed) return;
      const pusher = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER, channelAuthorization: { endpoint: "/api/pusher/auth", transport: "ajax" } });
      let wasLive = false;
      pusher.connection.bind("state_change", ({ current }: { current: string }) => {
        if (current === "connected") {
          setConnection("live");
          // Catch up on anything missed while disconnected.
          if (wasLive) {
            loadList();
            if (selectedRef.current) loadThread(selectedRef.current);
          }
          wasLive = true;
        } else if (current === "connecting" || current === "initialized") {
          setConnection(wasLive ? "reconnecting" : "connecting");
        } else {
          setConnection("reconnecting");
        }
      });
      const channel = pusher.subscribe("private-inbox");
      channel.bind("message:new", (event: MessageEvent) => {
        dispatch({ type: "receive", event });
        const id = event.conversation.userId;
        if (event.truncated && id === selectedRef.current) loadThread(id);
        if (id === selectedRef.current && event.message.dir === "in" && document.visibilityState === "visible") {
          markRead(id);
        }
      });
      channel.bind("conv:read", ({ userId }: { userId: string }) => dispatch({ type: "read", userId }));
      channel.bind("conv:update", ({ conversation }: { conversation: Conversation }) =>
        dispatch({ type: "update", conversation }),
      );
      channel.bind("conv:delete", ({ userId }: { userId: string }) => dispatch({ type: "remove", userId }));
      cleanup = () => pusher.disconnect();
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [loadList, loadThread, markRead]);

  const deliver = useCallback(async (userId: string, message: UIMessage) => {
    dispatch({ type: "sending", userId, message: { ...message, status: "sending", error: undefined } });
    try {
      const res = await fetch(`/api/conversations/${userId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message.text, clientId: message.id }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<MessageEvent> & {
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.message || !data.conversation) {
        dispatch({ type: "sendFailed", userId, id: message.id, error: data.detail ?? data.error ?? "" });
        return;
      }
      dispatch({ type: "receive", event: { conversation: data.conversation, message: data.message } });
    } catch {
      dispatch({ type: "sendFailed", userId, id: message.id, error: "" });
    }
  }, []);

  const send = useCallback(
    (userId: string, text: string, agent: string) =>
      deliver(userId, { id: newId(), dir: "out", type: "text", text, at: Date.now(), agent }),
    [deliver],
  );

  const retry = useCallback(
    (userId: string, id: string) => {
      const message = state.messages[userId]?.find((m) => m.id === id);
      if (message) deliver(userId, { ...message, at: Date.now() });
    },
    [state.messages, deliver],
  );

  const discard = useCallback((userId: string, id: string) => dispatch({ type: "discard", userId, id }), []);

  /** Pin / mute / assign, applied at once and rolled back if the server refuses. */
  const setFlags = useCallback(
    async (userId: string, flags: ConversationFlags) => {
      const before = state.conversations[userId];
      if (!before) return;
      dispatch({
        type: "update",
        conversation: {
          ...before,
          ...flags,
          assignee: flags.assignee === undefined ? before.assignee : (flags.assignee ?? undefined),
        },
      });
      try {
        const res = await fetch(`/api/conversations/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(flags),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        dispatch({ type: "update", conversation: before });
      }
    },
    [state.conversations],
  );

  /** Deletes the conversation and its history. Resolves false if the server refused. */
  const remove = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/conversations/${userId}`, { method: "DELETE" });
      if (!res.ok) return false;
      dispatch({ type: "remove", userId });
      return true;
    } catch {
      return false;
    }
  }, []);

  const conversations = useMemo(
    () => Object.values(state.conversations).sort(compareConversations),
    [state.conversations],
  );

  return {
    conversations,
    byId: state.conversations,
    messages: state.messages,
    listLoaded: state.listLoaded,
    listError: state.listError,
    connection,
    send,
    retry,
    discard,
    setFlags,
    remove,
    reload: loadList,
  };
}
