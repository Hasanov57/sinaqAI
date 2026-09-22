"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Clock3, Flag, Menu, Save, X } from "lucide-react";
import { gradeExam } from "@/lib/grading/grading";
import { createSolutionImagePath, validateSolutionImage } from "@/lib/storage/solution-images";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import type { AnswerMap, Exam } from "@/types/exam";

type SavedAttempt = {
  attemptId: string;
  startedAt: string;
  answers: AnswerMap;
  solutionImagePaths?: Record<string, string>;
};

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ExamRunner({ exam }: { exam: Exam }) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [attempt, setAttempt] = useState<SavedAttempt | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(exam.durationMinutes ? exam.durationMinutes * 60 : 0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [passageExpanded, setPassageExpanded] = useState(true);
  const [solutionPreviewUrls, setSolutionPreviewUrls] = useState<Record<string, string>>({});
  const [solutionMessages, setSolutionMessages] = useState<Record<string, string>>({});
  const [uploadingQuestionId, setUploadingQuestionId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const storageKey = `sinaqai:active:${exam.id}`;

  useEffect(() => {
    const hydrationTask = window.setTimeout(() => {
      const saved = window.localStorage.getItem(storageKey);
      let nextAttempt: SavedAttempt;
      try {
        nextAttempt = saved
          ? (JSON.parse(saved) as SavedAttempt)
          : { attemptId: crypto.randomUUID(), startedAt: new Date().toISOString(), answers: {} };
      } catch {
        nextAttempt = { attemptId: crypto.randomUUID(), startedAt: new Date().toISOString(), answers: {} };
      }
      setAttempt(nextAttempt);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(hydrationTask);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated || !attempt) return;
    window.localStorage.setItem(storageKey, JSON.stringify(attempt));
  }, [attempt, hydrated, storageKey]);

  useEffect(() => {
    if (!attempt?.solutionImagePaths || !isSupabaseConfigured()) return;
    let active = true;
    const restorePreviews = async () => {
      const supabase = createSupabaseBrowserClient();
      const entries = await Promise.all(Object.entries(attempt.solutionImagePaths ?? {}).map(async ([questionId, path]) => {
        const { data } = await supabase.storage.from("student-solutions").createSignedUrl(path, 3600);
        return data?.signedUrl ? [questionId, data.signedUrl] as const : null;
      }));
      if (active) {
        setSolutionPreviewUrls((current) => ({
          ...current,
          ...Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null)),
        }));
      }
    };
    void restorePreviews();
    return () => { active = false; };
  }, [attempt?.solutionImagePaths]);

  useEffect(() => {
    if (!attempt) return;
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
      setTimerSeconds(
        exam.durationMinutes
          ? Math.max(0, exam.durationMinutes * 60 - elapsed)
          : Math.max(0, elapsed),
      );
    };
    updateTimer();
    const timer = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timer);
  }, [attempt, exam.durationMinutes]);

  const currentQuestion = exam.questions[currentIndex];
  const answeredCount = exam.questions.filter((question) =>
    Boolean(attempt?.answers[question.id]?.trim()) || Boolean(attempt?.solutionImagePaths?.[question.id]),
  ).length;
  const progress = Math.round((answeredCount / exam.questionCount) * 100);
  const subjects = useMemo(() => {
    const present = new Set(exam.questions.map((question) => question.subject));
    const configured = exam.subjectOrder ?? exam.subjects;
    return [...configured.filter((subject) => present.has(subject)),
      ...[...present].filter((subject) => !configured.includes(subject))];
  }, [exam.questions, exam.subjectOrder, exam.subjects]);

  const subjectQuestionNumber = useMemo(() => {
    return exam.questions
      .slice(0, currentIndex + 1)
      .filter((question) => question.subject === currentQuestion.subject).length;
  }, [currentIndex, currentQuestion.subject, exam.questions]);
  const currentPassage = currentQuestion.passageId
    ? exam.passages?.find((passage) => passage.id === currentQuestion.passageId)
    : undefined;

  function selectAnswer(optionId: string) {
    setAttempt((current) =>
      current
        ? { ...current, answers: { ...current.answers, [currentQuestion.id]: optionId } }
        : current,
    );
  }

  function enterTextAnswer(value: string) {
    setAttempt((current) => current
      ? { ...current, answers: { ...current.answers, [currentQuestion.id]: value } }
      : current);
  }

  async function uploadSolutionImage(file: File | undefined) {
    if (!file || !attempt) return;
    const validationMessage = validateSolutionImage(file);
    if (validationMessage) {
      setSolutionMessages((current) => ({ ...current, [currentQuestion.id]: validationMessage }));
      return;
    }
    if (!isSupabaseConfigured()) {
      setSolutionMessages((current) => ({ ...current, [currentQuestion.id]: "Şəkil yükləmək üçün Supabase bağlantısı tələb olunur." }));
      return;
    }

    setUploadingQuestionId(currentQuestion.id);
    setSolutionMessages((current) => ({ ...current, [currentQuestion.id]: "Şəkil yüklənir…" }));
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Həll şəklini yükləmək üçün hesabınıza daxil olun.");
      const path = createSolutionImagePath(user.id, exam.id, currentQuestion.id, file, crypto.randomUUID());
      const { error: uploadError } = await supabase.storage.from("student-solutions").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data: signedImage } = await supabase.storage.from("student-solutions").createSignedUrl(path, 3600);
      setAttempt((current) => current
        ? { ...current, solutionImagePaths: { ...current.solutionImagePaths, [currentQuestion.id]: path } }
        : current);
      if (signedImage?.signedUrl) {
        setSolutionPreviewUrls((current) => ({ ...current, [currentQuestion.id]: signedImage.signedUrl }));
      }
      setSolutionMessages((current) => ({ ...current, [currentQuestion.id]: "Həll şəkli şəxsi qaydada saxlanıldı." }));
    } catch (error) {
      setSolutionMessages((current) => ({
        ...current,
        [currentQuestion.id]: error instanceof Error ? error.message : "Şəkli yükləmək mümkün olmadı.",
      }));
    } finally {
      setUploadingQuestionId(null);
    }
  }

  function goToQuestion(index: number) {
    setCurrentIndex(index);
    setShowNavigator(false);
    setPassageExpanded(true);
  }

  function submitExam() {
    if (!attempt) return;
    const result = gradeExam(exam, attempt.answers, attempt.attemptId, attempt.startedAt, attempt.solutionImagePaths);
    window.localStorage.setItem(`sinaqai:result:${attempt.attemptId}`, JSON.stringify(result));
    window.localStorage.removeItem(storageKey);
    router.push(`/results/${attempt.attemptId}`);
  }

  if (!attempt || !hydrated) {
    return <div className="runner-loading">İmtahan hazırlanır…</div>;
  }

  return (
    <div className="exam-shell">
      <header className="exam-toolbar">
        <div className="exam-heading">
          <span className="exam-kicker">{currentQuestion.subject}</span>
          <strong>{exam.title}</strong>
        </div>
        <div className="exam-toolbar-status">
          <span className="exam-answered"><Check size={16} /> {answeredCount} / {exam.questionCount} cavablanıb</span>
          <div
            className={`exam-timer ${exam.durationMinutes && timerSeconds < 300 ? "timer-warning" : ""}`}
            aria-label={exam.durationMinutes ? "Qalan vaxt" : "Keçən vaxt"}
            title={exam.durationMinutes ? "Qalan vaxt" : "Keçən vaxt"}
          >
            <Clock3 size={18} />
            <span>{formatTime(timerSeconds)}</span>
          </div>
          <button className="button button-danger toolbar-finish" onClick={() => setShowConfirm(true)} type="button">
            <Flag size={17} /> Bitir
          </button>
          <button className="button button-secondary mobile-navigator-toggle" onClick={() => setShowNavigator(true)} type="button" aria-label="Sual naviqatorunu aç">
            <Menu size={18} /> <span>{currentIndex + 1}/{exam.questionCount}</span>
          </button>
        </div>
      </header>

      <div className="exam-layout">
        <section className="question-panel">
          <div className="subject-tabs" aria-label="Fənn seçimi" role="tablist">
            {subjects.map((subject) => {
              const subjectQuestions = exam.questions.filter((question) => question.subject === subject);
              const subjectAnswered = subjectQuestions.filter((question) => attempt.answers[question.id]?.trim() || attempt.solutionImagePaths?.[question.id]).length;
              const active = subject === currentQuestion.subject;
              return (
                <button
                  aria-selected={active}
                  className={active ? "active" : ""}
                  key={subject}
                  onClick={() => goToQuestion(exam.questions.findIndex((question) => question.subject === subject))}
                  role="tab"
                  type="button"
                >
                  <span>{subject}</span>
                  <small>{subjectAnswered}/{subjectQuestions.length} cavab</small>
                </button>
              );
            })}
          </div>

          <div className={`question-workspace ${currentPassage ? "has-passage" : ""}`}>
            {currentPassage && (
              <article className={`passage-panel ${passageExpanded ? "expanded" : "collapsed"}`}>
                <div className="passage-heading">
                  <div><span>MƏTN</span><h2>{currentPassage.title}</h2></div>
                  <button className="passage-toggle" type="button" onClick={() => setPassageExpanded((expanded) => !expanded)} aria-expanded={passageExpanded}>
                    {passageExpanded ? "Yığ" : "Göstər"}
                  </button>
                </div>
                {passageExpanded && (
                  <>
                    {currentPassage.text && <div className="passage-text">{currentPassage.text}</div>}
                    {currentPassage.imageUrl && (
                      <div className="passage-image">
                        <Image src={currentPassage.imageUrl} alt={`${currentPassage.title} rəsmi mətni`} width={1000} height={1400} />
                      </div>
                    )}
                  </>
                )}
              </article>
            )}

            <article className="question-content">
              <div className="question-meta">
                <span>Sual {currentQuestion.number} / {exam.questionCount}</span>
                <span>{currentQuestion.subject} · {subjectQuestionNumber}</span>
              </div>
              {currentQuestion.text && <h1>{currentQuestion.text}</h1>}
              {currentQuestion.questionImageUrl && (
                <div className="question-image">
                  <Image
                    src={currentQuestion.questionImageUrl}
                    alt="Sualın rəsmi diaqramı"
                    width={currentQuestion.questionImageWidth ?? 511}
                    height={currentQuestion.questionImageHeight ?? 400}
                  />
                </div>
              )}

              {currentQuestion.type === "short_answer" && (
                <label className="open-answer-field">
                  <span>Qısa cavab</span>
                  <input value={attempt.answers[currentQuestion.id] ?? ""} onChange={(event) => enterTextAnswer(event.target.value)} maxLength={500} />
                </label>
              )}
              {currentQuestion.type === "constructed_response" && (
                <label className="open-answer-field">
                  <span>Həllini yaz</span>
                  <textarea value={attempt.answers[currentQuestion.id] ?? ""} onChange={(event) => enterTextAnswer(event.target.value)} rows={9} maxLength={6000} />
                </label>
              )}
              {(currentQuestion.type === "table" || currentQuestion.type === "essay") && (
                <label className="open-answer-field">
                  <span>{currentQuestion.type === "table" ? "Cədvəl cavabını yaz" : "Cavabını yaz"}</span>
                  <textarea value={attempt.answers[currentQuestion.id] ?? ""} onChange={(event) => enterTextAnswer(event.target.value)} rows={currentQuestion.type === "table" ? 8 : 12} maxLength={6000} />
                </label>
              )}
              {currentQuestion.type === "handwritten_solution" && (
                <div className="solution-upload">
                  <label htmlFor={`solution-image-${currentQuestion.id}`}>Həllin şəklini yüklə</label>
                  <input
                    id={`solution-image-${currentQuestion.id}`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={(event) => void uploadSolutionImage(event.target.files?.[0])}
                    disabled={uploadingQuestionId === currentQuestion.id}
                  />
                  <p>JPEG, PNG və ya WEBP · maksimum 8 MB · yalnız sizin hesabınız görə bilər.</p>
                  {solutionMessages[currentQuestion.id] && <p role="status">{solutionMessages[currentQuestion.id]}</p>}
                  {solutionPreviewUrls[currentQuestion.id] && <Image className="solution-preview" src={solutionPreviewUrls[currentQuestion.id]} alt="Yüklənmiş həll şəkli" width={520} height={720} unoptimized />}
                </div>
              )}

              {currentQuestion.type === "multiple_choice" && (
                <div className="options" role="radiogroup" aria-label="Cavab variantları">
                  {currentQuestion.options.map((option) => {
                    const selected = attempt.answers[currentQuestion.id] === option.id;
                    return (
                      <button
                        aria-checked={selected}
                        className={`option ${selected ? "selected" : ""}`}
                        key={option.id}
                        onClick={() => selectAnswer(option.id)}
                        role="radio"
                        type="button"
                      >
                        <span>{option.key}</span>
                        <strong>{option.text}</strong>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="question-actions">
                <button className="button button-secondary" disabled={currentIndex === 0} onClick={() => goToQuestion(currentIndex - 1)} type="button">
                  <ChevronLeft size={18} /> Əvvəlki
                </button>
                {currentIndex < exam.questions.length - 1 ? (
                  <button className="button" onClick={() => goToQuestion(currentIndex + 1)} type="button">
                    Növbəti <ChevronRight size={18} />
                  </button>
                ) : (
                  <button className="button button-danger" onClick={() => setShowConfirm(true)} type="button">
                    <Flag size={18} /> İmtahanı bitir
                  </button>
                )}
              </div>
            </article>
          </div>
        </section>

        {showNavigator && <button className="navigator-backdrop" aria-label="Naviqatoru bağla" onClick={() => setShowNavigator(false)} type="button" />}
        <aside className={`navigator-panel ${showNavigator ? "mobile-open" : ""}`} aria-label="Sual naviqatoru">
          <div className="navigator-heading">
            <div>
              <strong>Sual naviqatoru</strong>
              <span>{answeredCount} / {exam.questionCount} cavablanıb</span>
            </div>
            <button className="navigator-close" type="button" aria-label="Naviqatoru bağla" onClick={() => setShowNavigator(false)}><X size={19} /></button>
            <Save className="navigator-save" size={18} aria-label="Cavablar saxlanır" />
          </div>
          <div className="progress-track" aria-label={`${progress}% tamamlanıb`}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="question-grid">
            {exam.questions.map((question, index) => {
              const answered = Boolean(attempt.answers[question.id]?.trim() || attempt.solutionImagePaths?.[question.id]);
              const current = index === currentIndex;
              const stateLabel = current ? "cari" : answered ? "cavablanıb" : "cavabsız";
              return (
                <button
                  aria-current={current ? "step" : undefined}
                  aria-label={`${question.number}-ci sual, ${stateLabel}`}
                  className={`question-dot ${current ? "current" : ""} ${answered ? "answered" : ""}`}
                  key={question.id}
                  onClick={() => goToQuestion(index)}
                  type="button"
                >
                  {question.number}
                </button>
              );
            })}
          </div>
          <div className="navigator-legend">
            <span><i className="legend-current" /> Cari</span>
            <span><i className="legend-answered" /> Cavablanıb</span>
            <span><i /> Cavabsız</span>
          </div>
          <button className="finish-link" onClick={() => { setShowNavigator(false); setShowConfirm(true); }} type="button">
            İmtahanı bitir
          </button>
        </aside>
      </div>

      {showConfirm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowConfirm(false)}>
          <div className="confirm-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowConfirm(false)} aria-label="Pəncərəni bağla" type="button"><X size={20} /></button>
            <span className="confirm-icon"><Flag size={24} /></span>
            <h2 id="confirm-title">İmtahanı bitirmək istədiyinizə əminsiniz?</h2>
            <p>{exam.questionCount - answeredCount} sual cavabsız qalıb. Təsdiqdən sonra cavablar dəyişdirilə bilməz.</p>
            <div className="modal-actions">
              <button className="button button-secondary" onClick={() => setShowConfirm(false)} type="button">Davam et</button>
              <button className="button button-danger" onClick={submitExam} type="button">Bitir və nəticəni göstər</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
