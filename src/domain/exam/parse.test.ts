import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocx } from './docx';
import { parseDocumentXml } from './parse';
import { prettifyPlainMath } from './math';
import { renderRich } from './render';

const sample = (f: string) => readFileSync(join(__dirname, '..', '..', '..', 'samples', f));

describe('đề mẫu của giáo viên', () => {
  it('Phương trình lượng giác: 10 câu, đáp án khớp bảng + lời giải', async () => {
    const r = await parseDocx(sample('De_PTLG_11_10Cau_TB_TBK.docx'));
    expect(r.errors).toEqual([]);
    expect(r.questions).toHaveLength(10);
    expect(r.questions.map((q) => q.answer).join('')).toBe('AABACDDADB');
    expect(r.questions.every((q) => q.type === 'mcq' && q.errors.length === 0)).toBe(true);
    expect(r.questions[0].stem).toContain('\\(\\sin x + \\sqrt{3} \\cos x = \\sqrt{2}\\)');
    expect(r.questions[0].solution).toBeTruthy();
  });

  it('Phân số: 20 câu', async () => {
    const r = await parseDocx(sample('Bo_de_Phan_So_20Cau.docx'));
    expect(r.questions).toHaveLength(20);
    expect(r.questions.map((q) => q.answer).join('')).toBe('DCCAAADDCCCBBDBBCBBB');
    expect(r.questions[0].stem).toContain('\\frac{2}{5}');
  });

  it('Đề tổng hợp: 3 dạng, Equation của Word, lỗi cố ý', async () => {
    const r = await parseDocx(sample('De_TongHop_3Dang_ThuParser.docx'));
    const by = Object.fromEntries(r.questions.map((q) => [q.n, q]));
    expect(by[1].answer).toBe('B');
    expect(by[2].errors.join()).toMatch(/mâu thuẫn/);
    expect(by[3]).toMatchObject({ type: 'tf', answer: 'ĐSĐS' });
    expect(by[4].errors.join()).toMatch(/mâu thuẫn/);
    expect(by[5]).toMatchObject({ type: 'short', answer: ['0,33', '0,3'] });
    expect(by[6].answer).toEqual(['-2,5']);
    expect(by[7].errors.join()).toMatch(/Không tìm thấy đáp án/);
    expect(by[8].stem).toContain('\\lim_{x\\to 0}');
    expect(by[9].stem).toContain('\\begin{array}{l}x+y=3');
    expect(by[10].answer).toEqual(['1']);
    expect(r.stats.omml).toBeGreaterThan(5);
    // mọi công thức render được
    for (const q of r.questions)
      for (const s of [q.stem, q.solution, ...q.options.map((o) => o.text), ...q.statements.map((x) => x.text)])
        expect(renderRich(s).errors).toEqual([]);
  });
});

describe('file Word mẫu tải về', () => {
  it('phân giải đủ 3 dạng, không lỗi', async () => {
    const r = await parseDocx(readFileSync(join(__dirname, '..', '..', '..', 'public', 'mau-de-thi.docx')));
    expect(r.errors).toEqual([]);
    expect(r.questions.map((q) => [q.type, q.answer, q.errors.length])).toEqual([
      ['mcq', 'A', 0], ['mcq', 'B', 0], ['tf', 'ĐSĐS', 0], ['short', ['1,5'], 0],
    ]);
    expect(r.questions.map((q) => q.part)).toEqual(['I', 'I', 'II', 'III']);
  });
});

describe('công thức gõ bằng chữ', () => {
  it.each([
    ['x = π/6 + kπ/3, k ∈ Z', '\\(x = \\frac{\\pi }{6} + \\frac{k\\pi }{3}, k \\in \\mathbb{Z}\\)'],
    ['A. 25 học sinh', 'A. 25 học sinh'],
    ['v = 10π√3 (cm/s)', '\\(v = 10\\pi \\sqrt{3}\\) (cm/s)'],
    ['Tìm x, biết: x + 1/3 = 5/6', 'Tìm x, biết: \\(x + \\frac{1}{3} = \\frac{5}{6}\\)'],
    ['-3 <= m <= 1', '\\(-3 \\le m \\le 1\\)'],
  ])('%s', (src, out) => expect(prettifyPlainMath(src)).toBe(out));
});

describe('đề chuẩn 3 phần (số câu đánh lại từ 1 mỗi Phần, đáp án trong bảng Word)', () => {
  it('Toán 11: 12 TN + 4 Đúng/Sai + 6 trả lời ngắn, đáp án từ bảng + lời giải', async () => {
    const r = await parseDocx(sample('De_Toan11_3Phan_BangDapAn.docx'));
    expect(r.errors).toEqual([]);
    expect(r.questions).toHaveLength(22);
    expect(r.questions.flatMap((q) => q.errors)).toEqual([]);
    const byType = (t: string) => r.questions.filter((q) => q.type === t);
    expect(byType('mcq').map((q) => q.answer).join('')).toBe('BBBDCCBACCCC');
    expect(byType('tf').map((q) => q.answer)).toEqual(['ĐĐĐS', 'ĐSĐĐ', 'ĐĐĐS', 'ĐĐSĐ']);
    expect(byType('short').map((q) => q.answer)).toEqual([['6'], ['3'], ['12,6'], ['2'], ['16'], ['0,44']]);
    expect(r.questions.map((q) => q.part)).toEqual([...Array(12).fill('I'), ...Array(4).fill('II'), ...Array(6).fill('III')]);
    // lời giải gắn đúng câu dù số câu trùng giữa các Phần
    expect(r.questions[0].solution).toMatch(/^Ta có/);
    expect(r.questions[12].solution).toContain('a) Đúng');
    expect(byType('tf')[0].solution).toBeTruthy();
    expect(byType('short')[0].solution).toBeTruthy();
    // mọi nguồn đáp án đều khớp
    expect(byType('mcq')[0].sources).toMatchObject({ 'bảng đáp án': 'B', 'lời giải': 'B' });
  });
});

