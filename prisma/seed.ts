import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

function norm(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function exerciseMeta(e: any) {
  const t = norm([e.name,e.category,e.bodyPart,e.target,e.muscleGroup,e.equipment].filter(Boolean).join(" "));
  const roleTags: string[] = [];
  const safetyTags: string[] = [];
  const contraindicationTags: string[] = [];
  if (/stretch|mobility|flexibility|cat cow|90 90|child pose/.test(t)) roleTags.push("stretch");
  if (/warm[ -]?up|dynamic|march|jog|jumping jack|arm circle|leg swing|high knees/.test(t)) roleTags.push("warmup");
  if (/plank|abs|abdominal|core|dead bug|bird dog|oblique/.test(t)) roleTags.push("core");
  if (/run|jog|walk|hike|sprint|hill/.test(t)) roleTags.push("outdoor");
  if (!roleTags.length) roleTags.push("main");
  if (/jump|sprint|snatch|muscle up|planche|handstand|pistol/.test(t)) safetyTags.push("high_risk");
  if (/overhead|dip|handstand|snatch|muscle up/.test(t)) contraindicationTags.push("shoulder","overhead");
  if (/squat|lunge|jump|pistol/.test(t)) contraindicationTags.push("knee","squat_depth","impact");
  if (/deadlift|good morning|sit up|leg raise hanging|round back/.test(t)) contraindicationTags.push("lower_back","hinge");
  if (/push up|planche|handstand/.test(t)) contraindicationTags.push("wrist","loaded_wrist");
  if (/jump|sprint|box jump/.test(t)) contraindicationTags.push("ankle","impact");
  const difficulty = /pistol|muscle up|planche|front lever|snatch|handstand|heavy/.test(t) ? "advanced" : /burpee|deadlift|bench|squat|lunge|pull up|push up|row/.test(t) ? "intermediate" : "beginner";
  const movementPattern = /squat/.test(t) ? "squat" : /deadlift|hinge|good morning/.test(t) ? "hinge" : /row|pull|pull up/.test(t) ? "pull" : /press|push|bench/.test(t) ? "push" : /run|jog|walk|sprint|bike|cycling/.test(t) ? "locomotion" : /carry/.test(t) ? "carry" : roleTags.includes("stretch") ? "mobility" : "conditioning";
  const goals = ["general_fitness"];
  if (/run|jog|cardio|sprint|bike|cycling|burpee|mountain/.test(t)) goals.push("endurance","fat_loss");
  if (/press|row|curl|squat|deadlift|pull|push|bench/.test(t)) goals.push("muscle_gain","hypertrophy");
  const tracks = ["general"];
  if (/football|soccer|sprint|agility|lateral|jump|hamstring/.test(t)) tracks.push("football");
  if (/run|jog|cardio|bike|cycling/.test(t)) tracks.push("endurance");
  if (/strength|squat|deadlift|bench|press|row|curl/.test(t)) tracks.push("hypertrophy");
  return { roleTags: [...new Set(roleTags)], safetyTags: [...new Set(safetyTags)], contraindicationTags:[...new Set(contraindicationTags)], difficulty, movementPattern, goals:[...new Set(goals)], tracks:[...new Set(tracks)] };
}

const CURATED_BASELINE_EXERCISES = [
  { id:"kotaana-stretch-standing", name:"Standing full-body stretch", category:"stretching", bodyPart:"full body", equipment:"bodyweight", target:"mobility", instructions:"Perform gentle, pain-free full-body stretches with controlled breathing.", roleTags:["stretch"], safetyTags:["low_risk"], contraindicationTags:[], difficulty:"beginner", movementPattern:"mobility", goals:["general_fitness"], tracks:["general"], estimatedMinutes:1 },
  { id:"kotaana-stretch-cat-cow", image:"https://cdn.jsdelivr.net/gh/bryllim/workout-guide@main/packages/workout-guide/assets/cat-cow-stretch/frame-1.svg", name:"Cat-Cow mobility", category:"mobility", bodyPart:"spine", equipment:"bodyweight", target:"mobility", instructions:"Move slowly between a comfortable rounded and extended spine position; stop if painful.", roleTags:["stretch"], safetyTags:["low_risk"], contraindicationTags:["lower_back"], difficulty:"beginner", movementPattern:"mobility", goals:["general_fitness"], tracks:["general"], estimatedMinutes:1 },
  { id:"kotaana-warmup-march", name:"March in place", category:"warm-up", bodyPart:"full body", equipment:"bodyweight", target:"warm up", instructions:"March in place at a comfortable pace while keeping posture controlled.", roleTags:["warmup"], safetyTags:["low_risk"], contraindicationTags:[], difficulty:"beginner", movementPattern:"locomotion", goals:["general_fitness","endurance"], tracks:["general","endurance","football"], estimatedMinutes:2 },
  { id:"kotaana-warmup-arm-circles", image:"https://cdn.jsdelivr.net/gh/bryllim/workout-guide@main/packages/workout-guide/assets/arm-circles/frame-1.svg", name:"Arm circles", category:"warm-up", bodyPart:"shoulders", equipment:"bodyweight", target:"shoulders", instructions:"Make small controlled circles, gradually increasing range without pain.", roleTags:["warmup"], safetyTags:["low_risk"], contraindicationTags:["shoulder"], difficulty:"beginner", movementPattern:"mobility", goals:["general_fitness"], tracks:["general"], estimatedMinutes:2 },
  { id:"kotaana-main-squat", image:"https://cdn.jsdelivr.net/gh/bryllim/workout-guide@main/packages/workout-guide/assets/bodyweight-squat/frame-1.svg", name:"Bodyweight squat", category:"strength", bodyPart:"legs", equipment:"bodyweight", target:"quadriceps", instructions:"Sit hips back and bend knees through a comfortable range while keeping the torso controlled.", roleTags:["main"], safetyTags:["low_risk"], contraindicationTags:["knee","squat_depth"], difficulty:"beginner", movementPattern:"squat", goals:["general_fitness","muscle_gain","fat_loss"], tracks:["general","hypertrophy"], estimatedMinutes:5 },
  { id:"kotaana-main-wall-push", image:"https://cdn.jsdelivr.net/gh/bryllim/workout-guide@main/packages/workout-guide/assets/wall-push-up/frame-1.svg", name:"Wall push-up", category:"strength", bodyPart:"chest", equipment:"bodyweight", target:"chest", instructions:"Keep hands on a stable wall, lower the chest under control and press away.", roleTags:["main"], safetyTags:["low_risk"], contraindicationTags:["shoulder","wrist"], difficulty:"beginner", movementPattern:"push", goals:["general_fitness","muscle_gain"], tracks:["general","hypertrophy"], estimatedMinutes:5 },
  { id:"kotaana-main-glute-bridge", image:"https://cdn.jsdelivr.net/gh/bryllim/workout-guide@main/packages/workout-guide/assets/glute-bridge/frame-1.svg", name:"Glute bridge", category:"strength", bodyPart:"glutes", equipment:"bodyweight", target:"glutes", instructions:"Lie on your back, brace gently and raise the hips through a comfortable range.", roleTags:["main"], safetyTags:["low_risk"], contraindicationTags:["lower_back"], difficulty:"beginner", movementPattern:"hinge", goals:["general_fitness","muscle_gain"], tracks:["general","hypertrophy"], estimatedMinutes:5 },
  { id:"kotaana-core-dead-bug", image:"https://cdn.jsdelivr.net/gh/bryllim/workout-guide@main/packages/workout-guide/assets/dead-bug/frame-1.svg", name:"Dead bug", category:"core", bodyPart:"core", equipment:"bodyweight", target:"core", instructions:"Maintain a comfortable trunk position while moving opposite arm and leg slowly.", roleTags:["core"], safetyTags:["low_risk"], contraindicationTags:["lower_back"], difficulty:"beginner", movementPattern:"core", goals:["general_fitness"], tracks:["general"], estimatedMinutes:3 },
  { id:"kotaana-outdoor-walk", image:"https://cdn.jsdelivr.net/gh/bryllim/workout-guide@main/packages/workout-guide/assets/walking/frame-1.svg", name:"Outdoor walk", category:"cardio", bodyPart:"full body", equipment:"bodyweight", target:"cardio", instructions:"Walk outdoors at a comfortable moderate pace on a safe, appropriate route.", roleTags:["outdoor"], safetyTags:["low_risk"], contraindicationTags:["ankle","impact"], difficulty:"beginner", movementPattern:"locomotion", goals:["general_fitness","endurance","fat_loss"], tracks:["general","endurance","football"], estimatedMinutes:10 },
];

async function seedExercises() {
  const files = ["free-exercise-db-ready.json","bryllim-ready.json","mohamedatef-ready.json"];
  const seen = new Set<string>();
  const rows: any[] = [];
  for (const file of files) {
    const arr = JSON.parse(fs.readFileSync(path.join(process.cwd(),"data","exercises",file),"utf8"));
    for (const e of arr) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      const meta = exerciseMeta(e);
      rows.push({ id:e.id, name:e.name, nameKey:e.nameKey || norm(e.name), category:e.category, bodyPart:e.bodyPart, equipment:e.equipment, target:e.target, muscleGroup:e.muscleGroup || e.target, secondaryMuscles:e.secondaryMuscles || [], instructions:e.instructions, steps:e.steps || [], image:e.image || (Array.isArray(e.images) ? e.images[0] : null), gif:e.gif || null, frames:e.frames || null, source:e.source || file, verified:true, safetyReviewed:false, qualityScore:[e.name,e.target,e.equipment,e.instructions,e.movementPattern].filter(Boolean).length*20, sourceLicense:e.license||null, normalizedVersion:1, estimatedMinutes: meta.roleTags.includes("outdoor") ? 10 : meta.roleTags.includes("stretch") ? 1 : 5, ...meta });
    }
  }
  for (const e of CURATED_BASELINE_EXERCISES) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    rows.push({ ...e, nameKey:norm(e.name), muscleGroup:e.target, secondaryMuscles:[], steps:[], image:(e as any).image ?? null, gif:null, frames:null, source:"kotaana_curated_baseline", verified:true, safetyReviewed:true, qualityScore:100, sourceLicense:"Kotaana curated baseline", normalizedVersion:1 });
  }
  for (let i=0;i<rows.length;i+=250) await prisma.exercise.createMany({ data: rows.slice(i,i+250), skipDuplicates:true });
  console.log(`Exercises: ${rows.length}`);
}

