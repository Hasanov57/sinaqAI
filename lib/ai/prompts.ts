import { stripDimSourceHeader } from "../data/sanitize-dim";

export type ExplanationContext = {
  subject: string;
  topic: string;
  question: string;
  passage?: string | null;
  options: Array<{ key: string; text: string }>;
  selected: { key: string; text: string };
  correct: { key: string; text: string };
  officialExplanation: string;
  grade?: number | null;
  altStandard?: string | null;
  questionImageBase64?: string;
};

export const systemInstruction = [
  "Sən Azərbaycan məktəblisi üçün aydın və qısa izah yazan müəllimsən.",
  "Aşağıdakı rəsmi DİM cavabı və rəsmi izah yeganə doğru mənbədir. Onlara zidd çıxma, düzgün cavabı dəyişmə və alternativ doğru cavab uydurma.",
  "Şagirdin seçdiyi konkret səhv variantın düzgün cavabdan nə ilə fərqləndiyini izah et.",
  "Yalnız verilmiş sual, variantlar, mətn və rəsmi izahdan istifadə et; məlumat çatmırsa ehtiyatla bildir.",
  "Rəsmi sual şəkli verilmişsə, diaqramdakı rəqəm və işarələri diqqətlə oxu; şəkli rəsmi cavabla birlikdə izah et.",
  "Səmimi, tədrisə uyğun Azərbaycan dilində yaz. Lazımsız rəsmi üslubdan və uzun cavabdan qaç.",
].join("\n");

export function buildExplanationPrompt(context: ExplanationContext): string {
  return JSON.stringify({
    subject: context.subject,
    topic: context.topic,
    grade: context.grade ?? null,
    altStandard: context.altStandard ?? null,
    passage: context.passage ? stripDimSourceHeader(context.passage).text.slice(0, 5_000) : null,
    question: stripDimSourceHeader(context.question).text.slice(0, 2_000),
    options: context.options.map((option) => ({ key: option.key, text: option.text.slice(0, 700) })),
    studentSelected: context.selected,
    officialCorrect: context.correct,
    officialDimExplanation: stripDimSourceHeader(context.officialExplanation).text.slice(0, 3_000),
    instruction: "Qısa JSON cavabı ver: summary, whyWrong, correctReasoning, keyRule, miniExample. Uyğun deyilsə miniExample null olsun.",
  });
}
