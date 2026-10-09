import { z } from "zod";
import { NextResponse } from "next/server";
import { anonymousAiVisitorHash } from "@/lib/ai/anonymous-quota";
import { answerCacheHash, parseCachedExplanation } from "@/lib/ai/cache";
import { AiNotConfiguredError, AiProviderError, getGeminiApiKey } from "@/lib/ai/gemini";
import { loadOfficialQuestionImage } from "@/lib/ai/image";
import { generateQuestionExplanation } from "@/lib/ai/provider";
import type { ExplanationContext } from "@/lib/ai/prompts";
import { getExam } from "@/lib/data/demo-exams";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const inputSchema = z.object({
  examId: z.string().min(1).max(120),
  questionId: z.string().min(1).max(120),
  selectedKey: z.string().regex(/^[A-H]$/),
});
const unavailable = "AI izahını hazırda yaratmaq mümkün olmadı. Bir az sonra yenidən cəhd edin.";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Sorğu qəbul edilmir." }, { status: 403 });
  const raw = await request.text();
  if (raw.length > 2_000) return NextResponse.json({ error: "Sorğu çox böyükdür." }, { status: 413 });
  let parsedBody: unknown;
  try { parsedBody = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Sorğu məlumatı yanlışdır." }, { status: 400 }); }
  const parsed = inputSchema.safeParse(parsedBody);
  if (!parsed.success) return NextResponse.json({ error: "Sorğu məlumatı yanlışdır." }, { status: 400 });

  const { examId, questionId, selectedKey } = parsed.data;
  const exam = getExam(examId);
  if (!exam || exam.status !== "draft") return NextResponse.json({ error: "Rəsmi imtahan tapılmadı." }, { status: 404 });
  const question = exam.questions.find((item) => item.id === questionId);
  if (!question || question.type !== "multiple_choice") {
    return NextResponse.json({ error: "Bu sual üçün AI izahı mövcud deyil." }, { status: 404 });
  }
  const selected = question.options.find((option) => option.key === selectedKey);
  const correct = question.options.find((option) => option.isCorrect);
  if (!selected || !correct || selected.isCorrect) {
    return NextResponse.json({ error: "Yalnız səhv seçilmiş cavab üçün izah istəyə bilərsiniz." }, { status: 400 });
  }
  if (!question.officialExplanation) return NextResponse.json({ error: "Rəsmi izah mövcud deyil." }, { status: 503 });

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "AI xidməti hazırda aktiv deyil." }, { status: 503 });
  const examResult = await admin.from("exams").select("id").eq("dataset_key", examId).maybeSingle();
  if (examResult.error || !examResult.data) return NextResponse.json({ error: "İmtahan bazada tapılmadı." }, { status: 503 });
  const questionResult = await admin.from("questions").select("id").eq("exam_id", examResult.data.id).eq("canonical_id", questionId).maybeSingle();
  if (questionResult.error || !questionResult.data) return NextResponse.json({ error: "Sual bazada tapılmadı." }, { status: 503 });

  const model = process.env.AI_MODEL || "gemini-3.5-flash-lite";
  const studentAnswerHash = answerCacheHash(selectedKey, model);
  const cacheResult = await admin.from("ai_explanations").select("content")
    .eq("question_id", questionResult.data.id).is("user_id", null)
    .eq("student_answer_hash", studentAnswerHash).eq("explanation_type", "generic")
    .eq("model", model).maybeSingle();
  if (cacheResult.error) return NextResponse.json({ error: unavailable }, { status: 503 });
  const cached = cacheResult.data?.content ? parseCachedExplanation(cacheResult.data.content) : null;
  if (cached) return NextResponse.json({ explanation: cached, cached: true }, { headers: { "cache-control": "no-store" } });

  if ((process.env.AI_PROVIDER ?? "gemini") !== "gemini" || !getGeminiApiKey()) {
    return NextResponse.json({ error: "AI xidməti hazırda aktiv deyil." }, { status: 503 });
  }
  const visitorHash = anonymousAiVisitorHash(request);
  if (!visitorHash) return NextResponse.json({ error: "AI xidməti hazırda aktiv deyil." }, { status: 503 });
  const quota = await admin.rpc("consume_ai_anonymous_quota", { p_visitor_hash: visitorHash });
  if (quota.error) {
    console.error("Anonymous AI quota failed:", quota.error.code ?? "unknown");
    return NextResponse.json({ error: unavailable }, { status: 503 });
  }
  if (!quota.data) return NextResponse.json({ error: "AI izah limitinə çatdınız. Bir qədər sonra yenidən cəhd edin." }, { status: 429 });

  let questionImageBase64: string | undefined;
  if (question.questionImageUrl) {
    try { questionImageBase64 = await loadOfficialQuestionImage(question.questionImageUrl); }
    catch { return NextResponse.json({ error: "Rəsmi sual şəklini hazırda oxumaq mümkün olmadı." }, { status: 503 }); }
  }
  const context: ExplanationContext = {
    subject: question.subject,
    topic: question.topic,
    question: question.text || "Sualın mətni rəsmi şəkildədir; yalnız izahda verilən məlumata əsaslan.",
    passage: exam.passages?.find((passage) => passage.id === question.passageId)?.text,
    options: question.options.map((option) => ({ key: option.key, text: option.text || "Şəkilli variant" })),
    selected: { key: selected.key, text: selected.text || "Şəkilli variant" },
    correct: { key: correct.key, text: correct.text || "Şəkilli variant" },
    officialExplanation: question.officialExplanation,
    grade: exam.grade,
    questionImageBase64,
  };
  try {
    const explanation = await generateQuestionExplanation(context);
    const saved = await admin.from("ai_explanations").upsert({
      question_id: questionResult.data.id, user_id: null, student_answer_hash: studentAnswerHash,
      explanation_type: "generic", content: JSON.stringify(explanation), model,
    }, { onConflict: "question_id,user_id,student_answer_hash,explanation_type" });
    if (saved.error) console.warn("AI explanation cache write failed:", saved.error.code ?? "unknown");
    return NextResponse.json({ explanation, cached: false }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) return NextResponse.json({ error: "AI xidməti hazırda aktiv deyil." }, { status: 503 });
    console.error("AI explanation generation failed:", error instanceof AiProviderError ? error.message : "Unexpected provider failure");
    if (error instanceof AiProviderError && error.statusCode === 429) {
      return NextResponse.json({ error: "AI xidmətinin limiti dolub. Bir müddət sonra yenidən cəhd edin." }, { status: 429 });
    }
    return NextResponse.json({ error: unavailable }, { status: 502 });
  }
}
