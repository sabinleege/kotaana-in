import Link from "next/link";
import { auth } from "@/auth";
import JoinCodeForm from "@/components/JoinCodeForm";
import { Logo } from "@/components/Logo";

export default async function Join({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code = "" } = await searchParams; const s = await auth();
  const back = `/join?code=${encodeURIComponent(code)}`;
  return <div className="page"><div className="mobile" style={{ padding: "40px 0" }}><Logo />
    <div className="card" style={{ marginTop: 20 }}><span className="pill orange">COACH INVITE</span><h1 style={{ fontSize: 26, margin: "10px 0 6px" }}>Join your coach on Kotaana</h1>
      {s?.user?.role === "athlete" ? <><p className="subtitle">Your coach will see your workouts, check-ins and progress, and can send you follow-ups.</p><div style={{ marginTop: 14 }}><JoinCodeForm initialCode={code} /></div><Link href="/app" className="small muted" style={{ display: "inline-block", marginTop: 14 }}>Go to my dashboard →</Link></>
        : s?.user ? <p className="subtitle">Invite codes are for athlete accounts. You are logged in as a {s.user.role}.</p>
        : <><p className="subtitle">Create a free athlete account or log in, then come back to this link to connect. Your code is <strong>{code || "—"}</strong>.</p><div className="row" style={{ marginTop: 14, flexWrap: "wrap" }}><Link className="btn primary" href={`/auth?mode=signup&next=${encodeURIComponent(back)}`}>Create account</Link><Link className="btn secondary" href={`/auth?mode=login&next=${encodeURIComponent(back)}`}>Log in</Link></div></>}
    </div></div></div>;
}
