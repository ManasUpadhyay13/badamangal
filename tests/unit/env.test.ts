import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("env", () => {
  const original = { ...process.env };
  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...original,
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      OPENAI_API_KEY: "gem",
      CRON_SECRET: "c",
      ADMIN_EMAIL: "admin@example.com",
    };
  });
  afterEach(() => {
    process.env = original;
  });

  it("loads server env when all required values present", async () => {
    const { serverEnv } = await import("../../src/lib/env");
    expect(serverEnv().OPENAI_API_KEY).toBe("gem");
  });

  it("throws when a required server value is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const { serverEnv } = await import("../../src/lib/env");
    expect(() => serverEnv()).toThrow(/OPENAI_API_KEY/);
  });
});
