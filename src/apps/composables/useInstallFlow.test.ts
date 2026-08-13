import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  appstore: { getAppCompose: vi.fn() },
  compose: { install: vi.fn(), list: vi.fn().mockResolvedValue({}), get: vi.fn() },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))
vi.mock('../../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: vi.fn(() => () => {}) }) }))

import { useInstallFlow, beforeInstallText, parseInstallError, type InstallCandidate } from './useInstallFlow'
import { useInstallProgressStore } from '../stores/installProgress'
import { useToast } from '../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// useInstallFlow depends on useI18n → must be called inside a component setup (repo convention for composable tests)
function mountFlow() {
  let flow!: ReturnType<typeof useInstallFlow>
  mount(defineComponent({ setup() { flow = useInstallFlow(); return () => null } }), {
    global: { plugins: [i18n] },
  })
  return flow
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear() // installProgress persists its task table; without clearing, tasks leak across test cases
  svc.appstore.getAppCompose.mockReset().mockResolvedValue('services: {}')
  svc.compose.install.mockReset().mockResolvedValue(undefined)
})

describe('beforeInstallText', () => {
  it('null/缺失 → 空串;命中本语言;en_US 大写键 fallback(resolveAppText)', () => {
    expect(beforeInstallText(null, 'zh_cn')).toBe('')
    expect(beforeInstallText({ before_install: null }, 'zh_cn')).toBe('')
    expect(beforeInstallText({ before_install: { zh_cn: '注意' } }, 'zh_cn')).toBe('注意')
    expect(beforeInstallText({ before_install: { en_US: 'note' } }, 'zh_cn')).toBe('note')
  })
})

describe('parseInstallError', () => {
  it('提取 message + ports_in_use(容忍 tcp/TCP 大小写与数组形态)', () => {
    const e = { response: { data: { message: 'conflict', data: { ports_in_use: { TCP: [80], udp: [53] } } } } }
    expect(parseInstallError(e)).toEqual({ message: 'conflict', ports: ['80/tcp', '53/udp'] })
    expect(parseInstallError({ response: { data: { message: 'bad yaml' } } })).toEqual({ message: 'bad yaml', ports: [] })
    expect(parseInstallError(new Error('net'))).toEqual({ message: '', ports: [] })
  })
})

describe('useInstallFlow', () => {
  const app: InstallCandidate = { id: 'jellyfin', title: 'Jellyfin', icon: 'i.png' }

  it('无 tips 直装:getAppCompose → dry_run → install → track', async () => {
    const flow = mountFlow()
    const progress = useInstallProgressStore()
    flow.requestInstall(app)
    await flushPromises()
    expect(svc.appstore.getAppCompose).toHaveBeenCalledWith('jellyfin')
    expect(svc.compose.install).toHaveBeenNthCalledWith(1, 'services: {}', { dryRun: true, checkPortConflict: true })
    expect(svc.compose.install).toHaveBeenNthCalledWith(2, 'services: {}', { checkPortConflict: true })
    expect(progress.tasks['jellyfin']).toMatchObject({ title: 'Jellyfin', icon: 'i.png' })
  })

  it('有 tips 先弹确认;confirm 先读后关再装(P1 reka 前车之鉴)', async () => {
    const flow = mountFlow()
    flow.requestInstall({ ...app, tips: { before_install: { zh_cn: '先看这个' } } })
    expect(flow.tipsDlg.value.open).toBe(true)
    expect(flow.tipsDlg.value.text).toBe('先看这个')
    expect(svc.compose.install).not.toHaveBeenCalled()
    flow.confirmTips()
    await flushPromises()
    expect(svc.compose.install).toHaveBeenCalledTimes(2)
    expect(flow.tipsDlg.value.open).toBe(false)
  })

  it('dry_run 400 → toast、不发真装、不 track', async () => {
    svc.compose.install.mockRejectedValueOnce({ response: { data: { message: 'invalid compose' } } })
    const flow = mountFlow()
    const toast = useToast()
    const spy = vi.spyOn(toast, 'show')
    flow.requestInstall(app)
    await flushPromises()
    expect(svc.compose.install).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('invalid compose', 5000)
    expect(useInstallProgressStore().tasks['jellyfin']).toBeUndefined()
  })

  it('端口冲突 → appsInstallPortConflict 文案', async () => {
    svc.compose.install.mockRejectedValueOnce({
      response: { data: { message: 'conflict', data: { ports_in_use: { tcp: [80] } } } },
    })
    const flow = mountFlow()
    const spy = vi.spyOn(useToast(), 'show')
    flow.requestInstall(app)
    await flushPromises()
    expect(spy.mock.calls[0][0]).toContain('80/tcp')
  })

  it('安装中重复 requestInstall 被忽略;error 态可重装(track 覆盖)', async () => {
    const flow = mountFlow()
    const progress = useInstallProgressStore()
    flow.requestInstall(app)
    await flushPromises()
    flow.requestInstall(app)
    await flushPromises()
    expect(svc.compose.install).toHaveBeenCalledTimes(2) // Still the 2 calls from the first round
    progress.onEvent('app:install-error', { 'app:name': 'jellyfin', message: 'x' })
    flow.requestInstall(app)
    await flushPromises()
    expect(svc.compose.install).toHaveBeenCalledTimes(4)
    expect(progress.tasks['jellyfin'].state).toBe('installing')
  })
})
