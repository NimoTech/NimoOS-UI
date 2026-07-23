import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { defineComponent } from 'vue'
import StorageShell from './StorageShell.vue'

const Stub = defineComponent({ template: '<div />' })

async function mountShell(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Stub },
      { path: '/storage', component: Stub },
      { path: '/storage/drives', component: Stub },
      { path: '/storage/raid', component: Stub },
      { path: '/storage/raid/:id', component: Stub },
    ],
  })
  await router.push(path)
  await router.isReady()
  const w = mount(StorageShell, { global: { plugins: [router] }, slots: { default: '<p class="probe">body</p>' } })
  return { w, router }
}

describe('StorageShell', () => {
  it('渲染标题、三个页签和 slot 内容', async () => {
    const { w } = await mountShell('/storage')
    expect(w.find('.st-title').exists()).toBe(true)
    expect(w.findAll('.st-tab')).toHaveLength(3)
    expect(w.find('.probe').text()).toBe('body')
  })
  it('当前路由的页签带 active', async () => {
    const { w } = await mountShell('/storage/drives')
    const tabs = w.findAll('.st-tab')
    expect(tabs[0].classes()).not.toContain('active')
    expect(tabs[1].classes()).toContain('active')
    expect(tabs[2].classes()).not.toContain('active')
  })
  it('RAID 详情页(startsWith)也高亮 RAID 页签', async () => {
    const { w } = await mountShell('/storage/raid/9')
    const tabs = w.findAll('.st-tab')
    expect(tabs[2].classes()).toContain('active')
  })
  it('回主页按钮 push /', async () => {
    const { w, router } = await mountShell('/storage')
    await w.find('.st-home').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
  })
})
