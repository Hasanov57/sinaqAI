import type { Exam } from "@/types/exam";
import { officialTestExam } from "./official-exams";

export const demoExams: Exam[] = [
  {
    id: "demo-11-buraxilis",
    title: "11-ci sinif buraxılış — demo imtahan",
    year: 2026,
    date: "2026-03-01",
    type: "graduation_11",
    typeLabel: "11-ci sinif buraxılış",
    grade: 11,
    languageSection: "AZ",
    durationMinutes: 45,
    subjects: ["Azərbaycan dili", "Riyaziyyat", "İngilis dili"],
    questionCount: 6,
    maxScore: 6,
    status: "demo",
    questions: [
      {
        id: "demo-az-001",
        number: 1,
        subject: "Azərbaycan dili",
        topic: "Nitq hissələri",
        type: "multiple_choice",
        text: "Hansı cümlədə sifət isimləşib?",
        maxScore: 1,
        officialExplanation:
          "Sifət isimləşəndə isim kimi işlənir və əşya və ya şəxsi bildirir.",
        options: [
          { id: "az1-a", key: "A", text: "Yaşıl yarpaq yerə düşdü.", isCorrect: false },
          { id: "az1-b", key: "B", text: "Böyüklərə hörmət etmək lazımdır.", isCorrect: true },
          { id: "az1-c", key: "C", text: "Sərin külək əsirdi.", isCorrect: false },
          { id: "az1-d", key: "D", text: "Uca dağlar görünürdü.", isCorrect: false },
        ],
      },
      {
        id: "demo-az-002",
        number: 2,
        subject: "Azərbaycan dili",
        topic: "Leksika",
        type: "multiple_choice",
        text: "“Cəsur” sözünün yaxınmənalı qarşılığı hansıdır?",
        maxScore: 1,
        officialExplanation: "“Cəsur” və “igid” sözləri yaxınmənalıdır.",
        options: [
          { id: "az2-a", key: "A", text: "qorxaq", isCorrect: false },
          { id: "az2-b", key: "B", text: "sakit", isCorrect: false },
          { id: "az2-c", key: "C", text: "igid", isCorrect: true },
          { id: "az2-d", key: "D", text: "yorğun", isCorrect: false },
        ],
      },
      {
        id: "demo-math-001",
        number: 3,
        subject: "Riyaziyyat",
        topic: "Tənliklər",
        type: "multiple_choice",
        text: "3x + 5 = 20 tənliyinin həlli hansıdır?",
        maxScore: 1,
        officialExplanation: "3x = 15, buna görə x = 5.",
        options: [
          { id: "m1-a", key: "A", text: "3", isCorrect: false },
          { id: "m1-b", key: "B", text: "5", isCorrect: true },
          { id: "m1-c", key: "C", text: "7", isCorrect: false },
          { id: "m1-d", key: "D", text: "15", isCorrect: false },
        ],
      },
      {
        id: "demo-math-002",
        number: 4,
        subject: "Riyaziyyat",
        topic: "Faiz",
        type: "multiple_choice",
        text: "80 ədədinin 25%-i neçədir?",
        maxScore: 1,
        officialExplanation: "80 × 0,25 = 20.",
        options: [
          { id: "m2-a", key: "A", text: "15", isCorrect: false },
          { id: "m2-b", key: "B", text: "20", isCorrect: true },
          { id: "m2-c", key: "C", text: "25", isCorrect: false },
          { id: "m2-d", key: "D", text: "40", isCorrect: false },
        ],
      },
      {
        id: "demo-en-001",
        number: 5,
        subject: "İngilis dili",
        topic: "Grammar",
        type: "multiple_choice",
        text: "Choose the correct option: She ___ to school every day.",
        maxScore: 1,
        officialExplanation:
          "Present Simple üçün üçüncü şəxsin təkində felə -s artırılır.",
        options: [
          { id: "en1-a", key: "A", text: "go", isCorrect: false },
          { id: "en1-b", key: "B", text: "goes", isCorrect: true },
          { id: "en1-c", key: "C", text: "going", isCorrect: false },
          { id: "en1-d", key: "D", text: "gone", isCorrect: false },
        ],
      },
      {
        id: "demo-en-002",
        number: 6,
        subject: "İngilis dili",
        topic: "Vocabulary",
        type: "multiple_choice",
        text: "Which word is closest in meaning to “rapid”?",
        maxScore: 1,
        officialExplanation: "“Rapid” sürətli deməkdir; “fast” yaxınmənalı sözdür.",
        options: [
          { id: "en2-a", key: "A", text: "slow", isCorrect: false },
          { id: "en2-b", key: "B", text: "quiet", isCorrect: false },
          { id: "en2-c", key: "C", text: "fast", isCorrect: true },
          { id: "en2-d", key: "D", text: "late", isCorrect: false },
        ],
      },
    ],
  },
];

export const availableExams: Exam[] = [officialTestExam, ...demoExams];

export function getExam(examId: string) {
  return availableExams.find((exam) => exam.id === examId);
}
