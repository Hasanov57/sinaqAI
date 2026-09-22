import { describe, expect, it } from "vitest";
import { calculateExamScore, gradeMultipleChoice, matchAcceptedAnswer, normalizeStudentAnswer, validateAllowedScore } from "./grading";
import type { ExamQuestion, GradedAnswer } from "@/types/exam";

const question: ExamQuestion = {
  id: "q1",
  number: 1,
  subject: "Riyaziyyat",
  topic: "Tənliklər",
  type: "multiple_choice",
  text: "2 + 2 = ?",
  maxScore: 1,
  options: [
    { id: "a", key: "A", text: "3", isCorrect: false },
    { id: "b", key: "B", text: "4", isCorrect: true },
  ],
};

describe("deterministic grading", () => {
  it("grades a correct multiple-choice answer", () => {
    expect(gradeMultipleChoice(question, "b")).toMatchObject({ isCorrect: true, awardedScore: 1 });
  });

  it("grades a wrong multiple-choice answer", () => {
    expect(gradeMultipleChoice(question, "a")).toMatchObject({ isCorrect: false, awardedScore: 0 });
  });

  it("grades an unanswered multiple-choice question", () => {
    expect(gradeMultipleChoice(question)).toMatchObject({ selectedOptionId: null, isCorrect: false, awardedScore: 0 });
  });

  it("normalizes safe differences without changing meaning", () => {
    expect(normalizeStudentAnswer("  Bakı   şəhəri. ")).toBe("bakı şəhəri");
  });

  it("matches exact and alternative accepted answers", () => {
    const accepted = [
      { answerText: "beş", score: 1 },
      { answerText: "5", normalizedAnswer: "5", score: 1 },
      { answerText: "təxminən beş", score: 0.5 },
    ];
    expect(matchAcceptedAnswer(" BEŞ ", accepted)?.score).toBe(1);
    expect(matchAcceptedAnswer("5", accepted)?.score).toBe(1);
    expect(matchAcceptedAnswer("təxminən beş", accepted)?.score).toBe(0.5);
  });

  it("rejects an AI score outside the official allowed scores", () => {
    expect(validateAllowedScore(0.5, [0, 0.33, 1])).toBe(false);
    expect(validateAllowedScore(0.33, [0, 0.33, 1])).toBe(true);
  });

  it("calculates the exam score", () => {
    const answers = [
      { awardedScore: 1, maxScore: 1 },
      { awardedScore: 0.5, maxScore: 1 },
      { awardedScore: 0, maxScore: 2 },
    ] as GradedAnswer[];
    expect(calculateExamScore(answers)).toEqual({ score: 1.5, maxScore: 4 });
  });
});
