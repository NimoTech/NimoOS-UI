# SP12 并行批次交接 —— Files 区三条遗留缺陷（F17 / F11 / F12）

> 2026-08-09。分支 `sp12-files-fixes`，隔离在 worktree
> `.claude/worktrees/sp12-files-fixes`。设计文档：
> `docs/superpowers/specs/2026-08-09-sp12-files-legacy-fixes-design.md`。
> 本文档写于 Task 6（收尾门 + 交接文档），首次成文时 HEAD 为 `8fbecf7`；
> 六道门里两道红（Gate 2/5）经 Task 5 实现者补一个改注释的提交（`3080275`）修复后，
> 于 HEAD `3080275` 补验全部六道门，本次修订反映的是补验后的状态。

**六道门现状：全绿**。首次跑收尾门时 Gate 2（全量测试）与 Gate 5（开源导出闸）因同一根因
各命中一次失败——`sp12-files-fixes` 自身新增的一个测试文件注释里两次提到 "photo"，撞上
开源导出的软禁词守卫。这是本批次（Task 5）留下的真实缺口，当时按 Global Constraints
未在 Task 6 里现场修（不改源码），只如实记录、留给合并前处理。Task 5 实现者随后用**改写
注释措辞**（不是加白名单）把它修掉了，六道门在新 HEAD 上全部补验通过。取证链与教训见下方
「三、收尾门实测数字」。

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

提交：`70c24b0`；`3080275`（该闸的头部注释改写，见「三、收尾门实测数字」的教训小节，
不改断言、不改 CSS）。

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

## 三、收尾门实测数字（Step 1-6 真实输出，HEAD `3080275`）

| # | 门 | 命令 | 结果 |
|---|---|---|---|
| 1 | 类型检查 | `pnpm exec vue-tsc --noEmit` | **PASS** — exit 0，零输出（在 `3080275` 重新单独确认过；注释改动不影响类型检查，但没有拿"不应该受影响"当证据，是实际重跑的结果） |
| 2 | 全量测试 | `pnpm test`（前台，167s） | **PASS** — `Test Files 659 passed (659)`；`Tests 10510 passed (10510)`，零失败 |
| 3 | i18n parity | `pnpm exec vitest run src/i18n/parity.test.ts` | **PASS** — `Test Files 1 passed (1)`；`Tests 9 passed (9)`（与首次跑一致，未受影响） |
| 4 | 构建 | `pnpm build` | **PASS** — exit 0，`✓ built in 16.80s`（唯一提示仍是预置的 >500kB chunk 体积告警，非本批次引入，不是错误；在 `3080275` 重新单独确认过） |
| 5 | 开源导出闸 | `pnpm exec vitest run oss/` | **PASS** — `Test Files 6 passed (6)`；`Tests 141 passed (141)` |
| 6 | 与 `sp12-plan-b` 的重叠面检查 | `git merge-tree --write-tree sp12-files-fixes master`（对象已改为 master，理由见下） | **PASS** — exit 0，单行 tree OID `c9338f2f608d21a8978b5e1531e75dc257bd53f4` ⇒ 无冲突 |

### Gate 2 / Gate 5 首次跑时的失败，及修复方式（教训：可迁移的经验，别丢）

首次跑收尾门时（HEAD `8fbecf7`），`pnpm test` 里唯一红的测试文件是 `oss/tree.test.mjs`，
具体用例 `泄漏守卫 > 不带 --skip-guard 也能跑通`；`node oss/export.mjs` 单独跑也是同一
失败。命中：

```
✗ src/views/__tests__/filesLayoutHeightCap.test.ts:2 [photo] // same origin and logic as photosLayoutHeightCap.test.ts in the photos area,
✗ src/views/__tests__/filesLayoutHeightCap.test.ts:11 [photo] // Unlike the photos area: photos had 11 pages each with an inner scroll container already,
```

根因：本批次 Task 5 新增的 `src/views/__tests__/filesLayoutHeightCap.test.ts`
（提交 `70c24b0`）的头部注释里用 "photo" 一词类比相册区同名守卫文件
（`photosLayoutHeightCap.test.ts`），还描述了它"11 个页面"这个细节。这是本批次
（Task 5）引入的真实缺口，不是环境噪音——Task 5 当时大概率只跑了该文件自身的
vitest，没有跑到会触发开源导出闸的路径，直到 Task 6 的全量收尾门才第一次暴露。

