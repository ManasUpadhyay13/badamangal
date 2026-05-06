# Badamangal Locator — Design Spec

**Date:** 2026-05-06
**Status:** Draft, pending user review
**Scope:** v1 of a public, anonymous, mobile-first web app for discovering and submitting badamangal (charitable food distribution) events across India. IST timezone throughout.

---

## 1. Summary

A two-pillar web app:

- **Find a Bhandara.** User grants browser geolocation, sees nearby events as cards (with a list↔map toggle), filters by a 50 m – 5 km radius slider, and gets a one-tap deep-link to Google Maps for navigation.
- **Post a Bhandara.** User submits a listing with location (geolocation or manual map pin), event name, event date (within the next 14 days), start/end times, and a mandatory photo. Photo is validated against a hybrid Gemini Vision rubric (3 reference images + textual rubric). Approved listings appear publicly. Rejected listings return a clear reason. Five submissions per hour per device or IP.

Each listing self-deletes the day after its event date (DB row + photo file). Reports route to a small admin queue gated by a single allowlisted email.

---

## 2. Goals

- A trustworthy, low-friction way for any user in India to find a bhandara within walking distance.
- Quality gate that keeps non-bhandara photos out of the public feed without requiring human review on the happy path.
- Cultural visual identity (saffron + ivory + deep gold + forest green; chakra-wedge motif) that feels devotional, not generic.
- Stay on free-tier infrastructure for early traffic.

## 3. Non-goals (v1)

- No user accounts. Public users are fully anonymous.
- No reverse geocoding on submit; raw lat/lng only.
- No multi-language UI toggle. Hinglish (English scaffolding + Hindi vocabulary in Roman script) is shipped as-is.
- No notifications, follows, or favorites.
- No event editing or deletion by submitter.
- No multi-day events; each submission is a single date with a single start/end window.
- No image cropping or filter UI.
- No analytics tooling, no PWA install prompt, no offline mode.
- No SEO/OG metadata polish beyond a basic title and description.

---

## 4. Architecture

```
Browser (mobile-first PWA-shape)
  └─ Next.js 15 App Router on Vercel ─────┐
       /             landing               │
       /find         list + map toggle    │
       /post         submission form      │
       /admin        reports queue        │
       /api/*        Route Handlers       │
                                          ▼
       ┌──────────────┐  ┌─────────────────┐  ┌────────────┐
       │ Supabase     │  │ Gemini 2.5 Flash│  │ Leaflet +  │
       │  Postgres    │  │ (Vision)        │  │ OSM tiles  │
       │  + PostGIS   │  │                 │  │ (client)   │
       │  + Storage   │  └─────────────────┘  └────────────┘
       └──────────────┘
       Vercel Cron @ 00:01 IST → /api/cron/expire
```

- **Runtime.** All Route Handlers run on the Node runtime (Edge runtime is incompatible with the current Gemini SDK and the Supabase service-role client).
- **Trust boundary.** Browser holds only the Supabase **anon** key + OSM tile access. All writes go through `/api/*` handlers using the Supabase **service-role** key on the server. Public RLS policies are write-deny + read-allow (read filtered to non-hidden rows).
- **Timezone.** IST (`Asia/Kolkata`) hardcoded. Postgres timezone set accordingly; app code uses `date-fns-tz` pinned to `Asia/Kolkata`.
- **Deployments.** Single Next.js project on Vercel, single Supabase project. No separate worker/queue infra.

---

## 5. Data model

```sql
-- Listings
create table badamangals (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(name) between 1 and 80),
  location            geography(Point, 4326) not null,
  start_time          time not null,
  end_time            time not null check (end_time > start_time),
  event_date          date not null,
  photo_path          text not null,         -- key inside the badamangal-photos bucket
  device_fingerprint  text not null,
  ip_address          inet not null,
  created_at          timestamptz default now(),
  hidden_at           timestamptz             -- admin soft-delete; cron sweeps this row
);
create index badamangals_location_gix on badamangals using gist (location);
create index badamangals_event_date_idx on badamangals (event_date);

-- Reports
create table reports (
  id                    uuid primary key default gen_random_uuid(),
  badamangal_id         uuid not null references badamangals(id) on delete cascade,
  reporter_fingerprint  text not null,
  reporter_ip           inet not null,
  reason                text,
  created_at            timestamptz default now(),
  unique (badamangal_id, reporter_fingerprint)
);
create index reports_badamangal_idx on reports (badamangal_id);

-- Rate limit ledger (5/hour per fingerprint OR IP)
create table rate_limit_attempts (
  id                  bigserial primary key,
  device_fingerprint  text not null,
  ip_address          inet not null,
  attempted_at        timestamptz default now(),
  outcome             text not null check (outcome in ('accepted', 'rejected_validation', 'rate_limited'))
);
create index rate_limit_attempts_fp_idx on rate_limit_attempts (device_fingerprint, attempted_at);
create index rate_limit_attempts_ip_idx on rate_limit_attempts (ip_address, attempted_at);
```

