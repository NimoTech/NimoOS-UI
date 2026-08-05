# Task 2 报告:地基 —— token + i18n + 路由 + 空壳页

状态:**完成**(含评审后的修复追加)。commit `ef4dd2c`(初次实现)→ `3c79d6b`
(评审 3 条修复),master,HEAD 起点 `6128abb`。

截图:`task-2-screenshots/`(与本报告同目录)。

---

## 逐步执行记录

### Step 1-2:theme.sp9.css 追加 `--kvm-*` token

按 brief 逐字追加到 `:root` 与 `:root[data-theme='light']` 两块(值相同,注释说明"固定深色不跟随主题"的原因)。

```
$ pnpm vitest run src/styles/theme.sp9.test.ts
 Test Files  1 passed (1)
      Tests  2 passed (2)
```

### Step 3-4:`kvmStyles.test.ts` + `kvm.css`

第一次写完白名单守卫后跑测试,踩了两个坑,都已修正并在 commit 里体现:

1. **白名单正则把注释里的文件名/类名也算了进去**——注释里写了 `KVMFullPage.vue`、
   `theme.sp9.css`、`` `.kvm-full-page` ``、`` `open` `` 这类带前导点的写法,被
   `/\.([a-zA-Z][\w-]*)/g` 正则当成"类名引用"逮到(`vue`/`css`/`sp9`/`md`/`test`/`ts`/
   `kvm-full-page`/`open` 全部报了不在白名单)。改法:注释里一律不写前导点的文件名/类名
   写法,改成"文件名(无点)"或直接说明。

2. **更严重的:注释里写了字面 `console-*/sendkey-*/spice-*/installation-banner/
   kvm-progress-*` 来枚举"留给后续任务的类名前缀",里面的 `*/` 子串被 CSS 解析器当成
   注释的**提前闭合**——顶部大注释块从这里断开,后面到下一个真正 `*/` 之间的中文说明文字
   被当成非法 CSS token 丢弃,连带**根规则 `.kvm-page { height: 100vh; ... }` 也被吞掉**
   (解析器在遇到下一个能识别的合法规则 `.kvm-content {` 处才重新同步)。这不是靠读代码
   能看出来的,是 Step 10 目视自查时发现"深色底只占了左上角一小块、其余全是主题的柔光
   背景"才顺藤摸瓜挖出来的真实缺陷,详见下方"Step 10"小节。已改成不含 `*/` 的写法
   (`console- 系列、sendkey- 系列 ...`)。

修完后:

```
$ pnpm vitest run src/kvm/styles/kvmStyles.test.ts src/styles/color-guard.test.ts
 Test Files  2 passed (2)
      Tests  177 passed (177)
```

`kvm.css` 内容范围按 brief 只写 Task 2 用得到的段(`.kvm-page`/`.kvm-content`/
`.kvm-sidebar` 含折叠/`.kvm-sidebar-toggle`/`.kvm-header` 系列/`.vm-list`/`.empty-state`/
`.add-vm-btn`/`.kvm-main`/`.main-empty` 系列),数值逐字照抄 Vue2
`KVMFullPage.vue:1658-1973`(布局)与 `:1975-2015`(main-empty),行号已重新核对与
brief 一致,无偏移。窄屏响应块(`:2740-2759`)里的 `.open` 死代码问题也如 brief 预期
确认属实(`toggleSidebar` 只改 `sidebarCollapsed`,模板/脚本里从未出现过 `open` 这个
类名的 add/remove),按 brief 指示改用已在白名单里的 `active`,并在 CSS 注释里登记原因。

**Task 2 之外未写的段**(console-*/sendkey-*/spice-*/installation-banner/
kvm-progress-* 等)——类名已经在白名单里占位,留给后续任务实现,符合 brief 范围。

### Step 5:i18n 追加 —— 逐条核对 `zh_CN.json` 的结果

