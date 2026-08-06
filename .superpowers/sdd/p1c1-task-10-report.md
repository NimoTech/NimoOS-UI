# Task 10 report — AgentComposer attachment pipeline

## Files changed
- `src/ai/components/shell/AgentComposer.vue`
- `src/ai/components/shell/AgentComposer.test.ts`
- `src/i18n/zh_cn.ts`
- `src/i18n/en_us.ts`

## Pipeline steps → Vue2 line mapping

| Piece | Vue2 lines | New-UI |
|---|---|---|
| `attachments` data shape | 220-225 | `PendingAttachment` interface + `attachments = ref<PendingAttachment[]>([])` |
| Attachment chip template (classes/badges) | 18-42 | second `v-for` in `.composer-chips`, same classes `is-uploading`/`is-failed`/`is-doc-warn`, same child spans (`ctx-chip-prog`/`ctx-chip-err`/`ctx-chip-doc-warn`) |
| `onFilesPicked` | 506-602 | `onFilesPicked(e)` — reset `input.value`, empty-select bail, lazy `createSession()` (517-527) with danger toast + return on failure, per-file 500 MB gate (531-537) using `MAX_ATTACHMENT_BYTES`, sequential `for...of`, push-then-upload (545), `onProgress` mutating entry, success writes `aid/kind/mime/status`, `kind==='document'` + `meta.extract_error` → `docError` + 7000 ms warning toast (558-578), `kind==='binary'` + `not_installed` + doc-looking filename → same 7000 ms toast (582-591), catch → `status='failed'` + `error` + danger toast (592-600) |
| `removeAttachment` | 604-611 | best-effort server delete when `status==='uploaded' && aid`, then local filter |
| `chipTitle`/`docOkLabel`/`docErrorLabel`/`docErrorShort` | 460-504 | ported 1:1, using `docErrorKey`/`docErrorShortKey` from `attachmentMeta.ts` for the i18n key lookup |
| `attachmentHint` | 234-244 | computed joining `aiAttachHint1..7` with `\n`, bound to attach button's native `title` (Buefy `<b-tooltip>` has no New-UI equivalent — commented in code) |
| `submit()` attachment half | 438-452 | `readyAttachments` filter, `attachmentIds`/`attachmentRefs` (`url` via `service.ai.attachmentRawUrl`), second in-flight guard, clears `attachments.value` after emit |
| `activeSessionId` watcher | 275-281 | added; body only does `attachments.value = []` this task; left a `// Task 11 seam: closeMention() 调用点.` comment for the next task to add the mention-close call — no second watcher created |
| attach button `@mousedown.prevent` + `openFilePicker()` | 82, 643-650 | ported verbatim including the mousedown-not-click rationale comment |

## i18n keys added (both zh_cn.ts and en_us.ts)

All 8 `aiDocErr*` long sentences + `aiDocErrGeneric`, all 8 `aiDocErrShort*` short labels + `aiDocErrShortParse`, `aiDocOkExtracted`/`aiDocPages`/`aiDocTruncated`, `aiAttachHint1..7`, `aiAttachTooLarge`, `aiAttachSessionFailed`.

Sourcing:
- English: verbatim copy of the literal strings Vue2 passes to `this.$t(...)` in `AgentComposer.vue` (460-504, 234-244, 522, 533). Spot-checked against Vue2's shipped `src/assets/lang/en_US.json` — for every key checked it is an identity map (English key === English value), confirming this is correct.
- Chinese: pulled the existing translations out of Vue2's shipped `src/assets/lang/zh_CN.json` by looking up the same English key strings, per the brief's "reuse shipped translation over writing your own" instruction. Two deviations from the brief's suggested wording, both because the shipped file differs from the brief's guess:
  - `aiAttachTooLarge`: brief suggested `'{name} 超过 500 MB 上限'`; shipped zh_CN.json actually has `'{name} 超过 500MB 上限'` (no space before MB) — used the shipped string.
  - `aiAttachSessionFailed`: brief suggested `'建会话失败:{err}'`; shipped zh_CN.json has `'创建会话失败：{err}'` (different phrasing + full-width colon) — used the shipped string.

`src/i18n/parity.test.ts` passes (key sets match, all en_us values non-empty strings).

## Vue2 defects noticed — none fixed, none copied

No behavioral defect was found in the ported Vue2 slice worth deviating from (the pipeline logic itself — ordering, guards, error handling — was sound). The one Vue3-specific issue encountered was **not** a Vue2 defect but a port hazard:

