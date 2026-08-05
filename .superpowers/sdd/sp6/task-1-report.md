# Task 1 报告:迁移 RAID 级别元数据与纯计算(`raidLevels.ts`)

> 注:本文件路径 `task-1-report.md` 之前被更早一期(P1 台账债 `useDiskHotplug` 抽取)的报告占用过,已按本次分配的任务内容整体覆盖。若需要保留那份历史报告,请从 git 历史(commit `2199e09` 附近)找回,本文件不再保留其内容。

## 做了什么

- 新建 `src/storage/util/raidLevels.ts`:从 `NimoOS-UI/src/utils/raidUtils.js` 逐字移植:
  - `RAID_LEVELS`(id 0/1/5/6/10,顺序不变),每级 `min/tolerance/read/write/cost/desc/usecase` + `capacity(n, sizeBytes)` + `layout(n)`。`desc`/`usecase` 逐字保留 Vue2 原文本(含看起来像占位符的 `'RAID 0 Description'` 等,未改写,见下方"疑虑")。
  - `recommendRaidLevel(n)`:按 brief 简化签名(纯盘数决策,不含 Vue2 原函数里对 `groupDisksBySpec` 混规格/长度的校验——那部分职责留给调用方在选盘阶段处理)。
  - `isDiskAtRisk(disk)`:逐字 `disk.health === 'false'`(字符串比较,不是布尔)。
  - `groupColorKey(disk, groups)` + 辅助 `diskSpecKey(disk)`:从 Vue2 `groupDisksBySpec`(size|disk_type 分组键)+ `assignGroupColors`(`GROUP_COLOR_COUNT=5` 循环下标)改造而来,返回 `'group-a'..'group-e'` 语义 key,不返回字面色。
  - **未迁移**:`survival()`/`rebuildable()`(故障模拟器,按 brief 明确推迟),`toleranceText`/`toleranceTone`/`tempDisplay`/`tempTone`/`pohDisplay`/`pohTone`/`diskHealthScore`/`diskHealthTone`(brief 未要求,均超出本 Task 范围)。
  - 文件顶部按 Step 3 要求加了来源注释 + 推迟项说明。
- 新建 `src/storage/util/raidLevels.test.ts`:先逐字写入 brief Step 1 给定的完整测试代码(6 个 case),确认 RED,再实现到 GREEN。之后**补充了 4 个自写测试**覆盖 `groupColorKey`/`diskSpecKey`——因为 brief 给定的测试代码块本身不含对它们的断言,但 brief 的 Produces 接口明确要求导出这两者,所以在不改动给定测试代码的前提下追加覆盖,并显式断言返回值不含 `#`/`rgb` 字面色特征。

## 测试命令与输出

```
$ pnpm exec vitest run src/storage/util/raidLevels.test.ts   # Step 2:确认 RED(先写完给定测试代码,模块尚未创建)
Error: Failed to resolve import "./raidLevels" from "src/storage/util/raidLevels.test.ts"
Test Files  1 failed (1)
```

```
$ pnpm exec vitest run src/storage/util/raidLevels.test.ts   # Step 4:确认 GREEN(含补充测试后)
Test Files  1 passed (1)
Tests  10 passed (10)
```

```
$ pnpm exec vue-tsc --noEmit
(无输出,零错误)
```

```
$ pnpm exec vitest run   # 全量回归
Test Files  235 passed (235)
Tests  1370 passed (1370)
```

```
$ grep -nE "#[0-9a-fA-F]{3,6}|rgb\(|rgba\(" src/storage/util/raidLevels.ts
no literal colors found
```

## 自评发现与修正

- 初稿时注意到 brief 的 `RaidLevelInfo.tolerance` 类型是纯 `string`,而 Vue2 原始 `tolerance` 字段是混合类型(数字 0/1/2、函数 `(n)=>n-1`、字符串 `'half'`)。这不是"读数"本身而是类型收窄决策——按 brief 接口定义把它们分别字符串化为 `'0'`/`'n-1'`/`'1'`/`'2'`/`'half'`,并在每一级旁加注释标明对应 Vue2 原始值,避免信息丢失但不产出可执行公式(因为本 Task 不要求迁移 `toleranceText`/`toleranceTone`)。
- `layout()` 返回的角色标签里,brief 的 TS 联合类型是 `'parity2'`(无连字符),而 Vue2 字面量是 `'parity-2'`。这是命名对齐 brief 接口的决定,不影响判定/计算公式,已按 brief 类型定义执行。
- 发现 `src/storage/util/raidView.ts` 里已存在一个**同名但结构完全不同**的 `export interface RaidLevelInfo`(那边是 `{name, faultToleranceKey, readSpeedKey, writeSpeedKey, descKey}`,给 P3 只读详情页用 i18n key)。两者位于同一 `src/storage/util/` 目录但不同文件,目前没有任何文件同时 import 两者所以不构成编译冲突,`vue-tsc --noEmit` 也确认零错误。但这是潜在的可读性陷阱,留在下面"疑虑"里。

