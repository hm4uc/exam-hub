// Phân giải word/document.xml của đề .docx theo mẫu quy ước (spec §3).
// Đầu ra: câu hỏi với nội dung "văn bản xen LaTeX trong \( … \)" và token ảnh ⟦img:<rId>⟧.
//
// Hiểu các cách trình bày phổ biến của đề Toán Việt Nam:
//  - số câu đánh lại từ 1 ở mỗi Phần (khoá câu theo Phần + số câu);
//  - bảng đáp án là bảng Word (ngang, dọc, bảng Đúng/Sai theo ý a–d) hoặc dòng "1. A  2. B";
//  - lời giải dạng "Câu 1: Đáp án A", "Câu 1 (B): …", "Câu 1: Đáp số: 6", "Câu 1: a) Đúng: … b) Sai: …";
//  - phần Tự luận được bỏ qua và báo lại.
import { decodeXml, ommlToLatex, prettifyPlainMath } from './math';
import type { ParseResult, ParsedChoice, ParsedQuestion, QType } from './types';

/** `row` có khi dòng là một hàng của bảng Word (mỗi phần tử là chữ của một ô). */
interface Line { text: string; marks: boolean[]; row?: string[] }

function isRed(hex: string) {
  if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return r >= 0xc0 && g < 0x60 && b < 0x60;
}

type Stats = { omml: number; ole: number; images: number; shapes: number };

/** Một đoạn <w:p> → một hoặc nhiều dòng (xuống dòng mềm <w:br/> tách dòng). */
function paragraphLines(pxml: string, stats: Stats): Line[] {
  const lines: Line[] = [];
  let cur: Line = { text: '', marks: [] };
  const push = (t: string, mark: boolean) => { for (const ch of t) { cur.text += ch; cur.marks.push(mark); } };
  for (const m of pxml.matchAll(/<w:r[ >][\s\S]*?<\/w:r>|<m:oMath>[\s\S]*?<\/m:oMath>/g)) {
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
  return lines;
}

/** Các khối cấp cao nhất theo thứ tự đọc: đoạn văn và bảng. Hàng của bảng thành một dòng có `row`. */
function readLines(xml: string) {
  const lines: Line[] = [];
  const stats: Stats = { omml: 0, ole: 0, images: 0, shapes: 0 };
  const body = xml.slice(Math.max(0, xml.indexOf('<w:body')));
  for (const bm of body.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>/g)) {
    if (!bm[0].startsWith('<w:tbl>')) { lines.push(...paragraphLines(bm[0], stats)); continue; }
    for (const rm of bm[0].matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)) {
      const row: Line = { text: '', marks: [], row: [] };
      let first = true;
      for (const cm of rm[0].matchAll(/<w:tc[ >][\s\S]*?<\/w:tc>/g)) {
        const cell: Line = { text: '', marks: [] };
        for (const pm of cm[0].matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g))
          for (const l of paragraphLines(pm[0], stats)) {
            if (cell.text && l.text) { cell.text += ' '; cell.marks.push(false); }
            cell.text += l.text; cell.marks.push(...l.marks);
          }
        if (!first) { row.text += '\t'; row.marks.push(false); }
        first = false;
        row.text += cell.text; row.marks.push(...cell.marks);
        row.row!.push(cell.text.trim());
      }
      if (row.row!.length) lines.push(row);
    }
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

const OPT_RE = /(^|\s)([A-F])[.)]\s+/g;
const STMT_RE = /(^|\s)([a-d])\)\s+/g;

/** Đáp án Đúng/Sai: 2–4 ý (đề THPT 4 ý; tiểu học, THCS có thể 2–3 ý). */
export function normTF(s: string): string | null {
  const t = s.trim().toUpperCase().replace(/D/g, 'Đ');
  return /^[ĐS]{2,4}$/.test(t) ? t : null;
}
/** Số thập phân (dấu , hoặc .) hoặc phân số a/b (đề SAT cho phép "3/4"). */
export function normNum(s: string | null | undefined): number | null {
  const t = String(s ?? '').trim().replace(/\s+/g, '').replace(',', '.');
  const f = t.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (f) return Number(f[2]) === 0 ? null : Number(f[1]) / Number(f[2]);
  return /^-?\d*\.?\d+$/.test(t) ? Number(t) : null;
}

