# P5d · T3 修复轮 1 —— 范围收窄复审

复审范围:BASE `e48b09a` → HEAD `d144cf6`(仅 `.superpowers/sdd/review-e48b09a..d144cf6.diff`)。
全程未改仓库产品代码(探针以 `cp` 备份 + `md5sum` 逐字节比对方式还原,零 `git checkout`/`restore`)。

## 待判定 finding

> `applyFilters` 缺「`type` + `status` 同时非空」的组合筛用例(六条原用例每条只让其中一个非空,
> 把 `&&` 写成 `||` 时它们一条都不会红)。

## 自跑 `&&`→`||` 探针(本人独立执行,非采信实现者自述)

```
$ cp notesViewHelpers.ts notesViewHelpers.ts.rereview1.bak && md5sum 两者
  03b4c1a...  两者一致(注入前基线)
$ Edit:第 93 行末尾运算符 `&&` → `||`(applyFilters 内连接 type/status 两个子句的顶层运算符)
$ grep 确认注入落盘 → 第 93 行确实是 `(!type || n.type === type) ||`
$ pnpm exec vitest run notesViewHelpers.test.ts
  FAIL × type 与 status 两个筛选条件各自独立生效(蓝本 spec 原例)   ← 原有
  FAIL × status="active" 表示非 archived(draft+curated 都算)      ← 原有
  FAIL × status 为具体值(非 ""/"active")时是精确匹配              ← 原有
  FAIL × 组合命中:…                                                ← 本轮新增
  FAIL × 组合落空:… 真正抓「误写成 OR」的那条                      ← 本轮新增
  FAIL × 组合筛纳入 status="active"…                                ← 本轮新增
  Test Files 1 failed | Tests 6 failed | 26 passed (32)
$ cp notesViewHelpers.ts.rereview1.bak notesViewHelpers.ts && md5sum 两者
  03b4c1a...  两者一致(还原确认,与注入前逐字节相同)
$ pnpm exec vitest run notesViewHelpers.test.ts
  Test Files 1 passed (1) / Tests 32 passed (32)
```

**新增 3 条逐条核实,全部真的报红**：「组合命中」「组合落空」「组合筛纳入 active」三条在
`||` 突变下均出现在 FAIL 列表中，**没有一条是零判别力的挂名用例**。原有 6 条里另有 3 条
（「独立生效」「active 语义」「精确匹配」）也连带报红——这是因为这几条把 `type` 或 `status`
其中一个设为空字符串，`!type`/`!status` 恒真，OR 突变下该子句恒为真会吞掉另一子句，属于
副作用式命中，不影响本次待判定 finding 的判断。

## 三条补法要求逐条核验

1. **组合命中不与单条件筛重合**：list = `a(insight,draft)`两者都满足、`b(insight,curated)`只满足
   type、`c(note,draft)`只满足 status。同一 `it()` 内先断言单按 type 筛 = `['a','b']`、单按
   status 筛 = `['a','c']`，再断言组合筛 = `['a']` —— 与两个单条件结果均不同。**满足**。
2. 🔴 **组合落空**：list = `d(insight,curated)`仅满足 type、`e(note,draft)`仅满足 status，
   两者各自都不同时满足两条件，组合查询 `{type:'insight',status:'draft'}` 断言结果为 `[]`。
   探针下 `d`、`e` 在 OR 突变下均被吞入结果（非空数组），断言失败，证实这条确实是抓
   「误写成 OR」的核心用例。**满足**。
3. **`status: 'active'` 档**：list = `f(insight,draft)`type 匹配+非 archived(应中)、
   `g(insight,archived)`type 匹配但 archived(应被 active 语义排除)、`h(note,curated)`
   非 archived 但 type 不匹配(应被 type 排除)。查询 `{type:'insight',status:'active'}` 期望
   `['f']`。`g`/`h` 都不是被字面量精确匹配排除的（'active' ≠ 'archived'/'curated' 之外还要看
   type),真正验证的是「active = 非 archived」语义而非精确匹配。**满足**。

## 产品代码零改动自证(本人核实)

```
$ git diff e48b09a..d144cf6 -- src/ai/knowledge/util/notesViewHelpers.ts
(空,零输出)
```
只有 `notesViewHelpers.test.ts` 和 `p5d-task-3-report.md` 两个文件在本轮修复 diff 中变动。

## 算式与收尾核验(本人核实)

```
$ pnpm test
  Test Files 328 passed (328) / Tests 3595 passed (3595)   exit=0
$ git status --short
(空)
$ git rev-parse HEAD
d144cf6c10b4f5c95531ecb89f8b233ad187f68f
```
3592(T3 首轮) + 3(本轮新增) = **3595** ✅；文件数仍 **328** ✅；`git status` 干净，HEAD 仍
`d144cf6`。

## 判定

**ADDRESSED**。三条补法要求(组合命中不与单条件筛重合 / 组合落空 / `active` 档)均逐条满足；
`&&`→`||` 探针下新增 3 条全部真实报红，还原后 md5 一致，全量三门口径下的 test 计数与文件数
均与算式吻合。

## 修复 diff 内新引入的破坏

无。本轮 diff 只新增 3 个测试 `it()` 块 + 报告文档段落，未触碰任何产品代码、未修改任何既有
用例的断言、未改变 `describe` 结构之外的任何内容。

## 范围外观察(不延长本轮修复)

- 三个新用例的注释在描述 mutation 场景时写「若把 `&&` 误写成 `||`」，实际上顶层连接符只有一个
  `&&`(第 93 行行尾),而各子句内部也各自有一个 `||`(`!type || n.type===type` 等)——探针改的
  是顶层那个 `&&`,注释表述不够精确但不影响用例本身的判别力,无需在本轮内修正。
- 原有 6 条用例里有 3 条(独立生效/active 语义/精确匹配)在本次 OR 突变下也连带报红,原因是
  其中一个筛选参数为空字符串导致该子句恒真、OR 下吞掉另一子句——这是一个有意思的伴生现象,
  但不影响、也不需要延长本轮判定。
