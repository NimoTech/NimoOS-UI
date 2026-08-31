# NimoOS Web UI

The web interface for NimoOS, built with **Vue 3 + TypeScript + Vite**.

It is served at the site root (`http://<host>/#/`) with hash routing, and covers the whole
system: **Login / first-boot Welcome guide**, **Desktop Home** (app grid, Dock, widgets,
Docker app recognition), **Files** (management, upload, sharing, built-in viewers for
images/videos/audio/PDF/Office/code/Markdown, snapshot Time Machine), **App Store &
installed apps**, **Storage & RAID**, **Virtual machines**, **Web terminal**, **Photos**,
and the **AI assistant with its knowledge base**.

## Tech Stack

- **Vue 3** (`<script setup>`) · Vite 7 · TypeScript (`strict`) · Pinia · vue-router 4 · vue-i18n 9
- **reka-ui** (headless component primitives) — **no Tailwind, no UI/CSS framework**, all styles hand-written
- Viewers: artplayer / aplayer (audio/video) · pdfjs-dist · @vue-office (docx/xlsx) · CodeMirror 6 (code) · markdown-it
- socket.io-client (MessageBus events) · tus-js-client (resumable upload)
- Testing: Vitest + @vue/test-utils, test files colocated with implementation (`*.test.ts`)

## Environment Requirements

- Node.js ≥ 20, **pnpm** (do not use yarn / npm)
- Shared HTTP/authentication core package `@nimotech/nimoos-service` is inlined in this repo under `packages/service/`
  (specified in `package.json` as `file:packages/service`) — **clone only this repo to install dependencies**,
  no need to separately clone or build any sibling repositories.

## Quick Start

```bash
git clone git@github.com:NimoTech/NimoOS-UI.git
cd NimoOS-UI
pnpm install
pnpm dev        # dev server http://localhost:5273/
```

The dev server requires an accessible NimoOS backend (Gateway) to provide APIs — API
requests under `/v1|/v2|/v3` are proxied to it (see `vite.config.ts`).

### Common Commands

```bash
pnpm dev                    # dev server (port 5273)
pnpm test                   # vitest full test suite
pnpm test:watch             # vitest watch mode
pnpm build                  # vue-tsc --noEmit type check + vite build → dist/
pnpm exec vue-tsc --noEmit  # type check only
```

### Deploy to Device

Initial directory setup (one-time only, the rsync target of `deploy.sh` must exist and be writable by the current user):

```bash
sudo mkdir -p /var/lib/nimoos/www
sudo chown "$USER:$USER" /var/lib/nimoos/www
```

After that, every deployment:

```bash
./scripts/deploy.sh   # pnpm build + rsync --delete dist/ → /var/lib/nimoos/www/
```

Deployment to devices **must always go through this script**, do not manually write rsync/cp
to `/var/lib`. Besides laying out the build it protects the previous build's hashed chunks
(so already-open tabs keep lazy-loading), and keeps the legacy `/app/` mount working as a
redirect to `/` for old bookmarks. After deployment, verify by accessing
`http://<device-IP>/` in the browser.

## Directory Structure

```
src/
├── main.ts            # assembly: pinia → initService → i18n → router → mount
├── router/            # hash routing + guards (uninitialized → /welcome, no token → /login)
├── stores/            # Pinia: session / locale / toast / utilization
├── composables/       # useAuth / useMessageBus / useUtilization / useValidation
├── home/              # desktop home: app grid, Dock, widgets, container event bridge
├── files/             # files area: list, upload, sharing, snapshots, viewers/
├── apps/              # app store and installed apps
├── storage/           # volumes, drives, RAID
├── kvm/               # virtual machines
├── terminal/          # web terminal
├── photos/            # photo library
├── ai/                # AI assistant, knowledge base, settings
├── views/             # page-level components
├── i18n/              # zh_cn.ts + en_us.ts merge outlets over per-area slices
└── styles/theme.css   # global theme tokens (see below)
docs/
├── THEMING.md         # theme system authority document
└── nimoos-app-label-spec.md
```

## Development Conventions

### Theme/Colors (Hard Requirement)

**All visible colors must come from tokens defined in `src/styles/theme.css` (`var(--…)`), hardcoded color literals are forbidden** (`#fff`, `rgba(...)`, named colors). Themes are switched globally via the root node's `data-theme` attribute: default is blue/dark glass theme, `data-theme="light"` is beige/paper theme. When adding new color semantics, add a token in `theme.css` and assign values in **every theme block**. See [`docs/THEMING.md`](docs/THEMING.md) for complete rules and exceptions.

### i18n

The language of a first visit follows the browser: any Chinese `navigator.language` gets `zh_cn`, everything else gets `en_us` (`src/i18n/locale.ts`, shared by `i18n/index.ts`, `main.ts`'s `getLang` and the Welcome picker). A language the user has picked is stored and always wins.

When adding new copy keys, they must be added to **both** the `zh_cn` and `en_us` sides of the same slice — `parity.test.ts` asserts that both languages have identical keys, test fails if one is missing.

### Authentication

- JWT (access/refresh) stored in localStorage, failed auth is handled by shared package which attempts refresh on 401.
- Auth failure handling order must not be reversed: **clear invalid tokens first, then redirect to `/#/login`** (otherwise route guards cause infinite redirect loops).

### Shared Package (`@nimotech/nimoos-service`)

Source code is inlined in this repo under `packages/service/`, no separate build needed. After making changes: **restart the dev server**
(`Ctrl-C` then `pnpm dev`) for changes to take effect — Vite's file watcher ignores `node_modules/**` by default,
and this package is served from that path, so file saves do not automatically trigger hot updates. After restart, the browser may still hit
disk cache (the module URL has `immutable` cache header), requiring **hard refresh** (`Ctrl-Shift-R`) to
see new code. No need for `pnpm build`, clearing `.vite` cache, or `pnpm install` — unless
`packages/service/src/*.ts` hardlinks in `node_modules/.pnpm/` get broken (after restart +
hard refresh if still seeing old code, run `pnpm install` once to relink).
