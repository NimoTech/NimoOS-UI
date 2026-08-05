# Task 4 报告:左侧栏两个组件(VmListItem / VmSidebar)

commit `329deb4`(父提交 `201f626`)。

## i18n 键实际值核对(开工前逐条 grep 确认)

`grep -n "kvm" src/i18n/zh_cn.sp9.ts` / `en_us.sp9.ts` 核对结果,brief 引导里指出的 7 处过时断言全部按实际值使用,额外确认了本任务新用到的几个键:

| key | 实际值(zh) | 用途 |
|---|---|---|
| `kvmTitle` | NIMO 虚拟机 | 头部标题 |
| `kvmRunningSuffix` | 运行中 | 头部计数后缀 |
| `kvmNoVms` | 暂无虚拟机 | 空态文案 |
| `kvmAddVm` | 添加虚拟机 | 底部按钮 |
| `kvmComingSoon` | 即将上线(非 brief 草稿的"即将支持") | 两个禁用按钮的 title |
| `kvmSettings` | 系统设置 | 齿轮 aria-label |
| `kvmStateRunning/Stopped/Paused/Suspended/Error` | 运行中/已停止/已暂停/已挂起/错误 | 状态点文字 |
| `kvmToggleSidebar` | 切换侧边栏 | 折叠按钮(T2 已用,未改动) |

VmSidebar.test.ts 按此把 brief 草稿里的 `'即将支持'` 断言改成了 `'即将上线'`(brief 自己在开头表格里已经标注这处要改)。

## Vue2 行号核对

`components/KVM/KVMFullPage.vue`:
- 模板结构 `:10-67`(侧栏 aside、header、vm-list、add-vm-btn)—— 与 brief 一致,读过全文确认无偏差。
- `.vm-list-item` 及子选择器样式 `:1843-1950` —— 与 brief「:1836-1948」基本吻合(实际读到 1843 起才是 `.vm-list-item` 规则本体,1836-1842 是上一个 `.empty-text` 收尾)。
- 三个 `@keyframes breathe-*` 在 `:2762-2793` —— 与 brief 一致。
- `.add-vm-btn` 样式在 `:1952-1972`,`.kvm-header`/`.kvm-status`/`.kvm-settings-btn` 在 `:1736-1817`(brief 未给出这段行号,读源码后补充核对)。

## Step 1:VmListItem.test.ts(先写测试,确认失败)

按 brief 原文写入 7 个用例。跑 `pnpm vitest run src/kvm/components/VmListItem.test.ts`:

```
Error: Failed to resolve import "./VmListItem.vue" ...
Test Files  1 failed (1)
      Tests  no tests
```

红色确认(组件不存在,连测试都跑不起来)。

## Step 2:实现 VmListItem.vue

模板照 Vue2 `:36-58`。状态文字用 `stateLabelKey`(T1)+ `te()`/`t()` 判断:已注册的 key 走 i18n,未注册(crashed/missing)原样显示后端字符串,同时避免 vue-i18n 控制台警告刷屏(brief 已提示这个坑)。样式追加到 `kvm.css`(`.vm-list-item` 及全部子选择器 + 三个 `breathe-*` 关键帧),颜色全部换成已在 `theme.sp9.css` 里定义好的 `--kvm-*` token(`--kvm-ok`/`--kvm-warn`/`--kvm-danger`/`--kvm-idle`/`--kvm-ok-glow-weak/strong` 等,T2 阶段已铺好,本任务直接消费,没有新增 token)。

```
pnpm vitest run src/kvm/components/VmListItem.test.ts src/kvm/styles/kvmStyles.test.ts
Test Files  2 passed (2)
      Tests  9 passed (9)
```

类名白名单核对:brief 要求用到的 `vm-list-item`/`vm-item-icon`/`os-icon`/`vm-item-info`/`vm-item-name`/`vm-item-specs`/`vm-item-status`/`status-indicator`/`status-dot`/`status-text`/`running`/`stopped`/`paused`/`suspended`/`error`/`active` **全部已在 `kvmStyles.test.ts` 白名单里**(T2 预先登记好的),本任务**没有新增类名、未改动白名单文件**。

## Step 3:VmSidebar.test.ts(先写测试,确认失败)

按 brief 原文写入 9 个用例,唯一改动是把「即将支持」断言改成核对过的实际值「即将上线」。跑测试确认红:

