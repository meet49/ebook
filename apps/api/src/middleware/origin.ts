import type { RequestHandler } from 'express';
import { allowedOrigins } from '../config/env';
import { forbidden } from '../lib/errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth (session cookies are already SameSite=Lax).
 * Browsers always send Origin on cross-origin and same-origin fetch POSTs, so a
 * present-but-foreign Origin is rejected. Requests without Origin (server-to-server,
 * e.g. payment webhooks) carry no session cookie from a browser and pass through.
 */
export const verifyOrigin: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get('origin');
  if (origin && !allowedOrigins.has(origin)) return next(forbidden('Cross-origin request blocked'));
  next();
};
