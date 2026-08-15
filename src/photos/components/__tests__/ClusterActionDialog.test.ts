// Task 7 (SP7-P5 人物): ClusterActionDialog.vue —— 未命名人物三态操作弹窗。
// 本组件只收集输入并 emit,不调用 store/toast(分工见组件头部注释),所以这里不 mock
// @nimotech/nimoos-service,只挂 i18n(用真实 zh_cn 词条,核心行为就是插值文案本身)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
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
  it('mode=name:渲染标题、副标题、label、输入框,无候选列表/危险按钮', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    expect(w.find('[data-test="cad-title"]').text()).toBe('为这个人命名')
    expect(w.find('[data-test="cad-subtitle"]').text()).toContain('9 张照片')
    expect(w.find('[data-test="cad-subtitle"]').text()).toContain('87%')
    // 协调者复核修正:补上 Vue2 的 <label>(照 Vue2 :272,New-UI 键 photosPersonNameLabel)。
    expect(w.find('[data-test="cad-name-label"]').text()).toBe('名称')
    expect(w.find('[data-test="cad-name-input"]').exists()).toBe(true)
    expect(w.find('[data-test="cad-save-name"]').exists()).toBe(true)
    expect(w.find('[data-test="cad-merge-input"]').exists()).toBe(false)
    expect(w.find('[data-test="cad-confirm-delete"]').exists()).toBe(false)
  })

  // 协调者复核修正:头部头像外圈补上 Vue2 :246-247 的 2px accent-soft 装饰环(48px 外圈
  // border-box,PersonAvatar 本体按 44 传 size,44 + 2*2 = 48 还原同一几何。装饰环的
  // 48px/2px 描边走 scoped CSS class,jsdom 不跑真实布局引擎测不到计算值,这里断言
  // 结构(装饰环节点存在 + 内部头像的 size 是 44,不是 48)。
  it('头部头像外圈装饰环存在,内部 PersonAvatar 按 44(不是 48)传 size', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    const ring = w.get('[data-test="cad-avatar-ring"]')
    const avatar = ring.find('.person-avatar')
    expect(avatar.exists()).toBe(true)
    expect(avatar.attributes('style')).toContain('width: 44px')
    expect(avatar.attributes('style')).toContain('height: 44px')
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

  // 评审必修 1 回归:delete 模式是三句不同文案分属三个槶位(头部标题 / 警示条自己的标题行 /
  // 警示条灰色小字正文),照 Vue2 :259-262 与 :337-343 逐一核对,不能互相顶替。
  it('mode=delete:头部标题、警示条标题行+正文各归位,danger 确认按钮,无输入框', async () => {
    const w = mountDialog({ open: true, mode: 'delete', person: person(), candidates: [] })
    await w.vm.$nextTick()
    // 头部标题(Vue2 :262 $t('Delete face cluster'))——不是警示条里的那句。
    expect(w.find('[data-test="cad-title"]').text()).toBe('删除这组人脸')
    // 警示条自己的标题行(Vue2 :341 $t('Delete this person group?'))。
    expect(w.find('[data-test="cad-delete-warning-title"]').text()).toBe('删除这个人物分组？')
    // 警示条的灰色小字正文(Vue2 :342-343)。
    expect(w.find('[data-test="cad-delete-warning-body"]').text()).toBe(
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

// Task 7 (Plan D): naming with an already-existing name switches to the dupconfirm substate,
// with three actions (Merge into existing / Name anyway / Cancel), instead of directly emitting
// submit-name.
describe('ClusterActionDialog.vue — 命名:重名 dupconfirm', () => {
  const ADA = person({ id: 42, name: 'Ada', count: 30 })

  it('输入已存在姓名(大小写/空白不敏感)并保存 → 出现 dupconfirm,不 emit submit-name', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [ADA] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-name-input"]').setValue('  ada ')
    await w.get('[data-test="cad-save-name"]').trigger('click')
    expect(w.find('[data-test="cad-dupconfirm"]').exists()).toBe(true)
    expect(w.emitted('submit-name')).toBeUndefined()
    // The regular input/action row is replaced, not stacked alongside it.
    expect(w.find('[data-test="cad-name-input"]').exists()).toBe(false)
    expect(w.find('[data-test="cad-save-name"]').exists()).toBe(false)
  })

  it('回车提交重名同样切到 dupconfirm(不只是点按钮才生效)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [ADA] })
    await w.vm.$nextTick()
    const input = w.get('[data-test="cad-name-input"]')
    await input.setValue('Ada')
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.find('[data-test="cad-dupconfirm"]').exists()).toBe(true)
  })

  it('头部标题换成"已存在同名人物",头像/副标题不变', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person({ count: 9, confidence: 0.87 }), candidates: [ADA] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-name-input"]').setValue('Ada')
    await w.get('[data-test="cad-save-name"]').trigger('click')
    expect(w.find('[data-test="cad-title"]').text()).toContain('Ada')
    expect(w.find('[data-test="cad-subtitle"]').text()).toContain('9')
    expect(w.find('[data-test="cad-subtitle"]').text()).toContain('87%')
  })

  it('不重名的名字 → 直接 emit submit-name,不出现 dupconfirm', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [ADA] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-name-input"]').setValue('Nobody')
    await w.get('[data-test="cad-save-name"]').trigger('click')
    expect(w.emitted('submit-name')).toEqual([['Nobody']])
    expect(w.find('[data-test="cad-dupconfirm"]').exists()).toBe(false)
  })

  it('"Merge into existing" → emit submit-merge 带既有人物 id', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [ADA] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-name-input"]').setValue('Ada')
    await w.get('[data-test="cad-save-name"]').trigger('click')
    await w.get('[data-test="cad-dup-merge"]').trigger('click')
    expect(w.emitted('submit-merge')).toEqual([[42]])
    expect(w.emitted('submit-name')).toBeUndefined()
  })

  it('"Name anyway" → emit submit-name 带原始输入的名字(trim 后)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [ADA] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-name-input"]').setValue('  ada ')
    await w.get('[data-test="cad-save-name"]').trigger('click')
    await w.get('[data-test="cad-dup-name-anyway"]').trigger('click')
    expect(w.emitted('submit-name')).toEqual([['ada']])
    expect(w.emitted('submit-merge')).toBeUndefined()
  })

  it('"Cancel" → 整个弹窗关闭(emit update:open false),不是退回普通命名态', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [ADA] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-name-input"]').setValue('Ada')
    await w.get('[data-test="cad-save-name"]').trigger('click')
    await w.get('[data-test="cad-dup-cancel"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('重新打开弹窗时 dupconfirm 状态被清空(不会带着上一次的子状态重新出现)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [ADA] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-name-input"]').setValue('Ada')
    await w.get('[data-test="cad-save-name"]').trigger('click')
    expect(w.find('[data-test="cad-dupconfirm"]').exists()).toBe(true)

    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await w.vm.$nextTick()
    expect(w.find('[data-test="cad-dupconfirm"]').exists()).toBe(false)
    expect(w.find('[data-test="cad-name-input"]').exists()).toBe(true)
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

// ── Plan D Task 4 (scoped zeroed out): this file used to have a set of tests for "the hover
// state's background doesn't get stolen by the base class's rule", reading the component's own
// <style scoped> source via `?raw` and asserting, using ./cssCascade's small CSS-priority
// calculator, which background declaration actually wins on hover. This task deleted the
// component's entire <style scoped> block (the class names are unchanged, but styling authority
// has moved to the .cad-* parity rules in src/photos/styles/vue2-parity/photos-people.scss — see
// the component's own script-header comment), so the source read in via `?raw` no longer has a
// <style> block to extract, and that test group's precondition no longer holds — deleted along
// with it. All that's pinned down here is one thing: the component's root class name is unaffected.
//
// Fix round 1 (final-review Important): the old comment above used to also say "once scoped is
// entirely zeroed out this can't recur, parity's own internal declaration order is correct as
// is" — **that sentence was wrong, and has been deleted.** The CSS cascade decides a winner per
// property, not per rule as a whole: `.cad-btn:hover { background: var(--surface-3); ... }` and
// `.cad-btn-danger:hover { filter: brightness(1.08); }` (before the fix) tie in specificity
// (0,2,0) — even though parity's own `.cad-btn-danger:hover` is written after `.cad-btn:hover` in
// the file, as long as it doesn't re-declare background itself, that property has no competing
// declaration from the variant rule at all, so `.cad-btn:hover`'s background still wins — the
// scoped version's bug reappeared wearing a different face, reproduced as-is inside parity (the
// delete-confirm button data-test="cad-confirm-delete" turned gray on hover instead of red). What
// actually prevents this from recurring isn't "delete the local scoped block" by itself, it's
// "every variant's hover rule must re-declare background itself" — the test group below reads the
// parity file directly and asserts against that requirement rule-by-rule, no longer depending on
// whether the component's local scoped block has been deleted.
describe('ClusterActionDialog.vue — Plan D Task 4:scoped 清零后根类名不变', () => {
  it('挂载后 [data-test="cad-overlay"] 仍然带着 cad-overlay 类(类名工程只动 PhotosPersonDetail.vue 的 pd-*,不动本组件)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    expect(w.find('[data-test="cad-overlay"]').classes()).toContain('cad-overlay')
    expect(w.find('[data-test="cad-panel"]').classes()).toContain('cad-panel')
  })
})

// ── Plan D Task 4, fix round 1 (final-review Important): the delete-confirm button hover
// regression guard ──────────
//
// jsdom neither computes the CSS cascade nor can enter a real hover state, and the real source of
// styling now lives outside this component file entirely (the whole <style scoped> block is
// deleted, all the class-name rules moved into photos-people.scss), so this test group reads the
// parity file's own raw text via node:fs and pulls the rule body by selector (the same read-off-
// disk approach already established by AppToast.zIndex.test.ts), rather than going through
// ./cssCascade's older approach of "extract <style> from the component via ?raw, then compute
// priority". The selectors here are all simple top-level class/pseudo-class combinations with no
// nesting, so a one-shot regex pulling the rule body by "selector name { brace contents }" is
// already precise enough — no need to bring in a full CSS parser.
const PARITY_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../styles/vue2-parity/photos-people.scss',
)
const parityCss = readFileSync(PARITY_PATH, 'utf8')

