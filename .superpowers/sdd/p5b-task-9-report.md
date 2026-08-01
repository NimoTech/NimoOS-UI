# P5b · T9 报告 —— `IndexedFilesView.vue` 第 2 刀:表头行 + 文件行 · 行内详情面板 · 分页

分支 `sp8-ai`,BASE `855cc39`,起点基线 318 文件 / 3063 例全绿。

## 0. 起点核对

`git rev-parse HEAD` = `855cc399d370d91d458a038076acba552233146f`(与派发的 BASE 一致)。

## 1. 改了什么(逐文件)

只改了两个文件,别的一个字节都没碰:

- `src/ai/knowledge/views/IndexedFilesView.vue`(146 → 891 行,+441/-4 行 diff)
- `src/ai/knowledge/views/IndexedFilesView.test.ts`(847 → 1460 行,新增约 61 条本刀用例;
  另订正了 T8 既有的 1 条断言,见 §2)

## 2. 本刀落地 vs T8 遗留的一处必要订正

T8 的骨架屏用例(`IndexedFilesView.test.ts:650-678` 附近)断言「loading 完成后 `.k-ftable`
消失」——这在 T8 落地时是对的(那时 ready 态还没有表格)。T9 在 ready 态补了真实表格后,
`.k-ftable` 在 ready 态也存在(只是内容从骨架行变成真实文件行),原断言字面上变得错误。
已订正为断言「骨架占位行(`.k-frow-skel`,loading 态独有)消失 + `.k-ftable` 本身依然存在」
——这才是那条用例原本想守住的东西(骨架 → 真数据切换),不是新缺陷,是 T8 断言的表述被 T9
的合法新增内容证伪后的必要跟随订正,已在测试文件里加注释说明。

## 3. 范围边界说明(蓝本行区间 → 落地位置)

| 蓝本行区间 | 内容 | 本刀是否落地 |
|---|---|---|
| `:148-165` | 表头行(全选复选框 + 7 列标题) | ✅ `IndexedFilesView.vue:684-702` |
| `:168-259` | 文件行(属性态/徽标/路径/类型/大小/时间/向量数/重建按钮/展开按钮) | ✅ `:705-814` |
| `:261-293` | 行内详情面板 | ✅ `:815-854` |
| `:298-317` | 分页 | ✅ `:858-882` |
| `:320-355`(动作条)、`:356-381`(确认弹窗)、`:391-393`(EXPLICIT_REBUILD_CAP)、`:483-486`/`:544-547`(selectedCount/overExplicitCap)、`:760-770`(rebuildRow **完整业务逻辑**)、`:772-784`(rebuildSelected)、`:786-809`(openRebuildAllConfirm/doRebuildAll)、`:811-823`(`_flashDone`) | 全是 T10 的范围 | ❌ 一个字都没搬——`git grep` 这些标识符(`rebuildSelected`/`overExplicitCap`/`selectedCount`/`showRebuildAllConfirm`/`openRebuildAllConfirm`/`doRebuildAll`/`_flashDone`/`EXPLICIT_REBUILD_CAP`/`k-files-actionbar`)在本文件里只命中文件头注释的"依然不做"清单,零行代码引用 |

**关于 rebuildRow 的一处需要重点说明的边界裁决**(详见下方 §4):按钮 DOM(禁用条件/三种
title/图标切换)在本刀落地,但 `@click` 处理函数体本刀是**文档化占位**(空函数体 + 注释),
不是完整实现——这是本刀唯一一处"声明但函数体留空"的偏离。

**关于多选复选框的边界裁决**:`toggleRow`/`toggleAll`/`selectablePageIds`/`allSelected`/
`someSelected`(含 indeterminate watch)本刀是**完整真实实现**(不是占位),因为它们是自
包含的纯 `Set` 操作,不依赖任何 HTTP 派发或 T10 才有的东西——与 `toggleExpand`(brief 明确
要求 T9 落地)同一类,只是 brief 的"两条实现要点"没有点名它(可能因为它没有 `expTick`/
`doneSet` 那种需要提醒的坑)。`selectedCount`/`overExplicitCap`/`rebuildSelected`/底部动作条/
整库重建确认弹窗(依赖批量重建的 HTTP 派发)才是 T10 的"多选"范围。这条边界判断详见 §4 的
"遗留疑问"部分——**这是本刀在 brief 未明确处自行拍板的一个决策,请协调者复核**。

