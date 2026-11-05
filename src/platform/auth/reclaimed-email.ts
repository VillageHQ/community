

export const RECLAIMED_EMAIL_DOMAIN = "reclaimed.invalid";

export function isReclaimedEmail(email: string) {
  return email.endsWith(`@${RECLAIMED_EMAIL_DOMAIN}`);
}
