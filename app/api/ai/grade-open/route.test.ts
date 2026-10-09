import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ grade: vi.fn(), quota: vi.fn() }));

vi.mock("@/lib/data/demo-exams", () => ({
  getExam: (id: string) => id === "official-exam" ? {
    id, status: "draft", grade: 11, passages: [],
    questions: [{ id: "english-writing", subject: "İngilis dili", type: "essay",
      text: "What can we learn from monuments?", officialAnswer: "Example answer",
      officialExplanation: "At least three connected sentences with correct grammar." }],
  } : undefined,
}));
vi.mock("@/lib/ai/open-grading", () => ({ generateOpenGrade: mocks.grade }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc: mocks.quota }),
}));

import { POST } from "./route";

const body = { examId: "official-exam", questionId: "english-writing", studentAnswer: "Monuments show history. They show culture. We learn from them." };
function request(value: unknown, origin?: string) {
  return new Request("https://sinaqai.vercel.app/api/ai/grade-open", {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.4", ...(origin ? { origin } : {}) },
    body: JSON.stringify(value),
  });
}

beforeEach(() => {
  mocks.grade.mockReset().mockResolvedValue({ score: "2/3", reason: "Məzmun uyğundur.", strength: "Üç cümlə var.", improvement: "Dil xətalarını düzəlt." });
  mocks.quota.mockReset().mockResolvedValue({ data: true, error: null });
  vi.stubEnv("AI_PROVIDER", "gemini");
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-server-key");
});
afterEach(() => vi.unstubAllEnvs());

describe("guest AI review of English written answers", () => {
  it("uses the official criteria and returns a separate estimated grade", async () => {
    const response = await POST(request(body));
    expect(response.status).toBe(200);
    expect((await response.json()).grade.score).toBe("2/3");
    expect(mocks.grade).toHaveBeenCalledWith(expect.objectContaining({
      task: "opinion_writing", studentAnswer: body.studentAnswer,
      officialCriteria: "At least three connected sentences with correct grammar.",
    }));
    expect(mocks.quota).toHaveBeenCalledWith("consume_ai_anonymous_quota", { p_visitor_hash: expect.stringMatching(/^[0-9a-f]{64}$/) });
  });

  it("rejects unknown questions, empty answers and cross-origin requests", async () => {
    expect((await POST(request({ ...body, questionId: "unknown" }))).status).toBe(404);
    expect((await POST(request({ ...body, studentAnswer: " " }))).status).toBe(400);
    expect((await POST(request(body, "https://evil.example"))).status).toBe(403);
    expect(mocks.grade).not.toHaveBeenCalled();
  });

  it("applies the anonymous AI quota", async () => {
    mocks.quota.mockResolvedValue({ data: false, error: null });
    expect((await POST(request(body))).status).toBe(429);
    expect(mocks.grade).not.toHaveBeenCalled();
  });
});
