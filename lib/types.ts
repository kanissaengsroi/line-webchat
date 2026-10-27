export type MessageType =
  | "text"
  | "sticker"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "location"
  | "follow"
  | "unfollow"
  | "unknown";

export interface ChatMessage {
  id: string;
  dir: "in" | "out";
  type: MessageType;
  text: string;
  at: number;
  /** Agent username for outgoing messages. */
  agent?: string;
}

export interface Conversation {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  lastText: string;
  lastType: MessageType;
  lastDir: "in" | "out";
  lastAt: number;
  /** Time of the oldest inbound message not yet answered, 0 when answered. */
  waitingSince: number;
  unread: number;
  blocked?: boolean;
}

export interface MessageEvent {
  conversation: Conversation;
  message: ChatMessage;
  /** True when the message text was cut to fit the realtime payload. */
  truncated?: boolean;
}

export const LINE_USER_ID = /^U[0-9a-f]{32}$/;
export const MAX_TEXT = 5000;
