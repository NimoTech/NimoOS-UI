// Bounded retry for a one-shot request. `delays` are the waits BETWEEN attempts,
// so N delays means at most N+1 attempts; the default spans roughly 4s, which
// covers a service restart window or a transient backend stall.
//
// Why this exists: the sidebar's storage list used to give up after a single
// failure, leaving the Location list permanently empty (and, downstream, the
// whole Files page blank because there is no default root to navigate to).
export async function retryRequest<T>(fn: () => Promise<T>, delays: number[] = [1000, 3000]): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (i < delays.length) await new Promise((r) => setTimeout(r, delays[i]))
    }
  }
  throw lastErr
}
