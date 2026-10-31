const APP_LOCK_KEY = 'dayflow_app_lock';

/** Device-only. This flag is not part of backup or cloud sync. */
export function isAppLockEnabled(): boolean {
  try {
    return localStorage.getItem(APP_LOCK_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAppLockEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(APP_LOCK_KEY, '1');
    else localStorage.removeItem(APP_LOCK_KEY);
  } catch {
    // Storage can be unavailable in private modes. The switch simply stays off.
  }
}
