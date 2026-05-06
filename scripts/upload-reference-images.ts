import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  const dir = path.resolve("public/reference-placeholders");
  for (const name of ["ref-1.jpg", "ref-2.jpg", "ref-3.jpg"]) {
    const data = await readFile(path.join(dir, name));
    const { error } = await supabase.storage
      .from("reference-images")
      .upload(name, data, { contentType: "image/jpeg", upsert: true });
    if (error) throw error;
    console.log(`Uploaded ${name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
