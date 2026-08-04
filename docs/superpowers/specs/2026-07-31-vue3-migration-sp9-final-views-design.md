# SP9 — 收尾视图（系统设置 / KVM / Search）设计规格

> 创建 2026-07-31 · 修订 2026-07-31（用户新增「壳先行 + 做样子」交付政策，分期顺序重排）· 状态：**设计已定，未开工**
> 上位文档：`NimoOS-UI/docs/vue3-migration-roadmap.md` §1 决策 · §3 区域迁移标准套路 · §3.3 域迁包追踪表 · §4 SP9
> 本文只写 SP9 自己的事；跨服务背景见 `/home/nimo/NimoTech/CLAUDE.md`，New-UI 自身约定见 `NimoOS-New-UI/CLAUDE.md`。

---

## 0. 一句话与范围

把最后三块视图迁进 New-UI：**系统设置**（Vue2 3095 行模态面板 → New-UI 路由页，**本期主线**）、**KVM**（Vue2 3854 行，New-UI 零实现）、**Search**（已有界面接真后端，不是从零迁）。做完 SP9，Vue2 只剩 SP10 的退役动作。

**不在本期范围**：

| 项 | 结论 |
|---|---|
| Samba 视图 | SP4 已完成对位物，从 SP9 范围删除。只记两处差异（§11 债务 D1） |
| 搜索 `notes`（Wiki 笔记）源 | 不请求，记债（D2） |
| **`wiki` 域整体** | **用户 2026-07-31 拍板挂账,本期不管**（D12）。它是 folder-permissions 逻辑落地的前置 |
| 任何后端改动 | SP9 是纯前端 + 对齐接口契约。搜索区尤其：**不靠"跑通了"兜底，字段形状一律照后端源码对死** |
| 凡依赖 sp7-photos / sp8-ai 分支的**逻辑** | 不做逻辑，但**要做界面**（见 §3.1 政策三）。**本期全程不碰那两个 worktree** |

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
→ **roadmap** §3.3 追踪表里「`port` 域 SP6 定案推迟 SP9 设置区」这一行，**结论：Vue2-only 死代码，不进包，随 SP10 删**。

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
实测 `GET /v1/kvm/isos` 返回的 `alpine-319.minDisk = 2`，**与后端 8 GB 硬下限矛盾**。其余：`debian-13`=8、`ubuntu-2404`=10、`win10/win11`=60、`centos-stream-9`=10、`freebsd-14`=10、`arch`=10。

### 1.11 `folder-permissions` tab 跨 SP7/SP8 依赖 —— roadmap B 节该条判断有误

roadmap §4 SP9 B 节末尾写「✅ 不挡的：… folder-permissions → users 域 + SP4（已收官）」。**这条是错的**（该轮探测只做了文件级对照，没看 store 的依赖面）。

`NimoOS-UI/src/components/settings/folderPermissionsStore.js`（132 行）是个**六路聚合器**：

| 调用 | 域 | SP 归属 |
|---|---|---|
| `wiki.getCandidates()` / `getRoots()` / `createRoot()` / `patchRootEnabled()` | `wiki` | **无归属**，且用户已拍板挂账（D12） |
| `api.get/post/delete('/ai/parser/allowlist/folders')` | 经 AI 代理 | SP8 |
| `ai.getSearchSettings()` / `putSearchSettings()` | `ai` | SP8 |
| `ai.listBlacklist()` / `addBlacklistPattern()` / `removeBlacklistPattern()` | `ai` | SP8 |
| `photos.getConfig()` / `updateConfig()` | `photos` | SP7 |

处置：按 §3.1 政策三 —— **界面做完整，逻辑后补**（见 §5.7、债务 D11）。

### 1.12 共享包 `container` 域缺 `prune`，且系统里有两个同名 `prune`

- 设置 apps tab 的「清理 Docker 缓存」用的是 `$api.container.prune()`（`SettingsPanel.vue:1983`）→ `POST /v1/container/prune`（`NimoOS-UI/src/service/container.js:152`）。
- 共享包 `NimoOS-Service/src/container.ts` **只有 `getNetworks()`**，没有 `prune`。
- roadmap §3.3 记的是「`container` 现用的 v1 部分 **SP5-P8 收口判定 = Vue2-only，不进包，随 SP10 删**」——**那次判定没有考虑设置区**。按 **roadmap** §3 第 3 条判断法（「Vue2 退役后 New-UI 还要用吗？要 → 进包」），`prune` **要进包**。本 spec 更正该条（见 D10）。
- ⚠️ **同名陷阱**：`NimoOS-UI/src/service/sys.js:154` 另有一个 `prune()`，打的是 `POST /v1/sys/prune`，**是不同端点**。设置区要的是 `container` 那个，别拿错。

### 1.13 roadmap 的「⚠️ WS 刷新遗留」条目三个子项全部作废

roadmap §4 SP9 第 3 条列了三处「token 焊在 WS 握手、不中途刷新」要在 SP9 顺修。逐个核过，**没有一处成立**：

| 子项 | 实际 |
|---|---|
| 容器终端 `AppTerminalPanel.vue:38` | **SP5 已经做对了** —— New-UI `src/apps/console/terminalSocket.ts` 连接前 `shouldRefreshToken()` → `refresh()`，还带代际计数器防「卸载期间 refresh 落定后复活连接」的竞态。Vue2 那个文件是等 SP10 删的遗留 |
| SSH 终端 `TerminalCard.vue:76`（roadmap 记的 `:123` 是旧行号） | 后端已注释、404（§1.6），**没有可迁的东西** |
| MessageBus `CoreService.vue:134` / `main.js:35` | **前提就是错的** —— 两边都是 `io({ path: '/v2/message_bus/socket.io/' })`，**握手里根本没有 token**；New-UI `src/composables/useMessageBus.ts` 同样（grep `token` 零命中）。没有 token 就不存在"不中途刷新"。MessageBus 的 socket.io 本就不鉴权（顶层 CLAUDE.md 记了「Socket.IO CORS is wide-open」） |

→ 该条目从 SP9 划掉，roadmap 标注为「已核查作废」（D9 销号）。

### 1.14 本机后端可用性

- ✅ KVM 全端点就绪，有一台 `sp9-alpine-test` 在跑（`vncPort:5900 / vncWebsocketPort:5700 / spicePort:5901`）→ **KVM 区可全程真机验收**。
- ✅ 设置区端点除 `wsssh`（见 1.6）外全部就绪；wifi 扫描能返回真实 AP → **设置区基本可全程真机验收**。
- ❌ 搜索区：`semantic`（Parser 已停 + wiki 是 06-22 旧二进制）、`images`（CLIP 文本编码器权重缺文件）本机不可用；`filenames` 好的（17.2 万条，实测有真命中）。**按用户拍板，搜索区正确性不在本机验，用户自己去另一台机器验。**

### 1.15 KVM P6 实测校正（2026-08-03，接手 P6 时逐行核源码 + curl 只读端点）

本节优先于下方 §6.2 的**原始**描述 —— §6.2 已按本节重写，这里保留"错在哪"的记录，避免以后又照着旧判断返工。

| # | §6.2 原先怎么写 | 源码 / 真机实际 |
|---|---|---|
| 1 | 「创建**向导**」 | 单页表单弹窗（`KVMFullPage.vue:396-494`，一屏 8 个字段），**没有分步** |
| 2 | 只写了「快照」+「KVM 全局设置」 | **漏了一整块**：控制台头齿轮弹的是**两 tab 弹窗**（General + Snapshots，`:230-393`）。General 是 per-VM `PUT /vms/:id`（名称 / 磁盘只读带使用率 / ISO 挂载与弹出 / CPU 核心格子 / 内存 / 网络 / 固件），是 P6 最大的单块工作量 |
| 3 | 「快照 **tab**」 | 是 tab，但在那个 VM 设置弹窗**里面**，不是页面级 tab |
| 4 | 下载「`POST /isos/download` + 轮 `/isos/:id/progress`」 | **Vue2 不轮询**，走 MessageBus 三事件 `kvm:iso_download_progress` / `_complete` / `_failed`（`NimoOS-KVM/common/constants.go:24-26` 确认已注册）。`getISODownloadProgress` 在 Vue2 **零调用方** |
| 5 | 「删除 ISO」 | **OSSelector 里没有任何删除 ISO 的 UI**，`deleteISO` 零调用方 → 用户 2026-08-03 拍板**不做**，见 D14 |
| 6 | 没提 | OSSelector 有个可折叠的**自定义区 = 文件浏览器**（`GET /v1/folder?path=`，起始 `/`，面包屑 + 上一级，只列目录和 `.iso`），占该组件近一半代码 |

