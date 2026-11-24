// Mở file .docx (ArrayBuffer) → phân giải + danh sách ảnh nhúng. Chạy được trong Web Worker và Node.
import JSZip from 'jszip';
import { resolveMathType } from './ole';
import { parseDocumentXml } from './parse';
import type { ParseResult } from './types';

export interface DocxImage {
  rId: string;
  /** đuôi file gốc: png, jpeg, gif, emf, wmf… */
  ext: string;
  data: Uint8Array;
  /** ảnh trình duyệt hiển thị được trực tiếp */
  displayable: boolean;
}

export interface DocxParse extends ParseResult { images: DocxImage[] }

const DISPLAYABLE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

export async function parseDocx(buf: ArrayBuffer | Uint8Array): Promise<DocxParse> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    throw new Error('File không phải .docx hợp lệ. Hãy lưu lại bằng Word dưới dạng "Word Document (.docx)".');
  }
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('Không đọc được nội dung file Word (thiếu word/document.xml).');
  const xml = await docFile.async('string');
  const res = parseDocumentXml(xml);
  await resolveMathType(res, zip);

  // Ảnh được tham chiếu trong đề
  const used = new Set<string>();
  for (const q of res.questions) {
    const all = [q.stem, q.solution ?? '', ...q.options.map((o) => o.text), ...q.statements.map((s) => s.text)].join(' ');
    for (const m of all.matchAll(/⟦img:([^⟧]+)⟧/g)) used.add(m[1]);
  }
  const images: DocxImage[] = [];
  const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('string');
  if (relsXml && used.size) {
    for (const m of relsXml.matchAll(/<Relationship\s[^>]*>/g)) {
      const id = m[0].match(/Id="([^"]+)"/)?.[1];
      const target = m[0].match(/Target="([^"]+)"/)?.[1];
      if (!id || !target || !used.has(id)) continue;
      const path = target.startsWith('/') ? target.slice(1) : `word/${target.replace(/^\.\//, '')}`;
      const f = zip.file(path);
      if (!f) continue;
      const ext = (path.split('.').pop() || '').toLowerCase();
      images.push({ rId: id, ext, data: await f.async('uint8array'), displayable: DISPLAYABLE.has(ext) });
    }
  }
  // Câu có ảnh không hiển thị được (MathType WMF/EMF) → cảnh báo
  const bad = new Set(images.filter((i) => !i.displayable).map((i) => i.rId));
  for (const q of res.questions) {
    const all = [q.stem, ...q.options.map((o) => o.text), ...q.statements.map((s) => s.text)].join(' ');
    const ids = [...all.matchAll(/⟦img:([^⟧]+)⟧/g)].map((m) => m[1]);
    if (ids.some((id) => bad.has(id)))
      q.errors.push('Có công thức MathType hoặc ảnh WMF/EMF chưa hiển thị được trên web. Hãy chuyển công thức sang Equation của Word (hoặc dán ảnh PNG) rồi tải lại.');
    if (all.includes('⟦MathType⟧')) q.errors.push('Có công thức MathType không đọc được ảnh xem trước.');
  }
  return { ...res, images };
}
