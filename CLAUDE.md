# CLAUDE.md — NimoOS-New-UI

本文件指导 Claude Code 在本目录(`/home/nimo/NimoTech/NimoOS-New-UI`)工作。
**更上层的整体系统说明在 `/home/nimo/NimoTech/CLAUDE.md`(全 NimoOS 微服务工作区)—— 那里的内容不在此重复。** 本文件只讲 New-UI 自己的事。

## 这是什么

NimoOS Web UI 的 **Vue 3 + TypeScript + Vite** 重写。采用**策略 C(并行新应用 + 路由绞杀)**:与旧的 Vue 2 主应用(挂在 `/`)**同源并存**,新应用挂在 `/app/`,用 **hash 路由**(`/app/#/`),因此新增/迁移页面无需改 Gateway 路由。逐屏把功能从 Vue 2 迁到这里。

栈:Vue 3(`<script setup>`)· Vite 7 · Pinia · vue-router 4 · vue-i18n 9 · **reka-ui**(headless 原语) · artplayer/aplayer(音视频) · pdfjs-dist · @vue-office(docx/excel) · CodeMirror 6(代码预览) · socket.io-client(MessageBus) · tus-js-client(上传)。**没有 Tailwind,没有任何 UI/CSS 框架** —— 样式全部手写(见下方主题约定)。

## 常用命令(包管理器:pnpm,勿用 yarn/npm)

```bash
pnpm dev                    # 开发服务器 http://localhost:5273/app/
pnpm test                   # vitest run(全量)
pnpm test:watch             # vitest 监听
pnpm build                  # vue-tsc --noEmit(类型检查)+ vite build → dist/
pnpm exec vue-tsc --noEmit  # 只做类型检查
./scripts/deploy.sh         # pnpm build + rsync --delete dist/ → /var/lib/nimoos/www/app/
```

`vite.config.ts`:`base: '/app/'`,dev 端口 5273;构建后自动把 pdfjs 的 `cmaps`/`standard_fonts` 拷进 `dist/`(PdfViewer 需要)。`tsconfig.json`:`strict: true`,`moduleResolution: Bundler`。
部署首次需:`sudo mkdir -p /var/lib/nimoos/www/app && sudo chown nimo:nimo /var/lib/nimoos/www/app`。

**实机部署约定(用户指定,长期有效)**:部署到设备一律执行 `./scripts/deploy.sh`(它做 pnpm build + rsync --delete dist/ → `/var/lib/nimoos/www/app/`)——**不要**绕过脚本手写 rsync/cp 到 `/var/lib`。脚本是部署的唯一入口;部署完成后在浏览器 `/app/` 验证。

## 共享 service 包(SP13 起已内联,但预打包坑没有跟着消失 —— 见下方教训)

HTTP/认证内核是 **`@nimotech/nimoos-service`**,**源码就在本仓 `packages/service/`**
(`package.json` 里写的是 `file:packages/service`)。`main.ts` 用 `initService({...})` 注入
token 取存、`onAuthFail`、语言等回调。

**内联消掉的是构建步骤,不是构建本身**:包入口从 `dist/index.js` 改指
`packages/service/src/index.ts`(TS 源码),所以不用再 `cd ../NimoOS-Service && pnpm build`
单独构建一遍——改完包代码,本仓的 Vite / Vitest / vue-tsc 都会按源码重新解析。

**dev server 的实际生效方式**:改完包源码 → **重启 dev server**(`Ctrl-C` 再 `pnpm dev`)
→ 生效。不用 `pnpm build`、不用清 `.vite` 缓存、不用 `pnpm install`(前提是 hardlink 没断,
见下方"硬链接陷阱")。**做不到"存盘即 HMR"**——Vite 的文件 watcher 默认忽略
`node_modules/**`,而这个包正是经 `node_modules/.pnpm/@nimotech+nimoos-service@.../src/*.ts`
这条路径服出去的(即使 `optimizeDeps.exclude` 让 Vite 服的是真源码而不是预打包产物,
watcher 依然看不到它的变化),所以进程内缓存的 transform 结果不会自动失效,必须重启才能
让 Vite 重新读盘。2026-08-07(SP13)实测走过一轮弯路才定下这条准确说法,详见
`vite.config.ts` 顶部注释与 `.superpowers/sdd/2026-08-07-vue3-migration-sp13-service-inline/task-3-report.md`。

