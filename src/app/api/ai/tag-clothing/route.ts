import { createHash } from "node:crypto";
import OpenAI, { APIError } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { aiEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { clothingCategories, clothingColors, formalities, seasons, warmthLevels } from "@/lib/clothing-metadata";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 700 * 1024;
const allowedTypes = new Set(["image/webp", "image/png", "image/jpeg"]);
const garmentMetadata = z.object({
  proposed_name: z.string().min(1).max(60),
  category: z.enum(clothingCategories),
  item_type: z.string().min(1).max(40),
  primary_color: z.enum(clothingColors),
  formality: z.enum(formalities),
  warmth: z.enum(warmthLevels),
  seasons: z.array(z.enum(seasons)).max(4),
  material: z.string().max(40).nullable(),
  pattern: z.string().max(40).nullable(),
  style_tags: z.array(z.string().min(1).max(30)).max(6),
  confidence: z.enum(["low", "medium", "high"]),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to analyze clothing." }, { status: 401 });

  try {
    const now = new Date();
    const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [{ count: dailyCount }, { count: monthlyCount }] = await Promise.all([
      supabase.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("feature", "clothing_tag").gte("created_at", dayStart.toISOString()),
      supabase.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("feature", "clothing_tag").gte("created_at", monthStart.toISOString()),
    ]);
    if ((dailyCount ?? 0) >= 50 || (monthlyCount ?? 0) >= 300) return Response.json({ error: "Auto-fill limit reached. Enter details manually for now." }, { status: 429 });
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File) || !allowedTypes.has(image.type) || image.size > MAX_IMAGE_BYTES) {
      return Response.json({ error: "Use the prepared clothing cutout." }, { status: 400 });
    }
    const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    const safetyIdentifier = createHash("sha256").update(`jijiswipe:${user.id}`).digest("hex");
    const openai = new OpenAI({ apiKey: aiEnv().OPENAI_API_KEY, timeout: 25_000, maxRetries: 1 });
    const response = await openai.responses.parse({
      model: "gpt-5.6-luna",
      store: false,
      reasoning: { effort: "none" },
      safety_identifier: safetyIdentifier,
      input: [{ role: "user", content: [
        { type: "input_text", text: "Analyze the single cut-out garment. Choose practical closet metadata. Describe only visible evidence; use null for uncertain material or pattern. Do not infer brand, price, gender, size, or owner traits." },
        { type: "input_image", image_url: `data:${image.type};base64,${base64}`, detail: "low" },
      ] }],
      text: { format: zodTextFormat(garmentMetadata, "clothing_metadata") },
    });
    if (!response.output_parsed) return Response.json({ error: "No clothing details were returned." }, { status: 422 });
    await supabase.from("ai_usage_events").insert({ owner_id: user.id, feature: "clothing_tag", model: "gpt-5.6-luna", input_tokens: response.usage?.input_tokens ?? 0, output_tokens: response.usage?.output_tokens ?? 0 });
    return Response.json({ metadata: response.output_parsed });
  } catch (error) {
    const apiError = error instanceof APIError ? error : null;
    const status = error instanceof z.ZodError ? 422 : apiError?.status === 401 ? 401 : apiError?.status === 429 ? 429 : 503;
    console.error("Clothing analysis failed", { name: error instanceof Error ? error.name : "UnknownError", status: apiError?.status, code: apiError?.code, type: apiError?.type });
    const message = status === 401 ? "The server API key was not accepted." : status === 429 ? "OpenAI billing or usage access is not ready yet." : status === 422 ? "The clothing details were incomplete." : "Auto-fill is temporarily unavailable. You can still enter details manually.";
    return Response.json({ error: message }, { status });
  }
}
