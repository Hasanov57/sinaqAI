import { z } from "zod";

export const openGradeSchema = z.object({
  score: z.enum(["0", "1/3", "1/2", "2/3", "1", "review"]),
  reason: z.string().trim().min(1).max(900),
  strength: z.string().trim().min(1).max(500),
  improvement: z.string().trim().min(1).max(700),
});

export type OpenGrade = z.infer<typeof openGradeSchema>;

export function openGradeFraction(score: OpenGrade["score"]): number | null {
  return ({ "0": 0, "1/3": 1 / 3, "1/2": 1 / 2, "2/3": 2 / 3, "1": 1, review: null })[score];
}
