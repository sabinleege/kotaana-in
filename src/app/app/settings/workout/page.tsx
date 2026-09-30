import { AthleteFrame } from "@/app/app-layout";
import Link from "next/link";
import WorkoutSetupForm from "@/components/setup/WorkoutSetupForm";
export default function WorkoutSetupSettings(){return <AthleteFrame><div className="stack"><div><Link href="/app/settings" className="small muted">← Settings</Link><h1 style={{fontSize:28,margin:"9px 0 4px"}}>Workout setup</h1><p className="subtitle">Goal, level, equipment and training days used to generate your workouts. The same setup is on your Dashboard.</p></div><div className="card"><WorkoutSetupForm/></div></div></AthleteFrame>}
