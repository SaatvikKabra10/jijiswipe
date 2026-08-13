"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { heicTo, isHeic } from "heic-to/csp";
import { createClient } from "@/lib/supabase/client";
import { centsFromPrice, clothingCategories, clothingColors, currencies, formalities, garmentTypes, seasons, titleCase, warmthLevels, type ClothingCategory } from "@/lib/clothing-metadata";
import { addImportJobs, listImportJobs, removeImportJob, type ImportQueueJob } from "@/lib/import-queue";

type Props = { open: boolean; onClose: () => void; onSaved: () => void | Promise<void> };
type Stage = "guide" | "crop" | "processing" | "batch-processing" | "result" | "error";
type AiMetadata = {
  proposed_name: string;
  category: ClothingCategory;
  item_type: string;
  primary_color: (typeof clothingColors)[number];
  formality: (typeof formalities)[number];
  warmth: (typeof warmthLevels)[number];
  seasons: (typeof seasons)[number][];
  material: string | null;
  pattern: string | null;
  style_tags: string[];
  confidence: "low" | "medium" | "high";
};

const MAX_BYTES = 25 * 1024 * 1024;
const accepted = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_BATCH = 20;

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

async function trimTransparentBlob(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  try {
    const scan = document.createElement("canvas");
    scan.width = bitmap.width; scan.height = bitmap.height;
    const context = scan.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("This cutout could not be aligned.");
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, scan.width, scan.height).data;
    let left = scan.width; let top = scan.height; let right = -1; let bottom = -1;
    for (let y = 0; y < scan.height; y += 1) {
      for (let x = 0; x < scan.width; x += 1) {
        if (pixels[(y * scan.width + x) * 4 + 3] <= 8) continue;
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    if (right < left || bottom < top) throw new Error("No garment was found in this cutout.");
    const width = right - left + 1; const height = bottom - top + 1;
    const padding = Math.max(18, Math.round(Math.max(width, height) * .07));
    const output = document.createElement("canvas");
    output.width = width + padding * 2; output.height = height + padding * 2;
    output.getContext("2d")?.drawImage(bitmap, left, top, width, height, padding, padding, width, height);
    return await new Promise<Blob>((resolve, reject) => output.toBlob((result) => result ? resolve(result) : reject(new Error("Cutout export failed.")), "image/webp", .9));
  } finally { bitmap.close(); }
}

async function prepareWholePhoto(blob: Blob) {
  const source = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This photo could not be prepared.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((output) => output ? resolve(output) : reject(new Error("Photo export failed.")), "image/webp", .9));
  } finally { URL.revokeObjectURL(source); }
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
  const [queue, setQueue] = useState<ImportQueueJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string>();
  const [batchCurrent, setBatchCurrent] = useState(0);
  const [batchSaved, setBatchSaved] = useState(0);

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
  useEffect(() => {
    if (!open) return;
    let active = true;
    listImportJobs()
      .then((jobs) => { if (active) setQueue(jobs); })
      .catch(() => { if (active) setMessage("Your saved import queue could not be opened on this device."); });
    return () => { active = false; };
  }, [open]);
  if (!open) return null;

  async function openJob(job: ImportQueueJob) {
    try {
      const queuedFile = new File([job.blob], job.name, { type: job.blob.type });
      const heic = await isHeic(queuedFile);
      const blob = heic ? await heicTo({ blob: job.blob, type: "image/jpeg", quality: .92 }) : job.blob;
      if (source) URL.revokeObjectURL(source);
      setActiveJobId(job.id); setSource(URL.createObjectURL(blob)); setStage("crop"); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "This photo could not be opened."); setStage("error"); }
  }

  async function choose(files?: FileList | null, automatic = false) {
    if (!files?.length) return;
    try {
      const selected = Array.from(files);
      if (queue.length + selected.length > MAX_BATCH) throw new Error(`You can keep up to ${MAX_BATCH} photos in one import queue.`);
      for (const file of selected) {
        if (file.size > MAX_BYTES) throw new Error(`${file.name} is larger than 25 MB.`);
        const heic = await isHeic(file);
        if (!heic && !accepted.includes(file.type)) throw new Error(`${file.name} is not a supported photo.`);
      }
      const now = Date.now();
      const jobs = selected.map((file, index) => ({ id: randomId(), name: file.name, blob: file, createdAt: now + index }));
      await addImportJobs(jobs);
      const nextQueue = [...queue, ...jobs];
      setQueue(nextQueue);
      if (automatic) await processBatch(nextQueue);
      else await openJob(nextQueue[0]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "These photos could not be queued."); setStage("error"); }
  }

  async function requestMetadata(blob: Blob) {
    const form = new FormData();
    form.set("image", blob, `cutout.${blob.type === "image/png" ? "png" : "webp"}`);
    const response = await fetch("/api/ai/tag-clothing", { method: "POST", body: form });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "AI categorization is temporarily unavailable.");
    return payload.metadata as AiMetadata;
  }

  async function saveAutomatic(blob: Blob, metadata: AiMetadata) {
    const supabase = createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) throw new Error("Your session expired. Sign in again and resume the import.");
    const contentType = blob.type === "image/png" ? "image/png" : "image/webp";
    const extension = contentType === "image/png" ? "png" : "webp";
    const path = `${session.user.id}/${randomId()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("clothing").upload(path, blob, { contentType, upsert: false });
    if (uploadError) throw uploadError;
    const category = metadata.category;
    const itemType = garmentTypes[category].includes(metadata.item_type) ? metadata.item_type : "other";
    const { error: insertError } = await supabase.from("clothing_items").insert({ owner_id: session.user.id, label: metadata.proposed_name, category, storage_path: path, item_type: itemType, primary_color: metadata.primary_color, formality: metadata.formality, warmth: metadata.warmth, seasons: metadata.seasons, material: metadata.material, pattern: metadata.pattern, style_tags: metadata.style_tags, metadata_source: "ai", analysis_model: "gpt-5.6-luna", metadata_confirmed_at: null });
    if (insertError) { await supabase.storage.from("clothing").remove([path]); throw insertError; }
  }

  async function processBatch(jobs: ImportQueueJob[]) {
    setStage("batch-processing"); setBatchCurrent(0); setBatchSaved(0); setMessage("");
    let remaining = [...jobs];
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      for (let index = 0; index < jobs.length; index += 1) {
        const job = jobs[index];
        setBatchCurrent(index + 1); setProgress(2);
        const queuedFile = new File([job.blob], job.name, { type: job.blob.type });
        const heic = await isHeic(queuedFile);
        const opened = heic ? await heicTo({ blob: job.blob, type: "image/jpeg", quality: .92 }) : job.blob;
        const input = await prepareWholePhoto(opened);
        const output = await removeBackground(input, {
          model: "isnet_quint8", device: "cpu", output: { format: "image/webp", quality: .9 },
          progress: (_key, current, total) => setProgress(total ? Math.max(3, Math.round((current / total) * 80)) : 3),
        });
        const ready = await uploadReadyBlob(await trimTransparentBlob(output));
        setProgress(86);
        const metadata = await requestMetadata(ready);
        setProgress(94);
        await saveAutomatic(ready, metadata);
        await removeImportJob(job.id);
        remaining = remaining.filter((candidate) => candidate.id !== job.id);
        setQueue(remaining); setBatchSaved(index + 1); setProgress(100);
      }
      await onSaved(); reset(); setActiveJobId(undefined); onClose();
    } catch (error) {
      await onSaved();
      setQueue(remaining);
      setMessage(error instanceof Error ? error.message : "Batch import paused. Your remaining photos are safe on this device.");
      setStage("error");
    }
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
      const ready = await uploadReadyBlob(await trimTransparentBlob(output));
      setResultBlob(ready); setResult(URL.createObjectURL(ready)); setProgress(100); setStage("result"); void analyze(ready);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Background removal failed."); setStage("error"); }
  }

  async function analyze(blob: Blob) {
    setAnalyzing(true); setAnalysisMessage("Reading the garment…");
    try {
      const metadata = await requestMetadata(blob);
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
      if (activeJobId) await removeImportJob(activeJobId);
      const remaining = queue.filter((job) => job.id !== activeJobId);
      setQueue(remaining);
      await onSaved();
      reset();
      setActiveJobId(undefined);
      if (remaining.length) await openJob(remaining[0]);
      else onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "This piece could not be saved.");
    } finally { setSaving(false); }
  }

  return (
    <div className="lab-backdrop" role="dialog" aria-modal="true" aria-label="Add clothing photo">
      <section className="photo-lab">
        <header><button disabled={stage === "batch-processing"} onClick={() => { reset(); onClose(); }} aria-label="Close photo lab">×</button><strong>{queue.length > 1 ? "Batch import" : "Add a piece"}</strong><span>{queue.length ? `${queue.length} LEFT` : "LOCAL"}</span></header>
        {stage === "result" && <div className={`analysis-status ${analyzing ? "working" : ""}`} role="status"><span>{analyzing ? "✦" : "✓"}</span><p><strong>{analyzing ? "Auto-filling details" : "AI-assisted details"}</strong>{analysisMessage}</p></div>}
        {stage === "guide" && <div className="lab-body guide"><p className="eyebrow">Better photo, better cutout</p><h2>Load your closet faster.</h2><div className="photo-guide"><div className="guide-shirt">✦</div></div><ul><li>Use one item and a plain background</li><li>Batch import cuts out, categorizes, and saves automatically</li><li>Keep JijiSwipe open; review the results afterward</li></ul>{queue.length > 0 && <button className="queue-resume" onClick={() => processBatch(queue)}><strong>Resume automatic import</strong><span>{queue.length} photo{queue.length === 1 ? "" : "s"} waiting on this device</span></button>}<label className="primary-button">Import photos automatically<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={(event) => { void choose(event.target.files, true); event.currentTarget.value = ""; }} /></label><label className="secondary-upload">Add one with crop<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={(event) => { void choose(event.target.files); event.currentTarget.value = ""; }} /></label><small>{modelReady ? "Cutout engine ready · originals stay on this device." : "Preparing cutout engine · originals stay on this device."}</small></div>}
        {stage === "crop" && source && <div className="lab-body crop-stage"><div className="queue-progress"><strong>Photo {Math.max(1, queue.findIndex((job) => job.id === activeJobId) + 1)} of {Math.max(1, queue.length)}</strong><span>Crop and review each piece</span></div><div className="crop-area"><Cropper image={source} crop={crop} zoom={zoom} rotation={rotation} aspect={4 / 5} onCropChange={setCrop} onZoomChange={setZoom} onRotationChange={setRotation} onCropComplete={(_percent, pixels) => setArea(pixels)} /></div><div className="crop-controls"><label>Zoom<input type="range" min="1" max="3" step=".05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label><button onClick={() => setRotation((rotation + 90) % 360)}>Rotate 90°</button><button className="primary-button" onClick={process}>Remove background</button></div></div>}
        {stage === "processing" && <div className="lab-body processing"><div className="spinner"/><p className="eyebrow">{queue.length > 1 ? `${queue.length} photos in your queue` : "Working on your phone"}</p><h2>Cutting it out…</h2><div className="progress"><i style={{ width: `${progress}%` }}/></div><p>{progress < 10 ? "Downloading the model may take a minute the first time." : `${progress}% complete · keep JijiSwipe open`}</p></div>}
        {stage === "batch-processing" && <div className="lab-body processing batch-processing"><div className="spinner"/><p className="eyebrow">Automatic closet import</p><h2>{batchSaved} saved · {Math.max(0, queue.length)} left</h2><div className="progress"><i style={{ width: `${progress}%` }}/></div><p>Processing photo {batchCurrent}. JijiSwipe is removing the background, categorizing it, and saving it privately. Keep the app open.</p></div>}
        {stage === "result" && result && <div className="lab-body result"><p className="eyebrow">Preview</p><h2>Save this piece.</h2><div className="result-image">{/* A temporary local blob cannot use Next Image optimization. */}<img src={result} alt="Background-removed clothing preview" /></div><div className="item-fields"><label>Item name<input value={label} maxLength={60} onChange={(event) => setLabel(event.target.value)} placeholder="Blue boxy tee" /></label><label>Category<select value={category} onChange={(event) => { const next = event.target.value as ClothingCategory; setCategory(next); setItemType(garmentTypes[next][0]); }}>{clothingCategories.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label></div><details className="metadata-details" open><summary>Recommendation details <span>helps JijiSwipe style it</span></summary><div className="metadata-grid"><label>Garment type<select value={itemType} onChange={(event) => setItemType(event.target.value)}>{garmentTypes[category].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label><label>Color<select value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value as typeof primaryColor)}>{clothingColors.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label><label>Dress code<select value={formality} onChange={(event) => setFormality(event.target.value as typeof formality)}>{formalities.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label><label>Weight<select value={warmth} onChange={(event) => setWarmth(event.target.value as typeof warmth)}>{warmthLevels.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label></div><fieldset className="season-picker"><legend>Good for</legend>{seasons.map((value) => <button type="button" className={itemSeasons.includes(value) ? "selected" : ""} key={value} onClick={() => setItemSeasons((current) => current.includes(value) ? current.filter((season) => season !== value) : [...current, value])}>{titleCase(value)}</button>)}</fieldset><div className="ownership-fields"><label>Brand<input value={brand} maxLength={60} onChange={(event) => setBrand(event.target.value)} placeholder="Optional" /></label><label>Price paid<span className="price-input"><select aria-label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value as typeof currency)}>{currencies.map((value) => <option key={value}>{value}</option>)}</select><input inputMode="decimal" type="number" min="0" step="0.01" value={pricePaid} onChange={(event) => setPricePaid(event.target.value)} placeholder="0.00" /></span></label><label>Purchase date<input type="date" max={new Date().toISOString().slice(0, 10)} value={purchasedOn} onChange={(event) => setPurchasedOn(event.target.value)} /></label></div></details>{message && <p className="form-error" role="alert">{message}</p>}<button className="primary-button" disabled={saving} onClick={save}>{saving ? "Saving privately…" : "Save to closet"}</button><button className="secondary-button" disabled={saving} onClick={() => setStage("crop")}>Adjust and retry</button><button className="text-button" disabled={saving} onClick={reset}>Choose another photo</button></div>}
        {stage === "error" && <div className="lab-body processing"><p className="eyebrow">Couldn’t process</p><h2>Try another photo.</h2><p>{message}</p><button className="primary-button" onClick={reset}>Back to photo tips</button></div>}
      </section>
    </div>
  );
}
