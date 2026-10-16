import { describe, expect, it } from 'vitest';
import { formatINR, paiseToRupeesString, rupeesToPaise } from './money';

describe('money', () => {
  it('converts rupees to paise without float drift', () => {
    expect(rupeesToPaise('1000')).toBe(100000);
    expect(rupeesToPaise('0.1')).toBe(10);
    expect(rupeesToPaise('19.99')).toBe(1999);
    expect(rupeesToPaise(0.29)).toBe(29);
  });

  it('rejects invalid amounts', () => {
    expect(() => rupeesToPaise('-1')).toThrow();
    expect(() => rupeesToPaise('1.234')).toThrow();
    expect(() => rupeesToPaise('abc')).toThrow();
  });

  it('formats paise', () => {
    expect(paiseToRupeesString(100005)).toBe('1000.05');
    expect(formatINR(100000)).toBe('₹1,000');
  });
});
