# SP12 并行批次 —— Files 区三条遗留缺陷（F17 / F11 / F12）设计

> 2026-08-09。与 `sp12-plan-b`（T1/T7/T8 统一冲突弹窗）并行，隔离在
> worktree `.claude/worktrees/sp12-files-fixes` / 分支 `sp12-files-fixes`。
> 条目编号沿用 `NimoOS-UI/docs/vue3-pending/01-文件区-SP4.md`。

---

## 0. 这一期为什么是这三条

SP12 spec 的 11 个任务已无空位：T2–T6 = Plan A（已合 master），T9 + T11 = Plan C
（已合 master `3da4135`），T1/T7/T8 在 `sp12-plan-b` 手上，T10 由机主 2026-08-09 拍板
推迟到 plan-b 合回主干之后（两条线会同期改 `UploadPanel.vue`）。

所以本期的料取自 Files 区遗留清单，挑选标准是**与 plan-b 的文件重叠面接近零**。

### F14 已被证伪，不在本期（也不该再出现在任何清单里）

清单原文说 `deleteConnection` / `umountUsb` 不 unwrap 响应信封 ⇒ 错误信封被当成成功
⇒ 删除网络连接、弹出 U 盘失败时界面静默显示成功。**这条诊断的前提不存在。**

| 端点 | 后端实际返回 |
|---|---|
| `DELETE /v1/samba/connections/:id`（`NimoOS/route/v1/samba.go:212-238`） | 三条失败分支 = HTTP **400 / 500 / 500**（`common_err.CLIENT_ERROR=400`、`SERVICE_ERROR=500`，见 `NimoOS-Common/utils/common_err/e.go:5-6`）；成功才 200 |
| `DELETE /v1/disks/usb`（`NimoOS-LocalStorage/route/v1/usb.go:128-143`） | 三条失败分支 = `http.StatusBadRequest` / `StatusBadRequest` / `StatusInternalServerError`；成功才 200 |

而 `packages/service/src/http.ts:41` 的 `validateStatus` 是默认的 2xx-only ⇒ axios 在
4xx/5xx 上 reject ⇒ `src/files/stores/mounts.ts:61,72` 已有的 `catch` 会触发、toast 会弹。
**这两个端点从不返回「HTTP 200 + 错误信封」**，清单假设的那个形状不存在。

残留的只是一条加固项（万一后端将来改成信封报错就会静默通过），机主 2026-08-09 拍板
**不做**。清单那条应改判为「不成立」，别让下一轮审计再照它开工。

---

## 1. F17 —— 侧栏 / 面包屑跟着文件列表滚走

### 用户看到什么

文件多、列表长时向下滚，左侧栏（收藏 / 磁盘 / 共享 / 互传）和顶部面包屑跟着内容一起
滚出屏幕，而不是钉在原位；侧栏自己的滚动条永远不出现，收藏项一多就够不着。

### 根因

`src/views/Files.vue:687`：

```css
.files-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
```

`min-height` 冒充 `height`。侧栏 `align-self: stretch`（`FilesSidebar.vue:263`）于是拉到
**内容高度**而非视口高度，唯一的滚动容器变成 `AreaShell` 的
`.area-body { flex: 1 1 auto; overflow: auto }`（`src/components/shell/AreaShell.vue:32`），
侧栏自身的 `overflow-y: auto`（`FilesSidebar.vue:265`）永远不触发。

与相册区（SP7 已封 11 页）**同一个病根**，但 Files 从未跟进。

### 为什么不能只改一行

相册区那 11 页各自本来就有内层滚动容器，改 `height: 100%` 即可收工。**Files 没有**：
`.files-listwrap` 只有 `flex: 1 1 auto; min-height: 200px`，没有任何 `overflow`。
只封顶不建容器 = 列表被裁掉够不着 —— 这正是相册区 `photosLayoutHeightCap.test.ts`
的 `EXEMPT` 名单里 `PhotosPlaces` / `PhotosSmartViews` 至今没封的原因，原话是
「无内层滚动容器，封顶会把内容裁掉」。

### 改法（三步一起，缺一不可）

| 选择器 | 现在 | 改成 |
|---|---|---|
| `.files-layout` | `min-height: 100%` | `height: 100%` |
| `.files-main` | 无 `min-height` | 补 `min-height: 0` |
| `.files-listwrap` | `min-height: 200px` | `overflow-y: auto` + `min-height: 0` |

`.files-main` 的 `min-height: 0` 是打通 flex 收缩链用的：flex 子项默认
`min-height: auto`，不显式清零的话子元素会撑破父容器，封顶等于白封。

改完侧栏与面包屑（`.files-topbar`）都钉住，只有文件列表自己滚。

