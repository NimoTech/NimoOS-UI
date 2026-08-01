# SP9-P5 — KVM 列表 + 控制台(noVNC)+ 电源 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:subagent-driven-development 逐任务执行本计划。步骤用 `- [ ]` 复选框跟踪。

**Goal:** 把 Vue2 `components/KVM/KVMFullPage.vue`(3153 行)的**列表 + 控制台 + 电源**部分 1:1 迁到 New-UI `src/kvm/`,路由 `/kvm`;`kvm` 域(25 方法)进共享包。

**Architecture:** 共享包新建 `NimoOS-Service/src/kvm.ts`(自带 `kvmUnwrap`,信封层数**每方法写死**);New-UI 新建 `src/kvm/` 模块,拆成 `util/`(纯函数)+ `composables/`(列表状态、VNC 生命周期)+ `components/`(7 个展示组件)+ `views/KvmPage.vue`(组装)。状态刷新走 **MessageBus 事件**(照 Vue2,非轮询)。

**Tech Stack:** Vue 3 `<script setup lang="ts">` · Pinia 不用(本期用 composable 局部状态,与 Vue2 单组件作用域一致)· vitest + @vue/test-utils · `@novnc/novnc@^1.7.0`(P0 已装)· `vue-i18n`

---

## Global Constraints

以下每条对**每个任务**都生效,不再逐任务重复。

1. **界面严格 1:1,逻辑照正确**(记忆 `vue2-port-visual-only-fix-logic`,用户 2026-07-27 拍板):像素、文案、交互顺序照 Vue2;Vue2 的 bug / 竞态 / 吞错**不照抄**,改正确并在代码里注释登记偏离。**禁止无关重构。**
2. **颜色必须走 token**。`src/kvm/styles/kvm.css` 里不许出现裸 `#hex` / `rgb()` / `rgba()` / `hsl()`,一律 `var(--kvm-*)`。token 定义在 `src/styles/theme.sp9.css`(该文件在 color-guard 跳过名单里,允许字面量)。守卫:`src/styles/color-guard.test.ts`、`src/styles/theme.sp9.test.ts`。
3. **theme.sp9.css 里每个 token 必须在 `:root` 与 `:root[data-theme='light']` 两块都有值**,否则 `theme.sp9.test.ts` 翻红。
4. **KVM 区固定深色,不跟随全局主题** —— Vue2 该页是写死的深色控制台配色(`#0d1117`/`#161b22`/`#21262d`/`#30363d`),浅色主题下也保持深色。做法:`--kvm-*` token 在两个主题块里给**相同的值**,并在 theme.sp9.css 里注释写明原因(先例:`--console-bg`/`--console-fg` 同样两套主题同值)。
5. **文案只落分片** `src/i18n/zh_cn.sp9.ts` / `src/i18n/en_us.sp9.ts`,**不改** `zh_cn.ts` / `en_us.ts`。扁平 key、值必须是字符串(`parity.test.ts` 断言 `typeof v === 'string'`)。中文以 Vue2 `zh_CN.json` 为准,查不到的再看组件内联 `zh:` 字段(记忆 `newui-zh-copy-source-of-truth`)。
6. **测试里读 `.css` 一律用 `node:fs`** —— `?raw` 对 `.css` 在 vitest 下恒为空串(记忆:color-guard 曾因此空转)。
7. **异步写共享 state 必带过期守卫**(记忆 `newui-async-stale-guard`,已被评审逮到四次):就地写 `let alive = true` / 代际计数器,**不要抽公共 guard**。回归测试必须走交错路径。
8. **图标按钮一律单色符号 + `aria-label`,别用 emoji**(P4 教训)。
9. **弹窗内报错不用 toast**,用内联 `.set-danger` 同款做法(记忆 `newui-dialog-error-not-toast`)。本期无表单弹窗,但错误态同理:错误显示在控制台占位区内联,不用全局 toast 顶掉。
10. **提交必须带显式 pathspec**(`git add <具体路径>`),**绝不 `git add -A` / `git commit -a`** —— 主工作树 index 里躺着 3 个 `design-export/*` 的 staged 删除,不属本期,卷进去就毁了(SP9 台账事故)。**此工作树永远别 `git checkout` / `git stash`。**
11. **任务门 = 跑全量测试**(`pnpm test`),不是只跑本任务的。判定标准是「相对基线不新增红」。基线:master `2735377` 上 `pnpm test` = **324 文件 / 2660 例全绿**。
12. 评审 **禁用 haiku**,且评审者必须**自己读源文件**,不能只看 diff 摘要(SP8 教训)。**未申报的偏离即缺陷。**
13. Vue2 源文件全部在 `/home/nimo/NimoTech/NimoOS-UI/src/`;New-UI 在 `/home/nimo/NimoTech/NimoOS-New-UI/`;共享包在 `/home/nimo/NimoTech/NimoOS-Service/`。三个仓都在 `master` 主工作树上做。

### 后端事实速查(实测 2026-08-02,逐条核过源码)

**信封**:`NimoOS-KVM/common/response.go` = `{success: bool, data, message}`,**不是**全系统的 `Result{Success:int,...}`。`data` 的嵌套层数**按端点不同**,**写死,禁止自动探测**(历史教训:核字段名 ≠ 核信封层数):

| 端点 | 取值路径 | 依据 |
|---|---|---|
| `GET /vms` | `data.data`(数组)、`data.total` | `route/v2/vms.go:23` |
| `GET /vms/:id` · `PUT /vms/:id` · `POST /vms` | `data.data` | `vms.go:32,67,101` |
| `GET /vms/:vm_id/snapshots` · `POST .../snapshots` | `data.data` | `snapshots.go:23,37` |
| `PUT /settings` | `data.data`(回显请求体) | `settings.go:51` |
| `GET /isos/:id` | `data.data` | `isos.go:30` |
| **`GET /isos`** | **`data`(直接是数组)** | `isos.go:21` |
| **`GET /settings`** | **`data`(直接是对象)** | `settings.go:26-38` |
| **`GET /vms/:id/vnc`** | **`data`** | `vms.go:158` |
| 控制动作 / `DELETE` / `boot` / `autostart` / `progress` / 快照删除·恢复 | `data` | `vms.go:109..195` |

**MessageBus 事件**(`NimoOS-KVM/common/constants.go:15-21`,全部实际在发):
`kvm:vm_created` · `kvm:vm_deleted` · `kvm:vm_started` · `kvm:vm_stopped` · `kvm:vm_paused` · `kvm:vm_resumed` · `kvm:vm_autostart_changed`。载荷在 `Properties.vm_id`(New-UI `useMessageBus` 的 `extractProps` 已负责剥 `Properties`)。

**`GET /v1/kvm/settings` 实测响应**(比 `model/settings.go` 多 5 个字段,handler 里手拼的 map):
```json
{"success":true,"data":{"autostart":false,"availableDiskGB":263,"availableMemoryMB":10254,
 "cpuCores":6,"defaultDiskSize":20,"defaultMemory":2048,
 "networkInterfaces":["enp2s0","enp4s0","wlp1s0"],"storagePath":"/DATA/KVM"}}
```

**本机现有 VM**(唯一一台,验收就用它):
```json
{"id":"e939191c-2bd2-4f14-88c9-0bf05d3b4d40","name":"sp9-alpine-test","state":"running",
 "vcpu":2,"memory":1024,"disk":8,"iso":"/DATA/KVM/isos/alpine-319.iso","os":"linux",
 "networkMode":"nat","firmware":"bios","bootFromDisk":false,
 "vncPort":5900,"vncWebsocketPort":5700,"spicePort":5901,"spiceTlsPort":0,"autostart":false}
```

**http baseURL 规则**(`NimoOS-Service/src/http.ts:5-10`):不以 `/v[1-9]` 或 `http` 开头的 url 自动前缀 `/v1`。所以 `kvm.ts` 里写 `/kvm/vms`,实际打 `/v1/kvm/vms`。

### 本期两处 spec 更正 + 两处登记(写进台账,别当漏做)

- **更正 ①(重要)**:spec §6.1 写「状态刷新先照 Vue2 用轮询,改事件驱动是 P5 之后的债务 D8」——**错**。Vue2 `KVMFullPage.vue` 全文**零 `setInterval`**,状态刷新完全靠上面七个 MessageBus 事件(Vue2 `sockets:` 选项,`KVMFullPage.vue:766-826`)。照 Vue2 = **事件驱动**,New-UI `src/composables/useMessageBus.ts` 是已有基建(9 个消费方),不是新数据通道。**债务 D8 销号。**
- **更正 ②**:spec §6.1 写「各带确认弹窗」——Vue2 实际是**菜单项就地两次点击**(第一次文字变「确定吗?」并变红,第二次执行),`pendingConfirmAction` + `pendingConfirmId` 两个变量。**用户 2026-08-02 拍板照 Vue2。**
- **逻辑修正登记**:Vue2 `restartVM`(`:1567-1583`)里 `disconnectVNC(); connectVNC()` 紧挨着调 —— VM 刚重启,VNC 端口大概率还没监听,必失败并把 `vncError` 永久写死在屏上。**改为**:restart 后只 `disconnect`,重连交给 `kvm:vm_started` 事件兜底;代码注释登记偏离。
- **P5 暂缺登记**:Vue2 `fetchVMs()`(`:906`)在列表为空时**自动弹创建弹窗**(`this.showCreateVM()`)。P5 没有创建弹窗 → 走空态占位(模板 `:31-35` 本来就有 `No virtual machines`,只是一直被 auto-popup 抢先)。**P6 接上自动弹窗。**

---

## 文件结构

### `NimoOS-Service`(共享包)

| 文件 | 责任 |
|---|---|
| 新建 `src/kvm.ts` | `createKvm(http)` 25 方法 + 内部 `kvmUnwrap<T>(raw, nested)` + KVM 全部 interface(**不动 `types.ts`**,减小与 sp7/sp8 的合并足迹,先例:`raid.ts`/`snapshot.ts`/`compose.ts` 都自带类型) |
| 新建 `src/kvm.test.ts` | 25 方法的 url/method/body + 9 种信封层数 + `success:false` 抛错 |
| 改 `src/index.ts` | `import { createKvm }` · `export type {...} from './kvm.js'` · `service` 上加 `get kvm()` |

### `NimoOS-New-UI`

| 文件 | 责任 |
|---|---|
| 新建 `src/kvm/util/vmState.ts` | 七个 `can*` 派生 + `getStateLabel` + `showDeleteDivider`,**纯函数** |
| 新建 `src/kvm/util/format.ts` | `formatRam` / `formatHostMem` / `osIconFor` |
| 新建 `src/kvm/util/spicePreserve.ts` | spicePort 保活合并,**纯函数** |
| 新建 `src/kvm/composables/useVmList.ts` | 列表 / selectedVM / 事件订阅 / 六个电源动作 / autostart / delete |
| 新建 `src/kvm/composables/useVncConsole.ts` | RFB 生命周期 + 代际守卫 + 修饰键 + sendKey + 全屏 |
| 新建 `src/kvm/components/VmSidebar.vue` | 左栏:头部(标题/运行计数/齿轮禁用)+ 列表 + Add VM 禁用 |
| 新建 `src/kvm/components/VmListItem.vue` | 单条 VM 行(OS 图标 / 名字 / 规格 / 状态点) |
| 新建 `src/kvm/components/ConsoleHeader.vue` | 右侧头:OS 图标 / 名字 / 状态点 / Settings 禁用 / ⋮ |
| 新建 `src/kvm/components/OverflowMenu.vue` | 溢出菜单 + 就地二次确认 + 外点关闭 |
| 新建 `src/kvm/components/ConsoleStage.vue` | VNC 画布宿主 + 占位/错误态 + 开机/继续大按钮 |
| 新建 `src/kvm/components/SendKeyToolbar.vue` | 修饰键 / Tab / Esc / Ctrl+Alt+Del / 全屏 |
| 新建 `src/kvm/components/InstallBanner.vue` | 安装横幅(浅蓝,唯一非深色块) |
| 新建 `src/kvm/components/SpiceInfoBar.vue` | SPICE 提示条 + 关闭 + 180s 自动收起 |
| 新建 `src/kvm/components/ProgressOverlay.vue` | 「正在停止 / 重启 / 删除…」阻塞遮罩 |
| 新建 `src/kvm/views/KvmPage.vue` | 组装 + 侧栏折叠 |
| 新建 `src/kvm/styles/kvm.css` | 全部视觉,各组件 `import '../styles/kvm.css'` |
| 新建 `src/kvm/assets/*.svg` | 13 个图标,从 Vue2 `assets/img/kvm/` 拷 |
| 改 `src/styles/theme.sp9.css` | 追加 `--kvm-*` token(两块同值) |
| 改 `src/i18n/{zh_cn,en_us}.sp9.ts` | 追加 KVM 文案 |
| 改 `src/router/index.ts` | 加 `/kvm` 一行 |

**类名前缀统一 `.kvm-`**,与 `.set-*`(设置区)、`.app-*` 不冲突。

---

## 任务总览(9 个)

| # | 任务 | 交付 |
|---|---|---|
| T0 | `kvm` 域进共享包 | 25 方法 + 信封层数写死 + 全测 |
| T1 | 三个纯函数 util | 状态派生 / 格式化 / spice 保活 |
| T2 | 地基:token + i18n + 图标 + 路由 + 空壳页 | `#/kvm` 能打开,看到左栏骨架与右侧空态 |
| T3 | `useVmList` 数据层 | 列表 / 选中 / 事件七件 / 保活 |
| T4 | 左侧栏两个组件 | 真列表可点、可折叠 |
| T5 | 控制台头 + 溢出菜单 + 电源动作 + 进度遮罩 | 六个电源动作可用 |
| T6 | `useVncConsole` + ConsoleStage | 控制台出画面 |
| T7 | SendKeyToolbar | 修饰键 / Ctrl+Alt+Del / 全屏 |
| T8 | InstallBanner + SpiceInfoBar + 组装收尾 | 整页完成,三门全绿 |

---

## Task 0: `kvm` 域进共享包

**Files:**
- Create: `NimoOS-Service/src/kvm.ts`
- Create: `NimoOS-Service/src/kvm.test.ts`
- Modify: `NimoOS-Service/src/index.ts`

**Interfaces:**
- Consumes: `unwrap` 不用(KVM 信封不同);`AxiosInstance`
- Produces: `createKvm(http)` 返回 25 方法的对象;类型 `KvmVM` / `KvmVMList` / `KvmVncInfo` / `KvmSettings` / `KvmSettingsUpdate` / `KvmISO` / `KvmSnapshot` / `KvmCreateVMRequest` / `KvmUpdateVMRequest` / `KvmISODownloadProgress`;`service.kvm` getter。**后续所有任务只通过 `service.kvm.*` 访问后端。**

