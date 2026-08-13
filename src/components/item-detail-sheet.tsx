"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { centsFromPrice, clothingCategories, clothingColors, currencies, formalities, garmentTypes, priceFromCents, seasons, titleCase, warmthLevels, type ClothingCategory, type ClothingMetadata } from "@/lib/clothing-metadata";

type Item = ClothingMetadata & { id: string; label: string; category: ClothingCategory; storage_path: string; imageUrl: string; metadata_confirmed_at: string | null };

export function ItemDetailSheet({ item, onClose, onChanged }: { item: Item; onClose: () => void; onChanged: () => Promise<boolean> }) {
  const [label, setLabel] = useState(item.label);
  const [category, setCategory] = useState(item.category);
  const [itemType, setItemType] = useState(item.item_type ?? garmentTypes[item.category][0]);
  const [primaryColor, setPrimaryColor] = useState(item.primary_color ?? "");
  const [formality, setFormality] = useState(item.formality ?? "");
  const [warmth, setWarmth] = useState(item.warmth ?? "");
  const [itemSeasons, setItemSeasons] = useState(item.seasons ?? []);
  const [brand, setBrand] = useState(item.brand ?? "");
  const [pricePaid, setPricePaid] = useState(priceFromCents(item.purchase_price_cents));
  const [currency, setCurrency] = useState(item.purchase_currency ?? "USD");
  const [purchasedOn, setPurchasedOn] = useState(item.purchased_on ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    if (!label.trim()) { setMessage("Give this piece a name."); return; }
    setBusy(true); setMessage("");
    const { error } = await createClient().from("clothing_items").update({ label: label.trim(), category, item_type: itemType || null, primary_color: primaryColor || null, formality: formality || null, warmth: warmth || null, seasons: itemSeasons, brand: brand.trim() || null, purchase_price_cents: centsFromPrice(pricePaid), purchase_currency: currency, purchased_on: purchasedOn || null, metadata_source: "manual", metadata_version: 1, metadata_confirmed_at: new Date().toISOString() }).eq("id", item.id);
    if (error) setMessage("This piece could not be updated.");
    else { const advanced = await onChanged(); if (!advanced) onClose(); }
    setBusy(false);
  }

  async function remove() {
    if (!window.confirm(`Delete “${item.label}” from your closet? This cannot be undone.`)) return;
    setBusy(true); setMessage("");
    const supabase = createClient();
    const { error } = await supabase.from("clothing_items").delete().eq("id", item.id);
    if (error) { setMessage(error.code === "23503" ? "This piece is used in a saved outfit. Delete that outfit first." : "This piece could not be deleted."); setBusy(false); return; }
    await supabase.storage.from("clothing").remove([item.storage_path]);
    const advanced = await onChanged(); if (!advanced) onClose();
  }

  return <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="item-sheet-title"><section className="detail-sheet"><header><button onClick={onClose} aria-label="Close item details">×</button><strong id="item-sheet-title">Piece details</strong><span>PRIVATE</span></header><div className="sheet-body"><div className="detail-image"><img src={item.imageUrl} alt={item.label}/></div><div className="item-fields detail-fields"><label>Item name<input value={label} maxLength={60} onChange={(event) => setLabel(event.target.value)}/></label><label>Category<select value={category} onChange={(event) => { const next = event.target.value as ClothingCategory; setCategory(next); setItemType(garmentTypes[next][0]); }}>{clothingCategories.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label></div><section className="metadata-editor" aria-labelledby="style-details-title"><div><strong id="style-details-title">Recommendation details</strong><span>Editable anytime</span></div><div className="metadata-grid"><label>Garment type<select value={itemType} onChange={(event) => setItemType(event.target.value)}>{garmentTypes[category].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label><label>Color<select value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)}><option value="">Not set</option>{clothingColors.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label><label>Dress code<select value={formality} onChange={(event) => setFormality(event.target.value as typeof formality)}><option value="">Not set</option>{formalities.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label><label>Weight<select value={warmth} onChange={(event) => setWarmth(event.target.value as typeof warmth)}><option value="">Not set</option>{warmthLevels.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label></div><fieldset className="season-picker"><legend>Good for</legend>{seasons.map((value) => <button type="button" className={itemSeasons.includes(value) ? "selected" : ""} key={value} onClick={() => setItemSeasons((current) => current.includes(value) ? current.filter((season) => season !== value) : [...current, value])}>{titleCase(value)}</button>)}</fieldset><div className="ownership-fields"><label>Brand<input value={brand} maxLength={60} onChange={(event) => setBrand(event.target.value)} placeholder="Optional" /></label><label>Price paid<span className="price-input"><select aria-label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value as typeof currency)}>{currencies.map((value) => <option key={value}>{value}</option>)}</select><input inputMode="decimal" type="number" min="0" step="0.01" value={pricePaid} onChange={(event) => setPricePaid(event.target.value)} placeholder="0.00" /></span></label><label>Purchase date<input type="date" max={new Date().toISOString().slice(0, 10)} value={purchasedOn} onChange={(event) => setPurchasedOn(event.target.value)} /></label></div></section>{message && <p className="form-error" role="alert">{message}</p>}<button className="primary-button" disabled={busy} onClick={save}>{busy ? "Working…" : "Save changes"}</button><button className="danger-button" disabled={busy} onClick={remove}>Delete from closet</button></div></section></div>;
}
