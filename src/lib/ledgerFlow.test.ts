/**
 * Integration tests for the flows described in the feature spec: they go
 * through the same validation + builder functions the UI uses, then assert on
 * the derived balances of every account.
 */
import { describe, expect, it } from 'vitest';
import type { Account, FinanceTransaction } from '../types';
import {
  buildIncomeOrExpense,
  buildTransfer,
  computeAccountBalances,
  isLedgerError,
  validateEntry,
  validateTransfer,
  type EntryDraft,
} from './ledger';
import { toPaise } from './money';

const STAMP = '2026-10-01T00:00:00.000Z';

const makeAccount = (over: Partial<Account>): Account => ({
  id: over.id as string,
  name: over.name as string,
  type: over.type || 'savings',
  openingBalance: over.openingBalance ?? 0,
  isArchived: false,
  createdAt: STAMP,
  updatedAt: STAMP,
  ...over,
});

const createLedger = () => {
  const accounts: Account[] = [
    makeAccount({ id: 'yes', name: 'YES Bank', openingBalance: 12000 }),
    makeAccount({ id: 'indian', name: 'Indian Bank', openingBalance: 8500 }),
    makeAccount({ id: 'wallet', name: 'Cash Wallet', type: 'cash', openingBalance: 2500 }),
  ];
  let transactions: FinanceTransaction[] = [];

  const addEntry = (draft: EntryDraft) => {
    const validation = validateEntry(draft, {
      accounts,
      transactions,
      settings: { allowNegativeBalance: false },
    });
    if (isLedgerError(validation)) throw new Error(validation.message);
    const record = buildIncomeOrExpense(draft, { now: new Date(STAMP) });
    transactions = [record, ...transactions];
    return record;
  };

  const addTransfer = (draft: Parameters<typeof buildTransfer>[0]) => {
    const validation = validateTransfer(draft, {
      accounts,
      transactions,
      settings: { allowNegativeBalance: false },
    });
    if (isLedgerError(validation)) throw new Error(validation.message);
    const record = buildTransfer(draft, { now: new Date(STAMP) });
    transactions = [record, ...transactions];
    return record;
  };

  return {
    accounts,
    addEntry,
    addTransfer,
    get transactions() {
      return transactions;
    },
    balances: () => computeAccountBalances(accounts, transactions),
    balanceOf: (id: string) => computeAccountBalances(accounts, transactions).get(id),
  };
};

describe('salary and daily expenses', () => {
  it('credits salary to the chosen bank and debits only that bank for GPay', () => {
    const ledger = createLedger();

    ledger.addEntry({
      type: 'income',
      amount: 30000,
      accountId: 'yes',
      category: 'Salary',
      date: '2026-10-01',
      time: '09:15',
    });
    expect(ledger.balanceOf('yes')).toBe(toPaise(42000));

    ledger.addEntry({
      type: 'expense',
      amount: 500,
      accountId: 'yes',
      category: 'Food & Dining',
      paymentMethod: 'gpay',
      date: '2026-10-02',
      time: '13:20',
    });

    expect(ledger.balanceOf('yes')).toBe(toPaise(41500));
    // Other accounts are untouched by a GPay expense.
    expect(ledger.balanceOf('indian')).toBe(toPaise(8500));
    expect(ledger.balanceOf('wallet')).toBe(toPaise(2500));
  });

  it('adds cash income to the wallet and lets it be spent', () => {
    const ledger = createLedger();

    ledger.addEntry({
      type: 'income',
      amount: 2000,
      accountId: 'wallet',
      category: 'Gift',
      date: '2026-10-03',
    });
    expect(ledger.balanceOf('wallet')).toBe(toPaise(4500));

    ledger.addEntry({
      type: 'expense',
      amount: 200,
      accountId: 'wallet',
      category: 'Food & Dining',
      paymentMethod: 'cash',
      date: '2026-10-03',
    });
    expect(ledger.balanceOf('wallet')).toBe(toPaise(4300));
  });

  it('debits Indian Bank for a PhonePe expense', () => {
    const ledger = createLedger();

    ledger.addEntry({
      type: 'expense',
      amount: 1000,
      accountId: 'indian',
      category: 'Shopping',
      paymentMethod: 'phonepe',
      date: '2026-10-04',
    });

    expect(ledger.balanceOf('indian')).toBe(toPaise(7500));
    expect(ledger.balanceOf('yes')).toBe(toPaise(12000));
  });

  it('blocks an expense that would overdraw the wallet', () => {
    const ledger = createLedger();

    expect(() =>
      ledger.addEntry({
        type: 'expense',
        amount: 3000,
        accountId: 'wallet',
        category: 'Shopping',
        paymentMethod: 'cash',
        date: '2026-10-05',
      })
    ).toThrow(/Insufficient balance in Cash Wallet/);

    expect(ledger.balanceOf('wallet')).toBe(toPaise(2500));
    expect(ledger.transactions).toHaveLength(0);
  });
});

describe('transfers', () => {
  it('moves money from bank to wallet without affecting income or expense totals', () => {
    const ledger = createLedger();

    ledger.addTransfer({
      amount: 5000,
      fromAccountId: 'yes',
      toAccountId: 'wallet',
      date: '2026-10-06',
    });

    expect(ledger.balanceOf('yes')).toBe(toPaise(7000));
    expect(ledger.balanceOf('wallet')).toBe(toPaise(7500));
    expect(ledger.balanceOf('indian')).toBe(toPaise(8500));
    expect(ledger.transactions[0].type).toBe('transfer');
  });

  it('supports ATM withdrawal to the wallet, then cash spending', () => {
    const ledger = createLedger();

    ledger.addTransfer({
      amount: 2000,
      fromAccountId: 'indian',
      toAccountId: 'wallet',
      date: '2026-10-07',
      note: 'ATM withdrawal',
    });

    ledger.addEntry({
      type: 'expense',
      amount: 500,
      accountId: 'wallet',
      category: 'Food & Dining',
      paymentMethod: 'cash',
      date: '2026-10-07',
    });

    expect(ledger.balanceOf('indian')).toBe(toPaise(6500));
    expect(ledger.balanceOf('wallet')).toBe(toPaise(4000));
  });

  it('rejects transfers with insufficient funds', () => {
    const ledger = createLedger();
    expect(() =>
      ledger.addTransfer({
        amount: 20000,
        fromAccountId: 'indian',
        toAccountId: 'wallet',
        date: '2026-10-08',
      })
    ).toThrow(/Insufficient balance/);
    expect(ledger.balanceOf('indian')).toBe(toPaise(8500));
  });
});
