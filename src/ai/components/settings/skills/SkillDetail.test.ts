import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import zh from '../../../../i18n/zh_cn'
import SkillDetail from './SkillDetail.vue'
import type { Skill } from '../../../types/skill'

// SP8-P3a Task 5 — align with Vue2 src/views/AI/Skills/SkillDetail.vue (271 lines) read-only half.
// SP8-P3b Task 6 — add write operations: switch + more menu (disable/copy/export/delete) + delete confirmation dialog.
// Shared constraint §9: vi.mock skeleton use vi.hoisted() to avoid ESM hoisting TDZ ReferenceError.
const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

// Task 6 — export button uses synchronous URL builder (not axios call), copy button uses
// `copyText` internal to `useCopyFeedback` (insecure context execCommand fallback, see module header comment).
// mock technique completely same as McpTokensSection.test.ts (existing mock precedent for same function pair).
const h = vi.hoisted(() => ({
  exportSkillURL: vi.fn((id: string) => `/v1/ai/skills/${id}/export?token=abc`),
  copyText: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: { ai: { exportSkillURL: h.exportSkillURL } },
}))
vi.mock('../../../../files/util/clipboard', () => ({ copyText: h.copyText }))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'sk-1',
    name: 'weekly-report',
    title: 'Weekly Report',
    description: 'Summarizes the week and posts it to the family channel.',
    trigger: 'manual',
    // Intentionally write trigger_human semantically inconsistent with real trigger, specifically nail down deviation 4
    // (UI must never read this field — see "trigger_human trap" test case below).
    trigger_human: 'WRONG',
    color: 'blue',
    icon: 'sparkle',
    enabled: true,
    system: false,
    author: 'Alice',
    last_used: '',
    calls: 3,
    files: [],
    examples: [],
    md: '',
    ...overrides,
  }
}

// Task 6 — delete confirmation dialog portals to `.set-app` (see component header comment "Deviation notice 2" /
// SkModal.vue D1), test must pre-place same-named host in body, precedent SkModal.test.ts::withHost().
function withHost(): HTMLElement {
  const host = document.createElement('div')
  host.className = 'set-app'
  document.body.appendChild(host)
  return host
}

const mountDetail = (skill: Skill | null, props: { busy?: Record<string, boolean> } = {}) =>
  mount(SkillDetail, {
    props: { skill, ...props },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })

// Shared constraint §9: async assertions use flushPromises(), not single await nextTick().
const flush = async () => { await flushPromises(); await nextTick() }