**Storage buckets:**
- `badamangal-photos` — public read, service-role-only writes. Files keyed by `<uuid>.<ext>`.
- `reference-images` — private, server-only. Holds the 3 chosen reference images.

**14-day window enforcement.** Validated in the `/api/submit` handler (not as a CHECK constraint, since `current_date` is not immutable in Postgres CHECK). The handler asserts `event_date >= today_IST AND event_date <= today_IST + interval '14 days'`.

---

## 6. User flows

### 6.1 Landing (`/`)

- Two pillar buttons: **Find a Bhandara**, **Post a Bhandara**.
- Single line of context copy underneath.
- Chakra-wedge motif band under the header.
- No location request on load; each pillar triggers its own permission prompt at the right step.

### 6.2 Find (`/find`)

- On mount: request browser geolocation; render a skeleton list while waiting.
- On grant: `GET /api/nearby?lat&lng&radius_m=500`.
- Sticky header: brand + motif + **List/Map** toggle (List default) + **Radius slider** (50 m – 5 km, default 500 m, debounced 300 ms re-fires the API call).
- **List view.** Stacked cards. Each card shows a 16:9 photo (lazy-loaded), name, time-range with a derived label (`Happening now` / `Starting at 6:00 PM` / `Tomorrow 5:00 PM`), distance ("420 m away"), `Get directions ↗` button, `Report` link.
- **Map view.** Full-bleed Leaflet+OSM, pin clustering above 10 in view. Tapping a pin opens a mini-card overlay with the same fields.
- **Geolocation denied.** Non-blocking banner with a manual-pin picker (drop-a-pin Leaflet view) so the user can still browse. Radius slider is disabled until coordinates exist.

**Get directions deep-link logic:**
- iOS detected → `comgooglemaps://?daddr=<lat>,<lng>&directionsmode=walking`, fall back to `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>` if Google Maps app not installed.
- Android detected → `geo:<lat>,<lng>?q=<lat>,<lng>(<name>)` intent, fall back to the same web URL.
- Desktop or unknown → web URL only.

### 6.3 Post (`/post`)

Single-page form, top-to-bottom:

1. **Location** — radio: `Use my location` (geolocation prompt) or `Pick on map` (Leaflet pin-drop). No reverse geocoding.
2. **Event name** — text, required, max 80 chars.
3. **Event date** — native date input, min `today_IST`, max `today_IST + 14`.
4. **Start time / End time** — two native time inputs, end > start.
5. **Photo** — file picker accepts `image/*,.heic,.heif`. On change: detect HEIC/HEIF, convert via `heic2any` to JPEG; downscale to ≤1600 px on the long edge using a canvas; show thumbnail preview.
6. **Submit** — disabled until all fields valid. Multipart `POST /api/submit`.

Three result states:
- **Success** — toast "Thanks for sharing 🪔" + redirect to `/find`.
- **Rejected by Gemini** — modal with the rubric reason and a `Try a different photo` action.
- **Rate-limited** — modal "You've reached the limit of 5 submissions per hour. Please try again at <time>."

### 6.4 Admin (`/admin`)

- Supabase Auth via magic link, restricted to a single allowlisted email (`ADMIN_EMAIL` env var).
- Lists badamangals where `report_count >= 1`, ordered by `report_count desc, latest_report_at desc`.
- Each row: photo thumbnail, name, location pin (small map), report count, list of report reasons.
- Two actions per row: `Hide` (sets `hidden_at`) and `Dismiss reports` (deletes the report rows; listing stays public).

---

## 7. API contracts

All `/api/*` handlers accept and return JSON unless noted. All handlers attach `X-Device-Fingerprint` from the request header to whatever they store.

