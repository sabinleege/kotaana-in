import { AthleteFrame } from "@/app/app-layout";
import Link from "next/link";
import NutritionPrefsForm from "@/components/setup/NutritionPrefsForm";
export default function NutritionSettings(){return <AthleteFrame><div className="stack"><div><Link href="/app/settings" className="small muted">← Settings</Link><h1 style={{fontSize:28,margin:"9px 0 4px"}}>Nutrition preferences</h1><p className="subtitle">Calorie target, diet style and foods to avoid. The same preferences are on the Nutrition page.</p></div><div className="card"><NutritionPrefsForm/></div></div></AthleteFrame>}
