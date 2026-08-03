# SP9-P6 KVM 第二半(创建 / OSSelector / 快照 / VM 设置 / 全局设置)实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Vue2 `KVMFullPage.vue` 剩下的四个弹窗 + `OSSelector.vue` 全量迁到 New-UI 的 `src/kvm/`,解禁 P5 留下的三个 disabled 入口,让 KVM 区功能完整(能建 VM、能挂 ISO、能改设置、能管快照)。

**Architecture:** 弹窗统一套一个 KVM 自己的 `KvmDialog.vue`(内部用 reka-ui 原语,class 全走 `--kvm-*`,不复用全局 `ui/Dialog.vue` 以守住「KVM 区固定深色」);ISO 列表与下载进度状态提到页面级 composable(Vue2 的 OSSelector 常驻挂载所以关掉弹窗仍收进度,New-UI 若照直觉 `v-if` 卸载组件就会断);表单校验与本地 ISO 反查抽成纯函数单独测。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript strict · reka-ui(DialogRoot/Portal/Overlay/Content)· vue-i18n 9 · Pinia(`useToast`)· vitest + @vue/test-utils · 共享包 `@nimotech/nimoos-service` 的 `kvm` / `folder` 两个域(**25 个 kvm 方法 P5 已全部进包,本期只消费不新增**)

**spec:** `docs/superpowers/specs/2026-07-31-vue3-migration-sp9-final-views-design.md` §6.2(2026-08-03 按实测重写)+ §1.15(P6 实测校正)+ §1.9(信封层数表)+ §1.10(创建校验硬下限)。**开工只读 spec,不要读 roadmap §4 SP9 的 A/B/C 三节**(07-30 探测稿,14 处与实测不符)。

**起点坐标:** New-UI `master 1935b3e`(P5 收尾 3985123 + spec 订正 1935b3e)· NimoOS-Service `master 39f5eb1` · 全量 339 文件 / 2877 例 passed · `vue-tsc` 零错 · `build` 通过 · 未推 origin、未部署。

---

## Global Constraints

每条对**每个任务**都生效,不再在各任务里重复:

1. **界面严格 1:1,逻辑照正确。** 像素 / 文案 / 交互顺序照 Vue2;Vue2 的 bug、竞态、吞错**不照抄**,改正确并在代码里注释登记偏离。**未申报的偏离即缺陷。禁止无关重构。**
2. **中文文案以 Vue2 `NimoOS-UI/src/assets/lang/zh_CN.json` 为准,不许自己译。** JSON 里查不到的看 Vue2 组件内联 `zh:` 字段。文案只落分片 `src/i18n/{zh_cn,en_us}.sp9.ts`,**不改主 locale 文件**(`parity.test.ts` 断言两个分片键完全一致)。英文值 = Vue2 那个 key 本身的字面量(本仓既有惯例,见 `en_us.sp9.ts` 的 `kvmTitle: 'NIMO Virtual Machines'`)。
3. **颜色全走 token。** `kvm.css` 里不许出现裸 `#hex` / `rgb()` / `rgba()` / `hsl()`。新 token 加在 `src/styles/theme.sp9.css`,且 `:root` 与 `:root[data-theme='light']` **两块都要有值**;**KVM 区固定深色 → 两块同值**。⚠️ `color-guard` 不剥注释,**注释里写 `rgba(...)` 也翻红**(`kvmStyles.test.ts` 自己那条会剥注释,全局 `color-guard.test.ts` 不剥,以严的为准:注释里一律不写色值字面量)。
4. **测试里读 `.css` 一律用 `node:fs`。** `?raw` 对 `.css` 在 vitest 下恒为空串(`color-guard.test.ts` 顶部有记录)。
5. **异步写共享 state 必带过期守卫**(就地 `let alive` / 代际计数,**别抽公共 guard**),回归测试必须**走交错路径**(不是只测顺序路径)。**过期守卫只保护「写共享 ref」这件事** —— 一个不写任何共享 ref 的函数(比如只发请求 + 返回字符串的 `save()`)不需要守卫,给它加守卫反而会把真实失败谎报成成功(Task 2 评审实逮到过一次)。

15. **断言必须有判别力,别写永真断言。**(Task 2 评审实逮到一次:用 `autostart: false` 的 fixture 去断言开关 `checked === false` —— checkbox 在**完全没接 v-model** 时默认就是 `false`,这条断言区分不出「接对了」和「没接」。)规则:**断言布尔/开关/选中态时,fixture 必须取「未接线时的默认值 ≠ 期望值」的那一侧**(测 `true` 而不是测 `false`)。拿不准就做**变异验证** —— 临时拆掉被测的那根接线,确认用例精确翻红;把变异验证的实际输出写进报告。

  **变种:「被混淆的断言」(Task 7 实逮到一次)。** 断言本身不空,但被**另一个无关的拦截**抢先兜住,于是删掉被测的守卫它照样通过。实例:测「`creating=true` 时点不动」,却没填表单名字 —— 就算把 `if (props.creating) return` 整行删掉,校验也会因名字为空独立挡住 `emit('submit')`,断言照样绿。**规则:测某个守卫时,必须让「除该守卫之外的所有拦截都放行」** —— 即把表单/状态填成合法的,使得关掉该守卫时行为**确实会变**。写法上最好在同一条用例里同时断出「守卫关时能通过」与「守卫开时被挡」,否则读者无法确认「被挡」不是别的东西挡的。
  适用于本期所有「忙碌态挡重复提交」的测试:`CreateVmDialog` 的 `creating`(Task 7)· `VmSettingsDialog` 的 `saving`(Task 9)· `SnapshotsTab` 的 `busy`(Task 10)· `InstallBanner` 的 `busy`(P5 已有,不追改)。

17. **要留防御性代码,就把主机制关掉来测它。**(Task 4 实逮到:三个 MessageBus 事件回调里的 `alive` 守卫**永远走不到** —— `dispose()` 先置 `alive=false` 再**同步**退订,回调此后根本不会被调用;那条自以为在验守卫的用例,实际验的是退订生效。)规则:一处守卫若被更靠前的机制抢先兜住,(a) 注释必须说清**哪层是承重的、哪层是纵深防御、以及什么情况下防御层会变成必需**(本例:某个回调将来改成 async,或 dispose 忘了退订);(b) 若决定保留防御层,就加一条**手动禁用主机制**的用例(把 mock 的退订函数改成空操作)来给它真实覆盖,并对它做变异验证。**别用一条被主机制保护着的用例去冒充守卫的覆盖。** 适用于本期所有带 `dispose()` 的 composable:`useIsoList`(Task 4)· `useIsoBrowser`(Task 6)· `useSnapshots`(Task 10)。
    ⚠️ 与第 5 条的分界:守卫**空转**(如本例)→ 保留 + 诚实注释 + 真实覆盖;守卫**主动损坏语义**(如 Task 2 的 `save()` 把真实失败谎报成成功)→ 删掉。

16. **持有「本地编辑副本」的弹窗,必须有一条测试证明「改了值 → 取消 → 共享 state 未被污染」。**(Task 2 评审实逮到一次:隔离实现对了但零测试覆盖 —— 哪天有人把本地副本换成直接双向绑共享 ref,全部既有测试仍然全绿,污染却已发生。)适用于本期的 `KvmGlobalSettingsDialog`(Task 2)· `CreateVmDialog`(Task 7)· `VmSettingsDialog`(Task 9)。同样要做变异验证。
6. **图标按钮一律单色文字符号 + `aria-label`,禁 emoji。** 沿用 P5 的占位手法(`⚙` / `⋮` / `‹` / `⬚`)。
7. **弹窗内报错不用 toast** —— toast 的 z-index 是 60,弹窗遮罩 900/1000 还带 blur,会把提示压住 + 糊掉。用弹窗内联 `.cv-error`(见 Task 1),**优先显示后端 `message`**。属于「操作结果」的(创建成功 / 快照已删除 / 设置已保存)仍走全局 `useToast()`。
8. **弹窗测试必须 `attachTo: document.body`**(reka-ui 走 teleport),且 `afterEach` 里显式 `wrapper.unmount()` 清理,否则 teleport 残留会污染后续用例。
9. **提交必须带显式 pathspec** —— `git add <具体路径>` **且 `git commit` 那行也带 pathspec**。**绝不 `add -A` / `commit -a` / `git reset`。** 工作区 index 里躺着 3 个 `design-export/*` 的删除,**不属本期**。
10. **此工作树永远别 `git checkout` / `git stash`**(会卷走那 3 个 staged 删除)。
11. **只在主工作树动手** —— `/home/nimo/NimoTech/NimoOS-New-UI`(master)。**不碰 `.sp7/` 和 `.sp8/`** 两个 worktree(相册区 / AI 区并行开发中,去改会打断别人的会话)。
12. **禁止对真机发本期范围之外的写请求。** 要 fixture 就 `curl` 只读端点。**验收阶段用户已授权建一台一次性 VM 并在验完后删除**(2026-08-03),但**开发阶段(T0-T11)一律不发写请求**,现有那台 `sp9-alpine-test` 全程不许碰。P5 有过实现者擅自建快照探测的先例。
13. **评审禁用 haiku**,评审者必须自己读源文件,不能只看 diff 摘要。
14. **验收起 dev server:** `cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm dev --host --port 5273`,浏览器开 `http://<本机IP>:5273/app/#/kvm`。⛔ **不要用 `deploy.sh`** —— 设备上只有一个 `/var/lib/nimoos/www/app/`,而 `deploy.sh` 是 `rsync --delete`,三条并行线共用它(master 5273 / `.sp7` 5277 / `.sp8` 5288),谁部署谁把另外两条的产物删掉。

### 任务门(本期改规则,用户 2026-08-03 定)

**每个任务结束跑**(约 400 例 / 6 秒):

```bash
pnpm vitest run src/kvm/
pnpm vitest run src/styles/color-guard.test.ts src/styles/theme.sp9.test.ts \
  src/kvm/styles/kvmStyles.test.ts src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit
```

**例外 —— 这三种任务的门要跑全量 `pnpm test`**:动了 `src/i18n/`、动了 `src/styles/theme.sp9.css`、动了共享包 `NimoOS-Service`。影响面天然超出 `src/kvm/`。本期符合的是 **Task 0**(三样全动)。

**全量 `pnpm test` + `pnpm build` 另外只在两个时点跑**:① 全分支终审前;② 部署前。

**判定标准:相对基线不新增红。** 基线 = 339 文件 / 2877 例 passed。⚠️ **`pnpm test` 会以非零码退出**,那是 P4 遗留缺陷(`SettingsPage.test.ts` 的 `service.users` mock 缺 `avatarPath`)—— **看用例数字,不看退出码。**

---

## File Structure

### 新建(`src/kvm/`)

| 文件 | 职责 |
|---|---|
| `components/KvmDialog.vue` | 弹窗外壳:reka-ui 原语 + `create-vm-head/body/foot` 三段 + 关闭按钮。**所有弹窗的唯一容器** |
| `util/isoMatch.ts` | 纯函数:`matchTemplateByFilename` / `formatFileSize` / `filterByCategory` / `isIsoFile` |
| `util/createVmValidate.ts` | 纯函数:`validateCreateVm(form, os, host) → { ok, errKey, errArg }` |
| `composables/useIsoList.ts` | ISO 模板列表 + 三个下载事件订阅 + `download(id)`。**在 `KvmPage` 里创建一次** |
| `composables/useIsoBrowser.ts` | 自定义区目录浏览(`service.folder.getList`) |
| `composables/useKvmHostInfo.ts` | `GET /settings` 的只读半 + 可写半;`saveSettings()` |
| `composables/useSnapshots.ts` | 快照 list / create / delete / restore |
| `components/OsSelector.vue` | 分类 tab + OS 卡片网格 + 下载按钮三态;自定义区以子组件嵌入 |
| `components/IsoBrowser.vue` | 面包屑 + 上一级 + 文件列表 + 空态 |
| `components/CreateVmDialog.vue` | 创建表单 8 字段 + 校验展示 + `osTemplate` 联动 |
| `components/VmSettingsDialog.vue` | 两 tab 壳 + General 内容 + `saveSettings` |
| `components/SnapshotsTab.vue` | 快照创建表单 + 列表 + 就地二次确认 |
| `components/KvmGlobalSettingsDialog.vue` | 全局设置 4 字段 |

每个新文件配同目录 `*.test.ts`。

### 修改

| 文件 | 改什么 |
|---|---|
| `src/kvm/views/KvmPage.vue` | 装配四个弹窗 + 三入口解禁 + 空列表自弹 + `useIsoList`/`useKvmHostInfo` 创建点 |
| `src/kvm/components/VmSidebar.vue` | 齿轮与「添加虚拟机」去掉 `disabled`,改 emit |
| `src/kvm/components/ConsoleHeader.vue` | 齿轮去掉 `disabled`,改 `:disabled="!canEditSettings"` + 双态 tooltip |
| `src/kvm/styles/kvm.css` | 追加弹窗 / OSSelector / 快照三段样式 |
| `src/kvm/styles/kvmStyles.test.ts` | 类名白名单补本期新类 |
| `src/styles/theme.sp9.css` | 新增 23 个 `--kvm-*` token(两块) |
| `src/i18n/zh_cn.sp9.ts` · `src/i18n/en_us.sp9.ts` | 新增文案键 |
| `../NimoOS-Service/src/types.ts` | `FolderEntry` 补 `size?: number` |

### Vue2 源坐标速查

- `NimoOS-UI/src/components/KVM/KVMFullPage.vue`:VM 设置弹窗 `:230-393` · 创建弹窗 `:396-494` · 全局设置弹窗 `:516-556` · `data()` `:574-666` · `osTemplate` 联动 watch `:720-746` · `showGlobalSettings/saveGlobalSettings` `:1075-1106` · `showCreateVM` `:1155-1190` · `openOSSelector/openSettingsOSSelector` `:1192-1200` · `showSettings` `:1202-1221` · 快照五方法 `:1225-1314` · `formatDate` `:1316-1320` · `onOSSelect` `:1376-1448` · `createVM` `:1450-1492` · `saveSettings` `:1494-1514` · `formatHostMem` `:1649`
- 样式(scoped)`:2305-2874`;样式(unscoped)`:2877-3095`。**死 CSS 不搬**:`.settings-modal` `.cv-uefi-warning` `.cv-disk-usage-bar` `.cv-input-icon-right` `.cv-input-icon` `.cv-ejected-text` `.cv-snapshot-list`(7 个类模板里零命中,已逐个 grep 确认)
- `NimoOS-UI/src/components/KVM/OSSelector.vue`:模板 `:1-98` · 脚本 `:100-363` · 样式 `:366-702`

---

## Task 0: 地基(token / 文案 / 共享包类型 / CSS 骨架 / 白名单)

**Files:**
- Modify: `src/styles/theme.sp9.css`(两个主题块各加 23 个 token)
- Modify: `src/i18n/zh_cn.sp9.ts` · `src/i18n/en_us.sp9.ts`
- Modify: `../NimoOS-Service/src/types.ts`(`FolderEntry` 加 `size?: number`)
- Modify: `src/kvm/styles/kvm.css`(只加文件头注释段落,样式由后续任务填)
- Modify: `src/kvm/styles/kvmStyles.test.ts`(白名单加本期类名)
- Test: `src/styles/theme.sp9.test.ts`(既有,加本期 token 的两块同值断言)· `../NimoOS-Service/src/folder.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: 23 个 `--kvm-*` token(名字见下表,后续任务只许用这些,不许再造)· i18n 键(下表)· `FolderEntry.size?: number`

- [ ] **Step 1: 共享包补 `FolderEntry.size` + 失败测试**

真机实测 `GET /v1/folder?path=/DATA` 每个条目都有 `size`(`NimoOS/model/zima.go:15-26` 的 `Path.Size int64`),但 `FolderEntry` 没声明。OSSelector 自定义区要显示文件大小。

在 `../NimoOS-Service/src/folder.test.ts` 加:

```ts
it('条目的 size 字段被保留(OSSelector 自定义区要显示文件大小)', async () => {
  const http = { get: vi.fn().mockResolvedValue({ data: { success: 200, data: { content: [
    { name: 'alpine.iso', path: '/DATA/alpine.iso', is_dir: false, is_symlink: false, size: 1048576 },
  ] } } }) }
  const folder = createFolder(http as never)
  const listing = await folder.getList('/DATA')
  expect(listing.content[0].size).toBe(1048576)
})
```

跑:`cd ../NimoOS-Service && pnpm vitest run src/folder.test.ts` → 预期 **类型错**(`Property 'size' does not exist on type 'FolderEntry'`)。

- [ ] **Step 2: 加字段并重建共享包**

`../NimoOS-Service/src/types.ts` 的 `FolderEntry` 里,紧跟 `is_symlink?` 之后加:

```ts
  // 真实响应里有(2026-08-03 实测 GET /v1/folder?path=/DATA,每个条目都带;后端
  // NimoOS/model/zima.go:15-26 的 Path.Size int64)。SP9-P6 的 OSSelector 自定义区
  // 用它显示 .iso 文件大小。可选是为了不打破既有构造点。
  size?: number
```

然后:

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm build && pnpm vitest run src/folder.test.ts
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm install
```

⚠️ **`pnpm install` 这步不能省** —— 记忆 `nimoos-service-pnpm-drift`:改完共享包不重新同步 `file:` 链接,New-UI 的 dev server 会继续喂旧包(Vite 预打包缓存不看内容),三道门全绿也抓不到。

- [ ] **Step 3: 新增 23 个 token(两块同值)**

在 `src/styles/theme.sp9.css` 的 `:root` 块里、`--kvm-banner-error-fg` 之后追加下面这段,**再在 `:root[data-theme='light']` 块里一字不差地复制一遍**(KVM 区固定深色)。注释里**不要写任何色值字面量**(全局 `color-guard` 不剥注释)。

