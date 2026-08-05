# SP8-P4 Task 1 任务书

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

## Task 1: 样式底座 `mcp-styles.scss`

**Files:**
- Create: `src/ai/styles/mcp-styles.scss`
- Modify: `src/ai/views/SettingsPage.vue:66-69`(在 `skills-styles.scss` 之后加一行 import)
- Test: 无新测试文件(scss 无守卫,见下方 §验收)

**Interfaces:**
- Consumes: 无
- Produces: 18 个 CSS 类,供 T5–T9 使用:
  `.mcp-transport`(带 `[data-t="http"|"sse"|"stdio"]` 三个变体)· `.mcp-config` · `.mcp-config-row`(内含 `.lbl` / `.lbl .sub` / `.val`)· `.mcp-code` · `.mcp-kv` · `.mcp-kv-row` · `.mcp-kv-del` · `.mcp-kv-add` · `.mcp-kv-hint` · `.mcp-args` · `.mcp-test-btn` · `.mcp-test-hint` · `.mcp-test-result`(带 `[data-ok="true"|"false"]`)· `.mcp-test-line` · `.mcp-test-tools` · `.mcp-tool-chip` · `.mcp-quickadd-row` · `.mcp-quickadd-err`
  **外加本期新增**:`.mcp-test-detail`(T7 的技术详情折叠,`<details>`/`<summary>`)

**蓝本:** `NimoOS-UI/src/views/AI/MCP/mcp-styles.scss`(91 行)—— **逐行移植,只改颜色**。

- [ ] **Step 1: 逐行移植 91 行,非颜色声明原样照抄**

尺寸、间距、圆角、字号、`font-family: var(--font-mono)`、`flex`/`grid` 布局全部**逐字照抄**,不许"顺手优化"。
已经是 token 的(`var(--bg-chip)` / `var(--text-tertiary)` / `var(--line-faint)` / `var(--bg-sunken)` / `var(--text-primary)` / `var(--text-secondary)` / `var(--danger)` / `var(--accent)` / `var(--accent-softer)` / `var(--r-sm)` / `var(--line)` / `var(--bg-elevated)` / `var(--success)` / `var(--teal)` / `var(--purple)`)原样保留。

- [ ] **Step 2: 6 处 rgba 字面量换成已有 token(偏离 D10)**

**逐条对照表 —— 这 6 条是本任务的全部颜色改动,不许多改也不许少改:**

| Vue2 位置 | 原文 | 改成 |
|---|---|---|
| `:7` `.mcp-transport[data-t="http"]` | `background: rgba(48, 176, 199, 0.14)` | `background: var(--teal-soft)` |
| `:8` `.mcp-transport[data-t="sse"]` | `background: rgba(175, 82, 222, 0.12)` | `background: var(--purple-soft)` |
| `:43` `.mcp-transport[data-t="stdio"]` | `background: rgba(48, 209, 88, 0.14)` | `background: var(--success-soft)` |
| `:74` `.mcp-test-result[data-ok="true"]` | `background: rgba(52,199,89,0.10)` / `border-color: rgba(52,199,89,0.30)` | `background: var(--success-soft)` / `border-color: var(--success-soft-border)` |
| `:75` `.mcp-test-result[data-ok="false"]` | `background: rgba(255,69,58,0.10)` / `border-color: rgba(255,69,58,0.30)` | `background: var(--danger-soft)` / `border-color: var(--danger-soft-border)` |

这 6 个 token **已存在**且浅/暗两档都有值,已回源核实:
`tokens.scss:129`(`--success-soft`)· `:130`(`--success-soft-border`)· `:131`(`--danger-soft`)· `:132`(`--danger-soft-border`)· `:133`(`--purple-soft`)· `:149`(`--teal-soft`);暗色块 `:306-316` 同名重定义。
**本任务预期新增 token 数 = 0。** 如果你认为需要新 token,**停下来在报告里写 `NEEDS_CONTEXT`**,不要自行新增。

- [ ] **Step 3: 注释纪律**

文件头注释写明:来源 `NimoOS-UI/src/views/AI/MCP/mcp-styles.scss`(91 行)· 与 `skills-styles.scss` 的分层关系(Vue2 原文件头就是这么写的)· 偏离 D10 的 6 条对照。
**⚠️ 注释里不许出现 Vue2 的原始色字面量**(`rgba(48, 176, 199, 0.14)` 这类)——改写成「引 Vue2 `file:line` + 中文描述颜色」,例如「Vue2 `:7` 原为青色约 14% 透明度」。这条在 `.scss` 里同样执行(与 `.vue` 一致的纪律,虽然 color-guard 扫不到)。

- [ ] **Step 4: 新增 `.mcp-test-detail`(为 T7 预留)**

Vue2 没有这个类(D8 是本期新增控件)。写成:

```scss
// 【本期新增,Vue2 无对应物 —— 偏离 D8】测试失败时的「技术详情」折叠区。
// 用原生 <details>/<summary>,无新依赖、天然可访问、无组件状态。
.mcp-test-detail {
  margin-top: 6px;
  summary {
    cursor: pointer;
    font-size: 12px;
    color: var(--text-tertiary);
    list-style: none;
    &::-webkit-details-marker { display: none; }
    &::before { content: '▸ '; }
  }
  &[open] > summary::before { content: '▾ '; }
  pre {
    margin: 6px 0 0;
    padding: 8px 10px;
    border-radius: var(--r-sm);
    background: var(--bg-sunken);
    border: 1px solid var(--line-faint);
    font-family: var(--font-mono);
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--text-secondary);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 160px;
    overflow-y: auto;
  }
}
```

- [ ] **Step 5: 接线 import**

`src/ai/views/SettingsPage.vue` 现在是:

```ts
import '../styles/tokens.scss'
import '../styles/sk-shared.scss'
import '../styles/settings-styles.scss'
import '../styles/skills-styles.scss'
```

在末尾追加一行(顺序重要:`mcp-styles` 层叠在 `skills-styles` 之上):

```ts
import '../styles/mcp-styles.scss'
```

- [ ] **Step 6: 跑全量三门**

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                  > /tmp/p4-t1-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit > /tmp/p4-t1-tsc.log   2>&1; echo "exit=$?"
pnpm build                 > /tmp/p4-t1-build.log 2>&1; echo "exit=$?"
```

预期:**296 文件 / 2574 例绿**(本任务不新增 `.vue`,color-guard 用例数不变)· tsc 0 · build 0。

- [ ] **Step 7: 自查颜色(没有自动守卫,必须人工)**

```bash
grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|(^|[^-a-z])(white|black|red|green|blue|gray|grey)([^-a-z]|$)' src/ai/styles/mcp-styles.scss
```

预期:**零命中**。有命中就是违规(注释行也算)。把命令与输出贴进报告。

- [ ] **Step 8: Commit**

```bash
git add src/ai/styles/mcp-styles.scss src/ai/views/SettingsPage.vue
git commit -m "feat(ai): SP8-P4 T1 MCP 分区样式底座(18 类,6 处 rgba 换 token)"
```