- [ ] **Step 1: 写失败测试** — `NimoOS-Service/src/kvm.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createKvm } from './kvm'

// 记录调用的 http 桩。KVM 信封 = {success:boolean,data,message},与全系统 Result 不同。
function stub(map: Record<string, unknown> = {}) {
  const calls: { m: string; url: string; body?: unknown }[] = []
  const h = (m: string) => async (url: string, body?: unknown) => {
    calls.push({ m, url, body })
    return { data: map[url] ?? { success: true, data: null } }
  }
  const http = { get: h('get'), post: h('post'), put: h('put'), delete: h('delete') } as unknown as AxiosInstance
  return { http, calls }
}

// 真机 fixture(2026-08-02 curl GET /v1/kvm/vms,逐字)
const VM_ROW = {
  id: 'e939191c-2bd2-4f14-88c9-0bf05d3b4d40', name: 'sp9-alpine-test',
  uuid: '2bf07a4a-fed2-4c43-992e-2e711c94e6a3', state: 'running',
  vcpu: 2, memory: 1024, disk: 8, diskUsedPercent: 0,
  diskPath: '/DATA/KVM/.vms/e939191c-2bd2-4f14-88c9-0bf05d3b4d40/disk.qcow2',
  iso: '/DATA/KVM/isos/alpine-319.iso', os: 'linux',
  networkMode: 'nat', networkInterface: 'virbr0', firmware: 'bios', bootFromDisk: false,
  vncPort: 5900, vncWebsocketPort: 5700, spicePort: 5901, spiceTlsPort: 0, autostart: false,
  createdAt: '2026-07-30T20:33:51.843539328+08:00', updatedAt: '2026-07-30T20:33:51.843539461+08:00',
}

describe('createKvm —— 信封层数按端点写死', () => {
  it('GET /vms 剥两层,拿到 data.data 数组与 data.total', async () => {
    const { http, calls } = stub({ '/kvm/vms': { success: true, data: { data: [VM_ROW], total: 1 } } })
    const r = await createKvm(http).getVMList()
    expect(calls[0]).toMatchObject({ m: 'get', url: '/kvm/vms' })
    expect(r.total).toBe(1)
    expect(r.data[0].name).toBe('sp9-alpine-test')
    expect(r.data[0].vncWebsocketPort).toBe(5700)
  })

  it('GET /vms/:id 剥两层', async () => {
    const { http } = stub({ [`/kvm/vms/${VM_ROW.id}`]: { success: true, data: { data: VM_ROW } } })
    expect((await createKvm(http).getVM(VM_ROW.id)).state).toBe('running')
  })

  it('GET /settings 只剥一层(handler 手拼 map,没有内层 data)', async () => {
    // 真机实测 2026-08-02
    const REAL = {
      success: true,
      data: {
        autostart: false, availableDiskGB: 263, availableMemoryMB: 10254, cpuCores: 6,
        defaultDiskSize: 20, defaultMemory: 2048,
        networkInterfaces: ['enp2s0', 'enp4s0', 'wlp1s0'], storagePath: '/DATA/KVM',
      },
    }
    const { http } = stub({ '/kvm/settings': REAL })
    const s = await createKvm(http).getSettings()
    expect(s.cpuCores).toBe(6)
    expect(s.networkInterfaces).toEqual(['enp2s0', 'enp4s0', 'wlp1s0'])
  })

  it('PUT /settings 剥两层(回显请求体)', async () => {
    const body = { storagePath: '/DATA/KVM', defaultVcpu: 2, defaultMemory: 2048, autostart: false }
    const { http, calls } = stub({ '/kvm/settings': { success: true, data: { data: body } } })
    expect(await createKvm(http).updateSettings(body)).toMatchObject({ defaultVcpu: 2 })
    expect(calls[0]).toMatchObject({ m: 'put', url: '/kvm/settings', body })
  })

  it('GET /vms/:id/vnc 只剥一层', async () => {
    const { http } = stub({
      [`/kvm/vms/${VM_ROW.id}/vnc`]: {
        success: true,
        data: { vncPort: 5900, vncWebsocketPort: 5700, spicePort: 5901, spiceTlsPort: 0 },
      },
    })
    expect(await createKvm(http).getVNC(VM_ROW.id)).toEqual({
      vncPort: 5900, vncWebsocketPort: 5700, spicePort: 5901, spiceTlsPort: 0,
    })
  })

  it('GET /isos 只剥一层(直接是数组)', async () => {
    const iso = { id: 'alpine-319', name: 'Alpine 3.19', version: '3.19', category: 'linux',
      size: '150MB', path: '/DATA/KVM/isos/alpine-319.iso', status: 'downloaded', progress: 100,
      createdAt: '2026-07-30T20:00:00+08:00' }
    const { http } = stub({ '/kvm/isos': { success: true, data: [iso] } })
    const list = await createKvm(http).getISOList()
    expect(list).toHaveLength(1)
    expect(list[0].path).toBe('/DATA/KVM/isos/alpine-319.iso')
  })

  it('GET /isos/:id 剥两层', async () => {
    const { http } = stub({ '/kvm/isos/alpine-319': { success: true, data: { data: { id: 'alpine-319', name: 'Alpine' } } } })
    expect((await createKvm(http).getISO('alpine-319')).id).toBe('alpine-319')
  })

  it('GET /vms/:id/snapshots 剥两层', async () => {
    const snap = { id: 's1', vmId: VM_ROW.id, name: 'before-upgrade', description: '', state: 'running',
      createdAt: '2026-08-01T10:00:00+08:00' }
    const { http } = stub({ [`/kvm/vms/${VM_ROW.id}/snapshots`]: { success: true, data: { data: [snap] } } })
    expect((await createKvm(http).getSnapshots(VM_ROW.id))[0].name).toBe('before-upgrade')
  })

  it('控制动作只剥一层,startVM 返回 {status}', async () => {
    const { http, calls } = stub({ [`/kvm/vms/${VM_ROW.id}/start`]: { success: true, data: { status: 'started' } } })
    await createKvm(http).startVM(VM_ROW.id)
    expect(calls[0]).toMatchObject({ m: 'post', url: `/kvm/vms/${VM_ROW.id}/start` })
  })

  it('setAutostart 带 body,返回 {autostart}', async () => {
    const { http, calls } = stub({ [`/kvm/vms/${VM_ROW.id}/autostart`]: { success: true, data: { autostart: true } } })
    expect(await createKvm(http).setAutostart(VM_ROW.id, true)).toBe(true)
    expect(calls[0].body).toEqual({ autostart: true })
  })

  it('setBootFromDisk 带 body,data 是 null 也不抛', async () => {
    const { http, calls } = stub({ [`/kvm/vms/${VM_ROW.id}/boot`]: { success: true, data: null } })
    await createKvm(http).setBootFromDisk(VM_ROW.id, true)
    expect(calls[0].body).toEqual({ bootFromDisk: true })
  })

  it('deleteVM 打 DELETE', async () => {
    const { http, calls } = stub({ [`/kvm/vms/${VM_ROW.id}`]: { success: true, data: null } })
    await createKvm(http).deleteVM(VM_ROW.id)
    expect(calls[0]).toMatchObject({ m: 'delete', url: `/kvm/vms/${VM_ROW.id}` })
  })

  it('success:false 抛出后端 message', async () => {
    const { http } = stub({ '/kvm/vms': { success: false, message: 'libvirt connection failed' } })
    await expect(createKvm(http).getVMList()).rejects.toThrow('libvirt connection failed')
  })

  it('success:false 且无 message 时抛兜底文案,不抛 undefined', async () => {
    const { http } = stub({ '/kvm/vms': { success: false } })
    await expect(createKvm(http).getVMList()).rejects.toThrow('kvm request failed')
  })

  it('列表接口在 data.data 缺失时退化成空列表,不抛', async () => {
    // 后端 nil slice → data:{data:null,total:0}
    const { http } = stub({ '/kvm/vms': { success: true, data: { data: null, total: 0 } } })
    expect(await createKvm(http).getVMList()).toEqual({ data: [], total: 0 })
  })

  it('快照列表同样在 null 时退化成空数组', async () => {
    const { http } = stub({ [`/kvm/vms/${VM_ROW.id}/snapshots`]: { success: true, data: { data: null } } })
    expect(await createKvm(http).getSnapshots(VM_ROW.id)).toEqual([])
  })

  it('getISOList 在 data 为 null 时退化成空数组', async () => {
    const { http } = stub({ '/kvm/isos': { success: true, data: null } })
    expect(await createKvm(http).getISOList()).toEqual([])
  })
})

describe('createKvm —— 25 个方法的 url/method 全覆盖', () => {
  const ID = 'vm-1'
  const SID = 'snap-1'
  it('逐个打对端点', async () => {
    const { http, calls } = stub()
    const k = createKvm(http)
    await k.getVMList(); await k.getVM(ID); await k.createVM({ name: 'a' } as never)
    await k.updateVM(ID, { name: 'b' } as never); await k.deleteVM(ID)
    await k.startVM(ID); await k.stopVM(ID); await k.restartVM(ID)
    await k.pauseVM(ID); await k.resumeVM(ID); await k.wakeupVM(ID)
    await k.getVNC(ID); await k.setBootFromDisk(ID, true); await k.setAutostart(ID, false)
    await k.getISOList(); await k.getISO('i1'); await k.downloadISO('i1')
    await k.deleteISO('i1'); await k.getISODownloadProgress('i1')
    await k.getSnapshots(ID); await k.createSnapshot(ID, { name: 'n', description: 'd' })
    await k.deleteSnapshot(ID, SID); await k.restoreSnapshot(ID, SID)
    await k.getSettings(); await k.updateSettings({ storagePath: '/x', defaultVcpu: 1, defaultMemory: 256, autostart: false })

    expect(calls.map((c) => `${c.m} ${c.url}`)).toEqual([
      'get /kvm/vms',
      `get /kvm/vms/${ID}`,
      'post /kvm/vms',
      `put /kvm/vms/${ID}`,
      `delete /kvm/vms/${ID}`,
      `post /kvm/vms/${ID}/start`,
      `post /kvm/vms/${ID}/stop`,
      `post /kvm/vms/${ID}/restart`,
      `post /kvm/vms/${ID}/pause`,
      `post /kvm/vms/${ID}/resume`,
      `post /kvm/vms/${ID}/wakeup`,
      `get /kvm/vms/${ID}/vnc`,
      `post /kvm/vms/${ID}/boot`,
      `post /kvm/vms/${ID}/autostart`,
      'get /kvm/isos',
      'get /kvm/isos/i1',
      'post /kvm/isos/download',
      'delete /kvm/isos/i1',
      'get /kvm/isos/i1/progress',
      `get /kvm/vms/${ID}/snapshots`,
      `post /kvm/vms/${ID}/snapshots`,
      `delete /kvm/vms/${ID}/snapshots/${SID}`,
      `post /kvm/vms/${ID}/snapshots/${SID}/restore`,
      'get /kvm/settings',
      'put /kvm/settings',
    ])
  })

  it('downloadISO 的 body 是 {id},不是裸字符串', async () => {
    const { http, calls } = stub()
    await createKvm(http).downloadISO('alpine-319')
    expect(calls[0].body).toEqual({ id: 'alpine-319' })
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-Service && pnpm vitest run src/kvm.test.ts`
Expected: FAIL —— `Failed to resolve import "./kvm"`

- [ ] **Step 3: 实现 `NimoOS-Service/src/kvm.ts`**

```ts
import type { AxiosInstance } from 'axios'

// kvm 域 = NimoOS-KVM(Gin/Echo 混用的独立服务,唯一不走全系统 Result 信封的 Go 服务)。
//
// ⚠️ 信封:common/response.go = { success: boolean, data, message } ——
//    success 是 **bool**,不是全系统 Result 的 HTTP 状态码 int。所以**不能过 unwrap()**。
//
// ⚠️ 同一个服务里 `data` 的嵌套层数**不一致**(逐 handler 核过 route/v2/{vms,isos,snapshots,settings}.go):
//    两层(data.data):GET/PUT/POST /vms · GET /vms/:id · 快照 list/create · GET /isos/:id · PUT /settings
//    一层(data)    :GET /isos · GET /settings · GET /vms/:id/vnc · 全部控制动作 / DELETE / boot / autostart / progress
//    → 层数由每个方法**显式传入** nested,**禁止**"有 data.data 就多剥一层"这种自动探测:
//      核字段名 ≠ 核信封层数,自动探测在 data 恰好含 data 键时会静默剥错。
export interface KvmVM {
  id: string
  name: string
  uuid: string
  /** libvirt 域状态。已知值:running / stopped / paused / suspended / crashed / missing。
   *  ⚠️ crashed 与 missing 没有 i18n 映射(Vue2 也没有),界面按原样显示。 */
  state: string
  vcpu: number
  memory: number
  disk: number
  diskUsedPercent: number
  diskPath: string
  iso: string
  /** 后端 json tag 是 `os`,Go 字段名却是 OSType(model/vm.go:26)。前端按 json 名取 os。 */
  os: string
  networkMode: string
  networkInterface: string
  firmware: string
  bootFromDisk: boolean
  vncPort: number
  vncWebsocketPort: number
  /** ⚠️ 列表接口(GET /vms)**不返回**有效值,只有 GET /vms/:id/vnc 才有。
   *  消费方要做"保活合并",见 New-UI src/kvm/util/spicePreserve.ts。 */
  spicePort: number
  spiceTlsPort: number
  autostart: boolean
  createdAt: string
  updatedAt: string
}

export interface KvmVMList {
  data: KvmVM[]
  total: number
}

export interface KvmVncInfo {
  vncPort: number
  vncWebsocketPort: number
  spicePort: number
  spiceTlsPort: number
}

/** GET /settings 的响应比 model/settings.go 多 5 个字段 —— handler 手拼 map
 *  (route/v2/settings.go:26-38),cpuCores/availableMemoryMB/availableDiskGB/
 *  networkInterfaces/defaultDiskSize 都只读、不可写。 */
export interface KvmSettings {
  storagePath: string
  defaultVcpu: number
  defaultMemory: number
  autostart: boolean
  cpuCores: number
  availableMemoryMB: number
  availableDiskGB: number
  networkInterfaces: string[]
  defaultDiskSize: number
}

/** PUT /settings 只认这 4 个字段(model.SaveSettingsRequest)。 */
export interface KvmSettingsUpdate {
  storagePath: string
  defaultVcpu: number
  defaultMemory: number
  autostart: boolean
}

export interface KvmISO {
  id: string
  name: string
  version: string
  category: string
  size: string
  path: string
  status: string
  progress: number
  createdAt: string
  /** 以下是"可下载的官方模板"才有的字段(model.OS),已下载的本地 ISO 不带。 */
  downloadURL?: string
  recommendedVcpu?: number
  recommendedMemory?: number
  minMemory?: number
  /** ⚠️ 与后端硬下限矛盾:alpine-319.minDisk = 2,但 service/vm_service.go:286-310
   *  要求 disk >= 8。前端校验取 max(8, minDisk)。P6 用。 */
  minDisk?: number
}

export interface KvmISODownloadProgress {
  id: string
  status: string
  progress: number
}

export interface KvmSnapshot {
  id: string
  vmId: string
  name: string
  description: string
  state: string
  createdAt: string
}

export interface KvmCreateVMRequest {
  name: string
  vcpu: number
  memory: number
  disk: number
  /** ⚠️ 必须是宿主机上真实存在的**绝对路径**(如 /DATA/KVM/isos/alpine-319.iso),
   *  不是 /isos 列表里的 id —— 后端 os.Stat 检查。 */
  iso: string
  os: string
  osType: string
  networkMode: string
  networkInterface: string
  firmware: string
  bootFromDisk?: boolean
}

export type KvmUpdateVMRequest = Partial<KvmCreateVMRequest> & { name: string }

interface KvmEnvelope {
  success?: boolean
  message?: string
  data?: unknown
}

/** nested=true → 取 body.data.data;nested=false → 取 body.data。层数是契约,由调用处写死。 */
function kvmUnwrap<T>(body: unknown, nested: boolean): T {
  const env = (body ?? {}) as KvmEnvelope
  if (env.success !== true) {
    throw new Error(env.message || 'kvm request failed')
  }
  if (!nested) return env.data as T
  const inner = (env.data ?? {}) as { data?: unknown }
  return inner.data as T
}

export function createKvm(http: AxiosInstance) {
  return {
    // ── VM 生命周期 ──
    /** GET /v1/kvm/vms —— 两层。后端 nil slice 时 data.data 是 null,退化成 []。 */
    async getVMList(): Promise<KvmVMList> {
      const raw = (await http.get('/kvm/vms')).data
      const env = (raw ?? {}) as KvmEnvelope
      if (env.success !== true) throw new Error(env.message || 'kvm request failed')
      const inner = (env.data ?? {}) as { data?: unknown; total?: unknown }
      return {
        data: Array.isArray(inner.data) ? (inner.data as KvmVM[]) : [],
        total: typeof inner.total === 'number' ? inner.total : 0,
      }
    },

    async getVM(id: string): Promise<KvmVM> {
      return kvmUnwrap<KvmVM>((await http.get(`/kvm/vms/${id}`)).data, true)
    },

    async createVM(req: KvmCreateVMRequest): Promise<KvmVM> {
      return kvmUnwrap<KvmVM>((await http.post('/kvm/vms', req)).data, true)
    },

    async updateVM(id: string, req: KvmUpdateVMRequest): Promise<KvmVM> {
      return kvmUnwrap<KvmVM>((await http.put(`/kvm/vms/${id}`, req)).data, true)
    },

    async deleteVM(id: string): Promise<void> {
      kvmUnwrap<null>((await http.delete(`/kvm/vms/${id}`)).data, false)
    },

    // ── 电源动作:全部一层,返回 {status:"..."};这里只关心成败,不用返回值 ──
    async startVM(id: string): Promise<void> {
      kvmUnwrap<unknown>((await http.post(`/kvm/vms/${id}/start`)).data, false)
    },
    async stopVM(id: string): Promise<void> {
      kvmUnwrap<unknown>((await http.post(`/kvm/vms/${id}/stop`)).data, false)
    },
    async restartVM(id: string): Promise<void> {
      kvmUnwrap<unknown>((await http.post(`/kvm/vms/${id}/restart`)).data, false)
    },
    async pauseVM(id: string): Promise<void> {
      kvmUnwrap<unknown>((await http.post(`/kvm/vms/${id}/pause`)).data, false)
    },
    async resumeVM(id: string): Promise<void> {
      kvmUnwrap<unknown>((await http.post(`/kvm/vms/${id}/resume`)).data, false)
    },
    async wakeupVM(id: string): Promise<void> {
      kvmUnwrap<unknown>((await http.post(`/kvm/vms/${id}/wakeup`)).data, false)
    },

    /** GET /v1/kvm/vms/:id/vnc —— 一层。**浏览器直连宿主机 ws 端口,不走网关、无鉴权。** */
    async getVNC(id: string): Promise<KvmVncInfo> {
      return kvmUnwrap<KvmVncInfo>((await http.get(`/kvm/vms/${id}/vnc`)).data, false)
    },

    /** POST /v1/kvm/vms/:id/boot —— 一层,data 恒为 null。弹出安装介质就是它。 */
    async setBootFromDisk(id: string, bootFromDisk: boolean): Promise<void> {
      kvmUnwrap<null>((await http.post(`/kvm/vms/${id}/boot`, { bootFromDisk })).data, false)
    },

    /** POST /v1/kvm/vms/:id/autostart —— 一层,返回 {autostart:bool}(回显请求值)。 */
    async setAutostart(id: string, autostart: boolean): Promise<boolean> {
      const d = kvmUnwrap<{ autostart?: boolean }>(
        (await http.post(`/kvm/vms/${id}/autostart`, { autostart })).data, false,
      )
      return d?.autostart ?? autostart
    },

    // ── ISO(P6 用,本期只进包不消费) ──
    /** GET /v1/kvm/isos —— **一层**,data 直接是数组(isos.go:21,与 /vms 不同)。 */
    async getISOList(): Promise<KvmISO[]> {
      const d = kvmUnwrap<unknown>((await http.get('/kvm/isos')).data, false)
      return Array.isArray(d) ? (d as KvmISO[]) : []
    },
    async getISO(id: string): Promise<KvmISO> {
      return kvmUnwrap<KvmISO>((await http.get(`/kvm/isos/${id}`)).data, true)
    },
    /** POST /v1/kvm/isos/download —— body 是 {id},不是裸字符串(model.DownloadISORequest)。 */
    async downloadISO(id: string): Promise<void> {
      kvmUnwrap<unknown>((await http.post('/kvm/isos/download', { id })).data, false)
    },
    async deleteISO(id: string): Promise<void> {
      kvmUnwrap<unknown>((await http.delete(`/kvm/isos/${id}`)).data, false)
    },
    async getISODownloadProgress(id: string): Promise<KvmISODownloadProgress> {
      return kvmUnwrap<KvmISODownloadProgress>((await http.get(`/kvm/isos/${id}/progress`)).data, false)
    },

    // ── 快照(P6 用,本期只进包不消费) ──
    async getSnapshots(vmId: string): Promise<KvmSnapshot[]> {
      const d = kvmUnwrap<unknown>((await http.get(`/kvm/vms/${vmId}/snapshots`)).data, true)
      return Array.isArray(d) ? (d as KvmSnapshot[]) : []
    },
    async createSnapshot(vmId: string, req: { name: string; description: string }): Promise<KvmSnapshot> {
      return kvmUnwrap<KvmSnapshot>((await http.post(`/kvm/vms/${vmId}/snapshots`, req)).data, true)
    },
    async deleteSnapshot(vmId: string, snapshotId: string): Promise<void> {
      kvmUnwrap<unknown>((await http.delete(`/kvm/vms/${vmId}/snapshots/${snapshotId}`)).data, false)
    },
    async restoreSnapshot(vmId: string, snapshotId: string): Promise<void> {
      kvmUnwrap<unknown>((await http.post(`/kvm/vms/${vmId}/snapshots/${snapshotId}/restore`)).data, false)
    },

    // ── 全局设置 ──
    /** GET /v1/kvm/settings —— **一层**(settings.go:39)。 */
    async getSettings(): Promise<KvmSettings> {
      return kvmUnwrap<KvmSettings>((await http.get('/kvm/settings')).data, false)
    },
    /** PUT /v1/kvm/settings —— **两层**(settings.go:51,回显请求体)。 */
    async updateSettings(req: KvmSettingsUpdate): Promise<KvmSettingsUpdate> {
      return kvmUnwrap<KvmSettingsUpdate>((await http.put('/kvm/settings', req)).data, true)
    },
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /home/nimo/NimoTech/NimoOS-Service && pnpm vitest run src/kvm.test.ts`
Expected: PASS(全部用例绿)

- [ ] **Step 5: 接线 `src/index.ts`**

