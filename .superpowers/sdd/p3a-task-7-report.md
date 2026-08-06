# SP8-P3a Task 7 —— 接线（报告）

## 产出文件（仅这 4 个，无其它改动）

- `src/ai/components/settings/sections.ts`
- `src/ai/components/settings/sections.test.ts`
- `src/ai/views/SettingsPage.vue`
- `src/ai/views/SettingsPage.test.ts`

## 逐文件改了什么

### `src/ai/components/settings/sections.ts`

- `DEFERRED_SECTIONS` 从 `['skills', 'mcp']` 收缩为 `['mcp']`。
- 头顶注释重写：不再说"`skills` → P3、`mcp` → P4"，改为"`skills` 已于
  SP8-P3a 接入真组件（`SkillsSection`），从本列表移出；`mcp` 仍待 P4"。
- `SPLIT_SECTIONS`（`['skills', 'mcp']`）**未动**——按 brief 第 5 点，它描述的
  是双栏满高布局，与"是否已实现真组件"无关，skills 接入真组件后依然需要双栏
  布局（左列表 + 右详情），保持不变是正确行为，不是遗漏。

### `src/ai/components/settings/sections.test.ts`

- 唯一改动：`DEFERRED_SECTIONS` 契约用例从断言 `['mcp', 'skills']` 改为断言
  `['mcp']`，用例名同步改为"(P4 占位)恰为 mcp(skills 已于 P3a 接入真组件）"。
- `SPLIT_SECTIONS` 的用例（`'SPLIT_SECTIONS 恰为 skills / mcp'`）未动——它测的
  是布局常量，本任务没有改这个常量。

### `src/ai/views/SettingsPage.vue`

- `import SkillsSection from '../components/settings/sections/SkillsSection.vue'`。
- `SECTION_COMPONENTS['skills']` 从 `SectionPlaceholder` 换成 `SkillsSection`，
  行内注释从"SP8-P3 才实现,保持占位"改为"SP8-P3a Task 7 —— 已实现,收官接线"。
- `placeholderProps(id)` **函数体本身未改**——它的判别逻辑是
  `SECTION_COMPONENTS[id] !== SectionPlaceholder`。skills 换成 `SkillsSection`
  后，`SECTION_COMPONENTS['skills'] !== SectionPlaceholder` 自动为真，
  `placeholderProps('skills')` 自动返回 `{}`（不再传 titleKey/bodyKey）。
  已用 RED 验证确认这条链路真的接上（见下）。
- 文件头两处注释更新：
  - `:30-33`（"选中 skills/mcp 时弹一条 info toast"）改为只提 `mcp`，并补一句
    "`skills` 已于 SP8-P3a 接入真组件 `SkillsSection`,不再弹这条 toast"。
  - `:74-78`（"只剩 skills / mcp 两个仍渲染 SectionPlaceholder"）改为
    "现在只剩 mcp 一个仍渲染 SectionPlaceholder(留给 P4)"，并把"11 个已接"
    更新为"12 个已接（含本任务 P3a 接的 skills）"。
  - `SECTION_COMPONENTS` 上方注释里的"11 个真组件"→"12 个"（:103）。

### `src/ai/views/SettingsPage.test.ts`

- 在 `vi.hoisted` 的 `ai` mock 对象里新增 `listSkills: vi.fn()`。理由：
  `SkillsSection` 挂载后 `onMounted` 会调 `service.ai.listSkills()`；这个方法
  原先不在本测试文件的 mock 对象里，调用会抛 "not a function"，被
  `SkillsSection.reload()` 的 `catch` 吞掉并弹一条 `danger` toast——这会污染
  和 skills 无关、只是路过该分区的用例（例如收口测试、用例 12）。裸
  `vi.fn()`（不配置 `mockResolvedValue`）调用返回 `undefined`，
  `await undefined` 合法，`Array.isArray(undefined)` 为假，`SkillsSection`
  把它当空列表处理，不抛错也不弹 toast——足够满足本文件里所有间接路过
  skills 分区的用例。