## 4. 🔴 需要协调者复核的一处边界判断(未申报的自主决策)

brief 顶部把 T9/T10 的整体划分写成:「T9 落:表头行+文件行·行内详情面板·分页」「T10 落:
多选·重建·确认弹窗·底部动作条·30 秒轮询·路由反转」。但本刀范围表(brief §1「表头行+文件行」)
又明确要求落地"重建按钮"(禁用条件+三种 title)和三组属性态(含 `data-selected`,宿主
`.k-frow-f`)——这两处物理上都在 `.k-frow-f` 行内,与"T10 落:多选/重建"字面冲突。

brief 唯一的显式约束是:「🔴 `justDone`/`doneSet` 本刀只读不写——写在 T10。模板里可以读
`data-done`,但不要搬 `_flashDone` 那套」。我据此推导出的判断规则是:

- **`rebuildRow` 的完整实现**(蓝本 `:760-770`)必须调用 `_flashDone`(写 `doneSet`),而
  `doneSet` 写入被明确禁止 → 因此 `rebuildRow` 的函数体本刀留空占位(按钮 DOM 完整,
  仅 `@click` 处理函数体待 T10 填入实现),不能只搬一半(比如去掉 `_flashDone` 调用单独搬
  剩下的部分)——那样等于我自己决定砍掉蓝本方法体的一部分,属于未申报的行为改动。
- **`toggleRow`/`toggleAll` 没有这个障碍**(它们是纯 `Set` 读写,不涉及 HTTP、不涉及
  `doneSet`),所以按 `toggleExpand` 同等标准落地为完整实现,不留占位。

这个判断没有在 brief 里被逐字确认过,是我基于"两条实现要点"仅提到的这一条限制反推出来的
边界裁决。**如果协调者认为这个边界划得不对**(比如认为 `toggleRow`/`toggleAll` 也该留给
T10,或者认为 `rebuildRow` 应该实现到"只差 `_flashDone`"那一步而不是整体留空),这是本刀
最主要的一个可复核点,报告状态定为 `DONE_WITH_CONCERNS` 正是因为这条。

## 5. 三条点名要求逐条回执

### 5.1 N14 —— `statusBadgeMap.en` 一物两用,两个字段都留

`IndexedFilesView.vue:260-271`(`statusBadgeMap` 声明 + `badgeFor()`):

```ts
const statusBadgeMap: Record<string, StatusBadgeEntry> = {
  ok:         { en: 'Indexed',  key: 'aiKbStatusIndexed',  icon: 'check',   cls: 'ok' },
  indexing:   { en: 'Indexing', key: 'aiKbStatusIndexing', icon: 'spinner', cls: 'indexing' },
  error:      { en: 'Error',    key: 'aiKbStatusError',    icon: 'x',       cls: 'error' },
  tombstoned: { en: 'Removed',  key: 'aiKbStatusRemoved',  icon: 'tomb',    cls: 'tombstoned' },
}
```

模板 `:730`(`:title="... ? badgeFor(file.status)!.en : file.status"`)只读 `en`(英文原串);
`:737`(`{{ ... ? t(badgeFor(file.status)!.key) : file.status }}`)只读 `key`(i18n 键,渲染
中文)。两个字段没有合并。

**四个状态的 title 断言位置**(均在 `describe('… N14: statusBadgeMap 四态…')`,
`IndexedFilesView.test.ts:989-1049`):

