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
const check = (name, cond, extra = '') => { if (cond) ok++; else fail++; console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` (${extra})` : ''}`); };
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data; };

async function user(role, extra = {}, label = role) {
  const username = `smoke_${label}_${tag}`;
  const u = must(await admin.auth.admin.createUser({ email: `${username}@hs.local`, password: pass, email_confirm: true, user_metadata: { username, full_name: `Thử ${label}`, ...extra } }), 'createUser').user;
  if (role === 'teacher' || role === 'admin') must(await admin.from('profiles').update({ role }).eq('id', u.id), 'set role');
  const c = createClient(URL, ANON, opts);
  must(await c.auth.signInWithPassword({ email: `${username}@hs.local`, password: pass }), 'signIn');
  return { id: u.id, c };
}

const ids = [];
let examId;
try {
  const t = await user('teacher', { teacher_code: `smk${tag}` }); ids.push(t.id);
  const s = await user('student', { owner_id: t.id }); ids.push(s.id);
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
  const up = await t.c.storage.from('question-images').upload(`${t.id}/smoke-${tag}.txt`, new Blob(['x']), { contentType: 'text/plain' });
  check('giáo viên tải được ảnh lên', !up.error, up.error?.message);
  if (!up.error) await admin.storage.from('question-images').remove([`${t.id}/smoke-${tag}.txt`]);
  const up2 = await s.c.storage.from('question-images').upload(`smoke/${tag}-s.txt`, new Blob(['x']));
  check('học sinh không tải được file lên', !!up2.error);

  // Luồng mới: link tự do không lớp, không giờ đóng + khách không đăng nhập làm bài
  const quickAsg = must(await t.c.from('assignments').insert({
    exam_id: exam.id, class_id: null, title: `Link nhanh ${tag}`, opens_at: new Date(now - 60e3).toISOString(),
    closes_at: null, duration_minutes: 45, result_mode: 'score_answers', is_quick_link: true,
  }).select().single(), 'quick assignment');
  const anonClient = createClient(URL, ANON, opts);
  const gKey1 = `smoke-guest-1-${tag}`;
  const gKey2 = `smoke-guest-2-${tag}`;
  const gInfo = must(await anonClient.rpc('assignment_info', { p_code: quickAsg.code, p_guest_key: gKey1 }), 'guest assignment_info');
  check('khách xem được link tự do không cần đăng nhập', gInfo?.state === 'open' && gInfo?.class_name === null && gInfo?.closes_at === null);
  const gStart = must(await anonClient.rpc('start_attempt', { p_code: quickAsg.code, p_guest_key: gKey1, p_guest_name: '' }), 'guest start');
  check('khách để trống tên được gán tên mặc định', gStart?.guest_name === 'Học sinh #1', gStart?.guest_name);
  const gq = Object.fromEntries(gStart.questions.map((x) => [x.type, x.id]));
  const gr = await fetch(`${URL}/rest/v1/rpc/save_answers`, {
    method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_attempt: gStart.attempt_id, p_answers: { [gq.mcq]: 'B', [gq.short]: '0,5' }, p_tab_leaves: 1, p_guest_key: gKey1 }),
  });
  check('khách lưu đáp án qua REST (anon key)', gr.ok, String(gr.status));
  check('khách khác không sửa được bài của khách 1', (await anonClient.rpc('save_answers', { p_attempt: gStart.attempt_id, p_answers: {}, p_guest_key: gKey2 })).error != null);
  const gSub = must(await anonClient.rpc('submit_attempt', { p_attempt: gStart.attempt_id, p_guest_key: gKey1 }), 'guest submit');
  check('khách nộp bài & nhận kết quả', gSub?.is_guest === true && Number(gSub?.score) > 0, String(gSub?.score));

  // Luồng mới: bài gắn lớp bật restrict_to_class=true → chặn khách
  const lockedAsg = must(await t.c.from('assignments').insert({
    exam_id: exam.id, class_id: cls.id, restrict_to_class: true, title: `Giới hạn lớp ${tag}`,
    opens_at: new Date(now - 60e3).toISOString(), closes_at: null, duration_minutes: 15,
  }).select().single(), 'locked assignment');
  check('bài giới hạn lớp yêu cầu khách đăng nhập', (await anonClient.rpc('start_attempt', { p_code: lockedAsg.code, p_guest_key: gKey2 })).error?.message === 'LOGIN_REQUIRED');

  // Luồng mới: vai trò admin & RLS bảng trace_events
  // Các truy vấn nhúng của ứng dụng không được mơ hồ (PGRST201) — lỗi này từng khiến getMe trả rỗng và mọi người bị đăng xuất
  const meCols = 'id, role, username, full_name, class_id, teacher_code, is_locked, must_change_password, classes!profiles_class_id_fkey(name)';
  check('getMe (giáo viên) không lỗi nhúng', (await t.c.from('profiles').select(meCols).eq('id', t.id).maybeSingle()).error == null);
  check('getMe (học sinh) không lỗi nhúng', (await s.c.from('profiles').select(meCols).eq('id', s.id).maybeSingle()).error == null);
  check('trang Lớp không lỗi nhúng', (await t.c.from('classes').select('id, name, profiles!profiles_class_id_fkey(count), assignments(count)')).error == null);
  check('trang Tổng quan không lỗi nhúng', (await t.c.from('assignments').select('id, title, classes(name), attempts(count)')).error == null);
  check('trang Đề thi không lỗi nhúng', (await t.c.from('exams').select('id, title, questions(count), assignments(count)')).error == null);

  // Đa giáo viên: giáo viên thứ hai không thấy / không dùng được dữ liệu của giáo viên thứ nhất
  const t2 = await user('teacher', { teacher_code: `smj${tag}` }, 'teacher2'); ids.push(t2.id);
  check('giáo viên khác không thấy đề', ((await t2.c.from('exams').select('id').eq('id', exam.id)).data ?? []).length === 0);
  check('giáo viên khác không thấy học sinh', ((await t2.c.from('profiles').select('id').eq('id', s.id)).data ?? []).length === 0);
  check('giáo viên khác không sửa được đề', ((await t2.c.from('exams').update({ title: 'hack' }).eq('id', exam.id).select('id')).data ?? []).length === 0);
  check('không tạo được bài giao bằng đề của người khác', (await t2.c.from('assignments').insert({ exam_id: exam.id, title: 'x', opens_at: new Date().toISOString(), duration_minutes: 10 })).error != null);
  check('không tải được ảnh vào thư mục của người khác', (await t2.c.storage.from('question-images').upload(`${t.id}/smoke-${tag}-x.txt`, new Blob(['x']))).error != null);
  check('giáo viên khác không đăng xuất được học sinh của người khác', (await t2.c.rpc('revoke_sessions', { p_user: s.id })).error != null);
  check('rate_limit_hit không gọi được từ trình duyệt', (await s.c.rpc('rate_limit_hit', { p_key: 'x', p_window_seconds: 60, p_limit: 1 })).error != null);

  const adm = await user('admin'); ids.push(adm.id);
  check('admin thấy đề của mọi giáo viên', ((await adm.c.from('exams').select('id').eq('id', exam.id)).data ?? []).length === 1);
  const { data: traceRow } = await admin.from('trace_events').insert({ level: 'warn', category: 'exam', event: 'smoke_test', message: `smoke ${tag}` }).select('id').single();
  check('giáo viên không đọc được trace_events', ((await t.c.from('trace_events').select('id')).data ?? []).length === 0);
  check('admin đọc được trace_events', ((await adm.c.from('trace_events').select('id').eq('id', traceRow.id)).data ?? []).length === 1);
  if (traceRow?.id) await admin.from('trace_events').delete().eq('id', traceRow.id);
} catch (e) {
  fail++; console.error('✗ Lỗi:', e.message);
} finally {
  if (examId) { await admin.from('assignments').delete().eq('exam_id', examId); await admin.from('exams').delete().eq('id', examId); }
  await admin.from('classes').delete().like('name', `Lớp thử ${tag}`);
  for (const id of ids) await admin.auth.admin.deleteUser(id);
  console.log(`\n${ok} đạt, ${fail} lỗi. Đã dọn dữ liệu thử.`);
  process.exit(fail ? 1 : 0);
}
