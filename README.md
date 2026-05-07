# 🪔 Bhandara — Badamangal Locator

A community web app for discovering and submitting badamangal (charitable food distribution) events across India. Anonymous, mobile-first, India-wide, IST-throughout. Photos validated by OpenAI vision before being made public.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4 + shadcn/ui)
- **Supabase** (Postgres + PostGIS for geospatial, Storage for photos, Auth for admin)
- **OpenAI GPT-4o-mini (Vision)** for photo authenticity validation
- **Leaflet + OpenStreetMap** for in-app maps; Google Maps deep-link for navigation
- **Vitest** for tests; **Vercel Cron** for daily expiry

See `docs/superpowers/specs/2026-05-06-badamangal-locator-design.md` for the full design and `docs/superpowers/plans/2026-05-06-badamangal-locator.md` for the build plan.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in real values (see below)
npm run dev                  # http://localhost:3000
```

### Required env vars (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # server-only
OPENAI_API_KEY=sk-...           # server-only
CRON_SECRET=any-32-char-string  # server-only; Vercel injects on cron calls
ADMIN_EMAIL=you@example.com     # the single allowlisted admin email
```

## Scripts

```bash
npm run dev          # dev server
npm run build        # production build (verifies type + bundling)
npm run start        # serve production build
npm run lint         # eslint
npm run test         # vitest run
npm run test:watch   # vitest watch
npm run upload:refs  # upload public/reference-placeholders/* to Supabase
```

## Deploying

### 1. Provision Supabase

1. Create a new Supabase project.
2. In the SQL editor, run each migration file in `supabase/migrations/` in order.
3. Verify in **Table editor**: `badamangals`, `reports`, `rate_limit_attempts` exist.
4. Verify in **Storage**: `badamangal-photos` bucket is **public** and `reference-images` is **private**.
5. (Auth URL Configuration is no longer needed — admin sign-in matches the email entered against `ADMIN_EMAIL` and sets an HttpOnly cookie. Supabase Auth is not used.)

### 2. Provide reference images

Place three real bhandara photos as `ref-1.jpg`, `ref-2.jpg`, `ref-3.jpg` inside `public/reference-placeholders/`, then:

```bash
npm run upload:refs
```

These three photos are sent to OpenAI alongside every submission as visual exemplars of "authentic". You can swap them later by replacing the files and re-running the upload (and redeploying, since the cache is process-lifetime).

### 3. Deploy on Vercel

1. Connect the GitHub repo (or `vercel deploy`).
2. In **Settings → Environment Variables**, set all 6 env vars above for **Production** and **Preview**.
3. Vercel auto-detects `vercel.json` and registers the daily cron `/api/cron/expire` at `31 18 * * *` UTC (= 00:01 IST). When `CRON_SECRET` is in env, Vercel attaches `Authorization: Bearer ...` to scheduled requests.
4. After first deploy, verify in **Settings → Crons** that the schedule is registered.

### 4. Smoke test

On the production URL (or a Preview):

- `/` — landing renders with motif and pillars
- `/find` — geolocation prompt → list view → switch to Map
- `/post` — fill form, upload a real bhandara photo, submit — should land back on `/find` with success toast
- Click `Report` on any card → fill reason → submit → 201
- `/admin` — type `ADMIN_EMAIL` and sign in (no password; the email itself is the secret); land on `/admin/reports`; verify the reported listing appears; `Hide` it; verify it disappears from `/find`

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── submit/         # POST: rate-limit + OpenAI validation + insert
│   │   ├── nearby/         # GET: PostGIS-radius query
│   │   ├── report/         # POST: 1 report per device per listing
│   │   ├── cron/expire/    # daily IST-midnight sweep
│   │   └── admin/          # auth-gated reports / hide / dismiss
│   ├── find/               # list + map toggle, radius slider
│   ├── post/               # form + HEIC convert + downscale
│   ├── admin/              # magic-link auth + reports queue
│   └── privacy/
├── components/             # MotifBand, PillarButton, Footer, ui/* (shadcn)
└── lib/
    ├── env.ts              # zod-validated env loaders
    ├── ist/                # IST date/time + happening-now logic
    ├── geo/                # distance, deep-link, leaflet-icon
    ├── photo/              # HEIC convert + downscale
    ├── fingerprint/        # client visitorId hook
    ├── rate-limit/         # sliding-window check + ledger
    ├── vision/             # OpenAI client, rubric, validator, reference cache
    ├── admin/              # requireAdmin gate
    └── supabase/           # server (service-role) + browser (anon) clients
supabase/migrations/        # extensions, tables, RLS, storage, nearby fn, expiring fn
tests/
├── unit/                   # 9 unit test files
└── integration/            # 4 API route handler tests
```

## Privacy

See `/privacy` page on the deployed site. TL;DR: anonymous submissions, IP and device fingerprint stored only for rate limiting, listings auto-delete the day after their event date.