```
Error: Failed to resolve import "./VmSidebar.vue" ...
Test Files  1 failed (1)
      Tests  no tests
```

## Step 4:实现 VmSidebar.vue,接入 KvmPage.vue

- `VmSidebar.vue`:根元素是 `<aside class="kvm-sidebar">`,`:class="{ collapsed }"` 由 prop 直接控制。头部 logo 用 `src/kvm/assets/kvm.svg`(从 `NimoOS-UI/src/assets/img/app/kvm.svg` 复制而来,与 New-UI 已有的 `src/home/apps/icons/kvm.svg` 字节完全一致,`diff` 确认过;放进 `kvm/` 域内自己的 assets 目录,和 T1 的 os 图标同规格,不跨域引用 `home/`)。齿轮与添加按钮均 `disabled` + `:title="t('kvmComingSoon')"`(2026-08-02 拍板要求),齿轮额外带 `:aria-label="t('kvmSettings')"`。两个图标用纯文字符号(`⚙`/`+`/空态 `⬚`)、`aria-hidden="true"`,不是 emoji——与 T2 在 `KvmPage.vue` 里已经立的先例(`‹`/`▭`)一致的占位手法。
- `KvmPage.vue`:引入 `useVmList()`,`onMounted` 调 `fetchVMs()`,`onUnmounted` 调 `dispose()`;把原来的占位 `<aside>` 换成 `<VmSidebar :vms=... :selected-id=... :running-count=... :is-loading=... :collapsed=... @select="s.selectVM" @mouseenter=... @mouseleave=... />`。`@mouseenter`/`@mouseleave` 依赖 Vue 3 对未声明为 emits 的原生 DOM 事件的 attrs fallthrough(单根组件自动落到根元素),没有在 VmSidebar 内部重新声明/转发这两个事件——验证过 T2 原有的两条折叠/hover 测试原样通过,证明这个假设成立。

```
pnpm vitest run src/kvm/components/VmSidebar.test.ts
Test Files  1 passed (1)
      Tests  9 passed (9)

pnpm vitest run src/kvm/views/KvmPage.test.ts   # T2 遗留的 4 条不能退步
Test Files  1 passed (1)
      Tests  4 passed (4)

pnpm vitest run src/kvm
Test Files  8 passed (8)
      Tests  85 passed (85)
```

## Step 5:全量 + 类型检查 + dev server 目视 + 提交

```
pnpm test
Test Files  332 passed (332)
      Tests  2750 passed (2750)
     Errors  1 error   # AccountPanel.vue avatarPath 未 mock,P4 已知遗留缺陷,非本任务引入
```

数字核对:基线 330 文件/2732 例 passed,本任务新增 2 个测试文件(VmListItem.test.ts / VmSidebar.test.ts)= 332 文件;新增 9+9=18 例 = 2750 例。**只增不减,未新增 failed**,与 brief 判定标准一致(那条已知的 SettingsPage unhandled rejection 依旧只是打印一次 error 导致非零退出码,不计入 failed 计数,这次 `pnpm test` 输出甚至没有把它算进 Test Files 的失败计数)。

```
pnpm exec vue-tsc --noEmit
# 无输出,exit 0
```

### 变异验证(3 处,均按预期翻红后已复原)

1. **VmListItem**:去掉根元素 `:class="{ active }"`。`active 时加 active 类` 翻红:
   `AssertionError: expected [ 'vm-list-item' ] to include 'active'`。复原后 7/7 绿。
2. **VmSidebar**:把 `v-if="vms.length === 0 && !isLoading"` 改成 `v-if="vms.length === 0"`(去掉 `!isLoading` 守卫)。`加载中且列表为空 → 不显示空态` 翻红:
   `AssertionError: expected 'NIMO 虚拟机 0 / 0 运行中⚙⬚暂无虚拟机+添加虚拟机' not to contain '暂无虚拟机'`。复原后 9/9 绿。
3. **VmSidebar**:去掉 `add-vm-btn` 的 `disabled`。`Add VM 按钮渲染但禁用` 翻红:
   `AssertionError: expected undefined to be defined`。复原后 9/9 绿。

