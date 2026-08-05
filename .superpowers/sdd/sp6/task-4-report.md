# Task 4 报告:RaidMatrix(级别对比矩阵主体,故障模拟器推迟)

> Note: 本文件此前存放的是另一子计划里重复编号的 "Task 4"(RaidCard.vue,已于
> commit `55ad6b7` 单独提交、与本任务无关)——现覆盖为当前 P4 Task 4
> (RaidMatrix.vue,矩阵主体)的报告。

## Status
Done — TDD 全绿,vue-tsc 零错,已 commit。

## Commit
`e86fe62be9851b10896a5459debbe6ab88fb2825` — `feat(storage): RAID 级别对比矩阵主体(P4 T4,故障模拟器推迟)`

文件:
- `src/storage/components/RaidMatrix.vue`(新建)
- `src/storage/components/RaidMatrix.test.ts`(新建)
- `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts`(新增 raidMatrix* 行标签键 + raidLevel{0,1,5,6,10}Usecase 键,双写)

## TDD 过程
1. 先写 brief 给定的 3 例测试(`.at(-1)` 按仓库既有约定换成 `lastCall` helper,与
   `RaidDriveBay.test.ts` 同款,规避 ES2020 lib 下 vue-tsc TS2550)。
2. `pnpm exec vitest run src/storage/components/RaidMatrix.test.ts` → RED
   (`RaidMatrix.vue` 不存在,import 解析失败)。
3. 实现 `RaidMatrix.vue`:9 行(Layout/Min drives/Survives/Capacity/Read/Write/
   Cost/Best for/Actions) × 5 列(RAID_LEVELS 的 0/1/5/6/10),对照 Vue2 源
   `:12-121` 逐段迁移;不迁 legend、recommendedLevel 徽章、`:123-200` 故障模拟器
   modal 及 `openModal/failDrive/modalStatus/rebuildAll/resetModal/survival`
   全部代码,表头/单元格不挂点击。
4. 结果:`.rm-col` 用作每列的表头单元格(5 个,天然对应"每列"契约),`.rm-select`/
   `.rm-details` 各 5 个 Actions 按钮。`.rm-simulator` 不存在,文本不含
   "failure simulator"。
5. 全量 `pnpm exec vitest run` → 238 files / 1400 tests 全绿(含 color-guard 与
   parity.test.ts)。
6. `pnpm exec vue-tsc --noEmit` → 零错误。
7. 按 brief Step 5 提交。

## 测试结论
一行:`RaidMatrix.test.ts` 3/3 通过;全仓库 1400/1400 通过;vue-tsc 0 错误。

## 关键实现决策
- Props/emits 严格按契约:`{ diskCount, sizeBytes, selectedLevel }` /
  `update:selectedLevel(id)` + `details(id)`。
- 容量计算改用 `lv.capacity(diskCount, sizeBytes)`(sizeBytes 是调用方已算好的
  单盘有效容量),比 Vue2 的 `effectiveCap(selectedDisks)` 更简单,契约本就没有
  传盘数组。
- 容错(Survives)行复用先前 Task 已存在的 `raidLevel{id}Tolerance` i18n 键
  (0/1/5/6/10 五个 id 全覆盖,未再新增);Best for 行新增 `raidLevel{id}Usecase`
  键,与既有 `raidLevel{id}Desc` 键同一命名前缀/id 覆盖模式对齐。
- Read/Write/Cost 三行均为 5 段 pip,填充数取 `lv.read`/`lv.write`/`lv.cost`;
  未复刻 Vue2 里给 read/write 单独加"good"色调的差异化着色(brief 未要求,统一用
  `--accent` 填充/`--nrm-bg` 空档,避免无依据造 token)。
- Layout 磁盘条角色配色按 brief 指定:data→`--accent`、mirror→`--sem-fg`、
  parity→`--dem-fg`、parity2→`--remove-fg`,均为仓库已有 token,未新增。
- 选中列高亮用 `--accent-soft`(已有 token);`isAvailable`/`diskLayout` 逻辑
  逐字对齐 Vue2 源(RAID 10 需 diskCount>=4 且为偶数)。
- 未迁移故障模拟器相关"Needs N+"提示文案(Vue2 有,本次决策 2 范围外 & brief
  附录 B 未列出对应键),Select 按钮改为纯 `disabled` 属性控制不可用态,无额外
  文案。

## Concerns
- `.rm-col` 的语义是"每级别的表头单元格"而非"该级别全部 9 行的包裹容器"——两种
  解读都能满足 `findAll('.rm-col')).toHaveLength(5)`,选择前者是为了用最简单的
  CSS Grid(单层、行优先渲染,贴近 Vue2 原结构)实现,避免 `display:contents`
  分组包裹带来的对齐复杂度。如果后续任务/评审期望 `.rm-col` 是整列容器,需要
  确认后再调整结构。
- Best for(usecase)文案的中文翻译是本次新增(Vue2/raidLevels.ts 里 usecase
  字段本身是英文常量),已做简体中文翻译,但未经产品/文案侧校对,后续如有正式
  文案应替换。
- 未接入任何父组件(如 CreateStorageDialog)——brief 范围仅要求组件本身,未要求
  接线;`RaidMatrix` 目前是孤立组件,尚未被任何页面引用。
