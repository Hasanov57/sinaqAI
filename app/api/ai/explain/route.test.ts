import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  cacheContent: null as string | null,
  generated: vi.fn(),
  quota: vi.fn(),
  cacheWrite: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: mocks.user } }) } }),
}));
vi.mock("@/lib/ai/provider", () => ({ generateQuestionExplanation: mocks.generated }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from(table: string) {
      const query = {
        select: () => query,
        eq: () => query,
        order: async () => ({ error: null, data: [
          { id: "option-b", option_key: "B", option_text: "Səhv cavab", is_correct: false },
          { id: "option-e", option_key: "E", option_text: "Doğru cavab", is_correct: true },
        ] }),
        maybeSingle: async () => ({ error: null, data: table === "exam_attempts" ? { id: "attempt", exam_id: "exam" }
          : table === "questions" ? { id: "question", question_type: "multiple_choice", question_text: "Rəsmi sual", official_explanation: "Rəsmi DİM izahı", topic_id: "topic", subject_id: "subject", grade_level: 11, alt_standard: null, passage_id: null }
          : table === "student_answers" ? { selected_option_id: "option-b", is_correct: false }
          : table === "ai_explanations" ? mocks.cacheContent ? { content: mocks.cacheContent } : null
          : table === "subjects" ? { name: "Riyaziyyat" }
          : table === "topics" ? { name: "Tənlik" }
          : null }),
        upsert: mocks.cacheWrite,
      };
      return query;
    },
    rpc: mocks.quota,
  }),
}));

import { POST } from "./route";

const attemptId = "00000000-0000-4000-8000-000000000001";
const valid = { summary: "B səhvdir.", whyWrong: "B məntiqi səhvdir.", correctReasoning: "E düzgündür.", keyRule: "Qaydanı tətbiq edin.", miniExample: null };
function request(body: unknown) {
  return new Request("https://sinaqai.vercel.app/api/ai/explain", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.user = { id: "user" };
  mocks.cacheContent = null;
  mocks.generated.mockReset().mockResolvedValue(valid);
  mocks.quota.mockReset().mockResolvedValue({ data: true, error: null });
  mocks.cacheWrite.mockReset().mockResolvedValue({ error: null });
  vi.stubEnv("AI_PROVIDER", "gemini");
  vi.stubEnv("GEMINI_API_KEY", "test-key");
});
afterEach(() => vi.unstubAllEnvs());

describe("authenticated AI explanation route", () => {
  it("rejects an unauthenticated request before using the provider", async () => {
    mocks.user = null;
    const response = await POST(request({ attemptId, questionId: "q-14" }));
    expect(response.status).toBe(401);
    expect(mocks.generated).not.toHaveBeenCalled();
  });

  it("loads the submitted answer and official DİM answer from the server", async () => {
    const response = await POST(request({ attemptId, questionId: "q-14", selectedKey: "C", officialCorrect: "A" }));
    expect(response.status).toBe(200);
    expect(mocks.generated).toHaveBeenCalledWith(expect.objectContaining({
      selected: { key: "B", text: "Səhv cavab" },
      correct: { key: "E", text: "Doğru cavab" },
      officialExplanation: "Rəsmi DİM izahı",
    }));
  });

  it("returns a matching cached response without consuming quota or calling Gemini", async () => {
    mocks.cacheContent = JSON.stringify(valid);
    const response = await POST(request({ attemptId, questionId: "q-14" }));
    expect((await response.json()).cached).toBe(true);
    expect(mocks.quota).not.toHaveBeenCalled();
    expect(mocks.generated).not.toHaveBeenCalled();
  });

  it("reports an inactive AI service when the key is missing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const response = await POST(request({ attemptId, questionId: "q-14" }));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("AI xidməti hazırda aktiv deyil.");
  });
});
