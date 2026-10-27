import React, { useEffect, useState } from 'react';
import { Repeat, X } from 'lucide-react';
import type { Goal, Habit, HabitScheduleType } from '../types';
import { Button } from './ui/Button';

interface HabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (habit: Partial<Habit>) => void;
  initialHabit?: Habit | null;
  goals: Goal[];
  defaultGoalId?: string;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const SCHEDULES: { id: HabitScheduleType; label: string }[] = [
  { id: 'daily', label: 'Every day' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'custom', label: 'Choose days' },
];

export const HabitModal: React.FC<HabitModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialHabit,
  goals,
  defaultGoalId,
}) => {
  const [title, setTitle] = useState('');
  const [scheduleType, setScheduleType] = useState<HabitScheduleType>('daily');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [goalId, setGoalId] = useState('');
  const [archived, setArchived] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (initialHabit) {
      setTitle(initialHabit.title);
      setScheduleType(initialHabit.schedule.type);
      setDaysOfWeek(initialHabit.schedule.daysOfWeek ?? []);
      setGoalId(initialHabit.goalId ?? '');
      setArchived(initialHabit.archived);
    } else {
      setTitle('');
      setScheduleType('daily');
      setDaysOfWeek([]);
      setGoalId(defaultGoalId ?? '');
      setArchived(false);
    }
  }, [defaultGoalId, initialHabit, isOpen]);

  if (!isOpen) return null;

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((value) => value !== day) : [...prev, day].sort()
    );
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    if (scheduleType === 'custom' && daysOfWeek.length === 0) return;

    onSave({
      id: initialHabit?.id,
      title: trimmed,
      goalId: goalId || undefined,
      schedule: {
        type: scheduleType,
        daysOfWeek: scheduleType === 'custom' ? daysOfWeek : undefined,
      },
      archived,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-t-2xl sm:rounded-2xl w-full min-w-0 max-w-md max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Repeat className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            {initialHabit ? 'Edit Habit' : 'New Habit'}
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
              Habit *
            </label>
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Read 10 pages"
              className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[40px]"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Schedule
            </span>
            <div className="grid grid-cols-3 gap-2">
              {SCHEDULES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setScheduleType(option.id)}
                  className={`px-2 py-2 rounded-xl text-xs font-bold border min-h-[40px] ${
                    scheduleType === option.id
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {scheduleType === 'custom' && daysOfWeek.length === 0 && (
              <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                Pick at least one day.
              </p>
            )}
            {scheduleType === 'custom' && (
              <div className="mt-2 flex gap-1.5">
                {DAY_LABELS.map((label, day) => {
                  const selected = daysOfWeek.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`w-9 h-9 rounded-full text-xs font-bold ${
                        selected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Linked goal
            </label>
            <select
              value={goalId}
              onChange={(event) => setGoalId(event.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[40px]"
            >
              <option value="">No goal</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
          </div>

          {initialHabit && (
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={archived}
                onChange={(event) => setArchived(event.target.checked)}
                className="rounded border-slate-300"
              />
              Archive this habit
            </label>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={scheduleType === 'custom' && daysOfWeek.length === 0}
            >
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
