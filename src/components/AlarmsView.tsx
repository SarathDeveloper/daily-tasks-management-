import React, { useEffect, useState } from 'react';
import { AlarmClock, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Alarm, SoundType } from '../types';
import { daySummary } from '../lib/alarms';
import { previewLocalMusic } from '../lib/localMusic';
import { audioService } from '../services/audioService';
import { SoundFields } from './SoundFields';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface AlarmsViewProps {
  alarms: Alarm[];
  localMusicName?: string;
  onSave: (alarm: Partial<Alarm>) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const AlarmsView: React.FC<AlarmsViewProps> = ({
  alarms,
  localMusicName,
  onSave,
  onDelete,
  onToggle,
}) => {
  const [editing, setEditing] = useState<Alarm | null>(null);
  const [open, setOpen] = useState(false);

  const startCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Alarms</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Rings until you dismiss or snooze. Quiet hours do not apply.</p>
        </div>
        <Button type="button" onClick={startCreate}>
          <Plus className="w-4 h-4" />
          Add
        </Button>
      </div>

      {alarms.length === 0 ? (
        <Card className="p-8 text-center space-y-2">
          <AlarmClock className="w-8 h-8 mx-auto text-indigo-500" />
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">No alarms yet</p>
          <p className="text-xs text-slate-500">Set a time and it will ring on this device.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {alarms.map((alarm) => (
            <Card key={alarm.id} className="p-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => onToggle(alarm.id, !alarm.enabled)}
                aria-pressed={alarm.enabled}
                aria-label={alarm.enabled ? 'Turn alarm off' : 'Turn alarm on'}
                className={`w-11 h-6 rounded-full relative shrink-0 transition-colors ${
                  alarm.enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    alarm.enabled ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-lg font-black leading-none ${alarm.enabled ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                  {alarm.time}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
                  {alarm.label || 'Alarm'} · {daySummary(alarm.daysOfWeek)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditing(alarm);
                  setOpen(true);
                }}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
                aria-label={`Edit ${alarm.label || 'alarm'}`}
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(alarm.id)}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-600"
                aria-label={`Delete ${alarm.label || 'alarm'}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <AlarmEditor
          initial={editing}
          localMusicName={localMusicName}
          onClose={() => setOpen(false)}
          onSave={(draft) => {
            onSave(draft);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
};

const AlarmEditor: React.FC<{
  initial: Alarm | null;
  localMusicName?: string;
  onClose: () => void;
  onSave: (alarm: Partial<Alarm>) => void;
}> = ({ initial, localMusicName, onClose, onSave }) => {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [time, setTime] = useState(initial?.time ?? '07:00');
  const [days, setDays] = useState<number[]>(initial?.daysOfWeek ?? []);
  const [sound, setSound] = useState<SoundType>(initial?.sound ?? 'chime');
  const [ring, setRing] = useState(true);
  const [snoozeMinutes, setSnoozeMinutes] = useState(initial?.snoozeMinutes ?? 10);

  useEffect(() => {
    setLabel(initial?.label ?? '');
    setTime(initial?.time ?? '07:00');
    setDays(initial?.daysOfWeek ?? []);
    setSound(initial?.sound ?? 'chime');
    setSnoozeMinutes(initial?.snoozeMinutes ?? 10);
  }, [initial]);

  const toggleDay = (day: number) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((value) => value !== day) : [...prev, day].sort()));
  };

  const preview = () => {
    if (sound === 'music') {
      void previewLocalMusic().then((played) => {
        if (!played) audioService.playSound('chime', label || 'Alarm');
      });
      return;
    }
    audioService.playSound(sound, label || 'Alarm');
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
      <form
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            id: initial?.id,
            label: label.trim() || 'Alarm',
            time: time || '07:00',
            enabled: initial?.enabled ?? true,
            daysOfWeek: days,
            sound,
            snoozeMinutes,
            snoozedUntil: initial?.snoozedUntil,
          });
        }}
      >
        <h3 className="text-lg font-black text-slate-900 dark:text-white">{initial ? 'Edit alarm' : 'New alarm'}</h3>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Label"
          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          required
          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
        />
        <div>
          <p className="text-[11px] text-slate-500 mb-1">Repeat. Leave empty to ring once.</p>
          <div className="flex gap-1">
            {DAY_LABELS.map((labelText, day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`w-8 h-8 rounded-full text-xs font-bold ${
                  days.includes(day)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {labelText}
              </button>
            ))}
          </div>
        </div>
        <SoundFields
          sound={sound}
          onSound={setSound}
          ring={ring}
          onRing={setRing}
          localMusicName={localMusicName}
          onPreview={preview}
          alwaysRing
        />
        <label className="block text-[11px] text-slate-500">
          Snooze
          <select
            value={snoozeMinutes}
            onChange={(event) => setSnoozeMinutes(Number(event.target.value))}
            className="mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-200"
          >
            {[5, 10, 15, 30].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </select>
        </label>
        <p className="text-[11px] text-slate-400">Clock alarms always ring until dismissed, including during quiet hours.</p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1">
            Save
          </Button>
        </div>
      </form>
    </div>
  );
};
