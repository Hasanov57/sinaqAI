import { describe, expect, it } from "vitest";
import { gradeExam, regradeAttemptResult } from "../grading/grading";
import { officialTestExam } from "./official-exams";
import { stripDimSourceHeader } from "./sanitize-dim";

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

  it("grades all official choices with the 2025 subject coefficients", () => {
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

    expect(result.score).toBeCloseTo(20 * 100 / 37 + 20 * 5 / 2 + 13 * 25 / 8);
    expect(result.maxScore).toBe(300);
    expect(result.answers.filter((answer) => answer.status === "correct")).toHaveLength(multipleChoice.length);
    expect(result.answers.filter((answer) => answer.status === "unanswered")).toHaveLength(officialTestExam.questions.length - multipleChoice.length);
  });

  it("uses the verified 20 closed/10 written language split", () => {
    const language = officialTestExam.questions.filter((question) => question.subject === "Azərbaycan dili");
    expect(language.filter((question) => question.type === "multiple_choice")).toHaveLength(20);
    expect(language.filter((question) => question.type !== "multiple_choice")).toHaveLength(10);
    expect(language.find((question) => question.variantNumbers?.A === 51)?.options.find((option) => option.isCorrect)?.key).toBe("C");
    expect(language.find((question) => question.variantNumbers?.A === 54)?.options.find((option) => option.isCorrect)?.key).toBe("A");
  });

  it("grades exact coded math answers but leaves written solutions for review", () => {
    const coded = officialTestExam.questions.find((question) => question.variantNumbers?.A === 76 && question.subject === "Riyaziyyat");
    const written = officialTestExam.questions.find((question) => question.variantNumbers?.A === 79 && question.subject === "Riyaziyyat");
    if (!coded || !written) throw new Error("Expected math questions were not found");
    const result = gradeExam(officialTestExam, { [coded.id]: "1.5", [written.id]: "4" }, "coded-test", new Date().toISOString());
    expect(result.answers.find((answer) => answer.questionId === coded.id)).toMatchObject({ status: "correct", awardedScore: 25 / 8 });
    expect(result.answers.find((answer) => answer.questionId === written.id)).toMatchObject({ status: "ungraded", awardedScore: 0, maxScore: 25 / 4 });
  });

  it("checks the two English one-word answers against the PDF and leaves longer writing for AI review", () => {
    const word = officialTestExam.questions.find((question) => question.id === "2025-03-02-en-021");
    const definition = officialTestExam.questions.find((question) => question.id === "2025-03-02-en-022");
    const writing = officialTestExam.questions.find((question) => question.id === "2025-03-02-en-024");
    if (!word || !definition || !writing) throw new Error("English questions were not found");
    const result = gradeExam(officialTestExam, {
      [word.id]: "Huge.",
      [definition.id]: "rebuild",
      [writing.id]: "We learn about history. We learn about culture. We see old architecture.",
    }, "english-open-test", new Date().toISOString());
    expect(result.answers.find((answer) => answer.questionId === word.id)).toMatchObject({ status: "correct", awardedScore: 200 / 37 });
    expect(result.answers.find((answer) => answer.questionId === definition.id)).toMatchObject({ status: "wrong", awardedScore: 0 });
    expect(result.answers.find((answer) => answer.questionId === writing.id)).toMatchObject({ status: "ungraded", awardedScore: 0 });
  });

  it("recalculates a saved result that used the old one-point-per-choice rule", () => {
    const question = officialTestExam.questions.find((item) => item.subject === "Azərbaycan dili" && item.type === "multiple_choice");
    if (!question) throw new Error("Expected a language choice question");
    const correctOption = question.options.find((option) => option.isCorrect);
    if (!correctOption) throw new Error("Expected an official answer");
    const original = gradeExam(officialTestExam, { [question.id]: correctOption.id }, "saved-test", new Date().toISOString());
    const oldResult = { ...original, score: 1, maxScore: 79, answers: original.answers.map((answer) => answer.questionId === question.id ? { ...answer, awardedScore: 1, maxScore: 1 } : answer) };
    const refreshed = regradeAttemptResult(officialTestExam, oldResult);
    expect(refreshed.score).toBe(2.5);
    expect(refreshed.maxScore).toBe(300);
    expect(refreshed.answers.find((answer) => answer.questionId === question.id)?.status).toBe("correct");
  });

  it("keeps booklet source headers out of all visible question and passage text", () => {
    for (const text of [
      ...officialTestExam.questions.map((question) => question.text),
      ...(officialTestExam.passages ?? []).map((passage) => passage.text ?? ""),
    ]) {
      expect(stripDimSourceHeader(text).sourceVariantNumbers).toBeNull();
    }
  });
});
