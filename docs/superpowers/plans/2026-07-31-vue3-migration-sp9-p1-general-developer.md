# SP9-P1 设置 general + developer 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 P0 立好的 general / developer 两个空骨架填成完整功能页 —— 设备信息卡、8 个设置行、2 个更新行、开发者入口、侧栏电源流(6 状态浮层)、developer 页的 HTTPS 开关与配置弹窗 —— 并把共享包 `sys` 域从 3 个方法补全到 20 个。

**Architecture:** Vue2 `SettingsPanel.vue` 的 general 分支(L65-324)+ developer 分支(L326-348)+ 侧栏电源块(L33-46)+ 电源浮层(L686-790)。New-UI 侧拆成:**行级原语**(`SettingsRow` / `SettingsSwitch` / `.set-list` CSS)承载重复的「左图标+标签、右控件」骨架;**每行一个 `.vue`** 各自持有自己的请求与状态,`GeneralPanel` 只做装配与排序;**跨行共享的服务端配置**(timezone / 各开关 / disk_standby)统一走 `systemConfig.ts` 的**串行读改写**队列 —— 因为 `locale` store 早已在同一个 `system` blob 上做读改写,不串行会丢写。电源流的相位机与端口探活抽成可单测的纯逻辑模块。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript(strict) · vue-i18n 9 · vitest + @vue/test-utils(含 `vi.useFakeTimers`) · 原生 `<select>`(全仓 7 处既有惯例,无 reka Select) · `markdown-it`(经 `src/files/viewers/renderMarkdown.ts`) · socket.io-client(经 `useMessageBus`) · 手写 CSS

---

## Global Constraints

以下每条对**每个**任务都生效,不再逐任务重复。

- **工作目录:主工作树,不开 worktree。**
  - New-UI:`/home/nimo/NimoTech/NimoOS-New-UI`,分支 `master`,基线 `148476e`
  - Service:`/home/nimo/NimoTech/NimoOS-Service`,分支 `master`,基线 `425f4f0`
  - **`.sp7/` 与 `.sp8/` 是别人的 worktree,全程不碰。**
- **⚠️ 提交一律显式 pathspec**:`git commit <path> [<path>…] -m "…"`。**永不** `-a`、**永不** `git add -A`、**永不** `git stash -u`。
  **原因:主工作树 index 里长期躺着 3 个 `design-export/*.html` 的 staged 删除,不属于本期** ——
  ```
  D  "design-export/Audio Speaker Segmentation.html"
  D  design-export/audio-waveform-design-kit.html
  D  design-export/design-final.html
  ```
  **既不要提交掉,也不要 `git restore` 恢复。** 每次提交前 `git status --short` 确认这 3 行还在原位。
- **颜色只能走 theme token**(`var(--…)`)。本期新语义 token 一律加进 `src/styles/theme.sp9.css`,且 `:root{}` 与 `:root[data-theme="light"]{}` **两块都要给值**。**全程不碰 `src/styles/theme.css`**。
- **i18n 新 key 只落分片**:`src/i18n/zh_cn.sp9.ts` 与 `src/i18n/en_us.sp9.ts`,**必须同时加**,**扁平 key、值必须是字符串**(`parity.test.ts` 断言)。**全程不碰 `zh_cn.ts` / `en_us.ts`**。
- **测试里读 `.css` 源码一律用 `node:fs`**(文件级 `/// <reference types="node" />`)。`?raw` / `?inline` 在 vitest 下**恒返回空串**,会让守卫空转(P0 台账「发现一」)。
- **移植纪律**(roadmap 2026-07-27 拍板):**界面严格 1:1;Vue2 的 bug / 竞态 / 吞错不照抄**,改正确并在代码里注释登记;**禁无关重构**。本期已识别的「改正确」项集中列在下面 §「移植纪律登记」。
- **fixture 纪律**:HTTP 信封 fixture **必须真机逐字抓取,不得手编**。本计划所有 fixture 已于 **2026-07-31 curl 实证**,原始文件在 `/tmp/claude-1000/-home-nimo-NimoTech/44ec0cb3-105d-4d6a-afe4-e9e2cafa37b8/scratchpad/fixtures/`,各任务内已内联可直接抄。新增的自己抓。
- **任务门**:每个任务收尾跑 `pnpm test` + `pnpm exec vue-tsc --noEmit`。
  - New-UI 基线(已实测 2026-07-31)= **269 文件 / 1935 测试全绿 + tsc 零错误**
  - Service 基线(已实测 2026-07-31)= **24 文件 / 133 测试全绿**
  - 判定:**tsc 零错误、测试零失败、总数只增不减**。
- **验收起 dev server**:`pnpm dev --host`,浏览器 `http://192.168.1.143:5273/app/#/settings`。dev proxy 已于 `148476e` 修好,能正常登录。**不要跑 `./scripts/deploy.sh`。**
- **⚠️ 自查时不许按的按钮**(会真的动这台机器,不可逆):
  - **关机 / 重启** —— 会真的关掉/重启开发机
  - **固件更新的 Upgrade Now / 系统更新的 Update Now** —— 会真的触发升级并重启
  - **改 WebUI 端口的提交按钮** —— 会真的换掉网关端口,可能导致自己访问不到
  这三条的正确性靠单测(相位机 / 校验 / 探活都是纯逻辑)+ 代码走查,**实机确认留给用户最终验收**。自查只验界面形状、加载态、非破坏性读接口。
- 包管理器 **pnpm**。改完 Service 必须 `cd ../NimoOS-Service && pnpm build`;若 New-UI 构建报 `Module not found`,再 `cd ../NimoOS-New-UI && pnpm install` 重新同步 `file:` 链接。

---

## 实测校正(本节优先于 spec §5.1 的字面记载)

开工前已逐条 curl / 读 Go 源码核对,以下 6 条与 spec 或 Vue2 表面读法不一致,**以本节为准**。

### 1. `/v1/gateway/components` 与 `/v1/gateway/device-info` 是**裸 JSON,没有信封**

同一个 `/v1/gateway/*` 前缀下**信封层数按端点不同** —— `port` / `ssl` 有信封,`components` / `device-info` 没有:

```
GET /v1/gateway/port          → {"success":200,"message":"ok","data":"80"}
GET /v1/gateway/ssl           → {"success":200,"message":"ok","data":{"enabled":false,...}}
GET /v1/gateway/components    → {"components":[{"name":"Gateway",...}]}      ← 裸
GET /v1/gateway/device-info   → {"hostname":"NimoOS","os":"nimoos","version":"..."}  ← 裸
```

**这两个方法不能套 `unwrap()`**,套了必抛。(记忆里「核字段名≠核信封层数」栽过的同一个坑。)

### 2. 命名陷阱(spec §5.1 已警告,此处给出实测值)

| Vue2 方法 | 实际端点 | 实测返回 | 包内新名 |
|---|---|---|---|
| `getVersion()` | `GET /v1/sys/os_version` | `{"current_version":"1.0.0","need_update":false}` | **`getOsVersion()`** |
| `getAppVersion()` | `GET /v1/sys/version` | `{"current_version":"1.9.3-alpha1+25.gc8d7d14-dirty","need_update":false}` | **`getAppVersion()`** |

包里**现有的** `getVersion()` 打的是 `/sys/version`,语义上等于 `getAppVersion()` → 保留为 **deprecated 别名**(SP1 起已有调用方,不能删)。

**Vue2 的行标签与数据源是交叉的,1:1 移植照留:**
- 标签「Firmware Update」+ 副标题 `hardwareInfo.version`,数据用 `updateInfo`(来自 `os_version`)
- 标签「System Update」(源码注释写 `<!-- App Update -->`)+ 副标题 `appUpdateInfo.current_version`,数据用 `appUpdateInfo`(来自 `version`)

### 3. 包需要 2 个 spec 表外的方法

spec §5.1 的表漏了 UpdateModal 流程必需的两个(spec 同时把 UpdateModal 划进 P1,故必须补):

| 方法 | 端点 | Go 源码 |
|---|---|---|
| `updateOs()` | `POST /v1/sys/os_update` | `NimoOS/route/v1.go:96` |
| `cancelDownload()` | `POST /v1/sys/download/cancel` | `NimoOS/route/v1.go:99` |

另外 `getOsVersion` / `getAppVersion` **必须支持 `trigger_download=1` 查询参数**(下载靠它触发,不是单独端点):`NimoOS/route/v1/system.go:78` 与 `:135` —— `utils.DefaultQuery(ctx,"trigger_download","0")=="1"`。

### 4. 两处死代码 —— **用户 2026-07-31 拍板:都跳过 + 登记**

| 死代码 | 为什么永远不显示 | 处置 |
|---|---|---|
| `UpdateCompleteModal.vue`(177 行,spec §5.1 点名) | 只由 `Home.vue:72` 在 `localStorage['is_update']==='true'` 时弹;**全仓 grep 该键只有读(`Home.vue:72`)和删(`:74`),没有任何一处写** → 从未弹过。触发器没造。 | **不移植。** 登记债务 D14 |
| general 页「显示其他 Docker 容器应用」开关行(`SettingsPanel.vue:239`) | 条件 `notImportList.length>0`,而 `SET_NOTIMPORT_LIST`(`store/mutations.js:152`,注释 `TODO v2 does not have`)**从没被 commit 过** → 恒为 `[]` → 行恒不渲染。且执行端也断:`AppSection.vue:235` 的 `exsitingAppsShow` 计算属性**模板里从没引用**,`SET_EXISTING_APPS_SWITCH` 也从没被 commit。 | **不移植。** 登记债务 D15 |

依据:1:1 铁律护的是**用户看得见的界面**,这两处用户从未看见;照抄等于把烂尾工程搬进新仓库。同 spec §1.8 处理 `PortPanel.vue` 的先例。

> **`existing_apps_switch` 这个 key 仍要在 `systemConfig.ts` 的类型里保留**(Vue2 的 `system` blob 里有它,读改写不能把它丢掉),只是 general 页不渲染对应行。

### 5. Premium 推广条 —— **用户 2026-07-31 拍板:不做,登记为授权偏离 #6**

Vue2 general 顶部 L67-73:「Unlock full potential with Premium / Enhance your system with advanced features」+ `Upgrade Now` 按钮(**Vue2 侧就没有任何 `@click`**)。本期不移植。

### 6. 其余已核实的接口形状(全部 2026-07-31 curl 实证)

```
GET /v1/sys/baseinfo   → {"success":200,"message":"ok","data":{"device_id":"2389ab5a67ce8f1d541d5c5048afd5cd","model":"","version":"1.9.3-alpha1+25.gc8d7d14-dirty"}}
GET /v1/sys/hardware   → {"success":200,"message":"ok","data":{"arch":"amd64","cpu_cores":6,"cpu_freq":4600,"cpu_model":"Intel(R) Core(TM) 5 320","drive_model":"","gpu_list":["Intel Corporation Wildcat Lake [Intel Graphics] (rev 01)"],"hardware_id":"nimoos-standard-v1","hardware_name":"","ram_speed":"8533 MT/s","ram_total":16335863808,"ram_type":"LPDDR5","version":"1.9.3-alpha1+25.gc8d7d14-dirty"}}
GET /v1/sys/paths      → {"success":200,"message":"ok","data":{"app_data":{"path":"/DATA/AppData","size":6037987},"database":{"path":"/DATA","size":3620107023},"images":{"path":"/DATA/.system_data/.docker & .containerd","size":55549158661},"photos_data":{"path":"/DATA/.system_data/photos","size":6242113651}}}
GET /v1/sys/logs       → {"success":200,"message":"ok","data":"<2.9MB 纯文本>"}
GET /v1/gateway/ssl    → {"success":200,"message":"ok","data":{"enabled":false,"port":"443","domain":"nimoos.local","cert_type":"auto","effective_time":"0001-01-01T00:00:00Z","expiration_time":"0001-01-01T00:00:00Z"}}
GET /v1/usb/usb-auto-mount → {"success":200,"message":"ok","data":"True"}     ← 字符串 "True"/"False",不是布尔
```

**写侧载荷(读 Go 源码确认,未 POST):**
- `PUT /v1/sys/state/{off|restart}` —— 只认 `off` / `restart`,**其他值也返回 200 但什么都不做**(`NimoOS/route/v1/system.go:552-560`)→ 包里把参数类型收窄成字面量联合
- `PUT /v1/sys/disk/standby` —— `{"minutes": <int>}`,缺 `minutes` 返 400(`system.go:606-624`)
- `PUT /v1/usb/usb-auto-mount` —— `{"state":"on"|"off"}`(`NimoOS-LocalStorage/route/v1/usb.go:29-42`)
- `POST /v1/sys/migrate` —— `{"type","target_mount"}` → `{"job_id":"<uuid>"}`(`system.go:425-437`)
- `GET /v1/sys/migrate/{id}` —— `MigrateStatus`,字段照 `NimoOS/service/migrate.go:46-57` 逐字:
  `id / type / status("running"|"done"|"error") / phase("stopping_services"|"copying"|"starting_services") / stopping_apps / progress / processed_size / total_size / new_path? / error?`
  > migrate 两个方法本期只**进包**(spec 要求),消费在 P3。**没有 curl 过**(不能在开发机上真跑迁移),类型依据是 Go struct 而非实测响应 —— 已在包内注释标注,P3 消费前须抓一次真实 fixture 复核。

---

## 移植纪律登记(Vue2 的 bug / 竞态不照抄,共 7 处)

每一处都要在代码里就近写注释登记,格式照 P0 `lastTab.ts` 的先例。

| # | Vue2 的问题 | 本期怎么改正确 |
|---|---|---|
| 1 | **挂载即回写配置。** `getConfig()` 把服务端配置塞进 `barData`(`SettingsPanel.vue:1290`)→ 触发 `barData` 深度 watcher(`:1206`)→ 立刻 `saveData()` 把刚读到的东西原样写回去。每次打开设置都白写一次。 | New-UI **不设深度 watcher**;每行只在**用户操作时**显式 `patchSystemConfig({…})`。加载不触发写。 |
| 2 | **挂载即下发硬盘待机指令。** `'barData.disk_standby'` watcher(`:1230`)在初次 hydrate 时也会 fire → 每次打开设置都对磁盘下一次 standby 指令。 | 只在用户改动 select 时调 `setDiskStandby`。 |
| 3 | **`system` blob 丢写竞态。** Vue2 `saveData()` 整块覆写 `system`;New-UI 侧 `stores/locale.ts` 已在同一个 key 上做「读→改 lang→写」。两条路径并发必丢写。 | 新增 `systemConfig.ts`,**模块级 Promise 串行队列** + 队列内重新读取再合并;`locale.ts` 改为复用它。 |
| 4 | **端口探活定时器泄漏。** `checkUpdate()`(`:1424`)每 1500ms 探活新端口,**只在成功时 `clearInterval`**;端口没起来就一直探到组件销毁(`beforeDestroy` 才清)。 | 探活**上限 40 次(≈60s)**,超时停表 + 提示用户手动访问;组件卸载也清。 |
| 5 | **换端口后跳到旧 UI。** Vue2 成功后 `window.open(\`${protocol}//${host}:${port}\`,'_self')` —— 跳根路径。New-UI 挂在 `/app/`,照抄会把用户甩进旧 Vue2 界面。 | 跳 `${protocol}//${host}:${port}${location.pathname}${location.hash}`,留在新 UI 当前页。 |
| 7 | **初次异步加载会盖掉用户已做的修改。** 各行都是 `onMounted` 里 `await` 取服务端值、回来再赋给本地 ref。真机有网络往返,用户在结果回来之前就动了控件时,后到的旧快照会把用户的选择"抹回去"(写已经发出去了,只有界面回退)—— 观感上就是"我明明选了,它自己跳回去了"。**本仓库这个坑已被评审逮到过多次。** | 每个组件在赋值前自查一次「用户是否已经动过」(本地 `touched` 标志即可),动过就不覆盖。**不要抽公共 guard / composable** —— 早先的评审已判定那是过早抽象;就地写、写注释说明为什么在。回归测试必须走**交错**路径(用可手动 resolve 的 deferred 卡住加载 → 期间改控件 → 再 resolve → 断言仍是用户的值);先 await 完再改的顺序测试证明不了任何事。<br>**适用组件**:`TimezoneRow` / `DiskStandbyRow`(Task 5,已修)· `WebUiPortRow`(Task 6)· `UsbAutoMountRow` / `SwitchRow`(Task 7)· `DeveloperPanel` 的 HTTPS 开关与 `WebUiHttpsDialog` 的表单(Task 11) |
| 6 | **电源探活会被认证拦截器劫持。** Vue2 用 `$api.users.getUserStatus()` 探活;重启期间若返 401,共享包的 `onAuthFail` 会清 token 并跳登录页,把电源流打断。 | 探活改用裸 `fetch('/v1/users/status',{cache:'no-store'})`,**拿到任何 HTTP 响应(含 401)都算「服务器活着」**,只有网络错误才算「下线」。语义上更准。 |

---

## File Structure

### NimoOS-Service(改 4 个文件)

| 文件 | 职责 |
|---|---|
| `src/types.ts` | **改。** 扩 `HardwareInfo` 实测字段;新增 `UpdateCheck` / `SysBaseInfo` / `SystemPaths` / `SSLConfig` / `SSLConfigInput` / `GatewayComponent` / `GatewayDeviceInfo` / `MigrateStatus` |
| `src/sys.ts` | **改。** `createSys` 从 3 个方法补到 20 个 |
| `src/sys.test.ts` | **改。** 每个新方法一组用例,fixture 用 2026-07-31 实测信封 |
| `src/index.ts` | **改。** 导出新类型 |

### NimoOS-New-UI