**后端契约补充（都已 curl 或读 Go 源码核实，直接用，别重探）**：

- **`model.CreateVMRequest` 只有 11 个字段**（`NimoOS-KVM/model/vm.go:39-51`）：`name/vcpu/memory/disk/iso/os/osType/networkMode/networkInterface/firmware/bootFromDisk`。**没有 `osTemplate`，没有 `autostart`。** Vue2 `createVM` 用 `{...vm}` 把这两个一起发出去、被后端静默丢弃 → **Vue2 的「新建 VM 继承全局设置的自动启动」（`:1386` `newVM.autostart = globalSettings.autostart`）从来没生效过**。`osTemplate` 纯前端概念（驱动"系统版本"下拉的参数联动）。→ D15。
- **`UpdateVM` 复用同一个 `CreateVMRequest`**（`route/v2/vms.go:78-101`），且**不回填 `OSType`** —— 保存 VM 设置不会改操作系统类型。
- **`GET /v1/folder` 的每个条目有 `size`**（真机实测；`NimoOS/model/zima.go:15-26` 的 `Path.Size int64`），但共享包 `NimoOS-Service/src/types.ts` 的 `FolderEntry` **没声明这个字段** → P6 要补 `size?: number`。
- **`GET /v1/kvm/settings` 真机值**（2026-08-03）：`cpuCores:6` · `availableMemoryMB:9234` · `availableDiskGB:263` · `networkInterfaces:["enp2s0","enp4s0","wlp1s0"]` · `defaultDiskSize:20` · `defaultVcpu:2` · `defaultMemory:2048` · `autostart:false` · `storagePath:"/DATA/KVM"`。
- **`GET /v1/kvm/isos` 真机值**：8 条模板，`alpine-319` 是唯一 `status:"downloaded"`（因此唯一带 `path`）。
- **唯一那台 VM 的快照列表为空**（`{"success":true,"data":{"data":[]}}`）。

**Vue2 死代码，不照抄**：

- `OSSelector.getButtonText` 的 MB 分支 —— 条件是 `os._progress >= 0`，进度非负恒真，那行 `${mb}MB` 永远到不了。
- `showSettings()` 里「设置只能在虚拟机停止时修改」的 toast —— 按钮本身 `:disabled="!canEditSettings"`，点不到。
- `confirmRestoreSnapshot()` 里「恢复快照前必须停止虚拟机」的 toast —— 同理，Restore 按钮已 `:disabled="selectedVM?.state !== 'stopped'"`。

**文案坑（照 1:1，不许自己译）**：全局设置弹窗标题 Vue2 用的 key 是 `'Settings'` → `zh_CN.json` = **「系统设置」**（不是「设置」）。P6 要用的 74 个键里，只有 `BSD` 在 `zh_CN.json` 查不到（专有名词，两个 locale 都保持 `BSD`）。

---

## 2. 搜索四源聚合入口（本期唯一的重大接口决策）

**选定：(a) 的具体变体 —— 前端打 `POST /v1/ai/search/agent/tool`。**

```
POST /v1/ai/search/agent/tool          (Authorization: <access_token>，共享 axios 自动带)
{"name":"nimoos_search","arguments":{"query":"…","sources":["semantic","filenames","images"],"top_k":20}}
```

响应：**裸 JSON、零层信封**（AI 代理用 `c.Blob` 原样透传 Search 的 `AggregateResponse`）。

**理由**：① 唯一能同时解决"聚合"和"user-id"两个问题的路径（直连必 400，§1.1；伪造头等于把授权边界交给客户端）；② Vue2 生产已验证的同一条路（§1.2），不引入新的后端契约风险；③ 零后端改动。

**被否**：
- **(b) 后端补 UI 聚合端点** —— 违反「本期不动后端」。技术上是最干净的终局形态，登记为 **D3** 留给后端排期。
- **(c) 前端并发打 `text` + `visual` 自己合** —— **技术上不成立**：`filenames` 没有单源端点（§1.4），而它恰是本机唯一可用、对"按文件名找东西"最重要的源；`/v1/search/text` 还是纯语义端点，Parser 不在就整个 503。

**代价（不粉饰）**：搜索面板从此**依赖 `nimoos-ai` 在跑**。AI 挂了搜索就不可用——这是一条本不该存在的耦合（搜索不需要 LLM）。前端必须把这种失败**如实呈现为"搜索服务不可用"并给重试**，不得静默空结果。消除耦合靠 D3。

---

## 3. 交付政策与分期

### 3.1 本期交付政策（用户 2026-07-31 新增，优先于本 spec 其它安排）

**政策一 —— 壳先行。** 系统设置的路由 / tab rail / 布局 / 样式 / 各 tab 空骨架排在**第一期**，零后端依赖，做完立刻能在真机上看到形状。内容逐 tab 往里填。

**政策二 —— 后端打不通的，不做测试、不列验收项。** 接口已废弃 / 本机不可用 / 返回恒定错误的，只做界面 + **明确空态**（写清为什么不可用），**不写针对该接口的测试**，不列入该期验收清单。
适用：terminal 终端位（`wsssh` 404）· 搜索的 `semantic` / `images` 源（本机不可用，正确性由用户在另一台机器验）。

> **⚠️ 边界：免测只免"打不通的后端"那一段。** 纯前端逻辑照测不误 —— 搜索的排名分层与 reasons 派生、KVM 的信封层数解析、network 的 utilization+config 合并、路径映射、表单校验。这些不依赖后端活着，没有免测理由。

**政策三 —— 依赖在建前端的，先做样子，逻辑后补。** 内容依赖 sp7-photos / sp8-ai 等尚未合并的前端工作时，**照 Vue2 把界面完整做出来**（结构、布局、样式、交互骨架都在），数据源与写操作留空并在界面上标注，等对应分支合并后接线即可，**不必重做界面**。
适用：folder-permissions 权限矩阵（§5.7）· apps tab 的「清理本地待上传缓存」行（§5.6）。

> 这条**修订了** 2026-07-30「SP9 先不做清理待上传缓存」的决定 —— 用户 2026-07-31 确认适用新政策。

**政策四 —— `wiki` 域挂账。** 本期不管（D12）。它是 folder-permissions 逻辑落地的前置，所以那块只能停在"样子"。

### 3.2 分期总表（顺序由用户 2026-07-31 指定：壳 → 设置全部 tab → KVM → Search → cutover）

| 期 | 内容 | 随期进包的域 | 真机可验 |
|---|---|---|---|
| **P0** | **设置壳** + 地基：`/settings/:tab` 路由、tab rail、布局、样式、9 个 tab 空骨架；i18n & theme 分片接线；`@novnc/novnc` 安装；测试基线 | — | ✅ 形状可见 |
| **P1** | 设置 general + developer | `sys` 补全 | ✅ |
| **P2** | 设置 network | `network`（新建） | ✅ |
| **P3** | 设置 apps + system-status + terminal + storage | `container.prune` | ✅（终端位除外） |
| **P4** | 设置 account + folder-permissions **界面骨架** | `users` 补全 | ✅（权限矩阵无数据） |
| **P5** | KVM 列表 + 控制台(noVNC) + 电源 | `kvm`（新建） | ✅ |
| **P6** | KVM 创建向导 + OSSelector + 快照 + KVM 设置 | — | ✅ |
| **P7** | Search：SearchDialog 接真后端 | `search`（新建） | 仅 filenames 源 |
| **P8** | cutover：`/settings` 模态入口 + `/kvm` 路由 + `/search` 深链 + 桌面磁贴翻路由 + 回退 flag + 回退可逆验证 | — | ✅ |

**共享包各域按消费方就近入包**（不再集中在 P0）：域进包的当期就有真实消费方验证形状，避免"进包时凭源码猜、消费时才发现错"。代价是 `NimoOS-Service` 仓被碰 5 次而不是 1 次——可接受，因为并发风险主要在 New-UI 侧（§9）。

