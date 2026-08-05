# Task 9 — SP4-P4a file-viewer whole-branch code-review fixes: report

Scope: apply all IMPORTANT + MINOR findings from the code review of the file-viewer feature
(ViewerHost/ImageViewer/MediaViewer/CodeViewer/MarkdownViewer/ViewerShell + panelMap/mediaKind/
codeContent + fileCategories + tests + i18n) in one cohesive change.

## IMPORTANT #1 — Download after paging targeted the wrong image

Problem: `ViewerHost.onDownload()` read `v.currentItem.value` (the entry the overlay was
originally opened with), but `ImageViewer` pages prev/next via a local `index`/`current`
computed that never touches the shared `useViewer` state. After paging, Download would
still fetch the file the overlay was opened on, not the one on screen.

Changes:
- `src/files/viewers/ImageViewer.vue`
  - `defineEmits` narrowed from `(e:'download'): void` to `(e:'download', entry: FileEntry): void`.
  - Template: `@download="emit('download')"` → `@download="emit('download', current)"` (line ~75) —
    `current` is the existing `computed(() => items[index.value] ?? props.item)`, i.e. the
    currently displayed image.
- `src/files/viewers/CodeViewer.vue`, `src/files/viewers/MediaViewer.vue`,
  `src/files/viewers/MarkdownViewer.vue`
  - Same `defineEmits` narrowing to `(e:'download', entry: FileEntry): void`.
  - Template `@download="emit('download')"` → `@download="emit('download', props.item)"` (these
    three have no internal paging, so `props.item` is always correct/current).
- `src/files/viewers/ViewerHost.vue`
  - `onDownload()` → `onDownload(entry?: FileEntry)`, body:
    `const items = [entry ?? v.currentItem.value].filter(Boolean) as FileEntry[]; if (items.length) ops.download(items)`.
  - Template unchanged (`@download="onDownload"` already forwards Vue's emitted payload as the
    first handler argument — verified via `pnpm exec vue-tsc --noEmit` passing and via the
    `emit('download', current)` / `emit('download', props.item)` payloads type-checking against
    `onDownload(entry?: FileEntry)`).
  - `v.currentItem.value` kept as a fallback for safety (defensive; should not be hit once (1)
    is honored end-to-end, but guards against any future viewer that forgets to pass a payload).

## IMPORTANT #2 — Async onMounted has no unmount guard → orphaned player/editor

Problem: In `MediaViewer.vue` and `CodeViewer.vue`, `onMounted` is `async` and awaits dynamic
imports (and, for audio, `mm.fetchFromUrl`) before constructing the player/editor instance and
assigning it to the module-scoped `artInst`/`apInst`/`view` variable. If the overlay is closed
(component unmounted) while one of those awaits is in flight:
1. `onBeforeUnmount` runs immediately, but the instance variable is still `null`, so the
   existing `if (inst?.destroy) inst.destroy()` guards do nothing.
2. The pending promise later resolves, `onMounted`'s continuation constructs the instance
   (Artplayer/APlayer with `autoplay: true`, or a `new EditorView(...)` attached to
   `host.value` which itself may now be a detached DOM node), and assigns it to the
   already-orphaned variable. No unmount hook exists to destroy it — Artplayer/APlayer keep
   playing audio/video with no UI and no way to stop them; the EditorView leaks a detached
   editor + its DOM subscriptions.

