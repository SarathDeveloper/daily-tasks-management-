import {
  BiometricAuth,
  BiometryError,
  BiometryErrorType,
} from '@aparajita/capacitor-biometric-auth';
import { isPromptOpen, markPromptFinished, markPromptStarted } from '../lib/appLockSession';

export { shouldIgnoreAppPause, shouldIgnoreAppResume } from '../lib/appLockSession';

export interface UnlockResult {
  ok: boolean;
  canceled: boolean;
  message: string;
}

const PROMPT = {
  reason: 'Unlock Dayflow',
  cancelTitle: 'Cancel',
  allowDeviceCredential: true,
  androidTitle: 'Unlock Dayflow',
  androidSubtitle: 'Use face, fingerprint, or your PIN',
  androidConfirmationRequired: false,
};

const UNAVAILABLE = 'Set a face unlock, fingerprint, or PIN on this phone first.';

export function isUnlockPromptOpen(): boolean {
  return isPromptOpen();
}

export async function canUseAppLock(): Promise<{ available: boolean; message: string }> {
  try {
    const info = await BiometricAuth.checkBiometry();
    if (info.isAvailable || info.deviceIsSecure) return { available: true, message: '' };
    return { available: false, message: UNAVAILABLE };
  } catch {
    return { available: false, message: UNAVAILABLE };
  }
}

export async function promptAppUnlock(): Promise<UnlockResult> {
  if (isPromptOpen()) return { ok: false, canceled: true, message: '' };
  markPromptStarted();
  try {
    await BiometricAuth.authenticate(PROMPT);
    return { ok: true, canceled: false, message: '' };
  } catch (error) {
    if (error instanceof BiometryError) {
      const canceled =
        error.code === BiometryErrorType.userCancel ||
        error.code === BiometryErrorType.systemCancel ||
        error.code === BiometryErrorType.appCancel;
      return { ok: false, canceled, message: canceled ? '' : unlockMessage(error.code) };
    }
    return { ok: false, canceled: false, message: 'Could not unlock Dayflow.' };
  } finally {
    markPromptFinished();
  }
}

function unlockMessage(code: BiometryErrorType): string {
  switch (code) {
    case BiometryErrorType.biometryLockout:
      return 'Too many tries. Use your PIN, or wait and try again.';
    case BiometryErrorType.biometryNotEnrolled:
    case BiometryErrorType.biometryNotAvailable:
    case BiometryErrorType.passcodeNotSet:
    case BiometryErrorType.noDeviceCredential:
      return UNAVAILABLE;
    default:
      return 'Could not unlock Dayflow.';
  }
}