（另外尝试过第 4 处:把 `te(stateKey.value) ? t(...) : stateKey.value` 改成恒 `t(stateKey.value)`,发现**没有翻红**——因为 vue-i18n 对不存在的 key 本身就原样返回 key 字符串,`te()` 判断只影响是否打控制台警告、不影响可观察的渲染文本。这不是一条有效的变异断言,已如实记录并换了别的三处验证,没有把这条空验证充数写进上面。）

## dev server 目视自查

`pnpm dev --host` 起在 5273 时端口被占(另一个长期存活的会话在用,未去动它),vite 自动改绑 5274。真机后端网关(`127.0.0.1:80`)已经在跑,dev server 的 `DEV_PROXY`(`^/(?!app/)`)会把非 `/app/` 前缀请求转发过去;直接访问 `/app/#/kvm` 会撞路由守卫要求登录,不想为了纯视觉自查伪造凭据,于是沿用 T2 报告里提到的手法:一个**不提交**的临时预览页 `_dev_kvm_preview.html` + `_dev_kvm_preview.ts`,直接 `createApp(KvmPage).use(i18n).mount('#app')`,额外调了一次最小 `initService(...)` 桩(token 全部返回 null)——因为不初始化的话 `@nimotech/nimoos-service` 的请求拦截器拿不到 `getLang()` 等配置,`fetchVMs()` 会静默失败。

踩到一个 T2 报告没写清楚的坑:临时页面必须放在项目根(与 `index.html` 同级),但**访问 URL 必须带 `/app/` 前缀**(`http://host:port/app/_dev_kvm_preview.html`),否则会被 `DEV_PROXY` 正则整体转发到真机网关(实测响应是网关的 `{"message":"Not Found"}` JSON,而不是 vite 404,说明确实被转发出去了)。`vite.config.ts` 的 `base:'/app/'` 让 dev server 把 `/app/*` 请求剥掉前缀映射回项目根文件,所以带 `/app/` 前缀访问、文件仍放根目录,两者都要对上。

用无头 Chromium(`~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`,本机没装 playwright 包但缓存有二进制,按记忆里的既有做法)截图:

- 真实调用了本机 KVM 后端(`curl http://127.0.0.1/v1/kvm/vms` 确认 200,返回真机上唯一一台 `sp9-alpine-test`,running/2 vCPU/1024 MB/os=linux)——因为 dev proxy 转发请求源自 Node 进程本身(127.0.0.1),网关按约定对本机来源跳过 JWT 校验,不需要伪造登录态就能拿到真实数据。
- 截图结果:头部显示「1 / 1 运行中」、绿色状态点;VM 行显示「sp9-alpine-test」「2 vCPU」「1.0 GB」,因为 `useVmList.fetchVMs()` 在无 `selectedVM` 且列表非空时会自动选中第一项(T3 的既有行为,非本任务引入),所以该行带 active 高亮(紫色边框+浅紫底);行右侧绿色圆点 + 「运行中」文字。右侧仍是空态(本任务未接线选中态渲染,右侧内容属于后续任务范围)。
- `--dump-dom` 核对 DOM:两个禁用按钮属性齐全 —— `<button class="kvm-settings-btn" ... disabled="" title="即将上线" aria-label="系统设置">`、`<button class="add-vm-btn" ... disabled="" title="即将上线">`。
- 控制台无 warning/error(用 `grep -i "warn|error"` 过滤过输出,排除掉一条无关的系统 DBus/UPower 错误)。
- 折叠态、亮色主题未额外截图:折叠/hover 展开逻辑已由 `KvmPage.test.ts` 的既有单测覆盖(未改动、仍 4/4 绿);KVM 区按设计固定深色不跟随全局主题切换,亮色截图对本任务无增量信息,故未做。

截图完成后 `rm` 删除了 `_dev_kvm_preview.html`/`.ts`,`git status --short` 确认无残留;临时起的 dev server(端口 5274)已按 PID 停掉,另一个原本就在跑的 5273 实例未动。

## 与 brief 的偏离(全部已申报)

