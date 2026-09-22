import Link from "next/link";
import { GraduationCap } from "lucide-react";

export function SiteHeader() {
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
          <Link href="/login">Daxil ol</Link>
          <Link className="button button-small" href="/exams">
            Başla
          </Link>
        </nav>
      </div>
    </header>
  );
}