### `POST /api/submit` — multipart
**Request:** multipart form with fields `name`, `lat`, `lng`, `event_date`, `start_time`, `end_time`, `photo` (file), and header `X-Device-Fingerprint`.
**Response:** `201 { id }` on success, `422 { reason }` on validation rejection, `429 { retry_after_seconds }` on rate-limit, `502 { error }` on Gemini timeout/5xx, `400 { errors }` on field validation.

### `GET /api/nearby?lat&lng&radius_m`
**Response:** `200 { items: [{ id, name, lat, lng, photo_url, start_time, end_time, event_date, distance_m, is_happening_now }] }`. Excludes rows with `hidden_at IS NOT NULL` and rows with `event_date < today_IST`.

### `POST /api/report`
**Request:** `{ badamangal_id, reason? }` + `X-Device-Fingerprint` header.
**Response:** `201 { ok: true }` or `409 { error: "already_reported" }` if the same fingerprint already reported the same listing.

### `POST /api/cron/expire` — Vercel Cron only
Protected by `Authorization: Bearer ${CRON_SECRET}` (Vercel injects this header). Performs the daily expiry sweep (see §8.4).

### `GET /api/admin/reports` and `POST /api/admin/{hide,dismiss}`
Auth-gated by Supabase session cookie + email allowlist.

---

## 8. Cross-cutting concerns

### 8.1 Device fingerprinting
- `@fingerprintjs/fingerprintjs` (open-source v3, MIT). Generates `visitorId` from canvas/audio/font signals.
- Cached in `localStorage` under `bhandara.fp`.
- Sent as `X-Device-Fingerprint` on submit and report.
- Treated as a *soft* signal; combined with IP for rate limiting (whichever hits 5 first blocks).

### 8.2 Rate limit algorithm
Sliding 60-minute window. On each `/api/submit`:

1. Insert a `rate_limit_attempts` row with `outcome='rate_limited'` placeholder, BEFORE running the validation (so abuse via repeated rejections still counts).
2. Count rows in the window: `count(*) where attempted_at > now() - interval '1 hour' and (device_fingerprint = $1 or ip_address = $2)`. (Note: count *includes* the row we just inserted.)
3. If count > 5 → respond 429, leave the row marked `rate_limited`.
4. Otherwise, proceed to Gemini validation; update the row's `outcome` to `accepted` or `rejected_validation` based on the result.
5. **Exception**: if the Gemini call itself fails (timeout / 5xx), DELETE the rate-limit row and respond 502. Don't penalize users for our infra failing.

### 8.3 Gemini validation pipeline
1. Server receives multipart upload, writes photo to `badamangal-photos/<uuid>.<ext>`.
2. Constructs a Gemini request with: the just-uploaded image as inline base64, 3 reference images (cached in memory at server cold-start, lazily fetched from `reference-images` bucket), and a fixed text rubric.
3. Calls `gemini-2.5-flash` with a structured response schema enforcing `{ is_authentic: boolean, confidence: "low"|"medium"|"high", reason: string }`.
4. Timeout: 15 seconds. Retries: zero (the user can manually retry).
5. On `is_authentic: true` → INSERT `badamangals` row, mark rate-limit attempt `accepted`, return 201.
6. On `is_authentic: false` → DELETE the just-uploaded photo from Storage, mark rate-limit attempt `rejected_validation`, return 422 with `reason`.

**Rubric template** (to be tuned with the actual reference images):
> "An authentic badamangal/bhandara setup typically shows: large communal cooking vessels (kadhai, deg, pateela); volunteers preparing or distributing food; rows of seated devotees being served on plates or banana leaves; saffron-clad organisers; temple, courtyard, pandal, or public-square setting; marigold garlands or other devotional decorations; visible food items like puri, sabzi, halwa, kheer, prasad. Reject: restaurants, weddings, generic crowd shots, food selfies, stock photos, screenshots."

### 8.4 Daily expiry job
- **Schedule:** `31 18 * * *` UTC = `00:01 IST` daily. (IST = UTC+5:30, no DST.)
- **Endpoint:** `POST /api/cron/expire`. Vercel automatically attaches `Authorization: Bearer ${CRON_SECRET}` to scheduled cron requests when `CRON_SECRET` is set in env; the handler must verify this header and reject anything else with 401.
- **Logic:**
  1. `select id, photo_path from badamangals where event_date < (now() at time zone 'Asia/Kolkata')::date or hidden_at is not null`.
  2. Bulk delete the photo paths from Storage in chunks of 100 (Supabase Storage `remove(paths[])` supports batch).
  3. `delete from badamangals where id = any($1)`.
  4. `delete from rate_limit_attempts where attempted_at < now() - interval '7 days'`.
  5. Log a one-line summary (counts) for observability.

