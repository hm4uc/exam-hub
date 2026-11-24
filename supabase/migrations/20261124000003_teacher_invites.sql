-- Mã mời đăng ký giáo viên: do quản trị viên tạo, dùng được N lần, có hạn tuỳ chọn.
-- Đăng ký giáo viên đi qua Server Action (service role); người dùng thường không đọc/ghi được bảng này.

create table if not exists public.teacher_invites (
  code text primary key check (code ~ '^[a-z2-9]{10}$'),
  note text check (note is null or length(note) <= 120),
  created_by uuid references public.profiles on delete set null,
  expires_at timestamptz,
  max_uses int not null default 1 check (max_uses between 1 and 1000),
  uses int not null default 0 check (uses >= 0),
  created_at timestamptz not null default now()
);
alter table public.teacher_invites enable row level security;
drop policy if exists admin_all on public.teacher_invites;
create policy admin_all on public.teacher_invites for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Dùng một lượt: true nếu mã còn hiệu lực (đã tăng số lượt dùng, nguyên tử); false nếu hết hạn / hết lượt / không có.
create or replace function public.use_teacher_invite(p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.teacher_invites
     set uses = uses + 1
   where code = lower(trim(p_code)) and uses < max_uses and (expires_at is null or expires_at > now());
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- Hoàn lại lượt khi tạo tài khoản thất bại sau khi đã giữ chỗ.
create or replace function public.release_teacher_invite(p_code text) returns void
language sql security definer set search_path = '' as $$
  update public.teacher_invites set uses = greatest(uses - 1, 0) where code = lower(trim(p_code))
$$;

revoke execute on function public.use_teacher_invite(text), public.release_teacher_invite(text) from public, anon, authenticated;
grant execute on function public.use_teacher_invite(text), public.release_teacher_invite(text) to service_role;
