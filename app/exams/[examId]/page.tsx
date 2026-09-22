import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock3, FileQuestion, Info, Languages, ShieldCheck } from "lucide-react";
import { getExam } from "@/lib/data/demo-exams";

type Props = { params: Promise<{ examId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const exam = getExam((await params).examId);
  return { title: exam?.title ?? "İmtahan" };
}

export default async function ExamDetailPage({ params }: Props) {
  const exam = getExam((await params).examId);
  if (!exam) notFound();

  return (
    <>
      <header className="page-hero">
        <div className="shell">
          <p className="eyebrow">{exam.status === "demo" ? "Demo imtahan" : exam.year}</p>
          <h1 className="page-title">{exam.title}</h1>
          <p>{exam.subjects.join(" · ")}</p>
        </div>
      </header>
      <section className="section">
        <div className="shell detail-grid">
          <article className="content-card">
            <h2>İmtahan haqqında</h2>
            <dl className="info-list">
              <div className="info-item"><dt>İmtahan növü</dt><dd>{exam.typeLabel}</dd></div>
              <div className="info-item"><dt>Sinif</dt><dd>{exam.grade}-ci sinif</dd></div>
              <div className="info-item"><dt>Sual sayı</dt><dd>{exam.questionCount}</dd></div>
              <div className="info-item"><dt>Müddət</dt><dd>{exam.durationMinutes} dəqiqə</dd></div>
              <div className="info-item"><dt>Dil bölməsi</dt><dd>{exam.languageSection}</dd></div>
              <div className="info-item"><dt>Maksimum bal</dt><dd>{exam.maxScore}</dd></div>
            </dl>
            <div className="notice">
              <Info size={20} />
              <div>
                <strong>Demo məlumatı</strong><br />
                Bu imtahan platformanın iş prinsipini göstərmək üçün hazırlanıb və rəsmi DİM imtahanı deyil.
              </div>
            </div>
          </article>

          <aside className="side-card">
            <span className="badge"><FileQuestion size={14} /> {exam.questionCount} sual</span>
            <p className="score-big">{exam.maxScore} bal</p>
            <Link className="button" href={`/exams/${exam.id}/start`}>
              İmtahana başla
            </Link>
            <div className="side-notes">
              <span><Clock3 size={17} /> Vaxt göstəricisi aktivdir</span>
              <span><CheckCircle2 size={17} /> Cavablar cihazda saxlanır</span>
              <span><Languages size={17} /> Azərbaycan dili bölməsi</span>
              <span><ShieldCheck size={17} /> Yoxlama qayda əsaslıdır</span>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
