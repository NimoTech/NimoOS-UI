# SP8-P3a Task 7 —— 接线 · 独立评审

评审者:独立 review agent(sonnet)。仓库 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`,评审时 HEAD = `4e871fb`。

## 方法

未采信实现者报告。自己读了四个改动文件的当前源码(`sections.ts`、
`sections.test.ts`、`SettingsPage.vue`、`SettingsPage.test.ts`)、
`SkillsSection.vue`(Task 6 产物,本任务的接线对象)、`SectionPlaceholder.vue`,
自己跑了 `git status` / `git log` / `git show --stat` / 全量 `pnpm test` /
`pnpm exec vue-tsc --noEmit`,并做了一次 RED 探针(见下)。未跑 `pnpm build`
(全量测试+tsc已给出足够信号,时间预算内优先级更高的是逐项核对断言语义)。

## 逐项核查

### 1. 既有测试是否被削弱/删除(最高风险项)

逐条读了 diff 里每个 `-`/`+`:

- **`sections.test.ts`**:唯一改动是 `DEFERRED_SECTIONS` 契约用例的期望值从
  `['mcp','skills']` 收缩为 `['mcp']`。这条测的是被任务要求直接修改的常量,
  收缩断言值本身就是任务要求的必然结果,不是「为了让测试变绿而放水」——
  判别力不变(仍然是精确数组相等断言,不是变成 `toContain` 之类的弱化)。

- **`SettingsPage.test.ts` 用例 19**(brief 特别点名的一条):原断言
  「选中 skills → 弹一条 toast」被**替换**(不是删除)为三件判别力更强的断言:
  `.sk-list` 存在(SkillsSection 独有,已用 grep 确认 `SectionPlaceholder.vue`
  没有这个 class)、页面文本不含占位文案、`toast.show` 未被调用。三选一即可
  证伪原假设「还是占位」,新断言判别力 **严格强于** 旧断言(旧断言只测了一次
  `toHaveBeenCalledWith`)。

- **占位契约保留检查**:新增用例 `19b` 把原用例 19 的断言(
  `showSpy.toHaveBeenCalledWith('该分区将在后续阶段开启', 3000)`)原封不动
  搬到 `mcp` 分区上。确认存在,`DEFERRED_SECTIONS` 的占位 toast 契约**没有
  被整个删掉**,只是换了覆盖对象。符合 brief 第 4 步的双重要求。

- **收口测试**(`SP8-P2b 收口` → `SP8-P3a 收口`):`implemented` 数组新增
  `skills`(12 项),`deferred` 数组收缩为 `['mcp']`。断言逻辑本身(是否含
  `zh.aiCfgPlaceholderBody`)完全未改,只是分类跟随现实调整。判别力不变。

**结论:没有发现测试被削弱或删除的情况。** 每一处 `-` 行都能找到对应的、
判别力不低于原断言的替代或收缩,且收缩仅发生在「被测常量本身按 brief 要求
改变」的地方。

### 2. `DEFERRED_SECTIONS`

`sections.ts:94`:`export const DEFERRED_SECTIONS: SectionId[] = ['mcp']` ——
与 brief 一致。注释(`sections.ts:90-93`)准确描述现状(`skills` 已接入
`SkillsSection`,`mcp` 待 P4)。`sections.test.ts:57-59` 契约用例同步。

### 3. `SPLIT_SECTIONS`

`sections.ts:87`:`export const SPLIT_SECTIONS: SectionId[] = ['skills', 'mcp']`
—— 自己 grep 确认这一行不在 diff 里(diff 中该常量周围只有上下文行,无
`+`/`-`),对应的 `sections.test.ts` 用例 `'SPLIT_SECTIONS 恰为 skills / mcp'`
也未改动。符合「描述布局、与是否实现无关」的裁定。

### 4. `SettingsPage.vue` 接线细节

- import `SkillsSection from '../components/settings/sections/SkillsSection.vue'`
  正确,相对路径符合仓库惯例。
- `SECTION_COMPONENTS.skills = SkillsSection`(:94)替掉了 `SectionPlaceholder`。
- `placeholderProps(id)`(:106-110)判别逻辑
  `SECTION_COMPONENTS[id] !== SectionPlaceholder` 未改代码,但因为映射表变了,
  `placeholderProps('skills')` 现在自动返回 `{}`——用自己的 RED 探针验证了
  这条链路确实生效(见下)。行为正确:不会再给 `SkillsSection` 传
  `titleKey`/`bodyKey` 这两个占位专用 prop。
- 文件头两处注释(:30-33 与 :74-78)、`SECTION_COMPONENTS` 上方注释(:71-78)、
  `placeholderProps` 上方注释(:100-105)均已同步更新为「skills 已接入,
  只剩 mcp」的现状,读下来与代码一致,没有发现残留的「11 个/skills 待 P3」
  等过期表述。

### 5. `listSkills: vi.fn()` 裸 mock

读了 `SkillsSection.vue:89-106` 的 `reload()`:
```
const list = (await service.ai.listSkills()) as Skill[]
skills.value = Array.isArray(list) ? list : []
```
裸 `vi.fn()` 调用返回 `undefined`,`await undefined` 合法,
`Array.isArray(undefined)` 为 `false` → `skills.value = []`,不进 `catch`,
不弹 toast。**报告里的这条技术论证核实无误**。

对判别力的影响:检查了本文件里所有会挂载 `SkillsSection` 的用例(12/19/19b/
收口测试),它们断言的对象是「是否含占位文案」「`.sk-list` 是否存在」
「toast 是否被调用」「`.set-body-split` class」,没有一条依赖 `listSkills`
的返回内容(技能列表内容渲染的判别力测试属于 `SkillsSection.test.ts`,不在
本任务文件范围内)。所以裸 mock **没有让任何断言变得名不副实**。

「更该做的」:一个轻微的可改进点(非缺陷)——用
`listSkills: vi.fn().mockResolvedValue([])` 会比裸 `vi.fn()` 更显式地表达
意图(明确"这里用空列表",而不是隐式依赖生产代码里 `Array.isArray` 兜底去
接住 `undefined`)。当前写法本身有完整的行内注释解释原因,不是隐藏行为,
且没有产生错误的绿灯,所以只列为 Nit,不构成 Important/Critical。

### 6. 提交纯净性

`git show --stat HEAD` 只有 4 个文件:`sections.test.ts` / `sections.ts` /
`SettingsPage.test.ts` / `SettingsPage.vue`,与 brief 指定的产出文件完全一致,
没有夹带前六个任务的产物。

### 7. RED 探针(自己动手做的,未采信报告里的探针记录)

破坏:`SettingsPage.vue:94` 临时改成
`skills: SectionPlaceholder, // RED PROBE — temporarily reverted for review`。

