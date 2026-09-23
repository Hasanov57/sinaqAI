import { createHash } from "node:crypto";
import { parseQuestionExplanation } from "./schema";

export function answerCacheHash(optionKey: string, model: string): string {
  return createHash("sha256").update(`${model}:${optionKey}`).digest("hex");
}

export function parseCachedExplanation(value: string) {
  try { return parseQuestionExplanation(JSON.parse(value)); }
  catch { return null; }
}
