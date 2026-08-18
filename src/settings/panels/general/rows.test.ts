import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'
import { useToast } from '../../../stores/toast'
import { useWallpaperStore } from '../../../stores/wallpaper'

const blob: Record<string, unknown> = {}
const standbyCalls: { minutes: number }[] = []
const persisted: string[] = []

// vi.fn() instead of a bare arrow function — need to be able to assert "was never called" (review fix 1),
// can't rely solely on inspecting blob's contents afterward (the contents may happen not to change due to an idempotent write, see the fix 1 note).
const getCustomStorage = vi.fn(async () => ({ ...blob }))
const setCustomStorage = vi.fn(async (_k: string, d: Record<string, unknown>) => { Object.assign(blob, d) })
// Stubs for the wallpaper store's service surface (imported transitively via
// WallpaperRow -> useWallpaperStore). None of this file's tests exercise
// upload or NAS-path flows, but the mock factory must still provide these
// members since the store module references service.users.uploadImage /
// service.users.setImageFromPath.
const uploadImage = vi.fn()
const setImageFromPath = vi.fn()

// The vi.mock factory gets hoisted and runs before the two consts above, so the factory body can't
// reference getCustomStorage/setCustomStorage as values directly (that would dereference them before initialization, ReferenceError).
// Wrapping them in an inline arrow function only dereferences the outer variables **at call time**, the same existing pattern
// as standbyCalls below (likewise only read when actually invoked).
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: (...args: Parameters<typeof getCustomStorage>) => getCustomStorage(...args),
      setCustomStorage: (...args: Parameters<typeof setCustomStorage>) => setCustomStorage(...args),
      uploadImage: (...args: Parameters<typeof uploadImage>) => uploadImage(...args),
      setImageFromPath: (...args: Parameters<typeof setImageFromPath>) => setImageFromPath(...args),
    },
    sys: { setDiskStandby: async (p: { minutes: number }) => { standbyCalls.push(p) } },
  },
}))
vi.mock('../../../stores/locale', () => ({
  LOCALES: ['zh_cn', 'en_us'],
  useLocaleStore: () => ({ persist: async (l: string) => { persisted.push(l) } }),
}))

import WallpaperRow from './WallpaperRow.vue'
import LanguageRow from './LanguageRow.vue'
import TimezoneRow from './TimezoneRow.vue'
import DiskStandbyRow from './DiskStandbyRow.vue'
import { __resetSystemConfigQueue } from '../../util/systemConfig'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const mountRow = (C: unknown) => mount(C as never, { global: { plugins: [i18n] } })

/** A manually controllable promise — used to "stick" the server read at pending, simulating an interleaving path under real network latency (fix 3). */
function createDeferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const k of Object.keys(blob)) delete blob[k]
  standbyCalls.length = 0
  persisted.length = 0
  getCustomStorage.mockClear()
  setCustomStorage.mockClear()
  __resetSystemConfigQueue()
})

describe('WallpaperRow (SP11: debt D5 paid off)', () => {
  it('renders the label with an enabled change button', () => {
    const w = mountRow(WallpaperRow)
    expect(w.find('.set-row-label').text()).toBe('壁纸')
    expect(w.find('.set-btn').attributes('disabled')).toBeUndefined()
  })
  it('no longer explains why it is unavailable', () => {
    expect(mountRow(WallpaperRow).find('.set-row-hint').exists()).toBe(false)
  })
  it('opens the app-level picker', async () => {
    const w = mountRow(WallpaperRow)
    await w.find('.set-btn').trigger('click')
    expect(useWallpaperStore().dialogOpen).toBe(true)
  })
})

describe('LanguageRow (debt D6: only 2 entries, Vue2 has 31)', () => {
  it('lists only zh_cn / en_us', () => {
    const opts = mountRow(LanguageRow).findAll('option')
    expect(opts.map((o) => o.attributes('value'))).toEqual(['zh_cn', 'en_us'])
  })
  it('has a hint below the row', () => {
    expect(mountRow(LanguageRow).find('.set-row-hint').exists()).toBe(true)
  })
  it('the selected option follows the current locale', () => {
    expect((mountRow(LanguageRow).find('select').element as HTMLSelectElement).value).toBe('zh_cn')
  })
  it('switching goes through the locale store\'s persist (doesn\'t write the system blob itself, avoiding a conflict between two paths)', async () => {
    const w = mountRow(LanguageRow)
    await w.find('select').setValue('en_us')
    await flushPromises()
    expect(persisted).toEqual(['en_us'])
  })
})

