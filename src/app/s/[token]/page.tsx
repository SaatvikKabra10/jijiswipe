import { createHash } from "node:crypto";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function SharedOutfitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) notFound();
  const admin = createAdminClient();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data: share } = await admin.from("outfit_shares").select("outfit_id").eq("token_hash", tokenHash).eq("active", true).maybeSingle();
  if (!share) notFound();
  const { data: outfit } = await admin.from("outfits").select("id,name,owner_id,created_at").eq("id", share.outfit_id).maybeSingle();
  if (!outfit) notFound();
  const [{ data: profile }, { data: links }] = await Promise.all([
    admin.from("profiles").select("display_name").eq("id", outfit.owner_id).maybeSingle(),
    admin.from("outfit_items").select("slot,clothing_item_id").eq("outfit_id", outfit.id),
  ]);
  const itemIds = (links ?? []).map((link) => link.clothing_item_id);
  const { data: items } = itemIds.length ? await admin.from("clothing_items").select("id,label,storage_path").in("id", itemIds) : { data: [] };
  const pieces = await Promise.all((links ?? []).map(async (link) => {
    const item = (items ?? []).find((candidate) => candidate.id === link.clothing_item_id);
    if (!item) return null;
    const { data } = await admin.storage.from("clothing").createSignedUrl(item.storage_path, 900);
    return data?.signedUrl ? { slot: link.slot, label: item.label, imageUrl: data.signedUrl } : null;
  }));

  return <main className="share-page"><section className="share-card"><header><span className="share-brand">jiji<b>swipe</b></span><span>SHARED LOOK</span></header><div className="share-copy"><p>Styled by {profile?.display_name ?? "a friend"}</p><h1>{outfit.name}</h1></div><div className="share-canvas">{pieces.filter(Boolean).map((piece) => piece && <div className={`share-piece ${piece.slot}`} key={piece.slot}><img src={piece.imageUrl} alt={piece.label}/><span>{piece.label}</span></div>)}</div><footer><strong>Made from clothes they already own.</strong><span>JijiSwipe</span></footer></section></main>;
}
