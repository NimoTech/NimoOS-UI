import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import YAML from 'yaml'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  getYaml: vi.fn(), applySettings: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { compose: svc } }))
import { useAppSettings } from './useAppSettings'

const Y = 'services:\n  demo:\n    image: img:1\n    ports: ["80:80"]\n'
const Y_WITH_TIP = `services:
  demo:
    image: img:1
    ports: ["80:80"]
x-nimoos:
  tips:
    before_install:
      zh_cn: 先看文档
`
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// useAppSettings 依赖 useI18n → 需在组件 setup 内调用(仓内 composable 测试惯例,同 useInstallFlow.test.ts)
function mountSettings(id: Ref<string>) {
  let s!: ReturnType<typeof useAppSettings>
  mount(defineComponent({ setup() { s = useAppSettings(id); return () => null } }), {
    global: { plugins: [i18n] },
  })
  return s
}

describe('useAppSettings', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('load parses yaml into model', async () => {
    svc.getYaml.mockResolvedValue(Y)
    const s = mountSettings(ref('demo'))
    await s.load()
    expect(s.model.value?.services[0].image).toBe('img:1')
  })

  it('save: dry_run first, then real PUT, marks pending, returns true', async () => {
    svc.getYaml.mockResolvedValue(Y)
    svc.applySettings.mockResolvedValue(undefined)
    const s = mountSettings(ref('demo'))
    await s.load()
    const ok = await s.save()
    expect(ok).toBe(true)
    expect(svc.applySettings).toHaveBeenCalledTimes(2)
    expect(svc.applySettings.mock.calls[0][2]).toMatchObject({ dryRun: true, checkPortConflict: true })
    expect(svc.applySettings.mock.calls[1][2]).toMatchObject({ checkPortConflict: true })
  })

  it('save: dry_run 400 ports_in_use -> conflicts populated, no real PUT, returns false', async () => {
    svc.getYaml.mockResolvedValue(Y)
    svc.applySettings.mockRejectedValueOnce({ response: { status: 400, data: { message: 'there are ports in use', data: { ports_in_use: { TCP: ['80'] } } } } })
    const s = mountSettings(ref('demo'))
    await s.load()
    const ok = await s.save()
    expect(ok).toBe(false)
    expect(s.conflicts.value).toEqual(['80/tcp'])
    expect(svc.applySettings).toHaveBeenCalledTimes(1)
  })

  it('save without touching tips: before_install fallback text is not frozen into tips.custom', async () => {
    svc.getYaml.mockResolvedValue(Y_WITH_TIP)
    svc.applySettings.mockResolvedValue(undefined)
    const s = mountSettings(ref('demo'))
    await s.load()
    expect(s.model.value?.tipsCustom).toBe('先看文档')      // 预填 UI 用途
    expect(s.model.value?.tipsFromFallback).toBe(true)
    // 用户只改了端口,从未碰 tips 字段
    s.model.value!.services[0].ports[0].published = '8080'
    await s.save()
    const yamlSent = svc.applySettings.mock.calls[0][1] as string
    expect(YAML.parse(yamlSent)['x-nimoos']?.tips?.custom).toBeUndefined()
    expect(YAML.parse(yamlSent)['x-nimoos']?.tips?.before_install).toBeDefined()
  })

  it('save after user edits tips text: the edited text is written as tips.custom', async () => {
    svc.getYaml.mockResolvedValue(Y_WITH_TIP)
    svc.applySettings.mockResolvedValue(undefined)
    const s = mountSettings(ref('demo'))
    await s.load()
    s.model.value!.tipsCustom = '改端口后记得重登'
    await s.save()
    const yamlSent = svc.applySettings.mock.calls[0][1] as string
    expect(YAML.parse(yamlSent)['x-nimoos']?.tips?.custom).toBe('改端口后记得重登')
  })
})
