import React from 'react';
import { AlarmClock } from 'lucide-react';
import type { Alarm } from '../types';
import { formatAlarmWhen, nextEnabledAlarm } from '../lib/alarms';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

interface TodayAlarmCardProps {
  alarms: Alarm[];
  onOpen: () => void;
}

export const TodayAlarmCard: React.FC<TodayAlarmCardProps> = ({ alarms, onOpen }) => {
  const next = nextEnabledAlarm(alarms);
  if (!next) return null;

  return (
    <Card className="p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
        <AlarmClock className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Next alarm</p>
        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{next.alarm.label || 'Alarm'}</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{formatAlarmWhen(next.fireAt)}</p>
      </div>
      <Button type="button" variant="secondary" onClick={onOpen}>
        Open
      </Button>
    </Card>
  );
};
