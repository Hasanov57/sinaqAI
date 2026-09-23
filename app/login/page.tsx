import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { getSafeReturnPath } from "@/lib/auth/return-path";

export const metadata = { title: "Daxil ol" };

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ returnTo?: string | string[]; error?: string | string[] }>;
}) {
  const query = await searchParams;
  const returnTo = getSafeReturnPath(query.returnTo);
  return (
    <section className="auth-section">
      <div className="shell auth-grid">
        <div className="auth-copy">
          <p className="eyebrow">Şəxsi nəticələr</p>
          <h1>Hazırlığını qaldığın yerdən davam etdir.</h1>
          <p>Hesabın olduqda nəticələr, imtahan tarixçəsi və mövzu göstəriciləri təhlükəsiz saxlanır.</p>
          <Link href="/exams">Əvvəlcə demo imtahanı sınayın</Link>
        </div>
        <LoginForm returnTo={returnTo} confirmationError={query.error === "confirmation"} />
      </div>
    </section>
  );
}
