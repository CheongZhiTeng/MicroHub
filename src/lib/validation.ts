export const SCHOOL_EMAIL = /^sa\d{6}@foonyewsa\.edu\.my$/;
export function isSchoolEmail(value: string): boolean {
  return value.trim() === value && SCHOOL_EMAIL.test(value);
}
export function studentId(email: string): string | null {
  return isSchoolEmail(email) ? email.slice(2, 8) : null;
}
export function validPassword(password: string): boolean {
  return password.length >= 12 && password.length <= 128;
}
export function errorMessage(error: unknown): string {
  return typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
    ? error.message
    : 'Something went wrong. Please try again.';
}
