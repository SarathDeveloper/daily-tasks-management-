/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Web OAuth client id used by Google Sign-In on every platform. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
