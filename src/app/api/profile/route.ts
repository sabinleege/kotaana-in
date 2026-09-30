import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";
import { ACTIVITY_OPTIONS, ALCOHOL_OPTIONS, CHRONIC_CONDITIONS, SMOKING_OPTIONS } from "@/lib/health/conditions";

const schema=z.object({
 fullName:z.string().trim().min(2).max(80).optional(),
 avatarUrl:z.string().max(2_000_000).nullable().optional(),
 theme:z.enum(["dark","light","system"]).optional(),
 age:z.number().int().min(5).max(110).nullable().optional(),
 dateOfBirth:z.string().date().nullable().optional(),
 gender:z.string().max(30).nullable().optional(),
 height:z.number().positive().max(250).nullable().optional(),
 weight:z.number().positive().max(500).nullable().optional(),
 targetWeight:z.number().positive().max(500).nullable().optional(),
 sessionDurationMin:z.number().int().min(10).max(180).optional(),
 equipment:z.array(z.string().trim().min(1).max(50)).max(50).optional(),
 equipmentExclude:z.array(z.string().trim().min(1).max(50)).max(50).optional(),
 trainingDays:z.array(z.number().int().min(0).max(6)).max(7).optional(),
 outdoorTrainingOk:z.boolean().optional(),
 primaryGoal:z.string().max(50).nullable().optional(),
 track:z.string().max(50).nullable().optional(),
 level:z.enum(["beginner","intermediate","advanced"]).nullable().optional(),
 dietaryStyle:z.array(z.string().max(40)).max(20).optional(),
 allergies:z.array(z.string().max(40)).max(40).optional(),
 targetCalories:z.number().int().min(1200).max(6000).nullable().optional(),
 locationLat:z.number().min(-90).max(90).nullable().optional(),
 locationLng:z.number().min(-180).max(180).nullable().optional(),
 locationCity:z.string().max(80).nullable().optional(),
 locationCountry:z.string().max(80).nullable().optional(),
 regionHint:z.string().max(80).nullable().optional(),
 onboardingCompleted:z.boolean().optional(),
 chronicDiseases:z.string().max(4000).nullable().optional(),
 pastSurgeries:z.string().max(4000).nullable().optional(),
 medications:z.string().max(4000).nullable().optional(),
 painAreas:z.string().max(2000).nullable().optional(),
 otherLimitations:z.string().max(4000).nullable().optional(),
 injuryDataStatus:z.enum(["unknown","known"]).optional(),
 healthConditions:z.array(z.enum(CHRONIC_CONDITIONS.map(c=>c.id) as [string,...string[]])).max(CHRONIC_CONDITIONS.length).optional(),
 isPregnant:z.boolean().optional(),
 pregnancyDueDate:z.string().date().nullable().optional(),
 heartRate:z.number().int().min(30).max(220).nullable().optional(),
 smokingStatus:z.enum(SMOKING_OPTIONS.map(o=>o[0]) as [string,...string[]]).nullable().optional(),
 alcoholUse:z.enum(ALCOHOL_OPTIONS.map(o=>o[0]) as [string,...string[]]).nullable().optional(),
 stressLevel:z.number().int().min(1).max(5).nullable().optional(),
 profession:z.enum(ACTIVITY_OPTIONS.map(o=>o[0]) as [string,...string[]]).nullable().optional(),
 medicalDisclaimerAccepted:z.boolean().optional(),
 tosAccepted:z.boolean().optional(),
 dataConsent:z.boolean().optional(),
});
export async function GET(){const a=await apiAuth();if("error" in a)return a.error;const profile=await prisma.profile.findUnique({where:{userId:a.session.user.id}});return NextResponse.json({profile});}
export async function PATCH(req:Request){const a=await apiAuth();if("error" in a)return a.error;const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Invalid profile update",details:parsed.error.flatten()},{status:400});const now = new Date();
 const suppliedDob = parsed.data.dateOfBirth ? new Date(`${parsed.data.dateOfBirth}T00:00:00.000Z`) : undefined;
 const dobAge = suppliedDob && !Number.isNaN(suppliedDob.getTime()) ? Math.max(0, Math.floor((Date.now() - suppliedDob.getTime()) / (365.2425*86400000))) : undefined;
 const age = parsed.data.age ?? dobAge;
 const derivedAgeBand = age == null ? undefined : age < 12 ? "youth_u12" : age < 14 ? "youth_u14" : age < 17 ? "youth_u17" : age >= 65 ? "masters" : "adult";
 const dueDate = parsed.data.pregnancyDueDate ? new Date(`${parsed.data.pregnancyDueDate}T00:00:00.000Z`) : parsed.data.pregnancyDueDate;
 const data = {...parsed.data, ...(dueDate !== undefined ? {pregnancyDueDate:dueDate} : {}), ...(suppliedDob ? {dateOfBirth:suppliedDob} : {}), ...(age != null ? {age} : {}), ...(derivedAgeBand ? {ageBand: derivedAgeBand} : {}), ...(parsed.data.tosAccepted ? {tosAcceptedAt: now} : {}), ...(parsed.data.dataConsent ? {dataConsentAt: now} : {}), ...(parsed.data.medicalDisclaimerAccepted ? {medicalDisclaimerAcceptedAt: now} : {})};
 const p=await prisma.profile.upsert({where:{userId:a.session.user.id},create:{userId:a.session.user.id,fullName:a.session.user.name||"",email:a.session.user.email,connectCode:`K${crypto.randomUUID().slice(0,8).toUpperCase()}`,...data},update:data});await prisma.user.update({where:{id:a.session.user.id},data:{name:p.fullName,image:p.avatarUrl||undefined}});
 if(parsed.data.weight!=null){const last=await prisma.weightHistory.findFirst({where:{userId:a.session.user.id},orderBy:{recordedAt:"desc"}});if(last?.weight!==parsed.data.weight)await prisma.weightHistory.create({data:{userId:a.session.user.id,weight:parsed.data.weight,weekLabel:now.toISOString().slice(0,10)}});}
 return NextResponse.json({ok:true,profile:p});}
