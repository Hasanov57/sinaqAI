import type { AttemptResult } from "@/types/exam";

export class AttemptSyncError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "AttemptSyncError";
  }
}

export async function syncOfficialAttempt(result: AttemptResult): Promise<void> {
  const response = await fetch("/api/attempts/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      attemptId: result.attemptId,
      examId: result.examId,
      durationSeconds: result.durationSeconds,
      answers: result.answers.map((answer) => ({
        questionId: answer.questionId,
        selectedKey: answer.selectedKey,
        selectedAnswerText: answer.selectedAnswerText ?? null,
        solutionImagePath: answer.solutionImagePath ?? null,
      })),
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: unknown } | null;
    const message = typeof payload?.error === "string"
      ? payload.error
      : "Nəticəni hesabınızda saxlamaq mümkün olmadı. Bir az sonra yenidən cəhd edin.";
    throw new AttemptSyncError(message, response.status);
  }
}
