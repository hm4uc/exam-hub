// Tải toàn bộ các bucket Storage (exam-files, question-images) về thư mục chỉ định, giữ nguyên đường dẫn.
// Dùng trong .github/workflows/backup.yml: node scripts/backup-storage.mjs <thư-mục-đích>
// Cần: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (secret của GitHub Actions).
import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const BUCKETS = ['exam-files', 'question-images'];
const dest = process.argv[2];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!dest || !url || !key) {
  console.error('Cách dùng: NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/backup-storage.mjs <thư-mục>');
  process.exit(2);
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

/** Liệt kê mọi file (đệ quy qua "thư mục") của một bucket. */
async function listAll(bucket, prefix = '') {
  const files = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 100, offset });
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) files.push(...(await listAll(bucket, path)));
      else files.push(path);
    }
    if (data.length < 100) break;
  }
  return files;
}

let total = 0;
for (const bucket of BUCKETS) {
  const paths = await listAll(bucket);
  for (const path of paths) {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error) throw new Error(`Không tải được ${bucket}/${path}: ${error.message}`);
    const out = join(dest, bucket, path);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, Buffer.from(await data.arrayBuffer()));
    total++;
  }
  console.log(`${bucket}: ${paths.length} file`);
}
console.log(`Xong: ${total} file`);
