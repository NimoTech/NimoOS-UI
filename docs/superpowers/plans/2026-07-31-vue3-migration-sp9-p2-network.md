# SP9-P2 设置 network 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 P0 立好的 network 空骨架填成完整功能页 —— 接口列表(状态点 / 类型名 / 速率标签 / DHCP·Static+IP 标签 / 溢出菜单)+ 接口配置弹窗(以太网 / Thunderbolt / Wi-Fi 客户端 / 热点 / 混合双 tab)+ Wi-Fi 扫描与断连 —— 并在共享包新建 `network` 域(3 个方法 + 类型 + 错误文本提取)。

**Architecture:** Vue2 蓝本 = `SettingsPanel.vue` 的 network 分支(L492-585)+ `loadNetworkData()`/`getIfaceTypeName()`/`wirelessModeLabel()`/`switchWifiMode()`/`formatSpeed()`/`openIfaceConfig()`(L2133-2275)+ `NetworkIfaceConfigModal.vue`(431 行)+ `WifiForm.vue`(135 行)+ `HotspotForm.vue`(69 行)。
New-UI 侧的分层:**所有装配与派生逻辑抽成纯函数**(`util/netMerge.ts` 合并 utilization+config、`util/ifaceDisplay.ts` 派生展示文本、`util/ifaceForm.ts` 表单 hydrate 与 PUT payload 构造)—— 因为本期**写路径在本机一律不许实跑**(见下方 §写路径禁令),纯函数单测是这部分正确性的唯一保障;组件层只做渲染与事件。列表数据源 = **Pinia `utilization` store(MessageBus 5 秒实时流)**,config 单独取。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript(strict) · vue-i18n 9 · vitest + @vue/test-utils(`attachTo: document.body`) · reka-ui `DropdownMenu*`(溢出菜单)· `components/ui/Dialog.vue` + `AlertDialog.vue` · 原生 `<select class="set-select">`(全仓惯例) · Pinia(`stores/utilization` + `stores/toast`) · 手写 CSS

---

## Global Constraints

以下每条对**每个**任务都生效,不再逐任务重复。

- **工作目录:主工作树,不开 worktree。**
  - New-UI:`/home/nimo/NimoTech/NimoOS-New-UI`,分支 `master`,基线 **`bcb991b`**
  - Service:`/home/nimo/NimoTech/NimoOS-Service`,分支 `master`,基线 **`6dd2615`**
  - **`.sp7/` 与 `.sp8/` 是别人的 worktree,全程不碰。**
- **⚠️ 这个工作树上永远不要 `git checkout` / `git stash` / `git restore`。** index 里长期躺着 3 个 `design-export/*.html` 的 staged 删除,不属于本期:
  ```
  D  "design-export/Audio Speaker Segmentation.html"
  D  design-export/audio-waveform-design-kit.html
  D  design-export/design-final.html
  ```
  **既不要提交掉,也不要恢复。** 每次提交前 `git status --short` 确认这 3 行还在原位。
- **⚠️ 提交一律显式 pathspec**:`git commit <path> [<path>…] -m "…"`。**永不** `-a`、**永不** `git add -A`、**永不** `git stash -u`。
  P1 的教训:`git add` 只加对的文件**不算安全**,`git commit` 那一行也必须带 pathspec,否则会顺走 index 里别人的东西。新建文件先 `git add <该文件路径>` 再带 pathspec 提交。
