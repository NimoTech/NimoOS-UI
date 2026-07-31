# SP9 — 收尾视图（Search / 系统设置 / KVM）设计规格

> 创建 2026-07-31 · 状态：**设计已定，未开工**
> 上位文档：`NimoOS-UI/docs/vue3-migration-roadmap.md` §1 决策 · §3 区域迁移标准套路 · §3.3 域迁包追踪表 · §4 SP9（A/B/C 三节开工前依赖核查）
> 本文只写 SP9 自己的事；跨服务背景见 `/home/nimo/NimoTech/CLAUDE.md`，New-UI 自身约定见 `NimoOS-New-UI/CLAUDE.md`。

---

## 0. 一句话

把最后三块视图迁进 New-UI：**Search**（已有界面接真后端，不是从零迁）、**系统设置**（Vue2 3095 行模态面板 → New-UI 路由页）、**KVM**（Vue2 3854 行，New-UI 零实现）；顺带把 `network` / `kvm` / `search` 三个域搬进共享包。做完 SP9，Vue2 只剩 SP10 的退役动作。

**不在本期范围**（已拍板，别再讨论）：

| 项 | 结论 |
|---|---|
| Samba 视图 | SP4 已完成对位物，从 SP9 范围删除。只记两处差异（见 §9 债务 D1） |
| 设置 App tab「清理本地待上传缓存」 | 依赖 SP7 相册上传队列，归 **SP7-P8**（用户 2026-07-30 拍板） |
| 搜索 `notes`（Wiki 笔记）源 | 不请求，记债（见 §9 D2） |
| 任何后端改动 | SP9 是纯前端 + 对齐接口契约。搜索区尤其：**不靠"跑通了"兜底，字段形状一律照后端源码对死** |
| 设置 folder-permissions tab 的功能本体 | 跨 SP7/SP8 + 依赖无归属的 `wiki` 域（§1.11 实测更正 roadmap）→ 移出，本期只放占位卡 |
| 凡依赖 sp7-photos / sp8-ai 分支的项 | 一律不做，等合并后统一处理。**本期全程不碰那两个 worktree** |

---

## 1. 实测校正（本节内容优先于 roadmap §4 SP9 的记载）

roadmap §4 SP9 的 A/B/C 三节由 2026-07-30 的探测会话写入。本次开工前逐条复核，以下几条**与原记载不符或原记载缺失**，以本节为准。

### 1.1 搜索：user-id 是硬门槛，而网关不注入它

- `POST /v1/search/agent/tool` 不带 `X-NimoOS-User-ID` → **HTTP 400**（`NimoOS-Search/route/v1/agent.go:48`，实测确认）。
- **Gateway 从不注入这个头**：`NimoOS-Gateway/route/gateway_route.go` 只重写 `X-Forwarded-For`、删 `X-Real-IP`，全仓 grep `X-NimoOS-User-ID` 在 Gateway 里零命中。
  → 顶层 `CLAUDE.md` 里「After validation, user identity is passed downstream via `X-NimoOS-User-ID`」这句**对 Gateway 代理路径不成立**（各服务自己校 JWT；Photos 有 `route/v1/jwt_user.go` 自解）。
- 结论：**前端直连 `/v1/search/*` 是死路**，除非前端自己伪造该头（Search 不校 JWT，伪造可行但等于把授权边界交给客户端，不采纳）。

### 1.2 `/v1/ai/search/*` 代理已存在、已注册网关、Vue2 生产已在用

- `NimoOS-AI/route/v2.go:170` `g.Any("/search/*", searchProxy.Proxy)`；`route/v2/search_proxy.go` 把 `/v1/ai/search/<rest>` 改写成 `/v1/search/<rest>` 转发，并透传 `X-NimoOS-User-ID` / `-User-Name`。
- 该头由 AI 自己的 JWT 中间件注入（`route/v2.go:66`，`claims.ID`）。`/v1/ai` 在 `main.go:128-135` 注册到 Gateway。
- **Vue2 生产环境现在就走这条**：`NimoOS-UI/src/service/ai.js:334 nimoosSearch()` → `views/Search.vue:330`。
- 实测：`POST /v1/ai/search/agent/tool` 不带 Authorization → 400（echo JWT 中间件对缺失 token 的响应），说明鉴权确实在生效。

### 1.3 `/v1/search/hybrid` 其实是网关可达的

`NimoOS-Search/route/v1/stubs.go` 的注释写「NOT registered to Gateway」，**错**：`main.go:306` 注册的是整个 `/v1/search` 前缀，longest-prefix 代理覆盖其下所有路径。实测经网关 `POST /v1/search/hybrid` → **503**（stub 本体），不是 404。

（对 SP9 无影响——它仍然是个 503 stub——但 roadmap 引用了这条错误注释，在此更正。）

### 1.4 没有独立的 filenames 端点

`NimoOS-Search` 注册的全部路由：`/v1/search/{text,file,chunk,visual,hybrid(stub),thumb(stub),settings,fileindex/*,agent/*,version}` + `/_internal/*` + `/healthz`。
**文件名源只能从聚合出来**，没有单源 HTTP 入口。

### 1.5 空组返回 `null`，不是 `[]`；`filenames.match` 无上界

实测（`X-NimoOS-User-ID: 1`，query=`receipt`）：

```json
{"groups":{"semantic":null,"filenames":[
  {"path":"/DATA/Documents/Recipes/Receipt.pdf","name":"Receipt.pdf","ext":"pdf",
   "size":53866,"mtime_ms":1784715139167,"is_dir":false,"match":2},
  {"path":"/DATA/Documents/life/Nick's receipt.jpg","name":"Nick's receipt.jpg","ext":"jpg",
   "size":42943,"mtime_ms":1783651328200,"is_dir":false,"match":1.5}],
 "images":null,"notes":null},
 "stats":{"fileindex_status":"ready","total_candidates":2},
 "warnings":["semantic_unavailable","images_unavailable","notes_unavailable"]}
```

两条硬事实：**未参与/无命中的组是 `null` 不是空数组**（前端必须守）；**`match` 是 2 / 1.5 这种无上界相关度分数**，不是 0–1，更不是百分比。

### 1.6 系统设置 terminal tab 的后端是死的

`NimoOS/route/v1.go:106` —— `// v1SysGroup.GET("/wsssh", v1.WsSsh)` **被注释掉**，注释写 "Legacy web terminal (WebSocket -> local sshd), superseded by NimoOS-Terminal"，而工作区里**没有 NimoOS-Terminal 仓**。实测经网关 `GET /v1/sys/wsssh?...` → **404**。
roadmap §4 SP9 C 节列的设置区端点清单里没有它，所以这条是漏网的。**Vue2 的终端 tab 现在就是坏的**（`components/logsAndTerminal/TerminalCard.vue:76` 打的正是这个地址）。

