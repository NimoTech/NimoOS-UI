### Task 9: `AgentComposer.vue` —— 骨架:chips + textarea + 工具栏 + 发送/停止

**Files:**
- Create: `src/ai/components/shell/AgentComposer.vue`
- Create: `src/ai/components/shell/AgentComposer.test.ts`
- Modify: `src/i18n/{zh_cn,en_us}.ts`(删孤儿键 `aiComingSoon`,加本任务新键)

**Interfaces:**
- Consumes: `useProvidedAgentStore()`(读 `activeSessionId`/`visibleResources`,调 `removeVisibleResource`);Task 5 `composerText.ts`(`getExt`/`basename`/`dirname`);Task 6 `ContextUsageBar.vue`;`useToast()`(`src/stores/toast.ts`,`show(text, duration?)`);`KindIcon`/`AgentIcon`。
- Produces: props `{ busy?: boolean; ctxUsage?: { tokens: number; window: number; pct: number } | null }`;emits `send({ text, attachmentIds, attachmentRefs })` / `stop()` / `send-init(target: string)`。**这三个 emit 名与 payload 形状是 Task 12 接线契约,不可改。**

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  listAgentSessions: vi.fn(), createAgentSession: vi.fn(), listAgentMessages: vi.fn(),
  listMounts: vi.fn().mockResolvedValue([]), listFsEntries: vi.fn().mockResolvedValue([]),
  removeVisibleResource: vi.fn(), uploadAttachment: vi.fn(), deleteAttachment: vi.fn(),
  attachmentRawUrl: vi.fn(() => '/raw'),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: svc } }))

import AgentComposer from './AgentComposer.vue'
import { useAgentStore } from '../../stores/agentStore'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountComposer = (props = {}) =>
  mount(AgentComposer, { props, global: { plugins: [i18n] }, attachTo: document.body })

