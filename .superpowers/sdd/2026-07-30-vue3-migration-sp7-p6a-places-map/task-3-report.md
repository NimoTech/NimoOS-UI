# Task 3 report:`photosPlaces` Pinia store

## 实现了什么(7 条约束逐条对应代码位置)

全部实现于 `src/photos/stores/places.ts`(新建),测试在
`src/photos/stores/__tests__/places.test.ts`(新建,40 条用例)。

1. **`fetchPlaces` 解包裹体 + `?? []` 兜底 + 成功才置位**:`places.ts:158-176`。
   `?? []`/`?? {cities:0,...}` 兜底在 :163/:165/:166;`placesLoaded.value = true`
   只在 try 块末尾(:167),catch 只 `console.error`(:172)、不清空 `places`
   (偏离登记 9)。**未实现** Vue2 `:412-413` 的自动选中 `places[0]`(留给 T11),
   有专门测试 `fetchPlaces > 不自动选中第一个地点`(:139-144)钉住。
2. **`loadDetail` seq 竞态守卫**:`places.ts:181-201`。`id == null` 直接
   `seq++` + `detail = null`(:182-186,`seq++` 是加性防御,详见"自查发现");
   成功路径 :192 比对,catch 路径 :195 比对——两处独立、分别用删码验证钉住(见下)。
   `detailLoading` 复位只在 `mine === seq` 时执行(:199)。key 解析用共享的
   `resolvePlaceKey`(:150-153):按 `String(p.id) === String(id)` 从 `places`
   里反查后端原始 `key`(int32),找不到(深链)回落用传入的 `id` 本身。
3. **三个提交路径独立 in-flight 守卫 + rethrow**:`setPlaceCover`(:210-225)、
   `resetPlaceCover`(:228-243)共享 `coverBusy`(同一份"封面"资源的互斥写,
   见下方"自查发现"里对"三个"这个数字的解读),`setSpotName`(:249-267)
   用独立的 `spotBusy`。三者的 catch 都 `console.error` 后 `throw e`(:220-221,
   :238-239,:262-263),`finally` 里统一复位对应 busy 标志。`setPlaceCover`/
   `resetPlaceCover` 成功后乐观回写 `detail.coverAssetId` 与 `places` 里命中项的
   `coverAssetId`(:216-218,:234-236);`setSpotName` 成功后只改
   `detail.spots` 里 `key === spotKey` 那一项的 `name`,不重拉(:255-260)。
4. **`fetchCoverCandidates` 失败清空**:`places.ts:274-286`。失败分支
   (:283-284)置成 `{ tabs: [], items: [], page: 0, totalPages: 1, total: 0 }`,
   代码注释(:269-273)专门写明与 `fetchPlaces`"失败保留"口径不同的理由
   (弹层一次性查询 vs 主数据)。
5. **两份 localStorage 持久化**:key 用 `nimo_places_map_theme` /
   `nimo_places_rail_collapsed`(:21-22),偏离登记注释在 :17-20。
   `readThemePrefs`(:64-78)白名单校验 `mapTheme`(:71)、正则校验两个自定义色
   (:72-73,`HEX_RE = /^#[0-9a-f]{6}$/i`,:25)、整体 try 兜底坏 JSON(:66/:75-77)。
   `readRailCollapsed`(:83-92)校验数组类型 + `.map(String)` 归一(:88,偏离登记 7)。
6. **`isRegionCollapsed` 搜索态压过折叠**:`places.ts:315-318`,`searchActive`
   为真直接返回 `false`,不查 `railCollapsed`。
7. **`__resetForTest` 清全部 state**:`places.ts:320-337`。**未重置 `seq`**——
   这是对 brief 字面要求("重置 seq")的一处刻意偏离,原因见下方"自查发现",
   已用专门的回归测试(`__resetForTest 不引入 seq 别名冲突`)钉住,而不是静默改写 brief。

## 回源核对结果

