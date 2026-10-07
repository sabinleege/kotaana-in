"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Asks the browser for location once and saves it to the profile, from wherever the user is — no trip to Track Me. */
export default function LocationButton({ label = "Use my location", className = "btn primary small", onDone }: { label?: string; className?: string; onDone?: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done" | "denied" | "error">("idle");
  const run = () => {
    if (!navigator.geolocation) { setState("error"); return; }
    setState("busy");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const r = await fetch("/api/location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }) }).catch(() => null);
      if (r?.ok) { setState("done"); onDone?.(); router.refresh(); } else setState("error");
    }, (e) => setState(e.code === 1 ? "denied" : "error"), { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  };
  return <span><button className={className} disabled={state === "busy" || state === "done"} onClick={run}>{state === "busy" ? "Finding you…" : state === "done" ? "✓ Location saved" : label}</button>
    {state === "denied" && <span className="small danger"> Location is blocked — allow it in your browser's site settings, then try again.</span>}
    {state === "error" && <span className="small danger"> Couldn't get your location — try again.</span>}</span>;
}
