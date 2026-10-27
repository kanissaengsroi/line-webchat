import { createHash } from "node:crypto";

/** Usernames from STAFF_USERNAMES (comma separated), as written there. */
export function staffUsernames(): string[] {
  return (process.env.STAFF_USERNAMES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Usernames allowed to open the inbox, from STAFF_USERNAMES.
 * Unset in development means anyone may sign in as staff; in production nobody may.
 */
export function isStaffUsername(username: string): boolean {
  const list = staffUsernames().map((s) => s.toLowerCase());
  if (list.length === 0) return process.env.NODE_ENV !== "production";
  return list.includes(username.toLowerCase());
}

/** Whether staff replies sent to LINE start with the agent's name ("agent1: …"). */
export const showAgentName = () => process.env.NEXT_PUBLIC_SHOW_AGENT_NAME === "true";

/** Stable conversation ID for a website guest: same username, same thread. */
export function guestConvId(username: string): string {
  return `web-${createHash("sha256").update(username.toLowerCase()).digest("hex").slice(0, 24)}`;
}
