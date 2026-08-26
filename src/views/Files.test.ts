import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { service } from '@nimotech/nimoos-service'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../i18n/zh_cn'
import Files from './Files.vue'
import FileGridView from '../files/components/FileGridView.vue'
import { useFilesStore } from '../files/stores/files'
import { useFoldersStore } from '../home/stores/folders'
import { useFavoritesStore } from '../files/stores/favorites'
import { useClipboardStore } from '../files/stores/clipboard'
import { useSnapshotBrowseStore } from '../files/stores/snapshotBrowse'
import { useUploadsStore } from '../files/stores/uploads'
import type { UploadItem } from '../files/upload/types'
import { useToast } from '../stores/toast'

// snapshotBrowse.ts navigates through the app's real router SINGLETON (see that file's own
// navigateReal comment for why: production always has exactly one app.use(router) call, and the
// store cannot rely on injection). This file mounts Files.vue against its own throw-away
// makeRouter() instance instead (see below) — the two are unrelated objects, so without this
// mock, a Time Machine action that actually navigates (a case none of the current fixtures below
// trigger, since the shared snapshot.list mock returns []) would silently push onto the real
// singleton rather than the router this file actually asserts against.
vi.mock('../router', () => ({ router: { push: vi.fn(), replace: vi.fn() } }))

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: {
      getList: vi.fn(async (path: string) => ({
        content: [
          { name: 'Documents', path: (path === '/DATA' ? '/DATA' : path) + '/Documents', is_dir: true },
          { name: 'a.txt', path: '/DATA/a.txt', is_dir: false },
        ],
      })),
    },
    batch: { task: vi.fn().mockResolvedValue(undefined) },
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
    image: { thumbUrl: (p: string) => `/v1/image?path=${encodeURIComponent(p)}&type=thumbnail` },
    // Files.vue's mount-area socket refresh calls mounts.loadMounts() inside onMounted; mock it to avoid unrelated console warnings.
    samba: { listConnections: vi.fn().mockResolvedValue([]) },
    cloud: { list: vi.fn().mockResolvedValue([]), umount: vi.fn().mockResolvedValue(undefined) },
    snapshot: {
      listVolumes: vi.fn().mockResolvedValue([{ volume_uuid: 'u-data', mount: '/DATA', supported: true }]),
      list: vi.fn().mockResolvedValue([]),
      restore: vi.fn().mockResolvedValue({ restored_path: '/DATA/restored' }),
      // T11: SnapshotSettingsModal's own store (storage/stores/snapshot.ts) calls getPolicy on
      // open -- mocked so the gear-click case below doesn't hit an undefined function (the
      // store's own try/catch would swallow it either way, but this keeps the case's console
      // output clean, matching every other service method already mocked here).
      getPolicy: vi.fn().mockResolvedValue({ hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 }),
    },
  },
  getHttp: () => ({ get: vi.fn(async () => ({ data: { data: [] } })) }),
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// Same reka-ui stand-ins as FileContextMenu.test.ts: the real ContextMenuItem
// injects a MenuRootContext that only a real ContextMenuRoot provides, and
// throws when mounted without one. These stubs render the #menu slot content
// unconditionally (no Portal/positioning), so a real click drives FileContextMenu's
// own real emit -- the same real DOM-click path production code goes through.
// (Not because `.vm.$emit()` on the child doesn't work -- it does; see the
// "context menu paste action" test below for what the actual failure mode was.)
const ContextMenuStub = {
  template: '<div><slot /><div class="menu"><slot name="menu" /></div></div>',
}
const ContextMenuItemStub = {
  emits: ['select'],
  template: '<div @click="$emit(\'select\')"><slot /></div>',
}

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/files', name: 'files', component: Files },
      { path: '/files/:path(.*)*', name: 'files-path', component: Files },
    ],
  })
}

