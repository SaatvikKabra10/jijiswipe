import type { ClothingCategory, ClothingMetadata } from "@/lib/clothing-metadata";

export type RecommendationSlot = "top" | "bottom" | "one-piece" | "outerwear" | "shoes" | "accessory";
export type RecommendableItem = ClothingMetadata & { id: string; label: string; category: ClothingCategory };
export type OutfitRecommendation = { id: string; itemIds: Partial<Record<RecommendationSlot, string>>; score: number; reason: string };

const formalityRank = { relaxed: 0, casual: 1, "smart-casual": 2, formal: 3 } as const;
const neutralColors = new Set(["black", "white", "gray", "cream", "brown", "beige"]);

function includesAny(prompt: string, words: string[]) { return words.some((word) => prompt.includes(word)); }

export function parseOutfitRequest(input: string) {
  const prompt = input.toLowerCase();
  const formality: keyof typeof formalityRank = includesAny(prompt, ["formal", "wedding", "gala", "interview", "ceremony"])
    ? "formal" : includesAny(prompt, ["office", "work", "dinner", "date", "business", "nice"])
      ? "smart-casual" : includesAny(prompt, ["gym", "lounge", "chill", "errand"])
        ? "relaxed" : "casual";
  const season = (["spring", "summer", "fall", "winter"] as const).find((value) => prompt.includes(value));
  const warmth = includesAny(prompt, ["hot", "warm", "beach", "pool", "summer"])
    ? "lightweight" : includesAny(prompt, ["cold", "snow", "winter", "freezing"])
      ? "heavyweight" : undefined;
  const wantsLayer = includesAny(prompt, ["cold", "cool", "chilly", "fall", "winter", "layer"]);
  return { formality, season, warmth, wantsLayer };
}

function itemScore(item: RecommendableItem, request: ReturnType<typeof parseOutfitRequest>) {
  let score = 0;
  if (item.formality) score += 5 - Math.abs(formalityRank[item.formality] - formalityRank[request.formality]) * 2;
  if (request.season && item.seasons.length) score += item.seasons.includes(request.season) ? 4 : -3;
  if (request.warmth && item.warmth) score += item.warmth === request.warmth ? 3 : -1;
  return score;
}

function colorScore(first: RecommendableItem, second: RecommendableItem) {
  if (!first.primary_color || !second.primary_color) return 0;
  if (first.primary_color === second.primary_color) return 1;
  if (neutralColors.has(first.primary_color) || neutralColors.has(second.primary_color)) return 3;
  return 0;
}

function bestExtra(items: RecommendableItem[], category: ClothingCategory, request: ReturnType<typeof parseOutfitRequest>, offset: number) {
  return items.filter((item) => item.category === category).sort((a, b) => itemScore(b, request) - itemScore(a, request))[offset % Math.max(1, items.filter((item) => item.category === category).length)];
}

export function recommendOwnedOutfits(items: RecommendableItem[], prompt: string, limit = 3): OutfitRecommendation[] {
  const request = parseOutfitRequest(prompt);
  const tops = items.filter((item) => item.category === "tops").slice(0, 30);
  const bottoms = items.filter((item) => item.category === "bottoms").slice(0, 30);
  const onePieces = items.filter((item) => item.category === "one-pieces").slice(0, 30);
  const bases: { itemIds: Partial<Record<RecommendationSlot, string>>; pieces: RecommendableItem[]; score: number }[] = [];

  for (const top of tops) for (const bottom of bottoms) {
    bases.push({ itemIds: { top: top.id, bottom: bottom.id }, pieces: [top, bottom], score: itemScore(top, request) + itemScore(bottom, request) + colorScore(top, bottom) });
  }
  for (const piece of onePieces) bases.push({ itemIds: { "one-piece": piece.id }, pieces: [piece], score: itemScore(piece, request) + 2 });

  return bases.sort((a, b) => b.score - a.score).slice(0, Math.max(limit * 3, limit)).map((base, index) => {
    const itemIds = { ...base.itemIds };
    const pieces = [...base.pieces];
    if (request.wantsLayer) {
      const outerwear = bestExtra(items, "outerwear", request, index);
      if (outerwear) { itemIds.outerwear = outerwear.id; pieces.push(outerwear); }
    }
    const shoes = bestExtra(items, "shoes", request, index);
    if (shoes) { itemIds.shoes = shoes.id; pieces.push(shoes); }
    const accessory = bestExtra(items, "accessories", request, index);
    if (accessory && index % 2 === 0) { itemIds.accessory = accessory.id; pieces.push(accessory); }
    const reasonParts = [`Matches a ${request.formality.replace("-", " ")} direction`];
    if (request.season) reasonParts.push(`works for ${request.season}`);
    if (request.wantsLayer && itemIds.outerwear) reasonParts.push("adds the layer you asked for");
    return { id: pieces.map((item) => item.id).join(":"), itemIds, score: base.score, reason: `${reasonParts.join(" and ")}.` };
  }).filter((result) => Object.keys(result.itemIds).length >= 2)
    .filter((result, index, all) => all.findIndex((candidate) => candidate.id === result.id) === index).slice(0, limit);
}
