import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

export async function requireRole(...roles: Role[]) {
  const session=await auth();
  if(!session?.user?.id) redirect("/auth?mode=login");
  if(roles.length && !roles.includes(session.user.role as Role)) redirect(session.user.role === "coach" ? "/coach" : session.user.role === "admin" ? "/admin" : "/app");
  return session;
}
export async function apiAuth(...roles: Role[]) {
  const session=await auth();
  if(!session?.user?.id) return { error:Response.json({error:"Unauthorized"},{status:401}) } as const;
  if(roles.length && !roles.includes(session.user.role as Role)) return { error:Response.json({error:"Forbidden"},{status:403}) } as const;
  return { session } as const;
}