describe('Files.vue browse pipe', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // service.batch.task is a module-level vi.fn() shared by every test in this
    // file. Without clearing it here, a call recorded by an earlier test (e.g.
    // the toolbar Paste button test) can make a later toHaveBeenCalledWith
    // assertion pass even if the code under test is completely broken -- see
    // task-7 fix-round-2 N1.
    vi.clearAllMocks()
    ;(globalThis as any).IntersectionObserver = class {
      cb: (e: { isIntersecting: boolean }[]) => void
      constructor(cb: any) { this.cb = cb }
      observe() { this.cb([{ isIntersecting: true }]) }
      disconnect() {}
    }
  })

  it('bare /files redirects to default disk root (virtual) and lists it', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toContain('/files/NimoOS-HD')
    const files = useFilesStore()
    expect(files.currentPath).toBe('/DATA')
    expect(w.text()).toContain('Documents')
  })

  it('deep virtual route resolves to real path and lists it', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/Documents'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    const files = useFilesStore()
    expect(files.currentPath).toBe('/DATA/Documents')
    expect(w.text()).toContain('Documents')
  })

  it('clicking a folder row navigates to that folder\'s virtual route', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    // default view is grid; directories render as .file-tile (sorted first)
    const folderTile = w.find('.file-tile')
    expect(folderTile.exists()).toBe(true)
    await folderTile.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toContain('/files/NimoOS-HD/Documents')
    expect(router.currentRoute.value.fullPath).not.toContain('/DATA')
  })

  it('renders grid tiles by default and can switch to list; clicking a column reorders', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    localStorage.clear()
    const router = makeRouter()
    router.push('/files/NimoOS-HD'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    const files = useFilesStore()
    // default grid
    expect(files.viewMode).toBe('grid')
    expect(w.findAll('.file-tile').length).toBeGreaterThan(0)
    // switch to list
    await w.get('.view-toggle-list').trigger('click')
    expect(files.viewMode).toBe('list')
    expect(w.findAll('.file-row').length).toBeGreaterThan(0)
    // click a sortable header
    await w.get('.col-name').trigger('click')
    expect(files.sort).toBe('name')
  })

  it('renders the sidebar (disks) and breadcrumb for the current folder', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/Documents'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    // sidebar shows the disk root
    expect(w.find('.files-sidebar').exists()).toBe(true)
    expect(w.find('.files-sidebar').text()).toContain('NimoOS-HD')
    // breadcrumb shows virtual segments, never the real path
    const crumbs = w.findAll('.crumb').map((c) => c.text())
    expect(crumbs).toContain('NimoOS-HD')
    expect(crumbs).toContain('Documents')
    expect(w.find('.breadcrumb').text()).not.toContain('/DATA')
  })

  it('ctrl-click in list view selects a row and shows the selection toolbar; clear resets', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    localStorage.clear()
    const router = makeRouter()
    router.push('/files/NimoOS-HD'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    await w.get('.view-toggle-list').trigger('click')
    const files = useFilesStore()
    const row = w.findAll('.file-row')[0]
    await row.trigger('click', { ctrlKey: true })
    expect(files.selectedCount).toBe(1)
    expect(w.find('.selection-toolbar').exists()).toBe(true)
    expect(w.find('.selection-toolbar').text()).toContain('已选 1 项')
    await w.get('.selection-toolbar .sel-clear').trigger('click')
    expect(files.selectedCount).toBe(0)
    expect(w.find('.selection-toolbar').exists()).toBe(false)
  })

  // Fix wave C (toolbar redesign): New folder/New file now live inside the collapsed "New"
  // dropdown (FilesNewMenu.vue) -- its menu content teleports to document.body via reka-ui's
  // Portal and only renders once opened (no `forceMount`), same convention as the
  // AlertDialog/RestoreDestinationModal tests elsewhere in this file (attachTo: document.body +
  // manual cleanup, since a portal-attached instance does not auto-unmount between tests).
  it('toolbar New dropdown opens and contains new-folder/new-file items', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] }, attachTo: document.body })
    await flushPromises()
    expect(document.body.querySelector('.tb-new-folder')).toBeNull() // closed by default
    await w.get('.tb-new-menu').trigger('click')
    await flushPromises()
    expect(document.body.querySelector('.tb-new-folder')).not.toBeNull()
    expect(document.body.querySelector('.tb-new-file')).not.toBeNull()
    w.unmount()
    document.body.innerHTML = ''
  })

  // Fix wave C: each dropdown item must reach the SAME pre-existing handler the old standalone
  // chips called (openNew/triggerFileSelect/triggerFolderSelect), not just render with the right
  // label. 'new-folder' → openNew('folder'): proven by NewItemDialog (reka-ui Dialog, also
  // Portal-teleported to document.body) actually opening with the folder-mode default name.
  it('New dropdown "New folder" item reaches the real openNew(\'folder\') handler', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] }, attachTo: document.body })
    await flushPromises()

    await w.get('.tb-new-menu').trigger('click')
    await document.body.querySelector('.tb-new-folder')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect((document.body.querySelector('.ui-dialog-content input') as HTMLInputElement | null)?.value).toBe(zh.filesDefaultFolderName)

    w.unmount()
    document.body.innerHTML = ''
  })

  // 'upload-file' → triggerFileSelect(): proven by the hidden <input type=file> (NOT
  // webkitdirectory, plain Files.vue child, unaffected by the dropdown's own Portal) receiving a
  // real synthetic click.
  it('New dropdown "Upload files" item reaches the real triggerFileSelect handler', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] }, attachTo: document.body })
    await flushPromises()

    await w.get('.tb-new-menu').trigger('click')
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click')
    await document.body.querySelector('.tb-upload-file')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()

    w.unmount()
    document.body.innerHTML = ''
  })

  // Fix wave C: the content-area header row's select-all circle wires to the REAL selection
  // store (files.allSelected/selectAll/clearSelection), the same primitives
  // SelectionToolbar.vue's own select-all/clear buttons already use -- not a separate local flag.
  it('content-area header: select-all toggles the real selection store, count reflects listed entries', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    const files = useFilesStore()

    expect(w.find('.files-item-count').text()).toBe('2 项') // tmItemCount, zh — Documents + a.txt
    expect(files.allSelected).toBe(false)

    await w.get('.files-select-all').trigger('click')
    expect(files.selectedCount).toBe(2)
    expect(files.allSelected).toBe(true)
    expect(w.find('.files-select-all').classes()).toContain('on')
    expect(w.find('.files-item-count').text()).toBe('已选 2 项') // filesSelectedCount, zh

    await w.get('.files-select-all').trigger('click')
    expect(files.selectedCount).toBe(0)
    expect(w.find('.files-select-all').classes()).not.toContain('on')
    expect(w.find('.files-item-count').text()).toBe('2 项')
  })

  // Fix wave C re-review (correctness): displayEntries (the "N items" source) can contain
  // synthetic upload placeholders (uploadPlaceholders/mergeUploadPlaceholders, ../files/upload/
  // uploadPlaceholders.ts) for uploads still in flight into the current directory -- these render
  // in the listing but can never be selected (files.selectAll() only ever populates the store
  // with real files.entries paths). The "N selected" label must therefore read
  // files.selectedCount (the real selection store's own size), not displayEntries.length, or it
  // would overstate the selected count by the in-flight placeholder count.
  it('content-area header: with an active upload placeholder in the listing, select-all shows the REAL selected count, not the display count', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    const files = useFilesStore()
    expect(files.currentPath).toBe('/DATA')

    const uploads = useUploadsStore()
    const placeholder: UploadItem = {
      id: 'up-1', file: null, fileName: 'newfile.txt', fileType: '', size: 1,
      targetPath: '/DATA', relativePath: 'newfile.txt', status: 'uploading', progress: 0.5,
      bytesSent: 0, speed: 0, tusUploadUrl: null, retryCount: 0, error: '',
      createdAt: 0, batchId: 'b1', batchTotal: 1, conflictPolicy: '',
    }
    uploads.queue.push(placeholder)
    await w.vm.$nextTick()

    // Sanity: the placeholder really does add a THIRD listed entry (Documents + a.txt +
    // newfile.txt), so "N items" (post-filter, placeholders included by design) reads 3 --
    // this is the display count the buggy version would have wrongly reused for "N selected" too.
    expect(w.find('.files-item-count').text()).toBe('3 项')
    expect(files.entries).toHaveLength(2) // the real store never counted the placeholder at all

    await w.get('.files-select-all').trigger('click')
    expect(files.selectedCount).toBe(2) // only the 2 REAL entries got selected
    expect(w.find('.files-item-count').text()).toBe('已选 2 项') // NOT "已选 3 项"
  })

  // Fix wave C: the capsule switcher replaces the old topbar `.files-viewtoggle` chips --
  // `.view-toggle-grid`/`.view-toggle-list` class names are kept unchanged (see the template's
  // own comment) precisely so this pre-existing wiring test still holds without modification.
  it('content-area header: view capsule switches files.viewMode and reflects it back', async () => {
    // Must clear BEFORE mount: useFilesStore()'s `viewMode` ref reads localStorage once, at
    // store-creation time (lazily triggered by the first component that accesses the store during
    // mount) -- clearing afterwards cannot un-read a value an earlier test in this file already
    // persisted via `.view-toggle-list`.
    localStorage.clear()
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    const files = useFilesStore()

    expect(files.viewMode).toBe('grid')
    expect(w.find('.view-toggle-grid').classes()).toContain('active')
    expect(w.find('.view-toggle-list').classes()).not.toContain('active')

    await w.get('.view-toggle-list').trigger('click')
    expect(files.viewMode).toBe('list')
    expect(w.find('.view-toggle-list').classes()).toContain('active')
    expect(w.find('.view-toggle-grid').classes()).not.toContain('active')
  })

  // These two close the exact gap fix-round-1 F4 flagged: FileContextMenu.test.ts
  // only proves the menu ITEM fires action 'paste'; nothing proved Files.vue's
  // dispatcher still listens for that string. Both routes into ops.paste() --
  // the toolbar button and the context-menu action -- get their own test so a
  // stale case label (e.g. still matching 'paste-overwrite') would go red here
  // even though FileContextMenu.test.ts and useFileOps.test.ts both stay green.
  it('toolbar Paste button reaches ops.paste() and submits the clipboard contents', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    useClipboardStore().operate('copy', [{ path: '/DATA/other-file.txt', is_dir: false }])
    await w.vm.$nextTick()
    await w.get('.tb-paste').trigger('click')
    await flushPromises()
    expect(service.batch.task).toHaveBeenCalledWith(expect.objectContaining({ style: 'rename', to: '/DATA' }))
  })

  it('context menu "paste" action reaches ops.paste(), not a stale paste-overwrite/paste-skip handler', async () => {
    // fix-round-3 M1 correction: an earlier draft of this comment blamed
    // `wrapper.vm.$emit()` itself for not invoking the parent listener. That
    // diagnosis was wrong -- a minimal parent/child repro showed `.vm.$emit()`
    // reaches a real `onAction` listener just fine, called exactly once.
    //
    // The actual root cause is that `Files.vue`'s render tree contains TWO
    // `FileContextMenu` instances: FilesSidebar.vue's own copy (for the
    // favourites list, inside FilesSidebar.vue:220 -- Files.vue:621 is only
    // where `<FilesSidebar>` itself is mounted) and the main listing's (around
    // Files.vue:681). `findComponent(FileContextMenu)` -- and `findAll(...)`'s
    // first result -- resolves to the SIDEBAR's instance, whose
    // `onFavoriteAction` deliberately no-ops when `entry` is null
    // (`if (entry) emit('ctx-action', ...)`; blank-area actions like 'paste'
    // are never forwarded from there). The event genuinely fired -- it just
    // landed on the wrong instance. This is the SAME ambiguity later hit again
    // at the DOM level as two `.ctx-paste` elements, not a second, unrelated
    // bug -- one root cause, two places it showed up.
    //
    // The fix stubs reka-ui's ContextMenu/ContextMenuItem the same way
    // FileContextMenu.test.ts does, and drives an actual DOM click through
    // FileContextMenu's own real `fire()` -> real `emit('action', ...)` ->
    // real `onAction` prop chain, exactly as production code would, then
    // disambiguates which `.ctx-paste` element belongs to the main listing
    // (see the `mainMenuPaste` lookup below).
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD'); await router.isReady()
    const w = mount(Files, {
      global: {
        plugins: [router, i18n],
        stubs: { ContextMenu: ContextMenuStub, ContextMenuItem: ContextMenuItemStub },
      },
    })
    await flushPromises()
    useClipboardStore().operate('copy', [{ path: '/DATA/other-file.txt', is_dir: false }])
    await w.vm.$nextTick()
    // FilesSidebar.vue ALSO renders a FileContextMenu (for the favourites list),
    // so the stub produces two `.ctx-paste` buttons in the tree -- one wired to
    // Files.vue's real ops.paste() and one wired to the sidebar's
    // onFavoriteAction, which silently no-ops for a null entry (blank-area
    // actions like 'paste' are never forwarded there, by design -- see
    // FilesSidebar.vue's onFavoriteAction). Disambiguate by picking the one
    // whose sibling in the stub's rendered tree is `.files-listwrap`, the
    // trigger content Files.vue itself passes into <FileContextMenu>.
    const mainMenuPaste = w.findAll('.ctx-paste')
      .find((btn) => btn.element.parentElement?.parentElement?.querySelector('.files-listwrap'))
    expect(mainMenuPaste).toBeTruthy()
    await mainMenuPaste!.trigger('click')
    await flushPromises()
    expect(service.batch.task).toHaveBeenCalledWith(expect.objectContaining({ style: 'rename', to: '/DATA' }))
  })

  // 2026-08-13 contract change (owner requested): right-click no longer pulls the row into
  // the selection (the old behaviour, selectOnly, would light up the row's selected state
  // and pop up the top SelectionToolbar). The menu target is now decided by ctxEntry +
  // contextTargets. This guards: after right-click sets ctxEntry on a row, the same event
  // bubbling up to the container's blank-area handler must not clear it.
  it('right-click on a row only sets ctxEntry and does not touch the selection; bubbling to the container must not clear ctxEntry', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    await w.get('.view-toggle-list').trigger('click')
    const files = useFilesStore()
    const row = w.findAll('.file-row')[0]
    // native contextmenu bubbles from the row (data-path target) up through files-listwrap;
    // the container's blank-area handler must not clobber the row-set ctxEntry.
    await row.trigger('contextmenu')
    expect(files.selectedCount).toBe(0)
    expect((w.vm as any).ctxEntry?.path).toBeTruthy()
  })
})

