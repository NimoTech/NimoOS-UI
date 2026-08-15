import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AppPathDialog from './AppPathDialog.vue'
import { i18n } from '../../../i18n'
import type { StorageVolume } from '../../../storage/util/storageMap'
import type { FolderEntry } from '@nimotech/nimoos-service'

const migrateAppPath = vi.fn()
const getMigrateStatus = vi.fn()
const folderGetList = vi.fn()
const folderCreate = vi.fn()
const folderRename = vi.fn()
const batchDelete = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      migrateAppPath: (...a: unknown[]) => migrateAppPath(...a),
      getMigrateStatus: (...a: unknown[]) => getMigrateStatus(...a),
    },
    folder: {
      getList: (...a: unknown[]) => folderGetList(...a),
      create: (...a: unknown[]) => folderCreate(...a),
      rename: (...a: unknown[]) => folderRename(...a),
    },
    batch: { delete: (...a: unknown[]) => batchDelete(...a) },
  },
}))

const SYS: StorageVolume = {
  uuid: 'da0e4da3', name: 'NimoOS-HD', isSystem: true, fsType: 'ext4',
  size: 512110190592, availSize: 333092294144, usedSize: 179017896448, usePercent: 35,
  driveName: 'nvme0n1p7', path: '/dev/nvme0n1p7', mountPoint: '/', disk: '/dev/nvme0n1',
}
const EXT: StorageVolume = { ...SYS, uuid: 'ext-1', name: 'Backup', isSystem: false, mountPoint: '/media/Backup' }

// reka-ui's real ContextMenuItem needs the MenuRootContext injected by a real ContextMenuRoot;
// our ContextMenu.vue teleports ContextMenuContent into a Portal via an actual right-click +
// waiting for an animation frame, which is flaky in jsdom. Same precedent as
// FileContextMenu.test.ts: stub out ContextMenu (render the default + #menu slots directly,
// no longer gated on "was it opened via right-click") and ContextMenuItem (pass class through +
// emit select on click, don't emit when disabled) -- this only verifies the pure-logic layer of
// "what did the menu render + what happens on click"; real right-click positioning/animation is
// left to T10 on-device verification.
const ContextMenuStub = { template: '<div><slot /><slot name="menu" /></div>' }
const ContextMenuItemStub = {
  props: ['disabled'],
  emits: ['select'],
  template: '<div :disabled="disabled ? \'\' : null" @click="!disabled && $emit(\'select\')"><slot /></div>',
}

// Adding this batch of write-path tests increased the mount() count -- the previous 11 cases
// never explicitly unmounted (afterEach only cleared document.body.innerHTML), and got away
// with it by luck. In the new tests, AlertDialog's Portal + reka's internal watch only fire
// inside the next test's flushPromises(), by which point the previous test's app instance is
// still "alive" but finds its mount point already gutted -- Cannot read properties of null
// on patch (an unhandled rejection). Fixed by tracking the wrapper produced by every
// mountDlg() call and unmounting them all cleanly in afterEach (a few tests already unmount
// themselves; the redundant unmount is swallowed with try/catch).
let mountedWrappers: Array<{ unmount: () => void }> = []
const mountDlg = (volumes: StorageVolume[] = [SYS, EXT], opts: { withCtxStubs?: boolean } = {}) => {
  const w = mount(AppPathDialog, {
    props: { open: true, type: 'app_data' as const, currentPath: '/DATA/AppData', requiredSpace: 6037987, volumes, displayNames: { '/DATA': 'NimoOS-HD', '/media/Backup': 'Backup' } },
    global: {
      plugins: [i18n],
      stubs: opts.withCtxStubs ? { ContextMenu: ContextMenuStub, ContextMenuItem: ContextMenuItemStub } : {},
    },
    attachTo: document.body,   // reka DialogPortal teleports into body
  })
  mountedWrappers.push(w)
  return w
}

