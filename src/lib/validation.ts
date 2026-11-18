export const SCHOOL_EMAIL = /^sa\d{6}@foonyewsa\.edu\.my$/;
export function isSchoolEmail(value: string): boolean {
  return value.trim() === value && SCHOOL_EMAIL.test(value);
}
export function studentId(email: string): string | null {
  return isSchoolEmail(email) ? email.slice(2, 8) : null;
}
export function passwordChecks(value: string) {
  return [
    {
      label: '8–128 characters',
      met: value.length >= 8 && value.length <= 128,
    },
    { label: 'A letter (A–Z)', met: /[A-Za-z]/.test(value) },
    { label: 'A number (0–9)', met: /[0-9]/.test(value) },
  ];
}
export function validPassword(password: string): boolean {
  return passwordChecks(password).every((rule) => rule.met);
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
