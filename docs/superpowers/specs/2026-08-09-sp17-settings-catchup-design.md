# SP17 — 设置区 + 桌面零散补迁(设计)

> 2026-08-09。SP12「7-15 之后的 Vue2 增量补迁」在**设置区与桌面零散**这一半的对应期。
> 相册区是 SP15、Files 区是 SP12 的三条并行线、AI 区是 SP14 —— 本期与它们文件集零重叠。
>
> - 分支 `sp17-settings-catchup`,worktree `.claude/worktrees/sp17-settings-catchup`
> - 基线:New-UI `master@6f8f742`
> - Vue2 靶子:`NimoOS-UI` `origin/main@03245590`(蓝本是 `docs/vue3-migration-sp3`,即 2026-07-15 的 Vue2)

---

## 1. 差集重算(开工前实测,不照抄 roadmap 清单)

`git log --oneline docs/vue3-migration-sp3..origin/main` = **68 个提交**。按区域归属后,已被其他期认领的部分排除,**本期范围只剩三件真缺口 + 一批需要登记结论的「不适用」**。

| Vue2 提交 | 内容 | New-UI 现状(逐条实测) | 本期 |
|---|---|---|---|
| `#93` | LAN Devices 设置标签(局域网设备发现) | 全仓 `LanDevices` / `lan-discovery` **0 命中** | **做**(A) |
| `#103` | 设置 App 页 Photos Cache 第 4 行 + 迁移弹窗支持 | `appPaths.ts` 只产出 3 行,`photos_data` **0 命中** | **做**(B) |
| `#105` | 迁移弹窗死代码清理 | New-UI 同款死条目在 `migrateBrowse.ts:55` | **做**(B 顺带) |
| `#125` | KVM 磁贴按服务可用性门控 | `home/stores/apps.ts:34` 无条件注入 8 个系统应用并硬写 `status:'running'` | **做**(C) |
| `#97` | 终端页改造成 Security & Logs | New-UI 已无旧终端(只有 Logs);Security 分区缺席 = 既有债务 D7/D25 | **不做**(D) |
| `#119` `#121` | 清死域名 / Discord 换邀请链接 | 见 §6 逐条证据 —— 无对位物或早已处理 | **不做**(D) |
| `#128` | 默认应用图标换自有美术 | New-UI 走 CSS `.store-icon-fallback`,没有 `default.png` 可换 | **不做**(D) |

其余提交归属:Files 区(`#75` `#77` `#85` `#86` `#88`–`#91` `#94` `#96` `#122`)= SP12 worktree;相册区(`#79`–`#82` `#100` `#106`–`#117` `#137`–`#140`)= SP15 worktree;AI 区(`#74` `#76` `#99` `#136` `#141`)= SP14 已合入;Knowledge/Notes(`#78` `#80` `#83` `#84` `#87` `#92` `#101` `#102` `#104`)SP8 移植时已吸收主体(`src/ai/knowledge/` 下 `NotesView`/`QueueView`/`WikiView`/distill 全在);仓库级(LICENSE/CI/README/i18n 英化,`#118` `#123`–`#135`)与 New-UI 无关。

---

## 2. A —— LAN Devices 设置标签(#93)

### 2.1 后端(2026-08-09 实测,fixture 逐字抓取)

```
GET /v1/gateway/lan-discovery  →  200
{"devices":[{"ip":"192.168.1.49","hostname":"NimoOS","version":"dev","self":false},
            {"ip":"192.168.1.143","hostname":"NimoOS","version":"1.9.3-alpha1+28.g0dc16d6","self":true},
            {"ip":"192.168.1.189","hostname":"debian","version":"1.9.4-alpha1+430","self":false}, …6 条],
 "truncated":false}
```

**⚠️ 裸 JSON,不是 `{success,message,data}` 信封。** `packages/service/src/unwrap.ts` 见 `success!==200` 会**抛错**,所以这个方法**必须直接返 `res.data`**,不能套 `unwrap()`。本仓在裸信封上已经栽过三次,fixture 一律取自上面这次真实响应,不手编。

### 2.2 改动

