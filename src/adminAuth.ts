/**
 * Handles Admin Authentication:
 * 1. Cloudflare Access (Zero Trust) JWT cookie (CF_Authorization)
 * 2. Password fallback (stored in localStorage) for local testing or direct login
 */

export function getCFAccessToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith('CF_Authorization='));
  return match ? match.split('=').slice(1).join('=') : null;
}

export function getStoredAdminPassword(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('axozap_admin_password');
}

export function setStoredAdminPassword(password: string | null): void {
  if (typeof window === 'undefined') return;
  if (password) {
    localStorage.setItem('axozap_admin_password', password);
  } else {
    localStorage.removeItem('axozap_admin_password');
  }
}

export function adminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };

  const cfToken = getCFAccessToken();
  if (cfToken) {
    headers['cf-access-jwt-assertion'] = cfToken;
  }

  const pw = getStoredAdminPassword();
  if (pw) {
    headers['x-admin-password'] = pw;
  }

  return headers;
}
