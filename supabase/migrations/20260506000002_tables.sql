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