**Vue3 reactivity hazard (not a Vue2 bug, a porting pitfall):** Vue2's `data()` makes every property of every array item deeply reactive automatically, so Vue2 could push a plain object into `this.attachments` and later do `entry.progress = p` and have it just work. In Vue3, pushing a **plain** object into a `ref<T[]>` array and then mutating that same plain-object reference directly does *not* trigger reactivity — the object read back out of the array via the template's `v-for` is a cached `reactive()` proxy that Vue creates internally, which is a *different* wrapper than the raw object your closure is holding; writes through the raw closure reference bypass the proxy's `set` trap entirely, so no effect re-runs. This surfaced as 4 real test failures during implementation (progress % never updated, `is-failed`/`is-doc-warn` classes never applied, and consequently the disabled `send-btn` never re-enabled so the click test's `emitted('send')` came back `undefined`). Fixed by wrapping the newly-created entry with `reactive<PendingAttachment>({...})` before pushing, so the object your closure mutates *is* the canonical reactive proxy. Comment left at the `entry` declaration site explaining this (`AgentComposer.vue` ~line 267-275).

## Color-literal grep (required gate)

```
grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*white' src/ai/components/shell/AgentComposer.vue
```
Output: empty (exit code 1 / no matches). New chip-state CSS uses `var(--danger)`, `var(--warning)`, `var(--warning-soft)` (all defined in `src/ai/styles/tokens.scss`, globally loaded via `AgentPage.vue`). One early draft had these token names mentioned inside a comment using hex-looking literal text (`#e57373`/`#f59e0b`) describing what Vue2 used as raw fallbacks — reworded to avoid matching the grep even though it was prose, not CSS.

## Test commands + output tails

```
$ pnpm test -- src/ai/components/shell/AgentComposer.test.ts -t "附件管线"
```
Before implementation (RED, confirmed): 7 of 7 new tests failed for the expected reasons (toast count 0 not 1, `emit is not a function`, chip classes not found, empty DOMWrapper on `.ctx-chip-x`, `emitted('send')` undefined).

```
$ pnpm test -- src/ai/components/shell/AgentComposer.test.ts src/i18n/parity.test.ts
 Test Files  2 passed (2)
      Tests  18 passed (18)
```

```
$ pnpm exec vue-tsc --noEmit
(no output — clean)
```

```
$ pnpm test   # full repo suite
 Test Files  243 passed (243)
      Tests  1603 passed (1603)
```

## Seam left for Task 11

The `activeSessionId` watch handler currently only does `attachments.value = []`. A comment (`// Task 11 seam: closeMention() 调用点.`) marks exactly where Task 11 should add the mention-popover close call — no separate watcher should be created; extend this one.

## Noticed but left alone

- The right-panel `store.attachments`/`store.removeAttachment` (agentStore.ts) is a distinct server-side list from this component's local `attachments` pending-upload list, per the brief — confirmed untouched, no naming collision since the local variable is a bare `attachments` identifier and the store's is always accessed as `store.attachments`.
- `docErrorKey`'s generic fallback interpolates `{code}` via i18n params — verified this lines up with `aiDocErrGeneric: '文档抽取失败：{code}'` / `'Document extraction failed: {code}'`.

## Fix pass (review fixes, 2026-07-27)

Three review findings applied on top of Task 10. No i18n keys added (all needed keys already existed from Task 10). No refactors beyond the three fixes.

### Fix 1 (Important) — stale session id across the multi-file upload loop

Final loop code (`src/ai/components/shell/AgentComposer.vue`, `onFilesPicked`):

