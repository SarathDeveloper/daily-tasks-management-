import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { DiaryEntry, DiaryMood } from '../types';
import { formatClockTime, formatLongDate } from '../lib/dateFormat';
import { diaryMoodColor, diaryMoodLabel, groupDiaryByDate, sanitizeDiaryImages, searchDiaryEntries } from '../lib/diary';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface DiaryViewProps {
  entries: DiaryEntry[];
  selectedDate: string;
  onAdd: () => void;
  onEdit: (entry: DiaryEntry) => void;
  onDelete: (id: string) => void;
}

export const DiaryPhotoStrip: React.FC<{
  images: { id: string; dataUrl: string }[];
  onPreview?: (url: string) => void;
  size?: 'sm' | 'md';
}> = ({ images, onPreview, size = 'md' }) => {
  if (images.length === 0) return null;
  const frame = size === 'sm' ? 'h-10 w-10' : 'h-24 w-full';
  return (
    <div className={`mt-2 grid gap-2 ${size === 'sm' ? 'grid-cols-4' : 'grid-cols-3'}`}>
      {images.map((image) =>
        onPreview ? (
          <button
            key={image.id}
            type="button"
            onClick={() => onPreview(image.dataUrl)}
            aria-label="View photo"
            className="overflow-hidden rounded-xl"
          >
            <img src={image.dataUrl} alt="" className={`${frame} object-cover bg-slate-100 dark:bg-slate-800`} />
          </button>
        ) : (
          <img key={image.id} src={image.dataUrl} alt="" className={`${frame} rounded-xl object-cover bg-slate-100 dark:bg-slate-800`} />
        )
      )}
    </div>
  );
};

export const DiaryMoodChip: React.FC<{ mood: DiaryMood }> = ({ mood }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${diaryMoodColor(mood).soft}`}>
    {diaryMoodLabel(mood)}
  </span>
);

export const DiaryView: React.FC<DiaryViewProps> = ({
  entries,
  selectedDate,
  onAdd,
  onEdit,
  onDelete,
}) => {
  const [query, setQuery] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const searching = query.trim().length > 0;
  const groups = useMemo(
    () => groupDiaryByDate(searchDiaryEntries(entries, query)),
    [entries, query]
  );
  const selectedGroup = groups.find((group) => group.date === selectedDate) ?? null;
  const otherGroups = searching ? groups : groups.filter((group) => group.date !== selectedDate);

  useEffect(() => {
    document.getElementById(`diary-day-${selectedDate}`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedDate]);

  return (
    <div className="max-w-4xl lg:max-w-6xl mx-auto space-y-5 pb-24 lg:pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            Diary
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            A day can hold as many notes as you need.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={onAdd}>
          <Plus className="w-4 h-4" />
          New note
        </Button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search notes..."
          aria-label="Search notes"
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[40px]"
        />
      </div>

      {entries.length === 0 && (
        <Card className="p-8 text-center">
          <BookOpen className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No notes yet</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
            Write the first note for {formatLongDate(selectedDate)}. You can add another later the same day.
          </p>
          <div className="mt-4">
            <Button variant="primary" size="sm" onClick={onAdd}>
              <Plus className="w-4 h-4" />
              New note
            </Button>
          </div>
        </Card>
      )}

      {entries.length > 0 && searching && groups.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No notes match that search.</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Try a different word from the note.</p>
        </Card>
      )}

      {entries.length > 0 && !searching && !selectedGroup && (
        <Card id={`diary-day-${selectedDate}`} className="p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {formatLongDate(selectedDate)}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">No notes on this day.</p>
        </Card>
      )}

      <div className="space-y-5">
        {selectedGroup && !searching && (
          <DiaryDayGroup
            date={selectedGroup.date}
            entries={selectedGroup.entries}
            highlighted
            onEdit={onEdit}
            onDelete={onDelete}
            onPreview={setPreviewUrl}
          />
        )}
        {(searching ? groups : otherGroups).map((group) => (
          <DiaryDayGroup
            key={group.date}
            date={group.date}
            entries={group.entries}
            highlighted={!searching && group.date === selectedDate}
            onEdit={onEdit}
            onDelete={onDelete}
            onPreview={setPreviewUrl}
          />
        ))}
      </div>
      {previewUrl && (
        <button
          type="button"
          aria-label="Close photo"
          onClick={() => setPreviewUrl(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4"
        >
          <img src={previewUrl} alt="" className="max-h-[85dvh] max-w-full rounded-2xl object-contain" />
        </button>
      )}
    </div>
  );
};

const DiaryDayGroup: React.FC<{
  date: string;
  entries: DiaryEntry[];
  highlighted?: boolean;
  onEdit: (entry: DiaryEntry) => void;
  onDelete: (id: string) => void;
  onPreview: (url: string) => void;
}> = ({ date, entries, highlighted, onEdit, onDelete, onPreview }) => (
  <section id={`diary-day-${date}`} className="space-y-2">
    <h3 className={`text-xs font-bold uppercase tracking-wide ${
      highlighted ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'
    }`}>
      {formatLongDate(date)}
    </h3>
    <div className="space-y-2">
      {entries.map((entry) => (
        <Card key={entry.id} className={`p-4 ${highlighted ? 'ring-1 ring-indigo-200 dark:ring-indigo-800' : ''}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <DiaryMoodChip mood={entry.mood} />
                <span className="text-xs font-semibold text-slate-400">{formatClockTime(entry.time)}</span>
              </div>
              {entry.body ? (
                <p className="mt-2 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">
                  {entry.body}
                </p>
              ) : null}
              <DiaryPhotoStrip images={sanitizeDiaryImages(entry.images)} onPreview={onPreview} />
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => onEdit(entry)}
                aria-label="Edit note"
                className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(entry.id)}
                aria-label="Delete note"
                className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  </section>
);
