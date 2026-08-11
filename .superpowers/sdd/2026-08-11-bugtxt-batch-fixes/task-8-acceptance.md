# Task 8 — 浏览器验收报告(bug.txt 批量修复)

日期:2026-08-11 · 执行方式:无头 chromium(`~/.cache/ms-playwright/chromium-1228`)+ 原生 CDP 驱动,
目标 dev server `http://127.0.0.1:5277/app/`(未重启/未重建,HMR 现状直接验收)。

## 总结论:6/6 全部 PASS(其中 Bug 5 为可选项,也验过了)

| # | 项目 | 结论 |
|---|------|------|
| 1 | 清空桌面刷新后保持空(回归) | **PASS** |
| 2 | 300 字符新建文件夹 → 前置拦截 toast、零请求 | **PASS** |
| 3 | 多选工具栏按钮文案「取消选择」 | **PASS** |
| 4 | 控制台服务下拉 option 实心底色 | **PASS** |
| 5 | AddPanel 重复添加同一应用 → toast + 不重复 | **PASS** |
| 6 | 窄窗口下 folder 磁贴方形不重叠 | **PASS** |

## 安全护栏(硬性要求)执行情况

- **CDP `Fetch.enable({patterns:[{urlPattern:'*'}]})` 全量拦截**。规则:仅 `127.0.0.1:5277` 上
  path 以 `/app/` 开头的请求(vite 前端资源)放行 continue;**其余一切请求全部本地 fulfill**,
  没有任何请求到达 dev proxy 背后的真机后端。
- 拦截台账:两轮运行合计 **6000+ 条**记录;`continued` 且非 `/app/` 的条数 = **0**(零逃逸)。
  被 stub 的后端请求共 64+ 条(appgrid / storage / folder / custom storage / compose / photos / socket.io 轮询等)。
- **写请求全部被拦下**:仅出现 1 条写 —— `POST /v1/users/current/custom/home_layout`
  (Bug 5 场景 pinToFree 后的防抖保存),由 stub 返回假 ok,**未触真机**。机主真实桌面布局零风险。
- **WebSocket 无法被 Fetch 域拦截**,故通过 `Page.addScriptToEvaluateOnNewDocument` 把
  `window.WebSocket` 整体替换为永不连接的假实现。运行中确认拦下:MessageBus
  (`/v2/message_bus/socket.io/?EIO=3&transport=websocket`)、容器终端
  (`/v1/container/stub-web-1/terminal?...`)、vite HMR ws。socket.io 回落的 HTTP 轮询由 Fetch 拦截(404)。
- 台账落盘:`/tmp/claude-1000/-home-nimo-NimoTech/98b94d3b-0d3d-47d3-b33e-8969f52098b0/scratchpad/accept/{netlog,console,results}.json`。

## 探针配方确认(两个坑都按配方绕开)

- localStorage 种子:`access_token` / `refresh_token` / `version` / `user`(JSON)/ `expires_at`(远期,防
  TerminalSocket 触发 refresh),另按场景种 `nimoos-home-layout-v2`。**缺 `version` 会被守卫静默弹回
  /login 的坑未复现 —— 配方有效**。
- 每个场景用新的 `?probe=N` 查询串整页直达(`/app/?probe=b3#/files`),不用 Page.reload。
- 主题切换:`document.documentElement.dataset.theme = 'light'`(运行时设属性,足够让 computed style
  生效;未走持久化 key,截图即为切换后实况)。

## 逐项证据

截图目录:`.superpowers/sdd/2026-08-11-bugtxt-batch-fixes/acceptance/`(本目录下均为绝对实测)。

### 1. 清空桌面刷新后保持空 — PASS
- 种子:`nimoos-home-layout-v2 = "[]"`;服务端 `GET /v1/users/current/custom/home_layout` stub 返回
  `{success:200,data:""}`(空串 = 后端"从未存过"的原样透传)。
- 载入 `#/` 后:`document.querySelectorAll('.grid-item').length === 0`(暗色、亮色两次测量均为 0),
  没有任何默认磁贴复活;localStorage 仍为 `[]`。
- 截图:`bug1-empty-desktop-dark.png` / `bug1-empty-desktop-light.png`(只有顶栏和 Dock,桌面全空)。

### 2. 超长名称新建文件夹前置拦截 — PASS
- `#/files`(stub 列表)→ 点击工具栏 `.tb-new-folder` → 对话框输入 300 个 `x`(原生 setter +
  `input` 事件,确认 `input.value.length === 300`)→ 点击确认。
- toast 实测文案:**「名称过长(最多 255 字节)」**(与 `filesNameTooLong` 逐字一致)。
- **拦截台账中确认零 `POST /v1/folder`**:从点确认到场景结束,`folder-CREATE` 匹配数 = 0,
  请求根本没有发出(前置校验挡住,不是后端挡的)。
- 截图:`bug2-name-too-long-toast.png`(toast 在页面底部可见)。

### 3. 多选工具栏「取消选择」 — PASS
- `#/files` ctrl+click 第一个 `.file-tile`(`/DATA/Documents`)→ 工具栏出现。
- `.sel-clear` 按钮文案实测:**「取消选择」**(不是「清空」)。整条工具栏按钮序列:
  `已选 1 项 · 全选 · 取消选择 · 复制 · 剪切 · 下载 · 共享到局域网 · 删除`。
