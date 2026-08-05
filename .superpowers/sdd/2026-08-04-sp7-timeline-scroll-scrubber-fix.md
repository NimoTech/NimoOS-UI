# SP7 · 时间线侧栏/月份刻度尺跟着照片滚 —— 修复报告

**日期** 2026-08-04 · **分支** sp7-photos(工作树 `.sp7/NimoOS-New-UI`) · **状态** ✅ **用户 2026-08-04 验收通过、已 commit `3755b8e`、本票关账**
（用户口径:「都已经验收过了,标记成验收通过然后 commit 直接进 P8b」。下方「待用户验收」8 条按此视作已过;
第 6 条「卡不卡」既然没被提出,则**不另开虚拟滚动一票**,渲染量问题继续挂账不做。）
**来源** P8a 验收轮 2 缺陷(当时定性为「时间线页丢了内层滚动容器,P1 遗留」,交接票未落盘,本文补上)

## 用户报的现象

1. 左侧栏跟着照片上下滚 —— 照片多时要翻到最底才够得着「设置」
2. 右侧月份刻度尺同样跟着滚 —— 滚下去就点不到

## 根因(实测,非推断)

不是"丢了内层滚动容器"—— `PhotosGrid` 一直有 `.photos-wrap { flex:1; min-height:0; overflow-y:auto }`。
真因是**它上游少了高度封顶**:`.photos-layout` 写的是 `min-height: 100%`(至少一屏、可无限长高)
而不是 Vue2 的 `height: 100vh; overflow: hidden`(`NimoOS-UI/src/views/Photos/photos.scss:109`
`.app` + `:295-300` `.content`/`.photos-wrap`)。

于是 `.photos-main` → `.photos-grid-slot` → `.photos-grid-root{height:100%}` 整条链的高度
全部由内容决定,`.photos-wrap` 的 `overflow-y:auto` 永远不触发,滚动落回 `AreaShell` 的
`.area-body{overflow:auto}` → 整页(含侧栏、含刻度尺浮层)一起滚。

隔离盒模型实测(785 张真实数据,复刻整条 CSS 链):

| | `min-height:100%`(改前) | `height:100%`(改后) |
|---|---|---|
| `.photos-wrap` | 83509px 高,**不滚** | 361px 视窗 / 83509px 内容,**滚** |
| `.scrubber` 高度 | **83508px**(刻度全挤最顶端 → 点不到) | 361px,钉在原位 |
| 侧栏「设置」按钮 distance-from-page-top | **83580px** | 399px |

两个抱怨同一病根。

## 改动

### 1. 11 页各改一行(主修)

```diff
-.photos-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
+.photos-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
```

`Photos` `PhotosFavorites` `PhotosPlaceAssets` `PhotosTrash` `PhotosSearch`
`PhotosSmartViewDetail` `PhotosPersonDetail` `PhotosAlbums` `PhotosPeople`
`PhotosAlbumDetail` `PhotosSettings`

**属移植漏项补齐,不是偏离**:Vue2 侧栏从来不跟着滚。
全相册区 13 页当初有意「不抽公共」→ 同一行复制粘贴 13 份,故 13 页同源带病;
用户只在照片最多的时间线上撞到。

**不动的 2 页(已挂账)**:`PhotosSmartViews` / `PhotosPlaces` —— 整页无内层滚动容器,
封顶会把内容裁掉够不着。需先各建滚动容器(地点页还掏着地图画布尺寸,风险更高)。
留 `min-height:100%` = 保持当前行为(侧栏会跟着滚),不算退步但**是已知缺陷**。

### 2. `PhotosGrid` 隐藏照片区滚动条(附带,同为补 Vue2 契约)

封顶后滚动条从窗口右缘搬进照片面板内部。本仓 `theme.css:4-16` 有全局 10px 半透明滚动条,
而 `.scrubber` 是 `right:0` 的 56px 浮层、刻度文字贴 `right:6px` → **滚动条正好压在刻度文字上**。
Vue2 无此冲突:`photos.scss:103` 把 `.photos-root *` 滚动条全隐,`:301` 又单独给 `.photos-wrap`
设 `::-webkit-scrollbar{width:0}`。故补:

```css
.photos-wrap { …; scrollbar-width: none; }
.photos-wrap::-webkit-scrollbar { display: none; }
```

`PhotosSearchGrid.vue:126-127` 早已如此,两个网格组件从此一致。滚动操作感由刻度尺承担(同 Vue2)。

### 3. 新增双向回归闸

`src/views/__tests__/photosLayoutHeightCap.test.ts`(7 例)。
**双向**是照 SP9-T9 教训(那次白名单只做单向检查,漏搬的整块 CSS 三道门全绿溜过去):

- 正向:`CAPPED` 名单 11 页都含 `height: 100%`
- 反向 A:目录扫描下**没有任何**相册页还留着 `min-height: 100%`(除 `EXEMPT` 两页)
- 反向 B:每个带 `.photos-layout` 的页都必须登记进 `CAPPED` ∪ `EXEMPT`,新页不登记即红
- `EXEMPT` 每条须带理由,且一旦真封顶了就报「该移出豁免」
- `PhotosGrid`/`PhotosSearchGrid` 的 `scrollbar-width: none` 断言

