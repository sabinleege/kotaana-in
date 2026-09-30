import { logError } from "@/lib/observability";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";
import { fetchWeather } from "@/lib/location/weather";
import { buildDailyFoodPlan } from "@/lib/nutrition/engine";
export async function GET(){
 const a=await apiAuth("athlete"); if("error"in a)return a.error;
 const userId=a.session.user.id; const profile=await prisma.profile.findUnique({where:{userId}}); if(!profile)return NextResponse.json({error:"Profile not found."},{status:404});
 const foods=await prisma.food.findMany({where:{verified:true},take:10000});
 const weather=profile.locationLat!=null&&profile.locationLng!=null?await fetchWeather(profile.locationLat,profile.locationLng):null;
 try{const plan=buildDailyFoodPlan(foods,{userId,goal:profile.primaryGoal,dietaryStyle:profile.dietaryStyle,allergies:profile.allergies,conditions:Array.isArray(profile.healthConditions)?profile.healthConditions.map(String):[],isPregnant:profile.isPregnant,targetCalories:profile.targetCalories,location:{city:profile.locationCity,country:profile.locationCountry},weather});
  if(plan.hydration.mlTarget!==profile.waterTargetMl)await prisma.profile.update({where:{userId},data:{waterTargetMl:plan.hydration.mlTarget}});
  return NextResponse.json({ok:true,plan});}
 catch(e){logError("api_error",e,{});return NextResponse.json({ok:false,error:"Food library has no usable foods for these dietary constraints."},{status:422});}
}
