import type { QType } from './types';

export type ReviewStatus = 'right' | 'part' | 'wrong' | 'blank';

export interface ReviewChoice {
  label: string;
  html: string;
}

export interface ReviewQuestionInput {
  id: string;
  type: QType;
  stem_html: string;
  choices: ReviewChoice[];
  answer: string | string[];
  solution_html?: string | null;
}

export interface PerQuestionScore {
  pts: number;
  max: number;
  result: 'right' | 'part' | 'wrong';
}

export interface ReviewItem {
  index: number;
  question: ReviewQuestionInput;
  given: string | undefined;
  pts: number;
  max: number;
  status: ReviewStatus;
}

export interface ReviewSummary {
  total: number;
  right: number;
  part: number;
  wrong: number;
  blank: number;
  rightPct: number;
  partPct: number;
  wrongPct: number;
  blankPct: number;
}

export function isBlankAnswer(type: QType, given: string | undefined): boolean {
  if (!given) return true;
  if (type === 'tf') return given.replace(/_/g, '').trim().length === 0;
  return given.trim().length === 0;
}

/** Sắp xếp lại phương án MCQ theo thứ tự choice_orders nếu có (khớp thứ tự học sinh đã nhìn thấy). */
export function orderChoices(
  type: QType,
  choices: ReviewChoice[],
  choiceOrder?: number[] | null,
): ReviewChoice[] {
  if (type !== 'mcq' || !Array.isArray(choiceOrder) || choiceOrder.length !== choices.length) {
    return choices;
  }
  const ordered = choiceOrder.map((idx) => choices[idx]).filter(Boolean);
  return ordered.length === choices.length ? ordered : choices;
}

/** Chuẩn hoá danh sách câu hỏi kèm trạng thái Đúng / Đúng một phần / Sai / Bỏ trống. */
export function buildReviewItems(
  questions: ReviewQuestionInput[],
  answers: Record<string, string> | null | undefined,
  perQuestion: Record<string, PerQuestionScore> | null | undefined,
  choiceOrders?: Record<string, number[]> | null,
): ReviewItem[] {
  const ansMap = answers ?? {};
  const perMap = perQuestion ?? {};

  return questions.map((q, i) => {
    const given = ansMap[q.id];
    const pq = perMap[q.id];
    const blank = isBlankAnswer(q.type, given);
    let status: ReviewStatus;
    if (pq?.result === 'right') status = 'right';
    else if (pq?.result === 'part') status = 'part';
    else if (blank) status = 'blank';
    else status = 'wrong';

    return {
      index: i,
      question: {
        ...q,
        choices: orderChoices(q.type, q.choices, choiceOrders?.[q.id]),
      },
      given,
      pts: pq?.pts ?? 0,
      max: pq?.max ?? 0,
      status,
    };
  });
}

export function summarizeReview(items: ReviewItem[]): ReviewSummary {
  const total = items.length;
  let right = 0, part = 0, wrong = 0, blank = 0;
  for (const it of items) {
    if (it.status === 'right') right++;
    else if (it.status === 'part') part++;
    else if (it.status === 'blank') blank++;
    else wrong++;
  }
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);
  return {
    total,
    right,
    part,
    wrong,
    blank,
    rightPct: pct(right),
    partPct: pct(part),
    wrongPct: pct(wrong),
    blankPct: pct(blank),
  };
}

/** Tính thời gian làm bài thân thiện bằng tiếng Việt (ví dụ: "18 phút 42 giây"). */
export function formatDuration(startedAt: string | null | undefined, submittedAt: string | null | undefined): string | null {
  if (!startedAt || !submittedAt) return null;
  const diffSec = Math.max(0, Math.round((new Date(submittedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  if (!Number.isFinite(diffSec)) return null;
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;
  if (h > 0) return `${h} giờ ${m} phút`;
  if (m > 0) return s > 0 ? `${m} phút ${s} giây` : `${m} phút`;
  return `${s} giây`;
}