| token | 值 | 用处(Vue2 坐标) |
|---|---|---|
| `--kvm-modal-bg` | `#1e1e1e` | 弹窗卡片底 `:2306` |
| `--kvm-modal-fg` | `#e1e1e1` | 弹窗内正文/输入框文字 `:2320` 等 |
| `--kvm-field-bg` | `#2a2a2a` | 输入框 / 选择器 / 空态底 `:2477` |
| `--kvm-field-border` | `#3a3a3a` | 输入框边框 / tab 下边框 / hover 底 `:2478` |
| `--kvm-field-elev` | `#333` | 关闭按钮 hover / CPU 格子底 / 固件段底 / 快照项边框 `:2338,2596,2672,2976` |
| `--kvm-accent-light` | `#a78bfa` | CPU 格子与固件按钮 active 字色 `:2633,2693` |
| `--kvm-accent-hover` | `#6d41d9` | 主按钮 hover `:2718` |
| `--kvm-accent-hover-alt` | `#7c3aed` | OSSelector 下载按钮 hover `OSSelector:544` |
| `--kvm-accent-ring` | `rgba(137, 80, 242, 0.25)` | 输入框 focus ring `:2492` |
| `--kvm-accent-faint` | `rgba(137, 80, 242, 0.1)` | OS 卡片 downloading 底 / 文件项 hover `OSSelector:471,661` |
| `--kvm-accent-muted` | `rgba(137, 80, 242, 0.3)` | downloading 按钮底 `OSSelector:558` |
| `--kvm-ok-hover` | `#69a129` | 「选择」按钮 hover `OSSelector:553` |
| `--kvm-ok-faint` | `rgba(118, 179, 45, 0.1)` | OS 卡片 downloaded 底 `OSSelector:466` |
| `--kvm-overlay-strong` | `rgba(0, 0, 0, 0.6)` | OSSelector 遮罩 `OSSelector:385` |
| `--kvm-shadow-mid` | `rgba(0, 0, 0, 0.3)` | OS 卡片 hover 阴影 `OSSelector:460` |
| `--kvm-snapshot-bg` | `#1c1c1c` | 快照项底 `:2975` |
| `--kvm-snapshot-hover` | `#222` | 快照项 hover 底 `:2982` |
| `--kvm-snapshot-desc-fg` | `#999` | 快照描述 `:3011` |
| `--kvm-snapshot-date-fg` | `#666` | 快照时间 `:3019` |
| `--kvm-restore-bg` | `#dc3545` | 恢复按钮底(破坏性操作,Vue2 用了一套独立的红)`:3064` |
| `--kvm-restore-bg-hover` | `#c82333` | 恢复按钮 hover `:3069` |
| `--kvm-restore-disabled-bg` | `#6c757d` | 恢复按钮 disabled 底 `:3076` |
| `--kvm-delete-bg-hover` | `#da3633` | 删除按钮 hover(底本身是 `--kvm-danger`)`:3089` |

**登记(注释里写清)**:`--kvm-accent-hover`(`#6d41d9`)与 `--kvm-accent-hover-alt`(`#7c3aed`)是**两个不同的紫**——Vue2 主按钮 hover 用前者、OSSelector 下载按钮 hover 用后者,**是 Vue2 自身的不一致**。按 1:1 各留一个 token,不擅自统一。

- [ ] **Step 4: token 两块同值的断言**

`src/styles/theme.sp9.test.ts` 里已有 P5 的同值比对用例(按既有写法扩展,**用 `node:fs` 读 css**)。把本期 23 个 token 名加进它的清单。跑:

```bash
pnpm vitest run src/styles/theme.sp9.test.ts
```

- [ ] **Step 5: 文案键(先 grep 确认已有键,再补新键)**

**先跑这个**,确认哪些键 P5 已经建过、不要重复建:

```bash
grep -n "kvmSettings\|kvmAutoStart\b\|kvmAreYouSure\|kvmDelete\b\|kvmClose\|kvmDeletingShort\|kvmToastDeleted\|kvmFailedToSaveSettings" src/i18n/zh_cn.sp9.ts
```

**已有、直接复用**(不要新建):`kvmSettings`=「系统设置」(全局设置弹窗标题,Vue2 那个 key 就是 `'Settings'` → zh_CN.json 是「系统设置」不是「设置」)· `kvmAutoStart`=「自动启动」· `kvmDeletingShort`=「删除中」· `kvmFailedToSaveSettings` · `kvmClose`。`kvmAreYouSure` / `kvmDelete` 若 grep 到就复用,没有就按下表建。

**新增键**(zh 值**逐字**取自 `NimoOS-UI/src/assets/lang/zh_CN.json`,en 值 = Vue2 的 key 字面量):

创建弹窗 —— `kvmCreateTitle`「创建新虚拟机」/`Create New VM` · `kvmVmName`「虚拟机名称」/`VM Name` · `kvmVmNamePlaceholder`「例如 debian-13」/`e.g. debian-13` · `kvmIsoImage`「ISO 镜像」/`ISO Image` · `kvmSelectIsoPlaceholder`「选择 ISO 镜像」/`Select an ISO image` · `kvmDiskSize`「磁盘大小」/`Disk Size` · `kvmMax`「最大」/`Max` · `kvmCpuCores`「CPU 核心」/`CPU Cores` · `kvmMemory`「内存」/`Memory` · `kvmNetwork`「网络」/`Network` · `kvmBridgeTo`「桥接到」/`Bridge to` · `kvmFirmware`「固件」/`Firmware` · `kvmOsVersion`「系统版本」/`OS Version` · `kvmGenericLinux`「通用 Linux」/`Generic Linux` · `kvmGenericWindows`「通用 Windows」/`Generic Windows` · `kvmCreate`「创建」/`Create`

创建校验与结果 —— `kvmErrNoName`「请输入虚拟机名称」/`Please enter a VM name` · `kvmErrNoOs`「请选择一个操作系统」/`Please select an operating system` · `kvmErrDiskMin`「磁盘大小必须至少为」/`Disk size must be at least` · `kvmErrMemoryMin`「内存必须至少为」/`Memory must be at least` · `kvmErrDiskMax`「磁盘大小超出可用空间」/`Disk size exceeds available` · `kvmErrMemoryMax`「内存超出可用空间」/`Memory exceeds available` · `kvmErrVcpuMax`「vCPU 超出可用核心」/`vCPU exceeds available` · `kvmToastVmCreated`「虚拟机创建成功」/`VM created successfully` · `kvmFailedToCreate`「创建虚拟机失败」/`Failed to create VM`

VM 设置 —— `kvmVmSettingsTitle`「虚拟机设置」/`VM Settings` · `kvmTabGeneral`「通用」/`General` · `kvmTabSnapshots`「快照」/`Snapshots` · `kvmUsed`「已使用」/`used` · `kvmNoIsoMounted`「未挂载 ISO」/`No ISO mounted` · `kvmSave`「保存」/`Save` · `kvmToastSettingsSaved`「设置已保存」/`Settings saved` · `kvmStopToModifySettings`「停止虚拟机以修改设置」/`Stop VM to modify settings`

快照 —— `kvmCreateSnapshot`「创建快照」/`Create Snapshot` · `kvmName`「名称」/`Name` · `kvmSnapshotNamePlaceholder`「输入快照名称」/`Enter snapshot name` · `kvmDescription`「描述」/`Description` · `kvmSnapshotDescPlaceholder`「输入描述（可选）」/`Enter description (optional)` · `kvmNoSnapshots`「暂无快照」/`No snapshots yet` · `kvmCreatedAt`「创建于」/`Created` · `kvmRestore`「恢复」/`Restore` · `kvmErrNoSnapshotName`「请输入快照名称」/`Please enter snapshot name` · `kvmToastSnapshotCreated`「快照创建成功」/`Snapshot created successfully` · `kvmFailedToCreateSnapshot`「创建快照失败」/`Failed to create snapshot` · `kvmRestoringSnapshot`「正在恢复快照」/`Restoring Snapshot` · `kvmRestoringShort`「恢复中」/`restoring` · `kvmRestoredShort`「已恢复」/`restored` · `kvmFailedToRestoreSnapshot`「恢复快照失败」/`Failed to restore snapshot` · `kvmDeletingSnapshot`「正在删除快照」/`Deleting Snapshot` · `kvmFailedToDeleteSnapshot`「删除快照失败」/`Failed to delete snapshot`

> ⚠️ `kvmRestoredShort`(「已恢复」/`restored`)与 P5 已有的 `kvmToastResumed`(「已恢复」/`resumed`)**中文同值但语义不同**(恢复快照 vs 恢复运行)。**必须分开建键**,别图省事复用——Vue2 也是两个 key。

全局设置 —— `kvmStoragePath`「存储路径」/`Storage Path` · `kvmDefaultVcpu`「默认 vCPU」/`Default vCPU` · `kvmCoresUnit`「核心」/`Cores` · `kvmDefaultMemory`「默认内存」/`Default Memory`

OSSelector —— `kvmSelectOsTitle`「选择操作系统」/`Select Operating System` · `kvmCatAll`「全部」/`All` · `kvmCatWindows`「Windows」/`Windows` · `kvmCatLinux`「Linux」/`Linux` · `kvmCatBsd`「BSD」/`BSD` · `kvmCustom`「自定义」/`Custom` · `kvmFolderEmpty`「此目录为空」/`This folder is empty` · `kvmSelect`「选择」/`Select` · `kvmDownload`「下载」/`Download` · `kvmToastDownloaded`「已下载」/`downloaded` · `kvmDownloadFailed`「下载失败」/`Download failed` · `kvmWaitForDownload`「请等待下载完成」/`Please wait for download to complete`

**`kvmCatBsd` 是 74 个键里唯一在 `zh_CN.json` 查不到的**(专有名词,两个 locale 都是 `BSD`)。

**4 个 New-UI 新增的 aria-label 键**(Vue2 那几个按钮只有图标、没有任何文案,按硬约束 6 必须补 `aria-label`。**这是本期唯一「自拟中文」的地方,必须在 i18n 分片里注释登记**):`kvmEjectIso`「弹出 ISO」/`Eject ISO` · `kvmMountIso`「挂载 ISO」/`Mount ISO` · `kvmParentDir`「上一级」/`Parent directory` · `kvmToggleCustom`「展开/收起自定义」/`Toggle custom section`

- [ ] **Step 6: `kvm.css` 白名单登记 + 文件头注释**

`src/kvm/styles/kvmStyles.test.ts` 的 `ALLOWED` Set 里追加本期类名(**样式还没写,先把名字定死,后续任务只许用这些**):

```
'kvm-dialog-overlay', 'kvm-dialog-content', 'create-vm-modal', 'create-vm-head',
'create-vm-title', 'create-vm-close', 'create-vm-body', 'create-vm-foot',
'cv-field', 'cv-label', 'cv-hint', 'cv-input-row', 'cv-input', 'cv-input-unit', 'cv-unit',
'cv-iso-btn', 'cv-placeholder', 'cv-iso-eject', 'cv-cpu-group', 'cv-cpu-btn',
'cv-select', 'cv-select-native', 'cv-select-arrow', 'cv-firmware-group', 'cv-firmware-btn',
'cv-primary-btn', 'cv-error', 'cv-switch', 'cv-switch-track', 'cv-switch-knob',
'settings-tabs', 'settings-tab',
'snapshots-body', 'cv-empty-state', 'cv-snapshot-item', 'cv-snapshot-info',
'cv-snapshot-name', 'cv-snapshot-desc', 'cv-snapshot-date', 'cv-snapshot-actions',
'cv-btn', 'cv-btn-restore', 'cv-btn-delete',
'os-selector-body', 'category-filter', 'category-btn', 'os-section', 'os-grid', 'os-card',
'is-downloaded', 'is-downloading', 'os-icon-wrapper', 'os-info', 'os-name', 'os-version',
'os-size', 'os-action-btn', 'is-download', 'is-selected', 'is-downloading-btn',
'custom-section', 'custom-divider', 'custom-browse', 'custom-breadcrumb', 'custom-back-btn',
'custom-path', 'custom-file-list', 'custom-loading', 'custom-empty', 'custom-file-item',
'custom-file-icon', 'custom-file-info', 'custom-file-name', 'custom-file-size',
'custom-file-arrow',
```

- [ ] **Step 7: 任务门(本任务跑全量)**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm vitest run
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm test                          # 与基线 339 文件 / 2877 例 比对,不新增红(看数字不看退出码)
pnpm exec vue-tsc --noEmit         # 零错
pnpm vitest run src/i18n/parity.test.ts src/styles/color-guard.test.ts src/styles/theme.sp9.test.ts src/kvm/styles/kvmStyles.test.ts
```

- [ ] **Step 8: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-Service
git add src/types.ts src/folder.test.ts
git commit src/types.ts src/folder.test.ts -m "feat(folder): FolderEntry 补 size(真机实测有值,SP9-P6 OSSelector 要显示文件大小)"

cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/styles/theme.sp9.css src/styles/theme.sp9.test.ts src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts src/kvm/styles/kvmStyles.test.ts src/kvm/styles/kvm.css
git commit src/styles/theme.sp9.css src/styles/theme.sp9.test.ts src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts src/kvm/styles/kvmStyles.test.ts src/kvm/styles/kvm.css -m "feat(kvm): P6 地基 —— 23 个弹窗 token + 74 个文案键 + 类名白名单"
```

---

## Task 1: `KvmDialog.vue` 弹窗外壳

**Files:**
- Create: `src/kvm/components/KvmDialog.vue` · `src/kvm/components/KvmDialog.test.ts`
- Modify: `src/kvm/styles/kvm.css`(追加弹窗外壳 + 表单字段两段样式)

**Interfaces:**
- Consumes: Task 0 的 token 与 `kvmClose` 文案键
- Produces:
  ```ts
  // props
  { open: boolean; title: string; width?: string; zBase?: number }
  // emits
  { 'update:open': [v: boolean] }
  // slots
  default   // → .create-vm-body 内部
  footer    // → .create-vm-foot 内部(没传 footer 时整个 foot 不渲染)
  tabs      // → head 与 body 之间(给 VmSettingsDialog 的两 tab 用)
  ```

- [ ] **Step 1: 写失败测试**

```ts
// src/kvm/components/KvmDialog.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import KvmDialog from './KvmDialog.vue'
import { i18n } from '../../i18n'

let w: VueWrapper | null = null
// 硬约束 8:reka-ui 走 teleport,必须 attachTo body 且显式清理。
const mk = (props: Record<string, unknown> = {}, slots: Record<string, string> = {}) => {
  w = mount(KvmDialog, {
    props: { open: true, title: '创建新虚拟机', ...props },
    slots: { default: '<p class="probe">身体</p>', ...slots },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  return w
}
afterEach(() => { w?.unmount(); w = null; document.body.innerHTML = '' })

describe('KvmDialog', () => {
  it('open 时把标题与默认插槽渲染到 body(teleport)', () => {
    mk()
    expect(document.body.textContent).toContain('创建新虚拟机')
    expect(document.body.querySelector('.probe')).not.toBeNull()
    expect(document.body.querySelector('.create-vm-body')).not.toBeNull()
  })

  it('open=false 时不渲染任何内容', () => {
    mk({ open: false })
    expect(document.body.querySelector('.create-vm-modal')).toBeNull()
  })

  it('点关闭按钮 emit update:open=false,且带 aria-label', async () => {
    const wr = mk()
    const btn = document.body.querySelector('.create-vm-close') as HTMLButtonElement
    expect(btn.getAttribute('aria-label')).toBeTruthy()
    btn.click()
    await wr.vm.$nextTick()
    expect(wr.emitted('update:open')).toEqual([[false]])
  })

  it('没传 footer 插槽时不渲染 create-vm-foot(创建/设置弹窗有脚,快照 tab 没有)', () => {
    mk()
    expect(document.body.querySelector('.create-vm-foot')).toBeNull()
  })

  it('传了 footer 与 tabs 插槽时各自渲染到位', () => {
    mk({}, { footer: '<button class="f">保存</button>', tabs: '<div class="t">tabs</div>' })
    expect(document.body.querySelector('.create-vm-foot .f')).not.toBeNull()
    expect(document.body.querySelector('.t')).not.toBeNull()
  })

  it('zBase 落到遮罩与内容的 z-index 上(OSSelector 要叠在创建弹窗之上)', () => {
    mk({ zBase: 920 })
    const overlay = document.body.querySelector('.kvm-dialog-overlay') as HTMLElement
    const content = document.body.querySelector('.kvm-dialog-content') as HTMLElement
    expect(overlay.style.zIndex).toBe('920')
    expect(content.style.zIndex).toBe('921')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

`pnpm vitest run src/kvm/components/KvmDialog.test.ts` → 预期 FAIL(`Failed to resolve import './KvmDialog.vue'`)。

- [ ] **Step 3: 实现组件**

```vue
<script setup lang="ts">
// KVM 区弹窗外壳。视觉 1:1 对 Vue2 KVMFullPage.vue 的 .create-vm-modal 三段结构
// (:233-238 head / :404 body / :488-492 foot),四个弹窗与 OSSelector 全部套它。
//
// ⚠️ 为什么不复用全局 components/ui/Dialog.vue:它的背景是 var(--popup-bg) 玻璃 +
// --card-border,浅色主题下会变白底,与「KVM 区固定深色」(spec §6.1)直接冲突,而它的
// <style scoped> 从外面覆盖不了。这里用同一套 reka-ui 原语(白拿焦点陷阱 / Esc /
// 遮罩点击关闭),但 class 全走 --kvm-*。属已申报的结构偏离(spec §6.2.5 第 1 条):
// Vue2 用的是 buefy b-modal(创建/设置/全局设置)+ 手写 overlay(OSSelector),
// 这里统一到 reka —— 视觉 1:1,容器实现变。
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'reka-ui'
import { useI18n } from 'vue-i18n'
import { useSlots } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  /** Vue2 各弹窗的 :width(创建 560 / VM 设置 600 / 全局设置 560 / OSSelector max 40rem)。 */
  width?: string
  /** 遮罩 z-index;内容取 zBase+1。默认 900(KVM 弹窗层),OSSelector 传 920 叠在创建弹窗之上。
   *  P5 的 ProgressOverlay 是 1000,因此进度遮罩天然盖在弹窗之上,与 Vue2 b-modal 次序一致。 */
  zBase?: number
}>(), { width: '560px', zBase: 900 })

const emit = defineEmits<{ 'update:open': [v: boolean] }>()
const { t } = useI18n()
const slots = useSlots()
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="kvm-dialog-overlay" :style="{ zIndex: String(props.zBase) }" />
      <DialogContent
        class="kvm-dialog-content create-vm-modal"
        :style="{ zIndex: String(props.zBase + 1), width: props.width }"
        :aria-describedby="undefined"
      >
        <header class="create-vm-head">
          <DialogTitle class="create-vm-title">{{ title }}</DialogTitle>
          <!-- ✕ 是单色文字符号(禁 emoji),同 P5 的 ⚙/⋮/‹ 一批占位债务。 -->
          <button
            type="button"
            class="create-vm-close"
            :aria-label="t('kvmClose')"
            @click="emit('update:open', false)"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </header>

        <slot name="tabs" />

        <section class="create-vm-body"><slot /></section>

        <footer v-if="slots.footer" class="create-vm-foot"><slot name="footer" /></footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
