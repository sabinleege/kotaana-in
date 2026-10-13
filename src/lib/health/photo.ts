import { aiVision } from "@/lib/ai/router";
import { logError } from "@/lib/observability";

export const MAX_IMAGE_CHARS = 2_500_000;
export const parseImage = (dataUrl?: string | null) => {
  const m = dataUrl?.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  return m && dataUrl!.length <= MAX_IMAGE_CHARS ? { mimeType: m[1], base64: m[2] } : null;
};

export type PhotoAssessment = { factor: number; note: string; seeDoctor: boolean };

/** A cautious look at a progress photo (wound, swelling, visible illness). It adjusts the recovery estimate a little and can say "please see a doctor"; it never diagnoses. Returns null when no vision model is configured. */
export async function assessPhoto(dataUrl: string, what: string, reportedSeverity: number): Promise<PhotoAssessment | null> {
  const img = parseImage(dataUrl); if (!img) return null;
  try {
    const raw = await aiVision(`You help an athlete track recovery. The photo shows: ${what}. The athlete rated it ${reportedSeverity} out of 5. Do NOT diagnose. Return {"visibleSeverity":1-5,"stage":"fresh"|"healing"|"mostly_healed"|"worrying"|"unclear","note":"one short, kind sentence about what is visible and what to watch","seeDoctor":boolean}. Set seeDoctor true only for signs such as spreading redness, pus, heavy swelling, deformity or severe bruising.`, img);
    if (!raw) return null;
    const v = JSON.parse(raw.replace(/^```(?:json)?|```$/g, "").trim());
    const visible = Math.max(1, Math.min(5, Math.round(Number(v.visibleSeverity) || reportedSeverity)));
    const stageAdj = v.stage === "mostly_healed" ? -0.15 : v.stage === "healing" ? -0.05 : v.stage === "worrying" ? 0.2 : 0;
    const factor = Math.max(0.7, Math.min(1.4, 1 + (visible - reportedSeverity) * 0.12 + stageAdj));
    return { factor, note: typeof v.note === "string" ? v.note.slice(0, 240) : "", seeDoctor: Boolean(v.seeDoctor) || v.stage === "worrying" };
  } catch (e) { logError("api_error", e, { where: "health_photo" }); return null; }
}
