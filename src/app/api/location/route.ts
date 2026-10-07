import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";

const schema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), city: z.string().max(80).nullable().optional(), country: z.string().max(80).nullable().optional() });

/** Looks up a place name for the coordinates. Best-effort: a failure just leaves city/country empty. */
async function placeName(lat: number, lng: number) {
  try {
    const u = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
    u.searchParams.set("latitude", String(lat)); u.searchParams.set("longitude", String(lng)); u.searchParams.set("localityLanguage", "en");
    const r = await fetch(u, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return {};
    const d = await r.json();
    return { city: (d.city || d.locality || d.principalSubdivision || null) as string | null, country: (d.countryName || null) as string | null };
  } catch { return {}; }
}

export async function POST(req: Request) {
  const a = await apiAuth("athlete", "coach", "admin"); if ("error" in a) return a.error;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Valid latitude and longitude are required." }, { status: 400 });
  const named = p.data.city || p.data.country ? {} : await placeName(p.data.lat, p.data.lng);
  const city = p.data.city ?? named.city ?? null, country = p.data.country ?? named.country ?? null;
  const profile = await prisma.profile.update({ where: { userId: a.session.user.id }, data: { locationLat: p.data.lat, locationLng: p.data.lng, locationCity: city, locationCountry: country, regionHint: `${p.data.lat.toFixed(2)},${p.data.lng.toFixed(2)}` } });
  return NextResponse.json({ ok: true, profile });
}
