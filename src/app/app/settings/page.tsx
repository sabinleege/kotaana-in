import { AthleteFrame } from "@/app/app-layout";
import Link from "next/link";
import InstallApp from "@/components/InstallApp";
import { getT } from "@/lib/i18n/server";

export default async function Settings() {
  const t = await getT();
  const rows: [string, Parameters<typeof t>[0], Parameters<typeof t>[0]][] = [
    ["/app/settings/subscription", "settings.subscription", "settings.subscriptionSub"],
    ["/app/exercises", "settings.library", "settings.librarySub"],
    ["/app/settings/profile", "settings.profile", "settings.profileSub"],
    ["/app/settings/workout", "settings.workout", "settings.workoutSub"],
    ["/app/settings/nutrition", "settings.nutrition", "settings.nutritionSub"],
    ["/app/settings/coach", "settings.coach", "settings.coachSub"],
    ["/app/settings/appearance", "settings.appearance", "settings.appearanceSub"],
  ];
  return <AthleteFrame><div className="stack">
    <div><span className="pill orange">{t("settings.eyebrow")}</span><h1 style={{ fontSize: 28, margin: "9px 0 4px" }}>{t("settings.title")}</h1><p className="subtitle">{t("settings.sub")}</p></div>
    <InstallApp />
    <div className="list">{rows.map(([href, title, sub]) => <Link className="item" href={href} key={href}><div><strong>{t(title)}</strong><div className="small muted">{t(sub)}</div></div><span>›</span></Link>)}</div>
    <div className="card"><strong>Where else you can change these</strong><p className="small muted">Workout setup is also on your Dashboard, and nutrition preferences on the Nutrition page — every copy edits the same settings. Injuries, conditions, pregnancy and readiness are on Health. Photos are on Progress. Location is on Track Me.</p></div>
  </div></AthleteFrame>;
}