- 截图:`bug3-selection-toolbar-dark.png`。

### 4. 控制台服务下拉 option 实心底色 — PASS
- 路由 `#/apps/stubapp/console`;stub `GET /v2/app_management/compose/stubapp/containers` 返回
  `{main:'web', containers:{web,db}}` → `serviceNames.length === 2` → 真实 `.console-svc` 渲染(2 个 option)。
- `getComputedStyle(option)` 实测:
  - 暗色:`background-color: rgb(30, 34, 52)`(= `--set-option-bg` #1e2234)、`color: rgb(233, 237, 247)`(= `--set-option-fg` #e9edf7)。
  - 亮色:`rgb(255, 255, 255)` / `rgb(28, 27, 25)`(= 亮色 token #ffffff / #1c1b19)。
- 截图:`bug4-console-svc-dark.png` / `bug4-console-svc-light.png`(select 本体可见;原生弹出列表
  无头截图截不到,以 computed style 为准 —— 这正是选择器守卫单测同一判据)。
  终端窗格显示「连接已断开」是 WebSocket 被安全护栏封掉的预期现象,与本项无关。

### 5. AddPanel 重复添加同一应用 — PASS(可选项)
- `#/`(空桌面)→ 点「+ 添加」→ 切「应用」tab → 对 `.lib-icon[data-key="files"]` 发
  pointerdown(元素)+ pointerup(window,无位移 = click 路径)两次。
- 第一次:桌面 `.grid-item.kind-app` 数 0 → 1;第二次:toast 实测**「该应用已在主页」**,磁贴数保持 **1**。
- 触发的布局保存(`POST .../custom/home_layout`)被拦截 stub,未触真机。
- 截图:`bug5-duplicate-app-toast.png`(添加面板开着、桌面单个「文件」磁贴、toast 可见)。

### 6. 窄窗口 folder 磁贴方形不重叠 — PASS
- 视口 900×700;种子布局:两个**相邻** folder 磁贴 + 一个 app 磁贴
  (`{kind:'folder',key:'Documents',path:'/DATA/Documents',c:1,r:1,w:1,h:1}` 等,**c/r 是 1-based**,见下方备注)。
- 实测(暗/亮两主题同值):
  - 每个 `.folder-ic`:`38.734 × 38.734 px`,`aspect-ratio: 1/1`,`min-width: 0px`;内部 `<img>` 宽同为
    38.73px —— 64px 固有宽没有再顶开格子。
  - 三个磁贴包围盒:x = 66.5 / 131.3 / 196.0,均 55×55,**两两零重叠**(0.5px 容差的相交检测,重叠对为空)。
- 截图:`bug6-folder-tiles-900x700-dark.png` / `bug6-folder-tiles-900x700-light.png`。
- 备注:第一轮跑出过「两 folder 重叠」,溯源为**探针种子用了 0-based 坐标**,`clampToGrid` 把 c:0 钳到
  c:1 与邻位撞在一起 —— 是验收脚本的错,不是产品缺陷;改成 1-based 后干净通过。`DEFAULT` 布局
  (`src/home/grid/defaultLayout.ts`)可证 c/r 从 1 起。

## 控制台错误 / 告警

- 唯一的 console error:`[vite] failed to connect to websocket`(×6)—— 我方 WebSocket 封锁的直接后果
  (HMR ws 也被封),非产品缺陷。
- 其余全部是 `[accept-stub] WebSocket blocked: ...` 的自证告警。**没有任何应用代码报错**。

## HMR 新鲜度

无需专门验证:六项修复的运行时表现(新文案「取消选择」、`filesNameTooLong` toast、option 实心色、
`min-width:0` 的方形规则、AddPanel 查重 toast、空布局尊重)全部在页面上直接观察到 —— 服务的就是修复后的代码。

## 需要真人在真机上补验的项(无头 + stub 环境覆盖不了)

1. **拖拽真实空文件夹上传**(bug #4 修复 `0b637d54`):浏览器 drag-drop 的 `DataTransfer`/FileSystemEntry
   无法用 CDP 可信伪造,需真机拖一个空目录进文件区,确认目录被创建。
2. **RAID / 共享文件夹删除**(bug #7 修复 `d6494d06`「不再把共享文件夹当保护对象」):涉及真实共享/RAID
   状态与真删除,stub 环境只能证明按钮路径,破坏性操作必须机主在场真机验证。
3. **真实最深路径上传 / 创建**(bug #2 的后端侧):前端 255 字节/4095 字节前置拦截已验;但真机上
   贴着上限的 tus 上传(后端异步 ingest 静默失败那条路)需要真实文件系统深度才能复现,建议机主抽验一次。
4. Bug 4 的原生下拉**弹出列表**观感(无头截图截不到弹出层):真机点开下拉肉眼确认暗色下不再白底白字。

## 复跑方式

驱动脚本(会话 scratchpad,临时):`/tmp/claude-1000/-home-nimo-NimoTech/98b94d3b-0d3d-47d3-b33e-8969f52098b0/scratchpad/accept/{cdp.mjs,run.mjs,run-b6.mjs}`,
`node run.mjs` 全量、`node run-b6.mjs` 单跑 Bug 6。前提:5277 dev server 在跑。脚本自带全量拦截,不会触真机。