`grep` 了 Vue2 `src/assets/lang/zh_CN.json`(brief 写的路径 `src/i18n/zh_CN.json` 是
错的,实际在 `src/assets/lang/zh_CN.json`)。**brief 草稿的中文与 zh_CN.json 有 20 处
不一致**,已全部按 zh_CN.json 改正(brief 要求"不一致处以 zh_CN.json 为准并在报告里
列出改动",逐条列在下表):

| key | brief 草稿 | zh_CN.json 实际 | 说明 |
|---|---|---|---|
| kvmSelectVmTitle | 选择一台虚拟机 | **选择虚拟机** | "Select a Virtual Machine" |
| kvmSelectVmHint | 从列表中选择一台虚拟机以查看控制台并进行管理 | **从列表中选择虚拟机查看控制台并进行管理** | 少"一台"/"以" |
| kvmSettings | 设置 | **系统设置** | `$t(canEditSettings?'Settings':...)` 复用全局 "Settings" 键,Vue2 原文如此,照抄 |
| kvmSettingsDisabledHint | 停止虚拟机后才能修改设置 | **停止虚拟机以修改设置** | "Stop VM to modify settings" |
| kvmMore | 更多 | **浏览更多** | "More" 键在 Vue2 里被复用给三点菜单 tooltip,译文与场景不算贴切但这是实际展示文案 |
| kvmComingSoon | 即将支持 | **即将上线** | "Coming soon" |
| kvmResume | 继续 | **恢复** | "Resume" |
| kvmAutoStart | 开机自启 | **自动启动** | "Auto Start" |
| kvmAreYouSure | 确定吗? | **你确定吗？**(全角问号) | "Are you sure?" |
| kvmStopping | 正在停止 | **正在停止虚拟机** | "Stopping VM" |
| kvmRestarting | 正在重启 | **正在重启虚拟机** | "Restarting VM" |
| kvmDeleting | 正在删除 | **正在删除虚拟机** | "Deleting VM" |
| kvmVncPortUnavailable | VNC 端口不可用，请尝试重启虚拟机 | **VNC 端口不可用，请尝试重启**(无"虚拟机") | 原文没有 |
| kvmInstallingFromIso | 正在从 ISO 安装。安装完成后请点击： | **正在从光盘安装。完成后请点击：** | "光盘"非"ISO",且原文无重复"安装" |
| kvmFinishedInstalling | 我已安装完成 | **我已完成安装** | 顺序不同 |
| kvmEjectSuccess | 安装介质已弹出，下次重启将从硬盘启动。 | **光盘已弹出，虚拟机将在下次重启时从硬盘引导。** | "光盘"/"引导" |
| kvmSpiceAgentWin | ...虚拟机**内**...**与** USB... | ...虚拟机**中**...**和** USB... | 内→中,与→和 |
| kvmSpiceAgentLinux | 同上 | 同上 | 同上 |
| kvmToggleCtrl/Alt/Shift | 按住 Ctrl/Alt/Shift | **切换 Ctrl/Alt/Shift** | "Toggle" |
| kvmToggleWin | 按住 Windows 键 | **切换 Windows** | 同上 |
| kvmPressTab/Esc/CtrlAltDel | 按 Tab / 按 Esc / 按 Ctrl+Alt+Del | **按下 Tab / 按下 Esc / 按下 Ctrl+Alt+Del** | 少"下"字 |
| kvmFailedResume | 继续失败 | **恢复失败** | "Failed to resume" |

其余 key(kvmTitle/kvmRunningSuffix/kvmNoVms/kvmAddVm/kvmStateRunning 等状态词/
kvmPowerOn/kvmForceShutDown/kvmForceRestart/kvmPause/kvmWakeUp/kvmDelete/
kvmVncFetchFailed/kvmSpiceHint/kvmFullscreen/kvmClose/kvmFailedStart/kvmFailedStop/
kvmFailedRestart/kvmFailedPause/kvmFailedDelete/kvmFailedAutostart)与 zh_CN.json
逐字一致,未改动。

两个 **zh_CN.json 查不到、New-UI 新增** 的键,已在 `zh_cn.sp9.ts` 里用注释标注原因:

- `kvmEjectFailed`(弹出安装介质失败):Vue2 走 `getErrMsg(err, 'Failed to eject
  installation media')` 再过 `$t()`,但 zh_CN.json 没有这个键,是 Vue2 自己的遗留缺译
  (中文界面下这条实际显示英文原文)。New-UI 补上中文,不照抄这个缺译。
- `kvmExitFullscreen`(退出全屏):Vue2 全屏按钮的 `title` 恒为 `$t('Fullscreen')`(哪怕
  已经全屏也不切换文案),`alt` 属性硬编码英文 `"Exit Fullscreen"` 且从不走 i18n —— 是
  遗留的文案 bug。按项目"移植纪律"(界面 1:1、逻辑/文案 bug 不照抄,改正确逻辑并注释
  登记)让 aria-label 正确随全屏状态切换,故补一个 zh_CN.json 没有对应的键。
- `kvmToggleSidebar`(折叠/展开侧边栏):Vue2 折叠按钮是纯图标按钮,连 `title` 都没有
  (无障碍缺口)。New-UI 硬约束图标按钮必须有 `aria-label`,补上。

英文侧(`en_us.sp9.ts`):Vue2 没有独立的英文语言文件,英文界面就是 `$t()` 调用里的
原始 key 文本本身(vue-i18n 找不到翻译时回落显示 key)。所以英文文案直接照抄 Vue2
模板里 `$t('...')` 的原始字符串,与 brief 给的英文列表一致,未改动。

### Step 6-7:`KvmPage.test.ts` / `KvmPage.vue`

按 brief 实现,**唯一偏离**:测试第一个 `it` 的断言 `选择一台虚拟机` 改成
`选择虚拟机`,因为上面 i18n 核对表已把 `kvmSelectVmTitle` 订正为 `选择虚拟机`——
brief 给的测试断言和它自己给的 i18n 草稿是同一处错误的两个体现,一并订正并在测试
文件里加注释说明。其余按 brief 原样实现(占位符 `‹`/`▭`,aria-label,折叠+hover
临时展开逻辑照抄 Vue2 `KVMFullPage.vue:689-690` 的 `isSidebarCollapsed = collapsed
&& !hover`)。

### Step 8:路由

`/kvm` 加在 `...settingsRoutes` 之后、`/files/:path(.*)*` 通配兜底之前,符合硬约束 #8。

### Step 9:测试

```
$ pnpm vitest run src/kvm/ src/styles/ src/i18n/
 Test Files  9 passed (9)
      Tests  219 passed (219)

$ pnpm test
 Test Files  329 passed (329)
      Tests  2698 passed (2698)
     Errors  1 error   # 已知的 P4 遗留问题(AccountPanel.vue avatarPath mock 缺失导致
                        # 的 unhandled rejection),brief 已预告不归本任务修,未新增 failed。
                        # 基线 327 文件/2690 例 → 现在 329/2698,只增不减。

$ pnpm exec vue-tsc --noEmit
(无输出,通过)

$ pnpm build
✓ built in 11.48s   (仅有预置的 chunk 过大提示,与本任务无关)
```

### Step 10:dev server 目视自查(过程中挖出两个真实缺陷)

**遇到的障碍**:`/kvm` 是受保护路由,`src/router/guard.ts` 无 token 时会异步查
`service.users.getStatus()`。本机 dev 代理 (`vite.config.ts` 的 `DEV_PROXY`)把非
`/app/` 路径转发到真机网关 `127.0.0.1:80`,所以哪怕伪造 `localStorage.access_token`
也会在真实 API 调用 401 后被 `onAuthFail` 清掉、弹回 `/login`(截图
`00-guard-still-blocks-direct-visit-login.png` 就是这个状态)。这是认证机制生效
的正常表现,不是本任务的缺陷,但为了纯粹地看 `KvmPage.vue` 的视觉形状,改用了一个
**不提交、看完即删**的临时自查页
(`_dev_kvm_preview.html`,直接 `createApp(KvmPage).use(i18n).mount('#app')`,
绕开路由守卫与 `service` 初始化),截图后已用 `rm` 删除,`git status` 确认未留痕迹。

自查过程中连续挖到两个真实缺陷,都已修复(不在 brief 原文里,按"目视自查发现即改"
的任务要求处理,非"brief 之外自行加戏"):

1. **`kvm.css` 顶部注释里的字面 `*/` 提前闭合了 CSS 注释**——枚举"留给后续任务的类名"
   时写了 `console-*/sendkey-*/spice-*/installation-banner/kvm-progress-*`,这几个
   `*/` 子串被解析器当成注释结束符,后面到下一个真 `*/` 之间的中文说明被当非法 CSS
   丢弃,连带 `.kvm-page { height: 100vh }` 规则本身也被吞掉,导致页面只有左上角
   ~241px×1440px 一小块深色、其余是透明(露出全局登录页的柔光渐变背景)。用
   `document.styleSheets[0].cssRules` 在浏览器里直接核对解析结果才定位到:**规则
   数正好等于"除 `.kvm-page` 外的其余全部规则",`.kvm-page` 干干净净地不在里面**。
   已改成不含 `*/` 的写法。

2. **`.kvm-page` 的实心背景被全局氛围光层盖住**——`src/styles/theme.css` 给
   `body::before`/`body::after` 做了 `position:fixed; z-index:0` 的柔光玻璃背景层
   (整个 New-UI 的"通透面板浮起来"氛围设计)。`.kvm-page` 是普通静态定位的块级元素,
   按 CSS 层叠规则,**任何 `position` + 显式 `z-index`(哪怕是 0)的兄弟节点都会盖在
   它上面,与 DOM 先后顺序无关**。KVM 在 Vue2 里是纯实心深色控制台(不是玻璃面板),
   必须完全不透氛围光,所以给 `.kvm-page` 补了 `position: relative; z-index: 1`
   建立层叠上下文压过去。这不是照抄 Vue2 的问题(Vue2 压根没有这层氛围背景),是
   New-UI 特有的必要修复,已在 CSS 注释里写明原因(为什么加、不加会怎样)。

两处都已在 `pnpm vitest run src/kvm/styles/kvmStyles.test.ts src/styles/color-guard.test.ts`
(177 例)和上面 Step 9 的全量测试里重新验证过,均绿。

**自查结论**(截图见 `task-2-screenshots/`):

- `01-dark-default.png`:深色底(`#0d1117`)铺满整个视口,无透色、无横向滚动条。
  左侧 22rem 侧栏,顶部 "NIMO 虚拟机" 标题;右侧虚线圆环空态,标题"选择虚拟机"、
  提示"从列表中选择虚拟机查看控制台并进行管理"(与订正后的 i18n 一致)。
- `02-sidebar-collapsed.png`:点击折叠按钮后侧栏收到宽度 0,图标旋转 180°,主区
  自适应扩满,无布局错位。
- `03-onlight-theme-still-dark.png`:`localStorage.theme='light'` 下重新加载,
  KVM 区域外观与默认(蓝色主题)截图**逐像素一致**,验证了硬约束 #2(固定深色、
  不跟随全局主题)。
