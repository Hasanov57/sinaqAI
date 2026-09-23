import { NextResponse } from "next/server";
import { getExam } from "@/lib/data/demo-exams";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AttemptResult, GradedAnswer } from "@/types/exam";

export async function GET(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return NextResponse.json({ error: "Nəticə tapılmadı." }, { status: 404 });
  const supabase = await createSupabaseServerClient().catch(() => null);
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!user) return NextResponse.json({ error: "Daxil olun." }, { status: 401 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Nəticələr hazırda yüklənmir." }, { status: 503 });
  const { data: attempt } = await admin.from("exam_attempts")
    .select("id,exam_id,submitted_at,duration_seconds,total_score,max_score")
    .eq("id", attemptId).eq("user_id", user.id).eq("status", "submitted").maybeSingle();
  if (!attempt) return NextResponse.json({ error: "Nəticə tapılmadı." }, { status: 404 });
  const { data: examRow } = await admin.from("exams").select("dataset_key").eq("id", attempt.exam_id).maybeSingle();
  const exam = getExam(examRow?.dataset_key ?? "");
  if (!exam) return NextResponse.json({ error: "İmtahan tapılmadı." }, { status: 404 });
  const { data: questionRows, error: questionError } = await admin.from("questions").select("id,canonical_id").eq("exam_id", attempt.exam_id);
  if (questionError || !questionRows) return NextResponse.json({ error: "Suallar yüklənmədi." }, { status: 503 });
  const { data: answers, error: answerError } = await admin.from("student_answers")
    .select("question_id,selected_option_id,text_answer,solution_image_path,awarded_score,is_correct")
    .eq("attempt_id", attemptId);
  if (answerError || !answers) return NextResponse.json({ error: "Cavablar yüklənmədi." }, { status: 503 });
  const selectedIds = answers.flatMap((answer) => answer.selected_option_id ? [answer.selected_option_id] : []);
  const selectedOptions = selectedIds.length
    ? await admin.from("question_options").select("id,option_key").in("id", selectedIds)
    : null;
  const optionKeys = new Map((selectedOptions?.data ?? []).map((option) => [option.id, option.option_key]));
  const questionDbIds = new Map(questionRows.map((question) => [question.canonical_id, question.id]));
  const answerRows = new Map(answers.map((answer) => [answer.question_id, answer]));
  const gradedAnswers: GradedAnswer[] = exam.questions.map((question) => {
    const answer = answerRows.get(questionDbIds.get(question.id) ?? "");
    const selectedKey = answer?.selected_option_id ? optionKeys.get(answer.selected_option_id) ?? null : null;
    const selectedOption = question.options.find((option) => option.key === selectedKey);
    const correctOption = question.options.find((option) => option.isCorrect);
    const status = !answer ? "unanswered" : answer.is_correct === true ? "correct" : answer.is_correct === false ? "wrong" : "ungraded";
    return {
      questionId: question.id, questionNumber: question.number,
      selectedOptionId: selectedOption?.id ?? null, selectedKey, correctKey: correctOption?.key ?? null,
      selectedAnswerText: answer?.text_answer ?? null, solutionImagePath: answer?.solution_image_path ?? null,
      status, isCorrect: answer?.is_correct ?? null,
      awardedScore: Number(answer?.awarded_score ?? 0),
      maxScore: question.type === "multiple_choice" ? question.maxScore : question.officialRubric?.maxScore ?? 0,
      subject: question.subject, topic: question.topic,
    };
  });
  const result: AttemptResult = {
    attemptId, examId: exam.id, submittedAt: attempt.submitted_at ?? "",
    durationSeconds: attempt.duration_seconds ?? 0,
    score: Number(attempt.total_score ?? 0), maxScore: Number(attempt.max_score ?? 0), answers: gradedAnswers,
  };
  return NextResponse.json({ result });
}
