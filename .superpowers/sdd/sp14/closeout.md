# Task 10 收尾门 + 台账(SP14 AI 区补迁)

范围:`65c7928..HEAD`(九个功能提交,见下方"本期提交清单"),外加本 Task 10 过程中
新增的 8 个提交(修 3 个真缺陷 + 补全 OSS 导出清单)。全部命令在
`/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/ai-catchup` 跑出,分支 `sp14-ai-catchup`。

## 一、收尾门原始数字(均已验证为真实通过,非误报)

| 命令 | 结果 | 备注 |
|---|---|---|
| `pnpm exec vitest run`(全量) | **655 files passed (655) / 10495 tests passed (10495)**,exit 0 | 见下方"路上踩到的坑"——中途两轮跑出过 4-5 个失败文件,逐条查实后全部是自造的假信号或已修复的真缺陷,最终这一轮是**修完之后的干净重跑** |
| `pnpm exec vue-tsc --noEmit` | **0 错误**,exit 0,无输出 | |
| `pnpm exec vitest run src/styles`(color-guard 等) | **4 files passed (4) / 1060 tests passed (1060)** | |
| `pnpm exec vitest run src/i18n`(parity) | **7 files passed (7) / 189 tests passed (189)** | 首轮在系统重负载下 `photosSlice.test.ts` 的一条用例超时(5000ms),单独重跑 3.19s 通过,系统空闲后重跑整个目录同样全绿——判定为负载导致的假信号,不是真缺陷 |
| `pnpm build`(`vue-tsc --noEmit && vite build`) | **构建成功**,exit 0,1m11s | Rollup 报"chunk 大于 500kB"与"`/* #__PURE__ */` 注释位置无法识别"两类**警告**(非本期改动引入,前者是既有的代码分割建议,后者是 `@vueuse/core` 第三方包自带的),均不影响构建结果 |

全量跑的过程中 stderr 有大量 jsdom `Not implemented: navigation`(收藏夹 `exportZip` 走
`location.href =`,jsdom 不支持整页跳转,是已知的测试环境限制,非失败)与一条
`/tmp/nimoos-www-XXXXXX 不存在` 的提示(某处沙盒清理测试打印的操作指引,同样不是失败)——
两者都不计入失败数,`655/655` 与 `10495/10495` 是真实通过数。

### 路上踩到的坑(如实记录,而非事后抹平)

**第一轮跑全量时(commit `bfb0bcd` 之前)**:自造的 harness.html 在仓库根目录、且当时
`.superpowers/sdd/.../progress.md` 未提交,工作树不干净,导致 `oss/media-wave.test.mjs`、
`oss/tree.test.mjs`、`oss/export-rsync.test.mjs` 三个自检测试报"工作树不干净,导出中止"——
**这是自己造成的假阳性**,不是仓库缺陷。修法:把 `progress.md` 提交、把 harness 两个文件挪进
`.gitignore`(commit `bfb0bcd`),而不是绕过检查。

**同一轮还有一个真缺陷**:`src/ai/styles/knowledgeStyles.test.ts` 的裸色守卫在
`McpServerDetail.vue` 报红——根因是 Task 8(`35a4006`)在 `<template>` 里写了一行 HTML 注释
`<!-- #141: which MCP protocol version... -->`,而三个连续十进制数字同时也是合法的十六进制数字,
守卫的正则 `/#[0-9a-fA-F]{3,8}\b/` 把 `#141` 误判成裸色字面量。同一个票号已经在 `<script>`
块的注释里出现过(守卫不扫描 `<script>`),模板注释里这份是冗余的——改写模板注释去掉
`#141` 即可(commit `00d9f74`),不碰守卫本身。

**清理工作树后第二轮跑,`oss/` 三个自检测试又连续报出三个真实的、SP14 本期造成的清单漂移**
(定位方法:`git log --oneline 65c7928..HEAD -- <文件>`,三次都精确指向 Task 9 `d4d3771`
"give Knowledge a desktop tile"):

1. `src/home/grid/defaultLayout.ts` 的私有侧哈希钉过期(新增了 `knowledge` 桌面磁贴条目)——
   核对 `oss/files/defaultLayout.ts` 本就不含任何 AI 磁贴,只需更新哈希钉(commit `34529c9`)。
