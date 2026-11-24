export type QType = 'mcq' | 'tf' | 'short';

export const TYPE_NAME: Record<QType, string> = { mcq: 'Trắc nghiệm', tf: 'Đúng/Sai', short: 'Trả lời ngắn' };

export interface ParsedChoice { label: string; text: string; marked: boolean }

export interface ParsedQuestion {
  n: number;
  part: string | null;
  type: QType;
  stem: string;
  options: ParsedChoice[];
  statements: ParsedChoice[];
  /** nguồn đáp án → giá trị, ví dụ { 'bảng đáp án': 'B', 'lời giải': 'B' } */
  sources: Record<string, string>;
  /** mcq "B" | tf "ĐSĐS" | short ["0,33","0,3"]; không có khi lỗi */
  answer?: string | string[];
  solution: string | null;
  errors: string[];
  warnings: string[];
}

export interface ParseResult {
  stats: { omml: number; ole: number; images: number; shapes: number };
  errors: string[];
  /** thông tin không chặn việc lưu (ví dụ: đã bỏ qua phần tự luận) */
  notes: string[];
  questions: ParsedQuestion[];
}

/** Câu hỏi ở dạng lưu vào DB / gửi lên server (sau khi giáo viên soát). */
export interface QuestionInput {
  position: number;
  part: string | null;
  type: QType;
  stem: string;
  choices: { label: string; text: string }[];
  answer: string | string[];
  solution: string | null;
  points: number | null;
}

export interface Scoring { mcq: number; tf: number; short: number; scale10: boolean }
export const DEFAULT_SCORING: Scoring = { mcq: 0.25, tf: 1, short: 0.5, scale10: true };
