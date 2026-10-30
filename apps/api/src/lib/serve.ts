import type { Response } from 'express';
import { pipeline } from 'node:stream/promises';
import { notFound } from './errors';
import { ObjectNotFoundError, storage } from './storage';

/**
 * Streams a private object to the client. The storage key itself is never exposed.
 * `cdnCacheControl` tells the website's CDN what to do, where that differs from browsers.
 */
export async function sendObject(
  res: Response,
  key: string,
  contentType: string,
  cacheControl: string,
  cdnCacheControl?: string,
): Promise<void> {
  let stream;
  try {
    stream = await storage().getStream(key);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) throw notFound('File not found');
    throw err;
  }
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', cacheControl);
  if (cdnCacheControl) res.setHeader('CDN-Cache-Control', cdnCacheControl);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  await pipeline(stream, res);
}

export async function sendBuffer(res: Response, data: Buffer, contentType: string, cacheControl: string): Promise<void> {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('Content-Length', String(data.length));
  res.end(data);
}
