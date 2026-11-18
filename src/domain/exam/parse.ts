// Phân giải word/document.xml của đề .docx theo mẫu quy ước (spec §3).
// Đầu ra: câu hỏi với nội dung "văn bản xen LaTeX trong \( … \)" và token ảnh ⟦img:<rId>⟧.
import { decodeXml, ommlToLatex, prettifyPlainMath } from './math';
import type { ParseResult, ParsedChoice, ParsedQuestion, QType } from './types';

interface Line { text: string; marks: boolean[] }

function isRed(hex: string) {
  if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return r >= 0xc0 && g < 0x60 && b < 0x60;
}

function readLines(xml: string) {
  const lines: Line[] = [];
  const stats = { omml: 0, ole: 0, images: 0, shapes: 0 };
  const body = xml.slice(Math.max(0, xml.indexOf('<w:body')));
  for (const pm of body.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
    let cur: Line = { text: '', marks: [] };
    const push = (t: string, mark: boolean) => { for (const ch of t) { cur.text += ch; cur.marks.push(mark); } };
    for (const m of pm[0].matchAll(/<w:r[ >][\s\S]*?<\/w:r>|<m:oMath>[\s\S]*?<\/m:oMath>/g)) {
      const chunk = m[0];
      if (chunk.startsWith('<m:oMath')) { stats.omml++; push(`\\(${ommlToLatex(chunk)}\\)`, false); continue; }
      const rpr = (chunk.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/) || [, ''])[1] as string;
      const u = rpr.match(/<w:u w:val="(\w+)"/);
      const c = rpr.match(/<w:color w:val="(\w+)"/);
      const mark = (!!u && u[1] !== 'none') || (!!c && isRed(c[1]));
      if (/<w:object/.test(chunk)) {
        stats.ole++;
        const rid = chunk.match(/<v:imagedata[^>]*r:id="([^"]+)"/);
        push(rid ? `⟦img:${rid[1]}⟧` : '⟦MathType⟧', false);
      }
      if (/<w:drawing/.test(chunk) || /<w:pict/.test(chunk) && !/<w:object/.test(chunk)) {
        const blip = chunk.match(/<a:blip[^>]*r:embed="([^"]+)"/) || chunk.match(/<v:imagedata[^>]*r:id="([^"]+)"/);
        if (blip) { stats.images++; push(`⟦img:${blip[1]}⟧`, false); }
        else { stats.shapes++; push('⟦shape⟧', false); }
      }
      for (const t of chunk.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>|<w:cr\/>/g)) {
        if (t[0] === '<w:tab/>') push('\t', mark);
        else if (t[0] === '<w:br/>' || t[0] === '<w:cr/>') { lines.push(cur); cur = { text: '', marks: [] }; }
        else push(decodeXml(t[1]), mark);
      }
    }
    lines.push(cur);
  }
  return { lines, stats };
}

const marked = (text: string, marks: boolean[]) => [...text].some((ch, i) => ch.trim() && marks[i]);

function splitLabels(line: Line, re: RegExp): ParsedChoice[] {
  const starts = [...line.text.matchAll(re)].map((m) => ({ idx: m.index! + m[1].length, label: m[2], len: m[0].length - m[1].length }));
  return starts.map((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].idx : line.text.length;
    return {
      label: s.label,
      text: line.text.slice(s.idx + s.len, end).trim(),
      marked: marked(line.text.slice(s.idx, end), line.marks.slice(s.idx, end)),
    };
  });
}

const OPT_RE = /(^|\s)([A-D])[.)]\s+/g;
const STMT_RE = /(^|\s)([a-d])\)\s+/g;

export function normTF(s: string): string | null {
  const t = s.trim().toUpperCase().replace(/D/g, 'Đ');
  return /^[ĐS]{4}$/.test(t) ? t : null;
}
export function normNum(s: string | null | undefined): number | null {
  const t = String(s ?? '').trim().replace(',', '.');
  return /^-?\d*\.?\d+$/.test(t) ? Number(t) : null;
}