function foodTags(f:any) {
  const t=norm(`${f.name} ${f.category||""}`);
  const dietaryTags=[]; const allergyTags=[];
  if (/plant|vegetable|fruit|legume|bean|lentil|nut|seed|tofu|hummus/.test(t)) dietaryTags.push("plant");
  if (/vegan/.test(t)) dietaryTags.push("vegan");
  if (/milk|cheese|yogurt|whey|cream/.test(t)) allergyTags.push("dairy");
  if (/peanut|almond|cashew|walnut|nut/.test(t)) allergyTags.push("nuts");
  if (/wheat|bread|pasta|flour|barley|rye/.test(t)) allergyTags.push("gluten");
  if (/egg/.test(t)) allergyTags.push("egg");
  if (/soy|tofu|tempeh/.test(t)) allergyTags.push("soy");
  if (/fish|salmon|tuna|cod|shrimp|crab|shellfish/.test(t)) allergyTags.push("fish_shellfish");
  return { dietaryTags:[...new Set(dietaryTags)], allergyTags:[...new Set(allergyTags)] };
}

async function seedFoods() {
  const foundation = JSON.parse(fs.readFileSync(path.join(process.cwd(),"data","foods","usda-foundation.json"),"utf8"));
  const rows:any[]=[];
  const add=(f:any)=> { if (!f?.id || !f?.name) return; const tags=foodTags(f); rows.push({ id:f.id,name:f.name,nameKey:f.nameKey||norm(f.name),brand:f.brand||null,barcode:f.barcode||null,calories:f.calories??null,protein:f.protein??null,carbs:f.carbs??null,fat:f.fat??null,fiber:f.fiber??null,servingSize:f.servingSize||null,servingGrams:f.servingGrams??null,image:f.image||null,source:f.source||"usda",category:f.category||null,verified:true,...tags}); };
  for(const f of foundation) add(f);
  const legacy = fs.readFileSync(path.join(process.cwd(),"data","foods","usda-sr-legacy.jsonl"),"utf8").split(/\r?\n/).filter(Boolean).map((line: string) => JSON.parse(line));
  for(const f of legacy) add(f);
  const byId=new Map(rows.map(r=>[r.id,r]));
  const dedup=[...byId.values()];
  for (let i=0;i<dedup.length;i+=500) await prisma.food.createMany({ data:dedup.slice(i,i+500),skipDuplicates:true });
  console.log(`Foods: ${dedup.length}`);
}

async function main() {
  await seedExercises();
  await seedFoods();
  const adminEmail="sabinleege@gmail.com";
  if (process.env.ADMIN_BOOTSTRAP_PASSWORD) {
    const { hash } = await import("bcryptjs");
    const passwordHash = await hash(process.env.ADMIN_BOOTSTRAP_PASSWORD, 12);
    await prisma.user.upsert({ where:{email:adminEmail}, update:{role:"admin",passwordHash}, create:{email:adminEmail,role:"admin",passwordHash,name:"Kotaana Admin",profile:{create:{fullName:"Kotaana Admin",email:adminEmail,onboardingCompleted:true,connectCode:"KADMIN001"}}} });
  }
  await prisma.appConfig.upsert({ where:{key:"platform_momo_code"}, update:{value:process.env.KOTAANA_PLATFORM_MOMO_CODE||""}, create:{key:"platform_momo_code",value:process.env.KOTAANA_PLATFORM_MOMO_CODE||""} });
  console.log(`Admin: ${adminEmail} (bootstrap password configured: ${Boolean(process.env.ADMIN_BOOTSTRAP_PASSWORD)})`);
}

main().finally(()=>prisma.$disconnect());
