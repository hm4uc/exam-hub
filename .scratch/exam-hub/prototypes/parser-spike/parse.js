// Spike (bỏ đi sau khi chốt): phân giải word/document.xml của đề .docx theo mẫu quy ước
// đã chốt ở phiếu "Mẫu quy ước của file Word đề thi là gì?".
// Dùng: node parse.js <document.xml> [tên-đề]  → in JSON ra stdout.
const fs = require('fs');
const { ommlToLatex, prettifyPlainMath } = require('./math');

const decode = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function isRed(hex) {
  if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return r >= 0xc0 && g < 0x60 && b < 0x60;
}

// → mảng "dòng": { text, marks: boolean[] (đánh dấu theo từng ký tự), bold: boolean[] }
function readLines(xml) {
  const lines = [];
  const stats = { omml: 0, ole: 0, images: 0, shapes: 0 };
  for (const pm of xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
    const pxml = pm[0];
    let cur = { text: '', marks: [], bold: [] };
    const push = (t, mark, bold) => {
      for (const ch of t) { cur.text += ch; cur.marks.push(mark); cur.bold.push(bold); }
    };
    // duyệt theo thứ tự: run thường, công thức OMML, object OLE, drawing
    for (const m of pxml.matchAll(/<w:r[ >][\s\S]*?<\/w:r>|<m:oMath>[\s\S]*?<\/m:oMath>/g)) {
      const chunk = m[0];
      if (chunk.startsWith('<m:oMath')) { stats.omml++; push(`\\(${ommlToLatex(chunk)}\\)`, false, false); continue; }
      const rpr = (chunk.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/) || [, ''])[1];
      const u = rpr.match(/<w:u w:val="(\w+)"/);
      const c = rpr.match(/<w:color w:val="(\w+)"/);
      const mark = !!(u && u[1] !== 'none') || !!(c && isRed(c[1]));
      const bold = /<w:b\/>|<w:b w:val="(1|true)"/.test(rpr);
      if (/<w:object/.test(chunk)) { stats.ole++; push('⟦MathType⟧', false, false); }
      if (/<w:drawing/.test(chunk)) {
        if (/<pic:pic/.test(chunk)) { stats.images++; push('⟦hình⟧', false, false); }
        else { stats.shapes++; push('⟦shape⟧', false, false); }
      }
      for (const t of chunk.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g)) {
        if (t[0] === '<w:tab/>') push('\t', mark, bold);
        else if (t[0] === '<w:br/>') { lines.push(cur); cur = { text: '', marks: [], bold: [] }; }
        else push(decode(t[1]), mark, bold);
      }
    }
    lines.push(cur);
  }
  return { lines, stats };
}

const slice = (line, a, b) => ({ text: line.text.slice(a, b), marks: line.marks.slice(a, b) });
const marked = (seg) => [...seg.text].some((ch, i) => ch.trim() && seg.marks[i]);

// Tách các nhãn (A. B. … hoặc a) b) …) có thể nằm chung một dòng.
function splitLabels(line, re) {
  const starts = [...line.text.matchAll(re)].map((m) => ({ idx: m.index + m[1].length, label: m[2], len: m[0].length - m[1].length }));
  return starts.map((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].idx : line.text.length;
    const seg = slice(line, s.idx, end);
    const content = slice(line, s.idx + s.len, end);
    return { label: s.label, text: content.text.trim(), marked: marked(seg) };
  });
}

const OPT_RE = /(^|\s)([A-D])[.)]\s+/g;
const STMT_RE = /(^|\s)([a-d])\)\s+/g;

function normTF(s) {
  const t = s.toUpperCase().replace(/D/g, 'Đ');
  return /^[ĐS]{4}$/.test(t) ? t : null;
}
const normNum = (s) => {
  const t = s.trim().replace(',', '.');
  return /^-?\d*\.?\d+$/.test(t) ? Number(t) : null;
};

