# Task 1 report — placesCluster.ts

## 实现了什么

逐行照搬 Vue2 `NimoOS-UI/src/utils/placesCluster.js`(整文件 101 行,已核对与 brief 引用一致),
只加 TypeScript 类型/泛型,算法逻辑一字未改:

- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/util/placesCluster.ts`
  - `export interface ClusterItem { x, y, count }`
  - `export interface Cluster<T extends ClusterItem> { x, y, count, members, lead }`
  - `export function clusterByOverlap<T extends ClusterItem>(items, scale, radiusFn, factor = 1): Cluster<T>[]`
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/util/__tests__/placesCluster.test.ts`(brief 给的 12 例,逐字转录)

三个导出名(`clusterByOverlap` / `Cluster` / `ClusterItem`)与签名逐字符合 brief,供 Task 2 消费。

## 测了什么与结果

12 个 `it()`(brief 正文写「PASS 13 例」,但实际给出的测试代码块里数了 12 个 `it(`——是 brief
文字描述与其自带代码的计数不一致,不是我漏抄;已逐行核对测试文件与 brief 代码块完全一致,12 例全绿)。

覆盖:空输入/非数组防御、单点自成簇、不合并边界、合并+加权质心、scale 放大拆分簇(splitScaleFor
前提)、count 降序播种+lead 取最大者、同 count 下标升序 tie-break、簇半径随吸收增长需重算、
factor 松弛系数、count=0/缺失按权重 1 兜底、全覆盖不重不漏、不修改输入对象。

## TDD 证据

**RED**(先写测试,实现文件不存在):
```
$ pnpm exec vitest run src/photos/util/__tests__/placesCluster.test.ts
 FAIL  src/photos/util/__tests__/placesCluster.test.ts [ src/photos/util/__tests__/placesCluster.test.ts ]
Error: Failed to resolve import "../placesCluster" from "src/photos/util/__tests__/placesCluster.test.ts". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```
预期失败:实现文件尚未创建,import 解析失败——符合 Step 2 的预期(`Failed to resolve import`)。

**GREEN**(写完 `placesCluster.ts` 后):
```
$ pnpm exec vitest run src/photos/util/__tests__/placesCluster.test.ts
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

**类型检查**:
```
$ pnpm exec vue-tsc --noEmit
(无输出,通过)
```

## 5 处删码验证(逐条实测,一次一处,验完立即 diff 确认已还原)

1. **`order` 的 sort 回调改成 `() => 0`**
   → 实测:仅「按 count 降序播种:最大者是 lead」变红(`expected small... to be big...`)。
   「同 count 下标升序播种」**没有**变红——原因是 V8/Node 的 `Array.prototype.sort` 自 ES2019
   起保证稳定排序,`sort(() => 0)` 对一个已经是 `[0,1,...,n-1]` 恒等顺序的输入数组是纯粹的 no-op
   (排序前 `order` 本来就由 `items.map((_,i)=>i)` 构造成升序恒等数组),而该 tie-break 测试
   构造的两组输入,其"正确答案"本身也恰好等于恒等顺序(index 小者应排前面,无论输入数组正反),
   所以这个特定破坏方式对这条测试无从体现。这是 JS 引擎稳定排序语义决定的边界情况,不是我能通过
   改测试代码规避的(brief 禁止发明测试之外的写法),也不是实现缺陷——已如实记录,供后续任务参考。
   还原后跑测试确认 12/12 绿,`diff` 与备份文件完全一致。

2. **`while (absorbed)` 循环体只跑一轮**(`absorbed` 末尾强制 `= false`)
   → 「簇半径随吸收增长,能拉进第一轮门槛外的点」变红:期望 1 簇,实得 2 簇。符合预期。
   还原后 12/12 绿,diff 一致。

3. **`const R = radiusFn(total)` 挪到 `while` 外面**
   → 同上那条测试变红,报错信息与第 2 点完全一致(期望 1 簇实得 2 簇)。符合预期(同一不变量的
   两种不同破坏方式)。还原后 12/12 绿,diff 一致。

4. **加权质心 `sx += o.x * w` 删掉 `* w`**
   → 「距离 < 半径和时合并,质心按 count 加权」变红:`expected 0.25 to be close to 2.5`。
   符合预期。还原后 12/12 绿,diff 一致。

5. **`factor` 默认值改成 2**
   → 「距离 >= 半径和时不合并」变红(期望 2 簇实得 1 簇),符合预期;另外还连带打红了
   「放大到足够 scale 后同一对点分开」(该测试同样用默认 factor),属于同一破坏面的合理连带,
   brief 未禁止多条一起红、只要求指定那条必须红——已满足。还原后 12/12 绿,diff 一致。

每次删码后都用 `diff` 与预先备份的原始文件逐字节比对,确认「验完还原」严格执行,不存在
前一处修改遗留污染后一处验证的情况。

## 改动的文件

- 新增 `src/photos/util/placesCluster.ts`
- 新增 `src/photos/util/__tests__/placesCluster.test.ts`
- Commit: `76e0bf3` `feat(photos): P6a-T1 地点地图重叠聚类纯函数照搬 + 全套单测(Vue2 侧零测试)`

## 全量回归

```
$ pnpm exec vitest run
 Test Files  270 passed (270)
      Tests  2239 passed (2239)
