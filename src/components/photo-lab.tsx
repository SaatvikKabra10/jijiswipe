"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { heicTo, isHeic } from "heic-to/csp";
import { createClient } from "@/lib/supabase/client";
import { centsFromPrice, clothingCategories, clothingColors, currencies, formalities, garmentTypes, seasons, titleCase, warmthLevels, type ClothingCategory } from "@/lib/clothing-metadata";

type Props = { open: boolean; onClose: () => void; onSaved: () => void | Promise<void> };
type Stage = "guide" | "crop" | "processing" | "result" | "error";

const MAX_BYTES = 25 * 1024 * 1024;
const accepted = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function randomId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

async function croppedBlob(source: string, area: Area, rotation: number) {
  const image = new Image();
  image.src = source;
  await image.decode();
  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const width = image.width * cos + image.height * sin;
  const height = image.width * sin + image.height * cos;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare this photo.");
  context.translate(width / 2, height / 2);
  context.rotate(radians);
  context.drawImage(image, -image.width / 2, -image.height / 2);
  const output = document.createElement("canvas");
  const scale = Math.min(1, 1600 / Math.max(area.width, area.height));
  output.width = Math.round(area.width * scale);
  output.height = Math.round(area.height * scale);
  const outputContext = output.getContext("2d");
  if (!outputContext) throw new Error("Your browser could not crop this photo.");
  outputContext.drawImage(canvas, area.x, area.y, area.width, area.height, 0, 0, output.width, output.height);
  return new Promise<Blob>((resolve, reject) => output.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Photo export failed.")), "image/webp", .9));
}

async function uploadReadyBlob(blob: Blob) {
  if (blob.size <= 590 * 1024) return blob;
  const bitmap = await createImageBitmap(blob);
  try {
    for (const scale of [1, .9, .8, .7, .6, .5, .4, .3, .25]) {
      for (const quality of [.86, .74, .62, .5]) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Your browser could not resize this cutout.");
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const output = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
        if (output && output.size <= 590 * 1024) return output;
      }
    }
    throw new Error("This browser could not prepare the cutout for upload. Try restarting Safari.");
  } finally { bitmap.close(); }
}

