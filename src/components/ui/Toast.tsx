import React, { useEffect } from 'react';
import { X, Undo2 } from 'lucide-react';

interface ToastProps {
  message: string;
  onUndo?: () => void;
  onDismiss: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  onUndo,
  onDismiss,
  duration = 5000,
}) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-8 z-50 max-w-md w-[calc(100%-2rem)] animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-slate-900 dark:bg-slate-800 text-white border border-slate-700 dark:border-slate-700 rounded-2xl shadow-2xl px-4 py-3 flex items-center justify-between gap-3">
        <span className="text-xs font-medium flex-1 truncate">{message}</span>
        <div className="flex items-center gap-1 shrink-0">
          {onUndo && (
            <button
              type="button"
              onClick={onUndo}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 transition-colors active:scale-95"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
