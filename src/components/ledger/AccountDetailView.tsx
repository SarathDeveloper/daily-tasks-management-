import React, { useMemo, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpCircle,
  Landmark,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react';
import type { Account, FinanceCategory, FinanceTransaction, TransactionType } from '../../types';
import {
  ALL_PAYMENT_METHODS,
  accountTypeMeta,
  financeCategoryNames,
} from '../../data/financeCategories';
import { formatPaise, toPaise } from '../../lib/money';
import {
  accountTotals,
  filterTransactions,
  withRunningBalances,
  EMPTY_FILTERS,
} from '../../lib/ledger';
import { Card } from '../ui/Card';
import { Dropdown } from '../ui/Dropdown';
import { Button } from '../ui/Button';
import { LedgerTransactionRow, LedgerEmptyState } from './LedgerTransactionRow';
import { TransactionDetailModal } from './TransactionDetailModal';

interface AccountDetailViewProps {
  account: Account;
  accounts: Account[];
  transactions: FinanceTransaction[];
  financeCategories: FinanceCategory[];
  onBack: () => void;
  onEditAccount: (account: Account) => void;
  onAddIncome: (accountId: string) => void;
  onAddExpense: (accountId: string) => void;
  onEditTransaction: (tx: FinanceTransaction) => void;
  onEditTransfer: (tx: FinanceTransaction) => void;
  onDeleteTransaction: (id: string) => void;
}

export const AccountDetailView: React.FC<AccountDetailViewProps> = ({
  account,
  accounts,
  transactions,
  financeCategories,
  onBack,
  onEditAccount,
  onAddIncome,
  onAddExpense,
  onEditTransaction,
  onEditTransfer,
  onDeleteTransaction,
}) => {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TransactionType | 'all'>('all');
  const [category, setCategory] = useState('all');
  const [paymentMethod, setPaymentMethod] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [detailTx, setDetailTx] = useState<FinanceTransaction | null>(null);

  const rows = useMemo(() => withRunningBalances(account, transactions), [account, transactions]);
  const balancePaise = rows.length
    ? rows[rows.length - 1].balanceAfterPaise
    : toPaise(account.openingBalance);
  const totals = useMemo(() => accountTotals(account.id, transactions), [account.id, transactions]);

  const categories = useMemo(
    () => financeCategoryNames('all', financeCategories, rows.map((row) => row.tx.category)),
    [rows, financeCategories]
  );

  const filtered = useMemo(() => {
    const matching = filterTransactions(
      rows.map((r) => r.tx),
      { ...EMPTY_FILTERS, search, type, category, paymentMethod, from: from || undefined, to: to || undefined },
      new Map(accounts.map((a) => [a.id, a.name]))
    );
    const matchingIds = new Set(matching.map((tx) => tx.id));
    return [...rows].reverse().filter((row) => matchingIds.has(row.tx.id));
  }, [rows, search, type, category, paymentMethod, from, to, accounts]);

  const hasFilters =
    search.trim() !== '' || type !== 'all' || category !== 'all' || paymentMethod !== 'all' || from !== '' || to !== '';

  const clearFilters = () => {
    setSearch('');
    setType('all');
    setCategory('all');
    setPaymentMethod('all');
    setFrom('');
    setTo('');
  };

  const meta = accountTypeMeta(account.type);
  const handleEdit = (tx: FinanceTransaction) =>
    tx.type === 'transfer' ? onEditTransfer(tx) : onEditTransaction(tx);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          aria-label="Back to ledger"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
            <span>{meta.emoji}</span>
            {account.name}
            {account.isArchived && (
              <span className="text-[9px] uppercase tracking-wide font-black px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                Archived
              </span>
            )}
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {meta.label}
            {account.bankName ? ` · ${account.bankName}` : ''}
            {account.accountNickname ? ` · ${account.accountNickname}` : ''}
            {account.lastFourDigits ? ` · ····${account.lastFourDigits}` : ''}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => onEditAccount(account)}>
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </Button>
      </div>

      <Card className="p-4">
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
          Current balance
        </p>
        <p
          className={`text-2xl font-black tracking-tight ${
            balancePaise < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
          }`}
        >
          {formatPaise(balancePaise)}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
          <Landmark className="w-3 h-3" />
          Opening {formatPaise(toPaise(account.openingBalance))}
        </p>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/60 px-2.5 py-2">
            <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <ArrowUpCircle className="w-3 h-3" /> Credited
            </p>
            <p className="text-xs font-black text-emerald-700 dark:text-emerald-300 truncate">
              {formatPaise(totals.creditedPaise)}
            </p>
          </div>
          <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/60 px-2.5 py-2">
            <p className="text-[10px] font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1">
              <ArrowDownCircle className="w-3 h-3" /> Debited
            </p>
            <p className="text-xs font-black text-rose-700 dark:text-rose-300 truncate">
              {formatPaise(totals.debitedPaise)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-2.5 py-2">
            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
              <ArrowRightLeft className="w-3 h-3" /> Transfers in
            </p>
            <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate">
              {formatPaise(totals.transfersInPaise)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-2.5 py-2">
            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
              <ArrowRightLeft className="w-3 h-3" /> Transfers out
            </p>
            <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate">
              {formatPaise(totals.transfersOutPaise)}
            </p>
          </div>
        </div>

        {!account.isArchived && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Button variant="primary" size="sm" onClick={() => onAddIncome(account.id)}>
              <Plus className="w-3.5 h-3.5" /> Income
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onAddExpense(account.id)}>
              <Plus className="w-3.5 h-3.5" /> Expense
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-3 space-y-2.5">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search this account..."
            className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[40px]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <Dropdown
            value={type}
            onChange={(v) => setType(v as TransactionType | 'all')}
            title="Filter by type"
            options={[
              { value: 'all', label: 'All Types' },
              { value: 'income', label: 'Income' },
              { value: 'expense', label: 'Expenses' },
              { value: 'transfer', label: 'Transfers' },
            ]}
          />
          <Dropdown
            value={category}
            onChange={setCategory}
            title="Filter by category"
            options={[
              { value: 'all', label: 'All Categories' },
              ...categories.map((c) => ({ value: c, label: c })),
            ]}
          />
          <Dropdown
            value={paymentMethod}
            onChange={setPaymentMethod}
            title="Filter by payment method"
            options={[
              { value: 'all', label: 'All Payments' },
              ...ALL_PAYMENT_METHODS.map((p) => ({ value: p.value, label: `${p.emoji} ${p.label}` })),
            ]}
          />
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 underline shrink-0 px-1"
            >
              Clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              From
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              To
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <LedgerEmptyState
          title={rows.length === 0 ? 'No transactions yet' : 'No matches'}
          hint={
            rows.length === 0
              ? 'Income, expenses and transfers for this account will appear here.'
              : 'Adjust or clear the filters to see this account history.'
          }
          actionLabel={rows.length === 0 && !account.isArchived ? 'Add expense' : undefined}
          onAction={() => onAddExpense(account.id)}
          secondaryLabel={hasFilters ? 'Clear filters' : undefined}
          onSecondary={clearFilters}
        />
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1">
            {filtered.length} transaction{filtered.length === 1 ? '' : 's'}
          </p>
          {filtered.map((row) => (
            <LedgerTransactionRow
              key={row.tx.id}
              tx={row.tx}
              accounts={accounts}
              showDate
              accountId={account.id}
              balanceAfterPaise={row.balanceAfterPaise}
              onEdit={handleEdit}
              onDelete={onDeleteTransaction}
              onOpen={setDetailTx}
            />
          ))}
        </div>
      )}

      <TransactionDetailModal
        tx={detailTx}
        accounts={accounts}
        balanceAfterPaise={
          detailTx ? rows.find((r) => r.tx.id === detailTx.id)?.balanceAfterPaise ?? null : null
        }
        onClose={() => setDetailTx(null)}
        onEdit={handleEdit}
        onDelete={onDeleteTransaction}
      />
    </div>
  );
};
