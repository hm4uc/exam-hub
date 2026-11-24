-- Đa giáo viên (multi-tenant): mỗi Đề thi, Lớp, Bài giao thuộc một giáo viên (owner_id); học sinh thuộc giáo viên đã tạo.
-- Giáo viên chỉ thấy và sửa dữ liệu của mình; quản trị viên (admin) thấy tất cả.
-- Dữ liệu hiện có được gán cho giáo viên đầu tiên (hoặc admin nếu chưa có giáo viên).

-- ============================================================ 1. Cột sở hữu

alter table public.profiles add column if not exists owner_id uuid references public.profiles on delete cascade;
alter table public.profiles add column if not exists teacher_code text;
alter table public.classes add column if not exists owner_id uuid references public.profiles on delete cascade default auth.uid();
alter table public.exams add column if not exists owner_id uuid references public.profiles on delete cascade default auth.uid();
alter table public.assignments add column if not exists owner_id uuid references public.profiles on delete cascade default auth.uid();

create index if not exists profiles_owner_id_idx on public.profiles (owner_id) where owner_id is not null;
create index if not exists classes_owner_id_idx on public.classes (owner_id);
create index if not exists exams_owner_id_idx on public.exams (owner_id);
create index if not exists assignments_owner_id_idx on public.assignments (owner_id);

-- ============================================================ 2. Gán dữ liệu cũ

do $$
declare
  v_owner uuid;
  t record;
  base text;
  cand text;
  i int;
begin
  select id into v_owner from public.profiles where role = 'teacher' order by created_at limit 1;
  if v_owner is null then select id into v_owner from public.profiles where role = 'admin' order by created_at limit 1; end if;

  if v_owner is not null then
    update public.classes     set owner_id = v_owner where owner_id is null;
    update public.exams       set owner_id = v_owner where owner_id is null;
    update public.assignments set owner_id = v_owner where owner_id is null;
    update public.profiles    set owner_id = v_owner where role = 'student' and owner_id is null;
  end if;

  -- Mã giáo viên (tiền tố tên đăng nhập học sinh): suy từ tên đăng nhập, bảo đảm duy nhất.
  for t in select id, username from public.profiles where role = 'teacher' and teacher_code is null order by created_at loop
    base := left(coalesce(nullif(regexp_replace(lower(t.username), '[^a-z0-9]', '', 'g'), ''), 'gv'), 10);
    if length(base) < 2 then base := base || 'gv'; end if;
    cand := base; i := 1;
    while exists (select 1 from public.profiles where teacher_code = cand) loop
      i := i + 1; cand := base || i;
    end loop;
    update public.profiles set teacher_code = cand where id = t.id;
  end loop;

  if not exists (select 1 from public.classes where owner_id is null) then alter table public.classes alter column owner_id set not null; end if;
  if not exists (select 1 from public.exams where owner_id is null) then alter table public.exams alter column owner_id set not null; end if;
  if not exists (select 1 from public.assignments where owner_id is null) then alter table public.assignments alter column owner_id set not null; end if;
end $$;

alter table public.profiles drop constraint if exists profiles_teacher_code_check;
alter table public.profiles add constraint profiles_teacher_code_check
  check (teacher_code is null or teacher_code ~ '^[a-z0-9]{2,12}$');
create unique index if not exists profiles_teacher_code_key on public.profiles (teacher_code) where teacher_code is not null;

-- Lưu ý: trigger handle_new_user luôn tạo vai trò student rồi Server Action mới nâng quyền / gán owner_id,
-- nên không đặt ràng buộc CHECK "student phải có owner_id" ở đây; Server Action (accounts/actions.ts) bảo đảm điều này.

-- ============================================================ 3. Quyền theo chủ sở hữu

-- Giáo viên quản lý dữ liệu của chính mình; admin quản lý tất cả; tài khoản bị khoá thì không.
create or replace function public.can_manage(p_owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and not is_locked
      and (role = 'admin' or (role = 'teacher' and id = p_owner))
  )
$$;

drop policy if exists teacher_all on public.classes;
drop policy if exists teacher_all on public.exams;
drop policy if exists teacher_all on public.assignments;
drop policy if exists teacher_all on public.questions;
drop policy if exists teacher_all on public.attempts;
drop policy if exists teacher_all on public.profiles;
drop policy if exists tenant_all on public.classes;
drop policy if exists tenant_all on public.exams;
drop policy if exists tenant_all on public.assignments;
drop policy if exists tenant_all on public.questions;
drop policy if exists tenant_all on public.attempts;
drop policy if exists tenant_all on public.profiles;