1. `kvmComingSoon` 断言文案由 brief 草稿的「即将支持」改为核对过的实际值「即将上线」(brief 表格里已预先声明这处要改,非本任务自创偏离)。
2. 头部 logo 资源:brief 未点名素材来源,选择把 `kvm.svg` 复制进 `src/kvm/assets/`(而非引用 `src/home/apps/icons/kvm.svg`),保持 `kvm/` 域内资源自包含、与 T1 的 os 图标同放置规则,字节内容与两处既有拷贝完全一致(`diff` 确认)。
3. 决定用「文字符号 + aria-hidden」表示齿轮/加号/空态图标,理由与 T2 在 `KvmPage.vue` 里已经采用的占位手法(`‹`/`▭`)一致,非新增风格。
4. `KvmPage.vue` 里 `@select="s.selectVM"`:`selectVM` 返回 `Promise<void>`,这里没有 `void`/`await` 包一层,直接绑定为事件处理函数——Vue 模板里这是常见写法(表达式绑定,不强制返回 void),`selectVM` 内部的 `fetchVM` 已经在自己的 try/catch 里吞掉失败(仅 `console.warn`),不会产生未处理 rejection。

## 交付文件清单

- `src/kvm/components/VmListItem.vue` / `VmListItem.test.ts`(新建)
- `src/kvm/components/VmSidebar.vue` / `VmSidebar.test.ts`(新建)
- `src/kvm/assets/kvm.svg`(新建,头部 logo)
- `src/kvm/views/KvmPage.vue`(修改,接入 VmSidebar + useVmList)
- `src/kvm/styles/kvm.css`(修改,追加 vm-list-item 系列 + 三个 breathe-* 关键帧)
- `src/kvm/styles/kvmStyles.test.ts`:**未改动**(本任务要用的类名全部已在白名单里,核对后确认无遗漏)

---

# 修复追加(评审回来的 2 条)

commit `f7323d6`(父提交 `329deb4`)。

## 1(Important)`selectedId → active` 的接线零覆盖

评审用变异 `VmSidebar.vue:65` 的 `:active="selectedId === vm.id"` → `:active="false"`,`src/kvm/components/` + `src/kvm/views/` 20/20 全绿放行——说明 `selectedId` 这个 prop 的唯一用途此前没人真正测过(`VmListItem.test.ts` 只测了 prop→class 这一跳,`VmSidebar.test.ts` 只数了行数和 emit)。

在 `VmSidebar.test.ts` 补了 2 条:

```ts
it('selectedId 指向谁,谁就带 active 类(且只有它)', () => {
  const items = mk({ selectedId: 'a' }).findAll('.vm-list-item')
  expect(items[0].classes()).toContain('active')
  expect(items[1].classes()).not.toContain('active')
})

it('selectedId 换一台,高亮跟着移动', () => {
  const items = mk({ selectedId: 'b' }).findAll('.vm-list-item')
  expect(items[0].classes()).not.toContain('active')
  expect(items[1].classes()).toContain('active')
})
```

**变异复现(先跑红)**:把 `VmSidebar.vue:65` 改成 `:active="false"`,跑 `pnpm vitest run src/kvm/components/ src/kvm/views/`:

```
FAIL  src/kvm/components/VmSidebar.test.ts > VmSidebar > selectedId 指向谁,谁就带 active 类(且只有它)
AssertionError: expected [ 'vm-list-item' ] to include 'active'
 ❯ src/kvm/components/VmSidebar.test.ts:64:32

FAIL  src/kvm/components/VmSidebar.test.ts > VmSidebar > selectedId 换一台,高亮跟着移动
AssertionError: expected [ 'vm-list-item' ] to include 'active'
 ❯ src/kvm/components/VmSidebar.test.ts:71:32

Test Files  1 failed | 2 passed (3)
      Tests  2 failed | 20 passed (22)
```

两条新用例精确复现了评审报的缺口。用 `git checkout -- src/kvm/components/VmSidebar.vue` 还原(`diff` против mutation 前的备份确认字节级一致),重跑 `pnpm vitest run src/kvm/` 回到 87/87 绿(85 基线 + 这 2 条)。

## 2(Minor)禁用按钮 hover 高亮 + `cursor:pointer` 仍生效

`kvm.css` 的 `.add-vm-btn`(:223-243)和 `.kvm-settings-btn`(:161-177)的 `:hover` 规则此前对 `disabled` 态照样生效——鼠标移上去变紫底紫字、光标还是小手,看起来像能点,但这两个按钮现在就是 P6 前的占位禁用态。

