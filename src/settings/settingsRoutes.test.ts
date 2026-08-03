import { describe, it, expect, beforeEach } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import { settingsRoutes } from './settingsRoutes'
import { LAST_TAB_KEY } from './util/lastTab'
import { SETTINGS_TABS } from './util/tabs'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }, ...settingsRoutes],
  })
}

describe('设置区路由', () => {
  beforeEach(() => localStorage.clear())

  it('/settings 无记忆时重定向到 general', async () => {
    const r = makeRouter()
    await r.push('/settings')
    expect(r.currentRoute.value.path).toBe('/settings/general')
  })

  it('/settings 有记忆时重定向到上次 tab', async () => {
    localStorage.setItem(LAST_TAB_KEY, 'network')
    const r = makeRouter()
    await r.push('/settings')
    expect(r.currentRoute.value.path).toBe('/settings/network')
  })

  it('/settings 记忆是非法值时重定向到 general', async () => {
    localStorage.setItem(LAST_TAB_KEY, 'bogus')
    const r = makeRouter()
    await r.push('/settings')
    expect(r.currentRoute.value.path).toBe('/settings/general')
  })

  it('未知 :tab 重定向到 general(不是 404)', async () => {
    const r = makeRouter()
    await r.push('/settings/nope')
    expect(r.currentRoute.value.path).toBe('/settings/general')
  })

  it('9 个合法 tab 都能直接进(刷新保持)', async () => {
    for (const t of SETTINGS_TABS) {
      const r = makeRouter()
      await r.push('/settings/' + t)
      expect(r.currentRoute.value.path, t).toBe('/settings/' + t)
    }
  })

  it('路由有 name settings', async () => {
    const r = makeRouter()
    await r.push('/settings/apps')
    expect(r.currentRoute.value.name).toBe('settings')
  })
})
