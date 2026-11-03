import React, { useEffect, useState } from 'react';
import { Clock, Plus, CheckCircle2, Circle, Play, Move, X, Timer } from 'lucide-react';
import { Task, Category } from '../types';
import { todayString } from '../lib/ledger';
import { blockLabel, currentBlock, droppedTime, timelineHours } from '../lib/timeBlocks';

interface TimelineViewProps {
  selectedDate: string;
  tasks: Task[];
  categories: Category[];
  onToggleComplete: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onQuickAddTaskAtTime: (timeStr: string) => void;
  /** `minutes` sets the focus timer, e.g. what is left of the current block. */
  onStartFocus: (task: Task, minutes?: number) => void;
  onRescheduleTask: (taskId: string, time: string) => void;
}

const DRAG_TYPE = 'text/plain';

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  selectedDate,
  tasks,
  categories,
  onToggleComplete,
  onEditTask,
  onQuickAddTaskAtTime,
  onStartFocus,
  onRescheduleTask,
}) => {
  const dateTasks = tasks.filter((t) => t.date === selectedDate);
  const hours = timelineHours(dateTasks);
  // Tap "Move" then tap an hour: drag and drop does not work on touch screens.
  const [movingId, setMovingId] = useState<string | null>(null);
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);

  const now = useNow();
  const isToday = selectedDate === todayString(now);
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const running = isToday ? currentBlock<Task>(dateTasks, currentHour * 60 + currentMinute) : null;
  const movingTask = movingId ? dateTasks.find((t) => t.id === movingId) : undefined;

  useEffect(() => {
    setMovingId(null);
  }, [selectedDate]);

  const moveTo = (taskId: string, hour: number) => {
    const task = dateTasks.find((t) => t.id === taskId);
    if (!task) return;
    const time = droppedTime(task.time, hour);
    if (time !== task.time) onRescheduleTask(taskId, time);
    setMovingId(null);
    setDragOverHour(null);
  };

  const getCategoryColor = (catName: string) => {
    const found = categories.find((c) => c.name === catName);
    return found ? found.color : 'bg-slate-700 text-slate-300 border-slate-600';
  };

  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="space-y-4 max-w-4xl lg:max-w-6xl mx-auto pb-20 lg:pb-8">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm transition-colors">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Time-Blocked Schedule</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {formattedDate} · drag a block, or tap Move, to change its hour
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
            {dateTasks.filter((t) => t.completed).length} of {dateTasks.length} Completed
          </span>
          <div className="w-32 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-300"
              style={{
                width: dateTasks.length > 0 ? `${(dateTasks.filter((t) => t.completed).length / dateTasks.length) * 100}%` : '0%',
              }}
            />
          </div>
        </div>
      </div>

      {/* The block running right now */}
      {running && (
        <div className="bg-indigo-600 text-white rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-100">Now · {blockLabel(running.task)}</p>
            <p className="text-sm font-bold truncate">{running.task.title}</p>
            <p className="text-xs text-indigo-100">{running.minutesLeft} min left in this block</p>
          </div>
          <button
            type="button"
            onClick={() => onStartFocus(running.task, running.minutesLeft)}
            className="h-9 px-3 rounded-xl bg-white text-indigo-700 text-xs font-bold flex items-center gap-1.5 hover:bg-indigo-50 active:scale-95"
          >
            <Timer className="w-4 h-4" />
            Focus for {running.minutesLeft} min
          </button>
        </div>
      )}

      {/* Tap-to-move hint */}
      {movingTask && (
        <div className="sticky top-2 z-20 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-200">
          <span className="truncate">
            Moving <strong>{movingTask.title}</strong> — tap an hour below
          </span>
          <button
            type="button"
            onClick={() => setMovingId(null)}
            className="p-1 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900"
            aria-label="Cancel move"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Timeline Grid */}
      <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 sm:ml-12 pl-4 sm:pl-6 space-y-6">
        {hours.map((hour) => {
          const hourFormatted = hour < 10 ? `0${hour}:00` : `${hour}:00`;
          const displayLabel =
            hour === 0
              ? '12:00 AM'
              : hour === 12
              ? '12:00 PM'
              : hour > 12
              ? `${hour - 12}:00 PM`
              : `${hour}:00 AM`;

          // Filter tasks starting in this hour block (e.g. 08:00 to 08:59)
          const hourTasks = dateTasks
            .filter((t) => {
              if (!t.time) return false;
              const taskH = parseInt(t.time.split(':')[0], 10);
              return taskH === hour;
            })
            .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

          const isCurrentHourSlot = isToday && currentHour === hour;
          const isDropTarget = dragOverHour === hour;

          return (
            <div
              key={hour}
              className={`relative group rounded-xl transition-colors ${
                isDropTarget ? 'bg-indigo-50 dark:bg-indigo-950/40 ring-2 ring-indigo-400' : ''
              }`}
              onDragOver={(event) => {
                if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                if (dragOverHour !== hour) setDragOverHour(hour);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDragOverHour((current) => (current === hour ? null : current));
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData(DRAG_TYPE);
                if (id) moveTo(id, hour);
              }}
            >
              {/* Hour Node Dot */}
              <div
                className={`absolute -left-[21px] sm:-left-[31px] top-1 w-3.5 h-3.5 rounded-full border-2 transition-all ${
                  isCurrentHourSlot
                    ? 'bg-indigo-600 border-white ring-4 ring-indigo-500/30 scale-125'
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 group-hover:border-indigo-500'
                }`}
              />

              {/* Hour Time Tag */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-bold font-mono tracking-tight ${
                    isCurrentHourSlot ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {displayLabel}
                </span>

                {movingTask ? (
                  <button
                    onClick={() => moveTo(movingTask.id, hour)}
                    className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 min-h-[32px] rounded-lg border border-amber-200 dark:border-amber-800/40 font-semibold active:scale-95"
                  >
                    <Move className="w-3.5 h-3.5" />
                    <span>Move here ({droppedTime(movingTask.time, hour)})</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onQuickAddTaskAtTime(hourFormatted)}
                    className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 min-h-[32px] rounded-lg border border-indigo-200 dark:border-indigo-800/40 font-semibold active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add at {hourFormatted}</span>
                  </button>
                )}
              </div>

              {/* Current Time Indicator Line */}
              {isCurrentHourSlot && (
                <div
                  className="absolute left-0 right-0 border-b-2 border-indigo-500 z-10 flex items-center pointer-events-none"
                  style={{ top: `${(currentMinute / 60) * 100}%` }}
                >
                  <span className="text-[9px] bg-indigo-600 text-white font-bold px-1 rounded -mt-2.5 shadow-sm">
                    NOW
                  </span>
                </div>
              )}

              {/* Hour Tasks Cards */}
              {hourTasks.length > 0 ? (
                <div className="space-y-2 mt-2">
                  {hourTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable={!task.completed}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(DRAG_TYPE, task.id);
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => setDragOverHour(null)}
                      className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 shadow-sm ${
                        task.completed
                          ? 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 cursor-grab active:cursor-grabbing'
                      } ${movingId === task.id ? 'ring-2 ring-amber-400' : ''} ${
                        running?.task.id === task.id ? 'border-indigo-400 dark:border-indigo-500' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <button
                          onClick={() => onToggleComplete(task.id)}
                          className="mt-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                        >
                          {task.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                          ) : (
                            <Circle className="w-5 h-5" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${getCategoryColor(
                                task.category
                              )}`}
                            >
                              {task.category}
                            </span>
                            <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-300 font-semibold">
                              {blockLabel(task)}
                            </span>
                          </div>
                          <p
                            onClick={() => onEditTask(task)}
                            className={`text-sm font-semibold cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-300 text-slate-900 dark:text-slate-100 ${
                              task.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''
                            }`}
                          >
                            {task.title}
                          </p>
                        </div>
                      </div>

                      {!task.completed && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={() => setMovingId(movingId === task.id ? null : task.id)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/80"
                            title="Move to another hour"
                            aria-label={`Move ${task.title} to another hour`}
                          >
                            <Move className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onStartFocus(task)}
                            className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700/80"
                            title="Focus Task"
                          >
                            <Play className="w-4 h-4 fill-current" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : movingTask ? (
                <div
                  onClick={() => moveTo(movingTask.id, hour)}
                  className="h-9 border border-dashed border-amber-300 dark:border-amber-800 rounded-xl flex items-center justify-center text-amber-700 dark:text-amber-300 cursor-pointer text-xs"
                >
                  <span>Move here</span>
                </div>
              ) : (
                <div
                  onClick={() => onQuickAddTaskAtTime(hourFormatted)}
                  className="h-9 border border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-600 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-600 dark:hover:text-slate-400 cursor-pointer text-xs transition-colors bg-white/40 dark:bg-transparent"
                >
                  <span>{isDropTarget ? 'Drop here' : '+ Tap to block time'}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
