# SP6 快照收口设计:P5.5 实盘验收 + P7 文件区快照套件

> 日期:2026-07-28
> 范围:SP6-P5.5(多盘测试台 + P3/P4/P5 实盘验收)、SP6-P7(文件区快照套件迁移)
> 前置:SP6 P0–P5 已合入两仓 master(Service @`2917090`、New-UI @`7d104cd`)

## 1. 背景

SP6 的 P3(RAID 只读)、P4(RAID 写)、P5(btrfs 快照面板)三期全部 **code-complete 但从未实盘验证**,原因是两条环境挂账(roadmap §4 SP6 台账 C11 / C12):

- **C11 快照后端未部署**:设备上 `nimoos-local-storage` 停留在 2026-06-22 版,`/v2/snapshot/*` 全 404,前端只能走优雅降级。
- **C12 单盘设备无阵列**:后端 `route/snapshot.go:133` 的 `currentVolumes()` 就是 `VolumesFromRAIDArrays(raids)`,**快照卷严格等于 RAID 阵列**;设备只有一块 NVMe → 无阵列 → 三期全部无从验起。

**C11 已于 2026-07-28 由用户部署解除**(`/usr/bin/nimoos-local-storage` 时间戳 11:20,`GET /v2/snapshot/volumes` 返回 `200 {"data":[]}`,八个端点全部注册)。C12 仍在,但可以用假盘解除——这是本设计第一段。

第三条挂账 **B6「文件区快照套件整套未迁」** 是 SP4 遗留缺口,P5 终审时才正式登记,直接后果是新 UI 快照时间线里的 `[浏览]` 按钮缺席。它必须站在第一段的阵列上才验得动——这是第二段。

## 2. 目标与非目标

### 目标
1. 在单盘设备上造出可信的多盘 RAID + btrfs 环境,让 P3/P4/P5 的**真实请求/响应契约**得到端到端验证。
2. 把文件区快照套件(只读浏览 + 时光轮 + 设置 + 恢复)1:1 移植到 New-UI,补上 `[浏览]` 按钮。

### 非目标
- **不做 P6 cutover**(翻 Vue2 三入口 + 回退 flag + 部署)。验收全程在 5273 `vite preview`,不碰已部署的 `/app/`。
- **不迁 `GET /v2/snapshot/file-versions`**。核查确认(grep 全仓)Vue2 **没有任何调用方**,属后端先行、前端未用。
- **不做 RAID 故障模拟器**(台账 B7)。那是产品功能推迟,与有没有盘无关。
- **不复活 MergerFS / `local_storage` 域**(台账 A1/A2)。

## 3. 为什么必须实盘验(而不是信单测)

这个项目已经在同一个坑里栽过两次:共享包方法对着**裸信封**调 `unwrap()` 必抛 → 被上层 `catch` 静默吞 → 功能整条死掉,而单测因为 mock 的是标准信封所以全绿。P3c 的上传冲突弹窗「从未真正弹过」、`syncServerTasks` 跨设备恢复「一直是死的」,都是这么漏到验收的(roadmap §4 SP4-P3c 血泪记录)。

P3/P4/P5 的 1505 个单测锁的是**前端内部逻辑与请求形状**,锁不住后端实际返回什么。实盘验的价值在于:

- `POST /v2/raid` 的 `{name, level, disk_paths, chunk_kb, filesystem, enable_snapshots}` 后端认不认、返回什么信封;
- `PUT /v2/snapshot/policy` 返回 `data: null`(P5 已发现 Vue2 把信封当策略对象用的 bug),修法在真机上成不成立;
- 404 / 400 分支走不走对(P3 修过 `e.code ?? resp.status` 的 axios 字符串 code 坑);
- 创建任务轮询的 6 步状态、重建态 5000ms 活体重拉,在真实 mdadm 时序下对不对得上。

展示页面只是副产品。

## 4. 第一段:SP6-P5.5 多盘测试台 + 实盘验收

### 4.1 测试台机制选型

设备现状核查:

| 项 | 结论 |
|---|---|
| `mdadm` / `mkfs.btrfs` / `losetup` | 全部存在(`/sbin`) |
| 内核 RAID personality | `raid0 raid1 raid4 raid5 raid6 raid10 linear` 已加载 |
| `scsi_debug.ko` | 存在于 `/lib/modules/6.18.32-nimo-amd64/kernel/drivers/scsi/` |
| 可用内存 | 10 GiB |
| sudo | 可用 |

