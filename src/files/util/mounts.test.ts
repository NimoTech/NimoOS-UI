import { describe, it, expect } from 'vitest'
import { shouldNavigateHome } from './mounts'

describe('shouldNavigateHome', () => {
  it('当前就在被弹出挂载点 → true', () => {
    expect(shouldNavigateHome('/mnt/host', '/mnt/host')).toBe(true)
  })
  it('当前在其子目录 → true', () => {
    expect(shouldNavigateHome('/mnt/host/share/a', '/mnt/host')).toBe(true)
  })
  it('前缀相同但非同一挂载点(host vs host2)→ false', () => {
    expect(shouldNavigateHome('/mnt/host2', '/mnt/host')).toBe(false)
  })
  it('无关路径 → false', () => {
    expect(shouldNavigateHome('/DATA/Documents', '/mnt/host')).toBe(false)
  })
})
