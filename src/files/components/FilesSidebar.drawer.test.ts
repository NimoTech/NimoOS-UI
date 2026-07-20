import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'
import FilesSidebar from './FilesSidebar.vue'
import { useFilesStore } from '../stores/files'
import { useSidebarDrawer, __resetSidebarDrawerForTest } from '../../composables/useSidebarDrawer'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
    folder: { getList: vi.fn() },
    driver: { listDrivers: vi.fn().mockResolvedValue([]) },
    cloud: { list: vi.fn().mockResolvedValue([]), umount: vi.fn().mockResolvedValue(undefined) },
  },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { filesFavorites: '收藏', filesDisks: '磁盘', filesNoFavorites: '暂无收藏', filesSharesNav: '共享', filesDropNav: '互传', filesMountManage: '挂载管理', filesMountEject: '弹出' } } })

const testRouter = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div/>' } },
    { path: '/files/shares', name: 'files-shares', component: { template: '<div/>' } },
    { path: '/files/drop', name: 'files-drop', component: { template: '<div/>' } },
  ],
})

function mountSidebar() {
  const files = useFilesStore()
  files.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as never
  files.displayNames = { '/DATA': 'NimoOS-HD' }
  files.currentPath = '/DATA'
  return mount(FilesSidebar, { global: { plugins: [i18n, testRouter] } })
}

describe('FilesSidebar drawer', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); __resetSidebarDrawerForTest() })

  it('桌面态(isNarrow=false):无遮罩、无 is-drawer class', () => {
    const w = mountSidebar()
    expect(w.find('.side-scrim').exists()).toBe(false)
    expect(w.find('aside.files-sidebar').classes()).not.toContain('is-drawer')
  })

  it('窄屏 + 打开:出遮罩,aside 带 is-drawer/is-open;点遮罩关闭', async () => {
    const d = useSidebarDrawer()
    d.isNarrow.value = true
    d.open.value = true
    const w = mountSidebar()
    await nextTick()
    expect(w.find('.side-scrim').exists()).toBe(true)
    const aside = w.find('aside.files-sidebar')
    expect(aside.classes()).toContain('is-drawer')
    expect(aside.classes()).toContain('is-open')
    await w.find('.side-scrim').trigger('click')
    expect(d.open.value).toBe(false)
    expect(w.find('.side-scrim').exists()).toBe(false)
  })

  it('ESC 关闭抽屉', async () => {
    const d = useSidebarDrawer()
    d.isNarrow.value = true
    d.open.value = true
    mountSidebar()
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(d.open.value).toBe(false)
  })

  it('路由变化(点导航项)后自动收起', async () => {
    const d = useSidebarDrawer()
    d.isNarrow.value = true
    d.open.value = true
    const w = mountSidebar()
    await nextTick()
    await w.findAll('.side-item')[0].trigger('click') // 「共享」项 → router.push('/files/shares')
    await testRouter.isReady()
    await nextTick(); await nextTick() // 等 watch(route.fullPath) 触发
    await flushPromises() // router.push 的 pending navigation 在本仓库 vue-router 版本下需要一个宏任务才能落定,纯 nextTick 不够(已实测排查)
    expect(d.open.value).toBe(false)
  })
})
