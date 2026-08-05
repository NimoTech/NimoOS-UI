# Task 10 报告:杂项收口

工作区:`/home/nimo/NimoTech/.sp7/NimoOS-New-UI`,分支 `sp7-photos`。

## 总览

四件事全部完成(三个真修 + 一个纯文档)。item 3 是本任务唯一有设计含量的一项,已按"店铺任务列表 owner = timeline.ts"的原则拆成 store 侧(5s 过期计时器)+ view 侧(去重守卫)两块。

发现两处**计划书与实测冲突**(均已按"代码为准"处理,详情见下):
1. item 1 的 live 调用点数——开工 prompt 说 3 处,协调者裁定说 1 处,**回源实测是 5 处**。
2. item 2 的两处新增兜底——回源发现它们在当前接线下**不可达**(候选池恒为已命名,详情见下)。

---

## Item 1:`isConflict` 词边界

**改动**:`src/photos/util/httpErrors.ts:15` 正则从 `/409/` 改为 `/\b409\b/`,与 `isNotFound`(`/\b404\b/`)对齐。同时重写了 `:18-26` 那段"刻意不同、收紧超范围、记账留后续"的旧注释——它已经不实(本次就是收紧了)。

**⚠️ 与计划书/协调者裁定的冲突(代码为准)**:
- 开工 prompt 说 3 处 live 调用点,协调者的任务说明说"我自己核实过,只有 1 处(`AlbumPickerDialog.vue:143`)"。
- 我用 `grep -rn "isConflict" src/` 回源核实,**实际是 5 处**,全部是可达的真实 catch 分支:
  - `src/photos/components/AlbumPickerDialog.vue:143`
  - `src/views/PhotosFavorites.vue:114`(收藏存为相册)
  - `src/views/PhotosAlbumDetail.vue:204`(相册改名)
  - `src/views/PhotosPersonDetail.vue:484`(人物详情建相册)
  - `src/views/PhotosAlbums.vue:145`(相册列表新建)
  - 逐一读取上下文确认全部是真实调用(非测试代码、非死分支)。
- 好消息:因为是共享 util,不管是 1 处还是 5 处,改一处正则对全部调用点同时生效,**功能修复不受这个计数错误影响**;唯一影响的是注释/commit message 里"影响范围"的表述,已按实测数字如实写。

**TDD**:
- RED:临时把正则改回 `/409/`,新增用例断言 `4090`/`1409` 不误判 → 跑
  `pnpm exec vitest run src/photos/util/__tests__/httpErrors.test.ts --reporter=verbose`
  → 1 条失败(`expected true to be false`),其余 5 条通过。
- GREEN:恢复 `/\b409\b/` → 6/6 通过,0 `[Vue warn]`。

---

## Item 2:`photosPersonMergedToast` 空名兜底

**改动**:
- `src/views/PhotosPeople.vue:335`:`targetName` → `targetName || t('photosPersonMergeAsSame')`。
- `src/views/PhotosPersonDetail.vue:420`:`target.name` → `target.name || t('photosPersonMergeAsSame')`。
两处都逐字复用已有兜底(`PhotosPeople.vue:266` 的 `intoName || t('photosPersonMergeAsSame')`)的表达式形状与 i18n 键,没有新造字符串,没有新 i18n 键。

**⚠️ 回源发现(代码为准,已在两处新加注释里登记)**:
- `PhotosPersonDetail.vue:184-188` 的 `mergeCandidates` 与 `PhotosPeople.vue:665` 的 `:candidates="people.named"` 都**只从已命名人物里取候选**(`namedOf` 保证 `name.trim() !== ''`)。这个事实其实已经被文件自己的"偏离登记 J"(`PhotosPersonDetail.vue:45-47`)记录过,只是针对的是 Vue2 旧式内联兜底,不是我这次加的。
- 结果:
  - `PhotosPersonDetail.vue:420` 的 `target = mergeTarget.value` 是点击候选时**按引用捕获**的对象,而不是按 id 重新查询;店内所有写操作(`patchPerson`/`fetchPeople`)都是整体替换数组元素而非原地改——**没有任何合法的 store 操作能在选中候选之后把这个引用的 `.name` 变空**。加上候选池本身恒非空名,这条兜底在当前接线下**可证不可达**,是纯防御性补齐,不是修复了一个真实可见的 bug。我没有为它写"命中"回归测试(写一个会命中的测试需要绕过组件的类型安全去手造一个不可能出现的 `Person` 对象,那是伪造覆盖率,没有写)。
  - `PhotosPeople.vue:332` 的 `targetName = people.personById(targetId)?.name` 则是**按 id 现查**(不是捕获引用),所以是可测的:点击候选前用 `people.patchPerson(id, { name: '' })` 把目标改名为空(模拟"确认前发生了名字变化"这类真实可能的并发场景,而不是伪造),再点击候选提交,能验证兜底确实生效。

