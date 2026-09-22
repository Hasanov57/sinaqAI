import type { Metadata } from "next";
import { ExamBrowser } from "@/components/exam/exam-browser";
import { demoExams } from "@/lib/data/demo-exams";

export const metadata: Metadata = { title: "İmtahanlar" };

export default function ExamsPage() {
  return (
    <>
      <header className="page-hero">
        <div className="shell">
          <p className="eyebrow">İmtahan kataloqu</p>
          <h1 className="page-title">Hazırlığa buradan başla</h1>
          <p>Uyğun imtahanı seç, şərtlərlə tanış ol və vaxtını başladaraq həll et.</p>
        </div>
      </header>
      <section className="section">
        <div className="shell">
          <ExamBrowser exams={demoExams} />
        </div>
      </section>
    </>
  );
}
