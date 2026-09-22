import { readFile } from "node:fs/promises";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { validateDataset } from "./validate-exam-dataset.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const path = process.argv[2] ?? "data/exams/2025-03-02-graduation-11-az.json";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secretKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
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
          question_image_url: question.question_image_url,
          official_explanation: question.official_explanation,
          grade_level: typeof question.grade_level === "number" ? question.grade_level : null,
          alt_standard: question.alt_standard,
          max_score: question.max_score,
          metadata: {
            source_page: question.source_page,
            grade_range: question.grade_range ?? null,
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
}

console.log(JSON.stringify({ imported: true, examId, questions: dataset.questions.length }, null, 2));
