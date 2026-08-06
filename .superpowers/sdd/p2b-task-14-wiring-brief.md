# SP8-P2b Task 14(收尾接线)—— 把 7 个已实现分区接进 `SettingsPage.vue` 映射表

这是 SP8-P2b 的**最后一块**。P2b 的 14 个任务(0–13)已全部完成并提交,7 个分区组件
(`BlacklistSection` / `ExecutionSection` / `SearchSection` / `MemorySection` /
`ObservabilitySection` / `McpTokensSection` / `ChannelsSection`)都已经写好、测好、进库了,
**唯独「接进 `SettingsPage.vue` 的 `SECTION_COMPONENTS` 映射表」这一步当时被刻意推迟** ——
因为那时 `SettingsPage.vue` 还是并行的 P2a 会话的在途文件,动它会撞车。

**现在 P2a 已收官(编码 + 终审完毕,工作树干净),接线解封。本任务就是把它补上。**

## 你唯一可写的工作区

`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`)。

**禁碰**(其它会话在用,动了会造成真实损害):
- `/home/nimo/NimoTech/NimoOS-New-UI`(master,SP6 会话)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(SP7 会话)
- `/home/nimo/NimoTech/NimoOS-UI`(Vue2 老仓)**只读** —— 可以读它的源码/语言包做对照,
  **绝不修改它的 `src/`**
- `/home/nimo/NimoTech/.sp8/NimoOS-Service`(本任务不需要动它)

所有 `pnpm` 命令都在 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI` 里跑,不要在 `.sp8` 根上跑。

## 本任务的文件清单(只许动这两个文件)

- Modify: `src/ai/views/SettingsPage.vue`
- Modify: `src/ai/views/SettingsPage.test.ts`

**不要动**任何分区组件、不要动 `sections.ts`、不要动 i18n、不要动样式。若你认为必须动清单外的
文件才能完成,**停下来在报告里请示**,不要自行扩权。

## 起点坐标

- BASE = `4293991`(`git rev-parse HEAD` 应该就是它;若不是,说明有人在你之前提交了,
  停下来在报告里说明)
- 基线全量测试:**285 文件 / 2295 例全绿**,`pnpm exec vue-tsc --noEmit` 清,`pnpm build` 只有
  既有 >500KB chunk 警告。你的改动**不许让这两个数字出现红项或倒退**(例数只能增不能减)。

## 要做的事

### Step 1: 前提复核(动手前先跑)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
git rev-parse HEAD
git status --short          # 期望:干净
grep -n "SECTION_COMPONENTS" -A 16 src/ai/views/SettingsPage.vue
grep -n "占位" src/ai/views/SettingsPage.test.ts
```

确认 `SECTION_COMPONENTS` 的 9 行仍全是 `SectionPlaceholder`(7 个 P2b 分区 + `skills` + `mcp`)。
**若实际结构与下面给的不同,以实际代码为准**,不要死抄行号。

### Step 2: 加 7 条 import

加在现有 `import ThinkingDefaultsSection ...`(第 47 行)之后、`import AgentIcon`(第 48 行)之前:

```ts
import BlacklistSection from '../components/settings/sections/BlacklistSection.vue'
import ExecutionSection from '../components/settings/sections/ExecutionSection.vue'
import SearchSection from '../components/settings/sections/SearchSection.vue'
import MemorySection from '../components/settings/sections/MemorySection.vue'
import ObservabilitySection from '../components/settings/sections/ObservabilitySection.vue'
import McpTokensSection from '../components/settings/sections/McpTokensSection.vue'
import ChannelsSection from '../components/settings/sections/ChannelsSection.vue'
```

相对路径已核实(`SettingsPage.vue` 在 `src/ai/views/`,分区在
`src/ai/components/settings/sections/`,与已有的 `ModelsSection` 等四个同路径)。

### Step 3: 替换映射表的 7 行

`src/ai/views/SettingsPage.vue:70-84` 现状:

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

改成(**只动 7 行;`skills` / `mcp` 两行必须原样保留 `SectionPlaceholder`;键的顺序不要调整**):

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

同时把上方第 61-69 行的头注释改成与现实一致(现在只剩 `skills`/`mcp` 两个占位,不再是「其余 9 个」)
—— 注释与代码脱节会误导下一个读者,顺手改掉。

### Step 4: `placeholderProps` 不用改

`SettingsPage.vue:92-96` 的 `placeholderProps(id)` 第一行就是
`if (SECTION_COMPONENTS[id] !== SectionPlaceholder) return {}` —— 这是**动态判断**,换成真组件后
自动返回 `{}`,逻辑本身不用动。(顺带:它上方那段注释里「将来 Task 9/10/11 换上真组件后」的措辞
已经过时,可一并更新,但**不要改它的逻辑**。)

### Step 5: 加一条收口守卫测试

在 `src/ai/views/SettingsPage.test.ts` 末尾的 `describe` 块内追加:

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

这需要:
1. 在 `SettingsPage.vue` 里把 `const SECTION_COMPONENTS` 改成 `export const SECTION_COMPONENTS`
   —— 纯加关键字,不改任何现有行为。**这是本任务唯一被授权的额外改动**(原 plan Task 13 Step 1
   原话:「若 `SECTION_COMPONENTS` 当前没有导出,本任务把它 `export` 出来 —— 这是为了可测,
   属正当的最小改动」)。
2. 在测试文件顶部补 import:`SECTION_COMPONENTS`(从 `./SettingsPage.vue` 具名导入)与
   `SectionPlaceholder`(从 `../components/settings/SectionPlaceholder.vue`),若尚未导入。
   注意 `SettingsPage` 的 import 目前在 `vi.mock(...)` 之后,保持这个顺序。

