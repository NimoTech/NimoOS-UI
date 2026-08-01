# P5b · T8 报告 —— `IndexedFilesView.vue` 第 1 刀

分支 `sp8-ai`,起点 `dfc57ed`(实测基线 317 文件 / 3005 例全绿,`vue-tsc` 0,`vite build` 0)。

## 1. 逐文件改了什么

- **新建** `src/ai/knowledge/views/IndexedFilesView.vue` —— 骨架容器 + 过滤条 7 件 +
  表头 meta + 错误横幅(K14/K19)+ 骨架屏 + 空态(N10)。
- **新建** `src/ai/knowledge/views/IndexedFilesView.test.ts` —— 52 个用例。
- 没有改动其它任何文件(`knowledgeRoutes.ts` / `deferred.ts` / `knowledge.scss` /
  `knowledgeStore.ts` / `KIcon.vue` / i18n 文件一个字都没碰)。

## 2. Vue2 `file:line` → New-UI 对照

蓝本 `NimoOS-UI`(`main@7a6ee6b7`)`src/views/AI/Knowledge/IndexedFilesView.vue`(826 行,
`git show main:` 读取)。

| 区块 | 蓝本行 | New-UI 落点 |
|---|---|---|
| 骨架容器 | :1-5 | `<div class="k-view"><div class="k-scroll"><div class="k-scroll-inner">` |
| Root 下拉 | :7-12 | `rootSelect`/`derivedRoots`/`onRootSelectChange` |
| 路径前缀 + 清除 | :14-21 | `onPathPrefixInput`/`clearPathPrefix` |
| 类型前缀 + 清除 + chip | :23-32 | `onMimePrefixInput`/`clearMimePrefix`/`setLegacyDoc` |
| 状态下拉(N12) | :34-42 | `statusViewLocal`/`onStatusViewChange` |
| 仅看失败勾选 | :44-47 | `onHasErrorChange` |
| 清除按钮 | :49-52 | `clearFilters` |
| 表头 meta | :60-90 | `total`/`statusSuffix`/`isAnyIndexing`/排序下拉/`toggleSortDir` |
| 错误横幅 | :93-103 | K14/K19(见下) |
| 骨架屏 | :106-132 | `pageState==='loading'` 分支 |
| 空态 | :135-142 | `pageState==='empty'` 分支,N10 见下 |
| `refresh()`/`created()` | :459-463(store)/隐式 | `onMounted(() => refresh())` |
| `beforeDestroy()` | 隐式(script 段) | `onUnmounted(() => store.stopIndexedPolling())`,见 §7 |
| `_applyFilter` | 隐式 | 四件事:offset 归零 + 清 selSet + 清 errorBanner + 重载 |
| `clearFilters` | 隐式 | 复位六字段后直接调 `_applyFilter()`(机械去重,非行为改动) |
| `dismissBanner` | 隐式 | 清 `errorBanner` + `store.indexedFiles.error = null` |
| `statusBadgeMap`/derivedRoots/rootSelect computed | 蓝本 computed 段(:459-604 区间) | 逐一对应,见组件内注释 |

## 3. 范围边界说明(哪些蓝本行是 T9/T10 的,本刀确实没碰)

- `pageState === 'ready'` 分支(蓝本 :144 起的表格主体、分页、行详情展开)—— **一个字都没写**,
  组件里只留了一行注释 `<!-- ready 态(表格 + 分页)—— T9/T10 范围,本刀不搬 -->`。
- `expSet`/`doneSet`(展开行 / 绿色闪烁反馈,K13 的另外两个 Set)—— 未声明。
- `EXPLICIT_REBUILD_CAP`(动作条批量重建上限)—— 未声明,本刀错误横幅只用到
  `FILTER_REBUILD_CAP`。
