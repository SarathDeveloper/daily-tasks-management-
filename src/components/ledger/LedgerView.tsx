import React, { useMemo, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowRightLeft,
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Plus,
  Search,
  Settings2,
  Wallet,
  X,
} from 'lucide-react';
import type {
  Account,
  FinanceTransaction,
  LedgerSettings,
  PaymentMethod,
  TransactionType,
} from '../../types';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  ALL_PAYMENT_METHODS,
  accountTypeMeta,
} from '../../data/financeCategories';
import { formatPaise, formatRupeesCompact, toPaise } from '../../lib/money';
import {
  EMPTY_FILTERS,
  accountLabel,
  cashWalletBalancePaise,
  compareMonths,
  computeAccountBalances,
  filterTransactions,
  monthKeyOf,
  monthRange,
  resolveDefaultAccountId,
  shiftMonthKey,
  summarize,
  todayString,
  totalActiveBalancePaise,
  weekRange,
  yearRange,
  dayRange,
} from '../../lib/ledger';
import { monthLabelFromKey, formatShortDate } from '../../lib/dateFormat';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';
import { LedgerTransactionRow, LedgerEmptyState } from './LedgerTransactionRow';
import { AccountDetailView } from './AccountDetailView';
import { TransactionDetailModal } from './TransactionDetailModal';

