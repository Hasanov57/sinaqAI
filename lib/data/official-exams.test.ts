import { describe, expect, it } from "vitest";
import { gradeExam } from "../grading/grading";
import { officialTestExam } from "./official-exams";

describe("official 15-question test dataset", () => {
  it("contains exactly five questions for each requested subject", () => {
    const counts = officialTestExam.questions.reduce<Record<string, number>>(
      (result, question) => ({
        ...result,
        [question.subject]: (result[question.subject] ?? 0) + 1,
      }),
      {},
    );

    expect(officialTestExam.questions).toHaveLength(15);
    expect(counts).toEqual({
      "Azərbaycan dili": 5,
      Riyaziyyat: 5,
      "İngilis dili": 5,
    });
  });

  it("keeps every official answer attached to a real option", () => {
    for (const question of officialTestExam.questions) {
      expect(question.options.filter((option) => option.isCorrect)).toHaveLength(1);
    }
  });

  it("grades all official choices deterministically", () => {
    const answers: Record<string, string> = {};
    for (const question of officialTestExam.questions) {
      const correctOption = question.options.find((option) => option.isCorrect);
      if (!correctOption) throw new Error(`Missing official answer for ${question.id}`);
      answers[question.id] = correctOption.id;
    }
    const result = gradeExam(
      officialTestExam,
      answers,
      "official-test",
      new Date().toISOString(),
    );

    expect(result.score).toBe(15);
    expect(result.answers.every((answer) => answer.isCorrect)).toBe(true);
  });
});
