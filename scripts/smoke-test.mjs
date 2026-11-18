// Thử nhanh toàn bộ luồng trên project Supabase thật, tự dọn dữ liệu thử sau khi chạy.
// Cần .env.local (setup-supabase.mjs). Chạy: node scripts/smoke-test.mjs
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { readEnv } from './lib.mjs';

const env = { ...readEnv('.env.local'), ...process.env };
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, opts);
const tag = randomBytes(3).toString('hex');
const pass = randomBytes(9).toString('base64url');
let ok = 0, fail = 0;
const check = (name, cond, extra = '') => { cond ? ok++ : fail++; console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` (${extra})` : ''}`); };
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data; };

async function user(role) {
  const username = `smoke_${role}_${tag}`;
  const u = must(await admin.auth.admin.createUser({ email: `${username}@hs.local`, password: pass, email_confirm: true, user_metadata: { username, full_name: `Thử ${role}` } }), 'createUser').user;
  if (role === 'teacher') must(await admin.from('profiles').update({ role }).eq('id', u.id), 'set role');
  const c = createClient(URL, ANON, opts);
  must(await c.auth.signInWithPassword({ email: `${username}@hs.local`, password: pass }), 'signIn');
  return { id: u.id, c };
}

const ids = [];
let examId;
try {
  const t = await user('teacher'); ids.push(t.id);
  const s = await user('student'); ids.push(s.id);
  check('profile tự tạo bởi trigger, mặc định là học sinh', must(await s.c.from('profiles').select('role').single(), 'profile').role === 'student');
  check('is_teacher', must(await t.c.rpc('is_teacher'), 'is_teacher') === true);

  const cls = must(await t.c.from('classes').insert({ name: `Lớp thử ${tag}` }).select().single(), 'class');
  const exam = must(await t.c.from('exams').insert({ title: `Đề thử ${tag}`, status: 'published' }).select().single(), 'exam');
  examId = exam.id;
  must(await t.c.from('questions').insert([
    { exam_id: exam.id, position: 1, part: 'I', type: 'mcq', stem: 'x', stem_html: 'x', answer: 'B', choices: ['A', 'B', 'C', 'D'].map((l) => ({ label: l, text: l, html: l })) },
    { exam_id: exam.id, position: 2, part: 'II', type: 'tf', stem: 'y', stem_html: 'y', answer: 'ĐSĐS', choices: ['a', 'b', 'c', 'd'].map((l) => ({ label: l, text: l, html: l })) },
    { exam_id: exam.id, position: 3, part: 'III', type: 'short', stem: 'z', stem_html: 'z', choices: [], answer: ['0,5'] },
  ]), 'questions');
  const now = Date.now();
  const asg = must(await t.c.from('assignments').insert({
    exam_id: exam.id, class_id: cls.id, title: `Bài thử ${tag}`, opens_at: new Date(now - 60e3).toISOString(),
    closes_at: new Date(now + 3600e3).toISOString(), duration_minutes: 15, result_mode: 'score_answers',
  }).select().single(), 'assignment');
  check('mã bài giao 6 ký tự', /^[a-z2-9]{6}$/.test(asg.code), asg.code);

  // Học sinh không đọc trực tiếp được câu hỏi / đáp án
  const leak = await s.c.from('questions').select('answer');
  check('học sinh không đọc được bảng questions', (leak.data ?? []).length === 0);

  const info = must(await s.c.rpc('assignment_info', { p_code: asg.code }), 'assignment_info');
  check('assignment_info', info?.title === asg.title);
  const st = must(await s.c.rpc('start_attempt', { p_code: asg.code }), 'start_attempt');
  check('start_attempt trả 3 câu', st.questions.length === 3);
  check('đề gửi cho học sinh không có đáp án', !JSON.stringify(st.questions).includes('ĐSĐS') && !JSON.stringify(st.questions).includes('"answer"'));

  const q = Object.fromEntries(st.questions.map((x) => [x.type, x.id]));
  // Lưu qua REST giống trình duyệt (fetch keepalive)
  const { data: sess } = await s.c.auth.getSession();
  const r = await fetch(`${URL}/rest/v1/rpc/save_answers`, {
    method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${sess.session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_attempt: st.attempt_id, p_answers: { [q.mcq]: 'B', [q.tf]: 'ĐSSS', [q.short]: '0.5' }, p_tab_leaves: 2 }),
  });
  check('save_answers qua REST', r.ok, String(r.status));
  const sub = must(await s.c.rpc('submit_attempt', { p_attempt: st.attempt_id }), 'submit');
  const res = must(await s.c.rpc('attempt_result', { p_attempt: st.attempt_id }), 'result');
  // 0.25 + 0.5 (3/4 ý đúng) + 0.5 = 1.25 / 1.75 → 7.14
  check('chấm điểm', Number(res.score10 ?? res.score) > 0, JSON.stringify({ score: res.score, max: res.max_score, score10: res.score10 }).slice(0, 120));
  const again = must(await s.c.rpc('submit_attempt', { p_attempt: st.attempt_id }), 'submit again');
  check('bấm nộp lần nữa trả kết quả cũ, không chấm lại', Number(again.score) === Number(res.score));
  check('không lưu được đáp án sau khi nộp', (await s.c.rpc('save_answers', { p_attempt: st.attempt_id, p_answers: {} })).error != null);
  check('học sinh được xếp vào lớp', must(await s.c.from('profiles').select('class_id').single(), 'p').class_id === cls.id);
  const mine = must(await s.c.rpc('my_assignments'), 'my_assignments');
  check('my_assignments', JSON.stringify(mine).includes(asg.code));

  // Sửa đáp án → chấm lại tự động
  must(await t.c.from('questions').update({ answer: 'ĐSSS' }).eq('exam_id', exam.id).eq('type', 'tf'), 'update key');
  const after = must(await t.c.from('attempts').select('score').eq('id', st.attempt_id).single(), 'att');
  check('chấm lại khi sửa đáp án', Number(after.score) > Number(sub?.score ?? res.score), `${sub?.score ?? res.score} → ${after.score}`);

  check('giáo viên đăng xuất học sinh khỏi mọi máy', (await t.c.rpc('revoke_sessions', { p_user: s.id })).error == null);
  check('học sinh không gọi được revoke_sessions', (await s.c.rpc('revoke_sessions', { p_user: t.id })).error != null);
  const crons = await admin.rpc('finalize_expired');
  check('finalize_expired không cho người dùng thường gọi', (await s.c.rpc('finalize_expired')).error != null, crons.error ? 'admin cũng không gọi được (bình thường)' : '');

  const buckets = must(await admin.storage.listBuckets(), 'buckets').map((b) => b.id);
  check('bucket lưu ảnh và file đề', buckets.includes('exam-files') && buckets.includes('question-images'), buckets.join(','));
  const up = await t.c.storage.from('question-images').upload(`smoke/${tag}.txt`, new Blob(['x']), { contentType: 'text/plain' });
  check('giáo viên tải được ảnh lên', !up.error, up.error?.message);
  if (!up.error) await admin.storage.from('question-images').remove([`smoke/${tag}.txt`]);
  const up2 = await s.c.storage.from('question-images').upload(`smoke/${tag}-s.txt`, new Blob(['x']));
  check('học sinh không tải được file lên', !!up2.error);
} catch (e) {
  fail++; console.error('✗ Lỗi:', e.message);
} finally {
  if (examId) { await admin.from('assignments').delete().eq('exam_id', examId); await admin.from('exams').delete().eq('id', examId); }
  await admin.from('classes').delete().like('name', `Lớp thử ${tag}`);
  for (const id of ids) await admin.auth.admin.deleteUser(id);
  console.log(`\n${ok} đạt, ${fail} lỗi. Đã dọn dữ liệu thử.`);
  process.exit(fail ? 1 : 0);
}