三处改动,照既有 `createNetwork` 的样子:
1. 顶部 import 区末尾加 `import { createKvm } from './kvm.js'`
2. 类型导出区加一行(**独立一行,别塞进 `types.js` 那条长 export**,减小合并冲突面):
```ts
export type { KvmVM, KvmVMList, KvmVncInfo, KvmSettings, KvmSettingsUpdate, KvmISO, KvmISODownloadProgress, KvmSnapshot, KvmCreateVMRequest, KvmUpdateVMRequest } from './kvm.js'
```
3. `service` 对象里加 getter(放在 `get network()` 之后):
```ts
  get kvm(): ReturnType<typeof createKvm> {
    return createKvm(getHttp() as AxiosInstance)
  },
```

- [ ] **Step 6: 跑共享包全量测试 + 类型检查**

Run: `cd /home/nimo/NimoTech/NimoOS-Service && pnpm test && pnpm tsc --noEmit`
Expected: 相对基线不新增红

- [ ] **Step 7: 提交(显式 pathspec)**

```bash
cd /home/nimo/NimoTech/NimoOS-Service
git add src/kvm.ts src/kvm.test.ts src/index.ts
git commit -m "feat(kvm): kvm 域进共享包(25 方法,信封层数按端点写死)"
```

---

## Task 1: 三个纯函数 util

**Files:**
- Create: `NimoOS-New-UI/src/kvm/util/vmState.ts` + `vmState.test.ts`
- Create: `NimoOS-New-UI/src/kvm/util/format.ts` + `format.test.ts`
- Create: `NimoOS-New-UI/src/kvm/util/spicePreserve.ts` + `spicePreserve.test.ts`

**Interfaces:**
- Consumes: `KvmVM`(T0)
- Produces:
  - `canPowerOn(vm) / canShutDown(vm) / canRestart(vm) / canPause(vm) / canResume(vm) / canWakeUp(vm) / canDelete(vm) / canEditSettings(vm): boolean`(参数 `vm: KvmVM | null | undefined`)
  - `showDeleteDivider(vm): boolean`
  - `stateLabelKey(state: string): string`(返回 i18n key 或原始 state)
  - `formatRam(mb: number): string` / `formatHostMem(mb: number): string`
  - `osIconFor(os: string): string`(返回 import 后的 svg url)
  - `preserveSpice(fresh: KvmVM, old: Pick<KvmVM,'spicePort'|'spiceTlsPort'> | null | undefined): KvmVM`

- [ ] **Step 1: 写 `vmState.test.ts`(失败)**

```ts
import { describe, it, expect } from 'vitest'
import type { KvmVM } from '@nimotech/nimoos-service'
import {
  canPowerOn, canShutDown, canRestart, canPause, canResume, canWakeUp,
  canDelete, canEditSettings, showDeleteDivider, stateLabelKey,
} from './vmState'

const vm = (state: string) => ({ id: 'x', state } as KvmVM)

describe('电源动作可用性派生(逐字对 Vue2 KVMFullPage.vue:665-700 的 computed)', () => {
  it('canPowerOn:stopped / crashed', () => {
    expect(canPowerOn(vm('stopped'))).toBe(true)
    expect(canPowerOn(vm('crashed'))).toBe(true)
    expect(canPowerOn(vm('running'))).toBe(false)
    expect(canPowerOn(vm('paused'))).toBe(false)
    expect(canPowerOn(vm('missing'))).toBe(false)
  })
  it('canShutDown:只有 running', () => {
    expect(canShutDown(vm('running'))).toBe(true)
    expect(canShutDown(vm('paused'))).toBe(false)
  })
  it('canRestart:running / paused', () => {
    expect(canRestart(vm('running'))).toBe(true)
    expect(canRestart(vm('paused'))).toBe(true)
    expect(canRestart(vm('stopped'))).toBe(false)
  })
  it('canPause:只有 running', () => {
    expect(canPause(vm('running'))).toBe(true)
    expect(canPause(vm('suspended'))).toBe(false)
  })
  it('canResume:只有 paused', () => {
    expect(canResume(vm('paused'))).toBe(true)
    expect(canResume(vm('suspended'))).toBe(false)
  })
  it('canWakeUp:只有 suspended', () => {
    expect(canWakeUp(vm('suspended'))).toBe(true)
    expect(canWakeUp(vm('paused'))).toBe(false)
  })
  it('canDelete:stopped / crashed / missing', () => {
    expect(canDelete(vm('stopped'))).toBe(true)
    expect(canDelete(vm('crashed'))).toBe(true)
    expect(canDelete(vm('missing'))).toBe(true)
    expect(canDelete(vm('running'))).toBe(false)
  })
  it('canEditSettings:stopped / crashed', () => {
    expect(canEditSettings(vm('stopped'))).toBe(true)
    expect(canEditSettings(vm('crashed'))).toBe(true)
    expect(canEditSettings(vm('running'))).toBe(false)
  })
  it('全部派生对 null 一律 false,不抛', () => {
    for (const f of [canPowerOn, canShutDown, canRestart, canPause, canResume, canWakeUp, canDelete, canEditSettings]) {
      expect(f(null)).toBe(false)
      expect(f(undefined)).toBe(false)
    }
  })
})

describe('showDeleteDivider', () => {
  it('crashed 时既能开机又能删 → 需要分隔线', () => {
    expect(showDeleteDivider(vm('crashed'))).toBe(true)
  })
  it('stopped 时也是既能开机又能删 → 需要分隔线', () => {
    expect(showDeleteDivider(vm('stopped'))).toBe(true)
  })
  it('missing 时只能删、没有任何电源项 → 不要分隔线', () => {
    expect(showDeleteDivider(vm('missing'))).toBe(false)
  })
  it('running 时不能删 → 不要分隔线', () => {
    expect(showDeleteDivider(vm('running'))).toBe(false)
  })
  it('null 不抛', () => {
    expect(showDeleteDivider(null)).toBe(false)
  })
})

describe('stateLabelKey', () => {
  it('五个已知状态映射到 i18n key', () => {
    expect(stateLabelKey('running')).toBe('kvmStateRunning')
    expect(stateLabelKey('stopped')).toBe('kvmStateStopped')
    expect(stateLabelKey('paused')).toBe('kvmStatePaused')
    expect(stateLabelKey('suspended')).toBe('kvmStateSuspended')
    expect(stateLabelKey('error')).toBe('kvmStateError')
  })
  it('未知状态原样返回(照 Vue2:crashed/missing 没有映射,直接显示原文)', () => {
    expect(stateLabelKey('crashed')).toBe('crashed')
    expect(stateLabelKey('missing')).toBe('missing')
    expect(stateLabelKey('')).toBe('')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm vitest run src/kvm/util/vmState.test.ts`
Expected: FAIL —— 找不到模块

- [ ] **Step 3: 实现 `src/kvm/util/vmState.ts`**

```ts
import type { KvmVM } from '@nimotech/nimoos-service'

// 电源动作可用性派生。逐字对 Vue2 components/KVM/KVMFullPage.vue:665-700 的 computed。
// 抽成纯函数(Vue2 是绑在 selectedVM 上的 computed)—— 行为一致,但能单测,且列表项
// 与菜单可以共用同一套判定。
type MaybeVM = Pick<KvmVM, 'state'> | null | undefined

const is = (vm: MaybeVM, ...states: string[]) => !!vm && states.includes(vm.state)

export const canPowerOn = (vm: MaybeVM) => is(vm, 'stopped', 'crashed')
export const canShutDown = (vm: MaybeVM) => is(vm, 'running')
export const canRestart = (vm: MaybeVM) => is(vm, 'running', 'paused')
export const canPause = (vm: MaybeVM) => is(vm, 'running')
export const canResume = (vm: MaybeVM) => is(vm, 'paused')
export const canWakeUp = (vm: MaybeVM) => is(vm, 'suspended')
export const canDelete = (vm: MaybeVM) => is(vm, 'stopped', 'crashed', 'missing')
/** 设置只能在关机态改(Vue2 canEditSettings)。P5 里 Settings 按钮恒禁用,这个派生留给 P6。 */
export const canEditSettings = (vm: MaybeVM) => is(vm, 'stopped', 'crashed')

/** 删除项上方要不要画分隔线:能删、且上面至少还有一个电源项时才画。 */
export const showDeleteDivider = (vm: MaybeVM) =>
  canDelete(vm) &&
  (canPowerOn(vm) || canShutDown(vm) || canRestart(vm) || canPause(vm) || canResume(vm) || canWakeUp(vm))

// Vue2 getStateLabel(:1615)只映射这五个,crashed / missing 落到 `|| state` 分支
// 直接显示后端原文。照抄——不自作主张补映射(界面 1:1)。
const LABEL: Record<string, string> = {
  running: 'kvmStateRunning',
  stopped: 'kvmStateStopped',
  paused: 'kvmStatePaused',
  suspended: 'kvmStateSuspended',
  error: 'kvmStateError',
}

/** 返回 i18n key;未知状态返回原始 state 字符串,调用处用 te() 判断后决定是否 t()。 */
export const stateLabelKey = (state: string) => LABEL[state] ?? state
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/kvm/util/vmState.test.ts`
Expected: PASS

- [ ] **Step 5: 写 `format.test.ts`(失败)**

```ts
import { describe, it, expect } from 'vitest'
import { formatRam, formatHostMem, osIconFor } from './format'

describe('formatRam(逐字对 Vue2 :1633-1636)', () => {
  it('>= 1024 MB 换算成 GB,一位小数', () => {
    expect(formatRam(1024)).toBe('1.0 GB')
    expect(formatRam(2048)).toBe('2.0 GB')
    expect(formatRam(1536)).toBe('1.5 GB')
    expect(formatRam(10254)).toBe('10.0 GB')
  })
  it('< 1024 MB 保持 MB', () => {
    expect(formatRam(512)).toBe('512 MB')
    expect(formatRam(1023)).toBe('1023 MB')
  })
  it('0 / NaN / undefined 一律 "0 MB"(Vue2 的 !mb 分支)', () => {
    expect(formatRam(0)).toBe('0 MB')
    expect(formatRam(NaN)).toBe('0 MB')
    expect(formatRam(undefined as unknown as number)).toBe('0 MB')
  })
})

describe('formatHostMem 与 formatRam 行为一致(Vue2 里是两个同实现的方法)', () => {
  it('同输入同输出', () => {
    for (const v of [0, 512, 1024, 10254]) expect(formatHostMem(v)).toBe(formatRam(v))
  })
})

describe('osIconFor(逐字对 Vue2 :1619-1631 的匹配顺序)', () => {
  it('按子串命中各发行版', () => {
    expect(osIconFor('Windows 11')).toContain('windows')
    expect(osIconFor('ubuntu-2404')).toContain('ubuntu')
    expect(osIconFor('Debian 13')).toContain('debian')
    expect(osIconFor('CentOS Stream 9')).toContain('centos')
    expect(osIconFor('alpine-319')).toContain('alpine')
    expect(osIconFor('Arch Linux')).toContain('arch')
    expect(osIconFor('FreeBSD 14')).toContain('freebsd')
  })
  it('大小写不敏感', () => {
    expect(osIconFor('UBUNTU')).toBe(osIconFor('ubuntu'))
  })
  it('认不出来的一律回退 linux 图标;空/undefined 同样', () => {
    const fallback = osIconFor('linux')
    expect(osIconFor('gentoo')).toBe(fallback)
    expect(osIconFor('')).toBe(fallback)
    expect(osIconFor(undefined as unknown as string)).toBe(fallback)
  })
  it('win 优先于其它:名字里同时含 win 和 arch 时取 windows', () => {
    // Vue2 的 if 链顺序:win 在最前
    expect(osIconFor('win-arch')).toContain('windows')
  })
})
```

- [ ] **Step 6: 跑测试确认失败,然后实现 `src/kvm/util/format.ts`**

Run: `pnpm vitest run src/kvm/util/format.test.ts` → FAIL

```ts
import windowsIcon from '../assets/windows.svg'
import ubuntuIcon from '../assets/ubuntu.svg'
import debianIcon from '../assets/debian.svg'
import centosIcon from '../assets/centos.svg'
import alpineIcon from '../assets/alpine.svg'
import archIcon from '../assets/arch.svg'
import freebsdIcon from '../assets/freebsd.svg'
import linuxIcon from '../assets/linux.svg'

/** 内存格式化。逐字对 Vue2 KVMFullPage.vue:1633-1636(formatRam / formatHostMem 同实现)。 */
export function formatRam(mb: number): string {
  if (!mb) return '0 MB'
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`
}

/** Vue2 里 formatHostMem 与 formatRam 是两个一模一样的方法。保留两个名字以对齐调用处语义。 */
export const formatHostMem = formatRam

// Vue2 getOsIcon(:1619-1631)的 if 链,**顺序有意义**(win 在最前)。照抄顺序。
const ICONS: [string, string][] = [
  ['win', windowsIcon],
  ['ubuntu', ubuntuIcon],
  ['debian', debianIcon],
  ['centos', centosIcon],
  ['alpine', alpineIcon],
  ['arch', archIcon],
  ['freebsd', freebsdIcon],
]

export function osIconFor(os: string): string {
  const lower = (os || '').toLowerCase()
  for (const [key, icon] of ICONS) if (lower.includes(key)) return icon
  return linuxIcon
}
```

> ⚠️ 本步依赖 T2 拷进来的 svg。**执行顺序上 T2 的「拷图标」子步骤要提前到这里做**:先 `cp /home/nimo/NimoTech/NimoOS-UI/src/assets/img/kvm/*.svg /home/nimo/NimoTech/NimoOS-New-UI/src/kvm/assets/`(13 个文件),再跑测试。

- [ ] **Step 7: 跑测试确认通过**

Run: `pnpm vitest run src/kvm/util/format.test.ts`
Expected: PASS

- [ ] **Step 8: 写 `spicePreserve.test.ts`(失败)**

```ts
import { describe, it, expect } from 'vitest'
import type { KvmVM } from '@nimotech/nimoos-service'
import { preserveSpice } from './spicePreserve'

const mk = (over: Partial<KvmVM>) => ({ id: 'a', name: 'vm', state: 'running',
  spicePort: 0, spiceTlsPort: 0, ...over } as KvmVM)

describe('preserveSpice —— 列表接口不返回 spicePort 时的保活合并', () => {
  it('新数据缺 spicePort、旧数据有 → 沿用旧值(含 TlsPort)', () => {
    const out = preserveSpice(mk({ spicePort: 0, spiceTlsPort: 0 }), { spicePort: 5901, spiceTlsPort: 5902 })
    expect(out.spicePort).toBe(5901)
    expect(out.spiceTlsPort).toBe(5902)
  })
  it('新数据自己有 spicePort → 以新数据为准,不被旧值覆盖', () => {
    const out = preserveSpice(mk({ spicePort: 5911, spiceTlsPort: 0 }), { spicePort: 5901, spiceTlsPort: 5902 })
    expect(out.spicePort).toBe(5911)
    expect(out.spiceTlsPort).toBe(0)
  })
  it('旧数据也没有 → 保持新数据的 0', () => {
    expect(preserveSpice(mk({}), { spicePort: 0, spiceTlsPort: 0 }).spicePort).toBe(0)
  })
  it('旧数据为 null / undefined → 原样返回', () => {
    expect(preserveSpice(mk({ spicePort: 7 }), null).spicePort).toBe(7)
    expect(preserveSpice(mk({ spicePort: 7 }), undefined).spicePort).toBe(7)
  })
  it('不修改入参,返回新对象(避免在 reactive 数组里就地改引发的连锁更新)', () => {
    const fresh = mk({ spicePort: 0 })
    const out = preserveSpice(fresh, { spicePort: 5901, spiceTlsPort: 0 })
    expect(fresh.spicePort).toBe(0)
    expect(out).not.toBe(fresh)
  })
  it('其余字段全部来自新数据', () => {
    const out = preserveSpice(mk({ state: 'stopped', name: 'new-name', spicePort: 0 }),
      { spicePort: 5901, spiceTlsPort: 0 })
    expect(out.state).toBe('stopped')
    expect(out.name).toBe('new-name')
  })
})
```

- [ ] **Step 9: 实现 `src/kvm/util/spicePreserve.ts`**

```ts
import type { KvmVM } from '@nimotech/nimoos-service'

type SpicePorts = Pick<KvmVM, 'spicePort' | 'spiceTlsPort'>

/**
 * spicePort 保活合并。
 *
 * 为什么需要它:`GET /v1/kvm/vms`(列表)与 `GET /v1/kvm/vms/:id` 都**不返回**有效的
 * spicePort / spiceTlsPort,只有 `GET /v1/kvm/vms/:id/vnc` 才返回。于是每次刷新列表,
 * 之前从 /vnc 拿到的端口就会被 0 冲掉,SPICE 提示条闪一下就消失。
 *
 * Vue2 用「新值 <= 0 且旧值 > 0 就沿用旧值」兜底(KVMFullPage.vue:893-897 / :919-922 /
 * :930-936,同一段逻辑抄了三遍)。**这是后端字段缺失的兜底,不是 bug**,照抄;
 * 这里抽成一个纯函数,三处调用点共用。
 */
export function preserveSpice(fresh: KvmVM, old: SpicePorts | null | undefined): KvmVM {
  if (!old) return fresh
  if (fresh.spicePort > 0 || !(old.spicePort > 0)) return fresh
  return { ...fresh, spicePort: old.spicePort, spiceTlsPort: old.spiceTlsPort }
}
```

- [ ] **Step 10: 跑三个 util 的测试 + 全量**

Run: `pnpm vitest run src/kvm/util/` 然后 `pnpm test`
Expected: 三个文件全绿;全量相对基线不新增红

- [ ] **Step 11: 提交(显式 pathspec)**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/kvm/util/ src/kvm/assets/
git commit -m "feat(kvm): 状态派生/格式化/spice 保活三个纯函数 util + OS 图标"
```

---


## Task 2: 地基 —— token + i18n + 路由 + 空壳页

**Files:**
- Modify: `src/styles/theme.sp9.css`(追加 `--kvm-*`)
- Create: `src/kvm/styles/kvm.css`
- Modify: `src/i18n/zh_cn.sp9.ts` · `src/i18n/en_us.sp9.ts`
- Create: `src/kvm/views/KvmPage.vue` + `KvmPage.test.ts`
- Modify: `src/router/index.ts`
- Create: `src/kvm/styles/kvmStyles.test.ts`

**Interfaces:**
- Consumes: T1 的 util(暂不用)
- Produces:`/kvm` 路由(name `kvm`);`KvmPage.vue` 默认导出;`kvm.css` 里的 `.kvm-*` 类;i18n key 前缀 `kvm*`

- [ ] **Step 1: 追加 token 到 `src/styles/theme.sp9.css`**

在文件末尾**两个块内各追加同一组值**(注意:`:root` 块和 `:root[data-theme='light']` 块都要加,值相同):

