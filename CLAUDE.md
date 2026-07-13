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

## 共享 service 包(已知漂移坑)

HTTP/认证内核来自 **`@nimotech/nimoos-service`**,通过 `file:../NimoOS-Service` 链接(见 `package.json`)。`main.ts` 用 `initService({...})` 注入 token 取存、`onAuthFail`、语言等回调。

**改动该包后必须 `cd ../NimoOS-Service && pnpm build` 重新构建**;若消费端(本仓库)构建报 `Module not found`,通常需要 `pnpm install` 重新同步 `file:` 链接。首次搭环境:先 `cd ../NimoOS-Service && pnpm install && pnpm build`,再回本仓库 `pnpm install`。

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
