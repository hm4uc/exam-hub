// Render "văn bản xen LaTeX \( … \) + token ảnh ⟦img:path⟧" → HTML. Dùng ở server khi lưu câu hỏi (spec §4),
// và ở màn xem trước của giáo viên. KaTeX được ghim phiên bản trong package.json.
import katex from 'katex';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface RenderOptions {
  /** đổi đường dẫn ảnh (storage path hoặc rId) → URL hiển thị */
  imageUrl?: (ref: string) => string | null;
  output?: 'htmlAndMathml' | 'mathml' | 'html';
}

export interface RenderResult { html: string; errors: string[] }

export function renderRich(src: string | null | undefined, opts: RenderOptions = {}): RenderResult {
  const errors: string[] = [];
  if (!src) return { html: '', errors };
  const html = src
    .split(/(\\\([\s\S]*?\\\)|⟦img:[^⟧]*⟧)/)
    .map((part) => {
      if (part.startsWith('\\(')) {
        const tex = part.slice(2, -2);
        try {
          return katex.renderToString('\\displaystyle ' + tex, { output: opts.output ?? 'htmlAndMathml', throwOnError: true, strict: 'ignore' });
        } catch (e) {
          errors.push(`Công thức lỗi: ${tex}`);
          return `<code class="tex-error" title="${esc(String((e as Error).message))}">${esc(tex)}</code>`;
        }
      }
      if (part.startsWith('⟦img:')) {
        const ref = part.slice(5, -1);
        const url = opts.imageUrl?.(ref);
        return url ? `<img class="q-img" src="${esc(url)}" alt="" loading="lazy">` : `<span class="img-missing">[ảnh]</span>`;
      }
      return esc(part).replace(/\n/g, '<br>');
    })
    .join('');
  return { html, errors };
}
