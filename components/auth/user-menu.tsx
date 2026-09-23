"use client";

import Link from "next/link";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function UserMenu({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    await createSupabaseBrowserClient().auth.signOut();
    window.location.replace("/");
  }

  return (
    <details className="user-menu">
      <summary aria-label="İstifadəçi menyusu"><span className="user-avatar">{label.charAt(0).toLocaleUpperCase("az-AZ")}</span><span className="user-menu-label">{label}</span></summary>
      <div className="user-menu-panel">
        <Link href="/profile">Profil</Link>
        <Link href="/dashboard">Nəticələrim / Dashboard</Link>
        <button disabled={busy} onClick={() => void signOut()} type="button">Çıxış</button>
      </div>
    </details>
  );
}
