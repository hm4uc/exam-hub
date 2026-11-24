-- Giới hạn tần suất dùng chung (cửa sổ cố định) cho các endpoint công khai: /api/trace, đăng nhập, tạo job nhập đề…
-- Chỉ service_role gọi được (qua supabaseAdmin ở server); anon/authenticated không đụng tới.

create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 1,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;   -- không có policy: chỉ service_role/postgres truy cập

-- true = còn trong hạn mức; false = vượt hạn mức trong cửa sổ hiện tại.
create or replace function public.rate_limit_hit(p_key text, p_window_seconds int, p_limit int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare h int;
begin
  if p_window_seconds < 1 or p_limit < 1 or length(coalesce(p_key, '')) not between 1 and 200 then
    raise exception 'BAD_RATE_LIMIT_ARGS' using errcode = 'P0001';
  end if;
  insert into public.rate_limits (key, window_start)
  values (p_key, date_bin(make_interval(secs => p_window_seconds), now(), timestamptz 'epoch'))
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into h;
  return h <= p_limit;
end $$;

revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

create or replace function public.purge_rate_limits() returns void
language sql security definer set search_path = '' as $$
  delete from public.rate_limits where window_start < now() - interval '2 hours'
$$;
revoke execute on function public.purge_rate_limits() from public, anon, authenticated;

select cron.schedule('purge-rate-limits', '*/15 * * * *', 'select public.purge_rate_limits()');
