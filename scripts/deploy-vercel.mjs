// Triển khai lên Vercel bằng Vercel CLI + token (không cần GitHub).
//   1. tạo/liên kết project "exam-hub"   2. đặt biến môi trường production   3. deploy production
// Cần: .env.deploy có VERCEL_TOKEN; .env.local đã có khoá Supabase (chạy setup-supabase.mjs trước).
// Chạy: node scripts/deploy-vercel.mjs
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mergeEnv, need, readEnv } from './lib.mjs';

const deploy = readEnv('.env.deploy');
const local = readEnv('.env.local');
const token = need(deploy, 'VERCEL_TOKEN', 'Tạo ở https://vercel.com/account/settings/tokens');
const project = deploy.VERCEL_PROJECT || 'exam-hub';
for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])
  if (!local[k]) { console.error(`Thiếu ${k} trong .env.local. Chạy node scripts/setup-supabase.mjs trước.`); process.exit(1); }

const CLI = ['--yes', 'vercel@66.1.0'];
function vercel(args, input) {
  const r = spawnSync('npx', [...CLI, ...args, '--token', token, ...(deploy.VERCEL_SCOPE ? ['--scope', deploy.VERCEL_SCOPE] : [])], {
    input, encoding: 'utf8', shell: process.platform === 'win32', stdio: [input == null ? 'inherit' : 'pipe', 'pipe', 'pipe'],
  });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

console.log(`→ Liên kết project Vercel "${project}"`);
let r = vercel(['link', '--yes', '--project', project]);
if (!r.ok) { console.error(r.out); process.exit(1); }

const cronSecret = local.CRON_SECRET || randomBytes(24).toString('hex');
mergeEnv('.env.local', { CRON_SECRET: cronSecret });
const vars = {
  NEXT_PUBLIC_SUPABASE_URL: local.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: local.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: local.SUPABASE_SERVICE_ROLE_KEY,
  CRON_SECRET: cronSecret,
};
for (const [k, v] of Object.entries(vars)) {
  r = vercel(['env', 'add', k, 'production', '--force', ...(k.startsWith('NEXT_PUBLIC') ? [] : ['--sensitive'])], v);
  console.log(`  ${r.ok ? '✓' : '✗'} biến ${k}`);
  if (!r.ok) { console.error(r.out); process.exit(1); }
}

console.log('→ Deploy production (2–4 phút)…');
r = vercel(['deploy', '--prod', '--yes']);
if (!r.ok) { console.error(r.out); process.exit(1); }
const url = r.out.match(/https:\/\/[^\s]+\.vercel\.app/g)?.pop();
console.log(`✓ Đã deploy: ${url ?? '(xem trong dashboard Vercel)'}`);
