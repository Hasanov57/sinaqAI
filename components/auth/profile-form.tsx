"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ProfileForm({ userId, initialName }: { userId: string; initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await createSupabaseBrowserClient().from("profiles")
      .update({ full_name: name.trim() || null }).eq("id", userId);
    setBusy(false);
    setMessage(error ? "Adı saxlamaq mümkün olmadı. Yenidən cəhd edin." : "Adınız saxlanıldı.");
    if (!error) router.refresh();
  }

  return <form className="profile-form" onSubmit={(event) => void save(event)}>
    <label htmlFor="full-name">Ad</label>
    <input id="full-name" maxLength={100} onChange={(event) => setName(event.target.value)} value={name} />
    <button className="button" disabled={busy} type="submit">{busy ? "Saxlanır…" : "Yadda saxla"}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