- 用 `document.documentElement.scrollWidth`(1440)与 `window.innerWidth`(1440)
  对比确认无横向溢出。
- 目视未见空方框字形(缺字体符号)——占位符 `‹`/`▭` 是常规 Unicode 符号,两种
  主题、折叠前后都渲染正常。

### Step 11:提交

```
$ git add src/kvm/views/ src/kvm/styles/ src/styles/theme.sp9.css \
    src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts src/router/index.ts
$ git commit -m "feat(kvm): 地基 —— token 分片/文案/kvm.css/路由 /kvm/ 空壳页 ..."
```

提交前 `git status --porcelain` 确认:仅 8 个目标文件被 staged(`A`/`M`),那 3 个
`design-export/*` 的 deleted 条目始终是 " D"(unstaged,working-tree 相对 index/HEAD
的差异),没有被 `git add` 碰到,提交后依旧原样保留在工作区。全程未用
`git add -A`/`git commit -a`/不带 pathspec 的 `checkout`/`stash`。

commit:`ef4dd2c`(HEAD),父提交 `6128abb`。

---

## 与 brief 的偏离汇总(未申报的偏离即缺陷,故逐条申报)

1. brief 引用的中文文案文件路径 `src/i18n/zh_CN.json` 实际是
   `src/assets/lang/zh_CN.json`(Vue2 仓库里)。已按正确路径核对。
