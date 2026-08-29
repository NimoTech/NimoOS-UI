import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  compose: { install: vi.fn(), list: vi.fn().mockResolvedValue({}), get: vi.fn() },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))
vi.mock('../../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: vi.fn(() => () => {}) }) }))

import { useCustomInstall } from './useCustomInstall'
import { useInstallProgressStore } from '../stores/installProgress'
import { useInstalledAppsStore } from '../stores/installedApps'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// Composable depends on useI18n → must be called inside component setup (repo convention, same as useInstallFlow.test.ts)
function mountFlow() {
  let flow!: ReturnType<typeof useCustomInstall>
  mount(defineComponent({ setup() { flow = useCustomInstall(); return () => null } }), {
    global: { plugins: [i18n] },
  })
  return flow
}

const NAMELESS = 'services:\n  sonarr:\n    image: linuxserver/sonarr:latest\n'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear() // installProgress tasks persist to disk; without clearing they recover cross-test
  svc.compose.install.mockReset().mockResolvedValue(undefined)
})

describe('useCustomInstall.installYaml', () => {
  it('YAML without name gets auto-named and tracked (icon no longer injects dead link domain, user-specified empty is empty)', async () => {
    const flow = mountFlow()
    const progress = useInstallProgressStore()
    const res = await flow.installYaml(NAMELESS)
    expect(res).toEqual({ ok: true, name: 'sonarr' })
    expect(progress.tasks['sonarr']).toMatchObject({
      title: 'sonarr',
      icon: '',
      state: 'installing',
    })
  })

  it('success path: dry_run → install → track in order', async () => {
    const flow = mountFlow()
    const progress = useInstallProgressStore()
    await flow.installYaml(NAMELESS)
    expect(svc.compose.install).toHaveBeenNthCalledWith(1, expect.stringContaining('sonarr'), { dryRun: true, checkPortConflict: true })
    expect(svc.compose.install).toHaveBeenNthCalledWith(2, expect.stringContaining('sonarr'), { checkPortConflict: true })
    expect(progress.tasks['sonarr']).toBeDefined()
  })

  it('same name already installed (D4) → ok:false prompt rename, no install calls issued', async () => {
    const flow = mountFlow()
    const installed = useInstalledAppsStore()
    installed.apps = [{ id: 'sonarr', title: 'Sonarr', icon: '', status: 'running', updateAvailable: false, isUncontrolled: false, webUrl: null }]
    // installYaml now unconditionally refreshes (D4 fix); refresh will use this mock list to overwrite store—
    // keep it containing sonarr to verify that "unconditional refresh" does not clear the preset conflict scenario.
    svc.compose.list.mockResolvedValueOnce({ sonarr: { store_info: {}, status: 'running' } })
    const res = await flow.installYaml(NAMELESS)
    expect(res.ok).toBe(false)
    expect(svc.compose.install).not.toHaveBeenCalled()
    expect(useInstallProgressStore().tasks['sonarr']).toBeUndefined()
  })

  it('store non-empty but stale (lacking same-name app installed elsewhere) → still detects D4 conflict after unconditional refresh (regression test: prevent guard from being bypassed by "non-empty skip refresh" when second tab/old UI installs same name)', async () => {
    const flow = mountFlow()
    const installed = useInstalledAppsStore()
    // store non-empty (has other installed apps) but lacks sonarr—simulate "user has this page open, another tab/old UI installed the same-name app".
    installed.apps = [{ id: 'other-app', title: 'Other', icon: '', status: 'running', updateAvailable: false, isUncontrolled: false, webUrl: null }]
    svc.compose.list.mockResolvedValueOnce({
      'other-app': { store_info: {}, status: 'running' },
      sonarr: { store_info: {}, status: 'running' },
    })
    const res = await flow.installYaml(NAMELESS)
    expect(res.ok).toBe(false)
    expect(svc.compose.install).not.toHaveBeenCalled()
    expect(useInstallProgressStore().tasks['sonarr']).toBeUndefined()
  })

  it('deep link empty store → refresh backfill → D4 name conflict detected (regression test: prevent deep link from bypassing guard)', async () => {
    // store initially empty; refresh will pull the installed list; this prevents deep link /apps/custom from circumventing the name-conflict guard when store is uninitialized
    svc.compose.list.mockResolvedValueOnce({
      sonarr: { store_info: {}, status: 'running' },
    })
    const flow = mountFlow()
    const installed = useInstalledAppsStore()
    // verify that initially it is indeed empty
    expect(installed.apps).toEqual([])
    const res = await flow.installYaml(NAMELESS)
    // refresh triggered by installYaml, conflict detected after backfilling the list
    expect(res.ok).toBe(false)
    expect(svc.compose.install).not.toHaveBeenCalled()
    expect(useInstallProgressStore().tasks['sonarr']).toBeUndefined()
  })

  it('YAML parse fails → ok:false, no install issued', async () => {
    const flow = mountFlow()
    const res = await flow.installYaml(': not: valid: yaml: [')
    expect(res.ok).toBe(false)
    expect(svc.compose.install).not.toHaveBeenCalled()
  })

  it('dry_run 400 port conflict → ok:false, ports normalized (same port/proto as parseInstallError)', async () => {
    svc.compose.install.mockRejectedValueOnce({
      response: { data: { message: 'conflict', data: { ports_in_use: { tcp: [8080] } } } },
    })
    const flow = mountFlow()
    const res = await flow.installYaml(NAMELESS)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.ports).toEqual(['8080/tcp'])
      expect(res.message).toBe('conflict')
    }
    expect(svc.compose.install).toHaveBeenCalledTimes(1) // dry_run failed, real install not issued
    expect(useInstallProgressStore().tasks['sonarr']).toBeUndefined()
  })

  it('real install (second install) fails → ok:false, not tracked', async () => {
    svc.compose.install
      .mockResolvedValueOnce(undefined) // dry_run passes
      .mockRejectedValueOnce({ response: { data: { message: 'boom' } } }) // real install fails
    const flow = mountFlow()
    const res = await flow.installYaml(NAMELESS)
    expect(res.ok).toBe(false)
    expect(useInstallProgressStore().tasks['sonarr']).toBeUndefined()
  })
})

