import { Lock } from 'lucide-react';

interface AppLockScreenProps {
  theme: 'light' | 'dark';
  error: string;
  onUnlock: () => void;
}

export function AppLockScreen({ theme, error, onUnlock }: AppLockScreenProps) {
  const dark = theme === 'dark';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-lock-title"
      className={`fixed inset-0 z-[80] flex flex-col items-center justify-center px-6 ${
        dark ? 'bg-slate-950 text-slate-100' : 'bg-stone-50 text-slate-900'
      }`}
    >
      <div
        className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border ${
          dark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
        }`}
      >
        <Lock className="h-7 w-7 text-indigo-500" />
      </div>
      <h1 id="app-lock-title" className="text-lg font-bold">
        Dayflow is locked
      </h1>
      <p className={`mt-1 max-w-xs text-center text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
        Use face unlock, fingerprint, or your PIN.
      </p>
      {error && <p className="mt-3 max-w-xs text-center text-sm text-rose-500">{error}</p>}
      <button
        type="button"
        onClick={onUnlock}
        className="mt-6 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white"
      >
        Unlock
      </button>
    </div>
  );
}
