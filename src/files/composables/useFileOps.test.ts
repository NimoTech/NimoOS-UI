import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import { useFileOps } from './useFileOps'
import { useFilesStore } from '../stores/files'
import { useSnapshotBrowseStore } from '../stores/snapshotBrowse'
import { useToast } from '../../stores/toast'
import { useFileConflictsStore } from '../stores/fileConflicts'

const folderCreate = vi.fn().mockResolvedValue(undefined)
const fileCreate = vi.fn().mockResolvedValue(undefined)
const fileRename = vi.fn().mockResolvedValue(undefined)
const batchDelete = vi.fn().mockResolvedValue(undefined)
const batchTask = vi.fn().mockResolvedValue(undefined)
const getList = vi.fn().mockResolvedValue({ content: [] })
const fileUrl = vi.fn((p: string) => `/v3/file?token=TK&path=${encodeURIComponent(p)}`)
const batchUrl = vi.fn((f: string) => `/v1/batch?token=TK&files=${encodeURIComponent(f)}`)
const refreshMock = vi.fn().mockResolvedValue('new-token')

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: { create: (...a: unknown[]) => folderCreate(...a), getList: (...a: unknown[]) => getList(...a) },
    file: { create: (...a: unknown[]) => fileCreate(...a), rename: (...a: unknown[]) => fileRename(...a), fileUrl: (...a: unknown[]) => fileUrl(...(a as [string])) },
    batch: { delete: (...a: unknown[]) => batchDelete(...a), task: (...a: unknown[]) => batchTask(...a), batchUrl: (...a: unknown[]) => batchUrl(...(a as [string])) },
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
  },
  refreshAccessToken: (...a: unknown[]) => refreshMock(...a),
}))

const triggerMock = vi.fn()
vi.mock('../util/iframeDownload', () => ({ triggerIframeDownload: (...a: unknown[]) => triggerMock(...(a as [string])) }))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// 在组件 setup 内实例化 composable,拿到其 API
function makeOps() {
  let api!: ReturnType<typeof useFileOps>
  const Host = defineComponent({ setup() { api = useFileOps(); return () => h('div') } })
  mount(Host, { global: { plugins: [i18n] } })
  return api
}

