import React, { useEffect, useMemo, useState } from 'react';
import { Archive, Landmark, X } from 'lucide-react';
import type { Account, AccountType, FinanceTransaction } from '../../types';
import { ACCOUNT_TYPES } from '../../data/financeCategories';
import { formatPaise } from '../../lib/money';import { computeAccountBalance } from '../../lib/ledger';
import { Button } from '../ui/Button';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Return false to keep the modal open (e.g. the user cancelled archiving). */
  onSave: (draft: Partial<Account>) => boolean | void;
  initialAccount?: Account | null;
  accounts: Account[];
  transactions: FinanceTransaction[];
}

const emptyForm = {
  name: '',
  type: 'savings' as AccountType,
  bankName: '',
  accountNickname: '',
  lastFourDigits: '',
  openingBalance: '0',
  isArchived: false,
};

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialAccount,
  accounts,
  transactions,
}) => {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (initialAccount) {
      setForm({
        name: initialAccount.name,
        type: initialAccount.type,
        bankName: initialAccount.bankName || '',
        accountNickname: initialAccount.accountNickname || '',
        lastFourDigits: initialAccount.lastFourDigits || '',
        openingBalance: String(initialAccount.openingBalance ?? 0),
        isArchived: Boolean(initialAccount.isArchived),
      });
    } else {
      setForm(emptyForm);
    }
  }, [isOpen, initialAccount]);

  const currentBalancePaise = useMemo(
    () => (initialAccount ? computeAccountBalance(initialAccount, transactions) : null),
    [initialAccount, transactions]
  );

  if (!isOpen) return null;

  const isCash = form.type === 'cash';

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError('Account name is required.');
      return;
    }
    const duplicate = accounts.some(
      (a) =>
        a.id !== initialAccount?.id && a.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      setError('An account with this name already exists.');
      return;
    }

    const digits = form.lastFourDigits.trim();
    if (digits && !/^\d{4}$/.test(digits)) {
      setError('Last four digits must be exactly 4 numbers.');
      return;
    }

    if (form.openingBalance.trim() !== '') {
      const cleaned = form.openingBalance.trim().replace(/[₹,\s]/g, '');
      if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
        setError('Enter a valid opening balance (0 or more, up to 2 decimals).');
        return;
      }
    }

    const cleanedOpening = form.openingBalance.trim().replace(/[₹,\s]/g, '');
    const opening = cleanedOpening === '' ? 0 : Number(cleanedOpening);
    if (!Number.isFinite(opening) || opening < 0) {
      setError('Enter a valid opening balance.');
      return;
    }

    const saved = onSave({
      id: initialAccount?.id,
      name,
      type: form.type,
      bankName: isCash ? undefined : form.bankName.trim() || undefined,
      accountNickname: form.accountNickname.trim() || undefined,
      lastFourDigits: isCash ? undefined : digits || undefined,
      openingBalance: Math.round(opening * 100) / 100,
      isArchived: form.isArchived,
    });
    // Keep the form open (with the user's input) if the save was refused.
    if (saved === false) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-t-2xl sm:rounded-2xl w-full min-w-0 max-w-md max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {initialAccount ? 'Edit Account' : 'Add Account'}
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
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Account name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. YES Bank, Cash Wallet"
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Account type
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {ACCOUNT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => update('type', t.value)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold transition-colors ${
                    form.type === t.value
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <span>{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {!isCash && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bank name
                </label>
                <input
                  type="text"
                  value={form.bankName}
                  onChange={(e) => update('bankName', e.target.value)}
                  placeholder="YES Bank"
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Last 4 digits
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={form.lastFourDigits}
                  onChange={(e) => update('lastFourDigits', e.target.value.replace(/\D/g, ''))}
                  placeholder="1234"
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 tracking-widest"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nickname (optional)
            </label>
            <input
              type="text"
              value={form.accountNickname}
              onChange={(e) => update('accountNickname', e.target.value)}
              placeholder="e.g. Salary account"
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Opening balance
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold">
                ₹
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.openingBalance}
                onChange={(e) => update('openingBalance', e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              The balance already in this account before you started tracking.
            </p>
            {currentBalancePaise != null && (
              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mt-1 inline-flex items-center gap-1">
                <Landmark className="w-3.5 h-3.5" />
                Current calculated balance {formatPaise(currentBalancePaise)}
              </p>
            )}
          </div>

          {initialAccount && (
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5">
              <input
                type="checkbox"
                checked={form.isArchived}
                onChange={(e) => update('isArchived', e.target.checked)}
                className="w-4 h-4 accent-indigo-600"
              />
              <Archive className="w-3.5 h-3.5" />
              Archive this account
              <span className="font-normal text-slate-500 dark:text-slate-400">
                (history is kept)
              </span>
            </label>
          )}

          <div className="flex gap-2 pt-2 pb-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1">
              {initialAccount ? 'Save Account' : 'Add Account'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
