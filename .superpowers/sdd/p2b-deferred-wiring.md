# SP8-P2b → 收尾接线清单(P2a 收官后执行)

> ## ✅ 已执行完毕(2026-07-29)—— 本文档转为历史记录,不需要再执行
>
> commit `21f62e2`(接线)+ `659b962`(修复轮 1)。实测 285 文件 / **2296 例**全绿、
> `vue-tsc` 清、`pnpm build` 清。两个提交都只含 `SettingsPage.vue` + `SettingsPage.test.ts`。
>
> **与本文档第 4 节的建议有一处偏离(申报级)**:本文档(以及原 plan Task 13 Step 1)要求把
> `SECTION_COMPONENTS` `export` 出来供守卫测试直接读。**实测行不通** —— Vue SFC 禁止在
> `<script setup>` 里出现 ES 具名导出(`@vue/compiler-sfc` 报
> `<script setup> cannot contain ES module exports`,评审人独立复现)。
> 第一版实现改成把常量挪进一个独立的普通 `<script>` 块(双 script 模式)绕过限制,但那是
> **未授权的结构性扩权**,已在修复轮 1 整体撤销。
> **最终采用的是 `p2b-FINAL-review.md:275-277` 早先就记下的建议**:守卫测试断言**渲染结果**
> 而不是导出内部常量 —— 逐个 `setActiveSection(id)` 后断言占位文案
> `aiCfgPlaceholderBody`(「该分区尚未迁移到新界面,将在后续阶段开启。」)在 11 个已实现分区
> **不出现**、在 `skills`/`mcp` **出现**。判别力双向(评审人两次 RED 探针各精确 1 红),
> 且生产文件的公开面零扩大 —— `SettingsPage.vue` 最终净改动就是 7 条 import + 7 行映射
> + 2 处注释订正,没有任何结构变化。

写这份文档时的坐标:`sp8-ai` 分支 HEAD = `efcd6f3`(Task 12: ChannelsSection)。
`src/ai/views/SettingsPage.vue` / `SettingsPage.test.ts` 全程只读,未编辑。以下所有行号
均以此坐标为准 —— P2a 仍在推进这两个文件,执行前务必先 `grep`/`git show HEAD:...` 复核
行号是否漂移。

## 前提检查(执行者动手前先跑一遍)

```bash
grep -n "SECTION_COMPONENTS\|^import" src/ai/views/SettingsPage.vue | head -30
```

确认 `SECTION_COMPONENTS` 的 7 个占位行(`blacklist`/`execution`/`search`/`memory`/
`observability`/`mcptokens`/`channels`)仍指向 `SectionPlaceholder`,且 `skills`/`mcp`
两行也仍是 `SectionPlaceholder`。若 P2a 收官后这段结构变了,以实际代码为准,不要死抄本文档
的行号。

## 1. 七条 import(加在现有 `import ThinkingDefaultsSection ...` 之后,`import AgentIcon`
之前 —— 即 HEAD 第 47/48 行之间,按分区名字母顺序插入均可,不影响功能)

```ts
import BlacklistSection from '../components/settings/sections/BlacklistSection.vue'
import ExecutionSection from '../components/settings/sections/ExecutionSection.vue'
import SearchSection from '../components/settings/sections/SearchSection.vue'
import MemorySection from '../components/settings/sections/MemorySection.vue'
import ObservabilitySection from '../components/settings/sections/ObservabilitySection.vue'
import McpTokensSection from '../components/settings/sections/McpTokensSection.vue'
import ChannelsSection from '../components/settings/sections/ChannelsSection.vue'
```

路径已核实(`SettingsPage.vue` 位于 `src/ai/views/`,分区组件位于
`src/ai/components/settings/sections/`,与 P2a 已导入的 `ModelsSection` 等四个走同一相对
路径 `../components/settings/sections/*.vue`)。

## 2. `SECTION_COMPONENTS` 七行替换

HEAD 现状(`src/ai/views/SettingsPage.vue:70-84`):

```ts
const SECTION_COMPONENTS: Record<SectionId, Component> = {
  models: ModelsSection, // Task 9 —— 已替换
  providers: ProvidersSection, // Task 10 —— 已替换
  privacy: PrivacySection, // Task 11 —— 已替换
  thinking: ThinkingDefaultsSection, // Task 11 —— 已替换
  blacklist: SectionPlaceholder,
  execution: SectionPlaceholder,
  search: SectionPlaceholder,
  memory: SectionPlaceholder,
  observability: SectionPlaceholder,
  skills: SectionPlaceholder,
  mcp: SectionPlaceholder,
  mcptokens: SectionPlaceholder,
  channels: SectionPlaceholder,
}
```

