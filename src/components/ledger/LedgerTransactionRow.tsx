import React from 'react';
import {
  ArrowDownCircle,
  ArrowRight,
  ArrowUpCircle,
  Pencil,
  Trash2,
  Wallet,
} from 'lucide-react';
import type { Account, FinanceTransaction } from '../../types';
import { paymentMethodEmoji, paymentMethodLabel } from '../../data/financeCategories';
import { formatPaise, toPaise } from '../../lib/money';
import { accountDeltaPaise } from '../../lib/ledger';
import { formatClockTime, formatShortDate } from '../../lib/dateFormat';
import { Card } from '../ui/Card';

interface LedgerTransactionRowProps {
  tx: FinanceTransaction;
  accounts: Account[];
  /** Show the calendar date (history lists) instead of only the time. */
  showDate?: boolean;
  /** Running balance for the account the row was opened from. */
  accountId?: string;
  balanceAfterPaise?: number | null;
  onEdit?: (tx: FinanceTransaction) => void;
  onDelete?: (id: string) => void;
  onOpen?: (tx: FinanceTransaction) => void;
}

export const LedgerTransactionRow: React.FC<LedgerTransactionRowProps> = ({
  tx,
  accounts,
  showDate,
  accountId,
  balanceAfterPaise,
  onEdit,
  onDelete,
  onOpen,
}) => {
  const isIncome = tx.type === 'income';
  const isTransfer = tx.type === 'transfer';
  const source = accounts.find((a) => a.id === tx.accountId);
  const destination = accounts.find((a) => a.id === tx.destinationAccountId);

  const headline = isTransfer
    ? 'Transfer'
    : tx.note?.trim() || tx.category;

  const metaParts: string[] = [];
  if (showDate) metaParts.push(formatShortDate(tx.date));
  const clock = formatClockTime(tx.time);
  if (clock) metaParts.push(clock);
  if (isTransfer) {
    metaParts.push(
      `${source?.name ?? 'Unknown'} → ${destination?.name ?? 'Unknown'}`
    );
  } else {
    if (tx.note?.trim() && headline !== tx.category) metaParts.push(tx.category);
    if (source) metaParts.push(source.name);
    if (tx.paymentMethod && !isIncome) {
      metaParts.push(
        `${paymentMethodEmoji(tx.paymentMethod)} ${paymentMethodLabel(tx.paymentMethod)}`
      );
    }
  }

  // Row amount is expressed from the account being viewed, when provided.
  const signedPaise =
    accountId && !isTransfer
      ? accountDeltaPaise(tx, accountId)
      : isIncome
      ? toPaise(tx.amount)
      : -toPaise(tx.amount);

  const amountClass = isTransfer
    ? 'text-slate-600 dark:text-slate-300'
    : signedPaise >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-rose-600 dark:text-rose-400';

  const amountText = isTransfer
    ? formatPaise(toPaise(tx.amount))
    : `${signedPaise >= 0 ? '+' : '−'}${formatPaise(Math.abs(signedPaise))}`;

  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onOpen?.(tx)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
            isTransfer
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300'
              : isIncome
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
          }`}
          aria-label={`Open ${headline}`}
        >
          {isTransfer ? (
            <ArrowRight className="w-5 h-5" />
          ) : isIncome ? (
            <ArrowUpCircle className="w-5 h-5" />
          ) : (
            <ArrowDownCircle className="w-5 h-5" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onOpen?.(tx)}
          className="flex-1 min-w-0 text-left"
        >
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {headline}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {metaParts.join(' · ') || (isTransfer ? 'Transfer' : tx.category)}
          </p>
          {balanceAfterPaise != null && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              Balance {formatPaise(balanceAfterPaise)}
            </p>
          )}
        </button>

        <div className="text-right shrink-0">
          <p className={`text-sm font-black ${amountClass}`}>{amountText}</p>
          <div className="flex items-center justify-end gap-1 mt-0.5">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(tx)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Edit"
                aria-label="Edit transaction"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(tx.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Delete"
                aria-label="Delete transaction"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

interface LedgerEmptyStateProps {
  title: string;
  hint: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export const LedgerEmptyState: React.FC<LedgerEmptyStateProps> = ({
  title,
  hint,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}) => (
  <div className="text-center py-10 px-4 bg-white/80 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
    <Wallet className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">{title}</h3>
    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 max-w-xs mx-auto">{hint}</p>
    {(actionLabel || secondaryLabel) && (
      <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="px-4 py-2 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-md shadow-indigo-600/30 active:scale-95 transition-all"
          >
            {actionLabel}
          </button>
        )}
        {secondaryLabel && onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            className="px-4 py-2 min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold active:scale-95 transition-all"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    )}
  </div>
);
