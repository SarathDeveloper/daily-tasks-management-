import React from 'react';
import { Bell, Check, Clock, X, ShieldAlert, Volume2 } from 'lucide-react';
import { Task } from '../types';

interface NotificationBannerProps {
  permissionStatus: NotificationPermission | 'unsupported';
  onRequestPermission: () => void;
  activeAlert: { task: Task; triggeredAt: Date } | null;
  onDismissAlert: () => void;
  onCompleteAlertTask: (taskId: string) => void;
  onSnoozeAlertTask: (taskId: string, minutes: number) => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  permissionStatus,
  onRequestPermission,
  activeAlert,
  onDismissAlert,
  onCompleteAlertTask,
  onSnoozeAlertTask,
}) => {
  return (
    <>
      {/* Triggered Alarm Alert Overlay Modal */}
      {activeAlert && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4 animate-in slide-in-from-top duration-300">
          <div className="bg-white dark:bg-slate-900 border-2 border-indigo-400 dark:border-indigo-500 text-slate-900 dark:text-slate-100 rounded-2xl p-4 shadow-2xl shadow-indigo-500/20 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600 text-white animate-bounce">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                    Task Reminder Alert
                  </span>
                  <h4 className="font-bold text-base text-slate-900 dark:text-white">{activeAlert.task.title}</h4>
                </div>
              </div>

              <button
                onClick={onDismissAlert}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeAlert.task.description && (
              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 pl-10">
                {activeAlert.task.description}
              </p>
            )}

            {/* Quick Alert Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => onCompleteAlertTask(activeAlert.task.id)}
                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-md shadow-emerald-600/20"
              >
                <Check className="w-4 h-4" />
                <span>Mark Done</span>
              </button>

              <button
                onClick={() => onSnoozeAlertTask(activeAlert.task.id, 5)}
                className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Snooze 5m</span>
              </button>

              <button
                onClick={() => onSnoozeAlertTask(activeAlert.task.id, 15)}
                className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>15m</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permission Request Banner */}
      {permissionStatus !== 'granted' && permissionStatus !== 'unsupported' && (
        <div className="bg-gradient-to-r from-indigo-50 via-white to-white dark:from-indigo-950/90 dark:via-slate-900 dark:to-slate-900 border-b border-indigo-200 dark:border-indigo-800/40 px-3 sm:px-4 py-2 sm:py-2.5 text-xs">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-2">
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-200">
              <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
              <span className="text-[11px] sm:text-xs leading-snug">
                <strong>Enable Notifications:</strong> Get real-time audio chimes and popups for task reminders.
              </span>
            </div>

            <button
              onClick={onRequestPermission}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] sm:text-xs transition-colors flex items-center gap-1 shadow-sm self-stretch sm:self-auto justify-center"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Enable Reminders</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
