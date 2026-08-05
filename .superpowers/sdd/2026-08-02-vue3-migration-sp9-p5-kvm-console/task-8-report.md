# Task 8 报告:安装横幅 + SPICE 提示条 + P5 收尾

状态:完成。commit `849219e`(初版)+ `595d97d`(第二轮评审修复)+ `49b6ff3`(第三轮定向复审修复)。

## i18n 实际值核对(brief 草稿已过时,以此为准)

开工前 `grep src/i18n/zh_cn.sp9.ts` 核对,brief Step 1 示例代码里的中文断言与实际值不一致,已订正
(体现在 `InstallBanner.test.ts`/`SpiceInfoBar.test.ts` 里,并加了核对注释):

| 键 | brief 草稿 | 实际值(zh_cn.sp9.ts) |
|---|---|---|
| `kvmInstallingFromIso` | "正在从 ISO 安装" | "正在从光盘安装。完成后请点击：" |
| `kvmFinishedInstalling` | "我已安装完成" | "我已完成安装" |
| `kvmEjectSuccess` | (未在 brief 出现) | "光盘已弹出，虚拟机将在下次重启时从硬盘引导。" |
| `kvmEjectFailed` | (未在 brief 出现) | "弹出安装介质失败" |
| `kvmSpiceHint` | (未在 brief 出现) | "为获得更好体验，请使用 virt-viewer 客户端连接：" |
| `kvmSpiceAgentWin` | (未在 brief 出现) | "在虚拟机中安装 virtio-win 驱动以启用剪贴板、音频和 USB 功能" |
| `kvmSpiceAgentLinux` | (未在 brief 出现) | "在虚拟机中安装 spice-vdagent 以启用剪贴板、音频和 USB 功能" |
| `kvmClose` | (未在 brief 出现) | "关闭" |