**每期通用 DoD** = roadmap §3.1 那 10 条，外加**本 spec** §3.1 的三条政策与 §9.4 改写过的任务门判定（「相对基线不新增红」而非「全绿」）、§10 硬约束速查。各期专属 DoD 见各节末尾。

每期开工前单独写 plan 到 `docs/superpowers/plans/`；每期自己起 dev server 轻验收；**整个 SP9 末尾由用户做一次正式真机验收**。

---

## 4. P0 — 设置壳 + 地基

**本期零后端依赖，不调用任何服务。** 目标是把设置区的形状立起来，后续每期只往里填内容。

### 4.1 壳本体

代码落 **`src/settings/`**（master 已有 `apps/components/settings/`、sp8 有 `ai/components/settings/`，必须挑第三个名字）。
样式落 **`src/settings/styles/settings.scss`** —— **不复用 sp8 的 `ai/styles/settings-styles.scss`**（那是 AI 设置页专用，还带着 P2a 记的 `v-show`→`v-if` 窄屏回归坑）。

**形态：路由页 `/settings` + `/settings/:tab`**（左 tab rail + 右内容），不是 Vue2 的模态面板。

> 理由：New-UI 是「主页即中枢」的 hub-and-spoke 模型，没有承载全屏模态的宿主；SP8 的 `/ai/settings` 已是同一形态（SettingsRail + section）。
> **内容 1:1，容器形态改变 → 登记为授权偏离 #2（§12）。** 与 SP6 存储区把弹窗改成路由页同例。

交付：

- 路由两条：`/settings`（重定向到上次 tab）、`/settings/:tab`。tab 记忆沿用 Vue2 的 `localStorage['nimoos_settings_last_tab']` 键名，但由路由承载。
- 未知 `:tab` → 重定向到 `general`（不是 404）。
- tab rail：9 项 —— `general` · `storage` · `network` · `apps` · `terminal` · `system-status` · `folder-permissions` · `account` · `developer`（`developer` 沿用 Vue2 的隐藏语义，只在开发者模式开启后出现；P0 先按 Vue2 的显隐条件占位）。
- 每个 tab 一个空骨架组件（标题 + 内容区容器 + 加载/空态位），**不接任何接口**。
- 「回主页」按钮（hub-and-spoke 模型下每个区域的唯一导航，§1 决策）。
- 窄屏行为对齐 Vue2 面板；**注意 sp8 P2a 记过的 `v-show`→`v-if` 窄屏回归坑**，tab 切换用 `v-if`。

### 4.2 i18n 分片接线（并发对策，见 §9）

- 新建 `src/i18n/zh_cn.sp9.ts` / `src/i18n/en_us.sp9.ts`，**扁平 key、值全为字符串**（`parity.test.ts` 断言 `typeof v === 'string'`，不能嵌套对象）。
- `src/i18n/index.ts` 一次性改成 `messages = { zh_cn: {...zh, ...zhSp9}, en_us: {...en, ...enSp9} }`。
- `src/i18n/parity.test.ts` 同步改成断言**合并后**的集合。
- 此后 SP9 三区所有新 key 只落分片文件，**P0 之后再不碰 `zh_cn.ts` / `en_us.ts`**。

### 4.3 theme token 分片接线

- 新建 `src/styles/theme.sp9.css`，`:root{}` 与 `:root[data-theme="light"]{}` **两块都给值**（New-UI 硬约束）。
- `src/main.ts` 在 `import './styles/theme.css'` 之后加一行 `import './styles/theme.sp9.css'`。
  （不能在 `theme.css` 末尾 `@import` —— CSS 规定 `@import` 必须位于所有规则之前。）
- 此后 SP9 **全程不碰 `theme.css`**。

### 4.4 依赖与基线

- 装 `@novnc/novnc`（P5 用）。**只在 P0 装这一次**，装前先 `git status`，装完立刻用显式 pathspec 提交 `package.json` + `pnpm-lock.yaml`，缩短共享 `node_modules` 被搅动的窗口。
- 跑一次全量 `pnpm test` 与 `pnpm exec vue-tsc --noEmit`，把结果（尤其 `src/files/**` 的红）记进台账当**基线**（§9.4 第 5 条）。

### P0 DoD

`/settings` 与 `/settings/:tab` 可达、9 个 tab 能切、刷新保持、未知 tab 回落 `general`、窄屏不塌；tab 路由与记忆有单测；i18n / theme 分片接线后 parity 测试仍绿；基线已记台账；显式 pathspec 提交。

---

## 5. P1–P4 — 系统设置内容

### 5.1 P1 general（+ `sys` 域补全）

内容：设备信息卡（+ `DeviceInfoPanel` 191 行）· 壁纸行 · 语言行 · 时区行 · 磁盘待机 · WebUI 端口（改端口 + `checkUiPort` 探活）· USB 自动挂载 · 推荐应用 · RSS · Docker 应用开关 · 系统更新（`UpdateModal` 321 + `UpdateCompleteModal` 177）· App 更新 · 开发者模式开关 · 关机/重启确认与等待流（6 个状态浮层：shutting / offline / restarting / reconnecting / done / fallback）。

**`sys` 域补全**（现有只有 `getUtilization` / `getVersion` / `hardwareInfo`）：

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

**两处「做样子」（政策三 / roadmap §5 浮动待办）**：

- **壁纸行**保留，「Change」按钮禁用 + 说明。New-UI 无壁纸系统 → 债务 **D5**。
- **语言行**只列 New-UI 已有的 `zh_cn` / `en_us`（Vue2 有 31 项）→ 归 roadmap §5 的 i18n 全量收口，债务 **D6**。

### 5.2 P1 developer（隐藏 tab）

HTTPS 开关 + `WebUIHTTPSModal`（334 行）。用 P1 已进包的 `sys.getSSLConfig / setSSLConfig / uploadSSLCert`。

### 5.3 P2 network（+ `network` 域新建）

**数据装配照 §1.7 的真实做法**（utilization 为列表源、config 为补充源、跳过 `wlan_ap`、`isVirtual` 按名字前缀判定），不要按直觉改成"直接列 `/network/interfaces`"。

组件：接口行（状态点 / 类型名派生 / 速率标签 / DHCP·Static + IP 标签）· 溢出菜单（Edit / 切 Client / 切 AP / 切 Hybrid，按 `wireless.mode` 与 `hybridCapable` 决定项）· `NetworkIfaceConfigModal`（431 行）· `WifiForm`（135 行）· `HotspotForm`（69 行）。

切模式的两步流程照抄 Vue2：先 `updateInterface({name, wireless:{mode}})` 裸切，再打开配置弹窗（这样弹窗里的 wifi 扫描才有结果）。

**`network` 域**（新建 `NimoOS-Service/src/network.ts`）：

```
getInterfaces(): Promise<NetworkInterfaceConfig[]>   GET  /v2/nimoos/network/interfaces
updateInterface(cfg): Promise<void>                  PUT  /v2/nimoos/network/interfaces
scanWifi(iface: string): Promise<WifiScanResult[]>   GET  /v2/nimoos/network/wifi/scan?iface=<urlencoded>
```

**信封：裸 JSON，零层 unwrap。** `NimoOS/route/v2/network.go` 全部 `c.JSON(status, payload)`，成功体直接是数组/对象，错误体是 `{"error": "..."}`（**不是** `Result{Success,Message,Data}`）→ 错误路径靠 axios 的 HTTP 状态码 reject，不要过 `unwrap()`。

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

### 5.4 P3 apps（+ `container.prune` 进包）

App data location 三行（AppData / Images / Database）+ `AppPathModal`（951 行）+ 迁移任务轮询（`migrateAppPath` → 轮 `getMigrateStatus`）+ Docker 缓存清理（`container.prune`）+ **「清理本地待上传缓存」行（做样子，见 5.6）**。

**`container` 域补 `prune()`**：`POST /v1/container/prune`。更正 roadmap §3.3 里「`container` v1 部分不进包」的 SP5-P8 判定（§1.12）。⚠️ 不要错拿 `sys.js:154` 的同名 `prune()`（那是 `/v1/sys/prune`）。

