import type { Account, FinanceTransaction, PaymentMethod } from '../types';
import { toPaise } from './money';
import { readJson, writeJson } from './persistence';
import {
  parseBankSms,
  smsFingerprint,
  type ParsedBankSms,
  type RawBankSms,
} from './bankSmsParse';

/**
 * Pending bank SMS and the ids already confirmed, dismissed, or ignored.
 * These keys are intentionally outside SyncData and backups. The raw SMS body
 * lives only until the row is confirmed or dismissed.
 */
export const BANK_SMS_PENDING_KEY = 'dayflow_bank_sms_pending_v1';
export const BANK_SMS_HANDLED_KEY = 'dayflow_bank_sms_handled_v1';
export const BANK_SMS_SCANNED_KEY = 'dayflow_bank_sms_scanned_v1';

const MAX_PENDING = 100;
const MAX_HANDLED = 2000;

export interface PendingBankSms extends ParsedBankSms {
  id: string;
  category: string;
  accountId?: string;
  receivedAt: number;
  body: string;
}

export interface BankSmsState {
  pending: PendingBankSms[];
  handled: string[];
}

export function readPendingBankSms(): PendingBankSms[] {
  return readJson<PendingBankSms[]>(BANK_SMS_PENDING_KEY, []);
}

export function readHandledBankSms(): string[] {
  return readJson<string[]>(BANK_SMS_HANDLED_KEY, []);
}

export function hasScannedBankSms(): boolean {
  return readJson<boolean>(BANK_SMS_SCANNED_KEY, false) === true;
}

export function markBankSmsScanned(): void {
  writeJson(BANK_SMS_SCANNED_KEY, true);
}

export function loadBankSmsState(): BankSmsState {
  return { pending: readPendingBankSms(), handled: readHandledBankSms() };
}

export function saveBankSmsState(state: BankSmsState): void {
  writeJson(BANK_SMS_PENDING_KEY, state.pending);
  writeJson(BANK_SMS_HANDLED_KEY, state.handled.slice(-MAX_HANDLED));
}

export function matchLastFour(lastFour: string | undefined, accounts: Account[]): string | undefined {
  if (!lastFour) return undefined;
    const matches = accounts.filter((account) => {
      if (account.isArchived) return false;
      const digits = account.lastFourDigits?.replace(/\D/g, '');
      return digits === lastFour;
    });
  return matches.length === 1 ? matches[0].id : undefined;
}

export function ingestBankMessages(
  messages: RawBankSms[],
  accounts: Account[],
  state: BankSmsState
): BankSmsState {
  const handled = new Set(state.handled);
  const pending = [...state.pending];
  const pendingIds = new Set(pending.map((item) => item.id));

  for (const message of messages) {
    const body = message.body ?? '';
    const id = smsFingerprint(message.address ?? '', body);
    if (handled.has(id) || pendingIds.has(id)) continue;
    if (pending.length >= MAX_PENDING) continue;
    const parsed = parseBankSms(message);
    if (!parsed) {
      handled.add(id);
      continue;
    }
    pending.unshift({
      ...parsed,
      id,
      category: 'Other',
      accountId: matchLastFour(parsed.lastFour, accounts),
      receivedAt: message.receivedAt,
      body,
    });
    pendingIds.add(id);
  }

  return {
    pending,
    handled: [...handled].slice(-MAX_HANDLED),
  };
}

export function dropPendingBankSms(state: BankSmsState, id: string): BankSmsState {
  if (!state.pending.some((item) => item.id === id)) return state;
  return {
    pending: state.pending.filter((item) => item.id !== id),
    handled: state.handled.includes(id) ? state.handled : [...state.handled, id].slice(-MAX_HANDLED),
  };
}

export function isPossibleDuplicate(
  pending: Pick<PendingBankSms, 'amount' | 'date' | 'type'>,
  transactions: Pick<FinanceTransaction, 'amount' | 'date' | 'type'>[]
): boolean {
  const paise = toPaise(pending.amount);
  return transactions.some(
    (tx) => tx.type === pending.type && tx.date === pending.date && toPaise(tx.amount) === paise
  );
}

export function paymentLabel(method: PaymentMethod): string {
  if (method === 'gpay') return 'GPay';
  if (method === 'phonepe') return 'PhonePe';
  if (method === 'bank_transfer') return 'Bank';
  return 'Bank';
}
