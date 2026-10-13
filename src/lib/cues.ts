"use client";
/** Phone feedback when a block is marked done, a timer ends or the whole session finishes: vibration and/or a short beep. */
export type CueMode = "both" | "vibrate" | "sound" | "off";
const KEY = "kotaana-cues";

export const getCueMode = (): CueMode => { try { const v = localStorage.getItem(KEY); return v === "vibrate" || v === "sound" || v === "off" ? v : "both"; } catch { return "both"; } };
export const setCueMode = (m: CueMode) => { try { localStorage.setItem(KEY, m); } catch {} };

let ctx: AudioContext | null = null;
function beep(freq: number, ms: number, delay = 0) {
  try {
    ctx = ctx ?? new (window.AudioContext || (window as any).webkitAudioContext)();
    const t0 = ctx.currentTime + delay / 1000; const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = freq; o.type = "sine"; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
    o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + ms / 1000 + 0.05);
  } catch {}
}

/** "done" = one block marked, "timer" = a countdown reached zero, "finish" = the whole session is complete. */
export function cue(kind: "done" | "timer" | "finish") {
  const mode = getCueMode(); if (mode === "off") return;
  if (mode !== "sound") { try { navigator.vibrate?.(kind === "finish" ? [200, 100, 200, 100, 400] : kind === "timer" ? [300, 120, 300] : 120); } catch {} }
  if (mode !== "vibrate") { if (kind === "finish") { beep(660, 160); beep(880, 160, 200); beep(1175, 320, 400); } else if (kind === "timer") { beep(880, 200); beep(880, 200, 280); } else beep(740, 110); }
}
