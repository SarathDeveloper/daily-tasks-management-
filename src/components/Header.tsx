import React from 'react';
import { Bell, BellOff, Volume2, Settings, ShieldAlert, User as UserIcon, LogIn, Sun, Moon } from 'lucide-react';
import { NotificationSettings, User } from '../types';
import { audioService } from '../services/audioService';

interface HeaderProps {
  notificationSettings: NotificationSettings;
  permissionStatus: NotificationPermission | 'unsupported';
  currentUser: User | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onRequestPermission: () => void;
  onOpenSettings: () => void;
  onOpenAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  notificationSettings,
  permissionStatus,
  currentUser,
  theme,
  onToggleTheme,
  onRequestPermission,
  onOpenSettings,
  onOpenAuth,
}) => {
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const handleTestSound = () => {
    audioService.playSound(notificationSettings.defaultSound, 'Test notification reminder');
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-3 sm:px-6 lg:pl-6 lg:pr-8 transition-colors shadow-xs">
      <div className="max-w-5xl lg:max-w-6xl mx-auto flex items-center justify-between gap-2">
        {/* Brand & Date - the sidebar already shows these on desktop */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 lg:hidden">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
            <span className="font-bold text-lg leading-none">✓</span>
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base sm:text-lg tracking-tight leading-none text-slate-900 dark:text-white truncate">
              Dayflow
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{todayFormatted}</p>
          </div>
        </div>
        {/* Right Actions */}
        <div className="flex items-center gap-0.5 sm:gap-2 shrink-0 ml-auto">
          <button
            type="button"
            onClick={onToggleTheme}
            className="sm:hidden min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          {/* Light / Dark Mode Toggle Button */}
          <div className="hidden sm:flex items-center bg-slate-200 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-300 dark:border-slate-700">
            <button
              type="button"
              onClick={onToggleTheme}
              className={`min-h-[34px] sm:min-h-[38px] px-2 sm:px-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold transition-all ${
                theme === 'light'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Switch to Light Mode"
            >
              <Sun className={`w-4 h-4 ${theme === 'light' ? 'text-amber-500' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">Light</span>
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              className={`min-h-[34px] sm:min-h-[38px] px-2 sm:px-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold transition-all ${
                theme === 'dark'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Switch to Dark Mode"
            >
              <Moon className={`w-4 h-4 ${theme === 'dark' ? 'text-indigo-400' : 'text-slate-500'}`} />
              <span className="hidden sm:inline">Dark</span>
            </button>
          </div>

          {/* User Account / Auth Button */}
          <button
            onClick={onOpenAuth}
            className={`min-h-[36px] sm:min-h-[40px] px-2.5 sm:px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-colors ${
              currentUser
                ? 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-sm'
            }`}
            title={currentUser ? `Logged in as ${currentUser.name}` : 'Sign In / Sign Up'}
          >
            {currentUser ? (
              <>
                <div
                  className={`w-5 h-5 rounded-full ${
                    currentUser.avatarColor || 'bg-indigo-600'
                  } text-white font-extrabold text-[10px] flex items-center justify-center`}
                >
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline max-w-[100px] truncate">{currentUser.name.split(' ')[0]}</span>
              </>
            ) : (
              <>
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Sign In</span>
              </>
            )}
          </button>

          {/* Sound Test Button -- hidden on mobile to save space */}
          <button
            onClick={handleTestSound}
            title="Test Chime Sound"
            className="hidden sm:flex w-10 h-10 min-h-[40px] min-w-[40px] rounded-xl items-center justify-center text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <Volume2 className="w-5 h-5" />
          </button>

          {/* Notification Permission Status Button */}
          <button
            onClick={onRequestPermission}
            title={
              permissionStatus === 'granted'
                ? 'Notifications Enabled'
                : 'Enable Browser Notifications'
            }
            className={`min-h-[36px] sm:min-h-[40px] px-2 sm:px-2.5 sm:px-3 rounded-xl transition-colors flex items-center justify-center gap-1.5 text-xs font-medium ${
              permissionStatus === 'granted'
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/50'
                : permissionStatus === 'denied'
                ? 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/40'
                : 'text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/50 border border-indigo-300 dark:border-indigo-700/50 animate-pulse'
            }`}
          >
            {permissionStatus === 'granted' ? (
              <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : permissionStatus === 'denied' ? (
              <BellOff className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            )}
            <span className="hidden sm:inline">
              {permissionStatus === 'granted'
                ? 'Active'
                : permissionStatus === 'denied'
                ? 'Blocked'
                : 'Alerts'}
            </span>
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            title="Notification & App Settings"
            className="w-9 h-9 sm:w-10 sm:h-10 min-h-[36px] sm:min-h-[40px] min-w-[36px] sm:min-w-[40px] rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
