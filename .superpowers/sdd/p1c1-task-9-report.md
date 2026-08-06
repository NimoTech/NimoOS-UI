# P1c1 Task 9 — AgentComposer skeleton — report

**Mid-task interruption note**: this run was cut off by an API error partway through
(right after editing `zh_cn.ts`, before touching `en_us.ts`). On resume I verified the
coordinator's snapshot against actual disk state: `AgentComposer.vue`/`.test.ts` were
already written in full, `zh_cn.ts` already had the new keys and `aiComingSoon` already
removed, but `en_us.ts` still had `aiComingSoon` and none of the new keys (matching the
coordinator's report). I finished from there: updated `en_us.ts`, re-read the component
file end-to-end to confirm no truncation/placeholders, then ran the full verification
sequence. I had **not** yet observed the tests failing against a real "component does not
exist" state in *this* resumed session — that RED observation happened in the earlier
(interrupted) part of the same task, before the crash: I wrote the test file, ran
`pnpm test -- src/ai/components/shell/AgentComposer.test.ts`, and got a resolve-failure
(`Failed to resolve import "./AgentComposer.vue"`) confirming the component didn't exist
yet, before writing the implementation. That transcript is not re-creatable here, but it
did happen prior to the interruption, not fabricated after the fact.

## What was ported (Vue2 `src/views/AI/Agent/shell/AgentComposer.vue`, 830 lines)

- Template: `.composer-wrap` > `.composer` (`ref="composerEl"`) > `.composer-chips`
  (visible-resource chips only, Vue2 5-17) + `<textarea ref="ta">` (45-54, minus `@blur`,
  see below) + `.composer-row` (56-113: Browse / hidden file input / attach / voice /
  spacer / `ContextUsageBar` / stop|send) + `.composer-caption` (127-129).
- Script: `text` ref, `grow()` (289-294, `min(scrollHeight, 220)`), `updateAnchor()`
  (295-299), `onKeydown` (336-342, with `e.isComposing || keyCode === 229` double guard —
  **kept both checks per the port-discipline instruction**, since dropping the legacy
  `keyCode === 229` check would be a regression on browsers/IMEs that don't set
  `isComposing`), `submit()` (436-454, attachment arrays hardcoded to `[]`), `canSend`
  (245-250, simplified since attachments are always `[]` this task — see deviations),
  `chips` (260-272, using Task 5's `basename`/`dirname`/`getExt` from `composerText.ts`),
  `removeChip` (430-434), `notSupported()` (651-653), and the `window.resize` →
  `updateAnchor` listener with matching `onMounted`/`onBeforeUnmount` teardown (282-287).
- Style: scoped block (662-830) ported minus everything already covered by the global
  `agent-styles.scss:352-406` rules (see below) and minus attachment-chip rules (not
  rendered this task, cleanly separable — left for Task 10 to add alongside the
  attachment chips themselves).

## Deliberately left for the next two tasks (seams)

- **Attachments** (Task 10): `attachments` array, chip rendering (Vue2 18-42),
  `onFilesPicked`/`removeAttachment`/upload progress/doc-error surfacing (Vue2 506-611).
  The hidden `<input type="file" ref="attachFileInput">` element is present with the
  exact Vue2 styling trick (`position:absolute; 1×1px; opacity:0; pointer-events:none`,
  comment ported verbatim explaining why `display:none` doesn't work) and `:accept`
  bound to `ACCEPT_TYPES` (imported from `src/ai/util/attachmentMeta.ts`, already built by
  an earlier task). `@change` (`onFilesPicked`) is intentionally not wired. The attach
  button itself is inert (no click handler) per the brief.
- **@mention + `/init` slash** (Task 11): `MentionPopover`/`SlashMenu` are not mounted.
  `onInput()` only calls `grow()` — the mention-scan logic (Vue2 306-334, already
  available as the pure `scanMention` helper in `composerText.ts`) and the `/` detection
  are left for Task 11 to extend the *same* function body (name kept stable so the
  template binding doesn't need to change). `anchorRect`/`updateAnchor()`/the resize
  listener are wired now (per brief) even though nothing consumes `anchorRect` yet.
- **`activeSessionId` watcher** (Task 10): not added at all — Vue2's version (275-281)
  does two things (close mention popover, clear pending attachments) that both belong to
  the next task; an empty watcher body this task would be dead code, per the brief's
  explicit instruction.
- **BrowserModal** (out of scope this phase, user decision): Browse button kept in place,
  clicking it calls `toast.show(t('aiBrowseComingSoon'))` instead of opening a modal.
  Comment in the code explains the deferral. Consequently `:data-active="browserOpen"`
  (Vue2 line 59) was dropped since there's no `browserOpen` state this task — noted as a
  deliberate template deviation, not an oversight.
- **Attach-button tooltip**: left off entirely (no `title`, no Buefy-equivalent) per brief.

## Logic deviations (bugs fixed / simplifications) — all commented in-file

1. **`onKeydown`'s `if (this.mentionOpen) return` guard dropped.** Mention popover isn't
   wired this task, so the condition is permanently false — keeping it would be dead code.
2. **`canSend` simplified.** Vue2's three-branch check (`hasReady` / `hasText` /
   `!some(uploading)`) reduces algebraically to a plain `text.trim().length > 0` when
   `attachments` is always `[]`. Comment flags that Task 10 must restore the original
   three-branch form once real attachment state exists.
3. **`removeChip`'s error path needed an i18n key not enumerated by the brief.** Vue2's
   `toastError()` (654-657) is reachable from `removeChip`'s catch branch; leaving it
   silent would swallow a real failure. Added `aiComposerRemoveFailed: '移除失败：{msg}'`
   / `'Failed to remove: {msg}'` — flagged in-code as a brief-uncovered but necessary
   addition, not a scope creep on visible behavior (it only fires on API failure).
4. No IME/keydown-related behavior otherwise changed — the double guard
   (`isComposing || keyCode === 229`) is preserved exactly as instructed.

## Scoped styles vs. `agent-styles.scss:352-406`

The global stylesheet already owns: `.composer-wrap` (sticky positioning, gradient
background, the load-bearing `pointer-events: none`/`auto` toggle), `.composer` (max-width,
margin, background/border/radius/shadow, `padding: 12px 12px 10px 16px`, focus-within ring),
`.composer-textarea` (width/background/border/resize/font/line-height/color/min-max-height/
padding), `.composer-row` (flex/gap/margin-top), `.composer-tool` (padding/radius/color/
hover/`[data-active]`), `.send-btn` base (size/radius/background/color:white/hover/
`[disabled]`). My scoped block in `AgentComposer.vue` does **not** restate any of these —
it only adds what's missing: `.attach-file-input` (the seam element's positioning trick),
`.composer-chips`/`.ctx-chip*` (not present globally at all), `.composer-textarea::placeholder`,
`.composer-spacer`, `.send-btn.busy` (a variant the global rule doesn't have), `.composer-caption`,
and `.composer-ctx-usage`. A comment at the top of the `<style>` block states this relationship
explicitly so future editors don't accidentally duplicate the global rules.

## Theme tokens

All colors go through tokens from `src/ai/styles/tokens.scss` (the AI subsystem's own token
file, separate from `src/styles/theme.css`): `--bg-chip`, `--line`, `--r-pill`,
`--text-primary`, `--text-tertiary`, `--font-mono`, `--bg-elevated`, `--text-quaternary`.
No hex/rgba/`white` literals were introduced (the Vue2 hex-fallback tokens and `rgba(...)`
warning-chip color didn't need porting this task since attachment chips — where they lived
— are out of scope; they'll be handled in Task 10 when that CSS is added). Verification:

```
grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*white' src/ai/components/shell/AgentComposer.vue
```
→ no output (clean).

## i18n

Added to **both** `src/i18n/zh_cn.ts` and `src/i18n/en_us.ts`:
- `aiComposerPlaceholder` — looked up Vue2's actual `agent.composerPlaceholder` value in
  `NimoOS-UI/src/assets/lang/{zh_CN,en_US}.json` and reused verbatim: zh `问 Nimo，或输入 @
  引用文件…`, en `Ask Nimo, or type @ to reference a file…` (brief's suggested zh wording
  was just a placeholder guess; used the real Vue2 string instead per the brief's own
  instruction to "look up its actual value").
- `aiComposerVoice` ('语音' / 'Voice')
- `aiComposerCaption` — Vue2 line 128's full sentence, matching the existing
  `zh_CN.json`/`en_US.json` translation of that literal-string key.
- `aiComposerBrowse` ('浏览' / 'Browse'), `aiComposerBrowseTitle` ('浏览 NAS' / 'Browse NAS')
- `aiBrowseComingSoon` ('浏览弹窗将在后续版本开启' / 'The browser dialog is coming in a
  later release')
- `aiNotSupportedYet` ('该功能暂未支持' / 'This feature is not yet supported')
- `aiComposerRemoveFailed` (extra, justified above) ('移除失败：{msg}' / 'Failed to remove: {msg}')

Deleted: `aiComingSoon` from both files. Confirmed zero remaining consumers first:
`grep -rn "aiComingSoon" src/` → no matches outside the locale files themselves.

## Test commands run (tails)

```
$ pnpm test -- src/ai/components/shell/AgentComposer.test.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)

$ pnpm test -- src/i18n/parity.test.ts
 Test Files  1 passed (1)
      Tests  3 passed (3)

$ pnpm exec vue-tsc --noEmit
(no output — clean)

$ grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*white' src/ai/components/shell/AgentComposer.vue
(no output — clean)

$ pnpm test   # full repo suite, sanity check nothing else broke
 Test Files  243 passed (243)
      Tests  1595 passed (1595)
```

## Noticed but left alone

- Vue2's `chipTitle`/`docOkLabel`/`docErrorLabel`/`docErrorShort` (attachment-specific
  tooltip builders) are entirely attachment-pipeline concerns — not touched, Task 10's job.
- `openFilePicker()`'s Vue2 comment about `@mousedown.prevent` timing (opens dialog ~100ms
  earlier, keeps textarea focused) is relevant only once the attach button is wired —
  left for Task 10 to port alongside the real click handler.
- The `attachFileInput` ref is declared but currently has no reader other than being a
  template ref target — inert until Task 10 adds `openFilePicker()`.

## Files touched

- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/components/shell/AgentComposer.vue` (new)
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/components/shell/AgentComposer.test.ts` (new)
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/i18n/zh_cn.ts`
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/i18n/en_us.ts`

Commit: `fd9cf0b` on branch `sp8-ai`.

## Fix pass (review fixes, 2026-07-27)

### Vue2 strings verified (source of truth)

- `/home/nimo/NimoTech/NimoOS-UI/src/assets/lang/zh_CN.json:1275` — `"This feature is not yet supported": "该功能尚未支持"`
- `/home/nimo/NimoTech/NimoOS-UI/src/assets/lang/zh_CN.json:1276` — `"Authorization failed: {msg}": "授权失败：{msg}"`
- `/home/nimo/NimoTech/NimoOS-UI/src/assets/lang/en_US.json:1205` — `"Authorization failed: {msg}": "Authorization failed: {msg}"`
- Confirmed in `/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Agent/shell/AgentComposer.vue:654-657` that `toastError()` is one generic helper shared by `removeChip`, `pickItem`, and `onBrowserPick`, all using the single `$t('Authorization failed: {msg}', { msg })` string — not a "remove"-specific message.

### Changes made

1. **Fix 1** — `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts`: removed `aiComposerRemoveFailed` (`'移除失败：{msg}'` / `'Failed to remove: {msg}'`), added `aiAuthFailed` (`'授权失败：{msg}'` / `'Authorization failed: {msg}'`) in the same AI-keys section. `src/ai/components/shell/AgentComposer.vue`'s `toastError()` now calls `t('aiAuthFailed', { msg })`; doc comment updated to describe the shared-helper semantics (removeChip/pickItem/onBrowserPick) instead of claiming it's remove-only.
2. **Fix 2** — `AgentComposer.vue`: added `nextTick` to the `vue` import, replaced `onSubmitted()` (which called `requestAnimationFrame(grow)`, an undisclosed deviation) with a direct `nextTick(grow)` call at the end of `submit()`, and deleted the `onSubmitted` wrapper (confirmed no other callers via grep before removing). No other part of `submit()` touched.
3. **Fix 3** — `src/i18n/zh_cn.ts`: `aiNotSupportedYet` changed from `'该功能暂未支持'` to `'该功能尚未支持'` to match Vue2 exactly. English value (`'This feature is not yet supported'`) left unchanged — already matched.

### Verification output tails

```
$ pnpm test -- src/ai/components/shell/AgentComposer.test.ts src/i18n/parity.test.ts
 Test Files  2 passed (2)
      Tests  10 passed (10)
   Duration  971ms

$ pnpm exec vue-tsc --noEmit
(no output — 0 errors)
```

### Greps

```
$ grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*white' src/ai/components/shell/AgentComposer.vue
(no output)

$ grep -rn "aiComposerRemoveFailed" src/
(no output)
```
