import { z } from "zod";
import { NextResponse } from "next/server";
import { getExam } from "@/lib/data/demo-exams";
import { gradeExam } from "@/lib/grading/grading";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const answerSchema = z.object({
  questionId: z.string().min(1).max(120),
  selectedKey: z.string().regex(/^[A-H]$/).nullable(),
  selectedAnswerText: z.string().max(6_000).nullable(),
  solutionImagePath: z.string().max(500).nullable(),
});
const payloadSchema = z.object({
  attemptId: z.uuid(),
  examId: z.string().min(1).max(120),
  durationSeconds: z.number().int().min(0).max(604_800),
  answers: z.array(answerSchema).max(120),
});

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Sorğu qəbul edilmir." }, { status: 403 });
  const supabase = await createSupabaseServerClient().catch(() => null);
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!user) return NextResponse.json({ error: "Daxil olun." }, { status: 401 });

  const raw = await request.text();
  if (raw.length > 600_000) return NextResponse.json({ error: "Sorğu çox böyükdür." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw || "null"); }
  catch { return NextResponse.json({ error: "İmtahan məlumatı yanlışdır." }, { status: 400 }); }
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "İmtahan məlumatı yanlışdır." }, { status: 400 });
  const payload = parsed.data;
  const exam = getExam(payload.examId);
  if (!exam || exam.status === "demo") return NextResponse.json({ error: "Rəsmi imtahan tapılmadı." }, { status: 404 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Nəticələrin saxlanması aktiv deyil." }, { status: 503 });
  if (new Set(payload.answers.map((answer) => answer.questionId)).size !== payload.answers.length) {
    return NextResponse.json({ error: "Təkrar sual cavabı göndərilib." }, { status: 400 });
  }

  const examResult = await admin.from("exams").select("id").eq("dataset_key", exam.id).maybeSingle();
  const examDbId = examResult.data?.id;
  if (examResult.error || !examDbId) return NextResponse.json({ error: "İmtahan bazada tapılmadı." }, { status: 503 });

  const existing = await admin.from("exam_attempts").select("id,user_id,exam_id,status").eq("id", payload.attemptId).maybeSingle();
  if (existing.error) return NextResponse.json({ error: "Cəhd yoxlanılmadı." }, { status: 503 });
  if (existing.data && (existing.data.user_id !== user.id || existing.data.exam_id !== examDbId)) {
    return NextResponse.json({ error: "Bu cəhdə giriş yoxdur." }, { status: 403 });
  }
  if (existing.data?.status === "submitted") return NextResponse.json({ persisted: true });

  const questionsResult = await admin.from("questions").select("id,canonical_id").eq("exam_id", examDbId);
  if (questionsResult.error || !questionsResult.data || questionsResult.data.length !== exam.questions.length) {
    return NextResponse.json({ error: "İmtahan sualları bazada tam deyil." }, { status: 503 });
  }
  const questionIds = questionsResult.data.map((question) => question.id);
  const optionsResult = await admin.from("question_options").select("id,question_id,option_key").in("question_id", questionIds);
  if (optionsResult.error || !optionsResult.data) return NextResponse.json({ error: "Cavab variantları yüklənmədi." }, { status: 503 });
  const questionDbIds = new Map(questionsResult.data.map((question) => [question.canonical_id, question.id]));
  const optionDbIds = new Map(optionsResult.data.map((option) => [`${option.question_id}:${option.option_key}`, option.id]));

  const answerMap: Record<string, string> = {};
  const solutionImagePaths: Record<string, string> = {};
  for (const answer of payload.answers) {
    const question = exam.questions.find((item) => item.id === answer.questionId);
    if (!question || !questionDbIds.has(answer.questionId)) return NextResponse.json({ error: "Naməlum sual." }, { status: 400 });
    if (question.type === "multiple_choice") {
      if (answer.selectedKey) {
        const option = question.options.find((item) => item.key === answer.selectedKey);
        if (!option || !optionDbIds.has(`${questionDbIds.get(question.id)}:${option.key}`)) {
          return NextResponse.json({ error: "Naməlum cavab variantı." }, { status: 400 });
        }
        answerMap[question.id] = option.id;
      }
    } else {
      answerMap[question.id] = answer.selectedAnswerText ?? "";
      if (answer.solutionImagePath) {
        const expectedPrefix = `${user.id}/${encodeURIComponent(exam.id)}/${encodeURIComponent(question.id)}/`;
        if (!answer.solutionImagePath.startsWith(expectedPrefix)) return NextResponse.json({ error: "Həll şəkli yolu yanlışdır." }, { status: 400 });
        solutionImagePaths[question.id] = answer.solutionImagePath;
      }
    }
  }

  const startedAt = new Date(Date.now() - payload.durationSeconds * 1_000).toISOString();
  const graded = gradeExam(exam, answerMap, payload.attemptId, startedAt, solutionImagePaths);
  if (!existing.data) {
    const created = await admin.from("exam_attempts").insert({
      id: payload.attemptId, user_id: user.id, exam_id: examDbId, started_at: startedAt, status: "in_progress",
    });
    if (created.error) return NextResponse.json({ error: "Cəhd saxlanmadı." }, { status: 503 });
  }

  const rows = graded.answers.filter((answer) => answer.status !== "unanswered").map((answer) => {
    const questionId = questionDbIds.get(answer.questionId)!;
    return {
      attempt_id: payload.attemptId,
      question_id: questionId,
      selected_option_id: answer.selectedKey ? optionDbIds.get(`${questionId}:${answer.selectedKey}`) ?? null : null,
      text_answer: answer.selectedKey ? null : answer.selectedAnswerText ?? "",
      solution_image_path: answer.solutionImagePath ?? null,
      awarded_score: answer.status === "ungraded" ? null : answer.awardedScore,
      is_correct: answer.isCorrect,
      grading_method: answer.status === "ungraded" ? "ungraded" : answer.selectedKey ? "exact" : "official_match",
      needs_review: answer.status === "ungraded",
    };
  });
  if (rows.length) {
    const saved = await admin.from("student_answers").upsert(rows, { onConflict: "attempt_id,question_id" });
    if (saved.error) return NextResponse.json({ error: "Cavablar saxlanmadı." }, { status: 503 });
  }
  const finalized = await admin.from("exam_attempts").update({
    status: "submitted", submitted_at: new Date().toISOString(), total_score: graded.score,
    max_score: graded.maxScore, duration_seconds: payload.durationSeconds,
  }).eq("id", payload.attemptId).eq("user_id", user.id).eq("status", "in_progress")
    .select("id").maybeSingle();
  if (finalized.error) return NextResponse.json({ error: "Nəticə tamamlanmadı." }, { status: 503 });
  if (!finalized.data) return NextResponse.json({ error: "Nəticə tamamlanmadı. Səhifəni yeniləyib yenidən cəhd edin." }, { status: 409 });
  return NextResponse.json({ persisted: true });
}
