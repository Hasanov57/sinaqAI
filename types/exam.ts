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
  | "handwritten_solution"
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
  textLatex?: string;
  options: QuestionOption[];
  maxScore: number;
  acceptedAnswers?: Array<{ answerText: string; normalizedAnswer?: string | null; score: number }>;
  officialRubric?: { maxScore: number; allowedScores: number[]; officialText?: string };
  officialAnswer?: string;
  officialExplanation?: string;
  questionImageUrl?: string;
  questionImageWidth?: number;
  questionImageHeight?: number;
  variantNumbers?: Partial<Record<"A" | "B" | "C" | "D", number>>;
  sourcePage?: number;
  passageId?: string;
  audioUrl?: string;
};

export type ExamPassage = {
  id: string;
  title: string;
  text?: string;
  imageUrl?: string;
  sortOrder: number;
  sourceVariantNumbers?: Partial<Record<"A" | "B" | "C" | "D", number>>;
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
  subjectOrder?: string[];
  passages?: ExamPassage[];
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
  correctKey: string | null;
  selectedAnswerText?: string | null;
  solutionImagePath?: string | null;
  status: "correct" | "wrong" | "unanswered" | "ungraded";
  isCorrect: boolean | null;
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
