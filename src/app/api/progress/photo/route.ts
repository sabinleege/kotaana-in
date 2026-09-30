import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";
const schema=z.object({pose:z.enum(["front","side","back"]),imageUrl:z.string().startsWith("data:image/").max(2_000_000),weight:z.number().positive().max(500).nullable().optional(),notes:z.string().max(500).optional()});
export async function GET(){const a=await apiAuth("athlete");if("error"in a)return a.error;return NextResponse.json({photos:await prisma.progressPhoto.findMany({where:{userId:a.session.user.id},orderBy:{date:"desc"}})});}
export async function POST(req:Request){const a=await apiAuth("athlete");if("error"in a)return a.error;const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({error:"Invalid photo. Use a JPEG/PNG data image under 2 MB."},{status:400});const photo=await prisma.progressPhoto.create({data:{userId:a.session.user.id,...p.data}});
 if(p.data.weight!=null){const now=new Date();const weekLabel=`${now.getUTCFullYear()}-W${String(Math.ceil((((now.getTime()-Date.UTC(now.getUTCFullYear(),0,1))/86400000)+new Date(Date.UTC(now.getUTCFullYear(),0,1)).getUTCDay()+1)/7)).padStart(2,"0")}`;await prisma.weightHistory.create({data:{userId:a.session.user.id,weekLabel,weight:p.data.weight}});await prisma.profile.update({where:{userId:a.session.user.id},data:{weight:p.data.weight}});}
 return NextResponse.json({ok:true,photo});}
