import type { GradedAnswer } from "@/types/exam";

export type TopicStatistic = {
  topic: string;
  questionsSeen: number;
  questionsCorrect: number;
  pointsReceived: number;
  pointsPossible: number;
  accuracyPercentage: number;
};

export function calculateTopicStatistics(
  answers: GradedAnswer[],
): TopicStatistic[] {
  const grouped = new Map<string, Omit<TopicStatistic, "accuracyPercentage">>();

  for (const answer of answers) {
    if (answer.status === "ungraded") continue;
    const current = grouped.get(answer.topic) ?? {
      topic: answer.topic,
      questionsSeen: 0,
      questionsCorrect: 0,
      pointsReceived: 0,
      pointsPossible: 0,
    };
    current.questionsSeen += 1;
    current.questionsCorrect += answer.isCorrect ? 1 : 0;
    current.pointsReceived += answer.awardedScore;
    current.pointsPossible += answer.maxScore;
    grouped.set(answer.topic, current);
  }

  return [...grouped.values()].map((topic) => ({
    ...topic,
    accuracyPercentage:
      topic.pointsPossible === 0
        ? 0
        : Math.round((topic.pointsReceived / topic.pointsPossible) * 100),
  }));
}

export function identifyWeakTopics(
  statistics: TopicStatistic[],
  minimumQuestions = 3,
  weakThreshold = 60,
): TopicStatistic[] {
  return statistics.filter(
    (topic) =>
      topic.questionsSeen >= minimumQuestions &&
      topic.accuracyPercentage < weakThreshold,
  );
}