// ── biến thể trình bày: dựng document.xml tối thiểu từ danh sách đoạn / hàng bảng ──
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const para = (t: string) => `<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
// bảng nhiều hàng: mỗi phần tử là một hàng
const table = (rows: string[][]) =>
  '<w:tbl>' + rows.map((r) => '<w:tr><w:tc>' + r.map(para).join('</w:tc><w:tc>') + '</w:tc></w:tr>').join('') + '</w:tbl>';
const xmlOf = (parts: (string | { rows: string[][] })[]) =>
  '<w:document><w:body>' + parts.map((p) => (typeof p === 'string' ? para(p) : table(p.rows))).join('') + '</w:body></w:document>';

describe('biến thể trình bày đề', () => {
  it('bỏ qua phần Tự luận và báo lại', () => {
    const r = parseDocumentXml(xmlOf([
      'PHẦN I. Trắc nghiệm nhiều phương án lựa chọn',
      'Câu 1: 1 + 1 = ?', 'A. 1', 'B. 2', 'C. 3', 'D. 4',
      'PHẦN II. Tự luận (3,0 điểm)',
      'Bài 1. Giải phương trình x + 1 = 2.', 'Bài 2. Tính 2 + 3.', 'Bài 3. Chứng minh rằng 1 < 2.',
      'HẾT',
      'ĐÁP ÁN', '1. B',
    ]));
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0]).toMatchObject({ type: 'mcq', answer: 'B' });
    expect(r.notes.join()).toMatch(/3 câu tự luận/);
    expect(r.errors).toEqual([]);
  });

  it('bảng đáp án dọc (Câu | đáp án) và số câu liên tục', () => {
    const r = parseDocumentXml(xmlOf([
      'Câu 1: Hai bằng mấy?', 'A. 1', 'B. 2', 'C. 3', 'D. 4',
      'Câu 2: Ba bằng mấy?', 'A. 1', 'B. 2', 'C. 3', 'D. 4',
      'BẢNG ĐÁP ÁN',
      { rows: [['Câu', 'Đáp án'], ['1', 'B'], ['2', 'C']] },
    ]));
    expect(r.questions.map((q) => q.answer)).toEqual(['B', 'C']);
  });

  it('bảng ngang có ô nhãn đầu hàng ("Câu", "Đáp án")', () => {
    const r = parseDocumentXml(xmlOf([
      'Câu 1: Hai bằng mấy?', 'A. 1', 'B. 2', 'C. 3', 'D. 4',
      'Câu 2: Ba bằng mấy?', 'A. 1', 'B. 2', 'C. 3', 'D. 4',
      'ĐÁP ÁN',
      { rows: [['Câu', '1', '2'], ['Đáp án', 'A', 'D']] },
    ]));
    expect(r.questions.map((q) => q.answer)).toEqual(['A', 'D']);
  });

  it('dòng "1. A  2. B" và lời giải "Câu 1 (B)" phải khớp nhau, lệch thì báo mâu thuẫn', () => {
    const r = parseDocumentXml(xmlOf([
      'Câu 1: Hai bằng mấy?', 'A. 1', 'B. 2', 'C. 3', 'D. 4',
      'Câu 2: Ba bằng mấy?', 'A. 1', 'B. 2', 'C. 3', 'D. 4',
      'BẢNG ĐÁP ÁN', '1. B 2. C',
      'LỜI GIẢI', 'Câu 1 (B): vì 1 + 1 = 2.', 'Câu 2 (D): vì 3 = 3.',
    ]));
    expect(r.questions[0]).toMatchObject({ answer: 'B' });
    expect(r.questions[1].errors.join()).toMatch(/mâu thuẫn/);
  });

  it('số câu trùng nhau trong CÙNG một Phần vẫn bị báo', () => {
    const r = parseDocumentXml(xmlOf([
      'Câu 1: a', 'A. 1', 'B. 2', 'C. 3', 'D. 4',
      'Câu 1: b', 'A. 1', 'B. 2', 'C. 3', 'D. 4',
    ]));
    expect(r.questions[1].errors.join()).toMatch(/Trùng số câu 1/);
  });

  it('tài liệu lý thuyết: báo rõ không phải đề', () => {
    const r = parseDocumentXml(xmlOf(['CHUYÊN ĐỀ 1. HÀM SỐ', 'Ví dụ 1. Tìm tập xác định.', 'Bài tập tự luyện']));
    expect(r.questions).toHaveLength(0);
    expect(r.errors.join()).toMatch(/không phải đề thi/);
  });

  it('đề trả lời ngắn: "Đáp số" trong lời giải', () => {
    const r = parseDocumentXml(xmlOf([
      'PHẦN III. Trắc nghiệm trả lời ngắn',
      'Câu 1: Tính 2 + 3.',
      'HƯỚNG DẪN GIẢI', 'III. Phần trả lời ngắn', 'Câu 1: Đáp số: 5', 'Ta có 2 + 3 = 5.',
    ]));
    expect(r.questions[0]).toMatchObject({ type: 'short', answer: ['5'] });
    expect(r.questions[0].solution).toContain('Ta có');
  });
});
