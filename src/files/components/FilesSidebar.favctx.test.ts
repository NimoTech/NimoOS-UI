import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'
import FilesSidebar from './FilesSidebar.vue'
import FileContextMenu from './FileContextMenu.vue'
import { useFavoritesStore } from '../stores/favorites'
import { service } from '@nimotech/nimoos-service'

// The parent listing is what turns a favourite (a name and a path, nothing else)
// into a real entry: whether it is already shared, whether it is a mount point.
// Those two decide which menu items may appear at all.
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: {
      getList: vi.fn(async () => ({
        content: [
          { name: 'Trip', path: '/DATA/Trip', is_dir: true, extensions: { share: { shared: 'true' } } },
          { name: 'Work', path: '/DATA/Work', is_dir: true },
        ],
      })),
    },
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
    samba: { listConnections: vi.fn().mockResolvedValue([]) },
    cloud: { list: vi.fn().mockResolvedValue([]), umount: vi.fn().mockResolvedValue(undefined) },
    storage: { list: vi.fn().mockResolvedValue([]) },
  },
  getHttp: () => ({ get: vi.fn(async () => ({ data: { data: [] } })) }),
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/'),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/files', name: 'files', component: { template: '<div/>' } },
      { path: '/files/:path(.*)*', name: 'files-path', component: { template: '<div/>' } },
      { path: '/files-shares', name: 'files-shares', component: { template: '<div/>' } },
      { path: '/files-drop', name: 'files-drop', component: { template: '<div/>' } },
    ],
  })
}

async function mountSidebar() {
  const router = makeRouter()
  router.push('/files')
  await router.isReady()
  const w = mount(FilesSidebar, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return w
}

describe('FilesSidebar favourite context menu (F3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('right-clicking a favourite targets that favourite, not the blank-area menu', async () => {
    const favorites = useFavoritesStore()
    favorites.list = [{ name: 'Work', path: '/DATA/Work' }]
    const w = await mountSidebar()

    await w.find('[data-fav-path="/DATA/Work"]').trigger('contextmenu')
    await flushPromises()

    const menu = w.findComponent(FileContextMenu)
    expect(menu.props('entry')).toMatchObject({ name: 'Work', path: '/DATA/Work', is_dir: true })
    // A favourite is always exactly one target: the listing's selection has
    // nothing to do with what the user just right-clicked in the sidebar.
    expect(menu.props('selectedCount')).toBe(1)
  })

  it('fills in the entry from the parent listing so gating sees the real state', async () => {
    const favorites = useFavoritesStore()
    favorites.list = [{ name: 'Trip', path: '/DATA/Trip' }]
    const w = await mountSidebar()

    await w.find('[data-fav-path="/DATA/Trip"]').trigger('contextmenu')
    await flushPromises()

    // Without this the menu would offer "share to LAN" for an already-shared
    // folder, and the request would come back SHARE_ALREADY_EXISTS.
    expect(vi.mocked(service.folder.getList)).toHaveBeenCalledWith('/DATA')
    expect(w.findComponent(FileContextMenu).props('entry')).toMatchObject({
      path: '/DATA/Trip',
      extensions: { share: { shared: 'true' } },
    })
  })

  it('keeps the synthesised entry when the listing cannot be read', async () => {
    vi.mocked(service.folder.getList).mockRejectedValueOnce(new Error('offline'))
    const favorites = useFavoritesStore()
    favorites.list = [{ name: 'Work', path: '/DATA/Work' }]
    const w = await mountSidebar()

    await w.find('[data-fav-path="/DATA/Work"]').trigger('contextmenu')
    await flushPromises()

    // Degraded, not broken: the menu still names the right folder. Gating that
    // needs extensions falls back to "no extensions", which is what an entry
    // with no share and no mount looks like.
    expect(w.findComponent(FileContextMenu).props('entry')).toMatchObject({ name: 'Work', path: '/DATA/Work', is_dir: true })
  })

  it('forwards a chosen action upward with the favourite as the sole target', async () => {
    const favorites = useFavoritesStore()
    favorites.list = [{ name: 'Work', path: '/DATA/Work' }]
    const w = await mountSidebar()

    await w.find('[data-fav-path="/DATA/Work"]').trigger('contextmenu')
    await flushPromises()
    w.findComponent(FileContextMenu).vm.$emit('action', 'rename', { name: 'Work', path: '/DATA/Work', is_dir: true })
    await flushPromises()

    const emitted = w.emitted('ctx-action')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toBe('rename')
    expect(emitted![0][1]).toMatchObject({ path: '/DATA/Work' })
  })
})
