# SP11 Global Constraints (verbatim from the plan's Global Constraints section)

- **中文注释禁令**:代码注释、日志、测试断言消息**一律英文**(顶层 `CLAUDE.md` 语言规则)。**commit message 也一律英文**。台账/spec/本计划保持中文。
- **颜色一律走 token**:`color-guard.test.ts` 扫所有 `.vue` 的 `<style>` 与 `.css`,裸 `#hex`/`rgb()`/`rgba()`/`hsl()` 即失败。唯一例外是 `src/styles/theme.css`(token 定义处,被守卫显式排除)。新增颜色**只能**落 theme.css 的两个主题块。
- **测试里读 `.css` 一律用 `node:fs`** —— `import.meta.glob(..., {as:'raw'})` 对 `.css` 在 vitest 下恒为空串,曾让守卫整半边空转。`.vue` 的 `?raw` 正常。
- **新增 i18n 键落 `src/i18n/zh_cn.base.ts` + `src/i18n/en_us.base.ts` 两份**,不新建分片 —— `src/i18n/__tests__/shardDisjoint.test.ts` 把「4 片」写死了。`i18n/parity.test.ts` 会强制 en↔zh 键集一致。
- **界面照 Vue2 1:1、逻辑照正确** —— Vue2 的 bug/死代码不照抄,每处在代码里留英文注释登记。
- **本工作树永不 `checkout`/`stash`**,`git commit` **必须带 pathspec** —— 工作树里常驻 3 个 `design-export/*.html` 的 staged 删除,裸 commit 会把它们一起提交。
- **服务端 custom storage key 固定 `wallpaper_v3`**;图片 key 固定 `wallpaper`(后端 `image/:key` 的那个 key)。
- **上传前端上限 10 MB**(`MAX_UPLOAD_BYTES` = 10 * 1024 * 1024)。
- 每个任务收尾跑 `pnpm vitest run <本任务测试文件>`;T11 跑全量门。

## Stated relationships the reviewer should hold in view

- `WallpaperRecord` / `BuiltinId` / `UserImageResult` must keep identical signatures across Tasks 1/3/4/5/6.
- Store action names fixed in Task 4 and referenced verbatim later: `preview` / `beginPreview` / `cancelPreview` / `commit` / `load` / `uploadAndPreview` / `setFromNasPath` / `openDialog` / `closeDialog`.
- The CSS wallpaper block must stay at the END of `src/styles/theme.css`, after the light theme's `body::before, body::after { background: none }` — equal specificity, source order decides.
- `--app-bg` must be the LAST background layer in the `:root[data-wallpaper]` shorthand (it is a bare colour in the light theme, legal only in the final layer), and it doubles as the 404 fallback.

## Controller rulings that override the plan text

- **Task 5**: the plan's Step 2 test asserts `[data-test="wp-upload"]` and `[data-test="wp-nas"]` exist while Step 4's component only has `<slot name="sources" />`. Ruling: Task 5 implements both buttons and drops the slot; Task 6 wires their behaviour and adds the hidden file input + NAS subview.
- **Task 6**: Step 5's prose requires `wp.beginPreview()` after a successful `onNasPick` (to reset the rollback snapshot, since the backend already copied the file); the code block omits it. Ruling: the prose governs — it must be in the implementation.
