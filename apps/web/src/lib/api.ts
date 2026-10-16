import type { ApiErrorBody } from "@ebook/shared";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface RequestOptions {
  method?: Method;
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Browser-side API client. Requests go to the same origin (/api/v1/...) and are proxied
 * to the Express API by a Next.js rewrite, so the HttpOnly session cookie is sent automatically.
 */
export async function api<T>(path: string, { method = "GET", body, signal }: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK", "Could not reach the server. Check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (data as ApiErrorBody | null)?.error;
    throw new ApiError(
      res.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? "Something went wrong. Please try again.",
      error?.details,
    );
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}
