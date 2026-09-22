import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getExam } from "@/lib/data/demo-exams";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const maxRequestBytes = 2_000;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Sorğu mənbəyi qəbul edilmir." }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient().catch(() => null);
  if (!supabase) return NextResponse.json({ error: "Giriş sessiyası yoxlanılmadı." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "AI izahı üçün hesabınıza daxil olun." }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxRequestBytes) return NextResponse.json({ error: "Sorğu çox böyükdür." }, { status: 413 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Sorğu məlumatı yanlışdır." }, { status: 400 });
  const { examId, questionId, selectedKey } = body as Record<string, unknown>;
  if (typeof examId !== "string" || examId.length > 120 || typeof questionId !== "string" || questionId.length > 120 || typeof selectedKey !== "string" || !/^[A-H]$/.test(selectedKey)) {
    return NextResponse.json({ error: "İmtahan, sual və ya cavab düzgün deyil." }, { status: 400 });
  }

  const exam = getExam(examId);
  const question = exam?.questions.find((item) => item.id === questionId);
  if (!exam || !question || question.type !== "multiple_choice") return NextResponse.json({ error: "Bu sual üçün AI izahı mövcud deyil." }, { status: 404 });
  const selected = question.options.find((option) => option.key === selectedKey);
  const correct = question.options.find((option) => option.isCorrect);
  if (!selected || !correct || selected.isCorrect) return NextResponse.json({ error: "Yalnız səhv cavab üçün izah istəyə bilərsiniz." }, { status: 400 });
  const apiKey = process.env.GEMINI_API_KEY;
  if (process.env.AI_PROVIDER !== "gemini" || !apiKey) return NextResponse.json({ error: "Gemini hələ konfiqurasiya edilməyib." }, { status: 503 });

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "AI xidməti üçün serverdə Supabase service-role açarı çatışmır." }, { status: 503 });
  const quota = await admin.rpc("consume_ai_explanation_quota", { p_user_id: user.id });
  if (quota.error) return NextResponse.json({ error: "AI sorğu limiti yoxlanılmadı. Supabase miqrasiyalarını tətbiq edin." }, { status: 503 });
  if (!quota.data) return NextResponse.json({ error: "Bir dəqiqədə ən çox 8 izah istəyə bilərsiniz." }, { status: 429 });

  let questionDbId: string | null = null;
  let answerHash = "";
  const examRow = await admin.from("exams").select("id").eq("dataset_key", exam.id).maybeSingle();
  if (examRow.data?.id) {
    const questionRow = await admin.from("questions").select("id").eq("exam_id", examRow.data.id).eq("canonical_id", question.id).maybeSingle();
    questionDbId = questionRow.data?.id ?? null;
  }
  answerHash = createHash("sha256").update(`${selectedKey}:${correct.key}`).digest("hex");
  if (questionDbId) {
    const cached = await admin.from("ai_explanations").select("content").eq("question_id", questionDbId).eq("user_id", user.id).eq("student_answer_hash", answerHash).eq("explanation_type", "personalized").maybeSingle();
    if (cached.data?.content) return NextResponse.json({ explanation: cached.data.content, cached: true });
  }

  const model = process.env.AI_MODEL || "gemini-3.8-flash";
  const prompt = [
    "Sən SınaqAI üçün Azərbaycan dilində danışan müəllimsən.",
    "Şagirdin səhv seçimini addım-addım izah et, sonra rəsmi düzgün cavabın niyə doğru olduğunu qısa əsaslandır.",
    "Yalnız aşağıdakı sual, seçimlər və rəsmi izahdan istifadə et. Verilməyən fakt, düstur və ya şərt uydurma; məlumat yetərsizdirsə bunu de.",
    "Rəsmi cavabı və balı dəyişmə. Markdown siyahısı olar; 120 sözdən çox yazma.",
    `Fənn: ${question.subject}; mövzu: ${question.topic}`,
    `Sual: ${question.text}`,
    `Variantlar: ${question.options.map((option) => `${option.key}) ${option.text}`).join("; ")}`,
    `Şagirdin seçimi: ${selected.key}) ${selected.text}`,
    `Rəsmi düzgün cavab: ${correct.key}) ${correct.text}`,
    `Rəsmi izah (ola bilsin boşdur): ${question.officialExplanation ?? "verilməyib"}`,
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let explanation: string;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 350 } }),
      signal: controller.signal,
    });
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) return NextResponse.json({ error: "Gemini cavab verə bilmədi. Parametrləri yoxlayıb yenidən sınayın." }, { status: 502 });
    const parts = (result as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null)?.candidates?.[0]?.content?.parts;
    explanation = parts?.map((part) => part.text ?? "").join("").trim() ?? "";
    if (!explanation || explanation.length > 5_000) return NextResponse.json({ error: "AI izahı düzgün formatda gəlmədi." }, { status: 502 });
  } catch {
    return NextResponse.json({ error: "Gemini xidmətinə qoşulmaq mümkün olmadı." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  if (questionDbId) {
    await admin.from("ai_explanations").upsert({
      question_id: questionDbId,
      user_id: user.id,
      student_answer_hash: answerHash,
      explanation_type: "personalized",
      content: explanation,
      model,
    }, { onConflict: "question_id,user_id,student_answer_hash,explanation_type" });
  }
  return NextResponse.json({ explanation, cached: false });
}
