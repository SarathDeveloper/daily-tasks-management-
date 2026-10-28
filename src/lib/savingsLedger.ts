import type { Account, AccountType, FinanceTransaction, SavingsEntry } from '../types';
import type { SavingsAmount } from './savingsStreak';

/** Accounts that hold saved or invested rupees. */
export const SAVINGS_BUCKET_TYPES: readonly AccountType[] = ['savings', 'gold', 'stocks'];

export function isSavingsBucketType(type: AccountType | undefined): boolean {
  return type === 'savings' || type === 'gold' || type === 'stocks';
}

export type SavingsMoveKind = 'save' | 'reallocation';

export interface ClassifiedSavingsTransfer {
  kind: SavingsMoveKind;
  transfer: FinanceTransaction;
}

export function accountsById(accounts: Account[]): Map<string, Account> {
  return new Map(accounts.map((account) => [account.id, account]));
}

/**
 * A transfer into savings, gold, or stocks.
 * Money arriving from cash, current, or other is a new save.
 * Money moving between those buckets is a reallocation and is not new savings.
 */
export function classifySavingsTransfer(
  tx: FinanceTransaction,
  accounts: Map<string, Account>
): ClassifiedSavingsTransfer | null {
  if (tx.type !== 'transfer' || tx.amount <= 0) return null;
  const destination = tx.destinationAccountId ? accounts.get(tx.destinationAccountId) : undefined;
  const source = tx.accountId ? accounts.get(tx.accountId) : undefined;
  if (!destination || !isSavingsBucketType(destination.type) || !source) return null;
  if (isSavingsBucketType(source.type)) return { kind: 'reallocation', transfer: tx };
  return { kind: 'save', transfer: tx };
}

/**
 * Amounts that extend the streak and the saved-this-month total:
 * legacy habit logs, plus new saves. Reallocations are left out.
 */
export function countedSavingsAmounts(
  entries: SavingsEntry[],
  transactions: FinanceTransaction[],
  accounts: Account[]
): SavingsAmount[] {
  const byId = accountsById(accounts);
  const amounts: SavingsAmount[] = [];
  for (const entry of entries) {
    if (entry.amount > 0) amounts.push({ date: entry.date, amount: entry.amount });
  }
  for (const tx of transactions) {
    const classified = classifySavingsTransfer(tx, byId);
    if (classified?.kind === 'save') {
      amounts.push({ date: classified.transfer.date, amount: classified.transfer.amount });
    }
  }
  return amounts;
}

export type SavingsListRow =
  | {
      kind: 'save' | 'reallocation';
      id: string;
      date: string;
      amount: number;
      note?: string;
      createdAt: string;
      fromName: string;
      toName: string;
      transfer: FinanceTransaction;
    }
  | {
      kind: 'legacy';
      id: string;
      date: string;
      amount: number;
      note?: string;
      createdAt: string;
      entry: SavingsEntry;
    };

/** Month list: new saves, reallocations, and legacy logs that have no account. */
export function savingsRowsForMonth(
  entries: SavingsEntry[],
  transactions: FinanceTransaction[],
  accounts: Account[],
  month: string
): SavingsListRow[] {
  const byId = accountsById(accounts);
  const rows: SavingsListRow[] = [];
  for (const tx of transactions) {
    if (!tx.date.startsWith(month)) continue;
    const classified = classifySavingsTransfer(tx, byId);
    if (!classified) continue;
    const source = tx.accountId ? byId.get(tx.accountId) : undefined;
    const destination = tx.destinationAccountId ? byId.get(tx.destinationAccountId) : undefined;
    rows.push({
      kind: classified.kind,
      id: tx.id,
      date: tx.date,
      amount: tx.amount,
      note: tx.note,
      createdAt: tx.createdAt,
      fromName: source?.name || 'Unknown account',
      toName: destination?.name || 'Unknown account',
      transfer: tx,
    });
  }
  for (const entry of entries) {
    if (!entry.date.startsWith(month) || entry.amount <= 0) continue;
    rows.push({
      kind: 'legacy',
      id: entry.id,
      date: entry.date,
      amount: entry.amount,
      note: entry.note,
      createdAt: entry.createdAt,
      entry,
    });
  }
  rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  return rows;
}

export function bucketAccounts(accounts: Account[]): Account[] {
  return accounts
    .filter((account) => !account.isArchived && isSavingsBucketType(account.type))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Destination for a quick save: the remembered bucket, or the only bucket.
 * Several buckets and no memory means the caller must ask.
 */
export function resolveSavingsDestinationId(
  accounts: Account[],
  preferredId?: string
): string | undefined {
  const buckets = bucketAccounts(accounts);
  if (preferredId && buckets.some((account) => account.id === preferredId)) return preferredId;
  if (buckets.length === 1) return buckets[0].id;
  return undefined;
}
