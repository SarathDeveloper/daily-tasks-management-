import { describe, expect, it } from 'vitest';
import type { Account, FinanceTransaction } from '../types';
import {
  accountTotals,
  assignAccountToTransactions,
  availableBalancePaise,
  balanceAfterTransaction,
  buildAtmFee,
  buildIncomeOrExpense,
  buildTransfer,
  compareMonths,
  computeAccountBalance,
  computeAccountBalances,
  filterTransactions,
  idsRemovedByCascade,
  isLedgerError,
  monthRange,
  removeTransactionCascade,
  resolveDefaultAccountId,
  selectableAccounts,
  setAccountArchived,
  summarize,
  totalActiveBalancePaise,
  upsertTransactions,
  validateEntry,
  validateTransfer,
  withRunningBalances,
  type EntryDraft,
  type TransferDraft,
} from './ledger';
import { toPaise } from './money';

const STAMP = '2026-10-01T00:00:00.000Z';

const account = (over: Partial<Account> = {}): Account => ({
  id: 'acct-yes',
  name: 'YES Bank',
  type: 'savings',
  openingBalance: 0,
  isArchived: false,
  createdAt: STAMP,
  updatedAt: STAMP,
  ...over,
});

const tx = (over: Partial<FinanceTransaction> = {}): FinanceTransaction => ({
  id: `tx-${Math.random().toString(36).slice(2, 8)}`,
  type: 'expense',
  amount: 100,
  category: 'Food & Dining',
  date: '2026-10-05',
  recurrence: { type: 'none' },
  createdAt: STAMP,
  updatedAt: STAMP,
  ...over,
});

const settings = { allowNegativeBalance: false };