```css
/* ── P5 KVM ──
 * ⚠️ KVM 区**固定深色,不跟随全局主题** —— Vue2 KVMFullPage.vue 是写死的深色控制台配色
 * (#0d1117 / #161b22 / #21262d / #30363d),浅色主题下也保持深色。所以下面每个 token
 * 在 :root 与 :root[data-theme='light'] 两块里是**相同的值**。
 * 先例:--console-bg / --console-fg(终端与日志面板)同样两套主题同值。
 * 唯一例外是安装横幅(--kvm-banner-*),Vue2 那块本来就是浅蓝底,照抄。 */
  --kvm-bg: #0d1117;
  --kvm-panel: #161b22;
  --kvm-elev: #21262d;
  --kvm-border: #30363d;
  --kvm-fg: #c9d1d9;
  --kvm-fg-dim: #8b949e;
  --kvm-fg-faint: #6e7681;
  --kvm-accent: #8950f2;
  --kvm-accent-soft: rgba(137, 80, 242, 0.15);
  --kvm-on-accent: #ffffff;
  --kvm-ok: #76b32d;
  --kvm-ok-glow: rgba(118, 179, 45, 0.5);
  --kvm-ok-glow-weak: rgba(118, 179, 45, 0.3);
  --kvm-ok-glow-strong: rgba(118, 179, 45, 0.8);
  --kvm-warn: #e0a800;
  --kvm-warn-glow-weak: rgba(224, 168, 0, 0.3);
  --kvm-warn-glow-strong: rgba(224, 168, 0, 0.8);
  --kvm-warn-border: rgba(224, 168, 0, 0.3);
  --kvm-danger: #f85149;
  --kvm-danger-soft: rgba(248, 81, 73, 0.15);
  --kvm-danger-glow-weak: rgba(248, 81, 73, 0.3);
  --kvm-danger-glow-strong: rgba(248, 81, 73, 0.8);
  --kvm-idle: #6e7681;
  --kvm-toggle-off: #484f58;
  --kvm-overlay: rgba(22, 27, 34, 0.92);
  --kvm-shadow: rgba(0, 0, 0, 0.4);
  --kvm-shadow-soft: rgba(0, 0, 0, 0.2);
  --kvm-banner-bg: #e3f2fd;
  --kvm-banner-border: #bbdefb;
  --kvm-banner-fg: #0d47a1;
  --kvm-banner-btn: #1976d2;
  --kvm-banner-btn-hover: #1565c0;
```

- [ ] **Step 2: 跑 token 守卫,确认两块一致**

Run: `pnpm vitest run src/styles/theme.sp9.test.ts`
Expected: PASS(若报「token 名集合不一致」= 有一块漏加,补齐)

- [ ] **Step 3: 写 `src/kvm/styles/kvmStyles.test.ts`(样式白名单守卫,失败)**

照 SP8 的 `knowledgeStyles.test.ts` 惯例:每期新增 scss/css 段要有类名白名单守卫,防止后续任务往里塞不在册的类。

```ts
/// <reference types="node" />
// 必须用 node:fs 读 .css —— `?raw` 对 .css 在 vitest 下恒为空串(见 color-guard.test.ts)。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const src = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'kvm.css'),
  'utf8',
)

// 本期(P5)允许出现的类名。P6 加新块时往这里补,别偷偷塞。
const ALLOWED = new Set([
  'kvm-page', 'kvm-content', 'kvm-sidebar-toggle', 'toggle-icon', 'collapsed',
  'kvm-sidebar', 'kvm-header', 'kvm-header-left', 'kvm-header-text', 'kvm-header-right',
  'kvm-logo', 'kvm-title', 'kvm-status', 'kvm-settings-btn',
  'vm-list', 'empty-state', 'empty-icon', 'empty-text',
  'vm-list-item', 'active', 'vm-item-icon', 'os-icon', 'vm-item-info', 'vm-item-name',
  'vm-item-specs', 'vm-item-status', 'status-indicator', 'status-dot', 'status-text',
  'running', 'stopped', 'paused', 'suspended', 'error',
  'add-vm-btn', 'kvm-main', 'main-empty', 'empty-icon-ring', 'main-empty-icon',
  'vm-console-container', 'console-header', 'console-title', 'console-os-icon', 'console-status',
  'console-actions', 'action-btn', 'dropdown-wrapper', 'overflow-dropdown', 'dropdown-item',
  'is-danger', 'confirm-text-danger', 'toggle-indicator', 'on', 'dropdown-divider',
  'console-display', 'console-placeholder', 'console-hint', 'is-error', 'start-vm-btn',
  'power-icon', 'power-svg',
  'sendkey-toolbar', 'sendkey-divider', 'sendkey-btn', 'sendkey-hint', 'sendkey-img',
  'fullscreen-svg', 'sendkey-btn--fullscreen',
  'sendkey-slide-enter-active', 'sendkey-slide-leave-active',
  'sendkey-slide-enter-from', 'sendkey-slide-leave-to',
  'spice-info-bar', 'spice-info-content', 'spice-agent-hint', 'spice-info-close',
  'spice-toast-enter-active', 'spice-toast-leave-active',
  'spice-toast-enter-from', 'spice-toast-leave-to',
  'installation-banner', 'banner-content', 'banner-btn', 'is-loading',
  'kvm-progress-overlay', 'kvm-progress-card', 'kvm-progress-title', 'kvm-progress-msg',
  'kvm-spinner',
])

describe('kvm.css 类名白名单', () => {
  it('没有不在册的类名', () => {
    const used = new Set([...src.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]))
    expect([...used].filter((c) => !ALLOWED.has(c)).sort()).toEqual([])
  })
})

describe('kvm.css 不含裸颜色字面量(与全局 color-guard 双保险)', () => {
  it('所有颜色走 var(--kvm-*)', () => {
    // 去掉注释后再扫,避免注释里抄的 Vue2 色值被误判(color-guard 不剥注释,是已知坑,
    // 所以本文件的注释里**不要写** #hex)。
    const noComment = src.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(noComment).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(noComment.replace(/var\([^)]*\)/g, '')).not.toMatch(/\b(rgba?|hsla?)\s*\(/)
  })
})
```

- [ ] **Step 4: 建 `src/kvm/styles/kvm.css`,先只放本任务用得到的段**

本步只写:`.kvm-page` / `.kvm-content` / `.kvm-sidebar`(含折叠)/ `.kvm-sidebar-toggle` / `.kvm-header` 系列 / `.vm-list` / `.empty-state` / `.add-vm-btn` / `.kvm-main` / `.main-empty` 系列。数值**逐字**照 Vue2 `KVMFullPage.vue:1658-1790`(布局)与 `:1975-2015`(main-empty)。颜色全部换成 `var(--kvm-*)`。

关键数值锚点(照抄,别改):侧栏 `width: 22rem`;折叠切换按钮 `left: 22rem` / `width: 1.5rem` / `height: 3rem` / `border-radius: 0 .5rem .5rem 0`,折叠态 `left: 0` 且圆角镜像、图标 `rotate(180deg)`;侧栏 `transition: width .25s ease`;折叠仅在 `@media (min-width: 769px)` 生效且把 logo/title/status/list/add 按钮/header 一并 `display:none`;`.kvm-header` padding `.5rem 1rem`;`.kvm-logo` 2rem;`.kvm-title` `.9rem/600`;`.kvm-status` `.75rem`,点 `.4rem` 圆、running 时 `box-shadow: 0 0 8px var(--kvm-ok-glow)`;`.vm-list` `flex:1; overflow-y:auto; padding:.5rem`;`.empty-state` padding `3rem 1rem`、图标 `opacity:.4`;`.add-vm-btn` `width: calc(100% - 1rem); margin:.5rem; padding:.75rem; border-radius:.5rem`;`.main-empty .empty-icon-ring` `120px` 方、`2px dashed var(--kvm-border)`、圆、`margin-bottom:1.5rem`;`.main-empty h3` `1.125rem/500`。

窄屏块(`@media (max-width: 768px)`,照 Vue2 `:2740-2759`):`.kvm-sidebar { width:100%; position:absolute; left:0; top:4rem; bottom:0; z-index:10; transform:translateX(-100%); transition:transform .3s }`,`.kvm-sidebar.active { transform:translateX(0) }`(Vue2 用的类名是 `.open`,但 `.open` 未在模板里出现过 —— 是死代码;这里改用已在册的 `active`,并注释登记)。

- [ ] **Step 5: 追加 i18n 键**

`src/i18n/zh_cn.sp9.ts` 末尾追加(**中文以 Vue2 `zh_CN.json` 为准**;先 `grep` 该文件,查不到的再看组件内联):

```ts
  // ── P5 KVM ──
  kvmTitle: 'NIMO 虚拟机',
  kvmRunningSuffix: '运行中',
  kvmNoVms: '暂无虚拟机',
  kvmAddVm: '添加虚拟机',
  kvmSelectVmTitle: '选择一台虚拟机',
  kvmSelectVmHint: '从列表中选择一台虚拟机以查看控制台并进行管理',
  kvmStateRunning: '运行中',
  kvmStateStopped: '已停止',
  kvmStatePaused: '已暂停',
  kvmStateSuspended: '已挂起',
  kvmStateError: '错误',
  kvmSettings: '设置',
  kvmSettingsDisabledHint: '停止虚拟机后才能修改设置',
  kvmMore: '更多',
  kvmComingSoon: '即将支持',
  kvmPowerOn: '开机',
  kvmForceShutDown: '强制关机',
  kvmForceRestart: '强制重启',
  kvmPause: '暂停',
  kvmResume: '继续',
  kvmWakeUp: '唤醒',
  kvmAutoStart: '开机自启',
  kvmDelete: '删除',
  kvmAreYouSure: '确定吗?',
  kvmStopping: '正在停止',
  kvmRestarting: '正在重启',
  kvmDeleting: '正在删除',
  kvmVncPortUnavailable: 'VNC 端口不可用,请尝试重启虚拟机',
  kvmVncFetchFailed: '获取 VNC 信息失败',
  kvmInstallingFromIso: '正在从 ISO 安装。安装完成后请点击:',
  kvmFinishedInstalling: '我已安装完成',
  kvmEjectSuccess: '安装介质已弹出,下次重启将从硬盘启动。',
  kvmEjectFailed: '弹出安装介质失败',
  kvmSpiceHint: '为获得更好体验,请使用 virt-viewer 客户端连接:',
  kvmSpiceAgentWin: '在虚拟机内安装 virtio-win 驱动以启用剪贴板、音频与 USB 功能',
  kvmSpiceAgentLinux: '在虚拟机内安装 spice-vdagent 以启用剪贴板、音频与 USB 功能',
  kvmToggleCtrl: '按住 Ctrl',
  kvmToggleAlt: '按住 Alt',
  kvmToggleShift: '按住 Shift',
  kvmToggleWin: '按住 Windows 键',
  kvmPressTab: '按 Tab',
  kvmPressEsc: '按 Esc',
  kvmPressCtrlAltDel: '按 Ctrl+Alt+Del',
  kvmFullscreen: '全屏',
  kvmExitFullscreen: '退出全屏',
  kvmClose: '关闭',
  kvmFailedStart: '启动虚拟机失败',
  kvmFailedStop: '停止虚拟机失败',
  kvmFailedRestart: '重启失败',
  kvmFailedPause: '暂停失败',
  kvmFailedResume: '继续失败',
  kvmFailedDelete: '删除虚拟机失败',
  kvmFailedAutostart: '保存设置失败',
  kvmToggleSidebar: '折叠/展开侧边栏',
```

`src/i18n/en_us.sp9.ts` 追加同名 key,英文照 Vue2 模板里的原文(`NIMO Virtual Machines` / `running` / `No virtual machines` / `Add VM` / `Select a Virtual Machine` / `Choose a VM from the list to view its console and manage it` / `Running` / `Stopped` / `Paused` / `Suspended` / `Error` / `Settings` / `Stop VM to modify settings` / `More` / `Coming soon` / `Power On` / `Force Shut Down` / `Force Restart` / `Pause` / `Resume` / `Wake Up` / `Auto Start` / `Delete` / `Are you sure?` / `Stopping VM` / `Restarting VM` / `Deleting VM` / `VNC port not available, try restarting` / `Failed to get VNC info` / `Installing from ISO. Click when finished:` / `I Finished Installing` / `Installation media ejected. VM will boot from hard disk on next restart.` / `Failed to eject installation media` / `For better experience, use virt-viewer client to connect:` / `Install virtio-win drivers in VM for clipboard, audio & USB features` / `Install spice-vdagent in VM for clipboard, audio & USB features` / `Toggle Ctrl` / `Toggle Alt` / `Toggle Shift` / `Toggle Windows` / `Press Tab` / `Press Esc` / `Press Ctrl+Alt+Del` / `Fullscreen` / `Exit Fullscreen` / `Close` / `Failed to start VM` / `Failed to stop VM` / `Failed to restart` / `Failed to pause` / `Failed to resume` / `Failed to delete VM` / `Failed to save settings` / `Toggle sidebar`)。

- [ ] **Step 6: 写 `src/kvm/views/KvmPage.test.ts`(失败)**

```ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import KvmPage from './KvmPage.vue'
import { i18n } from '../../i18n'

vi.mock('@nimotech/nimoos-service', () => ({
  service: { kvm: { getVMList: () => Promise.resolve({ data: [], total: 0 }) } },
}))
vi.mock('../../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: () => () => {} }) }))

const mountPage = () => mount(KvmPage, { global: { plugins: [i18n] } })

describe('KvmPage 壳', () => {
  it('渲染左栏标题与右侧空态', () => {
    const w = mountPage()
    expect(w.text()).toContain('NIMO 虚拟机')
    expect(w.text()).toContain('选择一台虚拟机')
  })

  it('侧栏折叠按钮点一下加 collapsed 类,再点去掉', async () => {
    const w = mountPage()
    const btn = w.get('.kvm-sidebar-toggle')
    expect(w.get('.kvm-sidebar').classes()).not.toContain('collapsed')
    await btn.trigger('click')
    expect(w.get('.kvm-sidebar').classes()).toContain('collapsed')
    await btn.trigger('click')
    expect(w.get('.kvm-sidebar').classes()).not.toContain('collapsed')
  })

  it('折叠态下鼠标移入侧栏会临时展开(Vue2 isSidebarCollapsed = collapsed && !hover)', async () => {
    const w = mountPage()
    await w.get('.kvm-sidebar-toggle').trigger('click')
    await w.get('.kvm-sidebar').trigger('mouseenter')
    expect(w.get('.kvm-sidebar').classes()).not.toContain('collapsed')
    await w.get('.kvm-sidebar').trigger('mouseleave')
    expect(w.get('.kvm-sidebar').classes()).toContain('collapsed')
  })

  it('折叠按钮有 aria-label(图标按钮硬约束)', () => {
    expect(mountPage().get('.kvm-sidebar-toggle').attributes('aria-label')).toBeTruthy()
  })
})
```

- [ ] **Step 7: 实现 `src/kvm/views/KvmPage.vue`(本任务只做壳)**

```vue
<script setup lang="ts">
// KVM 区主页(路由 /kvm)。视觉 1:1 对 Vue2 components/KVM/KVMFullPage.vue。
// P5 = 列表 + 控制台 + 电源;P6 补创建向导 / VM 设置 / 快照 / 全局设置。
//
// ⚠️ 本区**固定深色,不跟随全局主题** —— Vue2 该页是写死的深色控制台配色,
// --kvm-* token 在两个主题块里同值(见 styles/theme.sp9.css 注释)。
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import '../styles/kvm.css'

const { t } = useI18n()

// Vue2 isSidebarCollapsed = sidebarCollapsed && !sidebarHover ——
// 折叠后鼠标移上去临时展开,移开又收回。照抄。
const sidebarCollapsed = ref(false)
const sidebarHover = ref(false)
const collapsed = computed(() => sidebarCollapsed.value && !sidebarHover.value)
</script>

<template>
  <div class="kvm-page">
    <div class="kvm-content">
      <button
        class="kvm-sidebar-toggle"
        :class="{ collapsed }"
        :aria-label="t('kvmToggleSidebar')"
        @click="sidebarCollapsed = !sidebarCollapsed"
      >
        <span class="toggle-icon" aria-hidden="true">‹</span>
      </button>

      <aside
        class="kvm-sidebar"
        :class="{ collapsed }"
        @mouseenter="sidebarHover = true"
        @mouseleave="sidebarHover = false"
      >
        <header class="kvm-header">
          <div class="kvm-header-left">
            <div class="kvm-header-text">
              <h2 class="kvm-title">{{ t('kvmTitle') }}</h2>
            </div>
          </div>
        </header>
        <div class="vm-list" />
      </aside>

      <main class="kvm-main">
        <div class="main-empty">
          <div class="empty-icon-ring">
            <span class="main-empty-icon" aria-hidden="true">▭</span>
          </div>
          <h3>{{ t('kvmSelectVmTitle') }}</h3>
          <p>{{ t('kvmSelectVmHint') }}</p>
        </div>
      </main>
    </div>
  </div>
</template>
```

> 注:`‹` / `▭` 是**临时占位单色符号**,T4/T8 会换成从 Vue2 拷来的 svg 或既有图标组件。**不许用 emoji**。

- [ ] **Step 8: 接路由 `src/router/index.ts`**

顶部加 `import KvmPage from '../kvm/views/KvmPage.vue'`;`routes` 数组里、`...settingsRoutes` 之后加一行:
```ts
  { path: '/kvm', name: 'kvm', component: KvmPage },
```
**注意**:必须加在 `{ path: '/files/:path(.*)*' }` **之前**(那条是通配兜底)。桌面磁贴翻路由归 P8,现在只能手输 `#/kvm`。

- [ ] **Step 9: 跑测试**

Run: `pnpm vitest run src/kvm/ src/styles/ src/i18n/` 然后 `pnpm test && pnpm vue-tsc --noEmit`
Expected: 全绿;i18n parity 不报缺键

- [ ] **Step 10: 起 dev server 目视确认形状**

Run: `pnpm dev --host`(端口 5273),浏览器开 `http://<ip>:5273/app/#/kvm`
Expected: 深色底、左侧 22rem 侧栏带标题、右侧虚线圆环空态、折叠按钮能收放侧栏

- [ ] **Step 11: 提交**

```bash
git add src/kvm/views/ src/kvm/styles/ src/styles/theme.sp9.css src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts src/router/index.ts
git commit -m "feat(kvm): 地基 —— token 分片/文案/kvm.css/路由 /kvm/ 空壳页"
```

---

## Task 3: `useVmList` 数据层

**Files:**
- Create: `src/kvm/composables/useVmList.ts` + `useVmList.test.ts`

