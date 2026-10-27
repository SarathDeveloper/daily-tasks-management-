import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, X } from 'lucide-react';
import type { Account, FinanceTransaction, LedgerSettings } from '../../types';
import { AccountPicker } from './AccountPicker';
import { Button } from '../ui/Button';
import { formatPaise, isAmountParseOk, parseAmountInput } from '../../lib/money';
import {
  computeAccountBalances,
  resolveDefaultAccountId,
  todayString,
  nowTimeString,
  isLedgerError,
  validateTransfer,
  type TransferDraft,
} from '../../lib/ledger';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Return false to keep the modal open (validation refused the transfer). */
  onSave: (draft: TransferDraft) => boolean | void;
  accounts: Account[];
  transactions: FinanceTransaction[];
  ledgerSettings: LedgerSettings[];
  initialTransfer?: FinanceTransaction | null;
  selectedDate: string;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  onSave,
  accounts,
  transactions,
  ledgerSettings,
  initialTransfer,
  selectedDate,
}) => {
  const settings = ledgerSettings[0];
  const [fromAccountId, setFromAccountId] = useState<string | undefined>();
  const [toAccountId, setToAccountId] = useState<string | undefined>();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(selectedDate || todayString());
  const [time, setTime] = useState(nowTimeString());
  const [note, setNote] = useState('');
  const [feeEnabled, setFeeEnabled] = useState(false);
  const [fee, setFee] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setIsSubmitting(false);
    const active = accounts.filter((a) => !a.isArchived);
    if (initialTransfer) {
      setFromAccountId(initialTransfer.accountId);
      setToAccountId(initialTransfer.destinationAccountId);
      setAmount(String(initialTransfer.amount));
      setDate(initialTransfer.date);
      setTime(initialTransfer.time || nowTimeString());
      setNote(initialTransfer.note || '');
      setFeeEnabled(false);
      setFee('');
    } else {
      const from = resolveDefaultAccountId(accounts, settings);
      setFromAccountId(from);
      setToAccountId(active.find((a) => a.id !== from)?.id);
      setAmount('');
      setDate(selectedDate || todayString());
      setTime(nowTimeString());
      setNote('');
      setFeeEnabled(false);
      setFee('');
    }
  }, [isOpen, initialTransfer, accounts, settings, selectedDate]);

  const balances = useMemo(
    () => computeAccountBalances(accounts, transactions),
    [accounts, transactions]
  );

  const active = useMemo(
    () =>
      accounts.filter(
        (a) =>
          !a.isArchived ||
          a.id === initialTransfer?.accountId ||
          a.id === initialTransfer?.destinationAccountId
      ),
    [accounts, initialTransfer?.accountId, initialTransfer?.destinationAccountId]
  );

  const amountPaise = useMemo(() => {
    const parsed = parseAmountInput(amount);
    return isAmountParseOk(parsed) ? parsed.paise : 0;
  }, [amount]);

  const projected = useMemo(() => {
    const map = new Map<string, number>();
    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) return map;
    map.set(fromAccountId, (balances.get(fromAccountId) || 0) - amountPaise);
    map.set(toAccountId, (balances.get(toAccountId) || 0) + amountPaise);
    return map;
  }, [balances, fromAccountId, toAccountId, amountPaise]);

  /** Keep source and destination distinct when the user switches accounts. */
  const handleFromChange = (id: string) => {
    setFromAccountId(id);
    if (toAccountId === id) {
      const next = active.find((a) => a.id !== id);
      setToAccountId(next?.id);
    }
  };

  const handleToChange = (id: string) => setToAccountId(id);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const parsed = parseAmountInput(amount);
    if (!isAmountParseOk(parsed)) {
      setError(parsed.error);
      return;
    }

    let feeRupees: number | undefined;
    if (feeEnabled && fee.trim() !== '') {
      const parsedFee = parseAmountInput(fee);
      if (!isAmountParseOk(parsedFee)) {
        setError(parsedFee.error);
        return;
      }
      feeRupees = parsedFee.rupees;
    }

    const draft: TransferDraft = {
      id: initialTransfer?.id,
      amount: parsed.rupees,
      fromAccountId,
      toAccountId,
      date,
      time,
      note: note.trim() || undefined,
      atmFee: feeRupees,
    };

    const validation = validateTransfer(draft, {
      accounts,
      transactions,
      settings: settings || { allowNegativeBalance: false },
    });
    if (isLedgerError(validation)) {
      setError(validation.message);
      return;
    }

    setIsSubmitting(true);
    const saved = onSave(draft);
    if (saved === false) {
      setIsSubmitting(false);
      return;
    }
    onClose();
  };

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-t-2xl sm:rounded-2xl w-full min-w-0 max-w-md max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            {initialTransfer ? 'Edit Transfer' : 'Transfer Money'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-sm">
          {error && (
            <p
              role="alert"
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl px-3 py-2"
            >
              {error}
            </p>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold">
                ₹
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3.5 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-lg"
                autoFocus
              />
            </div>
            {fromAccount && amountPaise > 0 && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {fromAccount.name}: {formatPaise(balances.get(fromAccount.id) || 0)} →{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {formatPaise(projected.get(fromAccount.id) || 0)}
                </span>
              </p>
            )}
          </div>

          <AccountPicker
            label="From account"
            accounts={active}
            balances={balances}
            value={fromAccountId}
            onChange={handleFromChange}
            projectedBalances={projected}
          />

          <AccountPicker
            label="To account"
            accounts={active}
            balances={balances}
            value={toAccountId}
            onChange={handleToChange}
            excludeId={fromAccountId}
            projectedBalances={projected}
            emptyHint="Add a second account to transfer between accounts."
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={feeEnabled}
              onChange={(e) => setFeeEnabled(e.target.checked)}
              className="w-4 h-4 accent-indigo-600"
            />
            ATM withdrawal fee (recorded as a separate expense)
          </label>

          {feeEnabled && (
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold">
                ₹
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="ATM fee"
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3.5 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. ATM withdrawal"
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {fromAccount && toAccount && fromAccount.id !== toAccount.id && amountPaise > 0 && (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl px-3 py-2">
              {formatPaise(amountPaise)} moves from {fromAccount.name} to {toAccount.name}.
              Transfers are not counted as income or expenses.
            </p>
          )}

          <div className="flex gap-2 pt-2 pb-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={isSubmitting}>
              {initialTransfer ? 'Save Transfer' : 'Transfer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