> **操作口诀**:改 `packages/service/` 里的代码 → **重启 dev server** → **硬刷新浏览器**
> (`Ctrl-Shift-R`)。不需要 `pnpm build`、不需要清 `.vite`、不需要 `pnpm install`。
> (若连硬刷新都还是旧的 → 多半是硬链接被断了,见下方"硬链接陷阱",跑一次 `pnpm install`。)

> **⚠️ `vite.config.ts` 的 `optimizeDeps.exclude` 不要删。** 它守的是"服真源码 vs 服
> 预打包陈旧产物"这条线——不是"即时性"(即时性靠上面那条"重启"生效,不靠 exclude)。
> SP13 上线时曾经以为"入口指向源码 ⇒ exclude 不再需要",删掉过一次——**实测证伪**:
> 该包依旧是 `file:` 依赖、依旧经 `node_modules` 解析,Vite 照样把它当普通依赖预打包进
> `node_modules/.vite/deps/`;而预打包缓存的失效判据是 lockfile / config / 依赖版本号,
> **不看依赖内容**(`pnpm-lock.yaml` 对 `file:` 目录依赖只记目录路径,不记内容哈希),
> 删了 exclude 之后即使反复重启 dev server 也拿不到新代码,只能靠 `--force` 或手动删
> `.vite` 缓存硬破。`src/viteOptimizeDepsGuard.test.ts` 专门守着这条 exclude,别绕开它、
> 别删它守卫的配置。

> **⚠️ 硬链接陷阱:改了源码但 dev server(哪怕重启)还是喂旧代码,先查 hardlink 有没有断。**
> `file:` 依赖被 pnpm 硬链进 `.pnpm/` 目录——`packages/service/src/x.ts` 与
> `node_modules/.pnpm/@nimotech+nimoos-service@file+packages+service/node_modules/@nimotech/nimoos-service/src/x.ts`
> 本是**同一个 inode**。多数编辑器的"保存"、以及 Claude Code 的 Edit/Write 类工具,都是
> 原子写(先写临时文件再 rename)——这会让仓库那一侧换成**新** inode,`.pnpm` 那一侧还留着
> **旧** inode 的旧内容,两边就此断开,此后无论怎么重启 dev server 都只会读到断开前的旧代码。
> 自查:
> ```bash
> stat -c '%i %n' packages/service/src/sys.ts \
>   node_modules/.pnpm/@nimotech+nimoos-service@file+packages+service/node_modules/@nimotech/nimoos-service/src/sys.ts
> # 两个 inode 不同 ⇒ 硬链已断,跑一次 pnpm install 重新链上即可(不需要 --force、不需要删 .vite)
> ```

> **⚠️ 浏览器磁盘缓存陷阱:改了源码、也重启了 dev server,浏览器里还是旧行为,按多少次
> F5 都没用。** 症状看起来跟"硬链接断了"一样(重启也没用),但自查 inode 会发现两侧一致——
> 卡的不是服务端,是浏览器自己。原因:这个包的模块 URL 带 `?v=<hash>` 查询串,响应头是
> `Cache-Control: max-age=31536000, immutable`;那个 `?v=` 哈希取自 **lockfile / config**
> (deps-optimizer 元数据),**不随 `packages/service/src/*.ts` 的内容变**——只改包源码、
> 不碰 `vite.config.ts`/`pnpm-lock.yaml` 时这个哈希纹丝不动,已经加载过该页的标签页会一直
> 命中磁盘缓存,永远吃不到重启后的新代码。处置:**硬刷新**(`Ctrl-Shift-R`),或 DevTools
> 勾上 "Disable cache",或换个新的无痕窗口——这几种都会绕开磁盘缓存,强制发一次真实网络
> 请求。**实测边界**(2026-08-07 SP13-T4,无头 chromium + CDP 真机 A/B 隔离过):重启**前**
> 硬刷新 → 看不到新代码(证明确实是"重启"这一步在起作用,不是缓存在演戏);重启**后**
> 硬刷新 → 立刻看到。两种情况下普通 F5 都看不到。这条是 curl 测不出来的——curl 没有浏览器
> 磁盘缓存这层,只有真浏览器才会撞见,与上面"重启即生效"的结论**不矛盾**,是补充。

**⚠️ `../NimoOS-Service` 仓还在,但它现在只服务 Vue2(`NimoOS-UI`)。改那边不会影响本仓。**

