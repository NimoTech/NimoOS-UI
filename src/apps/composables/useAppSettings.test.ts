import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import YAML from 'yaml'
import zh from '../../i18n/zh_cn'
import { parseSettings } from '../util/composeSettings'

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

// useAppSettings depends on useI18n → must be called inside a component setup (repo convention for composable tests, same as useInstallFlow.test.ts)
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
    expect(s.model.value?.tipsCustom).toBe('先看文档')      // prefilled for UI display
    expect(s.model.value?.tipsFromFallback).toBe(true)
    // the user only changed a port, never touched the tips field
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

  it('toYaml round-trips: load → toYaml → parse yields an equivalent model', async () => {
    svc.getYaml.mockResolvedValue(Y)
    const s = mountSettings(ref('demo'))
    await s.load()
    const yamlText = s.toYaml()
    const reparsed = parseSettings(yamlText, 'zh_cn')
    expect(reparsed).toEqual(s.model.value)
  })

  it('toYaml carries form edits made before switching to the YAML tab', async () => {
    svc.getYaml.mockResolvedValue(Y)
    const s = mountSettings(ref('demo'))
    await s.load()
    s.model.value!.services[0].image = 'img:2'
    const yamlText = s.toYaml()
    expect(YAML.parse(yamlText).services.demo.image).toBe('img:2')
  })

  it('replaceFromYaml: bad text returns false, sets parseError, does not touch model', async () => {
    svc.getYaml.mockResolvedValue(Y)
    const s = mountSettings(ref('demo'))
    await s.load()
    const before = s.model.value
    const ok = s.replaceFromYaml('services:\n  demo:\n  bad indent\n- broken: [')
    expect(ok).toBe(false)
    expect(s.parseError.value).toBeTruthy()
    expect(s.model.value).toBe(before) // same reference, not rebuilt
  })

  it('replaceFromYaml: good text rebuilds model and becomes the new base for save()', async () => {
    svc.getYaml.mockResolvedValue(Y)
    svc.applySettings.mockResolvedValue(undefined)
    const s = mountSettings(ref('demo'))
    await s.load()
    const edited = 'services:\n  demo:\n    image: img:9\n    ports: ["80:80"]\n'
    const ok = s.replaceFromYaml(edited)
    expect(ok).toBe(true)
    expect(s.parseError.value).toBe('')
    expect(s.model.value?.services[0].image).toBe('img:9')
    await s.save()
    const yamlSent = svc.applySettings.mock.calls[0][1] as string
    expect(YAML.parse(yamlSent).services.demo.image).toBe('img:9')
  })

  it('saveYaml: dry_run first, then real PUT, returns true', async () => {
    svc.getYaml.mockResolvedValue(Y)
    svc.applySettings.mockResolvedValue(undefined)
    const s = mountSettings(ref('demo'))
    await s.load()
    const raw = 'services:\n  demo:\n    image: img:3\n'
    const ok = await s.saveYaml(raw)
    expect(ok).toBe(true)
    expect(svc.applySettings).toHaveBeenCalledTimes(2)
    expect(svc.applySettings.mock.calls[0]).toEqual(['demo', raw, { dryRun: true, checkPortConflict: true }])
    expect(svc.applySettings.mock.calls[1]).toEqual(['demo', raw, { checkPortConflict: true }])
  })

  it('saveYaml: dry_run 400 ports_in_use -> conflicts populated, no real PUT, returns false', async () => {
    svc.getYaml.mockResolvedValue(Y)
    svc.applySettings.mockRejectedValueOnce({ response: { status: 400, data: { message: 'there are ports in use', data: { ports_in_use: { TCP: ['80'] } } } } })
    const s = mountSettings(ref('demo'))
    await s.load()
    const ok = await s.saveYaml('services:\n  demo:\n    image: img:3\n')
    expect(ok).toBe(false)
    expect(s.conflicts.value).toEqual(['80/tcp'])
    expect(svc.applySettings).toHaveBeenCalledTimes(1)
  })
})
