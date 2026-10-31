import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DRIVE_SCOPE,
  describeGoogleAuthFailure,
  getCachedAccessToken,
  readBootOAuthNotice,
  stashOAuthNotice,
} from './googleAuthService';

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
  clear() {
    this.store.clear();
  }
}

describe('describeGoogleAuthFailure', () => {
  it('explains an Android certificate mismatch', () => {
    const message = describeGoogleAuthFailure(new Error('Account reauth failed'));
    expect(message).toContain('Account reauth failed');
    expect(message).toContain('com.dayflow.dailytasks');
  });

  it('leaves other sign-in errors unchanged', () => {
    expect(describeGoogleAuthFailure(new Error('Sign-in was cancelled.'))).toBe(
      'Sign-in was cancelled.'
    );
  });

  it('explains a Drive scope the consent screen does not allow', () => {
    const message = describeGoogleAuthFailure(new Error('invalid_scope'));
    expect(message).toContain(DRIVE_SCOPE);
  });

  it('explains an unauthorized JavaScript origin', () => {
    const message = describeGoogleAuthFailure(new Error('origin_mismatch'));
    expect(message).toContain('Authorized JavaScript origins');
  });
});

describe('cached Drive token', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('drops a token that cannot read or write Google Drive files', () => {
    localStorage.setItem(
      'daily_tasks_google_token_v1',
      JSON.stringify({
        accessToken: 'hidden-only',
        expiresAt: Date.now() + 60_000,
        scopes: ['https://www.googleapis.com/auth/drive.appdata'],
      })
    );
    expect(getCachedAccessToken()).toBeNull();
  });

  it('keeps a token that includes the Drive file scope', () => {
    localStorage.setItem(
      'daily_tasks_google_token_v1',
      JSON.stringify({
        accessToken: 'drive-token',
        expiresAt: Date.now() + 60_000,
        scopes: [DRIVE_SCOPE],
      })
    );
    expect(getCachedAccessToken()).toBe('drive-token');
  });
});

describe('readBootOAuthNotice', () => {
  it('returns the same notice to a second initializer after storage is cleared', () => {
    stashOAuthNotice('Google did not return a Drive token.');
    expect(readBootOAuthNotice()).toBe('Google did not return a Drive token.');
    expect(readBootOAuthNotice()).toBe('Google did not return a Drive token.');
  });
});