**选定 `scsi_debug` 4 块 × 512 MB + 后端白名单加一行。**

排除 loop 的理由:`service/disk.go:283,298` 明确 `if blk.Type == "loop" || blk.RO { continue }` —— **loop 设备被后端从磁盘列表里过滤掉**,创建向导和换盘下拉都选不到盘,P4 写操作直接验不了。

**⚠️ 实测修正(2026-07-28,初稿判断有误)**:`scsi_debug` 造出来的盘**后端也看不见**,原因不是上面那个 loop 过滤,而是更深一层的 `service/disk.go:774 IsDiskSupported` —— 它是个**传输方式白名单**:

```go
func IsDiskSupported(d model.LSBLKModel) bool {
	return d.Tran == "sata" || d.Tran == "nvme" || d.Tran == "spi" || d.Tran == "sas" ||
		strings.Contains(d.SubSystems, "virtio") ||
		strings.Contains(d.SubSystems, "block:scsi:vmbus:acpi") ||
		strings.Contains(d.SubSystems, "block:mmc:mmc_host:pci") ||
		strings.Contains(d.SubSystems, "block:mmc:mmc_host:platform") ||
		strings.Contains(d.SubSystems, "block:scsi:pci") || d.Tran == "usb"
}
```

`route/v1/disk.go:128` 一句 `if !service.IsDiskSupported(currentDisk) { continue }` 就把盘从 `disks` 和 `avail` **两个数组里同时抹掉**。而 scsi_debug 的实测特征是 `tran=None`、`subsystems=block:scsi:pseudo`,白名单里一条都不沾。

实证:4 块假盘在 `lsblk -O -J -b` 里 `type=disk`/`ro=false` 一切正常,`GET /v1/disks` 依然只返回 `nvme0n1`,`avail` 为 `[]`。且已核实 P4 创建向导确实走 `service.disks.getDiskList()` → `GET /v1/disks`,躲不开这个过滤。

**解法(用户 2026-07-28 拍板):给白名单加一行 `block:scsi:pseudo`**,重建并部署 `nimoos-local-storage`。判断依据:

- 生产影响惰性 —— `block:scsi:pseudo` 只可能来自主动 `modprobe scsi_debug`,真实 NAS 上不会出现;
- 假盘 `rota=0` → 后端判为 SSD → **选盘界面、SSD/HDD 筛选片、`selectAllHealthy` 作用于过滤视图(P4-T3 的修复)全部走真实路径**,这是最需要验的一段逻辑;
- 备选的 USB gadget 路线(`dummy_hcd` + configfs `usb_f_mass_storage`,三个模块在设备上均可用、`tran=usb` 天然过白名单)虽不需改后端,但所有盘会报 `disk_type=USB`,恰好把上面那段选盘逻辑变成盲区 —— 故不采用。

代价:占 2 GB 内存;重启后模块自动消失(对测试台反而是优点);**混规格盘仍验不了**(一次 `modprobe` 所有 target 共用同一 `dev_size_mb`),见 §7 与 roadmap 台账 B8。

### 4.2 测试台脚本 `raidlab.sh`

放在 `nimo_os_docs/scripts/`(与 `deploy.sh` 同处),`up` / `down` / `status` 三个子命令。

**硬护栏(不可省略)**:脚本的每一个破坏性操作前,都要把目标设备的 `/sys/block/<dev>/device/model` 读出来断言等于 `scsi_debug`;凡目标名字里出现 `nvme`,立即 `exit 1`。理由:后端创建 RAID 前会**清扫成员盘**(NimoOS-LocalStorage @`1ab91a9`),选错盘 = 抹掉 `/DATA`。

- **`up`**:`modprobe scsi_debug num_tgts=4 dev_size_mb=512` → 等待 `/dev/sd{a,b,c,d}` 出现 → 核对 `GET /v1/disks` 的 `avail` 数组**只含这 4 块假盘**(基线:现在 `avail` 是 `[]`,nvme 因已挂载不在其中)→ 打印设备清单。核对不通过就报错退出,不让用户在不确定的状态下点创建。
  **注**:`avail` 能看见假盘的前提是 §4.1 的白名单补丁已部署;`up` 的核对步骤同时充当补丁是否生效的自检 —— 未部署时 `avail` 恒为 `[]`,脚本会明确报「白名单补丁未生效」而不是含糊地说没盘。