function parse(xml) {
  const { lines, stats } = readLines(xml);
  const questions = [];
  const table = {}; const solKey = {}; const solution = {};
  const errors = [];
  let mode = 'body'; let q = null; let part = null; let solN = null;

  for (const line of lines) {
    const text = line.text.trim();
    if (!text) continue;
    if (mode === 'body') {
      if (/^HẾT\b/i.test(text)) { mode = 'tail'; continue; }
      const pm = text.match(/^PHẦN\s+([IVX]+|\d+)\b/i);
      if (pm) { part = pm[1].toUpperCase(); continue; }
      const qm = line.text.match(/^\s*Câu\s*(\d+)\s*[:.]\s*/i);
      if (qm) {
        q = { n: +qm[1], part, stem: line.text.slice(qm[0].length).trim(), options: [], statements: [] };
        questions.push(q);
        continue;
      }
      if (!q) continue; // tiêu đề, dòng mô tả đề
      const opts = /^[A-D][.)]\s/.test(text) ? splitLabels(line, OPT_RE) : [];
      const stmts = /^[a-d]\)\s/.test(text) ? splitLabels(line, STMT_RE) : [];
      if (opts.length) q.options.push(...opts);
      else if (stmts.length) q.statements.push(...stmts);
      else if (q.options.length) q.options[q.options.length - 1].text += '\n' + text;
      else if (q.statements.length) q.statements[q.statements.length - 1].text += '\n' + text;
      else q.stem += '\n' + text;
      continue;
    }
    // phần sau HẾT
    if (/^BẢNG ĐÁP ÁN/i.test(text)) { mode = 'table'; continue; }
    if (/^HƯỚNG DẪN GIẢI|^LỜI GIẢI/i.test(text)) { mode = 'solution'; continue; }
    if (mode === 'table') {
      for (const m of text.matchAll(/(\d+)\s*[.:)]\s*(\S+)/g)) table[+m[1]] = m[2];
    } else if (mode === 'solution') {
      const sm = text.match(/^Câu\s*(\d+)\s*[:.]\s*([\s\S]*)$/i);
      if (sm) {
        solN = +sm[1];
        let rest = sm[2];
        const km = rest.match(/^Đáp án\s*:?\s*([A-D]|[ĐSDđsd]{4}|-?\d+(?:[.,]\d+)?(?:\|-?\d+(?:[.,]\d+)?)*)(?=[\s.]|$)\.?\s*/i);
        if (km) { solKey[solN] = km[1]; rest = rest.slice(km[0].length); }
        solution[solN] = rest.trim();
      } else if (solN != null) solution[solN] += '\n' + text;
    }
  }

  // Ráp đáp án + kiểm lỗi
  const seen = new Set();
  questions.forEach((q, i) => {
    q.errors = []; q.warnings = [];
    if (seen.has(q.n)) q.errors.push(`Trùng số câu ${q.n}`);
    seen.add(q.n);
    if (i > 0 && q.n !== questions[i - 1].n + 1) q.warnings.push(`Số câu nhảy từ ${questions[i - 1].n} lên ${q.n}`);

    q.type = q.options.length ? 'mcq' : q.statements.length ? 'tf' : 'short';
    const src = {};
    if (q.type === 'mcq') {
      if (q.options.length !== 4) q.errors.push(`Có ${q.options.length} phương án, cần đúng 4 (A–D)`);
      const mk = q.options.filter((o) => o.marked).map((o) => o.label);
      if (mk.length > 1) q.errors.push(`Gạch chân/tô đỏ ${mk.length} phương án (${mk.join(', ')})`);
      if (mk.length === 1) src['gạch chân'] = mk[0];
      if (table[q.n]) src['bảng đáp án'] = table[q.n].toUpperCase();
      if (solKey[q.n]) src['lời giải'] = solKey[q.n].toUpperCase();
      for (const [k, v] of Object.entries(src)) if (!/^[A-D]$/.test(v)) q.errors.push(`Đáp án "${v}" ở ${k} không phải A–D`);
    } else if (q.type === 'tf') {
      if (q.statements.length !== 4) q.errors.push(`Có ${q.statements.length} ý, cần đúng 4 (a–d)`);
      if (q.statements.some((s) => s.marked)) src['gạch chân'] = q.statements.map((s) => (s.marked ? 'Đ' : 'S')).join('');
      if (table[q.n]) src['bảng đáp án'] = normTF(table[q.n]) || `?${table[q.n]}`;
      if (solKey[q.n]) src['lời giải'] = normTF(solKey[q.n]) || `?${solKey[q.n]}`;
      for (const [k, v] of Object.entries(src)) if (v.startsWith('?')) q.errors.push(`Đáp án "${v.slice(1)}" ở ${k} không đúng dạng 4 chữ Đ/S`);
    } else {
      const parseAccepted = (s) => s.split('|').map((x) => x.trim()).filter(Boolean);
      if (table[q.n]) src['bảng đáp án'] = parseAccepted(table[q.n]).join('|');
      if (solKey[q.n]) src['lời giải'] = parseAccepted(solKey[q.n]).join('|');
      for (const [k, v] of Object.entries(src))
        for (const a of v.split('|')) if (normNum(a) === null) q.errors.push(`Đáp án "${a}" ở ${k} không phải số`);
    }
    q.sources = src;
    const vals = Object.values(src);
    if (!vals.length) q.errors.push('Không tìm thấy đáp án (bảng đáp án / "Đáp án …" trong lời giải / gạch chân)');
    else {
      const canon = (v) => (q.type === 'short' ? v.split('|').map(normNum).sort().join('|') : v);
      if (new Set(vals.map(canon)).size > 1)
        q.errors.push('Đáp án mâu thuẫn: ' + Object.entries(src).map(([k, v]) => `${k} = ${v}`).join('; '));
      else q.answer = q.type === 'short' ? vals.sort((a, b) => b.length - a.length)[0].split('|') : vals[0];
    }
    q.solution = solution[q.n] || null;
    // làm đẹp công thức gõ bằng chữ (ngoài phần LaTeX sẵn có)
    q.stem = prettifyPlainMath(q.stem);
    q.solution = prettifyPlainMath(q.solution);
    for (const o of [...q.options, ...q.statements]) o.text = prettifyPlainMath(o.text);
  });

  for (const n of Object.keys(table)) if (!seen.has(+n)) errors.push(`Bảng đáp án có câu ${n} nhưng đề không có câu này`);
  if (!questions.length) errors.push('Không tìm thấy câu hỏi nào (mỗi câu phải bắt đầu bằng "Câu n:")');
  if (stats.shapes) errors.push(`Có ${stats.shapes} hình vẽ bằng Shapes: hãy dán lại thành ảnh`);
  return { stats, errors, questions };
}

const res = parse(fs.readFileSync(process.argv[2], 'utf8'));
res.title = process.argv[3] || process.argv[2];
process.stdout.write(JSON.stringify(res, null, 1));
