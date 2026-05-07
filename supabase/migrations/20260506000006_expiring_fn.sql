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
