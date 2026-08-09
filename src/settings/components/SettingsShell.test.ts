/// <reference types="node" />
// 显式引 node 类型而不是往 tsconfig 的 types 数组里加 "node"(同 color-guard.test.ts)。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { defineComponent } from 'vue'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'
import type { SettingsTab } from '../util/tabs'

// PowerFlow(填入 .set-rail-foot,task 9)引入了 service.sys.power —— 最小 mock,
// 这个测试文件不关心电源流本身(有 PowerFlow.test.ts 专门测),只关心它渲染出来了。
vi.mock('@nimotech/nimoos-service', () => ({ service: { sys: { power: async () => {} } } }))

import SettingsShell from './SettingsShell.vue'

const Stub = defineComponent({ template: '<div />' })
const i18n = createI18n({
  legacy: false,
  locale: 'zh_cn',
  messages: { zh_cn: { ...zh, ...zhSp9 } },
})

async function mountShell(current: SettingsTab = 'general') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Stub },
      { path: '/settings/:tab', component: Stub },
    ],
  })
  await router.push('/settings/' + current)
  await router.isReady()
  const w = mount(SettingsShell, {
    props: { current },
    global: { plugins: [router, i18n] },
    slots: { default: '<p class="probe">body</p>' },
  })
  return { w, router }
}

describe('SettingsShell', () => {
  beforeEach(() => localStorage.clear())

  it('渲染标题与 slot 内容', async () => {
    const { w } = await mountShell()
    expect(w.find('.set-title').text()).toBe('设置')
    expect(w.find('.probe').text()).toBe('body')
  })

  it('非 admin(无 user)rail 只有 7 项', async () => {
    const { w } = await mountShell()
    expect(w.findAll('.set-rail-item')).toHaveLength(7)
  })

  it('admin rail 有 8 项且含 folder-permissions', async () => {
    localStorage.setItem('user', JSON.stringify({ username: 'nimo', role: 'admin' }))
    const { w } = await mountShell()
    const items = w.findAll('.set-rail-item')
    expect(items).toHaveLength(8)
    expect(items.map((i) => i.attributes('data-tab'))).toContain('folder-permissions')
  })

  it('当前 tab 的 rail 项带 active', async () => {
    localStorage.setItem('user', JSON.stringify({ username: 'nimo', role: 'admin' }))
    const { w } = await mountShell('network')
    const active = w.findAll('.set-rail-item').filter((i) => i.classes().includes('active'))
    expect(active).toHaveLength(1)
    expect(active[0].attributes('data-tab')).toBe('network')
  })

  it('点 rail 项 emit select', async () => {
    const { w } = await mountShell()
    await w.findAll('.set-rail-item')[2].trigger('click')
    expect(w.emitted('select')).toEqual([['network']])
  })

  it('account 不在 rail 上,入口是顶部用户块(对位 Vue2 L13-20)', async () => {
    const { w } = await mountShell()
    expect(w.findAll('.set-rail-item').map((i) => i.attributes('data-tab'))).not.toContain('account')
    await w.find('.set-user').trigger('click')
    expect(w.emitted('select')).toEqual([['account']])
  })

  it('developer 不在 rail 上(入口在 general 页内)', async () => {
    localStorage.setItem('user', JSON.stringify({ role: 'admin' }))
    const { w } = await mountShell()
    expect(w.findAll('.set-rail-item').map((i) => i.attributes('data-tab'))).not.toContain(
      'developer',
    )
  })

  it('用户块显示 nickname,缺失时退 username,再缺退 admin(Vue2 L18 同款回落链)', async () => {
    localStorage.setItem('user', JSON.stringify({ nickname: '小明', username: 'nimo' }))
    let m = await mountShell()
    expect(m.w.find('.set-user-name').text()).toBe('小明')

    localStorage.setItem('user', JSON.stringify({ username: 'nimo' }))
    m = await mountShell()
    expect(m.w.find('.set-user-name').text()).toBe('nimo')

    localStorage.removeItem('user')
    m = await mountShell()
    expect(m.w.find('.set-user-name').text()).toBe('admin')
  })

  it('user 存了坏 JSON 不炸,按无用户处理', async () => {
    localStorage.setItem('user', '{not json')
    const { w } = await mountShell()
    expect(w.find('.set-user-name').text()).toBe('admin')
    expect(w.findAll('.set-rail-item')).toHaveLength(7)
  })

  it('回主页按钮 push /', async () => {
    const { w, router } = await mountShell()
    await w.find('.set-home').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('侧栏底部有电源按钮(P0 的空容器已填)', async () => {
    const { w } = await mountShell()
    expect(w.find('.set-rail-foot .pf-shutdown').exists()).toBe(true)
    expect(w.find('.set-rail-foot .pf-restart').exists()).toBe(true)
  })
})

describe('窄屏设置侧栏有可滚动提示', () => {
  it('.set-rail-list 的窄屏分支带边缘渐隐遮罩', () => {
    const src = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), './SettingsShell.vue'),
      'utf8',
    )
    // 只看窄屏媒体查询那一段:宽屏是纵向排列,不需要提示。
    const narrow = src.slice(src.indexOf('@media'))
    const rail = narrow.slice(narrow.indexOf('.set-rail-list'))
    expect(rail).toContain('overflow-x: auto') // 防空转:布局改了就该红
    expect(rail).toMatch(/mask-image/)
  })
})
