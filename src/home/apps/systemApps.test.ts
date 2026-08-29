import { describe, it, expect } from 'vitest'
import { SYSTEM_APPS, SYSTEM_APP_KEYS } from './systemApps'

describe('SYSTEM_APPS -- knowledge (SP14 #98)', () => {
  it('knowledge is registered with an i18n label and an icon', () => {
    const k = SYSTEM_APPS.find((a) => a.key === 'knowledge')
    expect(k).toBeDefined()
    expect(k!.label).toBe('appKnowledge')
    expect(k!.icon).toBeTruthy()
  })

  it('keys are unique (Dock and AddPanel both dedupe by key)', () => {
    expect(new Set(SYSTEM_APP_KEYS).size).toBe(SYSTEM_APP_KEYS.length)
  })
})

describe('SYSTEM_APPS -- optional services (SP17 #125, extended SP18 #terminal)', () => {
  it('kvm and terminal are the tiles gated on a service being reachable', () => {
    const gated = SYSTEM_APPS.filter((a) => a.requiresService)
    expect(gated.map((a) => a.key)).toEqual(['vm', 'terminal'])
    expect(gated.map((a) => a.requiresService)).toEqual(['kvm', 'terminal'])
  })

  it('terminal is the only tile additionally gated on admin role (SP18)', () => {
    const adminOnly = SYSTEM_APPS.filter((a) => a.adminOnly)
    expect(adminOnly.map((a) => a.key)).toEqual(['terminal'])
  })
})
