/**
 * The biometric prompt is its own Android activity. Capacitor reports Dayflow as
 * inactive while that activity is open, and some phones deliver the matching
 * resume more than once. A successful unlock stays "just unlocked" until the
 * app really leaves, so a duplicate resume does not lock it again.
 */
let promptOpen = false;
let pausedForPrompt = false;
let skipResumeLock = false;

export function markPromptStarted(): void {
  promptOpen = true;
  skipResumeLock = true;
}

export function markPromptFinished(): void {
  promptOpen = false;
}

export function isPromptOpen(): boolean {
  return promptOpen;
}

/** True when this pause is the biometric prompt, not the user leaving Dayflow. */
export function shouldIgnoreAppPause(): boolean {
  if (promptOpen) {
    pausedForPrompt = true;
    return true;
  }
  skipResumeLock = false;
  return false;
}

/** True when this resume is the biometric prompt closing, or a duplicate of that resume. */
export function shouldIgnoreAppResume(): boolean {
  if (promptOpen || pausedForPrompt || skipResumeLock) {
    pausedForPrompt = false;
    return true;
  }
  return false;
}

export function resetAppLockSession(): void {
  promptOpen = false;
  pausedForPrompt = false;
  skipResumeLock = false;
}
