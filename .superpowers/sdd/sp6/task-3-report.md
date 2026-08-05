# Task 3 报告(SP6-P4):选盘组件 RaidDriveCard + RaidDriveBay

> 注:本文件此前内容属于 SP6-P3 阶段一个同名旧任务(store 加 RAID 只读拉取),与当前 SP6-P4 Task 3 无关,已整篇替换。

## 实现内容

`src/storage/components/RaidDriveCard.vue`(新建):
- `<script setup lang="ts">`,props `{ disk: RaidDisk; selected: boolean; groupKey?: string }`,emit `toggle`。
- 迁移自 Vue2 `RaidDriveCard.vue`:整卡 `@click="$emit('toggle')"`、右上勾选圈(选中态 SVG √,`.rdc-check--on`)、SSD/HDD 图标、容量走 `fmtSize(disk.size)`、风险盘(`isDiskAtRisk` 判 `health==='false'`)红框标记 + 风险点(均用 `--remove-fg`)。
- 故障模拟器相关字段(temperature/power_on_time/model 悬浮提示)按 `raidLevels.ts` 顶部注释的迁移范围说明,本 Task 未迁移(有意推迟)。
- 分组色条:`groupKey`(如 `'group-a'`)通过组件内 `GROUP_TOKEN_MAP` 映射到既有 theme token(`group-a→--accent`、`group-b→--accent2`、`group-c→--sem-fg`、`group-d→--dem-fg`、`group-e→--nrm-fg`),未新增任何 token。

`src/storage/components/RaidDriveBay.vue`(新建):
- props `{ disks: RaidDisk[]; modelValue: RaidDisk[] }`,emit `update:modelValue`。
- 内部 `filter = ref<'all'|'ssd'|'hdd'>('all')` + `filteredDisks` computed;过滤按钮:`.rdb-filter-all`(文案走 `t('raidBayFilterAll')`)/`.rdb-filter-ssd`/`.rdb-filter-hdd`(SSD/HDD 字面量,两语言相同未走 i18n key)。
- `selectAllHealthy()`:对 `props.disks`(非仅当前过滤视图)取 `!isDiskAtRisk(d)` 的盘,emit 整体替换 `modelValue`(逐字对齐任务书 Step3 给出的实现指令)。
- `clear()`:emit `[]`。`toggle(disk)`:按 `modelValue` 增删后 emit,选中态完全**受控**(v-model),不像 Vue2 那样内部再维护一份 `selectedDisks` + watch 转发。
- 混规格分组:按磁盘首次出现的 `diskSpecKey` 建组列表,仅当组数 >1(混规格)时才给卡片传 `groupKey`(经 `groupColorKey` 计算),单一规格阵列不显示色条。
- 底部汇总条 `.rdb-summary`:`t('raidBaySelected', { n: modelValue.length, size: fmtSize(总容量) })`。

`src/i18n/zh_cn.ts` / `src/i18n/en_us.ts`:新增 4 个 key(`raidBaySelectAll`/`raidBayClear`/`raidBayFilterAll`/`raidBaySelected`),双写,取值与 P4 计划文档附录 B 建议文案一致。

## TDD 证据

### RED

命令:`pnpm exec vitest run src/storage/components/RaidDriveBay.test.ts src/storage/components/RaidDriveCard.test.ts`

两文件均因 `.vue` 不存在直接报 Vite 解析错误("Failed to resolve import './RaidDriveBay.vue'" / "'./RaidDriveCard.vue'"),0 测试执行 —— 符合"组件未实现"的预期失败形态。

### GREEN

同一命令,实现两组件后:
```
Test Files  2 passed (2)
     Tests  15 passed (15)
```
`RaidDriveBay.test.ts` 8 用例(含任务书 Step1 给出的 4 个逐字用例 + 我补的 clear/HDD 过滤/全部过滤回归用例),`RaidDriveCard.test.ts` 8 用例(toggle/勾选态开关/风险态开关/容量文本/分组色条有无)。

全量回归:`pnpm exec vitest run` → `Test Files 237 passed (237)` / `Tests 1395 passed (1395)`,无回归。

`pnpm exec vue-tsc --noEmit` → 无输出,退出码 0。中途发现任务书给的测试代码字面用了 `.at(-1)`,而本仓库 `tsconfig.json` `lib: ["ES2020",...]` 不含 `Array.prototype.at`(TS2550);vitest(esbuild)不做类型检查故不影响 GREEN,但会让 `vue-tsc` 报错。修法:在 `RaidDriveBay.test.ts` 内加一个局部 `lastCall<T>(calls)` 辅助函数,用 `list[list.length-1]` 语义等价替换三处 `.at(-1)!`,不改 `tsconfig.json`(避免动全局 lib 目标这种超出本 Task 范围的决定)。

`pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts` → 117 项全过。过程中一次未过:`RaidDriveCard.vue` 初版把 Vue2 源里的 `color: #fff`(勾选圈选中态文字色)原样带过来,被 color-guard 抓到裸字面量;改用仓库已有的 `--on-accent` token(专为"accent 背景上的前景色"设计,`theme.css` 两套主题块都已定义)后过。

## 变更文件

