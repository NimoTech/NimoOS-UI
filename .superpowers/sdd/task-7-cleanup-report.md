# Task 7 — Precise color-literal cleanup

Scope: only the exact lines listed in the task instructions. No changes to `theme.css`, i18n, or tests. No commits.

## A) Bare modal/card box-shadows → `var(--card-shadow-hi)`

- `src/components/ui/AlertDialog.vue` — `box-shadow: 0 24px 60px rgba(0,0,0,0.5)` → `box-shadow: var(--card-shadow-hi)`
- `src/components/ui/ContextMenu.vue` — `box-shadow: 0 18px 48px rgba(0,0,0,0.5)` → `box-shadow: var(--card-shadow-hi)`
- `src/components/ui/Dialog.vue` — `box-shadow: 0 24px 60px rgba(0,0,0,0.5)` → `box-shadow: var(--card-shadow-hi)`
- `src/files/components/OperationStatusBar.vue` — `box-shadow: 0 18px 48px rgba(0,0,0,0.5)` → `box-shadow: var(--card-shadow-hi)`
- `src/files/components/UploadPanel.vue` — both occurrences (`.upload-panel-toggle` and `.upload-panel`) of `box-shadow: 0 18px 48px rgba(0,0,0,0.5)` → `box-shadow: var(--card-shadow-hi)`
- `src/views/Login.vue` — `box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35)` → `box-shadow: var(--card-shadow-hi)`
- `src/views/Welcome.vue` — `box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35)` → `box-shadow: var(--card-shadow-hi)`

## B) Other bare literals → token

- `src/components/SkeletonWidget.vue` — `.widget { background: rgba(255,255,255,.06); }` → `background: var(--skeleton-bg)`
- `src/files/components/AddMountMenu.vue` — `.add-mount-btn:hover { background: var(--chip-hover, rgba(255,255,255,0.12)); }` → `background: var(--chip-bg-hi)` (removed the non-existent `--chip-hover` token + its rgba fallback)

## C) Theme-exception comments added (literal kept, not tokenized)

- `src/files/viewers/ViewerShell.vue` — added `/* theme-exception: 装饰性 accent bokeh, 与主页背景一致, 皮肤无关 */` on the `background:` line that opens the 4-blob `radial-gradient` decorative bokeh declaration (`.overlay::before`).
- `src/files/viewers/MediaViewer.vue`:
  - line ~428 `background-color: rgba(53, 54, 58, 0.4)` (audio cover blur/dim layer) — added `/* theme-exception: 叠在封面图上的玻璃底, 与主题无关 */` on that line (a differently-worded exception comment already existed one line above; added the exact requested wording on the literal's own line per instructions).
  - line ~465 `background: #ffffff` (progress scrubber thumb) — added `/* theme-exception: 进度条拉链, 恒白 */` on that line (previously the nearby exception comments were on adjacent lines, not this one).
- `src/home/components/SearchDialog.vue` line ~538 `.album-acc.album-acc-ocr { color: #cdd7ff; border-color: rgba(140, 162, 255, 0.6); ... }` — added `/* theme-exception: 叠在缩略图上的徽标, 皮肤无关 */` on that line.

## Verification

Ran `grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(' <file>` on all 12 touched files. Every remaining hit in these files is either:
1. inside a `var(--token, rgba(...))` / `var(--token, #hex)` fallback expression (untouched, per instructions), or
2. on a line already carrying a `theme-exception` comment (some pre-existing and out of this task's scope, e.g. danger-button/error-banner colors in AlertDialog.vue/ContextMenu.vue/Login.vue/Welcome.vue — left as-is since they weren't in the task list), or
3. one of the lines newly commented in section C above.

No bare, uncommented, non-var() color literal remains on any of the specific lines named in the task.