### 与 Plan C（T11 虚拟滚动 / 框选）的交界 —— 本期唯一的真机风险

滚动容器从 `.area-body` 变成 `.files-listwrap`。三处依赖它的代码，逐个查过机制：

- **虚拟滚动**：`FileGridView.vue:52-56` 的 `findScrollParent` 是**动态**往上找最近的
  `overflow: auto|scroll` 祖先，不是写死 `.area-body`，会自动改认新容器。解析发生在
  `onMounted`（`:96`），本期改的是静态 CSS、运行期不变，所以一次解析够用。
  `readScroll`（`:64-72`）用 `getBoundingClientRect().top` 算相对位移、`clientHeight`
  取视口高，两者对任何滚动容器都成立。
- **框选矩形的绘制**：`.marquee-box` 是 `position: fixed`（`Files.vue:706`），吃的是
  `marqueeStyle` 直传的视口坐标。给祖先加 `overflow` **不会**为 fixed 元素建立包含块
  （只有 `transform`/`filter`/`will-change`/`contain` 会），所以框线仍锚在视口，不会
  跟着内容滚。
- **框选命中判定**：`itemRects()`（`FileGridView.vue:132-140`）每次都以
  `root.getBoundingClientRect()` 当原点重算，产出的是视口系矩形；`collectSelection`
  （`Files.vue:434-441`）每次 mousemove 都重新调它，与 `e.clientX/Y` 同系可比。

⇒ 机制上是透明的。但 jsdom 的 `getBoundingClientRect` 恒 0、不做布局，这三条单测都
证不了，**仍必须真机验收**：长目录滚动时网格不能空窗（虚拟窗口算错会出现空白区），
滚到中途起框选时框线与命中项不能错位。

---

## 2. F11 —— 右键一个未选中项，动作却作用于当前选区

### 用户看到什么

此前选中了 B、C，右键点 A 选「复制」→ 粘出来的是 B、C。删除、剪切、下载、共享同样。
菜单本身还按选区条数显示成多选态，界面上没有任何提示。

### 这是迁移回归，不是「承 Vue2」

清单原记「与既有 delete 行为一致（intentional-by-inheritance）」。**核 Vue2 源码后不成立。**
`NimoOS-UI` `origin/main` 的 `src/components/filebrowser/components/ContextMenu.vue:265-281`：

```js
open(event, item) {
    this.item = item
    ...
    const isInSelected = this.filePanel.selectedArray.some(obj => item.path == obj.path)
    if (this.filePanel.selectedArray.length > 1 && isInSelected) {
        this.items = this.filePanel.selectedArray
        this.showSingleEdit = false
    } else {
        this.items = [item]
        this.item = item
        this.showSingleEdit = true
    }
```

Vue2 的规则是「**选区多于一项 且 被点项在选区内** → 用选区；否则只作用于被点项」，
并且菜单形态（`showSingleEdit`）跟着这个**有效目标集**走，不是跟着原始选区条数走。

New-UI 有两处平行走样：

- `Files.vue:96` `selectedOr` —— 选区非空即赢，被点 `entry` 只作兜底
- `FileContextMenu.vue:19` `single = props.selectedCount <= 1` —— 菜单形态看原始选区条数

**两处必须一起改**，只改前者的话「为 A 弹出的菜单显示成多选态」仍在。

### 改法

新建纯函数 `src/files/util/contextTarget.ts`：

```ts
// Vue2 ContextMenu.vue:271-279 的规则:选区多于一项且被点项在选区内才用选区,
// 否则只作用于被点项。返回的是"有效目标集",菜单形态与所有动作都以它为准。
export function contextTargets(entry: FileEntry | null, selected: FileEntry[]): FileEntry[]
```

调用侧：

- `Files.vue` 的 `selectedOr` 换成 `contextTargets`，`onCtxAction` 里 `copy`/`cut`/
  `download`/`delete`/`share` 各分支统一取它的返回值（`delete` 现在是 `:136-137` 内联
  的同一套逻辑，一并收编）
- `FileContextMenu` 的 `selectedCount` prop 改为喂**有效目标集的长度**，`single` 语义不变

`onShare` 的多选批量入口（工具栏 `onShare(null)`）仍走原始选区 —— 那条路径没有「被点项」
概念，`contextTargets(null, sel)` 自然返回 `sel`，语义天然一致，不需要分叉。

---

## 3. F12 —— 多选批量共享不门控「已共享」

### 用户看到什么

多选一批文件夹批量共享，其中已共享的那些会触发后端 `SHARE_ALREADY_EXISTS` 报错，
整批共享失败。

### 现状（不对称已代码级确认）