**TDD**(仅对可达的那一处,`PhotosPeople.vue`):
- RED:先临时去掉 `|| t(...)`,新增用例 → 断言失败(`已合并到「」` vs 期望 `已合并到「同一个人」`)。
- GREEN:恢复兜底 → `pnpm exec vitest run src/views/__tests__/PhotosPeople.test.ts --reporter=verbose` → 57/57 通过。

**诚实声明**:`PhotosPersonDetail.vue:420` 那处只做了实现改动 + 代码注释登记不可达性,**没有写回归测试**——写不出一个不靠伪造就能命中它的测试。这是主动披露,不是遗漏。

---

## Item 3:P1 挂账——非 index 类型 done 任务 5s 过期 + 迟到重复 done 去重

### 定位结果(按要求逐一汇报坐标)

`grep -rn 'scheduleTaskRemove\|REMOVE_DONE_TASKS_BY_TYPE\|taskTimers\|doneCoalescer\|onTaskProgress' src/` 命中:
- `src/views/Photos.vue:41`(import `createTaskDoneCoalescer`)、`:150`(实例化)、`:160-171`(`onTaskProgress`,含"已知边界"注释)。
- `src/photos/util/taskDoneCoalescer.ts`(整份文件,`createTaskDoneCoalescer`)。
- **New-UI 侧此前没有任何 `scheduleTaskRemove`/`taskTimers`/`REMOVE_DONE_TASKS_BY_TYPE` 的对应实现**——`timeline.ts` 的 `ingestTaskBus`(改动前)只做合并/追加,完全没有过期移除的计时器逻辑。这与协调者"New-UI 侧坐标故意不给,怕误导"的说法一致:P1 确实只做了合并,没做过期清理,是真的挂账,不是我漏找。

Vue2 源(`src/store/modules/photos.js`)读取结果:
- `taskTimers`(模块级 Map,:8)+ `scheduleTaskRemove`(:50-58,按 id 去重的 `setTimeout`)。
- `_onTaskBus`(:1374-1407)的 `done` 分支:**⚠️ 与任务说明的"index 类型排除在 5s 过期之外"不完全一致——代码原文是**:先 `clearTimeout` 掉旧计时器;若 `payload.type === 'index' && state.tasks.some(t => t.type === 'face')`(index 的 done 事件晚于聚类开始才到达的反序情形),**立即**移除(不是"不移除",是"不等 5s、直接移除");否则(包括 index 在没有 face 任务时)**同样**走 `scheduleTaskRemove(payload.id, 5000, ...)`。也就是说 Vue2 源码层面 index 类型**并不是**结构性地被排除在 5s 计时器之外,只有"反序"这一个特殊分支立即摘除。
- 但 New-UI 这边,index 任务的收尾早就换了一条完全不同的机制:`timeline.ts:91-125` 的 `fetchIndexStatus` 做**电平触发**的 idle 对账(`pending===0 && queueLen===0 && 无在途 upload` 时清 index 任务),这套机制在 P7(远早于本任务)就已经落地并有测试覆盖。如果我把 Vue2 那种"index 也可以走 5s 计时器"照搬进来,会与已存在的 idle 对账变成两个都能摘除同一类任务的机制,违反 global-constraints 里"不建第二个任务列表源"的约束。**所以我的实现是:非 index 类型的 done 任务走新加的 5s 计时器;index 类型完全不接这个计时器,继续 100% 交给已有的 idle 对账**——这与任务说明的最终结论("index 由 idle 对账负责")一致,但我认为有必要标注 Vue2 源码本身的过期条件比说明里写的更复杂(帧内含反序特判),不是一句"index 排除"能完全概括的。已在 `timeline.ts:174-180` 的实现注释里如实写清楚这个差异。

