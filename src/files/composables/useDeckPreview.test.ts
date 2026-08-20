import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useDeckPreview } from './useDeckPreview'

const getListMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { folder: { getList: (p: string) => getListMock(p) }, image: { thumbUrl: (p: string) => `/v1/image?path=${p}` } },
}))

const CONTENT = [
  { name: 'a.jpg', path: '/x/a.jpg', is_dir: false },
  { name: 'b.png', path: '/x/b.png', is_dir: false },
  { name: 'notes.txt', path: '/x/notes.txt', is_dir: false },
  { name: 'sub', path: '/x/sub', is_dir: true },
  { name: 'c.jpg', path: '/x/c.jpg', is_dir: false },
  { name: 'd.jpg', path: '/x/d.jpg', is_dir: false },
  { name: 'e.jpg', path: '/x/e.jpg', is_dir: false },
  { name: 'f.jpg', path: '/x/f.jpg', is_dir: false },
]
/** Directory exceeding MAX_TILES (200), used to verify truncation and total */
const BIG = Array.from({ length: 210 }, (_, i) => ({
  name: `f${String(i).padStart(3, '0')}.jpg`, path: `/x/f${i}.jpg`, is_dir: false,
}))

const setup = (names: string[], relPath = 'Photos') => {
  const visible = ref(names)
  const api = useDeckPreview({ mountPoint: () => '/DATA', relPath: () => relPath, visibleNames: () => visible.value })
  return { api, visible }
}
const flush = async () => { await new Promise((r) => setTimeout(r)); await nextTick() }

beforeEach(() => { vi.clearAllMocks(); getListMock.mockResolvedValue({ content: CONTENT }) })

