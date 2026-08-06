import React from 'react';
import { X, Bell, Volume2, Moon, Sun, Download, Upload, RotateCcw, ShieldCheck, Palette } from 'lucide-react';
import { NotificationSettings, SoundType } from '../types';
import { audioService } from '../services/audioService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: NotificationSettings;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onUpdateSettings: (newSettings: NotificationSettings) => void;
  onResetTasks: () => void;
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  theme,
  onToggleTheme,
  onUpdateSettings,
  onResetTasks,
  onExportData,
  onImportData,
}) => {
  if (!isOpen) return null;

  const handleTestSound = (sound: SoundType) => {
    audioService.playSound(sound, 'Daily task reminder test');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in transition-colors">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>App & Notification Settings</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 text-xs overflow-y-auto max-h-[80vh]">
          {/* Appearance / Theme Toggle */}
          <div className="space-y-2 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Appearance & Theme</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Choose your preferred visual theme.</p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (theme !== 'light') onToggleTheme();
                }}
                className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${
                  theme === 'light'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/60 ring-2 ring-amber-500/30'
                    : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Light Mode</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (theme !== 'dark') onToggleTheme();
                }}
                className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${
                  theme === 'dark'
                    ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/60 ring-2 ring-indigo-500/30'
                    : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                <Moon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Dark Mode</span>
              </button>
            </div>
          </div>
          {/* Sound & Notifications */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs">Notification Sound Preferences</h3>

            <div className="flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-300">Play Audio Sound Chimes</span>
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, soundEnabled: e.target.checked })
                }
                className="w-4 h-4 text-indigo-600 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-300">Voice Speech Announcements</span>
              <input
                type="checkbox"
                checked={settings.speechEnabled}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, speechEnabled: e.target.checked })
                }
                className="w-4 h-4 text-indigo-600 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded"
              />
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">Default Chime Sound</label>
              <div className="flex items-center gap-2">
                <select
                  value={settings.defaultSound}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, defaultSound: e.target.value as SoundType })
                  }
                  className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 capitalize"
                >
                  <option value="chime">🔔 Gentle Chime</option>
                  <option value="bell">🛎️ Harmonic Bell</option>
                  <option value="digital">📱 Digital Pulse</option>
                  <option value="gentle">🎶 Soothing Chord</option>
                  <option value="voice">🗣️ Voice Announcement</option>
                </select>

                <button
                  type="button"
                  onClick={() => handleTestSound(settings.defaultSound)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-700 flex items-center gap-1 font-semibold"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Test</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quiet Hours */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1">
                <Moon className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                Quiet Hours (Do Not Disturb)
              </h3>
              <input
                type="checkbox"
                checked={settings.quietHours.enabled}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    quietHours: { ...settings.quietHours, enabled: e.target.checked },
                  })
                }
                className="w-4 h-4 text-indigo-600 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded"
              />
            </div>

            {settings.quietHours.enabled && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">Start Time</span>
                  <input
                    type="time"
                    value={settings.quietHours.start}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        quietHours: { ...settings.quietHours, start: e.target.value },
                      })
                    }
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">End Time</span>
                  <input
                    type="time"
                    value={settings.quietHours.end}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        quietHours: { ...settings.quietHours, end: e.target.value },
                      })
                    }
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Backup & Data Controls */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-700 dark:text-slate-300 text-xs">Data Backup & Recovery</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onExportData}
                className="py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>

              <label className="py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Import JSON</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={onImportData}
                  className="hidden"
                />
              </label>
            </div>

            <button
              onClick={onResetTasks}
              className="w-full mt-2 py-2 px-3 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-300 font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Sample Tasks</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