- **用例 19**：原断言"选中 skills → 弹一条 toast（DEFERRED_SECTIONS 契约）"
  改为断言反面：选中 skills 后
  - `.sk-list`（`SkillsSection.vue:135`，`SectionPlaceholder.vue` 没有这个
    class）存在；
  - 页面文本不含 `zh.aiCfgPlaceholderBody`；
  - `toast.show` 未被调用。
  用例名同步改为"选中 skills → 渲染 SkillsSection 真实内容,不弹 toast(不再
  是占位)"。
- **新增用例 19b**：选中 `mcp`（用文案"MCP 连接"定位导航项）仍断言
  `toast.show` 被调用且参数是 `('该分区将在后续阶段开启', 3000)`——这是原用例
  19 的断言原封不动搬到 mcp 上，保证 `DEFERRED_SECTIONS` 的占位 toast 契约
  本身没有被删掉，只是不再覆盖 skills。
- **收口测试**（原名"SP8-P2b 收口 —— 11 个已实现分区…skills/mcp 仍含占位
  文案"）：这条测试遍历 `implemented` 数组断言不含占位文案、遍历 `deferred`
  数组断言含占位文案。发现 `skills` 隐含在 `deferred` 数组里，是本任务改动
  会打破的"其它间接依赖 skills 是占位"的用例（brief 特别提醒的那种）。改法：
  - `skills` 从 `deferred` 数组移到 `implemented` 数组（12 个）；
  - `deferred` 数组收缩为 `['mcp']`；
  - 用例名改为"SP8-P3a 收口 —— 12 个已实现分区渲染后页面不含占位文案，mcp 仍
    含占位文案"；
  - 注释同步更新（"11 个真分区"→"真分区"，去掉写死的数字避免未来再次漂移；
    新增一段说明 skills 已迁移过去的理由）。

## Vue2 file:line → New-UI 对照

本任务不涉及新的 Vue2 蓝本移植（Task 6 的 `SkillsSection.vue` 已完成移植并
评审通过，本任务只做纯前端接线），无新增的 Vue2 对照关系。唯一引用的既有
对照是 `Settings.vue:75-90`（section id → 组件映射的三方同步约定）与
`Settings.vue:92`（`SPLIT_SECTIONS` 的语义），两处均在既有注释里已经引用过，
本任务未新增。

## 承接了 Vue2 哪些行为

无新增行为承接——纯粹是把 Task 1-6 已经做好、已评审通过的 `SkillsSection`
从"未接线"状态改为"已接线"状态。`SkillsSection` 自身的行为对齐已在 Task 6
的报告/评审里覆盖。

## RED → GREEN 证据

对 `SettingsPage.vue:94` 做最小破坏（`skills: SkillsSection` 临时改回
`skills: SectionPlaceholder`），只跑受影响的两个测试文件：

RED（探针状态）：
```
$ pnpm exec vitest run src/ai/views/SettingsPage.test.ts src/ai/components/settings/sections.test.ts
 FAIL  src/ai/views/SettingsPage.test.ts > SettingsPage — ③ 内容区两种渲染模式 > SP8-P3a 收口 —— 12 个已实现分区渲染后页面不含占位文案，mcp 仍含占位文案
 FAIL  src/ai/views/SettingsPage.test.ts > SettingsPage — ⑤+⑥ 深链契约与生命周期 > 19. 选中 skills → 渲染 SkillsSection 真实内容,不弹 toast(不再是占位)
 Test Files  1 failed | 1 passed (2)
      Tests  2 failed | 39 passed (41)
exit=1
```
（`sections.test.ts` 全绿是符合预期的——RED 探针只改了 `SettingsPage.vue`，
没碰 `sections.ts`，`DEFERRED_SECTIONS` 契约用例本来就该保持绿。）

还原探针（`git status` 确认干净后手工改回 `SkillsSection`）后 GREEN：
```
$ pnpm exec vitest run src/ai/views/SettingsPage.test.ts src/ai/components/settings/sections.test.ts
 Test Files  2 passed (2)
      Tests  41 passed (41)
exit=0
```

## 三门完整终值

