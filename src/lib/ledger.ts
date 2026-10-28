/**
 * Money ledger domain logic.
 *
 * Balances are derived, never stored:
 *
 *   balance = openingBalance + income + transfersIn - expenses - transfersOut
 *
 * Every function here is pure so the same rules power the dashboard, account
 * detail, running balances and validation, and so they can be unit tested
 * without a browser.
 */
import type {
  Account,
  FinanceRecurrence,
  FinanceTransaction,
  LedgerSettings,
  PaymentMethod,
  TransactionType,
} from '../types';
import { fromPaise, toPaise } from './money';

// ---------------------------------------------------------------------------
// Ids & dates
// ---------------------------------------------------------------------------

export function newLedgerId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

export const todayString = (now: Date = new Date()): string => {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

export const nowTimeString = (now: Date = new Date()): string =>
  `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

export const monthKeyOf = (dateStr: string): string => dateStr.slice(0, 7);

export function shiftMonthKey(monthKey: string, offset: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthRange(monthKey: string): { from: string; to: string } {
  const [y, m] = monthKey.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { from: `${monthKey}-01`, to: `${monthKey}-${String(lastDay).padStart(2, '0')}` };
}

export function yearRange(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function weekRange(dateStr: string): { from: string; to: string } {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0 = Sunday
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const iso = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return { from: iso(start), to: iso(end) };
}

export function dayRange(dateStr: string): { from: string; to: string } {
  return { from: dateStr, to: dateStr };
}

/** Sort ascending by date, time, then creation order (oldest first). */
export function sortAscending(txs: FinanceTransaction[]): FinanceTransaction[] {
  return [...txs].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time || '00:00').localeCompare(b.time || '00:00') ||
      a.createdAt.localeCompare(b.createdAt)
  );
}

/** Sort newest first, for history lists. */
export function sortDescending(txs: FinanceTransaction[]): FinanceTransaction[] {
  return [...txs].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (b.time || '00:00').localeCompare(a.time || '00:00') ||
      b.createdAt.localeCompare(a.createdAt)
  );
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

/**
 * Signed effect of one transaction on one account, in paise.
 * Returns 0 when the transaction does not touch this account.
 */
export function accountDeltaPaise(tx: FinanceTransaction, accountId: string): number {
  const amount = toPaise(tx.amount);
  if (tx.type === 'income') return tx.accountId === accountId ? amount : 0;
  if (tx.type === 'expense') return tx.accountId === accountId ? -amount : 0;
  // transfer
  let delta = 0;
  if (tx.accountId === accountId) delta -= amount;
  if (tx.destinationAccountId === accountId) delta += amount;
  return delta;
}

/** Derived balance for every account that appears in `accounts`, in paise. */
export function computeAccountBalances(
  accounts: Account[],
  transactions: FinanceTransaction[]
): Map<string, number> {
  const balances = new Map<string, number>();
  for (const account of accounts) balances.set(account.id, toPaise(account.openingBalance));

  for (const tx of transactions) {
    if (!tx.accountId && !tx.destinationAccountId) continue;
    if (tx.accountId && balances.has(tx.accountId)) {
      balances.set(tx.accountId, (balances.get(tx.accountId) || 0) + accountDeltaPaise(tx, tx.accountId));
    }
    if (
      tx.type === 'transfer' &&
      tx.destinationAccountId &&
      tx.destinationAccountId !== tx.accountId &&
      balances.has(tx.destinationAccountId)
    ) {
      balances.set(
        tx.destinationAccountId,
        (balances.get(tx.destinationAccountId) || 0) +
          accountDeltaPaise(tx, tx.destinationAccountId)
      );
    }
  }

  return balances;
}

export function computeAccountBalance(
  account: Account,
  transactions: FinanceTransaction[]
): number {
  return computeAccountBalances([account], transactions).get(account.id) || 0;
}

export function totalActiveBalancePaise(
  accounts: Account[],
  transactions: FinanceTransaction[]
): number {
  const balances = computeAccountBalances(accounts, transactions);
  return accounts
    .filter((a) => !a.isArchived)
    .reduce((sum, a) => sum + (balances.get(a.id) || 0), 0);
}

export function cashWalletBalancePaise(
  accounts: Account[],
  transactions: FinanceTransaction[]
): number {
  const balances = computeAccountBalances(accounts, transactions);
  return accounts
    .filter((a) => !a.isArchived && a.type === 'cash')
    .reduce((sum, a) => sum + (balances.get(a.id) || 0), 0);
}

export interface AccountTotals {
  creditedPaise: number;
  debitedPaise: number;
  transfersInPaise: number;
  transfersOutPaise: number;
  netPaise: number;
  count: number;
}

export function accountTotals(
  accountId: string,
  transactions: FinanceTransaction[]
): AccountTotals {
  let credited = 0;
  let debited = 0;
  let transfersIn = 0;
  let transfersOut = 0;
  let count = 0;

  for (const tx of transactions) {
    if (tx.type === 'income' && tx.accountId === accountId) {
      credited += toPaise(tx.amount);
      count++;
    } else if (tx.type === 'expense' && tx.accountId === accountId) {
      debited += toPaise(tx.amount);
      count++;
    } else if (tx.type === 'transfer') {
      if (tx.accountId === accountId) {
        transfersOut += toPaise(tx.amount);
        count++;
      }
      if (tx.destinationAccountId === accountId) {
        transfersIn += toPaise(tx.amount);
        count++;
      }
    }
  }

  return {
    creditedPaise: credited,
    debitedPaise: debited,
    transfersInPaise: transfersIn,
    transfersOutPaise: transfersOut,
    netPaise: credited + transfersIn - debited - transfersOut,
    count,
  };
}

export interface AccountLedgerRow {
  tx: FinanceTransaction;
  deltaPaise: number;
  balanceAfterPaise: number;
}

/** Account history in chronological order with the running balance per row. */
export function withRunningBalances(
  account: Account,
  transactions: FinanceTransaction[]
): AccountLedgerRow[] {
  const related = sortAscending(
    transactions.filter(
      (tx) => tx.accountId === account.id || tx.destinationAccountId === account.id
    )
  );
  let balance = toPaise(account.openingBalance);
  return related.map((tx) => {
    const deltaPaise = accountDeltaPaise(tx, account.id);
    balance += deltaPaise;
    return { tx, deltaPaise, balanceAfterPaise: balance };
  });
}

/** Balance right after a specific transaction, or null when not related. */
export function balanceAfterTransaction(
  account: Account,
  transactions: FinanceTransaction[],
  txId: string
): number | null {
  const rows = withRunningBalances(account, transactions);
  const row = rows.find((r) => r.tx.id === txId);
  return row ? row.balanceAfterPaise : null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type LedgerErrorCode =
  | 'invalid-amount'
  | 'account-required'
  | 'account-not-found'
  | 'account-archived'
  | 'same-account'
  | 'insufficient-balance';

export type LedgerValidation =
  | { ok: true }
  | LedgerValidationFailure;

export interface LedgerValidationFailure {
  ok: false;
  code: LedgerErrorCode;
  message: string;
}

/** Boolean discriminants do not narrow without strictNullChecks. */
export const isLedgerError = (
  validation: LedgerValidation
): validation is LedgerValidationFailure => validation.ok === false;

export const VALID: LedgerValidation = { ok: true };

export interface EntryDraft {
  /** Present when editing an existing record. */
  id?: string;
  type: 'income' | 'expense';
  amount: number;
  accountId?: string;
  category: string;
  note?: string;
  paymentMethod?: PaymentMethod;
  date: string;
  time?: string;
  recurrence?: FinanceRecurrence;
  recurrenceGroupId?: string;
}

export interface TransferDraft {
  id?: string;
  amount: number;
  fromAccountId?: string;
  toAccountId?: string;
  date: string;
  time?: string;
  note?: string;
  /** Optional ATM withdrawal fee, recorded as its own linked expense. */
  atmFee?: number;
  /** Category used for the ATM fee expense. */
  feeCategory?: string;
  feePaymentMethod?: PaymentMethod;
}

export interface ValidationContext {
  accounts: Account[];
  transactions: FinanceTransaction[];
  settings?: Pick<LedgerSettings, 'allowNegativeBalance'>;
}

/**
 * Balance available to spend from an account, excluding the record being
 * edited so re-saving a larger amount does not look like an overdraft.
 */
export function availableBalancePaise(
  account: Account,
  transactions: FinanceTransaction[],
  ignoreTxId?: string
): number {
  return computeAccountBalance(
    account,
    ignoreTxId ? transactions.filter((tx) => tx.id !== ignoreTxId) : transactions
  );
}

function findAccount(ctx: ValidationContext, accountId?: string) {
  if (!accountId) return { error: 'account-required' as const };
  const account = ctx.accounts.find((a) => a.id === accountId);
  if (!account) return { error: 'account-not-found' as const };
  return { account };
}

export function validateEntry(
  draft: EntryDraft,
  ctx: ValidationContext
): LedgerValidation {
  const amountPaise = toPaise(draft.amount);
  if (!Number.isFinite(draft.amount) || amountPaise <= 0) {
    return { ok: false, code: 'invalid-amount', message: 'Enter an amount greater than zero.' };
  }

  // Compatibility: a user who has not created any ledger account yet can keep
  // recording plain income/expense entries (they show as "Unassigned").
  if (!draft.accountId && ctx.accounts.length === 0) return VALID;

  const found = findAccount(ctx, draft.accountId);
  if ('error' in found) {
    return found.error === 'account-required'
      ? { ok: false, code: 'account-required', message: 'Choose the account to use.' }
      : { ok: false, code: 'account-not-found', message: 'That account no longer exists.' };
  }
  const account = found.account;

  // Editing a record that lives on a now-archived account must stay possible.
  const original = draft.id ? ctx.transactions.find((tx) => tx.id === draft.id) : undefined;
  const editedAccountId = original?.accountId;
  if (account.isArchived && account.id !== editedAccountId) {
    return {
      ok: false,
      code: 'account-archived',
      message: `${account.name} is archived. Pick an active account.`,
    };
  }

  if (draft.type === 'expense' && !ctx.settings?.allowNegativeBalance) {
    const available = availableBalancePaise(account, ctx.transactions, draft.id);
    if (amountPaise > available) {
      return {
        ok: false,
        code: 'insufficient-balance',
        message: `Insufficient balance in ${account.name}. Available ${formatPaiseAmount(available)}.`,
      };
    }
  }

  return VALID;
}

export function validateTransfer(
  draft: TransferDraft,
  ctx: ValidationContext
): LedgerValidation {
  const amountPaise = toPaise(draft.amount);
  if (!Number.isFinite(draft.amount) || amountPaise <= 0) {
    return { ok: false, code: 'invalid-amount', message: 'Enter an amount greater than zero.' };
  }

  const from = findAccount(ctx, draft.fromAccountId);
  if ('error' in from) {
    return from.error === 'account-required'
      ? { ok: false, code: 'account-required', message: 'Choose the account to transfer from.' }
      : { ok: false, code: 'account-not-found', message: 'The source account no longer exists.' };
  }
  const to = findAccount(ctx, draft.toAccountId);
  if ('error' in to) {
    return to.error === 'account-required'
      ? { ok: false, code: 'account-required', message: 'Choose the account to transfer to.' }
      : { ok: false, code: 'account-not-found', message: 'The destination account no longer exists.' };
  }

  if (from.account.id === to.account.id) {
    return {
      ok: false,
      code: 'same-account',
      message: 'Source and destination must be different accounts.',
    };
  }

  const original = draft.id ? ctx.transactions.find((tx) => tx.id === draft.id) : undefined;
  if (from.account.isArchived && from.account.id !== original?.accountId) {
    return {
      ok: false,
      code: 'account-archived',
      message: `${from.account.name} is archived. Pick an active account.`,
    };
  }
  if (to.account.isArchived && to.account.id !== original?.destinationAccountId) {
    return {
      ok: false,
      code: 'account-archived',
      message: `${to.account.name} is archived. Pick an active account.`,
    };
  }

  if (!ctx.settings?.allowNegativeBalance) {
    const available = availableBalancePaise(from.account, ctx.transactions, draft.id);
    // A new transfer also debits its ATM fee from the same account.
    const feePaise =
      !draft.id && draft.atmFee && draft.atmFee > 0 ? toPaise(draft.atmFee) : 0;
    if (amountPaise + feePaise > available) {
      return {
        ok: false,
        code: 'insufficient-balance',
        message: `Insufficient balance in ${from.account.name}. Available ${formatPaiseAmount(available)}.`,
      };
    }
  }

  if (draft.atmFee !== undefined && draft.atmFee !== null) {
    const feePaise = toPaise(draft.atmFee);
    if (!Number.isFinite(draft.atmFee) || feePaise < 0) {
      return { ok: false, code: 'invalid-amount', message: 'Enter a valid ATM fee.' };
    }
  }

  return VALID;
}

function formatPaiseAmount(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(fromPaise(paise));
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export interface BuildOptions {
  userId?: string;
  now?: Date;
}

export function buildIncomeOrExpense(
  draft: EntryDraft,
  options: BuildOptions = {}
): FinanceTransaction {
  const now = options.now ?? new Date();
  const stamp = now.toISOString();
  return {
    id: draft.id ?? newLedgerId('fin'),
    userId: options.userId,
    type: draft.type,
    amount: fromPaise(toPaise(draft.amount)),
    category: draft.category,
    note: draft.note?.trim() || undefined,
    date: draft.date,
    time: draft.time,
    paymentMethod: draft.paymentMethod,
    accountId: draft.accountId,
    recurrence: draft.recurrence ?? { type: 'none' },
    recurrenceGroupId: draft.recurrenceGroupId,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function buildTransfer(
  draft: TransferDraft,
  options: BuildOptions = {}
): FinanceTransaction {
  const now = options.now ?? new Date();
  const stamp = now.toISOString();
  return {
    id: draft.id ?? newLedgerId('fin'),
    userId: options.userId,
    type: 'transfer',
    amount: fromPaise(toPaise(draft.amount)),
    category: 'Transfer',
    note: draft.note?.trim() || undefined,
    date: draft.date,
    time: draft.time,
    accountId: draft.fromAccountId,
    destinationAccountId: draft.toAccountId,
    recurrence: { type: 'none' },
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function buildAtmFee(
  transfer: Pick<FinanceTransaction, 'id' | 'accountId' | 'date'>,
  feeRupees: number,
  options: BuildOptions & { category?: string; paymentMethod?: PaymentMethod } = {}
): FinanceTransaction {
  const now = options.now ?? new Date();
  const stamp = now.toISOString();
  return {
    id: newLedgerId('fin'),
    userId: options.userId,
    type: 'expense',
    amount: fromPaise(toPaise(feeRupees)),
    category: options.category || 'Bills & Utilities',
    note: 'ATM withdrawal fee',
    date: transfer.date,
    time: nowTimeString(now),
    paymentMethod: options.paymentMethod || 'cash',
    accountId: transfer.accountId,
    linkedTransferId: transfer.id,
    recurrence: { type: 'none' },
    createdAt: stamp,
    updatedAt: stamp,
  };
}

// ---------------------------------------------------------------------------
// Mutations (pure; callers persist the returned array in one state update)
// ---------------------------------------------------------------------------

export function upsertTransactions(
  transactions: FinanceTransaction[],
  records: FinanceTransaction[]
): FinanceTransaction[] {
  const byId = new Map(transactions.map((tx) => [tx.id, tx]));
  for (const record of records) byId.set(record.id, record);
  return Array.from(byId.values());
}

/** Remove a record, cascading to any expense linked to it (ATM fee). */
export function removeTransactionCascade(
  transactions: FinanceTransaction[],
  id: string
): FinanceTransaction[] {
  return transactions.filter((tx) => tx.id !== id && tx.linkedTransferId !== id);
}

/** Ids removed by `removeTransactionCascade`, for cloud tombstones. */
export function idsRemovedByCascade(
  transactions: FinanceTransaction[],
  id: string
): string[] {
  return transactions
    .filter((tx) => tx.id === id || tx.linkedTransferId === id)
    .map((tx) => tx.id);
}

/**
 * Re-point existing transactions at an account (used by the migration tool for
 * entries created before accounts existed).
 */
export function assignAccountToTransactions(
  transactions: FinanceTransaction[],
  ids: string[],
  accountId: string,
  updatedAt: string = new Date().toISOString()
): FinanceTransaction[] {
  if (ids.length === 0) return transactions;
  const idSet = new Set(ids);
  return transactions.map((tx) =>
    idSet.has(tx.id) ? { ...tx, accountId, updatedAt } : tx
  );
}

/** Toggle an account's archived flag without touching its transactions. */
export function setAccountArchived(
  accounts: Account[],
  accountId: string,
  isArchived: boolean,
  updatedAt: string = new Date().toISOString()
): Account[] {
  return accounts.map((account) =>
    account.id === accountId ? { ...account, isArchived, updatedAt } : account
  );
}

// ---------------------------------------------------------------------------
// Summaries & filters
// ---------------------------------------------------------------------------

export interface LedgerSummary {
  incomePaise: number;
  expensePaise: number;
  netPaise: number;
  transfersPaise: number;
  incomeByCategory: { category: string; amountPaise: number }[];
  expenseByCategory: { category: string; amountPaise: number }[];
  incomeByAccount: { accountId: string; amountPaise: number }[];
  expenseByPaymentMethod: { paymentMethod: PaymentMethod | 'unset'; amountPaise: number }[];
  incomeCount: number;
  expenseCount: number;
  transferCount: number;
}

export interface DateRange {
  from: string;
  to: string;
}

export function inRange(dateStr: string, range: DateRange): boolean {
  return dateStr >= range.from && dateStr <= range.to;
}

function sortedGroups(map: Map<string, number>) {
  return Array.from(map.entries())
    .map(([key, amountPaise]) => ({ key, amountPaise }))
    .sort((a, b) => b.amountPaise - a.amountPaise);
}

export function summarize(
  transactions: FinanceTransaction[],
  range: DateRange,
  opts: { accountId?: string } = {}
): LedgerSummary {
  let income = 0;
  let expense = 0;
  let transfers = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let transferCount = 0;
  const incomeCats = new Map<string, number>();
  const expenseCats = new Map<string, number>();
  const incomeAccounts = new Map<string, number>();
  const expensePayments = new Map<string, number>();

  for (const tx of transactions) {
    if (!inRange(tx.date, range)) continue;
    if (opts.accountId && tx.accountId !== opts.accountId && tx.destinationAccountId !== opts.accountId) {
      continue;
    }
    const paise = toPaise(tx.amount);
    if (tx.type === 'income') {
      income += paise;
      incomeCount++;
      incomeCats.set(tx.category, (incomeCats.get(tx.category) || 0) + paise);
      const key = tx.accountId || 'unassigned';
      incomeAccounts.set(key, (incomeAccounts.get(key) || 0) + paise);
    } else if (tx.type === 'expense') {
      expense += paise;
      expenseCount++;
      expenseCats.set(tx.category, (expenseCats.get(tx.category) || 0) + paise);
      const key = tx.paymentMethod || 'unset';
      expensePayments.set(key, (expensePayments.get(key) || 0) + paise);
    } else if (tx.type === 'transfer') {
      transfers += paise;
      transferCount++;
    }
  }

  return {
    incomePaise: income,
    expensePaise: expense,
    netPaise: income - expense,
    transfersPaise: transfers,
    incomeByCategory: sortedGroups(incomeCats).map((g) => ({
      category: g.key,
      amountPaise: g.amountPaise,
    })),
    expenseByCategory: sortedGroups(expenseCats).map((g) => ({
      category: g.key,
      amountPaise: g.amountPaise,
    })),
    incomeByAccount: sortedGroups(incomeAccounts).map((g) => ({
      accountId: g.key,
      amountPaise: g.amountPaise,
    })),
    expenseByPaymentMethod: sortedGroups(expensePayments).map((g) => ({
      paymentMethod: g.key as PaymentMethod | 'unset',
      amountPaise: g.amountPaise,
    })),
    incomeCount,
    expenseCount,
    transferCount,
  };
}

export interface MonthComparison {
  month: string;
  previousMonth: string;
  current: LedgerSummary;
  previous: LedgerSummary;
  incomeDeltaPaise: number;
  expenseDeltaPaise: number;
  netDeltaPaise: number;
}

export function compareMonths(
  transactions: FinanceTransaction[],
  monthKey: string
): MonthComparison {
  const previousMonth = shiftMonthKey(monthKey, -1);
  const current = summarize(transactions, monthRange(monthKey));
  const previous = summarize(transactions, monthRange(previousMonth));
  return {
    month: monthKey,
    previousMonth,
    current,
    previous,
    incomeDeltaPaise: current.incomePaise - previous.incomePaise,
    expenseDeltaPaise: current.expensePaise - previous.expensePaise,
    netDeltaPaise: current.netPaise - previous.netPaise,
  };
}

export interface TransactionFilters {
  search?: string;
  type?: TransactionType | 'all';
  accountId?: string | 'all';
  category?: string | 'all';
  paymentMethod?: PaymentMethod | 'all';
  from?: string;
  to?: string;
}

export const EMPTY_FILTERS: TransactionFilters = {
  search: '',
  type: 'all',
  accountId: 'all',
  category: 'all',
  paymentMethod: 'all',
};

export function filterTransactions(
  transactions: FinanceTransaction[],
  filters: TransactionFilters,
  accountNames: Map<string, string> = new Map()
): FinanceTransaction[] {
  const q = filters.search?.trim().toLowerCase() || '';

  return transactions.filter((tx) => {
    if (filters.type && filters.type !== 'all' && tx.type !== filters.type) return false;
    if (filters.category && filters.category !== 'all' && tx.category !== filters.category) {
      return false;
    }
    if (
      filters.paymentMethod &&
      filters.paymentMethod !== 'all' &&
      tx.paymentMethod !== filters.paymentMethod
    ) {
      return false;
    }
    if (filters.accountId && filters.accountId !== 'all') {
      if (tx.accountId !== filters.accountId && tx.destinationAccountId !== filters.accountId) {
        return false;
      }
    }
    if (filters.from && tx.date < filters.from) return false;
    if (filters.to && tx.date > filters.to) return false;

    if (q) {
      const haystack = [
        tx.category,
        tx.note,
        tx.paymentMethod,
        tx.accountId ? accountNames.get(tx.accountId) : undefined,
        tx.destinationAccountId ? accountNames.get(tx.destinationAccountId) : undefined,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Account helpers used by the UI
// ---------------------------------------------------------------------------

export const accountLabel = (account: Account): string => {
  if (account.type === 'cash' || account.type === 'gold' || account.type === 'stocks') {
    return account.name;
  }
  return account.lastFourDigits ? `${account.name} ····${account.lastFourDigits}` : account.name;
};

export function activeAccounts(accounts: Account[]): Account[] {
  return accounts.filter((a) => !a.isArchived);
}

/** Accounts the user can post new money to, ordered cash first then by name. */
export function selectableAccounts(accounts: Account[]): Account[] {
  return activeAccounts(accounts).sort((a, b) => {
    if (a.type === 'cash' && b.type !== 'cash') return -1;
    if (b.type === 'cash' && a.type !== 'cash') return 1;
    return a.name.localeCompare(b.name);
  });
}

/** Default account: explicit preference, else the cash wallet, else the first. */
export function resolveDefaultAccountId(
  accounts: Account[],
  settings?: Pick<LedgerSettings, 'defaultAccountId'>
): string | undefined {
  const selectable = selectableAccounts(accounts);
  if (settings?.defaultAccountId && selectable.some((a) => a.id === settings.defaultAccountId)) {
    return settings.defaultAccountId;
  }
  return selectable.find((a) => a.type === 'cash')?.id ?? selectable[0]?.id;
}

export function isLowBalance(balancePaise: number): boolean {
  return balancePaise < 0;
}
