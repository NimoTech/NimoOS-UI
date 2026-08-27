import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSnapshotBrowseStore } from './snapshotBrowse'
import { useFilesStore } from './files'
import { useFileConflictsStore } from './fileConflicts'
import { useToast } from '../../stores/toast'
import { router } from '../../router'

const listVolumesMock = vi.fn()
const restoreMock = vi.fn()
const listSnapshotsMock = vi.fn()
const getListMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    snapshot: {
      listVolumes: () => listVolumesMock(),
      restore: (b: unknown) => restoreMock(b),
      list: (uuid: string) => listSnapshotsMock(uuid),
    },
    folder: { getList: (p: string) => getListMock(p) },
  },
}))
// The store navigates through the real router singleton (see snapshotBrowse.ts's own comment on
// navigateReal for why: it must go through the same virtual-path route encoding Files.vue's own
// goVirtual() uses). Mocked the same way src/home/composables/useOpenAction.test.ts already does.
vi.mock('../../router', () => ({ router: { push: vi.fn(), replace: vi.fn() } }))

const VOLS = [
  { volume_uuid: 'u-data', mount: '/DATA', supported: true },
  { volume_uuid: 'u-usb', mount: '/mnt/usb', supported: false },
]

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  listVolumesMock.mockResolvedValue(VOLS)
  listSnapshotsMock.mockResolvedValue([])
  getListMock.mockResolvedValue({ content: [] })
  // Task 7 fix round: `mockReset()`, not `mockClear()` -- a test further down
  // ("sets tmTravel around the navigation, clears it once settled") installs a custom
  // `mockImplementation` on `router.replace` to control timing; `mockClear()` alone only wipes
  // call history, leaving that implementation (a promise nothing else will ever resolve) to leak
  // into every later test that calls switchTo, hanging them until the suite's own timeout.
  vi.mocked(router.push).mockReset()
  vi.mocked(router.replace).mockReset()
})

describe('ensureVolumes', () => {
  it('fetch once should reach ready', async () => {
    const s = useSnapshotBrowseStore()
    expect(s.status).toBe('idle')
    await s.ensureVolumes()
    expect(s.status).toBe('ready')
    expect(s.volumes).toEqual(VOLS)
    expect(listVolumesMock).toHaveBeenCalledTimes(1)
  })
  it('repeated calls should not repeat the request (once per session)', async () => {
    const s = useSnapshotBrowseStore()
    await s.ensureVolumes()
    await s.ensureVolumes()
    expect(listVolumesMock).toHaveBeenCalledTimes(1)
  })
  it('concurrent calls should share the same in-flight request', async () => {
    let release: (v: unknown) => void = () => {}
    listVolumesMock.mockImplementation(() => new Promise((r) => { release = r }))
    const s = useSnapshotBrowseStore()
    const a = s.ensureVolumes()
    const b = s.ensureVolumes()
    expect(s.status).toBe('loading')
    release(VOLS)
    await Promise.all([a, b])
    expect(listVolumesMock).toHaveBeenCalledTimes(1)
    expect(s.status).toBe('ready')
  })
  it('failure should reach error state without throwing (snapshots are optional, old backends return 404)', async () => {
    listVolumesMock.mockRejectedValue(new Error('404'))
    const s = useSnapshotBrowseStore()
    await expect(s.ensureVolumes()).resolves.toBeUndefined()
    expect(s.status).toBe('error')
    expect(s.volumes).toEqual([])
  })
  it('should degrade to empty list when return value is not an array', async () => {
    listVolumesMock.mockResolvedValue(null)
    const s = useSnapshotBrowseStore()
    await s.ensureVolumes()
    expect(s.volumes).toEqual([])
    expect(s.status).toBe('ready')
  })
  it('reset should supersede in-flight requests, stale responses should not clobber results of new requests after reset', async () => {
    let releaseStale: (v: unknown) => void = () => {}
    listVolumesMock.mockImplementationOnce(() => new Promise((r) => { releaseStale = r }))
    const s = useSnapshotBrowseStore()

    const stale = s.ensureVolumes() // P1 in flight, not yet resolved
    expect(s.status).toBe('loading')

    s.reset() // supersedes the P1 generation
    expect(s.status).toBe('idle')

    const FRESH = [{ volume_uuid: 'u-fresh', mount: '/DATA2', supported: true }]
    listVolumesMock.mockImplementationOnce(() => Promise.resolve(FRESH))
    const fresh = s.ensureVolumes() // P2: the new generation started after reset
    await fresh
    expect(s.status).toBe('ready')
    expect(s.volumes).toEqual(FRESH)

    // Only now release P1's resolve — the stale response must be discarded entirely, never clobbering P2's already-landed result
    releaseStale(VOLS)
    await stale
    expect(s.status).toBe('ready')
    expect(s.volumes).toEqual(FRESH)
  })
})