- **`down`**:停所有 md 阵列 → 删 `/etc/fstab` 里指向假盘的 `@snapshots` 条目 → 从 `mdadm.conf` 摘掉测试阵列 → `rmmod scsi_debug` → 复核 `/proc/mdstat` 与 `avail` 回到基线。
- **`status`**:打印 `/proc/mdstat`、`lsblk`、`/v2/snapshot/volumes`、`/v2/raid` 四个视图,验收时随时对账用。

**开机安全性已确认**:后端写 `@snapshots` 到 fstab 时带 `nofail,x-systemd.device-timeout=10s`(`service/snapshot/mount.go:107` 有注释解释就是为了这个),所以即使忘了 `down` 就重启,假盘消失也不会让 `local-fs.target` 失败、不会掉进 emergency mode。`down` 仍然要做,只是它不是最后一道防线。

### 4.3 验收分两轮

4 块盘满足不了所有场景,拆两轮建台。台子重建成本很低(`down` + `up` 十几秒)。

**第一轮 —— 两个 2 盘 RAID1**(`sda+sdb`、`sdc+sdd`)

专门验 P5 终审抓出的那条 **Critical**:快照状态从 Vue2 组件 `data()` 提到 Pinia 单例后漏了复位与 `volumeUuid` watcher,换阵列后面板显示 A 的开关/快照数/策略摘要、**写操作却打到 B**。修法(`store.reset()` + onMounted/watch 先 reset 再 load + 过期响应守卫 + 空 uuid 早退)当初只有单测锁着,真机从没跑过。两个阵列才验得了「换卷」。

同时覆盖:阵列列表两张卡、两套独立的快照策略、时间线互不串。

**第二轮 —— 3 盘 RAID5 + 1 块备用**(`sda+sdb+sdc` 建阵列,`sdd` 留作备用盘)

验 P4 全套写操作,顺序即真实故障演练:

1. 创建向导:选盘 → 级别推荐 watcher → RaidMatrix 矩阵 → 文件系统 btrfs + 快照默认勾选 → 重名校验 → 提交 → 创建任务卡 + 1500ms 轮询 + 6 步弹窗(**这一步同时验 P3 的任务卡链路**)
2. `mdadm --fail` 人工打故障 → 列表/详情进入 degraded → **P3 的 5000ms 重建态活体重拉**
3. 详情页出现换盘入口 → 换成 `sdd` → 观察重建
4. 恢复(`.rd-recover`)
5. 快照面板全套:三态开关 / 保留策略读-改-写 / 手动创建 / 按天分组时间线 / 删除快照
6. type-to-confirm 删阵列收尾

### 4.4 验收伺服

5273 `vite preview`(`vite.config.ts` 的 `preview.proxy` 块已随 SP6 合并进 master)。它伺服的是 `pnpm build` 的**生产构建产物**,API catch-all 代理到 80 端口真后端 —— 「真机验」这件事它是够的。

选它而不是 `deploy.sh` 的理由与验收无关:桌面存储磁贴在 P1 就已改指向 `/storage` 且**没有 `strangler:disabled:/storage` 回退 flag**(台账 P6 第二条),一旦部署,存储区就等于对真实入口上线且浏览器侧回滚不掉 —— 那正是 P6 cutover 该干的事和该补的护栏。P5.5 把「验收」和「上线」分开。

### 4.5 缺陷处理

真机暴露的问题按 TDD 修:先写能复现的失败测试,再改实现。凡属「单测 mock 成功信封而真机是裸信封」这一类,必须在共享包侧 `curl` 实证后再改,并把该端点的真实信封形状记进台账。

### 4.6 完成定义

- [ ] `IsDiskSupported` 白名单补丁 + Go 单测(`service/disk_test.go` 现无 `IsDiskSupported` 覆盖,本期顺带补齐),`deploy.sh local-storage` 部署生效
- [ ] `raidlab.sh` up/down/status 三命令可用,护栏经过反向测试(喂 nvme 路径必须拒绝)
- [ ] 两轮验收清单逐条走完,每条标 ✅ / ❌ / N/A
- [ ] 暴露的缺陷全部修完并有回归测试,或明确记账推迟
- [ ] 全量测试 + `vue-tsc` + color-guard/parity + `pnpm build` 全绿
- [ ] `down` 执行后设备回到基线(`/proc/mdstat` 空、`avail` 空、fstab 无残留)
- [ ] roadmap 台账 C11 / C12 关闭,B8「混盘容量警告」结论落定

## 5. 第二段:SP6-P7 文件区快照套件

### 5.1 现状核查

