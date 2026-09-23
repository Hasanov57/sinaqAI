import { describe, expect, it } from "vitest";
import { getPendingAiIntent } from "./pending-ai";

describe("pending AI explanation intent", () => {
  it("resumes exactly the explicitly requested wrong question and removes the action", () => {
    expect(getPendingAiIntent("https://sinaqai.vercel.app/results/abc?aiExplain=q-14#question-q-14", ["q-14"])).toEqual({
      questionId: "q-14", cleanPath: "/results/abc#question-q-14",
    });
  });
  it("ignores questions that were not answered incorrectly", () => {
    expect(getPendingAiIntent("https://sinaqai.vercel.app/results/abc?aiExplain=q-99", ["q-14"])).toBeNull();
  });
});
