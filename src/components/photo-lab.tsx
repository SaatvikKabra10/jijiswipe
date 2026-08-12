"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { heicTo, isHeic } from "heic-to/csp";

type Props = { open: boolean; onClose: () => void };
type Stage = "guide" | "crop" | "processing" | "result" | "error";

const MAX_BYTES = 25 * 1024 * 1024;
const accepted = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

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

export function PhotoLab({ open, onClose }: Props) {
  const [stage, setStage] = useState<Stage>("guide");
  const [source, setSource] = useState<string>();
  const [result, setResult] = useState<string>();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [area, setArea] = useState<Area>();
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [modelReady, setModelReady] = useState(false);

  const reset = useCallback(() => {
    if (source) URL.revokeObjectURL(source);
    if (result) URL.revokeObjectURL(result);
    setSource(undefined); setResult(undefined); setStage("guide"); setProgress(0); setRotation(0); setZoom(1); setCrop({ x: 0, y: 0 });
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
      setResult(URL.createObjectURL(output)); setProgress(100); setStage("result");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Background removal failed."); setStage("error"); }
  }

  return (
    <div className="lab-backdrop" role="dialog" aria-modal="true" aria-label="Add clothing photo">
      <section className="photo-lab">
        <header><button onClick={() => { reset(); onClose(); }} aria-label="Close photo lab">×</button><strong>Add a piece</strong><span>LOCAL</span></header>
        {stage === "guide" && <div className="lab-body guide"><p className="eyebrow">Better photo, better cutout</p><h2>Keep it clean.</h2><div className="photo-guide"><div className="guide-shirt">✦</div></div><ul><li>Use one item and a plain background</li><li>Frame the full piece from straight above</li><li>Use bright, even light with minimal shadows</li></ul><label className="primary-button">Choose photo<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={(event) => choose(event.target.files?.[0])} /></label><small>{modelReady ? "Cutout engine ready · photo stays on this device." : "Preparing cutout engine · photo stays on this device."}</small></div>}
        {stage === "crop" && source && <div className="lab-body crop-stage"><div className="crop-area"><Cropper image={source} crop={crop} zoom={zoom} rotation={rotation} aspect={4 / 5} onCropChange={setCrop} onZoomChange={setZoom} onRotationChange={setRotation} onCropComplete={(_percent, pixels) => setArea(pixels)} /></div><div className="crop-controls"><label>Zoom<input type="range" min="1" max="3" step=".05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label><button onClick={() => setRotation((rotation + 90) % 360)}>Rotate 90°</button><button className="primary-button" onClick={process}>Remove background</button></div></div>}
        {stage === "processing" && <div className="lab-body processing"><div className="spinner"/><p className="eyebrow">Working on your phone</p><h2>Cutting it out…</h2><div className="progress"><i style={{ width: `${progress}%` }}/></div><p>{progress < 10 ? "Downloading the model may take a minute the first time." : `${progress}% complete`}</p></div>}
        {stage === "result" && result && <div className="lab-body result"><p className="eyebrow">Preview</p><h2>How does it look?</h2><div className="result-image">{/* A temporary local blob cannot use Next Image optimization. */}<img src={result} alt="Background-removed clothing preview" /></div><button className="primary-button" onClick={() => alert("Saving comes in Milestone 4. For now, judge the cutout quality.")}>Approve cutout</button><button className="secondary-button" onClick={() => setStage("crop")}>Adjust and retry</button><button className="text-button" onClick={reset}>Choose another photo</button></div>}
        {stage === "error" && <div className="lab-body processing"><p className="eyebrow">Couldn’t process</p><h2>Try another photo.</h2><p>{message}</p><button className="primary-button" onClick={reset}>Back to photo tips</button></div>}
      </section>
    </div>
  );
}
