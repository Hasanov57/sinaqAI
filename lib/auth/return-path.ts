const fallback = "/dashboard";

export function getSafeReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2_000) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(value) || /%2f|%5c|%0[0-9a-f]|%1[0-9a-f]/i.test(value)) return fallback;
  try {
    const url = new URL(value, "https://sinaqai.invalid");
    if (url.origin !== "https://sinaqai.invalid" || url.pathname === "/login" || url.pathname.startsWith("/auth/")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function loginPath(returnTo: string): string {
  return `/login?returnTo=${encodeURIComponent(getSafeReturnPath(returnTo))}`;
}

export function aiReturnPath(attemptId: string, questionId: string): string {
  const path = `/results/${encodeURIComponent(attemptId)}?aiExplain=${encodeURIComponent(questionId)}#question-${encodeURIComponent(questionId)}`;
  return getSafeReturnPath(path);
}

export function authCallbackDestination(url: URL, success: boolean): string {
  const returnTo = getSafeReturnPath(url.searchParams.get("returnTo"));
  return success ? returnTo : loginPath(returnTo) + "&error=confirmation";
}
