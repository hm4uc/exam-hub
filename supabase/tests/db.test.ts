// Kiểm thử migration trên PGlite (Postgres WASM) với các schema Supabase được giả lập tối thiểu.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const STUBS = `
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), raw_user_meta_data jsonb default '{}');
create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create schema storage;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)] $$;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create schema cron;
create function cron.schedule(a text, b text, c text) returns int language sql as $$ select 1 $$;
`;

let db: PGlite;
const as = async (uid: string | null) => db.exec(`select set_config('test.uid', '${uid ?? ''}', false)`);
const one = async <T = any>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

async function mkUser(username: string, full_name: string, class_id?: string, owner_id?: string, teacher_code?: string) {
  const r = await one<{ id: string }>(
    `insert into auth.users (raw_user_meta_data) values ($1) returning id`,
    [JSON.stringify({ username, full_name, class_id: class_id ?? '', owner_id: owner_id ?? '', teacher_code: teacher_code ?? '' })],
  );
  return r.id;
}

beforeAll(async () => {
  db = new PGlite();
  // PGlite không có pg_cron: bỏ câu create extension, giữ phần còn lại.
  await db.exec(STUBS);
  const dir = join(__dirname, '..', 'migrations');
  for (const f of readdirSync(dir).sort()) {
    const sql = readFileSync(join(dir, f), 'utf8').replace(/create extension if not exists pg_cron[^;]*;/, '');
    await db.exec(sql);
  }
  // Supabase cấp sẵn quyền bảng cho anon/authenticated (RLS mới là lớp chặn).
  await db.exec(`grant usage on schema public to anon, authenticated;
                 grant all on all tables in schema public to anon, authenticated;
                 grant usage on schema storage to anon, authenticated;
                 grant all on all tables in schema storage to anon, authenticated;`);
});

afterEach(async () => { await db.exec('reset role'); });

describe('schema + RPC', () => {
  let teacher: string, s1: string, s2: string, classA: string, classB: string, exam: string;
  const q: Record<string, string> = {};

  it('tạo dữ liệu', async () => {
    teacher = await mkUser('co.giao', 'Cô Giáo', undefined, undefined, 'cogiao');
    await db.query(`update public.profiles set role = 'teacher' where id = $1`, [teacher]);
    await as(teacher); // giá trị mặc định owner_id = auth.uid()
    classA = (await one(`insert into public.classes (name, school_year) values ('10A1','2026-2027') returning id`)).id;
    classB = (await one(`insert into public.classes (name, school_year) values ('10A2','2026-2027') returning id`)).id;
    s1 = await mkUser('An.Nguyen', 'Nguyễn Văn An', undefined, teacher);           // chưa có lớp
    s2 = await mkUser('binh', 'Trần Bình', classB, teacher);
    expect((await one(`select username from public.profiles where id=$1`, [s1])).username).toBe('an.nguyen');

    exam = (await one(`insert into public.exams (title, status) values ('Đề thử','published') returning id`)).id;
    const ins = async (pos: number, part: string, type: string, answer: unknown, choices: unknown[] = []) =>
      (await one(`insert into public.questions (exam_id, position, part, type, stem, stem_html, choices, answer)
                  values ($1,$2,$3,$4,'s','<p>s</p>',$5,$6) returning id`,
        [exam, pos, part, type, JSON.stringify(choices), JSON.stringify(answer)])).id;
    const abcd = ['A', 'B', 'C', 'D'].map((l) => ({ label: l, text: l, html: l }));
    q.m1 = await ins(1, 'I', 'mcq', 'B', abcd);
    q.m2 = await ins(2, 'I', 'mcq', 'C', abcd);
    q.t1 = await ins(3, 'II', 'tf', 'ĐSĐS', ['a', 'b', 'c', 'd'].map((l) => ({ label: l, text: l, html: l })));
    q.s1 = await ins(4, 'III', 'short', ['0,33', '0,3']);
  });

  let code: string, attempt: string;

  it('học sinh không đọc được đáp án trực tiếp', async () => {
    await db.exec('set role authenticated');
    await as(s1);
    const r = await db.query(`select * from public.questions`);
    expect(r.rows.length).toBe(0);
    await db.exec('reset role');
  });

  it('giao bài + bắt đầu làm (xếp tạm vào lớp)', async () => {
    code = (await one(`insert into public.assignments (exam_id, class_id, title, opens_at, closes_at, duration_minutes, access_password, restrict_to_class, owner_id)
             values ($1,$2,'Kiểm tra 15 phút', now() - interval '1 minute', now() + interval '1 day', 15, 'abc', true, $3) returning code`, [exam, classA, teacher])).code;
    expect(code).toMatch(/^[a-z2-9]{6}$/);

    await db.exec('set role authenticated');
    await as(s1);
    const info = (await one(`select public.assignment_info($1) j`, [code.toUpperCase()])).j;
    expect(info.state).toBe('open');
    expect(info.has_password).toBe(true);
    expect(info.restrict_to_class).toBe(true);
    await expect(db.query(`select public.start_attempt($1, 'sai')`, [code])).rejects.toThrow(/WRONG_PASSWORD/);
    const st = (await one(`select public.start_attempt($1, 'abc') j`, [code])).j;
    attempt = st.attempt_id;
    expect(st.questions).toHaveLength(4);
    expect(JSON.stringify(st.questions)).not.toMatch(/"answer"/);
    // Phần I đứng trước Phần II, III dù có đảo
    expect(st.questions.map((x: any) => x.type)).toEqual(['mcq', 'mcq', 'tf', 'short']);
    // mở lại → tiếp tục cùng Bài làm
    expect((await one(`select public.start_attempt($1, null) j`, [code])).j.attempt_id).toBe(attempt);
    await db.exec('reset role');
    expect((await one(`select class_id from public.profiles where id=$1`, [s1])).class_id).toBe(classA);
  });

  it('bài giao giới hạn lớp: học sinh lớp khác & khách bị chặn', async () => {
    await db.exec('set role authenticated');
    await as(s2);
    await expect(db.query(`select public.start_attempt($1, 'abc')`, [code])).rejects.toThrow(/WRONG_CLASS/);
    await db.exec('reset role');

    await db.exec('set role anon');
    await as(null);
    const info = (await one(`select public.assignment_info($1, 'guest-token-1234') j`, [code])).j;
    expect(info.login_required).toBe(true);
    await expect(db.query(`select public.start_attempt($1, 'abc', 'guest-token-1234', 'Khách')`, [code])).rejects.toThrow(/LOGIN_REQUIRED/);
    await db.exec('reset role');
  });

  it('lưu, nộp, chấm điểm', async () => {
    await db.exec('set role authenticated');
    await as(s1);
    await db.query(`select public.save_answers($1, $2, 2)`, [attempt, JSON.stringify({ [q.m1]: 'B', [q.m2]: 'A' })]);
    await db.query(`select public.save_answers($1, $2, 1)`, [attempt, JSON.stringify({ [q.t1]: 'ĐSĐĐ', [q.s1]: '0.3' })]);
    const res = (await one(`select public.submit_attempt($1) j`, [attempt])).j;
    // m1 0,25 + m2 0 + tf 3 ý đúng 0,5 + short 0,5 = 1,25 / tối đa 2,0 → 6,25
    expect(Number(res.score_raw)).toBeCloseTo(1.25);
    expect(Number(res.score_max)).toBeCloseTo(2);
    expect(Number(res.score)).toBeCloseTo(6.25);
    expect(res.questions).toBeUndefined(); // result_mode mặc định 'score'
    await expect(db.query(`select public.save_answers($1, '{}', 0)`, [attempt])).rejects.toThrow(/ALREADY_SUBMITTED/);
    const info = (await one(`select public.assignment_info($1) j`, [code])).j;
    expect(info.state).toBe('no_attempts_left');
    const home = (await one(`select public.my_assignments() j`)).j;
    expect(home.class_name).toBe('10A1');
    expect(Number(home.items[0].best_score)).toBeCloseTo(6.25);
    await db.exec('reset role');
    expect((await one(`select tab_leaves from public.attempts where id=$1`, [attempt])).tab_leaves).toBe(2);
  });

  it('sửa đáp án → tự chấm lại', async () => {
    await db.query(`update public.questions set answer = '"A"' where id = $1`, [q.m2]);
    expect(Number((await one(`select score from public.attempts where id=$1`, [attempt])).score)).toBeCloseTo(7.5);
  });

  it('chế độ xem điểm + đáp án trả câu hỏi kèm đáp án', async () => {
    await db.query(`update public.assignments set result_mode = 'score_answers' where code = $1`, [code]);
    await db.exec('set role authenticated');
    await as(s1);
    const r = (await one(`select public.attempt_result($1) j`, [attempt])).j;
    expect(r.questions).toHaveLength(4);
    expect(r.questions.find((x: any) => x.id === q.m1).answer).toBe('B');
    await db.exec('reset role');
  });

  it('chốt bài quá hạn', async () => {
    await db.query(`update public.assignments set max_attempts = 2 where code = $1`, [code]);
    await db.exec('set role authenticated');
    await as(s1);
    const st = (await one(`select public.start_attempt($1, 'abc') j`, [code])).j;
    await db.exec('reset role');
    await db.query(`update public.attempts set deadline_at = now() - interval '5 minutes' where id = $1`, [st.attempt_id]);
    expect((await one(`select public.finalize_expired() n`)).n).toBe(1);
    expect((await one(`select submitted_at is not null s, score from public.attempts where id=$1`, [st.attempt_id])).s).toBe(true);
  });

  it('xoá một bài làm ở giữa → học sinh làm lại, lượt mới không trùng số', async () => {
    await db.query(`delete from public.attempts where student_id = $1 and attempt_no = 1`, [s1]);
    await db.exec('set role authenticated');
    await as(s1);
    const st = (await one(`select public.start_attempt($1, 'abc') j`, [code])).j;
    await db.exec('reset role');
    expect((await one(`select attempt_no from public.attempts where id = $1`, [st.attempt_id])).attempt_no).toBe(3);
  });

  it("giáo viên thao tác bằng quyền authenticated (như app thật)", async () => {
    await db.exec("set role authenticated");
    await as(teacher);
    const c = (await one(`insert into public.classes (name) values ('Lớp GV') returning id`)).id;
    const e = (await one(`insert into public.exams (title) values ('Đề GV') returning id`)).id;
    await db.query(`insert into public.questions (exam_id, position, type, stem, stem_html, answer) values ($1, 1, 'short', 'x', 'x', '["1"]')`, [e]);
    const a = await one(`insert into public.assignments (exam_id, class_id, title, opens_at, closes_at, duration_minutes)
      values ($1, $2, 'Bài GV', now(), now() + interval '1 day', 10) returning code`, [e, c]);
    expect(a.code).toMatch(/^[a-z2-9]{6}$/);
    await db.query(`update public.questions set answer = '["2"]' where exam_id = $1`, [e]);
    await db.query(`select public.revoke_sessions($1)`, [s1]);
    await db.exec("reset role");
  });

  it('link tự do không lớp, không giờ đóng: khách không đăng nhập làm bài + tên mặc định + bảo mật guest_key', async () => {
    const qcode = (await one(`insert into public.assignments (exam_id, class_id, title, opens_at, closes_at, duration_minutes, result_mode, is_quick_link, owner_id)
      values ($1, null, 'Đề mở tự do', now() - interval '1 minute', null, 45, 'score_answers', true, $2) returning code`, [exam, teacher])).code;

    // Khách 1 không nhập tên → tự gán "Học sinh #1"
    await db.exec('set role anon');
    await as(null);
    const info1 = (await one(`select public.assignment_info($1, 'guest-aaaa-1111') j`, [qcode])).j;
    expect(info1.state).toBe('open');
    expect(info1.class_name).toBeNull();
    expect(info1.closes_at).toBeNull();
    expect(info1.login_required).toBe(false);

    const st1 = (await one(`select public.start_attempt($1, null, 'guest-aaaa-1111', '') j`, [qcode])).j;
    expect(st1.guest_name).toBe('Học sinh #1');
    expect(st1.questions).toHaveLength(4);

    // Khách khác không sửa/xem được bài của Khách 1 dù biết attempt_id
    await expect(db.query(`select public.save_answers($1, '{}', 0, 'guest-other-9999')`, [st1.attempt_id])).rejects.toThrow(/NOT_FOUND/);
    await expect(db.query(`select public.submit_attempt($1, 'guest-other-9999')`, [st1.attempt_id])).rejects.toThrow(/NOT_FOUND/);

    // Khách 1 lưu và nộp bài bình thường
    await db.query(`select public.save_answers($1, $2, 1, 'guest-aaaa-1111')`, [st1.attempt_id, JSON.stringify({ [q.m1]: 'B', [q.m2]: 'A' })]);
    const res1 = (await one(`select public.submit_attempt($1, 'guest-aaaa-1111') j`, [st1.attempt_id])).j;
    expect(res1.is_guest).toBe(true);
    expect(res1.guest_name).toBe('Học sinh #1');
    expect(Number(res1.score)).toBeGreaterThan(0);

    // Khách 2 nhập tên tuỳ chọn
    const st2 = (await one(`select public.start_attempt($1, null, 'guest-bbbb-2222', 'Minh Anh') j`, [qcode])).j;
    expect(st2.guest_name).toBe('Minh Anh');

    // Khách 3 bỏ trống tên → "Học sinh #3"
    const st3 = (await one(`select public.start_attempt($1, null, 'guest-cccc-3333', null) j`, [qcode])).j;
    expect(st3.guest_name).toBe('Học sinh #3');
    await db.exec('reset role');

    // Bài gắn lớp nhưng restrict_to_class = false (mặc định): học sinh lớp khác & khách vẫn làm được
    const openClassCode = (await one(`insert into public.assignments (exam_id, class_id, title, opens_at, closes_at, duration_minutes, owner_id)
      values ($1, $2, 'Đề lớp 10A1 mở rộng', now() - interval '1 minute', null, 30, $3) returning code`, [exam, classA, teacher])).code;
    await db.exec('set role authenticated');
    await as(s2); // thuộc classB
    const stS2 = (await one(`select public.start_attempt($1) j`, [openClassCode])).j;
    expect(stS2.attempt_id).toBeTruthy();
    await db.exec('reset role');
    // s2 vẫn giữ nguyên lớp B
    expect((await one(`select class_id from public.profiles where id=$1`, [s2])).class_id).toBe(classB);

    await db.exec('set role anon');
    await as(null);
    const stG = (await one(`select public.start_attempt($1, null, 'guest-dddd-4444', 'Bạn ngoài lớp') j`, [openClassCode])).j;
    expect(stG.guest_name).toBe('Bạn ngoài lớp');
    await db.exec('reset role');

    // Giáo viên xem assignment_info không bị lỗi NOT_STUDENT
    await db.exec('set role authenticated');
    await as(teacher);
    const tInfo = (await one(`select public.assignment_info($1) j`, [qcode])).j;
    expect(tInfo.viewer_role).toBe('teacher');
    await db.exec('reset role');
  });

  it('vai trò admin & RLS bảng trace_events', async () => {
    const adm = await mkUser('sysadmin', 'Quản trị');
    await db.query(`update public.profiles set role = 'admin' where id = $1`, [adm]);
    await db.query(`insert into public.trace_events (level, category, event, message) values ('error', 'exam', 'save_failed', 'Mất mạng')`);

    // Giáo viên & học sinh & anon KHÔNG đọc được trace_events
    await db.exec('set role authenticated');
    await as(teacher);
    expect((await db.query(`select * from public.trace_events`)).rows).toHaveLength(0);
    await expect(db.query(`select public.purge_old_traces(7)`)).rejects.toThrow(/FORBIDDEN/);

    await as(s1);
    expect((await db.query(`select * from public.trace_events`)).rows).toHaveLength(0);

    // Admin đọc và dọn được trace_events + vẫn có quyền teacher
    await as(adm);
    expect((await db.query(`select * from public.trace_events`)).rows).toHaveLength(1);
    expect((await one(`select public.is_admin() ok`)).ok).toBe(true);
    expect((await one(`select public.is_teacher() ok`)).ok).toBe(true);
    expect((await one(`select public.purge_old_traces(30) n`)).n).toBe(0);
    await db.exec('reset role');
  });

  it('anon không gọi được RPC riêng tư', async () => {
    await db.exec('set role anon');
    await as(null);
    await expect(db.query(`select public.my_assignments()`)).rejects.toThrow(/permission denied/);
    await expect(db.query(`select public.purge_old_traces(7)`)).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
  });
});

describe('giới hạn tần suất', () => {
  it('cho qua đến hạn mức rồi chặn; khoá khác không bị ảnh hưởng', async () => {
    const hit = async (key: string, limit = 3) => (await one<{ ok: boolean }>(`select public.rate_limit_hit($1, 60, $2) ok`, [key, limit])).ok;
    expect([await hit('a'), await hit('a'), await hit('a'), await hit('a')]).toEqual([true, true, true, false]);
    expect(await hit('b')).toBe(true);
  });

  it('anon và authenticated không gọi được; tham số sai bị từ chối', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await expect(db.query(`select public.rate_limit_hit('x', 60, 3)`)).rejects.toThrow(/permission denied/);
      await db.exec('reset role');
    }
    await expect(db.query(`select public.rate_limit_hit('x', 0, 3)`)).rejects.toThrow(/BAD_RATE_LIMIT_ARGS/);
    await expect(db.query(`select public.rate_limit_hit('', 60, 3)`)).rejects.toThrow(/BAD_RATE_LIMIT_ARGS/);
  });

  it('bảng rate_limits không đọc được từ phía người dùng', async () => {
    await db.exec('set role authenticated');
    await as(null);
    expect((await db.query(`select * from public.rate_limits`)).rows).toHaveLength(0);
    await db.exec('reset role');
  });
});

describe('đa giáo viên: cô lập dữ liệu giữa hai giáo viên', () => {
  let tA: string, tB: string, adm: string, sA: string, sB: string;
  let examA: string, examB: string, classA: string, classB: string, asgA: string, asgB: string;

  it('dựng dữ liệu cho hai giáo viên', async () => {
    tA = await mkUser('gv.a', 'Giáo viên A', undefined, undefined, 'gva');
    tB = await mkUser('gv.b', 'Giáo viên B', undefined, undefined, 'gvb');
    adm = await mkUser('admin.mt', 'Admin');
    await db.query(`update public.profiles set role = 'teacher' where id = any($1)`, [[tA, tB]]);
    await db.query(`update public.profiles set role = 'admin' where id = $1`, [adm]);
    sA = await mkUser('gva.an', 'Học sinh A', undefined, tA);
    sB = await mkUser('gvb.binh', 'Học sinh B', undefined, tB);
    for (const [owner, tag] of [[tA, 'A'], [tB, 'B']] as const) {
      const c = (await one(`insert into public.classes (name, owner_id) values ($1, $2) returning id`, [`Lớp ${tag}`, owner])).id;
      const e = (await one(`insert into public.exams (title, owner_id, status) values ($1, $2, 'published') returning id`, [`Đề ${tag}`, owner])).id;
      await db.query(`insert into public.questions (exam_id, position, part, type, stem, stem_html, choices, answer)
                      values ($1, 1, 'I', 'mcq', 's', 's', $2, '"A"')`,
        [e, JSON.stringify(['A', 'B', 'C', 'D'].map((l) => ({ label: l, text: l, html: l })))]);
      const a = (await one(`insert into public.assignments (exam_id, class_id, title, opens_at, duration_minutes, owner_id)
                            values ($1, $2, $3, now() - interval '1 minute', 30, $4) returning id`, [e, c, `Bài ${tag}`, owner])).id;
      if (tag === 'A') { classA = c; examA = e; asgA = a; } else { classB = c; examB = e; asgB = a; }
    }
    expect([classA, classB, examA, examB, asgA, asgB].every(Boolean)).toBe(true);
  });

  it('giáo viên B không thấy, không sửa, không xoá dữ liệu của A', async () => {
    await db.exec('set role authenticated');
    await as(tB);
    for (const [table, mine] of [['exams', examB], ['classes', classB], ['assignments', asgB], ['questions', examB]] as const) {
      const rows = (await db.query<{ id: string }>(`select * from public.${table}`)).rows;
      expect(rows, table).toHaveLength(1);
    }
    expect((await db.query(`select * from public.profiles where role = 'student'`)).rows.map((r: any) => r.id)).toEqual([sB]);
    expect((await db.query(`update public.exams set title = 'hack' where id = $1 returning id`, [examA])).rows).toHaveLength(0);
    expect((await db.query(`delete from public.exams where id = $1 returning id`, [examA])).rows).toHaveLength(0);
    expect((await db.query(`update public.profiles set full_name = 'hack' where id = $1 returning id`, [sA])).rows).toHaveLength(0);
    await db.exec('reset role');
    expect((await one(`select title from public.exams where id = $1`, [examA])).title).toBe('Đề A');
  });

  it('không tạo được dữ liệu mạo danh chủ sở hữu hoặc dùng đề / lớp của người khác', async () => {
    await db.exec('set role authenticated');
    await as(tB);
    await expect(db.query(`insert into public.exams (title, owner_id) values ('x', $1)`, [tA])).rejects.toThrow(/row-level security/);
    // bài giao của B nhưng dùng đề của A, hoặc lớp của A
    await expect(db.query(`insert into public.assignments (exam_id, class_id, title, opens_at, duration_minutes)
                           values ($1, $2, 'x', now(), 10)`, [examA, classB])).rejects.toThrow(/OWNER_MISMATCH/);
    await expect(db.query(`insert into public.assignments (exam_id, class_id, title, opens_at, duration_minutes)
                           values ($1, $2, 'x', now(), 10)`, [examB, classA])).rejects.toThrow(/OWNER_MISMATCH/);
    // chuyển học sinh của B vào lớp của A
    await expect(db.query(`update public.profiles set class_id = $1 where id = $2`, [classA, sB])).rejects.toThrow(/OWNER_MISMATCH/);
    await db.exec('reset role');
  });

  it('revoke_sessions và regrade_exam chỉ dùng cho dữ liệu của mình; admin dùng được cho tất cả', async () => {
    await db.exec('set role authenticated');
    await as(tB);
    await expect(db.query(`select public.revoke_sessions($1)`, [sA])).rejects.toThrow(/FORBIDDEN/);
    await expect(db.query(`select public.regrade_exam($1)`, [examA])).rejects.toThrow(/FORBIDDEN/);
    await db.query(`select public.revoke_sessions($1)`, [sB]);
    await db.query(`select public.regrade_exam($1)`, [examB]);
    await as(adm);
    await db.query(`select public.revoke_sessions($1)`, [sA]);
    expect((await db.query(`select * from public.exams`)).rows.length).toBeGreaterThanOrEqual(2);
    await db.exec('reset role');
  });

  it('học sinh của giáo viên khác: bài giới hạn lớp bị chặn, bài mở không bị kéo vào lớp', async () => {
    const codeB = (await one(`select code from public.assignments where id = $1`, [asgB])).code;
    await db.query(`update public.assignments set restrict_to_class = true where id = $1`, [asgB]);
    await db.exec('set role authenticated');
    await as(sA);
    await expect(db.query(`select public.start_attempt($1)`, [codeB])).rejects.toThrow(/WRONG_CLASS/);
    await db.exec('reset role');
    await db.query(`update public.assignments set restrict_to_class = false where id = $1`, [asgB]);
    await db.exec('set role authenticated');
    await as(sA);
    await db.query(`select public.start_attempt($1)`, [codeB]);
    await db.exec('reset role');
    // học sinh A không bị xếp vào lớp của B
    expect((await one(`select class_id from public.profiles where id = $1`, [sA])).class_id).toBeNull();
  });

  it('Storage: giáo viên chỉ ghi vào thư mục mang id của mình', async () => {
    await db.exec('set role authenticated');
    await as(tB);
    await db.query(`insert into storage.objects (bucket_id, name) values ('question-images', $1)`, [`${tB}/exam1/a.png`]);
    await expect(db.query(`insert into storage.objects (bucket_id, name) values ('question-images', $1)`, [`${tA}/exam1/a.png`]))
      .rejects.toThrow(/row-level security/);
    await expect(db.query(`insert into storage.objects (bucket_id, name) values ('question-images', 'cu/khong-so-huu.png')`))
      .rejects.toThrow(/row-level security/);
    await db.exec('reset role');
  });
});

describe('mã mời giáo viên', () => {
  const ins = (code: string, extra = '') => db.query(`insert into public.teacher_invites (code, ${extra ? extra.split('=')[0] + ',' : ''} max_uses) values ($1, ${extra ? extra.split('=')[1] + ',' : ''} 2)`, [code]);
  const use = async (code: string) => (await one<{ ok: boolean }>(`select public.use_teacher_invite($1) ok`, [code])).ok;

  it('dùng đến hết lượt rồi chặn; hoàn lượt được', async () => {
    await ins('abcdefghjk');
    expect([await use('ABCDEFGHJK'), await use('abcdefghjk'), await use('abcdefghjk')]).toEqual([true, true, false]);
    await db.query(`select public.release_teacher_invite('abcdefghjk')`);
    expect(await use('abcdefghjk')).toBe(true);
  });

  it('mã hết hạn hoặc không tồn tại bị từ chối', async () => {
    await ins('mnpqrstuvw', `expires_at = now() - interval '1 minute'`);
    expect(await use('mnpqrstuvw')).toBe(false);
    expect(await use('zzzzzzzzzz')).toBe(false);
  });

  it('người dùng thường không đọc được bảng, không gọi được hàm', async () => {
    await db.exec('set role authenticated');
    await as(null);
    expect((await db.query(`select * from public.teacher_invites`)).rows).toHaveLength(0);
    await expect(db.query(`select public.use_teacher_invite('abcdefghjk')`)).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
  });
});
