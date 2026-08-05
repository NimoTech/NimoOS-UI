# SP8-P3a Task 6 —— `SkillsSection.vue` 实现报告

## 产出

- `src/ai/components/settings/sections/SkillsSection.vue`(新文件)
- `src/ai/components/settings/sections/SkillsSection.test.ts`(新文件,9 例)

蓝本:`/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Skills/SkillsSection.vue`(226 行),只取只读部分。

## 逐文件改了什么 / Vue2 file:line → New-UI 对照

| Vue2 `SkillsSection.vue` | New-UI `SkillsSection.vue` | 说明 |
|---|---|---|
| `:2` 根 `<div class="set-split">` | 根 `<div class="set-split">` | 1:1 |
| `:4-12` `.sk-col-head` > `.sk-col-actions`(刷新 + `+` 两个按钮) | 同结构,**只留刷新按钮**,`+` 处留占位注释 | brief §6.1,P3b 范围 |
| `:6-8` 刷新按钮 `SkillIcon name="refresh" :size="15"` | `AgentIcon name="refresh" :size="15"` | 偏离 2(图标组件替换) |
| `:9-11` `+` 添加按钮 `adding = true` | 不渲染,注释占位 | brief §6.1 |
| `:14-25` `.sk-col-search`(图标 + input + 清空按钮) | 1:1 结构,图标替换为 AgentIcon,显式传 `color="var(--text-tertiary)"` 对齐 Vue2 `:15` 的显式传色 | — |
| `:17-24` 清空按钮内联 `style="width:18px;height:18px"` | 原样照抄 | brief 点名:尺寸非颜色,不违反 color-guard |
| `:26-54` `.sk-list`(loading 态 / 两个 SkillGroup / 空态) | 1:1 结构 | — |
| `:27-29` loading 态内联 `style="display:grid;place-items:center;padding:28px 0"` | 原样照抄 | 同上,布局非颜色 |
| `:31-44` 两个 `SkillGroup`(内置/我的) | 1:1,`:active-id="activeId"` **显式传**(brief 点名 SkillGroup 无默认值) | — |
| `:45-52` `filtered.length===0` 空态(有/无 query 两种文案) | 1:1 | — |
| `:57-63` `SkillDetail`(带 `busy`/`@toggle`/`@delete`/`@test`) | `<SkillDetail :skill="activeSkill" />`(只传 `skill`,Task 5 未声明这些 prop/事件) | 只读半范围内合理裁剪,Task 5 SkillDetail 本就没有这些 prop |
| `:65-70` `AddSkillModal` | 不渲染 | brief §6.1 |
| `:72-77` `.sk-toast` transition | 不渲染 | 公共约束 §3 偏离 3 |
| `:91-103` `data()` | `ref`(skills/loading/activeId/query) | brief §6.2 骨架 |
| `:105-118` 四个 computed | 1:1(filtered/builtIn/personal/activeSkill) | — |
| `:120-122` `mounted` | `onMounted(() => reload())` | — |
| `:129` `setActive(id)` | 1:1 | — |
| `:130-144` `reload()` | 单层取数(见下「偏离」) | 公共约束 §4、brief §6.2 |
| `:145-215` `setBusy`/`onToggle`/`onDelete`/`onCreate`/`onTest` | 不移植 | P3b 范围 |
| `:219-226` `<style scoped>`(toast fade transition) | 不移植 | 偏离 3 联动 |

## 偏离显式申报

