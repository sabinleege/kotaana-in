"use client";
import { useEffect, useState } from "react";
import { ACTIVITY_OPTIONS, ALCOHOL_OPTIONS, CHRONIC_CONDITIONS, SMOKING_OPTIONS } from "@/lib/health/conditions";

export default function HealthScreen() {
  const [check, setCheck] = useState<any>({ energy: 3, soreness: 1, mood: 3, feeling: "ok", sleepHours: 8 });
  const [injuries, setInjuries] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ bodyPart: "", injuryType: "", severity: 2, status: "active", restrictions: "", notes: "" });
  const [profile, setProfile] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [doc, setDoc] = useState<File | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [injuryStatus, setInjuryStatus] = useState<"unknown" | "known">("unknown");

  async function load() {
    const [c, i, p] = await Promise.all([
      fetch("/api/health/checkin").then((r) => r.json()),
      fetch("/api/health/injury").then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
    ]);
    if (c.checkin) setCheck(c.checkin);
    setInjuries(i.injuries || []);
    setProfile(p.profile);
    setInjuryStatus(p.profile?.injuryDataStatus === "known" ? "known" : "unknown");
    const docs = await fetch("/api/health/document").then((r) => r.ok ? r.json() : { documents: [] });
    setDocuments(docs.documents || []);
  }
  useEffect(() => { void load(); }, []);

  async function saveCheck() {
    const r = await fetch("/api/health/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(check) });
    const d = await r.json(); setMsg(r.ok ? "Readiness saved." : d.error); void load();
  }
  async function addInjury() {
    const r = await fetch("/api/health/injury", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await r.json(); setMsg(r.ok ? "Health restriction saved." : d.error);
    if (r.ok) { setForm({ bodyPart: "", injuryType: "", severity: 2, status: "active", restrictions: "", notes: "" }); void load(); }
  }
  async function uploadDocument() {
    if (!doc) { setMsg("Choose a document."); return; }
    if (doc.size > 2_000_000) { setMsg("Document must be under 2 MB."); return; }
    const data = await new Promise<string>((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(String(fr.result)); fr.onerror = reject; fr.readAsDataURL(doc); });
    const r = await fetch("/api/health/document", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docType: "medical", title: doc.name, fileUrl: data }) });
    const d = await r.json(); setMsg(r.ok ? "Health document saved." : d.error); if (r.ok) { setDoc(null); void load(); }
  }

  const conditions: string[] = Array.isArray(profile?.healthConditions) ? profile.healthConditions : [];

  async function saveHealth() {
    const r = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      healthConditions: conditions, chronicDiseases: profile.chronicDiseases || null, medications: profile.medications || null, pastSurgeries: profile.pastSurgeries || null,
      painAreas: profile.painAreas || null, otherLimitations: profile.otherLimitations || null, heartRate: profile.heartRate ?? null,
      smokingStatus: profile.smokingStatus || null, alcoholUse: profile.alcoholUse || null, stressLevel: profile.stressLevel ?? null, profession: profile.profession || null,
      isPregnant: Boolean(profile.isPregnant), pregnancyDueDate: profile.isPregnant && profile.pregnancyDueDate ? String(profile.pregnancyDueDate).slice(0, 10) : null,
      injuryDataStatus: injuryStatus,
    }) });
    const d = await r.json(); setMsg(r.ok ? "Health profile saved. Your next workout and meal plan will use it." : d.error);
    if (r.ok) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return <div className="stack">
    <div><span className="pill orange">HEALTH</span><h1 style={{ fontSize: 28, margin: "9px 0 4px" }}>Health & recovery</h1><p className="subtitle">Health data stays here and directly informs safe workout generation.</p></div>
    {msg && <div className="card small">{msg}</div>}
    <div className="card">
      <h2 className="sectionTitle">Daily readiness</h2>
      <div className="grid grid2" style={{ marginTop: 12 }}>
        <Field label="Energy 1–5" value={check.energy} set={(v) => setCheck({ ...check, energy: v })} />
        <Field label="Soreness 1–5" value={check.soreness} set={(v) => setCheck({ ...check, soreness: v })} />
        <Field label="Mood 1–5" value={check.mood} set={(v) => setCheck({ ...check, mood: v })} />
        <div><label className="label">Sleep hours</label><input className="input" type="number" min="0" max="24" step="0.5" value={check.sleepHours ?? 8} onChange={(e) => setCheck({ ...check, sleepHours: Number(e.target.value) })} /></div>
      </div>
      <button className="btn primary" style={{ marginTop: 12 }} onClick={saveCheck}>Save readiness</button>
    </div>
    <div className="card">
      <h2 className="sectionTitle">Injuries & limitations</h2>
      <p className="subtitle">Recorded restrictions are hard filters. Missing information is handled conservatively by the workout engine.</p><div style={{marginTop:12}}><label className="label">Injury information status</label><select className="select" value={injuryStatus} onChange={(e)=>setInjuryStatus(e.target.value as "unknown"|"known")}><option value="unknown">Not fully provided — treat as unknown</option><option value="known">I have reviewed and provided my current restrictions</option></select><p className="small muted" style={{marginTop:6}}>Kotaana never assumes missing injury information means no injury.</p></div>
      <div className="grid grid2" style={{ marginTop: 12 }}>
        <input className="input" placeholder="Body part" value={form.bodyPart} onChange={(e) => setForm({ ...form, bodyPart: e.target.value })}/>
        <input className="input" placeholder="Injury / condition" value={form.injuryType} onChange={(e) => setForm({ ...form, injuryType: e.target.value })}/>
        <input className="input" type="number" min="1" max="5" placeholder="Severity" value={form.severity} onChange={(e) => setForm({ ...form, severity: Number(e.target.value) })}/>
        <input className="input" placeholder="Restrictions (e.g. no jumping)" value={form.restrictions} onChange={(e) => setForm({ ...form, restrictions: e.target.value })}/>
      </div>
      <button className="btn primary" style={{ marginTop: 12 }} onClick={addInjury}>Add restriction</button>
      <div className="list" style={{ marginTop: 14 }}>
        {injuries.map((i) => <div className="item" key={i.id}><div><strong>{i.bodyPart} · {i.injuryType}</strong><div className="small muted">Severity {i.severity}/5 · {i.status}{i.restrictions ? ` · ${i.restrictions}` : ""}</div></div></div>)}
        {!injuries.length && <div className="empty">No recorded restrictions.</div>}
      </div>
    </div>
    {profile && <div className="card">
      <h2 className="sectionTitle">Health profile</h2>
      <p className="subtitle">The more you share, the more your workouts and meals are adjusted to you. Everything is optional and private to your account.</p>
      <label className="label" style={{ marginTop: 14 }}>Chronic conditions</label>
      <div className="checkboxRow">
        {CHRONIC_CONDITIONS.map((c) => <label className="check" key={c.id}><input type="checkbox" checked={conditions.includes(c.id)} onChange={(e) => setProfile({ ...profile, healthConditions: e.target.checked ? [...conditions, c.id] : conditions.filter((x) => x !== c.id) })}/> {c.label}</label>)}
      </div>
      <div className="grid grid2" style={{ marginTop: 12 }}>
        <Text label="Other conditions not listed" value={profile.chronicDiseases} set={(v) => setProfile({ ...profile, chronicDiseases: v })} placeholder="e.g. thyroid disorder, anaemia"/>
        <Text label="Medications you take" value={profile.medications} set={(v) => setProfile({ ...profile, medications: v })} placeholder="e.g. metformin, beta-blocker, inhaler"/>
        <Text label="Past surgeries" value={profile.pastSurgeries} set={(v) => setProfile({ ...profile, pastSurgeries: v })} placeholder="e.g. knee ACL repair 2022"/>
        <Text label="Pain areas" value={profile.painAreas} set={(v) => setProfile({ ...profile, painAreas: v })} placeholder="e.g. right knee when climbing stairs"/>
        <Text label="Other limitations" value={profile.otherLimitations} set={(v) => setProfile({ ...profile, otherLimitations: v })} placeholder="e.g. no jumping, no running"/>
        <div><label className="label">Resting heart rate (bpm)</label><input className="input" type="number" min="30" max="220" placeholder="e.g. 68" value={profile.heartRate ?? ""} onChange={(e) => setProfile({ ...profile, heartRate: e.target.value ? Number(e.target.value) : null })}/></div>
        <Choice label="Smoking" value={profile.smokingStatus} options={SMOKING_OPTIONS} set={(v) => setProfile({ ...profile, smokingStatus: v })}/>
        <Choice label="Alcohol" value={profile.alcoholUse} options={ALCOHOL_OPTIONS} set={(v) => setProfile({ ...profile, alcoholUse: v })}/>
        <Choice label="Usual stress level" value={profile.stressLevel == null ? "" : String(profile.stressLevel)} options={[["1", "1 — very low"], ["2", "2 — low"], ["3", "3 — moderate"], ["4", "4 — high"], ["5", "5 — very high"]]} set={(v) => setProfile({ ...profile, stressLevel: v ? Number(v) : null })}/>
        <Choice label="Daily activity at work" value={profile.profession} options={ACTIVITY_OPTIONS} set={(v) => setProfile({ ...profile, profession: v })}/>
      </div>
      <div className="stack" style={{ marginTop: 12, gap: 8 }}>
        <label className="check"><input type="checkbox" checked={Boolean(profile.isPregnant)} onChange={(e) => setProfile({ ...profile, isPregnant: e.target.checked })}/> I am currently pregnant</label>
        {profile.isPregnant && <div style={{ maxWidth: 260 }}><label className="label">Due date</label><input className="input" type="date" value={profile.pregnancyDueDate ? String(profile.pregnancyDueDate).slice(0, 10) : ""} onChange={(e) => setProfile({ ...profile, pregnancyDueDate: e.target.value || null })}/></div>}
      </div>
      <button className="btn primary" style={{ marginTop: 14 }} onClick={saveHealth}>Save health profile</button>
    </div>}
    <div className="card"><h2 className="sectionTitle">Health documents</h2><p className="subtitle">Keep medical or lab documents inside Health; they are not exposed as a separate navigation page.</p><input style={{marginTop:12}} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setDoc(e.target.files?.[0] || null)} /><button className="btn secondary" style={{marginTop:10}} onClick={uploadDocument}>Save document</button><div className="list" style={{marginTop:12}}>{documents.map((d:any)=><div className="item" key={d.id}><span>{d.title || d.docType}</span><span className="small muted">{String(d.createdAt).slice(0,10)}</span></div>)}{!documents.length&&<div className="empty">No health documents saved.</div>}</div></div><div className="card"><strong>Health safety boundary</strong><p className="small muted">Kotaana uses recorded restrictions to remove exercises from its verified library. It does not diagnose conditions or replace professional medical care.</p></div>
  </div>;
}
function Field({label,value,set}:{label:string;value:number;set:(v:number)=>void}){return <div><label className="label">{label}</label><select className="select" value={value} onChange={(e)=>set(Number(e.target.value))}>{[1,2,3,4,5].map(n=><option key={n}>{n}</option>)}</select></div>}
function Text({label,value,set,placeholder}:{label:string;value:string|null|undefined;set:(v:string)=>void;placeholder?:string}){return <div><label className="label">{label}</label><textarea className="textarea" style={{minHeight:70}} placeholder={placeholder} value={value||""} onChange={(e)=>set(e.target.value)}/></div>}
function Choice({label,value,options,set}:{label:string;value:string|null|undefined;options:readonly (readonly [string,string])[];set:(v:string|null)=>void}){return <div><label className="label">{label}</label><select className="select" value={value||""} onChange={(e)=>set(e.target.value||null)}><option value="">Prefer not to say</option>{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>}
