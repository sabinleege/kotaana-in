"use client";
import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon, Wordmark } from "./Brand";

type Gender = "" | "male" | "female" | "other" | "prefer_not";

function GoogleG() {
  return <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.600l6.800-6.800C35.800 2.400 30.300 0 24 0 14.600 0 6.500 5.400 2.600 13.200l7.900 6.100C12.400 13.600 17.700 9.500 24 9.500z" /><path fill="#4285F4" d="M46.500 24.500c0-1.600-.1-3.100-.4-4.500H24v9h12.700c-.6 3-2.300 5.500-4.800 7.200l7.500 5.800c4.400-4.100 7.100-10.100 7.100-17.500z" /><path fill="#FBBC05" d="M10.500 28.700A14.500 14.500 0 0 1 9.500 24c0-1.600.3-3.200.8-4.700l-7.900-6.100A24 24 0 0 0 0 24c0 3.900.9 7.500 2.600 10.800l7.900-6.100z" /><path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.500-5.800c-2.100 1.400-4.800 2.300-8.400 2.300-6.300 0-11.600-4.100-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48z" /></svg>;
}

function AuthInner({ googleEnabled }: { googleEnabled: boolean }) {
  const params = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">(params.get("mode") === "signup" ? "signup" : "login");
  const [role, setRole] = useState<"" | "athlete" | "coach">("");
  const [name, setName] = useState(""); const [dob, setDob] = useState(""); const [gender, setGender] = useState<Gender>("");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const oauthError = params.get("error");
  const [error, setError] = useState<string | null>(oauthError ? (oauthError === "OAuthAccountNotLinked" ? "This email already has an account. Log in with your email and password." : oauthError === "AccessDenied" ? "Google sign-in was cancelled or not allowed." : "Sign-in failed. Please try again.") : null);
  const signup = mode === "signup";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      if (signup) {
        if (!role) throw new Error("Please select your role.");
        const r = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password, role, dateOfBirth: dob, gender: gender || undefined }) });
        const d = await r.json(); if (!r.ok) throw new Error(d.error || "Signup failed");
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (!result || result.error) throw new Error("Email or password is incorrect.");
      const session = await fetch("/api/auth/session").then((r) => r.json());
      const actual = session?.user?.role;
      const next = params.get("next");
      if (!signup && next && next.startsWith("/") && !next.startsWith("//")) { window.location.href = next; return; }
      window.location.href = actual === "admin" ? "/admin" : actual === "coach" ? (signup ? "/coach/onboarding" : "/coach") : (signup ? "/app/onboarding" : "/app");
    } catch (err) { setError(err instanceof Error ? err.message : "Authentication failed."); }
    finally { setBusy(false); }
  };
  const google = async () => {
    setBusy(true); setError(null);
    // A coach who signs up with Google picks the role first; it is read once, right after the account is created.
    try { document.cookie = signup && role === "coach" ? "kotaana_signup_role=coach; path=/; max-age=600; samesite=lax" : "kotaana_signup_role=; path=/; max-age=0"; } catch {}
    try { await signIn("google", { callbackUrl: "/auth/complete" }); } catch { setError("Google sign-in is not configured on this deployment."); setBusy(false); }
  };

  return <main className="ktAuth"><div className="ktAuthCard">
    <Link href="/" className="ktBack" aria-label="Back to start"><Icon name="back" size={26} /></Link>
    <Wordmark size="md" />
    <h1 className="ktTitle">{signup ? "Create Your Account" : "Welcome Back"}</h1>
    <p className="ktSub">{signup ? "Join Kotaana and start your fitness journey today!" : "Log in to continue your training."}</p>
    <form onSubmit={submit} className="ktForm" noValidate={false}>
      {signup && <label className="ktField"><Icon name="user" /><input aria-label="Full name" placeholder="Full Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></label>}
      {signup && <label className="ktField two"><Icon name="briefcase" /><span className="ktStack"><small>Role</small><select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value as "" | "athlete" | "coach")} required className={role ? "" : "empty"}><option value="" disabled>Select your role</option><option value="athlete">Athlete</option><option value="coach">Coach / Gym</option></select></span><Icon name="chevron" size={18} /></label>}
      <label className="ktField"><Icon name="mail" /><input aria-label="Email address" type="email" placeholder="Email Address" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label className="ktField"><Icon name="lock" /><input aria-label="Password" type={show ? "text" : "password"} placeholder="Password" autoComplete={signup ? "new-password" : "current-password"} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="button" className="ktEye" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}><Icon name={show ? "eyeoff" : "eye"} size={22} /></button></label>
      {signup && <label className="ktField two"><Icon name="calendar" /><span className="ktStack"><small>Date of Birth</small><input aria-label="Date of birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={new Date().toISOString().slice(0, 10)} required className={dob ? "" : "empty"} /></span></label>}
      {signup && <label className="ktField two"><Icon name="gender" /><span className="ktStack"><small>Gender</small><select aria-label="Gender" value={gender} onChange={(e) => setGender(e.target.value as Gender)} className={gender ? "" : "empty"}><option value="">Select (optional)</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option><option value="prefer_not">Prefer not to say</option></select></span><Icon name="chevron" size={18} /></label>}
      {!signup && <div className="ktForgot"><Link href="/auth/forgot">Forgot password?</Link></div>}
      {error && <div className="ktErr" role="alert">{error}</div>}
      <button className="ktBtn solid" disabled={busy}>{busy ? "Working…" : signup ? "Sign Up" : "Log In"}</button>
    </form>
    {googleEnabled && <><div className="ktOr"><span />OR<span /></div><button type="button" className="ktBtn google" onClick={google} disabled={busy}><GoogleG />Continue with Google</button></>}
    <p className="ktSwitch">{signup ? "Already have an account?" : "New to Kotaana?"} <button type="button" onClick={() => { setMode(signup ? "login" : "signup"); setError(null); }}>{signup ? "Log In" : "Sign Up"}</button></p>
    <p className="ktPrivacy"><Icon name="shield" size={16} /> Your data is safe with us. We value your privacy. <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link></p>
  </div></main>;
}

export default function AuthClient({ googleEnabled }: { googleEnabled: boolean }) {
  return <Suspense fallback={<main className="ktAuth"><div className="ktAuthCard">Loading…</div></main>}><AuthInner googleEnabled={googleEnabled} /></Suspense>;
}
