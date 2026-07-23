# SP6 存储区迁移设计(Vue2 → Vue3 New-UI)

> 日期:2026-07-23。状态:用户已批准设计五节,spec 待用户审阅。
> 本 spec 随 `sp6-storage` 分支入库(New-UI 仓)。**与 SP5 会话并行开发**,故不写
> NimoOS-UI 仓的 roadmap/specs 目录;合并收尾时在 roadmap 补记账并加本文件指针。
> 遵循 roadmap §3「区域迁移标准套路」10 条 DoD(NimoOS-UI/docs/vue3-migration-roadmap.md)。

## 0. 范围一句话

把 Vue2 存储管理弹窗(`StorageManagerPanel` 三 Tab:Storage / Drive / RAID,含 RAID
创建向导、详情、换盘、btrfs 快照面板,合计约 6100 行)迁成 New-UI 的 `/storage`
独立路由区;**MergerFS 合并卷不迁**(见 §6 台账);RAID + 快照**全量迁,内部分期**。

## 1. 现状盘点要点(2026-07-23 探查结论)

- **Vue2 存储 UI 无路由**:`StorageManagerPanel.vue`(572 行)是 Buefy 模态框,三个打开入口:
  1. `views/Home.vue:263` `showStorageManagerPanelModal()`(EventBus `casaUI:openStorageManager`,Home.vue:83);
  2. `widgets/Disks.vue:108`(桌面「存储状态」小组件点击);
  3. `components/filebrowser/components/MountActionButton.vue:110`(文件区挂载按钮)。
  → 绞杀不能走路由表,收口时改**入口跳转**(§4 P6)。
- **MergerFS 前后端均已下线**:Vue2 侧唯一引用被注释(`StorageManagerPanel.vue:33-34`),
  `MergeStorages.vue`(683 行)/`StorageCombination.vue`(190 行)为死代码;后端
  NimoOS-LocalStorage 的 `/merge`、`/display_name(s)` 端点未注册(merge 代码休眠,
  `EnableMergerFS=false`,`EnsureDefaultMergePoint` 被注释)。
- **Vue2 `service/local_storage.js` 疑似整域已死**:其 PREFIX `/v2/nimoos/local_storage`
  与后端 openapi server URL `/v2/local_storage` 不匹配;`/merge`、`/display_name(s)`
  后端根本没有。→ P0 开工前核查(§4 P0)。
- **共享包缺口**:`storage` 域已齐(list/create/format/delete);`disks` 只有 `umountUsb`,
  缺 `getDiskList`/`umount`/`getUsbs`;`raid`(10 方法)、`snapshot`(7 接口 + 5 纯函数)
  整域缺失。`samba`/`cloud` SP4 已进包,SP6 不动。
- **后端 API 面**(NimoOS-LocalStorage):v1 `/disks` `/storage`;v2 `/v2/raid`(9 端点)、
  `/v2/snapshot`(8 端点)、`/v2/local_storage/mount`(CRUD)。
- **MessageBus 事件**:`local-storage:disk:added` / `local-storage:disk:removed`(热插拔),
  socket `nimoos:system:utilization` 的 `sys_disk`/`sys_usb`(容量实时,New-UI liveStats 已消费)。
- **Vue2-only 依赖**(全部不带过来):Buefy(模态/表单/tabs)、vee-validate、vue-popperjs、
  lottie-web-vue、vue-smooth-reflow。lodash 零散用法改原生。
- **New-UI 已有可复用**:`files/stores/mounts.ts`(samba/cloud/usb 卸载)、FilesShell 布局壳
  模式、reka-ui 原语(Dialog/AlertDialog/ContextMenu)、`home/stores/liveStats.ts`(磁盘容量
  socket)、StorageWidget(桌面容量小组件,保持不动)。

## 2. 形态与导航(已批准)

- New-UI 新增 **`/storage` 路由区**,照 `/files` 模式:`StorageShell`(公共容器 + 回主页键
  + 窄屏适配)。子路由:
  - `/storage`(默认 = 存储卷列表,对应 Vue2 Storage Tab)
  - `/storage/drives`(物理盘,对应 Drive Tab)
  - `/storage/raid`(RAID 列表)、`/storage/raid/create`(创建向导)、
    `/storage/raid/:id`(详情,内含快照面板)
- 入口:主页存储小组件点击 + 主页系统应用图标(`home/apps/systemApps` 注册)→
  `useOpenAction` 走应用内 `router.push`(SP4-P8 同款)。
- **Vue2 侧 SP6 全程零改动**,弹窗为活安全网;入口改跳只在 P6(合并后)做。

## 3. 技术要点(已批准)

- UI 原语:reka-ui + 手写组件;表单校验手写(不引 vee-validate 替代品)。
- `utils/raidUtils.js`(178 行)→ TS 纯模块 + 单测(TDD 主场);
  `snapshot.js` 里 5 个纯函数(resolveSnapshotState/validatePolicyForm/groupSnapshotsByDay/
  defaultExpandedDayKeys/snapshotBrowsePath)→ 判定为 UI 专属逻辑,落 New-UI
  `src/storage/util/`,不进共享包(§3.3 判断法:共享包只装网络层留存代码)。
- 磁盘热插拔:`useMessageBus` 订阅 `local-storage:disk:added/removed` → 刷新列表
  (**不阻塞 handler**,MessageBus buffer=1)。
- 顺手改进:`home/stores/folders.ts:26` `loadDisks()` 直打 `/storage` 改为
  `service.storage.list`(统一通道;行为等价,带回归测试)。
