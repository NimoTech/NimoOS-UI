### Task 7: `MentionPopover.vue`(@ 提及面板)

**Files:**
- Create: `src/ai/components/shell/MentionPopover.vue`
- Create: `src/ai/components/shell/MentionPopover.test.ts`
- Modify: `src/ai/styles/tokens.scss`(+`--hairline-ring`)
- Modify: `src/i18n/{zh_cn,en_us}.ts`

**Interfaces:**
- Consumes: Task 5 `mentionFormat.ts`;`service.ai.listMounts()` / `service.ai.listFsEntries(path, showIgnored)`;`KindIcon.vue`(props `kind/ext/color/size`)、`AgentIcon.vue`(`chev`/`refresh`/`search`)。
- Produces: 组件 props `{ open: boolean; query?: string; segments?: string[]; anchorRect?: DOMRect | null }`;emits `drill-in(item)` / `pick(item)` / `pop-segment()` / `close()`。`item` 形状:`{ name: string; resolvedPath: string; kind: 'drive'|'folder'|'file'; ext?: string; size?: number; modified?: number|string; ignored?: boolean; color?: string; capacity?: number; used?: number }`。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'

const svc = vi.hoisted(() => ({ listMounts: vi.fn(), listFsEntries: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: svc } }))
import MentionPopover from './MentionPopover.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const g = { plugins: [i18n] }