**(b) 迟到重复 done 事件**:`src/views/Photos.vue:160-161` 的既有注释("已知边界——fetchIndexStatus 的 idle 对账会移除 index 任务,若其后迟到重复 done 事件会二次 toast")与协调者描述完全吻合,坐标就在 `onTaskProgress` 函数体(`:162-171`,改动前)。根因:`wasDone` 靠 `store.tasks.find(...).status === 'done'` 判断"是否已经宣布过"——任务一旦被 idle 对账从 `store.tasks` 里摘掉,`find` 返回 `undefined`,`wasDone` 变 `false`,迟到的重复 done 事件被误判成"第一次看到"从而二次 toast。

`src/photos/util/taskDoneCoalescer.ts` 读完确认:它只做"同一波多个任务完成事件合并成一条提示"的**按 type 去抖**,不做按 id 的"是否已宣布过"判断,**帮不上 (b)**,这与协调者的提醒一致。

### 落点与理由

- **(a) 5s 过期计时器 → 落在 `src/photos/stores/timeline.ts`(store 侧)**。理由:任务列表(`tasks` ref)本来就归这个 store 管,过期移除是对这份数据的又一种写操作,和已有的 `ingestTaskBus`/`fetchIndexStatus` 的 idle 对账是同一层次的"任务列表生命周期管理",放视图层会让"谁能改 tasks.value"分散到两个文件。实现:模块级 `_doneRemovalTimers: Map<id, timer>`(镜像 Vue2 的模块级 `taskTimers`),`ingestTaskBus` 里状态转为 `running` 时取消计时器、转为 `done` 且非 `index` 时调度 5s 后过滤掉该 id;`__resetForTest` 显式清空这个 Map(镜像已有的 `_pollTimer` 处理方式)。
- **(b) 去重守卫 → 落在 `src/views/Photos.vue`(view 侧,`onTaskProgress` 内)**。理由:这是"是否已经宣布过 toast"的状态,天然属于负责宣布(`doneCoalescer.push`)的调用方,而不是任务列表数据本身的属性——一个任务的"是否已被移出列表"和"是否已被用户看到过完成提示"是两件独立的事,前者是 (a) 该管的,后者应该独立于任务是否还在列表里持续有效。实现:`announcedTaskIds: Set<id>`,`done` 且未在集合中才 push 并记录;`running` 事件到达时从集合删除该 id(允许同一个 id 被复用于新一轮任务时重新宣布一次),与 (a) 的"running 取消计时器"是同一条重置信号,两侧逻辑对称但不共享状态(各自独立,没有建立新的耦合)。

**没有做**(超出 brief 范围,未做无关添加):Vue2 的 `error` 状态 10s 过期移除(`scheduleTaskRemove(payload.id, 10000, ...)`)——brief 只点名"非 index 类型的 done 任务",没提 error,New-UI 目前也没有 error 状态的任何处理,我没有顺手加,留给以后有需要时单独立票。

### TDD

- **(a) `timeline.ts`**:
  - RED:新增 4 条用例(非 index 5s 边界 4999/5001ms、index 不过期、running 取消计时器、`__resetForTest` 清计时器)。跑 `pnpm exec vitest run src/photos/stores/__tests__/timeline.test.ts --reporter=verbose` → 1 条红(核心断言 `toHaveLength(0)` 收到 1),其余 3 条因为"什么都没做也刚好符合预期"而绿(正常,不是覆盖力问题,核心断言已经证实缺陷存在)。
  - GREEN:实现后 24/24 全绿。