export interface LedgerViewProps {
  accounts: Account[];
  transactions: FinanceTransaction[];
  ledgerSettings: LedgerSettings[];
  selectedDate: string;
  onAddIncome: (accountId?: string) => void;
  onAddExpense: (accountId?: string) => void;
  onTransfer: (fromAccountId?: string) => void;
  onAddAccount: () => void;
  onEditAccount: (account: Account) => void;
  onEditTransaction: (tx: FinanceTransaction) => void;
  onEditTransfer: (tx: FinanceTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  onUpdateLedgerSettings: (partial: Partial<LedgerSettings>) => void;
  onBulkAssignAccount: (txIds: string[], accountId: string) => void;
}

type RangeMode = 'day' | 'week' | 'month' | 'year' | 'all';
type FilterType = TransactionType | 'all';

const RANGE_LABELS: { value: RangeMode; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All' },
];

export const LedgerView: React.FC<LedgerViewProps> = ({
  accounts,
  transactions,
  ledgerSettings,
  selectedDate,
  onAddIncome,
  onAddExpense,
  onTransfer,
  onAddAccount,
  onEditAccount,
  onEditTransaction,
  onEditTransfer,
  onDeleteTransaction,
  onUpdateLedgerSettings,
  onBulkAssignAccount,
}) => {
  const settings = ledgerSettings[0];
  const allowNegative = Boolean(settings?.allowNegativeBalance);

  const [detailAccountId, setDetailAccountId] = useState<string | null>(null);
  const [detailTx, setDetailTx] = useState<FinanceTransaction | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [rangeMode, setRangeMode] = useState<RangeMode>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | 'all'>('all');
  const [visibleCount, setVisibleCount] = useState(20);
  const [summaryMonth, setSummaryMonth] = useState(() => monthKeyOf(selectedDate));

  const balances = useMemo(
    () => computeAccountBalances(accounts, transactions),
    [accounts, transactions]
  );
  const activeAccounts = useMemo(
    () =>
      [...accounts]
        .filter((a) => !a.isArchived)
        .sort((a, b) => {
          if (a.type === 'cash' && b.type !== 'cash') return -1;
          if (b.type === 'cash' && a.type !== 'cash') return 1;
          return a.name.localeCompare(b.name);
        }),
    [accounts]
  );
  const archivedAccounts = useMemo(() => accounts.filter((a) => a.isArchived), [accounts]);

  const totalBalance = useMemo(
    () => totalActiveBalancePaise(accounts, transactions),
    [accounts, transactions]
  );
  const cashBalance = useMemo(
    () => cashWalletBalancePaise(accounts, transactions),
    [accounts, transactions]
  );

  const monthSummary = useMemo(() => compareMonths(transactions, summaryMonth), [transactions, summaryMonth]);

  // ---- History range -------------------------------------------------------
  const range = useMemo(() => {
    if (customFrom || customTo) {
      return { from: customFrom || '0000-01-01', to: customTo || '9999-12-31' };
    }
    if (rangeMode === 'day') return dayRange(selectedDate);
    if (rangeMode === 'week') return weekRange(selectedDate);
    if (rangeMode === 'month') return monthRange(monthKeyOf(selectedDate));
    if (rangeMode === 'year') return yearRange(Number(selectedDate.slice(0, 4)));
    return { from: '0000-01-01', to: '9999-12-31' };
  }, [rangeMode, selectedDate, customFrom, customTo]);

  const rangeSummary = useMemo(() => summarize(transactions, range), [transactions, range]);

  const accountNames = useMemo(
    () => new Map(accounts.map((a) => [a.id, accountLabel(a)])),
    [accounts]
  );

  const filtered = useMemo(() => {
    const list = filterTransactions(
      transactions,
      {
        ...EMPTY_FILTERS,
        search,
        type: typeFilter,
        accountId: accountFilter,
        category: categoryFilter,
        paymentMethod: paymentFilter,
        from: range.from,
        to: range.to,
      },
      accountNames
    );
    return list.sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (b.time || '00:00').localeCompare(a.time || '00:00') ||
        b.createdAt.localeCompare(a.createdAt)
    );
  }, [transactions, search, typeFilter, accountFilter, categoryFilter, paymentFilter, range, accountNames]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { date: string; rows: FinanceTransaction[]; incomePaise: number; expensePaise: number }
    >();
    for (const tx of filtered) {
      const bucket = map.get(tx.date) || { date: tx.date, rows: [], incomePaise: 0, expensePaise: 0 };
      bucket.rows.push(tx);
      if (tx.type === 'income') bucket.incomePaise += toPaise(tx.amount);
      if (tx.type === 'expense') bucket.expensePaise += toPaise(tx.amount);
      map.set(tx.date, bucket);
    }
    return Array.from(map.values());
  }, [filtered]);

  const categories = useMemo(() => {
    const used = new Set(
      transactions.map((tx) => tx.category).filter((c) => c && c !== 'Transfer')
    );
    return [...new Set([...Array.from(used), ...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES])];
  }, [transactions]);

  const hasFilters =
    search.trim() !== '' ||
    typeFilter !== 'all' ||
    accountFilter !== 'all' ||
    categoryFilter !== 'all' ||
    paymentFilter !== 'all' ||
    customFrom !== '' ||
    customTo !== '';

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setAccountFilter('all');
    setCategoryFilter('all');
    setPaymentFilter('all');
    setCustomFrom('');
    setCustomTo('');
    setRangeMode('month');
  };

  const unassigned = useMemo(
    () => transactions.filter((tx) => !tx.accountId && tx.type !== 'transfer'),
    [transactions]
  );

  const defaultAccountName = resolveDefaultAccountId(accounts, settings);
  const handleEdit = (tx: FinanceTransaction) =>
    tx.type === 'transfer' ? onEditTransfer(tx) : onEditTransaction(tx);

  const detailAccount = detailAccountId
    ? accounts.find((a) => a.id === detailAccountId) ?? null
    : null;

  // -------------------------------------------------------------------------
  // Account detail sub-view
  // -------------------------------------------------------------------------
  if (detailAccount) {
    return (
      <AccountDetailView
        account={detailAccount}
        accounts={accounts}
        transactions={transactions}
        onBack={() => setDetailAccountId(null)}
        onEditAccount={onEditAccount}
        onAddIncome={(id) => onAddIncome(id)}
        onAddExpense={(id) => onAddExpense(id)}
        onEditTransaction={onEditTransaction}
        onEditTransfer={onEditTransfer}
        onDeleteTransaction={onDeleteTransaction}
      />
    );
  }

  // -------------------------------------------------------------------------
  // No accounts yet
  // -------------------------------------------------------------------------
  if (accounts.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="p-5 text-center bg-gradient-to-br from-indigo-600 to-violet-600 border-indigo-500 text-white">
          <Wallet className="w-9 h-9 mx-auto mb-2 opacity-90" />
          <h2 className="text-base font-black">Set up your money ledger</h2>
          <p className="text-xs text-indigo-100 mt-1 max-w-xs mx-auto">
            Add your cash wallet and bank accounts with their opening balances. Every
            income, expense and transfer is then tracked against the right account.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={onAddAccount}
              className="px-4 py-2.5 min-h-[44px] rounded-xl bg-white text-indigo-700 text-sm font-bold active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 inline -mt-0.5 mr-1" />
              Add account
            </button>
          </div>
        </Card>
        <LedgerEmptyState
          title="No accounts yet"
          hint="Create Cash Wallet, YES Bank and Indian Bank to start recording daily expenses."
          actionLabel="Add your first account"
          onAction={onAddAccount}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Money Ledger
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {`${activeAccounts.length} active account${activeAccounts.length === 1 ? '' : 's'} · balances derived from transactions`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Ledger settings"
            aria-label="Ledger settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <Button variant="secondary" size="sm" onClick={onAddAccount}>
            <Plus className="w-3.5 h-3.5" /> Account
          </Button>
        </div>
      </div>

      {/* Total available */}
      <Card className="p-4 bg-gradient-to-br from-indigo-600 to-violet-600 border-indigo-500 text-white">
        <p className="text-[10px] uppercase tracking-wider font-bold text-indigo-100">
          Total available money
        </p>
        <p className="text-3xl font-black tracking-tight mt-0.5">{formatPaise(totalBalance)}</p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="rounded-xl bg-white/10 px-2.5 py-2">
            <p className="text-[10px] font-bold text-indigo-100 flex items-center gap-1">
              <Wallet className="w-3 h-3" /> Cash wallet
            </p>
            <p className="text-sm font-black truncate">{formatPaise(cashBalance)}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-2.5 py-2">
            <p className="text-[10px] font-bold text-indigo-100 flex items-center gap-1">
              <Landmark className="w-3 h-3" /> {monthLabelFromKey(summaryMonth)}
            </p>
            <p className="text-sm font-black truncate">
              {monthSummary.current.incomePaise >= monthSummary.current.expensePaise ? '+' : '−'}
              {formatPaise(Math.abs(monthSummary.current.netPaise))}
            </p>
          </div>
        </div>
      </Card>

      {/* Prominent actions */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onAddIncome()}
          className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold text-xs active:scale-95 transition-all min-h-[64px]"
        >
          <ArrowUpCircle className="w-5 h-5" />
          Income
        </button>
        <button
          type="button"
          onClick={() => onAddExpense()}
          className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 font-bold text-xs active:scale-95 transition-all min-h-[64px]"
        >
          <ArrowDownCircle className="w-5 h-5" />
          Expense
        </button>
        <button
          type="button"
          onClick={() => onTransfer()}
          className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs active:scale-95 transition-all min-h-[64px]"
        >
          <ArrowRightLeft className="w-5 h-5" />
          Transfer
        </button>
      </div>

      {/* Accounts */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Accounts
          </h3>
          <button
            type="button"
            onClick={onAddAccount}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            + Add
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {activeAccounts.map((account) => {
            const balance = balances.get(account.id) || 0;
            const meta = accountTypeMeta(account.type);
            return (
              <Card key={account.id} className="p-3">
                <div className="flex items-start gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDetailAccountId(account.id)}
                    className="flex-1 min-w-0 text-left flex items-start gap-2.5"
                  >
                    <span className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-base shrink-0">
                      {meta.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
                        {account.name}
                      </span>
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {meta.label}
                        {account.lastFourDigits ? ` · ····${account.lastFourDigits}` : ''}
                      </span>
                      <span
                        className={`block text-lg font-black tracking-tight truncate ${
                          balance < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {formatPaise(balance)}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditAccount(account)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                    aria-label={`Edit ${account.name}`}
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>

        {archivedAccounts.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-1"
            >
              {showArchived ? 'Hide' : 'Show'} {archivedAccounts.length} archived account
              {archivedAccounts.length === 1 ? '' : 's'}
            </button>
            {showArchived && (
              <div className="mt-1.5 space-y-1.5">
                {archivedAccounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => setDetailAccountId(account.id)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-left"
                  >
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
                      {account.name}
                    </span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {formatPaise(balances.get(account.id) || 0)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Monthly summary */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Monthly summary
          </h3>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setSummaryMonth((m) => shiftMonthKey(m, -1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 min-w-[86px] text-center">
              {monthLabelFromKey(summaryMonth)}
            </span>
            <button
              type="button"
              onClick={() => setSummaryMonth((m) => shiftMonthKey(m, 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Income</p>
            <p className="text-sm font-black text-slate-900 dark:text-white truncate">
              {formatPaise(monthSummary.current.incomePaise)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">Expenses</p>
            <p className="text-sm font-black text-slate-900 dark:text-white truncate">
              {formatPaise(monthSummary.current.expensePaise)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Net flow</p>
            <p
              className={`text-sm font-black truncate ${
                monthSummary.current.netPaise >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {monthSummary.current.netPaise >= 0 ? '+' : '−'}
              {formatPaise(Math.abs(monthSummary.current.netPaise))}
            </p>
          </div>
        </div>

        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          vs {monthLabelFromKey(monthSummary.previousMonth)}: expenses{' '}
          <span
            className={
              monthSummary.expenseDeltaPaise > 0
                ? 'font-bold text-rose-600 dark:text-rose-400'
                : 'font-bold text-emerald-600 dark:text-emerald-400'
            }
          >
            {monthSummary.expenseDeltaPaise > 0 ? '+' : '−'}
            {formatPaise(Math.abs(monthSummary.expenseDeltaPaise))}
          </span>
          , income{' '}
          <span
            className={
              monthSummary.incomeDeltaPaise >= 0
                ? 'font-bold text-emerald-600 dark:text-emerald-400'
                : 'font-bold text-rose-600 dark:text-rose-400'
            }
          >
            {monthSummary.incomeDeltaPaise >= 0 ? '+' : '−'}
            {formatPaise(Math.abs(monthSummary.incomeDeltaPaise))}
          </span>
        </p>

        {monthSummary.current.expenseByCategory.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Expenses by category
            </p>
            {monthSummary.current.expenseByCategory.slice(0, 6).map((row) => {
              const pct =
                monthSummary.current.expensePaise > 0
                  ? Math.round((row.amountPaise / monthSummary.current.expensePaise) * 100)
                  : 0;
              return (
                <div key={row.category} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600 dark:text-slate-300 truncate pr-2">
                      {row.category}
                    </span>
                    <span className="font-bold text-slate-700 dark:text-slate-200 shrink-0">
                      {formatPaise(row.amountPaise)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-rose-500 dark:bg-rose-400"
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            No expenses recorded for {monthLabelFromKey(summaryMonth)}.
          </p>
        )}

        {monthSummary.current.incomeByCategory.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Income by source
            </p>
            <div className="flex flex-wrap gap-1.5">
              {monthSummary.current.incomeByCategory.map((row) => (
                <span
                  key={row.category}
                  className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
                >
                  {row.category} · {formatRupeesCompact(row.amountPaise / 100)}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* History */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Transactions
          </h3>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            {filtered.length} found
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <div className="inline-flex p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
            {RANGE_LABELS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => {
                  setRangeMode(r.value);
                  setCustomFrom('');
                  setCustomTo('');
                }}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                  rangeMode === r.value && !customFrom && !customTo
                    ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 px-2 py-1.5">
            <p className="text-[9px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
              In
            </p>
            <p className="text-xs font-black text-emerald-700 dark:text-emerald-300 truncate">
              {formatPaise(rangeSummary.incomePaise)}
            </p>
          </div>
          <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900 px-2 py-1.5">
            <p className="text-[9px] font-bold uppercase text-rose-700 dark:text-rose-300">Out</p>
            <p className="text-xs font-black text-rose-700 dark:text-rose-300 truncate">
              {formatPaise(rangeSummary.expensePaise)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-2 py-1.5">
            <p className="text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400">Net</p>
            <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate">
              {formatPaise(rangeSummary.netPaise)}
            </p>
          </div>
        </div>

        <Card className="p-3 space-y-2.5">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(20);
              }}
              placeholder="Search description, category, account..."
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
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as FilterType)}
              title="Filter by type"
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'income', label: 'Income' },
                { value: 'expense', label: 'Expenses' },
                { value: 'transfer', label: 'Transfers' },
              ]}
            />
            <Dropdown
              value={accountFilter}
              onChange={setAccountFilter}
              title="Filter by account"
              options={[
                { value: 'all', label: 'All Accounts' },
                ...accounts.map((a) => ({ value: a.id, label: accountLabel(a) })),
              ]}
            />
            <Dropdown
              value={categoryFilter}
              onChange={setCategoryFilter}
              title="Filter by category"
              options={[
                { value: 'all', label: 'All Categories' },
                ...categories.map((c) => ({ value: c, label: c })),
              ]}
            />
            <Dropdown
              value={paymentFilter}
              onChange={setPaymentFilter}
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
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                To
              </label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </Card>

        {grouped.length === 0 ? (
          <LedgerEmptyState
            title="No transactions here"
            hint={
              hasFilters
                ? 'No entries match these filters. Try widening the date range.'
                : 'Record your first expense or income to see it here.'
            }
            actionLabel={hasFilters ? undefined : 'Add expense'}
            onAction={() => onAddExpense()}
            secondaryLabel={hasFilters ? 'Clear filters' : undefined}
            onSecondary={clearFilters}
          />
        ) : (
          <div className="space-y-3">
            {grouped.slice(0, visibleCount).map((group) => (
              <div key={group.date} className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    {group.date === todayString() ? 'Today' : formatShortDate(group.date)}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                    {group.incomePaise > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        +{formatRupeesCompact(group.incomePaise / 100)}
                      </span>
                    )}
                    {group.incomePaise > 0 && group.expensePaise > 0 && ' · '}
                    {group.expensePaise > 0 && (
                      <span className="text-rose-600 dark:text-rose-400">
                        −{formatRupeesCompact(group.expensePaise / 100)}
                      </span>
                    )}
                  </p>
                </div>
                {group.rows.map((tx) => (
                  <LedgerTransactionRow
                    key={tx.id}
                    tx={tx}
                    accounts={accounts}
                    onEdit={handleEdit}
                    onDelete={onDeleteTransaction}
                    onOpen={setDetailTx}
                  />
                ))}
              </div>
            ))}
            {grouped.length > visibleCount && (
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + 20)}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
              >
                Show more ({grouped.length - visibleCount} days left)
              </button>
            )}
          </div>
        )}
      </div>

      {/* Allow-negative toggle is useful right here too */}
      {allowNegative && (
        <p className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl px-3 py-2">
          Negative balances are allowed. Expenses and transfers may exceed the available balance.
        </p>
      )}

      {!allowNegative && defaultAccountName && activeAccounts.length > 0 && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
          Default account for quick entries:{' '}
          {accounts.find((a) => a.id === defaultAccountName)?.name}
        </p>
      )}

      <LedgerSettingsSheet
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        accounts={accounts}
        settings={settings}
        unassigned={unassigned}
        onUpdateLedgerSettings={onUpdateLedgerSettings}
        onBulkAssignAccount={onBulkAssignAccount}
      />

      <TransactionDetailModal
        tx={detailTx}
        accounts={accounts}
        onClose={() => setDetailTx(null)}
        onEdit={handleEdit}
        onDelete={onDeleteTransaction}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Settings sheet
// ---------------------------------------------------------------------------

interface LedgerSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  settings?: LedgerSettings;
  unassigned: FinanceTransaction[];
  onUpdateLedgerSettings: (partial: Partial<LedgerSettings>) => void;
  onBulkAssignAccount: (txIds: string[], accountId: string) => void;
}

const LedgerSettingsSheet: React.FC<LedgerSettingsSheetProps> = ({
  isOpen,
  onClose,
  accounts,
  settings,
  unassigned,
  onUpdateLedgerSettings,
  onBulkAssignAccount,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignTo, setAssignTo] = useState<string>('');

  const active = accounts.filter((a) => !a.isArchived);

  if (!isOpen) return null;

  const toggle = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Ledger Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-sm">
          <label className="flex items-start gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(settings?.allowNegativeBalance)}
              onChange={(e) => onUpdateLedgerSettings({ allowNegativeBalance: e.target.checked })}
              className="w-4 h-4 mt-0.5 accent-indigo-600"
            />
            <span>
              Allow negative balances
              <span className="block font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                When off, expenses and transfers that exceed the available balance are blocked.
              </span>
            </span>
          </label>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Default account for quick entries
            </label>
            <Dropdown
              value={settings?.defaultAccountId || 'auto'}
              onChange={(v) => onUpdateLedgerSettings({ defaultAccountId: v === 'auto' ? undefined : v })}
              title="Default account"
              options={[
                { value: 'auto', label: 'Auto (cash wallet first)' },
                ...active.map((a) => ({ value: a.id, label: accountLabel(a) })),
              ]}
            />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Unassigned entries
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {unassigned.length === 0
                ? 'Every transaction is linked to an account.'
                : `${unassigned.length} transaction${unassigned.length === 1 ? '' : 's'} created before the ledger existed. They are excluded from account balances until assigned.`}
            </p>

            {unassigned.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-700 rounded-xl p-2">
                  {unassigned.map((tx) => (
                    <label
                      key={tx.id}
                      className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(tx.id)}
                        onChange={() => toggle(tx.id)}
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <span className="flex-1 truncate">
                        {tx.date} · {tx.category}
                        {tx.note ? ` · ${tx.note}` : ''}
                      </span>
                      <span className="font-bold shrink-0">
                        {tx.type === 'expense' ? '−' : '+'}
                        {formatPaise(toPaise(tx.amount))}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedIds(
                        selectedIds.length === unassigned.length ? [] : unassigned.map((t) => t.id)
                      )
                    }
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 underline shrink-0"
                  >
                    {selectedIds.length === unassigned.length ? 'Clear' : 'Select all'}
                  </button>
                  <select
                    value={assignTo}
                    onChange={(e) => setAssignTo(e.target.value)}
                    className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Choose account…</option>
                    {active.map((a) => (
                      <option key={a.id} value={a.id}>
                        {accountLabel(a)}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={selectedIds.length === 0 || !assignTo}
                    onClick={() => {
                      onBulkAssignAccount(selectedIds, assignTo);
                      setSelectedIds([]);
                      setAssignTo('');
                    }}
                  >
                    Assign
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-1 pb-1">
            <Button variant="secondary" className="w-full" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
