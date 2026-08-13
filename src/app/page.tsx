"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PhotoLab } from "@/components/photo-lab";
import { ItemDetailSheet } from "@/components/item-detail-sheet";
import { ProfileSheet } from "@/components/profile-sheet";
import type { ClothingCategory, ClothingMetadata } from "@/lib/clothing-metadata";
import { createClient } from "@/lib/supabase/client";

type Tab = "closet" | "create" | "outfits";
type Slot = "top" | "bottom" | "one-piece" | "outerwear" | "shoes" | "accessory";
type OutfitTemplate = "separates" | "one-piece";
type BuilderMode = "build" | "deck";

type SavedClosetItem = ClothingMetadata & {
  id: string;
  label: string;
  category: ClothingCategory;
  storage_path: string;
  imageUrl: string;
};
type SavedOutfit = { id: string; name: string; note: string; created_at: string; outfit_items: { clothing_item_id: string; slot: Slot }[] };

const categories = ["All", "Tops", "Bottoms", "One-pieces", "Outerwear", "Shoes", "Accessories"] as const;

const slotCategory: Record<Slot, SavedClosetItem["category"]> = {
  top: "tops", bottom: "bottoms", "one-piece": "one-pieces", outerwear: "outerwear", shoes: "shoes", accessory: "accessories",
};
const slots = Object.keys(slotCategory) as Slot[];

