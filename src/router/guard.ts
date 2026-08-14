// Normal login logic (no /users/current probe):
// - Public routes (/login /welcome) pass; /login while logged in redirects home.
// - Protected + token → pass (pure existence check; expiry is handled by the shared package's single-flight refresh on 401).
// - Protected + token but missing version → clear token → /login (guards against half-initialized state).
// - Protected + no token → query status once: uninitialized → /welcome (store initKey), otherwise → /login; on query failure, conservatively → /login.
export interface GuardRoute {
  path: string
  meta?: { public?: boolean }
}
export interface AuthGuardDeps {
  getToken: () => string | null
  getVersion: () => string | null
  clearToken: () => void
  getStatus: () => Promise<{ initialized: boolean; key?: string }>
  onNeedInit: (key: string | undefined) => void
}

export function authGuard(deps: AuthGuardDeps) {
  return async (to: GuardRoute): Promise<true | string> => {
    const isPublic = to.meta?.public === true || to.path === '/login' || to.path === '/welcome'
    if (isPublic) {
      if (to.path === '/login' && deps.getToken()) return '/'
      return true
    }
    if (deps.getToken()) {
      if (!deps.getVersion()) { deps.clearToken(); return '/login' }
      return true
    }
    try {
      const st = await deps.getStatus()
      if (st.initialized === false) { deps.onNeedInit(st.key); return '/welcome' }
      return '/login'
    } catch {
      return '/login'
    }
  }
}
