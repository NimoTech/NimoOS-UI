// SP8-P2a Task 11 — 移植自 Vue2
// src/views/AI/Settings/sections/ThinkingDefaultsSection.vue(73 行)。brief Step 2
// 的 11 条用例清单,逐条落地。
//
// 这个分区**不经 store**,直接调 `service.ai.getThinkingDefaults` /
// `putThinkingDefaults`——mock `@nimotech/nimoos-service`(同
// AgentComposer.test.ts 的既定 vi.hoisted 手法),不 mock Pinia store(本组件根本
// 不用 store)。
//
// 真 i18n(zh_cn 完整 locale,不手写子集)。

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import { useToast } from '../../../../stores/toast'
import { setActivePinia, createPinia } from 'pinia'

const svc = vi.hoisted(() => ({
  getThinkingDefaults: vi.fn(),
  putThinkingDefaults: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: svc } }))

import ThinkingDefaultsSection from './ThinkingDefaultsSection.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

async function mountSection() {
  const w = mount(ThinkingDefaultsSection, { global: { plugins: [i18n] } })
  await flushPromises()
  return w
}

describe('ThinkingDefaultsSection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    svc.getThinkingDefaults.mockReset().mockResolvedValue({ enabled: true, level: 'medium' })
    svc.putThinkingDefaults.mockReset().mockResolvedValue({})
  })

  // ── 1. 挂载时调 getThinkingDefaults,返回值写进两个控件 ──

  it('1. 挂载时调 service.ai.getThinkingDefaults,返回值写进开关与下拉', async () => {
    svc.getThinkingDefaults.mockResolvedValue({ enabled: false, level: 'high' })
    const w = await mountSection()
    expect(svc.getThinkingDefaults).toHaveBeenCalledTimes(1)
    expect(w.find('.sw').attributes('aria-checked')).toBe('false')
    expect(w.find('select').element.value).toBe('high')
  })

  // ── 2. getThinkingDefaults reject → 不抛,用硬编码默认 enabled:true / level:'medium' ──

  it('2. getThinkingDefaults reject → 不抛,回落硬编码默认 enabled:true/level:medium', async () => {
    svc.getThinkingDefaults.mockRejectedValue(new Error('network down'))
    // mountSection() 内部 await flushPromises() 若 mounted() 的 rejection 未被
    // catch 住会变成未处理 rejection(vitest 默认对此报错),这里能顺利跑到断言
    // 本身就是「不抛」的证据。
    const w = await mountSection()
    expect(w.find('.sw').attributes('aria-checked')).toBe('true')
    expect(w.find('select').element.value).toBe('medium')
  })

  // ── 3. 拨开关 → 调 putThinkingDefaults({ enabled, level }) ──

  it('3. 拨动开关 → 调 service.ai.putThinkingDefaults({ enabled: false, level: "medium" })', async () => {
    const w = await mountSection()
    await w.find('.sw').trigger('click')
    await flushPromises()
    expect(svc.putThinkingDefaults).toHaveBeenCalledWith({ enabled: false, level: 'medium' })
  })

  // ── 4. 改下拉 → 同上,带新 level ──

  it('4. 改下拉为 high → 调 service.ai.putThinkingDefaults({ enabled: true, level: "high" })', async () => {
    const w = await mountSection()
    await w.find('select').setValue('high')
    await flushPromises()
    expect(svc.putThinkingDefaults).toHaveBeenCalledWith({ enabled: true, level: 'high' })
  })

  // ── 5. enabled 为 false 时下拉 disabled;为 true 时不 disabled(两条对照) ──

  it('5a. enabled=false → 下拉 disabled', async () => {
    svc.getThinkingDefaults.mockResolvedValue({ enabled: false, level: 'medium' })
    const w = await mountSection()
    expect(w.find('select').attributes('disabled')).toBeDefined()
  })

  it('5b. enabled=true → 下拉不 disabled', async () => {
    svc.getThinkingDefaults.mockResolvedValue({ enabled: true, level: 'medium' })
    const w = await mountSection()
    expect(w.find('select').attributes('disabled')).toBeUndefined()
  })

  // ── 6. 下拉四个选项:low / medium / high / max ──

  it('6. 下拉渲染四个选项 low/medium/high/max', async () => {
    const w = await mountSection()
    const options = w.findAll('option')
    expect(options.map((o) => o.attributes('value'))).toEqual(['low', 'medium', 'high', 'max'])
  })

  // ── 7. saving 期间显示「保存中…」 ──

  it('7. 保存请求在途时显示「保存中…」', async () => {
    let resolvePut: (v: unknown) => void = () => {}
    svc.putThinkingDefaults.mockReturnValue(new Promise((res) => { resolvePut = res }))
    const w = await mountSection()
    void w.find('.sw').trigger('click')
    await nextTick()
    await nextTick()
    expect(w.find('.set-actions .hint').text()).toBe('保存中…')
    resolvePut({})
    await flushPromises()
  })

  // ── 8. 保存成功后显示「已保存」 ──

  it('8. 保存成功后显示「已保存」', async () => {
    const w = await mountSection()
    await w.find('.sw').trigger('click')
    await flushPromises()
    expect(w.find('.set-actions .hint').text()).toBe('已保存')
  })

  // ── 9. 保存失败弹 danger toast 且不产生未捕获 rejection(纪律修复项)──

  it('9. 保存失败 → danger 档 toast「保存失败」,且不产生未捕获 rejection', async () => {
    svc.putThinkingDefaults.mockRejectedValue(new Error('boom'))
    const toast = useToast()
    const w = await mountSection()
    await w.find('.sw').trigger('click')
    await flushPromises()
    expect(toast.toasts[0].text).toBe('保存失败')
    expect(toast.toasts[0].tier).toBe('danger')
  })

  // ── 10. 保存失败后 saving 仍被放下(finally)──

  it('10. 保存失败后 saving 放下 → hint 不再停留「保存中…」', async () => {
    svc.putThinkingDefaults.mockRejectedValue(new Error('boom'))
    const w = await mountSection()
    await w.find('.sw').trigger('click')
    await flushPromises()
    expect(w.find('.set-actions .hint').text()).not.toBe('保存中…')
  })

  // ── 11. 信息横幅渲染 ──

  it('11. 信息横幅(.set-banner)渲染', async () => {
    const w = await mountSection()
    expect(w.find('.set-banner').exists()).toBe(true)
    expect(w.find('.set-banner').text()).toContain('新建会话时使用以下设置作为初始值')
  })
})
