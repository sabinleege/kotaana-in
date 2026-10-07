"use client";
import { useEffect, useState } from "react";
import LocationButton from "./LocationButton";

const KEY = "kotaana-location-later";
/** Shown on every athlete page until a location is saved, so meals and water can match the local weather. */
export default function LocationBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => { try { if (!sessionStorage.getItem(KEY)) setShow(true); } catch { setShow(true); } }, []);
  if (!show) return null;
  return <div className="locBanner" role="status"><div><strong>📍 Turn on location</strong><div className="small muted">Kotaana uses it for local weather and regional foods in your nutrition and hydration plan. You can still use Track Me separately.</div></div>
    <div className="row" style={{ flexWrap: "wrap" }}><LocationButton onDone={() => setShow(false)} /><button className="btn secondary small" onClick={() => { try { sessionStorage.setItem(KEY, "1"); } catch {} setShow(false); }}>Not now</button></div></div>;
}
