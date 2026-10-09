import { z } from "zod";
import { NextResponse } from "next/server";
import { anonymousAiVisitorHash } from "@/lib/ai/anonymous-quota";
import { AiNotConfiguredError, AiProviderError, getGeminiApiKey } from "@/lib/ai/gemini";
import { generateOpenGrade } from "@/lib/ai/open-grading";
import { getExam } from "@/lib/data/demo-exams";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const inputSchema = z.object({
  examId: z.string().min(1).max(120),
  questionId: z.string().min(1).max(120),
  studentAnswer: z.string().trim().min(1).max(3_000),
});

const unavailable = "AI qiymətləndirməsini hazırda aparmaq mümkün olmadı. Bir az sonra yenidən cəhd edin.";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Sorğu qəbul edilmir." }, { status: 403 });
  const raw = await request.text();
  if (raw.length > 8_000) return NextResponse.json({ error: "Sorğu çox böyükdür." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Sorğu məlumatı yanlışdır." }, { status: 400 }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Sorğu məlumatı yanlışdır." }, { status: 400 });

  const { examId, questionId, studentAnswer } = parsed.data;
  const exam = getExam(examId);
  if (!exam || exam.status !== "draft") return NextResponse.json({ error: "Rəsmi imtahan tapılmadı." }, { status: 404 });
  const question = exam.questions.find((item) => item.id === questionId);
  if (!question || question.subject !== "İngilis dili" || !["constructed_response", "essay"].includes(question.type)) {
    return NextResponse.json({ error: "Bu sual üçün AI qiymətləndirməsi mövcud deyil." }, { status: 404 });
  }
  if (!question.officialAnswer || !question.officialExplanation) {
    return NextResponse.json({ error: "Rəsmi cavab və meyar mövcud deyil." }, { status: 503 });
  }
  if ((process.env.AI_PROVIDER ?? "gemini") !== "gemini" || !getGeminiApiKey()) {
    return NextResponse.json({ error: "AI xidməti hazırda aktiv deyil." }, { status: 503 });
  }
  const admin = createSupabaseAdminClient();
  const visitorHash = anonymousAiVisitorHash(request);
  if (!admin || !visitorHash) return NextResponse.json({ error: "AI xidməti hazırda aktiv deyil." }, { status: 503 });
  const quota = await admin.rpc("consume_ai_anonymous_quota", { p_visitor_hash: visitorHash });
  if (quota.error) {
    console.error("Anonymous open-answer grading quota failed:", { code: quota.error.code || "unknown", message: quota.error.message });
    return NextResponse.json({ error: unavailable }, { status: 503 });
  }
  if (!quota.data) return NextResponse.json({ error: "AI limitinə çatdınız. Bir qədər sonra yenidən cəhd edin." }, { status: 429 });

  try {
    const grade = await generateOpenGrade({
      task: question.type === "essay" ? "opinion_writing" : "sentence_completion",
      question: question.text,
      studentAnswer,
      officialAnswer: question.officialAnswer,
      officialCriteria: question.officialExplanation,
      passage: exam.passages?.find((item) => item.id === question.passageId)?.text,
    });
    return NextResponse.json({ grade }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) return NextResponse.json({ error: "AI xidməti hazırda aktiv deyil." }, { status: 503 });
    console.error("Open answer AI grading failed:", error instanceof AiProviderError ? error.message : "Unexpected provider failure");
    return NextResponse.json({ error: unavailable }, { status: 502 });
  }
}