describe('snapshot read-only banner', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ;(globalThis as any).IntersectionObserver = class {
      cb: (e: { isIntersecting: boolean }[]) => void
      constructor(cb: any) { this.cb = cb }
      observe() { this.cb([{ isIntersecting: true }]) }
      disconnect() {}
    }
  })

  it('a normal directory does not show the banner', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/Photos'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    expect(w.find('.snap-banner').exists()).toBe(false)
  })

  // Task 15 (Vue2 parity, banner dual-state semantics): with the default listVolumes mock (top
  // of file, `/DATA` reports `supported: true`), landing directly on a real `.snapshots/<name>/...`
  // path auto-enters the Time Machine stage (Task 10) -- by the time flushPromises settles,
  // browse.tmActive is already true (see the 'Time Machine entry point > deep-link auto-enter'
  // describe block's own case ③ for the same assertion in isolation). Vue2's own FilePanel.vue
  // hides this banner exactly in that state (`:info="isTimeMachineChromeVisible ? null : ..."`) --
  // the stage supplies its own read-only chrome (snap chip + bottom bar) instead. This case pins
  // BOTH halves of that dual state: hidden while the stage owns the chrome, and still shown in the
  // fail-safe gap where the lock is on but the stage never got confirmation to auto-enter.
  it('banner dual-state: hidden while the Time Machine stage is active, still shown in the fail-safe gap where the lock is on but the stage never auto-entered', async () => {
    // Half 1: normal auto-enter (confirmed-supported volume) -- the stage takes over, banner hidden.
    {
      const folders = useFoldersStore()
      folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
      const router = makeRouter()
      router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Photos'); await router.isReady()
      const w = mount(Files, { global: { plugins: [router, i18n] } })
      await flushPromises()
      const browse = useSnapshotBrowseStore()
      expect(browse.tmActive).toBe(true) // sanity: this scenario really did auto-enter
      expect(w.find('.tm-stage--active').exists()).toBe(true)
      expect(w.find('.snap-banner').exists()).toBe(false)
    }

    // Half 2: fail-safe gap -- shouldGuardSnapshotView's own fail-safe direction locks
    // isSnapshotView while listVolumes has failed (status 'error'), but shouldAutoEnter requires
    // a POSITIVELY confirmed `supported: true` volume (snapshotBrowse.ts's own header comment on
    // shouldAutoEnter), so tmActive never flips true here -- the exact same setup the 'deep-link
    // auto-enter' describe block's own case ② already exercises for tmActive, reused here for the
    // banner's own visibility.
    {
      setActivePinia(createPinia())
      vi.mocked(service.snapshot.listVolumes).mockRejectedValueOnce(new Error('network'))
      const folders = useFoldersStore()
      folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
      const router = makeRouter()
      router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Photos'); await router.isReady()
      const w = mount(Files, { global: { plugins: [router, i18n] } })
      await flushPromises()
      const browse = useSnapshotBrowseStore()
      expect(browse.tmActive).toBe(false) // never auto-entered: no confirmed volume
      expect(browse.isSnapshotView).toBe(true) // but the read-only lock stays on (fail-safe)
      expect(w.find('.tm-stage--active').exists()).toBe(false)
      expect(w.find('.snap-banner').exists()).toBe(true) // the ONLY read-only signal left standing
    }
  })

  // Important 3 (final review): Vue2's own FilePanel.vue moves the "you're read-only" signal
  // into the shrunk real window's OWN header bar (`.tm-snap-chip`, gated on
  // `isTimeMachineChromeVisible`) while the Time Machine stage's chrome is up -- New-UI hid the
  // top banner in that state (Task 15, see the dual-state test just above) but never grew a
  // replacement signal, leaving the shrunk window with NO read-only indicator at all. Covers both
  // halves: present while tmActive (the stage owns the chrome), absent on a plain directory.
  it('the real window header shows a "Snapshot · Read-only" chip while Time Machine is active, and nowhere else', async () => {
    // Half 1: a plain directory -- no chip.
    {
      const folders = useFoldersStore()
      folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
      const router = makeRouter()
      router.push('/files/NimoOS-HD/Photos'); await router.isReady()
      const w = mount(Files, { global: { plugins: [router, i18n] } })
      await flushPromises()
      expect(w.find('.tm-real-window-chip').exists()).toBe(false)
    }

    // Half 2: auto-entered Time Machine (default listVolumes mock reports `/DATA` supported) --
    // chip present with Vue2's own copy.
    {
      setActivePinia(createPinia())
      const folders = useFoldersStore()
      folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
      const router = makeRouter()
      router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Photos'); await router.isReady()
      const w = mount(Files, { global: { plugins: [router, i18n] } })
      await flushPromises()
      const browse = useSnapshotBrowseStore()
      expect(browse.tmActive).toBe(true) // sanity: auto-entered
      expect(w.find('.tm-real-window-chip').exists()).toBe(true)
      expect(w.find('.tm-real-window-chip').text()).toBe('快照 · 只读')
    }
  })

  // Fix wave B (B2, owner acceptance 2026-08-26): the chip used to be a SIBLING of <Breadcrumb> in
  // `.files-topbar-left`, which pushed it to the far right of the topbar (Breadcrumb's own root
  // grows to fill that container, see Breadcrumb.vue's own <style> comment) instead of hugging the
  // breadcrumb's actual rendered path the way Vue2's `.tm-snap-chip` does (`margin-left: 10px`,
  // immediately after `<file-breadcrumb>` in the SAME flex row). Pinned two ways: DOM order (the
  // chip is now a DESCENDANT of `.breadcrumb`, not a child of `.files-topbar-left` sitting after
  // it) and CSS (no `justify-content: space-between`/auto-margin anywhere between them that could
  // still shove it to the container's end).
  it('the read-only chip is nested inside the breadcrumb\'s own flex row, hugging it -- not a sibling pushed to the topbar\'s far end', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Photos'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()

    expect(w.find('.breadcrumb .tm-real-window-chip').exists()).toBe(true)
    // Was a direct child of .files-topbar-left, sitting right after <nav class="breadcrumb">
    // (whose own flex-grow left no room before the container's far edge) -- must not be any more.
    const topbarLeft = w.find('.files-topbar-left')
    const directChipChild = topbarLeft.element.querySelector(':scope > .tm-real-window-chip')
    expect(directChipChild).toBeNull()
  })

  // Review fix (Important): the drag-drop overlay suggests "drop it here to upload", but a
  // drop in snapshot mode is already blocked by commitSelectedFiles' guard and toasted --
  // the overlay shouldn't appear on a read-only snapshot at all.
  it('does not show the "upload to..." overlay when dragging into a snapshot', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Photos'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    await w.get('.files-main').trigger('dragover')
    expect(w.find('.files-drop-mask').exists()).toBe(false)
  })

  it('still shows the "upload to..." overlay when dragging into a normal directory (control group, guards against the overlay being deleted by mistake)', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/Photos'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    await w.get('.files-main').trigger('dragover')
    expect(w.find('.files-drop-mask').exists()).toBe(true)
  })

  // Review fix (Critical 1): the `.snapshots` container directory itself (clicking the
  // ".snapshots" segment on the breadcrumb, with no specific snapshot name) -- previously
  // isSnapshotView couldn't detect the lock, so the write toolbar + Time Machine chip both
  // popped up.
  it('the `.snapshots` container directory itself: neither the write toolbar nor the Time Machine entry appears', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/.snapshots'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    expect(w.find('.files-actions').exists()).toBe(false)
    expect(w.find('.tb-time-machine').exists()).toBe(false)
    // Bonus: once the lock kicks in there should be a banner telling the user why, not
    // "locked but nobody told you"
    expect(w.find('.snap-banner').exists()).toBe(true)
    expect(w.find('.snap-banner').text()).toContain('请选择一个快照')
  })

  // Task 15 gap: the container-path case just above pins the write toolbar/entry-chip lock for
  // the bare `.snapshots` directory, but nothing previously pinned the SAME lock for the much more
  // common case -- actually standing inside a named snapshot's own content. Covers both halves of
  // the dual-state split: the toolbar stays gone whether the Time Machine stage owns the chrome
  // (tmActive true, the default here via auto-enter) or the fail-safe/non-stage state (tmActive
  // forced false) -- `browse.isSnapshotView` is the toolbar's only gate (Files.vue's own
  // `v-if="!browse.isSnapshotView"` on `.files-actions`), independent of tmActive either way.
  it('a real (named) snapshot path: the write toolbar and Time Machine entry chip stay gone in both the stage-active and fail-safe states', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Photos'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    const browse = useSnapshotBrowseStore()
    expect(browse.tmActive).toBe(true) // sanity: auto-entered by default (confirmed-supported volume)
    // Scoped to `.tm-stage__hold` (the LIVE real-window container), not a bare class query:
    // TimeMachineStage.vue's own entry-transition clones `.tm-fwin`'s DOM into a purely decorative,
    // `aria-hidden`/`pointer-events:none` background layer (`.tm-stage__clone`) the instant tmActive
    // flips true -- captured (by design, flush:'sync', see that file's own header comment) from
    // whatever this component had rendered up to that point in the SAME flush pass, which for an
    // auto-entered deep link is a stale pre-navigation frame (`isSnapshotView` still false, before
    // `files.currentPath` catches up) where `.files-actions`/`.tb-time-machine` were still showing.
    // That stale ghost copy is harmless in production (never visible, never interactive) but a bare
    // `w.find('.files-actions')` would match it instead of (or as well as) the real, correctly-hidden
    // live one, and MUST NOT be mistaken for a real assertion of the toolbar being gone.
    expect(w.find('.tm-stage__hold .files-actions').exists()).toBe(false)
    expect(w.find('.tm-stage__hold .tb-time-machine').exists()).toBe(false)

    browse.tmActive = false // fail-safe/non-stage half of the same lock
    await w.vm.$nextTick()
    expect(w.find('.tm-stage__hold .files-actions').exists()).toBe(false)
    expect(w.find('.tm-stage__hold .tb-time-machine').exists()).toBe(false)
  })

  // Review re-check (Minor, second round), UPDATED for Task 6 (Vue2-parity Time Machine line,
  // Ruling P2): SnapshotSelectionToolbar (the dedicated `.snap-sel`/`.snap-sel-restore` multi-
  // select restore bar) is retired outright -- it no longer exists in Files.vue's template at
  // all, under any path, so there is nothing left to gate by `!!browse.browseInfo` here. What
  // this test still guards: the regular write-capable SelectionToolbar (copy/cut/download/
  // share/delete) must still never appear under the `.snapshots` container directory --
  // cut/paste/share on a read-only snapshot path is a real hazard the original re-check
  // addendum already documented (cut = move = deletes the source; useFileOps.paste()'s
  // blockedInSnapshot() only checks the destination; onShare has no snapshot guard at all).
  it('an entry selected under the `.snapshots` container directory: the write-capable selection toolbar does not appear', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/.snapshots'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    await w.get('.view-toggle-list').trigger('click')
    const row = w.findAll('.file-row')[0]
    await row.trigger('click', { ctrlKey: true })
    const files = useFilesStore()
    expect(files.selectedCount).toBe(1)
    expect(w.find('.selection-toolbar').exists()).toBe(false)
  })

  // Task 15 gap: same coverage as the container-path case just above, but for a real (named)
  // snapshot path -- the far more common way a user actually lands with a selection while
  // browsing snapshot content. `SelectionToolbar`'s own gate is `!browse.isSnapshotView`
  // (independent of tmActive), so this holds in the stage-active state too (the default here).
  it('an entry selected under a real (named) snapshot path: the write-capable selection toolbar does not appear', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Photos'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    expect(useSnapshotBrowseStore().tmActive).toBe(true) // sanity: stage-active by default
    await w.get('.view-toggle-list').trigger('click')
    const row = w.findAll('.file-row')[0]
    await row.trigger('click', { ctrlKey: true })
    const files = useFilesStore()
    expect(files.selectedCount).toBe(1)
    expect(w.find('.selection-toolbar').exists()).toBe(false)
  })

  // Control group (guards against blocking one of the main entry points to the restore
  // feature along with it): with an entry selected under an actual snapshot path (a specific
  // snapshot name, browseInfo non-null), the banner's own restore button -- now the only
  // restore-selection entry point until Task 9's bottom action bar lands -- still appears and
  // stays enabled for the multi-select case.
  it('an entry selected under a regular snapshot path (with a specific snapshot name): the banner\'s restore button still appears, enabled', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Photos'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    // Task 15 (banner dual-state): the default listVolumes mock reports /DATA as
    // `supported: true`, so this real snapshot path auto-enters the Time Machine stage
    // (browse.tmActive flips true), which now hides this banner (see the dual-state test
    // above). This case is specifically about the banner's OWN restore button, which is Vue2
    // parity for the fail-safe/non-stage state (tmActive false, isSnapshotView still locked) --
    // force it directly, the same technique the 'Time Machine stage bottom bar' case below uses
    // in the other direction, rather than re-plumbing a whole unconfirmed-volume scenario just
    // to reach this state. Final review (Important 5): bannerInfo now reads tmChromeVisible, not
    // tmActive directly (see that computed's own comment in Files.vue) -- a bare `tmActive = false`
    // no longer reveals the banner by itself once nothing ever navigates isSnapshotView false (the
    // held-chrome watcher would otherwise hold tmChromeVisible true forever, waiting on a
    // navigation this synthetic setup never makes). Force both, simulating "the stage never
    // acquired the chrome in the first place" rather than "an exit currently in flight".
    const browseStore = useSnapshotBrowseStore()
    browseStore.tmActive = false
    browseStore.tmChromeVisible = false
    await w.vm.$nextTick()
    await w.get('.view-toggle-list').trigger('click')
    const row = w.findAll('.file-row')[0]
    await row.trigger('click', { ctrlKey: true })
    const files = useFilesStore()
    expect(files.selectedCount).toBe(1)
    expect(w.find('.snap-banner-restore').exists()).toBe(true)
    expect(w.find('.snap-banner-restore').attributes('disabled')).toBeUndefined()
  })

  // Final review (Important 4, Ruling F-1): SnapshotActionBar rebuild -- the snapshot-view
  // equivalent of the generic SelectionToolbar, which stays hidden here (see the two
  // "write-capable selection toolbar does not appear" cases above). Covers all three things the
  // finding called out: absent outside snapshot view, present with the right count once selected
  // inside it, and its two buttons wired to the same entry points the banner/context-menu use.
  it('SnapshotActionBar: absent outside snapshot view, present with the selection count inside it, Restore/Download wired', async () => {
    // Half 1: a plain directory -- selecting an item never shows it (SelectionToolbar owns that state).
    {
      const folders = useFoldersStore()
      folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
      const router = makeRouter()
      router.push('/files/NimoOS-HD/Photos'); await router.isReady()
      const w = mount(Files, { global: { plugins: [router, i18n] } })
      await flushPromises()
      await w.get('.view-toggle-list').trigger('click')
      await w.findAll('.file-row')[0].trigger('click', { ctrlKey: true })
      expect(w.find('.tm-action-bar').exists()).toBe(false)
    }

    // Half 2: a real snapshot path (default listVolumes mock auto-enters the stage) -- present
    // with the right count, wired to restoreSelectionFlow/ops.download.
    {
      setActivePinia(createPinia())
      const folders = useFoldersStore()
      folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
      const router = makeRouter()
      router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Photos'); await router.isReady()
      const w = mount(Files, { global: { plugins: [router, i18n] } })
      await flushPromises()
      await w.get('.view-toggle-list').trigger('click')
      await w.findAll('.file-row')[0].trigger('click', { ctrlKey: true })
      const files = useFilesStore()
      expect(files.selectedCount).toBe(1)
      expect(w.find('.tm-action-bar').exists()).toBe(true)
      expect(w.find('.tm-action-bar-label').text()).toContain('1')

      const browse = useSnapshotBrowseStore()
      const restoreSpy = vi.spyOn(browse, 'restoreItems').mockResolvedValue()
      await w.find('.tm-action-bar-btn--restore').trigger('click')
      expect(restoreSpy).toHaveBeenCalled()

      // ops.download() is fire-and-forget (iframe-driven, no awaitable network call) -- its own
      // "preparing" toast is the observable side effect every other download-wiring case in this
      // codebase asserts on (e.g. useFileOps.test.ts).
      const toast = useToast()
      await w.find('.tm-action-bar-btn--download').trigger('click')
      expect(toast.toasts.some((t) => t.text === '正在准备下载…')).toBe(true)
    }
  })

  // Fix-wave I4: the banner's own restore button is one of Task 14's three restore entry points
  // (funnels into `browse.restoreItems(...)` via `restoreSelectionFlow`) -- it must show the same
  // running count instead of just sitting there grayed out next to a sibling button that does
  // show progress.
  it('wires the snapshot store\'s restore progress into the banner\'s own restore button too', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Photos'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    // Task 15 (banner dual-state): force out of the auto-entered stage state, same reasoning as
    // the "banner's restore button still appears" case above -- this test is about the banner's
    // OWN progress rendering, which only matters while the banner itself is the thing showing.
    // Final review (Important 5): force tmChromeVisible too -- see that case's own comment.
    const browse = useSnapshotBrowseStore()
    browse.tmActive = false
    browse.tmChromeVisible = false
    await w.vm.$nextTick()
    await w.get('.view-toggle-list').trigger('click')
    await w.findAll('.file-row')[0].trigger('click', { ctrlKey: true })
    expect(w.find('.snap-banner-restore').exists()).toBe(true)

    browse.restoring = true
    browse.restoreProgress = { done: 3, total: 40 }
    await w.vm.$nextTick()

    const btnText = w.get('.snap-banner-restore').text()
    expect(btnText).toContain('3')
    expect(btnText).toContain('40')
  })

  // Fix wave C: the New dropdown keeps the SAME `v-if="!browse.isSnapshotView"` gate the old
  // `.files-actions` wrapper already had (writes stay locked while browsing a snapshot), but the
  // new content-area header row (select-all + count + view capsule) is deliberately NOT gated on
  // it -- Vue2's own snapshot browsing window carried exactly this same row (see Files.vue's own
  // template comment above `.files-list-head`), so it must stay visible here too.
  it('snapshot view: hides the New dropdown but keeps the content-area header row (select-all + capsule)', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Photos'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    const browse = useSnapshotBrowseStore()
    expect(browse.isSnapshotView).toBe(true) // sanity: this really is snapshot view

    // Scoped to `.tm-stage__hold` (the LIVE real-window container), not a bare class query --
    // same reasoning as the "a real (named) snapshot path" case just above: TimeMachineStage.vue's
    // own entry-transition clones a STALE pre-navigation frame into a decorative `.tm-stage__clone`
    // layer, where `.tb-new-menu` was still showing (captured before `isSnapshotView` flipped
    // true). A bare `w.find('.tb-new-menu')` would match that harmless ghost copy instead of (or
    // as well as) the real, correctly-hidden live one.
    expect(w.find('.tm-stage__hold .tb-new-menu').exists()).toBe(false)
    expect(w.find('.tm-stage__hold .files-list-head').exists()).toBe(true)
    expect(w.find('.tm-stage__hold .files-select-all').exists()).toBe(true)
    expect(w.find('.tm-stage__hold .files-view-capsule').exists()).toBe(true)
  })

  // Fix wave D (D1, owner acceptance 2026-08-26): the breadcrumb's favorite star must be hidden
  // whenever `browse.isSnapshotView` is true -- snapshots are read-only, matching Vue2's own
  // GirdView.vue ("never while browsing a snapshot") and restoring front/back parity with
  // SnapshotPreviewWindow.vue's depth-stack layers, which never rendered a star to begin with.
  it('snapshot view: hides the breadcrumb favorite star; normal browsing still shows it', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Photos'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    const browse = useSnapshotBrowseStore()
    expect(browse.isSnapshotView).toBe(true) // sanity: this really is snapshot view

    // Scoped to the live real-window container -- same reasoning as the adjacent "New dropdown"
    // case above: TimeMachineStage.vue's own entry-transition clone can carry a stale pre-nav star.
    expect(w.find('.tm-stage__hold .crumb-star').exists()).toBe(false)

    // Navigate out of the snapshot back to a normal folder: the star must come back.
    await router.push('/files/NimoOS-HD/Documents')
    await flushPromises()
    expect(browse.isSnapshotView).toBe(false)
    expect(w.find('.tm-stage__hold .crumb-star').exists()).toBe(true)
  })
})

