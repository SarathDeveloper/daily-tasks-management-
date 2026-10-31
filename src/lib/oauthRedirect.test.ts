import { describe, expect, it } from 'vitest';
import { hasOAuthRedirectResult, oauthHashError } from './oauthRedirect';

describe('hasOAuthRedirectResult', () => {
  it('recognizes the implicit-flow hash the plugin returns', () => {
    expect(
      hasOAuthRedirectResult(
        'http://localhost:3000/#id_token=abc&access_token=def&state=xyz&token_type=Bearer'
      )
    ).toBe(true);
  });

  it('recognizes an error returned in the hash', () => {
    expect(hasOAuthRedirectResult('http://localhost:3000/#error=access_denied&state=xyz')).toBe(
      true
    );
  });

  it('ignores authorization-code query params, which this flow does not use', () => {
    expect(hasOAuthRedirectResult('http://localhost:3000/?code=abc&state=xyz')).toBe(false);
  });

  it('ignores a normal app url', () => {
    expect(hasOAuthRedirectResult('http://localhost:3000/')).toBe(false);
    expect(hasOAuthRedirectResult('http://localhost:3000/#today')).toBe(false);
  });
});

describe('oauthHashError', () => {
  it('keeps the error code when a description is also present', () => {
    expect(
      oauthHashError(
        'http://localhost:3000/#error=access_denied&error_description=The+user+denied+the+request&state=xyz'
      )
    ).toBe('access_denied');
  });

  it('returns null when the hash has no error', () => {
    expect(oauthHashError('http://localhost:3000/#id_token=abc&access_token=def')).toBeNull();
  });
});
