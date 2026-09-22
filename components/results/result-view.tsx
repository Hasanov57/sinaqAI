"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, CircleDashed, Clock3, RotateCcw, X } from "lucide-react";
import { calculateTopicStatistics } from "@/lib/analytics/statistics";
import { getExam } from "@/lib/data/demo-exams";
import type { AttemptResult } from "@/types/exam";

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes} dəq ${remainder} san`;
}

export function ResultView({ attemptId }: { attemptId: string }) {
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const hydrationTask = window.setTimeout(() => {
      const raw = window.localStorage.getItem(`sinaqai:result:${attemptId}`);
      if (raw) {
        try { setResult(JSON.parse(raw) as AttemptResult); } catch { setResult(null); }
      }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(hydrationTask);
  }, [attemptId]);

  const exam = result ? getExam(result.examId) : undefined;
  const topicStats = useMemo(
    () => (result ? calculateTopicStatistics(result.answers) : []),
    [result],
  );

  const subjectStats = useMemo(() => {
    if (!result) return [];
    const subjects = new Map<string, { correct: number; wrong: number; unanswered: number; score: number; maxScore: number }>();
    for (const answer of result.answers) {
      const current = subjects.get(answer.subject) ?? { correct: 0, wrong: 0, unanswered: 0, score: 0, maxScore: 0 };
      if (!answer.selectedOptionId) current.unanswered += 1;
      else if (answer.isCorrect) current.correct += 1;
      else current.wrong += 1;
      current.score += answer.awardedScore;
      current.maxScore += answer.maxScore;
      subjects.set(answer.subject, current);
    }
    return [...subjects.entries()];
  }, [result]);

  if (!loaded) return <div className="runner-loading">Nəticə hesablanır…</div>;

  if (!result || !exam) {
    return (
      <section className="section">
        <div className="narrow empty-state">
          <h1>Nəticə tapılmadı</h1>
          <p>Bu nəticə yalnız imtahanı həll etdiyiniz cihazda saxlanılır.</p>
          <Link className="button" href="/exams">İmtahanlara qayıt</Link>
        </div>
      </section>
    );
  }

  const percentage = result.maxScore ? Math.round((result.score / result.maxScore) * 100) : 0;
  const correct = result.answers.filter((answer) => answer.isCorrect).length;
  const unanswered = result.answers.filter((answer) => !answer.selectedOptionId).length;
  const wrong = result.answers.length - correct - unanswered;

  return (
    <>
      <section className="result-hero">
        <div className="shell result-hero-grid">
          <div>
            <p className="eyebrow">İmtahan tamamlandı</p>
            <h1>Nəticən hazırdır</h1>
            <p>{exam.title}</p>
            <div className="result-actions">
              <Link className="button" href={`/exams/${exam.id}/start`}><RotateCcw size={18} /> Yenidən həll et</Link>
              <Link className="button button-secondary" href="/exams">Başqa imtahan seç</Link>
            </div>
          </div>
          <div className="score-ring" style={{ "--score": `${percentage * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{percentage}%</strong><span>{result.score} / {result.maxScore} bal</span></div>
          </div>
        </div>
      </section>

      <section className="section result-section">
        <div className="shell">
          <div className="summary-grid">
            <article className="summary-card summary-correct"><Check size={21} /><div><strong>{correct}</strong><span>Düzgün</span></div></article>
            <article className="summary-card summary-wrong"><X size={21} /><div><strong>{wrong}</strong><span>Səhv</span></div></article>
            <article className="summary-card summary-empty"><CircleDashed size={21} /><div><strong>{unanswered}</strong><span>Cavabsız</span></div></article>
            <article className="summary-card"><Clock3 size={21} /><div><strong>{formatDuration(result.durationSeconds)}</strong><span>Sərf olunan vaxt</span></div></article>
          </div>

          <div className="results-columns">
            <div>
              <h2 className="results-title">Fənlər üzrə nəticə</h2>
              <div className="subject-results">
                {subjectStats.map(([subject, stats]) => (
                  <article className="subject-result" key={subject}>
                    <div className="subject-result-top"><strong>{subject}</strong><span>{stats.score} / {stats.maxScore} bal</span></div>
                    <div className="result-bar"><span style={{ width: `${(stats.score / stats.maxScore) * 100}%` }} /></div>
                    <div className="subject-counts"><span>{stats.correct} düzgün</span><span>{stats.wrong} səhv</span><span>{stats.unanswered} cavabsız</span></div>
                  </article>
                ))}
              </div>
            </div>
            <div>
              <h2 className="results-title">Mövzular</h2>
              <div className="topic-results">
                {topicStats.map((topic) => (
                  <div className="topic-result" key={topic.topic}>
                    <span>{topic.topic}</span><strong>{topic.accuracyPercentage}%</strong>
                    <div className="result-bar"><span style={{ width: `${topic.accuracyPercentage}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="review-section">
            <div className="section-heading">
              <h2>Sual icmalı</h2>
              <p>Hər sualda seçdiyin və düzgün cavabı müqayisə et.</p>
            </div>
            <div className="review-list">
              {result.answers.map((answer) => {
                const question = exam.questions.find((item) => item.id === answer.questionId);
                if (!question) return null;
                return (
                  <details className={`review-card ${answer.isCorrect ? "review-correct" : answer.selectedOptionId ? "review-wrong" : "review-unanswered"}`} key={answer.questionId}>
                    <summary>
                      <span className="review-status">{answer.isCorrect ? <Check size={18} /> : answer.selectedOptionId ? <X size={18} /> : <CircleDashed size={18} />}</span>
                      <div><strong>Sual {answer.questionNumber}</strong><span>{answer.topic}</span></div>
                      <span className="review-label">{answer.isCorrect ? "Düzgün" : answer.selectedOptionId ? "Səhv" : "Cavabsız"}</span>
                      <ChevronDown className="detail-chevron" size={19} />
                    </summary>
                    <div className="review-body">
                      <p className="review-question">{question.text}</p>
                      <div className="answer-compare">
                        <div><span>Sizin cavabınız</span><strong>{answer.selectedKey ?? "Cavab verilməyib"}</strong></div>
                        <div><span>Düzgün cavab</span><strong>{answer.correctKey}</strong></div>
                      </div>
                      {question.officialExplanation && (
                        <div className="official-explanation"><strong>Demo izahı</strong><p>{question.officialExplanation}</p></div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
