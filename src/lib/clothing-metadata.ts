export const clothingCategories = ["tops", "bottoms", "one-pieces", "outerwear", "shoes", "accessories"] as const;
export type ClothingCategory = (typeof clothingCategories)[number];

export const garmentTypes: Record<ClothingCategory, readonly string[]> = {
  tops: ["t-shirt", "shirt", "blouse", "tank top", "polo", "sweater", "hoodie", "crop top", "bodysuit", "other"],
  bottoms: ["jeans", "trousers", "shorts", "skirt", "leggings", "sweatpants", "cargo pants", "other"],
  "one-pieces": ["dress", "jumpsuit", "romper", "overalls", "matching set", "other"],
  outerwear: ["jacket", "coat", "blazer", "cardigan", "vest", "raincoat", "other"],
  shoes: ["sneakers", "boots", "heels", "flats", "sandals", "loafers", "dress shoes", "other"],
  accessories: ["bag", "hat", "belt", "scarf", "jewelry", "sunglasses", "tie", "other"],
};

export const clothingColors = ["black", "white", "gray", "cream", "brown", "beige", "red", "orange", "yellow", "green", "blue", "purple", "pink", "metallic", "multicolor"] as const;
export const formalities = ["relaxed", "casual", "smart-casual", "formal"] as const;
export const warmthLevels = ["lightweight", "midweight", "heavyweight"] as const;
export const seasons = ["spring", "summer", "fall", "winter"] as const;
export const currencies = ["USD", "CAD", "EUR", "GBP"] as const;

export type ClothingMetadata = {
  item_type: string | null;
  primary_color: string | null;
  formality: (typeof formalities)[number] | null;
  warmth: (typeof warmthLevels)[number] | null;
  seasons: (typeof seasons)[number][];
  brand: string | null;
  purchase_price_cents: number | null;
  purchase_currency: (typeof currencies)[number];
  purchased_on: string | null;
};

export function centsFromPrice(value: string) {
  if (!value.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

export function priceFromCents(value: number | null) {
  return value === null ? "" : (value / 100).toFixed(2);
}

export function titleCase(value: string) {
  return value.split(/[- ]/).map((word) => word ? word[0].toUpperCase() + word.slice(1) : word).join(" ");
}
