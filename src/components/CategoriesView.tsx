import React, { useState } from 'react';
import { Plus, Tag as TagIcon, Folder, Trash2, Filter, Hash, Check } from 'lucide-react';
import { Category, Task } from '../types';

interface CategoriesViewProps {
  categories: Category[];
  tasks: Task[];
  onAddCategory: (category: Category) => void;
  onDeleteCategory?: (catId: string) => void;
  onSelectCategoryFilter: (catName: string) => void;
  onSelectTagFilter?: (tagName: string) => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  categories,
  tasks,
  onAddCategory,
  onDeleteCategory,
  onSelectCategoryFilter,
  onSelectTagFilter,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'categories' | 'tags'>('categories');
  const [showAdd, setShowAdd] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/40');

  const [newCustomTag, setNewCustomTag] = useState('');

  const colorOptions = [
    { label: 'Indigo', value: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/40' },
    { label: 'Emerald', value: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/40' },
    { label: 'Rose', value: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/40' },
    { label: 'Amber', value: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/40' },
    { label: 'Sky', value: 'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/40' },
    { label: 'Purple', value: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/40' },
    { label: 'Teal', value: 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-500/40' },
  ];

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    onAddCategory({
      id: `cat-${Date.now()}`,
      name: newCatName.trim(),
      color: newCatColor,
      icon: 'Tag',
    });

    setNewCatName('');
    setShowAdd(false);
  };

  // Extract all unique tags across tasks
  const allUniqueTags = Array.from(
    new Set(tasks.flatMap((t) => t.tags || []).filter(Boolean))
  ).sort();

  return (
    <div className="max-w-4xl lg:max-w-6xl mx-auto space-y-6 pb-20 lg:pb-8">
      {/* View Selector Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('categories')}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors ${
              activeSubTab === 'categories'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Folder className="w-4 h-4" />
            <span>Categories ({categories.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('tags')}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors ${
              activeSubTab === 'tags'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <TagIcon className="w-4 h-4" />
            <span>Tags ({allUniqueTags.length})</span>
          </button>
        </div>

        {activeSubTab === 'categories' && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>New Category</span>
          </button>
        )}
      </div>

      {/* CATEGORIES SUBTAB */}
      {activeSubTab === 'categories' && (
        <div className="space-y-6">
          {/* Add Category Form */}
          {showAdd && (
            <form
              onSubmit={handleCreateCategory}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3 animate-in fade-in shadow-sm"
            >
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Create Custom Category</h3>
              <input
                type="text"
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Category name (e.g. Health, Finance, Projects)..."
                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">Color Theme</label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => setNewCatColor(c.value)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border ${c.value} ${
                        newCatColor === c.value ? 'ring-2 ring-indigo-600 scale-105' : 'opacity-80'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-md"
                >
                  Save Category
                </button>
              </div>
            </form>
          )}

          {/* Category Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const catTasks = tasks.filter((t) => t.category === cat.name);
              const completedCount = catTasks.filter((t) => t.completed).length;
              const percent =
                catTasks.length > 0 ? Math.round((completedCount / catTasks.length) * 100) : 0;

              return (
                <div
                  key={cat.id}
                  className="bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 transition-all shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${cat.color}`}>
                        {cat.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{catTasks.length} tasks</span>
                        {onDeleteCategory && categories.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete category "${cat.name}"?`)) {
                                onDeleteCategory(cat.id);
                              }
                            }}
                            className="text-slate-400 hover:text-rose-500 p-1"
                            title="Delete category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 mb-4">
                      <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                        <span>Completion Rate</span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{percent}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectCategoryFilter(cat.name)}
                    className="w-full min-h-[42px] py-2.5 bg-indigo-50 dark:bg-slate-900 hover:bg-indigo-100 dark:hover:bg-indigo-600/30 text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-white border border-indigo-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filter Tasks by {cat.name}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAGS SUBTAB */}
      {activeSubTab === 'tags' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <TagIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Custom Task Tags</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Click any tag chip below to filter your task list by that tag.
            </p>

            {allUniqueTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {allUniqueTags.map((tag) => {
                  const count = tasks.filter((t) => t.tags?.includes(tag)).length;
                  return (
                    <button
                      key={tag}
                      onClick={() => onSelectTagFilter && onSelectTagFilter(tag)}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-600/30 text-slate-800 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-white border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Hash className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>{tag}</span>
                      <span className="text-[10px] bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-full font-bold border border-slate-200 dark:border-slate-800">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-500">
                No tags created yet. Add tags when creating or editing tasks!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
