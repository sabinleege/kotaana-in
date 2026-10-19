import { AthleteFrame } from "@/app/app-layout";
import ExerciseLibrary from "@/components/ExerciseLibrary";
export const dynamic = "force-dynamic";
export default function Exercises() {
  return <AthleteFrame allowExpired><div className="stack"><div><span className="pill orange">LIBRARY</span><h1 style={{ fontSize: 28, margin: "9px 0 4px" }}>Exercise library</h1><p className="subtitle">Every exercise Kotaana can use in your workouts. Your plan only picks the ones that are safe for you.</p></div><ExerciseLibrary /></div></AthleteFrame>;
}
