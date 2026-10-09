import { afterEach, describe, expect, it, vi } from "vitest";
import { anonymousAiVisitorHash } from "./anonymous-quota";

afterEach(() => vi.unstubAllEnvs());

describe("anonymous AI visitor identity", () => {
  it("hashes the trusted forwarded IP without exposing it or the server key", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "private-test-key");
    const request = (ip: string) => new Request("https://sinaqai.vercel.app/api/ai/explain", { headers: { "x-forwarded-for": ip } });
    const first = anonymousAiVisitorHash(request("203.0.113.1"));
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).toBe(anonymousAiVisitorHash(request("203.0.113.1")));
    expect(first).not.toBe(anonymousAiVisitorHash(request("203.0.113.2")));
    expect(first).not.toContain("203.0.113.1");
  });

  it("does not invent a quota identity without a server secret", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(anonymousAiVisitorHash(new Request("https://sinaqai.vercel.app/api/ai/explain"))).toBeNull();
  });
});
