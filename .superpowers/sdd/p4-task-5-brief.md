# SP8-P4 Task 5 任务书

**先读**(顺序不可换,本文件与它们冲突时以它们为准):
1. `.sp8/NimoOS-New-UI/.superpowers/sdd/p4-common-constraints.md` —— 公共约束,**你的行为准则**
2. `NimoOS-UI/docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p4-mcp-design.md` —— 设计文档,**权威**
   (公共约束 > 本任务书;设计文档 > 本任务书。发现冲突立即在报告里申报,不要默默选一边。)

## Global Constraints(计划原文,逐字)

- **工作区**:只写 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`)。**本期 Service 仓与两个后端仓零改动。**
- **界面 / 视觉 / 交互严格 1:1 照 Vue2**(DOM 结构、class、文案、尺寸、动效、键位、**组件拆分**);**逻辑 / bug 不照抄**,偏离必须三件套齐全(代码注释注明 Vue2 `file:line` + 报告申报 + 台账登记)。**未申报的偏离本身就是缺陷。**
- **一切可见颜色必须 `var(--…)` token**,禁 `#hex` / `rgb()` / `rgba()` / 具名色(`white`/`black` 也算)。**内联 `:style` 里的颜色同样违规。** ⚠️ `color-guard.test.ts` **不扫 `.scss`**,Task 1 的配色无回归网。
- **单层取数**:共享包 `service.ai.*` 已 `return res.data`,消费端**不许再剥一层**。Vue2 的 `resp.data` 照抄即缺陷(设计 §3,本期命中 4 处)。
- **界面永不回显后端原文 / JSON**,一律走 i18n 键映射(先例 `util/channelsFormat.ts:65-76`)。
- **新 i18n 键双档同增**(`src/i18n/{zh_cn,en_us}.ts`),值逐字照本计划 Task 4 的表,**不许自行翻译、不许改标点**(含 `·` `…` `(` `)` 与中文逗号句号)。字面 `@` 写成 `{'@'}`。
- **import 一律相对路径**(本仓无 `@/` 别名先例)。
- **状态一律组件本地 `ref`**,不新建 store。
- **组件里零 `<style>` 块**;用到的每个 CSS 类先 `grep` 确认存在。
- **toast 真签名**:`show(text: string, duration = 1500, tier: 'info'|'warning'|'danger' = 'info')`(`src/stores/toast.ts:18-27`)。
- **每个任务跑全量三门**,输出完整落盘,**禁 `| tail`**。基线 **296 文件 / 2574 例绿 · tsc 0 · build 0**。
- 禁 `git add -A` / `git add .`,只显式列路径;禁 rebase / reset / stash / merge / **push**。一个任务 = 一个语义提交。

## File Structure(全期文件落点,供你定位自己的位置)

| 文件 | 责任 | 任务 |
|

---

## Task 5: `McpServerGroup.vue`

**Files:**
- Create: `src/ai/components/settings/mcp/McpServerGroup.vue`
- Test: `src/ai/components/settings/mcp/McpServerGroup.test.ts`

**Interfaces:**
- Consumes: `McpServer`(T2)· `serverColor` / `transportLabel` / `SERVER_GLYPH`(T2)· `SkillTile`(`../skills/SkillTile.vue`)· `AgentIcon`(`../../icons/AgentIcon.vue`)· i18n `aiSkOff`?**不 —— 用 T4 的键**
- Produces:
  ```
  props: { label: string; items: McpServer[]; activeId: number | null }
  emits: { pick: (id: number) => void }
  ```

**蓝本:** Vue2 `McpServerGroup.vue`(47 行)。**结构上的孪生兄弟是 `src/ai/components/settings/skills/SkillGroup.vue`,先读它。**

- [ ] **Step 1: 写失败的测试**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import McpServerGroup from './McpServerGroup.vue'
import zh from '../../../../i18n/zh_cn'
import type { McpServer } from '../../../types/mcpServer'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function srv(p: Partial<McpServer> = {}): McpServer {
  return {
    id: 1, name: 'brave', transport: 'http', url: 'https://example.com/mcp',
    command: '', args: [], enabled: true, has_headers: false, has_env: false, ...p,
  }
}
const mountG = (items: McpServer[], activeId: number | null = null) =>
  mount(McpServerGroup, { props: { label: '已启用服务', items, activeId }, global: { plugins: [i18n] } })

