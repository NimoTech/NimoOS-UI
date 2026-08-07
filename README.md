# NimoOS-New-UI

NimoOS Web UI 的 **Vue 3 + TypeScript + Vite** 重写。

采用**并行新应用 + 路由绞杀(Strangler)策略**:与旧的 Vue 2 主应用(挂在 `/`)同源并存,本应用挂在 `/app/`,使用 hash 路由(`/app/#/`),因此新增/迁移页面无需改动 Gateway 路由。功能逐屏从 Vue 2 迁移到这里,迁完一屏切一屏。

已迁移的主要区域:**登录 / 初始化引导(Welcome)**、**桌面主页**(应用网格、Dock、小组件、Docker 应用识别)、**文件区**(文件管理、上传、分享、内置预览器:图片/视频/音频/PDF/Office/代码/Markdown)。

## 技术栈

- **Vue 3**(`<script setup>`)· Vite 7 · TypeScript(`strict`)· Pinia · vue-router 4 · vue-i18n 9
- **reka-ui**(headless 组件原语)—— **无 Tailwind、无任何 UI/CSS 框架**,样式全部手写
- 预览器:artplayer / aplayer(音视频)· pdfjs-dist · @vue-office(docx/xlsx)· CodeMirror 6(代码)· markdown-it
- socket.io-client(MessageBus 事件)· tus-js-client(断点续传上传)
- 测试:Vitest + @vue/test-utils,测试文件与实现同目录(`*.test.ts`)

## 环境要求

- Node.js ≥ 20,**pnpm**(勿用 yarn / npm)
- 共享的 HTTP/认证内核包 `@nimotech/nimoos-service` 已内联在本仓 `packages/service/`
  (`package.json` 里写的是 `file:packages/service`)——**单独克隆本仓即可安装依赖**,
  不需要额外克隆或构建任何同级仓库。

## 快速开始

```bash
git clone git@github.com:NimoTech/NimoOS-New-UI.git
cd NimoOS-New-UI
pnpm install
pnpm dev        # 开发服务器 http://localhost:5273/app/
```

开发服务器需要一台可访问的 NimoOS 后端(Gateway)提供 API。

### 常用命令

```bash
pnpm dev                    # 开发服务器(端口 5273,base /app/)
pnpm test                   # vitest 全量测试
pnpm test:watch             # vitest 监听模式
pnpm build                  # vue-tsc --noEmit 类型检查 + vite build → dist/
pnpm exec vue-tsc --noEmit  # 只做类型检查
```

### 部署到设备

首次准备目录(只需一次,`deploy.sh` 的 rsync 目标必须存在且当前用户可写):

```bash
sudo mkdir -p /var/lib/nimoos/www/app
sudo chown "$USER:$USER" /var/lib/nimoos/www/app
```

之后每次部署:

```bash
./scripts/deploy.sh   # pnpm build + rsync --delete dist/ → /var/lib/nimoos/www/app/
```

部署到设备**一律走该脚本**,不要手写 rsync/cp 到 `/var/lib`。部署后在浏览器访问 `http://<设备IP>/app/` 验证。

## 目录结构

```
src/
├── main.ts            # 装配:pinia → initService → i18n → router → mount
├── router/            # hash 路由 + 守卫(未初始化→/welcome,无 token→/login)
├── stores/            # Pinia:session / locale / toast / utilization
├── composables/       # useAuth / useMessageBus / useUtilization / useValidation
├── home/              # 桌面主页:应用网格、Dock、小组件、容器事件桥
├── files/             # 文件区:列表、上传、分享、viewers/ 预览器
├── views/             # 页面级组件:Home / Files / Login / Welcome
├── i18n/              # zh_cn.ts(默认)+ en_us.ts,键必须两边同步
└── styles/theme.css   # 全局主题 token(见下)
docs/
├── THEMING.md         # 主题系统权威文档
└── nimoos-app-label-spec.md
```

## 开发约定

### 主题/配色(硬约束)

**一切可见颜色必须来自 `src/styles/theme.css` 定义的 token(`var(--…)`),禁止在任何组件或 CSS 中写死颜色字面量**(`#fff`、`rgba(...)`、具名色)。主题通过根节点 `data-theme` 属性整体切换:默认为蓝色/深色玻璃主题,`data-theme="light"` 为米白纸感主题。新增颜色语义时在 `theme.css` 新增 token 并在**每套主题块**中赋值。完整规则与例外清单见 [`docs/THEMING.md`](docs/THEMING.md)。

### i18n

新增文案键必须**同时**加入 `src/i18n/zh_cn.ts` 和 `en_us.ts` —— `parity.test.ts` 会断言两个文件键完全一致,漏一个测试即红。

### 认证

- JWT(access/refresh)存 localStorage,401 时由共享包单飞刷新兜底。
- 认证失败处理顺序不可颠倒:**先清废 token,再跳 `/app/#/login`**(否则路由守卫会造成无限重定向环)。

### 共享包(`@nimotech/nimoos-service`)

源码内联在本仓 `packages/service/`,无需单独构建。改动它之后:**重启 dev server**
(`Ctrl-C` 再 `pnpm dev`)才会生效——Vite 的文件 watcher 默认忽略 `node_modules/**`,
而这个包正是经这条路径服出去的,存盘不会自动触发热更新。重启之后浏览器仍可能命中
磁盘缓存(该模块的 URL 带 `immutable` 缓存头),需要**硬刷新**(`Ctrl-Shift-R`)才能
看到新代码。都不需要 `pnpm build`、清 `.vite` 缓存或 `pnpm install`——除非
`packages/service/src/*.ts` 与其在 `node_modules/.pnpm/` 下的硬链接镜像断开(重启 +
硬刷新后仍是旧代码时,跑一次 `pnpm install` 重新链上即可)。完整说明见 `CLAUDE.md`
「共享 service 包」一节。
