export function aiModelCandidates(primary: string): string[] {
  const fallback = process.env.AI_FALLBACK_MODEL?.trim() || "gemini-3.5-flash-lite";
  return fallback === primary ? [primary] : [primary, fallback];
}