// Task 14: the three restore entry points (context-menu single item, banner restore button,
// Time Machine stage bottom bar) all converge into `browse.restoreItems(items, defaultDir,
// openPicker)`. These tests spy on `restoreItems` itself (same technique
// TimeMachineStage.test.ts's own Task 9 test uses) rather than driving the real
// RestoreDestinationModal/FileConflictDialog through to completion -- the orchestration logic
// itself (picker -> conflict queue -> execute -> toast) is already covered end-to-end by
// snapshotBrowse.test.ts/useFileConflicts.test.ts/snapshotRestore.test.ts; what's under test here
// is only "does clicking the right thing call restoreItems with the right arguments".
describe('restore orchestration wiring (Task 14)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ;(globalThis as any).IntersectionObserver = class {
      cb: (e: { isIntersecting: boolean }[]) => void
      constructor(cb: any) { this.cb = cb }
      observe() { this.cb([{ isIntersecting: true }]) }
      disconnect() {}
    }
    // RestoreDestinationModal/AlertDialog teleport to document.body via reka-ui's Portal -- same
    // attachTo + cleanup convention as the 'Time Machine entry point' describe block below.
    document.body.innerHTML = ''
  })

  it('context menu "Restore to original location" calls browse.restoreItems with the single item', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Photos'); await router.isReady()
    const w = mount(Files, {
      global: { plugins: [router, i18n], stubs: { ContextMenu: ContextMenuStub, ContextMenuItem: ContextMenuItemStub } },
    })
    await flushPromises()
    await w.get('.view-toggle-list').trigger('click')
    const files = useFilesStore()
    const target = files.entries[0]
    const browse = useSnapshotBrowseStore()
    const spy = vi.spyOn(browse, 'restoreItems').mockResolvedValue()

    const row = w.findAll('.file-row')[0]
    await row.trigger('contextmenu')
    // Same disambiguation as the "context menu paste" case above: FilesSidebar.vue also renders
    // a FileContextMenu whose own copy of this button (if it renders at all) is not wired to the
    // main listing's row/store state.
    const restoreBtn = w.findAll('.ctx-restore-original')
      .find((btn) => btn.element.parentElement?.parentElement?.querySelector('.files-listwrap'))
    expect(restoreBtn).toBeTruthy()
    await restoreBtn!.trigger('click')

    expect(spy).toHaveBeenCalledTimes(1)
    const [items, , , opts] = spy.mock.calls[0]!
    expect(items).toEqual([{ path: target.path, name: target.name, is_dir: target.is_dir }])
    // Controller ruling, fix round 1: the context-menu entry point is the ONE caller that passes
    // singleItemFlow -- it's what makes restoreItems show Vue2's snapBrowseRestored copy instead of
    // the count-based tmRestoredCount copy every other entry point uses (see buildRestoreToasts).
    expect(opts).toEqual({ singleItemFlow: true })
  })

  it('banner restore with a selection calls browse.restoreItems with the selected items', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Photos'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    // Task 15 (banner dual-state): the default confirmed-supported volume mock auto-enters the
    // Time Machine stage on mount, which now hides this banner -- force back to the fail-safe/
    // non-stage state so the banner (and its own restore button, under test here) is reachable.
    // Final review (Important 5): force tmChromeVisible too -- see the earlier case's own comment.
    const browse = useSnapshotBrowseStore()
    browse.tmActive = false
    browse.tmChromeVisible = false
    await w.vm.$nextTick()
    await w.get('.view-toggle-list').trigger('click')
    const files = useFilesStore()
    const target = files.entries[0]
    await w.findAll('.file-row')[0].trigger('click', { ctrlKey: true })
    expect(files.selectedCount).toBe(1)

    const spy = vi.spyOn(browse, 'restoreItems').mockResolvedValue()
    await w.get('.snap-banner-restore').trigger('click')

    expect(spy).toHaveBeenCalledTimes(1)
    const [items, , , opts] = spy.mock.calls[0]!
    expect(items).toEqual([{ path: target.path, name: target.name, is_dir: target.is_dir }])
    // Controller ruling, fix round 1: even a one-item selection keeps the banner's own
    // count-based tmRestoredCount copy -- entry point decides, not item count (contrast with
    // the context-menu case above, which DOES pass singleItemFlow for the exact same shape call).
    expect(opts?.singleItemFlow).toBeFalsy()
  })

  it('banner restore with no selection, not at the snapshot root: opens the folder-confirm dialog; confirming calls browse.restoreItems with the whole browsed directory', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Photos'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] }, attachTo: document.body })
    await flushPromises()
    // Task 15 (banner dual-state): same fail-safe/non-stage forcing as the case above. Final
    // review (Important 5): force tmChromeVisible too -- see the earlier case's own comment.
    const browse = useSnapshotBrowseStore()
    browse.tmActive = false
    browse.tmChromeVisible = false
    await w.vm.$nextTick()

    const spy = vi.spyOn(browse, 'restoreItems').mockResolvedValue()
    await w.get('.snap-banner-restore').trigger('click')
    await flushPromises()

    expect(spy).not.toHaveBeenCalled() // not yet -- the confirm dialog must be answered first
    expect(document.body.textContent).toContain('Photos') // the folder being confirmed, by name

    const confirmBtn = Array.from(document.body.querySelectorAll('.ui-btn'))
      .find((el) => el.textContent === zh['snapBrowseRestore' as keyof typeof zh])
    expect(confirmBtn).toBeTruthy()
    ;(confirmBtn as HTMLElement).click()
    await flushPromises()

    expect(spy).toHaveBeenCalledTimes(1)
    const [items, , , opts] = spy.mock.calls[0]!
    expect(items).toEqual([{ path: '/DATA/.snapshots/20260713T061900Z_manual/Photos', name: 'Photos', is_dir: true }])
    // Vue2's own whole-folder-confirm branch routes through executeSnapshotRestore (the
    // count-based copy), not restoreSnapshotItem -- so this synthetic one-item array must NOT
    // set singleItemFlow either, same as the selection branch above.
    expect(opts?.singleItemFlow).toBeFalsy()
  })

  it('banner restore with no selection AT the snapshot root: toasts tmSelectFirst, no dialog, no restoreItems call', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] }, attachTo: document.body })
    await flushPromises()
    // Task 15 (banner dual-state): same fail-safe/non-stage forcing as the two cases above. Final
    // review (Important 5): force tmChromeVisible too -- see the earlier case's own comment.
    const browse = useSnapshotBrowseStore()
    browse.tmActive = false
    browse.tmChromeVisible = false
    await w.vm.$nextTick()

    const spy = vi.spyOn(browse, 'restoreItems').mockResolvedValue()
    await w.get('.snap-banner-restore').trigger('click')
    await flushPromises()

    expect(spy).not.toHaveBeenCalled()
    expect(useToast().msg).toBe(zh['tmSelectFirst' as keyof typeof zh])
    expect(document.body.querySelector('.ui-dialog-title')).toBeNull()
  })

  it('Time Machine stage bottom bar "Restore selection" reaches the same restoreItems orchestration as the banner button', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Photos'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] }, attachTo: document.body })
    await flushPromises()
    await w.get('.view-toggle-list').trigger('click')
    const files = useFilesStore()
    const target = files.entries[0]
    await w.findAll('.file-row')[0].trigger('click', { ctrlKey: true })
    expect(files.selectedCount).toBe(1)

    // The real window's own selection is shared state (files store), independent of the stage
    // shell -- forcing tmActive true directly (same technique TimeMachineStage.test.ts's own
    // Task 9 cases use) skips the chip-click navigation dance without weakening what's under
    // test here: whether the bottom bar's emit actually reaches Files.vue's real
    // `restoreSelectionFlow` handler (T9 shipped this as a no-op placeholder;
    // Files.vue:803's own comment documents the placeholder Task 14 replaces).
    const browse = useSnapshotBrowseStore()
    browse.tmActive = true
    await w.vm.$nextTick()

    const spy = vi.spyOn(browse, 'restoreItems').mockResolvedValue()
    await w.find('.tm-stage__bar-btn--restore').trigger('click')

    expect(spy).toHaveBeenCalledTimes(1)
    const [items, , , opts] = spy.mock.calls[0]!
    expect(items).toEqual([{ path: target.path, name: target.name, is_dir: target.is_dir }])
    expect(opts?.singleItemFlow).toBeFalsy()
  })
})

