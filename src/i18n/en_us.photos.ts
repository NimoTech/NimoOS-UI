// SP7-P8b:相册区文案分片。
//
// 为什么独立成文件:①SP9 起的分片约定(新键只落分片,免得几条并行线在同一文件上相撞,
// 见 src/i18n/index.ts 的注释)②**更要紧的是开源导出** —— 开源版没有相册区,而给 700 多行
// 文案写锚点补丁会让以后改任何一条相册文案都把导出打红(oss/manifest.mjs 的 PATCH 要求命中
// 恰好 1 次);抽成独立文件后,开源侧只需把这两个分片整体删掉 + 改 index.ts 一行。
//
// 内容是从 en_us.base.ts(即原 en_us.ts)原样搬来的 photos* 前缀键(顺序、注释、行尾标记全部保留),
// 一个字没改 —— 等价性由 __tests__/photosSlice.test.ts 与抽取当时的 JSON 快照逐键比对证明。
export default {
  // ── Photos ──
  photosTitle: 'Photos',
  photosLibrary: 'Photo library',
  photosFavorites: 'Favorites',
  photosTrash: 'Recently Deleted',
  photosStorage: 'Storage',
  photosCountSummary: '{photos} photos · {videos} videos',
  photosTabAll: 'All',
  photosTabPhotos: 'Photos',
  photosTabOcr: 'OCR',
  photosTabVideos: 'Videos',
  photosItemsCount: '{count} items',
  // Owner-acceptance Fix-5: singular sibling of photosItemsCount, matching Vue2's
  // `{{ b.photos.length !== 1 ? $t('items') : $t('item') }}` conditional (currently only
  // consumed by PhotosTrash.vue's bucket subtitle -- the other photosItemsCount call sites
  // are untouched by this fix, out of scope here).
  photosItemSingular: '{count} item',
  photosSelectedCount: '{count} selected',
  photosDelete: 'Delete',
  photosCancel: 'Cancel',
  photosNoPhotos: 'No photos yet',
  photosNoPhotosHint: 'Photos will appear here once indexed',
  photosUnknownDate: 'Unknown Date',
  photosDeletedToast: '{count} item(s) moved to Recently Deleted',
  // Owner-acceptance Fix-3: honest partial-failure toast for the "move to Recently Deleted"
  // flow (PhotosFavorites.vue's onBatchDelete/onLightboxDelete) -- store.deleteAssets already
  // returns the ACTUAL success count (per-id try/catch), this key surfaces it instead of
  // silently reporting the click-time selection size as if every item succeeded. Zero-success
  // reuses the existing photosTrashDeleteFailed "Delete failed" family rather than adding a
  // near-duplicate key (see trash.ts's purge()/PhotosTrash.vue for the sibling permanent-delete
  // flow, which follows the exact same three-way branch).
  photosDeletedPartialToast: '{ok} item(s) moved to Recently Deleted, {fail} failed',
  photosIndexedToast: 'Indexed {n} photos',
  photosTaskCompletedToast: '{label} completed',
  photosDensityCompact: 'Compact',
  photosDensityComfortable: 'Comfortable',
  photosDensityLoose: 'Loose',
  photosLightboxCounter: '{idx} / {total}',
  photosFavorite: 'Favorite',
  photosUnfavorite: 'Unfavorite',
  photosDownload: 'Download',
  photosClose: 'Close',
  // Fix-2 item 1 (owner acceptance, 2026-08-16): photosZoomIn/photosZoomOut/photosRotate/
  // photosReset were only ever used by the now-removed bottom zoom toolbar
  // (PhotoImageViewer.vue's `.img-toolbar`) -- deleted here (both locales) rather than left
  // orphaned, since nothing else in the app consumed them.
  photosPrev: 'Previous',
  photosNext: 'Next',
  photosInfoToggle: 'Info',
  photosLivePhoto: 'LIVE',
  photosDeleteConfirmTitle: 'Delete this item?',
  photosDeleteConfirmBody: 'It will be moved to Recently Deleted — you can restore it from Trash.',
  photosConfirmDelete: 'Delete',
  photosInfoCameraCapture: 'Camera & Capture',
  photosInfoVideo: 'Video',
  photosInfoLocation: 'Location',
  photosInfoPeople: 'People',
  photosInfoNimoSees: 'Nimo sees',
  // Fix-2 item 2 (owner acceptance, 2026-08-16): Vue2's exact label, PhotosLightbox.vue:86
  // `{{ $t('Hand off to Nimo') }}`.
  photosHandOffToNimo: 'Hand off to Nimo',
  photosInfoFile: 'File on NAS',
  photosFieldCamera: 'Camera',
  photosFieldIso: 'ISO',
  photosFieldShutter: 'Shutter',
  photosFieldAperture: 'Aperture',
  photosFieldFocal: 'Focal length',
  photosFieldDimensions: 'Dimensions',
  photosFieldFileSize: 'File size',
  photosFieldDuration: 'Duration',
  photosFieldResolution: 'Resolution',
  photosFieldVideoCodec: 'Video codec',
  photosFieldAudioCodec: 'Audio codec',
  photosFieldFrameRate: 'Frame rate',
  photosFieldBitRate: 'Bit rate',
  photosFieldRotation: 'Rotation',
  photosFieldCoordinates: 'Coordinates',
  photosFieldPlace: 'Place',
  photosCopyPath: 'Copy path',
  photosCopied: 'Copied',
  photosFilterByExif: 'Filter by EXIF',
  photosFilterCamera: 'Camera',
  photosFilterLocation: 'Location',
  photosFilterYear: 'Year',
  // ── Photos: Favorites view ──
  photosFavTitle: 'Favorites',
  photosFavEmptyTitle: 'No favorites yet',
  photosFavEmptyHint: 'Tap ★ on any photo to keep it here. Favorites are pinned forever.',
  photosFavExport: 'Download as ZIP',
  photosFavExporting: 'Preparing download…',
  photosFavCount: '{count} favorites',
  // Task 3 (Plan H) review fix: hero stats sub-line -- Vue2 bolds ONLY the raw
  // number (`<b>{{ photoCount }}</b> {{ $t('photos_count') }}`), the noun sits
  // outside <b>, so these are noun-only keys (not "{n} photos" one-piece
  // strings) matching Vue2 PhotosFavoritesView.vue:11-12's photos_count/videos
  // copy exactly.
  photosFavHeroPhotosNoun: 'photos',
  photosFavHeroVideosNoun: 'videos',
  photosFavHeroKeptForever: 'kept forever',
  // Task 4 (Plan H): pinned-highlights strip (server-ranked top 5, GET /favorites/top) --
  // Vue2 PhotosFavoritesView.vue:89-90.
  photosFavPinnedTitle: 'Pinned highlights',
  photosFavPinnedSub: 'Your most-favorited moments · Nimo curated',
  // Task 5 (Plan H): slideshow -- Vue2 PhotosFavoritesView.vue:18-19 (entry button) /
  // :237-273 (playback overlay: close, prev/next, pause/play, 3 speed presets).
  photosFavSlideshow: 'Slideshow',
  photosFavSlideClose: 'Close (Esc)',
  photosFavSlidePrev: 'Previous (←)',
  photosFavSlideNext: 'Next (→)',
  // Review Minor 4: adds Vue2 :256's play/pause button title (value verbatim from
  // NimoOS-UI/src/assets/lang/en_US.json:2168).
  photosFavSlidePlayPause: 'Play/Pause (Space)',
  photosFavSlideSpeed: 'Speed',
  photosFavSlideFast: 'Fast',
  photosFavSlideNormal: 'Normal',
  photosFavSlideSlow: 'Slow',
  // ── Photos: Trash view ──
  photosTrashTitle: 'Recently Deleted',
  // Fix wave (post-final-review): topbar `sub` was previously left unbound, defaulting to the
  // library-wide photo/video count string. Matches Vue2 PhotosTimeline.vue:231 navMap.trash
  // ('{count} items · auto-deletes in 30 days'), except {days} is dynamic here (ruled: reads
  // the live retention setting instead of Vue2's hardcoded 30).
  photosTrashSubtitle: '{count} items · auto-deletes in {days} days',
  photosTrashEmptyTitle: 'Trash is empty',
  photosTrashEmptyHint: 'Deleted items stay here for {days} days before being permanently removed.',
  photosTrashRestore: 'Restore',
  photosTrashRestoreAll: 'Restore all',
  photosTrashEmpty: 'Empty trash',
  photosTrashDeleteForever: 'Delete forever',
  photosTrashDaysLeft: '{days}d left',
  photosTrashFrom: 'From {source}',
  photosTrashCanFree: 'can be freed',
  photosTrashItems: 'items',
  photosTrashSelectedCount: '{count} selected',
  // Owner-acceptance Fix-5: Vue2 PhotosTrashView.vue template:55 puts a leading label span
  // before the two sort buttons ($t('Sort')) -- this key was missing entirely, so the label
  // span was never rendered (parity's own `.lib-sort-label` rule at photos.scss went unused).
  // Named per-view like the sibling photosFavSort/photosSearchSort/photosAlbumSort keys
  // rather than a single shared "Sort" key (established convention: each view keeps its own
  // copy of this word).
  photosTrashSort: 'Sort',
  photosTrashSortDaysLeft: 'Days left',
  photosTrashSortRecent: 'Recently deleted',
  photosTrashUndo: 'Undo',
  // ── Photos: Bucket titles ──
  photosTrashBucketUrgent: 'Deleting in 1–7 days',
  photosTrashBucketSoon: 'Deleting in 8–14 days',
  photosTrashBucketLater: 'Deleting in 15–21 days',
  photosTrashBucketFresh: 'Deleted recently',
  // Owner-acceptance Fix-5: all four descriptions below were paraphrases, not Vue2's actual
  // copy -- corrected to match Vue2 PhotosTrashView.vue:133-136's BUCKETS `desc` fields
  // verbatim (the owner's screenshot review specifically caught the 'fresh' one showing
  // "Recently deleted items" instead of Vue2's "Auto-deletes after the retention period";
  // the other three had the same kind of drift, caught in the same-view sweep).
  photosTrashBucketUrgentDesc: 'Will be gone soon — recover now if needed',
  photosTrashBucketSoonDesc: 'Heads up — auto-removal coming',
  photosTrashBucketLaterDesc: 'Still plenty of time to restore',
  photosTrashBucketFreshDesc: 'Auto-deletes after the retention period',
  // ── Photos: Confirmation dialogs ──
  photosTrashRestoreAllTitle: 'Restore all {count} item(s)?',
  photosTrashRestoreAllBody: "They'll go back to where they came from and resume appearing in your library, albums and timelines.",
  photosTrashDeleteSelTitle: 'Permanently delete {count} item(s)?',
  photosTrashDeleteSelBody: 'This will be wiped from the NAS immediately. This cannot be undone.',
  photosTrashEmptyTitle2: 'Permanently delete all {count} item(s)?',
  photosTrashEmptyBody: "This frees {size} MB on the NAS. Once gone, the originals can't be recovered.",
  // ── Photos: Toast messages ──
  photosTrashRestoredToast: '{count} item(s) restored to Library',
  photosTrashPurgedToast: '{count} item(s) permanently deleted · {size} MB freed',
  // Owner-acceptance Fix-3: trash.ts's purge() now reports the ACTUAL per-item success count
  // (Promise.allSettled, not the old swallow-and-lie Promise.all) -- this key covers the
  // 0 < success < total case. Freed-size is intentionally omitted here (same reasoning as
  // photosTrashEmptiedToastPartial below: it was only ever a sum over the full requested
  // selection, which overstates it once some of those items never actually got purged).
  photosTrashPurgedPartialToast: 'Permanently deleted {ok} item(s), {fail} failed',
  photosTrashEmptiedToast: 'Trash emptied · {size} MB freed',
  // Task 12 (SP15-P3): while pages remain, the freed-size figure is only computed from the
  // loaded subset — these size-less variants are used instead until trashExhausted.
  photosTrashEmptiedToastPartial: 'Trash emptied',
  photosTrashEmptyBodyPartial: "This frees up space on the NAS. Once gone, the originals can't be recovered.",
  photosTrashRestoreFailed: 'Restore failed',
  photosTrashDeleteFailed: 'Delete failed',
  photosTrashEmptyFailed: 'Empty failed',
  photosFavExportFailed: 'Export failed',
  // ── Photos: Sidebar / List view ──
  photosAlbums: 'Albums',
  photosAlbumsTitle: 'Albums',
  photosAlbumsCount: '{count} albums',
  photosAlbumsMine: 'My Albums',
  photosAlbumsMineHint: 'Albums you created',
  photosAlbumNew: 'New album',
  photosAlbumNewHint: 'Click to create or ask Nimo',
  photosAlbumUntitled: 'Untitled',
  // SP15-P2b Task 3: the mixed grid's section subtitle when both manual and smart albums
  // are empty (939a7d3a:PhotosAlbumsView.vue). Inserted here, next to the rest of the
  // "no albums" copy cluster, rather than by the photosAlbums* family's scattered global
  // order.
  // fix round 1 (Important 3): photosAlbumsEmptyTitle/photosAlbumsEmptyHint, which used to
  // sit right above this key, are deleted (grep-confirmed zero other consumers) -- they
  // backed a standalone empty-state panel that duplicated this subtitle's own "No albums
  // yet" copy once smart albums joined the grid. Vue2 has no such panel either (see the
  // matching PhotosAlbums.vue comment), so removing it is a 1:1 correction, not a feature
  // cut.
  photosAlbumsNoneYetHint: 'No albums yet — create one manually, or let Nimo build a Smart Album that keeps itself updated.',
  photosAlbumSort: 'Sort:',
  photosAlbumSortCreated: 'Recently added',
  photosAlbumSortCreatedHint: 'Newest album first',
  photosAlbumSortName: 'Name (A–Z)',
  photosAlbumSortNameHint: 'Alphabetical',
  photosAlbumSortNameR: 'Name (Z–A)',
  photosAlbumSortNameRHint: 'Reverse alphabetical',
  photosAlbumSortCount: 'Photo count',
  photosAlbumSortCountHint: 'Largest first',
  photosAlbumSortDate: 'Date taken',
  photosAlbumSortDateHint: 'Newest moments first',
  // ── Photos: New album modal ──
  photosAlbumCreateTitle: 'New album',
  photosAlbumCreateSub: 'Give it a name, then decide how to fill it',
  photosAlbumNameLabel: 'Album name',
  photosAlbumNamePlaceholder: 'e.g. Tokyo · Spring',
  photosAlbumFillLabel: 'How to fill it',
  photosAlbumFillEmpty: 'Empty album',
  photosAlbumFillEmptyHint: 'Add photos later by dragging',
  photosAlbumFillRecent: 'Photos from the last 30 days',
  photosAlbumFillRecentHint: 'Automatically fill with everything recent',
  photosAlbumFillSelect: 'Choose photos…',
  photosAlbumFillSelectHint: 'Open Library and pick one by one',
  photosAlbumCreating: 'Creating…',
  photosAlbumCreate: 'Create album',
  photosAlbumCreatedToast: 'Album created: {name}',
  photosAlbumCreateFailed: 'Create failed',
  photosAlbumNameExists: 'An album with this name already exists',
  // ── Photos: Detail view ──
  photosAlbumBack: 'Albums',
  photosAlbumLabel: 'Album',
  photosAlbumClickToRename: 'Click to rename',
  photosAlbumEdit: 'Edit',
  photosAlbumDone: 'Done',
  photosAlbumRenameHint: 'Change the album name',
  photosAlbumConvertToSmart: 'Convert to Smart Album',
  photosAlbumConvertToSmartHint: 'Nimo keeps adding matches automatically',
  // Task 5 (#117 short titles): see zh_cn.photos.ts's comment on this pair -- Rename/Duplicate/
  // Download as ZIP/Delete reuse existing short keys verbatim; only Convert is new.
  photosAlbumMenuConvert: 'Convert',
  // Whole-branch review, Important 2: see zh_cn.photos.ts's comment on this key -- the menu
  // entry's desc is a distinct target string from the convert modal's subtitle above.
  photosAlbumMenuConvertHint: 'Turn into a Smart Album that keeps updating',
  photosAlbumDuplicateHint: 'Copy the photos as a new album',
  // ── Task 7: album -> smart album conversion dialog ──
  photosAlbumConvertSuggestHint: 'Nimo suggests these conditions — final matching is decided when the Smart Album is created',
  photosAlbumConvertLockHint: 'Your {n} photos stay locked in. Nimo will keep adding new matches for this theme.',
  photosAlbumConverting: 'Converting…',
  photosAlbumConvertedToSmart: 'Converted to Smart Album',
  photosAlbumConvertFailed: 'Convert failed',
  photosAlbumStatVideos: 'Videos',
  photosAlbumStatCreated: 'Created',
  photosAlbumDelete: 'Delete album',
  photosAlbumDeleteHint: 'Photos stay in your library',
  photosAlbumDeleteTitle: 'Delete "{name}"?',
  photosAlbumDeleteBody: 'The album wrapper is removed but the {count} items stay in your library.',
  // Whole-branch review, Important 3: see zh_cn.photos.ts -- the select bar's copy is distinct
  // from the tile tooltip's in the target and must not mention the cover shortcut.
  photosAlbumHintSelectDrag: 'Click to select · Drag to reorder',
  photosAlbumHintSelectDragCover: 'Click to select · Drag to reorder · ★ to set cover',
  photosAlbumHintSelectCover: 'Click to select · ★ to set cover',
  photosAlbumRemoveFrom: 'Remove from album',
  photosAlbumAddPhotos: 'Add photos',
  photosAlbumSortManual: 'Manual order',
  photosAlbumSortTaken: 'Date taken',
  photosAlbumSortAdded: 'Date added',
  // SP15-P2c Task 3: the detail-page skeleton shared with the smart-view detail page.
  // photosDetailItems/photosDetailVideos are the lowercase header-stats words that follow a
  // bold number ("12 items"), not the sidebar stat-cell captions (photosMoPhotos /
  // photosAlbumStatVideos) -- the English differs in case, so they are separate keys.
  photosDetailCreatedAt: 'Created {date}',
  photosDetailItems: 'items',
  photosDetailVideos: 'videos',
  // Task 4: About section's "Time span" row label. Distinct from photosMoTime (moment detail's
  // own About row calls its third field "Time", a different label for a different thing).
  photosDetailTimeSpan: 'Time span',
  photosAlbumCurrentCover: 'Current cover',
  photosAlbumSetCover: 'Set as album cover',
  photosAlbumEmptyTitle: 'This album is empty',
  photosAlbumEmptyHint: 'Use "Add photos" to pick from your library.',
  // New-UI addition (Vue2 has no standalone detail route, so this can't occur there):
  // deep-linking / refreshing into an album id that doesn't exist.
  photosAlbumNotFoundTitle: 'Album not found',
  photosAlbumNotFoundHint: 'It may have been deleted, or the link is incorrect.',
  photosAlbumRenamedToast: 'Album renamed',
  photosAlbumRenameFailed: 'Rename failed',
  photosAlbumDeletedToast: 'Album deleted: {name}',
  photosAlbumDeleteFailed: 'Delete failed',
  photosAlbumCoverUpdatedToast: 'Cover updated',
  photosAlbumCoverFailed: 'Failed to update cover',
  photosAlbumOrderFailed: 'Failed to save order',
  photosAlbumRemovedToast: 'Removed {count} from album',
  photosAlbumRemoveFailed: 'Remove failed',
  // ── Photos: Picker (add photos) ──
  photosAlbumPickerTitle: 'Add photos to {name}',
  photosAlbumPickerEmpty: 'No photos available to add.',
  photosAlbumPickerAlready: 'Already in album',
  photosAlbumPickerAdding: 'Adding…',
  photosAlbumPickerAdd: 'Add ({count})',
  photosAlbumPickerDiscard: 'You have unsaved selections. Close anyway?',
  photosAlbumPickerDiscardConfirm: 'OK',
  photosAlbumAddedToast: 'Added {count} to {name}',
  photosAlbumAddFailed: 'Add failed',
  // ── Photos: Album picker (add to album) ──
  photosAddToAlbum: 'Add to album',
  photosAddToAlbumTitle: 'Add to album',
  photosAddToAlbumEmpty: 'No albums yet — create one first.',
  photosAddToAlbumNew: '+ New album',
  // ── Photos: Favorites view - Save as Album ──
  // Acceptance Fix-2 (owner finding): Vue2 PhotosFavoritesView.vue reuses the exact same
  // $t('Save as Album') string for both the hero button (:22) and the modal header title
  // (:282) -- aligned to Vue2's literal value and reused for both here too (the previous
  // separate photosFavSaveAlbumTitle key, whose value differed from Vue2, is retired rather
  // than kept alongside a now-matching key).
  photosFavSaveAlbum: 'Save as Album',
  photosFavSaveAlbumDefault: 'Favorites · {year}',
  // Vue2 :291's input placeholder -- a literal hardcoded string (not templated with the
  // current year, unlike the pre-filled default value above), transcribed verbatim.
  photosFavSaveAlbumPlaceholder: 'e.g. Favorites · 2026',
  // 评审 Important 2:补 Vue2 PhotosFavoritesView.vue:267-268/279-281 的副标题+脚注(T3
  // 键清单漏列)。英文值逐字取自 Vue2 源(插值变量对齐成 {count})。
  photosFavSaveAlbumSub: 'Snapshot {count} favorited photos into a new album',
  photosFavSavedToast: '"{name}" saved · {count} photos',
  photosFavSaveFailed: 'Save failed',
  photosFavSaveAlbumNote: "The album becomes a static snapshot — it won't update when you favorite new photos. You can always make a new one later.",
  // ── Photos: People (SP7-P5, task-3). en values are verbatim Vue2 $t() literal
  // arguments (Vue2 uses the English string itself as the i18n key).
  photosPeople: 'People',
  // Plan D Task 2 (re-shell): the PhotosTopbar `sub` line for this page's index route. Vue2's
  // own PhotosPeopleTopbar.vue:37 index-mode subtitle is `Face clusters · {named} named ·
  // {unnamed} unnamed` — the task brief that specified this key gave the counts half verbatim
  // but deliberately dropped the "Face clusters ·" lead-in (brief's exact wording), so this key
  // carries only the counts clause; not a transcription oversight.
  photosPeopleTopbarSub: '{named} named · {unnamed} unnamed',
  photosPeopleNamed: '{n} named',
  photosPeopleUnnamedClusters: '{n} unnamed clusters',
  photosPeopleIndexedUpTo: 'Faces indexed up to {date}',
  // Task 4 (2026-08-19 timeline/people-visibility fix): photosPeopleConfidence /
  // photosPeopleConfidenceOption / photosPeopleClusters deleted here — the confidence dropdown
  // they belonged to is gone (see peopleView.ts's file header; a fixed 80% confidence default
  // silently hid a real 221-photo cluster). Verified zero remaining references before removal.
  photosPeopleFilterAll: 'All',
  photosPeopleFilterFamily: 'Family',
  photosPeopleFilterFriends: 'Friends',
  photosPeopleFilterWork: 'Work',
  photosPeopleFilterRecent: 'Recent',
  // Vue2 splits into $t('Sort:') + $t(label); New-UI composes a single key
  photosPeopleSort: 'Sort: {label}',
  photosPeopleSortFreq: 'Frequency',
  photosPeopleSortFreqHint: 'Most photographed first',
  photosPeopleSortName: 'Name (A–Z)',
  photosPeopleSortNameHint: 'Alphabetical',
  photosPeopleSortRecent: 'Most recent',
  photosPeopleSortRecentHint: 'Last seen first',
  photosPeopleSortOldest: 'First seen',
  photosPeopleSortOldestHint: 'Earliest first',
  photosPeopleFacesOffTitle: 'Face recognition is off',
  photosPeopleFacesOffBody: 'Existing people stay visible but no new faces are being detected. Re-enable in',
  photosPeopleFacesOffLink: 'Settings · AI behavior',
  photosPeopleMlOfflineTitle: 'Photos AI backend is offline',
  photosPeopleMlOfflineBody: 'Face recognition and smart search are paused while the Photos AI service starts up or is unavailable. Existing people stay visible.',
  photosPeopleMergeFound: 'Nimo found {n} possible merges',
  photosPeopleMergeReasonNamed: 'Two clusters look {pct}% alike — likely both {name}.',
  photosPeopleMergeReasonUnnamed: 'Two clusters look {pct}% alike — likely the same person.',
  photosPeopleMergeReview: 'Review',
  // ★ New-UI addition (fix-1): Vue2 dismiss-all icon button has no title/aria (a11y gap in
  // Vue2 itself, verified no title=/aria-label= anywhere in PhotosPeopleView.vue); New-UI
  // must have an aria-label regardless, wording given directly by coordinator
  photosPeopleMergeDismissAll: 'Dismiss all merge suggestions',
  photosPeoplePinned: 'Pinned',
  photosPeoplePinnedHint: "People you've favorited",
  photosPeopleNamedSection: 'Named',
  photosPeopleNamedHint: '{n} more — sorted by frequency',
  photosPeopleUnnamedSection: 'Unnamed clusters',
  photosPeopleUnnamedHint: '{n} clusters · click to name, merge or delete',
  photosPeopleHideSingle: 'Hide single-photo',
  photosPeopleShowSingle: 'Show {n} single-photo',
  photosPeopleHide: 'Hide',
  photosPeopleShow: 'Show',
  // Task 4 (2026-08-19 timeline/people-visibility fix): the fold-expander for the long tail of
  // multi-photo unnamed clusters below the distribution's 80%-coverage cut, replacing the
  // confidence dropdown. New copy, no Vue2 source (this mechanism doesn't exist in Vue2).
  photosPeopleShowMoreClusters: 'Show {n} more clusters',
  photosPeopleCollapseClusters: 'Show fewer',
  photosPeoplePhotosCount: '{n} photos',
  // 用户验收新增键(Vue2 无对应原文),键序与 zh_cn.ts 严格一致(parity.test.ts 会断言)。
  photosPersonViewPhotos: 'View these photos',
  photosPersonUnnamedTitle: 'Unnamed person',
  photosPersonNameThis: 'Name this person…',
  photosPersonMergeExisting: 'Merge into existing…',
  photosPersonDeleteCluster: 'Delete cluster',
  photosPersonNameTitle: 'Name this person',
  photosPersonNamePlaceholder: 'e.g. Sara / Lily / Old Song',
  photosPersonNameHint: 'After naming, Nimo groups all {n} photos containing this face under this person and auto-recognizes future imports.',
  photosPersonSaveName: 'Save name',
  photosPersonNamedToast: '"{name}" added · {count} photos',
  photosPersonMergeTitle: 'Merge into existing person',
  photosPersonMergeSearch: 'Search existing people…',
  photosPersonNoMatch: 'No matching people',
  photosPersonMergedToast: 'Cluster merged into "{name}"',
  photosPersonMergeFailed: 'Merge failed', // ★ New-UI addition, value given directly in brief
  photosPersonDeleteTitle: 'Delete this person group?',
  photosPersonDeleteBody: 'Photos are kept. Face group and recognition records will be permanently removed. You can undo within 5 seconds.',
  photosPersonConfirmDelete: 'Confirm delete',
  photosPersonDeletedToast: '{label} deleted',
  photosPersonUndo: 'Undo',
  photosPersonMergeSuggestTitle: 'Possible merge {idx} / {total}',
  photosPersonMergeSuggestConfidence: 'Confidence {n}%',
  photosPersonNotAMatch: 'Not a match',
  // Vue2 is $t('Merge as') + inline name; New-UI composes a single key
  photosPersonMergeAs: 'Merge as {name}',
  photosPersonMergeAsSame: 'same person',
  // T8 addition (not in the brief's enumerated key list; confirmed missing, added per the
  // "确实缺了报上来" instruction — flagged in the task report). Vue2's review dialog fixed
  // labels under the two comparison columns: $t('Cluster A')/$t('Cluster B') (:400,418).
  photosPersonMergeGroupA: 'Cluster A',
  photosPersonMergeGroupB: 'Cluster B',
  // T8 addition: brand prefix on the reason bar, $t('Nimo:') (:423) — literal in both locales.
  photosPersonMergeNimoLead: 'Nimo:',
  // T8 addition: onRejectReview's toast text, $t('Suggestion dismissed') (:613). The accept
  // path deliberately reuses the existing photosPersonMergedToast instead of adding a second
  // "Merged as …" key — same consolidation pattern already used for mergeReason/PersonAvatar
  // (Vue2 has two literally-different but semantically-identical toasts here); flagged in the
  // task report as an intentional consolidation, not an oversight.
  photosPersonMergeDismissedToast: 'Suggestion dismissed',
  // Plan D Task 3: photosPersonSubtitle ('Person details · faces & relationships') is back.
  // Final-review Minor 8 (earlier P5) deleted this because the detail page's topbar was still
  // AreaShell (title-only, hidden on desktop) — Vue2 PhotosPeopleTopbar.vue:36's detail-state
  // subtitle had nowhere to render. Task 3 re-shells PhotosPersonDetail.vue onto PhotosTopbar
  // (title/sub/back props), which is exactly that detail-state slot, so the key is genuinely
  // needed again now. Do not confuse it with photosPeopleNamed / photosPeopleUnnamedClusters —
  // those come from Vue2's *banner* (PhotosPeopleView.vue:7-9) and are rendered in .people-sub
  // on the People index page, unrelated to this topbar subtitle.
  photosPersonSubtitle: 'Person details · faces & relationships',
  photosPersonTabTimeline: 'Timeline',
  photosPersonTabPlaces: 'Places',
  photosPersonTabRelations: 'Relationships',
  photosPersonStatPhotos: 'Photos',
  photosPersonStatPlaces: 'Places',
  photosPersonStatAppearsWith: 'Appears with',
  photosPersonStatFirstSeen: 'First seen',
  photosPersonMakeAlbum: 'Make album',
  photosPersonBackground: 'Background',
  // Task 8 (Plan D): hero action buttons completion (Vue2 PhotosPersonDetail.vue:89-91).
  // Click is a no-op here — wiring deferred to Plan G — this only adds copy + visuals.
  photosPersonAskAbout: 'Ask about {name}',
  // ★ New-UI addition (Task 10): see zh_cn.ts for the reasoning — Vue2 :33 is the generic
  // $t('Edit') label on the pill trigger button itself (not the three menu items below it);
  // reusing photosAlbumEdit/topbarEdit would tie this to unrelated features.
  photosPersonEdit: 'Edit',
  photosPersonRename: 'Rename person',
  photosPersonMergeInto: 'Merge into another person',
  photosPersonDelete: 'Delete person',
  photosPersonRelationNone: 'No group',
  photosPersonRelationFamily: 'Family',
  photosPersonRelationFriend: 'Friend',
  photosPersonRelationWork: 'Work',
  photosPersonSameFrame: 'Same frame with',
  photosPersonSelect: 'Select',
  photosPersonDeselect: 'Deselect',
  photosPersonNotThePerson: 'Not the person',
  photosPersonSetKeyPhoto: 'Set as key photo',
  photosPersonRemoveFrom: 'Remove from {name}',
  photosPersonKeyPhotoToast: 'Key photo updated',
  photosPersonKeyPhotoNoFace: 'No face of this person in that photo',
  photosPersonKeyPhotoFailed: 'Failed to set key photo',
  // Vue2 :884-897 has separate singular/plural copy; fix-2 adds all 4 strings (the earlier
  // plural-only generic pair is removed)
  photosPersonDetachTitleOne: 'Not {name}?',
  photosPersonDetachTitleMany: 'Remove {n} photos from {name}?',
  photosPersonDetachHintOne: "This photo's face will be removed from {name} and won't reappear in this person.",
  photosPersonDetachHintMany: "These {n} photos' faces will be removed from {name} and won't reappear in this person.",
  photosPersonDetachConfirm: 'Remove',
  photosPersonThisPerson: 'this person',
  photosPersonHeroTitle: 'Choose background',
  photosPersonUseKeyPhoto: 'Use key photo',
  photosPersonSaveHero: 'Save',
  photosPersonHeroSavedToast: 'Background updated',
  photosPersonHeroFailed: 'Failed to update background',
  // Final-review Minor 10: the ★ was wrong here — `Rename failed` DOES exist in the old
  // repo's locale table (zh_CN.json maps it to "重命名失败"), so the zh side was reverted
  // to the source translation. The en value itself is unchanged (verbatim Vue2).
  photosPersonRenamedFailed: 'Rename failed',
  photosPersonAlbumCreatedToast: 'Album created · {name}', // ★
  // Final-review Minor 10: same as above — `Could not create album` exists in the old
  // locale table ("相册创建失败"); ★ removed, zh reverted to the source translation.
  photosPersonAlbumFailed: 'Could not create album',
  // ── Final-review Minor 9/10 re-check ────────────────────────────────────────
  // ★ means "no such copy in Vue2, authored here" (convention at :788 / :815). Re-checked
  // every ★ below against the old repo's zh_CN.json: none of these English sentences exist
  // there, so ★ is accurate for them. Only the two above were mismarked and are now fixed.
  // Final-review follow-up (fix round, Plan D): the ★ that used to sit on `photosPersonNotFound`/
  // `photosPersonBack` below has gone stale — Vue2 commit 03245590 later added matching copy for
  // both (`Person not found` / `Back to People`, PhotosPersonDetail.vue:471/473, part of the same
  // fallback-branch source this task's I1 re-anchor draws from), so they are no longer "no Vue2
  // copy, authored here." ★ removed from both.
  photosPersonRelationFailed: 'Could not update group', // ★
  photosPersonFavFailed: 'Could not update favorite', // ★
  photosPersonNoPhotos: 'No photos for this person yet', // ★
  photosPersonNotFound: 'Person not found',
  // Task 6 (Plan D, PR#137 gap-close): source-of-truth casing check against the Vue2 patch
  // that introduced this string (`"Back to People": "Back to People"`) turned up a casing
  // mismatch here — fixed to match Vue2 verbatim (was 'Back to people').
  photosPersonBack: 'Back to People',
  photosPeopleEmptyTitle: 'No people yet', // ★
  // Task 6 (Plan D, PR#137 gap-close): replaces the old single `photosPeopleEmptyHint` —
  // Vue2's #137 patch (NimoOS-UI commit 03245590, PhotosPeopleView.vue) branches this hint on
  // whether face recognition is on, quoted verbatim from that commit's en_US.json.
  photosPeopleEmptyHintFaces: 'Faces are detected automatically while your photos are indexed. People will appear here soon.',
  photosPeopleEmptyHintNoFaces: 'Turn on face recognition to start finding people in your photos.',
  photosPersonShowAll: 'Show all {n}', // ★
  photosPersonShowLess: 'Show less', // ★
  photosPersonPlacesLegend: 'Top places',
  photosPersonNoPlaces: 'No location data for {name} yet',
  photosPersonNimoRead: "Nimo's read",
  // Task 8 (Plan D): rel-insight-card's "dig deeper" button (Vue2 PhotosPersonDetail.vue:
  // 228-230 `.nimo-btn`). Click is a no-op here — wiring deferred to Plan G.
  photosPersonDigDeeper: 'Dig deeper',
  photosPersonInsightWith: '{name} appears most often with <b>{other}</b>.',
  photosPersonInsightWithUnnamed: '{name} appears together with an unnamed person.',
  photosPersonInsightPlaces2: 'Their photos cluster in <b>{place1}</b> and <b>{place2}</b>.',
  photosPersonInsightPlace1: 'Their photos cluster in <b>{place}</b>.',
  photosPersonInsightNone: 'Not enough photos of {name} yet for an insight.',
  photosPersonUnknownPlace: 'Unknown', // no bare "Unknown" entry in zh_CN.json, see report caveats
  // SP7-P5 task-6 addition: one UI string missed by T3; wording taken from Vue2
  // zh_CN.json (:2079) by the coordinator. Appended at the end of the photos
  // block — existing keys are not reordered. photosPeopleMinScore (the confidence dropdown
  // header) was removed alongside Task 4's confidence dropdown, see peopleView.ts's file header.
  photosPeopleClusterHint: '+ Name / Merge / Delete', // unnamed cluster hover hint, Vue2 :204
  // T7 coordinator addition: <label> for ClusterActionDialog's name mode, wording
  // "Name" per zh_CN.json:49. Appended at the end of the block, existing keys not reordered.
  photosPersonNameLabel: 'Name',
  // T7 review fix 1: delete mode's header-title slot, matches Vue2
  // PhotosPeopleView.vue:262 $t('Delete face cluster') verbatim (distinct from the
  // warning box's own title line, photosPersonDeleteTitle — two different sentences,
  // must not share one key).
  photosPersonDeleteClusterTitle: 'Delete face cluster',
  // Coordinator ruling addition (Task 12 fix): the places tab's section title
  // belongs to the tab component itself (Vue2 PhotosPersonDetail.vue :156-162
  // sits inside v-if="tab==='map'", it's part of that tab; T13's relationships
  // tab is the same, each tab owns its own section title). Verbatim strings
  // from Vue2 PhotosPersonDetail.vue :160-161. Apostrophe in "you've" — kept
  // double-quoted so it doesn't break the TS string literal. Appended at the
  // end of the photos block, existing keys not reordered.
  photosPersonPlacesTitle: 'Places with {name}',
  photosPersonPlacesSub: "Where you've photographed them, all-time",
  // Task 13: relationships tab's own section title / legend / co-appearance
  // count phrase. Verbatim from Vue2 zh_CN.json's English source keys
  // ("Relationship graph" / "Edge thickness = co-appearance count" /
  // "Frequent (200+)" / "Occasional" / "Co-appearance" / "{n} photos
  // together"). The insight-sentence keys (photosPersonInsightWith etc.)
  // already exist above (:898-902); these are just the graph area's own
  // copy. Appended at the end of the photos block, existing keys not
  // reordered.
  photosPersonGraphTitle: 'Relationship graph',
  photosPersonGraphSub: 'Edge thickness = co-appearance count',
  photosPersonGraphLegendFrequent: 'Frequent (200+)',
  photosPersonGraphLegendOccasional: 'Occasional',
  photosPersonCoappearTitle: 'Co-appearance',
  photosPersonPhotosTogether: '{n} photos together',
  // Task 6 (Plan D, PR#137 gap-close): relation-graph empty state, quoted verbatim from
  // Vue2's #137 patch (NimoOS-UI commit 03245590's en_US.json).
  photosPersonRelGraphEmptyTitle: 'No co-appearances yet',
  photosPersonRelGraphEmptySub: 'When this person shows up in photos with others, the graph appears here.',
  // Task 14 (container + six dialogs): copy that the brief's key list did not
  // cover and that a line-by-line pass over Vue2 PhotosPersonDetail.vue showed
  // was genuinely missing here. English strings are verbatim from the Vue2
  // source (line numbers noted per key). Appended at the end, no reordering.
  photosPersonSameFrameSub: 'People who appear in photos with {name}', // Vue2 :112
  photosPersonRenameHint: 'This name will be used everywhere this face appears.', // Vue2 :776
  photosPersonAlbumHint: '{n} photos will be added to this album.', // Vue2 :861
  photosPersonAlbumNameFallback: 'Person {id}', // Vue2 :855
  photosPersonNoPhotosTitle: 'No photos available', // Vue2 :847
  photosPersonNoPhotosAlbumHint: 'This person has no photos to add to an album yet.', // Vue2 :848
  photosPersonHeroSub: 'Select a photo to use as the hero background', // Vue2 :339
  photosPersonMergeIntoSub: 'All photos will move to the target person', // Vue2 :388
  photosPersonMergeConfirm: 'Merge into {name}', // Vue2 :428 (target picked); zh reverted to source translation (Minor 9)
  photosPersonMergeSelectPrompt: 'Select a person', // Vue2 :428 (nothing picked); zh reverted to source translation (Minor 9)
  photosPersonUnnamedLabel: 'Unnamed person', // Vue2 :962
  // Deviation 1: Vue2 :943 only console.error's a failed detach; we surface a toast.
  photosPersonDetachFailed: 'Failed to remove photos',
  // Task 14 fix (coordinator ruling 3): the brief claimed Vue2's four hero toasts
  // collapse into two. Re-checking the source shows the two entry points each own a
  // distinct pair — onUseKeyPhoto (:681,683) "reset back to the key photo" vs
  // onSaveHero (:694,696) "switch to the picked photo". Kept as two separate pairs.
  photosPersonHeroResetToast: 'Background reset to key photo', // Vue2 :681
  photosPersonHeroResetFailed: 'Failed to reset background', // Vue2 :683
  // Task 14 fix (coordinator ruling 4): a load failure must be distinguishable from
  // "no such person" — that is exactly what T9's `failed` flag is for (Vue2 only
  // console.error's, so its view cannot tell them apart). Retry affordance included;
  // P4 left a same-shaped debt (detail page load failure → permanent skeleton, no
  // error state, no retry) that we are not repeating here.
  photosPersonLoadFailed: 'Could not load this person',
  // Task 6 (Plan D, PR#137 gap-close): the load-failed / not-found fallback states were
  // missing their description line — Vue2's #137 patch added both (quoted verbatim from
  // NimoOS-UI commit 03245590's en_US.json).
  photosPersonLoadFailedHint: 'Please check your connection and try again.',
  photosPersonNotFoundHint: 'This person may have been deleted or merged.',
  photosPersonRetry: 'Retry',
  // T14 review Minor 4: the detail page's delete-confirm dialog heading. Vue2 :304 is
  // `Delete person?` — a different sentence from T7's in-warning-box
  // photosPersonDeleteTitle (`Delete this person group?`), which
  // ClusterActionDialog.vue:66 already documented as non-shareable. The original
  // implementation wrongly reused the latter.
  photosPersonDeletePersonTitle: 'Delete person?',
  // T14 review Minor 6: Vue2 :310-312 renders the body as two sentences in two greys.
  // The existing photosPersonDeleteBody merges them into one string and is already
  // consumed by T7 (ClusterActionDialog.vue:230), so it must not change — these two
  // keys are the same text split in two for the detail page's two-tone rendering.
  photosPersonDeleteKeptBody: 'Photos are kept. Face group and recognition records will be permanently removed.',
  photosPersonDeleteUndoHint: 'You can undo within 5 seconds.',
  // ── Photos: Favorites hero-stats three cards (Task 15A, SP7-P5) — Vue2
  // PhotosFavoritesView.vue:57-84. en values verbatim from Vue2 source ($t()
  // literal argument). The "{n} photos" meta text reuses the existing
  // photosPeoplePhotosCount key rather than a new one (same literal in Vue2).
  photosFavStatTopPerson: 'Top person',
  photosFavStatTopPlace: 'Top place',
  photosFavStatByYear: 'By year',
  photosFavStatInYear: 'in {year}',
  photosFavStatYearsTotal: '{n} years total',
  photosFavNoFaces: 'No faces yet',
  // ── Task 6 (Plan H): place-filter dropdown — Vue2 PhotosFavoritesView.vue:412-416/353-360.
  photosFavFilterPlaces: 'Places',
  photosFavFilterClear: 'Clear filter',
  // ── Acceptance Fix-1 (owner finding, Plans G+H): the "All" chip + People/Years dropdowns
  // — Vue2 PhotosFavoritesView.vue :114-116 ($t('All')) / :125 ($t('People')) / :177
  // ($t('Years')). en values verbatim from old zh_CN.json's own English source, matching
  // the already-landed photosFavFilterPlaces above ($t('Places')).
  photosFavFilterAll: 'All',
  photosFavFilterPeople: 'People',
  photosFavFilterYears: 'Years',
  // Vue2 :198-202's Sort/Recent/Oldest segmented toggle — old zh_CN.json:2294/2250/2219.
  photosFavSort: 'Sort',
  photosFavSortRecent: 'Recent',
  photosFavSortOldest: 'Oldest',
  // ── Final-review Minor 6 / 7: short copy on the hero ────────────────────────
  // M6: Vue2 :38/:41 uses short verbs in the Edit dropdown (`Rename` / `Merge into…`).
  // The original implementation reused photosPersonRename / photosPersonMergeInto, which
  // are also the dialogs' <h*> titles ("Rename person" / "Merge into another person") —
  // they read as full sentences and 24 chars at 12.5px overflow the 170px-min menu.
  // Values verbatim from Vue2.
  photosPersonMenuRename: 'Rename',
  photosPersonMenuMergeInto: 'Merge into…',
  // M7: Vue2 :26's un-favorited title is `Mark as favorite`, not the generic `Favorite`.
  // The favorited branch keeps the existing photosUnfavorite key.
  photosPersonMarkFavorite: 'Mark as favorite',
  // ── SP7-P6a T4: Places domain (map view) i18n keys ─────────────────────────
  // Source: task-4-brief.md; values verified against NimoOS-UI/src/assets/lang/en_US.json.
  // English literals matched the brief for every row — only the zh side needed
  // corrections; see zh_cn.ts comments and the task report for the full list.
  photosPlaces: 'Places',
  photosPlacesCities: 'cities',
  photosPlacesCountries: 'countries',
  // Task 1 (Plan E re-shell): PhotosTopbar's `sub` line on the Places index page — value
  // copied verbatim from Vue2 PhotosPlacesTopbar.vue's own subtitle computed (NimoOS-UI
  // src/views/Photos/PhotosPlacesTopbar.vue:34, which uses the English literal itself as the
  // i18n key, English-source-as-key convention) and NimoOS-UI/src/assets/lang/en_US.json:2442.
  photosPlacesTopbarSub: '{cities} cities · {countries} countries · indexed by Nimo',
  photosPlacesPhotos: 'photos',
  photosPlacesSearchPlaceholder: 'Search cities or countries',
  photosPlacesCityCount: '{n} cities',
  photosPlacesPhotoCount: '{n} photos',
  photosPlacesFilters: 'Filters',
  photosPlacesTimeRange: 'Time range',
  photosPlacesStartDate: 'Start date',
  photosPlacesEndDate: 'End date',
  photosPlacesMinPhotos: 'Min photos',
  photosPlacesRegion: 'Region',
  // Note: Vue2's zh copy has two different phrasings for "current trip" (this
  // checkbox vs. the bare label below) — kept as-is per the 1:1 rule, see zh_cn.ts.
  // English is identical either way ("Current trip only" / "Current trip").
  photosPlacesCurrentTripOnly: 'Current trip only',
  photosPlacesFilterReset: 'Reset',
  photosPlacesFilterDone: 'Done',
  photosPlacesAny: 'Any',
  photosPlacesAtLeast: '≥ {n}',
  photosPlacesAll: 'All',
  photosPlacesMapTheme: 'Map theme',
  photosPlacesMapThemePresets: 'Presets',
  photosPlacesMapThemeCustom: 'Custom',
  photosPlacesLandDotColor: 'Land dot color',
  photosPlacesCityLightColor: 'City light color',
  photosPlacesThemeDefault: 'Default',
  photosPlacesThemeOcean: 'Ocean',
  photosPlacesThemeSand: 'Sand',
  photosPlacesThemeMono: 'Mono',
  photosPlacesThemeDescDefault: 'Purple dots on black',
  photosPlacesThemeDescOcean: 'Teal on deep blue',
  photosPlacesThemeDescSand: 'Warm amber on dark',
  photosPlacesThemeDescMono: 'Black & white',
  photosPlacesZoomIn: 'Zoom in',
  photosPlacesZoomOut: 'Zoom out',
  photosPlacesResetView: 'Reset view',
  photosPlacesCurrentTrip: 'Current trip',
  // Continent labels: en_US.json has no Asia/Americas/Europe/Africa/Oceania/Antarctica
  // entry either — confirmed missing, values authored.
  photosPlacesRegionAsia: 'Asia',
  photosPlacesRegionAmericas: 'Americas',
  photosPlacesRegionEurope: 'Europe',
  photosPlacesRegionAfrica: 'Africa',
  photosPlacesRegionOceania: 'Oceania',
  photosPlacesRegionAntarctica: 'Antarctica',
  // The following five have no Vue2 counterpart (New-UI addition), authored:
  photosPlacesEmpty: 'No photos with location data yet',
  photosPlacesEmptyHint: 'Nimo reads GPS data while indexing your photos',
  photosPlacesSearchEmpty: 'No cities matching "{q}"',
  photosPlacesLoadFailed: 'Could not load places',
  photosPlacesRetry: 'Retry',
  // Review I3 (New-UI addition, no Vue2 counterpart): the rail empty state used to
  // always show photosPlacesEmpty even when the full place list is non-empty and
  // only the active filters narrowed it to zero — misleading users into thinking
  // the index is broken. Added a distinct copy for "empty after filtering".
  photosPlacesFilterEmpty: 'No cities match the current filters',
  // ── SP7-P6b T1: Places detail panel i18n keys ──────────────────────────────
  // 42 sourced verbatim from NimoOS-UI/src/assets/lang/en_US.json (verified against
  // source, zero discrepancies); 3 authored (D8 + deviation-log 6, see inline notes).
  photosPlacesHomeBase: 'Home base',
  // Note: en_US.json has distinct singular/plural copy for trip/trips (zh has one
  // shared string) — kept as two keys per json, matching the source as-is.
  photosPlacesTrip: 'trip',
  photosPlacesTrips: 'trips',
  photosPlacesSpotsLabel: 'spots',
  photosPlacesPhotosShotHere: 'photos shot here',
  photosPlacesSpotsInCity: 'Spots in {city}',
  photosPlacesViewAll: 'View all',
  photosPlacesNimoNoticed: 'Nimo noticed',
  photosPlacesRecentPhotos: 'Recent photos',
  photosPlacesSeeAll: 'See all {n}',
  photosPlacesVisitHistory: 'Visit history',
  photosPlacesDays: '{n} days',
  photosPlacesWith: 'with',
  photosPlacesSpotsCount: '{n} spots',
  photosPlacesSaveTrip: 'Save trip',
  photosPlacesSaveTripTitle: 'Save this trip as an album',
  photosPlacesOpenInLibrary: 'Open in Library',
  photosPlacesSaveAsAlbum: 'Save as Album',
  photosPlacesAlbumCreated: 'Album "{name}" created · {count} photos',
  photosPlacesAlbumCreateFailed: 'Could not create album',
  photosPlacesToastOpen: 'Open',
  photosPlacesShowWholeCity: 'Show whole city',
  photosPlacesSpotRename: 'Rename',
  photosPlacesSpotNamePlaceholder: 'Spot name',
  photosPlacesSpotSave: 'Save',
  photosPlacesSpotViewInLibrary: 'View all photos of this spot in Library',
  photosPlacesSpotResetName: 'Reset to default name', // authored (D8), no Vue2 counterpart
  photosPlacesSpotRenameFailed: 'Could not rename spot', // authored (deviation-log 6), no Vue2 counterpart
  photosPlacesCoverFailed: 'Could not update cover', // authored (deviation-log 6), no Vue2 counterpart
  photosPlacesCoverSet: 'Set cover',
  photosPlacesCoverTitle: 'Set {city} cover',
  photosPlacesCoverSubtitle: 'Pick one of {count} photos as the cover',
  photosPlacesCoverSearchPlaceholder: 'Search scenes / people / tags…',
  photosPlacesCoverNoMatch: 'No photos matching "{q}"',
  photosPlacesCoverResetDefault: 'Reset to default',
  photosPlacesCoverPageInfo: '{total} candidates · page {page} / {pages}',
  photosPlacesCoverTabRecent: 'Recent',
  photosPlacesCoverTabTop: 'Top rated',
  photosPlacesCoverTabFav: 'Favorited',
  // Same value as existing photosPlacesAll (filter panel "All") but a different semantic
  // domain (cover-picker category tab) — kept as a separate key.
  photosPlacesCoverTabAll: 'All',
  photosPlacesInsightMostPhotographed: 'Your most photographed place — {count} photos.',
  // Original json wraps {spot} in <b>; dropped the tag and made {spot} the interpolation
  // slot instead (<i18n-t> can only open a slot at an interpolation position).
  photosPlacesInsightTopSpot: '{spot} is the dominant spot — {count} photos.',
  photosPlacesInsightCompanions: 'Spotted with {names} here.',
  // Deviation-log 10: original json is "Your <b>home base</b> — …"; the bolded static
  // word "home base" is split into a {base} slot, see photosPlacesInsightHomeBase below.
  photosPlacesInsightHome: 'Your {base} — {count} photos across {trips} trips.',
  // Note: this and photosPlacesHomeBase ("Home base") are Vue2's two different phrasings
  // for the same concept — the former is filter/list-context copy, this is the bolded
  // word inside the insight sentence ("home base", lowercase per json). Kept as-is per
  // the 1:1 rule, not unified.
  photosPlacesInsightHomeBase: 'home base',
  // ---- P7a-T1: Smart Views, 107 new keys appended after photosPlacesInsightHomeBase ----
  // (table listed 115 rows; 8 duplicate pre-existing keys per brief item 7 and are reused, not re-added — see task report)
  // Whole-branch review, Minor 6: photosSvAddedThisWeek was deleted along with its only consumer,
  // SmartViewCard.vue (removed in Task 10). See zh_cn.photos.ts for the grep note.
  // P7a-T8 fix round 1 · I3: strip literal <b>, switch to <i18n-t> named slots (zero
  // v-html). Re-checked zh_CN.json source: both rows bold the whole "interpolation +
  // language-specific word" phrase (`<b>1 张新照片</b>` / `<b>{n} 张新照片</b>` are
  // symmetric) ⇒ both split into a base-sentence key + a bold-phrase key, not treated
  // differently (see SmartViewActivityFeed.vue header comment + task-8-report.md).
  photosSvActOneMatched: '{photo} auto-added',
  photosSvActOneMatchedBold: '1 new photo',
  photosSvActNMatched: '{photo} auto-added',
  photosSvActNMatchedBold: '{n} new photos',
  // Task 8: converted_from_album activity row (reverse of Task 7's convertFromAlbum). No
  // <b> in Vue2 for either branch, so these are plain text keys -- no split main-clause +
  // bold-phrase pair like the matched rows above.
  photosSvActConvertedFromAlbum: 'Converted from album',
  photosSvActConvertedFromAlbumN: 'Converted from album · {n} photos locked in',
  photosSvActivity: 'Activity',
  photosSvAddAnother: 'Add another…',
  photosSvAllMatches: 'All matches',
  // P7a-T8: <b> only wraps the interpolation {n} ⇒ slot directly, strip literal <b></b>.
  photosSvThreshHelp: 'At {pct}%, expect ~{n} new photos per week.',
  photosSvAutoAddMatches: 'Auto-add new matches',
  photosSvAutoAddMatchesPhotos: 'Auto-add new matches as photos arrive',
  photosSvAutoAddWhenScore: 'Auto-add when score ≥',
  photosSvBalanced: 'Balanced',
  photosSvBalancedHealthyMixCertainty: 'Balanced — a healthy mix of certainty and recall.',
  photosSvBestLastMonth: 'Best of last month',
  photosSvBestPhotosLast30: 'Best photos from the last 30 days',
  photosSvCandidatesThreshold: 'candidates at this threshold',
  photosSvChangeSmartViewName: 'Change the Smart View name',
  photosSvConditions: 'Conditions',
  photosSvConditionsSettingsUpdated: 'Conditions or settings updated',
  // ── Task 8: smart album -> regular album conversion (reverse of Task 7) ──
  photosSvConvertToAlbum: 'Convert to regular album',
  photosSvConvertToAlbumHint: 'Stop auto-updates and lock in the current matches',
  photosSvConvertToAlbumTitle: 'Convert "{name}" to a regular album?',
  photosSvConvertToAlbumBody: 'Auto-updates stop. The current {n} photos become fixed into a regular album — the theme and conditions will be removed.',
  photosSvConvertedToAlbum: 'Converted to regular album',
  photosSvCopyQuerySv: 'Copy the query as a new SV',
  // SP15-P2b Task 4: embedded-mode label for the same submit button that reads
  // photosSvCreateSmartView in standalone mode (Vue2 PhotosSmartAlbumCreate.vue's own
  // hard-coded 'Create Smart Album' string, ported here as a key since this file merges
  // both modes into one component).
  photosSvCreateSmartAlbum: 'Create Smart Album',
  photosSvCreateSmartView: 'Create Smart View',
  photosSvDeleteName: 'Delete "{name}"?',
  photosSvDescribePlainEnglishConditions: 'Describe it in plain English — conditions are inferred below',
  photosSvDuplicate: 'Duplicate',
  photosSvDuplicatedNameOpenCopy: 'Duplicated "{name}" — open the new copy from the list',
  photosSvEGSaraTokyo: 'e.g. Sara · Tokyo · sunsets',
  photosSvExportedDetail: 'Exported as {detail}',
  photosSvFamilyWeekends: 'Family weekends',
  photosSvFamilyWeekendsPark: 'Family weekends in the park',
  photosSvExportFile: 'file',
  photosSvIncludeVideos: 'Include videos',
  photosSvKeepLive: 'Keep it live',
  photosSvLastUpdate: 'Last update',
  photosSvLastUpdatedTime: 'Last updated {time}',
  // SP15-P2b Task 4 (Vue2 939a7d3a:PhotosAlbumsView.vue's `sourceOptions`, 4th entry --
  // verbatim from zh_CN.json:1987-1988's English source strings, not the plan's guesses).
  photosSvLetNimoDraft: 'Let Nimo draft it',
  photosSvLetNimoDraftHint: 'Describe the theme, let AI fill it in',
  photosSvLive: 'Live',
  photosSvLivePreview: 'Live preview',
  photosSvLoose: 'Loose',
  photosSvLooseExpectSomeFalse: 'Loose — expect some false positives.',
  photosSvMatchAgainstVideoKeyframes: 'Match against video keyframes',
  photosSvMatchScoreDistribution: 'Match score distribution',
  photosSvMayIncludeFalsePositives: 'May include false positives.',
  photosSvMayMissBorderlineMatches: 'May miss borderline matches.',
  photosSvMedianMatch: 'Median match',
  photosSvName: 'Name',
  photosSvNew: 'New',
  photosSvNewSmartView: 'New Smart View',
  photosSvNimoSuggests: 'Nimo suggests',
  photosSvStartTemplate: 'Or start from a template',
  photosSvPause: 'Pause',
  photosSvPauseAutoUpdates: 'Pause auto-updates',
  photosSvPaused: 'Paused',
  photosSvPausedUploadsNotAdded: 'Paused — new uploads will not be added',
  photosSvPetPortraits: 'Pet portraits',
  photosSvPhotosStayLibrary: 'Photos stay in your library',
  photosSvPhotosCount: 'photos',
  photosSvPreparingZipNPhotos: 'Preparing ZIP — {n} photos',
  photosSvPressEnterAddPick: 'Press {enter} to add. Or pick a suggestion above.',
  photosSvQualityThreshold: 'Quality threshold',
  photosSvReceiptsInvoicesAmount: 'Receipts and invoices with an amount',
  photosSvReceiptsFile: 'Receipts to file',
  photosSvRecentlyAdded: 'Recently added',
  photosSvRefineSearch: 'Refine in Search',
  photosSvRemoveCondition: 'Remove condition',
  photosSvRemoveC: 'Remove: {c}',
  photosSvRename: 'Rename',
  photosSvResume: 'Resume',
  photosSvResumeAutoUpdates: 'Resume auto-updates',
  photosSvRunEveryUpload: 'Run on every new upload',
  photosSvSavedSearchKeepsItself: 'Saved search that keeps itself up to date',
  photosSvSettingsSection: 'Settings',
  photosSvSharpDogCatPortraits: 'Sharp dog and cat portraits',
  photosSvBadgeSmartView: 'Smart View',
  photosSvSmartViewNameDeleted: 'Smart View "{name}" deleted',
  photosSvSmartViewCreated: 'Smart View created',
  photosSvSmartViewRenamed: 'Smart View renamed',
  photosSvSmartViews: 'Smart Views',
  photosSvSmartViewsAutoUpdate: 'Smart Views auto-update is off',
  // SP15-P2b Task 4: disabled-option title on the Albums "New album" panel's 4th fill
  // choice when the smartview AI feature is off.
  photosSvSmartViewsOffCreateHint: 'Smart Views are turned off — re-enable them in Settings · AI behavior to create new ones.',
  photosSvStats: 'Stats',
  photosSvStrict: 'Strict',
  photosSvStrictOnlyHighestConfidence: 'Strict — only the highest-confidence matches.',
  photosSvSunsetsRoad: 'Sunsets on the road',
  photosSvSunsetsWhileTravelingNot: 'Sunsets while traveling, not at home',
  photosSvSunsetsSaraOurTokyo: 'Sunsets with Sara from our Tokyo trip last spring',
  photosSvSmartViewRemovedStops: 'The Smart View is removed and stops watching for new matches. The {n} photos in your library are untouched.',
  photosSvTheseSavedSearchesStay: "These saved searches stay visible but won't pick up new matches. Re-enable in",
  photosSvThisWeek: 'this week',
  photosSvTotal: 'Total',
  photosSvTypeConditionEG: 'Type a condition, e.g. scene: sunset',
  photosSvNimoMatch: 'What should Nimo match?',
  photosSvCurrentConditionsMatchExactly: 'Your current conditions match exactly — the threshold will kick in once you add a scene / object / free-text condition.',
  photosSvNNewThisWeek: '{n} new this week',
  photosSvNPhotosMbMb: '{n} photos · ~{mb} MB',
  photosSvRelHours: '{n}h ago',
  photosSvRelMinutes: '{n}m ago',
  // P8a-T6: photosSvSettingsPending ('Settings page coming in P8') removed here — zero
  // references repo-wide. See the matching zh_cn.ts comment for why (the placeholder title
  // for the AI-banner's non-clickable settings span, now a real RouterLink, §7e-9).
  // ---- P7a-T6: detail-page shell additions (beyond T1's 107 keys) ----
  photosSvNotFound: 'Smart View not found',
  photosSvRenameFailed: 'Rename failed',
  photosSvUpdateFailed: 'Update failed',
  photosSvDeleteFailed: 'Delete failed',
  photosSvDuplicateFailed: 'Duplicate failed',
  // ── SP15-P2a: manual asset actions ──
  // English values are Vue2's literal source strings. See the zh_cn.ts comment for the five
  // strings this screen reuses from elsewhere in the file instead of adding again.
  photosSvAddPhotos: 'Add photos',
  photosSvRemoveFromView: 'Remove from this view',
  photosSvRemovedNFromView: 'Removed {n} from this view',
  photosSvExcludedN: 'Excluded ({n})',
  photosSvAlreadyInView: 'Already in this view',
  photosSvPinnedNToView: 'Pinned {n} to this view',
  photosSvRestoreFailed: 'Restore failed',
  photosSvRemoveFailed: 'Remove failed',
  photosSvAddFailed: 'Add failed',
  photosSvShow: 'Show',
  photosSvHide: 'Hide',
  photosSvRestore: 'Restore',
  // ── SP15-P2c Task 6: sort capsule + the edit-mode bar's empty-selection hint. English
  // values are Vue2's literal source strings. See the zh_cn.photos.ts comment for the nine
  // strings the rebuilt row reuses from elsewhere in this file instead of adding again.
  photosSortScore: 'Match score',
  photosSvClickToSelect: 'Click to select',
  // ---- P7a-T9: search panel (filter bar + popovers) 54 keys, see the matching
  // zh_cn.ts comment. English values are the Vue2 PhotosSearchView.vue literal
  // English strings (= the Vue2 en dict keys), 1:1. ----
  photosSearchAlbums: 'Albums',
  photosSearchApply: 'Apply',
  photosSearchAskNimoSearchDifferently: 'Ask Nimo to search differently',
  photosSearchClearAll: 'Clear all',
  photosSearchDate: 'Date',
  photosSearchDescribeReLookingPeople: "Describe what you're looking for — people, places, scenes, or a whole sentence. Press ↵ to search.",
  photosSearchFileType: 'File type',
  photosSearchFindPhotos: 'Find photos: ',
  photosSearchCouldnTFindPhotos: "I couldn't find photos matching all your conditions. Try removing a filter, or describe what you're looking for in plain language and I'll search more broadly.",
  photosSearchLast30Days: 'Last 30 days',
  photosSearchLast7Days: 'Last 7 days',
  photosSearchLastYear: 'Last year',
  photosSearchLoading: 'Loading more…',
  photosSearchResultsCount: 'More results ({count})',
  photosSearchNewest: 'Newest',
  photosSearchNextMonth: 'Next month',
  photosSearchNimoUnderstood: 'Nimo understood:',
  photosSearchNoActiveFiltersSaves: 'No active filters — saves the raw query.',
  photosSearchNoLocationDataYet: 'No location data yet',
  photosSearchNoMatches: 'No matches',
  photosSearchNoPeopleDetectedYet: 'No people detected yet',
  photosSearchNothingHereYet: 'Nothing here yet',
  photosSearchTypeOcr: 'OCR',
  photosSearchOldest: 'Oldest',
  photosSearchOpenInAlbums: 'Open in Albums →',
  photosSearchPeople: 'People',
  photosSearchTokPerson: 'person',
  photosSearchBadgePhoto: 'Photo',
  photosSearchTypePhotos: 'Photos',
  photosSearchPlaces: 'Places',
  photosSearchPreviousMonth: 'Previous month',
  photosSearchQuickRange: 'Quick range',
  photosSearchRecentSearches: 'Recent searches',
  // Fix-4 (owner-directed addition, 2026-08-17): clear-history button, no Vue2 source.
  photosSearchClearHistory: 'Clear',
  photosSearchRecent: 'Recent:',
  photosSearchRelevance: 'Relevance',
  photosSearchSaveSmartView: 'Save as Smart View',
  photosSearchSaved: 'Saved',
  photosSearchSearchPeople: 'Search people…',
  photosSearchSearchLibrary: 'Search your library',
  photosSearchSearchLabel: 'Search {label}…',
  photosSearchSort: 'Sort by',
  photosSearchSunsets: 'sunsets',
  photosSearchTextMatch: 'Text match',
  photosSearchYear: 'This year',
  photosSearchTokTime: 'time',
  photosSearchToday: 'Today',
  photosSearchTopScoreScore: 'top score {score}',
  photosSearchTokType: 'type',
  photosSearchUnnamed: 'Unnamed',
  photosSearchBadgeVideo: 'Video',
  photosSearchTypeVideos: 'Videos',
  photosSearchCountMatches: '{count} matches',
  photosSearchCountResultsSecondsS: '{count} results · {seconds}s',
  photosSearchNameSavedSmartView: '“{name}” saved as a Smart View',
  // fix round 1 · I3:PhotosSearchBar 的 placeholder 新键(追加,不重排)。原文见
  // NimoOS-UI/src/assets/lang/en_US.json:2324。
  photosSearchSearchBarPlaceholder: 'Search photos, people, places, or describe in a sentence…',
  // ── SP7-P8a 相册设置页 + 深链 + 错误态 ──
  // zh 文案权威 = Vue2 src/assets/lang/zh_CN.json;json 里没有对应键的(Vue2
  // PhotosSettings.vue 内联硬编码英文)在该键上方单独注明「自拟」与 Vue2 行号。
  // 本期不迁:主题开关(台账第二笔)· AI 入口(D1)· Sign out(D22)· 上传整块(D21)。
  // 自拟(Vue2 PhotosSettings.vue:18 内联 "Settings")
  photosSettingsTitle: 'Settings',
  // Plan H Task 11 review fix: photosSettingsSubtitle (Vue2 PhotosSettings.vue:19 topbar
  // subtitle "Storage · AI behavior") is RESTORED here. The final-review Minor 4 deletion rationale
  // that used to sit on this line is now false: it argued AreaShell.vue's `title`-only prop
  // had no slot for a subtitle, but Task 11's re-shell dropped AreaShell entirely in favor of
  // PhotosTopbar (which DOES take a `sub` prop, same as every other re-shelled Photos view) —
  // that premise no longer holds, so the key is back and wired via `:sub="t('photosSettingsSubtitle')"`.
  // Ad-hoc (Vue2 PhotosSettings.vue:19 inline "Storage · AI behavior")
  photosSettingsSubtitle: 'Storage · AI behavior',
  // 自拟(Vue2 PhotosSettings.vue:31 内联英文长句)
  photosSettingsHeroDesc: 'Everything Nimo does on your NAS — what runs, where it runs, and how much space it takes.',
  // 自拟(Vue2 PhotosSettings.vue:33 内联 "Storage")
  photosSettingsNavStorage: 'Storage',
  // 自拟(Vue2 PhotosSettings.vue:34 内联 "AI behavior")
  photosSettingsNavAi: 'AI behavior',
  // 自拟(Vue2 PhotosSettings.vue:46 内联 "Storage")
  photosSettingsStorage: 'Storage',
  photosSettingsVolume: 'volume',
  photosSettingsFree: 'free',
  photosSettingsUsedOf: 'used of',
  photosSettingsStorageUnavailable: 'Storage info unavailable',
  photosSettingsSegPhotos: 'Photos',
  photosSettingsSegVideos: 'Videos',
  photosSettingsSegRaw: 'RAW originals',
  photosSettingsSegThumbs: 'Thumbnail cache',
  photosSettingsSegAi: 'AI index',
  photosSettingsSegOther: 'Other data',
  // 自拟(Vue2 PhotosSettings.vue:72 内联 "Free"；图例里的"可用"行，与 photosSettingsFree 同义分用两处)
  photosSettingsSegFree: 'Free',
  // 自拟(Vue2 PhotosSettings.vue:81 内联 "Recently Deleted retention")
  photosSettingsRetentionLabel: 'Recently Deleted retention',
  // 自拟(Vue2 PhotosSettings.vue:82 内联长句)
  photosSettingsRetentionDesc: "How long to keep deleted photos before they're permanently removed from the NAS.",
  // 自拟(Vue2 PhotosSettings.vue:87 内联 "{{d}}d"，未走 $t)
  photosSettingsRetentionDay: '{n}d',
  photosSettingsRetentionFailed: 'Failed to save retention',
  photosSettingsRescanLabel: 'Rescan library',
  photosSettingsRescanDesc: 'Scan all drives now and add new photos and videos to the library.',
  photosSettingsRescanNow: 'Rescan now',
  photosSettingsRescanning: 'Rescanning…',
  photosSettingsRescanStarted: 'Library rescan started',
  photosSettingsScanIntervalLabel: 'Auto rescan interval',
  photosSettingsScanIntervalDesc: 'How often to automatically scan all drives for new media.',
  photosSettingsScanIntervalOff: 'Off',
  // 自拟(Vue2 PhotosSettings.vue:116 内联 "Thumbnail cache"；同名 json 键"Thumbnail cache"
  // 被 photosSettingsCacheLabel 复用，此处是同一段文案的两个引用点，取值一致)
  photosSettingsCacheLabel: 'Thumbnail cache',
  photosSettingsCacheDesc: 'Stale previews left behind by deleted photos. Active thumbnails are kept.',
  photosSettingsClearCache: 'Clear cache',
  photosSettingsClearing: 'Clearing…',
  photosSettingsCleared: 'Cleared',
  // json "Cache cleared" + "freed" 拼接键（Vue2 :422 运行时用 `·` 连接两个 $t 片段 +
  // 原始字节数），此处收成一个带 {size} 占位符的完整句子。
  photosSettingsCacheClearedToast: 'Cache cleared · {size} freed',
  photosSettingsCacheClearFailed: 'Failed to clear cache',
  // 自拟(Vue2 PhotosSettings.vue:135 内联 "AI behavior")
  photosSettingsAiTitle: 'AI behavior',
  // 自拟(Vue2 PhotosSettings.vue:136 内联 "What Nimo does, and where it runs.")
  photosSettingsAiSubtitle: 'What Nimo does, and where it runs.',
  // 自拟(Vue2 PhotosSettings.vue:145 内联 "Nothing leaves your NAS")
  photosSettingsPrivacyTitle: 'Nothing leaves your NAS',
  // 自拟(Vue2 PhotosSettings.vue:147-149 内联长句)
  photosSettingsPrivacyBody: 'All inference — faces, scenes, OCR, scoring — runs on this NAS. No image, embedding, or metadata is sent to any external service.',
  // 自拟(Vue2 PhotosSettings.vue:155 内联 "Features")
  photosSettingsFeaturesTitle: 'Features',
  // 自拟(Vue2 PhotosSettings.vue:156 内联长句)
  photosSettingsFeaturesDesc: "Turn off anything you don't want Nimo to compute. Off features stop running and free up cycles.",
  photosSettingsFeatFaces: 'Face recognition',
  photosSettingsFeatFacesDesc: 'Group photos by person, find faces in new uploads.',
  photosSettingsFeatScenes: 'Scene & object detection',
  photosSettingsFeatScenesDesc: 'Powers semantic search — photos turned off here stop being searchable by content.',
  photosSettingsFeatOcr: 'Text in photos (OCR)',
  photosSettingsFeatOcrDesc: 'Search receipts, signs, slides, screenshots.',
  photosSettingsFeatSmartview: 'Smart Views',
  photosSettingsFeatSmartviewDesc: 'Show Smart Views in the sidebar and keep them evaluating new photos.',
  photosSettingsFeatSaveFailed: 'Failed to save AI settings',
  photosSettingsIndexTitle: 'AI index',
  photosSettingsIndexRebuilding: 'Rebuilding…',
  photosSettingsIndexLastBuilt: 'Last built',
  photosSettingsIndexNever: 'never',
  // 自拟——但并非纯自拟:Vue2 PhotosSettings.vue:176 渲染 `{{indexedPct}}% {{ $t('complete.') }}`,
  // 数字未译、"complete." 是 json 键(译"已完成。")。英文语序恰好与 json 片段拼接一致。
  photosSettingsIndexPct: '{pct}% complete.',
  // json "Covers" + "items. Rebuild after restoring from backup or changing the model." 拼接键
  // （Vue2 :177 运行时用 `$t('Covers') + coverageCount + $t('items. Rebuild after…')` 拼接）。
  photosSettingsIndexCoverage: 'Covers {count} items. Rebuild after restoring from backup or changing the model.',
  photosSettingsRebuildIndex: 'Rebuild index',
  photosSettingsRebuiltToast: 'AI index rebuilt',
  photosSettingsRebuildFailed: 'Rebuild failed',
  photosSettingsRebuildStartFailed: 'Failed to start rebuild',
  // 自拟(Vue2 PhotosSettings.vue:189 内联 "Re-cluster faces"，未走 $t)
  photosSettingsRecluster: 'Re-cluster faces',
  photosSettingsReclusterStarted: 'Face re-clustering started in background',
  photosSettingsReclusterFailed: 'Failed to start re-clustering',
  photosSettingsAppearance: 'Appearance',
  photosSettingsThemeDark: 'Dark',
  photosSettingsThemeLight: 'Light',
  // 自拟(Vue2 PhotosSettings.vue:196 内联 "Nimo Photos")
  photosSettingsFooterApp: 'Nimo Photos',
  photosSettingsRunningOn: 'Running on',
  photosSettingsLibrarySince: 'Library since',
  photosDeepLinkPhotoNotFound: 'Photo not found',
  // 自拟(New-UI 新增失败态，Vue2 无对应)
  photosFavoritesLoadFailed: "Couldn't load favorites",
  // 自拟(New-UI 新增失败态，Vue2 无对应)
  photosAlbumLoadFailed: "Couldn't load this album",
  // 自拟(New-UI 新增，两处失败态共用的重试按钮，Vue2 无对应)
  photosRetry: 'Retry',
  // SP15-P3 Task 11: NimoOS-Photos#54 turned an absent limit on GET /photos/favorites into
  // 500 rather than "everything" — these two keys are new-UI-only pagination copy, no Vue2
  // equivalent (Vue2 never paged this endpoint).
  photosLoadedSubsetHint: 'Stats reflect the first {n} loaded items',
  photosLoadMore: 'Load more',
  // ── SP15-P1 Moments ──
  photosMoBadge: 'Moment',
  photosMoTypeTrip: 'Trip',
  photosMoTypePets: 'Pets',
  photosMoTypeFamily: 'Family',
  photosMoTypeTheme: 'Theme',
  photosMoAddedThisWeek: '+{n} this week',
  photosMoHeroTitle: 'Moments · For You',
  photosMoHeroDesc: 'Nimo automatically groups your best shots into moments — trips, people, and themes worth reliving.',
  // SP15-P2b Task 5: the sidebar entry's new label (was "Smart Views"), and the slim
  // settings hint shown when the band is hidden.
  photosMoForYou: 'For You',
  photosMoFollowsSmartViewSetting: 'Moments follows the Smart Views setting — turn it back on in',
  // SP15-P1-T6: shown when moments.reorder() fails a drag-drop and reverts to server order.
  photosMoOrderSaveFailed: 'Failed to save order',
  // ── SP15-P1-T7: moment detail page (Vue2 899af59b:PhotosMomentDetail.vue) ──
  photosMoBackToAll: 'All Moments',
  photosMoLastUpdated: 'Last updated {time}',
  // New-UI only: Vue 2 received the moment as a prop and could never hit a missing id.
  photosMoNotFound: 'This moment no longer exists',
  photosMoAbout: 'About',
  photosMoStats: 'Stats',
  photosMoType: 'Type',
  photosMoTime: 'Time',
  photosMoPlace: 'Place',
  photosMoByMonth: 'By month',
  photosMoSpan: 'Span',
  photosMoSpanDays: '{n} days',
  photosMoLastUpdate: 'Last update',
  photosMoPhotos: 'Photos',
  photosMoFeatured: 'Featured',
  // fix round 1 · finding 4: shown when the moment list itself could not be fetched.
  // Deliberately says nothing about whether the moment exists — we do not know.
  photosMoLoadFailed: "Couldn't load moments",
  // ── SP15-P1-T8: the two photo grids ──
  photosMoAllPhotos: 'All photos',
  // Same English wording as filesViewerLoading/appsSourcesLoading/etc. — not a fresh
  // translation, this repo's existing generic "loading" ellipsis.
  photosMoLoading: 'Loading…',
  photosMoNoPhotosYet: "This moment doesn't have photos yet.",
  // ── SP15-P1-T9: adding photos to the moment / removing them from it ──
  // Vue 2's own en_US strings (899af59b:src/assets/lang/en_US.json). The picker's title
  // deliberately gets no new key — see the note in zh_cn.photos.ts.
  photosMoAddPhotos: 'Add photos',
  photosMoAlreadyIn: 'Already in this moment',
  photosMoAddSelected: 'Add selected',
  photosMoAddedN: 'Added {n} to this moment',
  photosMoAddFailed: 'Add failed',
  photosMoRemoveFromMoment: 'Remove from this moment',
  photosMoRemovedN: 'Removed {n} from this moment',
  photosMoRemoveFailed: 'Remove failed',
  // ── SP15-P1-T10: save as album / delete moment — see the note in zh_cn.photos.ts for the
  // six keys reused instead of duplicated (photosPlacesToastOpen/photosSvPhotosStayLibrary/
  // photosSvDeleteName/photosSvDeleteFailed/photosCancel/photosDelete).
  photosMoSaveAsAlbum: 'Save as Album',
  photosMoAlbumCreated: 'Album "{name}" created · {count} photos',
  photosMoAlbumExists: 'An album with this name already exists',
  photosMoAlbumFailed: 'Could not create album',
  photosMoDeleteMoment: 'Delete moment',
  photosMoDeleteBody: 'The moment is removed. The {n} photos in your library are untouched.',
  photosMoDeleted: 'Moment "{name}" deleted',
  // ── Task 3 (shell + sidebar re-skin): sidebar-head theme toggle button title,
  // Vue2 PhotosSidebar.vue:29's $t('Switch to dark theme')/$t('Switch to light theme').
  photosSwitchToDarkTheme: 'Switch to dark theme',
  photosSwitchToLightTheme: 'Switch to light theme',
  // ── Task 4 (topbar re-skin): the topbar's collapse-toggle button title,
  // Vue2 PhotosTopbar.vue:3's $t('Toggle sidebar'). KVM already has the same copy under
  // kvmToggleSidebar, but that key is namespaced to the KVM area per this repo's
  // per-area-prefix key convention — a new photos-prefixed key here, not a cross-area reuse.
  photosToggleSidebar: 'Toggle sidebar',
  // ── Fix-3 item 7 (owner acceptance, 2026-08-13, Plan F pull-forward): PhotosTopbar's
  // search-mode back-button title, mapped from Vue2 PhotosTopbar.vue:8's $t('Back (Esc)') —
  // New-UI has no Esc semantics here (the search page is a real route, and Esc is already
  // owned by the unified overlay-dismiss handling), so the copy describes the real
  // destination instead of keeping the "(Esc)" wording.
  photosSearchBackToLibrary: 'Back to library',
  // ── Task 7 (Plan D, SP7-P5 people): Hidden people section + hide action + duplicate-name
  // confirm flow — all values below are Vue2's own literal English source strings.
  // Vue2 PhotosPeopleView.vue:228 (section header $t('Hidden people')).
  photosPeopleHiddenSection: 'Hidden people',
  // Vue2 PhotosPeopleView.vue:279 / PhotosPersonDetail.vue:45 — same literal string
  // $t('Hide person') at both call sites, shared as one key.
  photosPersonMenuHide: 'Hide person',
  // Vue2's title attr on both of the above menu items, same literal string
  // (PhotosPeopleView.vue:274 / PhotosPersonDetail.vue:44):
  photosPersonHideGateTitle: 'Person leaves the People page. Photos and face recognition are kept — you can unhide anytime.',
  // Vue2 PhotosPeopleView.vue:249 $t('Unhide').
  photosPeopleUnhide: 'Unhide',
  // Vue2 hideClusterPerson/hideCurrentPerson's success toast, same literal string at both
  // call sites (PhotosPeopleView.vue:759 / PhotosPersonDetail.vue:923): $t('{label} hidden').
  photosPersonHiddenToast: '{label} hidden',
  // Vue2 PhotosPeopleView.vue:317 / PhotosPersonDetail.vue:299 — same literal dupconfirm
  // dialog title at both call sites: $t('A person named "{name}" already exists.').
  photosPersonDupExistsTitle: 'A person named "{name}" already exists.',
  // Vue2's dupconfirm "merge" button at both call sites, literal $t('Merge into existing')
  // (no ellipsis — distinct from the menu item's 'Merge into existing…', photosPersonMergeExisting).
  photosPersonDupMergeInto: 'Merge into existing',
  // Vue2's dupconfirm "name anyway" button at both call sites: $t('Name anyway').
  photosPersonDupNameAnyway: 'Name anyway',
  // Plan G (Ask Nimo): FAB label + composer placeholder, Vue2 PhotosAskNimo.vue / PhotosAgentChat.vue.
  photosAskNimo: 'Ask Nimo',
  photosAskNimoPlaceholder: 'Ask Nimo…',
  // Canned prompts sent when clicking a hero/relations/lightbox Ask Nimo trigger -- distinct from
  // the button LABEL keys (photosPersonAskAbout etc.), which already existed before this plan.
  photosPersonAskAboutPrompt: 'Show me my favorite photos of {name}',
  photosPersonDigDeeperPrompt: 'Tell me more about my photos of {name}',
  photosHandOffToNimoPrompt: 'Edit this photo: {title}',
  photosNimoAgent: 'Nimo Agent',
  photosSelectModel: 'Select model',
  photosGoToSettingsConfigure: 'Go to Settings to configure →',
  photosClearConversation: 'Clear conversation',
  photosOpenFullConversation: 'Open the full conversation in the side drawer',
  photosNimoHideHint: 'Hide — drag from the right edge to bring it back',
  photosNimoDragHint: 'Drag to move · click to show Ask Nimo',
  photosBackgroundTasksCount: '{n} background tasks',
  photosConfirmAction: 'Confirm: {action}',
  photosRequestingAccess: 'Requesting access: {reason}',
  photosAllow: 'Allow',
  photosDeny: 'Deny',
  photosAllowed: 'Allowed',
  photosDenied: 'Denied',
  photosConfirmMissingId: 'Invalid confirmation request (missing confirmId)',
  photosSubmissionFailed: 'Submission failed: {detail}',
  photosUnknownError: 'Unknown error',
  photosModelGroupLocalOllama: 'Local · Ollama',
  photosModelGroupCloudDeepSeek: 'Cloud · DeepSeek',
  photosModelGroupCloudOpenAI: 'Cloud · OpenAI',
  photosModelGroupCloudAnthropic: 'Cloud · Anthropic',
  photosModelGroupCloudQwen: 'Cloud · Qwen',
  photosModelGroupOther: 'Other',
  photosModelProviderCloudFallback: 'Cloud',
  photosTaskIndexing: 'Indexing photos',
  photosTaskEmbedding: 'Generating AI index',
  photosTaskOcr: 'Recognizing text in images',
  photosTaskFace: 'Recognizing people',
  photosTaskRebuild: 'Rebuilding AI index',
  photosTaskAesthetic: 'Scoring photo aesthetics',
  photosTaskFailed: 'Failed',
  photosSuggestLastWeekend: 'Last weekend',
  photosSuggestBestSunsets: 'Best sunsets',
  photosSuggestFindPeople: 'Find people',
  photosGridAskNimoRecap: 'Build a recap album from these {count} photos.',
  photosSearchFindPhotosPrefix: 'Find photos: ',
}
