export type ExamType =
  | "graduation_9"
  | "graduation_11"
  | "admission_stage_1"
  | "admission_stage_2"
  | "mock_exam"
  | "other";

export type QuestionType =
  | "multiple_choice"
  | "short_answer"
  | "constructed_response"
  | "table"
  | "essay"
  | "listening"
  | "other";

export type QuestionOption = {
  id: string;
  key: string;
  text: string;
  isCorrect: boolean;
};

export type ExamQuestion = {
  id: string;
  number: number;
  subject: string;
  topic: string;
  type: QuestionType;
  text: string;
  options: QuestionOption[];
  maxScore: number;
  officialExplanation?: string;
  questionImageUrl?: string;
  questionImageWidth?: number;
  questionImageHeight?: number;
  variantNumbers?: Record<"A" | "B" | "C" | "D", number>;
  sourcePage?: number;
};

export type Exam = {
  id: string;
  title: string;
  year: number;
  date: string;
  type: ExamType;
  typeLabel: string;
  grade: number;
  groupName?: string;
  languageSection: "AZ" | "RU";
  durationMinutes?: number;
  subjects: string[];
  questionCount: number;
  maxScore: number;
  status: "demo" | "draft" | "published";
  sourceUrl?: string;
  sourceOrganization?: string;
  datasetLabel?: string;
  usesOfficialScoring?: boolean;
  questions: ExamQuestion[];
};

export type AnswerMap = Record<string, string>;

export type GradedAnswer = {
  questionId: string;
  questionNumber: number;
  selectedOptionId: string | null;
  selectedKey: string | null;
  correctKey: string;
  isCorrect: boolean;
  awardedScore: number;
  maxScore: number;
  subject: string;
  topic: string;
};

export type AttemptResult = {
  attemptId: string;
  examId: string;
  submittedAt: string;
  durationSeconds: number;
  score: number;
  maxScore: number;
  answers: GradedAnswer[];
};