### 1.7 network tab 的接口列表不来自 `/v2/nimoos/network/interfaces`

`SettingsPanel.vue:2134-2170 loadNetworkData()` 的真实做法：

1. 列表来源 = `GET /v1/sys/utilization` 的 `data.net` 数组（**实时枚举**）；
2. `GET /v2/nimoos/network/interfaces`（读 `/etc/nimoos/network-config.json`）只用来按 `name` 匹配后**补** `zone` / `type` / `ipv4` / `wireless` / `hybridCapable`；
3. 静态 IP 时以 config 的 `ipv4.address` 覆盖显示，否则用 utilization 的 `addr`；
4. 硬编码跳过 `wlan_ap`（concurrent 模式产生的虚拟 AP 口）；`isVirtual` 由前端按名字前缀判定（`zt*` / `docker0` / `br-*` / `veth*`），**不是**用后端的 `is_virtual` 字段。

所以 roadmap 里「未配置过的网卡不在列表里」只对 config 端点成立，**界面上仍会出现**。

### 1.8 `PortPanel.vue` 是死代码

`SettingsPanel.vue:802` import、`:841` 注册进 `components`，但**模板里零处渲染**。
→ §3.3 追踪表里「`port` 域 SP6 定案推迟 SP9 设置区」这一行，**结论：Vue2-only 死代码，不进包，随 SP10 删**。

### 1.9 KVM 信封层数按端点不同

`NimoOS-KVM/common/response.go` 是 `{success: bool, data, message}`（与全系统 `Result{Success:int,...}` 不同，roadmap 已记）。roadmap **未记**的是：**同一个服务里 `data` 的嵌套层数不一致**。实测 + 逐 handler 核对（`route/v2/{vms,isos,snapshots,settings}.go`）：

| 端点 | 数据取值路径 | 依据 |
|---|---|---|
| `GET /vms` | `data.data`（数组）、`data.total` | `vms.go:23` |
| `GET /vms/:id` · `PUT /vms/:id` · `POST /vms` | `data.data` | `vms.go:32,67,101` |
| `GET /vms/:vm_id/snapshots` · `POST .../snapshots` | `data.data` | `snapshots.go:23,37` |
| `PUT /settings` | `data.data`（回显请求体） | `settings.go:51` |
| `GET /isos/:id` | `data.data` | `isos.go:30` |
| **`GET /isos`** | **`data`（直接是数组）** | `isos.go:21` |
| **`GET /settings`** | **`data`（直接是对象）** | `settings.go:39` |
| **`GET /vms/:id/vnc`** | **`data`** = `{vncPort,vncWebsocketPort,spicePort,spiceTlsPort}` | `vms.go:158` |
| 各控制动作 / `DELETE` / `boot` / `autostart` | `data`（`{status:"started"}` / `null` / `{autostart:bool}`） | `vms.go:109..195` |

### 1.10 KVM 创建校验的硬下限

`NimoOS-KVM/service/vm_service.go:286-310`：`name` 非空 · `vcpu ∈ [1,32]` · `memory ≥ 256` · **`disk ≥ 8`** · `iso` 非空且**必须是宿主机上真实存在的绝对路径**（`os.Stat` 检查）· 域名不得重名。
实测 `GET /v1/kvm/isos` 返回的 `alpine-319.minDisk = 2`，**与后端 8 GB 硬下限矛盾**（roadmap 已记，本次实测确认）。其余：`debian-13`=8、`ubuntu-2404`=10、`win10/win11`=60、`centos-stream-9`=10、`freebsd-14`=10、`arch`=10。

### 1.11 `folder-permissions` tab 跨 SP7/SP8 依赖 —— roadmap B 节该条判断有误

roadmap §4 SP9 B 节末尾写「✅ 不挡的：… folder-permissions → users 域 + SP4（已收官）」。**这条是错的**（该轮探测只做了文件级对照，没看 store 的依赖面）。

`NimoOS-UI/src/components/settings/folderPermissionsStore.js`（132 行）是个**六路聚合器**：

| 调用 | 域 | SP 归属 |
|---|---|---|
| `wiki.getCandidates()` / `getRoots()` / `createRoot()` / `patchRootEnabled()` | `wiki` | **无归属** —— roadmap §3.3 追踪表里根本没有 `wiki` 这一行 |
| `api.get/post/delete('/ai/parser/allowlist/folders')` | 经 AI 代理 | SP8 |
| `ai.getSearchSettings()` / `putSearchSettings()` | `ai` | SP8 |
| `ai.listBlacklist()` / `addBlacklistPattern()` / `removeBlacklistPattern()` | `ai` | SP8 |
| `photos.getConfig()` / `updateConfig()` | `photos` | SP7 |

按用户硬约束「凡依赖 SP7/SP8 的项一律不做」→ **该 tab 移出 SP9**（处置见 §6.2 与债务 D11）。

### 1.12 共享包 `container` 域缺 `prune`，且系统里有两个同名 `prune`

- 设置 apps tab 的「清理 Docker 缓存」用的是 `$api.container.prune()`（`SettingsPanel.vue:1983`）→ `POST /v1/container/prune`（`NimoOS-UI/src/service/container.js:152`）。
- 共享包 `NimoOS-Service/src/container.ts` **只有 `getNetworks()`**，没有 `prune`。
- roadmap §3.3 记的是「`container` 现用的 v1 部分 **SP5-P8 收口判定 = Vue2-only，不进包，随 SP10 删**」——**那次判定没有考虑设置区**。按 §3 第 3 条判断法（「Vue2 退役后 New-UI 还要用吗？要 → 进包」），`prune` **要进包**。本 spec 更正该条（见 D10）。
- ⚠️ **同名陷阱**：`NimoOS-UI/src/service/sys.js:154` 另有一个 `prune()`，打的是 `POST /v1/sys/prune`，**是不同端点**。设置区要的是 `container` 那个，别拿错。

### 1.13 本机后端可用性（不变，转录备查）

- ✅ KVM 全端点就绪，有一台 `sp9-alpine-test` 在跑（`vncPort:5900 / vncWebsocketPort:5700 / spicePort:5901`）→ **KVM 区可全程真机验收**。
- ✅ 设置区端点除 `wsssh`（见 1.6）外全部就绪；wifi 扫描能返回真实 AP → **设置区基本可全程真机验收**。
- ❌ 搜索区：`semantic`（Parser 已停 + wiki 是 06-22 旧二进制）、`images`（CLIP 文本编码器权重缺文件）本机不可用；`filenames` 好的（17.2 万条，实测有真命中）。**按用户拍板，搜索区正确性不在本机验，用户自己去另一台机器验。**

