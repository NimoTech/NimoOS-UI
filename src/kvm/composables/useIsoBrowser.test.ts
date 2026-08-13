import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useIsoBrowser } from './useIsoBrowser'

const api = { getList: vi.fn() }
vi.mock('@nimotech/nimoos-service', () => ({ service: { get folder() { return api } } }))

// Shape of real-device 2026-08-03 `GET /v1/folder?path=/DATA` (verbatim, including size).
const LISTING = { content: [
  { name: '.system_data', path: '/DATA/.system_data', is_dir: true, is_symlink: false, size: 4096 },
  { name: 'Amalfi Coast', path: '/DATA/Amalfi Coast', is_dir: true, is_symlink: false, size: 4096 },
  { name: '.wiki.md', path: '/DATA/.wiki.md', is_dir: false, is_symlink: false, size: 2558 },
  { name: 'alpine-319.iso', path: '/DATA/alpine-319.iso', is_dir: false, is_symlink: false, size: 62914560 },
] }

beforeEach(() => { api.getList.mockReset(); api.getList.mockResolvedValue(LISTING) })

describe('useIsoBrowser', () => {
  it('只保留目录与 .iso(照 Vue2 :310-313)', async () => {
    const s = useIsoBrowser(); await s.fetch('/DATA')
    expect(s.items.value.map((i) => i.name)).toEqual(['.system_data', 'Amalfi Coast', 'alpine-319.iso'])
    expect(s.path.value).toBe('/DATA')
  })

  it('请求期间 isLoading 为真、结束转假', async () => {
    let release: (v: unknown) => void = () => {}
    api.getList.mockReturnValue(new Promise((r) => { release = r }))
    const s = useIsoBrowser()
    const p = s.fetch('/DATA')
    expect(s.isLoading.value).toBe(true)
    release(LISTING); await p
    expect(s.isLoading.value).toBe(false)
  })

  it('失败时保留原 path、items 不变、isLoading 归位(照 Vue2 只 console.warn)', async () => {
    const s = useIsoBrowser(); await s.fetch('/DATA')
    api.getList.mockRejectedValue(new Error('EACCES'))
    await s.fetch('/DATA/secret')
    expect(s.path.value).toBe('/DATA')
    expect(s.items.value).toHaveLength(3)
    expect(s.isLoading.value).toBe(false)
  })

  it('up 退到父目录;根目录再 up 仍是根(照 Vue2 :323-326)', async () => {
    const s = useIsoBrowser(); await s.fetch('/DATA/Amalfi Coast')
    await s.up()
    expect(api.getList).toHaveBeenLastCalledWith('/DATA')
    await s.fetch('/'); await s.up()
    expect(api.getList).toHaveBeenLastCalledWith('/')
  })

  it('后到先得:两次 fetch 交错落定时,后发起的那次赢(过期守卫)', async () => {
    const rs: ((v: unknown) => void)[] = []
    api.getList.mockImplementation(() => new Promise((r) => { rs.push(r) }))
    const s = useIsoBrowser()
    const p1 = s.fetch('/A')
    const p2 = s.fetch('/B')
    rs[1]({ content: [{ name: 'b.iso', path: '/B/b.iso', is_dir: false, is_symlink: false, size: 1 }] })
    rs[0]({ content: [{ name: 'a.iso', path: '/A/a.iso', is_dir: false, is_symlink: false, size: 1 }] })
    await Promise.all([p1, p2])
    expect(s.path.value).toBe('/B')
    expect(s.items.value.map((i) => i.name)).toEqual(['b.iso'])
  })

  it('dispose 后落定不写 state', async () => {
    let release: (v: unknown) => void = () => {}
    api.getList.mockReturnValue(new Promise((r) => { release = r }))
    const s = useIsoBrowser()
    const p = s.fetch('/DATA')
    s.dispose(); release(LISTING); await p
    expect(s.items.value).toEqual([])
  })
})