`packages/service/` 里的 `tsconfig.json` 与 `vitest.config.ts` 是从原仓一并搬来的,
**从本仓根跑 `vue-tsc` / `vitest` 时两者都不生效**(TS 与 Vitest 都只认根配置,本仓无
workspace / projects 声明)。留着是为与开源产物树同形,别去改它们指望有效果。

包内 37 个测试文件 / 377 例已并入根 `pnpm test`。原仓测试环境是 node,本仓根配置是全局
jsdom;**实测 377 例在 jsdom 下全绿,无需任何逐文件 `// @vitest-environment node` 回落**
(`grep -rl "@vitest-environment node" packages/service/` 为空)。

## 认证与路由

- JWT(access/refresh)存在 **localStorage**;token 失效由共享包在 401 时单飞刷新兜底。
- 路由守卫(`src/router/guard.ts`):公开路由 `/login`、`/welcome`;受保护路由无 token 时查一次 status,未初始化→ `/welcome`,否则→ `/login`。
- 认证失败(`src/router/onAuthFail.ts` + `main.ts`):**先清废 token 再跳 `/app/#/login`** —— 顺序不可颠倒,否则守卫见 `/login` 仍有 token 会跳回首页、首页 API 再 401,造成应用内无限互弹(历史 bug)。

## i18n

`vue-i18n`,locale 文件在 `src/i18n/`(`zh_cn.ts` 为默认/fallback + `en_us.ts`)。
**新增文案键时必须同时加到 `zh_cn.ts` 和 `en_us.ts`** —— `src/i18n/parity.test.ts` 会断言两个文件的键完全一致,漏一个测试即红。

## 目录速览(`src/`)

`main.ts` 装配(pinia → initService → i18n → router → mount) · `App.vue` 壳 · `router/`(hash 路由 + 守卫) · `stores/`(Pinia:`session`/`locale`/`toast`/`utilization`) · `composables/`(`useAuth`/`useMessageBus`/`useUtilization`/`useValidation`) · `home/`(桌面/Dock/小组件/网格) · `files/`(文件区:列表/上传/分享/`viewers/` 预览器) · `i18n/` · `styles/theme.css`(全局 token,见下)。测试与实现同目录(`*.test.ts`)。

---

# ★ 主题/配色约定(强制,不可违反)

> **New-UI 里一切可见颜色必须来自 theme token(`var(--…)`),该 token 定义在 `src/styles/theme.css`。禁止在组件、`<style>` 块或任何 CSS 里写死颜色字面量(`#fff`、`rgba(...)`、`red` 等具名色)。**

这是本仓库贯穿后续所有开发(含 AI 会话)的**长期硬约束**,不是一次性任务。理由:配色要保持**可整体切换**,所以颜色处一律"留空"成 token,任何配色方案都能随时替换/新增。

- **写样式时**:颜色位置填 `var(--card-bg)` / `var(--fg)` / `var(--accent)` 这类 token,而不是硬编码色值。token 的实际值由当前主题决定。
- **可切换主题**:通过根节点 `document.documentElement` 上的 `data-theme` 属性整块切换 token 值。
  - `:root { … }` = **蓝色/深色玻璃主题(默认、兜底)**。
  - `:root[data-theme="light"] { … }` = **白色/米白纸感主题**,重定义所有颜色 token。
  - **每个颜色 token 在两套主题块里都要有值。** 非颜色的结构量(`--font`/`--radius`/`--ease`/`--blur` 等)两套共享,只放 `:root`。
- **需要新颜色语义时**:在 `theme.css` **新增一个 token,并在每一个主题块里都给它值** —— 绝不就地写死字面量。
- **例外(有意为之,非残留 —— 出现处必须在代码里写注释标明)**:
  1. `theme.css` 里的 `.ic-*` app 图标渐变 —— 品牌识别色,皮肤无关,两套主题都保留。
  2. 第三方库内部无法 token 化的颜色(如 CodeMirror 编辑器主题)—— 走该库自身的主题机制。
- **权威参考**:token 完整目录、蓝/白两套取值、"如何加一套主题 / 如何加一个语义 token / 例外清单" 见 **`docs/THEMING.md`**。设计与决策记录见 `docs/superpowers/specs/2026-07-10-new-ui-theme-system-design.md`(§2、§8)。

评审自查:提交前 `git diff` 里若出现新的 `#`hex、`rgb(`/`rgba(`、具名颜色,而它不属于上述两类例外,即违反本约定,应改为(或新增)token。
