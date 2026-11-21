-- Linh hoạt giao bài (không bắt buộc lớp, link tạo nhanh, đóng mở tự do),
-- cho phép học sinh làm bài không cần đăng nhập (guest_key + guest_name),
-- bổ sung vai trò admin và bảng trace_events theo dõi sự cố toàn hệ thống.

-- ============================================================ 1. Vai trò admin

do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%teacher%' and pg_get_constraintdef(oid) like '%student%'
  loop
    execute format('alter table public.profiles drop constraint %I', c);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'teacher', 'student'));

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and not is_locked)
$$;

create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin') and not is_locked)
$$;

-- ============================================================ 2. Bài giao linh hoạt (assignments)

alter table public.assignments alter column class_id drop not null;
alter table public.assignments drop constraint if exists assignments_class_id_fkey;
alter table public.assignments
  add constraint assignments_class_id_fkey
  foreign key (class_id) references public.classes(id) on delete set null;

alter table public.assignments alter column closes_at drop not null;

do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.assignments'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%closes_at%' and pg_get_constraintdef(oid) like '%opens_at%'
  loop
    execute format('alter table public.assignments drop constraint %I', c);
  end loop;
end $$;

alter table public.assignments
  add constraint assignments_closes_after_opens_check check (closes_at is null or closes_at > opens_at);

alter table public.assignments
  add column if not exists restrict_to_class boolean not null default false;

alter table public.assignments
  add column if not exists is_quick_link boolean not null default false;

-- ============================================================ 3. Bài làm hỗ trợ khách không đăng nhập (attempts)

alter table public.attempts alter column student_id drop not null;
alter table public.attempts add column if not exists guest_name text;
alter table public.attempts add column if not exists guest_key text;

alter table public.attempts drop constraint if exists attempts_assignment_id_student_id_attempt_no_key;
alter table public.attempts drop constraint if exists attempts_actor_check;
alter table public.attempts
  add constraint attempts_actor_check
  check (student_id is not null or (guest_key is not null and length(trim(guest_key)) between 8 and 120));

create unique index if not exists attempts_assignment_student_no_key
  on public.attempts (assignment_id, student_id, attempt_no) where student_id is not null;

create unique index if not exists attempts_assignment_guest_no_key
  on public.attempts (assignment_id, guest_key, attempt_no) where student_id is null;

create index if not exists attempts_guest_key_idx
  on public.attempts (guest_key) where guest_key is not null;

-- ============================================================ 4. Bảng theo dõi sự cố & thao tác (trace_events)

create table if not exists public.trace_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  level text not null default 'info' check (level in ('info', 'warn', 'error')),
  category text not null check (category in ('auth', 'exam', 'nav', 'error', 'network', 'admin')),
  event text not null check (length(trim(event)) between 1 and 80),
  message text,
  path text,
  user_id uuid references public.profiles on delete set null,
  username text,
  guest_key text,
  attempt_id uuid,
  assignment_code text,
  session_id text,
  meta jsonb not null default '{}',
  user_agent text
);

create index if not exists trace_events_created_at_idx on public.trace_events (created_at desc);
create index if not exists trace_events_level_created_idx on public.trace_events (level, created_at desc);
create index if not exists trace_events_user_idx on public.trace_events (user_id, created_at desc) where user_id is not null;
create index if not exists trace_events_attempt_idx on public.trace_events (attempt_id, created_at desc) where attempt_id is not null;
create index if not exists trace_events_code_idx on public.trace_events (assignment_code, created_at desc) where assignment_code is not null;
create index if not exists trace_events_session_idx on public.trace_events (session_id, created_at desc) where session_id is not null;

alter table public.trace_events enable row level security;
drop policy if exists admin_all on public.trace_events;
create policy admin_all on public.trace_events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.purge_old_traces(p_days int default 30) returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0;
begin
  if current_setting('role', true) in ('anon', 'authenticated') and not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  delete from public.trace_events where created_at < now() - make_interval(days => greatest(p_days, 1));
  get diagnostics n = row_count;
  return n;
end $$;

select cron.schedule('purge-old-traces', '0 3 * * *', 'select public.purge_old_traces(30)');

-- ============================================================ 5. Cập nhật các RPC làm bài (hỗ trợ cả khách và học sinh)

create or replace function public.assignment_state(a public.assignments, used int, in_progress boolean) returns text
language sql stable set search_path = '' as $$
  select case
    when in_progress then 'in_progress'
    when now() < a.opens_at then 'upcoming'
    when a.closes_at is not null and now() >= a.closes_at then 'closed'
    when used >= a.max_attempts then 'no_attempts_left'
    else 'open' end
$$;

