# SP8-P2a Task 7 — SettingsRail 左侧导航栏 — 实现报告

commit: `5adb1fa07d07c41f08cc7cf0cced2e7b0d3ed814`

## 做了什么

新增 2 个文件、改了 2 个 i18n 文件:

- `src/ai/components/settings/SettingsRail.vue`(新建,`<script setup>` + TS)
- `src/ai/components/settings/SettingsRail.test.ts`(新建,brief Step 1 给的测试代码逐字照抄)
- `src/i18n/zh_cn.ts`(+8 行,含注释)
- `src/i18n/en_us.ts`(+6 行,含注释)

## Step 2(红)真实输出

```
FAIL  src/ai/components/settings/SettingsRail.test.ts [ src/ai/components/settings/SettingsRail.test.ts ]
Error: Failed to resolve import "./SettingsRail.vue" from "src/ai/components/settings/SettingsRail.test.ts". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

组件文件尚不存在,导入即失败,确认红。

## Step 5(绿)真实输出

```
 Test Files  1 passed (1)
      Tests  12 passed (12)
   Start at  17:29:55
   Duration  704ms
```

**注**:brief 文字里写「13 条全 PASS」,但 Step 1 给的测试代码块实际只有 12 个 `it(...)` 块(`grep -c "  it("` = 12)。测试代码逐字照抄自 brief,未增删任何用例;这里是 brief 文字描述与其自带代码块之间的计数不一致,不是我方遗漏。

## Step 6 RED 验证(两段真实输出)

把 `watch(activeId)` 的展开逻辑从「只展开新组、不收起旧组」改成「先全收起再展开新组」:

```ts
(id) => {
  const gid = groupOf(id).id
  // TEMP RED-VERIFICATION (Step 6) — collapse everything first, then expand
  // only the new group. Must be reverted immediately after confirming red.
  expanded.value = { [gid]: true }
},
```

重跑,红(第一段真实输出):

```
 ❯ src/ai/components/settings/SettingsRail.test.ts (12 tests | 1 failed) 131ms
     × activeId 变到别的组时,自动展开新组(且不收起旧组) 12ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/ai/components/settings/SettingsRail.test.ts > SettingsRail > activeId 变到别的组时,自动展开新组(且不收起旧组)
AssertionError: expected 'false' to be 'true' // Object.is equality
Expected: "true"
Received: "false"
 ❯ src/ai/components/settings/SettingsRail.test.ts:72:46
     70|     await w.setProps({ activeId: 'memory' })    // → agent 组
     71|     const heads = w.findAll('.set-nav-grouphead')
     72|     expect(heads[0].attributes('data-open')).toBe('true')   // model 组…
       |                                              ^
 Tests  1 failed | 11 passed (12)
```

`heads[0]`(model 组)断言先被判红 —— 正是「旧组被误收起」的断言,证明这条测试确实钉住了「只展开不收起」这条行为。

复原成正确逻辑(`if (!expanded.value[gid]) expanded.value[gid] = true`),重跑,绿(第二段真实输出):

```
 Test Files  1 passed (1)
      Tests  12 passed (12)
   Start at  17:33:55
   Duration  767ms