| 状态 | title 断言(英文原串) | 反向断言 |
|---|---|---|
| ok | `toBe('Indexed')`(:996) | `not.toBe('已收录')`(:998)、`not.toBe('aiKbStatusIndexed')`(:999) |
| indexing | `toBe('Indexing')`(:1008) | `not.toBe('aiKbStatusIndexing')`(:1011,**K20 特例**:title 与徽标文字巧合都是英文 "Indexing",反向断言改成只排键名,详见用例内注释) |
| error | `toBe('Error')`(:1020) | `not.toBe('错误')`(:1021)、`not.toBe('aiKbStatusError')`(:1022) |
| tombstoned | `toBe('Removed')`(:1031) | `not.toBe('已删除')`(:1032)、`not.toBe('aiKbStatusRemoved')`(:1033) |

同一批用例里每条还各断言了 `data-s`、`KIcon` 的 `name` prop、`.k-status-badge-cn` 的中文文案
三项,外加兜底分支(`statusBadgeMap` 查不到时 `data-s` 回落 `'ok'`、title/文字回落
`file.status` 原串)一条专门用例(`:1042-1048`)、以及 N13 的专门用例(`:1036-1039`)。

**RED 探针④**(把 `:title` 改成读 i18n 键,即"合并字段"):把 `:730` 改成
`:title="... ? t(badgeFor(file.status)!.key) : file.status"`,三条(ok/error/tombstoned)
title 断言精确报红(indexing 那条因 K20 巧合仍绿,反向断言那条也仍绿——这正是 brief 要求
的"至少一条反向断言排除键名"存在的意义,原始报红文本见 §11)。

### 5.2 N13 —— `.k-status-badge-cn` 是蓝本自身未定义类,照抄不进白名单

`IndexedFilesView.vue:736`(`<span class="k-status-badge-cn">`)——类名照抄蓝本 `:197`。
`git grep k-status-badge-cn` 在 `sp8-ai` 分支全仓只命中这一行模板,`knowledge.scss` 里没有
对应规则,渲染成无样式 span,与 Vue2 观感一致。**没有加进 `knowledgeStyles.test.ts` 的
`WHITELIST_187`**(该文件本刀完全未改动,数组仍是 187 项,已用
`grep -n "WHITELIST_187\|k-status-badge-cn" src/ai/styles/knowledgeStyles.test.ts` 确认
后者零命中)。测试侧对应用例:`IndexedFilesView.test.ts:1036-1039`。

### 5.3 tomb glyph 只经 `statusBadgeMap.icon` 动态取到

`IndexedFilesView.vue` 全文 `git grep 'name="tomb"'` 零命中(字面量),`tomb` 只经
`badgeFor(file.status)!.icon`(值为 `statusBadgeMap.tombstoned.icon === 'tomb'`)动态传给
`<KIcon :name="...">`(`:733`)。治理 §1.2 已核实该 glyph 在 `KIcon.vue` 的 `PATHS` 里存在,
本刀没有改 `KIcon.vue`(零改动清单文件,一个字都没碰)。测试侧
`IndexedFilesView.test.ts:1029`(`badge.findComponent(KIcon).props('name')).toBe('tomb')`)
直接断言了这个动态取值。

## 6. `simplifyMime` 5 个 `data-kind` 用例位置

`describe('IndexedFilesView — 类型标签…')`(`IndexedFilesView.test.ts:1098-1153`):

| data-kind | 用例 | mime |
|---|---|---|
| doc(非 legacy) | `:1101-1109` | wordprocessing → DOCX |
| doc(legacy=true) | `:1111-1118` | application/legacy-office/msword → DOC + 「旧版」角标 |
| pdf | `:1120-1125` | application/pdf → PDF |
| txt | `:1127-1132` | text/plain → TXT |
| code(legacy=true) | `:1134-1140` | application/vnd.ms-powerpoint → PPT + 「旧版」角标 |
| md | `:1142-1147` | text/markdown → MD |

