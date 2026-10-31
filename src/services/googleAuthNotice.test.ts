import { describe, expect, it } from 'vitest';
import { describeGoogleAuthFailure, readBootOAuthNotice, stashOAuthNotice } from './googleAuthService';

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
});

describe('readBootOAuthNotice', () => {
  it('returns the same notice to a second initializer after storage is cleared', () => {
    stashOAuthNotice('Google did not return a Drive token.');
    expect(readBootOAuthNotice()).toBe('Google did not return a Drive token.');
    expect(readBootOAuthNotice()).toBe('Google did not return a Drive token.');
  });
});