**Vue2 行号与数值核对**(全部逐行读过 `/home/nimo/NimoTech/NimoOS-UI/src/views/Photos/PhotosPlacesView.vue`):

| brief 引用 | 核对结果 |
|---|---|
| `:400-433`(loadPlaces/loadDetail) | 实际 `loadPlaces` 是 :400-418,`loadDetail` 是 :419-433 —— 两段相邻拼在一起,brief 的合并范围准确,无出入。 |
| `:495-560`(spot 改名/封面四方法) | 实际 `saveSpotName` :495-516,`toggleCoverPicker`/`loadCoverCandidates` :517-536,`setCover` :537-548,`resetCover` :549-560。合并范围准确。 |
| `:339-357`(两份 localStorage 读) | 逐字核对一致,无出入。 |
| `:379-385`(persistTheme 写) | 逐字核对一致。 |
| `:386-389`(isRegionCollapsed) | 逐字核对一致:`!this.search.trim() && this.collapsedRegions.includes(rId)`。 |
| `:86-87`(customDotColor/customGridColor 默认值) | 核对一致:`#6E5BFF` / `#9C8EFF`。 |
| 模板 `:940`/`:944`(自定义色触发 `mapTheme='custom'`) | brief 未直接引用此行号,但"setCustomColors 应同时置 `mapTheme='custom'`"这条隐含要求(体现在 Step1 给出的测试断言里)靠读模板 `@input="mapTheme = 'custom'"` 才确认下来,已在代码注释里补记引用(:295)。 |

本任务未发现 brief 行号/数值有出入(与 Task1/Task2 的"101→87 行"、"删码预测写错"这类需要纠正的情况不同)。

**共享包方法签名核实**(`/home/nimo/NimoTech/.sp7/NimoOS-Service/src/photos.ts:253-292`,只读):
`listPlaces()`、`getPlace(key: string)`、`placeCoverCandidates(key: string, {tab,q,page})`、
`setPlaceCover(key: string, assetId: string|number)`、`resetPlaceCover(key: string)`、
`setSpotName(key: string, spotKey: string, name: string)` 均已核实存在,签名与 brief 描述一致。