// ───────────────────────── Phần, tiêu đề, đáp án ─────────────────────────

type Hint = QType | 'essay';

function hintOf(s: string): Hint | null {
  if (/tự luận/iu.test(s)) return 'essay';
  if (/trả lời ngắn/iu.test(s)) return 'short';
  if (/đúng\s*[-–/]?\s*sai/iu.test(s)) return 'tf';
  if (/nhiều\s+(?:phương án|lựa chọn)|trắc nghiệm/iu.test(s)) return 'mcq';
  return null;
}

/** "PHẦN II. …", "II. Phần trắc nghiệm đúng sai:", "Phần trắc nghiệm trả lời ngắn". id = null khi không có số La Mã. */
function partHeading(text: string): { id: string | null; hint: Hint | null } | null {
  if (text.length > 160) return null;
  const a = text.match(/^PHẦN\s+([IVX]+|\d+)\b\s*[.:)\-–]?\s*(.*)$/iu);
  if (a) return { id: a[1].toUpperCase(), hint: hintOf(a[2]) };
  const b = text.match(/^([IVX]{1,4})\s*[.:)]\s+(.*)$/u);
  if (b) { const hint = hintOf(b[2]); return hint ? { id: b[1], hint } : null; }
  if (/^Phần\s/iu.test(text)) { const hint = hintOf(text); return hint ? { id: null, hint } : null; }
  return null;
}

/** Tiêu đề phần đáp án / lời giải (không nhầm với câu hỏi bắt đầu bằng "Đáp án nào…"). */
const ANS_HEAD = /^(?:BẢNG\s+)?ĐÁP ÁN\b(?!\s*:)|^HƯỚNG DẪN\s+(?:GIẢI|CHẤM)|^LỜI GIẢI|^ANSWER KEY\b|^ANSWERS?\b(?!\s*:)|^(?:ANSWER )?(?:EXPLANATIONS?|SOLUTIONS?|RATIONALES?)\b/iu;
const SOL_HEAD = /HƯỚNG DẪN\s+(?:GIẢI|CHẤM)|LỜI GIẢI|EXPLANATIONS?|SOLUTIONS?|RATIONALES?/iu;
function isAnswerHeading(text: string) {
  if (text.length > 100 || /[?:]$/.test(text) || /^Câu\s*\d/iu.test(text)) return false;
  if (!ANS_HEAD.test(text)) return false;
  return text === text.toUpperCase() || text.split(/\s+/).length <= 7;
}

const NUM = '-?(?:\\d+(?:[.,]\\d+)?|[.,]\\d+)(?:/\\d+)?';
const KEY = `[A-F]|[ĐSDđsd]{2,4}|${NUM}(?:\\|${NUM})*`;
const KEY_ONLY = new RegExp(`^(?:${KEY})$`, 'iu');
const KEY_PREFIX = new RegExp(`^(?:Đáp án|Đáp số|ĐS|Chọn|Correct answer|Answer|Ans)\\s*[:：]?\\s*(${KEY})(?=[\\s.,;)]|$)[.]?\\s*`, 'iu');
const KEY_LINE = new RegExp(`^(?:\\s*\\d+\\s*[.:)]\\s*(?:${KEY})(?=\\s|$))+\\s*$`, 'iu');

type Kind = QType | 'other';
function kindOf(v: string): Kind {
  if (/^[A-F]$/i.test(v)) return 'mcq';
  if (/^[ĐSDđs]{2,4}$/iu.test(v)) return 'tf';
  if (new RegExp(`^${NUM}(?:\\|${NUM})*$`).test(v)) return 'short';
  return 'other';
}

