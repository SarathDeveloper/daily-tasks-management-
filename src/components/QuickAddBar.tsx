import React, { useMemo, useState } from 'react';
import { CornerDownLeft, Sparkles } from 'lucide-react';
import type { Category, Task } from '../types';
import { describeQuickAdd, parseQuickAdd } from '../lib/quickAdd';
import { Card } from './ui/Card';

interface QuickAddBarProps {
  categories: Category[];
  /** Date used when the text names none (the day open in the planner). */
  defaultDate: string;
  onAdd: (partial: Partial<Task>) => void;
}

/** One-line task entry: "Pay rent every 5th at 9am #home !high". */
export const QuickAddBar: React.FC<QuickAddBarProps> = ({ categories, defaultDate, onAdd }) => {
  const [text, setText] = useState('');
  const parsed = useMemo(
    () => (text.trim() ? parseQuickAdd(text, { categories, defaultDate }) : null),
    [text, categories, defaultDate]
  );
  const chips = parsed ? describeQuickAdd(parsed) : [];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!parsed?.title) return;
    onAdd({
      title: parsed.title,
      date: parsed.date,
      time: parsed.time,
      priority: parsed.priority,
      category: parsed.category,
      tags: parsed.tags,
      estimatedMinutes: parsed.estimatedMinutes,
      recurrence: parsed.recurrence,
    });
    setText('');
  };

  return (
    <Card className="p-2.5">
      <form onSubmit={submit} className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 ml-1 text-indigo-500 dark:text-indigo-400 shrink-0" aria-hidden />
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Quick add: Pay rent every 5th at 9am #personal !high"
          aria-label="Quick add a task"
          enterKeyHint="done"
          className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none py-1.5"
        />
        <button
          type="submit"
          disabled={!parsed?.title}
          aria-label="Add task"
          className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700 transition-colors"
        >
          <CornerDownLeft className="w-4 h-4" />
        </button>
      </form>
      {parsed && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2 px-1" aria-live="polite">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 mr-1 truncate max-w-full">
            {parsed.title || 'Add a title'}
          </span>
          {chips.map((chip) => (
            <span
              key={chip}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
            >
              {chip}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
};