describe('account balances', () => {
  it('derives balance from opening balance, income and expenses', () => {
    const yes = account({ openingBalance: 12000 });
    const wallet = account({ id: 'acct-cash', name: 'Cash Wallet', type: 'cash', openingBalance: 2500 });

    const txs = [
      tx({ id: 'salary', type: 'income', amount: 30000, accountId: yes.id, category: 'Salary' }),
      tx({ id: 'food', type: 'expense', amount: 200, accountId: wallet.id }),
      tx({ id: 'gpay', type: 'expense', amount: 500, accountId: yes.id, paymentMethod: 'gpay' }),
    ];

    const balances = computeAccountBalances([yes, wallet], txs);
    expect(balances.get(yes.id)).toBe(toPaise(12000 + 30000 - 500));
    expect(balances.get(wallet.id)).toBe(toPaise(2500 - 200));
    expect(totalActiveBalancePaise([yes, wallet], txs)).toBe(
      toPaise(12000 + 30000 - 500) + toPaise(2500 - 200)
    );
  });

  it('ignores unassigned legacy transactions', () => {
    const yes = account({ openingBalance: 1000 });
    const txs = [tx({ type: 'expense', amount: 400 })]; // no accountId
    expect(computeAccountBalances([yes], txs).get(yes.id)).toBe(toPaise(1000));
  });

  it('debits only the selected funding account for UPI expenses', () => {
    const yes = account({ id: 'yes', name: 'YES Bank', openingBalance: 12000 });
    const indian = account({ id: 'indian', name: 'Indian Bank', openingBalance: 8500 });
    const txs = [
      tx({ id: 'gpay', amount: 500, accountId: 'yes', paymentMethod: 'gpay' }),
      tx({ id: 'phonepe', amount: 1000, accountId: 'indian', paymentMethod: 'phonepe' }),
    ];
    const balances = computeAccountBalances([yes, indian], txs);
    expect(balances.get('yes')).toBe(toPaise(11500));
    expect(balances.get('indian')).toBe(toPaise(7500));
  });

  it('excludes archived accounts from the total but keeps their balance/history', () => {
    const active = account({ id: 'active', name: 'Active', openingBalance: 1000 });
    const archived = account({ id: 'old', name: 'Old', openingBalance: 500, isArchived: true });
    const txs = [tx({ amount: 200, accountId: 'old' })];

    expect(totalActiveBalancePaise([active, archived], txs)).toBe(toPaise(1000));
    expect(computeAccountBalance(archived, txs)).toBe(toPaise(300));
    expect(accountTotals('old', txs).debitedPaise).toBe(toPaise(200));
    expect(withRunningBalances(archived, txs)).toHaveLength(1);
  });

  it('sums account totals for credited, debited and transfers', () => {
    const wallet = account({ id: 'w', name: 'Cash Wallet', type: 'cash', openingBalance: 0 });
    const txs = [
      tx({ id: 'in', type: 'income', amount: 500, accountId: 'w' }),
      tx({ id: 'out', type: 'expense', amount: 100, accountId: 'w' }),
      tx({ id: 't1', type: 'transfer', amount: 200, accountId: 'b', destinationAccountId: 'w' }),
      tx({ id: 't2', type: 'transfer', amount: 50, accountId: 'w', destinationAccountId: 'b' }),
    ];
    const totals = accountTotals('w', txs);
    expect(totals.creditedPaise).toBe(toPaise(500));
    expect(totals.debitedPaise).toBe(toPaise(100));
    expect(totals.transfersInPaise).toBe(toPaise(200));
    expect(totals.transfersOutPaise).toBe(toPaise(50));
    expect(totals.netPaise).toBe(toPaise(550));
    expect(computeAccountBalance(wallet, txs)).toBe(toPaise(550));
  });

  it('computes running balances in chronological order', () => {
    const acct = account({ openingBalance: 1000 });
    const txs = [
      tx({ id: 'b', amount: 100, date: '2026-10-02', accountId: 'acct-yes' }),
      tx({ id: 'a', type: 'income', amount: 500, date: '2026-10-01', accountId: 'acct-yes' }),
      tx({ id: 'c', amount: 50, date: '2026-10-03', accountId: 'acct-yes' }),
    ];
    const rows = withRunningBalances(acct, txs);
    expect(rows.map((r) => r.tx.id)).toEqual(['a', 'b', 'c']);
    expect(rows.map((r) => r.balanceAfterPaise)).toEqual([
      toPaise(1500),
      toPaise(1400),
      toPaise(1350),
    ]);
    expect(balanceAfterTransaction(acct, txs, 'b')).toBe(toPaise(1400));
    expect(balanceAfterTransaction(acct, txs, 'missing')).toBeNull();
  });
});

