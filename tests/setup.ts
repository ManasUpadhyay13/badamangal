import "@testing-library/jest-dom/vitest";

// Ensure NEXT_PUBLIC_* env vars are available at module-import time.
// `clientEnv` in src/lib/env.ts is parsed eagerly when modules load.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