create policy tenant_all on public.classes     for all to authenticated using (public.can_manage(owner_id)) with check (public.can_manage(owner_id));
create policy tenant_all on public.exams       for all to authenticated using (public.can_manage(owner_id)) with check (public.can_manage(owner_id));
create policy tenant_all on public.assignments for all to authenticated using (public.can_manage(owner_id)) with check (public.can_manage(owner_id));
-- Câu hỏi và bài làm đi theo Đề thi / Bài giao (RLS của bảng cha được áp dụng trong truy vấn con).
create policy tenant_all on public.questions for all to authenticated
  using (exists (select 1 from public.exams e where e.id = questions.exam_id))
  with check (exists (select 1 from public.exams e where e.id = questions.exam_id));
create policy tenant_all on public.attempts for all to authenticated
  using (exists (select 1 from public.assignments a where a.id = attempts.assignment_id))
  with check (exists (select 1 from public.assignments a where a.id = attempts.assignment_id));
-- Giáo viên chỉ quản lý học sinh của mình (không thấy giáo viên khác); admin quản lý tất cả.
create policy tenant_all on public.profiles for all to authenticated
  using (public.is_admin() or (role = 'student' and public.can_manage(owner_id)))
  with check (public.is_admin() or (role = 'student' and public.can_manage(owner_id)));

grant execute on function public.can_manage(uuid) to authenticated;

-- Bài giao phải dùng Đề thi và Lớp của cùng giáo viên; học sinh chỉ vào Lớp của cùng giáo viên.
create or replace function public.check_same_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'assignments' then
    if not exists (select 1 from public.exams where id = new.exam_id and owner_id = new.owner_id) then
      raise exception 'OWNER_MISMATCH' using errcode = 'P0001';
    end if;
    if new.class_id is not null and not exists (select 1 from public.classes where id = new.class_id and owner_id = new.owner_id) then
      raise exception 'OWNER_MISMATCH' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'profiles' then
    if new.class_id is not null and new.role = 'student'
       and not exists (select 1 from public.classes where id = new.class_id and owner_id = new.owner_id) then
      raise exception 'OWNER_MISMATCH' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists assignments_same_owner on public.assignments;
create trigger assignments_same_owner before insert or update of exam_id, class_id, owner_id on public.assignments
  for each row execute function public.check_same_owner();
drop trigger if exists profiles_same_owner on public.profiles;
create trigger profiles_same_owner before insert or update of class_id, owner_id on public.profiles
  for each row execute function public.check_same_owner();

-- Tài khoản mới: owner_id và teacher_code lấy từ metadata (chỉ Server Action dùng service role tạo user).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, role, username, full_name, class_id, owner_id, teacher_code)
  values (
    new.id, 'student',
    lower(new.raw_user_meta_data ->> 'username'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), new.raw_user_meta_data ->> 'username'),
    nullif(new.raw_user_meta_data ->> 'class_id', '')::uuid,
    nullif(new.raw_user_meta_data ->> 'owner_id', '')::uuid,
    nullif(lower(new.raw_user_meta_data ->> 'teacher_code'), '')
  );
  return new;
end $$;

-- ============================================================ 4. Các RPC giáo viên

create or replace function public.revoke_sessions(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles t where t.id = p_user and (t.id = auth.uid() or public.can_manage(t.owner_id))) then
    raise exception 'FORBIDDEN';
  end if;
  delete from auth.sessions where user_id = p_user;
end $$;

create or replace function public.regrade_exam(p_exam uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0; aid uuid;
begin
  -- current_user trong hàm SECURITY DEFINER luôn là chủ hàm, nên phân biệt người gọi bằng vai trò của phiên.
  if coalesce(current_setting('role', true), 'none') not in ('none', 'postgres', 'service_role')
     and not exists (select 1 from public.exams e where e.id = p_exam and public.can_manage(e.owner_id)) then
    raise exception 'FORBIDDEN';
  end if;
  for aid in select t.id from public.attempts t join public.assignments a on a.id = t.assignment_id
             where a.exam_id = p_exam and t.submitted_at is not null loop
    perform public.grade_attempt(aid); n := n + 1;
  end loop;
  return n;
end $$;

-- Làm bài: học sinh của giáo viên khác không bị kéo vào Lớp của bài giao này.
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
      if me.owner_id is distinct from a.owner_id then
        -- học sinh của giáo viên khác: vào được bài mở công khai, nhưng không bị xếp vào lớp này
        if a.restrict_to_class then raise exception 'WRONG_CLASS' using errcode = 'P0001'; end if;
      elsif me.class_id is null then
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

-- ============================================================ 5. Storage: mỗi giáo viên chỉ ghi vào thư mục của mình

drop policy if exists teacher_exam_files on storage.objects;
drop policy if exists tenant_files on storage.objects;
create policy tenant_files on storage.objects for all to authenticated
  using (
    bucket_id in ('exam-files', 'question-images') and public.is_teacher() and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
      -- tệp cũ chưa nằm trong thư mục theo giáo viên: chủ của đề được xoá file gốc của đề đó
      or exists (select 1 from public.exams e where e.source_path = name and e.owner_id = auth.uid())
    ))
  with check (
    bucket_id in ('exam-files', 'question-images') and public.is_teacher() and (
      public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text
    ));
