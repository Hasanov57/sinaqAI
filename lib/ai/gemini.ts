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
  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ parts: [
      { text: buildExplanationPrompt(context) },
      ...(context.questionImageBase64 ? [{ inlineData: { mimeType: "image/png", data: context.questionImageBase64 } }] : []),
    ] }],
    generationConfig: {
      maxOutputTokens: 2_400,
      ...(/^gemini-3(?:\.|-)/.test(model) ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
      responseMimeType: "application/json",
      responseSchema,
    },
  });
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response: Response;
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
          body: requestBody,
          signal: controller.signal,
        });
      } catch {
        if (attempt === 2 || controller.signal.aborted) throw new AiProviderError("Gemini request failed or timed out");
        await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** attempt + Math.random() * 250));
        continue;
      }
      if (!response.ok) {
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        if (!retryable || attempt === 2) throw new AiProviderError(`Gemini HTTP ${response.status}`);
        await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** attempt + Math.random() * 250));
        continue;
      }
      const result: unknown = await response.json();
      const candidate = (result as { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }> })?.candidates?.[0];
      const raw = candidate?.content?.parts?.map((part) => part.text ?? "").join("").trim();
      if (!raw) throw new AiProviderError(`Gemini returned no text (${candidate?.finishReason ?? "unknown"})`);
      const explanation = parseQuestionExplanation(JSON.parse(raw));
      if (!explanation) throw new AiProviderError("Gemini returned an invalid explanation");
      return explanation;
    }
    throw new AiProviderError("Gemini retries exhausted");
  } catch (error) {
    if (error instanceof AiProviderError) throw error;
    throw new AiProviderError("Gemini request failed");
  } finally {
    clearTimeout(timeout);
  }
}
