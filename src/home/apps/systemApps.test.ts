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
