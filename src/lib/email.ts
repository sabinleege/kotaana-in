import { logError } from "@/lib/observability";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Sends an e-mail through Resend. Returns false (and logs) when no key is configured or the send fails; callers never depend on it succeeding. */
export async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY; if (!key) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.EMAIL_FROM || "Kotaana <onboarding@resend.dev>", to, subject, html }) });
    if (!r.ok) { logError("api_error", new Error(`Resend ${r.status}`), { where: "email" }); return false; }
    return true;
  } catch (e) { logError("api_error", e, { where: "email" }); return false; }
}

export type Receipt = { number: string; payerName: string; item: string; amount: number; currency: string; paidFrom: string; paidTo: string; confirmedBy: string; date: Date; benefit: string };

/** A simple, printable receipt e-mail. */
export function receiptHtml(r: Receipt) {
  const row = (k: string, v: string) => `<tr><td style="padding:8px 0;color:#5b6470">${esc(k)}</td><td style="padding:8px 0;text-align:right;font-weight:600">${esc(v)}</td></tr>`;
  return `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;color:#15171a">
  <div style="display:flex;align-items:center;gap:10px"><span style="display:inline-block;width:34px;height:34px;border-radius:9px;background:#ff6b00;color:#fff;text-align:center;line-height:34px;font-weight:900">K</span><strong style="font-size:18px">Kotaana</strong></div>
  <h2 style="margin:18px 0 4px">Payment receipt</h2><p style="margin:0;color:#5b6470">Receipt ${esc(r.number)} · ${r.date.toLocaleDateString("en-GB", { dateStyle: "long" })}</p>
  <p>Hi ${esc(r.payerName)}, your payment was confirmed.</p>
  <table style="width:100%;border-collapse:collapse;border-top:1px solid #e3e6ea;border-bottom:1px solid #e3e6ea">${row("For", r.item)}${row("Amount", `${r.amount.toLocaleString()} ${r.currency}`)}${row("Paid from", r.paidFrom)}${row("Paid to", r.paidTo)}${row("Confirmed by", r.confirmedBy)}${row("What you get", r.benefit)}</table>
  <p style="color:#5b6470;font-size:12px;margin-top:16px">Keep this e-mail as your proof of payment. Questions? Reply to your coach or contact Kotaana support.</p></div>`;
}
