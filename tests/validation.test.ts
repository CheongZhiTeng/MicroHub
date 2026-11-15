import { isSchoolEmail, studentId, validPassword } from '../src/lib/validation';
describe('school account validation', () => {
  test.each(['sa000001@foonyewsa.edu.my', 'sa999999@foonyewsa.edu.my'])(
    'accepts %s',
    (email) => expect(isSchoolEmail(email)).toBe(true),
  );
  test.each([
    'sa12345@foonyewsa.edu.my',
    'sa1234567@foonyewsa.edu.my',
    'sa123456@foonyewsaXeduXmy',
    'SA123456@foonyewsa.edu.my',
    'sa123456@evil.edu.my',
    'sa１２３４５６@foonyewsa.edu.my',
    ' sa123456@foonyewsa.edu.my',
    'sa123456@foonyewsa.edu.my\n',
  ])('rejects %s', (email) => expect(isSchoolEmail(email)).toBe(false));
  test('preserves leading zeroes in student ID', () =>
    expect(studentId('sa000012@foonyewsa.edu.my')).toBe('000012'));
  test('does not derive IDs from invalid addresses', () =>
    expect(studentId('admin@example.com')).toBeNull());
  test.each(['abcdef12', 'A1234567', 'a1' + 'x'.repeat(126)])(
    'accepts valid password boundaries %s',
    (password) => expect(validPassword(password)).toBe(true),
  );
  test.each([
    '',
    'abc1234',
    'abcdefgh',
    '12345678',
    '中文中文1234',
    'a1' + 'x'.repeat(127),
  ])('rejects invalid password %s', (password) =>
    expect(validPassword(password)).toBe(false),
  );
});