2. `src/home/composables/useOpenAction.ts` 的一条 PATCH 锚点因为 `knowledge` 分支插进了
   `ai` 分支和 `window.location.href` 兜底之间,原六行锚点整体 hits=0——照文件现场文本
   扩到七行,`replace` 不变(commit `7e93b64`)。
3. `src/home/composables/useOpenAction.test.ts` 的 AI-cutover 整块删除锚点同理,因为
   `knowledge` 用例插进了 describe 内部,原 7 条用例锚点变成了 8 条——同样扩锚点、
   `replace` 不变(commit `e706b7a`)。

**第三个自检测试(`不带 --skip-guard 也能跑通`)随后暴露出这次漂移真正剩下的核心工作**:
`knowledge` 系统应用本身(`systemApps.ts` 的 import + glyph + 数组条目、两个 base 语言的
`appKnowledge` 键、`theme.css` 的 `.ic-knowledge` 渐变规则、图标资源、以及一个只测
knowledge 的孤儿测试文件)**从未被剥离清单纳管**——泄漏守卫命中 9 处,一个字节不落盘。
按 `oss-web-ui-export-project` 记忆里的配方,逐项比照已有的 `photos`/`ai` 处理方式补齐
(DELETE 图标 + 孤儿测试文件,PATCH 摘掉产品码与文案与配色),commit `7f1ed04`。

**修 `.gitignore` 时踩了一个自己的坑**:harness 的忽略行最初插在
`# Claude Code 本地状态...` 和 `# .superpowers/ 入库...` 两行注释之间,恰好切开了
`oss/manifest.mjs` 里 `.gitignore` 的一条 PATCH 锚点(该锚点按精确子串匹配这段连续文本)。
挪到文件末尾后两个既有锚点都完整无缺(commit `c4703c5`)。

以上 5 个 `chore(oss)`/`fix` 修复 commit 全部是**本期九个功能提交造成的、之前没有暴露过**的
收尾债务,不是凭空发明的整改——每一处都先用 `git log <文件>` 定位到具体是哪个 Task/commit
造成的漂移,再对照既有的 photos/ai 处理惯例补齐,没有放宽任何守卫或删掉任何哈希钉。

## 二、OSS 导出(安全形式)

```
node oss/export.mjs --out .../scratchpad/oss-sp14 --no-commit --allow-dirty-oss
```

**结果:成功,exit 0。** `DELETE 73 · REPLACE 4 · PATCH 256`,泄漏守卫**零真实命中**
(3 个二进制文件——两张壁纸 jpg + 一个 settings.png——按设计跳过内容扫描,已在
`.export-report.txt` 记录,非泄漏)。产出树落在
`/tmp/claude-1000/-home-nimo-NimoTech/9be6eba5-49d2-4544-b285-669477868c4c/scratchpad/oss-sp14`,
含 `src/`、`packages/`、`package.json`、`pnpm-lock.yaml` 等完整可构建结构。

这个"成功"是第一节里 5 个 `chore(oss)` 修复的直接产物——**在补齐清单之前跑这条命令会
报错退出**(锚点未命中 / 哈希钉不符 / 泄漏守卫命中 9 处),brief 里"确认导出没有因为新文件
而报错"这句预判是对的,新文件(knowledge 全套)确实需要现场补丁。

`oss/` 目录自身的测试套件(`pnpm exec vitest run oss/`)141 个用例全部通过,与全量跑的结果
一致。

## 三、真浏览器自查(#136 两张卡)

**已确认的事实(不重新推导)**:Task 0 已核实设备上部署的 agent 容器不支持 elicitation
(`/usr/share/nimoos/agent/mcp_client/` 里没有 elicitation 模块,三条独立证据互相印证,
详见 `task-0-backend-probe.md`)。因此真实端到端 elicitation 无法在本设备触发,本节只验证
**渲染**,不验证真实的服务器往返。

### 方法

