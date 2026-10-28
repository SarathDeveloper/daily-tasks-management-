import React, { useEffect, useMemo, useState } from 'react';
import { PiggyBank, X } from 'lucide-react';
import type { Account, FinanceTransaction, LedgerSettings, SavingsEntry } from '../types';
import { Button } from './ui/Button';
import { AccountPicker } from './ledger/AccountPicker';
import { formatPaise, isAmountParseOk, parseAmountInput } from '../lib/money';
import {
  computeAccountBalances,
  isLedgerError,
  nowTimeString,
  resolveDefaultAccountId,
  todayString,
  validateTransfer,
  type TransferDraft,
} from '../lib/ledger';
import { isSavingsBucketType, resolveSavingsDestinationId } from '../lib/savingsLedger';

interface SavingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Return false to keep the modal open (validation refused the transfer). */
  onSaveTransfer: (draft: TransferDraft) => boolean | void;
  onSaveLegacy: (entry: Partial<SavingsEntry>) => void;
  initialTransfer?: FinanceTransaction | null;
  initialLegacy?: SavingsEntry | null;
  /** Pre-fills the amount when quick-add cannot post on its own. */
  presetAmount?: number | null;
  accounts: Account[];
  transactions: FinanceTransaction[];
  ledgerSettings: LedgerSettings[];
  selectedDate: string;
}

export const SavingsModal: React.FC<SavingsModalProps> = ({
  isOpen,
  onClose,
  onSaveTransfer,
  onSaveLegacy,
  initialTransfer,
  initialLegacy,
  presetAmount,
  accounts,
  transactions,
  ledgerSettings,
  selectedDate,
}) => {
  const settings = ledgerSettings[0];
  const legacyMode = Boolean(initialLegacy);
  const [fromAccountId, setFromAccountId] = useState<string | undefined>();
  const [toAccountId, setToAccountId] = useState<string | undefined>();
  const [date, setDate] = useState(selectedDate);
  const [time, setTime] = useState(nowTimeString());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setIsSubmitting(false);
    if (initialLegacy) {
      setDate(initialLegacy.date);
      setAmount(String(initialLegacy.amount));
      setNote(initialLegacy.note || '');
      setFromAccountId(undefined);
      setToAccountId(undefined);
      return;
    }

    const active = accounts.filter((account) => !account.isArchived);
    const buckets = active.filter((account) => isSavingsBucketType(account.type));
    if (initialTransfer) {
      setFromAccountId(initialTransfer.accountId);
      setToAccountId(initialTransfer.destinationAccountId);
      setAmount(String(initialTransfer.amount));
      setDate(initialTransfer.date);
      setTime(initialTransfer.time || nowTimeString());
      setNote(initialTransfer.note || '');
      return;
    }

    const from = resolveDefaultAccountId(accounts, settings);
    let to = resolveSavingsDestinationId(accounts, settings?.defaultSavingsAccountId);
    if (to && to === from) {
      to = buckets.find((account) => account.id !== from)?.id;
    }
    setFromAccountId(from);
    setToAccountId(to);
    setAmount(presetAmount && presetAmount > 0 ? String(presetAmount) : '');
    setDate(selectedDate || todayString());
    setTime(nowTimeString());
    setNote('');
  }, [isOpen, initialLegacy, initialTransfer, accounts, settings, selectedDate, presetAmount]);

  const balances = useMemo(
    () => computeAccountBalances(accounts, transactions),
    [accounts, transactions]
  );

  const sourceAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => !account.isArchived || account.id === fromAccountId || account.id === initialTransfer?.accountId
      ),
    [accounts, fromAccountId, initialTransfer?.accountId]
  );

  const destinationAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          isSavingsBucketType(account.type) &&
          (!account.isArchived ||
            account.id === toAccountId ||
            account.id === initialTransfer?.destinationAccountId)
      ),
    [accounts, toAccountId, initialTransfer?.destinationAccountId]
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

  if (!isOpen) return null;

  const handleFromChange = (id: string) => {
    setFromAccountId(id);
    if (toAccountId === id) {
      const next = destinationAccounts.find((account) => account.id !== id);
      setToAccountId(next?.id);
    }
  };

  const handleLegacySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseAmountInput(amount);
    if (!isAmountParseOk(parsed)) {
      setError(parsed.error);
      return;
    }
    onSaveLegacy({
      id: initialLegacy?.id,
      date,
      amount: parsed.rupees,
      note: note.trim() || undefined,
    });
    onClose();
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const parsed = parseAmountInput(amount);
    if (!isAmountParseOk(parsed)) {
      setError(parsed.error);
      return;
    }
    const destination = accounts.find((account) => account.id === toAccountId);
    if (!destination || !isSavingsBucketType(destination.type)) {
      setError('Choose a savings, gold, or stocks account.');
      return;
    }

    const draft: TransferDraft = {
      id: initialTransfer?.id,
      amount: parsed.rupees,
      fromAccountId,
      toAccountId,
      date,
      time,
      note: note.trim() || undefined,
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
    const saved = onSaveTransfer(draft);
    if (saved === false) {
      setIsSubmitting(false);
      return;
    }
    onClose();
  };

  const fromAccount = accounts.find((account) => account.id === fromAccountId);
  const title = initialLegacy
    ? 'Edit Savings Entry'
    : initialTransfer
      ? 'Edit Savings'
      : 'Log Savings';

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-t-2xl sm:rounded-2xl w-full min-w-0 max-w-md max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            {title}
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

        <form
          onSubmit={legacyMode ? handleLegacySubmit : handleTransferSubmit}
          className="p-5 space-y-4 overflow-y-auto flex-1 text-sm"
        >
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
              Amount saved *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold">
                ₹
              </span>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3.5 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-lg"
                autoFocus
              />
            </div>
            {!legacyMode && fromAccount && amountPaise > 0 && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {fromAccount.name}: {formatPaise(balances.get(fromAccount.id) || 0)} →{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {formatPaise(projected.get(fromAccount.id) || 0)}
                </span>
              </p>
            )}
          </div>

          {!legacyMode && (
            <>
              <AccountPicker
                label="From account"
                accounts={sourceAccounts}
                balances={balances}
                value={fromAccountId}
                onChange={handleFromChange}
                projectedBalances={projected}
              />
              <AccountPicker
                label="Into account"
                accounts={destinationAccounts}
                balances={balances}
                value={toAccountId}
                onChange={setToAccountId}
                excludeId={fromAccountId}
                projectedBalances={projected}
                emptyHint="Add a savings, gold, or stocks account in the ledger first."
              />
            </>
          )}

          <div className={legacyMode ? '' : 'grid grid-cols-2 gap-3'}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={legacyMode ? todayString() : undefined}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>
            {!legacyMode && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Skipped eating out, bought gold..."
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {legacyMode && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              This older log is not linked to an account, so editing it does not move money.
            </p>
          )}

          <div className="flex gap-2 pt-2 pb-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={isSubmitting}>
              {initialLegacy || initialTransfer ? 'Save Changes' : 'Log Savings'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