2. i18n 中文文案 20 处按 zh_CN.json 订正,见上表(brief 明确允许且要求这么做)。
3. `KvmPage.test.ts` 第一条断言的期望字符串从 `选择一台虚拟机` 改为 `选择虚拟机`,
   与第 2 条偏离联动,非独立决定。
4. `kvm.css` 顶部注释改写(避免 `*/` 提前闭合、避免类名白名单误判),纯注释文字
   调整,不影响任何实际 CSS 规则的选择器/数值。
5. `.kvm-page` 新增 `position: relative; z-index: 1`——brief 的锚点数值列表里没有
   这两行,是 Step 10 目视自查中发现"深色底被氛围光盖住"后的必要修复,原因与验证
   过程见上文"Step 10"小节。这是新增的**非颜色**结构属性,不违反硬约束 #1(颜色
   走 token),类名白名单与 color-guard 测试均已重新跑绿。
6. 用了一个不提交的临时预览页(`_dev_kvm_preview.html`)完成纯组件级视觉自查,
   截图后已删除,`git status` 确认无残留。

---

## 交付文件清单

- `src/styles/theme.sp9.css`(修改,追加 `--kvm-*`)
- `src/kvm/styles/kvm.css`(新建)
- `src/kvm/styles/kvmStyles.test.ts`(新建)
- `src/i18n/zh_cn.sp9.ts` / `src/i18n/en_us.sp9.ts`(修改,追加 kvm* 键)
- `src/kvm/views/KvmPage.vue` / `KvmPage.test.ts`(新建)
- `src/router/index.ts`(修改,追加 `/kvm` 路由)

