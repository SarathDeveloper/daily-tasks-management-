import type { SoundType } from '../types';

export const MAX_MUSIC_BYTES = 15 * 1024 * 1024;

export const SOUND_OPTIONS: { id: SoundType; label: string }[] = [
  { id: 'chime', label: 'Gentle Chime' },
  { id: 'bell', label: 'Harmonic Bell' },
  { id: 'digital', label: 'Digital Pulse' },
  { id: 'gentle', label: 'Soothing Chord' },
  { id: 'voice', label: 'Voice' },
  { id: 'music', label: 'Local music' },
];

export interface ReminderDelivery {
  sound: SoundType;
  /** True when this should loop on the alarm bridge instead of a short chime. */
  ring: boolean;
}

/**
 * Local music rings until dismissed when a song is saved.
 * Without a song it falls back to the chime, and only loops if the alarm flag is on.
 * Voice stays a one-shot announcement unless the alarm flag asks for a loop, which uses the chime.
 */
export function resolveReminderDelivery(
  sound: SoundType | undefined,
  alarm: boolean | undefined,
  hasMusic: boolean,
  fallback: SoundType = 'chime'
): ReminderDelivery {
  const chosen = sound ?? fallback;
  if (chosen === 'voice' && !alarm) return { sound: 'voice', ring: false };
  if (chosen === 'music') {
    if (!hasMusic) return { sound: 'chime', ring: Boolean(alarm) };
    return { sound: 'music', ring: true };
  }
  if (alarm) return { sound: chosen === 'voice' ? 'chime' : chosen, ring: true };
  return { sound: chosen, ring: false };
}