- `selectedCount`/`overExplicitCap`/`rebuildRow`/`rebuildSelected`/
  `openRebuildAllConfirm`/`doRebuildAll`/`showRebuildAllConfirm` 等动作条与整库重建
  确认弹窗(蓝本 :356-381 模板 + :700+ 脚本)—— 未声明任何一个。
- `k-status-badge-cn`(N13)、`statusBadgeMap` 的 `en`/`key` 双字段结构(N14)—— 都在
  ready 态的行渲染里,本刀不涉及,留给 T9。
- `k-modal-head`/`k-modal-title`/`k-modal-x`/`k-modal-body`(K17)—— 本刀模板里没有
  任何弹窗,不涉及。

## 4. 五条点名要求逐条回执

1. **K13** —— 只声明 `selSet = ref<Set<string>>(new Set())`,没有 `selTick`/`expTick`/
   `doneTick`,也没有声明 `expSet`/`doneSet`(本刀不用)。`_applyFilter` 里
   `selSet.value = new Set()` 整体替换。
2. **N10** —— `.k-empty-btn`(组件 `IndexedFilesView.vue` 空态按钮)类名照抄蓝本
   `:139`,**没有加进 `knowledgeStyles.test.ts` 的白名单**(该文件本刀完全未改动)。
   蓝本 `knowledge.scss` 里确实没有这条规则(`git grep k-empty-btn main` 只命中模板那一行),
   渲染成无样式按钮,与 Vue2 一致。功能上仍正确接了 `clearFilters`(用例 12)。
3. **N12** —— `statusViewLocal`(读)与 `onStatusViewChange`(写)完整实现 `active` ↔
   `alive` 反向映射,UI 三值 `active`/`tombstoned`/`all` vs API 侧 `tombstoned` 字段
   三值 `alive`/`tombstoned`/`all`。**没有"统一成一个名字"**。
4. **K14 + K19** —— 错误横幅两个分支都不回显后端原文:
   - K14(`errorBanner` 非空)只渲染 `400 Bad Request` + `aiKbRebuildCapHint`,
     完全不读 `errorBanner.value` 本身的值。
   - K19(`storeError` 非空、`errorBanner` 空)固定渲染 `aiKbLoadErrorLabel` +
     `aiKbLoadErrorBody`,不读 `storeError.value`。
   - 两条都有反向断言(见 §6),且都做了 RED 探针(见 §9)。
5. **filters 仍在 store 里** —— 组件里没有任何 `filters` 本地 `ref`/`computed` 别名,
   全部直写 `store.indexedFiles.filters.xxx`。

## 5. 生命周期与 `_applyFilter` 语义

- `onMounted(() => refresh())`,`refresh()` = `await store.loadIndexedFiles()` 后
  `store.startIndexedPolling()`,对应蓝本 `created()`。
- 补了 `onUnmounted(() => store.stopIndexedPolling())` —— 任务书生命周期小节只点名了
  created 半边,但 `knowledgeStore.ts` 的 `indexedPollTimer` 是**模块级**变量(跨
  Pinia 实例共享),本刀已经会在挂载时可能启动 30 秒轮询(`isAnyIndexing` 为真时,
  真机默认场景 5/8 行 indexing 就会触发),不停轮询会让残留定时器压住
  `startIndexedPolling` 自己的 `if (indexedPollTimer) return` 守卫,污染后续测试/挂载
  (与 T5 M-4 同一教训)。判断这是「补全本刀已经引入的行为的正确生命周期」而非
  「提前搬 T9/T10 的东西」,已有专门测试钉住(见 §11 生命周期 describe,新实例
  能起自己的轮询)。
- `_applyFilter` 四件事一件不缺:`offset = 0` → `selSet.value = new Set()` →
  `errorBanner.value = null` → `refresh()`。
- `clearFilters` 复位六个筛选字段(`path_prefix`/`mime_prefix`/`has_error`/
  `tombstoned`/`sort`/`order`)后直接调用 `_applyFilter()` —— 蓝本原文把四件事在
  `clearFilters` 里又抄了一遍(与 `_applyFilter` 逐字相同),这里机械去重,不是
  行为改动。