```
$ pnpm test                    → exit=0
 Test Files  291 passed (291)
      Tests  2408 passed (2408)

$ pnpm exec vue-tsc --noEmit   → exit=0（无输出）

$ pnpm build                   → exit=0
✓ built in 11.85s
（仅既有的 >500KB chunk 警告：ExcelViewer-*.js 1.68MB、index-*.js 3.09MB、
  PdfViewer-*.js 434KB、DocViewer-*.js 174KB、index-DXuiigjr.js 338KB、
  artplayer-*.js 141.5KB——均为既有第三方依赖，非本任务引入）
```

基线是 291 文件 / 2407 例，本任务净增 1 条测试用例（新增 19b，未改动其它
既有测试的存续数量），文件数不变（本任务不新增 `.vue`/`.ts` 文件），
与预期的 291/2408 吻合。

红项：无。

## i18n 复用/新增键清单

**本任务无新增 i18n 键**，全部复用已有键：
- `aiCfgSectionDeferred`（'该分区将在后续阶段开启'）—— 用例 19b 断言值，
  无改动。
- `aiCfgPlaceholderBody`（'该分区尚未迁移到新界面,将在后续阶段开启。'）——
  收口测试断言值，无改动。

## 偏离申报

**无未授权偏离。** 本任务命中的授权偏离（公共约束 §3）：无——本任务范围是
纯接线（组件映射表切换 + 测试断言更新），不涉及 §3 列出的 6 条（那些都是
`SkillsSection.vue` 内部实现层面的偏离，属于 Task 6 范围，本任务未修改
`SkillsSection.vue`）。

唯一值得说明、不算"偏离"但需要显式记录的技术决定：
- 在 `SettingsPage.test.ts` 的 `ai` mock 里新增 `listSkills: vi.fn()`
  （不带 `mockResolvedValue`）。这不是对 brief 的偏离——brief 没有明确提到
  这一步，但不加这一步会导致 `SkillsSection` 挂载时对未知方法调用抛错，从而
  让"路过 skills 分区"的既有用例（收口测试、用例 12）产生非预期的 danger
  toast 副作用，掩盖真正要测的东西。这是让"只改 4 个文件"这个约束成立的
  必要前提（不加它就无法让 12→`skills` 迁移在收口测试里干净地绿）。

## 既有测试用例改动清单（改了什么、为什么）

1. **`sections.test.ts`**：1 条用例断言值收缩（`['mcp','skills']` →
   `['mcp']`），因为它直接测试的常量 `DEFERRED_SECTIONS` 本身按任务要求改了，
   这是任务要求的必然改动，不是"为了让测试变绿而削弱断言"——断言的判别力
   没有降低，只是跟随现实。

2. **`SettingsPage.test.ts` 用例 19**：断言方向反转（"弹 toast" → "不弹
   toast + 渲染真组件"），因为 skills 不再是 DEFERRED_SECTIONS 成员，这是
   brief 明确要求的第 4 步。新断言判别力不弱于旧断言（旧断言只测了一个
   `toHaveBeenCalledWith`；新断言测了三件事：DOM 存在真实内容、页面不含
   占位文案、toast 未调用）。

3. **`SettingsPage.test.ts` 收口测试**：`implemented`/`deferred` 两个数组
   分别把 `skills` 移入/移出，理由同上——这条用例本来就是"遍历所有分区，
   分别验证真组件 vs 占位组件"的收口断言，`skills` 变成真组件后，它天然
   应该出现在 `implemented` 分支。断言逻辑（"是否含占位文案"）本身未改，
   判别力不变。

4. **新增用例 19b**：不是删除/削弱，是新增，专门顶替原用例 19 里关于 `mcp`
   仍是占位的那部分覆盖（原用例 19 断言的 toast 调用其实同时验证了
   "skills/mcp 都在 DEFERRED_SECTIONS 里"这件事，拆开后 skills 那半用新的
   19 覆盖，mcp 那半用 19b 覆盖，两半都没丢）。

**没有发现"改法不唯一"的冲突**——brief 给的四步指令与"1:1 照 Vue2"的移植
纪律之间没有张力（本任务不涉及 Vue2 视觉/交互移植，纯粹是本仓库内部的组件
接线与测试维护），故无需触发 NEEDS_CONTEXT。

## 提交

```
$ git show --stat HEAD
$ git status
```
（见下方返回给协调者的 sha）