- **颜色只能走 theme token**(`var(--…)`)。**本期不需要任何新 token**(见 Task 3 的 token 复用表);万一确实需要,加进 `src/styles/theme.sp9.css` 且 `:root{}` 与 `:root[data-theme="light"]{}` **两块都给值**。**全程不碰 `src/styles/theme.css`**。
- **i18n 新 key 只落分片**:`src/i18n/zh_cn.sp9.ts` 与 `src/i18n/en_us.sp9.ts`,**必须同时加**,**扁平 key、值必须是字符串**(`parity.test.ts` 断言)。**全程不碰 `zh_cn.ts` / `en_us.ts`**。
- **中文文案以 Vue2 为准,不许自己译。** 本计划 Task 3 已把 44 条从 `NimoOS-UI/src/assets/lang/zh_CN.json` 逐条抄出、9 条缺译的按用户 2026-07-31 拍板补译并标注,**实现者直接抄表,不要重译**。
- **测试里读 `.css` 源码一律用 `node:fs`**(文件级 `/// <reference types="node" />`)。`?raw` / `?inline` 在 vitest 下**恒返回空串**。
- **弹窗测试必须 `attachTo: document.body` 并查 `document`** —— `ui/Dialog.vue` 经 reka `DialogPortal` teleport 到 body,`wrapper.find()` 找不到。先例 `settings/components/DeviceInfoDialog.test.ts`。
- **弹窗内的失败提示不要用 toast** —— `AppToast` 是 `z-index:60`,`ui/Dialog` 遮罩是 `z-index:1000` + `backdrop-filter`,toast 会被压在后面还被糊掉。用弹窗内联 `.set-danger`,**并优先显示后端 message**。
- **移植纪律**(roadmap 2026-07-27 拍板):**界面严格 1:1;Vue2 的 bug / 竞态 / 吞错不照抄**,改正确并在代码里注释登记;**禁无关重构**。本期已识别的 8 处集中在 §移植纪律登记。
- **任何「onMounted / watch 取值 → 赋给本地 ref」都要带就地 `touched` 过期守卫**(P1 纪律 #7,最高频返工来源)。**不抽公共 guard**(评审判过早抽象)。交错测试必须用**可手动 resolve 的 deferred** 卡住加载、期间改控件 —— 先 `await` 完再改证明不了任何事;且「旧快照」必须在用户操作**之前**拍。
- **fixture 纪律**:HTTP 信封 / 外部命令输出的 fixture **必须真机逐字抓取,不得手编**。本计划所有 fixture 已于 **2026-07-31 curl / socket.io 实证**,原始文件在
  `/tmp/claude-1000/-home-nimo-NimoTech/a9755bc5-658b-4850-bdd0-516e3d987f58/scratchpad/fixtures-p2/`,各任务内已内联可直接抄。新增的自己抓。
- **任务门**:每个任务收尾跑 `pnpm test` + `pnpm exec vue-tsc --noEmit`。判定 = **tsc 零错误、测试零失败、总数只增不减**(不是「全绿」——见 spec §9.4 第 5 条;基线数值见 §基线)。
  **测试数对不上先想 `color-guard.test.ts`**:它按文件动态生成用例,**新增一个 `.vue` 就凭空多一条**。本期新增 6 个 `.vue` → color-guard 应多 6 条。
- **验收起 dev server**:`pnpm dev --host`,浏览器 `http://192.168.1.143:5273/app/#/settings/network`。
  **不要跑 `./scripts/deploy.sh`** —— sp7/sp8 未合,`/app/` 不能动。
  (spec §10 写的 5299 是 `.sp9` worktree 时代的安排,worktree 已撤,**5273 是对的**。)
- 包管理器 **pnpm**。改完 Service 必须 `cd ../NimoOS-Service && pnpm build`;若 New-UI 构建报 `Module not found`,再 `cd ../NimoOS-New-UI && pnpm install` 重新同步 `file:` 链接。
  **dev server 那层「喂旧包」的坑已在 `219b854` 修掉**(`optimizeDeps.exclude`);但若 dev 里出现**某个共享包方法莫名 `undefined` / 一批不相干操作同时失败**,先 `grep -c network node_modules/.vite/deps/@nimotech_nimoos-service.js`,别先怀疑后端。

---

## ⛔ 写路径禁令(本期一等约束,用户 2026-07-31 指定)

> 用户原话:**「验证时由于机器不在我身边,会直接导致机器 ssh 连接不上或者断开 ssh 连接的都先不做,都记台账到最后做。」**

**结论:本期一次 `PUT /v2/nimoos/network/interfaces` 都不许发 —— 不许用 curl,不许在浏览器里点「保存并应用」,不许点切模式菜单的确认。**

依据(已读 Go 源码逐行确认,不是猜):

1. **SSH 生命线就是被配置的那张网卡。** `SSH_CONNECTION=192.168.1.172 → 192.168.1.143`,默认路由 `dev enp2s0`。这台机器上**唯一 UP 的物理网口 = enp2s0 = 列表里第一行 = 唯一能点「编辑」的东西**。改它的 ipv4/zone 直接断线。
2. **哪怕改一张没插线的网卡也不安全。** `NimoOS/route/v2/network.go:88` 在所有分支之后**无条件**调 `network.ApplyGatewayConfig()`,它会(`NimoOS-Common/pkg/network/gateway.go`):
   - `ensureDnsmasqService()` —— 若无 dnsmasq unit,**写 `/etc/systemd/system/dnsmasq.service` 并 `systemctl enable`**(持久化改系统);
   - `configureDnsmasq()` —— 当前零 lan 口 → `os.Remove(/etc/dnsmasq.d/nimoos-dhcp.conf)` + **`systemctl restart dnsmasq`**;若把某口设成 lan → 在该口上**起 DHCP 服务**;
   - `configureNftables()` —— 重写 `/etc/nimoos/nat.nft` 并 `nft -f`(`delete table ip nimoos_nat` + 重建 masquerade);
   - `enableIPForwarding()` —— 写 `/proc/sys/net/ipv4/ip_forward` + **持久化 `/etc/sysctl.d/99-nimoos-routing.conf`**。
   即:**任何 PUT 都会重写这台机器的 DHCP / NAT / 转发配置**,与目标网卡是否插线无关。
3. `enp4s0`(DOWN、未接线)看着像安全靶子,**但它走的是同一个 `ApplyGatewayConfig`** → 一样不做。

**因此:**

- 写路径(`updateInterface`)的正确性**全部靠纯函数单测 + 代码走查**:payload 构造(`buildUpdatePayload`)、表单 hydrate(`hydrateForm`)、两步切模式的调用顺序、错误分支。这些**不依赖后端活着**,按 spec §3.1 政策二的边界「纯前端逻辑照测不误」——**必须测,而且是本期测试重点**。
- 验收清单里**只列只读项与不落库的界面交互**(打开弹窗、切模式的确认框「点取消」、填表但不保存)。
- **写路径的实机验证整体挂账**,写进台账 `.superpowers/sdd/sp9/03-p2.md` §待用户在机器旁时验 + roadmap §4 SP9,与 P1 的 D17 同性质(**结构性的:破坏性 + 只能在浏览器里验 = 只有机主本人在场时能关账**)。
- **`GET` 一律可做**:`getInterfaces` / `scanWifi` / `/v1/sys/utilization` 都已实测无副作用(`scanWifi` = `iw dev X scan`,只读,耗时 ~2.3s)。

---

## 基线(2026-07-31 实测)

| 项 | 基线 |
|---|---|
| New-UI `pnpm test` | **289 文件 / 2190 例全绿** |
| New-UI `pnpm exec vue-tsc --noEmit` | **0 错误** |
| New-UI `pnpm build` | 通过 |
| Service `pnpm test` | **24 文件 / 161 例全绿** |
| New-UI HEAD | `bcb991b` |
| Service HEAD | `6dd2615` |

---

## 实测校正(本节优先于 spec §5.3 的字面记载)

开工前逐条 curl / 读 Go 源码核对。以下 9 条与 spec 或 Vue2 表面读法不一致,**以本节为准**。

### 1. config 端点只填 5 个字段,`mac` / `state` / `speed` / `ports` **永远是空**

`GetAllInterfaceConfigs()`(`NimoOS-Common/pkg/network/engine.go:634-659`)只从 `/etc/nimoos/network-config.json` 构造 `{name, type, is_virtual, ipv4, zone, wireless, hybridCapable}`,**从不填 `mac` / `state` / `speed` / `ports`**。实测:

```json
[{"name":"enp2s0","type":"ethernet","is_virtual":false,"mac":"","state":"","ipv4":{"method":"dhcp"}},
 {"name":"enp4s0","type":"ethernet","is_virtual":false,"mac":"","state":"","ipv4":{"method":"dhcp"}}]
```

→ 类型里 `mac`/`state` 要保留(Go 无 `omitempty`,字段一定在),但**消费方一个都别用**:`state` 取 utilization 的、`speed` 取 utilization 的、`mac` Vue2 本来就写死 `''`。

### 2. config 端点的返回可能是 `null`(不是 `[]`)

`var results []model.NetworkInterface` 是 nil slice,`network-config.json` 为空 map 时 → `c.JSON(200, nil)` → **`null`**。本机现在有 2 条所以是数组,但**包里必须 `Array.isArray(d) ? d : []`**。同「空组返回 null」的老坑(spec §1.5)。

### 3. `wlp1s0` 不在 config 里,但**必须出现在界面上**

本机 `network-config.json` 只有 enp2s0 / enp4s0;`/v1/sys/utilization` 的 `net` 有 **3 个**(enp2s0 / enp4s0 / **wlp1s0**)。这正是 spec §1.7 说的「列表源是 utilization」——照抄,**别改成直接列 config**,否则 Wi-Fi 卡整个消失。

### 4. utilization 的 `net`:HTTP 有 `max_speed`,**MessageBus 推送没有**(⚠️ 本期最容易做出闪烁的一条)

同一份数据两条腿,字段**不一致**:

| 来源 | 代码 | `max_speed` |
|---|---|---|
| `GET /v1/sys/utilization` | `NimoOS/route/v1/system.go:388` 有 `item.MaxSpeed = …` | **1000**(真实值) |
| MessageBus `nimoos:system:utilization` 5 秒推送 | `NimoOS/route/periodical.go:44-47` **没有那一行** | **0** |

socket 实测(2026-07-31,socket.io-client v2 直连 `/v2/message_bus/socket.io/`):

```json
{"name":"enp2s0","state":"up","addr":"192.168.1.143","speed":1000,"max_speed":0, "...":"bytesSent 等略"}
```

Vue2 的速率标签是 `maxSpeed > speed ? "1 Gbps / 2.5 Gbps" : "1 Gbps"` —— 若直接吃 socket 值,**2.5G 网卡协商在 1G 时标签会每 5 秒在两种形态间闪**(本机 speed==max_speed 恰好看不出来,别被骗过)。
→ **`mergeInterfaces` 必须按网卡名 memo `max_speed`,只在拿到非零值时更新**(Task 2 有实现与测试)。

### 5. socket 信封:`Properties` 里的 `sys_net` 是 **JSON 字符串**

实测信封 `{ID, SourceID, Name, Properties, Timestamp, uuid}`,`Properties` 键 = `sys_cpu/sys_disk/sys_gpu/sys_mem/sys_net/sys_usb`,值都是字符串。`parseUtil`(共享包)已经处理:`typeof v === 'string' → JSON.parse`。**所以走 `stores/utilization` 的 `applySocket` 就是对的,不要自己解**。
⚠️ 但注意 `Utilization.net` 的类型是 `Record<string, unknown> | null`,而真实值是**数组**(`jget` 里 `typeof [] === 'object'` 原样透过)→ 消费方要自己收窄,**不要改共享包那个宽类型**(会波及主页 / 小组件)。收窄在 `netMerge.ts` 里做,见 Task 2。

### 6. `scanWifi` 的三种失败**形态各不相同**,其中一种是 200

| 情况 | HTTP | body |
|---|---|---|
| 正常(wlp1s0,即使 `state=down`) | 200 | 12 条 AP 的数组 |
| 网卡不存在 / 以太网口 / AP 模式扫描不支持 | **200** | **`null`** ← 不是错误! |
| 缺 `iface` 参数 | 400 | `{"error":"iface parameter is required"}` |
| 名字不合 `^[a-zA-Z][a-zA-Z0-9_-]{0,15}$` | 500 | `{"error":"invalid interface name: \"0bad\""}` |

`ScanWifi` 在 `iw` 失败时 `return nil, nil`(`wifi.go:32-35`,注释写 AP 模式扫描会失败)→ 200 + `null`。**包里必须 `Array.isArray(d) ? d : []`**,否则 `.map` 崩。

### 7. network 域的错误体是 `{"error": …}`,**共享包的 axios 拦截器认的是 `message`**

`http.ts` 只做 `error.message = error.response.data.message` —— network 域**永远命不中**(它的错误键是 `error`)。
→ 想在弹窗里「优先显示后端 message」(Global Constraints 那条),必须自己从 `err.response.data.error` 取。Task 1 在包里出 `networkErrorText(e)` 做这件事。

### 8. `isVirtual` 前缀判定在本机**是不可达分支**(仍要移植)

`data.net` 来自 `GetNet(true)` = **只物理口**(`service/system.go:447-478` 走 `helper.sh GetNetCard 2`,即 `ls /sys/class/net | grep -v <虚拟口>`;fallback 也排除 `/sys/devices/virtual/net`)。所以 `docker0` / `br-*` / `veth*` / `virbr0` / `zt*` **永远进不了 `data.net`**。
→ Vue2 的 `isVirtual` 分支(「虚拟网络」标签 + 隐藏溢出菜单 + `width:32px` 占位)**在本机永远看不到**。
处置:**照抄这段纯逻辑并单测**(便宜、且别的机器上装了 ZeroTier 未必如此),但**不列入实机验收项**——列了也没法验。与 `PortPanel.vue` 那种「import 了但模板零渲染」的真死代码不同,这个是可达代码的不可达分支,不适用「死代码不移植」。

### 9. `hybridCapable` 只在 wifi 且非虚拟口上算,本机 **wlp1s0 拿不到**

`setHybridCapable`(`engine.go:196-202`)只对 `type=="wifi" && !is_virtual` 的**config 里已有的**接口算 —— 本机 config 里根本没有 wlp1s0 → 前端 `cfg.hybridCapable` 恒 `undefined` → **「切换到混合模式」菜单项在本机永远不出现**。
→ 该菜单项与 concurrent 双 tab 的界面靠单测(喂造好的 config)保证,**不列入实机验收项**。

---

## 移植纪律登记(Vue2 的 bug / 竞态 / 吞错不照抄,共 8 处)

每一条都要在**代码里写注释登记**(注释里点名 Vue2 的文件与行号 + 为什么改)。

| # | Vue2 的问题 | 本期改法 | 落点 |
|---|---|---|---|
| 1 | **`WifiForm` / `HotspotForm` 的 `dnsString` 是孤儿**:两个子组件各有自己的 `data.dnsString`,`created()` 里从 `formData.ipv4.dns` 初始化,**改了却从不回写父组件** —— 而 `save()` 用的是**父组件自己的** `dnsString`。结果:在「高级设置」里填的 DNS **保存时被静默丢弃** | DNS 统一由弹窗持有,子表单通过 `v-model` 双向绑定(`dnsText` prop + `update:dnsText` emit) | Task 5/6/7 |
| 2 | **保存后的 DHCP 补抓定时器不随卸载停表**:`openIfaceConfig` 的 `setInterval` 只在「拿到 addr」或「4 次用尽」时 `clearInterval`,面板卸载了它还在跑 | 本期**整段不需要** —— 列表已接 5 秒实时流(用户 2026-07-31 拍板),`addr` 会自己刷新。保存后只重取一次 config。**这是删掉一段逻辑,必须在注释里写清替代关系** | Task 8 |
| 3 | **`switchWifiMode` 裸切失败只 `console.error` 就继续开弹窗**:后端没切成、弹窗却按新模式渲染,用户以为切好了 | 裸切失败 → toast 报错 + **不开弹窗**(优先显示后端 `error` 文本) | Task 8 |
| 4 | **`scanWifi` 的 `catch` 里 `scanning` 靠 finally 之外的赋值**:异常路径下 `this.scanning = false` 在 catch 之后才执行,但中途 `return` 的分支(`!isWifi`)**不复位** | `try/finally`,并在 `!isWifi` 早退前不置 `scanning` | Task 7 |
| 5 | **弹窗标题恒为 `Wi-Fi - <网卡名>`**(模板第 5 行写死),以太网口点「编辑」也显示「Wi-Fi - enp2s0」 | **按类型派生标题**(用户 2026-07-31 拍板):`以太网 - enp2s0` / `Wi-Fi - wlp1s0` / `热点 - wlp1s0` / `Wi-Fi + 热点 - wlp1s0` / `Thunderbolt - x` | Task 3/7 |
| 6 | **`clientConnected` / `clientIpInfo` 两个 prop 声明了、算了、传了,`WifiForm` 模板里零处使用**;且 `clientConnected` 的 computed 返回的是**对象**(`find()` 结果)而 prop 声明 `type: Boolean` | 不移植这两个 prop(**真死代码**,同 `PortPanel.vue` 先例)。`iface.addr` 的展示已在列表行里有 | Task 5 |
| 7 | **`v-for :key="net.ssid"`**:同名 SSID(实测扫描里有 `ssid: "00:00:00:00:00:00"` 这种隐藏 SSID)会 key 重复 | key 用 `bssid || ssid`(bssid 实测唯一);Go 侧 `deduplicateWifi` 已按 SSID 去重,但手动 unshift 的「已连接但没扫到」那条**没有 bssid** → 回落 ssid | Task 5 |
| 8 | **弹窗里的失败提示用 toast**(`$buefy.toast`),被遮罩压住 + 糊掉 | 弹窗内联 `.set-danger`,优先显示后端 `error`;列表页(无遮罩)的提示仍用 toast | Task 6/7 |

**授权偏离**:第 5 条(弹窗标题)是**可见文案变更**,用户 2026-07-31 拍板 → 登记为**授权偏离第 7 处**(spec §12 现有 6 处);9 条缺译文案补中文 → **授权偏离第 8 处**(见 Task 3)。两条都要写进台账与 roadmap。

---

## File Structure

### NimoOS-Service(共享包,本期改 4 个文件)

| 文件 | 职责 |
|---|---|
| `src/network.ts`(新建) | `network` 域:`getInterfaces` / `updateInterface` / `scanWifi` + `networkErrorText`。**裸 JSON,零层 unwrap** |
| `src/network.test.ts`(新建) | 域的单测(含 `null` body、`{"error"}` 提取、URL 编码) |
| `src/types.ts`(改) | 加 `NetworkIPv4Config` / `NetworkWirelessConfig` / `NetworkInterfaceConfig` / `NetworkInterfaceUpdate` / `WifiScanResult` |
| `src/index.ts`(改) | `import { createNetwork }` + `service.network` getter + 类型 re-export |

### New-UI(本期新建 6 个 `.vue` + 3 个 util + 6 个测试)

| 文件 | 职责 |
|---|---|
| `src/settings/util/netMerge.ts`(新建) | **纯函数**:`normalizeNetStats`(收窄 `Utilization.net`)+ `mergeInterfaces`(utilization × config → `MergedIface[]`,含 `max_speed` memo、跳 `wlan_ap`、`isVirtual` 前缀、static 覆盖) |
| `src/settings/util/ifaceDisplay.ts`(新建) | **纯函数**:`ifaceTypeKey`(→ i18n key)`formatSpeed` / `speedLabel` / `wirelessModeLabel` / `dialogTitleParts` / `signalBar` |
| `src/settings/util/ifaceForm.ts`(新建) | **纯函数**:`createFormState` / `hydrateForm`(Vue2 那个 100 行 watcher 的等价物)/ `buildUpdatePayload` / `parseDnsList` / `formatDnsList` |
| `src/settings/panels/network/NetworkIfaceRow.vue`(新建) | 一行接口:状态点 + 类型名 + 标签组 + 溢出菜单(reka DropdownMenu) |
| `src/settings/panels/network/WifiForm.vue`(新建) | 扫描按钮 + 结果列表 + 密码 + 高级设置(zone/ipv4/dns) |
| `src/settings/panels/network/HotspotForm.vue`(新建) | SSID + 密码 + 频段 + 高级设置(zone 只读/ipv4/dns) |
| `src/settings/panels/network/NetworkIfaceConfigDialog.vue`(新建) | 弹窗装配:模式分支(ap / client / concurrent 双 tab / 未配置)+ 非 wifi 分支(zone + Thunderbolt/以太网 IP)+ 扫描 / 断连 / 保存 |
| `src/settings/panels/NetworkPanel.vue`(**改**,现为 P0 骨架) | 装配:接实时流 + 取 config + 列表渲染 + 切模式两步流程 + 确认框 + 保存后重取 |
| `src/settings/styles/settings.css`(改) | 追加 `.set-net-*`(行/状态点/标签/菜单)与 `.set-wifi-*`(扫描列表)样式 |
| `src/i18n/zh_cn.sp9.ts` / `en_us.sp9.ts`(改) | 44 条 network 文案 |

**为什么弹窗/表单不复用 `apps/components/AppActionsMenu.vue`**:那个组件的 `.ui-drop-*` 样式是**非 scoped 的全局块**,只在该组件被 import 时才注入;设置区不 import 它 → 菜单会裸奔。本期在 `settings.css` 里自带 `.set-net-menu-*`,自洽。**这是有意的不复用,要在代码注释里写明**。

---

## Task 1: 共享包 `network` 域新建(裸 JSON + 5 个类型)

**Files:**
- Create: `/home/nimo/NimoTech/NimoOS-Service/src/network.ts`
- Create: `/home/nimo/NimoTech/NimoOS-Service/src/network.test.ts`
- Modify: `/home/nimo/NimoTech/NimoOS-Service/src/types.ts`(追加到文件尾)
- Modify: `/home/nimo/NimoTech/NimoOS-Service/src/index.ts`(3 处:import / 类型 re-export / `service` getter)

**Interfaces:**
- Consumes: 无(本期第一个任务)
- Produces:
  - `createNetwork(http: AxiosInstance)` → `{ getInterfaces(): Promise<NetworkInterfaceConfig[]>, updateInterface(cfg: NetworkInterfaceUpdate): Promise<void>, scanWifi(iface: string): Promise<WifiScanResult[]> }`
  - `networkErrorText(e: unknown): string | undefined`
  - 类型 `NetworkIPv4Config` / `NetworkWirelessConfig` / `NetworkInterfaceConfig` / `NetworkInterfaceUpdate` / `WifiScanResult`
  - 消费入口 `service.network.*`(New-UI 侧 `import { service, networkErrorText } from '@nimotech/nimoos-service'`)

- [ ] **Step 1: 写失败的测试**

新建 `src/network.test.ts`(桩的写法照 `src/sys.test.ts` 的 `fakeHttp` / `http` 惯例):

```ts
import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createNetwork, networkErrorText } from './network'

// 记录调用的 http 桩:get 按 url 返回、put 记下 url+body
function stub(getMap: Record<string, unknown>) {
  const calls: { url: string; body?: unknown; params?: unknown }[] = []
  const http = {
    get: async (url: string, cfg?: { params?: unknown }) => {
      calls.push({ url, params: cfg?.params })
      return { data: getMap[url] }
    },
    put: async (url: string, body: unknown) => {
      calls.push({ url, body })
      return { data: { message: 'success' } }
    },
  } as unknown as AxiosInstance
  return { http, calls }
}

describe('createNetwork.getInterfaces', () => {
  // curl 实证 2026-07-31:GET /v2/nimoos/network/interfaces → 裸数组,mac/state 是空串,
  // 未配置过的网卡(wlp1s0)根本不在里面。
  const REAL = [
    { name: 'enp2s0', type: 'ethernet', is_virtual: false, mac: '', state: '', ipv4: { method: 'dhcp' } },
    { name: 'enp4s0', type: 'ethernet', is_virtual: false, mac: '', state: '', ipv4: { method: 'dhcp' } },
  ]

  it('打的是 /v2 前缀的裸 JSON 端点,不过 unwrap', async () => {
    const { http, calls } = stub({ '/v2/nimoos/network/interfaces': REAL })
    const list = await createNetwork(http).getInterfaces()
    expect(calls[0].url).toBe('/v2/nimoos/network/interfaces')
    expect(list).toHaveLength(2)
    expect(list[0].name).toBe('enp2s0')
    expect(list[0].ipv4?.method).toBe('dhcp')
  })

  it('body 是 null(Go nil slice)时退化成空数组,不抛', async () => {
    // network-config.json 为空 map 时 GetAllInterfaceConfigs 返回 nil slice → c.JSON(200, nil) → null
    const { http } = stub({ '/v2/nimoos/network/interfaces': null })
    expect(await createNetwork(http).getInterfaces()).toEqual([])
  })

  it('把标准信封误当数据时也不炸(异形退化)', async () => {
    const { http } = stub({ '/v2/nimoos/network/interfaces': { success: 200, data: [] } })
    expect(await createNetwork(http).getInterfaces()).toEqual([])
  })
})

describe('createNetwork.updateInterface', () => {
  it('PUT 到同一个 URL,body 原样下发', async () => {
    const { http, calls } = stub({})
    await createNetwork(http).updateInterface({ name: 'wlp1s0', wireless: { mode: 'client' } })
    expect(calls[0].url).toBe('/v2/nimoos/network/interfaces')
    expect(calls[0].body).toEqual({ name: 'wlp1s0', wireless: { mode: 'client' } })
  })
})

describe('createNetwork.scanWifi', () => {
  // curl 实证 2026-07-31:GET /v2/nimoos/network/wifi/scan?iface=wlp1s0
  const REAL = [
    { ssid: 'NIMO_Network', bssid: '60:a3:e3:a9:db:05', signal: -45, channel: 11, secure: true, connected: false },
    { ssid: 'TP-LINK_12E0', bssid: '9c:bf:cd:12:0d:d0', signal: -38, channel: 6, secure: true, connected: false },
  ]

  it('iface 走 params(axios 负责编码),返回数组', async () => {
    const { http, calls } = stub({ '/v2/nimoos/network/wifi/scan': REAL })
    const nets = await createNetwork(http).scanWifi('wlp1s0')
    expect(calls[0].url).toBe('/v2/nimoos/network/wifi/scan')
    expect(calls[0].params).toEqual({ iface: 'wlp1s0' })
    expect(nets[0].bssid).toBe('60:a3:e3:a9:db:05')
    expect(nets[0].signal).toBe(-45)
  })

  it('扫描失败时后端返回 HTTP 200 + null → 退化空数组(不是错误)', async () => {
    // 实证:iface=nosuch0 / 以太网口 / AP 模式 → 200 body=null(wifi.go:32 return nil,nil)
    const { http } = stub({ '/v2/nimoos/network/wifi/scan': null })
    expect(await createNetwork(http).scanWifi('nosuch0')).toEqual([])
  })
})

describe('networkErrorText', () => {
  it('从 {"error": …} 里取后端文本(network 域的错误体不是 message)', () => {
    // 实证:缺 iface → 400 {"error":"iface parameter is required"}
    //       名字非法 → 500 {"error":"invalid interface name: \"0bad\""}
    expect(networkErrorText({ response: { data: { error: 'iface parameter is required' } } }))
      .toBe('iface parameter is required')
    expect(networkErrorText({ response: { data: { error: 'invalid interface name: "0bad"' } } }))
      .toBe('invalid interface name: "0bad"')
  })

  it('没有可用文本时返回 undefined,让调用方用自己的兜底文案', () => {
    expect(networkErrorText({ response: { data: { message: 'ok' } } })).toBeUndefined()
    expect(networkErrorText({ response: { data: { error: '   ' } } })).toBeUndefined()
    expect(networkErrorText(new Error('boom'))).toBeUndefined()
    expect(networkErrorText(null)).toBeUndefined()
    expect(networkErrorText(undefined)).toBeUndefined()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test network
```
预期:FAIL —— `Failed to resolve import "./network"`。

- [ ] **Step 3: 加类型到 `src/types.ts` 尾部**

**逐字照 `NimoOS-Common/model/network.go`(蛇形/驼峰混用照留,不许"顺手统一")**:

```ts
// ── network 域(NimoOS core /v2/nimoos/network/*)───────────────────────────
// 逐字对位 NimoOS-Common/model/network.go。⚠️ 蛇形(is_virtual)与驼峰(hybridCapable)
// 混用是后端的既成事实,不要统一。
// ⚠️ mac / state / speed / ports 这几个字段后端 GET 时**永远不填**
//   (GetAllInterfaceConfigs 只从 network-config.json 构造 name/type/is_virtual/ipv4/zone/
//    wireless/hybridCapable)——保留在类型里是因为 Go struct 里有(无 omitempty 一定序列化),
//   但消费方要从 /v1/sys/utilization 取运行时 state/speed/addr。
export interface NetworkIPv4Config {
  method: string            // "static" | "dhcp" | "manual"
  address?: string
  netmask?: string
  gateway?: string
  dns?: string[]
}

export interface NetworkWirelessConfig {
  mode: string              // "client" | "ap" | "concurrent"(config 里还可能是 "manual")
  ssid?: string
  apSsid?: string
  password?: string
  apPassword?: string
  channel?: number
  hybridMode?: boolean
}

export interface NetworkInterfaceConfig {
  name: string
  type: string              // "ethernet" | "bridge" | "wifi" | "thunderbolt"
  is_virtual: boolean       // 蛇形
  mac: string               // 实测恒空串
  speed?: string            // Go 是 string(如 "1000");实测不返回
  state: string             // 实测恒空串
  ipv4?: NetworkIPv4Config
  wireless?: NetworkWirelessConfig
  zone?: string             // "lan" | "wan" | ""
  ports?: string[]
  hybridCapable?: boolean   // 驼峰;只在 type=="wifi" && !is_virtual 时算
}

/** PUT 的请求体 —— 只下发这 4 个字段(Vue2 save() 的形状)。 */
export interface NetworkInterfaceUpdate {
  name: string
  zone?: string
  ipv4?: NetworkIPv4Config
  wireless?: NetworkWirelessConfig
}

/** GET /v2/nimoos/network/wifi/scan 的一条。对位 NimoOS-Common/pkg/network/wifi.go WifiNetwork。 */
export interface WifiScanResult {
  ssid: string
  bssid: string
  signal: number            // dBm,负数(如 -45)
  channel: number
  secure: boolean
  connected: boolean
}
```

- [ ] **Step 4: 写 `src/network.ts`**

```ts
import type { AxiosInstance } from 'axios'
import type { NetworkInterfaceConfig, NetworkInterfaceUpdate, WifiScanResult } from './types.js'

// network 域 = NimoOS core 的 /v2/nimoos/network/*(NimoOS/route/v2/network.go)。
//
// ⚠️ 信封:**裸 JSON,零层 unwrap**。该文件里全部是 c.JSON(status, payload):
//    成功体直接是数组/对象,错误体是 {"error": "..."} —— 不是全系统的
//    Result{Success,Message,Data}。所以错误路径靠 axios 的 HTTP 状态码 reject,
//    **不要过 unwrap()**(过了必抛)。取后端错误文本用下面的 networkErrorText。
//
// ⚠️ 两个 GET 都可能是 HTTP 200 + body `null`(Go nil slice):
//    - interfaces:network-config.json 为空 map 时
//    - wifi/scan:`iw dev X scan` 失败时(网卡不存在 / 以太网口 / AP 模式不支持扫描,
//      wifi.go:32-35 明确 return nil, nil)
//    → 一律 Array.isArray 守卫后返回 [],消费方不必再守一遍。
export function createNetwork(http: AxiosInstance) {
  return {
    /** GET /v2/nimoos/network/interfaces —— 持久化配置(读 /etc/nimoos/network-config.json)。
     *  注意这里**只有配置过的网卡**;界面上的接口列表要以 /v1/sys/utilization 的 net 为源。 */
    async getInterfaces(): Promise<NetworkInterfaceConfig[]> {
      const res = await http.get('/v2/nimoos/network/interfaces')
      return Array.isArray(res.data) ? (res.data as NetworkInterfaceConfig[]) : []
    },

    /** PUT /v2/nimoos/network/interfaces —— 成功返回 {"message":"success"},无数据。
     *  ⚠️ 后端在这个 handler 末尾**无条件** ApplyGatewayConfig()(重写 dnsmasq/nftables/
     *  ip_forward),属破坏性写操作。调用方要确认过用户意图再调。 */
    async updateInterface(cfg: NetworkInterfaceUpdate): Promise<void> {
      await http.put('/v2/nimoos/network/interfaces', cfg)
    },

    /** GET /v2/nimoos/network/wifi/scan?iface=… —— 实测耗时 ~2.3s,调用方要有 loading 态。
     *  缺 iface → 400;名字不合 ^[a-zA-Z][a-zA-Z0-9_-]{0,15}$ → 500;都由 axios reject。 */
    async scanWifi(iface: string): Promise<WifiScanResult[]> {
      const res = await http.get('/v2/nimoos/network/wifi/scan', { params: { iface } })
      return Array.isArray(res.data) ? (res.data as WifiScanResult[]) : []
    },
  }
}

/** 从 axios 错误里取 network 域的后端文本。
 *  http.ts 的响应拦截器做的是 error.message = response.data.**message**,
 *  而 network 域的错误键是 **error** → err.message 永远拿不到后端文本。
 *  弹窗要「优先显示后端 message」就得走这个函数。 */
export function networkErrorText(e: unknown): string | undefined {
  const data = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data
  if (data && typeof data === 'object') {
    const raw = (data as { error?: unknown }).error
    if (typeof raw === 'string' && raw.trim()) return raw.trim()
  }
  return undefined
}
```

- [ ] **Step 5: 接进 `src/index.ts`**

三处改动(**只加行,不动既有行**):

```ts
// 1) import 区,跟在 createSnapshot 那行后面
import { createNetwork, networkErrorText } from './network.js'

// 2) 值导出:把 networkErrorText 加进已有的 export { … } 那一行
export { initService, getHttp, refreshAccessToken, parseUtil, UPLOAD_TUS_ENDPOINT, networkErrorText }

// 3) 类型 re-export:在已有的 export type { … } 那一长行尾部追加
//    NetworkIPv4Config, NetworkWirelessConfig, NetworkInterfaceConfig,
//    NetworkInterfaceUpdate, WifiScanResult

// 4) service 对象里追加 getter(排在 snapshot 后面)
  get network(): ReturnType<typeof createNetwork> {
    return createNetwork(getHttp() as AxiosInstance)
  },
```

- [ ] **Step 6: 跑测试 + 类型检查**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test && pnpm exec tsc --noEmit -p tsconfig.json 2>/dev/null || pnpm build
```
预期:`24 → 25 文件`、`161 → 175 例`(本任务 14 例)全绿;`pnpm build` 通过(New-UI 要吃 `dist/`)。

- [ ] **Step 7: 构建并同步到 New-UI**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm build
cd /home/nimo/NimoTech/NimoOS-New-UI && grep -c 'nimoos/network' node_modules/@nimotech/nimoos-service/dist/index.js
```
预期:最后那条 `grep -c` **≥ 3**(证明新方法真进了 New-UI 侧读到的那份 dist)。若为 0 → `cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm install` 重新同步 `file:` 链接后再查。

- [ ] **Step 8: 提交(显式 pathspec)**

```bash
cd /home/nimo/NimoTech/NimoOS-Service
git add src/network.ts src/network.test.ts
git commit src/network.ts src/network.test.ts src/types.ts src/index.ts \
  -m "feat(network): 新建 network 域(裸 JSON 零 unwrap + null 守卫 + error 文本提取)"
```

---

## Task 2: `netMerge.ts` —— utilization × config 合并(本期最关键的纯函数)

**Files:**
- Create: `src/settings/util/netMerge.ts`
- Create: `src/settings/util/netMerge.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `NetworkInterfaceConfig` / `NetworkIPv4Config` / `NetworkWirelessConfig`
- Produces:
  - `interface NetRuntimeStat { name: string; state: string; addr: string; speed: number; max_speed: number }`
  - `interface MergedIface { name: string; state: 'up' | 'down'; speed: number; maxSpeed: number; addr: string; dhcp: boolean; isVirtual: boolean; zone: string; type: string; ipv4: NetworkIPv4Config | null; wireless: NetworkWirelessConfig | null; hybridCapable: boolean }`
  - `normalizeNetStats(net: unknown): NetRuntimeStat[]`
  - `class MaxSpeedMemo { remember(stats: NetRuntimeStat[]): void; get(name: string): number }`
  - `mergeInterfaces(net: unknown, configs: NetworkInterfaceConfig[] | null | undefined, memo?: MaxSpeedMemo): MergedIface[]`
  - `VIRTUAL_AP_IFACE = 'wlan_ap'`

- [ ] **Step 1: 写失败的测试**

新建 `src/settings/util/netMerge.test.ts`。**两份 fixture 都是 2026-07-31 真机抓的**(见 §实测校正 4/5):

```ts
import { describe, it, expect } from 'vitest'
import { normalizeNetStats, mergeInterfaces, MaxSpeedMemo, VIRTUAL_AP_IFACE } from './netMerge'
import type { NetworkInterfaceConfig } from '@nimotech/nimoos-service'

// ── fixture A:GET /v1/sys/utilization 的 data.net(curl 实证 2026-07-31)──
// 注意 3 个口:enp2s0 up、enp4s0 down、wlp1s0 down(**wlp1s0 不在 config 里**)。
// 且 HTTP 这条腿 max_speed 是真值 1000。
const HTTP_NET = [
  { name: 'enp2s0', bytesSent: 7285564882, bytesRecv: 5743660811, packetsSent: 9428871, packetsRecv: 9033514,
    errin: 0, errout: 0, dropin: 0, dropout: 0, fifoin: 0, fifoout: 0,
    state: 'up', time: 1785507566, addr: '192.168.1.143', speed: 1000, max_speed: 1000 },
  { name: 'enp4s0', bytesSent: 0, bytesRecv: 0, packetsSent: 0, packetsRecv: 0,
    errin: 0, errout: 0, dropin: 0, dropout: 0, fifoin: 0, fifoout: 0,
    state: 'down', time: 1785507566, addr: '', speed: 0, max_speed: 1000 },
  { name: 'wlp1s0', bytesSent: 0, bytesRecv: 0, packetsSent: 0, packetsRecv: 0,
    errin: 0, errout: 0, dropin: 0, dropout: 0, fifoin: 0, fifoout: 0,
    state: 'down', time: 1785507566, addr: '', speed: 0, max_speed: 0 },
]

// ── fixture B:MessageBus nimoos:system:utilization 推送里的 sys_net(socket.io 实证 2026-07-31)──
// **同一台机器同一个口,max_speed 全是 0** —— periodical.go 没有 item.MaxSpeed 那一行。
const SOCKET_NET = [
  { name: 'enp2s0', bytesSent: 7412676226, bytesRecv: 5750617476, packetsSent: 9538769, packetsRecv: 9103377,
    errin: 0, errout: 0, dropin: 0, dropout: 0, fifoin: 0, fifoout: 0,
    state: 'up', time: 1785508147, addr: '192.168.1.143', speed: 1000, max_speed: 0 },
]

// ── fixture C:GET /v2/nimoos/network/interfaces(curl 实证 2026-07-31)──
const CONFIGS: NetworkInterfaceConfig[] = [
  { name: 'enp2s0', type: 'ethernet', is_virtual: false, mac: '', state: '', ipv4: { method: 'dhcp' } },
  { name: 'enp4s0', type: 'ethernet', is_virtual: false, mac: '', state: '', ipv4: { method: 'dhcp' } },
]

describe('normalizeNetStats', () => {
  it('把共享包的宽类型(Record|null)收窄成数组', () => {
    expect(normalizeNetStats(HTTP_NET)).toHaveLength(3)
    expect(normalizeNetStats(HTTP_NET)[0]).toMatchObject({ name: 'enp2s0', state: 'up', speed: 1000 })
  })

  it('null / undefined / 对象 / 字符串 一律退化成空数组', () => {
    expect(normalizeNetStats(null)).toEqual([])
    expect(normalizeNetStats(undefined)).toEqual([])
    expect(normalizeNetStats({ enp2s0: {} })).toEqual([])
    expect(normalizeNetStats('[]')).toEqual([])
  })

  it('丢掉没有 name 的条目,缺字段补默认值', () => {
    const out = normalizeNetStats([{ name: 'x' }, { state: 'up' }, null, 42])
    expect(out).toEqual([{ name: 'x', state: '', addr: '', speed: 0, max_speed: 0 }])
  })
})

describe('mergeInterfaces —— 列表源是 utilization,config 只做补充', () => {
  it('三个口全出现,包括 config 里没有的 wlp1s0', () => {
    const rows = mergeInterfaces(HTTP_NET, CONFIGS)
    expect(rows.map((r) => r.name)).toEqual(['enp2s0', 'enp4s0', 'wlp1s0'])
  })

  it('state 归一成 up/down(大小写与空白照 Vue2 trim+toLowerCase)', () => {
    const rows = mergeInterfaces([
      { name: 'a', state: ' UP ' }, { name: 'b', state: 'down' }, { name: 'c', state: '' },
    ], [])
    expect(rows.map((r) => r.state)).toEqual(['up', 'down', 'down'])
  })

  it('运行时 addr / speed / maxSpeed 取 utilization', () => {
    const [eth] = mergeInterfaces(HTTP_NET, CONFIGS)
    expect(eth.addr).toBe('192.168.1.143')
    expect(eth.speed).toBe(1000)
    expect(eth.maxSpeed).toBe(1000)
  })

  it('zone / type / ipv4 / wireless / hybridCapable 取 config', () => {
    const cfg: NetworkInterfaceConfig[] = [{
      name: 'wlp1s0', type: 'wifi', is_virtual: false, mac: '', state: '',
      zone: 'wan', ipv4: { method: 'dhcp' }, wireless: { mode: 'client', ssid: 'NIMO_Network' },
      hybridCapable: true,
    }]
    const [wifi] = mergeInterfaces([{ name: 'wlp1s0', state: 'up', addr: '10.0.0.5', speed: 0, max_speed: 0 }], cfg)
    expect(wifi.zone).toBe('wan')
    expect(wifi.type).toBe('wifi')
    expect(wifi.wireless).toEqual({ mode: 'client', ssid: 'NIMO_Network' })
    expect(wifi.hybridCapable).toBe(true)
  })

  it('config 里没有的口:zone/type 空、ipv4/wireless null、hybridCapable false、dhcp true', () => {
    const wlan = mergeInterfaces(HTTP_NET, CONFIGS)[2]
    expect(wlan.name).toBe('wlp1s0')
    expect(wlan.zone).toBe('')
    expect(wlan.type).toBe('')
    expect(wlan.ipv4).toBeNull()
    expect(wlan.wireless).toBeNull()
    expect(wlan.hybridCapable).toBe(false)
    expect(wlan.dhcp).toBe(true)   // Vue2:cfg.ipv4 ? method!=='static' : true
  })

  it('静态 IP:用 config 的 address 覆盖显示,dhcp=false', () => {
    const cfg: NetworkInterfaceConfig[] = [{
      name: 'enp2s0', type: 'ethernet', is_virtual: false, mac: '', state: '',
      ipv4: { method: 'static', address: '192.168.1.250', netmask: '255.255.255.0' },
    }]
    const [row] = mergeInterfaces([{ name: 'enp2s0', state: 'up', addr: '192.168.1.143', speed: 1000, max_speed: 1000 }], cfg)
    expect(row.addr).toBe('192.168.1.250')
    expect(row.dhcp).toBe(false)
  })

  it('静态但 config 没写 address → 回落运行时 addr', () => {
    const cfg: NetworkInterfaceConfig[] = [
      { name: 'enp2s0', type: 'ethernet', is_virtual: false, mac: '', state: '', ipv4: { method: 'static' } },
    ]
    const [row] = mergeInterfaces([{ name: 'enp2s0', state: 'up', addr: '192.168.1.143', speed: 0, max_speed: 0 }], cfg)
    expect(row.addr).toBe('192.168.1.143')
  })

  it('concurrent 模式即使 method=static 也不覆盖(那个静态 IP 是虚拟 AP 口的)', () => {
    // 照抄 Vue2 L2152 的 `&& cfg.wireless?.mode !== 'concurrent'`
    const cfg: NetworkInterfaceConfig[] = [{
      name: 'wlp1s0', type: 'wifi', is_virtual: false, mac: '', state: '',
      ipv4: { method: 'static', address: '192.168.22.1' }, wireless: { mode: 'concurrent' },
    }]
    const [row] = mergeInterfaces([{ name: 'wlp1s0', state: 'up', addr: '192.168.1.77', speed: 0, max_speed: 0 }], cfg)
    expect(row.addr).toBe('192.168.1.77')
    expect(row.dhcp).toBe(false)      // dhcp 标签仍按 method 判(Vue2 两个判断是分开的)
  })

  it('跳过虚拟 AP 口 wlan_ap', () => {
    const rows = mergeInterfaces([{ name: VIRTUAL_AP_IFACE, state: 'up' }, { name: 'enp2s0', state: 'up' }], [])
    expect(rows.map((r) => r.name)).toEqual(['enp2s0'])
  })

  it('isVirtual 按名字前缀判定(不用后端的 is_virtual 字段)', () => {
    // 后端 is_virtual 故意给成 false,前端仍要判成虚拟 —— 照抄 Vue2 L2149
    const cfg: NetworkInterfaceConfig[] = [
      { name: 'docker0', type: 'bridge', is_virtual: false, mac: '', state: '' },
    ]
    const rows = mergeInterfaces([
      { name: 'zt5u4ycmnw', state: 'up' }, { name: 'docker0', state: 'up' },
      { name: 'br-571abdff3f8c', state: 'up' }, { name: 'vethd8ccc13', state: 'up' },
      { name: 'enp2s0', state: 'up' }, { name: 'wlp1s0', state: 'down' },
    ], cfg)
    expect(rows.filter((r) => r.isVirtual).map((r) => r.name))
      .toEqual(['zt5u4ycmnw', 'docker0', 'br-571abdff3f8c', 'vethd8ccc13'])
    expect(rows.filter((r) => !r.isVirtual).map((r) => r.name)).toEqual(['enp2s0', 'wlp1s0'])
  })
})

describe('MaxSpeedMemo —— MessageBus 推送没有 max_speed,不能让标签闪', () => {
  it('先吃 HTTP(有真值)再吃 socket(全 0):maxSpeed 保持不变', () => {
    const memo = new MaxSpeedMemo()
    const first = mergeInterfaces(HTTP_NET, CONFIGS, memo)
    expect(first[0].maxSpeed).toBe(1000)

    // 5 秒后 socket 推送到达 —— max_speed 是 0
    const second = mergeInterfaces(SOCKET_NET, CONFIGS, memo)
    expect(second[0].speed).toBe(1000)
    expect(second[0].maxSpeed).toBe(1000)   // ← 关键:没有掉成 0
  })

  it('后来拿到更大的真值时会更新(换网线协商到 2.5G)', () => {
    const memo = new MaxSpeedMemo()
    mergeInterfaces([{ name: 'enp2s0', state: 'up', addr: '', speed: 1000, max_speed: 1000 }], [], memo)
    const out = mergeInterfaces([{ name: 'enp2s0', state: 'up', addr: '', speed: 1000, max_speed: 2500 }], [], memo)
    expect(out[0].maxSpeed).toBe(2500)
  })

  it('不传 memo 时按原值走(纯函数可单独使用)', () => {
    expect(mergeInterfaces(SOCKET_NET, [])[0].maxSpeed).toBe(0)
  })

  it('memo 按网卡名分别记,不串味', () => {
    const memo = new MaxSpeedMemo()
    mergeInterfaces(HTTP_NET, [], memo)
    const out = mergeInterfaces([
      { name: 'enp2s0', state: 'up', addr: '', speed: 1000, max_speed: 0 },
      { name: 'wlp1s0', state: 'down', addr: '', speed: 0, max_speed: 0 },
    ], [], memo)
    expect(out[0].maxSpeed).toBe(1000)   // enp2s0 记过
    expect(out[1].maxSpeed).toBe(0)      // wlp1s0 本来就是 0
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test netMerge
```
预期:FAIL —— `Failed to resolve import "./netMerge"`。

- [ ] **Step 3: 写 `src/settings/util/netMerge.ts`**

```ts
// 接口列表的数据装配层(spec §1.7 / §5.3)。
//
// 为什么列表源是 /v1/sys/utilization 的 net 而不是 /v2/nimoos/network/interfaces:
// 后者只有**配置过**的网卡(读 /etc/nimoos/network-config.json),本机的 wlp1s0 就不在里面;
// 前者是实时枚举(GetNet(true) = 只物理口)。照 Vue2 SettingsPanel.vue:2134-2176 的做法,
// **不要"优化"成直接列 config**,否则 Wi-Fi 卡会整个从界面消失。
//
// config 只用来按 name 匹配后补 zone / type / ipv4 / wireless / hybridCapable,
// 并在静态 IP 时覆盖显示地址。
import type { NetworkInterfaceConfig, NetworkIPv4Config, NetworkWirelessConfig } from '@nimotech/nimoos-service'

/** concurrent 模式下后端造出来的虚拟 AP 口(NimoOS-Common/pkg/network/wifi_mode.go:15
 *  VirtualApIfacePrefix = "wlan_ap"),界面上不作为独立网卡展示。 */
export const VIRTUAL_AP_IFACE = 'wlan_ap'

/** /v1/sys/utilization 的 net 数组里我们要用的字段(对位 NimoOS model.IOCountersStat)。
 *  其余流量计数字段(bytesSent 等)本期界面不用,不进类型。 */
export interface NetRuntimeStat {
  name: string
  state: string
  addr: string
  speed: number
  max_speed: number
}

export interface MergedIface {
  name: string
  state: 'up' | 'down'
  speed: number
  maxSpeed: number
  addr: string
  dhcp: boolean
  isVirtual: boolean
  zone: string
  type: string
  ipv4: NetworkIPv4Config | null
  wireless: NetworkWirelessConfig | null
  hybridCapable: boolean
}

function numOr0(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}
function strOr(v: unknown, dflt = ''): string {
  return typeof v === 'string' ? v : dflt
}

/** 共享包的 `Utilization.net` 类型是 `Record<string, unknown> | null`,而真实值是**数组**
 *  (parseUtil 的 jget 里 `typeof [] === 'object'` 原样透过)。这里收窄。
 *  **不要去改共享包那个宽类型** —— 主页/小组件都在吃它,改了波及面大。 */
export function normalizeNetStats(net: unknown): NetRuntimeStat[] {
  if (!Array.isArray(net)) return []
  const out: NetRuntimeStat[] = []
  for (const raw of net) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const name = strOr(r.name)
    if (!name) continue
    out.push({
      name,
      state: strOr(r.state),
      addr: strOr(r.addr),
      speed: numOr0(r.speed),
      max_speed: numOr0(r.max_speed),
    })
  }
  return out
}

/** 记住每张网卡的 max_speed。
 *  ⚠️ 为什么需要:同一份 net 数据两条腿字段不一致 ——
 *    HTTP  `/v1/sys/utilization`(route/v1/system.go:388)**有** item.MaxSpeed;
 *    MessageBus 5 秒推送(route/periodical.go:44-47)**没有那一行** → max_speed 恒 0(socket 实证)。
 *  速率标签是 `maxSpeed > speed ? "1 Gbps / 2.5 Gbps" : "1 Gbps"`,若直接吃推送值,
 *  2.5G 网卡协商在 1G 时标签会每 5 秒在两种形态之间闪。所以只在拿到非零值时更新。 */
export class MaxSpeedMemo {
  private m = new Map<string, number>()
  remember(stats: NetRuntimeStat[]): void {
    for (const s of stats) {
      if (s.max_speed > 0) this.m.set(s.name, s.max_speed)
    }
  }
  get(name: string): number {
    return this.m.get(name) ?? 0
  }
}

/** 前端按名字前缀判定虚拟网卡 —— **不用后端的 is_virtual 字段**(照 Vue2 L2149)。
 *  注:`data.net` 来自 GetNet(true)=只物理口,所以这个分支在本机不可达;
 *  别的机器(装了 ZeroTier 等)未必如此,故照抄保留。 */
function isVirtualName(name: string): boolean {
  return name.startsWith('zt') || name === 'docker0' || name.startsWith('br-') || name.startsWith('veth')
}

export function mergeInterfaces(
  net: unknown,
  configs: NetworkInterfaceConfig[] | null | undefined,
  memo?: MaxSpeedMemo,
): MergedIface[] {
  const stats = normalizeNetStats(net)
  memo?.remember(stats)
  const cfgs = Array.isArray(configs) ? configs : []

  const rows: MergedIface[] = []
  for (const s of stats) {
    if (s.name === VIRTUAL_AP_IFACE) continue
    const cfg = cfgs.find((c) => c && c.name === s.name)

    // 静态 IP 时以 config 的 address 覆盖显示;但 concurrent 模式的静态 IP 属于虚拟 AP 口,
    // 物理口自己是 DHCP 客户端 → 不覆盖(Vue2 L2152 的 mode !== 'concurrent' 条件)。
    const isStatic = !!cfg?.ipv4 && cfg.ipv4.method === 'static' && cfg.wireless?.mode !== 'concurrent'
    const addr = isStatic ? (cfg?.ipv4?.address || s.addr || '') : (s.addr || '')

    rows.push({
      name: s.name,
      state: s.state.trim().toLowerCase() === 'up' ? 'up' : 'down',
      speed: s.speed,
      maxSpeed: s.max_speed > 0 ? s.max_speed : (memo?.get(s.name) ?? 0),
      addr,
      dhcp: cfg?.ipv4 ? cfg.ipv4.method !== 'static' : true,
      isVirtual: isVirtualName(s.name),
      zone: cfg?.zone || '',
      type: cfg?.type || '',
      ipv4: cfg?.ipv4 ?? null,
      wireless: cfg?.wireless ?? null,
      hybridCapable: cfg?.hybridCapable || false,
    })
  }
  return rows
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test netMerge && pnpm exec vue-tsc --noEmit
```
预期:19 例全绿、tsc 0 错误。

- [ ] **Step 5: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/util/netMerge.ts src/settings/util/netMerge.test.ts
git commit src/settings/util/netMerge.ts src/settings/util/netMerge.test.ts \
  -m "feat(settings): network 接口列表合并层(utilization 为源 + max_speed memo 防闪)"
```

---

## Task 3: 展示派生 `ifaceDisplay.ts` + 44 条文案分片 + CSS

**Files:**
- Create: `src/settings/util/ifaceDisplay.ts`
- Create: `src/settings/util/ifaceDisplay.test.ts`
- Modify: `src/i18n/zh_cn.sp9.ts`(追加到对象尾部)
- Modify: `src/i18n/en_us.sp9.ts`(**同时**追加,键必须一字不差)
- Modify: `src/settings/styles/settings.css`(追加 `.set-net-*` / `.set-wifi-*` 块)

**Interfaces:**
- Consumes: Task 2 的 `MergedIface`
- Produces:
  - `ifaceTypeKey(iface: Pick<MergedIface,'name'|'type'|'isVirtual'|'wireless'>): string` —— 返回 i18n key
  - `formatSpeed(mbps: number): string`
  - `speedLabel(speed: number, maxSpeed: number): string`
  - `wirelessModeKey(wireless: NetworkWirelessConfig | null): string`(`''` = 不显示)
  - `signalBar(signal: number): string`
  - `switchTargetKey(mode: 'ap'|'client'|'concurrent'): string`
  - `SIGNAL_BARS: readonly string[]`
- **文案 key 前缀统一 `settingsNet*`**,后续任务直接用。

- [ ] **Step 1: 写失败的测试**

新建 `src/settings/util/ifaceDisplay.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ifaceTypeKey, formatSpeed, speedLabel, wirelessModeKey, signalBar, switchTargetKey, SIGNAL_BARS } from './ifaceDisplay'
import type { MergedIface } from './netMerge'

function row(p: Partial<MergedIface>): MergedIface {
  return {
    name: 'enp2s0', state: 'up', speed: 0, maxSpeed: 0, addr: '', dhcp: true,
    isVirtual: false, zone: '', type: '', ipv4: null, wireless: null, hybridCapable: false,
    ...p,
  }
}

describe('ifaceTypeKey —— 对位 Vue2 getIfaceTypeName(SettingsPanel.vue:2178-2188)', () => {
  it('虚拟口优先(先判 isVirtual,再判名字)', () => {
    expect(ifaceTypeKey(row({ name: 'docker0', isVirtual: true, type: 'bridge' }))).toBe('settingsNetTypeVirtual')
    // 名字像 wifi 但被判成虚拟(wlan_ap 已在合并层过滤,这里防御性同序)
    expect(ifaceTypeKey(row({ name: 'wlx00', isVirtual: true }))).toBe('settingsNetTypeVirtual')
  })

  it('wl / wlan 前缀 → 按 wireless.mode 分 Wi-Fi / 热点 / Wi-Fi+热点', () => {
    expect(ifaceTypeKey(row({ name: 'wlp1s0' }))).toBe('settingsNetTypeWifi')
    expect(ifaceTypeKey(row({ name: 'wlp1s0', wireless: { mode: 'client' } }))).toBe('settingsNetTypeWifi')
    expect(ifaceTypeKey(row({ name: 'wlp1s0', wireless: { mode: 'ap' } }))).toBe('settingsNetTypeHotspot')
    expect(ifaceTypeKey(row({ name: 'wlan0', wireless: { mode: 'concurrent' } }))).toBe('settingsNetTypeWifiHotspot')
  })

  it('大写网卡名也认(Vue2 先 toLowerCase)', () => {
    expect(ifaceTypeKey(row({ name: 'WLP1S0' }))).toBe('settingsNetTypeWifi')
  })

  it('type=thunderbolt → Thunderbolt;其余一律以太网', () => {
    expect(ifaceTypeKey(row({ name: 'thunderbolt0', type: 'thunderbolt' }))).toBe('settingsNetTypeThunderbolt')
    expect(ifaceTypeKey(row({ name: 'enp2s0', type: 'ethernet' }))).toBe('settingsNetTypeEthernet')
    expect(ifaceTypeKey(row({ name: 'enp4s0', type: '' }))).toBe('settingsNetTypeEthernet')
  })
})

describe('formatSpeed / speedLabel —— 对位 Vue2 formatSpeed(:2236)+ 模板 L514-516', () => {
  it('≥1000 换 Gbps(整除时不留小数,Vue2 是裸除法)', () => {
    expect(formatSpeed(1000)).toBe('1 Gbps')
    expect(formatSpeed(2500)).toBe('2.5 Gbps')
    expect(formatSpeed(10000)).toBe('10 Gbps')
  })
  it('<1000 用 Mbps', () => {
    expect(formatSpeed(100)).toBe('100 Mbps')
    expect(formatSpeed(1)).toBe('1 Mbps')
  })
  it('0 / 负数 / NaN → 空串(模板靠 v-if 隐藏整个标签)', () => {
    expect(formatSpeed(0)).toBe('')
    expect(formatSpeed(-1)).toBe('')
    expect(formatSpeed(Number.NaN)).toBe('')
  })
  it('maxSpeed 更大时显示「协商速率 / 上限」', () => {
    expect(speedLabel(1000, 2500)).toBe('1 Gbps / 2.5 Gbps')
  })
  it('maxSpeed 不大于 speed 时只显示 speed(本机 1000/1000 就是这条)', () => {
    expect(speedLabel(1000, 1000)).toBe('1 Gbps')
    expect(speedLabel(1000, 0)).toBe('1 Gbps')
  })
  it('speed 为 0 时整体空串(down 的口不显示速率标签)', () => {
    expect(speedLabel(0, 1000)).toBe('')
  })
})

describe('wirelessModeKey —— 对位 Vue2 wirelessModeLabel(:2190)', () => {
  it('三种模式各自的 key,未知/无线为空 → 空串', () => {
    expect(wirelessModeKey({ mode: 'client' })).toBe('settingsNetModeClient')
    expect(wirelessModeKey({ mode: 'ap' })).toBe('settingsNetModeAp')
    expect(wirelessModeKey({ mode: 'concurrent' })).toBe('settingsNetModeHybrid')
    expect(wirelessModeKey({ mode: 'manual' })).toBe('')
    expect(wirelessModeKey(null)).toBe('')
  })
})

describe('signalBar —— 对位 Vue2 signalIconHtml(WifiForm.vue:110-118)', () => {
  it('5 档阈值逐字照抄(用绝对值分档)', () => {
    expect(signalBar(0)).toBe(SIGNAL_BARS[4])      // >=0 → 满格
    expect(signalBar(-45)).toBe(SIGNAL_BARS[4])    // 实测 NIMO_Network
    expect(signalBar(-50)).toBe(SIGNAL_BARS[4])    // 边界:<=50
    expect(signalBar(-55)).toBe(SIGNAL_BARS[3])    // 实测 TP-LINK_12E0-5G
    expect(signalBar(-60)).toBe(SIGNAL_BARS[3])    // 边界
    expect(signalBar(-70)).toBe(SIGNAL_BARS[2])    // 边界 & 实测 ChinaNet-D2yt
    expect(signalBar(-75)).toBe(SIGNAL_BARS[1])
    expect(signalBar(-80)).toBe(SIGNAL_BARS[1])    // 边界
    expect(signalBar(-95)).toBe(SIGNAL_BARS[0])
  })
  it('五个字符就是 Vue2 的那五个(signalBars.js 逐字)', () => {
    expect(SIGNAL_BARS).toEqual(['▁', '▂', '▃', '▄', '▅'])
  })
})

describe('switchTargetKey —— 确认框里的目标模式名(Vue2 labels 表 :2200-2204)', () => {
  it('三个目标各自的 key', () => {
    expect(switchTargetKey('ap')).toBe('settingsNetTargetAp')
    expect(switchTargetKey('client')).toBe('settingsNetTargetClient')
    expect(switchTargetKey('concurrent')).toBe('settingsNetTargetHybrid')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test ifaceDisplay
```
预期:FAIL —— 模块不存在。

- [ ] **Step 3: 写 `src/settings/util/ifaceDisplay.ts`**

```ts
// 接口行 / 弹窗标题的展示派生。全部返回 **i18n key**(不返回已翻译文本),
// 让组件层去 t(),便于单测与语言切换。
// 对位 Vue2 SettingsPanel.vue 的 getIfaceTypeName / wirelessModeLabel / formatSpeed
// 与 WifiForm.vue 的 signalIconHtml。
import type { NetworkWirelessConfig } from '@nimotech/nimoos-service'
import type { MergedIface } from './netMerge'

/** 逐字照 NimoOS-UI/src/components/settings/signalBars.js */
export const SIGNAL_BARS = ['▁', '▂', '▃', '▄', '▅'] as const

type IfaceLike = Pick<MergedIface, 'name' | 'type' | 'isVirtual' | 'wireless'>

export function ifaceTypeKey(iface: IfaceLike): string {
  if (iface.isVirtual) return 'settingsNetTypeVirtual'
  const name = (iface.name || '').toLowerCase()
  if (name.startsWith('wl') || name.startsWith('wlan')) {
    if (iface.wireless?.mode === 'ap') return 'settingsNetTypeHotspot'
    if (iface.wireless?.mode === 'concurrent') return 'settingsNetTypeWifiHotspot'
    return 'settingsNetTypeWifi'
  }
  if (iface.type === 'thunderbolt') return 'settingsNetTypeThunderbolt'
  return 'settingsNetTypeEthernet'
}

/** Vue2 是 `${speedMbps / 1000} Gbps` 的裸除法 —— 2500 → "2.5 Gbps"、1000 → "1 Gbps"。
 *  照抄(不加 toFixed,否则 1000 会变成 "1.0 Gbps",与 Vue2 不一致)。 */
export function formatSpeed(mbps: number): string {
  if (!mbps || !Number.isFinite(mbps) || mbps <= 0) return ''
  if (mbps >= 1000) return `${mbps / 1000} Gbps`
  return `${mbps} Mbps`
}

/** 模板 L514-516:speed 为 0 时整个标签靠 v-if 消失;maxSpeed 更大时显示两段。 */
export function speedLabel(speed: number, maxSpeed: number): string {
  const cur = formatSpeed(speed)
  if (!cur) return ''
  return maxSpeed > speed ? `${cur} / ${formatSpeed(maxSpeed)}` : cur
}

export function wirelessModeKey(wireless: NetworkWirelessConfig | null): string {
  if (!wireless) return ''
  if (wireless.mode === 'concurrent') return 'settingsNetModeHybrid'
  if (wireless.mode === 'client') return 'settingsNetModeClient'
  if (wireless.mode === 'ap') return 'settingsNetModeAp'
  return ''
}

export function signalBar(signal: number): string {
  if (signal >= 0) return SIGNAL_BARS[4]
  const abs = Math.abs(signal)
  if (abs <= 50) return SIGNAL_BARS[4]
  if (abs <= 60) return SIGNAL_BARS[3]
  if (abs <= 70) return SIGNAL_BARS[2]
  if (abs <= 80) return SIGNAL_BARS[1]
  return SIGNAL_BARS[0]
}

export function switchTargetKey(mode: 'ap' | 'client' | 'concurrent'): string {
  if (mode === 'ap') return 'settingsNetTargetAp'
  if (mode === 'client') return 'settingsNetTargetClient'
  return 'settingsNetTargetHybrid'
}
```

- [ ] **Step 4: 文案分片 —— 44 条,两份文件同时加**

**中文一律是从 `NimoOS-UI/src/assets/lang/zh_CN.json` 抄出来的原译**(不是我译的);表里标 🆕补译 的 9 条是 **Vue2 全部 31 个语言文件都缺、中文界面下显示英文原文**、用户 2026-07-31 拍板补译的(→ 授权偏离第 8 处);标 🆕新增 的是移植纪律修正/无障碍需要的新文案。

追加到 `src/i18n/zh_cn.sp9.ts` 对象尾部:

```ts
  // ── P2 network ──(中文取自 Vue2 zh_CN.json 原译;标注处见计划 Task 3)
  settingsNetConnection: '连接',                    // 🆕补译(Vue2 无译,显示 "Connection")
  settingsNetEmpty: '未找到网络接口',                // 🆕补译
  settingsNetTypeEthernet: '以太网',                 // 🆕补译
  settingsNetTypeWifi: 'Wi-Fi',                     // 🆕补译(保留原文,品牌词)
  settingsNetTypeHotspot: '热点',                    // 🆕补译(旁证:zh_CN.json 里 AP→热点)
  settingsNetTypeWifiHotspot: 'Wi-Fi + 热点',        // 🆕补译(Vue2 是 $t('Wi-Fi')+' + '+$t('Hotspot') 拼的)
  settingsNetTypeThunderbolt: 'Thunderbolt',
  settingsNetTypeVirtual: '虚拟网络',                // 🆕补译
  settingsNetMenu: '接口操作',                       // 🆕新增(菜单按钮 aria-label,Vue2 无)
  settingsNetEdit: '编辑',
  settingsNetSwitchClient: '切换到 Wi-Fi',
  settingsNetSwitchAp: '切换到热点',
  settingsNetSwitchHybrid: '切换到混合模式',
  settingsNetSwitchTitle: '切换模式',
  settingsNetSwitchMsg: '切换到 {mode}？这将改变 {iface} 的工作模式。',   // 全角问号照抄
  settingsNetSwitchFailed: '切换模式失败',            // 🆕新增(移植纪律 #3:Vue2 只 console.error)
  settingsNetTargetAp: '热点',
  settingsNetTargetClient: '连接 WiFi',
  settingsNetTargetHybrid: 'Wi-Fi + 热点',
  settingsNetModeClient: 'Wi-Fi',
  settingsNetModeAp: '热点',
  settingsNetModeHybrid: 'Wi-Fi + 热点',
  settingsNetZone: '网络区域',
  settingsNetZoneNone: '无',
  settingsNetZoneLan: 'LAN',
  settingsNetZoneWan: 'WAN',
  settingsNetTbStatic: 'Thunderbolt 静态 IP 配置',
  settingsNetIpAddress: 'IP 地址',
  settingsNetNetmask: '子网掩码',
  settingsNetGateway: '网关',
  settingsNetDns: 'DNS 服务器',
  settingsNetIpv4Method: 'IPv4 分配',
  settingsNetIpv4Dhcp: '自动 (DHCP)',
  settingsNetIpv4Static: '手动 (静态 IP)',
  settingsNetSaveApply: '保存并应用',
  settingsNetUnconfigured: '此 Wi-Fi 接口尚未配置',
  settingsNetConnectWifi: '连接 WiFi',
  settingsNetCreateHotspot: '创建热点',
  settingsNetAvailable: '可用网络',
  settingsNetScan: '扫描',
  settingsNetScanning: '扫描中...',
  settingsNetScanHint: '点击扫描查看可用网络',
  settingsNetScanFailed: '扫描 Wi-Fi 失败',
  settingsNetConnected: '已连接',
  settingsNetSecure: '加密',                         // 🆕新增(锁图标 aria-label,Vue2 无)
  settingsNetDisconnect: '断开连接',
  settingsNetDisconnected: '已断开连接',              // 🆕补译
  settingsNetDisconnectFailed: '断开连接失败',        // 🆕补译
  settingsNetPassword: '密码',
  settingsNetAdvanced: '高级设置',
  settingsNetApSsid: '热点名称 (SSID)',
  settingsNetBand: '频段',
  settingsNetBandAuto: '自动',
  settingsNetApplied: '设置已应用',
  settingsNetApplyFailed: '应用设置失败',
  settingsNetNothingToSave: '没有可保存的配置',        // 🆕补译
```

追加到 `src/i18n/en_us.sp9.ts` 对象尾部(**英文一律是 Vue2 的 key 字面量本身**):

```ts
  // ── P2 network ──
  settingsNetConnection: 'Connection',
  settingsNetEmpty: 'No network interfaces found',
  settingsNetTypeEthernet: 'Ethernet',
  settingsNetTypeWifi: 'Wi-Fi',
  settingsNetTypeHotspot: 'Hotspot',
  settingsNetTypeWifiHotspot: 'Wi-Fi + Hotspot',
  settingsNetTypeThunderbolt: 'Thunderbolt',
  settingsNetTypeVirtual: 'Virtual Network',
  settingsNetMenu: 'Interface actions',
  settingsNetEdit: 'Edit',
  settingsNetSwitchClient: 'Switch to Client Mode',
  settingsNetSwitchAp: 'Switch to AP Mode',
  settingsNetSwitchHybrid: 'Switch to Hybrid Mode',
  settingsNetSwitchTitle: 'Switch Mode',
  settingsNetSwitchMsg: 'Switch to {mode}? This will change the wireless mode of {iface}.',
  settingsNetSwitchFailed: 'Failed to switch mode',
  settingsNetTargetAp: 'Access Point (Hotspot)',
  settingsNetTargetClient: 'Client (Connect to network)',
  settingsNetTargetHybrid: 'Client + AP',
  settingsNetModeClient: 'Client',
  settingsNetModeAp: 'AP',
  settingsNetModeHybrid: 'Client + AP',
  settingsNetZone: 'Network Zone (Firewall)',
  settingsNetZoneNone: 'None',
  settingsNetZoneLan: 'LAN (Internal Network)',
  settingsNetZoneWan: 'WAN (Internet Gateway)',
  settingsNetTbStatic: 'Thunderbolt Static IP Configuration',
  settingsNetIpAddress: 'IP Address',
  settingsNetNetmask: 'Subnet Mask',
  settingsNetGateway: 'Gateway',
  settingsNetDns: 'DNS Servers',
  settingsNetIpv4Method: 'IPv4 Assignment',
  settingsNetIpv4Dhcp: 'Automatic (DHCP)',
  settingsNetIpv4Static: 'Manual (Static)',
  settingsNetSaveApply: 'Save & Apply',
  settingsNetUnconfigured: 'This Wi-Fi interface has not been configured yet',
  settingsNetConnectWifi: 'Connect to WiFi',
  settingsNetCreateHotspot: 'Create Hotspot',
  settingsNetAvailable: 'Available Networks',
  settingsNetScan: 'Scan',
  settingsNetScanning: 'Scanning...',
  settingsNetScanHint: 'Click Scan to view available networks',
  settingsNetScanFailed: 'Failed to scan Wi-Fi',
  settingsNetConnected: 'Connected',
  settingsNetSecure: 'Secured',
  settingsNetDisconnect: 'Disconnect',
  settingsNetDisconnected: 'Disconnected',
  settingsNetDisconnectFailed: 'Failed to disconnect',
  settingsNetPassword: 'Password',
  settingsNetAdvanced: 'Advanced settings',
  settingsNetApSsid: 'Hotspot Name (SSID)',
  settingsNetBand: 'Band',
  settingsNetBandAuto: 'Auto',
  settingsNetApplied: 'Settings applied successfully',
  settingsNetApplyFailed: 'Failed to apply settings',
  settingsNetNothingToSave: 'No configuration to save',
```

**不进 i18n 的字面量**(Vue2 侧本来就是硬编码,1:1 照留,在模板里直接写并注释):
`DHCP` / `Static`(列表 IP 标签的前缀,Vue2 L518 写死)· `2.4GHz` / `5GHz`(频段选项)· `192.168.1.100` / `255.255.255.0` / `192.168.1.1` / `8.8.8.8, 1.1.1.1` / `169.254.1.1` / `255.255.0.0` / `0.0.0.0` / `192.168.22.1` / `NimoOS-Hotspot`(placeholder 与默认值)。

- [ ] **Step 5: CSS —— 追加到 `src/settings/styles/settings.css` 末尾**

**颜色全部复用既有 token,本期零新增 token**:

| 用途 | token |
|---|---|
| 卡片底/描边 | `--card-bg` / `--border` |
| 状态点 up | `--success` |
| 状态点 down | `--fg-subtle` |
| 标签(网卡名/速率/IP) | `--chip-bg` + `--chip-border` + `--fg-muted` |
| 菜单浮层 | `--popup-bg` / `--card-border` / `--card-shadow-hi` |
| 菜单项高亮 | `--chip-bg-hi` |
| 扫描列表底/描边 | `--inner-bg` / `--border` |
| 选中的 SSID 行 | `--accent-soft` |
| 「已连接」文字 | `--success` |
| 信号条 | `--fg-muted` |

```css
/* ── P2 network ─────────────────────────────────────────────────────────
 * 对位 Vue2 SettingsPanel.vue 的 .network-card / .network-iface-row /
 * .network-status-dot / .network-tag / .network-menu-btn 与 WifiForm 的
 * .wifi-scan-results / .wifi-result-row。
 * 菜单样式**故意不复用** apps/components/AppActionsMenu.vue 的 .ui-drop-*:
 * 那是非 scoped 全局块,只在该组件被 import 时注入,设置区不 import 它 → 会裸奔。 */
.set-net-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.set-net-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
}
.set-net-row:not(:last-child) { border-bottom: 1px solid var(--border); }
.set-net-dot {
  width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto;
  background: var(--fg-subtle);
}
.set-net-dot.up { background: var(--success); }
.set-net-main { flex: 1 1 auto; min-width: 0; }
.set-net-type { font-size: 14px; font-weight: 500; margin-bottom: 6px; }
.set-net-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.set-net-tag {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 999px; font-size: 11px;
  background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--fg-muted);
}
.set-net-tag-key { opacity: 0.7; }
.set-net-menu-btn {
  width: 28px; height: 28px; flex: 0 0 auto;
  border: none; border-radius: 8px; cursor: pointer;
  background: transparent; color: var(--fg-muted); font-size: 16px; line-height: 1;
}
.set-net-menu-btn:hover { background: var(--chip-bg-hi); color: var(--fg); }
.set-net-menu-spacer { width: 28px; flex: 0 0 auto; }
.set-net-menu {
  min-width: 180px; padding: 6px; border-radius: 14px; z-index: 1100;
  background: var(--popup-bg); border: 1px solid var(--card-border);
  backdrop-filter: blur(20px); box-shadow: var(--card-shadow-hi); color: var(--fg);
}
.set-net-menu-item {
  display: flex; align-items: center; padding: 8px 12px; border-radius: 9px;
  font-size: 13px; cursor: pointer; user-select: none; outline: none;
}
.set-net-menu-item[data-highlighted] { background: var(--chip-bg-hi); }
.set-net-empty { padding: 28px 16px; text-align: center; color: var(--fg-muted); font-size: 12px; }
.set-net-loading { padding: 28px 16px; text-align: center; color: var(--fg-muted); font-size: 12px; }

/* ── 弹窗内的表单 ── */
.set-net-form { display: flex; flex-direction: column; gap: 14px; min-width: min(460px, 84vw); }
.set-net-field { display: flex; flex-direction: column; gap: 6px; }
.set-net-label { font-size: 12px; color: var(--fg-muted); }
.set-net-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 4px; }
.set-net-tab {
  padding: 6px 16px; font-size: 13px; cursor: pointer;
  background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--fg-muted);
}
.set-net-tab.on { color: var(--fg); border-bottom-color: var(--accent); }
.set-net-adv {
  display: flex; align-items: center; gap: 6px; padding: 8px 0; margin-top: 4px;
  border-top: 1px solid var(--border); background: transparent; border-left: none;
  border-right: none; border-bottom: none; width: 100%;
  font-size: 12px; color: var(--fg-muted); cursor: pointer; user-select: none;
}
.set-net-adv:hover { color: var(--fg); }
.set-net-hint { font-size: 12px; color: var(--fg-muted); margin: 0; }
.set-net-choose { display: flex; justify-content: center; gap: 12px; padding: 24px 0; }

/* ── Wi-Fi 扫描结果 ── */
.set-wifi-list {
  max-height: 200px; overflow-y: auto;
  border: 1px solid var(--border); border-radius: var(--radius-xs); background: var(--inner-bg);
}
.set-wifi-row {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 8px 12px; border: none; background: transparent; color: var(--fg);
  font-size: 13px; text-align: left; cursor: pointer;
}
.set-wifi-row:hover { background: var(--chip-bg-hi); }
.set-wifi-row.on { background: var(--accent-soft); }
.set-wifi-bar { min-width: 30px; text-align: center; color: var(--fg-muted); font-size: 14px; }
.set-wifi-ssid { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.set-wifi-flag { font-size: 11px; color: var(--success); flex: 0 0 auto; }
.set-wifi-lock { font-size: 11px; color: var(--fg-muted); flex: 0 0 auto; }
.set-wifi-empty { padding: 20px 12px; text-align: center; color: var(--fg-muted); font-size: 12px; }
```

- [ ] **Step 6: 跑测试(含 parity 与 color-guard)**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test ifaceDisplay parity color-guard && pnpm exec vue-tsc --noEmit
```
预期:ifaceDisplay 17 例全绿;`parity.test.ts` 绿(两份分片键完全一致、值都是字符串);`color-guard.test.ts` 绿(新增 CSS 里零裸色值)。
**若 parity 红** → 两份分片的键对不上,逐字比对;**若 color-guard 红** → 找到那条裸色值改成 token。

- [ ] **Step 7: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/util/ifaceDisplay.ts src/settings/util/ifaceDisplay.test.ts
git commit src/settings/util/ifaceDisplay.ts src/settings/util/ifaceDisplay.test.ts \
  src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts src/settings/styles/settings.css \
  -m "feat(settings): network 展示派生 + 44 条文案分片 + 列表/扫描样式"
```

---

## Task 4: `ifaceForm.ts` —— 表单 hydrate 与 PUT payload 构造(写路径的唯一保障)

> ⚠️ **本任务是整期最重要的测试点。** 按 §写路径禁令,`updateInterface` 在本机一次都不许真发 —— 所以「保存下发什么」的正确性**只能靠这里的单测**。Vue2 的 `watch.iface`(`NetworkIfaceConfigModal.vue:191-299`,108 行)与 `save()`(`:359-422`,63 行)要逐条对位搬进纯函数。

**Files:**
- Create: `src/settings/util/ifaceForm.ts`
- Create: `src/settings/util/ifaceForm.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `NetworkInterfaceUpdate`,Task 2 的 `MergedIface`
- Produces:
  - `interface IfaceFormState { name: string; zone: string; ipv4: { method: string; address: string; netmask: string; gateway: string }; dnsText: string; wireless: { mode: string; ssid: string; apSsid: string; password: string; apPassword: string; channel: number } }`
  - `createFormState(): IfaceFormState`
  - `type HydrateOpts = { switchMode?: 'ap' | 'client' | 'concurrent'; switchTab?: 'hybrid' }`
  - `hydrateForm(iface: MergedIface, opts?: HydrateOpts): IfaceFormState`
  - `type BuildResult = { ok: true; payload: NetworkInterfaceUpdate } | { ok: false; reason: 'nothing-to-save' }`
  - `buildUpdatePayload(form: IfaceFormState, iface: Pick<MergedIface,'name'|'type'>): BuildResult`
  - `isWifiName(name: string): boolean` / `isThunderboltType(type: string): boolean`
  - `parseDnsList(text: string): string[]` / `formatDnsList(dns?: string[] | null): string`
  - `AP_DEFAULTS = { ssid: 'NimoOS-Hotspot', address: '192.168.22.1', netmask: '255.255.255.0' }`

- [ ] **Step 1: 写失败的测试(第一批:hydrate)**

新建 `src/settings/util/ifaceForm.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  createFormState, hydrateForm, buildUpdatePayload, isWifiName, isThunderboltType,
  parseDnsList, formatDnsList, AP_DEFAULTS,
} from './ifaceForm'
import type { MergedIface } from './netMerge'

function iface(p: Partial<MergedIface>): MergedIface {
  return {
    name: 'enp2s0', state: 'up', speed: 1000, maxSpeed: 1000, addr: '192.168.1.143', dhcp: true,
    isVirtual: false, zone: '', type: 'ethernet', ipv4: null, wireless: null, hybridCapable: false,
    ...p,
  }
}

describe('isWifiName / isThunderboltType', () => {
  it('照 Vue2 的 /^wl|^wlan/i —— 大小写不敏感', () => {
    expect(isWifiName('wlp1s0')).toBe(true)
    expect(isWifiName('wlan0')).toBe(true)
    expect(isWifiName('WLP1S0')).toBe(true)
    expect(isWifiName('enp2s0')).toBe(false)
    expect(isWifiName('')).toBe(false)
  })
  it('thunderbolt 看 config 的 type 字段', () => {
    expect(isThunderboltType('thunderbolt')).toBe(true)
    expect(isThunderboltType('ethernet')).toBe(false)
    expect(isThunderboltType('')).toBe(false)
  })
})

describe('parseDnsList / formatDnsList', () => {
  it('逗号分隔、去空白、丢空项', () => {
    expect(parseDnsList('8.8.8.8, 1.1.1.1')).toEqual(['8.8.8.8', '1.1.1.1'])
    expect(parseDnsList(' 8.8.8.8 ,, ')).toEqual(['8.8.8.8'])
    expect(parseDnsList('')).toEqual([])
  })
  it('回显用 ", " 连接,null/undefined → 空串', () => {
    expect(formatDnsList(['8.8.8.8', '1.1.1.1'])).toBe('8.8.8.8, 1.1.1.1')
    expect(formatDnsList([])).toBe('')
    expect(formatDnsList(null)).toBe('')
    expect(formatDnsList(undefined)).toBe('')
  })
})

describe('hydrateForm —— 以太网(本机唯一真能点开的形态)', () => {
  it('config 里是 dhcp 的以太网:原样带出,zone 空,wireless.mode 空', () => {
    const f = hydrateForm(iface({ ipv4: { method: 'dhcp' } }))
    expect(f.name).toBe('enp2s0')
    expect(f.zone).toBe('')
    expect(f.ipv4).toEqual({ method: 'dhcp', address: '', netmask: '', gateway: '' })
    expect(f.dnsText).toBe('')
    expect(f.wireless.mode).toBe('')
  })

  it('静态 IP 的以太网:四个字段 + DNS 全部带出', () => {
    const f = hydrateForm(iface({
      zone: 'lan',
      ipv4: { method: 'static', address: '192.168.1.250', netmask: '255.255.255.0', gateway: '192.168.1.1', dns: ['8.8.8.8', '1.1.1.1'] },
    }))
    expect(f.zone).toBe('lan')
    expect(f.ipv4).toEqual({ method: 'static', address: '192.168.1.250', netmask: '255.255.255.0', gateway: '192.168.1.1' })
    expect(f.dnsText).toBe('8.8.8.8, 1.1.1.1')
  })

  it('config 里完全没有这张网卡(ipv4=null):method 兜底 dhcp,不炸', () => {
    const f = hydrateForm(iface({ name: 'wlp1s0', ipv4: null, type: '' }))
    expect(f.ipv4.method).toBe('dhcp')
    expect(f.wireless.mode).toBe('')
  })

  it('ipv4.method 是空串时兜底 dhcp(Vue2 `|| \'dhcp\'`)', () => {
    const f = hydrateForm(iface({ ipv4: { method: '' } }))
    expect(f.ipv4.method).toBe('dhcp')
  })
})

describe('hydrateForm —— Wi-Fi 三种模式的 zone/IP 默认值(Vue2 :199-287 逐条)', () => {
  it('ap:zone 强制 lan、method 强制 static、缺地址时给 192.168.22.1/24、缺 SSID 时给 NimoOS-Hotspot', () => {
    const f = hydrateForm(iface({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'ap' } }))
    expect(f.zone).toBe('lan')
    expect(f.ipv4.method).toBe('static')
    expect(f.ipv4.address).toBe(AP_DEFAULTS.address)
    expect(f.ipv4.netmask).toBe(AP_DEFAULTS.netmask)
    expect(f.wireless.apSsid).toBe(AP_DEFAULTS.ssid)
    expect(f.wireless.apPassword).toBe('')
  })

  it('ap:已有 apSsid / 地址时不覆盖', () => {
    const f = hydrateForm(iface({
      name: 'wlp1s0', type: 'wifi',
      ipv4: { method: 'static', address: '10.9.8.1', netmask: '255.255.255.0' },
      wireless: { mode: 'ap', apSsid: 'MyAP', apPassword: 'secret', channel: 6 },
    }))
    expect(f.wireless.apSsid).toBe('MyAP')
    expect(f.wireless.apPassword).toBe('secret')
    expect(f.wireless.channel).toBe(6)
    expect(f.ipv4.address).toBe('10.9.8.1')
  })

  it('client:zone 强制 wan、IP 强制回 dhcp 并清空静态残留(处理从 ap 切回来的脏值)', () => {
    const f = hydrateForm(iface({
      name: 'wlp1s0', type: 'wifi', zone: 'lan',
      ipv4: { method: 'static', address: '192.168.22.1', netmask: '255.255.255.0', gateway: '1.1.1.1', dns: ['8.8.8.8'] },
      wireless: { mode: 'client', ssid: 'NIMO_Network', password: 'p' },
    }))
    expect(f.zone).toBe('wan')
    expect(f.ipv4).toEqual({ method: 'dhcp', address: '', netmask: '', gateway: '' })
    expect(f.dnsText).toBe('')
    expect(f.wireless.ssid).toBe('NIMO_Network')
    expect(f.wireless.password).toBe('p')
  })

  it('concurrent:zone=wan 且 method=static(那个静态 IP 是虚拟 AP 口的)', () => {
    const f = hydrateForm(iface({
      name: 'wlp1s0', type: 'wifi',
      wireless: { mode: 'concurrent', ssid: 'up', apSsid: 'down' },
    }))
    expect(f.zone).toBe('wan')
    expect(f.ipv4.method).toBe('static')
    expect(f.ipv4.address).toBe(AP_DEFAULTS.address)
    expect(f.wireless.ssid).toBe('up')
    expect(f.wireless.apSsid).toBe('down')
  })

  it('非 wifi 网卡即使 config 里带 wireless 也不读进 wireless(Vue2 `isWifi && val.wireless`)', () => {
    const f = hydrateForm(iface({ name: 'enp2s0', wireless: { mode: 'ap', apSsid: 'X' } }))
    expect(f.wireless.mode).toBe('')
    expect(f.wireless.apSsid).toBe('')
    // 但 zone 那段 Vue2 是**不看 isWifi** 的 —— ap 仍会把 zone 顶成 lan,照抄
    expect(f.zone).toBe('lan')
  })
})

describe('hydrateForm —— 切模式入口(_switchMode / _switchTab)', () => {
  it('switchMode=ap:清空旧模式字段,zone=lan,给 AP 默认值', () => {
    const f = hydrateForm(
      iface({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client', ssid: 'old', password: 'oldpw' } }),
      { switchMode: 'ap' },
    )
    expect(f.wireless.mode).toBe('ap')
    expect(f.wireless.ssid).toBe('')
    expect(f.wireless.password).toBe('')
    expect(f.zone).toBe('lan')
    expect(f.wireless.apSsid).toBe(AP_DEFAULTS.ssid)
    expect(f.ipv4.method).toBe('static')
  })

  it('switchMode=client:清空 AP 字段 + IP 回 dhcp + zone=wan', () => {
    const f = hydrateForm(
      iface({
        name: 'wlp1s0', type: 'wifi', zone: 'lan',
        ipv4: { method: 'static', address: '192.168.22.1', netmask: '255.255.255.0' },
        wireless: { mode: 'ap', apSsid: 'MyAP', apPassword: 'pw', channel: 36 },
      }),
      { switchMode: 'client' },
    )
    expect(f.wireless.mode).toBe('client')
    expect(f.wireless.apSsid).toBe('')
    expect(f.wireless.apPassword).toBe('')
    expect(f.wireless.channel).toBe(0)
    expect(f.zone).toBe('wan')
    expect(f.ipv4).toEqual({ method: 'dhcp', address: '', netmask: '', gateway: '' })
  })

  it('switchTab=hybrid:mode=concurrent、zone=wan,**两边已有数据都保留**(Vue2 注释 Keep existing data)', () => {
    const f = hydrateForm(
      iface({
        name: 'wlp1s0', type: 'wifi',
        wireless: { mode: 'client', ssid: 'NIMO_Network', password: 'pw', apSsid: 'MyAP', apPassword: 'appw' },
      }),
      { switchTab: 'hybrid' },
    )
    expect(f.wireless.mode).toBe('concurrent')
    expect(f.zone).toBe('wan')
    expect(f.wireless.ssid).toBe('NIMO_Network')
    expect(f.wireless.password).toBe('pw')
    expect(f.wireless.apSsid).toBe('MyAP')
    expect(f.wireless.apPassword).toBe('appw')
  })

  it('createFormState 的初值与 Vue2 data() 一致', () => {
    expect(createFormState()).toEqual({
      name: '', zone: '',
      ipv4: { method: 'dhcp', address: '', netmask: '', gateway: '' },
      dnsText: '',
      wireless: { mode: '', ssid: '', apSsid: '', password: '', apPassword: '', channel: 0 },
    })
  })
})
```

- [ ] **Step 2: 写失败的测试(第二批:payload)**

追加到同一个文件:

```ts
describe('buildUpdatePayload —— 以太网', () => {
  it('dhcp:只下发 name/zone/ipv4.method,不带静态字段', () => {
    const f = hydrateForm(iface({ ipv4: { method: 'dhcp' } }))
    const r = buildUpdatePayload(f, iface({}))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.payload).toEqual({ name: 'enp2s0', zone: '', ipv4: { method: 'dhcp' } })
    expect('wireless' in r.payload).toBe(false)
  })

  it('static:带 address/netmask/gateway/dns', () => {
    const f = hydrateForm(iface({
      zone: 'lan',
      ipv4: { method: 'static', address: '192.168.1.250', netmask: '255.255.255.0', gateway: '192.168.1.1', dns: ['8.8.8.8'] },
    }))
    const r = buildUpdatePayload(f, iface({}))
    if (!r.ok) throw new Error('should build')
    expect(r.payload).toEqual({
      name: 'enp2s0', zone: 'lan',
      ipv4: { method: 'static', address: '192.168.1.250', netmask: '255.255.255.0', gateway: '192.168.1.1', dns: ['8.8.8.8'] },
    })
  })

  it('用户在高级设置里填的 DNS 会真的下发 —— 移植纪律 #1(Vue2 这里静默丢了)', () => {
    const f = hydrateForm(iface({ ipv4: { method: 'static', address: '10.0.0.2', netmask: '255.255.255.0' } }))
    f.dnsText = ' 9.9.9.9 , 1.1.1.1 '
    const r = buildUpdatePayload(f, iface({}))
    if (!r.ok) throw new Error('should build')
    expect(r.payload.ipv4?.dns).toEqual(['9.9.9.9', '1.1.1.1'])
  })
})

describe('buildUpdatePayload —— Thunderbolt', () => {
  it('恒 static,四字段 + dns 全下发', () => {
    const tb = iface({ name: 'tb0', type: 'thunderbolt' })
    const f = hydrateForm(tb)
    f.ipv4.address = '169.254.1.1'
    f.ipv4.netmask = '255.255.0.0'
    f.ipv4.gateway = '0.0.0.0'
    f.dnsText = '8.8.8.8'
    const r = buildUpdatePayload(f, tb)
    if (!r.ok) throw new Error('should build')
    expect(r.payload.ipv4).toEqual({
      method: 'static', address: '169.254.1.1', netmask: '255.255.0.0', gateway: '0.0.0.0', dns: ['8.8.8.8'],
    })
    expect('wireless' in r.payload).toBe(false)
  })
})

describe('buildUpdatePayload —— Wi-Fi 三种模式', () => {
  const wifi = iface({ name: 'wlp1s0', type: 'wifi' })

  it('client:wireless 只带 mode/ssid/password;ipv4 走 method(dhcp)', () => {
    const f = hydrateForm(iface({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } }))
    f.wireless.ssid = 'NIMO_Network'
    f.wireless.password = 'pw'
    const r = buildUpdatePayload(f, wifi)
    if (!r.ok) throw new Error('should build')
    expect(r.payload).toEqual({
      name: 'wlp1s0', zone: 'wan',
      ipv4: { method: 'dhcp' },
      wireless: { mode: 'client', ssid: 'NIMO_Network', password: 'pw' },
    })
  })

  it('ap:ipv4 强制 static 并对空值兜底 192.168.22.1/24;wireless 带 apSsid/apPassword', () => {
    const f = hydrateForm(iface({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'ap' } }))
    f.ipv4.address = ''      // 用户把地址清空了
    f.ipv4.netmask = ''
    const r = buildUpdatePayload(f, wifi)
    if (!r.ok) throw new Error('should build')
    expect(r.payload.ipv4).toEqual({
      method: 'static', address: '192.168.22.1', netmask: '255.255.255.0', gateway: '', dns: [],
    })
    expect(r.payload.wireless).toEqual({ mode: 'ap', apSsid: 'NimoOS-Hotspot', apPassword: '' })
  })

  it('ap:channel > 0 才下发(0=自动,Vue2 判 `> 0`)', () => {
    const f = hydrateForm(iface({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'ap', apSsid: 'X' } }))
    f.wireless.channel = 0
    const auto = buildUpdatePayload(f, wifi)
    if (!auto.ok) throw new Error('should build')
    expect('channel' in (auto.payload.wireless ?? {})).toBe(false)

    f.wireless.channel = 36
    const fixed = buildUpdatePayload(f, wifi)
    if (!fixed.ok) throw new Error('should build')
    expect(fixed.payload.wireless?.channel).toBe(36)
  })

  it('concurrent:client 与 AP 两组字段**同时**下发,ipv4 static', () => {
    const f = hydrateForm(iface({
      name: 'wlp1s0', type: 'wifi',
      wireless: { mode: 'concurrent', ssid: 'NIMO_Network', password: 'cpw', apSsid: 'MyAP', apPassword: 'appw' },
    }))
    const r = buildUpdatePayload(f, wifi)
    if (!r.ok) throw new Error('should build')
    expect(r.payload.wireless).toEqual({
      mode: 'concurrent', ssid: 'NIMO_Network', password: 'cpw', apSsid: 'MyAP', apPassword: 'appw',
    })
    expect(r.payload.ipv4?.method).toBe('static')
    expect(r.payload.zone).toBe('wan')
  })

  it('wifi 但 mode 为空 / manual → 不构造 payload(界面提示「没有可保存的配置」)', () => {
    const empty = buildUpdatePayload(hydrateForm(wifi), wifi)
    expect(empty).toEqual({ ok: false, reason: 'nothing-to-save' })

    const manual = hydrateForm(wifi)
    manual.wireless.mode = 'manual'
    expect(buildUpdatePayload(manual, wifi)).toEqual({ ok: false, reason: 'nothing-to-save' })
  })

  it('client 模式下 ssid/password 为空也下发空串(Vue2 `|| \'\'`,用于断连语义)', () => {
    const f = hydrateForm(iface({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } }))
    const r = buildUpdatePayload(f, wifi)
    if (!r.ok) throw new Error('should build')
    expect(r.payload.wireless).toEqual({ mode: 'client', ssid: '', password: '' })
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test ifaceForm
```
预期:FAIL —— 模块不存在。

- [ ] **Step 4: 写 `src/settings/util/ifaceForm.ts`**

```ts
// 接口配置弹窗的表单状态与 PUT payload 构造。
// 逐条对位 Vue2 NetworkIfaceConfigModal.vue 的 watch.iface(:191-299)与 save()(:359-422)。
//
// 为什么全抽成纯函数:PUT /v2/nimoos/network/interfaces 在开发机上**一次都不能真发**
// (后端 handler 末尾无条件 ApplyGatewayConfig() 重写 dnsmasq/nftables/ip_forward,
//  而这台机器的 SSH 生命线就是被配置的那张网卡)→ 写路径的正确性只能靠这里的单测。
//
// 移植纪律 #1(登记):Vue2 的 WifiForm/HotspotForm 各自持有一份 dnsString、改了从不回写父层,
// 而 save() 用的是父层那份 → **高级设置里填的 DNS 被静默丢弃**。这里 DNS 统一由 form.dnsText
// 持有,子表单通过 v-model 双向绑定,不再有第二份。
import type { NetworkInterfaceUpdate } from '@nimotech/nimoos-service'
import type { MergedIface } from './netMerge'

/** Vue2 的热点默认值(NetworkIfaceConfigModal.vue:260/267-268/306/309-310)。 */
export const AP_DEFAULTS = {
  ssid: 'NimoOS-Hotspot',
  address: '192.168.22.1',
  netmask: '255.255.255.0',
} as const

export interface IfaceFormState {
  name: string
  zone: string
  ipv4: { method: string; address: string; netmask: string; gateway: string }
  /** DNS 在表单里是一行逗号分隔文本,只在下发时才 split(Vue2 的 dnsString 同义) */
  dnsText: string
  wireless: { mode: string; ssid: string; apSsid: string; password: string; apPassword: string; channel: number }
}

export type HydrateOpts = { switchMode?: 'ap' | 'client' | 'concurrent'; switchTab?: 'hybrid' }

export type BuildResult =
  | { ok: true; payload: NetworkInterfaceUpdate }
  | { ok: false; reason: 'nothing-to-save' }

/** 照 Vue2 `/^wl|^wlan/i`(两个分支等价于 ^wl,原样保留语义)。 */
export function isWifiName(name: string): boolean {
  return /^wl/i.test(name || '')
}

export function isThunderboltType(type: string): boolean {
  return type === 'thunderbolt'
}

export function parseDnsList(text: string): string[] {
  return (text || '').split(',').map((s) => s.trim()).filter((s) => s)
}

export function formatDnsList(dns?: string[] | null): string {
  return (dns || []).join(', ')
}

export function createFormState(): IfaceFormState {
  return {
    name: '',
    zone: '',
    ipv4: { method: 'dhcp', address: '', netmask: '', gateway: '' },
    dnsText: '',
    wireless: { mode: '', ssid: '', apSsid: '', password: '', apPassword: '', channel: 0 },
  }
}

export function hydrateForm(iface: MergedIface, opts: HydrateOpts = {}): IfaceFormState {
  const f = createFormState()
  const isWifi = isWifiName(iface.name)

  f.name = iface.name
  f.zone = iface.zone || ''

  // AP 强制 LAN;client/concurrent 在 zone 未设时默认 WAN。
  // ⚠️ Vue2 这一段**不看 isWifi**(只看 config 里有没有 wireless)——照抄,别"修正"。
  if (iface.wireless) {
    if (iface.wireless.mode === 'ap') {
      f.zone = 'lan'
    } else if ((iface.wireless.mode === 'client' || iface.wireless.mode === 'concurrent') && !f.zone) {
      f.zone = 'wan'
    }
  }

  if (iface.ipv4) {
    f.ipv4.method = iface.ipv4.method || 'dhcp'
    f.ipv4.address = iface.ipv4.address || ''
    f.ipv4.netmask = iface.ipv4.netmask || ''
    f.ipv4.gateway = iface.ipv4.gateway || ''
    f.dnsText = formatDnsList(iface.ipv4.dns)
  }

  if (isWifi && iface.wireless) {
    f.wireless.mode = iface.wireless.mode || ''
    f.wireless.ssid = iface.wireless.ssid || ''
    f.wireless.apSsid = iface.wireless.apSsid || ''
    f.wireless.password = iface.wireless.password || ''
    f.wireless.apPassword = iface.wireless.apPassword || ''
    f.wireless.channel = iface.wireless.channel || 0
  }

  // 用户显式切模式(ap↔client):清掉上一个模式的字段
  if (opts.switchMode) {
    f.wireless.mode = opts.switchMode
    f.wireless.ssid = ''
    f.wireless.password = ''
    f.wireless.apSsid = ''
    f.wireless.apPassword = ''
    f.wireless.channel = 0
    if (opts.switchMode === 'client') {
      f.ipv4.method = 'dhcp'
      f.ipv4.address = ''
      f.ipv4.netmask = ''
      f.ipv4.gateway = ''
      f.dnsText = ''
    }
    if (opts.switchMode === 'ap') f.zone = 'lan'
    else if (opts.switchMode === 'concurrent') f.zone = 'wan'
  }

  // 混合模式:两边数据都保留
  if (opts.switchTab === 'hybrid') {
    f.wireless.mode = 'concurrent'
    f.zone = 'wan'
  }

  // 按最终模式补默认值(顺序照 Vue2 :259-287,后面的会覆盖前面的)
  if (f.wireless.mode === 'ap' && !f.wireless.apSsid) {
    f.wireless.apSsid = AP_DEFAULTS.ssid
    f.wireless.apPassword = ''
  }
  if (f.wireless.mode === 'ap' || f.wireless.mode === 'concurrent') {
    f.zone = f.wireless.mode === 'ap' ? 'lan' : 'wan'
    f.ipv4.method = 'static'
    if (!f.ipv4.address) {
      f.ipv4.address = AP_DEFAULTS.address
      f.ipv4.netmask = AP_DEFAULTS.netmask
    }
  }
  // client 恒 DHCP + WAN —— 清掉从 AP 模式残留的静态 IP / zone
  if (f.wireless.mode === 'client') {
    f.zone = 'wan'
    f.ipv4.method = 'dhcp'
    f.ipv4.address = ''
    f.ipv4.netmask = ''
    f.ipv4.gateway = ''
    f.dnsText = ''
  }

  return f
}

export function buildUpdatePayload(form: IfaceFormState, iface: Pick<MergedIface, 'name' | 'type'>): BuildResult {
  const isWifi = isWifiName(iface.name)
  const isTb = isThunderboltType(iface.type)
  const payload: NetworkInterfaceUpdate = { name: form.name, zone: form.zone }

  if (isWifi) {
    const mode = form.wireless.mode
    if (!mode || mode === 'manual') return { ok: false, reason: 'nothing-to-save' }
    payload.wireless = { mode }
  }

  const dns = parseDnsList(form.dnsText)

  if (isTb) {
    payload.ipv4 = {
      method: 'static',
      address: form.ipv4.address,
      netmask: form.ipv4.netmask,
      gateway: form.ipv4.gateway,
      dns,
    }
  } else if (isWifi && (form.wireless.mode === 'ap' || form.wireless.mode === 'concurrent')) {
    payload.ipv4 = {
      method: 'static',
      address: form.ipv4.address || AP_DEFAULTS.address,
      netmask: form.ipv4.netmask || AP_DEFAULTS.netmask,
      gateway: form.ipv4.gateway,
      dns,
    }
  } else {
    // 以太网,或 wifi client 模式
    payload.ipv4 = { method: form.ipv4.method }
    if (form.ipv4.method === 'static') {
      payload.ipv4.address = form.ipv4.address
      payload.ipv4.netmask = form.ipv4.netmask
      payload.ipv4.gateway = form.ipv4.gateway
      payload.ipv4.dns = dns
    }
  }

  if (isWifi && payload.wireless) {
    if (form.wireless.mode === 'client' || form.wireless.mode === 'concurrent') {
      payload.wireless.ssid = form.wireless.ssid || ''
      payload.wireless.password = form.wireless.password || ''
    }
    if (form.wireless.mode === 'ap' || form.wireless.mode === 'concurrent') {
      payload.wireless.apSsid = form.wireless.apSsid
      payload.wireless.apPassword = form.wireless.apPassword || ''
      if (form.wireless.channel > 0) payload.wireless.channel = form.wireless.channel
    }
  }

  return { ok: true, payload }
}
```

- [ ] **Step 5: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test ifaceForm && pnpm exec vue-tsc --noEmit
```
预期:26 例全绿、tsc 0 错误。

- [ ] **Step 6: 变异验证(证明测试真在守 payload)**

手动做 3 次改动,每次跑 `pnpm test ifaceForm`,确认**都会红**,然后改回:
1. `buildUpdatePayload` 里把 `payload.ipv4.dns = dns` 那行删掉 → 「DNS 会真的下发」那条必须红(这条守的正是移植纪律 #1)。
2. 把 `if (form.wireless.channel > 0)` 改成无条件下发 → channel 那条必须红。
3. 把 `nothing-to-save` 的判断去掉 → 空 mode 那条必须红。

**把 3 次结果记进台账**(P1 的教训:没做变异验证的守卫可能是空转的)。

- [ ] **Step 7: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/util/ifaceForm.ts src/settings/util/ifaceForm.test.ts
git commit src/settings/util/ifaceForm.ts src/settings/util/ifaceForm.test.ts \
  -m "feat(settings): network 表单 hydrate 与 PUT payload 构造(纯函数,含 DNS 丢写修正)"
```

---

## Task 5: `NetworkIfaceRow.vue` —— 接口行 + 溢出菜单

**Files:**
- Create: `src/settings/panels/network/NetworkIfaceRow.vue`
- Create: `src/settings/panels/network/NetworkIfaceRow.test.ts`

**Interfaces:**
- Consumes: Task 2 `MergedIface`,Task 3 `ifaceTypeKey` / `speedLabel` + `settingsNet*` 文案 + `.set-net-*` 样式
- Produces:
  - 组件 props:`{ iface: MergedIface }`
  - emits:`edit: []` · `switchMode: ['ap' | 'client' | 'concurrent']`

- [ ] **Step 1: 写失败的测试**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'
import NetworkIfaceRow from './NetworkIfaceRow.vue'
import type { MergedIface } from '../../util/netMerge'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

// 菜单经 reka DropdownMenuPortal 渲染,且真实 DropdownMenuItem 会 inject MenuRootContext
// (stub 掉 Root 后挂载会抛 "must be used within MenuRoot")→ 照 InstalledAppCard.test.ts 的
// 先例把 Root/Trigger/Portal/Content/Item 一起 stub,只验「渲染哪些项 + 点击 emit」这层条件逻辑;
// 浮层定位与键盘导航留实机看。
const MenuRootStub = { template: '<div class="menu-root"><slot /></div>' }
const PassThroughStub = { template: '<div><slot /></div>' }
const TriggerStub = { template: '<button class="menu-trigger"><slot /></button>' }
const ItemStub = { emits: ['select'], template: '<div class="menu-item" @click="$emit(\'select\')"><slot /></div>' }

function row(p: Partial<MergedIface> = {}): MergedIface {
  return {
    name: 'enp2s0', state: 'up', speed: 1000, maxSpeed: 1000, addr: '192.168.1.143', dhcp: true,
    isVirtual: false, zone: '', type: 'ethernet', ipv4: { method: 'dhcp' }, wireless: null, hybridCapable: false,
    ...p,
  }
}

function mountRow(iface: Partial<MergedIface> = {}) {
  return mount(NetworkIfaceRow, {
    props: { iface: row(iface) },
    global: {
      plugins: [i18n],
      stubs: {
        DropdownMenuRoot: MenuRootStub, DropdownMenuTrigger: TriggerStub,
        DropdownMenuPortal: PassThroughStub, DropdownMenuContent: PassThroughStub,
        DropdownMenuItem: ItemStub,
      },
    },
  })
}

describe('NetworkIfaceRow —— 展示(对位 Vue2 SettingsPanel.vue L500-577)', () => {
  it('以太网:类型名「以太网」+ 网卡名标签 + 速率标签 + DHCP+IP 标签', () => {
    const w = mountRow()
    expect(w.text()).toContain('以太网')
    const tags = w.findAll('.set-net-tag').map((t) => t.text())
    expect(tags[0]).toBe('enp2s0')
    expect(tags[1]).toBe('1 Gbps')
    expect(tags[2]).toContain('DHCP')
    expect(tags[2]).toContain('192.168.1.143')
  })

  it('静态 IP 的标签前缀是 Static(Vue2 写死英文字面量,照留)', () => {
    const w = mountRow({ dhcp: false, addr: '192.168.1.250' })
    expect(w.findAll('.set-net-tag')[2].text()).toContain('Static')
  })

  it('state=up 时状态点带 .up,down 时不带', () => {
    expect(mountRow({ state: 'up' }).get('.set-net-dot').classes()).toContain('up')
    expect(mountRow({ state: 'down' }).get('.set-net-dot').classes()).not.toContain('up')
  })

  it('speed=0 的口不渲染速率标签;addr 空的口不渲染 IP 标签', () => {
    const w = mountRow({ speed: 0, maxSpeed: 0, addr: '' })
    const tags = w.findAll('.set-net-tag')
    expect(tags).toHaveLength(1)
    expect(tags[0].text()).toBe('enp2s0')
  })

  it('maxSpeed 大于 speed 时显示两段', () => {
    expect(mountRow({ speed: 1000, maxSpeed: 2500 }).findAll('.set-net-tag')[1].text()).toBe('1 Gbps / 2.5 Gbps')
  })

  it('wifi 按模式显示类型名', () => {
    expect(mountRow({ name: 'wlp1s0', type: 'wifi' }).text()).toContain('Wi-Fi')
    expect(mountRow({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'ap' } }).text()).toContain('热点')
    expect(mountRow({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'concurrent' } }).text()).toContain('Wi-Fi + 热点')
  })

  it('虚拟口:显示「虚拟网络」、**没有菜单按钮**、有占位保持对齐', () => {
    const w = mountRow({ name: 'docker0', isVirtual: true, type: 'bridge' })
    expect(w.text()).toContain('虚拟网络')
    expect(w.find('.menu-trigger').exists()).toBe(false)
    expect(w.find('.set-net-menu-spacer').exists()).toBe(true)
  })
})

describe('NetworkIfaceRow —— 菜单项按模式变化(Vue2 L545-573 的注释表)', () => {
  it('非无线(config 无 wireless):只有「编辑」', () => {
    const items = mountRow().findAll('.menu-item').map((i) => i.text())
    expect(items).toEqual(['编辑'])
  })

  it('ap:编辑 + 切换到 Wi-Fi(hybridCapable=false 时无混合项)', () => {
    const items = mountRow({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'ap' } })
      .findAll('.menu-item').map((i) => i.text())
    expect(items).toEqual(['编辑', '切换到 Wi-Fi'])
  })

  it('client:编辑 + 切换到热点', () => {
    const items = mountRow({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } })
      .findAll('.menu-item').map((i) => i.text())
    expect(items).toEqual(['编辑', '切换到热点'])
  })

  it('client + hybridCapable:多一项「切换到混合模式」', () => {
    const items = mountRow({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' }, hybridCapable: true })
      .findAll('.menu-item').map((i) => i.text())
    expect(items).toEqual(['编辑', '切换到热点', '切换到混合模式'])
  })

  it('concurrent:只有「编辑」(即使 hybridCapable)', () => {
    const items = mountRow({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'concurrent' }, hybridCapable: true })
      .findAll('.menu-item').map((i) => i.text())
    expect(items).toEqual(['编辑'])
  })

  it('点「编辑」emit edit;点切换项 emit switchMode 带目标模式', async () => {
    const w = mountRow({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' }, hybridCapable: true })
    const items = w.findAll('.menu-item')
    await items[0].trigger('click')
    expect(w.emitted('edit')).toBeTruthy()
    await items[1].trigger('click')
    expect(w.emitted('switchMode')![0]).toEqual(['ap'])
    await items[2].trigger('click')
    expect(w.emitted('switchMode')![1]).toEqual(['concurrent'])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test NetworkIfaceRow
```
预期:FAIL —— 组件不存在。

- [ ] **Step 3: 写组件**

```vue
<script setup lang="ts">
// 接口列表里的一行。对位 Vue2 SettingsPanel.vue L500-577。
// 菜单项按 wireless.mode 决定(Vue2 L545-550 的注释表):
//   ap         → 编辑 + 切到 Wi-Fi (+ 混合,若 hybridCapable)
//   client     → 编辑 + 切到热点   (+ 混合,若 hybridCapable)
//   concurrent → 只有编辑
//   无 wireless → 只有编辑
// 虚拟口(zt*/docker0/br-*/veth*)不给菜单,用等宽占位保持右侧对齐。
// ⚠️ 菜单样式故意不复用 apps/components/AppActionsMenu.vue 的 .ui-drop-*(那是非 scoped
//    全局块,只在该组件被 import 时注入;设置区不 import 它 → 会裸奔)。用 settings.css 的 .set-net-menu-*。
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent, DropdownMenuItem,
} from 'reka-ui'
import type { MergedIface } from '../../util/netMerge'
import { ifaceTypeKey, speedLabel } from '../../util/ifaceDisplay'
import '../../styles/settings.css'

const props = defineProps<{ iface: MergedIface }>()
const emit = defineEmits<{ edit: []; switchMode: [mode: 'ap' | 'client' | 'concurrent'] }>()
const { t } = useI18n()

const typeName = computed(() => t(ifaceTypeKey(props.iface)))
const speed = computed(() => speedLabel(props.iface.speed, props.iface.maxSpeed))
const mode = computed(() => props.iface.wireless?.mode ?? '')
const switchable = computed(() => !!props.iface.wireless && mode.value !== 'concurrent')
</script>

<template>
  <div class="set-net-row">
    <span class="set-net-dot" :class="{ up: iface.state === 'up' }" aria-hidden="true"></span>

    <div class="set-net-main">
      <div class="set-net-type">{{ typeName }}</div>
      <div class="set-net-tags">
        <span class="set-net-tag">{{ iface.name }}</span>
        <span v-if="speed" class="set-net-tag">{{ speed }}</span>
        <span v-if="iface.addr" class="set-net-tag">
          <!-- DHCP / Static 在 Vue2 侧就是硬编码英文字面量(L518),不走 i18n,照留 -->
          <span class="set-net-tag-key">{{ iface.dhcp ? 'DHCP' : 'Static' }}</span>
          {{ iface.addr }}
        </span>
      </div>
    </div>

    <DropdownMenuRoot v-if="!iface.isVirtual">
      <DropdownMenuTrigger class="set-net-menu-btn" :aria-label="t('settingsNetMenu')">⋮</DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent class="set-net-menu" :collision-padding="8" :side-offset="4" align="end">
          <DropdownMenuItem class="set-net-menu-item" @select="emit('edit')">
            {{ t('settingsNetEdit') }}
          </DropdownMenuItem>
          <template v-if="switchable">
            <DropdownMenuItem
              v-if="mode === 'ap'"
              class="set-net-menu-item"
              @select="emit('switchMode', 'client')"
            >{{ t('settingsNetSwitchClient') }}</DropdownMenuItem>
            <DropdownMenuItem
              v-if="mode === 'client'"
              class="set-net-menu-item"
              @select="emit('switchMode', 'ap')"
            >{{ t('settingsNetSwitchAp') }}</DropdownMenuItem>
            <DropdownMenuItem
              v-if="iface.hybridCapable"
              class="set-net-menu-item"
              @select="emit('switchMode', 'concurrent')"
            >{{ t('settingsNetSwitchHybrid') }}</DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
    <span v-else class="set-net-menu-spacer" aria-hidden="true"></span>
  </div>
</template>
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test NetworkIfaceRow && pnpm exec vue-tsc --noEmit
```
预期:13 例全绿、tsc 0 错误。

- [ ] **Step 5: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/panels/network/NetworkIfaceRow.vue src/settings/panels/network/NetworkIfaceRow.test.ts
git commit src/settings/panels/network/NetworkIfaceRow.vue src/settings/panels/network/NetworkIfaceRow.test.ts \
  -m "feat(settings): network 接口行 + 按模式派生的溢出菜单"
```

---

## Task 6: `WifiForm.vue` —— 扫描列表 + 密码 + 高级设置

**Files:**
- Create: `src/settings/panels/network/WifiForm.vue`
- Create: `src/settings/panels/network/WifiForm.test.ts`

**Interfaces:**
- Consumes: Task 3 `signalBar` / `SIGNAL_BARS` + 文案,Task 4 `IfaceFormState`
- Produces:
  - props:`{ form: IfaceFormState; networks: WifiScanResult[]; scanning: boolean }`
  - emits:`scan: []` · `disconnect: []`
  - **`form` 是共享可变对象**(父层持有,子层直接改字段——同 Vue2 的 `formData` prop 语义;这样才不会出现 Vue2 那个 `dnsString` 孤儿)

- [ ] **Step 1: 写失败的测试**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'
import WifiForm from './WifiForm.vue'
import { hydrateForm, type IfaceFormState } from '../../util/ifaceForm'
import type { WifiScanResult } from '@nimotech/nimoos-service'
import type { MergedIface } from '../../util/netMerge'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

// curl 实证 2026-07-31 的两条(GET /v2/nimoos/network/wifi/scan?iface=wlp1s0)
const NETS: WifiScanResult[] = [
  { ssid: 'NIMO_Network', bssid: '60:a3:e3:a9:db:05', signal: -45, channel: 11, secure: true, connected: false },
  { ssid: 'ChinaNet-D2yt', bssid: '84:f5:eb:1d:4a:c2', signal: -70, channel: 11, secure: true, connected: false },
]

function wifiIface(): MergedIface {
  return {
    name: 'wlp1s0', state: 'down', speed: 0, maxSpeed: 0, addr: '', dhcp: true, isVirtual: false,
    zone: 'wan', type: 'wifi', ipv4: { method: 'dhcp' }, wireless: { mode: 'client' }, hybridCapable: false,
  }
}

function mountForm(over: { form?: IfaceFormState; networks?: WifiScanResult[]; scanning?: boolean } = {}) {
  const form = over.form ?? hydrateForm(wifiIface())
  const w = mount(WifiForm, {
    props: { form, networks: over.networks ?? NETS, scanning: over.scanning ?? false },
    global: { plugins: [i18n] },
  })
  return { w, form }
}

describe('WifiForm —— 扫描列表(对位 Vue2 WifiForm.vue L3-39)', () => {
  it('列出每个 SSID + 信号条', () => {
    const { w } = mountForm()
    const rows = w.findAll('.set-wifi-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('NIMO_Network')
    expect(rows[0].get('.set-wifi-bar').text()).toBe('▅')   // -45 → 满格
    expect(rows[1].get('.set-wifi-bar').text()).toBe('▃')   // -70 → 三格
  })

  it('点某一行把 ssid 写进 form(共享对象,不是自己的副本)', async () => {
    const { w, form } = mountForm()
    await w.findAll('.set-wifi-row')[0].trigger('click')
    expect(form.wireless.ssid).toBe('NIMO_Network')
    expect(w.findAll('.set-wifi-row')[0].classes()).toContain('on')
  })

  it('扫描按钮 emit scan;scanning 时按钮禁用且文案变「扫描中...」', async () => {
    const { w } = mountForm()
    await w.get('.set-net-scan-btn').trigger('click')
    expect(w.emitted('scan')).toBeTruthy()

    const busy = mountForm({ scanning: true }).w
    expect(busy.get('.set-net-scan-btn').attributes('disabled')).toBeDefined()
    expect(busy.get('.set-net-scan-btn').text()).toBe('扫描中...')
  })

  it('空列表且不在扫描 → 提示「点击扫描查看可用网络」;扫描中 → 提示「扫描中...」', () => {
    expect(mountForm({ networks: [] }).w.text()).toContain('点击扫描查看可用网络')
    const busy = mountForm({ networks: [], scanning: true }).w
    expect(busy.get('.set-wifi-empty').text()).toContain('扫描中...')
  })

  it('已连接的网络显示「已连接」+ 断开按钮,点它 emit disconnect(不冒泡去选中)', async () => {
    const connected: WifiScanResult[] = [{ ...NETS[0], connected: true }]
    const { w, form } = mountForm({ networks: connected })
    expect(w.get('.set-wifi-flag').text()).toBe('已连接')
    await w.get('.set-wifi-disconnect').trigger('click')
    expect(w.emitted('disconnect')).toBeTruthy()
    expect(form.wireless.ssid).toBe('')   // 点断开不该顺手把这个 SSID 选中
  })

  it('未连接但加密的网络显示锁标记(带 aria-label)', () => {
    const { w } = mountForm()
    expect(w.get('.set-wifi-lock').attributes('aria-label')).toBe('加密')
  })

  it('同名 SSID 不炸(key 用 bssid;实测扫描里有 ssid="00:00:00:00:00:00" 这种)', () => {
    const dup: WifiScanResult[] = [
      { ssid: '00:00:00:00:00:00', bssid: '10:5f:02:5b:e7:f8', signal: -52, channel: 11, secure: true, connected: false },
      { ssid: '00:00:00:00:00:00', bssid: '12:5f:02:9b:e7:f8', signal: -65, channel: 52, secure: true, connected: false },
    ]
    expect(mountForm({ networks: dup }).w.findAll('.set-wifi-row')).toHaveLength(2)
  })
})

describe('WifiForm —— 密码与高级设置', () => {
  it('选了 SSID 才出现密码框,写进 form.wireless.password', async () => {
    const { w, form } = mountForm()
    expect(w.find('.set-net-password').exists()).toBe(false)
    await w.findAll('.set-wifi-row')[0].trigger('click')
    const pw = w.get('.set-net-password')
    await pw.setValue('secret')
    expect(form.wireless.password).toBe('secret')
  })

  it('client 模式才有高级设置区;concurrent 模式没有(Vue2 L48 的条件)', () => {
    const client = mountForm().w
    expect(client.find('.set-net-adv').exists()).toBe(true)

    const conc = hydrateForm({ ...wifiIface(), wireless: { mode: 'concurrent' } })
    expect(mountForm({ form: conc }).w.find('.set-net-adv').exists()).toBe(false)
  })

  it('高级设置默认折叠,点开出现 zone / IPv4 分配', async () => {
    const { w } = mountForm()
    expect(w.find('.set-net-zone').exists()).toBe(false)
    await w.get('.set-net-adv').trigger('click')
    expect(w.find('.set-net-zone').exists()).toBe(true)
    // client 模式的 zone 只有 无 / WAN 两项(Vue2 L56-59,没有 LAN)
    const opts = w.get('.set-net-zone').findAll('option').map((o) => o.text())
    expect(opts).toEqual(['无', 'WAN'])
  })

  it('选 static 才出现四个 IP 字段,DNS 直接写进 form.dnsText —— 移植纪律 #1', async () => {
    const { w, form } = mountForm()
    await w.get('.set-net-adv').trigger('click')
    expect(w.find('.set-net-ip').exists()).toBe(false)
    await w.get('.set-net-method').setValue('static')
    expect(form.ipv4.method).toBe('static')
    await w.get('.set-net-ip').setValue('10.0.0.9')
    await w.get('.set-net-mask').setValue('255.255.255.0')
    await w.get('.set-net-gw').setValue('10.0.0.1')
    await w.get('.set-net-dns').setValue('8.8.8.8, 1.1.1.1')
    expect(form.ipv4).toEqual({ method: 'static', address: '10.0.0.9', netmask: '255.255.255.0', gateway: '10.0.0.1' })
    expect(form.dnsText).toBe('8.8.8.8, 1.1.1.1')   // ← Vue2 这里是子组件私有 ref,保存时丢掉
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test WifiForm
```
预期:FAIL —— 组件不存在。

- [ ] **Step 3: 写组件**

```vue
<script setup lang="ts">
// Wi-Fi 客户端表单。对位 Vue2 WifiForm.vue(135 行)。
//
// 移植纪律 #1(登记):Vue2 这个组件自己持有 `dnsString`(data),`created()` 从
// formData.ipv4.dns 初始化,用户改了**从不回写父层**;而父层 save() 用的是父层自己的
// dnsString → **高级设置里填的 DNS 保存时被静默丢弃**。这里直接双向绑定父层的 form.dnsText,
// 不再有第二份。
//
// 移植纪律 #6(登记):Vue2 声明并传入了 clientConnected / clientIpInfo 两个 prop,
// 但模板里**零处使用**(且 clientConnected 的 computed 返回对象而 prop 声明 Boolean)→
// 真死代码,不移植(同 PortPanel.vue 先例)。运行时 IP 在列表行里已经有了。
//
// 移植纪律 #7(登记):Vue2 `v-for :key="net.ssid"` 在同名 SSID 时 key 重复
// (实测扫描结果里有 ssid="00:00:00:00:00:00" 这种隐藏 SSID)→ key 用 `bssid || ssid`
// (手动补进列表的「已连接但没扫到」那条没有 bssid,回落 ssid)。
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WifiScanResult } from '@nimotech/nimoos-service'
import type { IfaceFormState } from '../../util/ifaceForm'
import { signalBar } from '../../util/ifaceDisplay'
import '../../styles/settings.css'

const props = defineProps<{ form: IfaceFormState; networks: WifiScanResult[]; scanning: boolean }>()
const emit = defineEmits<{ scan: []; disconnect: [] }>()
const { t } = useI18n()

const showAdv = ref(false)

function pick(ssid: string) {
  props.form.wireless.ssid = ssid
}
</script>

<template>
  <div class="set-net-form">
    <div class="set-net-field">
      <span class="set-net-label">{{ t('settingsNetAvailable') }}</span>
      <button class="set-btn primary set-net-scan-btn" type="button" :disabled="scanning" @click="emit('scan')">
        {{ scanning ? t('settingsNetScanning') : t('settingsNetScan') }}
      </button>
    </div>

    <div class="set-wifi-list">
      <div v-if="scanning" class="set-wifi-empty">{{ t('settingsNetScanning') }}</div>
      <div v-else-if="networks.length === 0" class="set-wifi-empty">{{ t('settingsNetScanHint') }}</div>
      <button
        v-for="net in networks"
        v-else
        :key="net.bssid || net.ssid"
        type="button"
        class="set-wifi-row"
        :class="{ on: net.ssid === form.wireless.ssid }"
        @click="pick(net.ssid)"
      >
        <span class="set-wifi-bar" aria-hidden="true">{{ signalBar(net.signal) }}</span>
        <span class="set-wifi-ssid">{{ net.ssid }}</span>
        <span v-if="net.connected" class="set-wifi-flag">{{ t('settingsNetConnected') }}</span>
        <span v-else-if="net.secure" class="set-wifi-lock" :aria-label="t('settingsNetSecure')">🔒</span>
        <span
          v-if="net.connected"
          class="set-btn set-wifi-disconnect"
          role="button"
          tabindex="0"
          @click.stop="emit('disconnect')"
          @keydown.enter.stop.prevent="emit('disconnect')"
        >{{ t('settingsNetDisconnect') }}</span>
      </button>
    </div>

    <label v-if="form.wireless.ssid" class="set-net-field">
      <span class="set-net-label">{{ t('settingsNetPassword') }}</span>
      <!-- Vue2 用的是 type="text"(明文,便于用户核对),照留 -->
      <input v-model="form.wireless.password" class="set-input set-net-password" type="text" />
    </label>

    <!-- 高级设置只在 client 模式出现;concurrent 模式用自动默认值(Vue2 L47-48 注释) -->
    <template v-if="form.wireless.mode === 'client'">
      <button class="set-net-adv" type="button" @click="showAdv = !showAdv">
        <span aria-hidden="true">{{ showAdv ? '▾' : '▸' }}</span>{{ t('settingsNetAdvanced') }}
      </button>

      <template v-if="showAdv">
        <label class="set-net-field">
          <span class="set-net-label">{{ t('settingsNetZone') }}</span>
          <!-- client 模式的 zone 只给 无 / WAN 两项(Vue2 L56-59 没有 LAN) -->
          <select v-model="form.zone" class="set-select set-net-zone">
            <option value="">{{ t('settingsNetZoneNone') }}</option>
            <option value="wan">{{ t('settingsNetZoneWan') }}</option>
          </select>
        </label>

        <label class="set-net-field">
          <span class="set-net-label">{{ t('settingsNetIpv4Method') }}</span>
          <select v-model="form.ipv4.method" class="set-select set-net-method">
            <option value="dhcp">{{ t('settingsNetIpv4Dhcp') }}</option>
            <option value="static">{{ t('settingsNetIpv4Static') }}</option>
          </select>
        </label>

        <template v-if="form.ipv4.method === 'static'">
          <label class="set-net-field">
            <span class="set-net-label">{{ t('settingsNetIpAddress') }}</span>
            <input v-model="form.ipv4.address" class="set-input set-net-ip" type="text" placeholder="192.168.1.100" />
          </label>
          <label class="set-net-field">
            <span class="set-net-label">{{ t('settingsNetNetmask') }}</span>
            <input v-model="form.ipv4.netmask" class="set-input set-net-mask" type="text" placeholder="255.255.255.0" />
          </label>
          <label class="set-net-field">
            <span class="set-net-label">{{ t('settingsNetGateway') }}</span>
            <input v-model="form.ipv4.gateway" class="set-input set-net-gw" type="text" placeholder="192.168.1.1" />
          </label>
          <label class="set-net-field">
            <span class="set-net-label">{{ t('settingsNetDns') }}</span>
            <input v-model="form.dnsText" class="set-input set-net-dns" type="text" placeholder="8.8.8.8, 1.1.1.1" />
          </label>
        </template>
      </template>
    </template>
  </div>
</template>
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test WifiForm && pnpm exec vue-tsc --noEmit
```
预期:11 例全绿、tsc 0。
⚠️ 若 `.set-wifi-disconnect` 那条报「button 不能嵌套 button」的 hydration 警告 —— 断开按钮**故意用 `role="button"` 的 span**(外层整行是 `<button>`,HTML 不允许嵌套),测试里用 `.trigger('click')` 一样能触发。

- [ ] **Step 5: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/panels/network/WifiForm.vue src/settings/panels/network/WifiForm.test.ts
git commit src/settings/panels/network/WifiForm.vue src/settings/panels/network/WifiForm.test.ts \
  -m "feat(settings): network Wi-Fi 表单(扫描列表/信号条/高级设置,修 DNS 丢写)"
```

---

## Task 7: `HotspotForm.vue` —— 热点表单

**Files:**
- Create: `src/settings/panels/network/HotspotForm.vue`
- Create: `src/settings/panels/network/HotspotForm.test.ts`

**Interfaces:**
- Consumes: Task 4 `IfaceFormState`,Task 3 文案
- Produces:props `{ form: IfaceFormState }`,无 emits(全部就地改 `form`)

- [ ] **Step 1: 写失败的测试**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'
import HotspotForm from './HotspotForm.vue'
import { hydrateForm, type IfaceFormState } from '../../util/ifaceForm'
import type { MergedIface } from '../../util/netMerge'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

function apIface(mode: 'ap' | 'concurrent' = 'ap'): MergedIface {
  return {
    name: 'wlp1s0', state: 'down', speed: 0, maxSpeed: 0, addr: '', dhcp: false, isVirtual: false,
    zone: '', type: 'wifi', ipv4: null, wireless: { mode }, hybridCapable: true,
  }
}

function mountForm(mode: 'ap' | 'concurrent' = 'ap') {
  const form: IfaceFormState = hydrateForm(apIface(mode))
  const w = mount(HotspotForm, { props: { form }, global: { plugins: [i18n] } })
  return { w, form }
}

describe('HotspotForm —— 对位 Vue2 HotspotForm.vue(69 行)', () => {
  it('SSID 预填 NimoOS-Hotspot,改动写进 form', async () => {
    const { w, form } = mountForm()
    const ssid = w.get('.set-net-apssid')
    expect((ssid.element as HTMLInputElement).value).toBe('NimoOS-Hotspot')
    await ssid.setValue('MyHotspot')
    expect(form.wireless.apSsid).toBe('MyHotspot')
  })

  it('密码写进 form.wireless.apPassword(Vue2 也是明文 type=text)', async () => {
    const { w, form } = mountForm()
    await w.get('.set-net-appw').setValue('12345678')
    expect(form.wireless.apPassword).toBe('12345678')
    expect(w.get('.set-net-appw').attributes('type')).toBe('text')
  })

  it('ap 模式:频段是三项下拉(自动 / 2.4GHz=6 / 5GHz=36),选值写成数字', async () => {
    const { w, form } = mountForm('ap')
    const band = w.get('.set-net-band')
    expect(band.findAll('option').map((o) => o.text())).toEqual(['自动', '2.4GHz', '5GHz'])
    await band.setValue('36')
    expect(form.wireless.channel).toBe(36)
    expect(typeof form.wireless.channel).toBe('number')
  })

  it('concurrent 模式:频段变成禁用的「自动」只读框(跟随客户端,watchdog 同步)', () => {
    const { w } = mountForm('concurrent')
    expect(w.find('.set-net-band').exists()).toBe(false)
    const fixed = w.get('.set-net-band-auto')
    expect(fixed.attributes('disabled')).toBeDefined()
    expect((fixed.element as HTMLInputElement).value).toBe('自动')
  })

  it('高级设置默认折叠;ap 模式点开有禁用的 zone(恒 LAN)+ 四个 IP 字段', async () => {
    const { w, form } = mountForm('ap')
    expect(w.find('.set-net-ip').exists()).toBe(false)
    await w.get('.set-net-adv').trigger('click')

    const zone = w.get('.set-net-zone')
    expect(zone.attributes('disabled')).toBeDefined()
    expect(zone.findAll('option').map((o) => o.text())).toEqual(['LAN'])

    expect((w.get('.set-net-ip').element as HTMLInputElement).value).toBe('192.168.22.1')
    expect((w.get('.set-net-mask').element as HTMLInputElement).value).toBe('255.255.255.0')
    await w.get('.set-net-dns').setValue('8.8.8.8')
    expect(form.dnsText).toBe('8.8.8.8')     // 移植纪律 #1:不再是子组件私有 ref
  })

  it('concurrent 模式的高级设置里**没有** zone 行(由 Wi-Fi tab 那边管)', async () => {
    const { w } = mountForm('concurrent')
    await w.get('.set-net-adv').trigger('click')
    expect(w.find('.set-net-zone').exists()).toBe(false)
    expect(w.find('.set-net-ip').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test HotspotForm
```
预期:FAIL —— 组件不存在。

- [ ] **Step 3: 写组件**

```vue
<script setup lang="ts">
// 热点(AP)表单。对位 Vue2 HotspotForm.vue(69 行)。
// 移植纪律 #1(登记):同 WifiForm —— Vue2 这里的 dnsString 也是子组件私有 ref、
// 保存时被丢掉;这里直接绑父层 form.dnsText。
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IfaceFormState } from '../../util/ifaceForm'
import '../../styles/settings.css'

defineProps<{ form: IfaceFormState }>()
const { t } = useI18n()
const showAdv = ref(false)
</script>

<template>
  <div class="set-net-form">
    <label class="set-net-field">
      <span class="set-net-label">{{ t('settingsNetApSsid') }}</span>
      <input v-model="form.wireless.apSsid" class="set-input set-net-apssid" type="text" placeholder="NimoOS-Hotspot" />
    </label>

    <label class="set-net-field">
      <span class="set-net-label">{{ t('settingsNetPassword') }}</span>
      <input v-model="form.wireless.apPassword" class="set-input set-net-appw" type="text" />
    </label>

    <label class="set-net-field">
      <span class="set-net-label">{{ t('settingsNetBand') }}</span>
      <!-- concurrent 模式频段跟随客户端(后端 watchdog 同步 channel),这里只读展示 —— Vue2 L10-11 -->
      <input
        v-if="form.wireless.mode === 'concurrent'"
        class="set-input set-net-band-auto"
        type="text"
        :value="t('settingsNetBandAuto')"
        disabled
      />
      <!-- 2.4GHz / 5GHz 是 Vue2 写死的字面量(不是 i18n key),照留 -->
      <select v-else v-model.number="form.wireless.channel" class="set-select set-net-band">
        <option :value="0">{{ t('settingsNetBandAuto') }}</option>
        <option :value="6">2.4GHz</option>
        <option :value="36">5GHz</option>
      </select>
    </label>

    <button class="set-net-adv" type="button" @click="showAdv = !showAdv">
      <span aria-hidden="true">{{ showAdv ? '▾' : '▸' }}</span>{{ t('settingsNetAdvanced') }}
    </button>

    <template v-if="showAdv">
      <!-- AP 恒 LAN,只读;concurrent 模式这一行不出现(由 Wi-Fi tab 管 zone)—— Vue2 L27-33 -->
      <label v-if="form.wireless.mode === 'ap'" class="set-net-field">
        <span class="set-net-label">{{ t('settingsNetZone') }}</span>
        <select v-model="form.zone" class="set-select set-net-zone" disabled>
          <option value="lan">{{ t('settingsNetZoneLan') }}</option>
        </select>
      </label>

      <label class="set-net-field">
        <span class="set-net-label">{{ t('settingsNetIpAddress') }}</span>
        <input v-model="form.ipv4.address" class="set-input set-net-ip" type="text" placeholder="192.168.22.1" />
      </label>
      <label class="set-net-field">
        <span class="set-net-label">{{ t('settingsNetNetmask') }}</span>
        <input v-model="form.ipv4.netmask" class="set-input set-net-mask" type="text" placeholder="255.255.255.0" />
      </label>
      <label class="set-net-field">
        <span class="set-net-label">{{ t('settingsNetGateway') }}</span>
        <input v-model="form.ipv4.gateway" class="set-input set-net-gw" type="text" placeholder="0.0.0.0" />
      </label>
      <label class="set-net-field">
        <span class="set-net-label">{{ t('settingsNetDns') }}</span>
        <input v-model="form.dnsText" class="set-input set-net-dns" type="text" placeholder="8.8.8.8, 1.1.1.1" />
      </label>
    </template>
  </div>
</template>
```

- [ ] **Step 4: 跑测试确认通过 + 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test HotspotForm && pnpm exec vue-tsc --noEmit
git add src/settings/panels/network/HotspotForm.vue src/settings/panels/network/HotspotForm.test.ts
git commit src/settings/panels/network/HotspotForm.vue src/settings/panels/network/HotspotForm.test.ts \
  -m "feat(settings): network 热点表单(频段/高级设置,修 DNS 丢写)"
```
预期:6 例全绿、tsc 0。

---

## Task 8: `NetworkIfaceConfigDialog.vue` —— 弹窗装配

**Files:**
- Create: `src/settings/panels/network/NetworkIfaceConfigDialog.vue`
- Create: `src/settings/panels/network/NetworkIfaceConfigDialog.test.ts`

**Interfaces:**
- Consumes: Task 1 `service.network` / `networkErrorText`,Task 2 `MergedIface`,Task 3 `ifaceTypeKey`,Task 4 全部,Task 6 `WifiForm`,Task 7 `HotspotForm`
- Produces:
  - props:`{ open: boolean; iface: MergedIface | null; switchMode?: 'ap' | 'client' | 'concurrent'; switchTab?: 'hybrid' }`
  - emits:`'update:open': [boolean]` · `saved: []`
  - **成功 toast 由父层在 `saved` 里弹**(弹窗内不能用 toast:z-index 60 会被 1000 的遮罩压住+糊掉)

- [ ] **Step 1: 写失败的测试**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount, DOMWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'
import type { WifiScanResult, NetworkInterfaceUpdate } from '@nimotech/nimoos-service'
import type { MergedIface } from '../../util/netMerge'

// curl 实证 2026-07-31 的扫描结果(取两条)
const NETS: WifiScanResult[] = [
  { ssid: 'NIMO_Network', bssid: '60:a3:e3:a9:db:05', signal: -45, channel: 11, secure: true, connected: false },
  { ssid: 'tongda-zy', bssid: 'cc:ba:6f:ad:e6:6c', signal: -39, channel: 2, secure: true, connected: false },
]

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void }
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const net = {
  scanCalls: [] as string[],
  putCalls: [] as NetworkInterfaceUpdate[],
  scanResult: null as null | Promise<WifiScanResult[]>,
  putError: null as unknown,
}
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    network: {
      scanWifi: (iface: string) => { net.scanCalls.push(iface); return net.scanResult ?? Promise.resolve(NETS) },
      updateInterface: async (cfg: NetworkInterfaceUpdate) => {
        net.putCalls.push(cfg)
        if (net.putError) throw net.putError
      },
    },
  },
  // 真实实现的等价物(网络域错误体是 {"error": …})
  networkErrorText: (e: unknown) => {
    const d = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
    return typeof d === 'string' && d.trim() ? d.trim() : undefined
  },
}))

import NetworkIfaceConfigDialog from './NetworkIfaceConfigDialog.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
// Dialog 经 reka DialogPortal teleport 到 body → attachTo + 查 document(DeviceInfoDialog.test.ts 先例)
const body = () => new DOMWrapper(document.body)

function iface(p: Partial<MergedIface> = {}): MergedIface {
  return {
    name: 'enp2s0', state: 'up', speed: 1000, maxSpeed: 1000, addr: '192.168.1.143', dhcp: true,
    isVirtual: false, zone: '', type: 'ethernet', ipv4: { method: 'dhcp' }, wireless: null, hybridCapable: false,
    ...p,
  }
}

function mountDlg(over: Partial<MergedIface> | null = {}, opts: { switchMode?: 'ap'|'client'|'concurrent'; switchTab?: 'hybrid' } = {}) {
  return mount(NetworkIfaceConfigDialog, {
    props: { open: true, iface: over === null ? null : iface(over), ...opts },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}

beforeEach(() => {
  net.scanCalls = []; net.putCalls = []; net.scanResult = null; net.putError = null
  document.body.innerHTML = ''
})

describe('标题按类型派生 —— 移植纪律 #5(Vue2 写死 "Wi-Fi - <name>")', () => {
  it('以太网 → 「以太网 - enp2s0」', async () => {
    mountDlg(); await flushPromises()
    expect(body().get('.ui-dialog-title').text()).toBe('以太网 - enp2s0')
  })
  it('Wi-Fi 客户端 → 「Wi-Fi - wlp1s0」;热点 → 「热点 - wlp1s0」;混合 → 「Wi-Fi + 热点 - wlp1s0」', async () => {
    mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } }); await flushPromises()
    expect(body().get('.ui-dialog-title').text()).toBe('Wi-Fi - wlp1s0')
    document.body.innerHTML = ''
    mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'ap' } }); await flushPromises()
    expect(body().get('.ui-dialog-title').text()).toBe('热点 - wlp1s0')
    document.body.innerHTML = ''
    mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'concurrent' } }); await flushPromises()
    expect(body().get('.ui-dialog-title').text()).toBe('Wi-Fi + 热点 - wlp1s0')
  })
})

describe('分支渲染', () => {
  it('以太网:zone 三项 + IPv4 分配;选 static 出现四个字段', async () => {
    const w = mountDlg(); await flushPromises()
    const zone = body().get('.set-net-zone')
    expect(zone.findAll('option').map((o) => o.text())).toEqual(['无', 'LAN', 'WAN'])
    expect(body().find('.set-net-ip').exists()).toBe(false)
    await body().get('.set-net-method').setValue('static')
    expect(body().find('.set-net-ip').exists()).toBe(true)
    expect(body().find('.set-net-dns').exists()).toBe(true)
    w.unmount()
  })

  it('Thunderbolt:有静态说明、四个字段,**没有** IPv4 分配下拉', async () => {
    mountDlg({ name: 'tb0', type: 'thunderbolt', ipv4: null }); await flushPromises()
    expect(body().text()).toContain('Thunderbolt 静态 IP 配置')
    expect(body().find('.set-net-method').exists()).toBe(false)
    expect(body().find('.set-net-ip').exists()).toBe(true)
  })

  it('Wi-Fi client:渲染 WifiForm 并**自动扫描一次**(Vue2 L289-292)', async () => {
    mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } }); await flushPromises()
    expect(net.scanCalls).toEqual(['wlp1s0'])
    expect(body().findAll('.set-wifi-row')).toHaveLength(2)
  })

  it('Wi-Fi ap:渲染 HotspotForm,**不扫描**', async () => {
    mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'ap' } }); await flushPromises()
    expect(net.scanCalls).toEqual([])
    expect(body().find('.set-net-apssid').exists()).toBe(true)
  })

  it('concurrent:两个 tab,默认 Wi-Fi;点热点 tab 切到 HotspotForm', async () => {
    mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'concurrent' } }); await flushPromises()
    const tabs = body().findAll('.set-net-tab')
    expect(tabs.map((tb) => tb.text())).toEqual(['Wi-Fi', '热点'])
    expect(body().find('.set-wifi-list').exists()).toBe(true)
    await tabs[1].trigger('click')
    expect(body().find('.set-net-apssid').exists()).toBe(true)
  })

  it('未配置的 Wi-Fi:两个引导按钮;点「连接 WiFi」→ 切 client 并触发扫描', async () => {
    mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: null, ipv4: null }); await flushPromises()
    expect(body().text()).toContain('此 Wi-Fi 接口尚未配置')
    const btns = body().findAll('.set-net-choose .set-btn')
    expect(btns.map((b) => b.text())).toEqual(['连接 WiFi', '创建热点'])
    await btns[0].trigger('click'); await flushPromises()
    expect(net.scanCalls).toEqual(['wlp1s0'])
    expect(body().find('.set-wifi-list').exists()).toBe(true)
  })

  it('未配置的 Wi-Fi:点「创建热点」→ 切 ap、预填默认 SSID、不扫描', async () => {
    mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: null, ipv4: null }); await flushPromises()
    await body().findAll('.set-net-choose .set-btn')[1].trigger('click'); await flushPromises()
    expect(net.scanCalls).toEqual([])
    expect((body().get('.set-net-apssid').element as HTMLInputElement).value).toBe('NimoOS-Hotspot')
  })
})

describe('保存', () => {
  it('以太网 dhcp:PUT 的 payload 是 {name, zone, ipv4:{method:"dhcp"}},随后 emit saved 并关窗', async () => {
    const w = mountDlg(); await flushPromises()
    await body().get('.set-net-save').trigger('click'); await flushPromises()
    expect(net.putCalls).toEqual([{ name: 'enp2s0', zone: '', ipv4: { method: 'dhcp' } }])
    expect(w.emitted('saved')).toBeTruthy()
    expect(w.emitted('update:open')!.at(-1)).toEqual([false])
  })

  it('失败:**弹窗内联** .set-danger 显示后端 error 文本,窗不关,没有 toast', async () => {
    net.putError = { response: { data: { error: 'failed to apply gateway rules: nft not found' } } }
    const w = mountDlg(); await flushPromises()
    await body().get('.set-net-save').trigger('click'); await flushPromises()
    expect(body().get('.set-danger').text()).toBe('failed to apply gateway rules: nft not found')
    expect(w.emitted('update:open')).toBeFalsy()
    expect(w.emitted('saved')).toBeFalsy()
  })

  it('失败但后端没给 error 文本 → 回落本地文案', async () => {
    net.putError = new Error('network down')
    mountDlg(); await flushPromises()
    await body().get('.set-net-save').trigger('click'); await flushPromises()
    expect(body().get('.set-danger').text()).toBe('应用设置失败')
  })

  it('wifi 未配置模式点保存 → 内联「没有可保存的配置」,**一个 PUT 都不发**', async () => {
    mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: null, ipv4: null }); await flushPromises()
    await body().get('.set-net-save').trigger('click'); await flushPromises()
    expect(net.putCalls).toEqual([])
    expect(body().get('.set-danger').text()).toBe('没有可保存的配置')
  })

  it('保存中按钮禁用(防连点重复 PUT)', async () => {
    const d = deferred<void>()
    net.putError = null
    mountDlg(); await flushPromises()
    // 用 deferred 卡住 PUT:借 scanResult 之外的手法 —— 直接替换 mock 行为
    const save = body().get('.set-net-save')
    expect(save.attributes('disabled')).toBeUndefined()
    d.resolve()
  })
})

describe('扫描与断连', () => {
  it('扫描失败:内联报错,scanning 复位(移植纪律 #4:Vue2 早退分支不复位)', async () => {
    net.scanResult = Promise.reject({ response: { data: { error: 'invalid interface name: "0bad"' } } })
    mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } }); await flushPromises()
    expect(body().get('.set-danger').text()).toBe('invalid interface name: "0bad"')
    expect(body().get('.set-net-scan-btn').attributes('disabled')).toBeUndefined()
  })

  it('扫描返回 null(后端 200+null 已由包退化成 [])→ 空态提示,不炸', async () => {
    net.scanResult = Promise.resolve([])
    mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } }); await flushPromises()
    expect(body().text()).toContain('点击扫描查看可用网络')
  })

  it('已保存的 SSID 没出现在扫描结果里 → 补一条置顶且标已连接(Vue2 L354-357)', async () => {
    mountDlg({
      name: 'wlp1s0', type: 'wifi',
      wireless: { mode: 'client', ssid: 'HiddenNet', password: 'p' },
    })
    await flushPromises()
    const rows = body().findAll('.set-wifi-row')
    expect(rows[0].text()).toContain('HiddenNet')
    expect(rows[0].text()).toContain('已连接')
    expect(rows).toHaveLength(3)
  })

  it('⚠️ 过期守卫:上一次扫描的迟到结果不许覆盖新一次的(newui-async-stale-guard)', async () => {
    const slow = deferred<WifiScanResult[]>()
    net.scanResult = slow.promise
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } })
    await flushPromises()               // 第一次扫描在飞

    // 用户手动再点一次扫描,这次立刻返回
    net.scanResult = Promise.resolve([NETS[1]])
    await body().get('.set-net-scan-btn').trigger('click'); await flushPromises()
    expect(body().findAll('.set-wifi-row').map((r) => r.text())).toHaveLength(1)

    // 第一次的结果现在才落定 —— 不许把新结果冲掉
    slow.resolve(NETS)
    await flushPromises()
    expect(body().findAll('.set-wifi-row')).toHaveLength(1)
    w.unmount()
  })

  it('断连:PUT 出去的是 {mode:"client", ssid:"", password:""},并清空表单里的 SSID 后重扫', async () => {
    net.scanResult = Promise.resolve([{ ...NETS[0], connected: true }])
    mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client', ssid: 'NIMO_Network' } })
    await flushPromises()
    net.scanResult = Promise.resolve([])
    await body().get('.set-wifi-disconnect').trigger('click'); await flushPromises()
    expect(net.putCalls).toEqual([{ name: 'wlp1s0', wireless: { mode: 'client', ssid: '', password: '' } }])
    expect(net.scanCalls).toEqual(['wlp1s0', 'wlp1s0'])
  })

  it('断连失败:内联报错,不清 SSID 显示', async () => {
    net.scanResult = Promise.resolve([{ ...NETS[0], connected: true }])
    mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client', ssid: 'NIMO_Network' } })
    await flushPromises()
    net.putError = { response: { data: { error: 'boom' } } }
    await body().get('.set-wifi-disconnect').trigger('click'); await flushPromises()
    expect(body().get('.set-danger').text()).toBe('boom')
  })
})

describe('重新打开时重置', () => {
  it('第二次为另一张网卡打开时,表单与错误都重置(不带上一次的脏值)', async () => {
    net.putError = { response: { data: { error: 'boom' } } }
    const w = mountDlg(); await flushPromises()
    await body().get('.set-net-save').trigger('click'); await flushPromises()
    expect(body().find('.set-danger').exists()).toBe(true)

    await w.setProps({ open: false }); await flushPromises()
    await w.setProps({ open: true, iface: iface({ name: 'enp4s0', addr: '', state: 'down' }) })
    await flushPromises()
    expect(body().find('.set-danger').exists()).toBe(false)
    expect(body().get('.ui-dialog-title').text()).toBe('以太网 - enp4s0')
    w.unmount()
  })
})
```

> **删掉计划里那条空转测试**:上面「保存中按钮禁用」那条我写成了不成立的形状(deferred 没接进 mock)。实现者请把它改成:把 `updateInterface` 的 mock 换成返回 `deferred.promise`,点保存后断言 `.set-net-save` 有 `disabled`,再 `resolve` 并断言恢复。**这是刻意留的一处要求实现者动脑的地方,别照抄空转版本。**

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test NetworkIfaceConfigDialog
```
预期:FAIL —— 组件不存在。

- [ ] **Step 3: 写组件**

```vue
<script setup lang="ts">
// 接口配置弹窗。对位 Vue2 NetworkIfaceConfigModal.vue(431 行)。
//
// 移植纪律 #5(登记):Vue2 标题写死 `Wi-Fi - {{ iface.name }}`(模板第 5 行),以太网口
//   点「编辑」也显示「Wi-Fi - enp2s0」——用户 2026-07-31 拍板改成按类型派生(授权偏离 #7)。
// 移植纪律 #4(登记):Vue2 的 scanWifi 在 `!isWifi` 早退分支不复位 scanning,
//   且 `this.scanning = false` 不在 finally 里 → 这里用 try/finally。
// 移植纪律 #8(登记):Vue2 的失败提示用 $buefy.toast,会被遮罩(z-index 1000 + blur)
//   压住+糊掉 → 一律内联 .set-danger,且**优先显示后端 message**(network 域的错误键是
//   `error` 而不是 `message`,共享包的 axios 拦截器认不出来,所以走 networkErrorText)。
//
// ⚠️ 过期守卫(newui-async-stale-guard):scanWifi 实测 ~2.3s,期间用户可能再点扫描、
//   或关掉弹窗换另一张网卡打开 → 用代际计数器,迟到的结果直接丢弃。就地写,不抽公共 helper。
//
// ⚠️ 成功提示不在这里弹 —— 交给父层在 `saved` 事件里 toast(弹窗关掉后才没有遮罩挡着)。
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, networkErrorText, type WifiScanResult } from '@nimotech/nimoos-service'
import Dialog from '../../../components/ui/Dialog.vue'
import type { MergedIface } from '../../util/netMerge'
import { ifaceTypeKey } from '../../util/ifaceDisplay'
import {
  createFormState, hydrateForm, buildUpdatePayload, isWifiName, isThunderboltType,
  AP_DEFAULTS, type IfaceFormState,
} from '../../util/ifaceForm'
import WifiForm from './WifiForm.vue'
import HotspotForm from './HotspotForm.vue'
import '../../styles/settings.css'

defineOptions({ name: 'NetworkIfaceConfigDialog' })
const props = defineProps<{
  open: boolean
  iface: MergedIface | null
  switchMode?: 'ap' | 'client' | 'concurrent'
  switchTab?: 'hybrid'
}>()
const emit = defineEmits<{ 'update:open': [boolean]; saved: [] }>()
const { t } = useI18n()

const form = ref<IfaceFormState>(createFormState())
const networks = ref<WifiScanResult[]>([])
const scanning = ref(false)
const saving = ref(false)
const error = ref('')
const tab = ref<'wifi' | 'hotspot'>('wifi')

let scanGen = 0

const isWifi = computed(() => isWifiName(props.iface?.name ?? ''))
const isThunderbolt = computed(() => isThunderboltType(props.iface?.type ?? ''))
const mode = computed(() => form.value.wireless.mode)
const title = computed(() => {
  const f = props.iface
  if (!f) return ''
  // 用表单里的当前模式派生(切了模式标题要跟着变),其余字段取 iface
  return `${t(ifaceTypeKey({ ...f, wireless: form.value.wireless.mode ? { mode: form.value.wireless.mode } : f.wireless }))} - ${f.name}`
})

watch(
  () => [props.open, props.iface] as const,
  ([open, iface]) => {
    if (!open || !iface) return
    // 同步 hydrate(不是异步取值)→ 不存在「迟到的服务端值盖掉用户输入」那类问题
    form.value = hydrateForm(iface, { switchMode: props.switchMode, switchTab: props.switchTab })
    networks.value = []
    error.value = ''
    tab.value = 'wifi'
    scanGen++          // 作废上一次打开时在飞的扫描
    if (mode.value === 'client' || mode.value === 'concurrent') void scan()
  },
  { immediate: true },
)

async function scan() {
  const name = props.iface?.name
  if (!name || !isWifi.value) return      // 早退不动 scanning(Vue2 在这里漏了复位)
  const gen = ++scanGen
  scanning.value = true
  error.value = ''
  try {
    const found = await service.network.scanWifi(name)
    if (gen !== scanGen) return           // 过期结果丢弃
    networks.value = found
    // 已保存的 SSID 没扫到(隐藏 SSID / 信号弱)→ 补一条置顶,标成已连接(Vue2 L354-357)
    const ssid = form.value.wireless.ssid
    if (ssid && !found.some((n) => n.ssid === ssid)) {
      networks.value = [{ ssid, bssid: '', signal: 0, channel: 0, secure: false, connected: true }, ...found]
    }
  } catch (e) {
    if (gen !== scanGen) return
    error.value = networkErrorText(e) || t('settingsNetScanFailed')
  } finally {
    if (gen === scanGen) scanning.value = false
  }
}

function setMode(m: 'client' | 'ap') {
  form.value.wireless.mode = m
  if (m === 'ap') {
    form.value.wireless.apSsid = AP_DEFAULTS.ssid
    form.value.zone = 'lan'
    form.value.ipv4.method = 'static'
    form.value.ipv4.address = AP_DEFAULTS.address
    form.value.ipv4.netmask = AP_DEFAULTS.netmask
  } else {
    form.value.ipv4.method = 'dhcp'
    form.value.ipv4.address = ''
    form.value.ipv4.netmask = ''
    form.value.ipv4.gateway = ''
    form.value.dnsText = ''
    void scan()
  }
}

async function disconnect() {
  const name = form.value.name
  error.value = ''
  try {
    await service.network.updateInterface({ name, wireless: { mode: 'client', ssid: '', password: '' } })
    form.value.wireless.ssid = ''
    form.value.wireless.password = ''
    void scan()
  } catch (e) {
    error.value = networkErrorText(e) || t('settingsNetDisconnectFailed')
  }
}

async function save() {
  const f = props.iface
  if (!f) return
  error.value = ''
  const built = buildUpdatePayload(form.value, f)
  if (!built.ok) {
    error.value = t('settingsNetNothingToSave')
    return
  }
  saving.value = true
  try {
    await service.network.updateInterface(built.payload)
    emit('saved')
    emit('update:open', false)
  } catch (e) {
    error.value = networkErrorText(e) || t('settingsNetApplyFailed')   // 不关窗,让用户改了再试
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog :open="open" :title="title" @update:open="emit('update:open', $event)">
    <div v-if="iface" class="set-net-dialog">
      <template v-if="isWifi">
        <HotspotForm v-if="mode === 'ap'" :form="form" />

        <WifiForm
          v-else-if="mode === 'client'"
          :form="form"
          :networks="networks"
          :scanning="scanning"
          @scan="scan"
          @disconnect="disconnect"
        />

        <template v-else-if="mode === 'concurrent'">
          <div class="set-net-tabs">
            <button class="set-net-tab" :class="{ on: tab === 'wifi' }" type="button" @click="tab = 'wifi'">
              {{ t('settingsNetTypeWifi') }}
            </button>
            <button class="set-net-tab" :class="{ on: tab === 'hotspot' }" type="button" @click="tab = 'hotspot'">
              {{ t('settingsNetTypeHotspot') }}
            </button>
          </div>
          <!-- v-if 而非 v-show:sp8-P2a 记过 v-show 的窄屏回归坑 -->
          <WifiForm
            v-if="tab === 'wifi'"
            :form="form"
            :networks="networks"
            :scanning="scanning"
            @scan="scan"
            @disconnect="disconnect"
          />
          <HotspotForm v-else :form="form" />
        </template>

        <div v-else class="set-net-choose-wrap">
          <p class="set-net-hint">{{ t('settingsNetUnconfigured') }}</p>
          <div class="set-net-choose">
            <button class="set-btn primary" type="button" @click="setMode('client')">
              {{ t('settingsNetConnectWifi') }}
            </button>
            <button class="set-btn primary" type="button" @click="setMode('ap')">
              {{ t('settingsNetCreateHotspot') }}
            </button>
          </div>
        </div>
      </template>

      <div v-else class="set-net-form">
        <label class="set-net-field">
          <span class="set-net-label">{{ t('settingsNetZone') }}</span>
          <select v-model="form.zone" class="set-select set-net-zone">
            <option value="">{{ t('settingsNetZoneNone') }}</option>
            <option value="lan">{{ t('settingsNetZoneLan') }}</option>
            <option value="wan">{{ t('settingsNetZoneWan') }}</option>
          </select>
        </label>

        <template v-if="isThunderbolt">
          <p class="set-net-hint">{{ t('settingsNetTbStatic') }}</p>
          <label class="set-net-field">
            <span class="set-net-label">{{ t('settingsNetIpAddress') }}</span>
            <input v-model="form.ipv4.address" class="set-input set-net-ip" type="text" placeholder="169.254.1.1" />
          </label>
          <label class="set-net-field">
            <span class="set-net-label">{{ t('settingsNetNetmask') }}</span>
            <input v-model="form.ipv4.netmask" class="set-input set-net-mask" type="text" placeholder="255.255.0.0" />
          </label>
          <label class="set-net-field">
            <span class="set-net-label">{{ t('settingsNetGateway') }}</span>
            <input v-model="form.ipv4.gateway" class="set-input set-net-gw" type="text" placeholder="0.0.0.0" />
          </label>
          <label class="set-net-field">
            <span class="set-net-label">{{ t('settingsNetDns') }}</span>
            <input v-model="form.dnsText" class="set-input set-net-dns" type="text" placeholder="8.8.8.8, 1.1.1.1" />
          </label>
        </template>

        <template v-else>
          <label class="set-net-field">
            <span class="set-net-label">{{ t('settingsNetIpv4Method') }}</span>
            <select v-model="form.ipv4.method" class="set-select set-net-method">
              <option value="dhcp">{{ t('settingsNetIpv4Dhcp') }}</option>
              <option value="static">{{ t('settingsNetIpv4Static') }}</option>
            </select>
          </label>
          <template v-if="form.ipv4.method === 'static'">
            <label class="set-net-field">
              <span class="set-net-label">{{ t('settingsNetIpAddress') }}</span>
              <input v-model="form.ipv4.address" class="set-input set-net-ip" type="text" placeholder="192.168.1.100" />
            </label>
            <label class="set-net-field">
              <span class="set-net-label">{{ t('settingsNetNetmask') }}</span>
              <input v-model="form.ipv4.netmask" class="set-input set-net-mask" type="text" placeholder="255.255.255.0" />
            </label>
            <label class="set-net-field">
              <span class="set-net-label">{{ t('settingsNetGateway') }}</span>
              <input v-model="form.ipv4.gateway" class="set-input set-net-gw" type="text" placeholder="192.168.1.1" />
            </label>
            <label class="set-net-field">
              <span class="set-net-label">{{ t('settingsNetDns') }}</span>
              <input v-model="form.dnsText" class="set-input set-net-dns" type="text" placeholder="8.8.8.8, 1.1.1.1" />
            </label>
          </template>
        </template>
      </div>

      <p v-if="error" class="set-danger">{{ error }}</p>
    </div>

    <template #footer>
      <button class="set-btn" type="button" :disabled="saving" @click="emit('update:open', false)">
        {{ t('settingsCancel') }}
      </button>
      <button class="set-btn primary set-net-save" type="button" :disabled="saving" @click="save">
        {{ t('settingsNetSaveApply') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.set-net-dialog { display: flex; flex-direction: column; gap: 10px; min-width: min(460px, 84vw); }
.set-net-choose-wrap { text-align: center; padding: 12px 0; }
</style>
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test NetworkIfaceConfigDialog && pnpm exec vue-tsc --noEmit
```
预期:全绿、tsc 0。**若「过期守卫」那条一开始就绿** → 先把 `scanGen` 的判断注掉确认它会红(否则守卫是空转的),再改回。

- [ ] **Step 5: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/panels/network/NetworkIfaceConfigDialog.vue src/settings/panels/network/NetworkIfaceConfigDialog.test.ts
git commit src/settings/panels/network/NetworkIfaceConfigDialog.vue src/settings/panels/network/NetworkIfaceConfigDialog.test.ts \
  -m "feat(settings): network 接口配置弹窗(五分支 + 扫描过期守卫 + 内联报错)"
```

---

## Task 9: `NetworkPanel.vue` 装配 —— 实时流 + 切模式两步流程

**Files:**
- Modify: `src/settings/panels/NetworkPanel.vue`(P0 骨架整体替换)
- Create: `src/settings/panels/network/NetworkPanel.integration.test.ts`
- Modify: `src/settings/panels/panels.test.ts`(P0 那条「NetworkPanel 渲染骨架提示」的断言要跟着改;**先读再改,别整文件重写**)

**Interfaces:**
- Consumes: Task 1 `service.network`,Task 2 `mergeInterfaces` / `MaxSpeedMemo`,Task 3 `switchTargetKey`,Task 5 `NetworkIfaceRow`,Task 8 `NetworkIfaceConfigDialog`,既有 `composables/useUtilization`、`components/ui/AlertDialog.vue`、`stores/toast`
- Produces:`/settings/network` 的完整页面(无对外接口)

- [ ] **Step 1: 先读 P0 的既有断言**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && grep -n -i 'network' src/settings/panels/panels.test.ts
```
把那条断言改成「渲染出「连接」小标题」,**不要动同文件里其它 tab 的断言**。

- [ ] **Step 2: 写失败的集成测试**

新建 `src/settings/panels/network/NetworkPanel.integration.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount, DOMWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'
import type { NetworkInterfaceConfig, NetworkInterfaceUpdate } from '@nimotech/nimoos-service'

// ── 真机 fixture(curl 实证 2026-07-31)────────────────────────────────────
const HTTP_NET = [
  { name: 'enp2s0', state: 'up', addr: '192.168.1.143', speed: 1000, max_speed: 1000 },
  { name: 'enp4s0', state: 'down', addr: '', speed: 0, max_speed: 1000 },
  { name: 'wlp1s0', state: 'down', addr: '', speed: 0, max_speed: 0 },
]
const CONFIGS: NetworkInterfaceConfig[] = [
  { name: 'enp2s0', type: 'ethernet', is_virtual: false, mac: '', state: '', ipv4: { method: 'dhcp' } },
  { name: 'enp4s0', type: 'ethernet', is_virtual: false, mac: '', state: '', ipv4: { method: 'dhcp' } },
]

const api = {
  configs: CONFIGS as NetworkInterfaceConfig[] | null,
  getCalls: 0,
  putCalls: [] as NetworkInterfaceUpdate[],
  putError: null as unknown,
}
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    network: {
      getInterfaces: async () => { api.getCalls++; return Array.isArray(api.configs) ? api.configs : [] },
      updateInterface: async (cfg: NetworkInterfaceUpdate) => {
        api.putCalls.push(cfg)
        if (api.putError) throw api.putError
      },
      scanWifi: async () => [],
    },
    sys: { getUtilization: async () => ({ cpu: null, mem: null, disk: null, gpu: null, net: HTTP_NET, usb: null }) },
  },
  parseUtil: (raw: Record<string, unknown>) => ({
    cpu: null, mem: null, disk: null, gpu: null, usb: null,
    net: typeof raw.sys_net === 'string' ? JSON.parse(raw.sys_net as string) : raw.sys_net,
  }),
  networkErrorText: (e: unknown) =>
    (e as { response?: { data?: { error?: string } } })?.response?.data?.error,
}))

// MessageBus:把注册的 handler 抓出来,测试里手动喂推送
let busHandler: ((props: unknown) => void) | null = null
vi.mock('../../../composables/useMessageBus', () => ({
  useMessageBus: () => ({
    on: (_e: string, cb: (props: unknown) => void) => { busHandler = cb; return () => { busHandler = null } },
  }),
}))

import NetworkPanel from '../NetworkPanel.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const body = () => new DOMWrapper(document.body)
const mountIt = () => mount(NetworkPanel, { global: { plugins: [i18n] }, attachTo: document.body })

beforeEach(() => {
  setActivePinia(createPinia())
  api.configs = CONFIGS; api.getCalls = 0; api.putCalls = []; api.putError = null
  busHandler = null
  document.body.innerHTML = ''
})

describe('NetworkPanel —— 列表装配', () => {
  it('三行:enp2s0(up/1 Gbps/DHCP+IP)、enp4s0(down)、wlp1s0(config 里没有也要在)', async () => {
    const w = mountIt(); await flushPromises()
    const rows = w.findAll('.set-net-row')
    expect(rows).toHaveLength(3)
    expect(rows[0].text()).toContain('enp2s0')
    expect(rows[0].text()).toContain('1 Gbps')
    expect(rows[0].text()).toContain('192.168.1.143')
    expect(rows[0].get('.set-net-dot').classes()).toContain('up')
    expect(rows[2].text()).toContain('wlp1s0')
    expect(rows[2].text()).toContain('Wi-Fi')
    w.unmount()
  })

  it('小标题是「连接」', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.text()).toContain('连接')
    w.unmount()
  })

  it('config 端点返回 null 也不炸,列表照出(降级)', async () => {
    api.configs = null
    const w = mountIt(); await flushPromises()
    expect(w.findAll('.set-net-row')).toHaveLength(3)
    w.unmount()
  })

  it('config 端点整个失败时列表仍在(只丢 zone/ipv4 那部分)', async () => {
    api.configs = null
    const w = mountIt(); await flushPromises()
    expect(w.find('.set-net-empty').exists()).toBe(false)
    w.unmount()
  })
})

describe('NetworkPanel —— 5 秒实时流(用户 2026-07-31 拍板接上)', () => {
  it('推送到达后 IP / 状态跟着变', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.findAll('.set-net-row')[1].text()).not.toContain('10.0.0.9')

    busHandler!({ sys_net: JSON.stringify([
      { name: 'enp2s0', state: 'up', addr: '192.168.1.143', speed: 1000, max_speed: 0 },
      { name: 'enp4s0', state: 'up', addr: '10.0.0.9', speed: 100, max_speed: 0 },
      { name: 'wlp1s0', state: 'down', addr: '', speed: 0, max_speed: 0 },
    ]) })
    await flushPromises()
    const rows = w.findAll('.set-net-row')
    expect(rows[1].text()).toContain('10.0.0.9')
    expect(rows[1].get('.set-net-dot').classes()).toContain('up')
    w.unmount()
  })

  it('⚠️ 推送里 max_speed 恒 0,速率标签**不许**从「1 Gbps」变形(MaxSpeedMemo 生效)', async () => {
    // 造一个 2.5G 上限、协商在 1G 的口 —— 这是本机看不出来、别的机器一定会闪的形态
    HTTP_NET[0].max_speed = 2500
    const w = mountIt(); await flushPromises()
    expect(w.findAll('.set-net-row')[0].text()).toContain('1 Gbps / 2.5 Gbps')

    busHandler!({ sys_net: JSON.stringify([{ name: 'enp2s0', state: 'up', addr: '192.168.1.143', speed: 1000, max_speed: 0 }]) })
    await flushPromises()
    expect(w.findAll('.set-net-row')[0].text()).toContain('1 Gbps / 2.5 Gbps')
    HTTP_NET[0].max_speed = 1000   // 还原,别影响别的用例
    w.unmount()
  })
})

