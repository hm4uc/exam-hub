-- Exam Hub: schema, RLS, RPC làm bài, chấm điểm.
-- Thuật ngữ: Lớp (classes), Học sinh (profiles role=student), Đề thi (exams), Câu hỏi (questions),
-- Bài giao (assignments), Bài làm (attempts). Xem CONTEXT.md.

create extension if not exists pg_cron with schema pg_catalog;

-- ============================================================ bảng

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  school_year text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (name, school_year)
);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'student' check (role in ('teacher', 'student')),
  username text not null check (username ~ '^[a-z0-9._]{3,30}$'),
  full_name text not null check (length(trim(full_name)) between 1 and 80),
  class_id uuid references public.classes on delete set null,
  is_locked boolean not null default false,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index profiles_username_key on public.profiles (lower(username));
create index profiles_class_id_idx on public.profiles (class_id);

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 200),
  source_path text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  scoring jsonb not null default '{"mcq":0.25,"tf":1,"short":0.5,"scale10":true}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams on delete cascade,
  position int not null,
  part text,
  type text not null check (type in ('mcq', 'tf', 'short')),
  stem text not null,
  stem_html text not null,
  choices jsonb not null default '[]',      -- [{label, text, html}]
  answer jsonb not null,                    -- mcq "B" | tf "ĐSĐS" | short ["0,33","0,3"]
  solution text,
  solution_html text,
  points numeric check (points is null or points >= 0),
  unique (exam_id, position) deferrable initially deferred
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  exam_id uuid not null references public.exams on delete restrict,
  class_id uuid not null references public.classes on delete restrict,
  title text not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  duration_minutes int not null check (duration_minutes between 1 and 600),
  max_attempts int not null default 1 check (max_attempts between 1 and 20),
  shuffle_questions boolean not null default true,
  shuffle_choices boolean not null default true,
  access_password text,
  result_mode text not null default 'score' check (result_mode in ('none', 'score', 'score_answers')),
  result_release text not null default 'on_submit' check (result_release in ('on_submit', 'after_close')),
  created_at timestamptz not null default now(),
  check (closes_at > opens_at)
);
create index assignments_class_id_idx on public.assignments (class_id);
create index assignments_exam_id_idx on public.assignments (exam_id);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments on delete cascade,
  student_id uuid not null references public.profiles on delete cascade,
  attempt_no int not null,
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  question_order uuid[] not null,
  choice_orders jsonb not null default '{}',
  answers jsonb not null default '{}',
  tab_leaves int not null default 0,
  last_seen_at timestamptz,
  score_raw numeric,
  score_max numeric,
  score numeric(6, 2),
  per_question jsonb,
  unique (assignment_id, student_id, attempt_no)
);
create index attempts_student_id_idx on public.attempts (student_id);
create index attempts_open_deadline_idx on public.attempts (deadline_at) where submitted_at is null;

-- ============================================================ tiện ích

create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher' and not is_locked)
$$;

-- Học sinh đang đăng nhập (không khoá). Ném lỗi nếu không phải.
create or replace function public.current_student() returns public.profiles
language plpgsql stable security definer set search_path = '' as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then raise exception 'NOT_SIGNED_IN' using errcode = 'P0001'; end if;
  if p.is_locked then raise exception 'ACCOUNT_LOCKED' using errcode = 'P0001'; end if;
  if p.role <> 'student' then raise exception 'NOT_STUDENT' using errcode = 'P0001'; end if;
  return p;
end $$;

create or replace function public.gen_assignment_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.assignments where code = c);
  end loop;
  return c;
end $$;
alter table public.assignments alter column code set default public.gen_assignment_code();

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger exams_touch before update on public.exams for each row execute function public.touch_updated_at();

-- Tạo profile khi có user mới. Vai trò luôn là student; giáo viên được nâng quyền bằng script (service role).
-- Đăng ký công khai bị tắt trong cấu hình Auth: chỉ Server Action (service role) tạo user.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, role, username, full_name, class_id)
  values (
    new.id, 'student',
    lower(new.raw_user_meta_data ->> 'username'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), new.raw_user_meta_data ->> 'username'),
    nullif(new.raw_user_meta_data ->> 'class_id', '')::uuid
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ============================================================ chấm điểm

-- "0,5" / "0.5" / "-2,5" → numeric; không phải số → null
create or replace function public.norm_num(t text) returns numeric
language sql immutable set search_path = '' as $$
  select case when replace(trim(t), ',', '.') ~ '^-?[0-9]*\.?[0-9]+$' then replace(trim(t), ',', '.')::numeric end
