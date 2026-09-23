import { z } from "zod";
import { NextResponse } from "next/server";
import { answerCacheHash, parseCachedExplanation } from "@/lib/ai/cache";
import { AiNotConfiguredError } from "@/lib/ai/gemini";
import { generateQuestionExplanation } from "@/lib/ai/provider";
import type { ExplanationContext } from "@/lib/ai/prompts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const inputSchema = z.object({ attemptId: z.uuid(), questionId: z.string().min(1).max(120) });
const unavailable = "AI izahını hazırda yaratmaq mümkün olmadı. Bir az sonra yenidən cəhd edin.";

async function authenticatedUser() {
  const supabase = await createSupabaseServerClient().catch(() => null);
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Sorğu qəbul edilmir." }, { status: 403 });
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ error: "AI izahı üçün hesabınıza daxil olun." }, { status: 401 });
  const raw = await request.text();
  if (raw.length > 2_000) return NextResponse.json({ error: "Sorğu çox böyükdür." }, { status: 413 });
  let parsedBody: unknown;
  try { parsedBody = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Sorğu məlumatı yanlışdır." }, { status: 400 }); }
  const parsed = inputSchema.safeParse(parsedBody);
  if (!parsed.success) return NextResponse.json({ error: "Sorğu məlumatı yanlışdır." }, { status: 400 });

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "AI xidməti hazırda aktiv deyil." }, { status: 503 });
  const { attemptId, questionId } = parsed.data;
  const attemptResult = await admin.from("exam_attempts").select("id,exam_id")
    .eq("id", attemptId).eq("user_id", user.id).eq("status", "submitted").maybeSingle();
  const attempt = attemptResult.data;
  if (attemptResult.error || !attempt) return NextResponse.json({ error: "Tamamlanmış nəticə tapılmadı." }, { status: 404 });
  const questionResult = await admin.from("questions")
    .select("id,question_type,question_text,official_explanation,topic_id,subject_id,grade_level,alt_standard,passage_id")
    .eq("exam_id", attempt.exam_id).eq("canonical_id", questionId).maybeSingle();
  const question = questionResult.data;
  if (questionResult.error || !question || question.question_type !== "multiple_choice") {
    return NextResponse.json({ error: "Bu sual üçün AI izahı mövcud deyil." }, { status: 404 });
  }
  const answerResult = await admin.from("student_answers")
    .select("selected_option_id,is_correct").eq("attempt_id", attemptId).eq("question_id", question.id).maybeSingle();
  if (answerResult.error || !answerResult.data?.selected_option_id || answerResult.data.is_correct !== false) {
    return NextResponse.json({ error: "Yalnız təqdim edilmiş səhv cavab üçün izah istəyə bilərsiniz." }, { status: 400 });
  }
  const optionsResult = await admin.from("question_options")
    .select("id,option_key,option_text,is_correct").eq("question_id", question.id).order("sort_order");
  const options = optionsResult.data ?? [];
  const selected = options.find((option) => option.id === answerResult.data?.selected_option_id);
  const correct = options.find((option) => option.is_correct);
  if (optionsResult.error || !selected || !correct || selected.is_correct || !question.official_explanation) {
    return NextResponse.json({ error: "Rəsmi cavab məlumatı tam deyil." }, { status: 503 });
  }

  const model = process.env.AI_MODEL || "gemini-3.8-flash";
  const studentAnswerHash = answerCacheHash(selected.option_key, model);
  const cacheResult = await admin.from("ai_explanations").select("content")
    .eq("question_id", question.id).eq("user_id", user.id)
    .eq("student_answer_hash", studentAnswerHash).eq("explanation_type", "personalized")
    .eq("model", model).maybeSingle();
  if (cacheResult.error) return NextResponse.json({ error: unavailable }, { status: 503 });
  const cached = cacheResult.data?.content ? parseCachedExplanation(cacheResult.data.content) : null;
  if (cached) return NextResponse.json({ explanation: cached, cached: true });

  if ((process.env.AI_PROVIDER ?? "gemini") !== "gemini" || !process.env.GEMINI_API_KEY) {
    if (process.env.NODE_ENV !== "production") console.warn("AI_PROVIDER or GEMINI_API_KEY is not configured.");
    return NextResponse.json({ error: "AI xidməti hazırda aktiv deyil." }, { status: 503 });
  }
  const quota = await admin.rpc("consume_ai_explanation_quota", { p_user_id: user.id });
  if (quota.error) return NextResponse.json({ error: unavailable }, { status: 503 });
  if (!quota.data) return NextResponse.json({ error: "Bir dəqiqədə ən çox 8 izah istəyə bilərsiniz." }, { status: 429 });

  const [subjectResult, topicResult, passageResult] = await Promise.all([
    admin.from("subjects").select("name").eq("id", question.subject_id).maybeSingle(),
    question.topic_id ? admin.from("topics").select("name").eq("id", question.topic_id).maybeSingle() : Promise.resolve(null),
    question.passage_id ? admin.from("passages").select("passage_text").eq("id", question.passage_id).maybeSingle() : Promise.resolve(null),
  ]);
  if (subjectResult.error || topicResult?.error || passageResult?.error) {
    return NextResponse.json({ error: unavailable }, { status: 503 });
  }
  const context: ExplanationContext = {
    subject: subjectResult.data?.name ?? "",
    topic: topicResult?.data?.name ?? "",
    question: question.question_text ?? "Sualın mətni rəsmi şəkildədir; yalnız izahda verilən məlumata əsaslan.",
    passage: passageResult?.data?.passage_text,
    options: options.map((option) => ({ key: option.option_key, text: option.option_text ?? "Şəkilli variant" })),
    selected: { key: selected.option_key, text: selected.option_text ?? "Şəkilli variant" },
    correct: { key: correct.option_key, text: correct.option_text ?? "Şəkilli variant" },
    officialExplanation: question.official_explanation,
    grade: question.grade_level,
    altStandard: question.alt_standard,
  };
  try {
    const explanation = await generateQuestionExplanation(context);
    const saved = await admin.from("ai_explanations").upsert({
      question_id: question.id, user_id: user.id, student_answer_hash: studentAnswerHash,
      explanation_type: "personalized", content: JSON.stringify(explanation), model,
    }, { onConflict: "question_id,user_id,student_answer_hash,explanation_type" });
    if (saved.error && process.env.NODE_ENV !== "production") console.warn("AI explanation cache write failed:", saved.error.message);
    return NextResponse.json({ explanation, cached: false });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) return NextResponse.json({ error: "AI xidməti hazırda aktiv deyil." }, { status: 503 });
    if (process.env.NODE_ENV !== "production") console.warn("AI explanation generation failed:", error);
    return NextResponse.json({ error: unavailable }, { status: 502 });
  }
}