- `packages/service/src/types.ts`:`LanDevice { ip: string; hostname: string; version: string; self: boolean }`、`LanDiscovery { devices: LanDevice[]; truncated: boolean }`。字段可选性以实测响应为准;`truncated` 缺席时按 `false`。
- `packages/service/src/sys.ts`:`getLanDiscovery(): Promise<LanDiscovery>`,注释写明"裸 JSON,不过 unwrap"及其原因。
- `src/settings/util/tabs.ts`:`SETTINGS_TABS` 在 `'system-status'` 之后插 `'lan-devices'`(位置照 Vue2 `SettingsPanel.vue` 的 `tabs` 数组);`TAB_LABEL_KEY` 补一项;**`RAIL_TABS = SETTINGS_TABS.slice(0, 7)` 的 7 必须同步改成 8** —— 漏改则新标签不进侧栏,且 `account`/`developer` 会被挤进 rail。
- `src/settings/panels/LanDevicesPanel.vue`(新)+ `panels/index.ts` 注册。
- `src/i18n/zh_cn.ts` / `en_us.ts`:10 个键(9 个来自 Vue2 + 1 个失败态,见 2.4)。**中文文案照 Vue2 `zh_CN.json` 取,不自译。**

### 2.3 界面(1:1 照 Vue2 `src/components/settings/LanDevices.vue`)

标题行「LAN Devices」+ 右侧刷新按钮(loading 态)· 灰色副标题 · 扫描中提示 · 设备行(主机名 → 缺省 "NimoOS Device";self 行带「This device」标签且不可点;右侧 IP、版本 → 缺省 "Unknown version")· `truncated` 警告行 · 空态。

样式用设置区既有 token 与类,不新造视觉语言;颜色一律 `var(--…)`(本仓硬约束)。

### 2.4 两处不照抄 Vue2、改成正确逻辑(注释登记,遵「界面照 Vue2、逻辑照正确」)

1. **失败态**。Vue2 的 `scan().catch()` 把 `devices` 清空 ⇒ 请求挂掉时界面显示「没有发现其他 NimoOS 设备,请确认它们已开机且在同一网络」——把接口失败讲成了网络里没设备。改:新增 `error` 状态,失败时显示一行内联错误文案(设置区既有错误样式),重扫按钮保留。新增 1 个 i18n 键。
2. **过期守卫**。Vue2 的 `scan()` 无代际计数器,连点刷新时先发的慢响应会覆盖后发的结果。改:就地加 epoch 守卫(同 `AppPathDialog.vue:93` 的 `browseGen` 写法,**不抽公共 helper** —— 过早抽象)。

**照抄不动的**:`open()` 的 IPv4 正则白名单(安全判据,防 hostname/路径注入)、`self` 自守卫、`window.open(..., 'noopener')`。

### 2.5 测试

`LanDevicesPanel.test.ts`:成功渲染(用 §2.1 真实 fixture)· self 行不可点且带标签 · 非 IPv4 的 `ip` 不开窗 · `truncated:true` 出警告 · 失败显示错误行而非空态 · 连发两次扫描时旧响应不覆盖新结果(走交错路径,不是只断言最终值)。
`packages/service/src/sys.test.ts`:补 `getLanDiscovery` 用例,**含变异验证** —— 若实现误套 `unwrap()`,该用例必须红。

---

## 3. B —— Photos Cache 迁移入口(#103)+ 死条目清理(#105)

### 3.1 后端(2026-08-09 实测)

```
GET /v1/sys/paths → {"success":200,"message":"ok","data":{
  "app_data":{"path":"/DATA/AppData","size":6037987},
  "database":{"path":"/DATA","size":3557039799},
  "images":{"path":"/DATA/.system_data/.docker & .containerd","size":58125438307},
  "photos_data":{"path":"/DATA/.system_data/photos","size":6281536962}}}
```

四个 key 都在。`src/settings/util/appPaths.ts` 顶部现有注释写着「后端返 4 个 key,而 Vue2 只渲染前 3 个 → 这里也只产出 3 行」——**本期这条注释作废,必须改写**,否则它会把下一个人引向错误结论。

