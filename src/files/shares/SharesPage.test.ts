import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'
import SharesPage from './SharesPage.vue'

// SharesPage reads useRoute()/useRouter() via FilesSidebar, calling shares.load()/files.loadRoots(),
// which eventually hit service.samba / service.storage.list — all need to be mocked, otherwise
// vue-router injection will throw and onMounted will make real network calls.
//
// storageList is a controlled deferred: the first call to files.loadRoots() in onMounted will
// hang on it without resolving. This is used to simulate the real race condition in a deep-link
// scenario “loadRoots() hasn't finished running when the user clicks 'goto'” rather than letting
// the mock resolve immediately and thus “testing away” the race-condition window.
const { listShares, storageList, resolveStorage } = vi.hoisted(() => {
  let resolveFn!: (v: unknown) => void
  const pending = new Promise((resolve) => { resolveFn = resolve })
  return { listShares: vi.fn(), storageList: vi.fn(() => pending), resolveStorage: () => resolveFn }
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
      storage: { list: storageList },
    },
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

describe('SharesPage — prevent /DATA leakage from "goto" action', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    localStorage.clear()
    listShares.mockReset()
    listShares.mockResolvedValue([{ id: 1, path: '/DATA/Documents' }])
    await testRouter.push('/files/shares')
    await testRouter.isReady()
  })

  it('Clicking "goto" before loadRoots() resolves does not immediately navigate with raw real path; navigates with /NimoOS-HD only after resolve', async () => {
    // /storage request is still pending (resolveStorage() hasn't been called yet), simulating a deep-link window where disks/displayNames are still empty.
    storageList.mockReturnValueOnce(new Promise(() => {})) // loadRoots() call in onMounted: permanent pending, doesn't interfere with the controlled pending below
    const pushSpy = vi.spyOn(testRouter, 'push')

    const w = mount(SharesPage, { global: { plugins: [i18n, testRouter] } })
    await flushPromises() // shares.load() completes, ShareRow renders; the earlier loadRoots() call is still stuck in pending

    const gotoBtn = w.findAll('.share-act').find((b) => b.text() === zh.filesShareGoto)
    expect(gotoBtn).toBeTruthy()

    await gotoBtn!.trigger('click') // onGoto: disks is empty → await files.loadRoots() (second call, hits the controlled pending promise below)
    await flushPromises()

    // Race condition is correctly blocked: loadRoots() hasn't resolved yet, cannot have already navigated to bare real path.
    expect(pushSpy).not.toHaveBeenCalled()

    resolveStorage()([{ type: 'hdd', children: [{ mount_point: '/', label: 'NimoOS-HD' }] }])
    await flushPromises()
    await flushPromises() // loadDisks -> rebuildDisplayNames -> onGoto continues -> goVirtual is a multi-hop await chain, extra flush for stability

    expect(pushSpy).toHaveBeenCalledTimes(1)
    const pushedPath = pushSpy.mock.calls[0][0] as string
    expect(pushedPath).not.toContain('/DATA')
    expect(pushedPath).not.toContain('/mnt')
    expect(pushedPath).toBe('/files/NimoOS-HD/Documents')
  })
})