describe('transfers', () => {
  const yes = account({ id: 'yes', name: 'YES Bank', openingBalance: 12000 });
  const wallet = account({ id: 'wallet', name: 'Cash Wallet', type: 'cash', openingBalance: 2500 });

  const draft: TransferDraft = {
    amount: 5000,
    fromAccountId: 'yes',
    toAccountId: 'wallet',
    date: '2026-10-10',
  };

  it('moves money between accounts and is never income or expense', () => {
    expect(isLedgerError(validateTransfer(draft, { accounts: [yes, wallet], transactions: [], settings }))).toBe(false);

    const transfer = buildTransfer(draft);
    expect(transfer.type).toBe('transfer');

    const balances = computeAccountBalances([yes, wallet], [transfer]);
    expect(balances.get('yes')).toBe(toPaise(7000));
    expect(balances.get('wallet')).toBe(toPaise(7500));

    const summary = summarize([transfer], monthRange('2026-10'));
    expect(summary.incomePaise).toBe(0);
    expect(summary.expensePaise).toBe(0);
    expect(summary.netPaise).toBe(0);
    expect(summary.transfersPaise).toBe(toPaise(5000));
  });

  it('records an ATM fee as a separate linked expense and cascades deletes', () => {
    const transfer = buildTransfer(draft);
    const fee = buildAtmFee(transfer, 21, { category: 'Bills & Utilities' });

    expect(fee.type).toBe('expense');
    expect(fee.linkedTransferId).toBe(transfer.id);
    expect(fee.accountId).toBe('yes');

    const list = upsertTransactions([], [transfer, fee]);
    expect(computeAccountBalances([yes, wallet], list).get('yes')).toBe(
      toPaise(12000 - 5000 - 21)
    );

    const summary = summarize(list, monthRange('2026-10'));
    expect(summary.expensePaise).toBe(toPaise(21));
    expect(summary.transfersPaise).toBe(toPaise(5000));

    expect(idsRemovedByCascade(list, transfer.id).sort()).toEqual([transfer.id, fee.id].sort());
    const afterDelete = removeTransactionCascade(list, transfer.id);
    expect(afterDelete).toHaveLength(0);
    expect(computeAccountBalances([yes, wallet], afterDelete).get('yes')).toBe(toPaise(12000));
  });

  it('rejects a transfer to the same account', () => {
    const result = validateTransfer(
      { ...draft, toAccountId: 'yes' },
      { accounts: [yes, wallet], transactions: [], settings }
    );
    expect(isLedgerError(result)).toBe(true);
    if (isLedgerError(result)) expect(result.code).toBe('same-account');
  });

  it('rejects a transfer that exceeds the source balance', () => {
    const result = validateTransfer(
      { ...draft, amount: 50000 },
      { accounts: [yes, wallet], transactions: [], settings }
    );
    expect(isLedgerError(result)).toBe(true);
    if (isLedgerError(result)) expect(result.code).toBe('insufficient-balance');
  });

  it('requires both accounts', () => {
    const noFrom = validateTransfer(
      { ...draft, fromAccountId: undefined },
      { accounts: [yes, wallet], transactions: [], settings }
    );
    expect(isLedgerError(noFrom)).toBe(true);

    const noTo = validateTransfer(
      { ...draft, toAccountId: undefined },
      { accounts: [yes, wallet], transactions: [], settings }
    );
    expect(isLedgerError(noTo)).toBe(true);
  });

  it('blocks transfers from an archived source', () => {
    const archived = { ...yes, isArchived: true };
    const result = validateTransfer(draft, {
      accounts: [archived, wallet],
      transactions: [],
      settings,
    });
    expect(isLedgerError(result)).toBe(true);
    if (isLedgerError(result)) expect(result.code).toBe('account-archived');
  });

  it('counts a new ATM fee against the source balance', () => {
    const almostEmpty = account({ id: 'yes', name: 'YES Bank', openingBalance: 1000 });
    const exact = validateTransfer(
      { ...draft, amount: 1000, atmFee: 21 },
      { accounts: [almostEmpty, wallet], transactions: [], settings }
    );
    expect(isLedgerError(exact)).toBe(true);
    if (isLedgerError(exact)) expect(exact.code).toBe('insufficient-balance');

    const fits = validateTransfer(
      { ...draft, amount: 979, atmFee: 21 },
      { accounts: [almostEmpty, wallet], transactions: [], settings }
    );
    expect(isLedgerError(fits)).toBe(false);
  });

  it('does not double count an existing fee when editing a transfer', () => {
    const source = account({ id: 'yes', name: 'YES Bank', openingBalance: 1000 });
    const transfer = buildTransfer({ amount: 500, fromAccountId: 'yes', toAccountId: 'wallet', date: '2026-10-10' });
    const fee = buildAtmFee(transfer, 50);
    const txs = [transfer, fee];
    // Available = 1000 - 50 (fee still applies, transfer ignored) = 950.
    const result = validateTransfer(
      { id: transfer.id, amount: 950, fromAccountId: 'yes', toAccountId: 'wallet', date: '2026-10-10', atmFee: 50 },
      { accounts: [source, wallet], transactions: txs, settings }
    );
    expect(isLedgerError(result)).toBe(false);
  });
});

