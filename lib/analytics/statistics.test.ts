import { describe, expect, it } from "vitest";
import { calculateTopicStatistics, identifyWeakTopics } from "./statistics";
import type { GradedAnswer } from "@/types/exam";

function answer(topic: string, correct: boolean): GradedAnswer {
  return {
    questionId: crypto.randomUUID(),
    questionNumber: 1,
    selectedOptionId: "option",
    selectedKey: "A",
    correctKey: correct ? "A" : "B",
    status: correct ? "correct" : "wrong",
    isCorrect: correct,
    awardedScore: correct ? 1 : 0,
    maxScore: 1,
    subject: "Riyaziyyat",
    topic,
  };
}

describe("topic statistics", () => {
  it("calculates percentages using deterministic arithmetic", () => {
    const statistics = calculateTopicStatistics([
      answer("Ehtimal", true),
      answer("Ehtimal", false),
      answer("Ehtimal", false),
    ]);
    expect(statistics[0]).toMatchObject({ questionsSeen: 3, questionsCorrect: 1, accuracyPercentage: 33 });
  });

  it("does not label a topic weak before enough questions", () => {
    const statistics = calculateTopicStatistics([answer("Həndəsə", false)]);
    expect(identifyWeakTopics(statistics, 3, 60)).toEqual([]);
  });
});
