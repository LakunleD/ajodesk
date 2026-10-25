import "server-only";
import { notFound, redirect } from "next/navigation";
import { getSessionToken } from "./session";
import type { ApiErrorBody } from "./types";

const API_URL = (process.env.API_URL ?? "http://localhost:3001").replace(/\/$/, "");
/** Hosts that sleep when idle (e.g. Render free) need longer for the first request. */
const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS ?? 15_000);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly requestId?: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  idempotencyKey?: string;
  /** Send without the session cookie (login/register). */
  anonymous?: boolean;
}

/**
 * Server-side call to the AjoDesk API. Always uncached: these are live financial records.
 * Throws ApiError for API errors and for an unreachable API (code SERVICE_UNAVAILABLE).
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (!options.anonymous) {
    const token = await getSessionToken();
    if (!token) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in");
    headers.Authorization = `Bearer ${token}`;
  }
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(
      503,
      "SERVICE_UNAVAILABLE",
      "AjoDesk is not reachable right now. Nothing was confirmed; please try again.",
    );
  }

  const text = await response.text();
  const json: unknown = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    const error = (json as ApiErrorBody | undefined)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "INTERNAL_ERROR",
      error?.message ?? `Request failed (${response.status})`,
      error?.details,
      error?.requestId,
    );
  }
  return json as T;
}

/**
 * For Server Component reads: 401 → clear the session and sign in again, 404 → not-found page, anything else
 * propagates to the nearest error boundary.
 */
export async function apiGet<T>(path: string): Promise<T> {
  try {
    return await apiRequest<T>(path);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/session/expired");
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}
