import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ success: true, exchange: vi.fn() }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, config: { cookies: { setAll: (cookies: Array<{ name: string; value: string; options: { path: string } }>, headers: Record<string, string>) => void } }) => ({
    auth: { exchangeCodeForSession: async (code: string) => {
      mocks.exchange(code);
      if (mocks.success) config.cookies.setAll([{ name: "sb-test", value: "session", options: { path: "/" } }], {});
      return { error: mocks.success ? null : new Error("Expired") };
    } },
  }),
}));
import { GET } from "./route";

beforeEach(() => {
  mocks.success = true;
  mocks.exchange.mockReset();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-public-key");
});
afterEach(() => vi.unstubAllEnvs());

describe("email confirmation callback", () => {
  it("exchanges the code, writes session cookies, and returns to the exact result question", async () => {
    const request = new NextRequest("https://sinaqai.vercel.app/auth/callback?code=valid&returnTo=%2Fresults%2Fabc%3FaiExplain%3Dq-14%23question-q-14");
    const response = await GET(request);
    expect(response.headers.get("location")).toBe("https://sinaqai.vercel.app/results/abc?aiExplain=q-14#question-q-14");
    expect(response.cookies.get("sb-test")?.value).toBe("session");
    expect(mocks.exchange).toHaveBeenCalledWith("valid");
  });

  it("rejects an external destination and keeps failures on the login page", async () => {
    mocks.success = false;
    const request = new NextRequest("https://sinaqai.vercel.app/auth/callback?code=expired&returnTo=https%3A%2F%2Fevil.example.com");
    const response = await GET(request);
    expect(response.headers.get("location")).toBe("https://sinaqai.vercel.app/login?returnTo=%2Fdashboard&error=confirmation");
  });
});