1. **`reload()` 单层取数**(公共约束 §3 偏离 1,brief §6.2 核心)——Vue2 `:133-134` 写 `const resp = await ai.listSkills(); this.skills = resp.data || []`(axios 层剥取)。共享包 `service.ai.listSkills()`(`NimoOS-Service/dist/ai.d.ts:75`)已经 `return res.data` 剥过一次,后端 `NimoOS-AI/route/v2/skills.go:37` 是 `c.JSON(200, out)` 裸数组——照抄会在裸数组上再取 `.data` 恒为 `undefined`,`|| []` 兜底掩盖了这一点,列表永远空。本仓改为 `const list = (await service.ai.listSkills()) as Skill[]; skills.value = Array.isArray(list) ? list : []`,不再多剥一层。已在 RED→GREEN 验证中证实此偏离对测试有真实鉴别力(见下)。
2. **`.sk-toast` 不移植,改用全局 toast**(公共约束 §3 偏离 3)——Vue2 `:139-140` 失败时 `console.error` + `showToast('Could not load skills')`,且其 `.sk-toast` 模板(`:73-74`)**无条件**渲染绿色 check 图标,连失败提示也顶着"成功"勾,是 Vue2 自身的缺陷,不照抄。本仓改为 `toast.show(t('aiSkLoadFailed'), 3000, 'danger')`。`console.error`(`:139`)同样不照抄——三个兄弟分区(BlacklistSection/ExecutionSection/MemorySection)均无此惯例。
3. **`SkillIcon.vue` 不移植**,统一用 `AgentIcon.vue`(公共约束 §3 偏离 2,与 Task 4/5 一致)。
4. **`+` 添加按钮不渲染**,留占位注释(brief §6.1 明确要求,非本任务自行决定)。

以上 4 条均落在公共约束 §3 已授权的 6 条偏离范围内(1/2/3 对应偏离 1/3/2;4 是 brief 本身给的任务边界,不算"新偏离")。**没有命中授权清单之外的偏离。**

## RED → GREEN 证据

对 `reload()` 故意重新引入 Vue2 的双层剥取(`const resp = await service.ai.listSkills() as {data?:Skill[]}; const list = resp.data || []`),单独跑 `SkillsSection.test.ts`:

```
 FAIL  … > 给 { data: [...] } 形状(axios 层)时列表为空 …
   expect(w.findAll('.sk-item')).toHaveLength(0)  // 实际变成 0 vs 期望的「非 0」逻辑倒转
 FAIL  … > 搜索按 name/title/description 三字段小写包含过滤 …
   expected [] to have a length of 2 but got +0
 FAIL  … > 点条目切换 activeSkill(右侧详情联动) …
   Error: Cannot call text on an empty DOMWrapper.
 FAIL  … > 选中项被搜索过滤掉后不崩 …
   Error: Cannot call text on an empty DOMWrapper.
 FAIL  … > 刷新按钮触发重新加载 …
   expected [] to have a length of 1 but got +0

 Test Files  1 failed (1)
      Tests  7 failed | 2 passed (9)
```

7/9 例转红(只有"两种空态文案"与"reload 失败弹 toast"两例与数据层无关,保持绿),证明这批测试对「单层 vs 双层取数」有真实鉴别力,不是空转断言。还原代码后重跑:

```
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

`git status` 确认还原后无残留改动(探针只在内存里改了一次又立即用 Edit 工具还原到原文,提交前的 `git status` 干净)。

## i18n 复用/新增键清单

**全部复用,零新增。** 用到的键均已由前序任务(Task 1/2/8 等)预先加入 `zh_cn.ts`/`en_us.ts`:

- `aiSkSearchPlaceholder`、`aiSkBuiltIn`、`aiSkYours`、`aiSkNoMatch`、`aiSkEmpty`、`aiSkLoadFailed`
- `aiCfgRefresh`(与 `SettingsPage.vue` 顶栏刷新按钮共用同一键)

未新增任何 i18n 键,故本任务不涉及 `parity.test.ts`/`messageSyntax.test.ts` 的新断言面。

## CSS 类核对(零 `<style>` 块)

组件模板用到的类均已 grep 确认存在:

- `set-split`、`sk-col-actions`、`icon-btn` —— `src/ai/styles/settings-styles.scss:86-89, 346-353`
- `sk-col`、`sk-col-head`、`sk-col-search`、`sk-list`、`sk-col-empty`、`sk-spinner` —— `src/ai/styles/skills-styles.scss`(Task 1)

组件文件本身**零 `<style>` 块**。

## 三门完整终值

```
pnpm test                   exit=0
  Test Files  291 passed (291)
  Tests       2405 passed (2405)

pnpm exec vue-tsc --noEmit  exit=0   (无输出)

pnpm build                  exit=0
  (仅既有 >500KB chunk 警告,无新增第三方警告)
