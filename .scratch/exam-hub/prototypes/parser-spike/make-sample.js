// Spike: tạo đề tổng hợp .docx (3 Dạng câu, 3 nguồn đáp án, 1 mâu thuẫn cố ý) để thử bộ phân giải.
// Dùng: node make-sample.js <thư-mục-ra>   → ghi các phần XML; sau đó nén zip thành .docx.
const fs = require('fs');
const path = require('path');
const out = process.argv[2];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// r(text, {b, u, red})
const r = (t, o = {}) => new String(
  `<w:r><w:rPr>${o.b ? '<w:b/>' : ''}${o.u ? '<w:u w:val="single"/>' : ''}${o.red ? '<w:color w:val="FF0000"/>' : ''}</w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`);
const p = (...runs) => `<w:p>${runs.map((x) => (typeof x === 'string' ? r(x) : x)).join('')}</w:p>`;
const q = (n) => r(`Câu ${n}: `, { b: true });

// Equation gốc của Word (OMML)
const M = (x) => new String(`<m:oMath>${x}</m:oMath>`);
const mr = (t) => `<m:r><m:t>${esc(t)}</m:t></m:r>`;
const mtxt = (t) => `<m:r><m:rPr><m:nor/></m:rPr><m:t xml:space="preserve">${esc(t)}</m:t></m:r>`;
const fr = (a, b) => `<m:f><m:num>${a}</m:num><m:den>${b}</m:den></m:f>`;
const sup = (e, s) => `<m:sSup><m:e>${e}</m:e><m:sup>${s}</m:sup></m:sSup>`;
const sub = (e, s) => `<m:sSub><m:e>${e}</m:e><m:sub>${s}</m:sub></m:sSub>`;
const sqrt = (e) => `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${e}</m:e></m:rad>`;
const dl = (e, beg, end) => `<m:d><m:dPr>${beg != null ? `<m:begChr m:val="${beg}"/>` : ''}${end != null ? `<m:endChr m:val="${end}"/>` : ''}</m:dPr>${[].concat(e).map((x) => `<m:e>${x}</m:e>`).join('')}</m:d>`;
const sys = (...rows) => dl(`<m:eqArr>${rows.map((x) => `<m:e>${x}</m:e>`).join('')}</m:eqArr>`, '{', '');
const fn = (name, e) => `<m:func><m:fName>${mr(name)}</m:fName><m:e>${e}</m:e></m:func>`;
const lim = (under, e) => `<m:func><m:fName><m:limLow><m:e>${mr('lim')}</m:e><m:lim>${under}</m:lim></m:limLow></m:fName><m:e>${e}</m:e></m:func>`;
const nary = (chr, lo, hi, e) => `<m:nary><m:naryPr><m:chr m:val="${chr}"/></m:naryPr><m:sub>${lo}</m:sub><m:sup>${hi}</m:sup><m:e>${e}</m:e></m:nary>`;
const vec = (e) => `<m:acc><m:accPr><m:chr m:val="⃗"/></m:accPr><m:e>${mr(e)}</m:e></m:acc>`;

