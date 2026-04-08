import { apiFetch, ApiError } from './api';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  sub: string;
  email: string;
  role: string;
  planName: string;
}

// SECURITY NOTE: Tokens are stored in localStorage for simplicity in this phase.
// localStorage is vulnerable to XSS — any script on the page can read tokens.
// TODO: Migrate refresh token to httpOnly cookie set by the API server.
// The access token can stay in memory (React state) once that's done.
const ACCESS_TOKEN_KEY = 'clawix_access_token';
const REFRESH_TOKEN_KEY = 'clawix_refresh_token';

function sessionCookie(set: boolean): void {
  if (set) {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `clawix_has_session=1; path=/; SameSite=Lax${secure}`;
  } else {
    document.cookie = 'clawix_has_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }
}

export function getStoredTokens(): TokenPair | null {
  if (typeof window === 'undefined') return null;
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export function storeTokens(tokens: TokenPair): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  sessionCookie(true);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionCookie(false);
}

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseJwtPayload(token: string): AuthUser | null {
  const decoded = decodeJwt(token);
  if (!decoded) return null;
  return {
    sub: decoded['sub'] as string,
    email: decoded['email'] as string,
    role: decoded['role'] as string,
    planName: decoded['planName'] as string,
  };
}

export function isTokenExpired(token: string): boolean {
  const decoded = decodeJwt(token);
  if (!decoded || typeof decoded['exp'] !== 'number') return true;
  return decoded['exp'] * 1000 < Date.now();
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const tokens = await apiFetch<TokenPair>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  storeTokens(tokens);
  const user = parseJwtPayload(tokens.accessToken);
  if (!user) throw new Error('Invalid token received');
  return user;
}

// Mutex to prevent concurrent refresh calls from invalidating each other.
// The API rotates refresh tokens — only one call can succeed at a time.
let refreshPromise: Promise<TokenPair | null> | null = null;

async function doRefresh(): Promise<TokenPair | null> {
  const stored = getStoredTokens();
  if (!stored?.refreshToken) return null;

  try {
    const tokens = await apiFetch<TokenPair>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: stored.refreshToken }),
    });
    storeTokens(tokens);
    return tokens;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      clearTokens();
    }
    return null;
  }
}

export async function refreshTokens(): Promise<TokenPair | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function logout(): Promise<void> {
  const stored = getStoredTokens();
  if (stored?.refreshToken) {
    await apiFetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: stored.refreshToken }),
    }).catch(() => {
      /* ignore logout failure */
    });
  }
  clearTokens();
}

export async function getAccessToken(): Promise<string | null> {
  const stored = getStoredTokens();
  if (!stored) return null;

  if (!isTokenExpired(stored.accessToken)) {
    return stored.accessToken;
  }

  const refreshed = await refreshTokens();
  return refreshed?.accessToken ?? null;
}

/** Wrapper for authenticated API calls — auto-attaches JWT and refreshes if expired. */
export async function authFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new ApiError(401, 'Not authenticated');
  return apiFetch<T>(path, { ...options, accessToken: token });
}
