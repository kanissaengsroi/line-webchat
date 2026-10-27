"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { LangToggle } from "@/components/LangToggle";
import { useLang } from "@/components/LangProvider";

const USERNAME_PATTERN = /^[\p{L}\p{M}\p{N}._-]{2,32}$/u;

export default function LoginPage() {
  const { t } = useLang();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = username.trim();
    if (!USERNAME_PATTERN.test(name)) {
      setError(t("usernameInvalid"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name }),
      });
      if (!res.ok) {
        setError(t("usernameInvalid"));
        setBusy(false);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError(t("networkError"));
      setBusy(false);
    }
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
        <form onSubmit={submit} noValidate className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">{t("loginTitle")}</h1>
          <p className="mt-2 text-ink-2">{t("loginLead")}</p>

          <label htmlFor="username" className="mt-8 block font-medium text-ink-1">
            {t("usernameLabel")}
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            autoFocus
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
            {error ?? t("usernameHint")}
          </p>

          <button
            type="submit"
            disabled={busy}
            className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-go font-semibold text-on-go transition-colors hover:bg-go-hover disabled:opacity-70"
          >
            {busy ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                {t("loginBusy")}
              </>
            ) : (
              <>
                {t("loginSubmit")}
                <ArrowRight className="size-4" aria-hidden />
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