$$;

-- Điểm một câu: trả (điểm đạt, điểm tối đa)
create or replace function public.grade_question(q public.questions, scoring jsonb, given jsonb, out pts numeric, out max_pts numeric)
language plpgsql immutable set search_path = '' as $$
declare k int := 0; g text; a text;
begin
  max_pts := coalesce(q.points, (scoring ->> q.type)::numeric, 0);
  pts := 0;
  if given is null or given = 'null'::jsonb then return; end if;
  if q.type = 'mcq' then
    if given #>> '{}' = q.answer #>> '{}' then pts := max_pts; end if;
  elsif q.type = 'tf' then
    g := given #>> '{}'; a := q.answer #>> '{}';
    for i in 1..4 loop
      if substr(g, i, 1) = substr(a, i, 1) then k := k + 1; end if;
    end loop;
    pts := max_pts * case k when 1 then 0.1 when 2 then 0.25 when 3 then 0.5 when 4 then 1 else 0 end;
  else
    if public.norm_num(given #>> '{}') is not null and exists (
      select 1 from jsonb_array_elements_text(q.answer) x where public.norm_num(x) = public.norm_num(given #>> '{}')
    ) then pts := max_pts; end if;
  end if;
end $$;

create or replace function public.grade_attempt(p_attempt uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  at public.attempts; sc jsonb; q public.questions;
  r record; raw numeric := 0; mx numeric := 0; per jsonb := '{}';
begin
  select * into at from public.attempts where id = p_attempt;
  select e.scoring into sc from public.assignments a join public.exams e on e.id = a.exam_id where a.id = at.assignment_id;
  for q in select qq.* from public.questions qq join public.assignments a on a.exam_id = qq.exam_id where a.id = at.assignment_id loop
    select * into r from public.grade_question(q, sc, at.answers -> q.id::text);
    raw := raw + r.pts; mx := mx + r.max_pts;
    per := per || jsonb_build_object(q.id::text, jsonb_build_object(
      'pts', r.pts, 'max', r.max_pts,
      'result', case when r.max_pts > 0 and r.pts >= r.max_pts then 'right' when r.pts > 0 then 'part' else 'wrong' end));
  end loop;
  update public.attempts set
    score_raw = raw, score_max = mx, per_question = per,
    score = case when coalesce((sc ->> 'scale10')::boolean, true) then
              case when mx > 0 then round(raw / mx * 10, 2) else 0 end
            else round(raw, 2) end
  where id = p_attempt;
end $$;

-- Chấm lại mọi Bài làm đã nộp của một Đề thi. Trả số bài.
create or replace function public.regrade_exam(p_exam uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0; aid uuid;
begin
  if not public.is_teacher() and current_user not in ('postgres', 'service_role') then raise exception 'FORBIDDEN'; end if;
  for aid in select t.id from public.attempts t join public.assignments a on a.id = t.assignment_id
             where a.exam_id = p_exam and t.submitted_at is not null loop
    perform public.grade_attempt(aid); n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.on_answer_key_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'questions' then perform public.regrade_exam(new.exam_id);
  else perform public.regrade_exam(new.id); end if;
  return null;
end $$;
create trigger questions_regrade after update of answer, points on public.questions
  for each row when (old.answer is distinct from new.answer or old.points is distinct from new.points)
  execute function public.on_answer_key_change();
create trigger exams_regrade after update of scoring on public.exams
  for each row when (old.scoring is distinct from new.scoring)
  execute function public.on_answer_key_change();

-- Chốt các Bài làm đã quá hạn (pg_cron mỗi phút).
create or replace function public.finalize_expired() returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0; aid uuid;
begin
  for aid in select id from public.attempts where submitted_at is null and deadline_at + interval '30 seconds' < now() loop
    update public.attempts set submitted_at = deadline_at where id = aid;
    perform public.grade_attempt(aid); n := n + 1;
  end loop;
  return n;
end $$;
select cron.schedule('finalize-expired-attempts', '* * * * *', 'select public.finalize_expired()');

-- ============================================================ RPC cho học sinh

-- Câu hỏi của một Bài làm, theo thứ tự đảo riêng, KHÔNG có đáp án/lời giải.
create or replace function public.attempt_questions(at public.attempts) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'type', q.type, 'stem_html', q.stem_html,
    'choices', case when q.type = 'mcq' and at.choice_orders ? q.id::text then
                 (select jsonb_agg(jsonb_build_object('label', q.choices -> (co.v)::int ->> 'label', 'html', q.choices -> (co.v)::int ->> 'html') order by co.ord)
                  from jsonb_array_elements_text(at.choice_orders -> q.id::text) with ordinality co(v, ord))
               else (select coalesce(jsonb_agg(jsonb_build_object('label', c ->> 'label', 'html', c ->> 'html')), '[]') from jsonb_array_elements(q.choices) c) end
  ) order by o.ord), '[]')
  from unnest(at.question_order) with ordinality o(qid, ord)
  join public.questions q on q.id = o.qid