P5 只搬走了 Vue2 `service/snapshot.js` 的**视图助手**(`resolveSnapshotState` / `validatePolicyForm` / `classifySnapshotType` / `formatSnapshotClockTime` / `snapshotDayLabel` / `toSnapshotViewModel` / `groupSnapshotsByDay` / `defaultExpandedDayKeys`,现在在 `src/storage/util/snapshotView.ts`)。

**六个路径助手一个没搬**,共享包里也没有 —— 它们是文件区套件的地基:

| 函数 | 作用 |
|---|---|
| `snapshotBrowsePath(mount, name)` | 构造 `<mount>/.snapshots/<name>` 浏览入口 |
| `parseSnapshotBrowsePath(absPath)` | 反向解析成 `{mount, snapshotName, relPath}`;**纯路径段匹配**,取最左侧的 `.snapshots` 段 |
| `liveVolumePath(mount, relPath)` | 快照相对路径 → 活卷上的对应位置 |
| `parseSnapshotName(name)` | 从 `<ISO8601 basic>Z_<type>` 名字里取时间;**故意不校验 type 段**,未知类型也要能显示真实时间 |
| `formatSnapshotBannerTime(name)` | 横幅文案用;解析失败回退显示原始名字 |
| `findVolumeForPath(volumes, path)` | **最长前缀匹配**找当前路径属于哪个卷(与 `findVolumeUuidForMount` 的精确匹配相反) |

### 5.2 移植清单

| Vue2 源 | 行数 | 去向 |
|---|---|---|
| `service/snapshot.js:144-240`(6 个路径助手) | ~100 | 共享包 `NimoOS-Service/src/snapshot.ts`(纯函数,SP10 后 New-UI 仍要用) |
| `filebrowser/snapshotBrowse.js` | 146 | `src/files/util/snapshotBrowse.ts` + `src/files/stores/snapshotBrowse.ts` |
| `components/SnapshotBanner.vue` | 86 | `src/files/components/SnapshotBanner.vue` |
| `components/SnapshotActionBar.vue` | 87 | `src/files/components/SnapshotActionBar.vue` |
| `components/SnapshotTimeWheel.vue` | 621 | `src/files/components/SnapshotTimeWheel.vue` |
| `components/snapshotStackMath.js` | 102 | `src/files/util/snapshotStackMath.ts` |
| `components/SnapshotSettingsModal.vue` | 371 | `src/files/components/SnapshotSettingsDialog.vue` |
| `FilePanel.vue` 快照分支 | — | `src/views/Files.vue` + 工具栏 |
| `ContextMenu.vue` `isInSnapshot` 分支 | — | `src/files/components/FileContextMenu.vue` |
| `EmptyHolder.vue` `readOnly` 分支 | — | New-UI 对应空态组件 |

### 5.3 必须原样保住的三条不变式

这三条都是 Vue2 侧经过 review 迭代才定下来的,注释里写明了理由,移植时不得"顺手优化":

1. **`shouldGuardSnapshotView` 的 fail-safe 方向**:只有在**确证**该 mount 的 `supported === false` 时才解除只读锁。「还没拉取」「拉取失败」「卷列表里根本没这个 mount」三种情况**一律保持锁定**。理由:误锁只是把一个恰好叫 `.snapshots` 的普通目录短暂显示成只读(烦人);漏锁则让写请求打到只读 btrfs 快照上,用户拿到裸文件系统报错(更糟)。
2. **`parseSnapshotBrowsePath` 是路径段匹配,不是 `includes`**:且取**最左侧**的 `.snapshots` 段 —— 快照内容里合法地可以再有一个叫 `.snapshots` 的子目录,那是被快照的真实数据,不是第二个卷边界。
3. **`SnapshotActionBar` 只有两个动词**(恢复 + 下载),且**没有关闭按钮** —— 取消选择走和选择一样的路径(列表复选框),选空了自己隐藏。这是用户当初定的 Time Machine 风格受限动词集。

另外 `snapshotStackMath.js` 的 `mulberry32` 种子随机星空必须保留:真 `Math.random()` 会让星星在每次无关重渲染时跳位,同时测试也没法断言。

### 5.4 分七步

