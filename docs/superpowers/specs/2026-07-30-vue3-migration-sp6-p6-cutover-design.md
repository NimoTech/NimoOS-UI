# SP6-P6 存储区收口 + cutover 设计

> 2026-07-30。SP6 主 spec = `2026-07-23-vue3-migration-sp6-storage-design.md`(§4 P6 给了口径),
> 本文是 P6 的**增量 spec**:落实主 spec 的 P6 要求,并记录三处与主 spec 不同的定案。
> 前置:P0–P5 已合入两仓 master、P5.5 实盘验收 2026-07-30 关账(New-UI `master`@`5323e43`)。

## 1. 目标

让存储区五个页面(`/storage`、`/storage/drives`、`/storage/raid`、`/storage/raid/create`、
`/storage/raid/:id`)对**真实入口**上线:桌面磁贴与 Vue2 三处存储弹窗入口全部指向新 UI,
带一把可逆回退开关;完成 i18n 收口扫描、部署、真机验收与记账。SP6 除 P7(文件区快照套件)
外收官。

**不做**:任何新页面/新功能;P7 的快照浏览套件;台账 A 组「整块不迁」各项。

## 2. 核查发现(影响做法,先记在前面)

**Vue2 三个存储入口目前都不可达。** `router/strangler.js` 已把 `/` 与 `/files` 整棵树绞杀到
`/app/`,而三个入口全长在这两棵树上:

| 入口 | 触发路径 | 可达前提 |
|---|---|---|
| ① `views/Home.vue:263` `showStorageManagerPanelModal` | 只由 EventBus `casaUI:openStorageManager` 触发 —— 新盘检测通知卡的「Storage Manager」按钮(`components/CoreService.vue:306`) | Vue2 桌面可达,即 `strangler:disabled:/` = `'1'`,或手动进 `/#/legacy` |
| ② `widgets/Disks.vue:112` `showDiskManagement` | 桌面磁盘小组件右上图标 | 同上 |
| ③ `components/filebrowser/components/MountActionButton.vue:110` `showDiskManagement` | 文件区挂载下拉项 | `strangler:disabled:/files` = `'1'` |

`/legacy` 与 `/` 渲染同一个 `views/Home.vue`(`router/route.js:42`),所以 `/#/legacy` 就是
Vue2 桌面 —— 也正是 SP5-P8 磁贴回退 flag 的落点。

**结论:翻这三处属纵深防御**(覆盖回退期、`/#/legacy` 兜路径、新盘通知卡这条真会被点的路径,
并为 SP10 删 Vue2 前统一口径),不是解锁一条现网活路径。**2026-07-30 用户拍板:照 roadmap 全翻。**

## 3. 定案(三处与主 spec 不同,均 2026-07-30 用户拍板)

### D1 一把开关,键名 `strangler:disabled:/storage`

主 spec §4 P6 的口径是「各带自己的回退 flag,`strangler:disabled:storage-entry`」。改为
**四个 cutover 点共用单键 `strangler:disabled:/storage`**。

理由:Vue2 在 `/`、New-UI 在 `/app/`,**同源共享同一份 localStorage**,一把键两侧都读得到;
与应用区 `strangler:disabled:/apps` 命名同型(路径形);且置 1 后回滚自然闭环 —— 磁贴退回
`/#/legacy`,而落地的 Vue2 桌面上那三个入口此时也已恢复老弹窗。多键方案会组合出 4 种状态,
应急回滚时容易只关一半。

### D2 无路由绞杀点登记进 `strangler.js`,不在三个 `.vue` 里各写一遍

`router/strangler.js` 已经是「flag 命名 + 迁移目标 URL」的唯一真相,但只有**有路由**那张表
(`migratedRoutes`,靠全局守卫命中)。存储区在 Vue2 是模态弹窗、没有路由,守卫拦不到
(主 spec §1 已核实并写明「绞杀不能走路由表」),故新增第二张表:

