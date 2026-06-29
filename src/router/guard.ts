export function authGuard(getToken: () => string | null, redirect: () => void) {
  return (_to: unknown): boolean => {
    if (getToken()) return true
    redirect()
    return false
  }
}
