import { z } from "zod";
import { segmentationEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 3_500_000;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const promptSchema = z.string().trim().min(2).max(80);
const falResultSchema = z.object({
  image: z.object({ url: z.string() }).optional(),
  masks: z.array(z.object({ url: z.string() })).optional(),
});

function decodeDataUrl(value: string) {
  const match = /^data:(image\/(?:png|webp));base64,([a-zA-Z0-9+/=]+)$/.exec(value);
  if (!match) return null;
  return { contentType: match[1], bytes: Buffer.from(match[2], "base64") };
}

async function downloadTrustedResult(value: string) {
  const embedded = decodeDataUrl(value);
  if (embedded) return embedded;
  const url = new URL(value);
  const trusted = url.protocol === "https:" && (url.hostname === "fal.media" || url.hostname.endsWith(".fal.media"));
  if (!trusted) throw new Error("Segmentation provider returned an untrusted result URL.");
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!response.ok) throw new Error("Segmentation result could not be downloaded.");
  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
  if (contentType !== "image/png" && contentType !== "image/webp") throw new Error("Segmentation provider returned an unsupported image.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > 8_000_000) throw new Error("Segmentation result was unexpectedly large.");
  return { contentType, bytes };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to segment clothing." }, { status: 401 });

  try {
    const now = new Date();
    const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [{ count: dailyCount }, { count: monthlyCount }] = await Promise.all([
      supabase.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("feature", "garment_segment").gte("created_at", dayStart.toISOString()),
      supabase.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("feature", "garment_segment").gte("created_at", monthStart.toISOString()),
    ]);
    if ((dailyCount ?? 0) >= 25 || (monthlyCount ?? 0) >= 100) return Response.json({ error: "Hosted cutout limit reached. Use the private on-device cutout for now." }, { status: 429 });

    const form = await request.formData();
    const image = form.get("image");
    const parsedPrompt = promptSchema.safeParse(form.get("prompt"));
    if (!(image instanceof File) || !allowedTypes.has(image.type) || image.size > MAX_IMAGE_BYTES || !parsedPrompt.success) {
      return Response.json({ error: "Use a prepared photo and a short garment description." }, { status: 400 });
    }

    const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    const response = await fetch("https://fal.run/fal-ai/sam-3/image", {
      method: "POST",
      headers: { Authorization: `Key ${segmentationEnv().FAL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: `data:${image.type};base64,${base64}`, prompt: parsedPrompt.data, apply_mask: true, sync_mode: true, output_format: "png", return_multiple_masks: false, include_scores: true, include_boxes: true }),
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Segmentation provider failed with status ${response.status}.`);
    const parsed = falResultSchema.safeParse(await response.json());
    const resultUrl = parsed.success ? parsed.data.image?.url ?? parsed.data.masks?.[0]?.url : undefined;
    if (!resultUrl) throw new Error("Segmentation provider returned no garment mask.");
    const result = await downloadTrustedResult(resultUrl);
    const { error: usageError } = await supabase.from("ai_usage_events").insert({ owner_id: user.id, feature: "garment_segment", model: "fal-ai/sam-3/image" });
    if (usageError) console.error("Segmentation usage metering failed", { code: usageError.code });
    return new Response(result.bytes, { headers: { "Content-Type": result.contentType, "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    const configurationError = error instanceof z.ZodError;
    console.error("Garment segmentation failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: configurationError ? "Hosted cutout is not configured yet." : "Hosted cutout is temporarily unavailable." }, { status: configurationError ? 503 : 502 });
  }
}