以上全部键(含 `kvmFailedToEjectMedia`)在开工前就已经由更早的任务(T1/T3 评审补测时)
预先写进 `zh_cn.sp9.ts`/`en_us.sp9.ts` 并配好核对注释——本任务**没有新增任何 i18n 键**,
全部复用现成的。`kvmEjectSuccess`/`kvmEjectFailed` 两个键本任务**没有消费**(见下面"与
brief 的偏离 #4"),算一条暂缺登记。

## Vue2 行号核对

| 内容 | brief 草稿行号 | 实测行号(本次核对) |
|---|---|---|
| 安装横幅模板 | :142-152 | :142-149 |
| SPICE 提示条模板 | :155-170 | :156-165(spice-info-bar 在 `.console-display` 内部,是第一个子节点) |
| `watch selectedVM` 里的 spiceTimer | :745-760 | :748-752 |
| `handleInstallationFinished` | :860-877 | :861-877(`if (!vm \|\| this.finishingInstall) return` 在 :862) |
| `isWindowsGuest` computed | :715-720 | :711-714 |
| 样式 `.spice-info-bar` 等 | :2796-2870 | :2795-2865,**在第一个、scoped 的 `<style>` 块**(`<style lang="scss" scoped>` 起于 :1657) |
| 样式 `.installation-banner` | :3096-3150 | :3096-3147,**在第二个、非 scoped 的 `<style>` 块**(`<style lang="scss">` 起于 :2875,文件共 3153 行) |

两个 `<style>` 块的边界(:1657 起 scoped、:2875 起非 scoped)在本任务的组件/CSS 注释里都
标注了,免得下次翻源文件又翻错地方(brief 原文没提这茬,是这次核对时发现的,已顺手
在代码注释里登记)。

## 实现内容

### 1. `InstallBanner.vue`(新建)+ 测试

- 显示条件由父组件算好通过 `v-if` 控制;组件本身只管渲染 + 点击回调。
- `busy` 为真时按钮加 `is-loading` 类(字透明 + 白色转圈 `::after`,数值逐字照抄 Vue2)。
- **与 Vue2 的偏离(改正确逻辑,已申报,详见"偏离"节 #1)**:点击处理函数里显式判断
  `busy` 才 `emit('finish')`,不完全依赖 CSS `pointer-events:none`。

### 2. `SpiceInfoBar.vue`(新建)+ 测试

- props `{ hostname, spicePort, isWindowsGuest }`,emit `close`。
- 拼 `spice://{hostname}:{spicePort}` 连接串,`isWindowsGuest` 切换 virtio-win / spice-vdagent
  提示语。
- 关闭按钮 `×`(Latin-1 乘号,非 emoji)。~~与 dropdown 的删除符号复用同一个字符——上下文
  不同不构成歧义~~ **已在下方"评审修复"一节订正**:评审 Minor 指出同页面同符不同义,
  dropdown 的删除项图标已改成 `⊟`,两者不再是同一个字符。

### 3. 接进 `KvmPage.vue`

- `showInstallBanner`/`showSpiceBar` 两个 computed,逐字对应 brief 给的显示条件。
- `spiceDismissed` + `spiceTimer`(180 秒)+ `watch(() => s.selectedVM.value?.id, ...)`——
  按 brief Step 3 示例代码实现,切 VM 时复位计时器。
- `ejectBusy`(视图层自己的 `ref`,**不复用** `useVmList` 内部的 `ejectingIds`——那是纯
  内部去重用的普通 `Set`,不是 `ref`,模板读它不会触发重渲染,`is-loading` 视觉会因此
  永远出不来)。
- `hostname`:直接 `window.location.hostname` 常量,不用 `ref`(运行期间不变,Vue2 那边
  虽然是 computed 但同样只读这一个不变的全局值)。
- `isWindowsGuestSelected`:接 `vmState.ts` 新增的 `isWindowsGuest(vm)` 纯函数。
- `SpiceInfoBar`/`InstallBanner` 的 DOM 位置:横幅在 `.vm-console-container` 里、
  `console-header` 和 `ConsoleStage` 之间(与 Vue2 模板位置一致);SPICE 条作为
  `ConsoleStage` 的 slot 内容传入(与 SendKey 工具条同一个 slot,原因见下面偏离 #2)。

### 4. `vmState.ts` 新增 `isWindowsGuest`

逐字对 Vue2 `isWindowsGuest` computed(`os` 含 `win`,大小写不敏感)。Vue2 还多查一个
`osType` 字段,New-UI 的 `KvmVM` 类型只有 `os`(T0 已核实:后端 json tag 就是 `os`,
Go 字段名 `OSType` 只是同一个 key 的两种称呼)——一个字段覆盖了 Vue2 两个字段查的全部
信息来源,**不是漏查**,不计入偏离列表。

## 顺带清理(三件)

1. **`kvm.css` 注释订正**——原 `:690` 附近(现文件里挪到 SendKey 工具条段落头部)写着
   "被 KvmPage Teleport 进 ConsoleStage 的 hostEl",T7 早已改成 slot 方案但注释没跟着改。
   已订正措辞(改成"作为 slot 内容渲染进 `.console-display`"),并在同一段落补充说明
   SpiceInfoBar 同理。

2. **溢出菜单图标**——`OverflowMenu.vue` 每个 `dropdown-item` 前补一个单色文字符号
   (`.dropdown-icon`,固定宽度 `1rem` 左对齐):
   - 开机/恢复/唤醒:`▶`(与 Vue2 的 b-icon 复用同一个"play"图标一致,这里也复用同一个符号)
   - 强制关机:`⊘`
   - 强制重启:`↻`
   - 暂停:`‖`
   - 删除:`×` → **评审 Minor 后改成 `⊟`**(见下方"评审修复"一节,与 `SpiceInfoBar`
     的关闭按钮同符不同义,已订正)
   - 自动启动:不加(Vue2 本来就没有 b-icon,`toggle-indicator` 圆点本身就是它的"图标",
     原样保留)。
   新增 CSS 类 `dropdown-icon` 已加入 `kvmStyles.test.ts` 白名单。

3. **token 清点**——见下方专节,合并了 `--kvm-idle`/`--kvm-fg-faint`。

## Token 清点结果

T2 一次性定义了 32 个 `--kvm-*` token(不含 `--kvm-idle` 就是 31 个,brief 说的"31 个"
应该是不含即将被合并的这个;这次核对下来实际是 32 个,合并后剩 31 个)。开工前用
usage-count 脚本核对:

| Token | T2 时用途 | 本任务前用了几次 | 本任务后 |
|---|---|---|---|
| `--kvm-banner-bg/border/fg/btn/btn-hover` | 安装横幅专用 | 0 | InstallBanner 消费,≥1 |
| `--kvm-warn-border` | SPICE 提示条边框 | 0 | SpiceInfoBar 消费,1 |
| 其余 25 个 | 各控制台/列表/菜单场景 | 均 ≥1 | 不变 |

**删除**:`--kvm-idle`(与 `--kvm-fg-faint` 字面量完全相同,`#6e7681`——核对 Vue2 源文件
后确认这不是巧合,Vue2 本来就在"停机点底色"和"console-hint 弱化文字色"两种场景复用
同一个字面量,`kvm.css` 里 status-dot 的三处 `--kvm-idle` 引用改成 `--kvm-fg-faint`,
`theme.sp9.css` 两个主题块（`:root` 与 `:root[data-theme='light']`）都删掉了这个 token
的定义)。

清点后重新跑了一遍 usage-count 脚本(见下方"变异验证"前的核查记录),**31 个 token
全部至少被引用一次,没有仍然零使用的**。

## 与 brief 的偏离(全部已申报)

1. **`InstallBanner` 的点击守卫改成 JS 判断,不完全依赖 CSS**——Vue2 的 `.is-loading`
   只用 `pointer-events:none` 挡鼠标点击,按钮没有 `disabled` 属性,键盘 Tab+Enter/Space
   触发的 click 不受 `pointer-events` 影响,理论上仍能在 `busy` 期间重复 `emit`。这里在
   `onClick` 里显式 `if (!props.busy) emit('finish')`,视觉不变(没加原生 `disabled`
   属性,不会引入 Vue2 没有的默认禁用态视觉),按"改正确逻辑不照抄 bug"的移植纪律处理。

2. **`SpiceInfoBar` 与 `console-placeholder` 的 DOM 顺序与 Vue2 相反**——Vue2 里
   `spice-info-bar` 是 `.console-display` 的第一个子节点,排在 `console-placeholder`
   前面;New-UI 里 `ConsoleStage` 内部先渲染 `console-placeholder`(`v-if="!connected"`),
   `<slot />` 在其后,`SpiceInfoBar` 作为 slot 内容自然排在后面。**视觉上没有影响**——
   两者都是显式 `z-index` 的 `position:absolute` 元素(`spice-info-bar: 30`,
   `console-placeholder: 1`),层叠顺序由 `z-index` 决定,不看 DOM 顺序(已用截图验证,
   见下方真机/合成自查)。

3. **窄屏抽屉的 `.active` 触发条件补上,修 Vue2 死代码**——Vue2 原文用 `open` 类切窄屏
   抽屉展开态,但模板里从没出现过 `open`(`toggleSidebar` 只改 `sidebarCollapsed`),
   实测 Vue2 窄屏下侧栏是**永久隐藏、没有任何办法能再打开**的真实 bug。`VmSidebar.vue`
   根元素补 `:class="{ collapsed, active: !collapsed }"`,复用已有的 `collapsed` 状态——
   默认展开(窄屏首次进入就能看到列表),点同一个折叠按钮收起/展开。数值(位置/宽度/
   transform/transition 曲线)逐字照抄 Vue2,只有触发条件是新补的。

4. **eject 成功没有接 toast(这半条维持原状,评审已核实可接受)**——Vue2
   `handleInstallationFinished` 成功后弹一条 buefy toast。本区从 T5 起就确立了"控制台
   内联显示错误、不用 toast"的约定,安装横幅本身在 eject 成功后会因为 `bootFromDisk`
   变 `true` 而自动消失(`showInstallBanner` 条件变假),这本身就是可见的成功反馈,
   评审确认可接受、维持现状。
   ⚠️ ~~失败也曾经完全静默、`kvmEjectFailed` 也曾未被消费~~——**这部分已在下方
   "评审修复"一节整改**:评审指出"失败静默"是真缺陷(唯一的内联错误展示位
   `console-placeholder` 在这个场景下压根不渲染),已补上安装横幅自己的内联错误行,
   `useVmList.ejectInstallMedia` 的 fallback 也已从 `kvmFailedToEjectMedia` 改成直接
   消费 `kvmEjectFailed`,两个死键(`kvmEjectSuccess`/`kvmFailedToEjectMedia`)已删除。
   本条不再是暂缺登记,已解决。

5. **`@keyframes spin` 改名为 `kvm-banner-spin`**——纯技术性,不算视觉偏离。Vue2 那个
   `spin` 关键帧在它自己的 `<style>` 块里(单文件组件 scoped/非 scoped 块各自的关键帧
   在编译时都不会跟别处撞名);`kvm.css` 是平铺 `import` 的全局样式表,裸名字 `spin`
   有被应用别处同名全局关键帧覆盖的风险,加前缀避免。数值(时长/速率/角度)逐字照抄。

## 收尾自查清单(逐条结论)

| 项 | 命令 | 结论 |
|---|---|---|
| 全量测试 | `pnpm test` | **339 文件 / 2858 例 passed**(比对基线 337/337 新增 2 文件符合预期;例数比"基线 2836"多 22,其中 20 例是本任务新增,另 2 例的尾差与 T6/T7 报告里承认过的历史约数尾差同性质,不是本任务引入的回归——本任务净增的测试数〔InstallBanner 3 + SpiceInfoBar 4 + isWindowsGuest 3 + VmSidebar active 1 + KvmPage 9 = 20〕与文件数〔+2〕完全对得上,没有任何一条从绿变红)。仅有的 1 个 Errors 是 P4 遗留的 `SettingsPage.test.ts`(`service.users` mock 缺 `avatarPath`),未碰 `src/settings/`。 |
| `vue-tsc --noEmit` | 见上方命令记录 | **零错误** |
| `pnpm build` | 见上方命令记录 | **通过**(chunk 过大警告是仓库既有情况,与本任务无关) |
| 三门守卫 | `pnpm vitest run src/styles/color-guard.test.ts src/styles/theme.sp9.test.ts src/kvm/styles/kvmStyles.test.ts` | **191 例全绿** |
| i18n parity | `pnpm vitest run src/i18n/parity.test.ts` | **5 例全绿** |
| `console.log` 扫描 | `grep -rn "console.log" src/kvm/` | **零命中**(`console.warn` 5 处,均为 T3/T6 既有的有意保留,未新增) |
| 窄屏自查(~420px) | 见下方截图小节 | **通过**:侧栏变全宽抽屉(默认展开覆盖控制台区,折叠按钮收起后露出控制台且不横向溢出) |
| 静态截图自查 | 见下方截图小节 | **通过**:无空方框字形、无横向溢出 |

## 真机 + 静态截图自查

**方法**:复用 T6/T7 报告里的既有手法——不提交的临时预览页(`_dev_kvm_preview.html`/
`.ts`,`createApp(KvmPage).use(i18n).mount('#app')`,`initService` 传空 token 桩,
真机 KVM API 走 localhost 天然跳过 JWT),复用本仓库**已经在跑**的 `pnpm dev --host`
(端口 5273,PID 早于本任务存在,未新起进程)。额外为了看清 SPICE 条(真机 VM 一直是
`bootFromDisk:false`,这条提示条永远不出现,是台账挂债 D35 记录的已知情况)和 dropdown
里"开机/删除"两项(真机 VM 一直是 `running`,叫不出这两项),另建了一个纯客户端拼装
fixture 的组件预览页(`_dev_kvm_components_preview.html`/`.ts`,不发任何真机请求),
以及一个窄屏自动点击折叠按钮的预览变体(`_dev_kvm_preview_narrow.html`/`.ts`)。全部
用完 `rm -f` 删除,`git status --short` 核对过干净(只剩预期改动文件 + 原有 3 个
`design-export/*` 删除)。

无头 Chromium(`~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome
--headless=new --virtual-time-budget=5000~8000 --screenshot=...`)。

**截图 1(真机整页)**——真机 `sp9-alpine-test` 当前 `state:running`、`bootFromDisk:false`、
`iso:/DATA/KVM/isos/alpine-319.iso`,恰好满足安装横幅的显示条件,不用造假数据就能拍到
真实效果:安装横幅正确显示浅蓝底("正在从光盘安装。完成后请点击：" + 蓝色按钮"我已完成
安装"),控制台区正常显示 Alpine 启动日志(VNC 连接工作正常,未受本任务改动影响)。

**截图 2/3(组件隔离预览)**——`OverflowMenu`(stopped 态 + running 态各一份)、
`SpiceInfoBar`(linux + windows 两个变体)、`InstallBanner`(idle + busy 两个状态)六个
组件并排渲染:
- stopped 态菜单:`▶ 开机`、灰点`自动启动`、分隔线、`× 删除`(红色)——全部符号清晰
  渲染,无空方框。
- running 态菜单:`⊘ 强制关机`、`↻ 强制重启`、`‖ 暂停`、绿点`自动启动`——同样清晰。
- SpiceInfoBar 两个变体:黄色系配色、`spice://192.168.1.10:5901` 等宽字体正确显示、
  关闭按钮 `×`。
- InstallBanner busy 态:文字变透明,白色圆环转圈的 `::after` 伪元素正确渲染(静态帧
  捕捉到转到一半的状态,是预期的,不是缺陷)。

（第一次截图窗口高度不够,`.overflow-dropdown` 的 `position:absolute` 因为外层预览页
误加了 `min-height:100vh` 导致 flex 子项被拉伸到满屏高、`top:100%` 落到视口最底部之外——
这是预览页脚手架本身的问题,不是被测组件的问题,加 `align-items:flex-start` 修复脚手架
后重新截图确认。)

**截图 4/5(窄屏 420px)**——`window-size=420,800`:默认状态侧栏抽屉正确覆盖整个内容区
(全宽,`active` 类生效);另用一个自动点击折叠按钮的变体截图,确认折叠后抽屉收起、
安装横幅在 420px 下正常换行不溢出、无横向滚动条。

截图留档在
`/tmp/claude-1000/-home-nimo-NimoTech/834f00da-8cd6-4bb3-b64b-405c7ff933a9/scratchpad/kvm-shots-t8/`
(`01-page-initial.png` 真机整页、`04-components-preview-fixed.png` 组件隔离预览、
`05-narrow-420.png`/`06-narrow-420-collapsed.png` 窄屏两态)。

期间只发起了 `GET /v1/kvm/vms` 和 `GET /v1/kvm/vms/:id/vnc` 两类只读调用(复用既有
VNC 连接),**没有对 `sp9-alpine-test` 发任何 POST/PUT/DELETE**,没有点过"我已完成安装"
(会把这台测试机的启动项永久改成硬盘,违反硬约束 8),也没有点过删除/强制关机/强制重启。

## 变异验证(3 条关键断言)

**1. SPICE 条切换 VM 重新计时——去掉 `clearTimeout(spiceTimer)`**(`KvmPage.vue`
`watch(() => s.selectedVM.value?.id, ...)` 回调里):

```
AssertionError: expected false to be true
 ❯ src/kvm/views/KvmPage.test.ts:581:50
```

翻红位置精确落在"切换后 90 秒(总计 t=190s,旧计时器该在 t=180s 触发)时条子是否还在"
这一句——证明测试真的在验证"旧计时器被清掉了",不是随便断言"条子显示过"。已用备份
文件精确还原(`cp` 而非 `git checkout`,避免撤销掉整个任务的改动)。

**2. `InstallBanner` busy 时不可重复点——去掉点击守卫**(`onClick` 里直接
`emit('finish')`,不判断 `props.busy`):

```
AssertionError: expected [ [] ] to be undefined
 ❯ src/kvm/components/InstallBanner.test.ts:28:33
```

翻红,证明这条断言确实在验证"busy 时点击不触发 emit",不是空测试。已用备份文件还原。

**3. 窄屏抽屉 `active` 类——`VmSidebar.vue` 里 `active: !collapsed` 改成
`active: collapsed`**(把条件反过来):

```
AssertionError: expected [ 'kvm-sidebar' ] to include 'active'
 ❯ src/kvm/components/VmSidebar.test.ts:62:48
```

翻红,证明测试确实在验证"active 与 collapsed 相反"这个具体的逻辑关系,不是泛泛断言
"根元素有某个 class"。已用备份文件还原,`diff` 核对逐字节相同。

三次还原后重跑 `pnpm vitest run src/kvm/` 全绿,`git status --short` 确认只剩预期改动。

## 交付文件清单

- 新建:`src/kvm/components/InstallBanner.vue` / `InstallBanner.test.ts`
- 新建:`src/kvm/components/SpiceInfoBar.vue` / `SpiceInfoBar.test.ts`
- 改:`src/kvm/views/KvmPage.vue`(+87/-6)/ `KvmPage.test.ts`(+159,新增 9 例)
- 改:`src/kvm/components/OverflowMenu.vue`(下拉图标,+16)
- 改:`src/kvm/components/VmSidebar.vue`(窄屏 active 绑定,+14/-3)/ `VmSidebar.test.ts`(+8,新增 1 例)
- 改:`src/kvm/util/vmState.ts`(`isWindowsGuest`,+11)/ `vmState.test.ts`(+18,新增 3 例)
- 改:`src/kvm/styles/kvm.css`(+217/-9:SPICE 条/安装横幅/dropdown-icon/注释订正)
- 改:`src/kvm/styles/kvmStyles.test.ts`(白名单 +`dropdown-icon`)
- 改:`src/styles/theme.sp9.css`(-2:两个主题块各删一行 `--kvm-idle`)

## 挂账 / 后续

- D35/D36(brief 已列,未变):SPICE 条与安装横幅的"我已完成安装"点击路径本期无法在
  真机上完整验收(前者因 VM 一直 `bootFromDisk:false` 不出现,后者点了会把测试机启动项
  永久改硬盘),单测已覆盖显示条件与调用契约。
- ~~新增暂缺:`kvmEjectSuccess`/`kvmEjectFailed` 两个 i18n 键仍未被任何代码消费~~
  **已在下方"评审修复"一节解决**:`kvmEjectFailed` 现在被 `useVmList.ejectInstallMedia`
  的 fallback 直接消费,`kvmEjectSuccess` 已确认为死键并删除。
- P6 待接(brief 已列,未变):VM 列表为空时自动弹创建弹窗、Add VM/齿轮/Settings 三个
  入口解禁、OSSelector、快照 tab、全局设置。

---

## 评审修复(2026-08-02,第二轮)

评审对本任务(Task 8)的核实结论:两个新组件的显示条件/180s 计时/`isWindowsGuest`/
DOM 位置/Vue3 过渡类名/色值全部核对一致;三件顺带清理全部达标;两处"申报的真缺陷"
(窄屏抽屉死代码修复、Vue 3 fragment 坑)评审复核属实、修法恰当。提了 2 条 Important
+ 1 条 Minor,以及 1 条记账不用改的观察。逐条修复如下。

### Important #1:eject 失败时完全静默(真缺陷,已修)

**问题**:安装横幅点击失败时,`useVmList.ejectInstallMedia` 把错误原因写进共享的
`lastError`,但 `KvmPage.vue` 里唯一消费 `lastError`(经 `consoleErrorKey`)的展示位是
`ConsoleStage.vue` 的 `console-placeholder`(`v-if="!connected"`)。安装横幅的显示条件
要求 `state==='running'`,此时 T6 的接线早已自动建立 VNC 连接、`connected` 恒为
`true`,占位层压根不渲染——`lastError` 的内容因此永远没有渲染出口。用户实际体验:
点「我已完成安装」→ 转圈停了→ 横幅还在 → **什么提示都没有**。

**修法**(不用 toast,遵循 KVM 区既有的"内联展示"约定):

1. `InstallBanner.vue` 新增可选 prop `errorKey`,内部用 `te()/t()` 判定(同
   `ConsoleStage` 里 `errorText` 的既有写法)——`errorKey` 可能是已注册的 i18n key,
   也可能是后端返回的已解析原文,两种情况都处理。模板里新增 `<p v-if="errorText"
   class="banner-error">`,`flex-basis:100%` 借 `.installation-banner` 的
   `flex-wrap:wrap` 独占一行,没有错误时不渲染、不影响原有单行布局。
2. `kvm.css` 新增 `.banner-error` 规则(`color: var(--kvm-danger)`),已加入
   `kvmStyles.test.ts` 白名单。
3. `KvmPage.vue` 新增 `ejectError` ref。`onEjectFinish` 里:开始时先清空
   (`ejectError.value = ''`,避免"卡在上一次错误态"),`await
   s.ejectInstallMedia(vm)` 结束后读一次 `s.lastError.value` 写入
   `ejectError`——因为 `ejectInstallMedia` 内部吞掉异常不 rethrow(只把原因写进
   `lastError`),这是唯一能拿到"这次调用到底成没成功"的办法。`ejectBusy` 的重入守卫
   + `useVmList` 自己的 `ejectingIds` 守卫保证同一时刻只有一次 eject 在跑,`await`
   结束那一刻 `lastError` 一定反映的是"这次"调用的结果。
4. `ejectError` 在切换 VM 时也一并清空(合进已有的 `spiceDismissed` 那个 watch),
   避免上一台 VM 的错误提示挪到新选中的 VM 头上。
5. **fallback 键改名**:`useVmList.ts` 里 `ejectInstallMedia` 的失败 fallback 从
   `'kvmFailedToEjectMedia'` 改成 `'kvmEjectFailed'`(评审要求消费这个键)。两者译文
   本来就完全相同,这只是消掉一个 T3 遗留的重复键——`kvmFailedToEjectMedia` 因此
   变成真正的死键,已从 `zh_cn.sp9.ts`/`en_us.sp9.ts` 两个分片里删除(连同已确认死
   的 `kvmEjectSuccess` 一起删,`i18n/parity.test.ts` 核对过两边键集合仍然一致)。

**成功路径不变**:评审判为"横幅消失即隐式反馈,可接受",保持现状,没有改动。

**补测试**:
- `InstallBanner.test.ts` 新增 `errorKey` describe(3 例):无 `errorKey` 不渲染、
  已注册 key 显示译文而非键名、非 key 的后端原文原样显示。
- `KvmPage.test.ts` 新增 3 例:后端 message 原样显示在横幅上;后端 message 为空时
  显示译文"弹出安装介质失败"而不是键名 `kvmEjectFailed`;再点一次会先清掉上一次的
  报错(成功后横幅整个消失,不会残留一条"清空过的错误行"这种中间态)。

### Important #2:「切换 VM 时 dismissed 复位」是空档(真缺陷,已修)

**问题**:评审独立变异——删掉 `KvmPage.vue` 里 `spiceDismissed.value = false` 那一行,
`pnpm vitest run src/kvm/` **186 例依旧全绿**。原因:「切换 VM 时 SPICE 条重新出现并
重新计时」那条用例全程没有把 `spiceDismissed` 置成 `true` 过,只验证了计时器清理这
半条逻辑,brief Step 3 明确要求的另外半句「`dismissed` 复位」完全没被测到。

**修法**:代码本身**不需要改**(`spiceDismissed.value = false` 那一行一直都在,是
测试的覆盖面有缺口,不是实现有缺口)。补一条新用例:先在 vm-1 上点关闭按钮把
SPICE 条关掉(`dismissed=true`),再切到 vm-2,断言条子重新出现——这条路径必须靠
"复位 dismissed"才能通过,光靠"计时器被清理"救不了它。

**变异验证**(评审要求"补完自己变异确认"):把新补的这行 `spiceDismissed.value =
false` 从 `KvmPage.vue` 的 watch 里删掉,重跑 `KvmPage.test.ts`:

```
AssertionError: expected false to be true
 ❯ src/kvm/views/KvmPage.test.ts:683:48
  681|     await items[1].trigger('click') // 切到 vm-2
  682|     await flush()
  683|     expect(w.find('.spice-info-bar').exists()).toBe(true)
```

**只有这条新用例翻红(1 failed / 34 passed)**,「重新计时」那条旧用例依旧全绿——
与评审的独立变异结论完全一致,证明这条新用例精确堵上了那个空档,而不是重复覆盖
已有断言。已用备份文件(`cp`,非 `git checkout`)精确还原,`diff` 核对逐字节相同。

### Minor:删除项的 `×` 图标语义弱且与关闭按钮同符(已修)

`OverflowMenu.vue` 的删除项图标从 `×`(与 `SpiceInfoBar.vue` 的关闭按钮 `×` 同一个
字符,同页面同符不同义)改成 `⊟`(方框减号,U+229F SQUARED MINUS,与已经在用的
`⊘`/`⊞` 同一个 Mathematical Operators 区块——已用截图核对过这个区块在本机渲染清晰、
非空方框字形)。语义上"移除/减去"也比借用关闭按钮的符号更贴切。已用无头 Chromium
截图确认渲染清晰、与关闭按钮的 `×` 视觉上明显可区分。

### 记账(不用改):`ℹ`/`▶` 属 Emoji=Yes 码位

评审指出 `ℹ`(U+2139)和 `▶`(U+25B6)是 Emoji=Yes 码位,靠默认 text presentation
才呈现单色(本机截图确认单色),与仓库既有的 `⚙`(U+2699)同类风险——Windows/Android
上有渲染成彩色 emoji 的可能。沿用现有惯例放行,不在本次改动范围内,记入下方台账。

### 收尾验证(第二轮)

| 命令 | 结论 |
|---|---|
| `pnpm vitest run src/kvm/` | **193 例全绿**(比第一轮 186 例 +7:InstallBanner errorKey 3 例 + KvmPage 4 例) |
| `pnpm test` | **339 文件 / 2865 例 passed**(比第一轮 2858 +7,与上面 kvm 目录净增数字对得上),仅有的 1 个 Errors 仍是 P4 遗留的 `SettingsPage.test.ts`,未碰 `src/settings/` |
| `pnpm exec vue-tsc --noEmit` | 零错误 |
| `pnpm build` | 通过 |
| 三门守卫 | 191 例全绿(白名单新增 `banner-error`,数值本身没变多——CSS 规则增加但类名集合的断言条数不变) |
| i18n parity | 5 例全绿(删了 `kvmEjectSuccess`/`kvmFailedToEjectMedia` 两个键,两边分片同步删除,键集合仍然一致) |
| `console.log` 扫描 | 零命中 |

### 变异验证(第二轮,3 条)

1. **eject 失败错误捕获**——删掉 `KvmPage.vue` 里 `ejectError.value =
   s.lastError.value` 那一行:3 条相关用例(后端 message 原样显示 / 空 message 兜底 /
   再点一次清报错)**全部翻红**(`Test Files 1 failed`,3 failed / 1 passed / 31
   skipped,`-t` 模式匹配到的第 4 条是无关用例)。已用备份还原。
2. **spiceDismissed 复位**——见上方 Important #2 小节,已详细记录变异结果。
3. **InstallBanner busy 守卫**(沿用第一轮已做过的变异,未重做——代码本身这次没有
   改动这部分逻辑)。

### 与 brief/第一轮报告的偏离更新

在原有 5 条偏离基础上新增:

6. **`useVmList.ts` 的 eject 失败 fallback 键从 `kvmFailedToEjectMedia` 改成
   `kvmEjectFailed`**——评审要求,纯键名整合,译文不变(见上方 Important #1)。
7. **`kvmEjectSuccess`/`kvmFailedToEjectMedia` 两个 i18n 键被删除**——前者确认为
   死键(评审明确要求删除),后者是上面第 6 条改名后自然产生的死键,一并清理。
8. **`OverflowMenu.vue` 删除项图标从 `×` 改成 `⊟`**——评审 Minor 指出的同符不同义
   问题,已修(见上方 Minor 小节)。

原有 5 条偏离(InstallBanner 点击守卫 / DOM 顺序 / 窄屏 active 修复 / eject 成功
不接 toast / `spin` 关键帧改名)评审已核实全部属实且修法恰当,不再重复。

### 交付文件清单(第二轮追加)

- 改:`src/kvm/components/InstallBanner.vue`(+errorKey prop/computed/模板)/
  `InstallBanner.test.ts`(+3 例)
- 改:`src/kvm/components/OverflowMenu.vue`(删除图标 × → ⊟)
- 改:`src/kvm/composables/useVmList.ts`(eject fallback 键改名)
- 改:`src/kvm/views/KvmPage.vue`(+ejectError ref/computed/wiring)/
  `KvmPage.test.ts`(+4 例)
- 改:`src/kvm/styles/kvm.css`(+`.banner-error` 规则)/ `kvmStyles.test.ts`(白名单 +`banner-error`)
- 改:`src/i18n/zh_cn.sp9.ts`/`en_us.sp9.ts`(删 `kvmEjectSuccess`/`kvmFailedToEjectMedia` 两个死键,补注释)

---

## 定向复审修复(2026-08-02,第三轮)

复审确认第二轮 3 条全部 ADDRESSED,3 个变异复审亲手重做都按预期精确翻红,i18n 键改名
的连锁 grep 干净。但提了 2 条 Important 收尾。

### Important #1:`.banner-error` 在浅底上对比度不合格(已修)

**问题**:错误行用 `color: var(--kvm-danger)`(`#f85149`),但安装横幅底是
`--kvm-banner-bg`(`#e3f2fd`,浅蓝,全页唯一浅色块)。复审实测对比度约 **2.93:1**,
远低于 WCAG AA 正文 4.5:1 的门槛。`--kvm-danger` 是为深底控制台设计的红(其余消费处
`dropdown-item.is-danger`/`confirm-text-danger` 都在深色下拉菜单背景上),直接套到浅
蓝底会发灰难辨认。第一轮截图自查确实没覆盖到"带 errorKey 的横幅"这个具体渲染状态
(截图只测了 hover/dropdown/spice,没有单独测过错误行)。

**验算**(用 WCAG 相对亮度公式写脚本算,而不是凭肉眼估):

```python
def lum(hex_color):
    r, g, b = int(hex_color[1:3],16), int(hex_color[3:5],16), int(hex_color[5:7],16)
    def chan(c):
        c = c/255.0
        return c/12.92 if c <= 0.03928 else ((c+0.055)/1.055)**2.4
    return 0.2126*chan(r) + 0.7152*chan(g) + 0.0722*chan(b)

def contrast(c1, c2):
    l1, l2 = lum(c1), lum(c2)
    return (max(l1,l2)+0.05)/(min(l1,l2)+0.05)
```

| 底色 | 字色 | 对比度 |
|---|---|---|
| `#e3f2fd`(--kvm-banner-bg) | `#f85149`(--kvm-danger,旧值) | **2.935:1**(与复审实测的"约 2.93:1"吻合) |
| `#e3f2fd` | `#f85149` 家族的 `#b71c1c` | 5.752:1 |
| `#e3f2fd` | **`#b3261e`(新取值)** | **5.723:1** ✅ 超过 4.5:1 门槛,有余量 |
| `#e3f2fd` | `#c62828`(备选,未采用) | 4.922:1(余量比 `#b3261e` 小) |
| 对照组:`--kvm-banner-fg`(既有深蓝文字) | | 7.56:1(复审给出的既有值,量级参考) |

**修法**:新增浅底专用 token `--kvm-banner-error-fg: #b3261e`(取值参考 Material Design 3
浅色主题 error 色板,对比度用脚本核实过 5.723:1),在 `theme.sp9.css` 的 `:root` 与
`:root[data-theme='light']` 两个主题块里都加、且同值(KVM 区固定深色的既定约定,
`--kvm-banner-*` 系列本来就是这个约定下"浅蓝横幅"这个例外的一部分)。`kvm.css` 里
`.banner-error` 改用这个新 token,并在注释里写明不用 `--kvm-danger` 的理由与算出来的
数值(注释里避免写裸 hex 字面量,踩过 color-guard 不剥注释的坑,详见下方"过程事故")。

**补截图自查**(带 errorKey 的横幅错误态,第一轮确实没覆盖):见留档截图
`08-contrast-fix.png`——"弹出安装介质失败"这行错误文案清晰可辨,深红色调与横幅浅蓝底
形成明显对比,不再发灰。

**过程事故(顺手记一笔)**:第一次写 `.banner-error` 的解释注释时又踩了一次"注释里写
裸 hex 字面量 / 写 `theme.sp9.css` 这种带 `.css` 后缀的文件名"这两个 color-guard /
kvmStyles 白名单的已知坑(本任务第一轮已经在别的注释里踩过一次,这次又在新注释里
踩了第二次)——两个测试都报"发现裸颜色字面量"/"没有不在册的类名"。已改成不写具体
hex 值、不写带扩展名的文件名的措辞,重新跑三门守卫确认 191 例全绿。

### Important #2:`lastError` 串味(已修,含返回值契约变更)

**问题**:第二轮修复里,`KvmPage.vue` 在 `await s.ejectInstallMedia(vm)` resolve 后
读 `s.lastError.value`——但 `lastError` 是 `useVmList` 里 `runAction`/`toggleAutostart`/
`remove`/`ejectInstallMedia` **共用的单一 ref**。如果 eject 在途时对任意其它动作(哪怕
是同一台 VM 上的其它动作)恰好在这段等待期间失败并写了 `lastError`,不相干的错误就会
显示到安装横幅上。

**修法**(采纳评审建议):`ejectInstallMedia` 签名从 `Promise<void>` 改成
`Promise<string>`——成功返回 `''`,失败返回错误文案。调用处(`KvmPage.vue`)直接用
返回值,不再读共享 ref:

```ts
// useVmList.ts
async function ejectInstallMedia(vm: KvmVM): Promise<string> {
  if (ejectingIds.has(vm.id)) return ''      // 重入被挡:没做任何事,不是"这次调用的错误"
  ejectingIds.add(vm.id)
  try {
    await service.kvm.setBootFromDisk(vm.id, true)
    if (!alive) return ''                    // dispose 后短路,不再纠结算不算错误
    lastError.value = ''
    await fetchVMs()
    return ''
  } catch (e) {
    if (!alive) return ''
    const msg = errText(e, 'kvmEjectFailed')
    lastError.value = msg                    // 仍然保留写共享 ref,供 consoleErrorKey 兜底路径消费
    return msg
  } finally {
    ejectingIds.delete(vm.id)
  }
}
```

```ts
// KvmPage.vue
ejectError.value = await s.ejectInstallMedia(vm) // 不再读 s.lastError.value
```

重入守卫(`ejectingIds`,不复用 `processing`)和 dispose 后写保护(`if (!alive)`)两条
既有约束**都没有破坏**——只是在它们各自的短路分支里补上了"返回什么"这个新维度
(见上面代码注释)。

**补测试**:

1. `useVmList.test.ts`:
   - 成功返回 `''`(改造已有的"整表刷新"用例,追加返回值断言)。
   - 失败返回错误文案(新增,同时确认 `lastError` 仍然被写,兼容既有消费方)。
   - 重入被挡的那次返回 `''`(改造已有的重入守卫用例)。
   - dispose 后返回 `''`,且不再补打整表刷新(新增)。
2. `KvmPage.test.ts` **串味回归测试**(评审明确要求走真实交错路径,不能只测顺序调用):
   - 见下方"过程事故",第一版这条用例的教训是关键——记录了为什么交错点必须精确卡在
     "eject 自己清空 `lastError` 之后、`fetchVMs()` 整表刷新真正完成之前"这个窗口,
     而不是随便什么"eject 在途"的时间点。

**过程事故(关键教训,完整记录)**:第一版这条回归测试只是把 `setBootFromDisk` 挂起、
在"eject 在途"期间触发一个会失败的暂停动作、再放行 `setBootFromDisk`。**用变异验证
时发现:即使把 `KvmPage.vue` 改回读共享 `lastError` 的旧写法,这条用例依旧全绿**——
测试本身没有判别力。原因:`ejectInstallMedia` 自己在 `setBootFromDisk` 成功后会立刻
`lastError.value = ''` 清一次,这一步发生在它调用 `fetchVMs()` 整表刷新**之前**;如果
交错的暂停失败发生在 eject 自己清空 `lastError` **之前**,eject 后续的清空动作会把
`lastError` 盖回 `''`,新旧两种写法读到的结果因此一样,测不出区别。真正会暴露"串味"
的窗口,是**eject 自己清空 `lastError` 之后、它自己的 `fetchVMs()` 整表刷新真正完成
之前**这一段——只有交错发生在这个窗口里,旧写法(eject 完之后再读共享 ref)才会读到
别的动作重新写脏的值。

修正后的测试把第二次 `getVMList`(eject 成功路径里自己触发的整表刷新)也挂起,精确把
交错点卡在这个窗口:eject 清空 `lastError` → 交错触发暂停失败,重新写脏 `lastError`
→ 放行整表刷新,eject 真正 resolve。**变异验证**(把 `KvmPage.vue` 改回读共享
`lastError` 的旧写法):

```
AssertionError: expected true to be false
 ❯ src/kvm/views/KvmPage.test.ts:619:48
  617|       expect(w.find('.installation-banner').exists()).toBe(true)
  618|       expect(w.find('.banner-error').exists()).toBe(false)
```

**这次翻红**(`.banner-error` 不该存在但存在了),证明修正后的测试真的堵住了这个窗口,
不是空测试。已用备份文件(`cp`)精确还原,`diff` 核对逐字节相同。

### 记账(不用改)

`▶`(U+25B6)/`ℹ`(U+2139)的 Emoji=Yes 码位风险,复审同意沿用现有惯例、本次不改,
已记入台账(`.superpowers/sdd/sp9/06-p5.md`)。

### 收尾验证(第三轮)

| 命令 | 结论 |
|---|---|
| `pnpm vitest run src/kvm/` | **196 例全绿**(比第二轮 193 例 +3:useVmList 返回值契约 2 例 + KvmPage 串味回归 1 例) |
| `pnpm test` | **339 文件 / 2868 例 passed**(比第二轮 2865 +3),仅有的 1 个 Errors 仍是 P4 遗留的 `SettingsPage.test.ts` |
| `pnpm exec vue-tsc --noEmit` | 零错误 |
| `pnpm build` | 通过 |
| 三门守卫 | 191 例全绿(白名单没有新增类名,只是颜色 token 换了个名字消费) |
| i18n parity | 5 例全绿(本轮没有改动 i18n 键集合) |

### 与前两轮报告的偏离更新

在原有 8 条基础上新增:

9. **新增 token `--kvm-banner-error-fg`**——评审要求,两个主题块同值(`#b3261e`),
   对比度用脚本核实 5.723:1。
10. **`ejectInstallMedia` 签名从 `Promise<void>` 改成 `Promise<string>`**——评审建议
    采纳,返回值取代"调用方读共享 ref"的旧模式,消除跨动作串味风险。这是本任务对
    `useVmList.ts` 公开 API 形状的唯一一次改动,已确认所有既有调用处(仅
    `KvmPage.vue` 一处)与全部相关测试都已同步更新。

### 交付文件清单(第三轮追加)

- 改:`src/styles/theme.sp9.css`(+`--kvm-banner-error-fg` token,两个主题块)
- 改:`src/kvm/styles/kvm.css`(`.banner-error` 颜色改用新 token,补对比度说明注释)
- 改:`src/kvm/composables/useVmList.ts`(`ejectInstallMedia` 返回 `Promise<string>`)/
  `useVmList.test.ts`(+2 例,另有 2 条既有用例追加返回值断言)
- 改:`src/kvm/views/KvmPage.vue`(`onEjectFinish` 改用返回值)/ `KvmPage.test.ts`
  (+1 例:串味回归测试)
