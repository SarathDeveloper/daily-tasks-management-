import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Calendar, Repeat, X } from 'lucide-react';
import {
  Account,
  FinanceCategory,
  FinanceRecurrenceType,
  FinanceTransaction,
  LedgerSettings,
  PaymentMethod,
  TransactionType,
} from '../types';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  financeCategoryNames,
  isCustomFinanceCategory,
  paymentMethodLabel,
} from '../data/financeCategories';
import { Button } from './ui/Button';
import { CategorySelect } from './ui/CategorySelect';
import { AccountPicker } from './ledger/AccountPicker';
import {
  computeAccountBalances,
  nowTimeString,
  resolveDefaultAccountId,
  isLedgerError,
  validateEntry,
  type EntryDraft,
} from '../lib/ledger';
import { formatPaise, isAmountParseOk, parseAmountInput } from '../lib/money';

interface FinanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Return false to keep the modal open (validation refused the entry). */
  onSave: (tx: Partial<FinanceTransaction>) => boolean | void;
  initialTransaction?: FinanceTransaction | null;
  selectedDate: string;
  accounts: Account[];
  transactions: FinanceTransaction[];
  ledgerSettings: LedgerSettings[];
  financeCategories: FinanceCategory[];
  onAddFinanceCategory: (kind: 'income' | 'expense', name: string) => string | null;
  onDeleteFinanceCategory: (kind: 'income' | 'expense', name: string) => void;
  /** Pre-select income/expense when opened from the ledger actions. */
  initialType?: 'income' | 'expense';
  /** Pre-select the funding/receiving account. */
  initialAccountId?: string;
}