```

基线为 290 文件 / 2395 例。新增 1 个 `.vue` 文件让 `color-guard.test.ts` 自动 +1 例,`SkillsSection.test.ts` 自身 9 例,`290+1=291` 文件、`2395+9+1=2405` 例,与实测数字吻合。未见任何红项,`persist.test.ts` 已知 flaky 本轮未触发,无需复跑。

## 提交

单一语义提交,显式列路径(未用 `git add -A`):

```
git add src/ai/components/settings/sections/SkillsSection.vue \
        src/ai/components/settings/sections/SkillsSection.test.ts
git commit -m "sp8-ai P3a Task 6: add SkillsSection.vue (read-only skills list + detail wiring)"
```

`git show --stat HEAD` 只含这两个新文件;`git status` 提交后干净。

## 顾虑 / NEEDS_CONTEXT

无。所有偏离均落在公共约束 §3 已授权清单内,未发现需要协调者裁决的冲突点。

---

# 修复回合 —— 评审 Important:「搜索按三字段过滤」用例盲区

## 发现回顾

独立评审对 `SkillsSection.test.ts:106-131`(原「搜索按 name/title/description 三字段小写包含过滤」)做探针:删掉 `filtered` computed 里的 `s.name` 判断分支,9 例仍全绿——该用例只用共享词 `'FAMILY'` 命中 `description` 字段,对 `name`/`title` 两个分支没有独立验证。生产代码（`SkillsSection.vue` 的 `filtered` computed)本身与 Vue2 `:105-113` 一致、无缺陷,是**测试盲区**,只改测试,未动 `filtered` 逻辑。

## 修复:三字段独立验证

删除原单一用例,新增 `threeFieldFixture()` 辅助函数 + 三条独立 `it`:

- fixture 含 3 个技能,每个技能各配一个**唯一 token**,该 token 只出现在对应技能的
  **一个**字段里,且不与另外两个技能的任何字段重叠(`orion-alpha-token` 只在
  `by-name` 的 `name`;`Zephyr-Beta-Token` 只在 `by-title` 的 `title`;
  `nebula-gamma-token` 只在 `by-desc` 的 `description`)。
- 「搜索命中 name 字段」:搜 `orion-alpha` → 断言剩 1 条且是 `orion-alpha-token`。
- 「搜索命中 title 字段(大小写不敏感)」:搜 `ZEPHYR-BETA`(全大写,顺带保留原用例
  的大小写不敏感覆盖)→ 断言剩 1 条且是 `plain-name-beta`。
- 「搜索命中 description 字段」:搜 `nebula-gamma` → 断言剩 1 条且是 `plain-name-gamma`。

每条用例都独立验证「命中预期那条 + 不误伤另外两条」(另外两条的名字都不包含搜索词,若过滤逻辑退化成「其他字段也能瞎命中」,断言的 `toHaveLength(1)` 会先报错)。

## RED → GREEN 证据(三个分支各一次)

### 探针 1 —— 删除 `filtered` 里的 `s.name` 判断

```ts
return skills.value.filter(
  (s) =>
    // RED-PROBE-1(临时,验证完立即还原)
    (s.title || '').toLowerCase().includes(q) ||
    (s.description || '').toLowerCase().includes(q),
)
```

```
 ❯ src/ai/components/settings/sections/SkillsSection.test.ts (11 tests | 1 failed) 162ms
     × 搜索命中 name 字段(不误伤 title/description 都不含该词的另外两条) 16ms

 FAIL  … 搜索命中 name 字段(不误伤 title/description 都不含该词的另外两条)
AssertionError: expected [] to have a length of 1 but got +0
    131|     await w.find('.sk-col-search input').setValue('orion-alpha')
    132|     await flush()
    133|     expect(w.findAll('.sk-item')).toHaveLength(1)
       |                                   ^

 Test Files  1 failed (1)
      Tests  1 failed | 10 passed (11)
```

只有「搜索命中 name 字段」精确报红,其余 10 例(含另两条搜索用例)保持绿。

### 探针 2 —— 删除 `filtered` 里的 `s.title` 判断

```ts
return skills.value.filter(
  (s) =>
    // RED-PROBE-2(临时,验证完立即还原)
    (s.name || '').toLowerCase().includes(q) ||
    (s.description || '').toLowerCase().includes(q),
)
```

```
 ❯ src/ai/components/settings/sections/SkillsSection.test.ts (11 tests | 1 failed) 164ms
     × 搜索命中 title 字段(大小写不敏感,不误伤 name/description 都不含该词的另外两条) 18ms

 FAIL  … 搜索命中 title 字段(大小写不敏感,不误伤 name/description 都不含该词的另外两条)
