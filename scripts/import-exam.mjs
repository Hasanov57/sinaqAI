import { readFile } from "node:fs/promises";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { validateDataset } from "./validate-exam-dataset.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const path = process.argv[2] ?? "data/exams/2025-03-02-graduation-11-az.json";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secretKey) {
  throw new Error("Set the Supabase URL and the server-only SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) in .env.local");
}

const dataset = JSON.parse(await readFile(path, "utf8"));
validateDataset(dataset);
const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function assertResult(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

const examRows = assertResult(
  await supabase
    .from("exams")
    .upsert(
      {
        dataset_key: dataset.exam.dataset_key,
        title: dataset.exam.title,
        year: Number(dataset.exam.date.slice(0, 4)),
        exam_date: dataset.exam.date,
        exam_type: dataset.exam.type,
        grade: dataset.exam.grade,
        language_section: dataset.exam.language_section,
        duration_minutes: dataset.exam.duration_minutes,
        official_source_url: dataset.exam.official_source_url,
        subject_order: dataset.exam.subject_order ?? [],
        status: "draft",
        visibility: "private",
      },
      { onConflict: "dataset_key" },
    )
    .select("id")
    .single(),
  "Upsert exam",
);

const examId = examRows.id;
const subjectIds = new Map();
const topicIds = new Map();
const passageIds = new Map();

for (const passage of dataset.passages ?? []) {
  if (!subjectIds.has(passage.subject)) {
    const subject = assertResult(
      await supabase
        .from("subjects")
        .upsert({ name: passage.subject }, { onConflict: "name" })
        .select("id")
        .single(),
      `Upsert subject ${passage.subject}`,
    );
    subjectIds.set(passage.subject, subject.id);
  }

  const passageRow = assertResult(
    await supabase
      .from("passages")
      .upsert(
        {
          exam_id: examId,
          subject_id: subjectIds.get(passage.subject),
          canonical_id: passage.canonical_id,
          title: passage.title,
          passage_text: passage.passage_text ?? null,
          passage_image_url: passage.passage_image_url ?? null,
          sort_order: passage.sort_order,
          metadata: passage.metadata ?? {},
        },
        { onConflict: "exam_id,canonical_id" },
      )
      .select("id")
      .single(),
    `Upsert passage ${passage.canonical_id}`,
  );
  passageIds.set(passage.canonical_id, passageRow.id);
}

const existingQuestionRows = assertResult(
  await supabase.from("questions").select("canonical_id").eq("exam_id", examId),
  "Read existing questions",
);
const existingQuestionIds = new Set(existingQuestionRows.map((question) => question.canonical_id));
let importedQuestions = 0;
let updatedQuestions = 0;

for (const [canonicalOrder, question] of dataset.questions.entries()) {
  if (!subjectIds.has(question.subject)) {
    const subject = assertResult(
      await supabase
        .from("subjects")
        .upsert({ name: question.subject }, { onConflict: "name" })
        .select("id")
        .single(),
      `Upsert subject ${question.subject}`,
    );
    subjectIds.set(question.subject, subject.id);
  }

  const topicCacheKey = `${question.subject}:${question.topic}`;
  if (!topicIds.has(topicCacheKey)) {
    const topic = assertResult(
      await supabase
        .from("topics")
        .upsert(
          { subject_id: subjectIds.get(question.subject), name: question.topic },
          { onConflict: "subject_id,name" },
        )
        .select("id")
        .single(),
      `Upsert topic ${topicCacheKey}`,
    );
    topicIds.set(topicCacheKey, topic.id);
  }

  const questionRow = assertResult(
    await supabase
      .from("questions")
      .upsert(
        {
          exam_id: examId,
          subject_id: subjectIds.get(question.subject),
          topic_id: topicIds.get(topicCacheKey),
          canonical_id: question.canonical_id,
          canonical_order: canonicalOrder + 1,
          question_type: question.question_type,
          question_text: question.question_text,
          question_text_latex: question.question_text_latex ?? null,
          question_image_url: question.question_image_url,
          audio_url: question.audio_url ?? null,
          passage_id: question.passage_id ? passageIds.get(question.passage_id) ?? null : null,
          official_explanation: question.official_explanation,
          grade_level: typeof question.grade_level === "number" ? question.grade_level : null,
          alt_standard: question.alt_standard,
          max_score: question.max_score,
          metadata: {
            source_page: question.source_page,
            grade_range: question.grade_range ?? null,
            official_answer: question.official_answer ?? null,
            official_max_score_available: question.max_score !== null,
            source_organization: dataset.exam.source_organization,
          },
        },
        { onConflict: "exam_id,canonical_id" },
      )
      .select("id")
      .single(),
    `Upsert question ${question.canonical_id}`,
  );
  if (existingQuestionIds.has(question.canonical_id)) updatedQuestions += 1;
  else importedQuestions += 1;

  if (question.variant_numbers) {
    assertResult(
      await supabase.from("question_variant_numbers").upsert(
        Object.entries(question.variant_numbers).map(([variant_name, question_number]) => ({
          question_id: questionRow.id,
          variant_name,
          question_number,
        })),
        { onConflict: "question_id,variant_name" },
      ),
      `Upsert variants ${question.canonical_id}`,
    );
  }

  if (question.question_type === "multiple_choice") {
    assertResult(
      await supabase.from("question_options").upsert(
        question.options.map((option, index) => ({
          question_id: questionRow.id,
          option_key: option.key,
          option_text: option.text,
          is_correct: option.key === question.correct_answer,
          sort_order: index + 1,
        })),
        { onConflict: "question_id,option_key" },
      ),
      `Upsert options ${question.canonical_id}`,
    );
  } else {
    if (question.accepted_answers?.length) {
      assertResult(
        await supabase.from("accepted_answers").upsert(
          question.accepted_answers.map((answer) => ({
            question_id: questionRow.id,
            answer_text: answer.answer_text,
            normalized_answer: answer.normalized_answer ?? null,
            score: answer.score,
            notes: answer.notes ?? null,
            source_type: "official_dim",
          })),
          { onConflict: "question_id,answer_text,score" },
        ),
        `Upsert accepted answers ${question.canonical_id}`,
      );
    }
    if (question.official_rubric) {
      assertResult(
        await supabase.from("scoring_rubrics").upsert(
          {
            question_id: questionRow.id,
            max_score: question.official_rubric.max_score,
            rubric_json: question.official_rubric,
            official_text: question.official_rubric.official_text ?? null,
          },
          { onConflict: "question_id" },
        ),
        `Upsert rubric ${question.canonical_id}`,
      );
    }
  }
}

console.log(JSON.stringify({
  imported: importedQuestions,
  updated: updatedQuestions,
  skipped: 0,
  errors: 0,
  examId,
  questions: dataset.questions.length,
}, null, 2));
