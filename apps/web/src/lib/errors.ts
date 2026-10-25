import { ApiError } from "./api";

export interface FormState {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /** Set on success when the form stays open, so the UI can link to what was created. */
  created?: { id: string; label: string };
}

const FRIENDLY: Record<string, string> = {
  SCHEDULE_DATE_ALREADY_PAID: "Some of these dates are already paid. Refresh and choose unpaid dates.",
  IDEMPOTENCY_CONFLICT: "This submission conflicts with an earlier one. Close the dialog and try again.",
  ENROLLMENT_ALREADY_EXISTS: "This contributor is already enrolled in that plan.",
  EMAIL_ALREADY_REGISTERED: "An account with this email already exists. Try signing in.",
  RATE_LIMITED: "Too many attempts. Wait a minute and try again.",
  FORBIDDEN: "You are not allowed to do that.",
};

/** Converts an API error into a plain-language form state; rethrows anything unexpected. */
export function toFormState(error: unknown): FormState {
  if (!(error instanceof ApiError)) throw error;
  const fields = error.details?.fields as Record<string, string[]> | undefined;
  return {
    ok: false,
    message: FRIENDLY[error.code] ?? error.message,
    fieldErrors: fields,
  };
}
