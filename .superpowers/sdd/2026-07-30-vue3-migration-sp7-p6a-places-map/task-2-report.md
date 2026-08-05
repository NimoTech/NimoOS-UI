# Task 2 报告:placesMap.ts —— 图钉几何 / 过滤谓词 / 日期解析 + worldMap 补测

## 实现范围

- 新建 `src/photos/util/placesMap.ts`(348 行):导出 brief 要求的全部 13 条 + 类型/接口,签名与 brief 逐字一致。
- 新建 `src/photos/util/__tests__/placesMap.test.ts`(33 例)。
- 追加 `src/photos/util/__tests__/worldMap.test.ts`(只追加,原 5 例未动,新增 3 例)。

## 13 条实现约束逐条对应

| # | 约束 | 代码位置 |
|---|---|---|
| 1 | `MAX_SCALE = 16` | `placesMap.ts:34`,测试 `MAX_SCALE` describe 块 |
| 2 | `tierRadius` 三档 40/100 | `placesMap.ts:114-120`,附耦合注释 |
| 3 | `declutterPins` 8 轮/hypot/黄金角/原地修改 | `placesMap.ts:126-160` |
| 4 | `splitScaleFor` 22 步二分 + ×1.04 | `placesMap.ts:167-183` |
| 5 | `buildPins` atMax 分裂/declutter/hitR/active 归一 | `placesMap.ts:186-233` |
| 6 | `visitedDots` 3.5° 全扫 | `placesMap.ts:237-242` |
| 7 | `parsePlaceLast` Go 布局 + 回读校验 | `placesMap.ts:92-108`(照抄 brief 给的实现) |
| 8 | `filterPlaces` 顺序 + year/custom 用 lastDate | `placesMap.ts:246-272` |
| 9 | `searchPlaces` | `placesMap.ts:275-280` |
| 10 | `groupByRegion` 桶内降序 | `placesMap.ts:283-290` |
| 11 | `regionLabelKey` 六键 + 未知返回 null | `placesMap.ts:292-304` |
| 12 | `extraFilterCount` | `placesMap.ts:317-326` |
| 13 | `toPlace` | `placesMap.ts:328-347` |

## 回源核对结果(brief 的 Vue2 行号与数值)

逐条核对 `NimoOS-UI/src/views/Photos/PhotosPlacesView.vue` 与两个 Go 文件,**这次 brief 给的行号/数值基本准确**,只有一处轻微出入:

- brief 称图例三档字面量在 `:1032-1039`;实读源码,三档 `<b>` 标签实际在 **1032 / 1035 / 1038**(`map-legend` 容器 1030 起、闭合 div 在 1039/1042 附近)。核心断言(三个字面量存在、与 40/100 门槛耦合)成立,只是行号范围的收尾多算了一行,不影响实现,已在 `placesMap.ts:112` 注释里只写"legend"不写死行号避免二次失准。
- 其余全部精确匹配:`:9-62`(MAX_SCALE=16 在 :11、tierRadius :15-21、declutterPins :28-62)、`:152-186`(visiblePlaces :152-175 + extraFilterCount :177-186)、`:187-195`、`:196-203`、`:228-278`、`:644-660`(splitScaleFor 逐行一致,包括 22 次迭代与 `hi * 1.04`)。
- 后端契约:`places_types.go:5` `Key int32` 确认;`places.go:76` `p.Last = lt.Format("Jan 2, 2006")` 确认,Format 布局与 brief 给的月份表实现完全吻合。
- 确认 Vue2 侧 `region` 展示确实直接读后端 `label` 字段(`regions.find(r=>r.id===rId).label`,无 i18n 键),印证 `regionLabelKey` 是本期新增的偏离(登记 3),非误判。

## 测试与结果

`pnpm exec vitest run src/photos/util/__tests__/placesMap.test.ts src/photos/util/__tests__/worldMap.test.ts` → **41 例全绿**(placesMap 33 + worldMap 8)。
全量 `pnpm exec vitest run` → **271 个文件、2276 例全绿**(基线 270 文件/2240 例,净增 1 文件/36 例,与本任务新增测试数一致)。
`pnpm exec vue-tsc --noEmit` → 无输出,exit 0。

## TDD 证据(RED → GREEN)

**RED**(placesMap.ts 尚未创建时):
```
pnpm exec vitest run src/photos/util/__tests__/placesMap.test.ts src/photos/util/__tests__/worldMap.test.ts
❯ src/photos/util/__tests__/placesMap.test.ts (0 test)
Error: Failed to resolve import "../placesMap" from "src/photos/util/__tests__/placesMap.test.ts". Does the file exist?
Test Files  1 failed | 1 passed (2)
     Tests  8 passed (8)
```
(worldMap 侧的 8 例——含 3 个新增的 viewBox 钳制用例——在组件已存在的情况下直接通过,证明手推的期望值与 `PhotosMiniMap.vue` 现有实现一致,不是先跑出结果再回填。)