- 单项右键**有**门控：`FileContextMenu.vue:22,32`
  `alreadyShared = entry?.extensions?.share?.shared === 'true'` → `showShare` 里排除
- 批量分支**没有**：`Files.vue:99` `selectionHasFolder` 只看 `is_dir`；
  `:106-109` `onShare` 只 `filter(e => e.is_dir)` 就直接 `shares.create`

### 改法（机主 2026-08-09 定的语义：过滤后执行 + 告知跳过数）

抽一个判定函数（与单项门控**共用**，避免两处漂移）：

```ts
// src/files/util/shareGate.ts
export function isAlreadyShared(e: FileEntry): boolean
export function shareableFolders(entries: FileEntry[]): { targets: FileEntry[]; skipped: number }
```

`FileContextMenu.vue:22` 的 `alreadyShared` 改为调用 `isAlreadyShared`。

`Files.vue` 的 `onShare` 行为：

| 情况 | 行为 |
|---|---|
| 有可共享文件夹、无跳过 | 照旧共享，toast 照旧 |
| 有可共享文件夹、跳过 M 个 | 只共享可共享的，toast 追加「已跳过 M 个已共享项」 |
| 全部已共享 | **不发请求**，toast 直接说明原因 |
| 一个文件夹都没有 | 照旧 `return`（现有行为） |

`shares.create`（`src/files/stores/shares.ts:34`）**不动** —— 它是通用入口，过滤属于调用侧
的业务判断。

### i18n

新增键（`zh_cn.base.ts` + `en_us.base.ts` **两个都要加**，否则 `src/i18n/parity.test.ts` 红）：

- `filesShareSkippedShared` —— 「已跳过 {count} 个已共享项」（拼在成功 toast 后）
- `filesShareAllAlreadyShared` —— 「所选文件夹都已共享」

---

## 4. 测试策略

| 目标 | 手段 |
|---|---|
| `contextTargets` 四种组合 | 纯函数单测：空选区 / 被点项在选区内且选区>1 / 被点项不在选区内 / 选区仅一项 |
| `shareableFolders` 分流 | 纯函数单测：全可共享 / 部分已共享 / 全已共享 / 无文件夹 |
| 菜单形态跟着有效目标集走 | `FileContextMenu` 组件测：选区含 B、C，被点 A → 菜单呈单项态 |
| **动作真的接到了有效目标集** | `Files.vue` 层端到端断言：选中 B、C，右键 A 点复制 → 剪贴板里是 A。**必做** —— `contextTargets` 单测绿不代表 `onCtxAction` 每个分支都接对了，这正是 SP12 Plan A 终审总结的「手工转发链」类型盲区 |
| F12 三种分流的 toast 与请求 | `Files.vue` 层：断言 `createShare` 收到的路径集 + toast 文案；全已共享时断言**没有**发请求 |
| F17 防复发 | 仿 `src/views/__tests__/photosLayoutHeightCap.test.ts` 的双向源文本闸，新建 Files 版：正向断言三条规则都在，反向断言不许回退成 `min-height: 100%`。读盘一律 `node:fs`（`?raw` 在本仓测试环境恒空） |

F17 的**实际布局效果**不在测试覆盖内（jsdom 不做布局），以真机验收为准。

## 5. 真机验收清单（本期交付时一并给出）

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

## 6. 边界与不做的事

- **不动 `shares.create` / `useFileOps` 的内部实现** —— 本期只改调用侧的目标集与过滤
- **不碰上传管线**（`src/files/upload/**`、`UploadPanel.vue`、`stores/uploads.ts`）—— 那是
  `sp12-plan-b` 的地盘
- **不动相册区**那两页残留的 `min-height: 100%`（`PhotosPlaces.vue:540`、
  `PhotosSmartViews.vue:148`）—— 它们在相册区的 EXEMPT 名单里，各自另有原因，不在本期范围
- **F10（多选删除 all-or-nothing）不做** —— 机主 2026-08-09 明确本期只做三条。它与 F12
  同属「批量操作遇不合格成员」语义，本期定下的「过滤 + 告知跳过数」可以直接复用，
  留给后续期

## 7. 与 sp12-plan-b 的合并纪律

文件重叠只有 `src/views/Files.vue` 与两个 i18n base 文件。plan-b 在 `Files.vue` 的 hunk 落在
16-31 / 204-245 / 492-514 / 621-639，本期落在 86-145（F11/F12）与 687-695（F17），互不相交。

合并前用 `git merge-tree --write-tree A B` 只读预演（退出码 0 + 单行 tree OID = 无冲突）。
**后合的一方必须在合并结果上重跑全套门**，不能拿各自分支上的绿当数。
