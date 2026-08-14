import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import OsSelector from './OsSelector.vue'
import IsoBrowser from './IsoBrowser.vue'
import { i18n } from '../../i18n'
import type { IsoRow } from '../composables/useIsoList'

// IsoBrowser (Task 6) is a child component of OsSelector; in real rendering it calls useIsoBrowser() by itself
// to fetch the directory. This file only tests the official template section + forwarding/dialog closing after
// custom area selection, not the IsoBrowser internal browse logic (that part is already covered separately in
// IsoBrowser.test.ts), so here we mock the data layer to an empty directory/not loading to avoid real
// service.folder.getList calls leaking into this test file.
vi.mock('../composables/useIsoBrowser', () => ({
  useIsoBrowser: () => ({
    path: { value: '/' }, items: { value: [] }, isLoading: { value: false },
    fetch: vi.fn(), up: vi.fn(), dispose: vi.fn(),
  }),
}))

const ROW = (over: Partial<IsoRow> = {}): IsoRow => ({
  id: 'debian-13', name: 'Debian', version: '13 (Trixie)', category: 'linux', size: '676 MB',
  status: 'available', progress: 0, recommendedVcpu: 2, recommendedMemory: 2048,
  minMemory: 512, minDisk: 8,
  _downloading: false, _downloaded: false, _progress: 0, _downloadedBytes: 0, ...over,
})
// Deviation logged (fixing brief typo, not just the 3rd test case line): the literal ALPINE in brief
// only covers id/name/category/status/path/_downloaded/minDisk; version/size reuse ROW() defaults
// (Debian's '13 (Trixie)' / '676 MB'). But the same test case assertion expects cards[1] to contain '3.19' and
// '60 MB', which don't match (real alpine-319 on device has version 3.19, size far smaller than Debian's
// 676MB). This is not a "ternary placeholder that runs but is semantically vacuous", it's a fixture with
// missing fields causing the assertion to always fail; fixing it together: add version/size overrides to let
// the assertion actually verify rendered content instead of inevitably failing.
const ALPINE = ROW({
  id: 'alpine-319', name: 'Alpine', version: '3.19', category: 'linux', size: '60 MB',
  status: 'downloaded', path: '/DATA/KVM/isos/alpine-319.iso', _downloaded: true, minDisk: 2,
})
const WIN = ROW({ id: 'win10', name: 'Windows 10', category: 'windows', minDisk: 60 })

