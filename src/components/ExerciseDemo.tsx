"use client";

/**
 * Convenience wrapper that reads an Exercise row from Prisma
 * and decides whether to play a GIF or cycle SVG frames.
 *
 * Drop-in for any place you currently show exercise.gif / exercise.image.
 */

import {
  ExerciseFramePlayer,
  parseFramesFromInstructions,
  type FrameSet,
} from "./ExerciseFramePlayer";

type ExerciseLike = {
  name?: string | null;
  gif?: string | null;
  image?: string | null;
  instructions?: string | null;
  /** If you later add a frames Json column */
  frames?: FrameSet | null;
};

type Props = {
  exercise: ExerciseLike;
  className?: string;
  intervalMs?: number;
};

export function ExerciseDemo({ exercise, className, intervalMs = 900 }: Props) {
  // Prefer explicit frames field, else parse the [frames] note from instructions
  const frames: FrameSet | null =
    exercise.frames ?? parseFramesFromInstructions(exercise.instructions);

  return (
    <ExerciseFramePlayer
      gif={exercise.gif}
      frames={frames}
      image={exercise.image}
      alt={exercise.name ?? "Exercise"}
      className={className}
      intervalMs={intervalMs}
    />
  );
}

export default ExerciseDemo;
