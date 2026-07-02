import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import { messages } from '../i18n/zh_cn'
import Files from './Files.vue'
import { useFilesStore } from '../files/stores/files'
import { useFoldersStore } from '../home/stores/folders'

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
  },
  getHttp: () => ({ get: vi.fn(async () => ({ data: { data: [] } })) }),
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })

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
  beforeEach(() => { setActivePinia(createPinia()) })

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
})
