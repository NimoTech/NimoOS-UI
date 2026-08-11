// Task 9 (SP7-P3): PhotosTrash.vue —— 挂 Pinia + i18n + router stub,mock 共享包
// trash 方法(参照 trash.test.ts 的 mock 形状)+ thumbnailUrl。覆盖 brief 的 7 条测试要点:
// 空态门控+hero 按钮 disabled、分桶渲染+缩略图走生成器+倒计时角标、勾选圈选择+bulk bar 出现、
// 恢复选中不走确认直接执行+成功 toast 带 Undo、点 Undo 调 undoRestore、清空最近删除走二次确认、
// ESC 关确认模态。
//
// Undo 用真实 AppToast.vue 同挂载(而非仅 spy 回调)——两者共享同一个 Pinia toast store 实例,
// 这样「点 Undo」测的是端到端接线(PhotosTrash 传给 toast.show 的 action 真的被 AppToast 渲染
// 成按钮、点击后真的调用),不是纯粹的白盒断言。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    listTrash: vi.fn().mockResolvedValue([]),
    restoreTrashBatch: vi.fn().mockResolvedValue(undefined),
    restoreAllTrash: vi.fn().mockResolvedValue(undefined),
    purgeTrash: vi.fn().mockResolvedValue(undefined),
    emptyTrash: vi.fn().mockResolvedValue(undefined),
    deleteAsset: vi.fn().mockResolvedValue(undefined),
    getConfig: vi.fn().mockResolvedValue({ watchDirs: ['/DATA/Gallery'], retentionDays: 30 }),
    updateConfig: vi.fn().mockResolvedValue(undefined),
    getTimeline: vi.fn().mockResolvedValue([]),
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosTrash from '../PhotosTrash.vue'
import AppToast from '../../components/AppToast.vue'
import { usePhotosTrash } from '../../photos/stores/trash'
import { useToast } from '../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [{ path: '/photos/trash', name: 'photos-trash', component: PhotosTrash }],
  })
}

// 挂 PhotosTrash + AppToast 于同一棵树,共享同一个 Pinia toast store 实例——见文件头注释。
async function mountView() {
  const router = makeRouter()
  router.push('/photos/trash')
  await router.isReady()
  const w = mount(
    { components: { PhotosTrash, AppToast }, template: '<div><PhotosTrash /><AppToast /></div>' },
    { global: { plugins: [i18n, router] } },
  )
  await flushPromises()
  await w.vm.$nextTick()
  return w
}