| 文件 | 职责 |
|---|---|
| `src/i18n/zh_cn.sp9.ts` / `en_us.sp9.ts` | **改。** 加 P1 文案(约 60 键) |
| `src/styles/theme.sp9.css` | **改。** 加 `--set-warn-fg`(两套主题块都给值) |
| `src/settings/styles/settings.css` | **改。** 加 `.set-list` / `.set-list-item` / `.set-card` / `.set-pill` 等跨行复用骨架 |
| `src/settings/util/systemConfig.ts` + `.test.ts` | **新建。** `system` blob 的串行读改写(纪律 #3) |
| `src/stores/locale.ts` + `locale.test.ts` | **改。** 改为复用 `systemConfig.ts` |
| `src/settings/util/timezones.ts` | **新建。** 时区表(逐字照抄 Vue2 L871-933) |
| `src/settings/util/standby.ts` + `.test.ts` | **新建。** 待机选项表 + `parseStandbyMinutes` |
| `src/settings/util/checkUiPort.ts` + `.test.ts` | **新建。** 新端口探活(带次数上限,纪律 #4) |
| `src/settings/util/powerFlow.ts` + `.test.ts` | **新建。** 电源相位机 + `probeAlive`(纪律 #6) |
| `src/settings/components/SettingsRow.vue` + `.test.ts` | **新建。** 一行的通用骨架 |
| `src/settings/components/SettingsSwitch.vue` + `.test.ts` | **新建。** `role=switch` 开关 |
| `src/settings/components/DeviceInfoDialog.vue` + `.test.ts` | **新建。** 设备信息弹窗(对位 `DeviceInfoPanel.vue`) |
| `src/settings/components/UpdateDialog.vue` + `.test.ts` | **新建。** 更新弹窗(对位 `UpdateModal.vue`) |
| `src/settings/components/PowerOverlay.vue` + `.test.ts` | **新建。** 6 状态浮层(纯展示,只吃 phase) |
| `src/settings/components/PowerFlow.vue` + `.test.ts` | **新建。** 侧栏两按钮 + 确认 + 驱动相位机 |
| `src/settings/components/WebUiHttpsDialog.vue` + `.test.ts` | **新建。** HTTPS 配置弹窗(对位 `WebUIHTTPSModal.vue`) |
| `src/settings/panels/general/DeviceInfoCard.vue` + `.test.ts` | **新建。** 设备信息卡 |
| `src/settings/panels/general/WallpaperRow.vue` + `.test.ts` | **新建。** 壁纸行(按钮禁用,D5) |
| `src/settings/panels/general/LanguageRow.vue` + `.test.ts` | **新建。** 语言行(只 2 项,D6) |
| `src/settings/panels/general/TimezoneRow.vue` + `.test.ts` | **新建。** 时区行 |
| `src/settings/panels/general/DiskStandbyRow.vue` + `.test.ts` | **新建。** 硬盘待机行 |
| `src/settings/panels/general/WebUiPortRow.vue` + `.test.ts` | **新建。** WebUI 端口行 |
| `src/settings/panels/general/UsbAutoMountRow.vue` + `.test.ts` | **新建。** USB 自动挂载行 |
| `src/settings/panels/general/SwitchRow.vue` + `.test.ts` | **新建。** 推荐应用 / 新闻流两行共用(后者带确认) |
| `src/settings/panels/general/UpdateRow.vue` + `.test.ts` | **新建。** 更新行(firmware / app 两用) |
| `src/settings/panels/GeneralPanel.vue` + 扩 `panels.test.ts` | **改。** 装配 |
| `src/settings/panels/DeveloperPanel.vue` | **改。** HTTPS 开关 + 配置入口行 |
| `src/settings/components/SettingsShell.vue` | **改。** `.set-rail-foot` 里塞 `<PowerFlow />`(**本期唯一一次碰它**,减小与 sp7/sp8 的冲突面) |

**每行一个 `.vue`** 是有意的:每行各自持有自己的 loading / 错误 / 请求状态,写在一个巨型 `GeneralPanel.vue` 里会变成 Vue2 那种 3095 行文件,单测也无法只测一行。

---

## Task 1: 共享包 `sys` 域补全(3 → 20 个方法)

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-Service/src/types.ts`
- Modify: `/home/nimo/NimoTech/NimoOS-Service/src/sys.ts`
- Modify: `/home/nimo/NimoTech/NimoOS-Service/src/sys.test.ts`
- Modify: `/home/nimo/NimoTech/NimoOS-Service/src/index.ts`

**Interfaces:**
- Consumes: 既有 `unwrap()`(`success===200` 才返 `data`,否则抛带 `code` 的 `Error`)、既有 `createSys(http)` 工厂形态
- Produces: 下列 20 个方法与 8 个类型,后续**所有**任务都消费它们

```ts
// 类型(src/types.ts)
export interface UpdateCheck {
  current_version: string
  latest_version?: string
  need_update: boolean
  is_downloaded?: boolean
  is_downloading?: boolean
  is_paused?: boolean
  download_progress?: number
  version?: { change_log?: string; [k: string]: unknown }
}
export interface SysBaseInfo { device_id: string; model: string; version: string }
export interface SystemPathEntry { path: string; size: number }
export type SystemPaths = Record<string, SystemPathEntry>
export interface SSLConfig {
  enabled: boolean; port: string; domain: string; cert_type: string
  effective_time: string; expiration_time: string
}
export interface SSLConfigInput { enabled: boolean; domain: string; port: string; cert_type: string }
export interface GatewayComponent {
  name: string; category: string; version: string; status: string; error: string; probed_at: string
}
export interface GatewayDeviceInfo { hostname: string; os: string; version: string }
export interface MigrateStatus {
  id: string; type: string; status: string; phase: string
  stopping_apps: number; progress: number
  processed_size: number; total_size: number
  new_path?: string; error?: string
}

// 方法(src/sys.ts,createSys 的返回对象)
getUtilization(): Promise<Utilization>                             // 既有,不动
hardwareInfo(): Promise<HardwareInfo>                              // 既有,不动
getVersion(): Promise<{ current_version: string }>                 // 既有,保留为 deprecated 别名
getOsVersion(params?: { trigger_download?: 1 }): Promise<UpdateCheck>
getAppVersion(params?: { trigger_download?: 1 }): Promise<UpdateCheck>
getBaseInfo(): Promise<SysBaseInfo>
getLogs(): Promise<string>
getSystemPaths(): Promise<SystemPaths>
migrateAppPath(type: string, targetMount: string): Promise<{ job_id: string }>
getMigrateStatus(jobId: string): Promise<MigrateStatus>
power(action: 'off' | 'restart'): Promise<void>
setDiskStandby(input: { minutes: number }): Promise<void>
updateApp(): Promise<void>                                          // 必须 unwrap:后端错误也返 HTTP 200
updateOs(): Promise<void>                                          // 同上
cancelDownload(): Promise<void>
getServerPort(): Promise<string>
editServerPort(input: { port: string }): Promise<void>
getSSLConfig(): Promise<SSLConfig>
setSSLConfig(cfg: SSLConfigInput): Promise<void>
uploadSSLCert(form: FormData): Promise<void>
getGatewayComponents(): Promise<GatewayComponent[]>                // 裸 JSON,不 unwrap
getDeviceInfo(): Promise<GatewayDeviceInfo>                        // 裸 JSON,不 unwrap
getUsbStatus(): Promise<boolean>                                   // "True" → true
toggleUsbAutoMount(input: { state: 'on' | 'off' }): Promise<void>
```

- [ ] **Step 1: 扩 `HardwareInfo` 并新增 8 个类型**

`src/types.ts` 现有的 `HardwareInfo` 只有 `arch` + 索引签名,`DeviceInfoDialog` 要读一堆字段却全是 `unknown`。按实测 fixture 补上具名可选字段(索引签名保留,别的调用方在用):

```ts
// curl 实证 2026-07-31 GET /v1/sys/hardware:
// {"arch":"amd64","cpu_cores":6,"cpu_freq":4600,"cpu_model":"Intel(R) Core(TM) 5 320",
//  "drive_model":"","gpu_list":["Intel Corporation Wildcat Lake [Intel Graphics] (rev 01)"],
//  "hardware_id":"nimoos-standard-v1","hardware_name":"","ram_speed":"8533 MT/s",
//  "ram_total":16335863808,"ram_type":"LPDDR5","version":"1.9.3-alpha1+25.gc8d7d14-dirty"}
// hardware_name / drive_model 在本机是空串 —— 消费方必须有回退,不能假设非空。
export interface HardwareInfo {
  arch: string
  cpu_cores?: number
  cpu_freq?: number
  cpu_model?: string
  drive_model?: string
  gpu_list?: string[]
  hardware_id?: string
  hardware_name?: string
  ram_speed?: string
  ram_total?: number
  ram_type?: string
  version?: string
  [k: string]: unknown
}
```

然后把上面 `Interfaces` 块里的 8 个新 interface 原样加到 `src/types.ts` 末尾。

- [ ] **Step 2: 写失败测试 —— 信封类方法**

追加到 `src/sys.test.ts`(文件顶部已有 `fakeHttp` / `http` 两个桩,直接复用;写侧要新桩):

```ts
// 记录 post/put 调用的桩:断言 URL 与载荷
function writeHttp(reply: unknown = { success: 200, message: 'ok', data: null }) {
  const calls: { method: string; url: string; body?: unknown; config?: unknown }[] = []
  return {
    calls,
    http: {
      get: async (url: string, config?: unknown) => { calls.push({ method: 'get', url, config }); return { data: reply } },
      post: async (url: string, body?: unknown, config?: unknown) => { calls.push({ method: 'post', url, body, config }); return { data: reply } },
      put: async (url: string, body?: unknown) => { calls.push({ method: 'put', url, body }); return { data: reply } },
    } as unknown as AxiosInstance,
  }
}

describe('createSys 版本检查(命名陷阱:os_version vs version)', () => {
  // curl 实证 2026-07-31
  const OS = { success: 200, message: 'ok', data: { current_version: '1.0.0', need_update: false } }
  const APP = { success: 200, message: 'ok', data: { current_version: '1.9.3-alpha1+25.gc8d7d14-dirty', need_update: false } }

  it('getOsVersion 打 /sys/os_version', async () => {
    const { calls, http } = writeHttp(OS)
    const info = await createSys(http).getOsVersion()
    expect(calls[0].url).toBe('/sys/os_version')
    expect(info.current_version).toBe('1.0.0')
    expect(info.need_update).toBe(false)
  })

  it('getAppVersion 打 /sys/version', async () => {
    const { calls, http } = writeHttp(APP)
    const info = await createSys(http).getAppVersion()
    expect(calls[0].url).toBe('/sys/version')
    expect(info.current_version).toBe('1.9.3-alpha1+25.gc8d7d14-dirty')
  })

  it('trigger_download 作为查询参数下发(下载靠它触发,不是独立端点)', async () => {
    const { calls, http } = writeHttp(OS)
    await createSys(http).getOsVersion({ trigger_download: 1 })
    expect(calls[0].config).toEqual({ params: { trigger_download: 1 } })
  })

  it('不传 params 时不下发 params 字段', async () => {
    const { calls, http } = writeHttp(OS)
    await createSys(http).getAppVersion()
    expect(calls[0].config).toBeUndefined()
  })

  it('deprecated getVersion 仍打 /sys/version(SP1 起的老调用方)', async () => {
    const { calls, http } = writeHttp(APP)
    await createSys(http).getVersion()
    expect(calls[0].url).toBe('/sys/version')
  })
})

describe('createSys baseinfo / paths / logs', () => {
  it('getBaseInfo 拆信封', async () => {
    // curl 实证 2026-07-31
    const s = createSys(http({ '/sys/baseinfo': { success: 200, message: 'ok', data: { device_id: '2389ab5a67ce8f1d541d5c5048afd5cd', model: '', version: '1.9.3-alpha1+25.gc8d7d14-dirty' } } }))
    const b = await s.getBaseInfo()
    expect(b.device_id).toBe('2389ab5a67ce8f1d541d5c5048afd5cd')
    expect(b.model).toBe('') // 本机 model 是空串,消费方要有回退
  })

  it('getSystemPaths 返回 path+size 的映射', async () => {
    // curl 实证 2026-07-31(images 的 path 里含 " & ",别被转义骗了)
    const s = createSys(http({ '/sys/paths': { success: 200, message: 'ok', data: {
      app_data: { path: '/DATA/AppData', size: 6037987 },
      images: { path: '/DATA/.system_data/.docker & .containerd', size: 55549158661 },
    } } }))
    const p = await s.getSystemPaths()
    expect(p.app_data).toEqual({ path: '/DATA/AppData', size: 6037987 })
    expect(p.images.path).toContain(' & ')
  })

  it('getLogs 返回纯文本字符串', async () => {
    const s = createSys(http({ '/sys/logs': { success: 200, message: 'ok', data: '2026-04-13T15:38:19.417-0400\tinfo\tInitPathConfig' } }))
    expect(await s.getLogs()).toContain('InitPathConfig')
  })

  it('getLogs 在 data 为空时给空串而不是 undefined', async () => {
    const s = createSys(http({ '/sys/logs': { success: 200, message: 'ok', data: null } }))
    expect(await s.getLogs()).toBe('')
  })
})

describe('createSys 写操作载荷', () => {
  it('power 只接受 off / restart,打 /sys/state/{action}', async () => {
    const { calls, http } = writeHttp()
    await createSys(http).power('restart')
    expect(calls[0]).toMatchObject({ method: 'put', url: '/sys/state/restart' })
  })

  it('setDiskStandby 下发 {minutes}(后端缺该字段返 400)', async () => {
    const { calls, http } = writeHttp()
    await createSys(http).setDiskStandby({ minutes: 60 })
    expect(calls[0]).toMatchObject({ method: 'put', url: '/sys/disk/standby', body: { minutes: 60 } })
  })

  it('updateApp / updateOs / cancelDownload 打各自端点', async () => {
    const { calls, http } = writeHttp()
    const s = createSys(http)
    await s.updateApp(); await s.updateOs(); await s.cancelDownload()
    expect(calls.map((c) => c.url)).toEqual(['/sys/update', '/sys/os_update', '/sys/download/cancel'])
  })

  // 这两个端点失败时**也返回 HTTP 200**,错误只在信封里(system.go:93-102 / :149-158),
  // axios 不 reject → 不查信封就会把失败当成功。Task 8 的升级流程靠这个 throw 报错。
  it('updateApp 在信封报错时抛(后端失败也返 HTTP 200)', async () => {
    const { http } = writeHttp({ success: 500, message: 'no space left on device' })
    await expect(createSys(http).updateApp()).rejects.toThrow('no space left on device')
  })

  it('updateOs 在信封报错时抛', async () => {
    const { http } = writeHttp({ success: 500, message: 'upgrade already running' })
    await expect(createSys(http).updateOs()).rejects.toThrow('upgrade already running')
  })

  it('信封成功时不抛', async () => {
    const { http } = writeHttp({ success: 200, message: 'ok', data: null })
    await expect(createSys(http).updateOs()).resolves.toBeUndefined()
  })

  it('migrateAppPath 下发 snake_case 的 target_mount', async () => {
    const { calls, http } = writeHttp({ success: 200, message: 'ok', data: { job_id: 'abc-123' } })
    const r = await createSys(http).migrateAppPath('app_data', '/media/RAID_0')
    expect(calls[0]).toMatchObject({ method: 'post', url: '/sys/migrate', body: { type: 'app_data', target_mount: '/media/RAID_0' } })
    expect(r.job_id).toBe('abc-123')
  })

  it('getMigrateStatus 按 Go struct 的字段名解', async () => {
    const s = createSys(http({ '/sys/migrate/abc-123': { success: 200, message: 'ok', data: {
      id: 'abc-123', type: 'app_data', status: 'running', phase: 'copying',
      stopping_apps: 0, progress: 42, processed_size: 100, total_size: 240,
    } } }))
    const j = await s.getMigrateStatus('abc-123')
    expect(j.status).toBe('running')
    expect(j.progress).toBe(42)
  })
})

describe('createSys 网关端点(信封层数按端点不同)', () => {
  it('getServerPort 拆信封拿字符串端口', async () => {
    // curl 实证 2026-07-31:data 是字符串 "80",不是数字
    const s = createSys(http({ '/gateway/port': { success: 200, message: 'ok', data: '80' } }))
    expect(await s.getServerPort()).toBe('80')
  })

  it('editServerPort 下发 {port} 字符串', async () => {
    const { calls, http } = writeHttp()
    await createSys(http).editServerPort({ port: '8080' })
    expect(calls[0]).toMatchObject({ method: 'put', url: '/gateway/port', body: { port: '8080' } })
  })

  it('getSSLConfig 拆信封', async () => {
    // curl 实证 2026-07-31
    const s = createSys(http({ '/gateway/ssl': { success: 200, message: 'ok', data: {
      enabled: false, port: '443', domain: 'nimoos.local', cert_type: 'auto',
      effective_time: '0001-01-01T00:00:00Z', expiration_time: '0001-01-01T00:00:00Z',
    } } }))
    const c = await s.getSSLConfig()
    expect(c.enabled).toBe(false)
    expect(c.port).toBe('443')
    expect(c.effective_time.startsWith('0001')).toBe(true) // 零值时间,UI 要显示 '---'
  })

  it('setSSLConfig 只下发 4 个字段(不回传只读的时间)', async () => {
    const { calls, http } = writeHttp()
    await createSys(http).setSSLConfig({ enabled: true, domain: 'nimoos.local', port: '443', cert_type: 'auto' })
    expect(calls[0].body).toEqual({ enabled: true, domain: 'nimoos.local', port: '443', cert_type: 'auto' })
  })

  it('uploadSSLCert 走 multipart', async () => {
    const { calls, http } = writeHttp()
    const fd = new FormData()
    await createSys(http).uploadSSLCert(fd)
    expect(calls[0]).toMatchObject({ method: 'post', url: '/gateway/ssl/upload' })
    expect(calls[0].config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } })
  })

  it('getGatewayComponents 读裸 JSON —— 不能套 unwrap', async () => {
    // curl 实证 2026-07-31:没有 success/message/data 三件套,直接 {"components":[…]}
    const s = createSys(http({ '/gateway/components': { components: [
      { name: 'Gateway', category: 'service', version: '1.9.3-alpha1+28.g0dc16d6', status: 'online', error: '', probed_at: '2026-07-31T06:37:23Z' },
      { name: 'User Service', category: 'service', version: '', status: 'offline', error: 'unexpected status Internal Server Error', probed_at: '2026-07-31T06:37:23Z' },
    ] } }))
    const list = await s.getGatewayComponents()
    expect(list).toHaveLength(2)
    expect(list[1].status).toBe('offline')
    expect(list[1].error).toContain('Internal Server Error')
  })

  it('getGatewayComponents 在 components 缺失时给空数组', async () => {
    const s = createSys(http({ '/gateway/components': {} }))
    expect(await s.getGatewayComponents()).toEqual([])
  })

  it('getDeviceInfo 读裸 JSON', async () => {
    // curl 实证 2026-07-31
    const s = createSys(http({ '/gateway/device-info': { hostname: 'NimoOS', os: 'nimoos', version: '1.9.3-alpha1+28.g0dc16d6' } }))
    expect(await s.getDeviceInfo()).toEqual({ hostname: 'NimoOS', os: 'nimoos', version: '1.9.3-alpha1+28.g0dc16d6' })
  })
})

describe('createSys USB 自动挂载', () => {
  it('getUsbStatus 把字符串 "True" 归一成布尔', async () => {
    // curl 实证 2026-07-31:data 是字符串 "True",不是 true
    const s = createSys(http({ '/usb/usb-auto-mount': { success: 200, message: 'ok', data: 'True' } }))
    expect(await s.getUsbStatus()).toBe(true)
  })

  it('"False" → false', async () => {
    const s = createSys(http({ '/usb/usb-auto-mount': { success: 200, message: 'ok', data: 'False' } }))
    expect(await s.getUsbStatus()).toBe(false)
  })

  it('toggleUsbAutoMount 下发 {state:"on"|"off"}', async () => {
    const { calls, http } = writeHttp()
    await createSys(http).toggleUsbAutoMount({ state: 'on' })
    expect(calls[0]).toMatchObject({ method: 'put', url: '/usb/usb-auto-mount', body: { state: 'on' } })
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test 2>&1 | tail -20
```
预期:大量 `sys.getOsVersion is not a function` 一类的失败。**若某条意外通过,先查是不是桩写错了再往下走。**

- [ ] **Step 4: 实现 `src/sys.ts`**

```ts
import type { AxiosInstance } from 'axios'
import type {
  Utilization, HardwareInfo, UpdateCheck, SysBaseInfo, SystemPaths,
  SSLConfig, SSLConfigInput, GatewayComponent, GatewayDeviceInfo, MigrateStatus,
} from './types.js'
import { parseUtil } from './parseUtil.js'
import { unwrap } from './unwrap.js'

export function createSys(http: AxiosInstance) {
  // trigger_download 只在显式传参时下发,避免给所有 GET 都挂上空 params
  const q = (params?: { trigger_download?: 1 }) => (params ? { params } : undefined)

  return {
    async getUtilization(): Promise<Utilization> {
      const res = await http.get('/sys/utilization')
      return parseUtil(unwrap<Record<string, unknown>>(res.data))
    },
    async hardwareInfo(): Promise<HardwareInfo> {
      const res = await http.get('/sys/hardware')
      return unwrap<HardwareInfo>(res.data)
    },

    // ⚠️ 命名陷阱:Vue2 的 getVersion() 打的是 os_version、getAppVersion() 才是 version。
    // 包里一律用语义名。os = 固件/系统镜像版本;app = NimoOS 应用自身版本。
    async getOsVersion(params?: { trigger_download?: 1 }): Promise<UpdateCheck> {
      const res = await http.get('/sys/os_version', q(params))
      return unwrap<UpdateCheck>(res.data)
    },
    async getAppVersion(params?: { trigger_download?: 1 }): Promise<UpdateCheck> {
      const res = await http.get('/sys/version', q(params))
      return unwrap<UpdateCheck>(res.data)
    },
    /** @deprecated 用 getAppVersion()。SP1 起已有调用方,不能删。 */
    async getVersion(): Promise<{ current_version: string }> {
      const res = await http.get('/sys/version')
      return unwrap<{ current_version: string }>(res.data)
    },

    async getBaseInfo(): Promise<SysBaseInfo> {
      const res = await http.get('/sys/baseinfo')
      return unwrap<SysBaseInfo>(res.data)
    },
    async getLogs(): Promise<string> {
      const res = await http.get('/sys/logs')
      return unwrap<string>(res.data) ?? ''
    },
    async getSystemPaths(): Promise<SystemPaths> {
      const res = await http.get('/sys/paths')
      return unwrap<SystemPaths>(res.data)
    },

    // ⚠️ migrate 两个方法本期只进包,消费在 P3。类型依据是 Go struct
    // (NimoOS/service/migrate.go:46-57),**没有 curl 实证**(开发机上不能真跑迁移)。
    // P3 消费前必须抓一次真实响应复核字段。
    async migrateAppPath(type: string, targetMount: string): Promise<{ job_id: string }> {
      const res = await http.post('/sys/migrate', { type, target_mount: targetMount })
      return unwrap<{ job_id: string }>(res.data)
    },
    async getMigrateStatus(jobId: string): Promise<MigrateStatus> {
      const res = await http.get(`/sys/migrate/${jobId}`)
      return unwrap<MigrateStatus>(res.data)
    },

    // 后端对未知 state 也返 200 但什么都不做(NimoOS/route/v1/system.go:552-560),
    // 所以这里把类型收窄,让打错字在编译期就炸。
    async power(action: 'off' | 'restart'): Promise<void> {
      await http.put(`/sys/state/${action}`)
    },
    async setDiskStandby(input: { minutes: number }): Promise<void> {
      await http.put('/sys/disk/standby', input)
    },
    // ⚠️ 这两个端点**失败时也返回 HTTP 200**,错误只写在信封里
    // (NimoOS/route/v1/system.go:93-102 FirmwareUpdate 与 :149-158 SystemUpdate
    //  的错误分支都是 ctx.JSON(common_err.SUCCESS, Result{Success: SERVICE_ERROR, ...}))。
    // axios 不会 reject,所以必须自己查信封 —— 否则升级失败会被当成成功。
    // Vue2 的 UpdateModal.updateSystem() 也是查 res.data.success !== 200 的,
    // 不查等于比 Vue2 更糟(移植纪律:吞错不照抄)。
    // 对比:/gateway/port 与 /gateway/ssl 的写操作返回真实 4xx/5xx,axios 自己会 reject;
    //      /sys/download/cancel 无失败分支(system.go:167-171 恒 SUCCESS)。
    async updateApp(): Promise<void> {
      const res = await http.post('/sys/update')
      unwrap<unknown>(res.data)
    },
    async updateOs(): Promise<void> {
      const res = await http.post('/sys/os_update')
      unwrap<unknown>(res.data)
    },
    async cancelDownload(): Promise<void> {
      await http.post('/sys/download/cancel')
    },

    async getServerPort(): Promise<string> {
      const res = await http.get('/gateway/port')
      return unwrap<string>(res.data)
    },
    async editServerPort(input: { port: string }): Promise<void> {
      await http.put('/gateway/port', input)
    },
    async getSSLConfig(): Promise<SSLConfig> {
      const res = await http.get('/gateway/ssl')
      return unwrap<SSLConfig>(res.data)
    },
    async setSSLConfig(cfg: SSLConfigInput): Promise<void> {
      await http.put('/gateway/ssl', cfg)
    },
    async uploadSSLCert(form: FormData): Promise<void> {
      await http.post('/gateway/ssl/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    },

    // ⚠️ 这两个是**裸 JSON,没有 success/message/data 信封**(curl 实证 2026-07-31)。
    // 同前缀下 /gateway/port 与 /gateway/ssl 却有信封 —— 信封层数按端点不同,别统一套 unwrap。
    async getGatewayComponents(): Promise<GatewayComponent[]> {
      const res = await http.get('/gateway/components')
      const body = res.data as { components?: GatewayComponent[] } | null
      return body?.components ?? []
    },
    async getDeviceInfo(): Promise<GatewayDeviceInfo> {
      const res = await http.get('/gateway/device-info')
      return res.data as GatewayDeviceInfo
    },

    // 后端存的是字符串 "True"/"False"(NimoOS-LocalStorage/route/v1/usb.go:37/40),
    // 在包里归一成布尔,别让每个消费方各自记这个坑。
    async getUsbStatus(): Promise<boolean> {
      const res = await http.get('/usb/usb-auto-mount')
      return unwrap<string>(res.data) === 'True'
    },
    async toggleUsbAutoMount(input: { state: 'on' | 'off' }): Promise<void> {
      await http.put('/usb/usb-auto-mount', input)
    },
  }
}
```

- [ ] **Step 5: 导出新类型**

`src/index.ts` 的 `export type { … } from './types.js'` 那一行末尾追加:
`UpdateCheck, SysBaseInfo, SystemPathEntry, SystemPaths, SSLConfig, SSLConfigInput, GatewayComponent, GatewayDeviceInfo, MigrateStatus`

- [ ] **Step 6: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test 2>&1 | tail -8
```
预期:**24 文件全绿,测试数从 133 增到约 160**(只增不减)。

- [ ] **Step 7: 构建包并同步到消费端**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm build
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vue-tsc --noEmit
```
`vue-tsc` 必须 0 错误。若报 `Module not found` 或找不到新类型,执行 `pnpm install` 重新同步 `file:` 链接(见 `nimoos-service-pnpm-drift` 记忆),再重跑。

- [ ] **Step 8: 提交(两个仓库分别提交,显式 pathspec)**

```bash
cd /home/nimo/NimoTech/NimoOS-Service
git status --short
git commit src/types.ts src/sys.ts src/sys.test.ts src/index.ts \
  -m "feat(sys): 补全 sys 域 20 个方法(SP9-P1)

- 命名陷阱:getOsVersion→/sys/os_version、getAppVersion→/sys/version,
  现有 getVersion 保留为 deprecated 别名
- trigger_download 走查询参数,不是独立端点
- /gateway/components 与 /gateway/device-info 是裸 JSON,不套 unwrap
- getUsbStatus 把后端字符串 \"True\"/\"False\" 归一成布尔
- power(action) 类型收窄(后端对未知 state 静默返 200)
- 补 spec 表外但 UpdateModal 必需的 updateOs / cancelDownload
- migrate 两方法类型据 Go struct,未 curl 实证,P3 消费前须复核"
```

New-UI 侧此任务若因 `pnpm install` 改动了 `pnpm-lock.yaml`,一并显式提交:
```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git status --short   # 确认 3 行 design-export 的 D 还在
# 仅当 lock 有改动时:
git commit pnpm-lock.yaml -m "chore: 同步 NimoOS-Service 本地包(SP9-P1)"
```

---

## Task 2: `systemConfig.ts` —— `system` blob 的串行读改写

**为什么单独一个任务:** general 页有 4 个控件(时区、推荐应用、新闻流、硬盘待机)都要写服务端 `system` 这一个 key,而 `src/stores/locale.ts` **已经**在同一个 key 上做「读→改 `lang`→写」。四个开关连点 + 切语言并发时,后写的会把先写的覆盖掉(纪律 #3)。先把这个地基做对,后面每行才能只管自己那一个字段。

**Files:**
- Create: `src/settings/util/systemConfig.ts`
- Create: `src/settings/util/systemConfig.test.ts`
- Modify: `src/stores/locale.ts`
- Modify: `src/stores/locale.test.ts`

**Interfaces:**
- Consumes: `service.users.getCustomStorage(key)` / `setCustomStorage(key, data)`(共享包既有,返回 `unknown`;**服务端可能返回 JSON 字符串而不是对象** —— `locale.ts:20-23` 已有这个兼容分支,搬过来)
- Produces:
  ```ts
  export const SYSTEM_KEY = 'system'
  export interface SystemBlob {
    lang?: string
    timezone?: string
    search_switch?: boolean
    recommend_switch?: boolean
    existing_apps_switch?: boolean
    rss_switch?: boolean
    disk_standby?: string
    [k: string]: unknown          // 未知字段必须原样保留,不能读改写时丢掉
  }
  export const SYSTEM_DEFAULTS: Readonly<SystemBlob>
  export function readSystemConfig(): Promise<SystemBlob>          // 已合并默认值
  export function patchSystemConfig(patch: SystemBlob): Promise<SystemBlob>  // 串行,返回合并后的整块
  export function __resetSystemConfigQueue(): void                 // 仅测试用
  ```

- [ ] **Step 1: 写失败测试**

`src/settings/util/systemConfig.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = { blob: undefined as unknown, getCalls: 0, setCalls: [] as unknown[] }

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => { store.getCalls++; return store.blob },
      setCustomStorage: async (_k: string, data: unknown) => {
        store.setCalls.push(data)
        // 真实后端语义:整块覆写
        store.blob = JSON.parse(JSON.stringify(data))
      },
    },
  },
}))

import {
  SYSTEM_DEFAULTS, readSystemConfig, patchSystemConfig, __resetSystemConfigQueue,
} from './systemConfig'

beforeEach(() => {
  store.blob = undefined
  store.getCalls = 0
  store.setCalls = []
  __resetSystemConfigQueue()
})

describe('readSystemConfig', () => {
  it('服务端空值时给默认值', async () => {
    store.blob = ''
    expect(await readSystemConfig()).toEqual(SYSTEM_DEFAULTS)
  })

  it('服务端返回 JSON 字符串也能解(后端确实会这样返)', async () => {
    store.blob = JSON.stringify({ timezone: 'Asia/Shanghai' })
    expect((await readSystemConfig()).timezone).toBe('Asia/Shanghai')
  })

  it('坏 JSON 不抛,退回默认值', async () => {
    store.blob = '{不是 json'
    expect(await readSystemConfig()).toEqual(SYSTEM_DEFAULTS)
  })

  it('服务端字段覆盖默认值,未知字段原样保留', async () => {
    store.blob = { rss_switch: true, some_future_key: 42 }
    const c = await readSystemConfig()
    expect(c.rss_switch).toBe(true)
    expect(c.disk_standby).toBe(SYSTEM_DEFAULTS.disk_standby)
    expect(c.some_future_key).toBe(42)
  })

  it('请求失败时降级到默认值而不是抛(设置页不能因此白屏)', async () => {
    store.blob = undefined
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.users, 'getCustomStorage').mockRejectedValueOnce(new Error('boom'))
    expect(await readSystemConfig()).toEqual(SYSTEM_DEFAULTS)
  })
})

describe('patchSystemConfig 串行性(纪律 #3:丢写竞态)', () => {
  it('并发 patch 不同字段,两个都留在最终结果里', async () => {
    store.blob = {}
    const [a, b] = await Promise.all([
      patchSystemConfig({ timezone: 'UTC' }),
      patchSystemConfig({ rss_switch: true }),
    ])
    // 后完成的那次看到的是合并后的全量
    const last = b.timezone ? b : a
    expect(last.timezone).toBe('UTC')
    expect(last.rss_switch).toBe(true)
    expect(store.blob).toMatchObject({ timezone: 'UTC', rss_switch: true })
  })

  it('串行队列内每次都重新读,不用调用方传进来的旧快照', async () => {
    store.blob = { timezone: 'UTC' }
    await Promise.all([
      patchSystemConfig({ rss_switch: true }),
      patchSystemConfig({ recommend_switch: false }),
    ])
    // 两次 patch 各读一次(2)+ 无额外读
    expect(store.getCalls).toBe(2)
    expect(store.blob).toMatchObject({ timezone: 'UTC', rss_switch: true, recommend_switch: false })
  })

  it('三个开关连点(模拟用户快速拨)不丢任何一个', async () => {
    store.blob = {}
    await Promise.all([
      patchSystemConfig({ rss_switch: true }),
      patchSystemConfig({ recommend_switch: false }),
      patchSystemConfig({ disk_standby: '30m' }),
    ])
    expect(store.blob).toMatchObject({ rss_switch: true, recommend_switch: false, disk_standby: '30m' })
  })

  it('队列中一次失败不卡死后续(否则一次网络抖动会让设置页永久失灵)', async () => {
    store.blob = {}
    const svc = await import('@nimotech/nimoos-service')
    const spy = vi.spyOn(svc.service.users, 'setCustomStorage').mockRejectedValueOnce(new Error('boom'))
    await expect(patchSystemConfig({ rss_switch: true })).rejects.toThrow('boom')
    spy.mockRestore()
    await expect(patchSystemConfig({ timezone: 'UTC' })).resolves.toMatchObject({ timezone: 'UTC' })
  })

  it('patch 不会把未知字段洗掉', async () => {
    store.blob = { some_future_key: 'keep me' }
    await patchSystemConfig({ timezone: 'UTC' })
    expect(store.blob).toMatchObject({ some_future_key: 'keep me', timezone: 'UTC' })
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test src/settings/util/systemConfig.test.ts 2>&1 | tail -20
```
预期:`Failed to resolve import "./systemConfig"`。

- [ ] **Step 3: 实现 `src/settings/util/systemConfig.ts`**

```ts
import { service } from '@nimotech/nimoos-service'

/** 服务端自定义存储的 key。与 Vue2(SettingsPanel.vue 的 systemConfigName)和 stores/locale.ts 同一个。 */
export const SYSTEM_KEY = 'system'

/**
 * Vue2 `barData`(SettingsPanel.vue L938-946)的服务端形态。
 * 索引签名不是偷懒 —— 读改写必须把不认识的字段原样带回去,
 * 否则新 UI 一次保存就把旧 UI / 将来版本写进去的字段洗掉了。
 */
export interface SystemBlob {
  lang?: string
  timezone?: string
  search_switch?: boolean
  recommend_switch?: boolean
  /**
   * Vue2 有这个字段,但对应的「显示其他 Docker 容器应用」开关行恒不渲染
   * (notImportList 永远是空数组,SET_NOTIMPORT_LIST 从没被 commit)。
   * 本期不做那一行(债务 D15),但字段要保留,避免读改写把它丢了。
   */
  existing_apps_switch?: boolean
  rss_switch?: boolean
  disk_standby?: string
  [k: string]: unknown
}

/**
 * 默认值照 Vue2 L938-946,**但故意不含 `lang`** ——
 * Vue2 默认 en_us,New-UI 默认 zh_cn,语言归 stores/locale.ts 管,
 * 这里给默认值会在读取时把用户语言错误地"纠正"掉。
 */
export const SYSTEM_DEFAULTS: Readonly<SystemBlob> = Object.freeze({
  timezone: 'America/New_York',
  search_switch: true,
  recommend_switch: true,
  existing_apps_switch: true,
  rss_switch: false,
  disk_standby: 'never',
})

function coerce(raw: unknown): Record<string, unknown> {
  let data = raw
  // 后端会把这块当字符串存回来,不是总是对象(stores/locale.ts 早有这个兼容分支)
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return {}
    }
  }
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
}

/** 读原始整块(不合默认值)—— 只给 patch 内部用,保证写回去的是服务端真实全量。 */
async function readRaw(): Promise<Record<string, unknown>> {
  return coerce(await service.users.getCustomStorage(SYSTEM_KEY))
}

/**
 * 读配置(已合并默认值)。**失败不抛** —— 设置页拿不到配置也得能显示,
 * 显示默认值 + 用户一改就写,比整页白屏好。
 */
export async function readSystemConfig(): Promise<SystemBlob> {
  try {
    return { ...SYSTEM_DEFAULTS, ...(await readRaw()) }
  } catch (e) {
    console.warn('[systemConfig] read failed, using defaults', e)
    return { ...SYSTEM_DEFAULTS }
  }
}

/**
 * 串行队列。Vue2 的 saveData() 是整块覆写,而本仓库有多个入口
 * (general 页 4 个控件 + stores/locale.ts 的语言)都在同一个 key 上读改写 ——
 * 不串行的话并发保存会互相覆盖(移植纪律 #3)。
 * 队列**内部**重新读一次服务端,所以不依赖调用方手里的旧快照。
 */
let queue: Promise<unknown> = Promise.resolve()

export async function patchSystemConfig(patch: SystemBlob): Promise<SystemBlob> {
  // 无论上一环成功还是失败都接着排,单次失败不能卡死整条队列
  const run = queue.then(
    () => apply(patch),
    () => apply(patch),
  )
  queue = run.catch(() => undefined)
  return run
}

async function apply(patch: SystemBlob): Promise<SystemBlob> {
  const current = await readRaw()
  const next = { ...current, ...patch }
  await service.users.setCustomStorage(SYSTEM_KEY, next)
  return { ...SYSTEM_DEFAULTS, ...next }
}

/** 仅测试用:清空队列,避免用例间互相串。 */
export function __resetSystemConfigQueue(): void {
  queue = Promise.resolve()
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm test src/settings/util/systemConfig.test.ts 2>&1 | tail -8
```

- [ ] **Step 5: 把 `locale.ts` 改接同一条队列**

`src/stores/locale.ts` 删掉自己那份 `readSystemBlob`,`persist` 改走 `patchSystemConfig`:

```ts
import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import { i18n } from '../i18n'
import { readSystemConfig, patchSystemConfig } from '../settings/util/systemConfig'

export const LOCALES = ['zh_cn', 'en_us'] as const
export type Locale = (typeof LOCALES)[number]

function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v)
}

export const useLocaleStore = defineStore('locale', () => {
  function setLocale(lang: Locale) {
    i18n.global.locale.value = lang
    localStorage.setItem('lang', lang)
  }

  async function loadFromServer(): Promise<void> {
    try {
      const blob = await readSystemConfig()
      if (isLocale(blob.lang)) setLocale(blob.lang)
    } catch (e) { console.warn('[locale] server load failed', e) }
  }

  // 改走 systemConfig 的串行队列:设置页的时区/开关也写这一个 key,
  // 各自读改写会丢写(移植纪律 #3)。
  async function persist(lang: Locale): Promise<void> {
    setLocale(lang)
    try {
      await patchSystemConfig({ lang })
    } catch (e) { console.warn('[locale] server save failed', e) }
  }

  return { setLocale, loadFromServer, persist }
})
```

> 保留 `import { service }` 只有在文件里仍有其它用途时才留;若 `vue-tsc` 报未使用,删掉该 import。

- [ ] **Step 6: 修 `locale.test.ts` 并加一条并发用例**

原测试若 mock 的是 `service.users.*`,因为 `systemConfig` 也走同一个 mock,通常无需改动。跑一次确认:

```bash
pnpm test src/stores/locale.test.ts 2>&1 | tail -12
```

若因新增 import 报错,按报错调整 mock。然后追加一条守住纪律 #3 的回归用例:

```ts
it('切语言与设置页写时区并发,两者都不丢(纪律 #3)', async () => {
  const { patchSystemConfig, __resetSystemConfigQueue } = await import('../settings/util/systemConfig')
  __resetSystemConfigQueue()
  const store = useLocaleStore()
  await Promise.all([store.persist('en_us'), patchSystemConfig({ timezone: 'UTC' })])
  const blob = await (await import('../settings/util/systemConfig')).readSystemConfig()
  expect(blob.lang).toBe('en_us')
  expect(blob.timezone).toBe('UTC')
})
```

- [ ] **Step 7: 任务门 + 提交**

```bash
pnpm test 2>&1 | tail -8
pnpm exec vue-tsc --noEmit
git status --short   # 确认 3 行 design-export 的 D 还在原位
git add src/settings/util/systemConfig.ts src/settings/util/systemConfig.test.ts
git commit src/settings/util/systemConfig.ts src/settings/util/systemConfig.test.ts \
           src/stores/locale.ts src/stores/locale.test.ts \
  -m "feat(settings): system blob 串行读改写,消除丢写竞态(SP9-P1)

Vue2 saveData() 整块覆写,而本仓库 locale store 与 general 页 4 个控件
都在同一个 system key 上读改写 —— 并发必丢写(移植纪律 #3)。
改为模块级 Promise 串行队列 + 队列内重新读取;locale store 改接同一条队列。
读失败降级到默认值而不抛(设置页不能因此白屏);
队列内单次失败不卡死后续。"
```

---

## Task 3: 行级 UI 原语 + 文案/token 分片

**Files:**
- Create: `src/settings/components/SettingsRow.vue`
- Create: `src/settings/components/SettingsRow.test.ts`
- Create: `src/settings/components/SettingsSwitch.vue`
- Create: `src/settings/components/SettingsSwitch.test.ts`
- Modify: `src/settings/styles/settings.css`
- Modify: `src/styles/theme.sp9.css`
- Modify: `src/styles/theme.sp9.test.ts`(P0 建的守卫会自动覆盖新 token,通常无需改;跑一次确认)
- Modify: `src/i18n/zh_cn.sp9.ts`
- Modify: `src/i18n/en_us.sp9.ts`

**Interfaces:**
- Consumes: P0 的 `settings.css` 与 `theme.sp9.css` 分片、既有 token(`--card-bg` / `--border` / `--fg` / `--fg-muted` / `--fg-faint` / `--accent` / `--on-accent` / `--chip-bg` / `--chip-border` / `--hover` / `--radius-sm` / `--success` / `--remove-fg` / `--ease`)
- Produces:
  ```
  <SettingsRow :label="string" :sub="string?" :clickable="boolean?" :disabled="boolean?" @click>
    <template #control> …右侧控件… </template>
    <template #hint>   …行下方说明(壁纸 D5 / 语言 D6 用)… </template>
  </SettingsRow>
  → 根元素 .set-list-item;clickable 时渲染 <button>,并带 .set-chevron

  <SettingsSwitch v-model="boolean" :label="string" :disabled="boolean?" />
  → <button role="switch" :aria-checked> + .set-switch / .set-switch.on
  ```
  CSS 类:`.set-list`(卡片容器)· `.set-list-item`(一行)· `.set-row-label` · `.set-row-sub` · `.set-row-hint` · `.set-chevron` · `.set-switch` / `.set-switch-thumb` · `.set-select`(原生 select 的药丸样式)· `.set-input`(数字/文本输入)· `.set-btn` / `.set-btn.primary` · `.set-card`(设备信息卡等大卡)
  新 token:`--set-warn-fg`

- [ ] **Step 1: 加 token(两套主题块都给值)**

`src/styles/theme.sp9.css` 的两个块里各加一行。重启超时的浮层要一个警示色,既有 token 里只有 `--success` 和 `--remove-fg`(危险红),没有琥珀色:

```css
:root {
  --set-rail-bg: rgba(255, 255, 255, 0.06);
  --set-rail-border: rgba(255, 255, 255, 0.12);
  --set-warn-fg: #f0b429;
}

:root[data-theme='light'] {
  --set-rail-bg: rgba(0, 0, 0, 0.03);
  --set-rail-border: rgba(0, 0, 0, 0.08);
  --set-warn-fg: #b7791f;
}
```

跑 P0 建的守卫确认两块 token 名集合一致:
```bash
pnpm test src/styles/theme.sp9.test.ts src/styles/color-guard.test.ts 2>&1 | tail -8
```

- [ ] **Step 2: 加 P1 文案(zh 与 en 必须同时加,值必须是字符串)**

en 文案**逐字取自 Vue2 的 `$t('…')` 键名本身**(Vue2 用英文原文当 key),zh 取自 `NimoOS-UI/src/assets/lang/zh_cn.js` 对应译文;查不到的按现有语气自拟。

追加到 `src/i18n/zh_cn.sp9.ts`:

```ts
  // ── P1 general ──
  settingsDeviceInfoBtn: '设备信息',
  settingsDeviceInfoTitle: '设备信息',
  settingsDeviceNoGpu: '未检测到独立显卡',
  settingsDeviceDetecting: '检测中…',
  settingsWallpaper: '壁纸',
  settingsWallpaperChange: '更改',
  settingsWallpaperNa: '新版界面暂未提供壁纸功能',
  settingsLanguage: '语言',
  settingsLanguageNa: '新版界面目前只有简体中文与英文',
  settingsTimezone: '时区',
  settingsDiskStandby: '硬盘待机',
  settingsStandbyNever: '从未',
  settingsStandby10m: '10 分钟',
  settingsStandby20m: '20 分钟',
  settingsStandby30m: '30 分钟',
  settingsStandby1h: '1 小时',
  settingsStandby2h: '2 小时',
  settingsStandby3h: '3 小时',
  settingsStandby4h: '4 小时',
  settingsStandby5h: '5 小时',
  settingsWebuiPort: 'WebUI 端口',
  settingsPortPlaceholder: '端口',
  settingsPortRange: '端口范围为 80-65535',
  settingsPortSwitching: '正在切换到新端口…',
  settingsPortTimeout: '新端口没有响应,请手动访问。',
  settingsUsbAutoMount: '自动挂载USB磁盘',
  settingsUsbRpiWarn: '启用此功能可能会导致启动从 USB 存储设备的 Raspberry Pi 设备时出现启动失败',
  settingsRecommendApps: '显示推荐应用',
  settingsNewsFeed: '新闻流',
  settingsNewsFeedTitle: '新闻流',
  settingsNewsFeedConfirm: 'NimoOS 仪表板将会通过 https://blog.nimoos.io 获取最新的新闻，这可能会将您的访问记录留到网站。您接受吗？',
  settingsAccept: '接受',
  settingsCancel: '取消',
  settingsConfirm: '确认',
  settingsSave: '保存',
  settingsSaveSuccess: '保存成功',
  settingsSaveFailed: '保存配置失败',
  settingsError: '发生错误',
  settingsFirmwareUpdate: '固件更新',
  settingsSystemUpdate: '系统更新',
  settingsLatestVersion: '当前已经是最新版',
  settingsDownloaded: '已下载',
  settingsDownloading: '下载中',
  settingsCheckUpdate: '检查更新',
  settingsUpdateNow: '立即升级',
  settingsUpdateAvailable: '可用更新',
  settingsUpdateTitle: '更新',
  settingsDownloadNow: '立即下载',
  settingsUpgradeNow: '立即更新',
  settingsDownloadingSystem: '正在下载系统更新',
  settingsDownloadCancelled: '下载已取消',
  settingsDownloadCancelFailed: '取消下载失败',
  settingsUpgradeFailed: '升级过程中似乎出现了问题，请重试。',
  // ── P1 电源流 ──
  settingsShutdown: '关机',
  settingsRestart: '重启',
  settingsShutdownConfirmTitle: '确认关机?',
  settingsShutdownConfirmMsg: '系统将会关闭,期间无法访问。',
  settingsRestartConfirmTitle: '确认重启?',
  settingsRestartConfirmMsg: '系统将会重启,期间短暂无法访问。',
  settingsPowerShutting: '正在关机',
  settingsPowerShuttingMsg: '请等待约 30 秒后再断开电源。',
  settingsPowerOffline: '设备已关机',
  settingsPowerOfflineMsg: '现在可以安全断电。',
  settingsPowerRestarting: '正在重启',
  settingsPowerRestartingMsg: '正在发送重启指令...',
  settingsPowerReconnecting: '正在重新连接',
  settingsPowerReconnectingMsg: '系统正在重启，将自动重新连接...',
  settingsPowerBack: '系统已恢复在线',
  settingsPowerBackMsg: '正在跳转...',
  settingsPowerAppUpdating: '系统正在更新',
  settingsPowerAppUpdatingMsg: '请等待系统更新并重启...',
  settingsPowerFallback: '重启时间较长',
  settingsPowerFallbackMsg: '请手动刷新页面。',
  settingsRefresh: '刷新',
  // ── P1 developer ──
  settingsHttps: 'HTTPS',
  settingsHttpsConfig: '网页 HTTPS 配置',
  settingsHttpsTitle: '网页 HTTPS',
  settingsHttpsDomain: '主域名',
  settingsHttpsEffective: '生效时间',
  settingsHttpsExpiration: '过期时间',
  settingsHttpsPort: '端口',
  settingsHttpsCert: 'SSL 证书',
  settingsHttpsCertAuto: '自动 (自签名证书)',
  settingsHttpsCertCustom: '上传证书',
  settingsHttpsTrust: '信任证书',
  settingsHttpsDownloadCa: '下载 CA 证书',
  settingsHttpsCertFiles: '证书文件',
  settingsHttpsBothFiles: '请同时上传 PEM 和 CRT 文件。',
  settingsHttpsUploadFailed: '上传证书失败',
```

追加到 `src/i18n/en_us.sp9.ts`(**同名同序**):

```ts
  // ── P1 general ──
  settingsDeviceInfoBtn: 'Device information',
  settingsDeviceInfoTitle: 'Device Info',
  settingsDeviceNoGpu: 'No dedicated GPU detected',
  settingsDeviceDetecting: 'Detecting...',
  settingsWallpaper: 'Wallpaper',
  settingsWallpaperChange: 'Change',
  settingsWallpaperNa: 'Wallpapers are not available in the new UI yet',
  settingsLanguage: 'Language',
  settingsLanguageNa: 'The new UI currently ships Simplified Chinese and English only',
  settingsTimezone: 'Timezone',
  settingsDiskStandby: 'Disk Standby',
  settingsStandbyNever: 'Never',
  settingsStandby10m: '10 minutes',
  settingsStandby20m: '20 minutes',
  settingsStandby30m: '30 minutes',
  settingsStandby1h: '1 hour',
  settingsStandby2h: '2 hours',
  settingsStandby3h: '3 hours',
  settingsStandby4h: '4 hours',
  settingsStandby5h: '5 hours',
  settingsWebuiPort: 'WebUI Port',
  settingsPortPlaceholder: 'Port',
  settingsPortRange: 'Port range is 80-65535',
  settingsPortSwitching: 'Switching to the new port...',
  settingsPortTimeout: 'The new port did not respond. Please navigate manually.',
  settingsUsbAutoMount: 'Automount USB Drive',
  settingsUsbRpiWarn: 'Enabling this function may cause boot failures when the Raspberry Pi device is booted from USB',
  settingsRecommendApps: 'Show Recommended Apps',
  settingsNewsFeed: 'News Feed',
  settingsNewsFeedTitle: 'News Feed',
  settingsNewsFeedConfirm: 'NimoOS dashboard will get the the latest news feed of https://blog.nimoos.io via Internet, which might leave your visit records to the site. Do you accept?',
  settingsAccept: 'Accept',
  settingsCancel: 'Cancel',
  settingsConfirm: 'Confirm',
  settingsSave: 'Save',
  settingsSaveSuccess: 'Save success',
  settingsSaveFailed: 'Failed to save configuration',
  settingsError: 'An error occurred',
  settingsFirmwareUpdate: 'Firmware Update',
  settingsSystemUpdate: 'System Update',
  settingsLatestVersion: 'Currently at the latest version',
  settingsDownloaded: 'Downloaded',
  settingsDownloading: 'Downloading',
  settingsCheckUpdate: 'Check for Updates',
  settingsUpdateNow: 'Update Now',
  settingsUpdateAvailable: 'Update Available',
  settingsUpdateTitle: 'Update',
  settingsDownloadNow: 'Download Now',
  settingsUpgradeNow: 'Upgrade Now',
  settingsDownloadingSystem: 'Downloading system update',
  settingsDownloadCancelled: 'Download cancelled',
  settingsDownloadCancelFailed: 'Failed to cancel download',
  settingsUpgradeFailed: 'There seems to be a problem with the upgrade process, please try again!',
  // ── P1 电源流 ──
  settingsShutdown: 'Shutdown',
  settingsRestart: 'Restart',
  settingsShutdownConfirmTitle: 'Shut down the system?',
  settingsShutdownConfirmMsg: 'The system will power off and be unreachable.',
  settingsRestartConfirmTitle: 'Restart the system?',
  settingsRestartConfirmMsg: 'The system will reboot and be briefly unreachable.',
  settingsPowerShutting: 'Now shutting down',
  settingsPowerShuttingMsg: 'Please wait for about 30 seconds before cutting off the power.',
  settingsPowerOffline: 'Machine has shut down',
  settingsPowerOfflineMsg: 'Safe to cut the power.',
  settingsPowerRestarting: 'Restarting now',
  settingsPowerRestartingMsg: 'Sending restart command...',
  settingsPowerReconnecting: 'Reconnecting',
  settingsPowerReconnectingMsg: 'System is rebooting, reconnecting automatically...',
  settingsPowerBack: 'System is back online',
  settingsPowerBackMsg: 'Redirecting...',
  settingsPowerAppUpdating: 'System is updating',
  settingsPowerAppUpdatingMsg: 'Please wait for the system to update and restart...',
  settingsPowerFallback: 'Restart took longer than expected.',
  settingsPowerFallbackMsg: 'Please refresh the page manually.',
  settingsRefresh: 'Refresh',
  // ── P1 developer ──
  settingsHttps: 'HTTPS',
  settingsHttpsConfig: '网页 HTTPS Configuration',
  settingsHttpsTitle: '网页 HTTPS',
  settingsHttpsDomain: 'Primary domain',
  settingsHttpsEffective: 'Effective time',
  settingsHttpsExpiration: 'Expiration date',
  settingsHttpsPort: 'Port',
  settingsHttpsCert: 'SSL Certificate',
  settingsHttpsCertAuto: 'Auto (Self-signed certificate)',
  settingsHttpsCertCustom: 'Upload Certificate',
  settingsHttpsTrust: 'Trust Certificate',
  settingsHttpsDownloadCa: 'Download CA Certificate',
  settingsHttpsCertFiles: 'Certificate Files',
  settingsHttpsBothFiles: 'Please upload both PEM and CRT files.',
  settingsHttpsUploadFailed: 'Failed to upload certificate',
```

跑一致性守卫:
```bash
pnpm test src/i18n/parity.test.ts 2>&1 | tail -8
```

- [ ] **Step 3: 写 `SettingsRow` / `SettingsSwitch` 的失败测试**

`src/settings/components/SettingsRow.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsRow from './SettingsRow.vue'

describe('SettingsRow', () => {
  it('渲染标签与右侧控件插槽', () => {
    const w = mount(SettingsRow, { props: { label: '壁纸' }, slots: { control: '<b class="x">ctl</b>' } })
    expect(w.find('.set-row-label').text()).toBe('壁纸')
    expect(w.find('.x').exists()).toBe(true)
  })

  it('给了 sub 才渲染副标题', () => {
    expect(mount(SettingsRow, { props: { label: 'a' } }).find('.set-row-sub').exists()).toBe(false)
    expect(mount(SettingsRow, { props: { label: 'a', sub: 'v1.0' } }).find('.set-row-sub').text()).toBe('v1.0')
  })

  it('非 clickable 时根元素是 div,不可聚焦', () => {
    const w = mount(SettingsRow, { props: { label: 'a' } })
    expect(w.find('button.set-list-item').exists()).toBe(false)
    expect(w.find('.set-chevron').exists()).toBe(false)
  })

  it('clickable 时根元素是 button 并带 chevron,点击 emit click', async () => {
    const w = mount(SettingsRow, { props: { label: 'a', clickable: true } })
    const btn = w.find('button.set-list-item')
    expect(btn.exists()).toBe(true)
    expect(w.find('.set-chevron').exists()).toBe(true)
    await btn.trigger('click')
    expect(w.emitted('click')).toHaveLength(1)
  })

  it('disabled 的 clickable 行既带 disabled 属性,也确实不 emit click', async () => {
    const w = mount(SettingsRow, { props: { label: 'a', clickable: true, disabled: true } })
    const btn = w.find('button.set-list-item')
    expect(btn.attributes('disabled')).toBeDefined()
    // 只断言属性不够:@vue/test-utils 的 trigger 对 disabled 元素照样会派发,
    // 所以要真点一次,验证组件内那道 disabled 守卫也在。
    await btn.trigger('click')
    expect(w.emitted('click')).toBeUndefined()
  })

  it('hint 插槽渲染在行下方(壁纸 D5 / 语言 D6 的说明位)', () => {
    const w = mount(SettingsRow, { props: { label: 'a' }, slots: { hint: '暂不可用' } })
    expect(w.find('.set-row-hint').text()).toBe('暂不可用')
  })
})
```

`src/settings/components/SettingsSwitch.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsSwitch from './SettingsSwitch.vue'

describe('SettingsSwitch', () => {
  it('role=switch + aria-checked 反映 modelValue', () => {
    const off = mount(SettingsSwitch, { props: { modelValue: false, label: '新闻流' } })
    expect(off.find('[role="switch"]').attributes('aria-checked')).toBe('false')
    expect(off.find('.set-switch').classes()).not.toContain('on')
    const on = mount(SettingsSwitch, { props: { modelValue: true, label: '新闻流' } })
    expect(on.find('[role="switch"]').attributes('aria-checked')).toBe('true')
    expect(on.find('.set-switch').classes()).toContain('on')
  })

  it('用 label 作 aria-label(纯图形开关,没有可见文字)', () => {
    const w = mount(SettingsSwitch, { props: { modelValue: false, label: '新闻流' } })
    expect(w.find('[role="switch"]').attributes('aria-label')).toBe('新闻流')
  })

  it('点击 emit 取反后的值(受控:自己不改状态)', async () => {
    const w = mount(SettingsSwitch, { props: { modelValue: false, label: 'x' } })
    await w.find('[role="switch"]').trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([[true]])
    // 受控组件:props 没变,class 也不该变
    expect(w.find('.set-switch').classes()).not.toContain('on')
  })

  it('disabled 时不 emit', async () => {
    const w = mount(SettingsSwitch, { props: { modelValue: false, label: 'x', disabled: true } })
    await w.find('[role="switch"]').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})
```

- [ ] **Step 4: 跑测试确认失败**

```bash
pnpm test src/settings/components/SettingsRow.test.ts src/settings/components/SettingsSwitch.test.ts 2>&1 | tail -12
```

- [ ] **Step 5: 实现 `SettingsRow.vue`**

```vue
<script setup lang="ts">
// 设置列表里一行的通用骨架。对位 Vue2 SettingsPanel.vue 的 .settings-list-item:
// 左侧标签(可带副标题)撑开、右侧放控件、可点的整行右端带 ›。
// Vue2 每行左侧还有一个 casa 图标字体的图标(b-icon pack="casa");
// New-UI 没有引入那套图标字体(仍是 CasaOS 品牌资源,见顶层 CLAUDE.md 的 iconfonts-casaos 记债),
// 故本期不渲染行内图标 —— 这是既有的图标体系差异,不是本期新增偏离。
import '../styles/settings.css'

defineProps<{ label: string; sub?: string; clickable?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <div class="set-row-wrap">
    <component
      :is="clickable ? 'button' : 'div'"
      class="set-list-item"
      :class="{ clickable }"
      :type="clickable ? 'button' : undefined"
      :disabled="clickable && disabled ? true : undefined"
      @click="clickable && !disabled && emit('click')"
    >
      <span class="set-row-text">
        <span class="set-row-label">{{ label }}</span>
        <span v-if="sub" class="set-row-sub">{{ sub }}</span>
      </span>
      <span class="set-row-ctl"><slot name="control" /></span>
      <span v-if="clickable" class="set-chevron" aria-hidden="true">›</span>
    </component>
    <p v-if="$slots.hint" class="set-row-hint"><slot name="hint" /></p>
  </div>
</template>
```

- [ ] **Step 6: 实现 `SettingsSwitch.vue`**

```vue
<script setup lang="ts">
// 纯图形开关。照 SnapshotSettingsDialog.vue 的 .ss-switch 写法(role=switch + aria-checked +
// aria-label),不新增可见文字 —— 标签由所在的 SettingsRow 提供。
// 受控组件:自己不持状态,只 emit,由父组件决定是否落库后再改 v-model
// (开关类操作要"写成功才翻",失败要能弹回去)。
import '../styles/settings.css'

const props = defineProps<{ modelValue: boolean; label: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button
    type="button"
    class="set-switch"
    :class="{ on: modelValue }"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    :disabled="disabled"
    @click="toggle"
  ><span class="set-switch-thumb"></span></button>
</template>
```

- [ ] **Step 7: 追加 `settings.css` 的公共骨架样式**

追加到 `src/settings/styles/settings.css`(**颜色全部 token,禁字面量**):

```css
/* ── 设置列表(对位 Vue2 .settings-list / .group-list)────────────────── */
.set-list {
  display: flex;
  flex-direction: column;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0 16px;
}
.set-row-wrap:not(:last-child) .set-list-item {
  border-bottom: 1px solid var(--border);
}
.set-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 0;
  border: 0;
  background: none;
  color: var(--fg);
  font: inherit;
  font-size: 14px;
  text-align: left;
}
.set-list-item.clickable {
  cursor: pointer;
}
.set-list-item.clickable:hover {
  color: var(--accent-text);
}
.set-list-item:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.set-row-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 auto;
  min-width: 0;
}
.set-row-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.set-row-sub {
  font-size: 12px;
  color: var(--fg-muted);
}
.set-row-ctl {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}
.set-chevron {
  color: var(--fg-faint);
  flex: 0 0 auto;
}
.set-row-hint {
  margin: -6px 0 10px;
  font-size: 12px;
  color: var(--fg-faint);
}

/* ── 开关(照 SnapshotSettingsDialog.vue 的 .ss-switch)──────────────── */
.set-switch {
  position: relative;
  width: 38px;
  height: 21px;
  flex: none;
  padding: 0;
  cursor: pointer;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--chip-bg);
  transition: background 0.15s var(--ease), border-color 0.15s var(--ease);
}
.set-switch.on {
  background: var(--accent);
  border-color: var(--accent);
}
.set-switch:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.set-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--fg);
  transition: transform 0.15s var(--ease);
}
/* --on-accent 只有叠在 accent 实底上才可用 —— 这里正是那种情形 */
.set-switch.on .set-switch-thumb {
  transform: translateX(17px);
  background: var(--on-accent);
}

/* ── 表单控件(原生 select/input,全仓既有惯例:appearance:auto)─────── */
.set-select,
.set-input {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--chip-border);
  background: var(--chip-bg);
  color: var(--fg);
  font: inherit;
  font-size: 13px;
  max-width: 240px;
}
.set-select {
  appearance: auto;
}
.set-input {
  width: 92px;
}
.set-select:disabled,
.set-input:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* ── 按钮 ────────────────────────────────────────────────────────────── */
.set-btn {
  padding: 5px 14px;
  border-radius: 999px;
  border: 1px solid var(--chip-border);
  background: var(--chip-bg);
  color: var(--fg);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  white-space: nowrap;
}
.set-btn:hover:not(:disabled) {
  background: var(--chip-bg-hi);
}
/* 变体必须自带 :hover 背景 —— 基类 .set-btn:hover 的优先级(0,2,0)会压过变体
 * 的(0,1,0),否则 hover 时变体色被洗成默认底(newui-css-hover-specificity-trap)。 */
.set-btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
}
.set-btn.primary:hover:not(:disabled) {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
  filter: brightness(1.08);
}
.set-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── 大卡(设备信息卡等)────────────────────────────────────────────── */
.set-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 20px;
}