describe('Time Machine entry point', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ;(globalThis as any).IntersectionObserver = class {
      cb: (e: { isIntersecting: boolean }[]) => void
      constructor(cb: any) { this.cb = cb }
      observe() { this.cb([{ isIntersecting: true }]) }
      disconnect() {}
    }
    // Starting at T11, this describe block gains a case (the gear dialog) that goes through
    // reka-ui's Portal to teleport .ssm-content (SnapshotSettingsModal's own dialog content,
    // not the shared components/ui/Dialog.vue wrapper -- see that component's own file-header
    // comment for why) onto the real document.body -- an instance mounted with
    // attachTo: document.body doesn't auto-unmount between tests, so clear body to stop the
    // previous case's leftover node from polluting the next case's querySelector (same
    // handling as SnapshotSettingsModal.test.ts / RaidDeleteDialog.test.ts).
    document.body.innerHTML = ''
  })

  // Mounts on the given real path: disk 'NimoOS-HD' <-> mount point '/DATA' (same convention
  // as the rest of this file's cases); swapping the real path's '/DATA' prefix for the
  // virtual segment 'NimoOS-HD' gives the route param. The listVolumes mock (see top of file)
  // returns /DATA with supported:true, so canShowEntry should be true on non-snapshot paths.
  async function mountFiles(realPath: string) {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    const virtual = realPath.replace(/^\/DATA/, 'NimoOS-HD')
    router.push('/files/' + virtual); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] }, attachTo: document.body })
    await flushPromises()
    return w
  }

  it('entry chip appears on a supported volume', async () => {
    const w = await mountFiles('/DATA/Photos')
    expect(w.find('.tb-time-machine').exists()).toBe(true)
  })
  it('entry chip does not appear when already inside a snapshot', async () => {
    const w = await mountFiles('/DATA/.snapshots/snap1')
    expect(w.find('.tb-time-machine').exists()).toBe(false)
  })
  it('clicking the entry activates the Time Machine stage', async () => {
    const w = await mountFiles('/DATA/Photos')
    await w.find('.tb-time-machine').trigger('click')
    await flushPromises()
    expect(w.find('.tm-stage--active').exists()).toBe(true)
  })
  it('clicking the gear opens the settings dialog; Time Machine stays open', async () => {
    const w = await mountFiles('/DATA/Photos')
    await w.find('.tb-time-machine').trigger('click')
    await flushPromises()
    await w.find('.tm-stage__gear').trigger('click')
    await flushPromises()
    expect(document.querySelector('.ssm-content')).not.toBeNull()
    expect(w.find('.tm-stage--active').exists()).toBe(true)
  })

  // Task 10: deep-link auto-enter (a watch(() => browse.shouldAutoEnter, ...) in Files.vue's own
  // script setup, `{ immediate: true }`) -- covers a pasted/bookmarked URL, and (further below)
  // the Storage page's own "Browse" link, landing directly in the Time Machine stage without a
  // click on the entry chip. Cases numbered to match task-10-brief.md's own five-case list.
  describe('deep-link auto-enter', () => {
    it('① a normal (non-snapshot) path never auto-enters', async () => {
      const w = await mountFiles('/DATA/Photos')
      const { useSnapshotBrowseStore } = await import('../files/stores/snapshotBrowse')
      expect(useSnapshotBrowseStore().tmActive).toBe(false)
      expect(w.find('.tm-stage--active').exists()).toBe(false)
    })

    it('② a `.snapshots` deep link whose volume cannot be confirmed (fetch failed) does not auto-enter -- the read-only guard stays locked regardless', async () => {
      vi.mocked(service.snapshot.listVolumes).mockRejectedValueOnce(new Error('network'))
      const w = await mountFiles('/DATA/.snapshots/snap1')
      const { useSnapshotBrowseStore } = await import('../files/stores/snapshotBrowse')
      const browse = useSnapshotBrowseStore()
      expect(browse.status).toBe('error')
      expect(browse.tmActive).toBe(false)
      expect(w.find('.tm-stage--active').exists()).toBe(false)
      // Fail-safe: NOT auto-entering must not be mistaken for "safe to write" -- the lock itself
      // (unrelated to tmActive, see shouldGuardSnapshotView) stays on through the idle/error state.
      expect(browse.isSnapshotView).toBe(true)
    })

    it('③ a `.snapshots` deep link on a confirmed-supported volume auto-enters the stage (single snapshot-list fetch)', async () => {
      // Delta, not an absolute count: this describe block's own beforeEach does not reset mock
      // call history (by design -- other cases here assert on accumulated state), and earlier
      // cases in this same top-level describe already clicked the entry chip at least once.
      const before = vi.mocked(service.snapshot.list).mock.calls.length
      const w = await mountFiles('/DATA/.snapshots/snap1')
      const { useSnapshotBrowseStore } = await import('../files/stores/snapshotBrowse')
      const browse = useSnapshotBrowseStore()
      expect(browse.tmActive).toBe(true)
      expect(w.find('.tm-stage--active').exists()).toBe(true)
      expect(vi.mocked(service.snapshot.list).mock.calls.length - before).toBe(1)
    })

    // ⑤ (④'s own idempotency is covered at the store level in snapshotBrowse.test.ts, where
    // autoEnterTimeMachine() can be called directly twice without a real navigation in the way).
    it('⑤ exiting Time Machine does not immediately re-trigger auto-enter (loop guard)', async () => {
      const w = await mountFiles('/DATA/.snapshots/snap1')
      const { useSnapshotBrowseStore } = await import('../files/stores/snapshotBrowse')
      const browse = useSnapshotBrowseStore()
      expect(browse.tmActive).toBe(true) // auto-entered on mount, case ③

      browse.exitTimeMachine()
      expect(browse.tmActive).toBe(false) // clears synchronously

      // exitTimeMachine's own navigation goes through the app router SINGLETON (mocked to a
      // no-op push/replace at the top of this file), so files.currentPath never actually moves
      // off the `.snapshots` path here -- exactly the gap shouldAutoEnter's own header comment
      // describes. If the watcher re-fired on this unrelated reactivity flush, tmActive would
      // flip back true; it must not.
      await flushPromises()
      expect(browse.tmActive).toBe(false)
    })

    // Storage page's "Browse" link on a snapshot's timeline entry (SnapshotTimeline.vue's own
    // browse()) pushes the legacy `/files?path=<real .snapshots path>` deep link -- Files.vue's
    // existing sync() (unchanged by this task) resolves it into the canonical
    // /files/<virtual>/.snapshots/... route; this only asserts the round trip actually lands the
    // window in the Time Machine stage, not just on a read-only listing.
    it('Storage-timeline "Browse" (/files?path=<real path>) lands directly in the stage', async () => {
      const folders = useFoldersStore()
      folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
      const router = makeRouter()
      router.push({ path: '/files', query: { path: '/DATA/.snapshots/snap-a' } })
      await router.isReady()
      const w = mount(Files, { global: { plugins: [router, i18n] }, attachTo: document.body })
      await flushPromises()
      expect(router.currentRoute.value.fullPath).toContain('.snapshots')
      const { useSnapshotBrowseStore } = await import('../files/stores/snapshotBrowse')
      const browse = useSnapshotBrowseStore()
      expect(browse.tmActive).toBe(true)
      expect(w.find('.tm-stage--active').exists()).toBe(true)
    })
  })
})

