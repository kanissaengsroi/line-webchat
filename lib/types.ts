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
  /** Inbound only: "web" when the customer typed it on the website instead of the LINE app. */
  via?: "web";
  /** Outbound only: LINE push failed (e.g. not a friend), so only the website shows it. */
  webOnly?: boolean;
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
  /** A LINE user who has also chatted from the website (signed in with LINE Login). */
  web?: boolean;
}

export interface MessageEvent {
  conversation: Conversation;
  message: ChatMessage;
  /** True when the message text was cut to fit the realtime payload. */
  truncated?: boolean;
}

export const LINE_USER_ID = /^U[0-9a-f]{32}$/;
/** A conversation is either a LINE user (their user ID) or a website guest ("web-" + hash). */
export const CONV_ID = /^(U[0-9a-f]{32}|web-[0-9a-f]{24})$/;

export type Channel = "line" | "web";
export const channelOf = (convId: string): Channel => (convId.startsWith("web-") ? "web" : "line");
export const MAX_TEXT = 5000;