**⚠️ 让这条测试真的有判别力**:写完后自己做一次 RED 探针 —— 临时把映射表里
`blacklist` 改回 `SectionPlaceholder`,确认这条用例**精确报红**,然后还原。报告里写清探针结果。

### Step 6: 修可能变红的既有用例(只许改测试的 mock 层)

接线后,原先渲染 `SectionPlaceholder` 的用例会开始渲染**真分区组件**,而真分区会去调
`service.ai.*`。测试文件顶部现有的 `vi.hoisted()` mock 只有 6 个函数
(`getServicesStatus` / `listModels` / `listProviders` / `getPolicy` / `getImportStatus` /
`cancelImport`),新分区要用的那些(`getMaxTurns` / `getSearchSettings` / `getFileindexStatus` /
`getMemorySettings` / `listUserMemory` / `getTracingSetting` / `listMCPTokens` /
`listPairableChannelInstances` / `listChannelBindings` / … 以及 `service.compose.list`)都不在里面。

重点复跑这几条(`SettingsPage.test.ts` 里编号 10 / 11 / 12 / 14 / 16):
- 用例 11 会渲染真 `ChannelsSection`
- 用例 12 会渲染真 `McpTokensSection`
- 用例 16 涉及 `memory`
- 用例 10 是模型组(4 个分区,不在本次范围)

**若某条红了**:优先按「给 `@nimotech/nimoos-service` 的 mock 补上缺的函数
(`vi.fn()`,返回值给一个最小合法形状)」来修,以及必要时 mock `service.compose`。
**绝对不要为了让测试变绿去改分区组件的实现**,也不要给分区加 `defineExpose` 之类迁就测试的东西。

另有一处已知风险:`ObservabilitySection` 用的是**真** `useMessageBus()`(模块级 socket.io
单例,从不 disconnect)。若它在测试里造成噪声/挂起,**优先考虑 mock
`src/composables/useMessageBus`(按仓库里既有的 mock 写法)**,而不是改组件。
先跑一遍看实际情况 —— 不要预防性地加不需要的 mock(YAGNI)。

### Step 7: 全量测试门(三门都必须过)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      # 全量,不许只跑子集
pnpm exec vue-tsc --noEmit
pnpm build
```

期望:285 文件 / **2296 例**(基线 2295 + 你新增的 1 条守卫)全绿;tsc 零错;build 只有既有
>500KB chunk 警告。**跑不绿就修到绿;修不动就停下来在报告里写清原因,不要报告成功。**

### Step 8: 提交

```bash
git add src/ai/views/SettingsPage.vue src/ai/views/SettingsPage.test.ts
git commit -m "SP8-P2b 收官接线: 7 个分区接进 SettingsPage 映射表(P2a 收官后解封)"
git show --stat HEAD
git status
```

## 硬约束(违反即缺陷)

1. **`git add` 必须显式列路径。绝对禁止 `git add -A` / `git add .` / `git add -u`** ——
   这个检出被多个会话共用,通配暂存会把别人的在途文件卷进你的提交。提交后用
   `git show --stat HEAD` + `git status` 自查,确认只含上面两个文件。
2. **不碰真机**:不跑 `./scripts/deploy.sh`,不写 `/var/lib`,不 rsync。
3. **不起 dev server 抢端口**:5288 上可能已有别的会话的 dev server 在跑。本任务不需要
   dev server,别起。
4. **配色**:本任务不该新增任何 CSS。若你出于任何原因写了样式,颜色必须是 `var(--…)` token,
   禁 `#hex` / `rgb()` / `rgba()` / 具名色(`src/styles/color-guard.test.ts` 会拦)。
5. **i18n**:本任务不该新增任何文案键。若真需要,必须**同时**加进 `src/i18n/zh_cn.ts` 与
   `src/i18n/en_us.ts`(`parity.test.ts` 断言两档键集完全一致),且中英文值**逐字取 Vue2
   生产语言包**,不许自己翻译 —— 但更可能的正确答案是:本任务不需要新键。
6. **移植纪律**:界面/视觉/交互 1:1 照 Vue2(`/home/nimo/NimoTech/NimoOS-UI/src/views/AI/
   Settings.vue:33-46` 是本映射表的蓝本)。逻辑缺陷可以修,但必须三件套齐全:代码注释注明
   Vue2 原文 `file:line` 的问题 + 报告里显式申报 + 我登记台账。**未申报的偏离本身就是缺陷。**
7. **禁止与需求无关的重构 / 改名 / 换库。** 尤其不要顺手改 `DEFERRED_SECTIONS`
   (`sections.ts:94`)或 `SPLIT_SECTIONS`(`sections.ts:87`)—— 两者当前都恰为
   `['skills','mcp']`,`sections.test.ts` 已断言这个不变式,本任务完全不涉及。
8. 也不要"顺手"把 7 个分区里任何一处已申报偏离(D1 SkModal / D2 状态本地化 /
   D4 Observability 自订 MessageBus)改成「更像 Vue2」—— 那些都已通过评审。

## 报告契约

把完整报告写进 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p2b-task-14-wiring-report.md`,
内容至少包含:
- 改了哪些文件、每处改动的意图
- Step 5 的 RED 探针实测结果(临时改回占位 → 是否精确报红 → 已还原)
- Step 6 里是否有既有用例变红、红在哪、你怎么修的(以及为什么这是 mock 层的修法而不是改实现)
- 三门的**实际输出尾部**(测试文件数/例数、tsc、build)
- 提交 sha 与 `git show --stat HEAD` 的实际输出
- 所有偏离 / 扩权 / 疑问,显式列出

**返回给我的内容只要短的**:状态(DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED)、
提交 sha、一行测试小结、以及你的疑虑。完整细节留在报告文件里。
