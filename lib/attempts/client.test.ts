import { afterEach, describe, expect, it, vi } from "vitest";
import { AttemptSyncError, syncOfficialAttempt } from "./client";
import type { AttemptResult } from "@/types/exam";

const result = {
  attemptId: "00000000-0000-4000-8000-000000000001",
  examId: "official-exam",
  durationSeconds: 60,
  answers: [],
} as unknown as AttemptResult;

afterEach(() => vi.unstubAllGlobals());

describe("official attempt sync feedback", () => {
  it("shows the server's safe error instead of hiding the failure stage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: "Nəticələrin saxlanması aktiv deyil." }),
      { status: 503, headers: { "content-type": "application/json" } },
    )));
    await expect(syncOfficialAttempt(result)).rejects.toMatchObject({
      name: "AttemptSyncError", status: 503, message: "Nəticələrin saxlanması aktiv deyil.",
    } satisfies Partial<AttemptSyncError>);
  });

  it("keeps the HTTP status when the server returns no JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Service unavailable", { status: 503 })));
    await expect(syncOfficialAttempt(result)).rejects.toMatchObject({ status: 503 });
  });
});
