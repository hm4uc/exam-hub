-- Giáo viên có thể xoá một bài làm để học sinh làm lại. Số lượt đã dùng = số bài làm còn lại,
-- còn số thứ tự lượt mới = lượt lớn nhất + 1 (tránh trùng khi xoá một lượt ở giữa).
create or replace function public.start_attempt(p_code text, p_password text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; a public.assignments; at public.attempts; used int; next_no int; qorder uuid[]; corders jsonb := '{}'; q record;
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
    select coalesce(max(attempt_no), 0) + 1 into next_no from public.attempts where assignment_id = a.id and student_id = me.id;
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
    values (a.id, me.id, next_no, least(now() + make_interval(mins => a.duration_minutes), a.closes_at), qorder, corders)
    returning * into at;
  end if;

  return jsonb_build_object(
    'attempt_id', at.id, 'title', a.title, 'deadline_at', at.deadline_at, 'server_now', now(),
    'answers', at.answers, 'tab_leaves', at.tab_leaves, 'questions', public.attempt_questions(at));
end $$;
