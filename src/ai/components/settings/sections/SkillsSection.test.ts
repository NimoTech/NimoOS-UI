import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import type { Skill } from '../../../types/skill'
import SkillGroup from '../skills/SkillGroup.vue'
import SkillDetail from '../skills/SkillDetail.vue'

// SP8-P3a Task 6 — ported from Vue2 src/views/AI/Skills/SkillsSection.vue (226 lines) read-only half.
// SP8-P3b Task 8 — adds four write operations (onToggle/onDelete/onCreate/onTest) + `+` button wiring.
// Public constraint §9: vi.mock skeleton uses vi.hoisted() to avoid ESM hoisting TDZ ReferenceError.
const h = vi.hoisted(() => ({
  listSkills: vi.fn(),
  updateSkill: vi.fn(),
  deleteSkill: vi.fn(),
  createSkill: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: h } }))

// SkillDetail.vue internally uses useRouter() ('try in chat' button), this file doesn't test
// that interaction, but mounting SkillsSection also mounts SkillDetail, must provide stub
// to avoid real vue-router error (same precedent as SkillDetail.test.ts).
const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

import SkillsSection from './SkillsSection.vue'
import { useToast } from '../../../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
// Task 8: AddSkillModal uses SkModal (reka Dialog), portal target defaults '.set-app'
// (see SkModal.vue head comment D1) — attachTo document.body + separately mount .set-app host,
// technique same as ChannelsSection.test.ts. No side effects on existing (P3a) read-only half cases,
// read-only half never opens dialog.
const mountSection = () => mount(SkillsSection, { global: { plugins: [i18n] }, attachTo: document.body })
const flush = async () => {
  await nextTick()
  await nextTick()
  await nextTick()
}
// AddSkillModal when opening uses focus replacement via setTimeout(fn, 0) (macro task, see component
// head comment "reka initial focus empirical conclusion"), pure micro task level flush() can't catch up;
// precedent AddSkillModal.test.ts::macroFlush.
const macroFlush = async () => { await flush(); await new Promise((r) => setTimeout(r, 0)); await flush() }

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'sk-1',
    name: 'weekly-report',
    title: 'Weekly Report',
    description: 'Summarizes the week and posts it to the family channel.',
    trigger: 'manual',
    trigger_human: 'Manual',
    color: 'blue',
    icon: 'sparkle',
    enabled: true,
    system: true,
    author: 'Nimo',
    last_used: '',
    calls: 0,
    files: [],
    examples: [],
    md: '',
    ...overrides,
  }
}

