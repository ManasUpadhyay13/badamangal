# 🪔 Bhandara — Badamangal Locator

A community web app for finding and sharing **badamangal** events (charitable food distribution / bhandara / langar) across India. Anonymous, mobile-first, India-wide, IST throughout.

## What this repo is

A single Next.js 16 app with two public flows and one admin surface:

- **Find** (`/find`) — Grant browser geolocation, see nearby bhandaras as a list of cards with a 50 m – 5 km radius slider and a List/Map toggle. Each card carries a "Happening now" badge when current IST is inside the event window, a distance label, and a one-tap **Get directions** that deep-links into the Google Maps app on iOS/Android (and the web map on desktop). A **Report** button on each card lets users flag suspect listings.
- **Post** (`/post`) — Submit a bhandara: location (browser geolocation **or** map pin-drop), event name, event date (within the next 14 days, IST), start/end times, and an **optional** photo. If a photo is provided, it's run through OpenAI's vision API against three reference exemplars + a textual rubric; the row is only inserted on `is_authentic: true`. Without a photo, the submission goes straight in (rate-limit and report flows still apply). Five submissions per hour per device-fingerprint **or** IP; whichever hits 5 first blocks. HEIC/HEIF photos are converted to JPEG and downscaled to ≤1600 px on the long edge in the browser before upload.
- **Admin** (`/admin`) — Sign in by typing the email matching `ADMIN_EMAIL` (no password; HttpOnly cookie session, 7-day expiry). Lands on `/admin/listings` showing **every row** in the database — All / Reported / Hidden filter tabs — with **Hide** (reversible soft-delete), **Unhide**, **Dismiss reports** (clear report rows), and **Delete** (permanent: row + photo) actions per card. Reported rows are bumped to the top.

A daily Vercel Cron at **00:01 IST** sweeps every listing whose `event_date` has passed (or which has been `hidden_at`-marked) along with its photo from Storage, and trims the rate-limit ledger to the last 7 days. Listings have a maximum lifetime of 14 days from submission to event date plus 1 day of grace.

## Stack

- **Next.js 16** (App Router, React 19, TypeScript, Tailwind v4 + shadcn/ui)
- **Supabase** (Postgres + PostGIS for geospatial radius queries, Storage for photos)
- **OpenAI `gpt-4o-mini`** with vision + structured JSON output for photo authenticity
- **Leaflet + OpenStreetMap** for in-app maps; **Google Maps deep-link** for directions
- **`@fingerprintjs/fingerprintjs` v3** (open-source) + IP for rate limiting
- **`heic2any`** + `<canvas>` for client-side HEIC→JPEG conversion and downscaling
- **`date-fns` + `date-fns-tz`** pinned to `Asia/Kolkata` for IST math
- **Vitest + jsdom** for unit and integration tests
- **Vercel Cron** for the daily expiry job

The full design is in `docs/superpowers/specs/2026-05-06-badamangal-locator-design.md` and the implementation plan in `docs/superpowers/plans/2026-05-06-badamangal-locator.md` (with a `2026-05-07-shadcn-addendum.md` for the shadcn/ui adoption).

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── submit/             # POST: rate-limit → (optional) OpenAI validation → insert
│   │   ├── nearby/             # GET: PostGIS-radius query, returns photo public URLs
│   │   ├── report/             # POST: one report per device per listing
│   │   ├── cron/expire/        # POST: daily IST-midnight sweep (CRON_SECRET-gated)
│   │   └── admin/              # all auth-gated:
│   │       ├── login/          #   POST: email-match → set bhandara_admin cookie
│   │       ├── logout/         #   POST: clear cookie
│   │       ├── listings/       #   GET: every row + report counts + hidden status
│   │       ├── hide/           #   POST: set hidden_at
│   │       ├── unhide/         #   POST: clear hidden_at
│   │       ├── dismiss/        #   POST: delete reports for a listing
│   │       └── delete/         #   POST: hard-delete row + photo
│   ├── find/                   # FindClient + List/Map toggle (shadcn Tabs) + RadiusSlider
│   ├── post/                   # PostForm + LocationPicker (geo or pin-drop) + PhotoInput
│   ├── admin/                  # email-only LoginForm + listings page (filter, actions)
│   └── privacy/                # /privacy page
├── components/                 # MotifBand, PillarButton, Footer, ui/* (shadcn primitives)
└── lib/
    ├── env.ts                  # zod-validated server env (CRON_SECRET, ADMIN_EMAIL optional)
    ├── ist/                    # today_IST, isHappeningNowIST, deriveTimingLabel
    ├── geo/                    # formatDistance, directionsUrl, leaflet-icon (saffron pin)
    ├── photo/prepare.ts        # isHeic, computeTargetDims, prepareForUpload (HEIC + canvas)
    ├── fingerprint/            # useFingerprint hook with localStorage cache
    ├── rate-limit/             # checkAndRecordAttempt, markOutcome, deleteAttempt
    ├── vision/                 # openai client, validation rubric, reference-image cache
    ├── admin/auth.ts           # requireAdmin (cookie-based, no Supabase Auth)
    └── supabase/server.ts      # service-role client factory
