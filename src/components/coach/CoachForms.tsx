"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Athlete = { id: string; name: string };

/** POST/PATCH/DELETE helper that refreshes the server-rendered page on success. */
function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (url: string, method: string, body?: unknown, okText?: string) => {
    setBusy(true); setMsg(null);
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) { setMsg({ ok: false, text: d.error || "Something went wrong — try again." }); return null; }
    setMsg({ ok: true, text: d.message || okText || "Saved." }); router.refresh(); return d;
  };
  return { busy, msg, run, setMsg };
}
const Msg = ({ m }: { m: { ok: boolean; text: string } | null }) => m ? <p className={`small ${m.ok ? "success" : "danger"}`} style={{ margin: "8px 0 0" }}>{m.text}</p> : null;

export function ActionButton({ url, method = "POST", body, label, className = "btn secondary small", confirm }: { url: string; method?: string; body?: unknown; label: string; className?: string; confirm?: string }) {
  const { busy, msg, run } = useAction();
  return <span><button className={className} disabled={busy} onClick={() => { if (!confirm || window.confirm(confirm)) run(url, method, body); }}>{busy ? "…" : label}</button>{msg && !msg.ok && <Msg m={msg} />}</span>;
}

export function NoteForm({ athleteId }: { athleteId: string }) {
  const { busy, msg, run } = useAction(); const [content, setContent] = useState(""); const [share, setShare] = useState(false);
  return <div className="stack" style={{ gap: 8 }}>
    <textarea className="textarea" rows={4} placeholder="Observations, plan adjustments, recognition…" value={content} onChange={(e) => setContent(e.target.value)} />
    <div className="row spread" style={{ flexWrap: "wrap" }}>
      <label className="check"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /> Visible to athlete (they get a notification)</label>
      <button className="btn primary" disabled={busy || !content.trim()} onClick={async () => { if (await run("/api/coach/notes", "POST", { athleteId, content, visibleToAthlete: share }, "Note saved.")) { setContent(""); setShare(false); } }}>Save note</button>
    </div><Msg m={msg} />
  </div>;
}

