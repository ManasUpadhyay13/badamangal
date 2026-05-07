import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: vi.fn(),
}));

import { POST } from "@/app/api/cron/expire/route";
import { supabaseAdmin } from "@/lib/supabase/server";

const ENV_SECRET = "test-cron-secret";

function authedReq(secret = ENV_SECRET): Request {
  return new Request("http://localhost/api/cron/expire", {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
}

function fakeAdmin(rows: { id: string; photo_path: string }[]) {
  const removed: string[] = [];
  const deletedIds: string[] = [];
  const cleaned: { count: number } = { count: 0 };

  return {
    removed,
    deletedIds,
    cleaned,
    rpc: vi.fn().mockResolvedValue({ data: rows, error: null }),
    storage: {
      from: () => ({
        remove: async (paths: string[]) => {
          removed.push(...paths);
          return { data: null, error: null };
        },
      }),
    },
    from(table: string) {
      if (table === "badamangals") {
        return {
          delete() {
            return {
              in: async (_col: string, ids: string[]) => {
                deletedIds.push(...ids);
                return { data: null, error: null };
              },
            };
          },
        };
      }
      if (table === "rate_limit_attempts") {
        return {
          delete() {
            return {
              lt: async () => {
                cleaned.count = 1;
                return { data: null, error: null };
              },
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("POST /api/cron/expire", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.CRON_SECRET = ENV_SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    process.env.GEMINI_API_KEY = "g";
    process.env.ADMIN_EMAIL = "a@b.com";
  });

  it("returns 401 without bearer", async () => {
    const res = await POST(
      new Request("http://localhost/api/cron/expire", { method: "POST" })
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong bearer", async () => {
    const res = await POST(authedReq("wrong"));
    expect(res.status).toBe(401);
  });

  it("expires listings and deletes their photos", async () => {
    const admin = fakeAdmin([
      { id: "a", photo_path: "a.jpg" },
      { id: "b", photo_path: "b.jpg" },
    ]);
    (supabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue(admin);

    const res = await POST(authedReq());
    expect(res.status).toBe(200);
    expect(admin.removed).toEqual(["a.jpg", "b.jpg"]);
    expect(admin.deletedIds).toEqual(["a", "b"]);
    expect(admin.cleaned.count).toBe(1);
  });

  it("succeeds with zero rows to expire", async () => {
    const admin = fakeAdmin([]);
    (supabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue(admin);
    const res = await POST(authedReq());
    expect(res.status).toBe(200);
    expect(admin.removed).toEqual([]);
    expect(admin.deletedIds).toEqual([]);
  });
});
