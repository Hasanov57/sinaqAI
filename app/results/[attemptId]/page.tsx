import { ResultView } from "@/components/results/result-view";

export const metadata = { title: "Nəticə" };

export default async function ResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  return <ResultView attemptId={(await params).attemptId} />;
}