**Interfaces:**
- Consumes: `service.kvm`(T0)· `preserveSpice`(T1)· `useMessageBus`(既有 `src/composables/useMessageBus.ts`)
- Produces:
```ts
useVmList(): {
  vms: Ref<KvmVM[]>
  selectedVM: Ref<KvmVM | null>
  isLoading: Ref<boolean>
  runningCount: ComputedRef<number>
  processing: Ref<Set<string>>          // 正在执行动作的 vm id
  lastError: Ref<string>                 // 最近一次动作的错误文案(i18n key 或后端原文)
  fetchVMs(): Promise<void>
  fetchVM(id: string): Promise<void>
  selectVM(vm: KvmVM): Promise<void>
  start(vm) / stop(vm) / restart(vm) / pause(vm) / resume(vm) / wakeup(vm): Promise<void>
  toggleAutostart(vm): Promise<void>
  remove(vm): Promise<void>              // deleteVM
  ejectInstallMedia(vm): Promise<void>   // setBootFromDisk(true)
  onVncShouldConnect(cb: (vm: KvmVM) => void): void   // 需要建立 VNC 连接时回调
  onVncShouldDisconnect(cb: () => void): void
  dispose(): void
}
```

- [ ] **Step 1: 写 `useVmList.test.ts`(失败)**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import type { KvmVM } from '@nimotech/nimoos-service'

const api = {
  getVMList: vi.fn(), getVM: vi.fn(), startVM: vi.fn(), stopVM: vi.fn(),
  restartVM: vi.fn(), pauseVM: vi.fn(), resumeVM: vi.fn(), wakeupVM: vi.fn(),
  deleteVM: vi.fn(), setAutostart: vi.fn(), setBootFromDisk: vi.fn(),
}
vi.mock('@nimotech/nimoos-service', () => ({ service: { get kvm() { return api } } }))

// 可控的 MessageBus 桩:测试里手动 emit
const handlers: Record<string, ((p: unknown) => void)[]> = {}
vi.mock('../../composables/useMessageBus', () => ({
  useMessageBus: () => ({
    on(ev: string, cb: (p: unknown) => void) {
      ;(handlers[ev] ||= []).push(cb)
      return () => { handlers[ev] = handlers[ev].filter((h) => h !== cb) }
    },
  }),
}))
const emit = (ev: string, props: unknown) => (handlers[ev] || []).forEach((h) => h(props))

import { useVmList } from './useVmList'

const VM = (over: Partial<KvmVM> = {}): KvmVM => ({
  id: 'vm-1', name: 'sp9-alpine-test', uuid: 'u', state: 'running', vcpu: 2, memory: 1024,
  disk: 8, diskUsedPercent: 0, diskPath: '/d', iso: '/DATA/KVM/isos/alpine-319.iso', os: 'linux',
  networkMode: 'nat', networkInterface: 'virbr0', firmware: 'bios', bootFromDisk: false,
  vncPort: 5900, vncWebsocketPort: 5700, spicePort: 0, spiceTlsPort: 0, autostart: false,
  createdAt: '', updatedAt: '', ...over,
})

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
  Object.keys(handlers).forEach((k) => delete handlers[k])
  api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
  api.getVM.mockResolvedValue(VM())
  ;['startVM','stopVM','restartVM','pauseVM','resumeVM','wakeupVM','deleteVM'].forEach(
    (k) => (api as Record<string, ReturnType<typeof vi.fn>>)[k].mockResolvedValue(undefined))
  api.setAutostart.mockImplementation((_id: string, v: boolean) => Promise.resolve(v))
  api.setBootFromDisk.mockResolvedValue(undefined)
})

describe('fetchVMs', () => {
  it('首次拉取后自动选中第一台(Vue2 :900)', async () => {
    const s = useVmList()
    await s.fetchVMs()
    expect(s.vms.value).toHaveLength(1)
    expect(s.selectedVM.value?.id).toBe('vm-1')
  })

  it('空列表时 selectedVM 保持 null(P5 无创建弹窗,走空态;Vue2 这里自动弹创建框,P6 补)', async () => {
    api.getVMList.mockResolvedValue({ data: [], total: 0 })
    const s = useVmList()
    await s.fetchVMs()
    expect(s.selectedVM.value).toBeNull()
  })

  it('刷新后原选中项仍在 → 换成新对象且保持选中', async () => {
    const s = useVmList()
    await s.fetchVMs()
    api.getVMList.mockResolvedValue({ data: [VM({ state: 'stopped' })], total: 1 })
    await s.fetchVMs()
    expect(s.selectedVM.value?.state).toBe('stopped')
  })

  it('刷新后原选中项消失 → selectedVM 置空', async () => {
    const s = useVmList()
    await s.fetchVMs()
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'other' })], total: 1 })
    await s.fetchVMs()
    expect(s.selectedVM.value).toBeNull()
  })

  it('刷新时保活 spicePort(列表接口不返回,只有 /vnc 返回)', async () => {
    const s = useVmList()
    await s.fetchVMs()
    s.selectedVM.value!.spicePort = 5901
    s.selectedVM.value!.spiceTlsPort = 5902
    await s.fetchVMs()  // 新数据 spicePort=0
    expect(s.selectedVM.value?.spicePort).toBe(5901)
    expect(s.selectedVM.value?.spiceTlsPort).toBe(5902)
  })

  it('请求失败时列表清空、不抛', async () => {
    api.getVMList.mockRejectedValue(new Error('libvirt down'))
    const s = useVmList()
    await s.fetchVMs()
    expect(s.vms.value).toEqual([])
  })

  it('runningCount 只数 running', async () => {
    api.getVMList.mockResolvedValue({ data: [VM(), VM({ id: 'b', state: 'stopped' })], total: 2 })
    const s = useVmList()
    await s.fetchVMs()
    expect(s.runningCount.value).toBe(1)
  })
})

describe('过期守卫', () => {
  it('后发的 fetchVMs 先返回时,先发的迟到结果不得覆盖(交错路径)', async () => {
    let resolveSlow: (v: unknown) => void = () => {}
    api.getVMList
      .mockImplementationOnce(() => new Promise((r) => { resolveSlow = r }))       // 慢的,先发
      .mockResolvedValueOnce({ data: [VM({ name: 'fresh' })], total: 1 })          // 快的,后发
    const s = useVmList()
    const slow = s.fetchVMs()
    await s.fetchVMs()                       // 后发先至
    expect(s.vms.value[0].name).toBe('fresh')
    resolveSlow({ data: [VM({ name: 'stale' })], total: 1 })
    await slow
    expect(s.vms.value[0].name).toBe('fresh')  // 迟到的旧结果被丢弃
  })

  it('dispose 之后到达的结果不再写入', async () => {
    let resolveIt: (v: unknown) => void = () => {}
    api.getVMList.mockImplementationOnce(() => new Promise((r) => { resolveIt = r }))
    const s = useVmList()
    const p = s.fetchVMs()
    s.dispose()
    resolveIt({ data: [VM({ name: 'late' })], total: 1 })
    await p
    expect(s.vms.value).toEqual([])
  })
})

describe('MessageBus 事件(照 Vue2 :766-826)', () => {
  it('vm_started 把该 VM 改成 running 并触发 VNC 连接回调', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ state: 'stopped' })], total: 1 })
    const s = useVmList()
    await s.fetchVMs()
    const onConnect = vi.fn()
    s.onVncShouldConnect(onConnect)
    emit('kvm:vm_started', { vm_id: 'vm-1' })
    await nextTick()
    expect(s.vms.value[0].state).toBe('running')
    expect(onConnect).toHaveBeenCalledOnce()
  })

  it('vm_stopped 改状态并触发断开回调', async () => {
    const s = useVmList()
    await s.fetchVMs()
    const onDisconnect = vi.fn()
    s.onVncShouldDisconnect(onDisconnect)
    emit('kvm:vm_stopped', { vm_id: 'vm-1' })
    await nextTick()
    expect(s.selectedVM.value?.state).toBe('stopped')
    expect(onDisconnect).toHaveBeenCalledOnce()
  })

  it('vm_paused → paused 且断开;vm_resumed → running 且连接', async () => {
    const s = useVmList()
    await s.fetchVMs()
    const onC = vi.fn(); const onD = vi.fn()
    s.onVncShouldConnect(onC); s.onVncShouldDisconnect(onD)
    emit('kvm:vm_paused', { vm_id: 'vm-1' }); await nextTick()
    expect(s.selectedVM.value?.state).toBe('paused')
    expect(onD).toHaveBeenCalledOnce()
    emit('kvm:vm_resumed', { vm_id: 'vm-1' }); await nextTick()
    expect(s.selectedVM.value?.state).toBe('running')
    expect(onC).toHaveBeenCalledOnce()
  })

  it('事件里没有 vm_id 时退化成整表刷新(Vue2 的 else 分支)', async () => {
    const s = useVmList()
    await s.fetchVMs()
    api.getVMList.mockClear()
    emit('kvm:vm_started', {})
    await nextTick()
    expect(api.getVMList).toHaveBeenCalledOnce()
  })

  it('vm_deleted 从列表移除;若删的是选中项则清空选中', async () => {
    const s = useVmList()
    await s.fetchVMs()
    emit('kvm:vm_deleted', { vm_id: 'vm-1' })
    await nextTick()
    expect(s.vms.value).toHaveLength(0)
    expect(s.selectedVM.value).toBeNull()
  })

  it('vm_created / vm_autostart_changed 触发整表刷新', async () => {
    const s = useVmList()
    await s.fetchVMs()
    api.getVMList.mockClear()
    emit('kvm:vm_created', { vm_id: 'x' })
    emit('kvm:vm_autostart_changed', { vm_id: 'vm-1' })
    await nextTick()
    expect(api.getVMList).toHaveBeenCalledTimes(2)
  })

  it('事件针对的是别的 VM 时,不动当前选中项的 VNC', async () => {
    api.getVMList.mockResolvedValue({ data: [VM(), VM({ id: 'other', state: 'stopped' })], total: 2 })
    const s = useVmList()
    await s.fetchVMs()
    const onC = vi.fn()
    s.onVncShouldConnect(onC)
    emit('kvm:vm_started', { vm_id: 'other' })
    await nextTick()
    expect(s.vms.value[1].state).toBe('running')
    expect(onC).not.toHaveBeenCalled()
  })

  it('dispose 后不再响应事件', async () => {
    const s = useVmList()
    await s.fetchVMs()
    s.dispose()
    emit('kvm:vm_stopped', { vm_id: 'vm-1' })
    await nextTick()
    expect(s.selectedVM.value?.state).toBe('running')
  })
})

describe('电源动作', () => {
  it('start 乐观改状态为 running 并请求连接 VNC', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ state: 'stopped' })], total: 1 })
    const s = useVmList()
    await s.fetchVMs()
    const onC = vi.fn(); s.onVncShouldConnect(onC)
    await s.start(s.selectedVM.value!)
    expect(api.startVM).toHaveBeenCalledWith('vm-1')
    expect(s.selectedVM.value?.state).toBe('running')
    expect(onC).toHaveBeenCalledOnce()
  })

  it('start 失败时不改状态、写 lastError', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ state: 'stopped' })], total: 1 })
    api.startVM.mockRejectedValue(new Error('boom'))
    const s = useVmList()
    await s.fetchVMs()
    await s.start(s.selectedVM.value!)
    expect(s.selectedVM.value?.state).toBe('stopped')
    expect(s.lastError.value).toBeTruthy()
  })

  it('restart 只断开、不立刻重连(修 Vue2 竞态,靠 vm_started 事件兜底)', async () => {
    const s = useVmList()
    await s.fetchVMs()
    const onC = vi.fn(); const onD = vi.fn()
    s.onVncShouldConnect(onC); s.onVncShouldDisconnect(onD)
    await s.restart(s.selectedVM.value!)
    expect(onD).toHaveBeenCalledOnce()
    expect(onC).not.toHaveBeenCalled()      // ← 与 Vue2 的偏离点,已登记
    emit('kvm:vm_started', { vm_id: 'vm-1' })
    await nextTick()
    expect(onC).toHaveBeenCalledOnce()
  })

  it('pause 改 paused 并断开;resume/wakeup 改 running 并连接', async () => {
    const s = useVmList()
    await s.fetchVMs()
    const onC = vi.fn(); const onD = vi.fn()
    s.onVncShouldConnect(onC); s.onVncShouldDisconnect(onD)
    await s.pause(s.selectedVM.value!)
    expect(s.selectedVM.value?.state).toBe('paused')
    expect(onD).toHaveBeenCalledOnce()
    await s.resume(s.selectedVM.value!)
    expect(s.selectedVM.value?.state).toBe('running')
    expect(onC).toHaveBeenCalledOnce()
  })

  it('动作进行中 processing 含该 id,结束后移除', async () => {
    let done: () => void = () => {}
    api.stopVM.mockImplementation(() => new Promise<void>((r) => { done = r }))
    const s = useVmList()
    await s.fetchVMs()
    const p = s.stop(s.selectedVM.value!)
    expect(s.processing.value.has('vm-1')).toBe(true)
    done(); await p
    expect(s.processing.value.has('vm-1')).toBe(false)
  })

  it('toggleAutostart 成功后翻转,失败后回滚', async () => {
    const s = useVmList()
    await s.fetchVMs()
    await s.toggleAutostart(s.selectedVM.value!)
    expect(s.selectedVM.value?.autostart).toBe(true)
    api.setAutostart.mockRejectedValue(new Error('nope'))
    await s.toggleAutostart(s.selectedVM.value!)
    expect(s.selectedVM.value?.autostart).toBe(true)   // 回滚到 true
    expect(s.lastError.value).toBeTruthy()
  })

  it('remove 成功后从列表移除并清空选中', async () => {
    const s = useVmList()
    await s.fetchVMs()
    await s.remove(s.selectedVM.value!)
    expect(api.deleteVM).toHaveBeenCalledWith('vm-1')
    expect(s.vms.value).toHaveLength(0)
    expect(s.selectedVM.value).toBeNull()
  })

  it('ejectInstallMedia 调 setBootFromDisk(true) 并整表刷新', async () => {
    const s = useVmList()
    await s.fetchVMs()
    api.getVMList.mockClear()
    await s.ejectInstallMedia(s.selectedVM.value!)
    expect(api.setBootFromDisk).toHaveBeenCalledWith('vm-1', true)
    expect(api.getVMList).toHaveBeenCalledOnce()
  })

  it('lastError 取后端 message 原文,而不是写死文案', async () => {
    api.stopVM.mockRejectedValue(new Error('[KVM] domain is not running'))
    const s = useVmList()
    await s.fetchVMs()
    await s.stop(s.selectedVM.value!)
    // Vue2 getErrMsg 会剥掉开头的 [xxx] 前缀
    expect(s.lastError.value).toBe('domain is not running')
  })
})

