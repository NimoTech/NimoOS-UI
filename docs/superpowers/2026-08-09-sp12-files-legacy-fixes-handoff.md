# SP12 并行批次交接 —— Files 区三条遗留缺陷（F17 / F11 / F12）

> 2026-08-09。分支 `sp12-files-fixes`，隔离在 worktree
> `.claude/worktrees/sp12-files-fixes`。设计文档：
> `docs/superpowers/specs/2026-08-09-sp12-files-legacy-fixes-design.md`。
> 本文档写于 Task 6（收尾门 + 交接文档），HEAD 为 `8fbecf7`。

**⚠️ 收尾门未全绿**：六道门里 Gate 2（全量测试）与 Gate 5（开源导出闸）因同一根因各命中
一次失败——`sp12-files-fixes` 自身新增的一个测试文件注释里写了两次 "photo"，撞上开源导出
的软禁词守卫。这是本批次（Task 5）留下的真实缺口，不是环境噪音，也不是本任务允许现场修的
东西（Global Constraints 规定 Task 6 不改源码）。详情见下方「三、收尾门实测数字」。

---

## 一、三条改了什么

### F17 —— 侧栏 / 面包屑跟着文件列表滚走

**用户能看到的变化**：进 `/files`，文件多到需要滚动时，以前左侧栏（收藏/磁盘/共享/互传）
和顶部面包屑会跟着列表内容一起往下滚出屏幕，侧栏自己的滚动条永远不出现，收藏项一多就够
不着。改完之后侧栏与面包屑钉在原位不动，只有文件列表自己滚，侧栏收藏项多时侧栏自己出现
滚动条、能滚到底。

**代码坐标**：`src/views/Files.vue` 的 `<style scoped>`：
- `.files-layout`（约 `:687`）：`min-height: 100%` → `height: 100%`
- `.files-main`（同处附近）：新增 `min-height: 0`（打通 flex 收缩链，否则子元素撑破父容器，
  封顶等于白封）
- `.files-listwrap`（约 `:695`）：`min-height: 200px` → `overflow-y: auto` + `min-height: 0`
  （接管滚动）

防复发闸：`src/views/__tests__/filesLayoutHeightCap.test.ts`（正向断言三条规则都在，反向
断言不许回退成 `min-height: 100%`，源文本字符串匹配，读盘用 `node:fs`）。

提交：`70c24b0`。

### F11 —— 右键一个未选中的文件，动作却作用于当前选区

**用户能看到的变化**：此前选中了 B、C 两项，右键点未选中的 A，选「复制」，粘贴出来的却是
B、C；删除/剪切/下载同理。菜单本身还按选区条数显示成多选态，界面上没有任何提示——是一处
迁移回归（Vue2 原版行为是"被点项不在选区内就只作用于被点项"，New-UI 两处平行走样成"选区非
空即赢"）。改完之后：选中 B、C 右键点 A → 菜单呈单项态，动作只作用于 A；右键点选区内的 B →
菜单呈多选态，动作作用于 B、C。

**代码坐标**：
- 新建纯函数 `src/files/util/contextTarget.ts`：`contextTargets(entry, selected)`，
  复刻 Vue2 `ContextMenu.vue:271-279` 的判据（选区多于一项且被点项在选区内才用选区，否则
  只用被点项）
- `src/views/Files.vue`：`selectedOr` 换成基于 `contextTargets` 的 `ctxTargets`，
  `onCtxAction` 的 `copy`/`cut`/`download`/`delete`/`share` 各分支统一取它的返回值
  （`delete` 原本是内联的第二处实现，一并收编）
- `src/files/components/FileContextMenu.vue`：`selectedCount` prop 改喂**有效目标集**的
  长度，不再是原始选区条数

提交：`4592db2`（纯函数）、`69d8fcf`（测试描述译英）、`e22b106`（Files.vue 接线）、
`ce85005`（菜单 prop 断言改读子组件实收值而非父组件计算属性）。

### F12 —— 多选批量共享不门控「已共享」

**用户能看到的变化**：多选一批文件夹批量共享，其中如果有已经共享过的，以前整批会因后端
`SHARE_ALREADY_EXISTS` 报错而全部失败。改完之后：有可共享的、也有已共享的 → 只共享未共享
的，toast 追加"已跳过 N 个已共享项"；全部都已共享 → 不发请求，toast 直接说明原因；全部可
共享 → 行为不变。

