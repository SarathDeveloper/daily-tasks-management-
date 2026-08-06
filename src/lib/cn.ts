/**
 * Tiny className merge helper -- filters falsy values and joins with spaces.
 * No external dependency; sufficient for this codebase's needs.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
