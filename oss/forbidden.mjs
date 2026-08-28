import fs from 'node:fs'
import path from 'node:path'

// ─── Hard forbidden words: appearance is failure, no whitelist ────────────────────────────────────────────
// Note E4: spec §6.1 originally placed folderPermission here, which would make the guard permanently red ——
// UserFolderPermission is a type name for member folder permissions, it is a reserved surface. Downgraded to soft forbidden word.
export const HARD = [
  ['相册', /相册/],
  ['Nimo AI', /Nimo\s*AI/i],
  ['ask nimo', /ask\s*nimo/i],
  ['transcript', /transcript/i],
  ['qdrant', /qdrant/i],
  ['ollama', /ollama/i],
  ['embedding', /embedding/i],
  ['CLIP', /\bCLIP\b/],
  ['immich', /immich/i],
  ['photos_data', /photos_data/i],
  ['wikiRoot', /wikiRoot/i],
  ['192.168.1.115', /192\.168\.1\.115/],

  // ── T6.5: Chinese hard forbidden words ──────────────────────────────────────────────────
  // The whole repo's comments and UI copy are in Chinese; the original word list has only
  // one Chinese word "相册" (photo album), which is a major blind spot (see the test table
  // in T6.5 brief: search/photo/transcript/speaker/knowledge-base/vectorization/smart all
  // originally had zero hits). The following four entries are verified by full-repo grep:
  // all occurrences belong to "AI/audio-transcription features that should be removed",
  // no legitimate uses found, so directly mark as HARD (no whitelist).
  ['说话人', /说话人/],       // Speaker separation/diarization in audio transcription, only seen in MediaViewer/theme.css/speakerWave family
  ['知识库', /知识库/],       // RAG knowledge base, only seen in settingsFp(folder-permissions, AI consumer) i18n key
  ['向量化', /向量化/],       // Chinese term for vectorization/embedding, only seen in Ask Nimo audio QA copy
  ['问 Nimo', /问\s*Nimo/i], // Chinese term for "Ask Nimo" (audioAsk/audioAskEmpty), collected separately from "Nimo AI"

  // ── T6.5 Review Important③: English paired words ─────────────────────────────────
  // English counterpart of "knowledge base". Full-repo grep verification (including packages/service and ../NimoOS-Service):
  // all occurrences of knowledge/RAG — settingsFpKnowledge(Desc), en_us.sp9.ts's
  // 'Knowledge base'/'…knowledge base (RAG).'、knowledgeRootItems/knowledgeExcludeItems/
  // knowledgeCell/knowledgeKindOf, FolderPermColumn's 'knowledge' branch, literal 'knowledge-root'/
  // 'knowledge-exclude' — all concentrated in a single AI consumer (folder-permissions four-panel view
  // and its util/test), zero legitimate uses. Uses \b word boundary, won't harm words like "acknowledge"
  // (verified by grep: no such word in the full repo).
  ['knowledge', /\bknowledge\b/i],
  // RAG only appears in settingsFpKnowledgeDesc's English/Chinese values (en_us.sp9.ts:245、zh_cn.sp9.ts:253),
  // likewise zero legitimate uses. Requires all caps + word boundary to avoid harming words like "fragment"
  // that contain the "rag" substring.
  ['RAG', /\bRAG\b/],

  // Note: review also asked whether "smart" (corresponding to Chinese "智能") should be collected.
  // **No, and it should not be.** — Verified with `grep -rn -i smart --include='*.ts' --include='*.vue' src/`:
  // 10 out of 12 repo-wide hits are hard disk S.M.A.R.T. health checks (`src/storage/**`, such as
  // `SMART failed("false") → warning border`, `data.disks[*].health = "true" ← SMART passed`,
  // `0/100 if SMART failed`), completely unrelated to AI; only 2 are true leaks (`en_us.sp9.ts:238`
  // `settingsFpIntro: '...smart feature's...'`, `en_us.ts:236` `widgetAiDesc: 'Chat and smart suggestions'`,
  // these two are already caught through their Chinese counterpart keys — `settingsFpIntro`/`widgetAiDesc`
  // Chinese values hit "智能", T8 will handle them when deleting Chinese keys, no leak). 10/12 are
  // unrelated disk functions; the word list's "wider is better" doesn't mean "so wide it dyes all
  // unrelated feature code red", so we don't collect it. If later someone sees "智能" in the list and
  // "smart" not in the list and wants to add it — read this comment first.
  // ── 2026-08-27: references that do not resolve in the published tree ─────────────
  // The list grew out of "strip the AI / photos / search feature areas", so it only ever
  // collected *feature* vocabulary. A pipeline review added a second class: names of
  // repositories and working documents that a reader of the published tree cannot open.
  // These entries keep such references from going stale unnoticed.
  //
  // Only the repositories that are not themselves published are listed. The published
  // siblings (NimoOS-Common / LocalStorage / KVM / AI / Photos / Gateway / Search / Wiki /
  // MessageBus / UserService / AppManagement / CLI / AppStore) are deliberately absent:
  // pointing a comment at a published repo's file is a normal cross-repo reference and
  // resolves fine. Case-sensitive on purpose — the inlined package is
  // `@nimotech/nimoos-service` (lowercase) and appears throughout package.json /
  // lockfile / imports.
  ['NimoOS-UI', /NimoOS-(New-)?UI/],
  ['NimoOS-Service', /NimoOS-Service/],
  ['NimoOS-Cloud', /NimoOS-Cloud/],
  ['DEV-NimoOS-Photos', /DEV-NimoOS-Photos/],

  // Working-document references: ledger paths, design-note pointers, the memory-slug
  // convention, the fix-wave / ruling shorthand, and the local collaboration guide's
  // filename. None of those files exist in the published tree, so a comment pointing at
  // one is a dead link; the reasoning it refers to belongs in the comment itself.
  ['superpowers', /superpowers/i],
  ['CLAUDE.md', /CLAUDE\.md/i],
  ['memory slug', /\b(per|see) memory [a-z0-9-]{6,}/i],
  ['owner ruling', /owner-(confirmed|rejected|rejection|approved)|owner acceptance/i],
  ['fix wave', /\bfix wave\b/i],
  ['controller ruling', /controller ruling/i],

  // Addresses of specific development machines, same shape as the 192.168.1.115 entry
  // above: a sample value that is only meaningful on one machine tells a reader nothing
  // and ages badly, so fixtures use synthetic values instead.
  // Placeholders such as 192.168.1.1 / .10 / .250 stay legal on purpose: they are
  // input-field placeholders and i18n examples, and banning the whole RFC1918 range would
  // dye ~90 legitimate lines red — the "wider is better" rule stops where it starts
  // dyeing unrelated feature code (same reasoning as the "smart" note above).
  ['192.168.1.143', /192\.168\.1\.143/],
  ['192.168.1.49', /192\.168\.1\.49/],
  ['192.168.1.189', /192\.168\.1\.189/],
].map(([word, re]) => ({ word, re }))

/**
 * T6.5: Convert a "known-legitimate entire line" into an exact-match regex (allows leading/trailing whitespace).
 * Used for allow entries — only matches "this line with ends trimmed equals this text", any
 * addition/deletion within the line breaks the match, falling back to "not exempted, apply word list rules",
 * never lets new leaks slip through together. Lesson from review Critical(2026-08-04): previously used
 * "file + keyword/key-name substring" exemption, equivalent to opening a hole in the entire line or even
 * entire file — mix real AI leak into the exempted line and it still passes (reproduced in the
 * transcript/photo/search word entries' notes). Use new RegExp(string) construction instead of regex literals,
 * incidentally avoids escaping "/" that's already in the line.
 */
