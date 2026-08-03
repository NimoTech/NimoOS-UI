# 文件区时间机器(快照只读浏览套件)· 设计

**日期**:2026-07-30
**范围**:New-UI 文件区快照套件整套 —— 时间机器覆盖层 + 只读浏览闭环 + 恢复 + 设置弹窗
**台账来源**:`docs/superpowers/plans/2026-07-27-vue3-migration-sp6-p5-snapshots.md` 收尾挂账第 1 条(「文件区快照套件整体未迁,SP4 遗留缺口」),以及同文件 Global Constraints 第 1 条(时间线 `[浏览]` 按钮因此缺席)。

---

## 1. 背景与现状

### 1.1 这一条挂账是什么

SP4 文件区收官时,Vue2 里**整套文件区快照浏览**没有迁移、也没有记台账;SP6-P5(RAID 详情快照面板)终审时才补登记。Vue2 侧共 ≈1400 行:

| Vue2 文件 | 行数 | 作用 |
|---|---|---|
| `components/filebrowser/components/SnapshotTimeWheel.vue` | 621 | 全屏时间机器(星空 + 3D 卡堆 + 右侧鱼眼刻度尺 + 底栏) |
| `components/filebrowser/components/SnapshotSettingsModal.vue` | 371 | 齿轮打开的每卷快照设置 |
| `components/filebrowser/snapshotBrowse.js` | 146 | 只读浏览编排纯函数(退出目标 / 写拦截 / 恢复编排 / 守卫) |
| `components/filebrowser/components/snapshotStackMath.js` | 102 | 卡堆/鱼眼/星空的纯数学 |
| `components/filebrowser/components/SnapshotBanner.vue` | 86 | 只读横幅 |
| `components/filebrowser/components/SnapshotActionBar.vue` | 87 | 快照内选中工具条(恢复 + 下载) |
| `FilePanel.vue` / `ContextMenu.vue` 内的分支 | — | 入口按钮、写操作拦截(7 个调用点)、右键菜单裁剪 |
| `service/snapshot.js` 的 6 个路径纯函数 | — | `.snapshots` 路径的构造与解析 |

### 1.2 New-UI 已有的地基(不重写)

SP6-P5 已经落地并通过验收:

- `src/storage/util/snapshotView.ts` —— `groupSnapshotsByDay` / `classifySnapshotType` / `snapshotTypeLabelKey` / `formatSnapshotClockTime` / `snapshotDayLabel` / `toSnapshotViewModel` / `resolveSnapshotState` / `validatePolicyForm` / `defaultExpandedDayKeys`
- `src/storage/stores/snapshot.ts` —— `loadVolume` / `loadPolicy` / `loadSnapshots` / `toggle` / `savePolicy` / `createSnapshot` / `removeSnapshot`(含过期响应守卫、读-改-写策略语义)
- 共享包 `@nimotech/nimoos-service` 的 `service.snapshot.*` —— 含 `restore(...)`
- `src/storage/components/SnapshotTimeline.vue:96` 留有 `[浏览]` 按钮的接口注释

**缺口**:6 个路径纯函数、`snapshotBrowse.js` 的 5 个编排函数、全部 UI。

### 1.3 后端契约(已确证,非推测)

`NimoOS-LocalStorage/route/snapshot.go` 实际注册的路由:

```
GET    /v2/snapshot/volumes          → [{volume_uuid, mount, supported, enabled, count, last_at, ...}]
GET    /v2/snapshot?volume_uuid=     → [{id, name, label, type, created_at}]
POST   /v2/snapshot                  → {volume_uuid, label?}(type 恒为 manual)
DELETE /v2/snapshot/:name?volume_uuid=
GET    /v2/snapshot/policy?volume_uuid=
PUT    /v2/snapshot/policy           ← 全量替换,必须读-改-写
POST   /v2/snapshot/restore          → {volume_uuid, snapshot, path} → {restored_path}
GET    /v2/snapshot/file-versions?path=   ← Vue2 从未消费,本期同样不用
```