/** Precisely pulls one rule's brace contents by selector name (safe enough for simple button
 *  rules with no nested braces). */
function parityRuleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(parityCss)
  if (!m) throw new Error(`Rule not found in parity file: ${selector}`)
  return m[1]
}

function backgroundOf(body: string): string | null {
  const m = /background\s*:\s*([^;]+)/.exec(body)
  return m ? m[1].trim() : null
}

describe('ClusterActionDialog.vue — Plan D Task 4 fix round 1:parity 里变体按钮 hover 背景不被 .cad-btn:hover 夺走', () => {
  it('.cad-btn-danger:hover 必须自己重申 background(否则被基类 .cad-btn:hover 的 var(--surface-3) 顶掉,回归本轮修的那个 bug)', () => {
    const baseBg = backgroundOf(parityRuleBody('.cad-btn:hover'))
    const dangerHoverBg = backgroundOf(parityRuleBody('.cad-btn-danger:hover'))
    const dangerBaseBg = backgroundOf(parityRuleBody('.cad-btn-danger'))
    expect(baseBg).toBe('var(--surface-3)')
    expect(dangerHoverBg, '.cad-btn-danger:hover 缺少 background 声明——按 CSS 级联规则,基类 .cad-btn:hover 的 background 会在这条属性上生效').not.toBeNull()
    // The value must match its own resting state (Vue2 uses an inline style, so the background
    // never actually changes on hover — see the component's own fix round 1 comment); it can't
    // just be "non-null, whatever it is".
    expect(dangerHoverBg).toBe(dangerBaseBg)
    expect(dangerHoverBg).not.toBe(baseBg)
  })

  it('.cad-btn-primary:hover 已经正确重申 background(回归防线——本轮顺带核实过,未受影响,别在后续改动里砍掉)', () => {
    const baseBg = backgroundOf(parityRuleBody('.cad-btn:hover'))
    const primaryHoverBg = backgroundOf(parityRuleBody('.cad-btn-primary:hover'))
    expect(primaryHoverBg).not.toBeNull()
    expect(primaryHoverBg).not.toBe(baseBg)
  })
})
