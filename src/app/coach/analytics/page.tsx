import { requireRole } from "@/lib/auth/guard";
import { athleteSignals, fmtDate, goalLabel } from "@/lib/coach/data";
import { Empty, PageHead } from "@/components/coach/CoachUI";
import { CsvButton } from "@/components/coach/CoachForms";

export const dynamic = "force-dynamic";
function Bars({ title, sub, data }: { title: string; sub: string; data: [string, number][] }) {
  const max = Math.max(1, ...data.map(([, n]) => n));
  return <div className="solid"><h3 style={{ margin: 0, fontSize: 15 }}>{title}</h3><p className="small muted" style={{ margin: "2px 0 12px" }}>{sub}</p>
    {data.some(([, n]) => n) ? data.map(([label, n]) => <div className="hbar" key={label}><span>{label}</span><div className="hbarTrack"><div className="hbarFill" style={{ width: `${(n / max) * 100}%` }} /></div><span className="n">{n}</span></div>) : <Empty>No data yet.</Empty>}</div>;
}
const count = <T,>(xs: T[], keys: string[], f: (x: T) => string): [string, number][] => keys.map((k) => [k, xs.filter((x) => f(x) === k).length]);

export default async function CoachAnalytics() {
  const s = await requireRole("coach");
  const a = await athleteSignals(s.user.id);
  const readinessBand = (v: number | null) => v == null ? "No check-in" : v < 40 ? "Low (<40)" : v < 60 ? "Fair (40–59)" : v < 80 ? "Good (60–79)" : "High (80+)";
  const completionBand = (v: number | null) => v == null ? "No workouts" : v < 50 ? "<50%" : v < 80 ? "50–79%" : "80–100%";
  const rows: (string | number | null)[][] = [["Name", "Email", "Status", "Goal", "Level", "Readiness (7d)", "Completion % (7d)", "Blocks completed (7d)", "Active injuries", "Weight kg", "Target kg", "Last check-in", "Last workout"],
    ...a.map((x) => [x.name, x.email, x.status, goalLabel(x.goal), x.level, x.readinessAvg7, x.adherence7, x.completed7, x.activeInjuries, x.weight, x.targetWeight, fmtDate(x.lastCheckin), fmtDate(x.lastWorkout)])];
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="INSIGHTS" title="Analytics" sub={`How your ${a.length} athlete(s) break down. Export the full table for your own reports.`}><CsvButton rows={rows} filename={`kotaana-athletes-${new Date().toISOString().slice(0, 10)}.csv`} /></PageHead>
    <div className="grid grid2">
      <Bars title="Goals" sub="Primary goal set by each athlete" data={count(a, ["General fitness", "Fat loss", "Muscle gain", "Endurance", "Not set"], (x) => goalLabel(x.goal))} />
      <Bars title="Levels" sub="Training level" data={count(a, ["beginner", "intermediate", "advanced"], (x) => x.level || "beginner")} />
      <Bars title="Readiness this week" sub="7-day average check-in score" data={count(a, ["High (80+)", "Good (60–79)", "Fair (40–59)", "Low (<40)", "No check-in"], (x) => readinessBand(x.readinessAvg7))} />
      <Bars title="Workout completion this week" sub="Completed ÷ recorded exercise blocks" data={count(a, ["80–100%", "50–79%", "<50%", "No workouts"], (x) => completionBand(x.adherence7))} />
    </div>
  </div>;
}