- 快照内容就是普通只读目录 `<挂载点>/.snapshots/<快照名>/...`,**文件区现有的 `service.folder.getList` 和 `service.image.thumbUrl` 能直接读它** —— 这是 §4 卡片缩略图方案成立的前提。
- `POST /restore` **永不覆盖**:目标名由后端定为 `<原名>.restored-<时间戳>`(冲突时编号)。
- `path` 相对**卷根**,不是相对快照目录。

### 1.4 本机验证限制(重要)

快照卷只从 RAID 阵列派生(`service/snapshot/adapter.go:VolumesFromRAIDArrays`),而本机 `/DATA` 是 **ext4 单盘、无阵列** —— 实测 `GET /v2/snapshot/volumes` 返回 `200 {"data":[]}`。**本机永远拿不到真实快照数据**,验收必须靠假后端测试台(§8)。

---

## 2. 交互设计

### 2.1 入口

文件区顶栏 chips 行新增一枚「时间机器」chip。可见条件与 Vue2 `canShowSnapshotEntry` 完全一致:

```
卷列表已 resolved(status === 'ready')
  且 findVolumeForPath(volumes, currentPath) 命中
  且 命中卷 supported === true
  且 当前不在快照内容里(!isSnapshotView)
```

卷列表**每会话拉一次**(进入文件区时懒拉 + 解析到 `.snapshots` 路径时兜底拉),idle/loading 期间按钮不出现(不闪)。

### 2.2 时间机器覆盖层

全屏沉浸(`position: fixed; inset: 0`),三区:

```
┌────────────────────────────────────────────┐
│ 正在查看 /Photos/2024 的历史版本         ⚙ │
│                                            │
│         ╭────────────╮              ——     │
│        ╭────────────╮│              —      │
│       ╭────────────╮││   今天       ━━━    │
│       │ 🖼🖼📄      │││              —      │
│       │ 📁🖼 +9     ││╯              ——     │
│       │ 今天 14:30  │╯   昨天       —      │
│       │ 手动 · 15 项│                ━━     │
│       ╰────────────╯                       │
├────────────────────────────────────────────┤
│  取消          今天 14:30      [进入此快照] │
└────────────────────────────────────────────┘
```

**卡堆动效**(照用户提供的 React 参考稿的三段式):

| 相对选中的位置 | 变换 |
|---|---|
| 更老(`offset > 0`,最多 4 张) | `translateZ(-offset*60px) translateY(-offset*12px) rotateX(offset*2deg)`,透明度 `1 - 0.2*offset` |
| 选中(`offset = 0`) | 原位,全亮 |
| 已翻过去(`index < selected`) | `translateY(300px) translateZ(200px) scale(1.3) rotateX(-20deg) opacity:0` —— 朝观众飞出屏幕下方 |

用纯 CSS `transform` + `transition`(`cubic-bezier(0.22, 1, 0.36, 1)` 近似弹簧)实现。**不引入 framer-motion / motion-v**:New-UI 全库没有动画库,Vue2 那版 621 行也是纯 CSS 做到的,为一个覆盖层引入运行时依赖不划算。

**不照搬参考稿的 goo 滤镜**:参考稿给卡片套了 `feGaussianBlur + feColorMatrix` 融球滤镜,那在参考稿里成立是因为卡片内容只有一个数字;我们的卡片有缩略图和文字,套上去会整体糊掉。改为圆角 + 1px 描边 + 大投影,代码里注释登记这条偏离。

**刻度尺**(右边缘):

