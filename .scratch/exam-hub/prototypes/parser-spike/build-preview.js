// Ghép kết quả phân giải vào preview.template.html → preview.html.
// Công thức được render sẵn bằng KaTeX ở bước này (giống "render ở server lúc lưu câu hỏi").
// Trong trang thử dùng đầu ra MathML (CSP của trang không cho tải CSS/font KaTeX); bản thật dùng htmlAndMathml.
// Dùng: node build-preview.js out.html file1.json:tên-file.docx ...
const fs = require('fs');
const katex = require('katex');

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let mathCount = 0, mathErrors = [];
function rich(s) {
  if (!s) return '';
  return s.split(/(\\\([\s\S]*?\\\))/).map((part) => {
    if (!part.startsWith('\\(')) return esc(part);
    const tex = part.slice(2, -2);
    mathCount++;
    try {
      return katex.renderToString('\\displaystyle ' + tex, { output: 'mathml', throwOnError: true, strict: 'ignore' });
    } catch (e) {
      mathErrors.push(tex + '  →  ' + e.message);
      return `<code class="texerr" title="${esc(e.message)}">${esc(tex)}</code>`;
    }
  }).join('');
}

const [out, ...items] = process.argv.slice(2);
const data = items.map((it) => {
  const i = it.lastIndexOf(':');
  const r = JSON.parse(fs.readFileSync(it.slice(0, i), 'utf8'));
  r.file = it.slice(i + 1);
  for (const q of r.questions) {
    q.stemHtml = rich(q.stem);
    q.solutionHtml = rich(q.solution);
    for (const o of [...q.options, ...q.statements]) o.html = rich(o.text);
  }
  return r;
});
const tpl = fs.readFileSync(__dirname + '/preview.template.html', 'utf8');
fs.writeFileSync(out, tpl.replace('/*DATA*/[]', JSON.stringify(data).replace(/</g, '\\u003c')));
console.log('wrote', out, fs.statSync(out).size, 'bytes;', mathCount, 'công thức;', mathErrors.length, 'lỗi');
for (const e of mathErrors) console.log('  ', e);