let w: VueWrapper | null = null
// Hard constraint 5: the `mk` in the brief's verbatim text is a sync function. Testing with
// reka-ui 2.10 (this repo's existing version) shows that DialogPortal/DialogContent on first mount requires
// waiting for the next microtask (nextTick) to actually mount content into document.body—consistent with the
// established pattern in KvmDialog.test.ts / KvmGlobalSettingsDialog.test.ts. Here we make `mk` async and
// `await nextTick()` after mount; all assertions remain unchanged.
const mk = async (isos: IsoRow[] = [ROW(), ALPINE, WIN], downloadError = '') => {
  w = mount(OsSelector, {
    // browserExpanded (SP16 Task 6): expanded state is held by the page; this component only forwards it. Here
    // we pin it to collapsed—the custom area's expand/browse behavior is covered separately in IsoBrowser.test.ts.
    props: { open: true, isos, downloadError, browserExpanded: false },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  await nextTick()
  return w
}
afterEach(() => { w?.unmount(); w = null; document.body.innerHTML = '' })
const qa = (sel: string) => [...document.body.querySelectorAll(sel)] as HTMLElement[]

describe('OsSelector official template section', () => {
  it('four category buttons, all highlighted by default', async () => {
    await mk()
    const btns = qa('.category-btn')
    expect(btns.map((b) => b.textContent?.trim())).toEqual(['全部', 'Windows', 'Linux', 'BSD'])
    expect(btns[0].classList.contains('active')).toBe(true)
  })

  it('clicking Windows leaves only windows category cards', async () => {
    const wr = await mk()
    qa('.category-btn')[1].click(); await wr.vm.$nextTick()
    expect(qa('.os-card')).toHaveLength(1)
    expect(qa('.os-name')[0].textContent).toContain('Windows 10')
  })

  it('cards display name/version/size, downloaded ones have is-downloaded class', async () => {
    await mk()
    const cards = qa('.os-card')
    expect(cards[1].classList.contains('is-downloaded')).toBe(true)
    expect(cards[1].textContent).toContain('Alpine')
    expect(cards[1].textContent).toContain('3.19')
    expect(cards[1].textContent).toContain('60 MB')
  })

  it('button three states: not-downloaded=download / downloaded=select / downloading=two-decimal-place percentage (per Vue2 :257-265)', async () => {
    await mk([ROW(), ALPINE, ROW({ id: 'ubuntu-2404', name: 'Ubuntu', _downloading: true, _progress: 37.456 })])
    const texts = qa('.os-action-btn').map((b) => b.textContent?.trim())
    expect(texts[0]).toBe('下载')
    expect(texts[1]).toBe('选择')
    expect(texts[2]).toBe('37.46%')
  })

  it('clicking not-downloaded card button emits download(id)', async () => {
    const wr = await mk()
    qa('.os-action-btn')[0].click(); await wr.vm.$nextTick()
    expect(wr.emitted('download')).toEqual([['debian-13']])
  })

  it('clicking downloaded card button emits select, path is host machine absolute path, isLocal=false', async () => {
    const wr = await mk()
    qa('.os-action-btn')[1].click(); await wr.vm.$nextTick()
    expect(wr.emitted('select')![0][0]).toMatchObject({
      isLocal: false, id: 'alpine-319', name: 'Alpine',
      path: '/DATA/KVM/isos/alpine-319.iso', minDisk: 2,
    })
  })

  it('dialog closes after selection (per Vue2 selectOS → close)', async () => {
    const wr = await mk()
    qa('.os-action-btn')[1].click(); await wr.vm.$nextTick()
    expect(wr.emitted('update:open')).toEqual([[false]])
  })

  it('clicking downloading card button emits need-wait, does not emit select/download', async () => {
    const wr = await mk([ROW({ _downloading: true, _progress: 10 })])
    qa('.os-action-btn')[0].click(); await wr.vm.$nextTick()
    expect(wr.emitted('need-wait')).toHaveLength(1)
    expect(wr.emitted('select')).toBeUndefined()
    expect(wr.emitted('download')).toBeUndefined()
  })

  it('when downloaded but backend didn\'t provide path, does not emit select (backend contract: path only appears when downloaded)', async () => {
    const wr = await mk([ROW({ _downloaded: true, path: undefined })])
    qa('.os-action-btn')[0].click(); await wr.vm.$nextTick()
    expect(wr.emitted('select')).toBeUndefined()
  })

  it('selecting local ISO in custom area also closes dialog and forwards select event (Task 6 wiring: onLocalSelect)', async () => {
    const wr = await mk()
    const localOs = {
      isLocal: true, id: 'local', name: 'haiku-r1.iso', path: '/DATA/haiku-r1.iso',
    }
    // IsoBrowser's own browse/reverse-lookup logic is already covered separately in IsoBrowser.test.ts; here we
    // only verify OsSelector forwards its select event as-is + closes the dialog via this wiring, not re-traversing the file-click flow.
    const isoBrowser = wr.findComponent(IsoBrowser)
    expect(isoBrowser.exists()).toBe(true)
    isoBrowser.vm.$emit('select', localOs)
    await wr.vm.$nextTick()
    expect(wr.emitted('select')![0][0]).toEqual(localOs)
    expect(wr.emitted('update:open')).toEqual([[false]])
  })

  // Full-branch review fix A3: download failure had no visible feedback. This component is responsible for
  // displaying the downloadError passed in by KvmPage above the overlay (it is the overlay content itself, naturally
  // on top, no additional z-index handling needed). First assert it doesn't exist when there's no error (exclude the
  // confusion of "element already there"), then assert it appears when non-empty value is passed; reuse the existing
  // .cv-error class (don't add new CSS).
  it('downloadError empty doesn\'t show .cv-error, non-empty shows in overlay content (A3)', async () => {
    const empty = await mk()
    expect(qa('.cv-error')).toHaveLength(0)
    empty.unmount()
    document.body.innerHTML = ''

    await mk([ROW(), ALPINE, WIN], '下载失败')
    expect(qa('.cv-error')).toHaveLength(1)
    expect(qa('.cv-error')[0].textContent).toBe('下载失败')
  })
})
