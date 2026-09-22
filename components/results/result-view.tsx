"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, CircleDashed, Clock3, RotateCcw, Sparkles, X } from "lucide-react";
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
  const [aiState, setAiState] = useState<Record<string, { loading?: boolean; explanation?: string; error?: string }>>({});

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
    const subjects = new Map<string, { correct: number; wrong: number; unanswered: number; ungraded: number; score: number; maxScore: number }>();
    for (const answer of result.answers) {
      const current = subjects.get(answer.subject) ?? { correct: 0, wrong: 0, unanswered: 0, ungraded: 0, score: 0, maxScore: 0 };
      if (answer.status === "unanswered") current.unanswered += 1;
      else if (answer.status === "ungraded") current.ungraded += 1;
      else if (answer.status === "correct") current.correct += 1;
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
  const correct = result.answers.filter((answer) => answer.status === "correct").length;
  const unanswered = result.answers.filter((answer) => answer.status === "unanswered").length;
  const ungraded = result.answers.filter((answer) => answer.status === "ungraded").length;
  const wrong = result.answers.filter((answer) => answer.status === "wrong").length;
  const resultExamId = result.examId;

  async function explainWrongAnswer(questionId: string, selectedKey: string) {
    setAiState((state) => ({ ...state, [questionId]: { loading: true } }));
    try {
      const response = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ examId: resultExamId, questionId, selectedKey }),
      });
      const payload = await response.json() as { explanation?: string; error?: string };
      if (!response.ok || !payload.explanation) throw new Error(payload.error ?? "İzah alınmadı.");
      setAiState((state) => ({ ...state, [questionId]: { explanation: payload.explanation } }));
    } catch (error) {
      setAiState((state) => ({ ...state, [questionId]: { error: error instanceof Error ? error.message : "İzah alınmadı." } }));
    }
  }

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
            <div>
              <strong>{result.maxScore ? `${percentage}%` : "—"}</strong>
              <span>{result.maxScore ? `${result.score} / ${result.maxScore} ${exam.usesOfficialScoring === false ? "düzgün" : "bal"}` : "Rəy gözləyir"}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section result-section">
        <div className="shell">
          <div className="summary-grid">
            <article className="summary-card summary-correct"><Check size={21} /><div><strong>{correct}</strong><span>Düzgün</span></div></article>
            <article className="summary-card summary-wrong"><X size={21} /><div><strong>{wrong}</strong><span>Səhv</span></div></article>
            <article className="summary-card summary-empty"><CircleDashed size={21} /><div><strong>{unanswered}</strong><span>Cavabsız</span></div></article>
            <article className="summary-card"><CircleDashed size={21} /><div><strong>{ungraded}</strong><span>Yoxlanılmayıb</span></div></article>
            <article className="summary-card"><Clock3 size={21} /><div><strong>{formatDuration(result.durationSeconds)}</strong><span>Sərf olunan vaxt</span></div></article>
          </div>

          <div className="results-columns">
            <div>
              <h2 className="results-title">Fənlər üzrə nəticə</h2>
              <div className="subject-results">
                {subjectStats.map(([subject, stats]) => (
                  <article className="subject-result" key={subject}>
                    <div className="subject-result-top"><strong>{subject}</strong><span>{stats.maxScore ? `${stats.score} / ${stats.maxScore} ${exam.usesOfficialScoring === false ? "düzgün" : "bal"}` : "Qiymətləndirilməyib"}</span></div>
                    <div className="result-bar"><span style={{ width: `${stats.maxScore ? (stats.score / stats.maxScore) * 100 : 0}%` }} /></div>
                    <div className="subject-counts"><span>{stats.correct} düzgün</span><span>{stats.wrong} səhv</span><span>{stats.unanswered} cavabsız</span><span>{stats.ungraded} yoxlanılmayıb</span></div>
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
                const statusClass = answer.status === "correct" ? "review-correct" : answer.status === "wrong" ? "review-wrong" : answer.status === "ungraded" ? "review-ungraded" : "review-unanswered";
                const statusLabel = answer.status === "correct" ? "Düzgün" : answer.status === "wrong" ? "Səhv" : answer.status === "ungraded" ? "Yoxlanılmayıb" : "Cavabsız";
                return (
                  <details className={`review-card ${statusClass}`} key={answer.questionId}>
                    <summary>
                      <span className="review-status">{answer.status === "correct" ? <Check size={18} /> : answer.status === "wrong" ? <X size={18} /> : <CircleDashed size={18} />}</span>
                      <div><strong>Sual {answer.questionNumber}</strong><span>{answer.topic}</span></div>
                      <span className="review-label">{statusLabel}</span>
                      <ChevronDown className="detail-chevron" size={19} />
                    </summary>
                    <div className="review-body">
                      <p className="review-question">{question.text}</p>
                      <div className="answer-compare">
                        <div><span>Sizin cavabınız</span><strong>{answer.selectedKey ?? answer.selectedAnswerText ?? (answer.solutionImagePath ? "Həll şəkli yüklənib" : "Cavab verilməyib")}</strong></div>
                        <div><span>Rəsmi cavab / meyar</span><strong>{answer.correctKey ?? question.officialAnswer ?? "Rəsmi cavab mətndə göstərilməyib"}</strong></div>
                      </div>
                      {question.officialExplanation && (
                        <div className="official-explanation">
                          <strong>{exam.status === "draft" ? "DİM rəsmi izahı" : "Demo izahı"}</strong>
                          <p>{question.officialExplanation}</p>
                          {question.sourcePage && <small>Mənbə səhifəsi: {question.sourcePage}</small>}
                        </div>
                      )}
                      {answer.status === "wrong" && question.type === "multiple_choice" && answer.selectedKey && (
                        <div className="ai-explanation">
                          {!aiState[question.id]?.explanation && (
                            <button
                              className="button button-secondary"
                              type="button"
                              disabled={aiState[question.id]?.loading}
                              onClick={() => void explainWrongAnswer(question.id, answer.selectedKey!)}
                            >
                              <Sparkles size={17} /> {aiState[question.id]?.loading ? "İzah hazırlanır…" : "AI ilə izah et"}
                            </button>
                          )}
                          {aiState[question.id]?.error && <p role="alert">{aiState[question.id].error}</p>}
                          {aiState[question.id]?.explanation && (
                            <div className="official-explanation ai-explanation-content">
                              <strong>AI izahı · rəsmi balı dəyişmir</strong>
                              <p>{aiState[question.id].explanation}</p>
                            </div>
                          )}
                        </div>
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
