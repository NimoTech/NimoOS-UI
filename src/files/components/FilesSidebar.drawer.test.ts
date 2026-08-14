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

  it('Desktop state (isNarrow=false): no scrim, no is-drawer class', () => {
    const w = mountSidebar()
    expect(w.find('.side-scrim').exists()).toBe(false)
    expect(w.find('aside.files-sidebar').classes()).not.toContain('is-drawer')
  })

  it('Narrow screen + open: scrim appears, aside has is-drawer/is-open; click scrim to close', async () => {
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

  it('ESC closes the drawer', async () => {
    const d = useSidebarDrawer()
    d.isNarrow.value = true
    d.open.value = true
    mountSidebar()
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(d.open.value).toBe(false)
  })

  it('Drawer automatically closes after route change (clicking nav item)', async () => {
    const d = useSidebarDrawer()
    d.isNarrow.value = true
    d.open.value = true
    const w = mountSidebar()
    await nextTick()
    await w.findAll('.side-item')[0].trigger('click') // 「shares」 item → router.push('/files/shares')
    await testRouter.isReady()
    await nextTick(); await nextTick() // Wait for watch(route.fullPath) to fire
    await flushPromises() // router.push's pending navigation requires a macrotask to settle in this repo's vue-router version; nextTick alone is insufficient (verified through testing)
    expect(d.open.value).toBe(false)
  })
})