| 步 | 内容 | 依赖 |
|---|---|---|
| **P7-0** | 共享包补 6 个路径纯函数(TS 化 + 单测) | — |
| **P7-1** | `snapshotBrowse` 纯逻辑 + Pinia store(含 §5.3 第 1、2 条不变式的回归测试) | P7-0 |
| **P7-2** | `SnapshotBanner` + 写操作闸门(`blockedBySnapshotView`:快照视图下拦截所有写动作,给友好提示而非裸报错) | P7-1 |
| **P7-3** | `SnapshotActionBar` + 空态只读变体 + 右键菜单只读分支 | P7-2 |
| **P7-4** | `SnapshotTimeWheel`(星空 / 3D 卡片栈 / 鱼眼刻度带 / 键盘步进) | P7-1 |
| **P7-5** | `SnapshotSettingsDialog` | P7-4 |
| **P7-6** | `Files.vue` 接线 + 工具栏入口按钮(仅在后端确证 supported 的卷上出现)+ 深链 + 时间线 `[浏览]` 按钮接回 | 全部 |

**P5 留的占位要拆掉**:`SnapshotTimeline.vue` 里 `[浏览]` 按钮当初有意不做,留了占位注释 + 负向断言。P7-6 要把负向断言换成正向断言。

原语替换沿用 P5 既定口径(New-UI 无 buefy):`b-modal` → 共享 `Dialog`、`b-switch` → 手写 `role="switch"` 并带 accessible name、`b-input`/`b-numberinput` → 原生控件、`b-tooltip` → New-UI 现有 tooltip 方案。配色一律 token 化(横幅的琥珀 `#fef9c3`/`#92400e` → `--dem-fg` 系,与 P5 的 preop 徽章同源)。

### 5.5 完成定义

- [ ] 七步逐步 implementer/reviewer 双人 + 整支 Opus 终审(SP6 既定流程)
- [ ] §5.3 三条不变式各有能**真失败**的回归测试(注释掉实现即转红)
- [ ] i18n 中英双写齐、零中文字面量、color-guard 零硬编码色
- [ ] 全量测试 + `vue-tsc` + `pnpm build` 全绿
- [ ] 在 P5.5 的测试阵列上实盘验:进快照 → 只读锁生效 → 时光轮选时间点 → 恢复文件 → 退出回活卷
- [ ] roadmap 台账 B6 关闭

## 6. Roadmap 落点

改 `NimoOS-UI/docs/vue3-migration-roadmap.md`:

1. **新增 `#### ⬜ P5.5 多盘测试台 + P3/P4/P5 实盘验收`**,插在 P5 条目与 P6 之间。用小数号是因为它不迁新 UI、只清环境挂账,性质同 SP3.5/SP3.6 先例,且不用动 P6 编号。
2. **新增 `#### ⬜ P7 文件区快照套件`**,排在 P6 之后。挂 SP6 而不是 SP4.5:它吃的是 SP6 的地盘(共享包 `snapshot` 域 + `/v2/snapshot/*` 后端 + P5.5 的阵列),而 SP4 已 cutover 收官,掀开一个已关的 SP 更别扭。
3. **台账 C11** 改为已解除(2026-07-28 用户部署,`/v2/snapshot/*` 全部 200)。
4. **台账 C12** 从「随多盘设备补」改为「由 P5.5 的 scsi_debug 测试台解锁」。
5. **台账 B6** 末尾指向 SP6-P7,`[浏览]` 缺席改为「P7 补回」。
6. **台账 B8** 里「混盘容量警告建议随多盘实盘验一并补」→ 归入 P5.5。
7. **第 50 行 SP6 总表行**状态摘要同步。

## 7. 风险

| 风险 | 处置 |
|---|---|
| 选错盘导致 `/DATA` 被清扫 | `raidlab.sh` 硬护栏(`device/model == scsi_debug` 断言 + 见 nvme 即退);`up` 阶段核对 `avail` 只含假盘才放行 |
| 忘记 `down` 就重启 | 后端 fstab 用 `nofail` + 10s device-timeout,不会进 emergency mode;`down` 仍是标准收尾 |
| `scsi_debug` 假盘的 SMART / 温度 / 通电时长字段为空,与真盘 UI 表现不同 | 属预期,验收清单里对这类字段标 N/A,不当缺陷 |
| 512 MB 盘太小导致 btrfs 或 RAID5 行为异常 | btrfs 最小 ~256 MB,512 MB × 3 的 RAID5 可用空间约 1 GB,足够建若干快照;若实测不足则调到 1024 MB(内存仍有余量) |
| P7 的时光轮是全屏 3D 动画,jsdom 测不了视觉 | 数学部分(鱼眼/栈序/星空)在 `snapshotStackMath` 里纯函数单测;视觉部分靠实盘眼验,同 SP2-P2/P4c 口径 |
