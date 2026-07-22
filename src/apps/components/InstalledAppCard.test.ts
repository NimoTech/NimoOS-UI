import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import InstalledAppCard from './InstalledAppCard.vue'
import type { InstalledApp } from '../stores/installedApps'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// AppActionsMenu 是 Portal 组件,stub 成直接渲染 menu slot。
// 真实 DropdownMenuItem 在 setup() 里 inject MenuRootContext(由真实 DropdownMenuRoot 提供),
// stub 掉 Root 后挂载会抛 "must be used within MenuRoot"(FileContextMenu.test 同款坑)——
// 连 Item/Separator 一起 stub,只验证"渲染哪些项 + 点击 emit"这层纯条件逻辑,定位/键盘留真机验。
const MenuStub = { template: '<div class="menu"><slot name="menu" /></div>' }
const ItemStub = { emits: ['select'], template: '<div @click="$emit(\'select\')"><slot /></div>' }

const BASE: InstalledApp = {
  id: 'jellyfin', title: 'Jellyfin', icon: 'https://cdn/i.svg',
  status: 'running', updateAvailable: false, isUncontrolled: false,
  webUrl: 'http://h:8096/',
}

function mountCard(app: Partial<InstalledApp> = {}, pendingOp?: 'start' | 'stop' | 'restart' | 'update' | 'uninstall') {
  return mount(InstalledAppCard, {
    props: { app: { ...BASE, ...app }, pendingOp },
    global: {
      plugins: [i18n],
      stubs: { AppActionsMenu: MenuStub, DropdownMenuItem: ItemStub, DropdownMenuSeparator: true },
    },
  })
}

describe('InstalledAppCard', () => {
  it('running:主按钮=打开(emit open),菜单含 停止/重启/检查并更新/卸载', async () => {
    const w = mountCard()
    await w.get('.card-primary').trigger('click')
    expect(w.emitted('open')).toBeTruthy()
    const menu = w.get('.menu').text()
    expect(menu).toContain('停止')
    expect(menu).toContain('重启')
    expect(menu).toContain('检查并更新')
    expect(menu).toContain('卸载')
    expect(menu).not.toContain('启动')
  })

  it('exited:主按钮=启动(emit action start),菜单无 停止/重启', async () => {
    const w = mountCard({ status: 'exited', webUrl: 'http://h:8096/' })
    await w.get('.card-primary').trigger('click')
    expect(w.emitted('action')![0]).toEqual(['start'])
    const menu = w.get('.menu').text()
    expect(menu).not.toContain('停止')
    expect(menu).not.toContain('重启')
  })

  it('running 但无 webUrl:主按钮禁用', () => {
    const w = mountCard({ webUrl: null })
    expect(w.get('.card-primary').attributes('disabled')).toBeDefined()
  })

  it('is_uncontrolled:菜单无 检查并更新;update_available 显示徽标', () => {
    const w = mountCard({ isUncontrolled: true, updateAvailable: true })
    expect(w.get('.menu').text()).not.toContain('检查并更新')
    expect(w.text()).toContain('可更新')
  })

  it('menu has settings item that emits settings', async () => {
    const w = mountCard()
    const items = w.get('.menu').findAll('div')
    const settingsItem = items.find((it) => it.text() === '设置')
    expect(settingsItem).toBeTruthy()
    await settingsItem!.trigger('click')
    expect(w.emitted('settings')).toHaveLength(1)
  })

  it('⋮ 菜单含「终端与日志」,点击 emit console', async () => {
    const w = mountCard()
    const items = w.get('.menu').findAll('div')
    const consoleItem = items.find((it) => it.text() === '终端与日志')
    expect(consoleItem).toBeTruthy()
    await consoleItem!.trigger('click')
    expect(w.emitted('console')).toHaveLength(1)
  })

  it('pending:卡片处理中态,主按钮禁用', () => {
    const w = mountCard({}, 'restart')
    expect(w.text()).toContain('处理中')
    expect(w.get('.card-primary').attributes('disabled')).toBeDefined()
  })

  it('状态标签映射:running=运行中,exited=已停止,unknown=未知', () => {
    expect(mountCard().text()).toContain('运行中')
    expect(mountCard({ status: 'exited' }).text()).toContain('已停止')
    expect(mountCard({ status: 'unknown' }).text()).toContain('未知')
  })
})
