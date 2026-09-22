import { describe, expect, it } from "vitest";
import { gradeExam } from "../grading/grading";
import { officialTestExam } from "./official-exams";

describe("official 79-question incomplete test dataset", () => {
  it("uses the official subject sequence and sequential student numbering", () => {
    expect(officialTestExam.subjectOrder).toEqual([
      "İngilis dili",
      "Azərbaycan dili",
      "Riyaziyyat",
    ]);
    expect(officialTestExam.subjects).toEqual(officialTestExam.subjectOrder);
    expect(officialTestExam.questions.map((question) => question.subject)).toEqual([
      ...Array(24).fill("İngilis dili"),
      ...Array(30).fill("Azərbaycan dili"),
      ...Array(25).fill("Riyaziyyat"),
    ]);
    expect(officialTestExam.questions.map((question) => question.number)).toEqual(
      Array.from({ length: 79 }, (_, index) => index + 1),
    );
  });

  it("contains every verified non-listening question for each requested subject", () => {
    const counts = officialTestExam.questions.reduce<Record<string, number>>(
      (result, question) => ({
        ...result,
        [question.subject]: (result[question.subject] ?? 0) + 1,
      }),
      {},
    );

    expect(officialTestExam.questions).toHaveLength(79);
    expect(counts).toEqual({
      "Azərbaycan dili": 30,
      Riyaziyyat: 25,
      "İngilis dili": 24,
    });
  });

  it("keeps every official multiple-choice answer attached to a real option", () => {
    const multipleChoice = officialTestExam.questions.filter((question) => question.type === "multiple_choice");
    for (const question of multipleChoice) {
      expect(question.options.filter((option) => option.isCorrect)).toHaveLength(1);
    }
    expect(officialTestExam.questions.filter((question) => question.type !== "multiple_choice").every((question) => question.officialAnswer)).toBe(true);
  });

  it("grades all official choices deterministically", () => {
    const answers: Record<string, string> = {};
    const multipleChoice = officialTestExam.questions.filter((question) => question.type === "multiple_choice");
    for (const question of multipleChoice) {
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

    expect(result.score).toBe(multipleChoice.length);
    expect(result.answers.filter((answer) => answer.status === "correct")).toHaveLength(multipleChoice.length);
    expect(result.answers.filter((answer) => answer.status === "unanswered")).toHaveLength(officialTestExam.questions.length - multipleChoice.length);
  });
});
