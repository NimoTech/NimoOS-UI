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
  // ⚠️ 共享包 @nimotech/nimoos-service 必须排除出依赖预打包(SP9-P1 验收踩到)。
  // 它是 `file:../NimoOS-Service` 依赖,pnpm 把 dist 硬链进 .pnpm 目录 —— 在 Vite 眼里
  // 是个普通的 node_modules 依赖,于是会被预打包进 node_modules/.vite/deps/。
  // 而预打包缓存的失效判据是 lockfile / config / 依赖版本号,**不看依赖内容**;
  // 这个包版本号恒为 0.0.1,所以 `cd ../NimoOS-Service && pnpm build` 之后
  // 缓存**不会**失效,dev server 会一直喂浏览器旧的包 —— 新加的方法在浏览器里
  // 全是 undefined(表现为 `xxx is not a function`,被调用处 catch 成"保存失败"),
  // 而单测走源码、生产 build 走 node_modules,两边都是新的,所以只在 dev 复现。
  // exclude 后 dev 直接按需加载 node_modules 里的真实文件(与 dist 同 inode),永远是新的。
  optimizeDeps: {
    exclude: ['@nimotech/nimoos-service'],
    include: ['axios'], // 上面 exclude 掉的包内部 import 它,显式登记以免触发"发现新依赖 → 整页重载"
  },
  // dev 与 preview 用同一条转发规则:/app/ 之外(API /v1|/v2|/v3、MessageBus WS、
  // Vue2 登录页)全部转发真机网关 80。
  // SP9-P0 补 dev 这一份 —— 此前只有 preview 有,dev server 上登录必 404(踩过)。
  server: { port: 5273, proxy: DEV_PROXY },
  // SP6 并行验收(spec §5):5273 只伺服 /app/ 构建产物。正式部署仍走 scripts/deploy.sh。
  preview: {
    port: 5273,
    host: true,
    proxy: DEV_PROXY,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // Claude Code 的隔离 worktree 会出现在 .claude/worktrees/ 下(含整个仓库副本 + NimoOS-Service 软链),
    // 不排除的话 vitest 会递归进去跑别的会话的测试并大片报错。
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
    setupFiles: ['./vitest.setup.ts'],
    server: {
      deps: {
        inline: ['@nimotech/nimoos-service'],
      },
    },
  },
})