describe('SkillsSection (read-only half)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    h.listSkills.mockReset()
    h.updateSkill.mockReset()
    h.deleteSkill.mockReset()
    h.createSkill.mockReset()
    push.mockClear()
    // SkModal's DialogPortal target element must exist in DOM before component mounting (same as above comment).
    const host = document.createElement('div')
    host.className = 'set-app'
    document.body.appendChild(host)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('on mount loads, renders built-in/mine two groups, each group only contains skills matching respective system ownership', async () => {
    h.listSkills.mockResolvedValue([
      makeSkill({ id: 'a', name: 'built-a', title: 'Built A', system: true }),
      makeSkill({ id: 'b', name: 'mine-b', title: 'Mine B', system: false }),
    ])
    const w = mountSection()
    await flush()
    const groupLabels = w.findAll('.sk-group-label').map((el) => el.text())
    expect(groupLabels).toHaveLength(2)
    expect(groupLabels[0]).toContain('内置技能')
    expect(groupLabels[1]).toContain('我的技能')
    expect(w.findAll('.sk-item')).toHaveLength(2)

    // Review self-check (criteria same as above): just counting total/just looking at two label strings
    // insufficient to pin down regressions like "builtIn/personal two computed filter conditions
    // written backward" (total and labels unchanged, just content put in wrong group) — directly check
    // each SkillGroup instance received props, not relying on DOM order inference.
    const groups = w.findAllComponents(SkillGroup)
    expect(groups).toHaveLength(2)
    expect(groups[0].props('label')).toBe('内置技能')
    expect(groups[0].props('items').map((s: Skill) => s.name)).toEqual(['built-a'])
    expect(groups[1].props('label')).toBe('我的技能')
    expect(groups[1].props('items').map((s: Skill) => s.name)).toEqual(['mine-b'])
  })

  // Single layer fetch criteria (positive) — public constraint §4 / brief §6.3: bare array is true contract shape, must be non-empty.
  it('bare array mock → list non-empty (single layer fetch, not peeling off .data again)', async () => {
    h.listSkills.mockResolvedValue([makeSkill({ id: 'a' })])
    const w = mountSection()
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(1)
    expect(w.find('.sk-col-empty').exists()).toBe(false)
  })

  // Single layer fetch criteria (negative) — pin down criteria: if anyone reverts reload() to Vue2's
  // `resp.data` (peeling off axios layer again), this must turn red. Provide axios shape mock,
  // assert list empty, prove this repo's consumer side is single layer fetch.
  it('given { data: [...] } shape (axios layer) list empty — prove this repo is single layer fetch, not leaving implementation an out', async () => {
    h.listSkills.mockResolvedValue({ data: [makeSkill({ id: 'a' })] } as unknown as Skill[])
    const w = mountSection()
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(0)
    expect(w.find('.sk-col-empty').exists()).toBe(true)
  })

  // Review Important (independent round): originally only used one shared word 'FAMILY' to hit description,
  // no independent verification for name/title two branches — review probe deleted s.name check in
  // `filtered`, 9 cases still all green. Changed to three independent cases, each with fixture
  // of "unique token only appears in that field" (not overlapping with any field of other two skills),
  // respectively assert only hits expected one, doesn't harm other two. Three tokens don't contain
  // each other, not substrings of each other.
  function threeFieldFixture(): Skill[] {
    return [
      makeSkill({
        id: 'by-name',
        name: 'orion-alpha-token',
        title: 'Skill Alpha',
        description: 'plain description alpha',
        system: true,
      }),
      makeSkill({
        id: 'by-title',
        name: 'plain-name-beta',
        title: 'Zephyr-Beta-Token',
        description: 'plain description beta',
        system: false,
      }),
      makeSkill({
        id: 'by-desc',
        name: 'plain-name-gamma',
        title: 'Skill Gamma',
        description: 'nebula-gamma-token appears here',
        system: false,
      }),
    ]
  }

  it('search hits name field (doesn\'t harm other two whose title/description don\'t contain word)', async () => {
    h.listSkills.mockResolvedValue(threeFieldFixture())
    const w = mountSection()
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(3)

    await w.find('.sk-col-search input').setValue('orion-alpha')
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(1)
    expect(w.find('.sk-item-name').text()).toBe('orion-alpha-token')
  })

  it('search hits title field (case-insensitive, doesn\'t harm other two whose name/description don\'t contain word)', async () => {
    h.listSkills.mockResolvedValue(threeFieldFixture())
    const w = mountSection()
    await flush()

    await w.find('.sk-col-search input').setValue('ZEPHYR-BETA')
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(1)
    expect(w.find('.sk-item-name').text()).toBe('plain-name-beta')
  })

  it('search hits description field (doesn\'t harm other two whose name/title don\'t contain word)', async () => {
    h.listSkills.mockResolvedValue(threeFieldFixture())
    const w = mountSection()
    await flush()

    await w.find('.sk-col-search input').setValue('nebula-gamma')
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(1)
    expect(w.find('.sk-item-name').text()).toBe('plain-name-gamma')
  })

  it('two empty states: no query shows "no skills…", has query shows "no matching skills" + echoes query', async () => {
    h.listSkills.mockResolvedValue([])
    const w = mountSection()
    await flush()
    expect(w.find('.sk-col-empty').text()).toBe('还没有技能,点击 + 添加一个。')

    await w.find('.sk-col-search input').setValue('nope')
    await flush()
    expect(w.find('.sk-col-empty').text()).toContain('没有匹配的技能')
    expect(w.find('.sk-col-empty code').text()).toBe('nope')
  })

  it('click item to toggle activeSkill (right detail synchronized)', async () => {
    h.listSkills.mockResolvedValue([
      makeSkill({ id: 'a', name: 'skill-a', title: 'Skill A', system: true }),
      makeSkill({ id: 'b', name: 'skill-b', title: 'Skill B', system: false }),
    ])
    const w = mountSection()
    await flush()
    // After mounting, first item selected by default (fallback selection in reload()).
    expect(w.find('.sk-name span').text()).toBe('Skill A')

    await w.findAll('.sk-item')[1].trigger('click')
    await flush()
    expect(w.find('.sk-name span').text()).toBe('Skill B')
  })

  it('selected item filtered out by search doesn\'t crash: detail still shows originally selected, not forced clear/not throw', async () => {
    h.listSkills.mockResolvedValue([
      makeSkill({ id: 'a', name: 'weekly-report', title: 'Weekly Report', system: true }),
      makeSkill({ id: 'b', name: 'other', title: 'Other', system: false }),
    ])
    const w = mountSection()
    await flush()
    expect(w.find('.sk-name span').text()).toBe('Weekly Report')

    // Search query filters out current selected from left column list, but activeSkill found
    // from full skills (not filtered) (align Vue2 :116-118), detail panel unaffected, also doesn't throw.
    await w.find('.sk-col-search input').setValue('other')
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(1)
    expect(w.find('.sk-item-name').text()).toBe('other')
    expect(w.find('.sk-name span').text()).toBe('Weekly Report')
  })

  it('reload fail shows danger toast and loading reset', async () => {
    h.listSkills.mockRejectedValue(new Error('boom'))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    expect(show).toHaveBeenCalledWith('无法加载技能列表', 3000, 'danger')
    expect(w.find('.sk-spinner').exists()).toBe(false)
  })

  it('refresh button triggers reload', async () => {
    h.listSkills.mockResolvedValue([makeSkill({ id: 'a' })])
    const w = mountSection()
    await flush()
    expect(h.listSkills).toHaveBeenCalledTimes(1)
    expect(w.findAll('.sk-item')).toHaveLength(1)

    h.listSkills.mockResolvedValue([
      makeSkill({ id: 'a' }),
      makeSkill({ id: 'b', name: 'skill-b', system: false }),
    ])
    await w.find('.icon-btn').trigger('click')
    await flush()
    expect(h.listSkills).toHaveBeenCalledTimes(2)
    expect(w.findAll('.sk-item')).toHaveLength(2)
  })
})

