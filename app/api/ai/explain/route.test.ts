import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cacheContent: null as string | null,
  generated: vi.fn(),
  quota: vi.fn(),
  cacheWrite: vi.fn(),
}));

vi.mock("@/lib/data/demo-exams", () => ({
  getExam: (id: string) => id === "official-exam" ? {
    id, status: "draft", grade: 11,
    questions: [{
      id: "q-14", type: "multiple_choice", subject: "Riyaziyyat", topic: "Tənlik",
      text: "Rəsmi sual", officialExplanation: "Rəsmi DİM izahı",
      options: [
        { key: "B", text: "Səhv cavab", isCorrect: false },
        { key: "E", text: "Doğru cavab", isCorrect: true },
      ],
    }],
  } : undefined,
}));
vi.mock("@/lib/ai/provider", () => ({ generateQuestionExplanation: mocks.generated }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from(table: string) {
      const query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        maybeSingle: async () => ({ error: null, data: table === "exams" ? { id: "exam-db-id" }
          : table === "questions" ? { id: "question-db-id" }
          : table === "ai_explanations" && mocks.cacheContent ? { content: mocks.cacheContent }
          : null }),
        upsert: mocks.cacheWrite,
      };
      return query;
    },
    rpc: mocks.quota,
  }),
}));

import { POST } from "./route";

const valid = { summary: "B səhvdir.", whyWrong: "B məntiqi səhvdir.", correctReasoning: "E düzgündür.", keyRule: "Qaydanı tətbiq edin.", miniExample: null };
function request(body: unknown, origin?: string) {
  return new Request("https://sinaqai.vercel.app/api/ai/explain", {
    method: "POST", headers: {
      "content-type": "application/json", "x-forwarded-for": "203.0.113.1",
      ...(origin ? { origin } : {}),
    }, body: JSON.stringify(body),
  });
}
const answer = { examId: "official-exam", questionId: "q-14", selectedKey: "B" };

beforeEach(() => {
  mocks.cacheContent = null;
  mocks.generated.mockReset().mockResolvedValue(valid);
  mocks.quota.mockReset().mockResolvedValue({ data: true, error: null });
  mocks.cacheWrite.mockReset().mockResolvedValue({ error: null });
  vi.stubEnv("AI_PROVIDER", "gemini");
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-server-key");
});
afterEach(() => vi.unstubAllEnvs());

describe("registration-free official AI explanations", () => {
  it("explains a wrong option without a user account or saved attempt", async () => {
    const response = await POST(request(answer));
    expect(response.status).toBe(200);
    expect(mocks.generated).toHaveBeenCalledWith(expect.objectContaining({
      selected: { key: "B", text: "Səhv cavab" },
      correct: { key: "E", text: "Doğru cavab" },
      officialExplanation: "Rəsmi DİM izahı",
    }));
    expect(mocks.quota).toHaveBeenCalledWith("consume_ai_anonymous_quota", { p_visitor_hash: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(mocks.cacheWrite).toHaveBeenCalledWith(expect.objectContaining({ user_id: null, explanation_type: "generic" }), expect.any(Object));
  });

  it("rejects correct or unknown answers without calling Gemini", async () => {
    expect((await POST(request({ ...answer, selectedKey: "E" }))).status).toBe(400);
    expect((await POST(request({ ...answer, selectedKey: "A" }))).status).toBe(400);
    expect((await POST(request({ ...answer, questionId: "unknown" }))).status).toBe(404);
    expect(mocks.generated).not.toHaveBeenCalled();
  });

  it("reuses a shared explanation without spending another quota request", async () => {
    mocks.cacheContent = JSON.stringify(valid);
    const response = await POST(request(answer));
    expect(response.status).toBe(200);
    expect((await response.json()).cached).toBe(true);
    expect(mocks.quota).not.toHaveBeenCalled();
    expect(mocks.generated).not.toHaveBeenCalled();
  });

  it("limits anonymous usage and rejects cross-origin calls", async () => {
    mocks.quota.mockResolvedValue({ data: false, error: null });
    expect((await POST(request(answer))).status).toBe(429);
    expect((await POST(request(answer, "https://other.example"))).status).toBe(403);
    expect(mocks.generated).not.toHaveBeenCalled();
  });

  it("reports missing Gemini configuration without generating", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("AI_API_KEY", "");
    const response = await POST(request(answer));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("AI xidməti hazırda aktiv deyil.");
    expect(mocks.generated).not.toHaveBeenCalled();
  });
});
