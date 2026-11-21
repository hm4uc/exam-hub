// Tạo (hoặc đặt lại mật khẩu) tài khoản quản trị hệ thống (role = 'admin', truy cập /admin và /gv).
// Chạy: node scripts/create-admin.mjs <tên-đăng-nhập> "<Họ tên>" <mật-khẩu>
import { createClient } from '@supabase/supabase-js';
import { readEnv } from './lib.mjs';

const [username, fullName, password] = process.argv.slice(2);
if (!username || !fullName || !password) {
  console.error('Cách dùng: node scripts/create-admin.mjs <tên-đăng-nhập> "<Họ tên>" <mật-khẩu>');
  process.exit(1);
}
if (!/^[a-z0-9._]{3,30}$/.test(username)) { console.error('Tên đăng nhập: 3–30 ký tự a-z, 0-9, dấu chấm, gạch dưới.'); process.exit(1); }
if (password.length < 6) { console.error('Mật khẩu cần ít nhất 6 ký tự.'); process.exit(1); }

const env = { ...readEnv('.env.local'), ...process.env };
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = `${username}@hs.local`;

const { data: existing } = await admin.from('profiles').select('id').ilike('username', username).maybeSingle();
let id = existing?.id;
if (id) {
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) throw error;
  console.log('Đã có tài khoản này: đặt lại mật khẩu.');
} else {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, full_name: fullName } });
  if (error) throw error;
  id = data.user.id;
}
const { error } = await admin.from('profiles').update({ role: 'admin', full_name: fullName, class_id: null, must_change_password: false }).eq('id', id);
if (error) throw error;
console.log(`✓ Quản trị "${fullName}" đăng nhập bằng tên: ${username} (màn quản lý: /admin)`);
