import { describe, expect, it } from 'vitest';
import { assignmentCodeFromPath, loginCandidates, maxLocalLength, withTeacherPrefix, withoutTeacherPrefix } from './tenant';

describe('tên đăng nhập theo giáo viên', () => {
  it('thêm tiền tố một lần, không lặp', () => {
    expect(withTeacherPrefix('gva', 'An')).toBe('gva.an');
    expect(withTeacherPrefix('gva', 'gva.an')).toBe('gva.an');
    expect(withTeacherPrefix(null, 'An')).toBe('an');
  });
  it('bỏ tiền tố để hiển thị', () => {
    expect(withoutTeacherPrefix('gva', 'gva.an')).toBe('an');
    expect(withoutTeacherPrefix('gva', 'other.an')).toBe('other.an');
    expect(withoutTeacherPrefix(null, 'gva.an')).toBe('gva.an');
  });
  it('độ dài còn lại sau tiền tố', () => {
    expect(maxLocalLength('gva')).toBe(26);
    expect(maxLocalLength(null)).toBe(30);
  });
  it('thử tên có tiền tố trước, tên gõ nguyên sau', () => {
    expect(loginCandidates(' An ', 'gva')).toEqual(['gva.an', 'an']);
    expect(loginCandidates('gva.an', 'gva')).toEqual(['gva.an']);
    expect(loginCandidates('an', null)).toEqual(['an']);
  });
  it('lấy mã bài giao từ đường dẫn', () => {
    expect(assignmentCodeFromPath('/abc234')).toBe('abc234');
    expect(assignmentCodeFromPath('/ABC234/lam')).toBe('abc234');
    expect(assignmentCodeFromPath('/gv/de')).toBeNull();
    expect(assignmentCodeFromPath('/abc2345')).toBeNull();
  });
});