describe('useCustomInstall.validateYaml', () => {
  it('success → ok:true, no real install issued (dry_run only)', async () => {
    const flow = mountFlow()
    const res = await flow.validateYaml(NAMELESS)
    expect(res).toEqual({ ok: true })
    expect(svc.compose.install).toHaveBeenCalledTimes(1)
    expect(svc.compose.install).toHaveBeenCalledWith(expect.stringContaining('sonarr'), { dryRun: true, checkPortConflict: true })
  })

  it('YAML parse fails → ok:false, no dry_run issued', async () => {
    const flow = mountFlow()
    const res = await flow.validateYaml('not a yaml doc: [')
    expect(res.ok).toBe(false)
    expect(svc.compose.install).not.toHaveBeenCalled()
  })

  it('dry_run 400 → ok:false + ports', async () => {
    svc.compose.install.mockRejectedValueOnce({
      response: { data: { message: 'conflict', data: { ports_in_use: { tcp: [80] } } } },
    })
    const flow = mountFlow()
    const res = await flow.validateYaml(NAMELESS)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.ports).toEqual(['80/tcp'])
  })

  it('same name already installed — validateYaml does not enforce D4 hard block (only does ① + ③, validation pass does not mean installable)', async () => {
    const flow = mountFlow()
    const installed = useInstalledAppsStore()
    installed.apps = [{ id: 'sonarr', title: 'Sonarr', icon: '', status: 'running', updateAvailable: false, isUncontrolled: false, webUrl: null }]
    const res = await flow.validateYaml(NAMELESS)
    expect(res).toEqual({ ok: true })
  })
})