```js
// 无路由绞杀点:Vue2 侧是模态弹窗、没有路由,进不了 migratedRoutes(守卫拦不到),
// 由入口调用处自己判定。SP6-P6 存储区是第一条;SP7/SP8 同型入口在此续行。
export const migratedEntries = [
  { from: '/storage', to: '/app/#/storage', enabled: true },
]

/** 命中且未回退 → 返回目标 URL;未登记 / 已禁用 / flag=='1' → null。 */
export function resolveEntryTarget(from, storage) { … }
```

复用现有 `flagKey(from)` 与 `resolveStorage(storage)`,与 `resolveTarget` 结构对称。
好处:URL 与 flag 判定各只有一处、可纯函数单测、SP7/SP8 的同型入口有地方续行。

三个调用处各两行,**老弹窗代码原样留着当安全网**:

```js
const target = resolveEntryTarget('/storage')
if (target) { window.location.href = target; return }
// …原 $buefy.modal.open(StorageManagerPanel) 一行不动
```

`Home.vue` 与 `Disks.vue` 里原有的 `this.$messageBus('widget_storagemanager')` 埋点调用
**保留在跳转判定之前**。台账 A4「埋点 `widget_storagemanager` 不迁」指的是 New-UI 侧不补埋点
通道,不是删 Vue2 现有的;Vue2 侧该通道仍活,删它属需求外改动。
(`MountActionButton.vue` 原本就没有这行,不加。)

### D3 New-UI 磁贴补 flag,回退目标 `/#/legacy`

`home/composables/useOpenAction.ts` 的 storage 分支(P1 起就直接 `router.push('/storage')`、
代码里已就地注释登记「SP6-P6 补齐」)改为受 D1 那把 flag 门控,回退时落到既有的
`SYS_ROUTE[key] || '/#/legacy'` 兜底 —— 与 `appstore` 分支的 `appsCutoverDisabled()` 完全同型。

## 4. 四个 cutover 点的行为矩阵

| # | 位置 | flag 未置 | flag = `'1'` |
|---|---|---|---|
| ① | New-UI `useOpenAction` storage 分支 | `router.push('/storage')` | `'/#/legacy'`(Vue2 桌面) |
| ② | Vue2 `Home.vue`(新盘通知卡) | `location.href = '/app/#/storage'` | `$buefy.modal.open(StorageManagerPanel)` |
| ③ | Vue2 `widgets/Disks.vue` | 同上 | 同上 |
| ④ | Vue2 `MountActionButton.vue` | 同上 | 同上 |

## 5. 测试

- **`src/router/__tests__/strangler.spec.js`** 扩 `resolveEntryTarget`:命中返回 `/app/#/storage`
  · 未登记的 `from` 返回 `null` · `flag === '1'` 返回 `null` · flag 为其他值(`'0'`/`''`)不算回退
  · 不传 storage 且无 `localStorage` 的环境不抛。
- **三个 `.vue` 各一条组件测试**(Vue2 仓已有 `@vue/test-utils@1` + jsdom + SFC 基建,先例
  `src/views/Welcome.spec.js`、`src/views/AI/Agent/Agent.spec.js`;house style = `shallowMount`
  + `mocks`):未回退 → 断言 `window.location.href` 落到 `/app/#/storage` **且 `$buefy.modal.open`
  零调用**;flag=`'1'` → 断言 `modal.open` 被调用一次且 `location.href` 未变。
  `window.location` 用 `delete window.location; window.location = { href: '' }` 桩,`afterEach` 还原。
  `Home.vue` 若 `shallowMount` 代价过大(千行视图、依赖多),退化为在桩 `this` 上直调
  `Home.methods.showStorageManagerPanelModal`,并在测试里注释说明退化理由。
- **New-UI `useOpenAction.test.ts`** 照现有 `/apps` 三条的形状加 storage 三条(默认 push
  `/storage` · flag=`'1'` 退回 `/#/legacy` · flag 清除后恢复)。
- **变异验证**:每条新测试撤回对应修复后必须变红(P5.5 教训:同一天抓到过一条对空气生效的
  空洞断言)。

## 6. i18n 收口扫描

照 SP4-P8 / SP5-P8 同口径,scope = `src/storage/` + `src/views/Storage*.vue`(五个视图在
`src/views/`,组件/store/util 在 `src/storage/`):

