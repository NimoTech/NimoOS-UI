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
  it('if any service has nimoos.system=true → it is a system application', () => {
    expect(isSystemComposeApp(withLabels({ 'nimoos.system': 'true' }))).toBe(true)
  })
  it('nimoos.system not equal to the string "true" (absent / other values) → non-system', () => {
    expect(isSystemComposeApp(withLabels({ 'nimoos.display_name': 'X' }))).toBe(false)
    expect(isSystemComposeApp(withLabels({ 'nimoos.system': 'false' }))).toBe(false)
  })
  it('multiple services: if even one has the system label → it is a system app', () => {
    const raw = { compose: { services: { a: { labels: {} }, b: { labels: { 'nimoos.system': 'true' } } } } } as never
    expect(isSystemComposeApp(raw)).toBe(true)
  })
  it('compose / services / labels missing or malformed → conservatively judge as non-system (avoid mistakenly hiding user apps)', () => {
    expect(isSystemComposeApp({} as never)).toBe(false)
    expect(isSystemComposeApp({ compose: null } as never)).toBe(false)
    expect(isSystemComposeApp({ compose: { services: null } } as never)).toBe(false)
    expect(isSystemComposeApp({ compose: { services: { a: null } } } as never)).toBe(false)
    expect(isSystemComposeApp({ compose: { services: { a: { labels: null } } } } as never)).toBe(false)
  })
})
