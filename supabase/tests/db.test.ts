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
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create schema cron;
create function cron.schedule(a text, b text, c text) returns int language sql as $$ select 1 $$;
`;

let db: PGlite;
const as = async (uid: string | null) => db.exec(`select set_config('test.uid', '${uid ?? ''}', false)`);
const one = async <T = any>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

async function mkUser(username: string, full_name: string, class_id?: string) {
  const r = await one<{ id: string }>(
    `insert into auth.users (raw_user_meta_data) values ($1) returning id`,
    [JSON.stringify({ username, full_name, class_id: class_id ?? '' })],
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
                 grant all on all tables in schema public to anon, authenticated;`);
});

afterEach(async () => { await db.exec('reset role'); });

describe('schema + RPC', () => {
  let teacher: string, s1: string, s2: string, classA: string, classB: string, exam: string, q: Record<string, string> = {};

  it('tạo dữ liệu', async () => {
    teacher = await mkUser('co.giao', 'Cô Giáo');
    await db.query(`update public.profiles set role = 'teacher' where id = $1`, [teacher]);
    classA = (await one(`insert into public.classes (name, school_year) values ('10A1','2026-2027') returning id`)).id;
    classB = (await one(`insert into public.classes (name, school_year) values ('10A2','2026-2027') returning id`)).id;
    s1 = await mkUser('An.Nguyen', 'Nguyễn Văn An');           // chưa có lớp
    s2 = await mkUser('binh', 'Trần Bình', classB);
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
    code = (await one(`insert into public.assignments (exam_id, class_id, title, opens_at, closes_at, duration_minutes, access_password)
             values ($1,$2,'Kiểm tra 15 phút', now() - interval '1 minute', now() + interval '1 day', 15, 'abc') returning code`, [exam, classA])).code;
    expect(code).toMatch(/^[a-z2-9]{6}$/);

    await db.exec('set role authenticated');
    await as(s1);
    const info = (await one(`select public.assignment_info($1) j`, [code.toUpperCase()])).j;
    expect(info.state).toBe('open');
    expect(info.has_password).toBe(true);
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

  it('học sinh lớp khác bị chặn', async () => {
    await db.exec('set role authenticated');
    await as(s2);
    await expect(db.query(`select public.start_attempt($1, 'abc')`, [code])).rejects.toThrow(/WRONG_CLASS/);
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

  it('anon không gọi được RPC', async () => {
    await db.exec('set role anon');
    await expect(db.query(`select public.my_assignments()`)).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
  });
});
