import React from 'react';
import { Clock, Plus, CheckCircle2, Circle, Play } from 'lucide-react';
import { Task, Category } from '../types';

interface TimelineViewProps {
  selectedDate: string;
  tasks: Task[];
  categories: Category[];
  onToggleComplete: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onQuickAddTaskAtTime: (timeStr: string) => void;
  onStartFocus: (task: Task) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  selectedDate,
  tasks,
  categories,
  onToggleComplete,
  onEditTask,
  onQuickAddTaskAtTime,
  onStartFocus,
}) => {
  const dateTasks = tasks.filter((t) => t.date === selectedDate);

  // Hours from 06:00 to 22:00
  const hours = Array.from({ length: 17 }, (_, i) => i + 6);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const isToday = selectedDate === todayStr;
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

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
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{formattedDate}</p>
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

      {/* Timeline Grid */}
      <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 sm:ml-12 pl-4 sm:pl-6 space-y-6">
        {hours.map((hour) => {
          const hourFormatted = hour < 10 ? `0${hour}:00` : `${hour}:00`;
          const displayLabel =
            hour === 12
              ? '12:00 PM'
              : hour > 12
              ? `${hour - 12}:00 PM`
              : `${hour}:00 AM`;

          // Filter tasks starting in this hour block (e.g. 08:00 to 08:59)
          const hourTasks = dateTasks.filter((t) => {
            if (!t.time) return false;
            const taskH = parseInt(t.time.split(':')[0], 10);
            return taskH === hour;
          });

          const isCurrentHourSlot = isToday && currentHour === hour;

          return (
            <div key={hour} className="relative group">
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

                {/* Quick Add at this hour */}
                <button
                  onClick={() => onQuickAddTaskAtTime(hourFormatted)}
                  className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 min-h-[32px] rounded-lg border border-indigo-200 dark:border-indigo-800/40 font-semibold active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add at {hourFormatted}</span>
                </button>
              </div>

              {/* Current Time Indicator Line */}
              {isCurrentHourSlot && (
                <div
                  className="absolute left-0 right-0 border-b-2 border-indigo-500 z-10 flex items-center"
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
                      className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 shadow-sm ${
                        task.completed
                          ? 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
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
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${getCategoryColor(
                                task.category
                              )}`}
                            >
                              {task.category}
                            </span>
                            <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-300 font-semibold">
                              {task.time}
                            </span>
                            {task.estimatedMinutes && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                ({task.estimatedMinutes}m)
                              </span>
                            )}
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
                        <button
                          onClick={() => onStartFocus(task)}
                          className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700/80"
                          title="Focus Task"
                        >
                          <Play className="w-4 h-4 fill-current" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  onClick={() => onQuickAddTaskAtTime(hourFormatted)}
                  className="h-9 border border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-600 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-600 dark:hover:text-slate-400 cursor-pointer text-xs transition-colors bg-white/40 dark:bg-transparent"
                >
                  <span>+ Tap to block time</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
