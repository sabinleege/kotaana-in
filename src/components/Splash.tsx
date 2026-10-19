"use client";
import { useEffect, useState } from "react";

const SHOW_MS = 3400;
const KEY = "kt-splash";

/** The opening screen: the orange K builds itself with a glow, then the name and slogan appear above a loading bar. Shown once per visit; tap to skip. */
export default function Splash() {
  const [phase, setPhase] = useState<"show" | "out" | "gone">("show");
  useEffect(() => {
    try { if (sessionStorage.getItem(KEY)) { setPhase("gone"); return; } } catch {}
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t1 = setTimeout(() => { try { sessionStorage.setItem(KEY, "1"); } catch {} setPhase("out"); }, reduce ? 1200 : SHOW_MS);
    const t2 = setTimeout(() => setPhase("gone"), (reduce ? 1200 : SHOW_MS) + 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  if (phase === "gone") return null;
  const skip = () => { try { sessionStorage.setItem(KEY, "1"); } catch {} setPhase("out"); setTimeout(() => setPhase("gone"), 450); };
  return <div className={`ktSplash${phase === "out" ? " out" : ""}`} role="img" aria-label="Kootana. Train, track, achieve." onClick={skip}>
    <i className="sx sx1" /><i className="sx sx2" /><i className="sx sx3" /><i className="sx sx4" />
    <div className="spSmoke" />
    <div className="spStage">
      <svg className="spMark" viewBox="-26 0 400 300" aria-hidden="true">
        <defs>
          <linearGradient id="spk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffb02e" /><stop offset="1" stopColor="#ff6a00" /></linearGradient>
          <filter id="spglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <g filter="url(#spglow)" fill="url(#spk)">
          <path className="p p1" d="M92 12h58L78 262H20z" />
          <path className="p p2" d="M118 150l52-48L328 4 205 168z" />
          <path className="p p3" d="M170 172l38-24 82 114h-62z" />
          <circle className="p p4" cx="222" cy="26" r="17" />
        </g>
        <g className="spTrail" stroke="#ff8a1f" strokeWidth="2" strokeLinecap="round" opacity=".7"><path d="M-10 118L112 96" /><path d="M-20 150L100 124" /><path d="M0 184L96 160" /></g>
      </svg>
      <div className="spName">Kootana</div>
      <div className="spSlogan"><span>TRAIN</span><i>•</i><span>TRACK</span><i>•</i><span>ACHIEVE</span></div>
    </div>
    <div className="spBar"><b /></div>
  </div>;
}
