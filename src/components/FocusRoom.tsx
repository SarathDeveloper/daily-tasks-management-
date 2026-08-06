import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Zap, Volume2, VolumeX, CheckCircle2, Award } from 'lucide-react';
import { Task } from '../types';
import { audioService } from '../services/audioService';

interface FocusRoomProps {
  tasks: Task[];
  initialActiveTask?: Task | null;
  onCompleteTask: (taskId: string) => void;
}

export const FocusRoom: React.FC<FocusRoomProps> = ({
  tasks,
  initialActiveTask,
  onCompleteTask,
}) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string>(
    initialActiveTask?.id || (tasks.find((t) => !t.completed)?.id || '')
  );
  const [mode, setMode] = useState<'pomodoro' | 'shortBreak' | 'longBreak'>('pomodoro');
  const [durationSec, setDurationSec] = useState<number>(25 * 60);
  const [timeRemaining, setTimeRemaining] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [ambientActive, setAmbientActive] = useState<boolean>(false);

  const stopAmbientRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (initialActiveTask) {
      setSelectedTaskId(initialActiveTask.id);
    }
  }, [initialActiveTask]);

  // Mode Duration Presets
  const setTimerMode = (newMode: 'pomodoro' | 'shortBreak' | 'longBreak') => {
    setIsRunning(false);
    setMode(newMode);
    const secs =
      newMode === 'pomodoro' ? 25 * 60 : newMode === 'shortBreak' ? 5 * 60 : 15 * 60;
    setDurationSec(secs);
    setTimeRemaining(secs);
  };

  // Timer Tick
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isRunning && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
      }, 1000);
    } else if (timeRemaining === 0 && isRunning) {
      setIsRunning(false);
      audioService.playSound('bell', 'Focus session finished!');
      if (stopAmbientRef.current) {
        stopAmbientRef.current();
        setAmbientActive(false);
      }
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning, timeRemaining]);

  // Toggle Ambient Sound
  const toggleAmbient = () => {
    if (ambientActive) {
      if (stopAmbientRef.current) stopAmbientRef.current();
      stopAmbientRef.current = null;
      setAmbientActive(false);
    } else {
      stopAmbientRef.current = audioService.playAmbientNoise('rain');
      setAmbientActive(true);
    }
  };

  useEffect(() => {
    return () => {
      if (stopAmbientRef.current) stopAmbientRef.current();
    };
  }, []);

  const activeTask = tasks.find((t) => t.id === selectedTaskId);

  // Format Time (MM:SS)
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const progressPercent = ((durationSec - timeRemaining) / durationSec) * 100;

  return (
    <div className="max-w-xl mx-auto py-4 px-4 space-y-6 text-center">
      {/* Modes Bar */}
      <div className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        {[
          { id: 'pomodoro', label: '🧠 Focus (25m)' },
          { id: 'shortBreak', label: '☕ Short Break (5m)' },
          { id: 'longBreak', label: '🌿 Long Break (15m)' },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setTimerMode(m.id as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              mode === m.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Target Task Picker */}
      <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 text-left shadow-sm transition-colors">
        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          Focus Objective Task
        </label>
        <select
          value={selectedTaskId}
          onChange={(e) => setSelectedTaskId(e.target.value)}
          className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">-- Free Focus Session --</option>
          {tasks
            .filter((t) => !t.completed)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.category})
              </option>
            ))}
        </select>
      </div>

      {/* Radial Timer Ring */}
      <div className="relative w-64 h-64 sm:w-72 sm:h-72 mx-auto flex items-center justify-center">
        {/* SVG Circle Progress */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="50%"
            cy="50%"
            r="42%"
            className="stroke-slate-200 dark:stroke-slate-800"
            strokeWidth="10"
            fill="transparent"
          />
          <circle
            cx="50%"
            cy="50%"
            r="42%"
            className="stroke-indigo-600 dark:stroke-indigo-500 transition-all duration-500"
            strokeWidth="10"
            strokeDasharray="264%"
            strokeDashoffset={`${264 - (264 * progressPercent) / 100}%`}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>

        {/* Center Timer Output */}
        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-1">
          <span className="text-5xl sm:text-6xl font-black font-mono tracking-tight text-slate-900 dark:text-white drop-shadow-sm">
            {formattedTime}
          </span>
          <span className="text-xs uppercase tracking-widest font-bold text-indigo-600 dark:text-indigo-400">
            {isRunning ? 'Session Active' : timeRemaining === 0 ? 'Complete!' : 'Paused'}
          </span>
        </div>
      </div>

      {/* Main Play / Pause Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold transition-all shadow-xl ${
            isRunning
              ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
              : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
          }`}
        >
          {isRunning ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1 fill-current" />}
        </button>

        <button
          onClick={() => {
            setIsRunning(false);
            setTimeRemaining(durationSec);
          }}
          className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm"
          title="Reset Timer"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        {/* Ambient Rain Sound Generator Button */}
        <button
          onClick={toggleAmbient}
          className={`p-3.5 rounded-2xl border transition-colors flex items-center gap-1.5 shadow-sm ${
            ambientActive
              ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-700 animate-pulse'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="Toggle Ambient Rain Sound"
        >
          {ambientActive ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
      </div>

      {/* Mark Task Complete Shortcut */}
      {activeTask && (
        <div className="pt-2">
          <button
            onClick={() => onCompleteTask(activeTask.id)}
            className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 text-xs font-semibold flex items-center justify-center gap-1.5 mx-auto shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Mark "{activeTask.title}" Done</span>
          </button>
        </div>
      )}
    </div>
  );
};