/* ── 状态文字 ────────────────────────────────────────────────────────── */
.set-ok {
  color: var(--success);
  font-size: 12px;
}
.set-info {
  color: var(--accent-text);
  font-size: 12px;
}
.set-warn {
  color: var(--set-warn-fg);
}
.set-danger {
  color: var(--remove-fg);
  font-size: 12px;
}
```

- [ ] **Step 8: 跑测试确认通过 + 任务门**

```bash
pnpm test src/settings src/styles src/i18n 2>&1 | tail -10
pnpm test 2>&1 | tail -8
pnpm exec vue-tsc --noEmit
```

- [ ] **Step 9: 提交**

```bash
git status --short   # 确认 3 行 design-export 的 D 还在原位
git add src/settings/components/SettingsRow.vue src/settings/components/SettingsRow.test.ts \
        src/settings/components/SettingsSwitch.vue src/settings/components/SettingsSwitch.test.ts
git commit src/settings/components/SettingsRow.vue src/settings/components/SettingsRow.test.ts \
           src/settings/components/SettingsSwitch.vue src/settings/components/SettingsSwitch.test.ts \
           src/settings/styles/settings.css src/styles/theme.sp9.css \
           src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts \
  -m "feat(settings): 行级原语 SettingsRow/SettingsSwitch + P1 文案与 token(SP9-P1)

- 一行的骨架抽成 SettingsRow(clickable 时渲染 button + ›)
- 开关照 SnapshotSettingsDialog 的 role=switch 写法,受控不自持状态
- .set-btn.primary 自带 :hover 背景(基类 hover 优先级更高会洗掉变体色)
- 新 token --set-warn-fg,两套主题块都给值
- 行内图标不渲染:New-UI 未引入 iconfonts-casaos,属既有图标体系差异"
```

---

## Task 4: 设备信息卡 + 设备信息弹窗

**Files:**
- Create: `src/assets/img/nimologo.svg`(从 Vue2 逐字复制,**不改任何一笔**)
- Create: `src/settings/util/deviceInfo.ts`
- Create: `src/settings/util/deviceInfo.test.ts`
- Create: `src/settings/components/DeviceInfoDialog.vue`
- Create: `src/settings/components/DeviceInfoDialog.test.ts`
- Create: `src/settings/panels/general/DeviceInfoCard.vue`
- Create: `src/settings/panels/general/DeviceInfoCard.test.ts`
- Modify: `src/settings/styles/settings.css`(加 `.set-logo` 的暗色可见性处理)

**Interfaces:**
- Consumes: `service.sys.hardwareInfo()`(Task 1 扩过字段)、`service.sys.getBaseInfo()`、`src/components/ui/Dialog.vue`(既有 reka 弹窗:`:open` / `@update:open` / `:title` / 默认插槽 / `#footer`)、Task 3 的 `.set-card` / `.set-btn`
- Produces:
  ```ts
  // src/settings/util/deviceInfo.ts —— 纯函数,DeviceInfoPanel.vue 的 computed 逐条对位
  export interface DeviceInfoView {
    platform: string; deviceId: string
    cpuModel: string; cpuCores: number; cpuFreq: string; cpuThreads: number
    ramDetail: string; ramFreq: string; ramType: string
    gpuList: string[]
  }
  export function toDeviceInfoView(hw: HardwareInfo | null, deviceId: string | null): DeviceInfoView
  export function osVersionLabel(hw: HardwareInfo | null): string   // "1.9.3-…" | "1.0.0"(Vue2 回退)
  ```
  ```
  <DeviceInfoDialog :open="boolean" @update:open="…" />   // 自己拉数据
  <DeviceInfoCard />                                       // 自己拉版本号,内含打开弹窗的按钮
  ```

- [ ] **Step 1: 复制 logo 资源(不修改)**

```bash
mkdir -p src/assets/img
cp /home/nimo/NimoTech/NimoOS-UI/src/assets/img/logo/nimologo.svg src/assets/img/nimologo.svg
grep -oE 'fill="[^"]*"' src/assets/img/nimologo.svg | sort | uniq -c
```
预期输出:`2 fill="#222222"`、`1 fill="none"`、`1 fill="white"`。

**这个文件一笔都不许改。** 它是品牌标识(CLAUDE.md 主题例外第 1 类:品牌识别色、皮肤无关)。但 `#222222` 在暗色主题下几乎不可见,所以**在 CSS 侧**处理可见性,而不是去改美术资源。追加到 `src/settings/styles/settings.css`:

```css
/* 品牌 logo 以 <img> 引入,资源内是近黑 + 白双色(CLAUDE.md 主题例外第 1 类:
 * 品牌识别、皮肤无关,不许改美术资源)。默认暗色主题下近黑不可见,
 * 所以在**样式侧**反相,不动 .svg 本身。
 * theme-exception: 品牌美术资源的可见性补偿,非配色语义,无 token 可用。 */
.set-logo {
  width: 96px;
  height: 96px;
  flex: 0 0 auto;
  filter: invert(1);
}
:root[data-theme='light'] .set-logo {
  filter: none;
}
```

- [ ] **Step 2: 写 `deviceInfo.ts` 的失败测试**

`src/settings/util/deviceInfo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { HardwareInfo } from '@nimotech/nimoos-service'
import { toDeviceInfoView, osVersionLabel } from './deviceInfo'

// curl 实证 2026-07-31 GET /v1/sys/hardware(本机真实值,注意 hardware_name 与 drive_model 都是空串)
const HW: HardwareInfo = {
  arch: 'amd64',
  cpu_cores: 6,
  cpu_freq: 4600,
  cpu_model: 'Intel(R) Core(TM) 5 320',
  drive_model: '',
  gpu_list: ['Intel Corporation Wildcat Lake [Intel Graphics] (rev 01)'],
  hardware_id: 'nimoos-standard-v1',
  hardware_name: '',
  ram_speed: '8533 MT/s',
  ram_total: 16335863808,
  ram_type: 'LPDDR5',
  version: '1.9.3-alpha1+25.gc8d7d14-dirty',
}

describe('toDeviceInfoView(逐条对位 DeviceInfoPanel.vue 的 computed)', () => {
  it('platform:hardware_name 优先,空串回退 hardware_id', () => {
    expect(toDeviceInfoView(HW, 'dc1').platform).toBe('nimoos-standard-v1')
    expect(toDeviceInfoView({ ...HW, hardware_name: 'ZimaCube Pro' }, 'dc1').platform).toBe('ZimaCube Pro')
  })

  it('两者都空时给 ---', () => {
    expect(toDeviceInfoView({ ...HW, hardware_name: '', hardware_id: '' }, 'dc1').platform).toBe('---')
  })

  it('deviceId 缺失给 ---', () => {
    expect(toDeviceInfoView(HW, null).deviceId).toBe('---')
    expect(toDeviceInfoView(HW, '').deviceId).toBe('---')
    expect(toDeviceInfoView(HW, '2389ab5a').deviceId).toBe('2389ab5a')
  })

  it('cpuFreq:>=1000MHz 换算成 ~x.x GHz', () => {
    expect(toDeviceInfoView(HW, 'd').cpuFreq).toBe('~4.6 GHz')
  })

  it('cpuFreq:<1000MHz 保留 MHz', () => {
    expect(toDeviceInfoView({ ...HW, cpu_freq: 800 }, 'd').cpuFreq).toBe('800 MHz')
  })

  it('cpuFreq:0 或缺失给 ---', () => {
    expect(toDeviceInfoView({ ...HW, cpu_freq: 0 }, 'd').cpuFreq).toBe('---')
    expect(toDeviceInfoView({ ...HW, cpu_freq: undefined }, 'd').cpuFreq).toBe('---')
  })

  it('cpuThreads = 核数 × 2(Vue2 就是这么算的,不是真的读超线程)', () => {
    expect(toDeviceInfoView(HW, 'd').cpuThreads).toBe(12)
    expect(toDeviceInfoView({ ...HW, cpu_cores: undefined }, 'd').cpuThreads).toBe(0)
  })

  // 纯函数如实返回空串,「检测中」占位文案由模板用 i18n 补
  // (占位渲染由 DeviceInfoDialog.test.ts 覆盖,不在这里断言)
  it('cpuModel 缺失时如实返回空串,不自己塞占位文案', () => {
    expect(toDeviceInfoView({ ...HW, cpu_model: '' }, 'd').cpuModel).toBe('')
    expect(toDeviceInfoView({ ...HW, cpu_model: undefined }, 'd').cpuModel).toBe('')
  })

  it('ramDetail 按 GiB 取整', () => {
    expect(toDeviceInfoView(HW, 'd').ramDetail).toBe('RAM 15 GB total')
  })

  it('ramDetail 在 ram_total 缺失时给 0 GB(不产出 NaN)', () => {
    expect(toDeviceInfoView({ ...HW, ram_total: undefined }, 'd').ramDetail).toBe('RAM 0 GB total')
  })

  it('ramFreq / ramType 缺失给 ---', () => {
    const v = toDeviceInfoView({ ...HW, ram_speed: '', ram_type: undefined }, 'd')
    expect(v.ramFreq).toBe('---')
    expect(v.ramType).toBe('---')
  })

  it('gpuList 缺失给空数组', () => {
    expect(toDeviceInfoView({ ...HW, gpu_list: undefined }, 'd').gpuList).toEqual([])
    expect(toDeviceInfoView(HW, 'd').gpuList).toHaveLength(1)
  })

  it('hw 为 null(还没加载出来)时全字段都有安全占位,不抛', () => {
    const v = toDeviceInfoView(null, null)
    expect(v.platform).toBe('---')
    expect(v.cpuCores).toBe(0)
    expect(v.gpuList).toEqual([])
  })
})

describe('osVersionLabel', () => {
  it('用 hardware.version', () => {
    expect(osVersionLabel(HW)).toBe('1.9.3-alpha1+25.gc8d7d14-dirty')
  })
  it('缺失时回退 1.0.0(Vue2 SettingsPanel.vue:90 的写法)', () => {
    expect(osVersionLabel({ ...HW, version: '' })).toBe('1.0.0')
    expect(osVersionLabel(null)).toBe('1.0.0')
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

```bash
pnpm test src/settings/util/deviceInfo.test.ts 2>&1 | tail -10
```

- [ ] **Step 4: 实现 `src/settings/util/deviceInfo.ts`**

```ts
import type { HardwareInfo } from '@nimotech/nimoos-service'

/**
 * 对位 Vue2 DeviceInfoPanel.vue 的 computed 块(L~100-140)。
 * 抽成纯函数是为了能单测这些换算 —— Vue2 那边混在组件里没法测。
 */
export interface DeviceInfoView {
  platform: string
  deviceId: string
  cpuModel: string
  cpuCores: number
  cpuFreq: string
  cpuThreads: number
  ramDetail: string
  ramFreq: string
  ramType: string
  gpuList: string[]
}

const DASH = '---'
const s = (v: unknown): string => (typeof v === 'string' ? v : '')
const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export function toDeviceInfoView(hw: HardwareInfo | null, deviceId: string | null): DeviceInfoView {
  const cores = n(hw?.cpu_cores)
  const mhz = n(hw?.cpu_freq)
  const ram = n(hw?.ram_total)
  return {
    // hardware_name 在本机实测是空串 → 必须回退 hardware_id
    platform: s(hw?.hardware_name) || s(hw?.hardware_id) || DASH,
    deviceId: s(deviceId) || DASH,
    // 空串照实返回,由模板决定显示「检测中」占位
    cpuModel: s(hw?.cpu_model),
    cpuCores: cores,
    cpuFreq: mhz === 0 ? DASH : mhz >= 1000 ? `~${(mhz / 1000).toFixed(1)} GHz` : `${mhz} MHz`,
    // Vue2 就是 cores*2 —— 不是真读超线程数,1:1 照留
    cpuThreads: cores * 2,
    ramDetail: `RAM ${(ram / (1024 * 1024 * 1024)).toFixed(0)} GB total`,
    ramFreq: s(hw?.ram_speed) || DASH,
    ramType: s(hw?.ram_type) || DASH,
    gpuList: Array.isArray(hw?.gpu_list) ? (hw.gpu_list as string[]) : [],
  }
}

/** Vue2 SettingsPanel.vue:90 / :254 —— `v{hardwareInfo.version || '1.0.0'}` */
export function osVersionLabel(hw: HardwareInfo | null): string {
  return s(hw?.version) || '1.0.0'
}
```

- [ ] **Step 5: 写 `DeviceInfoDialog` 与 `DeviceInfoCard` 的失败测试**

`src/settings/components/DeviceInfoDialog.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'

const hw = {
  arch: 'amd64', cpu_cores: 6, cpu_freq: 4600, cpu_model: 'Intel(R) Core(TM) 5 320',
  gpu_list: ['Intel Corporation Wildcat Lake [Intel Graphics] (rev 01)'],
  hardware_id: 'nimoos-standard-v1', hardware_name: '',
  ram_speed: '8533 MT/s', ram_total: 16335863808, ram_type: 'LPDDR5',
  version: '1.9.3-alpha1+25.gc8d7d14-dirty',
}
const calls = { hardware: 0, base: 0 }
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      hardwareInfo: async () => { calls.hardware++; return hw },
      getBaseInfo: async () => { calls.base++; return { device_id: '2389ab5a67ce8f1d541d5c5048afd5cd', model: '', version: hw.version } },
    },
  },
}))

import DeviceInfoDialog from './DeviceInfoDialog.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const mountIt = (open = true) => mount(DeviceInfoDialog, { props: { open }, global: { plugins: [i18n] } })

beforeEach(() => { calls.hardware = 0; calls.base = 0 })

