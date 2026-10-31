"use client";
import { createContext, useCallback, useContext } from "react";
import { translate, type Key, type Lang } from "./dict";

const LangContext = createContext<Lang>("en");

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}
export function useLang() { return useContext(LangContext); }
export function useT() {
  const lang = useContext(LangContext);
  return useCallback((key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
}
