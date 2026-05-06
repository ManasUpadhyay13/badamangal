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