改成(**只动 7 行,`skills`/`mcp` 两行原样保留 `SectionPlaceholder`,顺序不必调整**):

```ts
const SECTION_COMPONENTS: Record<SectionId, Component> = {
  models: ModelsSection, // Task 9 —— 已替换
  providers: ProvidersSection, // Task 10 —— 已替换
  privacy: PrivacySection, // Task 11 —— 已替换
  thinking: ThinkingDefaultsSection, // Task 11 —— 已替换
  blacklist: BlacklistSection, // SP8-P2b Task 4 —— 已实现,收官接线
  execution: ExecutionSection, // SP8-P2b Task 5 —— 已实现,收官接线
  search: SearchSection, // SP8-P2b Task 7 —— 已实现,收官接线
  memory: MemorySection, // SP8-P2b Task 6 —— 已实现,收官接线
  observability: ObservabilitySection, // SP8-P2b Task 8 —— 已实现,收官接线
  skills: SectionPlaceholder, // SP8-P3 才实现,保持占位
  mcp: SectionPlaceholder, // SP8-P4 才实现,保持占位
  mcptokens: McpTokensSection, // SP8-P2b Task 10 —— 已实现,收官接线
  channels: ChannelsSection, // SP8-P2b Task 12 —— 已实现,收官接线
}
```

同时删掉/更新第 61-69 行头注释里「其余 9 个渲染 SectionPlaceholder」那段说明文字,改成
只剩 `skills`/`mcp` 两个占位(注释维护,非强制,但建议同步改,否则和代码脱节误导下个读者)。

## 3. `SectionPlaceholder` 的多余 prop 传递

`SettingsPage.vue:86-89` 附近的 `placeholderProps(id)` 只在 `SECTION_COMPONENTS[id] ===
SectionPlaceholder` 时才返回 `{ titleKey, bodyKey }`(见 HEAD:93 行
`if (SECTION_COMPONENTS[id] !== SectionPlaceholder) return {}`)——这条判断是**动态**的,
换成真组件后自动返回 `{}`,不用改这段逻辑本身。

## 4. `SettingsPage.test.ts` 需要更新的断言

**核查结论(2026-07-28,对着 HEAD 实测)**:`SettingsPage.test.ts` 目前**没有**一条断言
literal 检查这 7 个 id 映射到 `SectionPlaceholder`。
**订正(P2b Task 13 评审复核)**:本节原先写的复核命令 `grep -n "SectionPlaceholder"
src/ai/views/SettingsPage.test.ts` 实测**零命中**(该测试文件里根本没有这个标识符);
原文说的"两处注释性文字"来自 `grep -n "占位" src/ai/views/SettingsPage.test.ts`。
用后者复核。结论不变:`SECTION_COMPONENTS` 未被该测试文件导入或直接访问。也就是说本次接线**不会让任何现有断言变红**——已核实的相关用例
及其现状:

- `it('10. stack 组(model)渲染组内 4 个 .set-stack-item,...')`(:241)—— 断言的是
  `data-section-id` 顺序(`models/providers/privacy/thinking`),这四个不在本次接线范围内,
  不受影响。
- `it('11. swap 组(channel)只渲染 1 个分区,没有 .set-stack-item')`(:257)—— 用的是
  `store.setActiveSection('channels')`(:262)。**接线后这条测试渲染的组件会从
  `SectionPlaceholder` 变成真正的 `ChannelsSection`**,行为断言(“只渲染 1 个分区、没有
  `.set-stack-item`”)与具体渲染成什么组件无关,理论上仍应通过 —— 但 `ChannelsSection`
  会真的调 `service.ai.listPairableChannelInstances()` 等接口,若测试环境没有 mock
  `@nimotech/nimoos-service`,可能抛出未处理 rejection 或渲染出与占位不同的 DOM 结构导致
  选择器落空。**接线后必须重跑这条用例,若红,需要在 `SettingsPage.test.ts` 里给
  `@nimotech/nimoos-service` 补 mock**(参考 `ChannelsSection.test.ts` 顶部的
  `vi.hoisted()` mock 写法),而不是改 `ChannelsSection.vue`。
