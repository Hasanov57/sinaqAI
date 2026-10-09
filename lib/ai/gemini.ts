import { buildExplanationPrompt, systemInstruction, type ExplanationContext } from "./prompts";
import { parseQuestionExplanation, type QuestionExplanation } from "./schema";
import { aiModelCandidates } from "./model-fallback";

export class AiNotConfiguredError extends Error {}
export class AiProviderError extends Error {
  constructor(message: string, public readonly statusCode?: number) { super(message); }
}

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
    const models = aiModelCandidates(model);
    for (const [modelIndex, activeModel] of models.entries()) {
      const requestBody = JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ parts: [
          { text: buildExplanationPrompt(context) },
          ...(context.questionImageBase64 ? [{ inlineData: { mimeType: "image/png", data: context.questionImageBase64 } }] : []),
        ] }],
        generationConfig: {
          maxOutputTokens: 2_400,
          ...(/^gemini-3(?:\.|-)/.test(activeModel) ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
          responseMimeType: "application/json",
          responseSchema,
        },
      });
      for (let attempt = 0; attempt < 3; attempt++) {
        let response: Response;
        try {
          response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(activeModel)}:generateContent`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
            body: requestBody,
            signal: controller.signal,
          });
        } catch {
          if (controller.signal.aborted) throw new AiProviderError("Gemini request timed out");
          if (attempt === 2) {
            if (modelIndex < models.length - 1) break;
            throw new AiProviderError("Gemini request failed");
          }
          await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** attempt));
          continue;
        }
        if (!response.ok) {
          if (response.status === 429 && modelIndex < models.length - 1) break;
          const retryable = response.status === 408 || response.status >= 500;
          if (retryable && attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** attempt));
            continue;
          }
          if (retryable && modelIndex < models.length - 1) break;
          throw new AiProviderError(`Gemini HTTP ${response.status}`, response.status);
        }
        const result: unknown = await response.json();
        const candidate = (result as { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }> })?.candidates?.[0];
        const raw = candidate?.content?.parts?.map((part) => part.text ?? "").join("").trim();
        if (!raw) {
          if (modelIndex < models.length - 1) break;
          throw new AiProviderError(`Gemini returned no text (${candidate?.finishReason ?? "unknown"})`);
        }
        let parsed: unknown;
        try { parsed = JSON.parse(raw); }
        catch {
          if (modelIndex < models.length - 1) break;
          throw new AiProviderError("Gemini returned invalid JSON");
        }
        const explanation = parseQuestionExplanation(parsed);
        if (!explanation) {
          if (modelIndex < models.length - 1) break;
          throw new AiProviderError("Gemini returned an invalid explanation");
        }
        return explanation;
      }
    }
    throw new AiProviderError("Gemini models unavailable");
  } catch (error) {
    if (error instanceof AiProviderError) throw error;
    throw new AiProviderError("Gemini request failed");
  } finally {
    clearTimeout(timeout);
  }
}