---

## 2. 本期唯一的重大范围决策：搜索四源聚合入口

**选定：(a) 的具体变体 —— 前端打 `POST /v1/ai/search/agent/tool`。**

请求：

```
POST /v1/ai/search/agent/tool          (Authorization: <access_token>，共享 axios 自动带)
{"name":"nimoos_search","arguments":{"query":"…","sources":["semantic","filenames","images"],"top_k":20}}
```

响应：**裸 JSON、零层信封**（AI 代理用 `c.Blob` 原样透传 Search 的 `AggregateResponse`）。

### 理由

1. **它是唯一能同时解决"聚合"和"user-id"两个问题的路径。** 直连 `/v1/search/agent/tool` 会 400（§1.1）；让前端自己伪造 `X-NimoOS-User-ID` 等于把授权边界交给客户端。
2. **它是 Vue2 生产已验证的同一条路**（§1.2）。SP9 因此不引入任何新的后端契约风险，也符合「界面照 Vue2、逻辑照正确」的移植纪律——这里连逻辑都不用改。
3. **零后端改动**，符合用户「搜索区只做前端」的约束。

### 被否方案

- **(b) 后端补一个 UI 聚合端点**（实现 `/v1/search/hybrid` 或新开一个，并解决 user-id 来源）——直接违反「本期不动后端」。技术上是最干净的终局形态，登记为债务 **D3**，留给后端排期。
- **(c) 前端并发打 `text` + `visual` 自己合** —— **技术上不成立**：`filenames` 没有单源端点（§1.4），而它恰恰是本机唯一可用、且对"按文件名找东西"这个最高频场景最重要的源。此外 `POST /v1/search/text` 是纯语义端点，Parser 不在就整个 503。

### 代价（写清楚，不粉饰）

搜索面板从此**依赖 `nimoos-ai` 服务在跑**。AI 挂了搜索就不可用——这是一条本不该存在的耦合（搜索不需要 LLM）。前端必须把这种失败**如实呈现为"搜索服务不可用"并给重试**，不得静默空结果。消除耦合的办法就是 D3。

---

## 3. 分期总表

| 期 | 内容 | 前置 | 真机可验 |
|---|---|---|---|
| **P0** | 共享包：`network` / `kvm` / `search` 三域 + `sys` / `users` / `container` 补全；i18n & theme 分片接线；依赖安装；测试基线 | — | 单测 |
| **P1** | Search：SearchDialog 接真后端 | P0 | 仅 filenames 源（其余用户另机验） |
| **P2** | 设置壳（路由 + tab rail）+ general + developer | P0 | ✅ |
| **P3** | 设置 network | P0 P2 | ✅ |
| **P4** | 设置 apps + system-status + terminal(Logs/安全) + storage 入口卡 + folder-permissions 占位卡 | P2 | ✅ |
| **P5** | 设置 account | P0 P2 | ✅ |
| **P6** | KVM 列表 + 控制台(noVNC) + 电源 | P0 | ✅ |
| **P7** | KVM 创建向导 + OSSelector + 快照 + KVM 设置 | P6 | ✅ |
| **P8** | cutover：`/kvm` 路由 + `/settings` 模态入口 + 桌面磁贴翻路由 + 回退 flag + 回退可逆验证 | 全部 | ✅ |

每期开工前单独写 plan 到 `docs/superpowers/plans/`；每期自己起 dev server 轻验收；**整个 SP9 末尾由用户做一次正式真机验收**。

**每期通用 DoD** = roadmap §3.1 那 10 条，外加本 spec §7.4 第 5 条改写过的任务门判定（「相对基线不新增红」而非「全绿」）与 §8 的硬约束速查。P0 / P1 另有专属 DoD，见各自小节末尾。

---

## 4. P0 — 共享包与地基

### 4.1 `network` 域（新建 `NimoOS-Service/src/network.ts`）

```
getInterfaces(): Promise<NetworkInterfaceConfig[]>   GET  /v2/nimoos/network/interfaces
updateInterface(cfg: NetworkInterfaceConfig): Promise<void>
                                                     PUT  /v2/nimoos/network/interfaces
scanWifi(iface: string): Promise<WifiScanResult[]>   GET  /v2/nimoos/network/wifi/scan?iface=<urlencoded>
```

**信封：裸 JSON，零层 unwrap。** `NimoOS/route/v2/network.go` 全部 `c.JSON(status, payload)`，成功体直接是数组/对象，错误体是 `{"error": "..."}`（**不是** `Result{Success,Message,Data}`）。→ 错误路径靠 axios 的 HTTP 状态码 reject，不要过 `unwrap()`。

**类型逐字照 `NimoOS-Common/model/network.go`**，注意蛇形/驼峰混用，别"顺手统一"：

```ts
interface NetworkInterfaceConfig {
  name: string
  type: string            // "ethernet" | "bridge" | "wifi" | "thunderbolt"
  is_virtual: boolean     // 蛇形
  mac: string
  speed?: string          // 字符串，如 "1000"
  state: string           // "up" | "down"（实测可能是空串）
  ipv4?: { method: string; address?: string; netmask?: string; gateway?: string; dns?: string[] }
  wireless?: { mode: string; ssid?: string; apSsid?: string; password?: string
               apPassword?: string; channel?: number; hybridMode?: boolean }
  zone?: string           // "lan" | "wan" | ""
  ports?: string[]
  hybridCapable?: boolean // 驼峰
}
```

`PUT` 成功返回 `{"message":"success"}`，无数据。

### 4.2 `kvm` 域（新建 `NimoOS-Service/src/kvm.ts`）

23 个方法，1:1 对 `NimoOS-UI/src/service/kvm.js`：
`getVMList / getVM / createVM / updateVM / deleteVM / startVM / stopVM / restartVM / pauseVM / resumeVM / wakeupVM / getVNC / setBootFromDisk / setAutostart / getISOList / getISO / downloadISO / deleteISO / getISODownloadProgress / getSnapshots / createSnapshot / deleteSnapshot / restoreSnapshot / getSettings / updateSettings`

**响应层单独处理**（同 Photos v1 裸 JSON 的先例）：写一个内部 `kvmUnwrap<T>(raw, nested: boolean)`，`success === false` 时抛 `Error(message)`；`nested` 由**每个方法显式传入**，取值依据 §1.9 的表。