describe('browse state derivation', () => {
  it('normal paths should not be snapshot views', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/Photos'
    await s.ensureVolumes()
    expect(s.isSnapshotView).toBe(false)
    expect(s.browseInfo).toBeNull()
  })
  it('snapshot path + supported volume → locked, browseInfo should have result', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/.snapshots/snap1/Photos'
    await s.ensureVolumes()
    expect(s.isSnapshotView).toBe(true)
    expect(s.browseInfo).toEqual({ mount: '/DATA', snapshotName: 'snap1', relPath: 'Photos' })
  })
  it('snapshot path should stay locked even when volume list has not been fetched (fail-safe)', () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/.snapshots/snap1'
    expect(s.status).toBe('idle')
    expect(s.isSnapshotView).toBe(true)
  })
  it('ordinary .snapshots directory on unsupported (supported:false) mounts should not be locked', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/mnt/usb/.snapshots/whatever'
    await s.ensureVolumes()
    expect(s.isSnapshotView).toBe(false)
  })
  // Review fix (Critical 1): the `.snapshots` container directory itself (path without a concrete snapshot name) —
  // parseSnapshotBrowsePath returns null for it, shouldGuardSnapshotView alone can't decide to lock, so
  // isSnapshotsContainerPath must catch it. The breadcrumb's most natural "go up one level" gesture lands exactly on this path.
  it('.snapshots container directory itself (without a specific snapshot selected) should also stay locked', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/.snapshots'
    await s.ensureVolumes()
    expect(s.isSnapshotView).toBe(true)
    expect(s.browseInfo).toBeNull() // no snapshot name means no timestamp to show; the banner's current shape relies on this
  })

  // Review recheck (Critical 1, round 2): the previous round's implementation decided the container path via volumes.some(...),
  // which is always false while volumes is empty (idle/loading/error) — a real probe confirmed all three states leaked the lock, and error
  // is ensureVolumes()'s terminal state for the session (this device 404s on all of /v2/snapshot/*), so the leak persists for the whole session.
  // These three cases each independently trigger one of the three states a real probe can capture, no longer relying on inference.
  describe('.snapshots container directory three-state recheck (Critical 1 round 2: the previous round leaked lock here)', () => {
    it('idle (volumes not yet fetched) → should stay locked', () => {
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/.snapshots'
      expect(s.status).toBe('idle')
      expect(s.isSnapshotView).toBe(true)
    })
    it('loading (request in flight) → should stay locked', () => {
      let release: (v: unknown) => void = () => {}
      listVolumesMock.mockImplementation(() => new Promise((r) => { release = r }))
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/.snapshots'
      s.ensureVolumes()
      expect(s.status).toBe('loading')
      expect(s.isSnapshotView).toBe(true)
      release(VOLS) // cleanup: keep the dangling in-flight promise from leaking into the next case
    })
    it('error (fetch failed, terminal state for this session) → should stay locked', async () => {
      listVolumesMock.mockRejectedValue(new Error('404'))
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/.snapshots'
      await s.ensureVolumes()
      expect(s.status).toBe('error')
      expect(s.isSnapshotView).toBe(true)
    })
    it('ready with unsupported mount (supported:false), container directory itself should not be locked', async () => {
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/mnt/usb/.snapshots'
      await s.ensureVolumes()
      expect(s.status).toBe('ready')
      expect(s.isSnapshotView).toBe(false)
    })
  })
})

describe('canShowEntry truth table', () => {
  it('ready + hits supported volume + not in snapshot → should show', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/Photos'
    await s.ensureVolumes()
    expect(s.canShowEntry).toBe(true)
  })
  it('not yet ready → should not show (avoid flashing)', () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/Photos'
    expect(s.canShowEntry).toBe(false)
  })
  it('path does not belong to any snapshot volume → should not show', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/mnt/smb-host/x'
    await s.ensureVolumes()
    expect(s.canShowEntry).toBe(false)
  })
  it('volume with supported:false → should not show', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/mnt/usb/x'
    await s.ensureVolumes()
    expect(s.canShowEntry).toBe(false)
  })
  it('already in snapshot → should not show', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/.snapshots/snap1'
    await s.ensureVolumes()
    expect(s.canShowEntry).toBe(false)
  })
  it('.snapshots container directory itself → should not show (Critical 1, otherwise time machine chip and read-only lock both appear together)', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/.snapshots'
    await s.ensureVolumes()
    expect(s.canShowEntry).toBe(false)
  })
})

