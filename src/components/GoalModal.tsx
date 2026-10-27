import React, { useEffect, useState } from 'react';
import { Target, X } from 'lucide-react';
import type { Goal, GoalStatus } from '../types';
import { addDays, todayDateString } from '../lib/habits';
import { Button } from './ui/Button';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (goal: Partial<Goal>) => void;
  initialGoal?: Goal | null;
}

const STATUSES: { id: GoalStatus; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'completed', label: 'Completed' },
];

export const GoalModal: React.FC<GoalModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialGoal,
}) => {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [startDate, setStartDate] = useState(todayDateString());
  const [targetDate, setTargetDate] = useState(addDays(todayDateString(), 30));
  const [status, setStatus] = useState<GoalStatus>('active');

  useEffect(() => {
    if (!isOpen) return;
    if (initialGoal) {
      setTitle(initialGoal.title);
      setNote(initialGoal.note ?? '');
      setStartDate(initialGoal.startDate);
      setTargetDate(initialGoal.targetDate);
      setStatus(initialGoal.status);
    } else {
      const today = todayDateString();
      setTitle('');
      setNote('');
      setStartDate(today);
      setTargetDate(addDays(today, 30));
      setStatus('active');
    }
  }, [initialGoal, isOpen]);

  if (!isOpen) return null;

  const datesInvalid = targetDate < startDate;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || datesInvalid) return;
    onSave({
      id: initialGoal?.id,
      title: trimmed,
      note: note.trim() || undefined,
      startDate,
      targetDate,
      status,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-t-2xl sm:rounded-2xl w-full min-w-0 max-w-md max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            {initialGoal ? 'Edit Goal' : 'New Goal'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Goal *
            </label>
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Read 12 books"
              className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[40px]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Note
            </label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder="Why this matters"
              className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Starts
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[40px]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target date
              </label>
              <input
                type="date"
                required
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[40px]"
              />
            </div>
          </div>
          {datesInvalid && (
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              Target date has to be on or after the start date.
            </p>
          )}

          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Status
            </span>
            <div className="grid grid-cols-3 gap-2">
              {STATUSES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setStatus(option.id)}
                  className={`px-2 py-2 rounded-xl text-xs font-bold border min-h-[40px] ${
                    status === option.id
                      ? 'bg-violet-600 text-white border-violet-500'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={datesInvalid}>
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
