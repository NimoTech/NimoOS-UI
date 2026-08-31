// Photos album-section copy, split into its own file.
//
// Why a separate file: new keys land only in their own slice file, so several parallel
// workstreams don't collide on one shared file (see the comment in src/i18n/index.ts). The
// album section's 700+ lines of copy form a self-contained block, so the main table doesn't
// have to keep growing alongside it.
//
// The content was carried over as-is from zh_cn.base.ts (formerly zh_cn.ts) — every
// photos*-prefixed key, in its original order, with its original comments and end-of-line
// markers. Not a single character was changed — equivalence is proven key-for-key by
// __tests__/photosSlice.test.ts against a JSON snapshot taken at extraction time.
export default {
  // ── Albums ──
  photosTitle: '相册',
  photosLibrary: '照片库',
  photosFavorites: '收藏',
  photosTrash: '最近删除',
  photosStorage: '存储空间',
  photosCountSummary: '{photos} 张照片 · {videos} 个视频',
  photosTabAll: '全部',
  photosTabPhotos: '照片',
  photosTabOcr: '文字',
  photosTabVideos: '视频',
  photosItemsCount: '{count} 项',
  photosItemSingular: '{count} 项',
  photosSelectedCount: '已选择 {count} 项',
  photosDelete: '删除',
  photosCancel: '取消',
  photosNoPhotos: '暂无照片',
  photosNoPhotosHint: '照片入库后会出现在这里',
  photosUnknownDate: '未知日期',
  photosDeletedToast: '{count} 项已移入最近删除',
  // Honest partial-failure toast for the "move to Recently Deleted" flow (PhotosFavorites.vue's
  // onBatchDelete/onLightboxDelete) -- store.deleteAssets already returns the ACTUAL success
  // count (per-id try/catch), this key surfaces it instead of silently reporting the click-time
  // selection size as if every item succeeded. Zero-success reuses the existing
  // photosTrashDeleteFailed "Delete failed" family rather than adding a near-duplicate key (see
  // trash.ts's purge()/PhotosTrash.vue for the sibling permanent-delete flow, which follows the
  // exact same three-way branch).
  photosDeletedPartialToast: '{ok} 项已移入最近删除，{fail} 项失败',
  photosIndexedToast: '已索引 {n} 张照片',
  photosTaskCompletedToast: '{label} 已完成',
  photosDensityCompact: '紧凑',
  photosDensityComfortable: '舒适',
  photosDensityLoose: '宽松',
  photosLightboxCounter: '{idx} / {total}',
  photosFavorite: '收藏',
  photosUnfavorite: '取消收藏',
  photosDownload: '下载',
  photosClose: '关闭',
  photosPrev: '上一张',
  photosNext: '下一张',
  photosInfoToggle: '详情',
  photosLivePhoto: '实况',
  photosDeleteConfirmTitle: '删除这张?',
  photosDeleteConfirmBody: '将移入最近删除,可从中恢复。',
  photosConfirmDelete: '删除',
  photosInfoCameraCapture: '相机与拍摄',
  photosInfoVideo: '视频',
  photosInfoLocation: '位置',
  photosInfoPeople: '人物',
  photosInfoNimoSees: 'Nimo 识别',
  photosHandOffToNimo: '交给 Nimo',
  photosInfoFile: 'NAS 上的文件',
  photosFieldCamera: '相机',
  photosFieldIso: 'ISO',
  photosFieldShutter: '快门',
  photosFieldAperture: '光圈',
  photosFieldFocal: '焦距',
  photosFieldDimensions: '尺寸',
  photosFieldFileSize: '文件大小',
  photosFieldDuration: '时长',
  photosFieldResolution: '分辨率',
  photosFieldVideoCodec: '视频编码',
  photosFieldAudioCodec: '音频编码',
  photosFieldFrameRate: '帧率',
  photosFieldBitRate: '码率',
  photosFieldRotation: '旋转',
  photosFieldCoordinates: '坐标',
  photosFieldPlace: '地点',
  photosCopyPath: '复制路径',
  photosCopied: '已复制',
  photosFilterByExif: '按 EXIF 过滤',
  photosFilterCamera: '相机',
  photosFilterLocation: '位置',
  photosFilterYear: '年份',
  // ── Albums: Favorites view ──
  photosFavTitle: '收藏',
  photosFavEmptyTitle: '暂无收藏',
  photosFavEmptyHint: '在任意照片上点 ★ 即可收藏，收藏会永久保留。',
  photosFavExport: '下载为 ZIP',
  photosFavExporting: '开始打包下载…',
  photosFavCount: '{count} 张收藏',
  // Hero stats sub-line -- Vue2 bolds ONLY the raw number
  // (`<b>{{ photoCount }}</b> {{ $t('photos_count') }}`), the noun sits
  // outside <b>, so these are noun-only keys (not "{n} photos" one-piece
  // strings) matching Vue2 PhotosFavoritesView.vue:11-12's photos_count/videos
  // copy exactly ('张照片'/'视频', no quantifier word).
  photosFavHeroPhotosNoun: '张照片',
  photosFavHeroVideosNoun: '视频',
  photosFavHeroKeptForever: '永久保留',
  // Pinned-highlights strip (server-ranked top 5, GET /favorites/top) --
  // matches Vue2 PhotosFavoritesView.vue:89-90.
  photosFavPinnedTitle: '精选亮点',
  photosFavPinnedSub: '你最常收藏的瞬间 · Nimo 精选',
  // Slideshow playback -- matches Vue2 PhotosFavoritesView.vue:18-19 (entry
  // button) / :237-273 (playback layer: close, prev/next, play/pause, three speed tiers).
  photosFavSlideshow: '幻灯片播放',
  photosFavSlideClose: '关闭 (Esc)',
  photosFavSlidePrev: '上一张 (←)',
  photosFavSlideNext: '下一张 (→)',
  // Adds Vue2 :256's play/pause button title (value taken from
  // the Vue 2 panel's src/assets/lang/zh_CN.json:2244).
  photosFavSlidePlayPause: '播放/暂停 (空格)',
  photosFavSlideSpeed: '速度',
  photosFavSlideFast: '快',
  photosFavSlideNormal: '正常',
  photosFavSlideSlow: '慢',
  // ── Albums: Trash view ──
  photosTrashTitle: '最近删除',
  // topbar `sub` was previously left unbound, defaulting to the
  // library-wide photo/video count string (wrong content for this view). Matches Vue2
  // PhotosTimeline.vue:231 navMap.trash ('{count} items · auto-deletes in 30 days'), except
  // {days} is dynamic here (this reads the live retention setting instead of Vue2's
  // hardcoded 30). zh wording reused verbatim from the Vue 2 panel's src/assets/lang/zh_CN.json's
  // existing translation of that exact Vue2 string ('{count} 项 · 30 天后自动删除'), just with
  // {days} substituted in for the literal 30.
  photosTrashSubtitle: '{count} 项 · {days} 天后自动删除',
  photosTrashEmptyTitle: '最近删除是空的',
  photosTrashEmptyHint: '已删除的照片和视频会在这里保留 {days} 天，之后从 NAS 永久移除。',
  photosTrashRestore: '恢复',
  photosTrashRestoreAll: '恢复全部',
  photosTrashEmpty: '清空最近删除',
  photosTrashDeleteForever: '永久删除',
  photosTrashDaysLeft: '剩 {days} 天',
  photosTrashFrom: '来自 {source}',
  photosTrashCanFree: '可释放',
  photosTrashItems: '项',
  photosTrashSelectedCount: '已选择 {count} 项',
  photosTrashSort: '排序',
  photosTrashSortDaysLeft: '剩余天数',
  photosTrashSortRecent: '最近删除',
  photosTrashUndo: '撤销',
  // ── Albums: Bucket titles ──
  photosTrashBucketUrgent: '1–7 天内删除',
  photosTrashBucketSoon: '8–14 天内删除',
  photosTrashBucketLater: '15–21 天内删除',
  photosTrashBucketFresh: '最近删除',
  photosTrashBucketUrgentDesc: '即将删除 — 如需保留请尽快恢复',
  photosTrashBucketSoonDesc: '提醒 — 即将自动删除',
  photosTrashBucketLaterDesc: '还有充足时间可以恢复',
  photosTrashBucketFreshDesc: '超过保留期后将自动删除',
  // ── Albums: Confirmation dialogs ──
  photosTrashRestoreAllTitle: '恢复全部 {count} 项？',
  photosTrashRestoreAllBody: '它们会回到原来的位置，重新出现在资料库、相册和时间线中。',
  photosTrashDeleteSelTitle: '永久删除 {count} 项？',
  photosTrashDeleteSelBody: '这将立即从 NAS 中清除,此操作无法撤销。',
  photosTrashEmptyTitle2: '永久删除全部 {count} 项？',
  photosTrashEmptyBody: '这将在 NAS 上释放 {size} MB,原始文件将无法恢复。',
  // ── Albums: Toast messages ──
  photosTrashRestoredToast: '{count} 项已恢复到资料库',
  photosTrashPurgedToast: '{count} 项已永久删除 · 释放 {size} MB',
  // trash.ts's purge() now reports the ACTUAL per-item success count
  // (Promise.allSettled, not the old swallow-and-lie Promise.all) -- this key covers the
  // 0 < success < total case. Freed-size is intentionally omitted here (same reasoning as
  // photosTrashEmptiedToastPartial below: it was only ever a sum over the full requested
  // selection, which overstates it once some of those items never actually got purged).
  photosTrashPurgedPartialToast: '已永久删除 {ok} 项，{fail} 项失败',
  photosTrashEmptiedToast: '最近删除已清空 · 释放 {size} MB',
  // While pages remain, the freed-size figure is only computed from the
  // loaded subset — these size-less variants are used instead until trashExhausted.
  photosTrashEmptiedToastPartial: '最近删除已清空',
  photosTrashEmptyBodyPartial: '这将释放 NAS 上的空间，原始文件将无法恢复。',
  photosTrashRestoreFailed: '恢复失败',
  photosTrashDeleteFailed: '删除失败',
  photosTrashEmptyFailed: '清空失败',
  photosFavExportFailed: '导出失败',
  // ── Albums: Sidebar / list view ──
  photosAlbums: '相册',
  photosAlbumsTitle: '相册',
  photosAlbumsCount: '{count} 个相册',
  photosAlbumsMine: '我的相册',
  photosAlbumsMineHint: '你创建的相册',
  photosAlbumNew: '新建相册',
  photosAlbumNewHint: '点击创建或询问 Nimo',
  photosAlbumUntitled: '未命名',
  // The mixed grid's section subtitle when both manual and smart albums are empty
  // (939a7d3a:PhotosAlbumsView.vue). Inserted here, next to the rest of the "no albums" copy
  // cluster, rather than by the photosAlbums* family's scattered global order.
  // photosAlbumsEmptyTitle/photosAlbumsEmptyHint, which used to sit right above this key, are
  // deleted (grep-confirmed zero other consumers) -- they backed a standalone empty-state
  // panel that duplicated this subtitle's own "还没有相册" copy once smart albums joined the
  // grid. Vue2 has no such panel either (see the matching PhotosAlbums.vue comment), so
  // removing it is a 1:1 correction, not a feature cut.
  photosAlbumsNoneYetHint: '还没有相册——手动创建一个，或者让 Nimo 建一个会自动保持更新的智能相册。',
  photosAlbumSort: '排序：',
  photosAlbumSortCreated: '最近添加',
  photosAlbumSortCreatedHint: '最新的相册在前',
  photosAlbumSortName: '名称(A–Z)',
  photosAlbumSortNameHint: '按字母序',
  photosAlbumSortNameR: '名称(Z–A)',
  photosAlbumSortNameRHint: '反字母序',
  photosAlbumSortCount: '照片数量',
  photosAlbumSortCountHint: '最多的在前',
  photosAlbumSortDate: '拍摄日期',
  photosAlbumSortDateHint: '最新的瞬间在前',
  // ── Albums: New album modal ──
  photosAlbumCreateTitle: '新建相册',
  photosAlbumCreateSub: '起个名字,再决定怎么填充',
  photosAlbumNameLabel: '相册名称',
  photosAlbumNamePlaceholder: '例如 东京 · 春天',
  photosAlbumFillLabel: '如何填充',
  photosAlbumFillEmpty: '空相册',
  photosAlbumFillEmptyHint: '之后拖拽添加照片',
  photosAlbumFillRecent: '最近 30 天的照片',
  photosAlbumFillRecentHint: '自动填入所有近期照片',
  photosAlbumFillSelect: '手动挑选照片…',
  photosAlbumFillSelectHint: '打开图库逐张挑选',
  photosAlbumCreating: '创建中…',
  photosAlbumCreate: '创建相册',
  photosAlbumCreatedToast: '相册已创建:{name}',
  photosAlbumCreateFailed: '创建失败',
  photosAlbumNameExists: '已存在同名相册',
  // ── Albums: Detail view ──
  photosAlbumBack: '相册',
  photosAlbumLabel: '相册',
  photosAlbumClickToRename: '点击重命名',
  photosAlbumEdit: '编辑',
  photosAlbumDone: '完成',
  photosAlbumRenameHint: '修改相册名称',
  photosAlbumConvertToSmart: '转为智能相册',
  photosAlbumConvertToSmartHint: 'Nimo 会自动持续加入匹配的新照片',
  // Short menu titles (#117): the "..." menu's main labels were shortened -- Rename/Duplicate/
  // Download as ZIP reuse existing short keys (photosSvRename/photosSvDuplicate/photosFavExport,
  // verbatim matches for the target translation), Delete reuses photosDelete; only Convert had
  // no existing generic short key, so this one is new.
  // Orphan cleanup: photosAlbumRename lost its only reference and was deleted; photosAlbumConvertToSmart
  // stays -- AlbumConvertToSmartDialog's title/confirm button still uses it.
  photosAlbumMenuConvert: '转换',
  // The "..." menu's Convert entry has its own desc in the target (33b05636
  // PhotosAlbumDetail.vue:266 "Turn into a Smart Album that keeps updating", zh_CN.json:2836).
  // It is NOT the same string as photosAlbumConvertToSmartHint above, which the target uses
  // only as the convert modal's subtitle (:375) -- the menu entry pointed at that one for a
  // while because this key had not been created yet. AlbumConvertToSmartDialog.vue stays on
  // the modal key.
  photosAlbumMenuConvertHint: '转为持续自动更新的智能相册',
  // Duplicate menu item's desc -- target literal "Copy the photos as a new album" (33b05636
  // zh_CN.json: "把照片复制为一个新相册").
  photosAlbumDuplicateHint: '把照片复制为一个新相册',
  // ── Albums → Smart Album conversion dialog ──
  photosAlbumConvertSuggestHint: 'Nimo 建议以下条件——最终匹配结果以智能相册创建时为准',
  photosAlbumConvertLockHint: '现有 {n} 张照片将保持锁定，Nimo 会按这个主题持续加入新照片。',
  photosAlbumConverting: '转换中…',
  photosAlbumConvertedToSmart: '已转为智能相册',
  photosAlbumConvertFailed: '转换失败',
  photosAlbumStatVideos: '视频',
  photosAlbumStatCreated: '创建于',
  photosAlbumDelete: '删除相册',
  photosAlbumDeleteHint: '照片会保留在图库中',
  photosAlbumDeleteTitle: '删除「{name}」?',
  photosAlbumDeleteBody: '只删除相册本身,其中 {count} 张照片仍保留在图库中。',
  // The target keeps the select bar's copy and the tile
  // tooltip's copy deliberately distinct -- only the tooltip mentions "★ to set cover"
  // (33b05636 PhotosAlbumDetail.vue:330 vs :799-800). photosAlbumHintSelectDrag is the bar's
  // manual-sort branch; the plain-sort branch reuses photosSvClickToSelect, which already
  // carries the target's "Click to select" verbatim and is what the smart-view bar uses.
  // Value from zh_CN.json:2011 (「拖动排序」 -- the two *Cover keys below said 「拖拽排序」,
  // corrected here in the same pass so one page does not show both words).
  photosAlbumHintSelectDrag: '点击选择 · 拖动排序',
  photosAlbumHintSelectDragCover: '点击选择 · 拖动排序 · ★ 设为封面',
  photosAlbumHintSelectCover: '点击选择 · ★ 设为封面',
  photosAlbumRemoveFrom: '从相册移除',
  photosAlbumAddPhotos: '添加照片',
  photosAlbumSortManual: '手动排序',
  photosAlbumSortTaken: '拍摄日期',
  photosAlbumSortAdded: '添加日期',
  // The detail-page skeleton shared with the smart-view detail page.
  // photosDetailItems/photosDetailVideos are the lowercase header-stats words that follow a
  // bold number ("12 items"), not the sidebar stat-cell captions (photosMoPhotos /
  // photosAlbumStatVideos) -- the English differs in case, so they are separate keys.
  photosDetailCreatedAt: '创建于 {date}',
  photosDetailItems: '项',
  photosDetailVideos: '视频',
  // About section's "Time span" row label. Distinct from photosMoTime (moment detail's
  // own About row calls its third field "Time", a different label for a different thing).
  photosDetailTimeSpan: '时间跨度',
  photosAlbumCurrentCover: '当前封面',
  photosAlbumSetCover: '设为相册封面',
  photosAlbumEmptyTitle: '相册是空的',
  photosAlbumEmptyHint: '点「添加照片」从图库中挑选。',
  // New-UI addition (Vue2 has no standalone detail route, so this situation can't occur there):
  // deep-linking / refreshing into an album id that doesn't exist.
  photosAlbumNotFoundTitle: '相册不存在',
  photosAlbumNotFoundHint: '它可能已被删除,或链接有误。',
  photosAlbumRenamedToast: '相册已重命名',
  photosAlbumRenameFailed: '重命名失败',
  photosAlbumDeletedToast: '相册已删除:{name}',
  photosAlbumDeleteFailed: '删除失败',
  photosAlbumCoverUpdatedToast: '封面已更新',
  photosAlbumCoverFailed: '封面更新失败',
  photosAlbumOrderFailed: '排序保存失败',
  photosAlbumRemovedToast: '已从相册移除 {count} 项',
  photosAlbumRemoveFailed: '移除失败',
  // ── Albums: Library picker (add photos) ──
  photosAlbumPickerTitle: '添加照片到「{name}」',
  photosAlbumPickerEmpty: '没有可添加的照片。',
  photosAlbumPickerAlready: '已在相册中',
  photosAlbumPickerAdding: '添加中…',
  photosAlbumPickerAdd: '添加({count})',
  photosAlbumPickerDiscard: '还有未保存的选择,确定关闭吗?',
  photosAlbumPickerDiscardConfirm: '确定',
  photosAlbumAddedToast: '已添加 {count} 项到「{name}」',
  photosAlbumAddFailed: '添加失败',
  // ── Albums: Album picker (add to album) ──
  photosAddToAlbum: '加入相册',
  photosAddToAlbumTitle: '加入相册',
  photosAddToAlbumEmpty: '还没有相册,先新建一个。',
  photosAddToAlbumNew: '+ 新建相册',
  // ── Albums: Favorites view - Save as Album ──
  // Vue2 PhotosFavoritesView.vue reuses the exact same $t('Save as Album') string for both the
  // hero button (:22) and the modal header title (:282) -- aligned to Vue2's value
  // (zh_CN.json:2269) and reused for both here too (the previous separate
  // photosFavSaveAlbumTitle key, whose value didn't match, is retired rather than kept
  // alongside a now-matching key).
  photosFavSaveAlbum: '保存为相册',
  photosFavSaveAlbumDefault: '收藏 · {year}',
  // Vue2 :291's input placeholder -- a literal hardcoded string (not templated with the
  // current year, unlike the pre-filled default value above), transcribed verbatim.
  photosFavSaveAlbumPlaceholder: '如 收藏 · 2026',
  // Adds Vue2 PhotosFavoritesView.vue:267-268/279-281's subtitle + footnote (missing from the
  // original key list). Chinese values taken from the Vue 2 panel's
  // src/assets/lang/zh_CN.json:2187/2231.
  photosFavSaveAlbumSub: '将 {count} 张收藏的照片快照保存为新相册',
  photosFavSavedToast: '「{name}」已保存 · {count} 张照片',
  photosFavSaveFailed: '保存失败',
  photosFavSaveAlbumNote: '相册会成为静态快照 —— 收藏新照片时不会自动更新。你可以随时再新建一个。',
  // ── Albums: People. Chinese values are taken verbatim from the Vue 2 panel's
  // src/assets/lang/zh_CN.json, looked up by the matching English source string used as the
  // key. Terminology: Unnamed clusters -> "未命名人物", avoiding "簇/聚类" (the few lines marked
  // [聚类→人物] below were rewritten under this rule; the originally looked-up translation
  // contained "聚类").
  photosPeople: '人物',
  // PhotosTopbar's `sub` line, for this page's index route. Vue2
  // PhotosPeopleTopbar.vue:37's index-state subtitle is "Face clusters · {named} named ·
  // {unnamed} unnamed"; only the count clause is kept here, deliberately dropping the
  // "Face clusters ·" prefix — not a missed transcription.
  photosPeopleTopbarSub: '{named} 个已命名 · {unnamed} 个未命名',
  photosPeopleNamed: '{n} 个已命名',
  photosPeopleUnnamedClusters: '{n} 个未命名人物', // [clusters→people] rewritten; the originally looked-up translation was "{n} 个未命名聚类"
  photosPeopleIndexedUpTo: '人脸索引更新至 {date}',
  // 2026-08-19 timeline/people-visibility fix: photosPeopleConfidence /
  // photosPeopleConfidenceOption / photosPeopleClusters deleted here — the confidence dropdown
  // they belonged to is gone (see peopleView.ts's file header; a fixed 80% confidence default
  // silently hid a real 221-photo cluster). Verified zero remaining references before removal.
  photosPeopleFilterAll: '全部',
  photosPeopleFilterFamily: '家人',
  photosPeopleFilterFriends: '朋友',
  photosPeopleFilterWork: '工作',
  photosPeopleFilterRecent: '最近',
  // Vue2 splits this into $t('Sort:') + $t(label); New-UI composes a single key, zh reuses the "排序：" translation concatenated with the label.
  photosPeopleSort: '排序： {label}',
  photosPeopleSortFreq: '频率',
  photosPeopleSortFreqHint: '按拍摄次数排序（最多在前）',
  photosPeopleSortName: '名称（A–Z）',
  photosPeopleSortNameHint: '按字母顺序',
  photosPeopleSortRecent: '最近',
  photosPeopleSortRecentHint: '最近出现在前',
  photosPeopleSortOldest: '最早出现',
  photosPeopleSortOldestHint: '最早出现在前',
  photosPeopleFacesOffTitle: '人脸识别已关闭',
  photosPeopleFacesOffBody: '已有人物仍会显示，但不再检测新的人脸。可在以下位置重新开启',
  photosPeopleFacesOffLink: '设置 · AI 行为',
  photosPeopleMlOfflineTitle: 'Photos AI 后端离线',
  photosPeopleMlOfflineBody: '人脸识别与智能搜索暂时暂停，直到 Photos AI 服务启动完成或恢复可用。现有人物仍会显示。',
  // Terminology rule: "集群"/"簇/聚类" (cluster) are engineering jargon and are avoided in
  // user-facing copy, rewritten as "两组人脸/已合并到" ("two groups of faces" / "merged into").
  // 2026-08-20 people-confirm-polish: the old whole-cluster merge-suggestion banner
  // (photosPeopleMergeFound/photosPeopleMergeReview/photosPeopleMergeDismissAll) was removed
  // along with MergeReviewDialog. The two reason keys below stay — mergeReasonKey (peopleView.ts)
  // itself wasn't deleted (a pure, already-tested helper a future merge-cards feature would
  // likely reuse), just its only current caller.
  photosPeopleMergeReasonNamed: '两组人脸高度相似（{pct}%），可能都是 {name}。',
  photosPeopleMergeReasonUnnamed: '两组人脸高度相似（{pct}%），可能是同一个人。',
  photosPeoplePinned: '置顶',
  photosPeoplePinnedHint: '你收藏的人物',
  photosPeopleNamedSection: '已命名',
  photosPeopleNamedHint: '{n} 个，按频率排序',
  photosPeopleUnnamedSection: '未命名人物', // term rule applied directly, not looked up (the table has "未命名聚类")
  photosPeopleUnnamedHint: '{n} 个人物 · 点击命名、合并或删除', // [clusters→people]
  // 2026-08-19 timeline/people-visibility fix, product decision: the singleton
  // toggle (photosPeopleHideSingle/photosPeopleShowSingle) and the fold expander
  // (photosPeopleShowMoreClusters/photosPeopleCollapseClusters) are both deleted — the unnamed
  // grid now shows ONLY the distribution split's `visible` head, with no way to reach singleton
  // or folded clusters from this page. Verified zero remaining references before removal.
  photosPeopleHide: '隐藏',
  photosPeopleShow: '显示',
  photosPeoplePhotosCount: '{n} 张照片',
  // New-UI addition (no Vue2 source): the unnamed-person menu's detail-page entry, plus the
  // detail page hero's fallback title when the person has no name yet. Vue2's unnamed people
  // can't reach the detail page at all, so neither needed copy there.
  photosPersonViewPhotos: '查看这些照片',
  photosPersonUnnamedTitle: '未命名人物',
  photosPersonNameThis: '为这个人命名…',
  photosPersonMergeExisting: '合并到已有人物…',
  photosPersonDeleteCluster: '删除这个人物', // terminology rule: originally looked up as "删除集群"; "集群" (cluster) rewritten out
  photosPersonNameTitle: '为这个人命名',
  photosPersonNamePlaceholder: '如 Sara / Lily / 老松',
  photosPersonNameHint: '命名后 Nimo 会把 {n} 张照片中包含这张脸的都归到这个人名下，以后新导入也会自动识别。',
  photosPersonSaveName: '保存名字',
  photosPersonNamedToast: '「{name}」已添加 · {count} 张照片',
  photosPersonMergeTitle: '合并到已有人物',
  photosPersonMergeSearch: '搜索现有人物…',
  photosPersonNoMatch: '没有匹配的人物',
  photosPersonMergedToast: '已合并到「{name}」', // terminology rule: originally looked up as "集群已合并到…"; "集群" (cluster) removed
  photosPersonMergeFailed: '合并失败', // ★ New-UI addition, Chinese value given directly
  photosPersonDeleteTitle: '删除这个人物分组？',
  photosPersonDeleteBody: '照片会保留。人物分组与识别记录将被永久删除。你可以在 5 秒内撤销。',
  photosPersonConfirmDelete: '确认删除',
  photosPersonDeletedToast: '{label} 已删除',
  photosPersonUndo: '撤销',
  // 2026-08-20 people-confirm-polish: MergeReviewDialog.vue is deleted; the keys that existed
  // solely for it (photosPersonMergeSuggestTitle/photosPersonNotAMatch/photosPersonMergeAs/
  // photosPersonMergeGroupA/B/photosPersonMergeNimoLead/photosPersonMergeDismissedToast) are
  // removed with it (checked one by one: no remaining references elsewhere).
  // photosPersonMergeSuggestConfidence stays — still used by ClusterActionDialog.vue.
  // photosPersonMergeAsSame stays — still reused by PhotosPeople.vue/PhotosPersonDetail.vue's
  // merge-success toasts.
  photosPersonMergeSuggestConfidence: '置信度 {n}%',
  photosPersonMergeAsSame: '同一个人',
  // photosPersonSubtitle ("Person detail · faces & relations") is revived. It was previously
  // deleted on the grounds that the detail page's topbar was AreaShell at the time (title only,
  // hidden entirely on desktop), so Vue2 PhotosPeopleTopbar.vue:36's detail-state subtitle had
  // nowhere to live. The detail page was later re-shelled onto PhotosTopbar (title/sub/back
  // props), which is exactly that detail-state slot — this key is genuinely needed again now.
  // Don't confuse it with
  // photosPeopleNamed / photosPeopleUnnamedClusters — those two come from Vue2's own **banner**
  // (PhotosPeopleView.vue:7-9), landing in the People index page's .people-sub, unrelated to
  // this topbar subtitle.
  photosPersonSubtitle: '人物详情 · 面孔与关系',
  photosPersonTabTimeline: '时间线',
  photosPersonTabPlaces: '地点',
  photosPersonTabRelations: '关系',
  photosPersonStatPhotos: '照片',
  photosPersonStatPlaces: '地点',
  photosPersonStatAppearsWith: '共同出现',
  photosPersonStatFirstSeen: '最早出现',
  photosPersonMakeAlbum: '制作相册',
  photosPersonBackground: '背景',
  // The hero's three buttons filled in (Vue2 PhotosPersonDetail.vue:89-91). The
  // click here is a no-op for now (wiring comes later); this only adds copy and visuals first.
  photosPersonAskAbout: '问 Nimo 关于 {name}',
  // ★ New-UI addition: Vue2 :33's button is literally the generic $t('Edit') (the copy on the
  // pill trigger button itself, not the three menu items below it). This repo's existing "Edit"
  // keys (photosAlbumEdit/topbarEdit, etc.) are each bound to a different specific context
  // (album-grid edit mode / desktop edit mode), not "open this person's rename/merge/delete
  // menu" — reusing one would tie this to unrelated changes to those keys, so a dedicated
  // person-scoped key is used instead.
  photosPersonEdit: '编辑',
  photosPersonRename: '重命名人物',
  photosPersonMergeInto: '合并到另一个人物',
  photosPersonDelete: '删除人物',
  photosPersonRelationNone: '未分组',
  photosPersonRelationFamily: '家人',
  photosPersonRelationFriend: '朋友',
  photosPersonRelationWork: '工作',
  photosPersonSameFrame: '同框出现',
  photosPersonSelect: '选择',
  photosPersonDeselect: '取消选择',
  photosPersonNotThePerson: '不是这个人',
  photosPersonSetKeyPhoto: '设为关键照片',
  photosPersonRemoveFrom: '从 {name} 中移除',
  photosPersonKeyPhotoToast: '关键照片已更新',
  photosPersonKeyPhotoNoFace: '那张照片中没有这个人的脸',
  photosPersonKeyPhotoFailed: '设置关键照片失败',
  // Vue2 :884-897 has separate singular/plural copy; all 4 strings are added (the earlier plural-only generic pair is removed).
  photosPersonDetachTitleOne: '不是 {name}？',
  photosPersonDetachTitleMany: '从 {name} 中移除这 {n} 张照片？',
  photosPersonDetachHintOne: '这张照片里的脸将从 {name} 中移除，不会再出现在这个人下。',
  photosPersonDetachHintMany: '这 {n} 张照片里的脸将从 {name} 中移除，不会再出现在这个人下。',
  photosPersonDetachConfirm: '移除',
  photosPersonThisPerson: '这个人',
  photosPersonHeroTitle: '选择背景',
  photosPersonUseKeyPhoto: '使用关键照片',
  photosPersonSaveHero: '保存',
  photosPersonHeroSavedToast: '背景已更新',
  photosPersonHeroFailed: '更新背景失败',
  // The English source string `Rename failed` **does** have a corresponding translation in
  // the old repo's zh_CN.json ("重命名失败"); the ★ (= authored here) marker was wrong. Reverted
  // to the source translation instead of the previously authored "改名失败".
  photosPersonRenamedFailed: '重命名失败',
  photosPersonAlbumCreatedToast: '已创建相册 · {name}', // ★
  // Same as above -- `Could not create album` has an existing translation in zh_CN.json
  // ("相册创建失败"); the ★ marker was wrong, reverted to the source translation (previously
  // authored as "无法创建相册").
  photosPersonAlbumFailed: '相册创建失败',
  // ── ★-marker re-check ─────────────────────────────────────────────────────
  // The keys below marked ★ mean "no such copy in Vue2, authored here" (convention noted at
  // :788 / :813). Re-checked every one of them against the old repo's zh_CN.json: the English
  // source sentences genuinely do not exist there (`Could not update group` / `Could not
  // update favorite` / `No photos for this person yet` / `Person not found` / `Back to
  // people` / `No people yet` / `Nimo groups faces…` / `Show all {n}` / `Show less` -- none of
  // these turned up a match), so ★ is accurate for them and the values follow the established
  // terminology convention. Only photosPersonRenamedFailed / photosPersonAlbumFailed above did
  // turn up an existing translation and have been reverted to it (see above).
  // The ★ that used to sit on `photosPersonNotFound`/`photosPersonBack` below has gone stale —
  // Vue2 commit 03245590 later added matching copy for both (`Person not found` / `Back to
  // People`, PhotosPersonDetail.vue:471/473), so they are no longer "no Vue2 copy, authored
  // here." ★ removed from both.
  photosPersonRelationFailed: '无法更新分组', // ★
  photosPersonFavFailed: '无法更新收藏', // ★
  photosPersonNoPhotos: '这个人还没有照片', // ★
  photosPersonNotFound: '找不到这个人物',
  photosPersonBack: '返回人物',
  photosPeopleEmptyTitle: '还没有识别出人物', // ★
  // Replaces the old single `photosPeopleEmptyHint` — Vue2's later patch (commit 03245590,
  // PR #137) splits into two copy branches (face recognition on/off); translation taken from
  // that commit's own zh_CN.json translation.
  photosPeopleEmptyHintFaces: '照片索引过程中会自动识别人脸，人物很快会出现在这里。',
  photosPeopleEmptyHintNoFaces: '开启人脸识别后，即可在照片中发现人物。',
  photosPersonShowAll: '查看全部 {n} 张', // ★
  photosPersonShowLess: '收起', // ★
  photosPersonPlacesLegend: '常去地点',
  photosPersonNoPlaces: '暂无 {name} 的位置数据',
  photosPersonNimoRead: 'Nimo 的解读',
  // The rel-insight-card's bottom "Dig deeper" button (Vue2
  // PhotosPersonDetail.vue:228-230 `.nimo-btn`). The click is a no-op for now (wiring comes later).
  photosPersonDigDeeper: '深挖',
  photosPersonInsightWith: '{name} 最常与 <b>{other}</b> 一起出现。',
  photosPersonInsightWithUnnamed: '{name} 与一位未命名的人一起出现。',
  photosPersonInsightPlaces2: '他们的照片集中在 <b>{place1}</b> 和 <b>{place2}</b>。',
  photosPersonInsightPlace1: '他们的照片集中在 <b>{place}</b>。',
  photosPersonInsightNone: '{name} 的照片还不够多，暂无法生成洞察。',
  photosPersonUnknownPlace: '未知', // no bare "Unknown" entry in zh_CN.json; following this file's existing "Unknown date"→"未知日期" convention, uses "未知"
  // One UI string missed earlier; wording taken from zh_CN.json (:2079). Appended at the end
  // of the block, existing keys not reordered. photosPeopleMinScore (the confidence dropdown
  // header) was removed alongside the confidence dropdown, see peopleView.ts's file header.
  photosPeopleClusterHint: '+ 命名 / 合并 / 删除', // unnamed cluster hover hint, Vue2 :204
  // <label> for ClusterActionDialog's name mode, source zh_CN.json:49 "Name": "名称". Appended
  // at the end of the block, existing keys not reordered.
  photosPersonNameLabel: '名称',
  // Delete mode's header-title slot, corresponding to Vue2 PhotosPeopleView.vue:262
  // $t('Delete face cluster') (distinct from the warning box's own title line,
  // photosPersonDeleteTitle -- two different sentences, cannot share one key). zh_CN.json:2006's
  // original translation is "删除面部集群", but "集群" (cluster) violates the terminology rule
  // (already cleared out in several other places), so this uses "删除这组人脸" instead.
  photosPersonDeleteClusterTitle: '删除这组人脸',
  // The places tab's section title belongs to the tab component itself (Vue2
  // PhotosPersonDetail.vue :156-162 sits inside v-if="tab==='map'", it's part of that tab; the
  // relationships tab is the same, each tab owns its own section title). Translation taken from
  // zh_CN.json :2138 (Places with {name}) and :2233 (Where you've photographed them, all-time).
  // Appended at the end of the block, existing keys not reordered.
  photosPersonPlacesTitle: '{name} 去过的地方',
  photosPersonPlacesSub: '你在此人所有照片中拍摄过的地点',
  // The relationships tab's own section title / legend / co-appearance count phrase
  // (translation taken from zh_CN.json :2148 Relationship graph / :2019 Edge thickness.../
  // :2039 Frequent (200+) / :2120 Occasional / :1996 Co-appearance / :2114 {n} photos
  // together). The insight-sentence keys (photosPersonInsightWith etc.) already exist above
  // (:895-900); these are just the graph area's own copy. Appended at the end of the block,
  // existing keys not reordered.
  photosPersonGraphTitle: '关系图谱',
  photosPersonGraphSub: '连线粗细 = 共同出现次数',
  photosPersonGraphLegendFrequent: '频繁 (200+)',
  photosPersonGraphLegendOccasional: '偶尔',
  photosPersonCoappearTitle: '共同出现',
  photosPersonPhotosTogether: '共同出现 {n} 张照片',
  // Vue2's later patch (commit 03245590) added the relation-graph empty state; translation
  // taken from that commit's own zh_CN.json translation.
  photosPersonRelGraphEmptyTitle: '暂无同框记录',
  photosPersonRelGraphEmptySub: '当这个人与其他人同框出现在照片里时，关系图会显示在这里。',
  // Container + six dialogs: copy that the original key list did not cover and that a
  // line-by-line pass over Vue2 PhotosPersonDetail.vue showed was genuinely missing here (line
  // numbers noted per key). Translations are all looked up from the old repo's zh_CN.json by
  // the matching English source string; where none exists, values follow the established
  // terminology convention. Appended at the end of the block, existing keys not reordered.
  photosPersonSameFrameSub: '与 {name} 同框出现的人', // Vue2 :112
  photosPersonRenameHint: '这个名字会在这张脸出现的所有地方生效。', // Vue2 :776
  photosPersonAlbumHint: '{n} 张照片将被加入这个相册。', // Vue2 :861
  photosPersonAlbumNameFallback: '人物 {id}', // Vue2 :855
  photosPersonNoPhotosTitle: '暂无可用照片', // Vue2 :847
  photosPersonNoPhotosAlbumHint: '这个人还没有可加入相册的照片。', // Vue2 :848
  photosPersonHeroSub: '选择一张照片作为背景大图', // Vue2 :339
  photosPersonMergeIntoSub: '所有照片都会转移到目标人物', // Vue2 :388
  // The source translation is `Merge into {name}` → "合并到 {name}" (zh_CN.json); the authored
  // version had extra 「」 brackets — reverted to the source translation.
  photosPersonMergeConfirm: '合并到 {name}', // Vue2 :428(选中态)
  // The source translation is `Select a person` → "选择一个人物" (zh_CN.json); the authored
  // version added an extra "请" ("please").
  photosPersonMergeSelectPrompt: '选择一个人物', // Vue2 :428(未选中态)
  // Vue2 :962 $t('Unnamed person') -- the placeholder label for an unnamed person in the delete
  // toast. Shares the same words "未命名人物" as photosPeopleUnnamedSection, but that one is a
  // section title with different semantics, so they don't share a key.
  photosPersonUnnamedLabel: '未命名人物',
  // Deviation from Vue2: :943's detach failure only console.error's (no user-visible feedback); a toast is added here.
  photosPersonDetachFailed: '移除失败',
  // The initial assumption was that Vue2's four toasts collapse into two; checking the source
  // shows the two entry points each own a distinct pair with genuinely different meaning --
  // onUseKeyPhoto (:681,683) is "reset back to the key photo", onSaveHero (:694,696) is "switch
  // to the picked photo". Kept as two separate pairs, not merged.
  photosPersonHeroResetToast: '背景已重置为关键照片', // Vue2 :681
  photosPersonHeroResetFailed: '重置背景失败', // Vue2 :683
  // A load failure must be distinguishable from "no such person" — that is exactly what the
  // `failed` flag is for (Vue2 only console.error's, so its view can't tell them apart). A
  // retry affordance is added too — an earlier phase left a similarly-shaped gap (detail page
  // load failure → permanent skeleton, no error state, no retry) that isn't repeated here.
  photosPersonLoadFailed: '无法加载这个人物',
  // The load-failed/person-not-found fallback states were each missing a description line —
  // Vue2's later patch (commit 03245590) added them; translation taken from that commit's own
  // zh_CN.json translation.
  photosPersonLoadFailedHint: '请检查网络连接后重试。',
  photosPersonNotFoundHint: '该人物可能已被删除或合并。',
  photosPersonRetry: '重试',
  // The detail page's delete-confirm dialog heading. Vue2 :304 is `Delete person?`, a different
  // sentence from the in-warning-box photosPersonDeleteTitle (`Delete this person group?` /
  // "删除这个人物分组?") -- ClusterActionDialog.vue:66's comment already documented these as
  // non-shareable; the original implementation wrongly reused the latter. Translation taken
  // from the old repo's zh_CN.json:2009.
  photosPersonDeletePersonTitle: '删除人物？',
  // Vue2 :310-312 renders the body as two sentences in two greys. The existing
  // photosPersonDeleteBody merges them into one string and is already consumed by
  // ClusterActionDialog.vue:230, so it must not change — these two keys are the same text
  // split in two for the detail page's two-tone rendering.
  photosPersonDeleteKeptBody: '照片会保留。人物分组与识别记录将被永久删除。',
  photosPersonDeleteUndoHint: '你可以在 5 秒内撤销。',
  // ── Photos: Favorites hero-stats three cards -- values taken from the old repo's
  // zh_CN.json:1986/2045/2099/2119/2210/2211.
  photosFavStatTopPerson: '出镜最多的人',
  photosFavStatTopPlace: '去得最多的地方',
  photosFavStatByYear: '按年份',
  photosFavStatInYear: '于 {year} 年',
  photosFavStatYearsTotal: '共 {n} 年',
  photosFavNoFaces: '暂无人脸',
  // ── Place-filter dropdown -- Vue2 PhotosFavoritesView.vue:412-416/353-360. ──
  photosFavFilterPlaces: '地点',
  photosFavFilterClear: '清除筛选',
  // ── The "All" chip + People/Years dropdowns -- values taken from the old repo's
  // zh_CN.json:761/2226/2337.
  photosFavFilterAll: '全部',
  photosFavFilterPeople: '人物',
  photosFavFilterYears: '年份',
  // Vue2 :198-202's Sort/Recent/Oldest segmented toggle -- old repo's zh_CN.json:2294/2250/2219.
  photosFavSort: '排序',
  photosFavSortRecent: '最近',
  photosFavSortOldest: '最早',
  // ── Short copy on the hero ──────────────────────────────────────────────────
  // Vue2 :38/:41's Edit dropdown uses **short verbs** (`Rename` / `Merge into…`); the original
  // implementation reused photosPersonRename / photosPersonMergeInto -- those two keys double
  // as the dialogs' <h*> titles ("重命名人物" / "合并到另一个人物"), read like full sentences, and
  // the 24-char English at 12.5px overflows the 170px-min-width menu.
  // Translation taken from the old repo's zh_CN.json: `Rename`→"重命名", `Merge into…`→"合并到…".
  photosPersonMenuRename: '重命名',
  photosPersonMenuMergeInto: '合并到…',
  // Vue2 :26's un-favorited title is `Mark as favorite`, not the generic `Favorite`.
  // Translation taken from the old repo's zh_CN.json: `Mark as favorite`→"标记为收藏". The
  // favorited branch reuses the existing photosUnfavorite ("取消收藏"), matching zh_CN.json's
  // `Remove favorite`→"取消收藏".
  photosPersonMarkFavorite: '标记为收藏',
  // ── Places domain (map view) i18n keys ──────────────────────────────────────
  // Translations are all checked against the Vue 2 panel's src/assets/lang/zh_CN.json and
  // corrected to match its actual values.
  photosPlaces: '地点',
  photosPlacesCities: '城市', // actual json value (zh_CN.json:1990), not the earlier draft's "座城市"
  photosPlacesCountries: '国家', // actual json value (:2002), not the earlier draft's "个国家"
  // Places index page's PhotosTopbar `sub` line -- translation taken from zh_CN.json:2518
  // (the Chinese value for the same English key as en_US.json:2442), sourced from Vue2
  // PhotosPlacesTopbar.vue:34.
  photosPlacesTopbarSub: '{cities} 个城市 · {countries} 个国家 · 由 Nimo 建立索引',
  photosPlacesPhotos: '张照片',
  photosPlacesSearchPlaceholder: '搜索城市或国家',
  photosPlacesCityCount: '{n} 个城市', // actual json value (:2084), not the earlier draft's "{n} 座城市"
  photosPlacesPhotoCount: '{n} 张照片', // same wording as the existing photosPeoplePhotosCount but a different semantic domain -- kept as separate keys
  photosPlacesFilters: '筛选',
  photosPlacesTimeRange: '时间范围',
  photosPlacesStartDate: '起始日期',
  photosPlacesEndDate: '结束日期',
  photosPlacesMinPhotos: '最少照片数',
  photosPlacesRegion: '区域',
  // Note: Vue2 has two different Chinese phrasings for the "current trip" concept (this
  // checkbox, mapFilter.currentTripOnly, is "只看当前行程"; the bare label at
  // photosPlacesCurrentTrip below is "本次旅行") -- the UI-parity rule outranks terminology
  // unification, so both are kept as Vue2 has them rather than unified. If product decides to
  // unify the wording, change both together.
  photosPlacesCurrentTripOnly: '只看当前行程',
  photosPlacesFilterReset: '重置',
  photosPlacesFilterDone: '完成',
  photosPlacesAny: '不限',
  photosPlacesAtLeast: '≥ {n}',
  photosPlacesAll: '全部',
  photosPlacesMapTheme: '地图主题',
  photosPlacesMapThemePresets: '预设主题',
  photosPlacesMapThemeCustom: '自定义',
  photosPlacesLandDotColor: '地面点颜色',
  photosPlacesCityLightColor: '城市灯颜色',
  photosPlacesThemeDefault: '默认',
  photosPlacesThemeOcean: '海洋', // json does have this translation; marking it "authored" earlier was a mistake
  photosPlacesThemeSand: '沙滩', // actual json value, not the earlier draft's authored "沙色"
  photosPlacesThemeMono: '单色', // actual json value, not the earlier draft's authored "黑白"
  photosPlacesThemeDescDefault: '紫色点 + 黑色背景',
  photosPlacesThemeDescOcean: '青绿调 + 深色背景',
  photosPlacesThemeDescSand: '暖黄 + 浅调背景',
  photosPlacesThemeDescMono: '黑白灰',
  photosPlacesZoomIn: '放大',
  photosPlacesZoomOut: '缩小',
  photosPlacesResetView: '重置视图', // actual json value, not the earlier draft's "复位视图"
  // The json's original translation is "本次旅行" (used by the legend's fourth group / the
  // hero's current-trip marker / the visit-history pill). This had been mistakenly written as
  // "当前行程" per an earlier terminology draft that wasn't checked against source. The
  // UI-parity rule outranks that terminology draft, so this reverts to the json original.
  // currentTripOnly's "只看当前行程" above is Vue2's own different phrasing for the same
  // concept; the inconsistency is how Vue2 actually is, kept as-is rather than "helpfully"
  // unified.
  photosPlacesCurrentTrip: '本次旅行',
  // Continent labels: zh_CN.json has no Asia/Americas/Europe/Africa/Oceania/Antarctica entry
  // either -- confirmed missing, values authored.
  photosPlacesRegionAsia: '亚洲',
  photosPlacesRegionAmericas: '美洲',
  photosPlacesRegionEurope: '欧洲',
  photosPlacesRegionAfrica: '非洲',
  photosPlacesRegionOceania: '大洋洲',
  photosPlacesRegionAntarctica: '南极洲',
  // The following five have no Vue2 counterpart (New-UI addition), authored:
  photosPlacesEmpty: '还没有带位置信息的照片',
  photosPlacesEmptyHint: '相册会在索引照片时读取 GPS 信息',
  photosPlacesSearchEmpty: '没有匹配「{q}」的城市',
  photosPlacesLoadFailed: '地点加载失败', // follows the precedent set by photosPersonLoadFailed
  photosPlacesRetry: '重试', // this repo's convention is a separate Retry key per domain (see photosPersonRetry/appWidgetRetry etc.), not reused
  // New-UI addition, no Vue2 counterpart: the rail empty state used to always show
  // photosPlacesEmpty even when the full place list is non-empty and only the active filters
  // narrowed it to zero -- misleading users into thinking the index is broken. Added a distinct
  // copy for "empty after filtering" vs. "no location data at all".
  photosPlacesFilterEmpty: '没有符合当前筛选条件的城市',
  // ── Places detail panel i18n keys ──────────────────────────────────────────
  // 42 sourced verbatim from the Vue 2 panel's src/assets/lang/zh_CN.json (verified against
  // source, zero discrepancies); 3 authored (see the inline notes below).
  photosPlacesHomeBase: '常驻地',
  // Note: zh_CN.json's trip/trips keys share the same Chinese translation "次旅行" (Chinese
  // doesn't mark singular/plural) -- kept as two separate keys matching json as-is, not merged.
  photosPlacesTrip: '次旅行',
  photosPlacesTrips: '次旅行',
  photosPlacesSpotsLabel: '地点',
  photosPlacesPhotosShotHere: '张照片拍摄于此',
  photosPlacesSpotsInCity: '{city} 的地点',
  photosPlacesViewAll: '查看全部',
  photosPlacesNimoNoticed: 'Nimo 发现',
  photosPlacesRecentPhotos: '最近的照片',
  photosPlacesSeeAll: '查看全部 {n} 张',
  photosPlacesVisitHistory: '到访记录',
  photosPlacesDays: '{n} 天',
  photosPlacesWith: '与',
  photosPlacesSpotsCount: '{n} 个地点',
  photosPlacesSaveTrip: '保存旅行',
  photosPlacesSaveTripTitle: '将这次旅行保存为相册',
  photosPlacesOpenInLibrary: '在图库中打开',
  photosPlacesSaveAsAlbum: '保存为相册',
  photosPlacesAlbumCreated: '已创建相册「{name}」· {count} 张照片',
  photosPlacesAlbumCreateFailed: '相册创建失败',
  photosPlacesToastOpen: '打开',
  photosPlacesShowWholeCity: '只看整个城市',
  photosPlacesSpotRename: '重命名',
  photosPlacesSpotNamePlaceholder: '地点名称',
  photosPlacesSpotSave: '保存',
  photosPlacesSpotViewInLibrary: '在 Library 中查看这个 spot 的全部照片',
  photosPlacesSpotResetName: '恢复默认名', // authored, no Vue2 counterpart
  photosPlacesSpotRenameFailed: '地点重命名失败', // authored, no Vue2 counterpart
  photosPlacesCoverFailed: '封面更新失败', // authored, no Vue2 counterpart
  photosPlacesCoverSet: '设置主图',
  photosPlacesCoverTitle: '设置 {city} 主图',
  photosPlacesCoverSubtitle: '从 {count} 张照片里选一张作为封面',
  photosPlacesCoverSearchPlaceholder: '搜索场景 / 人 / 标签…',
  photosPlacesCoverNoMatch: '没有匹配"{q}"的照片',
  photosPlacesCoverResetDefault: '恢复默认',
  photosPlacesCoverPageInfo: '{total} 张可选 · 第 {page} / {pages} 页',
  photosPlacesCoverTabRecent: '近期',
  photosPlacesCoverTabTop: '最高分',
  photosPlacesCoverTabFav: '已收藏',
  // Same value as the existing photosPlacesAll (filter panel "All") but a different semantic
  // domain (cover-picker category tab) -- kept as a separate key.
  photosPlacesCoverTabAll: '全部',
  photosPlacesInsightMostPhotographed: '你拍得最多的地方——共 {count} 张。',
  // Original json wraps this in <b>; dropped the tag and made {spot} the interpolation slot
  // instead (<i18n-t> can only open a slot at an interpolation position).
  photosPlacesInsightTopSpot: '{spot} 是主要拍摄点——{count} 张。',
  photosPlacesInsightCompanions: '在这里和 {names} 同框。',
  // Original json is "你的<b>大本营</b>——…"; the bolded static word "大本营" is split into a
  // {base} slot, see photosPlacesInsightHomeBase below.
  photosPlacesInsightHome: '你的{base}——{trips} 次行程共 {count} 张。',
  // Note: this and photosPlacesHomeBase ("常驻地") above are Vue2's two different phrasings for
  // the same concept -- the former is filter/list-context wording, this is the bolded word
  // inside the insight sentence ("大本营"). The UI-parity rule outranks terminology
  // unification, so both are kept as Vue2 has them, not merged.
  photosPlacesInsightHomeBase: '大本营',
  // ---- Smart Views: 107 keys appended after photosPlacesInsightHomeBase ----
  // (the original table listed 115 rows; 8 of them duplicated pre-existing key values and are
  // reused rather than re-added)
  // photosSvAddedThisWeek ("+{n} this week") was SmartViewCard.vue's only consumer. That
  // component was later deleted; grep confirmed zero consumers left, so the key is removed
  // here in both locales.
  // Strip the literal <b>, switch to <i18n-t> named slots (zero v-html). Checked against
  // zh_CN.json's source: both rows bold the whole "interpolation + language-specific word"
  // phrase (`<b>1 张新照片</b>` / `<b>{n} 张新照片</b>` are symmetric) ⇒ both split into a
  // base-sentence key + a bold-phrase key, treated the same way (see SmartViewActivityFeed.vue's
  // own header comment).
  photosSvActOneMatched: '{photo} 已自动添加',
  photosSvActOneMatchedBold: '1 张新照片',
  photosSvActNMatched: '{photo} 已自动添加',
  photosSvActNMatchedBold: '{n} 张新照片',
  // The converted_from_album activity row (reverse of the convertFromAlbum flow). No
  // <b> in Vue2 for either branch, so these are plain text keys -- no split main-clause +
  // bold-phrase pair like the matched rows above.
  photosSvActConvertedFromAlbum: '由相册转换而来',
  photosSvActConvertedFromAlbumN: '由相册转换而来 · 锁定 {n} 张照片',
  photosSvActivity: '活动',
  photosSvAddAnother: '添加另一个…',
  photosSvAllMatches: '全部匹配',
  // <b> only wraps the interpolation {n} ⇒ slot directly, strip the literal <b></b> (zero v-html).
  photosSvThreshHelp: '阈值 {pct}% 时，预计每周新增约 {n} 张照片。',
  photosSvAutoAddMatches: '自动添加新匹配',
  photosSvAutoAddMatchesPhotos: '有新照片匹配时自动加入',
  photosSvAutoAddWhenScore: '匹配分 ≥ 时自动添加',
  photosSvBalanced: '平衡',
  photosSvBalancedHealthyMixCertainty: '均衡 —— 准确率与召回率兼顾。',
  photosSvBestLastMonth: '上月精选',
  photosSvBestPhotosLast30: '最近 30 天的最佳照片',
  photosSvCandidatesThreshold: '在此阈值下的候选',
  photosSvChangeSmartViewName: '修改智能视图名称',
  photosSvConditions: '条件',
  photosSvConditionsSettingsUpdated: '条件或设置已更新',
  // ── Smart album -> regular album conversion (reverse flow) ──
  photosSvConvertToAlbum: '转为普通相册',
  photosSvConvertToAlbumHint: '停止自动更新，固化当前已匹配的照片',
  photosSvConvertToAlbumTitle: '将「{name}」转为普通相册？',
  photosSvConvertToAlbumBody: '停止自动更新，当前 {n} 张照片将固化为普通相册，主题与条件将被移除。',
  photosSvConvertedToAlbum: '已转为普通相册',
  photosSvCopyQuerySv: '将查询复制为新的智能视图',
  // Embedded-mode label for the same submit button that reads photosSvCreateSmartView in
  // standalone mode (Vue2 PhotosSmartAlbumCreate.vue's own hard-coded 'Create Smart Album'
  // string, ported here as a key since this file merges both modes into one component).
  photosSvCreateSmartAlbum: '创建智能相册',
  photosSvCreateSmartView: '创建智能视图',
  photosSvDeleteName: '删除「{name}」？',
  photosSvDescribePlainEnglishConditions: '用自然语言描述——下方会自动推断出条件',
  photosSvDuplicate: '复制',
  photosSvDuplicatedNameOpenCopy: '已复制「{name}」——可在列表中打开新副本',
  photosSvEGSaraTokyo: '例如:Sara · 东京 · 日落',
  photosSvExportedDetail: '已导出为 {detail}',
  photosSvFamilyWeekends: '家庭周末',
  photosSvFamilyWeekendsPark: '在公园度过的家庭周末',
  photosSvExportFile: '文件',
  photosSvIncludeVideos: '包含视频',
  photosSvKeepLive: '保持实时更新',
  photosSvLastUpdate: '最近更新',
  photosSvLastUpdatedTime: '最近更新 {time}',
  // (Vue2 939a7d3a:PhotosAlbumsView.vue's `sourceOptions`, 4th entry -- verbatim from
  // zh_CN.json:1987-1988, not an earlier guess.)
  photosSvLetNimoDraft: '让 Nimo 起稿',
  photosSvLetNimoDraftHint: '你描述主题，交给 AI 填充',
  photosSvLive: '即时生效',
  photosSvLivePreview: '实时预览',
  photosSvLoose: '宽松',
  photosSvLooseExpectSomeFalse: '宽松 —— 可能出现一些误判。',
  photosSvMatchAgainstVideoKeyframes: '匹配视频关键帧',
  photosSvMatchScoreDistribution: '匹配分数分布',
  photosSvMayIncludeFalsePositives: '可能包含误判。',
  photosSvMayMissBorderlineMatches: '可能漏掉边缘匹配。',
  photosSvMedianMatch: '匹配中位数',
  photosSvName: '名称',
  photosSvNew: '新',
  photosSvNewSmartView: '新建智能视图',
  photosSvNimoSuggests: 'Nimo 建议',
  photosSvStartTemplate: '或从模板开始',
  photosSvPause: '暂停',
  photosSvPauseAutoUpdates: '暂停自动更新',
  photosSvPaused: '已暂停',
  photosSvPausedUploadsNotAdded: '已暂停 —— 新上传的照片不会被添加',
  photosSvPetPortraits: '宠物写真',
  photosSvPhotosStayLibrary: '照片仍保留在你的图库中',
  photosSvPhotosCount: '张照片',
  photosSvPreparingZipNPhotos: '正在打包 ZIP —— {n} 张照片',
  photosSvPressEnterAddPick: '按 {enter} 添加。或从上方选择一个建议。',
  photosSvQualityThreshold: '质量阈值',
  photosSvReceiptsInvoicesAmount: '带金额的收据和发票',
  photosSvReceiptsFile: '待归档的收据',
  photosSvRecentlyAdded: '最近添加',
  photosSvRefineSearch: '在搜索中细化',
  photosSvRemoveCondition: '移除条件',
  photosSvRemoveC: '移除：{c}',
  photosSvRename: '重命名',
  photosSvResume: '恢复',
  photosSvResumeAutoUpdates: '恢复自动更新',
  photosSvRunEveryUpload: '每次新上传都运行',
  photosSvSavedSearchKeepsItself: '已保存的搜索会自动保持最新',
  photosSvSettingsSection: '设置', // deviation from Vue2: json['Settings'] = system settings, but here it's the Smart View right-panel section title misusing the global key (a Vue2 copy bug) -- deliberately uses "设置" rather than the source value
  photosSvSharpDogCatPortraits: '清晰的猫狗写真',
  photosSvBadgeSmartView: '智能视图',
  photosSvSmartViewNameDeleted: '智能视图「{name}」已删除',
  photosSvSmartViewCreated: '智能视图已创建',
  photosSvSmartViewRenamed: '智能视图已重命名',
  photosSvSmartViews: '智能视图',
  photosSvSmartViewsAutoUpdate: '智能视图自动更新已关闭',
  // Disabled-option title on the Albums "New album" panel's 4th fill choice when the
  // smartview AI feature is off.
  photosSvSmartViewsOffCreateHint: '智能视图已关闭——请在「设置 · AI 行为」中重新开启后再创建。',
  photosSvStats: '统计',
  photosSvStrict: '严格',
  photosSvStrictOnlyHighestConfidence: '严格 —— 只保留置信度最高的匹配。',
  photosSvSunsetsRoad: '旅途中的日落',
  photosSvSunsetsWhileTravelingNot: '旅行途中而非在家看到的日落',
  photosSvSunsetsSaraOurTokyo: '去年春天在东京和 Sara 一起看的日落',
  photosSvSmartViewRemovedStops: '智能视图会被删除，不再监视新的匹配。图库中的 {n} 张照片不受影响。',
  photosSvTheseSavedSearchesStay: '这些保存的搜索仍会显示，但不会再匹配新内容。可在以下位置重新开启',
  photosSvThisWeek: '本周',
  photosSvTotal: '总计',
  photosSvTypeConditionEG: '输入一个条件，如 scene: sunset',
  photosSvNimoMatch: 'Nimo 应该匹配什么？',
  photosSvCurrentConditionsMatchExactly: '你当前的条件是精确匹配 —— 添加场景/物体/自由文本条件后阈值才会生效。',
  photosSvNNewThisWeek: '本周新增 {n} 个',
  photosSvNPhotosMbMb: '{n} 张照片 · 约 {mb} MB',
  photosSvRelHours: '{n} 小时前',
  photosSvRelMinutes: '{n} 分钟前',
  // photosSvSettingsPending ("设置页尚未迁移") is removed here -- zero references repo-wide.
  // It was the title on the Smart Views list page's AI banner's non-clickable
  // "设置 · AI 行为" <span aria-disabled="true">; once the Settings page was built, that span was
  // replaced with a real <RouterLink to="/photos/settings?section=ai">, so this placeholder
  // title key lost its purpose. Same precedent as the photosPersonSubtitle deletion above.
  // ---- Detail-page shell additions (beyond the 107 keys above) ----
  // New-UI addition: byId(id) can't find this item (hand-edited address bar / stale bookmark).
  // Vue2 has no such branch.
  photosSvNotFound: '找不到这个智能视图',
  // At this stage the search route doesn't exist yet, so "Refine in Search" renders disabled
  // + this title; once the route is wired up, this key and the component's corresponding
  // `disabled` should be removed together (the component's own comment notes the wiring point).
  // The rename-failed toast (Vue2 :512-513 has no catch; New-UI adds one, a deviation from
  // Vue2): follows the established naming/copy of photosAlbumRenameFailed /
  // photosPersonRenamedFailed.
  photosSvRenameFailed: '重命名失败',
  // The pause/resume auto-updates failure toast (store convention: an action that throws
  // must be caught in the view layer and surfaced as a toast; Vue2 has no equivalent path here
  // -- its local paused state never fails, because it never waits on a backend response).
  photosSvUpdateFailed: '更新失败',
  // The delete/duplicate failure toasts (Vue2 has no catch for either; New-UI adds them,
  // following the established naming convention).
  photosSvDeleteFailed: '删除失败',
  photosSvDuplicateFailed: '复制失败',
  // ── Manual asset actions ──
  // Chinese values are Vue2's own zh_CN.json entries for the same English source strings,
  // not fresh translations. Five more strings this screen needs are already in this file
  // under other names and are reused rather than duplicated: photosPersonSelect ('选择'),
  // photosCancel ('取消'), photosSelectedCount ('已选择 {count} 项' — note the parameter is
  // `count`, not `n`), photosAlbumPickerTitle and photosMoAddSelected ('添加所选' — the
  // static label Vue2 :288 hands this screen's picker, not the album pages' counting one).
  // This key had briefly shipped as '加照片', a local shortening nobody asked for. Vue2's own
  // zh_CN.json:2020 says `"Add photos": "添加照片"`, and the neighbouring reused
  // photosAlbumPickerTitle already renders 添加照片到「…」, so the screen contradicted itself
  // as well as the source. Corrected to the Vue2 value; the rule stands that the Chinese here
  // is copied from Vue2, never translated here.
  photosSvAddPhotos: '添加照片',
  photosSvRemoveFromView: '从此视图移除',
  photosSvRemovedNFromView: '已从此视图移除 {n} 张',
  photosSvExcludedN: '已排除（{n}）',
  photosSvAlreadyInView: '已在此视图',
  photosSvPinnedNToView: '已钉住 {n} 张到此视图',
  photosSvRestoreFailed: '恢复失败',
  photosSvRemoveFailed: '移除失败',
  photosSvAddFailed: '添加失败',
  photosSvShow: '显示',
  photosSvHide: '隐藏',
  photosSvRestore: '恢复',
  // ── The smart-view detail header's sort capsule + the edit-mode bar's empty-selection
  // hint. Chinese values are Vue2's own zh_CN.json entries for the same English source strings
  // (:2145 "Match score", :2012 "Click to select"), not fresh translations. Everything else
  // the rebuilt row needs already exists in this file and is reused verbatim rather than
  // duplicated: photosAlbumSort ('排序：'), photosAlbumSortTaken ('拍摄日期'), photosAlbumEdit
  // ('编辑'), photosAlbumDone ('完成'), photosDensityComfortable ('舒适'), photosDensityCompact
  // ('紧凑'), photosSelectedCount, photosSvAddPhotos and photosSvRemoveFromView.
  photosSortScore: '匹配分数',
  photosSvClickToSelect: '点击选择',
  // ---- Search panel (filter bar + popovers), 54 keys, checked one by one against Vue2
  // PhotosSearchView.vue's English keys (zh values taken from Vue2's
  // src/assets/lang/zh_CN.json), appended at the end of the file, not reordered with the
  // existing keys above. Keys with the same meaning as ones already added (Cancel/Close etc.)
  // are not duplicated. ----
  photosSearchAlbums: '相册',
  photosSearchApply: '提交',
  photosSearchAskNimoSearchDifferently: '让 Nimo 换个方式搜索',
  photosSearchClearAll: '清除全部',
  photosSearchDate: '日期',
  photosSearchDescribeReLookingPeople: '描述你要找的内容——人物、地点、场景，或者一整句话。按 ↵ 搜索。',
  photosSearchFileType: '文件类型',
  photosSearchFindPhotos: '查找照片：',
  photosSearchCouldnTFindPhotos: '我没有找到符合所有条件的照片。可以尝试移除一个过滤条件，或者用自然语言描述你要找的内容，我会扩大搜索范围。',
  photosSearchLast30Days: '最近30天',
  photosSearchLast7Days: '最近7天',
  photosSearchLastYear: '去年',
  photosSearchLoading: '正在加载更多…',
  photosSearchResultsCount: '更多结果（{count}）',
  photosSearchNewest: '最新',
  photosSearchNextMonth: '下个月',
  photosSearchNimoUnderstood: 'Nimo 理解为：',
  photosSearchNoActiveFiltersSaves: '没有启用的过滤条件——将保存原始查询。',
  photosSearchNoLocationDataYet: '暂无位置数据',
  photosSearchNoMatches: '没有匹配结果',
  photosSearchNoPeopleDetectedYet: '尚未检测到人物',
  photosSearchNothingHereYet: '暂无内容',
  photosSearchTypeOcr: 'OCR',
  photosSearchOldest: '最早',
  photosSearchOpenInAlbums: '在相册中打开 →',
  photosSearchPeople: '人物',
  photosSearchTokPerson: '人物',
  photosSearchBadgePhoto: '照片',
  photosSearchTypePhotos: '照片',
  photosSearchPlaces: '地点',
  photosSearchPreviousMonth: '上个月',
  photosSearchQuickRange: '快速范围',
  photosSearchRecentSearches: '最近搜索',
  photosSearchClearHistory: '清除',
  photosSearchRecent: '最近：',
  photosSearchRelevance: '相关度',
  photosSearchSaveSmartView: '保存为智能视图',
  photosSearchSaved: '已保存',
  photosSearchSearchPeople: '搜索人物…',
  photosSearchSearchLibrary: '搜索你的资料库',
  photosSearchSearchLabel: '搜索{label}…',
  photosSearchSort: '排序',
  photosSearchSunsets: '日落',
  photosSearchTextMatch: '文本匹配',
  photosSearchYear: '今年',
  photosSearchTokTime: '时间',
  photosSearchToday: '今天',
  photosSearchTopScoreScore: '最高分 {score}',
  photosSearchTokType: '类型',
  photosSearchUnnamed: '未命名',
  photosSearchBadgeVideo: '视频',
  photosSearchTypeVideos: '视频',
  photosSearchCountMatches: '{count} 条匹配',
  photosSearchCountResultsSecondsS: '{count} 条结果 · {seconds}秒',
  photosSearchNameSavedSmartView: '“{name}”已保存为智能视图',
  // PhotosSearchBar's placeholder, a new key appended at the end (not reordered). Sourced
  // from the Vue 2 panel's src/assets/lang/zh_CN.json:2405, the translation for the English
  // source "Search photos, people, places, or describe in a sentence…" (copy is always
  // looked up from source, never translated fresh here).
  photosSearchSearchBarPlaceholder: '搜索照片、人物、地点，或用一句话描述…',
  // ── Albums settings page + deep links + error states ──
  // Chinese copy authority = Vue2's src/assets/lang/zh_CN.json; where json has no matching key
  // (Vue2 PhotosSettings.vue inlines hardcoded English), the key above is annotated "authored"
  // with the Vue2 line number.
  // Not migrated this round: theme toggle, AI entry point, sign out, the whole upload section.
  // Authored (Vue2 PhotosSettings.vue:18 inline "Settings")
  photosSettingsTitle: '设置',
  // photosSettingsSubtitle ('Storage · AI behavior', matching Vue2 PhotosSettings.vue:19's
  // topbar subtitle) is restored. It had previously been deleted on the grounds that
  // AreaShell.vue's `title`-only prop had no slot for a subtitle, but the page was later
  // re-shelled off AreaShell entirely in favor of PhotosTopbar (which DOES take a `sub` prop,
  // same as every other re-shelled Photos view) -- that premise no longer applies, so the key
  // is back and wired via `:sub="t('photosSettingsSubtitle')"`.
  // Ad-hoc (Vue2 PhotosSettings.vue:19 inline "Storage · AI behavior")
  photosSettingsSubtitle: '存储 · AI 行为',
  // Authored (Vue2 PhotosSettings.vue:31 inlines a long English sentence)
  photosSettingsHeroDesc: 'Nimo 在你的 NAS 上做的一切 —— 什么在跑、跑在哪、占多少空间。',
  // Authored (Vue2 PhotosSettings.vue:33 inlines "Storage")
  photosSettingsNavStorage: '存储',
  // Authored (Vue2 PhotosSettings.vue:34 inlines "AI behavior")
  photosSettingsNavAi: 'AI 行为',
  // Authored (Vue2 PhotosSettings.vue:46 inlines "Storage")
  photosSettingsStorage: '存储',
  photosSettingsVolume: '容量',
  photosSettingsFree: '可用',
  photosSettingsUsedOf: '已用，共',
  photosSettingsStorageUnavailable: '存储信息不可用',
  photosSettingsSegPhotos: '照片',
  photosSettingsSegVideos: '视频',
  photosSettingsSegRaw: 'RAW 原片',
  photosSettingsSegThumbs: '缩略图缓存',
  photosSettingsSegAi: 'AI 索引',
  photosSettingsSegOther: '其他数据',
  // Authored (Vue2 PhotosSettings.vue:72 inlines "Free"; the legend's "可用" row, sharing the same meaning as photosSettingsFree across two separate usages)
  photosSettingsSegFree: '可用',
  // Authored (Vue2 PhotosSettings.vue:81 inlines "Recently Deleted retention")
  photosSettingsRetentionLabel: '最近删除保留期',
  // Authored (Vue2 PhotosSettings.vue:82 inlines a long sentence)
  photosSettingsRetentionDesc: '已删除的照片在从 NAS 永久移除前保留多久。',
  // Authored (Vue2 PhotosSettings.vue:87 inlines "{{d}}d", not routed through $t)
  photosSettingsRetentionDay: '{n} 天',
  photosSettingsRetentionFailed: '保存保留期失败',
  photosSettingsRescanLabel: '重扫图库',
  photosSettingsRescanDesc: '立即扫描所有分区，将新增的照片和视频加入图库。',
  photosSettingsRescanNow: '立即重扫',
  photosSettingsRescanning: '重扫中…',
  photosSettingsRescanStarted: '已开始重扫图库',
  photosSettingsScanIntervalLabel: '自动重扫间隔',
  photosSettingsScanIntervalDesc: '每隔多久自动扫描所有分区以发现新媒体。',
  photosSettingsScanIntervalOff: '关闭',
  // Authored (Vue2 PhotosSettings.vue:116 inlines "Thumbnail cache"; the same-named json key
  // "Thumbnail cache" is reused by photosSettingsCacheLabel -- two reference points for the
  // same copy, same value)
  photosSettingsCacheLabel: '缩略图缓存',
  photosSettingsCacheDesc: '已删除照片遗留的过期预览图。使用中的缩略图会保留。',
  photosSettingsClearCache: '清理缓存',
  photosSettingsClearing: '清理中…',
  photosSettingsCleared: '已清理',
  // A concatenation of json's "Cache cleared" + "freed" keys (Vue2 :422 joins two $t fragments
  // and a raw byte count with `·` at runtime); collapsed here into one complete sentence with
  // a {size} placeholder.
  photosSettingsCacheClearedToast: '缓存已清理 · {size} 已释放',
  photosSettingsCacheClearFailed: '清理缓存失败',
  // Authored (Vue2 PhotosSettings.vue:135 inlines "AI behavior")
  photosSettingsAiTitle: 'AI 行为',
  // Authored (Vue2 PhotosSettings.vue:136 inlines "What Nimo does, and where it runs.")
  photosSettingsAiSubtitle: 'Nimo 做什么，以及在哪里跑。',
  // Authored (Vue2 PhotosSettings.vue:145 inlines "Nothing leaves your NAS")
  photosSettingsPrivacyTitle: '数据不出你的 NAS',
  // Authored (Vue2 PhotosSettings.vue:147-149 inlines a long sentence)
  photosSettingsPrivacyBody: '所有推理 —— 人脸、场景、OCR、评分 —— 都在这台 NAS 上运行。不会有任何图片、向量或元数据被发往外部服务。',
  // Authored (Vue2 PhotosSettings.vue:155 inlines "Features")
  photosSettingsFeaturesTitle: '功能',
  // Authored (Vue2 PhotosSettings.vue:156 inlines a long sentence)
  photosSettingsFeaturesDesc: '关掉你不想让 Nimo 计算的项。关掉的功能会停止运行并释放算力。',
  photosSettingsFeatFaces: '人脸识别',
  photosSettingsFeatFacesDesc: '按人物归组照片，并在新上传中识别人脸。',
  photosSettingsFeatScenes: '场景与物体识别',
  photosSettingsFeatScenesDesc: '语义搜索的基础——关闭后新照片将无法按内容搜索。',
  photosSettingsFeatOcr: '图片文字识别（OCR）',
  photosSettingsFeatOcrDesc: '搜索小票、路牌、幻灯片和截图中的文字。',
  photosSettingsFeatSmartview: '智能视图',
  photosSettingsFeatSmartviewDesc: '在侧栏显示智能视图，并持续评估新照片。',
  photosSettingsFeatSaveFailed: 'AI 设置保存失败',
  photosSettingsIndexTitle: 'AI 索引',
  photosSettingsIndexRebuilding: '重建中…',
  photosSettingsIndexLastBuilt: '上次构建于',
  photosSettingsIndexNever: '从未',
  // Authored, but not purely authored: Vue2 PhotosSettings.vue:176 renders
  // `{{indexedPct}}% {{ $t('complete.') }}`, where the number is untranslated and "complete."
  // is a json key (translated "已完成。"). The Chinese word order puts the number after "已完成"
  // rather than a literal "42% 已完成。".
  photosSettingsIndexPct: '已完成 {pct}%。',
  // A concatenation of json's "Covers" + "items. Rebuild after restoring from backup or
  // changing the model." keys (Vue2 :177 concatenates
  // `$t('Covers') + coverageCount + $t('items. Rebuild after…')` at runtime).
  photosSettingsIndexCoverage: '覆盖 {count} 个项目。从备份恢复或更换模型后建议重建。',
  photosSettingsRebuildIndex: '重建索引',
  photosSettingsRebuiltToast: 'AI 索引已重建',
  photosSettingsRebuildFailed: '重建失败',
  photosSettingsRebuildStartFailed: '启动重建失败',
  // Authored (Vue2 PhotosSettings.vue:189 inlines "Re-cluster faces", not routed through $t)
  photosSettingsRecluster: '重新聚类人脸',
  photosSettingsReclusterStarted: '人脸重新聚类已在后台开始',
  photosSettingsReclusterFailed: '启动重新聚类失败',
  photosSettingsAppearance: '外观',
  photosSettingsThemeDark: '深色',
  photosSettingsThemeLight: '浅色',
  // Authored (Vue2 PhotosSettings.vue:196 inlines "Nimo Photos")
  photosSettingsFooterApp: 'Nimo 相册',
  photosSettingsRunningOn: '运行于',
  photosSettingsLibrarySince: '建库于',
  photosDeepLinkPhotoNotFound: '未找到该图片',
  // Authored (New-UI addition, failure state, no Vue2 counterpart)
  photosFavoritesLoadFailed: '收藏加载失败',
  // Authored (New-UI addition, failure state, no Vue2 counterpart)
  photosAlbumLoadFailed: '相册加载失败',
  // Authored (New-UI addition, retry button shared by the two failure states above, no Vue2 counterpart)
  photosRetry: '重试',
  // NimoOS-Photos#54 turned an absent limit on GET /photos/favorites into 500 rather than
  // "everything" — these two keys are new-UI-only pagination copy, no Vue2 equivalent (Vue2
  // never paged this endpoint).
  photosLoadedSubsetHint: '统计基于已加载的前 {n} 项',
  photosLoadMore: '加载更多',
  // ── Moments ──
  photosMoBadge: '时刻',
  photosMoTypeTrip: '行程',
  photosMoTypePets: '宠物',
  photosMoTypeFamily: '家人',
  photosMoTypeTheme: '主题',
  // Same Chinese wording the now-deleted photosSvAddedThisWeek carried (see Minor 6 note in the
  // Smart Views block above) — not a fresh translation.
  photosMoAddedThisWeek: '本周 +{n}',
  photosMoHeroTitle: '时刻 · 为你推荐',
  photosMoHeroDesc: 'Nimo 会自动把你最好的照片聚成时刻 —— 行程、人物，以及值得重温的主题。',
  // The sidebar entry's new label (was "Smart Views"), and the slim settings hint shown when
  // the band is hidden.
  photosMoForYou: '为你推荐',
  photosMoFollowsSmartViewSetting: '「时刻」跟随「智能视图」开关——可在以下位置重新开启',
  // Shown when moments.reorder() fails a drag-drop and reverts to server order.
  photosMoOrderSaveFailed: '排序保存失败',
  // ── Moment detail page (Vue2 899af59b:PhotosMomentDetail.vue) ──
  photosMoBackToAll: '全部时刻',
  photosMoLastUpdated: '最后更新 {time}',
  // New-UI only: Vue 2 received the moment as a prop and could never hit a missing id.
  photosMoNotFound: '找不到这个时刻',
  photosMoAbout: '关于',
  photosMoStats: '统计',
  photosMoType: '类型',
  photosMoTime: '时间',
  photosMoPlace: '地点',
  photosMoByMonth: '按月分布',
  photosMoSpan: '跨度',
  photosMoSpanDays: '{n} 天',
  photosMoLastUpdate: '最后更新',
  photosMoPhotos: '照片',
  photosMoFeatured: '精选',
  // Shown when the moment list itself could not be fetched. Deliberately says nothing about
  // whether the moment exists — we do not know.
  photosMoLoadFailed: '时刻加载失败',
  // ── The two photo grids ──
  photosMoAllPhotos: '全部照片',
  // Same Chinese wording as filesViewerLoading/aiMentionLoading/etc. — not a fresh
  // translation, this repo's existing generic "loading" ellipsis.
  photosMoLoading: '加载中…',
  photosMoNoPhotosYet: '这个时刻还没有照片。',
  // ── Adding photos to the moment / removing them from it ──
  // Every string below is Vue 2's own zh_CN copy, taken verbatim from
  // 899af59b:src/assets/lang/zh_CN.json (:2019/:2020/:2021/:2033/:2045/:2242/:2243 and
  // "Add failed" at :1598) — not retranslated here.
  // The picker's *title* deliberately gets no new key: Vue 2 feeds the very same
  // 'Add photos to {name}' string to the album picker and to the moment picker
  // (899af59b:PhotosMomentDetail.vue:144), and this repo already has it as
  // photosAlbumPickerTitle. Reusing it is what reproduces Vue 2 exactly; a second key holding
  // the identical sentence would not.
  photosMoAddPhotos: '添加照片',
  photosMoAlreadyIn: '已在此时刻中',
  photosMoAddSelected: '添加所选',
  photosMoAddedN: '已添加 {n} 张到此时刻',
  photosMoAddFailed: '添加失败',
  photosMoRemoveFromMoment: '从此时刻中移除',
  photosMoRemovedN: '已从此时刻移除 {n} 张',
  photosMoRemoveFailed: '移除失败',
  // ── Save as album / delete moment ──
  // Six of the proposed keys already exist verbatim elsewhere in this repo and are reused
  // rather than duplicated (see PhotosMomentDetail.vue's file-header notes):
  // photosPlacesToastOpen ('打开'), photosSvPhotosStayLibrary ('照片仍保留在你的图库中'),
  // photosSvDeleteName ('删除「{name}」？'), photosSvDeleteFailed ('删除失败'), photosCancel
  // ('取消'), photosDelete ('删除'). The seven below are the genuinely new ones — all Vue 2's
  // own zh_CN copy, taken verbatim from 899af59b:src/assets/lang/zh_CN.json.
  photosMoSaveAsAlbum: '保存为相册',
  photosMoAlbumCreated: '已创建相册「{name}」· {count} 张照片',
  // Vue 2's own translation (:1960) — not '已存在' as an earlier draft test assumed; a test
  // asserting that substring would be checking a mistranslation, not this feature's real copy.
  photosMoAlbumExists: '已有同名相册',
  photosMoAlbumFailed: '相册创建失败',
  photosMoDeleteMoment: '删除时刻',
  photosMoDeleteBody: '该时刻会被删除。图库中的 {n} 张照片不受影响。',
  photosMoDeleted: '时刻「{name}」已删除',
  // ── Sidebar-head theme toggle button title, matching Vue2 PhotosSidebar.vue:29's
  // $t('Switch to dark theme')/$t('Switch to light theme'). ──
  photosSwitchToDarkTheme: '切换到深色主题',
  photosSwitchToLightTheme: '切换到浅色主题',
  // ── The topbar's collapse-toggle button title, matching Vue2 PhotosTopbar.vue:3's
  // $t('Toggle sidebar'). KVM already has the same copy under kvmToggleSidebar, but that key
  // is namespaced to the KVM area per this repo's per-area-prefix key convention — a new
  // photos-prefixed key here, not a cross-area reuse (not an oversight).
  photosToggleSidebar: '切换侧边栏',
  // ── PhotosTopbar's search-mode back-button title, mapped from Vue2 PhotosTopbar.vue:8's
  // $t('Back (Esc)') — New-UI has no Esc semantics here (the search page is a real route, and
  // Esc is already owned by the unified overlay-dismiss handling), so the copy describes the
  // real destination instead (back to the photo library), not copying the "(Esc)" wording.
  photosSearchBackToLibrary: '返回照片库',
  // ── The Hidden people section + hide action + duplicate-name dupconfirm flow ──
  // Vue2 PhotosPeopleView.vue:228 (section title $t('Hidden people')).
  photosPeopleHiddenSection: '隐藏的人物',
  // Vue2 PhotosPeopleView.vue:279 / PhotosPersonDetail.vue:45 — both menu items are literally the
  // same $t('Hide person'), sharing one key.
  photosPersonMenuHide: '隐藏此人',
  // Both menu items' title copy is literally the same (PhotosPeopleView.vue:274 /
  // PhotosPersonDetail.vue:44):
  // $t('Person leaves the People page. Photos and face recognition are kept — you can unhide anytime.')
  photosPersonHideGateTitle: '此人物会从人物页移除。照片与人脸识别记录都会保留——你可以随时取消隐藏。',
  // Vue2 PhotosPeopleView.vue:249 $t('Unhide').
  photosPeopleUnhide: '取消隐藏',
  // Vue2's hideClusterPerson/hideCurrentPerson success toasts are both literally the same
  // $t('{label} hidden') (PhotosPeopleView.vue:759 / PhotosPersonDetail.vue:923).
  photosPersonHiddenToast: '{label} 已隐藏',
  // Vue2 PhotosPeopleView.vue:317 / PhotosPersonDetail.vue:299 — both dupconfirm dialog titles
  // are literally the same $t('A person named "{name}" already exists.').
  photosPersonDupExistsTitle: '已存在名为「{name}」的人物。',
  // Vue2's two dupconfirm "merge" buttons are literally the same $t('Merge into existing') (no
  // ellipsis — a different sentence from the menu item photosPersonMergeExisting's "…" version,
  // can't be shared).
  photosPersonDupMergeInto: '合并到已有人物',
  // Vue2's two dupconfirm "name anyway" buttons: $t('Name anyway').
  photosPersonDupNameAnyway: '仍然使用这个名字',
  // Plan G (Ask Nimo): FAB label + composer placeholder, Vue2 PhotosAskNimo.vue / PhotosAgentChat.vue.
  photosAskNimo: '问 Nimo',
  photosAskNimoPlaceholder: '问 Nimo…',
  // Canned prompts sent when clicking a hero/relations/lightbox Ask Nimo trigger -- distinct from
  // the button LABEL keys (photosPersonAskAbout etc.), which already existed before this plan.
  photosPersonAskAboutPrompt: '给我看看我最喜欢的 {name} 的照片',
  photosPersonDigDeeperPrompt: '多告诉我一些关于 {name} 的照片',
  photosHandOffToNimoPrompt: '编辑这张照片：{title}',
  photosNimoAgent: 'Nimo 助手',
  photosSelectModel: '选择模型',
  photosGoToSettingsConfigure: '去 Settings 配置 →',
  photosClearConversation: '清空会话',
  photosOpenFullConversation: '在侧边抽屉中打开完整对话',
  photosNimoHideHint: '隐藏——从右侧边缘拖出可恢复',
  photosNimoDragHint: '拖动移动位置 · 点击显示问 Nimo',
  photosBackgroundTasksCount: '{n} 个后台任务',
  photosConfirmAction: '需要确认：{action}',
  photosRequestingAccess: '请求访问：{reason}',
  photosAllow: '同意',
  photosDeny: '拒绝',
  photosAllowed: '已同意',
  photosDenied: '已拒绝',
  photosConfirmMissingId: '确认请求无效（缺少 confirmId）',
  photosSubmissionFailed: '提交失败：{detail}',
  photosUnknownError: '未知错误',
  photosModelGroupLocalOllama: '本地 · Ollama',
  photosModelGroupCloudDeepSeek: '云 · DeepSeek',
  photosModelGroupCloudOpenAI: '云 · OpenAI',
  photosModelGroupCloudAnthropic: '云 · Anthropic',
  photosModelGroupCloudQwen: '云 · Qwen',
  photosModelGroupOther: '其他',
  photosModelProviderCloudFallback: '云端',
  photosTaskIndexing: '索引照片',
  photosTaskEmbedding: '生成 AI 索引',
  photosTaskOcr: '识别图片文字',
  photosTaskFace: '识别人物',
  photosTaskRebuild: '重建 AI 索引',
  photosTaskAesthetic: '评估照片美学分',
  photosTaskFailed: '已失败',
  photosSuggestLastWeekend: '上周末',
  photosSuggestBestSunsets: '最佳日落',
  photosSuggestFindPeople: '找人物',
  photosGridAskNimoRecap: '从这 {count} 张照片创建一个回顾相册。',
  photosSearchFindPhotosPrefix: '查找照片：',
  // ── 2026-08-20 people-suggestions-ui: the "待确认" suggestion-confirmation section on the
  // People page — per-face join/review suggestions grouped by person, sitting above the
  // named-people area. New-UI-only feature, no Vue2 counterpart to transcribe. ──
  photosPeopleSuggestions: '待确认',
  // 2026-08-21 (people-confirm-polish, Apple-style review wizard): this question used to live
  // on every card's group title in the old grid; the wizard's question line reuses the same
  // key (the wording is unchanged, only where it appears changed).
  photosPeopleSuggestTitle: '这是 {name} 吗?',
  // kind='review' badge: semantically "previously attributed to this person, now in doubt" —
  // visually distinct from a plain new-join ('join') candidate face. The wizard's compare view
  // reuses this same key (the old grid's per-face badge).
  photosPeopleReviewBadge: '复核',
  // 2026-08-21 (people-confirm-polish): the entry card's "Start review" button — opens the
  // full-screen review wizard, one suggestion at a time, across all groups in order.
  photosPeopleStartReview: '开始审阅',
  // Wizard header: label above the reference-faces row under the person's name, paired with
  // exemplarFaceIds (a new optional backend field — an older backend without it makes the
  // wizard fall back to cover-only, and this row never renders).
  photosPeopleReviewReferenceLabel: '参考照片',
  // Original/Compare segmented view-toggle option labels.
  photosPeopleReviewViewOriginal: '原图',
  photosPeopleReviewViewCompare: '对比',
  // Compare view's right-hand candidate-face label.
  photosPeopleReviewCandidateLabel: '候选',
  // Compare view's kind='join' candidate badge (the counterpart of the Review badge above).
  photosPeopleJoinBadge: '新归入',
  // The three decision buttons: Yes / No / Skip. Skip is purely client-side advance -- it
  // never calls the backend.
  photosPeopleReviewYes: '是',
  photosPeopleReviewNo: '不是',
  photosPeopleReviewSkip: '跳过',
  // Progress indicator: "k / N" -- N is pinned at the moment the wizard opens and does not
  // shrink/grow as items get decided or skipped mid-session.
  photosPeopleReviewProgress: '{k} / {n}',
  // Done-state title once every suggestion has been decided or skipped.
  photosPeopleReviewDoneTitle: '全部已处理完成',
  // 2026-08-20 (people-confirm-polish, carried into the wizard): alt text for the face/context
  // photo images and the hover title for "click to view full photo" -- shared by the wizard's
  // default view, compare view, and zoom lightbox.
  photosPeopleSuggestPeekAlt: '查看完整照片',
  // ── Merge cards (2026-08-21): HAC gray-band cluster-merge review questions -- depends on a
  // backend change that has not shipped yet; the endpoint 404s until then. Shares the same
  // review wizard as the other photosPeopleReview* keys above, just queued after the per-face
  // suggestions. ──
  photosPeopleMergeQuestionTitle: '这两组是同一个人吗？',
  // Merge / Different / Skip -- Skip reuses photosPeopleReviewSkip above (purely client-side
  // advance, same semantics in both flows).
  photosPeopleMergeAccept: '合并',
  photosPeopleMergeReject: '不同',
  // Label for the card's "into" side (the person that survives the merge).
  // Merge-card legibility fix (2026-08-21): each side's photo count under the large face-tile
  // grid. Deliberately its own key rather than reusing photosPeoplePhotosCount (many other call
  // sites pass only {n}) -- {s} is the English plural suffix (pluralWord(),
  // src/photos/util/peopleView.ts); Chinese doesn't need a plural marker, and vue-i18n silently
  // replaces an unreferenced {s} with an empty string, so it has no effect on the Chinese copy.
  photosPeopleMergePhotosCount: '{n} 张照片',
  // Distance shown subtly under the question (lower = more similar -- a raw distance, not a
  // percentage, deliberately not reusing mergeConfidencePct's formatting).
  photosPeopleMergeDistLabel: '相似距离 {dist}',
}
