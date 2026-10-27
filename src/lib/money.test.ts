import { describe, expect, it } from 'vitest';
import {
  formatPaise,
  formatRupees,
  fromPaise,
  isAmountParseOk,
  parseAmountInput,
  roundRupees,
  toPaise,
} from './money';

describe('paise conversion', () => {
  it('converts rupees to integer paise', () => {
    expect(toPaise(0)).toBe(0);
    expect(toPaise(1)).toBe(100);
    expect(toPaise(12.5)).toBe(1250);
    expect(toPaise(0.1)).toBe(10);
  });

  it('avoids floating point drift when summing', () => {
    // 0.1 + 0.2 !== 0.3 in floating point; in paise the sum is exact.
    const total = toPaise(0.1) + toPaise(0.2);
    expect(total).toBe(toPaise(0.3));
    expect(fromPaise(total)).toBe(0.3);
  });

  it('round-trips through paise', () => {
    expect(fromPaise(toPaise(125000))).toBe(125000);
    expect(fromPaise(toPaise(19.99))).toBe(19.99);
  });

  it('guards against non-finite input', () => {
    expect(toPaise(Number.NaN)).toBe(0);
    expect(fromPaise(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('rounds to two decimals', () => {
    expect(roundRupees(10.005)).toBe(10.01);
    expect(roundRupees(10.004)).toBe(10);
  });
});

describe('parseAmountInput', () => {
  it('accepts plain and decorated amounts', () => {
    expect(parseAmountInput('2500')).toMatchObject({ ok: true, paise: 250000, rupees: 2500 });
    expect(parseAmountInput('1,25,000.50')).toMatchObject({ ok: true, paise: 12500050 });
    expect(parseAmountInput('₹ 99.9')).toMatchObject({ ok: true, paise: 9990 });
  });

  it('rejects empty, zero, negative and malformed input', () => {
    for (const bad of ['', '   ', '0', '0.00', '-5', 'abc', '1.234', '12..5']) {
      const result = parseAmountInput(bad);
      expect(isAmountParseOk(result)).toBe(false);
    }
  });

  it('reports an error message', () => {
    const result = parseAmountInput('');
    if (isAmountParseOk(result)) throw new Error('expected failure');
    expect(result.error).toBeTruthy();
  });
});

describe('formatting', () => {
  it('formats paise using Indian digit grouping', () => {
    expect(formatPaise(2300000)).toBe('₹23,000.00');
    expect(formatPaise(12500000)).toBe('₹1,25,000.00');
    expect(formatPaise(-50000)).toBe('-₹500.00');
  });

  it('formats rupees with two decimals', () => {
    expect(formatRupees(2500)).toBe('₹2,500.00');
    expect(formatRupees(0)).toBe('₹0.00');
  });
});
