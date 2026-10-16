import type { z } from 'zod';
import { badRequest } from '../lib/errors';

/** Parses untrusted input with a Zod schema, turning failures into a 400 with field errors. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const details: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    (details[key] ??= []).push(issue.message);
  }
  throw badRequest('Please check the highlighted fields', details);
}
