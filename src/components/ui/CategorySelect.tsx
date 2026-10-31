import React, { useEffect, useState } from 'react';
import { ADD_CATEGORY_VALUE, normalizeCategoryName } from '../../data/financeCategories';

interface CategorySelectProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  /** Return an error message, or null after the name is saved. */
  onAdd: (name: string) => string | null;
  /** Shown only for a category the user added. */
  canDelete?: boolean;
  onDelete?: () => void;
  className?: string;
}

export const CategorySelect: React.FC<CategorySelectProps> = ({
  value,
  options,
  onChange,
  onAdd,
  canDelete = false,
  onDelete,
  className,
}) => {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const optionKey = options.join('\n');
  const canonical = options.find((name) => name.toLowerCase() === value.toLowerCase());
  const listed = !value || canonical ? options : [value, ...options];

  useEffect(() => {
    setAdding(false);
    setDraft('');
    setError(null);
  }, [optionKey]);

  const commit = () => {
    const message = onAdd(draft);
    if (message) {
      setError(message);
      return;
    }
    onChange(normalizeCategoryName(draft));
    setDraft('');
    setError(null);
    setAdding(false);
  };

  return (
    <div className="space-y-1.5">
      <select
        value={canonical ?? (listed.includes(value) ? value : listed[0] ?? '')}
        onChange={(e) => {
          if (e.target.value === ADD_CATEGORY_VALUE) {
            setAdding(true);
            setDraft('');
            setError(null);
            return;
          }
          setAdding(false);
          setError(null);
          onChange(e.target.value);
        }}
        className={className}
      >
        {listed.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        <option value={ADD_CATEGORY_VALUE}>Add category</option>
      </select>
      {adding && (
        <div className="flex gap-1.5">
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
            }}
            placeholder="New category"
            aria-label="New category"
            autoFocus
            className="min-w-0 flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={commit}
            className="shrink-0 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            Add
          </button>
        </div>
      )}
      {canDelete && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline"
        >
          Remove {value}
        </button>
      )}
      {error && <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
};
