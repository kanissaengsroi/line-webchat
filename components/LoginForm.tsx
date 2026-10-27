"use client";

import { useState } from "react";
import { ArrowRight, LoaderCircle, MessageCircle } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { LangToggle } from "./LangToggle";
import { useLang } from "./LangProvider";
import type { TKey } from "@/lib/i18n";

const USERNAME_PATTERN = /^[\p{L}\p{M}\p{N}._-]{2,32}$/u;
const LINE_ERRORS = ["line_cancelled", "line_failed", "line_not_configured"] as const;

type Tab = "customer" | "staff";

export function LoginForm({ lineEnabled, error: initialError }: { lineEnabled: boolean; error?: string }) {
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>("customer");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(
    (LINE_ERRORS as readonly string[]).includes(initialError ?? "") ? t(initialError as TKey) : null,
  );
  const [busy, setBusy] = useState<"line" | "name" | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = username.trim();
    if (!USERNAME_PATTERN.test(name)) {
      setError(t("usernameInvalid"));
      return;
    }
    setBusy("name");
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name, as: tab }),
      });
      const data = (await res.json().catch(() => ({}))) as { role?: string; error?: string };
      if (!res.ok) {
        setError(data.error === "not_staff" ? t("notStaff") : t("usernameInvalid"));
        setBusy(null);
        return;
      }
      window.location.assign(data.role === "agent" ? "/" : "/chat");
    } catch {
      setError(t("networkError"));
      setBusy(null);
    }
  }

  function switchTab(next: Tab) {
    setTab(next);
    setError(null);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2 text-ink-1">
          <BrandMark className="size-5 text-go" />
          <span className="font-semibold">{t("appName")}</span>
        </div>
        <LangToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <div role="tablist" aria-label={t("appName")} className="mb-8 flex border-b border-rule">
            {(["customer", "staff"] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => switchTab(key)}
                className={`-mb-px border-b-2 px-1 pb-2.5 font-medium transition-colors not-first:ml-6 ${
                  tab === key ? "border-go text-ink" : "border-transparent text-ink-3 hover:text-ink-1"
                }`}
              >
                {t(key === "customer" ? "tabCustomer" : "tabStaff")}
              </button>
            ))}
          </div>

          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">
            {t(tab === "customer" ? "customerTitle" : "staffTitle")}
          </h1>
          <p className="mt-2 text-ink-2">{t(tab === "customer" ? "customerLead" : "staffLead")}</p>

          {tab === "customer" && lineEnabled && (
            <>
              <a
                href="/api/auth/line"
                onClick={() => setBusy("line")}
                className="mt-8 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-go font-semibold text-on-go transition-colors hover:bg-go-hover"
              >
                {busy === "line" ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                ) : (
                  <MessageCircle className="size-4" aria-hidden />
                )}
                {t("loginWithLine")}
              </a>
              <div className="my-6 flex items-center gap-3 text-xs text-ink-3">
                <span className="h-px flex-1 bg-rule" />
                {t("orUsername")}
                <span className="h-px flex-1 bg-rule" />
              </div>
            </>
          )}

          <form onSubmit={submit} noValidate className={tab === "customer" && lineEnabled ? "" : "mt-8"}>
            <label htmlFor="username" className="block font-medium text-ink-1">
              {t("usernameLabel")}
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              spellCheck={false}
              maxLength={32}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError(null);
              }}
              aria-invalid={!!error}
              aria-describedby="username-help"
              className={`mt-2 h-11 w-full rounded-lg border bg-panel px-3 text-[15px] text-ink placeholder:text-ink-3 transition-colors focus:outline-none focus-visible:outline-none ${
                error ? "border-red" : "border-rule-strong focus:border-go"
              }`}
            />
            <p
              id="username-help"
              role={error ? "alert" : undefined}
              className={`mt-2 text-[13px] ${error ? "text-red" : "text-ink-3"}`}
            >
              {error ?? t(tab === "customer" ? "guestHint" : "staffHint")}
            </p>

            <button
              type="submit"
              disabled={busy !== null}
              className={`mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-70 ${
                tab === "customer" && lineEnabled
                  ? "border border-rule-strong text-ink hover:bg-raised"
                  : "bg-go text-on-go hover:bg-go-hover"
              }`}
            >
              {busy === "name" ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  {t("loginBusy")}
                </>
              ) : (
                <>
                  {t(tab === "customer" ? "startChat" : "loginSubmit")}
                  <ArrowRight className="size-4" aria-hidden />
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
