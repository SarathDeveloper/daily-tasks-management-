/**
 * The web Google sign-in plugin uses the implicit flow. Tokens come back in
 * the URL hash (`#id_token=...&access_token=...`), never as `?code` or `?state`.
 */
function hashParams(href: string): URLSearchParams | null {
  try {
    const url = new URL(href);
    const raw = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
    if (!raw) return null;
    return new URLSearchParams(raw);
  } catch {
    return null;
  }
}

export function hasOAuthRedirectResult(href: string): boolean {
  const params = hashParams(href);
  if (!params) return false;
  return params.has('id_token') || params.has('access_token') || params.has('error');
}

/** The OAuth `error` code in the hash, such as `access_denied`. */
export function oauthHashError(href: string): string | null {
  return hashParams(href)?.get('error') ?? null;
}