export function FollowUpForm({ athletes, athleteId }: { athletes?: Athlete[]; athleteId?: string }) {
  const { busy, msg, run } = useAction();
  const blank = { athleteId: athleteId || "", title: "", description: "", dueDate: "", priority: "normal", notifyAthlete: true };
  const [f, setF] = useState(blank);
  return <div className="stack" style={{ gap: 10 }}>
    <div className="formGrid">
      {!athleteId && <div><label className="label">Athlete</label><select className="select" value={f.athleteId} onChange={(e) => setF({ ...f, athleteId: e.target.value })}><option value="">Choose athlete…</option>{athletes?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>}
      <div><label className="label">Title</label><input className="input" placeholder="e.g. Check knee after session" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      <div><label className="label">Due date</label><input className="input" type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></div>
      <div><label className="label">Priority</label><select className="select" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></div>
    </div>
    <textarea className="textarea" rows={3} placeholder="Details (optional)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
    <div className="row spread" style={{ flexWrap: "wrap" }}>
      <label className="check"><input type="checkbox" checked={f.notifyAthlete} onChange={(e) => setF({ ...f, notifyAthlete: e.target.checked })} /> Notify the athlete</label>
      <button className="btn primary" disabled={busy || !f.athleteId || f.title.trim().length < 2} onClick={async () => { if (await run("/api/coach/follow-ups", "POST", { ...f, dueDate: f.dueDate || null, description: f.description || null }, "Follow-up created.")) setF(blank); }}>Create follow-up</button>
    </div><Msg m={msg} />
  </div>;
}

export function InjuryForm({ athleteId }: { athleteId: string }) {
  const { busy, msg, run } = useAction();
  const blank = { bodyPart: "", injuryType: "", severity: 3, restrictions: "", expectedReturn: "" };
  const [f, setF] = useState(blank);
  return <div className="stack" style={{ gap: 10 }}>
    <div className="formGrid">
      <div><label className="label">Body part</label><input className="input" placeholder="e.g. left knee" value={f.bodyPart} onChange={(e) => setF({ ...f, bodyPart: e.target.value })} /></div>
      <div><label className="label">Injury / condition</label><input className="input" placeholder="e.g. sprain" value={f.injuryType} onChange={(e) => setF({ ...f, injuryType: e.target.value })} /></div>
      <div><label className="label">Severity (1–5)</label><select className="select" value={f.severity} onChange={(e) => setF({ ...f, severity: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
      <div><label className="label">Expected return</label><input className="input" type="date" value={f.expectedReturn} onChange={(e) => setF({ ...f, expectedReturn: e.target.value })} /></div>
    </div>
    <input className="input" placeholder="Restrictions (e.g. no jumping, no running)" value={f.restrictions} onChange={(e) => setF({ ...f, restrictions: e.target.value })} />
    <div><button className="btn primary" disabled={busy || f.bodyPart.trim().length < 2 || f.injuryType.trim().length < 2} onClick={async () => { if (await run("/api/coach/injuries", "POST", { athleteId, ...f, restrictions: f.restrictions || null, expectedReturn: f.expectedReturn || null }, "Injury recorded — their workouts will now avoid it.")) setF(blank); }}>Log injury</button></div>
    <Msg m={msg} />
  </div>;
}

export function InjuryStatus({ id, status }: { id: string; status: string }) {
  const { busy, msg, run } = useAction();
  return <span><select className="select" style={{ width: "auto", padding: "6px 10px" }} disabled={busy} value={status} onChange={(e) => run("/api/coach/injuries", "PATCH", { id, status: e.target.value }, "Updated.")}><option value="active">Active</option><option value="recovering">Recovering</option><option value="resolved">Resolved</option></select>{msg && !msg.ok && <Msg m={msg} />}</span>;
}

export function SessionForm({ athletes }: { athletes: Athlete[] }) {
  const { busy, msg, run } = useAction();
  const blank = { title: "", scheduledAt: "", durationMinutes: 60, location: "", sessionType: "training", athleteIds: [] as string[], notes: "" };
  const [f, setF] = useState(blank);
  return <div className="stack" style={{ gap: 10 }}>
    <div className="formGrid">
      <div><label className="label">Title</label><input className="input" placeholder="e.g. Speed & agility" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      <div><label className="label">Date & time</label><input className="input" type="datetime-local" value={f.scheduledAt} onChange={(e) => setF({ ...f, scheduledAt: e.target.value })} /></div>
      <div><label className="label">Duration (min)</label><input className="input" type="number" min={10} max={600} value={f.durationMinutes} onChange={(e) => setF({ ...f, durationMinutes: Number(e.target.value) })} /></div>
      <div><label className="label">Type</label><select className="select" value={f.sessionType} onChange={(e) => setF({ ...f, sessionType: e.target.value })}>{["training", "assessment", "recovery", "match", "other"].map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}</select></div>
      <div><label className="label">Location</label><input className="input" placeholder="e.g. Amahoro Stadium" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
    </div>
    <div><label className="label">Athletes ({f.athleteIds.length} selected — they get a notification)</label><div className="checkboxRow">{athletes.map((a) => <label className="check" key={a.id}><input type="checkbox" checked={f.athleteIds.includes(a.id)} onChange={(e) => setF({ ...f, athleteIds: e.target.checked ? [...f.athleteIds, a.id] : f.athleteIds.filter((x) => x !== a.id) })} /> {a.name}</label>)}{!athletes.length && <span className="small muted">No active athletes yet.</span>}</div></div>
    <textarea className="textarea" rows={2} placeholder="Notes (optional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
    <div><button className="btn primary" disabled={busy || f.title.trim().length < 2 || !f.scheduledAt} onClick={async () => { if (await run("/api/coach/sessions", "POST", { ...f, scheduledAt: new Date(f.scheduledAt).toISOString(), location: f.location || null, notes: f.notes || null }, "Session scheduled.")) setF(blank); }}>Schedule session</button></div>
    <Msg m={msg} />
  </div>;
}

export function InviteForm() {
  const { busy, msg, run } = useAction(); const [email, setEmail] = useState("");
  return <div className="stack" style={{ gap: 8 }}>
    <div className="row" style={{ flexWrap: "wrap" }}><input className="input" style={{ flex: "1 1 240px" }} type="email" placeholder="Athlete email (optional — leave empty for an open code)" value={email} onChange={(e) => setEmail(e.target.value)} /><button className="btn primary" disabled={busy} onClick={async () => { if (await run("/api/coach/invites", "POST", { email: email || null }, "Invite created — share the code or link below.")) setEmail(""); }}>New invite</button></div>
    <Msg m={msg} />
  </div>;
}

export function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const full = text.startsWith("/") && typeof window !== "undefined" ? window.location.origin + text : text;
  return <button className="btn secondary small" onClick={async () => { try { await navigator.clipboard.writeText(full); setDone(true); setTimeout(() => setDone(false), 1500); } catch { window.prompt("Copy this:", full); } }}>{done ? "✓ Copied" : label}</button>;
}

export function ConnectForm() {
  const { busy, msg, run } = useAction(); const [email, setEmail] = useState("");
  return <div className="stack" style={{ gap: 8 }}>
    <div className="row" style={{ flexWrap: "wrap" }}><input className="input" style={{ flex: "1 1 240px" }} type="email" placeholder="athlete@email.com" value={email} onChange={(e) => setEmail(e.target.value)} /><button className="btn primary" disabled={busy || !email.includes("@")} onClick={async () => { if (await run("/api/coach/connect", "POST", { email })) setEmail(""); }}>Send request</button></div>
    <Msg m={msg} />
  </div>;
}

export function CoachNameForm({ initial }: { initial: string }) {
  const { busy, msg, run } = useAction(); const [name, setName] = useState(initial);
  return <div className="stack" style={{ gap: 8 }}><label className="label" style={{ margin: 0 }}>Coach / gym name (shown to athletes)</label><div className="row" style={{ flexWrap: "wrap" }}><input className="input" style={{ flex: "1 1 240px" }} value={name} onChange={(e) => setName(e.target.value)} /><button className="btn primary" disabled={busy || name.trim().length < 2} onClick={() => run("/api/profile", "PATCH", { fullName: name.trim() }, "Name saved.")}>Save</button></div><Msg m={msg} /></div>;
}

export function CsvButton({ rows, filename }: { rows: (string | number | null)[][]; filename: string }) {
  const download = () => {
    // Quote every cell and neutralise leading = + - @ so spreadsheet apps don't evaluate athlete-entered text as formulas.
    const cell = (v: string | number | null) => { const s = v == null ? "" : String(v); return `"${(/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`; };
    const blob = new Blob([rows.map((r) => r.map(cell).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
  };
  return <button className="btn primary" onClick={download}>⬇ Export CSV</button>;
}

export function PlatformPayForm({ defaultAmount = 20000 }: { defaultAmount?: number }) {
  const { busy, msg, run } = useAction(); const [f, setF] = useState({ amount: defaultAmount, number: "", name: "" });
  return <div className="stack" style={{ gap: 10 }}>
    <div className="formGrid">
      <div><label className="label">Amount (RWF)</label><input className="input" type="number" min={100} value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></div>
      <div><label className="label">Your MoMo number</label><input className="input" placeholder="07XXXXXXXX" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></div>
      <div><label className="label">MoMo account name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
    </div>
    <div><button className="btn primary" disabled={busy || f.number.length < 7 || f.name.trim().length < 2 || f.amount < 100} onClick={() => run("/api/payments/momo", "POST", { amount: f.amount, payerNumber: f.number, payerName: f.name.trim(), planType: "coach_plan", idempotencyKey: crypto.randomUUID() }, "Payment request recorded.")}>Submit payment</button></div>
    <Msg m={msg} />
  </div>;
}
