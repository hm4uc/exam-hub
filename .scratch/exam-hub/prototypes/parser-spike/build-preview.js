// Ghép kết quả phân giải vào preview.template.html → preview.html
// Dùng: node build-preview.js out.html file1.json:tên-file.docx ...
const fs = require('fs');
const [out, ...items] = process.argv.slice(2);
const data = items.map((it) => { const i = it.lastIndexOf(':'); const r = JSON.parse(fs.readFileSync(it.slice(0, i), 'utf8')); r.file = it.slice(i + 1); return r; });
const tpl = fs.readFileSync(__dirname + '/preview.template.html', 'utf8');
fs.writeFileSync(out, tpl.replace('/*DATA*/[]', JSON.stringify(data).replace(/</g, '\u003c')));
console.log('wrote', out, fs.statSync(out).size, 'bytes');
