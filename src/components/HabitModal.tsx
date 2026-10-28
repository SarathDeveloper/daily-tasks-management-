import React, { useEffect, useState } from 'react';
import { Bell, Minus, Plus, Repeat, Volume2, X } from 'lucide-react';
import type { Goal, Habit, HabitColor, HabitScheduleType, SoundType } from '../types';
import { audioService } from '../services/audioService';
import { HABIT_COLOR_IDS, habitColor } from '../lib/habitStyle';
import { HABIT_ICON_IDS, HabitIcon } from './HabitIcon';
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
  { id: 'times_per_week', label: 'Times / week' },
];

const SOUNDS: { id: SoundType; label: string }[] = [
  { id: 'chime', label: 'Gentle Chime' },
  { id: 'bell', label: 'Harmonic Bell' },
  { id: 'digital', label: 'Digital Pulse' },
  { id: 'gentle', label: 'Soothing Chord' },
  { id: 'voice', label: 'Voice' },
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
  const [timesPerWeek, setTimesPerWeek] = useState(3);
  const [goalId, setGoalId] = useState('');
  const [archived, setArchived] = useState(false);
  const [color, setColor] = useState<HabitColor>('indigo');
  const [icon, setIcon] = useState<string>('Repeat');
  const [targetCount, setTargetCount] = useState(1);
  const [unit, setUnit] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('08:00');
  const [sound, setSound] = useState<SoundType>('chime');

  useEffect(() => {
    if (!isOpen) return;
    if (initialHabit) {
      setTitle(initialHabit.title);
      setScheduleType(initialHabit.schedule.type);
      setDaysOfWeek(initialHabit.schedule.daysOfWeek ?? []);
      setTimesPerWeek(initialHabit.schedule.timesPerWeek ?? 3);
      setGoalId(initialHabit.goalId ?? '');
      setArchived(initialHabit.archived);
      setColor(initialHabit.color ?? 'indigo');
      setIcon(initialHabit.icon ?? 'Repeat');
      setTargetCount(initialHabit.targetCount && initialHabit.targetCount > 1 ? initialHabit.targetCount : 1);
      setUnit(initialHabit.unit ?? '');
      setReminderEnabled(initialHabit.reminder?.enabled ?? false);
      setReminderTime(initialHabit.reminder?.time || '08:00');
      setSound(initialHabit.reminder?.sound || 'chime');
    } else {
      setTitle('');
      setScheduleType('daily');
      setDaysOfWeek([]);
      setTimesPerWeek(3);
      setGoalId(defaultGoalId ?? '');
      setArchived(false);
      setColor('indigo');
      setIcon('Repeat');
      setTargetCount(1);
      setUnit('');
      setReminderEnabled(false);
      setReminderTime('08:00');
      setSound('chime');
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
        timesPerWeek: scheduleType === 'times_per_week' ? timesPerWeek : undefined,
      },
      archived,
      color,
      icon,
      targetCount: targetCount > 1 ? targetCount : undefined,
      unit: targetCount > 1 ? unit.trim() || undefined : undefined,
      reminder: reminderEnabled
        ? {
            enabled: true,
            time: reminderTime || '08:00',
            sound,
            lastNotifiedAt: initialHabit?.reminder?.lastNotifiedAt,
          }
        : undefined,
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
            <div className="grid grid-cols-2 gap-2">
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
            {scheduleType === 'times_per_week' && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Fewer times per week"
                  onClick={() => setTimesPerWeek((value) => Math.max(1, value - 1))}
                  className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold min-w-[5.5rem] text-center">{timesPerWeek}× / week</span>
                <button
                  type="button"
                  aria-label="More times per week"
                  onClick={() => setTimesPerWeek((value) => Math.min(7, value + 1))}
                  className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Target
            </span>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={999}
                value={targetCount}
                onChange={(event) => setTargetCount(Math.max(1, Number(event.target.value) || 1))}
                aria-label="Target amount"
                className="w-24 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[40px]"
              />
              <input
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                placeholder={targetCount > 1 ? 'pages, min, cups' : 'Optional unit'}
                disabled={targetCount <= 1}
                aria-label="Target unit"
                className="flex-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[40px] disabled:opacity-50"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">1 is a simple check. More than 1 logs an amount.</p>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Color</span>
            <div className="flex gap-2">
              {HABIT_COLOR_IDS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-label={`${option} color`}
                  onClick={() => setColor(option)}
                  className={`w-8 h-8 rounded-full ${habitColor(option).swatch} ${
                    color === option ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-slate-900' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Icon</span>
            <div className="flex flex-wrap gap-1.5">
              {HABIT_ICON_IDS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-label={option}
                  onClick={() => setIcon(option)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                    icon === option
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <HabitIcon name={option} className="w-4 h-4" />
                </button>
              ))}
            </div>
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

          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Reminder
              </label>
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(event) => setReminderEnabled(event.target.checked)}
                aria-label="Enable reminder"
                className="w-4 h-4 rounded border-slate-300"
              />
            </div>
            {reminderEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Time</label>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(event) => setReminderTime(event.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Sound</label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={sound}
                      onChange={(event) => setSound(event.target.value as SoundType)}
                      className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-200"
                    >
                      {SOUNDS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      title="Preview sound"
                      onClick={() => audioService.playSound(sound, title || 'Habit reminder')}
                      className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/60"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
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