**类型层面的意外发现**:这 5 个 `key` 参数在共享包里全部声明为 `key: string`(不是
`string | number`,与同文件里 `getPerson(id: string | number)` 不一致)。但 brief 的
测试用例明确要求 `getPlace` 被调用时传**原始数字** `key`(`toHaveBeenCalledWith(7)`,
非字符串 `'7'`)。这两条要求字面冲突:若真传数字给一个类型声明为 `string` 的参数,
`vue-tsc --noEmit` 会报类型错误。处理方式:`resolvePlaceKey` 返回 `string | number`,
调用点用 `as string` 做类型断言(而非 `String(key)` 做运行时转换)——断言只影响编译期
检查,运行时仍然把原始 `number` 传给 mock/后端,同时满足了"编译通过"与"运行时传数字"
两条要求。已在 `places.ts:189` 处以最小侵入方式处理(未改动共享包,遵守"Service 侧零
改动"约束)。

## 测了什么与结果

`src/photos/stores/__tests__/places.test.ts`,10 个 describe 块,**40 条用例全绿**:
`fetchPlaces`(6)、`loadDetail seq 竞态守卫`(8)、`clearDetail`(2)、`封面与 spot 改名`
(13)、`fetchCoverCandidates`(2)、`localStorage 持久化`(9)、`__resetForTest`(2)。
除 brief Step1 给出的高危用例(逐字采用,未改动断言)外,补充的常规覆盖包括:
regions/stats 缺字段兜底、`loading`/`detailLoading` 请求期间状态、`clearDetail` 的
seq 作废语义、`resetPlaceCover`/`setSpotName` 各自的重入短路与失败 rethrow、
`coverBusy`/`spotBusy` 互不阻塞的独立性回归、`detail` 为 null 时封面提交只回写
`places` 不炸、`fetchCoverCandidates` 成功路径字段归一、`__resetForTest` 清空后
重新读一次 localStorage(而非清零)、以及 `__resetForTest` 的 seq 别名冲突回归。

## TDD 证据

Step2(RED,先临时移走 `places.ts` 让文件不存在,验证失败信息与 brief 预期一致):
```
$ mv src/photos/stores/places.ts <scratch>/places.ts.bak
$ pnpm exec vitest run src/photos/stores/__tests__/places.test.ts
FAIL  src/photos/stores/__tests__/places.test.ts
Error: Failed to resolve import "../places" from ".../places.test.ts". Does the file exist?
Test Files  1 failed (1)
```
与 brief Step2 的 Expected 完全一致。restore 后写实现。

Step4(GREEN):
```
$ pnpm exec vitest run src/photos/stores/__tests__/places.test.ts
Test Files  1 passed (1)
Tests  40 passed (40)
```

## 8 处删码验证逐条结果

方法:每次只改一处(`cp` 备份原文件 → `Edit` 改动 → 跑该测试文件 → 记录变红的用例名
→ `cp` 还原 → 确认恢复 40/40),不同处之间互不重叠。

| # | 删的是什么 | 变红的用例 | 结果 |
|---|---|---|---|
| 1 | `loadDetail` 成功路径的 `if (mine !== seq) return` | `后发先回时,先发的旧响应不得覆盖新详情`(brief 指定)、外加连带变红 `作废在途的 loadDetail:clearDetail…`、`__resetForTest 不引入 seq 别名冲突…`(这两条是我方补充测试,共用同一段成功路径逻辑) | 符合预期 |
| 2 | `loadDetail` catch 里的 seq 比对 | `过期请求的 catch 也不得把新详情打成 null`(brief 指定,唯一变红) | 符合预期,与 #1 分开验证,互不遮蔽 |
| 3 | `coverBusy` 短路(`if (coverBusy.value) return`) | `三个提交路径各自 in-flight 短路:重入时第二次调用不打后端`(brief 指定,唯一变红) | 符合预期 |
| 4 | `setPlaceCover` catch 吞错(去掉 `throw e`) | `失败一律 rethrow(视图层负责 toast):setPlaceCover`(brief 指定,唯一变红) | 符合预期 |
| 5 | `railCollapsed` 读入的 `.map(String)` | `railCollapsed 读入时 map(String) 归一(偏离登记 7)`(brief 指定,唯一变红) | 符合预期 |
| 6 | `isRegionCollapsed` 搜索态分支 | `isRegionCollapsed:搜索态压过折叠(匹配项绝不被藏)`(brief 指定,唯一变红) | 符合预期 |
| 7 | `fetchPlaces` catch 改成清空 `places` | `失败时保留上一次数据、placesLoaded 不倒退、不抛`(brief 指定,唯一变红) | 符合预期 |
| 8 | `placesLoaded = true` 挪到 `finally` | `首次就失败时 placesLoaded 留 false(可重试)`(brief 指定,唯一变红) | 符合预期 |

8 处全部按 brief 预期精确命中,没有出现"变异未让预期测试变红"需要重新设计测试的情况。
每处验证后都已还原并重新确认 40/40 通过(mutation 1 后单独重跑过一次全绿确认无残留)。

## 改动的文件

- 新增 `src/photos/stores/places.ts`
- 新增 `src/photos/stores/__tests__/places.test.ts`

无其他文件改动;`git status --short` 确认只有这两个新文件。

## 自查发现

1. **"三个提交路径各自独立"的解读**:brief 给出的变量名只有 `coverBusy` / `spotBusy`
   两个,但原文写"三个提交路径各自独立 in-flight 守卫"。做出的判断:`setPlaceCover`
   与 `resetPlaceCover` 是对"当前地点封面"这同一份资源的互斥写操作,共享 `coverBusy`
   是合理收紧,不是遗漏;`spotBusy` 与 `coverBusy` 完全独立,互不阻塞才是"各自独立"
   的核心要求。已用专门测试验证三件事:(a) `setPlaceCover` 重入短路;(b)
   `resetPlaceCover` 重入短路(证明确实共享同一把锁,不是各自还有第三把锁);(c)
   `setPlaceCover` 在途时 `setSpotName` 仍能正常发出请求(证明两把锁互不阻塞)。
   若这个解读与预期不符(比如实际想要 3 把完全独立的锁,`resetPlaceCover` 也应该有
   自己独立于 `setPlaceCover` 的锁),请指出,改动量很小。
2. **`__resetForTest` 没有重置 `seq`**:brief 原文写"清全部 state + 重置 seq"。实测
   发现按字面重置 `seq = 0` 会引入一个真实的竞态 bug:若 `__resetForTest` 调用时还有
   一个更早发出的 `loadDetail` 请求仍在途(mine 值基于重置前的 seq),重置后的下一次
   `loadDetail` 调用会从 0 重新计数,可能与那个未完成的旧请求撞上同一个 `mine` 值,
   导致 `mine !== seq` 的判断被绕过,旧响应错误地覆盖新数据。所以改为**不重置 seq**
   (只增不减,天然保证新请求的 mine 严格大于所有历史请求),并写了专门的回归测试
   (`__resetForTest 不引入 seq 别名冲突…`)证明这个决策是必要的——测试用"字面重置为 0"
   的实现跑过一遍,确认会导致该用例失败,才确定保留当前写法。这是本任务里唯一一处
   没有照 brief 字面实现的地方,原因是照做会引入真实缺陷。
3. `toPlaceDetail` 的字段映射(id/city/country/... 的兜底值)是我根据
   `NimoOS-Photos/service/places_types.go:73-82` 的 `PlaceDetail` Go 结构体
   (`Place` 内嵌 + `Spots`/`Insights`/`Visits`/`Recent`)反推的,brief 没有给出这部分
   的逐字段实现指引,只给了 TS 接口形状,已按同一套"数组类兜底 `[]`、字符串兜底 `''`、
   布尔用 `Boolean()`"的风格与 `toPlace`/`toPerson` 保持一致。

## 顾虑

- 上述"自查发现 1"(coverBusy 共享 vs 三把独立锁)是本任务里唯一一个需要工程判断、
  且没有测试直接钉死"该不该共享"的地方——如果 P6b 消费时发现需要 `resetPlaceCover`
  与 `setPlaceCover` 互不阻塞,拆成独立的 `coverSetBusy`/`coverResetBusy` 是局部改动,
  不影响其余部分。
- 其余无未解决的顾虑;全量测试(272 文件/2316 用例)与 `vue-tsc --noEmit` 均通过,
  未弄红既有用例(新增 1 个测试文件、40 条用例,较基线 271 文件/2276 用例的增量吻合)。

---

# Fix round(评审 I1/I2/Minor)

评审结论:Spec ❌ / Needs fixes,2 条 Important + 1 条 Minor。两点申报结论已获采纳
(`__resetForTest` 不重置 `seq` 成立;`coverBusy` 共享的语义判断成立但缺测试)。以下是
针对 I1/I2/Minor 的修复记录。

## 改了什么

**I1(真 bug,`detailLoading` 永久卡 true)**:`src/photos/stores/places.ts`

- `loadDetail(id === null)` 分支(:181-189):补一行无条件 `detailLoading.value = false`。
- `clearDetail()`(:206-212):同样补一行无条件 `detailLoading.value = false`。
- 根因:两处中断分支只 `seq++` + 清 `detail`,从不碰 `detailLoading`;而在途请求的
  `finally` 里是 `if (mine === seq) detailLoading.value = false` —— `seq` 已被中断分支
  推进,`mine` 必然不等于新 `seq`,这行判断恒假,永远没有人把 `detailLoading` 拨回来。

**I2(覆盖缺口,`coverBusy` 共享未被测试钉住)**:`src/photos/stores/__tests__/places.test.ts`

- 把标题名不副实的 `resetPlaceCover 重入短路(与 setPlaceCover 共享 coverBusy)`
  改成准确的 `resetPlaceCover 自重入短路`(它测的确实只是自重入)。
- 新增两条双向用例(`I2:setPlaceCover 在途时 resetPlaceCover 被 coverBusy 挡下…` /
  `I2:resetPlaceCover 在途时 setPlaceCover 被 coverBusy 挡下…(反向)`),分别断言对方
  的 `*Api` mock 未被调用,证明两者确实共享同一把锁而非各自独立。

**Minor(`resolvePlaceKey(id) as string` 断言无注释)**:`src/photos/stores/places.ts:154-161`

- 在 `resolvePlaceKey` 定义正下方补注释,写明 5 处调用点的 `as string` 是故意保留
  运行时 `number`(满足共享包 `key: string` 签名的编译期检查,同时不破坏"传后端原始
  数字 key"的测试要求),并明确警告不要"清理"成 `String(resolvePlaceKey(id))`
  ——那会在运行时真的转成字符串,悄悄把 `toHaveBeenCalledWith(7)` 那类断言改红。

## 跑了哪些覆盖测试

```
$ pnpm exec vitest run src/photos/stores/__tests__/places.test.ts
Test Files  1 passed (1)
Tests  44 passed (44)          # 40(上一轮)+ 4 新增(I1×2 + I2×2)

$ pnpm exec vitest run
Test Files  272 passed (272)
Tests  2320 passed (2320)      # 2316(上一轮全量)+ 4

$ pnpm exec vue-tsc --noEmit
(无输出,类型检查通过)
```

## 删码验证(三组,逐个做,做完立即验完还原,互不重叠)

方法与上一轮一致:`cp` 备份修复后的干净文件 → `Edit` 改动一处 → 跑
`src/photos/stores/__tests__/places.test.ts` → 记录变红的用例名 → `cp` 还原 → 确认
恢复 44/44。

| # | 删的是什么 | 变红的用例 | 结果 |
|---|---|---|---|
| A | `loadDetail(id === null)` 分支里新加的 `detailLoading.value = false` | `I1:loadDetail 在途时调 loadDetail(null),detailLoading 必须立即复位,且不被过期响应带歪`(唯一变红) | 符合预期 |
| B | `clearDetail()` 里新加的 `detailLoading.value = false` | `I1:loadDetail 在途时调 clearDetail(),detailLoading 必须立即复位,且不被过期响应带歪`(唯一变红) | 符合预期,与 A 分开验证,互不遮蔽——验证了评审要求的"两个中断入口分别测、分别删" |
| C | 把 `coverBusy` 拆成 `coverSetBusy` / `coverResetBusy` 两个独立 `ref`(`setPlaceCover`/`resetPlaceCover`/`__resetForTest` 三处联动改名,`spotBusy` 不动) | `I2:setPlaceCover 在途时 resetPlaceCover 被 coverBusy 挡下,不打后端`、`I2:resetPlaceCover 在途时 setPlaceCover 被 coverBusy 挡下,不打后端(反向)`(两条同时变红,其余 42 条仍绿——包括两条自重入用例,证明"拆锁"不会破坏自重入语义,只破坏"共享"语义) | 符合预期 |

三组全部按预期精确命中,验完都已还原并重新跑过 `places.test.ts` 确认 44/44 全绿
(其中 A 之后单独确认过一次、B 之后单独确认过一次、C 之后单独确认过一次)。

## 结果

- `src/photos/stores/__tests__/places.test.ts`:44/44 通过。
- 全量 `pnpm exec vitest run`:272 文件 / 2320 测试全绿,未弄红任何既有用例。
- `pnpm exec vue-tsc --noEmit`:无输出,类型检查通过。

## 改动的文件(本轮)

- `src/photos/stores/places.ts`(I1 两处修复 + Minor 注释)
- `src/photos/stores/__tests__/places.test.ts`(I1 两条新用例 + I2 两条新用例 + 1 处标题订正)
