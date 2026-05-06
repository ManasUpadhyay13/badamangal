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