- 主刻度 = 每个快照一条;两两主刻度之间插 2 条装饰性子刻度(照参考稿的 `type: 'sub'`),子刻度不可独立选中,点击/悬停吸附到最近的主刻度。
- 悬停时在刻度左侧浮出该快照的时间标签(「今天 14:30」),照参考稿的标签位置与淡入。
- **鱼眼用连续函数**,不是参考稿的两档离散 `scaleX`:按光标 Y 与每条刻度中心的距离算一条连续缩放曲线(`timeMachineMath.ts` 的纯函数,rAF 节流)。这一点沿用 Vue2 已验证的做法。
- 按天分组:每组上方一行日期小标题(今天/昨天/具体日期)。
- 选中刻度用 `var(--accent)` 并加光晕;类型着色沿用 SP6-P5 已确立的一套:auto → `--nrm-fg`,manual → `--accent`,preop → `--dem-fg`。

**底栏**:左「取消」· 中「今天 14:30」(选中快照的人话时刻)· 右「进入此快照」(accent 实底 + `--on-accent`)。

**键盘**:`↑` 往更早 · `↓` 往更晚 · `Enter` 进入 · `Esc` 取消(与 Vue2 一致)。点选中卡本身 = 进入;点后面的卡 = 只把它换到最前。

**三态**:加载中(3 张骨架卡)· 空(「还没有快照 / 创建第一个快照,开始积累可回溯的历史」+ 齿轮仍可用)· 就绪。

### 2.3 卡片内容 = 那一刻的这个文件夹

每张**可见**卡片对 `<挂载点>/.snapshots/<快照名>/<当前相对路径>` 调一次 `service.folder.getList`,取前 6 个条目渲染 3×2 缩略图格:图片走 `service.image.thumbUrl(该条目的快照侧绝对路径)`,其余走文件类型图标;超出显示 `+N`。卡底两行:「今天 14:30」+「手动 · 15 项」。

- **只给可见的 5 张卡拉**,结果按快照名缓存在 composable 内,来回拨刻度不重复请求。
- 该快照里没有这个目录(当时还没建)→ 卡片显示「此时还没有这个文件夹」,仍可进入(落到快照根)。
- 请求失败/超时 → 静默退回纯文字卡(大字时间 + 类型 + 备注),不弹错、不阻塞。

### 2.4 只读浏览

**进入落点**:`<挂载点>/.snapshots/<快照名>/<当前目录相对卷根的路径>`。

> ⚠️ **对 Vue2 的有意改正(已获用户拍板)**:Vue2 的 `enterSnapshot` 只跳快照根 `snapshotBrowsePath(mount, name)`,用户在 `/Photos/2024` 打开时间机器、进去后被扔回卷根,还要自己一层层点回来。既然卡片展示的就是当前文件夹在那一刻的样子,进入自然应该落在同一个相对路径。按既定纪律「界面照 Vue2、逻辑照正确」改正,代码中注释登记。

**横幅**:文件区顶部一条 amber 色横幅 —— 相机图标 +「正在查看 {时间} 的快照(只读)」+ [恢复] + [退出快照];下方常驻一行「选中文件后点"恢复"可复制回原位置」(Vue2 M2-F2 的常驻提示,不做成一次性 toast)。

**禁写(两道防线,与 Vue2 同构)**:

1. **移除入口**:新建文件夹 / 新建文件 / 上传文件 / 上传文件夹 / 粘贴 chip 全部隐藏;右键空白菜单只留「刷新」;条目菜单只留「恢复到原位置」+「下载」;选中工具条换成只有 恢复 + 下载 的 `SnapshotSelectionToolbar`。
2. **兜底 guard**:`useFileOps` 的 `createFolder` / `createFile` / `rename` / `remove` / `paste`,以及拖拽投放上传入口,方法开头调 `blockIfSnapshotView()`,命中则 toast「这是只读快照,不能在这里修改」并 return。理由与 Vue2 一致:拖拽投放、快捷键等能绕过 UI 隐藏,请求真发到只读 btrfs 上只会拿回一句原始文件系统报错。