function Icon({ name }: { name: "closet" | "spark" | "looks" | "plus" | "user" | "arrow" | "heart" }) {
  const paths = {
    closet: <><path d="M4 5.8h16v14H4z"/><path d="M9 5.8v14M15 5.8v14M11.7 12.5h.1M16.7 12.5h.1"/></>,
    spark: <><path d="M12 2.5c.5 4.9 2.7 7.1 7.5 7.5-4.8.5-7 2.7-7.5 7.5-.5-4.8-2.7-7-7.5-7.5 4.8-.4 7-2.6 7.5-7.5Z"/><path d="M19 16.5c.2 2.1 1.2 3.1 3 3.3-1.8.2-2.8 1.2-3 3.2-.2-2-1.2-3-3-3.2 1.8-.2 2.8-1.2 3-3.3Z"/></>,
    looks: <><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 15 2.8-3 2.2 2 2.6-3 3.4 4.5M8.5 8.5h.1"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    user: <><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.6-4 2.8-6 6.5-6s5.9 2 6.5 6"/></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5"/></>,
    heart: <path d="M20.5 9.5c0 5-8.5 10-8.5 10s-8.5-5-8.5-10A4.5 4.5 0 0 1 12 7.4a4.5 4.5 0 0 1 8.5 2.1Z"/>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("closet");
  const [filter, setFilter] = useState<(typeof categories)[number]>("All");
  const [look, setLook] = useState<Partial<Record<Slot, string>>>({});
  const [activeSlot, setActiveSlot] = useState<Slot>("top");
  const [outfitTemplate, setOutfitTemplate] = useState<OutfitTemplate>("separates");
  const [builderMode, setBuilderMode] = useState<BuilderMode>("build");
  const [deckIndex, setDeckIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const dragStart = useRef<number | undefined>(undefined);
  const [photoLabOpen, setPhotoLabOpen] = useState(false);
  const [savedItems, setSavedItems] = useState<SavedClosetItem[]>([]);
  const [closetMessage, setClosetMessage] = useState("");
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [editingOutfitId, setEditingOutfitId] = useState<string>();
  const [outfitName, setOutfitName] = useState("");
  const [outfitNote, setOutfitNote] = useState("");
  const [savingOutfit, setSavingOutfit] = useState(false);
  const [outfitMessage, setOutfitMessage] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [sharingId, setSharingId] = useState("");
  const [selectedItem, setSelectedItem] = useState<SavedClosetItem>();
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");

  const loadSavedItems = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.from("clothing_items").select("id,label,category,storage_path,item_type,primary_color,formality,warmth,seasons").order("created_at", { ascending: false });
    if (error) { setClosetMessage("Your saved pieces could not be loaded."); return; }
    const withUrls = await Promise.all((data ?? []).map(async (item) => {
      const { data: signed } = await supabase.storage.from("clothing").createSignedUrl(item.storage_path, 3600);
      return { ...item, imageUrl: signed?.signedUrl ?? "" } as SavedClosetItem;
    }));
    setSavedItems(withUrls); setClosetMessage("");
  }, []);

  const loadSavedOutfits = useCallback(async () => {
    const { data, error } = await createClient().from("outfits").select("id,name,note,created_at,outfit_items(clothing_item_id,slot)").order("created_at", { ascending: false });
    if (error) { setOutfitMessage("Your saved looks could not be loaded."); return; }
    setSavedOutfits((data ?? []) as SavedOutfit[]); setOutfitMessage("");
  }, []);

  const loadAvatar = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).maybeSingle();
    if (!data?.avatar_path) { setAvatarUrl(""); return; }
    const signed = await supabase.storage.from("avatars").createSignedUrl(data.avatar_path, 3600);
    setAvatarUrl(signed.data?.signedUrl ?? "");
  }, []);

  useEffect(() => {
    // Loading the authenticated user's remote closet is an intentional external-system sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSavedItems();
    void loadSavedOutfits();
    void loadAvatar();
  }, [loadAvatar, loadSavedItems, loadSavedOutfits]);

  const savedFiltered = filter === "All" ? savedItems : savedItems.filter((item) => item.category === filter.toLowerCase());
  const choices = savedItems.filter((item) => item.category === slotCategory[activeSlot]);
  const chosenItems = slots.flatMap((slot) => {
    const item = savedItems.find((candidate) => candidate.id === look[slot]);
    return item ? [{ slot, item }] : [];
  });
  const deckLook = useMemo(() => {
    const byCategory = (category: SavedClosetItem["category"]) => savedItems.filter((item) => item.category === category);
    const pick = (category: SavedClosetItem["category"], offset = 0) => {
      const options = byCategory(category);
      return options.length ? options[(deckIndex + offset) % options.length] : undefined;
    };
    const onePieces = byCategory("one-pieces");
    const useOnePiece = onePieces.length > 0 && deckIndex % 3 === 2;
    const suggestion: Partial<Record<Slot, SavedClosetItem>> = useOnePiece
      ? { "one-piece": onePieces[deckIndex % onePieces.length] }
      : { top: pick("tops"), bottom: pick("bottoms", 1) };
    if (deckIndex % 2 === 0) suggestion.outerwear = pick("outerwear", 2);
    suggestion.shoes = pick("shoes", 3);
    if (deckIndex % 3 === 0) suggestion.accessory = pick("accessories", 4);
    return suggestion;
  }, [deckIndex, savedItems]);
  const deckItems = Object.entries(deckLook).filter((entry): entry is [Slot, SavedClosetItem] => Boolean(entry[1]));

  function nextDeck() { setDeckIndex((index) => index + 1); setDragX(0); }
  function keepDeck() {
    setLook(Object.fromEntries(deckItems.map(([slot, item]) => [slot, item.id])));
    setOutfitTemplate(deckLook["one-piece"] ? "one-piece" : "separates");
    setActiveSlot(deckLook["one-piece"] ? "one-piece" : "top"); setBuilderMode("build"); setDragX(0);
  }
  function finishDeckSwipe() {
    if (dragX > 70) keepDeck(); else if (dragX < -70) nextDeck(); else setDragX(0);
    dragStart.current = undefined;
  }

  function chooseTemplate(template: OutfitTemplate) {
    setOutfitTemplate(template);
    if (template === "one-piece") { setLook((current) => ({ "one-piece": current["one-piece"], outerwear: current.outerwear, shoes: current.shoes, accessory: current.accessory })); setActiveSlot("one-piece"); }
    else { setLook((current) => ({ top: current.top, bottom: current.bottom, outerwear: current.outerwear, shoes: current.shoes, accessory: current.accessory })); setActiveSlot("top"); }
  }

  function resetBuilder() {
    setLook({}); setOutfitName(""); setOutfitNote(""); setEditingOutfitId(undefined); setOutfitTemplate("separates"); setActiveSlot("top"); setOutfitMessage("");
  }

  function cancelEdit() {
    resetBuilder(); setTab("outfits");
  }

  function editOutfit(outfit: SavedOutfit) {
    const nextLook = Object.fromEntries(outfit.outfit_items.map(({ clothing_item_id, slot }) => [slot, clothing_item_id])) as Partial<Record<Slot, string>>;
    setLook(nextLook); setOutfitName(outfit.name); setOutfitNote(outfit.note); setEditingOutfitId(outfit.id); setOutfitTemplate(nextLook["one-piece"] ? "one-piece" : "separates"); setActiveSlot(nextLook["one-piece"] ? "one-piece" : "top"); setBuilderMode("build"); setOutfitMessage(""); setTab("create");
  }

  async function saveOutfit() {
    if (chosenItems.length < 2 || !outfitName.trim()) { setOutfitMessage("Name your look before saving."); return; }
    setSavingOutfit(true); setOutfitMessage("");
    const supabase = createClient();
    let outfitId = "";
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Your session expired. Sign in again and retry.");
      if (editingOutfitId) {
        outfitId = editingOutfitId;
        const { error: outfitError } = await supabase.from("outfits").update({ name: outfitName.trim(), note: outfitNote.trim() }).eq("id", outfitId);
        if (outfitError) throw outfitError;
        const rows = chosenItems.map(({ slot, item }) => ({ outfit_id: outfitId, clothing_item_id: item.id, owner_id: session.user.id, slot }));
        const { error: itemsError } = await supabase.from("outfit_items").upsert(rows, { onConflict: "outfit_id,slot" });
        if (itemsError) throw itemsError;
        const chosenSlots = chosenItems.map(({ slot }) => slot);
        const removedSlots = slots.filter((slot) => !chosenSlots.includes(slot));
        if (removedSlots.length) {
          const { error: removeError } = await supabase.from("outfit_items").delete().eq("outfit_id", outfitId).in("slot", removedSlots);
          if (removeError) throw removeError;
        }
      } else {
        const { data: outfit, error: outfitError } = await supabase.from("outfits").insert({ owner_id: session.user.id, name: outfitName.trim(), note: outfitNote.trim() }).select("id").single();
        if (outfitError) throw outfitError;
        outfitId = outfit.id;
        const { error: itemsError } = await supabase.from("outfit_items").insert(chosenItems.map(({ slot, item }) => ({ outfit_id: outfitId, clothing_item_id: item.id, owner_id: session.user.id, slot })));
        if (itemsError) { await supabase.from("outfits").delete().eq("id", outfitId); throw itemsError; }
      }
      resetBuilder(); await loadSavedOutfits(); setTab("outfits");
    } catch (error) { setOutfitMessage(error instanceof Error ? error.message : "This look could not be saved."); }
    finally { setSavingOutfit(false); }
  }

  async function shareOutfit(outfit: SavedOutfit) {
    setSharingId(outfit.id); setShareMessage(""); setShareUrl("");
    try {
      const response = await fetch(`/api/outfits/${outfit.id}/share`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create the link.");
      if (typeof navigator.share === "function") await navigator.share({ title: outfit.name, text: `Check out my ${outfit.name} look on JijiSwipe`, url: result.url });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(result.url); setShareMessage("Share link copied."); }
      else { setShareUrl(result.url); setShareMessage("Press and hold the link to copy it."); }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareMessage(error instanceof Error ? error.message : "Could not share this look.");
    } finally { setSharingId(""); }
  }

  async function revokeShare(outfitId: string) {
    setSharingId(outfitId); setShareMessage(""); setShareUrl("");
    const response = await fetch(`/api/outfits/${outfitId}/share`, { method: "DELETE" });
    const result = await response.json();
    setShareMessage(response.ok ? "Public link revoked." : result.error || "Could not revoke the link.");
    setSharingId("");
  }

  async function deleteOutfit(outfit: SavedOutfit) {
    if (!window.confirm(`Delete “${outfit.name}”? This cannot be undone.`)) return;
    setSharingId(outfit.id); setOutfitMessage(""); setShareMessage(""); setShareUrl("");
    const { error } = await createClient().from("outfits").delete().eq("id", outfit.id);
    if (error) setOutfitMessage("This saved look could not be deleted. Try again.");
    else { await loadSavedOutfits(); setShareMessage("Saved look deleted."); }
    setSharingId("");
  }

  return (
    <main className={`app-shell ${editingOutfitId ? "editing-shell" : ""}`}>
      <header className="topbar">
        <button className="wordmark" onClick={() => { if (editingOutfitId) resetBuilder(); setTab("closet"); }} aria-label="JijiSwipe home">jiji<span>swipe</span></button>
        <button className="profile-button" onClick={() => setProfileOpen(true)} aria-label="Open profile">{avatarUrl ? <img src={avatarUrl} alt=""/> : <Icon name="user" />}</button>
      </header>

      <div className="screen">
        {tab === "closet" && (
          <section aria-labelledby="closet-title">
            <div className="hero-row">
              <div><p className="eyebrow">Your wardrobe</p><h1 id="closet-title">The closet</h1></div>
              <button className="add-button" onClick={() => setPhotoLabOpen(true)}><Icon name="plus" /> Add item</button>
            </div>
            <div className="stats"><span><strong>{savedItems.length}</strong> pieces</span><span><strong>{savedOutfits.length}</strong> saved looks</span></div>
            <div className="filter-row" aria-label="Filter closet">
              {categories.map((category) => <button key={category} className={filter === category ? "active" : ""} onClick={() => setFilter(category)}>{category}</button>)}
            </div>
            {closetMessage && <p className="form-error closet-message" role="alert">{closetMessage}</p>}
            {!closetMessage && savedFiltered.length === 0 && <div className="closet-empty"><p className="eyebrow">Nothing here yet</p><h2>{filter === "All" ? "Add your first piece." : `No ${filter.toLowerCase()} saved.`}</h2><p>Photograph one item and JijiSwipe will cut it out privately on your phone.</p><button className="primary-button" onClick={() => setPhotoLabOpen(true)}>Add a piece</button></div>}
            <div className="closet-grid">
              {savedFiltered.map((item) => (
                <button className="item-card" key={item.id} onClick={() => setSelectedItem(item)}>
                  <div className="item-image saved-item-image"><img src={item.imageUrl} alt="" /></div>
                  <span>{item.label}</span><small>{item.category[0].toUpperCase() + item.category.slice(1)}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        {tab === "create" && (
          <section aria-labelledby="create-title">
            {editingOutfitId && <button className="editor-back" onClick={cancelEdit}><span aria-hidden="true">←</span> Back to saved looks</button>}
            <div className="create-heading"><div><p className="eyebrow">{editingOutfitId ? "Edit saved look" : "Build a look"}</p><h1 id="create-title">{editingOutfitId ? "Refine your fit" : "Swipe to style"}</h1></div>{builderMode === "build" && !editingOutfitId && <button className="text-button" onClick={resetBuilder}>Start over</button>}</div>
            {!editingOutfitId && <div className="mode-switcher" aria-label="Creation mode"><button className={builderMode === "build" ? "active" : ""} onClick={() => setBuilderMode("build")}>Build</button><button className={builderMode === "deck" ? "active" : ""} onClick={() => setBuilderMode("deck")}>Style Deck</button></div>}
            {builderMode === "build" && <><div className="template-switcher" aria-label="Outfit template">
              {(["separates", "one-piece"] as const).map((template) => <button key={template} className={outfitTemplate === template ? "active" : ""} onClick={() => chooseTemplate(template)}>{template === "separates" ? "Top + bottom" : "Dress / one-piece"}</button>)}
            </div>
            <div className="look-stage">
              <div className="look-number">{editingOutfitId ? "EDITING" : "DRAFT"} · {chosenItems.length} PIECES</div>
              <div className={`outfit-canvas template-${outfitTemplate}`}>
                {slots.filter((slot) => outfitTemplate === "one-piece" ? !["top", "bottom"].includes(slot) : slot !== "one-piece").map((slot) => {
                  const item = savedItems.find((candidate) => candidate.id === look[slot]);
                  return <button key={slot} className={`look-piece ${slot} ${activeSlot === slot ? "selected" : ""} ${item ? "filled" : "empty"}`} onClick={() => setActiveSlot(slot)} aria-label={`Choose ${slot}`}>
                    {item ? <img src={item.imageUrl} alt={item.label} /> : <><b>+</b><span>{slot}</span></>}
                  </button>;
                })}
              </div>
            </div>
            <div className="builder-panel">
              <div className="panel-heading"><div><p className="eyebrow">Choose your</p><h2>{activeSlot}</h2></div><span>Swipe</span></div>
              <div className="choice-rail">
                {choices.map((item) => (
                  <button key={item.id} className={look[activeSlot] === item.id ? "choice-card active" : "choice-card"} onClick={() => setLook((current) => activeSlot === "one-piece" ? { ...current, top: undefined, bottom: undefined, "one-piece": item.id } : activeSlot === "top" || activeSlot === "bottom" ? { ...current, "one-piece": undefined, [activeSlot]: item.id } : { ...current, [activeSlot]: item.id })}>
                    <img src={item.imageUrl} alt="" /><span>{item.label}</span>
                  </button>
                ))}
                {choices.length === 0 && <div className="choice-empty"><strong>No {slotCategory[activeSlot]} yet.</strong><span>Add one from your closet first.</span><button onClick={() => { setTab("closet"); setPhotoLabOpen(true); }}>Add piece</button></div>}
              </div>
              {chosenItems.length >= 2 && <div className="outfit-details"><label className="outfit-name">Look name<input value={outfitName} maxLength={60} onChange={(event) => setOutfitName(event.target.value)} placeholder="Tuesday layers" /></label><label className="outfit-note">Private note <span>optional</span><textarea value={outfitNote} maxLength={500} onChange={(event) => setOutfitNote(event.target.value)} placeholder="When to wear it, styling ideas…" /></label></div>}
              {outfitMessage && <p className="form-error" role="alert">{outfitMessage}</p>}
              <button className="primary-button" disabled={chosenItems.length < 2 || savingOutfit} onClick={saveOutfit}>{savingOutfit ? "Saving privately…" : chosenItems.length < 2 ? `Choose ${2 - chosenItems.length} more piece${chosenItems.length === 0 ? "s" : ""}` : editingOutfitId ? "Save changes" : "Save this look"} <Icon name="arrow" /></button>
            </div>
            </>}
            {builderMode === "deck" && <div className="style-deck">
              {deckItems.length >= 2 ? <><div className="deck-counter">REMIX {String(deckIndex + 1).padStart(2, "0")}</div><div className="deck-stack"><div className="deck-card behind"/><div className="deck-card" style={{ transform: `translateX(${dragX}px) rotate(${dragX / 24}deg)` }} onPointerDown={(event) => { dragStart.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (dragStart.current !== undefined) setDragX(event.clientX - dragStart.current); }} onPointerUp={finishDeckSwipe} onPointerCancel={() => { dragStart.current = undefined; setDragX(0); }}>
                <span className={`deck-stamp keep ${dragX > 30 ? "show" : ""}`}>KEEP</span><span className={`deck-stamp skip ${dragX < -30 ? "show" : ""}`}>SKIP</span>
                {deckItems.map(([slot, item]) => <div className={`deck-piece ${slot}`} key={slot}><img src={item.imageUrl} alt={item.label}/><small>{item.label}</small></div>)}
              </div></div><p className="deck-hint">Swipe right to keep · left to skip</p><div className="deck-actions"><button onClick={() => setDeckIndex((index) => Math.max(0, index - 1))}>↶<span>Undo</span></button><button className="skip" onClick={nextDeck}>×<span>Skip</span></button><button className="keep" onClick={keepDeck}>♥<span>Keep</span></button><button onClick={nextDeck}>⤨<span>Shuffle</span></button></div></> : <div className="closet-empty deck-empty"><p className="eyebrow">Deck needs variety</p><h2>Add a wearable pair.</h2><p>Save a top and bottom, or a one-piece plus shoes or an accessory, to start remixing.</p><button className="primary-button" onClick={() => { setTab("closet"); setPhotoLabOpen(true); }}>Add a piece</button></div>}
            </div>}
          </section>
        )}

        {tab === "outfits" && (
          <section aria-labelledby="outfits-title">
            <div className="hero-row"><div><p className="eyebrow">Your combinations</p><h1 id="outfits-title">Saved looks</h1></div><span className="count-badge">{String(savedOutfits.length).padStart(2, "0")}</span></div>
            {outfitMessage && <p className="form-error closet-message" role="alert">{outfitMessage}</p>}
            {shareMessage && <p className="form-success closet-message" role="status">{shareMessage}</p>}
            {shareUrl && <div className="share-fallback"><input aria-label="Public outfit link" readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} /><a href={shareUrl} target="_blank" rel="noreferrer">Open link</a></div>}
            {!outfitMessage && savedOutfits.length === 0 && <div className="closet-empty outfits-empty"><p className="eyebrow">No looks yet</p><h2>Build your first outfit.</h2><p>Choose two or more pieces you already own and save the combination here.</p><button className="primary-button" onClick={() => setTab("create")}>Create a look</button></div>}
            <div className="looks-list">
              {savedOutfits.map((outfit) => (
                <article className="saved-look" key={outfit.id}>
                  <button className="saved-look-open" onClick={() => editOutfit(outfit)} aria-label={`Edit ${outfit.name}`}><div className="saved-preview real-preview">
                    {outfit.outfit_items.map(({ clothing_item_id }) => {
                      const item = savedItems.find((candidate) => candidate.id === clothing_item_id);
                      return item ? <img key={clothing_item_id} src={item.imageUrl} alt="" /> : null;
                    })}
                  </div>
                  <div className="saved-copy"><small>{new Intl.DateTimeFormat("en", { day: "2-digit", month: "short" }).format(new Date(outfit.created_at)).toUpperCase()}</small><h2>{outfit.name}</h2><p>{outfit.note || `${outfit.outfit_items.length} pieces`}</p></div></button>
                  <div className="look-actions"><button onClick={() => editOutfit(outfit)}>Edit</button><button disabled={sharingId === outfit.id} onClick={() => shareOutfit(outfit)}>{sharingId === outfit.id ? "…" : "Share"}</button><button disabled={sharingId === outfit.id} onClick={() => revokeShare(outfit.id)}>Revoke</button><button className="delete-look" disabled={sharingId === outfit.id} onClick={() => deleteOutfit(outfit)}>Delete</button></div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      {!editingOutfitId && <nav className="bottom-nav" aria-label="Main navigation">
        <button className={tab === "closet" ? "active" : ""} onClick={() => setTab("closet")}><span className="nav-icon"><Icon name="closet" /></span><span>Closet</span></button>
        <button className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}><span className="nav-icon"><Icon name="spark" /></span><span>Create</span></button>
        <button className={tab === "outfits" ? "active" : ""} onClick={() => setTab("outfits")}><span className="nav-icon"><Icon name="looks" /></span><span>Outfits</span></button>
      </nav>}
      <PhotoLab open={photoLabOpen} onClose={() => setPhotoLabOpen(false)} onSaved={loadSavedItems} />
      {selectedItem && <ItemDetailSheet item={selectedItem} onClose={() => setSelectedItem(undefined)} onChanged={async () => { await loadSavedItems(); await loadSavedOutfits(); }} />}
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} onAvatar={setAvatarUrl} />
    </main>
  );
}
