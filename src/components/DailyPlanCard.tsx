import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Moon, Sunrise, Target } from 'lucide-react';
import type { DiaryEntry, DiaryMood, Task } from '../types';
import { DIARY_MOODS } from '../lib/diary';
import {
  TOP_PICKS,
  loadDailyPlan,
  planCandidates,
  planPhase,
  resolveTopTasks,
  saveDailyPlan,
  tomorrowOf,
  unfinishedToday,
  type DailyPlanState,
} from '../lib/dailyPlan';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface DailyPlanCardProps {
  tasks: Task[];
  today: string;
  onToggleComplete: (taskId: string) => void;
  onRescheduleTasks: (taskIds: string[], change: { date?: string; time?: string }) => void;
  onSaveDiaryEntry: (partial: Partial<DiaryEntry>) => boolean;
}

const MOOD_EMOJI: Record<DiaryMood, string> = { great: '😄', good: '🙂', okay: '😐', low: '😕', rough: '😣' };
const GROUP_LIMIT = 5;

function useHour(): number {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const timer = window.setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return hour;
}

function dayLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === tomorrowOf(today)) return 'Tomorrow';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

const rowClass =
  'w-full flex items-center gap-2.5 text-left rounded-xl px-2.5 py-2 text-sm transition-colors';