$$;

create or replace function public.assignment_state(a public.assignments, used int, in_progress boolean) returns text
language sql stable set search_path = '' as $$
  select case
    when in_progress then 'in_progress'
    when now() < a.opens_at then 'upcoming'
    when now() >= a.closes_at then 'closed'
    when used >= a.max_attempts then 'no_attempts_left'
    else 'open' end
$$;

create or replace function public.assignment_info(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; a public.assignments; used int; cur public.attempts; last public.attempts; nq int;
begin
  me := public.current_student();
  select * into a from public.assignments where code = lower(p_code);
  if a.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if me.class_id is not null and me.class_id <> a.class_id then raise exception 'WRONG_CLASS' using errcode = 'P0001'; end if;
  select count(*) into used from public.attempts where assignment_id = a.id and student_id = me.id;
  select * into cur from public.attempts where assignment_id = a.id and student_id = me.id and submitted_at is null and deadline_at + interval '30 seconds' > now() limit 1;
  select * into last from public.attempts where assignment_id = a.id and student_id = me.id and submitted_at is not null order by attempt_no desc limit 1;
  select count(*) into nq from public.questions q where q.exam_id = a.exam_id;
  return jsonb_build_object(
    'code', a.code, 'title', a.title, 'class_name', (select name from public.classes where id = a.class_id),
    'opens_at', a.opens_at, 'closes_at', a.closes_at, 'duration_minutes', a.duration_minutes,
    'max_attempts', a.max_attempts, 'used_attempts', used, 'question_count', nq,
    'has_password', a.access_password is not null and a.access_password <> '',
    'state', public.assignment_state(a, used, cur.id is not null),
    'last_attempt_id', last.id, 'server_now', now());
end $$;

create or replace function public.start_attempt(p_code text, p_password text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; a public.assignments; at public.attempts; used int; qorder uuid[]; corders jsonb := '{}'; q record;
begin
  me := public.current_student();
  select * into a from public.assignments where code = lower(p_code);
  if a.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if me.class_id is null then
    update public.profiles set class_id = a.class_id where id = me.id;   -- xếp tạm vào lớp của Bài giao
  elsif me.class_id <> a.class_id then
    raise exception 'WRONG_CLASS' using errcode = 'P0001';
  end if;

  select * into at from public.attempts
   where assignment_id = a.id and student_id = me.id and submitted_at is null and deadline_at + interval '30 seconds' > now()
   order by attempt_no desc limit 1;

  if at.id is null then
    if now() < a.opens_at then raise exception 'NOT_OPEN' using errcode = 'P0001'; end if;
    if now() >= a.closes_at then raise exception 'CLOSED' using errcode = 'P0001'; end if;
    select count(*) into used from public.attempts where assignment_id = a.id and student_id = me.id;
    if used >= a.max_attempts then raise exception 'NO_ATTEMPTS_LEFT' using errcode = 'P0001'; end if;
    if coalesce(a.access_password, '') <> '' and coalesce(p_password, '') <> a.access_password then
      raise exception 'WRONG_PASSWORD' using errcode = 'P0001';
    end if;

    -- Thứ tự câu: đảo trong từng Phần, giữ thứ tự các Phần (như đề giấy).
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

    insert into public.attempts (assignment_id, student_id, attempt_no, deadline_at, question_order, choice_orders)
    values (a.id, me.id, used + 1, least(now() + make_interval(mins => a.duration_minutes), a.closes_at), qorder, corders)
    returning * into at;
  end if;

  return jsonb_build_object(
    'attempt_id', at.id, 'title', a.title, 'deadline_at', at.deadline_at, 'server_now', now(),
    'answers', at.answers, 'tab_leaves', at.tab_leaves, 'questions', public.attempt_questions(at));
end $$;

create or replace function public.save_answers(p_attempt uuid, p_answers jsonb, p_tab_leaves int default 0) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; at public.attempts;
begin
  me := public.current_student();
  select * into at from public.attempts where id = p_attempt and student_id = me.id for update;
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

create or replace function public.attempt_result(p_attempt uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; at public.attempts; a public.assignments; visible boolean; res jsonb;
begin
  me := public.current_student();
  select * into at from public.attempts where id = p_attempt and student_id = me.id;
  if at.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  select * into a from public.assignments where id = at.assignment_id;
  if at.submitted_at is null then raise exception 'NOT_SUBMITTED' using errcode = 'P0001'; end if;
  visible := a.result_mode <> 'none' and (a.result_release = 'on_submit' or now() >= a.closes_at);
  res := jsonb_build_object('attempt_id', at.id, 'title', a.title, 'code', a.code, 'submitted_at', at.submitted_at,
    'tab_leaves', at.tab_leaves, 'result_mode', a.result_mode, 'visible', visible, 'release_at', a.closes_at);
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

create or replace function public.submit_attempt(p_attempt uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; at public.attempts;
begin
  me := public.current_student();
  select * into at from public.attempts where id = p_attempt and student_id = me.id for update;
  if at.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if at.submitted_at is null then
    update public.attempts set submitted_at = least(now(), deadline_at + interval '30 seconds') where id = at.id;
    perform public.grade_attempt(at.id);
  end if;
  return public.attempt_result(at.id);
end $$;

-- Trang chủ học sinh: Bài giao của lớp mình.
create or replace function public.my_assignments() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := public.current_student();
  return jsonb_build_object(
    'class_name', (select name from public.classes where id = me.class_id),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', a.code, 'title', a.title, 'opens_at', a.opens_at, 'closes_at', a.closes_at,
        'duration_minutes', a.duration_minutes,
        'state', public.assignment_state(a, s.used, s.in_progress),
        'best_score', case when a.result_mode <> 'none' and (a.result_release = 'on_submit' or now() >= a.closes_at) then s.best end,
        'last_attempt_id', s.last_id
      ) order by a.opens_at desc)
      from public.assignments a
      cross join lateral (
        select count(*)::int as used,
               coalesce(bool_or(t.submitted_at is null and t.deadline_at + interval '30 seconds' > now()), false) as in_progress,
               max(t.score) as best,
               (array_agg(t.id order by t.attempt_no desc) filter (where t.submitted_at is not null))[1] as last_id
        from public.attempts t where t.assignment_id = a.id and t.student_id = me.id) s
      where a.class_id = me.class_id), '[]'));
