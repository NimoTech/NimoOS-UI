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

describe('settings section routes', () => {
  beforeEach(() => localStorage.clear())

  it('/settings redirects to general when there is no memory', async () => {
    const r = makeRouter()
    await r.push('/settings')
    expect(r.currentRoute.value.path).toBe('/settings/general')
  })

  it('/settings redirects to the last tab when there is memory', async () => {
    localStorage.setItem(LAST_TAB_KEY, 'network')
    const r = makeRouter()
    await r.push('/settings')
    expect(r.currentRoute.value.path).toBe('/settings/network')
  })

  it('/settings redirects to general when the memory is an invalid value', async () => {
    localStorage.setItem(LAST_TAB_KEY, 'bogus')
    const r = makeRouter()
    await r.push('/settings')
    expect(r.currentRoute.value.path).toBe('/settings/general')
  })

  it('an unknown :tab redirects to general (not a 404)', async () => {
    const r = makeRouter()
    await r.push('/settings/nope')
    expect(r.currentRoute.value.path).toBe('/settings/general')
  })

  it('all 9 valid tabs can be entered directly (survives a refresh)', async () => {
    for (const t of SETTINGS_TABS) {
      const r = makeRouter()
      await r.push('/settings/' + t)
      expect(r.currentRoute.value.path, t).toBe('/settings/' + t)
    }
  })

  it('the route has name settings', async () => {
    const r = makeRouter()
    await r.push('/settings/apps')
    expect(r.currentRoute.value.name).toBe('settings')
  })
})