一次性 harness(`harness.html` + `harness.ts`,仓库根目录,**从未进入 git**——已加入
`.gitignore` 末尾,任务结束前删除,`git status` 复核过不留痕迹)挂载
`McpElicitFormCard.vue` 与 `McpElicitUrlCard.vue`:
- 表单卡:一次给全部 5 种字段类型(string / integer / boolean / enum / multi_enum),
  另开一张展示"后端退回原因"的折叠态。
- URL 卡:一张 plain https(github.com),一张 punycode 同形异义域名
  (`аpple.com` 西里尔字母 а 冒充 apple.com,`hostAscii` 给出真实 punycode 拼法
  `xn--pple-43d.com`)。

`pnpm dev --host --port 5279` 起 dev server,`~/.cache/ms-playwright/chromium-1228/`
下的 headless Chromium 通过原始 CDP(`ws` 包,scratchpad 里一次性脚本)驱动,分别在
`.agent-app` 的默认(浅色)与 `data-theme="dark"`(深色,AI 区自己的明暗切换机制,
独立于全局蓝/白主题,见 `src/ai/stores/aiTheme.ts`)两套下截图。截图落在
`.superpowers/sdd/sp14/`(8 张,已 `git add -f` 进本次提交)。

### `<select>` 弹出列表legible 检查(本节要求"必须实际检查、不能只截图"的那一条)

两套主题下分别对 enum 字段的 `<select>` 与其一个 `<option>` 取 `getComputedStyle`:

| 主题 | `select` 的 background-color | `select` 的 color | `option` 的 background-color | `option` 的 color | `.agent-app` 的 `color-scheme` |
|---|---|---|---|---|---|
| 浅色(默认) | `rgb(250, 249, 246)` | `rgb(42, 39, 35)` | `rgba(0, 0, 0, 0)`(透明,继承 select 的实心底) | `rgb(42, 39, 35)` | `light` |
| 深色 | `rgb(28, 28, 30)` | `rgb(233, 231, 227)` | `rgba(0, 0, 0, 0)` | `rgb(233, 231, 227)` | `dark` |

**结论:没有白底白字问题。** `select` 两套主题下都是**实心不透明**背景(不是渐变/半透明),
`option` 没有单独设背景(透明,回落继承 `select` 的实心底),前景色与背景色在两套主题下都是
高对比度组合;`color-scheme` 跟着 AI 区自己的明暗状态正确切换,不会借用全局
`:root { color-scheme: dark }` 画出错主题的原生控件配色。`.mcc-input` 的 CSS 注释里
也明确写了"只用实心背景,不用渐变/半透明"的理由,这次渲染验证与代码里的意图一致。

headless Chromium 对着 `<select>` 发送鼠标点击事件不会真的展开原生弹出列表(这是
headless 渲染管线的已知限制,弹出列表由浏览器进程外的独立层绘制,`Page.captureScreenshot`
截不到),所以"真的展开弹窗再截图"这条没能拿到画面证据——**用 `getComputedStyle` 拿到
决定弹窗配色的那两个真实计算值,是本节明确指定的权威判据,截图只是辅助**。

### 截图清单(`.superpowers/sdd/sp14/`)

- `harness-light-full.png` / `harness-dark-full.png` —— 整页(两张表单卡 + 两张 URL 卡)
- `harness-light-form-card.png` / `harness-dark-form-card.png` —— 表单卡单独裁切
- `harness-light-url-punycode-card.png` / `harness-dark-url-punycode-card.png` —— punycode
  URL 卡单独裁切(告警文案 + 双拼法对照清晰可读)
- `harness-light-select-open-attempt.png` / `harness-dark-select-open-attempt.png` —— 点击
  select 后的整页(如上所述,原生弹窗未渲染进画面,留档说明尝试过)

## 四、未验清单(如实列出,不含糊)

