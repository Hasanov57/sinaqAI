import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  answerRows: [] as Array<Record<string, unknown>>,
  finalized: false,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: mocks.user } }) } }),
}));
vi.mock("@/lib/data/demo-exams", () => ({ getExam: (id: string) => id === "official-exam" ? {
  id, status: "draft", questions: [{
    id: "q-1", number: 1, subject: "Riyaziyyat", topic: "Tənlik", type: "multiple_choice", text: "2 + 2 = ?", maxScore: 1,
    options: [{ id: "q-1-b", key: "B", text: "3", isCorrect: false }, { id: "q-1-e", key: "E", text: "4", isCorrect: true }],
  }],
} : undefined }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from(table: string) {
      const rows = table === "questions" ? [{ id: "db-q-1", canonical_id: "q-1" }]
        : table === "question_options" ? [{ id: "db-option-b", question_id: "db-q-1", option_key: "B" }, { id: "db-option-e", question_id: "db-q-1", option_key: "E" }]
        : [];
      const query = {
        select: () => query, eq: () => query, in: () => query,
        maybeSingle: async () => ({ error: null, data: table === "exams" ? { id: "db-exam" } : null }),
        insert: async () => ({ error: null }),
        upsert: async (values: Array<Record<string, unknown>>) => { mocks.answerRows = values; return { error: null }; },
        update: () => {
          const updateQuery = {
            eq: () => updateQuery,
            select: () => updateQuery,
            maybeSingle: async () => { mocks.finalized = true; return { error: null, data: { id: attemptId } }; },
          };
          return updateQuery;
        },
        then: (resolve: (value: unknown) => unknown) => resolve({ error: null, data: rows }),
      };
      return query;
    },
  }),
}));

import { POST } from "./route";

const attemptId = "00000000-0000-4000-8000-000000000001";
function request(body: string) {
  return new Request("https://sinaqai.vercel.app/api/attempts/sync", { method: "POST", body });
}

beforeEach(() => { mocks.user = { id: "user" }; mocks.answerRows = []; mocks.finalized = false; });

describe("official attempt persistence", () => {
  it("requires an authenticated user", async () => {
    mocks.user = null;
    expect((await POST(request("{}"))).status).toBe(401);
  });

  it("rejects malformed request JSON", async () => {
    expect((await POST(request("{"))).status).toBe(400);
  });

  it("ignores client-supplied scores and persists a server-graded wrong answer", async () => {
    const response = await POST(request(JSON.stringify({
      attemptId, examId: "official-exam", durationSeconds: 120,
      score: 999, correctKey: "B",
      answers: [{ questionId: "q-1", selectedKey: "B", selectedAnswerText: null, solutionImagePath: null, awardedScore: 999 }],
    })));
    expect(response.status).toBe(200);
    expect(mocks.answerRows[0]).toMatchObject({
      question_id: "db-q-1", selected_option_id: "db-option-b", awarded_score: 0, is_correct: false,
    });
    expect(mocks.finalized).toBe(true);
  });
});
