# Badamangal Locator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v1 of an India-wide, anonymous, mobile-first web app for finding and submitting badamangal (charitable food distribution) events, with Gemini Vision validation of submitted photos and rate-limited anonymous posting.

**Architecture:** Single Next.js 15 (App Router) project on Vercel. Supabase Postgres (with PostGIS) for geospatial queries, Supabase Storage for photos, Supabase Auth for the admin moderation page. Gemini 2.5 Flash for photo authenticity validation. Leaflet + OpenStreetMap for in-app maps; Google Maps deep-links for navigation. Vercel Cron for daily expiry. All times in IST (`Asia/Kolkata`).

**Tech Stack:**
- Next.js 15 (App Router), TypeScript strict, React 19, Node runtime
- Supabase (Postgres + PostGIS + Storage + Auth)
- Gemini 2.5 Flash via `@google/genai`
- Leaflet + react-leaflet + leaflet.markercluster (client-only)
- `@fingerprintjs/fingerprintjs` v3 (open-source MIT)
- `heic2any` for client-side HEIC conversion
- `date-fns` + `date-fns-tz` for IST math
- `zod` for runtime input validation
- Vitest + @testing-library/react for tests
- Plain CSS Modules + globals (no Tailwind) — matches the spec's CSS-custom-property palette directly

**Reference spec:** `docs/superpowers/specs/2026-05-06-badamangal-locator-design.md`

---

## File Structure

```
badamangal/
├── .env.example                            # template; safe to commit
├── .gitignore                              # already exists
├── .nvmrc                                  # node 20
├── next.config.mjs
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── vercel.json                             # cron schedule
├── public/
│   └── reference-placeholders/             # 3 placeholder dev images for Gemini
├── supabase/
│   └── migrations/
│       ├── 20260506000001_extensions.sql   # postgis, pgcrypto
│       ├── 20260506000002_tables.sql       # badamangals, reports, rate_limit_attempts
│       ├── 20260506000003_rls.sql          # write-deny + read-allow public
│       └── 20260506000004_storage.sql      # buckets + policies
├── src/
│   ├── app/
│   │   ├── globals.css                     # palette tokens, motif band, base styles
│   │   ├── layout.tsx                      # root layout with fonts
│   │   ├── page.tsx                        # landing /
│   │   ├── page.module.css
│   │   ├── find/
│   │   │   ├── page.tsx                    # server entry, hydrates client
│   │   │   ├── FindClient.tsx              # geolocation, fetch, list/map state
│   │   │   ├── ListView.tsx
│   │   │   ├── MapView.tsx                 # next/dynamic, ssr:false
│   │   │   ├── BadamangalCard.tsx
│   │   │   ├── RadiusSlider.tsx
│   │   │   └── find.module.css
│   │   ├── post/
│   │   │   ├── page.tsx
│   │   │   ├── PostForm.tsx
│   │   │   ├── LocationPicker.tsx
│   │   │   ├── PhotoInput.tsx
│   │   │   ├── ResultModals.tsx
│   │   │   └── post.module.css
│   │   ├── admin/
│   │   │   ├── layout.tsx                  # auth gate
│   │   │   ├── page.tsx                    # login + redirect
│   │   │   ├── reports/page.tsx            # reports queue
│   │   │   └── admin.module.css
│   │   ├── privacy/page.tsx
│   │   └── api/
│   │       ├── submit/route.ts
│   │       ├── nearby/route.ts
│   │       ├── report/route.ts
│   │       ├── cron/expire/route.ts
│   │       └── admin/
│   │           ├── reports/route.ts
│   │           ├── hide/route.ts
│   │           └── dismiss/route.ts
│   ├── components/
│   │   ├── MotifBand.tsx
│   │   ├── PillarButton.tsx
│   │   ├── Modal.tsx
│   │   ├── Toast.tsx
│   │   └── Footer.tsx
│   └── lib/
│       ├── env.ts                          # validated env access
│       ├── supabase/
│       │   ├── server.ts                   # service-role client factory
│       │   └── browser.ts                  # anon client (admin auth only)
│       ├── gemini/
│       │   ├── client.ts
│       │   ├── validator.ts
│       │   ├── rubric.ts
│       │   └── reference-cache.ts
│       ├── rate-limit/check.ts
│       ├── ist/time.ts                     # today_IST(), parse, format helpers
│       ├── fingerprint/useFingerprint.ts
│       ├── geo/
│       │   ├── deep-link.ts                # directions URL builder
│       │   └── distance.ts                 # "420 m away" formatter
│       └── photo/prepare.ts                # HEIC convert + downscale
└── tests/
    ├── unit/
    │   ├── ist-time.test.ts
    │   ├── geo-deep-link.test.ts
    │   ├── geo-distance.test.ts
    │   ├── happening-now.test.ts
    │   ├── photo-prepare.test.ts
    │   ├── rate-limit.test.ts
    │   ├── gemini-validator.test.ts
    │   └── rubric.test.ts
    └── integration/
        ├── api-submit.test.ts
        ├── api-nearby.test.ts
        ├── api-report.test.ts
        └── api-cron-expire.test.ts
```

---

## Conventions used in this plan

- **Working directory:** `/Users/manasupadhyay/Documents/manas/badamangal`
- **Package manager:** `npm`
- **Commits:** small, frequent. Use Conventional Commits (`feat:`, `chore:`, `test:`, `fix:`).
- **TDD discipline:** for pure logic (utilities, validators, rate-limit), write the failing test first. For UI components, write the implementation and verify by running the dev server + reading the rendered output. Some non-logic component tests are added where they cover meaningful behaviour (e.g., debounce on the radius slider).
- **Mocks:** Supabase and Gemini calls in unit/integration tests are mocked via `vi.mock`. We never hit the network in tests.
- **Migrations:** apply via Supabase SQL editor or `npx supabase db push` after `npx supabase link`. The plan does not require running the Supabase CLI locally.

---

## Phase 1 — Foundation

### Task 1.1: Scaffold the Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `next-env.d.ts`, `.nvmrc`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `public/favicon.ico`

- [ ] **Step 1: Initialize Next.js**

Run from project root (`/Users/manasupadhyay/Documents/manas/badamangal`):

```bash
npx create-next-app@latest . \
  --typescript \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-tailwind \
  --no-turbopack \
  --skip-install \
  --use-npm \
  --yes
```

Expected: `package.json`, `tsconfig.json`, `src/app/{layout.tsx,page.tsx,globals.css}` are created. The CLI may complain about a non-empty directory because of `.gitignore` and `docs/`; if it asks, answer "Continue" (`--yes` should accept).

- [ ] **Step 2: Pin Node version**

Create `.nvmrc`:

```
20
```

- [ ] **Step 3: Install deps and verify**

```bash
npm install
npm run dev
```

Expected: `next dev` boots on http://localhost:3000 and the default Next page renders. Stop the server (Ctrl-C).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 app with App Router and TypeScript"
```

---

### Task 1.2: Add Vitest + testing libraries

**Files:**
- Create: `vitest.config.ts`, `tests/setup.ts`
- Modify: `package.json`

- [ ] **Step 1: Install dev dependencies**

```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @types/node
```

- [ ] **Step 2: Add Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

- [ ] **Step 3: Add test setup**

Create `tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add scripts**

In `package.json`, ensure the `scripts` block includes:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 5: Smoke-test that Vitest runs**

Create `tests/unit/sanity.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run:

```bash
npm test
```

Expected: 1 test passes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add Vitest with jsdom and Testing Library"
```

---

### Task 1.3: Environment variables and validation

**Files:**
- Create: `.env.example`, `src/lib/env.ts`
- Test: `tests/unit/env.test.ts`

- [ ] **Step 1: Add `.env.example`**

```
# Public (browser-safe)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Server-only
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
CRON_SECRET=
ADMIN_EMAIL=
```

- [ ] **Step 2: Install zod**

```bash
npm install zod
```

- [ ] **Step 3: Write the failing test**

Create `tests/unit/env.test.ts`:

```ts
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
      GEMINI_API_KEY: "gem",
      CRON_SECRET: "c",
      ADMIN_EMAIL: "admin@example.com",
    };
  });
  afterEach(() => {
    process.env = original;
  });

  it("loads server env when all required values present", async () => {
    const { serverEnv } = await import("../../src/lib/env");
    expect(serverEnv().GEMINI_API_KEY).toBe("gem");
  });

  it("throws when a required server value is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    const { serverEnv } = await import("../../src/lib/env");
    expect(() => serverEnv()).toThrow(/GEMINI_API_KEY/);
  });
});
```

(Note: `vi.resetModules()` is required in `beforeEach` because both `serverEnv()` and `clientEnv` cache their parsed values at module scope; without resetting modules between tests, the second test would see the cached server env from the first.)

- [ ] **Step 4: Run the test (should fail)**

```bash
npm test -- tests/unit/env.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 5: Implement `src/lib/env.ts`**

```ts
import { z } from "zod";

const ServerSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  ADMIN_EMAIL: z.string().email(),
});

const ClientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof ServerSchema>;
export type ClientEnv = z.infer<typeof ClientSchema>;

let cachedServer: ServerEnv | null = null;
export function serverEnv(): ServerEnv {
  if (cachedServer) return cachedServer;
  const parsed = ServerSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server environment: ${issues}`);
  }
  cachedServer = parsed.data;
  return cachedServer;
}

export const clientEnv: ClientEnv = ClientSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
```

Note: `clientEnv` is parsed eagerly at module load — Next.js inlines `NEXT_PUBLIC_*` at build time. `serverEnv()` is lazy so unit tests can inject env vars before calling.

- [ ] **Step 6: Run the test (should pass)**

```bash
npm test -- tests/unit/env.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 7: Update `.gitignore`**

Verify `.gitignore` already excludes `.env*` and includes `!.env.example`. If not, add those lines.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(env): add zod-validated env loaders"
```

---

### Task 1.4: Database migrations

**Files:**
- Create:
  - `supabase/migrations/20260506000001_extensions.sql`
  - `supabase/migrations/20260506000002_tables.sql`
  - `supabase/migrations/20260506000003_rls.sql`
  - `supabase/migrations/20260506000004_storage.sql`

- [ ] **Step 1: Extensions migration**

Create `supabase/migrations/20260506000001_extensions.sql`:

```sql
-- PostGIS for geography(Point, 4326), pgcrypto for gen_random_uuid()
create extension if not exists postgis;
create extension if not exists pgcrypto;
```

- [ ] **Step 2: Tables migration**

Create `supabase/migrations/20260506000002_tables.sql`:

```sql
-- Listings
create table if not exists badamangals (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(name) between 1 and 80),
  location            geography(Point, 4326) not null,
  start_time          time not null,
  end_time            time not null check (end_time > start_time),
  event_date          date not null,
  photo_path          text not null,
  device_fingerprint  text not null,
  ip_address          inet not null,
  created_at          timestamptz not null default now(),
  hidden_at           timestamptz
);
create index if not exists badamangals_location_gix on badamangals using gist (location);
create index if not exists badamangals_event_date_idx on badamangals (event_date);

-- Reports
create table if not exists reports (
  id                    uuid primary key default gen_random_uuid(),
  badamangal_id         uuid not null references badamangals(id) on delete cascade,
  reporter_fingerprint  text not null,
  reporter_ip           inet not null,
  reason                text,
  created_at            timestamptz not null default now(),
  unique (badamangal_id, reporter_fingerprint)
);
create index if not exists reports_badamangal_idx on reports (badamangal_id);

-- Rate limit ledger
create table if not exists rate_limit_attempts (
  id                  bigserial primary key,
  device_fingerprint  text not null,
  ip_address          inet not null,
  attempted_at        timestamptz not null default now(),
  outcome             text not null check (outcome in ('accepted','rejected_validation','rate_limited'))
);
create index if not exists rate_limit_attempts_fp_idx on rate_limit_attempts (device_fingerprint, attempted_at);
create index if not exists rate_limit_attempts_ip_idx on rate_limit_attempts (ip_address, attempted_at);
```

- [ ] **Step 3: RLS migration**

Create `supabase/migrations/20260506000003_rls.sql`:

```sql
-- Enable RLS on every table; the service role bypasses RLS by design.
alter table badamangals enable row level security;
alter table reports enable row level security;
alter table rate_limit_attempts enable row level security;

-- Public can READ non-hidden, non-expired badamangals (defence in depth;
-- the public API uses the service role and applies the same filter explicitly).
create policy "public_read_active_badamangals" on badamangals
  for select
  to anon, authenticated
  using (hidden_at is null and event_date >= (now() at time zone 'Asia/Kolkata')::date);

-- No public writes anywhere. Reports and rate-limit rows are server-only.
-- (No policies = deny by default once RLS is on.)
```

- [ ] **Step 4: Storage migration**

Create `supabase/migrations/20260506000004_storage.sql`:

```sql
-- Buckets
insert into storage.buckets (id, name, public)
values ('badamangal-photos', 'badamangal-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('reference-images', 'reference-images', false)
on conflict (id) do nothing;

-- Public read on badamangal-photos
create policy "public_read_badamangal_photos" on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'badamangal-photos');

-- No public writes; service role bypasses RLS.
-- reference-images has no public policies → only service role can read/write.
```

- [ ] **Step 5: Apply migrations**

Apply via Supabase SQL editor (paste each file contents in order) OR via CLI:

```bash
# Optional, if using the CLI:
npx supabase login
npx supabase link --project-ref <YOUR_PROJECT_REF>
npx supabase db push
```

Expected: all four migrations succeed without error. Verify in Supabase dashboard:
- Tables: `badamangals`, `reports`, `rate_limit_attempts` exist with the right columns.
- Storage: two buckets exist, `badamangal-photos` is public, `reference-images` is not.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(db): add migrations for tables, RLS, and storage buckets"
```

---

### Task 1.5: Reference image placeholders

**Files:**
- Create: `public/reference-placeholders/ref-1.jpg`, `ref-2.jpg`, `ref-3.jpg`
- Create: `scripts/upload-reference-images.ts`

- [ ] **Step 1: Add placeholder images**

Use any three reasonably-representative images (kept inside `public/reference-placeholders/` for ease — they will not be served to clients). For the dev placeholders, use 3 generic images you have on hand or download free-license bhandara/temple-feast images and rename them `ref-1.jpg`, `ref-2.jpg`, `ref-3.jpg`. Keep each under 1 MB.

If no images are available yet, create three solid-colour 800x600 JPEGs as stubs:

```bash
mkdir -p public/reference-placeholders
# stubs: any image works; e.g.
# (skip actually creating these now; the upload script accepts whatever files are there)
```

- [ ] **Step 2: Create the upload script**

Create `scripts/upload-reference-images.ts`:

```ts
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
```

- [ ] **Step 3: Install Supabase JS and tsx**

```bash
npm install @supabase/supabase-js
npm install -D tsx
```

Add a script entry to `package.json`:

```json
"scripts": {
  "...": "...",
  "upload:refs": "tsx scripts/upload-reference-images.ts"
}
```

- [ ] **Step 4: Run upload**

```bash
npm run upload:refs
```

Expected: three "Uploaded ref-N.jpg" lines. Verify the files exist in the `reference-images` bucket via the Supabase dashboard.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(storage): add reference-image upload script and dev placeholders"
```

---

### Task 1.6: Global palette and motif CSS

**Files:**
- Modify: `src/app/globals.css` (overwrite)

- [ ] **Step 1: Replace the scaffolded globals.css**

Replace the file contents with:

```css
:root {
  --saffron-50:  #fffbeb;
  --saffron-100: #fef3c7;
  --saffron-500: #ea580c;
  --saffron-700: #92400e;
  --gold-500:    #ca8a04;
  --gold-700:    #854d0e;
  --green-700:   #166534;
  --green-900:   #14532d;
  --ivory:       #fffdf5;
  --ink-900:     #3a1f0e;
  --ink-600:     #6b3e00;

  --radius-md: 8px;
  --shadow-card: 0 1px 3px rgba(74, 37, 17, 0.08);

  --font-ui: var(--font-inter), system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-deva: var(--font-tiro-deva), serif;

  color-scheme: light;
}

html, body {
  margin: 0;
  padding: 0;
  background: var(--ivory);
  color: var(--ink-900);
  font-family: var(--font-ui);
  font-size: 16px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

* { box-sizing: border-box; }

a {
  color: var(--saffron-700);
  text-decoration: none;
}
a:hover { text-decoration: underline; }

button {
  font-family: inherit;
  cursor: pointer;
}

input, textarea, select {
  font-family: inherit;
  font-size: 1rem;
  background: var(--ivory);
  border: 1px solid var(--saffron-100);
  border-radius: var(--radius-md);
  padding: 0.5rem 0.75rem;
  color: var(--ink-900);
}
input:focus, textarea:focus, select:focus {
  outline: 2px solid var(--gold-500);
  outline-offset: 1px;
  border-color: var(--gold-500);
}

/* Chakra-wedge motif band, 8px tall */
.motif-band {
  height: 8px;
  width: 100%;
  background-color: var(--saffron-50);
  background-image: conic-gradient(
    from 0deg,
    var(--gold-500) 0deg 60deg,
    transparent 60deg 90deg,
    var(--gold-500) 90deg 150deg,
    transparent 150deg 180deg,
    var(--gold-500) 180deg 240deg,
    transparent 240deg 270deg,
    var(--gold-500) 270deg 330deg,
    transparent 330deg 360deg
  );
  background-size: 14px 14px;
  background-repeat: repeat-x;
  background-position: center;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.6rem 1rem;
  border: none;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--saffron-500), var(--saffron-700));
  color: #fff;
  font-weight: 600;
  font-size: 1rem;
  text-decoration: none;
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-primary:hover:not(:disabled) {
  filter: brightness(1.05);
  text-decoration: none;
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--saffron-100);
  border-radius: var(--radius-md);
  background: var(--ivory);
  color: var(--ink-900);
  font-weight: 500;
}

.label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--ink-600);
  margin-bottom: 0.25rem;
}

.card-surface {
  background: #fff;
  border: 1px solid var(--saffron-100);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(theme): add palette tokens, motif band, and base styles"
```

---

### Task 1.7: Root layout with fonts

**Files:**
- Modify: `src/app/layout.tsx` (overwrite)

- [ ] **Step 1: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter, Tiro_Devanagari_Hindi } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-inter",
  display: "swap",
});