Fix — module-local `disposed` flag, checked after every `await`, set before destroy:
- `src/files/viewers/MediaViewer.vue`
  - Added `let disposed = false` next to `artInst`/`apInst`.
  - Video branch: `if (disposed) return` immediately after
    `const Artplayer = (await import('artplayer')).default`, before `new Artplayer(...)`.
  - Audio branch: `if (disposed) return` after `await import('music-metadata-browser')`,
    again after `await mm.fetchFromUrl(url)` (both inside the existing `try`, so an early
    `return` there simply skips the rest of metadata handling and player construction — the
    `catch` is unaffected since no exception is thrown), again after
    `const APlayer = (await import('aplayer')).default`, and again after
    `await import('aplayer/dist/APlayer.min.css')`, immediately before `new APlayer(...)`.
  - `onBeforeUnmount`: `disposed = true` is now the FIRST statement, before the existing
    `artInst?.destroy(false)` / `apInst?.destroy()` / `URL.revokeObjectURL` calls (those calls
    are unchanged — they still correctly destroy an instance that *did* finish constructing
    before unmount).
  - No new `await` was introduced between the final guard and each constructor call in either
    branch — the guard-then-construct pairs stay synchronous, so once `disposed` reads `false`
    at the last checkpoint, construction and assignment happen atomically before any further
    yield point, meaning the instance can never be left unassigned-but-constructed.
- `src/files/viewers/CodeViewer.vue`
  - Added `let disposed = false` next to `view`.
  - `onMounted`: wrapped `await readCode()` in try/catch (see MINOR fix below), then
    `if (disposed) return`; then `await langFor(fileExt(props.item.name))`, then
    `if (disposed) return`; then (synchronously) builds `exts` and calls
    `new EditorView(...)`. Same "no await between last guard and construction" property holds.
  - `onBeforeUnmount`: `disposed = true` first, then `view?.destroy(); view = null` (unchanged
    destroy logic, now guaranteed to run before any late-arriving `new EditorView` could occur,
    and the late-arriving construction is now skipped entirely by the guard).

## IMPORTANT #3 — ESC-to-close missing

Added to `src/files/viewers/ViewerHost.vue` (the persistently-mounted host with lifecycle
access to `useViewer`):
```ts
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && v.open.value) v.close()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
```
Paired add/remove on the same persistent component — no leak, and the `v.open.value` check
means Escape is a no-op when no viewer is open (doesn't interfere with other Escape handling
elsewhere in the app, e.g. dialogs, since `ViewerHost` is always mounted).

## MINOR fixes

- **getContent failure toast** (`CodeViewer.vue`, `MarkdownViewer.vue`):
  - `CodeViewer.vue` `onMounted`: `readCode()` is now called inside `try { content = await readCode() } catch { toast.show(t('filesViewerReadFailed')); return }`, so a network/parse
    failure now surfaces a toast and aborts editor construction instead of leaving `onMounted`
    to throw silently (previously an unhandled rejection with no user feedback).
  - `MarkdownViewer.vue` `onMounted`: wrapped the read+coerce+render in try/catch; on error
    `toast.show(t('filesViewerReadFailed'))`. Added imports `useToast` from `'../../stores/toast'`
    and `useI18n` from `'vue-i18n'` (previously unused in this file).
  - Added i18n key `filesViewerReadFailed: '读取文件失败'` to `src/i18n/zh_cn.ts` (placed next to
    the other `filesViewer*` keys).
- **coerceContent defensive read** (`CodeViewer.vue`, `MarkdownViewer.vue`): both now do
  `const raw = await service.file.getContent(...)` then
  `coerceContent(typeof raw === 'string' ? raw : (raw as { content?: unknown })?.content ?? raw)`
  instead of passing the raw envelope payload straight through, guarding against the endpoint
  ever returning `{content: string}` instead of a bare string.
- **Hoisted playable-video whitelist**: added
  `export const BROWSER_PLAYABLE_VIDEO = ['mp4','m4v','webm','mov','3gp']` to
  `src/files/util/fileCategories.ts`. `src/files/viewers/panelMap.ts` now imports it and uses
  `union(BROWSER_PLAYABLE_VIDEO, AUDIO_X_GENERIC)` for the `video-player` panel type (removed
  the local `browserPlayableVideo` const). `src/files/viewers/mediaKind.ts` now imports it and
  uses it in place of the local `VIDEO` const. Re-ran `pnpm test -- panelMap` (7/7 passed) and
  `pnpm test -- mediaKind` (3/3 passed) — behavior unchanged, confirming the two whitelists
  can no longer drift apart.
