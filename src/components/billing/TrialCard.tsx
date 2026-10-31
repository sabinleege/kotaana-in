"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLang, useT } from "@/lib/i18n/client";

type Trial = { active: boolean; eligible: boolean; blockedBy: "used" | "paid" | null; daysLeft: number; endsAt: string | Date | null; days: number };

/** The one free trial: offered only to someone who has never paid and never used it. Once it ends it is gone for good. */
export function TrialCard({ trial, paidActive = false }: { trial: Trial; paidActive?: boolean }) {
  const t = useT(); const lang = useLang(); const router = useRouter();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  if (paidActive) return null;
  const start = async () => {
    setBusy(true); setErr(null);
    const r = await fetch("/api/trial", { method: "POST" }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (r?.ok) router.refresh(); else setErr(d.error || t("trial.failed"));
  };
  if (trial.active) return <div className="card trialCard on"><span className="prio low">{t("trial.badgeActive")}</span><div className="trialBig">{t("trial.daysLeft", { n: trial.daysLeft })}</div><p className="small muted" style={{ margin: 0 }}>{t("trial.endsOn", { date: new Date(trial.endsAt!).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "UTC" }) })}</p></div>;
  if (trial.eligible) return <div className="card trialCard"><span className="pill orange">{t("trial.badgeOffer")}</span><div className="trialBig">{t("trial.title", { n: trial.days })}</div><p className="small muted" style={{ margin: "0 0 12px" }}>{t("trial.body", { n: trial.days })}</p><button className="btn primary" disabled={busy} onClick={start}>{busy ? "…" : t("trial.start", { n: trial.days })}</button>{err && <p className="small danger" style={{ margin: "8px 0 0" }}>{err}</p>}</div>;
  return <div className="card trialCard used"><span className="prio high">{t("trial.badgeUsed")}</span><p className="small muted" style={{ margin: "8px 0 0" }}>{trial.blockedBy === "paid" ? t("trial.paidBefore") : t("trial.usedUp")}</p></div>;
}

/** Shown in place of a feature while the person is only exploring: they can see what it does, but not use it. */
export function PreviewLock({ feature, href = "/app/settings/subscription" }: { feature: string; href?: string }) {
  const t = useT();
  return <div className="card previewLock"><div className="previewIcon">🔒</div><div><strong>{t("preview.lockedTitle", { feature })}</strong><p className="small muted" style={{ margin: "4px 0 12px" }}>{t("preview.lockedBody")}</p><Link className="btn primary" href={href}>{t("preview.cta")}</Link></div></div>;
}