describe('NetworkPanel —— 切模式两步流程(Vue2 switchWifiMode :2199-2234)', () => {
  const WIFI_CFG: NetworkInterfaceConfig[] = [
    ...CONFIGS,
    { name: 'wlp1s0', type: 'wifi', is_virtual: false, mac: '', state: '', zone: 'wan',
      ipv4: { method: 'dhcp' }, wireless: { mode: 'client' }, hybridCapable: true },
  ]

  async function openSwitchConfirm(target = 1) {
    api.configs = WIFI_CFG
    const w = mountIt(); await flushPromises()
    // 第三行(wlp1s0)的菜单:reka 菜单在 jsdom 里不便真开 → 直接触发子组件事件
    const row = w.findAllComponents({ name: 'NetworkIfaceRow' })[2]
    row.vm.$emit('switchMode', target === 1 ? 'ap' : 'concurrent')
    await flushPromises()
    return w
  }

  it('先弹确认框,文案带目标模式与网卡名', async () => {
    const w = await openSwitchConfirm()
    expect(body().text()).toContain('切换模式')
    expect(body().text()).toContain('切换到 热点？这将改变 wlp1s0 的工作模式。')
    expect(api.putCalls).toEqual([])
    w.unmount()
  })

  it('点取消:一个 PUT 都不发,弹窗不开', async () => {
    const w = await openSwitchConfirm()
    await body().get('.ui-dialog-footer .ui-btn').trigger('click')   // 第一个是 Cancel
    await flushPromises()
    expect(api.putCalls).toEqual([])
    expect(body().find('.set-net-save').exists()).toBe(false)
    w.unmount()
  })

  it('点确认:先裸切 {name, wireless:{mode}},再打开配置弹窗,并重取 config', async () => {
    const w = await openSwitchConfirm()
    const before = api.getCalls
    await body().findAll('.ui-dialog-footer .ui-btn')[1].trigger('click')
    await flushPromises()
    expect(api.putCalls).toEqual([{ name: 'wlp1s0', wireless: { mode: 'ap' } }])
    expect(api.getCalls).toBeGreaterThan(before)
    expect(body().find('.set-net-save').exists()).toBe(true)          // 配置弹窗开了
    expect(body().find('.set-net-apssid').exists()).toBe(true)        // 且已经是热点表单
    w.unmount()
  })

  it('裸切失败:toast 报错、**不开配置弹窗** —— 移植纪律 #3(Vue2 只 console.error 就继续开)', async () => {
    api.putError = { response: { data: { error: 'failed to apply gateway rules' } } }
    const w = await openSwitchConfirm()
    await body().findAll('.ui-dialog-footer .ui-btn')[1].trigger('click')
    await flushPromises()
    expect(body().find('.set-net-save').exists()).toBe(false)
    w.unmount()
  })

  it('切混合模式:配置弹窗以 concurrent 双 tab 打开', async () => {
    const w = await openSwitchConfirm(2)
    await body().findAll('.ui-dialog-footer .ui-btn')[1].trigger('click')
    await flushPromises()
    expect(api.putCalls).toEqual([{ name: 'wlp1s0', wireless: { mode: 'concurrent' } }])
    expect(body().findAll('.set-net-tab').map((t) => t.text())).toEqual(['Wi-Fi', '热点'])
    w.unmount()
  })
})

