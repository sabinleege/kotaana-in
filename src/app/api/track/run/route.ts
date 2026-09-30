import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";

const point=z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180),t:z.number().int().positive(),accuracy:z.number().min(0).max(10000).optional()});
const schema=z.object({activityType:z.enum(["run","walk","ride"]).default("run"),distanceKm:z.number().min(0.01).max(1000),durationSec:z.number().int().min(1).max(86400),path:z.array(point).min(2).max(10000)});
function dateOnly(){const n=new Date();return new Date(Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate()));}
function hav(a:{lat:number;lng:number},b:{lat:number;lng:number}){const R=6371,dLat=(b.lat-a.lat)*Math.PI/180,dLon=(b.lng-a.lng)*Math.PI/180;const x=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x));}
function pathDistance(path:Array<{lat:number;lng:number}>){let d=0;for(let i=1;i<path.length;i++)d+=hav(path[i-1],path[i]);return d;}
export async function POST(req:Request){
 const a=await apiAuth("athlete");if("error"in a)return a.error;
 const profile=await prisma.profile.findUnique({where:{userId:a.session.user.id}});
 if(profile?.locationLat==null||profile?.locationLng==null)return NextResponse.json({error:"Location permission is required before Track Me can save a session.",code:"LOCATION_REQUIRED"},{status:409});
 const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({error:"Invalid tracking data",details:p.error.flatten()},{status:400});
 const path=p.data.path;for(let i=1;i<path.length;i++){if(path[i].t<=path[i-1].t)return NextResponse.json({error:"GPS timestamps must be strictly increasing.",code:"GPS_TIME_INVALID"},{status:422});}
 const validAccuracy=path.every(x=>x.accuracy==null||x.accuracy<=250);if(!validAccuracy)return NextResponse.json({error:"GPS accuracy is too poor to save this route. Keep tracking until accuracy improves.",code:"GPS_ACCURACY_LOW"},{status:422});
 const calculated=pathDistance(path);const tolerance=Math.max(0.35,p.data.distanceKm*0.35);if(Math.abs(calculated-p.data.distanceKm)>tolerance)return NextResponse.json({error:"Reported distance does not match the GPS route closely enough.",code:"GPS_DISTANCE_MISMATCH",calculatedDistanceKm:Number(calculated.toFixed(3))},{status:422});
 const maxSpeed=p.data.activityType==="walk"?15:p.data.activityType==="ride"?120:45;const hours=p.data.durationSec/3600;if(p.data.distanceKm/hours>maxSpeed)return NextResponse.json({error:"GPS route contains an implausible speed.",code:"GPS_SPEED_INVALID"},{status:422});
 const weightKg=profile.weight??70,intensity=p.data.activityType==="walk"?3.5:p.data.activityType==="ride"?7:9.8,calories=Math.round(intensity*weightKg*hours);
 const run=await prisma.runActivity.create({data:{userId:a.session.user.id,date:dateOnly(),activityType:p.data.activityType,distanceKm:p.data.distanceKm,durationSec:p.data.durationSec,calories,avgPaceSec:Math.round(p.data.durationSec/p.data.distanceKm),path,source:"gps"}});
 await prisma.profile.update({where:{userId:a.session.user.id},data:{lastActiveAt:new Date()}});return NextResponse.json({ok:true,run,calculatedDistanceKm:Number(calculated.toFixed(3))});
}
