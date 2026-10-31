"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LANGS, LANG_LABEL, type Lang } from "@/lib/i18n/dict";
import { useLang } from "@/lib/i18n/client";

/** English / Français switch. Saving refreshes the page so server-rendered text changes too. */
export default function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const lang = useLang(); const router = useRouter(); const [busy, setBusy] = useState(false);
  const pick = async (v: Lang) => {
    if (v === lang) return;
    setBusy(true);
    await fetch("/api/language", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang: v }) }).catch(() => null);
    setBusy(false); router.refresh();
  };
  return <div className={`langPicker${compact ? " compact" : ""}`} role="group" aria-label="Language">{LANGS.map((v) => <button key={v} type="button" disabled={busy} className={v === lang ? "on" : ""} aria-pressed={v === lang} onClick={() => pick(v)}>{compact ? v.toUpperCase() : LANG_LABEL[v]}</button>)}</div>;
}
