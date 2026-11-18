import { z } from 'zod';
import { SUPABASE_URL } from '../supabase/env';
import { normNum, normTF } from './parse';
import { renderRich } from './render';
import type { QuestionInput } from './types';

export const IMAGE_BUCKET = 'question-images';
export const imagePublicUrl = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
const imageUrl = (ref: string) => (ref.includes('/') ? imagePublicUrl(ref) : null);

export const QuestionInputSchema = z
  .object({
    position: z.number().int().min(1),
    part: z.string().max(10).nullable(),
    type: z.enum(['mcq', 'tf', 'short']),
    stem: z.string().max(20000),
    choices: z.array(z.object({ label: z.string().max(2), text: z.string().max(10000) })).max(4),
    answer: z.union([z.string(), z.array(z.string())]),
    solution: z.string().max(50000).nullable(),
    points: z.number().min(0).max(100).nullable(),
  })
  .superRefine((q, ctx) => {
    const bad = (message: string) => ctx.addIssue({ code: 'custom', message: `Câu ${q.position}: ${message}` });
    if (q.type === 'mcq') {
      if (q.choices.length !== 4) bad('cần đúng 4 phương án A–D');
      if (typeof q.answer !== 'string' || !q.choices.some((c) => c.label === q.answer)) bad('chưa chọn đáp án đúng');
    } else if (q.type === 'tf') {
      if (q.choices.length !== 4) bad('cần đúng 4 ý a–d');
      if (typeof q.answer !== 'string' || !normTF(q.answer)) bad('đáp án Đúng/Sai cần đủ 4 ý');
    } else {
      if (!Array.isArray(q.answer) || !q.answer.length || q.answer.some((a) => normNum(a) === null)) bad('đáp án trả lời ngắn phải là số');
    }
  });

/** Câu hỏi đã kiểm tra → dòng DB (có HTML render sẵn). */
export function toQuestionRow(q: QuestionInput) {
  const stem = renderRich(q.stem, { imageUrl });
  const solution = renderRich(q.solution, { imageUrl });
  const choices = q.choices.map((c) => ({ label: c.label, text: c.text, html: renderRich(c.text, { imageUrl }).html }));
  return {
    position: q.position,
    part: q.part,
    type: q.type,
    stem: q.stem,
    stem_html: stem.html,
    choices,
    answer: q.type === 'tf' ? normTF(q.answer as string) : q.answer,
    solution: q.solution,
    solution_html: q.solution ? solution.html : null,
    points: q.points,
  };
}
