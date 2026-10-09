import type {
  AnswerMap,
  AttemptResult,
  Exam,
  ExamQuestion,
  GradedAnswer,
} from "@/types/exam";

export type AcceptedAnswer = {
  answerText: string;
  normalizedAnswer?: string | null;
  score: number;
};

export function normalizeStudentAnswer(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("az-AZ")
    .replace(/[.,;:!?]+$/g, "")
    .replace(/\s+/g, " ");
}

export function gradeMultipleChoice(
  question: ExamQuestion,
  selectedOptionId?: string,
): GradedAnswer {
  const correctOption = question.options.find((option) => option.isCorrect);
  if (!correctOption) {
    throw new Error(`Sual ${question.id} üçün düzgün cavab təyin edilməyib.`);
  }

  const selectedOption = question.options.find(
    (option) => option.id === selectedOptionId,
  );
  const isCorrect = selectedOption?.id === correctOption.id;

  return {
    questionId: question.id,
    questionNumber: question.number,
    selectedOptionId: selectedOption?.id ?? null,
    selectedKey: selectedOption?.key ?? null,
    correctKey: correctOption.key,
    status: !selectedOption ? "unanswered" : isCorrect ? "correct" : "wrong",
    isCorrect,
    awardedScore: isCorrect ? question.maxScore : 0,
    maxScore: question.maxScore,
    subject: question.subject,
    topic: question.topic,
  };
}

export function matchAcceptedAnswer(
  answer: string,
  acceptedAnswers: AcceptedAnswer[],
): AcceptedAnswer | null {
  const normalized = normalizeStudentAnswer(answer);
  return (
    acceptedAnswers.find((accepted) => {
      const expected =
        accepted.normalizedAnswer ??
        normalizeStudentAnswer(accepted.answerText);
      return normalized === expected;
    }) ?? null
  );
}

export function validateAllowedScore(
  score: number,
  allowedScores: number[],
): boolean {
  return allowedScores.some((allowed) => Math.abs(allowed - score) < 1e-9);
}

export function calculateExamScore(answers: GradedAnswer[]) {
  return answers.reduce(
    (totals, answer) => ({
      score: totals.score + answer.awardedScore,
      maxScore: totals.maxScore + answer.maxScore,
    }),
    { score: 0, maxScore: 0 },
  );
}

// DİM 2025, 11-ci sinif buraxılış: foreign language 100/37,
// Azerbaijani 5/2, mathematics 25/8. The six missing listening
// questions are not invented or awarded points.
export function officialQuestionPoints(question: ExamQuestion): number {
  if (question.subject === "İngilis dili") {
    return question.type === "multiple_choice" ? 100 / 37 : 200 / 37;
  }
  if (question.subject === "Azərbaycan dili") {
    return question.type === "multiple_choice" ? 5 / 2 : 5;
  }
  if (question.subject === "Riyaziyyat") {
    const coded = question.variantNumbers?.A !== undefined &&
      question.variantNumbers.A >= 74 && question.variantNumbers.A <= 78;
    return question.type === "multiple_choice" || coded ? 25 / 8 : 25 / 4;
  }
  throw new Error(`Rəsmi bal qaydası tapılmadı: ${question.subject}`);
}

function isMathCodedAnswer(question: ExamQuestion): boolean {
  return question.subject === "Riyaziyyat" &&
    question.type === "short_answer" &&
    question.variantNumbers?.A !== undefined &&
    question.variantNumbers.A >= 74 && question.variantNumbers.A <= 78;
}

function matchCodedNumber(student: string, official: string): boolean {
  const numeric = /^[+-]?\d+(?:[,.]\d+)?$/;
  const entered = student.trim();
  const expected = official.trim();
  return numeric.test(entered) && numeric.test(expected) &&
    Number(entered.replace(",", ".")) === Number(expected.replace(",", "."));
}

export function scoreOfficialGraduationAnswers(exam: Exam, answers: GradedAnswer[]) {
  const byId = new Map(exam.questions.map((question) => [question.id, question]));
  const scaled = answers.map((answer) => {
    const question = byId.get(answer.questionId);
    if (!question) throw new Error(`Naməlum sual: ${answer.questionId}`);
    const maxScore = officialQuestionPoints(question);
    const awardedScore = answer.maxScore > 0
      ? maxScore * answer.awardedScore / answer.maxScore
      : 0;
    return { ...answer, awardedScore, maxScore };
  });
  return {
    answers: scaled,
    score: scaled.reduce((sum, answer) => sum + answer.awardedScore, 0),
    maxScore: 300,
  };
}

