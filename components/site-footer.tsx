import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <p>© {new Date().getFullYear()} sinaqai</p>
        <p>Bu platforma Dövlət İmtahan Mərkəzinin rəsmi saytı deyil.</p>
        <Link href="/exams">İmtahanlara bax</Link>
      </div>
    </footer>
  );
}
