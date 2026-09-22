import { notFound } from "next/navigation";
import { ExamRunner } from "@/components/exam/exam-runner";
import { getExam } from "@/lib/data/demo-exams";

export const metadata = { title: "İmtahan gedir" };

export default async function StartExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const exam = getExam((await params).examId);
  if (!exam) notFound();
  return <ExamRunner exam={exam} />;
}
