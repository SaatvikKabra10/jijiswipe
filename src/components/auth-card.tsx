"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "join" | "signin" | "password";

export function AuthCard({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const values = new FormData(event.currentTarget);
    try {
      if (mode === "join") {
        const response = await fetch("/api/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: values.get("displayName"), email: values.get("email"), inviteCode: values.get("inviteCode") }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not request invitation.");
        setMessage(result.message);
      } else if (mode === "signin") {
        const { error: signInError } = await createClient().auth.signInWithPassword({ email: String(values.get("email")), password: String(values.get("password")) });
        if (signInError) throw signInError;
        router.replace("/"); router.refresh();
      } else {
        const password = String(values.get("password"));
        if (password !== String(values.get("confirmPassword"))) throw new Error("Passwords do not match.");
        if (password.length < 10) throw new Error("Use at least 10 characters.");
        const { error: passwordError } = await createClient().auth.updateUser({ password });
        if (passwordError) throw passwordError;
        setMessage("Password saved. Opening your closet…");
        setTimeout(() => { router.replace("/"); router.refresh(); }, 700);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Something went wrong."); }
    finally { setBusy(false); }
  }

  const content = {
    join: { eyebrow: "Private beta", title: "Join JijiSwipe", copy: "Use the code shared with you. We’ll email a secure link to set your password.", action: "Request invitation" },
    signin: { eyebrow: "Welcome back", title: "Open your closet", copy: "Sign in with the email and password you set from your invitation.", action: "Sign in" },
    password: { eyebrow: "Invitation accepted", title: "Set your password", copy: "Use at least 10 characters. JijiSwipe and Supabase never store the readable password.", action: "Finish account" },
  }[mode];

  return <main className="auth-page"><section className="auth-card"><Link className="auth-brand" href="/">jiji<span>swipe</span></Link><p className="eyebrow">{content.eyebrow}</p><h1>{content.title}</h1><p className="auth-copy">{content.copy}</p><form onSubmit={submit}>
    {mode === "join" && <label>Display name<input name="displayName" autoComplete="name" minLength={1} maxLength={40} required placeholder="How friends know you" /></label>}
    {mode !== "password" && <label>Email<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>}
    {mode === "join" && <label>Invite code<input name="inviteCode" type="password" autoComplete="off" required placeholder="Shared by the owner" /></label>}
    {mode === "signin" && <label>Password<input name="password" type="password" autoComplete="current-password" minLength={10} required /></label>}
    {mode === "password" && <><label>New password<input name="password" type="password" autoComplete="new-password" minLength={10} required /></label><label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required /></label></>}
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
    <button className="primary-button" disabled={busy}>{busy ? "Working…" : content.action}</button>
  </form>{mode === "join" && <p className="auth-switch">Already joined? <Link href="/sign-in">Sign in</Link></p>}{mode === "signin" && <p className="auth-switch">Have an invite code? <Link href="/join">Join the beta</Link></p>}</section></main>;
}
