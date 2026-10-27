import { beforeEach, describe, expect, it } from 'vitest';
import type { Account, FinanceTransaction, LedgerSettings } from '../types';
import {
  DATA_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  countRecords,
  getStorageKeys,
  readSnapshot,
  writeSnapshot,
  type SyncData,
  type SyncEnvelope,
} from './persistence';
import { isEnvelopeEmpty, isValidEnvelope, mergeEnvelopes } from './syncMerge';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  get length() {
    return this.store.size;
  }
}

const STAMP = '2026-10-01T00:00:00.000Z';

const account = (over: Partial<Account> = {}): Account => ({
  id: 'acct-yes',
  name: 'YES Bank',
  type: 'savings',
  openingBalance: 12000,
  isArchived: false,
  createdAt: STAMP,
  updatedAt: STAMP,
  ...over,
});

const transaction = (over: Partial<FinanceTransaction> = {}): FinanceTransaction => ({
  id: 'tx-1',
  type: 'expense',
  amount: 500,
  category: 'Food & Dining',
  date: '2026-10-02',
  recurrence: { type: 'none' },
  createdAt: STAMP,
  updatedAt: STAMP,
  ...over,
});

const ledgerSettings: LedgerSettings = {
  id: 'ledger',
  allowNegativeBalance: false,
  defaultAccountId: 'acct-yes',
  updatedAt: STAMP,
};

const emptyData = (): SyncData => ({
  tasks: [],
  categories: [],
  transactions: [],
  accounts: [],
  ledgerSettings: [],
  budgets: [],
  categoryBudgets: [],
  debts: [],
  savingsGoals: [],
  savingsEntries: [],
  billTemplates: [],
  billPayments: [],
  settings: DEFAULT_SETTINGS,
});

const envelope = (data: Partial<SyncData>, over: Partial<SyncEnvelope> = {}): SyncEnvelope => ({
  schemaVersion: DATA_SCHEMA_VERSION,
  deviceId: 'device-a',
  updatedAt: STAMP,
  settingsUpdatedAt: STAMP,
  tombstones: {},
  data: { ...emptyData(), ...data },
  ...over,
});

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe('storage keys', () => {
  it('namespaces ledger keys per profile', () => {
    const globalKeys = getStorageKeys(null);
    const userKeys = getStorageKeys('user-1');
    expect(globalKeys.accounts).toBe('daily_finance_accounts_v1');
    expect(globalKeys.ledgerSettings).toBe('daily_finance_ledger_settings_v1');
    expect(userKeys.accounts).toBe('daily_finance_accounts_user-1');
    expect(userKeys.ledgerSettings).toBe('daily_finance_ledger_settings_user-1');
    expect(userKeys.transactions).not.toBe(globalKeys.transactions);
  });
});

describe('snapshots', () => {
  it('round-trips accounts, settings and transactions through localStorage', () => {
    const keys = getStorageKeys('user-1');
    const data: SyncData = {
      ...emptyData(),
      accounts: [account()],
      ledgerSettings: [ledgerSettings],
      transactions: [transaction({ accountId: 'acct-yes', time: '13:20' })],
    };

    writeSnapshot(keys, data);
    const loaded = readSnapshot(keys);

    expect(loaded.accounts).toEqual(data.accounts);
    expect(loaded.ledgerSettings).toEqual(data.ledgerSettings);
    expect(loaded.transactions).toEqual(data.transactions);
    expect(countRecords(loaded)).toBe(3);
  });

  it('returns empty collections when nothing is stored', () => {
    const loaded = readSnapshot(getStorageKeys(null));
    expect(loaded.accounts).toEqual([]);
    expect(loaded.ledgerSettings).toEqual([]);
    expect(loaded.transactions).toEqual([]);
  });

  it('keeps records after a simulated app restart', () => {
    const keys = getStorageKeys('user-1');
    writeSnapshot(keys, {
      ...emptyData(),
      accounts: [account({ openingBalance: 2500, type: 'cash', name: 'Cash Wallet' })],
    });

    // A restart re-reads the same keys from the same storage.
    const reloaded = readSnapshot(getStorageKeys('user-1'));
    expect(reloaded.accounts).toHaveLength(1);
    expect(reloaded.accounts[0].openingBalance).toBe(2500);
  });
});

describe('sync envelopes', () => {
  it('validates a v2 envelope with accounts', () => {
    expect(isValidEnvelope(envelope({ accounts: [account()], ledgerSettings: [ledgerSettings] }))).toBe(
      true
    );
  });

  it('still validates a v1 envelope without accounts', () => {
    const legacy = {
      schemaVersion: 1,
      deviceId: 'old-device',
      updatedAt: STAMP,
      settingsUpdatedAt: STAMP,
      tombstones: {},
      data: {
        tasks: [],
        categories: [],
        transactions: [transaction()],
        budgets: [],
        categoryBudgets: [],
        debts: [],
        savingsGoals: [],
        savingsEntries: [],
        billTemplates: [],
        billPayments: [],
        settings: DEFAULT_SETTINGS,
      },
    };
    expect(isValidEnvelope(legacy)).toBe(true);
  });

  it('rejects a malformed accounts field', () => {
    expect(isValidEnvelope(envelope({ accounts: 'nope' as unknown as Account[] }))).toBe(false);
  });

  it('merges accounts from both devices with last-write-wins', () => {
    const local = envelope({
      accounts: [
        account({ id: 'yes', name: 'YES Bank', openingBalance: 100, updatedAt: STAMP }),
      ],
    });
    const remote = envelope(
      {
        accounts: [
          account({
            id: 'yes',
            name: 'YES Bank',
            openingBalance: 999,
            updatedAt: '2026-10-05T00:00:00.000Z',
          }),
          account({ id: 'indian', name: 'Indian Bank', openingBalance: 500 }),
        ],
      },
      { deviceId: 'device-b' }
    );

    const merged = mergeEnvelopes(local, remote);
    expect(merged.data.accounts).toHaveLength(2);
    expect(merged.data.accounts.find((a) => a.id === 'yes')?.openingBalance).toBe(999);
    expect(merged.deviceId).toBe('device-a');
  });

  it('merges a v1 remote that has no accounts without losing local accounts', () => {
    const local = envelope({ accounts: [account({ id: 'yes' })] });
    const remote = envelope({}, { schemaVersion: 1 });
    const legacyData = { ...remote.data } as Partial<SyncData>;
    delete legacyData.accounts;
    delete legacyData.ledgerSettings;

    const merged = mergeEnvelopes(local, { ...remote, data: legacyData as SyncData });
    expect(merged.data.accounts).toHaveLength(1);
    expect(merged.data.ledgerSettings).toEqual([]);
  });

  it('keeps ledger settings from the newer device', () => {
    const local = envelope({
      ledgerSettings: [{ id: 'ledger', allowNegativeBalance: false, updatedAt: STAMP }],
    });
    const remote = envelope(
      {
        ledgerSettings: [
          {
            id: 'ledger',
            allowNegativeBalance: true,
            defaultAccountId: 'yes',
            updatedAt: '2026-10-09T00:00:00.000Z',
          },
        ],
      },
      { deviceId: 'device-b' }
    );
    const merged = mergeEnvelopes(local, remote);
    expect(merged.data.ledgerSettings[0].allowNegativeBalance).toBe(true);
  });

  it('treats an accounts-only envelope as non-empty', () => {
    expect(isEnvelopeEmpty(envelope({ accounts: [account()] }))).toBe(false);
    expect(isEnvelopeEmpty(envelope({}))).toBe(true);
  });
});