**代码坐标**：
- 新建 `src/files/util/shareGate.ts`：`isAlreadyShared(entry)` / `shareableFolders(entries)`
  → `{ targets, skipped }`，与单项右键菜单的门控**共用**同一判定
- `src/files/components/FileContextMenu.vue:22`：`alreadyShared` 改为调用
  `isAlreadyShared`（消除与批量分支曾经存在的判定不对称）
- `src/views/Files.vue`：`onShare` 改用 `shareableFolders(ctxTargets(entry))` 分流
- 新增 i18n 键 `filesShareSkippedShared` / `filesShareAllAlreadyShared`，
  `zh_cn.base.ts` + `en_us.base.ts` 两处都加

提交：`aa17ea1`（门控辅助函数）、`89ff85b`（Files.vue 接线 + i18n）。

---

## 二、F14 判为不成立的取证链（照抄 spec §0）

清单原文说 `deleteConnection` / `umountUsb` 不 unwrap 响应信封 ⇒ 错误信封被当成成功 ⇒
删除网络连接、弹出 U 盘失败时界面静默显示成功。**这条诊断的前提不存在。**

| 端点 | 后端实际返回 |
|---|---|
| `DELETE /v1/samba/connections/:id`（`NimoOS/route/v1/samba.go:212-238`） | 三条失败分支 = HTTP **400 / 500 / 500**（`common_err.CLIENT_ERROR=400`、`SERVICE_ERROR=500`，见 `NimoOS-Common/utils/common_err/e.go:5-6`）；成功才 200 |
| `DELETE /v1/disks/usb`（`NimoOS-LocalStorage/route/v1/usb.go:128-143`） | 三条失败分支 = `http.StatusBadRequest` / `StatusBadRequest` / `StatusInternalServerError`；成功才 200 |

而 `packages/service/src/http.ts:41` 的 `validateStatus` 是默认的 2xx-only ⇒ axios 在
4xx/5xx 上 reject ⇒ `src/files/stores/mounts.ts:61,72` 已有的 `catch` 会触发、toast 会弹。
**这两个端点从不返回「HTTP 200 + 错误信封」**，清单假设的那个形状不存在。

残留的只是一条加固项（万一后端将来改成信封报错就会静默通过），机主 2026-08-09 拍板
**不做**。清单那条应改判为「不成立」，下一轮审计免于重复开工。

---

## 三、收尾门实测数字（Step 1-6 真实输出）

| # | 门 | 命令 | 结果 |
|---|---|---|---|
| 1 | 类型检查 | `pnpm exec vue-tsc --noEmit` | **PASS** — exit 0，零输出 |
| 2 | 全量测试 | `pnpm test` | **1 个测试文件失败**（见下）。`Test Files 1 failed \| 658 passed (659)`；`Tests 1 failed \| 10509 passed (10510)`。Duration 164.68s |
| 3 | i18n parity | `pnpm exec vitest run src/i18n/parity.test.ts` | **PASS** — `Test Files 1 passed (1)`；`Tests 9 passed (9)` |
| 4 | 构建 | `pnpm build` | **PASS** — exit 0，`✓ built in 17.30s`（唯一提示是预置的 >500kB chunk 体积告警，非本批次引入，不是错误） |
| 5 | 开源导出闸 | `node oss/export.mjs --out /tmp/claude-1000/oss-check --no-commit --allow-dirty-oss` | **FAIL** — exit 1，同一根因（见下） |
| 6 | 与 sp12-plan-b 合并预演 | `git merge-tree --write-tree sp12-files-fixes sp12-plan-b` | **命令本身报错**（分支已不存在，见下方「合并纪律」的说明） |

### Gate 2 / Gate 5 的失败根因（同一处，一次说清）

`pnpm test` 里唯一红的测试文件是 `oss/tree.test.mjs`，具体用例
`泄漏守卫 > 不带 --skip-guard 也能跑通`；`node oss/export.mjs` 单独跑也是同一失败。

实测输出（两次一致）：

```
✗ src/views/__tests__/filesLayoutHeightCap.test.ts:2 [photo] // same origin and logic as photosLayoutHeightCap.test.ts in the photos area,
✗ src/views/__tests__/filesLayoutHeightCap.test.ts:11 [photo] // Unlike the photos area: photos had 11 pages each with an inner scroll container already,
[oss] 失败:泄漏守卫命中 2 处,一个字节都不落盘。修法只有两条:真泄漏就补剥离清单;误报就往 forbidden.mjs 加**精确白名单** —— 禁止放宽词表。
```

