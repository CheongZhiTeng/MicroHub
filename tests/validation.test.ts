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
  test('password bounds', () => {
    expect(validPassword('x'.repeat(11))).toBe(false);
    expect(validPassword('x'.repeat(12))).toBe(true);
    expect(validPassword('x'.repeat(129))).toBe(false);
  });
});
