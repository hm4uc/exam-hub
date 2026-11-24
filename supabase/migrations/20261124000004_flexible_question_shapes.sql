-- Câu hỏi linh hoạt cho tiểu học, THCS, SAT:
--  - Đúng/Sai có 2–4 ý (THPT 4 ý chấm theo thang 0,1 / 0,25 / 0,5 / 1; ít ý hơn chấm theo tỉ lệ ý đúng);
--  - đáp án số chấp nhận phân số a/b (SAT: "3/4" bằng 0,75).

create or replace function public.norm_num(t text) returns numeric
language sql immutable set search_path = '' as $$
  select case
    when v ~ '^-?[0-9]*\.?[0-9]+$' then v::numeric
    when v ~ '^-?[0-9]+(\.[0-9]+)?/[0-9]+(\.[0-9]+)?$' and split_part(v, '/', 2)::numeric <> 0
      then split_part(v, '/', 1)::numeric / split_part(v, '/', 2)::numeric
  end
  from (select replace(replace(trim(t), ' ', ''), ',', '.') as v) s
$$;

create or replace function public.grade_question(q public.questions, scoring jsonb, given jsonb, out pts numeric, out max_pts numeric)
language plpgsql immutable set search_path = '' as $$
declare k int := 0; n int; g text; a text;
begin
  max_pts := coalesce(q.points, (scoring ->> q.type)::numeric, 0);
  pts := 0;
  if given is null or given = 'null'::jsonb then return; end if;
  if q.type = 'mcq' then
    if given #>> '{}' = q.answer #>> '{}' then pts := max_pts; end if;
  elsif q.type = 'tf' then
    g := given #>> '{}'; a := q.answer #>> '{}';
    n := length(a);
    if n = 0 then return; end if;
    for i in 1..n loop
      if substr(g, i, 1) = substr(a, i, 1) then k := k + 1; end if;
    end loop;
    pts := max_pts * case
      when n = 4 then case k when 1 then 0.1 when 2 then 0.25 when 3 then 0.5 when 4 then 1 else 0 end
      else k::numeric / n
    end;
  else
    if public.norm_num(given #>> '{}') is not null and exists (
      select 1 from jsonb_array_elements_text(q.answer) x where public.norm_num(x) = public.norm_num(given #>> '{}')
    ) then pts := max_pts; end if;
  end if;
end $$;