AssertionError: expected [] to have a length of 1 but got +0
    142|     await w.find('.sk-col-search input').setValue('ZEPHYR-BETA')
    143|     await flush()
    144|     expect(w.findAll('.sk-item')).toHaveLength(1)
       |                                   ^

 Test Files  1 failed (1)
      Tests  1 failed | 10 passed (11)
```

只有「搜索命中 title 字段」精确报红。

### 探针 3 —— 删除 `filtered` 里的 `s.description` 判断

```ts
return skills.value.filter(
  (s) =>
    // RED-PROBE-3(临时,验证完立即还原)
    (s.name || '').toLowerCase().includes(q) ||
    (s.title || '').toLowerCase().includes(q),
)
```

```
 ❯ src/ai/components/settings/sections/SkillsSection.test.ts (11 tests | 1 failed) 172ms
     × 搜索命中 description 字段(不误伤 name/title 都不含该词的另外两条) 13ms

 FAIL  … 搜索命中 description 字段(不误伤 name/title 都不含该词的另外两条)
AssertionError: expected [] to have a length of 1 but got +0
    153|     await w.find('.sk-col-search input').setValue('nebula-gamma')
    154|     await flush()
    155|     expect(w.findAll('.sk-item')).toHaveLength(1)
       |                                   ^

 Test Files  1 failed (1)
      Tests  1 failed | 10 passed (11)
```

只有「搜索命中 description 字段」精确报红。三个探针依次还原(逐字复原 `filtered` computed 为
`(s.name||'').toLowerCase().includes(q) || (s.title||'').toLowerCase().includes(q) || (s.description||'').toLowerCase().includes(q)`),
每次还原后 `git diff src/ai/components/settings/sections/SkillsSection.vue` 均为空,确认生产代码逐字复原、无残留改动。

## 自查其余 8 条用例(判据同上:删对应生产代码行还能过 = 空转)

逐条推演/实测:

| 用例 | 对应生产代码 | 结论 |
|---|---|---|
| 挂载即加载,渲染两组 | `onMounted(reload)` + `builtIn`/`personal` computed | **发现同类盲区,已修补**(见下) |
| 裸数组→非空 | `reload()` 单层取数 | 已在 Task 6 首轮 RED 验证覆盖,无新盲区 |
| `{data:[...]}`→空 | 同上 | 同上 |
| 两种空态文案 | `v-if="query"` 分支 + `{{query}}` 插值 | 推演:去掉 `v-if` 分支或把 `{{query}}` 换成空串,第二阶段断言(`toContain('没有匹配的技能')` / `.sk-col-empty code` 文本 `'nope'`)会先报错,无盲区 |
| 点条目切换 activeSkill | `setActive(id)` + `@click` 接线 | 推演:`setActive` 被禁用或 `@click` 未接线,点击后文案仍是 `Skill A`,断言 `toBe('Skill B')` 直接报红,无盲区 |
| 选中项被过滤掉后不崩 | `activeSkill` 从 `skills.value`(非 `filtered.value`)查找 | 推演:若误改成从 `filtered.value` 查找,过滤后找不到会返回 `null`,`SkillDetail` 渲染空态,`.sk-name span` 不存在,`.text()` 对空 wrapper 抛错,测试仍会失败(以异常形式),无盲区 |
| reload 失败弹 danger toast 且 loading 复位 | `catch`/`finally` 块 | 推演:去掉 `finally` 里的 `loading.value = false`,`.sk-spinner` 断言 `toBe(false)` 直接报红;去掉 `toast.show(...)` 调用,`show` 断言直接报红,无盲区 |
| 刷新按钮触发重新加载 | `@click="reload"` | 推演:按钮不接 `reload`,`h.listSkills` 调用次数断言(`toHaveBeenCalledTimes(2)`)直接报红,无盲区 |

**发现并修补的同类盲区**:「挂载即加载,渲染内置/我的两组」原先只断言「两个分组标签文案」+「总条目数=2」,**没有验证每组内容是否装对**。用 RED 探针把 `builtIn`/`personal` 两个 computed 的 `filter` 条件互换(内置↔我的互换)后,该用例单独重跑**仍然绿**(总数、标签都不受影响,只是内容装错组)——这正是与评审发现同一类「聚合断言掩盖内容错位」的盲区。

修补:改用 `w.findAllComponents(SkillGroup)` 直接读取每个 `SkillGroup` 实例收到的 `label`/`items` props(不再依赖 DOM 顺序推断),断言 `groups[0]` 是「内置技能」且只含 `built-a`、`groups[1]` 是「我的技能」且只含 `mine-b`。

RED 验证(互换 `builtIn`/`personal` 的 filter 条件,单独重跑该用例):

```ts
// RED-PROBE-4(临时,验证完立即还原)
const builtIn = computed(() => filtered.value.filter((s) => !s.system))
const personal = computed(() => filtered.value.filter((s) => s.system))
```

```
 ❯ src/ai/components/settings/sections/SkillsSection.test.ts (11 tests | 1 failed | 10 skipped) 72ms
     × 挂载即加载,渲染内置/我的两组,且每组各自只含对应 system 归属的技能 72ms

