import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { migrateToSingleProfile } from './lib/singleProfile';
import {
  GoogleAuthError,
  completeWebRedirectIfNeeded,
  describeGoogleAuthFailure,
  stashOAuthNotice,
} from './services/googleAuthService';

async function boot(): Promise<void> {
  // Fold a signed-in profile into the default keys before React reads storage.
  migrateToSingleProfile();
  try {
    // Consume the Google hash before React mounts. Strict Mode otherwise
    // starts the callback twice and drops the account that was just saved.
    await completeWebRedirectIfNeeded();
  } catch (error) {
    if (error instanceof GoogleAuthError && error.code === 'CANCELED') {
      stashOAuthNotice(null);
    } else {
      stashOAuthNotice(describeGoogleAuthFailure(error));
    }
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
