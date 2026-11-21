import { describe, expect, it } from 'vitest';
import {
  validateAssignmentCode,
  validateClassName,
  validateCloseAfterOpen,
  validateDuration,
  validateFullName,
  validateMaxAttempts,
  validatePassword,
  validatePasswordConfirm,
  validatePointValue,
  validateShortAnswerList,
  validateShortAnswerText,
  validateUsername,
} from './validation';

describe('field validation', () => {
  it('nhận diện lỗi tên đăng nhập cụ thể', () => {
    expect(validateUsername('')).toMatch(/nhập/);
    expect(validateUsername('an nguyen')).toMatch(/khoảng trắng/);
    expect(validateUsername('nguyễn.an')).toMatch(/không dấu/);
    expect(validateUsername('ab')).toMatch(/3 đến 30/);
    expect(validateUsername('an.nguyen_12')).toBeUndefined();
  });

  it('nhận diện lỗi mật khẩu và xác nhận mật khẩu', () => {
    expect(validatePassword('')).toBeTruthy();
    expect(validatePassword('', false)).toBeUndefined();
    expect(validatePassword('12345')).toMatch(/6 ký tự/);
    expect(validatePassword('123456')).toBeUndefined();
    expect(validatePasswordConfirm('123456', '123457')).toMatch(/chưa khớp/);
    expect(validatePasswordConfirm('123456', '123456')).toBeUndefined();
  });

  it('nhận diện lỗi mã đề 6 ký tự', () => {
    expect(validateAssignmentCode('')).toBeTruthy();
    expect(validateAssignmentCode('abc')).toMatch(/đúng 6/);
    expect(validateAssignmentCode('ab01lo')).toMatch(/trừ i, l, o/);
    expect(validateAssignmentCode('x5jqhe')).toBeUndefined();
  });

  it('nhận diện lỗi thời gian, số lượt, giờ mở/đóng, điểm, tên lớp, họ tên', () => {
    expect(validateDuration('0')).toBeTruthy();
    expect(validateDuration('601')).toBeTruthy();
    expect(validateDuration('45')).toBeUndefined();
    expect(validateMaxAttempts('0')).toBeTruthy();
    expect(validateMaxAttempts('21')).toBeTruthy();
    expect(validateMaxAttempts('2')).toBeUndefined();
    expect(validateCloseAfterOpen('2026-11-21T10:00:00Z', '2026-11-21T09:00:00Z')).toMatch(/sau giờ mở/);
    expect(validateCloseAfterOpen('2026-11-21T10:00:00Z', '')).toBeUndefined();
    expect(validatePointValue('-1')).toBeTruthy();
    expect(validatePointValue('11')).toBeTruthy();
    expect(validatePointValue('0,25')).toBeUndefined();
    expect(validatePointValue('', true)).toBeUndefined();
    expect(validateClassName('   ')).toBeTruthy();
    expect(validateFullName('A')).toBeTruthy();
    expect(validateFullName('Nguyễn An')).toBeUndefined();
  });

  it('nhận diện lỗi định dạng đáp án trả lời ngắn', () => {
    expect(validateShortAnswerText('')).toBeUndefined();
    expect(validateShortAnswerText('--2')).toMatch(/định dạng số/);
    expect(validateShortAnswerText('1,2,3')).toMatch(/định dạng số/);
    expect(validateShortAnswerText('-2,5')).toBeUndefined();
    expect(validateShortAnswerList([])).toBeTruthy();
    expect(validateShortAnswerList(['0,5', 'abc'])).toMatch(/chưa phải số/);
    expect(validateShortAnswerList(['0,5', '-1.25'])).toBeUndefined();
  });
});