```

- [ ] **Step 4: 写 CSS**

在 `src/kvm/styles/kvm.css` 末尾追加两段。**逐条照 Vue2 搬,只把色值换成 token**:

- 弹窗外壳:`.kvm-dialog-overlay`(`position:fixed; inset:0; background:var(--kvm-overlay-strong)`)· `.kvm-dialog-content`(`position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); max-width:92vw; max-height:85vh; overflow:hidden; display:flex; flex-direction:column`)· `.create-vm-modal` 照 Vue2 `:2305-2310`(底 `--kvm-modal-bg`、`border-radius`)· `.create-vm-head` / `.create-vm-title` / `.create-vm-close` 照 `:2311-2343`(close 的 hover 底是 `--kvm-field-elev`)· `.create-vm-body` 照 `:2344-2439`(**加 `overflow-y:auto`**,Vue2 靠 b-modal 的 `modal-card-body` 提供滚动,这里外壳自己给)· `.create-vm-foot` 照 `:2702-2722`。
- 表单字段:`.cv-field` `:2440-2450` · `.cv-label` `:2444` · `.cv-hint` `:2451-2459` · `.cv-input-row` `:2460-2470` · `.cv-input` `:2471-2496`(focus ring 用 `--kvm-accent-ring`)· `.cv-input-unit` / `.cv-unit` `:2497-2524` · `.cv-primary-btn`(**新类**,替代 Vue2 的 `b-button type="is-primary" rounded`)

> ⚠️ **`.cv-primary-btn` 的几何值订正(2026-08-03,Task 1 期间实测算优先级后修正本计划)**:照 Vue2 `.create-vm-foot .button.is-primary`(`:2707-2720`)—— 底 `--kvm-accent`、字 `--kvm-on-accent`、`border: none`、`padding: 0 2rem`、`height: 2.5rem`、`font-size: 0.875rem`、`font-weight: 600`、**`border-radius: 0.5rem`**、hover 底 `--kvm-accent-hover`。
>
> **不是胶囊(`999px`)。** 本计划初稿凭模板上的 `rounded` prop 写了 `999px`,是错的:那条 Vue2 规则在 **scoped** 样式块里(`:1657-2874`),编译后选择器是 `.create-vm-foot .button.is-primary[data-v-x]` = 优先级 **(0,4,0)**,而 buefy 的 `.button.is-rounded { border-radius: 9999px; padding-left/right: calc(1em + .25em) }` 只有 **(0,2,0)** —— 页面自己的规则把 `rounded` 的圆角**和**左右内边距一起压掉了。所以 Vue2 真机渲染的是 0.5rem 圆角 + 2rem 左右内边距。
>
> 另加 `:disabled { opacity: .5; cursor: not-allowed }`(Vue2 靠 buefy 的 disabled 态,New-UI 自绘按钮要自己给)。`is-loading` 态复用 P5 `.banner-btn.is-loading` 的转圈手法。
>
> **同一份几何值也适用于 Task 10 的「创建快照」按钮** —— Vue2 `.snapshots-body .button.is-primary`(`:2724-2738`)与 `.create-vm-foot` 那条**逐字相同**。· `.cv-error`(**新类**,弹窗内联报错:字 `--kvm-danger`、`font-size:.8rem`、`margin-top:.35rem`——硬约束 7,不用 toast)。

⚠️ **`.create-vm-modal` 的 hover 规则若有,必须带 `:not(:disabled)`**(P5 已有这条守卫的先例,见 `kvmStyles.test.ts` 里 `add-vm-btn` 那两条)。`.cv-primary-btn` 与 `.cv-btn` 家族都要遵守。

- [ ] **Step 5: 跑测试 + 任务门**

```bash
pnpm vitest run src/kvm/
pnpm vitest run src/styles/color-guard.test.ts src/styles/theme.sp9.test.ts src/kvm/styles/kvmStyles.test.ts src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit
```

- [ ] **Step 6: 提交**

```bash
git add src/kvm/components/KvmDialog.vue src/kvm/components/KvmDialog.test.ts src/kvm/styles/kvm.css
git commit src/kvm/components/KvmDialog.vue src/kvm/components/KvmDialog.test.ts src/kvm/styles/kvm.css -m "feat(kvm): KvmDialog 弹窗外壳(reka-ui 原语 + KVM 固定深色 token)"
```

---

## Task 2: 全局设置弹窗(第一个能在真机点的闭环)

**Files:**
- Create: `src/kvm/composables/useKvmHostInfo.ts` + `.test.ts`
- Create: `src/kvm/components/KvmGlobalSettingsDialog.vue` + `.test.ts`
- Modify: `src/kvm/components/VmSidebar.vue`(齿轮解禁)· `src/kvm/components/VmSidebar.test.ts`
- Modify: `src/kvm/views/KvmPage.vue` + `KvmPage.test.ts`
- Modify: `src/kvm/styles/kvm.css`(开关 `.cv-switch` 一段)

**Interfaces:**
- Consumes: Task 1 的 `KvmDialog`
- Produces:
  ```ts
  // useKvmHostInfo.ts
  export interface KvmHostReadonly {
    cpuCores: number; availableMemoryMB: number; availableDiskGB: number
    networkInterfaces: string[]; defaultDiskSize: number
  }
  export interface KvmWritableSettings {
    storagePath: string; defaultVcpu: number; defaultMemory: number; autostart: boolean
  }
  export function useKvmHostInfo(): {
    host: Ref<KvmHostReadonly>            // 初值全 0 / []
    settings: Ref<KvmWritableSettings>    // 初值 '' / 0 / 0 / false
    loaded: Ref<boolean>
    fetch(): Promise<void>                // 吞错(照 Vue2 .catch(() => {}))
    save(next: KvmWritableSettings): Promise<string>  // '' = 成功;非空 = 报错文案
    dispose(): void
  }
  ```

- [ ] **Step 1: 写 `useKvmHostInfo` 的失败测试**

```ts
// src/kvm/composables/useKvmHostInfo.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useKvmHostInfo } from './useKvmHostInfo'

const api = { getSettings: vi.fn(), updateSettings: vi.fn() }
vi.mock('@nimotech/nimoos-service', () => ({ service: { get kvm() { return api } } }))

// 真机 2026-08-03 实测值(spec §1.15),不是手编 fixture。
const REAL = {
  autostart: false, availableDiskGB: 263, availableMemoryMB: 9234, cpuCores: 6,
  defaultDiskSize: 20, defaultMemory: 2048, defaultVcpu: 2,
  networkInterfaces: ['enp2s0', 'enp4s0', 'wlp1s0'], storagePath: '/DATA/KVM',
}

beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()) })