describe('DeviceInfoDialog', () => {
  it('打开时拉硬件与基础信息,渲染 5 行', async () => {
    const w = mountIt()
    await flushPromises()
    expect(calls.hardware).toBe(1)
    expect(calls.base).toBe(1)
    const labels = w.findAll('.dev-label').map((e) => e.text())
    expect(labels).toEqual(['Platform', 'DC', 'CPU', 'RAM', 'GPU'])
  })

  it('platform 用 hardware_id 回退(本机 hardware_name 是空串)', async () => {
    const w = mountIt()
    await flushPromises()
    expect(w.text()).toContain('nimoos-standard-v1')
  })

  it('CPU 行渲染型号 + 核数/频率/线程', async () => {
    const w = mountIt()
    await flushPromises()
    const cpu = w.findAll('.dev-row')[2].text()
    expect(cpu).toContain('Intel(R) Core(TM) 5 320')
    expect(cpu).toContain('6')
    expect(cpu).toContain('~4.6 GHz')
    expect(cpu).toContain('12')
  })

  it('GPU 列表逐条渲染', async () => {
    const w = mountIt()
    await flushPromises()
    expect(w.findAll('.dev-gpu')).toHaveLength(1)
  })

  it('open=false 时不发请求(别在设置页一进来就打硬件接口)', async () => {
    mountIt(false)
    await flushPromises()
    expect(calls.hardware).toBe(0)
  })

  it('cpu_model 为空时渲染「检测中」占位(纯函数返回空串,占位是模板的活)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'hardwareInfo').mockResolvedValueOnce({ ...hw, cpu_model: '' })
    const w = mountIt()
    await flushPromises()
    expect(w.findAll('.dev-row')[2].text()).toContain('检测中')
  })

  // 两个接口必须各自成败:一个挂了不能把另一个已经拿到的值也抹掉。
  // 这两条是 Promise.allSettled → Promise.all 的回归守卫 —— 换成 all 之后聚合 promise
  // 会 reject,赋值那行被跳过,成功那个接口的数据就丢了。
  // ⚠️ 只让两个接口**同时**失败的用例是空转的:弹窗未取数时本来就全是 '---'。
  it('hardwareInfo 失败但 getBaseInfo 成功时,DC 仍然显示出来', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'hardwareInfo').mockRejectedValueOnce(new Error('boom'))
    const w = mountIt()
    await flushPromises()
    expect(w.text()).toContain('2389ab5a67ce8f1d541d5c5048afd5cd')
  })

  it('getBaseInfo 失败但 hardwareInfo 成功时,CPU 型号仍然显示出来', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'getBaseInfo').mockRejectedValueOnce(new Error('boom'))
    const w = mountIt()
    await flushPromises()
    expect(w.text()).toContain('Intel(R) Core(TM) 5 320')
  })

  it('两个接口都失败时不抛,渲染占位 ---', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'hardwareInfo').mockRejectedValueOnce(new Error('boom'))
    vi.spyOn(svc.service.sys, 'getBaseInfo').mockRejectedValueOnce(new Error('boom'))
    const w = mountIt()
    await flushPromises()
    expect(w.text()).toContain('---')
  })
})
```

`src/settings/panels/general/DeviceInfoCard.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      hardwareInfo: async () => ({ arch: 'amd64', version: '1.9.3-alpha1+25.gc8d7d14-dirty' }),
      getBaseInfo: async () => ({ device_id: 'dc', model: '', version: '1.9.3' }),
    },
  },
}))

import DeviceInfoCard from './DeviceInfoCard.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

describe('DeviceInfoCard', () => {
  it('渲染 NimoOS 标题、版本号与 logo', async () => {
    const w = mount(DeviceInfoCard, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.find('.dic-title').text()).toBe('NimoOS')
    expect(w.find('.dic-version').text()).toBe('NimoOS v1.9.3-alpha1+25.gc8d7d14-dirty')
    expect(w.find('img.set-logo').exists()).toBe(true)
  })

  it('版本拉不到时回退 v1.0.0(对位 Vue2:90)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'hardwareInfo').mockRejectedValueOnce(new Error('boom'))
    const w = mount(DeviceInfoCard, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.find('.dic-version').text()).toBe('NimoOS v1.0.0')
  })

  it('点「设备信息」按钮打开弹窗', async () => {
    const w = mount(DeviceInfoCard, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.findComponent({ name: 'DeviceInfoDialog' }).props('open')).toBe(false)
    await w.find('.dic-btn').trigger('click')
    expect(w.findComponent({ name: 'DeviceInfoDialog' }).props('open')).toBe(true)
  })
})
```

- [ ] **Step 6: 跑测试确认失败**

```bash
pnpm test src/settings/components/DeviceInfoDialog.test.ts src/settings/panels/general/DeviceInfoCard.test.ts 2>&1 | tail -12
```

- [ ] **Step 7: 实现 `DeviceInfoDialog.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 DeviceInfoPanel.vue(191 行)。5 行:Platform / DC / CPU / RAM / GPU。
// 容器从 Buefy 模态换成 New-UI 既有的 ui/Dialog.vue(reka),内容 1:1(授权偏离 #2 的同类容器替换)。
// 只在 open 变 true 时拉数据 —— 设置页一进来就打硬件接口没有必要。
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type HardwareInfo } from '@nimotech/nimoos-service'
import Dialog from '../../components/ui/Dialog.vue'
import { toDeviceInfoView } from '../util/deviceInfo'
import '../styles/settings.css'

defineOptions({ name: 'DeviceInfoDialog' })
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const { t } = useI18n()
const hw = ref<HardwareInfo | null>(null)
const deviceId = ref<string | null>(null)
const view = ref(toDeviceInfoView(null, null))

async function load() {
  // 两个接口各自成败:硬件挂了不该连 DC 一起不显示(Vue2 是两个来源,这里保持独立)
  await Promise.allSettled([
    service.sys.hardwareInfo().then((r) => { hw.value = r }),
    service.sys.getBaseInfo().then((r) => { deviceId.value = r.device_id }),
  ])
  view.value = toDeviceInfoView(hw.value, deviceId.value)
}

watch(() => props.open, (o) => { if (o) void load() }, { immediate: true })
</script>

<template>
  <Dialog :open="open" :title="t('settingsDeviceInfoTitle')" @update:open="emit('update:open', $event)">
    <div class="dev-rows">
      <div class="dev-row">
        <span class="dev-label">Platform</span>
        <span class="dev-value one-line">{{ view.platform }}</span>
      </div>
      <div class="dev-row">
        <span class="dev-label">DC</span>
        <span class="dev-value one-line">{{ view.deviceId }}</span>
      </div>
      <div class="dev-row">
        <span class="dev-label">CPU</span>
        <span class="dev-value">
          <span class="dev-strong">{{ view.cpuModel || t('settingsDeviceDetecting') }}</span>
          <span class="dev-sub">{{ view.cpuCores }} Cores | {{ view.cpuFreq }} | {{ view.cpuThreads }} Threads</span>
        </span>
      </div>
      <div class="dev-row">
        <span class="dev-label">RAM</span>
        <span class="dev-value">
          <span class="dev-strong">{{ view.ramDetail }}</span>
          <span class="dev-sub">{{ view.ramFreq }} | {{ view.ramType }}</span>
        </span>
      </div>
      <div class="dev-row">
        <span class="dev-label">GPU</span>
        <span class="dev-value">
          <span v-for="(g, i) in view.gpuList" :key="i" class="dev-gpu dev-strong">{{ g }}</span>
          <span v-if="view.gpuList.length === 0" class="dev-sub">{{ t('settingsDeviceNoGpu') }}</span>
        </span>
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.dev-rows { display: flex; flex-direction: column; gap: 12px; min-width: min(520px, 80vw); }
.dev-row {
  display: flex; align-items: flex-start; gap: 20px;
  padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--card-bg);
}
.dev-label {
  flex: 0 0 56px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;
  color: var(--fg-muted); padding-top: 2px;
}
.dev-value { display: flex; flex-direction: column; gap: 4px; flex: 1 1 auto; min-width: 0; font-size: 14px; }
.dev-strong { font-weight: 500; }
.dev-sub { font-size: 12px; color: var(--fg-muted); }
.one-line { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
```

- [ ] **Step 8: 实现 `DeviceInfoCard.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L76-96 的设备信息卡:
// 左「NimoOS」标题 + 「设备信息」按钮 + 「NimoOS v<版本>」,右 logo。
// spec §5.1 提到的 Premium 推广条(Vue2 L67-73)本期不做 —— 用户 2026-07-31 拍板,授权偏离 #6。
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type HardwareInfo } from '@nimotech/nimoos-service'
import DeviceInfoDialog from '../../components/DeviceInfoDialog.vue'
import { osVersionLabel } from '../../util/deviceInfo'
import logo from '../../../assets/img/nimologo.svg'
import '../../styles/settings.css'

const { t } = useI18n()
const hw = ref<HardwareInfo | null>(null)
const dialogOpen = ref(false)

onMounted(async () => {
  // 失败静默:版本号回退 1.0.0(与 Vue2 一致),不让整张卡消失
  try { hw.value = await service.sys.hardwareInfo() } catch (e) { console.warn('[settings] hardwareInfo failed', e) }
})
</script>

<template>
  <section class="set-card dic">
    <div class="dic-text">
      <h2 class="dic-title">NimoOS</h2>
      <button class="set-btn dic-btn" type="button" @click="dialogOpen = true">
        {{ t('settingsDeviceInfoBtn') }}
      </button>
      <p class="dic-version">NimoOS v{{ osVersionLabel(hw) }}</p>
    </div>
    <img class="set-logo" :src="logo" alt="" aria-hidden="true" />
    <DeviceInfoDialog v-model:open="dialogOpen" />
  </section>
</template>

<style scoped>
.dic { display: flex; align-items: center; gap: 16px; }
.dic-text { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; flex: 1 1 auto; min-width: 0; }
.dic-title { margin: 0; font-size: 22px; font-weight: 700; }
.dic-btn { align-self: flex-start; }
.dic-version { margin: 0; font-size: 12px; color: var(--fg-muted); }
</style>
```

> **`import logo from '…svg'` 的类型**:Vite 默认给 `.svg` 提供 `?url` 形态的字符串导出,类型来自 `vite/client`。若 `vue-tsc` 报找不到模块声明,检查 `tsconfig.json` 的 `types` 里是否含 `vite/client`;**不要**为此改 `tsconfig` 的 `types` 数组(P0 台账「发现一」记过:往 `types` 里塞东西会改变整个 `src` 的类型推断),改用文件级 `/// <reference types="vite/client" />`。

- [ ] **Step 9: 跑测试确认通过 + 任务门 + 提交**

```bash
pnpm test src/settings 2>&1 | tail -8
pnpm test 2>&1 | tail -8
pnpm exec vue-tsc --noEmit
git status --short   # 确认 3 行 design-export 的 D 还在原位
git add src/assets/img/nimologo.svg src/settings/util/deviceInfo.ts src/settings/util/deviceInfo.test.ts \
        src/settings/components/DeviceInfoDialog.vue src/settings/components/DeviceInfoDialog.test.ts \
        src/settings/panels/general/DeviceInfoCard.vue src/settings/panels/general/DeviceInfoCard.test.ts
git commit src/assets/img/nimologo.svg src/settings/util/deviceInfo.ts src/settings/util/deviceInfo.test.ts \
           src/settings/components/DeviceInfoDialog.vue src/settings/components/DeviceInfoDialog.test.ts \
           src/settings/panels/general/DeviceInfoCard.vue src/settings/panels/general/DeviceInfoCard.test.ts \
           src/settings/styles/settings.css \
  -m "feat(settings): 设备信息卡 + 设备信息弹窗(SP9-P1)

- DeviceInfoPanel.vue 的 computed 全部抽成纯函数 deviceInfo.ts 并单测
  (hardware_name 本机是空串,必须回退 hardware_id;cpuThreads=核数×2 是 Vue2 原样)
- 弹窗只在 open 变 true 时拉数据;两个接口 allSettled 各自成败
- logo 资源逐字复制不改,暗色可见性在 CSS 侧 invert 补偿"
```

---

## Task 5: 壁纸 / 语言 / 时区 / 硬盘待机 四行

**Files:**
- Create: `src/settings/util/timezones.ts`
- Create: `src/settings/util/standby.ts`
- Create: `src/settings/util/standby.test.ts`
- Create: `src/settings/panels/general/WallpaperRow.vue` + `.test.ts`
- Create: `src/settings/panels/general/LanguageRow.vue` + `.test.ts`
- Create: `src/settings/panels/general/TimezoneRow.vue` + `.test.ts`
- Create: `src/settings/panels/general/DiskStandbyRow.vue` + `.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `readSystemConfig` / `patchSystemConfig`、Task 3 的 `SettingsRow` / `.set-select` / `.set-btn`、`useLocaleStore`(既有 `persist(lang)`)、`service.sys.setDiskStandby`、`useToast().show(text, duration?)`
- Produces:
  ```ts
  // timezones.ts —— 逐字照抄 Vue2 SettingsPanel.vue L871-933
  export interface TimezoneOption { label: string; value: string }
  export const TIMEZONES: readonly TimezoneOption[]        // 与 Vue2 同序同内容
  // standby.ts
  export interface StandbyOption { value: string; labelKey: string }
  export const STANDBY_OPTIONS: readonly StandbyOption[]   // never/10m/20m/30m/1h..5h,9 项
  export function parseStandbyMinutes(standby: string | undefined): number
  ```
  四个行组件都无 props、无 emit,各自读写自己那一份配置。

- [ ] **Step 1: 抄时区表**

`src/settings/util/timezones.ts` —— 从 `NimoOS-UI/src/components/settings/SettingsPanel.vue` **L871-933 逐字复制**(约 39 项,`{label, value}` 结构不变):

```bash
sed -n '871,933p' /home/nimo/NimoTech/NimoOS-UI/src/components/settings/SettingsPanel.vue
```

文件头写:
```ts
/**
 * 时区表逐字照抄 Vue2 SettingsPanel.vue L871-933(同序、同 label 文案、同 value)。
 * label 是英文原文且**不进 i18n** —— Vue2 那边也没有 $t(),两套 UI 显示一致优先。
 * 顺序不要"优化"成按 GMT 排序:Vue2 就是这个顺序,界面 1:1。
 */
export interface TimezoneOption { label: string; value: string }
export const TIMEZONES: readonly TimezoneOption[] = [
  { label: '(GMT-12:00) International Date Line West', value: 'Etc/GMT+12' },
  // … 逐字抄完 …
] as const
```

- [ ] **Step 2: 写 `standby.ts` 的失败测试**

`src/settings/util/standby.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { STANDBY_OPTIONS, parseStandbyMinutes } from './standby'

describe('STANDBY_OPTIONS', () => {
  it('9 项,顺序与取值对位 Vue2 L989-999', () => {
    expect(STANDBY_OPTIONS.map((o) => o.value)).toEqual(
      ['never', '10m', '20m', '30m', '1h', '2h', '3h', '4h', '5h'],
    )
  })
  it('每项都有 i18n 键(Vue2 是内联 zh/en 两栏,这里改走 i18n 分片)', () => {
    for (const o of STANDBY_OPTIONS) expect(o.labelKey).toMatch(/^settingsStandby/)
  })
})

describe('parseStandbyMinutes(对位 Vue2 L1093-1098)', () => {
  it('never → 0', () => expect(parseStandbyMinutes('never')).toBe(0))
  it('空/undefined → 0', () => {
    expect(parseStandbyMinutes('')).toBe(0)
    expect(parseStandbyMinutes(undefined)).toBe(0)
  })
  it('分钟后缀原样取值', () => {
    expect(parseStandbyMinutes('10m')).toBe(10)
    expect(parseStandbyMinutes('30m')).toBe(30)
  })
  it('小时后缀 ×60', () => {
    expect(parseStandbyMinutes('1h')).toBe(60)
    expect(parseStandbyMinutes('5h')).toBe(300)
  })
  it('无法识别的值 → 0(不是 NaN —— 后端要求 minutes 是整数,NaN 会被 400)', () => {
    expect(parseStandbyMinutes('abc')).toBe(0)
    expect(parseStandbyMinutes('12')).toBe(0)
  })
})
```

- [ ] **Step 3: 跑测试确认失败,然后实现 `standby.ts`**

```bash
pnpm test src/settings/util/standby.test.ts 2>&1 | tail -8
```

```ts
/**
 * 硬盘待机选项。取值对位 Vue2 SettingsPanel.vue L989-999。
 * Vue2 每项内联 `{zh, en}` 两栏、靠 getStandbyLabel() 按当前语言挑
 * (且它只认 zh_cn/zh_tw,其他语言一律走英文)。这里改走 i18n 分片,
 * 由 vue-i18n 统一管 —— 不是重构,是因为 New-UI 本来就有 i18n 体系,
 * 内联两栏在新仓库里是重复实现。
 */
export interface StandbyOption { value: string; labelKey: string }

export const STANDBY_OPTIONS: readonly StandbyOption[] = [
  { value: 'never', labelKey: 'settingsStandbyNever' },
  { value: '10m', labelKey: 'settingsStandby10m' },
  { value: '20m', labelKey: 'settingsStandby20m' },
  { value: '30m', labelKey: 'settingsStandby30m' },
  { value: '1h', labelKey: 'settingsStandby1h' },
  { value: '2h', labelKey: 'settingsStandby2h' },
  { value: '3h', labelKey: 'settingsStandby3h' },
  { value: '4h', labelKey: 'settingsStandby4h' },
  { value: '5h', labelKey: 'settingsStandby5h' },
] as const

/**
 * 对位 Vue2 L1093-1098。后端 PUT /v1/sys/disk/standby 要求 `minutes` 是整数,
 * 非整数会被 400(NimoOS/route/v1/system.go:617-624),所以无法识别一律给 0 而不是 NaN。
 */
export function parseStandbyMinutes(standby: string | undefined): number {
  if (!standby || standby === 'never') return 0
  const num = Number.parseInt(standby, 10)
  if (!Number.isFinite(num)) return 0
  if (standby.endsWith('m')) return num
  if (standby.endsWith('h')) return num * 60
  return 0
}
```

- [ ] **Step 4: 写四个行组件的失败测试**

新建 `src/settings/panels/general/rows.test.ts`(四行放一个测试文件,它们共享同一套 mock):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'

const blob: Record<string, unknown> = {}
const standbyCalls: { minutes: number }[] = []
const persisted: string[] = []

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => ({ ...blob }),
      setCustomStorage: async (_k: string, d: Record<string, unknown>) => { Object.assign(blob, d) },
    },
    sys: { setDiskStandby: async (p: { minutes: number }) => { standbyCalls.push(p) } },
  },
}))
vi.mock('../../../stores/locale', () => ({
  LOCALES: ['zh_cn', 'en_us'],
  useLocaleStore: () => ({ persist: async (l: string) => { persisted.push(l) } }),
}))

import WallpaperRow from './WallpaperRow.vue'
import LanguageRow from './LanguageRow.vue'
import TimezoneRow from './TimezoneRow.vue'
import DiskStandbyRow from './DiskStandbyRow.vue'
import { __resetSystemConfigQueue } from '../../util/systemConfig'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const mountRow = (C: unknown) => mount(C as never, { global: { plugins: [i18n] } })

beforeEach(() => {
  setActivePinia(createPinia())
  for (const k of Object.keys(blob)) delete blob[k]
  standbyCalls.length = 0
  persisted.length = 0
  __resetSystemConfigQueue()
})

describe('WallpaperRow(债务 D5:New-UI 无壁纸系统)', () => {
  it('渲染壁纸标签,「更改」按钮禁用', () => {
    const w = mountRow(WallpaperRow)
    expect(w.find('.set-row-label').text()).toBe('壁纸')
    expect(w.find('.set-btn').attributes('disabled')).toBeDefined()
  })
  it('行下方有说明,写清为什么不可用', () => {
    expect(mountRow(WallpaperRow).find('.set-row-hint').text()).toBe('新版界面暂未提供壁纸功能')
  })
})

describe('LanguageRow(债务 D6:只有 2 项,Vue2 有 31 项)', () => {
  it('只列 zh_cn / en_us', () => {
    const opts = mountRow(LanguageRow).findAll('option')
    expect(opts.map((o) => o.attributes('value'))).toEqual(['zh_cn', 'en_us'])
  })
  it('行下方有说明', () => {
    expect(mountRow(LanguageRow).find('.set-row-hint').exists()).toBe(true)
  })
  it('选中项跟随当前 locale', () => {
    expect((mountRow(LanguageRow).find('select').element as HTMLSelectElement).value).toBe('zh_cn')
  })
  it('切换走 locale store 的 persist(不自己写 system blob,避免两条路径打架)', async () => {
    const w = mountRow(LanguageRow)
    await w.find('select').setValue('en_us')
    await flushPromises()
    expect(persisted).toEqual(['en_us'])
  })
})

describe('TimezoneRow', () => {
  it('挂载后选中服务端保存的时区', async () => {
    blob.timezone = 'Europe/Paris'
    const w = mountRow(TimezoneRow)
    await flushPromises()
    expect((w.find('select').element as HTMLSelectElement).value).toBe('Europe/Paris')
  })

  it('服务端没存时用默认值 America/New_York(对位 Vue2 L940)', async () => {
    const w = mountRow(TimezoneRow)
    await flushPromises()
    expect((w.find('select').element as HTMLSelectElement).value).toBe('America/New_York')
  })

  it('挂载**不**回写配置(移植纪律 #1:Vue2 每次打开都白写一次)', async () => {
    blob.timezone = 'UTC'
    mountRow(TimezoneRow)
    await flushPromises()
    expect(blob).toEqual({ timezone: 'UTC' })   // 没有被整块覆写出别的字段
  })

  it('用户改选才 patch,且只写 timezone 一个字段', async () => {
    blob.rss_switch = true
    const w = mountRow(TimezoneRow)
    await flushPromises()
    await w.find('select').setValue('UTC')
    await flushPromises()
    expect(blob.timezone).toBe('UTC')
    expect(blob.rss_switch).toBe(true)          // 别人的字段没被洗掉
  })

  it('时区表项数与 Vue2 一致(防抄漏)', () => {
    const w = mountRow(TimezoneRow)
    expect(w.findAll('option').length).toBeGreaterThanOrEqual(35)
  })
})

describe('DiskStandbyRow', () => {
  it('挂载后选中服务端值,且**不**下发 standby 指令(移植纪律 #2)', async () => {
    blob.disk_standby = '30m'
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    expect((w.find('select').element as HTMLSelectElement).value).toBe('30m')
    expect(standbyCalls).toEqual([])
  })

  it('用户改选才既 patch 配置又下发指令,分钟数经 parseStandbyMinutes 换算', async () => {
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    await w.find('select').setValue('2h')
    await flushPromises()
    expect(blob.disk_standby).toBe('2h')
    expect(standbyCalls).toEqual([{ minutes: 120 }])
  })

  it('选 never 下发 0', async () => {
    blob.disk_standby = '1h'
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    await w.find('select').setValue('never')
    await flushPromises()
    expect(standbyCalls).toEqual([{ minutes: 0 }])
  })

  it('下发失败时提示,但不把 select 弹回去(配置已落库,指令下次开机生效)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'setDiskStandby').mockRejectedValueOnce(new Error('boom'))
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    await w.find('select').setValue('10m')
    await flushPromises()
    expect((w.find('select').element as HTMLSelectElement).value).toBe('10m')
  })

  it('9 个选项且文案有译文(没渲染出裸 key)', async () => {
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    const opts = w.findAll('option')
    expect(opts).toHaveLength(9)
    expect(opts[0].text()).toBe('从未')
    for (const o of opts) expect(o.text()).not.toMatch(/^settings/)
  })
})
```

- [ ] **Step 5: 跑测试确认失败**

```bash
pnpm test src/settings/panels/general/rows.test.ts 2>&1 | tail -12
```

- [ ] **Step 6: 实现 `WallpaperRow.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L102-116。
// **做样子(政策三 / 债务 D5)**:New-UI 没有壁纸系统(全仓只有 session 里一个
// 登出时清理的 localStorage key),Vue2 那边点 Change 会发 EventBus 打开换壁纸弹窗 ——
// 新 UI 没有那个弹窗的对位物。所以行保留、按钮禁用、下方写明原因。
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/SettingsRow.vue'
const { t } = useI18n()
</script>

<template>
  <SettingsRow :label="t('settingsWallpaper')">
    <template #control>
      <button class="set-btn" type="button" disabled>{{ t('settingsWallpaperChange') }}</button>
    </template>
    <template #hint>{{ t('settingsWallpaperNa') }}</template>
  </SettingsRow>
</template>
```

- [ ] **Step 7: 实现 `LanguageRow.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L119-135。
// **做样子(政策三 / 债务 D6)**:Vue2 从 @/assets/lang 动态枚举出 31 种语言;
// New-UI 目前只有 zh_cn / en_us 两个 locale 文件,所以只列 2 项 —— 归 roadmap §5 的 i18n 全量收口。
// 写入走 locale store 的 persist()(它内部已改接 systemConfig 串行队列),
// 不在这里自己 patch lang —— 两条路径都写同一个字段必然打架。
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { LOCALES, useLocaleStore, type Locale } from '../../../stores/locale'
import SettingsRow from '../../components/SettingsRow.vue'
import '../../styles/settings.css'

const { t, locale } = useI18n()
const localeStore = useLocaleStore()

const LABELS: Record<Locale, string> = { zh_cn: '简体中文', en_us: 'English' }
const current = computed(() => locale.value as Locale)

async function onChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value as Locale
  await localeStore.persist(v)
}
</script>

<template>
  <SettingsRow :label="t('settingsLanguage')">
    <template #control>
      <select class="set-select" :value="current" @change="onChange">
        <option v-for="l in LOCALES" :key="l" :value="l">{{ LABELS[l] }}</option>
      </select>
    </template>
    <template #hint>{{ t('settingsLanguageNa') }}</template>
  </SettingsRow>
</template>
```

- [ ] **Step 8: 实现 `TimezoneRow.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L138-154。
// 移植纪律 #1:Vue2 的 barData 深度 watcher 会在**加载完成的那一刻**把刚读到的配置
// 原样写回服务端(每次打开设置都白写一次)。这里只在用户 change 时才 patch。
// 注意:时区目前只有 Vue2 的时钟组件在消费(New-UI 还没有对位小组件),
// 但两套 UI 共用服务端同一个 system blob —— 在这里改是真的会影响旧 UI 的时钟,不是空操作。
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/SettingsRow.vue'
import { TIMEZONES } from '../../util/timezones'
import { readSystemConfig, patchSystemConfig, SYSTEM_DEFAULTS } from '../../util/systemConfig'
import '../../styles/settings.css'

const { t } = useI18n()
const value = ref<string>(SYSTEM_DEFAULTS.timezone as string)

onMounted(async () => {
  const cfg = await readSystemConfig()
  if (typeof cfg.timezone === 'string' && cfg.timezone) value.value = cfg.timezone
})

async function onChange(e: Event) {
  const next = (e.target as HTMLSelectElement).value
  value.value = next
  try {
    await patchSystemConfig({ timezone: next })
  } catch (err) {
    console.warn('[settings] save timezone failed', err)
  }
}
</script>

<template>
  <SettingsRow :label="t('settingsTimezone')">
    <template #control>
      <select class="set-select" :value="value" @change="onChange">
        <option v-for="tz in TIMEZONES" :key="tz.value" :value="tz.value">{{ tz.label }}</option>
      </select>
    </template>
  </SettingsRow>
</template>
```

- [ ] **Step 9: 实现 `DiskStandbyRow.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L157-173 + watcher L1230-1237。
// 移植纪律 #2:Vue2 的 'barData.disk_standby' watcher 在初次 hydrate 时也会 fire,
// 于是每次打开设置页都会对磁盘下一次 standby 指令。这里只在用户 change 时下发。
// 两件事都要做:① patch 配置(给旧 UI 与下次启动读)② 立刻下发指令(当次生效)。
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import SettingsRow from '../../components/SettingsRow.vue'
import { STANDBY_OPTIONS, parseStandbyMinutes } from '../../util/standby'
import { readSystemConfig, patchSystemConfig, SYSTEM_DEFAULTS } from '../../util/systemConfig'
import { useToast } from '../../../stores/toast'
import '../../styles/settings.css'

const { t } = useI18n()
const toast = useToast()
const value = ref<string>(SYSTEM_DEFAULTS.disk_standby as string)

onMounted(async () => {
  const cfg = await readSystemConfig()
  if (typeof cfg.disk_standby === 'string' && cfg.disk_standby) value.value = cfg.disk_standby
})

async function onChange(e: Event) {
  const next = (e.target as HTMLSelectElement).value
  value.value = next
  try {
    await patchSystemConfig({ disk_standby: next })
  } catch (err) {
    console.warn('[settings] save disk_standby failed', err)
  }
  try {
    await service.sys.setDiskStandby({ minutes: parseStandbyMinutes(next) })
  } catch (err) {
    // 配置已落库,只是这一次没下发成功 → 提示但不把 select 弹回去
    console.warn('[settings] apply disk standby failed', err)
    toast.show(t('settingsSaveFailed'))
  }
}
</script>

<template>
  <SettingsRow :label="t('settingsDiskStandby')">
    <template #control>
      <select class="set-select" :value="value" @change="onChange">
        <option v-for="o in STANDBY_OPTIONS" :key="o.value" :value="o.value">{{ t(o.labelKey) }}</option>
      </select>
    </template>
  </SettingsRow>
</template>
```

- [ ] **Step 10: 跑测试确认通过 + 任务门 + 提交**

```bash
pnpm test src/settings 2>&1 | tail -8
pnpm test 2>&1 | tail -8
pnpm exec vue-tsc --noEmit
git status --short
git add src/settings/util/timezones.ts src/settings/util/standby.ts src/settings/util/standby.test.ts \
        src/settings/panels/general/WallpaperRow.vue src/settings/panels/general/LanguageRow.vue \
        src/settings/panels/general/TimezoneRow.vue src/settings/panels/general/DiskStandbyRow.vue \
        src/settings/panels/general/rows.test.ts
git commit src/settings/util/timezones.ts src/settings/util/standby.ts src/settings/util/standby.test.ts \
           src/settings/panels/general/WallpaperRow.vue src/settings/panels/general/LanguageRow.vue \
           src/settings/panels/general/TimezoneRow.vue src/settings/panels/general/DiskStandbyRow.vue \
           src/settings/panels/general/rows.test.ts \
  -m "feat(settings): general 壁纸/语言/时区/硬盘待机四行(SP9-P1)

- 壁纸按钮禁用 + 说明(债务 D5);语言只 2 项 + 说明(债务 D6)
- 移植纪律 #1:加载不回写配置(Vue2 深度 watcher 每次打开都白写一次)
- 移植纪律 #2:加载不下发硬盘待机指令,只在用户改选时下发
- parseStandbyMinutes 无法识别一律给 0 而非 NaN(后端要整数,NaN 会 400)"
```

---

## Task 6: WebUI 端口行(改端口 + 新端口探活 + 跳转)

**⚠️ 自查时不要真的提交端口修改** —— 会真的换掉网关端口。正确性靠本任务的单测(校验、探活次数上限、跳转 URL 拼接都是纯逻辑),实机留给用户验收。

**Files:**
- Create: `src/settings/util/checkUiPort.ts`
- Create: `src/settings/util/checkUiPort.test.ts`
- Create: `src/settings/panels/general/WebUiPortRow.vue`
- Create: `src/settings/panels/general/WebUiPortRow.test.ts`

**Interfaces:**
- Consumes: `service.sys.getServerPort()`(返回**字符串**如 `"80"`)、`service.sys.editServerPort({port})`、Task 3 的 `.set-input` / `.set-btn.primary`、`useToast()`
- Produces:
  ```ts
  export function validatePort(raw: string): { ok: true; port: number } | { ok: false }
  export function buildProbeUrl(port: string, loc?: { protocol: string; hostname: string }): string
  export function buildRedirectUrl(port: string, loc?: { protocol: string; hostname: string; pathname: string; hash: string }): string
  export const PROBE_INTERVAL_MS = 1500
  export const PROBE_MAX_TRIES = 40
  /** 单次探活:通了返回后端报的端口字符串,否则 null。不抛。 */
  export function probeUiPort(url: string): Promise<string | null>
  ```

- [ ] **Step 1: 写失败测试**

`src/settings/util/checkUiPort.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { validatePort, buildProbeUrl, buildRedirectUrl, probeUiPort, PROBE_MAX_TRIES } from './checkUiPort'

afterEach(() => { vi.unstubAllGlobals() })

describe('validatePort(对位 Vue2 L1387-1394)', () => {
  it('80 与 65535 是合法边界', () => {
    expect(validatePort('80')).toEqual({ ok: true, port: 80 })
    expect(validatePort('65535')).toEqual({ ok: true, port: 65535 })
  })
  it('79 与 65536 越界', () => {
    expect(validatePort('79').ok).toBe(false)
    expect(validatePort('65536').ok).toBe(false)
  })
  it('空、非数字、负数都不合法', () => {
    for (const v of ['', ' ', 'abc', '-1', '8o80']) expect(validatePort(v).ok).toBe(false)
  })
  it('小数被拒(Vue2 用 parseInt 会把 80.5 吃成 80 —— 这是它的 bug,不照抄)', () => {
    expect(validatePort('80.5').ok).toBe(false)
  })
  it('带空格的纯数字容错', () => {
    expect(validatePort(' 8080 ')).toEqual({ ok: true, port: 8080 })
  })
})

describe('buildProbeUrl', () => {
  it('拼出新端口上的 /v1/gateway/port', () => {
    expect(buildProbeUrl('8080', { protocol: 'http:', hostname: '192.168.1.143' }))
      .toBe('http://192.168.1.143:8080/v1/gateway/port')
  })
})

describe('buildRedirectUrl(移植纪律 #5)', () => {
  it('保留当前路径与 hash —— 否则会把用户甩进 /(旧 Vue2 界面)', () => {
    expect(buildRedirectUrl('8080', {
      protocol: 'http:', hostname: '192.168.1.143', pathname: '/app/', hash: '#/settings/general',
    })).toBe('http://192.168.1.143:8080/app/#/settings/general')
  })
  it('没有 hash 时不拼多余的 #', () => {
    expect(buildRedirectUrl('8080', {
      protocol: 'http:', hostname: 'h', pathname: '/app/', hash: '',
    })).toBe('http://h:8080/app/')
  })
})

describe('probeUiPort', () => {
  it('信封 success=200 时返回后端报的端口', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: 200, data: '8080' }) })))
    expect(await probeUiPort('http://h:8080/v1/gateway/port')).toBe('8080')
  })
  it('网络错误返回 null 而不抛(切换期间必然连不上,不能让它冒泡)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    expect(await probeUiPort('http://h:8080/v1/gateway/port')).toBeNull()
  })
  it('非 200 信封返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: 500, message: 'x' }) })))
    expect(await probeUiPort('u')).toBeNull()
  })
  it('响应不是 JSON 也返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => { throw new SyntaxError('bad') } })))
    expect(await probeUiPort('u')).toBeNull()
  })
})

describe('探活次数上限(移植纪律 #4)', () => {
  it('有明确上限常量,不是无限探到组件销毁', () => {
    expect(PROBE_MAX_TRIES).toBe(40)   // 40 × 1500ms ≈ 60s
  })
})
```