describe('entry validation', () => {
  const wallet = account({ id: 'wallet', name: 'Cash Wallet', type: 'cash', openingBalance: 2500 });
  const draft: EntryDraft = {
    type: 'expense',
    amount: 200,
    accountId: 'wallet',
    category: 'Food & Dining',
    date: '2026-10-05',
  };

  it('accepts an expense within the available balance', () => {
    expect(isLedgerError(validateEntry(draft, { accounts: [wallet], transactions: [], settings }))).toBe(false);
  });

  it('rejects an expense larger than the balance with a clear message', () => {
    const result = validateEntry(
      { ...draft, amount: 3000 },
      { accounts: [wallet], transactions: [], settings }
    );
    expect(isLedgerError(result)).toBe(true);
    if (isLedgerError(result)) {
      expect(result.code).toBe('insufficient-balance');
      expect(result.message).toContain('Cash Wallet');
    }
  });

  it('allows overdraft only when the setting is enabled', () => {
    const result = validateEntry(
      { ...draft, amount: 3000 },
      { accounts: [wallet], transactions: [], settings: { allowNegativeBalance: true } }
    );
    expect(isLedgerError(result)).toBe(false);
  });

  it('rejects zero, negative and invalid amounts', () => {
    for (const amount of [0, -5, Number.NaN]) {
      const result = validateEntry(
        { ...draft, amount },
        { accounts: [wallet], transactions: [], settings }
      );
      expect(isLedgerError(result)).toBe(true);
    }
  });

  it('requires an existing, active account', () => {
    const missing = validateEntry(
      { ...draft, accountId: undefined },
      { accounts: [wallet], transactions: [], settings }
    );
    expect(isLedgerError(missing)).toBe(true);

    const unknown = validateEntry(
      { ...draft, accountId: 'nope' },
      { accounts: [wallet], transactions: [], settings }
    );
    expect(isLedgerError(unknown)).toBe(true);

    const archived = validateEntry(draft, {
      accounts: [{ ...wallet, isArchived: true }],
      transactions: [],
      settings,
    });
    expect(isLedgerError(archived)).toBe(true);
  });

  it('keeps legacy entries working before any account exists', () => {
    const result = validateEntry(
      { ...draft, accountId: undefined },
      { accounts: [], transactions: [], settings }
    );
    expect(isLedgerError(result)).toBe(false);

    // But an explicit, unknown account is still an error.
    const unknown = validateEntry(
      { ...draft, accountId: 'nope' },
      { accounts: [], transactions: [], settings }
    );
    expect(isLedgerError(unknown)).toBe(true);
  });

  it('does not double count an edited expense against the balance', () => {
    const original = buildIncomeOrExpense({
      ...draft,
      id: 'edit-me',
      amount: 2000,
    });
    const transactions = [original];
    expect(availableBalancePaise(wallet, transactions)).toBe(toPaise(500));

    // Raising 2000 -> 2400 must still fit: the old 2000 is excluded first.
    const result = validateEntry(
      { ...draft, id: 'edit-me', amount: 2400 },
      { accounts: [wallet], transactions, settings }
    );
    expect(isLedgerError(result)).toBe(false);

    // But 2600 does not fit.
    const tooMuch = validateEntry(
      { ...draft, id: 'edit-me', amount: 2600 },
      { accounts: [wallet], transactions, settings }
    );
    expect(isLedgerError(tooMuch)).toBe(true);
  });

  it('allows editing a record that sits on an archived account', () => {
    const archived = { ...wallet, isArchived: true };
    const original = buildIncomeOrExpense({ ...draft, id: 'old', accountId: 'wallet', amount: 100 });
    const result = validateEntry(
      { ...draft, id: 'old', amount: 120 },
      { accounts: [archived], transactions: [original], settings }
    );
    expect(isLedgerError(result)).toBe(false);
  });
});