### 5.5 P3 system-status / terminal / storage

- **system-status**：`SystemStatus.vue`（89 行）+ `GET /v1/gateway/components`（用 P1 已进包的 `sys.getGatewayComponents`）。
- **terminal**：Logs 卡（`LogsCard` + `sys.getLogs()` + 下载）· `TerminalSecuritySection`（172 行，admin-only）· **终端位空态占位** —— 后端 `/v1/sys/wsssh` 已注释、实测 404（§1.6）。按政策二：**不放连不上的 xterm 假装能用**，显示「系统终端后端未启用」，**不写针对该接口的测试，不列验收项**。开后端票 **D7**。
- **storage**：**入口卡** —— 一张「打开存储区」卡片 + 容量概览，点击 `router.push('/storage')`。SP6 已把概览 / 系统盘 / 存储列表 / 回收站整套迁到 `/storage`（**已完成**，不属于政策三的"在建前端"），在设置区再实现一遍等于同一功能两处维护 → 授权偏离 **#3**（§12）。

### 5.6 P3 —「清理本地待上传缓存」行（做样子）

Vue2 位置：`SettingsPanel.vue:649-664` UI + `:1999-2026` 逻辑，走 `@/views/Photos/upload/idb.js` 读**相册**的 IndexedDB 队列 + `dispatch('photos/clearAllUploads')`。

按政策三：**保留这一行 UI**（图标 + 文案 + 按钮），按钮禁用 + 标注「待相册区迁移完成后启用」。逻辑留空。
⚠️ **别拿 `src/files/upload/idb.ts` 顶** —— 那是 SP4 **文件区**的独立 TUS 队列，与相册两套。
接线归 **SP7-P8**（reciprocal 记账已在 roadmap SP7 P8 条目下）。

> 本条**修订了** 2026-07-30「SP9 先不做这一项」的决定，用户 2026-07-31 确认适用新政策。

### 5.7 P4 account + folder-permissions（+ `users` 域补全）

**account**：`AccountPanel.vue`（1276 行）—— 账号信息 · 头像上传 · 改密 · 成员管理（增删）· 成员文件夹授权（增删改）。
**`users` 域补全**：`getUserInfo / setUserInfo / changePassword / saveAvatar / getMembers / createMember / deleteUser / getMemberFolders / grantMemberFolder / revokeMemberFolder` —— 逐个照 `NimoOS-UI/src/service/users.js` 对端点与信封。

**folder-permissions —— 界面骨架（政策三）**：

- 照 Vue2 `FolderPermissions.vue`（337 行）+ `folderPermissionsView.js` **把权限矩阵界面完整做出来**：表头、行、各子系统列的开关、文件夹选择器入口、离线徽标位、空态。
- **数据源留空**：`snapshot` 由一个明确标注的空实现提供（不打任何接口）；界面顶部一条说明「数据源待相册区(SP7)与 AI 区(SP8)合并后接入」。
- **写操作禁用**：开关只读，不触发 `execute()`。
- **纯逻辑照测**：`folderPermissions.js` 的 `planToggle` / `aiPatternFor` / `denyGlobFor` / `pathFromAiPattern` 是纯函数，一并移植并**写单测**（政策二的边界：不依赖后端）。
- 合并后接线只需替换 `fetchSnapshot` / `execute` 两个函数，**界面不用重做**。债务 **D11**。
- 前置里的 `wiki` 域已由用户拍板挂账（D12），所以这块只能停在"样子"，不是本期能推进的。
- admin-only 守卫照抄（Vue2 `SettingsPanel.vue:1240`：非 admin 进该 tab 直接踢走）。

### P1–P4 DoD

各 tab 界面与 Vue2 逐屏对照；接口调用的字段/信封照 §1 与源码对死；**做样子**的部分在界面上有明确标注、**打不通的后端**部分有明确空态且不列验收项；纯前端逻辑（网络合并、表单校验、planToggle 等）有单测；显式 pathspec 提交。

---

## 6. P5–P6 — KVM 区

代码落 `src/kvm/`，路由 `/kvm`，单页布局（左 VM 列表 + 右控制台），照 Vue2 `KVMFullPage.vue`（3153 行）视觉 1:1。

### 6.1 P5 列表 + 控制台 + 电源（+ `kvm` 域新建）

VM 列表（状态点 / 规格 / 运行计数 / 侧栏折叠）· 控制台头（名称 / 状态 / 动作区 / 溢出菜单）· 电源动作（start / stop / restart / pause / resume / wakeup，各带确认弹窗，可用性由 `state` 派生：`canPowerOn` / `canShutDown` / `canRestart` / `canPause` / `canResume` / `canWakeUp` / `canDelete`）· 全屏 · Send Key 悬浮工具条（修饰键 toggle + Ctrl+Alt+Del）· 安装横幅（`state==='running' && !bootFromDisk && iso` → 「弹出安装介质」→ `POST /vms/:id/boot {bootFromDisk:true}`）· SPICE 提示条（只提示，不内置客户端——Vue2 也没有）。

**noVNC**：`new RFB(el, wsUrl, { scaleViewport: true, resizeSession: false })`，`wsUrl = ws://${location.hostname}:${vncWebsocketPort}`（回退 `vncPort`）。**浏览器直连宿主机端口，不走网关、无鉴权**；本机是 5700。dev server 验收时注意 `location.hostname` 与防火墙可达性。

**`spicePort` 保活怪癖照抄**：Vue2 在 `fetchVMs` / `fetchVM` 里把旧对象的 `spicePort` / `spiceTlsPort` 在新数据缺失时保留（`vms` 列表接口不返回、只有 `/vnc` 接口返回）。这是**后端字段缺失的兜底**，不是 bug，照抄并注释说明原因。

**状态刷新先照 Vue2 用轮询。** KVM 已有 MessageBus 事件（`kvm:vm_started` / `vm_stopped` / `iso_download_progress` 等，`NimoOS-KVM/common/constants.go`），改事件驱动是明确的改进方向，但**不在 P5 一起做**——避免一期同时引入"新区域"和"新数据通道"两个变量。→ 债务 **D8**。

**`kvm` 域**（新建 `NimoOS-Service/src/kvm.ts`）：25 个方法，1:1 对 `NimoOS-UI/src/service/kvm.js`（`getVMList / getVM / createVM / updateVM / deleteVM / startVM / stopVM / restartVM / pauseVM / resumeVM / wakeupVM / getVNC / setBootFromDisk / setAutostart / getISOList / getISO / downloadISO / deleteISO / getISODownloadProgress / getSnapshots / createSnapshot / deleteSnapshot / restoreSnapshot / getSettings / updateSettings`）。

**响应层单独处理**（同 Photos v1 裸 JSON 先例）：内部 `kvmUnwrap<T>(raw, nested: boolean)`，`success === false` 时抛 `Error(message)`；`nested` 由**每个方法显式传入**，取值依据 §1.9 的表。

> **禁止**用"有 `data.data` 就多剥一层"这种自动探测。历史教训：**核字段名 ≠ 核信封层数**，自动探测在 `data` 恰好是个含 `data` 键的对象时会静默剥错。层数是契约，写死。

类型照 `NimoOS-KVM/model/{vm,iso,settings}.go`。

### 6.2 P6 创建 / ISO / 快照 / VM 设置 / 全局设置

**本节 2026-08-03 按 §1.15 的实测重写**（原版有 6 处与源码不符，最要紧的是漏了整个「VM 设置 General tab」）。范围：P5 留下的三个 disabled 入口全部解禁 + 四个弹窗 + OSSelector。用户 2026-08-03 拍板**一期做完，不拆子期**。

#### 6.2.1 承载：KVM 自己的弹窗外壳

新建 `src/kvm/components/KvmDialog.vue`，内部用 **reka-ui 的 `DialogRoot` / `DialogPortal` / `DialogOverlay` / `DialogContent`**（与全局 `components/ui/Dialog.vue` 同一套原语，白拿焦点陷阱 / Esc / 遮罩点击），但 class 全走 `--kvm-*`，结构照 Vue2 的 `create-vm-modal` 三段（`create-vm-head` / `create-vm-body` / `create-vm-foot`）。

