import { logError } from "@/lib/observability";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";
import { buildDailySession } from "@/lib/workout/engine";
import type { PerformanceRecord } from "@/lib/workout/types";
import { NoSafeExerciseError } from "@/lib/workout/types";
import { rerankWorkoutCandidates } from '@/lib/ai/workout-rerank';
import { aiProvider } from '@/lib/ai/router';

function dateOnly(d:Date){return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));}
export async function POST(){
  const a=await apiAuth("athlete"); if("error"in a)return a.error;
  try{
    const userId=a.session.user.id; const now=new Date(); const since=new Date(now.getTime()-14*86400000);
    const profile=await prisma.profile.findUnique({where:{userId}}); if(!profile)return NextResponse.json({error:"Complete your profile before generating a plan."},{status:409});
    const injuries=await prisma.injury.findMany({where:{athleteId:userId,status:{in:["active","recovering"]}}}).catch(()=>[]);
    const performances=await prisma.exercisePerformance.findMany({where:{userId,date:{gte:dateOnly(since)}},orderBy:{date:"desc"},take:200});
    const weekStart=dateOnly(new Date(now.getTime()-7*86400000));
    const weeklyPerformances=await prisma.exercisePerformance.findMany({where:{userId,date:{gte:weekStart}},orderBy:{date:"desc"},take:500});
    const weeklyLogs=await prisma.workoutLog.findMany({where:{userId,date:{gte:weekStart},completionRate:{gt:0}},select:{date:true}});
    const expected=Math.max(1,Math.min(7,profile.trainingDaysPerWeek||3));
    const missedSessions=Math.min(expected,Math.max(0,expected-new Set(weeklyLogs.map(p=>p.date.toISOString().slice(0,10))).size));
    const recentMuscles=await prisma.exercise.findMany({where:{id:{in:performances.map(p=>p.exerciseId)}},select:{muscleGroup:true,target:true,secondaryMuscles:true,movementPattern:true}});
    const weeklyExercises=await prisma.exercise.findMany({where:{id:{in:weeklyPerformances.map(p=>p.exerciseId)}},select:{muscleGroup:true,target:true,secondaryMuscles:true,movementPattern:true}});
    const recentIds=[...new Set(performances.map(p=>p.exerciseId))];
    const performanceHistory:PerformanceRecord[]=performances.map(p=>({exerciseId:p.exerciseId,effort:p.effort as any,completed:p.completed,setsDone:p.setsDone,repsDone:p.repsDone,durationSec:p.durationSec,date:p.date.toISOString().slice(0,10)}));
    const exercises=await prisma.exercise.findMany({where:{verified:true},take:5000});
    const aiPreferred=aiProvider()?await rerankWorkoutCandidates(exercises as any, {userId,ageBand:profile.ageBand,level:profile.level,track:profile.track,goal:profile.primaryGoal,availableMinutes:profile.sessionDurationMin,readiness:(await prisma.dailyCheckin.findUnique({where:{userId_date:{userId,date:dateOnly(now)}}}))?.readiness??70}):[];
    const session=buildDailySession(exercises as any,{
      userId, ageBand:profile.ageBand, level:profile.level, track:profile.track, goal:profile.primaryGoal, equipment:profile.equipment.length?profile.equipment:["bodyweight"], equipmentExclude:profile.equipmentExclude,
      injuries:injuries.map(i=>({bodyPart:i.bodyPart,restrictions:i.restrictions,status:i.status})), injuryDataKnown:profile.injuryDataStatus === "known", otherLimitations:profile.otherLimitations, conditions:Array.isArray(profile.healthConditions)?profile.healthConditions.map(String):[], isPregnant:profile.isPregnant, stressLevel:profile.stressLevel, outdoorTrainingOk:profile.outdoorTrainingOk,
      trainingDays:profile.trainingDays, availableMinutes:profile.sessionDurationMin, aiPreferredExerciseIds:aiPreferred, location:profile.locationLat!=null&&profile.locationLng!=null?{lat:profile.locationLat,lng:profile.locationLng,city:profile.locationCity||undefined,country:profile.locationCountry||undefined}:null,
      recentExerciseIds:recentIds, recentMuscleTags:recentMuscles.flatMap(x=>[x.muscleGroup,x.target,...x.secondaryMuscles]).filter(Boolean) as string[], recentMovementPatterns:recentMuscles.map(x=>x.movementPattern).filter(Boolean) as string[], weeklyMuscleTags:weeklyExercises.flatMap(x=>[x.muscleGroup,x.target,...x.secondaryMuscles]).filter(Boolean) as string[], weeklyMovementPatterns:weeklyExercises.map(x=>x.movementPattern).filter(Boolean) as string[], performanceHistory, missedSessions, dayOfWeek:now.getDay(), readiness:(await prisma.dailyCheckin.findUnique({where:{userId_date:{userId,date:dateOnly(now)}}}))?.readiness??70
    },now);
    const version=(await prisma.workoutPlan.count({where:{userId,date:dateOnly(now)}}))+1;
    const saved=await prisma.$transaction(async tx=>{
      await tx.workoutPlan.updateMany({where:{userId,date:dateOnly(now),isActive:true},data:{isActive:false}});
      return tx.workoutPlan.create({data:{userId,date:dateOnly(now),planData:session as any,isActive:true,version,regenReason:"manual_generate"}});
    });
    return NextResponse.json({ok:true,session,planId:saved.id,version});
  }catch(e){
    if(e instanceof NoSafeExerciseError)return NextResponse.json({ok:false,code:e.code,error:e.message,details:e.details},{status:422});
    logError("api_error",e,{}); return NextResponse.json({ok:false,error:"Workout generation failed. No unsafe fallback was generated."},{status:500});
  }
}

export async function GET(){
 const a=await apiAuth("athlete"); if("error"in a)return a.error; const now=new Date(); const plan=await prisma.workoutPlan.findFirst({where:{userId:a.session.user.id,date:dateOnly(now),isActive:true},orderBy:{createdAt:"desc"}}); return NextResponse.json({session:plan?.planData??null,planId:plan?.id??null});
}
