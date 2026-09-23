import { describe, expect, it } from "vitest";
import { aiReturnPath, authCallbackDestination, getSafeReturnPath, loginPath } from "./return-path";

describe("safe authentication return paths", () => {
  it("preserves an internal result, query, and question anchor", () => {
    const destination = aiReturnPath("abc", "q-14");
    expect(destination).toBe("/results/abc?aiExplain=q-14#question-q-14");
    expect(getSafeReturnPath(destination)).toBe(destination);
    expect(loginPath(destination)).toContain("returnTo=");
  });

  it.each(["https://evil.example.com", "//evil.example.com", "/\\evil.example.com", "/%2f%2fevil.example.com", "/login", "/auth/callback", "javascript:alert(1)"])(
    "rejects an external or looping path: %s",
    (path) => expect(getSafeReturnPath(path)).toBe("/dashboard"),
  );

  it("returns to the requested page after a successful email callback", () => {
    const url = new URL("https://sinaqai.vercel.app/auth/callback?returnTo=%2Fresults%2Fabc%3FaiExplain%3Dq-14%23question-q-14");
    expect(authCallbackDestination(url, true)).toBe("/results/abc?aiExplain=q-14#question-q-14");
    expect(authCallbackDestination(url, false)).toContain("error=confirmation");
  });
});
