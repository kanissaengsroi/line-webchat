import { Redis } from "@upstash/redis";
import { env } from "./env";
import type { ChatMessage, Conversation, MessageType } from "./types";

const MAX_HISTORY = 500;

export interface Profile {
  displayName: string;
  pictureUrl?: string;
}

export interface Store {
  getConversation(userId: string): Promise<Conversation | null>;
  listConversations(limit?: number): Promise<Conversation[]>;
  /** Creates the conversation if needed and returns it updated. */
  upsertProfile(userId: string, profile: Profile): Promise<Conversation>;
  appendMessage(userId: string, message: ChatMessage): Promise<Conversation>;
  getMessages(userId: string, limit?: number): Promise<ChatMessage[]>;
  markRead(userId: string): Promise<void>;
}

function emptyConversation(userId: string): Conversation {
  return {
    userId,
    // Replaced by the real LINE display name once the profile is fetched.
    displayName: `LINE user ${userId.slice(-4)}`,
    lastText: "",
    lastType: "text",
    lastDir: "in",
    lastAt: 0,
    waitingSince: 0,
    unread: 0,
  };
}

/** Applies a new message to a conversation summary. */
function applyMessage(conv: Conversation, msg: ChatMessage): Conversation {
  const next = { ...conv, lastText: msg.text, lastType: msg.type, lastDir: msg.dir, lastAt: msg.at };
  if (msg.via === "web") next.web = true;
  if (msg.type === "follow") next.blocked = false;
  if (msg.type === "unfollow") next.blocked = true;
  if (msg.type === "follow" || msg.type === "unfollow") return next;
  if (msg.dir === "in") {
    next.unread = conv.unread + 1;
    if (!conv.waitingSince) next.waitingSince = msg.at;
  } else {
    next.waitingSince = 0;
  }
  return next;
}

// ---------------------------------------------------------------------------
// Upstash Redis
//   user:{id}  hash  → Conversation fields
//   convs      zset  → userId scored by lastAt
//   msgs:{id}  list  → ChatMessage JSON, newest first, capped at MAX_HISTORY
// ---------------------------------------------------------------------------

function fromHash(userId: string, raw: Record<string, unknown> | null): Conversation | null {
  if (!raw || Object.keys(raw).length === 0) return null;
  const pictureUrl = raw.pictureUrl ? String(raw.pictureUrl) : undefined;
  return {
    userId,
    displayName: String(raw.displayName ?? "LINE user"),
    pictureUrl,
    lastText: String(raw.lastText ?? ""),
    lastType: String(raw.lastType ?? "text") as MessageType,
    lastDir: raw.lastDir === "out" ? "out" : "in",
    lastAt: Number(raw.lastAt ?? 0),
    waitingSince: Number(raw.waitingSince ?? 0),
    unread: Number(raw.unread ?? 0),
    blocked: raw.blocked === true || raw.blocked === "true",
    web: raw.web === true || raw.web === "true",
  };
}

function toHash(conv: Conversation): Record<string, string | number> {
  return {
    displayName: conv.displayName,
    pictureUrl: conv.pictureUrl ?? "",
    lastText: conv.lastText,
    lastType: conv.lastType,
    lastDir: conv.lastDir,
    lastAt: conv.lastAt,
    waitingSince: conv.waitingSince,
    unread: conv.unread,
    blocked: conv.blocked ? "true" : "false",
    web: conv.web ? "true" : "false",
  };
}

class RedisStore implements Store {
  constructor(private redis: Redis) {}

  async getConversation(userId: string) {
    return fromHash(userId, await this.redis.hgetall(`user:${userId}`));
  }

  async listConversations(limit = 100) {
    const ids = await this.redis.zrange<string[]>("convs", 0, limit - 1, { rev: true });
    if (ids.length === 0) return [];
    const pipe = this.redis.pipeline();
    for (const id of ids) pipe.hgetall(`user:${id}`);
    const rows = await pipe.exec<(Record<string, unknown> | null)[]>();
    return ids
      .map((id, i) => fromHash(String(id), rows[i]))
      .filter((c): c is Conversation => c !== null);
  }

  async upsertProfile(userId: string, profile: Profile) {
    const conv = (await this.getConversation(userId)) ?? emptyConversation(userId);
    const next = { ...conv, displayName: profile.displayName, pictureUrl: profile.pictureUrl };
    await this.redis.hset(`user:${userId}`, toHash(next));
    if (!conv.lastAt) await this.redis.zadd("convs", { score: Date.now(), member: userId });
    return next;
  }

  async appendMessage(userId: string, message: ChatMessage) {
    const conv = (await this.getConversation(userId)) ?? emptyConversation(userId);
    const next = applyMessage(conv, message);
    const pipe = this.redis.pipeline();
    pipe.lpush(`msgs:${userId}`, JSON.stringify(message));
    pipe.ltrim(`msgs:${userId}`, 0, MAX_HISTORY - 1);
    pipe.hset(`user:${userId}`, toHash(next));
    pipe.zadd("convs", { score: message.at, member: userId });
    await pipe.exec();
    return next;
  }

  async getMessages(userId: string, limit = 200) {
    const raw = await this.redis.lrange<ChatMessage | string>(`msgs:${userId}`, 0, limit - 1);
    return raw
      .map((m) => (typeof m === "string" ? (JSON.parse(m) as ChatMessage) : m))
      .reverse();
  }

  async markRead(userId: string) {
    await this.redis.hset(`user:${userId}`, { unread: 0 });
  }
}

// ---------------------------------------------------------------------------
// In-memory store for local development without Upstash credentials.
// Lives on globalThis so it survives hot reloads; lost on restart.
// ---------------------------------------------------------------------------

class MemoryStore implements Store {
  private convs = new Map<string, Conversation>();
  private msgs = new Map<string, ChatMessage[]>();

  async getConversation(userId: string) {
    return this.convs.get(userId) ?? null;
  }

  async listConversations(limit = 100) {
    return [...this.convs.values()].sort((a, b) => b.lastAt - a.lastAt).slice(0, limit);
  }

  async upsertProfile(userId: string, profile: Profile) {
    const conv = this.convs.get(userId) ?? { ...emptyConversation(userId), lastAt: Date.now() };
    const next = { ...conv, ...profile };
    this.convs.set(userId, next);
    return next;
  }

  async appendMessage(userId: string, message: ChatMessage) {
    const next = applyMessage(this.convs.get(userId) ?? emptyConversation(userId), message);
    this.convs.set(userId, next);
    const list = this.msgs.get(userId) ?? [];
    list.push(message);
    this.msgs.set(userId, list.slice(-MAX_HISTORY));
    return next;
  }

  async getMessages(userId: string, limit = 200) {
    return (this.msgs.get(userId) ?? []).slice(-limit);
  }

  async markRead(userId: string) {
    const conv = this.convs.get(userId);
    if (conv) this.convs.set(userId, { ...conv, unread: 0 });
  }
}

const globalStore = globalThis as unknown as { __lineWebchatStore?: Store };

export function getStore(): Store {
  if (globalStore.__lineWebchatStore) return globalStore.__lineWebchatStore;
  const creds = env.redis;
  if (creds) {
    globalStore.__lineWebchatStore = new RedisStore(new Redis(creds));
  } else {
    console.warn("[store] No Upstash credentials — using in-memory store (dev only).");
    globalStore.__lineWebchatStore = new MemoryStore();
  }
  return globalStore.__lineWebchatStore;
}
