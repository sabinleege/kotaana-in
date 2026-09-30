import { describe, expect, it } from "vitest";
import { buildDailySession, NoSafeExerciseError } from "@/lib/workout/engine";
const base:any=[
{id:"s",name:"Gentle Stretch",category:"stretching",equipment:"bodyweight",target:"mobility",roleTags:["stretch"],difficulty:"beginner",movementPattern:"mobility",verified:true},
{id:"w",name:"March in Place",category:"warm-up",equipment:"bodyweight",target:"warm up",roleTags:["warmup"],difficulty:"beginner",movementPattern:"locomotion",verified:true},
{id:"a",name:"Bodyweight Squat",category:"strength",equipment:"bodyweight",target:"quadriceps",muscleGroup:"legs",roleTags:["main"],difficulty:"beginner",movementPattern:"squat",verified:true},
{id:"b",name:"Wall Push Up",category:"strength",equipment:"bodyweight",target:"chest",muscleGroup:"chest",roleTags:["main"],difficulty:"beginner",movementPattern:"push",verified:true},
{id:"c",name:"Dead Bug",category:"core",equipment:"bodyweight",target:"core",roleTags:["core"],difficulty:"beginner",movementPattern:"core",verified:true}
];
describe("Kotaana workout decision engine",()=>{
 it("always opens with stretch then warm-up and inserts hydration",()=>{const x=buildDailySession(base,{userId:"u1",level:"beginner",goal:"general_fitness",equipment:["bodyweight"],availableMinutes:35,injuryDataKnown:true},new Date("2026-09-23T10:00:00Z"));expect(x.moves[0].role).toBe("stretch");expect(x.moves[1].role).toBe("warmup");expect(x.hydrationRemindersMl.every(x=>x===500)).toBe(true);});
 it("uses performance to regress hard or incomplete work",()=>{const x=buildDailySession(base,{userId:"u2",level:"intermediate",goal:"muscle_gain",equipment:["bodyweight"],availableMinutes:35,injuryDataKnown:true,performanceHistory:[{exerciseId:"a",effort:"hard",completed:false,date:"2026-09-22"}]},new Date("2026-09-23T10:00:00Z"));const m=x.moves.find((m:any)=>m.exerciseId==="a");expect(m?.effort).not.toBe("hard");});
 it("fails closed when no safe verified exercise can satisfy the required structure",()=>{expect(()=>buildDailySession([{...base[0],safetyTags:["high_risk"]}],{userId:"u3",level:"beginner",equipment:["bodyweight"],injuryDataKnown:false},new Date("2026-09-23T10:00:00Z"))).toThrow(NoSafeExerciseError);});
});