> **禁止**用"有 `data.data` 就多剥一层"这种自动探测。历史教训（记忆 `newui-fixture-from-imagination-trap`）：**核字段名 ≠ 核信封层数**，自动探测在 `data` 恰好是个含 `data` 键的对象时会静默剥错。层数是契约，写死。

类型照 `NimoOS-KVM/model/{vm,iso,settings}.go`（`VM` / `CreateVMRequest` / `ISO` / `OSInfo` / `Settings`）。

### 4.3 `search` 域（新建 `NimoOS-Service/src/search.ts`）—— **只做归一化**

```ts
agentSearch(query: string, opts?: { sources?: SearchSource[]; topK?: number })
  : Promise<NormalizedAggregate>
```

- 打 `POST /v1/ai/search/agent/tool`（§2）。**裸 JSON 零层**。
- 归一化层只做三件事：**`null → []`**（§1.5）、**蛇形 → 驼峰**、`stats` / `warnings` 归位。
- **不做视图模型。** 视图模型留各区：SearchDialog 一套（P1），sp8 的 AI 卡片一套（已存在）。

```ts
interface NormalizedAggregate {
  semantic: SemanticHit[]   // {score, fileId, paths:[{path,...}], mime, kind, cite, preview:{text}}
  filenames: FileNameHit[]  // {path, name, ext, size, mtimeMs, isDir, match}
  images: ImageHit[]        // {assetId, name, path, score, takenAt, thumbnailUrl, caption}
  notes: NoteHit[]          // 类型留着，P1 不请求（D2）
  stats: { fileindexStatus: string; totalCandidates: number }
  warnings: string[]        // semantic_unavailable / images_unavailable / notes_unavailable / no_accessible_roots / filenames_unavailable
}
```

**§3.3 追踪表 `searchMapper` 行的结论**：**只有归一化进包，视图映射不进。** sp8 已把 Vue2 的 `searchMapper.js` 1:1 移植成 `.sp8/…/src/ai/services/searchMapper.ts`（95 行，产出 AgentBlock 视图模型，与 SearchDialog 需要的视图模型不同）。sp8 合并 master 之后，把它重构成消费本包的 `NormalizedAggregate` → 债务 **D4**。**本期不碰 sp8 分支。**

### 4.4 `sys` 域补全

现有只有 `getUtilization` / `getVersion` / `hardwareInfo` 三个。补：

| 包内方法 | 端点 |
|---|---|
| `getOsVersion()` | `GET /v1/sys/os_version` |
| `getAppVersion()` | `GET /v1/sys/version` |
| `getBaseInfo()` | `GET /v1/sys/baseinfo` |
| `getLogs()` | `GET /v1/sys/logs` |
| `getSystemPaths()` | `GET /v1/sys/paths` |
| `migrateAppPath(type, targetMount)` | `POST /v1/sys/migrate` |
| `getMigrateStatus(jobId)` | `GET /v1/sys/migrate/{jobId}` |
| `power(action)` | `PUT /v1/sys/state/{action}`（`off` / `restart`） |
| `setDiskStandby({minutes})` | `PUT /v1/sys/disk/standby` |
| `updateApp()` | `POST /v1/sys/update` |
| `getServerPort()` / `editServerPort({port})` | `GET/PUT /v1/gateway/port` |
| `getSSLConfig()` / `setSSLConfig(cfg)` / `uploadSSLCert(formData)` | `GET/PUT /v1/gateway/ssl`、`POST /v1/gateway/ssl/upload` |
| `getGatewayComponents()` | `GET /v1/gateway/components` |
| `getDeviceInfo()` | `GET /v1/gateway/device-info` |
| `getUsbStatus()` / `toggleUsbAutoMount({state})` | `GET/PUT /v1/usb/usb-auto-mount` |

> ⚠️ **命名陷阱，必须避开**：包里**现有的** `sys.getVersion()` 打的是 `/sys/version`，而 Vue2 的 `getVersion()` 打的是 `/sys/os_version`、`getAppVersion()` 才是 `/sys/version`。**不要照抄 Vue2 方法名。** 包里一律用语义名 `getOsVersion()` / `getAppVersion()`；现有 `getVersion()` 保留为 `getAppVersion()` 的 deprecated 别名（SP1 起已有调用方，不能删）。

`checkUiPort(url)` 是打任意 URL 的探活（换端口后确认新端口活了），不是标准域方法 → 留在设置区自己实现，不进包。

### 4.5 `users` 域补全（P5 用，P0 一并进包）

`getUserInfo / setUserInfo / changePassword / saveAvatar / getMembers / createMember / deleteUser / getMemberFolders / grantMemberFolder / revokeMemberFolder`
—— 逐个照 `NimoOS-UI/src/service/users.js` 对端点与信封，进包前确认「Vue2 退役后 New-UI 还要用吗」（§3 第 3 条判断法）。

### 4.6 `container` 域补 `prune`

`prune(): POST /v1/container/prune`（设置 apps tab 的「清理 Docker 缓存」）。
更正 roadmap §3.3 里「`container` v1 部分不进包」的 SP5-P8 判定 —— 那次没考虑设置区（§1.12）。
⚠️ 不要错拿 `sys.js:154` 的同名 `prune()`（那是 `/v1/sys/prune`）。

### 4.7 i18n 分片接线（并发对策，见 §7）

- 新建 `src/i18n/zh_cn.sp9.ts` / `src/i18n/en_us.sp9.ts`，**扁平 key、值全为字符串**（`parity.test.ts` 断言 `typeof v === 'string'`，不能嵌套对象）。
- `src/i18n/index.ts` 一次性改成 `messages = { zh_cn: {...zh, ...zhSp9}, en_us: {...en, ...enSp9} }`。
- `src/i18n/parity.test.ts` 同步改成断言**合并后**的集合（它现在直接 import 两个 locale 的默认导出）。
- 此后 SP9 三区所有新 key 只落分片文件，**P0 之后再不碰 `zh_cn.ts` / `en_us.ts`**。

### 4.8 theme token 分片接线

- 新建 `src/styles/theme.sp9.css`，`:root{}` 与 `:root[data-theme="light"]{}` **两块都给值**（New-UI 硬约束）。
- `src/main.ts` 在 `import './styles/theme.css'` 之后加一行 `import './styles/theme.sp9.css'`。
  （不能在 `theme.css` 末尾 `@import` —— CSS 规定 `@import` 必须位于所有规则之前。）
- 此后 SP9 **全程不碰 `theme.css`**。

### 4.9 依赖与基线

- 装 `@novnc/novnc`（P6 用）。**只在 P0 装这一次**，装前先 `git status`，装完立刻用显式 pathspec 提交 `package.json` + `pnpm-lock.yaml`，缩短共享 `node_modules` 被搅动的窗口。
- 跑一次全量 `pnpm test` 与 `pnpm exec vue-tsc --noEmit`，把结果（尤其 `src/files/**` 的红）记进台账当**基线**（§7 第 5 条）。

