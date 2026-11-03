import { describe, expect, it } from 'vitest';
import type { SyncEnvelope } from './persistence';
import { mergeCollection, mergeEnvelopes, mergeTombstones } from './syncMerge';

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

function envelope(tasks: { id: string; title: string; updatedAt?: string }[], tombstones = {}): SyncEnvelope {
  return {
    schemaVersion: 2,
    deviceId: 'device',
    updatedAt: hoursAgo(0),
    tombstones,
    data: {
      tasks,
      categories: [],
      transactions: [],
      budgets: [],
      categoryBudgets: [],
      debts: [],
      savingsGoals: [],
      savingsEntries: [],
      billTemplates: [],
      billPayments: [],
      settings: {},
    },
  } as unknown as SyncEnvelope;
}

describe('mergeCollection', () => {
  it('keeps the newer copy when both sides edited a record', () => {
    const local = [{ id: 'a', title: 'old', updatedAt: hoursAgo(3) }];
    const remote = [{ id: 'a', title: 'new', updatedAt: hoursAgo(1) }];
    expect(mergeCollection(local, remote, {})).toEqual(remote);
    expect(mergeCollection(remote, local, {})).toEqual(remote);
  });

  it('keeps local order and appends remote-only records', () => {
    const local = [{ id: 'b' }, { id: 'a' }];
    const remote = [{ id: 'c' }, { id: 'a' }];
    expect(mergeCollection(local, remote, {}).map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });

  it('removes a record last saved before it was deleted on another device', () => {
    const remote = [{ id: 'a', updatedAt: hoursAgo(5) }];
    expect(mergeCollection([], remote, { a: hoursAgo(2) })).toEqual([]);
  });

  it('keeps a record recreated under the same id after the deletion', () => {
    // e.g. clearing this month's budget, then setting it again.
    const local = [{ id: 'budget-2026-11', updatedAt: hoursAgo(1) }];
    expect(mergeCollection(local, [], { 'budget-2026-11': hoursAgo(2) })).toEqual(local);
  });

  it('drops a record when its tombstone time is unreadable', () => {
    expect(mergeCollection([{ id: 'a', updatedAt: hoursAgo(1) }], [], { a: 'garbage' })).toEqual([]);
  });
});

describe('mergeTombstones', () => {
  it('keeps the latest deletion time for each id', () => {
    const latest = hoursAgo(1);
    const merged = mergeTombstones({ a: hoursAgo(5) }, { a: latest, b: hoursAgo(2) });
    expect(Object.keys(merged).sort()).toEqual(['a', 'b']);
    expect(merged.a).toBe(latest);
  });

  it('prunes deletions older than 90 days', () => {
    expect(mergeTombstones({ a: hoursAgo(24 * 91) }, {})).toEqual({});
  });
});

describe('mergeEnvelopes', () => {
  it('applies a deletion made on the other device', () => {
    const local = envelope([{ id: 't1', title: 'Pay rent', updatedAt: hoursAgo(5) }]);
    const remote = envelope([], { t1: hoursAgo(1) });
    const merged = mergeEnvelopes(local, remote);
    expect(merged.data.tasks).toEqual([]);
    expect(merged.tombstones.t1).toBeDefined();
  });

  it('keeps records added on both devices', () => {
    const local = envelope([{ id: 't1', title: 'Phone task' }]);
    const remote = envelope([{ id: 't2', title: 'Desktop task' }]);
    expect(mergeEnvelopes(local, remote).data.tasks.map((t) => t.id)).toEqual(['t1', 't2']);
  });
});
