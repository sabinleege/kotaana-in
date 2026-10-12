import { redirect } from "next/navigation";

/** Folded into a single page to keep the gym portal menu short. */
export default function Moved() { redirect("/coach/athletes"); }