/** Select the EXT partition -> enter the browse step (root folder list has arrived). Reused by the write-path (create/rename/delete) tests. */
async function enterBrowse() {
  await (document.querySelector('.set-mig-item') as HTMLElement).click()
  await (document.querySelector('.set-mig-next') as HTMLElement).click()
  await flushPromises()
}

describe('AppPathDialog', () => {
  beforeEach(() => {
    migrateAppPath.mockReset(); getMigrateStatus.mockReset(); folderGetList.mockReset()
    folderCreate.mockReset(); folderRename.mockReset(); batchDelete.mockReset()
    folderGetList.mockResolvedValue({ content: [
      { name: 'Backup', path: '/media/Backup/Backup', is_dir: true, is_symlink: false },
    ] })
  })
  afterEach(() => {
    for (const w of mountedWrappers) { try { w.unmount() } catch { /* the test itself already unmounted */ } }
    mountedWrappers = []
    document.body.innerHTML = ''
  })

  // The brief's original text has these two as synchronous assertions (querying the DOM
  // right after mountDlg() without awaiting). In practice reka's DialogPortal/DialogContent
  // needs a tick before it teleports content into document.body (same precedent in
  // DeviceInfoDialog.test.ts / NetworkIfaceConfigDialog.test.ts, both of which await
  // flushPromises() after mount before querying the DOM) -- added here, otherwise the
  // query is always empty; this is not a product-code issue.
  it('step 1 lists selectable partitions, excluding the current partition', async () => {
    mountDlg()
    await flushPromises()
    const items = document.querySelectorAll('.set-mig-item')
    expect(items).toHaveLength(1)
    expect(items[0].textContent).toContain('Backup')
  })

  it('shows "no other storage available" when the device has only one partition, and disables the next button', async () => {
    mountDlg([SYS])
    await flushPromises()
    expect(document.body.textContent).toContain('没有其他可用的存储')
    expect(document.querySelector('.set-mig-next')?.hasAttribute('disabled')).toBe(true)
  })

  it('enters the browse step after selecting a partition; root path is derived from the mount point and fetches the directory once', async () => {
    mountDlg()
    await flushPromises()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click()
    await flushPromises()
    expect(folderGetList).toHaveBeenCalledWith('/media/Backup')
    expect(document.body.textContent).toContain('/media/Backup/AppData')
  })

  it('confirmation step shows the target path and the warning that Docker will stop', async () => {
    mountDlg()
    await flushPromises()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click()
    await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click()
    await flushPromises()
    // The brief's original text has a half-width comma+exclamation mark as a typo; the source
    // Vue2 zh_CN.json:605 uses full-width "，" -- Chinese copy must match Vue2 exactly
    // (including punctuation, see CLAUDE.md/memory newui-zh-copy-source-of-truth),
    // here changed back to full-width after character-by-character verification against
    // settingsMigNoteDocker in zh_cn.sp9.ts.
    expect(document.body.textContent).toContain('在此过程中，Docker 将暂时停止。')
  })

  it('polls every 200ms after migration starts, and enters the done step when status is done', async () => {
    vi.useFakeTimers()
    migrateAppPath.mockResolvedValue({ job_id: 'job-1' })
    getMigrateStatus
      .mockResolvedValueOnce({ id: 'job-1', type: 'app_data', status: 'running', phase: 'copying', stopping_apps: 0, progress: 42, processed_size: 10, total_size: 100 })
      .mockResolvedValue({ id: 'job-1', type: 'app_data', status: 'done', phase: 'starting_services', stopping_apps: 0, progress: 100, processed_size: 100, total_size: 100, new_path: '/DATA/AppData' })
    mountDlg()
    await flushPromises()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click()
    await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click()
    await flushPromises()
    await (document.querySelector('.set-mig-start') as HTMLElement).click()
    await flushPromises()
    expect(migrateAppPath).toHaveBeenCalledWith('app_data', '/media/Backup')
    vi.advanceTimersByTime(200); await flushPromises()
    expect(document.body.textContent).toContain('42')
    vi.advanceTimersByTime(200); await flushPromises()
    // Same as above: the brief's original text "迁移完成!" has a half-width exclamation mark
    // typo; the source zh_CN.json:608 uses full-width "！".
    expect(document.body.textContent).toContain('迁移完成！')
    vi.useRealTimers()
  })

  it('shows no close button during migration (to prevent the user from closing the window midway)', async () => {
    vi.useFakeTimers()
    migrateAppPath.mockResolvedValue({ job_id: 'job-1' })
    getMigrateStatus.mockResolvedValue({ id: 'job-1', type: 'app_data', status: 'running', phase: 'copying', stopping_apps: 0, progress: 5, processed_size: 1, total_size: 100 })
    mountDlg()
    await flushPromises()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-start') as HTMLElement).click(); await flushPromises()
    vi.advanceTimersByTime(200); await flushPromises()
    // Review Important #1: the header X button and the footer "Close" primary button used to
    // share .set-mig-close; after splitting them into .set-mig-x (header) and .set-mig-close
    // (footer), this explicitly checks both spots instead of relying on a shared class name
    // to "incidentally" cover both locations.
    expect(document.querySelector('.set-mig-x')).toBeNull()
    expect(document.querySelector('.set-mig-close')).toBeNull()
    vi.useRealTimers()
  })

  it('enters the error step on status=error and shows the raw backend error plus an auto-cleanup note', async () => {
    vi.useFakeTimers()
    migrateAppPath.mockResolvedValue({ job_id: 'job-1' })
    getMigrateStatus.mockResolvedValue({ id: 'job-1', type: 'app_data', status: 'error', phase: 'copying', stopping_apps: 0, progress: 0, processed_size: 0, total_size: 0, error: 'insufficient space on target /media/Backup' })
    mountDlg()
    await flushPromises()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-start') as HTMLElement).click(); await flushPromises()
    vi.advanceTimersByTime(200); await flushPromises()
    expect(document.body.textContent).toContain('insufficient space on target /media/Backup')
    expect(document.body.textContent).toContain('已自动清理')
    vi.useRealTimers()
  })

  // Review Important #2: in Vue2, both the done and error branches of pollStatus $emit('finish', job),
  // but here previously only the done branch emitted -- add a test to pin down that the error
  // branch must also emit; the parent component relies on it to refetch the path once.
  it('also emits the finish event on status=error (1:1 with Vue2 -- after a failure the anchor may already be half-changed)', async () => {
    vi.useFakeTimers()
    migrateAppPath.mockResolvedValue({ job_id: 'job-1' })
    getMigrateStatus.mockResolvedValue({ id: 'job-1', type: 'app_data', status: 'error', phase: 'copying', stopping_apps: 0, progress: 0, processed_size: 0, total_size: 0, error: 'rollback rename failed' })
    const w = mountDlg()
    await flushPromises()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-start') as HTMLElement).click(); await flushPromises()
    vi.advanceTimersByTime(200); await flushPromises()
    expect(w.emitted('finish')).toBeTruthy()
    expect(w.emitted('finish')?.length).toBe(1)
    vi.useRealTimers()
  })

  it('stops the timer and reports an error after 5 consecutive polling failures (port discipline: Vue2 only calls console.error and polls forever)', async () => {
    vi.useFakeTimers()
    migrateAppPath.mockResolvedValue({ job_id: 'job-1' })
    getMigrateStatus.mockRejectedValue(Object.assign(new Error('job not found'), { code: 4000 }))
    mountDlg()
    await flushPromises()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-start') as HTMLElement).click(); await flushPromises()
    for (let i = 0; i < 6; i++) { vi.advanceTimersByTime(200); await flushPromises() }
    expect(document.body.textContent).toContain('job not found')
    const calls = getMigrateStatus.mock.calls.length
    vi.advanceTimersByTime(2000); await flushPromises()
    expect(getMigrateStatus.mock.calls.length).toBe(calls)   // timer already stopped
    vi.useRealTimers()
  })

  it('goes straight to the error step when the migration-start request itself fails', async () => {
    migrateAppPath.mockRejectedValue(new Error('boom'))
    mountDlg()
    await flushPromises()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-start') as HTMLElement).click(); await flushPromises()
    expect(document.body.textContent).toContain('boom')
  })

  it('stops the timer on unmount, leaving no timer behind', async () => {
    vi.useFakeTimers()
    migrateAppPath.mockResolvedValue({ job_id: 'job-1' })
    getMigrateStatus.mockResolvedValue({ id: 'job-1', type: 'app_data', status: 'running', phase: 'copying', stopping_apps: 0, progress: 5, processed_size: 1, total_size: 100 })
    const w = mountDlg()
    await flushPromises()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-start') as HTMLElement).click(); await flushPromises()
    vi.advanceTimersByTime(200); await flushPromises()
    const calls = getMigrateStatus.mock.calls.length
    w.unmount()
    vi.advanceTimersByTime(2000); await flushPromises()
    expect(getMigrateStatus.mock.calls.length).toBe(calls)
    vi.useRealTimers()
  })

  // -- Stale guard (constraint #5): switching directories quickly in the browse step, a late-
  // arriving result from a previous folder.getList call must not overwrite the latest one.
  // Real-world path: root -> click into subfolder A (request pending) -> click the breadcrumb
  // back to root midway (new request settles first) -> A's request finally arrives late, and
  // the list must still be root's, not overwritten by A's late result.
  it('⚠️ stale guard: when switching directories quickly in the browse step, a late-arriving directory listing must not clobber a newer one', async () => {
    type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void }
    function deferred<T>(): Deferred<T> {
      let resolve!: (v: T) => void
      const promise = new Promise<T>((res) => { resolve = res })
      return { promise, resolve }
    }
    const rootListing = { content: [{ name: 'A', path: '/media/Backup/A', is_dir: true, is_symlink: false } as FolderEntry] }
    const staleAListing = { content: [{ name: 'StaleOnly', path: '/media/Backup/A/StaleOnly', is_dir: true, is_symlink: false } as FolderEntry] }
    const freshRootListing = { content: [{ name: 'FreshRoot', path: '/media/Backup/FreshRoot', is_dir: true, is_symlink: false } as FolderEntry] }

    const pendingA = deferred<typeof staleAListing>()
    let call = 0
    folderGetList.mockImplementation(() => {
      call++
      if (call === 1) return Promise.resolve(rootListing)       // enter the browse step: list root
      if (call === 2) return pendingA.promise                    // click into A: pending
      if (call === 3) return Promise.resolve(freshRootListing)   // click back to root midway: settles immediately
      return Promise.resolve({ content: [] })
    })

    mountDlg()
    await flushPromises()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click()
    await flushPromises()
    expect(document.body.textContent).toContain('A') // root list has arrived

    // Click into A (call 2, pending, list goes empty -- the loading state replaces the original list)
    await (document.querySelector('.set-mig-folder') as HTMLElement).click()
    await flushPromises()
    expect(folderGetList).toHaveBeenCalledTimes(2)

    // Before A settles, click the breadcrumb back to root (call 3, settles immediately)
    const rootCrumb = document.querySelectorAll('.set-mig-crumb')[0] as HTMLElement
    await rootCrumb.click()
    await flushPromises()
    expect(folderGetList).toHaveBeenCalledTimes(3)
    expect(document.body.textContent).toContain('FreshRoot')
    expect(document.body.textContent).not.toContain('StaleOnly')

    // A's request finally arrives late now -- it must not clobber FreshRoot
    pendingA.resolve(staleAListing)
    await flushPromises()
    expect(document.body.textContent).toContain('FreshRoot')
    expect(document.body.textContent).not.toContain('StaleOnly')
  })

  // -- Review Important #2: create/rename/delete are the three write paths called out by
  // the ⛔ destructive-action note at the top of this task, and previously had zero tests --
  // the mocks were declared but never asserted on, purely decorative. Added here, with at
  // least a success + failure case for each, and a dedicated pin that isProtectedFolder is
  // actually wired into the context menu's disabled state.
  describe('create folder', () => {
    it('success: submits the assembled full path (trims whitespace + strips slashes) -> closes the input and relists the directory after success', async () => {
      folderCreate.mockResolvedValue(undefined)
      mountDlg()
      await flushPromises()
      await enterBrowse()
      const listCallsBefore = folderGetList.mock.calls.length

      await (document.querySelector('.set-mig-newfolder-btn') as HTMLElement).click()
      await flushPromises()
      const input = document.querySelector('.set-mig-newfolder-row input') as HTMLInputElement
      expect(input).not.toBeNull()
      input.value = '  My/Folder  ' // the name mixes in a '/' to strip and leading/trailing whitespace
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await flushPromises()

      // browsePath is '/media/Backup' (EXT's mount point, i.e. browseRoot); the assembled result must use the trimmed + stripped name
      expect(folderCreate).toHaveBeenCalledWith('/media/Backup/MyFolder')
      expect(folderGetList.mock.calls.length).toBe(listCallsBefore + 1) // relisted the directory once after success
      expect(document.querySelector('.set-mig-newfolder-row')).toBeNull() // inline input closed
      expect(document.querySelector('.set-danger')).toBeNull()
    })

    it('failure: dialog-inline .set-danger shows the backend message (not a toast), input stays open', async () => {
      folderCreate.mockRejectedValue(new Error('permission denied'))
      mountDlg()
      await flushPromises()
      await enterBrowse()

      await (document.querySelector('.set-mig-newfolder-btn') as HTMLElement).click()
      await flushPromises()
      const input = document.querySelector('.set-mig-newfolder-row input') as HTMLInputElement
      input.value = 'X'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await flushPromises()

      expect(document.querySelector('.set-danger')?.textContent).toBe('permission denied')
      expect(document.querySelector('.set-mig-newfolder-row')).not.toBeNull() // still in editing state, not closed
    })
  })

  describe('rename / delete (context menu, ContextMenu + ContextMenuItem are stubbed, see the comment above mountDlg)', () => {
    it('rename success: folder.rename receives (old path, new path under the same parent directory), relists the directory after success', async () => {
      folderRename.mockResolvedValue(undefined)
      mountDlg([SYS, EXT], { withCtxStubs: true })
      await flushPromises()
      await enterBrowse() // default folderGetList mock: one folder 'Backup' @ /media/Backup/Backup
      const listCallsBefore = folderGetList.mock.calls.length

      const renameItem = document.querySelector('.ui-ctx-item:not(.danger)') as HTMLElement
      expect(renameItem).not.toBeNull()
      await renameItem.click()
      await flushPromises()

      const input = document.querySelector('.set-mig-folder .set-mig-input') as HTMLInputElement
      expect(input).not.toBeNull()
      // #7: startRename's nextTick(() => renameInputEl.value?.focus()) must actually focus
      // this input -- verified this cycle that a string ref inside v-for gets collected by
      // Vue into an array, so .value becomes [el] instead of el itself, causing .focus() to
      // be swallowed silently because the method doesn't exist on an array (an unhandled
      // rejection, not an assertion failure -- easy to miss if you only look at "N passed").
      // Fixed by switching to a functional ref (setRenameInputEl); this adds an assertion to
      // pin it down.
      expect(document.activeElement).toBe(input)
      input.value = 'Renamed'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await flushPromises()

      expect(folderRename).toHaveBeenCalledWith('/media/Backup/Backup', '/media/Backup/Renamed')
      expect(folderGetList.mock.calls.length).toBe(listCallsBefore + 1)
      expect(document.querySelector('.set-mig-folder .set-mig-input')).toBeNull() // editing state closed
    })

    it('rename failure: dialog-inline .set-danger shows the backend message, exits editing state', async () => {
      folderRename.mockRejectedValue(new Error('name already exists'))
      mountDlg([SYS, EXT], { withCtxStubs: true })
      await flushPromises()
      await enterBrowse()

      const renameItem = document.querySelector('.ui-ctx-item:not(.danger)') as HTMLElement
      await renameItem.click()
      await flushPromises()
      const input = document.querySelector('.set-mig-folder .set-mig-input') as HTMLInputElement
      input.value = 'Renamed'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await flushPromises()

      expect(document.querySelector('.set-danger')?.textContent).toBe('name already exists')
      expect(document.querySelector('.set-mig-folder .set-mig-input')).toBeNull()
    })

    it('protected folder (e.g. AppData): both rename/delete context menu items are disabled (pins that isProtectedFolder is wired in)', async () => {
      // AppData is in PROTECTED_FOLDER_NAMES, but when type='app_data', filterBrowseFolders
      // does not filter out 'AppData' (that exclusion list is for other migration types) --
      // so it appears normally in the list, but both menu items must be disabled. Deliberately
      // use a path that doesn't conflict with the currentPath prefix, to guarantee it renders.
      folderGetList.mockResolvedValue({ content: [
        { name: 'AppData', path: '/media/Backup/AppData', is_dir: true, is_symlink: false },
      ] })
      mountDlg([SYS, EXT], { withCtxStubs: true })
      await flushPromises()
      await enterBrowse()

      const items = document.querySelectorAll('.ui-ctx-item')
      expect(items).toHaveLength(2) // rename + delete
      expect(items[0].hasAttribute('disabled')).toBe(true)
      expect(items[1].hasAttribute('disabled')).toBe(true)

      // vue-test-utils won't dispatch events on disabled elements, so assert the disabled attribute itself instead of clicking to verify "nothing happens on click"
    })

    it('delete: shows a confirmation dialog first (delete is not called yet), only calls it with [path] after confirming', async () => {
      batchDelete.mockResolvedValue(undefined)
      mountDlg([SYS, EXT], { withCtxStubs: true })
      await flushPromises()
      await enterBrowse()
      const listCallsBefore = folderGetList.mock.calls.length

      const deleteItem = document.querySelector('.ui-ctx-item.danger') as HTMLElement
      expect(deleteItem).not.toBeNull()
      await deleteItem.click()
      await flushPromises()

      // the confirmation dialog has popped up, but the real delete request hasn't been sent yet
      expect(batchDelete).not.toHaveBeenCalled()
      expect(document.body.textContent).toContain('删除')

      const confirmBtn = document.querySelector('.ui-btn.danger') as HTMLElement
      expect(confirmBtn).not.toBeNull()
      await confirmBtn.click()
      await flushPromises()

      expect(batchDelete).toHaveBeenCalledWith(['/media/Backup/Backup'])
      expect(folderGetList.mock.calls.length).toBe(listCallsBefore + 1) // relisted the directory once after success
    })

    it('delete failure: dialog-inline .set-danger shows the backend message', async () => {
      batchDelete.mockRejectedValue(new Error('directory not empty'))
      mountDlg([SYS, EXT], { withCtxStubs: true })
      await flushPromises()
      await enterBrowse()

      const deleteItem = document.querySelector('.ui-ctx-item.danger') as HTMLElement
      await deleteItem.click()
      await flushPromises()
      const confirmBtn = document.querySelector('.ui-btn.danger') as HTMLElement
      await confirmBtn.click()
      await flushPromises()

      expect(document.querySelector('.set-danger')?.textContent).toBe('directory not empty')
    })
  })
})
