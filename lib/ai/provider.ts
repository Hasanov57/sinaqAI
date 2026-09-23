import { AiNotConfiguredError, generateWithGemini } from "./gemini";
import type { ExplanationContext } from "./prompts";
import type { QuestionExplanation } from "./schema";

export async function generateQuestionExplanation(context: ExplanationContext): Promise<QuestionExplanation> {
  if ((process.env.AI_PROVIDER ?? "gemini") !== "gemini") throw new AiNotConfiguredError("AI_PROVIDER is not Gemini");
  return generateWithGemini(context, process.env.AI_MODEL || "gemini-3.8-flash");
}
