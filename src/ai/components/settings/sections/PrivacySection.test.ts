// SP8-P2a Task 11 — 移植自 Vue2 src/views/AI/Settings/sections/PrivacySection.vue
// (74 行)。brief Step 1 的 10 条用例清单,逐条落地。
//
// 真 store(setActivePinia + useSettingsStore()),不 mock @nimotech/nimoos-service
// —— 组件从不直接调 service,只调 store.updatePolicyField,spy 该方法即可隔离网络层
// (同 ProvidersSection.test.ts 的既定写法)。
//
// 真 i18n(zh_cn 完整 locale,不手写子集)—— 同既定手法,避免手写子集漏拼错键名。

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import PrivacySection from './PrivacySection.vue'
import { useSettingsStore, type Policy } from '../../../stores/settingsStore'
import { useToast } from '../../../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountSection() {
  return mount(PrivacySection, { global: { plugins: [i18n] } })
}

function makePolicy(overrides: Partial<Policy> = {}): Policy {
  return { allow_remote: false, default_backend: 'local', escalation_prompt: false, ...overrides }
}

describe('PrivacySection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // ── 1. policyLoading → 加载中,不渲染卡片 ──

  it('1. policyLoading=true → 渲染「加载中…」,不渲染 .sk-section', () => {
    const store = useSettingsStore()
    store.policyLoading = true
    const w = mountSection()
    expect(w.text()).toContain('加载中…')
    expect(w.find('.sk-section').exists()).toBe(false)
  })

  // ── 2. policy 为 null 且不在加载 → 「无法加载策略」 ──

  it('2. policy=null 且不在加载 → 渲染「无法加载策略」,不渲染 .sk-section', () => {
    const store = useSettingsStore()
    store.policy = null
    store.policyLoading = false
    const w = mountSection()
    expect(w.text()).toContain('无法加载策略')
    expect(w.find('.sk-section').exists()).toBe(false)
  })

  // ── 3. 有 policy → 渲染三行 ──

  it('3. 有 policy → 渲染 .sk-section 且 3 条 .set-row', () => {
    const store = useSettingsStore()
    store.policy = makePolicy()
    const w = mountSection()
    expect(w.find('.sk-section').exists()).toBe(true)
    expect(w.findAll('.set-row')).toHaveLength(3)
  })

  // ── 4. 三个控件初值反映 policy 字段 ──

  it('4. 三个控件初值反映 policy.allow_remote / default_backend / escalation_prompt', () => {
    const store = useSettingsStore()
    store.policy = makePolicy({ allow_remote: true, default_backend: 'cloud', escalation_prompt: true })
    const w = mountSection()
    const switches = w.findAll('.sw')
    expect(switches[0].attributes('aria-checked')).toBe('true') // allow_remote
    expect(w.find('select').element.value).toBe('cloud')
    expect(switches[1].attributes('aria-checked')).toBe('true') // escalation_prompt
  })

  // ── 5. 拨 allow_remote 开关 → updatePolicyField('allow_remote', true) ──

  it('5. 拨动第一个开关(allow_remote)→ 调 store.updatePolicyField("allow_remote", true)', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'updatePolicyField').mockResolvedValue()
    store.policy = makePolicy({ allow_remote: false })
    const w = mountSection()
    await w.findAll('.sw')[0].trigger('click')
    expect(spy).toHaveBeenCalledWith('allow_remote', true)
  })

  // ── 6. 改下拉 → updatePolicyField('default_backend', 'cloud') ──

  it('6. 改下拉为 cloud → 调 store.updatePolicyField("default_backend", "cloud")', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'updatePolicyField').mockResolvedValue()
    store.policy = makePolicy({ default_backend: 'local' })
    const w = mountSection()
    await w.find('select').setValue('cloud')
    expect(spy).toHaveBeenCalledWith('default_backend', 'cloud')
  })

  // ── 7. 拨 escalation_prompt → 对应调用 ──

  it('7. 拨动第二个开关(escalation_prompt)→ 调 store.updatePolicyField("escalation_prompt", true)', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'updatePolicyField').mockResolvedValue()
    store.policy = makePolicy({ escalation_prompt: false })
    const w = mountSection()
    await w.findAll('.sw')[1].trigger('click')
    expect(spy).toHaveBeenCalledWith('escalation_prompt', true)
  })

  // ── 8. 成功 → toast 且 duration 是 1500(断言第二个参数)──

  it('8. 成功 → toast.show 被调用且第二个参数(duration)是 1500', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'updatePolicyField').mockResolvedValue()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    store.policy = makePolicy()
    const w = mountSection()
    await w.findAll('.sw')[0].trigger('click')
    await nextTick()
    await nextTick()
    expect(showSpy).toHaveBeenCalledWith('已保存', 1500)
  })

  // ── 9. 失败 → danger 档 toast ──

  it('9. updatePolicyField reject → danger 档 toast', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'updatePolicyField').mockRejectedValue(new Error('boom'))
    const toast = useToast()
    store.policy = makePolicy()
    const w = mountSection()
    await w.findAll('.sw')[0].trigger('click')
    await nextTick()
    await nextTick()
    expect(toast.toasts[0].text).toBe('保存失败')
    expect(toast.toasts[0].tier).toBe('danger')
  })

  // ── 10. policy.allow_remote 为 falsy(undefined)时开关显示为关(Vue2 :22 的 !! 归一,对照组) ──

  it('10. policy.allow_remote 为 undefined → 开关显示为关(!! 归一)', () => {
    const store = useSettingsStore()
    store.policy = { default_backend: 'local', escalation_prompt: false } as unknown as Policy
    const w = mountSection()
    expect(w.findAll('.sw')[0].attributes('aria-checked')).toBe('false')
  })
})
