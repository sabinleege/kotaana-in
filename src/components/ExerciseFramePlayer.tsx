"use client";

/**
 * ExerciseFramePlayer
 * Cycles an exercise's still frames (start → end) so it reads like a GIF.
 * A real GIF is preferred when available.
 *
 * Frame sources understood:
 *   - explicit { start, mid, end } frame set
 *   - free-exercise-db stills: …/<Exercise>/0.jpg → also plays …/1.jpg
 *   - bryllim workout-guide SVGs: …/frame-1.svg → also plays frame-2, frame-3
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type FrameSet = {
  start?: string | null;
  mid?: string | null;
  end?: string | null;
};

type Props = {
  gif?: string | null;
  frames?: FrameSet | null;
  image?: string | null;
  alt?: string;
  /** Time each frame is shown (ms). Default 900 */
  intervalMs?: number;
  className?: string;
};

/** Expand a single still into its known sibling frames. */
export function framesFromImage(image?: string | null): string[] {
  if (!image) return [];
  if (/\/0\.jpg$/i.test(image)) return [image, image.replace(/0\.jpg$/i, "1.jpg")];
  if (/frame-1\.svg$/i.test(image)) return [1, 2, 3].map((n) => image.replace(/frame-1\.svg$/i, `frame-${n}.svg`));
  return [image];
}

function collectFrames(frames?: FrameSet | null, image?: string | null): string[] {
  const explicit = [frames?.start, frames?.mid, frames?.end].filter((u): u is string => Boolean(u));
  const list = explicit.length ? explicit : framesFromImage(image);
  return [...new Set(list)];
}

/** Parse [frames] note that seed-extra-libraries stores in instructions */
export function parseFramesFromInstructions(instructions?: string | null): FrameSet | null {
  if (!instructions) return null;
  const m = instructions.match(/\[frames\]\s*start=(\S*)\s*mid=(\S*)\s*end=(\S*)/);
  if (!m) return null;
  return { start: m[1] || null, mid: m[2] || null, end: m[3] || null };
}

export function ExerciseFramePlayer({ gif, frames, image, alt = "Exercise demo", intervalMs = 900, className }: Props) {
  const candidates = gif ? [gif] : collectFrames(frames, image);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const sequence = candidates.filter((src) => !broken.has(src));
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || sequence.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % sequence.length), intervalMs);
    return () => clearInterval(id);
  }, [paused, sequence.length, intervalMs]);

  if (!sequence.length) return <div className={cn("demoBox demoEmpty", className)}>No demonstration available for this exercise.</div>;

  const active = index % sequence.length;
  return (
    <div className={cn("demoBox", className)} role="img" aria-label={alt} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {sequence.map((src, i) => (
        <img key={src} src={src} alt="" aria-hidden={i !== active} className={i === active ? "on" : ""} onError={() => setBroken((b) => new Set(b).add(src))} />
      ))}
      {sequence.length > 1 && <div className="demoDots">{sequence.map((_, i) => <span key={i} className={i === active ? "on" : ""} />)}</div>}
    </div>
  );
}

export default ExerciseFramePlayer;
