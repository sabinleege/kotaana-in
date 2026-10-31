import { signOut } from "@/auth";

/** Next.js prefetches visible links in production. A prefetch of this URL used to sign the person out in the background,
 * so the next page they opened sent them back to the login screen. Prefetches are now ignored, and the menus sign out with a POST form. */
const isPrefetch = (req: Request) => Boolean(req.headers.get("next-router-prefetch") || req.headers.get("rsc") || req.headers.get("purpose") === "prefetch" || req.headers.get("sec-purpose")?.includes("prefetch"));

export async function GET(req: Request) {
  if (isPrefetch(req)) return new Response(null, { status: 204 });
  return signOut({ redirectTo: "/auth?mode=login" });
}
export async function POST() { return signOut({ redirectTo: "/auth?mode=login" }); }
