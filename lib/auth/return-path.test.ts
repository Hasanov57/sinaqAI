import { describe, expect, it } from "vitest";
import { authCallbackDestination, getSafeReturnPath, loginPath, saveResultReturnPath } from "./return-path";

describe("safe authentication return paths", () => {
  it("preserves an internal result-saving intent", () => {
    const destination = saveResultReturnPath("abc");
    expect(destination).toBe("/results/abc?saveResult=1");
    expect(getSafeReturnPath(destination)).toBe(destination);
    expect(loginPath(destination)).toContain("returnTo=");
  });

  it.each(["https://evil.example.com", "//evil.example.com", "/\\evil.example.com", "/%2f%2fevil.example.com", "/login", "/auth/callback", "javascript:alert(1)"])(
    "rejects an external or looping path: %s",
    (path) => expect(getSafeReturnPath(path)).toBe("/dashboard"),
  );

  it("returns to the requested page after a successful email callback", () => {
    const url = new URL("https://sinaqai.vercel.app/auth/callback?returnTo=%2Fresults%2Fabc%3FsaveResult%3D1");
    expect(authCallbackDestination(url, true)).toBe("/results/abc?saveResult=1");
    expect(authCallbackDestination(url, false)).toContain("error=confirmation");
  });
});
