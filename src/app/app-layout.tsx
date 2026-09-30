import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { AppPage } from "@/components/Page";
export async function AthleteFrame({children}:{children:React.ReactNode}){const s=await requireRole("athlete");const [p,unread]=await Promise.all([prisma.profile.findUnique({where:{userId:s.user.id},select:{fullName:true}}),prisma.notification.count({where:{userId:s.user.id,read:false}})]);return <AppPage name={p?.fullName||s.user.name} unread={unread}>{children}</AppPage>}
