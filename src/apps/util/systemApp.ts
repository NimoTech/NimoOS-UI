import type { ComposeAppWithStoreInfo } from '@nimotech/nimoos-service'

/** 系统幕后组件判定 —— 后端 route/v2/internal_web.go 的 isSystemComposeApp 前端等价物。
 *  compose 任一 service 的 label `nimoos.system == "true"` 即幕后组件(AI agent 运行时 /
 *  Photos ML 后端等),桌面 appgrid 已按此隐藏;应用管理页也须隐藏,不然会漏出用户没主动装的容器。
 *  形态异常一律保守判非系统,绝不误藏用户应用。 */
export function isSystemComposeApp(raw: ComposeAppWithStoreInfo): boolean {
  const compose = raw?.compose as { services?: unknown } | null | undefined
  const services = compose && typeof compose === 'object' ? compose.services : null
  if (!services || typeof services !== 'object') return false
  return Object.values(services as Record<string, unknown>).some((svc) => {
    const labels = svc && typeof svc === 'object' ? (svc as { labels?: unknown }).labels : null
    if (!labels || typeof labels !== 'object') return false
    return (labels as Record<string, unknown>)['nimoos.system'] === 'true'
  })
}