describe('selectVM', () => {
  it('选中后单独拉一次详情合并进列表', async () => {
    api.getVMList.mockResolvedValue({ data: [VM(), VM({ id: 'b', state: 'stopped' })], total: 2 })
    api.getVM.mockResolvedValue(VM({ id: 'b', state: 'stopped', name: 'detailed' }))
    const s = useVmList()
    await s.fetchVMs()
    await s.selectVM(s.vms.value[1])
    expect(api.getVM).toHaveBeenCalledWith('b')
    expect(s.selectedVM.value?.name).toBe('detailed')
    expect(s.vms.value[1].name).toBe('detailed')
  })

  it('详情请求失败不清空选中(Vue2 只 console.warn)', async () => {
    api.getVM.mockRejectedValue(new Error('404'))
    const s = useVmList()
    await s.fetchVMs()
    await s.selectVM(s.vms.value[0])
    expect(s.selectedVM.value?.id).toBe('vm-1')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/kvm/composables/useVmList.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 `src/kvm/composables/useVmList.ts`**

要点(实现者照此写,不要自由发挥):
- 用 `ref` + 一个模块内 `let epoch = 0` 风格的**就地代际守卫**:每次 `fetchVMs` 自增 `listEpoch`,回写前比对;`dispose()` 把 `alive=false`。**不要抽公共 guard**(记忆:过早抽象已被评审逮过)。
- 事件订阅在 composable 创建时一次性 `on()` 七个事件,把 7 个 unsubscribe 存进数组,`dispose()` 里全调一遍。
- `setVMState(id, state)` 同时改 `vms` 里的那一项与 `selectedVM`(两者是**同一个对象引用**时也要保证响应式:实现里 `vms` 存对象数组,`selectedVM` 指向数组里的同一个对象)。
- 电源动作模板:`processing.add(id)` → `await service.kvm.xxx(id)` → 乐观改 state + 触发 VNC 回调 → `catch` 写 `lastError` → `finally processing.delete(id)`。
- `errText(e)`:取 `e.message`,**剥掉开头的 `[xxx] ` 前缀**(照 Vue2 `getErrMsg` `:836-839` 的 `replace(/^\[.*?\]\s*/, '')`),空则回退传入的 i18n key。
- **`restart` 的偏离必须写注释**:
```ts
// ⚠️ 与 Vue2 的偏离(SP9-P5 登记):Vue2 restartVM(:1567-1583)在请求返回后立刻
// disconnectVNC() + connectVNC()。VM 刚重启,VNC 端口大概率还没监听,connect 必失败,
// 于是 vncError 被永久写死在屏上、且不会自愈。这里只断开,重连交给 kvm:vm_started
// 事件兜底(后端确实会发,constants.go:17)。界面表现不变,只是不再卡在错误态。
```
- `onVncShouldConnect` / `onVncShouldDisconnect` 用单个回调槽(`let connectCb`),不是数组 —— 只有 ConsoleStage 一个消费方。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/kvm/composables/useVmList.test.ts`
Expected: PASS

- [ ] **Step 5: 变异验证(证明测试有判别力)**

依次做这 3 处破坏,各确认有测试翻红,然后**改回来**:
1. 把 `preserveSpice` 调用删掉 → 「刷新时保活 spicePort」必红
2. 把过期守卫的 `if (myEpoch !== listEpoch) return` 删掉 → 「后发先至」必红
3. 把 `restart` 里补一句 `connectCb?.(vm)` → 「restart 只断开不立刻重连」必红

- [ ] **Step 6: 全量 + 提交**

```bash
pnpm test && pnpm vue-tsc --noEmit
git add src/kvm/composables/useVmList.ts src/kvm/composables/useVmList.test.ts
git commit -m "feat(kvm): useVmList 数据层(事件驱动/spice 保活/电源动作/过期守卫)"
```

---

## Task 4: 左侧栏两个组件

**Files:**
- Create: `src/kvm/components/VmListItem.vue` + `VmListItem.test.ts`
- Create: `src/kvm/components/VmSidebar.vue` + `VmSidebar.test.ts`
- Modify: `src/kvm/views/KvmPage.vue`(把 T2 的占位 `<aside>` 换成 `<VmSidebar>`)
- Modify: `src/kvm/styles/kvm.css`(追加列表项与状态点样式)

**Interfaces:**
- Consumes: `osIconFor` / `formatRam` / `stateLabelKey`(T1)· `useVmList`(T3)
- Produces:
  - `VmListItem` props `{ vm: KvmVM, active: boolean }`,emit `select`
  - `VmSidebar` props `{ vms: KvmVM[], selectedId: string | null, runningCount: number, isLoading: boolean, collapsed: boolean }`,emit `select(vm)`

- [ ] **Step 1: 写 `VmListItem.test.ts`(失败)**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VmListItem from './VmListItem.vue'
import { i18n } from '../../i18n'
import type { KvmVM } from '@nimotech/nimoos-service'

const VM = (over: Partial<KvmVM> = {}) => ({
  id: 'vm-1', name: 'sp9-alpine-test', state: 'running', vcpu: 2, memory: 1024,
  os: 'linux', ...over,
} as KvmVM)

const mk = (vm = VM(), active = false) =>
  mount(VmListItem, { props: { vm, active }, global: { plugins: [i18n] } })

describe('VmListItem', () => {
  it('显示名字、vCPU 数、内存(照 Vue2 :47-50 的 "2 vCPU" / "1.0 GB")', () => {
    const t = mk().text()
    expect(t).toContain('sp9-alpine-test')
    expect(t).toContain('2 vCPU')
    expect(t).toContain('1.0 GB')
  })

  it('状态点带 state 类,文字走 i18n', () => {
    const w = mk()
    expect(w.get('.status-dot').classes()).toContain('running')
    expect(w.text()).toContain('运行中')
  })

  it('未知状态(crashed)原样显示后端字符串,不显示空白', () => {
    expect(mk(VM({ state: 'crashed' })).text()).toContain('crashed')
  })

  it('active 时加 active 类', () => {
    expect(mk(VM(), true).classes()).toContain('active')
    expect(mk(VM(), false).classes()).not.toContain('active')
  })

  it('点击 emit select', async () => {
    const w = mk()
    await w.trigger('click')
    expect(w.emitted('select')).toHaveLength(1)
  })

  it('OS 图标 alt 用 os 字段(可访问性)', () => {
    expect(mk(VM({ os: 'ubuntu' })).get('img.os-icon').attributes('alt')).toBe('ubuntu')
  })

  it('长名字不撑破:类上有省略号样式钩子', () => {
    expect(mk(VM({ name: 'a'.repeat(80) })).find('.vm-item-name').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: 实现 `VmListItem.vue`,跑测试转绿**

模板照 Vue2 `KVMFullPage.vue:36-59`。样式追加到 `kvm.css`,数值照 `:1836-1948`:`.vm-list-item` padding `.75rem`、`margin-bottom:.25rem`、`border-radius:.5rem`、`border:1px solid transparent`,hover `background: var(--kvm-elev)`,active `background: var(--kvm-accent-soft); border-color: var(--kvm-accent)`;`.vm-item-icon` `2.25rem` 方、`border-radius:.5rem`、底 `var(--kvm-elev)`、`margin-right:.75rem`,内 `.os-icon` `1.5rem`;`.vm-item-name` `.9rem/500` + 省略号三件套;`.vm-item-specs` `gap:.75rem; font-size:.75rem`;`.vm-item-status .status-dot` `.5rem` 方圆点,running/paused/suspended/error 各带呼吸动画(`breathe-green` 2s / `breathe-yellow` 2s / `breathe-yellow` 4s / `breathe-red` 2s),stopped 纯 `var(--kvm-idle)`;`.status-text` `.65rem`、`margin-left:.375rem`。三个 `@keyframes breathe-*` 照 `:2762-2793`。

- [ ] **Step 3: 写 `VmSidebar.test.ts`(失败)**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VmSidebar from './VmSidebar.vue'
import { i18n } from '../../i18n'
import type { KvmVM } from '@nimotech/nimoos-service'

const VM = (id: string, state = 'running') => ({ id, name: id, state, vcpu: 1, memory: 512, os: 'linux' } as KvmVM)
const mk = (props: Partial<InstanceType<typeof VmSidebar>['$props']> = {}) =>
  mount(VmSidebar, {
    props: { vms: [VM('a'), VM('b', 'stopped')], selectedId: 'a', runningCount: 1, isLoading: false, collapsed: false, ...props },
    global: { plugins: [i18n] },
  })

describe('VmSidebar', () => {
  it('头部显示 "1 / 2 运行中"', () => {
    expect(mk().get('.kvm-status').text().replace(/\s+/g, ' ')).toContain('1 / 2 运行中')
  })

  it('有运行中的机器时头部状态点亮起', () => {
    expect(mk().get('.kvm-status .status-dot').classes()).toContain('running')
    expect(mk({ runningCount: 0 }).get('.kvm-status .status-dot').classes()).not.toContain('running')
  })

  it('渲染出每台 VM', () => {
    expect(mk().findAll('.vm-list-item')).toHaveLength(2)
  })

  it('点某台 emit select 并带上那台的对象', async () => {
    const w = mk()
    await w.findAll('.vm-list-item')[1].trigger('click')
    expect((w.emitted('select')![0][0] as KvmVM).id).toBe('b')
  })

  it('空列表且已加载完 → 显示空态文案', () => {
    expect(mk({ vms: [], runningCount: 0 }).text()).toContain('暂无虚拟机')
  })

  it('加载中且列表为空 → 不显示空态(照 Vue2 v-if="vms.length===0 && !isLoading")', () => {
    expect(mk({ vms: [], runningCount: 0, isLoading: true }).text()).not.toContain('暂无虚拟机')
  })

  it('Add VM 按钮渲染但禁用,带 title 说明(P6 才实现)', () => {
    const btn = mk().get('.add-vm-btn')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.attributes('title')).toContain('即将支持')
  })

  it('头部齿轮(全局设置)同样渲染但禁用', () => {
    const btn = mk().get('.kvm-settings-btn')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.attributes('aria-label')).toBeTruthy()
  })

  it('collapsed 透传到根元素', () => {
    expect(mk({ collapsed: true }).classes()).toContain('collapsed')
  })
})
```

- [ ] **Step 4: 实现 `VmSidebar.vue`,把 `KvmPage.vue` 接上,跑测试**

模板照 Vue2 `:10-67`。**Add VM / 齿轮两个按钮渲染但 `disabled` + `:title="t('kvmComingSoon')"`**(用户 2026-08-02 拍板);齿轮要有 `aria-label`,图标用单色符号,**不许 emoji**。`KvmPage.vue` 里引入 `useVmList`,`onMounted` 调 `fetchVMs()`,`onUnmounted` 调 `dispose()`。

- [ ] **Step 5: 全量 + dev server 目视 + 提交**

Run: `pnpm test && pnpm vue-tsc --noEmit`;`pnpm dev --host` 看 `#/kvm` 左栏出现 `sp9-alpine-test` 一行、状态点绿色呼吸、头部「1 / 1 运行中」

```bash
git add src/kvm/components/VmListItem.vue src/kvm/components/VmListItem.test.ts src/kvm/components/VmSidebar.vue src/kvm/components/VmSidebar.test.ts src/kvm/views/KvmPage.vue src/kvm/views/KvmPage.test.ts src/kvm/styles/kvm.css src/kvm/styles/kvmStyles.test.ts
git commit -m "feat(kvm): 左侧 VM 列表(状态呼吸点/运行计数/P6 入口占位禁用)"
```

---

## Task 5: 控制台头 + 溢出菜单 + 电源动作 + 进度遮罩

**Files:**
- Create: `src/kvm/components/OverflowMenu.vue` + `OverflowMenu.test.ts`
- Create: `src/kvm/components/ConsoleHeader.vue` + `ConsoleHeader.test.ts`
- Create: `src/kvm/components/ProgressOverlay.vue`
- Modify: `src/kvm/views/KvmPage.vue` · `src/kvm/styles/kvm.css` · `kvmStyles.test.ts`(白名单已含相关类)

**Interfaces:**
- Consumes: T1 全部派生 · T3 的电源动作
- Produces:
  - `OverflowMenu` props `{ vm: KvmVM, processing: boolean }`,emit `action(name)`,`name ∈ 'start'|'stop'|'restart'|'pause'|'resume'|'wakeup'|'autostart'|'delete'`
  - `ConsoleHeader` props `{ vm: KvmVM, processing: boolean }`,emit `action(name)`
  - `ProgressOverlay` props `{ title: string, message: string }`

**就地二次确认的实现契约**(用户 2026-08-02 拍板照 Vue2):
- 组件内两个 ref:`pendingAction: string`(''/'stop'/'restart'/'delete')、`pendingId: string`
- 只有 **stop / restart / delete** 三项需要确认(Vue2 只给这三项写了 `confirmXxx`);start / pause / resume / wakeup / autostart **直接执行**
- 第一次点:文字换成「确定吗?」并加 `.confirm-text-danger` 类,**不发请求**
- 第二次点同一项:清确认态 → emit action → 关菜单
- 关菜单 / 点菜单外 / 切换 VM → `resetPendingConfirm()`
- **确认目标必须用非响应式变量存**(P4 教训 ③:响应式变量在弹窗关闭动画期间被清空,导致确认落到空目标)

- [ ] **Step 1: 写 `OverflowMenu.test.ts`(失败)**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import OverflowMenu from './OverflowMenu.vue'
import { i18n } from '../../i18n'
import type { KvmVM } from '@nimotech/nimoos-service'

const VM = (state: string, over: Partial<KvmVM> = {}) =>
  ({ id: 'vm-1', name: 'x', state, autostart: false, ...over } as KvmVM)
const mk = (vm: KvmVM, processing = false) =>
  mount(OverflowMenu, { props: { vm, processing }, global: { plugins: [i18n] } })
const labels = (w: ReturnType<typeof mk>) => w.findAll('.dropdown-item').map((b) => b.text())

describe('菜单项按状态显隐(对 Vue2 :97-135)', () => {
  it('running:关机/重启/暂停/自启,无开机、无删除', () => {
    const t = labels(mk(VM('running')))
    expect(t.some((x) => x.includes('强制关机'))).toBe(true)
    expect(t.some((x) => x.includes('强制重启'))).toBe(true)
    expect(t.some((x) => x.includes('暂停'))).toBe(true)
    expect(t.some((x) => x.includes('开机自启'))).toBe(true)
    expect(t.some((x) => x === '开机')).toBe(false)
    expect(t.some((x) => x.includes('删除'))).toBe(false)
  })
  it('stopped:开机/自启/删除,且删除上方有分隔线', () => {
    const w = mk(VM('stopped'))
    const t = labels(w)
    expect(t.some((x) => x.includes('开机'))).toBe(true)
    expect(t.some((x) => x.includes('删除'))).toBe(true)
    expect(w.find('.dropdown-divider').exists()).toBe(true)
  })
  it('paused:重启/继续,无暂停', () => {
    const t = labels(mk(VM('paused')))
    expect(t.some((x) => x.includes('继续'))).toBe(true)
    expect(t.some((x) => x.includes('强制重启'))).toBe(true)
    expect(t.some((x) => x === '暂停')).toBe(false)
  })
  it('suspended:只有唤醒(+自启)', () => {
    const t = labels(mk(VM('suspended')))
    expect(t.some((x) => x.includes('唤醒'))).toBe(true)
    expect(t.some((x) => x.includes('开机'))).toBe(false)
  })
  it('missing:只能删除,且不画分隔线', () => {
    const w = mk(VM('missing'))
    expect(labels(w).some((x) => x.includes('删除'))).toBe(true)
    expect(w.find('.dropdown-divider').exists()).toBe(false)
  })
  it('autostart 开关的指示点按 vm.autostart 亮灭', () => {
    expect(mk(VM('running', { autostart: true })).get('.toggle-indicator').classes()).toContain('on')
    expect(mk(VM('running')).get('.toggle-indicator').classes()).not.toContain('on')
  })
  it('processing 时自启项禁用(Vue2 :127 的 :disabled="_processing")', () => {
    const item = mk(VM('running'), true).findAll('.dropdown-item').find((b) => b.text().includes('开机自启'))!
    expect(item.attributes('disabled')).toBeDefined()
  })
})

describe('就地二次确认', () => {
  const clickByText = async (w: ReturnType<typeof mk>, txt: string) => {
    const b = w.findAll('.dropdown-item').find((x) => x.text().includes(txt))!
    await b.trigger('click')
    return b
  }

  it('关机第一次点只变文字,不 emit', async () => {
    const w = mk(VM('running'))
    await clickByText(w, '强制关机')
    expect(w.emitted('action')).toBeUndefined()
    expect(w.text()).toContain('确定吗?')
    expect(w.find('.confirm-text-danger').exists()).toBe(true)
  })

  it('第二次点才 emit action("stop")', async () => {
    const w = mk(VM('running'))
    await clickByText(w, '强制关机')
    await clickByText(w, '确定吗?')
    expect(w.emitted('action')![0]).toEqual(['stop'])
  })

  it('重启与删除同样是两次点', async () => {
    const w1 = mk(VM('running'))
    await clickByText(w1, '强制重启'); expect(w1.emitted('action')).toBeUndefined()
    await clickByText(w1, '确定吗?'); expect(w1.emitted('action')![0]).toEqual(['restart'])

    const w2 = mk(VM('stopped'))
    await clickByText(w2, '删除'); expect(w2.emitted('action')).toBeUndefined()
    await clickByText(w2, '确定吗?'); expect(w2.emitted('action')![0]).toEqual(['delete'])
  })

  it('开机/暂停/继续/唤醒/自启是一次点,不需要确认', async () => {
    const a = mk(VM('stopped')); await clickByText(a, '开机')
    expect(a.emitted('action')![0]).toEqual(['start'])
    const b = mk(VM('running')); await clickByText(b, '暂停')
    expect(b.emitted('action')![0]).toEqual(['pause'])
    const c = mk(VM('paused')); await clickByText(c, '继续')
    expect(c.emitted('action')![0]).toEqual(['resume'])
    const d = mk(VM('suspended')); await clickByText(d, '唤醒')
    expect(d.emitted('action')![0]).toEqual(['wakeup'])
    const e = mk(VM('running')); await clickByText(e, '开机自启')
    expect(e.emitted('action')![0]).toEqual(['autostart'])
  })

  it('确认态挂在 stop 上时,点 restart 会把确认态转移过去而不是误触发 stop', async () => {
    const w = mk(VM('running'))
    await clickByText(w, '强制关机')          // stop 进入待确认
    const restart = w.findAll('.dropdown-item').find((x) => x.text().includes('强制重启'))!
    await restart.trigger('click')            // 点了另一项
    expect(w.emitted('action')).toBeUndefined()
    expect(restart.text()).toContain('确定吗?')
  })

  it('父组件调 reset 后确认态清空', async () => {
    const w = mk(VM('running'))
    await clickByText(w, '强制关机')
    ;(w.vm as unknown as { reset: () => void }).reset()
    await w.vm.$nextTick()
    expect(w.text()).not.toContain('确定吗?')
  })
})
```

- [ ] **Step 2: 实现 `OverflowMenu.vue`,跑绿**

`defineExpose({ reset })` 供父组件在关菜单 / 切 VM 时清确认态。样式照 Vue2 `:2130-2199`:`.overflow-dropdown` 绝对定位 `top:100%; right:0; margin-top:.25rem`、底 `var(--kvm-panel)`、`1px solid var(--kvm-border)`、`border-radius:.5rem`、`box-shadow: 0 8px 24px var(--kvm-shadow)`、`z-index:50`、`min-width:10rem`、`padding:.375rem`;`.dropdown-item` `padding:.5rem .75rem`、`font-size:.85rem`、`border-radius:.375rem`、hover `var(--kvm-elev)`;`.is-danger` 文字 `var(--kvm-danger)`、hover `var(--kvm-danger-soft)`;`.confirm-text-danger` 文字 `var(--kvm-danger)`;`.toggle-indicator` `1rem` 圆、灭 `var(--kvm-toggle-off)`、亮 `var(--kvm-ok)`;`.dropdown-divider` `1px` 高、`var(--kvm-border)`、`margin:.25rem 0`。

- [ ] **Step 3: 写 `ConsoleHeader.test.ts` 并实现**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConsoleHeader from './ConsoleHeader.vue'
import { i18n } from '../../i18n'
import type { KvmVM } from '@nimotech/nimoos-service'

const VM = (state = 'running') => ({ id: 'vm-1', name: 'sp9-alpine-test', state, os: 'linux', autostart: false } as KvmVM)
const mk = (vm = VM()) => mount(ConsoleHeader, { props: { vm, processing: false }, global: { plugins: [i18n] } })

describe('ConsoleHeader', () => {
  it('显示 VM 名与 OS 图标', () => {
    expect(mk().text()).toContain('sp9-alpine-test')
    expect(mk().find('img.console-os-icon').exists()).toBe(true)
  })
  it('状态点带 state 类', () => {
    expect(mk().get('.console-status .status-dot').classes()).toContain('running')
  })
  it('Settings 按钮渲染但禁用(P6),带 title', () => {
    const b = mk().findAll('.action-btn')[0]
    expect(b.attributes('disabled')).toBeDefined()
    expect(b.attributes('title')).toContain('即将支持')
    expect(b.attributes('aria-label')).toBeTruthy()
  })
  it('⋮ 按钮点击展开菜单,再点收起', async () => {
    const w = mk()
    expect(w.find('.overflow-dropdown').exists()).toBe(false)
    await w.findAll('.action-btn')[1].trigger('click')
    expect(w.find('.overflow-dropdown').exists()).toBe(true)
    await w.findAll('.action-btn')[1].trigger('click')
    expect(w.find('.overflow-dropdown').exists()).toBe(false)
  })
  it('菜单里的 action 透传给父组件,并顺手关菜单', async () => {
    const w = mk(VM('stopped'))
    await w.findAll('.action-btn')[1].trigger('click')
    const item = w.findAll('.dropdown-item').find((b) => b.text().includes('开机'))!
    await item.trigger('click')
    expect(w.emitted('action')![0]).toEqual(['start'])
    expect(w.find('.overflow-dropdown').exists()).toBe(false)
  })
  it('点菜单外面关闭菜单(document click 监听)', async () => {
    const w = mount(ConsoleHeader, { props: { vm: VM(), processing: false },
      global: { plugins: [i18n] }, attachTo: document.body })
    await w.findAll('.action-btn')[1].trigger('click')
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('.overflow-dropdown').exists()).toBe(false)
    w.unmount()
  })
  it('切换 VM 时菜单与确认态一起清空', async () => {
    const w = mk(VM('running'))
    await w.findAll('.action-btn')[1].trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('强制关机'))!.trigger('click')
    await w.setProps({ vm: { ...VM('running'), id: 'vm-2' } as KvmVM })
    expect(w.find('.overflow-dropdown').exists()).toBe(false)
  })
  it('卸载时摘掉 document 监听(不泄漏)', () => {
    const w = mount(ConsoleHeader, { props: { vm: VM(), processing: false },
      global: { plugins: [i18n] }, attachTo: document.body })
    const before = (document as unknown as { __c?: number }).__c
    w.unmount()
    expect(before).toBe((document as unknown as { __c?: number }).__c)  // 占位:实现里用 onUnmounted 摘
  })
})
```

> 最后一条测不好写成硬断言 —— 实现者改成:用 `vi.spyOn(document, 'removeEventListener')` 断言 unmount 时被调用过一次、且事件名是 `'click'`。

样式照 Vue2 `:2020-2129`:`.console-header` `padding:1rem`、透明底;`.console-os-icon` `2rem`;`h3` `1rem/600`;`.console-status .status-text` 默认 `opacity:0`,`:hover` 才 `1`(Vue2 特有,照抄);`.action-btn` `2rem` 方、`border-radius:.375rem`、底 `var(--kvm-elev)`、hover `var(--kvm-accent-soft)` + 字 `var(--kvm-accent)`、`:disabled { opacity:.35; cursor:not-allowed }` 且 disabled 下 hover 不变色。

- [ ] **Step 4: `ProgressOverlay.vue` + 接进 `KvmPage.vue`**

Vue2 用 `b-modal` + `b-message` 显示「正在停止 / 正在重启 / 正在删除…」不可取消遮罩(`:495-505`)。New-UI 没有 buefy,自绘:全屏 `position:fixed` 半透明遮罩 + 居中卡片(标题 + 一行消息 + 旋转 spinner)。`can-cancel=false` → 遮罩点击不关闭。

`KvmPage.vue` 里:`stop` / `restart` / `delete` 三个动作确认通过后先设 `progress = { titleKey, name }`,`await` 动作,`finally` 清空。其余动作不显示遮罩(照 Vue2)。

- [ ] **Step 5: 电源动作接线 + 全量 + 提交**

`KvmPage.vue` 的 `onAction(name)` 分派到 `useVmList` 的对应方法。`lastError` 非空时显示在控制台占位区内联(**不用 toast**,硬约束 9)。

Run: `pnpm test && pnpm vue-tsc --noEmit`

```bash
git add src/kvm/components/OverflowMenu.vue src/kvm/components/OverflowMenu.test.ts src/kvm/components/ConsoleHeader.vue src/kvm/components/ConsoleHeader.test.ts src/kvm/components/ProgressOverlay.vue src/kvm/views/KvmPage.vue src/kvm/views/KvmPage.test.ts src/kvm/styles/kvm.css
git commit -m "feat(kvm): 控制台头 + 溢出菜单(就地二次确认)+ 电源动作 + 进度遮罩"
```

---

## Task 6: `useVncConsole` + ConsoleStage

**Files:**
- Create: `src/kvm/composables/useVncConsole.ts` + `useVncConsole.test.ts`
- Create: `src/kvm/components/ConsoleStage.vue` + `ConsoleStage.test.ts`
- Modify: `src/kvm/views/KvmPage.vue` · `src/kvm/styles/kvm.css`

**Interfaces:**
- Consumes: `service.kvm.getVNC`(T0)· T3 的 `onVncShouldConnect/Disconnect`
- Produces:
```ts
useVncConsole(hostEl: Ref<HTMLElement | null>): {
  connected: Ref<boolean>
  errorKey: Ref<string>          // '' | 'kvmVncPortUnavailable' | 'kvmVncFetchFailed'
  modifiers: Ref<{ ctrl: boolean; alt: boolean; shift: boolean; win: boolean }>
  connect(vm: KvmVM): Promise<void>
  disconnect(): void
  toggleModifier(name: 'ctrl'|'alt'|'shift'|'win'): void
  sendKey(keysym: number): void
  sendCtrlAltDel(): void
  dispose(): void
}
```
- `ConsoleStage` props `{ vm: KvmVM, connected: boolean, errorKey: string, processing: boolean }`,emit `start` / `resume`,expose `hostEl`

**RFB 生命周期契约**(照 Vue2 `:940-1013`,加代际守卫):
1. `connect(vm)`:`vm.state !== 'running'` → 直接 `disconnect()` 返回
2. 自增 `gen`,记 `myGen`
3. `await service.kvm.getVNC(vm.id)` —— **失败** → `disconnect()` + `errorKey = 'kvmVncFetchFailed'`
4. **返回后先比对 `myGen !== gen` → 丢弃**(Vue2 缺这道,快速切换 VM 会把旧 VM 的画面接到新 VM 的容器上 —— **登记为逻辑修正**)
5. 把 `spicePort`/`spiceTlsPort` 回写给调用方(通过回调,别在 composable 里直接改 `vms`)
6. `wsPort || vncPort` 都没有 → `disconnect()` + `errorKey = 'kvmVncPortUnavailable'`
7. `wsUrl = \`ws://${window.location.hostname}:${wsPort ?? vncPort}\`` —— **浏览器直连宿主机端口,不走网关、无鉴权**;本机 ws 口是 5700
8. 销毁旧 RFB、清掉容器里残留的 `<canvas>`,再 `new RFB(host, wsUrl, { scaleViewport: true, resizeSession: false })`
9. 监听 `connect` → `connected = true`;`disconnect` → `connected = false`
10. `disconnect()`:先 `releaseModifiers()`(否则修饰键卡在按下态)→ `rfb.disconnect()` → 置 null → 清 canvas → `connected=false; errorKey=''`

- [ ] **Step 1: 写 `useVncConsole.test.ts`(失败)**

用一个假的 RFB 类替代 `@novnc/novnc`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { KvmVM } from '@nimotech/nimoos-service'

const instances: FakeRFB[] = []
class FakeRFB {
  handlers: Record<string, (() => void)[]> = {}
  disconnected = false
  sent: [number, boolean | null][] = []
  cad = 0
  constructor(public el: unknown, public url: string, public opts: unknown) { instances.push(this) }
  addEventListener(ev: string, cb: () => void) { (this.handlers[ev] ||= []).push(cb) }
  fire(ev: string) { (this.handlers[ev] || []).forEach((h) => h()) }
  disconnect() { this.disconnected = true }
  sendKey(k: number, _c: unknown, down: boolean | null = null) { this.sent.push([k, down]) }
  sendCtrlAltDel() { this.cad++ }
}
vi.mock('@novnc/novnc', () => ({ default: FakeRFB }))

const getVNC = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({ service: { get kvm() { return { getVNC } } } }))

import { useVncConsole } from './useVncConsole'

const VM = (over: Partial<KvmVM> = {}) => ({ id: 'vm-1', state: 'running', ...over } as KvmVM)
const host = () => ref(document.createElement('div'))

beforeEach(() => {
  instances.length = 0
  getVNC.mockReset()
  getVNC.mockResolvedValue({ vncPort: 5900, vncWebsocketPort: 5700, spicePort: 5901, spiceTlsPort: 0 })
})

describe('connect', () => {
  it('用 vncWebsocketPort 拼 ws url,直连 location.hostname', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    expect(instances[0].url).toBe(`ws://${window.location.hostname}:5700`)
    expect(instances[0].opts).toEqual({ scaleViewport: true, resizeSession: false })
  })

  it('没有 websocket 口时回退 vncPort', async () => {
    getVNC.mockResolvedValue({ vncPort: 5900, vncWebsocketPort: 0, spicePort: 0, spiceTlsPort: 0 })
    const c = useVncConsole(host())
    await c.connect(VM())
    expect(instances[0].url).toBe(`ws://${window.location.hostname}:5900`)
  })

  it('两个端口都没有 → 报端口不可用,不建连接', async () => {
    getVNC.mockResolvedValue({ vncPort: 0, vncWebsocketPort: 0, spicePort: 0, spiceTlsPort: 0 })
    const c = useVncConsole(host())
    await c.connect(VM())
    expect(instances).toHaveLength(0)
    expect(c.errorKey.value).toBe('kvmVncPortUnavailable')
  })

  it('getVNC 失败 → 报获取失败', async () => {
    getVNC.mockRejectedValue(new Error('404'))
    const c = useVncConsole(host())
    await c.connect(VM())
    expect(c.errorKey.value).toBe('kvmVncFetchFailed')
    expect(c.connected.value).toBe(false)
  })

  it('VM 不是 running 时直接不连', async () => {
    const c = useVncConsole(host())
    await c.connect(VM({ state: 'stopped' }))
    expect(getVNC).not.toHaveBeenCalled()
    expect(instances).toHaveLength(0)
  })

  it('RFB 触发 connect/disconnect 事件时同步 connected', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    instances[0].fire('connect'); expect(c.connected.value).toBe(true)
    instances[0].fire('disconnect'); expect(c.connected.value).toBe(false)
  })

  it('重复 connect 会先销毁上一个 RFB', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    await c.connect(VM())
    expect(instances[0].disconnected).toBe(true)
    expect(instances).toHaveLength(2)
  })

  it('连接前把容器里残留的 canvas 清掉', async () => {
    const h = host()
    h.value!.appendChild(document.createElement('canvas'))
    const c = useVncConsole(h)
    await c.connect(VM())
    expect(h.value!.querySelectorAll('canvas')).toHaveLength(0)
  })

  it('把 spice 端口通过回调交出去(composable 不直接改列表)', async () => {
    const c = useVncConsole(host())
    const onSpice = vi.fn()
    c.onSpicePorts(onSpice)
    await c.connect(VM())
    expect(onSpice).toHaveBeenCalledWith('vm-1', { spicePort: 5901, spiceTlsPort: 0 })
  })
})

