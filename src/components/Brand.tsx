const PATHS: Record<string, React.ReactNode> = {
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeoff: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /><path d="M3 3l18 18" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  gender: <><circle cx="10" cy="14" r="5" /><path d="M14 10l6-6M15 4h5v5" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  back: <path d="M15 5l-7 7 7 7" />,
  dumbbell: <path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12" />,
  bars: <path d="M5 20v-8M12 20V5M19 20V9" />,
  apple: <><path d="M12 8c-2.2-2.2-6.5-1.4-6.5 3.2 0 4.6 3.1 9.3 6.5 9.3s6.5-4.700 6.5-9.300C18.500 6.600 14.200 5.800 12 8z" /><path d="M12 8c0-2 1-3.400 3-4.200" /></>,
  shield: <><path d="M12 3l8 3v6c0 4.500-3.400 8-8 9-4.600-1-8-4.500-8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
};
export function Icon({ name, size = 22 }: { name: keyof typeof PATHS | string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PATHS[name]}</svg>;
}

/** The Kotaana "K" with a running figure. */
export function BrandMark({ size = 72 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Kotaana">
    <defs><linearGradient id="kg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff9a3c" /><stop offset="1" stopColor="#ff5a00" /></linearGradient></defs>
    <circle cx="46" cy="9" r="5.2" fill="url(#kg)" />
    <path d="M13 8h11v50H13z" fill="url(#kg)" />
    <path d="M24 34 44 17h14L36 36z" fill="url(#kg)" />
    <path d="M30 36l-1 7 12 15h17L40 36z" fill="url(#kg)" />
  </svg>;
}

export function Wordmark({ size = "lg", tagline = true }: { size?: "lg" | "md"; tagline?: boolean }) {
  return <div className={`ktWord ${size}`}><BrandMark size={size === "lg" ? 76 : 56} /><div className="ktName">Kotaana</div>{tagline && <div className="ktTag">TRAIN <i>•</i> TRACK <i>•</i> ACHIEVE</div>}</div>;
}
