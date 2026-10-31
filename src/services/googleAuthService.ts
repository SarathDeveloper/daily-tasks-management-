/**
 * Google sign-in for Drive backup.
 *
 * The browser asks for full Drive access so the backup can live in a normal
 * Dayflow folder. No backend exists, so the access token is the only credential;
 * it is cached with an expiry and used until it runs out, after which the user
 * reconnects with one tap.
 */
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { hasOAuthRedirectResult, oauthHashError } from '../lib/oauthRedirect';
import { isNative } from '../lib/platform';

/**
 * Full Drive access so the website and the phone — different OAuth clients —
 * can open the same Dayflow folder. `drive.appdata` is a hidden folder that
 * those two clients do not share, so a backup stored there never shows up in
 * Drive and never arrives on the other device.
 */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const WEB_SCOPES = ['openid', 'email', 'profile', DRIVE_SCOPE].join(' ');
const ACCOUNT_KEY = 'daily_tasks_google_account_v1';
const TOKEN_KEY = 'daily_tasks_google_token_v1';
const OAUTH_NOTICE_KEY = 'daily_tasks_google_oauth_notice_v1';
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
  /** Granted OAuth scopes. Absent on tokens saved before Drive file access. */
  scopes?: string[];
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (override?: { prompt?: string }) => void;
}

interface GoogleUserInfo {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            include_granted_scopes?: boolean;
            callback: (response: GoogleTokenResponse) => void;
            error_callback?: (error: { type?: string; message?: string }) => void;
          }) => GoogleTokenClient;
        };
      };
    };
  }
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

/**
 * A failed redirect is recorded before React mounts. The value is latched so
 * Strict Mode's second initializer still sees it after sessionStorage is cleared.
 */
let latchedOAuthNotice: string | null | undefined;
/** Set when a redirect saved an account. Survives a Strict Mode effect restart. */
let pendingRedirectAccount = false;

export function hasPendingRedirectAccount(): boolean {
  return pendingRedirectAccount;
}

export function acknowledgeRedirectAccount(): void {
  pendingRedirectAccount = false;
}

export function stashOAuthNotice(message: string | null): void {
  latchedOAuthNotice = message;
  try {
    if (message) sessionStorage.setItem(OAUTH_NOTICE_KEY, message);
    else sessionStorage.removeItem(OAUTH_NOTICE_KEY);
  } catch {
    // sessionStorage can be unavailable in a private webview
  }
}

export function readBootOAuthNotice(): string | null {
  if (latchedOAuthNotice === undefined) {
    try {
      latchedOAuthNotice = sessionStorage.getItem(OAUTH_NOTICE_KEY);
    } catch {
      latchedOAuthNotice = null;
    }
  }
  try {
    sessionStorage.removeItem(OAUTH_NOTICE_KEY);
  } catch {
    // sessionStorage can be unavailable in a private webview
  }
  return latchedOAuthNotice;
}

export function describeGoogleAuthFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (
    lower.includes('reauth') ||
    lower.includes('unregistered_on_api_console') ||
    lower.includes('developer_error')
  ) {
    return `${message} Add an Android OAuth client for package com.dayflow.dailytasks and this APK’s signing certificate.`;
  }
  if (lower.includes('invalid_scope')) {
    return `${message} In Google Cloud Console, add ${DRIVE_SCOPE} to the OAuth consent screen, then reconnect.`;
  }
  if (lower.includes('origin_mismatch')) {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'this site';
    return `Google rejected ${origin}. Add that exact address under Authorized JavaScript origins for the Dayflow web client, then reconnect.`;
  }
  return message;
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
      scopes: [DRIVE_SCOPE],
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

function tokenLifetimeMs(expiresInSeconds?: number): number {
  if (expiresInSeconds && expiresInSeconds > 120) return (expiresInSeconds - 60) * 1000;
  return TOKEN_LIFETIME_MS;
}

function storeAccessToken(accessToken: string, expiresInSeconds: number | undefined, scopes: string[]): void {
  storeCachedToken({
    accessToken,
    expiresAt: Date.now() + tokenLifetimeMs(expiresInSeconds),
    scopes,
  });
}

function grantedScopes(scopeField: string | undefined): string[] {
  return (scopeField ?? '').split(/\s+/).filter(Boolean);
}

function hasDriveScope(scopes: string[] | undefined): boolean {
  return Boolean(scopes?.includes(DRIVE_SCOPE));
}

let gisPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisPromise = null;
      reject(new GoogleAuthError('SIGN_IN_FAILED', 'Could not load Google sign-in.'));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

/** Loads the Google sign-in script before the user clicks, so the popup stays tied to that click. */
export function preloadGoogleSignIn(): void {
  if (isNativePlatform() || !isGoogleSignInConfigured()) return;
  void loadGisScript().catch(() => {
    gisPromise = null;
  });
}

