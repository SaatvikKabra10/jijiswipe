"use client";

import { useState } from "react";
import { PhotoLab } from "@/components/photo-lab";

type Tab = "closet" | "create" | "outfits";
type Category = "Tops" | "Bottoms" | "Outerwear" | "Shoes" | "Accessories";

type ClosetItem = {
  id: number;
  name: string;
  category: Category;
  color: string;
  shape: "tee" | "shirt" | "pants" | "jacket" | "shoe" | "bag";
};

const closet: ClosetItem[] = [
  { id: 1, name: "Boxy blue tee", category: "Tops", color: "#2864f0", shape: "tee" },
  { id: 2, name: "Ivory knit", category: "Tops", color: "#e9e2d4", shape: "shirt" },
  { id: 3, name: "Washed black tee", category: "Tops", color: "#34363b", shape: "tee" },
  { id: 4, name: "Wide-leg denim", category: "Bottoms", color: "#6384b3", shape: "pants" },
  { id: 5, name: "Black trousers", category: "Bottoms", color: "#24262b", shape: "pants" },
  { id: 6, name: "Cropped bomber", category: "Outerwear", color: "#7d846d", shape: "jacket" },
  { id: 7, name: "Blue overshirt", category: "Outerwear", color: "#345ea8", shape: "jacket" },
  { id: 8, name: "Retro runners", category: "Shoes", color: "#d8d1c5", shape: "shoe" },
  { id: 9, name: "Black loafers", category: "Shoes", color: "#292a2e", shape: "shoe" },
  { id: 10, name: "Silver shoulder bag", category: "Accessories", color: "#9fa4ad", shape: "bag" },
];

const categories = ["All", "Tops", "Bottoms", "Outerwear", "Shoes", "Accessories"] as const;

const initialLook = {
  top: closet[0],
  bottom: closet[3],
  outerwear: closet[5],
  shoes: closet[7],
  accessory: closet[9],
};

function Garment({ item, small = false }: { item: ClosetItem; small?: boolean }) {
  return (
    <div className={`garment garment-${item.shape} ${small ? "garment-small" : ""}`} style={{ "--garment": item.color } as React.CSSProperties}>
      <span className="sr-only">{item.name}</span>
    </div>
  );
}

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
  const [look, setLook] = useState(initialLook);
  const [activeSlot, setActiveSlot] = useState<"top" | "bottom" | "outerwear" | "shoes" | "accessory">("top");
  const [photoLabOpen, setPhotoLabOpen] = useState(false);

  const filtered = filter === "All" ? closet : closet.filter((item) => item.category === filter);
  const slotCategory: Record<typeof activeSlot, Category> = {
    top: "Tops", bottom: "Bottoms", outerwear: "Outerwear", shoes: "Shoes", accessory: "Accessories",
  };
  const choices = closet.filter((item) => item.category === slotCategory[activeSlot]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="wordmark" onClick={() => setTab("closet")} aria-label="JijiSwipe home">jiji<span>swipe</span></button>
        <button className="profile-button" aria-label="Open profile"><Icon name="user" /></button>
      </header>

      <div className="screen">
        {tab === "closet" && (
          <section aria-labelledby="closet-title">
            <div className="hero-row">
              <div><p className="eyebrow">Your wardrobe</p><h1 id="closet-title">The closet</h1></div>
              <button className="add-button" onClick={() => setPhotoLabOpen(true)}><Icon name="plus" /> Add item</button>
            </div>
            <div className="stats"><span><strong>10</strong> pieces</span><span><strong>3</strong> saved looks</span></div>
            <div className="filter-row" aria-label="Filter closet">
              {categories.map((category) => <button key={category} className={filter === category ? "active" : ""} onClick={() => setFilter(category)}>{category}</button>)}
            </div>
            <div className="closet-grid">
              {filtered.map((item) => (
                <button className="item-card" key={item.id}>
                  <div className="item-image"><Garment item={item} /></div>
                  <span>{item.name}</span><small>{item.category}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        {tab === "create" && (
          <section aria-labelledby="create-title">
            <div className="create-heading"><div><p className="eyebrow">Build a look</p><h1 id="create-title">Swipe to style</h1></div><button className="text-button">Start over</button></div>
            <div className="look-stage">
              <div className="look-number">LOOK 001</div>
              <div className="outfit-canvas">
                <button className={`look-piece outerwear ${activeSlot === "outerwear" ? "selected" : ""}`} onClick={() => setActiveSlot("outerwear")}><Garment item={look.outerwear} small /></button>
                <button className={`look-piece top ${activeSlot === "top" ? "selected" : ""}`} onClick={() => setActiveSlot("top")}><Garment item={look.top} small /></button>
                <button className={`look-piece bottom ${activeSlot === "bottom" ? "selected" : ""}`} onClick={() => setActiveSlot("bottom")}><Garment item={look.bottom} small /></button>
                <button className={`look-piece shoes ${activeSlot === "shoes" ? "selected" : ""}`} onClick={() => setActiveSlot("shoes")}><Garment item={look.shoes} small /></button>
                <button className={`look-piece accessory ${activeSlot === "accessory" ? "selected" : ""}`} onClick={() => setActiveSlot("accessory")}><Garment item={look.accessory} small /></button>
              </div>
            </div>
            <div className="builder-panel">
              <div className="panel-heading"><div><p className="eyebrow">Choose your</p><h2>{activeSlot}</h2></div><span>Swipe</span></div>
              <div className="choice-rail">
                {choices.map((item) => (
                  <button key={item.id} className={look[activeSlot].id === item.id ? "choice-card active" : "choice-card"} onClick={() => setLook({ ...look, [activeSlot]: item })}>
                    <Garment item={item} /><span>{item.name}</span>
                  </button>
                ))}
              </div>
              <button className="primary-button">Save this look <Icon name="arrow" /></button>
            </div>
          </section>
        )}

        {tab === "outfits" && (
          <section aria-labelledby="outfits-title">
            <div className="hero-row"><div><p className="eyebrow">Your combinations</p><h1 id="outfits-title">Saved looks</h1></div><span className="count-badge">03</span></div>
            <div className="looks-list">
              {["Tuesday layers", "Blue hour", "Easy weekend"].map((name, index) => (
                <button className="saved-look" key={name}>
                  <div className={`saved-preview preview-${index + 1}`}>
                    <Garment item={closet[index]} small /><Garment item={closet[index + 3]} small /><Garment item={closet[index + 7]} small />
                  </div>
                  <div className="saved-copy"><small>0{index + 1} / AUG</small><h2>{name}</h2><p>{index === 0 ? "5 pieces" : "3 pieces"}</p></div>
                  <Icon name="arrow" />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <nav className="bottom-nav" aria-label="Main navigation">
        <button className={tab === "closet" ? "active" : ""} onClick={() => setTab("closet")}><span className="nav-icon"><Icon name="closet" /></span><span>Closet</span></button>
        <button className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}><span className="nav-icon"><Icon name="spark" /></span><span>Create</span></button>
        <button className={tab === "outfits" ? "active" : ""} onClick={() => setTab("outfits")}><span className="nav-icon"><Icon name="looks" /></span><span>Outfits</span></button>
      </nav>
      <PhotoLab open={photoLabOpen} onClose={() => setPhotoLabOpen(false)} />
    </main>
  );
}