---

## 修复追加(评审回来的 3 条 Important)

commit `3c79d6b`(父提交 `ef4dd2c`)。评审结论摘要:CSS 数值逐条对 Vue2 核过全部
一致;20 处 i18n 订正全部在 zh_CN.json 里逐字命中,无夹带;两个自挖缺陷(注释里的
`*/` 提前闭合、氛围光层压过 `.kvm-page`)属实,修法恰当,层叠副作用评估为低风险;
白名单守卫做了变异验证,有判别力。以下 3 条已修:

### 1. `zh_cn.sp9.ts` —— `kvmToggleSidebar` 误判"无对应键"并自拟了译文

上一版报告断言 zh_CN.json 查不到 "Toggle sidebar" 键、New-UI 自己新增了
"折叠/展开侧边栏"——**这个断言本身是错的**,`grep` 确认 zh_CN.json 里
`"Toggle sidebar": "切换侧边栏"` 确实存在(是我上一轮没搜到,不是 Vue2 缺失)。
这违反了硬约束"中文文案以 zh_CN.json 为准,不许自己翻译"。已订正为 `切换侧边栏`,
注释只保留"Vue2 该按钮没有 title,这里为 a11y 补 aria-label"这半句事实性说明,
删掉了错误的"无对应键"断言。`en_us.sp9.ts` 的 `Toggle sidebar` 本来就是对的
(与 Vue2 $t key 原文一致),未改动。`KvmPage.test.ts` 里没有对这个字符串的字面
断言(只测 `aria-label` 属性非空),故无需同步改测试。

