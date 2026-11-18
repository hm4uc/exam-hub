// Tạo public/mau-de-thi.docx: file Word mẫu đúng quy ước để giáo viên soạn đề.
// Chạy: node scripts/make-template.mjs
import JSZip from 'jszip';
import { writeFileSync } from 'node:fs';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const r = (t, o = {}) =>
  `<w:r><w:rPr>${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.u ? '<w:u w:val="single"/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}</w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
const p = (...runs) => `<w:p>${runs.map((x) => (typeof x === 'string' ? r(x) : x.xml)).join('')}</w:p>`;
const R = (t, o) => ({ xml: r(t, o) });
const note = (t) => p(R(t, { i: true, color: '6B7280' }));

const body = [
  p(R('ĐỀ KIỂM TRA 15 PHÚT – MÔN TOÁN 11', { b: true })),
  note('Hướng dẫn (phần này nằm trước "Câu 1" nên hệ thống bỏ qua, có thể xoá):'),
  note('• Mỗi câu bắt đầu bằng "Câu 1:", "Câu 2:"… Có thể chia PHẦN I, II, III.'),
  note('• Trắc nghiệm: 4 phương án A. B. C. D. Đúng/Sai: 4 ý a) b) c) d). Trả lời ngắn: không có phương án.'),
  note('• Công thức: dùng Equation của Word, hoặc gõ chữ như π/6, √3, x², <=, >= đều được.'),
  note('• Đáp án ghi ở BẢNG ĐÁP ÁN sau dòng HẾT; hoặc gạch chân / tô đỏ phương án đúng ngay trong đề.'),
  p(R('PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn', { b: true })),
  p(R('Câu 1: ', { b: true }), 'Nghiệm của phương trình sin x = 1/2 là:'),
  p('A. x = π/6 + k2π hoặc x = 5π/6 + k2π, k ∈ Z'),
  p('B. x = π/3 + k2π, k ∈ Z'),
  p('C. x = ±π/6 + k2π, k ∈ Z'),
  p('D. x = π/6 + kπ, k ∈ Z'),
  p(R('Câu 2: ', { b: true }), 'Giá trị của cos(π/3) bằng:'),
  p('A. √3/2\tB. 1/2\tC. -1/2\tD. 1'),
  p(R('PHẦN II. Câu trắc nghiệm đúng sai', { b: true })),
  p(R('Câu 3: ', { b: true }), 'Cho hàm số y = sin x. Xét tính đúng sai của các mệnh đề sau:'),
  p('a) Hàm số tuần hoàn với chu kì 2π.'),
  p('b) Hàm số là hàm số chẵn.'),
  p('c) Giá trị lớn nhất của hàm số bằng 1.'),
  p('d) Đồ thị hàm số đi qua điểm (π/2; 0).'),
  p(R('PHẦN III. Câu trắc nghiệm trả lời ngắn', { b: true })),
  p(R('Câu 4: ', { b: true }), 'Tính giá trị của biểu thức P = sin²(π/4) + cos(0). Viết kết quả dưới dạng số thập phân.'),
  p(R('HẾT', { b: true })),
  p(R('BẢNG ĐÁP ÁN', { b: true })),
  p('1.A   2.B   3.ĐSĐS   4.1,5'),
  p(R('HƯỚNG DẪN GIẢI CHI TIẾT', { b: true })),
  p(R('Câu 1: ', { b: true }), 'Đáp án A. sin x = 1/2 = sin(π/6) <=> x = π/6 + k2π hoặc x = π - π/6 + k2π = 5π/6 + k2π.'),
  p(R('Câu 2: ', { b: true }), 'Đáp án B. cos(π/3) = 1/2.'),
  p(R('Câu 3: ', { b: true }), 'a) Đúng. b) Sai vì sin(-x) = -sin x. c) Đúng. d) Sai vì sin(π/2) = 1.'),
  p(R('Câu 4: ', { b: true }), 'Đáp án 1,5. sin²(π/4) = 1/2, cos(0) = 1 nên P = 1,5.'),
];

const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="288" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`;
const zip = new JSZip();
zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
zip.file('word/document.xml', doc);
zip.file('word/styles.xml', styles);
writeFileSync(new URL('../public/mau-de-thi.docx', import.meta.url), await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log('Đã tạo public/mau-de-thi.docx');
