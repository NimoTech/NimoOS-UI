# NimoOS Web UI

Web control console for NimoOS home server / NAS — **Vue 3 + TypeScript + Vite**.

Mounted at `/app/`, using hash routing (`/app/#/`). Covered features: login & setup wizard, desktop home (app grid / Dock / widgets / Docker app detection), files area (manage / upload / share / image/video/audio/PDF/Office/code/Markdown preview), apps & app store, storage (volumes / disks / RAID / snapshots), virtual machines (KVM, including creation wizard & noVNC console), system settings.

## Tech stack

- Vue 3 (`<script setup>`) · Vite 7 · TypeScript (`strict`) · Pinia · vue-router 4 · vue-i18n 9
- **reka-ui** (headless primitives) — no Tailwind, no UI/CSS framework, all styles handwritten
- Viewers: artplayer / aplayer · pdfjs-dist · @vue-office (docx/xlsx) · CodeMirror 6 · markdown-it
- socket.io-client (message bus) · tus-js-client (resumable upload) · @novnc/novnc (VM console)
- Testing: Vitest + @vue/test-utils, test files colocated with implementation (`*.test.ts`)

## Directory structure

```
src/                 Frontend source code
packages/service/    HTTP / auth core shared package (@nimotech/nimoos-service), inlined
```

The shared package is linked via `file:packages/service` in `package.json` — clone a single repository and develop without needing to pull additional packages.

## Getting started

Requires Node.js ≥ 20.19 (Vite 7's engines require `^20.19.0 || >=22.12.0`; versions 20.0–20.18 will error after installation) and **pnpm** (do not use yarn / npm).

```bash
pnpm install
pnpm dev          # http://localhost:5273/app/
pnpm test         # vitest run
pnpm build        # vue-tsc --noEmit + vite build → dist/
```

`pnpm dev` will forward requests outside `/app/` (API, message bus WebSocket) to the NimoOS gateway at `http://127.0.0.1:80`. Modify the `DEV_PROXY` setting in `vite.config.ts` to point to your device.

## Deployment

Build artifacts are **pure static files** (`dist/`), no server-side rendering. The `base` is `/app/`, so all asset paths start with `/app/` — **must be mounted at the `/app/` path in the URL**; putting it at the site root will result in a blank screen (asset 404s).

The frontend is just a shell: API and message bus WebSocket are both served by the NimoOS gateway, so artifacts must be hosted **same-origin** with the gateway. The gateway includes built-in static hosting, with default root directory `/var/lib/nimoos/www/` (configurable via startup parameter `-w`), so URL `/app/` corresponds to `/var/lib/nimoos/www/app/` on disk.

### Deploy directly on the device

On first setup, prepare the directory (one-time):

```bash
sudo mkdir -p /var/lib/nimoos/www/app
sudo chown "$USER:$USER" /var/lib/nimoos/www/app
```

Subsequent deployments are one command:

```bash
./scripts/deploy.sh
```

It does three things: `pnpm build` → `rsync` sync `dist/` to `/var/lib/nimoos/www/app/` → clean up old build artifacts from 14 days ago. After completion, open in the browser:

```
http://<device-address>/app/#/
```

The gateway listens on **80** by default; if port 80 is in use, it tries ports 81-89 then 8080-8089 in sequence, so the address should include the actual port being used.

### Deploy from development machine to remote device

```bash
pnpm build
rsync -avz --delete --filter='protect assets/*' dist/ user@<device-address>:/var/lib/nimoos/www/app/
```

⚠️ **The `--filter='protect assets/*'` flag cannot be omitted.** Each build produces JS/CSS with new content hashes, but browser tabs already open before deployment still hold the old `index.html` and will lazy-load routes and viewers by old filename. If deployment completely deletes old `assets/`, these tabs get 404 when opening new pages, and **it won't self-heal** — manifests as "nothing happens on click, manual refresh fixes it". Preserving old files and gradually cleaning them up by modification time is the only user-transparent approach (`deploy.sh` does it this way).

### Behind reverse proxy (nginx, etc.)

Hash routing (`/app/#/...`) always has `/app/` as the path part, so **no history fallback rule is needed**. Only two rules are needed: mount static files at `/app/`, forward all other paths (including WebSocket upgrades) to the gateway.

```nginx
location /app/ {
    alias /var/lib/nimoos/www/app/;
}

location / {
    proxy_pass http://127.0.0.1:80;        # Actual gateway port
    proxy_http_version 1.1;
    proxy_set_header Upgrade          $http_upgrade;
    proxy_set_header Connection       "upgrade";
    proxy_set_header Host             $host;
    proxy_set_header X-Forwarded-For  $proxy_add_x_forwarded_for;   # See warning below
}
```

⚠️ **The `X-Forwarded-For` header must be forwarded.** The gateway skips JWT validation for requests from `127.0.0.1` / `::1` (a loophole for inter-service calls on localhost). Requests coming through a reverse proxy appear to originate from `127.0.0.1` to the gateway, and it relies on the last item in `X-Forwarded-For` to restore the real client IP — without this header, anyone on the same network can call API endpoints without a token.

### Quick preview of build artifacts

```bash
pnpm build
pnpm preview      # http://localhost:5273/app/; API forwarding rules same as pnpm dev
```

## Color convention (hard constraint)

**All visible colors must come from theme tokens (`var(--…)`) in `src/styles/theme.css`; hardcoding colors like `#fff` / `rgba(...)` / named colors in components is forbidden.** Colors must be switchable as a whole: `:root` is the dark glass theme, `:root[data-theme="light"]` is the beige paper-feel theme, **each color token must have a value in both theme blocks**. When new color semantics are needed, add a token and assign values to both themes.

This constraint ensures colors can always be swapped/extended as a whole — once a specific color value is hardcoded somewhere, theme switching or skin changes will miss it, and over time stray "un-editable" colors accumulate. This is mentioned to external contributors because without it, the first PR would likely casually add a literal color value.

There are only two exceptions, and each must be marked with a comment: `.ic-*` app icon gradients in `theme.css` (brand identification colors, theme-independent) and colors deep inside third-party libraries that cannot be tokenized (e.g., CodeMirror theme, which uses its own theming mechanism).

## i18n

Locale files are in `src/i18n/` (`zh_cn` / `en_us`). On a first visit the language follows the browser — any Chinese `navigator.language` gets `zh_cn`, everything else gets `en_us` (`src/i18n/locale.ts`); once the user picks a language it is stored and always wins. **New copy keys must be added to both files simultaneously** — `src/i18n/parity.test.ts` asserts that the key sets are identical on both sides; missing one fails the test.

## Known gaps

1. **File area snapshot management incomplete** — time machine (browse history by timeline) works, full snapshot management UI is not yet complete.
2. **Only Chinese and English languages.**
3. **Terminal tab in settings is empty state** — the corresponding backend service has not been provided yet (`/v1/sys/wsssh`, `/v1/terminal/settings` both return 404).
4. **Storage tab in settings is a navigation card, not a full panel** — complete functionality is under the `/storage` route.
