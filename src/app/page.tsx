import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { Icon, Wordmark } from "@/components/Brand";

const features = [
  { icon: "dumbbell", label: "Personalized Workouts" },
  { icon: "bars", label: "Track Progress" },
  { icon: "apple", label: "Nutrition Guidance" },
  { icon: "user", label: "Expert Support" },
];

export default function Landing() {
  // A photo is optional: drop one at public/hero.jpg and it is used automatically.
  const photo = fs.existsSync(path.join(process.cwd(), "public", "hero.jpg"));
  return <main className={`ktHero${photo ? " photo" : ""}`}>
    <div className="ktHeroInner">
      <div className="ktHeroTop"><Wordmark size="lg" /></div>
      <div className="ktHeroBottom">
        <h1 className="ktLead">A healthier you,<br />a stronger tomorrow.</h1>
        <ul className="ktFeatures">{features.map((f) => <li key={f.label}><span className="ktRing"><Icon name={f.icon} size={26} /></span><span>{f.label}</span></li>)}</ul>
        <div className="ktCtas">
          <Link className="ktBtn solid" href="/auth?mode=login">Log In</Link>
          <Link className="ktBtn ghost" href="/auth?mode=signup">Sign Up</Link>
        </div>
        <p className="ktJourney"><span />Your Fitness Journey Starts Here<span /></p>
        <p className="ktFine">Kotaana is not a replacement for medical care. Health information is used to adjust training conservatively.</p>
      </div>
    </div>
  </main>;
}
