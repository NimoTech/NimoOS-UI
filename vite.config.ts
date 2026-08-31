import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// pdfjs needs the cMap (CJK and other non-Latin encodings) and standard_fonts (non-embedded fonts) asset directories to render correctly.
// After the build, copy both directories into the output root; referenced via the app base by PdfViewer's cMapUrl/standardFontDataUrl.
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

// The gateway's component health probe (probeUI) reads <www root>/version.json — a contract
// the Vue 2 panel used to satisfy via its gen-version.js. Same semantics here: a release
// build (NimoOS-Build) overrides via NIMOOS_VERSION(+NIMOOS_BUILD); a plain local build
// falls back to package.json's version. Emitted into the output root at closeBundle, so the
// working tree stays clean (the Vue 2 approach wrote into public/ and needed gitignoring).
function emitVersionJson(): Plugin {
  let outDir = 'dist'
  return {
    name: 'emit-version-json',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir },
    closeBundle() {
      const envVer = process.env.NIMOOS_VERSION
      const version = envVer
        ? `${envVer}${process.env.NIMOOS_BUILD ? '+' + process.env.NIMOOS_BUILD : ''}`
        : (JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf8')).version as string)
      fs.writeFileSync(path.resolve(rootDir, outDir, 'version.json'), JSON.stringify({ version }) + '\n')
    },
  }
}

// Serving at root (base '/', 2026-08-29) means the old blanket rule `^/(?!app/)` would
// swallow the app's own module requests, so the proxy is now an explicit allow-list of
// backend prefixes: /v1 /v2 /v3 covers every REST call the shared service package makes,
// and /v2/message_bus carries the MessageBus socket.io upgrade (ws: true). Anything else
// is the app itself and stays with the dev server.
const BACKEND = { target: 'http://127.0.0.1:80', changeOrigin: true, ws: true }
const DEV_PROXY = {
  '^/v[123]/': BACKEND,
}

export default defineConfig({
  // Served at the site root since 2026-08-29 — the Vue 2 panel is retired and this app
  // owns `/`. Hash routing stays (the gateway's StaticFS has no SPA fallback, so
  // /files-style history URLs would 404 on refresh).
  base: '/',
  plugins: [vue(), copyPdfjsAssets(), emitVersionJson()],
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
  // dev and preview share the same proxy rule (APIs /v1|/v2|/v3 incl. the MessageBus WS,
  // forwarded to the on-device gateway on port 80). SP9-P0 added the dev copy — previously
  // only preview had it, so login on the dev server always 404'd (been there).
  //
  // SP8-P6-T3 merge: **port unified back to 5273** — `pnpm dev → http://localhost:5273/`
  // is the sole convention. The proxy forwards only the /v1 /v2 /v3 backend prefixes
  // (ws:true carries the MessageBus socket.io upgrade); everything else is the app itself.
  // host: true is needed for acceptance on LAN devices, kept.
  server: { port: 5273, host: true, proxy: DEV_PROXY },
  // SP6 parallel acceptance (spec §5): serves only the build output. Real deploys still go through scripts/deploy.sh.
  preview: {
    port: 5273,
    host: true,
    proxy: DEV_PROXY,
  },
  test: {
    environment: 'jsdom',
    env: { TZ: 'UTC' },
    globals: true,
    // Local tool state directories may hold isolated worktrees (each a full repo copy);
    // without the exclusion, vitest recurses into them, runs another checkout's tests,
    // and fails en masse.
    // (Before this package was inlined, this also needed an extra symlink for the old external
    // service package to install dependencies — after inlining, `file:packages/service` is an in-repo relative
    // path that resolves naturally inside worktrees, so the symlink is no longer needed; a side benefit.)
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
    setupFiles: ['./vitest.setup.ts'],
  },
})
