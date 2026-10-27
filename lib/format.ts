import type { Lang } from "./i18n";

const locale = (lang: Lang) => (lang === "th" ? "th-TH" : "en-GB");

/** Compact elapsed time: 45s → "<1m", 4m, 1h 05m, 2d. */
export function formatWait(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "<1m";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${String(min % 60).padStart(2, "0")}m`;
  return `${Math.floor(h / 24)}d`;
}

/** Calm under 2 minutes, amber until 5, red after. */
export function waitLevel(ms: number): "calm" | "warn" | "late" {
  if (ms < 2 * 60000) return "calm";
  if (ms < 5 * 60000) return "warn";
  return "late";
}

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function formatClock(t: number, lang: Lang) {
  return new Date(t).toLocaleTimeString(locale(lang), { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Time today, otherwise a short date. */
export function formatListTime(t: number, now: number, lang: Lang) {
  if (startOfDay(t) === startOfDay(now)) return formatClock(t, lang);
  return new Date(t).toLocaleDateString(locale(lang), { day: "numeric", month: "short" });
}

export function dayKey(t: number) {
  return startOfDay(t);
}

export function formatDay(t: number, now: number, lang: Lang, today: string, yesterday: string) {
  const diff = Math.round((startOfDay(now) - startOfDay(t)) / 86400000);
  if (diff === 0) return today;
  if (diff === 1) return yesterday;
  return new Date(t).toLocaleDateString(locale(lang), {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: new Date(t).getFullYear() === new Date(now).getFullYear() ? undefined : "numeric",
  });
}

/** Stable hue per LINE user, so each person keeps their colour everywhere. */
export function userHue(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = Array.from(parts[0])[0] ?? "";
  const second = parts.length > 1 ? (Array.from(parts[1])[0] ?? "") : "";
  return (first + second).toUpperCase();
}

export function shortId(userId: string) {
  return `${userId.slice(0, 5)}…${userId.slice(-4)}`;
}