### 3.2 改动

- `appPaths.ts`:`AppPathKey` 加 `'photos_data'`;`ORDER` 加第四项(顺序照 Vue2:app_data / images / database / photos_data);改写顶部注释。
- `AppsPanel.vue`:`ROW_LABEL_KEY` 加一项 + i18n 两侧各 1 键(Vue2 文案 "Photos Cache")。
- `src/settings/util/migrateBrowse.ts`:
  - `browseDestPaths` 加一条 `photos_data` 分支,落点为「所选目录 + `/.system_data/photos`」—— 与后端 dst 公式一致:

    ```ts
    if (type === 'photos_data') return [`${b}/.system_data/photos`]
    ```

  - **`filterBrowseFolders` 不加 `.system_data` 到 blocked**:第 59 行 `it.name.startsWith('.')` 已经把所有 dot 目录过滤掉了,再加是死条目。这正是 Vue2 `#105` 查实的结论,New-UI 侧**已核实同样成立**(`migrateBrowse.ts:59`)。同时按 `#105` 删掉现有第 55 行同样已死的 `.docker` / `.containerd` 条目,并补注释说明为什么不需要。
- `AppPathDialog.vue`:`type` 联合类型跟着 `AppPathKey` 走,无需逐处改;确认页展示的落点由 `browseDestPaths` 派生,自动跟上。

**不搬的**:Vue2 `#103` 在迁移完成时 `localStorage.setItem('photos_data_path', …)`。New-UI 既有纪律(`appPaths.ts` 顶部 ①):这三/四个键全仓无读者,照抄等于新造死代码。

### 3.3 测试

`appPaths.test.ts` 补第四行派生(用 §3.1 真实响应)· `migrateBrowse.test.ts` 补 `photos_data` 落点 + 断言 dot 目录过滤先于 blocked 生效(变异验证:把 59 行的 dot 过滤去掉,该用例必须红)· `AppsPanel.test.ts` 补第四行渲染与点击开弹窗。

**迁移本身不真跑**(开发机上不能真做数据迁移),与 `sys.ts` 现有注释口径一致。

---

## 4. C —— KVM 磁贴按服务可用性门控(#125)

### 4.1 Vue2 做法与 New-UI 的差异

Vue2 `builtInApps.js` 给 KVM 条目改成 `requiresService: 'kvm'`,新增 `filterBuiltInApps()`,`AppSection.vue` 在 `getList()` 里 `await this.$api.kvm.getSettings()` 探活,成功才纳入并在这里赋 `status`(不再硬写在静态表上)。

New-UI 的对位是 `src/home/stores/apps.ts` 的 `setApps()`(第 34 行):无条件把 `SYSTEM_APPS` 8 项塞进 map 并硬写 `status:'running'`。**但 New-UI 多一层 Vue2 没有的东西:桌面布局是持久化的**(`home/stores/layout.ts`),`vm` 还是 `defaultLayout` 的固定项(c12,r6)。

### 4.2 决策(机主 2026-08-09 拍板)

**磁贴也清掉**,复用现有 `sweepGone()` 缺席清扫通路(`layout.ts:200`,`MISSING_GRACE_MS = 45_000`),与容器应用被卸载同一套语义。代价与恢复路径:探测连续失败超过 45 秒会移除磁贴;KVM 恢复后从「添加应用」面板手动加回。

### 4.3 改动

- `systemApps.ts`:`SystemApp` 加可选 `requiresService?: 'kvm'`,`vm` 条目声明它。静态表不再是"永远全都在"的语义,注释登记。
- `apps.ts`:`setApps(container, links, opts?: { kvmAvailable?: boolean })`;`requiresService === 'kvm'` 的条目仅在 `kvmAvailable` 为真时注入。`loadGrid()` 里并发探一次 `service.kvm.getSettings()`,任何失败(未注册/不可达/超时)都按不可用,**不向上抛、不弹 toast**(Vue2 同款:失败即"不可用",不是错误)。
- `Home.vue:77-81` 的既有链路不改:`loadGrid()` 成功后仍调 `sweepGone(Object.keys(apps.apps))`,`vm` 不在 map 里就自动进 45 秒宽限期。
- 注意 `apps.ts` 末尾的 `setApps([])`(store 初始化时让系统应用立即可用):该调用不带可用性信息,**必须保证首帧不会因为"探测还没回来"就把 vm 判成不可用而触发清扫**。清扫只由 `Home.vue` 在 `loadGrid()` **成功之后**触发,首帧的 `setApps([])` 不参与 —— 实现时要显式验证这条,不能只靠推理。

