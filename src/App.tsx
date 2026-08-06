/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Filter, Plus, Calendar, CheckCircle2, Clock, Sparkles, Tag, ArrowUpDown, X } from 'lucide-react';
import { Task, Category, NotificationSettings, ActiveTab, Priority, User, FinanceTransaction, MonthlyBudget, CategoryBudget, Debt, SavingsGoal, BudgetAlert, BudgetAlertState, BillTemplate, BillPayment, SavingsEntry, SavingsStreakState } from './types';
import { INITIAL_CATEGORIES } from './data/initialCategories';
import { getInitialTasks } from './data/initialTasks';
import { Header } from './components/Header';
import { DateBar } from './components/DateBar';
import { TaskCard } from './components/TaskCard';
import { TaskModal } from './components/TaskModal';
import { TimelineView } from './components/TimelineView';
import { FocusRoom } from './components/FocusRoom';
import { CategoriesView } from './components/CategoriesView';
import { StatsView } from './components/StatsView';
import { FinanceView } from './components/FinanceView';
import { FinanceModal } from './components/FinanceModal';
import { DebtModal } from './components/DebtModal';
import { BillTemplateModal } from './components/BillTemplateModal';
import { SavingsModal } from './components/SavingsModal';
import { materializeRecurringTransactions } from './lib/financeRecurrence';
import { materializeBillPayments } from './lib/billMaterializer';
import { deriveStreakState } from './lib/savingsStreak';
import { checkBudgetAlerts, formatAlertMessage } from './lib/budgetAlerts';
import { DEFAULT_PAYMENT_METHOD } from './data/financeCategories';
import { NotificationBanner } from './components/NotificationBanner';
import { SettingsModal } from './components/SettingsModal';
import { BottomNav } from './components/BottomNav';
import { Sidebar } from './components/Sidebar';
import { AuthModal } from './components/AuthModal';
import { Dropdown } from './components/ui/Dropdown';
import { Toast } from './components/ui/Toast';
import { Card } from './components/ui/Card';
import { Button } from './components/ui/Button';
import { getCurrentUser } from './services/authService';
import {
  NotificationService,
  calculateNextDueDate,
} from './services/notificationService';

const DEFAULT_STORAGE_KEY_TASKS = 'daily_tasks_app_data_v1';
const DEFAULT_STORAGE_KEY_CATEGORIES = 'daily_tasks_categories_v1';
const DEFAULT_STORAGE_KEY_FINANCE = 'daily_finance_transactions_v1';
const DEFAULT_STORAGE_KEY_BUDGETS = 'daily_finance_budgets_v1';
const DEFAULT_STORAGE_KEY_CAT_BUDGETS = 'daily_finance_category_budgets_v1';
const DEFAULT_STORAGE_KEY_DEBTS = 'daily_finance_debts_v1';
const DEFAULT_STORAGE_KEY_SAVINGS = 'daily_finance_savings_goals_v1';
const DEFAULT_STORAGE_KEY_ALERT_STATE = 'daily_finance_alert_state_v1';
const DEFAULT_STORAGE_KEY_BILL_TEMPLATES = 'daily_finance_bill_templates_v1';
const DEFAULT_STORAGE_KEY_BILL_PAYMENTS = 'daily_finance_bill_payments_v1';
const DEFAULT_STORAGE_KEY_SAVINGS_ENTRIES = 'daily_finance_savings_entries_v1';
const DEFAULT_STORAGE_KEY_SAVINGS_STREAK = 'daily_finance_savings_streak_v1';
const STORAGE_KEY_SETTINGS = 'daily_tasks_settings_v1';