### 8.5 Privacy posture
- IP and device fingerprint stored only for rate-limiting. Never returned in any public API response.
- `/api/nearby` returns only public fields (id, name, coords, photo_url, times, event_date).
- `/privacy` page documents what is collected, why, and the retention windows. Linked from the footer of every page.
- TLS via Vercel default. No additional encryption-at-rest config required (Supabase handles).

---

## 9. Aesthetic system

### Palette tokens (`:root` CSS custom properties)

```
--saffron-50   #fffbeb
--saffron-100  #fef3c7
--saffron-500  #ea580c
--saffron-700  #92400e
--gold-500     #ca8a04
--gold-700     #854d0e
--green-700    #166534
--green-900    #14532d
--ivory        #fffdf5
--ink-900      #3a1f0e
--ink-600      #6b3e00
```

### Typography
- `Inter` for UI (weights 400/500/700) — proven Hinglish/Roman support, free, Google Fonts.
- `Tiro Devanagari Hindi` reserved for any future Devanagari fragments (script fallback).

### Motif
- A single 8-px-tall **chakra-wedge band**: a CSS-rendered repeating background using a `conic-gradient` of `--gold-500` over `--saffron-50`.
- Used three places: under the page header, between major sections, and as a thin line at the top of cards.
- Reusable as `.motif-band`.

### Component primitives
- **Buttons.** Rounded `8px`. Primary uses `linear-gradient(135deg, var(--saffron-500), var(--saffron-700))`.
- **Cards.** `--saffron-100` border, `8px` radius, `0 1px 3px rgba(74, 37, 17, 0.08)` shadow.
- **Inputs.** Ivory background, `--saffron-100` border, focus ring in `--gold-500`.
- **Iconography.** `lucide-react`. Diya emoji `🪔` reserved for the brand mark only.

### Microcopy register
- Hinglish, warm, concise. Examples:
  - "Find a Bhandara near you"
  - "Share where Prasad is being served"
  - "Thanks for sharing 🪔"
  - "This photo doesn't look like a bhandara setup. Try a different photo."

---

## 10. Operational concerns

- **Reference images.** The 3 reference images are not yet on hand. The build will use 3 placeholders during development; they must be replaced with real authentic images before launch. They live in the private `reference-images` Storage bucket and are loaded once at server cold-start into an in-memory cache (TTL: process lifetime; redeploy to refresh).
- **Secrets.** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `CRON_SECRET`, `ADMIN_EMAIL`. Stored in Vercel env (Production + Preview).
- **Logging.** `console.log` only in v1; viewable in Vercel function logs. Add Plausible/PostHog post-launch if desired.
- **Backups.** Supabase free tier has daily PITR; no extra config.
- **Cost ceiling on free tier.** Vercel Hobby: 100 GB bandwidth + 100k function invocations/month. Supabase free: 500 MB DB + 1 GB Storage. Gemini Flash free tier: 1500 requests/day. All comfortably above MVP needs.

---

## 11. Open items / dependencies

- [ ] User to provide the 3 chosen reference images before launch.
- [ ] User to provide the admin email address for the moderation queue.
- [ ] User to set up: Vercel project, Supabase project, Gemini API key, custom domain (if any).
- [ ] Decide on "happening now" labelling for end_time-passed-but-event-date-is-today (currently: drops off the feed once `now > event_date_end_time` IST; verify this is desired vs. keeping until midnight).

---

## 12. Build phasing

Suggested order (the implementation plan will refine):

1. **Foundation.** Next.js project, Supabase project, schema migration, Storage buckets, palette tokens, motif band component.
2. **Submission path.** Form UI + HEIC conversion + downscale + multipart upload + Gemini validation server logic + rate limiting.
3. **Discovery path.** `/api/nearby` + Find list view.
4. **Map.** Leaflet integration + map toggle on Find + pin-drop on Post.
5. **Moderation.** Reports flow + admin page.
6. **Lifecycle.** Vercel Cron expiry endpoint + privacy page.
7. **Polish.** Empty states, loading skeletons, error UX, microcopy review.