**守卫方向**:`shouldGuardSnapshotView` 的 fail-safe 方向逐字保留 —— 只有在**已 resolved 的卷列表里精确匹配到该挂载点且 `supported === false`** 时才解除只读锁;「还没拉」「拉失败」「列表里没有这个挂载点」三种情况一律**保持锁定**。误锁只是把一个恰好叫 `.snapshots` 的普通目录短暂显示为只读(烦人),漏锁则会让写请求打到只读快照上(更糟)。

**退出**:回到活卷上的同名目录;该目录在活卷上已不存在 → 回卷根(`resolveExitTarget`,逐字移植)。

### 2.5 恢复

三个入口:横幅 [恢复](对当前选中项,支持多选)、选中工具条的恢复按钮、右键单条「恢复到原位置」。

- 编排:`performSnapshotRestore` 逐字移植 —— 把条目的快照侧绝对路径解析回卷相对路径,用 `findVolumeUuidForMount` 找到 `volume_uuid`,再调 `POST /restore`。
- 结果:单条 toast「已恢复到 {restored_path}」;多条 toast「已恢复 {n} 项(新副本带 .restored 后缀)」;失败按 `invalid` / `not-found` / `error` 三种分支给不同文案。
- 恢复中按钮转圈禁用,防重复提交。

### 2.6 设置弹窗

时间机器右上角齿轮打开,叠在时间机器**之上**(时间机器不关闭 —— 这样新建快照成功时能当场看见新刻度冒出来,Vue2 M2-F4 的有意设计)。

内容:快照保护开关 + 4 个策略字段(每小时/每天/每周保留数、占用超过 % 暂停,**常驻不折叠**)+ 一行「立即创建快照」(可填备注)。三态:不支持 / 已关闭 / 已启用。

复用 `storage/stores/snapshot.ts` 的 `toggle` / `savePolicy` / `createSnapshot`(含读-改-写与已修正的 `data:null` 语义),模板另写、底座用 `src/components/ui/Dialog.vue`。建快照成功后刷新时间机器列表。

---

## 3. 架构与文件清单

新建 `src/files/snapshot/`(组件)、`src/files/util/`(纯函数)、`src/files/stores/`(store):

| 文件 | 职责 | 测试 |
|---|---|---|
| `files/util/snapshotPath.ts` | 逐字移植的 9 个纯函数:`snapshotBrowsePath` / `parseSnapshotBrowsePath` / `liveVolumePath` / `parseSnapshotName` / `formatSnapshotBannerTime` / `findVolumeForPath` / `findVolumeUuidForMount` / `shouldGuardSnapshotView` / `resolveExitTarget` | ✅ |
| `files/util/timeMachineMath.ts` | 新写纯函数:`fisheyeScales(centers, cursorY)` / `buildVisibleStack(items, selected, depth)` / `stepSelectedIndex(i, delta, len)` / `buildRailNodes(groups)` | ✅ |
| `files/util/snapshotRestore.ts` | `performSnapshotRestore`(注入 `listVolumes` / `restore`)、`blockedBySnapshotView` | ✅ |
| `files/stores/snapshotBrowse.ts` | 卷列表缓存(idle→loading→ready/error,每会话一次)、时间机器开关、`isRestoringSnapshot`、恢复编排、派生的 `parsedSnapshotPath` / `isSnapshotView` / `currentSnapshotVolume` / `canShowEntry` | ✅ |
| `files/snapshot/TimeMachineOverlay.vue` | 全屏壳:三态、键盘、齿轮、编排;唯一 emit `select` 的地方 | ✅ |
| `files/snapshot/TimeMachineDeck.vue` | 3D 卡堆(props: `items` / `selectedIndex`;emits: `select` / `enter`) | ✅ |
| `files/snapshot/TimeMachineCard.vue` | 单卡:缩略图格 + 时间 + 类型徽章 + 项数 + 降级文字态 | ✅ |
| `files/snapshot/TimeMachineRail.vue` | 刻度尺:主/子刻度、日期分组标题、悬停标签、rAF 节流鱼眼 | ✅ |
| `files/snapshot/TimeMachineBar.vue` | 底栏三件套 | ✅ |
| `files/snapshot/SnapshotBanner.vue` | 只读横幅 | ✅ |
| `files/snapshot/SnapshotSelectionToolbar.vue` | 快照内选中工具条(恢复 + 下载) | ✅ |
| `files/snapshot/SnapshotSettingsDialog.vue` | 齿轮设置 | ✅ |
| `files/composables/useDeckPreview.ts` | 可见卡的目录预览拉取 + 按快照名缓存 + 失败降级 | ✅ |

