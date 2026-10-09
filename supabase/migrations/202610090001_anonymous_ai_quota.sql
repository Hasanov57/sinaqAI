create table if not exists public.ai_anonymous_rate_limits (
  visitor_hash text primary key check (visitor_hash ~ '^[0-9a-f]{64}$'),
  minute_started_at timestamptz not null default now(),
  minute_count integer not null default 0 check (minute_count >= 0),
  day_started_at date not null default current_date,
  day_count integer not null default 0 check (day_count >= 0)
);

alter table public.ai_anonymous_rate_limits enable row level security;
revoke all on public.ai_anonymous_rate_limits from public, anon, authenticated;
grant all on public.ai_anonymous_rate_limits to service_role;

create or replace function public.consume_ai_anonymous_quota(p_visitor_hash text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_visitor_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid visitor hash';
  end if;

  insert into public.ai_anonymous_rate_limits as limits
    (visitor_hash, minute_started_at, minute_count, day_started_at, day_count)
  values (p_visitor_hash, now(), 1, current_date, 1)
  on conflict (visitor_hash) do update
  set minute_started_at = case
        when limits.minute_started_at <= now() - interval '1 minute' then now()
        else limits.minute_started_at
      end,
      minute_count = case
        when limits.minute_started_at <= now() - interval '1 minute' then 1
        else limits.minute_count + 1
      end,
      day_started_at = current_date,
      day_count = case
        when limits.day_started_at <> current_date then 1
        else limits.day_count + 1
      end;

  return (
    select minute_count <= 8 and day_count <= 100
    from public.ai_anonymous_rate_limits
    where visitor_hash = p_visitor_hash
  );
end;
$$;

revoke all on function public.consume_ai_anonymous_quota(text) from public, anon, authenticated;
grant execute on function public.consume_ai_anonymous_quota(text) to service_role;