- `/home/nimo/NimoTech/.sp6/NimoOS-New-UI/src/storage/components/RaidDriveCard.vue`
- `/home/nimo/NimoTech/.sp6/NimoOS-New-UI/src/storage/components/RaidDriveCard.test.ts`
- `/home/nimo/NimoTech/.sp6/NimoOS-New-UI/src/storage/components/RaidDriveBay.vue`
- `/home/nimo/NimoTech/.sp6/NimoOS-New-UI/src/storage/components/RaidDriveBay.test.ts`
- `/home/nimo/NimoTech/.sp6/NimoOS-New-UI/src/i18n/zh_cn.ts`
- `/home/nimo/NimoTech/.sp6/NimoOS-New-UI/src/i18n/en_us.ts`

提交:`eeb304c` `feat(storage): RAID 选盘 DriveBay+DriveCard(P4 T3)`(分支 `sp6-storage`,worktree `.sp6/NimoOS-New-UI`,已提交,未推送)。

## 自查

- 未改动 T1(`raidLevels.ts`)/T2(`storage.ts` 四写 action)任何既有文件,只新增两组件 + 双写 i18n。
- `RaidDriveCard`/`RaidDriveBay` 均不直接依赖 store,是纯 props/emit 展示组件,符合"选盘 UI 组件"这一职责边界(向导整体状态由后续 Task 负责)。
- 稳定 class 齐全:`.rdb-select-all`/`.rdb-clear`/`.rdb-filter-all`/`.rdb-filter-ssd`/`.rdb-filter-hdd`/`.rdb-summary`,供后续向导测试直接复用选择器。
- `selectAllHealthy` 的语义选择:任务书 Step3 文字明确写的是 `disks.filter(...)`(非 `filteredDisks.filter(...)`),即"全选健康"作用于全部盘而非当前过滤视图;测试用例默认 filter='all' 故两种实现结果一致、无法从给定测试反推,本实现按任务书字面选择"全部盘"语义 —— 若后续向导验收发现产品期望是"仅选中当前过滤视图内的健康盘",这是唯一可能需要回头调整的行为分支,已记入下方遗留关注点。
- 未加"无可用盘"空状态文案(Vue2 有 `$t('No available disks')`),因任务书 i18n key 清单(计划文档附录 B)未列出对应 key,且本 Task 的测试契约未覆盖该场景;避免"只加本 Task 用到的 key"之外的新增。网格为空时目前只是空网格,无提示文字。
- 未迁移 Vue2 卡片的悬浮 tooltip(温度/通电时长/健康分进度条)——这些字段不在 T1 定义的 `RaidDisk` 类型里(仅 `path/size/disk_type/health`),`raidLevels.ts` 顶部注释也明确"故障模拟器…未迁移(有意推迟)"。

## 遗留关注点

- `selectAllHealthy` 的"全部盘 vs 当前过滤视图"语义分歧(见上一节),留给消费该组件的向导 Task 在集成测试里明确期望后再定夺,不需要现在改。
- 空状态("过滤后无盘")的文案缺失,若后续向导集成发现需要,需先在 P4 i18n 附录追加 key 再补。
- `RaidDriveBay` 的过滤按钮当前只有稳定 class 供测试用,未做键盘可达性(如 `aria-pressed`)增强;沿用了本仓库其余选盘/过滤类组件(目前仓库内暂无同款分段控件先例)的最简实现水位,未来如有统一无障碍要求可再补。

## 追加(2026-07-27):selectAllHealthy 语义分歧已裁定,补 fix

上一节"遗留关注点"里悬而未决的 `selectAllHealthy` 全量 vs 过滤视图分歧,复核 Vue2 源
`NimoOS-UI/src/components/Storage/raid/RaidDriveBay.vue:128-130` 确认原实现是
`this.selectedDisks = this.filteredDisks.filter(d => !isDiskAtRisk(d))` —— 作用域是**当前过滤视图**,
不是全量 `disks`。本期红线是逐字对齐 Vue2,故本次修正为按 Vue2 语义改回。

变更:
- `src/storage/components/RaidDriveBay.vue`:`selectAllHealthy()` 改用组件内已有的
  `filteredDisks` computed 替换 `props.disks`,语义为整体替换 selectedDisks(不与已选集合并),
  与 Vue2 逐字一致。
- `src/storage/components/RaidDriveBay.test.ts`:新增用例——先切到 SSD 过滤,再点
  `.rdb-select-all`,断言 emit 的 `update:modelValue` 只含健康 SSD 盘(`/dev/sda`),不含健康
  HDD 盘(`/dev/sdb`)。用既有 `disks` fixture(SSD healthy / HDD healthy / SSD 风险)区分全量
  vs 过滤视图两种实现下会给出不同结果的场景,复用文件已有的 `lastCall` helper。
- `docs/superpowers/plans/2026-07-27-vue3-migration-sp6-p4-raid-write.md`:§T3 Step3 描述里
  `selectAllHealthy` = `disks.filter(...)` 改为 `filteredDisks.filter(...)`,与实现和 Vue2 对齐。

验证:
- `pnpm exec vitest run src/storage/components/RaidDriveBay.test.ts` → 8 passed(含新增用例)。
- `pnpm exec vue-tsc --noEmit` → 无输出,退出码 0。
- `pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts` → 117 passed。

提交:`28b7669` `fix(storage): P4 T3 selectAllHealthy 对齐 Vue2 作用于过滤视图 + 补测`(分支 `sp6-storage`)。