- **elicitation 端到端未验(设备端后端不支持,见 `task-0-backend-probe.md`),本期只验了渲染。**
- **`#98`(知识库磁贴)未走真机点击链路。** brief 原文要求"无论如何都要真机走一遍",但本次
  Task 10 没有这台设备上任何账号的登录凭据——真实 Gateway/AI 服务确认在跑
  (`curl 127.0.0.1:80/ping` 200,`nimoos-gateway`/`nimoos-ai` 两个 systemd 服务 active),
  但登录需要用户名密码或重置密码,后者是有安全影响的写操作,超出收尾报告任务的授权范围,
  没有代为执行。检查过 Task 9 的报告(`task-9-report.md`),同样只做到单测层面,没有做过
  真机点击验证——**这条从 Task 9 起就是未验状态,不是本次收尾漏做**。
- **`#141`(MCP 协议版本行)不是"未走真机点击链路",是这台设备上根本不可能验出来。**
  之前几份报告(含本文件更早的版本)把它和 #98 并列成"缺登录凭据、待补验",这个定性是错的:
  `agent/mcp_client/client.py::test_server` 是这台设备真实运行的 NimoOS-AI 后端代码,
  它的返回体只有 `{ok, tool_count, tools}` 三个键(grep 全仓零命中 `protocol_era` /
  `protocol_version` / `supported_versions`,`connect_timeout` 也不是任何地方声明过的错误键)。
  `protocolLine()` 拿到这种响应体恒定返回 `null`,协议版本行不会渲染——**不是缺一次真机点击,
  是缺后端字段**。哪天登录凭据补上了,去点"测试连接"也看不到这一行,除非 NimoOS-AI 先把
  这三个字段发出来。别把它派给"以后有凭据了再验"的清单,那份清单验不出这条。
- **本期未做**:MCP 详情页"测试连接"按钮在有真实配置的 MCP server 时协议行的视觉呈现
  (只有 Task 8 的单测覆盖了 `protocolLine()` 纯函数与组件的 prop 传递,没有真实浏览器截图;
  且如上一条所说,对着今天的后端这条视觉呈现本就不会出现)。
- **本期未做**:桌面 Dock「更多」列表里知识库磁贴的真实点击 → `/ai/knowledge` 路由跳转的
  浏览器验证(同上,只有 Task 9 的单测覆盖)。
- **色彩护栏的"两次栽过跟头"类比检查已在本次浏览器自查里做了**(见上表),但仅覆盖了
  `McpElicitFormCard` 的 enum `<select>`——MCP 详情页、知识库页面自身的原生控件(如果有)
  未在本次收尾里重新扫一遍,依赖的是 Task 4/8/9 各自过程中的验证。

## 五、本期提交清单(`65c7928..HEAD` 的九个功能提交 + Task 10 的八个收尾提交)

功能提交(不含 Task 10):
```
b6b7022 feat(ai): gate MCP authorization links behind an http(s) allowlist
7e1d59e feat(ai): render MCP elicitation forms as a card
3f184c7 feat(ai): route elicitation events to their cards and collapse expired ones
35a4006 feat(ai): show which MCP protocol version a server negotiated
ebd525c fix(service): keep the MCP probe timeout above the layers beneath it
d4d3771 feat(home): give Knowledge a desktop tile
```
（另有 `b90f891`/`0afb5c5`/`8e9e347`/`f3ae4ac` 等状态机与校验分工的支撑提交，属
Task 1-4 范围，未在 brief 列出的"九个提交"摘要里单独点名，但同在 `65c7928..HEAD` 区间内。）

Task 10 收尾提交(按提交顺序):
```
bfb0bcd chore(sp14): carry forward task progress notes, ignore the closeout harness
00d9f74 fix(ai): reword the protocol-version template comment around the hex-color guard
34529c9 chore(oss): re-pin defaultLayout.ts's hash after the knowledge desktop tile
c4703c5 chore: move the harness gitignore entry to the end of the file
7e93b64 chore(oss): re-anchor useOpenAction.ts's PATCH after the knowledge route
e706b7a chore(oss): re-anchor useOpenAction.test.ts's AI-cutover PATCH
7f1ed04 chore(oss): strip the new knowledge system app from the export manifest
```
（本文件 `closeout.md` 的提交是第八个,见下方 commit message。）

## 六、harness 清理确认

任务结束前已删除 `harness.html`、`harness.ts`(仓库根目录),`git status` 确认工作树干净、
两个文件从未出现在任何 `git log`/`git show` 输出里。