- **`type="button"`**: added to all 5 relevant buttons —
  `ViewerShell.vue` (`.viewer-download`, `.viewer-close`), `CodeViewer.vue` (`.viewer-save`
  toolbar button, and the 3 `Dialog` footer buttons: cancel / don't-save / save).
- **Removed dead `.audio` class binding**: `MediaViewer.vue`'s `.media-wrap` div had
  `:class="{ audio: kind === 'audio' }"` with no corresponding `.audio` CSS rule anywhere in
  the component — removed the binding, leaving a plain `class="media-wrap"`.
- **Removed unused `vi` import**: `src/views/Files.openEntry.test.ts` imported `vi` from
  `vitest` but never used it — removed from the import list.
- **XSS regression tests**: added to `src/files/viewers/renderMarkdown.test.ts`:
  - asserts `renderMarkdown('<script>alert(1)</script>')` contains neither `<script>` nor
    `</script>` (confirms `html:false` escapes embedded HTML rather than passing it through).
  - asserts `renderMarkdown('[click me](javascript:alert(1))')` does not contain
    `href="javascript:alert(1)"` (confirms markdown-it's built-in link-protocol validation
    neutralizes `javascript:` URIs). Both pass against the existing `renderMarkdown.ts`
    (`new MarkdownIt({ html: false, linkify: true, breaks: true })`) with no implementation
    change needed.

## Verification

1. `pnpm test` (full suite): **122 test files, 455 tests — all passed** (includes the 2 new
   XSS tests and the unchanged panelMap/mediaKind suites re-verified individually beforehand).
2. `pnpm exec vue-tsc --noEmit`: **0 errors, 0 output**.
3. `pnpm build`: **succeeded** (`vue-tsc --noEmit && vite build`, "✓ built in 3.64s"). Only
   pre-existing, unrelated warnings appeared (Rollup `#__PURE__` comment-position warnings from
   `@vueuse/core`, an `eval` warning from `file-type`, and the >500kB chunk-size advisory) —
   none introduced by this change and none are errors.

## Files changed (staged for the commit)

- `src/files/util/fileCategories.ts`
- `src/files/viewers/panelMap.ts`
- `src/files/viewers/mediaKind.ts`
- `src/files/viewers/ImageViewer.vue`
- `src/files/viewers/MediaViewer.vue`
- `src/files/viewers/CodeViewer.vue`
- `src/files/viewers/MarkdownViewer.vue`
- `src/files/viewers/ViewerHost.vue`
- `src/files/viewers/ViewerShell.vue`
- `src/i18n/zh_cn.ts`
- `src/views/Files.openEntry.test.ts`
- `src/files/viewers/renderMarkdown.test.ts`

Explicitly NOT staged/touched: `src/files/composables/useFileOps.ts`,
`src/home/components/widgets/*`, `src/home/grid/gridMath.*`, `src/router/*`,
`src/files/util/clipboard.*`, `tmp/` — these are pre-existing uncommitted parallel WIP
(auth/home-widgets work) present in the working tree before this task started; left
untouched per the task constraints and not included in the commit (staged individual files
by name, not `git add -A`).

## Concerns

- None blocking. Two small judgment calls worth flagging for reviewers:
  1. `ViewerHost.onDownload`'s fallback to `v.currentItem.value` when no payload is passed is
     defensive dead code today (every viewer now always emits a payload) — kept per the task's
     explicit instruction ("fall back to currentItem for safety").
  2. The `javascript:` link XSS test asserts on markdown-it's default sanitization behavior
     (no `html:false`-independent protocol allowlist is configured in `renderMarkdown.ts`);
     this is existing library-default behavior, not something this change implements, but the
     test now pins it as a regression guard.
