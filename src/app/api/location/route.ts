import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";
const schema=z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180),city:z.string().max(80).nullable().optional(),country:z.string().max(80).nullable().optional()});
export async function POST(req:Request){const a=await apiAuth("athlete","coach","admin");if("error"in a)return a.error;const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({error:"Valid latitude and longitude are required."},{status:400});const regionHint=`${p.data.lat.toFixed(2)},${p.data.lng.toFixed(2)}`;const profile=await prisma.profile.update({where:{userId:a.session.user.id},data:{locationLat:p.data.lat,locationLng:p.data.lng,locationCity:p.data.city??null,locationCountry:p.data.country??null,regionHint}});return NextResponse.json({ok:true,profile});}
