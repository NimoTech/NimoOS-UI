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
})
