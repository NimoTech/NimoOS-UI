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

export default defineConfig({
  base: '/app/',
  plugins: [vue(), copyPdfjsAssets()],
  // SP8 验收约定:三会话并行期间真机 /app/ 部署共享,SP8 每期用 :5288 独立端口
  // 人眼验收(sp6/sp7 如需可各用 5286/5287)。代理让 :5288 完整模拟生产源:
  // /v1|/v2 → 本机网关;根路径与 Vue2 静态目录也代理,用户可直接在 :5288 走
  // Vue2 登录拿 token(同源 localStorage),再进 /app/#/ai/* 验收。
  server: {
    port: 5288,
    host: true,
    proxy: {
      '/v1': { target: 'http://127.0.0.1:80', changeOrigin: true },
      '/v2': { target: 'http://127.0.0.1:80', changeOrigin: true, ws: true },
      '^/$': { target: 'http://127.0.0.1:80', changeOrigin: true },
      '^/(js|css|ui|img|fonts|favicon\\.ico)(/|$)': { target: 'http://127.0.0.1:80', changeOrigin: true },
    },
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