// Task 6: wheelOpen/openWheel/closeWheel are gone (Ruling P2 — the retired wheel component tree
// that read them is deleted in this same task). tmActive/enterTimeMachine/exitTimeMachine/switchTo
// replace that whole toggle, driving TimeMachineStage.vue instead.
describe('time machine: enter / exit / switch', () => {
  const SNAPS = [
    { id: 1, name: '20260810T090000Z_auto', created_at: '2026-08-10T09:00:00Z' },
    { id: 2, name: '20260812T090000Z_manual_x', created_at: '2026-08-12T09:00:00Z' },
    { id: 3, name: '20260811T090000Z_auto', created_at: '2026-08-11T09:00:00Z' },
  ]

  describe('enterTimeMachine', () => {
    it('fetches the snapshot list, navigates to the newest snapshot at the current relative path, and sets tmActive', async () => {
      listSnapshotsMock.mockResolvedValue(SNAPS)
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/Photos/2024'
      await s.ensureVolumes()
      expect(s.tmActive).toBe(false)

      await s.enterTimeMachine()

      expect(s.tmActive).toBe(true)
      expect(listSnapshotsMock).toHaveBeenCalledWith('u-data')
      // Newest-first by created_at, regardless of the backend's own return order.
      expect(s.snapshotList.map((x) => x.name)).toEqual([
        '20260812T090000Z_manual_x', '20260811T090000Z_auto', '20260810T090000Z_auto',
      ])
      expect(router.push).toHaveBeenCalledWith(
        expect.stringContaining('.snapshots/20260812T090000Z_manual_x/Photos/2024'),
      )
    })
    it('does nothing when the entry button would not show (e.g. already in a snapshot view)', async () => {
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/.snapshots/snap1/Photos'
      await s.ensureVolumes()
      expect(s.canShowEntry).toBe(false)
      await s.enterTimeMachine()
      expect(s.tmActive).toBe(false)
      expect(listSnapshotsMock).not.toHaveBeenCalled()
    })
    it('with no snapshots yet, still activates the stage but does not navigate', async () => {
      listSnapshotsMock.mockResolvedValue([])
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/Photos'
      await s.ensureVolumes()
      await s.enterTimeMachine()
      expect(s.tmActive).toBe(true)
      expect(s.snapshotList).toEqual([])
      expect(router.push).not.toHaveBeenCalled()
    })
    it('tmLoading is true while the list fetch is in flight, false once settled', async () => {
      let release: (v: unknown) => void = () => {}
      listSnapshotsMock.mockImplementation(() => new Promise((r) => { release = r }))
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/Photos'
      await s.ensureVolumes()
      const p = s.enterTimeMachine()
      await vi.waitFor(() => expect(s.tmLoading).toBe(true))
      release(SNAPS)
      await p
      expect(s.tmLoading).toBe(false)
    })
  })

  // Task 10: deep-link auto-enter. shouldAutoEnter truth table mirrors canShowEntry's own
  // (above) but with the polarity/shape flipped -- true only INSIDE a confirmed-supported
  // snapshot path, never outside one.
  describe('shouldAutoEnter truth table', () => {
    it('① normal (non-snapshot) path → false', async () => {
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/Photos'
      await s.ensureVolumes()
      expect(s.shouldAutoEnter).toBe(false)
    })
    it('② `.snapshots` path but the volume is not yet confirmed (still loading) → false', () => {
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/.snapshots/snap1/Photos'
      // Deliberately not awaiting ensureVolumes(): status stays 'loading' here.
      s.ensureVolumes()
      expect(s.status).toBe('loading')
      expect(s.shouldAutoEnter).toBe(false)
    })
    it('② `.snapshots` path on a volume confirmed supported:false → false (never guess)', async () => {
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/mnt/usb/.snapshots/snap1/Photos'
      await s.ensureVolumes()
      expect(s.shouldAutoEnter).toBe(false)
    })
    it('③ `.snapshots` path on a confirmed supported:true volume → true', async () => {
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/.snapshots/snap1/Photos'
      await s.ensureVolumes()
      expect(s.shouldAutoEnter).toBe(true)
    })
    it('the bare `.snapshots` container path (no snapshot name) → false (nothing to land on)', async () => {
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/.snapshots'
      await s.ensureVolumes()
      expect(s.shouldAutoEnter).toBe(false)
    })
  })

  describe('autoEnterTimeMachine', () => {
    it('sets tmActive and fetches the snapshot list, without navigating', async () => {
      listSnapshotsMock.mockResolvedValue(SNAPS)
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/.snapshots/snap1/Photos'
      await s.ensureVolumes()
      expect(s.tmActive).toBe(false)

      await s.autoEnterTimeMachine()

      expect(s.tmActive).toBe(true)
      expect(listSnapshotsMock).toHaveBeenCalledWith('u-data')
      expect(s.snapshotList.map((x) => x.name)).toEqual([
        '20260812T090000Z_manual_x', '20260811T090000Z_auto', '20260810T090000Z_auto',
      ])
      expect(router.push).not.toHaveBeenCalled()
      expect(router.replace).not.toHaveBeenCalled()
    })
    // ④ already tmActive → no double-trigger: a second call (e.g. the watcher re-evaluating on
    // an unrelated reactive change while shouldAutoEnter stays true) must not refetch.
    it('is a no-op when already active (case ④, no double-trigger)', async () => {
      listSnapshotsMock.mockResolvedValue(SNAPS)
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/.snapshots/snap1/Photos'
      await s.ensureVolumes()
      await s.autoEnterTimeMachine()
      listSnapshotsMock.mockClear()

      await s.autoEnterTimeMachine()

      expect(listSnapshotsMock).not.toHaveBeenCalled()
    })
    it('tmLoading is true while the list fetch is in flight, false once settled', async () => {
      let release: (v: unknown) => void = () => {}
      listSnapshotsMock.mockImplementation(() => new Promise((r) => { release = r }))
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/.snapshots/snap1/Photos'
      await s.ensureVolumes()
      const p = s.autoEnterTimeMachine()
      await vi.waitFor(() => expect(s.tmLoading).toBe(true))
      release(SNAPS)
      await p
      expect(s.tmLoading).toBe(false)
    })
  })

  describe('currentSnapshotName', () => {
    it('derives the snapshot name from the current path while in a snapshot view', async () => {
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/.snapshots/snap1/Photos'
      await s.ensureVolumes()
      expect(s.currentSnapshotName).toBe('snap1')
    })
    it('is null outside a snapshot view', async () => {
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/Photos'
      await s.ensureVolumes()
      expect(s.currentSnapshotName).toBeNull()
    })
  })

  describe('exitTimeMachine', () => {
    it('clears tmActive synchronously and navigates to the live directory of the current relative path', async () => {
      getListMock.mockResolvedValue({ content: [] }) // directory exists on the live volume
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/.snapshots/snap1/Photos'
      await s.ensureVolumes()

      s.exitTimeMachine()
      expect(s.tmActive).toBe(false) // synchronous, does not wait on the existence check below

      await vi.waitFor(() => expect(router.push).toHaveBeenCalled())
      expect(getListMock).toHaveBeenCalledWith('/DATA/Photos')
      expect(router.push).toHaveBeenCalledWith(expect.stringContaining('Photos'))
    })
    // Task 7 fix round: a stuck-true tmTravelActive (e.g. the depth-stack component was
    // unmounted mid-travel, so nothing was ever going to call settleTravel()) must not survive
    // past leaving Time Machine mode entirely.
    it('clears a stuck tmTravelActive synchronously too', async () => {
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/.snapshots/snap1/Photos'
      await s.ensureVolumes()
      await s.switchTo('snap2')
      expect(s.tmTravelActive).toBe(true)

      s.exitTimeMachine()
      expect(s.tmTravelActive).toBe(false)
    })
    it('falls back to the volume root when the live directory no longer exists', async () => {
      getListMock.mockRejectedValue(new Error('404'))
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/.snapshots/snap1/Photos'
      await s.ensureVolumes()

      s.exitTimeMachine()
      await vi.waitFor(() => expect(router.push).toHaveBeenCalled())
      expect(router.push).not.toHaveBeenCalledWith(expect.stringContaining('Photos'))
    })
    it('is a no-op navigation when not actually in a snapshot view (still clears tmActive)', async () => {
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/Photos'
      await s.ensureVolumes()
      s.tmActive = true
      s.exitTimeMachine()
      expect(s.tmActive).toBe(false)
      expect(router.push).not.toHaveBeenCalled()
    })
  })

  // Final review (Important 5, Ruling F-2): Vue2's own isTimeMachineChromeVisible held-chrome
  // exit -- ported as tmChromeVisible (see that field's own header comment in snapshotBrowse.ts
  // for the full token+timer mechanism this block exercises). Drives TimeMachineStage.vue's own
  // `active` and Files.vue's own bannerInfo/bannerIsContainer -- NOT tmActive directly -- so the
  // un-shrinking real window never flashes the OLD snapshot listing + banner mid-exit.
  describe('tmChromeVisible (final review, Ruling F-2: held-chrome exit)', () => {
    it('entering sets tmChromeVisible immediately, in lockstep with tmActive', async () => {
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/Photos'
      await s.ensureVolumes()
      expect(s.tmChromeVisible).toBe(false)

      await s.enterTimeMachine()
      expect(s.tmActive).toBe(true)
      expect(s.tmChromeVisible).toBe(true)
    })

    it('exiting while the exit target has not landed HOLDS tmChromeVisible true (no banner flash) until it does', async () => {
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/.snapshots/snap1/Photos'
      await s.ensureVolumes()
      s.tmActive = true
      expect(s.tmChromeVisible).toBe(true)

      s.exitTimeMachine()
      expect(s.tmActive).toBe(false) // drops synchronously, Vue2 parity, unchanged by this fix
      expect(s.tmChromeVisible).toBe(true) // HELD -- nothing has navigated the read-only lock off yet
      expect(s.isSnapshotView).toBe(true) // still inside guarded content: the exact flash this fix avoids

      // Simulate the exit navigation actually landing (Files.vue's own route watcher -> files.load()
      // in production, which flips currentPath/loading together in one synchronous burst -- see
      // isExitTargetReady's own comment): files.currentPath moves off the snapshot path.
      files.currentPath = '/DATA/Photos'
      expect(s.tmChromeVisible).toBe(false) // released the instant isExitTargetReady flips true
    })

    it('does not hold when the exit target is already ready at exit time (e.g. a re-entrant no-op exit)', async () => {
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/Photos' // never actually inside a snapshot view
      await s.ensureVolumes()
      s.tmActive = true
      expect(s.tmChromeVisible).toBe(true)

      s.exitTimeMachine()
      expect(s.tmChromeVisible).toBe(false) // isExitTargetReady already true -- drops immediately, no hold
    })

    it('safety cap fires if the navigation hangs, releasing the chrome regardless', async () => {
      vi.useFakeTimers()
      try {
        const s = useSnapshotBrowseStore(); const files = useFilesStore()
        files.currentPath = '/DATA/.snapshots/snap1/Photos'
        await s.ensureVolumes()
        s.tmActive = true
        s.exitTimeMachine()
        expect(s.tmChromeVisible).toBe(true)

        await vi.advanceTimersByTimeAsync(6000) // EXIT_CHROME_HOLD_SAFETY_TIMEOUT_MS
        expect(s.tmChromeVisible).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })

    it('a re-enter during the hold is token-safe: the superseded hold\'s own safety timer cannot fire later and clobber the new one', async () => {
      vi.useFakeTimers()
      try {
        const s = useSnapshotBrowseStore(); const files = useFilesStore()
        files.currentPath = '/DATA/.snapshots/snap1/Photos'
        await s.ensureVolumes()
        s.tmActive = true
        s.exitTimeMachine() // starts the hold (target not ready yet)
        expect(s.tmChromeVisible).toBe(true)

        await vi.advanceTimersByTimeAsync(1000) // well before the 6000ms safety cap
        s.tmActive = true // re-enter while still held
        expect(s.tmChromeVisible).toBe(true)

        // Advance past when the FIRST hold's own safety timer would have fired -- it must not
        // still be armed (the re-entry's own watcher run bumped the token and cleared it).
        await vi.advanceTimersByTimeAsync(6000)
        expect(s.tmChromeVisible).toBe(true) // still true: the re-entry wins, not a stale timer
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('switchTo', () => {
    it('navigates the same window to the same relative path in the target snapshot, via replace (one history entry per session)', async () => {
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/.snapshots/snap1/Photos/2024'
      await s.ensureVolumes()

      await s.switchTo('snap2')

      expect(router.replace).toHaveBeenCalledWith(
        expect.stringContaining('.snapshots/snap2/Photos/2024'),
      )
      expect(router.push).not.toHaveBeenCalled()
    })
    it('sets tmTravel around the navigation, clears it once settled', async () => {
      let release: () => void = () => {}
      vi.mocked(router.replace).mockImplementation(() => new Promise((r) => { release = () => r(undefined) }))
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/.snapshots/snap1/Photos'
      await s.ensureVolumes()

      const p = s.switchTo('snap2')
      await vi.waitFor(() => expect(s.tmTravel).toEqual({ from: 'snap1', to: 'snap2' }))
      release()
      await p
      expect(s.tmTravel).toBeNull()
    })
    it('does nothing when switching to the snapshot already being viewed', async () => {
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/.snapshots/snap1/Photos'
      await s.ensureVolumes()
      await s.switchTo('snap1')
      expect(router.replace).not.toHaveBeenCalled()
    })

    // Task 7 fix round (review finding 1): tmTravelActive is a SEPARATE flag from tmTravel,
    // deliberately NOT cleared by switchTo itself -- it stays true past the navigation settling
    // (tmTravel already null by then) until an external caller (TimeMachineDepthStack.vue's own
    // reveal-gate, in real use) calls settleTravel(). See snapshotBrowse.ts's own header comment
    // on tmTravelActive for why the two flags' lifecycles are deliberately different.
    describe('tmTravelActive (Task 7 fix round, review finding 1)', () => {
      it('goes true the instant switchTo is called, and stays true after the navigation itself settles', async () => {
        const s = useSnapshotBrowseStore(); const files = useFilesStore()
        files.currentPath = '/DATA/.snapshots/snap1/Photos'
        await s.ensureVolumes()
        expect(s.tmTravelActive).toBe(false)

        await s.switchTo('snap2')
        expect(s.tmTravel).toBeNull() // navigation settled
        expect(s.tmTravelActive).toBe(true) // but the reveal gate has not fired yet
      })

      it('only clears once settleTravel() is called', async () => {
        const s = useSnapshotBrowseStore(); const files = useFilesStore()
        files.currentPath = '/DATA/.snapshots/snap1/Photos'
        await s.ensureVolumes()
        await s.switchTo('snap2')
        expect(s.tmTravelActive).toBe(true)

        s.settleTravel()
        expect(s.tmTravelActive).toBe(false)
      })

      it('does not go true for a same-snapshot no-op switch', async () => {
        const s = useSnapshotBrowseStore(); const files = useFilesStore()
        files.currentPath = '/DATA/.snapshots/snap1/Photos'
        await s.ensureVolumes()
        await s.switchTo('snap1')
        expect(s.tmTravelActive).toBe(false)
      })

      // Folded minor #7 (final review, Ruling F-3): a STORE-side safety ceiling, independent of
      // TimeMachineDepthStack.vue's own reveal-gate timer -- that component's own timer only runs
      // while it is mounted; if it were ever torn down mid-travel before calling settleTravel(),
      // tmTravelActive would stay stuck true forever (hard-hiding the real window permanently)
      // with nothing left in the component tree to clear it. Reuses the SAME constants
      // (timeMachineChoreo.ts) as a flat worst-case cap.
      //
      // Fix wave J (owner acceptance 2026-08-26): the ceiling is now
      // `Math.max(TRAVEL_MAX_DURATION_MS, TRAVEL_FLY_MAX_DURATION_MS) + TRAVEL_SAFETY_EXTRA_MS` =
      // `max(900, 1400) + 800` = 2200ms (was a stale 1700ms, computed before wave H's own
      // long-jump fly-through introduced the larger 1400ms worst case -- see switchTo's own
      // comment on this constant for the full trace). The three literal millisecond values below
      // are updated to match; the test SHAPES (boundary check / settle-clears-the-timer /
      // token-guard-invalidates-a-superseded-timer) are unchanged.
      describe('store-side safety ceiling (folded minor #7; duration updated fix wave J)', () => {
        it('clears tmTravelActive on its own after the safety ceiling elapses, even if settleTravel() is never called', async () => {
          vi.useFakeTimers()
          try {
            const s = useSnapshotBrowseStore(); const files = useFilesStore()
            files.currentPath = '/DATA/.snapshots/snap1/Photos'
            await s.ensureVolumes()
            await s.switchTo('snap2')
            expect(s.tmTravelActive).toBe(true)

            await vi.advanceTimersByTimeAsync(2199) // max(900,1400) + 800 - 1
            expect(s.tmTravelActive).toBe(true) // not yet -- exactly at the boundary

            await vi.advanceTimersByTimeAsync(1)
            expect(s.tmTravelActive).toBe(false) // ceiling reached -- released on its own
          } finally {
            vi.useRealTimers()
          }
        })

        it('a legitimate settleTravel() clears the pending safety timer, so it cannot fire later and re-toggle a subsequent travel', async () => {
          vi.useFakeTimers()
          try {
            const s = useSnapshotBrowseStore(); const files = useFilesStore()
            files.currentPath = '/DATA/.snapshots/snap1/Photos'
            await s.ensureVolumes()
            await s.switchTo('snap2') // first travel, its own safety timer would fire 2200ms from now (t=2200)
            s.settleTravel()
            expect(s.tmTravelActive).toBe(false)

            await vi.advanceTimersByTimeAsync(1000) // t=1000
            // 'snap3', not 'snap1': router.replace is a bare mock here (no route watcher wired up
            // to actually move files.currentPath, unlike production) -- currentSnapshotName is
            // still derived from the UNCHANGED initial path and stays 'snap1' throughout this
            // isolated store test, so switching back to 'snap1' would hit switchTo's own
            // same-snapshot no-op guard (`from === name`) instead of starting a real second travel.
            await s.switchTo('snap3') // second, unrelated travel -- its own safety timer targets t=3200
            expect(s.tmTravelActive).toBe(true)

            await vi.advanceTimersByTimeAsync(1200) // t=2200 -- exactly when the FIRST travel's timer would have fired
            // Still true: settleTravel() cleared that timer outright (not merely superseded it via
            // the token guard) -- if it had leaked, this would have gone false right here, well
            // before the second travel's own t=3200 deadline.
            expect(s.tmTravelActive).toBe(true)
          } finally {
            vi.useRealTimers()
          }
        })

        it('a later switchTo invalidates an earlier still-pending safety timer via the token guard', async () => {
          vi.useFakeTimers()
          try {
            const s = useSnapshotBrowseStore(); const files = useFilesStore()
            files.currentPath = '/DATA/.snapshots/snap1/Photos'
            await s.ensureVolumes()
            await s.switchTo('snap2') // first travel, safety timer armed for ~2200ms from now
            await vi.advanceTimersByTimeAsync(1000)

            // 'snap3', not 'snap1' -- see the previous case's own comment on why (currentSnapshotName
            // never actually updates in this isolated store test, so 'snap1' would be a same-snapshot no-op).
            await s.switchTo('snap3') // second travel supersedes it -- its own token bump clears the old timer
            expect(s.tmTravelActive).toBe(true)

            // The FIRST travel's own timer (armed at t=0, targeting t=2200) would have fired by
            // now were it not invalidated -- advance to t=2300 (past the FIRST's own t=2200
            // deadline, still short of the SECOND's own t=1000+2200=3200 deadline) and confirm the
            // SECOND travel's own (freshly armed) state survives untouched.
            await vi.advanceTimersByTimeAsync(1300) // t=1000 -> t=2300
            expect(s.tmTravelActive).toBe(true)
          } finally {
            vi.useRealTimers()
          }
        })
      })
    })
  })

  describe('reset', () => {
    it('clears every Time Machine field back to its initial state', async () => {
      listSnapshotsMock.mockResolvedValue(SNAPS)
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/Photos'
      await s.ensureVolumes()
      await s.enterTimeMachine()
      expect(s.tmActive).toBe(true)

      s.reset()
      expect(s.tmActive).toBe(false)
      expect(s.snapshotList).toEqual([])
      expect(s.tmLoading).toBe(false)
      expect(s.tmTravel).toBeNull()
      expect(s.tmTravelActive).toBe(false)
    })
  })
})

// Task 14: `restore()` became `restoreItems(items, defaultDir, openPicker)` -- every entry point now
// goes through the destination picker (T13) and the shared conflict queue (useFileConflicts.ts's own
// resolveRestore) before any network call. `withMarker: true` is used throughout this describe block
// to skip the conflict precheck entirely (same as production: with_marker on means an exact-name
// collision is astronomically unlikely) -- exercising the conflict queue itself is
// useFileConflicts.test.ts's job (it already owns the shared dialog/chain this store just delegates
// to via useFileConflictsStore()), not this store's.
describe('restoreItems', () => {
  const inSnapshot = async () => {
    const s = useSnapshotBrowseStore()
    useFilesStore().currentPath = '/DATA/.snapshots/snap1/Photos'
    await s.ensureVolumes()
    return s
  }
  const item = (path: string) => ({ path, name: path.split('/').pop()!, is_dir: false })
  const picker = vi.fn(async () => ({ destDir: '/DATA/Photos', withMarker: true }))

  beforeEach(() => { picker.mockClear() })

  it('single restore success: toast should show restored path', async () => {
    restoreMock.mockResolvedValue({ restored_path: '/DATA/Photos/a.jpg.restored-1' })
    const s = await inSnapshot()
    await s.restoreItems([item('/DATA/.snapshots/snap1/Photos/a.jpg')], '/DATA/Photos', picker)
    expect(useToast().msg).toContain('/DATA/Photos/a.jpg.restored-1')
  })
  // Controller ruling, fix round 1: entry point decides the success-toast copy, not item count --
  // opts.singleItemFlow (Files.vue's own restoreSingleItem, the context-menu entry point) switches
  // to Vue2's `snapBrowseRestored` = "Restored to {path}" copy, which has NO count/"项" wording,
  // distinguishing it from the default `tmRestoredCount` copy every other entry point uses even for
  // a one-item selection (see the very next test below).
  it('singleItemFlow: true → the context-menu-only copy (no item count), even though it is also a one-item restore', async () => {
    restoreMock.mockResolvedValue({ restored_path: '/DATA/Photos/a.jpg.restored-1' })
    const s = await inSnapshot()
    await s.restoreItems([item('/DATA/.snapshots/snap1/Photos/a.jpg')], '/DATA/Photos', picker, { singleItemFlow: true })
    expect(useToast().msg).toBe('已恢复到 /DATA/Photos/a.jpg.restored-1')
    expect(useToast().msg).not.toContain('项') // not the count-based tmRestoredCount copy
  })
  it('a one-item SELECTION (no singleItemFlow opt) keeps the count-based copy — entry point, not item count, decides', async () => {
    restoreMock.mockResolvedValue({ restored_path: '/DATA/Photos/a.jpg.restored-1' })
    const s = await inSnapshot()
    await s.restoreItems([item('/DATA/.snapshots/snap1/Photos/a.jpg')], '/DATA/Photos', picker)
    expect(useToast().msg).toBe('已取回 1 项到 /DATA/Photos/a.jpg.restored-1')
  })
  it('multiple restore success: toast should show count, not each item', async () => {
    restoreMock.mockResolvedValue({ restored_path: '/DATA/x.restored-1' })
    const s = await inSnapshot()
    await s.restoreItems([item('/DATA/.snapshots/snap1/a'), item('/DATA/.snapshots/snap1/b')], '/DATA', picker)
    expect(restoreMock).toHaveBeenCalledTimes(2)
    expect(useToast().msg).toContain('2')
  })
  it('the picker is called with the snapshot mount and the given default dir', async () => {
    restoreMock.mockResolvedValue({ restored_path: '/DATA/x.restored-1' })
    const s = await inSnapshot()
    await s.restoreItems([item('/DATA/.snapshots/snap1/a')], '/DATA/custom', picker)
    expect(picker).toHaveBeenCalledWith('/DATA', '/DATA/custom')
  })
  it('cancelling the picker (null) is a true no-op -- no restore call, no toast', async () => {
    const s = await inSnapshot()
    const cancelPicker = async () => null
    await s.restoreItems([item('/DATA/.snapshots/snap1/a')], '/DATA', cancelPicker)
    expect(restoreMock).not.toHaveBeenCalled()
    expect(useToast().msg).toBe('')
  })
  it('restoring should be true during restore (through the whole picker+execute sequence), false when done', async () => {
    let release: (v: unknown) => void = () => {}
    restoreMock.mockImplementation(() => new Promise((r) => { release = r }))
    const s = await inSnapshot()
    const p = s.restoreItems([item('/DATA/.snapshots/snap1/a')], '/DATA', picker)
    expect(s.restoring).toBe(true)
    await vi.waitFor(() => expect(restoreMock).toHaveBeenCalled())
    release({ restored_path: '/DATA/a.restored-1' })
    await p
    expect(s.restoring).toBe(false)
  })
  it('calling again during restore should be ignored (prevent double submit) -- the picker is not even opened a second time', async () => {
    let release: (v: unknown) => void = () => {}
    restoreMock.mockImplementation(() => new Promise((r) => { release = r }))
    const s = await inSnapshot()
    const p = s.restoreItems([item('/DATA/.snapshots/snap1/a')], '/DATA', picker)
    await s.restoreItems([item('/DATA/.snapshots/snap1/b')], '/DATA', picker)
    // The picker+conflict-resolution phase now adds a few more microtask hops before the first
    // call's own restoreMock() invocation than the pre-Task-14 direct-call version had -- wait for
    // it explicitly (same technique the "restoring should be true..." test above already uses)
    // rather than relying on exact microtask-count timing between two concurrent async chains.
    await vi.waitFor(() => expect(restoreMock).toHaveBeenCalled())
    release({ restored_path: '/x' })
    await p
    expect(restoreMock).toHaveBeenCalledTimes(1)
    expect(picker).toHaveBeenCalledTimes(1)
  })
  it('404 → should show dedicated message', async () => {
    restoreMock.mockRejectedValue(Object.assign(new Error('gone'), { code: 404 }))
    const s = await inSnapshot()
    await s.restoreItems([item('/DATA/.snapshots/snap1/a')], '/DATA', picker)
    expect(useToast().msg).toContain('找不到')
  })
  // Review finding (kept from the pre-Task-14 version): on mixed results (some succeed, some fail), the original `&& !failed` check short-circuited
  // both success branches, leaving only the failure copy — the entries that actually restored were silently swallowed. Human decision: emit one new toast
  // (snapBrowseRestoredPartial) stating "N succeeded, M failed", without stacking the specific failure-reason copy on top.
  it('mixed results (partial success, partial failure): toast should show both success and failure counts, not swallow success or stack failure reasons', async () => {
    restoreMock
      .mockResolvedValueOnce({ restored_path: '/DATA/a.restored-1' })
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { code: 404 }))
      .mockResolvedValueOnce({ restored_path: '/DATA/c.restored-1' })
    const s = await inSnapshot()
    await s.restoreItems([
      item('/DATA/.snapshots/snap1/a'),
      item('/DATA/.snapshots/snap1/b'),
      item('/DATA/.snapshots/snap1/c'),
    ], '/DATA', picker)
    expect(restoreMock).toHaveBeenCalledTimes(3)
    expect(useToast().msg).toContain('2') // 2 succeeded (a, c)
    expect(useToast().msg).toContain('1') // 1 failed (b)
    expect(useToast().msg).not.toContain('找不到') // no longer stacks the specific failure-reason copy
  })
  // Guard against wiring the mixed branch at the cost of the "all failed" path: when multiple entries all fail, it must still land on the specific-reason copy,
  // not fall into the mixed branch by mistake (the mixed branch's condition is ok.length > 0).
  it('multiple all failed: should show specific failure reason, not mistaken as mixed result', async () => {
    restoreMock
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { code: 404 }))
      .mockRejectedValueOnce(Object.assign(new Error('bad'), { code: 400 }))
    const s = await inSnapshot()
    await s.restoreItems([item('/DATA/.snapshots/snap1/a'), item('/DATA/.snapshots/snap1/b')], '/DATA', picker)
    expect(restoreMock).toHaveBeenCalledTimes(2)
    expect(useToast().msg).toContain('找不到')
  })
  it('empty selection should not send request', async () => {
    const s = await inSnapshot()
    await s.restoreItems([], '/DATA', picker)
    expect(restoreMock).not.toHaveBeenCalled()
    expect(picker).not.toHaveBeenCalled()
  })
  // Review fix (Important, kept from the pre-Task-14 version): the Vue2/T7 version fired a separate GET /v2/snapshot/volumes per selected item —
  // 30 items meant 31 requests, and any single network hiccup misreported that item as failed (it was never even submitted).
  // volumes.value is the same already-ready data; batch restore should reuse it directly instead of refetching per item.
  it('batch restore should reuse cached volumes, not refetch per item', async () => {
    restoreMock.mockResolvedValue({ restored_path: '/DATA/x.restored-1' })
    const s = await inSnapshot()
    listVolumesMock.mockClear() // ensureVolumes() inside inSnapshot() already fetched once; only count calls during restoreItems()
    await s.restoreItems([
      item('/DATA/.snapshots/snap1/a'),
      item('/DATA/.snapshots/snap1/b'),
      item('/DATA/.snapshots/snap1/c'),
    ], '/DATA', picker)
    expect(restoreMock).toHaveBeenCalledTimes(3)
    expect(listVolumesMock).not.toHaveBeenCalled()
  })
  it('when volumes not yet loaded, should fallback to fetch once, not mistaken all items as failed (edge case that should not happen in theory)', async () => {
    const s = useSnapshotBrowseStore()
    useFilesStore().currentPath = '/DATA/.snapshots/snap1/Photos'
    // Deliberately skip s.ensureVolumes(): simulate the edge case of calling restoreItems() before volumes have loaded
    restoreMock.mockResolvedValue({ restored_path: '/DATA/Photos/a.restored-1' })
    await s.restoreItems([item('/DATA/.snapshots/snap1/Photos/a.jpg')], '/DATA/Photos', picker)
    expect(listVolumesMock).toHaveBeenCalledTimes(1)
    expect(useToast().msg).toContain('/DATA/Photos/a.restored-1')
  })

  // Task 11: the backend restores one path per call, so a 40-item batch stays
  // serial — but a single disabled button gave no sign of life for the whole
  // wait. Each restore call is gated on a manually-resolved promise so the
  // test can assert progress mid-batch.
  it('reports how far a batch restore has got', async () => {
    const gates: Array<() => void> = []
    restoreMock.mockImplementation(() => new Promise((res) => {
      gates.push(() => res({ restored_path: '/DATA/x.restored-1' }))
    }))
    const s = await inSnapshot()
    expect(s.restoreProgress).toBeNull()

    const p = s.restoreItems([
      item('/DATA/.snapshots/snap1/a'),
      item('/DATA/.snapshots/snap1/b'),
      item('/DATA/.snapshots/snap1/c'),
    ], '/DATA', picker)
    await vi.waitFor(() => expect(restoreMock).toHaveBeenCalledTimes(1))
    expect(s.restoreProgress).toEqual({ done: 0, total: 3 })

    gates[0]!()
    await vi.waitFor(() => expect(restoreMock).toHaveBeenCalledTimes(2))
    expect(s.restoreProgress).toEqual({ done: 1, total: 3 })

    gates[1]!()
    await vi.waitFor(() => expect(restoreMock).toHaveBeenCalledTimes(3))
    expect(s.restoreProgress).toEqual({ done: 2, total: 3 })

    gates[2]!()
    await p
    expect(s.restoreProgress).toBeNull()
  })

  it('clears the progress even when a restore fails', async () => {
    restoreMock.mockRejectedValue(Object.assign(new Error('gone'), { code: 404 }))
    const s = await inSnapshot()
    await s.restoreItems([item('/DATA/.snapshots/snap1/a')], '/DATA', picker)
    expect(s.restoreProgress).toBeNull()
  })

  // Task 14: same-name conflicts route through the shared FileConflictDialog queue
  // (useFileConflicts.ts's own resolveRestore, driven here directly via the Pinia
  // fileConflicts store -- no component mount needed, same as useFileConflicts.test.ts's own
  // pattern) -- exercised end-to-end at the store layer once, to confirm the wiring; the full
  // skip/overwrite/keep_both/applyToAll matrix lives in useFileConflicts.test.ts.
  it('a same-name conflict (withMarker off) opens the shared conflict dialog; choosing overwrite restores with on_conflict=overwrite', async () => {
    getListMock.mockResolvedValue({ content: [{ name: 'a', is_dir: false }] })
    restoreMock.mockResolvedValue({ restored_path: '/DATA/a' })
    const s = await inSnapshot()
    const conflicts = useFileConflictsStore()
    const noMarkerPicker = async () => ({ destDir: '/DATA', withMarker: false })

    const p = s.restoreItems([item('/DATA/.snapshots/snap1/a')], '/DATA', noMarkerPicker)
    await vi.waitFor(() => expect(conflicts.dialog.open).toBe(true))
    expect(conflicts.dialog.name).toBe('a')
    conflicts.onChoose({ action: 'overwrite' })
    await p

    expect(restoreMock).toHaveBeenCalledWith(expect.objectContaining({ on_conflict: 'overwrite' }))
  })
})
