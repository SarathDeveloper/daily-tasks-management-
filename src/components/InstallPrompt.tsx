import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { isNative } from '../lib/platform';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'daily_tasks_install_dismissed_v1';

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export const InstallPrompt: React.FC = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  // The APK is already installed; never show an "add to home screen" banner.
  const native = isNative();

  useEffect(() => {
    if (native) return;
    if (isStandalone() || localStorage.getItem(DISMISS_KEY) === '1') return;
    if (isIos()) setIosHint(true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [native]);

  if (native) return null;
  if (!deferred && !iosHint) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDeferred(null);
    setIosHint(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') dismiss();
    else setDeferred(null);
  };

  return (
    <div className="lg:hidden border-b border-indigo-200 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-950/40 px-4 py-2.5">
      <div className="max-w-5xl mx-auto flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-900 dark:text-white">Install Dayflow</p>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
            {deferred
              ? 'Add it to your home screen and open it like an app.'
              : 'Open the Share menu, then tap Add to Home Screen.'}
          </p>
        </div>
        {deferred && (
          <button
            type="button"
            onClick={install}
            className="shrink-0 inline-flex items-center gap-1 min-h-[36px] px-3 rounded-xl bg-indigo-600 text-white text-xs font-bold"
          >
            <Download className="w-3.5 h-3.5" />
            Install
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="shrink-0 min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
