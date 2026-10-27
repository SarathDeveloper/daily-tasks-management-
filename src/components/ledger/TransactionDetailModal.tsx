import React from 'react';
import { ArrowRight, Pencil, Trash2, X } from 'lucide-react';
import type { Account, FinanceTransaction } from '../../types';
import { paymentMethodEmoji, paymentMethodLabel } from '../../data/financeCategories';
import { formatPaise, toPaise } from '../../lib/money';
import { formatClockTime, formatLongDate } from '../../lib/dateFormat';
import { Button } from '../ui/Button';

interface TransactionDetailModalProps {
  tx: FinanceTransaction | null;
  accounts: Account[];
  balanceAfterPaise?: number | null;
  onClose: () => void;
  onEdit: (tx: FinanceTransaction) => void;
  onDelete: (id: string) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  tx,
  accounts,
  balanceAfterPaise,
  onClose,
  onEdit,
  onDelete,
}) => {
  if (!tx) return null;

  const source = accounts.find((a) => a.id === tx.accountId);
  const destination = accounts.find((a) => a.id === tx.destinationAccountId);
  const isTransfer = tx.type === 'transfer';
  const isIncome = tx.type === 'income';

  const rows: { label: string; value: string }[] = [];
  rows.push({ label: 'Date', value: formatLongDate(tx.date) });
  if (tx.time) rows.push({ label: 'Time', value: formatClockTime(tx.time) });
  rows.push({ label: 'Type', value: isTransfer ? 'Transfer' : isIncome ? 'Income' : 'Expense' });
  if (!isTransfer) rows.push({ label: 'Category', value: tx.category });
  if (isTransfer) {
    rows.push({ label: 'From', value: source?.name ?? 'Unknown account' });
    rows.push({ label: 'To', value: destination?.name ?? 'Unknown account' });
  } else {
    rows.push({
      label: isIncome ? 'Credited to' : 'Paid from',
      value: source?.name ?? 'Unassigned',
    });
    if (tx.paymentMethod && !isIncome) {
      rows.push({
        label: 'Payment method',
        value: `${paymentMethodEmoji(tx.paymentMethod)} ${paymentMethodLabel(tx.paymentMethod)}`,
      });
    }
  }
  if (tx.note) rows.push({ label: 'Description', value: tx.note });
  if (balanceAfterPaise != null) {
    rows.push({ label: 'Balance after', value: formatPaise(balanceAfterPaise) });
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Transaction</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="text-center">
            <p
              className={`text-3xl font-black tracking-tight ${
                isTransfer
                  ? 'text-slate-700 dark:text-slate-200'
                  : isIncome
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {isTransfer ? '' : isIncome ? '+' : '−'}
              {formatPaise(toPaise(tx.amount))}
            </p>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-center gap-1">
              {isTransfer ? (
                <>
                  {source?.name ?? 'Unknown'}
                  <ArrowRight className="w-3.5 h-3.5" />
                  {destination?.name ?? 'Unknown'}
                </>
              ) : (
                tx.note || tx.category
              )}
            </p>
          </div>

          <dl className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-b border-slate-100 dark:border-slate-800">
            {rows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-3 py-2.5">
                <dt className="text-xs text-slate-500 dark:text-slate-400">{row.label}</dt>
                <dd className="text-xs font-semibold text-slate-900 dark:text-white text-right break-words">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                onClose();
                onEdit(tx);
              }}
            >
              <Pencil className="w-4 h-4" />
              Edit
            </Button>
            <Button
              type="button"
              variant="danger"
              className="flex-1"
              onClick={() => {
                onClose();
                onDelete(tx.id);
              }}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
