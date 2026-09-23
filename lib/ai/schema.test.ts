import { afterEach, describe, expect, it, vi } from "vitest";
import { AiNotConfiguredError, AiProviderError, generateWithGemini, getGeminiApiKey } from "./gemini";
import { answerCacheHash, parseCachedExplanation } from "./cache";
import { buildExplanationPrompt, type ExplanationContext } from "./prompts";
import { parseQuestionExplanation } from "./schema";

const context: ExplanationContext = {
  subject: "Riyaziyyat", topic: "Tənlik", question: "2 + 2 = ?",
  options: [{ key: "A", text: "3" }, { key: "B", text: "4" }],
  selected: { key: "A", text: "3" }, correct: { key: "B", text: "4" },
  officialExplanation: "2 + 2 = 4.",
};
const valid = { summary: "Cavab B-dir.", whyWrong: "A variantı 3 göstərir.", correctReasoning: "2 + 2 = 4.", keyRule: "Toplayın.", miniExample: null };

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("grounded structured explanations", () => {
  it("rejects malformed Gemini JSON", () => {
    expect(parseQuestionExplanation({ summary: "Only one field" })).toBeNull();
    expect(parseCachedExplanation("not json")).toBeNull();
  });
  it("uses a different cache key for different wrong answers", () => {
    expect(answerCacheHash("A", "gemini-3.8-flash")).not.toBe(answerCacheHash("C", "gemini-3.8-flash"));
    expect(answerCacheHash("A", "gemini-3.8-flash")).not.toBe(answerCacheHash("A", "gemini-3.7-flash"));
    expect(parseCachedExplanation(JSON.stringify(valid))).toEqual(valid);
  });
  it("sends only academic context and strips DİM booklet headers", () => {
    const prompt = buildExplanationPrompt({ ...context, question: "A variantı 21 saylı test tapşırığı\nB variantı 27 saylı test tapşırığı\n2 + 2 = ?" });
    expect(prompt).toContain("2 + 2 = ?");
    expect(prompt).not.toContain("saylı test tapşırığı");
    expect(prompt).not.toContain("email");
  });
  it("returns a validated structured response from Gemini", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const mock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(valid) }] } }] }) });
    vi.stubGlobal("fetch", mock);
    expect(await generateWithGemini(context, "gemini-3.8-flash")).toEqual(valid);
    expect(mock.mock.calls[0][0]).toContain("gemini-3.8-flash");
    const body = JSON.parse(mock.mock.calls[0][1].body);
    expect(body.generationConfig).toMatchObject({
      responseMimeType: "application/json",
      responseSchema: { properties: { miniExample: { type: "STRING", nullable: true } } },
    });
    expect(body.generationConfig.responseFormat).toBeUndefined();
  });
  it("accepts the existing server-only AI_API_KEY name", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("AI_API_KEY", "existing-gemini-key");
    expect(getGeminiApiKey()).toBe("existing-gemini-key");
  });
  it("includes a trusted question diagram without putting base64 in the text prompt", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const mock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(valid) }] } }] }) });
    vi.stubGlobal("fetch", mock);
    await generateWithGemini({ ...context, questionImageBase64: "png-data" }, "gemini-3.8-flash");
    const body = JSON.parse(mock.mock.calls[0][1].body);
    expect(body.contents[0].parts[1]).toEqual({ inlineData: { mimeType: "image/png", data: "png-data" } });
    expect(body.contents[0].parts[0].text).not.toContain("png-data");
  });
  it("reports missing configuration and provider failures without exposing them to the UI", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("AI_API_KEY", "");
    await expect(generateWithGemini(context, "gemini-3.8-flash")).rejects.toBeInstanceOf(AiNotConfiguredError);
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }) }));
    await expect(generateWithGemini(context, "gemini-3.8-flash")).rejects.toBeInstanceOf(AiProviderError);
  });
});
