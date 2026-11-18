// Cài đặt project Supabase qua Management API (không cần Supabase CLI hay mật khẩu DB):
//   1. lấy URL + khoá API → ghi .env.local
//   2. cấu hình Auth: tắt đăng ký công khai (chỉ server tạo tài khoản), không cần xác nhận email
//   3. chạy các migration trong supabase/migrations chưa chạy
// Cần trong .env.deploy: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF
// Chạy: node scripts/setup-supabase.mjs            (cả 3 bước)
//       node scripts/setup-supabase.mjs --only=migrate   (CI/CD: chỉ chạy migration)
//       node scripts/setup-supabase.mjs --only=keys      (CI/CD: chỉ lấy khoá cho smoke test)
// Biến môi trường của tiến trình (GitHub Actions secrets) được ưu tiên hơn .env.deploy.
import { readdirSync, readFileSync } from 'node:fs';
import { mask, mergeEnv, need, readEnv } from './lib.mjs';

const env = { ...readEnv('.env.deploy'), ...Object.fromEntries(['SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROJECT_REF', 'SITE_URL'].filter((k) => process.env[k]).map((k) => [k, process.env[k]])) };
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const step = (name) => !only || only === name;
const token = need(env, 'SUPABASE_ACCESS_TOKEN', 'Tạo ở https://supabase.com/dashboard/account/tokens');
const ref = need(env, 'SUPABASE_PROJECT_REF', 'Là chuỗi trong URL dashboard: supabase.com/dashboard/project/<ref>');
const API = 'https://api.supabase.com/v1';

async function api(method, path, body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}
const sql = (query) => api('POST', `/projects/${ref}/database/query`, { query });

// 1. Project + khoá
const project = await api('GET', `/projects/${ref}`);
console.log(`Project: ${project.name} (${project.region}), trạng thái ${project.status}`);
if (project.status !== 'ACTIVE_HEALTHY') console.warn('⚠ Project chưa ở trạng thái ACTIVE_HEALTHY, có thể đang khởi tạo hoặc bị tạm dừng.');

if (step('keys')) {
let keys = await api('GET', `/projects/${ref}/api-keys?reveal=true`);
const pick = (pred) => keys.find(pred)?.api_key;
let publishable = pick((k) => k.type === 'publishable') ?? pick((k) => k.name === 'anon');
let secret = pick((k) => k.type === 'secret') ?? pick((k) => k.name === 'service_role');
if (!publishable) await api('POST', `/projects/${ref}/api-keys`, { type: 'publishable', name: 'default' });
if (!secret) await api('POST', `/projects/${ref}/api-keys?reveal=true`, { type: 'secret', name: 'default', secret_jwt_template: { role: 'service_role' } });
if (!publishable || !secret) {
  keys = await api('GET', `/projects/${ref}/api-keys?reveal=true`);
  publishable ??= pick((k) => k.type === 'publishable');
  secret ??= pick((k) => k.type === 'secret');
}
if (!publishable || !secret) throw new Error('Không lấy được khoá API của project.');
mergeEnv('.env.local', {
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: publishable,
  SUPABASE_SERVICE_ROLE_KEY: secret,
});
if (process.env.GITHUB_ACTIONS) for (const k of [publishable, secret]) console.log(`::add-mask::${k}`);
console.log(`✓ Đã ghi .env.local (khoá công khai ${mask(publishable)}, khoá bí mật ${mask(secret)})`);
}

// 2. Auth
if (step('auth')) {
await api('PATCH', `/projects/${ref}/config/auth`, {
  disable_signup: true,
  mailer_autoconfirm: true,
  password_min_length: 6,
  ...(env.SITE_URL ? { site_url: env.SITE_URL } : {}),
});
console.log('✓ Auth: tắt đăng ký công khai, không gửi email xác nhận');
}
if (!step('migrate')) process.exit(0);

// 3. Migration
await sql(`create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, name text, statements text[]);`);
const applied = new Set((await sql('select version from supabase_migrations.schema_migrations')).map((r) => r.version));
for (const f of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) {
  const version = f.split('_')[0];
  if (applied.has(version)) { console.log(`  · đã có ${f}`); continue; }
  process.stdout.write(`  → chạy ${f} … `);
  await sql(readFileSync(`supabase/migrations/${f}`, 'utf8'));
  await sql(`insert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${f.replace(/'/g, "''")}')`);
  console.log('xong');
}
const cron = await sql(`select jobname, schedule from cron.job`).catch(() => []);
console.log(`✓ Migration xong. Lịch pg_cron: ${cron.map((j) => `${j.jobname} (${j.schedule})`).join(', ') || 'không có'}`);
