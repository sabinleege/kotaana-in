"use client";
import { useEffect, useState } from "react";
import { Panel } from "./admin/AdminUI";

type ConfigItem = { label: string; needed: string; ok: boolean; missing: string[] };

/** Admin settings: access rules (paywall and the one-time free trial), the platform MoMo code, and which server settings are in place. */
export default function AdminScreen() {
  const [cfg, setCfg] = useState<ConfigItem[] | null>(null);
  const [pw, setPw] = useState({ enabled: true, trialDays: 7 });
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  useEffect(() => {
    fetch("/api/admin/config").then((r) => (r.ok ? r.json() : { items: [] })).then((d) => { setCfg(d.items || []); if (d.paywall) setPw(d.paywall); }).catch(() => setCfg([]));
    fetch("/api/owner/platform-momo").then((r) => r.json()).then((b) => setCode(b.code || "")).catch(() => {});
  }, []);
  const note = (k: string, ok: boolean, text: string) => setMsg((m) => ({ ...m, [k]: { ok, text } }));
  const savePw = async () => { const r = await fetch("/api/admin/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "paywall", enabled: pw.enabled, trialDays: pw.trialDays }) }); note("pw", r.ok, r.ok ? "Access rules saved." : "Could not save access rules."); };
  const saveCode = async () => { const r = await fetch("/api/owner/platform-momo", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }); note("code", r.ok, r.ok ? "Platform MoMo saved." : (await r.json().catch(() => ({}))).error || "Could not save."); };
  const Msg = ({ k }: { k: string }) => (msg[k] ? <span className={`admMsg ${msg[k].ok ? "ok" : "bad"}`}>{msg[k].text}</span> : null);

  return <div className="admGrid2 wide">
    <Panel title="Access rules" sub="Without a subscription people can sign in and look around, but not use plans. Each person may start one free trial, once, from Settings — never again, and never after paying.">
      <div className="admForm">
        <label className="admSwitch"><input type="checkbox" checked={pw.enabled} onChange={(e) => setPw({ ...pw, enabled: e.target.checked })} /><span />Paywall on</label>
        <label className="admField"><span>Free trial length (days)</span><input className="admInput" type="number" min={0} max={30} value={pw.trialDays} onChange={(e) => setPw({ ...pw, trialDays: Number(e.target.value) })} /></label>
        <div className="admRow"><button className="admBtn primary" onClick={savePw}>Save rules</button><Msg k="pw" /></div>
      </div>
    </Panel>
    <Panel title="Platform MoMo" sub="The code shown to athletes and coaches paying Kotaana directly.">
      <div className="admForm">
        <label className="admField"><span>MoMo code</span><input className="admInput" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 123456" /></label>
        <div className="admRow"><button className="admBtn primary" onClick={saveCode}>Save code</button><Msg k="code" /></div>
      </div>
    </Panel>
    <Panel title="Server configuration" sub="What this deployment has set. Only names are shown, never values." flush>
      {!cfg ? <div className="admEmpty">Loading…</div> : <ul className="admChecklist">{cfg.map((c) => <li key={c.label}><span className={`admDot ${c.ok ? "ok" : c.needed.startsWith("Required") ? "bad" : "warn"}`} /><div><strong>{c.label}</strong><small>{c.needed}{c.ok ? "" : ` · missing ${c.missing.join(", ")}`}</small></div><em>{c.ok ? "Set" : "Missing"}</em></li>)}</ul>}
    </Panel>
  </div>;
}
