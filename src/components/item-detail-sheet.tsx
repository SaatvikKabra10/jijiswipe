"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const categories = ["tops", "bottoms", "one-pieces", "outerwear", "shoes", "accessories"] as const;
type Item = { id: string; label: string; category: typeof categories[number]; storage_path: string; imageUrl: string };

export function ItemDetailSheet({ item, onClose, onChanged }: { item: Item; onClose: () => void; onChanged: () => Promise<void> }) {
  const [label, setLabel] = useState(item.label);
  const [category, setCategory] = useState(item.category);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    if (!label.trim()) { setMessage("Give this piece a name."); return; }
    setBusy(true); setMessage("");
    const { error } = await createClient().from("clothing_items").update({ label: label.trim(), category }).eq("id", item.id);
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

  return <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="item-sheet-title"><section className="detail-sheet"><header><button onClick={onClose} aria-label="Close item details">×</button><strong id="item-sheet-title">Piece details</strong><span>PRIVATE</span></header><div className="sheet-body"><div className="detail-image"><img src={item.imageUrl} alt={item.label}/></div><div className="item-fields detail-fields"><label>Item name<input value={label} maxLength={60} onChange={(event) => setLabel(event.target.value)}/></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>{categories.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label></div>{message && <p className="form-error" role="alert">{message}</p>}<button className="primary-button" disabled={busy} onClick={save}>{busy ? "Working…" : "Save changes"}</button><button className="danger-button" disabled={busy} onClick={remove}>Delete from closet</button></div></section></div>;
}