外加 `type tag 的 title = file.mime 原文` 一条(`:1149-1152`)。Legacy 角标两侧对照:doc/code
两种 legacy=true 用例断言角标存在且文字「旧版」,doc 非 legacy 那条(`:1109`)显式断言角标
不存在;其余 pdf/txt/md 三种按 `simplifyMime` 定义只有 legacy-office/ms-powerpoint/
presentation 三条分支带 `legacy: true`,其余分支返回值本来就没有这个字段,故不需要逐条重复
断言"不存在"——这条与 T7 util 测试的覆盖范围重叠,本刀只做接线验证。

## 7. 分页四个计算的边界覆盖表

`describe('IndexedFilesView — 分页边界…')`(`IndexedFilesView.test.ts:1305-1388`):

| 边界 | 用例 | pageFrom | pageTo | pageCount | 断言方式 |
|---|---|---|---|---|---|
| total=0 | `:1306-1313` | 0 | 0 | 1(Math.max(1,…)兜底) | pager 不渲染(pageState=empty),直接读 `w.vm` 内部 computed(state 存在但 UI 入口不可达,T8 established 技巧) |
| total 恰好整除(16/8,第2/末页) | `:1315-1326` | 9 | 16 | 2 | 通过渲染的 `.k-pager-info`/`.k-pager-page` 文案 + 上下页禁用态 |
| 末页(不整除,17/8,第3页只1条) | `:1328-1338` | 17 | 17(钳到 total,不越界到 24) | 3 | 同上 |
| 首页 | `:1340-1350` | — | — | — | 上一页禁用、下一页启用(两侧对照) |

另有「点击上一步/下一步推进 offset 并重载」(`:1352-1369`)与「每页条数下拉 4 档 + 切换语义」
(`:1371-1387`,含 onPageSizeChange **不清 errorBanner** 这条与 `_applyFilter` 的差异对照)。

**RED 探针②**(`pageTo` 的 `Math.min` 去掉):恰好整除用例的 `pageTo` 断言(通过
`.k-pager-info` 文案)与末页用例的文案断言精确报红(`显示 17–24 / 17` vs 期望
`显示 17–17 / 17`),`total=0` 用例的 `vm.pageTo` 直接断言也精确报红(原始报红文本见 §11)。

## 8. `errhint`/`zerohint` 覆盖(含 zerohint 为何必须构造数据)

`describe('IndexedFilesView — 路径单元格:errhint / zerohint')`(`IndexedFilesView.test.ts:1054-1093`)。

- **errhint**(`status==='error' && last_error`):正面用例(`:1061-1067`)用 `FILE_ERROR`
  (人工构造,治理 §4.5 已实测登记真机 8 个文件里没有 error 行),反面用例(`:1069-1072`)
  用真实 `FILE_OK`(status=ok,不渲染)。
- **zerohint**(`status==='ok' && vector_count===0`):🔴 **必须构造数据**——治理 §4.5 明确
  记录真机唯一一行 `vector_count===0` 的行,其 `status` 是 `indexing` 不是 `ok`,本机没有
  同时满足两个条件的行。用 `FILE_ZEROHINT`(人工构造,status='ok' + vector_count=0)覆盖
  正面(`:1074-1080`);两条反面用例分别用 `FILE_INDEXING`(真实 fixture 行,`:1082-1087`,
  vector_count=0 但 status=indexing,证明"只判 vector_count 不够")与 `FILE_OK`(`:1089-1091`,
  status=ok 但 vector_count=856,证明"只判 status 不够"),两个条件都被钉住。

## 9. 属性态覆盖表(对照附录 §D.3,本刀范围内的宿主)