describe('useKvmHostInfo', () => {
  it('初值是 0 / 空数组,不是 Vue2 那组硬编码假值(spec §12 #6)', () => {
    const s = useKvmHostInfo()
    expect(s.host.value.cpuCores).toBe(0)
    expect(s.host.value.networkInterfaces).toEqual([])
    expect(s.loaded.value).toBe(false)
  })

  it('fetch 后只读半与可写半各就各位', async () => {
    api.getSettings.mockResolvedValue(REAL)
    const s = useKvmHostInfo()
    await s.fetch()
    expect(s.host.value).toEqual({
      cpuCores: 6, availableMemoryMB: 9234, availableDiskGB: 263,
      networkInterfaces: ['enp2s0', 'enp4s0', 'wlp1s0'], defaultDiskSize: 20,
    })
    expect(s.settings.value).toEqual({
      storagePath: '/DATA/KVM', defaultVcpu: 2, defaultMemory: 2048, autostart: false,
    })
    expect(s.loaded.value).toBe(true)
  })

  it('fetch 失败吞掉、loaded 保持 false(照 Vue2 .catch(() => {}))', async () => {
    api.getSettings.mockRejectedValue(new Error('boom'))
    const s = useKvmHostInfo()
    await s.fetch()
    expect(s.loaded.value).toBe(false)
    expect(s.host.value.cpuCores).toBe(0)
  })

  it('save 只发 4 个可写字段(PUT /settings 只认这些)', async () => {
    api.updateSettings.mockResolvedValue({})
    const s = useKvmHostInfo()
    const err = await s.save({ storagePath: '/x', defaultVcpu: 4, defaultMemory: 4096, autostart: true })
    expect(err).toBe('')
    expect(api.updateSettings).toHaveBeenCalledWith({
      storagePath: '/x', defaultVcpu: 4, defaultMemory: 4096, autostart: true,
    })
  })

  it('save 失败返回后端 message(硬约束 7:优先显示后端原文)', async () => {
    api.updateSettings.mockRejectedValue(new Error('storage path not writable'))
    const s = useKvmHostInfo()
    expect(await s.save({ storagePath: '/x', defaultVcpu: 1, defaultMemory: 256, autostart: false }))
      .toBe('storage path not writable')
  })

  it('dispose 后 fetch 落定不再写 state(过期守卫;交错路径)', async () => {
    let release: (v: unknown) => void = () => {}
    api.getSettings.mockReturnValue(new Promise((r) => { release = r }))
    const s = useKvmHostInfo()
    const p = s.fetch()
    s.dispose()            // 请求在途时组件卸载
    release(REAL)
    await p
    expect(s.loaded.value).toBe(false)
    expect(s.host.value.cpuCores).toBe(0)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

`pnpm vitest run src/kvm/composables/useKvmHostInfo.test.ts` → FAIL(模块不存在)。

- [ ] **Step 3: 实现 `useKvmHostInfo.ts`**

要点:

- `service.kvm.getSettings()` 是**单层信封**(P5 已在共享包里写死,这里直接拿对象,不要再剥)。
- **初值全 0 / `[]`**(不照抄 Vue2 `:619-627` 的 `cpuCores:16 / 11673 / 959`)——那是占位残留,会让 CPU 核心格子首帧闪出 16 个再变真值 6 个。**注释里登记为 spec §12 #6 授权偏离。**
- **过期守卫**:模块内 `let alive = true`,`dispose()` 置 false;`fetch` / `save` 的 `await` 之后先判 `alive` 再写 ref(硬约束 5,**就地写,别抽公共 guard**)。
- `save` 返回 `string`(`''` = 成功):照 P5 `ejectInstallMedia` 已经立好的返回值契约,避免共享 `lastError` 串味。失败文案取 `err instanceof Error ? err.message : ''`,空则回退 `'kvmFailedToSaveSettings'` 键名(消费方用 `te()/t()` 判定,同 P5 `ConsoleStage` 的写法)。

- [ ] **Step 4: 写 `KvmGlobalSettingsDialog` 的失败测试**

```ts
// src/kvm/components/KvmGlobalSettingsDialog.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import KvmGlobalSettingsDialog from './KvmGlobalSettingsDialog.vue'
import { i18n } from '../../i18n'

const api = { getSettings: vi.fn(), updateSettings: vi.fn() }
vi.mock('@nimotech/nimoos-service', () => ({ service: { get kvm() { return api } } }))

const REAL = {
  autostart: false, availableDiskGB: 263, availableMemoryMB: 9234, cpuCores: 6,
  defaultDiskSize: 20, defaultMemory: 2048, defaultVcpu: 2,
  networkInterfaces: ['enp2s0', 'enp4s0', 'wlp1s0'], storagePath: '/DATA/KVM',
}

let w: VueWrapper | null = null
const mk = () => {
  w = mount(KvmGlobalSettingsDialog, {
    props: { open: true }, global: { plugins: [i18n] }, attachTo: document.body,
  })
  return w
}
beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(api).forEach((f) => f.mockReset())
  api.getSettings.mockResolvedValue(REAL)
  api.updateSettings.mockResolvedValue({})
})
afterEach(() => { w?.unmount(); w = null; document.body.innerHTML = '' })

const q = (sel: string) => document.body.querySelector(sel) as HTMLElement

describe('KvmGlobalSettingsDialog', () => {
  it('打开即拉设置并回填四个字段', async () => {
    const wr = mk(); await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    expect(api.getSettings).toHaveBeenCalledTimes(1)
    expect((q('input[name="storagePath"]') as HTMLInputElement).value).toBe('/DATA/KVM')
    expect((q('input[name="defaultVcpu"]') as HTMLInputElement).value).toBe('2')
    expect((q('input[name="defaultMemory"]') as HTMLInputElement).value).toBe('2048')
    expect(q('.cv-switch input')!.hasAttribute('checked') ||
      (q('.cv-switch input') as HTMLInputElement).checked).toBe(false)
  })

  it('标题是「系统设置」(Vue2 那个 key 是 Settings,zh_CN.json 译作系统设置)', async () => {
    mk(); await new Promise((r) => setTimeout(r))
    expect(q('.create-vm-title').textContent).toContain('系统设置')
  })

  it('点保存 → 只发 4 个可写字段 → emit update:open=false', async () => {
    const wr = mk(); await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    ;(q('.cv-primary-btn') as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    expect(api.updateSettings).toHaveBeenCalledWith({
      storagePath: '/DATA/KVM', defaultVcpu: 2, defaultMemory: 2048, autostart: false,
    })
    expect(wr.emitted('update:open')).toEqual([[false]])
  })

  it('保存失败 → 弹窗内联 .cv-error 显示后端 message,弹窗不关(硬约束 7)', async () => {
    api.updateSettings.mockRejectedValue(new Error('storage path not writable'))
    const wr = mk(); await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    ;(q('.cv-primary-btn') as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    expect(q('.cv-error').textContent).toContain('storage path not writable')
    expect(wr.emitted('update:open')).toBeUndefined()
  })

  it('保存成功弹全局 toast「设置已保存」', async () => {
    const { useToast } = await import('../../stores/toast')
    const wr = mk(); await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    ;(q('.cv-primary-btn') as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    expect(useToast().toasts.map((x) => x.text)).toContain('设置已保存')
  })
})
```

- [ ] **Step 5: 实现 `KvmGlobalSettingsDialog.vue`**

模板照 Vue2 `:516-556`:四个 `.cv-field`(存储路径文本框 · 默认 vCPU 数字框 + 单位「核心」· 默认内存数字框 + 单位 MB · 自动启动开关)+ footer 一个「保存」主按钮。

- `open` 变 true 时 `fetch()`(照 Vue2 `showGlobalSettings` `:1075-1087`:先开弹窗再拉数据)。用 `watch(() => props.open, ...)`,`onUnmounted` 调 `dispose()`。
- 表单编辑用一份本地副本(`reactive({...})`),`fetch` 回来后覆盖 —— 不要直接双向绑 composable 里的 `settings` ref,免得取消编辑后脏值留在共享 state 里。
- 开关:Vue2 用 `b-switch`,New-UI 没有 → 自绘 `.cv-switch`(`<label>` 包一个 `<input type="checkbox" class="sr-only">` + `.cv-switch-track` + `.cv-switch-knob`)。**登记为容器偏离**(视觉照 buefy 开关的胶囊形)。
- 保存:`const err = await host.save(local)`;`err === ''` → `toast.show(t('kvmToastSettingsSaved'))` + `emit('update:open', false)`;否则写 `formError.value`(经 `te()/t()` 判定后)显示在 footer 上方的 `.cv-error`。

CSS:`.cv-switch` / `.cv-switch-track` / `.cv-switch-knob` 三个类(胶囊 `--kvm-toggle-off` → on 时 `--kvm-accent`,旋钮 `--kvm-on-accent`)。

- [ ] **Step 6: 解禁左栏齿轮**

`VmSidebar.vue`:齿轮按钮去掉 `disabled` 与 `:title="t('kvmComingSoon')"`,改 `:title="t('kvmSettings')"` + `@click="$emit('open-global-settings')"`,`defineEmits` 加这一项。

`VmSidebar.test.ts` 补:
```ts
it('齿轮不再 disabled,点击 emit open-global-settings', async () => {
  const w = mount(VmSidebar, { props: { vms: [], selectedId: null, runningCount: 0, isLoading: false, collapsed: false }, global: { plugins: [i18n] } })
  const btn = w.get('.kvm-settings-btn')
  expect(btn.attributes('disabled')).toBeUndefined()
  await btn.trigger('click')
  expect(w.emitted('open-global-settings')).toHaveLength(1)
})
```

`KvmPage.vue`:`const globalSettingsOpen = ref(false)`,`<VmSidebar @open-global-settings="globalSettingsOpen = true">`,模板底部挂 `<KvmGlobalSettingsDialog v-model:open="globalSettingsOpen" />`。`KvmPage.test.ts` 补一条「点齿轮弹出全局设置弹窗」。

⚠️ `kvmStyles.test.ts` 里 `add-vm-btn` / `kvm-settings-btn` 的 `:disabled` cursor 守卫**保留不动** —— `add-vm-btn` 到 Task 8 才解禁,而 `:disabled` 规则留着对将来也无害。

- [ ] **Step 7: 任务门 + 提交**

```bash
pnpm vitest run src/kvm/
pnpm vitest run src/styles/color-guard.test.ts src/styles/theme.sp9.test.ts src/kvm/styles/kvmStyles.test.ts src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit

git add src/kvm/composables/useKvmHostInfo.ts src/kvm/composables/useKvmHostInfo.test.ts src/kvm/components/KvmGlobalSettingsDialog.vue src/kvm/components/KvmGlobalSettingsDialog.test.ts src/kvm/components/VmSidebar.vue src/kvm/components/VmSidebar.test.ts src/kvm/views/KvmPage.vue src/kvm/views/KvmPage.test.ts src/kvm/styles/kvm.css
git commit src/kvm/composables/useKvmHostInfo.ts src/kvm/composables/useKvmHostInfo.test.ts src/kvm/components/KvmGlobalSettingsDialog.vue src/kvm/components/KvmGlobalSettingsDialog.test.ts src/kvm/components/VmSidebar.vue src/kvm/components/VmSidebar.test.ts src/kvm/views/KvmPage.vue src/kvm/views/KvmPage.test.ts src/kvm/styles/kvm.css -m "feat(kvm): 全局设置弹窗 + useKvmHostInfo(左栏齿轮解禁)"
```

---

## Task 3: 纯函数 util(ISO 匹配 / 大小格式化 / 分类过滤 / 创建校验)

**Files:**
- Create: `src/kvm/util/isoMatch.ts` + `.test.ts`
- Create: `src/kvm/util/createVmValidate.ts` + `.test.ts`

**Interfaces:**
- Consumes: `KvmISO`(共享包)· Task 2 的 `KvmHostReadonly` · **`formatHostMem`(P5 已有,在 `src/kvm/util/format.ts:17`,是 `formatRam` 的别名)—— 直接 import 复用,不要重新实现一个**
- Produces:
  ```ts
  // isoMatch.ts
  export function isIsoFile(name: string): boolean
  export function formatFileSize(bytes: number | undefined): string
  export function filterByCategory(list: KvmISO[], cat: string): KvmISO[]
  export function matchTemplateByFilename(fileName: string, templates: KvmISO[]): KvmISO | null
  export function osTemplateDefaults(templateId: string, templates: KvmISO[]):
    { osType: 'linux' | 'windows'; firmware: 'bios' | 'uefi'; os: string
      vcpu?: number; memory?: number; minDisk?: number }

  // createVmValidate.ts
  export interface CreateVmForm {
    name: string; vcpu: number; memory: number; disk: number
    iso: string; os: string; osType: string; networkMode: string; firmware: string
  }
  /** '' = 通过;否则返回 { key, arg } —— key 是 i18n 键,arg 拼在文案后面(照 Vue2 的
   *  `${$t('Disk size must be at least')} ${os.minDisk} GB` 拼法)。 */
  export function validateCreateVm(
    form: CreateVmForm, os: KvmISO | null, host: KvmHostReadonly,
  ): { key: string; arg: string } | null
  ```

- [ ] **Step 1: 写 `isoMatch` 的失败测试**

```ts
// src/kvm/util/isoMatch.test.ts
import { describe, it, expect } from 'vitest'
import { isIsoFile, formatFileSize, filterByCategory, matchTemplateByFilename, osTemplateDefaults } from './isoMatch'
import type { KvmISO } from '@nimotech/nimoos-service'

// 真机 2026-08-03 `curl /v1/kvm/isos` 的 8 条里取 5 条(逐字,未手编)。
const T = (over: Partial<KvmISO>): KvmISO => ({
  id: 'x', name: 'X', version: '1', category: 'linux', size: '1 GB', status: 'available',
  progress: 0, recommendedVcpu: 2, recommendedMemory: 2048, minMemory: 512, minDisk: 8, ...over,
})
const TEMPLATES: KvmISO[] = [
  T({ id: 'debian-13', name: 'Debian', version: '13 (Trixie)', category: 'linux', size: '676 MB', minDisk: 8, minMemory: 512, recommendedMemory: 2048 }),
  T({ id: 'ubuntu-2404', name: 'Ubuntu', version: '24.04.4 LTS', category: 'linux', size: '6.2 GB', minDisk: 10, minMemory: 1024, recommendedMemory: 4096 }),
  T({ id: 'win10', name: 'Windows 10', version: '22H2', category: 'windows', size: '6.7 GB', minDisk: 60, minMemory: 2048, recommendedMemory: 4096 }),
  T({ id: 'win11', name: 'Windows 11', version: '24H2', category: 'windows', size: '5.8 GB', minDisk: 60, minMemory: 4096, recommendedMemory: 8192 }),
  T({ id: 'freebsd-14', name: 'FreeBSD', version: '14', category: 'bsd', size: '1.2 GB', minDisk: 10 }),
  T({ id: 'alpine-319', name: 'Alpine', version: '3.19', category: 'linux', size: '60 MB', status: 'downloaded', path: '/DATA/KVM/isos/alpine-319.iso', minDisk: 2, minMemory: 256 }),
]

describe('isIsoFile', () => {
  it('大小写不敏感地认 .iso', () => {
    expect(isIsoFile('Alpine.ISO')).toBe(true)
    expect(isIsoFile('a.iso')).toBe(true)
    expect(isIsoFile('a.img')).toBe(false)
    expect(isIsoFile('isolate.txt')).toBe(false)
  })
})

describe('formatFileSize', () => {
  it('照 Vue2 OSSelector:1024 进制、一位小数、空/0 返回空串', () => {
    expect(formatFileSize(undefined)).toBe('')
    expect(formatFileSize(0)).toBe('')
    expect(formatFileSize(512)).toBe('512.0 B')
    expect(formatFileSize(1048576)).toBe('1.0 MB')
    expect(formatFileSize(1610612736)).toBe('1.5 GB')
  })
})

describe('filterByCategory', () => {
  it('all 返回全部,其余按 category 精确过滤', () => {
    expect(filterByCategory(TEMPLATES, 'all')).toHaveLength(6)
    expect(filterByCategory(TEMPLATES, 'windows').map((t) => t.id)).toEqual(['win10', 'win11'])
    expect(filterByCategory(TEMPLATES, 'bsd').map((t) => t.id)).toEqual(['freebsd-14'])
  })
})

describe('matchTemplateByFilename', () => {
  it('文件名含模板 id 时直接命中(照 Vue2 :335-340)', () => {
    expect(matchTemplateByFilename('my-debian-13-netinst.iso', TEMPLATES)?.id).toBe('debian-13')
  })
  it('win11 / win10 / 泛 win 三级兜底(照 Vue2 :343-345)', () => {
    expect(matchTemplateByFilename('Win11_24H2.iso', TEMPLATES)?.id).toBe('win11')
    expect(matchTemplateByFilename('win10_x64.iso', TEMPLATES)?.id).toBe('win10')
    expect(matchTemplateByFilename('windows-server.iso', TEMPLATES)?.id).toBe('win11')
  })
  it('认不出来返回 null', () => {
    expect(matchTemplateByFilename('haiku-r1.iso', TEMPLATES)).toBeNull()
  })
})

describe('osTemplateDefaults', () => {
  it('generic-linux → bios/linux/Linux(照 Vue2 :722-725)', () => {
    expect(osTemplateDefaults('generic-linux', TEMPLATES))
      .toMatchObject({ osType: 'linux', firmware: 'bios', os: 'Linux' })
  })
  it('generic-windows → uefi/windows/Windows(照 Vue2 :726-729)', () => {
    expect(osTemplateDefaults('generic-windows', TEMPLATES))
      .toMatchObject({ osType: 'windows', firmware: 'uefi', os: 'Windows' })
  })
  it('真实模板:id 或 name 含 win 即判 windows + uefi,并带出推荐规格(照 Vue2 :731-743)', () => {
    expect(osTemplateDefaults('win10', TEMPLATES)).toMatchObject({
      osType: 'windows', firmware: 'uefi', os: 'Windows 10', vcpu: 2, memory: 4096, minDisk: 60,
    })
    expect(osTemplateDefaults('ubuntu-2404', TEMPLATES)).toMatchObject({
      osType: 'linux', firmware: 'bios', os: 'Ubuntu', vcpu: 2, memory: 4096, minDisk: 10,
    })
  })
  it('未知 id 回落 generic-linux', () => {
    expect(osTemplateDefaults('nope', TEMPLATES)).toMatchObject({ osType: 'linux', firmware: 'bios' })
  })
})
```

- [ ] **Step 2: 写 `createVmValidate` 的失败测试**

```ts
// src/kvm/util/createVmValidate.test.ts
import { describe, it, expect } from 'vitest'
import { validateCreateVm, type CreateVmForm } from './createVmValidate'
import type { KvmISO } from '@nimotech/nimoos-service'

const HOST = { cpuCores: 6, availableMemoryMB: 9234, availableDiskGB: 263, networkInterfaces: [], defaultDiskSize: 20 }
const OS = (over: Partial<KvmISO> = {}): KvmISO => ({
  id: 'alpine-319', name: 'Alpine', version: '3.19', category: 'linux', size: '60 MB',
  status: 'downloaded', progress: 0, path: '/DATA/KVM/isos/alpine-319.iso',
  recommendedVcpu: 1, recommendedMemory: 512, minMemory: 256, minDisk: 2, ...over,
})
const F = (over: Partial<CreateVmForm> = {}): CreateVmForm => ({
  name: 'test-vm', vcpu: 2, memory: 1024, disk: 8, iso: '/DATA/KVM/isos/alpine-319.iso',
  os: 'Alpine', osType: 'linux', networkMode: 'nat', firmware: 'bios', ...over,
})

describe('validateCreateVm', () => {
  it('全部合法返回 null', () => {
    expect(validateCreateVm(F(), OS(), HOST)).toBeNull()
  })
  it('名字空白 → kvmErrNoName(照 Vue2 :1451)', () => {
    expect(validateCreateVm(F({ name: '   ' }), OS(), HOST)?.key).toBe('kvmErrNoName')
  })
  it('没选 OS → kvmErrNoOs(照 Vue2 :1454)', () => {
    expect(validateCreateVm(F(), null, HOST)?.key).toBe('kvmErrNoOs')
  })

  // ⚠️ 这条是「改正确」:Vue2 只判 os.minDisk(:1458),alpine-319.minDisk=2 会放行
  // disk=2,而后端 vm_service.go:286-310 硬要求 disk>=8,请求必被拒。取 max(8, minDisk)。
  it('磁盘下限取 max(8, os.minDisk) —— minDisk=2 时仍要求 8', () => {
    const r = validateCreateVm(F({ disk: 4 }), OS({ minDisk: 2 }), HOST)
    expect(r).toEqual({ key: 'kvmErrDiskMin', arg: '8 GB' })
    expect(validateCreateVm(F({ disk: 8 }), OS({ minDisk: 2 }), HOST)).toBeNull()
  })
  it('minDisk 大于 8 时以 minDisk 为准', () => {
    expect(validateCreateVm(F({ disk: 20 }), OS({ minDisk: 60 }), HOST))
      .toEqual({ key: 'kvmErrDiskMin', arg: '60 GB' })
  })

  it('内存低于 os.minMemory → kvmErrMemoryMin(照 Vue2 :1461)', () => {
    expect(validateCreateVm(F({ memory: 128 }), OS({ minMemory: 256 }), HOST))
      .toEqual({ key: 'kvmErrMemoryMin', arg: '256 MB' })
  })
  it('磁盘超可用 → kvmErrDiskMax(照 Vue2 :1464)', () => {
    expect(validateCreateVm(F({ disk: 999 }), OS(), HOST))
      .toEqual({ key: 'kvmErrDiskMax', arg: '263 GB' })
  })
  it('内存超可用 → kvmErrMemoryMax,单位按 formatHostMem 换 GB(照 Vue2 :1467,:1649)', () => {
    expect(validateCreateVm(F({ memory: 99999 }), OS(), HOST))
      .toEqual({ key: 'kvmErrMemoryMax', arg: '9.0 GB' })
  })
  it('vCPU 超核心数 → kvmErrVcpuMax(照 Vue2 :1470)', () => {
    expect(validateCreateVm(F({ vcpu: 8 }), OS(), HOST))
      .toEqual({ key: 'kvmErrVcpuMax', arg: '6' })
  })
  it('host 值为 0(settings 还没回来)时不拿 0 当上限拒人(照 Vue2 的真值判断)', () => {
    const empty = { cpuCores: 0, availableMemoryMB: 0, availableDiskGB: 0, networkInterfaces: [], defaultDiskSize: 0 }
    expect(validateCreateVm(F(), OS(), empty)).toBeNull()
  })
  it('校验顺序照 Vue2:名字 → OS → 磁盘下限 → 内存下限 → 三个上限', () => {
    // 名字空 + 磁盘也不合法 → 先报名字
    expect(validateCreateVm(F({ name: '', disk: 1 }), OS(), HOST)?.key).toBe('kvmErrNoName')
  })
})
```

✅ `formatHostMem` 已核实(2026-08-03 读 `KVMFullPage.vue:1649-1652`):`!mb → '0 MB'`,否则 `mb >= 1024 ? (mb/1024).toFixed(1)+' GB' : mb+' MB'`。所以 `9234 → '9.0 GB'`,上面那条断言成立。**P5 已经把它搬进 `src/kvm/util/format.ts:17`(`export const formatHostMem = formatRam`),直接 import,不要重写。**

- [ ] **Step 3: 跑测试确认失败,然后实现两个 util**

`pnpm vitest run src/kvm/util/isoMatch.test.ts src/kvm/util/createVmValidate.test.ts` → FAIL。实现后转绿。

- [ ] **Step 4: 变异验证**

把 `createVmValidate` 里的 `Math.max(8, os.minDisk)` 改回 `os.minDisk`,确认「minDisk=2 时仍要求 8」那条**精确翻红**;改回来。

- [ ] **Step 5: 任务门 + 提交**

```bash
pnpm vitest run src/kvm/ && pnpm exec vue-tsc --noEmit
git add src/kvm/util/isoMatch.ts src/kvm/util/isoMatch.test.ts src/kvm/util/createVmValidate.ts src/kvm/util/createVmValidate.test.ts
git commit src/kvm/util/isoMatch.ts src/kvm/util/isoMatch.test.ts src/kvm/util/createVmValidate.ts src/kvm/util/createVmValidate.test.ts -m "feat(kvm): ISO 匹配/大小格式化/分类过滤 + 创建校验纯函数(磁盘下限改 max(8,minDisk))"
```

---

## Task 4: `useIsoList` —— ISO 列表 + 三个下载事件

**Files:**
- Create: `src/kvm/composables/useIsoList.ts` + `.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `filterByCategory`
- Produces:
  ```ts
  export interface IsoRow extends KvmISO {
    _downloading: boolean; _downloaded: boolean; _progress: number; _downloadedBytes: number
  }
  export function useIsoList(): {
    isos: Ref<IsoRow[]>
    isLoading: Ref<boolean>
    fetch(): Promise<void>
    download(id: string): Promise<void>
    /** 下载完成 / 失败时通知视图层弹 toast(composable 自己不碰 toast,同 P5 约定)。 */
    onDownloadDone(cb: (row: IsoRow) => void): void
    onDownloadFailed(cb: (row: IsoRow) => void): void
    dispose(): void
  }
  ```

- [ ] **Step 1: 写失败测试**

```ts
// src/kvm/composables/useIsoList.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useIsoList } from './useIsoList'

const api = { getISOList: vi.fn(), downloadISO: vi.fn() }
vi.mock('@nimotech/nimoos-service', () => ({ service: { get kvm() { return api } } }))

// MessageBus 假实现:能手动派发事件、能断言退订。
const handlers: Record<string, ((props: unknown) => void)[]> = {}
const offCalls: string[] = []
vi.mock('../../composables/useMessageBus', () => ({
  useMessageBus: () => ({
    on(ev: string, cb: (p: unknown) => void) {
      ;(handlers[ev] ||= []).push(cb)
      return () => { offCalls.push(ev); handlers[ev] = handlers[ev].filter((h) => h !== cb) }
    },
  }),
}))
const fire = (ev: string, props: unknown) => (handlers[ev] || []).forEach((h) => h(props))

// 真机 curl 的两条(alpine 已下载带 path,debian 可下载无 path)。
const LIST = [
  { id: 'alpine-319', name: 'Alpine', version: '3.19', category: 'linux', size: '60 MB', status: 'downloaded', progress: 0, path: '/DATA/KVM/isos/alpine-319.iso', recommendedVcpu: 1, recommendedMemory: 512, minMemory: 256, minDisk: 2 },
  { id: 'debian-13', name: 'Debian', version: '13 (Trixie)', category: 'linux', size: '676 MB', status: 'available', progress: 0, recommendedVcpu: 2, recommendedMemory: 2048, minMemory: 512, minDisk: 8 },
]

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
  Object.keys(handlers).forEach((k) => delete handlers[k])
  offCalls.length = 0
  api.getISOList.mockResolvedValue(LIST)
  api.downloadISO.mockResolvedValue(undefined)
})

describe('useIsoList', () => {
  it('fetch 把 status 映射成 _downloaded / _downloading(照 Vue2 :236-241)', async () => {
    const s = useIsoList(); await s.fetch()
    expect(s.isos.value[0]).toMatchObject({ id: 'alpine-319', _downloaded: true, _downloading: false })
    expect(s.isos.value[1]).toMatchObject({ id: 'debian-13', _downloaded: false, _downloading: false })
  })

  it('status=downloading 时继承 progress(重开弹窗要能看到已有进度)', async () => {
    api.getISOList.mockResolvedValue([{ ...LIST[1], status: 'downloading', progress: 42 }])
    const s = useIsoList(); await s.fetch()
    expect(s.isos.value[0]).toMatchObject({ _downloading: true, _progress: 42 })
  })

  it('download 先乐观置 _downloading 再发请求(body 是 {id},共享包已封)', async () => {
    const s = useIsoList(); await s.fetch()
    const p = s.download('debian-13')
    expect(s.isos.value[1]._downloading).toBe(true)
    expect(s.isos.value[1]._progress).toBe(0)
    await p
    expect(api.downloadISO).toHaveBeenCalledWith('debian-13')
  })

  it('download 请求失败只记日志、不回滚 _downloading(照 Vue2 :282-284)', async () => {
    api.downloadISO.mockRejectedValue(new Error('nope'))
    const s = useIsoList(); await s.fetch()
    await s.download('debian-13')
    expect(s.isos.value[1]._downloading).toBe(true)
  })

  it('progress 事件更新进度与已下载字节(载荷在 Properties,useMessageBus 已剥)', async () => {
    const s = useIsoList(); await s.fetch()
    await s.download('debian-13')
    fire('kvm:iso_download_progress', { iso_id: 'debian-13', progress: '37.5', downloaded: '1048576' })
    expect(s.isos.value[1]._progress).toBe(37.5)
    expect(s.isos.value[1]._downloadedBytes).toBe(1048576)
  })

  it('progress 事件只对正在下载的条目生效(照 Vue2 :153 的 _downloading 守卫)', async () => {
    const s = useIsoList(); await s.fetch()
    fire('kvm:iso_download_progress', { iso_id: 'debian-13', progress: '37.5' })
    expect(s.isos.value[1]._progress).toBe(0)
  })

  it('progress 事件里 iso_id 缺失或 progress 不是数字时整条忽略', async () => {
    const s = useIsoList(); await s.fetch()
    await s.download('debian-13')
    fire('kvm:iso_download_progress', { progress: '50' })
    fire('kvm:iso_download_progress', { iso_id: 'debian-13', progress: 'abc' })
    expect(s.isos.value[1]._progress).toBe(0)
  })

  it('complete 事件置 _downloaded 并回调(视图层据此弹 toast)', async () => {
    const s = useIsoList(); await s.fetch()
    const done: string[] = []
    s.onDownloadDone((row) => done.push(row.name))
    await s.download('debian-13')
    fire('kvm:iso_download_complete', { iso_id: 'debian-13' })
    expect(s.isos.value[1]).toMatchObject({ _downloading: false, _downloaded: true, _progress: 100 })
    expect(done).toEqual(['Debian'])
  })

  it('failed 事件清 _downloading 并回调', async () => {
    const s = useIsoList(); await s.fetch()
    const failed: string[] = []
    s.onDownloadFailed((row) => failed.push(row.id))
    await s.download('debian-13')
    fire('kvm:iso_download_failed', { iso_id: 'debian-13' })
    expect(s.isos.value[1]._downloading).toBe(false)
    expect(failed).toEqual(['debian-13'])
  })

  it('dispose 退订三个事件', () => {
    const s = useIsoList(); s.dispose()
    expect(offCalls.sort()).toEqual([
      'kvm:iso_download_complete', 'kvm:iso_download_failed', 'kvm:iso_download_progress',
    ])
  })

  it('dispose 后 fetch 落定不写 state(过期守卫;交错路径)', async () => {
    let release: (v: unknown) => void = () => {}
    api.getISOList.mockReturnValue(new Promise((r) => { release = r }))
    const s = useIsoList()
    const p = s.fetch()
    s.dispose()
    release(LIST)
    await p
    expect(s.isos.value).toEqual([])
  })

  it('dispose 后事件到达不再写 state', async () => {
    const s = useIsoList(); await s.fetch()
    await s.download('debian-13')
    s.dispose()
    fire('kvm:iso_download_complete', { iso_id: 'debian-13' })
    expect(s.isos.value[1]._downloaded).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现 `useIsoList.ts`**

要点(**文件头注释必须写清为什么这层在页面级**):

```ts
// ISO 模板列表 + 下载进度。**必须由 KvmPage 创建、随页面生命周期存活**,不能挂在
// OsSelector 组件里 —— Vue2 的 OSSelector 是常驻挂载的(`v-if="visible"` 写在它自己的
// 根节点上,组件实例一直活着),所以它的 sockets 一直在收下载进度:关掉弹窗、下载照样
// 推进。New-UI 若照直觉写 `v-if="showOSSelector"` 卸载组件,进度就断了。
// 顺带合掉 Vue2「GET /isos 拉两遍」的浪费(mounted 拉一次喂 osTemplates、开弹窗再拉
// 一次喂 osList)—— 已申报偏离,spec §6.2.5 第 2 条。
```

- 三个事件名写常量:`kvm:iso_download_progress` / `_complete` / `_failed`(后端 `NimoOS-KVM/common/constants.go:24-26`)。
- 载荷字段 `iso_id` / `progress` / `downloaded`;`useMessageBus` 已经把 `Properties` 剥掉了,直接取。`parseFloat` 后 `Number.isNaN` 判断。
- **不轮询** `getISODownloadProgress`(spec §1.15 #4:Vue2 从未调用它)。
- 过期守卫:`let alive = true`,`dispose()` 置 false 并调三个退订函数;每个事件回调与 `fetch`/`download` 的 `await` 之后先判 `alive`。

- [ ] **Step 4: 变异验证 + 任务门 + 提交**

去掉 progress 事件里的 `_downloading` 守卫 → 「只对正在下载的条目生效」那条必红;去掉 `alive` 判断 → 两条 dispose 用例必红。恢复后:

```bash
pnpm vitest run src/kvm/ && pnpm exec vue-tsc --noEmit
git add src/kvm/composables/useIsoList.ts src/kvm/composables/useIsoList.test.ts
git commit src/kvm/composables/useIsoList.ts src/kvm/composables/useIsoList.test.ts -m "feat(kvm): useIsoList —— ISO 列表 + 三个下载事件(页面级,不随弹窗卸载)"
```

---

## Task 5: `OsSelector.vue` 官方模板半

**Files:**
- Create: `src/kvm/components/OsSelector.vue` + `.test.ts`
- Modify: `src/kvm/styles/kvm.css`(OSSelector 分类 + 卡片网格两段)

**Interfaces:**
- Consumes: Task 1 `KvmDialog` · Task 3 `filterByCategory` · Task 4 `IsoRow` · P5 既有 `osIconFor`(`src/kvm/util/format.ts`)
- Produces:
  ```ts
  // props
  { open: boolean; isos: IsoRow[] }
  // emits
  { 'update:open': [v: boolean]
    select: [os: SelectedOs]          // 官方模板选中
    download: [id: string]
    'need-wait': [] }                 // 点了正在下载的卡片 → 视图层弹「请等待下载完成」
  // 类型(放在 OsSelector.vue 里 export,Task 7/8 消费)
  export interface SelectedOs {
    isLocal: boolean; id: string; name: string; path: string
    size?: number
    recommendedVcpu?: number; recommendedMemory?: number; minMemory?: number; minDisk?: number
  }
  ```

- [ ] **Step 1: 写失败测试**

```ts
// src/kvm/components/OsSelector.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import OsSelector from './OsSelector.vue'
import { i18n } from '../../i18n'
import type { IsoRow } from '../composables/useIsoList'

vi.mock('../composables/useIsoBrowser', () => ({
  useIsoBrowser: () => ({
    path: { value: '/' }, items: { value: [] }, isLoading: { value: false },
    fetch: vi.fn(), up: vi.fn(), dispose: vi.fn(),
  }),
}))

const ROW = (over: Partial<IsoRow> = {}): IsoRow => ({
  id: 'debian-13', name: 'Debian', version: '13 (Trixie)', category: 'linux', size: '676 MB',
  status: 'available', progress: 0, recommendedVcpu: 2, recommendedMemory: 2048,
  minMemory: 512, minDisk: 8,
  _downloading: false, _downloaded: false, _progress: 0, _downloadedBytes: 0, ...over,
})
const ALPINE = ROW({ id: 'alpine-319', name: 'Alpine', category: 'linux', status: 'downloaded', path: '/DATA/KVM/isos/alpine-319.iso', _downloaded: true, minDisk: 2 })
const WIN = ROW({ id: 'win10', name: 'Windows 10', category: 'windows', minDisk: 60 })

let w: VueWrapper | null = null
const mk = (isos: IsoRow[] = [ROW(), ALPINE, WIN]) => {
  w = mount(OsSelector, { props: { open: true, isos }, global: { plugins: [i18n] }, attachTo: document.body })
  return w
}
afterEach(() => { w?.unmount(); w = null; document.body.innerHTML = '' })
const qa = (sel: string) => [...document.body.querySelectorAll(sel)] as HTMLElement[]

describe('OsSelector 官方模板半', () => {
  it('四个分类按钮,默认 all 高亮', () => {
    mk()
    const btns = qa('.category-btn')
    expect(btns.map((b) => b.textContent?.trim())).toEqual(['全部', 'Windows', 'Linux', 'BSD'])
    expect(btns[0].classList.contains('active')).toBe(true)
  })

  it('点 Windows 只留 windows 分类的卡片', async () => {
    const wr = mk()
    qa('.category-btn')[1].click(); await wr.vm.$nextTick()
    expect(qa('.os-card')).toHaveLength(1)
    expect(qa('.os-name')[0].textContent).toContain('Windows 10')
  })

  it('卡片显示名/版本/大小,已下载的带 is-downloaded 类', () => {
    mk()
    const cards = qa('.os-card')
    expect(cards[1].classList.contains('is-downloaded')).toBe(true)
    expect(cards[1].textContent).toContain('Alpine')
    expect(cards[1].textContent).toContain('3.19')
    expect(cards[1].textContent).toContain('676 MB'.length ? '60 MB' : '')
  })

  it('按钮三态:未下载=下载 / 已下载=选择 / 下载中=两位小数百分比(照 Vue2 :257-265)', () => {
    mk([ROW(), ALPINE, ROW({ id: 'ubuntu-2404', name: 'Ubuntu', _downloading: true, _progress: 37.456 })])
    const texts = qa('.os-action-btn').map((b) => b.textContent?.trim())
    expect(texts[0]).toBe('下载')
    expect(texts[1]).toBe('选择')
    expect(texts[2]).toBe('37.46%')
  })

  it('点未下载的卡片按钮 emit download(id)', async () => {
    const wr = mk()
    qa('.os-action-btn')[0].click(); await wr.vm.$nextTick()
    expect(wr.emitted('download')).toEqual([['debian-13']])
  })

  it('点已下载的卡片按钮 emit select,path 是宿主机绝对路径、isLocal=false', async () => {
    const wr = mk()
    qa('.os-action-btn')[1].click(); await wr.vm.$nextTick()
    expect(wr.emitted('select')![0][0]).toMatchObject({
      isLocal: false, id: 'alpine-319', name: 'Alpine',
      path: '/DATA/KVM/isos/alpine-319.iso', minDisk: 2,
    })
  })

  it('选中后弹窗关闭(照 Vue2 selectOS → close)', async () => {
    const wr = mk()
    qa('.os-action-btn')[1].click(); await wr.vm.$nextTick()
    expect(wr.emitted('update:open')).toEqual([[false]])
  })

  it('点正在下载的卡片按钮 emit need-wait,不 emit select/download', async () => {
    const wr = mk([ROW({ _downloading: true, _progress: 10 })])
    qa('.os-action-btn')[0].click(); await wr.vm.$nextTick()
    expect(wr.emitted('need-wait')).toHaveLength(1)
    expect(wr.emitted('select')).toBeUndefined()
    expect(wr.emitted('download')).toBeUndefined()
  })

  it('已下载但后端没给 path 时不 emit select(后端契约:path 只在 downloaded 时出现)', async () => {
    const wr = mk([ROW({ _downloaded: true, path: undefined })])
    qa('.os-action-btn')[0].click(); await wr.vm.$nextTick()
    expect(wr.emitted('select')).toBeUndefined()
  })
})
```

⚠️ 第 3 条用例里那句 `'676 MB'.length ? '60 MB' : ''` 是笔误式写法,**实现时改成直白的 `expect(cards[1].textContent).toContain('60 MB')`**。

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现 `OsSelector.vue`**

- 套 `KvmDialog`,`:z-base="920"`(叠在创建弹窗之上)、`title = t('kvmSelectOsTitle')`、`width="40rem"`。
- 分类:本地 `ref('all')`,四项常量 `[{key:'all',label:'kvmCatAll'}, ...]`,渲染成 `.category-btn`(`active` 类)。Vue2 用 `b-button :type="is-primary|is-light"`,New-UI 自绘 —— 登记容器偏离。
- 卡片:`filterByCategory(isos, cat)` → `.os-card`(`is-downloaded` / `is-downloading` 类)+ `.os-icon-wrapper > img :src="osIconFor(os.id)"`(**P5 已有 `osIconFor`,别再造一个 iconMap**)+ `.os-info`(name/version/size)+ `.os-action-btn`。
- 按钮文案/类三态照 Vue2 `:251-265`:已下载 → `is-selected` + `t('kvmSelect')`;下载中 → `is-downloading-btn` + `` `${_progress.toFixed(2)}%` ``;否则 `is-download` + `t('kvmDownload')`。**不照抄 `${mb}MB` 分支**(死代码,spec §1.15)。
- 点击派发照 Vue2 `handleOSAction` `:267-275`,外加 `path` 缺失守卫(**Vue2 没有这层**:`path` 是 `omitempty`,只有 `status==='downloaded'` 才出现;真出现「已下载但无 path」时 Vue2 会把 `iso: undefined` 发给后端换来 400。改正确并注释登记)。
- 自定义区在 Task 6 接进来,本任务先在模板里留 `<!-- Task 6: 自定义区 -->` 占位。

CSS 照 `OSSelector.vue:426-562`(`.os-selector-body` `.category-filter` `.category-btn` `.os-section` `.os-grid` `.os-card` `.os-icon-wrapper` `.os-info` `.os-action-btn` 及三个态)+ `:697-701` 的 768px 媒体查询。**不搬 `.os-progress-wrap`**(Vue2 模板里零命中,死 CSS)。

- [ ] **Step 4: 任务门 + 提交**

```bash
pnpm vitest run src/kvm/
pnpm vitest run src/styles/color-guard.test.ts src/styles/theme.sp9.test.ts src/kvm/styles/kvmStyles.test.ts src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit
git add src/kvm/components/OsSelector.vue src/kvm/components/OsSelector.test.ts src/kvm/styles/kvm.css
git commit src/kvm/components/OsSelector.vue src/kvm/components/OsSelector.test.ts src/kvm/styles/kvm.css -m "feat(kvm): OsSelector 官方模板半(分类过滤 + 卡片网格 + 下载三态)"
```

---

## Task 6: `IsoBrowser` 自定义区(本地 ISO 浏览)

**Files:**
- Create: `src/kvm/composables/useIsoBrowser.ts` + `.test.ts`
- Create: `src/kvm/components/IsoBrowser.vue` + `.test.ts`
- Modify: `src/kvm/components/OsSelector.vue` + `.test.ts`(接进自定义区)
- Modify: `src/kvm/styles/kvm.css`(custom-* 一段)

**Interfaces:**
- Consumes: Task 3 `isIsoFile` / `formatFileSize` / `matchTemplateByFilename` · Task 5 `SelectedOs`
- Produces:
  ```ts
  // useIsoBrowser.ts
  export function useIsoBrowser(): {
    path: Ref<string>; items: Ref<FolderEntry[]>; isLoading: Ref<boolean>
    fetch(path: string): Promise<void>
    up(): Promise<void>
    dispose(): void
  }
  // IsoBrowser.vue
  // props { isos: IsoRow[] }   emits { select: [os: SelectedOs] }
  ```

- [ ] **Step 1: 写 `useIsoBrowser` 的失败测试**

```ts
// src/kvm/composables/useIsoBrowser.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useIsoBrowser } from './useIsoBrowser'

const api = { getList: vi.fn() }
vi.mock('@nimotech/nimoos-service', () => ({ service: { get folder() { return api } } }))

// 真机 2026-08-03 `GET /v1/folder?path=/DATA` 的形状(逐字,含 size)。
const LISTING = { content: [
  { name: '.system_data', path: '/DATA/.system_data', is_dir: true, is_symlink: false, size: 4096 },
  { name: 'Amalfi Coast', path: '/DATA/Amalfi Coast', is_dir: true, is_symlink: false, size: 4096 },
  { name: '.wiki.md', path: '/DATA/.wiki.md', is_dir: false, is_symlink: false, size: 2558 },
  { name: 'alpine-319.iso', path: '/DATA/alpine-319.iso', is_dir: false, is_symlink: false, size: 62914560 },
] }

beforeEach(() => { api.getList.mockReset(); api.getList.mockResolvedValue(LISTING) })

describe('useIsoBrowser', () => {
  it('只保留目录与 .iso(照 Vue2 :310-313)', async () => {
    const s = useIsoBrowser(); await s.fetch('/DATA')
    expect(s.items.value.map((i) => i.name)).toEqual(['.system_data', 'Amalfi Coast', 'alpine-319.iso'])
    expect(s.path.value).toBe('/DATA')
  })

  it('请求期间 isLoading 为真、结束转假', async () => {
    let release: (v: unknown) => void = () => {}
    api.getList.mockReturnValue(new Promise((r) => { release = r }))
    const s = useIsoBrowser()
    const p = s.fetch('/DATA')
    expect(s.isLoading.value).toBe(true)
    release(LISTING); await p
    expect(s.isLoading.value).toBe(false)
  })

  it('失败时保留原 path、items 不变、isLoading 归位(照 Vue2 只 console.warn)', async () => {
    const s = useIsoBrowser(); await s.fetch('/DATA')
    api.getList.mockRejectedValue(new Error('EACCES'))
    await s.fetch('/DATA/secret')
    expect(s.path.value).toBe('/DATA')
    expect(s.items.value).toHaveLength(3)
    expect(s.isLoading.value).toBe(false)
  })

  it('up 退到父目录;根目录再 up 仍是根(照 Vue2 :323-326)', async () => {
    const s = useIsoBrowser(); await s.fetch('/DATA/Amalfi Coast')
    await s.up()
    expect(api.getList).toHaveBeenLastCalledWith('/DATA')
    await s.fetch('/'); await s.up()
    expect(api.getList).toHaveBeenLastCalledWith('/')
  })

  it('后到先得:两次 fetch 交错落定时,后发起的那次赢(过期守卫)', async () => {
    const rs: ((v: unknown) => void)[] = []
    api.getList.mockImplementation(() => new Promise((r) => { rs.push(r) }))
    const s = useIsoBrowser()
    const p1 = s.fetch('/A')
    const p2 = s.fetch('/B')
    rs[1]({ content: [{ name: 'b.iso', path: '/B/b.iso', is_dir: false, is_symlink: false, size: 1 }] })
    rs[0]({ content: [{ name: 'a.iso', path: '/A/a.iso', is_dir: false, is_symlink: false, size: 1 }] })
    await Promise.all([p1, p2])
    expect(s.path.value).toBe('/B')
    expect(s.items.value.map((i) => i.name)).toEqual(['b.iso'])
  })

  it('dispose 后落定不写 state', async () => {
    let release: (v: unknown) => void = () => {}
    api.getList.mockReturnValue(new Promise((r) => { release = r }))
    const s = useIsoBrowser()
    const p = s.fetch('/DATA')
    s.dispose(); release(LISTING); await p
    expect(s.items.value).toEqual([])
  })
})
```

> ⚠️ 「后到先得」这条是**改正确**:Vue2 没有任何守卫,快速点两层目录时先发的响应后到会把 `customPath` / `customItems` 覆盖成上一层的内容(路径显示与列表内容错位)。用代际计数器(`let gen = 0`,每次 `fetch` 自增并在写 state 前比对),注释登记。

- [ ] **Step 2: 实现 `useIsoBrowser.ts`,跑测试转绿**

- [ ] **Step 3: 写 `IsoBrowser.vue` 的失败测试**

```ts
// src/kvm/components/IsoBrowser.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import IsoBrowser from './IsoBrowser.vue'
import { i18n } from '../../i18n'

const items = { value: [] as unknown[] }
const isLoading = { value: false }
const path = { value: '/' }
const fetchFn = vi.fn(); const upFn = vi.fn()
vi.mock('../composables/useIsoBrowser', () => ({
  useIsoBrowser: () => ({ path, items, isLoading, fetch: fetchFn, up: upFn, dispose: vi.fn() }),
}))

const ISOS = [{ id: 'win11', name: 'Windows 11', version: '24H2', category: 'windows', size: '5.8 GB', status: 'available', progress: 0, recommendedVcpu: 2, recommendedMemory: 8192, minMemory: 4096, minDisk: 60, _downloading: false, _downloaded: false, _progress: 0, _downloadedBytes: 0 }]

let w: VueWrapper | null = null
const mk = () => {
  w = mount(IsoBrowser, { props: { isos: ISOS as never }, global: { plugins: [i18n] } })
  return w
}
afterEach(() => { w?.unmount(); w = null; items.value = []; isLoading.value = false; path.value = '/'; fetchFn.mockReset(); upFn.mockReset() })

describe('IsoBrowser', () => {
  it('默认收起,点标题条展开并拉根目录(照 Vue2 :56-60 + :130-136)', async () => {
    const wr = mk()
    expect(wr.find('.custom-browse').exists()).toBe(false)
    await wr.get('.custom-divider').trigger('click')
    expect(wr.find('.custom-browse').exists()).toBe(true)
    expect(fetchFn).toHaveBeenCalledWith('/')
  })

  it('根目录时上一级按钮 disabled', async () => {
    const wr = mk(); await wr.get('.custom-divider').trigger('click')
    expect(wr.get('.custom-back-btn').attributes('disabled')).toBeDefined()
  })

  it('非根目录时上一级可点并调 up()', async () => {
    path.value = '/DATA'
    const wr = mk(); await wr.get('.custom-divider').trigger('click')
    await wr.get('.custom-back-btn').trigger('click')
    expect(upFn).toHaveBeenCalled()
  })

  it('空目录显示空态文案', async () => {
    const wr = mk(); await wr.get('.custom-divider').trigger('click')
    expect(wr.text()).toContain('此目录为空')
  })

  it('目录项显示名字与右箭头、点击进入;文件项显示大小、无箭头', async () => {
    items.value = [
      { name: 'KVM', path: '/DATA/KVM', is_dir: true, is_symlink: false, size: 4096 },
      { name: 'win11.iso', path: '/DATA/win11.iso', is_dir: false, is_symlink: false, size: 6227151974 },
    ]
    const wr = mk(); await wr.get('.custom-divider').trigger('click')
    const rows = wr.findAll('.custom-file-item')
    expect(rows[0].find('.custom-file-arrow').exists()).toBe(true)
    expect(rows[1].find('.custom-file-arrow').exists()).toBe(false)
    expect(rows[1].text()).toContain('5.8 GB')
    await rows[0].trigger('click')
    expect(fetchFn).toHaveBeenLastCalledWith('/DATA/KVM')
  })

  it('点 .iso 文件 emit select:isLocal=true,并按文件名反查出 win11 的推荐规格', async () => {
    items.value = [{ name: 'Win11_24H2.iso', path: '/DATA/Win11_24H2.iso', is_dir: false, is_symlink: false, size: 6227151974 }]
    const wr = mk(); await wr.get('.custom-divider').trigger('click')
    await wr.get('.custom-file-item').trigger('click')
    expect(wr.emitted('select')![0][0]).toMatchObject({
      isLocal: true, id: 'win11', name: 'Win11_24H2.iso', path: '/DATA/Win11_24H2.iso',
      recommendedVcpu: 2, recommendedMemory: 8192, minMemory: 4096, minDisk: 60,
    })
  })

  it('反查不到时 id 落 local、推荐规格全 undefined(照 Vue2 :350-357)', async () => {
    items.value = [{ name: 'haiku-r1.iso', path: '/DATA/haiku-r1.iso', is_dir: false, is_symlink: false, size: 1 }]
    const wr = mk(); await wr.get('.custom-divider').trigger('click')
    await wr.get('.custom-file-item').trigger('click')
    expect(wr.emitted('select')![0][0]).toMatchObject({ isLocal: true, id: 'local' })
    expect((wr.emitted('select')![0][0] as { minDisk?: number }).minDisk).toBeUndefined()
  })

  it('点非 .iso 文件什么都不做', async () => {
    items.value = [{ name: 'readme.txt', path: '/DATA/readme.txt', is_dir: false, is_symlink: false, size: 1 }]
    const wr = mk(); await wr.get('.custom-divider').trigger('click')
    // 过滤发生在 composable 层,这里模拟"漏进来"的情况,组件也不该派发
    await wr.get('.custom-file-item').trigger('click')
    expect(wr.emitted('select')).toBeUndefined()
  })
})
```

- [ ] **Step 4: 实现 `IsoBrowser.vue` + 接进 `OsSelector`**

- 模板照 `OSSelector.vue:54-93`:`.custom-divider`(可点标题条 + `▾`/`▴` 单色符号 + `aria-label="t('kvmToggleCustom')"`)· `.custom-browse` > `.custom-breadcrumb`(`.custom-back-btn` 带 `aria-label="t('kvmParentDir')"` + `.custom-path`)· `.custom-file-list`(loading / empty / 条目)。
- 图标:目录用 `▣`、`.iso` 用 `osIconFor(item.name)`、其它用 `▤`(单色符号占位,同 P5 惯例)。
- `OsSelector.vue` 把 Task 5 留的占位换成 `<IsoBrowser :isos="isos" @select="onLocalSelect" />`,`onLocalSelect` 转发 `emit('select', os)` + `emit('update:open', false)`。`OsSelector.test.ts` 补一条「自定义区选中本地 ISO 也会关弹窗并透传 select」。

CSS 照 `OSSelector.vue:564-695`。

- [ ] **Step 5: 任务门 + 提交**

```bash
pnpm vitest run src/kvm/
pnpm vitest run src/styles/color-guard.test.ts src/styles/theme.sp9.test.ts src/kvm/styles/kvmStyles.test.ts src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit
git add src/kvm/composables/useIsoBrowser.ts src/kvm/composables/useIsoBrowser.test.ts src/kvm/components/IsoBrowser.vue src/kvm/components/IsoBrowser.test.ts src/kvm/components/OsSelector.vue src/kvm/components/OsSelector.test.ts src/kvm/styles/kvm.css
git commit src/kvm/composables/useIsoBrowser.ts src/kvm/composables/useIsoBrowser.test.ts src/kvm/components/IsoBrowser.vue src/kvm/components/IsoBrowser.test.ts src/kvm/components/OsSelector.vue src/kvm/components/OsSelector.test.ts src/kvm/styles/kvm.css -m "feat(kvm): IsoBrowser 自定义区(目录浏览 + 本地 ISO 反查模板 + 后到先得守卫)"
```

---

## Task 7: `CreateVmDialog.vue` 创建表单

**Files:**
- Create: `src/kvm/components/CreateVmDialog.vue` + `.test.ts`
- Modify: `src/kvm/styles/kvm.css`(`.cv-iso-btn` / `.cv-cpu-group` / `.cv-select` / `.cv-firmware-group` 四段)

**Interfaces:**
- Consumes: Task 1 `KvmDialog` · Task 2 `KvmHostReadonly` / `KvmWritableSettings` · Task 3 `validateCreateVm` / `osTemplateDefaults` · Task 5 `SelectedOs`
- Produces:
  ```ts
  // props { open: boolean; host: KvmHostReadonly; defaults: KvmWritableSettings
  //         isos: IsoRow[]; selectedOs: SelectedOs | null; creating: boolean; submitError: string }
  // emits { 'update:open': [v: boolean]
  //         'open-os-selector': []
  //         submit: [payload: KvmCreateVMRequest] }
  ```
  ⚠️ 表单状态在组件内部;`selectedOs` 由父组件持有(OsSelector 是父组件挂的,选中结果要同时喂创建弹窗与 VM 设置弹窗)。

- [ ] **Step 1: 写失败测试**

```ts
// src/kvm/components/CreateVmDialog.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import CreateVmDialog from './CreateVmDialog.vue'
import { i18n } from '../../i18n'
import type { SelectedOs } from './OsSelector.vue'

const HOST = { cpuCores: 6, availableMemoryMB: 9234, availableDiskGB: 263, networkInterfaces: ['enp2s0', 'wlp1s0'], defaultDiskSize: 20 }
const DEFAULTS = { storagePath: '/DATA/KVM', defaultVcpu: 2, defaultMemory: 2048, autostart: false }
const OS = (over: Partial<SelectedOs> = {}): SelectedOs => ({
  isLocal: false, id: 'alpine-319', name: 'Alpine', path: '/DATA/KVM/isos/alpine-319.iso',
  recommendedVcpu: 1, recommendedMemory: 512, minMemory: 256, minDisk: 2, ...over,
})

let w: VueWrapper | null = null
const mk = (props: Record<string, unknown> = {}) => {
  w = mount(CreateVmDialog, {
    props: { open: true, host: HOST, defaults: DEFAULTS, isos: [], selectedOs: null, creating: false, submitError: '', ...props },
    global: { plugins: [i18n] }, attachTo: document.body,
  })
  return w
}
afterEach(() => { w?.unmount(); w = null; document.body.innerHTML = '' })
const q = (s: string) => document.body.querySelector(s) as HTMLElement
const qa = (s: string) => [...document.body.querySelectorAll(s)] as HTMLElement[]
const setVal = async (wr: VueWrapper, sel: string, v: string) => {
  const el = q(sel) as HTMLInputElement
  el.value = v; el.dispatchEvent(new Event('input')); await wr.vm.$nextTick()
}

describe('CreateVmDialog', () => {
  it('标题「创建新虚拟机」,ISO 行未选时显示占位文案', () => {
    mk()
    expect(q('.create-vm-title').textContent).toContain('创建新虚拟机')
    expect(q('.cv-iso-btn').textContent).toContain('选择 ISO 镜像')
  })

  it('CPU 核心格子数 = host.cpuCores(真机 6 个),n<=vcpu 的高亮', async () => {
    const wr = mk(); await wr.vm.$nextTick()
    const cells = qa('.cv-cpu-btn')
    expect(cells).toHaveLength(6)
    expect(cells.filter((c) => c.classList.contains('active')).length).toBe(2) // defaultVcpu=2
    cells[3].click(); await wr.vm.$nextTick()
    expect(qa('.cv-cpu-btn').filter((c) => c.classList.contains('active')).length).toBe(4)
  })

  it('host.cpuCores=0(settings 还没回来)时不渲染格子(spec §12 #6,不闪 16 个)', () => {
    mk({ host: { ...HOST, cpuCores: 0 } })
    expect(qa('.cv-cpu-btn')).toHaveLength(0)
  })

  it('网络下拉 = NAT + 每张网卡一项「桥接到 xxx」', () => {
    mk()
    const opts = qa('.cv-select-native option').map((o) => o.textContent?.trim())
    expect(opts).toEqual(['NAT', '桥接到 enp2s0', '桥接到 wlp1s0'])
  })

  it('打开时按全局默认预填 vcpu/memory,磁盘用 defaultDiskSize(照 Vue2 :1155-1188)', async () => {
    const wr = mk(); await wr.vm.$nextTick()
    expect((q('input[name="memory"]') as HTMLInputElement).value).toBe('2048')
    expect((q('input[name="disk"]') as HTMLInputElement).value).toBe('20')
  })

  it('点 ISO 行 emit open-os-selector', async () => {
    const wr = mk(); q('.cv-iso-btn').click(); await wr.vm.$nextTick()
    expect(wr.emitted('open-os-selector')).toHaveLength(1)
  })

  it('选中 OS 后 ISO 行显示 path,并按推荐规格联动 vcpu/memory', async () => {
    const wr = mk()
    await wr.setProps({ selectedOs: OS({ recommendedVcpu: 4, recommendedMemory: 4096 }) })
    expect(q('.cv-iso-btn').textContent).toContain('/DATA/KVM/isos/alpine-319.iso')
    expect((q('input[name="memory"]') as HTMLInputElement).value).toBe('4096')
    expect(qa('.cv-cpu-btn').filter((c) => c.classList.contains('active')).length).toBe(4)
  })

  it('固件两按钮可切换(与 VM 设置弹窗里的 disabled 版不同)', async () => {
    const wr = mk(); await wr.vm.$nextTick()
    const [uefi, bios] = qa('.cv-firmware-btn')
    expect(bios.classList.contains('active')).toBe(true)
    uefi.click(); await wr.vm.$nextTick()
    expect(qa('.cv-firmware-btn')[0].classList.contains('active')).toBe(true)
  })

  it('「系统版本」下拉只在本地 ISO 时出现(照 Vue2 :476)', async () => {
    const wr = mk()
    expect(qa('select[name="osTemplate"]')).toHaveLength(0)
    await wr.setProps({ selectedOs: OS({ isLocal: true, id: 'local', name: 'custom.iso' }) })
    expect(qa('select[name="osTemplate"]')).toHaveLength(1)
  })

  it('校验失败时内联 .cv-error 显示文案 + 参数,不 emit submit(硬约束 7)', async () => {
    const wr = mk({ selectedOs: OS({ minDisk: 2 }) })
    await setVal(wr, 'input[name="disk"]', '4')
    q('.cv-primary-btn').click(); await wr.vm.$nextTick()
    expect(q('.cv-error').textContent).toContain('磁盘大小必须至少为 8 GB')
    expect(wr.emitted('submit')).toBeUndefined()
  })

  it('校验通过 emit submit,payload 不含 osTemplate / autostart(后端不认,spec §1.15)', async () => {
    const wr = mk({ selectedOs: OS() })
    await setVal(wr, 'input[name="name"]', 'p6-throwaway')
    await setVal(wr, 'input[name="disk"]', '8')
    q('.cv-primary-btn').click(); await wr.vm.$nextTick()
    const payload = wr.emitted('submit')![0][0] as Record<string, unknown>
    expect(payload).toEqual({
      name: 'p6-throwaway', vcpu: 2, memory: 512, disk: 8,
      iso: '/DATA/KVM/isos/alpine-319.iso', os: 'Alpine', osType: 'linux',
      networkMode: 'nat', networkInterface: '', firmware: 'bios',
    })
    expect(payload).not.toHaveProperty('osTemplate')
    expect(payload).not.toHaveProperty('autostart')
  })

  it('选了桥接网卡时 networkMode=bridge、networkInterface=网卡名(照 Vue2 :1478-1479)', async () => {
    const wr = mk({ selectedOs: OS() })
    await setVal(wr, 'input[name="name"]', 'x')
    await setVal(wr, 'input[name="disk"]', '8')
    const sel = q('.cv-select-native') as HTMLSelectElement
    sel.value = 'enp2s0'; sel.dispatchEvent(new Event('change')); await wr.vm.$nextTick()
    q('.cv-primary-btn').click(); await wr.vm.$nextTick()
    expect(wr.emitted('submit')![0][0]).toMatchObject({ networkMode: 'bridge', networkInterface: 'enp2s0' })
  })

  it('creating=true 时主按钮 is-loading 且点不动(防重复提交)', async () => {
    const wr = mk({ selectedOs: OS(), creating: true })
    expect(q('.cv-primary-btn').classList.contains('is-loading')).toBe(true)
    q('.cv-primary-btn').click(); await wr.vm.$nextTick()
    expect(wr.emitted('submit')).toBeUndefined()
  })

  it('submitError 由父组件传下来,显示在同一个 .cv-error 位', () => {
    mk({ submitError: 'domain name already exists' })
    expect(q('.cv-error').textContent).toContain('domain name already exists')
  })

  it('重新打开时表单复位(照 Vue2 showCreateVM 每次重建 newVM)', async () => {
    const wr = mk()
    await setVal(wr, 'input[name="name"]', 'dirty')
    await wr.setProps({ open: false }); await wr.setProps({ open: true })
    expect((q('input[name="name"]') as HTMLInputElement).value).toBe('')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现 `CreateVmDialog.vue`**

- 模板照 Vue2 `:396-494` 逐字段搬。输入框加 `name` 属性(测试选择器用,Vue2 靠 `b-input` 没有 name —— 纯测试钩子,注释说明)。
- `watch(() => props.open)`:true 时复位表单(`name:''`、`vcpu: defaults.defaultVcpu || 2`、`memory: defaults.defaultMemory || 2048`、`disk: host.defaultDiskSize || 32`、`networkMode:'nat'`、`firmware:'bios'`、`osTemplate:'generic-linux'`)。照 Vue2 `:1155-1188`,但**默认值来自 props 而不是自己再拉一次 `getSettings`**(父组件已经有 `useKvmHostInfo`,不重复请求 —— 登记)。
- `watch(() => props.selectedOs)`:照 Vue2 `onOSSelect` `:1376-1447` 的赋值部分 —— 填 `iso = os.path`、`os = os.isLocal ? os.name.replace(/\.iso$/i,'') : os.name`、按 `os.id` 定 `osTemplate`(取不到就用 `matchTemplateByFilename` 的结果,再不行按含 `win` 落 `generic-windows`/`generic-linux`)、有推荐值就覆盖 `vcpu`/`memory`,`minDisk` 存在时 `disk = Math.max((minDisk||8)*3, 20)`(照 `:1442`)。**不设 `autostart`**(后端不认)。
- `watch(() => form.osTemplate)`:照 Vue2 `:720-746`,用 Task 3 的 `osTemplateDefaults`。
- 提交:先 `validateCreateVm`,有错写 `localError.value = t(key) + (arg ? ' ' + arg : '')` 并 return;通过则 `emit('submit', payload)`,payload 只含后端 11 个字段中的这 10 个(`bootFromDisk` 不传,后端默认 false)。
- `.cv-error` 显示 `localError || props.submitError`。

CSS 照 Vue2 `.cv-iso-btn` `:2544-2567` · `.cv-cpu-group`/`.cv-cpu-btn` `:2609-2637` · `.cv-select`/`.cv-select-native`/`.cv-select-arrow` `:2638-2669` · `.cv-firmware-group`/`.cv-firmware-btn` `:2670-2701`。

> **`.cv-iso-eject` 不在本任务**(2026-08-03 Task 7 实现者指出、控制器确认):Vue2 的创建弹窗模板(`:409-418`)只有一个 ISO 路径按钮,**没有弹出/挂载按钮** —— 那对按钮只存在于 VM 设置弹窗(`:276-281`)。所以 `.cv-iso-eject` `:2573-2592` 的样式**归 Task 9 搬**。

- [ ] **Step 4: 任务门 + 提交**

```bash
pnpm vitest run src/kvm/
pnpm vitest run src/styles/color-guard.test.ts src/styles/theme.sp9.test.ts src/kvm/styles/kvmStyles.test.ts src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit
git add src/kvm/components/CreateVmDialog.vue src/kvm/components/CreateVmDialog.test.ts src/kvm/styles/kvm.css
git commit src/kvm/components/CreateVmDialog.vue src/kvm/components/CreateVmDialog.test.ts src/kvm/styles/kvm.css -m "feat(kvm): CreateVmDialog 创建表单(8 字段 + 七条校验 + osTemplate 联动)"
```

---

## Task 8: 创建流程接线(Add VM / 空列表自弹 / createVM)

**Files:**
- Modify: `src/kvm/views/KvmPage.vue` + `KvmPage.test.ts`
- Modify: `src/kvm/components/VmSidebar.vue` + `.test.ts`(「添加虚拟机」解禁)
- Modify: `src/kvm/composables/useVmList.ts` + `.test.ts`(**只加一个 `create` 方法**,不动既有的)
- Modify: `src/kvm/styles/kvmStyles.test.ts`(`add-vm-btn` 的 disabled 守卫改成不再要求 disabled 块存在)

**Interfaces:**
- Consumes: Task 2/4/5/6/7 全部
- Produces:
  ```ts
  // useVmList 新增:
  create(payload: KvmCreateVMRequest): Promise<string>   // '' = 成功;非空 = 报错文案
  ```

- [ ] **Step 1: `useVmList.create` 的失败测试**

```ts
// 追加到 src/kvm/composables/useVmList.test.ts
describe('create', () => {
  it('成功后刷新列表并返回空串', async () => {
    api.createVM.mockResolvedValue({ id: 'new-1' })
    api.getVMList.mockResolvedValue({ data: [], total: 0 })
    const s = useVmList()
    expect(await s.create(PAYLOAD)).toBe('')
    expect(api.createVM).toHaveBeenCalledWith(PAYLOAD)
    expect(api.getVMList).toHaveBeenCalled()
  })
  it('失败返回后端 message,不刷新列表', async () => {
    api.createVM.mockRejectedValue(new Error('domain name already exists'))
    const s = useVmList()
    expect(await s.create(PAYLOAD)).toBe('domain name already exists')
  })
  it('dispose 后落定不刷新列表(过期守卫)', async () => {
    let release: (v: unknown) => void = () => {}
    api.createVM.mockReturnValue(new Promise((r) => { release = r }))
    const s = useVmList()
    const p = s.create(PAYLOAD)
    s.dispose(); release({ id: 'x' }); await p
    expect(api.getVMList).not.toHaveBeenCalled()
  })
})
```

`PAYLOAD` 用 Task 7 那条 submit 用例里的对象。`api` mock 里补 `createVM: vi.fn()`。

- [ ] **Step 2: 实现 `create`**

照既有 `remove` / `toggleAutostart` 的写法(返回 `Promise<string>`、复用同一个 `errText()`、带 `alive` 守卫、成功后 `await fetchVMs()`)。**不要改任何既有方法的签名。**

- [ ] **Step 3: `KvmPage` 接线的失败测试**

追加到 `KvmPage.test.ts`(`api` mock 补 `createVM` / `getISOList` / `downloadISO` / `getSettings` / `updateSettings`;`service` mock 补 `folder: { getList }`):

```ts
it('VM 列表为空时自动弹创建弹窗(照 Vue2 :901,P5 走的是空态占位)', async () => {
  api.getVMList.mockResolvedValue({ data: [], total: 0 })
  const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
  await flush()
  expect(document.body.querySelector('.create-vm-title')?.textContent).toContain('创建新虚拟机')
  w.unmount()
})

it('列表非空时不自动弹', async () => {
  api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
  const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
  await flush()
  expect(document.body.querySelector('.create-vm-title')).toBeNull()
  w.unmount()
})

it('点「添加虚拟机」弹创建弹窗', async () => { /* 点 .add-vm-btn 后断言标题出现 */ })

it('创建弹窗里点 ISO 行 → OsSelector 打开(z-index 920 叠在上面)', async () => { /* … */ })

it('OsSelector 选中 → 创建弹窗 ISO 行显示 path', async () => { /* … */ })

it('提交成功 → 关弹窗 + toast「虚拟机创建成功」+ 列表刷新', async () => { /* … */ })

it('提交失败 → 弹窗不关,内联显示后端 message', async () => { /* … */ })

it('ISO 下载完成 → toast「Debian 已下载」(拼法照 Vue2 :165 `${os.name} ${$t("downloaded")}`)', async () => { /* … */ })

it('ISO 下载失败 → toast「下载失败」', async () => { /* … */ })

it('点正在下载的卡片 → toast「请等待下载完成」', async () => { /* … */ })
```

⚠️ **上面这 8 条带 `/* … */` 的用例必须写成完整可跑的代码,不许留占位。** 断言点已在描述里写死:弹窗标题文本、`.cv-iso-btn` 文本、`useToast().toasts` 内容、`api.createVM` 调用参数、`wrapper.emitted` 不适用(这些是页面内部状态,一律断言 DOM 与 toast)。

- [ ] **Step 4: 实现接线**

`KvmPage.vue`:

```ts
const isoList = useIsoList()
const hostInfo = useKvmHostInfo()
const createOpen = ref(false)
const osSelectorOpen = ref(false)
const selectedOs = ref<SelectedOs | null>(null)
const creating = ref(false)
const createError = ref('')

onMounted(() => { void isoList.fetch(); void hostInfo.fetch() })
onUnmounted(() => { isoList.dispose(); hostInfo.dispose() })

isoList.onDownloadDone((row) => toast.show(`${row.name} ${t('kvmToastDownloaded')}`))
isoList.onDownloadFailed(() => toast.show(t('kvmDownloadFailed')))

// 空列表自动弹创建弹窗(照 Vue2 fetchVMs :898-902)。只在"首次拉到空"时弹,
// 不在每次刷新后重弹 —— 否则用户手动关掉弹窗后,任何一次 MessageBus 事件触发的
// 刷新都会把它重新弹出来(Vue2 没这个问题是因为它只在 fetchVMs 里判,而 fetchVMs
// 只在 mounted 与事件里调;这里用一个一次性标志显式表达,免得将来加刷新点时复发)。
let autoOpenedCreate = false
watch(() => s.isLoading.value, (loading) => {
  if (!loading && !autoOpenedCreate && s.vms.value.length === 0) {
    autoOpenedCreate = true
    createOpen.value = true
  }
})

async function onCreateSubmit(payload: KvmCreateVMRequest) {
  creating.value = true
  createError.value = ''
  try {
    createError.value = await s.create(payload)
    if (createError.value === '') {
      toast.show(t('kvmToastVmCreated'))
      createOpen.value = false
      selectedOs.value = null
    }
  } finally { creating.value = false }
}
```

`VmSidebar.vue`:「添加虚拟机」去掉 `disabled` + `kvmComingSoon` title,改 `@click="$emit('add-vm')"`。

`kvmStyles.test.ts`:`add-vm-btn:hover:not(:disabled)` 那条**保留**(仍是好实践);`add-vm-btn:disabled` 的 `cursor: not-allowed` 那条也**保留**(规则留着无害,按钮不再有 disabled 态但样式仍正确)。**不要删这两条断言。**

- [ ] **Step 5: 任务门 + 提交**

```bash
pnpm vitest run src/kvm/
pnpm vitest run src/styles/color-guard.test.ts src/styles/theme.sp9.test.ts src/kvm/styles/kvmStyles.test.ts src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit
git add src/kvm/views/KvmPage.vue src/kvm/views/KvmPage.test.ts src/kvm/components/VmSidebar.vue src/kvm/components/VmSidebar.test.ts src/kvm/composables/useVmList.ts src/kvm/composables/useVmList.test.ts
git commit src/kvm/views/KvmPage.vue src/kvm/views/KvmPage.test.ts src/kvm/components/VmSidebar.vue src/kvm/components/VmSidebar.test.ts src/kvm/composables/useVmList.ts src/kvm/composables/useVmList.test.ts -m "feat(kvm): 创建流程接线(Add VM 解禁 + 空列表自弹 + createVM)"
```

---

## Task 9: `VmSettingsDialog.vue` 两 tab 壳 + General

**Files:**
- Create: `src/kvm/components/VmSettingsDialog.vue` + `.test.ts`
- Modify: `src/kvm/components/ConsoleHeader.vue` + `.test.ts`(齿轮解禁)
- Modify: `src/kvm/views/KvmPage.vue` + `.test.ts`
- Modify: `src/kvm/composables/useVmList.ts` + `.test.ts`(加 `update`)
- Modify: `src/kvm/styles/kvm.css`(`.settings-tabs` 一段)

**Interfaces:**
- Produces:
  ```ts
  // useVmList 新增:
  update(vm: KvmVM, patch: KvmUpdateVMRequest): Promise<string>   // '' = 成功
  // VmSettingsDialog
  // props { open: boolean; vm: KvmVM; host: KvmHostReadonly; selectedOs: SelectedOs | null; saving: boolean; submitError: string }
  // emits { 'update:open', 'open-os-selector', submit: [patch: KvmUpdateVMRequest], 'tab-change': [tab: 'general'|'snapshots'] }
  // slot  snapshots   // Task 10 的 SnapshotsTab 挂进来
  ```

- [ ] **Step 1: 写失败测试**

覆盖点(每条都要写成完整可跑代码):

1. 标题是 `虚拟机设置 - <vm.name>`(照 Vue2 `:234`)。
2. 两个 tab 按钮「通用」「快照」,默认 general 高亮;点快照 emit `tab-change: 'snapshots'` 并渲染 `snapshots` 插槽内容。
3. General 回填:name / disk / memory / vcpu 格子 / networkMode / firmware,来自 `props.vm`;`networkMode` 映射照 Vue2 `:1215`(`vm.networkMode === 'bridge' ? (vm.networkInterface || 'nat') : 'nat'`)。
4. 磁盘输入框 `disabled`,label 旁显示 `{{ Math.round(diskUsedPercent) }}% 已使用`;`diskUsedPercent` 为 0 时显示 `0% 已使用`。
5. ISO 行:`vm.iso` 有值时显示路径,空时显示「未挂载 ISO」;点它 emit `open-os-selector`。
6. **弹出/挂载双态按钮**(照 Vue2 `:276-281`):`bootFromDisk === false` 时显示「弹出」按钮(`aria-label` = `kvmEjectIso`),点它 → `bootFromDisk=true` + `iso=''`;`bootFromDisk === true` 时显示「挂载」按钮(`aria-label` = `kvmMountIso`),点它 → emit `open-os-selector`。
7. 选中 OS 后 `iso` 变成新 path、`bootFromDisk` 变 false(照 Vue2 `:1380-1381`)。
8. 固件两按钮**都是 `disabled`**(照 Vue2 `:321-322`),但 active 类正确反映 `vm.firmware`。
9. 提交:emit `submit`,payload 含 `name/vcpu/memory/disk/iso/bootFromDisk/firmware/networkMode/networkInterface`,`networkMode` 折算照 Vue2 `:1499-1500`。
10. `saving=true` 时保存按钮 `is-loading` 且点不动。
11. `submitError` 显示在 `.cv-error`,弹窗不关。
12. 重新打开时表单从 `props.vm` 重新回填(不保留上次的脏值)。
13. `host.cpuCores=0` 时不渲染 CPU 格子。

- [ ] **Step 2: 跑测试确认失败,然后实现**

- 模板照 Vue2 `:230-393` 的 head + tabs + General section + foot(**foot 只在 general tab 显示**,照 `:387`)。
- 套 `KvmDialog`,`width="600px"`,`tabs` 插槽放 `.settings-tabs`。
- `useVmList.update(vm, patch)`:照 `create` 的写法,成功后 `Object.assign` 回写选中 VM 的可见字段(照 Vue2 `saveSettings` `:1503-1508`),再返回 `''`。
- **不照抄** `showSettings()` 里那句「设置只能在虚拟机停止时修改」的 toast(死代码,按钮已 disabled;spec §1.15)。

`ConsoleHeader.vue`:齿轮改成

```vue
<button
  class="action-btn"
  type="button"
  :disabled="!canEditSettings"
  :title="canEditSettings ? t('kvmSettings') : t('kvmStopToModifySettings')"
  :aria-label="t('kvmSettings')"
  @click="emit('action', 'settings')"
>
```

`canEditSettings = computed(() => props.vm.state === 'stopped' || props.vm.state === 'crashed')`(照 Vue2 `:674-676`)。`ConsoleHeader.test.ts` 补三条:running 时 disabled + tooltip 是「停止虚拟机以修改设置」· stopped 时可点 + tooltip 是「系统设置」· 点击 emit `action: 'settings'`。

`KvmPage.vue`:`onAction` 里加 `case 'settings': vmSettingsOpen.value = true; break`(**放在 `CONFIRM_ACTIONS` 之外的 switch 里**,它不是电源动作、不要遮罩、不要 toast)。

CSS 照 Vue2 `.settings-tabs` / `.settings-tab` `:2877-2900`。

- [ ] **Step 3: 任务门 + 提交**

```bash
pnpm vitest run src/kvm/
pnpm vitest run src/styles/color-guard.test.ts src/styles/theme.sp9.test.ts src/kvm/styles/kvmStyles.test.ts src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit
git add src/kvm/components/VmSettingsDialog.vue src/kvm/components/VmSettingsDialog.test.ts src/kvm/components/ConsoleHeader.vue src/kvm/components/ConsoleHeader.test.ts src/kvm/views/KvmPage.vue src/kvm/views/KvmPage.test.ts src/kvm/composables/useVmList.ts src/kvm/composables/useVmList.test.ts src/kvm/styles/kvm.css
git commit src/kvm/components/VmSettingsDialog.vue src/kvm/components/VmSettingsDialog.test.ts src/kvm/components/ConsoleHeader.vue src/kvm/components/ConsoleHeader.test.ts src/kvm/views/KvmPage.vue src/kvm/views/KvmPage.test.ts src/kvm/composables/useVmList.ts src/kvm/composables/useVmList.test.ts src/kvm/styles/kvm.css -m "feat(kvm): VmSettingsDialog 两 tab 壳 + General(控制台头齿轮解禁)"
```

---

## Task 10: 快照 tab

**Files:**
- Create: `src/kvm/composables/useSnapshots.ts` + `.test.ts`
- Create: `src/kvm/components/SnapshotsTab.vue` + `.test.ts`
- Modify: `src/kvm/components/VmSettingsDialog.vue` + `.test.ts`(挂进 snapshots 插槽)
- Modify: `src/kvm/views/KvmPage.vue` + `.test.ts`(进度遮罩接线)
- Modify: `src/kvm/styles/kvm.css`(`.snapshots-body` 一段)

**Interfaces:**
- Produces:
  ```ts
  export function useSnapshots(): {
    snapshots: Ref<KvmSnapshot[]>
    fetch(vmId: string): Promise<void>
    create(vmId: string, name: string, description: string): Promise<string>   // '' = 成功
    remove(vmId: string, snapshotId: string): Promise<string>
    restore(vmId: string, snapshotId: string): Promise<string>
    dispose(): void
  }
  // SnapshotsTab
  // props { vmId: string; vmState: string; snapshots: KvmSnapshot[]; busy: boolean; submitError: string }
  // emits { create: [{ name: string; description: string }]
  //         'confirm-delete': [s: KvmSnapshot]
  //         'confirm-restore': [s: KvmSnapshot] }
  ```

- [ ] **Step 1: `useSnapshots` 的失败测试**

覆盖:`fetch` 成功填列表(**两层信封,共享包已封,直接拿数组**)· `fetch` 失败保留旧列表(照 Vue2 只 `console.warn`)· `create` 成功后**自己再 fetch 一遍**(照 Vue2 `:1251`)并返回 `''` · `create` 失败返回后端 message · `remove` 成功后**本地过滤掉那一条**(照 Vue2 `:1307`,不重新 fetch)· `restore` 成功返回 `''` · 三个写方法失败都返回后端 message · `dispose` 后落定不写 state(交错路径)。

真机 fixture:`{"success":true,"data":{"data":[]}}` → 共享包剥两层后是 `[]`。造非空列表时字段照 `NimoOS-KVM/model/snapshot.go`:`{ id, vmId, name, description, state, createdAt }`。

- [ ] **Step 2: 实现 `useSnapshots.ts`**

- [ ] **Step 3: `SnapshotsTab` 的失败测试**

覆盖点(全部写成可跑代码):

1. 创建区:名称 + 描述两个输入 + 「创建」按钮;标题「创建快照」。
2. 名称空白时点创建 → 内联 `.cv-error` 显示「请输入快照名称」,**不 emit create**(照 Vue2 `:1238-1240`,但改内联不用 toast)。
3. 名称合法 → emit `create: { name, description }`。
4. `busy=true` 时创建按钮 `is-loading` 且点不动。
5. 空列表 → `.cv-empty-state` 显示「暂无快照」。
6. 非空 → 每条显示 `名称: x`、有描述才显示 `描述: y`、`创建于: <本地时间>`(`formatDate` 用 `new Date(s).toLocaleString()`,照 Vue2 `:1316-1320`)。
7. **恢复按钮在 `vmState !== 'stopped'` 时 `disabled`**(照 Vue2 `:368`)。
8. **就地二次确认**:第一次点「删除」→ 文字变「你确定吗?」+ 带 `confirm-text-danger` 类,**不 emit**;第二次点同一条 → emit `confirm-delete`。恢复同理。
9. **确认态互斥**:对 A 点了删除待确认,再点 B 的删除 → A 复位、B 进入待确认(照 Vue2 单一 `pendingConfirmAction`+`pendingConfirmId` 的语义)。
10. **切换动作也复位**:同一条上先点删除(待确认)再点恢复 → 变成恢复待确认,删除文字复位。
11. `submitError` 显示在同一个 `.cv-error` 位。

- [ ] **Step 4: 实现 `SnapshotsTab.vue` + 接线**

- 就地二次确认复用 P5 `OverflowMenu.vue` 的写法(`pendingAction: ref<string>('')` + `pendingId: ref<string>('')`),**别抽公共组件**(P5 那个是菜单项、这个是按钮对,形状不同)。
- `VmSettingsDialog` 的 `snapshots` 插槽里挂 `<SnapshotsTab>`;`tab-change: 'snapshots'` 时父组件调 `snaps.fetch(vm.id)`(照 Vue2 `:250` 点 tab 才拉)。
- `KvmPage.vue`:确认后挂 `ProgressOverlay`(照 Vue2 `:1268-1270` / `:1294-1296`):删除 → `title=t('kvmDeletingSnapshot')`、`message=\`${s.name} ${t('kvmDeletingShort')}...\``;恢复 → `title=t('kvmRestoringSnapshot')`、`message=\`${s.name} ${t('kvmRestoringShort')}...\``。完成后摘遮罩;成功 toast 拼法照 Vue2:删除 `` `${s.name} ${t('kvmToastDeleted')}` ``、恢复 `` `${s.name} ${t('kvmRestoredShort')}` ``。**恢复成功后关掉设置弹窗**(照 Vue2 `:1282`)。
- 创建成功 toast「快照创建成功」(整句,照 Vue2 `:1249`)。
- **不照抄** `confirmRestoreSnapshot` 里那句「恢复快照前必须停止虚拟机」的 toast(死代码,按钮已 disabled)。

CSS 照 Vue2 `.snapshots-body` `:2723-2874`(scoped 半)+ `:2969-3095`(unscoped 半的 `.cv-snapshot-item` 与 `.cv-btn`)+ `.cv-empty-state` `:2940-2961`。

- **只搬 `.cv-btn-restore` 与 `.cv-btn-delete` 两个变体。`.cv-btn-create` 是死 CSS**(2026-08-03 grep 确认模板里零命中 —— Vue2 的「创建快照」按钮用的是 `b-button type="is-primary" rounded`,不是 `.cv-btn-create`)。本期该按钮用 Task 1 建好的 `.cv-primary-btn`,与其它主按钮同款。
- ⚠️ **`.cv-btn-restore` / `.cv-btn-delete` 各自都要有自带的 `:hover` 背景**(记忆 `newui-css-hover-specificity-trap`:基类 `.cv-btn:hover` 特异度 (0,2,0) 会压过变体 `.cv-btn-restore` 的 (0,1,0),导致 hover 时白底白字。jsdom 测不出来,靠 `cssCascade.ts` 自己算优先级,或像 P5 那样对源码文本做静态断言)。

- [ ] **Step 5: 变异验证**

去掉「第二次点击才 emit」的判断 → 第 8 条必红;去掉确认态互斥的复位 → 第 9 条必红。

- [ ] **Step 6: 任务门 + 提交**

```bash
pnpm vitest run src/kvm/
pnpm vitest run src/styles/color-guard.test.ts src/styles/theme.sp9.test.ts src/kvm/styles/kvmStyles.test.ts src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit
git add src/kvm/composables/useSnapshots.ts src/kvm/composables/useSnapshots.test.ts src/kvm/components/SnapshotsTab.vue src/kvm/components/SnapshotsTab.test.ts src/kvm/components/VmSettingsDialog.vue src/kvm/components/VmSettingsDialog.test.ts src/kvm/views/KvmPage.vue src/kvm/views/KvmPage.test.ts src/kvm/styles/kvm.css
git commit src/kvm/composables/useSnapshots.ts src/kvm/composables/useSnapshots.test.ts src/kvm/components/SnapshotsTab.vue src/kvm/components/SnapshotsTab.test.ts src/kvm/components/VmSettingsDialog.vue src/kvm/components/VmSettingsDialog.test.ts src/kvm/views/KvmPage.vue src/kvm/views/KvmPage.test.ts src/kvm/styles/kvm.css -m "feat(kvm): 快照 tab(list/create/delete/restore + 就地二次确认 + 进度遮罩)"
```

---

## Task 11: 整页收尾

**Files:**
- Modify: `src/kvm/styles/kvm.css` · `src/kvm/views/KvmPage.vue`(若自查发现问题)
- 无新文件

- [ ] **Step 1: 窄屏自查(~420px)**

四个弹窗 + OsSelector 在 420px 宽下:内容不横向溢出、`.create-vm-body` 能纵向滚、CPU 格子换行、快照项的两列在窄屏下堆叠。照 Vue2 `OSSelector.vue:697-701` 的 768px 媒体查询;弹窗宽度靠 `max-width:92vw` 兜底。发现问题就补媒体查询,**并在 `kvmStyles.test.ts` 白名单里登记新类**。

- [ ] **Step 2: 静态截图自查**

按记忆 `headless-chrome-screenshot-check`:用缓存里的 chromium 对 `#/kvm` 截图(**暗色 + 亮色两套**,验证 KVM 区在亮色主题下仍是深色),逐个弹窗打开截一张。检查:没有空方框字形(`✕` `▾` `▣` `▤` 这些占位符号)、没有溢出、没有白底白字、`.cv-error` 可读。

- [ ] **Step 3: token 与死代码清点**

```bash
grep -rn "console.log" src/kvm/                    # 必须零命中
grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(" src/kvm/styles/kvm.css   # 只允许 var(...) 里的
pnpm vitest run src/styles/color-guard.test.ts src/kvm/styles/kvmStyles.test.ts
```

逐个核对 Task 0 定的 23 个 token 是否都真的被用上;有没用上的**要么删掉、要么在注释里说明为什么留**。核对 74 个 i18n 键有无死键(`grep -c` 每个键在 `src/` 里的消费次数)。

- [ ] **Step 4: 全量三门**

```bash
pnpm test                    # 与基线 339 文件 / 2877 例 比对(看数字不看退出码)
pnpm exec vue-tsc --noEmit
pnpm build
```

- [ ] **Step 5: 提交 + 写台账**

```bash
git add src/kvm/
git commit src/kvm/ -m "feat(kvm): P6 整页收尾(窄屏 + 截图自查 + token/文案清点)"
```

台账落 `.superpowers/sdd/2026-08-03-vue3-migration-sp9-p6-kvm-create/`(gitignore,不进 git),阶段总结落 `.superpowers/sdd/sp9/07-p6.md`。内容:各任务坐标 commit · 偏离登记(spec §6.2.5 六条 + 各任务新增的)· 暂缺登记 · 验收清单 · 挂账项。**重要结论同步回记忆**(SP7 曾整目录丢失且 git 救不回)。

---

## 全分支终审

十二个任务全绿后过一次全分支终审(**评审禁用 haiku,评审者必须自己读源文件**),重点看:

1. **spec §6.2 逐项对照**:承载(6.2.1)· ISO 状态位置(6.2.2)· 六个组件与三入口(6.2.3)· 七条校验(6.2.4)· 六条偏离是否都真的落地并在代码里注释登记(6.2.5)。
2. **未申报的偏离**——把每个组件与 Vue2 对应行号并排看一遍,凡是行为不同又没注释的都是缺陷。
3. **过期守卫**:`useKvmHostInfo` / `useIsoList` / `useIsoBrowser` / `useSnapshots` / `useVmList.create` / `useVmList.update` 六处,每处都要有交错路径回归测试。
4. **toast vs 内联**的分工是否一致(操作结果走 toast、弹窗内校验/提交失败走 `.cv-error`)。
5. **hover 优先级**:`.cv-btn-restore` / `.cv-btn-delete` / `.cv-btn-create` / `.cv-primary-btn` / `.category-btn` / `.os-action-btn` 三态各自的 `:hover` 是否自带背景。
6. **死键/死 token/死 CSS** 清零。

终审提的必修一次性收尾,然后跑全量 `pnpm test` + `pnpm build`,交付真机验收。

---

## 真机验收清单(交给用户,每屏写清点击路径)

**前置**:`cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm dev --host --port 5273`,浏览器开 `http://<本机IP>:5273/app/#/kvm`。⛔ **不要用 `deploy.sh`**(三条并行线共用一个部署目录,rsync --delete 会删掉别人的产物)。

⚠️ **本轮会真的建一台一次性 VM 并在最后删掉**(用户 2026-08-03 授权)。现有的 `sp9-alpine-test` 全程不碰,只在第 1-3 条里看它。

### A. 全局设置(不改任何值,只看)

| # | 点击路径 | 预期 |
|---|---|---|
| 1 | 打开 `#/kvm` → 点**左栏右上角齿轮** | 弹出深色弹窗,标题「系统设置」;四行:存储路径 `/DATA/KVM`、默认 vCPU `2` 核心、默认内存 `2048` MB、自动启动开关(关) |
| 2 | 点弹窗右上 `✕` | 弹窗关闭,**没有**保存任何东西 |
| 3 | 再打开一次,把默认 vCPU 改成 `2`(即不变),点「保存」 | 右下角出现 toast「设置已保存」,弹窗关闭 |

### B. OSSelector(只浏览 + 选,不下载)

| # | 点击路径 | 预期 |
|---|---|---|
| 4 | 点左栏底部「添加虚拟机」 | 弹出「创建新虚拟机」弹窗 |
| 5 | 点「ISO 镜像」那一行 | 叠上来一个「选择操作系统」弹窗(在创建弹窗之上) |
| 6 | 看分类按钮 | 四个:全部 / Windows / Linux / BSD,「全部」高亮 |
| 7 | 点「Windows」 | 只剩 Windows 10 / Windows 11 两张卡 |
| 8 | 点「Linux」 | Debian / Ubuntu / Alpine / Arch 等;**Alpine 那张卡是绿边框**、按钮写「选择」;其余卡按钮写「下载」 |
| 9 | 点「BSD」 | 只剩 FreeBSD |
| 10 | 回「全部」,点最下方「自定义」标题条 | 展开一个文件浏览器,路径显示 `/`,上一级按钮**灰色不可点** |
| 11 | 在文件列表里点 `DATA` 目录 | 路径变 `/DATA`,列出目录与 `.iso` 文件;**看不到 .txt/.jpg 之类**;上一级按钮变可点 |
| 12 | 点上一级按钮 | 回到 `/` |
| 13 | 一路点进 `/DATA/KVM/isos` | 应看到 `alpine-319.iso`,右侧显示文件大小(约 `60.0 MB` 量级) |
| 14 | ⛔ **不要点任何「下载」按钮**(会真的从网上拉几 GB) | — |

### C. 创建一台一次性 VM

| # | 点击路径 | 预期 |
|---|---|---|
| 15 | 在自定义区点 `alpine-319.iso` | OSSelector 关闭,回到创建弹窗;ISO 行显示 `/DATA/KVM/isos/alpine-319.iso` |
| 16 | 看「CPU 核心」 | **6 个方格**(本机 6 核),前 2 个高亮 |
| 17 | 看「磁盘大小」旁的提示 | 「最大: 263 GB」 |
| 18 | 把磁盘改成 `4`,点「创建」 | 弹窗**内部**出现红字「磁盘大小必须至少为 8 GB」,**不是右下角 toast**;弹窗不关 |
| 19 | 磁盘改回 `8`,名称留空,点「创建」 | 红字变「请输入虚拟机名称」 |
| 20 | 名称填 `p6-throwaway`,点第 4 个 CPU 格子 | 前 4 个格子高亮 |
| 21 | 点回第 2 个格子,内存填 `512`,点「创建」 | 按钮转圈;成功后 toast「虚拟机创建成功」,弹窗关闭,**左栏出现第二台 `p6-throwaway`**,状态「已停止」灰点 |
| 22 | 点 `p6-throwaway` 这一行 | 右侧控制台区出现**开机大按钮**(未运行) |

### D. VM 设置(在一次性 VM 上做)

| # | 点击路径 | 预期 |
|---|---|---|
| 23 | 选中 `p6-throwaway`(已停止),看**控制台头右上的齿轮** | **可点**(不再灰),悬停提示「系统设置」 |
| 24 | 点齿轮 | 弹出「虚拟机设置 - p6-throwaway」,两个 tab「通用」「快照」,通用高亮 |
| 25 | 看通用页 | 名称 `p6-throwaway`;磁盘 `8` **灰色不可编辑**,旁边「0% 已使用」;ISO 行显示 alpine 路径;CPU 6 格前 2 高亮;内存 `512`;网络 NAT;固件 BIOS 高亮且**两个按钮都不可点** |
| 26 | 把内存改成 `768`,点「保存」 | toast「设置已保存」,弹窗关闭;再打开确认内存是 `768` |
| 27 | 再打开设置,点 ISO 行右边那个**弹出按钮** | ISO 行变「未挂载 ISO」,那个按钮变成向下的挂载按钮 |
| 28 | 点挂载按钮 | 弹出 OSSelector;点 `✕` 关掉,ISO 行仍是「未挂载 ISO」 |
| 29 | 点 `✕` 关掉设置弹窗(**不保存**),重新打开 | ISO 行**又显示回 alpine 路径**(没保存就不该改) |
| 30 | 现在选中**正在运行的** `sp9-alpine-test`,看控制台头齿轮 | **灰色不可点**,悬停提示「停止虚拟机以修改设置」 |

### E. 快照(在一次性 VM 上做)

| # | 点击路径 | 预期 |
|---|---|---|
| 31 | 选 `p6-throwaway` → 齿轮 → 点「快照」tab | 上半是创建表单(名称 + 描述 + 创建按钮),下半「暂无快照」空态 |
| 32 | 名称留空点「创建」 | 弹窗内红字「请输入快照名称」 |
| 33 | 名称 `snap-1`,描述 `第一个`,点「创建」 | toast「快照创建成功」;下方出现一条:名称: snap-1 / 描述: 第一个 / 创建于: <时间> |
| 34 | 再建一个 `snap-2`(描述留空) | 出现第二条,**没有**「描述:」那一行 |
| 35 | 点 `snap-1` 的「删除」**一次** | 文字原地变红「你确定吗?」,**不发请求**、快照不删 |
| 36 | 点 `snap-2` 的「删除」**一次** | `snap-1` 的文字**复位**成「删除」,`snap-2` 变「你确定吗?」 |
| 37 | 再点 `snap-2` 的「你确定吗?」 | 出现「正在删除快照」遮罩;完成后 toast「snap-2 已删除」,列表只剩 `snap-1` |
| 38 | 点 `snap-1` 的「恢复」**两次** | 出现「正在恢复快照」遮罩;完成后 toast「snap-1 已恢复」,**设置弹窗自动关闭** |
| 39 | 现在选中运行中的 `sp9-alpine-test`,齿轮是灰的进不去 → **跳过**,改在 `p6-throwaway` 上启动它再看快照 tab 的「恢复」按钮 | VM 运行时「恢复」按钮**灰色不可点** |

### F. 补验 P5 的挂账

| # | 点击路径 | 预期 | 编号 |
|---|---|---|---|
| 40 | 选 `p6-throwaway` → 点开机大按钮 → 等它跑起来 | 状态「运行中」;因为它 `bootFromDisk=false` 且挂着 ISO,**顶部出现浅蓝色安装横幅** | D36 前置 |
| 41 | 点安装横幅上的「我已安装完成」 | 横幅消失,toast「光盘已弹出,虚拟机将在下次重启时从硬盘引导」 | **D36** |
| 42 | `⋮` → 强制关机(点两次)→ 等停 → `⋮` → 点「删除」**两次** | 「正在删除」遮罩;完成后 `p6-throwaway` 从左栏消失,toast「p6-throwaway 已删除」 | **D33** |
| 43 | 选 `sp9-alpine-test`,鼠标进控制台画面 | 鼠标指针在画面里是个**小圆点**(不是消失) | **D42** |
| 44 | 把浏览器窗口拉大再拉小 | Alpine 的画面**跟着等比缩放**、不超出边框、不出现滚动条 | **D42** |
| 45 | P5 清单第 4-22 条(工具条 / 六个电源动作 / 就地二次确认 / 进度遮罩 / 侧栏折叠 / 窄屏)—— 见 `.superpowers/sdd/2026-08-02-vue3-migration-sp9-p5-kvm-console/task-8-brief.md` 的 22 项表格 | 逐条按那份表跑 | P5 第 4-22 条 |

### 本轮仍验不了的(挂账,不算验收失败)

| 编号 | 内容 | 为什么 | 覆盖方式 |
|---|---|---|---|
| D34 | `wakeup`(唤醒) | 造不出 `suspended` 态(需 libvirt managedsave / S3) | 单测覆盖派生与调用 |
| D35 | SPICE 提示条 | 需 `bootFromDisk=true` 且 `spicePort>0`;第 41 条点完后 `bootFromDisk` 会变 true,**若此时该 VM 的 `spicePort>0`,顺带能验一次**;验不到就继续挂账 | 单测覆盖显示条件与 180s 自动收起 |
| D14 | 删除 ISO | 本期拍板不做(Vue2 无 UI) | 不做 |

---

## Self-Review

**1. spec 覆盖** —— §6.2 逐项对照:

| spec 条目 | 落点 |
|---|---|
| 6.2.1 `KvmDialog` + reka-ui + z 轴 900/920/1000 | Task 1 |
| 6.2.2 `useIsoList` 页面级 + 三事件 | Task 4(创建点在 Task 8) |
| 6.2.2 `useKvmHostInfo` | Task 2 |
| 6.2.2 `useSnapshots` | Task 10 |
| 6.2.2 `useIsoBrowser` | Task 6 |
| 6.2.3 `CreateVmDialog` | Task 7 |
| 6.2.3 `VmSettingsDialog` | Task 9 |
| 6.2.3 `SnapshotsTab` | Task 10 |
| 6.2.3 `KvmGlobalSettingsDialog` | Task 2 |
| 6.2.3 `OsSelector` | Task 5 |
| 6.2.3 `IsoBrowser` | Task 6 |
| 6.2.3 左栏齿轮解禁 | Task 2 |
| 6.2.3 控制台头齿轮解禁 | Task 9 |
| 6.2.3 「添加虚拟机」解禁 | Task 8 |
| 6.2.3 空列表自弹创建弹窗 | Task 8 |
| 6.2.4 七条校验 + `iso` 传绝对路径 | Task 3(纯函数)+ Task 7(接线) |
| 6.2.4 弹窗内联报错不用 toast | Task 1(`.cv-error`)+ 各弹窗任务 |
| 6.2.5 六条偏离登记 | Task 1/2/4/6/7 各自注释 + Task 11 清点 |
| §1.15 `FolderEntry.size` | Task 0 |
| §1.15 三处死代码不照抄 | Task 5(MB 分支)· Task 9(settings toast)· Task 10(restore toast) |
| §1.15 文案坑(`kvmSettings`=系统设置、`BSD` 无译) | Task 0 |
| §12 #6 CPU 格子首帧不闪 | Task 2(初值 0)+ Task 7/9(格子数 0 不渲染) |
| P5 挂账 D33/D36/D42 + 第 4-22 条 | 验收清单 F 节 |

**无 spec 缺口。**

**2. 占位扫描** —— Task 8 Step 3 有 8 条用例写成了 `/* … */`,已在该步骤里显式要求「必须写成完整可跑代码,不许留占位」并给出断言点(弹窗标题文本 / `.cv-iso-btn` 文本 / `useToast().toasts` 内容 / `api.createVM` 调用参数)。Task 9 Step 1 与 Task 10 Step 3 用「覆盖点编号清单」代替完整代码块——每条都写明了断言对象、Vue2 对应行号与预期值,实现者据此写测试;这是为控制篇幅的有意取舍,不是 TBD。

**3. 类型一致性** —— 跨任务的名字逐个核过:`KvmHostReadonly` / `KvmWritableSettings`(Task 2 定义 → Task 7/9 消费)· `IsoRow`(Task 4 → Task 5/6)· `SelectedOs`(Task 5 → Task 6/7/9)· `filterByCategory` / `matchTemplateByFilename` / `osTemplateDefaults` / `formatFileSize` / `isIsoFile`(Task 3 → Task 5/6/7)· `validateCreateVm`(Task 3 → Task 7)· `useVmList.create`(Task 8)/ `update`(Task 9)· `useSnapshots` 四个方法(Task 10)。返回值契约统一:**所有写操作返回 `Promise<string>`,`''` = 成功**(沿用 P5 `ejectInstallMedia` 立下的约定,避免共享 `lastError` 串味)。

**4. 范围检查** —— 12 个任务 + 终审,与 P5 的 9 个任务 + 终审同一量级。用户 2026-08-03 已拍板一期做完、不拆子期。