function requestDriveAccessToken(): Promise<GoogleTokenResponse> {
  return new Promise((resolve, reject) => {
    const oauth = window.google?.accounts?.oauth2;
    if (!oauth) {
      reject(new GoogleAuthError('SIGN_IN_FAILED', 'Google sign-in did not load. Check your connection and try again.'));
      return;
    }
    const client = oauth.initTokenClient({
      client_id: getGoogleClientId(),
      scope: WEB_SCOPES,
      include_granted_scopes: true,
      callback: (response) => {
        if (response.error) {
          if (response.error === 'access_denied') {
            reject(new GoogleAuthError('CANCELED', 'Sign-in was cancelled.'));
            return;
          }
          reject(new GoogleAuthError('SIGN_IN_FAILED', response.error_description || response.error));
          return;
        }
        resolve(response);
      },
      error_callback: (error) => {
        if (error.type === 'popup_closed') {
          reject(new GoogleAuthError('CANCELED', 'Sign-in was cancelled.'));
          return;
        }
        if (error.type === 'popup_failed_to_open') {
          reject(
            new GoogleAuthError(
              'SIGN_IN_FAILED',
              'The Google window was blocked. Allow pop-ups for this site and try again.'
            )
          );
          return;
        }
        reject(new GoogleAuthError('SIGN_IN_FAILED', error.message || 'Google sign-in failed.'));
      },
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

async function fetchGoogleProfile(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new GoogleAuthError('SIGN_IN_FAILED', 'Google did not return the account profile.');
  }
  const profile = (await response.json()) as GoogleUserInfo;
  if (!profile.sub) {
    throw new GoogleAuthError('SIGN_IN_FAILED', 'Google did not return an account id.');
  }
  return profile;
}

async function connectGoogleAccountOnWeb(): Promise<GoogleAccount> {
  if (!isGoogleSignInConfigured()) {
    throw new GoogleAuthError(
      'NOT_CONFIGURED',
      'Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID and rebuild the app.'
    );
  }
  await loadGisScript();
  const token = await requestDriveAccessToken();
  if (!token.access_token) {
    throw new GoogleAuthError(
      'NO_ACCESS_TOKEN',
      'Google did not return a Drive token. Check that the Drive API is enabled for this OAuth client.'
    );
  }
  const scopes = grantedScopes(token.scope);
  // An empty scope list means Google omitted it. A non-empty list that lacks
  // Drive is a real refusal.
  if (scopes.length > 0 && !hasDriveScope(scopes)) {
    throw new GoogleAuthError(
      'NO_DRIVE_SCOPE',
      `Google did not grant Drive access. Reconnect and allow ${DRIVE_SCOPE}.`
    );
  }
  const storedScopes = hasDriveScope(scopes) ? scopes : [DRIVE_SCOPE];
  const profile = await fetchGoogleProfile(token.access_token);
  const account: GoogleAccount = {
    userId: profile.sub as string,
    email: profile.email ?? '',
    name: profile.name ?? profile.email ?? 'Google account',
    pictureUrl: profile.picture,
    connectedAt: new Date().toISOString(),
  };
  storeAccount(account);
  storeAccessToken(token.access_token, token.expires_in, storedScopes);
  return account;
}

/** One-tap connection. Always shows Google UI when a token is not cached. */
export async function connectGoogleAccount(): Promise<GoogleAccount> {
  if (!isNativePlatform()) return connectGoogleAccountOnWeb();
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
    if (!result.accessToken) {
      throw new GoogleAuthError(
        'NO_ACCESS_TOKEN',
        'Google did not return a Drive token. Check that the Drive API is enabled for this OAuth client.'
      );
    }
    storeAccount(account);
    storeAccessToken(result.accessToken, undefined, [DRIVE_SCOPE]);
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

function clearOAuthCallbackFromUrl(): void {
  const url = new URL(window.location.href);
  if (!url.hash) return;
  url.hash = '';
  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
}

/** Completes the redirect-based flow on the web build. Safe to call on native. */
export async function completeWebRedirectIfNeeded(): Promise<GoogleAccount | null> {
  if (isNativePlatform() || !isGoogleSignInConfigured()) return null;
  if (typeof window === 'undefined' || !hasOAuthRedirectResult(window.location.href)) return null;

  // The plugin throws `error_description` and drops the `error` code, so a
  // cancel would otherwise show up as a sign-in failure.
  if (oauthHashError(window.location.href) === 'access_denied') {
    clearOAuthCallbackFromUrl();
    throw new GoogleAuthError('CANCELED', 'Sign-in was cancelled.');
  }

  await initialize();
  const redirectScopes = grantedScopes(
    new URLSearchParams(window.location.hash.replace(/^#/, '')).get('scope') ?? undefined
  );
  try {
    const result = await GoogleSignIn.handleRedirectCallback();
    if (!result.accessToken) {
      throw new GoogleAuthError(
        'NO_ACCESS_TOKEN',
        'Google did not return a Drive token. Check that the Drive API is enabled for this OAuth client.'
      );
    }
    const account: GoogleAccount = {
      userId: result.userId,
      email: result.email ?? '',
      name: result.displayName ?? result.email ?? 'Google account',
      pictureUrl: result.imageUrl ?? undefined,
      connectedAt: new Date().toISOString(),
    };
    if (!hasDriveScope(redirectScopes)) {
      throw new GoogleAuthError(
        'NO_DRIVE_SCOPE',
        `Google did not grant Drive access. Reconnect and allow ${DRIVE_SCOPE}.`
      );
    }
    storeAccount(account);
    storeAccessToken(result.accessToken, undefined, redirectScopes);
    pendingRedirectAccount = true;
    return account;
  } catch (error) {
    clearOAuthCallbackFromUrl();
    if (error instanceof GoogleAuthError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'access_denied' || message.toLowerCase().includes('cancel')) {
      throw new GoogleAuthError('CANCELED', 'Sign-in was cancelled.');
    }
    throw new GoogleAuthError('SIGN_IN_FAILED', message);
  }
}

/** Drops a token Drive has rejected so the account is no longer treated as linked. */
export function clearCachedAccessToken(): void {
  storeCachedToken(null);
}

/** Returns a usable access token from the cache, or null when it has expired. */
export function getCachedAccessToken(): string | null {
  const cached = readCachedToken();
  if (!cached) return null;
  if (Date.now() >= cached.expiresAt || !hasDriveScope(cached.scopes)) {
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