end $$;

create or replace function public.set_my_name(p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set full_name = trim(p_name) where id = auth.uid();
end $$;

create or replace function public.clear_must_change_password() returns void
language sql security definer set search_path = '' as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;

-- Giáo viên: thu hồi mọi phiên của một học sinh (khi đặt lại mật khẩu / khoá).
create or replace function public.revoke_sessions(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_teacher() then raise exception 'FORBIDDEN'; end if;
  delete from auth.sessions where user_id = p_user;
end $$;

-- ============================================================ RLS

alter table public.classes enable row level security;
alter table public.profiles enable row level security;
alter table public.exams enable row level security;
alter table public.questions enable row level security;
alter table public.assignments enable row level security;
alter table public.attempts enable row level security;

create policy teacher_all on public.classes for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy teacher_all on public.profiles for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy teacher_all on public.exams for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy teacher_all on public.questions for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy teacher_all on public.assignments for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy teacher_all on public.attempts for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

create policy own_profile_read on public.profiles for select to authenticated using (id = auth.uid());
create policy own_class_read on public.classes for select to authenticated
  using (id = (select class_id from public.profiles where id = auth.uid()));

-- Quyền gọi hàm: Supabase mặc định cấp EXECUTE cho anon/authenticated. Thu hồi hết, rồi chỉ mở các RPC công khai.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.is_teacher(), public.assignment_info(text), public.start_attempt(text, text), public.save_answers(uuid, jsonb, int),
  public.attempt_result(uuid), public.submit_attempt(uuid), public.my_assignments(), public.set_my_name(text),
  public.clear_must_change_password(), public.revoke_sessions(uuid), public.regrade_exam(uuid)
to authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ============================================================ Storage

insert into storage.buckets (id, name, public) values ('exam-files', 'exam-files', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('question-images', 'question-images', true) on conflict do nothing;

create policy teacher_exam_files on storage.objects for all to authenticated
  using (bucket_id in ('exam-files', 'question-images') and public.is_teacher())
  with check (bucket_id in ('exam-files', 'question-images') and public.is_teacher());