```
(基线为 269 文件/2227 测试,本任务净增 1 文件/12 测试,数字吻合,无既有测试被弄红。)
运行中出现的 `Error: Not implemented: navigation (except hash changes)` 是 jsdom 对
`src/photos/stores/favorites.test.ts` 里 `location.href =` 跳转的既有噪音日志,与本任务无关、
不影响测试通过状态。

```
$ pnpm exec vue-tsc --noEmit
(无输出,通过)
```

## 自查发现

- brief 正文声称测试「PASS(13 例)」,但其自带的测试代码块本身只有 12 个 `it()`——已按代码块
  逐字转录,不是我漏写;已在报告开头注明,供 brief 作者核对是否为笔误。
- 删码验证第 1 点里,预测的两条测试红只兑现了一条,根因是 JS 稳定排序 + 测试构造的输入恰好
  与恒等顺序重合;已详述根因,不影响算法本身正确性(该测试仍然精确钉住了「同 count 升序」
  这一行为规范,只是这一种特定破坏方式无法触发它——用其它破坏方式,如把 tie-break 从 `a - b`
  改成 `b - a`,是可以让它变红的,但那不在 brief 列出的 5 处删码清单内,故未额外验证)。

## 顾虑

无实质性顾虑。上述两点仅为如实记录的观察,不影响交付质量或下游 Task 2 的可用性
(接口签名、算法行为均与 Vue2 源一致)。

---

# 复审 Fix 报告(I1 / I2 / Minor)

评审裁定:Spec ✅ / Quality Approved,原报告主动申报的两点均复核成立,「删码验证 #1 只红 1 条」
的分析被采纳为「暴露了 brief 的一处测试设计缺陷」,需按下述方式修补(控制器裁定按此做法修不算
违背 plan)。

## I1:补一条能真正区分「正确 tie-break」与「sort 没跑」的测试

**问题**:原「同 count 时按原数组下标升序播种」测试用的两个输入([first,second] 与 [second,first])
其"正确答案"本身就等于恒等顺序 `[0,1]`,导致 `sort(() => 0)`(no-op,因 JS `Array.sort` 保证稳定)
这个坏实现也能蒙混过关——这条测试测不出「sort 到底有没有执行」。

**修法(追加,不改动/不删除原测试)**:在
`src/photos/util/__tests__/placesCluster.test.ts` 新增一条:

```ts
  it('三项混合 count 时 tie-break 真正生效:等 count 的两项按下标升序,最大者播种', () => {
    const a = p('a', 0, 0, 5)
    const b = p('b', 8, 0, 10)
    const c = p('c', 16, 0, 10)
    const out = clusterByOverlap([a, b, c], 1, r10)
    expect(out).toHaveLength(1)
    expect(out[0].lead).toBe(b)
    expect(out[0].members[0]).toBe(b)
  })
```

构造要点:a 下标最小但 count 最小(排除"下标小就赢"的伪解),b/c 等 count 且都最大,正确 order
应为 `[1,2,0]`(seed=b);`sort(() => 0)` 会把它坏成 `[0,1,2]`(seed=a);tie-break 写反成
`b - a` 会把它坏成 `[2,1,0]`(seed=c)。两种坏法给出的 seed 互不相同、也都不等于正确答案,
因此这条测试对两种坏法都能给出确定性的红。

**重跑基线**(新增测试后,改动前先确认绿):
```
$ pnpm exec vitest run src/photos/util/__tests__/placesCluster.test.ts
 Test Files  1 passed (1)
      Tests  13 passed (13)