describe('account helpers', () => {
  it('lists cash first and hides archived accounts from pickers', () => {
    const bank = account({ id: 'bank', name: 'YES Bank' });
    const cash = account({ id: 'cash', name: 'Cash Wallet', type: 'cash' });
    const archived = account({ id: 'old', name: 'Old Bank', isArchived: true });

    const selectable = selectableAccounts([bank, cash, archived]);
    expect(selectable.map((a) => a.id)).toEqual(['cash', 'bank']);
  });

  it('resolves the default account from settings, then the wallet', () => {
    const bank = account({ id: 'bank', name: 'YES Bank' });
    const cash = account({ id: 'cash', name: 'Cash Wallet', type: 'cash' });

    expect(resolveDefaultAccountId([bank, cash])).toBe('cash');
    expect(resolveDefaultAccountId([bank, cash], { defaultAccountId: 'bank' })).toBe('bank');
    // A stale preference falls back to the wallet.
    expect(resolveDefaultAccountId([bank, cash], { defaultAccountId: 'gone' })).toBe('cash');
    expect(resolveDefaultAccountId([], { defaultAccountId: 'gone' })).toBeUndefined();
  });

  it('re-points only the selected legacy transactions at an account', () => {
    const txs = [tx({ id: 'a' }), tx({ id: 'b' }), tx({ id: 'c' })];
    const updated = assignAccountToTransactions(txs, ['a', 'c'], 'wallet', '2026-10-20T10:00:00.000Z');

    expect(updated.find((t) => t.id === 'a')?.accountId).toBe('wallet');
    expect(updated.find((t) => t.id === 'b')?.accountId).toBeUndefined();
    expect(updated.find((t) => t.id === 'c')?.accountId).toBe('wallet');
    expect(updated.find((t) => t.id === 'a')?.updatedAt).toBe('2026-10-20T10:00:00.000Z');
    // The original array is untouched.
    expect(txs.find((t) => t.id === 'a')?.accountId).toBeUndefined();
  });

  it('archives an account without deleting its transactions', () => {
    const yes = account({ id: 'yes', openingBalance: 1000 });
    const txs = [tx({ accountId: 'yes', amount: 200 })];

    expect(selectableAccounts([yes])).toHaveLength(1);
    const [archived] = setAccountArchived([yes], 'yes', true);

    expect(archived.isArchived).toBe(true);
    expect(selectableAccounts([archived])).toHaveLength(0);
    // History and balance survive archiving.
    expect(computeAccountBalance(archived, txs)).toBe(toPaise(800));
    expect(txs).toHaveLength(1);
  });
});