describe('MentionPopover', () => {
  beforeEach(() => {
    svc.listMounts.mockReset(); svc.listFsEntries.mockReset()
    svc.listMounts.mockResolvedValue([{ label: 'Drive1', path: '/DATA', capacity: 100, used: 20 }])
    svc.listFsEntries.mockResolvedValue([
      { path: '/DATA/docs', kind: 'dir', name: 'docs' },
      { path: '/DATA/a.txt', kind: 'file', name: 'a.txt', size: 12 },
    ])
  })

  it('open 时拉 mounts 并渲染条目', async () => {
    const w = mount(MentionPopover, { props: { open: true, query: '', segments: [] }, global: g })
    await flushPromises()
    expect(svc.listMounts).toHaveBeenCalled()
    expect(w.findAll('.mention-item')).toHaveLength(1)
    expect(w.text()).toContain('Drive1')
  })

  it('有 segments 时拉该目录条目', async () => {
    const w = mount(MentionPopover, { props: { open: true, query: '', segments: ['Drive1'] }, global: g })
    await flushPromises()
    expect(svc.listFsEntries).toHaveBeenCalledWith('/DATA', false)
    expect(w.findAll('.mention-item')).toHaveLength(2)
  })

  it('query 过滤:startsWith 优先于 includes', async () => {
    svc.listFsEntries.mockResolvedValue([
      { path: '/DATA/mydoc', kind: 'dir', name: 'mydoc' },
      { path: '/DATA/doc', kind: 'dir', name: 'doc' },
    ])
    const w = mount(MentionPopover, { props: { open: true, query: 'doc', segments: ['Drive1'] }, global: g })
    await flushPromises()
    const names = w.findAll('.mention-name').map((n) => n.text())
    expect(names[0]).toContain('doc')
    expect(names).toHaveLength(2)
  })

  it('点击文件 emit pick;点击目录 emit drill-in', async () => {
    const w = mount(MentionPopover, { props: { open: true, query: '', segments: ['Drive1'] }, global: g })
    await flushPromises()
    const items = w.findAll('.mention-item')
    await items[1].trigger('click')            // a.txt
    expect(w.emitted('pick')).toBeTruthy()
    await items[0].trigger('click')            // docs
    expect(w.emitted('drill-in')).toBeTruthy()
  })

  it('键盘:↓ 移高亮、Escape emit close、无 query 时 Backspace emit pop-segment', async () => {
    const w = mount(MentionPopover, { props: { open: true, query: '', segments: ['Drive1'] }, global: g, attachTo: document.body })
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    await w.vm.$nextTick()
    expect(w.findAll('.mention-item')[1].attributes('data-active')).toBe('true')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toBeTruthy()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))
    expect(w.emitted('pop-segment')).toBeTruthy()
    w.unmount()
  })

  it('卸载后不再响应 window keydown(监听已摘)', async () => {
    const w = mount(MentionPopover, { props: { open: true, query: '', segments: [] }, global: g, attachTo: document.body })
    await flushPromises()
    w.unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toBeFalsy()
  })

  it('抓取失败时不抛未处理 rejection,退空列表', async () => {
    svc.listMounts.mockRejectedValue(new Error('net'))
    const w = mount(MentionPopover, { props: { open: true, query: '', segments: [] }, global: g })
    await flushPromises()
    expect(w.findAll('.mention-item')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- src/ai/components/shell/MentionPopover.test.ts`
Expected: FAIL(组件不存在)。

- [ ] **Step 3: 实现**

逐字港 Vue2 `shell/MentionPopover.vue`。**机械转换清单(必须全做到)**:
1. `$set(loadingPaths, abs, v)` / `$set(entriesByPath, abs, entries)`(215-234)→ `ref<Record<string, …>>` 直接赋值。
2. `beforeDestroy`(195-197)→ `onBeforeUnmount`,摘掉 `window.keydown` 捕获监听;**`open` watcher 里 add/remove 的配对逻辑保留**(172-181)。
3. `v-for` + `v-else` 同元素(44-46)→ 外层 `<template v-else>` 包住 `v-for`。
4. `<template v-for>` 的 key 移到 `<template>` 上(15-18)。
5. `>>>` 深选择器(370)→ `:deep(mark)`。
6. `hi` watcher 里 `$nextTick` + `listEl.querySelector('[data-i="N"]').scrollIntoView({block:'nearest'})`(187-193)→ `nextTick` + `ref` 取 DOM;**jsdom 里 `scrollIntoView` 可能不存在 → 调用前 `?.` 守卫**(这是允许的防御性偏离,写注释说明)。
7. **补 Vue2 缺的 catch**(199-234 两处 `try/finally` 无 `catch`):加 `catch { /* 网络失败:留空列表,下次 open 重试 */ }` —— 允许的偏离,理由是 Vue2 会产生未处理 rejection;写注释标注。
8. `popStyle`(161-169)照抄:无 `anchorRect` → `{left:'24px',bottom:'120px',width:'460px'}`;否则 `left: r.left`、`bottom: window.innerHeight - r.top + 8`、`width: Math.min(r.width, 520)`。
9. 键盘 `onKey`(235-268)逐案照抄:↓/↑ 移 `hi`、Tab(非 file→drill-in / file→pick)、Enter 或 Space→pick、`/`(非 file)→drill-in、Escape→close、Backspace(仅 `!query && segments.length>0`)→pop-segment。
10. 样式(304-409):`position:fixed; z-index:1000; pointer-events:auto` 必须保留(祖先 `.composer-wrap` 是 `pointer-events:none`)。**两处裸色处理**:①`rgba(0,0,0,0.04)` 发丝环 → 新 token `--hairline-ring`;②删掉 `[data-theme="dark"] .mention-pop{background:rgba(36,38,44,0.85)}` 整条 —— 背景统一走 `--glass-strong`(dark 块已有值)。keyframes `mention-rise`/`blink` 照搬。

`tokens.scss` 新增(light 块 + dark 块都要):
```scss
  /* 玻璃层外沿发丝环(MentionPopover 弹层);皮肤无关的极淡描边 */
  --hairline-ring: rgba(0, 0, 0, 0.04);      /* dark 块:rgba(255, 255, 255, 0.06) */
```

i18n(zh_cn 中文 / en_us 用 Vue2 英文原串):`aiMentionAllDrives`('全部磁盘'/'All drives')、`aiMentionDrives`('个磁盘'/'drives')、`aiMentionItems`('项'/'items')、`aiMentionLoading`('加载中…'/'Loading…')、`aiMentionNoMatch`('没有匹配 "{query}" 的结果'/'No matches for "{query}"')、`aiMentionEmptyHere`('这里没有内容'/'No items here')、`aiMentionUpHint`('返回上一级'/'to go up')、`aiMentionFolder`('文件夹'/'folder')、`aiMentionIgnored`('.gitignore')、`aiMentionKbdNav`('导航'/'Navigate')、`aiMentionKbdDrill`('进入'/'Drill in')、`aiMentionKbdSelect`('选择'/'Select')、`aiMentionKbdUp`('上一级'/'Up')、`aiMentionKbdClose`('关闭'/'Close')。**实现时以 Vue2 模板 1-80 的实际英文串为准逐条对应,不要漏键;每个键 zh_cn+en_us 同时加。**

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- src/ai/components/shell/MentionPopover.test.ts src/i18n/parity.test.ts`
Expected: 全绿。
Run: `grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(' src/ai/components/shell/MentionPopover.vue`
Expected: 无输出(零裸色)。

- [ ] **Step 5: Commit**

```bash
git add src/ai/components/shell/MentionPopover.vue src/ai/components/shell/MentionPopover.test.ts src/ai/styles/tokens.scss src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "SP8-P1c1: MentionPopover (@ mention drill-down panel) + --hairline-ring token"
```

---

