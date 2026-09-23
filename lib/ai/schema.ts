import { z } from "zod";

export const explanationSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  whyWrong: z.string().trim().min(1).max(900),
  correctReasoning: z.string().trim().min(1).max(1_200),
  keyRule: z.string().trim().min(1).max(600),
  miniExample: z.string().trim().min(1).max(700).nullable(),
});

export type QuestionExplanation = z.infer<typeof explanationSchema>;

export function parseQuestionExplanation(value: unknown): QuestionExplanation | null {
  const parsed = explanationSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