`src/settings/panels/general/WebUiPortRow.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'

const state = { port: '80', editCalls: [] as unknown[], editFail: false }
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      getServerPort: async () => state.port,
      editServerPort: async (p: { port: string }) => {
        state.editCalls.push(p)
        if (state.editFail) throw new Error('boom')
      },
    },
  },
}))

import WebUiPortRow from './WebUiPortRow.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
// navigate 是可选 prop(生产环境不传 → 真跳转);测试传 spy。
// 不用 defineExpose 开测试后门 —— 那是只为测试存在的生产接口。
const mountRow = (navigate?: (url: string) => void) =>
  mount(WebUiPortRow, { props: navigate ? { navigate } : {}, global: { plugins: [i18n] } })

beforeEach(() => {
  setActivePinia(createPinia())
  state.port = '80'
  state.editCalls = []
  state.editFail = false
  vi.useFakeTimers()
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('WebUiPortRow', () => {
  it('挂载后填入当前端口', async () => {
    const w = mountRow()
    await flushPromises()
    expect((w.find('input').element as HTMLInputElement).value).toBe('80')
  })

  it('端口未改动时不显示提交按钮(对位 Vue2 portChanged)', async () => {
    const w = mountRow()
    await flushPromises()
    expect(w.find('.wpr-submit').exists()).toBe(false)
  })

  it('改动后出现提交按钮', async () => {
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('8080')
    expect(w.find('.wpr-submit').exists()).toBe(true)
  })

  it('越界端口:提示错误且不发请求', async () => {
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('79')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    expect(state.editCalls).toEqual([])
    expect(w.text()).toContain('端口范围为 80-65535')
  })

  it('合法端口:下发字符串形态的 port', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down') }))
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('8080')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    expect(state.editCalls).toEqual([{ port: '8080' }])
  })

  it('保存配置失败:停在原地并提示,不进入探活', async () => {
    state.editFail = true
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('8080')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('探活成功后跳转到新端口的当前页(移植纪律 #5)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: 200, data: '8080' }) })))
    const assign = vi.fn()
    const w = mountRow(assign)
    await flushPromises()
    await w.find('input').setValue('8080')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1500)
    await flushPromises()
    expect(assign).toHaveBeenCalledTimes(1)
    expect(assign.mock.calls[0][0]).toContain(':8080')
  })

  it('探活到上限仍不通:停表 + 提示手动访问,不无限探(移植纪律 #4)', async () => {
    const fetchSpy = vi.fn(async () => { throw new TypeError('down') })
    vi.stubGlobal('fetch', fetchSpy)
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('8080')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1500 * 45)
    await flushPromises()
    expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(40)
    expect(w.text()).toContain('新端口没有响应')
  })

  it('组件卸载后停表(不留定时器)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down') }))
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('8080')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    w.unmount()
    const before = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length
    await vi.advanceTimersByTimeAsync(1500 * 5)
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm test src/settings/util/checkUiPort.test.ts src/settings/panels/general/WebUiPortRow.test.ts 2>&1 | tail -12
```

- [ ] **Step 3: 实现 `src/settings/util/checkUiPort.ts`**

```ts
/**
 * 换 WebUI 端口后的新端口探活。对位 Vue2 SettingsPanel.vue 的
 * validatePort(L1387) / savePort(L1396) / checkUpdate(L1424)。
 *
 * spec §5.1 明确 checkUiPort 不进共享包 —— 它打的是**任意绝对 URL**
 * (跨端口、跨源),而共享包的 axios 实例带 baseURL、认证头与 401 刷新拦截器,
 * 拿它打别的源既没必要也会把拦截器逻辑牵进来。这里用裸 fetch。
 * 网关对所有响应都带 Access-Control-Allow-Origin: *(2026-07-31 curl 实证),
 * 所以跨源 fetch 可行。
 */
export const PROBE_INTERVAL_MS = 1500
/** 移植纪律 #4:Vue2 只在成功时 clearInterval,失败会一直探到组件销毁。这里给上限 40 次 ≈ 60s。 */
export const PROBE_MAX_TRIES = 40

/**
 * Vue2 用 `parseInt(this.port)` 校验 —— `'80.5'` 会被吃成 80、`'8o80'` 会被吃成 8。
 * 这是它的 bug,不照抄:这里要求整个字符串就是十进制整数。
 */
export function validatePort(raw: string): { ok: true; port: number } | { ok: false } {
  const s = raw.trim()
  if (!/^\d+$/.test(s)) return { ok: false }
  const port = Number(s)
  if (port < 80 || port > 65535) return { ok: false }
  return { ok: true, port }
}

type Loc = { protocol: string; hostname: string }
type FullLoc = Loc & { pathname: string; hash: string }

export function buildProbeUrl(port: string, loc: Loc = window.location): string {
  return `${loc.protocol}//${loc.hostname}:${port}/v1/gateway/port`
}

/**
 * 移植纪律 #5:Vue2 跳 `${protocol}//${host}:${port}`(根路径 = 旧 Vue2 应用)。
 * New-UI 挂在 /app/ 下,照抄会把用户甩出新 UI,所以保留当前 pathname + hash。
 */
export function buildRedirectUrl(port: string, loc: FullLoc = window.location): string {
  return `${loc.protocol}//${loc.hostname}:${port}${loc.pathname}${loc.hash}`
}

/** 单次探活。通了返回后端报的端口字符串,否则 null。**任何异常都吞掉** —— 切换期间连不上是常态。 */
export async function probeUiPort(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    const body = (await res.json()) as { success?: number; data?: unknown } | null
    if (body?.success === 200 && typeof body.data === 'string') return body.data
    return null
  } catch {
    return null
  }
}
```

- [ ] **Step 4: 实现 `WebUiPortRow.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L176-208(行)+ L1385-1440(逻辑)。
// 流程:校验 → PUT /v1/gateway/port → 轮询新端口的 /v1/gateway/port → 通了就跳过去。
// 网关换端口是「先起新端口、/ping 确认、再优雅关旧端口」(顶层 CLAUDE.md),
// 所以旧端口上的这个页面在切换窗口内还活着,能完成探活。
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import SettingsRow from '../../components/SettingsRow.vue'
import {
  PROBE_INTERVAL_MS, PROBE_MAX_TRIES,
  buildProbeUrl, buildRedirectUrl, probeUiPort, validatePort,
} from '../../util/checkUiPort'
import { useToast } from '../../../stores/toast'
import '../../styles/settings.css'

const { t } = useI18n()
const toast = useToast()

const port = ref('')
const originalPort = ref('')
const busy = ref(false)
const error = ref('')
const probing = ref(false)

// 跳转做成**可选 prop**:直接写 window.location.href 在 jsdom 里既测不到也会报警告。
// 用 prop 而不是 defineExpose 的测试后门 —— 后者是只为测试存在的生产接口。
const props = defineProps<{ navigate?: (url: string) => void }>()
function go(url: string) {
  if (props.navigate) props.navigate(url)
  else window.location.href = url
}

let timer: ReturnType<typeof setInterval> | null = null
let tries = 0

// 移植纪律 #7:onMounted 取到端口回来时,用户可能已经在输入框里打字了 ——
// 真机有网络往返,后到的旧值会把用户刚输入的内容冲掉(观感:"我打的字自己变回去了")。
// 只要用户动过输入框就不再覆盖。**就地写、不抽公共 guard**(评审已判定那是过早抽象)。
let touched = false

const changed = computed(() => port.value.trim() !== '' && port.value.trim() !== originalPort.value)

function onInput() {
  touched = true
}

onMounted(async () => {
  try {
    const p = await service.sys.getServerPort()   // 实测是字符串 "80"
    if (touched) return   // 用户已经开始编辑,别覆盖
    port.value = p
    originalPort.value = p
  } catch (e) {
    console.warn('[settings] getServerPort failed', e)
  }
})

function stopProbe() {
  if (timer) { clearInterval(timer); timer = null }
  probing.value = false
}
// 移植纪律 #4:Vue2 只在 beforeDestroy 清表,这里卸载与超时都清。
onBeforeUnmount(stopProbe)

async function submit() {
  const v = validatePort(port.value)
  if (!v.ok) {
    error.value = t('settingsPortRange')
    return
  }
  error.value = ''
  busy.value = true
  const next = String(v.port)
  try {
    await service.sys.editServerPort({ port: next })
  } catch (e) {
    busy.value = false
    toast.show(t('settingsSaveFailed'))
    console.warn('[settings] editServerPort failed', e)
    return   // 保存都没成功就不要进探活
  }
  startProbe(next)
}

function startProbe(next: string) {
  probing.value = true
  tries = 0
  const url = buildProbeUrl(next)
  timer = setInterval(async () => {
    tries++
    if (tries > PROBE_MAX_TRIES) {
      stopProbe()
      busy.value = false
      error.value = t('settingsPortTimeout')
      return
    }
    const reported = await probeUiPort(url)
    if (reported) {
      stopProbe()
      go(buildRedirectUrl(reported))
    }
  }, PROBE_INTERVAL_MS)
}
</script>

<template>
  <SettingsRow :label="t('settingsWebuiPort')">
    <template #control>
      <input
        v-model="port"
        class="set-input"
        type="text"
        inputmode="numeric"
        :placeholder="t('settingsPortPlaceholder')"
        :disabled="busy"
        @input="onInput"
        @keyup.enter="submit"
      />
      <button v-if="changed" class="set-btn primary wpr-submit" type="button" :disabled="busy" @click="submit">
        ✓
      </button>
    </template>
    <template v-if="error || probing" #hint>
      <span v-if="error" class="set-danger">{{ error }}</span>
      <span v-else class="set-info">{{ t('settingsPortSwitching') }}</span>
    </template>
  </SettingsRow>
</template>
```

- [ ] **Step 5: 跑测试确认通过 + 任务门 + 提交**

```bash
pnpm test src/settings 2>&1 | tail -8
pnpm test 2>&1 | tail -8
pnpm exec vue-tsc --noEmit
git status --short
git add src/settings/util/checkUiPort.ts src/settings/util/checkUiPort.test.ts \
        src/settings/panels/general/WebUiPortRow.vue src/settings/panels/general/WebUiPortRow.test.ts
git commit src/settings/util/checkUiPort.ts src/settings/util/checkUiPort.test.ts \
           src/settings/panels/general/WebUiPortRow.vue src/settings/panels/general/WebUiPortRow.test.ts \
  -m "feat(settings): WebUI 端口行(改端口 + 新端口探活 + 跳转)(SP9-P1)

- 移植纪律 #4:探活上限 40 次≈60s,超时停表提示;卸载也停表
  (Vue2 只在成功时 clearInterval,端口起不来会一直探到组件销毁)
- 移植纪律 #5:跳转保留 pathname+hash,不跳根路径
  (照抄会把用户从 /app/ 甩进旧 Vue2 界面)
- 校验要求整串是十进制整数(Vue2 用 parseInt,'80.5' 会被吃成 80)
- 探活用裸 fetch 而非共享包 axios:打的是跨源绝对 URL,不该牵进认证拦截器"
```

---

## Task 7: USB 自动挂载 / 推荐应用 / 新闻流 三行

**Files:**
- Create: `src/settings/panels/general/UsbAutoMountRow.vue`
- Create: `src/settings/panels/general/SwitchRow.vue`
- Create: `src/settings/panels/general/switchRows.test.ts`

**Interfaces:**
- Consumes: `service.sys.getUsbStatus()`(Task 1 已把 `"True"` 归一成布尔)、`service.sys.toggleUsbAutoMount({state})`、`service.sys.hardwareInfo()`(取 `drive_model` 判树莓派)、Task 2 的 `readSystemConfig` / `patchSystemConfig`、Task 3 的 `SettingsRow` / `SettingsSwitch`、`src/components/ui/AlertDialog.vue`(既有:`:open` `:title` `:message` `:confirmText` `:cancelText` `@confirm` `@update:open`)、`useToast()`
- Produces:
  ```
  <UsbAutoMountRow />                            // 自持状态
  <SwitchRow field="recommend_switch" label-key="settingsRecommendApps" />
  <SwitchRow field="rss_switch" label-key="settingsNewsFeed"
             confirm-title-key="settingsNewsFeedTitle"
             confirm-msg-key="settingsNewsFeedConfirm"
             confirm-ok-key="settingsAccept" />   // 只在「开」时弹确认
  ```

- [ ] **Step 1: 写失败测试**

`src/settings/panels/general/switchRows.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'

const blob: Record<string, unknown> = {}
const state = { usb: false, usbCalls: [] as unknown[], usbFail: false, driveModel: '' }

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => ({ ...blob }),
      setCustomStorage: async (_k: string, d: Record<string, unknown>) => { Object.assign(blob, d) },
    },
    sys: {
      getUsbStatus: async () => state.usb,
      toggleUsbAutoMount: async (p: { state: string }) => {
        state.usbCalls.push(p)
        if (state.usbFail) throw new Error('boom')
      },
      hardwareInfo: async () => ({ arch: 'arm64', drive_model: state.driveModel }),
    },
  },
}))

import UsbAutoMountRow from './UsbAutoMountRow.vue'
import SwitchRow from './SwitchRow.vue'
// 用「导入组件本身」而不是 findComponent({name:'AlertDialog'}):
// AlertDialog.vue 没有 defineOptions({name}),而它是 sp7/sp8 也会碰的共享文件,
// 为了测试去改它会白增合并冲突面。
import AlertDialog from '../../../components/ui/AlertDialog.vue'
import { __resetSystemConfigQueue } from '../../util/systemConfig'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

beforeEach(() => {
  setActivePinia(createPinia())
  for (const k of Object.keys(blob)) delete blob[k]
  state.usb = false; state.usbCalls = []; state.usbFail = false; state.driveModel = ''
  __resetSystemConfigQueue()
})

describe('UsbAutoMountRow', () => {
  const mountIt = () => mount(UsbAutoMountRow, { global: { plugins: [i18n] } })

  it('挂载后开关反映后端状态("True" 已在包里归一成布尔)', async () => {
    state.usb = true
    const w = mountIt()
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('挂载**不**下发 toggle(加载 ≠ 用户操作)', async () => {
    state.usb = true
    mountIt()
    await flushPromises()
    expect(state.usbCalls).toEqual([])
  })

  it('拨开下发 state:on,并立刻乐观翻转', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(state.usbCalls).toEqual([{ state: 'on' }])
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('拨关下发 state:off', async () => {
    state.usb = true
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(state.usbCalls).toEqual([{ state: 'off' }])
  })

  it('下发失败时开关弹回原状态(Vue2 是 fire-and-forget,失败后界面在骗人)', async () => {
    state.usbFail = true
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
  })

  it('树莓派 + 开启时给出启动失败警告(对位 Vue2 L1791-1797)', async () => {
    state.driveModel = 'Raspberry Pi 5 Model B'
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    // Vue2 译文写的是 "Raspberry Pi" 而不是「树莓派」,断言跟着译文走
    expect(w.text()).toContain('Raspberry Pi')
  })

  it('非树莓派不给警告', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('Raspberry Pi')
  })

  it('关闭时即使是树莓派也不给警告(警告只针对「开启」)', async () => {
    state.driveModel = 'Raspberry Pi 5'
    state.usb = true
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('Raspberry Pi')
  })
})

describe('SwitchRow —— 推荐应用(无确认)', () => {
  const mountIt = () => mount(SwitchRow, {
    props: { field: 'recommend_switch', labelKey: 'settingsRecommendApps' },
    global: { plugins: [i18n] },
  })

  it('挂载后反映服务端值,默认 true(对位 Vue2 L942)', async () => {
    const w = mountIt()
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('拨动直接落库,只写自己那一个字段', async () => {
    blob.rss_switch = true
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(blob.recommend_switch).toBe(false)
    expect(blob.rss_switch).toBe(true)
  })

  it('落库失败时弹回', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.users, 'setCustomStorage').mockRejectedValueOnce(new Error('boom'))
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })
})

describe('SwitchRow —— 新闻流(开启需确认,对位 Vue2 rssConfirm L1696-1715)', () => {
  const mountIt = () => mount(SwitchRow, {
    props: {
      field: 'rss_switch', labelKey: 'settingsNewsFeed',
      confirmTitleKey: 'settingsNewsFeedTitle',
      confirmMsgKey: 'settingsNewsFeedConfirm',
      confirmOkKey: 'settingsAccept',
    },
    global: { plugins: [i18n] },
  })

  it('默认关(对位 Vue2 L944 rss_switch:false)', async () => {
    const w = mountIt()
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
  })

  it('拨开先弹确认,未确认前不落库、开关不翻', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.findComponent(AlertDialog).props('open')).toBe(true)
    expect(blob.rss_switch).toBeUndefined()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
  })

  it('确认后才落库并翻开', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    w.findComponent(AlertDialog).vm.$emit('confirm')
    await flushPromises()
    expect(blob.rss_switch).toBe(true)
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('取消确认:保持关闭且不落库', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    w.findComponent(AlertDialog).vm.$emit('update:open', false)
    await flushPromises()
    expect(blob.rss_switch).toBeUndefined()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
  })

  it('关闭方向**不**弹确认,直接落库(对位 Vue2:!rss_switch 时直接 saveData)', async () => {
    blob.rss_switch = true
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.findComponent(AlertDialog).props('open')).toBe(false)
    expect(blob.rss_switch).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm test src/settings/panels/general/switchRows.test.ts 2>&1 | tail -12
```

- [ ] **Step 3: 实现 `UsbAutoMountRow.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L211-217(行)+ getUsbStatus L1442 / usbAutoMount L1449。
// 移植纪律:Vue2 的 usbAutoMount() 是 fire-and-forget(不 await、不看结果),
// 下发失败时开关停在新位置、界面在骗人。这里改成失败弹回。
// 树莓派警告:Vue2 用 hardwareInfo().drive_model 是否含 "raspberry" 判断
// (LocalStorage 服务在树莓派上会静默强制关掉 USB 自动挂载,见顶层 CLAUDE.md)。
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import SettingsRow from '../../components/SettingsRow.vue'
import SettingsSwitch from '../../components/SettingsSwitch.vue'
import { useToast } from '../../../stores/toast'
import '../../styles/settings.css'

const { t } = useI18n()
const toast = useToast()

const on = ref(false)
const busy = ref(false)
const isRpi = ref(false)
const warn = ref('')

onMounted(async () => {
  await Promise.allSettled([
    service.sys.getUsbStatus().then((v) => { on.value = v }),
    service.sys.hardwareInfo().then((hw) => {
      const model = typeof hw.drive_model === 'string' ? hw.drive_model : ''
      isRpi.value = model.toLowerCase().includes('raspberry')
    }),
  ])
})

async function onToggle(next: boolean) {
  if (busy.value) return
  const prev = on.value
  on.value = next            // 乐观翻转
  busy.value = true
  warn.value = ''
  try {
    await service.sys.toggleUsbAutoMount({ state: next ? 'on' : 'off' })
    // 警告只针对「开启」方向
    if (next && isRpi.value) warn.value = t('settingsUsbRpiWarn')
  } catch (e) {
    on.value = prev          // 失败弹回(Vue2 不弹,界面会骗人)
    toast.show(t('settingsSaveFailed'))
    console.warn('[settings] toggleUsbAutoMount failed', e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <SettingsRow :label="t('settingsUsbAutoMount')">
    <template #control>
      <SettingsSwitch
        :model-value="on"
        :label="t('settingsUsbAutoMount')"
        :disabled="busy"
        @update:model-value="onToggle"
      />
    </template>
    <template v-if="warn" #hint><span class="set-warn">{{ warn }}</span></template>
  </SettingsRow>
</template>
```

- [ ] **Step 4: 实现 `SwitchRow.vue`**

```vue
<script setup lang="ts">
// 服务端 system blob 里一个布尔字段的开关行。两处复用:
//   - 推荐应用(Vue2 L220-226,直接保存)
//   - 新闻流  (Vue2 L229-236 + rssConfirm L1696-1715,**只在开启方向**弹确认)
// 「显示其他 Docker 容器应用」那一行不做 —— Vue2 恒不渲染(债务 D15,见计划 §实测校正 4)。
//
// 移植纪律 #1:加载不回写;只在用户拨动时 patch,且只写自己那一个字段
// (整块覆写会和别的行/语言互相洗,见 systemConfig.ts 的串行队列)。
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/SettingsRow.vue'
import SettingsSwitch from '../../components/SettingsSwitch.vue'
import AlertDialog from '../../../components/ui/AlertDialog.vue'
import { readSystemConfig, patchSystemConfig, SYSTEM_DEFAULTS } from '../../util/systemConfig'
import { useToast } from '../../../stores/toast'
import '../../styles/settings.css'

const props = defineProps<{
  field: string
  labelKey: string
  /** 三个 confirm* 同时给才启用「开启前确认」 */
  confirmTitleKey?: string
  confirmMsgKey?: string
  confirmOkKey?: string
}>()

const { t } = useI18n()
const toast = useToast()

const on = ref<boolean>(SYSTEM_DEFAULTS[props.field] === true)
const busy = ref(false)
const confirmOpen = ref(false)

onMounted(async () => {
  const cfg = await readSystemConfig()
  if (typeof cfg[props.field] === 'boolean') on.value = cfg[props.field] as boolean
})

async function save(next: boolean) {
  const prev = on.value
  on.value = next
  busy.value = true
  try {
    await patchSystemConfig({ [props.field]: next })
  } catch (e) {
    on.value = prev
    toast.show(t('settingsSaveFailed'))
    console.warn('[settings] save switch failed', props.field, e)
  } finally {
    busy.value = false
  }
}

function onToggle(next: boolean) {
  // 只有「开启」方向需要确认;关闭方向直接存(对位 Vue2 rssConfirm 的 !rss_switch 分支)
  if (next && props.confirmMsgKey) {
    confirmOpen.value = true
    return
  }
  void save(next)
}

function onConfirm() {
  confirmOpen.value = false
  void save(true)
}
</script>

<template>
  <SettingsRow :label="t(labelKey)">
    <template #control>
      <SettingsSwitch
        :model-value="on"
        :label="t(labelKey)"
        :disabled="busy"
        @update:model-value="onToggle"
      />
    </template>
  </SettingsRow>

  <AlertDialog
    v-if="confirmMsgKey && confirmTitleKey && confirmOkKey"
    :open="confirmOpen"
    :title="t(confirmTitleKey)"
    :message="t(confirmMsgKey)"
    :confirm-text="t(confirmOkKey)"
    :cancel-text="t('settingsCancel')"
    @update:open="confirmOpen = $event"
    @confirm="onConfirm"
  />
</template>
```

> **不要**为了测试给 `AlertDialog.vue` 加 `defineOptions({name})` —— 它是 sp7/sp8 也会碰的共享文件,测试里直接 `import AlertDialog from '…'` 再 `findComponent(AlertDialog)` 即可,本任务**不改任何共享文件**。

- [ ] **Step 5: 跑测试确认通过 + 任务门 + 提交**

```bash
pnpm test src/settings 2>&1 | tail -8
pnpm test 2>&1 | tail -8
pnpm exec vue-tsc --noEmit
git status --short
git add src/settings/panels/general/UsbAutoMountRow.vue src/settings/panels/general/SwitchRow.vue \
        src/settings/panels/general/switchRows.test.ts
git commit src/settings/panels/general/UsbAutoMountRow.vue src/settings/panels/general/SwitchRow.vue \
           src/settings/panels/general/switchRows.test.ts \
  -m "feat(settings): USB 自动挂载 / 推荐应用 / 新闻流三行(SP9-P1)

- 开关下发失败一律弹回原位(Vue2 是 fire-and-forget,失败后界面在骗人)
- 新闻流只在「开启」方向弹确认,关闭直接存(对位 Vue2 rssConfirm)
- 树莓派警告只在开启方向给出
- 「显示其他 Docker 容器应用」行不做:Vue2 恒不渲染(债务 D15)"
```

---

## Task 8: 更新两行 + 更新弹窗

**⚠️ 自查时不要点「立即更新 / 立即升级」** —— 会真的触发升级并重启这台机器。本机实测 `need_update:false`(两个端点都是),所以正常路径下按钮是「检查更新」并只会弹一个「当前已经是最新版」的提示,这一步可以安全自查;**下载与升级分支靠单测覆盖**。

**Files:**
- Create: `src/settings/components/UpdateDialog.vue`
- Create: `src/settings/components/UpdateDialog.test.ts`
- Create: `src/settings/panels/general/UpdateRow.vue`
- Create: `src/settings/panels/general/UpdateRow.test.ts`

**Interfaces:**
- Consumes: `service.sys.getOsVersion(params?)` / `getAppVersion(params?)` / `updateOs()` / `updateApp()` / `cancelDownload()`、`service.file.getContent(path)`(既有,读升级日志)、`useMessageBus().on(event, cb) → 取消订阅函数`、`renderMarkdown`(`src/files/viewers/renderMarkdown.ts`,`html:false`,`v-html` 其输出安全)、`Dialog.vue`、Task 3 的 `.set-btn` / `.set-ok` / `.set-info`
- Produces:
  ```ts
  export type UpdateKind = 'os' | 'app'
  // UpdateRow：一行 + 自带弹窗
  <UpdateRow kind="os"  :sub="string" />    // 标签「固件更新」，副标题传 hardware.version
  <UpdateRow kind="app" />                  // 标签「系统更新」，副标题用 current_version
  // UpdateDialog
  <UpdateDialog :open :kind :info="UpdateCheck" :currently-downloading="boolean"
                @update:open @changed />    // @changed = 让父行重新拉一次状态
  ```
  MessageBus 事件(逐字取自 Vue2 `sockets:` 块 L2201-2229):
  `nimoos:upgrade:progress` / `nimoos:upgrade:downloaded`(os) · `nimoos:app:download:progress` / `nimoos:app:downloaded`(app),进度在 `Properties.progress`(`useMessageBus` 的 `extractProps` 已剥这一层)

- [ ] **Step 1: 写 `UpdateRow` 的失败测试**

`src/settings/panels/general/UpdateRow.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'

const state = {
  os: { current_version: '1.0.0', need_update: false } as Record<string, unknown>,
  app: { current_version: '1.9.3-alpha1+25.gc8d7d14-dirty', need_update: false } as Record<string, unknown>,
  osCalls: [] as unknown[],
  appCalls: [] as unknown[],
}
const busHandlers: Record<string, ((p: unknown) => void)[]> = {}

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      getOsVersion: async (p?: unknown) => { state.osCalls.push(p); return state.os },
      getAppVersion: async (p?: unknown) => { state.appCalls.push(p); return state.app },
      updateOs: async () => {}, updateApp: async () => {}, cancelDownload: async () => {},
    },
    file: { getContent: async () => ({ content: '' }) },
  },
}))
vi.mock('../../../composables/useMessageBus', () => ({
  useMessageBus: () => ({
    on(event: string, cb: (p: unknown) => void) {
      ;(busHandlers[event] ||= []).push(cb)
      return () => { busHandlers[event] = busHandlers[event].filter((f) => f !== cb) }
    },
  }),
}))

import UpdateRow from './UpdateRow.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const mountRow = (kind: 'os' | 'app', sub?: string) =>
  mount(UpdateRow, { props: { kind, sub }, global: { plugins: [i18n] } })

beforeEach(() => {
  setActivePinia(createPinia())
  state.os = { current_version: '1.0.0', need_update: false }
  state.app = { current_version: '1.9.3-alpha1+25.gc8d7d14-dirty', need_update: false }
  state.osCalls = []; state.appCalls = []
  for (const k of Object.keys(busHandlers)) delete busHandlers[k]
})

describe('UpdateRow 端点选择(命名陷阱)', () => {
  it('kind=os 打 getOsVersion(/sys/os_version)', async () => {
    mountRow('os'); await flushPromises()
    expect(state.osCalls).toHaveLength(1)
    expect(state.appCalls).toHaveLength(0)
  })
  it('kind=app 打 getAppVersion(/sys/version)', async () => {
    mountRow('app'); await flushPromises()
    expect(state.appCalls).toHaveLength(1)
    expect(state.osCalls).toHaveLength(0)
  })
  it('挂载时不带 trigger_download(不能一进设置页就开始下载)', async () => {
    mountRow('os'); await flushPromises()
    expect(state.osCalls[0]).toBeUndefined()
  })
})

describe('UpdateRow 标签与副标题(Vue2 的标签/数据源是交叉的,1:1 照留)', () => {
  it('os 行标签「固件更新」,副标题用传入的 sub', async () => {
    const w = mountRow('os', '1.9.3-alpha1+25.gc8d7d14-dirty'); await flushPromises()
    expect(w.find('.set-row-label').text()).toBe('固件更新')
    expect(w.find('.set-row-sub').text()).toBe('v1.9.3-alpha1+25.gc8d7d14-dirty')
  })
  it('app 行标签「系统更新」,副标题用自己的 current_version', async () => {
    const w = mountRow('app'); await flushPromises()
    expect(w.find('.set-row-label').text()).toBe('系统更新')
    expect(w.find('.set-row-sub').text()).toBe('v1.9.3-alpha1+25.gc8d7d14-dirty')
  })
  it('current_version 缺失时副标题回退 v1.0.0', async () => {
    state.app = { current_version: '', need_update: false }
    const w = mountRow('app'); await flushPromises()
    expect(w.find('.set-row-sub').text()).toBe('v1.0.0')
  })
})

describe('UpdateRow 四种状态(对位 Vue2 L249-312)', () => {
  it('无需更新:显示「当前已经是最新版」+「检查更新」按钮', async () => {
    const w = mountRow('os'); await flushPromises()
    expect(w.find('.set-ok').text()).toContain('当前已经是最新版')
    expect(w.find('.ur-check').text()).toBe('检查更新')
  })

  it('已下载:显示版本 + 已下载,按钮变「立即升级」', async () => {
    state.os = { current_version: '1.0.0', latest_version: '1.1.0', need_update: true, is_downloaded: true }
    const w = mountRow('os'); await flushPromises()
    expect(w.find('.set-info').text()).toContain('v1.1.0')
    expect(w.find('.set-info').text()).toContain('已下载')
    expect(w.find('.ur-open').text()).toBe('立即升级')
  })

  it('下载中:按钮显示百分比', async () => {
    state.os = { current_version: '1.0.0', need_update: true, is_downloading: true, download_progress: 37 }
    const w = mountRow('os'); await flushPromises()
    expect(w.find('.ur-progress').text()).toContain('37')
  })

  it('下载中且进度缺失:按 0% 显示而不是 NaN', async () => {
    state.os = { current_version: '1.0.0', need_update: true, is_downloading: true }
    const w = mountRow('os'); await flushPromises()
    expect(w.find('.ur-progress').text()).toContain('0')
    expect(w.text()).not.toContain('NaN')
  })

  it('有更新但未下载:按钮是「检查更新」(Vue2 同一个按钮)', async () => {
    state.os = { current_version: '1.0.0', need_update: true }
    const w = mountRow('os'); await flushPromises()
    expect(w.find('.ur-check').exists()).toBe(true)
  })
})

describe('UpdateRow 检查更新交互', () => {
  it('无更新时点检查:不开弹窗,提示已是最新', async () => {
    const w = mountRow('os'); await flushPromises()
    await w.find('.ur-check').trigger('click'); await flushPromises()
    expect(w.findComponent({ name: 'UpdateDialog' }).props('open')).toBe(false)
  })

  it('有更新时点检查:打开弹窗', async () => {
    state.os = { current_version: '1.0.0', latest_version: '1.1.0', need_update: true }
    const w = mountRow('os'); await flushPromises()
    await w.find('.ur-check').trigger('click'); await flushPromises()
    expect(w.findComponent({ name: 'UpdateDialog' }).props('open')).toBe(true)
  })

  it('检查失败不卡在 loading', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'getOsVersion').mockRejectedValueOnce(new Error('boom'))
    const w = mountRow('os'); await flushPromises()
    await w.find('.ur-check').trigger('click'); await flushPromises()
    expect(w.find('.ur-check').attributes('disabled')).toBeUndefined()
  })
})

