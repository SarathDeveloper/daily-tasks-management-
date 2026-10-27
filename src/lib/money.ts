/**
 * Money helpers.
 *
 * Amounts are persisted as rupees (so budgets, bills and existing backups stay
 * compatible) but every computation happens in integer paise. Rupees are
 * converted at the boundary, which removes floating-point drift from sums.
 */

/** Convert a rupee amount to integer paise, rounding half away from zero. */
export function toPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) return 0;
  return Math.round(rupees * 100);
}

/** Convert integer paise back to a rupee amount. */
export function fromPaise(paise: number): number {
  if (!Number.isFinite(paise)) return 0;
  return paise / 100;
}

/** Round a rupee amount to two decimals (half away from zero). */
export function roundRupees(rupees: number): number {
  return fromPaise(toPaise(rupees));
}

export interface AmountParseSuccess {
  ok: true;
  paise: number;
  rupees: number;
}

export interface AmountParseFailure {
  ok: false;
  error: string;
}

export type AmountParseResult = AmountParseSuccess | AmountParseFailure;

/**
 * Explicit guards instead of relying on boolean-discriminant narrowing, which
 * TypeScript disables when `strictNullChecks` is off (this project's config).
 */
export const isAmountParseOk = (result: AmountParseResult): result is AmountParseSuccess =>
  result.ok === true;

export const isAmountParseError = (result: AmountParseResult): result is AmountParseFailure =>
  result.ok === false;

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * Parse user input for an amount field. Rejects empty, non-numeric, zero,
 * negative and sub-paise values instead of silently coercing them.
 */
export function parseAmountInput(raw: string | number): AmountParseResult {
  const text = String(raw ?? '').trim();

  if (!text) return { ok: false, error: 'Enter an amount.' };
  if (text.startsWith('-')) return { ok: false, error: 'Amount must be greater than zero.' };

  // Allow a leading ₹ and thousands separators ("1,25,000.50").
  const cleaned = text.replace(/[₹\s,]/g, '');
  if (!AMOUNT_PATTERN.test(cleaned)) {
    return { ok: false, error: 'Enter a valid amount with up to 2 decimals.' };
  }

  const paise = Math.round(parseFloat(cleaned) * 100);
  if (!Number.isFinite(paise)) return { ok: false, error: 'Enter a valid amount.' };
  if (paise <= 0) return { ok: false, error: 'Amount must be greater than zero.' };

  return { ok: true, paise, rupees: fromPaise(paise) };
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrCompactFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** Format integer paise as `₹1,25,000.00` (Indian digit grouping). */
export function formatPaise(paise: number): string {
  return inrFormatter.format(fromPaise(paise));
}

/** Format a rupee amount as `₹1,25,000.00`. */
export function formatRupees(rupees: number): string {
  return inrFormatter.format(Number.isFinite(rupees) ? rupees : 0);
}

/** Format rupees without decimals, for dense chips and axis labels. */
export function formatRupeesCompact(rupees: number): string {
  return inrCompactFormatter.format(Number.isFinite(rupees) ? rupees : 0);
}

/** Split a signed amount into its absolute display value and sign prefix. */
export function signedAmount(rupees: number): { sign: '+' | '−' | ''; value: string } {
  if (rupees > 0) return { sign: '+', value: formatRupees(rupees) };
  if (rupees < 0) return { sign: '−', value: formatRupees(Math.abs(rupees)) };
  return { sign: '', value: formatRupees(0) };
}
