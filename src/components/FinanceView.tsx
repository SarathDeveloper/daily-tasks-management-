import React, { useMemo, useState } from 'react';
import {
  Wallet,
  Plus,
  ChevronLeft,
  ChevronRight,
  ArrowDownCircle,
  ArrowUpCircle,
  Pencil,
  Trash2,
  Calendar,
  PieChart,
  Target,
  Search,
  X,
  Repeat,
  Check,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  PiggyBank,
  Receipt,
  AlertCircle,
} from 'lucide-react';
import {
  BillPayment,
  BillTemplate,
  BudgetAlert,
  CategoryBudget,
  Debt,
  FinanceTransaction,
  MonthlyBudget,
  PaymentMethod,
  SavingsEntry,
  SavingsGoal,
  SavingsStreakState,
} from '../types';
import {
  ALL_PAYMENT_METHODS,
  EXPENSE_CATEGORIES,
  QUICK_ADD_AMOUNTS,
  QUICK_ADD_FALLBACK_CATEGORIES,
} from '../data/financeCategories';
import { recentExpenseCategories } from '../lib/financeRecurrence';
import {
  getDailySpendForMonth,
  getLast7DaysData,
  getMonthOverMonthCompare,
  getPrev7DaysTotals,
  getSavingsProgress,
} from '../lib/financeInsights';
import {
  calculateStreak,
  getLastNDaysHeatmap,
  getMonthlySavingsTotal,
  getMonthlySavedDays,
  heatmapIntensity,
} from '../lib/savingsStreak';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Dropdown } from './ui/Dropdown';
import { FinanceAlertBanner } from './FinanceAlertBanner';
import { LedgerView, type LedgerViewProps } from './ledger/LedgerView';

