import type { PaymentMethod } from '../types';
import { nowTimeString, todayString } from './ledger';

export interface RawBankSms {
  address: string;
  body: string;
  receivedAt: number;
}

/** Fields taken from a bank debit or credit. The raw SMS is not part of this. */
export interface ParsedBankSms {
  type: 'expense' | 'income';
  /** Rupees. */
  amount: number;
  date: string;
  time?: string;
  merchant?: string;
  lastFour?: string;
  paymentMethod: PaymentMethod;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Stable id for one SMS text. Must match BankSmsStore.fingerprint on Android
 * (FNV-1a 64-bit over the trimmed, lowercased address and body).
 */
export function smsFingerprint(address: string, body: string): string {
  const normalized = `${address}\n${body}`.trim().toLowerCase().replace(/\s+/g, ' ');
  return `sms:${fnv1a64(normalized)}`;
}

export function parseBankSms(message: RawBankSms): ParsedBankSms | null {
  const body = message.body?.replace(/\s+/g, ' ').trim() ?? '';
  if (!body) return null;
  const type = movement(body);
  if (!type || isBillReminder(body)) return null;
  const amount = parseAmount(body);
  if (amount == null) return null;
  const received = new Date(message.receivedAt);
  const fallbackOk = !Number.isNaN(received.getTime());
  const date = parseSmsDate(body) ?? (fallbackOk ? todayString(received) : undefined);
  if (!date) return null;
  const time = parseSmsTime(body) ?? (fallbackOk ? nowTimeString(received) : undefined);
  return {
    type,
    amount,
    date,
    time,
    merchant: parseMerchant(body),
    lastFour: parseLastFour(body),
    paymentMethod: parsePayment(body),
  };
}

function movement(body: string): 'expense' | 'income' | null {
  const lower = body.toLowerCase();
  const expense = earliest(lower, ['debited', 'spent', 'withdrawn', 'withdrawal']);
  const sent = lower.search(/sent\s+(?:rs|inr|₹)/);
  const paid = lower.search(/\bpaid\b/);
  const paymentOf = lower.search(/payment\s+of\s+(?:rs|inr|₹)/);
  const income = earliest(lower, ['credited', 'deposited']);
  const received = lower.search(/received\s+(?:rs|inr|₹)/);
  const expenseAt = firstOf(expense, sent, paid, paymentOf);
  const incomeAt = firstOf(income, received);
  if (expenseAt == null && incomeAt == null) return null;
  if (expenseAt == null) return 'income';
  if (incomeAt == null) return 'expense';
  return expenseAt <= incomeAt ? 'expense' : 'income';
}

function earliest(haystack: string, needles: string[]): number {
  let found = -1;
  for (const needle of needles) {
    const at = haystack.indexOf(needle);
    if (at >= 0 && (found < 0 || at < found)) found = at;
  }
  return found;
}

function firstOf(...indexes: number[]): number | null {
  const values = indexes.filter((value) => value >= 0);
  if (values.length === 0) return null;
  return Math.min(...values);
}

function isBillReminder(body: string): boolean {
  const lower = body.toLowerCase();
  const posted =
    /\b(?:debited|credited|spent|withdrawn|deposited)\b/.test(lower) &&
    !/\bwill be (?:debited|deducted)\b/.test(lower);
  if (posted) return false;
  return /\b(?:is due|due on|due by|will be debited|will be deducted)\b/.test(lower);
}

function parseAmount(body: string): number | null {
  const withoutBalance = body.replace(
    /(?:avl\.?\s*(?:bal|lmt)|available\s+(?:balance|limit)|a\/c\s+bal(?:ance)?|balance)\s*[:\-]?\s*(?:inr|rs\.?|₹)?\s*[0-9][0-9,]*(?:\.\d{1,2})?/gi,
    ' '
  );
  const match = withoutBalance.match(
    /(?:(?:inr|rs\.?|₹)\s*([0-9][0-9,]*(?:\.\d{1,2})?)|([0-9][0-9,]*(?:\.\d{1,2})?)\s*(?:inr|rs\.?))/i
  );
  const raw = match?.[1] ?? match?.[2];
  if (!raw) return null;
  const amount = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) return null;
  return amount;
}

function parseSmsDate(body: string): string | null {
  const named = body.match(
    /\b(\d{1,2})[-/](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-/](\d{2,4})\b/i
  );
  if (named) {
    const month = MONTHS.indexOf(named[2].slice(0, 3).toLowerCase()) + 1;
    return ymd(expandYear(named[3]), month, Number(named[1]));
  }
  const numeric = body.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (!numeric) return null;
  return ymd(expandYear(numeric[3]), Number(numeric[2]), Number(numeric[1]));
}

function expandYear(raw: string): number {
  const year = Number(raw);
  return raw.length <= 2 ? 2000 + year : year;
}

function ymd(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseSmsTime(body: string): string | undefined {
  const match = body.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?\b/i);
  if (!match) return undefined;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || hour > 23) return undefined;
  const suffix = match[3]?.toLowerCase();
  if (suffix === 'pm' && hour < 12) hour += 12;
  if (suffix === 'am' && hour === 12) hour = 0;
  if (!suffix && hour > 23) return undefined;
  if (hour > 23) return undefined;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseLastFour(body: string): string | undefined {
  const masked = body.match(/(?:\*{2,}|x{2,})(\d{4})\b/i);
  if (masked) return masked[1];
  const ending = body.match(/\bending(?:\s+with)?\s+(\d{4})\b/i);
  if (ending) return ending[1];
  return undefined;
}

function parseMerchant(body: string): string | undefined {
  const vpa = body.match(/\b([A-Za-z0-9][A-Za-z0-9._-]{1,40}@[A-Za-z][A-Za-z0-9]{1,20})\b/);
  if (vpa) return cleanMerchant(vpa[1]);
  const to = body.match(/\bto\s+([A-Za-z0-9*][A-Za-z0-9 .&*@_-]{1,60})/i);
  const toName = to ? cleanMerchant(to[1]) : undefined;
  if (toName && !/^(?:your|a\/c|acct|account)\b/i.test(toName)) return toName;
  const at = body.match(/\bat\s+([A-Za-z0-9][A-Za-z0-9 .&_-]{1,60})/i);
  const atName = at ? cleanMerchant(at[1]) : undefined;
  if (atName && !/^(?:atm|the)\b/i.test(atName)) return atName;
  return undefined;
}

function cleanMerchant(raw: string): string | undefined {
  const cut = raw.split(/\.(?:\s|$)|\b(?:avl|available|ref|upi|bal|info|via|on)\b/i)[0] ?? '';
  const name = cut.replace(/[\s,;:|-]+$/g, '').trim();
  if (name.length < 2) return undefined;
  return name.slice(0, 48);
}

function parsePayment(body: string): PaymentMethod {
  const lower = body.toLowerCase();
  if (lower.includes('phonepe') || lower.includes('phone pe')) return 'phonepe';
  if (lower.includes('gpay') || lower.includes('google pay')) return 'gpay';
  return 'bank_transfer';
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = (1n << 64n) - 1n;
  for (let i = 0; i < value.length; i++) {
    hash ^= BigInt(value.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16);
}