describe('AgentComposer 骨架', () => {
  beforeEach(() => { setActivePinia(createPinia()); Object.values(svc).forEach((f: any) => f.mockClear?.()) })

  it('空输入时发送键禁用;有文本后启用', async () => {
    const w = mountComposer()
    expect(w.find('.send-btn').attributes('disabled')).toBeDefined()
    await w.find('textarea').setValue('hello')
    expect(w.find('.send-btn').attributes('disabled')).toBeUndefined()
  })

  it('Enter 发送并清空;Shift+Enter 不发送', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('hi there')
    await ta.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(w.emitted('send')).toBeFalsy()
    await ta.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('send')![0][0]).toEqual({ text: 'hi there', attachmentIds: [], attachmentRefs: [] })
    expect((ta.element as HTMLTextAreaElement).value).toBe('')
  })

  it('IME 组合中的 Enter 不发送', async () => {
    const w = mountComposer()
    await w.find('textarea').setValue('中')
    await w.find('textarea').trigger('keydown', { key: 'Enter', isComposing: true })
    expect(w.emitted('send')).toBeFalsy()
  })

  it('busy 时显示停止键并 emit stop', async () => {
    const w = mountComposer({ busy: true })
    expect(w.find('.send-btn.busy').exists()).toBe(true)
    await w.find('.send-btn.busy').trigger('click')
    expect(w.emitted('stop')).toBeTruthy()
  })

  it('visibleResources 渲染成 chip,× 调 store.removeVisibleResource', async () => {
    const store = useAgentStore()
    store.activeSessionId = 'sess-1'
    store.visibleResources.push({ id: 5, path: '/DATA/docs', kind: 'folder' })
    const spy = vi.spyOn(store, 'removeVisibleResource').mockResolvedValue(undefined)
    const w = mountComposer()
    const chip = w.find('.ctx-chip')
    expect(chip.text()).toContain('docs')
    await chip.find('.ctx-chip-x').trigger('click')
    expect(spy).toHaveBeenCalledWith(5)
  })

  it('ctxUsage 存在时渲染占用环', () => {
    const w = mountComposer({ ctxUsage: { tokens: 100, window: 1000, pct: 10 } })
    expect(w.find('.ctx-usage').exists()).toBe(true)
  })

  it('Browse 按钮弹 toast 占位(BrowserModal 本期不做)', async () => {
    const w = mountComposer()
    const browse = w.findAll('.composer-tool')[0]
    await browse.trigger('click')
    // toast store 里应有一条
    const { useToast } = await import('../../../stores/toast')
    expect(useToast().toasts.length).toBe(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- src/ai/components/shell/AgentComposer.test.ts`
Expected: FAIL(组件不存在)。

- [ ] **Step 3: 实现**

按 Vue2 `shell/AgentComposer.vue` 建骨架 —— **本任务只做以下部分,附件与 mention/slash 留给 Task 10/11(先放空数组与空 handler,不留 TODO 死键)**:
- 模板:`.composer-wrap` > `.composer`(`ref="composerEl"`)> `.composer-chips`(chips 段,先只渲染 visibleResources 的 chip,Vue2 5-17)+ `<textarea ref="ta">`(45-54)+ `.composer-row`(56-113:Browse / 隐藏 file input(先只放元素,不接逻辑)/ 附件键 / 语音键 / spacer / `ContextUsageBar` / stop|send)+ `.composer-caption`(127-129)。
- 脚本:`text` ref、`grow()`(289-294,`min(scrollHeight, 220)`)、`updateAnchor()`(295-299)、`onKeydown`(336-342,含 `e.isComposing || (e as any).keyCode === 229` 双守卫)、`submit()`(436-454,attachment 部分先取空数组)、`canSend` computed(245-250)、`chips` computed(260-272,用 `basename`/`dirname`/`getExt`)、`removeChip`(430-434)、`notSupported()`(语音键 → toast)、`onBrowseClick()`(**本期偏离**:toast 占位 `aiBrowseComingSoon`)。
- `window.resize` → `updateAnchor`,`onMounted` 加、`onBeforeUnmount` 摘(282-287)。
- store 取用一律 `useProvidedAgentStore()`;`activeSessionId` 变化的 watcher 用 getter 形式 `watch(() => store.activeSessionId, ...)`(替代 Vue2 的字符串路径 watcher,275-281),本任务里只做 `closeMention()` 之外的部分 —— 即先只清附件列表的位置留到 Task 10;本任务 watcher 体先留空实现会成死代码,**故 watcher 整体挪到 Task 10 添加**。
- toast:`$buefy.toast.open` → `useToast().show(text, ms)`。错误类用 5000ms,普通提示用默认。
- 样式:`<style scoped>`(662-830)逐字搬,**但不要重复 `agent-styles.scss:352-406` 已有的布局规则**(New-UI 已 1:1 具备)。裸色处理:`var(--danger,#e57373)`/`var(--warning,#f59e0b)` → 去掉 hex 兜底只留 token;`.ctx-chip-doc-warn` 的 `rgba(245,158,11,0.12)` → `var(--warning-soft)`;`.send-btn{color:white}` → `var(--text-on-accent)`。
- **`.attach-file-input` 的 `position:absolute;1×1px;opacity:0;pointer-events:none` 写法必须逐字保留**(Vue2 663-673 有注释:`display:none` 的 input 在部分浏览器上合成 `.click()` 不触发)。

i18n 新键:`aiComposerPlaceholder`(zh:'问点什么,或用 @ 提及文件…' / en 取 Vue2 `agent.composerPlaceholder` 的英文值)、`aiComposerVoice`('语音'/'Voice')、`aiComposerCaption`(Vue2 128 行整句)、`aiComposerBrowse`('浏览'/'Browse')、`aiComposerBrowseTitle`('浏览 NAS'/'Browse NAS')、`aiBrowseComingSoon`('浏览弹窗将在后续版本开启'/'The browser dialog is coming in a later release')、`aiNotSupportedYet`('该功能暂未支持'/'This feature is not yet supported')。**删掉孤儿键 `aiComingSoon`(zh_cn.ts:567 + en_us 对应行)** —— grep 确认零引用后再删。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- src/ai/components/shell/AgentComposer.test.ts src/i18n/parity.test.ts`
Expected: 全绿。
Run: `grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*white' src/ai/components/shell/AgentComposer.vue` → 无输出。

- [ ] **Step 5: Commit**

```bash
git add src/ai/components/shell/AgentComposer.vue src/ai/components/shell/AgentComposer.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "SP8-P1c1: AgentComposer skeleton (chips + textarea + toolbar + send/stop)"
```

---

