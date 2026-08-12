import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to share this look." }, { status: 401 });
  const { data: outfit } = await supabase.from("outfits").select("id").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!outfit) return NextResponse.json({ error: "Look not found." }, { status: 404 });

  const token = randomBytes(24).toString("base64url");
  const { error } = await supabase.from("outfit_shares").upsert({ outfit_id: id, owner_id: user.id, token_hash: hashToken(token), active: true }, { onConflict: "outfit_id" });
  if (error) return NextResponse.json({ error: "Could not create the share link." }, { status: 500 });
  return NextResponse.json({ url: `${new URL(request.url).origin}/s/${token}` });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage this link." }, { status: 401 });
  const { error } = await supabase.from("outfit_shares").update({ active: false }).eq("outfit_id", id).eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: "Could not revoke the link." }, { status: 500 });
  return NextResponse.json({ revoked: true });
}
