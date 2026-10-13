"use client";
import { useRef, useState } from "react";

/** Take or choose a photo; it is shrunk in the browser to a small JPEG before it is sent. */
export default function PhotoPicker({ value, onChange }: { value: string | null; onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    try {
      const bmp = await createImageBitmap(f); const k = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
      onChange(c.toDataURL("image/jpeg", 0.75)); setErr(null);
    } catch { setErr("Couldn't read that photo."); }
  };
  return <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
    <input ref={ref} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
    {value ? <><img src={value} alt="Your photo" className="photoThumb" /><button type="button" className="btn secondary small" onClick={() => onChange(null)}>Remove</button></> : <button type="button" className="btn secondary small" onClick={() => ref.current?.click()}>📷 Take or choose a photo</button>}
    {err && <span className="small danger">{err}</span>}
  </div>;
}