**不复用全局 `ui/Dialog.vue`**：它的背景是 `var(--popup-bg)` 玻璃 + `--card-border`，浅色主题下变白底，与「KVM 区固定深色」（§6.1）直接冲突，而它的 `<style scoped>` 从外面覆盖不了。四个弹窗与 OSSelector 全部套 `KvmDialog`（Vue2 的 OSSelector 是手写 overlay，统一到 reka 是**结构偏离、行为更好**，见 6.2.5）。

**z 轴**：KVM 弹窗遮罩 900 / 内容 901；OSSelector 叠在创建弹窗之上 920 / 921；**P5 的 `ProgressOverlay` 保持 1000 不动** —— 快照恢复 / 删除的进度遮罩因此天然盖在设置弹窗上面，与 Vue2 的 `b-modal` 层叠次序一致。

#### 6.2.2 数据层：ISO 状态必须提到页面级

Vue2 的 `OSSelector` 是**常驻挂载**的（`v-if="visible"` 写在它自己的根节点上，组件实例一直活着），所以它的 `sockets` 一直在收下载进度 —— 关掉弹窗、下载照样推进。**New-UI 若照直觉写 `v-if="showOSSelector"` 卸载组件，进度就断了**，这是本期最容易踩的一脚。

→ 新建 `useIsoList()`，**在 `KvmPage` 里创建一次**：持有 `isos`（含 `_downloading` / `_downloaded` / `_progress` / `_downloadedBytes` 派生态）、订阅三个 `kvm:iso_download_*` 事件（`useMessageBus().on` 返回的退订函数在 `KvmPage` 的 `onUnmounted` 里调）、暴露 `download(id)`。`OsSelector.vue` 降级成纯展示层。顺带合掉 Vue2「`GET /isos` 拉两遍」的浪费（`mounted` 拉一次喂 `osTemplates`、开弹窗再拉一次喂 `osList`）。

其余三个 composable：

- `useKvmHostInfo()` —— `GET /settings` 的**只读半**（`cpuCores` / `availableMemoryMB` / `availableDiskGB` / `networkInterfaces` / `defaultDiskSize`）**与可写半**（`storagePath` / `defaultVcpu` / `defaultMemory` / `autostart`）。创建弹窗、VM 设置弹窗、全局设置弹窗三方共用，只拉一处。
- `useSnapshots(vmId)` —— list / create / delete / restore。
- `useIsoBrowser()` —— 自定义区的目录浏览（`service.folder.getList`）。

创建表单自身的状态留在 `CreateVmDialog.vue` 组件内部（`osTemplate` 联动 watch 天然属于它）。**`useVmList.ts` 已 423 行，本期不再往里加东西。**

#### 6.2.3 组件与入口

| 组件 | 对位 Vue2 | 要点 |
|---|---|---|
| `CreateVmDialog.vue` | `:396-494` | 8 个字段；CPU 核心是 `cpuCores` 个方格按钮（真机 6 个，`n <= vcpu` 即高亮）；「系统版本」下拉**只在 `selectedOS.isLocal` 时出现**；`osTemplate` 变化驱动 `osType` / `firmware` / `os` / 推荐规格联动（照 `:720-746`） |
| `VmSettingsDialog.vue` | `:230-393` | 两 tab 壳（General / Snapshots）+ General 内容 + `saveSettings`（`PUT /vms/:id`）。磁盘输入框 `disabled` 并在 label 旁显示 `diskUsedPercent`；ISO 行是「路径按钮 + 弹出/挂载切换按钮」双态；固件两按钮 Vue2 本来就 `disabled`，照抄 |
| `SnapshotsTab.vue` | `:327-385` | 创建表单（名称 + 描述）+ 列表；**删除与恢复都是就地二次确认**（复用 P5 `OverflowMenu` 的 `pendingAction`/`pendingId` 手法），确认后挂 `ProgressOverlay`；Restore 按钮 `:disabled="vm.state !== 'stopped'"` |
| `KvmGlobalSettingsDialog.vue` | `:516-556` | 4 个可写字段 + 一个开关；标题按 `zh_CN.json` 是「**系统设置**」 |
| `OsSelector.vue` | `OSSelector.vue:1-52` | 分类 4 tab（all / windows / linux / bsd）+ OS 卡片网格 + 下载按钮三态（`Download` / `xx.xx%` / `Select`） |
| `IsoBrowser.vue` | `OSSelector.vue:54-93` | 可折叠自定义区：面包屑 + 上一级按钮（`customPath === '/'` 时 disabled）+ 文件列表（只列目录与 `.iso`）+ 空态；选中本地 ISO 走 `isLocal` 分支，按文件名反查官方模板拿推荐规格（照 `:328-361`） |

**三个入口解禁**：左栏齿轮 → 全局设置弹窗；控制台头齿轮 → VM 设置弹窗（`:disabled="!canEditSettings"`，即 `state ∈ {stopped, crashed}`；tooltip 在「系统设置」/「停止虚拟机以修改设置」之间切，照 `:91`）；左栏底部「添加虚拟机」→ 创建弹窗。**另加**：`fetchVMs` 拿到空列表时自动弹创建弹窗（照 `:901`，P5 走的是空态占位）。

#### 6.2.4 前端校验（必须挡住的）

照 Vue2 `createVM`（`:1450-1472`）五条 + §1.10 的后端硬下限：名称非空 → 必须已选 OS → **`disk ≥ max(8, os.minDisk)`**（Vue2 只判了 `os.minDisk`，遇上 `alpine-319.minDisk=2` 会放行一个后端必拒的值，**这条是改正确**）→ `memory ≥ os.minMemory` → `disk ≤ availableDiskGB` → `memory ≤ availableMemoryMB` → `vcpu ≤ cpuCores`。`iso` 字段发 `os.path`（**宿主机绝对路径**），不是列表里的 `id`。

校验失败**走弹窗内联 `.set-danger` 同款展示，不弹 toast**（硬约束：toast 的 z-index 60 会被弹窗遮罩压住 + 糊掉）。属于「操作结果」的（`虚拟机创建成功` / `快照已删除` / `设置已保存`）仍走全局 `useToast()`。

#### 6.2.5 本期已确认的偏离（全部登记）

1. 弹窗外壳改 reka-ui 原语（6.2.1），Vue2 手写的 OSSelector overlay 一并归并进来。**视觉 1:1，容器实现变。**
2. ISO 下载状态提到页面级 composable（6.2.2）—— **行为修正**：Vue2 关弹窗仍收进度，New-UI 若卸载组件会断。
3. **不发 `osTemplate` / `autostart`** 给 `POST /vms`：后端 `CreateVMRequest` 没这两个字段、静默丢弃（§1.15）。→ 后端票 D15。
4. `hostInfo` 初值改 0 / 空数组，**不照抄** Vue2 硬编码的 `cpuCores:16 / availableMemoryMB:11673 / availableDiskGB:959`（`:619-627`）—— 那会让 CPU 核心格子首帧闪出 16 个再变成真值 6 个。格子数为 0 时不渲染格子。**这是可见偏离**，见 §12 #6。
5. 三处 Vue2 死代码不照抄（§1.15 末尾清单）。
6. 弹窗内校验失败改内联报错，不用 toast（6.2.4）。

### P5–P6 DoD

真机建一台一次性 VM（用户 2026-08-03 授权建 + 验完删）、开控制台、跑通六个电源动作、建 / 删 / 恢复快照、改 VM 设置与全局设置，验完删掉该 VM；信封层数解析与表单校验有单测；显式 pathspec 提交。

**P6 顺带补验 P5 的挂账**：D33 真删除 VM 的第二次点击 · D36 安装横幅「我已完成安装」 · D42 光标小圆点 + 画面缩放 · P5 验收清单第 4-22 条（机主只跑到第 3 条）。D34（`wakeup` 需 `suspended` 态）与 D35（SPICE 条需 `bootFromDisk=true` 且 `spicePort>0`）造不出条件就继续挂账。

### P6 验收结果（2026-08-03，机主实机，**通过**）

机主跑完交付的验收清单（A 全局设置 / B ISO 选择器浏览 / C 建一次性 VM `p6-throwaway` / D VM 设置 / E 快照 / F 补验），回报「全部验收通过」，并已自行删除那台一次性 VM。**P6 关账。**

