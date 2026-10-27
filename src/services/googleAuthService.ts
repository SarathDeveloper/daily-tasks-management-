/**
 * Google sign-in for Drive backup.
 *
 * Only the non-sensitive `drive.appdata` scope is requested, which grants access
 * to a hidden per-app folder inside the user's own Drive. No backend exists, so
 * the access token is the only credential; it is cached with an expiry and used
 * until it runs out, after which the user reconnects with one tap.
 */
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { isNative } from '../lib/platform';

const DRIVE_APP_DATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const ACCOUNT_KEY = 'daily_tasks_google_account_v1';
const TOKEN_KEY = 'daily_tasks_google_token_v1';
/** Google access tokens live ~60 minutes; refresh a little earlier. */
const TOKEN_LIFETIME_MS = 55 * 60 * 1000;

export interface GoogleAccount {
  userId: string;
  email: string;
  name: string;
  pictureUrl?: string;
  connectedAt: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

export class GoogleAuthError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'GoogleAuthError';
    this.code = code;
  }
}

export function getGoogleClientId(): string {
  const fromEnv = import.meta.env?.VITE_GOOGLE_CLIENT_ID;
  return typeof fromEnv === 'string' ? fromEnv.trim() : '';
}

export function isGoogleSignInConfigured(): boolean {
  return getGoogleClientId().length > 0;
}

export function isNativePlatform(): boolean {
  return isNative();
}

export function getStoredAccount(): GoogleAccount | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    return raw ? (JSON.parse(raw) as GoogleAccount) : null;
  } catch (e) {
    console.warn('Failed to read the stored Google account:', e);
    return null;
  }
}

function storeAccount(account: GoogleAccount | null): void {
  if (account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  else localStorage.removeItem(ACCOUNT_KEY);
}

function readCachedToken(): CachedToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedToken;
    if (!parsed.accessToken || !parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeCachedToken(token: CachedToken | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  else localStorage.removeItem(TOKEN_KEY);
}

let initPromise: Promise<void> | null = null;

async function initialize(): Promise<void> {
  if (!isGoogleSignInConfigured()) {
    throw new GoogleAuthError(
      'NOT_CONFIGURED',
      'Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID and rebuild the app.'
    );
  }
  if (!initPromise) {
    const options: Parameters<typeof GoogleSignIn.initialize>[0] = {
      clientId: getGoogleClientId(),
      scopes: [DRIVE_APP_DATA_SCOPE],
    };
    if (!isNativePlatform() && typeof window !== 'undefined') {
      options.redirectUrl = window.location.origin;
    }
    initPromise = GoogleSignIn.initialize(options).catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

function toCachedToken(accessToken: string | null): CachedToken | null {
  if (!accessToken) return null;
  return { accessToken, expiresAt: Date.now() + TOKEN_LIFETIME_MS };
}

/** One-tap connection. Always shows Google UI when a token is not cached. */
export async function connectGoogleAccount(): Promise<GoogleAccount> {
  await initialize();

  try {
    const result = await GoogleSignIn.signIn();
    const account: GoogleAccount = {
      userId: result.userId,
      email: result.email ?? '',
      name: result.displayName ?? result.email ?? 'Google account',
      pictureUrl: result.imageUrl ?? undefined,
      connectedAt: new Date().toISOString(),
    };
    storeAccount(account);
    storeCachedToken(toCachedToken(result.accessToken));
    if (!result.accessToken) {
      throw new GoogleAuthError(
        'NO_ACCESS_TOKEN',
        'Google did not return a Drive token. Check that the Drive API is enabled for this OAuth client.'
      );
    }
    return account;
  } catch (error) {
    if (error instanceof GoogleAuthError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('SIGN_IN_CANCELED') || message.toLowerCase().includes('cancel')) {
      throw new GoogleAuthError('CANCELED', 'Sign-in was cancelled.');
    }
    throw new GoogleAuthError('SIGN_IN_FAILED', message);
  }
}

/** Completes the redirect-based flow on the web build. Safe to call on native. */
export async function completeWebRedirectIfNeeded(): Promise<GoogleAccount | null> {
  if (isNativePlatform() || !isGoogleSignInConfigured()) return null;
  const url = new URL(window.location.href);
  const isRedirectBack = url.searchParams.has('code') || url.searchParams.has('state');
  if (!isRedirectBack) return null;

  await initialize();
  try {
    const result = await GoogleSignIn.handleRedirectCallback();
    const account: GoogleAccount = {
      userId: result.userId,
      email: result.email ?? '',
      name: result.displayName ?? result.email ?? 'Google account',
      pictureUrl: result.imageUrl ?? undefined,
      connectedAt: new Date().toISOString(),
    };
    storeAccount(account);
    storeCachedToken(toCachedToken(result.accessToken));
    // Strip the OAuth parameters so a reload does not replay the code.
    url.search = '';
    window.history.replaceState({}, '', url.toString());
    return account;
  } catch (e) {
    console.warn('Google redirect callback failed:', e);
    return null;
  }
}

/** Returns a usable access token from the cache, or null when it has expired. */
export function getCachedAccessToken(): string | null {
  const cached = readCachedToken();
  if (!cached) return null;
  if (Date.now() >= cached.expiresAt) {
    storeCachedToken(null);
    return null;
  }
  return cached.accessToken;
}

export function hasValidToken(): boolean {
  return getCachedAccessToken() !== null;
}

export async function disconnectGoogleAccount(): Promise<void> {
  try {
    if (isGoogleSignInConfigured()) {
      await initialize();
      await GoogleSignIn.signOut();
    }
  } catch (e) {
    console.warn('Google sign-out failed (clearing locally anyway):', e);
  }
  storeAccount(null);
  storeCachedToken(null);
}