- **(b) `Photos.vue`**:
  - RED:新增用例复现"index 任务被 idle 对账摘除后又收到迟到重复 done",断言 `showSpy` 仍是 1 次 → 实际收到 2 次,红。
  - GREEN:实现 `announcedTaskIds` 后,`pnpm exec vitest run src/views/__tests__/Photos.integration.test.ts --reporter=verbose` → 23/23 全绿。

### 变异验证(item 3 两半都做了)

1. **去掉 index 类型排除**(`task.type !== 'index'` → 恒真):`vitest run ... -t "index 类型的 done 任务不走"` → 断言从"仍是 1"变成"收到 0"(计时器把 index 任务也摘了),**变红确认**。改回后重新跑 24/24 绿,`git diff` 确认代码已还原。
2. **去掉去重守卫**(`!announcedTaskIds.has(...)` → 恒真):`vitest run ... -t "迟到的重复 done"` → 断言从"1 次"变成"2 次",**变红确认**。改回后 23/23 绿,`git diff` 确认已还原。

---

## Item 4:三条只登记不改

1. **人物资产 300 上限**:`src/photos/composables/usePersonDetail.ts:9-12`。原本就有一行简短注释("Vue2 :741 硬编码 limit:300/offset:0,无分页。照搬")——我在下面追加两行,明确写出"超过 300 张详情页只显示前 300 张"这个用户可见后果,并打上 P8a-T10 标签便于台账追溯。没有改 `ASSET_LIMIT` 或任何行为。
2. **`usePlaceAssets.months` 死导出**:`src/photos/composables/usePlaceAssets.ts:67`。这里此前**完全没有**标注这是死导出(只有消费方 `PhotosPlaceAssets.vue:130-139` 单方面解释了"为什么不读它")——补了一段注释,明确"唯一消费方已经不读它了,按禁止无关重构保留,以后改这个组合式函数前先 grep 确认还有没有消费方",避免未来读者对着这个字段猜它还在被用。
3. **`places` 维度未端到端贯通**:`src/views/PhotosPlaceAssets.vue:127`(`exifFilter`/`PLACE_CHIP_KEYS` 声明处)。这里此前已经有非常详尽的说明(D19 裁决 + "终审 M1" 那段,`:130-145`),已经把"UI 不渲染位置胶囊 + gridMonths 只投影 years/cameras 两个键给 applyExifFilters"讲得很清楚。我在声明行上方加了 4 行摘要式登记(带 P8a-T10 标签),方便台账/收尾检索,没有改动下面已有的详细说明,也没有改任何逻辑。
   - 顺带核实:`applyExifFilters`/`matchesExifFilters`(`src/photos/util/photosFilterUtils.ts:33-40`)的 `places` 判定逻辑本身是**完整实现**的,且在时间线主页(`src/views/Photos.vue`,`PhotosFilterBar` 用默认 `chipKeys` 三项全开)是**完全贯通**的——"未贯通"专指跳库页(`PhotosPlaceAssets.vue`)这一个页面,是 D19 的刻意设计,不是逻辑缺陷。

以上三条**均未改变任何运行时行为**(只加注释),`vue-tsc --noEmit` 与相关测试全绿确认无副作用。

---

## 测试证据汇总

| 文件 | 命令 | 结果 | `[Vue warn]` |
|---|---|---|---|
| `src/photos/util/__tests__/httpErrors.test.ts` | `vitest run ... --reporter=verbose` | 6/6 | 0 |
| `src/photos/stores/__tests__/timeline.test.ts` | 同上 | 24/24 | 0(纯 store 测试,无 Vue 组件) |
| `src/views/__tests__/Photos.integration.test.ts` | 同上 | 23/23 | 0 |
| `src/views/__tests__/PhotosPeople.test.ts` | 同上 | 57/57 | 413(**全部是既有遗留 `createI18n` 重复注册告警,与本次改动无关**——该文件本就用模块级 `createI18n(...)`,不是本任务引入;我新增的那 1 条用例贡献的份额与其它 56 条同款,未额外恶化) |
| `src/views/__tests__/PhotosPersonDetail.test.ts` | 同上 | 全部通过(182 测试合并跑时的一部分) | 504(同上,既有遗留 `createI18n` 重复注册,本次未在这个文件加新用例,数字与改动前一致) |
| `src/views/__tests__/PhotosPlaceAssets.test.ts` | 同上 | 全部通过 | 未见新增(仅有 svc.getConfig 缺失的 console.error 噪音,非 Vue warn,pre-existing) |
| `src/photos/components/__tests__/PhotosFilterBar.test.ts` | 同上 | 全部通过 | — |
| `src/photos/composables/__tests__/usePersonDetail.test.ts` | 同上 | 全部通过(300 上限用例仍按 `('7',300,0)` 断言,未受影响) | — |
| `src/photos/composables/__tests__/usePlaceAssets.test.ts` | 同上 | 13/13 | — |
| 合并跑 5 个核心文件 | `vitest run <5 files> --reporter=verbose` | 182/182 | 汇总同上 |
| `pnpm exec vue-tsc --noEmit` | — | 无输出(通过) | — |

