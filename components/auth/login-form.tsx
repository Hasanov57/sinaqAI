"use client";

import { useState } from "react";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { getSafeReturnPath } from "@/lib/auth/return-path";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

export function LoginForm({ returnTo, confirmationError = false }: { returnTo: string; confirmationError?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState(confirmationError ? "Təsdiq linki işləmədi. Yeni link istəyə bilərsiniz." : "");
  const [busy, setBusy] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  function confirmationRedirect() {
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("returnTo", getSafeReturnPath(returnTo));
    return callback.toString();
  }

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
      : await supabase.auth.signUp({ email, password, options: {
        emailRedirectTo: confirmationRedirect(),
        data: { full_name: fullName.trim() || undefined },
      } });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      if (/email not confirmed/i.test(result.error.message)) setAwaitingConfirmation(true);
      return;
    }
    if (result.data.session) {
      window.location.replace(getSafeReturnPath(returnTo));
      return;
    }
    setAwaitingConfirmation(true);
    setMessage("E-poçtunuza göndərilən linklə hesabınızı təsdiqləyin. Sonra qaldığınız yerə qayıdacaqsınız.");
  }

  async function resendConfirmation() {
    if (!email.trim()) return;
    setBusy(true);
    const { error } = await createSupabaseBrowserClient().auth.resend({
      type: "signup", email, options: { emailRedirectTo: confirmationRedirect() },
    });
    setBusy(false);
    setMessage(error ? error.message : "Yeni təsdiq linki e-poçtunuza göndərildi.");
  }

  return (
    <div className="login-card">
      <div className="auth-tabs" role="tablist" aria-label="Hesab əməliyyatı">
        <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">Daxil ol</button>
        <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} type="button">Hesab yarat</button>
      </div>
      <form onSubmit={submit}>
        <div className="input-wrap"><Mail size={18} /><input aria-label="E-poçt" autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="E-poçt ünvanı" required type="email" value={email} /></div>
        {mode === "register" && <div className="input-wrap"><input aria-label="Ad" autoComplete="name" onChange={(event) => setFullName(event.target.value)} placeholder="Adınız (istəyə bağlı)" type="text" maxLength={100} value={fullName} /></div>}
        <div className="input-wrap"><LockKeyhole size={18} /><input aria-label="Şifrə" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} onChange={(event) => setPassword(event.target.value)} placeholder="Şifrə" required type="password" value={password} /></div>
        <button className="button" disabled={busy} type="submit">{busy ? "Gözləyin…" : mode === "login" ? "Daxil ol" : "Hesab yarat"} <ArrowRight size={18} /></button>
        {message && <p className="auth-message" role="status">{message}</p>}
        {(awaitingConfirmation || confirmationError) && <button className="auth-resend" disabled={busy || !email.trim()} onClick={() => void resendConfirmation()} type="button">Təsdiq linkini yenidən göndər</button>}
      </form>
      <p className="auth-note">Hesab imtahan tarixçəsini və uzunmüddətli irəliləyişi saxlamaq üçündür.</p>
    </div>
  );
}