### 2. `kvm.css:65` —— `.toggle-icon { display: inline-block }` 补登记未申报偏离

这一行本身的修法是对的(Vue2 用 `b-icon`——bulma 组件自带合适的 display,这里换成
裸 `<span>` 占位符后,inline 元素默认不吃 `transform`,必须显式 `inline-block`
才能让 `.collapsed` 状态的 `rotate(180deg)` 生效),但上一版没有按项目"未申报的
偏离即缺陷"的规矩写注释登记。已在该规则上方补一行中文注释,说明 Vue2 用什么、
这里为什么换、为什么必须显式声明这个 display。

### 3. `theme.sp9.test.ts` —— 补齐"取值相同"这条防护(此前只查 token 名集合)

原有守卫只比较 `:root` 与 `:root[data-theme='light']` 两块的 **token 名集合**
是否一致,不比较**取值**——而 P5 的硬约束恰恰是"`--kvm-*` 两块必须取值相同(固定
深色不跟随主题)",这条此前完全没有自动化防护,后续 6 个任务往里加 token 时,
任何一次"两块名字都加了、值却打错/漏改"的单边漂移都测不出来。

新增 `tokenMapOf(selector)` 解析出 `token 名 -> 声明值` 的映射,再加一条断言:
只挑 `--kvm-` 前缀的 token,逐个比较 `:root` 与 light 块里的字面量必须相同
(非 `--kvm-` 前缀的 token,如 `--set-*`,本来就该两块取不同值,断言里显式排除,
不误伤设置区)。

变异验证(按要求做完已改回):

```
$ sed -i '83s/#e0a800/#ff0000/' src/styles/theme.sp9.css   # light 块把 --kvm-warn 改红
$ pnpm vitest run src/styles/theme.sp9.test.ts
 FAIL  ... AssertionError: 以下 --kvm-* token 在两套主题块里取值不同(违反固定深色约束):
   --kvm-warn: root=#e0a800 light=#ff0000
 Tests  1 failed | 2 passed (3)          # 新断言如期翻红,诊断信息点名了具体 token 和两边的值

$ git checkout -- src/styles/theme.sp9.css                 # 带具体路径改回,非裸 checkout
$ pnpm vitest run src/styles/theme.sp9.test.ts
 Tests  3 passed (3)                     # 改回后重新转绿
```

### 交接给后续任务(评审给的层叠副作用结论,原文转述)

`Task 2` 给 `.kvm-page` 加了 `position: relative; z-index: 1` 来压过全局氛围光层
(`body::before`/`::after`,`position:fixed; z-index:0`)。评审对此的风险结论:

- `position: relative` **不会**破坏后代的 `position: fixed`(只有
  `transform`/`filter`/`perspective`/`will-change`/`contain` 这几个属性会把
  fixed 后代的定位基准从视口改成该祖先)。
- `requestFullscreen()` 走浏览器的 top layer,不受这个 `z-index` 影响。
- Vue2 KVM 内部各元素的 `z-index` 全部 ≤ 50,且都锚定在同一个层叠上下文里,相对
  次序不变,不会因为 `.kvm-page` 自己的 `z-index:1` 而错乱。
- **唯一残留的注意事项**:`.kvm-page` 的 `z-index:1` 把它相对 **body 级兄弟节点**
  的有效层级钳在了 1。如果后续任务要在 `.kvm-page` **内部**渲染某个需要盖住全局
  UI 的遮罩/弹层(例如需要盖过 `AppToast` 的 z-index 60,或盖过某个全局弹窗的
  z-index 1000),**不能**指望在 `.kvm-page` 内部简单地叠加更大的 `z-index` 就够——
  必须把该遮罩 **teleport 到 `<body>`**(脱离 `.kvm-page` 的层叠上下文),才能正确
  盖住那些 body 级的全局 UI。P6/P7(创建向导、VM 设置、快照弹窗等大概率会用到弹层)
  接手前应先确认这条。