Task 5 实现者用提交 `3080275`（"reword layout-cap guard comments to drop cross-area
reference"）修复：**只改了注释措辞，断言与 CSS 一字未动**——技术内容（双向检查、为什么
三条 CSS 规则是一个整体、jsdom 的局限、为什么要用 `node:fs`）原样保留，只是不再点名
"photos 区" 或该区的任何文件。

**为什么是改写措辞，而不是像其余 40+ 条先例那样往 `oss/forbidden.mjs` 加一条精确白名单**
——这是本条真正该被记住、可迁移到别处的教训：`forbidden.mjs` 里现存的每一条 `photo` 白
名单，命中的都是**偶然的字面碰撞**（用户路径 `/DATA/Photos`、测试夹具文件名
`photo.jpg`、大小写敏感性测试的关键字表……），词面上出现 "photo" 但语义上跟相册 app 毫无
关系。而这次的两行注释不是偶然碰撞，是**真的在跨区引用一个会被开源导出整个剥离掉的文件**
——相册区在导出树里根本不存在，这条引用对着一个开源读者打开就是**悬空引用**（指向一个不
存在的文件、描述一个读者验证不了的细节）。往 `forbidden.mjs` 加白名单只会把这个真实缺陷
盖住，让守卫对着一个货真价实的问题装哑巴；改写措辞才是对症的修法。**一条通用规律**：
**守卫注释里只要指向一个会被剥离的区域，就会触发泄漏守卫——这不是误报，是该被修的信号，
遇到同类命中先检查是不是这一种，再决定改写还是加白名单。**

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
master**（已经包含 plan-b 的改动）的合并预演。这次预演跑了两遍：一遍在本分支修复
Gate 2/5 之前（HEAD `8fbecf7` 对 master `9100418`），一遍在修复之后（HEAD `3080275`
对同一个 master），两遍都是：

```bash
git merge-tree --write-tree sp12-files-fixes master
```
```
exit=0
```

第一遍 tree OID 为 `dc2ecbcf2e2bb661bdd0bf54cc35d478af2e8769`，第二遍（`filesLayoutHeightCap.test.ts`
注释改写之后）为 `c9338f2f608d21a8978b5e1531e75dc257bd53f4`——两次 OID 不同是预期的
（本分支内容变了，tree 自然不同），**两次都是 exit=0 + 单行 OID，结论一致：无冲突**。
spec §7 记录的重叠面（`Files.vue` 与两个 i18n base 文件，plan-b 的 hunk 落在
16-31/204-245/492-514/621-639，本期落在 86-145/687-695）在 plan-b 已合入 master 之后
依然验证为不相交。

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
  单行 tree OID（HEAD `3080275` 对 master `9100418`：`c9338f2f608d21a8978b5e1531e75dc257bd53f4`）
  ⇒ 与当前 master（已含 plan-b）无冲突。
- **Gate 2/5 的缺口已在本分支修复**：`filesLayoutHeightCap.test.ts` 那两行含 "photo" 的
  注释已被提交 `3080275` 改写掉（不是加白名单，理由见「三」的教训小节），HEAD `3080275`
  上六道门全部重新跑过并全绿，不再是遗留给合并后处理的缺口。
- **"后合的一方必须在合并结果上重跑全套门，不能拿各自分支上的绿当数"——这条约束现在具体
  落在 `sp12-files-fixes` 身上**：`sp12-plan-b` 已经先合入了 master，所以"后合的一方"
  就是本批次。上表 Gate 1-6 的六个结果，是在**本分支自己的 HEAD**（`3080275`）上跑出来
  的，不是在"本分支合入 master 之后的结果树"上跑的——真正合并（不是 `merge-tree` 的只读
  预演，而是实际执行 merge/生成合并提交）完成后，必须在**合并结果**上把 Gate 1-5 重新跑
  一遍，不能因为"这份文档说本分支绿、master 也绿"就假定合并后自动绿。
