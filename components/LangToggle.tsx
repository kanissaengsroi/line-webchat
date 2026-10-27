"use client";

import { useLang } from "./LangProvider";

export function LangToggle() {
  const { lang, setLang, t } = useLang();
  return (
    <div
      role="group"
      aria-label={t("switchLang")}
      className="flex h-8 items-center rounded-md border border-rule p-0.5 font-mono text-xs"
    >
      {(["th", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
          className={`h-full rounded px-2 uppercase transition-colors ${
            lang === code ? "bg-hover text-ink" : "text-ink-3 hover:text-ink-1"
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