const tiroDeva = Tiro_Devanagari_Hindi({
  subsets: ["devanagari", "latin"],
  weight: "400",
  variable: "--font-tiro-deva",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bhandara — Find a Badamangal near you",
  description: "Discover or share charitable food distribution events near you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${tiroDeva.variable}`}>
      <body>
        {children}
        <Footer />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Add Footer stub** (will fill in 1.10)

Create `src/components/Footer.tsx`:

```tsx
import Link from "next/link";

export default function Footer() {
  return (
    <footer
      style={{
        marginTop: "3rem",
        padding: "1.5rem 1rem",
        textAlign: "center",
        color: "var(--ink-600)",
        fontSize: "0.85rem",
        borderTop: "1px solid var(--saffron-100)",
      }}
    >
      <Link href="/privacy">Privacy</Link>
      <span style={{ margin: "0 0.5rem" }}>·</span>
      <span>🪔 Bhandara · Built with sewa in mind.</span>
    </footer>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(layout): root layout with Inter + Tiro Devanagari fonts and footer"
```

---

### Task 1.8: MotifBand component

**Files:**
- Create: `src/components/MotifBand.tsx`

- [ ] **Step 1: Implement**

```tsx
export default function MotifBand({
  marginBlock = "0",
}: {
  marginBlock?: string;
}) {
  return <div className="motif-band" style={{ marginBlock }} role="presentation" aria-hidden />;
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(ui): add MotifBand component"
```

---

### Task 1.9: PillarButton component

**Files:**
- Create: `src/components/PillarButton.tsx`, `src/components/PillarButton.module.css`

- [ ] **Step 1: Styles**

`src/components/PillarButton.module.css`:

```css
.pillar {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem 1.25rem;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--saffron-500), var(--saffron-700));
  color: #fff;
  text-decoration: none;
  font-weight: 700;
  font-size: 1.1rem;
  box-shadow: 0 4px 16px rgba(146, 64, 14, 0.18);
  border: 2px solid var(--gold-500);
  min-height: 120px;
}
.pillar:hover {
  filter: brightness(1.05);
  text-decoration: none;
}
.icon { font-size: 2rem; line-height: 1; }
.label { font-size: 1.1rem; }
.subtext { font-size: 0.85rem; font-weight: 400; opacity: 0.9; }
```

- [ ] **Step 2: Component**

`src/components/PillarButton.tsx`:

```tsx
import Link from "next/link";
import styles from "./PillarButton.module.css";

export default function PillarButton({
  href,
  icon,
  label,
  subtext,
}: {
  href: string;
  icon: string;
  label: string;
  subtext: string;
}) {
  return (
    <Link href={href} className={styles.pillar}>
      <span className={styles.icon} aria-hidden>{icon}</span>
      <span className={styles.label}>{label}</span>
      <span className={styles.subtext}>{subtext}</span>
    </Link>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(ui): add PillarButton component"
```

---

### Task 1.10: Landing page

**Files:**
- Modify: `src/app/page.tsx`, `src/app/page.module.css`

- [ ] **Step 1: Styles**

`src/app/page.module.css`:

```css
.shell {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 1rem;
}
.header {
  padding: 2rem 0 1rem;
  text-align: center;
}
.brand {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--saffron-700);
  margin: 0;
}
.tagline {
  margin: 0.5rem 0 0;
  color: var(--ink-600);
  font-size: 1rem;
}
.pillars {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin: 2rem 0;
}
.context {
  text-align: center;
  color: var(--ink-600);
  font-size: 0.95rem;
  padding: 0 1rem;
}
@media (max-width: 480px) {
  .pillars { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Page**

`src/app/page.tsx`:

```tsx
import MotifBand from "@/components/MotifBand";
import PillarButton from "@/components/PillarButton";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.brand}>🪔 Bhandara</h1>
        <p className={styles.tagline}>Find or share a Badamangal near you</p>
      </header>
      <MotifBand />
      <section className={styles.pillars}>
        <PillarButton
          href="/find"
          icon="🔎"
          label="Find a Bhandara"
          subtext="Discover events nearby"
        />
        <PillarButton
          href="/post"
          icon="📍"
          label="Post a Bhandara"
          subtext="Share where Prasad is being served"
        />
      </section>
      <p className={styles.context}>
        A community space for charitable food distribution events. Run by sewa, kept honest by AI verification.
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Open http://localhost:3000 and confirm:
- Brand "🪔 Bhandara" appears
- Motif band renders with gold wedges
- Two pillar buttons render side by side (stack on narrow screens)
- Footer with "Privacy" link appears

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(landing): add landing page with two pillar buttons"
```

---

## Phase 2 — Submission path

### Task 2.1: IST time utilities (TDD)

**Files:**
- Create: `src/lib/ist/time.ts`
- Test: `tests/unit/ist-time.test.ts`

- [ ] **Step 1: Install date-fns**

```bash
npm install date-fns date-fns-tz
```

- [ ] **Step 2: Write the failing test**

`tests/unit/ist-time.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  todayIST,
  istDateRange,
  isWithinSubmissionWindow,
  isHappeningNowIST,
  formatTimeIST,
} from "../../src/lib/ist/time";

describe("ist time helpers", () => {
  it("todayIST returns YYYY-MM-DD in IST", () => {
    // Use a fixed instant: 2026-05-06 18:30 UTC = 2026-05-07 00:00 IST
    const at = new Date(Date.UTC(2026, 4, 6, 18, 30, 0));
    expect(todayIST(at)).toBe("2026-05-07");
  });

  it("istDateRange returns today through today+14", () => {
    const at = new Date(Date.UTC(2026, 4, 6, 6, 0, 0));
    const { min, max } = istDateRange(at);
    expect(min).toBe("2026-05-06");
    expect(max).toBe("2026-05-20");
  });

  it("isWithinSubmissionWindow accepts dates in [today, today+14] IST", () => {
    const now = new Date(Date.UTC(2026, 4, 6, 6, 0, 0));
    expect(isWithinSubmissionWindow("2026-05-06", now)).toBe(true);
    expect(isWithinSubmissionWindow("2026-05-20", now)).toBe(true);
    expect(isWithinSubmissionWindow("2026-05-21", now)).toBe(false);
    expect(isWithinSubmissionWindow("2026-05-05", now)).toBe(false);
  });

  it("isHappeningNowIST returns true when current IST is within event window", () => {
    // Event 2026-05-06 17:00–20:00 IST. Now = 2026-05-06 13:00 UTC = 18:30 IST.
    const now = new Date(Date.UTC(2026, 4, 6, 13, 0, 0));
    expect(isHappeningNowIST("2026-05-06", "17:00:00", "20:00:00", now)).toBe(true);
    // Now = 2026-05-06 06:00 UTC = 11:30 IST → before
    const before = new Date(Date.UTC(2026, 4, 6, 6, 0, 0));
    expect(isHappeningNowIST("2026-05-06", "17:00:00", "20:00:00", before)).toBe(false);
  });

  it("formatTimeIST formats HH:mm:ss as h:mm A", () => {
    expect(formatTimeIST("17:00:00")).toBe("5:00 PM");
    expect(formatTimeIST("09:05:00")).toBe("9:05 AM");
  });
});
```

- [ ] **Step 3: Run (should fail)**

```bash
npm test -- tests/unit/ist-time.test.ts
```

Expected: module-not-found.

- [ ] **Step 4: Implement `src/lib/ist/time.ts`**

```ts
import { addDays } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

const TZ = "Asia/Kolkata";

export function todayIST(now: Date = new Date()): string {
  return formatInTimeZone(now, TZ, "yyyy-MM-dd");
}

export function istDateRange(now: Date = new Date()): { min: string; max: string } {
  const min = todayIST(now);
  const today = toZonedTime(now, TZ);
  const max = formatInTimeZone(addDays(today, 14), TZ, "yyyy-MM-dd");
  return { min, max };
}

export function isWithinSubmissionWindow(eventDate: string, now: Date = new Date()): boolean {
  const { min, max } = istDateRange(now);
  return eventDate >= min && eventDate <= max;
}

export function isHappeningNowIST(
  eventDate: string,
  startTime: string, // "HH:mm:ss"
  endTime: string,
  now: Date = new Date()
): boolean {
  const dateInIST = formatInTimeZone(now, TZ, "yyyy-MM-dd");
  if (dateInIST !== eventDate) return false;
  const hms = formatInTimeZone(now, TZ, "HH:mm:ss");
  return hms >= startTime && hms <= endTime;
}

export function formatTimeIST(hms: string): string {
  // Convert "HH:mm:ss" → "h:mm A" without timezone math
  const [h, m] = hms.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  const mm = m.toString().padStart(2, "0");
  return `${hh}:${mm} ${ampm}`;
}
```

- [ ] **Step 5: Run (should pass)**

```bash
npm test -- tests/unit/ist-time.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ist): add IST date/time helpers"
```

---

### Task 2.2: Photo prepare utility (client-side)

**Files:**
- Create: `src/lib/photo/prepare.ts`
- Test: `tests/unit/photo-prepare.test.ts`

The full pipeline (HEIC → JPEG, downscale to 1600 px) requires a browser. We unit-test only the pure pieces (extension detection, content-type sniffing, target dimensions calc). The DOM/canvas part is exercised manually in Task 2.13's verification.

- [ ] **Step 1: Install heic2any**

```bash
npm install heic2any
```

- [ ] **Step 2: Write the failing test**

`tests/unit/photo-prepare.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isHeic, computeTargetDims } from "../../src/lib/photo/prepare";

