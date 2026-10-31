"use client";
import { useState } from "react";
import { COMPLICATIONS, SYMPTOMS, pregnancyExtras, pregnancyStatus, weightGainRange, type PregnancyDetails } from "@/lib/health/pregnancy";
import { useLang, useT } from "@/lib/i18n/client";

type Profile = { gender?: string | null; height?: number | null; weight?: number | null; isPregnant?: boolean; pregnancyDueDate?: string | null; pregnancyDetails?: PregnancyDetails | null };
const day = (v?: string | null) => (v ? String(v).slice(0, 10) : "");
const num = (v: string) => (v === "" ? null : Number(v));

/** Pregnancy at the top of Health: the dating method (due date, last period or scan) so the week is exact, the pre-pregnancy weight for the
 * healthy gain range, twins, the doctor's clearance, complications and symptoms. Workouts, calories and reviews all read these answers. */
export default function PregnancyCard({ profile, onSaved }: { profile: Profile; onSaved?: () => void }) {
  const t = useT(); const lang = useLang();
  const [on, setOn] = useState(Boolean(profile.isPregnant));
  const [due, setDue] = useState(day(profile.pregnancyDueDate));
  const [d, setD] = useState<PregnancyDetails>({ method: "due", complications: [], symptoms: [], ...(profile.pregnancyDetails ?? {}) });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<PregnancyDetails>) => setD({ ...d, ...patch });
  const toggle = (k: "complications" | "symptoms", v: string) => { const cur = d[k] ?? []; const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur.filter((x) => (v === "none" ? false : x !== "none")), v]; set({ [k]: next }); };

  const info = on ? pregnancyStatus(true, due ? new Date(`${due}T00:00:00Z`) : null, d) : null;
  const gain = weightGainRange(d.prePregWeightKg, profile.height, d.multiple);
  const extra = pregnancyExtras(info);
  const save = async () => {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPregnant: on, pregnancyDueDate: on && d.method === "due" && due ? due : on ? info?.dueDate ?? null : null, pregnancyDetails: on ? d : null }) }).catch(() => null);
    const out = r ? await r.json().catch(() => ({})) : {};
    setBusy(false); setMsg(r?.ok ? { ok: true, text: t("common.saved") } : { ok: false, text: out.error || "Could not save." });
    if (r?.ok) onSaved?.();
  };

  return <div className="card pregCard">
    <div className="row spread" style={{ alignItems: "flex-start" }}><div><h2 className="sectionTitle">🤰 {t("preg.title")}</h2><p className="small muted" style={{ margin: "4px 0 0" }}>{t("preg.sub")}</p></div></div>
    <label className="check" style={{ marginTop: 12, display: "inline-flex", gap: 8 }}><input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} /> {t("preg.am")}</label>
    {on && <div className="stack" style={{ marginTop: 12, gap: 12 }}>
      {info?.week ? <div className="pregStatus"><div><div className="pregWeek">{t("preg.week", { w: `${info.week}+${info.day}`, t: info.trimester ?? "" })}</div><div className="small muted">{t("preg.due", { date: new Date(`${info.dueDate}T00:00:00Z`).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "UTC" }) })}</div></div><div className="pregBar"><div style={{ width: `${Math.min(100, ((info.week * 7 + (info.day ?? 0)) / 280) * 100)}%` }} /></div></div> : <p className="small" style={{ margin: 0, color: "var(--orange2)" }}>{t("preg.missingDate")}</p>}
      <div><label className="label">{t("preg.method")}</label><div className="segRow">{(["due", "lmp", "scan"] as const).map((m) => <button type="button" key={m} className={`segBtn${d.method === m ? " on" : ""}`} onClick={() => set({ method: m })}>{t(`preg.m.${m}`)}</button>)}</div></div>
      {d.method === "due" && <div style={{ maxWidth: 260 }}><label className="label">{t("preg.dueDate")}</label><input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>}
      {d.method === "lmp" && <div className="grid grid2"><div><label className="label">{t("preg.lmp")}</label><input className="input" type="date" value={d.lmp ?? ""} onChange={(e) => set({ lmp: e.target.value || null })} /></div><div><label className="label">{t("preg.cycle")}</label><input className="input" type="number" min={20} max={45} value={d.cycleDays ?? 28} onChange={(e) => set({ cycleDays: num(e.target.value) })} /></div></div>}
      {d.method === "scan" && <div className="grid grid3"><div><label className="label">{t("preg.scanDate")}</label><input className="input" type="date" value={d.scanDate ?? ""} onChange={(e) => set({ scanDate: e.target.value || null })} /></div><div><label className="label">{t("preg.scanWeeks")}</label><input className="input" type="number" min={4} max={42} value={d.scanWeeks ?? ""} onChange={(e) => set({ scanWeeks: num(e.target.value) })} /></div><div><label className="label">{t("preg.scanDays")}</label><input className="input" type="number" min={0} max={6} value={d.scanDays ?? 0} onChange={(e) => set({ scanDays: num(e.target.value) })} /></div></div>}
      <div className="grid grid2"><div><label className="label">{t("preg.prePregWeight")}</label><input className="input" type="number" min={30} max={300} step="0.1" value={d.prePregWeightKg ?? ""} onChange={(e) => set({ prePregWeightKg: num(e.target.value) })} /></div><div style={{ display: "flex", alignItems: "flex-end" }}><label className="check"><input type="checkbox" checked={Boolean(d.multiple)} onChange={(e) => set({ multiple: e.target.checked })} /> {t("preg.multiple")}</label></div></div>
      {(gain || extra.kcal > 0) && <div className="chipGrid">{gain && <div className="chip"><span className="muted">{t("preg.gain", { min: gain.min, max: gain.max })}</span>{d.prePregWeightKg && profile.weight ? <strong>{t("preg.gainSoFar", { kg: Math.round((profile.weight - d.prePregWeightKg) * 10) / 10 })}</strong> : null}</div>}{extra.kcal > 0 && <div className="chip"><strong>{t("preg.kcal", { kcal: extra.kcal })}</strong></div>}</div>}
      <div><label className="label">{t("preg.cleared")}</label><div className="segRow">{([[true, "✓"], [false, "✗"], [null, "?"]] as const).map(([v, l]) => <button type="button" key={String(v)} className={`segBtn${(d.doctorCleared ?? null) === v ? " on" : ""}`} onClick={() => set({ doctorCleared: v })}>{l} {v === true ? "Yes" : v === false ? "No" : "Not asked yet"}</button>)}</div>{d.doctorCleared === false && <p className="small muted" style={{ margin: "6px 0 0" }}>{t("preg.notCleared")}</p>}</div>
      <div><label className="label">{t("preg.complications")}</label><div className="checkboxRow">{COMPLICATIONS.map(([k, l]) => <label className="check" key={k}><input type="checkbox" checked={(d.complications ?? []).includes(k)} onChange={() => toggle("complications", k)} /> {l}</label>)}</div></div>
      <div><label className="label">{t("preg.symptoms")}</label><div className="checkboxRow">{SYMPTOMS.map(([k, l]) => <label className="check" key={k}><input type="checkbox" checked={(d.symptoms ?? []).includes(k)} onChange={() => toggle("symptoms", k)} /> {l}</label>)}</div></div>
      <div className="pregWarn">⚠ {t("preg.warn")}</div>
    </div>}
    <div className="row" style={{ marginTop: 12 }}><button className="btn primary" disabled={busy} onClick={save}>{busy ? "…" : t("preg.save")}</button>{msg && <span className={`small ${msg.ok ? "success" : "danger"}`}>{msg.text}</span>}</div>
  </div>;
}
