import React from 'react';
import { Volume2 } from 'lucide-react';
import type { SoundType } from '../types';
import { SOUND_OPTIONS } from '../lib/sounds';

interface SoundFieldsProps {
  sound: SoundType;
  onSound: (sound: SoundType) => void;
  ring: boolean;
  onRing: (ring: boolean) => void;
  localMusicName?: string;
  onPreview: () => void;
  /** Clock alarms always loop, so the checkbox stays on. */
  alwaysRing?: boolean;
}

export const SoundFields: React.FC<SoundFieldsProps> = ({
  sound,
  onSound,
  ring,
  onRing,
  localMusicName,
  onPreview,
  alwaysRing = false,
}) => (
  <div className="space-y-2">
    <div>
      <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Sound</label>
      <div className="flex items-center gap-1.5">
        <select
          value={sound}
          onChange={(event) => {
            const next = event.target.value as SoundType;
            onSound(next);
            if (next === 'voice') onRing(false);
          }}
          className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-200"
        >
          {SOUND_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onPreview}
          title="Preview sound"
          className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-700/60"
        >
          <Volume2 className="w-4 h-4" />
        </button>
      </div>
    </div>
    {sound === 'music' && !localMusicName && (
      <p className="text-[11px] text-amber-700 dark:text-amber-300">
        No song saved. This will use the chime until you choose one in Settings.
      </p>
    )}
    {sound === 'music' && localMusicName && (
      <p className="text-[11px] text-slate-500 dark:text-slate-400">Plays {localMusicName} until you stop it.</p>
    )}
    {sound === 'voice' && (
      <p className="text-[11px] text-slate-500 dark:text-slate-400">Voice plays once in the app and is not looped.</p>
    )}
    <label className="flex items-center justify-between gap-3 text-[11px] text-slate-600 dark:text-slate-300">
      <span>Ring until dismissed</span>
      <input
        type="checkbox"
        checked={alwaysRing || ring || sound === 'music'}
        disabled={alwaysRing || sound === 'music' || sound === 'voice'}
        onChange={(event) => onRing(event.target.checked)}
        aria-label="Ring until dismissed"
        className="w-4 h-4 rounded border-slate-300 disabled:opacity-60"
      />
    </label>
  </div>
);