describe("photo prepare helpers", () => {
  it("detects HEIC by extension", () => {
    expect(isHeic({ name: "IMG.heic", type: "" } as File)).toBe(true);
    expect(isHeic({ name: "IMG.HEIF", type: "" } as File)).toBe(true);
    expect(isHeic({ name: "x.jpg", type: "image/jpeg" } as File)).toBe(false);
  });

  it("detects HEIC by MIME type", () => {
    expect(isHeic({ name: "x", type: "image/heic" } as File)).toBe(true);
    expect(isHeic({ name: "x", type: "image/heif" } as File)).toBe(true);
  });

  it("computeTargetDims keeps within 1600 px on the long edge", () => {
    expect(computeTargetDims(3200, 2400, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(computeTargetDims(2400, 3200, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(computeTargetDims(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});
```

- [ ] **Step 3: Run (should fail)**

```bash
npm test -- tests/unit/photo-prepare.test.ts
```

- [ ] **Step 4: Implement `src/lib/photo/prepare.ts`**

```ts
export function isHeic(file: { name: string; type: string }): boolean {
  if (file.type === "image/heic" || file.type === "image/heif") return true;
  const lower = file.name.toLowerCase();
  return lower.endsWith(".heic") || lower.endsWith(".heif");
}

export function computeTargetDims(
  width: number,
  height: number,
  maxLongEdge: number
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) return { width, height };
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Convert HEIC/HEIF to JPEG and downscale to ≤1600 px on the long edge.
 * Returns a JPEG Blob. Browser-only: uses canvas + heic2any.
 */
export async function prepareForUpload(input: File): Promise<{ blob: Blob; ext: "jpg" }> {
  const MAX_LONG_EDGE = 1600;
  const QUALITY = 0.85;

  let working: Blob = input;

  if (isHeic(input)) {
    const heic2any = (await import("heic2any")).default;
    const result = await heic2any({
      blob: input,
      toType: "image/jpeg",
      quality: QUALITY,
    });
    working = Array.isArray(result) ? result[0] : result;
  }

  const bitmap = await createImageBitmap(working);
  const { width, height } = computeTargetDims(bitmap.width, bitmap.height, MAX_LONG_EDGE);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/jpeg",
      QUALITY
    )
  );
  return { blob, ext: "jpg" };
}
```

- [ ] **Step 5: Run (should pass)**

```bash
npm test -- tests/unit/photo-prepare.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(photo): client-side HEIC convert + downscale helper"
```

---

### Task 2.3: Fingerprint hook

**Files:**
- Create: `src/lib/fingerprint/useFingerprint.ts`

- [ ] **Step 1: Install FingerprintJS**

```bash
npm install @fingerprintjs/fingerprintjs
```

- [ ] **Step 2: Implement the hook**

```ts
"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "bhandara.fp";

export function useFingerprint(): string | null {
  const [fp, setFp] = useState<string | null>(null);

  useEffect(() => {
    const cached = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (cached) {
      setFp(cached);
      return;
    }
    let cancelled = false;
    (async () => {
      const FP = (await import("@fingerprintjs/fingerprintjs")).default;
      const agent = await FP.load();
      const result = await agent.get();
      if (cancelled) return;
      window.localStorage.setItem(STORAGE_KEY, result.visitorId);
      setFp(result.visitorId);
    })().catch(() => {
      // Fingerprint generation failed; fall back to a random per-session ID
      // so submission still works (rate-limit by IP still applies).
      const fallback = `anon-${Math.random().toString(36).slice(2, 10)}`;
      if (!cancelled) {
        window.localStorage.setItem(STORAGE_KEY, fallback);
        setFp(fallback);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return fp;
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(fingerprint): add useFingerprint hook with localStorage cache"
```

---

### Task 2.4: Supabase server client factory

**Files:**
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/browser.ts`

- [ ] **Step 1: Install browser-side helper**

```bash
npm install @supabase/ssr
```

- [ ] **Step 2: Server client**

`src/lib/supabase/server.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

let cached: ReturnType<typeof createClient> | null = null;

export function supabaseAdmin() {
  if (cached) return cached;
  const env = serverEnv();
  cached = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
```

- [ ] **Step 3: Browser client (for admin auth only)**

`src/lib/supabase/browser.ts`:

```ts
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env";

export function supabaseBrowser() {
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(supabase): add server (service-role) and browser (anon) client factories"
```

---

### Task 2.5: Rate-limit check (TDD)

**Files:**
- Create: `src/lib/rate-limit/check.ts`
- Test: `tests/unit/rate-limit.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/rate-limit.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { checkAndRecordAttempt } from "../../src/lib/rate-limit/check";

type Row = { id: number; outcome: string };

function makeFakeAdmin(initialCount: number) {
  const inserted: { device_fingerprint: string; ip_address: string }[] = [];
  let nextId = 100;
  const fake: any = {
    from(table: string) {
      if (table !== "rate_limit_attempts") throw new Error(`Unexpected table ${table}`);
      return {
        insert(row: any) {
          const id = ++nextId;
          inserted.push(row);
          return {
            select: () => ({
              single: async () => ({ data: { id, outcome: "rate_limited" } as Row, error: null }),
            }),
          };
        },
        select(_: string, opts: { count?: string; head?: boolean }) {
          // Return chained: gt(...).or(...) → resolves to { count, error }
          const chain = {
            gt(_col: string, _val: string) {
              return chain;
            },
            or(_clause: string) {
              return chain;
            },
            then(resolve: (v: { count: number | null; error: null }) => void) {
              resolve({ count: initialCount + 1, error: null }); // +1 for the row we just inserted
              return Promise.resolve();
            },
          };
          return chain;
        },
        update(values: any) {
          return {
            eq: async (_col: string, _val: any) => ({ data: null, error: null }),
          };
        },
        delete() {
          return {
            eq: async (_col: string, _val: any) => ({ data: null, error: null }),
          };
        },
      };
    },
  };
  return { admin: fake, inserted };
}

describe("checkAndRecordAttempt", () => {
  it("allows when prior attempts < 5 (returns attemptId, ok=true)", async () => {
    const { admin } = makeFakeAdmin(/*initialCount=*/ 4); // already 4 prior; this is the 5th
    const result = await checkAndRecordAttempt(admin, {
      fingerprint: "fp1",
      ip: "1.2.3.4",
    });
    expect(result.ok).toBe(true);
    expect(result.attemptId).toBeGreaterThan(0);
  });

  it("blocks when prior attempts >= 5 (returns ok=false, retryAfterSeconds)", async () => {
    const { admin } = makeFakeAdmin(/*initialCount=*/ 5); // 5 prior; this would be the 6th
    const result = await checkAndRecordAttempt(admin, {
      fingerprint: "fp1",
      ip: "1.2.3.4",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(3600);
    }
  });
});
```

- [ ] **Step 2: Run (should fail)**

```bash
npm test -- tests/unit/rate-limit.test.ts
```

- [ ] **Step 3: Implement `src/lib/rate-limit/check.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export const HOURLY_LIMIT = 5;
export const WINDOW_MS = 60 * 60 * 1000;

export type AttemptInput = {
  fingerprint: string;
  ip: string;
};

export type AttemptResult =
  | { ok: true; attemptId: number }
  | { ok: false; retryAfterSeconds: number };

/**
 * Inserts a rate_limit_attempts row (outcome='rate_limited' as placeholder),
 * counts attempts in the trailing 60-minute window, and returns whether the
 * caller should be allowed to proceed.
 *
 * The caller is responsible for updating the row's outcome via markOutcome()
 * after their downstream work resolves, OR deleting it via deleteAttempt() if
 * the call should be made free (e.g., on Gemini infrastructure failure).
 */
export async function checkAndRecordAttempt(
  admin: SupabaseClient,
  input: AttemptInput
): Promise<AttemptResult> {
  const insertRes = await admin
    .from("rate_limit_attempts")
    .insert({
      device_fingerprint: input.fingerprint,
      ip_address: input.ip,
      outcome: "rate_limited",
    })
    .select("id, attempted_at")
    .single();

  if (insertRes.error || !insertRes.data) {
    throw new Error(`Failed to insert rate-limit attempt: ${insertRes.error?.message}`);
  }

  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const countRes = await admin
    .from("rate_limit_attempts")
    .select("id", { count: "exact", head: true })
    .gt("attempted_at", since)
    .or(`device_fingerprint.eq.${input.fingerprint},ip_address.eq.${input.ip}`);

  const total = countRes.count ?? 0;

  if (total > HOURLY_LIMIT) {
    return { ok: false, retryAfterSeconds: Math.ceil(WINDOW_MS / 1000) };
  }

  return { ok: true, attemptId: insertRes.data.id as number };
}

export async function markOutcome(
  admin: SupabaseClient,
  attemptId: number,
  outcome: "accepted" | "rejected_validation"
): Promise<void> {
  const { error } = await admin
    .from("rate_limit_attempts")
    .update({ outcome })
    .eq("id", attemptId);
  if (error) throw new Error(`markOutcome failed: ${error.message}`);
}

export async function deleteAttempt(admin: SupabaseClient, attemptId: number): Promise<void> {
  const { error } = await admin
    .from("rate_limit_attempts")
    .delete()
    .eq("id", attemptId);
  if (error) throw new Error(`deleteAttempt failed: ${error.message}`);
}
```

- [ ] **Step 4: Run (should pass)**

```bash
npm test -- tests/unit/rate-limit.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(rate-limit): sliding-window check with attempt ledger"
```

---

### Task 2.6: Gemini reference cache

**Files:**
- Create: `src/lib/gemini/reference-cache.ts`

- [ ] **Step 1: Implement**

```ts
import { supabaseAdmin } from "@/lib/supabase/server";

const REF_NAMES = ["ref-1.jpg", "ref-2.jpg", "ref-3.jpg"];

let cache: { name: string; data: string; mimeType: string }[] | null = null;

/**
 * Lazily loads the 3 reference images from the private `reference-images`
 * bucket and caches them in memory for the lifetime of the server process.
 * Returns each as a base64 string with its MIME type, ready to drop into a
 * Gemini multimodal request.
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
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(gemini): in-memory reference-image cache"
```

---

### Task 2.7: Validation rubric

**Files:**
- Create: `src/lib/gemini/rubric.ts`
- Test: `tests/unit/rubric.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/rubric.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { VALIDATION_RUBRIC, RESPONSE_SCHEMA } from "../../src/lib/gemini/rubric";

describe("rubric", () => {
  it("mentions key authentic markers", () => {
    expect(VALIDATION_RUBRIC).toMatch(/cooking vessels|kadhai|deg/i);
    expect(VALIDATION_RUBRIC).toMatch(/prasad|distribut/i);
    expect(VALIDATION_RUBRIC).toMatch(/temple|courtyard|pandal/i);
  });

  it("explicitly lists rejection categories", () => {
    expect(VALIDATION_RUBRIC.toLowerCase()).toContain("restaurant");
    expect(VALIDATION_RUBRIC.toLowerCase()).toContain("wedding");
    expect(VALIDATION_RUBRIC.toLowerCase()).toContain("stock photo");
  });

  it("response schema enforces is_authentic, confidence, reason", () => {
    expect(RESPONSE_SCHEMA.required).toEqual(["is_authentic", "confidence", "reason"]);
    expect(RESPONSE_SCHEMA.properties.confidence.enum).toEqual(["low", "medium", "high"]);
  });
});
```

- [ ] **Step 2: Run (should fail)**

```bash
npm test -- tests/unit/rubric.test.ts
```

- [ ] **Step 3: Implement `src/lib/gemini/rubric.ts`**

```ts
export const VALIDATION_RUBRIC = `An authentic badamangal/bhandara setup typically shows: large communal cooking vessels (kadhai, deg, pateela); volunteers preparing or distributing food; rows of seated devotees being served on plates or banana leaves; saffron-clad organisers; temple, courtyard, pandal, or public-square setting; marigold garlands or other devotional decorations; visible food items like puri, sabzi, halwa, kheer, prasad.

Reject with is_authentic=false: restaurants, weddings, generic crowd shots, food selfies, stock photos, screenshots, indoor home cooking, food delivery, photos that contain only people without food/cooking context, photos with overlaid memes/text/watermarks, photos that are clearly not from India.

Use the 3 reference images as exemplars of "authentic". Be conservative: when in doubt, reject and explain what is missing.`;

export const RESPONSE_SCHEMA = {
  type: "object",
  required: ["is_authentic", "confidence", "reason"],
  properties: {
    is_authentic: { type: "boolean" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    reason: { type: "string" },
  },
} as const;
```

- [ ] **Step 4: Run (should pass)**

```bash
npm test -- tests/unit/rubric.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(gemini): validation rubric and response schema"
```

---

### Task 2.8: Gemini validator (TDD with mock)

**Files:**
- Create: `src/lib/gemini/client.ts`
- Create: `src/lib/gemini/validator.ts`
- Test: `tests/unit/gemini-validator.test.ts`

- [ ] **Step 1: Install Gemini SDK**

```bash
npm install @google/genai
```

- [ ] **Step 2: Write the failing test**

`tests/unit/gemini-validator.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/gemini/client", () => ({
  geminiModel: vi.fn(),
  MODEL_ID: "gemini-2.5-flash",
}));

vi.mock("@/lib/gemini/reference-cache", () => ({
  getReferenceImages: async () => [
    { name: "ref-1.jpg", data: "AAA", mimeType: "image/jpeg" },
    { name: "ref-2.jpg", data: "BBB", mimeType: "image/jpeg" },
    { name: "ref-3.jpg", data: "CCC", mimeType: "image/jpeg" },
  ],
}));

import { geminiModel } from "@/lib/gemini/client";
import { validatePhoto } from "../../src/lib/gemini/validator";

describe("validatePhoto", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns is_authentic=true when Gemini says so", async () => {
    (geminiModel as any).mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify({ is_authentic: true, confidence: "high", reason: "looks like a real bhandara" }),
        },
      }),
    });
    const result = await validatePhoto({ data: "ZZZ", mimeType: "image/jpeg" });
    expect(result.is_authentic).toBe(true);
    expect(result.confidence).toBe("high");
  });

  it("returns is_authentic=false with reason when Gemini rejects", async () => {
    (geminiModel as any).mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify({ is_authentic: false, confidence: "medium", reason: "appears to be a wedding feast, not a public bhandara" }),
        },
      }),
    });
    const result = await validatePhoto({ data: "ZZZ", mimeType: "image/jpeg" });
    expect(result.is_authentic).toBe(false);
    expect(result.reason).toMatch(/wedding/);
  });

  it("throws ValidationInfraError on timeout", async () => {
    (geminiModel as any).mockReturnValue({
      generateContent: vi.fn().mockRejectedValue(new Error("timeout")),
    });
    await expect(validatePhoto({ data: "ZZZ", mimeType: "image/jpeg" })).rejects.toThrow(/Gemini/);
  });
});
```

- [ ] **Step 3: Run (should fail)**

```bash
npm test -- tests/unit/gemini-validator.test.ts
```

- [ ] **Step 4: Implement `src/lib/gemini/client.ts`**

```ts
import { GoogleGenAI } from "@google/genai";
import { serverEnv } from "@/lib/env";

let cached: GoogleGenAI | null = null;

export function geminiClient(): GoogleGenAI {
  if (cached) return cached;
  cached = new GoogleGenAI({ apiKey: serverEnv().GEMINI_API_KEY });
  return cached;
}

export const MODEL_ID = "gemini-2.5-flash";

/**
 * Returns a thin wrapper exposing `generateContent`. Mockable in tests.
 */
export function geminiModel() {
  const ai = geminiClient();
  return {
    generateContent: (request: Parameters<typeof ai.models.generateContent>[0]) =>
      ai.models.generateContent(request),
  };
}
```

- [ ] **Step 5: Implement `src/lib/gemini/validator.ts`**

```ts
import { geminiModel, MODEL_ID } from "@/lib/gemini/client";
import { getReferenceImages } from "@/lib/gemini/reference-cache";
import { VALIDATION_RUBRIC, RESPONSE_SCHEMA } from "@/lib/gemini/rubric";

export type ValidationOutcome = {
  is_authentic: boolean;
  confidence: "low" | "medium" | "high";
  reason: string;
};

const TIMEOUT_MS = 15_000;

export class ValidationInfraError extends Error {
  constructor(cause: unknown) {
    super(`Gemini call failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "ValidationInfraError";
  }
}

export async function validatePhoto(input: { data: string; mimeType: string }): Promise<ValidationOutcome> {
  const refs = await getReferenceImages();
  const model = geminiModel();

  const parts = [
    { text: VALIDATION_RUBRIC },
    { text: "Reference images of authentic bhandara setups:" },
    ...refs.map((r) => ({ inlineData: { data: r.data, mimeType: r.mimeType } })),
    { text: "Now evaluate the following submitted image:" },
    { inlineData: { data: input.data, mimeType: input.mimeType } },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await model.generateContent({
      model: MODEL_ID,
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA as any,
        // @ts-expect-error abortSignal supported at SDK level even if types lag
        abortSignal: controller.signal,
      },
    });

    const raw =
      typeof response.response?.text === "function"
        ? response.response.text()
        : (response as any).text ?? "";

    const parsed = JSON.parse(raw) as ValidationOutcome;
    if (typeof parsed.is_authentic !== "boolean") {
      throw new Error("Malformed Gemini response (missing is_authentic)");
    }
    return parsed;
  } catch (err) {
    throw new ValidationInfraError(err);
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 6: Run (should pass)**

```bash
npm test -- tests/unit/gemini-validator.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(gemini): validatePhoto with reference + rubric and JSON schema response"
```

---

### Task 2.9: POST /api/submit handler

**Files:**
- Create: `src/app/api/submit/route.ts`
- Test: `tests/integration/api-submit.test.ts`

- [ ] **Step 1: Write the failing integration test**

`tests/integration/api-submit.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/gemini/validator", () => ({
  validatePhoto: vi.fn(),
  ValidationInfraError: class extends Error {},
}));
vi.mock("@/lib/rate-limit/check", () => ({
  checkAndRecordAttempt: vi.fn(),
  markOutcome: vi.fn(),
  deleteAttempt: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: vi.fn(),
}));

import { POST } from "@/app/api/submit/route";
import { validatePhoto } from "@/lib/gemini/validator";
import { checkAndRecordAttempt, markOutcome, deleteAttempt } from "@/lib/rate-limit/check";
import { supabaseAdmin } from "@/lib/supabase/server";

function makeFormData(overrides: Partial<Record<string, string | Blob>> = {}): FormData {
  const fd = new FormData();
  fd.set("name", "Hanuman Mandir Bhandara");
  fd.set("lat", "26.8467");
  fd.set("lng", "80.9462");
  fd.set("event_date", isoToday());
  fd.set("start_time", "17:00");
  fd.set("end_time", "20:00");
  fd.set("photo", new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" }), "p.jpg");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v as any);
  return fd;
}
function isoToday(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

function makeReq(fd: FormData): Request {
  return new Request("http://localhost/api/submit", {
    method: "POST",
    body: fd,
    headers: { "x-device-fingerprint": "fp-test", "x-forwarded-for": "9.9.9.9" },
  });
}

function fakeAdmin() {
  const inserted: any[] = [];
  const removed: string[] = [];
  return {
    inserted,
    removed,
    storage: {
      from: () => ({
        upload: async (_path: string, _data: Blob, _opts: any) => ({ data: { path: "uuid.jpg" }, error: null }),
        remove: async (paths: string[]) => {
          removed.push(...paths);
          return { data: null, error: null };
        },
      }),
    },
    from: () => ({
      insert: (row: any) => {
        inserted.push(row);
        return {
          select: () => ({
            single: async () => ({ data: { id: "row-uuid" }, error: null }),
          }),
        };
      },
    }),
  };
}

describe("POST /api/submit", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 201 on accepted submission", async () => {
    (checkAndRecordAttempt as any).mockResolvedValue({ ok: true, attemptId: 42 });
    (validatePhoto as any).mockResolvedValue({ is_authentic: true, confidence: "high", reason: "ok" });
    const admin = fakeAdmin();
    (supabaseAdmin as any).mockReturnValue(admin);

    const res = await POST(makeReq(makeFormData()));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("row-uuid");
    expect(markOutcome).toHaveBeenCalledWith(admin, 42, "accepted");
  });

  it("returns 422 when Gemini rejects", async () => {
    (checkAndRecordAttempt as any).mockResolvedValue({ ok: true, attemptId: 43 });
    (validatePhoto as any).mockResolvedValue({ is_authentic: false, confidence: "high", reason: "looks like a wedding" });
    const admin = fakeAdmin();
    (supabaseAdmin as any).mockReturnValue(admin);

    const res = await POST(makeReq(makeFormData()));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.reason).toMatch(/wedding/);
    expect(markOutcome).toHaveBeenCalledWith(admin, 43, "rejected_validation");
    expect(admin.removed.length).toBe(1);
  });

  it("returns 429 when rate-limited", async () => {
    (checkAndRecordAttempt as any).mockResolvedValue({ ok: false, retryAfterSeconds: 1234 });
    const admin = fakeAdmin();
    (supabaseAdmin as any).mockReturnValue(admin);

    const res = await POST(makeReq(makeFormData()));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.retry_after_seconds).toBe(1234);
  });

  it("returns 502 and refunds the attempt on Gemini infra failure", async () => {
    (checkAndRecordAttempt as any).mockResolvedValue({ ok: true, attemptId: 50 });
    (validatePhoto as any).mockRejectedValue(new Error("timeout"));
    const admin = fakeAdmin();
    (supabaseAdmin as any).mockReturnValue(admin);

    const res = await POST(makeReq(makeFormData()));
    expect(res.status).toBe(502);
    expect(deleteAttempt).toHaveBeenCalledWith(admin, 50);
  });

  it("returns 400 on field validation failure", async () => {
    const fd = makeFormData({ name: "" });
    const res = await POST(makeReq(fd));
    expect(res.status).toBe(400);
  });

  it("returns 400 on event_date outside window", async () => {
    const tooFar = new Date(Date.now() + 30 * 86400 * 1000 + 5.5 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    const fd = makeFormData({ event_date: tooFar });
    const res = await POST(makeReq(fd));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run (should fail)**

```bash
npm test -- tests/integration/api-submit.test.ts
```

- [ ] **Step 3: Implement `src/app/api/submit/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  checkAndRecordAttempt,
  markOutcome,
  deleteAttempt,
} from "@/lib/rate-limit/check";
import { validatePhoto } from "@/lib/gemini/validator";
import { isWithinSubmissionWindow } from "@/lib/ist/time";

export const runtime = "nodejs";
export const maxDuration = 30; // seconds; Gemini 15s + buffer

const FormSchema = z.object({
  name: z.string().trim().min(1).max(80),
  lat: z.coerce.number().gte(-90).lte(90),
  lng: z.coerce.number().gte(-180).lte(180),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

function normaliseTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "0.0.0.0";
}

export async function POST(req: Request) {
  const fingerprint = req.headers.get("x-device-fingerprint");
  if (!fingerprint) {
    return NextResponse.json({ errors: { _root: "Missing fingerprint" } }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ errors: { _root: "Invalid multipart body" } }, { status: 400 });
  }

  const fields = {
    name: form.get("name"),
    lat: form.get("lat"),
    lng: form.get("lng"),
    event_date: form.get("event_date"),
    start_time: form.get("start_time"),
    end_time: form.get("end_time"),
  };

  const parsed = FormSchema.safeParse(fields);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const start = normaliseTime(parsed.data.start_time);
  const end = normaliseTime(parsed.data.end_time);
  if (end <= start) {
    return NextResponse.json(
      { errors: { end_time: "End time must be after start time" } },
      { status: 400 }
    );
  }

  if (!isWithinSubmissionWindow(parsed.data.event_date)) {
    return NextResponse.json(
      { errors: { event_date: "Event date must be within the next 14 days (IST)" } },
      { status: 400 }
    );
  }

  const photo = form.get("photo");
  if (!(photo instanceof Blob) || photo.size === 0) {
    return NextResponse.json({ errors: { photo: "Photo is required" } }, { status: 400 });
  }
  if (photo.size > 10 * 1024 * 1024) {
    return NextResponse.json({ errors: { photo: "Photo too large" } }, { status: 400 });
  }

  const ip = clientIp(req);
  const admin = supabaseAdmin();

  const limit = await checkAndRecordAttempt(admin, { fingerprint, ip });
  if (!limit.ok) {
    return NextResponse.json(
      { retry_after_seconds: limit.retryAfterSeconds },
      { status: 429 }
    );
  }

  const ext = (() => {
    const t = photo.type;
    if (t === "image/jpeg") return "jpg";
    if (t === "image/png") return "png";
    if (t === "image/webp") return "webp";
    return "jpg";
  })();
  const key = `${crypto.randomUUID()}.${ext}`;

  const upload = await admin.storage.from("badamangal-photos").upload(key, photo, {
    contentType: photo.type || "image/jpeg",
    upsert: false,
  });
  if (upload.error) {
    await deleteAttempt(admin, limit.attemptId);
    return NextResponse.json({ error: "upload_failed" }, { status: 502 });
  }

  let outcome;
  try {
    const buffer = Buffer.from(await photo.arrayBuffer());
    outcome = await validatePhoto({
      data: buffer.toString("base64"),
      mimeType: photo.type || "image/jpeg",
    });
  } catch (err) {
    await admin.storage.from("badamangal-photos").remove([key]);
    await deleteAttempt(admin, limit.attemptId);
    return NextResponse.json({ error: "validation_unavailable" }, { status: 502 });
  }

  if (!outcome.is_authentic) {
    await admin.storage.from("badamangal-photos").remove([key]);
    await markOutcome(admin, limit.attemptId, "rejected_validation");
    return NextResponse.json({ reason: outcome.reason }, { status: 422 });
  }

  const insert = await admin
    .from("badamangals")
    .insert({
      name: parsed.data.name,
      location: `SRID=4326;POINT(${parsed.data.lng} ${parsed.data.lat})`,
      start_time: start,
      end_time: end,
      event_date: parsed.data.event_date,
      photo_path: key,
      device_fingerprint: fingerprint,
      ip_address: ip,
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    await admin.storage.from("badamangal-photos").remove([key]);
    await markOutcome(admin, limit.attemptId, "rejected_validation");
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  await markOutcome(admin, limit.attemptId, "accepted");
  return NextResponse.json({ id: insert.data.id }, { status: 201 });
}
```

- [ ] **Step 4: Run (should pass)**

```bash
npm test -- tests/integration/api-submit.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): POST /api/submit with rate limit, Gemini validation, and storage cleanup"
```

---

### Task 2.10: PhotoInput component

**Files:**
- Create: `src/app/post/PhotoInput.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useState } from "react";
import { prepareForUpload } from "@/lib/photo/prepare";

export default function PhotoInput({
  onChange,
}: {
  onChange: (blob: Blob | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      onChange(null);
      setPreview(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { blob } = await prepareForUpload(file);
      const url = URL.createObjectURL(blob);
      setPreview(url);
      onChange(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process photo");
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="label" htmlFor="photo-input">
        Photo of the bhandara setup
      </label>
      <input
        id="photo-input"
        type="file"
        accept="image/*,.heic,.heif"
        onChange={handleFile}
      />
      {busy && <p style={{ color: "var(--ink-600)" }}>Preparing photo…</p>}
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {preview && (
        <img
          src={preview}
          alt="Preview"
          style={{ maxWidth: "100%", borderRadius: 8, marginTop: 8 }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(post): PhotoInput component with HEIC convert + downscale"
```

---

### Task 2.11: LocationPicker component (geolocation only)

**Files:**
- Create: `src/app/post/LocationPicker.tsx`

For Phase 2 we ship geolocation-only. The map pin-drop alternative is added in Phase 4 (Task 4.5).

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useState } from "react";

export type Coord = { lat: number; lng: number };

export default function LocationPicker({
  value,
  onChange,
}: {
  value: Coord | null;
  onChange: (c: Coord | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function detect() {
    if (!navigator.geolocation) {
      setError("Your browser does not support location.");
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setBusy(false);
      },
      (err) => {
        setError(err.message || "Could not detect your location.");
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }

  return (
    <div>
      <label className="label">Where is the bhandara?</label>
      <button type="button" className="btn-ghost" onClick={detect} disabled={busy}>
        {busy ? "Detecting…" : value ? "Re-detect" : "Use my location"}
      </button>
      {value && (
        <p style={{ marginTop: 8, color: "var(--ink-600)", fontSize: "0.9rem" }}>
          Pinned at {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
      )}
      {error && <p style={{ color: "#b91c1c", marginTop: 8 }}>{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(post): LocationPicker (geolocation-only; map pin-drop in Phase 4)"
```

---

### Task 2.12: ResultModals

**Files:**
- Create: `src/components/Modal.tsx`
- Create: `src/app/post/ResultModals.tsx`

- [ ] **Step 1: Generic Modal**

`src/components/Modal.tsx`:

```tsx
"use client";

import { useEffect } from "react";

export default function Modal({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(58, 31, 14, 0.5)",
        display: "grid",
        placeItems: "center",
        zIndex: 50,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        className="card-surface"
        style={{ maxWidth: 420, width: "100%", padding: "1.25rem" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ResultModals**

`src/app/post/ResultModals.tsx`:

```tsx
"use client";

import Modal from "@/components/Modal";

export type Result =
  | { kind: "rejected"; reason: string }
  | { kind: "rate_limited"; retryAt: Date }
  | null;

export default function ResultModals({
  result,
  onDismiss,
  onRetry,
}: {
  result: Result;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  if (!result) return null;
  if (result.kind === "rejected") {
    return (
      <Modal open onClose={onDismiss} title="This photo doesn't look like a bhandara">
        <p>{result.reason}</p>
        <p style={{ color: "var(--ink-600)", fontSize: "0.9rem" }}>
          Try a different photo that clearly shows cooking vessels, prasad distribution, or seated devotees being served.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn-ghost" type="button" onClick={onDismiss}>
            Close
          </button>
          <button className="btn-primary" type="button" onClick={onRetry}>
            Try a different photo
          </button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal open onClose={onDismiss} title="Submission limit reached">
      <p>You've reached the limit of 5 submissions per hour.</p>
      <p>Please try again at {result.retryAt.toLocaleTimeString()}.</p>
      <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
        <button className="btn-primary" type="button" onClick={onDismiss}>
          OK
        </button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(post): Modal and ResultModals for rejected and rate-limited states"
```

---

### Task 2.13: PostForm and /post page

**Files:**
- Create: `src/app/post/PostForm.tsx`
- Create: `src/app/post/page.tsx`
- Create: `src/app/post/post.module.css`

- [ ] **Step 1: Styles**

`src/app/post/post.module.css`:

```css
.shell {
  max-width: 560px;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}
.field {
  margin-bottom: 1.25rem;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1.5rem;
}
```

- [ ] **Step 2: PostForm**

`src/app/post/PostForm.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LocationPicker, { type Coord } from "./LocationPicker";
import PhotoInput from "./PhotoInput";
import ResultModals, { type Result } from "./ResultModals";
import { useFingerprint } from "@/lib/fingerprint/useFingerprint";
import { istDateRange } from "@/lib/ist/time";
import styles from "./post.module.css";

export default function PostForm() {
  const router = useRouter();
  const fp = useFingerprint();
  const { min, max } = useMemo(() => istDateRange(), []);

  const [coord, setCoord] = useState<Coord | null>(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const valid =
    Boolean(coord) &&
    name.trim().length > 0 &&
    date >= min &&
    date <= max &&
    start &&
    end &&
    end > start &&
    photo &&
    fp;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !coord || !photo || !fp) return;
    setSubmitting(true);
    setSubmitError(null);
    setResult(null);

    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("lat", String(coord.lat));
    fd.set("lng", String(coord.lng));
    fd.set("event_date", date);
    fd.set("start_time", start);
    fd.set("end_time", end);
    fd.set("photo", photo, "photo.jpg");

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        body: fd,
        headers: { "x-device-fingerprint": fp },
      });
      if (res.status === 201) {
        router.push("/find?submitted=1");
        return;
      }
      if (res.status === 422) {
        const body = await res.json();
        setResult({ kind: "rejected", reason: body.reason ?? "Photo did not match." });
      } else if (res.status === 429) {
        const body = await res.json();
        setResult({
          kind: "rate_limited",
          retryAt: new Date(Date.now() + (body.retry_after_seconds ?? 3600) * 1000),
        });
      } else if (res.status === 502) {
        setSubmitError("Validation service is temporarily unavailable. Please try again.");
      } else if (res.status === 400) {
        const body = await res.json();
        setSubmitError(
          Object.entries(body.errors ?? {})
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join("; ") || "Invalid submission"
        );
      } else {
        setSubmitError(`Unexpected error (${res.status}).`);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.shell} onSubmit={onSubmit}>
      <h1>Post a Bhandara</h1>
      <div className={styles.field}>
        <LocationPicker value={coord} onChange={setCoord} />
      </div>
      <div className={styles.field}>
        <label className="label" htmlFor="name">Event name</label>
        <input
          id="name"
          type="text"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Hanuman Mandir Bhandara"
          required
        />
      </div>
      <div className={styles.field}>
        <label className="label" htmlFor="date">Event date</label>
        <input
          id="date"
          type="date"
          min={min}
          max={max}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>
      <div className={`${styles.field} ${styles.row}`}>
        <div>
          <label className="label" htmlFor="start">Start time</label>
          <input
            id="start"
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="end">End time</label>
          <input
            id="end"
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
        </div>
      </div>
      <div className={styles.field}>
        <PhotoInput onChange={setPhoto} />
      </div>
      {submitError && (
        <p role="alert" style={{ color: "#b91c1c" }}>{submitError}</p>
      )}
      <div className={styles.actions}>
        <button type="submit" className="btn-primary" disabled={!valid || submitting}>
          {submitting ? "Submitting…" : "Submit Bhandara"}
        </button>
      </div>
      <ResultModals
        result={result}
        onDismiss={() => setResult(null)}
        onRetry={() => {
          setResult(null);
          setPhoto(null);
        }}
      />
    </form>
  );
}
```

- [ ] **Step 3: Page**

`src/app/post/page.tsx`:

```tsx
import MotifBand from "@/components/MotifBand";
import PostForm from "./PostForm";

export default function PostPage() {
  return (
    <>
      <MotifBand />
      <PostForm />
    </>
  );
}
```

- [ ] **Step 4: Manual verification**

```bash
npm run dev
```

In the browser:
1. Open http://localhost:3000/post.
2. Click "Use my location"; grant permission. The pinned coords should appear.
3. Fill name, today's date, 17:00–20:00.
4. Pick any image (JPEG or HEIC).
5. Click Submit.
6. Without a real Gemini key + reference uploads, the API will respond 502/422 — that's expected. Watch the terminal logs to confirm the request hits `/api/submit`.

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(post): PostForm and /post page wiring submission flow"
```

---

## Phase 3 — Discovery path

### Task 3.1: Distance formatter (TDD)

**Files:**
- Create: `src/lib/geo/distance.ts`
- Test: `tests/unit/geo-distance.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/geo-distance.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatDistance } from "../../src/lib/geo/distance";

describe("formatDistance", () => {
  it("renders metres under 1000", () => {
    expect(formatDistance(0)).toBe("Here");
    expect(formatDistance(80)).toBe("80 m away");
    expect(formatDistance(420)).toBe("420 m away");
  });

  it("renders kilometres at or above 1000", () => {
    expect(formatDistance(1000)).toBe("1.0 km away");
    expect(formatDistance(1234)).toBe("1.2 km away");
    expect(formatDistance(4999)).toBe("5.0 km away");
  });

  it("rounds metres to nearest 10 to avoid jitter", () => {
    expect(formatDistance(67)).toBe("70 m away");
    expect(formatDistance(102)).toBe("100 m away");
  });
});
```

- [ ] **Step 2: Run (should fail)**

```bash
npm test -- tests/unit/geo-distance.test.ts
```

- [ ] **Step 3: Implement `src/lib/geo/distance.ts`**

```ts
export function formatDistance(metres: number): string {
  if (!Number.isFinite(metres) || metres <= 5) return "Here";
  if (metres < 1000) {
    const rounded = Math.round(metres / 10) * 10;
    return `${rounded} m away`;
  }
  return `${(metres / 1000).toFixed(1)} km away`;
}
```

- [ ] **Step 4: Run (should pass)**

```bash
npm test -- tests/unit/geo-distance.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(geo): formatDistance helper"
```

---

### Task 3.2: Directions deep-link util (TDD)

**Files:**
- Create: `src/lib/geo/deep-link.ts`
- Test: `tests/unit/geo-deep-link.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/geo-deep-link.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { directionsUrl } from "../../src/lib/geo/deep-link";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

describe("directionsUrl", () => {
  it("returns comgooglemaps:// scheme on iOS", () => {
    const url = directionsUrl(
      { lat: 26.8467, lng: 80.9462, name: "Hanuman Mandir" },
      IPHONE_UA
    );
    expect(url).toMatch(/^comgooglemaps:\/\//);
    expect(url).toContain("daddr=26.8467,80.9462");
  });

  it("returns geo: intent on Android", () => {
    const url = directionsUrl(
      { lat: 26.8467, lng: 80.9462, name: "Hanuman Mandir" },
      ANDROID_UA
    );
    expect(url).toMatch(/^geo:26\.8467,80\.9462/);
    expect(url).toContain("Hanuman");
  });

  it("returns web URL on desktop / unknown", () => {
    const url = directionsUrl(
      { lat: 26.8467, lng: 80.9462, name: "Hanuman Mandir" },
      DESKTOP_UA
    );
    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\//);
    expect(url).toContain("destination=26.8467%2C80.9462");
  });

  it("falls back to web URL when UA is empty", () => {
    const url = directionsUrl({ lat: 1, lng: 2, name: "X" }, "");
    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\//);
  });
});
```

- [ ] **Step 2: Run (should fail)**

```bash
npm test -- tests/unit/geo-deep-link.test.ts
```

- [ ] **Step 3: Implement `src/lib/geo/deep-link.ts`**

```ts
export type Destination = {
  lat: number;
  lng: number;
  name: string;
};

export function directionsUrl(d: Destination, userAgent: string): string {
  const ua = userAgent || "";
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);

  if (isIOS) {
    return `comgooglemaps://?daddr=${d.lat},${d.lng}&directionsmode=walking`;
  }
  if (isAndroid) {
    return `geo:${d.lat},${d.lng}?q=${d.lat},${d.lng}(${encodeURIComponent(d.name)})`;
  }
  const params = new URLSearchParams({
    api: "1",
    destination: `${d.lat},${d.lng}`,
    travelmode: "walking",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Web URL fallback for app-deep-link failures. */
export function directionsWebUrl(d: Destination): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${d.lat},${d.lng}`,
    travelmode: "walking",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
```

- [ ] **Step 4: Run (should pass)**

```bash
npm test -- tests/unit/geo-deep-link.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(geo): directionsUrl deep-link builder"
```

---

### Task 3.3: "Happening now" derivation (TDD)

**Files:**
- Create: `src/lib/ist/happening.ts`
- Test: `tests/unit/happening-now.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/happening-now.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deriveTimingLabel } from "../../src/lib/ist/happening";

describe("deriveTimingLabel", () => {
  it('returns "Happening now" when in window', () => {
    // 2026-05-06 13:00 UTC = 18:30 IST
    const now = new Date(Date.UTC(2026, 4, 6, 13, 0, 0));
    const label = deriveTimingLabel(
      { event_date: "2026-05-06", start_time: "17:00:00", end_time: "20:00:00" },
      now
    );
    expect(label).toBe("Happening now");
  });

  it('returns "Starting at h:mm A" when same day, before start', () => {
    const now = new Date(Date.UTC(2026, 4, 6, 6, 0, 0)); // 11:30 IST
    const label = deriveTimingLabel(
      { event_date: "2026-05-06", start_time: "17:00:00", end_time: "20:00:00" },
      now
    );
    expect(label).toBe("Starting at 5:00 PM");
  });

  it('returns "Tomorrow h:mm A" when event is the next IST day', () => {
    const now = new Date(Date.UTC(2026, 4, 6, 6, 0, 0)); // 2026-05-06 11:30 IST
    const label = deriveTimingLabel(
      { event_date: "2026-05-07", start_time: "17:00:00", end_time: "20:00:00" },
      now
    );
    expect(label).toBe("Tomorrow 5:00 PM");
  });

  it('returns "DD MMM, h:mm A" for events further away', () => {
    const now = new Date(Date.UTC(2026, 4, 6, 6, 0, 0));
    const label = deriveTimingLabel(
      { event_date: "2026-05-12", start_time: "18:30:00", end_time: "21:00:00" },
      now
    );
    expect(label).toBe("12 May, 6:30 PM");
  });
});
```

- [ ] **Step 2: Run (should fail)**

```bash
npm test -- tests/unit/happening-now.test.ts
```

- [ ] **Step 3: Implement `src/lib/ist/happening.ts`**

```ts
import { addDays, parseISO } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { formatTimeIST, isHappeningNowIST, todayIST } from "./time";

const TZ = "Asia/Kolkata";

export type EventTiming = {
  event_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm:ss
  end_time: string;
};

export function deriveTimingLabel(timing: EventTiming, now: Date = new Date()): string {
  if (isHappeningNowIST(timing.event_date, timing.start_time, timing.end_time, now)) {
    return "Happening now";
  }
  const today = todayIST(now);
  const tomorrow = formatInTimeZone(
    addDays(toZonedTime(now, TZ), 1),
    TZ,
    "yyyy-MM-dd"
  );
  if (timing.event_date === today) {
    return `Starting at ${formatTimeIST(timing.start_time)}`;
  }
  if (timing.event_date === tomorrow) {
    return `Tomorrow ${formatTimeIST(timing.start_time)}`;
  }
  const date = parseISO(timing.event_date);
  return `${formatInTimeZone(date, TZ, "d MMM")}, ${formatTimeIST(timing.start_time)}`;
}
```

- [ ] **Step 4: Run (should pass)**

```bash
npm test -- tests/unit/happening-now.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ist): deriveTimingLabel for card subtitle"
```

---

### Task 3.4: GET /api/nearby handler

**Files:**
- Create: `src/app/api/nearby/route.ts`
- Test: `tests/integration/api-nearby.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/integration/api-nearby.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: vi.fn(),
}));

import { GET } from "@/app/api/nearby/route";
import { supabaseAdmin } from "@/lib/supabase/server";

function makeAdmin(rows: any[]) {
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
    (supabaseAdmin as any).mockReturnValue(admin);

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
```

- [ ] **Step 2: Add the SQL function migration**

Create `supabase/migrations/20260506000005_nearby_fn.sql`:

```sql
create or replace function nearby_badamangals(
  in_lat double precision,
  in_lng double precision,
  in_radius_m double precision
)
returns table (
  id uuid,
  name text,
  lat double precision,
  lng double precision,
  photo_path text,
  start_time time,
  end_time time,
  event_date date,
  distance_m double precision
)
language sql
stable
as $$
  select
    b.id,
    b.name,
    st_y(b.location::geometry) as lat,
    st_x(b.location::geometry) as lng,
    b.photo_path,
    b.start_time,
    b.end_time,
    b.event_date,
    st_distance(b.location, st_makepoint(in_lng, in_lat)::geography) as distance_m
  from badamangals b
  where b.hidden_at is null
    and b.event_date >= (now() at time zone 'Asia/Kolkata')::date
    and st_dwithin(b.location, st_makepoint(in_lng, in_lat)::geography, in_radius_m)
  order by distance_m asc
  limit 200;
$$;
```

Apply this migration (SQL editor or `supabase db push`).

- [ ] **Step 3: Run the test (should fail — module not found)**

```bash
npm test -- tests/integration/api-nearby.test.ts
```

- [ ] **Step 4: Implement `src/app/api/nearby/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isHappeningNowIST } from "@/lib/ist/time";

export const runtime = "nodejs";

const QuerySchema = z.object({
  lat: z.coerce.number().gte(-90).lte(90),
  lng: z.coerce.number().gte(-180).lte(180),
  radius_m: z.coerce.number().gte(50).lte(5000).default(500),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    lat: url.searchParams.get("lat"),
    lng: url.searchParams.get("lng"),
    radius_m: url.searchParams.get("radius_m") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("nearby_badamangals", {
    in_lat: parsed.data.lat,
    in_lng: parsed.data.lng,
    in_radius_m: parsed.data.radius_m,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    photo_path: string;
    start_time: string;
    end_time: string;
    event_date: string;
    distance_m: number;
  }>;

  const items = rows.map((row) => {
    const { data: pub } = admin.storage
      .from("badamangal-photos")
      .getPublicUrl(row.photo_path);
    return {
      id: row.id,
      name: row.name,
      lat: row.lat,
      lng: row.lng,
      photo_url: pub.publicUrl,
      start_time: row.start_time,
      end_time: row.end_time,
      event_date: row.event_date,
      distance_m: row.distance_m,
      is_happening_now: isHappeningNowIST(
        row.event_date,
        row.start_time,
        row.end_time
      ),
    };
  });

  return NextResponse.json({ items }, { status: 200 });
}
```

- [ ] **Step 5: Run (should pass)**

```bash
npm test -- tests/integration/api-nearby.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): GET /api/nearby with PostGIS function and public photo URLs"
```

---

### Task 3.5: BadamangalCard component

**Files:**
- Create: `src/app/find/BadamangalCard.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useEffect, useState } from "react";
import { directionsUrl, directionsWebUrl } from "@/lib/geo/deep-link";
import { formatDistance } from "@/lib/geo/distance";
import { deriveTimingLabel } from "@/lib/ist/happening";

export type FindItem = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  photo_url: string;
  start_time: string;
  end_time: string;
  event_date: string;
  distance_m: number;
  is_happening_now: boolean;
};

export default function BadamangalCard({
  item,
  onReport,
}: {
  item: FindItem;
  onReport: (id: string) => void;
}) {
  const [ua, setUa] = useState("");
  useEffect(() => {
    setUa(navigator.userAgent);
  }, []);

  const label = deriveTimingLabel({
    event_date: item.event_date,
    start_time: item.start_time,
    end_time: item.end_time,
  });

  const primaryHref = ua ? directionsUrl({ lat: item.lat, lng: item.lng, name: item.name }, ua) : "#";
  const fallbackHref = directionsWebUrl({ lat: item.lat, lng: item.lng, name: item.name });

  return (
    <article className="card-surface" style={{ overflow: "hidden", marginBottom: "0.75rem" }}>
      <div style={{ position: "relative", aspectRatio: "16/9", background: "var(--saffron-100)" }}>
        <img
          src={item.photo_url}
          alt={item.name}
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        {item.is_happening_now && (
          <span
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: "var(--green-700)",
              color: "#fff",
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            Happening now
          </span>
        )}
      </div>
      <div style={{ padding: "0.75rem 1rem" }}>
        <h3 style={{ margin: "0 0 0.25rem", fontSize: "1rem", color: "var(--ink-900)" }}>
          {item.name}
        </h3>
        <p style={{ margin: 0, color: "var(--ink-600)", fontSize: "0.9rem" }}>
          {label} · {formatDistance(item.distance_m)}
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
          <a
            className="btn-primary"
            href={primaryHref}
            onClick={(e) => {
              if (primaryHref === "#") e.preventDefault();
            }}
          >
            Get directions ↗
          </a>
          {primaryHref !== fallbackHref && (
            <a className="btn-ghost" href={fallbackHref}>
              Open in browser
            </a>
          )}
          <button
            type="button"
            onClick={() => onReport(item.id)}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "none",
              color: "var(--ink-600)",
              fontSize: "0.85rem",
              textDecoration: "underline",
            }}
          >
            Report
          </button>
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(find): BadamangalCard with directions deep-link and Happening-now badge"
```

---

### Task 3.6: RadiusSlider with debounce

**Files:**
- Create: `src/app/find/RadiusSlider.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

export default function RadiusSlider({
  value,
  onCommit,
  disabled,
}: {
  value: number;
  onCommit: (next: number) => void;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState(value);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const next = Number(e.target.value);
    setLocal(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onCommit(next), 300);
  }

  const display = local < 1000 ? `${local} m` : `${(local / 1000).toFixed(1)} km`;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.4rem 0.75rem",
        background: "var(--saffron-50)",
        border: "1px solid var(--saffron-100)",
        borderRadius: 999,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{ fontSize: "0.85rem", color: "var(--ink-600)", minWidth: 64 }}>
        Within {display}
      </span>
      <input
        type="range"
        min={50}
        max={5000}
        step={50}
        value={local}
        onChange={handle}
        disabled={disabled}
        aria-label="Search radius"
        style={{ flex: 1 }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(find): RadiusSlider with 300ms debounce"
```

---

### Task 3.7: ListView component

**Files:**
- Create: `src/app/find/ListView.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";

import BadamangalCard, { type FindItem } from "./BadamangalCard";

export default function ListView({
  items,
  loading,
  onReport,
}: {
  items: FindItem[];
  loading: boolean;
  onReport: (id: string) => void;
}) {
  if (loading) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="card-surface"
            style={{
              height: 220,
              background:
                "linear-gradient(90deg, var(--saffron-50), var(--saffron-100), var(--saffron-50))",
              backgroundSize: "200% 100%",
              animation: "skeleton 1.4s ease-in-out infinite",
            }}
          />
        ))}
        <style>{`@keyframes skeleton { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p style={{ textAlign: "center", color: "var(--ink-600)", marginTop: "2rem" }}>
        No bhandaras found in this radius. Try expanding the search.
      </p>
    );
  }
  return (
    <div>
      {items.map((it) => (
        <BadamangalCard key={it.id} item={it} onReport={onReport} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(find): ListView with skeleton and empty states"
```

---

### Task 3.8: FindClient and /find page

**Files:**
- Create: `src/app/find/FindClient.tsx`
- Create: `src/app/find/page.tsx`
- Create: `src/app/find/find.module.css`

- [ ] **Step 1: Styles**

`src/app/find/find.module.css`:

```css
.shell {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 1rem 4rem;
}
.header {
  position: sticky;
  top: 0;
  background: var(--ivory);
  z-index: 10;
  padding: 1rem 0 0.75rem;
}
.title {
  margin: 0;
  font-size: 1.3rem;
  color: var(--saffron-700);
  text-align: center;
}
.controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.banner {
  background: var(--saffron-100);
  color: var(--ink-900);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}
.toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--green-900);
  color: #fff;
  padding: 0.6rem 1rem;
  border-radius: 999px;
  font-size: 0.9rem;
  z-index: 100;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}
```

- [ ] **Step 2: FindClient**

`src/app/find/FindClient.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import MotifBand from "@/components/MotifBand";
import RadiusSlider from "./RadiusSlider";
import ListView from "./ListView";
import type { FindItem } from "./BadamangalCard";
import styles from "./find.module.css";

export default function FindClient() {
  const router = useRouter();
  const search = useSearchParams();
  const showToast = search.get("submitted") === "1";

  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [radius, setRadius] = useState(500);
  const [items, setItems] = useState<FindItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!showToast) return;
    const t = setTimeout(() => {
      router.replace("/find");
    }, 4000);
    return () => clearTimeout(t);
  }, [showToast, router]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setPermissionDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoord({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setPermissionDenied(true),
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }, []);

  const fetchNearby = useCallback(
    async (lat: number, lng: number, r: number) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/nearby?lat=${lat}&lng=${lng}&radius_m=${r}`);
        if (!res.ok) {
          setItems([]);
          return;
        }
        const body = await res.json();
        setItems(body.items as FindItem[]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!coord) return;
    void fetchNearby(coord.lat, coord.lng, radius);
  }, [coord, radius, fetchNearby]);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.title}>🪔 Find a Bhandara</h1>
        <MotifBand marginBlock="0.5rem 0" />
        <div className={styles.controls}>
          <RadiusSlider value={radius} onCommit={setRadius} disabled={!coord} />
        </div>
      </header>

      {permissionDenied && !coord && (
        <div className={styles.banner}>
          We couldn't access your location. The map pin-drop alternative will be added soon — for now,
          please grant location permission and reload.
        </div>
      )}

      <ListView
        items={items}
        loading={loading && Boolean(coord)}
        onReport={(id) => {
          // Wired in Phase 5
          console.log("Report requested for", id);
        }}
      />

      {showToast && <div className={styles.toast}>Thanks for sharing 🪔</div>}
    </main>
  );
}
```

- [ ] **Step 3: Page**

`src/app/find/page.tsx`:

```tsx
import { Suspense } from "react";
import FindClient from "./FindClient";

export default function FindPage() {
  return (
    <Suspense fallback={null}>
      <FindClient />
    </Suspense>
  );
}
```

- [ ] **Step 4: Manual verification**

```bash
npm run dev
```

Open http://localhost:3000/find, grant location, and confirm:
- Header sticky with title + motif + radius slider
- Slider value updates the URL-based fetch (debounced)
- If no listings yet, the empty-state copy appears
- Submit a test row through the SQL editor (insert a row at your coords with `event_date = today_IST`, a `photo_path` like `placeholder.jpg`, etc.) and refresh — your card should appear

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(find): /find page with geolocation, slider, and list view"
```

---

## Phase 4 — Map

### Task 4.1: Install Leaflet dependencies

**Files:**
- Modify: `package.json`, `src/app/globals.css`

- [ ] **Step 1: Install**

```bash
npm install leaflet react-leaflet
npm install -D @types/leaflet
```

- [ ] **Step 2: Import Leaflet CSS at the top of `src/app/globals.css`**

Add this line as the FIRST line of the file (so the cascade works correctly):

```css
@import "leaflet/dist/leaflet.css";
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: add leaflet and react-leaflet dependencies"
```

---

### Task 4.2: Leaflet wrapper for SSR-safe loading

**Files:**
- Create: `src/app/find/leaflet-client.tsx` — re-exports react-leaflet primitives, marked client-only
- Create: `src/lib/geo/leaflet-icon.ts` — fix the marker-icon path bug

- [ ] **Step 1: Marker icon path fix**

`src/lib/geo/leaflet-icon.ts`:

```ts
"use client";

import L from "leaflet";

// Default Leaflet marker icons reference paths that don't resolve under Next.js bundling.
// Patch the prototype to point at the un-hashed CDN URLs.
type IconDefault = L.Icon.Default & { _getIconUrl?: () => string };
delete (L.Icon.Default.prototype as IconDefault)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export const saffronPin = L.divIcon({
  className: "saffron-pin",
  html: `<div style="
    width: 24px; height: 24px;
    border-radius: 50% 50% 50% 0;
    background: #ea580c;
    border: 2px solid #92400e;
    transform: rotate(-45deg);
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(map): leaflet marker icon fix and saffron pin"
```

---

### Task 4.3: MapView component

**Files:**
- Create: `src/app/find/MapView.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, useRef } from "react";
import L from "leaflet";
import { saffronPin } from "@/lib/geo/leaflet-icon";
import type { FindItem } from "./BadamangalCard";
import { directionsWebUrl } from "@/lib/geo/deep-link";
import { formatDistance } from "@/lib/geo/distance";
import { deriveTimingLabel } from "@/lib/ist/happening";

function FitBounds({ items, center }: { items: FindItem[]; center: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    if (items.length === 0) {
      map.setView([center.lat, center.lng], 15);
      return;
    }
    const bounds = L.latLngBounds(
      items.map((i) => [i.lat, i.lng] as [number, number]).concat([[center.lat, center.lng]])
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [items, center, map]);
  return null;
}

export default function MapView({
  items,
  center,
}: {
  items: FindItem[];
  center: { lat: number; lng: number };
}) {
  return (
    <div style={{ height: "70vh", borderRadius: 12, overflow: "hidden", border: "1px solid var(--saffron-100)" }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {items.map((item) => (
          <Marker key={item.id} position={[item.lat, item.lng]} icon={saffronPin}>
            <Popup>
              <strong>{item.name}</strong>
              <br />
              {deriveTimingLabel({
                event_date: item.event_date,
                start_time: item.start_time,
                end_time: item.end_time,
              })}
              <br />
              {formatDistance(item.distance_m)}
              <br />
              <a href={directionsWebUrl({ lat: item.lat, lng: item.lng, name: item.name })}>
                Get directions ↗
              </a>
            </Popup>
          </Marker>
        ))}
        <FitBounds items={items} center={center} />
      </MapContainer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(map): MapView with OSM tiles and saffron pins"
```

---

### Task 4.4: Add List/Map toggle to /find

**Files:**
- Modify: `src/app/find/FindClient.tsx`
- Modify: `src/app/find/find.module.css`

- [ ] **Step 1: Add toggle styles**

Append to `src/app/find/find.module.css`:

```css
.toggle {
  display: flex;
  background: var(--saffron-100);
  border-radius: 999px;
  padding: 3px;
  align-self: center;
  width: fit-content;
}
.toggleBtn {
  padding: 0.35rem 0.9rem;
  border: none;
  background: transparent;
  color: var(--ink-900);
  font-weight: 500;
  border-radius: 999px;
  cursor: pointer;
}
.toggleBtnActive {
  background: linear-gradient(135deg, var(--saffron-500), var(--saffron-700));
  color: #fff;
}
```

- [ ] **Step 2: Update FindClient**

Replace `src/app/find/FindClient.tsx` with:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import MotifBand from "@/components/MotifBand";
import RadiusSlider from "./RadiusSlider";
import ListView from "./ListView";
import type { FindItem } from "./BadamangalCard";
import styles from "./find.module.css";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

export default function FindClient() {
  const router = useRouter();
  const search = useSearchParams();
  const showToast = search.get("submitted") === "1";

  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [radius, setRadius] = useState(500);
  const [items, setItems] = useState<FindItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");

  useEffect(() => {
    if (!showToast) return;
    const t = setTimeout(() => router.replace("/find"), 4000);
    return () => clearTimeout(t);
  }, [showToast, router]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setPermissionDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoord({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setPermissionDenied(true),
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }, []);

  const fetchNearby = useCallback(async (lat: number, lng: number, r: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nearby?lat=${lat}&lng=${lng}&radius_m=${r}`);
      if (!res.ok) {
        setItems([]);
        return;
      }
      const body = await res.json();
      setItems(body.items as FindItem[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!coord) return;
    void fetchNearby(coord.lat, coord.lng, radius);
  }, [coord, radius, fetchNearby]);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.title}>🪔 Find a Bhandara</h1>
        <MotifBand marginBlock="0.5rem 0" />
        <div className={styles.controls}>
          <div className={styles.toggle} role="tablist">
            <button
              type="button"
              role="tab"
              className={`${styles.toggleBtn} ${view === "list" ? styles.toggleBtnActive : ""}`}
              onClick={() => setView("list")}
            >
              List
            </button>
            <button
              type="button"
              role="tab"
              className={`${styles.toggleBtn} ${view === "map" ? styles.toggleBtnActive : ""}`}
              onClick={() => setView("map")}
              disabled={!coord}
            >
              Map
            </button>
          </div>
          <RadiusSlider value={radius} onCommit={setRadius} disabled={!coord} />
        </div>
      </header>

      {permissionDenied && !coord && (
        <div className={styles.banner}>
          We couldn't access your location. Use the location picker on the Post page to drop a pin instead.
        </div>
      )}

      {view === "list" || !coord ? (
        <ListView
          items={items}
          loading={loading && Boolean(coord)}
          onReport={(id) => console.log("Report requested for", id)}
        />
      ) : (
        <MapView items={items} center={coord} />
      )}

      {showToast && <div className={styles.toast}>Thanks for sharing 🪔</div>}
    </main>
  );
}
```

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

- Open `/find`. Confirm List/Map toggle is visible.
- Click Map. Verify the OSM tiles render and any pins from the DB show up.
- Switch back to List.

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(find): list/map toggle with dynamic Leaflet map"
```

---

### Task 4.5: Pin-drop in LocationPicker

**Files:**
- Modify: `src/app/post/LocationPicker.tsx`
- Create: `src/app/post/PinDropMap.tsx`

- [ ] **Step 1: PinDropMap (client-only)**

`src/app/post/PinDropMap.tsx`:

```tsx
"use client";

import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { useState } from "react";
import { saffronPin } from "@/lib/geo/leaflet-icon";
import type { Coord } from "./LocationPicker";

function ClickCapture({ onPick }: { onPick: (c: Coord) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function PinDropMap({
  value,
  onChange,
  initialCenter = { lat: 26.8467, lng: 80.9462 },
}: {
  value: Coord | null;
  onChange: (c: Coord) => void;
  initialCenter?: Coord;
}) {
  const [center] = useState(value ?? initialCenter);
  return (
    <div style={{ height: 320, borderRadius: 8, overflow: "hidden", border: "1px solid var(--saffron-100)" }}>
      <MapContainer center={[center.lat, center.lng]} zoom={14} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickCapture onPick={onChange} />
        {value && <Marker position={[value.lat, value.lng]} icon={saffronPin} />}
      </MapContainer>
    </div>
  );
}
```

- [ ] **Step 2: Update LocationPicker**

Replace `src/app/post/LocationPicker.tsx` with:

```tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const PinDropMap = dynamic(() => import("./PinDropMap"), { ssr: false });

export type Coord = { lat: number; lng: number };

type Mode = "geo" | "pin";

export default function LocationPicker({
  value,
  onChange,
}: {
  value: Coord | null;
  onChange: (c: Coord | null) => void;
}) {
  const [mode, setMode] = useState<Mode>("geo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function detect() {
    if (!navigator.geolocation) {
      setError("Your browser does not support location.");
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setBusy(false);
      },
      (err) => {
        setError(err.message || "Could not detect your location.");
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }

  return (
    <div>
      <label className="label">Where is the bhandara?</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }} role="radiogroup">
        <label>
          <input
            type="radio"
            name="locmode"
            checked={mode === "geo"}
            onChange={() => setMode("geo")}
          />
          {" "}Use my location
        </label>
        <label>
          <input
            type="radio"
            name="locmode"
            checked={mode === "pin"}
            onChange={() => setMode("pin")}
          />
          {" "}Pick on map
        </label>
      </div>

      {mode === "geo" ? (
        <>
          <button type="button" className="btn-ghost" onClick={detect} disabled={busy}>
            {busy ? "Detecting…" : value ? "Re-detect" : "Detect now"}
          </button>
          {error && <p style={{ color: "#b91c1c", marginTop: 8 }}>{error}</p>}
        </>
      ) : (
        <PinDropMap value={value} onChange={(c) => onChange(c)} />
      )}

      {value && (
        <p style={{ marginTop: 8, color: "var(--ink-600)", fontSize: "0.9rem" }}>
          Pinned at {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

- Open `/post`.
- Toggle to "Pick on map". Click anywhere on the map. The pin should appear and the lat/lng readout below should update.
- Toggle back to "Use my location". Re-detect. Lat/lng should change.

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(post): map pin-drop alternative for location"
```

---

## Phase 5 — Moderation

### Task 5.1: POST /api/report handler

**Files:**
- Create: `src/app/api/report/route.ts`
- Test: `tests/integration/api-report.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/integration/api-report.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: vi.fn(),
}));

import { POST } from "@/app/api/report/route";
import { supabaseAdmin } from "@/lib/supabase/server";

function makeAdmin(insertResult: { data: any; error: any }) {
  return {
    from: () => ({
      insert: vi.fn().mockResolvedValue(insertResult),
    }),
  };
}

function makeReq(body: any) {
  return new Request("http://localhost/api/report", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-device-fingerprint": "fp-x",
      "x-forwarded-for": "8.8.8.8",
    },
  });
}

describe("POST /api/report", () => {
  beforeEach(() => vi.resetAllMocks());

  it("inserts and returns 201 on success", async () => {
    (supabaseAdmin as any).mockReturnValue(makeAdmin({ data: { id: "r1" }, error: null }));
    const res = await POST(makeReq({ badamangal_id: "00000000-0000-0000-0000-000000000001", reason: "fake" }));
    expect(res.status).toBe(201);
  });

  it("returns 409 when same fingerprint already reported (unique violation)", async () => {
    (supabaseAdmin as any).mockReturnValue(
      makeAdmin({ data: null, error: { code: "23505", message: "duplicate" } })
    );
    const res = await POST(makeReq({ badamangal_id: "00000000-0000-0000-0000-000000000001" }));
    expect(res.status).toBe(409);
  });

  it("returns 400 for missing fingerprint", async () => {
    const res = await POST(
      new Request("http://localhost/api/report", {
        method: "POST",
        body: JSON.stringify({ badamangal_id: "00000000-0000-0000-0000-000000000001" }),
        headers: { "content-type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid uuid", async () => {
    const res = await POST(makeReq({ badamangal_id: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run (should fail)**

```bash
npm test -- tests/integration/api-report.test.ts
```

- [ ] **Step 3: Implement `src/app/api/report/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BodySchema = z.object({
  badamangal_id: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

export async function POST(req: Request) {
  const fingerprint = req.headers.get("x-device-fingerprint");
  if (!fingerprint) {
    return NextResponse.json({ error: "missing_fingerprint" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin.from("reports").insert({
    badamangal_id: parsed.data.badamangal_id,
    reporter_fingerprint: fingerprint,
    reporter_ip: clientIp(req),
    reason: parsed.data.reason ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "already_reported" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
```

- [ ] **Step 4: Run (should pass)**

```bash
npm test -- tests/integration/api-report.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): POST /api/report with duplicate detection"
```

---

### Task 5.2: Wire Report dialog in BadamangalCard

**Files:**
- Create: `src/app/find/ReportDialog.tsx`
- Modify: `src/app/find/FindClient.tsx` (replace the placeholder onReport handler)

- [ ] **Step 1: ReportDialog component**

`src/app/find/ReportDialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { useFingerprint } from "@/lib/fingerprint/useFingerprint";

type State =
  | { kind: "open" }
  | { kind: "submitting" }
  | { kind: "done" }
  | { kind: "duplicate" }
  | { kind: "error"; message: string };

export default function ReportDialog({
  badamangalId,
  onClose,
}: {
  badamangalId: string | null;
  onClose: () => void;
}) {
  const fp = useFingerprint();
  const [reason, setReason] = useState("");
  const [state, setState] = useState<State>({ kind: "open" });

  async function submit() {
    if (!fp || !badamangalId) return;
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-device-fingerprint": fp,
        },
        body: JSON.stringify({ badamangal_id: badamangalId, reason: reason.trim() || undefined }),
      });
      if (res.status === 201) setState({ kind: "done" });
      else if (res.status === 409) setState({ kind: "duplicate" });
      else setState({ kind: "error", message: `Unexpected status ${res.status}` });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Network error" });
    }
  }

  if (!badamangalId) return null;

  return (
    <Modal open onClose={onClose} title="Report this listing">
      {state.kind === "open" || state.kind === "submitting" ? (
        <>
          <label className="label">What's wrong with this listing?</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Optional: tell us what's off"
            style={{ width: "100%" }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <button className="btn-ghost" type="button" onClick={onClose} disabled={state.kind === "submitting"}>
              Cancel
            </button>
            <button className="btn-primary" type="button" onClick={submit} disabled={state.kind === "submitting" || !fp}>
              {state.kind === "submitting" ? "Submitting…" : "Submit report"}
            </button>
          </div>
        </>
      ) : (
        <>
          {state.kind === "done" && <p>Thanks. We'll review this listing soon.</p>}
          {state.kind === "duplicate" && <p>You've already reported this listing.</p>}
          {state.kind === "error" && <p style={{ color: "#b91c1c" }}>{state.message}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button className="btn-primary" type="button" onClick={onClose}>OK</button>
          </div>
        </>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Wire in FindClient**

In `src/app/find/FindClient.tsx`:

a) Add import at the top:

```tsx
import ReportDialog from "./ReportDialog";
```

b) Add state and handler near the existing `useState` calls:

```tsx
const [reportingId, setReportingId] = useState<string | null>(null);
```

c) Replace the existing `onReport={(id) => console.log("Report requested for", id)}` calls (in both ListView and the placeholder) with:

```tsx
onReport={(id) => setReportingId(id)}
```

d) Add the dialog inside the `<main>` element near the toast:

```tsx
<ReportDialog badamangalId={reportingId} onClose={() => setReportingId(null)} />
```

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

Open `/find`, click `Report` on any card. Submit; confirm 201. Click again on the same card; confirm 409 → "already reported".

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(find): Report dialog wired to /api/report"
```

---

### Task 5.3: Admin auth gate

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`
- Create: `src/app/admin/admin.module.css`

We use Supabase Auth with magic-link sign-in. The session lives in cookies via `@supabase/ssr`. The layout checks the session server-side and redirects unauthenticated visitors to the page-level login.

- [ ] **Step 1: Server-side cookie helper**

Create `src/lib/supabase/server-cookies.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { clientEnv } from "@/lib/env";

export async function supabaseServerWithCookies() {
  const store = await cookies();
  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(values) {
          for (const v of values) store.set(v.name, v.value, v.options);
        },
      },
    }
  );
}
```

- [ ] **Step 2: Admin layout**

`src/app/admin/admin.module.css`:

```css
.shell {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}
.center {
  text-align: center;
  padding: 3rem 1rem;
}
.row {
  display: grid;
  grid-template-columns: 80px 1fr auto;
  gap: 1rem;
  align-items: start;
  padding: 0.75rem;
  border-bottom: 1px solid var(--saffron-100);
}
.thumb {
  width: 80px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
}
.actions {
  display: flex;
  gap: 6px;
}
```

`src/app/admin/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import styles from "./admin.module.css";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <section className={styles.shell}>{children}</section>;
}
```

- [ ] **Step 3: Admin login + redirect page**

`src/app/admin/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { supabaseServerWithCookies } from "@/lib/supabase/server-cookies";
import { serverEnv } from "@/lib/env";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLanding() {
  const supabase = await supabaseServerWithCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && user.email === serverEnv().ADMIN_EMAIL) {
    redirect("/admin/reports");
  }
  return <LoginForm signedInOther={!!user} />;
}
```

- [ ] **Step 4: LoginForm client component**

Create `src/app/admin/LoginForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function LoginForm({ signedInOther }: { signedInOther: boolean }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setError(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/admin` },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div style={{ maxWidth: 360, margin: "3rem auto", textAlign: "center" }}>
      <h1>Admin sign-in</h1>
      {signedInOther && (
        <p style={{ color: "#b91c1c" }}>
          You're signed in but this email is not an admin. Sign out and try again.
        </p>
      )}
      {sent ? (
        <p>Check your inbox for the sign-in link.</p>
      ) : (
        <>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            style={{ width: "100%" }}
          />
          <button className="btn-primary" type="button" onClick={send} style={{ marginTop: 12 }}>
            Send magic link
          </button>
          {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Configure Supabase Auth**

In Supabase dashboard → Auth → URL Configuration:
- Add `http://localhost:3000/admin` and `https://YOUR-DOMAIN/admin` to **Redirect URLs**.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(admin): magic-link sign-in with email allowlist gate"
```

---

### Task 5.4: GET /api/admin/reports

**Files:**
- Create: `src/app/api/admin/reports/route.ts`
- Create: `src/lib/admin/auth.ts`

- [ ] **Step 1: Auth helper**

`src/lib/admin/auth.ts`:

```ts
import { supabaseServerWithCookies } from "@/lib/supabase/server-cookies";
import { serverEnv } from "@/lib/env";

export async function requireAdmin(): Promise<{ ok: true; email: string } | { ok: false; status: 401 | 403 }> {
  const supabase = await supabaseServerWithCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 };
  if (user.email !== serverEnv().ADMIN_EMAIL) return { ok: false, status: 403 };
  return { ok: true, email: user.email };
}
```

- [ ] **Step 2: Reports route**

`src/app/api/admin/reports/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("badamangals")
    .select(`
      id,
      name,
      photo_path,
      event_date,
      hidden_at,
      reports!inner ( id, reason, created_at )
    `)
    .order("created_at", { foreignTable: "reports", ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (data ?? []).map((row: any) => {
    const { data: pub } = admin.storage.from("badamangal-photos").getPublicUrl(row.photo_path);
    return {
      id: row.id,
      name: row.name,
      photo_url: pub.publicUrl,
      event_date: row.event_date,
      hidden_at: row.hidden_at,
      report_count: row.reports.length,
      reasons: row.reports.map((r: any) => r.reason).filter(Boolean),
      latest_report_at: row.reports[0]?.created_at,
    };
  });

  items.sort((a, b) => {
    if (b.report_count !== a.report_count) return b.report_count - a.report_count;
    return (b.latest_report_at ?? "").localeCompare(a.latest_report_at ?? "");
  });

  return NextResponse.json({ items });
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(api): GET /api/admin/reports listing reported badamangals"
```

---

### Task 5.5: POST /api/admin/hide and /dismiss

**Files:**
- Create: `src/app/api/admin/hide/route.ts`
- Create: `src/app/api/admin/dismiss/route.ts`

- [ ] **Step 1: Hide route**

`src/app/api/admin/hide/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({ id: z.string().uuid() });

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 400 });

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("badamangals")
    .update({ hidden_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Dismiss route**

`src/app/api/admin/dismiss/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({ id: z.string().uuid() });

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 400 });

  const admin = supabaseAdmin();
  const { error } = await admin.from("reports").delete().eq("badamangal_id", parsed.data.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(api): admin hide/dismiss endpoints"
```

---

### Task 5.6: Admin reports page UI

**Files:**
- Create: `src/app/admin/reports/page.tsx`
- Create: `src/app/admin/reports/ReportsClient.tsx`

- [ ] **Step 1: Server entry**

`src/app/admin/reports/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/admin");
  return <ReportsClient />;
}
```

- [ ] **Step 2: Client UI**

`src/app/admin/reports/ReportsClient.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import styles from "../admin.module.css";

type Item = {
  id: string;
  name: string;
  photo_url: string;
  event_date: string;
  hidden_at: string | null;
  report_count: number;
  reasons: string[];
  latest_report_at?: string;
};

export default function ReportsClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/reports");
    const body = await res.json();
    setItems(body.items ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function act(id: string, action: "hide" | "dismiss") {
    setPendingId(id);
    try {
      await fetch(`/api/admin/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await load();
    } finally {
      setPendingId(null);
    }
  }

  if (loading) return <p>Loading…</p>;
  if (items.length === 0) return <p>No reports queued. 🪔</p>;

  return (
    <div>
      <h1>Reports queue</h1>
      {items.map((it) => (
        <div key={it.id} className={styles.row}>
          <img src={it.photo_url} alt={it.name} className={styles.thumb} />
          <div>
            <div style={{ fontWeight: 600 }}>{it.name}</div>
            <div style={{ color: "var(--ink-600)", fontSize: "0.85rem" }}>
              Event {it.event_date} · {it.report_count} report{it.report_count === 1 ? "" : "s"}
              {it.hidden_at && " · HIDDEN"}
            </div>
            {it.reasons.length > 0 && (
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: "0.85rem" }}>
                {it.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
          <div className={styles.actions}>
            <button
              className="btn-ghost"
              type="button"
              disabled={pendingId === it.id || !!it.hidden_at}
              onClick={() => act(it.id, "hide")}
            >
              Hide
            </button>
            <button
              className="btn-ghost"
              type="button"
              disabled={pendingId === it.id}
              onClick={() => act(it.id, "dismiss")}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

1. Visit `/admin`. Sign in with `ADMIN_EMAIL` via the magic link.
2. After sign-in, you should land on `/admin/reports`.
3. Generate a report on any listing from `/find`.
4. Verify the row appears in the queue. Click Hide; verify the listing disappears from `/find` (since it now has `hidden_at`). Click Dismiss; verify the row's report count drops to 0.

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(admin): reports queue UI with hide/dismiss"
```

---

## Phase 6 — Lifecycle

### Task 6.1: POST /api/cron/expire handler

**Files:**
- Create: `src/app/api/cron/expire/route.ts`
- Test: `tests/integration/api-cron-expire.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/integration/api-cron-expire.test.ts`:

```ts
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
          select() {
            return {
              or: async () => ({ data: rows, error: null }),
            };
          },
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
    const res = await POST(new Request("http://localhost/api/cron/expire", { method: "POST" }));
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
    (supabaseAdmin as any).mockReturnValue(admin);

    const res = await POST(authedReq());
    expect(res.status).toBe(200);
    expect(admin.removed).toEqual(["a.jpg", "b.jpg"]);
    expect(admin.deletedIds).toEqual(["a", "b"]);
    expect(admin.cleaned.count).toBe(1);
  });

  it("succeeds with zero rows to expire", async () => {
    const admin = fakeAdmin([]);
    (supabaseAdmin as any).mockReturnValue(admin);
    const res = await POST(authedReq());
    expect(res.status).toBe(200);
    expect(admin.removed).toEqual([]);
    expect(admin.deletedIds).toEqual([]);
  });
});
```

- [ ] **Step 2: Run (should fail)**

```bash
npm test -- tests/integration/api-cron-expire.test.ts
```

- [ ] **Step 3: Implement `src/app/api/cron/expire/route.ts`**

```ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

const STORAGE_DELETE_BATCH = 100;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${serverEnv().CRON_SECRET}`;
  if (auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: rows, error: selectError } = await admin
    .from("badamangals")
    .select("id, photo_path")
    .or(
      `event_date.lt.(now() at time zone 'Asia/Kolkata')::date,hidden_at.not.is.null`
    );
  // Note: PostgREST syntax limits the OR to two simple comparisons. We can't
  // express the IST-timezone date inline — fall back to a server-computed
  // value below.

  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }

  const expiringRows = (rows ?? []) as { id: string; photo_path: string }[];

  if (expiringRows.length > 0) {
    for (const batch of chunk(expiringRows.map((r) => r.photo_path), STORAGE_DELETE_BATCH)) {
      const { error } = await admin.storage.from("badamangal-photos").remove(batch);
      if (error) console.error("storage remove error", error);
    }

    const { error: deleteError } = await admin
      .from("badamangals")
      .delete()
      .in("id", expiringRows.map((r) => r.id));
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  // Housekeep the rate-limit ledger (>7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  const { error: rlError } = await admin
    .from("rate_limit_attempts")
    .delete()
    .lt("attempted_at", sevenDaysAgo);
  if (rlError) console.error("rate-limit cleanup error", rlError);

  console.log(`[cron/expire] removed ${expiringRows.length} listings`);
  return NextResponse.json({
    expired: expiringRows.length,
  });
}
```

Note: the PostgREST `.or(...)` filter has limitations expressing the IST-localized `current_date`. To make the comparison correct, replace the `.or(...)` block above with a database RPC. Add this migration to keep the logic in SQL where it's accurate:

Create `supabase/migrations/20260506000006_expiring_fn.sql`:

```sql
create or replace function expiring_badamangals()
returns table (id uuid, photo_path text)
language sql
stable
as $$
  select b.id, b.photo_path
  from badamangals b
  where b.event_date < (now() at time zone 'Asia/Kolkata')::date
     or b.hidden_at is not null;
$$;
```

Then change the SELECT in the handler to:

```ts
const { data: rows, error: selectError } = await admin.rpc("expiring_badamangals");
```

(and remove the `.or(...)` chain). Re-run the test — the fake admin's `from('badamangals').select().or()` mock will need to be updated to `rpc('expiring_badamangals')`.

Update the test mock — replace the relevant block:

```ts
function fakeAdmin(rows: { id: string; photo_path: string }[]) {
  const removed: string[] = [];
  const deletedIds: string[] = [];
  const cleaned: { count: number } = { count: 0 };

  const rpc = vi.fn().mockResolvedValue({ data: rows, error: null });

  return {
    removed,
    deletedIds,
    cleaned,
    rpc,
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
```

- [ ] **Step 4: Apply the migration**

Apply `20260506000006_expiring_fn.sql` to Supabase via SQL editor or `supabase db push`.

- [ ] **Step 5: Run the test (should pass)**

```bash
npm test -- tests/integration/api-cron-expire.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): cron/expire daily sweep with IST-aware Postgres function"
```

---

### Task 6.2: Vercel cron schedule

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/cron/expire",
      "schedule": "31 18 * * *"
    }
  ]
}
```

This fires daily at 18:31 UTC = 00:01 IST. Vercel attaches `Authorization: Bearer ${CRON_SECRET}` automatically when `CRON_SECRET` is set in env.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore(vercel): schedule daily cron at 00:01 IST"
```

---

### Task 6.3: Privacy page

**Files:**
- Create: `src/app/privacy/page.tsx`

- [ ] **Step 1: Implement**

```tsx
import MotifBand from "@/components/MotifBand";

export const metadata = {
  title: "Privacy · Bhandara",
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "0 1rem 4rem" }}>
      <h1>Privacy</h1>
      <MotifBand marginBlock="0.5rem 1.5rem" />

      <h2>What we collect</h2>
      <p>
        When you submit a Bhandara, we store: the location coordinates you provided, the event name, date, and time
        window, the photo you uploaded, the timestamp of submission, your device fingerprint (a string derived from
        browser characteristics), and your IP address. The fingerprint and IP are used only to enforce a rate limit of
        five submissions per hour and never displayed publicly.
      </p>

      <h2>Why we collect it</h2>
      <p>
        Coordinates, name, time, and photo are public on this site so people can find your event. Fingerprint and IP
        keep the platform fair by preventing abuse. We do not advertise, do not sell data, and do not use third-party
        analytics.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Each Bhandara — including its photo — is automatically deleted the day after its event date, at 00:01 IST.
        Reports are deleted when the listing they reference is deleted. Rate-limit records are deleted seven days
        after they are created.
      </p>

      <h2>Photo validation</h2>
      <p>
        Submitted photos are sent to Google's Gemini API for authenticity checks against reference imagery of
        bhandara events. Photos that fail validation are not stored. Approved photos are public on this site.
      </p>

      <h2>Contact</h2>
      <p>
        For questions or removal requests, reach out via the email address listed on the GitHub repository.
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Manual verification**

```bash
npm run dev
```

Open `/privacy` and confirm content renders cleanly.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(legal): privacy page"
```

---

## Phase 7 — Polish & deployment

### Task 7.1: Error and loading polish

**Files:**
- Modify: `src/app/find/FindClient.tsx` (loading + denied states)
- Modify: `src/app/post/PostForm.tsx` (validation hint copy)
- Modify: `src/app/find/ListView.tsx` (empty-state copy)

- [ ] **Step 1: Find — loading copy**

In `FindClient.tsx`, when `coord === null && !permissionDenied`, render a friendlier message instead of a blank list:

Above the list, add:

```tsx
{!coord && !permissionDenied && (
  <p style={{ textAlign: "center", color: "var(--ink-600)", marginTop: "1rem" }}>
    Looking up your location…
  </p>
)}
```

- [ ] **Step 2: Find — empty-state with radius hint**

In `ListView.tsx`, replace the existing empty-state with:

```tsx
if (items.length === 0) {
  return (
    <div style={{ textAlign: "center", color: "var(--ink-600)", marginTop: "2rem" }}>
      <p>No bhandaras found within this radius.</p>
      <p style={{ fontSize: "0.9rem" }}>Try expanding the search, or check back later 🪔</p>
    </div>
  );
}
```

- [ ] **Step 3: Post — submit-disabled hint**

In `PostForm.tsx`, just above the actions row, add:

```tsx
{!valid && !submitting && (
  <p style={{ color: "var(--ink-600)", fontSize: "0.85rem", marginTop: 8 }}>
    Fill all fields above (location, name, date, both times, and a photo) to submit.
  </p>
)}
```

- [ ] **Step 4: Run the dev server and click through each page**

```bash
npm run dev
```

Confirm each polished state shows correctly:
- `/find` before geolocation resolves: "Looking up your location…"
- `/find` with no results: empty-state copy
- `/post` with incomplete form: hint copy under the submit button

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "polish: empty states, loading copy, and form hints"
```

---

### Task 7.2: Run all tests one more time

**Files:** none

- [ ] **Step 1: Run the full suite**

```bash
npm test
```

Expected: every test passes. Read failures carefully — fix them rather than skip.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Fix any errors before continuing.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: clean production build. The build fails fast if env vars are missing — set them in `.env.local` if needed.

- [ ] **Step 4: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "chore: lint and build fixes"
```

---

### Task 7.3: Deployment checklist (manual)

**Files:** none — this is a runbook.

- [ ] **Step 1: Supabase setup verification**
  - All 6 migrations applied (extensions, tables, RLS, storage, nearby fn, expiring fn).
  - `badamangal-photos` bucket exists and is **public**.
  - `reference-images` bucket exists and is **private**.
  - `npm run upload:refs` ran successfully — three files in `reference-images`.
  - Auth → URL Configuration includes the production `/admin` URL.

- [ ] **Step 2: Vercel project setup**
  - Connect the GitHub repo or push directly via `vercel deploy`.
  - In Project Settings → Environment Variables (Production + Preview), set:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY`
    - `GEMINI_API_KEY`
    - `CRON_SECRET` (any 32+ char random string)
    - `ADMIN_EMAIL`
  - Verify the cron schedule appears in Project Settings → Crons (`/api/cron/expire`, daily 18:31 UTC).

- [ ] **Step 3: Smoke test on preview URL**
  - Open the preview URL on a phone (real device, not just devtools).
  - `/`: landing renders with motif and pillars.
  - `/find`: grant location, see (likely empty) list. Open Map view; OSM tiles render.
  - `/post`: detect location OR pin-drop; pick a photo (try a HEIC from camera roll on iPhone); submit. Verify success toast on `/find` and the new card.
  - From a different device/incognito, click `Report` on a card. Verify the Report dialog flow.
  - Sign in to `/admin` with the allowlisted email; verify the report appears; Hide it; verify it disappears from `/find`.

- [ ] **Step 4: Document the launch**

Append a one-line note to your project README or notes (no commit needed):

```
Deployed v1 to <vercel-url> on YYYY-MM-DD.
```

---

## Spec coverage matrix

| Spec section | Implemented in |
|---|---|
| §4 Architecture | Tasks 1.1, 1.4, 2.4 |
| §5 Data model | Task 1.4 |
| §6.1 Landing | Task 1.10 |
| §6.2 Find list view | Tasks 3.4–3.8 |
| §6.2 Find map view | Tasks 4.1–4.4 |
| §6.2 Get directions deep-link | Tasks 3.2, 3.5 |
| §6.2 Geolocation denial | Tasks 3.8, 4.4 |
| §6.3 Post form | Tasks 2.10–2.13, 4.5 |
| §6.4 Admin reports queue | Tasks 5.3–5.6 |
| §7 API contracts | Tasks 2.9, 3.4, 5.1, 5.4, 5.5, 6.1 |
| §8.1 Device fingerprinting | Task 2.3 |
| §8.2 Rate limit algorithm | Task 2.5 |
| §8.3 Gemini validation pipeline | Tasks 2.6–2.8 |
| §8.4 Daily expiry job | Tasks 6.1, 6.2 |
| §8.5 Privacy posture | Task 6.3 |
| §9 Aesthetic system | Tasks 1.6, 1.7, 1.8, 1.9 |
| §10 Operational concerns (env, secrets) | Tasks 1.3, 7.3 |
| §10 Operational concerns (reference images) | Task 1.5 |

All §3 non-goals stay out of scope.

---

## Open questions during execution

- **Reference image quality.** §10 of the spec calls out that the 3 reference images are dev placeholders. Replace them before launch (Task 1.5 is greenfield-friendly; uploading higher-quality references doesn't require a code change — re-run `npm run upload:refs` and redeploy to bust the in-memory cache).
- **Rubric tuning.** If false rejections climb, adjust the wording in `src/lib/gemini/rubric.ts` and redeploy. Treat the test in Task 2.7 as a regression net for the *structure* of the rubric (key terms present), not its exact wording.
- **`@google/genai` API surface.** The exact request/response shape can drift between SDK minor versions. If `validatePhoto` fails at runtime with a parser error, log the raw response shape, then update `src/lib/gemini/validator.ts` to match.
- **Marker clustering.** The spec mentions "pin clustering above 10 in view". The plan ships without a cluster plugin since v1 traffic is unlikely to hit that threshold per radius. If a city becomes dense, install `react-leaflet-cluster` and wrap the `<Marker>` list in `<MarkerClusterGroup>` inside `MapView.tsx`. No data-model changes required.