export const FinanceModal: React.FC<FinanceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTransaction,
  selectedDate,
  accounts,
  transactions,
  ledgerSettings,
  financeCategories,
  onAddFinanceCategory,
  onDeleteFinanceCategory,
  initialType,
  initialAccountId,
}) => {
  const settings = ledgerSettings[0];
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(selectedDate);
  const [time, setTime] = useState(nowTimeString());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [accountId, setAccountId] = useState<string | undefined>();
  const [recurrenceType, setRecurrenceType] = useState<FinanceRecurrenceType>('none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectable = useMemo(
    () =>
      accounts
        .filter((a) => !a.isArchived || a.id === initialTransaction?.accountId)
        .sort((a, b) => {
          if (a.type === 'cash' && b.type !== 'cash') return -1;
          if (b.type === 'cash' && a.type !== 'cash') return 1;
          return a.name.localeCompare(b.name);
        }),
    [accounts, initialTransaction?.accountId]
  );

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setIsSubmitting(false);

    if (initialTransaction) {
      setType(initialTransaction.type === 'transfer' ? 'expense' : initialTransaction.type);
      setAmount(String(initialTransaction.amount));
      setCategory(initialTransaction.category);
      setNote(initialTransaction.note || '');
      setDate(initialTransaction.date);
      setTime(initialTransaction.time || nowTimeString());
      setPaymentMethod(initialTransaction.paymentMethod || 'cash');
      setAccountId(initialTransaction.accountId);
      setRecurrenceType(initialTransaction.recurrence?.type || 'none');
      setRecurrenceEndDate(initialTransaction.recurrence?.endDate || '');
    } else {
      const startType = initialType || 'expense';
      const account = resolveDefaultAccountId(accounts, settings) || initialAccountId;
      setType(startType);
      setAmount('');
      setCategory(startType === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
      setNote('');
      setDate(selectedDate);
      setTime(nowTimeString());
      setAccountId(initialAccountId || account);
      const selected = accounts.find((a) => a.id === (initialAccountId || account));
      setPaymentMethod(selected?.type === 'cash' ? 'cash' : 'bank_transfer');
      setRecurrenceType('none');
      setRecurrenceEndDate('');
    }
  }, [initialTransaction, selectedDate, isOpen, initialType, initialAccountId, accounts, settings]);

  const categoryKind = type === 'income' ? 'income' : 'expense';
  const categories = useMemo(() => {
    const live = initialTransaction
      ? transactions.find((tx) => tx.id === initialTransaction.id) ?? initialTransaction
      : undefined;
    const liveKind = live ? (live.type === 'transfer' ? 'expense' : live.type) : undefined;
    const preserved = live && liveKind === categoryKind ? [live.category] : [];
    return financeCategoryNames(categoryKind, financeCategories, preserved);
  }, [categoryKind, financeCategories, initialTransaction, transactions]);

  useEffect(() => {
    if (categories.some((name) => name.toLowerCase() === category.toLowerCase())) return;
    setCategory(categories[0] || (categoryKind === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]));
  }, [categories, category, categoryKind]);

  const balances = useMemo(
    () => computeAccountBalances(accounts, transactions),
    [accounts, transactions]
  );

  const amountPaise = useMemo(() => {
    const parsed = parseAmountInput(amount);
    return isAmountParseOk(parsed) ? parsed.paise : 0;
  }, [amount]);

  const projected = useMemo(() => {
    const map = new Map<string, number>();
    if (!accountId || amountPaise === 0) return map;
    const current = balances.get(accountId) || 0;
    map.set(accountId, type === 'income' ? current + amountPaise : current - amountPaise);
    return map;
  }, [balances, accountId, amountPaise, type]);

  if (!isOpen) return null;

  const handleSelectAccount = (id: string) => {
    setAccountId(id);
    const account = accounts.find((a) => a.id === id);
    // Keep the payment method aligned with the funding account unless the user
    // already picked a UPI app / card.
    if (account?.type === 'cash' && paymentMethod !== 'cash') {
      setPaymentMethod('cash');
    }
    if (account && account.type !== 'cash' && paymentMethod === 'cash') {
      setPaymentMethod('bank_transfer');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const parsed = parseAmountInput(amount);
    if (!isAmountParseOk(parsed)) {
      setError(parsed.error);
      return;
    }

    const draft: EntryDraft = {
      id: initialTransaction?.id,
      type: type === 'income' ? 'income' : 'expense',
      amount: parsed.rupees,
      accountId,
      category,
      note,
      paymentMethod,
      date,
      time,
      recurrence: {
        type: recurrenceType,
        endDate:
          recurrenceType !== 'none' && recurrenceEndDate ? recurrenceEndDate : undefined,
      },
    };

    const validation = validateEntry(draft, {
      accounts,
      transactions,
      settings: settings || { allowNegativeBalance: false },
    });
    if (isLedgerError(validation)) {
      setError(validation.message);
      return;
    }

    setIsSubmitting(true);
    const saved = onSave({
      id: initialTransaction?.id,
      type: draft.type,
      amount: draft.amount,
      category,
      note: note.trim() || undefined,
      date,
      time,
      paymentMethod,
      accountId,
      recurrence: draft.recurrence,
    });
    if (saved === false) {
      setIsSubmitting(false);
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-t-2xl sm:rounded-2xl w-full min-w-0 max-w-md max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {initialTransaction
              ? 'Edit Transaction'
              : type === 'income'
              ? 'Add Income'
              : 'Add Expense'}
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

          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border font-bold text-sm transition-colors ${
                type === 'expense'
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              <ArrowDownCircle className="w-4 h-4" />
              Expense
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border font-bold text-sm transition-colors ${
                type === 'income'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              <ArrowUpCircle className="w-4 h-4" />
              Income
            </button>
          </div>

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
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                placeholder="0.00"
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3.5 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-lg"
                autoFocus
              />
            </div>
          </div>

          <AccountPicker
            label={type === 'income' ? 'Received into *' : 'Paid from *'}
            accounts={selectable}
            balances={balances}
            value={accountId}
            onChange={handleSelectAccount}
            projectedBalances={projected}
            emptyHint="No active accounts. Add a cash wallet or bank account in the Money Ledger first."
          />

          {accountId && amountPaise > 0 && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-1">
              {accounts.find((a) => a.id === accountId)?.name}:{' '}
              {formatPaise(balances.get(accountId) || 0)} →{' '}
              <span
                className={`font-semibold ${
                  (projected.get(accountId) || 0) < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                {formatPaise(projected.get(accountId) || 0)}
              </span>
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <CategorySelect
                value={category}
                options={categories}
                onChange={setCategory}
                onAdd={(name) => onAddFinanceCategory(categoryKind, name)}
                canDelete={isCustomFinanceCategory(category, categoryKind, financeCategories)}
                onDelete={() => {
                  onDeleteFinanceCategory(categoryKind, category);
                  setCategory('Other');
                }}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {type === 'expense' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment method
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setPaymentMethod(m.value)}
                    aria-pressed={paymentMethod === m.value}
                    className={`flex items-center justify-center gap-1 py-2 rounded-xl border text-[11px] font-bold transition-colors min-h-[38px] ${
                      paymentMethod === m.value
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <span className="text-base leading-none">{m.emoji}</span>
                    {m.label}
                  </button>
                ))}
                {initialTransaction?.paymentMethod &&
                  !PAYMENT_METHODS.some((m) => m.value === initialTransaction.paymentMethod) && (
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentMethod(initialTransaction.paymentMethod as PaymentMethod)
                      }
                      className={`flex items-center justify-center gap-1 py-2 rounded-xl border text-[11px] font-bold transition-colors min-h-[38px] ${
                        paymentMethod === initialTransaction.paymentMethod
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {paymentMethodLabel(initialTransaction.paymentMethod)}
                    </button>
                  )}
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                GPay and PhonePe are payment apps. The money is debited from the account you
                selected above.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {type === 'expense' ? 'Description / merchant' : 'Source / description'}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                type === 'expense' ? 'e.g. Lunch at Anandhas' : 'e.g. October salary'
              }
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Repeat className="w-3.5 h-3.5" />
              Repeat
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['none', 'daily', 'weekly', 'monthly'] as FinanceRecurrenceType[]).map((r) => {
                const labels: Record<FinanceRecurrenceType, string> = {
                  none: 'Once',
                  daily: 'Daily',
                  weekly: 'Weekly',
                  monthly: 'Monthly',
                };
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRecurrenceType(r)}
                    className={`py-2 rounded-xl border text-[11px] font-bold transition-colors ${
                      recurrenceType === r
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {labels[r]}
                  </button>
                );
              })}
            </div>
            {recurrenceType !== 'none' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  End Date (optional)
                </label>
                <input
                  type="date"
                  value={recurrenceEndDate}
                  min={date}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2 pb-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={isSubmitting}>
              {initialTransaction ? 'Save Changes' : type === 'income' ? 'Add Income' : 'Add Expense'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
