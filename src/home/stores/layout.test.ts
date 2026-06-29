import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLayoutStore } from './layout'
import { DEFAULT } from '../grid/defaultLayout'

describe('useLayoutStore', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })

  it('loadInitial falls back to DEFAULT (tagged with ids) when no localStorage', () => {
    const s = useLayoutStore()
    s.loadInitial()
    expect(s.items).toHaveLength(DEFAULT.length)
    expect(s.items.every((i) => typeof i.id === 'string' && i.id.startsWith('i'))).toBe(true)
  })

  it('loadInitial sanitizes unknown widget keys from stored layout', () => {
    localStorage.setItem('nimoos-home-layout-v2', JSON.stringify([
      { kind: 'widget', key: 'health', c: 1, r: 1, w: 2, h: 2 }, // 已下线
      { kind: 'app', key: 'files', c: 3, r: 1, w: 1, h: 1 },
    ]))
    const s = useLayoutStore()
    s.loadInitial()
    expect(s.items).toHaveLength(1)
    expect(s.items[0].key).toBe('files')
  })

  it('serialize strips id', () => {
    const s = useLayoutStore(); s.loadInitial()
    expect(s.serialize()[0]).not.toHaveProperty('id')
  })

  it('remove drops the item by id', () => {
    const s = useLayoutStore(); s.loadInitial()
    const id = s.items[0].id
    s.remove(id)
    expect(s.items.find((i) => i.id === id)).toBeUndefined()
  })

  it('pin appends a tagged item', () => {
    const s = useLayoutStore(); s.loadInitial()
    const before = s.items.length
    s.pin({ kind: 'app', key: 'vm', c: 1, r: 1, w: 1, h: 1 })
    expect(s.items).toHaveLength(before + 1)
    expect(s.items[s.items.length - 1].id).toMatch(/^i\d+$/)
  })
})
