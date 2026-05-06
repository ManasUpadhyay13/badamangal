import { z } from "zod";

const ServerSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  ADMIN_EMAIL: z.email(),
});

const ClientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof ServerSchema>;
export type ClientEnv = z.infer<typeof ClientSchema>;

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

export const clientEnv: ClientEnv = ClientSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
