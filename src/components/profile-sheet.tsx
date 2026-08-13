"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Profile = { displayName: string; email: string; avatarPath: string | null; avatarUrl: string };

export function ProfileSheet({ open, onClose, onAvatar }: { open: boolean; onClose: () => void; onAvatar: (url: string) => void }) {
  const [profile, setProfile] = useState<Profile>();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("display_name,avatar_path").eq("id", user.id).single();
      let avatarUrl = "";
      if (data?.avatar_path) avatarUrl = (await supabase.storage.from("avatars").createSignedUrl(data.avatar_path, 3600)).data?.signedUrl ?? "";
      if (active) { const next = { displayName: data?.display_name ?? "JijiSwipe user", email: user.email ?? "", avatarPath: data?.avatar_path ?? null, avatarUrl }; setProfile(next); setName(next.displayName); onAvatar(avatarUrl); }
    })();
    return () => { active = false; };
  }, [open, onAvatar]);

  if (!open) return null;

  async function uploadAvatar(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setMessage("Choose a JPEG, PNG, or WebP photo."); return; }
    if (file.size > 1024 * 1024) { setMessage("Choose a profile photo smaller than 1 MB."); return; }
    setBusy(true); setMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage("Your session expired."); setBusy(false); return; }
    const path = `${user.id}/avatar`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: true });
    if (uploadError) { setMessage(uploadError.message); setBusy(false); return; }
    const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
    const avatarUrl = (await supabase.storage.from("avatars").createSignedUrl(path, 3600)).data?.signedUrl ?? "";
    if (error) setMessage("Profile photo could not be saved."); else { setProfile((current) => current ? { ...current, avatarPath: path, avatarUrl } : current); onAvatar(avatarUrl); setMessage("Profile photo updated."); }
    setBusy(false);
  }

  async function saveName() {
    if (!name.trim()) { setMessage("Enter a display name."); return; }
    setBusy(true); setMessage("");
    const { error } = await createClient().from("profiles").update({ display_name: name.trim() }).eq("id", (await createClient().auth.getUser()).data.user?.id);
    setMessage(error ? "Display name could not be saved." : "Profile updated."); setBusy(false);
  }

  async function signOut() {
    setBusy(true); setMessage("");
    const { error } = await createClient().auth.signOut();
    if (error) { setMessage("Could not sign out. Check your connection and retry."); setBusy(false); return; }
    window.location.replace("/sign-in");
  }

  return <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="profile-title"><section className="detail-sheet profile-sheet"><header><button onClick={onClose} aria-label="Close profile">×</button><strong id="profile-title">Your profile</strong><span>ACCOUNT</span></header><div className="sheet-body"><div className="avatar-editor">{profile?.avatarUrl ? <img src={profile.avatarUrl} alt="Your profile"/> : <span>{(profile?.displayName ?? "J")[0].toUpperCase()}</span>}<label>{busy ? "Working…" : "Change photo"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => uploadAvatar(event.target.files?.[0])}/></label></div><label className="profile-field">Display name<input value={name} maxLength={40} onChange={(event) => setName(event.target.value)}/></label><p className="profile-email">{profile?.email}</p>{message && <p className={message.includes("updated") ? "form-success" : "form-error"} role="status">{message}</p>}<button className="primary-button" disabled={busy} onClick={saveName}>Save profile</button><aside className="install-guide"><span>APP ON YOUR PHONE</span><strong>Install JijiSwipe</strong><ol><li>Open JijiSwipe in Safari.</li><li>Tap the Share button.</li><li>Choose Add to Home Screen.</li></ol><p>It will open full-screen from your home screen like an app.</p></aside><button className="signout-button" disabled={busy} onClick={signOut}>{busy ? "Working…" : "Sign out"}</button></div></section></div>;
}
