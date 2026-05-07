import { z } from "zod";

const ServerSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  ADMIN_EMAIL: z.email(),
});

export type ServerEnv = z.infer<typeof ServerSchema>;
export type ClientEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
};

let cachedServer: ServerEnv | null = null;
export function serverEnv(): ServerEnv {
  if (cachedServer) return cachedServer;
  const parsed = ServerSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid server environment: ${issues}`);
  }
  cachedServer = parsed.data;
  return cachedServer;
}

// `NEXT_PUBLIC_*` are inlined at build time. If not set during build (e.g.,
// running `next build` without env), we fall back to placeholders so the
// build succeeds — runtime calls will fail if the values are still missing.
export const clientEnv: ClientEnv = {
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
};