```ts
for (const file of files) {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    toast.show(t('aiAttachTooLarge', { name: file.name }), 5000)
    continue
  }
  const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  // reactive(), not a plain object: onProgress/success/failure below mutate
  // `entry` directly (Vue2 relied on Vue2's auto-reactive `data()` array
  // items for this — a plain object pushed into a Vue3 ref<T[]> array is
  // NOT itself the reactive proxy the template reads back out of the array,
  // so in-place field writes on a plain `entry` would silently not trigger
  // a re-render. Wrapping with reactive() up front makes `entry` itself the
  // canonical proxy Vue caches for this object, so writes through this same
  // reference correctly notify the template.
  const entry = reactive<PendingAttachment>({ tmpId, file, status: 'uploading', progress: 0 })
  attachments.value.push(entry)
  // Fix (review, 2026-07-27): Vue2 (AgentComposer.vue:547) reads `this.sessionId`
  // — a *computed* — fresh on every loop iteration, so a session switch mid-batch
  // just silently redirects the remaining uploads into whatever session happens
  // to be active now. That is wrong, not merely different: the `activeSessionId`
  // watcher above has already cleared every local chip for this batch (including
  // the one just pushed above, on the very next reactive flush), so the user has
  // no way to see or manage an attachment that lands in the new session — it's
  // an orphaned server-side draft. Per project rule (logic follows correctness,
  // not 1:1 UI parity), we re-read the session id here and stop the whole batch
  // the moment it no longer matches the id the batch started with, instead of
  // continuing to upload into it. Drop the entry we just pushed for this file
  // (it was never uploaded) before breaking, so no stale "uploading" chip can
  // flash before the watcher's clear takes effect.
  if (store.activeSessionId !== sid) {
    attachments.value = attachments.value.filter((a) => a.tmpId !== tmpId)
    break
  }
  try {
    const body = (await service.ai.uploadAttachment(sid, file, {
      onProgress: (p: number) => { entry.progress = p },
    })) as { id?: string; kind?: string; mime?: string; meta?: Record<string, unknown> }
    entry.aid = body.id
    entry.kind = body.kind
    entry.mime = body.mime
    entry.status = 'uploaded'
    if (body.kind === 'document' && body.meta) {
      if (body.meta.extract_error) {
        entry.docError = body.meta.extract_error as string
        toast.show(`${file.name}:${docErrorLabel(entry.docError)}`, 7000)
      } else {
        entry.docMeta = {
          extractor: (body.meta.extractor as string) || undefined,
          pages: (body.meta.pages as number) || undefined,
          truncated: !!body.meta.truncated,
        }
      }
    }
    if (
      body.kind === 'binary'
      && body.meta && body.meta.extract_error === 'not_installed'
      && /\.(pdf|docx|xlsx|xlsm|pptx)$/i.test(file.name)
    ) {
      toast.show(`${file.name}:${docErrorLabel('not_installed')}`, 7000)
    }
  } catch (err) {
    entry.status = 'failed'
    const errObj = err as { response?: { data?: { detail?: string } }; message?: string } | null
    entry.error = errObj?.response?.data?.detail || errObj?.message || 'upload failed'
    toast.show(`${file.name}: ${entry.error}`, 5000)
  }
}
```

Placement rationale: the re-check sits right after `push` and before the `await service.ai.uploadAttachment(...)` call, so the "push entry before awaiting upload" ordering stays byte-identical to Vue2/Task 10 for the common case (no session switch); the new check is purely additive. Placing it here (rather than before the 500 MB check) also makes the "remove the just-pushed entry" step reachable/meaningful — the entry for the file about to be uploaded really was pushed, and really does get cleaned up before the `break`.

RED tail (TDD, before the fix — the required failing test: two-file batch, switch session before the first upload resolves, assert `uploadAttachment` not called a second time):

```
FAIL  src/ai/components/shell/AgentComposer.test.ts > AgentComposer 附件管线 > 批次中途切换会话:后续文件停止上传,不产生跨会话孤儿附件
AssertionError: expected "vi.fn()" to be called 1 times, but got 2 times
 ❯ src/ai/components/shell/AgentComposer.test.ts:202:34
    200|     resolveFirst({ id: 'a1', kind: 'text' })
    201|     await flushPromises()
    202|     expect(svc.uploadAttachment).toHaveBeenCalledTimes(1)
       |                                  ^
 Test Files  1 failed (1)
      Tests  1 failed | 17 passed (18)
```

### Fix 2 (Minor) — untested `binary` + `not_installed` warning branch

Added two tests: positive (`a.pdf`, `kind: 'binary'`, `meta.extract_error: 'not_installed'`) asserts the toast store has exactly one toast whose text contains `aiDocErrNotInstalled`'s zh_cn string; negative (`a.bin`, same response body) asserts zero toasts. This branch was already implemented correctly in Task 10 (lines 318-323 above) — the fix here is coverage only, no production-code change was needed. Both tests passed on first run (no RED phase applicable — the code path already existed and worked; there's nothing to TDD against for a passing branch).

### Fix 3 (Minor) — doc-warning test only pinned the CSS class

Strengthened the existing "文档抽取报错时 chip 出警告角标" test to additionally assert `chip.find('.ctx-chip-doc-warn').text()` contains `zh.aiDocErrShortTimedOut` (the resolved zh_cn string for `docErrorShortKey('timeout')`), not just that `.is-doc-warn` exists. This too passed immediately against existing Task 10 code (no production bug — `docErrorShort()`/`docErrorShortKey` were already wired correctly); the value of this fix is that the test can now catch a future code→key mapping regression, which the class-only assertion could not.

### GREEN tail (all three fixes applied)

```
$ pnpm test -- src/ai/components/shell/AgentComposer.test.ts src/i18n/parity.test.ts
 Test Files  2 passed (2)
      Tests  21 passed (21)
```

### Type check + color grep

```
$ pnpm exec vue-tsc --noEmit
(no output — clean, exit 0)

$ grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*white' src/ai/components/shell/AgentComposer.vue
(no matches — exit 1)
```
