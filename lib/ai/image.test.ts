import { describe, expect, it } from "vitest";
import { loadOfficialQuestionImage } from "./image";

describe("official question images", () => {
  it("loads the cropped official diagram for server-side Gemini input", async () => {
    const image = await loadOfficialQuestionImage("/exam-assets/2025-03-02/math-066-probability-chart.png");
    expect(Buffer.from(image, "base64").subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("rejects paths outside the trusted asset folder", async () => {
    await expect(loadOfficialQuestionImage("/exam-assets/2025-03-02/../../.env.local")).rejects.toThrow();
  });
});
