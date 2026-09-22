import { createBrowserClient } from "@supabase/ssr";

export function isSupabaseConfigured() {
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      publicKey,
  );
}

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publicKey) {
    throw new Error("Supabase mühit dəyişənləri təyin edilməyib.");
  }

  return createBrowserClient(url, publicKey);
}