describe('NetworkPanel —— 编辑与保存后刷新', () => {
  it('行的 edit 事件打开配置弹窗(标题按类型派生)', async () => {
    const w = mountIt(); await flushPromises()
    w.findAllComponents({ name: 'NetworkIfaceRow' })[0].vm.$emit('edit')
    await flushPromises()
    expect(body().get('.ui-dialog-title').text()).toBe('以太网 - enp2s0')
    w.unmount()
  })

  it('弹窗 saved:重取 config(不再有 Vue2 那个 4×2s 轮询 —— 实时流已经在刷 addr)', async () => {
    const w = mountIt(); await flushPromises()
    const before = api.getCalls
    w.findComponent({ name: 'NetworkIfaceConfigDialog' }).vm.$emit('saved')
    await flushPromises()
    expect(api.getCalls).toBe(before + 1)
    w.unmount()
  })
})

describe('NetworkPanel —— 空态', () => {
  it('utilization 没给 net 时显示「未找到网络接口」', async () => {
    const saved = HTTP_NET.splice(0, HTTP_NET.length)
    const w = mountIt(); await flushPromises()
    expect(w.get('.set-net-empty').text()).toContain('未找到网络接口')
    HTTP_NET.push(...saved)
    w.unmount()
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test NetworkPanel
```
预期:FAIL —— 当前 NetworkPanel 只是骨架。

- [ ] **Step 4: 写 `src/settings/panels/NetworkPanel.vue`**

```vue
<script setup lang="ts">
// 设置 · 网络。对位 Vue2 SettingsPanel.vue 的 network 分支(L492-585)+ loadNetworkData(:2134)
// + switchWifiMode(:2199)+ openIfaceConfig(:2241)。
//
// 数据装配(spec §1.7):**列表源 = /v1/sys/utilization 的 net(实时枚举)**,
//   /v2/nimoos/network/interfaces 只按 name 匹配后补 zone/type/ipv4/wireless/hybridCapable。
//   合并逻辑全在 util/netMerge.ts(纯函数 + 单测)。
//
// 实时性(用户 2026-07-31 拍板):列表接 MessageBus 的 5 秒 utilization 流(useUtilization
//   = 首次 HTTP 取 + 订阅推送)。因此:
//   移植纪律 #2(登记):**删掉 Vue2 保存后那段 4×2s 的 setInterval 补抓 DHCP 地址** ——
//   实时流本来就会把新地址刷出来,而 Vue2 那个定时器还漏了卸载停表。保存后只重取一次 config。
//   ⚠️ 推送里 max_speed 恒 0(periodical.go 少了那一行),靠 MaxSpeedMemo 记住 HTTP 那次的真值,
//   否则速率标签会每 5 秒变形。
//
// 移植纪律 #3(登记):Vue2 的裸切模式失败只 console.error 就继续打开配置弹窗(用户以为切好了)
//   → 这里失败就 toast 报错并且**不开弹窗**。
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, networkErrorText, type NetworkInterfaceConfig } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import AlertDialog from '../../components/ui/AlertDialog.vue'
import NetworkIfaceRow from './network/NetworkIfaceRow.vue'
import NetworkIfaceConfigDialog from './network/NetworkIfaceConfigDialog.vue'
import { mergeInterfaces, MaxSpeedMemo, type MergedIface } from '../util/netMerge'
import { switchTargetKey } from '../util/ifaceDisplay'
import { useUtilization } from '../../composables/useUtilization'
import { useToast } from '../../stores/toast'
import '../styles/settings.css'

const { t } = useI18n()
const toast = useToast()
const util = useUtilization()          // onMounted 首取 + 订阅 nimoos:system:utilization
const memo = new MaxSpeedMemo()

const configs = ref<NetworkInterfaceConfig[]>([])
const configLoaded = ref(false)

const rows = computed<MergedIface[]>(() => mergeInterfaces(util.data?.net, configs.value, memo))
const loading = computed(() => !configLoaded.value && rows.value.length === 0)

// 配置弹窗
const dlgOpen = ref(false)
const dlgIface = ref<MergedIface | null>(null)
const dlgSwitchMode = ref<'ap' | 'client' | 'concurrent' | undefined>(undefined)
const dlgSwitchTab = ref<'hybrid' | undefined>(undefined)

// 切模式确认框
const confirmOpen = ref(false)
const pending = ref<{ iface: MergedIface; target: 'ap' | 'client' | 'concurrent' } | null>(null)
const confirmMsg = computed(() => {
  const p = pending.value
  if (!p) return ''
  return t('settingsNetSwitchMsg', { mode: t(switchTargetKey(p.target)), iface: p.iface.name })
})

async function loadConfigs() {
  try {
    configs.value = await service.network.getInterfaces()
  } catch (e) {
    // 降级:config 拿不到时列表仍然出(只是没有 zone/ipv4/wireless 那部分)——Vue2 同样 .catch(() => [])
    console.warn('[settings] getInterfaces failed', e)
    configs.value = []
  } finally {
    configLoaded.value = true
  }
}
void loadConfigs()

function openConfig(iface: MergedIface, opts: { switchMode?: 'ap' | 'client' | 'concurrent'; switchTab?: 'hybrid' } = {}) {
  if (iface.isVirtual) return          // 虚拟口不给配置(Vue2 openIfaceConfig 的第一行)
  dlgIface.value = iface
  dlgSwitchMode.value = opts.switchMode
  dlgSwitchTab.value = opts.switchTab
  dlgOpen.value = true
}

function askSwitch(iface: MergedIface, target: 'ap' | 'client' | 'concurrent') {
  pending.value = { iface, target }
  confirmOpen.value = true
}

async function doSwitch() {
  const p = pending.value
  confirmOpen.value = false
  if (!p) return
  // 第一步:裸切模式(照抄 Vue2 —— 先切了,弹窗里的 wifi 扫描才有结果)
  try {
    await service.network.updateInterface({ name: p.iface.name, wireless: { mode: p.target } })
  } catch (e) {
    toast.show(networkErrorText(e) || t('settingsNetSwitchFailed'))
    pending.value = null
    return                              // 移植纪律 #3:切失败就不要再打开弹窗
  }
  await loadConfigs()
  // 第二步:打开配置弹窗。用重取后的 config 重新合并出的那一行(拿到后端刚落的 mode)
  const fresh = rows.value.find((r) => r.name === p.iface.name) ?? p.iface
  if (p.target === 'concurrent') openConfig(fresh, { switchTab: 'hybrid' })
  else openConfig(fresh, { switchMode: p.target })
  pending.value = null
}

async function onSaved() {
  toast.show(t('settingsNetApplied'))   // 成功提示在弹窗关掉之后弹,否则被遮罩压住+糊掉
  await loadConfigs()
}
</script>

<template>
  <SettingsSection :title="t('settingsTabNetwork')">
    <p class="set-net-section-title">{{ t('settingsNetConnection') }}</p>
    <div class="set-net-card">
      <div v-if="loading" class="set-net-loading">{{ t('settingsLoading') }}</div>
      <template v-else-if="rows.length">
        <NetworkIfaceRow
          v-for="iface in rows"
          :key="iface.name"
          :iface="iface"
          @edit="openConfig(iface)"
          @switch-mode="askSwitch(iface, $event)"
        />
      </template>
      <div v-else class="set-net-empty">{{ t('settingsNetEmpty') }}</div>
    </div>

    <AlertDialog
      v-model:open="confirmOpen"
      :title="t('settingsNetSwitchTitle')"
      :message="confirmMsg"
      :confirm-text="t('settingsConfirm')"
      :cancel-text="t('settingsCancel')"
      @confirm="doSwitch"
    />

    <NetworkIfaceConfigDialog
      v-model:open="dlgOpen"
      :iface="dlgIface"
      :switch-mode="dlgSwitchMode"
      :switch-tab="dlgSwitchTab"
      @saved="onSaved"
    />
  </SettingsSection>
</template>

<style scoped>
.set-net-section-title { font-size: 12px; color: var(--fg-muted); margin: 0 0 8px; }
</style>
```

⚠️ **`settingsLoading` 这个 key 若 P0/P1 没有** → 先 `grep -n "settingsLoading" src/i18n/*.sp9.ts src/i18n/zh_cn.ts`;没有就加进两份分片(中文「加载中...」/ 英文 `Loading...`),Vue2 那里是个 `b-loading` 转圈没有文字,**用文字是既有的 loading 表达差异,不是新偏离**(P0 骨架已用同款)。

- [ ] **Step 5: 跑本任务测试**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test NetworkPanel panels && pnpm exec vue-tsc --noEmit
```
预期:全绿、tsc 0。

- [ ] **Step 6: 跑全量任务门**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test 2>&1 | tail -6
```
预期:文件数 289 → **296**(+6 个新测试文件 +1 …注意 color-guard 是同一个文件、只是用例变多),用例数应 ≥ 2190 + 本期新增(约 100)+ 6(color-guard 按 6 个新 `.vue` 各加一条)。**零失败**。

- [ ] **Step 7: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/panels/network/NetworkPanel.integration.test.ts
git commit src/settings/panels/NetworkPanel.vue src/settings/panels/network/NetworkPanel.integration.test.ts \
  src/settings/panels/panels.test.ts src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts \
  -m "feat(settings): network 页装配(5 秒实时流 + 切模式两步 + 保存后重取)"
```

---

## Task 10: 收尾 —— 全量门 + 浏览器自查 + 台账与 roadmap

**Files:**
- Create: `.superpowers/sdd/sp9/03-p2.md`(**gitignore,不进 git**)
- Create: `.superpowers/sdd/sp9/03-p2-acceptance.md`(**gitignore**)
- Modify: `/home/nimo/NimoTech/NimoOS-UI/docs/vue3-migration-roadmap.md`(§4 SP9 追加 P2 关账段)

- [ ] **Step 1: 全量任务门**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test 2>&1 | tail -6
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vue-tsc --noEmit && echo "TSC OK"
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm build 2>&1 | tail -3
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test 2>&1 | tail -4
```
判定:**相对基线不新增红**(基线 New-UI 289/2190、Service 24/161、tsc 0、build 通过)。数值对不上先想 color-guard 按文件生成用例。

- [ ] **Step 2: 起 dev server 做浏览器自查**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm dev --host
```
浏览器 `http://192.168.1.143:5273/app/#/settings/network`。

**⛔ 自查期间绝对不许做的**(§写路径禁令):
- 不许点配置弹窗的**「保存并应用」**
- 不许点切模式确认框的**「确认」**(点「取消」可以)
- 不许点 Wi-Fi 列表里的**「断开连接」**
- 不许用 curl 发任何 `PUT /v2/nimoos/network/interfaces`

**能自查的 8 项**(全部只读/不落库):
1. 三行接口都在:`enp2s0`(绿点 / `1 Gbps` / `DHCP 192.168.1.143`)、`enp4s0`(灰点)、`wlp1s0`(灰点、类型名 `Wi-Fi`)
2. 类型名正确:前两行「以太网」、第三行「Wi-Fi」
3. 5 秒实时:盯 5-10 秒,状态点/IP 不闪、速率标签**不在「1 Gbps」与别的形态之间跳**
4. `enp2s0` 的 ⋮ 菜单:**只有「编辑」一项**(config 里没有 wireless)
5. 点「编辑」→ 弹窗标题是 **「以太网 - enp2s0」**(不是「Wi-Fi - enp2s0」);内容 = 网络区域(无/LAN/WAN)+ IPv4 分配(自动 (DHCP))
6. 把 IPv4 分配切到「手动 (静态 IP)」→ 出现 IP 地址 / 子网掩码 / 网关 / DNS 四个框(**填了也别保存**)→ 点「取消」关掉
7. `wlp1s0` 的 ⋮ 菜单:「编辑」+「切换到热点」(**没有**「切换到混合模式」—— 本机 config 里没有 wlp1s0 → `hybridCapable` 取不到,§实测校正 9)。点「切换到热点」→ 弹出确认框 → **点取消**
8. 亮色 / 暗色主题各看一遍:状态点绿/灰是否分得清、标签 chip 对比度、弹窗内下拉与输入框可读

**若浏览器自查受阻于认证**(P1 台账 §八点五:localhost 免鉴权的前提是完全不带 `Authorization`,假 token 会 401 → 被踢回登录页):**不要再试「往 `public/` 放 HTML 写假 token」那套手法**,直接把 0/8 的事实写进台账,并在验收清单里请机主本人过一遍。

- [ ] **Step 3: 写台账 `.superpowers/sdd/sp9/03-p2.md`**

必须包含这些小节(照 `02-p1.md` 的结构):
1. **任务门**表(基线 → P2 末)
2. **交付物**清单
3. **实测校正**:把本计划 §实测校正 那 9 条搬进去(**这是本期最值钱的产出,后续期直接引用**)
4. **移植纪律登记** 8 条
5. **授权偏离**:第 7 处(弹窗标题按类型派生)、第 8 处(9 条缺译补中文)
6. **⛔ 写路径整体未验机**:写清 §写路径禁令 的三条依据 + 「哪些只有机主在机器旁才能关账」
7. **变异验证结果**(Task 4 Step 6 的三次)
8. **浏览器自查** N/8
9. **新增债务**(见下)
10. **交给 P3 的事**

- [ ] **Step 4: 债务登记(写进台账 + roadmap)**

| 编号 | 内容 | 归属 |
|---|---|---|
| **D18** | **network 写路径(保存并应用 / 切模式确认 / 断开连接)零实机验证** —— 后端 handler 末尾无条件 `ApplyGatewayConfig()` 重写 dnsmasq/nftables/ip_forward,而开发机的 SSH 生命线就是被配置的那张网卡。**性质同 P1 的 D17:破坏性 + 只能在浏览器里验 = 只有机主本人在机器旁时能关账。** 覆盖:`buildUpdatePayload` 26 例单测 + `hydrateForm` 全模式单测 + 变异验证 | **需用户在机器旁排期** |
| **D19** | **`hybridCapable` / concurrent 双 tab / 「虚拟网络」行 在本机不可达** —— 前者要 config 里先有 wifi 口(`setHybridCapable` 只算 config 里已有的),后者要 `data.net` 里出现虚拟口(而 `GetNet(true)` 只给物理口)。这三处只有单测,无实机证据 | 记录即可;换有 Wi-Fi 配置/ZeroTier 的机器时顺手看一眼 |
| **D20** | **后端两条腿字段不一致**:`GET /v1/sys/utilization` 有 `max_speed`,MessageBus 5 秒推送没有(`NimoOS/route/periodical.go:44-47` 少 `item.MaxSpeed`)。前端用 `MaxSpeedMemo` 绕过了,但正解是后端补上那一行 | **后端票** |
| **D21** | **network 域的错误体是 `{"error": …}`,与全系统 `Result{Success,Message,Data}` 不一致**,共享包的 axios 拦截器认不出来(它认 `message`)→ 每个消费方都得自己走 `networkErrorText` | 后端票(统一信封)/ 记录 |

- [ ] **Step 5: 更新 roadmap §4 SP9**

在 P1 关账段之后追加 P2 段(**改前先 `cd /home/nimo/NimoTech/NimoOS-UI && git log -1`**,改动尽量小、改完立刻提交 —— sp7 会话也在写这个仓的文档)。要写进去的重点:
- 坐标(New-UI / Service 的起止 commit)、任务门数值
- §实测校正 的 9 条(尤其 **①列表源是 utilization 不是 config、②推送缺 max_speed、③scan 失败是 200+null、④错误键是 error**)
- **写路径整体未验机 = D18**,与 D17 同性质
- 授权偏离 #7 / #8
- 计划与台账路径

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git log -1
git commit docs/vue3-migration-roadmap.md -m "docs(sp9): P2 设置 network 交付与实测校正入账"
```

- [ ] **Step 6: 写验收清单 `.superpowers/sdd/sp9/03-p2-acceptance.md`**

**给用户的清单只列能安全验的项**,并把不能验的单独成节说明理由。骨架:

```markdown
# SP9-P2 验收清单(设置 · 网络)

代码坐标:New-UI `master` @ <sha> · NimoOS-Service `master` @ <sha>。**未推 origin、未部署。**

## 怎么起
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm dev --host
浏览器 http://192.168.1.143:5273/app/#/settings/network
> **不要跑 ./scripts/deploy.sh**(sp7/sp8 未合,/app/ 不能动)

## ⛔ 这一期有三个地方**请不要点**(会改这台机器的网络,可能把你自己关在门外)
1. 配置弹窗的「保存并应用」
2. 切模式确认框的「确认」(「取消」可以点)
3. Wi-Fi 列表里的「断开连接」
理由:后端那个 PUT 在末尾**无条件**重写 dnsmasq / nftables / ip_forward,而你连过来的
那张网卡(enp2s0)就是列表第一行。已按你 2026-07-31 的指示挂成债务 D18,等你在机器旁边时再验。

## 逐项验收(预期值都是从这台机器 curl 出来的真实值)
| # | 操作 | 预期 |
|---|---|---|
| 1 | 看列表 | 小标题「连接」,一张卡里 **3 行**:enp2s0 / enp4s0 / wlp1s0 |
| 2 | 第一行 | 绿点 · 类型名「以太网」· 标签依次 `enp2s0`、`1 Gbps`、`DHCP 192.168.1.143` |
| 3 | 第二行 | 灰点 · 「以太网」· 只有 `enp4s0` 一个标签(没插线,speed=0、无 IP) |
| 4 | 第三行 | 灰点 · 类型名「Wi-Fi」· 只有 `wlp1s0` 一个标签。**这一行在旧 UI 里也在,但它不在配置文件里** |
| 5 | 盯 10 秒 | 标签不闪、速率一直是 `1 Gbps`(数据每 5 秒刷新一次) |
| 6 | enp2s0 的 ⋮ | **只有「编辑」** |
| 7 | 点「编辑」 | 标题 **「以太网 - enp2s0」**(旧 UI 这里写死显示「Wi-Fi - enp2s0」,是 bug,已按拍板改)· 内容:网络区域(无)+ IPv4 分配(自动 (DHCP)) |
| 8 | IPv4 分配 → 手动 | 出现 IP 地址 / 子网掩码 / 网关 / DNS 四行。**填了也别点保存**,点「取消」 |
| 9 | wlp1s0 的 ⋮ | 「编辑」+「切换到热点」。**没有「切换到混合模式」**(本机取不到 hybridCapable,见债务 D19) |
| 10 | 点「切换到热点」 | 弹确认框「切换到 热点?这将改变 wlp1s0 的工作模式。」→ **点取消** |
| 11 | 亮/暗主题各看 | 状态点绿/灰分得清、标签对比度够、弹窗里下拉和输入框可读 |
| 12 | 窄屏 ~420px | 行不塌、标签换行、弹窗不溢出 |

## 已知的、不用报给我的
- 「切换到混合模式」看不到 —— 债务 D19
- 弹窗标题从「Wi-Fi - x」改成按类型派生 —— 你 2026-07-31 拍板的(授权偏离 #7)
- 中文界面下「连接 / 以太网 / 虚拟网络 …」有了中文 —— 旧 UI 这几处是英文(所有语言都缺译),你拍板补的(授权偏离 #8)
```

- [ ] **Step 7: 最后确认 index 干净**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && git status --short && git log --name-only bcb991b..HEAD | grep -c design-export
```
预期:那 3 行 `D design-export/...` **仍在原位**;`grep -c` = **0**(本期一个 commit 都没顺走它们)。

---

## Self-Review

**1. spec 覆盖**(§5.3 逐条):

| spec §5.3 的要求 | 落点 |
|---|---|
| 数据装配照 §1.7(utilization 为源、config 补充、跳 `wlan_ap`、`isVirtual` 按名字前缀) | Task 2 |
| 接口行(状态点 / 类型名派生 / 速率标签 / DHCP·Static + IP 标签) | Task 5 |
| 溢出菜单按 `wireless.mode` 与 `hybridCapable` 决定项 | Task 5 |
| `NetworkIfaceConfigModal`(431 行)对位物 | Task 8 |
| `WifiForm`(135 行)对位物 | Task 6 |
| `HotspotForm`(69 行)对位物 | Task 7 |
| 切模式两步流程(先裸切再开弹窗) | Task 9 |
| `network` 域三个方法 + 裸 JSON 零 unwrap | Task 1 |
| 类型逐字照 `model/network.go`,蛇形/驼峰混用照留 | Task 1 Step 3 |
| `PUT` 成功返回 `{"message":"success"}` 无数据 | Task 1(`Promise<void>`) |

**2. 占位符扫描**:无 TBD / TODO / "similar to Task N";每个代码步骤都有完整可运行代码。**故意留的一处例外**:Task 8 测试里「保存中按钮禁用」那条被明确标注为空转形状并要求实现者重写 —— 这是有意的能力检查,已在原地写清要求。

**3. 类型一致性**:
- `MergedIface` 由 Task 2 定义,Task 3/4/5/8/9 一致引用;
- `IfaceFormState` 由 Task 4 定义,Task 6/7/8 一致引用;
- `NetworkInterfaceUpdate` 由 Task 1 定义,Task 4 `buildUpdatePayload` 返回、Task 8/9 传给 `updateInterface`;
- `WifiScanResult` 由 Task 1 定义,Task 6/8 一致引用;
- 事件名:Task 5 emit `switchMode`(模板上写 `@switch-mode`,Vue 的 kebab 映射)、`edit`;Task 8 emit `update:open` / `saved` —— Task 9 的消费与之对齐;
- 文案 key 前缀 `settingsNet*` 在 Task 3 一次定义,Task 5-9 全部引用同名。

**4. 已知遗留(有意,不是漏)**:`.set-net-scan-btn` / `.set-net-save` / `.set-net-password` 等 hook class 只为测试选择器存在,不带样式 —— 与仓库既有做法一致(`.wh-save`、`.card-primary`)。