- i18n:只迁存储区 key,zh_cn 优先 + en_us parity(双向扫描零中文占位,SP4-P8 口径)。
- 埋点 `$messageBus('widget_storagemanager'…)`:New-UI 现无埋点通道,与 SP4/SP5 same——不迁。

## 4. 分期(P0–P6;P0–P5 在 worktree 并行,P6 等 SP5 合并后)

每期收尾:单测 + tsc 全绿 → 5273 预览端口真数据眼验(见 §5)→ 台账勾选。

- **P0 域迁包**(NimoOS-Service,`sp6-storage` 分支):
  - `disks` 补全:`getDiskList`(GET /disks)、`umount`(DELETE /disks)、`getUsbs`(GET /disks/usb);
  - 新建 `raid` 域:list/create/remove/getStatus/getUsage/replaceDisk/recover/listTasks/getTask;
  - 新建 `snapshot` 域:listVolumes/list/getPolicy/updatePolicy/togglePolicy/create/remove/restore;
  - **核查项**:curl 真机核实 `/v2/nimoos/local_storage/*` 与 `/v2/local_storage/mount`
    实际可达性;死的部分不迁、记台账(与 MergerFS 同待遇)。
  - **`port` 域不迁**(UI 在设置面板,归 SP9)——偏离 roadmap 原清单,合并时在 roadmap 记录。
- **P1 骨架 + 只读列表**:StorageShell + `/storage` 存储卷列表(名称/容量/占用/卸载)+
  `/storage/drives` 物理盘列表(型号/温度/健康)+ 热插拔事件刷新 + 主页入口注册。
- **P2 创建存储向导**:选盘 → 格式化警告 → 执行(v1 POST/PUT /storage)。破坏性:
  界面链路做全,真格式化按 §6 验收口径。
- **P3 RAID 只读**:列表卡片、状态、详情面板(不含快照)、使用率、创建任务进度卡
  (listTasks/getTask 轮询,轮询带在途守卫——SP5-P6 教训)。
- **P4 RAID 写操作**:创建向导(盘位图 RaidDriveBay + 级别矩阵 RaidMatrix 重写)、
  换盘、恢复、删除(AlertDialog 确认 + 密码/明确输入确认,照 Vue2 交互强度)。
- **P5 快照**:RAID 详情内快照面板 + 时间线 + 策略编辑(v2 /snapshot 全量)。
- **P6 收口 + cutover(唯一动 Vue2 仓与真机的一期,前置条件 = SP5 已合入 master、
  本分支已合回)**:i18n 审计;Vue2 三入口改跳 `/app/#/storage`(每入口带回退 flag,
  `strangler:disabled:storage-entry` 口径,验回退可逆);`deploy.sh` 正式部署 `/app/`;
  真机终验;roadmap 记账(SP6 状态 + MergerFS/local_storage/port 台账)。

## 5. 并行开发与部署纪律(已批准)

- **工作区**:`/home/nimo/NimoTech/.sp6/{NimoOS-Service,NimoOS-New-UI}` 两 worktree
  (兄弟目录,`file:../NimoOS-Service` 依赖闭环),分支均 `sp6-storage`。
  基线已验:New-UI 1197/1197 + tsc 清,Service build+test 过。
- **禁区**:不跑 `deploy.sh`、不写 `/var/lib/nimoos/www`、不改 NimoOS-UI 仓、
  不改 roadmap——全部推迟到 P6。
- **独立端口部署(用户拍板 2026-07-23:真部署,非 dev 预览)**:每期收尾 `pnpm build`
  构建生产产物 → `vite preview`(:5273,`--host` 暴露 LAN)**后台常驻**伺服构建产物,
  配 catch-all 代理:凡非 `/app/` 前缀(API `/v1|/v2|/v3`、socket.io ws、Vue2 登录页)
  转发 `http://127.0.0.1:80`。浏览器随时访问 `http://<设备IP>:5273/app/#/storage`。
  构建产物与正式部署同源(压缩/分包/base 路径问题每期即暴露)。开发中途迭代可临时用
  vite dev(HMR),但**每期验收门只认构建产物**。注意:新端口 localStorage 独立,
  首次需登录一次。
- **合并收尾**:SP5 合入 master 后,`sp6-storage` merge master 解冲突(预计:路由表、
  systemApps、i18n 文件),全量测试,合回 master,进 P6。

## 6. 验收口径与台账

- **每期验收门**:单测 + tsc → 5273 真数据眼验(只读全验;破坏性操作验到确认弹窗前一步)。
  CSS/容器查询类必须眼验(SP2 血泪)。
- **破坏性链路(格式化/建 RAID/换盘/恢复/删阵列)**:接口层单测锁死请求形状;
  实盘验证 = **待补**,用户"验收时再想办法"——有闲盘则升级实盘验,没有则在 roadmap
  标注「未实盘验证」随 P6 记账。
- **台账(合并时写进 roadmap)**:
  1. **MergerFS 不迁**:前端死代码 + 后端端点未注册,双双下线;待产品拍板复活时
     作为独立项目(后端复活 + 前端向导)一起做;Vue2 侧死代码随 SP10 删。
  2. **`local_storage` 域**:按 P0 核查结论记生死。
  3. **`port` 域**:推迟 SP9(设置区)。
  4. Vue2 桌面「存储状态」小组件、设置面板 StorageDriveDetailModal:不属 SP6
     (前者 New-UI 已有 StorageWidget,后者归 SP9 设置区)。
