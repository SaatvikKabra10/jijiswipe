"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { clothingCategories, clothingColors, formalities, garmentTypes, seasons, titleCase, warmthLevels, type ClothingCategory, type ClothingMetadata } from "@/lib/clothing-metadata";

type Item = ClothingMetadata & { id: string; label: string; category: ClothingCategory; storage_path: string; imageUrl: string };

export function ItemDetailSheet({ item, onClose, onChanged }: { item: Item; onClose: () => void; onChanged: () => Promise<void> }) {
  const [label, setLabel] = useState(item.label);
  const [category, setCategory] = useState(item.category);
  const [itemType, setItemType] = useState(item.item_type ?? garmentTypes[item.category][0]);
  const [primaryColor, setPrimaryColor] = useState(item.primary_color ?? "");
  const [formality, setFormality] = useState(item.formality ?? "");
  const [warmth, setWarmth] = useState(item.warmth ?? "");
  const [itemSeasons, setItemSeasons] = useState(item.seasons ?? []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    if (!label.trim()) { setMessage("Give this piece a name."); return; }
    setBusy(true); setMessage("");
    const { error } = await createClient().from("clothing_items").update({ label: label.trim(), category, item_type: itemType || null, primary_color: primaryColor || null, formality: formality || null, warmth: warmth || null, seasons: itemSeasons, metadata_source: "manual", metadata_version: 1, metadata_confirmed_at: new Date().toISOString() }).eq("id", item.id);
    if (error) setMessage("This piece could not be updated.");
    else { await onChanged(); onClose(); }
    setBusy(false);
  }

  async function remove() {
    if (!window.confirm(`Delete “${item.label}” from your closet? This cannot be undone.`)) return;
    setBusy(true); setMessage("");
    const supabase = createClient();
    const { error } = await supabase.from("clothing_items").delete().eq("id", item.id);
    if (error) { setMessage(error.code === "23503" ? "This piece is used in a saved outfit. Delete that outfit first." : "This piece could not be deleted."); setBusy(false); return; }
    await supabase.storage.from("clothing").remove([item.storage_path]);
    await onChanged(); onClose();
  }

  return <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="item-sheet-title"><section className="detail-sheet"><header><button onClick={onClose} aria-label="Close item details">×</button><strong id="item-sheet-title">Piece details</strong><span>PRIVATE</span></header><div className="sheet-body"><div className="detail-image"><img src={item.imageUrl} alt={item.label}/></div><div className="item-fields detail-fields"><label>Item name<input value={label} maxLength={60} onChange={(event) => setLabel(event.target.value)}/></label><label>Category<select value={category} onChange={(event) => { const next = event.target.value as ClothingCategory; setCategory(next); setItemType(garmentTypes[next][0]); }}>{clothingCategories.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label></div><section className="metadata-editor" aria-labelledby="style-details-title"><div><strong id="style-details-title">Recommendation details</strong><span>Editable anytime</span></div><div className="metadata-grid"><label>Garment type<select value={itemType} onChange={(event) => setItemType(event.target.value)}>{garmentTypes[category].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label><label>Color<select value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)}><option value="">Not set</option>{clothingColors.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label><label>Dress code<select value={formality} onChange={(event) => setFormality(event.target.value as typeof formality)}><option value="">Not set</option>{formalities.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label><label>Weight<select value={warmth} onChange={(event) => setWarmth(event.target.value as typeof warmth)}><option value="">Not set</option>{warmthLevels.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label></div><fieldset className="season-picker"><legend>Good for</legend>{seasons.map((value) => <button type="button" className={itemSeasons.includes(value) ? "selected" : ""} key={value} onClick={() => setItemSeasons((current) => current.includes(value) ? current.filter((season) => season !== value) : [...current, value])}>{titleCase(value)}</button>)}</fieldset></section>{message && <p className="form-error" role="alert">{message}</p>}<button className="primary-button" disabled={busy} onClick={save}>{busy ? "Working…" : "Save changes"}</button><button className="danger-button" disabled={busy} onClick={remove}>Delete from closet</button></div></section></div>;
}
