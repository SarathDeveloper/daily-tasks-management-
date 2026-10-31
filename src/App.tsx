/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Filter, Plus, Calendar, CheckCircle2, Clock, Sparkles, Tag, ArrowUpDown, X } from 'lucide-react';
import { Task, Category, NotificationSettings, ActiveTab, Priority, FinanceTransaction, MonthlyBudget, CategoryBudget, Debt, SavingsGoal, BudgetAlert, BudgetAlertState, BillTemplate, BillPayment, SavingsEntry, SavingsStreakState, Account, LedgerSettings, Goal, Habit, HabitCheckIn, HabitCheckInPatch, DiaryEntry, DiaryMood, Alarm } from './types';
import { INITIAL_CATEGORIES } from './data/initialCategories';
import { getInitialTasks } from './data/initialTasks';
import { Header } from './components/Header';
import { DateBar } from './components/DateBar';
import { CalendarView } from './components/CalendarView';
import { TaskCard } from './components/TaskCard';
import { TaskModal } from './components/TaskModal';
import { TimelineView } from './components/TimelineView';
import { FocusRoom } from './components/FocusRoom';
import { CategoriesView } from './components/CategoriesView';
import { StatsView } from './components/StatsView';
import { FinanceView } from './components/FinanceView';
import { FinanceModal } from './components/FinanceModal';
import { AccountModal } from './components/ledger/AccountModal';
import { TransferModal } from './components/ledger/TransferModal';
import { DebtModal } from './components/DebtModal';
import { BillTemplateModal } from './components/BillTemplateModal';
import { SavingsModal } from './components/SavingsModal';
import { HabitsView } from './components/HabitsView';
import { TodayHabitsCard } from './components/TodayHabitsCard';
import { TodayAlarmCard } from './components/TodayAlarmCard';
import { AlarmsView } from './components/AlarmsView';
import { AlarmRingOverlay } from './components/AlarmRingOverlay';
import { HabitModal } from './components/HabitModal';
import { GoalsView } from './components/GoalsView';
import { DiaryView } from './components/DiaryView';
import { DiaryEntryModal } from './components/DiaryEntryModal';
import { TodayDiaryCard } from './components/TodayDiaryCard';
import { materializeRecurringTransactions } from './lib/financeRecurrence';
import { materializeBillPayments } from './lib/billMaterializer';
import { deriveStreakState } from './lib/savingsStreak';
import {
  countedSavingsAmounts,
  isSavingsBucketType,
  resolveSavingsDestinationId,
} from './lib/savingsLedger';
import { checkBudgetAlerts, formatAlertMessage } from './lib/budgetAlerts';
import { currentTimeString, diaryCollectionFits, diaryPreview, isDiaryMood, sanitizeDiaryImages, validateDiaryDraft } from './lib/diary';
import { DEFAULT_PAYMENT_METHOD } from './data/financeCategories';
import {
  buildAtmFee,
  buildIncomeOrExpense,
  buildTransfer,
  assignAccountToTransactions,
  idsRemovedByCascade,
  removeTransactionCascade,
  resolveDefaultAccountId,
  isLedgerError,
  nowTimeString,
  todayString,
  newLedgerId,
  upsertTransactions,
  validateEntry,
  validateTransfer,
  type EntryDraft,
  type TransferDraft,
} from './lib/ledger';
import { NotificationBanner } from './components/NotificationBanner';
import { SettingsModal } from './components/SettingsModal';
import { BottomNav } from './components/BottomNav';
import { Sidebar } from './components/Sidebar';
import { InstallPrompt } from './components/InstallPrompt';
import { AppLockScreen } from './components/AppLockScreen';
import { Dropdown } from './components/ui/Dropdown';
import { Toast } from './components/ui/Toast';
import { Card } from './components/ui/Card';
import { Button } from './components/ui/Button';
import { NotificationService, calculateNextDueDate } from './services/notificationService';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import {
  cancelAllTaskReminders,
  ensureNotificationSetup,
  getNativePermissionStatus,
  registerReminderListeners,
  requestExactAlarmPermission,
  syncScheduledNotifications,
  type NotificationSetupResult,
} from './services/nativeNotificationService';
import { isNative, isNativeAndroid } from './lib/platform';
import { isAppLockEnabled } from './lib/appLock';
import { isUnlockPromptOpen, promptAppUnlock, shouldIgnoreAppPause, shouldIgnoreAppResume } from './services/appLock';
import {
  BackupError,
  buildBackup,
  backupFilename,
  isShareCancel,
  parseBackup,
  recordIds,
  saveBackupFile,
  stampImportedBackup,
  type BackupArrayKey,
  type ParsedBackup,
} from './lib/backup';
import {
  chooseBackupFolder,
  clearBackupFolder,
  isBackupCancel,
  isChoosingBackupFolder,
  readAutoBackupStatus,
  writeAutomaticBackup,
} from './lib/localBackupFolder';
import {
  DEFAULT_SETTINGS,
  getStorageKeys,
  markDeleted,
  readSyncMeta,
  requestPersistentStorage,
  unmarkDeleted,
  writeSyncMeta,
} from './lib/persistence';
import { buildReminderPlans, describeNextReminder } from './lib/reminders';
import { resolveReminderDelivery } from './lib/sounds';
import {
  alarmDueAt,
  applyAlarmRingEvent,
  applyHabitRingEvent,
  applyTaskRingEvent,
  upcomingRings,
  type RingSession,
} from './lib/alarms';
import { hasLocalMusic } from './lib/localMusic';
import { DayflowAlarm } from './services/dayflowAlarm';
import { audioService } from './services/audioService';
import { habitBlockReason, isComplete, isDueToday, isScheduledOn, isSkipped, todayDateString } from './lib/habits';
import { useCloudSync } from './hooks/useCloudSync';
import { CloudSyncSection } from './components/CloudSyncSection';
import { ReminderReliabilityCard } from './components/ReminderReliabilityCard';

const REMINDER_NOTICE_DISMISSED_KEY = 'daily_tasks_reminder_notice_dismissed_v1';

/** Skip the write while a profile switch is still loading, so the previous profile is not saved under the new keys. */
function usePersistJson(key: string, value: unknown, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value, enabled]);
}

