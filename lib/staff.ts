import { createHash } from "node:crypto";

/**
 * Usernames allowed to open the inbox, from STAFF_USERNAMES (comma separated).
 * Unset in development means anyone may sign in as staff; in production nobody may.
 */
export function isStaffUsername(username: string): boolean {
  const list = (process.env.STAFF_USERNAMES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return process.env.NODE_ENV !== "production";
  return list.includes(username.toLowerCase());
}

/** Stable conversation ID for a website guest: same username, same thread. */
export function guestConvId(username: string): string {
  return `web-${createHash("sha256").update(username.toLowerCase()).digest("hex").slice(0, 24)}`;
}
