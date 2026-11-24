// Công thức MathType trong .docx là đối tượng OLE (word/embeddings/oleObjectN.bin) kèm ảnh xem trước WMF/EMF.
// Khi tác giả gõ công thức bằng ngôn ngữ TeX của MathType, luồng "Equation Native" còn lưu sẵn mã TeX
// ("TeX Input Language" + chuỗi TeX). Lấy mã đó cho kết quả chính xác và sửa được trên web; không có thì
// dùng ảnh xem trước (PNG/JPEG) như trước đây.
import * as CFB from 'cfb';
import type JSZip from 'jszip';
import { renderRich } from './render';
import type { ParseResult } from './types';

const TEX_MARKER = 'TeX Input Language\0';

/** Mã TeX lưu trong luồng "Equation Native" của đối tượng MathType; null nếu không có. */
export function texFromMathTypeBin(data: Uint8Array): string | null {
  let stream: Uint8Array | undefined;
  try {
    const entry = CFB.find(CFB.read(data, { type: 'array' }), 'Equation Native');
    stream = entry?.content as Uint8Array | undefined;
  } catch {
    return null;
  }
  if (!stream) return null;
  // Không dùng Buffer: hàm này chạy cả trong trình duyệt của giáo viên.
  const text = Array.from(stream, (b) => String.fromCharCode(b)).join('');
  const at = text.indexOf(TEX_MARKER);
  if (at < 0) return null;
  const start = at + TEX_MARKER.length;
  const end = text.indexOf('\0', start);
  const tex = text.slice(start, end < 0 ? undefined : end).trim();
  return tex || null;
}

const OLE_TOKEN = /⟦ole:([^|⟧]*)\|([^⟧]*)⟧/g;

/**
 * Thay token ⟦ole:<rIdĐốiTượng>|<rIdẢnhXemTrước>⟧ bằng công thức LaTeX (nếu đọc được và KaTeX vẽ được),
 * nếu không thì bằng ảnh xem trước ⟦img:…⟧, nếu không có nữa thì ⟦MathType⟧ (bị báo lỗi ở bước sau).
 */
export async function resolveMathType(res: ParseResult, zip: JSZip): Promise<void> {
  const used = new Set<string>();
  const each = (fn: (s: string) => string) => {
    for (const q of res.questions) {
      q.stem = fn(q.stem);
      q.options.forEach((o) => { o.text = fn(o.text); });
      q.statements.forEach((o) => { o.text = fn(o.text); });
      if (q.solution) q.solution = fn(q.solution);
    }
  };
  each((s) => { for (const m of s.matchAll(OLE_TOKEN)) used.add(m[1]); return s; });
  if (!used.size) return;

  const rels = await zip.file('word/_rels/document.xml.rels')?.async('string');
  const target = new Map<string, string>();
  for (const m of rels?.matchAll(/<Relationship\s[^>]*>/g) ?? []) {
    const id = m[0].match(/Id="([^"]+)"/)?.[1];
    const t = m[0].match(/Target="([^"]+)"/)?.[1];
    if (id && t) target.set(id, t.startsWith('/') ? t.slice(1) : `word/${t.replace(/^\.\//, '')}`);
  }
  const tex = new Map<string, string | null>();
  for (const id of used) {
    const path = target.get(id);
    const file = path ? zip.file(path) : null;
    const found = file ? texFromMathTypeBin(await file.async('uint8array')) : null;
    // KaTeX phải vẽ được; không vẽ được thì để ảnh xem trước.
    tex.set(id, found && !renderRich(`\\(${found}\\)`).errors.length ? found : null);
  }
  each((s) => s.replace(OLE_TOKEN, (_m, id: string, preview: string) => {
    const t = tex.get(id);
    return t ? `\\(${t}\\)` : preview ? `⟦img:${preview}⟧` : '⟦MathType⟧';
  }));
}
