/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Web OAuth client id used by Google Sign-In on every platform. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** "true" shows the bank-spend inbox. Needs the native listener from feature/bank-sms-notifications. */
  readonly VITE_ENABLE_BANK_SMS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