/** Morning: pick today's top 3. Evening: move what is left and write one line. */
export const DailyPlanCard: React.FC<DailyPlanCardProps> = ({
  tasks,
  today,
  onToggleComplete,
  onRescheduleTasks,
  onSaveDiaryEntry,
}) => {
  const hour = useHour();
  const [plan, setPlan] = useState<DailyPlanState>(() => loadDailyPlan(today));
  const [picked, setPicked] = useState<string[]>([]);
  const [carryOver, setCarryOver] = useState<string[] | null>(null);
  const [mood, setMood] = useState<DiaryMood>('good');
  const [note, setNote] = useState('');

  useEffect(() => {
    setPlan(loadDailyPlan(today));
    setPicked([]);
    setCarryOver(null);
  }, [today]);

  const update = (next: DailyPlanState) => {
    setPlan(next);
    saveDailyPlan(next);
  };

  const candidates = useMemo(() => planCandidates(tasks, today), [tasks, today]);
  const unfinished = useMemo(() => unfinishedToday(tasks, today), [tasks, today]);
  const topTasks = resolveTopTasks(plan, tasks);
  const phase = planPhase(plan, hour);

  if (phase === 'morning') {
    const groups: [string, Task[]][] = [
      ['Overdue', candidates.overdue],
      ['Today', candidates.today],
      ['Next few days', candidates.upcoming],
    ];
    if (groups.every(([, list]) => list.length === 0)) return null;

    const toggle = (id: string) =>
      setPicked((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : prev.length >= TOP_PICKS ? prev : [...prev, id]
      );

    const commit = () => {
      const notToday = picked.filter((id) => tasks.find((task) => task.id === id)?.date !== today);
      if (notToday.length > 0) onRescheduleTasks(notToday, { date: today });
      update({ ...plan, topTaskIds: picked, planned: true });
      setPicked([]);
    };

    return (
      <Card className="p-4 space-y-3">
        <div className="flex items-start gap-2.5">
          <Sunrise className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Plan your day</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pick up to {TOP_PICKS} tasks to focus on. Overdue or upcoming picks move to today.
            </p>
          </div>
        </div>

        {groups.map(([label, list]) =>
          list.length === 0 ? null : (
            <div key={label}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                {label}
              </p>
              <div className="space-y-1">
                {list.slice(0, GROUP_LIMIT).map((task) => {
                  const selected = picked.includes(task.id);
                  const full = !selected && picked.length >= TOP_PICKS;
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => toggle(task.id)}
                      disabled={full}
                      aria-pressed={selected}
                      className={`${rowClass} ${
                        selected
                          ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-900 dark:text-indigo-100'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 disabled:opacity-40'
                      }`}
                    >
                      {selected ? (
                        <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="flex-1 min-w-0 truncate">{task.title}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                        {label === 'Today' ? task.time : dayLabel(task.date, today)}
                      </span>
                    </button>
                  );
                })}
                {list.length > GROUP_LIMIT && (
                  <p className="text-[11px] text-slate-400 px-2.5">and {list.length - GROUP_LIMIT} more</p>
                )}
              </div>
            </div>
          )
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button type="button" size="sm" onClick={commit} disabled={picked.length === 0}>
            Set my top {picked.length || TOP_PICKS}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => update({ ...plan, planned: true })}>
            Not today
          </Button>
        </div>
      </Card>
    );
  }

  if (phase === 'planned') {
    if (topTasks.length === 0) return null;
    const done = topTasks.filter((task) => task.completed).length;
    return (
      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Today&apos;s top {topTasks.length}
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {done}/{topTasks.length} done
            </span>
          </h3>
          <button
            type="button"
            onClick={() => update({ ...plan, planned: false })}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Change
          </button>
        </div>
        {topTasks.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => onToggleComplete(task.id)}
            className={`${rowClass} hover:bg-slate-50 dark:hover:bg-slate-800/60`}
          >
            {task.completed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-slate-400 shrink-0" />
            )}
            <span
              className={`flex-1 min-w-0 truncate ${
                task.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100'
              }`}
            >
              {task.title}
            </span>
            {task.date !== today && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{dayLabel(task.date, today)}</span>
            )}
          </button>
        ))}
      </Card>
    );
  }

  if (phase === 'evening') {
    const doneToday = tasks.filter((task) => task.date === today && task.completed).length;
    const totalToday = tasks.filter((task) => task.date === today).length;
    const moving = carryOver ?? unfinished.map((task) => task.id);

    const finish = () => {
      if (note.trim() && !onSaveDiaryEntry({ date: today, mood, body: note.trim() })) return;
      const ids = moving.filter((id) => unfinished.some((task) => task.id === id));
      if (ids.length > 0) onRescheduleTasks(ids, { date: tomorrowOf(today) });
      update({ ...plan, reviewed: true });
      setNote('');
      setCarryOver(null);
    };

    return (
      <Card className="p-4 space-y-3">
        <div className="flex items-start gap-2.5">
          <Moon className="w-5 h-5 text-indigo-500 dark:text-indigo-300 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Evening review</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {totalToday === 0
                ? 'Nothing was planned today.'
                : `You finished ${doneToday} of ${totalToday} tasks today.`}
            </p>
          </div>
        </div>

        {unfinished.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Move to tomorrow
            </p>
            <div className="space-y-1">
              {unfinished.map((task) => {
                const selected = moving.includes(task.id);
                return (
                  <label
                    key={task.id}
                    className={`${rowClass} cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() =>
                        setCarryOver(selected ? moving.filter((id) => id !== task.id) : [...moving, task.id])
                      }
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <span className="flex-1 min-w-0 truncate">{task.title}</span>
                    {task.time && <span className="text-[11px] text-slate-500 dark:text-slate-400">{task.time}</span>}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            One line for your diary
          </p>
          <div className="flex gap-1 mb-2" role="radiogroup" aria-label="Mood">
            {DIARY_MOODS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={mood === item.id}
                aria-label={item.label}
                title={item.label}
                onClick={() => setMood(item.id)}
                className={`w-9 h-9 rounded-xl text-lg transition-colors ${
                  mood === item.id
                    ? 'bg-indigo-100 dark:bg-indigo-500/25 ring-2 ring-indigo-400'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {MOOD_EMOJI[item.id]}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="How did today go?"
            aria-label="Diary note for today"
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={finish}>
            {moving.length > 0 ? `Move ${moving.length} & finish` : 'Finish review'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => update({ ...plan, reviewed: true })}>
            Skip
          </Button>
        </div>
      </Card>
    );
  }

  return null;
};
