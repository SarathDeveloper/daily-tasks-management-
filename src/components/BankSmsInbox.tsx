import React, { useEffect, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { MessageSquare } from 'lucide-react';
import type { Account, FinanceCategory, FinanceTransaction } from '../types';
import { financeCategoryNames } from '../data/financeCategories';
import {
  dropPendingBankSms,
  hasScannedBankSms,
  ingestBankMessages,
  isPossibleDuplicate,
  loadBankSmsState,
  markBankSmsScanned,
  matchLastFour,
  paymentLabel,
  readPendingBankSms,
  saveBankSmsState,
  type PendingBankSms,
} from '../lib/bankSmsInbox';
import { smsFingerprint } from '../lib/bankSmsParse';
import { isNativeAndroid } from '../lib/platform';
import { BankSms } from '../services/bankSms';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface BankSmsInboxProps {
  accounts: Account[];
  transactions: FinanceTransaction[];
  financeCategories: FinanceCategory[];
  onConfirm: (partial: Partial<FinanceTransaction>) => boolean;
}

const fieldClass =
  'w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-800 dark:text-slate-100';

const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);

export const BankSmsInbox: React.FC<BankSmsInboxProps> = ({
  accounts,
  transactions,
  financeCategories,
  onConfirm,
}) => {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [pending, setPending] = useState<PendingBankSms[]>(() =>
    isNativeAndroid() ? readPendingBankSms() : []
  );
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [edits, setEdits] = useState<Record<string, { category?: string; accountId?: string }>>({});
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;
  const pullRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!isNativeAndroid()) return;
    let alive = true;
    let chain = Promise.resolve();
    const pull = () => {
      chain = chain
        .then(async () => {
          const status = await BankSms.checkPermission();
          if (alive) setGranted(status.granted);
          if (!status.granted) {
            if (alive) setPending(readPendingBankSms());
            return;
          }
          const peeked = await BankSms.peekQueue();
          const queued = peeked.messages ?? [];
          const incoming = [...queued];
          let scanFinished = hasScannedBankSms();
          if (!scanFinished) {
            try {
              const scanned = await BankSms.scanRecent({ days: 30 });
              incoming.push(...(scanned.messages ?? []));
              scanFinished = true;
            } catch (error) {
              console.warn('Could not scan recent bank SMS:', error);
            }
          }
          const next = ingestBankMessages(incoming, accountsRef.current, loadBankSmsState());
          saveBankSmsState(next);
          if (scanFinished && !hasScannedBankSms()) markBankSmsScanned();
          if (alive) setPending(next.pending);
          const ackIds = queued
            .filter((message) => {
              const id = smsFingerprint(message.address ?? '', message.body ?? '');
              return next.pending.some((item) => item.id === id) || next.handled.includes(id);
            })
            .map((message) => message.id || smsFingerprint(message.address ?? '', message.body ?? ''));
          if (ackIds.length > 0) await BankSms.ackQueue({ ids: ackIds });
        })
        .catch((error) => {
          console.warn('Could not read bank SMS:', error);
          if (alive) setGranted((value) => (value == null ? false : value));
        });
    };
    pullRef.current = pull;
    pull();

    let removeSms = () => {};
    let removeApp = () => {};
    void BankSms.addListener('smsQueued', () => pull()).then((handle) => {
      removeSms = () => {
        void handle.remove();
      };
    });
    void CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) pull();
    }).then((handle) => {
      removeApp = () => {
        void handle.remove();
      };
    });
    return () => {
      alive = false;
      removeSms();
      removeApp();
    };
  }, []);

  if (!isNativeAndroid() || granted === null) return null;

  const activeAccounts = accounts.filter((account) => !account.isArchived);

  const categoryFor = (item: PendingBankSms) => edits[item.id]?.category ?? item.category ?? 'Other';

  const accountFor = (item: PendingBankSms) => {
    if (edits[item.id] && edits[item.id].accountId !== undefined) return edits[item.id].accountId ?? '';
    return item.accountId ?? matchLastFour(item.lastFour, accounts) ?? '';
  };

  const patch = (id: string, change: { category?: string; accountId?: string }) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...change } }));
  };

  const remove = (id: string) => {
    const next = dropPendingBankSms(loadBankSmsState(), id);
    saveBankSmsState(next);
    setPending(next.pending);
    setEdits((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const confirm = (item: PendingBankSms) => {
    const accountId = accountFor(item);
    const saved = onConfirm({
      type: item.type,
      amount: item.amount,
      category: categoryFor(item) || 'Other',
      note: item.merchant,
      date: item.date,
      time: item.time,
      paymentMethod: item.paymentMethod,
      accountId: accountId || undefined,
      recurrence: { type: 'none' },
    });
    if (!saved) return;
    remove(item.id);
  };

  const allow = async () => {
    setBusy(true);
    try {
      const result = await BankSms.requestPermission();
      setDenied(!result.granted);
      setGranted(result.granted);
      pullRef.current();
    } catch (error) {
      console.warn('Could not request SMS permission:', error);
      setDenied(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <MessageSquare className="w-4 h-4 mt-0.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Bank SMS{pending.length > 0 ? ` (${pending.length})` : ''}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {granted
              ? 'Debits and credits wait here. They join the ledger only after you confirm.'
              : 'When a bank texts a debit or credit, it waits here until you confirm it.'}
          </p>
        </div>
      </div>

      {!granted && (
        <div className="space-y-2">
          <Button type="button" size="sm" onClick={() => void allow()} disabled={busy}>
            {busy ? 'Waiting for permission…' : 'Allow SMS'}
          </Button>
          {denied && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              SMS access is still off. Allow SMS for Dayflow in the phone’s app settings, then come back.
            </p>
          )}
        </div>
      )}

      {granted && pending.length === 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Listening for bank SMS. If a new message never shows up, set Dayflow to Unrestricted battery.
        </p>
      )}

      {pending.map((item) => {
        const categories = financeCategoryNames(item.type, financeCategories);
        const accountId = accountFor(item);
        const duplicate = isPossibleDuplicate(item, transactions);
        return (
          <div
            key={item.id}
            className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {item.type === 'expense' ? 'Spent' : 'Received'} {formatMoney(item.amount)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {item.date}
                  {item.time ? ` · ${item.time}` : ''}
                  {item.merchant ? ` · ${item.merchant}` : ''}
                  {` · ${paymentLabel(item.paymentMethod)}`}
                </p>
                {item.lastFour && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    SMS account ends in {item.lastFour}
                  </p>
                )}
                {duplicate && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                    An entry for this amount is already on this date.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="block">
                <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Category
                </span>
                <select
                  className={fieldClass}
                  value={categoryFor(item)}
                  onChange={(event) => patch(item.id, { category: event.target.value })}
                >
                  {categories.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Account
                </span>
                <select
                  className={fieldClass}
                  value={accountId}
                  onChange={(event) => patch(item.id, { accountId: event.target.value })}
                >
                  <option value="">Choose account</option>
                  {activeAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                      {account.lastFourDigits ? ` ····${account.lastFourDigits}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => confirm(item)}>
                Confirm
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => remove(item.id)}>
                Dismiss
              </Button>
            </div>
          </div>
        );
      })}
    </Card>
  );
};