describe('McpServerGroup', () => {
  it('渲染分组标题与计数', () => {
    const w = mountG([srv(), srv({ id: 2, name: 'notion' })])
    expect(w.find('.sk-group-label').text()).toContain('已启用服务')
    expect(w.find('.sk-group-count').text()).toBe('2')
  })

  it('每项渲染名称、transport 标签、url', () => {
    const w = mountG([srv({ name: 'brave', transport: 'sse', url: 'https://x/sse' })])
    expect(w.find('.sk-item-name').text()).toBe('brave')
    expect(w.find('.mcp-transport').text()).toBe('SSE')
    expect(w.find('.mcp-transport').attributes('data-t')).toBe('sse')
    expect(w.find('.sk-item-desc').text()).toBe('https://x/sse')
  })

  it('点击条目 emit pick(id)', async () => {
    const w = mountG([srv({ id: 7 })])
    await w.find('.sk-item').trigger('click')
    expect(w.emitted('pick')).toEqual([[7]])
  })

  // 判别力:两项且只有第二项是 active —— 单元素数组测不出 activeId 是否真的比对了 id。
  it('只有 id 命中 activeId 的那一项带 data-active=true', () => {
    const w = mountG([srv({ id: 1 }), srv({ id: 2, name: 'b' })], 2)
    const items = w.findAll('.sk-item')
    expect(items[0].attributes('data-active')).toBe('false')
    expect(items[1].attributes('data-active')).toBe('true')
  })

  // 判别力:两项一开一关。
  it('停用项带 data-disabled=true 并显示 Off 角标,启用项不显示', () => {
    const w = mountG([srv({ id: 1, enabled: true }), srv({ id: 2, name: 'b', enabled: false })])
    const items = w.findAll('.sk-item')
    expect(items[0].attributes('data-disabled')).toBe('false')
    expect(items[1].attributes('data-disabled')).toBe('true')
    expect(items[0].find('.sk-item-off').exists()).toBe(false)
    expect(items[1].find('.sk-item-off').text()).toBe(zh.aiSkOff)
  })

  it('点标题折叠/展开(Vue2 :3 的 collapsed 开关)', async () => {
    const w = mountG([srv(), srv({ id: 2, name: 'b' })])
    expect(w.findAll('.sk-item')).toHaveLength(2)
    await w.find('.sk-group-label').trigger('click')
    expect(w.findAll('.sk-item')).toHaveLength(0)
    expect(w.find('.sk-group-label').attributes('data-collapsed')).toBe('true')
    await w.find('.sk-group-label').trigger('click')
    expect(w.findAll('.sk-item')).toHaveLength(2)
  })

  it('同名服务器拿到同一个色板 id(色块走 SkillTile)', () => {
    const w = mountG([srv({ id: 1, name: 'same' }), srv({ id: 2, name: 'same' })])
    const tiles = w.findAll('.sk-tile')
    expect(tiles[0].attributes('style')).toBe(tiles[1].attributes('style'))
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm exec vitest run src/ai/components/settings/mcp/McpServerGroup.test.ts
```

预期:FAIL（无法解析 `./McpServerGroup.vue`)。

- [ ] **Step 3: 写组件**

DOM 结构**逐字照 Vue2 `McpServerGroup.vue:1-26`**:`.sk-group-label[data-collapsed]` > `.sk-group-chev`(`AgentIcon name="chevDown" :size="11"`)+ `<span>{{ label }}</span>` + `.sk-group-count`;`v-if="!collapsed"` 下 `v-for` 出 `.sk-item[data-active][data-disabled]` > `SkillTile` + `.sk-item-body`(`.sk-item-head` 内 `.sk-item-name` + `.mcp-transport[data-t]`,再 `.sk-item-desc`、`.sk-item-meta` 内条件 `.sk-item-off`)。

- `collapsed` 用组件本地 `ref(false)`
- `SkillIcon` → `AgentIcon`(偏离 D3),`SkillTile` 直接复用(`../skills/SkillTile.vue`)
- `Off` 文案用 `t('aiSkOff')`——**这是跨域复用既有键**,值 `已关闭` 与 Vue2 `$t('Off')` 的 zh 值逐字相同(已核);在注释里申报为复用而非新增
- 零 `<style>` 块;用到的类先 grep(`.sk-group-label` / `-chev` / `-count` / `.sk-item*` 在 `skills-styles.scss`,`.mcp-transport` 在 T1)

- [ ] **Step 4: 跑测试确认通过 + 跑全量三门**

```bash
pnpm exec vitest run src/ai/components/settings/mcp/McpServerGroup.test.ts
```
再跑全量(日志名 `p4-t5-*`)。**本任务新增 1 个 `.vue` → color-guard 用例 +1。**

- [ ] **Step 5: Commit**

```bash
git add src/ai/components/settings/mcp/McpServerGroup.vue src/ai/components/settings/mcp/McpServerGroup.test.ts
git commit -m "feat(ai): SP8-P4 T5 McpServerGroup 可折叠分组"
```
