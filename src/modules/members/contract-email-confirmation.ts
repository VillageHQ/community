export const CONFIRMATION_VIEWS = {
  signIn: "sign_in",
  confirm: "confirm",
  wrongAccount: "wrong_account",
  invalid: "invalid",
} as const;

export type ConfirmationView = (typeof CONFIRMATION_VIEWS)[keyof typeof CONFIRMATION_VIEWS];