export function gradeExam(
  exam: Exam,
  answers: AnswerMap,
  attemptId: string,
  startedAt: string,
  solutionImagePaths: Record<string, string> = {},
): AttemptResult {
  const gradedAnswers = exam.questions.map((question) => {
    const studentAnswer = answers[question.id] ?? "";
    const solutionImagePath = solutionImagePaths[question.id] ?? null;
    if (question.type === "multiple_choice") {
      return gradeMultipleChoice(question, studentAnswer || undefined);
    }

    const accepted = question.type === "short_answer"
      ? matchAcceptedAnswer(studentAnswer, question.acceptedAnswers ?? [])
      : null;
    if (exam.usesOfficialScoring && isMathCodedAnswer(question) && studentAnswer.trim()) {
      const isCorrect = matchCodedNumber(studentAnswer, question.officialAnswer ?? "");
      return {
        questionId: question.id,
        questionNumber: question.number,
        selectedOptionId: null,
        selectedKey: null,
        correctKey: null,
        selectedAnswerText: studentAnswer,
        solutionImagePath,
        status: isCorrect ? "correct" as const : "wrong" as const,
        isCorrect,
        awardedScore: isCorrect ? 1 : 0,
        maxScore: 1,
        subject: question.subject,
        topic: question.topic,
      };
    }
    const maxScore = question.type === "short_answer"
      ? question.officialRubric?.maxScore ?? Math.max(0, ...(question.acceptedAnswers ?? []).map((answer) => answer.score))
      : question.officialRubric?.maxScore ?? 0;

    if (accepted) {
      const isCorrect = maxScore > 0 && accepted.score === maxScore;
      return {
        questionId: question.id,
        questionNumber: question.number,
        selectedOptionId: null,
        selectedKey: null,
        correctKey: null,
        selectedAnswerText: studentAnswer,
        solutionImagePath,
        status: isCorrect ? "correct" as const : "wrong" as const,
        isCorrect,
        awardedScore: accepted.score,
        maxScore,
        subject: question.subject,
        topic: question.topic,
      };
    }

    if (exam.usesOfficialScoring && question.subject === "İngilis dili" &&
        question.type === "short_answer" && (question.acceptedAnswers?.length ?? 0) > 0 &&
        studentAnswer.trim()) {
      return {
        questionId: question.id,
        questionNumber: question.number,
        selectedOptionId: null,
        selectedKey: null,
        correctKey: null,
        selectedAnswerText: studentAnswer,
        solutionImagePath,
        status: "wrong" as const,
        isCorrect: false,
        awardedScore: 0,
        maxScore,
        subject: question.subject,
        topic: question.topic,
      };
    }

    const unanswered = !studentAnswer.trim() && !solutionImagePath;
    return {
      questionId: question.id,
      questionNumber: question.number,
      selectedOptionId: null,
      selectedKey: null,
      correctKey: null,
      selectedAnswerText: studentAnswer || null,
      solutionImagePath,
      status: unanswered ? "unanswered" as const : "ungraded" as const,
      isCorrect: null,
      awardedScore: 0,
      maxScore: 0,
      subject: question.subject,
      topic: question.topic,
    };
  });
  const totals = exam.usesOfficialScoring
    ? scoreOfficialGraduationAnswers(exam, gradedAnswers)
    : { ...calculateExamScore(gradedAnswers), answers: gradedAnswers };
  const durationSeconds = Math.max(
    0,
    Math.round((Date.now() - new Date(startedAt).getTime()) / 1000),
  );

  return {
    attemptId,
    examId: exam.id,
    submittedAt: new Date().toISOString(),
    durationSeconds,
    ...totals,
    answers: totals.answers,
  };
}

// Old browser/DB attempts stored one point per closed question. Rebuild their
// result from the original selections whenever the scoring rules are updated.
export function regradeAttemptResult(exam: Exam, result: AttemptResult): AttemptResult {
  if (!exam.usesOfficialScoring) return result;
  const byId = new Map(result.answers.map((answer) => [answer.questionId, answer]));
  const answers: AnswerMap = {};
  const imagePaths: Record<string, string> = {};
  const legacyText = new Map<string, string>();
  for (const question of exam.questions) {
    const previous = byId.get(question.id);
    if (!previous) continue;
    if (question.type === "multiple_choice") {
      const option = question.options.find((item) => item.key === previous.selectedKey) ??
        question.options.find((item) => item.id === previous.selectedOptionId) ??
        question.options.find((item) => normalizeStudentAnswer(item.text) === normalizeStudentAnswer(previous.selectedAnswerText ?? ""));
      if (option) answers[question.id] = option.id;
      else if (previous.selectedAnswerText?.trim()) legacyText.set(question.id, previous.selectedAnswerText);
    } else {
      answers[question.id] = previous.selectedAnswerText ?? "";
      if (previous.solutionImagePath) imagePaths[question.id] = previous.solutionImagePath;
    }
  }
  const refreshed = gradeExam(exam, answers, result.attemptId, result.submittedAt, imagePaths);
  return {
    ...refreshed,
    submittedAt: result.submittedAt,
    durationSeconds: result.durationSeconds,
    answers: refreshed.answers.map((answer) => legacyText.has(answer.questionId)
      ? { ...answer, selectedAnswerText: legacyText.get(answer.questionId), status: "ungraded" as const, isCorrect: null }
      : answer),
  };
}
