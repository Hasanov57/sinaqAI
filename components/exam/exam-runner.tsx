"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock3, Flag, Save, X } from "lucide-react";
import { gradeExam } from "@/lib/grading/grading";
import type { AnswerMap, Exam } from "@/types/exam";

type SavedAttempt = {
  attemptId: string;
  startedAt: string;
  answers: AnswerMap;
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
  const answeredCount = Object.keys(attempt?.answers ?? {}).length;
  const progress = Math.round((answeredCount / exam.questionCount) * 100);
  const subjects = useMemo(
    () => [...new Set(exam.questions.map((question) => question.subject))],
    [exam.questions],
  );

  const subjectQuestionNumber = useMemo(() => {
    return exam.questions
      .slice(0, currentIndex + 1)
      .filter((question) => question.subject === currentQuestion.subject).length;
  }, [currentIndex, currentQuestion.subject, exam.questions]);

  function selectAnswer(optionId: string) {
    setAttempt((current) =>
      current
        ? { ...current, answers: { ...current.answers, [currentQuestion.id]: optionId } }
        : current,
    );
  }

  function submitExam() {
    if (!attempt) return;
    const result = gradeExam(exam, attempt.answers, attempt.attemptId, attempt.startedAt);
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
        <div>
          <span className="exam-kicker">{currentQuestion.subject}</span>
          <strong>{exam.title}</strong>
        </div>
        <div
          className={`exam-timer ${exam.durationMinutes && timerSeconds < 300 ? "timer-warning" : ""}`}
          aria-label={exam.durationMinutes ? "Qalan vaxt" : "Keçən vaxt"}
          title={exam.durationMinutes ? "Qalan vaxt" : "Keçən vaxt"}
        >
          <Clock3 size={19} />
          <span>{formatTime(timerSeconds)}</span>
        </div>
      </header>

      <div className="exam-layout">
        <section className="question-panel">
          <div className="subject-tabs" aria-label="Fənn seçimi">
            {subjects.map((subject) => {
              const subjectQuestions = exam.questions.filter((question) => question.subject === subject);
              const subjectAnswered = subjectQuestions.filter((question) => attempt.answers[question.id]).length;
              return (
                <button
                  className={subject === currentQuestion.subject ? "active" : ""}
                  key={subject}
                  onClick={() => setCurrentIndex(exam.questions.findIndex((question) => question.subject === subject))}
                  type="button"
                >
                  <span>{subject}</span>
                  <small>{subjectAnswered}/{subjectQuestions.length}</small>
                </button>
              );
            })}
          </div>
          <div className="question-meta">
            <span>Sual {currentQuestion.number} / {exam.questionCount}</span>
            <span>{currentQuestion.subject} · {subjectQuestionNumber}</span>
          </div>
          <h1>{currentQuestion.text}</h1>
          {currentQuestion.questionImageUrl && (
            <div className="question-image">
              <Image
                src={currentQuestion.questionImageUrl}
                alt="Sualın rəsmi diaqramı"
                width={currentQuestion.questionImageWidth ?? 511}
                height={currentQuestion.questionImageHeight ?? 400}
                priority={false}
              />
            </div>
          )}

          <div className="options" role="radiogroup" aria-label="Cavab variantları">
            {currentQuestion.options.map((option) => {
              const selected = attempt.answers[currentQuestion.id] === option.id;
              return (
                <button
                  className={`option ${selected ? "selected" : ""}`}
                  key={option.id}
                  onClick={() => selectAnswer(option.id)}
                  role="radio"
                  aria-checked={selected}
                  type="button"
                >
                  <span>{option.key}</span>
                  <strong>{option.text}</strong>
                </button>
              );
            })}
          </div>

          <div className="question-actions">
            <button
              className="button button-secondary"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((index) => index - 1)}
              type="button"
            >
              <ChevronLeft size={18} /> Əvvəlki
            </button>
            {currentIndex < exam.questions.length - 1 ? (
              <button
                className="button"
                onClick={() => setCurrentIndex((index) => index + 1)}
                type="button"
              >
                Növbəti <ChevronRight size={18} />
              </button>
            ) : (
              <button className="button" onClick={() => setShowConfirm(true)} type="button">
                <Flag size={18} /> İmtahanı bitir
              </button>
            )}
          </div>
        </section>

        <aside className="navigator-panel">
          <div className="navigator-heading">
            <div>
              <strong>Sual naviqatoru</strong>
              <span>{answeredCount} / {exam.questionCount} cavablanıb</span>
            </div>
            <Save size={18} aria-label="Cavablar saxlanır" />
          </div>
          <div className="progress-track" aria-label={`${progress}% tamamlanıb`}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="question-grid">
            {exam.questions.map((question, index) => {
              const answered = Boolean(attempt.answers[question.id]);
              return (
                <button
                  className={`question-dot ${index === currentIndex ? "current" : ""} ${answered ? "answered" : ""}`}
                  key={question.id}
                  onClick={() => setCurrentIndex(index)}
                  aria-label={`${question.number}-ci suala keç`}
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
          <button className="finish-link" onClick={() => setShowConfirm(true)} type="button">
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