`grep` 确认本项目**没有** `cssCascade` 一类的 CSS 优先级自算工具;但 `src/settings/styles/settings.css` 已有对应的既有惯例(`.set-btn:hover:not(:disabled)` + `.set-btn:disabled { opacity: 0.5; cursor: not-allowed }`),照抄这套写法,写成可复用的形式(注释里写明是 New-UI 新增态、原因是 P6 前占位、供 Task 5 的 `ConsoleHeader` 同款按钮抄):

```css
.kvm-settings-btn:hover:not(:disabled) { color: var(--kvm-accent); }
.kvm-settings-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.add-vm-btn:hover:not(:disabled) { background: var(--kvm-accent-soft); color: var(--kvm-accent); }
.add-vm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
```

**锁定用例**:jsdom 测计算样式对"谁压过谁"不可靠,改成对 `kvm.css` 源码文本的静态断言(与 `kvmStyles.test.ts` 现有的类名白名单/color-guard 用同一读文件方式,比 jsdom 猜级联更准、也更贴近这个坑的本质——它是级联/选择器写法的问题,不是运行时计算值的问题):

```ts
describe('禁用按钮 hover/cursor 不误导用户(add-vm-btn / kvm-settings-btn)', () => {
  it('hover 规则必须带 :not(:disabled),不能对 disabled 态生效', () => {
    expect(src).not.toMatch(/\.add-vm-btn:hover\s*\{/)
    expect(src).not.toMatch(/\.kvm-settings-btn:hover\s*\{/)
    expect(src).toMatch(/\.add-vm-btn:hover:not\(:disabled\)/)
    expect(src).toMatch(/\.kvm-settings-btn:hover:not\(:disabled\)/)
  })

  it('disabled 态必须显式 cursor: not-allowed(禁用按钮不能看起来像能点)', () => {
    const addDisabledBlock = src.match(/\.add-vm-btn:disabled\s*\{([^}]*)\}/)
    const settingsDisabledBlock = src.match(/\.kvm-settings-btn:disabled\s*\{([^}]*)\}/)
    expect(addDisabledBlock?.[1]).toMatch(/cursor:\s*not-allowed/)
    expect(settingsDisabledBlock?.[1]).toMatch(/cursor:\s*not-allowed/)
  })
})
```

写这条断言时踩了一个自己挖的小坑:最初在 `kvm.css` 注释里写了 `settings.css 里的 .set-btn:hover:not(:disabled)`,结果被同文件里**不剥注释**的类名白名单扫描器(`kvmStyles.test.ts` 的「没有不在册的类名」用例,只有 color-guard 那条会剥注释)当成新类名 `set-btn`/`css` 抓了出来,直接红。已改写成不在注释里字面写出外部 class 名的表述,复测绿。

**变异复现(先跑红)**:把 `.add-vm-btn:hover:not(:disabled)` 改回裸 `.add-vm-btn:hover`,跑 `pnpm vitest run src/kvm/styles/kvmStyles.test.ts`:

```
FAIL  src/kvm/styles/kvmStyles.test.ts > 禁用按钮 hover/cursor 不误导用户(add-vm-btn / kvm-settings-btn) > hover 规则必须带 :not(:disabled),不能对 disabled 态生效
AssertionError: expected ... not to match /\.add-vm-btn:hover\s*\{/
 ❯ src/kvm/styles/kvmStyles.test.ts:67:21

Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
```

`cp` 还原备份文件(`diff` 确认字节级一致),重跑回到绿。

## 全量复核

```
pnpm vitest run src/kvm/
Test Files  8 passed (8)
      Tests  89 passed (89)   # 87(上一轮)+ 2 处 disabled hover/cursor 静态断言

pnpm test
Test Files  332 passed (332)
      Tests  2754 passed (2754)   # 2750(上一轮)+ 4(selectedId 2 条 + disabled 2 条)
     Errors  1 error   # 已知的 AccountPanel.vue avatarPath P4 遗留缺陷,非本次改动引入,非零退出码符合预期

pnpm exec vue-tsc --noEmit
# 无输出,exit 0
```

数字只增不减、无新增 failed,与判定基线一致。

## 交付文件清单(本次追加)

- `src/kvm/components/VmSidebar.test.ts`(修改,+2 用例)
- `src/kvm/styles/kvm.css`(修改,disabled 态 hover/cursor 修复 + 申报注释)
- `src/kvm/styles/kvmStyles.test.ts`(修改,+2 静态断言用例)