describe('代际守卫(修 Vue2 缺失:快速切换 VM 会把旧机器的画面接到新容器上)', () => {
  it('前一次 getVNC 迟到返回时不得建立连接', async () => {
    let slowResolve: (v: unknown) => void = () => {}
    getVNC
      .mockImplementationOnce(() => new Promise((r) => { slowResolve = r }))
      .mockResolvedValueOnce({ vncPort: 0, vncWebsocketPort: 5701, spicePort: 0, spiceTlsPort: 0 })
    const c = useVncConsole(host())
    const slow = c.connect(VM({ id: 'a' }))
    await c.connect(VM({ id: 'b' }))
    slowResolve({ vncPort: 0, vncWebsocketPort: 5700, spicePort: 0, spiceTlsPort: 0 })
    await slow
    expect(instances).toHaveLength(1)
    expect(instances[0].url).toContain('5701')     // 只有后发那次生效
  })

  it('dispose 之后迟到的 getVNC 不建连接', async () => {
    let r: (v: unknown) => void = () => {}
    getVNC.mockImplementationOnce(() => new Promise((x) => { r = x }))
    const c = useVncConsole(host())
    const p = c.connect(VM())
    c.dispose()
    r({ vncPort: 0, vncWebsocketPort: 5700, spicePort: 0, spiceTlsPort: 0 })
    await p
    expect(instances).toHaveLength(0)
  })
})

describe('修饰键与按键', () => {
  it('toggleModifier 按下再抬起,状态跟着翻转', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    c.toggleModifier('ctrl')
    expect(c.modifiers.value.ctrl).toBe(true)
    expect(instances[0].sent.at(-1)).toEqual([0xffe3, true])
    c.toggleModifier('ctrl')
    expect(c.modifiers.value.ctrl).toBe(false)
    expect(instances[0].sent.at(-1)).toEqual([0xffe3, false])
  })

  it('四个修饰键的 keysym 正确(Vue2 :1015-1035)', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    c.toggleModifier('alt'); expect(instances[0].sent.at(-1)![0]).toBe(0xffe9)
    c.toggleModifier('shift'); expect(instances[0].sent.at(-1)![0]).toBe(0xffe1)
    c.toggleModifier('win'); expect(instances[0].sent.at(-1)![0]).toBe(0xffeb)
  })

  it('disconnect 时把按下的修饰键全部释放(否则卡在按下态)', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    c.toggleModifier('ctrl'); c.toggleModifier('alt')
    const rfb = instances[0]
    c.disconnect()
    expect(rfb.sent.filter(([, d]) => d === false).map(([k]) => k).sort()).toEqual([0xffe3, 0xffe9].sort())
    expect(c.modifiers.value.ctrl).toBe(false)
    expect(c.modifiers.value.alt).toBe(false)
  })

  it('sendKey 直接透传', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    c.sendKey(0xff09)
    expect(instances[0].sent.at(-1)).toEqual([0xff09, null])
  })

  it('sendCtrlAltDel 调 RFB 的专用方法并清空所有修饰键状态', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    c.toggleModifier('ctrl')
    c.sendCtrlAltDel()
    expect(instances[0].cad).toBe(1)
    expect(c.modifiers.value.ctrl).toBe(false)
  })

  it('没有连接时按键调用是空操作,不抛', () => {
    const c = useVncConsole(host())
    expect(() => { c.sendKey(0xff09); c.sendCtrlAltDel(); c.toggleModifier('ctrl') }).not.toThrow()
  })

  it('RFB.sendKey 抛异常时被吞掉、不冒泡(照 Vue2 的 try/catch)', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    instances[0].sendKey = () => { throw new Error('socket closed') }
    expect(() => c.sendKey(0xff1b)).not.toThrow()
  })
})
```

- [ ] **Step 2: 实现 `useVncConsole.ts`,跑绿**

代际守卫处必须写注释登记与 Vue2 的偏离:
```ts
// ⚠️ 与 Vue2 的偏离(SP9-P5 登记):Vue2 connectVNC(:952)拿到 /vnc 响应后直接建连,
// 没有代际判定。快速切换 VM 时,先发的那次响应可能晚于后发的一次到达,于是把 A 机器的
// 画面接到了已经切到 B 的容器上(且 B 的 RFB 被 A 覆盖)。这里加 gen 守卫,过期即丢弃。
```

- [ ] **Step 3: `ConsoleStage.test.ts` + 实现**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConsoleStage from './ConsoleStage.vue'
import { i18n } from '../../i18n'
import type { KvmVM } from '@nimotech/nimoos-service'

const VM = (state: string) => ({ id: 'v', name: 'x', state } as KvmVM)
const mk = (p: Record<string, unknown> = {}) =>
  mount(ConsoleStage, { props: { vm: VM('running'), connected: false, errorKey: '', processing: false, ...p },
    global: { plugins: [i18n] } })

describe('ConsoleStage 占位层', () => {
  it('未连接时显示占位层,连上后隐藏', () => {
    expect(mk().find('.console-placeholder').exists()).toBe(true)
    expect(mk({ connected: true }).find('.console-placeholder').exists()).toBe(false)
  })
  it('stopped 时显示开机大按钮,点了 emit start', async () => {
    const w = mk({ vm: VM('stopped') })
    const b = w.get('.start-vm-btn')
    await b.trigger('click')
    expect(w.emitted('start')).toHaveLength(1)
  })
  it('paused 时显示继续大按钮,点了 emit resume', async () => {
    const w = mk({ vm: VM('paused') })
    await w.get('.start-vm-btn').trigger('click')
    expect(w.emitted('resume')).toHaveLength(1)
  })
  it('running 但没连上时不显示大按钮(照 Vue2 :168-190 的 v-if 条件)', () => {
    expect(mk().find('.start-vm-btn').exists()).toBe(false)
  })
  it('processing 时大按钮禁用', () => {
    expect(mk({ vm: VM('stopped'), processing: true }).get('.start-vm-btn').attributes('disabled')).toBeDefined()
  })
  it('有错误时显示红色错误文案,且不显示大按钮(Vue2 的 v-if/else)', () => {
    const w = mk({ vm: VM('stopped'), errorKey: 'kvmVncFetchFailed' })
    expect(w.get('.console-hint').classes()).toContain('is-error')
    expect(w.text()).toContain('获取 VNC 信息失败')
    expect(w.find('.start-vm-btn').exists()).toBe(false)
  })
  it('暴露 hostEl 供 composable 挂 RFB', () => {
    const w = mk()
    expect((w.vm as unknown as { hostEl: HTMLElement }).hostEl).toBeTruthy()
  })
  it('大按钮有 aria-label', () => {
    expect(mk({ vm: VM('stopped') }).get('.start-vm-btn').attributes('aria-label')).toBeTruthy()
  })
})
```

样式照 Vue2 `:2204-2288`:`.console-display` `flex:1; height:0; min-height:300px; border-radius:.75rem; overflow:hidden; position:relative`,`:fullscreen` 时圆角归零;内部 `canvas` 绝对定位铺满 + `object-fit:contain` + `z-index:2`;`.console-placeholder` 绝对铺满 `z-index:1`;`.start-vm-btn` 128px 方、透明底、`:disabled{opacity:.5}`。

- [ ] **Step 4: 接进 `KvmPage.vue`**

把 `useVmList` 的 `onVncShouldConnect/Disconnect` 接到 `useVncConsole` 的 `connect/disconnect`;`ConsoleStage` 的 `hostEl` 传给 `useVncConsole`。切换 VM 时(`selectVM`)照 Vue2 watch 逻辑:新 VM 是 running 就连、否则断。

- [ ] **Step 5: 全量 + 真机验收控制台出画面 + 提交**

Run: `pnpm test && pnpm vue-tsc --noEmit`;`pnpm dev --host` → `#/kvm` → 点 `sp9-alpine-test` → **控制台应出现 Alpine 画面**。若黑屏,先确认 `ws://<ip>:5700` 从浏览器可达(防火墙)。

```bash
git add src/kvm/composables/useVncConsole.ts src/kvm/composables/useVncConsole.test.ts src/kvm/components/ConsoleStage.vue src/kvm/components/ConsoleStage.test.ts src/kvm/views/KvmPage.vue src/kvm/views/KvmPage.test.ts src/kvm/styles/kvm.css
git commit -m "feat(kvm): noVNC 控制台(RFB 生命周期/代际守卫/修饰键/占位与错误态)"
```

---

## Task 7: SendKeyToolbar + 全屏

**Files:**
- Create: `src/kvm/components/SendKeyToolbar.vue` + `SendKeyToolbar.test.ts`
- Modify: `src/kvm/views/KvmPage.vue` · `src/kvm/styles/kvm.css`

**Interfaces:**
- Consumes: `useVncConsole` 的 `modifiers` / `toggleModifier` / `sendKey` / `sendCtrlAltDel`
- Produces: `SendKeyToolbar` props `{ modifiers, isFullscreen }`,emit `toggle(name)` / `key(keysym)` / `ctrlAltDel` / `fullscreen`

**悬浮显隐规则**(照 Vue2 `:153`、`:1136-1151`):
- 鼠标进入 `.console-display` → 显示
- 鼠标离开 → 隐藏,**除非鼠标此刻在工具条上**(`sendKeyToolbarHover`)
- 鼠标在容器内移动:`mouseX >= width - 80` → 显示;否则(且不在工具条上)→ 隐藏
- 只在 `vm.state === 'running'` 时生效
- 进入全屏时强制显示一次

**键位表**(照 Vue2):Ctrl `0xffe3` · Alt `0xffe9` · Shift `0xffe1` · Win `0xffeb` · Tab `0xff09` · Esc `0xff1b`

- [ ] **Step 1: 写 `SendKeyToolbar.test.ts`(失败)**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SendKeyToolbar from './SendKeyToolbar.vue'
import { i18n } from '../../i18n'

