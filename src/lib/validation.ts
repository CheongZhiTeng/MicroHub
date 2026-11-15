export const SCHOOL_EMAIL = /^sa\d{6}@foonyewsa\.edu\.my$/;
export function isSchoolEmail(value: string): boolean {
  return value.trim() === value && SCHOOL_EMAIL.test(value);
}
export function studentId(email: string): string | null {
  return isSchoolEmail(email) ? email.slice(2, 8) : null;
}
export function validPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    password.length <= 128 &&
    /[A-Za-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}
export function errorMessage(error: unknown): string {
  return typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
    ? error.message
    : 'Something went wrong. Please try again.';
}

export const PASSWORD_RULE =
  'Use 8–128 characters, including at least one letter (A–Z) and one number (0–9).';
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
export function validOtp(token: string) {
  return /^[0-9]{6}$/.test(token) && token.length === 6;
}