export function parseDocumentXml(xml: string): ParseResult {
  const { lines, stats } = readLines(xml);
  const raw: (Omit<ParsedQuestion, 'type' | 'sources' | 'errors' | 'warnings' | 'solution'>)[] = [];
  const table: Record<number, string> = {};
  const solKey: Record<number, string> = {};
  const solution: Record<number, string> = {};
  const errors: string[] = [];
  let mode: 'body' | 'tail' | 'table' | 'solution' = 'body';
  let q: (typeof raw)[number] | null = null;
  let part: string | null = null;
  let solN: number | null = null;

  for (const line of lines) {
    const text = line.text.trim();
    if (!text) continue;
    if (mode === 'body') {
      if (/^HẾT\b/iu.test(text) || /^[-–—\s]*HẾT[-–—\s]*$/iu.test(text)) { mode = 'tail'; continue; }
      const pm = text.match(/^PHẦN\s+([IVX]+|\d+)\b/iu);
      if (pm) { part = pm[1].toUpperCase(); continue; }
      const qm = line.text.match(/^\s*Câu\s*(\d+)\s*[:.]\s*/iu);
      if (qm) {
        q = { n: +qm[1], part, stem: line.text.slice(qm[0].length).trim(), options: [], statements: [] };
        raw.push(q);
        continue;
      }
      if (!q) continue;
      const opts = /^[A-D][.)]\s/.test(text) ? splitLabels(line, OPT_RE) : [];
      const stmts = !opts.length && /^[a-d]\)\s/.test(text) ? splitLabels(line, STMT_RE) : [];
      if (opts.length) q.options.push(...opts);
      else if (stmts.length) q.statements.push(...stmts);
      else if (q.options.length) q.options[q.options.length - 1].text += '\n' + text;
      else if (q.statements.length) q.statements[q.statements.length - 1].text += '\n' + text;
      else q.stem += (q.stem ? '\n' : '') + text;
      continue;
    }
    if (/^BẢNG ĐÁP ÁN/iu.test(text)) { mode = 'table'; continue; }
    if (/^(HƯỚNG DẪN GIẢI|LỜI GIẢI)/iu.test(text)) { mode = 'solution'; continue; }
    if (mode === 'table') {
      for (const m of text.matchAll(/(\d+)\s*[.:)]\s*(\S+)/g)) table[+m[1]] = m[2];
    } else if (mode === 'solution') {
      const sm = text.match(/^Câu\s*(\d+)\s*[:.]\s*([\s\S]*)$/iu);
      if (sm) {
        solN = +sm[1];
        let rest = sm[2];
        const km = rest.match(/^Đáp án\s*:?\s*([A-D]|[ĐSDđsd]{4}|-?\d+(?:[.,]\d+)?(?:\|-?\d+(?:[.,]\d+)?)*)(?=[\s.]|$)\.?\s*/iu);
        if (km) { solKey[solN] = km[1]; rest = rest.slice(km[0].length); }
        solution[solN] = rest.trim();
      } else if (solN != null) solution[solN] += '\n' + text;
    }
  }

  const seen = new Set<number>();
  const questions: ParsedQuestion[] = raw.map((r, i) => {
    const errs: string[] = [], warns: string[] = [];
    if (seen.has(r.n)) errs.push(`Trùng số câu ${r.n}`);
    seen.add(r.n);
    if (i > 0 && r.n !== raw[i - 1].n + 1) warns.push(`Số câu nhảy từ ${raw[i - 1].n} lên ${r.n}`);
    const type: QType = r.options.length ? 'mcq' : r.statements.length ? 'tf' : 'short';
    const src: Record<string, string> = {};
    if (type === 'mcq') {
      if (r.options.length !== 4) errs.push(`Có ${r.options.length} phương án, cần đúng 4 (A–D)`);
      const mk = r.options.filter((o) => o.marked).map((o) => o.label);
      if (mk.length > 1) errs.push(`Gạch chân/tô đỏ ${mk.length} phương án (${mk.join(', ')})`);
      if (mk.length === 1) src['gạch chân'] = mk[0];
      if (table[r.n]) src['bảng đáp án'] = table[r.n].toUpperCase();
      if (solKey[r.n]) src['lời giải'] = solKey[r.n].toUpperCase();
      for (const [k, v] of Object.entries(src)) if (!/^[A-D]$/.test(v)) errs.push(`Đáp án "${v}" ở ${k} không phải A–D`);
    } else if (type === 'tf') {
      if (r.statements.length !== 4) errs.push(`Có ${r.statements.length} ý, cần đúng 4 (a–d)`);
      if (r.statements.some((s) => s.marked)) src['gạch chân'] = r.statements.map((s) => (s.marked ? 'Đ' : 'S')).join('');
      if (table[r.n]) src['bảng đáp án'] = normTF(table[r.n]) ?? `?${table[r.n]}`;
      if (solKey[r.n]) src['lời giải'] = normTF(solKey[r.n]) ?? `?${solKey[r.n]}`;
      for (const [k, v] of Object.entries(src)) if (v.startsWith('?')) errs.push(`Đáp án "${v.slice(1)}" ở ${k} không đúng dạng 4 chữ Đ/S`);
    } else {
      const acc = (s: string) => s.split('|').map((x) => x.trim()).filter(Boolean).join('|');
      if (table[r.n]) src['bảng đáp án'] = acc(table[r.n]);
      if (solKey[r.n]) src['lời giải'] = acc(solKey[r.n]);
      for (const [k, v] of Object.entries(src))
        for (const a of v.split('|')) if (normNum(a) === null) errs.push(`Đáp án "${a}" ở ${k} không phải số`);
    }
    let answer: string | string[] | undefined;
    const vals = Object.values(src);
    if (!vals.length) errs.push('Không tìm thấy đáp án (bảng đáp án, "Đáp án …" trong lời giải, hoặc gạch chân)');
    else {
      const canon = (v: string) => (type === 'short' ? v.split('|').map(normNum).sort().join('|') : v);
      if (new Set(vals.map(canon)).size > 1)
        errs.push('Đáp án mâu thuẫn: ' + Object.entries(src).map(([k, v]) => `${k} = ${v}`).join('; '));
      else if (!errs.some((e) => e.startsWith('Đáp án "')))
        answer = type === 'short' ? [...vals].sort((a, b) => b.length - a.length)[0].split('|') : vals[0];
    }
    if (/⟦shape⟧/.test(r.stem + r.options.map((o) => o.text).join('') + r.statements.map((s) => s.text).join('')))
      errs.push('Có hình vẽ bằng Shapes của Word: hãy chụp/dán lại thành ảnh');
    const fix = (c: ParsedChoice): ParsedChoice => ({ ...c, text: prettifyPlainMath(c.text) ?? '' });
    return {
      n: r.n, part: r.part, type,
      stem: prettifyPlainMath(r.stem) ?? '',
      options: r.options.map(fix), statements: r.statements.map(fix),
      sources: src, answer, solution: prettifyPlainMath(solution[r.n] ?? null), errors: errs, warnings: warns,
    };
  });

  for (const n of Object.keys(table)) if (!seen.has(+n)) errors.push(`Bảng đáp án có câu ${n} nhưng đề không có câu này`);
  if (!questions.length) errors.push('Không tìm thấy câu hỏi nào. Mỗi câu phải bắt đầu bằng "Câu 1:", "Câu 2:"…');
  return { stats, errors, questions };
}