1. 模板中文文本节点须归零(逐文件 `awk` 抽 `<template>` 段后剔注释再数中文)。
2. TS/`<script>` 里的中文字面量命中**逐条核验**(SP4-P8/SP5-P8 结论都是「全是代码注释」)。
3. `pnpm vitest run src/i18n/parity.test.ts` 绿。

## 7. 守门与部署

**改代码前先清 Vue2 工作区**(2026-07-30 用户拍板逐文件处置)—— `NimoOS-UI` 有 3 个与 P6
无关的未提交改动,而 P6 要构建部署该仓,不处置就会静默上线:

| 文件 | 工作区 vs HEAD | 处置 |
|---|---|---|
| `src/views/Home.vue` | +60:`/next/` 入口药丸 | **已在现网**(部署的 Home chunk 含 `enter-next`)→ 单独提交,注明与 P6 无关 |
| `src/views/AI/Agent/Agent.vue` | +13:接 `?message=` 种子消息 | New-UI `useOpenAction.sendToAI` 正在发 `?message=`,是配套活功能 → 单独提交 |
| `src/views/Photos/PhotosTimeline.vue` | −163:**撤掉了已提交的照片深链同步**(`mergeQuery` watchers)+ 重新启用 `PhotosDropZone` | 工作区是旧版本(HEAD 07-10 提交里有深链同步),疑似误 checkout → `git checkout` 回 HEAD |

**守门**:New-UI 全量 `pnpm test` + `vue-tsc` + color-guard + i18n parity + `pnpm build`;
Vue2 `pnpm test`。

**部署顺序**(先新后旧,保证 Vue2 开始跳转时目标已就绪):

1. `NimoOS-New-UI/scripts/deploy.sh` → `/var/lib/nimoos/www/app/`(长期约定:一律走脚本,
   勿手写 rsync)。
2. `nimo_os_docs/scripts/deploy-ui.sh` → `/var/lib/nimoos/www/`(内建 `--exclude app/`,
   不会覆盖 New-UI;需 sudo)。

## 8. 真机验收清单

**A. flag 未置(cutover 生效)**
1. New-UI 桌面「存储」磁贴 → 应用内 `/storage`。
2. `/#/legacy` Vue2 桌面 → 磁盘小组件右上图标 → 整页跳 `/app/#/storage`。
3. `/#/legacy` Vue2 桌面 → 插盘触发新盘通知卡 → 点「Storage Manager」→ 整页跳 `/app/#/storage`。
   (插盘不便时用 P5.5 测试台 `raidlab.sh up` 造盘触发,或直接在控制台 `$EventBus.$emit('casaUI:openStorageManager')` 验同一条 handler。)
4. 置 `strangler:disabled:/files` = `'1'` 回到 Vue2 文件区 → 挂载下拉「Disk Management」→
   整页跳 `/app/#/storage`;验完清除该键。

**B. flag = `'1'`(回退可逆)**
5. 上述四条路径全部回到老行为:磁贴 → `/#/legacy`,三处 Vue2 入口 → 老弹窗且弹窗功能正常。

**C. 复原与回归**
6. 清除 flag,四条路径恢复 A 组行为。
7. 存储区五页回归抽查(P5.5 刚逐屏验过,本期只需确认部署产物无回归:卷列表/物理盘/RAID
   列表/详情 + 快照面板各开一次)。

## 9. 记账

- roadmap §4 SP6 的 P6 条目四项打勾 + 写坐标;阶段表 SP6 状态 🔄 → ✅(P7 另立、单独列)。
- 台账 `.superpowers/sdd/sp6/progress-p6.md`:i18n 两条扫描命令与结果、两仓提交 hash、
  部署产物入口 chunk、验收结果。
- 记忆 `vue3-migration-plan` 更新 SP6 状态;若 Vue2 工作区处置有后续(如 PhotosTimeline
  那笔是否另有隐情)一并记。
- **本期新登记的债**:`migratedEntries` 表目前只有存储一条,SP7/SP8 若也有模态型入口需在此续行
  —— 别再回到「每个调用处各写一遍 localStorage 判断」。
