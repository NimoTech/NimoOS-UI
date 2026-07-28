import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { defineComponent } from 'vue'
import StorageRaidDetail from './StorageRaidDetail.vue'
import zh from '../i18n/zh_cn'

const raidList = vi.fn().mockResolvedValue([{ id: 7, name: 'md7', level: 5, state: 'active', mount_point: '/DATA', uuid: 'u-7' }])
const raidGetStatus = vi.fn().mockResolvedValue({ live_state: 'active', state: 'active', rebuild_pct: 0, total_bytes: 100, used_bytes: 40, free_bytes: 60, members: [{ path: '/dev/sda', state: 'active sync', number: 0 }] })
const raidGetUsage = vi.fn().mockResolvedValue({ filesystem: 'btrfs', btrfs_usage: { free_estimated_bytes: 55, cached_at: 1700000000 } })
// avail 里放一块空闲盘:换盘下拉框的候选来源就是它(GET /v1/disks 的 avail 字段)
const getDiskList = vi.fn().mockResolvedValue({
  disks: [],
  avail: [{ path: '/dev/sdd', name: 'sdd', model: 'scsi_debug', size: 536870912 }],
})
// 降级 RAID5 的成员形状取自 2026-07-28 真机:空槽位 + 故障盘各一条
const degradedStatus = {
  live_state: 'clean, degraded', state: 'degraded', rebuild_pct: -1,
  total_bytes: 100, used_bytes: 40, free_bytes: 60,
  members: [
    { path: '', state: 'removed', number: 0 },
    { path: '/dev/sdb', state: 'active sync', number: 1 },
    { path: '/dev/sdc', state: 'active sync', number: 3 },
    { path: '/dev/sda', state: 'faulty', number: 0 },
  ],
}
const raidReplaceDisk = vi.fn().mockResolvedValue(undefined)
const snapListVolumes = vi.fn().mockResolvedValue([])
const snapList = vi.fn().mockResolvedValue([])
vi.mock('@nimotech/nimoos-service', () => ({ service: {
  storage: { list: vi.fn().mockResolvedValue([]) }, disks: { getDiskList: (...a: unknown[]) => getDiskList(...a) },
  raid: { list: (...a: unknown[]) => raidList(...a), getStatus: (...a: unknown[]) => raidGetStatus(...a), getUsage: (...a: unknown[]) => raidGetUsage(...a), replaceDisk: (...a: unknown[]) => raidReplaceDisk(...a) },
  snapshot: {
    listVolumes: (...a: unknown[]) => snapListVolumes(...a),
    list: (...a: unknown[]) => snapList(...a),
    getPolicy: vi.fn().mockResolvedValue({}),
    patchPolicy: vi.fn(),
    togglePolicy: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  },
} }))
vi.mock('../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: () => vi.fn() }) }))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const Stub = defineComponent({ render: () => null })
const router = createRouter({ history: createMemoryHistory(), routes: [
  { path: '/storage/raid/:id', name: 'storage-raid-detail', component: StorageRaidDetail },
  { path: '/storage/raid', name: 'storage-raid', component: Stub }, { path: '/', component: Stub },
] })

describe('StorageRaidDetail', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
  it('加载详情:名称 + RAID 级别 + 用量 + 成员 + btrfs 行', async () => {
    await router.push('/storage/raid/7'); await router.isReady()
    const store = (await import('../storage/stores/storage')).useStorageStore()
    await store.loadRaid() // 先填 raidArrays 让 detail 找得到 array
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    expect(w.text()).toContain('md7')
    expect(w.text()).toContain('RAID 5')
    expect(w.text()).toContain('/dev/sda')
    expect(raidGetUsage).toHaveBeenCalledWith('7')
  })
  it('写操作按钮边界:active 阵列头部写按钮 = [delete](P4 T8 回填:recover 缺席)', async () => {
    // P3 终审加的是硬计数不变式(===2);P4 T6 加了 .rd-delete 后计数必然变化,
    // 改为语义化断言:该出现的(back + delete)出现,不该出现的(recover/replace)缺席。
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick()
    expect(w.find('.rd-back').exists()).toBe(true)
    expect(w.find('.rd-delete').exists()).toBe(true)
    expect(w.find('.rd-recover').exists()).toBe(false)
    expect(w.find('.rd-replace').exists()).toBe(false)
  })
  it('写操作按钮边界:retrying 阵列头部写按钮 = [delete, recover]', async () => {
    // getStatus 被调两次:loadRaid() 拉列表状态一次 + loadRaidDetail() 拉详情状态一次——两次都须是 retrying
    const retryingStatus = { live_state: 'retrying', state: 'retrying', rebuild_pct: 0, total_bytes: 100, used_bytes: 40, free_bytes: 60, members: [] }
    raidGetStatus.mockResolvedValueOnce(retryingStatus).mockResolvedValueOnce(retryingStatus)
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick()
    expect(w.find('.rd-delete').exists()).toBe(true)
    expect(w.find('.rd-recover').exists()).toBe(true)
    expect(w.find('.rd-replace').exists()).toBe(false)
  })
  it('recover 按钮:failed 也渲染;点击调用 store.recoverRaid(id) 一次;busy 时禁用', async () => {
    const failedStatus = { live_state: 'failed', state: 'failed', rebuild_pct: 0, total_bytes: 100, used_bytes: 40, free_bytes: 60, members: [] }
    raidGetStatus.mockResolvedValueOnce(failedStatus).mockResolvedValueOnce(failedStatus)
    await router.push('/storage/raid/7'); await router.isReady()
    const store = (await import('../storage/stores/storage')).useStorageStore()
    const recoverSpy = vi.spyOn(store, 'recoverRaid').mockResolvedValue({ state: 'active' })
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick()
    const btn = w.find('.rd-recover')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(recoverSpy).toHaveBeenCalledTimes(1)
    expect(recoverSpy).toHaveBeenCalledWith('7')

    store.raidRecovering = true
    await w.vm.$nextTick()
    expect(w.find('.rd-recover').attributes('disabled')).toBeDefined()
  })
  it('左栏挂载快照面板,并按本阵列 uuid 查卷', async () => {
    snapListVolumes.mockResolvedValue([{ volume_uuid: 'u-7', supported: true, enabled: true, count: 1, last_at: '2026-07-27T01:00:00Z' }])
    await router.push('/storage/raid/7'); await router.isReady()
    const store = (await import('../storage/stores/storage')).useStorageStore()
    await store.loadRaid()
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    expect(w.findComponent({ name: 'SnapshotPanel' }).exists()).toBe(true)
    expect(w.find('.sp-switch').attributes('aria-checked')).toBe('true')
  })

  it('快照端点 404 → 面板落"不支持"态,详情页其余内容照常渲染', async () => {
    snapListVolumes.mockRejectedValue(new Error('404'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await router.push('/storage/raid/7'); await router.isReady()
    const store = (await import('../storage/stores/storage')).useStorageStore()
    await store.loadRaid()
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    expect(w.find('.sp-unsupported').exists()).toBe(true)
    expect(w.text()).toContain('md7')          // 阵列名还在
    expect(w.text()).toContain('/dev/sda')     // 成员列表还在
    expect(w.find('.rd-delete').exists()).toBe(true)
  })

  // 冷深链换盘回归:直接打开 /storage/raid/:id(不经存储卷/物理硬盘/创建页)时,
  // 候选盘必须由本页自己加载。此前详情页不调 loadDrives(),store.availDisks 为空,
  // 「更换硬盘」下拉框只剩占位项 —— 而 RaidReplaceDialog.test.ts 是把
  // availableDisks 当 prop 直接喂进去的,所以那层测试永远看不到这个缺口。
  it('冷深链降级阵列:换盘下拉框有候选盘(详情页自行加载 avail)', async () => {
    document.body.innerHTML = ''
    raidGetStatus.mockResolvedValue(degradedStatus)
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { attachTo: document.body, global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()

    expect(getDiskList).toHaveBeenCalled()

    const replaceBtns = w.findAll('.rml-replace')
    expect(replaceBtns.length).toBe(1)
    await replaceBtns[0].trigger('click')
    await w.vm.$nextTick(); await w.vm.$nextTick()

    // reka-ui DialogPortal 把内容 Teleport 到 body,不在 wrapper 里 —— 同
    // RaidReplaceDialog.test.ts 的做法,从 document.body 查。
    const select = document.body.querySelector<HTMLSelectElement>('.rrd-select')
    expect(select, '换盘弹窗未渲染').not.toBeNull()
    const values = [...select!.querySelectorAll('option')]
      .map((o) => o.getAttribute('value')).filter((v) => v)
    expect(values).toEqual(['/dev/sdd'])
  })

  it('冷深链:availDisks 为空时下拉框只有占位项(守住上面那条断言的对照)', async () => {
    document.body.innerHTML = ''
    raidGetStatus.mockResolvedValue(degradedStatus)
    getDiskList.mockResolvedValueOnce({ disks: [], avail: [] })
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { attachTo: document.body, global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    await w.findAll('.rml-replace')[0].trigger('click')
    await w.vm.$nextTick(); await w.vm.$nextTick()
    const select = document.body.querySelector<HTMLSelectElement>('.rrd-select')
    expect(select, '换盘弹窗未渲染 —— 断言会空洞通过').not.toBeNull()
    const values = [...select!.querySelectorAll('option')]
      .map((o) => o.getAttribute('value')).filter((v) => v)
    expect(values).toEqual([])
  })

  // 换盘提交成功后退回列表页看进度(用户指定的交互)。重建是长活儿(真实硬盘可达
  // 数小时),列表页有换盘看板卡 + 5 秒轮询,停在详情页干等没有意义。
  it('换盘提交成功 → 关弹窗 + 建立换盘看板任务 + 跳回 RAID 列表页', async () => {
    document.body.innerHTML = ''
    raidGetStatus.mockResolvedValue(degradedStatus)
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { attachTo: document.body, global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()

    await w.findAll('.rml-replace')[0].trigger('click')
    await w.vm.$nextTick(); await w.vm.$nextTick()
    const select = document.body.querySelector<HTMLSelectElement>('.rrd-select')!
    select.value = '/dev/sdd'
    select.dispatchEvent(new Event('change'))
    await w.vm.$nextTick()
    document.body.querySelector<HTMLButtonElement>('.rrd-ok')!.click()
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick()

    expect(raidReplaceDisk).toHaveBeenCalledWith('7', { old_disk_path: '/dev/sda', new_disk_path: '/dev/sdd' })
    const store = (await import('../storage/stores/storage')).useStorageStore()
    expect(store.replaceTask).toMatchObject({ arrayId: '7', oldPath: '/dev/sda', newPath: '/dev/sdd' })
    expect(router.currentRoute.value.path).toBe('/storage/raid')
  })

  it('换盘接口失败 → 不建看板任务、不跳页(留在详情页)', async () => {
    document.body.innerHTML = ''
    raidGetStatus.mockResolvedValue(degradedStatus)
    raidReplaceDisk.mockRejectedValueOnce(new Error('500'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { attachTo: document.body, global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()

    await w.findAll('.rml-replace')[0].trigger('click')
    await w.vm.$nextTick(); await w.vm.$nextTick()
    const select = document.body.querySelector<HTMLSelectElement>('.rrd-select')!
    select.value = '/dev/sdd'
    select.dispatchEvent(new Event('change'))
    await w.vm.$nextTick()
    document.body.querySelector<HTMLButtonElement>('.rrd-ok')!.click()
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick()

    const store = (await import('../storage/stores/storage')).useStorageStore()
    expect(store.replaceTask).toBeNull()
    expect(router.currentRoute.value.path).toBe('/storage/raid/7')
  })
})
