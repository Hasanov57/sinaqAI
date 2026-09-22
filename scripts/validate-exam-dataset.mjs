import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const DEFAULT_DATASET = "data/exams/2025-03-02-graduation-11-az.json";

function requireText(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} must be a non-empty string`);
  }
}

export function validateDataset(dataset) {
  if (!dataset || typeof dataset !== "object") throw new Error("Dataset must be an object");
  requireText(dataset.exam?.dataset_key, "exam.dataset_key");
  requireText(dataset.exam?.title, "exam.title");
  requireText(dataset.exam?.date, "exam.date");
  if (dataset.exam?.status !== "draft") throw new Error("The first official dataset must remain draft");
  if (!Array.isArray(dataset.questions) || dataset.questions.length === 0) {
    throw new Error("questions must be a non-empty array");
  }

  const questionTypes = new Set([
    "multiple_choice",
    "short_answer",
    "constructed_response",
    "handwritten_solution",
    "table",
    "essay",
    "listening",
    "other",
  ]);
  const passageIds = new Set();
  for (const [index, passage] of (dataset.passages ?? []).entries()) {
    const prefix = `passages[${index}]`;
    requireText(passage.canonical_id, `${prefix}.canonical_id`);
    if (passageIds.has(passage.canonical_id)) throw new Error(`Duplicate passage canonical_id: ${passage.canonical_id}`);
    passageIds.add(passage.canonical_id);
    requireText(passage.subject, `${prefix}.subject`);
    requireText(passage.title, `${prefix}.title`);
    if (!passage.passage_text && !passage.passage_image_url) {
      throw new Error(`${passage.canonical_id} requires passage_text or passage_image_url`);
    }
    if (!Number.isInteger(passage.sort_order) || passage.sort_order < 1) {
      throw new Error(`${passage.canonical_id} requires a positive sort_order`);
    }
  }

  const definedSubjects = new Set(dataset.questions.map((question) => question.subject));
  if (dataset.exam.subject_order !== undefined) {
    if (!Array.isArray(dataset.exam.subject_order) || dataset.exam.subject_order.some((subject) => typeof subject !== "string")) {
      throw new Error("exam.subject_order must be an array of subject names");
    }
    if (new Set(dataset.exam.subject_order).size !== dataset.exam.subject_order.length) {
      throw new Error("exam.subject_order cannot contain duplicates");
    }
    for (const subject of definedSubjects) {
      if (!dataset.exam.subject_order.includes(subject)) {
        throw new Error(`exam.subject_order is missing subject ${subject}`);
      }
    }
  }

  const ids = new Set();
  for (const [index, question] of dataset.questions.entries()) {
    const prefix = `questions[${index}]`;
    requireText(question.canonical_id, `${prefix}.canonical_id`);
    if (ids.has(question.canonical_id)) throw new Error(`Duplicate canonical_id: ${question.canonical_id}`);
    ids.add(question.canonical_id);
    requireText(question.subject, `${prefix}.subject`);
    requireText(question.topic, `${prefix}.topic`);
    if (!questionTypes.has(question.question_type)) throw new Error(`${question.canonical_id} has unsupported question_type`);
    if (!question.question_text && !question.question_image_url && !question.audio_url) {
      throw new Error(`${question.canonical_id} requires question_text, question_image_url, or audio_url`);
    }
    if (question.passage_id && !passageIds.has(question.passage_id)) {
      throw new Error(`${question.canonical_id} references missing passage ${question.passage_id}`);
    }
    if (question.question_type === "multiple_choice") {
      if (!Array.isArray(question.options) || question.options.length < 2) {
        throw new Error(`${question.canonical_id} needs at least two options`);
      }
      const optionKeys = new Set();
      for (const option of question.options) {
        requireText(option.key, `${question.canonical_id}.options.key`);
        requireText(option.text, `${question.canonical_id}.options.${option.key}.text`);
        if (optionKeys.has(option.key)) throw new Error(`${question.canonical_id} has duplicate option ${option.key}`);
        optionKeys.add(option.key);
      }
      if (!optionKeys.has(question.correct_answer)) {
        throw new Error(`${question.canonical_id} correct answer ${question.correct_answer} is not an option`);
      }
    } else {
      if (question.correct_answer !== undefined || (question.options?.length ?? 0) > 0) {
        throw new Error(`${question.canonical_id} open-response question must not use MCQ options/correct_answer`);
      }
      for (const [answerIndex, accepted] of (question.accepted_answers ?? []).entries()) {
        requireText(accepted.answer_text, `${question.canonical_id}.accepted_answers[${answerIndex}].answer_text`);
        if (typeof accepted.score !== "number" || accepted.score < 0 || (question.max_score !== null && accepted.score > question.max_score)) {
          throw new Error(`${question.canonical_id} accepted answer score is outside the question score range`);
        }
      }
      const rubric = question.official_rubric;
      if (rubric) {
        if (typeof rubric.max_score !== "number" || rubric.max_score <= 0) {
          throw new Error(`${question.canonical_id}.official_rubric.max_score must be positive`);
        }
        if (!Array.isArray(rubric.allowed_scores) || rubric.allowed_scores.length === 0) {
          throw new Error(`${question.canonical_id}.official_rubric requires allowed_scores`);
        }
        if (rubric.allowed_scores.some((score) => typeof score !== "number" || score < 0 || score > rubric.max_score)) {
          throw new Error(`${question.canonical_id}.official_rubric contains an invalid allowed score`);
        }
      }
    }
    const variants = question.variant_numbers;
    if (variants !== undefined && (!variants || Object.keys(variants).sort().join("") !== "ABCD")) {
      throw new Error(`${question.canonical_id} variant mappings must contain A/B/C/D`);
    }
    if (variants && Object.values(variants).some((number) => !Number.isInteger(number) || number < 1)) {
      throw new Error(`${question.canonical_id} contains an invalid variant number`);
    }
    if (question.official_explanation !== undefined && question.official_explanation !== null && typeof question.official_explanation !== "string") {
      throw new Error(`${question.canonical_id}.official_explanation must be text when present`);
    }
    if (!Number.isInteger(question.source_page) || question.source_page < 1) {
      throw new Error(`${question.canonical_id} requires a valid source_page`);
    }
    if (question.max_score !== null && !(typeof question.max_score === "number" && question.max_score > 0)) {
      throw new Error(`${question.canonical_id}.max_score must be null or a positive number`);
    }
  }

  return {
    questionCount: dataset.questions.length,
    subjects: [...new Set(dataset.questions.map((question) => question.subject))],
  };
}

async function run() {
  const path = process.argv[2] ?? DEFAULT_DATASET;
  const dataset = JSON.parse(await readFile(path, "utf8"));
  const result = validateDataset(dataset);
  console.log(`Valid dataset: ${result.questionCount} questions across ${result.subjects.join(", ")}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