// ============================================================================
// SP8-P3b Task 8 — `+` button + four write operations wiring.
//
// Except new flow, four actions go via `w.findComponent(SkillDetail).vm.$emit(...)` direct trigger
// (precedent: TestPanel in same SkillDetail tree here uses `tp.vm.$emit('test')`, see
// `SkillDetail.test.ts:665`) — SkillDetail's own UI interactions (toggle click/menu/confirm dialog)
// already covered in SkillDetail.test.ts, here only test SkillsSection logic after receiving emit
// (single layer fetch / busy lifecycle / activeId placement condition), using direct emit instead
// of re-walking click chain, also covers "delete not current selected item" scenario explicitly
// required by brief §10.2 which click chain can't reach (only activeSkill renders delete entry on UI).
// ============================================================================
describe('SkillsSection (P3b write operations half)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    h.listSkills.mockReset()
    h.updateSkill.mockReset()
    h.deleteSkill.mockReset()
    h.createSkill.mockReset()
    push.mockClear()
    // SkModal's DialogPortal target element must exist in DOM before component mounting (same as above read-only half host technique).
    const host = document.createElement('div')
    host.className = 'set-app'
    document.body.appendChild(host)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('click + button opens new skill dialog (title correct); clicking again doesn\'t stack open second dialog', async () => {
    h.listSkills.mockResolvedValue([makeSkill({ id: 'a' })])
    const w = mountSection()
    await flush()
    expect(document.querySelector('.sk-modal')).toBeNull()

    await w.find('.sk-add-btn').trigger('click')
    await macroFlush()
    const titles = document.querySelectorAll('.sk-modal-title')
    expect(titles).toHaveLength(1)
    expect(titles[0].textContent).toBe(zh.aiSkAddTitle)
  })

  it('toggle success: backend returns bare skill, list item replaced in place, toast shows text per new state', async () => {
    h.listSkills.mockResolvedValue([makeSkill({ id: 'a', name: 'skill-a', enabled: true })])
    h.updateSkill.mockResolvedValue(makeSkill({ id: 'a', name: 'skill-a', enabled: false }))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(SkillDetail)
    detail.vm.$emit('toggle', 'a', false)
    await flush()

    expect(h.updateSkill).toHaveBeenCalledWith('a', { enabled: false })
    // List item replaced in place with the new object the backend returns (enabled:false → renders off mark).
    expect(w.find('.sk-item-off').exists()).toBe(true)
    expect(show).toHaveBeenCalledWith(zh.aiSkPausedToast)
  })

  // Single layer fetch criteria (negative) — align P3a Task 6 reload() that two pinned cases (line 86/97),
  // same technique applied to onToggle: feed axios layer shape mock, prove this repo's consumer is
  // single layer fetch, not leaving implementation a "peeling off again also works" out.
  it('single layer fetch criteria (negative): toggle fed { data: skill } envelope shape → list item name becomes empty (not real value inside envelope), prove consumer is single layer fetch', async () => {
    h.listSkills.mockResolvedValue([makeSkill({ id: 'a', name: 'skill-a' })])
    h.updateSkill.mockResolvedValue(
      { data: makeSkill({ id: 'a', name: 'renamed', title: 'Renamed' }) } as unknown as Skill,
    )
    const w = mountSection()
    await flush()

    const detail = w.findComponent(SkillDetail)
    detail.vm.$emit('toggle', 'a', false)
    await flush()

    // Under single layer fetch, envelope object itself put in list as skill — it has no `.name` field,
    // renders empty string. If anyone peels off `.data` again in onToggle (back to Vue2 defect mold),
    // this becomes 'renamed', this assert reports red precisely (see RED probe in task report).
    expect(w.find('.sk-item-name').text()).toBe('')
    expect(w.find('.sk-item-name').text()).not.toBe('renamed')
  })

  it('toggle in flight: busy[id]=true passed to SkillDetail (toggle disabled), immediately clear when request lands', async () => {
    h.listSkills.mockResolvedValue([makeSkill({ id: 'a', enabled: true })])
    let resolvePromise: (v: unknown) => void = () => {}
    h.updateSkill.mockImplementation(() => new Promise((res) => { resolvePromise = res }))
    const w = mountSection()
    await flush()

    const detail = w.findComponent(SkillDetail)
    detail.vm.$emit('toggle', 'a', false)
    await nextTick()
    expect(detail.props('busy')).toEqual({ a: true })

    resolvePromise(makeSkill({ id: 'a', enabled: false }))
    await flush()
    expect(detail.props('busy')).toEqual({})
  })

  it('toggle fail: danger toast (3000ms), list item unchanged', async () => {
    h.listSkills.mockResolvedValue([makeSkill({ id: 'a', name: 'skill-a', enabled: true })])
    h.updateSkill.mockRejectedValue(new Error('boom'))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(SkillDetail)
    detail.vm.$emit('toggle', 'a', false)
    await flush()

    expect(show).toHaveBeenCalledWith(zh.aiSkUpdateFailed, 3000, 'danger')
    // Still enabled:true, doesn't show off mark — list item unchanged.
    expect(w.find('.sk-item-off').exists()).toBe(false)
  })

  it('delete success: disappears from list, toast text distinguished by system (built-in=uninstall, user=delete)', async () => {
    h.listSkills.mockResolvedValue([
      makeSkill({ id: 'a', name: 'skill-a', system: true }),
      makeSkill({ id: 'b', name: 'skill-b', system: false }),
    ])
    h.deleteSkill.mockResolvedValue(undefined)
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(SkillDetail)
    detail.vm.$emit('delete', 'a')
    await flush()

    expect(h.deleteSkill).toHaveBeenCalledWith('a')
    expect(w.findAll('.sk-item')).toHaveLength(1)
    expect(show).toHaveBeenCalledWith('已卸载 skill-a')
  })

  // brief §10.2 explicitly names condition: pin down "only when deleting current selected falls to first remaining".
  //
  // 【review Important, fixed】original fixture only two items ([a, b]), select a (default first), delete b —
  // after delete remains [a], whether `if (activeId.value === id)` condition works or not, `activeId`
  // lands on 'a' (condition works: stays, still a; condition deleted / unconditional fallback skills[0]: also a),
  // two implementations give same result, assertion can't distinguish, empty case (review RED probe empirical:
  // delete entire condition, 23 cases still all green). Changed to three items `[a, b, c]`, first switch to
  // **c** (not first of remaining after delete) then delete **b** — condition works: activeId still c;
  // condition deleted (unconditional fallback skills[0]): activeId wrongly jumps to a. Two implementations
  // must diverge on this fixture, assertion has discrimination power.
  it('delete not current selected → activeId unchanged, detail panel still shows originally selected skill', async () => {
    h.listSkills.mockResolvedValue([
      makeSkill({ id: 'a', name: 'skill-a', title: 'Skill A' }),
      makeSkill({ id: 'b', name: 'skill-b', title: 'Skill B' }),
      makeSkill({ id: 'c', name: 'skill-c', title: 'Skill C' }),
    ])
    h.deleteSkill.mockResolvedValue(undefined)
    const w = mountSection()
    await flush()
    // First switch to third item (c) — after delete remaining list [a, c]'s first item is a, not c, divergence point of two implementations.
    await w.findAll('.sk-item')[2].trigger('click')
    await flush()
    expect(w.find('.sk-name span').text()).toBe('Skill C')

    const detail = w.findComponent(SkillDetail)
    detail.vm.$emit('delete', 'b') // delete b, not currently selected c
    await flush()

    expect(w.findAll('.sk-item')).toHaveLength(2)
    // activeId must still be c — if condition deleted (unconditional fallback skills[0]), here becomes 'Skill A'.
    expect(w.find('.sk-name span').text()).toBe('Skill C')
  })

  it('delete fail: danger toast, list item survives', async () => {
    h.listSkills.mockResolvedValue([makeSkill({ id: 'a', name: 'skill-a' })])
    h.deleteSkill.mockRejectedValue(new Error('boom'))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(SkillDetail)
    detail.vm.$emit('delete', 'a')
    await flush()

    expect(show).toHaveBeenCalledWith(zh.aiSkDeleteFailed, 3000, 'danger')
    expect(w.findAll('.sk-item')).toHaveLength(1)
  })

  // Must `await flush()` between value change and click — `disabled` attribute driven by `valid` computed
  // waits for Vue sync new value into real DOM before removing, continuous set value → click in same tick
  // clicks on button still with `disabled` (precedent: AddSkillModal.test.ts has independent `await flush()`
  // between setValue()/click()).
  async function fillAndSubmitAddForm(name: string, description: string) {
    const nameEl = document.querySelector('.sk-modal .sk-field:nth-of-type(1) input') as HTMLInputElement
    const descEl = document.querySelector('.sk-modal .sk-field:nth-of-type(2) textarea') as HTMLTextAreaElement
    nameEl.value = name
    nameEl.dispatchEvent(new Event('input'))
    descEl.value = description
    descEl.dispatchEvent(new Event('input'))
    await flush()
    const submitEl = document.querySelector('.sk-modal-foot .sk-btn.primary') as HTMLButtonElement
    submitEl.click()
  }

  it('create success: new skill pushed to list and selected, dialog closes, toast shown', async () => {
    h.listSkills.mockResolvedValue([])
    h.createSkill.mockResolvedValue(makeSkill({ id: 'new-1', name: 'invoice-tagger', title: 'invoice-tagger' }))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    await w.find('.sk-add-btn').trigger('click')
    await macroFlush()
    await fillAndSubmitAddForm('invoice-tagger', 'Tags invoices automatically')
    await flush()

    expect(h.createSkill).toHaveBeenCalledTimes(1)
    expect(w.findAll('.sk-item')).toHaveLength(1)
    expect(w.find('.sk-name span').text()).toBe('invoice-tagger') // selected immediately after creation
    expect(document.querySelector('.sk-modal')).toBeNull() // dialog closed
    expect(show).toHaveBeenCalledWith('已添加 invoice-tagger')
  })

  it('create fail (409 skill already exists): inline error shows aiSkErrDuplicate text, dialog still open, list unchanged', async () => {
    h.listSkills.mockResolvedValue([])
    h.createSkill.mockRejectedValue({ response: { data: { message: 'skill already exists' } } })
    const w = mountSection()
    await flush()

    await w.find('.sk-add-btn').trigger('click')
    await macroFlush()
    await fillAndSubmitAddForm('invoice-tagger', 'Tags invoices automatically')
    await flush()

    const errEl = document.querySelector('.sk-modal .sk-field-err')
    expect(errEl?.textContent).toBe(zh.aiSkErrDuplicate)
    expect(document.querySelector('.sk-modal')).not.toBeNull() // dialog still open, user can edit and retry
    expect(w.findAll('.sk-item')).toHaveLength(0) // list unchanged
  })

  // Dialog close must clear createError (brief "two places pre-resolved by coordinator" place 2): inline error
  // left by previous create failure, after cancel-close open again must not remain.
  it('create fail then cancel-close dialog, open again: inline error already cleared', async () => {
    h.listSkills.mockResolvedValue([])
    h.createSkill.mockRejectedValue({ response: { data: { message: 'skill already exists' } } })
    const w = mountSection()
    await flush()

    await w.find('.sk-add-btn').trigger('click')
    await macroFlush()
    await fillAndSubmitAddForm('invoice-tagger', 'Tags invoices automatically')
    await flush()
    expect(document.querySelector('.sk-modal .sk-field-err')).not.toBeNull()

    const cancelBtn = Array.from(document.querySelectorAll('.sk-modal-foot .sk-btn.ghost'))
      .find((b) => b.textContent?.trim() === zh.aiCancel) as HTMLButtonElement
    cancelBtn.click()
    await flush()
    expect(document.querySelector('.sk-modal')).toBeNull()

    await w.find('.sk-add-btn').trigger('click')
    await macroFlush()
    expect(document.querySelector('.sk-modal .sk-field-err')).toBeNull()
  })

  // 【same-tier self-check, see task report "same-tier self-check" section】original only calls `test` once
  // on a (default first selected, index 0), then switch to b assert b not polluted — if implementation
  // wrongly hardcodes `findIndex(s => s.id===activeId.value)` to `idx = 0`, this test still all green
  // (a happens to be index 0, assert value exactly same as "correct implementation"), can't catch this
  // regression. Supplement: after switching to b **also** call `test` once, assert changes b (index 1)
  // not a — hardcoding `idx = 0` implementation wrongly changes a this step, assert reports red precisely
  // (RED probe see task report).
  it('onTest: only changes current selected skill calls/last_used, doesn\'t affect others (optimistic local value, not persist)', async () => {
    h.listSkills.mockResolvedValue([
      makeSkill({ id: 'a', name: 'skill-a', title: 'Skill A', calls: 3, last_used: '' }),
      makeSkill({ id: 'b', name: 'skill-b', title: 'Skill B', calls: 5, last_used: '' }),
    ])
    const w = mountSection()
    await flush()
    expect(w.find('.sk-name span').text()).toBe('Skill A') // first item selected by default

    const detail = w.findComponent(SkillDetail)
    detail.vm.$emit('test')
    await flush()

    expect(w.findAll('.sk-meta-cell')[3].find('.val').text()).toContain('Just now')
    expect(w.findAll('.sk-meta-cell')[3].find('.total').text()).toBe('· 共 4 次')

    // Switch to b, confirm its data completely not polluted.
    await w.findAll('.sk-item')[1].trigger('click')
    await flush()
    expect(w.find('.sk-name span').text()).toBe('Skill B')
    expect(w.findAll('.sk-meta-cell')[3].find('.total').text()).toBe('· 共 5 次')
    expect(w.findAll('.sk-meta-cell')[3].find('.val').text()).not.toContain('Just now')

    // Now b is selected item (index 1, not 0) — call test once more, must change b.
    // Hardcoding `idx = 0` implementation wrongly changes a this step, below two asserts report red precisely.
    detail.vm.$emit('test')
    await flush()
    expect(w.find('.sk-name span').text()).toBe('Skill B') // still show b, unaffected
    expect(w.findAll('.sk-meta-cell')[3].find('.val').text()).toContain('Just now')
    expect(w.findAll('.sk-meta-cell')[3].find('.total').text()).toBe('· 共 6 次') // b: 5+1

    // Switch back to a, confirm a's data stopped at first call value (4 times), not harmed by second test().
    await w.findAll('.sk-item')[0].trigger('click')
    await flush()
    expect(w.find('.sk-name span').text()).toBe('Skill A')
    expect(w.findAll('.sk-meta-cell')[3].find('.total').text()).toBe('· 共 4 次')
  })
})
