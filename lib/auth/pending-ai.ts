export function getPendingAiIntent(href: string, wrongQuestionIds: readonly string[]) {
  const url = new URL(href);
  const questionId = url.searchParams.get("aiExplain");
  if (!questionId || !wrongQuestionIds.includes(questionId)) return null;
  url.searchParams.delete("aiExplain");
  return { questionId, cleanPath: `${url.pathname}${url.search}${url.hash}` };
}
