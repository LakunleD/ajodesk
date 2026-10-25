"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, apiRequest } from "@/lib/api";
import { isDateOnly } from "@/lib/dates";
import { toFormState, type FormState } from "@/lib/errors";
import { parseNairaToKobo } from "@/lib/money";
import { clearSession, setSession } from "@/lib/session";
import type { AuthResponse, Contribution, Contributor, Enrollment } from "@/lib/types";

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Only same-site relative paths, so `next` can't become an open redirect. */
function safeNext(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : "/contributors";
}

/** Session rejected mid-action: drop the cookie and send the collector back to sign in. */
async function rethrowAuth(error: unknown): Promise<void> {
  if (error instanceof ApiError && error.status === 401) {
    await clearSession();
    redirect("/login?expired=1");
  }
}

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  let auth: AuthResponse;
  try {
    auth = await apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      anonymous: true,
      body: { email: field(form, "email"), password: String(form.get("password") ?? "") },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { ok: false, message: "That email and password don't match an account." };
    }
    return toFormState(error);
  }
  await setSession(auth.accessToken, auth.expiresIn);
  redirect(safeNext(field(form, "next")));
}

export async function register(_prev: FormState, form: FormData): Promise<FormState> {
  let auth: AuthResponse;
  try {
    auth = await apiRequest<AuthResponse>("/auth/register", {
      method: "POST",
      anonymous: true,
      body: {
        fullName: field(form, "fullName"),
        email: field(form, "email"),
        password: String(form.get("password") ?? ""),
        ...(field(form, "phone") ? { phone: field(form, "phone") } : {}),
      },
    });
  } catch (error) {
    return toFormState(error);
  }
  await setSession(auth.accessToken, auth.expiresIn);
  redirect("/contributors");
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/login");
}

/** Stays on the list so several contributors can be added in a row. */
export async function createContributor(_prev: FormState, form: FormData): Promise<FormState> {
  let created: Contributor;
  try {
    created = await apiRequest<Contributor>("/contributors", {
      method: "POST",
      body: {
        fullName: field(form, "fullName"),
        ...(field(form, "phone") ? { phone: field(form, "phone") } : {}),
      },
    });
  } catch (error) {
    await rethrowAuth(error);
    return toFormState(error);
  }
  refresh();
  return { ok: true, message: `Added ${created.fullName}.`, created: { id: created.id, label: created.fullName } };
}

export async function createPlan(_prev: FormState, form: FormData): Promise<FormState> {
  const dailyAmountMinor = parseNairaToKobo(field(form, "dailyAmount"));
  if (dailyAmountMinor === null) {
    return { ok: false, fieldErrors: { dailyAmountMinor: ["Enter an amount in naira, e.g. 1000"] } };
  }
  try {
    await apiRequest("/plans", {
      method: "POST",
      body: {
        name: field(form, "name"),
        dailyAmountMinor,
        currency: "NGN",
        frequency: "DAILY",
        startOn: field(form, "startOn"),
        endOn: field(form, "endOn"),
      },
    });
  } catch (error) {
    await rethrowAuth(error);
    return toFormState(error);
  }
  refresh();
  return { ok: true, message: "Plan created." };
}

/**
 * With `stay=1` (plan dialog) returns success so the next contributor can be enrolled;
 * otherwise goes to the new enrollment.
 */
export async function createEnrollment(_prev: FormState, form: FormData): Promise<FormState> {
  const startOn = field(form, "startOn");
  const endOn = field(form, "endOn");
  let enrollment: Enrollment;
  try {
    enrollment = await apiRequest<Enrollment>("/enrollments", {
      method: "POST",
      body: {
        contributorId: field(form, "contributorId"),
        planId: field(form, "planId"),
        ...(startOn ? { startOn } : {}),
        ...(endOn ? { endOn } : {}),
      },
    });
  } catch (error) {
    await rethrowAuth(error);
    return toFormState(error);
  }
  if (field(form, "stay") === "1") {
    refresh();
    return {
      ok: true,
      message: `Enrolled ${enrollment.contributor.fullName}.`,
      created: { id: enrollment.id, label: enrollment.contributor.fullName },
    };
  }
  redirect(`/enrollments/${enrollment.id}`);
}

export interface RecordCashState extends FormState {
  contribution?: Contribution;
}

/**
 * Posts collector-attested cash. The amount is recomputed by the API from the plan; the
 * idempotency key comes from the confirmation dialog so retries of one submission never
 * double-post.
 */
export async function recordCash(_prev: RecordCashState, form: FormData): Promise<RecordCashState> {
  const dates = form.getAll("scheduledDates").filter((d): d is string => typeof d === "string");
  const amountMinor = Number(field(form, "amountMinor"));
  const idempotencyKey = field(form, "idempotencyKey");
  if (dates.length === 0 || !dates.every(isDateOnly) || !Number.isSafeInteger(amountMinor)) {
    return { ok: false, message: "Select at least one unpaid date." };
  }
  try {
    const contribution = await apiRequest<Contribution>("/contributions", {
      method: "POST",
      idempotencyKey,
      body: {
        enrollmentId: field(form, "enrollmentId"),
        scheduledDates: dates,
        amountMinor,
        currency: "NGN",
        paymentMethod: "CASH",
      },
    });
    refresh();
    return { ok: true, contribution };
  } catch (error) {
    await rethrowAuth(error);
    return toFormState(error);
  }
}
