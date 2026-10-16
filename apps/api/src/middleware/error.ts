import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import type { ApiErrorBody } from '@ebook/shared';
import { HttpError } from '../lib/errors';
import { logger } from '../lib/logger';

export const notFoundHandler: RequestHandler = (_req, res) => {
  const body: ApiErrorBody = { error: { code: 'NOT_FOUND', message: 'Route not found' } };
  res.status(404).json(body);
};

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // A streamed file failed mid-response: nothing more can be sent, let Express close the socket.
  if (res.headersSent) {
    logger.warn({ err, path: req.path }, 'Error after response started');
    return next(err);
  }

  if (err instanceof HttpError) {
    const body: ApiErrorBody = { error: { code: err.code, message: err.message, details: err.details } };
    res.status(err.status).json(body);
    return;
  }

  if (err instanceof multer.MulterError) {
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    res.status(tooLarge ? 413 : 400).json({
      error: {
        code: tooLarge ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        message: tooLarge ? 'The file is too large' : 'Invalid upload. Send a single file in the "file" field.',
      },
    } satisfies ApiErrorBody);
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details: Record<string, string[]> = {};
    for (const [path, e] of Object.entries(err.errors)) details[path] = [e.message];
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details } } satisfies ApiErrorBody);
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: `Invalid ${err.path}` } } satisfies ApiErrorBody);
    return;
  }

  if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'This record already exists' } } satisfies ApiErrorBody);
    return;
  }

  // Malformed JSON bodies and oversized payloads from express.json().
  if (typeof err === 'object' && err !== null && 'type' in err) {
    const type = (err as { type: string }).type;
    if (type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Malformed JSON body' } } satisfies ApiErrorBody);
      return;
    }
    if (type === 'entity.too.large') {
      res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } } satisfies ApiErrorBody);
      return;
    }
  }

  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } } satisfies ApiErrorBody);
};
