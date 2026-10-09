"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, CircleDashed, Clock3, RotateCcw, Save, Sparkles, X } from "lucide-react";
import { calculateTopicStatistics } from "@/lib/analytics/statistics";
import { syncOfficialAttempt } from "@/lib/attempts/client";
import { loginPath, saveResultReturnPath } from "@/lib/auth/return-path";
import type { QuestionExplanation } from "@/lib/ai/schema";
import { openGradeFraction, openGradeSchema, type OpenGrade } from "@/lib/ai/open-grade-schema";
import { getExam } from "@/lib/data/demo-exams";
import { regradeAttemptResult } from "@/lib/grading/grading";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import type { AttemptResult } from "@/types/exam";

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes} dəq ${remainder} san`;
}

function formatScore(value: number) {
  return new Intl.NumberFormat("az-AZ", { maximumFractionDigits: 2 }).format(value);
}

export function ResultView({ attemptId }: { attemptId: string }) {
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [aiState, setAiState] = useState<Record<string, { loading?: boolean; explanation?: QuestionExplanation; error?: string }>>({});
  const [openGrades, setOpenGrades] = useState<Record<string, { loading?: boolean; grade?: OpenGrade; error?: string }>>({});
  const [syncWarning, setSyncWarning] = useState("");
  const [savingResult, setSavingResult] = useState(false);
  const [savedResult, setSavedResult] = useState(false);
  const [topicsExpanded, setTopicsExpanded] = useState(false);
  const pendingSaveConsumed = useRef(false);

  useEffect(() => {
    const hydrationTask = window.setTimeout(async () => {
      try {
        const savedGrades = JSON.parse(window.localStorage.getItem(`sinaqai:open-grades:${attemptId}`) ?? "{}") as Record<string, unknown>;
        const valid = Object.fromEntries(Object.entries(savedGrades).flatMap(([id, value]) => {
          const parsed = openGradeSchema.safeParse(value);
          return parsed.success ? [[id, { grade: parsed.data }]] : [];
        }));
        setOpenGrades(valid);
      } catch { setOpenGrades({}); }
      const raw = window.localStorage.getItem(`sinaqai:result:${attemptId}`);
      if (raw) {
        try {
          const stored = JSON.parse(raw) as AttemptResult;
          const storedExam = getExam(stored.examId);
          const refreshed = storedExam ? regradeAttemptResult(storedExam, stored) : stored;
          setResult(refreshed);
          window.localStorage.setItem(`sinaqai:result:${attemptId}`, JSON.stringify(refreshed));
        } catch { setResult(null); }
      } else if (isSupabaseConfigured()) {
        const response = await fetch(`/api/attempts/${encodeURIComponent(attemptId)}`).catch(() => null);
        if (response?.ok) {
          const payload = await response.json() as { result?: AttemptResult };
          if (payload.result) {
            const fetchedExam = getExam(payload.result.examId);
            const refreshed = fetchedExam ? regradeAttemptResult(fetchedExam, payload.result) : payload.result;
            setResult(refreshed);
            window.localStorage.setItem(`sinaqai:result:${attemptId}`, JSON.stringify(refreshed));
          }
        }
      }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(hydrationTask);
  }, [attemptId]);

  useEffect(() => {
    if (!loaded) return;
    const grades = Object.fromEntries(Object.entries(openGrades).flatMap(([id, state]) => state.grade ? [[id, state.grade]] : []));
    window.localStorage.setItem(`sinaqai:open-grades:${attemptId}`, JSON.stringify(grades));
  }, [attemptId, loaded, openGrades]);

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

  const explainWrongAnswer = useCallback(async (questionId: string) => {
    if (!result) return;
    const answer = result.answers.find((item) => item.questionId === questionId);
    if (answer?.status !== "wrong" || !answer.selectedKey) return;
    setAiState((state) => ({ ...state, [questionId]: { loading: true } }));
    try {
      const response = await fetch("/api/ai/explain", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ examId: result.examId, questionId, selectedKey: answer.selectedKey }),
      });
      const payload = await response.json() as { explanation?: QuestionExplanation; error?: string };
      if (!response.ok || !payload.explanation) throw new Error(payload.error ?? "AI izahını hazırda yaratmaq mümkün olmadı. Bir az sonra yenidən cəhd edin.");
      setAiState((state) => ({ ...state, [questionId]: { explanation: payload.explanation } }));
    } catch (error) {
      setAiState((state) => ({ ...state, [questionId]: { error: error instanceof Error ? error.message : "AI izahını hazırda yaratmaq mümkün olmadı. Bir az sonra yenidən cəhd edin." } }));
    }
  }, [result]);

  const gradeOpenAnswer = useCallback(async (questionId: string) => {
    if (!result) return;
    const answer = result.answers.find((item) => item.questionId === questionId);
    if (answer?.status !== "ungraded" || !answer.selectedAnswerText?.trim()) return;
    setOpenGrades((state) => ({ ...state, [questionId]: { loading: true } }));
    try {
      const response = await fetch("/api/ai/grade-open", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ examId: result.examId, questionId, studentAnswer: answer.selectedAnswerText }),
      });
      const payload = await response.json() as { grade?: unknown; error?: string };
      const grade = openGradeSchema.safeParse(payload.grade);
      if (!response.ok || !grade.success) throw new Error(payload.error ?? "AI qiymətləndirməsini hazırda aparmaq mümkün olmadı.");
      setOpenGrades((state) => ({ ...state, [questionId]: { grade: grade.data } }));
    } catch (error) {
      setOpenGrades((state) => ({ ...state, [questionId]: { error: error instanceof Error ? error.message : "AI qiymətləndirməsini hazırda aparmaq mümkün olmadı." } }));
    }
  }, [result]);

  const saveResult = useCallback(async (afterLogin = false) => {
    if (!result || savingResult) return;
    if (!isSupabaseConfigured()) {
      setSyncWarning("Nəticələri yadda saxlamaq hazırda aktiv deyil.");
      return;
    }
    setSavingResult(true);
    setSyncWarning("");
    try {
      const { data: { user } } = await createSupabaseBrowserClient().auth.getUser();
      if (!user) {
        if (afterLogin) setSyncWarning("Nəticəni yadda saxlamaq üçün əvvəlcə hesabınıza daxil olun.");
        else window.location.assign(loginPath(saveResultReturnPath(attemptId)));
        return;
      }
      await syncOfficialAttempt(result);
      setSavedResult(true);
    } catch (error) {
      setSyncWarning(error instanceof Error ? error.message : "Nəticə hesabınıza saxlanmadı. Yenidən cəhd edin.");
    } finally {
      setSavingResult(false);
    }
  }, [attemptId, result, savingResult]);

  useEffect(() => {
    if (!loaded || !result || pendingSaveConsumed.current) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("saveResult") !== "1") return;
    pendingSaveConsumed.current = true;
    url.searchParams.delete("saveResult");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    void saveResult(true);
  }, [loaded, result, saveResult]);

  if (!loaded) return <div className="runner-loading">Nəticə hesablanır…</div>;

  if (!result || !exam) {
    return (
      <section className="section">
        <div className="narrow empty-state">
          <h1>Nəticə tapılmadı</h1>
          <p>Nəticə tapılmadı. Hesabınıza daxil olun və ya imtahanı həll etdiyiniz cihazdan yenidən yoxlayın.</p>
          <Link className="button" href="/exams">İmtahanlara qayıt</Link>
        </div>
      </section>
    );
  }

  const percentage = result.maxScore ? Math.round((result.score / result.maxScore) * 100) : 0;
  const official = exam.usesOfficialScoring === true;
  const correct = result.answers.filter((answer) => answer.status === "correct").length;
  const unanswered = result.answers.filter((answer) => answer.status === "unanswered").length;
  const ungraded = result.answers.filter((answer) => answer.status === "ungraded").length;
  const wrong = result.answers.filter((answer) => answer.status === "wrong").length;
  const aiEstimatedPoints = result.answers.reduce((sum, answer) => {
    const grade = openGrades[answer.questionId]?.grade;
    const fraction = grade ? openGradeFraction(grade.score) : null;
    return sum + (answer.status === "ungraded" && answer.subject === "İngilis dili" && fraction !== null ? fraction * 200 / 37 : 0);
  }, 0);
  const aiGradeCount = result.answers.filter((answer) => {
    const grade = openGrades[answer.questionId]?.grade;
    return answer.status === "ungraded" && grade && openGradeFraction(grade.score) !== null;
  }).length;

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
              {exam.status !== "demo" && (
                <button className="button button-secondary" disabled={savingResult || savedResult} onClick={() => void saveResult()} type="button">
                  {savedResult ? <Check size={18} /> : <Save size={18} />}
                  {savedResult ? "Nəticə hesabda saxlanıb" : savingResult ? "Nəticə saxlanır..." : "Nəticəni yadda saxla"}
                </button>
              )}
            </div>
            {exam.status !== "demo" && !savedResult && <p>Nəticə hələlik bu brauzerdədir. AI izahı üçün giriş lazım deyil; hesabda saxlamaq üçün düyməni seçin.</p>}
          </div>
          <div className="score-ring" style={{ "--score": `${percentage * 3.6}deg` } as React.CSSProperties}>
            <div>
              <strong>{result.maxScore ? `${percentage}%` : "—"}</strong>
              <span>{result.maxScore ? `${formatScore(result.score)} / ${formatScore(result.maxScore)} ${official ? "ilkin bal" : "düzgün"}` : "Rəy gözləyir"}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section result-section">
        <div className="shell">
          {syncWarning && <p className="sync-warning" role="alert">{syncWarning}</p>}
          <div className="summary-grid">
            <article className="summary-card summary-correct"><Check size={21} /><div><strong>{correct}</strong><span>Düzgün</span></div></article>
            <article className="summary-card summary-wrong"><X size={21} /><div><strong>{wrong}</strong><span>Səhv</span></div></article>
            <article className="summary-card summary-empty"><CircleDashed size={21} /><div><strong>{unanswered}</strong><span>Cavabsız</span></div></article>
            <article className="summary-card"><CircleDashed size={21} /><div><strong>{ungraded}</strong><span>{official ? "Rəsmi yoxlanılmayıb" : "Yoxlanılmayıb"}</span></div></article>
            <article className="summary-card"><Clock3 size={21} /><div><strong>{formatDuration(result.durationSeconds)}</strong><span>Sərf olunan vaxt</span></div></article>
          </div>

          {official && <p className="score-disclaimer">Bal DİM-in 2025 düsturları ilə hesablanır. Bu, yekun rəsmi nəticə deyil: 6 dinləmə sualı daxil edilməyib. İngilis dilində qısa yazılı cavablar rəsmi sözlə yoxlanılır; uzun yazılı cavablar üçün AI yalnız ayrıca təxmini qiymət verir. Riyaziyyatda kodlaşdırılan 5 cavab rəsmi rəqəmlə tutuşdurulur.</p>}
          {aiGradeCount > 0 && <p className="ai-grade-summary">AI-nin təxmini əlavə qiyməti: +{formatScore(aiEstimatedPoints)} bal. Birlikdə təxmini nəticə: {formatScore(result.score + aiEstimatedPoints)} / 300. Bu rəqəm DİM-in rəsmi qiymətləndirməsi deyil və hesabda saxlanan təsdiqlənmiş bala əlavə olunmur.</p>}

          <div className="results-columns">
            <div>
              <h2 className="results-title">Fənlər üzrə nəticə</h2>
              <div className="subject-results">
                {subjectStats.map(([subject, stats]) => (
                  <article className="subject-result" key={subject}>
                    <div className="subject-result-top"><strong>{subject}</strong><span>{official ? `${formatScore(stats.score)} / 100 ilkin bal` : stats.maxScore ? `${formatScore(stats.score)} / ${formatScore(stats.maxScore)} düzgün` : "Qiymətləndirilməyib"}</span></div>
                    <div className="result-bar"><span style={{ width: `${official ? stats.score : stats.maxScore ? (stats.score / stats.maxScore) * 100 : 0}%` }} /></div>
                    <div className="subject-counts"><span>{stats.correct} düzgün</span><span>{stats.wrong} səhv</span><span>{stats.unanswered} cavabsız</span><span>{stats.ungraded} {official ? "rəsmi yoxlanılmayıb" : "yoxlanılmayıb"}</span></div>
                  </article>
                ))}
              </div>
            </div>
            <div>
              <h2 className="results-title">Mövzular</h2>
              <div className="topic-results">
                {(topicsExpanded ? topicStats : topicStats.slice(0, 4)).map((topic) => (
                  <div className="topic-result" key={topic.topic}>
                    <span>{topic.topic}</span><strong>{topic.accuracyPercentage}%</strong>
                    <div className="result-bar"><span style={{ width: `${topic.accuracyPercentage}%` }} /></div>
                  </div>
                ))}
              </div>
              {topicStats.length > 4 && <button className="topic-toggle" type="button" aria-expanded={topicsExpanded} onClick={() => setTopicsExpanded((expanded) => !expanded)}>{topicsExpanded ? "Daha az göstər" : `Daha çox göstər (${topicStats.length - 4})`}</button>}
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
                const statusLabel = openGrades[question.id]?.grade ? "AI ilə təxmini" : answer.status === "correct" ? "Düzgün" : answer.status === "wrong" ? "Səhv" : answer.status === "ungraded" ? "Yoxlanılmayıb" : "Cavabsız";
                const explanation = aiState[question.id]?.explanation;
                const openGrade = openGrades[question.id]?.grade;
                return (
                  <details className={`review-card ${statusClass}`} id={`question-${answer.questionId}`} key={answer.questionId}>
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
                          <strong>{exam.status === "draft" ? "DİM izahı" : "Demo izahı"}</strong>
                          <p>{question.officialExplanation}</p>
                          {question.sourcePage && <small>Mənbə səhifəsi: {question.sourcePage}</small>}
                        </div>
                      )}
                      {exam.status === "draft" && answer.status === "wrong" && question.type === "multiple_choice" && answer.selectedKey && (
                        <div className="ai-explanation">
                          {!explanation && (
                            <button
                              className="button button-secondary"
                              type="button"
                              disabled={aiState[question.id]?.loading}
                              onClick={() => void explainWrongAnswer(question.id)}
                            >
                              <Sparkles size={17} /> {aiState[question.id]?.loading ? "AI izah hazırlayır..." : "AI ilə izah et"}
                            </button>
                          )}
                          {aiState[question.id]?.error && <p role="alert">{aiState[question.id].error}</p>}
                          {explanation && (
                            <div className="official-explanation ai-explanation-content">
                              <strong>AI izahı · DİM tərəfindən yazılmayıb</strong>
                              <p>{explanation.summary}</p>
                              <h4>Səhvin səbəbi</h4><p>{explanation.whyWrong}</p>
                              <h4>Doğru yanaşma</h4><p>{explanation.correctReasoning}</p>
                              <h4>Yadda saxla</h4><p>{explanation.keyRule}</p>
                              {explanation.miniExample && <><h4>Oxşar nümunə</h4><p>{explanation.miniExample}</p></>}
                            </div>
                          )}
                        </div>
                      )}
                      {exam.status === "draft" && answer.status === "ungraded" && question.subject === "İngilis dili" && (question.type === "constructed_response" || question.type === "essay") && answer.selectedAnswerText?.trim() && (
                        <div className="ai-explanation">
                          {!openGrade && <button className="button button-secondary" type="button" disabled={openGrades[question.id]?.loading} onClick={() => void gradeOpenAnswer(question.id)}><Sparkles size={17} /> {openGrades[question.id]?.loading ? "AI cavabı yoxlayır..." : "AI ilə qiymətləndir"}</button>}
                          {!openGrade && <p className="ai-privacy-note">Bu düyməni seçəndə yazdığınız cavab AI xidmətinə göndərilir.</p>}
                          {openGrades[question.id]?.error && <p role="alert">{openGrades[question.id].error}</p>}
                          {openGrade && <div className="official-explanation ai-explanation-content">
                            <strong>AI təxmini qiymətləndirmə · DİM balı deyil</strong>
                            <p>{openGrade.score === "review" ? "Bu cavab üçün etibarlı təxmini bal seçilmədi; əl ilə yoxlama lazımdır." : `${openGrade.score} / 1 meyar balı (təxminən ${formatScore((openGradeFraction(openGrade.score) ?? 0) * 200 / 37)} nisbi bal)`}</p>
                            <h4>Səbəb</h4><p>{openGrade.reason}</p>
                            <h4>Yaxşı tərəf</h4><p>{openGrade.strength}</p>
                            <h4>Yaxşılaşdırmaq üçün</h4><p>{openGrade.improvement}</p>
                          </div>}
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
