import React, { useEffect, useState } from 'react';
import { Flame, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import type { Goal, Habit, HabitCheckIn } from '../types';
import { formatShortDate } from '../lib/dateFormat';
import { goalProgress, todayDateString } from '../lib/habits';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { GoalModal } from './GoalModal';
import { HabitModal } from './HabitModal';

interface GoalsViewProps {
  goals: Goal[];
  habits: Habit[];
  checkIns: HabitCheckIn[];
  onSaveGoal: (goal: Partial<Goal>) => void;
  onDeleteGoal: (id: string) => void;
  onSaveHabit: (habit: Partial<Habit>) => void;
  onLinkHabit: (habitId: string, goalId?: string) => void;
  onRegisterClose: (close: (() => void) | null) => void;
  localMusicName?: string;
}

const STATUS_LABEL: Record<Goal['status'], string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
};

export const GoalsView: React.FC<GoalsViewProps> = ({
  goals,
  habits,
  checkIns,
  onSaveGoal,
  onDeleteGoal,
  onSaveHabit,
  onLinkHabit,
  onRegisterClose,
  localMusicName,
}) => {
  const today = todayDateString();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [creatingGoal, setCreatingGoal] = useState(false);
  const [habitGoalId, setHabitGoalId] = useState<string | undefined>(undefined);
  const [creatingHabit, setCreatingHabit] = useState(false);
  const goalModalOpen = creatingGoal || editingGoal !== null;

  useEffect(() => {
    if (creatingHabit) {
      onRegisterClose(() => setCreatingHabit(false));
      return () => onRegisterClose(null);
    }
    if (goalModalOpen) {
      onRegisterClose(() => {
        setCreatingGoal(false);
        setEditingGoal(null);
      });
      return () => onRegisterClose(null);
    }
    onRegisterClose(null);
  }, [creatingHabit, goalModalOpen, onRegisterClose]);

  return (
    <div className="max-w-4xl lg:max-w-6xl mx-auto space-y-5 pb-24 lg:pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            Goals
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            A goal moves forward when its daily habits are checked.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setEditingGoal(null);
            setCreatingGoal(true);
          }}
        >
          <Plus className="w-4 h-4" />
          Add
        </Button>
      </div>

      {goals.length === 0 && (
        <Card className="p-8 text-center">
          <Target className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No goals yet</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
            Add a goal, then link a daily habit. Checking that habit fills the goal.
          </p>
          <div className="mt-4">
            <Button variant="primary" size="sm" onClick={() => setCreatingGoal(true)}>
              <Plus className="w-4 h-4" />
              Add a goal
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {goals.map((goal) => {
          const progress = goalProgress(goal, habits, checkIns, today);
          const linked = habits.filter((habit) => habit.goalId === goal.id && !habit.archived);
          const available = habits.filter((habit) => !habit.archived && habit.goalId !== goal.id);
          const expanded = expandedId === goal.id;
          const paused = goal.status === 'paused';

          return (
            <Card key={goal.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : goal.id)}
                  className="min-w-0 text-left flex-1"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-sm text-slate-900 dark:text-white">{goal.title}</p>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        goal.status === 'active'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                          : goal.status === 'paused'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {STATUS_LABEL[goal.status]}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {formatShortDate(goal.startDate)} – {formatShortDate(goal.targetDate)}
                  </p>
                  {goal.note && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{goal.note}</p>
                  )}
                </button>
                <div className="text-right shrink-0">
                  {paused ? (
                    <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Paused</p>
                  ) : (
                    <>
                      <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                        {progress.percent}%
                      </p>
                      {progress.streak > 0 && (
                        <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          <Flame className="w-3.5 h-3.5" />
                          {progress.streak}d
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {!paused && (
                <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-violet-600 rounded-full"
                    style={{ width: `${Math.min(100, progress.percent)}%` }}
                  />
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {linked.length === 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Link a daily habit to track this goal.
                  </span>
                )}
                {linked.map((habit) => (
                  <span
                    key={habit.id}
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                  >
                    {habit.title}
                  </span>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setCreatingGoal(false);
                    setEditingGoal(goal);
                  }}
                  aria-label={`Edit ${goal.title}`}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm(`Delete goal "${goal.title}"? Linked habits will stay.`)) return;
                    onDeleteGoal(goal.id);
                  }}
                  aria-label={`Delete ${goal.title}`}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {expanded && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  {linked.map((habit) => (
                    <div key={habit.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-800 dark:text-slate-200 truncate">{habit.title}</span>
                      <Button variant="ghost" size="sm" onClick={() => onLinkHabit(habit.id, undefined)}>
                        Unlink
                      </Button>
                    </div>
                  ))}
                  {available.length > 0 && (
                    <select
                      value=""
                      onChange={(event) => {
                        if (event.target.value) onLinkHabit(event.target.value, goal.id);
                      }}
                      className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white min-h-[40px]"
                    >
                      <option value="">Link an existing habit</option>
                      {available.map((habit) => (
                        <option key={habit.id} value={habit.id}>
                          {habit.title}
                          {habit.goalId ? ' (move)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setHabitGoalId(goal.id);
                      setCreatingHabit(true);
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    New habit for this goal
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <GoalModal
        isOpen={goalModalOpen}
        onClose={() => {
          setCreatingGoal(false);
          setEditingGoal(null);
        }}
        onSave={onSaveGoal}
        initialGoal={editingGoal}
      />
      <HabitModal
        isOpen={creatingHabit}
        onClose={() => setCreatingHabit(false)}
        onSave={onSaveHabit}
        goals={goals}
        defaultGoalId={habitGoalId}
        localMusicName={localMusicName}
      />
    </div>
  );
};