## 6. 7 件过滤器的用例位置(均在 `describe('IndexedFilesView — 过滤条…')`)

| # | 控件 | 用例 |
|---|---|---|
| 1 | Root 下拉→具体段 | `1) Root 下拉切到具体段…` |
| 1b | Root 下拉→all | `1b) Root 下拉切回 "all"…` |
| 2 | 路径前缀输入 | `2) 路径前缀输入…` |
| 3/3b | 路径前缀清除按钮 | `3) 路径前缀清除按钮:baseline…` / `3b) 路径前缀清除按钮点击行为…` |
| 4 | 类型前缀输入 | `4) 类型前缀输入…` |
| 5 | 类型前缀清除按钮 | `5) 类型前缀清除按钮…` |
| 6 | 「旧 .doc」chip | `6) 「旧 .doc」快捷 chip…` |
| 7 | 状态下拉 | `7) 状态下拉改动…`(+ 专门的 N12 describe 六条) |
| 8 | 仅看失败勾选 | `8) 「仅看失败」勾选…` |
| 9 | 排序下拉 | `9) 排序下拉改动…` |
| 10 | 升降序按钮 | `10) 升降序按钮…` |
| 11 | 清除按钮 | `11) 「清除」按钮…` |
| 12 | 空态里的清空筛选按钮 | `12) 空态里的「清空筛选」按钮…` |

每条都用 `dirtyState()`/`expectClean()` 两个 helper 先摆脏状态(offset 非零、selSet
非空、errorBanner 非空)再断言四件事全部复位 + `ai.parserFiles` 恰好多调用 1 次。

## 7. `filtersDirty` 六条件 + `statusViewLocal`×`statusSuffix` 覆盖表

`describe('IndexedFilesView — filtersDirty…')` 七个用例:全默认(`false`)+
`path_prefix`/`mime_prefix`/`has_error`/`tombstoned`/`sort`/`order` 各偏离默认值一条
(`true`),每条都用 `.k-filter-bar .k-btn.ghost` 的 `disabled` 属性断言。

`describe('IndexedFilesView — N12…')` 六个用例:

| 方向 | tombstoned 值 | UI 下拉值 | statusSuffix |
|---|---|---|---|
| 读 | `alive` | `active` | `''` |
| 读 | `tombstoned` | `tombstoned` | `' (已删除)'` |
| 读 | `all` | `all` | `' (全部)'` |
| 写 | 选 `active` → 存 `alive`(不是 `active`) | | |
| 写 | 选 `tombstoned` → 存 `tombstoned` | | |
| 写 | 选 `all` → 存 `all` | | |

## 8. K14/K19 反向断言位置

`describe('IndexedFilesView — 错误横幅(K14/K19,反向断言)')`:
- `K19: load-error 分支不回显 e.message…` —— 反向断言 `not.toContain('ECONNREFUSED')` /
  `not.toContain('super-secret-backend-stack-trace')`。
- `K14: rebuild-all 400 分支不回显后端 detail…` —— 反向断言
  `not.toContain('too many file_ids')` / `not.toContain('max 500')`。
- 额外两条:`errorBanner` 优先于 `storeError`(两者都非空时走 400 分支)、点击
  「关闭」同时清空两处状态。

技术说明:`errorBanner` 的赋值函数 `doRebuildAll()` 属于 T9/T10 的动作条范围,本刀没有
声明它,所以 K14 测试没有可点击的 UI 入口能把 `errorBanner` 置为非空。测试改用
`(w.vm as unknown as {...}).errorBanner = '...'` 直接驱动这个 ref。已实测确认
`<script setup>` 顶层 `ref` 即便未 `defineExpose()`,`@vue/test-utils` 的 `wrapper.vm`
在测试环境下仍可读写(Vue 的 `instance.proxy` 走 `setupState` 双向读写,已用一个独立
探针脚本验证:设置 `w.vm.someRef = 'x'` 后 `nextTick()`,模板确实渲染出新值)——这不是
新增功能或绕过组件公开行为,只是本刀范围内没有 UI 路径能到达这个分支。