## Commit

`d025c7b` — `feat(storage): 迁移 RAID 级别元数据与纯计算(P4 T1,不含故障模拟器)`

## 疑虑(供后续 Task/评审参考)

1. **`RaidLevelInfo` 命名冲突**:`raidView.ts` 已导出一个同名但结构完全不同的 `RaidLevelInfo`(P3 遗留,i18n-key 导向)。本 Task 按 brief 要求在 `raidLevels.ts` 里也导出了同名接口(id/min/tolerance/capacity/layout 导向)。两者语义不同、用途不同(一个给详情页展示用 i18n key,一个给矩阵/向导做纯计算)。建议后续消费方 import 时用别名(如 `import { RaidLevelInfo as RaidLevelCalcInfo } from '../util/raidLevels'`)明确区分,或在后续 Task 里评估是否要重命名其中一个以避免长期混淆——本 Task 未做这个决定,因为重命名已存在的 `raidView.ts` 导出超出了 Task 1 范围。
2. **`desc`/`usecase` 是逐字保留的占位文本**(如 `'RAID 0 Description'`),看起来像 Vue2 里从未真正填充的占位符而非最终文案。按"读数/判定不得改"的约束原样迁移,未做改写或 i18n 化。如果后续矩阵/向导组件要展示这些文案,需要有人决定是接着用占位文本、还是切到 `raidView.ts` 里已有的 i18n key(`raidLevel0Desc` 等)。
3. **`recommendRaidLevel` 简化了签名**:Vue2 原函数接收 `selectedDisks` 数组并做"少于 2 盘→null"、"混规格→null"两层校验;brief 明确把签名简化为 `(n:number)=>number`,把这两层校验的职责移交给调用方(选盘阶段)。本 Task 严格按 brief 实现,但后续用到它的组件/向导 Task 需要记得在调用前自己做这两层前置校验,否则会对不足 2 盘或混规格的选择给出无意义的推荐值。

## 追加:命名冲突修复(2026-07-27)

针对上面"疑虑 1"里指出的 `RaidLevelInfo` 撞名问题,做了小修:

- **改法**:把本文件(`raidLevels.ts`)里新加的 `export interface RaidLevelInfo` 重命名为 `RaidLevelSpec`,同步改了同文件内 `RAID_LEVELS: RaidLevelSpec[]` 的类型标注。`raidView.ts` 里那个 P3 遗留的同名 `RaidLevelInfo`(i18n-key 导向,`RAID_LEVEL_INFO`/`levelInfo()`)**未改动**,按要求保持原样。
- **确认范围**:`grep -rn "RaidLevelInfo" src/` 改前定位到 3 处仅在 `raidLevels.ts`(interface 定义 + `RAID_LEVELS` 类型标注),`raidView.ts` 3 处(其自身定义 + `RAID_LEVEL_INFO` + `levelInfo()`);`raidLevels.test.ts` 未 import/引用该类型名(测试只 import 值,如 `RAID_LEVELS`/`recommendRaidLevel`/`isDiskAtRisk`/`groupColorKey`/`diskSpecKey`/`RaidDisk` 类型),无需改动。改后 `grep -rn "RaidLevelInfo" src/` 仅剩 `raidView.ts` 的 3 处。全仓无其他文件曾经 import 过 `raidLevels.ts` 的 `RaidLevelInfo`,不存在遗漏点。

### 测试命令与输出

```
$ pnpm exec vitest run src/storage/util/raidLevels.test.ts
Test Files  1 passed (1)
Tests  10 passed (10)
```

```
$ pnpm exec vue-tsc --noEmit
(无输出,零错误)
```

### Commit

`d16adea` — `fix(storage): P4 T1 类型改名 RaidLevelInfo→RaidLevelSpec 避免与 raidView 撞名`
