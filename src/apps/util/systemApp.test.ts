import { describe, it, expect } from 'vitest'
import { isSystemComposeApp } from './systemApp'
import type { ComposeAppWithStoreInfo } from '@nimotech/nimoos-service'

// Frontend equivalent of the backend's isSystemComposeApp (route/v2/internal_web.go):
// if any compose service has the label `nimoos.system == "true"` it is a behind-the-scenes system component
// and should be hidden from the user-facing app management page (agent runtime / Photos ML backend, etc.).

function withLabels(labels: Record<string, string>): ComposeAppWithStoreInfo {
  return { compose: { services: { main: { labels } } } } as never
}

describe('isSystemComposeApp', () => {
  it('任一 service 带 nimoos.system=true → 系统应用', () => {
    expect(isSystemComposeApp(withLabels({ 'nimoos.system': 'true' }))).toBe(true)
  })
  it('nimoos.system 非字符串 "true"(缺省 / 其它值)→ 非系统', () => {
    expect(isSystemComposeApp(withLabels({ 'nimoos.display_name': 'X' }))).toBe(false)
    expect(isSystemComposeApp(withLabels({ 'nimoos.system': 'false' }))).toBe(false)
  })
  it('多 service:只要有一个是系统标签即为系统', () => {
    const raw = { compose: { services: { a: { labels: {} }, b: { labels: { 'nimoos.system': 'true' } } } } } as never
    expect(isSystemComposeApp(raw)).toBe(true)
  })
  it('compose / services / labels 缺失或形态异常 → 保守判非系统(不误藏用户应用)', () => {
    expect(isSystemComposeApp({} as never)).toBe(false)
    expect(isSystemComposeApp({ compose: null } as never)).toBe(false)
    expect(isSystemComposeApp({ compose: { services: null } } as never)).toBe(false)
    expect(isSystemComposeApp({ compose: { services: { a: null } } } as never)).toBe(false)
    expect(isSystemComposeApp({ compose: { services: { a: { labels: null } } } } as never)).toBe(false)
  })
})