export async function GET(request: Request) {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ error: "Daxil olun." }, { status: 401 });
  const attemptId = new URL(request.url).searchParams.get("attemptId");
  if (!attemptId || !z.uuid().safeParse(attemptId).success) return NextResponse.json({ error: "Cəhd yanlışdır." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ explanations: {} });
  const { data: attempt } = await admin.from("exam_attempts").select("id")
    .eq("id", attemptId).eq("user_id", user.id).eq("status", "submitted").maybeSingle();
  if (!attempt) return NextResponse.json({ explanations: {} });
  const { data: answers } = await admin.from("student_answers").select("question_id,selected_option_id")
    .eq("attempt_id", attemptId).eq("is_correct", false);
  const wrong = (answers ?? []).filter((answer) => answer.selected_option_id);
  if (!wrong.length) return NextResponse.json({ explanations: {} });
  const questionIds = wrong.map((answer) => answer.question_id);
  const model = process.env.AI_MODEL || "gemini-3.8-flash";
  const [optionsResult, questionsResult, cachesResult] = await Promise.all([
    admin.from("question_options").select("id,option_key").in("id", wrong.map((answer) => answer.selected_option_id!)),
    admin.from("questions").select("id,canonical_id").in("id", questionIds),
    admin.from("ai_explanations").select("question_id,student_answer_hash,content")
      .eq("user_id", user.id).eq("model", model)
      .eq("explanation_type", "personalized").in("question_id", questionIds),
  ]);
  const keys = new Map((optionsResult.data ?? []).map((option) => [option.id, option.option_key]));
  const canonicalIds = new Map((questionsResult.data ?? []).map((question) => [question.id, question.canonical_id]));
  const explanations: Record<string, unknown> = {};
  for (const answer of wrong) {
    const key = keys.get(answer.selected_option_id!);
    const canonicalId = canonicalIds.get(answer.question_id);
    if (!key || !canonicalId) continue;
    const content = cachesResult.data?.find((cache) => cache.question_id === answer.question_id && cache.student_answer_hash === answerCacheHash(key, model))?.content;
    const parsed = content ? parseCachedExplanation(content) : null;
    if (parsed) explanations[canonicalId] = parsed;
  }
  return NextResponse.json({ explanations }, { headers: { "cache-control": "no-store" } });
}
