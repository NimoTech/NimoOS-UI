// 正常登录逻辑(无 /users/current 探针):
// - 公开路由(/login /welcome)放行;/login 已登录则回首页。
// - 受保护 + 有 token → 放行(纯存在性;失效由共享包 401 单飞刷新兜底)。
// - 受保护 + 有 token 缺 version → 清 token → /login(防半初始化)。
// - 受保护 + 无 token → 查一次 status:未初始化→/welcome(存 initKey),否则→/login;查询失败保守→/login。
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
      if (!st.initialized) { deps.onNeedInit(st.key); return '/welcome' }
      return '/login'
    } catch {
      return '/login'
    }
  }
}