/** Chuẩn hoá ô Đúng/Sai → "Đ" | "S". */
function tfCell(s: string): string | null {
  const t = s.trim().replace(/[.\s]/g, '').toLowerCase();
  if (['đúng', 'đ', 'true', 't'].includes(t)) return 'Đ';
  if (['sai', 's', 'false', 'f'].includes(t)) return 'S';
  return null;
}

/** Đáp án theo (loại, Phần, số câu). Số câu trùng giữa các Phần vẫn phân biệt được nhờ Phần và loại. */
class Keys {
  private m = new Map<string, string>();
  put(part: string | null, n: number, v: string) { this.m.set(`${kindOf(v)}|${part ?? ''}|${n}`, v); }
  get(type: QType, part: string | null, n: number, unambiguous: boolean): string | undefined {
    for (const k of [type, 'other']) {
      const exact = this.m.get(`${k}|${part ?? ''}|${n}`);
      if (exact !== undefined) return exact;
      if (!unambiguous) continue;
      for (const [key, v] of this.m) { const [kk, , nn] = key.split('|'); if (kk === k && +nn === n) return v; }
    }
    return undefined;
  }
}

/** Tách đáp án ở đầu lời giải: "(B)", "Đáp án B", "Đáp số: 6", hoặc "a) Đúng … b) Sai …" liền đoạn. */
function takeKey(rest: string, paren: string | undefined): { key?: string; rest: string } {
  const p = paren?.trim();
  if (p && KEY_ONLY.test(p)) return { key: p, rest: rest.trim() };
  const km = rest.match(KEY_PREFIX);
  if (km) return { key: km[1], rest: rest.slice(km[0].length).trim() };
  const tf = [...rest.matchAll(/(?:^|[\s.;:,])([a-d])\)\s*(Đúng|Sai)(?![\p{L}])/giu)];
  if (tf.length >= 2 && tf.every((m, i) => m[1].toLowerCase() === 'abcd'[i]))
    return { key: tf.map((m) => tfCell(m[2])).join(''), rest: rest.trim() };
  const t = rest.trim();
  if (t.length <= 14 && KEY_ONLY.test(t)) return { key: t, rest: '' };
  return { rest: t };
}

const HEADER_LABEL = /^(?:Câu|STT|Số câu)$/iu;
const VALUE_LABEL = /^(?:Đáp án|ĐA|Chọn|Kết quả|ĐS)$/iu;
const HEADER_CELL = /^(?:Câu\s*)?(\d+)$/iu;

type Style = 'cau' | 'question' | 'bai' | 'num';
const STYLE_START: Record<Style, RegExp> = {
  cau: /^\s*Câu\s*(\d+)\s*[:.]\s*()/iu,
  question: /^\s*(?:Question|Problem|Q)\s*#?(\d+)\s*[:.)]?(?:\s+|$)()/iu,
  bai: /^\s*Bài\s*(\d+)\s*[:.)]\s*()/iu,
  num: /^\s*(\d{1,3})\s*(?:[.)]\s+(?=\S)|$)()/u,
};
const STYLE_ENTRY: Record<Style, RegExp> = {
  cau: /^Câu\s*(\d+)\s*(?:\(([^)]{1,20})\))?\s*[:.]?\s*([\s\S]*)$/iu,
  question: /^(?:Question|Problem|Q)\s*#?(\d+)\s*(?:\(([^)]{1,20})\))?\s*[:.)]?\s*([\s\S]*)$/iu,
  bai: /^Bài\s*(\d+)\s*(?:\(([^)]{1,20})\))?\s*[:.)]?\s*([\s\S]*)$/iu,
  num: /^(\d{1,3})\s*(?:\(([^)]{1,20})\))?\s*[.)]\s*([\s\S]*)$/u,
};
function matchStart(style: Style, s: string): { n: number; len: number } | null {
  const m = s.match(STYLE_START[style]);
  return m ? { n: +m[1], len: m[0].length } : null;
}
/** Đề dùng kiểu đánh số nào: ưu tiên "Câu N"; không có thì "Question N", "Bài N", cuối cùng "1." (đề SAT). */
function detectStyle(lines: Line[]): Style {
  const count = (st: Style) => lines.filter((l) => !l.row && matchStart(st, l.text) && !KEY_LINE.test(l.text.trim())).length;
  if (count('cau') >= 1) return 'cau';
  if (count('question') >= 2) return 'question';
  if (count('bai') >= 2) return 'bai';
  return count('num') >= 2 ? 'num' : 'cau';
}