export default function App() {
  const todayStr = new Date().toISOString().split('T')[0];

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
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0f172a' : '#ffffff');

    // Match the Android status bar icons to the active theme.
    if (isNative()) {
      void StatusBar.setStyle({
        style: theme === 'dark' ? StatusBarStyle.Dark : StatusBarStyle.Light,
      }).catch(() => {});
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // One profile on this device. Desktop and phone meet in the same Drive file.
  const storageKeys = getStorageKeys(null);
  const userTasksKey = storageKeys.tasks;
  const userCategoriesKey = storageKeys.categories;
  const userFinanceKey = storageKeys.transactions;
  const userAccountsKey = storageKeys.accounts;
  const userLedgerSettingsKey = storageKeys.ledgerSettings;
  const userBudgetsKey = storageKeys.budgets;
  const userCatBudgetsKey = storageKeys.categoryBudgets;
  const userDebtsKey = storageKeys.debts;
  const userSavingsKey = storageKeys.savingsGoals;
  const userAlertStateKey = storageKeys.alertState;
  const userBillTemplatesKey = storageKeys.billTemplates;
  const userBillPaymentsKey = storageKeys.billPayments;
  const userSavingsEntriesKey = storageKeys.savingsEntries;
  const userSavingsStreakKey = storageKeys.savingsStreak;
  const userGoalsKey = storageKeys.goals;
  const userHabitsKey = storageKeys.habits;
  const userHabitCheckInsKey = storageKeys.habitCheckIns;
  const userAlarmsKey = storageKeys.alarms;
  const userDiaryKey = storageKeys.diaryEntries;
  const STORAGE_KEY_SETTINGS = storageKeys.settings;

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

  const [accounts, setAccounts] = useState<Account[]>(() => {
    try {
      const saved = localStorage.getItem(userAccountsKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse finance accounts:', e);
    }
    return [];
  });

  const [ledgerSettings, setLedgerSettings] = useState<LedgerSettings[]>(() => {
    try {
      const saved = localStorage.getItem(userLedgerSettingsKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse ledger settings:', e);
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

  const [goals, setGoals] = useState<Goal[]>(() => {
    try {
      const saved = localStorage.getItem(userGoalsKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse goals:', e);
    }
    return [];
  });

  const [habits, setHabits] = useState<Habit[]>(() => {
    try {
      const saved = localStorage.getItem(userHabitsKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse habits:', e);
    }
    return [];
  });

  const [habitCheckIns, setHabitCheckIns] = useState<HabitCheckIn[]>(() => {
    try {
      const saved = localStorage.getItem(userHabitCheckInsKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse habit check-ins:', e);
    }
    return [];
  });
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  const [alarms, setAlarms] = useState<Alarm[]>(() => {
    try {
      const saved = localStorage.getItem(userAlarmsKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse alarms:', e);
    }
    return [];
  });
  const [ringing, setRinging] = useState<RingSession | null>(null);
  const [musicReady, setMusicReady] = useState(false);

  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(userDiaryKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse diary entries:', e);
    }
    return [];
  });
  const [isDiaryModalOpen, setIsDiaryModalOpen] = useState(false);
  const [editingDiaryEntry, setEditingDiaryEntry] = useState<DiaryEntry | null>(null);
  const [diaryDraftDate, setDiaryDraftDate] = useState(todayStr);
  const [recentlyDeletedDiary, setRecentlyDeletedDiary] = useState<{ entry: DiaryEntry; index: number } | null>(null);

  // Streak counts legacy logs plus transfers of new money into savings, gold, or stocks.
  const savingsStreak = useMemo<SavingsStreakState>(
    () => deriveStreakState(countedSavingsAmounts(savingsEntries, transactions, accounts)),
    [savingsEntries, transactions, accounts]
  );

  const [settings, setSettings] = useState<NotificationSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {
      console.warn('Failed to parse settings:', e);
    }
    return DEFAULT_SETTINGS;
  });
  const [appLocked, setAppLocked] = useState(() => isNativeAndroid() && isAppLockEnabled());
  const [lockError, setLockError] = useState('');
  const [nativeBootReady, setNativeBootReady] = useState(() => !isNativeAndroid());

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [permissionStatus, setPermissionStatus] = useState<
    NotificationPermission | 'unsupported'
  >(() => NotificationService.getPermissionStatus());

  // Native reminder state (Android only).
  const [nativeSetup, setNativeSetup] = useState<NotificationSetupResult | null>(null);
  const [reminderNoticeDismissed, setReminderNoticeDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(REMINDER_NOTICE_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  // Bumped after a cloud pull so the whole app reloads from localStorage.
  const [dataEpoch, setDataEpoch] = useState(0);
  // Bumped on any local data change so cloud sync can debounce.
  const [localRevision, setLocalRevision] = useState(0);

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
  const [financeDraftDefaults, setFinanceDraftDefaults] = useState<{
    type?: 'income' | 'expense';
    accountId?: string;
  } | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<FinanceTransaction | null>(null);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [isBillTemplateModalOpen, setIsBillTemplateModalOpen] = useState(false);
  const [editingBillTemplate, setEditingBillTemplate] = useState<BillTemplate | null>(null);
  const [isSavingsModalOpen, setIsSavingsModalOpen] = useState(false);
  const [editingSavingsEntry, setEditingSavingsEntry] = useState<SavingsEntry | null>(null);
  const [editingSavingsTransfer, setEditingSavingsTransfer] = useState<FinanceTransaction | null>(null);
  const [savingsPresetAmount, setSavingsPresetAmount] = useState<number | null>(null);
  const [recentlyDeletedTransaction, setRecentlyDeletedTransaction] = useState<{
    txs: FinanceTransaction[];
  } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [backupFolderSupported, setBackupFolderSupported] = useState(false);
  const [backupFolderName, setBackupFolderName] = useState<string | null>(null);
  const [backupLastSavedAt, setBackupLastSavedAt] = useState<string | null>(null);
  const [backupFolderError, setBackupFolderError] = useState('');
  const [activeAlert, setActiveAlert] = useState<{ task: Task; triggeredAt: Date } | null>(null);
  const [focusTask, setFocusTask] = useState<Task | null>(null);

  // Undo toast for recently deleted tasks
  const [recentlyDeleted, setRecentlyDeleted] = useState<{ task: Task; index: number } | null>(null);

  // Saves wait until stored data is in state. Writing earlier, during a cloud
  // reload, would persist the previous snapshot over the one just applied.
  const hydrationToken = String(dataEpoch);
  const [readyHydrationToken, setReadyHydrationToken] = useState(hydrationToken);
  const canPersist = readyHydrationToken === hydrationToken;

  // Reload after a cloud merge writes a new snapshot into localStorage.
  useEffect(() => {
    try {
      const savedTasks = localStorage.getItem(userTasksKey);
      if (savedTasks) {
        setTasks(JSON.parse(savedTasks));
      } else {
        setTasks(getInitialTasks());
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
      const materialized = materializeRecurringTransactions(loadedFinance, todayStrLoad);
      setTransactions(materialized);

      const savedAccounts = localStorage.getItem(userAccountsKey);
      setAccounts(savedAccounts ? JSON.parse(savedAccounts) : []);

      const savedLedgerSettings = localStorage.getItem(userLedgerSettingsKey);
      setLedgerSettings(savedLedgerSettings ? JSON.parse(savedLedgerSettings) : []);

      const savedBudgets = localStorage.getItem(userBudgetsKey);
      setBudgets(savedBudgets ? JSON.parse(savedBudgets) : []);

      const savedCatBudgets = localStorage.getItem(userCatBudgetsKey);
      setCategoryBudgets(savedCatBudgets ? JSON.parse(savedCatBudgets) : []);

      const savedDebts = localStorage.getItem(userDebtsKey);
      setDebts(savedDebts ? JSON.parse(savedDebts) : []);

      const savedSavings = localStorage.getItem(userSavingsKey);
      setSavingsGoals(savedSavings ? JSON.parse(savedSavings) : []);

      const savedSavingsEntries = localStorage.getItem(userSavingsEntriesKey);
      setSavingsEntries(savedSavingsEntries ? JSON.parse(savedSavingsEntries) : []);

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
        currentMonthLoad
      );
      setBillPayments(materializedPayments);

      const savedGoals = localStorage.getItem(userGoalsKey);
      setGoals(savedGoals ? JSON.parse(savedGoals) : []);

      const savedHabits = localStorage.getItem(userHabitsKey);
      setHabits(savedHabits ? JSON.parse(savedHabits) : []);

      const savedHabitCheckIns = localStorage.getItem(userHabitCheckInsKey);
      setHabitCheckIns(savedHabitCheckIns ? JSON.parse(savedHabitCheckIns) : []);

      const savedAlarms = localStorage.getItem(userAlarmsKey);
      setAlarms(savedAlarms ? JSON.parse(savedAlarms) : []);

      const savedDiary = localStorage.getItem(userDiaryKey);
      setDiaryEntries(savedDiary ? JSON.parse(savedDiary) : []);

      const savedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
      setSettings(
        savedSettings ? { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) } : DEFAULT_SETTINGS
      );
    } catch (e) {
      console.warn('Error loading user data:', e);
    } finally {
      setReadyHydrationToken(String(dataEpoch));
    }
  }, [dataEpoch, userTasksKey, userCategoriesKey, userFinanceKey, userAccountsKey, userLedgerSettingsKey, userBudgetsKey, userCatBudgetsKey, userDebtsKey, userSavingsKey, userSavingsEntriesKey, userAlertStateKey, userBillTemplatesKey, userBillPaymentsKey, userGoalsKey, userHabitsKey, userHabitCheckInsKey, userAlarmsKey, userDiaryKey, STORAGE_KEY_SETTINGS]);

  // Auto-Save Persistence
  usePersistJson(userTasksKey, tasks, canPersist);
  usePersistJson(userCategoriesKey, categories, canPersist);
  usePersistJson(userFinanceKey, transactions, canPersist);
  usePersistJson(userAccountsKey, accounts, canPersist);
  usePersistJson(userLedgerSettingsKey, ledgerSettings, canPersist);
  usePersistJson(userBudgetsKey, budgets, canPersist);
  usePersistJson(userCatBudgetsKey, categoryBudgets, canPersist);
  usePersistJson(userDebtsKey, debts, canPersist);
  usePersistJson(userSavingsKey, savingsGoals, canPersist);
  usePersistJson(userAlertStateKey, budgetAlertState, canPersist);
  usePersistJson(userBillTemplatesKey, billTemplates, canPersist);
  usePersistJson(userBillPaymentsKey, billPayments, canPersist);
  usePersistJson(userSavingsEntriesKey, savingsEntries, canPersist);
  usePersistJson(userGoalsKey, goals, canPersist);
  usePersistJson(userHabitsKey, habits, canPersist);
  usePersistJson(userHabitCheckInsKey, habitCheckIns, canPersist);
  usePersistJson(userAlarmsKey, alarms, canPersist);
  usePersistJson(userDiaryKey, diaryEntries, canPersist);
  usePersistJson(userSavingsStreakKey, savingsStreak, canPersist);

  useEffect(() => {
    if (!canPersist) return;
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    // Only stamp a settings edit when the serialized value actually changed
    // since the last stamp. This keeps a cloud-pulled value from being
    // re-stamped as the newest local edit (which would stop it propagating).
    const serialized = JSON.stringify(settings);
    const meta = readSyncMeta(storageKeys);
    if (meta.settingsSnapshot === serialized) return;
    writeSyncMeta(storageKeys, {
      ...meta,
      settingsUpdatedAt: new Date().toISOString(),
      settingsSnapshot: serialized,
    });
  }, [settings, STORAGE_KEY_SETTINGS, storageKeys, canPersist]);

  // Single revision counter for every piece of user data -> drives cloud sync
  // debouncing without wiring a callback into a dozen save effects.
  useEffect(() => {
    setLocalRevision((value) => value + 1);
  }, [
    tasks,
    categories,
    transactions,
    accounts,
    ledgerSettings,
    budgets,
    categoryBudgets,
    debts,
    savingsGoals,
    savingsEntries,
    billTemplates,
    billPayments,
    goals,
    habits,
    habitCheckIns,
    alarms,
    diaryEntries,
  ]);

  // Google Drive backup
  const cloudSync = useCloudSync({
    revision: localRevision,
    onDataApplied: () => setDataEpoch((value) => value + 1),
  });

  // Request Notification Permission
  const handleRequestPermission = async () => {
    if (isNativeAndroid()) {
      const result = await ensureNotificationSetup();
      setNativeSetup(result);
      setPermissionStatus(result.granted ? 'granted' : 'denied');
      if (result.granted) {
        setSettings((prev) => ({ ...prev, browserNotificationsEnabled: true }));
      }
      return;
    }
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

  const handleOpenExactAlarmSettings = useCallback(() => {
    void requestExactAlarmPermission();
  }, []);

  const dismissReminderNotice = useCallback(() => {
    try {
      localStorage.setItem(REMINDER_NOTICE_DISMISSED_KEY, '1');
    } catch {
      // ignore storage failures
    }
    setReminderNoticeDismissed(true);
  }, []);

  // Keep refs to the latest values so native listeners never capture stale data.
  const tasksRef = useRef<Task[]>(tasks);
  tasksRef.current = tasks;
  const settingsRef = useRef<NotificationSettings>(settings);
  settingsRef.current = settings;
  const habitsRef = useRef<Habit[]>(habits);
  habitsRef.current = habits;
  const habitCheckInsRef = useRef<HabitCheckIn[]>(habitCheckIns);
  habitCheckInsRef.current = habitCheckIns;
  const goalsRef = useRef<Goal[]>(goals);
  goalsRef.current = goals;
  const alarmsRef = useRef<Alarm[]>(alarms);
  alarmsRef.current = alarms;
  const writeLeaveBackupRef = useRef<() => void>(() => {});
  const musicReadyRef = useRef(musicReady);
  musicReadyRef.current = musicReady;
  const ringingRef = useRef<RingSession | null>(ringing);
  ringingRef.current = ringing;
  const nativeBootReadyRef = useRef(nativeBootReady);
  nativeBootReadyRef.current = nativeBootReady;

  const unlockApp = useCallback(async () => {
    if (!isNativeAndroid() || isUnlockPromptOpen()) return;
    if (!isAppLockEnabled()) {
      setAppLocked(false);
      setLockError('');
      return;
    }
    const result = await promptAppUnlock();
    if (result.ok) {
      setAppLocked(false);
      setLockError('');
    } else {
      setAppLocked(true);
      setLockError(result.canceled ? '' : result.message);
    }
  }, []);
  const unlockAppRef = useRef(unlockApp);
  unlockAppRef.current = unlockApp;

  // ---------------------------------------------------------------------
  // Reminders
  // ---------------------------------------------------------------------
  // Native (Android): everything is a real AlarmManager entry, so it fires with
  // the app closed. The browser polling loop below only runs on the web build.
  useEffect(() => {
    if (!isNativeAndroid()) return;

    let removeListeners: (() => void) | undefined;
    let cancelled = false;

    const boot = async () => {
      try {
        // Hide the splash first: the notification permission dialog would
        // otherwise appear on top of a blank splash screen with no context.
        await SplashScreen.hide().catch(() => {});

        const result = await ensureNotificationSetup();
        if (cancelled) return;
        setNativeSetup(result);
        setPermissionStatus(result.granted ? 'granted' : 'denied');

        removeListeners = await registerReminderListeners({
          onDue: (taskId) => {
            if (taskId.startsWith('habit:')) {
              setActiveTab('habits');
              return;
            }
            const task = tasksRef.current.find((t) => t.id === taskId);
            if (task) setActiveAlert({ task, triggeredAt: new Date() });
          },
          onOpened: (taskId) => {
            if (taskId.startsWith('habit:')) {
              setActiveTab('habits');
              return;
            }
            const task = tasksRef.current.find((t) => t.id === taskId);
            if (!task) return;
            setSelectedDate(task.date);
            setActiveTab('today');
            setActiveAlert({ task, triggeredAt: new Date() });
          },
        });
      } catch (e) {
        console.warn('Native reminder setup failed:', e);
      } finally {
        if (!cancelled) setNativeBootReady(true);
      }
    };

    void boot();

    return () => {
      cancelled = true;
      removeListeners?.();
    };
    // Boot once per app launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const promptedAfterBoot = useRef(false);
  useEffect(() => {
    if (!nativeBootReady || promptedAfterBoot.current) return;
    promptedAfterBoot.current = true;
    if (isNativeAndroid() && isAppLockEnabled()) void unlockApp();
  }, [nativeBootReady, unlockApp]);

  useEffect(() => {
    let cancelled = false;
    void hasLocalMusic().then((ready) => {
      if (!cancelled) setMusicReady(ready);
    });
    return () => {
      cancelled = true;
    };
  }, [settings.localMusicName]);

  const pushNativeSchedule = useCallback((granted: boolean) => {
    if (!isNativeAndroid()) return;
    const ready = musicReadyRef.current;
    if (granted) {
      void syncScheduledNotifications(
        tasksRef.current,
        settingsRef.current,
        { granted: true },
        habitsRef.current,
        habitCheckInsRef.current,
        goalsRef.current,
        ready
      );
    }
    const plans = buildReminderPlans(
      tasksRef.current,
      settingsRef.current,
      new Date(),
      habitsRef.current,
      habitCheckInsRef.current,
      goalsRef.current,
      ready
    );
    void DayflowAlarm.sync({ plans: upcomingRings(plans, alarmsRef.current, new Date()) }).catch((e) => {
      console.warn('Failed to sync ringing alarms:', e);
    });
  }, []);

  // Reconcile the phone's alarms whenever tasks or reminder settings change.
  useEffect(() => {
    if (!isNativeAndroid()) return;
    const timer = setTimeout(() => {
      pushNativeSchedule(Boolean(nativeSetup?.granted));
    }, 600);
    return () => clearTimeout(timer);
  }, [tasks, settings, habits, habitCheckIns, goals, alarms, musicReady, nativeSetup?.granted, pushNativeSchedule]);

  writeLeaveBackupRef.current = () => {
    const file = buildBackup({
      tasks,
      categories,
      transactions,
      accounts,
      ledgerSettings,
      budgets,
      categoryBudgets,
      debts,
      savingsGoals,
      savingsEntries,
      goals,
      habits,
      habitCheckIns,
      alarms,
      diaryEntries,
      billTemplates,
      billPayments,
      settings,
      theme,
      budgetAlertState,
    });
    void writeAutomaticBackup(file).then((result) => {
      if (result === 'saved') {
        setBackupLastSavedAt(new Date().toISOString());
        return;
      }
      if (result === 'lost') {
        setBackupFolderName(null);
        setBackupLastSavedAt(null);
        setBackupFolderError('Choose the folder again.');
      }
    });
  };

  useEffect(() => {
    void readAutoBackupStatus().then((status) => {
      setBackupFolderSupported(status.supported);
      setBackupFolderName(status.name);
      setBackupLastSavedAt(status.lastSavedAt);
      if (status.lost) setBackupFolderError('Choose the folder again.');
    });
  }, []);

  useEffect(() => {
    if (!isSettingsOpen) return;
    void readAutoBackupStatus().then((status) => {
      setBackupFolderSupported(status.supported);
      setBackupFolderName(status.name);
      setBackupLastSavedAt(status.lastSavedAt);
      if (status.lost) setBackupFolderError('Choose the folder again.');
    });
  }, [isSettingsOpen]);

  useEffect(() => {
    if (isNative()) return;
    const onHide = () => {
      if (document.visibilityState === 'hidden' && !isChoosingBackupFolder()) {
        writeLeaveBackupRef.current();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  // Coming back to the foreground: re-check permissions and reschedule, since
  // Android drops alarms scheduled while exact-alarm access was revoked.
  // Registered once; current settings are read through a ref.
  useEffect(() => {
    if (!isNativeAndroid()) return;
    let remove: (() => void) | undefined;
    void CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        if (shouldIgnoreAppPause() || isChoosingBackupFolder()) return;
        writeLeaveBackupRef.current();
        if (isAppLockEnabled()) {
          setAppLocked(true);
          setLockError('');
        }
        return;
      }
      if (
        !isChoosingBackupFolder() &&
        !shouldIgnoreAppResume() &&
        nativeBootReadyRef.current &&
        isAppLockEnabled()
      ) {
        setAppLocked(true);
        void unlockAppRef.current();
      }
      void (async () => {
        const status = await getNativePermissionStatus();
        const granted = status === 'granted';
        setPermissionStatus(granted ? 'granted' : 'denied');
        setNativeSetup((prev) => (prev ? { ...prev, granted } : prev));
        pushNativeSchedule(granted);
        try {
          const { events } = await DayflowAlarm.consumeEvents();
          for (const event of events ?? []) {
            if (event.kind === 'task') setTasks((prev) => applyTaskRingEvent(prev, event));
            else if (event.kind === 'habit') setHabits((prev) => applyHabitRingEvent(prev, event));
            else setAlarms((prev) => applyAlarmRingEvent(prev, event));
          }
        } catch (e) {
          console.warn('Could not read alarm events:', e);
        }
      })();
    }).then((handle) => {
      remove = () => {
        try {
          handle.remove();
        } catch {
          // already detached
        }
      };
    });
    return () => remove?.();
  }, []);

  useEffect(() => {
    if (!isNativeAndroid()) return;
    let remove = () => {};
    const applyQueued = async () => {
      try {
        const { events } = await DayflowAlarm.consumeEvents();
        for (const event of events ?? []) {
          if (event.kind === 'task') setTasks((prev) => applyTaskRingEvent(prev, event));
          else if (event.kind === 'habit') setHabits((prev) => applyHabitRingEvent(prev, event));
          else setAlarms((prev) => applyAlarmRingEvent(prev, event));
        }
      } catch (e) {
        console.warn('Could not read alarm events:', e);
      }
    };
    void applyQueued();
    void DayflowAlarm.addListener('alarmEvent', () => {
      void applyQueued();
    }).then((handle) => {
      remove = () => {
        try {
          handle.remove();
        } catch {
          // already detached
        }
      };
    });
    return () => remove();
  }, []);

  // Web / PWA fallback: the original in-page poller, still useful in a tab.
  useEffect(() => {
    if (isNative()) return;

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
              const delivery = resolveReminderDelivery(
                t.reminder.sound,
                t.reminder.alarm,
                musicReadyRef.current,
                settings.defaultSound
              );
              if (delivery.ring) {
                if (ringingRef.current?.id !== t.id) {
                  setRinging({
                    id: t.id,
                    kind: 'task',
                    title: t.title,
                    body: t.time || '',
                    sound: delivery.sound,
                    snoozeMinutes: 10,
                  });
                }
                return t;
              }
              void NotificationService.sendTaskNotification(t, settings, handleTriggerAlert);
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

      setHabits((prev) => {
        let changed = false;
        const next = prev.map((habit) => {
          if (!habit.reminder?.enabled || !habit.reminder.time) return habit;
          if (habitBlockReason(habit, goalsRef.current)) return habit;
          if (!isScheduledOn(habit, todayDateStr)) return habit;
          if (!isDueToday(habit, todayDateStr, goalsRef.current, habitCheckInsRef.current)) return habit;
          const entry = habitCheckInsRef.current.find(
            (item) => item.habitId === habit.id && item.date === todayDateStr
          );
          if (isComplete(habit, entry) || isSkipped(entry)) return habit;

          if (habit.reminder.snoozedUntil && new Date(habit.reminder.snoozedUntil) > now) return habit;

          const [hours, minutes] = habit.reminder.time.split(':').map(Number);
          if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return habit;
          const remindAtMins = hours * 60 + minutes;
          const snoozeAt = habit.reminder.snoozedUntil ? new Date(habit.reminder.snoozedUntil) : null;
          const snoozeDue = Boolean(
            snoozeAt && snoozeAt <= now && now.getTime() - snoozeAt.getTime() <= 120000
          );
          const timeDue = currentMins >= remindAtMins && currentMins <= remindAtMins + 2;
          if (!snoozeDue && !timeDue) return habit;

          const lastNotified = habit.reminder.lastNotifiedAt
            ? new Date(habit.reminder.lastNotifiedAt).getTime()
            : 0;
          if (lastNotified >= now.getTime() - 120000) return habit;

          const occurrenceId = `habit:${habit.id}:${todayDateStr}`;
          const delivery = resolveReminderDelivery(
            habit.reminder.sound,
            habit.reminder.alarm,
            musicReadyRef.current,
            settings.defaultSound
          );
          if (delivery.ring) {
            if (ringingRef.current?.id !== occurrenceId) {
              setRinging({
                id: occurrenceId,
                kind: 'habit',
                title: habit.title,
                body: habit.reminder.time,
                sound: delivery.sound,
                snoozeMinutes: 10,
              });
            }
            return habit;
          }

          void NotificationService.sendSimpleNotification(
            `Habit: ${habit.title}`,
            habit.reminder.time,
            habit.reminder.sound,
            `habit-${habit.id}`,
            settings
          );
          changed = true;
          return {
            ...habit,
            reminder: { ...habit.reminder, lastNotifiedAt: now.toISOString() },
            updatedAt: now.toISOString(),
          };
        });
        return changed ? next : prev;
      });

      for (const alarm of alarmsRef.current) {
        const due = alarmDueAt(alarm, now);
        if (!due) continue;
        if (ringingRef.current?.id === alarm.id) break;
        const delivery = resolveReminderDelivery(alarm.sound, true, musicReadyRef.current, settings.defaultSound);
        setRinging({
          id: alarm.id,
          kind: 'alarm',
          title: alarm.label || 'Alarm',
          body: alarm.time,
          sound: delivery.sound,
          snoozeMinutes: alarm.snoozeMinutes || 10,
        });
        break;
      }
    };

    const timer = setInterval(checkReminders, 5000);
    return () => clearInterval(timer);
  }, [settings, handleTriggerAlert]);

  // Ask the WebView to keep this origin's data on disk (best effort).
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  const closeHabitModalRef = useRef<(() => void) | null>(null);
  const closeGoalModalRef = useRef<(() => void) | null>(null);
  const closeDiaryModalRef = useRef<(() => void) | null>(null);
  const registerHabitClose = useCallback((close: (() => void) | null) => {
    closeHabitModalRef.current = close;
  }, []);
  const registerGoalClose = useCallback((close: (() => void) | null) => {
    closeGoalModalRef.current = close;
  }, []);
  const registerDiaryClose = useCallback((close: (() => void) | null) => {
    closeDiaryModalRef.current = close;
  }, []);

  useEffect(() => {
    if (!isDiaryModalOpen) return;
    registerDiaryClose(() => {
      setIsDiaryModalOpen(false);
      setEditingDiaryEntry(null);
    });
    return () => registerDiaryClose(null);
  }, [isDiaryModalOpen, registerDiaryClose]);

  const finishRing = (type: 'dismiss' | 'snooze') => {
    const current = ringingRef.current;
    if (!current) return;
    const event = {
      type,
      id: current.id,
      kind: current.kind,
      at: Date.now(),
      snoozeMinutes: current.snoozeMinutes,
    };
    if (current.kind === 'task') setTasks((prev) => applyTaskRingEvent(prev, event));
    else if (current.kind === 'habit') setHabits((prev) => applyHabitRingEvent(prev, event));
    else setAlarms((prev) => applyAlarmRingEvent(prev, event));
    setRinging(null);
    audioService.stopLoop();
  };

  const handleSaveAlarm = (partial: Partial<Alarm>) => {
    const now = new Date().toISOString();
    if (partial.id) {
      setAlarms((prev) =>
        prev.map((alarm) =>
          alarm.id === partial.id
            ? {
                ...alarm,
                ...partial,
                label: partial.label?.trim() || alarm.label,
                daysOfWeek: partial.daysOfWeek ?? alarm.daysOfWeek,
                updatedAt: now,
              }
            : alarm
        )
      );
      return;
    }
    const created: Alarm = {
      id: newLedgerId('alarm'),
      label: partial.label?.trim() || 'Alarm',
      time: partial.time || '07:00',
      enabled: partial.enabled ?? true,
      daysOfWeek: partial.daysOfWeek ?? [],
      sound: partial.sound || 'chime',
      snoozeMinutes: partial.snoozeMinutes || 10,
      createdAt: now,
      updatedAt: now,
    };
    setAlarms((prev) => [created, ...prev]);
  };

  const handleDeleteAlarm = (id: string) => {
    markDeleted(storageKeys, [id]);
    setAlarms((prev) => prev.filter((alarm) => alarm.id !== id));
  };

  // Android hardware back: close whatever is open instead of killing the app.
  // The handler body is recreated every render and reached through a ref so the
  // native listener is registered exactly once (re-registering on every modal
  // change leaked listeners and made one back press fire several handlers).
  const backHandlerRef = useRef<() => void>(() => {});
  backHandlerRef.current = () => {
    if (ringing) {
      finishRing('dismiss');
      return;
    }
    if (closeDiaryModalRef.current) {
      const close = closeDiaryModalRef.current;
      closeDiaryModalRef.current = null;
      close();
      return;
    }
    if (editingHabit) {
      setEditingHabit(null);
      return;
    }
    if (closeHabitModalRef.current) {
      const close = closeHabitModalRef.current;
      closeHabitModalRef.current = null;
      close();
      return;
    }
    if (closeGoalModalRef.current) {
      const close = closeGoalModalRef.current;
      closeGoalModalRef.current = null;
      close();
      return;
    }
    if (isTaskModalOpen) {
      setIsTaskModalOpen(false);
      setEditingTask(null);
      return;
    }
    if (isFinanceModalOpen) {
      setIsFinanceModalOpen(false);
      setEditingTransaction(null);
      return;
    }
    if (isDebtModalOpen) {
      setIsDebtModalOpen(false);
      setEditingDebt(null);
      return;
    }
    if (isBillTemplateModalOpen) {
      setIsBillTemplateModalOpen(false);
      setEditingBillTemplate(null);
      return;
    }
    if (isSavingsModalOpen) {
      setIsSavingsModalOpen(false);
      setEditingSavingsEntry(null);
      setEditingSavingsTransfer(null);
      setSavingsPresetAmount(null);
      return;
    }
    if (isSettingsOpen) {
      setIsSettingsOpen(false);
      return;
    }
    if (activeAlert) {
      setActiveAlert(null);
      return;
    }
    if (activeTab !== 'today') {
      setActiveTab('today');
      return;
    }
    // At the root screen: behave like a normal Android app and background it.
    void CapApp.minimizeApp();
  };

  useEffect(() => {
    if (!isNative()) return;
    let remove: (() => void) | undefined;

    void CapApp.addListener('backButton', () => backHandlerRef.current()).then((handle) => {
      remove = () => {
        try {
          handle.remove();
        } catch {
          // already detached
        }
      };
    });

    return () => remove?.();
  }, []);

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
    markDeleted(storageKeys, [taskId]);
    setTasks((prev) => {
      const index = prev.findIndex((t) => t.id === taskId);
      if (index === -1) return prev;
      setRecentlyDeleted({ task: prev[index], index });
      // Clear any pending undo toast to keep a single toast slot.
      setRecentlyDeletedTransaction(null);
      setRecentlyDeletedDiary(null);
      return prev.filter((t) => t.id !== taskId);
    });
  };

  // Undo the most recent deletion -- re-insert the task at its original index
  const handleUndoDelete = () => {
    if (!recentlyDeleted) return;
    unmarkDeleted(storageKeys, [recentlyDeleted.task.id]);
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

    markDeleted(storageKeys, [catId]);
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
    // Tombstone everything that is about to disappear so a cloud merge on
    // another device does not bring it back.
    markDeleted(storageKeys, [
      ...tasks.map((t) => t.id),
      ...categories.map((c) => c.id),
      ...transactions.map((t) => t.id),
      ...accounts.map((a) => a.id),
      ...ledgerSettings.map((s) => s.id),
      ...budgets.map((b) => b.id),
      ...categoryBudgets.map((b) => b.id),
      ...debts.map((d) => d.id),
      ...savingsGoals.map((g) => g.id),
      ...savingsEntries.map((e) => e.id),
      ...billTemplates.map((b) => b.id),
      ...billPayments.map((p) => p.id),
      ...goals.map((g) => g.id),
      ...habits.map((h) => h.id),
      ...habitCheckIns.map((c) => c.id),
      ...diaryEntries.map((entry) => entry.id),
    ]);
    if (isNativeAndroid()) void cancelAllTaskReminders();
    const freshTasks = getInitialTasks();
    setTasks(freshTasks);
    setCategories(INITIAL_CATEGORIES);
    // The sample data is (re)created here, so clear any tombstones it inherits.
    unmarkDeleted(storageKeys, [
      ...freshTasks.map((t) => t.id),
      ...INITIAL_CATEGORIES.map((c) => c.id),
    ]);
    setTransactions([]);
    setAccounts([]);
    setLedgerSettings([]);
    setBudgets([]);
    setCategoryBudgets([]);
    setDebts([]);
    setSavingsGoals([]);
    setBudgetAlertState({});
    setFinanceAlerts([]);
    setBillTemplates([]);
    setBillPayments([]);
    setSavingsEntries([]);
    setGoals([]);
    setHabits([]);
    setHabitCheckIns([]);
    setAlarms([]);
    setDiaryEntries([]);
    setRecentlyDeletedDiary(null);
    setIsSettingsOpen(false);
  };

  const applyImportedBackup = (parsed: ParsedBackup) => {
    const stamped = stampImportedBackup(parsed);
    const current: Record<BackupArrayKey, unknown> = {
      tasks,
      categories,
      transactions,
      accounts,
      ledgerSettings,
      budgets,
      categoryBudgets,
      debts,
      savingsGoals,
      savingsEntries,
      goals,
      habits,
      habitCheckIns,
      alarms,
      diaryEntries,
      billTemplates,
      billPayments,
    };

    // Tombstone only records removed from collections this file actually replaces.
    const removed: string[] = [];
    const imported: string[] = [];
    for (const key of stamped.present) {
      if (key === 'settings') continue;
      const nextIds = new Set(recordIds(stamped.data[key]));
      for (const id of recordIds(current[key])) {
        if (!nextIds.has(id)) removed.push(id);
      }
      for (const id of nextIds) imported.push(id);
    }
    markDeleted(storageKeys, removed);
    unmarkDeleted(storageKeys, Array.from(new Set(imported)));

    const { data, present } = stamped;
    if (present.includes('tasks')) setTasks(data.tasks ?? []);
    if (present.includes('categories')) setCategories(data.categories ?? []);
    if (present.includes('transactions')) setTransactions(data.transactions ?? []);
    if (present.includes('accounts')) setAccounts(data.accounts ?? []);
    if (present.includes('ledgerSettings')) setLedgerSettings(data.ledgerSettings ?? []);
    if (present.includes('budgets')) setBudgets(data.budgets ?? []);
    if (present.includes('categoryBudgets')) setCategoryBudgets(data.categoryBudgets ?? []);
    if (present.includes('debts')) setDebts(data.debts ?? []);
    if (present.includes('savingsGoals')) setSavingsGoals(data.savingsGoals ?? []);
    if (present.includes('savingsEntries')) setSavingsEntries(data.savingsEntries ?? []);
    if (present.includes('goals')) setGoals(data.goals ?? []);
    if (present.includes('habits')) setHabits(data.habits ?? []);
    if (present.includes('habitCheckIns')) setHabitCheckIns(data.habitCheckIns ?? []);
    if (present.includes('alarms')) setAlarms(data.alarms ?? []);
    if (present.includes('diaryEntries')) {
      setDiaryEntries(data.diaryEntries ?? []);
      setRecentlyDeletedDiary(null);
    }
    if (present.includes('billTemplates')) setBillTemplates(data.billTemplates ?? []);
    if (present.includes('billPayments')) setBillPayments(data.billPayments ?? []);
    if (present.includes('settings') && data.settings) setSettings(data.settings);
    if (stamped.theme) setTheme(stamped.theme);
    if (stamped.budgetAlertState) setBudgetAlertState(stamped.budgetAlertState);
  };

  const handleChooseBackupFolder = () => {
    void chooseBackupFolder()
      .then((folder) => {
        setBackupFolderName(folder.name);
        setBackupFolderSupported(true);
        setBackupFolderError('');
      })
      .catch((error) => {
        if (isBackupCancel(error)) return;
        setBackupFolderError('Could not use that folder.');
      });
  };

  const handleStopBackupFolder = () => {
    void clearBackupFolder().then(() => {
      setBackupFolderName(null);
      setBackupLastSavedAt(null);
      setBackupFolderError('');
    });
  };

  const handleExportData = () => {
    const backup = buildBackup({
      tasks,
      categories,
      transactions,
      accounts,
      ledgerSettings,
      budgets,
      categoryBudgets,
      debts,
      savingsGoals,
      savingsEntries,
      goals,
      habits,
      habitCheckIns,
      alarms,
      diaryEntries,
      billTemplates,
      billPayments,
      settings,
      theme,
      budgetAlertState,
    });
    const contents = JSON.stringify(backup, null, 2);
    const filename = backupFilename();
    const save = isNativeAndroid()
      ? DayflowAlarm.shareBackup({ filename, contents })
      : saveBackupFile(contents, filename);
    void save.catch((err) => {
      if (isShareCancel(err)) return;
      console.warn('Backup export failed:', err);
      alert('Could not save the backup.');
    });
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '').replace(/^\uFEFF/, '');
        const parsed = parseBackup(JSON.parse(text));
        const confirmed = window.confirm(
          'Replace the data on this device with this backup? Tasks, diary, habits, goals, money, and alarms in the file will overwrite what is on this device.'
        );
        if (!confirmed) return;
        applyImportedBackup(parsed);
        alert('Backup imported.');
      } catch (err) {
        alert(err instanceof BackupError ? err.message : 'This file is not a Dayflow backup.');
      }
    };
    reader.onerror = () => {
      alert('Could not read that file.');
    };
    reader.readAsText(file);
  };

  // Goals and habits
  const handleSaveGoal = (partial: Partial<Goal>) => {
    const now = new Date().toISOString();
    if (partial.id) {
      setGoals((prev) =>
        prev.map((goal) =>
          goal.id === partial.id
            ? {
                ...goal,
                title: partial.title?.trim() || goal.title,
                note: partial.note?.trim() || undefined,
                startDate: partial.startDate || goal.startDate,
                targetDate: partial.targetDate || goal.targetDate,
                status: partial.status || goal.status,
                updatedAt: now,
              }
            : goal
        )
      );
      return;
    }

    const created: Goal = {
      id: newLedgerId('goal'),
      title: partial.title?.trim() || 'New goal',
      note: partial.note?.trim() || undefined,
      startDate: partial.startDate || todayStr,
      targetDate: partial.targetDate || todayStr,
      status: partial.status || 'active',
      createdAt: now,
      updatedAt: now,
    };
    setGoals((prev) => [created, ...prev]);
  };

  const handleDeleteGoal = (id: string) => {
    markDeleted(storageKeys, [id]);
    const now = new Date().toISOString();
    setGoals((prev) => prev.filter((goal) => goal.id !== id));
    setHabits((prev) =>
      prev.map((habit) =>
        habit.goalId === id ? { ...habit, goalId: undefined, updatedAt: now } : habit
      )
    );
  };

  const handleSaveHabit = (partial: Partial<Habit>) => {
    const now = new Date().toISOString();
    const reminder = partial.reminder?.enabled
      ? {
          enabled: true as const,
          time: partial.reminder.time || '08:00',
          sound: partial.reminder.sound,
          alarm: partial.reminder.alarm || undefined,
          lastNotifiedAt: partial.reminder.lastNotifiedAt,
          snoozedUntil: partial.reminder.snoozedUntil,
        }
      : undefined;
    const targetCount = partial.targetCount && partial.targetCount > 1 ? partial.targetCount : undefined;
    if (partial.id) {
      setHabits((prev) =>
        prev.map((habit) =>
          habit.id === partial.id
            ? {
                ...habit,
                title: partial.title?.trim() || habit.title,
                goalId: partial.goalId || undefined,
                schedule: partial.schedule || habit.schedule,
                archived: partial.archived ?? habit.archived,
                color: partial.color === undefined ? habit.color : partial.color,
                icon: partial.icon === undefined ? habit.icon : partial.icon,
                targetCount,
                unit: targetCount ? partial.unit?.trim() || undefined : undefined,
                reminder: reminder
                  ? {
                      ...reminder,
                      lastNotifiedAt: habit.reminder?.lastNotifiedAt,
                      snoozedUntil: habit.reminder?.snoozedUntil,
                    }
                  : undefined,
                updatedAt: now,
              }
            : habit
        )
      );
      return;
    }

    const created: Habit = {
      id: newLedgerId('habit'),
      title: partial.title?.trim() || 'New habit',
      goalId: partial.goalId || undefined,
      schedule: partial.schedule || { type: 'daily' },
      archived: partial.archived ?? false,
      color: partial.color,
      icon: partial.icon,
      targetCount,
      unit: targetCount ? partial.unit?.trim() || undefined : undefined,
      reminder,
      createdAt: now,
      updatedAt: now,
    };
    setHabits((prev) => [created, ...prev]);
  };

  const handleDeleteHabit = (id: string) => {
    const removedChecks = habitCheckIns.filter((entry) => entry.habitId === id).map((entry) => entry.id);
    markDeleted(storageKeys, [id, ...removedChecks]);
    setHabits((prev) => prev.filter((habit) => habit.id !== id));
    setHabitCheckIns((prev) => prev.filter((entry) => entry.habitId !== id));
  };

  const openDiaryComposer = (date: string, entry: DiaryEntry | null = null) => {
    setEditingDiaryEntry(entry);
    setDiaryDraftDate(entry?.date || date);
    setIsDiaryModalOpen(true);
  };

  const handleSaveDiaryEntry = (partial: Partial<DiaryEntry>): boolean => {
    const mood = partial.mood && isDiaryMood(partial.mood) ? partial.mood : 'okay';
    const images = sanitizeDiaryImages(partial.images);
    const draft = {
      date: partial.date || selectedDate,
      time: partial.time || currentTimeString(),
      mood,
      body: partial.body || '',
      imageCount: images.length,
    };
    const error = validateDiaryDraft(draft);
    if (error) {
      window.alert(error);
      return false;
    }
    const now = new Date().toISOString();
    const savedMood = draft.mood as DiaryMood;
    const savedImages = images.length > 0 ? images : undefined;
    const next = partial.id
      ? diaryEntries.map((entry) =>
          entry.id === partial.id
            ? {
                ...entry,
                date: draft.date,
                time: draft.time,
                mood: savedMood,
                body: draft.body.trim(),
                images: savedImages,
                updatedAt: now,
              }
            : entry
        )
      : [
          {
            id: newLedgerId('diary'),
            date: draft.date,
            time: draft.time,
            mood: savedMood,
            body: draft.body.trim(),
            images: savedImages,
            createdAt: now,
            updatedAt: now,
          },
          ...diaryEntries,
        ];
    if (!diaryCollectionFits(next)) {
      window.alert('These photos use more space than this device can keep. Remove a photo and try again.');
      return false;
    }
    setDiaryEntries(next);
    return true;
  };

  const handleDeleteDiaryEntry = (id: string) => {
    markDeleted(storageKeys, [id]);
    setDiaryEntries((prev) => {
      const index = prev.findIndex((entry) => entry.id === id);
      if (index === -1) return prev;
      setRecentlyDeletedDiary({ entry: prev[index], index });
      setRecentlyDeleted(null);
      setRecentlyDeletedTransaction(null);
      return prev.filter((entry) => entry.id !== id);
    });
  };

  const handleUndoDeleteDiary = () => {
    if (!recentlyDeletedDiary) return;
    unmarkDeleted(storageKeys, [recentlyDeletedDiary.entry.id]);
    setDiaryEntries((prev) => {
      const copy = [...prev];
      copy.splice(recentlyDeletedDiary.index, 0, recentlyDeletedDiary.entry);
      return copy;
    });
    setRecentlyDeletedDiary(null);
  };

  const handleSetCheckIn = (habitId: string, date: string, patch: HabitCheckInPatch | null) => {
    const today = todayDateString();
    if (date > today) return;
    const habit = habits.find((item) => item.id === habitId);
    if (!habit || habitBlockReason(habit, goals) || !isScheduledOn(habit, date)) return;

    const now = new Date().toISOString();
    const id = `checkin-${habitId}-${date}`;
    setHabitCheckIns((prev) => {
      const existing = prev.filter((entry) => entry.habitId === habitId && entry.date === date);
      if (patch === null) {
        if (existing.length === 0) return prev;
        markDeleted(
          storageKeys,
          existing.map((entry) => entry.id)
        );
        const ids = new Set(existing.map((entry) => entry.id));
        return prev.filter((entry) => !ids.has(entry.id));
      }
      const prior = existing.find((entry) => entry.id === id) ?? existing[0];
      const extras = existing.filter((entry) => entry.id !== id).map((entry) => entry.id);
      if (extras.length > 0) markDeleted(storageKeys, extras);
      unmarkDeleted(storageKeys, [id]);
      const next: HabitCheckIn = {
        id,
        userId: prior?.userId,
        habitId,
        date,
        skipped: patch.skipped || undefined,
        note: patch.note?.trim() || undefined,
        value: patch.skipped ? undefined : patch.value,
        createdAt: prior?.createdAt ?? now,
        updatedAt: now,
      };
      return [...prev.filter((entry) => entry.habitId !== habitId || entry.date !== date), next];
    });
  };

  const handleLinkHabit = (habitId: string, goalId?: string) => {
    const now = new Date().toISOString();
    setHabits((prev) =>
      prev.map((habit) =>
        habit.id === habitId ? { ...habit, goalId: goalId || undefined, updatedAt: now } : habit
      )
    );
  };

  // Finance handlers
  const handleSaveTransaction = (partial: Partial<FinanceTransaction>) => {
    const now = new Date();
    const nowIso = now.toISOString();
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
                time: partial.time ?? t.time,
                paymentMethod: partial.paymentMethod ?? t.paymentMethod,
                accountId: partial.accountId,
                recurrence: partial.recurrence ?? t.recurrence,
                updatedAt: nowIso,
              }
            : t
        )
      );
      return;
    }

    const recurrence = partial.recurrence || { type: 'none' as const };
    const draft: EntryDraft = {
      type: partial.type === 'income' ? 'income' : 'expense',
      amount: partial.amount || 0,
      accountId: partial.accountId,
      category: partial.category || 'Other',
      note: partial.note,
      paymentMethod: partial.paymentMethod || DEFAULT_PAYMENT_METHOD,
      date: partial.date || selectedDate,
      time: partial.time,
      recurrence,
      recurrenceGroupId:
        recurrence.type !== 'none'
          ? `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
          : undefined,
    };

    const validation = validateEntry(draft, {
      accounts,
      transactions,
      settings: ledgerSettings[0] || { allowNegativeBalance: false },
    });
    if (isLedgerError(validation)) {
      window.alert(validation.message);
      return false;
    }

    const newTx = buildIncomeOrExpense(draft, { now });
    setTransactions((prev) => [newTx, ...prev]);
    return true;
  };

  const handleDeleteTransaction = (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;
    const isTransfer = tx.type === 'transfer';
    const hasLinkedFee = transactions.some((t) => t.linkedTransferId === id);
    const isRecurring = tx.recurrence?.type && tx.recurrence.type !== 'none';
    const confirmMsg = isTransfer
      ? hasLinkedFee
        ? 'Delete this transfer and its linked ATM fee?'
        : 'Delete this transfer?'
      : isRecurring
      ? `Delete this entry only? The series will continue generating future entries.`
      : `Delete this transaction?`;
    if (!window.confirm(confirmMsg)) return;

    const removedIds = idsRemovedByCascade(transactions, id);
    const removed = transactions.filter((t) => removedIds.includes(t.id));
    markDeleted(storageKeys, removedIds);
    setTransactions((prev) => removeTransactionCascade(prev, id));
    setRecentlyDeletedTransaction({ txs: removed });
    // Clear any pending undo toast to keep a single toast slot.
    setRecentlyDeleted(null);
    setRecentlyDeletedDiary(null);
  };

  const handleUndoDeleteTransaction = () => {
    if (!recentlyDeletedTransaction) return;
    unmarkDeleted(
      storageKeys,
      recentlyDeletedTransaction.txs.map((t) => t.id)
    );
    setTransactions((prev) => upsertTransactions(prev, recentlyDeletedTransaction.txs));
    setRecentlyDeletedTransaction(null);
  };

  const handleSetBudget = (month: string, limit: number) => {
    const now = new Date().toISOString();
    setBudgets((prev) => {
      const existing = prev.find((b) => b.month === month);
      if (existing) {
        return prev.map((b) => (b.month === month ? { ...b, limit, updatedAt: now } : b));
      }
      return [
        ...prev,
        {
          id: `budget-${month}`,
          month,
          limit,
          updatedAt: now,
        },
      ];
    });
  };

  const handleSetCategoryBudget = (month: string, category: string, limit: number) => {
    const now = new Date().toISOString();
    setCategoryBudgets((prev) => {
      const existing = prev.find((b) => b.month === month && b.category === category);
      if (existing) {
        return prev.map((b) =>
          b.month === month && b.category === category ? { ...b, limit, updatedAt: now } : b
        );
      }
      return [
        ...prev,
        {
          id: `cbudget-${month}-${category}`,
          month,
          category,
          limit,
          updatedAt: now,
        },
      ];
    });
  };

  const handleRemoveCategoryBudget = (month: string, category: string) => {
    setCategoryBudgets((prev) => {
      const removed = prev.filter((b) => b.month === month && b.category === category);
      markDeleted(
        storageKeys,
        removed.map((b) => b.id)
      );
      return prev.filter((b) => !(b.month === month && b.category === category));
    });
  };

  const handleQuickAddTransaction = (amount: number, category: string) => {
    const accountId = resolveDefaultAccountId(accounts, ledgerSettings[0]);
    if (!accountId) {
      setIsAccountModalOpen(true);
      return;
    }
    const account = accounts.find((a) => a.id === accountId);
    const draft: EntryDraft = {
      type: 'expense',
      amount,
      accountId,
      category,
      paymentMethod: account?.type === 'cash' ? 'cash' : 'bank_transfer',
      date: selectedDate,
      time: nowTimeString(),
    };
    const validation = validateEntry(draft, {
      accounts,
      transactions,
      settings: ledgerSettings[0] || { allowNegativeBalance: false },
    });
    if (isLedgerError(validation)) {
      window.alert(validation.message);
      return;
    }
    const tx = buildIncomeOrExpense(draft);
    setTransactions((prev) => [tx, ...prev]);
  };

  const openFinanceModal = (
    tx?: FinanceTransaction | null,
    defaults?: { type?: 'income' | 'expense'; accountId?: string }
  ) => {
    setEditingTransaction(tx || null);
    setFinanceDraftDefaults(defaults || null);
    setIsFinanceModalOpen(true);
  };

  // ===== Ledger handlers =====
  const openAccountModal = (account?: Account | null) => {
    setEditingAccount(account || null);
    setIsAccountModalOpen(true);
  };

  const handleSaveAccount = (partial: Partial<Account>) => {
    const now = new Date().toISOString();
    const name = (partial.name || '').trim();
    if (!name) return false;

    if (partial.id) {
      const existing = accounts.find((a) => a.id === partial.id);
      if (!existing) return false;
      if (!existing.isArchived && partial.isArchived) {
        const confirmed = window.confirm(
          `Archive "${existing.name}"? It stops appearing in totals and pickers, but all of its transactions are kept.`
        );
        // Refusing the confirmation must not silently drop the other edits.
        if (!confirmed) return false;
      }
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === partial.id
            ? {
                ...a,
                name,
                type: partial.type ?? a.type,
                bankName: partial.bankName,
                accountNickname: partial.accountNickname,
                lastFourDigits: partial.lastFourDigits,
                openingBalance: partial.openingBalance ?? a.openingBalance,
                isArchived: partial.isArchived ?? a.isArchived,
                updatedAt: now,
              }
            : a
        )
      );
      return true;
    }

    const newAccount: Account = {
      id: newLedgerId('acct'),
      name,
      type: partial.type || 'savings',
      bankName: partial.bankName,
      accountNickname: partial.accountNickname,
      lastFourDigits: partial.lastFourDigits,
      openingBalance: partial.openingBalance ?? 0,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    setAccounts((prev) => [...prev, newAccount]);
    return true;
  };

  const openTransferModal = (tx?: FinanceTransaction | null) => {
    setEditingTransfer(tx || null);
    setIsTransferModalOpen(true);
  };

  const handleSaveTransfer = (draft: TransferDraft) => {
    const validation = validateTransfer(draft, {
      accounts,
      transactions,
      settings: ledgerSettings[0] || { allowNegativeBalance: false },
    });
    if (isLedgerError(validation)) {
      window.alert(validation.message);
      return false;
    }

    const transfer = buildTransfer(draft);
    const original = draft.id ? transactions.find((t) => t.id === draft.id) : undefined;
    if (original) {
      transfer.createdAt = original.createdAt;
      transfer.recurrence = original.recurrence;
    }

    const records: FinanceTransaction[] = [transfer];
    const hasExistingFee = transactions.some((t) => t.linkedTransferId === transfer.id);
    if (!original && draft.atmFee && draft.atmFee > 0) {
      records.push(
        buildAtmFee(transfer, draft.atmFee, {
          category: 'Bills & Utilities',
          paymentMethod: 'cash',
        })
      );
    }
    if (hasExistingFee) {
      // Keep the linked fee in sync with an edited transfer's account and date.
      for (const tx of transactions) {
        if (tx.linkedTransferId !== transfer.id) continue;
        if (tx.date === transfer.date && tx.accountId === transfer.accountId) continue;
        records.push({
          ...tx,
          date: transfer.date,
          accountId: transfer.accountId,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    setTransactions((prev) => upsertTransactions(prev, records));

    const destination = accounts.find((account) => account.id === transfer.destinationAccountId);
    if (destination && isSavingsBucketType(destination.type)) {
      const stamp = new Date().toISOString();
      setLedgerSettings((prev) => {
        if (prev[0]?.defaultSavingsAccountId === destination.id) return prev;
        if (prev.length === 0) {
          return [
            {
              id: 'ledger',
              allowNegativeBalance: false,
              defaultSavingsAccountId: destination.id,
              updatedAt: stamp,
            },
          ];
        }
        return prev.map((settingsRecord, index) =>
          index === 0
            ? { ...settingsRecord, defaultSavingsAccountId: destination.id, updatedAt: stamp }
            : settingsRecord
        );
      });
    }
    return true;
  };

  const handleUpdateLedgerSettings = (partial: Partial<LedgerSettings>) => {
    const now = new Date().toISOString();
    setLedgerSettings((prev) => {
      if (prev.length === 0) {
        return [
          {
            id: 'ledger',
            allowNegativeBalance: false,
            ...partial,
            updatedAt: now,
          },
        ];
      }
      return prev.map((settingsRecord, index) =>
        index === 0 ? { ...settingsRecord, ...partial, updatedAt: now } : settingsRecord
      );
    });
  };

  const handleBulkAssignAccount = (txIds: string[], accountId: string) => {
    if (txIds.length === 0 || !accountId) return;
    setTransactions((prev) => assignAccountToTransactions(prev, txIds, accountId));
  };

  const handleQuickAdd = () => {
    if (activeTab === 'diary') {
      openDiaryComposer(selectedDate);
    } else if (activeTab === 'today' || activeTab === 'finance') {
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
    markDeleted(storageKeys, [id]);
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
    const now = new Date().toISOString();
    setSavingsGoals((prev) => {
      const existing = prev.find((g) => g.month === month);
      if (existing) {
        return prev.map((g) => (g.month === month ? { ...g, target, updatedAt: now } : g));
      }
      return [
        ...prev,
        {
          id: `goal-${month}`,
          month,
          target,
          updatedAt: now,
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
                accountId: partial.accountId,
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
        name: partial.name || 'Untitled Bill',
        amount: partial.amount || 0,
        category: partial.category || 'Other',
        dueDayOfMonth: partial.dueDayOfMonth || 1,
        paymentMethod: partial.paymentMethod || DEFAULT_PAYMENT_METHOD,
        accountId: partial.accountId,
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
    markDeleted(storageKeys, [id, ...billPayments.filter((p) => p.billId === id && !p.paid).map((p) => p.id)]);
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
      // Marking as paid: create a finance transaction against the template's
      // account (falling back to the default account).
      const accountId =
        template?.accountId || resolveDefaultAccountId(accounts, ledgerSettings[0]);
      const account = accounts.find((a) => a.id === accountId);
      const draft: EntryDraft = {
        type: 'expense',
        amount: payment.amount,
        accountId,
        category: template?.category || 'Other',
        note: `${template?.name || 'Bill'} payment`,
        paymentMethod:
          template?.paymentMethod || (account?.type === 'cash' ? 'cash' : 'bank_transfer'),
        date: payment.dueDate,
        time: nowTimeString(),
      };
      const validation = validateEntry(draft, {
        accounts,
        transactions,
        settings: ledgerSettings[0] || { allowNegativeBalance: false },
      });
      if (isLedgerError(validation)) {
        window.alert(validation.message);
        return;
      }

      const now = new Date().toISOString();
      const newTx = buildIncomeOrExpense(draft);
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
        markDeleted(storageKeys, idsRemovedByCascade(transactions, payment.transactionId));
        setTransactions((prev) => removeTransactionCascade(prev, payment.transactionId as string));
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
  const closeSavingsModal = () => {
    setIsSavingsModalOpen(false);
    setEditingSavingsEntry(null);
    setEditingSavingsTransfer(null);
    setSavingsPresetAmount(null);
  };

  const openSavingsModal = (entry?: SavingsEntry | null) => {
    setEditingSavingsEntry(entry || null);
    setEditingSavingsTransfer(null);
    setSavingsPresetAmount(null);
    setIsSavingsModalOpen(true);
  };

  const openSavingsTransferModal = (tx: FinanceTransaction) => {
    setEditingSavingsEntry(null);
    setEditingSavingsTransfer(tx);
    setSavingsPresetAmount(null);
    setIsSavingsModalOpen(true);
  };

  const openSavingsModalWithAmount = (amount: number) => {
    setEditingSavingsEntry(null);
    setEditingSavingsTransfer(null);
    setSavingsPresetAmount(amount);
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
    markDeleted(storageKeys, [id]);
    setSavingsEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleQuickAddSavings = (amount: number) => {
    const settingsRecord = ledgerSettings[0];
    const fromAccountId = resolveDefaultAccountId(accounts, settingsRecord);
    const toAccountId = resolveSavingsDestinationId(accounts, settingsRecord?.defaultSavingsAccountId);
    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
      openSavingsModalWithAmount(amount);
      return;
    }
    handleSaveTransfer({
      amount,
      fromAccountId,
      toAccountId,
      date: todayString(),
      time: nowTimeString(),
      note: 'Quick add',
    });
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
      const { payments } = materializeBillPayments(billTemplates, prev, currentMonth);
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
    <>
    <div
      inert={appLocked}
      className={`min-h-dvh font-sans selection:bg-indigo-500 selection:text-white pb-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:pb-8 lg:pl-64 transition-colors duration-200 ${
      theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-stone-50 text-slate-900'
    }`}>
      {/* App Header */}
      <Header
        notificationSettings={settings}
        permissionStatus={permissionStatus}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onRequestPermission={handleRequestPermission}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <InstallPrompt />

      {ringing && !isNative() && (
        <AlarmRingOverlay
          title={ringing.title}
          body={ringing.body}
          sound={ringing.sound}
          snoozeMinutes={ringing.snoozeMinutes}
          onDismiss={() => finishRing('dismiss')}
          onSnooze={() => finishRing('snooze')}
        />
      )}

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
      <main className="max-w-5xl lg:max-w-6xl mx-auto px-4 py-5 lg:pl-6 lg:pr-8">
        {/* TODAY VIEW */}
        {activeTab === 'today' && (
          <div className="space-y-5">
            <TodayAlarmCard alarms={alarms} onOpen={() => setActiveTab('alarms')} />
            <TodayHabitsCard
              date={selectedDate}
              goals={goals}
              habits={habits}
              checkIns={habitCheckIns}
              onSetCheckIn={handleSetCheckIn}
              onEditHabit={setEditingHabit}
              onDeleteHabit={handleDeleteHabit}
              onOpenHabits={() => setActiveTab('habits')}
            />
            <TodayDiaryCard
              date={selectedDate}
              entries={diaryEntries}
              onOpen={() => setActiveTab('diary')}
            />
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
                    { value: 'urgent', label: '?? Urgent' },
                    { value: 'high', label: '?? High' },
                    { value: 'medium', label: '?? Medium' },
                    { value: 'low', label: '?? Low' },
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
                    { value: 'priority-desc', label: 'Priority (Urgent ? Low)' },
                    { value: 'priority-asc', label: 'Priority (Low ? Urgent)' },
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

            {/* Native reminder reliability nudge (Android only, dismissible) */}
            {isNativeAndroid() && !reminderNoticeDismissed && (
              <ReminderReliabilityCard
                state={
                  nativeSetup
                    ? {
                        permissionGranted: nativeSetup.granted,
                        exactAlarm: nativeSetup.exactAlarm,
                      }
                    : null
                }
                onRequestPermission={() => void handleRequestPermission()}
                onOpenExactAlarmSettings={handleOpenExactAlarmSettings}
                onDismiss={dismissReminderNotice}
              />
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

        {activeTab === 'calendar' && (
          <CalendarView
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            tasks={tasks}
            goals={goals}
            habits={habits}
            checkIns={habitCheckIns}
            transactions={transactions}
            diaryEntries={diaryEntries}
            onToggleTask={handleToggleComplete}
            onEditTask={(task) => {
              setEditingTask(task);
              setIsTaskModalOpen(true);
            }}
            onSetCheckIn={handleSetCheckIn}
            onAddTask={() => {
              setEditingTask(null);
              setIsTaskModalOpen(true);
            }}
            onAddFinance={(type) => openFinanceModal(null, { type })}
            onAddNote={() => openDiaryComposer(selectedDate)}
            onEditNote={(entry) => openDiaryComposer(entry.date, entry)}
          />
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

        {activeTab === 'goals' && (
          <GoalsView
            goals={goals}
            habits={habits}
            checkIns={habitCheckIns}
            onSaveGoal={handleSaveGoal}
            onDeleteGoal={handleDeleteGoal}
            onSaveHabit={handleSaveHabit}
            onLinkHabit={handleLinkHabit}
            onRegisterClose={registerGoalClose}
            localMusicName={settings.localMusicName}
          />
        )}

        {activeTab === 'habits' && (
          <HabitsView
            goals={goals}
            habits={habits}
            checkIns={habitCheckIns}
            onSetCheckIn={handleSetCheckIn}
            onSaveHabit={handleSaveHabit}
            onDeleteHabit={handleDeleteHabit}
            onOpenGoals={() => setActiveTab('goals')}
            onRegisterClose={registerHabitClose}
            localMusicName={settings.localMusicName}
          />
        )}

        {activeTab === 'alarms' && (
          <AlarmsView
            alarms={alarms}
            localMusicName={settings.localMusicName}
            onSave={handleSaveAlarm}
            onDelete={handleDeleteAlarm}
            onToggle={(id, enabled) =>
              setAlarms((prev) =>
                prev.map((alarm) =>
                  alarm.id === id ? { ...alarm, enabled, updatedAt: new Date().toISOString() } : alarm
                )
              )
            }
          />
        )}

        {activeTab === 'diary' && (
          <DiaryView
            entries={diaryEntries}
            selectedDate={selectedDate}
            onAdd={() => openDiaryComposer(selectedDate)}
            onEdit={(entry) => openDiaryComposer(entry.date, entry)}
            onDelete={handleDeleteDiaryEntry}
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
        {activeTab === 'stats' && (
          <StatsView tasks={tasks} habits={habits} checkIns={habitCheckIns} goals={goals} />
        )}

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
            ledger={{
              accounts,
              transactions,
              ledgerSettings,
              selectedDate,
              onAddIncome: (accountId) => openFinanceModal(null, { type: 'income', accountId }),
              onAddExpense: (accountId) => openFinanceModal(null, { type: 'expense', accountId }),
              onTransfer: () => openTransferModal(null),
              onAddAccount: () => openAccountModal(null),
              onEditAccount: (account) => openAccountModal(account),
              onEditTransaction: (tx) => openFinanceModal(tx),
              onEditTransfer: (tx) => openTransferModal(tx),
              onDeleteTransaction: handleDeleteTransaction,
              onUpdateLedgerSettings: handleUpdateLedgerSettings,
              onBulkAssignAccount: handleBulkAssignAccount,
            }}
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
            onEditSavingsTransfer={openSavingsTransferModal}
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
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <DiaryEntryModal
        isOpen={isDiaryModalOpen}
        onClose={() => {
          setIsDiaryModalOpen(false);
          setEditingDiaryEntry(null);
        }}
        onSave={handleSaveDiaryEntry}
        initialEntry={editingDiaryEntry}
        defaultDate={diaryDraftDate}
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
        localMusicName={settings.localMusicName}
      />

      {/* Add / Edit Finance Transaction Modal */}
      {isFinanceModalOpen && (
        <FinanceModal
          isOpen={isFinanceModalOpen}
          onClose={() => {
            setIsFinanceModalOpen(false);
            setEditingTransaction(null);
            setFinanceDraftDefaults(null);
          }}
          onSave={handleSaveTransaction}
          initialTransaction={editingTransaction}
          selectedDate={selectedDate}
          accounts={accounts}
          transactions={transactions}
          ledgerSettings={ledgerSettings}
          initialType={financeDraftDefaults?.type}
          initialAccountId={financeDraftDefaults?.accountId}
        />
      )}

      {/* Add / Edit Ledger Account Modal */}
      {isAccountModalOpen && (
        <AccountModal
          isOpen={isAccountModalOpen}
          onClose={() => {
            setIsAccountModalOpen(false);
            setEditingAccount(null);
          }}
          onSave={handleSaveAccount}
          initialAccount={editingAccount}
          accounts={accounts}
          transactions={transactions}
        />
      )}

      {/* Transfer Money Modal */}
      {isTransferModalOpen && (
        <TransferModal
          isOpen={isTransferModalOpen}
          onClose={() => {
            setIsTransferModalOpen(false);
            setEditingTransfer(null);
          }}
          onSave={handleSaveTransfer}
          accounts={accounts}
          transactions={transactions}
          ledgerSettings={ledgerSettings}
          initialTransfer={editingTransfer}
          selectedDate={selectedDate}
        />
      )}

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
        accounts={accounts}
      />

      {/* Add / Edit Savings — a transfer into savings, gold, or stocks */}
      <SavingsModal
        isOpen={isSavingsModalOpen}
        onClose={closeSavingsModal}
        onSaveTransfer={handleSaveTransfer}
        onSaveLegacy={handleSaveSavingsEntry}
        initialTransfer={editingSavingsTransfer}
        initialLegacy={editingSavingsEntry}
        presetAmount={savingsPresetAmount}
        accounts={accounts}
        transactions={transactions}
        ledgerSettings={ledgerSettings}
        selectedDate={selectedDate}
      />

      <HabitModal
        isOpen={editingHabit !== null}
        onClose={() => setEditingHabit(null)}
        onSave={(habit) => {
          handleSaveHabit(habit);
          setEditingHabit(null);
        }}
        initialHabit={editingHabit}
        goals={goals}
        localMusicName={settings.localMusicName}
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
        backupFolderSupported={backupFolderSupported}
        backupFolderName={backupFolderName}
        backupLastSavedAt={backupLastSavedAt}
        backupFolderError={backupFolderError}
        onChooseBackupFolder={handleChooseBackupFolder}
        onStopBackupFolder={handleStopBackupFolder}
        cloudSync={cloudSync}
        nativeReminderState={
          isNativeAndroid() && nativeSetup
            ? { permissionGranted: nativeSetup.granted, exactAlarm: nativeSetup.exactAlarm }
            : null
        }
        nextReminder={isNativeAndroid() ? describeNextReminder(tasks, settings, habits, habitCheckIns, goals) : null}
        onRequestExactAlarm={handleOpenExactAlarmSettings}
      />

      {recentlyDeletedDiary && (
        <Toast
          message={`Note "${diaryPreview(recentlyDeletedDiary.entry.body, 40)}" deleted`}
          onUndo={handleUndoDeleteDiary}
          onDismiss={() => setRecentlyDeletedDiary(null)}
        />
      )}

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
          }).format(recentlyDeletedTransaction.txs[0]?.amount ?? 0)} deleted`}
          onUndo={handleUndoDeleteTransaction}
          onDismiss={() => setRecentlyDeletedTransaction(null)}
        />
      )}
    </div>
    {appLocked && <AppLockScreen theme={theme} error={lockError} onUnlock={() => void unlockApp()} />}
    </>
  );
}
