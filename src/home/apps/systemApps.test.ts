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

describe('SYSTEM_APPS -- optional services (SP17 #125)', () => {
  it('kvm is the only tile gated on a service being reachable', () => {
    const gated = SYSTEM_APPS.filter((a) => a.requiresService)
    expect(gated.map((a) => a.key)).toEqual(['vm'])
    expect(gated[0].requiresService).toBe('kvm')
  })
})
