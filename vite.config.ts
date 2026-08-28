import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// pdfjs needs the cMap (CJK and other non-Latin encodings) and standard_fonts (non-embedded fonts) asset directories to render correctly.
// After the build, copy both directories into the output root; referenced via base /app/ by PdfViewer's cMapUrl/standardFontDataUrl.
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

// `^/(?!app/)` = everything except /app/ frontend assets, forwarded verbatim to the on-device gateway (incl. WS upgrades).
const DEV_PROXY = {
  '^/(?!app/)': { target: 'http://127.0.0.1:80', changeOrigin: true, ws: true },
}

export default defineConfig({
  base: '/app/',
  plugins: [vue(), copyPdfjsAssets()],
  // ⚠️ The shared package @nimotech/nimoos-service must be excluded from dependency
  // pre-bundling (hit during SP9-P1 acceptance; mistakenly deleted once during the SP13
  // inlining, proven still broken in practice, and restored — see "SP13 lesson" below).
  // It is a `file:` dependency (SP1-SP12 pointed at an external sibling repo; since SP13 it
  // points at in-repo `packages/service`); either way pnpm hardlinks its files into the
  // `.pnpm` directory — to Vite it is always an ordinary node_modules dependency (the
  // resolution chain ends under node_modules), so it gets pre-bundled into
  // node_modules/.vite/deps/. The pre-bundle cache invalidation criteria are
  // lockfile / config / dependency version numbers — **never dependency contents**. Before
  // SP13 the package version was pinned at 0.0.1, so even manually rebuilding the external
  // repo never invalidated the cache and the dev server kept feeding the browser the old
  // bundle; newly added methods were all undefined in the browser (surfacing as
  // `xxx is not a function`, caught at call sites as "failed to save"). Unit tests use the
  // source and production builds use node_modules — both fresh — so it only reproduced in
  // dev. With exclude, dev loads the real files on demand — **restart the dev server once**
  // to get the latest code (no --force, no clearing the .vite cache, no pnpm install).
  // Note this is not "save-to-hot-update": Vite's watcher ignores node_modules/** by
  // default, and this package is served exactly via the node_modules/.pnpm/... path, so a
  // live process never notices source changes; a restart is required.
  //
  // **SP13 (2026-08-07) lesson — do not delete this block again**: the inlining moved the
  // package into this repo's `packages/service/` and changed the entry from `dist/index.js`
  // to `src/index.ts`; at the time we wrongly concluded "entry points at source ⇒ Vite
  // resolves from source and the pre-bundle cache trap naturally disappears" and deleted
  // this exclude. **Disproven in practice**: the package is still a `file:` dependency,
  // still resolved via `node_modules`, and Vite still pre-bundles it like any dependency —
  // after editing `packages/service/src/*.ts` in place (no restart, no `pnpm install`), the
  // browser's `.vite/deps/@nimotech_nimoos-service.js` was still the pre-edit content; not
  // even "restart the dev server" helps, because `pnpm-lock.yaml` records only the
  // directory path for `file:` directory deps
  // (`resolution: {directory: packages/service, type: directory}`), never a content hash,
  // so editing the source never triggers that invalidation criterion. **What the inlining
  // truly fixed is only the "build step"** (previously the package was an external
  // dependency requiring a separate build in its own repo to take effect); **it did NOT fix
  // the pre-bundle cache feeding stale code** — these are two separate things, so this
  // exclude must stay, and "entry points at source" is no reason to delete it.
  optimizeDeps: {
    exclude: ['@nimotech/nimoos-service'],
    include: ['axios'], // the excluded package above imports it internally; register explicitly to avoid "new dependency discovered → full page reload"
  },
  // dev and preview share the same proxy rule: everything outside /app/ (APIs /v1|/v2|/v3,
  // MessageBus WS, the Vue2 login page) is forwarded to the on-device gateway on port 80.
  // SP9-P0 added the dev copy — previously only preview had it, so login on the dev server always 404'd (been there).
  //
  // SP8-P6-T3 merge: **port unified back to 5273**. The 5286/5287/5288 set was an artifact
  // of the "three parallel lines each on its own port, none overwriting the on-device /app/
  // deploy" era; after SP8 merged back to mainline there is only one line, and the
  // `pnpm dev → http://localhost:5273/app/` is the sole convention.
  // The proxy rule takes master's DEV_PROXY — its `^/(?!app/)` is a **strict superset** of
  // sp8's four rules (/v1, /v2, ^/$, static dirs) and carries ws:true, so sp8's
  // "log in via Vue2 to get a token, then enter /app/#/ai/* for acceptance" ability is
  // fully preserved, plus /v3 and MessageBus WS coverage.
  // host: true comes from sp8 (needed for acceptance on LAN devices), kept.
  server: { port: 5273, host: true, proxy: DEV_PROXY },
  // SP6 parallel acceptance (spec §5): serves only the /app/ build output. Real deploys still go through scripts/deploy.sh.
  preview: {
    port: 5273,
    host: true,
    proxy: DEV_PROXY,
  },
  test: {
    environment: 'jsdom',
    env: { TZ: 'UTC' },
    globals: true,
    // Claude Code's isolated worktrees appear under .claude/worktrees/ (each a full repo
    // copy); without the exclusion, vitest recurses into them, runs other sessions' tests,
    // and fails en masse.
    // (Before this package was inlined, this also needed an extra symlink for the old external
    // service package to install dependencies — after inlining, `file:packages/service` is an in-repo relative
    // path that resolves naturally inside worktrees, so the symlink is no longer needed; a side benefit.)
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
    setupFiles: ['./vitest.setup.ts'],
  },
})
