"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { LANG_COOKIE, translate, type Lang, type TKey } from "@/lib/i18n";

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const t = useCallback(
    (key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  );

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside LangProvider");
  return ctx;
}
