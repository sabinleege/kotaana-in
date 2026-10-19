import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import ExerciseReview from "@/components/ExerciseReview";

export const dynamic = "force-dynamic";
export default async function AdminExercises() {
  await requireRole("admin");
  return <div className="page"><div className="container" style={{ padding: "22px 0" }}>
    <div className="row spread" style={{ flexWrap: "wrap" }}><h1 style={{ margin: 0 }}>Exercise safety review</h1><Link className="btn secondary" href="/admin">Back</Link></div>
    <p className="subtitle" style={{ margin: "6px 0 14px" }}>Check each exercise's safety tags. The injury, age and health filters use them, so an exercise marked reviewed is trusted more and scores higher.</p>
    <ExerciseReview />
  </div></div>;
}
