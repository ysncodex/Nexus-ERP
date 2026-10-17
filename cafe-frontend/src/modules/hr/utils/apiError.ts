import { isAxiosError } from 'axios';

type ApiErrorBody = { message?: string; issues?: { message?: string }[] };

/** User-safe message from an HR API failure (server validation text when available). */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) return 'Cannot reach the server. Check your connection and try again.';
    const body = error.response.data;
    if (error.response.status === 403) return 'Only the owner can manage staff and payroll.';
    return body?.issues?.[0]?.message || body?.message || fallback;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
