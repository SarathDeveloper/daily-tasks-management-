/**
 * Build-time feature flags. Vite inlines import.meta.env values, so a flag
 * that is off removes the guarded code from the bundle entirely.
 */

/**
 * Bank spends read from messaging-app notifications. Off on main: the native
 * notification listener it needs is not in the Play build and lives on the
 * feature/bank-sms-notifications branch.
 */
export const BANK_SMS_ENABLED = import.meta.env.VITE_ENABLE_BANK_SMS === 'true';
