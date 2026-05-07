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
