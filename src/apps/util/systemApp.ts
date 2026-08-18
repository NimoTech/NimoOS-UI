import type { ComposeAppWithStoreInfo } from '@nimotech/nimoos-service'

/** System background component detection — front-end equivalent of isSystemComposeApp in backend route/v2/internal_web.go.
 *  If any service in compose has the label `nimoos.system == "true"`, it is a background component (AI agent runtime /
 *  Photos ML backend, etc.); the desktop appgrid already hides these. The app management page must also hide them,
 *  otherwise it will expose containers that users did not actively install.
 *  Abnormal structures are conservatively judged as non-system to avoid mistakenly hiding user applications. */
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