interface FinanceViewProps {
  transactions: FinanceTransaction[];
  budgets: MonthlyBudget[];
  categoryBudgets: CategoryBudget[];
  debts: Debt[];
  savingsGoals: SavingsGoal[];
  billTemplates: BillTemplate[];
  billPayments: BillPayment[];
  savingsEntries: SavingsEntry[];
  savingsStreak: SavingsStreakState;
  financeAlerts: BudgetAlert[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  ledger: LedgerViewProps;
  onAddTransaction: () => void;
  onEditTransaction: (tx: FinanceTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  onSetBudget: (month: string, limit: number) => void;
  onSetCategoryBudget: (month: string, category: string, limit: number) => void;
  onRemoveCategoryBudget: (month: string, category: string) => void;
  onQuickAdd: (amount: number, category: string) => void;
  onAddDebt: () => void;
  onEditDebt: (debt: Debt) => void;
  onDeleteDebt: (id: string) => void;
  onToggleDebtPaid: (id: string) => void;
  onSetSavingsGoal: (month: string, target: number) => void;
  onAddBillTemplate: () => void;
  onEditBillTemplate: (template: BillTemplate) => void;
  onDeleteBillTemplate: (id: string) => void;
  onToggleBillPaid: (payment: BillPayment) => void;
  onUpdateBillPaymentAmount: (payment: BillPayment, amount: number) => void;
  onAddSavings: () => void;
  onEditSavings: (entry: SavingsEntry) => void;
  onDeleteSavings: (id: string) => void;
  onQuickAddSavings: (amount: number) => void;
  onDismissAlert: (key: string) => void;
}

type FinanceMode = 'ledger' | 'daily' | 'weekly' | 'monthly' | 'bills' | 'debts' | 'savings';
type FilterType = 'all' | 'expense' | 'income';
type FilterPayment = 'all' | PaymentMethod;
type DebtFilter = 'all' | 'outstanding' | 'settled';
type BillsSubView = 'payments' | 'templates';

const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);

const toMonthKey = (dateStr: string) => dateStr.slice(0, 7);

const shiftDate = (dateStr: string, days: number) => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const shiftMonth = (monthKey: string, offset: number) => {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (monthKey: string) => {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
};

const paymentLabel = (m?: PaymentMethod) =>
  m ? ALL_PAYMENT_METHODS.find((p) => p.value === m)?.label || m : '';
const paymentEmoji = (m?: PaymentMethod) =>
  m ? ALL_PAYMENT_METHODS.find((p) => p.value === m)?.emoji || '' : '';

export const FinanceView: React.FC<FinanceViewProps> = ({
  transactions,
  budgets,
  categoryBudgets,
  debts,
  savingsGoals,
  billTemplates,
  billPayments,
  savingsEntries,
  savingsStreak,
  financeAlerts,
  selectedDate,
  onSelectDate,
  ledger,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onSetBudget,
  onSetCategoryBudget,
  onRemoveCategoryBudget,
  onQuickAdd,
  onAddDebt,
  onEditDebt,
  onDeleteDebt,
  onToggleDebtPaid,
  onSetSavingsGoal,
  onAddBillTemplate,
  onEditBillTemplate,
  onDeleteBillTemplate,
  onToggleBillPaid,
  onUpdateBillPaymentAmount,
  onAddSavings,
  onEditSavings,
  onDeleteSavings,
  onQuickAddSavings,
  onDismissAlert,
}) => {
  const [mode, setMode] = useState<FinanceMode>('ledger');
  const [selectedMonth, setSelectedMonth] = useState(() => toMonthKey(selectedDate));
  const [budgetInput, setBudgetInput] = useState('');
  const [isEditingBudget, setIsEditingBudget] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<FilterPayment>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Category budget editor
  const [catBudgetCategory, setCatBudgetCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [catBudgetAmount, setCatBudgetAmount] = useState('');
  const [addingCatBudget, setAddingCatBudget] = useState(false);

  // Savings goal editor
  const [savingsInput, setSavingsInput] = useState('');
  const [isEditingSavings, setIsEditingSavings] = useState(false);

  // Debt filter
  const [debtFilter, setDebtFilter] = useState<DebtFilter>('outstanding');

  // Bills sub-view
  const [billsSubView, setBillsSubView] = useState<BillsSubView>('payments');
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const dailyTx = useMemo(
    () =>
      transactions
        .filter((t) => t.date === selectedDate)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [transactions, selectedDate]
  );

  const dailyExpense = dailyTx
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const dailyIncome = dailyTx
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  const monthlyTx = useMemo(
    () =>
      transactions
        .filter((t) => t.date.startsWith(selectedMonth))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [transactions, selectedMonth]
  );

  const monthlyExpense = monthlyTx
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const monthlyIncome = monthlyTx
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const monthlyNet = monthlyIncome - monthlyExpense;

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    monthlyTx
      .filter((t) => t.type === 'expense')
      .forEach((t) => map.set(t.category, (map.get(t.category) || 0) + t.amount));
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthlyTx]);

  const currentBudget = budgets.find((b) => b.month === selectedMonth);
  const budgetLimit = currentBudget?.limit ?? 0;
  const budgetUsedPct =
    budgetLimit > 0 ? Math.min(100, Math.round((monthlyExpense / budgetLimit) * 100)) : 0;
  const budgetRemaining = budgetLimit - monthlyExpense;

  const monthCategoryBudgets = useMemo(
    () => categoryBudgets.filter((b) => b.month === selectedMonth),
    [categoryBudgets, selectedMonth]
  );

  const recentCats = useMemo(() => {
    const recents = recentExpenseCategories(transactions, 5);
    if (recents.length >= 3) return recents.slice(0, 5);
    const merged = Array.from(
      new Set([...recents, ...QUICK_ADD_FALLBACK_CATEGORIES])
    ) as string[];
    return merged
      .filter((c) => (EXPENSE_CATEGORIES as readonly string[]).includes(c))
      .slice(0, 5);
  }, [transactions]);

  const applyFilters = (list: FinanceTransaction[]) =>
    list.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (paymentFilter !== 'all' && t.paymentMethod !== paymentFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const inCategory = t.category.toLowerCase().includes(q);
        const inNote = (t.note || '').toLowerCase().includes(q);
        if (!inCategory && !inNote) return false;
      }
      return true;
    });

  const filteredDailyTx = applyFilters(dailyTx);
  const filteredMonthlyTx = applyFilters(monthlyTx);

  const hasActiveFilters =
    typeFilter !== 'all' ||
    categoryFilter !== 'all' ||
    paymentFilter !== 'all' ||
    searchQuery !== '';

  const clearFilters = () => {
    setTypeFilter('all');
    setCategoryFilter('all');
    setPaymentFilter('all');
    setSearchQuery('');
  };

  const handleSaveBudget = () => {
    const parsed = parseFloat(budgetInput);
    if (!parsed || parsed <= 0 || Number.isNaN(parsed)) return;
    onSetBudget(selectedMonth, Math.round(parsed * 100) / 100);
    setIsEditingBudget(false);
    setBudgetInput('');
  };

  const openBudgetEdit = () => {
    setBudgetInput(budgetLimit > 0 ? String(budgetLimit) : '');
    setIsEditingBudget(true);
  };

  const handleAddCategoryBudget = () => {
    const parsed = parseFloat(catBudgetAmount);
    if (!parsed || parsed <= 0 || Number.isNaN(parsed)) return;
    onSetCategoryBudget(
      selectedMonth,
      catBudgetCategory,
      Math.round(parsed * 100) / 100
    );
    setCatBudgetAmount('');
    setAddingCatBudget(false);
  };

  // Insights: weekly, MoM, daily chart, savings
  const last7Days = useMemo(() => getLast7DaysData(transactions), [transactions]);
  const prev7Totals = useMemo(() => getPrev7DaysTotals(transactions), [transactions]);
  const week7Expense = last7Days.reduce((s, d) => s + d.expense, 0);
  const week7Avg = week7Expense / 7;
  const week7DeltaPct =
    prev7Totals.expense > 0
      ? Math.round(((week7Expense - prev7Totals.expense) / prev7Totals.expense) * 100)
      : null;

  const dailySpendMonth = useMemo(
    () => getDailySpendForMonth(transactions, selectedMonth),
    [transactions, selectedMonth]
  );
  const maxDailySpend = useMemo(
    () => Math.max(...dailySpendMonth.map((d) => d.amount), 1),
    [dailySpendMonth]
  );

  const prevMonthKey = useMemo(
    () => shiftMonth(selectedMonth, -1),
    [selectedMonth]
  );
  const momCompare = useMemo(
    () => getMonthOverMonthCompare(transactions, selectedMonth, prevMonthKey),
    [transactions, selectedMonth, prevMonthKey]
  );

  const currentSavingsGoal = savingsGoals.find((g) => g.month === selectedMonth);
  const savingsTarget = currentSavingsGoal?.target ?? 0;
  const savingsProgress = useMemo(
    () => getSavingsProgress(monthlyNet, savingsTarget),
    [monthlyNet, savingsTarget]
  );

  const handleSaveSavingsGoal = () => {
    const parsed = parseFloat(savingsInput);
    if (!parsed || parsed <= 0 || Number.isNaN(parsed)) return;
    onSetSavingsGoal(selectedMonth, Math.round(parsed * 100) / 100);
    setIsEditingSavings(false);
    setSavingsInput('');
  };

  const openSavingsEdit = () => {
    setSavingsInput(savingsTarget > 0 ? String(savingsTarget) : '');
    setIsEditingSavings(true);
  };

  // Debts
  const filteredDebts = useMemo(() => {
    const sorted = [...debts].sort((a, b) => {
      if (a.paid !== b.paid) return a.paid ? 1 : -1;
      return b.createdAt.localeCompare(a.createdAt);
    });
    if (debtFilter === 'outstanding') return sorted.filter((d) => !d.paid);
    if (debtFilter === 'settled') return sorted.filter((d) => d.paid);
    return sorted;
  }, [debts, debtFilter]);

  const outstandingLent = debts
    .filter((d) => d.direction === 'lent' && !d.paid)
    .reduce((s, d) => s + d.amount, 0);
  const outstandingOwed = debts
    .filter((d) => d.direction === 'owed' && !d.paid)
    .reduce((s, d) => s + d.amount, 0);
  const debtNet = outstandingLent - outstandingOwed;

  // Bills
  const monthBillPayments = useMemo(
    () =>
      billPayments
        .filter((p) => p.month === selectedMonth)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [billPayments, selectedMonth]
  );
  const billsTotalDue = monthBillPayments.reduce((s, p) => s + p.amount, 0);
  const billsPaidTotal = monthBillPayments
    .filter((p) => p.paid)
    .reduce((s, p) => s + p.amount, 0);
  const billsUnpaidCount = monthBillPayments.filter((p) => !p.paid).length;

  const startEditingPayment = (payment: BillPayment) => {
    setEditingPaymentId(payment.id);
    setPaymentAmountInput(String(payment.amount));
  };

  const submitPaymentAmount = (payment: BillPayment) => {
    const parsed = parseFloat(paymentAmountInput);
    if (parsed && parsed > 0 && !Number.isNaN(parsed)) {
      onUpdateBillPaymentAmount(payment, Math.round(parsed * 100) / 100);
    }
    setEditingPaymentId(null);
    setPaymentAmountInput('');
  };

  // Savings
  const currentSavingsMonth = toMonthKey(selectedDate);
  const savingsHeatmap = useMemo(
    () => getLastNDaysHeatmap(savingsEntries, 30),
    [savingsEntries]
  );
  const heatmapMax = useMemo(
    () => savingsHeatmap.reduce((m, d) => Math.max(m, d.amount), 0),
    [savingsHeatmap]
  );
  const monthSavingsTotal = useMemo(
    () => getMonthlySavingsTotal(savingsEntries, currentSavingsMonth),
    [savingsEntries, currentSavingsMonth]
  );
  const monthSavedDays = useMemo(
    () => getMonthlySavedDays(savingsEntries, currentSavingsMonth),
    [savingsEntries, currentSavingsMonth]
  );
  const monthSavingsList = useMemo(
    () =>
      savingsEntries
        .filter((e) => e.date.startsWith(currentSavingsMonth))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [savingsEntries, currentSavingsMonth]
  );
  const daysInMonth = new Date(
    parseInt(currentSavingsMonth.slice(0, 4)),
    parseInt(currentSavingsMonth.slice(5, 7)),
    0
  ).getDate();
  const savedToday = savingsEntries.some((e) => e.date === todayStr && e.amount > 0);
  const currentStreak = savingsStreak.currentStreak;
  const longestStreak = savingsStreak.longestStreak;
  const SAVINGS_QUICK_AMOUNTS = [50, 100, 200, 500];

  return (
    <div className="max-w-4xl lg:max-w-6xl mx-auto space-y-5 pb-20 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Personal Finance</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Accounts, ledger, budgets and savings
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={onAddTransaction} className="self-start sm:self-auto">
          <Plus className="w-4 h-4" />
          Add Entry
        </Button>
      </div>

      {/* Alert banner */}
      {financeAlerts.length > 0 && (
        <FinanceAlertBanner alerts={financeAlerts} onDismiss={onDismissAlert} />
      )}

      {/* Ledger / Daily / Weekly / Monthly / Bills / Debts / Savings + Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 max-w-full overflow-x-auto no-scrollbar">
          <button
            onClick={() => setMode('ledger')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors shrink-0 ${
              mode === 'ledger'
                ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" />
              Ledger
            </span>
          </button>
          <button
            onClick={() => setMode('daily')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors shrink-0 ${
              mode === 'daily'
                ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Daily
            </span>
          </button>
          <button
            onClick={() => setMode('weekly')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
              mode === 'weekly'
                ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Week
            </span>
          </button>
          <button
            onClick={() => {
              setMode('monthly');
              setSelectedMonth(toMonthKey(selectedDate));
            }}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
              mode === 'monthly'
                ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5" />
              Monthly
            </span>
          </button>
          <button
            onClick={() => setMode('bills')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
              mode === 'bills'
                ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5" />
              Bills
            </span>
          </button>
          <button
            onClick={() => setMode('debts')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
              mode === 'debts'
                ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" />
              Debts
            </span>
          </button>
          <button
            onClick={() => setMode('savings')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
              mode === 'savings'
                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <PiggyBank className="w-3.5 h-3.5" />
              Savings
            </span>
          </button>
        </div>

        {mode !== 'debts' && mode !== 'bills' && mode !== 'savings' && mode !== 'ledger' && (
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Filters
            {hasActiveFilters && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-black">
                {[typeFilter, categoryFilter, paymentFilter].filter((v) => v !== 'all').length + (searchQuery ? 1 : 0)}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Filter bar */}
      {showFilters && (
        <Card className="p-3 space-y-2.5">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by category or note..."
              className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[40px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 snap-x touch-pan-x">
            <Dropdown
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as FilterType)}
              title="Filter by Type"
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'expense', label: 'Expenses' },
                { value: 'income', label: 'Income' },
              ]}
            />
            <Dropdown
              value={categoryFilter}
              onChange={setCategoryFilter}
              title="Filter by Category"
              options={[
                { value: 'all', label: 'All Categories' },
                ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })),
              ]}
            />
            <Dropdown
              value={paymentFilter}
              onChange={(v) => setPaymentFilter(v as FilterPayment)}
              title="Filter by Payment"
              options={[
                { value: 'all', label: 'All Payments' },
                ...ALL_PAYMENT_METHODS.map((p) => ({ value: p.value, label: `${p.emoji} ${p.label}` })),
              ]}
            />
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 underline shrink-0 px-1"
              >
                Clear all
              </button>
            )}
          </div>
        </Card>
      )}

      {/* ============ MONEY LEDGER ============ */}
      {mode === 'ledger' && <LedgerView {...ledger} />}

      {/* ============ WEEKLY VIEW ============ */}
      {mode === 'weekly' && (
        <>
          {/* Week KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 sm:p-4">
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-[10px] sm:text-xs font-semibold mb-1">
                <ArrowDownCircle className="w-3.5 h-3.5" />
                7-day Spent
              </div>
              <p className="text-base sm:text-xl font-black text-slate-900 dark:text-white truncate">
                {formatMoney(week7Expense)}
              </p>
            </Card>
            <Card className="p-3 sm:p-4">
              <div className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Daily Avg
              </div>
              <p className="text-base sm:text-xl font-black text-slate-900 dark:text-white truncate">
                {formatMoney(week7Avg)}
              </p>
            </Card>
            <Card className="p-3 sm:p-4">
              <div className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                vs Prev Week
              </div>
              <p
                className={`text-base sm:text-xl font-black truncate ${
                  week7DeltaPct === null
                    ? 'text-slate-400'
                    : week7DeltaPct > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : week7DeltaPct < 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {week7DeltaPct === null
                  ? '—'
                  : `${week7DeltaPct > 0 ? '+' : ''}${week7DeltaPct}%`}
              </p>
            </Card>
          </div>

          {/* 7-day bar chart */}
          <Card className="p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Last 7 Days Spending</span>
            </h3>
            <div className="flex items-end justify-between gap-2 h-40 pt-2">
              {last7Days.map((d) => {
                const maxVal = Math.max(...last7Days.map((x) => x.expense), 1);
                const heightPercent = (d.expense / maxVal) * 100;
                return (
                  <div
                    key={d.dateStr}
                    className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end"
                  >
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold">
                      {d.expense > 0 ? formatMoney(d.expense).replace('₹', '') : ''}
                    </span>
                    <div className="w-full max-w-[32px] bg-slate-100 dark:bg-slate-900 rounded-t-lg overflow-hidden flex flex-col justify-end h-full border border-slate-200 dark:border-slate-800">
                      <div
                        className="w-full bg-indigo-500 dark:bg-indigo-400 rounded-t-lg transition-all duration-300"
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase">
                      {d.dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Last 7 days transactions */}
          {last7Days.some((d) => d.expense > 0 || d.income > 0) ? (
            <div className="space-y-3">
              {[...last7Days].reverse().map((d) => {
                const dayTx = transactions
                  .filter((t) => t.date === d.dateStr)
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
                if (dayTx.length === 0) return null;
                return (
                  <div key={d.dateStr} className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {new Date(d.dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {formatMoney(d.expense)} spent
                      </span>
                    </div>
                    {dayTx.map((tx) => (
                      <TransactionRow
                        key={tx.id}
                        tx={tx}
                        accountName={ledger.accounts.find((a) => a.id === tx.accountId)?.name}
                        destinationName={
                          ledger.accounts.find((a) => a.id === tx.destinationAccountId)?.name
                        }
                        onEdit={onEditTransaction}
                        onDelete={onDeleteTransaction}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              message="No transactions in the last 7 days"
              hint="Start logging expenses to see your weekly trends."
              onAdd={onAddTransaction}
            />
          )}
        </>
      )}

      {/* ============ DAILY VIEW ============ */}
      {mode === 'daily' && (
        <>
          {/* Date navigator */}
          <Card className="p-3 flex items-center justify-between gap-2">
            <button
              onClick={() => onSelectDate(shiftDate(selectedDate, -1))}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center flex-1">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onSelectDate(e.target.value)}
                className="bg-transparent text-center font-bold text-sm text-slate-900 dark:text-white focus:outline-none"
              />
              {selectedDate === todayStr && (
                <span className="block text-[10px] uppercase tracking-wider font-bold text-indigo-600 dark:text-indigo-400">
                  Today
                </span>
              )}
            </div>
            <button
              onClick={() => onSelectDate(shiftDate(selectedDate, 1))}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </Card>

          {/* Daily KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 sm:p-4">
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-[10px] sm:text-xs font-semibold mb-1">
                <ArrowDownCircle className="w-3.5 h-3.5" />
                Spent
              </div>
              <p className="text-base sm:text-xl font-black text-slate-900 dark:text-white truncate">
                {formatMoney(dailyExpense)}
              </p>
            </Card>
            <Card className="p-3 sm:p-4">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-xs font-semibold mb-1">
                <ArrowUpCircle className="w-3.5 h-3.5" />
                Earned
              </div>
              <p className="text-base sm:text-xl font-black text-slate-900 dark:text-white truncate">
                {formatMoney(dailyIncome)}
              </p>
            </Card>
            <Card className="p-3 sm:p-4">
              <div className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Net
              </div>
              <p
                className={`text-base sm:text-xl font-black truncate ${
                  dailyIncome - dailyExpense >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatMoney(dailyIncome - dailyExpense)}
              </p>
            </Card>
          </div>

          {/* Quick-add shortcuts */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Quick add
              </span>
              {QUICK_ADD_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => {
                    if (recentCats[0]) onQuickAdd(amt, recentCats[0]);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                  title={`Add ₹${amt} to ${recentCats[0] || 'category'}`}
                >
                  +₹{amt}
                </button>
              ))}
              <button
                onClick={onAddTransaction}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
              >
                Custom...
              </button>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Category
              </span>
              {recentCats.map((c) => (
                <button
                  key={c}
                  onClick={() => onQuickAdd(QUICK_ADD_AMOUNTS[1], c)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                  title={`Add ₹${QUICK_ADD_AMOUNTS[1]} to ${c}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Daily transaction list */}
          {filteredDailyTx.length > 0 ? (
            <div className="space-y-2">
              {filteredDailyTx.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  accountName={ledger.accounts.find((a) => a.id === tx.accountId)?.name}
                  destinationName={
                    ledger.accounts.find((a) => a.id === tx.destinationAccountId)?.name
                  }
                  onEdit={onEditTransaction}
                  onDelete={onDeleteTransaction}
                />
              ))}
            </div>
          ) : dailyTx.length > 0 ? (
            <div className="text-center py-8 px-4 bg-white/80 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No matches</p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                Try clearing filters to see all transactions for this day.
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <EmptyState
              message="No transactions for this day"
              hint="Log an expense or income to start tracking."
              onAdd={onAddTransaction}
            />
          )}
        </>
      )}

      {/* ============ MONTHLY VIEW ============ */}
      {mode === 'monthly' && (
        <>
          {/* Month navigator */}
          <Card className="p-3 flex items-center justify-between gap-2">
            <button
              onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center flex-1">
              <p className="font-bold text-sm text-slate-900 dark:text-white">
                {monthLabel(selectedMonth)}
              </p>
            </div>
            <button
              onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </Card>

          {/* Monthly KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-xs font-semibold mb-1">
                <ArrowDownCircle className="w-4 h-4" />
                Expenses
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white">
                {formatMoney(monthlyExpense)}
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-1">
                <ArrowUpCircle className="w-4 h-4" />
                Income
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white">
                {formatMoney(monthlyIncome)}
              </p>
            </Card>
            <Card className="p-4">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Net</div>
              <p
                className={`text-xl font-black ${
                  monthlyNet >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatMoney(monthlyNet)}
              </p>
            </Card>
            <Card className="p-4">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Entries
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white">{monthlyTx.length}</p>
            </Card>
          </div>

          {/* Daily spend chart */}
          {dailySpendMonth.some((d) => d.amount > 0) && (
            <Card className="p-5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Daily Spend — {monthLabel(selectedMonth)}</span>
              </h3>
              <div className="flex items-end justify-between gap-0.5 h-32 pt-2 overflow-x-auto no-scrollbar">
                {dailySpendMonth.map((d) => {
                  const heightPercent = (d.amount / maxDailySpend) * 100;
                  return (
                    <div
                      key={d.date}
                      className="flex-1 min-w-[6px] flex flex-col items-center justify-end h-full group relative"
                      title={`${d.date}: ${formatMoney(d.amount)}`}
                    >
                      <div
                        className="w-full bg-indigo-500 dark:bg-indigo-400 rounded-t transition-all duration-200 hover:bg-indigo-600"
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-2">
                <span>1</span>
                <span>{Math.ceil(dailySpendMonth.length / 2)}</span>
                <span>{dailySpendMonth.length}</span>
              </div>
            </Card>
          )}

          {/* Month-over-month compare */}
          {momCompare.overall.prev > 0 && (
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>vs Last Month</span>
              </h3>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Overall</span>
                <span
                  className={`font-bold ${
                    momCompare.overall.pctChange === null
                      ? 'text-slate-500'
                      : momCompare.overall.pctChange > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : momCompare.overall.pctChange < 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500'
                  }`}
                >
                  {formatMoney(momCompare.overall.prev)} → {formatMoney(momCompare.overall.current)}
                  {momCompare.overall.pctChange !== null && (
                    <span className="ml-1">
                      ({momCompare.overall.pctChange > 0 ? '+' : ''}
                      {momCompare.overall.pctChange}%)
                    </span>
                  )}
                </span>
              </div>
              <div className="space-y-2">
                {momCompare.byCategory.slice(0, 3).map((c) => (
                  <div
                    key={c.category}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-slate-700 dark:text-slate-300 truncate flex-1">
                      {c.category}
                    </span>
                    <span
                      className={`font-bold ${
                        c.pctChange === null
                          ? 'text-slate-500'
                          : c.pctChange > 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : c.pctChange < 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {formatMoney(c.prev)} → {formatMoney(c.current)}
                      {c.pctChange !== null && (
                        <span className="ml-1">
                          ({c.pctChange > 0 ? '+' : ''}
                          {c.pctChange}%)
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Savings goal card */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PiggyBank className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Savings Goal
              </h3>
              {!isEditingSavings && (
                <button
                  onClick={openSavingsEdit}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {savingsTarget > 0 ? 'Edit' : 'Set goal'}
                </button>
              )}
            </div>

            {isEditingSavings ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={savingsInput}
                    onChange={(e) => setSavingsInput(e.target.value)}
                    placeholder="e.g. 15000"
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={handleSaveSavingsGoal}>
                    Save
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditingSavings(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : savingsTarget > 0 ? (
              <>
                <div className="flex items-end justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    {formatMoney(savingsProgress.saved)} of {formatMoney(savingsTarget)}
                  </span>
                  {savingsProgress.met ? (
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      Goal met
                    </span>
                  ) : (
                    <span className="font-bold text-slate-500 dark:text-slate-400">
                      {formatMoney(Math.max(0, savingsTarget - savingsProgress.saved))} to go
                    </span>
                  )}
                </div>
                <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      savingsProgress.met
                        ? 'bg-emerald-500'
                        : 'bg-indigo-500'
                    }`}
                    style={{ width: `${savingsProgress.pct}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Set a monthly savings target to track how much you're saving (income minus expenses).
              </p>
            )}
          </Card>

          {/* Budget card */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Monthly Budget
              </h3>
              {!isEditingBudget && (
                <button
                  onClick={openBudgetEdit}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {budgetLimit > 0 ? 'Edit' : 'Set budget'}
                </button>
              )}
            </div>

            {isEditingBudget ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    placeholder="e.g. 25000"
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={handleSaveBudget}>
                    Save
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditingBudget(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : budgetLimit > 0 ? (
              <>
                <div className="flex items-end justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    {formatMoney(monthlyExpense)} of {formatMoney(budgetLimit)}
                  </span>
                  <span
                    className={`font-bold ${
                      budgetRemaining >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {budgetRemaining >= 0
                      ? `${formatMoney(budgetRemaining)} left`
                      : `${formatMoney(Math.abs(budgetRemaining))} over`}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      budgetUsedPct >= 100
                        ? 'bg-rose-500'
                        : budgetUsedPct >= 80
                        ? 'bg-amber-500'
                        : 'bg-indigo-500'
                    }`}
                    style={{ width: `${budgetUsedPct}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Set a monthly spending limit to track how much budget you have left.
              </p>
            )}
          </Card>

          {/* Category budgets */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Category Budgets
              </h3>
              {!addingCatBudget && (
                <button
                  onClick={() => setAddingCatBudget(true)}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  + Add
                </button>
              )}
            </div>

            {addingCatBudget && (
              <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={catBudgetCategory}
                    onChange={(e) => setCatBudgetCategory(e.target.value)}
                    className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={catBudgetAmount}
                      onChange={(e) => setCatBudgetAmount(e.target.value)}
                      placeholder="Limit"
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={handleAddCategoryBudget}>
                    Save
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setAddingCatBudget(false);
                      setCatBudgetAmount('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {monthCategoryBudgets.length === 0 && !addingCatBudget ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Set per-category limits (e.g. Food ₹8,000, Transport ₹2,000) to see which categories are over budget.
              </p>
            ) : (
              <div className="space-y-2.5">
                {monthCategoryBudgets.map((cb) => {
                  const spent = categoryBreakdown.find((c) => c.category === cb.category)?.amount || 0;
                  const pct = cb.limit > 0 ? Math.min(100, Math.round((spent / cb.limit) * 100)) : 0;
                  const over = spent > cb.limit;
                  const remaining = cb.limit - spent;
                  return (
                    <div key={cb.id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {cb.category}
                        </span>
                        <span className={`font-bold ${over ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          {formatMoney(spent)} / {formatMoney(cb.limit)}
                          {over
                            ? ` · ${formatMoney(Math.abs(remaining))} over`
                            : remaining > 0
                            ? ` · ${formatMoney(remaining)} left`
                            : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${over ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <button
                          onClick={() => onRemoveCategoryBudget(selectedMonth, cb.category)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Remove budget"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Category breakdown */}
          {categoryBreakdown.length > 0 && (
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Spending by Category
              </h3>
              <div className="space-y-2.5">
                {categoryBreakdown.map(({ category, amount }) => {
                  const pct = monthlyExpense > 0 ? Math.round((amount / monthlyExpense) * 100) : 0;
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {category}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {formatMoney(amount)} · {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Monthly transaction list */}
          {filteredMonthlyTx.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white px-0.5">
                All Transactions
                {hasActiveFilters && (
                  <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                    {filteredMonthlyTx.length} of {monthlyTx.length}
                  </span>
                )}
              </h3>
              {filteredMonthlyTx.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  showDate
                  accountName={ledger.accounts.find((a) => a.id === tx.accountId)?.name}
                  destinationName={
                    ledger.accounts.find((a) => a.id === tx.destinationAccountId)?.name
                  }
                  onEdit={onEditTransaction}
                  onDelete={onDeleteTransaction}
                />
              ))}
            </div>
          ) : monthlyTx.length > 0 ? (
            <div className="text-center py-8 px-4 bg-white/80 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No matches</p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                Try clearing filters to see all transactions this month.
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <EmptyState
              message="No transactions this month"
              hint="Add daily expenses to see your monthly summary."
              onAdd={onAddTransaction}
            />
          )}
        </>
      )}

      {/* ============ BILLS VIEW ============ */}
      {mode === 'bills' && (
        <>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Monthly Bills</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Recurring bills auto-generated each month. Tick as paid to log the expense.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={onAddBillTemplate}>
              <Plus className="w-4 h-4" />
              Add Bill
            </Button>
          </div>

          {/* Sub-view toggle: Payments vs Templates */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setBillsSubView('payments')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                billsSubView === 'payments'
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Payments
            </button>
            <button
              onClick={() => setBillsSubView('templates')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                billsSubView === 'templates'
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Templates
            </button>
          </div>

          {billsSubView === 'payments' ? (
            <>
              {/* Month navigator */}
              <Card className="p-3 flex items-center justify-between gap-2">
                <button
                  onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-center flex-1">
                  <p className="font-bold text-sm text-slate-900 dark:text-white">
                    {monthLabel(selectedMonth)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </Card>

              {/* Bills KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3 sm:p-4">
                  <div className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Total Due
                  </div>
                  <p className="text-base sm:text-xl font-black text-slate-900 dark:text-white truncate">
                    {formatMoney(billsTotalDue)}
                  </p>
                </Card>
                <Card className="p-3 sm:p-4">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-xs font-semibold mb-1">
                    <Check className="w-3.5 h-3.5" />
                    Paid
                  </div>
                  <p className="text-base sm:text-xl font-black text-slate-900 dark:text-white truncate">
                    {formatMoney(billsPaidTotal)}
                  </p>
                </Card>
                <Card className="p-3 sm:p-4">
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-[10px] sm:text-xs font-semibold mb-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Unpaid
                  </div>
                  <p className="text-base sm:text-xl font-black text-slate-900 dark:text-white truncate">
                    {billsUnpaidCount}
                  </p>
                </Card>
              </div>

              {/* Bills list */}
              {monthBillPayments.length > 0 ? (
                <div className="space-y-2">
                  {monthBillPayments.map((payment) => {
                    const template = billTemplates.find((t) => t.id === payment.billId);
                    const isOverdue = !payment.paid && payment.dueDate < todayStr;
                    return (
                      <Card
                        key={payment.id}
                        className={`p-3 flex items-center gap-3 transition-opacity ${
                          payment.paid ? 'opacity-60' : ''
                        }`}
                      >
                        <button
                          onClick={() => onToggleBillPaid(payment)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 transition-colors ${
                            payment.paid
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-300 hover:border-emerald-400'
                          }`}
                          title={payment.paid ? 'Mark as unpaid' : 'Mark as paid'}
                        >
                          <Check className="w-5 h-5" strokeWidth={3} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                            {template?.name || 'Unknown Bill'}
                            {isOverdue && (
                              <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
                                Overdue
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            Due {new Date(payment.dueDate + 'T00:00:00').toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })}
                            {template?.category && <span> · {template.category}</span>}
                            {payment.note && <span> · {payment.note}</span>}
                          </p>
                        </div>
                        <div className="text-right shrink-0 flex items-center gap-1">
                          {editingPaymentId === payment.id ? (
                            <div className="flex items-center gap-1">
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">₹</span>
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={paymentAmountInput}
                                  onChange={(e) => setPaymentAmountInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') submitPaymentAmount(payment);
                                    if (e.key === 'Escape') {
                                      setEditingPaymentId(null);
                                      setPaymentAmountInput('');
                                    }
                                  }}
                                  className="w-20 bg-slate-100 dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 rounded-lg pl-6 pr-2 py-1 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  autoFocus
                                />
                              </div>
                              <button
                                onClick={() => submitPaymentAmount(payment)}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                title="Save amount"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditingPayment(payment)}
                              className="text-sm font-black text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400"
                              title="Tap to edit amount"
                            >
                              {formatMoney(payment.amount)}
                            </button>
                          )}
                          {editingPaymentId !== payment.id && (
                            <div className="flex items-center gap-0.5 ml-1">
                              {template && (
                                <button
                                  onClick={() => onEditBillTemplate(template)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  title="Edit template"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 px-4 bg-white/80 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
                  <Receipt className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    No bills for {monthLabel(selectedMonth)}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 max-w-xs mx-auto">
                    {billTemplates.length === 0
                      ? 'Add a bill template (e.g. Electricity, Rent) to auto-generate monthly bills.'
                      : 'No active bill templates generate bills for this month.'}
                  </p>
                  <div className="mt-4 flex justify-center">
                    <Button variant="primary" size="sm" onClick={onAddBillTemplate}>
                      <Plus className="w-4 h-4" />
                      Add Bill Template
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Templates sub-view */
            <>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Bill Templates ({billTemplates.length})
                </h3>
                <Button variant="primary" size="sm" onClick={onAddBillTemplate}>
                  <Plus className="w-4 h-4" />
                  New Template
                </Button>
              </div>
              {billTemplates.length > 0 ? (
                <div className="space-y-2">
                  {billTemplates.map((template) => (
                    <Card key={template.id} className="p-3 flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          template.active
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}
                      >
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                          {template.name}
                          {!template.active && (
                            <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              Paused
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Due day {template.dueDayOfMonth} · {template.category}
                          {template.note && <span> · {template.note}</span>}
                        </p>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-1">
                        <p className="text-sm font-black text-slate-900 dark:text-white">
                          {formatMoney(template.amount)}
                        </p>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => onEditBillTemplate(template)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteBillTemplate(template.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 px-4 bg-white/80 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
                  <Receipt className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    No bill templates yet
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 max-w-xs mx-auto">
                    Create a template for each recurring bill (Electricity, Rent, Internet, Phone) and we'll auto-generate a bill every month to tick as paid.
                  </p>
                  <div className="mt-4 flex justify-center">
                    <Button variant="primary" size="sm" onClick={onAddBillTemplate}>
                      <Plus className="w-4 h-4" />
                      Add Bill Template
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ============ SAVINGS VIEW ============ */}
      {mode === 'savings' && (
        <>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PiggyBank className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Savings Habit</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Log a small saving each day to build a streak. Consistency beats amount.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={onAddSavings}>
              <Plus className="w-4 h-4" />
              Log Savings
            </Button>
          </div>

          {/* Streak card */}
          <Card className="p-4 bg-gradient-to-br from-emerald-50 to-indigo-50 dark:from-emerald-950/30 dark:to-indigo-950/30 border-emerald-200/60 dark:border-emerald-900/40">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="text-4xl">{currentStreak > 0 ? '🔥' : '🌱'}</div>
                <div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                    {currentStreak} {currentStreak === 1 ? 'day' : 'days'}
                  </p>
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                    Current streak
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 dark:text-slate-400">Longest</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{longestStreak} days</p>
                {savingsStreak.lastSavedDate && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Last saved {new Date(savingsStreak.lastSavedDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-900/40">
              {savedToday ? (
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  You saved today — streak is safe!
                </p>
              ) : (
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Log a saving today to keep your streak alive.
                </p>
              )}
            </div>
          </Card>

          {/* Quick-add chips */}
          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Quick add today's saving:
            </p>
            <div className="flex flex-wrap gap-2">
              {SAVINGS_QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => onQuickAddSavings(amt)}
                  className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  +₹ {amt}
                </button>
              ))}
              <button
                onClick={onAddSavings}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Custom...
              </button>
            </div>
          </div>

          {/* 30-day heatmap */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Last 30 days
              </h4>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {savingsHeatmap.filter((d) => d.saved).length} / 30 days saved
              </span>
            </div>
            <div className="grid grid-cols-10 sm:grid-cols-15 gap-1">
              {savingsHeatmap.map((d) => {
                const intensity = heatmapIntensity(d.amount, heatmapMax);
                const bg = d.saved
                  ? intensity >= 4
                    ? 'bg-emerald-600'
                    : intensity === 3
                    ? 'bg-emerald-500'
                    : intensity === 2
                    ? 'bg-emerald-400'
                    : 'bg-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800';
                return (
                  <div
                    key={d.date}
                    title={`${d.date}: ${d.saved ? formatMoney(d.amount) : 'No saving'}`}
                    className={`aspect-square rounded ${bg} ${d.date === todayStr ? 'ring-2 ring-indigo-400' : ''}`}
                  />
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2">
              Today's square is highlighted with a ring.
            </p>
          </Card>

          {/* Month KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 sm:p-4">
              <div className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Saved this month
              </div>
              <p className="text-base sm:text-xl font-black text-emerald-700 dark:text-emerald-400 truncate">
                {formatMoney(monthSavingsTotal)}
              </p>
            </Card>
            <Card className="p-3 sm:p-4">
              <div className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Days saved
              </div>
              <p className="text-base sm:text-xl font-black text-slate-900 dark:text-white truncate">
                {monthSavedDays} / {daysInMonth}
              </p>
            </Card>
            <Card className="p-3 sm:p-4">
              <div className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Daily avg
              </div>
              <p className="text-base sm:text-xl font-black text-slate-900 dark:text-white truncate">
                {formatMoney(monthSavedDays > 0 ? monthSavingsTotal / monthSavedDays : 0)}
              </p>
            </Card>
          </div>

          {/* Month navigator */}
          <Card className="p-3 flex items-center justify-between gap-2">
            <button
              onClick={() => setSelectedMonth(shiftMonth(currentSavingsMonth, -1))}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center flex-1">
              <p className="font-bold text-sm text-slate-900 dark:text-white">
                {monthLabel(currentSavingsMonth)}
              </p>
            </div>
            <button
              onClick={() => setSelectedMonth(shiftMonth(currentSavingsMonth, 1))}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </Card>

          {/* Savings entries list for selected month */}
          {monthSavingsList.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 px-1">
                Savings in {monthLabel(currentSavingsMonth)}
              </h4>
              {monthSavingsList.map((entry) => (
                <Card key={entry.id} className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                    <PiggyBank className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {formatMoney(entry.amount)}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {entry.note && <span> · {entry.note}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => onEditSavings(entry)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteSavings(entry.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 px-4 bg-white/80 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
              <PiggyBank className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No savings logged for {monthLabel(currentSavingsMonth)}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 max-w-xs mx-auto">
                Start a habit today — even ₹50 counts and keeps your streak alive.
              </p>
            </div>
          )}
        </>
      )}

      {/* ============ DEBTS VIEW ============ */}
      {mode === 'debts' && (
        <>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Debt Tracker</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Money lent or owed, with a Paid tick when settled.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={onAddDebt}>
              <Plus className="w-4 h-4" />
              Add Debt
            </Button>
          </div>

          {/* Debt KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 sm:p-4">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-xs font-semibold mb-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                Lent (out)
              </div>
              <p className="text-base sm:text-xl font-black text-slate-900 dark:text-white truncate">
                {formatMoney(outstandingLent)}
              </p>
            </Card>
            <Card className="p-3 sm:p-4">
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-[10px] sm:text-xs font-semibold mb-1">
                <ArrowDownRight className="w-3.5 h-3.5" />
                Owed (out)
              </div>
              <p className="text-base sm:text-xl font-black text-slate-900 dark:text-white truncate">
                {formatMoney(outstandingOwed)}
              </p>
            </Card>
            <Card className="p-3 sm:p-4">
              <div className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Net
              </div>
              <p
                className={`text-base sm:text-xl font-black truncate ${
                  debtNet >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatMoney(debtNet)}
              </p>
            </Card>
          </div>

          {/* Filter pills */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {(['outstanding', 'settled', 'all'] as DebtFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setDebtFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                  debtFilter === f
                    ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Debts list */}
          {filteredDebts.length > 0 ? (
            <div className="space-y-2">
              {filteredDebts.map((debt) => (
                <DebtRow
                  key={debt.id}
                  debt={debt}
                  onEdit={onEditDebt}
                  onDelete={onDeleteDebt}
                  onTogglePaid={onToggleDebtPaid}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 px-4 bg-white/80 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
              <Wallet className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {debtFilter === 'outstanding'
                  ? 'No outstanding debts'
                  : debtFilter === 'settled'
                  ? 'No settled debts yet'
                  : 'No debts tracked'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 max-w-xs mx-auto">
                {debtFilter === 'outstanding'
                  ? 'Add a debt to remember who owes you or who you owe.'
                  : 'Track money lent to friends or owed to others.'}
              </p>
              <div className="mt-4 flex justify-center">
                <Button variant="primary" size="sm" onClick={onAddDebt}>
                  <Plus className="w-4 h-4" />
                  Add Debt
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

interface TransactionRowProps {
  tx: FinanceTransaction;
  showDate?: boolean;
  accountName?: string;
  destinationName?: string;
  onEdit: (tx: FinanceTransaction) => void;
  onDelete: (id: string) => void;
}

const TransactionRow: React.FC<TransactionRowProps> = ({
  tx,
  showDate,
  accountName,
  destinationName,
  onEdit,
  onDelete,
}) => {
  const isExpense = tx.type === 'expense';
  const isTransfer = tx.type === 'transfer';
  return (
    <Card className="p-3 flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          isTransfer
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300'
            : isExpense
            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
        }`}
      >
        {isTransfer ? (
          <ArrowUpRight className="w-5 h-5" />
        ) : isExpense ? (
          <ArrowDownCircle className="w-5 h-5" />
        ) : (
          <ArrowUpCircle className="w-5 h-5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
          {isTransfer ? 'Transfer' : tx.category}
          {tx.recurrence?.type && tx.recurrence.type !== 'none' && (
            <Repeat className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
          )}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {showDate && (
            <span>
              {new Date(tx.date + 'T00:00:00').toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              })}
              {' · '}
            </span>
          )}
          {isTransfer ? (
            <span>
              {accountName || 'Unknown account'} → {destinationName || 'Unknown account'}
            </span>
          ) : (
            <>
              {tx.note && <span>{tx.note} · </span>}
              {tx.paymentMethod && isExpense && (
                <span>
                  {paymentEmoji(tx.paymentMethod)} {paymentLabel(tx.paymentMethod)}
                </span>
              )}
              {accountName && <span> · {accountName}</span>}
              {!tx.note && !(tx.paymentMethod && isExpense) && !accountName && (isExpense ? 'Expense' : 'Income')}
            </>
          )}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p
          className={`text-sm font-black ${
            isTransfer
              ? 'text-slate-600 dark:text-slate-300'
              : isExpense
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {isTransfer ? '' : isExpense ? '−' : '+'}
          {formatMoney(tx.amount)}
        </p>
        <div className="flex items-center justify-end gap-1 mt-0.5">
          <button
            onClick={() => onEdit(tx)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(tx.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
};

interface EmptyStateProps {
  message: string;
  hint: string;
  onAdd: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ message, hint, onAdd }) => {
  return (
    <div className="text-center py-12 px-4 bg-white/80 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
      <Wallet className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">{message}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 max-w-xs mx-auto">{hint}</p>
      <div className="mt-4 flex justify-center">
        <Button variant="primary" size="sm" onClick={onAdd}>
          <Plus className="w-4 h-4" />
          Add Entry
        </Button>
      </div>
    </div>
  );
};

interface DebtRowProps {
  debt: Debt;
  onEdit: (debt: Debt) => void;
  onDelete: (id: string) => void;
  onTogglePaid: (id: string) => void;
}

const DebtRow: React.FC<DebtRowProps> = ({
  debt,
  onEdit,
  onDelete,
  onTogglePaid,
}) => {
  const isLent = debt.direction === 'lent';
  return (
    <Card
      className={`p-3 flex items-center gap-3 transition-opacity ${
        debt.paid ? 'opacity-60' : ''
      }`}
    >
      <button
        onClick={() => onTogglePaid(debt.id)}
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 transition-colors ${
          debt.paid
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-300 hover:border-emerald-400'
        }`}
        title={debt.paid ? 'Mark as unpaid' : 'Mark as paid'}
      >
        <Check className="w-5 h-5" strokeWidth={3} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
          {debt.personName}
          <span
            className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
              isLent
                ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
            }`}
          >
            {isLent ? 'Lent' : 'Owed'}
          </span>
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {new Date(debt.date + 'T00:00:00').toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
          })}
          {debt.dueDate && (
            <span>
              {' · due '}
              {new Date(debt.dueDate + 'T00:00:00').toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              })}
            </span>
          )}
          {debt.note && <span> · {debt.note}</span>}
        </p>
      </div>
      <div className="text-right shrink-0 flex items-center gap-1">
        <p
          className={`text-sm font-black ${
            isLent
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          {formatMoney(debt.amount)}
        </p>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onEdit(debt)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(debt.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
};
