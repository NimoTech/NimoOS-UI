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
  // ⚠️ 历史(SP1–SP12):共享包曾是 `file:../NimoOS-Service` 外部依赖,被 Vite 当普通
  // node_modules 依赖预打包;而预打包缓存的失效判据是 lockfile / config / 依赖版本号,
  // **不看依赖内容**,那个包版本号恒为 0.0.1 —— 于是 `cd ../NimoOS-Service && pnpm build`
  // 之后缓存不失效,dev server 一直喂旧包,新加的方法在浏览器里全是 undefined
  // (表现为被调用处 catch 成"保存失败")。单测走源码、生产 build 走 node_modules,
  // 两边都是新的,所以只在 dev 复现。当年靠 optimizeDeps.exclude 绕开。
  // **SP13 内联后此坑根治**:包在仓内 packages/service/、入口直指 TS 源码,
  // Vite 按源码文件加载,永远是新的。exclude 与配套的 include: ['axios'] 一并删除。
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
    globals: true,
    // Claude Code 的隔离 worktree 会出现在 .claude/worktrees/ 下(含整个仓库副本 + NimoOS-Service 软链),
    // 不排除的话 vitest 会递归进去跑别的会话的测试并大片报错。
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
    setupFiles: ['./vitest.setup.ts'],
  },
})