describe('UpdateRow MessageBus 进度(逐字对位 Vue2 sockets 块)', () => {
  it('os 行只听 upgrade 系事件,app 行只听 app 系事件', async () => {
    mountRow('os'); await flushPromises()
    expect(Object.keys(busHandlers).sort()).toEqual(['nimoos:upgrade:downloaded', 'nimoos:upgrade:progress'])
  })

  it('收到进度事件后行上显示百分比', async () => {
    const w = mountRow('os'); await flushPromises()
    busHandlers['nimoos:upgrade:progress'].forEach((f) => f({ progress: '42.5' }))
    await flushPromises()
    expect(w.find('.ur-progress').text()).toContain('42.5')
  })

  it('进度不回退(Vue2 checkVersion 有这个保护:轮询回来的旧进度不许覆盖更大的实时进度)', async () => {
    const w = mountRow('os'); await flushPromises()
    // 实时事件把进度推到 80
    busHandlers['nimoos:upgrade:progress'].forEach((f) => f({ progress: '80' }))
    await flushPromises()
    // 服务端此刻只报到 30;downloaded 事件会触发一次 fetchInfo —— 守卫必须挡住这次回退
    state.os = { current_version: '1.0.0', need_update: true, is_downloading: true, download_progress: 30 }
    busHandlers['nimoos:upgrade:downloaded'].forEach((f) => f({}))
    await flushPromises()
    expect(w.find('.ur-progress').text()).toContain('80')
  })

  it('服务端报的进度更大时采用服务端值(守卫只挡回退,不是永不更新)', async () => {
    const w = mountRow('os'); await flushPromises()
    busHandlers['nimoos:upgrade:progress'].forEach((f) => f({ progress: '20' }))
    await flushPromises()
    state.os = { current_version: '1.0.0', need_update: true, is_downloading: true, download_progress: 55 }
    busHandlers['nimoos:upgrade:downloaded'].forEach((f) => f({}))
    await flushPromises()
    expect(w.find('.ur-progress').text()).toContain('55')
  })

  it('downloaded 事件后重新拉状态', async () => {
    mountRow('os'); await flushPromises()
    const before = state.osCalls.length
    busHandlers['nimoos:upgrade:downloaded'].forEach((f) => f({}))
    await flushPromises()
    expect(state.osCalls.length).toBeGreaterThan(before)
  })

  it('卸载后取消订阅', async () => {
    const w = mountRow('os'); await flushPromises()
    w.unmount()
    expect(busHandlers['nimoos:upgrade:progress']).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 写 `UpdateDialog` 的失败测试**

`src/settings/components/UpdateDialog.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'

const state = {
  os: { current_version: '1.0.0', need_update: true, latest_version: '1.1.0' } as Record<string, unknown>,
  versionCalls: [] as unknown[],
  updateOsCalls: 0, cancelCalls: 0, logContent: 'step 1\nstep 2',
  updateOsFail: false,
}
const busHandlers: Record<string, ((p: unknown) => void)[]> = {}

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      getOsVersion: async (p?: unknown) => { state.versionCalls.push(p); return state.os },
      getAppVersion: async (p?: unknown) => { state.versionCalls.push(p); return state.os },
      updateOs: async () => { state.updateOsCalls++; if (state.updateOsFail) throw new Error('boom') },
      updateApp: async () => { state.updateOsCalls++ },
      cancelDownload: async () => { state.cancelCalls++ },
    },
    file: { getContent: async () => ({ content: state.logContent }) },
  },
}))
vi.mock('../../composables/useMessageBus', () => ({
  useMessageBus: () => ({
    on(event: string, cb: (p: unknown) => void) {
      ;(busHandlers[event] ||= []).push(cb)
      return () => { busHandlers[event] = busHandlers[event].filter((f) => f !== cb) }
    },
  }),
}))

import UpdateDialog from './UpdateDialog.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const INFO = { current_version: '1.0.0', need_update: true, latest_version: '1.1.0', version: { change_log: '## 更新内容\n- 修了个 bug' } }
const mountIt = (props: Record<string, unknown> = {}) =>
  mount(UpdateDialog, {
    props: { open: true, kind: 'os', info: INFO, ...props },
    global: { plugins: [i18n] },
  })

beforeEach(() => {
  setActivePinia(createPinia())
  state.versionCalls = []; state.updateOsCalls = 0; state.cancelCalls = 0
  state.updateOsFail = false
  for (const k of Object.keys(busHandlers)) delete busHandlers[k]
  vi.useFakeTimers()
})
afterEach(() => { vi.useRealTimers() })

describe('UpdateDialog 默认态', () => {
  it('标题带版本号', () => {
    expect(mountIt().text()).toContain('v1.1.0')
  })
  it('渲染 changelog 的 markdown(html:false,v-html 安全)', () => {
    const w = mountIt()
    expect(w.find('.upd-log').html()).toContain('<h2>')
    expect(w.find('.upd-log').text()).toContain('修了个 bug')
  })
  it('changelog 缺失时不炸', () => {
    const w = mountIt({ info: { current_version: '1.0.0', need_update: true } })
    expect(w.find('.upd-log').exists()).toBe(true)
  })
  it('未下载时按钮是「立即下载」', () => {
    expect(mountIt().find('.upd-download').text()).toBe('立即下载')
  })
  it('已下载时按钮是「立即更新」', () => {
    const w = mountIt({ info: { ...INFO, is_downloaded: true } })
    expect(w.find('.upd-upgrade').text()).toBe('立即更新')
  })
})

describe('UpdateDialog 下载', () => {
  it('点下载时带 trigger_download:1', async () => {
    const w = mountIt()
    await w.find('.upd-download').trigger('click'); await flushPromises()
    expect(state.versionCalls[0]).toEqual({ trigger_download: 1 })
  })

  it('进入下载态后显示进度条与取消按钮', async () => {
    const w = mountIt()
    await w.find('.upd-download').trigger('click'); await flushPromises()
    expect(w.find('.upd-bar').exists()).toBe(true)
    expect(w.find('.upd-cancel').exists()).toBe(true)
  })

  it('MessageBus 进度推进进度条', async () => {
    const w = mountIt()
    await w.find('.upd-download').trigger('click'); await flushPromises()
    busHandlers['nimoos:upgrade:progress'].forEach((f) => f({ progress: '66' }))
    await flushPromises()
    expect(w.find('.upd-bar').attributes('aria-valuenow')).toBe('66')
  })

  it('kind=os 忽略 app 系进度事件(串台会显示错的百分比)', async () => {
    const w = mountIt()
    await w.find('.upd-download').trigger('click'); await flushPromises()
    expect(busHandlers['nimoos:app:download:progress']).toBeUndefined()
  })

  it('触发下载时若后端直接报已下载,收弹窗并 emit changed', async () => {
    state.os = { current_version: '1.0.0', need_update: true, is_downloaded: true }
    const w = mountIt()
    await w.find('.upd-download').trigger('click'); await flushPromises()
    expect(w.emitted('update:open')).toEqual([[false]])
    expect(w.emitted('changed')).toBeTruthy()
  })

  it('downloaded 事件到达时收弹窗并 emit changed', async () => {
    const w = mountIt()
    await w.find('.upd-download').trigger('click'); await flushPromises()
    busHandlers['nimoos:upgrade:downloaded'].forEach((f) => f({}))
    await flushPromises()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('点取消:调 cancelDownload,收弹窗并 emit changed', async () => {
    const w = mountIt()
    await w.find('.upd-download').trigger('click'); await flushPromises()
    await w.find('.upd-cancel').trigger('click'); await flushPromises()
    expect(state.cancelCalls).toBe(1)
    expect(w.emitted('changed')).toBeTruthy()
  })

  it('currentlyDownloading=true:一打开就是下载态', () => {
    const w = mountIt({ info: { ...INFO, is_downloading: true, download_progress: 55 }, currentlyDownloading: true })
    expect(w.find('.upd-bar').attributes('aria-valuenow')).toBe('55')
    expect(w.find('.upd-cancel').exists()).toBe(true)
  })
})

describe('UpdateDialog 升级', () => {
  it('kind=os 点升级调 updateOs 并进入日志态', async () => {
    const w = mountIt({ info: { ...INFO, is_downloaded: true } })
    await w.find('.upd-upgrade').trigger('click'); await flushPromises()
    expect(state.updateOsCalls).toBe(1)
    expect(w.find('.upd-logs').exists()).toBe(true)
  })

  it('日志按 2 秒轮询,读的是 os 的日志路径', async () => {
    const svc = await import('@nimotech/nimoos-service')
    const spy = vi.spyOn(svc.service.file, 'getContent')
    const w = mountIt({ info: { ...INFO, is_downloaded: true } })
    await w.find('.upd-upgrade').trigger('click'); await flushPromises()
    await vi.advanceTimersByTimeAsync(2000); await flushPromises()
    expect(spy.mock.calls[0][0]).toBe('/var/log/nimoos/upgrade.log')
  })

  it('kind=app 读的是 app 的日志路径', async () => {
    const svc = await import('@nimotech/nimoos-service')
    const spy = vi.spyOn(svc.service.file, 'getContent')
    const w = mountIt({ kind: 'app', info: { ...INFO, is_downloaded: true } })
    await w.find('.upd-upgrade').trigger('click'); await flushPromises()
    await vi.advanceTimersByTimeAsync(2000); await flushPromises()
    expect(spy.mock.calls[0][0]).toBe('/var/log/nimoos_app_upgrade.log')
  })

  it('升级接口失败:退出日志态,回到可再试的样子', async () => {
    state.updateOsFail = true
    const w = mountIt({ info: { ...INFO, is_downloaded: true } })
    await w.find('.upd-upgrade').trigger('click'); await flushPromises()
    expect(w.find('.upd-logs').exists()).toBe(false)
    expect(w.find('.upd-upgrade').exists()).toBe(true)
  })

  it('弹窗关闭后停掉日志轮询(不留定时器)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    const spy = vi.spyOn(svc.service.file, 'getContent')
    const w = mountIt({ info: { ...INFO, is_downloaded: true } })
    await w.find('.upd-upgrade').trigger('click'); await flushPromises()
    await vi.advanceTimersByTimeAsync(2000); await flushPromises()
    const before = spy.mock.calls.length
    w.unmount()
    await vi.advanceTimersByTimeAsync(6000)
    expect(spy.mock.calls.length).toBe(before)
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

```bash
pnpm test src/settings/components/UpdateDialog.test.ts src/settings/panels/general/UpdateRow.test.ts 2>&1 | tail -12
```

- [ ] **Step 4: 实现 `UpdateDialog.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 UpdateModal.vue(321 行)。三种态:changelog(默认)/ 下载中(进度条)/ 升级中(日志)。
// spec §5.1 还点名了 UpdateCompleteModal(177 行)—— **不移植**:
// 它只由 Home.vue 在 localStorage['is_update']==='true' 时弹,而全仓没有一处写过该键
// (触发器从未实现)→ 从未弹过。用户 2026-07-31 拍板跳过,债务 D14。
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type UpdateCheck } from '@nimotech/nimoos-service'
import Dialog from '../../components/ui/Dialog.vue'
import { renderMarkdown } from '../../files/viewers/renderMarkdown'
import { useMessageBus } from '../../composables/useMessageBus'
import { useToast } from '../../stores/toast'
import '../styles/settings.css'

export type UpdateKind = 'os' | 'app'

defineOptions({ name: 'UpdateDialog' })
const props = defineProps<{
  open: boolean
  kind: UpdateKind
  info: UpdateCheck
  currentlyDownloading?: boolean
}>()
const emit = defineEmits<{ 'update:open': [boolean]; changed: [] }>()

const { t } = useI18n()
const toast = useToast()
const bus = useMessageBus()

// 事件名逐字取自 Vue2 sockets 块(SettingsPanel.vue L2201-2229 / UpdateModal.vue L203-241)。
// 两套事件必须按 kind 分开订阅 —— 串台会把固件进度显示到系统更新上。
const EV = {
  os: { progress: 'nimoos:upgrade:progress', done: 'nimoos:upgrade:downloaded' },
  app: { progress: 'nimoos:app:download:progress', done: 'nimoos:app:downloaded' },
} as const
const LOG_PATH = {
  os: '/var/log/nimoos/upgrade.log',
  app: '/var/log/nimoos_app_upgrade.log',
} as const

type Phase = 'idle' | 'downloading' | 'upgrading'
const phase = ref<Phase>('idle')
const progress = ref(0)
const logs = ref('')

const changelogHtml = computed(() => renderMarkdown(props.info.version?.change_log ?? ''))
const isDownloaded = computed(() => props.info.is_downloaded === true)

let logTimer: ReturnType<typeof setInterval> | null = null
let unsub: (() => void)[] = []

function stopLogs() {
  if (logTimer) { clearInterval(logTimer); logTimer = null }
}
function unbind() {
  unsub.forEach((f) => f())
  unsub = []
}
onBeforeUnmount(() => { stopLogs(); unbind() })

watch(() => props.open, (o) => {
  if (!o) { stopLogs(); unbind(); phase.value = 'idle'; return }
  phase.value = props.currentlyDownloading ? 'downloading' : 'idle'
  progress.value = props.info.download_progress ?? 0
  bind()
}, { immediate: true })

function bind() {
  unbind()
  const ev = EV[props.kind]
  unsub.push(bus.on(ev.progress, (p) => {
    const v = Number.parseFloat(String((p as { progress?: unknown })?.progress ?? ''))
    if (!Number.isFinite(v)) return
    progress.value = v
    if (v > 0 && v < 100) phase.value = 'downloading'
  }))
  unsub.push(bus.on(ev.done, () => {
    phase.value = 'idle'
    progress.value = 100
    toast.show(t('settingsDownloaded'))
    emit('changed')
    emit('update:open', false)
  }))
}

async function startDownload() {
  phase.value = 'downloading'
  progress.value = 0
  try {
    // 下载不是独立端点:靠 version 检查带 trigger_download=1 触发
    const res = props.kind === 'app'
      ? await service.sys.getAppVersion({ trigger_download: 1 })
      : await service.sys.getOsVersion({ trigger_download: 1 })
    if (res.is_downloaded) {
      phase.value = 'idle'
      toast.show(t('settingsDownloaded'))
      emit('changed')
      emit('update:open', false)
    }
    // 否则等 MessageBus 的进度 / downloaded 事件。
    // Vue2 这里还额外起了 3 秒轮询兜底(UpdateModal startProgressPolling);
    // MessageBus 的 downloaded 事件已覆盖同一件事,再加一条轮询只是重复,故不照抄。
  } catch (e) {
    phase.value = 'idle'
    console.warn('[settings] trigger download failed', e)
    toast.show(t('settingsSaveFailed'))
  }
}

async function cancel() {
  try {
    await service.sys.cancelDownload()
    toast.show(t('settingsDownloadCancelled'))
  } catch (e) {
    console.warn('[settings] cancelDownload failed', e)
    toast.show(t('settingsDownloadCancelFailed'))
  } finally {
    phase.value = 'idle'
    emit('changed')
    emit('update:open', false)
  }
}

async function upgrade() {
  phase.value = 'upgrading'
  logs.value = ''
  try {
    if (props.kind === 'app') await service.sys.updateApp()
    else await service.sys.updateOs()
  } catch (e) {
    phase.value = 'idle'      // 让用户能再试一次,而不是卡在日志空屏
    console.warn('[settings] upgrade failed', e)
    toast.show(t('settingsUpgradeFailed'))
    return
  }
  pollLogs()
}

function pollLogs() {
  stopLogs()
  const path = LOG_PATH[props.kind]
  logTimer = setInterval(async () => {
    try {
      // FileContent 是具名类型({ content: string }),不需要 cast
      const res = await service.file.getContent(path)
      logs.value = res.content ?? ''
    } catch { /* 日志文件可能还没建出来,静默重试 */ }
  }, 2000)
}
</script>

<template>
  <Dialog
    :open="open"
    :title="`${isDownloaded ? t('settingsUpdateTitle') : t('settingsUpdateAvailable')} v${info.latest_version ?? ''}`"
    @update:open="emit('update:open', $event)"
  >
    <div class="upd-body">
      <div v-if="phase === 'downloading'" class="upd-dl">
        <div class="upd-dl-head">
          <span>{{ t('settingsDownloadingSystem') }}…</span>
          <strong>{{ progress }}%</strong>
        </div>
        <div
          class="upd-bar"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="progress"
        ><span class="upd-bar-fill" :style="{ width: `${progress}%` }"></span></div>
      </div>

      <pre v-else-if="phase === 'upgrading'" class="upd-logs">{{ logs }}</pre>

      <!-- renderMarkdown 是 html:false 的 markdown-it —— 原始 HTML 被转义,v-html 其输出安全 -->
      <div v-else class="upd-log" v-html="changelogHtml"></div>
    </div>

    <template #footer>
      <button v-if="phase === 'downloading'" class="set-btn upd-cancel" type="button" @click="cancel">
        {{ t('settingsCancel') }}
      </button>
      <button
        v-else-if="!isDownloaded && phase !== 'upgrading'"
        class="set-btn primary upd-download"
        type="button"
        @click="startDownload"
      >{{ t('settingsDownloadNow') }}</button>
      <button
        v-else-if="phase !== 'upgrading'"
        class="set-btn primary upd-upgrade"
        type="button"
        @click="upgrade"
      >{{ t('settingsUpgradeNow') }}</button>
    </template>
  </Dialog>
</template>

<style scoped>
.upd-body { min-width: min(560px, 82vw); max-height: 52vh; overflow-y: auto; }
.upd-dl-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 13px; color: var(--fg-muted); }
.upd-bar { height: 8px; border-radius: 999px; background: var(--chip-bg); overflow: hidden; }
.upd-bar-fill { display: block; height: 100%; background: var(--accent); transition: width 0.2s var(--ease); }
.upd-logs {
  margin: 0; padding: 12px; border-radius: var(--radius-sm);
  background: var(--console-bg); color: var(--console-fg);
  font-size: 12px; white-space: pre-wrap; word-break: break-all; max-height: 46vh; overflow-y: auto;
}
.upd-log { font-size: 14px; line-height: 1.6; }
.upd-log :deep(h1), .upd-log :deep(h2), .upd-log :deep(h3) { font-size: 15px; margin: 12px 0 6px; }
.upd-log :deep(ul) { padding-left: 20px; margin: 6px 0; }
.upd-log :deep(a) { color: var(--accent-text); }
</style>
```

- [ ] **Step 5: 实现 `UpdateRow.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue 的两行:
//   - L249-278「Firmware Update」,数据来自 /sys/os_version(kind='os')
//   - L281-312「System Update」(源码注释写 App Update),数据来自 /sys/version(kind='app')
// ⚠️ Vue2 的标签与数据源确实是交叉的,界面 1:1 就照留,别"纠正"标签。
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type UpdateCheck } from '@nimotech/nimoos-service'
import SettingsRow from '../../components/SettingsRow.vue'
import UpdateDialog, { type UpdateKind } from '../../components/UpdateDialog.vue'
import { useMessageBus } from '../../../composables/useMessageBus'
import { useToast } from '../../../stores/toast'
import '../../styles/settings.css'

const props = defineProps<{ kind: UpdateKind; sub?: string }>()

const { t } = useI18n()
const toast = useToast()
const bus = useMessageBus()

const EV = {
  os: { progress: 'nimoos:upgrade:progress', done: 'nimoos:upgrade:downloaded' },
  app: { progress: 'nimoos:app:download:progress', done: 'nimoos:app:downloaded' },
} as const

const info = ref<UpdateCheck>({ current_version: '', need_update: false })
const checking = ref(false)
const dialogOpen = ref(false)
const wasDownloading = ref(false)

const label = computed(() => (props.kind === 'os' ? t('settingsFirmwareUpdate') : t('settingsSystemUpdate')))
// os 行副标题由父组件传 hardware.version(Vue2 L254);app 行用自己的 current_version(L287)
const subLabel = computed(() => `v${props.sub || info.value.current_version || '1.0.0'}`)
const progress = computed(() => info.value.download_progress ?? 0)

async function fetchInfo(): Promise<UpdateCheck | null> {
  try {
    const res = props.kind === 'app' ? await service.sys.getAppVersion() : await service.sys.getOsVersion()
    // Vue2 checkVersion/checkAppVersion 的保护:轮询回来的旧进度不许覆盖更大的实时进度
    if (res.is_downloading && (info.value.download_progress ?? 0) > (res.download_progress ?? 0)) {
      res.download_progress = info.value.download_progress
    }
    info.value = res
    return res
  } catch (e) {
    console.warn('[settings] version check failed', props.kind, e)
    return null
  }
}

let unsub: (() => void)[] = []
onMounted(async () => {
  await fetchInfo()
  const ev = EV[props.kind]
  unsub.push(bus.on(ev.progress, (p) => {
    const v = Number.parseFloat(String((p as { progress?: unknown })?.progress ?? ''))
    if (!Number.isFinite(v)) return
    info.value = { ...info.value, is_downloading: true, download_progress: v }
  }))
  unsub.push(bus.on(ev.done, () => { void fetchInfo() }))
})
onBeforeUnmount(() => { unsub.forEach((f) => f()); unsub = [] })

// 对位 Vue2 showUpdateModal / showAppUpdateModal:先查一次,没更新就只弹提示
async function check() {
  checking.value = true
  const res = await fetchInfo()
  checking.value = false
  if (!res) return
  if (!res.need_update) {
    toast.show(t('settingsLatestVersion'))
    return
  }
  wasDownloading.value = false
  dialogOpen.value = true
}

// 对位 Vue2 showFirmwareDownloadingModal / showAppDownloadingModal:直接进下载态
function openDownloading() {
  wasDownloading.value = true
  dialogOpen.value = true
}
</script>

<template>
  <SettingsRow :label="label" :sub="subLabel">
    <template #control>
      <span v-if="!info.need_update" class="set-ok">{{ t('settingsLatestVersion') }} ✓</span>
      <span v-else-if="info.is_downloaded" class="set-info">
        v{{ info.latest_version }} {{ t('settingsDownloaded') }} ✓
      </span>
      <button v-else-if="info.is_downloading" class="set-btn primary ur-progress" type="button" @click="openDownloading">
        {{ t('settingsDownloading') }} {{ progress }}%
      </button>

      <button v-if="info.is_downloaded" class="set-btn primary ur-open" type="button" @click="dialogOpen = true">
        {{ t('settingsUpdateNow') }}
      </button>
      <button
        v-else-if="!info.is_downloading"
        class="set-btn primary ur-check"
        type="button"
        :disabled="checking"
        @click="check"
      >{{ t('settingsCheckUpdate') }}</button>
    </template>
  </SettingsRow>

  <UpdateDialog
    :open="dialogOpen"
    :kind="kind"
    :info="info"
    :currently-downloading="wasDownloading"
    @update:open="dialogOpen = $event"
    @changed="fetchInfo"
  />
</template>
```

> `UpdateDialog.vue` 用 `export type UpdateKind` 从 `<script setup>` 导出类型:`<script setup>` 里的 `export` 是不允许的 —— 把 `export type UpdateKind = 'os' | 'app'` 移到**同文件的普通 `<script lang="ts">` 块**里(与 `<script setup>` 并存),或单独放 `src/settings/util/updateKind.ts`。**实现时选后者更稳**,并同步修正两个文件的 import。

- [ ] **Step 6: 跑测试确认通过 + 任务门 + 提交**

```bash
pnpm test src/settings 2>&1 | tail -8
pnpm test 2>&1 | tail -8
pnpm exec vue-tsc --noEmit
git status --short
git add src/settings/components/UpdateDialog.vue src/settings/components/UpdateDialog.test.ts \
        src/settings/panels/general/UpdateRow.vue src/settings/panels/general/UpdateRow.test.ts \
        src/settings/util/updateKind.ts
git commit src/settings/components/UpdateDialog.vue src/settings/components/UpdateDialog.test.ts \
           src/settings/panels/general/UpdateRow.vue src/settings/panels/general/UpdateRow.test.ts \
           src/settings/util/updateKind.ts \
  -m "feat(settings): 固件更新与系统更新两行 + 更新弹窗(SP9-P1)

- os/app 两套 MessageBus 事件按 kind 分开订阅,防串台
- 保留 Vue2 的进度不回退保护(轮询旧进度不覆盖更大的实时进度)
- 升级接口失败退出日志态让用户能再试,不卡空屏
- 不照抄 UpdateModal 的 3 秒轮询兜底:downloaded 事件已覆盖同一件事
- UpdateCompleteModal 不移植:Vue2 触发器从未实现,从未弹过(债务 D14)"
```

---

## Task 9: 电源流(关机 / 重启 + 6 状态浮层)

**⚠️ 自查绝对不要点关机或重启** —— 会真的关掉/重启这台开发机。相位机全部逻辑都在 `powerFlow.ts` 里用假定时器单测;界面只自查两个按钮和确认弹窗的形状。

**Files:**
- Create: `src/settings/util/powerFlow.ts`
- Create: `src/settings/util/powerFlow.test.ts`
- Create: `src/settings/components/PowerOverlay.vue`
- Create: `src/settings/components/PowerOverlay.test.ts`
- Create: `src/settings/components/PowerFlow.vue`
- Create: `src/settings/components/PowerFlow.test.ts`
- Modify: `src/settings/components/SettingsShell.vue`(**本期唯一一次碰它**:`.set-rail-foot` 里塞 `<PowerFlow />`)
- Modify: `src/settings/components/SettingsShell.test.ts`

**Interfaces:**
- Consumes: `service.sys.power('off' | 'restart')`、`AlertDialog.vue`、`Dialog.vue`、Task 3 的 `.set-btn` / `.set-warn`
- Produces:
  ```ts
  export type PowerPhase =
    | 'idle' | 'shutting' | 'offline'
    | 'restarting' | 'reconnecting' | 'done' | 'fallback' | 'appUpdating'
  export const PING_INTERVAL_MS = 3000
  export const SHUTDOWN_FALLBACK_MS = 60_000
  export const RESTART_FALLBACK_MS = 180_000
  export const RESTART_PING_DELAY_MS = 5_000
  export const DONE_RELOAD_DELAY_MS = 1_500
  export const SHUTDOWN_FAIL_THRESHOLD = 2
  /** 探活:拿到任何 HTTP 响应(含 401)都算「服务器活着」,只有网络错误才算下线。 */
  export function probeAlive(fetchImpl?: typeof fetch): Promise<boolean>
  export interface PowerFlowDeps {
    probe: () => Promise<boolean>
    reload: () => void
    onPhase: (p: PowerPhase) => void
  }
  export interface PowerFlowController {
    startShutdown(): void
    startRestart(): void
    startAppUpdating(): void
    reset(): void
  }
  export function createPowerFlow(deps: PowerFlowDeps): PowerFlowController
  ```

- [ ] **Step 1: 写 `powerFlow.ts` 的失败测试**

`src/settings/util/powerFlow.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createPowerFlow, probeAlive,
  PING_INTERVAL_MS, SHUTDOWN_FALLBACK_MS, RESTART_FALLBACK_MS,
  RESTART_PING_DELAY_MS, DONE_RELOAD_DELAY_MS,
  type PowerPhase,
} from './powerFlow'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

function harness(probeSeq: boolean[]) {
  const phases: PowerPhase[] = []
  const reload = vi.fn()
  let i = 0
  const probe = vi.fn(async () => probeSeq[Math.min(i++, probeSeq.length - 1)])
  const c = createPowerFlow({ probe, reload, onPhase: (p) => phases.push(p) })
  return { c, phases, reload, probe }
}

describe('probeAlive(移植纪律 #6)', () => {
  it('200 → 活着', async () => {
    expect(await probeAlive(vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch)).toBe(true)
  })
  it('401 也算活着 —— 服务器能回 401 说明它起来了', async () => {
    expect(await probeAlive(vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch)).toBe(true)
  })
  it('500 也算活着', async () => {
    expect(await probeAlive(vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch)).toBe(true)
  })
  it('网络错误 → 下线', async () => {
    expect(await probeAlive(vi.fn(async () => { throw new TypeError('Failed to fetch') }) as unknown as typeof fetch)).toBe(false)
  })
})

describe('关机流(对位 Vue2 onShutdownConfirmed L1779-1811)', () => {
  it('立刻进 shutting', () => {
    const { c, phases } = harness([true])
    c.startShutdown()
    expect(phases).toEqual(['shutting'])
  })

  it('连续 2 次探活失败才判定 offline(单次失败可能只是抖动)', async () => {
    const { c, phases } = harness([false])
    c.startShutdown()
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS)
    expect(phases).toEqual(['shutting'])
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS)
    expect(phases).toEqual(['shutting', 'offline'])
  })

  it('中间探活成功会把失败计数清零', async () => {
    const { c, phases } = harness([false, true, false])
    c.startShutdown()
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS * 3)
    expect(phases).toEqual(['shutting'])   // 失败-成功-失败 → 从未连续两次
  })

  it('60 秒兜底也进 offline(机器没回应探活的极端情况)', async () => {
    const { c, phases } = harness([true])
    c.startShutdown()
    await vi.advanceTimersByTimeAsync(SHUTDOWN_FALLBACK_MS)
    expect(phases).toEqual(['shutting', 'offline'])
  })

  it('判定 offline 后停止探活(不继续打已关机的机器)', async () => {
    const { c, probe } = harness([false])
    c.startShutdown()
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS * 2)
    const n = probe.mock.calls.length
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS * 5)
    expect(probe.mock.calls.length).toBe(n)
  })
})

describe('重启流(对位 Vue2 onRestartConfirmed L1816-1861)', () => {
  it('立刻进 restarting', () => {
    const { c, phases } = harness([true])
    c.startRestart()
    expect(phases).toEqual(['restarting'])
  })

  it('前 5 秒不探活(给重启命令生效的时间)', async () => {
    const { c, probe } = harness([true])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS - 1)
    expect(probe).not.toHaveBeenCalled()
  })

  it('探活失败一次即进 reconnecting(重启不像关机,下线是必经态)', async () => {
    const { c, phases } = harness([false])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS)
    expect(phases).toEqual(['restarting', 'reconnecting'])
  })

  it('必须先下线再上线才算重启完成(否则只是命令还没生效)', async () => {
    const { c, phases, reload } = harness([true, true, true])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS * 3)
    expect(phases).toEqual(['restarting'])   // 一直在线 → 不判完成
    expect(reload).not.toHaveBeenCalled()
  })

  it('下线再上线 → done,并在 1.5 秒后 reload', async () => {
    const { c, phases, reload } = harness([false, true])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS * 2)
    expect(phases).toEqual(['restarting', 'reconnecting', 'done'])
    expect(reload).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(DONE_RELOAD_DELAY_MS)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('180 秒仍没回来 → fallback', async () => {
    const { c, phases } = harness([false])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_FALLBACK_MS)
    expect(phases[phases.length - 1]).toBe('fallback')
  })

  it('fallback 后停止探活与兜底表', async () => {
    const { c, probe, reload } = harness([false])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_FALLBACK_MS)
    const n = probe.mock.calls.length
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS * 10)
    expect(probe.mock.calls.length).toBe(n)
    expect(reload).not.toHaveBeenCalled()
  })

  it('done 之后不再有多余的相位变化(不会又滑回 reconnecting)', async () => {
    const { c, phases } = harness([false, true, false, false])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS * 6)
    expect(phases).toEqual(['restarting', 'reconnecting', 'done'])
  })
})

