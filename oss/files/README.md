# NimoOS Web UI

NimoOS 家用服务器 / NAS 的 Web 控制台 —— **Vue 3 + TypeScript + Vite**。

挂在 `/app/`,使用 hash 路由(`/app/#/`)。已覆盖:登录与初始化引导、桌面主页(应用网格 /
Dock / 小组件 / Docker 应用识别)、文件区(管理 / 上传 / 分享 / 图片·视频·音频·PDF·Office·
代码·Markdown 预览)、应用与应用商店、存储(卷 / 磁盘 / RAID / 快照)、虚拟机(KVM,含创建
向导与 noVNC 控制台)、系统设置。

## 技术栈

- Vue 3(`<script setup>`)· Vite 7 · TypeScript(`strict`)· Pinia · vue-router 4 · vue-i18n 9
- **reka-ui**(headless 原语)—— 无 Tailwind、无任何 UI/CSS 框架,样式全部手写
- 预览器:artplayer / aplayer · pdfjs-dist · @vue-office(docx/xlsx)· CodeMirror 6 · markdown-it
- socket.io-client(事件总线)· tus-js-client(断点续传上传)· @novnc/novnc(虚机控制台)
- 测试:Vitest + @vue/test-utils,测试文件与实现同目录(`*.test.ts`)

## 目录结构

```
src/                 前端源码
packages/service/    HTTP / 认证内核共享包(@nimotech/nimoos-service),已内嵌
```

共享包通过 `package.json` 的 `file:./packages/service` 链接 —— clone 一个仓库即可开发,
不需要额外拉包。

## 开始

需要 Node.js ≥ 20.19(vite 7 的 engines 要求 `^20.19.0 || >=22.12.0`,20.0–20.18 装完会
撞引擎错误)与 **pnpm**(勿用 yarn / npm)。

```bash
pnpm install
pnpm dev          # http://localhost:5273/app/
pnpm test         # vitest run
pnpm build        # vue-tsc --noEmit + vite build → dist/
```

`pnpm dev` 会把 `/app/` 以外的请求(API、事件总线 WebSocket)转发到 `http://127.0.0.1:80`
的 NimoOS 网关。改 `vite.config.ts` 里的 `DEV_PROXY` 指向你的设备。

部署:`./scripts/deploy.sh` 会构建并同步 `dist/` 到设备的 `/var/lib/nimoos/www/app/`。

## 配色约定(硬约束)

**一切可见颜色必须来自 `src/styles/theme.css` 里的 theme token(`var(--…)`),
禁止在组件里写死 `#fff` / `rgba(...)` / 具名色。** 配色要能整体切换:`:root` 是深色玻璃主题,
`:root[data-theme="light"]` 是米白纸感主题,**每个颜色 token 在两套主题块里都要有值**。
需要新的颜色语义时,新增 token 并给两套主题都赋值。

这条约束是为了让配色始终可以整体替换/扩展 —— 一旦某处写死了具体色值,主题切换或换肤
时就会漏改,长期下来会散落一批"改不动"的颜色。给外部贡献者提这条,是因为不提的话,
第一个 PR 大概率就会顺手写一个字面量色值。

例外只有两类,且出现处必须写注释标明:`theme.css` 里的 `.ic-*` 应用图标渐变(品牌识别色,
皮肤无关)、第三方库内部无法 token 化的颜色(如 CodeMirror 主题,走该库自己的主题机制)。

## i18n

locale 文件在 `src/i18n/`(`zh_cn` 默认 / `en_us`)。**新增文案键必须同时加到两个文件** ——
`src/i18n/parity.test.ts` 断言两边键集完全一致,漏一个测试即红。

## 已知缺口

1. **文件区快照管理不全** —— 时间机器(按时间轴浏览历史版本)可用,完整的快照管理界面尚未完成。
2. **只有中文与英文两种语言。**
3. **设置里的终端 tab 是空态** —— 对应的后端服务尚未提供(`/v1/sys/wsssh`、
   `/v1/terminal/settings` 均 404)。
4. **设置里的存储 tab 是跳转入口卡**,不是完整面板 —— 完整功能在 `/storage` 路由下。