## 9. N10 说明

`.k-empty-btn` 是蓝本自身的未定义类(`git grep k-empty-btn main` 全仓只命中
`IndexedFilesView.vue:139` 这一行模板,`knowledge.scss` 里没有对应规则)。类名照抄,
渲染成无样式按钮,与 Vue2 行为一致。**没有加进 `knowledgeStyles.test.ts` 白名单**
(该文件本刀零改动)。测试里只验证了它的功能行为(渲染时机 + 点击调用
`clearFilters`),没有为它写任何样式存在性断言。

## 10. 属性态覆盖表(附录 §D.3,本刀范围内)

| 宿主类 | 属性 | 两侧断言 |
|---|---|---|
| `.k-filt-check` | `data-on` | `'true'`/`'false'` 都覆盖,`String()` 照抄蓝本套法 |
| `.k-banner` | `data-tone` | 静态 `'warn'`,K19 分支触发下验证 |

本刀范围内只有这两行属于附录 D.3 的清单(`.k-frow-f`/`.k-status-badge`/
`.k-type-tag`/`.k-frow-vec`/`.k-frow-expand`/`.k-files-actionbar` 等都在 ready 态,
T9/T10 范围)。

## 11. mock 形状逐个说明(取自哪个 fixture)

| 常量 | 来源 | 说明 |
|---|---|---|
| `FILES_ALL_8` | `p5b-fixtures/files-all-8.json` | 逐字转录,8 个文件(5 indexing/3 ok),真机 2026-08-01 实测分布 |
| `ALL_OK_FILES` | `FILES_ALL_8` 的子集(非新造) | `.filter(f => f.status === 'ok')`,真机没有「全 ok」整 8 行场景,只能这样从已核实数据挑子集 |
| `EMPTY_RESULT` | `p5b-fixtures/files-has-error.json` | `{"total":0,"limit":3,"offset":0,"files":[]}` 逐字,借来当通用空态 fixture(形状不变) |
| `MULTI_ROOT_FILES` | 人工构造 | README 登记:真机 8 个文件全在 `/DATA` 下,测不出多 root;字段名(`file_id`/`paths`/`status`)与 fixture schema 一致,仅路径值不同,已在注释里标明 |

`service.ai.parserFiles` 按 §4.1 是零转换(fixture 原样 snake_case),本文件 mock
形状与此一致,没有涉及 `service.notes.*`(camelCase 归一化那批,本刀不需要)。

## 12. RED 探针(5 次,已全部还原,`git status --short` 只剩两个新文件)

1. **`rootSelect` 的 `derivedRoots.includes` 判据删掉** →
   `rootSelect 反查:path_prefix 不匹配任何 derivedRoots → 回落 'all'` 报红:
   `AssertionError: expected '' to be 'all'`。已改回。
2. **`_applyFilter` 里的 `offset = 0` 删掉** → 11 个过滤器用例集体报红,代表性输出:
   `AssertionError: expected 300 to be +0`(`expectClean` 里的 offset 断言)。已改回。
3. **N12 的 `active`→`alive` 映射改成直传** →
   `写方向 1/3:选 '有效'(active,option value)→ store 存的是 'alive'…` 报红:
   `AssertionError: expected 'active' to be 'alive'`。已改回。
4. **K14 改回回显后端 `detail`**(在 `errorBanner` 非空分支里加回
   `· {{ errorBanner }}`)→
   `K14: rebuild-all 400 分支不回显后端 detail…` 的反向断言报红:
   `AssertionError: expected '400 Bad Request · too many file_ids (…' not to contain 'too many file_ids'`。已改回。
