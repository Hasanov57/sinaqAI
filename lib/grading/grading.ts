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
): AttemptResult {
  const gradedAnswers = exam.questions.map((question) =>
    gradeMultipleChoice(question, answers[question.id]),
  );
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