根因：本批次 Task 5 新增的 `src/views/__tests__/filesLayoutHeightCap.test.ts`
（提交 `70c24b0`）的头部注释里用 "photo" 一词类比相册区同名守卫
（`photosLayoutHeightCap.test.ts`）。开源导出对 "photo" 是软禁词——`oss/forbidden.mjs`
的 `SOFT` 列表要求每一处合法出现都按「文件 + 整行精确匹配」逐条登记白名单（该文件里已有
40+ 条这样的先例，例如 `dropEntries.test.ts`、`ThemeToggle.vue` 等），而这两行新注释从未
补登记。

**这是本批次（Task 5）引入的真实缺口，不是环境噪音**——Task 5 当时大概率只跑了该文件自身
的 vitest，没有跑到会触发开源导出闸的路径，直到 Task 6 的全量收尾门才第一次暴露。

**按本任务的 Global Constraints，此处不现场修**（不改源码）。留给合并前处理，两条候选修法
（均遵循 `forbidden.mjs` 里的既有约定，不放宽词表）：
1. 把这两行注释改写成不含 "photo" 字面量的说法（例如把 `photosLayoutHeightCap.test.ts`
   写成"相册区同名守卫"这类不含该词的引用）；或
2. 在 `oss/forbidden.mjs` 的 `photo` 词条 `allow` 数组里，为
   `src/views/__tests__/filesLayoutHeightCap.test.ts` 的这两行加 `exactLine` 精确白名单
   （做法可直接抄同文件里已有的十几个先例）。

方案 1 更干净（不用碰 `forbidden.mjs`），推荐优先采用。

### Gate 6 的说明

按 brief 字面执行 `git merge-tree --write-tree sp12-files-fixes sp12-plan-b`：

```
exit=1
merge-tree: sp12-plan-b - not something we can merge
```

**`sp12-plan-b` 分支已经不存在**——查 `git log --all --oneline` 发现 master 上已有提交
`9100418 Merge sp12-plan-b: same-name conflict dialog, upload conflicts and folder merge`
（2026-08-09 13:15:27，即本任务开工前后），说明 plan-b 的 T1/T7/T8 已经合入 master，
分支与其 worktree 按本仓惯例被清理掉了。brief 撰写时 plan-b 仍在进行中的前提已经不成立。

为了不让 Gate 6 白跑，额外做了一次等价的实质性检查——`sp12-files-fixes` 与**当前
master**（已经包含 plan-b 的改动）的合并预演：

```bash
git merge-tree --write-tree sp12-files-fixes master
```
```
exit=0
dc2ecbcf2e2bb661bdd0bf54cc35d478af2e8769
```

exit=0 且单行 tree OID ⇒ **无冲突**。spec §7 记录的重叠面（`Files.vue` 与两个 i18n
base 文件，plan-b 的 hunk 落在 16-31/204-245/492-514/621-639，本期落在
86-145/687-695）在 plan-b 已合入 master 之后依然验证为不相交。

### 已知无害噪音（未追查，按 brief 要求如实记录）

- 全量测试里出现 jsdom `Not implemented: navigation` 警告，来自不相关的相册区测试
  （`src/photos/stores/__tests__/favorites.test.ts` 的 `exportZip`）
- `/tmp/nimoos-www-xxxxx 不存在或当前用户不可写` 报错同样来自上述相册测试的 `exportZip`
  分支，与本批次无关
- 未在孤立运行下复测 `DesktopContextMenu.test.ts`（已知在全量套件里通过，单独跑才会因
  reka-ui 测试隔离问题变红）——本次是全量跑，未受影响

---

## 四、真机验收清单（照抄 spec §5，一步不删）

