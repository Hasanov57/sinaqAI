import { afterEach, describe, expect, it, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn(() => ({ admin: true })));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { createSupabaseAdminClient } from "./admin";

afterEach(() => {
  createClient.mockClear();
  vi.unstubAllEnvs();
});

describe("Supabase server configuration", () => {
  it("uses the legacy service-role key when the newer key is blank", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy-key");
    expect(createSupabaseAdminClient()).not.toBeNull();
    expect(createClient).toHaveBeenCalledWith("https://example.supabase.co", "legacy-key", expect.any(Object));
  });

  it("returns no admin client when neither server key is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(createSupabaseAdminClient()).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });
});
