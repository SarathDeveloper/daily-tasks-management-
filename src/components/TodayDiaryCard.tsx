import React, { useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import type { DiaryEntry } from '../types';
import { formatClockTime } from '../lib/dateFormat';
import { diaryPreview, sortDiaryEntries } from '../lib/diary';
import { Card } from './ui/Card';
import { DiaryMoodChip } from './DiaryView';

interface TodayDiaryCardProps {
  date: string;
  entries: DiaryEntry[];
  onOpen: () => void;
}

export const TodayDiaryCard: React.FC<TodayDiaryCardProps> = ({ date, entries, onOpen }) => {
  const dayNotes = useMemo(
    () => sortDiaryEntries(entries.filter((entry) => entry.date === date)),
    [date, entries]
  );
  const latest = dayNotes[0];
  const countLabel = `${dayNotes.length} ${dayNotes.length === 1 ? 'note' : 'notes'}`;

  return (
    <section className="space-y-2" aria-label="Diary">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
          Diary · {countLabel}
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400"
        >
          Open
        </button>
      </div>
      <Card className="p-3">
        {latest ? (
          <button type="button" onClick={onOpen} className="w-full text-left">
            <div className="flex flex-wrap items-center gap-2">
              <DiaryMoodChip mood={latest.mood} />
              <span className="text-xs font-semibold text-slate-400">{formatClockTime(latest.time)}</span>
            </div>
            <p className="mt-1.5 text-sm text-slate-800 dark:text-slate-100 line-clamp-2">
              {diaryPreview(latest.body, 140)}
            </p>
          </button>
        ) : (
          <button type="button" onClick={onOpen} className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
            No notes yet.
          </button>
        )}
      </Card>
    </section>
  );
};