describe('应用更新流(对位 Vue2 startAppUpdate L1501-1534)', () => {
  it('进 appUpdating,5 秒后直接当作已下线开始等回来', async () => {
    const { c, phases } = harness([true])
    c.startAppUpdating()
    expect(phases).toEqual(['appUpdating'])
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS)
    expect(phases).toEqual(['appUpdating', 'done'])
  })
})

describe('reset', () => {
  it('清掉所有定时器并回 idle', async () => {
    const { c, phases, probe, reload } = harness([false])
    c.startRestart()
    c.reset()
    expect(phases[phases.length - 1]).toBe('idle')
    const n = probe.mock.calls.length
    await vi.advanceTimersByTimeAsync(RESTART_FALLBACK_MS * 2)
    expect(probe.mock.calls.length).toBe(n)
    expect(reload).not.toHaveBeenCalled()
  })

  it('reset 后可以重新开一轮', async () => {
    const { c, phases } = harness([false])
    c.startShutdown(); c.reset(); c.startShutdown()
    expect(phases).toEqual(['shutting', 'idle', 'shutting'])
  })
})
```

- [ ] **Step 2: 跑测试确认失败,然后实现 `powerFlow.ts`**

```bash
pnpm test src/settings/util/powerFlow.test.ts 2>&1 | tail -12
```

```ts
/**
 * 电源相位机。对位 Vue2 SettingsPanel.vue 的
 * onShutdownConfirmed(L1779) / onRestartConfirmed(L1816) / startAppUpdate(L1501) /
 * _onShutdownOffline(L1812) / _onRestartFallback(L1862) / resetPower(L1873)。
 *
 * 抽成不依赖 Vue 的控制器,是为了能用假定时器把「下线→上线」这类时序真的测出来 ——
 * Vue2 那边全混在组件方法里,一条都测不了,而这块逻辑一旦错就是用户盯着
 * 「正在重启」永远不动,或者机器还没关就说「已关机」。
 */
export type PowerPhase =
  | 'idle' | 'shutting' | 'offline'
  | 'restarting' | 'reconnecting' | 'done' | 'fallback' | 'appUpdating'

export const PING_INTERVAL_MS = 3000
export const SHUTDOWN_FALLBACK_MS = 60_000
export const RESTART_FALLBACK_MS = 180_000
export const RESTART_PING_DELAY_MS = 5_000
export const DONE_RELOAD_DELAY_MS = 1_500
/** 关机:连续 2 次探活失败才判定已下线(单次失败可能只是网络抖动) */
export const SHUTDOWN_FAIL_THRESHOLD = 2

/**
 * 移植纪律 #6:Vue2 用 $api.users.getUserStatus() 探活,走的是带认证拦截器的 axios ——
 * 重启期间一个 401 就会触发 onAuthFail、清 token 并跳登录页,把电源流打断。
 * 这里用裸 fetch,并且**任何 HTTP 响应(含 401/500)都算「服务器活着」** ——
 * 能回 HTTP 状态码就说明它起来了,这才是探活真正要问的问题。
 */
export async function probeAlive(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    await fetchImpl('/v1/users/status', { cache: 'no-store' })
    return true
  } catch {
    return false
  }
}

export interface PowerFlowDeps {
  probe: () => Promise<boolean>
  reload: () => void
  onPhase: (p: PowerPhase) => void
}

export interface PowerFlowController {
  startShutdown(): void
  startRestart(): void
  startAppUpdating(): void
  reset(): void
}

export function createPowerFlow(deps: PowerFlowDeps): PowerFlowController {
  let ping: ReturnType<typeof setInterval> | null = null
  let fallback: ReturnType<typeof setTimeout> | null = null
  let delay: ReturnType<typeof setTimeout> | null = null
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  let fails = 0
  let sawOffline = false
  let settled = false   // done / offline / fallback 之后不再接受相位变化

  function clearAll() {
    for (const [t, clear] of [
      [ping, clearInterval], [fallback, clearTimeout],
      [delay, clearTimeout], [reloadTimer, clearTimeout],
    ] as const) if (t) (clear as (h: unknown) => void)(t)
    ping = fallback = delay = reloadTimer = null
  }

  function settle(p: PowerPhase) {
    if (settled) return
    settled = true
    clearAll()
    deps.onPhase(p)
  }

  function reset() {
    clearAll()
    fails = 0
    sawOffline = false
    settled = false
    deps.onPhase('idle')
  }

  function startShutdown() {
    clearAll()
    fails = 0; sawOffline = false; settled = false
    deps.onPhase('shutting')
    fallback = setTimeout(() => settle('offline'), SHUTDOWN_FALLBACK_MS)
    ping = setInterval(async () => {
      const alive = await deps.probe()
      if (settled) return
      if (alive) { fails = 0; return }
      fails++
      if (fails >= SHUTDOWN_FAIL_THRESHOLD) settle('offline')
    }, PING_INTERVAL_MS)
  }

  /** 重启与应用更新共用「等下线 → 等上线 → done → reload」这段。 */
  function waitForComeback(assumeOffline: boolean) {
    sawOffline = assumeOffline
    fallback = setTimeout(() => settle('fallback'), RESTART_FALLBACK_MS)
    // Vue2 先等 5 秒再开始探活:重启命令下发到服务真的开始停,需要时间,
    // 太早探到"还活着"没有意义。
    delay = setTimeout(() => {
      ping = setInterval(async () => {
        const alive = await deps.probe()
        if (settled) return
        if (!alive) {
          if (!sawOffline) { sawOffline = true; deps.onPhase('reconnecting') }
          return
        }
        // 活着:只有先见过下线,才说明真的重启完成了
        if (!sawOffline) return
        settle('done')
        reloadTimer = setTimeout(() => deps.reload(), DONE_RELOAD_DELAY_MS)
      }, PING_INTERVAL_MS)
    }, RESTART_PING_DELAY_MS)
  }

  function startRestart() {
    clearAll()
    fails = 0; settled = false
    deps.onPhase('restarting')
    waitForComeback(false)
  }

  function startAppUpdating() {
    clearAll()
    fails = 0; settled = false
    deps.onPhase('appUpdating')
    // Vue2 startAppUpdate 在 5 秒后直接把 restartServerOffline 置真 ——
    // 应用更新一定会重启服务,所以不必先观察到下线。
    waitForComeback(true)
  }

  return { startShutdown, startRestart, startAppUpdating, reset }
}
```

> `settle()` 里的 `clearAll()` 用了一个 `for…of` 配对表,若实现时觉得不清晰,直接写四行 `if (ping) clearInterval(ping)` 也行 —— 行为一致,别为了简洁牺牲可读性。

- [ ] **Step 3: 写 `PowerFlow.vue` 的失败测试**

`src/settings/components/PowerFlow.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'

const powerCalls: string[] = []
vi.mock('@nimotech/nimoos-service', () => ({
  service: { sys: { power: async (a: string) => { powerCalls.push(a) } } },
}))

import PowerFlow from './PowerFlow.vue'
import PowerOverlay from './PowerOverlay.vue'
import AlertDialog from '../../components/ui/AlertDialog.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const mountIt = () => mount(PowerFlow, { global: { plugins: [i18n] } })

beforeEach(() => {
  setActivePinia(createPinia())
  powerCalls.length = 0
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down') }))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('PowerFlow 按钮与确认', () => {
  it('渲染关机与重启两个按钮', () => {
    const w = mountIt()
    expect(w.find('.pf-shutdown').exists()).toBe(true)
    expect(w.find('.pf-restart').exists()).toBe(true)
  })

  it('两个按钮都有无障碍名(纯图标按钮)', () => {
    const w = mountIt()
    expect(w.find('.pf-shutdown').attributes('aria-label')).toBe('关机')
    expect(w.find('.pf-restart').attributes('aria-label')).toBe('重启')
  })

  it('点关机先弹确认,**未确认前不下发**(对位 Vue2 power() 只是开确认框)', async () => {
    const w = mountIt()
    await w.find('.pf-shutdown').trigger('click')
    expect(w.findAllComponents(AlertDialog)[0].props('open')).toBe(true)
    expect(powerCalls).toEqual([])
  })

  it('确认关机才 PUT off,并显示 shutting 浮层', async () => {
    const w = mountIt()
    await w.find('.pf-shutdown').trigger('click')
    w.findAllComponents(AlertDialog)[0].vm.$emit('confirm')
    await flushPromises()
    expect(powerCalls).toEqual(['off'])
    expect(w.text()).toContain('正在关机')
  })

  it('取消关机:不下发、无浮层', async () => {
    const w = mountIt()
    await w.find('.pf-shutdown').trigger('click')
    w.findAllComponents(AlertDialog)[0].vm.$emit('update:open', false)
    await flushPromises()
    expect(powerCalls).toEqual([])
    expect(w.text()).not.toContain('正在关机')
  })

  it('确认重启才 PUT restart', async () => {
    const w = mountIt()
    await w.find('.pf-restart').trigger('click')
    w.findAllComponents(AlertDialog)[1].vm.$emit('confirm')
    await flushPromises()
    expect(powerCalls).toEqual(['restart'])
    expect(w.text()).toContain('正在重启')
  })

  it('power 接口报错也照样进浮层(Vue2 .catch(()=>{}) —— 关机请求常常来不及回响应)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'power').mockRejectedValueOnce(new Error('boom'))
    const w = mountIt()
    await w.find('.pf-shutdown').trigger('click')
    w.findAllComponents(AlertDialog)[0].vm.$emit('confirm')
    await flushPromises()
    expect(w.text()).toContain('正在关机')
  })
})

// 六个浮层态直接挂纯展示组件 PowerOverlay —— 它只吃一个 phase prop,
// 不需要在 PowerFlow 上开 __setPhase 这类只为测试存在的生产接口。
describe('PowerOverlay 六个浮层态', () => {
  const mountOverlay = (phase: string) =>
    mount(PowerOverlay, { props: { phase }, global: { plugins: [i18n] } })

  it('shutting', () => expect(mountOverlay('shutting').text()).toContain('请等待约 30 秒'))
  it('offline', () => expect(mountOverlay('offline').text()).toContain('可以安全断电'))
  it('restarting', () => expect(mountOverlay('restarting').text()).toContain('正在发送重启指令'))
  it('reconnecting', () => expect(mountOverlay('reconnecting').text()).toContain('自动重新连接'))
  it('done', () => expect(mountOverlay('done').text()).toContain('正在跳转'))
  it('appUpdating', () => expect(mountOverlay('appUpdating').text()).toContain('系统正在更新'))

  it('每个态的标题都有译文(没渲染出裸 key)', () => {
    for (const ph of ['shutting', 'offline', 'restarting', 'reconnecting', 'done', 'appUpdating', 'fallback']) {
      expect(mountOverlay(ph).find('.pf-card-title').text()).not.toMatch(/^settings/)
    }
  })

  it('fallback 带警示色与刷新按钮', () => {
    const w = mountOverlay('fallback')
    expect(w.find('.set-warn').exists()).toBe(true)
    expect(w.find('.pf-reload').exists()).toBe(true)
  })

  it('offline 与 fallback 可关闭,点关闭 emit close(其余等待态不给关闭按钮)', async () => {
    for (const ph of ['offline', 'fallback']) {
      const w = mountOverlay(ph)
      expect(w.find('.pf-close').exists()).toBe(true)
      await w.find('.pf-close').trigger('click')
      expect(w.emitted('close')).toHaveLength(1)
    }
    for (const ph of ['shutting', 'restarting', 'reconnecting', 'done', 'appUpdating']) {
      expect(mountOverlay(ph).find('.pf-close').exists()).toBe(false)
    }
  })

  it('idle 时什么都不渲染', () => {
    expect(mountOverlay('idle').find('.pf-overlay').exists()).toBe(false)
  })
})

describe('PowerFlow 清理', () => {
  it('卸载时停掉相位机的定时器', async () => {
    const w = mountIt()
    await w.find('.pf-shutdown').trigger('click')
    w.findAllComponents(AlertDialog)[0].vm.$emit('confirm')
    await flushPromises()
    w.unmount()
    const before = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length
    await vi.advanceTimersByTimeAsync(3000 * 10)
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before)
  })
})
```

- [ ] **Step 4a: 实现 `PowerOverlay.vue`(纯展示,只吃一个 phase)**

```vue
<script setup lang="ts">
// 电源状态浮层,对位 Vue2 SettingsPanel.vue L714-790 的 6 个态。
// 拆成纯展示组件的理由:相位由父组件的相位机驱动,这里只做「相位 → 文案 + 可否关闭」的映射,
// 于是 6 个态能直接挂载断言,不必在 PowerFlow 上开只为测试存在的接口。
//
// 自绘而不用 ui/Dialog.vue:等待类相位不允许 Esc / 点外部关闭,
// 而 reka 的 DialogRoot 默认允许两者,逐个关掉不如自绘清楚。
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PowerPhase } from '../util/powerFlow'
import '../styles/settings.css'

const props = defineProps<{ phase: PowerPhase }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

// 含 idle 一起给键(值为空串)。模板里的 v-if="phase !== 'idle'" **不会**为
// TITLE[phase] 这种索引访问收窄类型,写成 Exclude<PowerPhase,'idle'> 会让 vue-tsc 报错。
const TITLE: Record<PowerPhase, string> = {
  idle: '',
  shutting: 'settingsPowerShutting', offline: 'settingsPowerOffline',
  restarting: 'settingsPowerRestarting', reconnecting: 'settingsPowerReconnecting',
  done: 'settingsPowerBack', appUpdating: 'settingsPowerAppUpdating',
  fallback: 'settingsPowerFallback',
}
const MSG: Record<PowerPhase, string> = {
  idle: '',
  shutting: 'settingsPowerShuttingMsg', offline: 'settingsPowerOfflineMsg',
  restarting: 'settingsPowerRestartingMsg', reconnecting: 'settingsPowerReconnectingMsg',
  done: 'settingsPowerBackMsg', appUpdating: 'settingsPowerAppUpdatingMsg',
  fallback: 'settingsPowerFallbackMsg',
}

// 等待类相位不给关闭按钮(对位 Vue2 :can-cancel="false" —— 只有 offline / fallback 有 delete 按钮)
const CLOSABLE: readonly PowerPhase[] = ['offline', 'fallback']
const closable = computed(() => CLOSABLE.includes(props.phase))

function reloadPage() {
  window.location.reload()
}
</script>

<template>
  <div v-if="phase !== 'idle'" class="pf-overlay">
    <div class="pf-card">
      <header class="pf-card-head">
        <h2 class="pf-card-title" :class="{ 'set-warn': phase === 'fallback' }">
          {{ t(TITLE[phase]) }}
        </h2>
        <button
          v-if="closable"
          class="pf-close"
          type="button"
          :aria-label="t('settingsCancel')"
          @click="emit('close')"
        >×</button>
      </header>
      <p class="pf-card-msg">{{ t(MSG[phase]) }}</p>
      <footer v-if="phase === 'fallback'" class="pf-card-foot">
        <button class="set-btn primary pf-reload" type="button" @click="reloadPage">
          {{ t('settingsRefresh') }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.pf-overlay {
  position: fixed; inset: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: center;
  background: var(--overlay-bg); backdrop-filter: var(--overlay-blur);
}
.pf-card {
  width: min(360px, 88vw); padding: 20px; border-radius: 18px;
  background: var(--popup-bg); border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow-hi); color: var(--fg);
}
.pf-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.pf-card-title { margin: 0 0 10px; font-size: 16px; font-weight: 600; }
.pf-close {
  border: 0; background: none; color: var(--fg-faint);
  font-size: 20px; line-height: 1; cursor: pointer; padding: 0; font-family: inherit;
}
.pf-close:hover { color: var(--fg); }
.pf-card-msg { margin: 0; font-size: 14px; color: var(--fg-muted); }
.pf-card-foot { display: flex; justify-content: flex-end; margin-top: 18px; }
</style>
```

- [ ] **Step 4b: 实现 `PowerFlow.vue`(按钮 + 确认 + 驱动相位机)**

```vue
<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue 的侧栏电源块(L33-46)+ 两个确认弹窗(L711-712)
// + 电源状态浮层(L714-790,6 个态)。相位机在 util/powerFlow.ts,这里只管界面。
import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import AlertDialog from '../../components/ui/AlertDialog.vue'
import PowerOverlay from './PowerOverlay.vue'
import { createPowerFlow, probeAlive, type PowerPhase } from '../util/powerFlow'
import '../styles/settings.css'

const { t } = useI18n()

const phase = ref<PowerPhase>('idle')
const askShutdown = ref(false)
const askRestart = ref(false)

const flow = createPowerFlow({
  probe: () => probeAlive(),
  reload: () => window.location.reload(),
  onPhase: (p) => { phase.value = p },
})
onBeforeUnmount(() => flow.reset())

async function doShutdown() {
  askShutdown.value = false
  flow.startShutdown()
  // Vue2 是 .catch(()=>{}) —— 关机请求常常在响应回来之前连接就断了,
  // 报错不代表没关成功,所以不因此中断相位机。
  try { await service.sys.power('off') } catch { /* 见上 */ }
}

async function doRestart() {
  askRestart.value = false
  flow.startRestart()
  try { await service.sys.power('restart') } catch { /* 同上 */ }
}

function close() { flow.reset() }
</script>

<template>
  <div class="pf">
    <button class="pf-btn pf-shutdown" type="button" :aria-label="t('settingsShutdown')" @click="askShutdown = true">
      ⏻
    </button>
    <button class="pf-btn pf-restart" type="button" :aria-label="t('settingsRestart')" @click="askRestart = true">
      ⟳
    </button>

    <AlertDialog
      :open="askShutdown"
      :title="t('settingsShutdownConfirmTitle')"
      :message="t('settingsShutdownConfirmMsg')"
      :confirm-text="t('settingsShutdown')"
      :cancel-text="t('settingsCancel')"
      destructive
      @update:open="askShutdown = $event"
      @confirm="doShutdown"
    />
    <AlertDialog
      :open="askRestart"
      :title="t('settingsRestartConfirmTitle')"
      :message="t('settingsRestartConfirmMsg')"
      :confirm-text="t('settingsRestart')"
      :cancel-text="t('settingsCancel')"
      @update:open="askRestart = $event"
      @confirm="doRestart"
    />

    <PowerOverlay :phase="phase" @close="close" />
  </div>
</template>

<style scoped>
.pf { display: flex; align-items: center; gap: 8px; padding: 8px 4px; }
.pf-btn {
  width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--chip-border); border-radius: 50%;
  background: var(--chip-bg); color: var(--fg-muted);
  font-size: 16px; cursor: pointer; font-family: inherit;
}
.pf-btn:hover { background: var(--chip-bg-hi); color: var(--fg); }
/* 关机是破坏性动作,hover 给危险色提示(Vue2 的 .power-item-btn.attention 同理) */
.pf-shutdown:hover { color: var(--remove-fg); border-color: var(--remove-fg); }
</style>
```

- [ ] **Step 5: 把 `PowerFlow` 塞进 `SettingsShell` 的 `.set-rail-foot`**

`src/settings/components/SettingsShell.vue` —— **本期唯一一次改它**,改动尽量小(它是将来合并 master 的接触面):

1. 顶部 import 加一行:`import PowerFlow from './PowerFlow.vue'`
2. 把 P0 留的占位替换掉:
```vue
      <!-- P0 留的占位,P1 填入电源流(spec §5.1) -->
      <div class="set-rail-foot"><PowerFlow /></div>
```

在 `src/settings/components/SettingsShell.test.ts` 追加:

```ts
it('侧栏底部有电源按钮(P0 的空容器已填)', () => {
  const w = mountShell()   // 沿用该文件既有的挂载辅助
  expect(w.find('.set-rail-foot .pf-shutdown').exists()).toBe(true)
  expect(w.find('.set-rail-foot .pf-restart').exists()).toBe(true)
})
```

> 若 `SettingsShell.test.ts` 原本没 mock 共享包,加入 `PowerFlow` 后会引入 `service.sys.power` 的 import。给该测试文件补上最小 mock:
> ```ts
> vi.mock('@nimotech/nimoos-service', () => ({ service: { sys: { power: async () => {} } } }))
> ```

- [ ] **Step 6: 跑测试确认通过 + 任务门 + 提交**

```bash
pnpm test src/settings 2>&1 | tail -8
pnpm test 2>&1 | tail -8
pnpm exec vue-tsc --noEmit
git status --short
git add src/settings/util/powerFlow.ts src/settings/util/powerFlow.test.ts \
        src/settings/components/PowerOverlay.vue src/settings/components/PowerOverlay.test.ts \
        src/settings/components/PowerFlow.vue src/settings/components/PowerFlow.test.ts
git commit src/settings/util/powerFlow.ts src/settings/util/powerFlow.test.ts \
           src/settings/components/PowerOverlay.vue src/settings/components/PowerOverlay.test.ts \
           src/settings/components/PowerFlow.vue src/settings/components/PowerFlow.test.ts \
           src/settings/components/SettingsShell.vue src/settings/components/SettingsShell.test.ts \
  -m "feat(settings): 侧栏电源流 + 6 状态浮层(SP9-P1)

- 相位机抽成不依赖 Vue 的控制器,用假定时器把「下线→上线」时序真的测出来
- 移植纪律 #6:探活改裸 fetch,任何 HTTP 响应(含 401)都算服务器活着
  (Vue2 走带认证拦截器的 axios,重启期间一个 401 就会跳登录页打断流程)
- 关机连续 2 次探活失败才判下线;重启必须先见下线再见上线才算完成
- 等待类相位不给关闭按钮,只有 offline / fallback 可关
- 浮层拆成纯展示 PowerOverlay(只吃 phase),6 个态可直接挂载断言
- 浮层自绘不用 reka Dialog:等待态不允许 Esc/点外关闭"
```

---

## Task 10: GeneralPanel 装配

**Files:**
- Modify: `src/settings/panels/GeneralPanel.vue`
- Modify: `src/settings/panels/panels.test.ts`
- Create: `src/settings/panels/general/GeneralPanel.integration.test.ts`

**Interfaces:**
- Consumes: Task 4-9 的全部行组件;P0 的 `SettingsSection`(`:title` + 默认插槽)与既有的 `open-tab` 事件通道
- Produces: 无新接口 —— 本任务只定**顺序**与整页装配

**行顺序(逐条对位 Vue2 SettingsPanel.vue,不许改序):**

| # | 行 | Vue2 行号 | 备注 |
|---|---|---|---|
| — | ~~Premium 推广条~~ | L67-73 | **不做**,授权偏离 #6 |
| 1 | 设备信息卡 | L76-96 | `DeviceInfoCard` |
| 2 | 壁纸 | L102-116 | 按钮禁用(D5) |
| 3 | 语言 | L119-135 | 只 2 项(D6) |
| 4 | 时区 | L138-154 | |
| 5 | 硬盘待机 | L157-173 | |
| 6 | WebUI 端口 | L176-208 | |
| 7 | 自动挂载 USB | L211-217 | |
| 8 | 显示推荐应用 | L220-226 | `SwitchRow recommend_switch` |
| 9 | 新闻流 | L229-236 | `SwitchRow rss_switch`,开启需确认 |
| — | ~~显示其他 Docker 容器应用~~ | L239-245 | **不做**,恒不渲染(D15) |
| 10 | 固件更新 | L249-278 | `UpdateRow kind="os"`,副标题传 hardware.version |
| 11 | 系统更新 | L281-312 | `UpdateRow kind="app"` |
| 12 | 开发者模式 | L315-321 | P0 已有的入口行,保留 |

- [ ] **Step 1: 写装配的失败测试**

`src/settings/panels/general/GeneralPanel.integration.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'

const blob: Record<string, unknown> = {}
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => ({ ...blob }),
      setCustomStorage: async (_k: string, d: Record<string, unknown>) => { Object.assign(blob, d) },
    },
    sys: {
      hardwareInfo: async () => ({ arch: 'amd64', drive_model: '', version: '1.9.3-alpha1+25.gc8d7d14-dirty' }),
      getBaseInfo: async () => ({ device_id: 'dc', model: '', version: '1.9.3' }),
      getServerPort: async () => '80',
      getUsbStatus: async () => false,
      getOsVersion: async () => ({ current_version: '1.0.0', need_update: false }),
      getAppVersion: async () => ({ current_version: '1.9.3-alpha1+25.gc8d7d14-dirty', need_update: false }),
      setDiskStandby: async () => {},
      editServerPort: async () => {},
      toggleUsbAutoMount: async () => {},
      power: async () => {},
      updateOs: async () => {}, updateApp: async () => {}, cancelDownload: async () => {},
    },
    file: { getContent: async () => ({ content: '' }) },
  },
}))
vi.mock('../../../composables/useMessageBus', () => ({
  useMessageBus: () => ({ on: () => () => {} }),
}))

import GeneralPanel from '../GeneralPanel.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const mountIt = () => mount(GeneralPanel, { global: { plugins: [i18n] } })

beforeEach(() => {
  setActivePinia(createPinia())
  for (const k of Object.keys(blob)) delete blob[k]
})

describe('GeneralPanel 装配', () => {
  it('标题是「通用」', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.find('.set-section-title').text()).toBe('通用')
  })

  it('P0 的空态占位已经拆掉', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(false)
  })

  it('设备信息卡在列表之前', async () => {
    const w = mountIt(); await flushPromises()
    const html = w.html()
    expect(html.indexOf('set-card')).toBeGreaterThan(-1)
    expect(html.indexOf('set-card')).toBeLessThan(html.indexOf('set-list'))
  })

  it('11 行 + 开发者入口,顺序逐条对位 Vue2', async () => {
    const w = mountIt(); await flushPromises()
    const labels = w.findAll('.set-list .set-row-label').map((e) => e.text())
    expect(labels).toEqual([
      '壁纸', '语言', '时区', '硬盘待机', 'WebUI 端口',
      '自动挂载USB磁盘', '显示推荐应用', '新闻流',
      '固件更新', '系统更新',
    ])
  })

  it('开发者入口行仍在最后并能 emit open-tab', async () => {
    const w = mountIt(); await flushPromises()
    const row = w.find('.set-dev-entry')
    expect(row.exists()).toBe(true)
    await row.trigger('click')
    expect(w.emitted('open-tab')).toEqual([['developer']])
  })

  it('「显示其他 Docker 容器应用」行不存在(债务 D15)', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.text()).not.toContain('Docker')
  })

  it('Premium 推广条不存在(授权偏离 #6)', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.text()).not.toMatch(/Premium|Upgrade Now/)
  })

  it('固件更新行的副标题用 hardware.version(不是 os_version 的 current_version)', async () => {
    const w = mountIt(); await flushPromises()
    const subs = w.findAll('.set-list .set-row-sub').map((e) => e.text())
    // 固件行副标题 = hardware.version;系统行副标题 = /sys/version 的 current_version
    expect(subs[0]).toBe('v1.9.3-alpha1+25.gc8d7d14-dirty')
  })

  it('整页渲染不产出裸 i18n key', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.text()).not.toMatch(/settings[A-Z]\w+/)
  })

  it('所有行的接口都失败时页面仍完整渲染(不白屏)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    for (const m of ['hardwareInfo', 'getBaseInfo', 'getServerPort', 'getUsbStatus', 'getOsVersion', 'getAppVersion'] as const) {
      vi.spyOn(svc.service.sys, m).mockRejectedValue(new Error('boom'))
    }
    vi.spyOn(svc.service.users, 'getCustomStorage').mockRejectedValue(new Error('boom'))
    const w = mountIt(); await flushPromises()
    expect(w.findAll('.set-list .set-row-label')).toHaveLength(10)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm test src/settings/panels/general/GeneralPanel.integration.test.ts 2>&1 | tail -12
```

- [ ] **Step 3: 实现 `GeneralPanel.vue`**

```vue
<script setup lang="ts">
// general 页装配。行顺序逐条对位 Vue2 SettingsPanel.vue L65-324,不许改序。
// 两处**有意不做**(见计划 §实测校正):
//   - 顶部 Premium 推广条(L67-73):用户 2026-07-31 拍板不做,授权偏离 #6
//     (Vue2 侧那个 Upgrade Now 按钮本来也没有任何 @click)
//   - 「显示其他 Docker 容器应用」开关行(L239-245):Vue2 恒不渲染,债务 D15
// 「开发者模式」入口行沿用 P0 已有的实现(Vue2 L315,常驻可见、无开关门控)。
//
// 说明:本页会打 3 次 /sys/hardware(此处 + DeviceInfoCard + UsbAutoMountRow)。
// Vue2 也是多处各拉一次(SettingsPanel.getHardwareInfo + DeviceInfoPanel.fetchHardwareInfo),
// 且这是本机的廉价读接口 —— 不为此引入缓存层(YAGNI)。
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type HardwareInfo } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import DeviceInfoCard from './general/DeviceInfoCard.vue'
import WallpaperRow from './general/WallpaperRow.vue'
import LanguageRow from './general/LanguageRow.vue'
import TimezoneRow from './general/TimezoneRow.vue'
import DiskStandbyRow from './general/DiskStandbyRow.vue'
import WebUiPortRow from './general/WebUiPortRow.vue'
import UsbAutoMountRow from './general/UsbAutoMountRow.vue'
import SwitchRow from './general/SwitchRow.vue'
import UpdateRow from './general/UpdateRow.vue'
import '../styles/settings.css'

const { t } = useI18n()
const emit = defineEmits<{ 'open-tab': [tab: string] }>()

// 固件更新行的副标题用 hardware.version(Vue2 L254),不是 os_version 的 current_version
const hwVersion = ref('')
onMounted(async () => {
  try {
    const hw: HardwareInfo = await service.sys.hardwareInfo()
    if (typeof hw.version === 'string') hwVersion.value = hw.version
  } catch (e) {
    console.warn('[settings] hardwareInfo failed', e)
  }
})
</script>

<template>
  <SettingsSection :title="t('settingsTabGeneral')">
    <DeviceInfoCard />

    <div class="set-list">
      <WallpaperRow />
      <LanguageRow />
      <TimezoneRow />
      <DiskStandbyRow />
      <WebUiPortRow />
      <UsbAutoMountRow />
      <SwitchRow field="recommend_switch" label-key="settingsRecommendApps" />
      <SwitchRow
        field="rss_switch"
        label-key="settingsNewsFeed"
        confirm-title-key="settingsNewsFeedTitle"
        confirm-msg-key="settingsNewsFeedConfirm"
        confirm-ok-key="settingsAccept"
      />
      <UpdateRow kind="os" :sub="hwVersion" />
      <UpdateRow kind="app" />
    </div>

    <button class="set-dev-entry" type="button" @click="emit('open-tab', 'developer')">
      <span>{{ t('settingsTabDeveloper') }}</span>
      <span class="set-dev-chevron" aria-hidden="true">›</span>
    </button>
  </SettingsSection>
</template>

<style scoped>
/* 开发者入口行样式沿用 P0 原样,不改 */
.set-dev-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--card-bg);
  color: var(--fg);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  text-align: left;
}
.set-dev-entry:hover {
  background: var(--hover);
}
.set-dev-chevron {
  color: var(--fg-faint);
}
</style>
```

- [ ] **Step 4: 修 P0 的 `panels.test.ts`**

P0 那两条断言现在会红,因为 general 不再有 `.set-skeleton`:

1. `it.each(SETTINGS_TABS.filter((t) => t !== 'terminal'))('%s 骨架渲染标题与空态位')` —— 把 `general` 也排除,并在注释里写明「P1 起 general 已填内容」:
```ts
  // P1 起 general 已填真实内容,developer 见下方单独用例;这里只剩仍是骨架的 tab
  it.each(SETTINGS_TABS.filter((t) => t !== 'terminal' && t !== 'general' && t !== 'developer'))(
    '%s 骨架渲染标题与空态位',
    (tab) => { /* 原实现不变 */ },
  )
```
2. `it('general 骨架带 developer 入口行…')` —— 这条**保留**(入口行仍在),但 general 现在会打接口,给该文件补最小 mock(照 Step 1 的 mock 抄一份,或把该用例移到新的 integration 测试里 —— **推荐后者**,`panels.test.ts` 保持零 mock 的纯骨架测试)。

`developer` 的两条(`.set-back` / 返回冒泡)在 Task 11 之后仍应通过,先不动。

- [ ] **Step 5: 跑测试确认通过 + 任务门 + 提交**

```bash
pnpm test src/settings 2>&1 | tail -8
pnpm test 2>&1 | tail -8
pnpm exec vue-tsc --noEmit
git status --short
git add src/settings/panels/general/GeneralPanel.integration.test.ts
git commit src/settings/panels/GeneralPanel.vue src/settings/panels/panels.test.ts \
           src/settings/panels/general/GeneralPanel.integration.test.ts \
  -m "feat(settings): general 页装配(SP9-P1)