describe('useDeckPreview', () => {
  it('fetches directory using <snapshot root>/<relative path>', async () => {
    setup(['snap1']); await flush()
    expect(getListMock).toHaveBeenCalledWith('/DATA/.snapshots/snap1/Photos')
  })
  it('fetches snapshot root when relative path is empty', async () => {
    setup(['snap1'], ''); await flush()
    expect(getListMock).toHaveBeenCalledWith('/DATA/.snapshots/snap1')
  })
  it('returns all entries when count is below limit; total is actual entry count', async () => {
    const { api } = setup(['snap1']); await flush()
    expect(api.previews.value.snap1.entries).toHaveLength(8)
    expect(api.previews.value.snap1.total).toBe(8)
    expect(api.previews.value.snap1.status).toBe('ready')
  })
  it('returns only 200 when exceeding limit; total is still actual count (card calculates +N from total-entries)', async () => {
    getListMock.mockResolvedValue({ content: BIG })
    const { api } = setup(['snap1']); await flush()
    expect(api.previews.value.snap1.entries).toHaveLength(200)
    expect(api.previews.value.snap1.total).toBe(210)
  })
  it('returns backend entries as-is (card feeds them directly to FileThumb, no image filtering)', async () => {
    const { api } = setup(['snap1']); await flush()
    const entries = api.previews.value.snap1.entries
    expect(entries.find((e) => e.name === 'notes.txt')).toMatchObject({ path: '/x/notes.txt', is_dir: false })
    expect(entries.find((e) => e.name === 'sub')?.is_dir).toBe(true)
  })
  it('sorts by file grid default rules: folders first, then by name ascending (same order as entering snapshot)', async () => {
    getListMock.mockResolvedValue({
      content: [
        { name: 'zeta.txt', path: '/x/zeta.txt', is_dir: false },
        { name: 'Alpha.txt', path: '/x/Alpha.txt', is_dir: false },
        { name: 'zdir', path: '/x/zdir', is_dir: true },
        { name: 'adir', path: '/x/adir', is_dir: true },
      ],
    })
    const { api } = setup(['snap1']); await flush()
    expect(api.previews.value.snap1.entries.map((e) => e.name)).toEqual(['adir', 'zdir', 'Alpha.txt', 'zeta.txt'])
  })
  it('fetches same snapshot name only once (scrolling back and forth does not repeat requests)', async () => {
    const { visible } = setup(['snap1']); await flush()
    visible.value = ['snap2']; await flush()
    visible.value = ['snap1']; await flush()
    expect(getListMock).toHaveBeenCalledTimes(2)
  })
  // 🔴 The one the production device actually sends. NimoOS core's file API answers
  // HTTP 500 with envelope code 60001 (FILE_DOES_NOT_EXIST) for an absent path, never 404 —
  // measured: GET /v1/file?path=/DATA/.snapshots/<absent>/Photos
  // -> 500 {"success":60001,"message":"File does not exist"}. While only 404 was recognised,
  // every absent folder resolved to 'failed', so the card never said "this folder did not exist
  // yet" and enterSnapshot happily composed the missing sub-path. The 404 case below stays: the
  // shared package can surface a real network 404 through the same path.
  it('directory does not exist in snapshot → missing, when the backend says so with code 60001', async () => {
    getListMock.mockRejectedValue(Object.assign(new Error('File does not exist'), { code: 60001 }))
    const api = useDeckPreview({ mountPoint: () => '/DATA', relPath: () => 'Photos', visibleNames: () => ['snap1'] })
    await flush()
    expect(api.previews.value.snap1.status).toBe('missing')
  })
  // The shape the production device really throws, captured with a CDP probe against the running
  // device: HTTP 500, axios's own STRING code, and the envelope carried on response.data. The
  // string code is the trap -- the helper this replaced returned it in place of the status, so
  // every numeric comparison downstream was dead code.
  it('the real AxiosError shape (HTTP 500 + string code + envelope 60001) resolves to missing', async () => {
    getListMock.mockRejectedValue(Object.assign(new Error('Fail'), {
      name: 'AxiosError',
      code: 'ERR_BAD_RESPONSE',
      response: { status: 500, data: { success: 60001, message: 'File does not exist', data: null } },
    }))
    const api = useDeckPreview({ mountPoint: () => '/DATA', relPath: () => 'Photos', visibleNames: () => ['snap1'] })
    await flush()
    expect(api.previews.value.snap1.status).toBe('missing')
  })
  it('a code that is neither 404 nor 60001 is a failure, not a missing folder', async () => {
    getListMock.mockRejectedValue(Object.assign(new Error('boom'), { code: 60002 }))
    const api = useDeckPreview({ mountPoint: () => '/DATA', relPath: () => 'Photos', visibleNames: () => ['snap1'] })
    await flush()
    expect(api.previews.value.snap1.status).toBe('failed')
  })
  it('directory does not exist in snapshot → missing', async () => {
    getListMock.mockRejectedValue(Object.assign(new Error('no'), { code: 404 }))
    const { api } = setup(['snap1']); await flush()
    expect(api.previews.value.snap1.status).toBe('missing')
  })
  it('other failures → failed (silently degrades, does not throw)', async () => {
    getListMock.mockRejectedValue(new Error('boom'))
    const { api } = setup(['snap1']); await flush()
    expect(api.previews.value.snap1.status).toBe('failed')
  })
  it('empty directory → ready + 0 entries + total 0', async () => {
    getListMock.mockResolvedValue({ content: [] })
    const { api } = setup(['snap1']); await flush()
    expect(api.previews.value.snap1).toMatchObject({ status: 'ready', total: 0 })
  })
  it('fetches newly visible snapshots when visible set changes', async () => {
    const { visible } = setup(['snap1']); await flush()
    visible.value = ['snap1', 'snap2', 'snap3']; await flush()
    expect(getListMock).toHaveBeenCalledTimes(3)
  })
  it('clears cache and re-fetches when relative path changes (different directories cannot reuse cache)', async () => {
    const relPath = ref('Photos')
    const visible = ref(['snap1'])
    useDeckPreview({ mountPoint: () => '/DATA', relPath: () => relPath.value, visibleNames: () => visible.value })
    await flush()
    relPath.value = 'Docs'; await flush()
    expect(getListMock).toHaveBeenLastCalledWith('/DATA/.snapshots/snap1/Docs')
    expect(getListMock).toHaveBeenCalledTimes(2)
  })
  it('after switching directories, stale response from old directory cannot overwrite new directory already landed (interleaved responses)', async () => {
    let resolveA: (v: unknown) => void = () => {}
    let resolveB: (v: unknown) => void = () => {}
    getListMock.mockImplementation((p: string) => {
      if (p.endsWith('/A')) return new Promise((res) => { resolveA = res })
      if (p.endsWith('/B')) return new Promise((res) => { resolveB = res })
      return Promise.resolve({ content: [] })
    })
    const relPath = ref('A')
    const visible = ref(['snap1'])
    const api = useDeckPreview({ mountPoint: () => '/DATA', relPath: () => relPath.value, visibleNames: () => visible.value })
    await flush() // Request for A sent, still in flight

    relPath.value = 'B'
    await flush() // Switch directory: previews cleared, request for B sent, still in flight

    // B (new directory) lands first
    resolveB({ content: [{ name: 'b.jpg', path: '/y/b.jpg', is_dir: false }] })
    await flush()
    expect(api.previews.value.snap1.entries.map((t) => t.name)).toEqual(['b.jpg'])

    // A (old directory) lands late — cannot overwrite B's already written content
    resolveA({ content: [{ name: 'a.jpg', path: '/x/a.jpg', is_dir: false }] })
    await flush()
    expect(api.previews.value.snap1.entries.map((t) => t.name)).toEqual(['b.jpg'])
  })

  it('retries a preview that failed once the visible set changes again', async () => {
    getListMock.mockRejectedValueOnce(new Error('network')).mockResolvedValue({ content: CONTENT })
    const { api, visible } = setup(['snap1'])
    await flush()
    expect(api.previews.value.snap1.status).toBe('failed')

    visible.value = ['snap1', 'snap2'] // dial the ring one notch
    await flush()
    expect(api.previews.value.snap1.status).toBe('ready')
  })

  it('does not retry a preview that came back 404 (missing)', async () => {
    // "no such folder at that point in time" is a stable fact, not a blip -- retrying is just a wasted request.
    getListMock.mockRejectedValue(Object.assign(new Error('no'), { code: 404 }))
    const { api, visible } = setup(['snap1'])
    const snap1Calls = () => getListMock.mock.calls.filter((c) => String(c[0]).includes('snap1')).length

    await flush()
    expect(api.previews.value.snap1.status).toBe('missing')
    expect(snap1Calls()).toBe(1)

    visible.value = ['snap1', 'snap2'] // dial the ring one notch
    await flush()
    expect(snap1Calls()).toBe(1) // still 1: missing is never retried
  })
})
