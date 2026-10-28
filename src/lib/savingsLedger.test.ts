import { describe, expect, it } from 'vitest';
import type { Account, FinanceTransaction, SavingsEntry } from '../types';
import {
  buildTransfer,
  isLedgerError,
  todayString,
  validateTransfer,
  type TransferDraft,
} from './ledger';
import {
  accountsById,
  classifySavingsTransfer,
  countedSavingsAmounts,
  resolveSavingsDestinationId,
  savingsRowsForMonth,
} from './savingsLedger';
import { deriveStreakState, getLastNDaysHeatmap, getMonthlySavingsTotal } from './savingsStreak';

const STAMP = '2026-10-01T00:00:00.000Z';

const account = (over: Partial<Account> = {}): Account => ({
  id: 'acct',
  name: 'Account',
  type: 'cash',
  openingBalance: 0,
  isArchived: false,
  createdAt: STAMP,
  updatedAt: STAMP,
  ...over,
});

const transfer = (over: Partial<FinanceTransaction>): FinanceTransaction => ({
  id: 'tx',
  type: 'transfer',
  amount: 100,
  category: 'Transfer',
  date: '2026-10-28',
  recurrence: { type: 'none' },
  createdAt: STAMP,
  updatedAt: STAMP,
  ...over,
});

const legacy = (over: Partial<SavingsEntry> = {}): SavingsEntry => ({
  id: 'sav-1',
  date: '2026-10-01',
  amount: 50,
  createdAt: STAMP,
  updatedAt: STAMP,
  ...over,
});

const shift = (date: string, days: number) => {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

describe('savings transfer classification', () => {
  const cash = account({ id: 'cash', name: 'Cash', type: 'cash', openingBalance: 5000 });
  const current = account({ id: 'current', name: 'YES Bank', type: 'current', openingBalance: 20000 });
  const savings = account({ id: 'savings', name: 'Indian Bank', type: 'savings', openingBalance: 1000 });
  const gold = account({ id: 'gold', name: 'Physical gold', type: 'gold' });
  const stocks = account({ id: 'stocks', name: 'Stocks', type: 'stocks' });
  const accounts = [cash, current, savings, gold, stocks];
  const byId = accountsById(accounts);

  it('counts money moved from a spending account into savings, gold, or stocks', () => {
    expect(classifySavingsTransfer(transfer({ id: 's', accountId: 'current', destinationAccountId: 'savings', amount: 2000 }), byId)?.kind).toBe('save');
    expect(classifySavingsTransfer(transfer({ id: 'g', accountId: 'cash', destinationAccountId: 'gold', amount: 500 }), byId)?.kind).toBe('save');
    expect(classifySavingsTransfer(transfer({ id: 'k', accountId: 'current', destinationAccountId: 'stocks', amount: 1500 }), byId)?.kind).toBe('save');
  });

  it('treats a move between savings buckets as a reallocation', () => {
    const moved = transfer({ id: 'move', accountId: 'savings', destinationAccountId: 'gold', amount: 800 });
    expect(classifySavingsTransfer(moved, byId)?.kind).toBe('reallocation');
    expect(classifySavingsTransfer(transfer({ id: 'gs', accountId: 'gold', destinationAccountId: 'stocks' }), byId)?.kind).toBe('reallocation');
  });

  it('ignores transfers that do not land in a savings bucket', () => {
    expect(classifySavingsTransfer(transfer({ accountId: 'cash', destinationAccountId: 'current' }), byId)).toBeNull();
    expect(
      classifySavingsTransfer(
        transfer({ type: 'expense', accountId: 'cash', destinationAccountId: undefined, category: 'Shopping' }),
        byId
      )
    ).toBeNull();
  });

  it('counts legacy logs and new saves, and leaves reallocations out of the month total', () => {
    const month = '2026-10';
    const save = transfer({
      id: 'save',
      accountId: 'cash',
      destinationAccountId: 'gold',
      amount: 500,
      date: '2026-10-10',
    });
    const moved = transfer({
      id: 'moved',
      accountId: 'savings',
      destinationAccountId: 'stocks',
      amount: 900,
      date: '2026-10-11',
    });
    const old = legacy({ id: 'old', date: '2026-10-02', amount: 40 });
    const amounts = countedSavingsAmounts([old], [save, moved], accounts);

    expect(getMonthlySavingsTotal(amounts, month)).toBe(540);
    expect(amounts.map((row) => row.amount).sort()).toEqual([40, 500]);

    const rows = savingsRowsForMonth([old], [save, moved], accounts, month);
    expect(rows.map((row) => row.kind)).toEqual(['reallocation', 'save', 'legacy']);
  });

  it('keeps a legacy saved day on the streak and heatmap', () => {
    const today = todayString();
    const yesterday = shift(today, -1);
    const old = legacy({ date: yesterday, amount: 25 });
    const amounts = countedSavingsAmounts([old], [], accounts);
    const streak = deriveStreakState(amounts);
    const heatmap = getLastNDaysHeatmap(amounts, 30);

    expect(streak.currentStreak).toBeGreaterThanOrEqual(1);
    expect(heatmap.find((day) => day.date === yesterday)?.saved).toBe(true);
  });

  it('does not count a bucket-to-bucket move as saved today', () => {
    const today = todayString();
    const moved = transfer({
      id: 'today-move',
      accountId: 'savings',
      destinationAccountId: 'gold',
      amount: 100,
      date: today,
    });
    const amounts = countedSavingsAmounts([], [moved], accounts);
    expect(deriveStreakState(amounts).currentStreak).toBe(0);
    expect(getLastNDaysHeatmap(amounts, 30).find((day) => day.date === today)?.saved).toBe(false);
  });

  it('does not create a transfer when the source would go negative', () => {
    const wallet = account({ id: 'wallet', name: 'Cash', type: 'cash', openingBalance: 40 });
    const goldAccount = account({ id: 'gold-acct', name: 'Gold', type: 'gold' });
    const draft: TransferDraft = {
      amount: 50,
      fromAccountId: wallet.id,
      toAccountId: goldAccount.id,
      date: '2026-10-28',
    };
    const existing: FinanceTransaction[] = [];
    const validation = validateTransfer(draft, {
      accounts: [wallet, goldAccount],
      transactions: existing,
      settings: { allowNegativeBalance: false },
    });
    expect(isLedgerError(validation)).toBe(true);
    if (isLedgerError(validation)) expect(validation.code).toBe('insufficient-balance');
    const saved = isLedgerError(validation) ? existing : [...existing, buildTransfer(draft)];
    expect(saved).toHaveLength(0);
  });

  it('remembers a single bucket and asks when there are several', () => {
    expect(resolveSavingsDestinationId([cash, gold])).toBe('gold');
    expect(resolveSavingsDestinationId([cash, gold, stocks], 'stocks')).toBe('stocks');
    expect(resolveSavingsDestinationId([cash, gold, stocks])).toBeUndefined();
  });
});