### P0 DoD

三域 + 两域补全有单测（fixture 逐字来自本文 §1 的实测响应，**不得手编**）；i18n / theme 分片接线后 parity 测试仍绿；基线已记台账；显式 pathspec 提交。

---

## 5. P1 — Search 区

### 5.1 范围

改 `src/home/components/SearchDialog.vue`（599 行）+ 新建 `src/home/search/`（`buildSearchView.ts` + `reasons.ts` + 测试）。

**界面保持 New-UI 已重塑的现状，只换数据源。**
→ 这与 §3 铁律「界面严格 1:1 照 Vue2」冲突，**登记为本期第一次授权偏离**（用户 2026-07-31 拍板；界面已既成事实并经用户验收，见 roadmap §4 SP9 A 节）。

### 5.2 数据流

```
query → service.search.agentSearch(q, {sources:['semantic','filenames','images'], topK:20})
      → buildSearchView(normalized, q)   // 合并 → 排名 → 派生 reasons → 分类
      → 现有 displayList / tabs 渲染（模板结构不动）
```

### 5.3 合并与去重

- 归并键 = **真实路径**：`semantic` 取 `paths[0].path`、`filenames` 取 `path`、`images` 取 `path`。
- 同路径命中多源 → 合成一行，`reasons` 数组累加（去重）。
- **`semantic` 里 `mime` 以 `image/` 开头且 `kind === 'ocr'` 的命中归到"媒体"**，带 OCR 徽标——这正是 demo 2 那类"小票照片靠 OCR 命中"结果的真实来源（demo 里是写死的，真实链路走这里）。

### 5.4 排名规则（确定性，必须有测试）

四组分数**互不可比**（`filenames.match` 无上界，`semantic.score` 是向量相似度，`images.score` 是 CLIP 相似度），因此**不做跨源归一化**，改用分层：

1. 文件名**精确**命中（`name` 忽略大小写全等查询词）
2. 文件名**子串**命中（`filenames` 组，组内按 `match` 降序）
3. `semantic` 的 `kind ∈ {body, transcript}`（组内按 `score` 降序）
4. `images` 与 `semantic.kind === 'ocr'`（组内按 `score` 降序）
5. `semantic` 其余 `kind`（`caption` / `summary`）

层内稳定排序（相同分数保持后端返回顺序）。

### 5.5 reasons 派生规则（替代写死标签）

| 条件 | 标签（zh_cn） | kind（沿用现有语义色） |
|---|---|---|
| `filenames` 组且查询词是文件名子串 | 文件名命中 | `primary` |
| `semantic.kind === 'body'` | 正文命中 | `normal` |
| `semantic.kind === 'transcript'` | 转写命中 | `normal` |
| `semantic.kind === 'ocr'` | 图片文字命中 | `normal` |
| `semantic.kind === 'caption'` | 图片内容命中 | `semantic` |
| `semantic` 组但查询词不出现在 `preview.text` 里 | 语义相关 | `semantic` |

**`demote` 档删除**：后端没有任何降权信号（demo 里的「Likely a person name · demoted」是编的）。`.rz-demote` 的 CSS 一并删，并在 `theme.sp9.css` 的注释里说明 `--dem-*` token 在搜索区不再使用。

### 5.6 准确率百分比 → 来源徽标

`.album-acc` / `.media-acc-num` 位置不再显示 `98%`（那个数字无法从后端诚实得出），改显示来源徽标三选一：**语义 / 文件名 / OCR**。复用现有 `--sem-*` / `--accent-*` token，尺寸与现有徽标一致。

### 5.7 分类 tab

`Documents / Images / Audio / Videos` 由 `mime`（semantic 有）或 `ext`（filenames 有）派生，复用已有 `src/files/util/fileCategories.ts`。tab 计数与「全部结果」的组装逻辑（前 2 条文档 → 相册卡 → 其余）**不动**。

### 5.8 降级与错误态（本区最重要的可见行为）

本机四源里三源不可用，用户要在另一台机器验的主要就是这部分。

| 情形 | 行为 |
|---|---|
| `warnings` 含 `semantic_unavailable` / `images_unavailable` / `filenames_unavailable` | 结果区**顶部一条低调提示条**，列出未参与的源（例：「语义与图片搜索暂不可用，本次只搜了文件名」）。**不用 toast，不遮挡结果** |
| `warnings` 含 `no_accessible_roots` | 提示「没有可搜索的目录」，与"没搜到"区分 |
| 四源全空 **且** 有 warning | 空态文案 = 「搜索后端未就绪」+ 列出原因 |
| 四源全空 **且** 无 warning | 空态文案 = 「没有找到匹配项」 |
| HTTP 401 | 共享包单飞刷新自动处理（axios 实例已带），前端不特判 |
| HTTP 5xx / 超时 / AI 服务不可达 | 错误态 + **重试按钮**；文案说明是"搜索服务不可用"，不得静默显示空结果（§2 代价） |

### 5.9 顺手修的真缺陷

`SearchDialog.vue:262` `openPhotos()` 写死 `http://192.168.1.115/#/photos?q=…` —— **同事机器的 IP**，在真机上必然打不开。改为 `/#/photos?q=…`（同源相对跳转）。
按「界面照 Vue2、逻辑照正确」纪律：这是 bug 不是界面，**改正确并在代码里注释登记**。

### 5.10 深链与绞杀

- New-UI 首页支持 `?q=<query>`：有该参数时自动打开搜索面板并执行搜索。
- `NimoOS-UI/src/router/strangler.js` 的 `migratedRoutes` 加一行 `/search → /app/#/?q=`。
  ⚠️ 现有实现里**精确条目（无 `prefix`）不透传查询串**（`resolveTarget` 只在 `entry.prefix` 分支拼 query）。需要给这条加透传能力（新增 `passQuery: true` 分支，或把该条做成 prefix 条目）——改 `strangler.js` 时**连它的 `__tests__/strangler.spec.js` 一起补测试**。

### P1 DoD

`buildSearchView` / reasons 派生 / 排名分层各有单测（fixture 逐字取自 §1.5 实测响应）；本机 dev server 验证 filenames 源真命中能渲染；三种降级文案能人工触发（mock warnings）；`/search` 绞杀 + 回退 flag 生效；显式 pathspec 提交。

---

## 6. 系统设置区（P2–P5）与 KVM 区（P6–P7）

### 6.1 系统设置 — 结构

