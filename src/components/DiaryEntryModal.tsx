import React, { useState } from 'react';
import { BookOpen, X } from 'lucide-react';
import type { DiaryEntry, DiaryMood } from '../types';
import { DIARY_MOODS, currentTimeString, diaryMoodColor, validateDiaryDraft } from '../lib/diary';
import { Button } from './ui/Button';

interface DiaryEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Partial<DiaryEntry>) => void;
  initialEntry?: DiaryEntry | null;
  defaultDate: string;
}

export const DiaryEntryModal: React.FC<DiaryEntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialEntry,
  defaultDate,
}) => {
  const [date, setDate] = useState(initialEntry?.date ?? defaultDate);
  const [time, setTime] = useState(initialEntry?.time ?? currentTimeString());
  const [mood, setMood] = useState<DiaryMood>(initialEntry?.mood ?? 'okay');
  const [body, setBody] = useState(initialEntry?.body ?? '');
  const [error, setError] = useState<string | null>(null);
  const formKey = `${isOpen ? 'open' : 'closed'}:${initialEntry?.id ?? 'new'}:${defaultDate}`;
  const [appliedKey, setAppliedKey] = useState(formKey);
  if (appliedKey !== formKey) {
    setAppliedKey(formKey);
    if (isOpen) {
      setDate(initialEntry?.date ?? defaultDate);
      setTime(initialEntry?.time ?? currentTimeString());
      setMood(initialEntry?.mood ?? 'okay');
      setBody(initialEntry?.body ?? '');
      setError(null);
    }
  }

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const message = validateDiaryDraft({ date, time, mood, body });
    if (message) {
      setError(message);
      return;
    }
    onSave({
      id: initialEntry?.id,
      date,
      time,
      mood,
      body: body.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-t-2xl sm:rounded-2xl w-full min-w-0 max-w-md max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            {initialEntry ? 'Edit note' : 'New note'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="diary-date" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Date
              </label>
              <input
                id="diary-date"
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[40px]"
              />
            </div>
            <div>
              <label htmlFor="diary-time" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Time
              </label>
              <input
                id="diary-time"
                type="time"
                required
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[40px]"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mood</span>
            <div className="grid grid-cols-5 gap-1.5">
              {DIARY_MOODS.map((option) => {
                const selected = mood === option.id;
                const color = diaryMoodColor(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setMood(option.id)}
                    aria-pressed={selected}
                    className={`px-1 py-2 rounded-xl text-[11px] font-bold border min-h-[40px] ${
                      selected
                        ? `${color.solid} border-transparent`
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="diary-body" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Note
            </label>
            <textarea
              id="diary-body"
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                if (error) setError(null);
              }}
              rows={6}
              placeholder="What happened, or what is on your mind?"
              className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && (
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={!body.trim()}>
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
