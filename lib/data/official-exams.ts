import officialDataset from "../../data/exams/2025-03-02-graduation-11-az.json";
import { stripDimSourceHeader } from "./sanitize-dim";
import type { Exam, ExamQuestion, QuestionType } from "../../types/exam";

type DatasetQuestion = (typeof officialDataset.questions)[number] & {
  question_text_latex?: string | null;
  passage_id?: string | null;
  audio_url?: string | null;
  accepted_answers?: Array<{ answer_text: string; normalized_answer?: string | null; score: number }>;
  official_rubric?: { max_score: number; allowed_scores: number[]; official_text?: string };
  official_answer?: string;
};
type DatasetPassage = {
  canonical_id: string;
  subject: string;
  title: string;
  passage_text?: string | null;
  passage_image_url?: string | null;
  sort_order: number;
};
const questionImageSizes: Record<string, { width: number; height: number }> = {
  "/exam-assets/2025-03-02/math-002.png": { width: 511, height: 400 },
  "/exam-assets/2025-03-02/az-034-syntax-options.png": { width: 744, height: 285 },
  "/exam-assets/2025-03-02/az-051-causes-question.png": { width: 700, height: 394 },
  "/exam-assets/2025-03-02/az-052-expansion-question.png": { width: 580, height: 569 },
  "/exam-assets/2025-03-02/az-053-theses-question.png": { width: 622, height: 444 },
  "/exam-assets/2025-03-02/az-054-true-false-table.png": { width: 582, height: 444 },
  "/exam-assets/2025-03-02/az-055-comparison-question.png": { width: 580, height: 305 },
  "/exam-assets/2025-03-02/az-058-venn-diagram.png": { width: 622, height: 221 },
  "/exam-assets/2025-03-02/az-059-meaning-table.png": { width: 571, height: 466 },
  "/exam-assets/2025-03-02/az-060-problem-solution-table.png": { width: 622, height: 878 },
  "/exam-assets/2025-03-02/math-066-probability-chart.png": { width: 744, height: 738 },
  "/exam-assets/2025-03-02/math-067-circle-diagram.png": { width: 744, height: 325 },
  "/exam-assets/2025-03-02/math-081-garden-diagram.png": { width: 744, height: 461 },
  "/exam-assets/2025-03-02/math-083-trapezoid-diagram.png": { width: 744, height: 301 },
  "/exam-assets/2025-03-02/math-085-function-graph.png": { width: 744, height: 530 },
};
const dataset = officialDataset as unknown as {
  passages?: DatasetPassage[];
  exam: (typeof officialDataset.exam) & { subject_order: string[] };
  questions: DatasetQuestion[];
};

function mapQuestion(question: DatasetQuestion): ExamQuestion {
  const sanitized = stripDimSourceHeader(question.question_text);
  const imageSize = question.question_image_url
    ? questionImageSizes[question.question_image_url]
    : undefined;
  return {
    id: question.canonical_id,
    number: 0,
    subject: question.subject,
    topic: question.topic,
    type: question.question_type as QuestionType,
    text: sanitized.text,
    textLatex: question.question_text_latex ?? undefined,
    questionImageUrl: question.question_image_url ?? undefined,
    questionImageWidth: imageSize?.width,
    questionImageHeight: imageSize?.height,
    variantNumbers: question.variant_numbers ?? sanitized.sourceVariantNumbers ?? undefined,
    sourcePage: question.source_page,
    passageId: question.passage_id ?? undefined,
    audioUrl: question.audio_url ?? undefined,
    acceptedAnswers: question.accepted_answers?.map((answer) => ({
      answerText: answer.answer_text,
      normalizedAnswer: answer.normalized_answer ?? null,
      score: answer.score,
    })),
    officialRubric: question.official_rubric
      ? {
          maxScore: question.official_rubric.max_score,
          allowedScores: question.official_rubric.allowed_scores,
          officialText: question.official_rubric.official_text,
        }
      : undefined,
    officialAnswer: question.official_answer ?? undefined,
    options: (question.options ?? []).map((option) => ({
      id: `${question.canonical_id}-${option.key.toLowerCase()}`,
      key: option.key,
      text: option.text,
      isCorrect: option.key === question.correct_answer,
    })),
    // The explanation PDF does not state a point value. The runtime value is
    // used only to count correct answers and is never presented as official bal.
    maxScore: question.max_score ?? question.official_rubric?.max_score ?? (question.question_type === "multiple_choice" ? 1 : 0),
    officialExplanation: question.official_explanation,
  };
}

function mapPassage(passage: DatasetPassage) {
  const sanitized = stripDimSourceHeader(passage.passage_text ?? "");
  return {
    id: passage.canonical_id,
    title: passage.title,
    text: sanitized.text || undefined,
    imageUrl: passage.passage_image_url ?? undefined,
    sortOrder: passage.sort_order,
    sourceVariantNumbers: sanitized.sourceVariantNumbers ?? undefined,
  };
}

const subjectOrder = dataset.exam.subject_order;
const orderedQuestions = [...dataset.questions]
  .sort((left, right) => {
    const leftIndex = subjectOrder.indexOf(left.subject);
    const rightIndex = subjectOrder.indexOf(right.subject);
    const subjectDifference = (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) -
      (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
    if (subjectDifference !== 0) return subjectDifference;
    return (left.variant_numbers?.A ?? Number.MAX_SAFE_INTEGER) -
      (right.variant_numbers?.A ?? Number.MAX_SAFE_INTEGER);
  })
  .map((question, index) => ({ ...mapQuestion(question), number: index + 1 }));

export const officialTestExam: Exam = {
  id: dataset.exam.dataset_key,
  title: dataset.exam.title,
  year: Number(dataset.exam.date.slice(0, 4)),
  date: dataset.exam.date,
  type: dataset.exam.type as Exam["type"],
  typeLabel: "11-ci sinif buraxılış",
  grade: dataset.exam.grade,
  languageSection: dataset.exam.language_section as "AZ",
  subjects: subjectOrder,
  subjectOrder,
  passages: (dataset.passages ?? []).map(mapPassage),
  questionCount: dataset.questions.length,
  maxScore: dataset.questions.length,
  status: "draft",
  sourceUrl: dataset.exam.official_source_url,
  sourceOrganization: dataset.exam.source_organization,
  datasetLabel: dataset.exam.dataset_label,
  usesOfficialScoring: false,
  questions: orderedQuestions,
};