**GREEN**(实现 placesMap.ts 后):
```
pnpm exec vitest run src/photos/util/__tests__/placesMap.test.ts src/photos/util/__tests__/worldMap.test.ts
Test Files  2 passed (2)
     Tests  41 passed (41)
```

## 8 处删码验证逐条结果

一次只删一处,验完立即还原,全部用 `pnpm exec vitest run src/photos/util/__tests__/placesMap.test.ts` 复核。

1. **删 `buildPins` 的 `atMax` 分支(恒走 `clusterByOverlap`)** → 红:`scale >= MAX_SCALE 时每个城市自成一钉` 断言 `length` 2 got 1;`满缩放下共点两钉被推开` 报 `Cannot read properties of undefined (reading 'x')`。符合预期,已还原。
2. **删 `atMax` 时的 `declutterPins` 调用** → 红:`满缩放下共点的两钉被 declutter 推开` 断言 `0 to be greater than 0` 失败(两钉仍完全重合)。已还原。
3. **`hitR` 改成 `r`(去掉 `Math.max(r, 9/scale)`)** → 红:`hitR 不小于 9/scale` 断言 `0.875 >= 1.125` 失败。已还原。
4. **`active` 比较去掉 `String()` 归一** → **未按预期变红**(见下方"发现"),已按说明追加真正能钉住该行的用例并验证其能捕获此变异,再还原实现。
5. **`filterPlaces` 的 `year` 分支改回 `/202(?:5|6)/.test(p.last)`** → 红:`year 分支按注入的当前年份判定` 断言 `['b'] to equal ['a']` 失败(2030 年的地点没被筛到,反而筛到写死年份命中的 2026 年地点)。已还原。
6. **`parsePlaceLast` 回读校验两行删掉** → 红:`溢出日期(Feb 31)…` 断言 `2026-03-02T16:00:00.000Z to be null` 失败(自动进位成 3 月 3 日的本地时间被序列化成 UTC 字符串)。已还原。
7. **`splitScaleFor` 的 `hi * 1.04` 改成 `hi`** → **未按预期变红**(brief 已预判这个可能性并给了修复建议,但该建议本身有问题,见下方"发现"),已设计出真正有效的替代断言并验证,再还原实现。
8. **`groupByRegion` 桶内 sort 删掉** → 红:`groupByRegion 每桶内按 count 降序` 断言 `['a','b'] to equal ['b','a']` 失败。已还原。

## 发现(两处删码逃逸,均已妥善处理,非回避)

### 发现 1 —— 删码验证 #4(`active` 的 `String()` 归一)未变红

brief 强制"逐字包含"的用例是:
```js
const p1 = place({ id: '7', key: 7 })
expect(buildPins([p1], MAX_SCALE, '7')[0].active).toBe(true)
```
`Place.id` 在类型上恒为 `string`(由 `toPlace`/测试 fixture 保证),`activeId` 参数在这条用例里也传的是字符串 `'7'`。两边本就都是字符串,删掉 `String()` 包装后 `m.id === activeId` 与 `String(m.id) === String(activeId)` 在这条用例下**行为完全相同**,删码不会让它变红——已实测确认。

`String()` 归一真正防的是**运行时穿透 TS 类型系统**的情形(调用方没有认真对待 `activeId: string | null` 签名,实际传了个数字)。为了不"调整测试去迁就"而是"补一条能真正命中变异的测试",追加了:
```js
it('active 对运行时类型违规(activeId 实际是 number)仍靠 String() 归一命中', () => {
  const p1 = place({ id: '7', key: 7 })
  const runtimeNumericActiveId = 7 as unknown as string   // 故意穿透 TS
  expect(buildPins([p1], MAX_SCALE, runtimeNumericActiveId)[0].active).toBe(true)
})
```
删掉 `String()` 后重跑,**只有这条新用例变红**(`expected false to be true`),原 brief 用例仍绿——证实了我的判断,也证实新增用例确实钉住了这一行。保留两条用例(brief 逐字用例 + 新增的运行时穿透用例)。

### 发现 2 —— 删码验证 #7(`hi * 1.04`)未变红,且 brief 自己给的补救断言本身站不住

brief 原用例("能裂开时返回值…在该 scale 下确实裂成 >= 2")删掉 `*1.04` 后**仍然绿**——原因是二分循环的不变量保证 `clusters(hi) >= 2` **在任何时候都成立**(`hi` 只在验证过 `>=2` 时才被收窄到 `mid`),所以哪怕拿掉安全系数,裸 `hi` 下依然满足 `>=2` 簇,这条断言天然测不出差异。