**改动既有文件**:`views/Files.vue`(入口 chip、覆盖层挂载、横幅、写入 chip 的条件隐藏、选中工具条切换)、`files/composables/useFileOps.ts`(5 处 guard)、`files/components/FileContextMenu.vue`(快照分支)、`storage/components/SnapshotTimeline.vue`([浏览] 按钮接回,跳文件区深链)、`src/styles/theme.css`(新增 `--tm-*` token)、`i18n/zh_cn.ts` + `en_us.ts`。

### 3.1 数据流

```
Files.vue ──(currentPath)──> snapshotBrowse store
                                │
                                ├─ 卷列表(每会话一次) ─> canShowEntry / currentVolume
                                ├─ parseSnapshotBrowsePath(currentPath) ─┐
                                └─ shouldGuardSnapshotView ──────────────┴─> isSnapshotView
                                                                             │
     ┌───────────────────────────────────────────────────────────────────────┤
     ▼                                    ▼                                  ▼
SnapshotBanner                    禁写 guard(useFileOps)          SnapshotSelectionToolbar
     │
     └─(恢复)─> performSnapshotRestore ─> POST /v2/snapshot/restore

TimeMachineOverlay ──> storage/stores/snapshot.loadSnapshots(uuid)
      │                └─> useDeckPreview ─> service.folder.getList(快照侧路径)
      └─(enter)─> router.push(快照侧当前相对路径)
```

### 3.2 主题 token

新增一组 `--tm-*`,**两套主题块各给一套值**(不复用硬编码):

| token | 深色(默认) | 浅色 |
|---|---|---|
| `--tm-bg` | 深空径向渐变 + 深蓝底 | 米白纸感 + 极淡光晕 |
| `--tm-star` | 星点色 | `transparent`(浅色无星空) |
| `--tm-card-bg` / `--tm-card-bd` | 玻璃白叠加 / 描边 | 纸白 / 淡灰描边 |
| `--tm-rail` / `--tm-rail-sub` | 刻度常态 / 子刻度 | 同义浅色值 |
| `--tm-fg` / `--tm-fg-muted` | 覆盖层前景 | 同义浅色值 |

其余(选中刻度、进入按钮、类型着色)直接用既有 `--accent` / `--on-accent` / `--nrm-fg` / `--dem-fg`。**零硬编码色值**(CLAUDE.md 硬约束)。

---

## 4. 有意偏离 Vue2 的清单

每条都在代码注释里登记:

1. **进入快照落在当前相对路径**,不是快照根(§2.4)—— Vue2 的落点会把用户扔回卷根。
2. **不用参考稿的 goo 融球滤镜** —— 会糊掉缩略图与文字(§2.2)。
3. **鱼眼用连续函数**,不是参考稿的两档离散缩放 —— 沿用 Vue2 已验证的做法。
4. **卡片显示目录预览**,不是纯文字牌 —— Vue2 的卡堆几张牌长得一样,分不出哪张是哪张。
5. **store 直连**,不用 Vue2 的 `refreshSignal` 字符串信号 —— SP6 已确立的惯例。
6. **多选恢复**在横幅与选中工具条上支持(Vue2 右键菜单只单条,横幅已支持批量);右键菜单保持单条。

