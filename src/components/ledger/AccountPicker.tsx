import React from 'react';
import type { Account } from '../../types';
import { accountTypeMeta } from '../../data/financeCategories';
import { formatPaise } from '../../lib/money';

interface AccountPickerProps {
  accounts: Account[];
  balances: Map<string, number>;
  value?: string;
  onChange: (accountId: string) => void;
  /** Account that cannot be chosen (e.g. the transfer source). */
  excludeId?: string;
  /** Optional projected balance per account to preview the effect of the entry. */
  projectedBalances?: Map<string, number>;
  emptyHint?: string;
  label?: string;
}

export const AccountPicker: React.FC<AccountPickerProps> = ({
  accounts,
  balances,
  value,
  onChange,
  excludeId,
  projectedBalances,
  emptyHint,
  label = 'Account',
}) => {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
        {label}
      </label>
      {accounts.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl px-3 py-3">
          {emptyHint || 'No active accounts yet. Add a bank account or cash wallet first.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-0.5">
          {accounts
            .filter((account) => account.id !== excludeId)
            .map((account) => {
              const selected = account.id === value;
              const balance = balances.get(account.id) || 0;
              const projected = projectedBalances?.get(account.id);
              const meta = accountTypeMeta(account.type);
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => onChange(account.id)}
                  aria-pressed={selected}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors min-h-[46px] ${
                    selected
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="text-base leading-none shrink-0">{meta.emoji}</span>
                  <span className="flex-1 min-w-0">
                    <span
                      className={`block text-xs font-bold truncate ${
                        selected
                          ? 'text-indigo-700 dark:text-indigo-300'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {account.name}
                      {account.lastFourDigits ? (
                        <span className="font-medium text-slate-500 dark:text-slate-400">
                          {' '}
                          ····{account.lastFourDigits}
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {balance < 0 ? 'Overdrawn' : 'Available'} {formatPaise(balance)}
                      {projected != null && projected !== balance && (
                        <span
                          className={`ml-1 font-semibold ${
                            projected < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          → {formatPaise(projected)}
                        </span>
                      )}
                    </span>
                  </span>
                  <span
                    className={`w-4 h-4 rounded-full border shrink-0 ${
                      selected
                        ? 'border-indigo-600 bg-indigo-600 ring-2 ring-indigo-200 dark:ring-indigo-900'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
};