describe('SkillDetail (read-only half + P3b write operations half)', () => {
  let host: HTMLElement

  beforeEach(() => {
    push.mockClear()
    h.exportSkillURL.mockClear()
    h.copyText.mockClear()
    // useCopyFeedback() internally calls useToast() (Pinia store), unconditionally
    // called once during component setup(), so each test needs active Pinia, not just copy-related cases.
    setActivePinia(createPinia())
    host = withHost()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('empty state: when skill=null show two lines of text, do not render detail bar', () => {
    const w = mountDetail(null)
    expect(w.find('.sk-detail-empty').exists()).toBe(true)
    expect(w.find('.empty-title').text()).toBe('在左侧选择一个技能')
    expect(w.find('.empty-sub').text()).toBe('或者新建一个 —— Nimo 会在触发器命中时自动调用。')
    expect(w.find('.sk-detail-bar').exists()).toBe(false)
  })

  // [Reversal, SP8-P3b Task 6, shared constraint §9 explicitly requires "reversal not deletion"] P3a version asserts
  // these three write control elements "must not appear at all"; after P3b lands `.sw`/`.sk-pill-more` must render,
  // `.sk-menu` still false — but semantics changed from "never render" to "default collapsed" (menu expand
  // interaction covered by dedicated test cases below). Before/after original text pasted in task report.
  it('top bar: title / name code / try button / switch / more menu button all rendered (P3b write operations landed)', () => {
    const w = mountDetail(makeSkill({ title: 'Weekly Report', name: 'weekly-report' }))
    expect(w.find('.sk-name span').text()).toBe('Weekly Report')
    expect(w.find('.sk-name code').text()).toBe('weekly-report')
    expect(w.find('.sk-pill-try').exists()).toBe(true)
    expect(w.find('.sk-pill-try').text()).toContain('在对话中试用')
    expect(w.find('.sw').exists()).toBe(true)
    expect(w.find('.sk-pill-more').exists()).toBe(true)
    expect(w.find('.sk-menu').exists()).toBe(false)
  })

  it('four info cells: status (enabled) / trigger mode / source / last run + total count', () => {
    const w = mountDetail(makeSkill({
      enabled: true,
      trigger: 'manual',
      author: 'Alice',
      last_used: '2026-07-29 08:00',
      calls: 1234,
    }))
    const cells = w.findAll('.sk-meta-cell')
    expect(cells).toHaveLength(4)
    expect(cells[0].find('.lbl').text()).toBe('状态')
    expect(cells[0].find('.val').text()).toContain('已启用')
    expect(cells[0].find('.val').attributes('data-disabled')).toBe('false')
    expect(cells[1].find('.lbl').text()).toBe('触发方式')
    expect(cells[2].find('.lbl').text()).toBe('来源')
    expect(cells[2].find('.val').text()).toBe('Alice')
    expect(cells[3].find('.lbl').text()).toBe('上次运行')
    expect(cells[3].find('.val').text()).toContain('2026-07-29 08:00')
    expect(cells[3].find('.total').text()).toBe('· 共 1,234 次')
  })

  it('status cell: disabled state shows "paused" and data-disabled=true', () => {
    const w = mountDetail(makeSkill({ enabled: false }))
    const statusVal = w.findAll('.sk-meta-cell')[0].find('.val')
    expect(statusVal.text()).toContain('已暂停')
    expect(statusVal.attributes('data-disabled')).toBe('true')
  })

  it('status dot carries no inline styles (color entirely delegated to SCSS data-disabled selector, not inline rgba)', () => {
    const wEnabled = mountDetail(makeSkill({ enabled: true }))
    const wDisabled = mountDetail(makeSkill({ enabled: false }))
    expect(wEnabled.find('.dot').attributes('style')).toBeUndefined()
    expect(wDisabled.find('.dot').attributes('style')).toBeUndefined()
  })

  it('three trigger types in detail cell display: auto=automatic, manual=manual, slash=/skill name', () => {
    const wAuto = mountDetail(makeSkill({ trigger: 'auto' }))
    expect(wAuto.findAll('.sk-meta-cell')[1].find('.val').text()).toBe('自动触发')

    const wManual = mountDetail(makeSkill({ trigger: 'manual' }))
    expect(wManual.findAll('.sk-meta-cell')[1].find('.val').text()).toBe('手动')

    const wSlash = mountDetail(makeSkill({ trigger: 'slash', name: 'weekly-report' }))
    expect(wSlash.findAll('.sk-meta-cell')[1].find('.val').text()).toBe('/weekly-report')
  })

  it('unknown trigger shows trigger string as-is (fallback when triggerLabel returns null)', () => {
    const w = mountDetail(makeSkill({ trigger: 'some-future-trigger' }))
    expect(w.findAll('.sk-meta-cell')[1].find('.val').text()).toBe('some-future-trigger')
  })

  it('trigger_human trap: trigger=auto but trigger_human=WRONG, UI must show "automatic" not WRONG (nail down deviation 4)', () => {
    const w = mountDetail(makeSkill({ trigger: 'auto', trigger_human: 'WRONG' }))
    const text = w.findAll('.sk-meta-cell')[1].find('.val').text()
    expect(text).toBe('自动触发')
    expect(text).not.toContain('WRONG')
    expect(w.text()).not.toContain('WRONG')
  })

  it("author='You' localized to 'you', real names shown as-is", () => {
    const wYou = mountDetail(makeSkill({ author: 'You' }))
    expect(wYou.findAll('.sk-meta-cell')[2].find('.val').text()).toBe('你')

    const wBob = mountDetail(makeSkill({ author: 'Bob Chen' }))
    expect(wBob.findAll('.sk-meta-cell')[2].find('.val').text()).toBe('Bob Chen')
  })

  it('last_used empty string shows em dash (—), no relative time mapping', () => {
    const w = mountDetail(makeSkill({ last_used: '' }))
    expect(w.findAll('.sk-meta-cell')[3].find('.val').text()).toContain('—')
  })

  it('description section: show description as-is, no localization', () => {
    const w = mountDetail(makeSkill({ description: '一段自由文本描述,含标点。' }))
    expect(w.find('.sk-description').text()).toBe('一段自由文本描述,含标点。')
  })

  // [Reversal, SP8-P3b Task 7, shared constraint §9 explicitly requires "reversal not deletion"] P3a version (before change original text
  // in diff above) asserts TestPanel "completely not rendered"; T7 mounts it back to Vue2 :108-112 location,
  // now must assert **exists and correct order** — not just "exists" (exists but at end of file still passes weak assertion,
  // cannot nail down "between description and SKILL.md" location requirement), so traverse all `.sk-section-title` by DOM
  // order, assert TestPanel's own section title exactly between "description" and "SKILL.md" titles.
  it('TestPanel mounted between description and SKILL.md sections (P3b landed, assert by DOM order, not just "exists")', () => {
    const w = mountDetail(makeSkill())
    const tp = w.findComponent({ name: 'TestPanel' })
    expect(tp.exists()).toBe(true)
    const titles = w.findAll('.sk-section-title').map((n) => n.text())
    expect(titles).toEqual(['描述', '沙箱测试', 'SKILL.md', '附带文件'])
  })

  it('SKILL.md section: markdown renders real HTML (not escaped source text)', () => {
    const w = mountDetail(makeSkill({ md: '# Title\n\nSome **bold** text.' }))
    const mdHtml = w.find('.sk-md').html()
    expect(mdHtml).toContain('<strong>bold</strong>')
    expect(mdHtml).not.toContain('# Title')
  })

  it('SKILL.md empty string throws no error, renders empty content', () => {
    const w = mountDetail(makeSkill({ md: '' }))
    expect(w.find('.sk-md').text()).toBe('')
  })

  it('bundled files: render name/size per line, section header hint shows file count', () => {
    const w = mountDetail(makeSkill({
      files: [
        { name: 'notes.txt', size: '12 B' },
        { name: 'archive.zip', size: '1.0 MB' },
      ],
    }))
    const rows = w.findAll('.sk-file-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].find('.name').text()).toBe('notes.txt')
    expect(rows[0].find('.size').text()).toBe('12 B')
    expect(rows[1].find('.name').text()).toBe('archive.zip')
    expect(rows[1].find('.size').text()).toBe('1.0 MB')
    // Final review M2: detail page has 3 `.sk-section-hint` total (description :152 / SKILL.md :165 /
    // bundled files :175), `w.find()` only returns first (description's hint), original assertion only checked
    // `.exists()` hit is description, `filesHint` computed property (SkillDetail.vue:78)
    // zero coverage (hardcoding `n` as any constant still all green). Changed to precisely locate third hint and assert
    // its text (aiSkNFiles = '{n} files', 2 files → '2 files').
    // [SP8-P3b Task 7 update] After TestPanel hangs back between description and SKILL.md sections, its own section header
    // also carries `.sk-section-hint` (aiSkTestHint), sequence changes from 3 to 4, "bundled files"
    // section's hint accordingly moves from index 2 to 3 — this is structural shift, not assertion weakened.
    const hints = w.findAll('.sk-section-hint')
    expect(hints).toHaveLength(4)
    expect(hints[3].text()).toBe('2 个文件')
  })

  it('directory size "(3 files)" localized to Chinese "3 files", regular file byte units passed through', () => {
    const w = mountDetail(makeSkill({
      files: [
        { name: 'assets', size: '(3 files)' },
        { name: 'notes.txt', size: '12 B' },
      ],
    }))
    const rows = w.findAll('.sk-file-row')
    expect(rows[0].find('.size').text()).toBe('3 个文件')
    expect(rows[1].find('.size').text()).toBe('12 B')
  })

  it('bundled files empty array shows empty state "no bundled files"', () => {
    const w = mountDetail(makeSkill({ files: [] }))
    const rows = w.findAll('.sk-file-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].find('.name').text()).toBe('没有附带文件')
  })

  it('bundled files is null (backend nil slice serialization pitfall) also shows empty state, no error', () => {
    const w = mountDetail(makeSkill({ files: null as unknown as Skill['files'] }))
    const rows = w.findAll('.sk-file-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].find('.name').text()).toBe('没有附带文件')
  })

  it('"Try in chat": click push to /ai/agent with correct skill id query parameter', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-42' }))
    await w.find('.sk-pill-try').trigger('click')
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith({ path: '/ai/agent', query: { skill: 'sk-42' } })
  })

  // ===== SP8-P3b Task 6 — top bar write operations + delete confirmation dialog =====

  it('switch: data-on/aria-checked reflects enabled, click emits toggle(id, !enabled)', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-1', enabled: true }))
    const sw = w.find('.sw')
    expect(sw.attributes('data-on')).toBe('true')
    expect(sw.attributes('aria-checked')).toBe('true')
    await sw.trigger('click')
    expect(w.emitted('toggle')).toEqual([['sk-1', false]])
  })

  it('disabled switch: data-on=false, click emits toggle(id, true)', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-1', enabled: false }))
    const sw = w.find('.sw')
    expect(sw.attributes('data-on')).toBe('false')
    await sw.trigger('click')
    expect(w.emitted('toggle')).toEqual([['sk-1', true]])
  })

  it('when busy[id] true switch disabled (aria-disabled=true), empty object/other ids not disabled', () => {
    const wBusy = mountDetail(makeSkill({ id: 'sk-9' }), { busy: { 'sk-9': true } })
    expect(wBusy.find('.sw').attributes('aria-disabled')).toBe('true')

    const wIdle = mountDetail(makeSkill({ id: 'sk-9' }), { busy: {} })
    expect(wIdle.find('.sw').attributes('aria-disabled')).toBe('false')

    const wOther = mountDetail(makeSkill({ id: 'sk-9' }), { busy: { 'sk-other': true } })
    expect(wOther.find('.sw').attributes('aria-disabled')).toBe('false')
  })

  it('more menu: click .sk-pill-more toggle open/close', async () => {
    const w = mountDetail(makeSkill())
    expect(w.find('.sk-menu').exists()).toBe(false)
    await w.find('.sk-pill-more').trigger('click')
    expect(w.find('.sk-menu').exists()).toBe(true)
    await w.find('.sk-pill-more').trigger('click')
    expect(w.find('.sk-menu').exists()).toBe(false)
  })

  it('more menu: external mousedown closes menu, menu internal click does not trigger external close logic', async () => {
    const w = mountDetail(makeSkill())
    await w.find('.sk-pill-more').trigger('click')
    expect(w.find('.sk-menu').exists()).toBe(true)

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flush()
    expect(w.find('.sk-menu').exists()).toBe(false)

    // [P3b final review M2] Only tested "external" above, title promises "menu internal click does not trigger external close logic"
    // previously zero assertion — `useClickOutside` uses `el.contains(event.target)` to judge (see composable
    // header comment), `.sk-menu` is child of `menuWrap`, mousedown inside should be judged as
    // "inside", not close menu. Here add back the half promised in title.
    await w.find('.sk-pill-more').trigger('click')
    expect(w.find('.sk-menu').exists()).toBe(true)
    w.find('.sk-menu button').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flush()
    expect(w.find('.sk-menu').exists()).toBe(true)
  })

  it('menu item order and text: pause/enable → copy SKILL.md → export skill → <hr> → danger item', async () => {
    const w = mountDetail(makeSkill({ enabled: true, system: false }))
    await w.find('.sk-pill-more').trigger('click')
    const menu = w.find('.sk-menu')
    const buttons = menu.findAll('button')
    expect(buttons).toHaveLength(4)
    expect(buttons[0].text()).toContain('临时禁用')
    expect(buttons[1].text()).toContain('复制 SKILL.md')
    expect(buttons[2].text()).toContain('导出技能')
    expect(buttons[3].attributes('data-danger')).toBe('true')
    expect(buttons[3].text()).toContain('删除技能')
    expect(menu.find('hr').exists()).toBe(true)
  })

  it('menu first item (pause/enable): when enabled text "pause temporarily", when disabled text "enable", both emit toggle', async () => {
    const wEnabled = mountDetail(makeSkill({ id: 'sk-1', enabled: true }))
    await wEnabled.find('.sk-pill-more').trigger('click')
    const btnsEnabled = wEnabled.findAll('.sk-menu button')
    expect(btnsEnabled[0].text()).toContain('临时禁用')
    await btnsEnabled[0].trigger('click')
    expect(wEnabled.emitted('toggle')).toEqual([['sk-1', false]])
    // closeAnd closes menu first then execute action.
    expect(wEnabled.find('.sk-menu').exists()).toBe(false)

    const wDisabled = mountDetail(makeSkill({ id: 'sk-1', enabled: false }))
    await wDisabled.find('.sk-pill-more').trigger('click')
    const btnsDisabled = wDisabled.findAll('.sk-menu button')
    expect(btnsDisabled[0].text()).toContain('启用')
    await btnsDisabled[0].trigger('click')
    expect(wDisabled.emitted('toggle')).toEqual([['sk-1', true]])
  })

  it('danger item text: built-in skills show "uninstall", user skills show "delete skill"', async () => {
    const wSystem = mountDetail(makeSkill({ system: true }))
    await wSystem.find('.sk-pill-more').trigger('click')
    const dangerSystem = wSystem.findAll('.sk-menu button')[3]
    expect(dangerSystem.text()).toContain('卸载')
    expect(dangerSystem.text()).not.toContain('删除')

    const wUser = mountDetail(makeSkill({ system: false }))
    await wUser.find('.sk-pill-more').trigger('click')
    const dangerUser = wUser.findAll('.sk-menu button')[3]
    expect(dangerUser.text()).toContain('删除技能')
  })

  it('click "copy SKILL.md" calls copyText with skill.md, menu closes immediately after click', async () => {
    const w = mountDetail(makeSkill({ md: '# Title\n\nBody.' }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[1].trigger('click')
    expect(h.copyText).toHaveBeenCalledWith('# Title\n\nBody.')
    expect(w.find('.sk-menu').exists()).toBe(false)
  })

  it('when SKILL.md empty string, copyText receives empty string (not undefined)', async () => {
    const w = mountDetail(makeSkill({ md: '' }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[1].trigger('click')
    expect(h.copyText).toHaveBeenCalledWith('')
  })

  it('click "export skill": created <a> has correct href/download and clicked once', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const w = mountDetail(makeSkill({ id: 'sk-7', name: 'weekly-report' }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[2].trigger('click')

    expect(h.exportSkillURL).toHaveBeenCalledWith('sk-7')
    const anchor = appendSpy.mock.calls.find((c) => c[0] instanceof HTMLAnchorElement)?.[0] as HTMLAnchorElement
    expect(anchor).toBeTruthy()
    expect(anchor.getAttribute('href')).toBe('/v1/ai/skills/sk-7/export?token=abc')
    expect(anchor.getAttribute('download')).toBe('weekly-report.tar.gz')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    // menu closes immediately after click.
    expect(w.find('.sk-menu').exists()).toBe(false)

    clickSpy.mockRestore()
    appendSpy.mockRestore()
  })

  it('export: when skill has no name, download falls back to "skill.tar.gz"', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const w = mountDetail(makeSkill({ id: 'sk-8', name: '' }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[2].trigger('click')

    const anchor = appendSpy.mock.calls.find((c) => c[0] instanceof HTMLAnchorElement)?.[0] as HTMLAnchorElement
    expect(anchor.getAttribute('download')).toBe('skill.tar.gz')

    clickSpy.mockRestore()
    appendSpy.mockRestore()
  })

  it('click danger item: open confirmation dialog (portal into .set-app), menu closes simultaneously', async () => {
    const w = mountDetail(makeSkill({ system: false }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[3].trigger('click')
    await flush()
    expect(w.find('.sk-menu').exists()).toBe(false)
    expect(host.querySelector('.sk-confirm')).not.toBeNull()
    // key assertion: dialog node in .set-app container, not directly on body (D1, same as SkModal.test.ts).
    expect(host.querySelector('.sk-confirm')!.closest('.set-app')).toBe(host)
  })

  it('confirmation dialog: built-in skill title/body (D3 truthful text, no "reinstall")/button/historical runs', async () => {
    const w = mountDetail(makeSkill({ system: true, calls: 7, name: 'built-in-skill' }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[3].trigger('click')
    await flush()

    expect(host.querySelector('.sk-confirm-body h3')?.textContent).toBe('卸载这个技能?')
    const body = host.querySelector('.sk-confirm-body p')?.textContent ?? ''
    expect(body).not.toContain('重新安装')
    expect(host.querySelector('.sk-confirm-skill .name')?.textContent).toBe('built-in-skill')
    expect(host.querySelector('.sk-confirm-skill .runs')?.textContent).toBe('历史运行 7 次')
    expect(host.querySelector('.sk-btn.danger')?.textContent).toContain('卸载')
  })

  it('confirmation dialog: user skill title/body/button text (different wording from built-in)', async () => {
    const w = mountDetail(makeSkill({ system: false, calls: 7 }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[3].trigger('click')
    await flush()

    expect(host.querySelector('.sk-confirm-body h3')?.textContent).toBe('删除这个技能?')
    expect(host.querySelector('.sk-confirm-body p')?.textContent)
      .toBe('这会永久删除该技能及其 SKILL.md 文件,无法恢复。')
    expect(host.querySelector('.sk-btn.danger')?.textContent).toContain('删除')
    expect(host.querySelector('.sk-btn.danger')?.textContent).not.toContain('卸载')
  })

  it('confirmation dialog: click confirm button emits delete(id) and closes dialog', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-3', system: false }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[3].trigger('click')
    await flush()

    const confirmBtn = host.querySelector('.sk-btn.danger') as HTMLButtonElement
    confirmBtn.click()
    await flush()

    expect(w.emitted('delete')).toEqual([['sk-3']])
    expect(host.querySelector('.sk-confirm')).toBeNull()
  })

  it('confirmation dialog: click cancel button no emit delete, dialog closes', async () => {
    const w = mountDetail(makeSkill({ system: false }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[3].trigger('click')
    await flush()

    const cancelBtn = host.querySelector('.sk-btn.ghost') as HTMLButtonElement
    cancelBtn.click()
    await flush()

    expect(w.emitted('delete')).toBeUndefined()
    expect(host.querySelector('.sk-confirm')).toBeNull()
  })

  it('skill.id change resets menu (menu closes when switching skills mid-open)', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-1' }))
    await w.find('.sk-pill-more').trigger('click')
    expect(w.find('.sk-menu').exists()).toBe(true)

    await w.setProps({ skill: makeSkill({ id: 'sk-2' }) })
    await flush()
    expect(w.find('.sk-menu').exists()).toBe(false)
  })

  it('skill.id change resets confirmation dialog (dialog closes when switching skills mid-open)', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-1', system: false }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[3].trigger('click')
    await flush()
    expect(host.querySelector('.sk-confirm')).not.toBeNull()

    await w.setProps({ skill: makeSkill({ id: 'sk-2' }) })
    await flush()
    expect(host.querySelector('.sk-confirm')).toBeNull()
  })

  // ===== SP8-P3b Task 7 — D4 dialog (disabled skill "try in chat" prompt first) + TestPanel test forward =====
  // D4 dialog uses SkModal (standard shell), not bare reka primitives from delete confirmation above, so assertions use
  // `.sk-modal-title`/`.sk-btn.primary`/`.sk-btn.ghost` SkModal existing precedent
  // (same as ChannelsSection.test.ts "3. genCode..." case to query `.sk-modal`), not
  // `.sk-confirm*` (those are delete dialog exclusive classes).

  it('D4: disabled skill "try in chat" no navigate, shows confirmation dialog (title/body match i18n text)', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-1', enabled: false }))
    await w.find('.sk-pill-try').trigger('click')
    await flush()
    expect(push).not.toHaveBeenCalled()
    expect(host.querySelector('.sk-modal-title')?.textContent).toBe('该技能已停用')
    expect(host.querySelector('.sk-modal')?.textContent).toContain('停用的技能不会被加载')
  })

  // [Review Important 1, task simplified design doc §9.4: "navigate only on success; on failure stay in dialog +
  // danger toast, no navigate" — dialog must stay open until parent truly changes enabled to true, not close at toggle moment.
  // Below three cover ① after click dialog still open, no push ② enabled becomes true then dialog closes+push ③ fails (prop unchanged) → dialog still open, never push.]

  it('D4 "enable and try": after click dialog still open, no push, only emit toggle(id,true)', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-5', enabled: false }))
    await w.find('.sk-pill-try').trigger('click')
    await flush()

    const enableBtn = host.querySelector('.sk-btn.primary') as HTMLButtonElement
    enableBtn.click()
    await flush()
    expect(w.emitted('toggle')).toEqual([['sk-5', true]])
    // toggle request moment no navigate yet — parent not yet said enable succeeded, dialog must stay
    // (design doc §9.4, not "close on send").
    expect(push).not.toHaveBeenCalled()
    expect(host.querySelector('.sk-modal-title')?.textContent).toBe('该技能已停用')
  })

  it('D4 "enable and try": parent changes enabled to true (toggle succeeds), dialog closes + push same step', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-5', enabled: false }))
    await w.find('.sk-pill-try').trigger('click')
    await flush()
    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
    await flush()

    await w.setProps({ skill: makeSkill({ id: 'sk-5', enabled: true }) })
    await flush()
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith({ path: '/ai/agent', query: { skill: 'sk-5' } })
    expect(host.querySelector('.sk-modal')).toBeNull()
  })

  it('D4: toggle fails (parent doesn\'t change enabled) → dialog still open, never push', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-6', enabled: false }))
    await w.find('.sk-pill-try').trigger('click')
    await flush()
    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
    await flush()
    expect(w.emitted('toggle')).toEqual([['sk-6', true]])

    // parent request fails: enabled unchanged (still false) — not "cancel", failure state.
    // dialog must stay (design doc §9.4), user can retry or cancel; danger toast by
    // parent (T8 SkillsSection.onToggle), this component no repeat.
    await w.setProps({ skill: makeSkill({ id: 'sk-6', enabled: false }) })
    await flush()
    expect(push).not.toHaveBeenCalled()
    expect(host.querySelector('.sk-modal-title')?.textContent).toBe('该技能已停用')
  })

  it('D4: click "cancel" close dialog, no push, no emit toggle', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-7', enabled: false }))
    await w.find('.sk-pill-try').trigger('click')
    await flush()
    ;(host.querySelector('.sk-btn.ghost') as HTMLButtonElement).click()
    await flush()
    expect(host.querySelector('.sk-modal')).toBeNull()
    expect(push).not.toHaveBeenCalled()
    expect(w.emitted('toggle')).toBeUndefined()
  })

  // [P3b final review I1] Besides click "cancel" / `skill.id` change, SkModal's built-in X close button
  // (`.sk-x`), reka's Esc, click overlay all only go through `@update:open` — this path previously didn't clear
  // `pendingTryId`, with registration hanging, user later using top bar switch to enable this skill once (completely unrelated
  // to "enable and try") would be misparsed as "waiting to navigate" and push. RED verification: delete
  // `if (!v) pendingTryId.value = null` in `onTryModalOpenChange` → this case precisely reports red (push called 1 time,
  // assertion expects 0).
  it('D4: close dialog with .sk-x (not cancel button) then clear registration — later manual switch enable should not trigger push', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-8', enabled: false }))
    await w.find('.sk-pill-try').trigger('click')
    await flush()
    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
    await flush()
    expect(w.emitted('toggle')).toEqual([['sk-8', true]])

    // toggle request "fails" (parent never changes enabled to true) — close the dialog with X, not cancel.
    ;(host.querySelector('.sk-x') as HTMLButtonElement).click()
    await flush()
    expect(host.querySelector('.sk-modal')).toBeNull()

    // Afterwards the user enables this skill themselves from the top bar (an independent action unrelated to "enable and try").
    await w.setProps({ skill: makeSkill({ id: 'sk-8', enabled: true }) })
    await flush()
    expect(push).not.toHaveBeenCalled()
  })

  it('D4 "enable and try" registered then switch to another skill, original skill\'s late enabled=true no longer triggers push (residual clear, pendingTryId one-time)', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-10', enabled: false }))
    await w.find('.sk-pill-try').trigger('click')
    await flush()
    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
    await flush()
    expect(w.emitted('toggle')).toEqual([['sk-10', true]])

    // Before the response arrives, the user has already switched to another skill — the watch on skill.id change clears the registration.
    await w.setProps({ skill: makeSkill({ id: 'sk-11', enabled: false }) })
    await flush()

    // The late response only now flips sk-10's enabled to true (the user switched back to sk-10) — because
    // the registration was already cleared at the moment of the switch, it must not be misread as "pending navigation" and push.
    await w.setProps({ skill: makeSkill({ id: 'sk-10', enabled: true }) })
    await flush()
    expect(push).not.toHaveBeenCalled()
  })

  // [Review Important 2 ①] Nail down "clear pendingTryId before navigate" line itself (different from "residual clear" above —
  // that one nails skill.id change reset watch; this one nails success branch clearing pendingTryId itself, must hold even same skill no id change).
  // RED verification: delete `pendingTryId.value = null` in success branch → this case precisely reports red (second push counted extra once).
  it('D4: after successful navigate once, same skill later manually switch multiple times, push total still 1 (registration consumed, no lingering repeat)', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-3', enabled: false }))
    await w.find('.sk-pill-try').trigger('click')
    await flush()
    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
    await flush()
    await w.setProps({ skill: makeSkill({ id: 'sk-3', enabled: true }) })
    await flush()
    expect(push).toHaveBeenCalledTimes(1)

    // The user later turns this skill off and back on themselves via the switch — must not be misread as "pending navigation" and navigate again.
    await w.setProps({ skill: makeSkill({ id: 'sk-3', enabled: false }) })
    await flush()
    await w.setProps({ skill: makeSkill({ id: 'sk-3', enabled: true }) })
    await flush()
    expect(push).toHaveBeenCalledTimes(1)
  })

  // [Review Important 2 ②] Nail down `if (enabled === true)` check itself. Construct synthetic race:
  // D4 dialog open (before click confirm), skill enabled elsewhere (enabled becomes true) — pendingTryId
  // still null, watcher idles; then user still clicks confirm (pendingTryId registers), because enabled
  // already true, won't trigger "from non-true to true" change, pendingTryId lingers; immediately after
  // enabled changed back to false elsewhere, watcher truly triggers first time, newVal=false — must not push.
  // RED verification: delete `if (enabled === true)` check (becomes unconditional clear registration+push once in if block)
  // → this case precisely reports red.
  it('D4: watcher truly triggers first time after registration with enabled=false (not true) → no push (nail down `if (enabled === true)` check)', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-9', enabled: false }))
    await w.find('.sk-pill-try').trigger('click')
    await flush()
    // Synthetic race: the skill gets enabled elsewhere while the dialog is open (confirm hasn't been clicked yet, pendingTryId is still null).
    await w.setProps({ skill: makeSkill({ id: 'sk-9', enabled: true }) })
    await flush()
    expect(push).not.toHaveBeenCalled()
    // The user still clicks confirm — enabled is already true, so it doesn't count as a "change," the watcher
    // won't fire again, and the pendingTryId registration lingers uncleared.
    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
    await flush()
    expect(w.emitted('toggle')).toEqual([['sk-9', true]])
    // enabled gets flipped back to false elsewhere — the watcher truly fires for the first time, with newVal false.
    await w.setProps({ skill: makeSkill({ id: 'sk-9', enabled: false }) })
    await flush()
    expect(push).not.toHaveBeenCalled()
  })

  it('when enabled === true click "try in chat" jump directly, no D4 dialog (P3a existing behavior not regressed)', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-42', enabled: true }))
    await w.find('.sk-pill-try').trigger('click')
    await flush()
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith({ path: '/ai/agent', query: { skill: 'sk-42' } })
    expect(host.querySelector('.sk-modal')).toBeNull()
  })

  it('TestPanel\'s test event forwarded up as this component\'s test emit', async () => {
    const w = mountDetail(makeSkill())
    const tp = w.findComponent({ name: 'TestPanel' })
    expect(tp.exists()).toBe(true)
    tp.vm.$emit('test')
    await flush()
    expect(w.emitted('test')).toHaveLength(1)
  })
})