describe('useFileOps', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  it('createFolder 用当前真实路径拼子路径并 reload', async () => {
    const files = useFilesStore(); files.currentPath = '/DATA/Docs'
    const ops = makeOps()
    await ops.createFolder('New Folder')
    expect(folderCreate).toHaveBeenCalledWith('/DATA/Docs/New Folder')
    expect(getList).toHaveBeenCalledWith('/DATA/Docs') // reload 当前目录
  })

  it('createFile 同理走 file.create', async () => {
    const files = useFilesStore(); files.currentPath = '/DATA'
    const ops = makeOps()
    await ops.createFile('a.txt')
    expect(fileCreate).toHaveBeenCalledWith('/DATA/a.txt')
  })

  it('rename 同名直接返回不请求', async () => {
    useFilesStore().currentPath = '/DATA'
    const ops = makeOps()
    await ops.rename({ name: 'a.txt', path: '/DATA/a.txt', is_dir: false }, 'a.txt')
    expect(fileRename).not.toHaveBeenCalled()
  })

  it('rename 用 file.rename(old,new)', async () => {
    useFilesStore().currentPath = '/DATA'
    const ops = makeOps()
    await ops.rename({ name: 'a.txt', path: '/DATA/a.txt', is_dir: false }, 'b.txt')
    expect(fileRename).toHaveBeenCalledWith('/DATA/a.txt', '/DATA/b.txt')
  })

  it('remove 同步 DELETE /batch 传 JSON 字符串数组', async () => {
    useFilesStore().currentPath = '/DATA'
    const ops = makeOps()
    await ops.remove([{ name: 'a', path: '/DATA/a', is_dir: false }])
    expect(batchDelete).toHaveBeenCalledWith(JSON.stringify(['/DATA/a']))
  })

  it('remove 受保护项被前端挡下,不请求', async () => {
    useFilesStore().currentPath = '/DATA'
    const ops = makeOps()
    await ops.remove([{ name: 'Documents', path: '/DATA/Documents', is_dir: true }])
    expect(batchDelete).not.toHaveBeenCalled()
  })

  // Pending-ledger F10: one protected member used to refuse the whole batch, so
  // selecting everything in /DATA and pressing delete removed nothing at all.
  it('deletes the operable entries and skips the protected ones instead of refusing the batch', async () => {
    useFilesStore().currentPath = '/DATA'
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    const ops = makeOps()
    await ops.remove([
      { name: 'a', path: '/DATA/a', is_dir: false },
      { name: 'Documents', path: '/DATA/Documents', is_dir: true },
      { name: 'b', path: '/DATA/b', is_dir: false },
    ])
    expect(batchDelete).toHaveBeenCalledWith(JSON.stringify(['/DATA/a', '/DATA/b']))
    expect(showSpy).toHaveBeenCalledWith(zh.filesDeleteSkippedProtected.replace('{count}', '1'))
  })

  it('says nothing about skipping when the whole selection is deletable', async () => {
    useFilesStore().currentPath = '/DATA'
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    const ops = makeOps()
    await ops.remove([{ name: 'a', path: '/DATA/a', is_dir: false }])
    expect(showSpy).not.toHaveBeenCalled()
  })

  it('still reports the protected toast when nothing in the selection can be deleted', async () => {
    useFilesStore().currentPath = '/DATA'
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    const ops = makeOps()
    await ops.remove([
      { name: 'Documents', path: '/DATA/Documents', is_dir: true },
      { name: 'Downloads', path: '/DATA/Downloads', is_dir: true },
    ])
    expect(batchDelete).not.toHaveBeenCalled()
    expect(showSpy).toHaveBeenCalledWith(zh.filesProtectedDelete)
  })

  it('rename 受保护项被前端挡下,不请求', async () => {
    useFilesStore().currentPath = '/DATA'
    const ops = makeOps()
    await ops.rename({ name: 'Documents', path: '/DATA/Documents', is_dir: true }, 'Docs')
    expect(fileRename).not.toHaveBeenCalled()
  })

  it('copyPath 写虚拟路径(不含 /DATA)', async () => {
    const files = useFilesStore()
    files.displayNames = { '/DATA': 'NimoOS-HD' }
    const ops = makeOps()
    await ops.copyPath({ name: 'a', path: '/DATA/a', is_dir: false })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/NimoOS-HD/a')
    const arg = (navigator.clipboard.writeText as any).mock.calls[0][0]
    expect(arg).not.toContain('/DATA')
  })

  it('copy 把选中项真实路径写进剪贴板(type:copy)', async () => {
    const { useClipboardStore } = await import('../stores/clipboard')
    const clip = useClipboardStore()
    const ops = makeOps()
    ops.copy([{ name: 'a', path: '/DATA/a', is_dir: false } as never])
    expect(clip.operateObject).toEqual({ type: 'copy', item: [{ from: '/DATA/a', is_dir: false }] })
  })

  it('cut 写 type:move;受保护项被挡(不写剪贴板)', async () => {
    const { useClipboardStore } = await import('../stores/clipboard')
    const clip = useClipboardStore()
    const ops = makeOps()
    ops.cut([{ name: 'AppData', path: '/DATA/AppData', is_dir: true } as never])
    expect(clip.operateObject).toBeNull() // 受保护 → 挡下
    ops.cut([{ name: 'a', path: '/DATA/a', is_dir: false } as never])
    expect(clip.operateObject?.type).toBe('move')
  })

  // Pending-ledger F10: cut had the same all-or-nothing bug delete used to
  // have -- one protected member emptied the clipboard for the whole batch.
  it('cut copies the operable subset to the clipboard instead of refusing the batch', async () => {
    const { useClipboardStore } = await import('../stores/clipboard')
    const clipboard = useClipboardStore()
    const ops = makeOps()
    const entries = [
      { name: 'a.txt', path: '/DATA/a.txt', is_dir: false },
      { name: 'Downloads', path: '/DATA/Downloads', is_dir: true },
    ]
    ops.cut(entries as never)
    expect(clipboard.operateObject?.item.map((i: { from: string }) => i.from)).toEqual(['/DATA/a.txt'])
  })

  it('cut reports how many protected items it skipped', async () => {
    const toast = useToast()
    const toastSpy = vi.spyOn(toast, 'show')
    const ops = makeOps()
    const entries = [
      { name: 'a.txt', path: '/DATA/a.txt', is_dir: false },
      { name: 'Downloads', path: '/DATA/Downloads', is_dir: true },
    ]
    ops.cut(entries as never)
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('1'))
  })

  it('cut still refuses outright when nothing in the selection can be moved', async () => {
    const { useClipboardStore } = await import('../stores/clipboard')
    const clipboard = useClipboardStore()
    const ops = makeOps()
    const entries = [{ name: 'Downloads', path: '/DATA/Downloads', is_dir: true }]
    ops.cut(entries as never)
    expect(clipboard.operateObject).toBeNull()
  })

  it('paste submits one overwrite task and one keep-both task', async () => {
    const { useClipboardStore } = await import('../stores/clipboard')
    const clip = useClipboardStore()
    clip.operate('copy', [
      { path: '/DATA/a', is_dir: false },
      { path: '/DATA/b', is_dir: false },
    ])
    const files = useFilesStore(); files.currentPath = '/DATA/dst'
    const conflicts = useFileConflictsStore()
    vi.spyOn(conflicts, 'resolvePaste').mockResolvedValue({
      overwriteItems: [{ from: '/DATA/a', is_dir: false }],
      renameItems: [{ from: '/DATA/b', is_dir: false }],
      skippedCount: 0,
      cancelledCount: 0,
    })
    const ops = makeOps()
    await ops.paste()
    expect(batchTask).toHaveBeenCalledTimes(2)
    expect(batchTask.mock.calls.map((c) => (c[0] as { style: string }).style).sort())
      .toEqual(['overwrite', 'rename'])
    // B6: is_dir is local-only bookkeeping for the conflict dialog and must not
    // reach the backend -- buildPastePayload strips it before submitting.
    expect(batchTask).toHaveBeenCalledWith({ type: 'copy', item: [{ from: '/DATA/a' }], to: '/DATA/dst', style: 'overwrite' })
    expect(batchTask).toHaveBeenCalledWith({ type: 'copy', item: [{ from: '/DATA/b' }], to: '/DATA/dst', style: 'rename' })
    expect(clip.operateObject).toBeNull()
  })

  it('paste submits a single task when nothing was overwritten', async () => {
    const { useClipboardStore } = await import('../stores/clipboard')
    const clip = useClipboardStore()
    clip.operate('copy', [{ path: '/DATA/a', is_dir: false }])
    const files = useFilesStore(); files.currentPath = '/DATA/dst'
    const conflicts = useFileConflictsStore()
    vi.spyOn(conflicts, 'resolvePaste').mockResolvedValue({
      overwriteItems: [],
      renameItems: [{ from: '/DATA/a', is_dir: false }],
      skippedCount: 0,
      cancelledCount: 0,
    })
    const ops = makeOps()
    await ops.paste()
    expect(batchTask).toHaveBeenCalledTimes(1)
    expect(batchTask.mock.calls[0][0]).toMatchObject({ style: 'rename' })
  })

  it('paste tells the user how many items it skipped', async () => {
    const { useClipboardStore } = await import('../stores/clipboard')
    const clip = useClipboardStore()
    clip.operate('copy', [{ path: '/DATA/a', is_dir: false }, { path: '/DATA/b', is_dir: false }])
    const files = useFilesStore(); files.currentPath = '/DATA/dst'
    const conflicts = useFileConflictsStore()
    vi.spyOn(conflicts, 'resolvePaste').mockResolvedValue({
      overwriteItems: [],
      renameItems: [],
      skippedCount: 2,
      cancelledCount: 0,
    })
    const toast = useToast()
    const toastSpy = vi.spyOn(toast, 'show')
    const ops = makeOps()
    await ops.paste()
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('2'))
  })

  it('paste clears the clipboard and submits nothing when every item was explicitly skipped', async () => {
    const { useClipboardStore } = await import('../stores/clipboard')
    const clip = useClipboardStore()
    clip.operate('copy', [{ path: '/DATA/a', is_dir: false }])
    const files = useFilesStore(); files.currentPath = '/DATA/dst'
    const conflicts = useFileConflictsStore()
    vi.spyOn(conflicts, 'resolvePaste').mockResolvedValue({
      overwriteItems: [],
      renameItems: [],
      skippedCount: 1,
      cancelledCount: 0,
    })
    const ops = makeOps()
    await ops.paste()
    expect(batchTask).not.toHaveBeenCalled()
    expect(clip.operateObject).toBeNull()
  })

  // fix-round-1 F3: hitting Esc mid-dialog means "not now", not "throw away what
  // I copied". resolveConflictQueue marks the cancelled item's conflict as
  // 'cancelled', which splitPasteItems folds into skippedCount same as an
  // explicit skip -- but it also surfaces separately as cancelledCount, and only
  // that should gate clearing the clipboard.
  it('paste does not clear the clipboard when the user cancels the conflict dialog', async () => {
    const { useClipboardStore } = await import('../stores/clipboard')
    const clip = useClipboardStore()
    clip.operate('copy', [{ path: '/DATA/a', is_dir: false }])
    const files = useFilesStore(); files.currentPath = '/DATA/dst'
    const conflicts = useFileConflictsStore()
    vi.spyOn(conflicts, 'resolvePaste').mockResolvedValue({
      overwriteItems: [],
      renameItems: [],
      skippedCount: 1,
      cancelledCount: 1,
    })
    const ops = makeOps()
    await ops.paste()
    expect(batchTask).not.toHaveBeenCalled()
    expect(clip.operateObject).not.toBeNull()
  })

  // fix-round-1 F1: `resolvePaste` awaits a directory listing (and possibly a
  // queued upload-conflict chain) before resolving. During that window the UI
  // is fully interactive, so the user can navigate to a different directory
  // before the paste actually submits. The destination used for the actual
  // submission must be the one paste started in, not wherever the user ends
  // up while it was thinking.
  it('paste submits to the directory it started in, even if the user navigates away before the conflict check resolves', async () => {
    const { useClipboardStore } = await import('../stores/clipboard')
    const clip = useClipboardStore()
    clip.operate('copy', [{ path: '/DATA/a', is_dir: false }])
    const files = useFilesStore(); files.currentPath = '/DATA/dirA'
    const conflicts = useFileConflictsStore()
    vi.spyOn(conflicts, 'resolvePaste').mockImplementation(async () => {
      // Simulate the user clicking into a different folder while the
      // directory listing for dirA is still in flight.
      files.currentPath = '/DATA/dirB'
      return { overwriteItems: [], renameItems: [{ from: '/DATA/a', is_dir: false }], skippedCount: 0, cancelledCount: 0 }
    })
    const ops = makeOps()
    await ops.paste()
    expect(batchTask).toHaveBeenCalledWith(expect.objectContaining({ to: '/DATA/dirA' }))
  })

  // fix-round-1 F2: when one batch's submission has already been accepted by
  // the backend and the other one fails, the failure toast must say so instead
  // of "operation failed" -- which would tell the user nothing landed when
  // half of it actually did. The clipboard also must not be cleared, since
  // that would discard the batch that never got submitted.
  //
  // fix-round-2 N2: the first draft of this fix caught the failed submission's
  // error and threw it away, always showing the generic fallback text even
  // when the backend explained itself (e.g. "read-only filesystem" for a
  // paste into a read-only mount). The pre-F2 code (one try/catch around both
  // sequential awaits) DID surface that message via errMsg(e, ...).
  //
  // fix-round-3 M2: the round-2 fix over-corrected by REPLACING the whole
  // toast with errMsg's result. Since errMsg picks the backend's message over
  // the fallback whenever one exists -- the common case -- a partial failure
  // with a real backend reason ended up showing ONLY that reason, with no
  // indication that half the paste had already landed. That made it
  // byte-for-byte identical to the total-failure toast, defeating the whole
  // point of F2 (telling the two apart). These tests now pin the corrected
  // behavior: the reason is INTERPOLATED into the "part landed" template, not
  // swapped in for it.
  it('paste keeps the "part landed" framing while including the backend\'s own reason', async () => {
    const { useClipboardStore } = await import('../stores/clipboard')
    const clip = useClipboardStore()
    clip.operate('copy', [{ path: '/DATA/a', is_dir: false }, { path: '/DATA/b', is_dir: false }])
    const files = useFilesStore(); files.currentPath = '/DATA/dst'
    const conflicts = useFileConflictsStore()
    vi.spyOn(conflicts, 'resolvePaste').mockResolvedValue({
      overwriteItems: [{ from: '/DATA/a', is_dir: false }],
      renameItems: [{ from: '/DATA/b', is_dir: false }],
      skippedCount: 0,
      cancelledCount: 0,
    })
    batchTask.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('read-only filesystem'))
    const toast = useToast()
    const toastSpy = vi.spyOn(toast, 'show')
    const ops = makeOps()
    await ops.paste()
    expect(batchTask).toHaveBeenCalledTimes(2) // the failing call was still attempted, not skipped
    expect(toastSpy).toHaveBeenCalledWith(zh.filesPastePartialFailure.replace('{reason}', 'read-only filesystem'))
    // Must stay distinguishable from the total-failure toast, which is the
    // bare reason with no "part landed" framing at all.
    expect(toastSpy).not.toHaveBeenCalledWith('read-only filesystem')
    expect(clip.operateObject).not.toBeNull()
  })

  it('paste falls back to the generic reason inside the partial-failure template when the backend gives no reason', async () => {
    const { useClipboardStore } = await import('../stores/clipboard')
    const clip = useClipboardStore()
    clip.operate('copy', [{ path: '/DATA/a', is_dir: false }, { path: '/DATA/b', is_dir: false }])
    const files = useFilesStore(); files.currentPath = '/DATA/dst'
    const conflicts = useFileConflictsStore()
    vi.spyOn(conflicts, 'resolvePaste').mockResolvedValue({
      overwriteItems: [{ from: '/DATA/a', is_dir: false }],
      renameItems: [{ from: '/DATA/b', is_dir: false }],
      skippedCount: 0,
      cancelledCount: 0,
    })
    batchTask.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error()) // no message
    const toast = useToast()
    const toastSpy = vi.spyOn(toast, 'show')
    const ops = makeOps()
    await ops.paste()
    expect(toastSpy).toHaveBeenCalledWith(zh.filesPastePartialFailure.replace('{reason}', zh.filesOpFailed))
    expect(clip.operateObject).not.toBeNull()
  })

  it('paste shows the backend\'s own reason when the only batch it needed to submit fails', async () => {
    // Only one style is actually needed (nothing conflicted, so everything
    // lands in renameItems) and that lone submission fails. This must read as
    // a total failure, not a "partial" one -- there was never a second batch
    // to have partially succeeded. This is the exact "paste into a read-only
    // mount" scenario the reviewer named: the old single try/catch told the
    // user why; this pins that the rewritten independent-submission version
    // still does.
    const { useClipboardStore } = await import('../stores/clipboard')
    const clip = useClipboardStore()
    clip.operate('copy', [{ path: '/DATA/a', is_dir: false }])
    const files = useFilesStore(); files.currentPath = '/DATA/dst'
    const conflicts = useFileConflictsStore()
    vi.spyOn(conflicts, 'resolvePaste').mockResolvedValue({
      overwriteItems: [],
      renameItems: [{ from: '/DATA/a', is_dir: false }],
      skippedCount: 0,
      cancelledCount: 0,
    })
    batchTask.mockRejectedValueOnce(new Error('read-only filesystem'))
    const toast = useToast()
    const toastSpy = vi.spyOn(toast, 'show')
    const ops = makeOps()
    await ops.paste()
    expect(toastSpy).toHaveBeenCalledWith('read-only filesystem')
    expect(toastSpy).not.toHaveBeenCalledWith(zh.filesOpFailed)
    // B1: `zh.filesPastePartialFailure` is the un-interpolated template
    // ('部分文件已粘贴,另一部分失败({reason}),请检查目标目录') -- toast.show is
    // never called with that raw string, so asserting not-called-with it is
    // vacuously true regardless of what actually happened. Match on the
    // template's own text instead so this still catches a regression that
    // shows the "part landed" framing for what is really a total failure.
    expect(toastSpy).not.toHaveBeenCalledWith(expect.stringContaining('部分文件已粘贴'))
    expect(clip.operateObject).not.toBeNull()
  })

  it('paste falls back to the generic failure message when both batches fail without a specific reason', async () => {
    const { useClipboardStore } = await import('../stores/clipboard')
    const clip = useClipboardStore()
    clip.operate('copy', [{ path: '/DATA/a', is_dir: false }, { path: '/DATA/b', is_dir: false }])
    const files = useFilesStore(); files.currentPath = '/DATA/dst'
    const conflicts = useFileConflictsStore()
    vi.spyOn(conflicts, 'resolvePaste').mockResolvedValue({
      overwriteItems: [{ from: '/DATA/a', is_dir: false }],
      renameItems: [{ from: '/DATA/b', is_dir: false }],
      skippedCount: 0,
      cancelledCount: 0,
    })
    batchTask.mockRejectedValueOnce(new Error()).mockRejectedValueOnce(new Error())
    const toast = useToast()
    const toastSpy = vi.spyOn(toast, 'show')
    const ops = makeOps()
    await ops.paste()
    expect(batchTask).toHaveBeenCalledTimes(2)
    expect(toastSpy).toHaveBeenCalledWith(zh.filesOpFailed)
    expect(clip.operateObject).not.toBeNull()
  })

  it('paste shows the backend\'s own reason when both batches fail for the same reason', async () => {
    const { useClipboardStore } = await import('../stores/clipboard')
    const clip = useClipboardStore()
    clip.operate('copy', [{ path: '/DATA/a', is_dir: false }, { path: '/DATA/b', is_dir: false }])
    const files = useFilesStore(); files.currentPath = '/DATA/dst'
    const conflicts = useFileConflictsStore()
    vi.spyOn(conflicts, 'resolvePaste').mockResolvedValue({
      overwriteItems: [{ from: '/DATA/a', is_dir: false }],
      renameItems: [{ from: '/DATA/b', is_dir: false }],
      skippedCount: 0,
      cancelledCount: 0,
    })
    batchTask.mockRejectedValueOnce(new Error('disk full')).mockRejectedValueOnce(new Error('disk full'))
    const toast = useToast()
    const toastSpy = vi.spyOn(toast, 'show')
    const ops = makeOps()
    await ops.paste()
    expect(toastSpy).toHaveBeenCalledWith('disk full')
    expect(clip.operateObject).not.toBeNull()
  })

  // fix-round-3 M3: when both batches fail for genuinely DIFFERENT reasons
  // (e.g. the overwrite batch is rejected for a permissions reason while the
  // rename batch fails for something else entirely), showing only the first
  // failure's message would silently drop the second one.
  it('paste shows both reasons when the two batches fail differently', async () => {
    const { useClipboardStore } = await import('../stores/clipboard')
    const clip = useClipboardStore()
    clip.operate('copy', [{ path: '/DATA/a', is_dir: false }, { path: '/DATA/b', is_dir: false }])
    const files = useFilesStore(); files.currentPath = '/DATA/dst'
    const conflicts = useFileConflictsStore()
    vi.spyOn(conflicts, 'resolvePaste').mockResolvedValue({
      overwriteItems: [{ from: '/DATA/a', is_dir: false }],
      renameItems: [{ from: '/DATA/b', is_dir: false }],
      skippedCount: 0,
      cancelledCount: 0,
    })
    batchTask.mockRejectedValueOnce(new Error('permission denied')).mockRejectedValueOnce(new Error('disk full'))
    const toast = useToast()
    const toastSpy = vi.spyOn(toast, 'show')
    const ops = makeOps()
    await ops.paste()
    const shown = toastSpy.mock.calls[0]?.[0] as string
    expect(shown).toContain('permission denied')
    expect(shown).toContain('disk full')
  })

  it('paste does nothing when the clipboard is empty', async () => {
    const ops = makeOps()
    await ops.paste()
    expect(batchTask).not.toHaveBeenCalled()
  })

  it('download 单文件 → service.file.fileUrl(真实路径) 并触发 iframe', async () => {
    localStorage.setItem('expires_at', String(Math.floor(Date.now() / 1000) + 3600)) // 充裕,不刷新
    const ops = makeOps()
    await ops.download([{ name: 'a.txt', path: '/DATA/a.txt', is_dir: false }])
    expect(fileUrl).toHaveBeenCalledWith('/DATA/a.txt')
    expect(batchUrl).not.toHaveBeenCalled()
    expect(triggerMock).toHaveBeenCalledWith('/v3/file?token=TK&path=%2FDATA%2Fa.txt')
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('download 单目录/多选 → service.batch.batchUrl(逗号连接真实路径)', async () => {
    localStorage.setItem('expires_at', String(Math.floor(Date.now() / 1000) + 3600))
    const ops = makeOps()
    await ops.download([
      { name: 'a.txt', path: '/DATA/a.txt', is_dir: false },
      { name: 'Docs', path: '/DATA/Docs', is_dir: true },
    ])
    expect(batchUrl).toHaveBeenCalledWith('/DATA/a.txt,/DATA/Docs')
    expect(fileUrl).not.toHaveBeenCalled()
    expect(triggerMock).toHaveBeenCalledTimes(1)
  })

  it('download token 快过期 → 先 refreshAccessToken 再构 URL', async () => {
    localStorage.setItem('expires_at', String(Math.floor(Date.now() / 1000) + 10)) // 10s 后过期,进缓冲
    const ops = makeOps()
    await ops.download([{ name: 'a.txt', path: '/DATA/a.txt', is_dir: false }])
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(triggerMock).toHaveBeenCalledTimes(1)
  })

  it('download expires_at 缺失 → 保守刷新', async () => {
    localStorage.removeItem('expires_at')
    const ops = makeOps()
    await ops.download([{ name: 'a.txt', path: '/DATA/a.txt', is_dir: false }])
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it('download 刷新失败 → 不触发下载', async () => {
    localStorage.removeItem('expires_at') // 触发刷新
    refreshMock.mockRejectedValueOnce(new Error('auth fail'))
    const ops = makeOps()
    await ops.download([{ name: 'a.txt', path: '/DATA/a.txt', is_dir: false }])
    expect(triggerMock).not.toHaveBeenCalled()
  })

  it('download 空选区 → 无操作', async () => {
    const ops = makeOps()
    await ops.download([])
    expect(fileUrl).not.toHaveBeenCalled()
    expect(batchUrl).not.toHaveBeenCalled()
    expect(triggerMock).not.toHaveBeenCalled()
  })

  describe('快照只读态拦截写操作', () => {
    const enterSnapshot = () => {
      const browse = useSnapshotBrowseStore()
      browse.status = 'ready'
      browse.volumes = [{ volume_uuid: 'u-data', mount: '/DATA', supported: true }]
      useFilesStore().currentPath = '/DATA/.snapshots/snap1/Photos'
      return browse
    }

    it('新建文件夹被拦,不发请求', async () => {
      enterSnapshot()
      const ops = makeOps()
      await ops.createFolder('新建文件夹')
      expect(folderCreate).not.toHaveBeenCalled()
      expect(useToast().msg).toContain('只读')
    })
    it('新建文件被拦', async () => {
      enterSnapshot()
      const ops = makeOps()
      await ops.createFile('a.txt')
      expect(fileCreate).not.toHaveBeenCalled()
    })
    it('重命名被拦', async () => {
      enterSnapshot()
      const ops = makeOps()
      await ops.rename({ name: 'a', path: '/DATA/.snapshots/snap1/a', is_dir: false }, 'b')
      expect(fileRename).not.toHaveBeenCalled()
    })
    it('删除被拦', async () => {
      enterSnapshot()
      const ops = makeOps()
      await ops.remove([{ name: 'a', path: '/DATA/.snapshots/snap1/a', is_dir: false }])
      expect(batchDelete).not.toHaveBeenCalled()
    })
    it('粘贴被拦', async () => {
      enterSnapshot()
      const { useClipboardStore } = await import('../stores/clipboard')
      useClipboardStore().operate('copy', [{ path: '/DATA/a', is_dir: false }])
      const ops = makeOps()
      await ops.paste()
      expect(batchTask).not.toHaveBeenCalled()
    })
    it('不在快照里时这些操作照常放行', async () => {
      useFilesStore().currentPath = '/DATA/Photos'
      const ops = makeOps()
      await ops.createFolder('新建文件夹')
      expect(folderCreate).toHaveBeenCalled()
    })
  })
})
