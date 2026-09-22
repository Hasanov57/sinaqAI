import officialDataset from "../../data/exams/2025-03-02-graduation-11-az.json";
import type { Exam, ExamQuestion, QuestionType } from "../../types/exam";

type DatasetQuestion = (typeof officialDataset.questions)[number];

function mapQuestion(question: DatasetQuestion, index: number): ExamQuestion {
  return {
    id: question.canonical_id,
    number: index + 1,
    subject: question.subject,
    topic: question.topic,
    type: question.question_type as QuestionType,
    text: question.question_text,
    questionImageUrl: question.question_image_url ?? undefined,
    questionImageWidth: question.question_image_url ? 511 : undefined,
    questionImageHeight: question.question_image_url ? 400 : undefined,
    variantNumbers: question.variant_numbers,
    sourcePage: question.source_page,
    options: question.options.map((option) => ({
      id: `${question.canonical_id}-${option.key.toLowerCase()}`,
      key: option.key,
      text: option.text,
      isCorrect: option.key === question.correct_answer,
    })),
    // The explanation PDF does not state a point value. The runtime value is
    // used only to count correct answers and is never presented as official bal.
    maxScore: 1,
    officialExplanation: question.official_explanation,
  };
}

export const officialTestExam: Exam = {
  id: officialDataset.exam.dataset_key,
  title: officialDataset.exam.title,
  year: Number(officialDataset.exam.date.slice(0, 4)),
  date: officialDataset.exam.date,
  type: officialDataset.exam.type as Exam["type"],
  typeLabel: "11-ci sinif buraxılış",
  grade: officialDataset.exam.grade,
  languageSection: officialDataset.exam.language_section as "AZ",
  subjects: ["Azərbaycan dili", "Riyaziyyat", "İngilis dili"],
  questionCount: officialDataset.questions.length,
  maxScore: officialDataset.questions.length,
  status: "draft",
  sourceUrl: officialDataset.exam.official_source_url,
  sourceOrganization: officialDataset.exam.source_organization,
  datasetLabel: officialDataset.exam.dataset_label,
  usesOfficialScoring: false,
  questions: officialDataset.questions.map(mapQuestion),
};
