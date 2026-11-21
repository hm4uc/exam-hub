import { describe, expect, it } from 'vitest';
import { buildReviewItems, formatDuration, isBlankAnswer, orderChoices, summarizeReview, type ReviewQuestionInput } from './review';

const abcd = ['A', 'B', 'C', 'D'].map((label) => ({ label, html: `Option ${label}` }));
const tfChoices = ['a', 'b', 'c', 'd'].map((label) => ({ label, html: `Statement ${label}` }));

const qs: ReviewQuestionInput[] = [
  { id: 'q1', type: 'mcq', stem_html: 'Q1', choices: abcd, answer: 'B' },
  { id: 'q2', type: 'mcq', stem_html: 'Q2', choices: abcd, answer: 'C' },
  { id: 'q3', type: 'tf', stem_html: 'Q3', choices: tfChoices, answer: 'ĐSĐS' },
  { id: 'q4', type: 'short', stem_html: 'Q4', choices: [], answer: ['2,5'] },
];

describe('review domain', () => {
  it('phân loại chuẩn right / part / wrong / blank và tính phần trăm', () => {
    const items = buildReviewItems(
      qs,
      { q1: 'B', q2: 'A', q3: 'ĐS__' },
      {
        q1: { pts: 0.25, max: 0.25, result: 'right' },
        q2: { pts: 0, max: 0.25, result: 'wrong' },
        q3: { pts: 0.25, max: 1, result: 'part' },
        q4: { pts: 0, max: 0.5, result: 'wrong' },
      },
    );
    expect(items.map((x) => x.status)).toEqual(['right', 'wrong', 'part', 'blank']);
    const sum = summarizeReview(items);
    expect(sum).toEqual({
      total: 4,
      right: 1,
      part: 1,
      wrong: 1,
      blank: 1,
      rightPct: 25,
      partPct: 25,
      wrongPct: 25,
      blankPct: 25,
    });
  });

  it('nhận diện chính xác đáp án bỏ trống ở cả 3 dạng câu', () => {
    expect(isBlankAnswer('mcq', undefined)).toBe(true);
    expect(isBlankAnswer('mcq', '')).toBe(true);
    expect(isBlankAnswer('mcq', 'A')).toBe(false);
    expect(isBlankAnswer('tf', '____')).toBe(true);
    expect(isBlankAnswer('tf', 'Đ___')).toBe(false);
    expect(isBlankAnswer('short', '   ')).toBe(true);
    expect(isBlankAnswer('short', '0')).toBe(false);
  });

  it('giữ đúng thứ tự đảo phương án cho MCQ theo choice_orders', () => {
    const ordered = orderChoices('mcq', abcd, [2, 0, 3, 1]);
    expect(ordered.map((c) => c.label)).toEqual(['C', 'A', 'D', 'B']);
    expect(orderChoices('tf', tfChoices, [2, 0, 3, 1]).map((c) => c.label)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('định dạng thời gian làm bài thân thiện', () => {
    expect(formatDuration('2026-11-21T13:00:00Z', '2026-11-21T13:00:45Z')).toBe('45 giây');
    expect(formatDuration('2026-11-21T13:00:00Z', '2026-11-21T13:18:42Z')).toBe('18 phút 42 giây');
    expect(formatDuration('2026-11-21T13:00:00Z', '2026-11-21T14:05:00Z')).toBe('1 giờ 5 phút');
    expect(formatDuration('2026-11-21T13:00:00Z', null)).toBeNull();
  });
});
