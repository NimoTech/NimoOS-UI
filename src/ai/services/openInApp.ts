// 1:1 移植自 Vue2 src/views/AI/Agent/services/openInApp.js,按新仓库的两套并存应用
// (Vue2 挂 `/`、New-UI 挂 `/app/`)调整落点:
//   - 文件 → New-UI 自己的 Files 页(`/app/#/files?path=&highlight=`,SP4 已收官,
//     真实存在且接受这组 query 参数,见 src/views/Files.vue)。
//   - 照片 → 仍指向旧 Vue2 的 Photos 页(`/#/photos?...`,root-mounted,hash 路由)。
//     New-UI 自己的相册区在另一个尚未合并的 worktree(SP7,见 memory
//     sp7-photos-migration-progress)开发,本分支(sp8-ai)还没有 `/app/#/photos`
//     路由,所以暂时借道旧应用这个真实可用的落点;SP7 合并后应把这两处换成
//     New-UI 自己的 Photos 路由。
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
// 1:1 移植自 Vue2 openInApp.js:52-55 —— 与 openFileInNewTab 共用本仓既有的
// filesPathUrl(New-UI /app/ 挂载点),不是蓝本自己的虚拟路径实现。
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

// 1:1 移植自 Vue2 openInApp.js:117-124(`agentSessionUrl` / `openAgentSessionInNewTab`)。
// 🔴 与上面几个不同,这两个函数**逐字照抄蓝本的落点** —— 指向旧 Vue2 应用根挂载的
// `/#/ai/agent?session=…`,**没有** `/app` 前缀。这是刻意的,不是漏加前缀:
// New-UI 自己也有 `/ai/agent` 路由(`router/index.ts`),但 AgentPage.vue 与
// agentStore 全仓零 `?session=` 读取,指到 `/app/#/ai/agent?session=X` 会打开
// New-UI 的 Agent 页却不选中那条会话(静默失效);Vue2 的 Agent.vue:129/164/212
// 真的读 `$route.query.session`。同款先例见上面 photosAssetUrl 的处理:
// New-UI 还没有该能力时,暂时借道旧应用这个真实可用的落点;待 New-UI 的
// `/ai/agent` 补上 `?session=` 深链支持后,应换成 `/app/#/ai/agent?session=…`。
// 交接票:「New-UI Agent 页补 `?session=` 深链」(P5e/P5f,依据裁定 A-8)。
export function agentSessionUrl(sessionId: string | number): string {
  return '/#/ai/agent?session=' + encodeURIComponent(String(sessionId))
}

export function openAgentSessionInNewTab(sessionId: string | number | null | undefined): void {
  if (!sessionId) return
  window.open(agentSessionUrl(sessionId), '_blank')
}
