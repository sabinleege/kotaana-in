import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";
const schema=z.object({energy:z.number().int().min(1).max(5),soreness:z.number().int().min(1).max(5),mood:z.number().int().min(1).max(5),sleepHours:z.number().min(0).max(24).nullable().optional(),feeling:z.enum(["great","ok","off","sick"]).default("ok"),symptoms:z.string().max(500).optional(),notes:z.string().max(1000).optional()});
function dateOnly(){const n=new Date();return new Date(Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate()));}
export async function GET(){const a=await apiAuth("athlete");if("error"in a)return a.error;const c=await prisma.dailyCheckin.findUnique({where:{userId_date:{userId:a.session.user.id,date:dateOnly()}}});return NextResponse.json({checkin:c});}
export async function POST(req:Request){const a=await apiAuth("athlete");if("error"in a)return a.error;const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({error:"Invalid check-in"},{status:400});const readiness=Math.max(0,Math.min(100,50+p.data.energy*8+p.data.mood*5-(p.data.soreness*9)+(p.data.sleepHours!=null?Math.min(12,p.data.sleepHours)*2:0)));const c=await prisma.dailyCheckin.upsert({where:{userId_date:{userId:a.session.user.id,date:dateOnly()}},create:{userId:a.session.user.id,date:dateOnly(),readiness,...p.data},update:{readiness,...p.data}});return NextResponse.json({ok:true,checkin:c});}
