import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'
import SharesPage from './SharesPage.vue'

const { listShares, deleteShare } = vi.hoisted(() => ({
  listShares: vi.fn(),
  deleteShare: vi.fn(async (_id: number) => {}),
}))

vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return {
    ...actual,
    service: {
      samba: { listShares, deleteShare },
      users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
      folder: { getList: vi.fn() },
      driver: { listDrivers: vi.fn().mockResolvedValue([]) },
      cloud: { list: vi.fn().mockResolvedValue([]), umount: vi.fn().mockResolvedValue(undefined) },
      storage: { list: vi.fn().mockResolvedValue([]) },
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

const ROWS = [
  { id: 1, path: '/DATA/Documents' },
  { id: 2, path: '/DATA/Media' },
  { id: 3, path: '/DATA/Downloads' },
]

let w: VueWrapper | undefined

async function mountPage() {
  w = mount(SharesPage, { global: { plugins: [i18n, testRouter] }, attachTo: document.body })
  await flushPromises()
  return w
}

// The literal text "取消共享" appears on row hover buttons, the toolbar button
// AND the dialog confirm button — never look buttons up by that text in
// document.body. Only one reka dialog renders its portal content at a time,
// so scoping to .ui-dialog-content is unambiguous.
function dialogConfirmButton(): HTMLButtonElement {
  const btn = document.body.querySelector('.ui-dialog-content .ui-btn.danger')
  expect(btn, 'an open dialog with a destructive confirm button').toBeTruthy()
  return btn as HTMLButtonElement
}

describe('SharesPage multi-select batch unshare', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    localStorage.clear()
    listShares.mockReset()
    deleteShare.mockReset()
    deleteShare.mockResolvedValue(undefined)
    listShares.mockResolvedValue(ROWS)
    await testRouter.push('/files/shares')
    await testRouter.isReady()
  })

  afterEach(() => {
    w?.unmount()
    w = undefined
  })

  it('toolbar is hidden until a row is checked, then shows the count', async () => {
    const page = await mountPage()
    expect(page.find('.shares-sel-toolbar').exists()).toBe(false)
    await page.findAll('input.share-check-box')[0].setValue(true)
    expect(page.find('.shares-sel-toolbar').exists()).toBe(true)
    expect(page.find('.sel-count').text()).toBe('已选 1 项')
  })

  it('select-all checks every row; clear hides the toolbar again', async () => {
    const page = await mountPage()
    await page.findAll('input.share-check-box')[0].setValue(true)
    await page.find('.sel-all').trigger('click')
    expect(page.find('.sel-count').text()).toBe('已选 3 项')
    await page.find('.sel-clear').trigger('click')
    expect(page.find('.shares-sel-toolbar').exists()).toBe(false)
  })

  it('confirming the batch dialog deletes every selected id', async () => {
    const page = await mountPage()
    // Reload after removeMany returns only the surviving row.
    listShares.mockResolvedValue([ROWS[2]])
    await page.findAll('input.share-check-box')[0].setValue(true)
    await page.findAll('input.share-check-box')[1].setValue(true)
    await page.find('.sel-unshare').trigger('click')
    const msg = document.body.querySelector('.ui-alert-msg')
    expect(msg?.textContent).toContain('2 个文件夹')
    dialogConfirmButton().click()
    await flushPromises()
    expect(deleteShare).toHaveBeenCalledTimes(2)
    expect(deleteShare).toHaveBeenCalledWith(1)
    expect(deleteShare).toHaveBeenCalledWith(2)
    // Selection cleared, toolbar gone, list re-rendered from reload.
    expect(page.find('.shares-sel-toolbar').exists()).toBe(false)
    expect(page.findAll('.share-row')).toHaveLength(1)
  })

  it('failed ids stay selected after a partial failure', async () => {
    const page = await mountPage()
    deleteShare.mockImplementation(async (id: number) => {
      if (id === 2) throw new Error('boom')
    })
    // id 1 deleted, ids 2 and 3 remain on the server.
    listShares.mockResolvedValue([ROWS[1], ROWS[2]])
    await page.findAll('input.share-check-box')[0].setValue(true)
    await page.findAll('input.share-check-box')[1].setValue(true)
    await page.find('.sel-unshare').trigger('click')
    dialogConfirmButton().click()
    await flushPromises()
    // Only the failed id (2) is still selected → toolbar shows 1.
    expect(page.find('.sel-count').text()).toBe('已选 1 项')
    const checks = page.findAll('input.share-check-box')
    expect(checks).toHaveLength(2)
    expect((checks[0].element as HTMLInputElement).checked).toBe(true)  // id 2 (failed)
    expect((checks[1].element as HTMLInputElement).checked).toBe(false) // id 3 (untouched)
  })

  it('selection is pruned when rows disappear from a reload', async () => {
    const page = await mountPage()
    await page.findAll('input.share-check-box')[0].setValue(true) // select id 1
    // Single-row unshare of that same row via its own hover button + dialog.
    listShares.mockResolvedValue([ROWS[1], ROWS[2]])
    const unshareBtns = page.findAll('.share-act.danger')
    await unshareBtns[0].trigger('click')
    dialogConfirmButton().click()
    await flushPromises()
    // id 1 vanished from the reload; the stale selection must not survive.
    expect(page.find('.shares-sel-toolbar').exists()).toBe(false)
  })
})