// 固定系统时间,使 trashAssetToPhoto 算出的 daysLeft 可预测(retentionDays=30):
// - 'a' 于 2026-06-30 删除,距今(2026-07-27)27 天 → daysLeft=3 → urgent 桶(1–7)
// - 'b' 于 2026-07-26 删除,距今 1 天 → daysLeft=29 → fresh 桶(22–Infinity)
function asset(id: string, deletedAt: string, opts: Partial<{ mimeType: string; fileSize: number; originalName: string; originalPath: string }> = {}) {
  return {
    id,
    mimeType: opts.mimeType || 'image/jpeg',
    deletedAt,
    fileSize: opts.fileSize ?? 1048576,
    originalName: opts.originalName || `${id}.jpg`,
    originalPath: opts.originalPath || `/DATA/Gallery/${id}.jpg`,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-27T00:00:00Z'))
  svc.photos.listTrash.mockClear().mockResolvedValue([])
  svc.photos.restoreTrashBatch.mockClear().mockResolvedValue(undefined)
  svc.photos.restoreAllTrash.mockClear().mockResolvedValue(undefined)
  svc.photos.purgeTrash.mockClear().mockResolvedValue(undefined)
  svc.photos.emptyTrash.mockClear().mockResolvedValue(undefined)
  svc.photos.deleteAsset.mockClear().mockResolvedValue(undefined)
  svc.photos.getConfig.mockClear().mockResolvedValue({ watchDirs: ['/DATA/Gallery'], retentionDays: 30 })
  svc.photos.getTimeline.mockClear().mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('PhotosTrash.vue', () => {
  it('loaded 且空 → 渲染空态,hero 按钮 disabled', async () => {
    const w = await mountView()
    const trash = usePhotosTrash()
    expect(trash.loaded).toBe(true)
    expect(w.find('[data-test="trash-empty"]').exists()).toBe(true)
    expect(w.text()).toContain('最近删除是空的')
    expect(w.text()).toContain('30') // retentionDays 插值进 hint
    expect(w.find('[data-test="trash-restore-all"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="trash-empty-btn"]').attributes('disabled')).toBeDefined()
  })

  it('有项 → 渲染分桶(按 daysLeft),瓦片 img src = thumbnailUrl(id,\'small\'),倒计时角标含 {days}', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z'), asset('b', '2026-07-26T00:00:00Z')])
    const w = await mountView()

    expect(w.find('[data-test="trash-empty"]').exists()).toBe(false)
    const buckets = w.findAll('.trash-bucket')
    expect(buckets).toHaveLength(2) // urgent(daysLeft=3) + fresh(daysLeft=29)

    const tiles = w.findAll('.trash-tile')
    expect(tiles).toHaveLength(2)
    const imgs = w.findAll('.trash-tile img')
    expect(imgs.map((i) => i.attributes('src')).sort()).toEqual(['mock://thumb/a/small', 'mock://thumb/b/small'])

    const countdowns = w.findAll('.trash-tile-countdown').map((c) => c.text())
    expect(countdowns.some((t) => t.includes('3'))).toBe(true)
    expect(countdowns.some((t) => t.includes('29'))).toBe(true)
  })

  it('点勾选圈 → 该项进 selected,bulk bar 出现', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z')])
    const w = await mountView()

    expect(w.find('.trash-bulk-bar').exists()).toBe(false)
    await w.find('.trash-tile-select').trigger('click')
    await w.vm.$nextTick()

    const bar = w.find('.trash-bulk-bar')
    expect(bar.exists()).toBe(true)
    expect(bar.text()).toContain('1')
    expect(w.find('.trash-tile').attributes('data-selected')).toBe('true')
  })

  it('点「恢复选中」→ 不开确认,直接 trash.restore(ids) + 恢复 toast 带 Undo;点 Undo → trash.undoRestore(ids)', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z')])
    const w = await mountView()
    const trash = usePhotosTrash()
    const restoreSpy = vi.spyOn(trash, 'restore')
    const undoSpy = vi.spyOn(trash, 'undoRestore')

    await w.find('.trash-tile-select').trigger('click')
    await w.vm.$nextTick()

    await w.find('[data-test="trash-bulk-restore"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    // 恢复选中 Vue2 无二次确认,直接执行——本视图同样不应弹确认模态。
    expect(w.find('.trash-modal-scrim').exists()).toBe(false)
    expect(restoreSpy).toHaveBeenCalledWith(['a'])
    expect(w.find('.trash-bulk-bar').exists()).toBe(false) // 选择已清空

    const undoBtn = w.get('.toast-action')
    expect(undoBtn.text()).toBe('撤销')
    await undoBtn.trigger('click')
    await flushPromises()

    expect(undoSpy).toHaveBeenCalledWith(['a'])
  })

  it('点「清空最近删除」→ 开确认模态 → 确认 → trash.empty() 被调', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z')])
    const w = await mountView()
    const trash = usePhotosTrash()
    const emptySpy = vi.spyOn(trash, 'empty')

    await w.find('[data-test="trash-empty-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.trash-modal-scrim').exists()).toBe(true)

    await w.find('.trash-btn-cta').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(emptySpy).toHaveBeenCalledTimes(1)
    expect(w.find('.trash-modal-scrim').exists()).toBe(false)
  })

  it('ESC 关确认模态', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z')])
    const w = await mountView()

    await w.find('[data-test="trash-empty-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.trash-modal-scrim').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(w.find('.trash-modal-scrim').exists()).toBe(false)
  })

  it('永久删除选中 → 走确认模态(danger)→ 确认 → trash.purge(ids)', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z')])
    const w = await mountView()
    const trash = usePhotosTrash()
    const purgeSpy = vi.spyOn(trash, 'purge')

    await w.find('.trash-tile-select').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="trash-bulk-delete"]').trigger('click')
    await w.vm.$nextTick()

    const modal = w.get('.trash-modal')
    expect(modal.attributes('data-danger')).toBe('true')
    await w.find('.trash-btn-cta').trigger('click')
    await flushPromises()

    expect(purgeSpy).toHaveBeenCalledWith(['a'])
  })

  it('取消选择(bulk bar「取消」)→ selected 清空,bulk bar 消失', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z')])
    const w = await mountView()

    await w.find('.trash-tile-select').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.trash-bulk-bar').exists()).toBe(true)

    await w.find('[data-test="trash-bulk-cancel"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.trash-bulk-bar').exists()).toBe(false)
  })

  it('点瓦片(非勾选圈)也切换选择,不触发任何灯箱/导航', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z')])
    const w = await mountView()

    await w.find('.trash-tile').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.trash-bulk-bar').exists()).toBe(true)
    expect(w.find('.trash-tile').attributes('data-selected')).toBe('true')
  })

  // Task 12 (SP15-P3): while pages remain, the freeable-size figure is only a sum over the
  // loaded subset — the empty-trash confirmation must not present it as the whole truth.
  const fullPage = () => Array.from({ length: 500 }, (_, i) => asset(`p${i}`, '2026-06-30T00:00:00Z'))

  it('uses the size-less empty copy while pages remain', async () => {
    // Task 12 fix round 2: emptyTrash() now pages in the rest before opening the confirm —
    // this test's mock must let that attempt get stuck (not simply keep returning full pages
    // forever, which would loop until trashExhausted flips true and never show the partial
    // copy at all). See "empty-trash when a page gets stuck…" below for the fuller scenario.
    svc.photos.listTrash.mockResolvedValueOnce(fullPage()) // initial mount fetch
    svc.photos.listTrash.mockRejectedValueOnce(new Error('network')) // stuck load-more page
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const w = await mountView()
    const trash = usePhotosTrash()
    expect(trash.trashExhausted).toBe(false)

    await w.find('[data-test="trash-empty-btn"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    const body = w.find('.trash-modal-body').text()
    expect(body).toBe('这将释放 NAS 上的空间，原始文件将无法恢复。')
    expect(body).not.toMatch(/MB/)
    spy.mockRestore()
  })

  it('uses the exact copy with the freed size once everything is loaded', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z')])
    const w = await mountView()
    const trash = usePhotosTrash()
    expect(trash.trashExhausted).toBe(true)

    await w.find('[data-test="trash-empty-btn"]').trigger('click')
    await w.vm.$nextTick()

    const body = w.find('.trash-modal-body').text()
    expect(body).toContain('MB')
    expect(body).not.toBe('这将释放 NAS 上的空间，原始文件将无法恢复。')
  })

  it('shows the load-more button only while pages remain', async () => {
    svc.photos.listTrash.mockResolvedValue(fullPage())
    const w = await mountView()
    expect(w.find('[data-test="trash-load-more"]').exists()).toBe(true)
    expect(w.find('[data-test="trash-loaded-hint"]').exists()).toBe(true)

    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z')])
    const w2 = await mountView()
    expect(w2.find('[data-test="trash-load-more"]').exists()).toBe(false)
    expect(w2.find('[data-test="trash-loaded-hint"]').exists()).toBe(false)
  })

  // Task 12 fix round 2 (Important 1 & 2, coordinator review): both bulk hero actions
  // (restore all / empty trash) act on the ENTIRE trash server-side, not just the loaded
  // page — the confirm dialogs and undo must page in the rest first rather than understate
  // what will actually happen.
  describe('bulk hero actions page in the rest before acting (Task 12 fix round 2)', () => {
    it('empty-trash with pages remaining pages in the rest first and then quotes the full count and size', async () => {
      const rest = [asset('extra1', '2026-06-30T00:00:00Z'), asset('extra2', '2026-06-30T00:00:00Z')]
      svc.photos.listTrash.mockResolvedValueOnce(fullPage()) // initial mount fetch: page one, 500 rows
      svc.photos.listTrash.mockResolvedValueOnce(rest) // load-more triggered by the click below
      const w = await mountView()
      const trash = usePhotosTrash()
      expect(trash.trashExhausted).toBe(false)

      await w.find('[data-test="trash-empty-btn"]').trigger('click')
      await flushPromises()
      await w.vm.$nextTick()

      expect(trash.trashExhausted).toBe(true)
      expect(trash.items).toHaveLength(502)
      expect(svc.photos.listTrash).toHaveBeenLastCalledWith(500, 500)

      const title = w.find('.trash-modal-title').text()
      expect(title).toContain('502')
      const body = w.find('.trash-modal-body').text()
      expect(body).toContain('MB')
      expect(body).not.toBe('这将释放 NAS 上的空间，原始文件将无法恢复。')
    })

    it('empty-trash when a page gets stuck shows the count-less/size-less copy and still lets the action proceed', async () => {
      svc.photos.listTrash.mockResolvedValueOnce(fullPage()) // initial mount fetch
      svc.photos.listTrash.mockRejectedValueOnce(new Error('network')) // stuck load-more page
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const w = await mountView()
      const trash = usePhotosTrash()
      expect(trash.trashExhausted).toBe(false)

      await w.find('[data-test="trash-empty-btn"]').trigger('click')
      await flushPromises()
      await w.vm.$nextTick()

      // Still stuck: the failed page must not have been silently treated as "done".
      expect(trash.trashExhausted).toBe(false)
      expect(w.find('.trash-modal-scrim').exists()).toBe(true) // action still proceeds

      const title = w.find('.trash-modal-title').text()
      expect(title).toBe('清空最近删除') // bare action-label title, no invented/stale count
      const body = w.find('.trash-modal-body').text()
      expect(body).toBe('这将释放 NAS 上的空间，原始文件将无法恢复。')

      // Confirming still works even though the true count/size is unknown.
      svc.photos.listTrash.mockResolvedValueOnce([]) // fetchTrash() re-fetch after empty()
      await w.find('.trash-btn-cta').trigger('click')
      await flushPromises()
      await w.vm.$nextTick()

      expect(svc.photos.emptyTrash).toHaveBeenCalledTimes(1)
      const toastEl = w.find('.toast')
      expect(toastEl.exists()).toBe(true)
      expect(toastEl.text()).toBe('最近删除已清空')
      spy.mockRestore()
    })

    it('restore-all with pages remaining restores and offers an Undo whose id set covers everything that was restored', async () => {
      const rest = [asset('extra1', '2026-06-30T00:00:00Z')]
      svc.photos.listTrash.mockResolvedValueOnce(fullPage()) // initial mount fetch
      svc.photos.listTrash.mockResolvedValueOnce(rest) // load-more triggered by the click below
      const w = await mountView()
      const trash = usePhotosTrash()
      const restoreAllSpy = vi.spyOn(trash, 'restoreAll')
      const undoSpy = vi.spyOn(trash, 'undoRestore')

      await w.find('[data-test="trash-restore-all"]').trigger('click')
      await flushPromises()
      await w.vm.$nextTick()

      expect(trash.trashExhausted).toBe(true)
      expect(trash.items).toHaveLength(501)
      const title = w.find('.trash-modal-title').text()
      expect(title).toContain('501')

      svc.photos.listTrash.mockResolvedValueOnce([]) // fetchTrash() re-fetch after restoreAll()
      await w.find('.trash-btn-cta').trigger('click')
      await flushPromises()
      await w.vm.$nextTick()

      expect(restoreAllSpy).toHaveBeenCalledTimes(1)
      const undoBtn = w.get('.toast-action')
      expect(undoBtn.text()).toBe('撤销')

      await undoBtn.trigger('click')
      await flushPromises()
      expect(undoSpy).toHaveBeenCalledTimes(1)
      // The id set handed to undo must cover every restored item, not just the first page.
      expect(undoSpy.mock.calls[0][0]).toHaveLength(501)
    })

    it('restore-all when a page gets stuck offers no Undo action', async () => {
      svc.photos.listTrash.mockResolvedValueOnce(fullPage()) // initial mount fetch
      svc.photos.listTrash.mockRejectedValueOnce(new Error('network')) // stuck load-more page
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const w = await mountView()
      const trash = usePhotosTrash()

      await w.find('[data-test="trash-restore-all"]').trigger('click')
      await flushPromises()
      await w.vm.$nextTick()

      expect(trash.trashExhausted).toBe(false)
      const title = w.find('.trash-modal-title').text()
      expect(title).toBe('恢复全部') // bare action-label title, no invented/stale count

      svc.photos.listTrash.mockResolvedValueOnce([]) // fetchTrash() re-fetch after restoreAll()
      await w.find('.trash-btn-cta').trigger('click')
      await flushPromises()
      await w.vm.$nextTick()

      expect(svc.photos.restoreAllTrash).toHaveBeenCalledTimes(1)
      // No Undo action offered — the loaded id set here would only be a partial subset of
      // what restoreAllTrash() actually restored server-side, so offering Undo would let the
      // user silently revert part of it while the rest stays restored with no path back.
      expect(w.find('.toast-action').exists()).toBe(false)
      spy.mockRestore()
    })
  })
})
