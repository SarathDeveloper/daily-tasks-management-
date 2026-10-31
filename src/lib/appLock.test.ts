import { beforeEach, describe, expect, it } from 'vitest';
import { isAppLockEnabled, setAppLockEnabled } from './appLock';
import {
  markPromptFinished,
  markPromptStarted,
  resetAppLockSession,
  shouldIgnoreAppPause,
  shouldIgnoreAppResume,
} from './appLockSession';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  });
});

describe('app lock session', () => {
  beforeEach(() => {
    resetAppLockSession();
  });

  it('treats a normal leave and return as a real lock point', () => {
    expect(shouldIgnoreAppPause()).toBe(false);
    expect(shouldIgnoreAppResume()).toBe(false);
  });

  it('ignores the prompt pause and a duplicate resume after success', () => {
    markPromptStarted();
    expect(shouldIgnoreAppPause()).toBe(true);
    markPromptFinished();
    expect(shouldIgnoreAppResume()).toBe(true);
    expect(shouldIgnoreAppResume()).toBe(true);
  });

  it('locks again only after the app really leaves', () => {
    markPromptStarted();
    markPromptFinished();
    shouldIgnoreAppResume();
    expect(shouldIgnoreAppPause()).toBe(false);
    expect(shouldIgnoreAppResume()).toBe(false);
  });
});

describe('app lock preference', () => {
  it('stays off until the switch is turned on', () => {
    expect(isAppLockEnabled()).toBe(false);
    setAppLockEnabled(true);
    expect(isAppLockEnabled()).toBe(true);
    expect(localStorage.getItem('dayflow_app_lock')).toBe('1');
  });

  it('clears the flag when the switch is turned off', () => {
    setAppLockEnabled(true);
    setAppLockEnabled(false);
    expect(isAppLockEnabled()).toBe(false);
    expect(localStorage.getItem('dayflow_app_lock')).toBeNull();
  });
});
