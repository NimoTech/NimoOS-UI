// Task 7 (SP7-P5 人物): ClusterActionDialog.vue —— 未命名人物三态操作弹窗。
// 本组件只收集输入并 emit,不调用 store/toast(分工见组件头部注释),所以这里不 mock
// @nimotech/nimoos-service,只挂 i18n(用真实 zh_cn 词条,核心行为就是插值文案本身)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'

// 本组件自己不调用 service,但渲染的 PersonAvatar 子组件会——照 PersonAvatar.test.ts 的既有 mock。
const svc = vi.hoisted(() => ({
  photos: {
    personFaceThumbnailUrl: vi.fn((id: string | number) => `mock://face/${id}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import ClusterActionDialog from '../ClusterActionDialog.vue'
import type { Person } from '../../util/peopleView'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: 'u1',
    name: '',
    confidence: 0.87,
    count: 9,
    favorite: false,
    relation: '',
    coverFaceId: null,
    heroAssetId: null,
    firstSeen: null,
    lastSeen: null,
    placesCount: 0,
    ...overrides,
  }
}

// 每个组件实例的 watch(open, {immediate:true}) 在 mount 时就会往 document 挂一个 keydown
// 监听——上一个测试若不 unmount 就留着,同一个 Escape 会被好几个陈旧实例的监听器同时接住,
// 让 stopPropagation 调用次数断言假失败。afterEach 统一 unmount 本文件挂过的所有实例。
const mounted: VueWrapper[] = []
function mountDialog(props: { open: boolean; mode: 'name' | 'merge' | 'delete'; person: Person | null; candidates: Person[] }) {
  const w = mount(ClusterActionDialog, {
    props,
    global: { plugins: [i18n] },
    attachTo: document.body, // 焦点断言需要真实挂进 document
  })
  mounted.push(w)
  return w
}

beforeEach(() => {
  document.body.innerHTML = ''
})
afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
})

describe('ClusterActionDialog.vue — 三态渲染', () => {
  it('mode=name:渲染标题、副标题、输入框,无候选列表/危险按钮', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    expect(w.find('[data-test="cad-title"]').text()).toBe('为这个人命名')
    expect(w.find('[data-test="cad-subtitle"]').text()).toContain('9 张照片')
    expect(w.find('[data-test="cad-subtitle"]').text()).toContain('87%')
    expect(w.find('[data-test="cad-name-input"]').exists()).toBe(true)
    expect(w.find('[data-test="cad-save-name"]').exists()).toBe(true)
    expect(w.find('[data-test="cad-merge-input"]').exists()).toBe(false)
    expect(w.find('[data-test="cad-confirm-delete"]').exists()).toBe(false)
  })

  it('mode=merge:渲染搜索框 + 候选列表,无主按钮(只有取消)', async () => {
    const w = mountDialog({
      open: true, mode: 'merge', person: person(),
      candidates: [person({ id: 'a', name: 'Amy', count: 5 })],
    })
    await w.vm.$nextTick()
    expect(w.find('[data-test="cad-title"]').text()).toBe('合并到已有人物')
    expect(w.find('[data-test="cad-merge-input"]').exists()).toBe(true)
    expect(w.find('[data-test="cad-name-input"]').exists()).toBe(false)
    expect(w.find('[data-test="cad-save-name"]').exists()).toBe(false)
    expect(w.find('[data-test="cad-confirm-delete"]').exists()).toBe(false)
    expect(w.findAll('[data-test="cad-cancel"]')).toHaveLength(1)
  })

  it('mode=delete:渲染警示条 + danger 确认按钮,无输入框', async () => {
    const w = mountDialog({ open: true, mode: 'delete', person: person(), candidates: [] })
    await w.vm.$nextTick()
    expect(w.find('[data-test="cad-title"]').text()).toBe('删除这个人物分组？')
    expect(w.find('[data-test="cad-delete-warning"]').text()).toBe(
      '照片会保留。人物分组与识别记录将被永久删除。你可以在 5 秒内撤销。',
    )
    expect(w.find('[data-test="cad-name-input"]').exists()).toBe(false)
    expect(w.find('[data-test="cad-merge-input"]').exists()).toBe(false)
    expect(w.find('[data-test="cad-confirm-delete"]').exists()).toBe(true)
  })
})

describe('ClusterActionDialog.vue — 命名', () => {
  it('输入为空时主按钮 disabled;输入后不再 disabled', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    const btn = w.get<HTMLButtonElement>('[data-test="cad-save-name"]')
    expect(btn.element.disabled).toBe(true)
    await w.get('[data-test="cad-name-input"]').setValue('Sara')
    expect(btn.element.disabled).toBe(false)
  })

  it('回车提交 → emit submit-name 带 trim 后的值', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    const input = w.get('[data-test="cad-name-input"]')
    await input.setValue('  Sara  ')
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('submit-name')).toEqual([['Sara']])
  })

  it('空白输入回车不 emit(trim 后为空)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    const input = w.get('[data-test="cad-name-input"]')
    await input.setValue('   ')
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('submit-name')).toBeUndefined()
  })

  it('点保存按钮(未 disabled)同样 emit submit-name', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-name-input"]').setValue('Lily')
    await w.get('[data-test="cad-save-name"]').trigger('click')
    expect(w.emitted('submit-name')).toEqual([['Lily']])
  })

  it('打开时输入框自动获得焦点', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    expect(document.activeElement).toBe(w.get('[data-test="cad-name-input"]').element)
  })
})

describe('ClusterActionDialog.vue — 合并', () => {
  // 7 个非自身候选:用于验证「空查询取前 6,按 count 降序、同 count 按 name 升序」
  const SELF = person({ id: 'u1', name: '' })
  const CANDIDATES_SORT = [
    SELF, // 必须被排除,即便 count 最高
    person({ id: 'zoe', name: 'Zoe', count: 10 }),
    person({ id: 'amy', name: 'Amy', count: 10 }), // 与 Zoe 同 count,name 升序应排前面
    person({ id: 'bob', name: 'Bob', count: 8 }),
    person({ id: 'cara', name: 'Cara', count: 6 }),
    person({ id: 'dan', name: 'Dan', count: 5 }),
    person({ id: 'eve', name: 'Eve', count: 3 }),
    person({ id: 'fay', name: 'Fay', count: 1 }), // 第 7 名,应被 6 条上限截掉
  ]

  it('空查询 → 最多 6 条,排除自身,按 count 降序、同 count 按 name 升序', async () => {
    const w = mountDialog({ open: true, mode: 'merge', person: SELF, candidates: CANDIDATES_SORT })
    await w.vm.$nextTick()
    const ids = w.findAll('[data-test="cad-candidate"]').map((n) => n.attributes('data-id'))
    expect(ids).toEqual(['amy', 'zoe', 'bob', 'cara', 'dan', 'eve'])
  })

  it('搜索 "al" → 只剩名字含 al 的候选(小写 includes),最多 8 条', async () => {
    const many = Array.from({ length: 9 }, (_, i) => person({ id: `alice${i}`, name: `Alice${i}`, count: 9 - i }))
    const noMatch = person({ id: 'frank', name: 'Frank', count: 50 })
    const w = mountDialog({ open: true, mode: 'merge', person: SELF, candidates: [...many, noMatch] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-merge-input"]').setValue('al')
    const cards = w.findAll('[data-test="cad-candidate"]')
    expect(cards).toHaveLength(8)
    expect(cards.map((n) => n.attributes('data-id'))).not.toContain('frank')
  })

  it('点候选 → emit submit-merge 带该 id,无独立确认按钮', async () => {
    const w = mountDialog({
      open: true, mode: 'merge', person: SELF,
      candidates: [person({ id: 'amy', name: 'Amy', count: 5 })],
    })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-candidate"]').trigger('click')
    expect(w.emitted('submit-merge')).toEqual([['amy']])
  })

  it('数字 id 候选点击 → emit 原始数字 id(不做 String 转换)', async () => {
    const w = mountDialog({
      open: true, mode: 'merge', person: SELF,
      candidates: [person({ id: 42, name: 'Alice', count: 5 })],
    })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-candidate"]').trigger('click')
    expect(w.emitted('submit-merge')).toEqual([[42]])
  })

  it('无匹配 → 空态文案', async () => {
    const w = mountDialog({
      open: true, mode: 'merge', person: SELF,
      candidates: [person({ id: 'amy', name: 'Amy', count: 5 })],
    })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-merge-input"]').setValue('zzz-no-match')
    expect(w.find('[data-test="cad-empty"]').exists()).toBe(true)
    expect(w.find('[data-test="cad-empty"]').text()).toBe('没有匹配的人物')
  })

  it('打开时搜索框自动获得焦点', async () => {
    const w = mountDialog({ open: true, mode: 'merge', person: SELF, candidates: [] })
    await w.vm.$nextTick()
    expect(document.activeElement).toBe(w.get('[data-test="cad-merge-input"]').element)
  })
})

describe('ClusterActionDialog.vue — 删除', () => {
  it('点 danger 按钮 → emit submit-delete', async () => {
    const w = mountDialog({ open: true, mode: 'delete', person: person(), candidates: [] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-confirm-delete"]').trigger('click')
    expect(w.emitted('submit-delete')).toEqual([[]])
  })
})

describe('ClusterActionDialog.vue — 关闭交互', () => {
  it('点遮罩(非面板本体) → emit update:open(false)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-overlay"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('点面板本体不关闭(click.self 只认遮罩自身)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-panel"]').trigger('click')
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('点关闭按钮 → emit update:open(false)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-close"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('点取消 → emit update:open(false)', async () => {
    const w = mountDialog({ open: true, mode: 'delete', person: person(), candidates: [] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-cancel"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  // document 级派发(bubbles:true)——不在面板/输入元素上 .trigger('keydown'),那测不到
  // "焦点不在面板内也能用 Esc 关闭" 这个真实场景(P4 假绿教训:document 派发的事件默认不
  // 冒泡,不显式 bubbles:true 会拿到假绿)。
  it('按 Esc(document 级派发,bubbles:true) → emit update:open(false)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('Esc 分支调用了 stopPropagation(spy 断言)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    const evt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    const spy = vi.spyOn(evt, 'stopPropagation')
    document.dispatchEvent(evt)
    await w.vm.$nextTick()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('非 Escape 键不触发关闭,也不调用 stopPropagation', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    const evt = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    const spy = vi.spyOn(evt, 'stopPropagation')
    document.dispatchEvent(evt)
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
    expect(spy).not.toHaveBeenCalled()
  })

  it('面板关闭(open===false)后 Esc 不再有任何效果(监听已摘除)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    await w.setProps({ open: false })
    await w.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('卸载后 document keydown 监听摘干净(比对函数引用)', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    const added = addSpy.mock.calls.find((c) => c[0] === 'keydown') as [string, EventListener] | undefined
    expect(added).toBeDefined()
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    w.unmount()
    expect(removeSpy).toHaveBeenCalledWith('keydown', added![1])
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
