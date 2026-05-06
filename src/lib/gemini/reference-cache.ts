import { supabaseAdmin } from "@/lib/supabase/server";

const REF_NAMES = ["ref-1.jpg", "ref-2.jpg", "ref-3.jpg"];

let cache: { name: string; data: string; mimeType: string }[] | null = null;

/**
 * Lazily loads the 3 reference images from the private `reference-images`
 * bucket and caches them in memory for the lifetime of the server process.
 */
export async function getReferenceImages(): Promise<
  { name: string; data: string; mimeType: string }[]
> {
  if (cache) return cache;

  const admin = supabaseAdmin();
  const loaded = await Promise.all(
    REF_NAMES.map(async (name) => {
      const { data, error } = await admin.storage.from("reference-images").download(name);
      if (error || !data) {
        throw new Error(`Failed to load reference image ${name}: ${error?.message}`);
      }
      const buffer = Buffer.from(await data.arrayBuffer());
      return { name, data: buffer.toString("base64"), mimeType: "image/jpeg" };
    })
  );

  cache = loaded;
  return cache;
}

/** Test-only: reset the in-memory cache so subsequent calls re-load. */
export function __resetReferenceCacheForTests(): void {
  cache = null;
}
