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
  const totals = calculateExamScore(gradedAnswers);
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
    answers: gradedAnswers,
  };
}