```

## 与 Vue2 `SettingsRail.vue` 的逐块对照

| 块 | Vue2 行号 | New-UI 对应 | 结论 |
|---|---|---|---|
| 头部返回箭头 + 标题 + 副标题 | 4-14 | template 顶部 | 1:1,`chev` 图标 `scaleX(-1)` 翻转照搬,副标题字面量 `Nimo · NAS` 不 i18n(照 Vue2) |
| 导航四组 + 组头折叠 | 15-33 | template `<nav class="set-nav">` | 结构 1:1;`SkillIcon` → `AgentIcon`(T1 已铺好同名图标) |
| 底部账号卡 | 34-42 | template `<div class="set-foot">` | 1:1 |
| data/expanded 初始化 | 60-65 | `expanded` ref 初始化 | 1:1(初始只展开 `groupOf(activeId)`) |
| computed user/userLabel/userMeta | 67-74 | `user`/`userLabel`/`userMeta` computed | 口径改用 `localStorage['user']`,与 AgentSidebar 一致,非新偏离(brief 已预先声明) |
| avatarUrl/avatarSrc | 75-82 | 同名 computed | token 源、URL 前缀均照 AgentSidebar(带前导斜杠) |
| mounted/beforeDestroy EventBus | 84-95 | **不移植**,`<script setup>` 头注释指向 `userProfile.ts` | 见下「申报的偏离」 |
| watch activeId | 96-102 | `watch(() => props.activeId, ...)` | 逻辑逐字保留:只展开新组,不收起旧组 |
| methods onAvatarError/isOpen/toggleGroup/onSelect | 104-111 | 同名函数 | 1:1 |

## 偏离 Vue2 之处(逐一申报)

1. **EventBus `avatar-changed` 订阅整段不移植**(Vue2 :84-95)。理由与 `src/stores/userProfile.ts` 头注释一致:New-UI 无事件总线,`avatarVersion` 已挪到 Pinia 单例,任何地方 `bumpAvatarVersion()` 都会让所有头像重算 URL。与 `AgentSidebar.vue` 的既有处理完全一致,brief 明确预告过这不算新偏离,组件里留了注释指向 `userProfile.ts`。

2. **`v-show` → `v-if`(组内导航项 `.set-nav-groupbody`)**。Vue2 `:22` 用 `v-show`,折叠组的 `.set-nav-item` 元素始终留在 DOM 里(仅 `display:none`),这样 `settings-styles.scss` 里窄屏媒体查询 `@media (max-width:720px) { .set-nav-groupbody { display: flex !important; } }` 才能强制显示每一项。但 brief 给定的 Step 1 测试「点分区 emit select」用 `activeId:'search'`(只展开 agent 组)后 `findAll('.set-nav-item')` 取 `items[0]`,断言它是 `blacklist`(agent 组第一项)——这只有在**折叠组的项完全不在 DOM 里**时才成立;用 `v-show` 时 `items[0]` 会是 model 组的 `models`(该测试实测确认过,见下)。为了让给定测试通过,改用 `v-if`。

   **判据自查**:这不是在「修一个可复现的错误行为」,而是被给定测试反向逼出的渲染策略选择,已在组件里第 22 行加了详细注释说明,这里作为明确的偏离项申报。**已知副作用**:窄屏(≤720px)图标栏模式下,折叠组的项不会因为 CSS `!important` 规则被强制显示 —— 只有当前展开的那个组会显示图标,而不是 Vue2 那样"始终显示全部项、只是没有组标题"。这条不在本任务的任何测试覆盖范围内(jsdom 默认不跑 CSS 媒体查询),留给后续任务/用户验收时观察,若需要恢复 Vue2 的窄屏行为,需要另外设计(例如给 `.set-nav-item` 加 `v-if="isOpen(g.id) || isNarrow"` 之类的显式窄屏判定,这超出本任务范围)。

   （证据:临时把该行改回 `v-show` 后本地重跑,"点分区 emit select" 断言 `expected [ 'models' ] to deeply equal [ 'blacklist' ]`,证实了上述分析;确认后已改回 `v-if` 并保留最终实现。）

## i18n 新增

4 个键,`zh_cn.ts` / `en_us.ts` 都加了(parity 有保证):

| 键 | 中文 | 英文 | 来源 |
|---|---|---|---|
| `aiCfgPersonalize` | 个性化 | Personalize | Vue2 生产 `zh_CN.json`/`en_US.json['Personalize']`,已用 python3 核对 |
| `aiCfgBackToNimo` | 返回 Nimo | Back to Nimo | 同上 `['Back to Nimo']` |
| `aiCfgYou` | 你 | You | 同上 `['You']` |
| `aiCfgLocalAccount` | 本地账户 · NAS | Local account · NAS | Vue2 `zh_CN.json` 里只有完整串 `'Local account · NAS'` 这个 key(查不到单独的 `'Local account'` key),沿用完整串,与 brief 给的值一致 |

## 全量门三条命令结果

```
pnpm test
 Test Files  267 passed (267)
      Tests  1964 passed (1964)
   Duration  53.91s
（无 flaky,一次过）

pnpm exec vue-tsc --noEmit
（无输出,类型检查干净）

pnpm build
✓ 1849 modules transformed.
✓ built in 11.55s
（仅既有的 500KB chunk 警告,无新增错误）
```

## `git show --stat HEAD`

```
commit 5adb1fa07d07c41f08cc7cf0cced2e7b0d3ed814
    SP8-P2a Task 7: SettingsRail 左侧导航栏

 src/ai/components/settings/SettingsRail.test.ts | 114 +++++++++++++++++
 src/ai/components/settings/SettingsRail.vue     | 156 ++++++++++++++++++++++++
 src/i18n/en_us.ts                               |   6 +
 src/i18n/zh_cn.ts                               |   8 ++
 4 files changed, 284 insertions(+)
