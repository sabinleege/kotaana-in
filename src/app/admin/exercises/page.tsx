import ExerciseReview from "@/components/ExerciseReview";
import { AdminHeader } from "@/components/admin/AdminUI";

export const dynamic = "force-dynamic";
export default async function AdminExercises() {
  return <>
    <AdminHeader eyebrow="Exercise review" title="Exercise safety review" sub="Check each exercise's safety tags. The injury, age, health and pregnancy filters use them, so an exercise marked reviewed is trusted more and scores higher." />
    <div className="admPayments"><ExerciseReview /></div>
  </>;
}
