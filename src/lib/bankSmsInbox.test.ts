import { beforeEach, describe, expect, it } from 'vitest';
import type { Account, FinanceTransaction } from '../types';
import {
  BANK_SMS_HANDLED_KEY,
  BANK_SMS_PENDING_KEY,
  dropPendingBankSms,
  ingestBankMessages,
  isPossibleDuplicate,
  loadBankSmsState,
  matchLastFour,
  saveBankSmsState,
  type BankSmsState,
} from './bankSmsInbox';
import { smsFingerprint } from './bankSmsParse';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  get length() {
    return this.store.size;
  }
}

const empty: BankSmsState = { pending: [], handled: [] };

const account = (over: Partial<Account> = {}): Account => ({
  id: 'acct-yes',
  name: 'YES Bank',
  type: 'savings',
  lastFourDigits: '1234',
  openingBalance: 0,
  isArchived: false,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

const debit = {
  address: 'VK-HDFCBK',
  body: 'INR 1,250.00 debited from A/c **1234 on 31-10-26 to SWIGGY. Avl Bal INR 8,432.10',
  receivedAt: Date.parse('2026-10-31T09:15:00+05:30'),
};

describe('bank SMS inbox', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
  });

  it('matches one account by the last four digits', () => {
    const yes = account();
    const other = account({ id: 'acct-sbi', name: 'SBI', lastFourDigits: '5678' });
    expect(matchLastFour('1234', [yes, other])).toBe('acct-yes');
    expect(matchLastFour('1234', [yes, account({ id: 'acct-2' })])).toBeUndefined();
    expect(matchLastFour('1234', [account({ isArchived: true })])).toBeUndefined();
    expect(matchLastFour(undefined, [yes])).toBeUndefined();
  });

  it('queues a debit and drops an OTP without storing it as pending', () => {
    const next = ingestBankMessages(
      [debit, { address: 'VK-BANK', body: '123456 is your OTP. Do not share.', receivedAt: debit.receivedAt }],
      [account()],
      empty
    );
    expect(next.pending).toHaveLength(1);
    expect(next.pending[0]).toMatchObject({
      type: 'expense',
      amount: 1250,
      accountId: 'acct-yes',
      category: 'Other',
      merchant: 'SWIGGY',
    });
    expect(next.pending[0].body).toContain('debited');
    expect(next.handled).toHaveLength(1);
    expect(next.pending.some((item) => item.body.includes('OTP'))).toBe(false);
  });

  it('does not queue a message that was already handled or is already pending', () => {
    const id = smsFingerprint(debit.address, debit.body);
    const once = ingestBankMessages([debit], [account()], empty);
    const again = ingestBankMessages([debit], [account()], once);
    expect(again.pending).toHaveLength(1);
    const dismissed = dropPendingBankSms(again, id);
    expect(dismissed.pending).toHaveLength(0);
    expect(dismissed.handled).toContain(id);
    const after = ingestBankMessages([debit], [account()], dismissed);
    expect(after.pending).toHaveLength(0);
  });

  it('keeps pending rows out of the synced storage keys', () => {
    const next = ingestBankMessages([debit], [account()], empty);
    saveBankSmsState(next);
    expect(loadBankSmsState().pending).toHaveLength(1);
    const raw = JSON.stringify({
      pending: localStorage.getItem(BANK_SMS_PENDING_KEY),
      handled: localStorage.getItem(BANK_SMS_HANDLED_KEY),
    });
    expect(raw.includes('daily_finance_transactions_v1')).toBe(false);
    expect(localStorage.getItem(BANK_SMS_PENDING_KEY)).toContain('SWIGGY');
  });

  it('flags a same-day amount that is already in the ledger', () => {
    const pending = ingestBankMessages([debit], [], empty).pending[0];
    const existing = {
      amount: 1250,
      date: '2026-10-31',
      type: 'expense',
    } as Pick<FinanceTransaction, 'amount' | 'date' | 'type'>;
    expect(isPossibleDuplicate(pending, [existing])).toBe(true);
    expect(isPossibleDuplicate(pending, [{ ...existing, amount: 40 }])).toBe(false);
    expect(isPossibleDuplicate(pending, [{ ...existing, type: 'income' }])).toBe(false);
  });
});