describe('TimezoneRow', () => {
  it('selects the server-saved timezone after mount', async () => {
    blob.timezone = 'Europe/Paris'
    const w = mountRow(TimezoneRow)
    await flushPromises()
    expect((w.find('select').element as HTMLSelectElement).value).toBe('Europe/Paris')
  })

  it('uses the default America/New_York when nothing is saved on the server (ports Vue2 L940)', async () => {
    const w = mountRow(TimezoneRow)
    await flushPromises()
    expect((w.find('select').element as HTMLSelectElement).value).toBe('America/New_York')
  })

  it('mounting **does not** write the config back (porting discipline #1: Vue2 wastes a write every time it opens)', async () => {
    blob.timezone = 'UTC'
    mountRow(TimezoneRow)
    await flushPromises()
    expect(blob).toEqual({ timezone: 'UTC' })   // wasn't blanket-overwritten with other fields
    // Key assertion: the call count is zero, not "the contents look unchanged" — if onMounted regressed into
    // patching back the value it just read verbatim, an idempotent write would still let the toEqual above pass; only the
    // call count catches this regression (review fix 1).
    expect(setCustomStorage).not.toHaveBeenCalled()
  })

  it('only patches when the user changes the selection, and writes only the single timezone field', async () => {
    blob.rss_switch = true
    const w = mountRow(TimezoneRow)
    await flushPromises()
    await w.find('select').setValue('UTC')
    await flushPromises()
    expect(blob.timezone).toBe('UTC')
    expect(blob.rss_switch).toBe(true)          // other fields weren't wiped out
  })

  it('notifies the user on save failure (review fix round 2: previously only did console.warn)', async () => {
    setCustomStorage.mockRejectedValueOnce(new Error('boom'))
    const toast = useToast()
    const w = mountRow(TimezoneRow)
    await flushPromises()
    await w.find('select').setValue('UTC')
    await flushPromises()
    expect(toast.toasts).toHaveLength(1)
    expect(toast.msg).toBe(i18n.global.t('settingsSaveFailed'))
  })

  it('the timezone entry count matches Vue2 (guards against a copy-paste omission)', () => {
    const w = mountRow(TimezoneRow)
    expect(w.findAll('option').length).toBeGreaterThanOrEqual(35)
  })

  it('when the mount-time server read hasn\'t returned yet and the user changes the selection first, the read result must not wipe out the user\'s choice (interleaving path, review fix 3)', async () => {
    blob.timezone = 'Europe/Paris'
    // Key: the snapshot must be taken **before** the user changes the selection, and resolved with this old snapshot rather than
    // the blob at resolve time — by then the blob has already been changed by the user's patch, and using the "current"
    // blob would let the test pass by coincidence even without the guard (hit this once, found during negative verification).
    const staleSnapshot = { ...blob }
    const deferred = createDeferred<Record<string, unknown>>()
    getCustomStorage.mockImplementationOnce(() => deferred.promise)

    const w = mountRow(TimezoneRow)
    // At this point onMounted's readSystemConfig() is still stuck on deferred, and the user has already changed the selection manually:
    await w.find('select').setValue('UTC')
    await flushPromises()
    // The read finally returns the server's old value, belatedly (in the real world: a slow GET lands after a fast PUT):
    deferred.resolve(staleSnapshot)
    await flushPromises()

    expect((w.find('select').element as HTMLSelectElement).value).toBe('UTC')
  })
})

describe('DiskStandbyRow', () => {
  it('selects the server value after mount, and **does not** send a standby command or write the config back (porting discipline #2 + review fix 1)', async () => {
    blob.disk_standby = '30m'
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    expect((w.find('select').element as HTMLSelectElement).value).toBe('30m')
    expect(standbyCalls).toEqual([])
    expect(setCustomStorage).not.toHaveBeenCalled()
  })

  it('only patches the config and sends the command when the user changes the selection, minutes converted via parseStandbyMinutes', async () => {
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    await w.find('select').setValue('2h')
    await flushPromises()
    expect(blob.disk_standby).toBe('2h')
    expect(standbyCalls).toEqual([{ minutes: 120 }])
  })

  it('selecting never sends 0', async () => {
    blob.disk_standby = '1h'
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    await w.find('select').setValue('never')
    await flushPromises()
    expect(standbyCalls).toEqual([{ minutes: 0 }])
  })

  it('also notifies the user when the config write itself fails (review fix round 2: previously only did console.warn; this is a separate failure path from "command send failure" below)', async () => {
    setCustomStorage.mockRejectedValueOnce(new Error('boom'))
    const toast = useToast()
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    await w.find('select').setValue('2h')
    await flushPromises()
    expect(toast.toasts).toHaveLength(1)
    expect(toast.msg).toBe(i18n.global.t('settingsSaveFailed'))
  })

  it('notifies on command-send failure, but doesn\'t snap the select back (the config is already persisted, the command takes effect on the next boot)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'setDiskStandby').mockRejectedValueOnce(new Error('boom'))
    const toast = useToast()
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    await w.find('select').setValue('10m')
    await flushPromises()
    expect((w.find('select').element as HTMLSelectElement).value).toBe('10m')
    // Review fix 2: previously this only verified that select didn't roll back, not that the user was actually notified — omitting
    // toast.show(...) or getting the i18n key wrong wouldn't fail the assertion above. Here we assert the toast was
    // actually pushed, and that the copy matches the translation for settingsSaveFailed (fetched from the same i18n
    // instance, so a wrong key fails this line).
    expect(toast.toasts).toHaveLength(1)
    expect(toast.msg).toBe(i18n.global.t('settingsSaveFailed'))
  })

  it('9 options and the copy has translations (no bare key rendered)', async () => {
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    const opts = w.findAll('option')
    expect(opts).toHaveLength(9)
    expect(opts[0].text()).toBe('从不')
    for (const o of opts) expect(o.text()).not.toMatch(/^settings/)
  })

  it('when the mount-time server read hasn\'t returned yet and the user changes the selection first, the read result must not wipe out the user\'s choice (interleaving path, review fix 3)', async () => {
    blob.disk_standby = '1h'
    // Same as the TimezoneRow case: the snapshot must be taken before the user changes the selection, resolved with the old snapshot.
    const staleSnapshot = { ...blob }
    const deferred = createDeferred<Record<string, unknown>>()
    getCustomStorage.mockImplementationOnce(() => deferred.promise)

    const w = mountRow(DiskStandbyRow)
    await w.find('select').setValue('10m')
    await flushPromises()
    deferred.resolve(staleSnapshot)
    await flushPromises()

    expect((w.find('select').element as HTMLSelectElement).value).toBe('10m')
  })
})
