import type { QType } from '@/domain/exam/types';

/** Một câu hỏi như giáo viên thấy ở màn soát/sửa đề (đã lưu trong CSDL). */
export interface QRow {
  id: string; position: number; part: string | null; type: QType; stem: string; stem_html: string;
  choices: { label: string; text: string; html: string }[]; answer: string | string[]; solution: string | null; points: number | null;
}