describe('summaries', () => {
  const yes = account({ id: 'yes', name: 'YES Bank', openingBalance: 0 });
  const wallet = account({ id: 'wallet', name: 'Cash Wallet', type: 'cash', openingBalance: 0 });

  const txs = [
    tx({ id: 's1', type: 'income', amount: 35000, category: 'Salary', accountId: 'yes', date: '2026-10-01' }),
    tx({ id: 's2', type: 'income', amount: 5000, category: 'Freelance', accountId: 'yes', date: '2026-10-15' }),
    tx({ id: 'e1', type: 'expense', amount: 1200, category: 'Food & Dining', accountId: 'wallet', date: '2026-10-02', paymentMethod: 'cash' }),
    tx({ id: 'e2', type: 'expense', amount: 800, category: 'Transport', accountId: 'yes', date: '2026-10-31', paymentMethod: 'gpay' }),
    tx({ id: 'old', type: 'expense', amount: 999, category: 'Shopping', accountId: 'yes', date: '2026-09-30' }),
    tx({ id: 'next', type: 'expense', amount: 111, category: 'Shopping', accountId: 'yes', date: '2026-11-01' }),
    tx({ id: 't', type: 'transfer', amount: 500, accountId: 'yes', destinationAccountId: 'wallet', date: '2026-10-20' }),
  ];

  it('summarizes only the requested month', () => {
    const summary = summarize(txs, monthRange('2026-10'));
    expect(summary.incomePaise).toBe(toPaise(40000));
    expect(summary.expensePaise).toBe(toPaise(2000));
    expect(summary.netPaise).toBe(toPaise(38000));
    expect(summary.transfersPaise).toBe(toPaise(500));
    expect(summary.incomeCount).toBe(2);
    expect(summary.expenseCount).toBe(2);
  });

  it('computes the last day of the month correctly', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });

  it('breaks expenses down by category and income by source', () => {
    const summary = summarize(txs, monthRange('2026-10'));
    expect(summary.expenseByCategory).toEqual([
      { category: 'Food & Dining', amountPaise: toPaise(1200) },
      { category: 'Transport', amountPaise: toPaise(800) },
    ]);
    expect(summary.incomeByCategory).toEqual([
      { category: 'Salary', amountPaise: toPaise(35000) },
      { category: 'Freelance', amountPaise: toPaise(5000) },
    ]);
    expect(summary.expenseByPaymentMethod).toEqual([
      { paymentMethod: 'cash', amountPaise: toPaise(1200) },
      { paymentMethod: 'gpay', amountPaise: toPaise(800) },
    ]);
  });

  it('filters a summary to one account without counting transfers twice', () => {
    const summary = summarize(txs, monthRange('2026-10'), { accountId: 'yes' });
    expect(summary.incomePaise).toBe(toPaise(40000));
    expect(summary.expensePaise).toBe(toPaise(800));
    expect(summary.transfersPaise).toBe(toPaise(500));
  });

  it('compares a month with the previous one', () => {
    const comparison = compareMonths(txs, '2026-10');
    expect(comparison.previousMonth).toBe('2026-09');
    expect(comparison.current.expensePaise).toBe(toPaise(2000));
    expect(comparison.previous.expensePaise).toBe(toPaise(999));
    expect(comparison.expenseDeltaPaise).toBe(toPaise(1001));
  });
});

describe('filters', () => {
  const accounts = [account({ id: 'yes', name: 'YES Bank' }), account({ id: 'wallet', name: 'Cash Wallet', type: 'cash' })];
  const names = new Map(accounts.map((a) => [a.id, a.name]));
  const txs = [
    tx({ id: '1', type: 'expense', amount: 500, category: 'Food & Dining', note: 'Swiggy lunch', accountId: 'yes', paymentMethod: 'gpay', date: '2026-10-03' }),
    tx({ id: '2', type: 'income', amount: 30000, category: 'Salary', accountId: 'yes', date: '2026-10-01' }),
    tx({ id: '3', type: 'transfer', amount: 1000, category: 'Transfer', accountId: 'yes', destinationAccountId: 'wallet', date: '2026-10-05' }),
    tx({ id: '4', type: 'expense', amount: 100, category: 'Transport', accountId: 'wallet', paymentMethod: 'cash', date: '2026-09-28' }),
  ];

  it('searches description, category and account name', () => {
    expect(filterTransactions(txs, { search: 'swiggy' }, names).map((t) => t.id)).toEqual(['1']);
    expect(filterTransactions(txs, { search: 'cash wallet' }, names).map((t) => t.id).sort()).toEqual(['3', '4']);
    expect(filterTransactions(txs, { search: 'salary' }, names).map((t) => t.id)).toEqual(['2']);
  });

  it('filters by type, account, category, payment method and date range', () => {
    expect(filterTransactions(txs, { type: 'transfer' }, names).map((t) => t.id)).toEqual(['3']);
    expect(filterTransactions(txs, { accountId: 'wallet' }, names).map((t) => t.id).sort()).toEqual(['3', '4']);
    expect(filterTransactions(txs, { category: 'Transport' }, names).map((t) => t.id)).toEqual(['4']);
    expect(filterTransactions(txs, { paymentMethod: 'gpay' }, names).map((t) => t.id)).toEqual(['1']);
    expect(
      filterTransactions(txs, { from: '2026-10-01', to: '2026-10-31' }, names).map((t) => t.id).sort()
    ).toEqual(['1', '2', '3']);
  });
});