| 宿主 | 属性 | 覆盖(两侧字符串值) | 用例位置 |
|---|---|---|---|
| `.k-frow-f` | `data-selected` | `'false'`→ 勾选 →`'true'`→ 取消 →`'false'` | `:1394-1404` |
| `.k-frow-f` | `data-status` | `ok`/`indexing`/`error`/`tombstoned` 四值直接透传 | `:1443-1451` |
| `.k-frow-f` | `data-done` | `'false'` 基线(真实);`'true'` 侧靠直接改内部 `doneSet` ref(doneSet 本刀只读不写,状态存在但写入口留 T10,同 T8 established 技巧) | `:1434-1441` |
| `.k-status-badge` | `data-s` | 四态全覆盖(见 §5.1 表) | `:989-1049` |
| `.k-type-tag` | `data-kind` | 5 值全覆盖(见 §6) | `:1098-1153` |
| `.k-frow-vec` | `data-zero` | `'true'`(vector_count=0)/`'false'`(非零) | `:1179-1189` |
| `.k-frow-expand` | `data-open` | `'false'` 基线 → 点击 →`'true'`→ 再点 →`'false'` | `:1233-1251` |

全部直接比 `attributes('data-x')` 的字符串值,没有用 `toBeUndefined()`。

## 10. mock 形状逐个说明(取自哪个 fixture)

沿用 T8 已建的 `ai.parserFiles` mock(`vi.hoisted` 骨架,零改动)。本刀新增的 mock 数据:

| 变量 | 来源 |
|---|---|
| `FILE_OK` | `FILES_ALL_8[1]`(= `p5b-fixtures/files-all-8.json` 第 2 个文件,真实 status='ok',非新造) |
| `FILE_INDEXING` | `FILES_ALL_8[0]`(同上第 1 个文件,真实 status='indexing', vector_count=0,zerohint 反例的钉子) |
| `FILE_ERROR` | 人工构造(治理 §4.5:真机 8 个文件 error=0 个,必须构造),字段形状与 fixture file 行 schema 完全一致 |
| `FILE_TOMBSTONED` | 人工构造(同上,真机 tombstoned=0 个) |
| `FILE_ZEROHINT` | 人工构造(同上,§8 已详述为什么必须构造) |
| `FILE_UNKNOWN_STATUS` | 人工构造,用于覆盖 N14 兜底分支(蓝本 :190/:194),status 故意给一个 statusBadgeMap 里没有的字符串 |

`service.ai.parserFiles` 用的是原样 snake_case(与 T8 一致,`NimoOS-Service/src/ai.ts:591-640`
零转换的既有结论),本刀没有涉及 `service.notes.*`,不存在 camelCase/snake_case 混淆风险。

## 11. RED 探针的原始报红文本(共 5 次,均已改回 + `git status --short` 确认干净)

**探针①(statusBadgeMap 图标名 check→x)**:
```
AssertionError: expected 'x' to be 'check'
❯ IndexedFilesView.test.ts:994:54
  expect(badge.findComponent(KIcon).props('name')).toBe('check')
```

**探针②(pageTo 去掉 Math.min)**:
```
AssertionError: expected 100 to be +0   (total=0 用例, vm.pageTo)
AssertionError: expected '显示 17–24 / 17' to be '显示 17–17 / 17'   (末页用例)
```

**探针③(删掉 data-zero)**:
```
AssertionError: expected undefined to be 'true'   (vector_count=0 用例)
AssertionError: expected undefined to be 'false'  (vector_count!=0 用例)
```

**探针④(N14::title 改成读 i18n 键)**:
```
AssertionError: expected '已收录' to be 'Indexed'   (ok)
AssertionError: expected '错误' to be 'Error'        (error)
AssertionError: expected '已删除' to be 'Removed'    (tombstoned)
```
(indexing 那条巧合仍绿,反向断言那条也仍绿——见 §5.1 说明,这正是 brief 要求反向断言的原因)

**探针⑤(zerohint 判据弱化为只判 vector_count===0)**:
```
AssertionError: expected true to be false
❯ IndexedFilesView.test.ts:1086:49
  zerohint 反面:vector_count===0 但 status=indexing(FILE_INDEXING 真实数据)→ 不渲染
```

每次探针后都执行了 `git diff` 确认改动范围精确对应探针描述,改回后 `git status --short`
只显示两个正式改动文件(无残留)。

## 12. 三门实测数字

```
pnpm test                    Test Files  318 passed (318) / Tests  3113 passed (3113)   exit=0
pnpm exec vue-tsc --noEmit   exit=0(零输出,零错误)
pnpm build                   exit=0(仅既有第三方包 + >500KB chunk 警告,无新增警告)
```

