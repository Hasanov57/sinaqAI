import type { AttemptResult } from "@/types/exam";

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
  if (!response.ok) throw new Error("Nəticəni hesabınızda saxlamaq mümkün olmadı.");
}
