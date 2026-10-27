"use client";

// The LIFF SDK keeps the LINE login in localStorage under "LIFF_STORE:<liffId>:…".
const LIFF_PREFIX = "LIFF_STORE:";

/**
 * Signs out of the webchat and of LINE in this browser: the LIFF token is revoked at LINE and its
 * local copy removed, so the next "Log in with LINE" has to ask LINE again.
 */
export async function signOut() {
  let lineAccessToken: string | null = null;
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(LIFF_PREFIX)) continue;
      if (key.endsWith(":accessToken")) lineAccessToken = localStorage.getItem(key);
      localStorage.removeItem(key);
    }
  } catch {
    // Storage blocked (private mode etc.): nothing saved to clear.
  }
  await fetch("/api/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lineAccessToken }),
  }).catch(() => {});
  window.location.assign("/login");
}
