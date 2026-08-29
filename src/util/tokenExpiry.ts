// Token expiry pre-check: fire-and-forget channels like iframe downloads / WS handshakes
// never hit the axios 401 interceptor, so the only option is to refresh before
// connecting/sending when the token is about to expire. Introduced for P2c downloads, reused by P7 Drop and P6 terminal.

const REFRESH_BUFFER_MS = 60_000

// Conditional pre-refresh check before a download (fire-and-forget iframe, no reactive retry possible).
// expiresAt is unix seconds from the backend; if missing (null), refresh conservatively; refresh when expired or expiring within 60s.
export function shouldRefreshToken(expiresAt: number | null, now: number): boolean {
  if (expiresAt == null || !Number.isFinite(expiresAt)) return true
  return now > expiresAt * 1000 - REFRESH_BUFFER_MS
}
