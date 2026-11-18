// Tiện ích chung cho các script cài đặt. Đọc/ghi file .env đơn giản (KEY=VALUE).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export function readEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

export function mergeEnv(path, values) {
  const cur = readEnv(path);
  const next = { ...cur, ...values };
  writeFileSync(path, Object.entries(next).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
}

export function need(env, key, hint) {
  if (!env[key]) {
    console.error(`Thiếu ${key} trong .env.deploy. ${hint ?? ''}`);
    process.exit(1);
  }
  return env[key];
}

/** Không bao giờ in giá trị bí mật ra màn hình */
export const mask = (s) => (s ? `${s.slice(0, 6)}…(${s.length} ký tự)` : '(trống)');