const body = [
  p(r('ĐỀ TỔNG HỢP THỬ BỘ PHÂN GIẢI', { b: true })),
  p(r('PHẦN I. Trắc nghiệm nhiều lựa chọn', { b: true })),
  // Câu 1: đáp án bằng gạch chân (khớp với bảng)
  p(q(1), 'Giá trị của sin(π/6) là:'),
  p('A. √3/2'),
  p(r('B. 1/2', { u: true })),
  p('C. √2/2'),
  p('D. 1'),
  // Câu 2: phương án trên cùng một dòng (tab); bảng và lời giải MÂU THUẪN (cố ý)
  p(q(2), 'Nghiệm của phương trình 2x - 4 = 0 là:'),
  p('A. x = 1\tB. x = 2\tC. x = -2\tD. x = 4'),
  p(r('PHẦN II. Trắc nghiệm đúng sai', { b: true })),
  // Câu 3: Đúng/Sai — gạch chân ý đúng (khớp với bảng)
  p(q(3), 'Cho hàm số f(x) = x² - 4x + 3. Xét tính đúng sai của các mệnh đề sau:'),
  p(r('a) f(1) = 0', { u: true })),
  p('b) f(x) đồng biến trên ℝ'),
  p(r('c) Đồ thị cắt trục tung tại điểm (0; 3)', { u: true })),
  p('d) f(x) đạt giá trị nhỏ nhất bằng 1'),
  // Câu 4: Đúng/Sai — chỉ có đáp án ở bảng; tô đỏ ý d (không gạch chân)
  p(q(4), 'Cho cấp số cộng (uₙ) có u₁ = 2, công sai d = 3. Khi đó:'),
  p('a) u₂ = 5'),
  p('b) u₅ = 15'),
  p('c) Tổng 3 số hạng đầu bằng 15'),
  p(r('d) uₙ = 3n - 1', { red: true })),
  p(r('PHẦN III. Trắc nghiệm trả lời ngắn', { b: true })),
  // Câu 5: trả lời ngắn, nhiều đáp án chấp nhận
  p(q(5), 'Tính giá trị của 1/3 (làm tròn đến hàng phần trăm).'),
  // Câu 6: trả lời ngắn, số âm, đáp án chỉ có trong lời giải
  p(q(6), 'Tìm x biết 2x + 5 = 0.'),
  // Câu 7: thiếu đáp án (cố ý)
  p(q(7), 'Tính 0,5 + 0,25.'),
  p(r('PHẦN IV. Câu dùng Equation của Word', { b: true })),
  // Câu 8: trắc nghiệm, OMML trong đề và phương án; đáp án gạch chân
  p(q(8), 'Giá trị của giới hạn ', M(lim(mr('x→0'), fr(fn('sin', mr('x')), mr('x')))), ' bằng:'),
  p('A. ', M(mr('0'))),
  p(r('B. ', { u: true }), M(mr('1'))),
  p('C. ', M(fr(mr('1'), mr('2')))),
  p('D. ', M(mr('+∞'))),
  // Câu 9: Đúng/Sai, hệ phương trình + vectơ + tổng + căn
  p(q(9), 'Cho hệ phương trình ', M(sys(mr('x+y=3'), mr('x−y=1'))), ' và các mệnh đề:'),
  p('a) Hệ có nghiệm ', M(dl(mr('x;y'))), ' = ', M(dl(mr('2;1')))),
  p('b) Với A(1; 2), B(3; 5) thì ', M(vec('AB') + mr('=') + dl(mr('2;3')))),
  p('c) ', M(nary('∑', mr('k=1'), mr('n'), mr('k')) + mr('=') + fr(mr('n') + dl(mr('n+1')), mr('2')))),
  p('d) ', M(sqrt(sup(mr('x'), mr('2')) + mr('+1')) + mr('<1')), ' với mọi ', M(mr('x∈ℝ'))),
  // Câu 10: trả lời ngắn, tích phân + chỉ số dưới
  p(q(10), 'Cho dãy số ', M(sub(mr('u'), mr('n')) + mr('=2n')), '. Tính ', M(nary('∫', mr('0'), mr('1'), mr('2x') + mtxt(' d') + mr('x'))), '.'),
  p('HẾT'),
  p(r('BẢNG ĐÁP ÁN', { b: true })),
  p('1.B   2.B   3.ĐSĐS   4.ĐSĐĐ   5.0,33|0,3   8.B   9.ĐĐĐS   10.1'),
  p(r('HƯỚNG DẪN GIẢI CHI TIẾT', { b: true })),
  p(q(1), 'Đáp án B. sin(π/6) = 1/2.'),
  p(q(2), 'Đáp án C. 2x = 4 ⇔ x = 2.'),
  p(q(6), 'Đáp án -2,5. 2x = -5 ⇔ x = -2,5.'),
];

const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body>${body.join('')}<w:sectPr/></w:body></w:document>`;
const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

fs.mkdirSync(path.join(out, '_rels'), { recursive: true });
fs.mkdirSync(path.join(out, 'word'), { recursive: true });
fs.writeFileSync(path.join(out, '[Content_Types].xml'), ct);
fs.writeFileSync(path.join(out, '_rels', '.rels'), rels);
fs.writeFileSync(path.join(out, 'word', 'document.xml'), doc);
console.log('ok', out);