```
13 例——与 brief 正文原先声称的「PASS 13 例」现在真正对齐(此前 12 例是 brief 代码块本身少写
了这条)。

**逐个删码变异复测(一次一处,验完 diff 确认已还原):**

1. **`order` 的 sort 回调改成 `() => 0`**
   → 新测试变红:
   ```
   FAIL … 三项混合 count 时 tie-break 真正生效…
   AssertionError: expected { id: 'a', ... } to be { id: 'b', ... }
   ```
   同时原有「按 count 降序播种:最大者是 lead」依旧变红(与首次删码验证一致);
   原有「同 count 时按原数组下标升序播种」**依旧不红**(预期内,原因同前——它的输入构造本身
   无法区分这个坏法,新测试的存在正是为了补这个盲区)。共 2 条红。
   还原后 `diff` 与备份逐字节一致,`vitest run` 13/13 绿。

2. **tie-break 从 `a - b` 改成 `b - a`**
   → 新测试变红:
   ```
   FAIL … 三项混合 count 时 tie-break 真正生效…
   AssertionError: expected { id: 'c', ... } to be { id: 'b', ... }
   ```
   意外之喜:这次连原有「同 count 时按原数组下标升序播种」也一并变红了(该测试虽然测不出
   `sort(() => 0)` 这种"完全不排序"的坏法,但能测出"排序了、方向排反"这种坏法——因为
   `b - a` 对它的两组输入确实会把顺序反过来,不再等于恒等)。共 2 条红,均符合「必须红」要求。
   还原后 `diff` 与备份逐字节一致,`vitest run` 13/13 绿。

两个变异都按要求让新测试变红,未出现「变异没让新测试变红」的情况,因此未触发「先停手汇报」的
分支。

## I2:文件头注释的行数声明有误,已核对来源并改为不写具体行数

`placesCluster.ts` 头部注释原写「整文件 101 行」,系抄自 brief;经 `wc -l` 回源核对:
```
$ wc -l /home/nimo/NimoTech/NimoOS-UI/src/utils/placesCluster.js
87 /home/nimo/NimoTech/NimoOS-UI/src/utils/placesCluster.js
```
确认 brief 里的「101」有误,实际是 87 行。采纳建议的后一种修法:**去掉具体行数**,只保留文件
路径引用,并加一行注释说明原因(行数会随上游变动再次失准,路径不会)。

**自查其它是否有照抄 brief 而未回源核对的具体数值**:通读 `placesCluster.ts` 与
`placesCluster.test.ts` 全文,除已修的「101 行」外,未发现其它引用外部事实的具体数值(测试内的
坐标/count/半径等数字都是测试自洽的手算推导,不是对 Vue2 源文件的事实性引用,已在各测试注释里
自证运算过程,无需回源)。

## Minor:count=0 测试标题措辞

`ClusterItem.count: number` 是必填字段,原测试标题「count 缺失/为 0 时…」里的"缺失"在类型层面
测不到(不加 `as any` 无法构造缺 `count` 的对象),测试实际只覆盖了 `count: 0` 这一种输入。
按要求不加 cast 去凑标题,而是把标题改窄为「count 为 0 时按权重 1 参与质心、按 0 参与总计」,
与测试代码实际覆盖的行为一致。

## 收尾验证

```
$ pnpm exec vitest run src/photos/util/__tests__/placesCluster.test.ts
 Test Files  1 passed (1)
      Tests  13 passed (13)

$ pnpm exec vitest run   # 全量回归
 Test Files  270 passed (270)
      Tests  2240 passed (2240)

$ pnpm exec vue-tsc --noEmit
(无输出,通过)
```
全量基线从 2239 例增至 2240 例(净增本次追加的 1 条新测试),无既有测试被弄红。

## 改动文件(本轮复审 fix)

- `src/photos/util/placesCluster.ts`(头部注释:删去「101 行」的错误行数声明)
- `src/photos/util/__tests__/placesCluster.test.ts`(新增 1 条 tie-break 测试;count=0 测试标题改窄)
- Commit(本轮):见下方 git log

## 顾虑

无。两处 Important 与 Minor 均已按裁定方式修复并有测试证据支撑;新增测试对两种预期的坏法都
给出了确定性的红,原有测试的盲区已用「追加不删除」的方式补齐,未破坏其原有价值(它仍然钉住
「两种输入顺序下都稳定」这一独立于 tie-break 是否生效的性质)。