-- Xoá chữ ký cũ trước khi tạo chữ ký mới có tham số tuỳ chọn p_guest_key / p_guest_name
drop function if exists public.assignment_info(text);
drop function if exists public.start_attempt(text, text);
drop function if exists public.save_answers(uuid, jsonb, int);
drop function if exists public.attempt_result(uuid);
drop function if exists public.submit_attempt(uuid);

create or replace function public.assignment_info(p_code text, p_guest_key text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  a public.assignments;
  gkey text := nullif(trim(coalesce(p_guest_key, '')), '');
  used int := 0;
  cur public.attempts;
  last public.attempts;
  nq int;
  login_req boolean := false;
  vrole text := 'guest';
begin
  select * into a from public.assignments where code = lower(p_code);
  if a.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;

  if auth.uid() is not null then
    select * into me from public.profiles where id = auth.uid();
    if me.id is not null then
      if me.is_locked then raise exception 'ACCOUNT_LOCKED' using errcode = 'P0001'; end if;
      vrole := me.role;
    end if;
  end if;

  if vrole = 'student' then
    if a.class_id is not null and a.restrict_to_class and me.class_id is not null and me.class_id <> a.class_id then
      raise exception 'WRONG_CLASS' using errcode = 'P0001';
    end if;
    select count(*) into used from public.attempts where assignment_id = a.id and student_id = me.id;
    select * into cur from public.attempts
      where assignment_id = a.id and student_id = me.id and submitted_at is null and deadline_at + interval '30 seconds' > now()
      order by attempt_no desc limit 1;
    select * into last from public.attempts
      where assignment_id = a.id and student_id = me.id and submitted_at is not null
      order by attempt_no desc limit 1;
  elsif vrole = 'guest' then
    login_req := (a.class_id is not null and a.restrict_to_class);
    if not login_req and gkey is not null then
      select count(*) into used from public.attempts where assignment_id = a.id and student_id is null and guest_key = gkey;
      select * into cur from public.attempts
        where assignment_id = a.id and student_id is null and guest_key = gkey and submitted_at is null and deadline_at + interval '30 seconds' > now()
        order by attempt_no desc limit 1;
      select * into last from public.attempts
        where assignment_id = a.id and student_id is null and guest_key = gkey and submitted_at is not null
        order by attempt_no desc limit 1;
    end if;
  end if;

  select count(*) into nq from public.questions q where q.exam_id = a.exam_id;

  return jsonb_build_object(
    'id', a.id,
    'code', a.code,
    'title', a.title,
    'class_name', (select name from public.classes where id = a.class_id),
    'restrict_to_class', a.restrict_to_class,
    'login_required', login_req,
    'viewer_role', vrole,
    'opens_at', a.opens_at,
    'closes_at', a.closes_at,
    'duration_minutes', a.duration_minutes,
    'max_attempts', a.max_attempts,
    'used_attempts', used,
    'question_count', nq,
    'has_password', a.access_password is not null and a.access_password <> '',
    'state', public.assignment_state(a, used, cur.id is not null),
    'last_attempt_id', last.id,
    'guest_name', coalesce(cur.guest_name, last.guest_name),
    'server_now', now()
  );
end $$;

create or replace function public.start_attempt(
  p_code text,
  p_password text default null,
  p_guest_key text default null,
  p_guest_name text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  a public.assignments;
  at public.attempts;
  gkey text := nullif(trim(coalesce(p_guest_key, '')), '');
  gname text := nullif(left(trim(coalesce(p_guest_name, '')), 80), '');
  is_guest boolean := (auth.uid() is null);
  used int;
  next_no int;
  gnum int;
  qorder uuid[];
  corders jsonb := '{}';
  q record;
  dl timestamptz;
begin
  select * into a from public.assignments where code = lower(p_code);
  if a.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;

  if not is_guest then
    me := public.current_student();
    if a.class_id is not null then
      if me.class_id is null then
        update public.profiles set class_id = a.class_id where id = me.id;
      elsif a.restrict_to_class and me.class_id <> a.class_id then
        raise exception 'WRONG_CLASS' using errcode = 'P0001';
      end if;
    end if;

    select * into at from public.attempts
      where assignment_id = a.id and student_id = me.id and submitted_at is null and deadline_at + interval '30 seconds' > now()
      order by attempt_no desc limit 1;
  else
    if a.class_id is not null and a.restrict_to_class then
      raise exception 'LOGIN_REQUIRED' using errcode = 'P0001';
    end if;
    if gkey is null or length(gkey) < 8 or length(gkey) > 120 then
      raise exception 'BAD_INPUT' using errcode = 'P0001';
    end if;

    select * into at from public.attempts
      where assignment_id = a.id and student_id is null and guest_key = gkey and submitted_at is null and deadline_at + interval '30 seconds' > now()
      order by attempt_no desc limit 1;
  end if;

  if at.id is null then
    if now() < a.opens_at then raise exception 'NOT_OPEN' using errcode = 'P0001'; end if;
    if a.closes_at is not null and now() >= a.closes_at then raise exception 'CLOSED' using errcode = 'P0001'; end if;

    if not is_guest then
      select count(*) into used from public.attempts where assignment_id = a.id and student_id = me.id;
      if used >= a.max_attempts then raise exception 'NO_ATTEMPTS_LEFT' using errcode = 'P0001'; end if;
      select coalesce(max(attempt_no), 0) + 1 into next_no from public.attempts where assignment_id = a.id and student_id = me.id;
    else
      select count(*) into used from public.attempts where assignment_id = a.id and student_id is null and guest_key = gkey;
      if used >= a.max_attempts then raise exception 'NO_ATTEMPTS_LEFT' using errcode = 'P0001'; end if;
      select coalesce(max(attempt_no), 0) + 1 into next_no from public.attempts where assignment_id = a.id and student_id is null and guest_key = gkey;
    end if;

    if coalesce(a.access_password, '') <> '' and coalesce(p_password, '') <> a.access_password then
      raise exception 'WRONG_PASSWORD' using errcode = 'P0001';
    end if;

    select array_agg(id order by part_min, case when a.shuffle_questions then random() else position::float8 end) into qorder
    from (select id, position, min(position) over (partition by coalesce(part, '')) as part_min
          from public.questions where exam_id = a.exam_id) s;
    if qorder is null then raise exception 'EMPTY_EXAM' using errcode = 'P0001'; end if;

    if a.shuffle_choices then
      for q in select id, jsonb_array_length(choices) n from public.questions where exam_id = a.exam_id and type = 'mcq' loop
        corders := corders || jsonb_build_object(q.id::text,
          (select jsonb_agg(i order by random()) from generate_series(0, q.n - 1) i));
      end loop;
    end if;

    if is_guest and gname is null then
      select guest_name into gname from public.attempts
        where assignment_id = a.id and student_id is null and guest_key = gkey and guest_name is not null
        order by attempt_no desc limit 1;
      if gname is null then
        perform 1 from public.assignments where id = a.id for update;
        select count(distinct guest_key) + 1 into gnum from public.attempts where assignment_id = a.id and student_id is null;
        gname := 'Học sinh #' || gnum;
      end if;
    end if;

    dl := case
      when a.closes_at is null then now() + make_interval(mins => a.duration_minutes)
      else least(now() + make_interval(mins => a.duration_minutes), a.closes_at)
    end;

    insert into public.attempts (assignment_id, student_id, guest_key, guest_name, attempt_no, deadline_at, question_order, choice_orders)
    values (a.id, case when is_guest then null else me.id end, case when is_guest then gkey else null end, case when is_guest then gname else null end, next_no, dl, qorder, corders)
    returning * into at;
  end if;

  return jsonb_build_object(
    'attempt_id', at.id,
    'title', a.title,
    'deadline_at', at.deadline_at,
    'server_now', now(),
    'answers', at.answers,
    'tab_leaves', at.tab_leaves,
    'guest_name', at.guest_name,
    'questions', public.attempt_questions(at)
  );
end $$;

create or replace function public.save_answers(
  p_attempt uuid,
  p_answers jsonb,
  p_tab_leaves int default 0,
  p_guest_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  at public.attempts;
  gkey text := nullif(trim(coalesce(p_guest_key, '')), '');
begin
  if auth.uid() is not null then
    me := public.current_student();
    select * into at from public.attempts where id = p_attempt and student_id = me.id for update;
  else
    if gkey is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
    select * into at from public.attempts where id = p_attempt and student_id is null and guest_key = gkey for update;
  end if;

  if at.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if at.submitted_at is not null then raise exception 'ALREADY_SUBMITTED' using errcode = 'P0001'; end if;
  if now() > at.deadline_at + interval '30 seconds' then raise exception 'TIME_UP' using errcode = 'P0001'; end if;
  if jsonb_typeof(coalesce(p_answers, '{}')) <> 'object' then raise exception 'BAD_INPUT' using errcode = 'P0001'; end if;

  update public.attempts set
    answers = answers || (select coalesce(jsonb_object_agg(k, v), '{}') from jsonb_each(coalesce(p_answers, '{}')) e(k, v)
                          where k::uuid = any (at.question_order)),
    tab_leaves = greatest(tab_leaves, coalesce(p_tab_leaves, 0)),
    last_seen_at = now()
  where id = at.id;

  return jsonb_build_object('saved_at', now());
end $$;

create or replace function public.attempt_result(p_attempt uuid, p_guest_key text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  at public.attempts;
  a public.assignments;
  gkey text := nullif(trim(coalesce(p_guest_key, '')), '');
  visible boolean;
  res jsonb;
begin
  if auth.uid() is not null then
    me := public.current_student();
    select * into at from public.attempts where id = p_attempt and student_id = me.id;
  else
    if gkey is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
    select * into at from public.attempts where id = p_attempt and student_id is null and guest_key = gkey;
  end if;

  if at.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  select * into a from public.assignments where id = at.assignment_id;
  if at.submitted_at is null then raise exception 'NOT_SUBMITTED' using errcode = 'P0001'; end if;

  visible := a.result_mode <> 'none' and (a.result_release = 'on_submit' or (a.closes_at is not null and now() >= a.closes_at));
  res := jsonb_build_object(
    'attempt_id', at.id,
    'title', a.title,
    'code', a.code,
    'submitted_at', at.submitted_at,
    'tab_leaves', at.tab_leaves,
    'result_mode', a.result_mode,
    'visible', visible,
    'release_at', a.closes_at,
    'guest_name', at.guest_name,
    'is_guest', at.student_id is null
  );
  if not visible then return res; end if;

  res := res || jsonb_build_object('score', at.score, 'score_raw', at.score_raw, 'score_max', at.score_max);
  if a.result_mode = 'score_answers' then
    res := res || jsonb_build_object('per_question', at.per_question, 'answers', at.answers,
      'questions', (select jsonb_agg(x.j || jsonb_build_object('answer', q.answer, 'solution_html', q.solution_html) order by x.ord)
                    from jsonb_array_elements(public.attempt_questions(at)) with ordinality x(j, ord)
                    join public.questions q on q.id = (x.j ->> 'id')::uuid));
  end if;
  return res;
end $$;

create or replace function public.submit_attempt(p_attempt uuid, p_guest_key text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  at public.attempts;
  gkey text := nullif(trim(coalesce(p_guest_key, '')), '');
begin
  if auth.uid() is not null then
    me := public.current_student();
    select * into at from public.attempts where id = p_attempt and student_id = me.id for update;
  else
    if gkey is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
    select * into at from public.attempts where id = p_attempt and student_id is null and guest_key = gkey for update;
  end if;

  if at.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if at.submitted_at is null then
    update public.attempts set submitted_at = least(now(), deadline_at + interval '30 seconds') where id = at.id;
    perform public.grade_attempt(at.id);
  end if;
  return public.attempt_result(at.id, gkey);
end $$;

-- Trang chủ học sinh: Bài giao của lớp mình + các bài mở mình đã từng làm.
create or replace function public.my_assignments() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := public.current_student();
  return jsonb_build_object(
    'class_name', (select name from public.classes where id = me.class_id),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', a.code,
        'title', a.title,
        'opens_at', a.opens_at,
        'closes_at', a.closes_at,
        'duration_minutes', a.duration_minutes,
        'state', public.assignment_state(a, s.used, s.in_progress),
        'best_score', case when a.result_mode <> 'none' and (a.result_release = 'on_submit' or (a.closes_at is not null and now() >= a.closes_at)) then s.best end,
        'last_attempt_id', s.last_id
      ) order by a.opens_at desc)
      from public.assignments a
      cross join lateral (
        select count(*)::int as used,
               coalesce(bool_or(t.submitted_at is null and t.deadline_at + interval '30 seconds' > now()), false) as in_progress,
               max(t.score) as best,
               (array_agg(t.id order by t.attempt_no desc) filter (where t.submitted_at is not null))[1] as last_id
        from public.attempts t where t.assignment_id = a.id and t.student_id = me.id) s
      where (me.class_id is not null and a.class_id = me.class_id)
         or s.used > 0), '[]'));
end $$;

-- ============================================================ 6. Quyền gọi RPC

revoke execute on function
  public.is_admin(),
  public.purge_old_traces(int),
  public.assignment_info(text, text),
  public.start_attempt(text, text, text, text),
  public.save_answers(uuid, jsonb, int, text),
  public.attempt_result(uuid, text),
  public.submit_attempt(uuid, text)
from public, anon, authenticated;

grant execute on function
  public.assignment_info(text, text),
  public.start_attempt(text, text, text, text),
  public.save_answers(uuid, jsonb, int, text),
  public.attempt_result(uuid, text),
  public.submit_attempt(uuid, text)
to anon, authenticated;

grant execute on function
  public.is_admin(),
  public.purge_old_traces(int)
to authenticated;
