import { buildExplanationPrompt, systemInstruction, type ExplanationContext } from "./prompts";
import { parseQuestionExplanation, type QuestionExplanation } from "./schema";

export class AiNotConfiguredError extends Error {}
export class AiProviderError extends Error {}

export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.AI_API_KEY || undefined;
}

const responseSchema = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    whyWrong: { type: "STRING" },
    correctReasoning: { type: "STRING" },
    keyRule: { type: "STRING" },
    miniExample: { type: "STRING", nullable: true },
  },
  required: ["summary", "whyWrong", "correctReasoning", "keyRule", "miniExample"],
};

export async function generateWithGemini(context: ExplanationContext, model: string): Promise<QuestionExplanation> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") console.warn("GEMINI_API_KEY is missing; AI explanations are disabled.");
    throw new AiNotConfiguredError("Gemini key is missing");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50_000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ parts: [
          { text: buildExplanationPrompt(context) },
          ...(context.questionImageBase64 ? [{ inlineData: { mimeType: "image/png", data: context.questionImageBase64 } }] : []),
        ] }],
        generationConfig: {
          maxOutputTokens: 1_200,
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new AiProviderError(`Gemini HTTP ${response.status}`);
    const result: unknown = await response.json();
    const parts = (result as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })?.candidates?.[0]?.content?.parts;
    const raw = parts?.map((part) => part.text ?? "").join("").trim();
    if (!raw) throw new AiProviderError("Gemini returned no text");
    const explanation = parseQuestionExplanation(JSON.parse(raw));
    if (!explanation) throw new AiProviderError("Gemini returned an invalid explanation");
    return explanation;
  } catch (error) {
    if (error instanceof AiProviderError) throw error;
    throw new AiProviderError("Gemini request failed");
  } finally {
    clearTimeout(timeout);
  }
}
