import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { UserMenu } from "@/components/auth/user-menu";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const supabase = await createSupabaseServerClient().catch(() => null);
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const profile = user && supabase
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
    : null;
  const label = profile?.data?.full_name?.trim() || user?.email?.split("@")[0] || "Profil";
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="sinaqai ana səhifə">
          <span className="brand-mark" aria-hidden="true">
            <GraduationCap size={21} strokeWidth={2.2} />
          </span>
          <span>sinaq<span>ai</span></span>
        </Link>
        <nav className="main-nav" aria-label="Əsas naviqasiya">
          <Link href="/exams">İmtahanlar</Link>
          {user ? <UserMenu label={label} /> : <Link href="/login">Daxil ol</Link>}
          <Link className="button button-small" href="/exams">
            Başla
          </Link>
        </nav>
      </div>
    </header>
  );
}