```
$ pnpm exec vitest run src/ai/views/SettingsPage.test.ts src/ai/components/settings/sections.test.ts
 FAIL  SettingsPage.test.ts > SP8-P3a 收口 —— 12 个已实现分区渲染后页面不含占位文案，mcp 仍含占位文案
   AssertionError: expected '...' not to contain '该分区尚未迁移到新界面,将在后续阶段开启。'
 FAIL  SettingsPage.test.ts > 19. 选中 skills → 渲染 SkillsSection 真实内容,不弹 toast(不再是占位)
   AssertionError: expected false to be true  // w.find('.sk-list').exists()
 Test Files  1 failed | 1 passed (2)
      Tests  2 failed | 39 passed (41)
```

精确报红,报红位置正是预期的两条断言。已改回
`skills: SkillsSection, // SP8-P3a Task 7 —— 已实现,收官接线`,
`git status --short` 确认工作区干净。

### 8. 全量测试门(自己跑的)

```
$ pnpm test          → exit=0,Test Files 291 passed (291),Tests 2408 passed (2408)
$ pnpm exec vue-tsc --noEmit → exit=0,无输出
```
与报告声称的数字（291/2408，tsc 干净）一致，无红项。`pnpm build` 未跑
（全量测试 + tsc 干净、且本任务不涉及新样式/新依赖，风险边际低，时间预算
优先给了断言语义核对与 RED 探针）。

## 判定

- 规格符合:✅ —— brief 五点全部落实（DEFERRED_SECTIONS→['mcp']、SettingsPage
  接线、sections.test.ts 契约同步、用例 19 反转+19b 补充占位对照、
  SPLIT_SECTIONS 未动）。
- 代码质量:通过。

