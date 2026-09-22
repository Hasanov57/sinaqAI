import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Daxil ol" };

export default function LoginPage() {
  return (
    <section className="auth-section">
      <div className="shell auth-grid">
        <div className="auth-copy">
          <p className="eyebrow">Şəxsi nəticələr</p>
          <h1>Hazırlığını qaldığın yerdən davam etdir.</h1>
          <p>Hesabın olduqda nəticələr, imtahan tarixçəsi və mövzu göstəriciləri təhlükəsiz saxlanır.</p>
          <Link href="/exams">Əvvəlcə demo imtahanı sınayın</Link>
        </div>
        <LoginForm />
      </div>
    </section>
  );
}
