import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: vi.fn(),
}));

import { GET } from "@/app/api/nearby/route";
import { supabaseAdmin } from "@/lib/supabase/server";

function makeAdmin(rows: unknown[]) {
  const rpc = vi.fn().mockResolvedValue({ data: rows, error: null });
  const storage = {
    from: () => ({
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x/${path}` } }),
    }),
  };
  return { rpc, storage };
}

describe("GET /api/nearby", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns items with distance and photo URL", async () => {
    const admin = makeAdmin([
      {
        id: "uuid-1",
        name: "Test Bhandara",
        lat: 26.8467,
        lng: 80.9462,
        photo_path: "abc.jpg",
        start_time: "17:00:00",
        end_time: "20:00:00",
        event_date: "2026-05-06",
        distance_m: 320.5,
      },
    ]);
    (supabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue(admin);

    const res = await GET(
      new Request("http://localhost/api/nearby?lat=26.84&lng=80.94&radius_m=500")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].photo_url).toBe("https://x/abc.jpg");
    expect(body.items[0].distance_m).toBeCloseTo(320.5, 1);
    expect(typeof body.items[0].is_happening_now).toBe("boolean");
  });

  it("returns 400 when params missing", async () => {
    const res = await GET(new Request("http://localhost/api/nearby?lat=26.84"));
    expect(res.status).toBe(400);
  });
});
