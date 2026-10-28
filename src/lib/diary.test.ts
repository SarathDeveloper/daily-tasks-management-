import { describe, expect, it } from 'vitest';
import type { DiaryEntry } from '../types';
import {
  diaryPreview,
  groupDiaryByDate,
  searchDiaryEntries,
  sortDiaryEntries,
  validateDiaryDraft,
} from './diary';

const STAMP = '2026-10-01T00:00:00.000Z';

const entry = (over: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: 'diary-1',
  date: '2026-10-02',
  time: '09:00',
  mood: 'good',
  body: 'Morning pages',
  createdAt: STAMP,
  updatedAt: STAMP,
  ...over,
});

const draft = (over: Partial<{ date: string; time: string; mood: string; body: string }> = {}) => ({
  date: '2026-10-02',
  time: '09:15',
  mood: 'okay',
  body: 'A note',
  ...over,
});

describe('validateDiaryDraft', () => {
  it('accepts a complete note', () => {
    expect(validateDiaryDraft(draft())).toBeNull();
  });

  it('rejects an empty note', () => {
    expect(validateDiaryDraft(draft({ body: '   ' }))).toBe('Write a note before saving.');
  });

  it('rejects a bad date, time, or mood', () => {
    expect(validateDiaryDraft(draft({ date: '2026-02-31' }))).toBe('Choose a valid date.');
    expect(validateDiaryDraft(draft({ time: '25:00' }))).toBe('Choose a valid time.');
    expect(validateDiaryDraft(draft({ mood: 'ecstatic' }))).toBe('Choose a mood.');
  });
});

describe('diary collections', () => {
  const notes = [
    entry({ id: 'early', time: '08:00', body: 'Early walk', updatedAt: '2026-10-02T08:00:00.000Z' }),
    entry({ id: 'late', time: '21:10', body: 'Late thought', updatedAt: '2026-10-02T21:10:00.000Z' }),
    entry({
      id: 'same',
      time: '21:10',
      body: 'Same minute, older edit',
      updatedAt: '2026-10-02T21:00:00.000Z',
    }),
    entry({ id: 'yesterday', date: '2026-10-01', time: '12:00', body: 'Yesterday' }),
  ];

  it('sorts a day with the latest time first', () => {
    const ordered = sortDiaryEntries(notes.filter((note) => note.date === '2026-10-02'));
    expect(ordered.map((note) => note.id)).toEqual(['late', 'same', 'early']);
  });

  it('groups newest day first and keeps each day sorted', () => {
    const groups = groupDiaryByDate(notes);
    expect(groups.map((group) => group.date)).toEqual(['2026-10-02', '2026-10-01']);
    expect(groups[0].entries.map((note) => note.id)).toEqual(['late', 'same', 'early']);
  });

  it('searches note text and ignores blank queries', () => {
    expect(searchDiaryEntries(notes, '  walk ').map((note) => note.id)).toEqual(['early']);
    expect(searchDiaryEntries(notes, '   ')).toHaveLength(notes.length);
  });

  it('previews the first line', () => {
    expect(diaryPreview('  \nHello there\nmore')).toBe('Hello there');
    expect(diaryPreview('abcdefghijklmnopqrstuvwxyz', 10)).toBe('abcdefghi…');
  });
});