**随之关闭的 P5 挂账**：**D33**（真删除 VM 的第二次点击）· **D36**（安装横幅「我已完成安装」）· **D42**（控制台光标小圆点 + 画面等比缩放）—— 三条都依赖「能建一台一次性 VM」，本期建了、验了、删了。

**仍然挂账**：
- **D34**（`wakeup` 唤醒）—— 造不出 `suspended` 态（需 libvirt managedsave / S3），按交付政策二不列验收项。
- **D35**（SPICE 提示条）—— 需 `bootFromDisk=true` 且 `spicePort>0`。第 41 条点完「我已完成安装」后 `bootFromDisk` 确实变 true，理论上存在一个可验窗口，但清单未就此设独立观察项、机主也未回报，**不记为已验**。
- **P5 验收清单第 4-22 条**（工具条 / 六个电源动作 / 就地二次确认 / 进度遮罩 / 侧栏折叠）—— ⚠️ **控制器把计划第 45 项整理成聊天版清单时漏掉了这批**，机主因此没跑到。**不是机主跳过，是交付清单的遗漏。** → 留待 P7 或 P8 cutover 顺带补跑。
- **第 39 条**（VM 运行时「恢复」按钮应为 disabled）同样在整理时丢失，未验。

---

## 7. P7 — Search 区（+ `search` 域新建）

### 7.1 范围

改 `src/home/components/SearchDialog.vue`（599 行）+ 新建 `src/home/search/`（`buildSearchView.ts` + `reasons.ts` + 测试）。

**界面保持 New-UI 已重塑的现状，只换数据源** → 授权偏离 **#1**（§12）。

### 7.2 `search` 域 —— 只做归一化

```ts
agentSearch(query: string, opts?: { sources?: SearchSource[]; topK?: number })
  : Promise<NormalizedAggregate>
```

打 §2 定的端点，**裸 JSON 零层**。归一化层只做三件事：**`null → []`**（§1.5）、**蛇形 → 驼峰**、`stats` / `warnings` 归位。**不做视图模型**——视图模型留各区。

```ts
interface NormalizedAggregate {
  semantic: SemanticHit[]   // {score, fileId, paths:[{path,...}], mime, kind, cite, preview:{text}}
  filenames: FileNameHit[]  // {path, name, ext, size, mtimeMs, isDir, match}
  images: ImageHit[]        // {assetId, name, path, score, takenAt, thumbnailUrl, caption}
  notes: NoteHit[]          // 类型留着，本期不请求（D2）
  stats: { fileindexStatus: string; totalCandidates: number }
  warnings: string[]
}
```

**roadmap §3.3 追踪表 `searchMapper` 行的结论**：**只有归一化进包，视图映射不进。** sp8 已把 Vue2 的 `searchMapper.js` 1:1 移植成 `.sp8/…/src/ai/services/searchMapper.ts`（95 行，产出 AgentBlock 视图模型，与 SearchDialog 需要的不同）。sp8 合并 master 之后重构成消费本包的 `NormalizedAggregate` → 债务 **D4**。**本期不碰 sp8 分支。**

### 7.3 合并与去重

- 归并键 = **真实路径**：`semantic` 取 `paths[0].path`、`filenames` 取 `path`、`images` 取 `path`。
- 同路径命中多源 → 合成一行，`reasons` 数组累加（去重）。
- **`semantic` 里 `mime` 以 `image/` 开头且 `kind === 'ocr'` 的命中归到"媒体"**，带 OCR 徽标——这正是 demo 2 那类"小票照片靠 OCR 命中"结果的真实来源。

### 7.4 排名规则（确定性，必须有测试）

四组分数**互不可比**（`filenames.match` 无上界，`semantic.score` 是向量相似度，`images.score` 是 CLIP 相似度），**不做跨源归一化**，改用分层：

1. 文件名**精确**命中（`name` 忽略大小写全等查询词）
2. 文件名**子串**命中（`filenames` 组，组内按 `match` 降序）
3. `semantic` 的 `kind ∈ {body, transcript}`（组内按 `score` 降序）
4. `images` 与 `semantic.kind === 'ocr'`（组内按 `score` 降序）
5. `semantic` 其余 `kind`（`caption` / `summary`）

层内稳定排序（相同分数保持后端返回顺序）。

### 7.5 reasons 派生规则（替代写死标签）

| 条件 | 标签（zh_cn） | kind（沿用现有语义色） |
|---|---|---|
| `filenames` 组且查询词是文件名子串 | 文件名命中 | `primary` |
| `semantic.kind === 'body'` | 正文命中 | `normal` |
| `semantic.kind === 'transcript'` | 转写命中 | `normal` |
| `semantic.kind === 'ocr'` | 图片文字命中 | `normal` |
| `semantic.kind === 'caption'` | 图片内容命中 | `semantic` |
| `semantic` 组但查询词不出现在 `preview.text` 里 | 语义相关 | `semantic` |

**`demote` 档删除**：后端没有任何降权信号（demo 里的「Likely a person name · demoted」是编的）。`.rz-demote` 的 CSS 一并删。

### 7.6 准确率百分比 → 来源徽标

`.album-acc` / `.media-acc-num` 位置不再显示 `98%`（那个数字无法从后端诚实得出），改显示来源徽标三选一：**语义 / 文件名 / OCR**。复用现有 token，尺寸与现有徽标一致。

### 7.7 分类 tab

`Documents / Images / Audio / Videos` 由 `mime`（semantic 有）或 `ext`（filenames 有）派生，复用已有 `src/files/util/fileCategories.ts`。tab 计数与「全部结果」的组装逻辑（前 2 条文档 → 相册卡 → 其余）**不动**。

### 7.8 降级与错误态（本区最重要的可见行为）

本机四源里三源不可用，用户要在另一台机器验的主要就是这部分。**按政策二，`semantic` / `images` 源的正确性不写测试、不列本机验收项；但下面这些状态映射是纯前端逻辑，照测。**

| 情形 | 行为 |
|---|---|
| `warnings` 含 `semantic_unavailable` / `images_unavailable` / `filenames_unavailable` | 结果区**顶部一条低调提示条**，列出未参与的源（例：「语义与图片搜索暂不可用，本次只搜了文件名」）。**不用 toast，不遮挡结果** |
| `warnings` 含 `no_accessible_roots` | 提示「没有可搜索的目录」，与"没搜到"区分 |
| 四源全空 **且** 有 warning | 空态 = 「搜索后端未就绪」+ 列出原因 |
| 四源全空 **且** 无 warning | 空态 = 「没有找到匹配项」 |
| HTTP 401 | 共享包单飞刷新自动处理，前端不特判 |
| HTTP 5xx / 超时 / AI 服务不可达 | 错误态 + **重试按钮**；文案说明是"搜索服务不可用"，不得静默显示空结果（§2 代价） |

### 7.9 顺手修的真缺陷

`SearchDialog.vue:262` `openPhotos()` 写死 `http://192.168.1.115/#/photos?q=…` —— **同事机器的 IP**，真机上必然打不开。改为 `/#/photos?q=…`（同源相对跳转）。
按「界面照 Vue2、逻辑照正确」纪律：这是 bug 不是界面，**改正确并在代码里注释登记**。

### 7.10 P7 开工前订正（2026-08-04 复核 + 用户拍板）

本节优先于 §7.1–§7.9 中与之冲突的记载。

**a. §1.5 那份 fixture 已过时，P7 一律重抓。**
2026-08-04 同机复核（`POST /v1/search/agent/tool`，`X-NimoOS-User-ID: 1`，query=`receipt`）：

```json
{"groups":{"semantic":[],"filenames":[
  {"path":"/DATA/Documents/Recipes/Receipt.pdf","name":"Receipt.pdf","ext":"pdf",
   "size":53866,"mtime_ms":1784715139167,"is_dir":false,"match":2},
  {"path":"/DATA/Documents/life/Nick's receipt.jpg","name":"Nick's receipt.jpg","ext":"jpg",
   "size":42943,"mtime_ms":1783651328200,"is_dir":false,"match":1.5}],
 "images":null,"notes":null},
 "stats":{"fileindex_status":"ready","total_candidates":2},
 "warnings":["images_unavailable"]}
```

