"use client";
import { useEffect, useState } from "react";

type Prompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** "Install Kotaana" button. Android and desktop Chrome/Edge show the native install prompt; iPhones need the Share → Add to Home Screen steps. */
export default function InstallApp() {
  const [ev, setEv] = useState<Prompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.navigator as any).standalone);
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || Boolean((window.navigator as any).standalone));
    const on = (e: Event) => { e.preventDefault(); setEv(e as Prompt); };
    const done = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", on); window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", on); window.removeEventListener("appinstalled", done); };
  }, []);
  if (installed) return <div className="card small"><strong>✓ Kotaana is installed</strong> on this device.</div>;
  return <div className="card stack" style={{ gap: 8 }}>
    <div><h2 className="sectionTitle">Install Kotaana as an app</h2><p className="small muted" style={{ margin: "4px 0 0" }}>Opens full screen from your home screen, like any other app.</p></div>
    {ev ? <button className="btn primary" onClick={async () => { await ev.prompt(); await ev.userChoice; setEv(null); }}>⬇ Install app</button>
      : ios ? <ol className="howSteps"><li>Tap the <strong>Share</strong> button in Safari.</li><li>Choose <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong>.</li></ol>
      : <p className="small muted" style={{ margin: 0 }}>Open the browser menu (⋮) and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. The button appears here automatically when your browser allows installing.</p>}
  </div>;
}