function exactLine(literal) {
  const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^\\s*${escaped}\\s*$`)
}

/**
 * T14: pnpm-lock.yaml is auto-generated, not hand-written code — the "exact line match" toolkit doesn't
 * work as intended here (every dependency upgrade invalidates the byte-precise hash/version anchors,
 * forcing someone to manually retype, ineffective at "blocking manual leak insertion"). Instead use a
 * **shape** rule: "this line looks like a pnpm-lock package-name/resolution/version/specifier record":
 *   `resolution:` / `version:` / `specifier:` these three literal keys, or
 *   `'?@?[\w@/.-]+'?:` — optional quotes + optional @scope + package-name charset (alphanumeric@/.-)  +
 *   optional quotes + colon, covers `'@babel/parser@7.29.7':`、`engine.io-parser@2.2.1:`、
 *   `yargs-parser: 13.1.2` variations that actually appear in pnpm-lock.
 * Only for words the list prefers to include: ai/search (third-party package names containing these
 * substrings are impossible to exhaustively enumerate: @codemirror/search, any future package named "ai").
 * parser goes through a narrower path (see parser word entry note below) — photo/gallery/transcript/wiki
 * get zero lockfile exemptions, if they actually appear in dependency names someone should review manually.
 *
 * ★ Known blind spot (T15 record, not defect fix): this "shape" rule only checks if a line looks like
 * a lockfile record, doesn't examine the package name itself — so theoretically, if someone introduced
 * a private package whose entire name happens to contain ai/search semantics (e.g. hypothetical
 * `@nimotech/nimoos-search`), this rule would exempt it like `@codemirror/search`, wouldn't flag for
 * manual review. Current lockfile has no such package (verified by grep), but when future dependencies
 * are added, if a package name itself is a private service name to be removed, don't expect this guard
 * to catch it — need manual review of package names, or add an exclusion rule for that specific package here.
 */
const PNPM_LOCK_LINE = /^\s+(resolution|version|specifier|'?@?[\w@/.-]+'?:)/

// ─── Soft forbidden words + exact whitelist ────────────────────────────────────────────────────
// Each allow entry is "file regex + allowed-in-this-file entire-line regex". Exempt by file+content,
// never by line number — line numbers shift, exemption breaks, then someone loosens the word list.
export const SOFT = [
  {
    word: 'photo',
    re: /photo/i,
    allow: [
      { file: /src\/files\/util\/fileCategories\.ts$/, re: /APPLICATION_PHOTOSHOP/ },
      { file: /src\/files\/util\/icons\.ts$/, re: /folder-pictures|APPLICATION_PHOTOSHOP/ },
      { file: /src\/apps\/util\/importNormalize\.ts$/, re: /'pictures',\s*'photo'/ },
      // 2026-08-14:该文件头注释已在私有侧译成英文,原来那条中文备选不再命中。
      // 整行精确匹配,不给整个文件开洞。
      { file: /src\/apps\/util\/importNormalize\.ts$/, re: exactLine('* **Verbatim** includes casing: apart from config/download/pictures/photo/media, the original only') },
      // T14:importNormalize.test.ts —— 同一份 Vue2 逐字移植的关键字表(volumeAutoCheck)
      // 的测试用例,'photo'/'pictures' 是 Docker 容器路径关键字,不是相册 app。整行精确
      // 匹配(exactLine),不是给整个文件的 'photo' 开洞。
      { file: /src\/apps\/util\/importNormalize\.test\.ts$/, re: exactLine("['/photo', 'myapp', '/DATA/Gallery'],") },
      { file: /src\/apps\/util\/importNormalize\.test\.ts$/, re: exactLine("it('pins Vue2 per-keyword case-sensitivity: config/download/pictures/photo/media are lowercase-literal only', () => {") },
      { file: /src\/apps\/util\/importNormalize\.test\.ts$/, re: exactLine('// \'photo\'/\'pictures\' are lowercase-only in Vue2 — capitalized "Photo" must NOT match, falls to default.') },
      { file: /src\/apps\/util\/importNormalize\.test\.ts$/, re: exactLine("expect(volumeAutoCheck('/Photo', 'myapp')).toBe('/DATA/AppData/myapp/Photo')") },
      // T14:'Photos'(大写 P)在文件区/快照(时间机器)测试里全部是**举例用的普通文件夹名**
      // (与 Documents/Media 同类),不是被删除的相册 app —— 相册 app 的字面量是小写
      // kind:'photo'(已被 T9/T11 的 PATCH 从 defaultLayout/AddPanel/GridItem 等处删净,
      // 见 tree.test.ts 对应断言)。全部整行精确匹配,不是给文件按子串开洞。
      // T16:同一批曾覆盖 useDeckPreview.ts/.test.ts、TimeMachineBar.vue/.test.ts、
      // TimeMachineOverlay.vue/.test.ts 的条目已随这些文件本身被 T16 删除而一并摘除
      // (白名单条目指向不存在的文件不会再命中任何内容,留着只是死权重)。下面两条
      // (useFileOps.test.ts/SnapshotBanner.test.ts)对应的文件仍在,继续保留。
      { file: /src\/files\/composables\/useFileOps\.test\.ts$/, re: exactLine("useFilesStore().currentPath = '/DATA/.snapshots/snap1/Photos'") },
      { file: /src\/files\/composables\/useFileOps\.test\.ts$/, re: exactLine("useFilesStore().currentPath = '/DATA/Photos'") },
      { file: /src\/files\/snapshot\/SnapshotBanner\.test\.ts$/, re: exactLine("const INFO = { mount: '/DATA', snapshotName: '20260713T061900Z_manual_改版前', relPath: 'Photos' }") },
      // ImageViewer.vue:平铺缩放时的白色接缝说明,"the photo"是被查看的图片本身
      // (图片预览器是保留面),与相册 app 无关。
      { file: /src\/files\/viewers\/ImageViewer\.vue$/, re: exactLine('stretches stale tiles without repainting, and tile seams show as white hairline grids over the photo') },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("files.currentPath = '/DATA/Photos'") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("files.currentPath = '/DATA/.snapshots/snap1/Photos'") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("expect(s.browseInfo).toEqual({ mount: '/DATA', snapshotName: 'snap1', relPath: 'Photos' })") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("useFilesStore().currentPath = '/DATA/.snapshots/snap1/Photos'") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("restoreMock.mockResolvedValue({ restored_path: '/DATA/Photos/a.jpg.restored-1' })") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("await s.restore([{ path: '/DATA/.snapshots/snap1/Photos/a.jpg' }])") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("expect(useToast().msg).toContain('/DATA/Photos/a.jpg.restored-1')") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("restoreMock.mockResolvedValue({ restored_path: '/DATA/Photos/a.restored-1' })") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("expect(useToast().msg).toContain('/DATA/Photos/a.restored-1')") },
      // dropEntries.test.ts:'photo.jpg' 是拖拽上传测试里的通用示例文件名(与 video.mp4/
      // notes.txt 同一 fixture),不是相册 app —— 对 Photos 模块的点名注释已被 T14 的
      // manifest PATCH 改掉,这两行是纯粹的示例文件名,保留。
      { file: /src\/files\/upload\/dropEntries\.test\.ts$/, re: exactLine("fileEntry('photo.jpg', '/Folder/photo.jpg'),") },
      { file: /src\/files\/upload\/dropEntries\.test\.ts$/, re: exactLine("expect(rels).toEqual(['Folder/.hidden', 'Folder/notes.txt', 'Folder/photo.jpg', 'Folder/video.mp4'])") },
      { file: /src\/files\/util\/snapshotPath\.test\.ts$/, re: exactLine("expect(parseSnapshotBrowsePath('/DATA/.snapshots/snap1/Photos/2024')).toEqual({") },
      { file: /src\/files\/util\/snapshotPath\.test\.ts$/, re: exactLine("mount: '/DATA', snapshotName: 'snap1', relPath: 'Photos/2024',") },
      { file: /src\/files\/util\/snapshotPath\.test\.ts$/, re: exactLine("it('concat with relative path if present', () => { expect(liveVolumePath('/DATA', 'Photos/2024')).toBe('/DATA/Photos/2024') })") },
      { file: /src\/files\/util\/snapshotPath\.test\.ts$/, re: exactLine("await expect(resolveExitTarget({ mount: '/DATA', snapshotName: 's1', relPath: 'Photos/2024' }, dirExists))") },
      { file: /src\/files\/util\/snapshotPath\.test\.ts$/, re: exactLine(".resolves.toBe('/DATA/Photos/2024')") },
      { file: /src\/files\/util\/snapshotPath\.test\.ts$/, re: exactLine("expect(dirExists).toHaveBeenCalledWith('/DATA/Photos/2024')") },
      { file: /src\/files\/util\/snapshotPath\.test\.ts$/, re: exactLine("expect(parseSnapshotsContainerPath('/DATA/Photos')).toBeNull()") },
      { file: /src\/files\/util\/snapshotPath\.test\.ts$/, re: exactLine("it('get relative path from volume root', () => { expect(relPathUnderMount('/DATA', '/DATA/Photos/2024')).toBe('Photos/2024') })") },
      { file: /src\/files\/util\/snapshotPath\.test\.ts$/, re: exactLine("it('tolerate trailing slash on both sides', () => { expect(relPathUnderMount('/DATA/', '/DATA/Photos/')).toBe('Photos') })") },
      { file: /src\/files\/util\/snapshotRestore\.test\.ts$/, re: exactLine("const restore = vi.fn().mockResolvedValue({ restored_path: '/DATA/Photos/a.jpg.restored-1' })") },
      { file: /src\/files\/util\/snapshotRestore\.test\.ts$/, re: exactLine("item: { path: '/DATA/.snapshots/snap1/Photos/a.jpg' },") },
      { file: /src\/files\/util\/snapshotRestore\.test\.ts$/, re: exactLine("expect(restore).toHaveBeenCalledWith({ volume_uuid: 'u-data', snapshot: 'snap1', path: 'Photos/a.jpg' })") },
      { file: /src\/files\/util\/snapshotRestore\.test\.ts$/, re: exactLine("expect(r).toEqual({ ok: true, restoredPath: '/DATA/Photos/a.jpg.restored-1' })") },
      { file: /src\/files\/util\/snapshotRestore\.test\.ts$/, re: exactLine("item: { path: '/DATA/Photos/a.jpg' }, info: INFO, listVolumes: async () => VOLS, restore: async () => ({}),") },
      // en_us.base.ts / raidLevels.ts:raidLevel1Usecase 的英文原文,zh_cn.base.ts 的中文孪生值
      // (2026-08-05 SP7-P8b:两个 locale 主文件已改名 *.base.ts —— 内容原地未动,只是
      //  多了 3 行合并出口 zh_cn.ts/en_us.ts。下面所有 locale 例外的 file 正则跟着改名,
      //  **词表一个字没放宽**,匹配的还是同样那几行。)
      // (照片库、个人 NAS、启动卷)已经是既有白名单 —— 这是同一条 RAID 用途说明的英文侧,
      // 与相册 app 无关(brief 指定保留面)。
      { file: /src\/i18n\/en_us\.base\.ts$/, re: exactLine("raidLevel1Usecase: 'Photo library, personal NAS, boot volumes',") },
      { file: /src\/storage\/util\/raidLevels\.ts$/, re: exactLine("usecase: 'Photo library, personal NAS, boot volumes',") },
      // avatar.test.ts:'photo.WEBP' 是头像上传扩展名判断的通用示例文件名。
      { file: /src\/settings\/util\/avatar\.test\.ts$/, re: exactLine("expect(isAllowedImageFile('photo.WEBP', 'application/octet-stream')).toBe(true)") },
      // Files.test.ts:同 snapshot 系列,'Photos' 全部是举例用的普通文件夹名。
      { file: /src\/views\/Files\.test\.ts$/, re: exactLine("router.push('/files/NimoOS-HD/Photos'); await router.isReady()") },
      { file: /src\/views\/Files\.test\.ts$/, re: exactLine("router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Photos'); await router.isReady()") },
      { file: /src\/views\/Files\.test\.ts$/, re: exactLine("const w = await mountFiles('/DATA/Photos')") },
      // T16: restore-folder confirmation flow this line added (Files Time Machine
      // Vue2-parity), same example-folder-name convention as the entries above.
      { file: /src\/views\/Files\.test\.ts$/, re: exactLine("expect(document.body.textContent).toContain('Photos') // the folder being confirmed, by name") },
      { file: /src\/views\/Files\.test\.ts$/, re: exactLine("expect(items).toEqual([{ path: '/DATA/.snapshots/20260713T061900Z_manual/Photos', name: 'Photos', is_dir: true }])") },
      // 2026-08-07:SP11 壁纸功能新增文件里的 'photo' 全部是普通英文单词或 themePhoto
      // 这个 i18n 键名本身(键名字面含 "Photo" 子串,与相册 app 无关),不是 AI/相册
      // 语义。已用 oss/export.mjs 实测确认这批命中,逐条登记,不给整个文件开洞。
      { file: /src\/i18n\/en_us\.base\.ts$/, re: exactLine("themePhoto: 'Photo…',") },
      { file: /src\/i18n\/zh_cn\.base\.ts$/, re: exactLine("themePhoto: '照片…',") },
      { file: /src\/main\.ts$/, re: exactLine('// and the photo snaps in a frame later.') },
      { file: /src\/styles\/theme\.css$/, re: exactLine('existing sheen + vignette shape so white text stays readable on any photo. */') },
      { file: /src\/styles\/wallpaper\.css\.test\.ts$/, re: exactLine("it('kills the bokeh layer, which would smear coloured fog over a photo', () => {") },
      { file: /src\/styles\/wallpaper\.css\.test\.ts$/, re: exactLine('// text loses its white veil over a dark photo -- invisible to tsc, build,') },
      // 2026-08-07 Task 8: ThemeToggle's topbar menu grew a third "Photo…" entry
      // (data-test="tt-photo", the `active === 'photo'` branch, `pickPhoto()`,
      // and the `.sw-photo` preview swatch). All are wallpaper-picker UI wired
      // to the pre-existing wallpaper store, not the album app — same
      // justification as the SP11 block above, entered per-line as precedent.
      { file: /src\/home\/components\/ThemeToggle\.vue$/, re: exactLine('<button class="theme-opt" role="menuitemradio" data-test="tt-photo"') },
      { file: /src\/home\/components\/ThemeToggle\.vue$/, re: exactLine(":class=\"{ on: active === 'photo' }\" :aria-checked=\"active === 'photo'\" @click=\"pickPhoto()\">") },
      { file: /src\/home\/components\/ThemeToggle\.vue$/, re: exactLine('<span class="sw sw-photo" />') },
      { file: /src\/home\/components\/ThemeToggle\.vue$/, re: exactLine("<span class=\"lbl\">{{ t('themePhoto') }}</span>") },
      { file: /src\/home\/components\/ThemeToggle\.vue$/, re: exactLine('<span v-if="active === \'photo\'" class="ck">✓</span>') },
      { file: /src\/home\/components\/ThemeToggle\.vue$/, re: exactLine("const active = computed<'blue' | 'light' | 'photo'>(() =>") },
      { file: /src\/home\/components\/ThemeToggle\.vue$/, re: exactLine("wp.record.kind !== 'none' ? 'photo' : theme.theme === 'light' ? 'light' : 'blue',") },
      { file: /src\/home\/components\/ThemeToggle\.vue$/, re: exactLine('function pickPhoto() {') },
      { file: /src\/home\/components\/ThemeToggle\.vue$/, re: exactLine('/* theme-exception: preview swatch shows what the photo option looks like, not') },
      { file: /src\/home\/components\/ThemeToggle\.vue$/, re: exactLine('.sw-photo { background: linear-gradient(135deg, #7a8ea8, #3c4a5e); }') },
      { file: /src\/home\/components\/ThemeToggle\.test\.ts$/, re: exactLine('expect(w.find(\'[data-test="tt-photo"]\').exists()).toBe(true)') },
      { file: /src\/home\/components\/ThemeToggle\.test\.ts$/, re: exactLine('expect(w.find(\'[data-test="tt-photo"]\').attributes(\'aria-checked\')).toBe(\'false\')') },
      { file: /src\/home\/components\/ThemeToggle\.test\.ts$/, re: exactLine("it('checks Photo whenever any image is set, regardless of theme', async () => {") },
      { file: /src\/home\/components\/ThemeToggle\.test\.ts$/, re: exactLine('expect(w.find(\'[data-test="tt-photo"]\').attributes(\'aria-checked\')).toBe(\'true\')') },
      { file: /src\/home\/components\/ThemeToggle\.test\.ts$/, re: exactLine("it('Photo opens the picker rather than applying anything itself', async () => {") },
      { file: /src\/home\/components\/ThemeToggle\.test\.ts$/, re: exactLine('await w.find(\'[data-test="tt-photo"]\').trigger(\'click\')') },
      // Task 10: files-area "Set as wallpaper" extension gate. 'photos.jpg' is
      // a plain negative-case filename (a directory named like an image), not
      // the photos app.
      { file: /src\/files\/util\/wallpaperExt\.test\.ts$/, re: exactLine("expect(canBeWallpaper({ name: 'photos.jpg', is_dir: true })).toBe(false)") },
      // SP11 final review fix wave (2026-08-08): comments added while fixing
      // C1/I1 findings use "photo" as a plain English word (the wallpaper
      // picker previews a "photo", and this is the multipart caller comment
      // shared with ai.ts/photos.ts/sys.ts) -- not the deleted photos app.
      // Already verified with oss/export.mjs; entered per-line, not per-file.
      { file: /packages\/service\/src\/users\.ts$/, re: exactLine('// matches every other multipart caller in this package (ai.ts, photos.ts, sys.ts).') },
      { file: /src\/App\.test\.ts$/, re: exactLine("// Sanity: the previous user's photo is actually painted before we log out --") },
      { file: /src\/stores\/wallpaper\.test\.ts$/, re: exactLine('// Repro: topbar photo entry opens the sheet (snapshots w01), user browses to') },
      { file: /src\/stores\/wallpaper\.ts$/, re: exactLine("/** I1 (final review): logout must not leave the previous user's photo painted") },
      // Acceptance fix 1 (2026-08-08): comments explaining why body::after needs a
      // negative z-index in wallpaper mode -- "photo" here means the wallpaper
      // image the scrim sits on top of, not the deleted photos app. Same
      // reasoning duplicated in the CSS and its guard test, entered per-line.
      { file: /src\/styles\/theme\.css$/, re: exactLine('   ENTIRE app (cards, buttons, text), not just the wallpaper photo beneath it. That') },
      { file: /src\/styles\/theme\.css$/, re: exactLine('   the app content -- which is where a scrim belongs: modulating the photo, not') },
      { file: /src\/styles\/wallpaper\.css\.test\.ts$/, re: exactLine('// text) instead of just the wallpaper photo underneath it. jsdom cannot compute') },
      // Acceptance fix 2 (2026-08-08): the comment recording why the owner took the
      // paper theme's veil from 55% down to 15%. Same sense of "photo" as above.
      { file: /src\/styles\/theme\.css$/, re: exactLine("/* SP11: the paper theme's text is near-black (#1c1b19), so a dark photo needs") },
      { file: /src\/styles\/theme\.css$/, re: exactLine('     15% on 2026-08-08, down from the 55% this shipped with: at 55% the photo was') },
      { file: /src\/styles\/theme\.css$/, re: exactLine('     the photo and almost all of its text. Anything the veil alone has to carry') },
      // 2026-08-15: the English-ification sweep turned this shadow comment's "照片/视频"
      // into "photos/videos". Same sense as the entries above -- the media the overlay
      // sits on top of (image/video preview is a kept surface), not the photos app.
      { file: /src\/styles\/theme\.css$/, re: exactLine("/* Shadow for overlays sitting above media (photos/videos): content color can't be") },
      // 2026-08-20 (home-widgets/time-machine line, PR #16/#18 -- oss manifest fix wave 2,
      // same shape as the ai.ts wiring line's fix wave 1): the deck-preview/time-machine
      // feature is a real kept surface (Files area snapshot browsing), and 'Photos' in every
      // line below is either an example folder name in a fixture/comment (same pattern as the
      // snapshotPath.test.ts/snapshotRestore.test.ts/Files.test.ts entries above) or a
      // filename reference to the deleted photos app's PhotoImageViewer.vue cited only as
      // prior art for a CSS drag-suppression trick -- not a mention of the photos app's own
      // functionality. All verified with oss/export.mjs; entered per-line, not per-file.
      // T16: the useDeckPreview.ts/.test.ts and TimeMachineCard.test.ts/TimeMachineCrumbs.vue/
      // TimeMachineOverlay.test.ts entries that used to sit here were removed alongside those
      // files (colleague card-deck mockup, superseded by the Vue2-parity stage). apiError.ts
      // below is a permanent module and keeps its own entry.
      { file: /src\/files\/util\/apiError\.ts$/, re: exactLine('//   GET /v1/file?path=/DATA/.snapshots/<absent>/Photos') },
      // PhotoImageViewer.vue:221 is cited as prior art for a three-part native-drag
      // suppression fix (draggable="false" + -webkit-user-drag:none + user-select:none) --
      // the same reasoning is reused for the dock icons here, not a mention of the photos
      // app's own behaviour. src/photos/** (including PhotoImageViewer.vue itself) is
      // wholly removed by the DELETE table; this is a filename reference to prior art only.
      { file: /src\/home\/components\/DockApp\.vue$/, re: exactLine('   Same three-part remedy as PhotoImageViewer.vue:221 and ImageViewer.vue. */') },
      { file: /src\/home\/components\/HomeDock\.test\.ts$/, re: exactLine('// PhotoImageViewer.vue:221 records that draggable="false" alone is not enough,') },
      { file: /src\/home\/components\/style-guard\.test\.ts$/, re: exactLine('// once a text selection exists, which PhotoImageViewer.vue:221 records after') },
      // ClockWidget.test.ts: 'photos' here is just one example domain name in a list
      // describing the shared service package's getter shape (users/photos/... all throw
      // unless initService() ran) -- not a mention of the photos app or its API.
      { file: /src\/home\/components\/widgets\/ClockWidget\.test\.ts$/, re: exactLine("// Note: `service`'s other domains (users, photos, ...) are getters that call the") },
      // dockMath.test.ts: pure unit test over (key, midX) tuples -- 'photos' here is an
      // arbitrary fixture key, same role as 'files'/'settings'/'kvm' on the same lines, not
      // tied to the real app registry (systemApps.ts, where the app itself is deleted).
      { file: /src\/home\/grid\/dockMath\.test\.ts$/, re: exactLine("const fav = [{ key: 'files', midX: 100 }, { key: 'photos', midX: 200 }]") },
      { file: /src\/home\/grid\/dockMath\.test\.ts$/, re: exactLine("expect(dropTarget(180, 300, fav, more).beforeKey).toBe('photos')") },
      // T16 (Files Time Machine Vue2-parity line, batch after the colleague card-deck
      // components' removal): the Vue2-parity replacement stage's own new files. Same
      // pattern as the earlier snapshot entries above -- 'Photos' is always an example
      // folder name in a fixture/comment for the kept Time Machine surface, never the
      // deleted photos app. All verified with oss/export.mjs; entered per-line, not per-file.
      { file: /src\/files\/snapshot\/RestoreDestinationModal\.test\.ts$/, re: exactLine("const second = vmOf(w).open('/media/RAID_0', '/media/RAID_0/Photos')") },
      { file: /src\/files\/snapshot\/RestoreDestinationModal\.test\.ts$/, re: exactLine("expect(document.querySelector('.rdm-current-dir')?.textContent).toBe('/media/RAID_0/Photos')") },
      { file: /src\/files\/snapshot\/SnapshotPreviewWindow\.test\.ts$/, re: exactLine("{ name: 'Photos', isDir: true, size: 0, mtime: 1720000000000 },") },
      { file: /src\/files\/snapshot\/SnapshotPreviewWindow\.test\.ts$/, re: exactLine("expect(cards[0].find('.tm-preview-window__title').text()).toBe('Photos')") },
      { file: /src\/files\/snapshot\/SnapshotPreviewWindow\.test\.ts$/, re: exactLine("expect(rows[0].find('.tm-preview-window__col--name').text()).toBe('Photos') // folders-first") },
      { file: /src\/files\/snapshot\/SnapshotPreviewWindow\.test\.ts$/, re: exactLine("const photosRow = rows.find((r) => r.text().includes('Photos'))!") },
      { file: /src\/files\/snapshot\/SnapshotPreviewWindow\.test\.ts$/, re: exactLine("expect(photosRow.find('.tm-preview-window__col--type').text()).toBe('')") },
      { file: /src\/files\/snapshot\/SnapshotPreviewWindow\.test\.ts$/, re: exactLine("expect(photosRow.find('.tm-preview-window__col--size').text()).toBe('')") },
      { file: /src\/files\/snapshot\/SnapshotPreviewWindow\.test\.ts$/, re: exactLine("expect(photosRow.classes()).toContain('is-dir')") },
      { file: /src\/files\/snapshot\/SnapshotPreviewWindow\.test\.ts$/, re: exactLine("{ name: 'Photos', isDir: true, size: 0, mtime: 0 },") },
      { file: /src\/files\/snapshot\/SnapshotPreviewWindow\.test\.ts$/, re: exactLine("const folderIcon = cards[0].find('.tm-preview-window__icon') // Photos, folders-first") },
      { file: /src\/files\/snapshot\/SnapshotPreviewWindow\.test\.ts$/, re: exactLine("expect(folderIcon.attributes('src')).toBe(iconUrl(iconNameFor({ name: 'Photos', is_dir: true })))") },
      { file: /src\/files\/snapshot\/TimeMachineDepthStack\.test\.ts$/, re: exactLine("files.currentPath = '/media/RAID_0/Photos' // not a snapshot view at all -- currentSnapshotName is null") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("files.currentPath = '/DATA/Photos/2024'") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("expect.stringContaining('.snapshots/20260812T090000Z_manual_x/Photos/2024'),") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("files.currentPath = '/mnt/usb/.snapshots/snap1/Photos'") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("expect(getListMock).toHaveBeenCalledWith('/DATA/Photos')") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("expect(router.push).toHaveBeenCalledWith(expect.stringContaining('Photos'))") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("expect(router.push).not.toHaveBeenCalledWith(expect.stringContaining('Photos'))") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("files.currentPath = '/DATA/.snapshots/snap1/Photos/2024'") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("expect.stringContaining('.snapshots/snap2/Photos/2024'),") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("const picker = vi.fn(async () => ({ destDir: '/DATA/Photos', withMarker: true }))") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("await s.restoreItems([item('/DATA/.snapshots/snap1/Photos/a.jpg')], '/DATA/Photos', picker)") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("await s.restoreItems([item('/DATA/.snapshots/snap1/Photos/a.jpg')], '/DATA/Photos', picker, { singleItemFlow: true })") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("expect(useToast().msg).toBe('已恢复到 /DATA/Photos/a.jpg.restored-1')") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("expect(useToast().msg).toBe('已取回 1 项到 /DATA/Photos/a.jpg.restored-1')") },
      { file: /src\/files\/stores\/snapshotBrowse\.ts$/, re: exactLine('// Machine at /Photos/2024 should not be dumped back at the volume root). tmActive flips true') },
      { file: /src\/files\/util\/restoreDestination\.test\.ts$/, re: exactLine("content: [{ name: 'Photos', path: `${destDir}/Photos`, is_dir: true }],") },
      { file: /src\/files\/util\/restoreDestination\.test\.ts$/, re: exactLine("const items = [{ name: 'Photos', is_dir: true }]") },
      { file: /src\/files\/util\/restoreDestination\.test\.ts$/, re: exactLine("expect(conflicts).toEqual([{ name: 'Photos', isDir: true, groupKey: 'Photos' }])") },
      { file: /src\/files\/util\/snapshotPreviewCache\.test\.ts$/, re: exactLine("await getSnapshotPreview('/DATA', 'snap1', 'Photos')") },
      { file: /src\/files\/util\/snapshotPreviewCache\.test\.ts$/, re: exactLine("expect(getListMock).toHaveBeenCalledWith('/DATA/.snapshots/snap1/Photos')") },
      { file: /src\/files\/util\/snapshotPreviewCache\.test\.ts$/, re: exactLine("const result = await getSnapshotPreview('/DATA', 'snap1', 'Photos')") },
      { file: /src\/files\/util\/snapshotPreviewCache\.test\.ts$/, re: exactLine("const p1 = getSnapshotPreview('/DATA', 'snap1', 'Photos')") },
      { file: /src\/files\/util\/snapshotPreviewCache\.test\.ts$/, re: exactLine("const p2 = getSnapshotPreview('/DATA', 'snap1', 'Photos')") },
      { file: /src\/files\/util\/snapshotPreviewCache\.test\.ts$/, re: exactLine("getSnapshotPreview('/DATA', 'snap1', 'Photos'),") },
      { file: /src\/files\/util\/snapshotPreviewCache\.test\.ts$/, re: exactLine("getSnapshotPreview('/DATA', 'snap2', 'Photos'),") },
      { file: /src\/files\/util\/snapshotPreviewCache\.test\.ts$/, re: exactLine("getSnapshotPreview('/DATA2', 'snap1', 'Photos'),") },
      { file: /src\/files\/util\/snapshotPreviewCache\.test\.ts$/, re: exactLine("const r1 = await getSnapshotPreview('/DATA', 'snap1', 'Photos')") },
      { file: /src\/files\/util\/snapshotPreviewCache\.test\.ts$/, re: exactLine("const r2 = await getSnapshotPreview('/DATA', 'snap1', 'Photos')") },
      { file: /src\/files\/util\/snapshotRestore\.test\.ts$/, re: exactLine("const restore = vi.fn().mockResolvedValue({ restored_path: '/DATA/Photos/a.jpg' })") },
      { file: /src\/files\/util\/snapshotRestore\.test\.ts$/, re: exactLine("item: { path: '/DATA/.snapshots/snap1/Photos/a.jpg' }, info: INFO,") },
      { file: /src\/files\/util\/snapshotRestore\.test\.ts$/, re: exactLine("volume_uuid: 'u-data', snapshot: 'snap1', path: 'Photos/a.jpg',") },
      { file: /src\/files\/util\/snapshotRestore\.test\.ts$/, re: exactLine("expect(shouldRejectRootRestore('Photos')).toBe(false)") },
      { file: /src\/files\/util\/snapshotRestore\.test\.ts$/, re: exactLine("expect(shouldRejectRootRestore('Photos/2024')).toBe(false)") },
      { file: /src\/files\/util\/snapshotRestore\.test\.ts$/, re: exactLine("expect(wholeFolderRestoreItem('/DATA/.snapshots/snap1/Photos/2024', 'Photos/2024')).toEqual({") },
      { file: /src\/files\/util\/snapshotRestore\.test\.ts$/, re: exactLine("path: '/DATA/.snapshots/snap1/Photos/2024', name: '2024', is_dir: true,") },
      { file: /src\/files\/util\/snapshotRestore\.test\.ts$/, re: exactLine("expect(wholeFolderRestoreItem('/DATA/.snapshots/snap1/Photos', 'Photos')).toEqual({") },
      { file: /src\/files\/util\/snapshotRestore\.test\.ts$/, re: exactLine("path: '/DATA/.snapshots/snap1/Photos', name: 'Photos', is_dir: true,") },
      { file: /src\/styles\/__tests__\/tmTokens\.test\.ts$/, re: exactLine("// header comments that themselves mention OTHER selectors' braces (e.g. \".photos-root { }\"),") },
    ],
  },
  {
    word: 'gallery',
    re: /gallery/i,
    allow: [
      { file: /src\/files\/util\/protect\.ts$/, re: /\/DATA\/Gallery|'Gallery'/ },
      { file: /src\/files\/util\/icons\.ts$/, re: /Gallery/ },
      { file: /src\/settings\/util\/migrateBrowse\.ts$/, re: /Gallery/ },
      { file: /src\/settings\/panels\/AppsPanel\.vue$/, re: /Gallery/ },
      { file: /src\/home\/grid\/defaultLayout\.ts$/, re: /\/DATA\/Gallery/ },
      // 2026-08-15: the frozen copy oss/files/defaultLayout.ts had its ASCII grid map
      // translated, so the folder tile drawn as "[图库]" is now "[Gallery]". Same
      // system default folder as the entry above, drawn instead of written as a path.
      { file: /src\/home\/grid\/defaultLayout\.ts$/, re: exactLine('// r6  [                  ][Docs][Downloads][Media][Gallery][      ][    ][    ]') },
      { file: /src\/i18n\/(zh_cn|en_us)\.ts$/, re: /Gallery/ },
      // E6:Vue2 逐字移植的路径归一(应用导入时的目录归一化),/DATA/Gallery 是
      // LocalStorage 开机自建的系统目录,与相册功能无关,是保留面。
      { file: /src\/apps\/util\/importNormalize\.ts$/, re: /\/DATA\/Gallery/ },
      // T14:以下全部是上面这些"Gallery=系统默认文件夹"实现文件各自的**测试镜像**,
      // 练的是同一条已经被判定为保留面的代码路径,不是相册 app。整行精确匹配。
      { file: /src\/apps\/util\/importNormalize\.test\.ts$/, re: exactLine("['/pictures', 'myapp', '/DATA/Gallery'],") },
      { file: /src\/apps\/util\/importNormalize\.test\.ts$/, re: exactLine("['/photo', 'myapp', '/DATA/Gallery'],") },
      { file: /packages\/service\/src\/samba\.test\.ts$/, re: exactLine("{ id: 1, path: '/DATA/Documents' }, { id: 2, path: '/DATA/Gallery' },") },
      { file: /packages\/service\/src\/samba\.test\.ts$/, re: exactLine("expect(res).toEqual([{ id: 1, path: '/DATA/Documents' }, { id: 2, path: '/DATA/Gallery' }])") },
      { file: /src\/files\/util\/clipboard\.test\.ts$/, re: exactLine("await copyText('/NimoOS-HD/Gallery/x.jpg')") },
      { file: /src\/files\/util\/clipboard\.test\.ts$/, re: exactLine("expect(copied).toBe('/NimoOS-HD/Gallery/x.jpg')") },
      { file: /src\/files\/util\/icons\.test\.ts$/, re: exactLine("expect(iconNameFor({ name: 'Gallery', is_dir: true })).toBe('folder-pictures')") },
      { file: /src\/files\/util\/protect\.test\.ts$/, re: exactLine("expect(PROTECTED).toEqual(['AppData', 'Documents', 'Downloads', 'Gallery', 'Media'])") },
      { file: /src\/home\/components\/FolderTile\.test\.ts$/, re: exactLine("const w = mount(FolderTile, { props: mk('Gallery', '/DATA/Gallery') })") },
      { file: /src\/home\/components\/FolderTile\.test\.ts$/, re: exactLine("expect(w.text()).toContain('Gallery')") },
      { file: /src\/home\/components\/GridItem\.click\.test\.ts$/, re: exactLine("const item: LayoutItem = { id: 'i', kind: 'folder', key: 'Gallery', path: '/DATA/Gallery', c: 1, r: 1, w: 1, h: 1 }") },
      { file: /src\/home\/components\/GridItem\.click\.test\.ts$/, re: exactLine("expect(router.push).toHaveBeenCalledWith({ path: '/files', query: { path: '/DATA/Gallery' } })") },
      { file: /src\/home\/composables\/useOpenAction\.test\.ts$/, re: exactLine("openItem({ id: 'i', kind: 'folder', key: 'Gallery', path: '/DATA/Gallery', c: 1, r: 1, w: 1, h: 1 } as LayoutItem)") },
      { file: /src\/home\/composables\/useOpenAction\.test\.ts$/, re: exactLine("expect(router.push).toHaveBeenCalledWith({ path: '/files', query: { path: '/DATA/Gallery' } })") },
      { file: /src\/settings\/panels\/AppsPanel\.test\.ts$/, re: exactLine("expect(w.findAll('.set-app-row')[2].text()).toContain('/Documents & Downloads & Gallery & Media')") },
      { file: /src\/settings\/util\/migrateBrowse\.test\.ts$/, re: exactLine("'/media/Backup/Gallery', '/media/Backup/Media',") },
      { file: /src\/settings\/util\/migrateBrowse\.test\.ts$/, re: exactLine("it.each(['AppData', 'Documents', 'Downloads', 'Gallery', 'Media', '.docker', '.containerd'])(") },
      // 2026-08-07:SP11 壁纸功能——用户头像/壁纸上传接口(setImageFromPath)与
      // wallpaper store 的测试用例里,'/DATA/Gallery/a.png' 是普通的 NAS 图片示例路径
      // (与既有的 protect.ts/defaultLayout.ts 那批 Gallery=系统默认文件夹是同一保留面),
      // 不是相册 app。已用 oss/export.mjs 实测确认这批命中,逐条登记。
      { file: /packages\/service\/src\/users\.test\.ts$/, re: exactLine("await users.setImageFromPath('wallpaper', '/DATA/Gallery/a.png')") },
      { file: /packages\/service\/src\/users\.test\.ts$/, re: exactLine("expect(calls[0].body).toEqual({ path: '/DATA/Gallery/a.png' })") },
      { file: /src\/stores\/wallpaper\.test\.ts$/, re: exactLine("await s.setFromNasPath('/DATA/Gallery/a.png')") },
      { file: /src\/stores\/wallpaper\.test\.ts$/, re: exactLine("expect(setImageFromPath).toHaveBeenCalledWith('wallpaper', '/DATA/Gallery/a.png')") },
      // SP11 final review round 2 (2026-08-08): same reserved-path sample as
      // the two entries above, this time with a trailing inline comment that
      // makes the full line text differ from the already-whitelisted one.
      { file: /src\/stores\/wallpaper\.test\.ts$/, re: exactLine("await s.setFromNasPath('/DATA/Gallery/a.png') // user changes their mind mid-session") },
      // Task 6: same reserved-path sample, this time in WallpaperDialog's "choose
      // from NAS" test -- the pick payload's NAS path, not the photos app.
      { file: /src\/components\/WallpaperDialog\.test\.ts$/, re: exactLine(".vm.$emit('pick', { path: '/DATA/Gallery/a.png', src: '/v1/image?path=/DATA/Gallery/a.png' })") },
      // Task 10: files-area context menu's "Set as wallpaper" tests. Same
      // reserved-path sample as the wallpaper store/dialog entries above --
      // '/DATA/Gallery/a.jpg' is a generic NAS image fixture and 'Gallery' the
      // folder name in a plain non-image negative case, not the photos app.
      { file: /src\/files\/components\/FileContextMenu\.test\.ts$/, re: exactLine("const img = { name: 'a.jpg', path: '/DATA/Gallery/a.jpg', is_dir: false } as FileEntry") },
      { file: /src\/files\/components\/FileContextMenu\.test\.ts$/, re: exactLine("const w = mountMenu({ entry: { name: 'Gallery', path: '/DATA/Gallery', is_dir: true }, selectedCount: 1 })") },
    ],
  },
  {
    word: 'search',
    re: /search/i,
    allow: [
      // 2026-08-07:Google Drive 自建凭据指引页随本仓发布(Vue2 下线后站点根不再有 guide/)。
      // 这里的 "search for" 是让用户在 Google Cloud 控制台里搜索 API 的普通英文动词,与
      // NimoOS-Search 服务无关。整行精确匹配,不给整个文件开洞。
      { file: /public\/guide\/google-drive\.html$/, re: exactLine('<p>In the left menu <span class="path">APIs &amp; Services → Library</span>, search for <b>Google Drive API</b>, open it → <b>Enable</b>.</p>') },
      { file: /src\/apps\/stores\/installedApps\.ts$/, re: /filterStoreApps|searchInput/ },
      // 2026-08-05(SP7-P8b):两个 locale 主文件改名 *.base.ts,路径跟着改。
      { file: /src\/i18n\/(zh_cn|en_us)\.base\.ts$/, re: /appsStoreSearch/ },
      // composeSettings.ts:'DAC_READ_SEARCH' 是 Linux capability 常量名(compose
      // cap_add/cap_drop 白名单的一项),与搜索功能无关。
      { file: /src\/apps\/util\/composeSettings\.ts$/, re: exactLine("'DAC_READ_SEARCH',") },
      // widget-kit.css:第三方桌面小组件开发指南里的示例 JS 代码片段(读 iframe 的
      // location.search 取 theme/lang 参数),是给第三方开发者看的用法说明,与
      // NimoOS-Search 服务无关。
      { file: /public\/widget-kit\.css$/, re: exactLine('*     const q = new URLSearchParams(location.search)') },
      // T14 复审:原来这里按"文件+子串"(query.search|searchInput|...)豁免 StorePage.vue
      // 整个文件——等于对文件里任何一行含这些子串的内容开洞,包括在这些行后面追加真实
      // AI/Search 泄漏也照样放行(同 T6.5 复审 Critical 抓到的 搜索/照片 那个洞是一类
      // 问题)。收紧为整行精确匹配:StorePage.vue 是应用商店的分类/作者/关键字过滤器
      // (spec §3.1 三个深链参数之一),与被删除的 NimoOS-Search 服务/SearchDialog.vue
      // 无关,9 处全部逐字摘自源码。
      // 2026-08-14:StorePage.vue 的四条中文注释已在私有侧译成英文,原中文整行不再命中。
      // 说明的仍是应用商店自己的关键字过滤器(保留面),与被剥离的 NimoOS-Search 无关。
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('// Three deep-link params (spec §3.1): ?category= / ?author= / ?search=; single source of truth = route query') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('// Search input: write query after 250ms debounce (same as Vue2); external query changes (back navigation) flow back into the input') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('// Category/author are backend parameters: refetch on query change; search is frontend-only, no refetch') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('// The featured strip only shows in the unfiltered, unsearched first-screen context -- when filtering/searching, the list is the answer the user wants and the strip is noise') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine("const search = computed(() => (typeof route.query.search === 'string' && route.query.search) || '')") },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('const searchInput = ref(search.value)') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('watch(searchInput, (v) => {') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine("if ((v || '') === search.value) return") },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('router.replace({ query: { ...route.query, search: v || undefined } })') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine("watch(search, (v) => { if (v !== searchInput.value) searchInput.value = v })") },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('const shown = computed(() => filterStoreApps(items.value, search.value))') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('const showFeatured = computed(() => category.value === ALL && author.value === ALL && !search.value)') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('<label class="store-search">') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('<input v-model="searchInput" type="search" :placeholder="t(\'appsStoreSearch\')" />') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('.store-search { flex: 1 1 200px; }') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('.store-search input {') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('.store-search input:focus { border-color: var(--accent-soft-bd); }') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('.store-search input::placeholder { color: var(--fg-muted); }') },
      // StorePage.test.ts:同一功能的测试镜像(6 处命中,4 条不重复的行文本——两行各自
      // 重复出现两次,exactLine 天然覆盖两处)。
      { file: /src\/apps\/views\/StorePage\.test\.ts$/, re: exactLine("await w.get('.store-search input').setValue('jelly')") },
      { file: /src\/apps\/views\/StorePage\.test\.ts$/, re: exactLine("expect(replace).toHaveBeenCalledWith({ query: { search: 'jelly' } })") },
      { file: /src\/apps\/views\/StorePage\.test\.ts$/, re: exactLine("it('When ?search= takes effect, frontend filtering; click card to go to detail', async () => {") },
      { file: /src\/apps\/views\/StorePage\.test\.ts$/, re: exactLine("routeQuery.search = 'jelly'") },
      // 2026-08-15:StorePage.test.ts 的三条用例标题与 Files.vue 的粘贴注释已在私有侧译成
      // 英文,原中文整行(登记在下面 '搜索' 那条)不再命中。语义未变:应用商店自己的关键字
      // 过滤器 / 文件区自己的文件名过滤输入框,都与被剥离的 NimoOS-Search 无关。整行精确匹配。
      { file: /src\/apps\/views\/StorePage\.test\.ts$/, re: exactLine("it('Search input debounced 250ms then replace route query (frontend filtering, deep link)', async () => {") },
      { file: /src\/apps\/views\/StorePage\.test\.ts$/, re: exactLine("it('Featured strip only shows when there is no search + all categories + all sources', async () => {") },
      { file: /src\/views\/Files\.vue$/, re: exactLine("// Don't steal the browser's default paste when focus is in an input (rename/search/etc.); silently ignore when the clipboard holds only text.") },
      // T16: SnapshotPreviewWindow.vue/.test.ts header comments -- 'search' here is only the
      // substring inside the plain English word "research" (a fix-round note about rebuilding
      // this file off the Vue2 authority source instead of a research summary's paraphrase),
      // not a mention of the deleted NimoOS-Search service.
      { file: /src\/files\/snapshot\/SnapshotPreviewWindow\.test\.ts$/, re: exactLine("// of an earlier version built off a research summary's inaccurate paraphrase. See") },
      { file: /src\/files\/snapshot\/SnapshotPreviewWindow\.vue$/, re: exactLine('research summary\'s paraphrase ("window chrome, title bar with a snapshot time label, three-column') },
      // write-root-redirect.sh / writeRootRedirect.test.ts:这里的 'search' 是浏览器
      // Location 接口的 .search 属性(URL 查询串),根重定向页把它原样透传给 /app/
      // 目标应用(连同 .hash),与被剥离的 NimoOS-Search 服务/SearchDialog.vue 毫无关系。
      // 整行精确匹配而不是给这两个文件按子串开洞——这两行以后如果混进真实的
      // Search 服务泄漏(比如意外拼进一个私有 API 路径),文本就不再逐字相同,
      // 匹配失效,回落到"未豁免、按词表判断",不会带着新增泄漏一起被放行。
      { file: /scripts\/write-root-redirect\.sh$/, re: exactLine("<script>location.replace('/app/' + location.search + location.hash)</script>") },
      { file: /scripts\/writeRootRedirect\.test\.ts$/, re: exactLine('expect(html).toContain("location.replace(\'/app/\' + location.search + location.hash)")') },
      // findIndex / findLastIndex 等标准库方法名里没有 search;binarySearch 之类若出现须显式登记
      // pnpm-lock.yaml(根目录 + 内嵌的 packages/service):第三方依赖名/resolution/
      // integrity 哈希里含 "search" 子串纯属噪声(@codemirror/search 等)——这是自动生成
      // 内容,不是手写代码,"整行精确匹配"在这里起不到"防止夹带真实泄漏"的作用(锚点会
      // 随依赖升级漂移),改用"这一行长得像 pnpm-lock 的包名/resolution/version/specifier
      // 记录行"的形状规则。只豁免这一个词,photo/gallery/transcript/wiki 在 lockfile 里
      // 仍然报(见下方 parser 的窄口径对比)。
      { file: /(^|\/)pnpm-lock\.yaml$/, re: PNPM_LOCK_LINE },
      // 2026-08-07:SP11 壁纸功能——WallpaperDialog.vue 的注释引用 SearchDialog.vue
      // 只是"同类无遮罩浮层组件"的实现先例(reka-ui DialogRoot + :modal="false" 的
      // 既有写法参考),不依赖被剥离的 NimoOS-Search 服务或 SearchDialog.vue 本身的
      // 任何功能。已用 oss/export.mjs 实测确认这条命中,逐行精确匹配登记。
      { file: /src\/components\/WallpaperDialog\.vue$/, re: exactLine('// wallpaper this dialog previews. Following SearchDialog.vue instead --') },
      // 2026-08-14(bug.txt #2 改名长度校验):注释里的 "search result" 指文件区列表里
      // 由搜索结果驱动的重命名(文件区自身的结果列表,保留面),与 NimoOS-Search 服务无关。
      { file: /src\/files\/composables\/useFileOps\.ts$/, re: exactLine('// the rename is driven from a search result or the sidebar. Without this the') },
      { file: /src\/files\/composables\/useFileOps\.test\.ts$/, re: exactLine('// two differ whenever the rename is driven from a search result or the') },
    ],
  },
  { word: 'speaker', re: /speaker/i, allow: [] },   // 拆完应零命中,留着当哨兵

  // ── T6.5:中文软禁词 ──────────────────────────────────────────────────
  // 搜索/照片/转录 三个字面上比硬禁词常见,已实测在本仓存在合法用法(见各自
  // allow 注释的 grep 证据),按纪律「禁止放宽词表消除误报」只能精确白名单。
  //
  // 复审 Critical(2026-08-04):最初这三个词的 allow 有的按「文件 + 键名子串」
  // (如 /appsStoreSearch/、/raidLevel1Usecase/)、有的按「文件 + 单字/短词」
  // (如 StorePage.vue 整体 /搜索/)豁免 —— 两种写法都等于"对整行甚至整个文件开洞":
  // 只要在被豁免的那一行(哪怕只是追加内容)混入真实 AI 泄漏,旧写法照样放行。
  // 复审用两条构造样本复现了这个洞:
  //   - raidLevel1Usecase 值改成"照片库、个人 NAS、启动卷(这里的照片会自动生成向量做相似检索)"
  //     ——/raidLevel1Usecase/ 只看键名,不管值写了什么,永远放行。
  //   - StorePage.vue 插入"// 商店页新增语音搜索:...(接入 Nimo 大模型做语义排序)"
  //     ——整文件通配的 /搜索/ 照样放行这一整行,包括后面那句真泄漏。
  // 改法:全部换成 exactLine() 整行精确匹配(见下方定义)。行内任何增删都会让匹配
  // 失效、退回"未豁免",不会带着新增泄漏一起被放行。两条构造样本已重新验证:
  // 收紧前放行、收紧后正确命中(证据见 oss/forbidden.test.mjs 与 task-6.5-report.md)。
  {
    word: '转录',
    re: /转录/,
    allow: [
      // zh_cn.ts:663/678/682 —— RAID 级别文案的来源说明("逐字转录自
      // RaidDetailPanel.vue/raidUtils.js"),是文档意义上的"抄录/转写",
      // 与音频转录(AI)功能无关。已用 grep 核实:这三行是本仓 转录 出现
      // 在 zh_cn.ts 里唯二不属于 audio* 转录键的地方。逐行精确匹配,不是关键词。
      { file: /src\/i18n\/zh_cn\.base\.ts$/, re: exactLine('// 逐字转录自 Vue2 面板的 RaidDetailPanel.vue L267-290(levelFaultTolerance/levelReadSpeed/levelWriteSpeed,按 level 0/1/5/6)') },
      { file: /src\/i18n\/zh_cn\.base\.ts$/, re: exactLine('// read/write 为该表原始 1-5 评分(5、4),转录为评分文本。') },
      { file: /src\/i18n\/zh_cn\.base\.ts$/, re: exactLine("// desc:raidUtils.js 源文件中 desc 字段本身即占位字符串(如 'RAID 0 Description'),逐字转录(非我方发明)") },
    ],
  },
  {
    word: '照片',
    re: /照片/,
    allow: [
      // raidLevel1Usecase:RAID 用途说明("照片库、个人 NAS、启动卷"),与相册 app 无关
      // (brief 指定保留面)。锚定整行(键名+值),不是只锚键名 —— 见上方复审 Critical 的复现证据。
      { file: /src\/i18n\/zh_cn\.base\.ts$/, re: exactLine("raidLevel1Usecase: '照片库、个人 NAS、启动卷',") },
      // ImageViewer 是通用图片文件查看器(Files 区),"照片"在这里是"图片内容"的泛称,
      // 不是被剥离的 Photos 相册 app。--media-overlay-shadow 同一 token 只被这里消费(已 grep 核实)。
      { file: /src\/files\/viewers\/ImageViewer\.vue$/, re: exactLine('瓦片接缝会在照片上显出白色网格细线(真机截图实证过);去掉后缩放会触发重绘,无缝。 */') },
      { file: /src\/styles\/theme\.css$/, re: exactLine('/* 媒体(照片/视频)上方浮层的投影:内容颜色不可控,白图上纯白浮层会隐形,') },
      // 2026-08-07:SP11 壁纸功能——themePhoto 是顶栏主题菜单第三个入口的中文文案
      // ("照片…"),产品拷贝按计划固定如此,与相册 app 无关。已用 oss/export.mjs
      // 实测确认这条命中,逐行精确匹配登记(不是给整个文件的"照片"二字开洞)。
      { file: /src\/i18n\/zh_cn\.base\.ts$/, re: exactLine("themePhoto: '照片…',") },
    ],
  },
  {
    word: '搜索',
    re: /搜索/,
    allow: [
      // 2026-08-07:上面 'search' 那条的中文孪生行 —— 同一份 Google Drive 指引页的中文半。
      { file: /public\/guide\/google-drive\.html$/, re: exactLine('<p>左侧菜单 <span class="path">API 和服务 → 库</span>,搜索 <b>Google Drive API</b>,点进去 → <b>启用</b>。</p>') },
      // appsStoreSearch:应用商店筛选框(brief 指定保留面),与 NimoOS-Search 服务无关。锚定整行。
      { file: /src\/i18n\/zh_cn\.base\.ts$/, re: exactLine("appsStoreSearch: '搜索应用…',") },
      // StorePage 这三行注释是"应用商店按关键字过滤"语义,与 AI 语义搜索无关。逐行精确匹配,
      // 不是给整个文件的"搜索"二字开洞 —— 见上方复审 Critical 的复现证据。
      // 2026-08-15:这三行连同 StorePage.test.ts 的用例标题、Files.vue 的粘贴注释都已在
      // 私有侧译成英文,产出树里不再出现中文原文;条目保留是因为守卫自检用它们当样本
      // (forbidden.test.mjs 逐条构造"合法原文 + 尾部追加泄漏"),等价的英文整行登记在
      // 上面 'search' 那条。
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('// 搜索输入:250ms 防抖(Vue2 同款)后写 query;外部 query 变化(后退)回灌输入框') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('// 分类/作者是后端参数:query 变化即重拉;搜索纯前端不重拉') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('// 推荐带只在「未过滤未搜索」的首屏语境显示——过滤/搜索时列表就是用户要的答案,带子是噪音') },
      { file: /src\/apps\/views\/StorePage\.test\.ts$/, re: exactLine("it('搜索输入 250ms 防抖后 replace 路由 query(前端过滤,深链)', async () => {") },
      { file: /src\/apps\/views\/StorePage\.test\.ts$/, re: exactLine("it('Featured 带只在 无搜索+全部分类+全部来源 时显示', async () => {") },
      // Files.vue:粘贴上传的"焦点在输入框(重命名/搜索等)"是 Files 区自己的文件名过滤输入框,
      // 不是被删除的 SearchDialog/NimoOS-Search。
      { file: /src\/views\/Files\.vue$/, re: exactLine('// 焦点在输入框(重命名/搜索等)时不抢浏览器默认粘贴;剪贴板只有文字时静默忽略。') },
    ],
  },
  // 智能:brief 点名的候选软禁词,但全仓 grep 核实后目前没有找到非 AI 的合法用法
  // (2026-08-04:src/home/components/SearchDialog.vue、MediaViewer.vue、audioTranscripts.ts、
  // zh_cn.ts/zh_cn.sp9.ts 里全部出现都属于要剥离的 AI 功能)。仍然放 SOFT 而不是 HARD——
  // 「智能」是通用词,未来任何非 AI 功能(如磁盘/网络的"智能识别")都可能合法用到它,
  // 一旦出现应加白名单而不是被迫放宽词表。当前 allow 为空,等同哨兵:任何命中都是待办。
  { word: '智能', re: /智能/, allow: [] },
  // 语义搜索:brief 特别警告"语义"单字词命中 51 个 CSS token 注释文件,禁止收单字。
  // 这里只收词组"语义搜索"。当前全仓 0 命中(sp7-photos/sp8-ai 合并前语义搜索功能还
  // 没有落地到 New-UI),先占位当哨兵,防止未来该功能被引入后悄悄漏进开源包。
  { word: '语义搜索', re: /语义搜索/, allow: [] },
  {
    word: 'ai',
    // 词边界:不碰中文、chain、main、Chairman。
    //
    // 第二轮复审 Important:第一轮的 alt2(要求 "AI" 前面不挨字母,即只认 "AI" 打头的
    // camelCase/PascalCase,如 AIService)漏掉了 "AI" 结尾的驼峰,比如 sendToAI/chatAI/
    // openAIRequest —— sendToAI 恰恰是本仓真实存在、且正是这次要清除的 AI 链路的核心
    // 函数名(src/home/composables/useOpenAction.ts:54 等 8 处),守卫必须抓到它。
    //
    // 改成两条子规则:
    //   alt1(大小写不敏感):独立词 ai/AI/Ai/aI,前面不挨字母、后面不挨"小写"字母 ——
    //        覆盖裸词 "ai"/"AI"、"AI 总结"、"AI-powered"、"AIService"(后面跟大写 S 不算挨着)。
    //   alt2(首字母 A 强制大写,第二个字母不区分大小写):前面挨一个小写字母、后面不挨
    //        小写字母 —— 覆盖"驼峰词尾的 Ai/AI",如 sendToAI、chatAI、openAIRequest,
    //        以及第三轮复审补的 widgetAiSend、pathFromAiPattern、askNimoAi(本仓 i18n 键/
    //        函数名的真实书写形态是首字母大写、第二个字母小写的 "Ai",不是全大写 "AI")。
    //
    // ★★★ 警告(两轮复审都在这条上栽过,后人别再栽):alt2 的第一个字母 A 必须
    // 强制大写(写成 `A[Ii]`),绝不能写成 `[Aa][Ii]`、也不能对这个 alt 整体套 /i。
    // src/settings/util/timezones.ts 里有真实存在的 Asia/Shanghai、Asia/Dubai —— 那里的
    // "ai" 是全小写,前面接小写字母、后面到词尾。一旦 alt2 允许首字母小写 a,
    // Shanghai/Dubai/Thai/bonsai 会立刻全部变成误报,而它们是本仓合法字符串。
    // 首字母强制大写这条边界,就是把"合法英文单词里的 ai"和"人为造的 Ai/AI 缩写"分开的
    // 唯一依据 —— 后人若想"顺手统一大小写",请先重新读这段注释再动手。
    //
    // 代价:const AIRPORT=1 这类"AI"后面直接接大写字母的全大写标识符仍会被 alt1 命中
    // (机场号码/常量名一类罕见样式)。按纪律「词表宁可宽」接受这个已知的假阳性,不为它
    // 收窄规则去冒漏掉真实 AI 代码的风险。
    re: /(?<![A-Za-z])[Aa][Ii](?![a-z])|(?<=[a-z])A[Ii](?![a-z])/,
    allow: [
      // E5:局部变量 ai = anchorIndex(files.ts 的 shift 选区)
      { file: /src\/files\/stores\/files\.ts$/, re: /\bai\b\s*[=<,)\]]|\[lo,\s*hi\]/ },
      // T14:APPLICATION_ILLUSTRATOR 的 'ai' 是 Adobe Illustrator 的文件扩展名(与 'eps'
      // 同一常量),文件分类表的单一真源,与 AI 功能无关。
      { file: /src\/files\/util\/fileCategories\.ts$/, re: exactLine("export const APPLICATION_ILLUSTRATOR = ['ai', 'eps']") },
      // T14:三个文件夹图标 svg 内嵌了 base64 编码的位图(旧版图标资源的 data URI 兜底),
      // "ai" 只是 base64 字符集里随机出现的子串,与 AI 功能无关。按文件精确限定 ——
      // folder-root.svg 的整条 xlink:href 数据 URI 在同一行;folder-hdd.svg/folder-usb.svg
      // 是数据 URI 换行后的纯 base64 续行(除字母数字 +/= 外不含任何其他字符,真实代码
      // 不会写出这种形状的行,不会误伤)。
      { file: /src\/files\/assets\/icons\/folder-root\.svg$/, re: /data:image\/png;base64,/ },
      { file: /src\/files\/assets\/icons\/folder-hdd\.svg$/, re: /^\s*[A-Za-z0-9+/=]+\s*$/ },
      { file: /src\/files\/assets\/icons\/folder-usb\.svg$/, re: /^\s*[A-Za-z0-9+/=]+\s*$/ },
      // 2026-08-07:云盘驱动图标改由本仓自带(Vue2 下线后站点根不再有 img/)。OneDrive.svg
      // 整张图就是一个内嵌 base64 PNG,"ai" 是 base64 字符集里随机出现的子串 —— 与上面三个
      // 文件夹图标同一情形,按同一形状规则(整条 data URI 在同一行)精确限定到这个文件。
      { file: /public\/img\/driver\/OneDrive\.svg$/, re: /data:image\/png;base64,/ },
      // pnpm-lock.yaml:同 search 词条的注释 —— 自动生成文件,用"像不像 pnpm-lock 记录行"
      // 的形状规则,而不是逐字锚定(依赖升级就作废)。
      { file: /(^|\/)pnpm-lock\.yaml$/, re: PNPM_LOCK_LINE },
      // SP11 final review fix wave (2026-08-08): C1's fix comment names the
      // three sibling files (ai.ts, photos.ts, sys.ts) that already send
      // multipart correctly -- "ai.ts" here is a filename reference to the
      // AI service package's HTTP client, not a mention of an AI feature.
      // Same line also needed a 'photo' allow entry above; already verified
      // with oss/export.mjs.
      { file: /packages\/service\/src\/users\.ts$/, re: exactLine('// matches every other multipart caller in this package (ai.ts, photos.ts, sys.ts).') },
    ],
  },
  {
    word: 'parser',
    re: /\bparser\b/i,
    allow: [
      // T14:pnpm-lock.yaml 里真实存在的 7 个第三方包,名字含 "parser" 但都是知名的
      // 通用解析器库(Babel/CSS/引擎协议/CLI 参数),与私有的 NimoOS-Parser(RAG 索引
      // 服务)毫无关系。刻意不用 search/ai 那条"像不像 lockfile 记录行"的宽口径 ——
      // 这里按**包名精确枚举**,如果 lockfile 里哪天真的出现 nimoos-parser 或任何其他
      // 新的 "*-parser" 依赖,这条正则不会匹配到它,仍然会被抓到人工看一眼。
      { file: /(^|\/)pnpm-lock\.yaml$/, re: /@babel\/(helper-string-)?parser\b|@csstools\/css-(parser-algorithms|color-parser)\b|(?:engine|socket)\.io-parser\b|yargs-parser\b/ },
      // 2026-08-15: the English-ification sweep rendered "不依赖解析器" as
      // "parser-independent" here. It describes the colour guard doing regex over raw
      // source text instead of jsdom's CSSOM -- nothing to do with NimoOS-Parser.
      { file: /src\/styles\/color-guard\.test\.ts$/, re: exactLine("// Detection method (parser-independent, so it doesn't rely on jsdom's CSSOM): strip `/* … */` **non-greedily** per CSS semantics") },
    ],
  },
  { word: 'wiki', re: /wiki/i, allow: [] },
  {
    word: 'folderPermission',
    re: /folderPermission/i,
    allow: [
      // E4:成员文件夹授权,与 AI 无关,保留面
      { file: /.*/, re: /UserFolderPermission/ },
    ],
  },
]

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB — files over limit are skipped but logged (see scanTree)
const SNIFF_BYTES = 8 * 1024 // only scan first 8KB to judge binary, sufficient and fast

// T14(B2): these two "expected skip" messages used to appear once in scanTree(), and second time
// hardcoded-exact-match in export.mjs's isExpectedSkip() — the two locations must be wording-identical,
// change one punctuation (e.g. Chinese comma to ASCII comma) and export.mjs's classification silently
// drifts to "unexpected→fatal" side, no test catches it (tree.test.mjs runs export with --skip-guard,
// never goes through this classification logic). Factor into named constants + export isExpectedSkip(),
// let scanTree and export.mjs share one literal — structurally eliminates "two-location wording drift"
// possibility, not relying on manual sync.
export const SKIP_REASON_SYMLINK = 'symbolic link, not followed, not scanned'
export const SKIP_REASON_BINARY = 'determined to be binary, not scanned'

/**
 * Determine if a __skipped__ record is "expected" (binary/symlink, warning only, not failure)
 * or "unexpected" (read failure/stat failure/over size limit/directory read failure, still fatal).
 * Exact match SKIP_REASON_SYMLINK / SKIP_REASON_BINARY these two fixed messages; all others fall into
 * "unexpected" — this also makes any future skip reasons added to scanTree default to "unexpected"
 * handling, won't be silently passed because this wasn't updated.
 */
export function isExpectedSkip(excerpt) {
  return excerpt === SKIP_REASON_SYMLINK || excerpt === SKIP_REASON_BINARY
}

/**
 * Binary heuristic: if NUL byte appears in first 8KB, judge as binary. More reliable than
 * extension-based judgment — this tree actually mixes real binaries (e.g. src/home/apps/icons/*.png),
 * forcing utf8 read produces garbage that triggers false positives, also slow.
 */
function looksBinary(buf) {
  const n = Math.min(buf.length, SNIFF_BYTES)
  for (let i = 0; i < n; i++) {
    if (buf[i] === 0) return true
  }
  return false
}

function allowed(rules, relPath, line) {
  return rules.some((r) => r.file.test(relPath) && r.re.test(line))
}

/** Scan a text segment. Return list of hits (empty array = clean). */
export function scanText(relPath, text) {
  const out = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const { word, re } of HARD) {
      if (re.test(line)) out.push({ word, line: i + 1, excerpt: line.trim().slice(0, 160) })
    }
    for (const { word, re, allow } of SOFT) {
      if (re.test(line) && !allowed(allow, relPath, line)) {
        out.push({ word, line: i + 1, excerpt: line.trim().slice(0, 160) })
      }
    }
  }
  return out
}

/**
 * Recursively scan entire tree. Exclusion-based, not whitelist-based: **read every file** except
 * `.git`/`node_modules`/`dist` directories. Skips never silent — each skip appends a `word: '__skipped__'`
 * record to return array, consumers (Task 14 export flow) seeing this sentinel word knows this file
 * wasn't content-scanned, must decide if extra handling needed. Discipline #3 spirit: "guard's
 * standard degrade path is silent exemption" — skip without trace equals quietly opening a hole.
 *
 * Skip cases:
 *   ① Symbolic links (not followed, whether pointing to file or directory) — second review Important:
 *      this repo's `.claude/worktrees/NimoOS-Service` is a symlink pointing to directory.
 *      `readdirSync(..., {withFileTypes:true})` internally uses lstat, `Dirent.isDirectory()`
 *      returns false for symlinks (no following), falls into "file" branch; but `fs.statSync`/
 *      `fs.readFileSync` follow symlinks by default, reading a link pointing to directory throws
 *      `EISDIR` crashes entire scan. Changed to use `Dirent.isSymbolicLink()` to identify and skip first ——
 *      the real content pointed to by symlink, if already in tree, gets scanned through its real path,
 *      won't be missed just because we skip the link itself.
 *   ② Files over MAX_BYTES — but not unconditionally classified as "over limit": first only read
 *      file start SNIFF_BYTES bytes for ③ binary sniffing (fs.openSync/readSync, not whole large file),
 *      if sniffing detects binary classify as ③'s SKIP_REASON_BINARY (expected, non-fatal, same
 *      treatment as sub-cap binary files); only when sniffing doesn't detect binary fall back to
 *      "over size limit" (unexpected, still fatal). 2026-08-07 (SP11 wallpaper cleanup ticket):
 *      MAX_BYTES is a scan-cost limit, not a trust boundary — a 2.2MB JPEG is no more dangerous
 *      than the sub-cap binary assets this guard already skips-and-logs. What the cap must keep
 *      catching is an oversized *text* file, which could genuinely hide a secret in unread region.
 *   ③ Determined binary by first SNIFF_BYTES(8KB) (looksBinary) — after reading full content for non-over-limit files,
 *      sniffing; over-limit files reuse same sniff function but only read the start portion.
 *   ④ Any stat/read/readdir failure (permission issues, race deletions, etc.) — fallback try/catch, never silent frame loss.
 *      The "read-only-start" step itself for over-limit files can also fail, same category, don't silently swallow.
 *      Third review bonus hardening: directory's own `readdirSync` previously had no try/catch, subdirectories
 *      if deleted concurrently during traversal or lack read permission would crash entire scanTree like symlinks
 *      did; now also counts as __skipped__.
 */
export function scanTree(rootDir) {
  const findings = []
  const skip = (rel, excerpt) => findings.push({ file: rel, word: '__skipped__', line: 0, excerpt })

  const walk = (dir) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch (err) {
      skip(path.relative(rootDir, dir) || '.', `directory read failed, not scanned: ${err.message}`)
      return
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name)
      const rel = path.relative(rootDir, abs)

      if (e.isSymbolicLink()) {
        skip(rel, SKIP_REASON_SYMLINK)
        continue
      }
      if (e.isDirectory()) {
        if (e.name === '.git' || e.name === 'node_modules' || e.name === 'dist') continue
        walk(abs)
        continue
      }

      let stat
      try {
        stat = fs.statSync(abs)
      } catch (err) {
        skip(rel, `stat failed, not scanned: ${err.message}`)
        continue
      }
      if (stat.size > MAX_BYTES) {
        // Reorder rationale (2026-08-07, SP11 wallpaper cleanup): don't classify an
        // oversized file as "over the cap" purely by size. Read only the head bytes
        // looksBinary actually inspects (SNIFF_BYTES, ~8KB) via openSync/readSync —
        // never the whole oversized file — and sniff it first. An oversized binary
        // file (e.g. a 2.2MB built-in wallpaper JPEG) is no more dangerous than the
        // sub-cap binary assets this guard already skips-and-logs as SKIP_REASON_BINARY
        // (an expected, non-fatal skip); it should get the same classification. Only
        // when the head does NOT look binary does this fall through to the "over the
        // cap" skip (still unexpected/fatal) — MAX_BYTES is a scan-cost limit, not a
        // trust boundary, and what it must keep catching is an oversized *text* file,
        // which could genuinely hide a secret in a region nobody read.
        let head
        try {
          const fd = fs.openSync(abs, 'r')
          try {
            const headBuf = Buffer.alloc(Math.min(stat.size, SNIFF_BYTES))
            const bytesRead = fs.readSync(fd, headBuf, 0, headBuf.length, 0)
            head = headBuf.subarray(0, bytesRead)
          } finally {
            fs.closeSync(fd)
          }
        } catch (err) {
          skip(rel, `read failed, not scanned: ${err.message}`)
          continue
        }
        skip(rel, looksBinary(head) ? SKIP_REASON_BINARY : `exceeded ${MAX_BYTES} byte limit, not scanned`)
        continue
      }

      let buf
      try {
        buf = fs.readFileSync(abs)
      } catch (err) {
        skip(rel, `read failed, not scanned: ${err.message}`)
        continue
      }
      if (looksBinary(buf)) {
        skip(rel, SKIP_REASON_BINARY)
        continue
      }
      for (const f of scanText(rel, buf.toString('utf8'))) findings.push({ file: rel, ...f })
    }
  }
  walk(rootDir)
  return findings
}

// ─── T15: dist scan — build artifacts are second-stage backup gate, criteria differ from source tree scan ─────────────
//
// Why can't just point scanTree at dist/ (T15 tested, 64 hits, full tracebacks in task-15-report.md):
//   1. **This gate prevents "our content (i18n values/comments) leaking into bundle", not reviewing what third-party
//      libraries internally wrote.** Source-tree scan (scanText/scanTree, unchanged, still primary defense line) already
//      intercepted one round "before our code enters artifact"; dist scan's duty is much narrower — only verify "bundle
//      step didn't accidentally mix our leaks", not re-audit pdf.js/xlsx third-party implementations.
//   2. **ASCII soft-forbidden words (photo/gallery/search/ai/parser/wiki/speaker/folderPermission) are universal English
//      substrings**, in minified artifacts third-party library class names (pdf.js's `Parser` class), embedded data
//      (xlsx Excel 97 macro function table `GALLERY.AREA`), MIME constants (`image/vnd.ms-photo`), Rollup-generated
//      two-letter compressed import aliases, SVG-embedded base64 binary data — on this artifact scale colliding with
//      universal English substrings is statistically almost inevitable. T15 actual test: of 64 hits, hard-forbidden 0,
//      Chinese soft-forbidden 0, all 64 are ASCII soft-forbidden. **Those two 0s are exactly the only signal class for
//      "our content leaked into bundle"** — our comments/copy are mainly Chinese, hard-forbidden words are unambiguous
//      brand/tech-stack marks, compressed third-party ASCII code won't accidentally contain Chinese or our brand words.
//   3. **exactLine() per-line whitelist structurally breaks in minified output.** After build entire file often squashed to
//      line 1 (like `assets/index-*.css`), paths also content-hash-renamed (`public/widget-kit.css` becomes `widget-kit.css`,
//      whitelist's file regex directly won't match). Continuing to whitelist by "file + entire line" is equivalent to
//      degrading whitelist to "as long as it appears in this hash-named artifact, pass" — exactly what this project
//      forbids as "loosening the word list" in another form, and hash filenames change per build, not maintainable.
//
// Therefore: dist scan only uses **HARD (all, English or Chinese) + SOFT entries whose word contains Chinese characters**,
// explicitly excluding pure-ASCII SOFT words. Judge "is it a Chinese word" by testing /[一-龥]/ against the word itself,
// don't hardcode word list — future HARD/SOFT additions auto-categorize, no leaks. HARD/SOFT word list definitions
// unchanged; here is just consumer, reading them with different filter conditions.

/** If word itself contains Chinese characters, judge as "Chinese word". Don't hardcode word list, additions/deletions auto-categorize. */
function isChineseWord(word) {
  return /[一-龥]/.test(word)
}

/**
 * Dist-only content allowlist. "file + line" targeting breaks down in minified
 * output, so this matches **exact content substrings** instead — only strings
 * copied verbatim from the source, never file/line coordinates. Every entry
 * corresponds to a line already exempted in the source-tree allowlist (see the
 * SOFT-table notes on the photo/search entries in this file):
 *   - raidLevel1Usecase's RAID usage blurb ("photo library…") — unrelated to the
 *     photos app. (T15)
 *   - appsStoreSearch, the app-store filter placeholder — unrelated to the
 *     NimoOS-Search service. (T15)
 *   - themePhoto, the top-bar theme menu entry (SP11 wallpaper: pick a photo
 *     as wallpaper) — unrelated to the photos app. Key-qualified on purpose so
 *     a bare "photo…" elsewhere is not blanket-exempted. (2026-08-11 snapshot)
 *   - The google-drive.html guide sentence telling the user to search for the
 *     Drive API in the Google console — unrelated to the NimoOS-Search
 *     service. (2026-08-11 snapshot)
 * Same discipline as the source tree's exactLine(): any edit breaks the
 * substring match and the line falls back to "not exempted" — a new leak can
 * never ride along. On a match, **only the matched substring is replaced with
 * equal-length blanks and scanning continues on the rest of the line** — the
 * line is never skipped wholesale, because one minified line can be an entire
 * multi-KB module and skipping it would also skip any real leak sharing it.
 */
const DIST_ALLOW = [
  '照片库、个人 NAS、启动卷',
  '搜索应用…',
  'themePhoto:"照片…"',
  '搜索 <b>Google Drive API</b>',
]

/**
 * T15(b): Institutionalize brand/private path grep — originally manually run once in T15 report,
 * immune to minification (searching for service names/route prefixes as complete literal strings,
 * not English substrings, won't be scattered by minification), now fixed as part of dist scan,
 * hit means fatal. The four private service names `nimoos-search|nimoos-parser|nimoos-photos|
 * nimoos-ai` won't confuse with legitimate embedded `@nimotech/nimoos-service` shared package —
 * "service" is not a substring of any of those four, nor are they substrings of it.
 * `photos_data|qdrant|ollama|immich|wikiRoot|192\.168\.1\.115` already covered in HARD table,
 * don't duplicate here; only add two signal classes not in HARD/SOFT: private service name literals,
 * `/v1/(ai|search|photos|parser)/` gateway route prefixes of these four removed services.
 */
const BRAND_RE = /nimoos-search|nimoos-parser|nimoos-photos|nimoos-ai|\/v1\/(ai|search|photos|parser)\//

// Dist-specific size limit: MAX_BYTES (2MB) is for source tree hand-written files, real build artifacts'
// individual vendor chunks easily exceed it (this repo test: index-*.js main chunk 3.4MB, Excel viewer
// chunk 1.6MB) — if keeping 2MB limit, exactly the largest, most-need-scanning files are "unexpected skip"
// fatal, forcing someone to expand size limit every time, amounts to nothing. dist scan input is build artifacts,
// quantity small (dozens to hundreds of chunks), large volume but reading into memory causes no pressure,
// directly relax to 64MB — only if a single file actually exceeds this is it worth stopping to review.
const DIST_MAX_BYTES = 64 * 1024 * 1024

/**
 * Scan build artifacts (dist/). Same structure as scanTree (binary/symlink skip, logging,
 * __skipped__ sentinel, isExpectedSkip reuse), but word-judging logic uses the specialized
 * rules above (not scanText), size limit also separately relaxed (DIST_MAX_BYTES, reasoning above).
 * Brand grep hits mark word: 'brand-leak'.
 */
export function scanDist(rootDir) {
  const words = [...HARD, ...SOFT.filter((s) => isChineseWord(s.word))]
  const findings = []
  const skip = (rel, excerpt) => findings.push({ file: rel, word: '__skipped__', line: 0, excerpt })

  const walk = (dir) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch (err) {
      skip(path.relative(rootDir, dir) || '.', `directory read failed, not scanned: ${err.message}`)
      return
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name)
      const rel = path.relative(rootDir, abs)

      if (e.isSymbolicLink()) {
        skip(rel, SKIP_REASON_SYMLINK)
        continue
      }
      if (e.isDirectory()) {
        walk(abs)
        continue
      }

      let stat
      try {
        stat = fs.statSync(abs)
      } catch (err) {
        skip(rel, `stat failed, not scanned: ${err.message}`)
        continue
      }
      if (stat.size > DIST_MAX_BYTES) {
        skip(rel, `exceeded ${DIST_MAX_BYTES} byte limit, not scanned`)
        continue
      }

      let buf
      try {
        buf = fs.readFileSync(abs)
      } catch (err) {
        skip(rel, `read failed, not scanned: ${err.message}`)
        continue
      }
      if (looksBinary(buf)) {
        skip(rel, SKIP_REASON_BINARY)
        continue
      }

      const text = buf.toString('utf8')
      const lines = text.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Only "hollow out" known-legitimate substrings themselves to equal-length blanks, don't skip entire line —
        // one minified line can be tens of KB of an entire module, skipping entire line would miss any real leaks on same line.
        let scanLine = line
        for (const allow of DIST_ALLOW) {
          if (scanLine.includes(allow)) scanLine = scanLine.split(allow).join(' '.repeat(allow.length))
        }
        for (const { word, re } of words) {
          if (re.test(scanLine)) findings.push({ file: rel, line: i + 1, word, excerpt: line.trim().slice(0, 160) })
        }
        if (BRAND_RE.test(scanLine)) {
          findings.push({ file: rel, line: i + 1, word: 'brand-leak', excerpt: line.trim().slice(0, 160) })
        }
      }
    }
  }
  walk(rootDir)
  return findings
}
