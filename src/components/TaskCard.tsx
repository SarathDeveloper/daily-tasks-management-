import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  Repeat,
  Bell,
  ChevronDown,
  ChevronUp,
  Play,
  Pencil,
  Trash2,
  AlertCircle,
  Tag,
  Check,
} from 'lucide-react';
import { Task, Category } from '../types';

interface TaskCardProps {
  task: Task;
  categories: Category[];
  onToggleComplete: (taskId: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onSnoozeTask: (taskId: string, minutes: number) => void;
  onStartFocus: (task: Task) => void;
  onSelectTagFilter?: (tag: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  categories,
  onToggleComplete,
  onToggleSubtask,
  onEditTask,
  onDeleteTask,
  onSnoozeTask,
  onStartFocus,
  onSelectTagFilter,
}) => {
  const [showSubtasks, setShowSubtasks] = useState<boolean>(false);
  const [showActionsMenu, setShowActionsMenu] = useState<boolean>(false);

  // Find category styling
  const categoryObj = categories.find((c) => c.name === task.category);
  const categoryColor = categoryObj ? categoryObj.color : 'bg-slate-700 text-slate-300 border-slate-600';

  // Priority visual indicators
  const priorityConfig = {
    urgent: {
      border: 'border-l-4 border-l-rose-500',
      badge: 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800/80',
      icon: '🔴',
      label: 'Urgent Priority',
    },
    high: {
      border: 'border-l-4 border-l-amber-500',
      badge: 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800/80',
      icon: '🟠',
      label: 'High Priority',
    },
    medium: {
      border: 'border-l-4 border-l-indigo-500',
      badge: 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800/80',
      icon: '🔵',
      label: 'Medium Priority',
    },
    low: {
      border: 'border-l-4 border-l-emerald-500',
      badge: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/80',
      icon: '🟢',
      label: 'Low Priority',
    },
  };

  const pStyle = priorityConfig[task.priority] || priorityConfig.medium;

  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;

  const isSnoozed =
    task.reminder?.snoozedUntil && new Date(task.reminder.snoozedUntil) > new Date();

  return (
    <div
      className={`group relative bg-white dark:bg-slate-800/90 border transition-all duration-200 rounded-2xl shadow-sm overflow-hidden ${pStyle.border} ${
        task.completed
          ? 'border-slate-200 dark:border-slate-800 opacity-60 bg-slate-100/60 dark:bg-slate-900/40'
          : 'border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md'
      }`}
    >
      {/* ── Main content area ── */}
      <div className="px-3 pt-3 pb-2 sm:px-4 sm:pt-4">
        {/* Row 1: Checkbox + Title + Priority */}
        <div className="flex items-start gap-2.5">
          <button
            onClick={() => onToggleComplete(task.id)}
            className="w-7 h-7 min-w-[28px] min-h-[28px] mt-0.5 flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus:outline-none rounded-full active:scale-90 shrink-0"
            title={task.completed ? 'Mark incomplete' : 'Mark complete'}
          >
            {task.completed ? (
              <CheckCircle2 className="w-[22px] h-[22px] text-emerald-500 dark:text-emerald-400 fill-emerald-100 dark:fill-emerald-950" />
            ) : (
              <Circle className="w-[22px] h-[22px] text-slate-300 dark:text-slate-600" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3
                className={`text-[15px] sm:text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug break-words ${
                  task.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''
                }`}
              >
                {task.title}
              </h3>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border flex items-center gap-0.5 shrink-0 mt-0.5 ${pStyle.badge}`}
                title={pStyle.label}
              >
                <span className="text-[9px] leading-none">{pStyle.icon}</span>
                <span>{task.priority}</span>
              </span>
            </div>

            {/* Description */}
            {task.description && (
              <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                {task.description}
              </p>
            )}
          </div>
        </div>

        {/* Row 2: Metadata pills — scrollable on small screens */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5 ml-[38px] sm:ml-[38px]">
          {/* Category Pill */}
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${categoryColor}`}
          >
            {task.category}
          </span>

          {/* Time / Estimated Duration */}
          {task.time && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/40">
              <Clock className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
              <span>{task.time}</span>
              {task.estimatedMinutes ? (
                <span className="text-slate-500 dark:text-slate-400">({task.estimatedMinutes}m)</span>
              ) : null}
            </span>
          )}

          {/* Recurrence Indicator */}
          {task.recurrence?.type && task.recurrence.type !== 'none' && (
            <span
              className="flex items-center gap-1 text-[11px] text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-800/40"
              title={`Recurring: ${task.recurrence.type}`}
            >
              <Repeat className="w-3 h-3 text-teal-500 dark:text-teal-400" />
              <span className="capitalize">{task.recurrence.type}</span>
            </span>
          )}

          {/* Reminder Chime Indicator */}
          {task.reminder?.enabled && (
            <span
              className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border ${
                isSnoozed
                  ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50'
                  : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/40'
              }`}
              title={
                isSnoozed
                  ? `Snoozed until ${new Date(task.reminder.snoozedUntil!).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : `Reminder sound: ${task.reminder.sound}`
              }
            >
              <Bell className="w-3 h-3" />
              <span>{isSnoozed ? 'Snoozed' : task.reminder.sound}</span>
            </span>
          )}
        </div>

        {/* Subtasks Bar / Trigger */}
        {task.subtasks.length > 0 && (
          <div className="mt-2.5 ml-[38px]">
            <button
              onClick={() => setShowSubtasks(!showSubtasks)}
              className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 font-semibold py-0.5"
            >
              {showSubtasks ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>
                Checklist ({completedSubtasks}/{task.subtasks.length})
              </span>
              {/* Mini progress bar */}
              <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden ml-1">
                <div
                  className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-300"
                  style={{
                    width: `${(completedSubtasks / task.subtasks.length) * 100}%`,
                  }}
                />
              </div>
            </button>

            {/* Subtasks List */}
            {showSubtasks && (
              <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-slate-200 dark:border-slate-700">
                {task.subtasks.map((sub) => (
                  <label
                    key={sub.id}
                    className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer py-0.5"
                  >
                    <input
                      type="checkbox"
                      checked={sub.completed}
                      onChange={() => onToggleSubtask(task.id, sub.id)}
                      className="rounded bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <span className={sub.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''}>
                      {sub.title}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-2 ml-[38px]">
            {task.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onSelectTagFilter && onSelectTagFilter(tag)}
                className="text-[10px] text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 bg-slate-100 dark:bg-slate-900/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/80 border border-slate-200 dark:border-slate-700/60 px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-colors"
                title={`Filter by tag #${tag}`}
              >
                <Tag className="w-2.5 h-2.5 text-indigo-500 dark:text-indigo-400" />
                <span>#{tag}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom action bar ── */}
      <div className="flex items-center justify-end gap-0.5 px-2 py-1.5 sm:px-3 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/30">
        {/* Start Focus Timer */}
        {!task.completed && (
          <button
            onClick={() => onStartFocus(task)}
            className="h-8 px-2.5 flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors active:scale-95"
            title="Start Focus Timer for this Task"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Focus</span>
          </button>
        )}

        {/* Edit Task */}
        <button
          onClick={() => onEditTask(task)}
          className="h-8 px-2.5 flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors active:scale-95"
          title="Edit Task"
        >
          <Pencil className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Edit</span>
        </button>

        {/* Quick Snooze +15m if task has reminder */}
        {task.reminder?.enabled && !task.completed && (
          <button
            onClick={() => onSnoozeTask(task.id, 15)}
            className="h-8 px-2.5 flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors active:scale-95"
            title="Snooze 15 minutes"
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Snooze</span>
          </button>
        )}

        {/* Delete Task */}
        <button
          onClick={() => onDeleteTask(task.id)}
          className="h-8 px-2.5 flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors active:scale-95"
          title="Delete Task"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Delete</span>
        </button>
      </div>
    </div>
  );
};