supabase/migrations/            # 7 migrations: extensions → tables → RLS → storage →
                                #   nearby fn → expiring fn → optional photo
tests/
├── unit/                       # 8 unit test files (TDD logic: ist, geo, photo, rubric, …)
└── integration/                # 4 route-handler tests (submit, nearby, report, cron)
```

## Required env vars (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...           # server-only
OPENAI_API_KEY=sk-...                      # server-only; only needed when validating photos
ADMIN_EMAIL=you@example.com                # admin sign-in matches this exactly (case-insensitive)
CRON_SECRET=any-random-string-32-chars     # server-only; Vercel injects on cron requests
```

`CRON_SECRET` and `ADMIN_EMAIL` are optional at the schema level — the cron route returns `500 cron_not_configured` and `requireAdmin` returns `503` if either is missing. `OPENAI_API_KEY` is only consulted when a photo is actually being validated.

## Scripts

```bash
npm run dev          # next dev — http://localhost:3000
npm run build        # production build (typecheck + bundle)
npm run start        # serve production build
npm run lint         # eslint
npm run test         # vitest run
npm run test:watch   # vitest watch
npm run upload:refs  # upload public/reference-placeholders/ref-{1,2,3}.jpg
                     # to the private reference-images bucket
```

## Applying migrations

Two paths:

**Supabase Dashboard** (one-off, easiest): SQL Editor → New query → paste each file from `supabase/migrations/` **in filename order** → Run. Verify the three tables (`badamangals`, `reports`, `rate_limit_attempts`), the two storage buckets (`badamangal-photos` public, `reference-images` private), and the two SQL functions (`nearby_badamangals`, `expiring_badamangals`).

**Supabase CLI** (versioned, repeatable):

```bash
npx supabase login
npx supabase link --project-ref <YOUR_PROJECT_REF>
npx supabase db push
```

## Deploying to Vercel

1. Connect the GitHub repo (or `vercel deploy` from this directory).
2. Set all six env vars in **Settings → Environment Variables** for **Production** and **Preview**.
3. Vercel auto-detects `vercel.json` and registers the daily cron `/api/cron/expire` at `31 18 * * *` UTC (= 00:01 IST). With `CRON_SECRET` in env, Vercel attaches `Authorization: Bearer ${CRON_SECRET}` to scheduled requests.
4. After first deploy, verify in **Settings → Crons**.

## Smoke test (any deployed URL)

- `/` — landing renders with the chakra-wedge motif band and two pillar buttons.
- `/find` — grant location, see the list view, switch to Map, drag the radius slider; cards show photo (or 🪔 placeholder for text-only listings).
- `/post` — try a submission with **and without** a photo; verify success redirects to `/find` with the "Thanks for sharing 🪔" toast.
- Submit a listing without a photo → admin queue should show it with the diya placeholder; Delete it; verify it's gone.
- `/admin` → type `ADMIN_EMAIL` → land on `/admin/listings`; try the All/Reported/Hidden filter tabs; Hide → Unhide a row; Delete a row (confirmation dialog).

## Privacy

See `/privacy` on the deployed site. Short version: anonymous submissions; IP and device fingerprint stored only for rate limiting; photo (when provided) is sent to OpenAI for validation and only kept if it passes; every row is automatically deleted the day after its event date at 00:01 IST.

---

## Quickstart

For a fresh clone, end-to-end:

```bash
# Prereqs: Node 20, a Supabase project, an OpenAI API key.

git clone <this-repo> badamangal
cd badamangal

# 1. Install
nvm use 20            # or: nvm install 20 && nvm use 20
npm install

# 2. Configure
cp .env.example .env.local
# Edit .env.local. The minimum to run locally:
#   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#   SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, ADMIN_EMAIL.
# CRON_SECRET can be any random string for dev.

# 3. Apply migrations against your Supabase project
#    Either: paste each file in supabase/migrations/ into the SQL Editor in order.
#    Or:
npx supabase login
npx supabase link --project-ref <YOUR_PROJECT_REF>
npx supabase db push

# 4. (Optional but recommended) Upload three real bhandara reference images.
#    Drop them as ref-1.jpg / ref-2.jpg / ref-3.jpg under
#    public/reference-placeholders/ — these anchor the OpenAI validator.
npm run upload:refs

# 5. Run
npm run dev
# → http://localhost:3000
```

Verify it's wired up:

```bash
npm run test    # 47 tests should pass
npm run lint    # zero errors
npm run build   # production build succeeds
```