```

`git status` 之后确认 working tree clean,只提交了这 4 个文件。

---

## Fix round 1 —— 协调者纠正:折叠改回 `v-show`,测试改为组内取项

**协调者的核实是对的,我上一轮的判断错了。** 重新确认根因:

`settings-styles.scss` 窄屏块:
```scss
.set-nav-grouphead { display: none; }              /* 图标栏不要组头 */
.set-nav-groupbody { display: flex !important; }   /* 强制显示所有项 */
```
这条 `!important` 存在的唯一意义,就是覆盖 `v-show` 打在元素上的内联 `display:none`,让窄屏退化成"无分组标题、13 个图标平铺成一条竖栏"。上一轮我把 `v-show` 改成 `v-if` 之后,折叠组的项根本不在 DOM 里,这条 CSS 规则变成永远无法命中的死规则 —— 窄屏导航会缺失除当前展开组以外的所有图标,这是一处真实的「界面严格 1:1」回归,不是可以自行取舍的实现细节。

真正的根因在 brief 给的 Step 1 测试:「点分区 emit select」用全局 `findAll('.set-nav-item')[0]` 反推,这个写法只有在 `v-if`(折叠组的项不存在于 DOM)下才能通过 —— **是测试写错了,不是模板该让步**。协调者已经在 plan 源头修正(NimoOS-UI@7cebccee)。

### 改了什么

1. **`src/ai/components/settings/SettingsRail.vue`**:
   - `.set-nav-groupbody` 的 `v-if` 改回 `v-show`(逐字对齐 Vue2 `SettingsRail.vue:22`)。
   - 组件里那段解释取舍的注释,换成说明为什么必须是 `v-show`:引 Vue2 `:22` + 引 `settings-styles.scss` 窄屏块的 `display:flex!important` 契约,并点名"用 v-if 会让这条 CSS 变成死规则,破坏窄屏图标栏,是一处真实的 1:1 回归"。

2. **`src/ai/components/settings/SettingsRail.test.ts`**:
   - 「点分区 emit select」改成先取 agent 组的 `.set-nav-groupbody`(`findAll('.set-nav-groupbody')[1]`),再在其内部取第一个 `.set-nav-item` 并点击,断言 emit `['blacklist']`。注释里写明原因:折叠用 `v-show`,13 项始终在 DOM 里,全局下标 `[0]` 拿到的是 model 组的 `models` 而非 agent 组的 `blacklist`。
   - 新增契约测试「折叠的组其导航项仍留在 DOM 里(窄屏 CSS 靠 display:flex!important 平铺,v-if 会让它失效)」:`activeId: 'models'` 时断言 `.set-nav-item` 总数为 13(4 组分别 4/5/3/1 项之和)、`.set-nav-groupbody` 总数为 4 —— 钉住"折叠组的项必须仍在 DOM 里"这条契约,防止以后又被人悄悄改回 `v-if`。

### 回头检查其余 11 条测试(在 v-show 下重跑)

按协调者的预判核实:其余 11 条走的是 `data-open` 属性(组头折叠/初始展开/自动展开)、`data-active` 过滤(高亮当前分区)、`.text()` 内容匹配(skills/mcp 项)、`.set-nav-badge` 查找(徽标)、`.set-rail-back` 点击(返回)、`.set-foot img` 的 `src` 断言(头像)—— 这些查询本身不依赖"折叠组的项是否在 DOM 里"这条差异,`v-show` 下全部照常通过,**无需改动**。跑一遍全量确认(见下)。

### RED 验证:新增契约测试

把 `v-show` 改回 `v-if`(临时),重跑,红(真实输出):

```
 ❯ src/ai/components/settings/SettingsRail.test.ts (13 tests | 2 failed) 207ms
     × 点分区 emit select 11ms
     × 折叠的组其导航项仍留在 DOM 里(窄屏 CSS 靠 display:flex!important 平铺,v-if 会让它失效) 11ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/ai/components/settings/SettingsRail.test.ts > SettingsRail > 点分区 emit select
TypeError: Cannot read properties of undefined (reading 'findAll')
 ❯ src/ai/components/settings/SettingsRail.test.ts:50:21
     49|     const agentBody = w.findAll('.set-nav-groupbody')[1]   // agent 组
     50|     await agentBody.findAll('.set-nav-item')[0].trigger('click')

 FAIL  src/ai/components/settings/SettingsRail.test.ts > SettingsRail > 折叠的组其导航项仍留在 DOM 里(窄屏 CSS 靠 display:flex!important 平铺,v-if 会让它失效)
AssertionError: expected [ DOMWrapper{ …(3) }, …(3) ] to have a length of 13 but got 4
- Expected
+ Received
- 13
+ 4
 ❯ src/ai/components/settings/SettingsRail.test.ts:121:40

 Test Files  1 failed (1)
      Tests  2 failed | 11 passed (13)
```

两条断言都如预期红(一条是「点分区 emit select」因为 agentBody 是 `undefined`,另一条是新契约测试的 13→4)。改回 `v-show`,重跑,绿(真实输出):

```
 Test Files  1 passed (1)
      Tests  13 passed (13)
   Start at  17:44:15
   Duration  824ms
```

### 全量门(改回 `v-show` 后)

```
pnpm test
 Test Files  267 passed (267)
      Tests  1965 passed (1965)
   Duration  53.69s
（无 flaky,一次过;比上一轮多 1 条测试 = 本轮新增的契约测试)

pnpm exec vue-tsc --noEmit
（无输出,类型检查干净）

pnpm build
✓ 1849 modules transformed.
✓ built in 11.28s
（仅既有的 500KB chunk 警告,无新增错误）
```

### 结论

- 顾虑 #2 的判断方向是对的(测试有问题,不该为了迁就它牺牲窄屏视觉),但**上一轮选错了修复方向**(改了模板而不是改测试)。这一轮已按协调者指示纠正:模板改回逐字对齐 Vue2 的 `v-show`,测试改成组内取项 + 新增显式契约测试防回归。
- 现在没有新的顾虑。
