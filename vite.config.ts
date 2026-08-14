import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// pdfjs 需要 cMap(CJK 等非拉丁编码)与 standard_fonts(未嵌入字体)资源目录才能正确渲染。
// 构建后把这两个目录拷进产物根,经 base /app/ 由 PdfViewer 的 cMapUrl/standardFontDataUrl 引用。
function copyPdfjsAssets(): Plugin {
  let outDir = 'dist'
  return {
    name: 'copy-pdfjs-assets',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir },
    closeBundle() {
      for (const dir of ['cmaps', 'standard_fonts']) {
        fs.cpSync(
          path.resolve(rootDir, 'node_modules/pdfjs-dist', dir),
          path.resolve(rootDir, outDir, dir),
          { recursive: true },
        )
      }
    },
  }
}

// `^/(?!app/)` = 除 /app/ 前端资源外的一切,原样转发给真机网关(含 WS 升级)。
const DEV_PROXY = {
  '^/(?!app/)': { target: 'http://127.0.0.1:80', changeOrigin: true, ws: true },
}

export default defineConfig({
  base: '/app/',
  plugins: [vue(), copyPdfjsAssets()],
  // ⚠️ 共享包 @nimotech/nimoos-service 必须排除出依赖预打包(SP9-P1 验收踩到,
  // SP13 内联时误删过一次、实测证明坑还在,已恢复 —— 见下方"SP13 教训")。
  // 它是 `file:` 依赖(SP1-SP12 指向外部同级仓库,SP13 起指向仓内
  // `packages/service`),pnpm 都会把它的文件硬链进 `.pnpm` 目录 —— 在 Vite 眼里
  // 始终是个普通的 node_modules 依赖(解析链路最终落在 node_modules 下),
  // 于是会被预打包进 node_modules/.vite/deps/。而预打包缓存的失效判据是
  // lockfile / config / 依赖版本号,**不看依赖内容**——SP13 之前那个包版本号恒为
  // 0.0.1,手动对着外部仓单独重新构建一遍之后缓存也不失效,dev server 一直喂
  // 浏览器旧包;新加的方法在浏览器里全是 undefined(表现为 `xxx is not a function`,
  // 被调用处 catch 成"保存失败")。单测走源码、生产 build 走 node_modules,两边都是
  // 新的,所以只在 dev 复现。exclude 后 dev 直接按需加载真实文件——**重启一次 dev
  // server** 就能拿到最新代码(不用 --force、不用清 .vite 缓存、不用 pnpm install)。
  // 注意这不等于"存盘即热更新":Vite 的 watcher 默认忽略 node_modules/**,这个包正是
  // 经 node_modules/.pnpm/... 路径服出去的,进程存活期间不会自动感知源码变化,必须重启。
  //
  // **SP13(2026-08-07)教训,别再删这段**:内联把包搬进本仓 `packages/service/`、
  // 入口从 `dist/index.js` 改指 `src/index.ts`,当时误判"入口指源码 ⇒ Vite 按源码
  // 解析、预打包缓存的坑自然消失",把这段 exclude 删了。**实测证伪**:该包依旧是
  // `file:` 依赖、依旧经 `node_modules` 解析,Vite 照样把它当普通依赖预打包 ——
  // 就地编辑 `packages/service/src/*.ts`(不重启、不 `pnpm install`)后,浏览器拿到的
  // `.vite/deps/@nimotech_nimoos-service.js` 仍是编辑前的旧内容;连"重启 dev
  // server"都救不了,因为 `pnpm-lock.yaml` 对 `file:` 目录依赖只记目录路径
  // (`resolution: {directory: packages/service, type: directory}`),不记内容哈希,
  // 编辑源码从不触发这条失效判据。**内联真正根治的只是"构建步骤"**(此前这个包曾是
  // 外部依赖,改完要单独跑一次那个仓自己的构建才能生效),**没有根治预打包缓存喂旧包**
  // ——两件事是分开的,这段 exclude 因此必须留着,不因为入口指向源码就可以删。
  optimizeDeps: {
    exclude: ['@nimotech/nimoos-service'],
    include: ['axios'], // 上面 exclude 掉的包内部 import 它,显式登记以免触发"发现新依赖 → 整页重载"
  },
  // dev 与 preview 用同一条转发规则:/app/ 之外(API /v1|/v2|/v3、MessageBus WS、
  // Vue2 登录页)全部转发真机网关 80。
  // SP9-P0 补 dev 这一份 —— 此前只有 preview 有,dev server 上登录必 404(踩过)。
  //
  // SP8-P6-T3 合流:**端口统一回 5273**。5286/5287/5288 那套是「三条并行线各占一个端口、
  // 互不覆盖真机 /app/ 部署」时期的产物;SP8 随本次合流并回主干后只剩一条线,
  // CLAUDE.md 记的 `pnpm dev → http://localhost:5273/app/` 就是唯一约定。
  // 转发规则取 master 的 DEV_PROXY —— 它的 `^/(?!app/)` 是 sp8 那四条(/v1、/v2、^/$、
  // 静态目录)的**严格超集**,且带 ws:true,所以 sp8 「走 Vue2 登录拿 token 再进
  // /app/#/ai/* 验收」的能力一条不少,还额外覆盖了 /v3 与 MessageBus WS。
  // host: true 来自 sp8(局域网设备上验收要用),予以保留。
  server: { port: 5273, host: true, proxy: DEV_PROXY },
  // SP6 并行验收(spec §5):只伺服 /app/ 构建产物。正式部署仍走 scripts/deploy.sh。
  preview: {
    port: 5273,
    host: true,
    proxy: DEV_PROXY,
  },
  test: {
    environment: 'jsdom',
    env: { TZ: 'UTC' },
    globals: true,
    // Claude Code 的隔离 worktree 会出现在 .claude/worktrees/ 下(含整个仓库副本),
    // 不排除的话 vitest 会递归进去跑别的会话的测试并大片报错。
    // (SP13 内联前这里还需要额外给 NimoOS-Service 一条软链才能装上依赖——内联后
    // `file:packages/service` 是仓内相对路径,worktree 里天然可解析,不再需要软链
    // 这个附带收益。)
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
    setupFiles: ['./vitest.setup.ts'],
  },
})
