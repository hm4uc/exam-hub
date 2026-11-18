import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocx } from './docx';
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

describe('công thức gõ bằng chữ', () => {
  it.each([
    ['x = π/6 + kπ/3, k ∈ Z', '\\(x = \\frac{\\pi }{6} + \\frac{k\\pi }{3}, k \\in \\mathbb{Z}\\)'],
    ['A. 25 học sinh', 'A. 25 học sinh'],
    ['v = 10π√3 (cm/s)', '\\(v = 10\\pi \\sqrt{3}\\) (cm/s)'],
    ['Tìm x, biết: x + 1/3 = 5/6', 'Tìm x, biết: \\(x + \\frac{1}{3} = \\frac{5}{6}\\)'],
    ['-3 <= m <= 1', '\\(-3 \\le m \\le 1\\)'],
  ])('%s', (src, out) => expect(prettifyPlainMath(src)).toBe(out));
});
