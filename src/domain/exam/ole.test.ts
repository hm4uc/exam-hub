import * as CFB from 'cfb';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { parseDocx } from './docx';
import { texFromMathTypeBin } from './ole';

/** Luồng "Equation Native" như MathType 7 ghi ra khi gõ công thức bằng ngôn ngữ TeX (ở đây là \Delta). */
const DELTA_STREAM = Buffer.concat([
  Buffer.from('1c000000' + '0200fec1' + 'f0000000' + '4b87e900' + '2cdd1800' + '0c00d000' + 'bc349ef2' + '0501000704' + '44534d543700' + '01' + '661a', 'hex'),
  Buffer.from('TeX Input Language\0\\Delta\0\u0013WinAllBasicCodePages\0', 'latin1'),
]);
const NO_TEX_STREAM = Buffer.from('1c00000002000000', 'hex');

function ole(stream: Uint8Array): Uint8Array {
  const c = CFB.utils.cfb_new();
  CFB.utils.cfb_add(c, 'Equation Native', stream);
  return CFB.write(c, { type: 'buffer', fileType: 'cfb' }) as Uint8Array;
}

async function docxWith(binary: Uint8Array, preview: boolean) {
  const zip = new JSZip();
  const obj = `<w:r><w:object><v:shape><v:imagedata ${preview ? 'r:id="rId5"' : ''}/></v:shape>` +
    `<o:OLEObject Type="Embed" ProgID="Equation.DSMT4" r:id="rId6"/></w:object></w:r>`;
  const p = (t: string) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
  zip.file('word/document.xml',
    '<w:document><w:body>' + p('Câu 1: Ký hiệu ') + `<w:p>${obj}</w:p>` + p('A. 1') + p('B. 2') + p('C. 3') + p('D. 4') + p('HẾT') + p('ĐÁP ÁN') + p('1. B') + '</w:body></w:document>');
  zip.file('word/_rels/document.xml.rels',
    '<Relationships><Relationship Id="rId5" Type="x" Target="media/image1.png"/><Relationship Id="rId6" Type="x" Target="embeddings/oleObject1.bin"/></Relationships>');
  zip.file('word/embeddings/oleObject1.bin', binary);
  zip.file('word/media/image1.png', Uint8Array.from([137, 80, 78, 71]));
  return zip.generateAsync({ type: 'uint8array' });
}

describe('công thức MathType (OLE)', () => {
  it('đọc mã TeX lưu sẵn trong luồng Equation Native', () => {
    expect(texFromMathTypeBin(ole(DELTA_STREAM))).toBe('\\Delta');
  });

  it('không có mã TeX hoặc không phải OLE → null', () => {
    expect(texFromMathTypeBin(ole(NO_TEX_STREAM))).toBeNull();
    expect(texFromMathTypeBin(Uint8Array.from([1, 2, 3]))).toBeNull();
  });

  it('docx: công thức MathType có TeX trở thành \\( … \\) ngay trong đề bài', async () => {
    const r = await parseDocx(await docxWith(ole(DELTA_STREAM), true));
    expect(r.questions[0].stem).toContain('\\(\\Delta\\)');
    expect(r.questions[0].errors).toEqual([]);
    expect(r.images).toHaveLength(0);
  });

  it('docx: không có TeX → dùng ảnh xem trước PNG', async () => {
    const r = await parseDocx(await docxWith(ole(NO_TEX_STREAM), true));
    expect(r.questions[0].stem).toContain('⟦img:rId5⟧');
    expect(r.images.map((i) => i.rId)).toEqual(['rId5']);
  });

  it('docx: không TeX và không ảnh xem trước → báo lỗi như trước', async () => {
    const r = await parseDocx(await docxWith(ole(NO_TEX_STREAM), false));
    expect(r.questions[0].errors.join()).toMatch(/MathType/);
  });
});