export function PhotoLab({ open, onClose, onSaved }: Props) {
  const [stage, setStage] = useState<Stage>("guide");
  const [source, setSource] = useState<string>();
  const [result, setResult] = useState<string>();
  const [resultBlob, setResultBlob] = useState<Blob>();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [area, setArea] = useState<Area>();
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [modelReady, setModelReady] = useState(false);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<ClothingCategory>("tops");
  const [itemType, setItemType] = useState(garmentTypes.tops[0]);
  const [primaryColor, setPrimaryColor] = useState<(typeof clothingColors)[number]>("black");
  const [formality, setFormality] = useState<(typeof formalities)[number]>("casual");
  const [warmth, setWarmth] = useState<(typeof warmthLevels)[number]>("midweight");
  const [itemSeasons, setItemSeasons] = useState<(typeof seasons)[number][]>([]);
  const [brand, setBrand] = useState("");
  const [pricePaid, setPricePaid] = useState("");
  const [currency, setCurrency] = useState<(typeof currencies)[number]>("USD");
  const [purchasedOn, setPurchasedOn] = useState("");
  const [material, setMaterial] = useState<string | null>(null);
  const [pattern, setPattern] = useState<string | null>(null);
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = useCallback(() => {
    if (source) URL.revokeObjectURL(source);
    if (result) URL.revokeObjectURL(result);
    setSource(undefined); setResult(undefined); setResultBlob(undefined); setStage("guide"); setProgress(0); setRotation(0); setZoom(1); setCrop({ x: 0, y: 0 }); setLabel(""); setCategory("tops"); setItemType(garmentTypes.tops[0]); setPrimaryColor("black"); setFormality("casual"); setWarmth("midweight"); setItemSeasons([]); setBrand(""); setPricePaid(""); setCurrency("USD"); setPurchasedOn(""); setMaterial(null); setPattern(null); setStyleTags([]); setAnalyzing(false); setAnalysisMessage(""); setSaving(false); setMessage("");
  }, [source, result]);

  useEffect(() => () => { if (source) URL.revokeObjectURL(source); if (result) URL.revokeObjectURL(result); }, [source, result]);
  useEffect(() => {
    if (!open || modelReady) return;
    let active = true;
    import("@imgly/background-removal")
      .then(({ preload }) => preload({ model: "isnet_quint8", device: "cpu" }))
      .then(() => { if (active) setModelReady(true); })
      .catch(() => { /* Processing will surface a useful error if preload also fails there. */ });
    return () => { active = false; };
  }, [open, modelReady]);
  if (!open) return null;

  async function choose(file?: File) {
    if (!file) return;
    try {
      if (file.size > MAX_BYTES) throw new Error("Choose a photo smaller than 25 MB.");
      const heic = await isHeic(file);
      if (!heic && !accepted.includes(file.type)) throw new Error("Choose a JPEG, PNG, WebP, HEIC, or HEIF photo.");
      const blob = heic ? await heicTo({ blob: file, type: "image/jpeg", quality: .92 }) : file;
      if (source) URL.revokeObjectURL(source);
      setSource(URL.createObjectURL(blob)); setStage("crop"); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "This photo could not be opened."); setStage("error"); }
  }

  async function process() {
    if (!source || !area) return;
    try {
      setStage("processing"); setProgress(2);
      const input = await croppedBlob(source, area, rotation);
      const { removeBackground } = await import("@imgly/background-removal");
      const output = await removeBackground(input, {
        model: "isnet_quint8", device: "cpu", output: { format: "image/webp", quality: .9 },
        progress: (_key, current, total) => setProgress(total ? Math.max(3, Math.round((current / total) * 100)) : 3),
      });
      const ready = await uploadReadyBlob(output);
      setResultBlob(ready); setResult(URL.createObjectURL(ready)); setProgress(100); setStage("result"); void analyze(ready);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Background removal failed."); setStage("error"); }
  }

  async function analyze(blob: Blob) {
    setAnalyzing(true); setAnalysisMessage("Reading the garment…");
    try {
      const form = new FormData();
      form.set("image", blob, `cutout.${blob.type === "image/png" ? "png" : "webp"}`);
      const response = await fetch("/api/ai/tag-clothing", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Auto-fill is temporarily unavailable.");
      const metadata = result.metadata;
      const nextCategory = metadata.category as ClothingCategory;
      setLabel((current) => current.trim() ? current : metadata.proposed_name);
      setCategory(nextCategory); setItemType(garmentTypes[nextCategory].includes(metadata.item_type) ? metadata.item_type : "other");
      setPrimaryColor(metadata.primary_color); setFormality(metadata.formality); setWarmth(metadata.warmth); setItemSeasons(metadata.seasons);
      setMaterial(metadata.material); setPattern(metadata.pattern); setStyleTags(metadata.style_tags);
      setAnalysisMessage(metadata.confidence === "low" ? "Suggestions added with low confidence. Please review them." : "Suggestions added. Change anything that looks wrong.");
    } catch (error) { setAnalysisMessage(error instanceof Error ? error.message : "Auto-fill is temporarily unavailable. Enter details manually."); }
    finally { setAnalyzing(false); }
  }

  async function save() {
    if (!resultBlob || !label.trim()) { setMessage("Give this piece a name before saving."); return; }
    setSaving(true); setMessage("");
    const supabase = createClient();
    let path = "";
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error("Your session expired. Sign in again and retry.");
      const user = session.user;
      const contentType = resultBlob.type === "image/png" ? "image/png" : "image/webp";
      const extension = contentType === "image/png" ? "png" : "webp";
      path = `${user.id}/${randomId()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("clothing").upload(path, resultBlob, { contentType, upsert: false });
      if (uploadError) throw uploadError;
      const aiAssisted = Boolean(styleTags.length || material || pattern);
      const { error: insertError } = await supabase.from("clothing_items").insert({ owner_id: user.id, label: label.trim(), category, storage_path: path, item_type: itemType, primary_color: primaryColor, formality, warmth, seasons: itemSeasons, material, pattern, style_tags: styleTags, brand: brand.trim() || null, purchase_price_cents: centsFromPrice(pricePaid), purchase_currency: currency, purchased_on: purchasedOn || null, metadata_source: aiAssisted ? "ai" : "manual", analysis_model: aiAssisted ? "gpt-5.6-luna" : null, metadata_confirmed_at: new Date().toISOString() });
      if (insertError) { await supabase.storage.from("clothing").remove([path]); throw insertError; }
      await onSaved(); reset(); onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "This piece could not be saved.");
    } finally { setSaving(false); }
  }

  return (
    <div className="lab-backdrop" role="dialog" aria-modal="true" aria-label="Add clothing photo">
      <section className="photo-lab">
        <header><button onClick={() => { reset(); onClose(); }} aria-label="Close photo lab">×</button><strong>Add a piece</strong><span>LOCAL</span></header>
        {stage === "result" && <div className={`analysis-status ${analyzing ? "working" : ""}`} role="status"><span>{analyzing ? "✦" : "✓"}</span><p><strong>{analyzing ? "Auto-filling details" : "AI-assisted details"}</strong>{analysisMessage}</p></div>}
        {stage === "guide" && <div className="lab-body guide"><p className="eyebrow">Better photo, better cutout</p><h2>Keep it clean.</h2><div className="photo-guide"><div className="guide-shirt">✦</div></div><ul><li>Use one item and a plain background</li><li>Frame the full piece from straight above</li><li>Use bright, even light with minimal shadows</li></ul><label className="primary-button">Choose photo<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={(event) => choose(event.target.files?.[0])} /></label><small>{modelReady ? "Cutout engine ready · photo stays on this device." : "Preparing cutout engine · photo stays on this device."}</small></div>}
        {stage === "crop" && source && <div className="lab-body crop-stage"><div className="crop-area"><Cropper image={source} crop={crop} zoom={zoom} rotation={rotation} aspect={4 / 5} onCropChange={setCrop} onZoomChange={setZoom} onRotationChange={setRotation} onCropComplete={(_percent, pixels) => setArea(pixels)} /></div><div className="crop-controls"><label>Zoom<input type="range" min="1" max="3" step=".05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label><button onClick={() => setRotation((rotation + 90) % 360)}>Rotate 90°</button><button className="primary-button" onClick={process}>Remove background</button></div></div>}
        {stage === "processing" && <div className="lab-body processing"><div className="spinner"/><p className="eyebrow">Working on your phone</p><h2>Cutting it out…</h2><div className="progress"><i style={{ width: `${progress}%` }}/></div><p>{progress < 10 ? "Downloading the model may take a minute the first time." : `${progress}% complete`}</p></div>}
        {stage === "result" && result && <div className="lab-body result"><p className="eyebrow">Preview</p><h2>Save this piece.</h2><div className="result-image">{/* A temporary local blob cannot use Next Image optimization. */}<img src={result} alt="Background-removed clothing preview" /></div><div className="item-fields"><label>Item name<input value={label} maxLength={60} onChange={(event) => setLabel(event.target.value)} placeholder="Blue boxy tee" /></label><label>Category<select value={category} onChange={(event) => { const next = event.target.value as ClothingCategory; setCategory(next); setItemType(garmentTypes[next][0]); }}>{clothingCategories.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label></div><details className="metadata-details" open><summary>Recommendation details <span>helps JijiSwipe style it</span></summary><div className="metadata-grid"><label>Garment type<select value={itemType} onChange={(event) => setItemType(event.target.value)}>{garmentTypes[category].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label><label>Color<select value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value as typeof primaryColor)}>{clothingColors.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label><label>Dress code<select value={formality} onChange={(event) => setFormality(event.target.value as typeof formality)}>{formalities.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label><label>Weight<select value={warmth} onChange={(event) => setWarmth(event.target.value as typeof warmth)}>{warmthLevels.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label></div><fieldset className="season-picker"><legend>Good for</legend>{seasons.map((value) => <button type="button" className={itemSeasons.includes(value) ? "selected" : ""} key={value} onClick={() => setItemSeasons((current) => current.includes(value) ? current.filter((season) => season !== value) : [...current, value])}>{titleCase(value)}</button>)}</fieldset><div className="ownership-fields"><label>Brand<input value={brand} maxLength={60} onChange={(event) => setBrand(event.target.value)} placeholder="Optional" /></label><label>Price paid<span className="price-input"><select aria-label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value as typeof currency)}>{currencies.map((value) => <option key={value}>{value}</option>)}</select><input inputMode="decimal" type="number" min="0" step="0.01" value={pricePaid} onChange={(event) => setPricePaid(event.target.value)} placeholder="0.00" /></span></label><label>Purchase date<input type="date" max={new Date().toISOString().slice(0, 10)} value={purchasedOn} onChange={(event) => setPurchasedOn(event.target.value)} /></label></div></details>{message && <p className="form-error" role="alert">{message}</p>}<button className="primary-button" disabled={saving} onClick={save}>{saving ? "Saving privately…" : "Save to closet"}</button><button className="secondary-button" disabled={saving} onClick={() => setStage("crop")}>Adjust and retry</button><button className="text-button" disabled={saving} onClick={reset}>Choose another photo</button></div>}
        {stage === "error" && <div className="lab-body processing"><p className="eyebrow">Couldn’t process</p><h2>Try another photo.</h2><p>{message}</p><button className="primary-button" onClick={reset}>Back to photo tips</button></div>}
      </section>
    </div>
  );
}