与 §1.5 相比三处变了：`semantic` 由 `null` 变 **`[]`**（Parser 已可用，只是零命中）；`warnings` 只剩 `images_unavailable`（`semantic_unavailable` / `notes_unavailable` 消失）；`notes` 仍是 `null` 却**没有**对应 warning。
→ **硬结论：「组为 `null`」与「`warnings` 里有该源」不是同一件事，前端必须各守各的，不能用其中一个推另一个。** §1.5 那份响应只留作历史记录，不再当 fixture 用。

**b. 两套写死 demo 整套删除（用户 2026-08-04 拍板）。**
`DOCS` / `ALBUM` / `RECEIPTS` / `isReceiptDemo` / `SEARCH_DELAY_MS` 假延迟全部删除，**不留兜底、不留隐藏开关**——把 demo 留作"零命中回退"会让用户分不清真假结果，与 §7.8「不得静默显示空结果」直接冲突。
连带：空态那四个英文建议词（`product spec` / `launch replay` / `morning podcast` / `wallpaper`）一并删掉，只留提示语。它们是 demo 期编的词，真机上点下去大概率零结果，反而让人以为搜索坏了。（两项都在偏离 #1 的授权范围内，不另开偏离。）

**c. `filenames` 源的噪声前端不处理（用户 2026-08-04 拍板）。**
实测该源会返回 `/DATA/NIMO/openvino_env/lib/python3.13/site-packages/…` 下的 pip 源码，以及 `is_dir: true` 的纯目录项（搜 `how to cook`，头两条是 `cookies.py` 和 `show.py`）。
前端**如实显示，不过滤、不降权、不隐藏**——排除规则属于索引侧，藏在前端会让前后端口径长期打架，且属于静默丢结果。登记为后端票 **D43**。

**d. 「打开文件夹」复用现成映射，不新造。**
后端只给真实路径（`/DATA/…`），而文件页路由吃虚拟路径（`/files/NimoOS-HD/…`）。用 `src/files/util/pathUtils.ts` 的 `toVirtualPath(realPath, displayNames)`，`displayNames` 取 `useFilesStore()`（`loadRoots()` 尚未就绪时原样用真实路径兜底，不阻塞跳转）。

**e. 触发方式不变**：回车 / 点搜索图标才发请求，**不做输入即搜的防抖**。每次查询都经 nimoos-ai 网关转发到 Search，逐键触发是没必要的后端压力。

**f. 降级提示条在本机会常驻**：`images_unavailable` 恒存在 → 结果区顶部那条低调提示每次搜索都在。这是 §7.8 定的如实呈现，**不是缺陷**，验收时不要按缺陷报。

**g. 相册卡 / 媒体行在本机跑不到**：`images` 源恒不可用，`semantic.kind === 'ocr'` 也要语义索引才有 → §7.3 的「OCR 命中归媒体」分支、`.album` 相册卡、`Images` / `Videos` 两个 tab 本机无法触达。按政策二：**代码与界面保留**、**纯前端逻辑（分层排名 / 分类派生 / reasons 派生）照测**、不列本机验收项。

### P7 DoD

- 共享包 `search` 域只做归一化（`null → []`、蛇形转驼峰、`stats` / `warnings` 归位），**不含视图模型**，自带单测。
- `buildSearchView`（合并去重 + 五层排名 + 分类派生）/ `reasons` 派生 / 降级态映射各有单测，**fixture 逐字取自 §7.10a 的真机响应**，每条用例做变异验证。
- `SearchDialog.vue` 里 demo 常量、建议词、假延迟**零残留**；异步写入带过期守卫（epoch）；错误态有重试按钮。
- 本机 dev server 验证 filenames 源真命中能渲染、能预览、能打开文件夹。
- 显式 pathspec 提交。

---

## 8. P8 — cutover

- `NimoOS-UI/src/router/strangler.js`：
  - `migratedRoutes` 加 `{from:'/kvm', to:'/app/#/kvm', enabled:true}`。
  - `migratedRoutes` 加 `/search → /app/#/?q=`。⚠️ 现有实现里**精确条目（无 `prefix`）不透传查询串**（`resolveTarget` 只在 `entry.prefix` 分支拼 query），需要加透传能力（新增 `passQuery: true` 分支，或做成 prefix 条目），**连 `__tests__/strangler.spec.js` 一起补测试**。New-UI 首页相应支持 `?q=` 自动开面板搜索。
  - `migratedEntries` 加 `{from:'/settings', to:'/app/#/settings', enabled:true}`，Vue2 侧弹设置模态的调用处改成 `resolveEntryTarget('/settings')` → `window.location.href`（同 SP5-P8 / SP6-P6，**不能走路由表：设置在 Vue2 是无路由模态**）。
- New-UI `src/home/composables/useOpenAction.ts`：`SYS_ROUTE` 里 `vm` / `settings` 改成 `router.push('/kvm')` / `router.push('/settings')`，**各自带 `cutoverDisabled('/kvm')` / `cutoverDisabled('/settings')` 回退判定**。
  ⚠️ **吸取 SP6-P1 教训**：桌面磁贴翻到新路由时**必须同时给回退 flag**，否则部署后浏览器侧无法回滚（SP6 存储磁贴就漏了，P6 才补）。
- 逐条验证回退可逆：置 `strangler:disabled:/kvm` / `:/settings` / `:/search` = `'1'` → 确认 Vue2 原页仍能正常打开。
- **不删任何 Vue2 代码**（roadmap §3.2 铁律，删除全部归 SP10）。

---

## 9. 三线并发共处（本期一等约束）

### 9.1 现场

| 线 | 位置 | 与 SP9 的关系 |
|---|---|---|
| sp7-photos | `.sp7/{NimoOS-New-UI, NimoOS-Service}` | **独立工作树独立分支**，只在将来合并时相撞 |
| sp8-ai | `.sp8/{NimoOS-New-UI, NimoOS-Service}` | 同上 |
| **文件区时光机** | **`NimoOS-New-UI` 主工作树 @ master** | **与 SP9 共享同一工作树、同一 index、同一 HEAD** |
| sp7 会话的文档写入 | **`NimoOS-UI` 主工作树 @ `docs/vue3-migration-sp3`** | 同样共享；roadmap 是四条线里最热的文件 |

时光机会话**正在活跃提交**（本设计期间 HEAD 连续推进 `abe3ddf` → `8bb450b` → `17e601c`），并且**会改 `src/styles/theme.css`**（`a18631e`）。
index 里另有 3 个 staged 的 `design-export/*.html` 删除（既不是时光机的也不是 SP9 的）。
`NimoOS-Service` 的 master 工作树同样共享。

### 9.2 风险与覆盖情况

| 级别 | 事项 | 用户给的规则是否覆盖 |
|---|---|---|
| 🔴 | `src/i18n/{zh_cn,en_us}.ts`、`src/styles/theme.css` 双方同窗口编辑 → **后写的静默吞掉先写的**（同文件同工作树，git 全程看不见，连冲突都不报） | ❌ pathspec 只管提交范围 |
| 🔴 | `git add -A` / `git stash -u` / `git checkout` / `git restore` / `deploy.sh` | ✅ |
| 🔴 | 无 pathspec 的 `git commit` 会顺走 index 里那 3 个 `design-export` 删除 | ✅ |
| 🟠 | `pnpm install` 改写 `package.json` / `pnpm-lock.yaml`、搅动共享 `node_modules` | ❌ |
| 🟠 | 任务门「全量测试全绿」被对方半成品卡死，或**把对方的红当成自己的去修** | ❌ |
| 🟡 | SP9 每落一期 master，sp7/sp8 那 4 个冲突文件（i18n / router / theme / vite.config）就更难合 | ❌ |

### 9.3 结构性对策

1. **i18n 分片**（§4.2）→ P0 之后 SP9 不再碰 `zh_cn.ts` / `en_us.ts`。
2. **theme 分片**（§4.3）→ SP9 全程不碰 `theme.css`。
3. **router 不分片**：`src/router/index.ts` 只在 P0（`/settings`）与 P5（`/kvm`）各碰一次，改动固定在文件尾部数组。路由表分片会牺牲可读性，收益不抵。
4. **依赖只装一次**（§4.4）。