---

## 5. 错误处理与降级

| 情况 | 行为 |
|---|---|
| `GET /volumes` 失败或返回空 | 入口 chip 不出现;已在 `.snapshots` 路径下则**保持只读锁定**(fail-safe) |
| `GET /v2/snapshot` 失败 | 时间机器显示空态,不弹错(快照是可选功能,老后端全 404) |
| 卡片目录预览失败 | 静默退回纯文字卡 |
| 快照内目录不存在 | 卡片写「此时还没有这个文件夹」,仍可进入 |
| 恢复 404 | 「快照里已经找不到这个文件」 |
| 恢复 400 | 「路径无效,无法恢复」 |
| 恢复其他错误 | 「恢复失败,请稍后再试」 |
| 策略保存失败 | toast 报错,表单值不回滚(用户可重试) |

---

## 6. 无障碍

- 覆盖层 `role="dialog"` + `aria-modal="true"` + `aria-label`,打开时焦点移入、关闭时归还。
- 每条主刻度是真 `<button>`,`aria-label` 为该快照的完整时刻。
- 键盘可全程操作(↑↓ 选、Enter 进入、Esc 退出、Tab 到底栏)。
- 卡片缩略图 `alt=""`(装饰性),真实信息在卡片文字里。

---

## 7. 测试

单测(vitest,与实现同目录):

- **路径纯函数**:`.snapshots` 段匹配(不是子串匹配)、多个 `.snapshots` 取最左、`/.snapshots` 开头返回 null、末尾斜杠容忍、`findVolumeForPath` 最长前缀匹配。
- **守卫**:`shouldGuardSnapshotView` 的 4 种输入(idle/loading/error/ready 且未命中)全部保持锁定,只有 ready + 精确命中 + `supported === false` 解锁。
- **数学**:鱼眼曲线单调性与边界、可见栈切片(含已翻过去的卡)、步进夹紧。
- **卡片预览**:缓存命中不重复请求、失败降级、目录不存在的文案。
- **禁写**:5 个 `useFileOps` 方法 + 投放入口,快照态下都不发请求且 toast。
- **恢复**:成功 / 404 / 400 / 其他 四条分支;多选逐个调用。
- **横幅可见性**:仅在 `isSnapshotView` 为真时渲染。
- **入口 chip 可见性**:4 个条件的真值表。
- **i18n parity**:`zh_cn.ts` / `en_us.ts` 键一致(既有 `parity.test.ts` 自动覆盖)。

## 8. 验收

**假后端测试台** `scripts/tmlab/`(进 `.gitignore`,产品代码零开关,做法同 SP6-P5.5 的 `scripts/raidlab/`):

- 拦截 `/v2/snapshot/*` 返回可切换的假数据集:多卷、跨天(今天/昨天/上周/上月)、三种快照类型、带中文备注的手动快照、空列表、请求失败。
- 在 `/DATA` 下造一棵假 `.snapshots/<快照名>/...` 目录树,让卡片预览与只读浏览走真实的文件区 API。
- `pnpm dev` 起 5273 端口即可完整操作。

**视觉自查**:用无头 chromium 对深色与浅色两套主题各截图(时间机器就绪态、空态、只读浏览态),自查后再交付。

**门禁**:`pnpm test` 全绿 + `pnpm exec vue-tsc --noEmit` 无错 + i18n parity 通过 + 无新增硬编码颜色。

---

## 9. 不做什么

- `GET /v2/snapshot/file-versions`(单文件版本列表)—— Vue2 从未消费,本期同样不接。
- 快照的定时/策略引擎本身 —— 后端已有,前端只读改写。
- 跨卷「全局时间机器」—— 时间机器始终作用于当前路径所属的那一个卷。
- 真机实盘验证 —— 本机无 RAID 阵列,拿不到真实快照卷(§1.4)。以单测 + 测试台 + 截图自查为准,随多盘设备补。