const MODS = { ctrl: false, alt: false, shift: false, win: false }
const mk = (p: Record<string, unknown> = {}) =>
  mount(SendKeyToolbar, { props: { modifiers: MODS, isFullscreen: false, ...p }, global: { plugins: [i18n] } })

describe('SendKeyToolbar', () => {
  it('渲染 8 个按钮:四修饰键 + Tab + Esc + Ctrl+Alt+Del + 全屏', () => {
    expect(mk().findAll('.sendkey-btn')).toHaveLength(8)
  })
  it('点 Ctrl emit toggle("ctrl")', async () => {
    const w = mk()
    await w.findAll('.sendkey-btn')[0].trigger('click')
    expect(w.emitted('toggle')![0]).toEqual(['ctrl'])
  })
  it('修饰键按下时该按钮加 active 类', () => {
    expect(mk({ modifiers: { ...MODS, alt: true } }).findAll('.sendkey-btn')[1].classes()).toContain('active')
  })
  it('Tab / Esc emit key 带正确 keysym', async () => {
    const w = mk()
    const btns = w.findAll('.sendkey-btn')
    await btns[4].trigger('click'); expect(w.emitted('key')![0]).toEqual([0xff09])
    await btns[5].trigger('click'); expect(w.emitted('key')![1]).toEqual([0xff1b])
  })
  it('Ctrl+Alt+Del emit ctrlAltDel', async () => {
    const w = mk()
    await w.findAll('.sendkey-btn')[6].trigger('click')
    expect(w.emitted('ctrlAltDel')).toHaveLength(1)
  })
  it('全屏按钮 emit fullscreen,图标按 isFullscreen 切换', async () => {
    const w = mk()
    await w.findAll('.sendkey-btn')[7].trigger('click')
    expect(w.emitted('fullscreen')).toHaveLength(1)
    expect(mk({ isFullscreen: true }).get('.sendkey-btn--fullscreen img').attributes('alt'))
      .not.toBe(mk({ isFullscreen: false }).get('.sendkey-btn--fullscreen img').attributes('alt'))
  })
  it('每个按钮都有 title(悬浮提示),Win 与图标按钮另有 aria-label', () => {
    const w = mk()
    w.findAll('.sendkey-btn').forEach((b) => expect(b.attributes('title')).toBeTruthy())
    expect(w.findAll('.sendkey-btn')[3].attributes('aria-label')).toBeTruthy()
    expect(w.get('.sendkey-btn--fullscreen').attributes('aria-label')).toBeTruthy()
  })
})
```

- [ ] **Step 2: 实现组件,跑绿**

样式照 Vue2 `:2337-2416`:`.sendkey-toolbar` 绝对定位右侧垂直居中、竖排、`gap:.25rem`、`padding:.5rem`、底 `var(--kvm-overlay)`、`1px solid var(--kvm-border)`、`border-radius:.5rem 0 0 .5rem`、`backdrop-filter: blur(8px)`、`z-index:40`;`.sendkey-btn` `2.75rem` 方、`border-radius:.375rem`、底 `var(--kvm-elev)`、`font-size:.7rem`,hover `var(--kvm-accent-soft)`,`.active` 底 `var(--kvm-accent)` + 字 `var(--kvm-on-accent)`;`.sendkey-hint` 绝对定位在按钮左侧、默认 `opacity:0`、hover 显示;进出场过渡 `sendkey-slide-*`(`translateX(100%) translateY(-50%)` → 0,进 .2s 出 .15s)。**Vue 3 的过渡类名是 `-enter-from` 不是 Vue2 的 `-enter`**,已在白名单里按 Vue 3 命名列。

- [ ] **Step 3: 显隐 + 全屏接进 `KvmPage.vue`**

在 `KvmPage.vue` 里加:
- `sendKeyVisible` / `toolbarHover` 两个 ref
- `.console-display` 上绑 `@mouseenter` / `@mouseleave` / `@mousemove`,逻辑照上面「悬浮显隐规则」逐条实现
- `toggleFullscreen()`:`hostEl.requestFullscreen()` 成功后 `isFullscreen = true; sendKeyVisible = true`;已在全屏则 `document.exitFullscreen()`;两者都 `.catch(() => {})`
- `document` 上监听 `fullscreenchange` → `isFullscreen = !!document.fullscreenElement`,且进入全屏且 VM running 时强制 `sendKeyVisible = true`;`onUnmounted` 摘监听

给 `KvmPage.test.ts` 补 4 条:
```ts
it('鼠标进入控制台区显示工具条,离开隐藏', ...)
it('鼠标停在工具条上时,离开控制台区不隐藏', ...)
it('mousemove 到右侧 80px 内显示,移回左侧隐藏', ...)
it('VM 不是 running 时,鼠标怎么动都不显示工具条', ...)
```

- [ ] **Step 4: 全量 + 真机验收 + 提交**

真机:鼠标移到控制台右侧 → 工具条滑出;点 Ctrl 变紫、再点复原;点 Ctrl+Alt+Del;点全屏进出。

```bash
git add src/kvm/components/SendKeyToolbar.vue src/kvm/components/SendKeyToolbar.test.ts src/kvm/views/KvmPage.vue src/kvm/views/KvmPage.test.ts src/kvm/styles/kvm.css
git commit -m "feat(kvm): SendKey 悬浮工具条(修饰键/Tab/Esc/Ctrl+Alt+Del/全屏)"
```

---

## Task 8: 安装横幅 + SPICE 提示条 + 收尾

**Files:**
- Create: `src/kvm/components/InstallBanner.vue` + `InstallBanner.test.ts`
- Create: `src/kvm/components/SpiceInfoBar.vue` + `SpiceInfoBar.test.ts`
- Modify: `src/kvm/views/KvmPage.vue` · `src/kvm/styles/kvm.css`

**Interfaces:**
- `InstallBanner` props `{ busy: boolean }`,emit `finish`
- `SpiceInfoBar` props `{ hostname: string, spicePort: number, isWindowsGuest: boolean }`,emit `close`

**显示条件**(照 Vue2,逐字):
- 安装横幅:`vm.state === 'running' && !vm.bootFromDisk && vm.iso`
- SPICE 条:`vm.spicePort > 0 && vm.bootFromDisk && !dismissed`
- SPICE 条 **180 秒后自动收起**(Vue2 `:748-752` 的 `spiceTimer`);切换 VM 时 `dismissed` 复位、计时器重置

- [ ] **Step 1: 写两个组件的测试(失败)**

```ts
// InstallBanner.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import InstallBanner from './InstallBanner.vue'
import { i18n } from '../../i18n'

const mk = (busy = false) => mount(InstallBanner, { props: { busy }, global: { plugins: [i18n] } })

describe('InstallBanner', () => {
  it('显示提示文案与按钮', () => {
    const t = mk().text()
    expect(t).toContain('正在从 ISO 安装')
    expect(t).toContain('我已安装完成')
  })
  it('点按钮 emit finish', async () => {
    const w = mk(); await w.get('.banner-btn').trigger('click')
    expect(w.emitted('finish')).toHaveLength(1)
  })
  it('busy 时按钮加 is-loading 类且不可重复点', async () => {
    const w = mk(true)
    expect(w.get('.banner-btn').classes()).toContain('is-loading')
    await w.get('.banner-btn').trigger('click')
    expect(w.emitted('finish')).toBeUndefined()
  })
})
```

```ts
// SpiceInfoBar.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SpiceInfoBar from './SpiceInfoBar.vue'
import { i18n } from '../../i18n'

const mk = (p: Record<string, unknown> = {}) =>
  mount(SpiceInfoBar, { props: { hostname: '192.168.1.10', spicePort: 5901, isWindowsGuest: false, ...p },
    global: { plugins: [i18n] } })

describe('SpiceInfoBar', () => {
  it('拼出 spice:// 连接串', () => {
    expect(mk().get('code').text()).toBe('spice://192.168.1.10:5901')
  })
  it('Linux 客户机提示装 spice-vdagent', () => {
    expect(mk().text()).toContain('spice-vdagent')
  })
  it('Windows 客户机提示装 virtio-win', () => {
    expect(mk({ isWindowsGuest: true }).text()).toContain('virtio-win')
  })
  it('关闭按钮 emit close 且有 aria-label', async () => {
    const w = mk()
    expect(w.get('.spice-info-close').attributes('aria-label')).toBeTruthy()
    await w.get('.spice-info-close').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 实现两个组件**

`InstallBanner` 样式照 Vue2 `:3096-3147` —— **这是全页唯一的浅色块**(浅蓝底 `var(--kvm-banner-bg)`、`1px solid var(--kvm-banner-border)` 下边框、字 `var(--kvm-banner-fg)`、按钮 `var(--kvm-banner-btn)` + hover `var(--kvm-banner-btn-hover)`、`is-loading` 时字透明 + 白色转圈 `::after`)。`SpiceInfoBar` 照 `:2796-2865`(顶部居中悬浮、`var(--kvm-overlay)` 底 + `var(--kvm-warn-border)` 边、字 `var(--kvm-warn)`、`backdrop-filter: blur(8px)`、`max-width:36rem`、进出场 `spice-toast-*` 过渡)。

- [ ] **Step 3: 接进 `KvmPage.vue` + 180 秒计时器**

```ts
// SPICE 提示条 180 秒后自动收起(Vue2 :748-752)。切 VM 时复位并重新计时。
const spiceDismissed = ref(false)
let spiceTimer: ReturnType<typeof setTimeout> | undefined
watch(() => selectedVM.value?.id, () => {
  spiceDismissed.value = false
  clearTimeout(spiceTimer)
  if (selectedVM.value) spiceTimer = setTimeout(() => { spiceDismissed.value = true }, 180_000)
})
onUnmounted(() => clearTimeout(spiceTimer))
```

`isWindowsGuest` 派生照 Vue2 `:715-719`:`os` 含 `win`(大小写不敏感)即为真。

`ejectInstallMedia` 接到横幅的 `finish`,`busy` 用一个 ref 挡重复点。

给 `KvmPage.test.ts` 补:
```ts
it('running + 未从硬盘启动 + 有 iso → 显示安装横幅', ...)
it('已从硬盘启动 → 不显示安装横幅', ...)
it('spicePort>0 且 bootFromDisk → 显示 SPICE 条', ...)
it('180 秒后 SPICE 条自动消失(vi.useFakeTimers)', ...)
it('切换 VM 时 SPICE 条重新出现并重新计时', ...)
it('点安装横幅按钮调 setBootFromDisk(id,true)', ...)
```

- [ ] **Step 4: 整页收尾自查**

- [ ] `pnpm test` 全量,与基线(324 文件 / 2660 例)比对,**不新增红**
- [ ] `pnpm vue-tsc --noEmit` 零错
- [ ] `pnpm build` 通过
- [ ] `pnpm vitest run src/styles/color-guard.test.ts src/styles/theme.sp9.test.ts src/kvm/styles/kvmStyles.test.ts` 三个守卫全绿
- [ ] i18n parity 测试绿(zh/en 键集合一致)
- [ ] `grep -rn "console.log" src/kvm/` 零命中
- [ ] 窄屏(~420px)自查:侧栏变全宽抽屉、控制台不横向溢出
- [ ] **静态截图自查**(记忆 `headless-chrome-screenshot-check`):用缓存里的 chromium 对 `#/kvm` 截图,确认没有空方框字形、没有溢出

- [ ] **Step 5: 提交 + 写台账**

```bash
git add src/kvm/ src/styles/theme.sp9.css src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts src/router/index.ts
git commit -m "feat(kvm): 安装横幅 + SPICE 提示条 + P5 收尾(整页组装/窄屏/三门全绿)"
```

台账写到 `NimoOS-New-UI/.superpowers/sdd/sp9/06-p5.md`(**gitignore,不进 git**),内容:各任务坐标 commit、偏离登记(3 处)、暂缺登记(1 处)、验收清单、挂账项。

---

## 真机验收清单(交给用户,每屏写清点击路径)

**前置**:`cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm dev --host`,浏览器开 `http://<本机IP>:5273/app/#/kvm`。
⚠️ **不要用 `deploy.sh`** —— 那会覆盖 SP6 的 `/app/`(记忆 `sp7-acceptance-dev-server` 同理)。

| # | 点击路径 | 预期 |
|---|---|---|
| 1 | 打开 `#/kvm` | 深色页面;左栏 22rem 宽,标题「NIMO 虚拟机」,下方「1 / 1 运行中」,状态点绿色**呼吸** |
| 2 | 看左栏列表 | 一行 `sp9-alpine-test`,左侧 Linux 图标,规格「2 vCPU / 1.0 GB」,右侧绿点 + 「运行中」 |
| 3 | 点这一行 | 右侧出现控制台,头部显示名字与 OS 图标;**几秒内出现 Alpine 的登录画面**(黑屏见下方排障) |
| 4 | 鼠标移到控制台**右侧边缘 80px 内** | 竖排工具条从右侧滑出:Ctrl / Alt / Shift / ⊞ / Tab / Esc / ─ / Ctrl+Alt+Del / 全屏 |
| 5 | 点 `Ctrl` | 按钮变紫底白字(按住态);再点一次复原 |
| 6 | 点 `Ctrl+Alt+Del` | Alpine 控制台应有反应(通常触发重启序列);**若你不想重启这台机器就跳过此项** |
| 7 | 点全屏按钮 | 控制台铺满屏幕、圆角消失,工具条仍在;按 Esc 或再点一次退出 |
| 8 | 点控制台头右上 `⋮` | 菜单弹出。running 态应看到:强制关机 / 强制重启 / 暂停 / 开机自启。**不应有**「开机」和「删除」 |
| 9 | 点「暂停」 | 立即执行(无需确认)。VM 状态变「已暂停」、点变黄呼吸、控制台断开并出现**继续大按钮** |
| 10 | 点控制台中央的继续大按钮 | VM 回到「运行中」,控制台画面重新出现 |
| 11 | `⋮` → 点「强制关机」**一次** | 文字原地变红色「确定吗?」,**不发请求**、VM 不停 |
| 12 | 点页面别处 | 菜单收起;再打开菜单,文字应已复原成「强制关机」(确认态被清掉) |
| 13 | `⋮` → 「强制关机」点**两次** | 弹出「正在停止」遮罩;完成后 VM 变「已停止」、灰点、控制台出现**开机大按钮** |
| 14 | 点开机大按钮 | VM 回到「运行中」,控制台画面出现 |
| 15 | `⋮` → 「强制重启」点两次 | 弹出「正在重启」遮罩;VM 保持运行,控制台**先断开,几秒后自动重连**(这是修过 Vue2 竞态的地方,重点看它会不会卡在红字错误上) |
| 16 | `⋮` → 点「开机自启」 | 左侧小圆点由灰变绿;再点一次变回灰 |
| 17 | 停机后 `⋮` | 应出现「开机」和「删除」,且「删除」上方有一条分隔线 |
| 18 | 点「删除」**一次** | 文字变红「确定吗?」。**⛔ 到此为止,不要点第二次**(见下方挂账 D33) |
| 19 | 看左栏底部「添加虚拟机」按钮 与 头部齿轮 | 两者都**灰色不可点**,鼠标悬停显示「即将支持」 |
| 20 | 看控制台头的齿轮(Settings) | 同样灰色不可点,悬停提示「即将支持」 |
| 21 | 点左栏与控制台之间那个竖条按钮 | 侧栏收起、按钮翻转到最左;鼠标移到最左侧栏区域,侧栏**临时滑出**,移开又收回 |
| 22 | 把浏览器拖窄到 ~420px | 侧栏变成全宽抽屉;控制台不横向溢出 |

**控制台黑屏排障**:浏览器直连 `ws://<本机IP>:5700`,不走网关、无鉴权。若黑屏,先在浏览器控制台看有没有 WebSocket 连接失败;有的话是防火墙挡了 5700,不是前端问题。

### 本期没能验的(挂账,不算验收失败)

| 编号 | 内容 | 为什么验不了 | 覆盖方式 |
|---|---|---|---|
| D33 | 真删除 VM | 本机只有一台测试 VM,删了 P6 就没得验 | 单测覆盖二次确认闸门 + 变异验证(跳过确认必翻红);P6 能建一次性 VM 后补真删一次 |
| D34 | `wakeup`(唤醒) | 造不出 `suspended` 态(需要 libvirt managedsave / S3),按交付政策二不列验收项 | 单测覆盖派生与调用 |
| D35 | SPICE 提示条 | 只在 `bootFromDisk=true` 且 `spicePort>0` 时出现,本机 VM 是 `bootFromDisk=false`(还挂着安装 ISO) | 单测覆盖显示条件与 180s 自动收起 |
| D36 | 安装横幅的「我已安装完成」 | 点了会把 VM 的启动项永久改成硬盘,这台测试机还挂着 alpine ISO,改了 P6 验创建流程时要重来 | 单测覆盖 `setBootFromDisk(id, true)` 调用 |

---

## 债务与后续

- **D8 销号** —— spec §6.1 记的「KVM 改事件驱动」不是债务,Vue2 本来就是事件驱动,P5 照做了。
- **P6 待接**:VM 列表为空时自动弹创建弹窗(Vue2 `:906`)· Add VM / 齿轮 / Settings 三个入口解禁 · OSSelector · 快照 tab · 全局设置。
- **P8 待接**:桌面磁贴 / 旧 UI 入口翻 `/kvm` 路由 + 回退 flag(`strangler:disabled:/kvm`)。**P1 就翻路由却没留回退 flag 的教训见 SP6-P6,别重犯。**
- **后端票**:`GET /v1/kvm/vms` 不返回 `spicePort`,逼前端做保活合并(见 `spicePreserve.ts` 注释)。宜在列表接口里一并返回。

---

## 自查(写 plan 时已跑)

**spec 覆盖**:§6.1 逐项对照 —— VM 列表(T4)· 状态点/规格/运行计数/侧栏折叠(T2/T4)· 控制台头/动作区/溢出菜单(T5)· 六个电源动作 + 七个 `can*` 派生(T1/T3/T5)· 全屏(T7)· Send Key 工具条(T7)· 安装横幅(T8)· SPICE 提示条(T8)· noVNC RFB 参数与 wsUrl(T6)· spicePort 保活(T1/T3)· `kvm` 域 25 方法 + 信封层数写死(T0)。**全部有落点。**

**类型一致性**:`KvmVM` / `KvmVncInfo` / `KvmSettings` 在 T0 定义,T1/T3/T6 消费的字段名与之一致(`state` / `spicePort` / `spiceTlsPort` / `vncWebsocketPort` / `bootFromDisk` / `os`)。`preserveSpice` 在 T1 定义、T3 消费,签名一致。`stateLabelKey` 在 T1 定义、T4/T5 消费。`useVmList` / `useVncConsole` 的返回签名在各自任务的 Interfaces 块里写死,T5/T6/T7/T8 按此消费。
