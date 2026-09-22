"use client";

import { useState } from "react";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isSupabaseConfigured()) {
      setMessage("Qeydiyyat Supabase açarları əlavə ediləndən sonra aktiv olacaq. Demo imtahanı hesab olmadan sınaya bilərsiniz.");
      return;
    }

    setBusy(true);
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    setMessage(result.error ? result.error.message : mode === "login" ? "Uğurla daxil oldunuz." : "E-poçtunuzu təsdiqləyin.");
  }

  return (
    <div className="login-card">
      <div className="auth-tabs" role="tablist" aria-label="Hesab əməliyyatı">
        <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">Daxil ol</button>
        <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} type="button">Hesab yarat</button>
      </div>
      <form onSubmit={submit}>
        <div className="input-wrap"><Mail size={18} /><input aria-label="E-poçt" autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="E-poçt ünvanı" required type="email" value={email} /></div>
        <div className="input-wrap"><LockKeyhole size={18} /><input aria-label="Şifrə" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} onChange={(event) => setPassword(event.target.value)} placeholder="Şifrə" required type="password" value={password} /></div>
        <button className="button" disabled={busy} type="submit">{busy ? "Gözləyin…" : mode === "login" ? "Daxil ol" : "Hesab yarat"} <ArrowRight size={18} /></button>
        {message && <p className="auth-message" role="status">{message}</p>}
      </form>
      <p className="auth-note">Hesab imtahan tarixçəsini və uzunmüddətli irəliləyişi saxlamaq üçündür.</p>
    </div>
  );
}