brief 给的补救建议是"改成断言 `s` 下 `>=2` 且 `s/1.04` 下 `<2`"。我先按此实现,结果**对着正确实现跑也失败**:正确实现里 `s = hi*1.04`,所以 `s/1.04` 约等于 `hi` 本身(乘除互逆),而 `clusters(hi)>=2` 这条不变量前面刚证明恒成立,于是"`s/1.04` 下 `<2`"这个断言对正确代码也是假的——实测报错 `expected 2 to be less than 2`。也就是说 brief 这条补救本身与算法不变量矛盾,不是我实现错了。

真正有效的修法:不再依赖"簇数量在浮点边界上翻转"这种脆弱信号,而是在测试里用**同样受信的** `clusterByOverlap` + `tierRadius` + `project()`(均已被 Task1/worldMap 的测试钉住,不是本次测试对象)独立复现同一段 22 步二分,求出 `hi`,再直接断言 `splitScaleFor` 的返回值在数值上等于 `hi * 1.04`(`toBeCloseTo(…, 9)`)且明显大于 `hi * 1.03`。这条对正确实现绿、对 `hi*1.04→hi` 的变异**准确变红**(实测 `expected 12.6… to be close to 13.1…`),已保留在测试文件里,原断言("能裂开…")保留作为基础可读性用例。

以上两处均未去调整/放宽原有断言迁就实现,而是保留原断言(诚实反映"这条它测不出来")、另行新增能真正命中变异的独立用例。

## worldMap.ts 三个新用例的期望值是怎么手算出来的

`PhotosMiniMap.vue` 的 viewBox 算法:先取 GPS 点的经纬度包围盒,加 padding(`LON_PAD=20`/`LAT_PAD=15`)并夹到 [-180,180]/[-90,90],若夹完的跨度仍小于 `MIN_LON_SPAN=40`/`MIN_LAT_SPAN=30` 则以中点为轴再摊开一次并再夹一次边界,最后用**已受信**的 `project()` 转成像素坐标。三个用例的经纬度包围盒边界都是手算的(见测试文件内联注释逐步推导),再调用真实 `project()`(不是自己算乘除)得到期望像素值:

- **贴近 +180**(`lon=179, lat=0`):算出 `minLon=149.5, maxLon=180`(纬度不受影响,`[-15,15]`),再断言 `topLeft=project(149.5,15)`、`bottomRight=project(180,-15)`。
- **贴近 +90**(`lon=0, lat=89`):算出 `minLat=67, maxLat=90`(经度不受影响,`[-20,20]`),`topLeft=project(-20,90)`、`bottomRight=project(20,67)`。
- **贴近 -180/-90**(`lon=-179, lat=-89`):两轴同时触发,算出 `minLon=-180, maxLon=-149.5, minLat=-90, maxLat=-67`。

**手推过程中发现 brief 注释草稿("拉回 40 度宽")不准确**:widen 步骤是围绕新中点对称展开 `±MIN_SPAN/2`,但当原始点贴着边界时,新中点本身仍贴着边界,widen 后会在同一侧被再夹一次,最终跨度**恒小于 MIN_SPAN**(只收敛趋近,永远达不到,如上面算出的 30.5°/23° 而非 40°/30°)。三个用例已按实际推导值断言(不是 40/30 的整数),并额外断言"确实撞到边界"(`vx+vw===MAP_W` / `vy===0` / `vx===0 且 vy+vh===MAP_H`)与"跨度确实比裁剪前小、比原始未夹的 40/30 小"来佐证钳制分支真正被触达。三个用例首次编写完成后**直接对着既有组件跑通**,不是先跑出结果再回填期望值。

## 改动的文件

- `src/photos/util/placesMap.ts`(新建)
- `src/photos/util/__tests__/placesMap.test.ts`(新建,33 例)
- `src/photos/util/__tests__/worldMap.test.ts`(只追加,新增 3 例,原 5 例未动)

## 自查发现

- `toPlace`/`buildPins` 内部用对象展开(`...m`)把整个 `Place` 铺进 Pin 字面量,单成员 Pin 因此不带 `members`/`places` 键(不是 `undefined`),已用 `'members' in pin === false` 的断言钉住,`vue-tsc --noEmit` 未报超额属性错误。
- `filterPlaces` 的 custom 区间用 `T00:00:00`/`T23:59:59.999` 后缀构造本地时区 Date(不带时区后缀的 ISO 字符串按 spec 走本地时间解析),测试已覆盖闭区间边界(customEnd 当天不被排除)。

## 顾虑

以上"发现 1/2"已通过补充测试妥善解决(非绕过),但仍标记 DONE_WITH_CONCERNS 汇报给你复核这两处的处理方式是否符合预期——尤其是发现 2 指出 brief 给的补救断言本身与算法不变量矛盾这一点,想确认这个结论、以及我最终采用的独立复现二分的替代测试思路是否可以接受。