代码落 **`src/settings/`**（master 已有 `apps/components/settings/`、sp8 有 `ai/components/settings/`，必须挑第三个名字）。
样式落 **`src/settings/styles/settings.scss`** —— **不复用 sp8 的 `ai/styles/settings-styles.scss`**（那是 AI 设置页专用，还带着 P2a 记的 `v-show`→`v-if` 窄屏回归坑）。

**形态：路由页 `/settings` + `/settings/:tab`**（左 tab rail + 右内容），不是 Vue2 的模态面板。

> 理由：New-UI 是「主页即中枢」的 hub-and-spoke 模型，没有承载全屏模态的宿主；SP8 的 `/ai/settings` 已是同一形态（SettingsRail + section）。
> **内容 1:1，容器形态改变 → 登记为本期第二次授权偏离。** 与 SP6 存储区把弹窗改成路由页是同一处理。

tab 记忆沿用 Vue2 的 `localStorage['nimoos_settings_last_tab']`，但改由路由承载（进 `/settings` 重定向到上次的 tab）。

### 6.2 系统设置 — tab 落点与分期

| tab | 期 | 内容 |
|---|---|---|
| **general** | P2 | 设备信息卡（+ `DeviceInfoPanel` 191 行）· 壁纸行 · 语言行 · 时区行 · 磁盘待机 · WebUI 端口（改端口 + `checkUiPort` 探活）· USB 自动挂载 · 推荐应用 · RSS · Docker 应用开关 · 系统更新（`UpdateModal` 321 + `UpdateCompleteModal` 177）· App 更新 · 开发者模式开关 · 关机/重启确认与等待流（5 个状态浮层：shutting / offline / restarting / reconnecting / done / fallback） |
| **developer** | P2 | 隐藏 tab：HTTPS 开关 + `WebUIHTTPSModal`（334 行） |
| **network** | P3 | 见 6.3 |
| **apps** | P4 | App data location 三行（AppData / Images / Database）+ `AppPathModal`（951 行）+ 迁移任务轮询（`migrateAppPath` → 轮 `getMigrateStatus`）+ Docker 缓存清理（`container.prune`，§4.6）。**不做**「清理本地待上传缓存」 |
| **system-status** | P4 | `SystemStatus.vue`（89 行）+ `GET /v1/gateway/components` |
| **terminal** | P4 | Logs 卡（`LogsCard` + `GET /v1/sys/logs` + 下载）· `TerminalSecuritySection`（172 行，admin-only）· **终端位空态占位**（见 6.4） |
| **storage** | P4 | **入口卡**（见 6.5） |
| **folder-permissions** | P4 | **占位卡**（见 6.6）——功能本体移出 SP9 |
| **account** | P5 | `AccountPanel.vue`（1276 行）：账号信息 · 头像上传 · 改密 · 成员管理（增删）· 成员文件夹授权（增删改） |

两处**记债不做**：

- **壁纸行**保留，「Change」按钮禁用 + tooltip 说明。New-UI 无壁纸系统（roadmap §5 触发式浮动待办）→ 债务 **D5**。
- **语言行**只列 New-UI 已有的 `zh_cn` / `en_us` 两项（Vue2 有 31 项）→ 归 roadmap §5 的 i18n 全量收口，债务 **D6**。

### 6.3 系统设置 — network tab（P3）

数据装配**照 §1.7 的真实做法**（utilization 为列表源、config 为补充源、跳过 `wlan_ap`、`isVirtual` 按名字前缀判定），不要按直觉改成"直接列 `/network/interfaces`"。

组件：接口行（状态点 / 类型名派生 / 速率标签 / DHCP·Static + IP 标签）· 溢出菜单（Edit / 切 Client / 切 AP / 切 Hybrid，按 `wireless.mode` 与 `hybridCapable` 决定项）· `NetworkIfaceConfigModal`（431 行）· `WifiForm`（135 行）· `HotspotForm`（69 行）。

切模式的两步流程照抄 Vue2：先 `updateInterface({name, wireless:{mode}})` 裸切，再打开配置弹窗（这样弹窗里的 wifi 扫描才有结果）。

### 6.4 系统设置 — terminal tab 的终端位（P4）

**后端 `/v1/sys/wsssh` 已被注释掉、实测 404（§1.6）。** 用户 2026-07-31 拍板：

- 只迁 **Logs 卡**与 **TerminalSecuritySection**，这两块后端是好的。
- 终端位显示明确空态：「系统终端后端未启用」，**不放一个连不上的 xterm 假装能用**。
- 开一张后端票（债务 **D7**）：要么恢复 `NimoOS/route/v1.go:106` 的注册，要么补上注释里承诺的 NimoOS-Terminal。
- 连带影响：roadmap §4 SP9 第 3 条「WS 刷新遗留」里的 `TerminalCard.vue:123`（SSH 终端 token 焊在 WS 握手）**本期不做**——后端都没了。`CoreService.vue:134` 的 MessageBus socket.io 那条见 6.7。

### 6.5 系统设置 — storage tab（P4）

用户 2026-07-31 拍板：**tab 保留在列表里，内容换成"打开存储区"入口卡 + 容量概览**，点击 `router.push('/storage')`。

理由：SP6 已把概览 / 系统盘 / 存储列表 / 回收站整套迁到 `/storage`，在设置区再实现一遍等于同一功能两处维护。
→ **登记为本期第三次授权偏离。**

### 6.6 系统设置 — folder-permissions 占位卡（P4）

功能本体跨 SP7/SP8 + 无归属的 `wiki` 域（§1.11）→ **移出 SP9**。用户 2026-07-31 拍板的处置：

- **tab 保留在列表里**（位置不变，SP7/SP8 合并后把内容填进来即可）。
- 内容 = 占位卡：一句「文件夹权限暂在旧版设置中使用」+ 一个跳 Vue2 设置面板的按钮，**给用户留可用路径**。
- 与 6.4 终端位同一处理风格：**不假装能用，也不悄悄消失**。
- 债务 **D11**。

### 6.7 KVM — P6 列表 + 控制台

代码落 `src/kvm/`，路由 `/kvm`，单页布局（左 VM 列表 + 右控制台），照 Vue2 `KVMFullPage.vue`（3153 行）的视觉 1:1。

P6 含：VM 列表（状态点 / 规格 / 运行计数 / 侧栏折叠）· 控制台头（名称 / 状态 / 动作区 / 溢出菜单）· 电源动作（start / stop / restart / pause / resume / wakeup，各带确认弹窗，可用性由 `state` 派生：`canPowerOn` / `canShutDown` / `canRestart` / `canPause` / `canResume` / `canWakeUp` / `canDelete`）· 全屏 · Send Key 悬浮工具条（修饰键 toggle + Ctrl+Alt+Del）· 安装横幅（`state==='running' && !bootFromDisk && iso` → 「弹出安装介质」→ `POST /vms/:id/boot {bootFromDisk:true}`）· SPICE 提示条（只提示，不内置客户端——Vue2 也没有）。