5. **往模板 `style=` 里塞一个 `#ff0000`**(错误横幅的 `color: var(--text-tertiary)`
   临时改成 `color: #ff0000`)→
   守卫缺口③的定向断言报红:`AssertionError: expected '...' not to match /#[0-9a-fA-F]{3,8}\b/`。
   已改回。

每次探针后都单独跑了 `pnpm exec vitest run src/ai/knowledge/views/IndexedFilesView.test.ts`
确认只有目标用例报红、其余仍绿,改回后 `git status --short` 只剩两个新增未跟踪文件,
无残留 diff。

## 13. 三门实测数字

- 起点基线:317 文件 / 3005 例全绿,`vue-tsc` 0,`vite build` 0。
- 本刀终值:
  - `pnpm test`:**318 文件 / 3058 例全绿**(exit 0)。
  - `pnpm exec vue-tsc --noEmit`:**exit 0**,零错误。
  - `pnpm build`:**exit 0**,只有既有的 chunk-size 警告(与本刀无关,`ExcelViewer`/
    `pdf.worker`/`index-DHViqluJ` 等既有大包)。
- 增量:+1 测试文件、**+53 例**(52 条本文件新增 + 1 条 `color-guard.test.ts` 对新
  `.vue` 文件的动态发现)。任务书预期"+40 例左右",实测多 13 例——差异来自本刀
  比预期写了更完整的覆盖(六条 filtersDirty 独立用例、六条 N12 矩阵、多条 rootSelect
  反查边界、K14/K19 各带多条反向/优先级断言、生命周期的双实例回归钉子等),没有
  空转或恒真断言(逐条都验证过 RED 探针或有判别性)。

## 14. 遗留疑问 + 给 T9 的交接项

- 无 `NEEDS_CONTEXT` 级别的疑问,治理文件与附录逐条对上,fixture 齐全。
- **给 T9 的交接项**:
  1. `pageState === 'ready'` 分支(表格主体 + 行渲染 + `statusBadgeMap` 双字段
     N14 + `k-status-badge-cn` N13)从蓝本 :144 起接着搬,组件里已留占位注释
     `<!-- ready 态(表格 + 分页)—— T9/T10 范围,本刀不搬 -->`,直接在这行后面写。
  2. `selSet`/`derivedRoots`/`rootSelect`/`pageState`/`filtersDirty`/`_applyFilter`/
     `refresh` 等本刀已实现的 computed/函数可以直接复用,不需要重新声明。
  3. `expSet`/`doneSet`(展开行 + 绿色闪烁)、`EXPLICIT_REBUILD_CAP`、
     `selectedCount`/`overExplicitCap` 等都还没声明,T9/T10 按需新增。
  4. `errorBanner` 这个 ref 已经存在且展示逻辑已经是 K14 合规版本 —— T9/T10 只需要
     在 `doRebuildAll()` 的 catch 分支里赋值(**不要**把后端 `detail` 塞进去,K14
     仍然要求「警示条只留固定文案」,`errorBanner` 的值本身可以存 detail 用作
     调试/日志,但模板不能读它来展示,当前模板已经是这个形态,T9/T10 改动
     `doRebuildAll` 时注意别改回模板去读 `errorBanner` 的值)。
  5. 本刀的测试文件用 `(w.vm as unknown as {...}).xxx` 直接读写 `<script setup>`
     内部 ref 的技巧(用于测试没有 UI 入口的分支)在 T9/T10 如果遇到类似「状态
     存在但入口还没搬」的情况可以复用,但优先级仍是「有 UI 入口就走 UI 交互」。
  6. `.k-filt select` / `.k-sort select` 的选择器约定(用 CSS 结构定位而非索引硬编
     T9 若要在 ready 态里加更多 `<select>`,注意 `w.findAll('.k-filt select')` 的
     下标可能因新增 `.k-filt` 块而移位,建议保持只有 Root/Status 两个 `.k-filt`
     下拉,其余下拉走别的容器 class。