AssertionError: expected [ 'mine-b' ] to deeply equal [ 'built-a' ]
    80|     expect(groups[0].props('items').map((s: Skill) => s.name)).toEqual…
       |                                                                ^
 Test Files  1 failed (1)
      Tests  1 failed | 10 skipped (11)
```

精确报红,证明加固后的断言有鉴别力。还原 `builtIn`/`personal` 后 `git diff SkillsSection.vue` 为空,单独重跑该用例转绿:

```
 Test Files  1 passed (1)
      Tests  11 passed (11)
```

## 覆盖用例名(修改/新增,共 4 条改动 + 保留 7 条不变)

- 改:`挂载即加载,渲染内置/我的两组` → `挂载即加载,渲染内置/我的两组,且每组各自只含对应 system 归属的技能`(加固断言,同名测试非新增)
- 删:`搜索按 name/title/description 三字段小写包含过滤(对齐 Vue2 :105-112)`
- 增:`搜索命中 name 字段(不误伤 title/description 都不含该词的另外两条)`
- 增:`搜索命中 title 字段(大小写不敏感,不误伤 name/description 都不含该词的另外两条)`
- 增:`搜索命中 description 字段(不误伤 name/title 都不含该词的另外两条)`
- 不变:`裸数组 mock → 列表非空`、`给 { data: [...] } 形状时列表为空`、`两种空态文案`、
  `点条目切换 activeSkill`、`选中项被搜索过滤掉后不崩`、`reload 失败弹 danger toast`、
  `刷新按钮触发重新加载`(既有断言未削弱/未删除)。

## 三门完整终值(修复回合)

```
pnpm test                   exit=0
  Test Files  291 passed (291)
  Tests       2407 passed (2407)

pnpm exec vue-tsc --noEmit  exit=0   (无输出)

pnpm build                  exit=0
  (仅既有 >500KB chunk 警告,无新增第三方警告)
```

基线 291 files / 2405 tests(上一轮)。本轮净增 2 例(删 1 增 3,`2405 - 1 + 3 = 2407`),文件数不变(291,未新增文件)。未见任何红项,无需复跑 flaky 用例。

## 提交(修复回合)

```
git add src/ai/components/settings/sections/SkillsSection.test.ts \
        .superpowers/sdd/p3a-task-6-report.md
git commit -m "sp8-ai P3a Task 6 fix: strengthen search-field and group-membership tests"
```

`SkillsSection.vue`(生产代码)本回合**未改动**——`git diff HEAD~1 -- src/ai/components/settings/sections/SkillsSection.vue` 为空。`git show --stat HEAD` 只含测试文件与本报告;`git status` 提交后干净。

## 顾虑 / NEEDS_CONTEXT(修复回合)

无。生产代码逻辑未触碰,所有改动局限于测试文件本身,4 个 RED 探针均已逐一验证并精确还原。
