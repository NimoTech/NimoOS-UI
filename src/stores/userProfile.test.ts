import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUserProfile } from './userProfile'

describe('useUserProfile', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('avatarVersion starts at 1', () => {
    const p = useUserProfile()
    expect(p.avatarVersion).toBe(1)
  })

  it('bumpAvatarVersion increments avatarVersion', () => {
    const p = useUserProfile()
    p.bumpAvatarVersion()
    expect(p.avatarVersion).toBe(2)
    p.bumpAvatarVersion()
    expect(p.avatarVersion).toBe(3)
  })
})
