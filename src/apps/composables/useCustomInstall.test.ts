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

// composable 依赖 useI18n → 必须在组件 setup 内调用(仓内惯例,同 useInstallFlow.test.ts)
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
  localStorage.clear() // installProgress 任务表落盘,不清会跨用例恢复出上个用例的任务
  svc.compose.install.mockReset().mockResolvedValue(undefined)
})

describe('useCustomInstall.installYaml', () => {
  it('无 name YAML 自动得名并 track(icon 不再注入死链域名,用户没写就是空)', async () => {
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

  it('成功链:dry_run → install → track 顺序', async () => {
    const flow = mountFlow()
    const progress = useInstallProgressStore()
    await flow.installYaml(NAMELESS)
    expect(svc.compose.install).toHaveBeenNthCalledWith(1, expect.stringContaining('sonarr'), { dryRun: true, checkPortConflict: true })
    expect(svc.compose.install).toHaveBeenNthCalledWith(2, expect.stringContaining('sonarr'), { checkPortConflict: true })
    expect(progress.tasks['sonarr']).toBeDefined()
  })

  it('同名已装(D4)→ ok:false 提示改名,不发任何 install 调用', async () => {
    const flow = mountFlow()
    const installed = useInstalledAppsStore()
    installed.apps = [{ id: 'sonarr', title: 'Sonarr', icon: '', status: 'running', updateAvailable: false, isUncontrolled: false, webUrl: null }]
    // installYaml 现在无条件 refresh(D4 修复),refresh 会拿这次 mock 的列表覆盖 store——
    // 让它照样含 sonarr,验证「无条件刷新」不会把预置的冲突场景刷没。
    svc.compose.list.mockResolvedValueOnce({ sonarr: { store_info: {}, status: 'running' } })
    const res = await flow.installYaml(NAMELESS)
    expect(res.ok).toBe(false)
    expect(svc.compose.install).not.toHaveBeenCalled()
    expect(useInstallProgressStore().tasks['sonarr']).toBeUndefined()
  })

  it('store 非空但陈旧(不含刚被别处装上的同名应用)→ 无条件 refresh 后仍检出 D4 冲突(回归测试:防第二标签页/旧版 UI 装同名后本 store 未感知,守卫被"非空即跳过刷新"绕过)', async () => {
    const flow = mountFlow()
    const installed = useInstalledAppsStore()
    // store 非空(有别的已装应用),但不含 sonarr——模拟"用户开着这个页面挂着,另一个标签页/旧版 UI 装了同名应用"。
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

  it('深链空 store → refresh 补拉 → D4 同名检出(回归测试:防深链绕过守卫)', async () => {
    // store 初始空,refresh 会拉已装列表;这防止深链 /apps/custom 时 store 未初始化导致名冲突守卫失效
    svc.compose.list.mockResolvedValueOnce({
      sonarr: { store_info: {}, status: 'running' },
    })
    const flow = mountFlow()
    const installed = useInstalledAppsStore()
    // 验证初始确实为空
    expect(installed.apps).toEqual([])
    const res = await flow.installYaml(NAMELESS)
    // refresh 被 installYaml 触发,补拉列表后检出冲突
    expect(res.ok).toBe(false)
    expect(svc.compose.install).not.toHaveBeenCalled()
    expect(useInstallProgressStore().tasks['sonarr']).toBeUndefined()
  })

  it('YAML 解析失败 → ok:false,不发 install', async () => {
    const flow = mountFlow()
    const res = await flow.installYaml(': not: valid: yaml: [')
    expect(res.ok).toBe(false)
    expect(svc.compose.install).not.toHaveBeenCalled()
  })

  it('dry_run 400 端口冲突 → ok:false,ports 归一化(parseInstallError 同款 port/proto)', async () => {
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
    expect(svc.compose.install).toHaveBeenCalledTimes(1) // dry_run 挂了,真装不发
    expect(useInstallProgressStore().tasks['sonarr']).toBeUndefined()
  })

  it('真装(第二次 install)失败 → ok:false,不 track', async () => {
    svc.compose.install
      .mockResolvedValueOnce(undefined) // dry_run 过
      .mockRejectedValueOnce({ response: { data: { message: 'boom' } } }) // 真装挂
    const flow = mountFlow()
    const res = await flow.installYaml(NAMELESS)
    expect(res.ok).toBe(false)
    expect(useInstallProgressStore().tasks['sonarr']).toBeUndefined()
  })
})

describe('useCustomInstall.validateYaml', () => {
  it('成功 → ok:true,不发真装(只 dry_run)', async () => {
    const flow = mountFlow()
    const res = await flow.validateYaml(NAMELESS)
    expect(res).toEqual({ ok: true })
    expect(svc.compose.install).toHaveBeenCalledTimes(1)
    expect(svc.compose.install).toHaveBeenCalledWith(expect.stringContaining('sonarr'), { dryRun: true, checkPortConflict: true })
  })

  it('YAML 解析失败 → ok:false,不发 dry_run', async () => {
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

  it('同名已装 —— validateYaml 不做 D4 硬挡(只做①+③,校验通过不代表能装)', async () => {
    const flow = mountFlow()
    const installed = useInstalledAppsStore()
    installed.apps = [{ id: 'sonarr', title: 'Sonarr', icon: '', status: 'running', updateAvailable: false, isUncontrolled: false, webUrl: null }]
    const res = await flow.validateYaml(NAMELESS)
    expect(res).toEqual({ ok: true })
  })
})