**未跑全量 ~5800 例套件**——按约定只跑触及文件 + 类型检查,全量留给 T11 收尾。

---

## 文件改动清单

- `src/photos/util/httpErrors.ts`(功能 + 注释)
- `src/photos/util/__tests__/httpErrors.test.ts`(新增用例)
- `src/views/PhotosPeople.vue`(功能 + 注释)
- `src/views/PhotosPersonDetail.vue`(功能 + 注释)
- `src/views/__tests__/PhotosPeople.test.ts`(新增用例)
- `src/photos/stores/timeline.ts`(功能 + 注释)
- `src/photos/stores/__tests__/timeline.test.ts`(新增用例)
- `src/views/Photos.vue`(功能 + 注释)
- `src/views/__tests__/Photos.integration.test.ts`(新增用例)
- `src/photos/composables/usePersonDetail.ts`(注释,无行为改动)
- `src/photos/composables/usePlaceAssets.ts`(注释,无行为改动)
- `src/views/PhotosPlaceAssets.vue`(注释,无行为改动)

---

## 自查(完整性 / 质量 / 纪律 / 测试)

- **完整性**:四件事全做;item 3 两半(过期 + 去重)都做了,都有独立的变异验证。
- **质量**:item 3 的落点(store 管数据生命周期、view 管"是否已宣布")有明确分工理由,没有把两件不同性质的状态混进同一个文件。
- **纪律(YAGNI/无关重构)**:没建第二个 poller,没碰 error 状态的 10s 过期(brief 没要求),item 4 三处只加注释未碰任何逻辑/接口,没加新 i18n 键。
- **测试**:计时器类行为的两个测试文件都断言了边界两侧(4999ms/+2ms;运行状态复活取消计时器)。item 2 的 `PhotosPersonDetail.vue` 那处诚实标注"不可达、未写命中测试",没有伪造覆盖率。

## 主要发现/偏离(需要用户知道)

1. **item 1 的 live 调用点是 5 处,不是协调者说的 1 处,也不是开工 prompt 说的 3 处**——纯计数问题,修复本身不受影响,但如果后续有其它任务依赖"isConflict 只有 N 处调用"这个数字做决策,请用 5 这个实测值。
2. **item 2 的两处新增兜底(`PhotosPeople.vue:332` 与 `PhotosPersonDetail.vue:420`)在当前接线下都是防御性代码,真实可达性只有 `PhotosPeople.vue` 那处能被合理地测到**(`PhotosPersonDetail.vue` 那处的候选引用捕获机制让它结构性不可达)。功能改动本身无害,但请知悉这不是在修一个当前用户能看到的真实空书名号 bug,而是防未来接线变化时悄悄回归。
3. **item 3 的 Vue2 源码比任务说明描述的更复杂**:index 类型在 Vue2 里并非结构性排除在 5s 计时器之外,只是"聚类已开始"这一反序场景走立即移除;New-UI 选择让 index 完全交给已有的 idle 对账(不接新计时器),是为了不产生"任务列表两个真相源"的架构问题,不是逐字照抄 Vue2 条件。已在代码注释里写清楚这个取舍。

台账目录未删除,报告已写入本文件。
