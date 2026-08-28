// 1:1 port from Vue2 src/views/AI/Agent/services/openInApp.js, adjusted for two coexisting
// apps in the new repository (Vue2 mounted at `/`, New-UI at `/app/`), landing points:
//   - Files → New-UI's own Files page (`/app/#/files?path=&highlight=`, SP4 complete,
//     exists and accepts these query parameters, see src/views/Files.vue).
//   - Photos → still point to old Vue2 Photos page (`/#/photos?...`, root-mounted, hash router).
//     New-UI's own photo gallery is being developed in another unmerged worktree (SP7, see
//     memory sp7-photos-migration-progress); this branch (sp8-ai) doesn't have the
//     `/app/#/photos` route yet, so we temporarily use the old app's working landing point;
//     after SP7 merges, these two should be replaced with New-UI's own Photos route.
//   - Agent → New-UI's own Agent page (`/app/#/ai/agent?session=`, ticket A-8, 2026-08-19,
// see the design note), since AgentPage
//     now reads and follows `?session=` itself.
//
// Helpers to open a search-result item in its dedicated app page, in a new tab.
// Each click opens a fresh tab ('_blank'): the target is a hash-mode SPA route,
// so re-pointing a reused named tab to a new ?asset=/?path= would only change the
// hash without remounting the page — the tab would stay on the previous item.

// Split an absolute file path into its parent directory and file name.
// Defensive against root paths, trailing slashes, and bad input.
export function fileDirAndName(filePath: string | null | undefined): { dir: string; name: string } {
  if (!filePath || typeof filePath !== 'string') {
    return { dir: '/', name: '' }
  }
  // Drop trailing slash(es) for directory-form inputs (but keep a lone '/').
  const s = filePath.length > 1 ? filePath.replace(/\/+$/, '') : filePath
  if (!s || s === '/') {
    return { dir: '/', name: '' }
  }
  const idx = s.lastIndexOf('/')
  if (idx < 0) {
    return { dir: s, name: s }
  }
  if (idx === 0) {
    return { dir: '/', name: s.slice(1) }
  }
  return { dir: s.slice(0, idx), name: s.slice(idx + 1) }
}

export function photosAssetUrl(id: string | number): string {
  return '/#/photos?asset=' + encodeURIComponent(String(id))
}

export function filesPathUrl(dir: string, name: string): string {
  return '/app/#/files?path=' + encodeURIComponent(dir) + '&highlight=' + encodeURIComponent(name)
}

export function openPhotoInNewTab(id: string | number | null | undefined): void {
  if (!id) return
  window.open(photosAssetUrl(id), '_blank')
}

export function openFileInNewTab(filePath: string | null | undefined): void {
  if (!filePath) return
  const { dir, name } = fileDirAndName(filePath)
  window.open(filesPathUrl(dir, name), '_blank')
}

// Open a directory itself (no file highlight) in the Files app.
// 1:1 port from Vue2 openInApp.js:52-55 — reuses the existing filesPathUrl from the
// repository with openFileInNewTab (New-UI /app/ mount point), not the blueprint's own
// virtual path implementation.
export function openDirInNewTab(dirPath: string | null | undefined): void {
  if (!dirPath) return
  window.open(filesPathUrl(dirPath, ''), '_blank')
}

const PHOTOSET_PREFIX = 'nimo:photoset:'

export function photosSetUrl(token: string, activeId: string | number): string {
  return '/#/photos?photoset=' + encodeURIComponent(token) + '&active=' + encodeURIComponent(String(activeId))
}

// Open the Photos page in a new tab showing a whole set of search-result images
// (browsable in the lightbox), with `activeId` shown first. The id list is handed
// off via localStorage (keyed by a one-shot token) so it survives any size and is
// not capped by URL length. Falls back to a single-asset open if storage fails.
export function openPhotoSetInNewTab(
  ids: Array<string | number | null | undefined>,
  activeId: string | number | null | undefined,
): void {
  const clean = (ids || []).filter(Boolean) as Array<string | number>
  if (!clean.length) {
    if (activeId) openPhotoInNewTab(activeId)
    return
  }
  const active = activeId && clean.includes(activeId) ? activeId : clean[0]
  let token: string
  try {
    pruneStalePhotoSets()
    token = String(Date.now()) + '_' + Math.random().toString(36).slice(2, 8)
    localStorage.setItem(PHOTOSET_PREFIX + token, JSON.stringify({ ids: clean }))
  } catch {
    // localStorage unavailable/full — degrade to opening just the active asset.
    openPhotoInNewTab(active)
    return
  }
  window.open(photosSetUrl(token, active), '_blank')
}

// Remove photoset handoff entries older than 2 minutes. Each entry is normally
// consumed (and deleted) by the new tab on mount; this only clears the rare
// leftover from a blocked/failed tab open so the keys can't accumulate.
function pruneStalePhotoSets(): void {
  const cutoff = Date.now() - 120000
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i)
    if (k && k.indexOf(PHOTOSET_PREFIX) === 0) {
      const ts = parseInt(k.slice(PHOTOSET_PREFIX.length), 10)
      if (!ts || ts < cutoff) localStorage.removeItem(k)
    }
  }
}

// Ported from Vue2 openInApp.js:117-124 (`agentSessionUrl` / `openAgentSessionInNewTab`),
// no longer byte-identical: the landing URL below deliberately differs from Vue2's, per the
// A-8 history explained next. Originally these deliberately landed on the root-mounted old
// Vue2 app because New-UI's
// /ai/agent read no `?session=` at all, so an /app-prefixed link would have opened the Agent
// page without selecting the session (a silent failure). Ticket A-8 closed that gap on
// 2026-08-19 — AgentPage now mirrors, reads and follows `?session=`
// — so the landing point
// is New-UI's own route, and openInApp.test.ts's reverse assertions now guard against a
// regression back to the old app.
export function agentSessionUrl(sessionId: string | number): string {
  return '/app/#/ai/agent?session=' + encodeURIComponent(String(sessionId))
}

export function openAgentSessionInNewTab(sessionId: string | number | null | undefined): void {
  if (!sessionId) return
  window.open(agentSessionUrl(sessionId), '_blank')
}