基线 318 文件 / 3063 例 → 本刀 318 文件 / 3113 例,**+0 文件 / +50 例**(brief 预期约 +35,
实测 +50,差 15 例。原因:除了 brief 列出的必测项外,本刀额外补了 —— 表头列标题集合式断言、
全选复选框禁用条件、type tag title 接线、简化的时间/大小接线验证、last_error 条两侧对照、
modalities_done 空/非空两侧对照、首页/末页按钮禁用两侧对照、每页条数下拉切换的完整语义,
以及 T8 遗留断言的 1 条订正——这些都属于 DoD 要求的"两侧对照"与"属性态两侧覆盖"纪律的
自然展开,不是凑数)。

## 13. 遗留疑问 + 给 T10 的交接项

**遗留疑问(见 §4 的完整论证,这是本报告状态定为 DONE_WITH_CONCERNS 的核心原因)**:
brief 对"多选复选框的 read+write 该不该在 T9 落地"没有逐字确认,本刀做出的裁决是"toggleRow/
toggleAll 落地为完整实现,rebuildRow 的函数体留空占位",请协调者复核这个边界划分是否符合
预期。如果协调者认为应该反过来(多选也该留空、或 rebuildRow 该实现到只差 `_flashDone`),
需要一次小范围返工。

**给 T10 的交接项**:

1. `rebuildRow(_fileId: string)`(`IndexedFilesView.vue` 里 `toggleExpand` 后面那个函数,
   `:470-473`)函数体是空的,按钮 DOM 已完整(禁用条件/三种 title/图标切换),T10 直接把
   蓝本 `:760-770` 的业务逻辑(`store.reindexIndexedByIds` 派发 + toast + `startIndexedPolling` +
   `_flashDone`)填进函数体即可,**不要改按钮 DOM、不要改调用点**(`@click="rebuildRow(file.file_id)"`
   已经接好)。
2. `doneSet` 这个 ref 已经声明(`IndexedFilesView.vue`,K13 同款写法),T10 的 `_flashDone`
   直接读写它(整体替换 Set,同 `selSet`/`expSet` 的模具),不需要重新声明。
3. `selectablePageIds`/`allSelected`/`someSelected`/`toggleRow`/`toggleAll` 已经是完整
   实现,T10 的 `selectedCount`/`overExplicitCap` 等计算可以直接在这些之上继续写(比如
   `selectedCount = computed(() => selSet.value.size)`),不需要重新声明 selSet 相关的
   任何东西。
4. 分页四个计算(`currentPage`/`pageCount`/`pageFrom`/`pageTo`)与 `prevPage`/`nextPage`/
   `onPageSizeChange` 已完整,T10 不涉及分页,不需要改动这部分。
5. `.k-pager button.k-btn` 与 `.k-frow-f:not(.k-frow-fhead)` 这两个 CSS 选择器约定(用于
   区分分页按钮与文件行 vs 表头行)在测试文件里已经建立,T10 如果要新增底部动作条按钮,
   注意别用会与这些选择器冲突的 class 组合。
6. 测试文件里 `mountWithFiles(fileArr, total?)` 这个 helper(`IndexedFilesView.test.ts:946-949`)
   T10 可以直接复用,不需要重新造。`FILE_OK`/`FILE_INDEXING`/`FILE_ERROR`/`FILE_TOMBSTONED`/
   `FILE_ZEROHINT`/`FILE_UNKNOWN_STATUS` 这几个 mock 数据 T10 如果需要覆盖多选/重建场景
   也可以直接复用(比如 `rebuildSelected` 需要多个可选行,`FILE_OK`+`FILE_ERROR` 组合已经
   现成)。

**已知噪声**:本次全量测试没有遇到治理文件登记的两处已知噪声(`persist.test.ts` IndexedDB
flaky / `AgentComposer.test.ts` teardown 竞态),三门全绿,无需复跑。