> 顺带收益：1–3 让 SP9 在 sp7/sp8 的 4 个冲突文件上的足迹几乎归零，**sp7/sp8 将来合 master 反而更好合**。

### 9.4 流程对策

5. **测试基线**：P0 第一件事跑全量 `pnpm test` + `pnpm exec vue-tsc --noEmit`，结果记进台账。此后每期任务门判定是「**相对基线不新增红**」，不是「全绿」。
   → 既防被卡死，更防**把时光机的半成品红当成自己的去"修"**——那才是真会搞坏别人的活。
6. **每期开工前与每次提交前**：`git log --oneline -1` + `git status --short`，确认对方 HEAD 与 index 状态。
7. **提交一律显式 pathspec**：`git commit <path> [<path>…] -m "…"`。**永不** `-a`、**永不** `add -A`、**永不** `stash -u`。新建文件先 `git add <该文件路径>` 再 pathspec 提交。
8. **不碰 `src/files/**`**，包括该目录下测试的 fixture / 快照。
9. **不碰 `.sp7/` 与 `.sp8/`**。
10. **改 `NimoOS-UI/docs/vue3-migration-roadmap.md` 前先 `git log -1`**，改动尽量小、改完立刻提交（sp7 会话也在写这个仓的文档）。

### 9.5 残余风险（不假装消除）

分片之后，SP9 与时光机唯一还可能同文件相撞的是：`src/router/index.ts`（2 次）、`src/main.ts`（1 次）、`package.json` + `pnpm-lock.yaml`（1 次）。窗口很短，但**不是零**。
彻底归零只有一条路：SP9 单开 `.sp9` worktree。用户已指定主工作区 master，本 spec 按此执行；**P0 开工前是唯一无成本的切换点**。

---

## 10. 全程硬约束速查

- 验收起 **dev server**，**不是 `deploy.sh`**（设备上只有一个 `/var/lib/nimoos/www/app/`，而 `deploy.sh` 是 `rsync --delete` —— 三条并行线共用它，谁部署谁把另外两条的产物删掉）。
  **端口 2026-08-03 订正为 5273**：本条原写 `--port 5299`「避开默认 5273」，前提是当时还有 `.sp9` worktree；时间机器完工后 worktree 已撤、SP9 直接在主工作树 master 上做，5273 就是它自己的端口。现役三线：**master(SP9) 5273 · `.sp7`(相册) 5277 · `.sp8`(AI) 5288**。
- i18n 新 key 必须**同时**加 zh_cn 与 en_us 分片，否则 `parity.test.ts` 立红。
- 颜色**只能**用 theme token，新语义 token 加进 `theme.sp9.css` 且两套主题块都给值。
- 每期任务门：全量 `pnpm test` + `pnpm exec vue-tsc --noEmit`，判定标准见 §9.4 第 5 条。
- **移植纪律**（roadmap 2026-07-27 拍板）：界面严格 1:1；Vue2 的 bug / 竞态 / 吞错**不照抄**，改正确并在代码里注释登记；禁无关重构。本期已识别的「改正确」项：§7.9 硬编码 IP。已识别的「怪癖照抄」项：§6.1 `spicePort` 保活。
- **fixture 纪律**：外部命令输出 / HTTP 信封的 fixture **必须真机逐字抓取**，§1 已抓好可直接引用；新增的自己抓，**不得手编**。
  ⚠️ **§1 的 fixture 有保质期** —— §1.5 的搜索响应到 P7 开工（2026-08-04）时已经变了三处（§7.10a）。开工前先重抓一遍再决定能不能直接引用。
- 台账落 `NimoOS-New-UI/.superpowers/sdd/sp9/`（**gitignore，不进 git**）。SP7 的台账整目录丢失且 git 救不回 → **重要结论同步回 roadmap §4 SP9**，不要只写台账。

---

## 11. 债务登记

> **编号说明**：本表只记开工时（P0 前）已知的 D1–D15。**D16–D42 是 P1–P6 各期新发现的，登记在台账 `.superpowers/sdd/sp9/0*.md`（gitignore）与 roadmap §4 SP9 里，不回填本表。** 新增编号一律接台账的最大值往后取（P7 起从 D43 开始）。

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
| **~~D9~~** | ~~WS 刷新遗留三处~~ —— **已核查作废**（§1.13：容器终端 SP5 已做对、SSH 后端已死、MessageBus 握手根本没 token） | **销号** |
| **D10** | roadmap §3.3 追踪表待更新：`kvm` / `network` → 已进包；`searchMapper` → **只有归一化进包**；`container` → **`prune` 进包**（更正 SP5-P8 判定，§1.12）；`port` → **Vue2-only 死代码，不进包，随 SP10 删**（§1.8） | 各期后更新 roadmap |
| **D11** | 设置 folder-permissions **界面已做、逻辑待接线**（六路聚合器跨 SP7/SP8，§1.11）。合并后只需替换 `fetchSnapshot` / `execute` 两个函数 | sp7/sp8 合并后 |
| **D12** | **`wiki` 域用户拍板挂账** —— roadmap §3.3 追踪表里完全缺席、无 SP 归属；它是 D11 落地的前置 | 需用户排期 |
| **D13** | 设置 apps tab「清理本地待上传缓存」**界面已做、逻辑待接线**（依赖相册上传 IndexedDB 队列） | SP7-P8 |
| **D14** | **删除 ISO 无 UI** —— spec 原 §6.2 列了这一项，但 Vue2 `OSSelector` 里根本没有删除入口、`deleteISO` 零调用方（§1.15 #5）。用户 2026-08-03 拍板不做。真要做还得设计「正在被 VM 挂载的 ISO 不能删」的守卫与删后 `vm.iso` 失效的提示 | 需用户排期 |
| **D43** | **`filenames` 源返回索引噪声** —— `/DATA/**/site-packages/…` 下的依赖源码、以及 `is_dir: true` 的纯目录项都会当结果返回（§7.10c）。排除规则应做在索引侧，前端不代劳 | 后端票 |
| **D15** | **后端 `POST /v1/kvm/vms` 不接受 `autostart`** —— `model.CreateVMRequest` 无此字段，导致「新建 VM 继承全局设置的自动启动」在 Vue2 里从来没生效过（§1.15）。要么后端加字段，要么前端建完再补一次 `PUT /vms/:id/autostart`（后者多一次请求、且失败态难表达，未采用） | 后端票 |

---

## 12. 授权偏离登记（本期共 6 处）

「界面严格 1:1」是 roadmap 2026-07-27 拍板的铁律。以下 6 处**可见地不 1:1**，逐条登记依据。

| # | 偏离 | 依据 |
|---|---|---|
| 1 | Search 区保留 New-UI 已重塑的界面，不照 Vue2 `views/Search.vue`（1021 行）1:1 重做；且删掉「排序理由 demote 档」与「准确率百分比」（后端无对应数据，§7.5 / §7.6） | 用户 2026-07-31 拍板；界面已既成事实并经用户验收 |
| 2 | 系统设置从 Vue2 的**模态面板**改为 New-UI 的**路由页**（内容 1:1，容器形态变） | New-UI hub-and-spoke 无模态宿主；SP8 `/ai/settings`、SP6 存储区同例 |
| 3 | 设置 storage tab 内容从 1:1 重做改为**跳转入口卡** | 用户 2026-07-31 拍板；避免与 SP6 已完成的 `/storage` 双实现 |
| 4 | 设置 terminal tab 的**终端位是空态占位**，不是 xterm 终端 | 后端 `/v1/sys/wsssh` 已注释、实测 404（§1.6）；政策二 |
| 5 | 「做样子」项：folder-permissions 权限矩阵（§5.7）与 apps tab 的清理待上传缓存行（§5.6）—— **界面 1:1 但无数据、写操作禁用** | 政策三（用户 2026-07-31 新增）；合并后接线不重做界面 |
| 6 | KVM 创建 / VM 设置弹窗的 CPU 核心格子**首帧不渲染**（等 `GET /settings` 回来才按真值渲染），Vue2 会先按硬编码初值闪出 16 个格子再变成真值 6 个 | Vue2 那组初值（`:619-627`）是占位残留不是设计意图；「Vue2 的 bug 不照抄」（§10 移植纪律）。见 §6.2.5 第 4 条 |
