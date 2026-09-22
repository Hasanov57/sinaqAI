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

  const ids = new Set();
  for (const [index, question] of dataset.questions.entries()) {
    const prefix = `questions[${index}]`;
    requireText(question.canonical_id, `${prefix}.canonical_id`);
    if (ids.has(question.canonical_id)) throw new Error(`Duplicate canonical_id: ${question.canonical_id}`);
    ids.add(question.canonical_id);
    requireText(question.subject, `${prefix}.subject`);
    requireText(question.topic, `${prefix}.topic`);
    if (!question.question_text && !question.question_image_url) {
      throw new Error(`${question.canonical_id} requires question_text or question_image_url`);
    }
    if (question.question_type !== "multiple_choice") {
      throw new Error(`${question.canonical_id} is not multiple_choice`);
    }
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
    const variants = question.variant_numbers;
    if (!variants || Object.keys(variants).sort().join("") !== "ABCD") {
      throw new Error(`${question.canonical_id} must contain A/B/C/D variant mappings`);
    }
    if (Object.values(variants).some((number) => !Number.isInteger(number) || number < 1)) {
      throw new Error(`${question.canonical_id} contains an invalid variant number`);
    }
    requireText(question.official_explanation, `${question.canonical_id}.official_explanation`);
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
