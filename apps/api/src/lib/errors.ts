export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, details?: Record<string, string[]>) =>
  new HttpError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Please sign in to continue') =>
  new HttpError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have access to this resource') =>
  new HttpError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Not found') => new HttpError(404, 'NOT_FOUND', message);
export const conflict = (message: string) => new HttpError(409, 'CONFLICT', message);