**noVNC**：`new RFB(el, wsUrl, {scaleViewport:true, resizeSession:false})`，`wsUrl = ws://${location.hostname}:${vncWebsocketPort}`（回退 `vncPort`）。**浏览器直连宿主机端口，不走网关、无鉴权**；本机是 5700。dev server 验收时注意 `location.hostname` 与防火墙可达性。

**`spicePort` 保活怪癖照抄**：Vue2 在 `fetchVMs` / `fetchVM` 里把旧对象的 `spicePort` / `spiceTlsPort` 在新数据缺失时保留下来（`vms` 列表接口不返回、只有 `/vnc` 接口返回）。这是**后端字段缺失的兜底**，不是 bug，照抄并注释说明原因。

**状态刷新先照 Vue2 用轮询。** KVM 已有 MessageBus 事件（`kvm:vm_started` / `vm_stopped` / `iso_download_progress` 等，`NimoOS-KVM/common/constants.go`），改事件驱动是明确的改进方向，但**不在 P6 一起做**——避免一期同时引入"新区域"和"新数据通道"两个变量。→ 债务 **D8**。

### 6.8 KVM — P7 创建 / ISO / 快照 / 设置

- **创建向导** + `OSSelector.vue`（701 行）：`/isos` 列表 · 下载（`POST /isos/download` + 轮 `/isos/:id/progress`）· 本地 ISO 选择 · 删除 ISO。
- **前端校验必须挡住的**（§1.10）：`vcpu ∈ [1,32]` · `memory ≥ 256` · **`disk ≥ max(8, os.minDisk)`**（后端硬下限 8 与 `alpine-319.minDisk=2` 矛盾，取大者）· `iso` 传**宿主机绝对路径**（如 `/DATA/KVM/isos/alpine-319.iso`）**而不是** `/isos` 列表里的 `id` · 名字非空且不与现有 VM 重名。
- **快照**：list / create / delete / restore，删除与恢复带二次确认（恢复是破坏性操作）。
- **KVM 设置**：可写 `storagePath` / `defaultVcpu` / `defaultMemory` / `autostart`；只读展示 `cpuCores` / `availableMemoryMB` / `availableDiskGB` / `networkInterfaces`（同一个 `GET /settings` 一起返回，见 §1.9 —— 该端点是**单层** `data`）。

### 6.9 P8 — cutover

- `NimoOS-UI/src/router/strangler.js`：`migratedRoutes` 加 `{from:'/kvm', to:'/app/#/kvm', enabled:true}`；`migratedEntries` 加 `{from:'/settings', to:'/app/#/settings', enabled:true}`，Vue2 侧弹设置模态的调用处改成 `resolveEntryTarget('/settings')` → `window.location.href`（同 SP5-P8 / SP6-P6，**不能走路由表：设置在 Vue2 是无路由模态**）。
- New-UI `src/home/composables/useOpenAction.ts`：`SYS_ROUTE` 里 `vm` / `settings` 改成 `router.push('/kvm')` / `router.push('/settings')`，**各自带 `cutoverDisabled('/kvm')` / `cutoverDisabled('/settings')` 回退判定**。
  ⚠️ **吸取 SP6-P1 教训**：桌面磁贴翻到新路由时**必须同时给回退 flag**，否则部署后浏览器侧无法回滚（SP6 的存储磁贴就漏了，P6 才补）。
- 逐条验证回退可逆：置 `strangler:disabled:/kvm` / `:/settings` / `:/search` = `'1'` → 确认 Vue2 原页仍能正常打开。
- **不删任何 Vue2 代码**（§3.2 铁律，删除全部归 SP10）。

---

## 7. 三线并发共处（本期一等约束）

### 7.1 现场

| 线 | 位置 | 与 SP9 的关系 |
|---|---|---|
| sp7-photos | `.sp7/{NimoOS-New-UI, NimoOS-Service}` | **独立工作树独立分支**，不共享文件。只在将来合并时相撞 |
| sp8-ai | `.sp8/{NimoOS-New-UI, NimoOS-Service}` | 同上 |
| **文件区时光机** | **`NimoOS-New-UI` 主工作树 @ master** | **与 SP9 共享同一工作树、同一 index、同一 HEAD** |

时光机会话**正在活跃提交**（本次设计期间 HEAD 从 `abe3ddf` → `8bb450b`），并且**会改 `src/styles/theme.css`**（`a18631e fix(theme): 深色时间机器卡堆玻璃底垫…`）。
index 里另有 3 个 staged 的 `design-export/*.html` 删除（既不是时光机的也不是 SP9 的）。

`NimoOS-Service` 的 master 工作树同样共享（当前干净）。

### 7.2 风险与覆盖情况

| 级别 | 事项 | 用户给的规则是否覆盖 |
|---|---|---|
| 🔴 | `src/i18n/{zh_cn,en_us}.ts`、`src/styles/theme.css` 双方同窗口编辑 → **后写的静默吞掉先写的**（同文件同工作树，git 全程看不见，连冲突都不报） | ❌ pathspec 只管提交范围 |
| 🔴 | `git add -A` / `git stash -u` / `git checkout` / `git restore` / `deploy.sh` | ✅ 已覆盖 |
| 🔴 | 无 pathspec 的 `git commit` 会顺走 index 里那 3 个 `design-export` 删除 | ✅ 已覆盖 |
| 🟠 | `pnpm install` 改写 `package.json` / `pnpm-lock.yaml`、搅动共享 `node_modules` | ❌ |
| 🟠 | 任务门「全量测试全绿」被对方半成品卡死，或**把对方的红当成自己的去修** | ❌ |
| 🟡 | SP9 每落一期 master，sp7/sp8 那 4 个冲突文件（i18n / router / theme / vite.config）就更难合 | ❌ |

### 7.3 结构性对策

1. **i18n 分片**（§4.7）→ P0 之后 SP9 不再碰 `zh_cn.ts` / `en_us.ts`。
2. **theme 分片**（§4.8）→ SP9 全程不碰 `theme.css`。
3. **router 不分片**：`src/router/index.ts` 只在 P2（`/settings`）与 P6（`/kvm`）各碰一次，改动固定在文件尾部数组，窗口压到最小。路由表分片会牺牲可读性，收益不抵。
4. **依赖只装一次**（§4.9）。

