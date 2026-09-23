import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/auth/profile-form";
import { loginPath } from "@/lib/auth/return-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Profil" };

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient().catch(() => null);
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!user || !supabase) redirect(loginPath("/profile"));
  const { data: profile } = await supabase.from("profiles").select("full_name,created_at").eq("id", user.id).maybeSingle();

  return <section className="section"><div className="shell narrow account-page">
    <p className="eyebrow">Hesabım</p><h1>Profil</h1>
    <div className="account-card">
      <ProfileForm userId={user.id} initialName={profile?.full_name ?? ""} />
      <div className="account-fact"><span>Email</span><strong>{user.email}</strong></div>
      <div className="account-fact"><span>Hesab yaradılıb</span><strong>{new Intl.DateTimeFormat("az-AZ", { dateStyle: "long" }).format(new Date(user.created_at))}</strong></div>
    </div>
  </div></section>;
}