### 4.4 测试

`apps.test.ts`:探测成功 → map 含 `vm`;探测失败 → 不含 `vm` 且不抛错;探测挂起(pending)时首帧行为不误判。
`systemApps.test.ts`:`requiresService` 声明存在且只在 `vm` 上。
布局侧:`layout.test.ts` 补一例 —— `vm` 缺席满 45 秒后磁贴被清、未满则保留(用假时钟)。

---

## 5. D —— 收尾登记(不写功能代码)

在 `NimoOS-UI/docs/vue3-migration-roadmap.md` 新开 SP17 节,写入本期范围、决策与下列**带证据的"不适用/不做"结论**,避免下一期重复探测:

- **`#97` Terminal Security 分区:不做。** 2026-08-09 实测 `GET /v1/sys/wsssh` → `404 {"message":"Not Found"}`,后端仍未提供;New-UI 早已删掉旧 wsssh 终端(`TerminalPanel.vue:5-9` 注释,债务 D7/D25)。证据写进 roadmap 与债务条目。
- **`#119`/`#121`/`#128`:不适用。** 逐条证据见 §6。

---

## 6. 「不适用」的逐条证据

| Vue2 改动 | New-UI 侧实测 |
|---|---|
| `#121` `getIconFromImage` 不再拼 `icon.nimoos.io` | New-UI `src/apps/util/importNormalize.ts:76` 已写明"不注入 icon:该域名不存在(Vue2 遗留死链)",同一问题早已处理 |
| `#121` Discord 链接换邀请链 | New-UI 无 `ContactBar` 对位组件(那是 Vue2 老外壳);全仓 `discord` 命中只在 AI 区渠道配置,与此无关 |
| `#119` 清死域名 | 改的是 Vue2 的 README/CODE_OF_CONDUCT/多语言 locale;New-UI 只有 `zh_cn`/`en_us` 两份 locale,无对应键 |
| `awesome.casaos.io`(`SourcesPage.vue:51`) | Vue2 `origin/main` 的 `AppStoreSourceManagement.vue:92` **同样还在** ⇒ 不是缺口,不动 |
| `#128` 默认应用图标 | New-UI 无 `default.png/svg` 资源,走 CSS `.store-icon-fallback`;换美术是新设计,不是补迁 |

---

## 7. 验收与门

**验收**:起 dev server(本仓惯例:验收 = dev server,不是 `deploy.sh`)。三条并行线已占 5273 / 5277 / 5288,**本期用 5279**。局域网现有 6 台设备(含本机),A 项验收数据真实可见;B 项在设置 · 应用页看第四行;C 项本机 KVM **可用**(`/v1/kvm/settings` 200),所以默认看到磁贴 —— 验"不可用"要在浏览器侧模拟探测失败,验收清单里写明具体操作。

**收尾门**(全部在本 worktree 跑,结果自己复跑、不转述):
`pnpm exec vue-tsc --noEmit` · `pnpm test` · `pnpm exec vitest run src/i18n/parity.test.ts` · `node oss/export.mjs --out <scratch> --no-commit --allow-dirty-oss` · `pnpm build`。

---

## 8. 明确不做

- 不改 Files 区、相册区、AI 区任何文件(那是 SP12/SP15/SP14 的并行线)。
- 不做 `#97` 的 Security 分区(后端 404)。
- 不做 Knowledge/Notes 的逐条差集核对(SP8 已吸收主体;若要彻查另开一期)。
- 不加 Vue2 没有的入口/功能(如手动触发局域网深度扫描、迁移进度以外的新交互)。
- 不做无关重构。
