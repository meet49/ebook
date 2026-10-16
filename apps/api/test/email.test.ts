import { describe, expect, it } from 'vitest';
import { parseFrom } from '../src/lib/email/transport';

describe('EMAIL_FROM parsing (Brevo sender)', () => {
  it('splits a display name and address', () => {
    expect(parseFrom('ReadnShare <no-reply@readnshare.in>')).toEqual({ name: 'ReadnShare', email: 'no-reply@readnshare.in' });
    expect(parseFrom('"Read n Share" <hi@readnshare.in>')).toEqual({ name: 'Read n Share', email: 'hi@readnshare.in' });
    expect(parseFrom('hi@readnshare.in')).toEqual({ email: 'hi@readnshare.in' });
  });
});