> 顺带收益：1–3 让 SP9 在 sp7/sp8 的 4 个冲突文件上的足迹几乎归零，**sp7/sp8 将来合 master 反而更好合**。

### 7.4 流程对策

5. **测试基线**：P0 第一件事跑全量 `pnpm test` + `pnpm exec vue-tsc --noEmit`，把结果记进台账。此后每期任务门的判定是「**相对基线不新增红**」，不是「全绿」。
   → 这条既防被卡死，更防**把时光机的半成品红当成自己的去"修"**——那才是真会搞坏别人的活。
6. **每期开工前与每次提交前**：`git log --oneline -1` + `git status --short`，确认对方 HEAD 与 index 状态。
7. **提交一律显式 pathspec**：`git commit <path> [<path>…] -m "…"`。**永不** `-a`、**永不** `add -A`、**永不** `stash -u`。
8. **不碰 `src/files/**`**，包括该目录下测试的 fixture / 快照。
9. **不碰 `.sp7/` 与 `.sp8/`**。

### 7.5 残余风险（不假装消除）

分片之后，SP9 与时光机唯一还可能同文件相撞的是：`src/router/index.ts`（2 次）、`src/main.ts`（1 次）、`package.json` + `pnpm-lock.yaml`（1 次）。窗口很短，但**不是零**。
彻底归零只有一条路：SP9 单开 `.sp9` worktree。用户已在开工指令里指定主工作区 master，本 spec 按此执行；**P0 开工前是唯一无成本的切换点**。

---

## 8. 全程硬约束速查

- 验收起 **dev server `pnpm dev --port 5299`**（避开 sp7 的 5277、sp8 的 5288、默认 5273），**不是 `deploy.sh`**（它构建当前工作树，会把时光机的半成品打进去）。
- i18n 新 key 必须**同时**加 zh_cn 与 en_us 分片，否则 `parity.test.ts` 立红。
- 颜色**只能**用 theme token，新语义 token 加进 `theme.sp9.css` 且两套主题块都给值。
- 每期任务门：全量 `pnpm test` + `pnpm exec vue-tsc --noEmit`，判定标准见 §7.4 第 5 条。
- **移植纪律**（roadmap 2026-07-27 拍板）：界面严格 1:1；Vue2 的 bug / 竞态 / 吞错**不照抄**，改正确并在代码里注释登记；禁无关重构。本期已识别的「改正确」项：§5.9 硬编码 IP。已识别的「怪癖照抄」项：§6.7 `spicePort` 保活。
- **fixture 纪律**（记忆 `newui-fixture-from-imagination-trap`）：外部命令输出 / HTTP 信封的 fixture **必须真机逐字抓取**，本 spec §1 已抓好可直接引用；新增的自己抓，**不得手编**。
- 台账落 `NimoOS-New-UI/.superpowers/sdd/sp9/`（**gitignore，不进 git**）。SP7 的台账整目录丢失且 git 救不回 → **重要结论同步回 roadmap §4 SP9**，不要只写台账。

---

## 9. 债务登记

| 编号 | 内容 | 归属 |
|---|---|---|
| **D1** | Samba 两处差异：① Vue2 `SelectShareModal.vue`（预设文件夹多选弹窗）New-UI 无对位物，改成右键任意文件夹共享；② 共享列表空态 Vue2 有插图 + Start 引导，New-UI 没有 | 记录即可，不做 |
| **D2** | 搜索 `notes`（Wiki 笔记）源无 UI 落点，本期不请求 | SP10 前收口 |
| **D3** | 后端补一个面向 UI 的搜索聚合端点，解除「搜索依赖 nimoos-ai」的耦合 | 后端票 |
| **D4** | sp8 合并 master 后，把 `ai/services/searchMapper.ts` 重构成消费共享包的 `NormalizedAggregate` | sp8 合并后 |
| **D5** | 设置 general 的壁纸行按钮禁用 —— New-UI 无壁纸系统 | roadmap §5 浮动待办 |
| **D6** | 设置 general 的语言行只有 2 项（Vue2 有 31 项） | roadmap §5 i18n 全量收口 |
| **D7** | `/v1/sys/wsssh` 被注释掉，系统终端无后端 | 后端票 |
| **D8** | KVM 状态刷新用轮询，未改 MessageBus 事件驱动 | 改进项 |
| **D9** | `CoreService.vue:134` MessageBus socket.io token 焊在握手、不中途刷新（roadmap §4 SP9 第 3 条的剩余部分） | 未排期 |
| **D10** | §3.3 追踪表待更新：`kvm` / `network` → 已进包；`searchMapper` → **只有归一化进包**；`container` → **`prune` 进包**（更正 SP5-P8 判定，§1.12）；`port` → **Vue2-only 死代码，不进包，随 SP10 删**（§1.8） | P0 后更新 roadmap |
| **D11** | 设置 folder-permissions tab 功能本体移出 SP9（跨 SP7/SP8 + 无归属的 `wiki` 域，§1.11），本期只放占位卡 | sp7/sp8 合并后 |
| **D12** | `wiki` 域在 roadmap §3.3 追踪表里**完全缺席**，无 SP 归属。它至少被 folder-permissions 用到（D11 的前置） | 需用户排期 |

---

## 10. 授权偏离登记（本期共 5 处）

「界面严格 1:1」是 roadmap 2026-07-27 拍板的铁律。以下 5 处**可见地不 1:1**，逐条登记依据。

| # | 偏离 | 依据 |
|---|---|---|
| 1 | Search 区保留 New-UI 已重塑的界面，不照 Vue2 `views/Search.vue`（1021 行）1:1 重做；且删掉「排序理由 demote 档」与「准确率百分比」（后端无对应数据，见 §5.5 / §5.6） | 用户 2026-07-31 拍板；界面已既成事实并经用户验收 |
| 2 | 系统设置从 Vue2 的**模态面板**改为 New-UI 的**路由页**（内容 1:1，容器形态变） | New-UI hub-and-spoke 无模态宿主；SP8 `/ai/settings`、SP6 存储区同例 |
| 3 | 设置 storage tab 内容从 1:1 重做改为**跳转入口卡** | 用户 2026-07-31 拍板；避免与 SP6 的 `/storage` 双实现 |
| 4 | 设置 terminal tab 的**终端位是空态占位**，不是 xterm 终端 | 后端 `/v1/sys/wsssh` 已注释、实测 404（§1.6）；用户 2026-07-31 拍板不放连不上的假终端 |
| 5 | 设置 folder-permissions tab 是**占位卡 + 跳旧版按钮**，不是权限矩阵 | 跨 SP7/SP8 依赖（§1.11）；用户 2026-07-31 拍板 |