export default function App() {
  const todayStr = new Date().toISOString().split('T')[0];

  // User Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(() => getCurrentUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Theme State (Light / Dark Mode)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('daily_tasks_theme_v1');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {
      console.warn('Failed to parse saved theme:', e);
    }
    return 'light';
  });

  useEffect(() => {
    localStorage.setItem('daily_tasks_theme_v1', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Dynamic user-bound storage keys
  const userTasksKey = currentUser ? `daily_tasks_user_${currentUser.id}` : DEFAULT_STORAGE_KEY_TASKS;
  const userCategoriesKey = currentUser ? `daily_tasks_categories_${currentUser.id}` : DEFAULT_STORAGE_KEY_CATEGORIES;
  const userFinanceKey = currentUser ? `daily_finance_user_${currentUser.id}` : DEFAULT_STORAGE_KEY_FINANCE;
  const userBudgetsKey = currentUser ? `daily_finance_budgets_${currentUser.id}` : DEFAULT_STORAGE_KEY_BUDGETS;
  const userCatBudgetsKey = currentUser ? `daily_finance_category_budgets_${currentUser.id}` : DEFAULT_STORAGE_KEY_CAT_BUDGETS;
  const userDebtsKey = currentUser ? `daily_finance_debts_${currentUser.id}` : DEFAULT_STORAGE_KEY_DEBTS;
  const userSavingsKey = currentUser ? `daily_finance_savings_goals_${currentUser.id}` : DEFAULT_STORAGE_KEY_SAVINGS;
  const userAlertStateKey = currentUser ? `daily_finance_alert_state_${currentUser.id}` : DEFAULT_STORAGE_KEY_ALERT_STATE;
  const userBillTemplatesKey = currentUser ? `daily_finance_bill_templates_${currentUser.id}` : DEFAULT_STORAGE_KEY_BILL_TEMPLATES;
  const userBillPaymentsKey = currentUser ? `daily_finance_bill_payments_${currentUser.id}` : DEFAULT_STORAGE_KEY_BILL_PAYMENTS;
  const userSavingsEntriesKey = currentUser ? `daily_finance_savings_entries_${currentUser.id}` : DEFAULT_STORAGE_KEY_SAVINGS_ENTRIES;
  const userSavingsStreakKey = currentUser ? `daily_finance_savings_streak_${currentUser.id}` : DEFAULT_STORAGE_KEY_SAVINGS_STREAK;

  // 1. Core State
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(userTasksKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved tasks:', e);
    }
    return getInitialTasks();
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem(userCategoriesKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse categories:', e);
    }
    return INITIAL_CATEGORIES;
  });

  const [transactions, setTransactions] = useState<FinanceTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(userFinanceKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse finance transactions:', e);
    }
    return [];
  });

  const [budgets, setBudgets] = useState<MonthlyBudget[]>(() => {
    try {
      const saved = localStorage.getItem(userBudgetsKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse finance budgets:', e);
    }
    return [];
  });

  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>(() => {
    try {
      const saved = localStorage.getItem(userCatBudgetsKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse category budgets:', e);
    }
    return [];
  });

  const [debts, setDebts] = useState<Debt[]>(() => {
    try {
      const saved = localStorage.getItem(userDebtsKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse debts:', e);
    }
    return [];
  });

  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>(() => {
    try {
      const saved = localStorage.getItem(userSavingsKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse savings goals:', e);
    }
    return [];
  });

  const [budgetAlertState, setBudgetAlertState] = useState<BudgetAlertState>(() => {
    try {
      const saved = localStorage.getItem(userAlertStateKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse alert state:', e);
    }
    return {};
  });

  const [financeAlerts, setFinanceAlerts] = useState<BudgetAlert[]>([]);

  const [billTemplates, setBillTemplates] = useState<BillTemplate[]>(() => {
    try {
      const saved = localStorage.getItem(userBillTemplatesKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse bill templates:', e);
    }
    return [];
  });

  const [billPayments, setBillPayments] = useState<BillPayment[]>(() => {
    try {
      const saved = localStorage.getItem(userBillPaymentsKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse bill payments:', e);
    }
    return [];
  });

  const [savingsEntries, setSavingsEntries] = useState<SavingsEntry[]>(() => {
    try {
      const saved = localStorage.getItem(userSavingsEntriesKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse savings entries:', e);
    }
    return [];
  });

  // Streak is fully derived from entries — compute synchronously so the UI
  // never shows a stale streak after an add/edit/delete.
  const savingsStreak = useMemo<SavingsStreakState>(
    () => deriveStreakState(savingsEntries),
    [savingsEntries]
  );

  const [settings, setSettings] = useState<NotificationSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse settings:', e);
    }
    return {
      browserNotificationsEnabled: true,
      soundEnabled: true,
      speechEnabled: false,
      defaultSound: 'chime',
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '07:00',
      },
    };
  });

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [permissionStatus, setPermissionStatus] = useState<
    NotificationPermission | 'unsupported'
  >(() => NotificationService.getPermissionStatus());

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'time' | 'priority-desc' | 'priority-asc' | 'title'>('time');

  // Modals & Active Alerts
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isFinanceModalOpen, setIsFinanceModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FinanceTransaction | null>(null);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [isBillTemplateModalOpen, setIsBillTemplateModalOpen] = useState(false);
  const [editingBillTemplate, setEditingBillTemplate] = useState<BillTemplate | null>(null);
  const [isSavingsModalOpen, setIsSavingsModalOpen] = useState(false);
  const [editingSavingsEntry, setEditingSavingsEntry] = useState<SavingsEntry | null>(null);
  const [recentlyDeletedTransaction, setRecentlyDeletedTransaction] = useState<{
    tx: FinanceTransaction;
    index: number;
  } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeAlert, setActiveAlert] = useState<{ task: Task; triggeredAt: Date } | null>(null);
  const [focusTask, setFocusTask] = useState<Task | null>(null);

  // Undo toast for recently deleted tasks
  const [recentlyDeleted, setRecentlyDeleted] = useState<{ task: Task; index: number } | null>(null);

  // Reload tasks, categories & finance whenever currentUser changes
  useEffect(() => {
    try {
      const savedTasks = localStorage.getItem(userTasksKey);
      if (savedTasks) {
        setTasks(JSON.parse(savedTasks));
      } else {
        const init = getInitialTasks().map((t) => ({ ...t, userId: currentUser?.id }));
        setTasks(init);
      }

      const savedCats = localStorage.getItem(userCategoriesKey);
      if (savedCats) {
        setCategories(JSON.parse(savedCats));
      } else {
        setCategories(INITIAL_CATEGORIES);
      }

      const savedFinance = localStorage.getItem(userFinanceKey);
      const loadedFinance: FinanceTransaction[] = savedFinance
        ? JSON.parse(savedFinance)
        : [];
      // Materialize recurring transactions up to today.
      const todayStrLoad = new Date().toISOString().split('T')[0];
      const materialized = materializeRecurringTransactions(
        loadedFinance,
        todayStrLoad,
        currentUser?.id
      );
      setTransactions(materialized);

      const savedBudgets = localStorage.getItem(userBudgetsKey);
      setBudgets(savedBudgets ? JSON.parse(savedBudgets) : []);

      const savedCatBudgets = localStorage.getItem(userCatBudgetsKey);
      setCategoryBudgets(savedCatBudgets ? JSON.parse(savedCatBudgets) : []);

      const savedDebts = localStorage.getItem(userDebtsKey);
      setDebts(savedDebts ? JSON.parse(savedDebts) : []);

      const savedSavings = localStorage.getItem(userSavingsKey);
      setSavingsGoals(savedSavings ? JSON.parse(savedSavings) : []);

      const savedAlertState = localStorage.getItem(userAlertStateKey);
      setBudgetAlertState(savedAlertState ? JSON.parse(savedAlertState) : {});
      setFinanceAlerts([]);

      const savedBillTemplates = localStorage.getItem(userBillTemplatesKey);
      const loadedBillTemplates: BillTemplate[] = savedBillTemplates
        ? JSON.parse(savedBillTemplates)
        : [];
      setBillTemplates(loadedBillTemplates);

      const savedBillPayments = localStorage.getItem(userBillPaymentsKey);
      const loadedBillPayments: BillPayment[] = savedBillPayments
        ? JSON.parse(savedBillPayments)
        : [];

      // Materialize bill payments up to current month.
      const currentMonthLoad = new Date().toISOString().slice(0, 7);
      const { payments: materializedPayments } = materializeBillPayments(
        loadedBillTemplates,
        loadedBillPayments,
        currentMonthLoad,
        currentUser?.id
      );
      setBillPayments(materializedPayments);
    } catch (e) {
      console.warn('Error loading user data:', e);
    }
  }, [currentUser?.id, userTasksKey, userCategoriesKey, userFinanceKey, userBudgetsKey, userCatBudgetsKey, userDebtsKey, userSavingsKey, userAlertStateKey, userBillTemplatesKey, userBillPaymentsKey]);

  // Auto-Save Persistence
  useEffect(() => {
    localStorage.setItem(userTasksKey, JSON.stringify(tasks));
  }, [tasks, userTasksKey]);

  useEffect(() => {
    localStorage.setItem(userCategoriesKey, JSON.stringify(categories));
  }, [categories, userCategoriesKey]);

  useEffect(() => {
    localStorage.setItem(userFinanceKey, JSON.stringify(transactions));
  }, [transactions, userFinanceKey]);

  useEffect(() => {
    localStorage.setItem(userBudgetsKey, JSON.stringify(budgets));
  }, [budgets, userBudgetsKey]);

  useEffect(() => {
    localStorage.setItem(userCatBudgetsKey, JSON.stringify(categoryBudgets));
  }, [categoryBudgets, userCatBudgetsKey]);

  useEffect(() => {
    localStorage.setItem(userDebtsKey, JSON.stringify(debts));
  }, [debts, userDebtsKey]);

  useEffect(() => {
    localStorage.setItem(userSavingsKey, JSON.stringify(savingsGoals));
  }, [savingsGoals, userSavingsKey]);

  useEffect(() => {
    localStorage.setItem(userAlertStateKey, JSON.stringify(budgetAlertState));
  }, [budgetAlertState, userAlertStateKey]);

  useEffect(() => {
    localStorage.setItem(userBillTemplatesKey, JSON.stringify(billTemplates));
  }, [billTemplates, userBillTemplatesKey]);

  useEffect(() => {
    localStorage.setItem(userBillPaymentsKey, JSON.stringify(billPayments));
  }, [billPayments, userBillPaymentsKey]);

  useEffect(() => {
    localStorage.setItem(userSavingsEntriesKey, JSON.stringify(savingsEntries));
  }, [savingsEntries, userSavingsEntriesKey]);

  useEffect(() => {
    localStorage.setItem(userSavingsStreakKey, JSON.stringify(savingsStreak));
  }, [savingsStreak, userSavingsStreakKey]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }, [settings]);

  // Request Notification Permission
  const handleRequestPermission = async () => {
    const granted = await NotificationService.requestPermission();
    setPermissionStatus(NotificationService.getPermissionStatus());
    if (granted) {
      setSettings((prev) => ({ ...prev, browserNotificationsEnabled: true }));
    }
  };

  // Trigger Notification Callback
  const handleTriggerAlert = useCallback((task: Task) => {
    setActiveAlert({ task, triggeredAt: new Date() });
  }, []);

  // Recurring Reminder & Alarm Scheduler Engine
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const currentDateNum = String(now.getDate()).padStart(2, '0');
      const todayDateStr = `${currentYear}-${currentMonth}-${currentDateNum}`;
      const currentMins = now.getHours() * 60 + now.getMinutes();

      setTasks((prevTasks) =>
        prevTasks.map((t) => {
          if (t.completed || !t.reminder?.enabled || !t.time) return t;

          if (t.reminder.snoozedUntil && new Date(t.reminder.snoozedUntil) > now) {
            return t;
          }

          const [h, m] = t.time.split(':').map(Number);
          const taskMins = h * 60 + m;
          const leadTimeMins = t.reminder.remindBeforeMinutes || 0;
          const remindAtMins = taskMins - leadTimeMins;

          if (t.date === todayDateStr && currentMins >= remindAtMins && currentMins <= remindAtMins + 2) {
            const lastNotified = t.reminder.lastNotifiedAt
              ? new Date(t.reminder.lastNotifiedAt).getTime()
              : 0;
            const twoMinsAgo = now.getTime() - 120000;

            if (lastNotified < twoMinsAgo) {
              NotificationService.sendTaskNotification(t, settings, handleTriggerAlert);
              return {
                ...t,
                reminder: {
                  ...t.reminder,
                  lastNotifiedAt: now.toISOString(),
                  snoozedUntil: undefined,
                },
              };
            }
          }
          return t;
        })
      );
    };

    const timer = setInterval(checkReminders, 5000);
    return () => clearInterval(timer);
  }, [settings, handleTriggerAlert]);

  // Complete Task & Generate Next Recurring Task
  const handleToggleComplete = (taskId: string) => {
    setTasks((prev) => {
      const newTasks = [...prev];
      const targetIndex = newTasks.findIndex((t) => t.id === taskId);
      if (targetIndex === -1) return prev;

      const target = newTasks[targetIndex];
      const willBeCompleted = !target.completed;

      newTasks[targetIndex] = {
        ...target,
        completed: willBeCompleted,
        completedAt: willBeCompleted ? new Date().toISOString() : undefined,
      };

      if (willBeCompleted && target.recurrence?.type && target.recurrence.type !== 'none') {
        const nextDate = calculateNextDueDate(
          target.date,
          target.recurrence.type,
          target.recurrence.intervalDays
        );

        const exists = newTasks.some(
          (t) => t.title === target.title && t.date === nextDate
        );

        if (!exists) {
          const nextTask: Task = {
            ...target,
            id: `task-${Date.now()}`,
            userId: currentUser?.id,
            completed: false,
            completedAt: undefined,
            date: nextDate,
            reminder: {
              ...target.reminder,
              lastNotifiedAt: undefined,
              snoozedUntil: undefined,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          newTasks.push(nextTask);
        }
      }

      return newTasks;
    });
  };

  // Toggle Subtask
  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          subtasks: t.subtasks.map((s) =>
            s.id === subtaskId ? { ...s, completed: !s.completed } : s
          ),
        };
      })
    );
  };

  // Save / Add Task
  const handleSaveTask = (partial: Partial<Task>) => {
    if (partial.id) {
      setTasks((prev) =>
        prev.map((t) => (t.id === partial.id ? ({ ...t, ...partial, updatedAt: new Date().toISOString() } as Task) : t))
      );
    } else {
      const newTask: Task = {
        id: `task-${Date.now()}`,
        userId: currentUser?.id,
        title: partial.title || 'New Task',
        description: partial.description || '',
        completed: false,
        date: partial.date || selectedDate,
        time: partial.time || '09:00',
        estimatedMinutes: partial.estimatedMinutes || 30,
        priority: partial.priority || 'medium',
        category: partial.category || categories[0]?.name || 'Work',
        subtasks: partial.subtasks || [],
        recurrence: partial.recurrence || { type: 'none' },
        reminder: partial.reminder || { enabled: true, remindBeforeMinutes: 5, sound: 'chime' },
        tags: partial.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setTasks((prev) => [newTask, ...prev]);
    }
  };

  // Delete Task (with undo toast)
  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => {
      const index = prev.findIndex((t) => t.id === taskId);
      if (index === -1) return prev;
      setRecentlyDeleted({ task: prev[index], index });
      // Clear any pending finance undo toast to keep a single toast slot.
      setRecentlyDeletedTransaction(null);
      return prev.filter((t) => t.id !== taskId);
    });
  };

  // Undo the most recent deletion -- re-insert the task at its original index
  const handleUndoDelete = () => {
    if (!recentlyDeleted) return;
    setTasks((prev) => {
      const copy = [...prev];
      copy.splice(recentlyDeleted.index, 0, recentlyDeleted.task);
      return copy;
    });
    setRecentlyDeleted(null);
  };

  // Delete Category
  const handleDeleteCategory = (catId: string) => {
    const targetCat = categories.find((c) => c.id === catId);
    if (!targetCat) return;

    const remainingCats = categories.filter((c) => c.id !== catId);
    setCategories(remainingCats);

    const fallbackCat = remainingCats[0]?.name || 'General';
    setTasks((prev) =>
      prev.map((t) => (t.category === targetCat.name ? { ...t, category: fallbackCat } : t))
    );
  };

  // Snooze Task
  const handleSnoozeTask = (taskId: string, minutes: number) => {
    const snoozedUntil = new Date(Date.now() + minutes * 60000).toISOString();
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          reminder: {
            ...t.reminder,
            snoozedUntil,
          },
        };
      })
    );
    if (activeAlert?.task.id === taskId) {
      setActiveAlert(null);
    }
  };

  // Quick Add at Time from Timeline
  const handleQuickAddTaskAtTime = (timeStr: string) => {
    setEditingTask(null);
    setIsTaskModalOpen(true);
  };

  // Start Focus Session
  const handleStartFocus = (task: Task) => {
    setFocusTask(task);
    setActiveTab('focus');
  };

  // Reset Data
  const handleResetTasks = () => {
    setTasks(getInitialTasks().map((t) => ({ ...t, userId: currentUser?.id })));
    setCategories(INITIAL_CATEGORIES);
    setTransactions([]);
    setBudgets([]);
    setCategoryBudgets([]);
    setDebts([]);
    setSavingsGoals([]);
    setBudgetAlertState({});
    setFinanceAlerts([]);
    setBillTemplates([]);
    setBillPayments([]);
    setSavingsEntries([]);
    setIsSettingsOpen(false);
  };

  // Export Data
  const handleExportData = () => {
    const blob = new Blob(
      [JSON.stringify({
        tasks,
        categories,
        settings,
        transactions,
        budgets,
        categoryBudgets,
        debts,
        savingsGoals,
        billTemplates,
        billPayments,
        savingsEntries,
        savingsStreak,
        user: currentUser,
      }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-tasks-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import Data
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (parsed.tasks) setTasks(parsed.tasks);
        if (parsed.categories) setCategories(parsed.categories);
        if (parsed.settings) setSettings(parsed.settings);
        if (parsed.transactions) setTransactions(parsed.transactions);
        if (parsed.budgets) setBudgets(parsed.budgets);
        if (parsed.categoryBudgets) setCategoryBudgets(parsed.categoryBudgets);
        if (parsed.debts) setDebts(parsed.debts);
        if (parsed.savingsGoals) setSavingsGoals(parsed.savingsGoals);
        if (parsed.billTemplates) setBillTemplates(parsed.billTemplates);
        if (parsed.billPayments) setBillPayments(parsed.billPayments);
        if (parsed.savingsEntries) setSavingsEntries(parsed.savingsEntries);
        alert('Data successfully imported!');
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  };

  // Finance handlers
  const handleSaveTransaction = (partial: Partial<FinanceTransaction>) => {
    const now = new Date().toISOString();
    if (partial.id) {
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === partial.id
            ? {
                ...t,
                type: partial.type ?? t.type,
                amount: partial.amount ?? t.amount,
                category: partial.category ?? t.category,
                note: partial.note,
                date: partial.date ?? t.date,
                paymentMethod: partial.paymentMethod ?? t.paymentMethod,
                recurrence: partial.recurrence ?? t.recurrence,
                updatedAt: now,
              }
            : t
        )
      );
    } else {
      const recurrence = partial.recurrence || { type: 'none' as const };
      const newTx: FinanceTransaction = {
        id: `fin-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        userId: currentUser?.id,
        type: partial.type || 'expense',
        amount: partial.amount || 0,
        category: partial.category || 'Other',
        note: partial.note,
        date: partial.date || selectedDate,
        paymentMethod: partial.paymentMethod || DEFAULT_PAYMENT_METHOD,
        recurrence,
        recurrenceGroupId:
          recurrence.type !== 'none'
            ? `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
            : undefined,
        createdAt: now,
        updatedAt: now,
      };
      setTransactions((prev) => [newTx, ...prev]);
    }
  };

  const handleDeleteTransaction = (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;
    const isRecurring = tx.recurrence?.type && tx.recurrence.type !== 'none';
    const confirmMsg = isRecurring
      ? `Delete this entry only? The series will continue generating future entries.`
      : `Delete this transaction?`;
    if (!window.confirm(confirmMsg)) return;
    setTransactions((prev) => {
      const index = prev.findIndex((t) => t.id === id);
      if (index === -1) return prev;
      setRecentlyDeletedTransaction({ tx: prev[index], index });
      // Clear any pending task undo toast to keep a single toast slot.
      setRecentlyDeleted(null);
      return prev.filter((t) => t.id !== id);
    });
  };

  const handleUndoDeleteTransaction = () => {
    if (!recentlyDeletedTransaction) return;
    setTransactions((prev) => {
      const copy = [...prev];
      copy.splice(recentlyDeletedTransaction.index, 0, recentlyDeletedTransaction.tx);
      return copy;
    });
    setRecentlyDeletedTransaction(null);
  };

  const handleSetBudget = (month: string, limit: number) => {
    setBudgets((prev) => {
      const existing = prev.find((b) => b.month === month);
      if (existing) {
        return prev.map((b) => (b.month === month ? { ...b, limit } : b));
      }
      return [
        ...prev,
        {
          id: `budget-${month}`,
          userId: currentUser?.id,
          month,
          limit,
        },
      ];
    });
  };

  const handleSetCategoryBudget = (month: string, category: string, limit: number) => {
    setCategoryBudgets((prev) => {
      const existing = prev.find((b) => b.month === month && b.category === category);
      if (existing) {
        return prev.map((b) =>
          b.month === month && b.category === category ? { ...b, limit } : b
        );
      }
      return [
        ...prev,
        {
          id: `cbudget-${month}-${category}`,
          userId: currentUser?.id,
          month,
          category,
          limit,
        },
      ];
    });
  };

  const handleRemoveCategoryBudget = (month: string, category: string) => {
    setCategoryBudgets((prev) =>
      prev.filter((b) => !(b.month === month && b.category === category))
    );
  };

  const handleQuickAddTransaction = (amount: number, category: string) => {
    const now = new Date().toISOString();
    const newTx: FinanceTransaction = {
      id: `fin-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      userId: currentUser?.id,
      type: 'expense',
      amount,
      category,
      date: selectedDate,
      paymentMethod: DEFAULT_PAYMENT_METHOD,
      recurrence: { type: 'none' },
      createdAt: now,
      updatedAt: now,
    };
    setTransactions((prev) => [newTx, ...prev]);
  };

  const openFinanceModal = (tx?: FinanceTransaction | null) => {
    setEditingTransaction(tx || null);
    setIsFinanceModalOpen(true);
  };

  const handleQuickAdd = () => {
    if (activeTab === 'finance') {
      openFinanceModal(null);
    } else {
      setEditingTask(null);
      setIsTaskModalOpen(true);
    }
  };

  // Debt handlers
  const handleSaveDebt = (partial: Partial<Debt>) => {
    const now = new Date().toISOString();
    if (partial.id) {
      setDebts((prev) =>
        prev.map((d) =>
          d.id === partial.id
            ? {
                ...d,
                direction: partial.direction ?? d.direction,
                personName: partial.personName ?? d.personName,
                amount: partial.amount ?? d.amount,
                date: partial.date ?? d.date,
                dueDate: partial.dueDate,
                note: partial.note,
                updatedAt: now,
              }
            : d
        )
      );
    } else {
      const newDebt: Debt = {
        id: `debt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        userId: currentUser?.id,
        direction: partial.direction || 'lent',
        personName: partial.personName || 'Unknown',
        amount: partial.amount || 0,
        date: partial.date || selectedDate,
        dueDate: partial.dueDate,
        note: partial.note,
        paid: false,
        createdAt: now,
        updatedAt: now,
      };
      setDebts((prev) => [newDebt, ...prev]);
    }
  };

  const handleDeleteDebt = (id: string) => {
    const debt = debts.find((d) => d.id === id);
    if (!debt) return;
    if (!window.confirm(`Delete this debt for ${debt.personName}?`)) return;
    setDebts((prev) => prev.filter((d) => d.id !== id));
  };

  const handleToggleDebtPaid = (id: string) => {
    setDebts((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              paid: !d.paid,
              paidAt: !d.paid ? new Date().toISOString() : undefined,
              updatedAt: new Date().toISOString(),
            }
          : d
      )
    );
  };

  const openDebtModal = (debt?: Debt | null) => {
    setEditingDebt(debt || null);
    setIsDebtModalOpen(true);
  };

  // Savings goal handler
  const handleSetSavingsGoal = (month: string, target: number) => {
    setSavingsGoals((prev) => {
      const existing = prev.find((g) => g.month === month);
      if (existing) {
        return prev.map((g) => (g.month === month ? { ...g, target } : g));
      }
      return [
        ...prev,
        {
          id: `goal-${month}`,
          userId: currentUser?.id,
          month,
          target,
        },
      ];
    });
  };

  // Dismiss a finance alert
  const handleDismissAlert = (key: string) => {
    setFinanceAlerts((prev) => prev.filter((a) => a.key !== key));
  };

  // Bill handlers
  const handleSaveBillTemplate = (partial: Partial<BillTemplate>) => {
    const now = new Date().toISOString();
    if (partial.id) {
      setBillTemplates((prev) =>
        prev.map((t) =>
          t.id === partial.id
            ? {
                ...t,
                name: partial.name ?? t.name,
                amount: partial.amount ?? t.amount,
                category: partial.category ?? t.category,
                dueDayOfMonth: partial.dueDayOfMonth ?? t.dueDayOfMonth,
                paymentMethod: partial.paymentMethod ?? t.paymentMethod,
                active: partial.active ?? t.active,
                note: partial.note,
                updatedAt: now,
              }
            : t
        )
      );
    } else {
      const newTemplate: BillTemplate = {
        id: `bill-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        userId: currentUser?.id,
        name: partial.name || 'Untitled Bill',
        amount: partial.amount || 0,
        category: partial.category || 'Other',
        dueDayOfMonth: partial.dueDayOfMonth || 1,
        paymentMethod: partial.paymentMethod || DEFAULT_PAYMENT_METHOD,
        active: partial.active ?? true,
        note: partial.note,
        createdAt: now,
        updatedAt: now,
      };
      setBillTemplates((prev) => [...prev, newTemplate]);
    }
  };

  const handleDeleteBillTemplate = (id: string) => {
    const template = billTemplates.find((t) => t.id === id);
    if (!template) return;
    if (
      !window.confirm(
        `Delete bill template "${template.name}"? Future unpaid bills will be removed; paid history is kept.`
      )
    )
      return;
    setBillTemplates((prev) => prev.filter((t) => t.id !== id));
    // Remove future unpaid payments for this template; keep paid ones for history.
    setBillPayments((prev) =>
      prev.filter(
        (p) => !(p.billId === id && !p.paid)
      )
    );
  };

  const handleToggleBillPaid = (payment: BillPayment) => {
    const template = billTemplates.find((t) => t.id === payment.billId);
    if (!payment.paid) {
      // Marking as paid: create a finance transaction.
      const now = new Date().toISOString();
      const newTx: FinanceTransaction = {
        id: `fin-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        userId: currentUser?.id,
        type: 'expense',
        amount: payment.amount,
        category: template?.category || 'Other',
        note: `${template?.name || 'Bill'} payment`,
        date: payment.dueDate,
        paymentMethod: template?.paymentMethod || DEFAULT_PAYMENT_METHOD,
        recurrence: { type: 'none' },
        createdAt: now,
        updatedAt: now,
      };
      setTransactions((prev) => [newTx, ...prev]);
      setBillPayments((prev) =>
        prev.map((p) =>
          p.id === payment.id
            ? {
                ...p,
                paid: true,
                paidAt: now,
                transactionId: newTx.id,
                updatedAt: now,
              }
            : p
        )
      );
    } else {
      // Un-ticking: delete the linked transaction.
      if (payment.transactionId) {
        setTransactions((prev) => prev.filter((t) => t.id !== payment.transactionId));
      }
      setBillPayments((prev) =>
        prev.map((p) =>
          p.id === payment.id
            ? {
                ...p,
                paid: false,
                paidAt: undefined,
                transactionId: undefined,
                updatedAt: new Date().toISOString(),
              }
            : p
        )
      );
    }
  };

  const handleUpdateBillPaymentAmount = (payment: BillPayment, amount: number) => {
    setBillPayments((prev) =>
      prev.map((p) =>
        p.id === payment.id
          ? { ...p, amount, updatedAt: new Date().toISOString() }
          : p
      )
    );
    // If paid, also update the linked transaction amount.
    if (payment.paid && payment.transactionId) {
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === payment.transactionId
            ? { ...t, amount, updatedAt: new Date().toISOString() }
            : t
        )
      );
    }
  };

  const openBillTemplateModal = (template?: BillTemplate | null) => {
    setEditingBillTemplate(template || null);
    setIsBillTemplateModalOpen(true);
  };

  // ===== Savings handlers =====
  const openSavingsModal = (entry?: SavingsEntry | null) => {
    setEditingSavingsEntry(entry || null);
    setIsSavingsModalOpen(true);
  };

  const handleSaveSavingsEntry = (partial: Partial<SavingsEntry>) => {
    const now = new Date().toISOString();
    if (partial.id) {
      setSavingsEntries((prev) =>
        prev.map((e) =>
          e.id === partial.id
            ? {
                ...e,
                date: partial.date ?? e.date,
                amount: partial.amount ?? e.amount,
                note: partial.note,
                updatedAt: now,
              }
            : e
        )
      );
    } else {
      const newEntry: SavingsEntry = {
        id: `sav-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        userId: currentUser?.id,
        date: partial.date || new Date().toISOString().split('T')[0],
        amount: partial.amount || 0,
        note: partial.note,
        createdAt: now,
        updatedAt: now,
      };
      setSavingsEntries((prev) => [newEntry, ...prev]);
    }
  };

  const handleDeleteSavingsEntry = (id: string) => {
    setSavingsEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleQuickAddSavings = (amount: number) => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    const newEntry: SavingsEntry = {
      id: `sav-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      userId: currentUser?.id,
      date: today,
      amount,
      note: 'Quick add',
      createdAt: now,
      updatedAt: now,
    };
    setSavingsEntries((prev) => [newEntry, ...prev]);
  };

  // Budget alert effect: check thresholds when transactions/budgets change.
  // Only fires for the current month to avoid spamming on month navigation.
  useEffect(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { alerts, stateUpdates } = checkBudgetAlerts({
      transactions,
      budgets,
      categoryBudgets,
      alertState: budgetAlertState,
      month: currentMonth,
    });

    if (alerts.length > 0) {
      // Append new alerts (dedupe by key in case of rapid re-fires)
      setFinanceAlerts((prev) => {
        const existingKeys = new Set(prev.map((a) => a.key));
        const fresh = alerts.filter((a) => !existingKeys.has(a.key));
        return [...prev, ...fresh];
      });

      // Fire browser notifications if enabled
      if (settings.browserNotificationsEnabled) {
        for (const alert of alerts) {
          try {
            new Notification('Budget Alert', {
              body: formatAlertMessage(alert),
            });
          } catch (e) {
            console.warn('Notification failed:', e);
          }
        }
      }

      // Stamp alert state so we don't re-fire
      setBudgetAlertState((prev) => {
        const next = { ...prev };
        for (const [key, entry] of Object.entries(stateUpdates)) {
          next[key] = { ...next[key], ...entry };
        }
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, budgets, categoryBudgets]);

  // Materialize bill payments when templates change (e.g. new template added).
  useEffect(() => {
    if (billTemplates.length === 0) return;
    const currentMonth = new Date().toISOString().slice(0, 7);
    setBillPayments((prev) => {
      const { payments } = materializeBillPayments(
        billTemplates,
        prev,
        currentMonth,
        currentUser?.id
      );
      // Avoid causing an unnecessary state update if nothing changed.
      if (payments.length === prev.length) return prev;
      return payments;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billTemplates]);

  // Extract all unique tags across tasks
  const allTags = Array.from(new Set(tasks.flatMap((t) => t.tags || []).filter(Boolean)));

  // Priority Rank Mapping
  const priorityRank: Record<Priority, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  // Filter Tasks for Today / Selected Date View
  const filteredDateTasks = tasks
    .filter((t) => {
      if (t.date !== selectedDate) return false;
      if (statusFilter === 'pending' && t.completed) return false;
      if (statusFilter === 'completed' && !t.completed) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (tagFilter !== 'all' && (!t.tags || !t.tags.includes(tagFilter))) return false;
      if (
        searchQuery &&
        !t.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !t.description?.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'priority-desc') {
        return priorityRank[b.priority] - priorityRank[a.priority];
      }
      if (sortBy === 'priority-asc') {
        return priorityRank[a.priority] - priorityRank[b.priority];
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      // Default: By Time
      return (a.time || '23:59').localeCompare(b.time || '23:59');
    });

  const completedTodayCount = tasks.filter((t) => t.date === selectedDate && t.completed).length;
  const totalTodayCount = tasks.filter((t) => t.date === selectedDate).length;

  const hasActiveFilters =
    categoryFilter !== 'all' || priorityFilter !== 'all' || tagFilter !== 'all' || statusFilter !== 'all' || searchQuery !== '';

  return (
    <div className={`min-h-screen font-sans selection:bg-indigo-500 selection:text-white pb-24 lg:pb-8 transition-colors duration-200 ${
      theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-stone-50 text-slate-900'
    }`}>
      {/* App Header */}
      <Header
        notificationSettings={settings}
        permissionStatus={permissionStatus}
        currentUser={currentUser}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onRequestPermission={handleRequestPermission}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      {/* Triggered Alarm / Notification Banner */}
      <NotificationBanner
        permissionStatus={permissionStatus}
        onRequestPermission={handleRequestPermission}
        activeAlert={activeAlert}
        onDismissAlert={() => setActiveAlert(null)}
        onCompleteAlertTask={(id) => {
          handleToggleComplete(id);
          setActiveAlert(null);
        }}
        onSnoozeAlertTask={handleSnoozeTask}
      />

      {/* Date Selector Strip (shown on Today and Timeline tabs) */}
      {(activeTab === 'today' || activeTab === 'timeline') && (
        <DateBar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          tasks={tasks}
        />
      )}

      {/* Main Content Area */}
      <main className="max-w-5xl lg:max-w-6xl mx-auto px-4 py-5 lg:pl-20 lg:pr-8">
        {/* TODAY VIEW */}
        {activeTab === 'today' && (
          <div className="space-y-5">
            {/* Search, Filter & Sort Controls */}
            <Card className="p-3 space-y-2.5">
              {/* Full Width Search Bar */}
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search daily tasks..."
                  className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[40px]"
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

              {/* Scrollable Filter & Sort Pills Strip */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 pr-2 snap-x touch-pan-x">
                {/* Priority Filter */}
                <Dropdown
                  value={priorityFilter}
                  onChange={setPriorityFilter}
                  title="Filter by Priority"
                  options={[
                    { value: 'all', label: 'All Priorities' },
                    { value: 'urgent', label: '🔴 Urgent' },
                    { value: 'high', label: '🟠 High' },
                    { value: 'medium', label: '🔵 Medium' },
                    { value: 'low', label: '🟢 Low' },
                  ]}
                />

                {/* Category Filter */}
                <Dropdown
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  title="Filter by Category"
                  options={[
                    { value: 'all', label: 'All Categories' },
                    ...categories.map((c) => ({ value: c.name, label: c.name })),
                  ]}
                />

                {/* Tag Filter */}
                {allTags.length > 0 && (
                  <Dropdown
                    value={tagFilter}
                    onChange={setTagFilter}
                    title="Filter by Tag"
                    options={[
                      { value: 'all', label: 'All Tags' },
                      ...allTags.map((tag) => ({ value: tag, label: `#${tag}` })),
                    ]}
                  />
                )}

                {/* Status Filter */}
                <Dropdown
                  value={statusFilter}
                  onChange={(v) => setStatusFilter(v as any)}
                  title="Filter by Status"
                  options={[
                    { value: 'all', label: 'All Status' },
                    { value: 'pending', label: 'Pending' },
                    { value: 'completed', label: 'Completed' },
                  ]}
                />

                {/* Sort Selector */}
                <Dropdown
                  value={sortBy}
                  onChange={(v) => setSortBy(v as any)}
                  title="Sort Tasks"
                  accent="indigo"
                  options={[
                    { value: 'time', label: 'Sort by Time' },
                    { value: 'priority-desc', label: 'Priority (Urgent → Low)' },
                    { value: 'priority-asc', label: 'Priority (Low → Urgent)' },
                    { value: 'title', label: 'Title (A-Z)' },
                  ]}
                />
              </div>
            </Card>

            {/* Active Filters Bar */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Active Filters:</span>
                {categoryFilter !== 'all' && (
                  <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    Category: {categoryFilter}
                    <button onClick={() => setCategoryFilter('all')}>&times;</button>
                  </span>
                )}
                {priorityFilter !== 'all' && (
                  <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-lg flex items-center gap-1 uppercase font-bold text-[10px]">
                    Priority: {priorityFilter}
                    <button onClick={() => setPriorityFilter('all')}>&times;</button>
                  </span>
                )}
                {tagFilter !== 'all' && (
                  <span className="bg-slate-200 dark:bg-slate-800 text-teal-700 dark:text-teal-300 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    #{tagFilter}
                    <button onClick={() => setTagFilter('all')}>&times;</button>
                  </span>
                )}
                {statusFilter !== 'all' && (
                  <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    Status: {statusFilter}
                    <button onClick={() => setStatusFilter('all')}>&times;</button>
                  </span>
                )}
                <button
                  onClick={() => {
                    setCategoryFilter('all');
                    setPriorityFilter('all');
                    setTagFilter('all');
                    setStatusFilter('all');
                    setSearchQuery('');
                  }}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline text-xs ml-1"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Daily Completion Progress Banner */}
            <div className="bg-gradient-to-r from-blue-50/60 via-white to-blue-50/40 dark:from-slate-900 dark:via-indigo-950/60 dark:to-slate-900 border border-blue-200/60 dark:border-indigo-900/40 rounded-2xl p-3 sm:p-4 flex items-center justify-between shadow-sm transition-colors">
              <div className="min-w-0">
                <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-indigo-600 dark:text-indigo-400 block">
                  Daily Task Goal
                </span>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                  {completedTodayCount} of {totalTodayCount} Tasks Completed
                </h3>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-full border-4 border-indigo-500/30 flex items-center justify-center font-extrabold text-indigo-700 dark:text-indigo-300 text-xs sm:text-sm bg-white dark:bg-transparent">
                {totalTodayCount > 0
                  ? `${Math.round((completedTodayCount / totalTodayCount) * 100)}%`
                  : '0%'}
              </div>
            </div>

            {/* Tasks Stack List */}
            {filteredDateTasks.length > 0 ? (
              <div className="columns-1 md:columns-2 lg:columns-3 gap-3">
                {filteredDateTasks.map((task) => (
                  <div key={task.id} className="mb-3 break-inside-avoid">
                    <TaskCard
                      task={task}
                      categories={categories}
                      onToggleComplete={handleToggleComplete}
                      onToggleSubtask={handleToggleSubtask}
                      onEditTask={(t) => {
                        setEditingTask(t);
                        setIsTaskModalOpen(true);
                      }}
                      onDeleteTask={handleDeleteTask}
                      onSnoozeTask={handleSnoozeTask}
                      onStartFocus={handleStartFocus}
                      onSelectTagFilter={(tag) => setTagFilter(tag)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 px-4 bg-white/80 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl transition-colors">
                <CheckCircle2 className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No tasks found</h3>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 max-w-xs mx-auto">
                  {hasActiveFilters
                    ? 'No tasks match your active filter criteria. Try clearing filters.'
                    : 'Click the (+) button below to create a task or schedule a recurring reminder.'}
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  {hasActiveFilters && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setCategoryFilter('all');
                        setPriorityFilter('all');
                        setTagFilter('all');
                        setStatusFilter('all');
                        setSearchQuery('');
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setEditingTask(null);
                      setIsTaskModalOpen(true);
                    }}
                  >
                    + Add Daily Task
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TIMELINE VIEW */}
        {activeTab === 'timeline' && (
          <TimelineView
            selectedDate={selectedDate}
            tasks={tasks}
            categories={categories}
            onToggleComplete={handleToggleComplete}
            onEditTask={(t) => {
              setEditingTask(t);
              setIsTaskModalOpen(true);
            }}
            onQuickAddTaskAtTime={handleQuickAddTaskAtTime}
            onStartFocus={handleStartFocus}
          />
        )}

        {/* FOCUS TIMER ROOM VIEW */}
        {activeTab === 'focus' && (
          <FocusRoom
            tasks={tasks}
            initialActiveTask={focusTask}
            onCompleteTask={handleToggleComplete}
          />
        )}

        {/* CATEGORIES & TAGS VIEW */}
        {activeTab === 'categories' && (
          <CategoriesView
            categories={categories}
            tasks={tasks}
            onAddCategory={(cat) => setCategories([...categories, cat])}
            onDeleteCategory={handleDeleteCategory}
            onSelectCategoryFilter={(catName) => {
              setCategoryFilter(catName);
              setActiveTab('today');
            }}
            onSelectTagFilter={(tagName) => {
              setTagFilter(tagName);
              setActiveTab('today');
            }}
          />
        )}

        {/* STATS & STREAK VIEW */}
        {activeTab === 'stats' && <StatsView tasks={tasks} />}

        {/* PERSONAL FINANCE VIEW */}
        {activeTab === 'finance' && (
          <FinanceView
            transactions={transactions}
            budgets={budgets}
            categoryBudgets={categoryBudgets}
            debts={debts}
            savingsGoals={savingsGoals}
            billTemplates={billTemplates}
            billPayments={billPayments}
            financeAlerts={financeAlerts}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onAddTransaction={() => openFinanceModal(null)}
            onEditTransaction={(tx) => openFinanceModal(tx)}
            onDeleteTransaction={handleDeleteTransaction}
            onSetBudget={handleSetBudget}
            onSetCategoryBudget={handleSetCategoryBudget}
            onRemoveCategoryBudget={handleRemoveCategoryBudget}
            onQuickAdd={handleQuickAddTransaction}
            onAddDebt={() => openDebtModal(null)}
            onEditDebt={(debt) => openDebtModal(debt)}
            onDeleteDebt={handleDeleteDebt}
            onToggleDebtPaid={handleToggleDebtPaid}
            onSetSavingsGoal={handleSetSavingsGoal}
            onAddBillTemplate={() => openBillTemplateModal(null)}
            onEditBillTemplate={(template) => openBillTemplateModal(template)}
            onDeleteBillTemplate={handleDeleteBillTemplate}
            onToggleBillPaid={handleToggleBillPaid}
            onUpdateBillPaymentAmount={handleUpdateBillPaymentAmount}
            savingsEntries={savingsEntries}
            savingsStreak={savingsStreak}
            onAddSavings={() => openSavingsModal(null)}
            onEditSavings={(entry) => openSavingsModal(entry)}
            onDeleteSavings={handleDeleteSavingsEntry}
            onQuickAddSavings={handleQuickAddSavings}
            onDismissAlert={handleDismissAlert}
          />
        )}
      </main>

      {/* Desktop Sidebar Nav */}
      <Sidebar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenQuickAdd={handleQuickAdd}
      />

      {/* Bottom Mobile Nav */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenQuickAdd={handleQuickAdd}
      />

      {/* Add / Edit Task Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSaveTask={handleSaveTask}
        initialTask={editingTask}
        categories={categories}
        selectedDate={selectedDate}
      />

      {/* Add / Edit Finance Transaction Modal */}
      <FinanceModal
        isOpen={isFinanceModalOpen}
        onClose={() => {
          setIsFinanceModalOpen(false);
          setEditingTransaction(null);
        }}
        onSave={handleSaveTransaction}
        initialTransaction={editingTransaction}
        selectedDate={selectedDate}
      />

      {/* Add / Edit Debt Modal */}
      <DebtModal
        isOpen={isDebtModalOpen}
        onClose={() => {
          setIsDebtModalOpen(false);
          setEditingDebt(null);
        }}
        onSave={handleSaveDebt}
        initialDebt={editingDebt}
        selectedDate={selectedDate}
      />

      {/* Add / Edit Bill Template Modal */}
      <BillTemplateModal
        isOpen={isBillTemplateModalOpen}
        onClose={() => {
          setIsBillTemplateModalOpen(false);
          setEditingBillTemplate(null);
        }}
        onSave={handleSaveBillTemplate}
        initialTemplate={editingBillTemplate}
      />

      {/* Add / Edit Savings Entry Modal */}
      <SavingsModal
        isOpen={isSavingsModalOpen}
        onClose={() => {
          setIsSavingsModalOpen(false);
          setEditingSavingsEntry(null);
        }}
        onSave={handleSaveSavingsEntry}
        initialEntry={editingSavingsEntry}
        selectedDate={selectedDate}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onUpdateSettings={setSettings}
        onResetTasks={handleResetTasks}
        onExportData={handleExportData}
        onImportData={handleImportData}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onUserChanged={(user) => setCurrentUser(user)}
      />

      {/* Undo Toast for recently deleted tasks */}
      {recentlyDeleted && (
        <Toast
          message={`Task "${recentlyDeleted.task.title}" deleted`}
          onUndo={handleUndoDelete}
          onDismiss={() => setRecentlyDeleted(null)}
        />
      )}

      {/* Undo Toast for recently deleted finance transactions */}
      {recentlyDeletedTransaction && (
        <Toast
          message={`Transaction of ${new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
          }).format(recentlyDeletedTransaction.tx.amount)} deleted`}
          onUndo={handleUndoDeleteTransaction}
          onDismiss={() => setRecentlyDeletedTransaction(null)}
        />
      )}
    </div>
  );
}