1. 进 `/files`，找一个文件多到需要滚动的目录，向下滚 —— 左侧栏与面包屑钉住不动
2. 侧栏收藏项加到超过一屏 —— 侧栏自己出现滚动条、能滚到底
3. **网格视图**下滚到很深处 —— 不出现空白区（虚拟滚动窗口没算错）
4. **网格视图**在列表下方空白处起框选，拖过若干卡片 —— 框线跟手、选中项与框覆盖范围一致
5. 滚到中途再起框选 —— 同上（这一步专查滚动容器换了之后的坐标系）
6. 选中 B、C 两项，右键点未选中的 A → 菜单呈**单项**态（有重命名/复制路径），点「复制」再粘贴 → 粘出来的是 **A**
7. 选中 B、C，右键点 **B**（在选区内）→ 菜单呈多选态，点复制 → 粘出 B、C
8. 选中若干文件夹，其中 2 个已共享 → 点共享，只有未共享的被共享，toast 说明跳过了 2 个
9. 选中的文件夹**全部**已共享 → 点共享，不发请求，toast 说明都已共享
10. 浅色 / 深色主题各看一遍第 1、3 步（布局与滚动条）

---

## 五、未做的相邻项

- **F10（多选删除 all-or-nothing）** —— 与 F12 同属「批量操作遇不合格成员」语义。机主
  2026-08-09 明确本期只做三条，F10 留给后续期。本期在 F12 上定下的处理方式
  （`shareableFolders` 式的「过滤 + 告知跳过数」）可以直接复用到删除路径上，不需要重新设计
  语义，只需要照抄模式接一遍线。
- **F3 / F4** —— 仍在 `NimoOS-UI/docs/vue3-pending/01-文件区-SP4.md` 清单上，本期未涉及，
  未做任何取证或改动。

### 本批次评审中被判定推迟的小项（未丢失，逐条列出）

1. 测试文件各自建 `createI18n`，与 `vitest.setup.ts` 已全局注册的重复，产生
   `[Vue warn]` 噪音——本仓库范围性存量问题（200+ 文件），本批次未引入也未清理。
2. `Files.vue` 里 `SelectionToolbar` 的 `@copy`/`@cut`/`@download` 处理器仍内联
   `files.entries.filter(e => files.isSelected(e.path))`，没有改读新增的 `selectedEntries`
   计算属性。不是正确性问题——这几条路径从不带被点项，F11 修的单/多选歧义在这里不适用——
   只是遗留的 DRY 机会。
3. 若 `shares.create()` 在部分跳过的批次上失败，"跳过 N 个"的 toast 不会触发，用户只会看到
   通用失败 toast，丢失跳过上下文。
4. `src/files/util/protect.ts:9` 的 `canOperate` 门控自带一份字面量
   `extensions?.share?.shared === 'true'` 比较，是「已共享」语义未来收紧时需要记住的第二处。
5. F17 防复发闸按 CSS 规则整行字符串精确匹配，无害的格式重排会打红它（与相册区同款闸的
   已知取舍一致）。
6. F17 的闸**没有**锁 `.files-listwrap` 的 `min-height: 0`——只锁了 `overflow-y: auto`
   存在、`min-height: 200px` 消失。以后如果这条声明被误删，会在更深一层静默复发
   flex-burst 问题，闸抓不到。

---

## 六、合并纪律

- **文件重叠面**：spec §7 记录的重叠只有 `src/views/Files.vue` 与两个 i18n base 文件。
  plan-b 的 hunk 落在 `Files.vue` 的 16-31 / 204-245 / 492-514 / 621-639，本期落在
  86-145（F11/F12）与 687-695（F17），互不相交。
- **现状变化**：`sp12-plan-b` 在本任务执行期间已经合入 master（提交 `9100418`），分支与
  worktree 已按惯例清理。所以 brief 里"与 plan-b 并行"的说法目前已经变成"本分支是后合入
  master 的一方"。
- **Gate 6 实测结果**：`git merge-tree --write-tree sp12-files-fixes master` → exit 0，
  单行 tree OID `dc2ecbcf2e2bb661bdd0bf54cc35d478af2e8769` ⇒ 与当前 master（已含 plan-b）
  仍然无冲突。
- **合入前必须先处理 Gate 5 的缺口**：`filesLayoutHeightCap.test.ts` 里那两行含 "photo"
  的注释必须先按上文两条候选修法之一处理掉，否则合入 master 之后开源导出闸在 master 上
  会是红的（`master` 目前是绿的，这个缺口完全出自 `sp12-files-fixes` 自身，会随合并带
  进去）。
- **后合的一方必须在合并结果上重跑全套门，不能拿各自分支上的绿当数**——这条约束依然成立，
  且需要额外注意：Gate 2/5 在 `sp12-files-fixes` 分支上现在不是绿的，合并到 master 后
  第一件事就是把这个缺口修掉再重新跑全套门，不能把"master 之前是绿的"当成合并后也绿的
  证据。