读盘一律 `node:fs`(`?raw` 在本仓测试环境恒空,color-guard 曾因此空转)。

**变异验证(已跑)**:①把 `PhotosAlbums` 改回坏规则 → 正向+反向A 双红;
②新建一个未登记的 `PhotosZzMutant.vue` 带坏规则 → 反向A+反向B 双红。闸非恒绿。

## 三道门

- `vue-tsc --noEmit`:exit 0
- `pnpm test`:**460 文件 / 5915 例全过**。1 个 unhandled error 致退出码 1 =
  `service.users.avatarPath is not a function`(`src/settings/views/SettingsPage.test.ts`),
  **既存问题、与本次无关**(本次 diff 未碰 `src/settings/**`),master 已在 `721117f` 修掉
- `pnpm build`:✓ built

## 真机自查(CDP 探针,对着 `:5277` dev server 的真实组件树)

手法沿用 SP9-P6 那套:Fetch 域拦截兜住 `/v1/*` 绕开 401 硬跳登录。
timeline fixture **从设备 `photos.db` 逐字导出**(26 组 / 785 张),非手编。

**踩坑记录(下次省时间)**:`guard.ts` 有一条「受保护 + 有 token 但**缺 `version`** → 清 token
→ `/login`」的防半初始化分支。只塞 `access_token`/`refresh_token` 会被静默踢回登录页,
表现为「token 明明写进去了,读出来却是 null」。必须一起塞 `version`。
另:光改 localStorage + 换 hash 不行(session store 在模块加载时就快照了),而 `Page.reload`
又会重载在被弹到的 `/login` 上(登录页清 token)—— 要用**带不同 query 的整页直达**
`/app/?probe=1#/photos`。

### 时间线页(1600×1000)

| 量项 | 值 | 判定 |
|---|---|---|
| `.area-body` 滚不滚 | 1000/1000 **false** | 外层不再滚 ✓ |
| `.photos-wrap` | 839 视窗 / 18555 内容 **true** | 照片区自己滚 ✓ |
| `.scrubber` | top=141 height=**839** | 钉在视窗内(改前 83508)✓ |
| 侧栏「设置」按钮 | y=936;**照片区滚到底后仍 y=936** | 完全不动 ✓ |
| 瓦片 / 月份组 / 刻度 | 766 / 23 / 36 | 默认 tab='photo' 滤掉 19 个视频,3 个纯视频月份不出现,合理 |

截图(滚到最底):侧栏完整、存储条+设置钉左下、刻度尺最底 `May` 药丸高亮、
顶部搜索框+标签页/密度工具栏没滚走、看不到滚动条。

### 11 页反向事故扫描(封顶后内容是否被裁)

手法:往每页的滚动容器里注入 50000px 撑高块,看容器自身 `clientHeight` 是否稳住。
**11 页全 PASS**,外层 `.area-body` 一律不滚:

- **7 页压到了真滚动容器**(高度稳住 + 自身滚):`photos-wrap`(739) `trash-scroll`(754)
  `albums-scroll`(791) `people-body`(739) `ps-scroll`(860) `album-photos-wrap`(536)
  `sv-detail-main`(797)
- **4 页走兜底**(`/photos/favorites` `/photos/search` `/photos/people/:id` `/photos/places/:key`):
  桩数据下网格组件未渲染(收藏为空/搜索无结果/无照片),没有滚动容器可压 → 退一步压
  `.photos-main` 自身,高度 860→860 稳住 + 外层不滚,即证明这一屏封住了。
  这 4 页的滚动都委托给 `PhotosGrid`/`PhotosSearchGrid`/`PersonAssetGrid`,与已在
  `/photos` 端到端证过的是同一 `height:100%` + `.photos-wrap` 形态。
  **诚实边界:这 4 页的网格滚动本身未在运行时压到,靠用户设备真实数据的验收关掉。**

## 待用户验收(`:5277`,勿 deploy.sh —— 快照发布前不部署)

1. 时间线把照片滚到最底 → 左侧栏底部「设置」全程在视野、点得开设置页
2. 右侧刻度尺全程钉在原位不滚走
3. 点刻度 `Jun`(2026-06,184 张,确认渲染成可点刻度)能跳到该月
4. 顶部搜索框 + 标签页/密度工具栏 + 筛选条全程不滚走
5. 照片区内看不到滚动条、刻度文字没被压住
6. **卡不卡** —— 这条是决定要不要另开虚拟滚动一票的唯一依据
   (当前渲染量:785 张全量建 DOM,内容高 18555px@1600 宽。用户已拍板本票只修布局)
7. 其余 10 页逐页过一眼:侧栏不随内容滚(尤其上面走兜底的收藏/搜索/人物详情/地点照片 4 页)
8. 窄屏(窗口拖到 768px 以下):抽屉侧栏行为不变,内容仍滚得到底

## 顺带发现(未动,记债)

`src/views/Files.vue:572` 的 `.files-layout` 同款 `min-height: 100%` —— 文件区同一病根。
属 master 领地(SP4 已收官),本票不碰。

## 挂账

- `PhotosSmartViews` / `PhotosPlaces` 两页:需先建内层滚动容器才能封顶(见上)
- 虚拟滚动/渲染量:用户 2026-08-04 拍板本票只修布局,先验手感再定
