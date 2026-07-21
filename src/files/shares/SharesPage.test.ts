import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'
import SharesPage from './SharesPage.vue'

// SharesPage 经 FilesSidebar 读取 useRoute()/useRouter(),shares.load()/files.loadRoots() 打
// service.samba / getHttp —— 都需要 mock,否则 vue-router 注入会抛错、onMounted 会打真实网络。
//
// storageGet 是一个受控的 deferred:onMounted 里 files.loadRoots() 首次调用会挂在它上不 resolve,
// 用来模拟深链场景「loadRoots() 还没跑完用户就点了前往」的真实竞态,而不是让 mock 立即 resolve 把
// 竞态窗口“测没了”。
const { listShares, storageGet, resolveStorage } = vi.hoisted(() => {
  let resolveFn!: (v: unknown) => void
  const pending = new Promise((resolve) => { resolveFn = resolve })
  return { listShares: vi.fn(), storageGet: vi.fn(() => pending), resolveStorage: () => resolveFn }
})

vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return {
    ...actual,
    service: {
      samba: { listShares, deleteShare: vi.fn().mockResolvedValue(undefined) },
      users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
      folder: { getList: vi.fn() },
      driver: { listDrivers: vi.fn().mockResolvedValue([]) },
      cloud: { list: vi.fn().mockResolvedValue([]), umount: vi.fn().mockResolvedValue(undefined) },
    },
    getHttp: () => ({ get: storageGet }),
  }
})

const testRouter = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div/>' } },
    { path: '/files', name: 'files', component: { template: '<div/>' } },
    { path: '/files/shares', name: 'files-shares', component: { template: '<div/>' } },
    { path: '/files/:path(.*)*', name: 'files-path', component: { template: '<div/>' } },
  ],
})

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

describe('SharesPage — 「前往」防 /DATA 泄漏', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    localStorage.clear()
    listShares.mockReset()
    listShares.mockResolvedValue([{ id: 1, path: '/DATA/Documents' }])
    await testRouter.push('/files/shares')
    await testRouter.isReady()
  })

  it('loadRoots() 未 resolve 时点「前往」不会立刻用 raw real path 跳转;resolve 后才带 /NimoOS-HD 跳转', async () => {
    // /storage 请求还悬而未决(还没调用 resolveStorage()),模拟 disks/displayNames 仍为空的深链窗口。
    storageGet.mockReturnValueOnce(new Promise(() => {})) // onMounted 的 loadRoots() 调用:永久 pending,不干扰下面的可控 pending
    const pushSpy = vi.spyOn(testRouter, 'push')

    const w = mount(SharesPage, { global: { plugins: [i18n, testRouter] } })
    await flushPromises() // shares.load() 完成,ShareRow 渲染出来;上面那次 loadRoots() 仍卡在 pending

    const gotoBtn = w.findAll('.share-act').find((b) => b.text() === zh.filesShareGoto)
    expect(gotoBtn).toBeTruthy()

    await gotoBtn!.trigger('click') // onGoto: disks 为空 → await files.loadRoots()(第二次调用,命中下面可控的 pending promise)
    await flushPromises()

    // 竞态被正确挡住:loadRoots() 还没 resolve,不能已经跳转到裸 real path。
    expect(pushSpy).not.toHaveBeenCalled()

    resolveStorage()({ data: { data: [{ type: 'hdd', children: [{ mount_point: '/', label: 'NimoOS-HD' }] }] } })
    await flushPromises()
    await flushPromises() // loadDisks -> rebuildDisplayNames -> onGoto 继续 -> goVirtual 是多跳 await 链,多 flush 一轮更稳

    expect(pushSpy).toHaveBeenCalledTimes(1)
    const pushedPath = pushSpy.mock.calls[0][0] as string
    expect(pushedPath).not.toContain('/DATA')
    expect(pushedPath).not.toContain('/mnt')
    expect(pushedPath).toBe('/files/NimoOS-HD/Documents')
  })
})