行顺序逐条对位 Vue2 L65-324。两处有意不做:
- Premium 推广条(授权偏离 #6,用户 2026-07-31 拍板)
- 显示其他 Docker 容器应用(Vue2 恒不渲染,债务 D15)
整页在所有接口都失败时仍完整渲染,不白屏。"
```

---

## Task 11: DeveloperPanel —— HTTPS 开关 + 配置弹窗

**Files:**
- Create: `src/settings/components/WebUiHttpsDialog.vue`
- Create: `src/settings/components/WebUiHttpsDialog.test.ts`
- Modify: `src/settings/panels/DeveloperPanel.vue`
- Create: `src/settings/panels/DeveloperPanel.test.ts`

**Interfaces:**
- Consumes: `service.sys.getSSLConfig()` / `setSSLConfig(cfg)` / `uploadSSLCert(FormData)`、Task 3 原语、`Dialog.vue`、`useToast()`
- Produces:
  ```
  <WebUiHttpsDialog :open @update:open @saved />
  ```
  纯函数(放在同文件或 `src/settings/util/sslDate.ts`):
  ```ts
  export function formatSslDate(iso: string | undefined): string   // '0001-…' / 空 / 非法 → '---',否则 DD/MM/YYYY
  ```

- [ ] **Step 1: 写失败测试**

`src/settings/components/WebUiHttpsDialog.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'

// curl 实证 2026-07-31 GET /v1/gateway/ssl
const SSL = {
  enabled: false, port: '443', domain: 'nimoos.local', cert_type: 'auto',
  effective_time: '0001-01-01T00:00:00Z', expiration_time: '0001-01-01T00:00:00Z',
}
const state = { ssl: { ...SSL }, setCalls: [] as unknown[], uploadCalls: 0, setFail: false, uploadFail: false }

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      getSSLConfig: async () => ({ ...state.ssl }),
      setSSLConfig: async (c: unknown) => { state.setCalls.push(c); if (state.setFail) throw new Error('boom') },
      uploadSSLCert: async () => { state.uploadCalls++; if (state.uploadFail) throw new Error('boom') },
    },
  },
}))

import WebUiHttpsDialog from './WebUiHttpsDialog.vue'
import { formatSslDate } from '../util/sslDate'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const mountIt = (open = true) => mount(WebUiHttpsDialog, { props: { open }, global: { plugins: [i18n] } })

// jsdom 里 <input type=file> 的 files 是只读的,用 defineProperty 塞进去再触发 change ——
// 走的是组件真实的 @change 处理器,不必在生产组件上开测试后门。
async function pickFiles(w: ReturnType<typeof mountIt>, pem: File | null, crt: File | null) {
  const inputs = w.findAll('.wh-file')
  const set = async (i: number, f: File) => {
    Object.defineProperty(inputs[i].element, 'files', { value: [f], configurable: true })
    await inputs[i].trigger('change')
  }
  if (pem) await set(0, pem)
  if (crt) await set(1, crt)
}

beforeEach(() => {
  setActivePinia(createPinia())
  state.ssl = { ...SSL }; state.setCalls = []; state.uploadCalls = 0
  state.setFail = false; state.uploadFail = false
})

describe('formatSslDate', () => {
  it('Go 零值时间 → ---(实测本机就是 0001-01-01)', () => {
    expect(formatSslDate('0001-01-01T00:00:00Z')).toBe('---')
  })
  it('空 / undefined → ---', () => {
    expect(formatSslDate('')).toBe('---')
    expect(formatSslDate(undefined)).toBe('---')
  })
  it('非法日期 → ---(Vue2 用 try/catch 但 new Date 不抛,会输出 NaN/NaN/NaN —— 不照抄)', () => {
    expect(formatSslDate('不是日期')).toBe('---')
  })
  it('正常日期 → DD/MM/YYYY(对位 Vue2 formatDate)', () => {
    expect(formatSslDate('2027-03-09T10:00:00Z')).toMatch(/^\d{2}\/\d{2}\/2027$/)
  })
})

describe('WebUiHttpsDialog', () => {
  it('打开时拉配置并填入表单', async () => {
    const w = mountIt(); await flushPromises()
    expect((w.find('.wh-domain').element as HTMLInputElement).value).toBe('nimoos.local')
    expect((w.find('.wh-port').element as HTMLInputElement).value).toBe('443')
  })

  it('open=false 不拉配置', async () => {
    const svc = await import('@nimotech/nimoos-service')
    const spy = vi.spyOn(svc.service.sys, 'getSSLConfig')
    mountIt(false); await flushPromises()
    expect(spy).not.toHaveBeenCalled()
  })

  it('零值时间显示 ---', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.findAll('.wh-date').map((e) => e.text())).toEqual(['---', '---'])
  })

  it('cert_type=auto 时显示「下载 CA 证书」,不显示上传位', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.find('.wh-ca').exists()).toBe(true)
    expect(w.find('.wh-upload').exists()).toBe(false)
  })

  it('切到 custom 显示上传位,隐藏 CA 下载', async () => {
    const w = mountIt(); await flushPromises()
    await w.find('.wh-cert').setValue('custom')
    expect(w.find('.wh-upload').exists()).toBe(true)
    expect(w.find('.wh-ca').exists()).toBe(false)
  })

  it('auto 保存:只下发 4 个字段,不回传只读时间', async () => {
    const w = mountIt(); await flushPromises()
    await w.find('.wh-save').trigger('click'); await flushPromises()
    expect(state.setCalls).toEqual([{ enabled: false, domain: 'nimoos.local', port: '443', cert_type: 'auto' }])
    expect(state.uploadCalls).toBe(0)
  })

  it('保存成功后 emit saved 并关窗', async () => {
    const w = mountIt(); await flushPromises()
    await w.find('.wh-save').trigger('click'); await flushPromises()
    expect(w.emitted('saved')).toBeTruthy()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('保存配置失败不关窗(让用户能改了再试)', async () => {
    state.setFail = true
    const w = mountIt(); await flushPromises()
    await w.find('.wh-save').trigger('click'); await flushPromises()
    expect(w.emitted('update:open')).toBeFalsy()
  })

  it('custom 但只选了一个文件:提示要两个,不发上传也不发保存', async () => {
    const w = mountIt(); await flushPromises()
    await w.find('.wh-cert').setValue('custom')
    await pickFiles(w, new File(['x'], 'a.pem'), null)
    await w.find('.wh-save').trigger('click'); await flushPromises()
    expect(state.uploadCalls).toBe(0)
    expect(state.setCalls).toEqual([])
    expect(w.text()).toContain('请同时上传')
  })

  it('custom 且两个文件都选了:先上传再保存', async () => {
    const w = mountIt(); await flushPromises()
    await w.find('.wh-cert').setValue('custom')
    await pickFiles(w, new File(['x'], 'a.pem'), new File(['y'], 'b.crt'))
    await w.find('.wh-save').trigger('click'); await flushPromises()
    expect(state.uploadCalls).toBe(1)
    expect(state.setCalls).toHaveLength(1)
  })

  it('上传失败就不再保存配置(避免配置说 custom 而证书没上去)', async () => {
    state.uploadFail = true
    const w = mountIt(); await flushPromises()
    await w.find('.wh-cert').setValue('custom')
    await pickFiles(w, new File(['x'], 'a.pem'), new File(['y'], 'b.crt'))
    await w.find('.wh-save').trigger('click'); await flushPromises()
    expect(state.setCalls).toEqual([])
  })

  it('custom 但一个文件都没选:直接保存(沿用服务端已有证书)', async () => {
    state.ssl = { ...SSL, cert_type: 'custom' }
    const w = mountIt(); await flushPromises()
    await w.find('.wh-save').trigger('click'); await flushPromises()
    expect(state.uploadCalls).toBe(0)
    expect(state.setCalls).toHaveLength(1)
  })
})
```

`src/settings/panels/DeveloperPanel.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'

const state = { ssl: { enabled: false, port: '443', domain: 'nimoos.local', cert_type: 'auto', effective_time: '', expiration_time: '' }, setCalls: [] as unknown[], setFail: false }
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      getSSLConfig: async () => ({ ...state.ssl }),
      setSSLConfig: async (c: unknown) => { state.setCalls.push(c); if (state.setFail) throw new Error('boom') },
      uploadSSLCert: async () => {},
    },
  },
}))

import DeveloperPanel from './DeveloperPanel.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const mountIt = () => mount(DeveloperPanel, { global: { plugins: [i18n] } })

beforeEach(() => {
  setActivePinia(createPinia())
  state.ssl = { ...state.ssl, enabled: false, cert_type: 'auto' }
  state.setCalls = []; state.setFail = false
})

describe('DeveloperPanel', () => {
  it('用返回按钮而不是标题,点它 emit open-tab general(P0 行为不变)', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.find('.set-section-title').exists()).toBe(false)
    await w.find('.set-back').trigger('click')
    expect(w.emitted('open-tab')).toEqual([['general']])
  })

  it('P0 的空态占位已拆掉', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(false)
  })

  it('渲染 HTTPS 开关,状态来自服务端', async () => {
    state.ssl.enabled = true
    const w = mountIt(); await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('关闭时不显示配置入口行(对位 Vue2 v-if="sslEnabled")', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.find('.dp-config').exists()).toBe(false)
  })

  it('开启时显示配置入口行', async () => {
    state.ssl.enabled = true
    const w = mountIt(); await flushPromises()
    expect(w.find('.dp-config').exists()).toBe(true)
  })

  it('拨开 HTTPS:下发 enabled:true 并补齐 domain/port/cert_type 兜底值', async () => {
    const w = mountIt(); await flushPromises()
    await w.find('[role="switch"]').trigger('click'); await flushPromises()
    expect(state.setCalls).toEqual([{ enabled: true, domain: 'nimoos.local', port: '443', cert_type: 'auto' }])
  })

  it('服务端字段为空时用 Vue2 的兜底值(nimoos.local / 443 / auto)', async () => {
    state.ssl = { ...state.ssl, domain: '', port: '', cert_type: '' }
    const w = mountIt(); await flushPromises()
    await w.find('[role="switch"]').trigger('click'); await flushPromises()
    expect(state.setCalls[0]).toEqual({ enabled: true, domain: 'nimoos.local', port: '443', cert_type: 'auto' })
  })

  it('下发失败时开关弹回(对位 Vue2 sslEnabled = !val)', async () => {
    state.setFail = true
    const w = mountIt(); await flushPromises()
    await w.find('[role="switch"]').trigger('click'); await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
  })

  it('点配置入口打开弹窗', async () => {
    state.ssl.enabled = true
    const w = mountIt(); await flushPromises()
    await w.find('.dp-config').trigger('click')
    expect(w.findComponent({ name: 'WebUiHttpsDialog' }).props('open')).toBe(true)
  })

  it('弹窗 saved 后重新拉配置(对位 Vue2 modal close → getSSLConfig)', async () => {
    state.ssl.enabled = true
    const svc = await import('@nimotech/nimoos-service')
    const spy = vi.spyOn(svc.service.sys, 'getSSLConfig')
    const w = mountIt(); await flushPromises()
    const before = spy.mock.calls.length
    w.findComponent({ name: 'WebUiHttpsDialog' }).vm.$emit('saved')
    await flushPromises()
    expect(spy.mock.calls.length).toBeGreaterThan(before)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm test src/settings/components/WebUiHttpsDialog.test.ts src/settings/panels/DeveloperPanel.test.ts 2>&1 | tail -12
```

- [ ] **Step 3: 实现 `src/settings/util/sslDate.ts`**

```ts
/**
 * 对位 Vue2 WebUIHTTPSModal.vue 的 formatDate + formattedEffectiveTime/formattedExpirationTime。
 * 实测本机两个时间都是 Go 的零值 '0001-01-01T00:00:00Z'(未签发证书),必须显示 '---'。
 *
 * 移植纪律:Vue2 的 formatDate 用 try/catch 兜底,但 `new Date('乱码')` **不抛异常** ——
 * 它返回 Invalid Date,于是 getDate() 全是 NaN,界面会显示 "NaN/NaN/NaN"。
 * 这里显式判 Number.isNaN。
 */
export function formatSslDate(iso: string | undefined): string {
  if (!iso || iso.startsWith('0001')) return '---'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '---'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getFullYear()}`
}
```

- [ ] **Step 4: 实现 `WebUiHttpsDialog.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 WebUIHTTPSModal.vue(334 行)。6 行:主域名 / 生效时间 / 过期时间 / 端口 /
// SSL 证书类型 /(auto 时)信任证书下载 或(custom 时)PEM+CRT 上传位。
// 保存顺序照 Vue2:custom 且选了文件 → 先上传证书,成功后才保存配置。
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type SSLConfig } from '@nimotech/nimoos-service'
import Dialog from '../../components/ui/Dialog.vue'
import { formatSslDate } from '../util/sslDate'
import { useToast } from '../../stores/toast'
import '../styles/settings.css'

defineOptions({ name: 'WebUiHttpsDialog' })
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean]; saved: [] }>()

const { t } = useI18n()
const toast = useToast()

const cfg = ref<SSLConfig>({
  enabled: true, domain: 'nimoos.local', port: '443', cert_type: 'auto',
  effective_time: '', expiration_time: '',
})
const pemFile = ref<File | null>(null)
const crtFile = ref<File | null>(null)
const saving = ref(false)
const error = ref('')

watch(() => props.open, async (o) => {
  if (!o) return
  error.value = ''
  pemFile.value = null
  crtFile.value = null
  try {
    cfg.value = await service.sys.getSSLConfig()
  } catch (e) {
    console.warn('[settings] getSSLConfig failed', e)
  }
}, { immediate: true })

function onPick(which: 'pem' | 'crt', e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  if (which === 'pem') pemFile.value = f
  else crtFile.value = f
}

async function save() {
  error.value = ''
  saving.value = true
  try {
    if (cfg.value.cert_type === 'custom' && (pemFile.value || crtFile.value)) {
      // 只选一个不行:后端要成对的 pem + crt
      if (!pemFile.value || !crtFile.value) {
        error.value = t('settingsHttpsBothFiles')
        return
      }
      const fd = new FormData()
      fd.append('pem', pemFile.value)
      fd.append('crt', crtFile.value)
      try {
        await service.sys.uploadSSLCert(fd)
      } catch (e) {
        // 上传失败就不要再保存配置 —— 否则配置说 custom 而证书根本没上去
        console.warn('[settings] uploadSSLCert failed', e)
        error.value = t('settingsHttpsUploadFailed')
        return
      }
    }
    // 只下发这 4 个字段:effective_time / expiration_time 是后端只读产出
    await service.sys.setSSLConfig({
      enabled: cfg.value.enabled,
      domain: cfg.value.domain,
      port: String(cfg.value.port),
      cert_type: cfg.value.cert_type,
    })
    toast.show(t('settingsSaveSuccess'))
    emit('saved')
    emit('update:open', false)
  } catch (e) {
    console.warn('[settings] setSSLConfig failed', e)
    error.value = t('settingsSaveFailed')   // 不关窗,让用户改了再试
  } finally {
    saving.value = false
  }
}

function downloadCa() {
  window.open('/v1/gateway/ssl/ca', '_blank')
}
</script>

<template>
  <Dialog :open="open" :title="t('settingsHttpsTitle')" @update:open="emit('update:open', $event)">
    <div class="wh-body">
      <label class="wh-row">
        <span class="wh-key">{{ t('settingsHttpsDomain') }}</span>
        <input v-model="cfg.domain" class="set-input wh-domain" type="text" :disabled="saving" />
      </label>

      <div class="wh-row">
        <span class="wh-key">{{ t('settingsHttpsEffective') }}</span>
        <span class="wh-date">{{ formatSslDate(cfg.effective_time) }}</span>
      </div>
      <div class="wh-row">
        <span class="wh-key">{{ t('settingsHttpsExpiration') }}</span>
        <span class="wh-date">{{ formatSslDate(cfg.expiration_time) }}</span>
      </div>

      <label class="wh-row">
        <span class="wh-key">{{ t('settingsHttpsPort') }}</span>
        <input v-model="cfg.port" class="set-input wh-port" type="text" inputmode="numeric" :disabled="saving" />
      </label>

      <label class="wh-row">
        <span class="wh-key">{{ t('settingsHttpsCert') }}</span>
        <select v-model="cfg.cert_type" class="set-select wh-cert" :disabled="saving">
          <option value="auto">{{ t('settingsHttpsCertAuto') }}</option>
          <option value="custom">{{ t('settingsHttpsCertCustom') }}</option>
        </select>
      </label>

      <div v-if="cfg.cert_type === 'auto'" class="wh-row">
        <span class="wh-key">{{ t('settingsHttpsTrust') }}</span>
        <button class="set-btn wh-ca" type="button" @click="downloadCa">
          {{ t('settingsHttpsDownloadCa') }}
        </button>
      </div>

      <div v-else class="wh-row wh-upload">
        <span class="wh-key">{{ t('settingsHttpsCertFiles') }}</span>
        <span class="wh-files">
          <label class="set-btn">
            PEM
            <input type="file" class="wh-file" :disabled="saving" @change="onPick('pem', $event)" />
          </label>
          <label class="set-btn">
            CRT
            <input type="file" class="wh-file" :disabled="saving" @change="onPick('crt', $event)" />
          </label>
        </span>
      </div>

      <p v-if="pemFile || crtFile" class="wh-picked">
        <span v-if="pemFile">PEM: {{ pemFile.name }}</span>
        <span v-if="crtFile">CRT: {{ crtFile.name }}</span>
      </p>
      <p v-if="error" class="set-danger">{{ error }}</p>
    </div>

    <template #footer>
      <button class="set-btn primary wh-save" type="button" :disabled="saving" @click="save">
        {{ t('settingsSave') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.wh-body { display: flex; flex-direction: column; gap: 4px; min-width: min(480px, 84vw); }
.wh-row {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 12px 0; border-bottom: 1px solid var(--border); font-size: 14px;
}
.wh-row:last-of-type { border-bottom: 0; }
.wh-key { color: var(--fg-muted); flex: 0 0 auto; }
.wh-date { font-weight: 500; }
.wh-files { display: flex; gap: 8px; }
.wh-file { display: none; }
.wh-picked {
  display: flex; flex-direction: column; gap: 2px; margin: 4px 0 0;
  font-size: 12px; color: var(--fg-muted); text-align: right;
}
</style>
```

- [ ] **Step 5: 实现 `DeveloperPanel.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L326-348(developer 分支)+ getSSLConfig / toggleHTTPS。
// 头部用返回按钮而不是 h1(Vue2 L52-56),P0 已经这么做了,保持不变。
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type SSLConfig } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import SettingsRow from '../components/SettingsRow.vue'
import SettingsSwitch from '../components/SettingsSwitch.vue'
import WebUiHttpsDialog from '../components/WebUiHttpsDialog.vue'
import { useToast } from '../../stores/toast'
import '../styles/settings.css'

const { t } = useI18n()
const toast = useToast()
const emit = defineEmits<{ 'open-tab': [tab: string] }>()

const cfg = ref<SSLConfig | null>(null)
const enabled = ref(false)
const busy = ref(false)
const dialogOpen = ref(false)

async function load() {
  try {
    const c = await service.sys.getSSLConfig()
    cfg.value = c
    enabled.value = c.enabled
  } catch (e) {
    console.warn('[settings] getSSLConfig failed', e)
  }
}
onMounted(load)

async function toggle(next: boolean) {
  if (busy.value) return
  const prev = enabled.value
  enabled.value = next
  busy.value = true
  try {
    // 兜底值逐字照 Vue2 toggleHTTPS(L1324-1330):域名 nimoos.local、端口 443、证书 auto
    await service.sys.setSSLConfig({
      enabled: next,
      domain: cfg.value?.domain || 'nimoos.local',
      port: String(cfg.value?.port || '443'),
      cert_type: cfg.value?.cert_type || 'auto',
    })
    toast.show(t('settingsSaveSuccess'))
  } catch (e) {
    enabled.value = prev            // 对位 Vue2 sslEnabled = !val
    console.warn('[settings] setSSLConfig failed', e)
    toast.show(t('settingsSaveFailed'))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <SettingsSection
    :title="t('settingsTabDeveloper')"
    back-to="general"
    @back="emit('open-tab', $event)"
  >
    <div class="set-list">
      <SettingsRow :label="t('settingsHttps')">
        <template #control>
          <SettingsSwitch
            :model-value="enabled"
            :label="t('settingsHttps')"
            :disabled="busy"
            @update:model-value="toggle"
          />
        </template>
      </SettingsRow>

      <!-- 只在 HTTPS 开启后才出现(对位 Vue2 v-if="sslEnabled") -->
      <SettingsRow
        v-if="enabled"
        class="dp-config"
        :label="t('settingsHttpsConfig')"
        clickable
        @click="dialogOpen = true"
      />
    </div>

    <WebUiHttpsDialog
      :open="dialogOpen"
      @update:open="dialogOpen = $event"
      @saved="load"
    />
  </SettingsSection>
</template>
```

> `.dp-config` 作为 class 传给 `SettingsRow` 会落在其根元素(`.set-row-wrap`)上,而测试里 `w.find('.dp-config').trigger('click')` 点的是根 div、不是内部的 `<button>`。**实现时确认**:要么测试改成 `.dp-config .set-list-item`,要么给 `SettingsRow` 的可点 `button` 加一个可传入的 class。**取前者**,不动共用原语。

- [ ] **Step 6: 跑测试确认通过 + 任务门 + 提交**

```bash
pnpm test src/settings 2>&1 | tail -8
pnpm test 2>&1 | tail -8
pnpm exec vue-tsc --noEmit
git status --short
git add src/settings/util/sslDate.ts src/settings/components/WebUiHttpsDialog.vue \
        src/settings/components/WebUiHttpsDialog.test.ts src/settings/panels/DeveloperPanel.test.ts
git commit src/settings/util/sslDate.ts src/settings/components/WebUiHttpsDialog.vue \
           src/settings/components/WebUiHttpsDialog.test.ts \
           src/settings/panels/DeveloperPanel.vue src/settings/panels/DeveloperPanel.test.ts \
  -m "feat(settings): developer 页 HTTPS 开关 + 配置弹窗(SP9-P1)

- 开关下发失败弹回;配置入口只在 HTTPS 开启后出现(对位 Vue2 v-if)
- custom 证书:先上传成对的 PEM+CRT,上传失败就不保存配置
  (否则配置写着 custom 而证书没上去)
- 只下发 4 个字段,effective_time/expiration_time 是后端只读产出
- formatSslDate 显式判 Invalid Date:Vue2 的 try/catch 拦不住
  new Date('乱码')(它不抛,只是返回 NaN 日期),会显示 NaN/NaN/NaN"
```

---

## Task 12: 收尾 —— 全量任务门 + 浏览器自查 + 台账与 roadmap

**Files:**
- Create: `.superpowers/sdd/sp9/02-p1.md`(**gitignore,不进 git**)
- Modify: `/home/nimo/NimoTech/NimoOS-UI/docs/vue3-migration-roadmap.md` §4 SP9(**另一个仓库,另一条分支**)

- [ ] **Step 1: 全量任务门**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test 2>&1 | tail -6
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm test 2>&1 | tail -6
pnpm exec vue-tsc --noEmit && echo "TSC OK"
pnpm build 2>&1 | tail -6
```

判定:**tsc 零错误 · 两个仓库测试零失败 · 测试数只增不减**(New-UI 基线 269 文件 / 1935 例;Service 基线 24 文件 / 133 例)。把实际数字记进台账。

- [ ] **Step 2: 浏览器自查(无头 chromium)**

```bash
pnpm dev --host
```
浏览器开 `http://192.168.1.143:5273/app/#/settings/general`。

无头自查手法沿用 P0 台账记的办法:往 `public/` 临时放一个 `__p1check.html`,`localStorage.setItem('access_token'/'user'/'theme')` 后 `location.replace('/app/#/settings/general')`,chromium 一次导航截图。**用完必须删掉那个文件**并确认 `git status` 干净。

自查清单(**暗色 + 亮色各截一次**):

| # | 检查 | 怎么看 |
|---|---|---|
| 1 | general 页 10 行 + 设备信息卡 + 开发者入口,顺序对 | 与本计划 Task 10 的表逐行比 |
| 2 | 设备信息卡显示真实版本号,点按钮弹出 5 行设备信息 | 弹窗里 Platform 应是 `nimoos-standard-v1`、CPU `~4.6 GHz` / 12 Threads |
| 3 | 壁纸的「更改」是灰的且下方有说明 | |
| 4 | 语言下拉只有 2 项;切成 English 后**整页文案跟着变** | 切回中文 |
| 5 | 时区下拉能选,选完刷新页面后**仍是刚选的值** | 验证真落库了 |
| 6 | 硬盘待机同上 | |
| 7 | WebUI 端口显示 `80`;**改成 8080 后不要点提交**,改回 80 让提交按钮消失 | ⚠️ 绝对不要提交 |
| 8 | USB 自动挂载开关初始是**开**(本机实测 `"True"`),拨关再拨开,刷新后状态一致 | |
| 9 | 新闻流拨开**先弹确认框**;取消后仍是关 | 再拨开→接受→刷新应为开 |
| 10 | 推荐应用拨动无确认,刷新后保持 | |
| 11 | 固件更新与系统更新两行都显示「当前已经是最新版 ✓」;点「检查更新」出 toast | 本机 `need_update:false`,**不会**弹更新窗 |
| 12 | 侧栏底部有关机 / 重启两个圆按钮;点关机**弹确认框后立刻取消** | ⚠️ 绝对不要确认 |
| 13 | 开发者入口 → developer 页头部是**返回按钮**,点它回 general | |
| 14 | developer 页 HTTPS 开关初始**关**(本机 `enabled:false`),下方无配置行;**不要拨开** | ⚠️ 拨开会真的改网关 SSL 配置 |
| 15 | 窄屏 420px:行不塌、下拉不溢出、rail 收顶部横条 | |
| 16 | 亮色主题下 logo 可见、开关/按钮对比度正常 | 检查 `--set-warn-fg` 等新 token |

> 第 7 / 12 / 14 项是本期唯一三个「看得见但不能按」的地方,**只验形状不验行为**;它们的行为由单测覆盖,实机行为留给用户最终验收。

- [ ] **Step 3: 写台账 `.superpowers/sdd/sp9/02-p1.md`**

必须包含:

1. **任务门实测数字**(Service / New-UI 基线 → P1 末)
2. **实测校正 6 条**(尤其:`/gateway/components` 与 `/gateway/device-info` 是裸 JSON;命名陷阱;`updateOs`/`cancelDownload` 是 spec 表外补的;`trigger_download` 是查询参数)
3. **两处死代码的完整判据**(`is_update` 从没被写过;`SET_NOTIMPORT_LIST` / `SET_EXISTING_APPS_SWITCH` 从没被 commit、`exsitingAppsShow` 模板里从没引用)+ 用户 2026-07-31 拍板跳过
4. **移植纪律 6 条**改正记录
5. **授权偏离 #6**(Premium 推广条不做)
6. **新债务 D14 / D15**
7. **交给 P2 的事**:`SettingsRow` / `SettingsSwitch` / `.set-list` 可直接复用;`systemConfig.ts` 的串行队列是所有写 `system` blob 的唯一入口,P2-P4 新增字段要加进 `SystemBlob` 类型;`sys` 域里 `getLogs` / `getSystemPaths` / `migrate*` 已进包但**没有消费方**,P3 消费 `migrate*` 前必须抓真实 fixture 复核字段
8. **本期没做的**:三个破坏性路径(改端口 / 关机重启 / 真升级)未实机验证,留用户最终验收

- [ ] **Step 4: 同步 roadmap §4 SP9(另一个仓库)**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git log -1 --oneline          # ⚠️ 先看一眼:sp7 会话也在写这个文件
git status --short
```

分支应是 `docs/vue3-migration-sp3`。在 §4 SP9 追加 P1 小节,**必须写进去**(台账会丢,roadmap 是唯一长期载体):

- P1 完成,commit 范围,任务门数字
- 实测校正 6 条(裸 JSON 那条最要紧)
- 两处死代码判据 + 拍板结论 + 债务 D14 / D15
- 授权偏离 #6
- 移植纪律 6 条
- P3 消费 `migrate*` 前须抓真实 fixture

```bash
git commit docs/vue3-migration-roadmap.md -m "docs(sp9): P1 general+developer 完成,记实测校正/死代码判据/新债务"
```

- [ ] **Step 5: 最后一次确认没有误提交别人的东西**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git status --short
git log --oneline -12
```

**必须确认:那 3 行 `design-export/*.html` 的 `D` 仍在 index 里、没有出现在本期任何 commit 中。**

```bash
git log --oneline --name-only -12 | grep -c design-export   # 期望输出 0
```

---

## Self-Review

**1. spec 覆盖检查(§5.1 / §5.2 逐项)**

| spec §5.1 项 | 落在哪 |
|---|---|
| 设备信息卡 + DeviceInfoPanel 191 行 | Task 4 |
| 壁纸行(D5 做样子) | Task 5 |
| 语言行(D6 做样子) | Task 5 |
| 时区行 | Task 5 |
| 硬盘待机 | Task 5 |
| WebUI 端口(改端口 + checkUiPort 探活) | Task 6 |
| USB 自动挂载 | Task 7 |
| 推荐应用 | Task 7 |
| RSS | Task 7 |
| Docker 应用开关 | **不做**,债务 D15(实测恒不渲染,用户拍板) |
| 系统更新(UpdateModal 321) | Task 8 |
| 系统更新(UpdateCompleteModal 177) | **不做**,债务 D14(实测触发器从未实现,用户拍板) |
| App 更新 | Task 8 |
| 开发者模式开关 | Task 10(P0 已建的入口行,保留) |
| 关机/重启 + 6 状态浮层 | Task 9 |
| `sys` 域补全 16 项 | Task 1(另补 `updateOs` / `cancelDownload` 共 20 项) |
| `checkUiPort` 不进包、留设置区自实现 | Task 6(`src/settings/util/checkUiPort.ts`) |
| spec §5.2 developer:HTTPS 开关 + WebUIHTTPSModal 334 | Task 11 |

无遗漏项。两处「不做」都有实测判据 + 用户拍板 + 债务编号。

**2. 占位符扫描** —— 全篇无 `TBD` / `待补` / `类似 Task N` / 无代码的「加上错误处理」类步骤。每个测试步骤都给了完整可运行的测试代码,每个实现步骤都给了完整文件内容。

**3. 类型一致性检查**

- `UpdateCheck` / `SSLConfig` / `SSLConfigInput` / `HardwareInfo` / `SystemPaths` / `MigrateStatus` 在 Task 1 定义,Task 4(`HardwareInfo`)、Task 8(`UpdateCheck`)、Task 11(`SSLConfig`)消费,字段名一致。
- `SystemBlob` / `readSystemConfig` / `patchSystemConfig` / `SYSTEM_DEFAULTS` / `__resetSystemConfigQueue` 在 Task 2 定义,Task 5、Task 7、Task 10 消费,签名一致。
- `SettingsRow` 的插槽名(`control` / `hint`)与 props(`label` / `sub` / `clickable` / `disabled`)在 Task 3 定义,Task 5-7、11 一致使用。
- `SettingsSwitch` 是**受控**组件(`modelValue` + `update:modelValue`,自己不改状态),Task 7 / 11 的「失败弹回」都依赖这一点 —— 一致。
- `UpdateKind` 已在 Task 8 Step 5 的注记里改为单独放 `src/settings/util/updateKind.ts`(`<script setup>` 不能 `export`),`UpdateDialog.vue` 与 `UpdateRow.vue` 都从那里 import。
- `PowerPhase` / `createPowerFlow` / `probeAlive` 及 5 个时间常量在 Task 9 定义,`PowerFlow.vue` 消费,一致。
- `formatSslDate` 在 Task 11 Step 3 定义于 `src/settings/util/sslDate.ts`,测试与组件都从那里 import,一致。

**4. 已在计划中标注、留给实现者当场确认的 3 个小风险**

1. `import logo from '…svg'` 的类型来源(Task 4 Step 8 注记:用文件级 `/// <reference types="vite/client" />`,不动 `tsconfig` 的 `types` 数组)。
2. `UpdateKind` 的导出位置(Task 8 Step 5 注记)。
3. `.dp-config` 的 class 落点与测试选择器(Task 11 Step 5 注记:测试用 `.dp-config .set-list-item`)。