- `it('12. activeSection=skills 时 .set-body 带 set-body-split 类;activeSection=
  mcptokens(同组但非 split)时不带')`(:270)——`store.setActiveSection('mcptokens')`(:280)。
  同上,`mcptokens` 接线后会渲染真正的 `McpTokensSection`(会调
  `service.ai.listMCPTokens()`),需要同样检查/补 mock。
- `it('19. 选中 skills → 弹一条 toast(DEFERRED_SECTIONS 契约)')`(:360)与
  `it('20. 选中 providers(非 deferred)→ 不弹 toast(对照组)')`(:373)—— 两条都不涉及本次
  接线的 7 个 id,不受影响。
- `it('14. 挂载时 ?section=providers 被采纳')`(:301)与
  `it('16. route.query.section 变化 → 调用 setActiveSection')`(:319,断言里在 :325 用了
  `section: 'memory'`)—— 断言的是 `setActiveSection` 是否被正确调用,不断言渲染出的组件
  身份,不受影响,但同 stack 组场景一样,若该用例挂载后触发了 `memory` 分区的真实渲染,
  同样要检查是否需要补 `service.ai` mock。

**建议新增的收口守卫测试**(在 `SettingsPage.test.ts` 末尾追加,`describe` 块内;
执行者可直接照抄,已按当前 `sections.ts` 的 `SectionId` 全集与 P2a+P2b 已完成范围核对):

```ts
it('SP8-P2b 收口 —— 11 个已实现分区都不是占位，skills/mcp 仍是占位', () => {
  const implemented = [
    'models', 'providers', 'privacy', 'thinking',
    'blacklist', 'execution', 'search', 'memory', 'observability', 'mcptokens', 'channels',
  ]
  for (const id of implemented) {
    expect(SECTION_COMPONENTS[id]).toBeDefined()
    expect(SECTION_COMPONENTS[id]).not.toBe(SectionPlaceholder)
  }
  expect(SECTION_COMPONENTS.skills).toBe(SectionPlaceholder)
  expect(SECTION_COMPONENTS.mcp).toBe(SectionPlaceholder)
})
```

这条测试要求 `SECTION_COMPONENTS` 从 `SettingsPage.vue` 具名导出(HEAD 现状是模块内
`const`,未 `export`)。给它加 `export` 是纯新增关键字,不改变任何现有行为/现有测试,是
brief 本身也认可的「最小必要改动」(brief Step 1 原话:「若 `SECTION_COMPONENTS` 当前没有
导出,本任务把它 `export` 出来 —— 这是为了可测,属正当的最小改动」)。同时需要在测试文件顶部
补一行 `import { SECTION_COMPONENTS } from './SettingsPage.vue'` 以及
`import SectionPlaceholder from '../components/settings/SectionPlaceholder.vue'`(若尚未
导入)。

## 5. 明确不动的东西

- `DEFERRED_SECTIONS`(`src/ai/components/settings/sections.ts:94`)与 `SPLIT_SECTIONS`
  (`sections.ts:87`)**都不要改**——两者当前都恰为 `['skills', 'mcp']`,`sections.test.ts`
  (:53/:57)已断言这个不变式,`skills`/`mcp` 两个 id 分别要等 **SP8-P3**(技能区)与
  **SP8-P4**(MCP 连接区)才会有对应真组件,本次接线完全不涉及这两个 id。
- 不要顺手把 7 个分区组件里任何一处 D2(状态本地化,不进 store)、D1(SkModal 弹窗)、D4
  (Observability 独立订阅 MessageBus)之类已申报偏离改回「跟 Vue2 更像」——那些偏离已在
  各自任务报告里申报并被评审通过,收官接线只改 `SettingsPage.vue` 这一个文件(以及为了让
  上面的守卫测试可行必须加的 `export` 关键字)。

## 6. 接线后必须跑的验证

```bash
pnpm test                    # 全量,重点看 SettingsPage.test.ts 的 10/11/12/14/16 五条
pnpm exec vue-tsc --noEmit
pnpm build
```

若第 4 节提到的 mock 缺口导致某条用例红,优先检查是不是缺 `@nimotech/nimoos-service` 的
mock,不要去改分区组件本身的实现去"适配"测试环境。