// SP12-T9: a directory load failure used to be swallowed into an "empty folder", indistinguishable from a real empty directory.
describe('Files.vue directory load failure', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ;(globalThis as any).IntersectionObserver = class {
      cb: (e: { isIntersecting: boolean }[]) => void
      constructor(cb: any) { this.cb = cb }
      observe() { this.cb([{ isIntersecting: true }]) }
      disconnect() {}
    }
  })

  async function mountAt(realPath: string) {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/' + realPath.replace(/^\/DATA/, 'NimoOS-HD')); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    return w
  }

  it('shows the error bar with the raw backend message; clicking retry reloads', async () => {
    const w = await mountAt('/DATA')
    const files = useFilesStore()
    files.error = 'open /DATA/x: permission denied'
    files.loading = false
    await w.vm.$nextTick()
    expect(w.find('.files-error').exists()).toBe(true)
    expect(w.find('.files-error-detail').text()).toBe('open /DATA/x: permission denied')
    const spy = vi.spyOn(files, 'load')
    await w.find('.files-error button').trigger('click')
    expect(spy).toHaveBeenCalled()
  })

  it('falls back to /DATA when the disk list fails to load, instead of getting stuck on a blank page', async () => {
    localStorage.removeItem('nimoos:location-default')
    const folders = useFoldersStore()
    // What a total disk-list failure looks like: disks stays empty
    folders.loadDisks = vi.fn(async () => { folders.disks = [] as any })
    const router = makeRouter()
    router.push('/files'); await router.isReady()
    mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toContain('DATA')
    expect(useFilesStore().currentPath).toBe('/DATA')
  })

  // SP12-T11: after grid virtualization, measuring the DOM can only measure the visible rows.
  // The assertion lands on the result, not the internal call: jsdom doesn't do layout, so
  // measuring the DOM only ever gets 0x0 rects and selects nothing; going through geometry
  // instead gives real rects (column width/row height have fallback constants), so it can
  // actually select.
  it('the grid view marquee-selection rect comes from component geometry, not from measuring the DOM', async () => {
    const files = useFilesStore()
    files.setView('grid')
    const w = await mountAt('/DATA')
    expect(w.findComponent(FileGridView).exists()).toBe(true)
    expect(files.sortedEntries.length).toBeGreaterThan(0)
    const wrap = w.find('.files-listwrap')
    await wrap.trigger('mousedown', { clientX: 0, clientY: 0, button: 0 })
    // The move listener is attached on window (see Files.vue onMarqueeDown), so it must be dispatched on window
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 300, bubbles: true }))
    await w.vm.$nextTick()
    expect(files.selectedCount).toBeGreaterThan(0)
  })

  it('list view still goes through the measure-the-DOM path (not virtualized)', async () => {
    const files = useFilesStore()
    files.setView('list')
    const w = await mountAt('/DATA')
    expect(w.findComponent(FileGridView).exists()).toBe(false)
    const wrap = w.find('.files-listwrap')
    await wrap.trigger('mousedown', { clientX: 0, clientY: 0, button: 0 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 300, bubbles: true }))
    await w.vm.$nextTick()
    // Discriminator: measuring the DOM under jsdom gets 0x0 rects and selects nothing. The
    // grid case above selected >0, so together the two pin down that the branching really
    // does follow the view, rather than both sides running the same path.
    expect(files.selectedCount).toBe(0)
    files.setView('grid')
  })

  it('does not show the error bar while a load is in flight', async () => {
    const w = await mountAt('/DATA')
    const files = useFilesStore()
    files.error = 'boom'
    files.loading = true
    await w.vm.$nextTick()
    expect(w.find('.files-error').exists()).toBe(false)
  })
})