interface Sol { part: string | null; n: number; key?: string; text: string; used?: boolean }

export function parseDocumentXml(xml: string): ParseResult {
  const { lines, stats } = readLines(xml);
  const style = detectStyle(lines);
  type Raw = Omit<ParsedQuestion, 'type' | 'sources' | 'errors' | 'warnings' | 'solution'>;
  const raw: Raw[] = [];
  const tableKeys = new Keys();
  const sols: Sol[] = [];
  const errors: string[] = [];
  const notes: string[] = [];
  const partOfHint = new Map<Hint, string>();
  const partHint = new Map<string, Hint>();
  let mode: 'body' | 'tail' | 'ans' = 'body';
  let q: Raw | null = null;
  let part: string | null = null;       // Phần hiện tại (thân đề)
  let ansPart: string | null = null;    // Phần hiện tại (phần đáp án / lời giải)
  let inSolution = false;
  let cur: Sol | null = null;
  let hdr: number[] | null = null;      // hàng tiêu đề "Câu 1 … Câu 12" đang chờ hàng giá trị
  let tfHdr = false;                    // bảng Đúng/Sai có tiêu đề Câu | Ý a) … Ý d)
  const essay = { skip: false, parts: new Set<string>(), count: 0 };

  const setPart = (h: { id: string | null; hint: Hint | null }, inAnswers: boolean) => {
    const id = h.id ?? (h.hint ? partOfHint.get(h.hint) ?? null : null);
    if (!inAnswers && h.id) { part = id; if (h.hint) { partOfHint.set(h.hint, h.id); partHint.set(h.id, h.hint); } }
    if (inAnswers) ansPart = id;
    return id;
  };

  const keyRow = (cells: string[]) => {
    const cs = cells.map((c) => c.trim());
    if (HEADER_LABEL.test(cs[0]) && cs.slice(1).length >= 2 && cs.slice(1).every((c) => /^(?:Ý\s*)?[a-d]\)?\.?$/iu.test(c))) { tfHdr = true; hdr = null; return; }
    if (tfHdr) {
      const m = cs[0].match(HEADER_CELL);
      const vals = cs.slice(1).filter((c) => c !== '').slice(0, 4).map(tfCell);
      if (m && vals.length >= 2 && vals.every(Boolean)) { tableKeys.put(ansPart, +m[1], vals.join('')); return; }
      tfHdr = false;
    }
    const head = HEADER_LABEL.test(cs[0]) ? cs.slice(1) : cs;
    if (head.length >= 2 && head.every((c) => HEADER_CELL.test(c))) { hdr = head.map((c) => +c.match(HEADER_CELL)![1]); return; }
    if (hdr) {
      const vals = VALUE_LABEL.test(cs[0]) ? cs.slice(1) : cs;
      hdr.forEach((n, i) => { const v = (vals[i] ?? '').replace(/\s+/g, ''); if (v) tableKeys.put(ansPart, n, v); });
      hdr = null; return;
    }
    // bảng dọc: mỗi hàng "Câu N | đáp án"
    const m = cs[0].match(HEADER_CELL);
    if (m && cs.length === 2 && cs[1]) tableKeys.put(ansPart, +m[1], cs[1].replace(/\s+/g, ''));
  };

  const answerLine = (line: Line, text: string) => {
    const ph = partHeading(text);
    if (ph) { setPart(ph, true); hdr = null; tfHdr = false; cur = null; return; }
    if (line.row && line.row.length > 1) { keyRow(line.row); return; }
    hdr = null; tfHdr = false;
    if (!inSolution && KEY_LINE.test(text)) {
      for (const m of text.matchAll(/(\d+)\s*[.:)]\s*(\S+)/g)) tableKeys.put(ansPart, +m[1], m[2]);
      return;
    }
    const em = text.match(STYLE_ENTRY[style]);
    if (em) {
      if (ansPart && partHint.get(ansPart) === 'essay') { cur = null; return; }
      const n = +em[1];
      const tk = takeKey(em[3], em[2]);
      if (!inSolution && tk.key && !tk.rest) { tableKeys.put(ansPart, n, tk.key); cur = null; return; }
      cur = { part: ansPart, n, key: tk.key, text: tk.rest };
      sols.push(cur);
      return;
    }
    if (cur) cur.text += (cur.text ? '\n' : '') + text;
  };

  for (const line of lines) {
    const text = line.text.trim();
    if (!text) continue;
    if (!(line.row && line.row.length > 1) && isAnswerHeading(text)) {
      mode = 'ans'; cur = null; hdr = null; tfHdr = false;
      // "ĐÁP ÁN VÀ HƯỚNG DẪN GIẢI" mở đầu cả bảng đáp án lẫn lời giải; chỉ tiêu đề "HƯỚNG DẪN GIẢI…"/"LỜI GIẢI" riêng mới là lời giải.
      inSolution = SOL_HEAD.test(text) && !/^(?:BẢNG\s+)?ĐÁP ÁN/iu.test(text);
      continue;
    }
    if (mode === 'ans') { answerLine(line, text); continue; }
    if (mode === 'tail') continue;

    // ── thân đề ──
    if (/^HẾT\b/iu.test(text) || /^[-–—\s]*HẾT[-–—\s]*$/iu.test(text)) { mode = 'tail'; q = null; continue; }
    const ph = partHeading(text);
    if (ph) {
      const id = setPart(ph, false);
      essay.skip = ph.hint === 'essay';
      if (essay.skip && id) essay.parts.add(id);
      q = null;
      continue;
    }
    if (essay.skip) { if (/^(?:Câu|Bài)\s*\d+/iu.test(text)) essay.count++; continue; }
    const qm = matchStart(style, line.text);
    if (qm) {
      q = { n: qm.n, part, stem: line.text.slice(qm.len).trim(), options: [], statements: [] };
      raw.push(q);
      continue;
    }
    if (!q) continue;
    const opts = /^[A-F][.)]\s/.test(text) ? splitLabels(line, OPT_RE) : [];
    const stmts = !opts.length && /^[a-d]\)\s/.test(text) ? splitLabels(line, STMT_RE) : [];
    if (opts.length) q.options.push(...opts);
    else if (stmts.length) q.statements.push(...stmts);
    else if (q.options.length) q.options[q.options.length - 1].text += '\n' + text;
    else if (q.statements.length) q.statements[q.statements.length - 1].text += '\n' + text;
    else q.stem += (q.stem ? '\n' : '') + text;
  }

  if (essay.parts.size || essay.count) {
    const where = [...essay.parts].map((p) => `Phần ${p}`).join(', ');
    notes.push(essay.count
      ? `Đã bỏ qua ${essay.count} câu tự luận${where ? ` (${where})` : ''}: hệ thống chỉ chấm tự động trắc nghiệm, Đúng/Sai và trả lời ngắn.`
      : `Đã bỏ qua phần tự luận${where ? ` (${where})` : ''}.`);
  }

  const typeOf = (r: Raw): QType => (r.options.length ? 'mcq' : r.statements.length ? 'tf' : 'short');
  const sameNum = new Map<string, number>();
  for (const r of raw) sameNum.set(`${typeOf(r)}|${r.n}`, (sameNum.get(`${typeOf(r)}|${r.n}`) ?? 0) + 1);

  // Gán lời giải cho câu: ưu tiên cùng Phần; lời giải không ghi Phần thì lấy theo thứ tự xuất hiện.
  const takeSol = (r: Raw): Sol | undefined => {
    const c = sols.filter((s) => s.n === r.n && !s.used);
    const hit = c.find((s) => s.part && s.part === r.part) ?? c.find((s) => !s.part) ?? (r.part ? undefined : c[0]);
    if (hit) hit.used = true;
    return hit;
  };

  const seen = new Set<string>();
  const questions: ParsedQuestion[] = raw.map((r, i) => {
    const errs: string[] = [], warns: string[] = [];
    const dupKey = `${r.part ?? ''}|${r.n}`;
    if (seen.has(dupKey)) errs.push(`Trùng số câu ${r.n}${r.part ? ` trong Phần ${r.part}` : ''}`);
    seen.add(dupKey);
    const prev = raw.slice(0, i).reverse().find((x) => x.part === r.part);
    if (prev && r.n !== prev.n + 1) warns.push(`Số câu nhảy từ ${prev.n} lên ${r.n}`);
    const type = typeOf(r);
    const sol = takeSol(r);
    const unambiguous = sameNum.get(`${type}|${r.n}`) === 1;
    const tableKey = tableKeys.get(type, r.part, r.n, unambiguous);
    const src: Record<string, string> = {};
    if (type === 'mcq') {
      if (r.options.length < 2 || r.options.length > 6) errs.push(`Có ${r.options.length} phương án, cần từ 2 đến 6 (A–F)`);
      const mk = r.options.filter((o) => o.marked).map((o) => o.label);
      if (mk.length > 1) errs.push(`Gạch chân/tô đỏ ${mk.length} phương án (${mk.join(', ')})`);
      if (mk.length === 1) src['gạch chân'] = mk[0];
      if (tableKey) src['bảng đáp án'] = tableKey.toUpperCase();
      if (sol?.key) src['lời giải'] = sol.key.toUpperCase();
      for (const [k, v] of Object.entries(src)) if (!r.options.some((o) => o.label === v)) errs.push(`Đáp án "${v}" ở ${k} không phải một phương án (${r.options.map((o) => o.label).join(', ') || '—'})`);
    } else if (type === 'tf') {
      if (r.statements.length < 2 || r.statements.length > 4) errs.push(`Có ${r.statements.length} ý, cần từ 2 đến 4 ý (a–d)`);
      if (r.statements.some((s) => s.marked)) src['gạch chân'] = r.statements.map((s) => (s.marked ? 'Đ' : 'S')).join('');
      if (tableKey) src['bảng đáp án'] = normTF(tableKey) ?? `?${tableKey}`;
      if (sol?.key) src['lời giải'] = normTF(sol.key) ?? `?${sol.key}`;
      for (const [k, v] of Object.entries(src)) {
        if (v.startsWith('?')) errs.push(`Đáp án "${v.slice(1)}" ở ${k} không đúng dạng chữ Đ/S`);
        else if (v.length !== r.statements.length) errs.push(`Đáp án ${k} có ${v.length} ý nhưng câu có ${r.statements.length} ý`);
      }
    } else {
      const acc = (s: string) => s.split('|').map((x) => x.trim()).filter(Boolean).join('|');
      if (tableKey) src['bảng đáp án'] = acc(tableKey);
      if (sol?.key) src['lời giải'] = acc(sol.key);
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
      sources: src, answer, solution: prettifyPlainMath(sol?.text || null), errors: errs, warnings: warns,
    };
  });

  if (!questions.length) {
    const theory = /(?:^|\n)\s*(?:Ví dụ|Lý thuyết|Bài tập|Chuyên đề)/iu.test(lines.map((l) => l.text).join('\n'));
    errors.push(theory
      ? 'Tài liệu này có vẻ là lý thuyết hoặc chuyên đề, không phải đề thi. Đề thi cần các câu bắt đầu bằng "Câu 1:", "Câu 2:"…'
      : 'Không tìm thấy câu hỏi nào. Mỗi câu phải bắt đầu bằng "Câu 1:", "Câu 2:"…');
  }
  return { stats, errors, notes, questions };
}
