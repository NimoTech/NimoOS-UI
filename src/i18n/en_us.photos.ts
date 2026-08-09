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
  photosSelectedCount: '{count} selected',
  photosDelete: 'Delete',
  photosCancel: 'Cancel',
  photosNoPhotos: 'No photos yet',
  photosNoPhotosHint: 'Photos will appear here once indexed',
  photosUnknownDate: 'Unknown Date',
  photosDeletedToast: '{count} item(s) moved to Recently Deleted',
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
  photosZoomIn: 'Zoom in',
  photosZoomOut: 'Zoom out',
  photosRotate: 'Rotate',
  photosReset: 'Reset',
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
  // ── Photos: Trash view ──
  photosTrashTitle: 'Recently Deleted',
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
  photosTrashSortDaysLeft: 'Days left',
  photosTrashSortRecent: 'Recently deleted',
  photosTrashUndo: 'Undo',
  // ── Photos: Bucket titles ──
  photosTrashBucketUrgent: 'Deleting in 1–7 days',
  photosTrashBucketSoon: 'Deleting in 8–14 days',
  photosTrashBucketLater: 'Deleting in 15–21 days',
  photosTrashBucketFresh: 'Deleted recently',
  photosTrashBucketUrgentDesc: 'Will be deleted within a week',
  photosTrashBucketSoonDesc: 'Will be deleted within two weeks',
  photosTrashBucketLaterDesc: 'Will be deleted within three weeks',
  photosTrashBucketFreshDesc: 'Recently deleted items',
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
  photosTrashEmptiedToast: 'Trash emptied · {size} MB freed',
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
  photosAlbumNewHint: 'Click to create',
  photosAlbumUntitled: 'Untitled',
  photosAlbumsEmptyTitle: 'No albums yet',
  photosAlbumsEmptyHint: 'Create an album to group photos together.',
  photosAlbumSort: 'Sort:',
  photosAlbumSortUpdated: 'Last updated',
  photosAlbumSortUpdatedHint: 'Server order',
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
  photosAlbumFillEmptyHint: 'Add photos later',
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
  photosAlbumRename: 'Rename album',
  photosAlbumDelete: 'Delete album',
  photosAlbumDeleteHint: 'Photos stay in your library',
  photosAlbumDeleteTitle: 'Delete "{name}"?',
  photosAlbumDeleteBody: 'The album wrapper is removed but the {count} items stay in your library.',
  photosAlbumItemsShown: '{count} items shown',
  photosAlbumHintSelectDragCover: 'Click to select · Drag to reorder · ★ to set cover',
  photosAlbumHintSelectCover: 'Click to select · ★ to set cover',
  photosAlbumRemoveFrom: 'Remove from album',
  photosAlbumAddPhotos: 'Add photos',
  photosAlbumSortManual: 'Manual order',
  photosAlbumSortTaken: 'Date taken',
  photosAlbumSortAdded: 'Date added',
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
  photosFavSaveAlbum: 'Save as album',
  photosFavSaveAlbumTitle: 'Save favorites as album',
  photosFavSaveAlbumDefault: 'Favorites · {year}',
  // 评审 Important 2:补 Vue2 PhotosFavoritesView.vue:267-268/279-281 的副标题+脚注(T3
  // 键清单漏列)。英文值逐字取自 Vue2 源(插值变量对齐成 {count})。
  photosFavSaveAlbumSub: 'Snapshot {count} favorited photos into a new album',
  photosFavSavedToast: '"{name}" saved · {count} photos',
  photosFavSaveFailed: 'Save failed',
  photosFavSaveAlbumNote: "The album becomes a static snapshot — it won't update when you favorite new photos. You can always make a new one later.",
  // ── Photos: People (SP7-P5, task-3). en values are verbatim Vue2 $t() literal
  // arguments (Vue2 uses the English string itself as the i18n key).
  photosPeople: 'People',
  photosPeopleNamed: '{n} named',
  photosPeopleUnnamedClusters: '{n} unnamed clusters',
  photosPeopleIndexedUpTo: 'Faces indexed up to {date}',
  photosPeopleConfidence: 'Confidence ≥ {n}%',
  photosPeopleConfidenceOption: '≥ {n}%',
  photosPeopleClusters: '{n} clusters',
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
  // Final-review Minor 8: photosPersonSubtitle ('Person details · faces & relationships') was
  // removed — zero references repo-wide. It belongs to Vue2 PhotosPeopleTopbar.vue:36 (detail
  // state), and that whole topbar is not ported here (AreaShell has only a title, hidden on
  // desktop); the index-state subtitle of the same topbar has no key here either. Do not confuse
  // it with photosPeopleNamed / photosPeopleUnnamedClusters — those come from Vue2's *banner*
  // (PhotosPeopleView.vue:7-9) and are rendered in .people-sub.
  photosPersonTabTimeline: 'Timeline',
  photosPersonTabPlaces: 'Places',
  photosPersonTabRelations: 'Relationships',
  photosPersonStatPhotos: 'Photos',
  photosPersonStatPlaces: 'Places',
  photosPersonStatAppearsWith: 'Appears with',
  photosPersonStatFirstSeen: 'First seen',
  photosPersonMakeAlbum: 'Make album',
  photosPersonBackground: 'Background',
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
  photosPersonRelationFailed: 'Could not update group', // ★
  photosPersonFavFailed: 'Could not update favorite', // ★
  photosPersonNoPhotos: 'No photos for this person yet', // ★
  photosPersonNotFound: 'Person not found', // ★
  photosPersonBack: 'Back to people', // ★
  photosPeopleEmptyTitle: 'No people yet', // ★
  photosPeopleEmptyHint: 'Nimo groups faces as your library is indexed.', // ★
  photosPersonShowAll: 'Show all {n}', // ★
  photosPersonShowLess: 'Show less', // ★
  photosPersonPlacesLegend: 'Top places',
  photosPersonNoPlaces: 'No location data for {name} yet',
  photosPersonNimoRead: "Nimo's read",
  photosPersonInsightWith: '{name} appears most often with <b>{other}</b>.',
  photosPersonInsightWithUnnamed: '{name} appears together with an unnamed person.',
  photosPersonInsightPlaces2: 'Their photos cluster in <b>{place1}</b> and <b>{place2}</b>.',
  photosPersonInsightPlace1: 'Their photos cluster in <b>{place}</b>.',
  photosPersonInsightNone: 'Not enough photos of {name} yet for an insight.',
  photosPersonUnknownPlace: 'Unknown', // no bare "Unknown" entry in zh_CN.json, see report caveats
  // SP7-P5 task-6 addition: two UI strings missed by T3; wording taken from Vue2
  // zh_CN.json (:2072 / :2079) by the coordinator. Appended at the end of the
  // photos block — existing keys are not reordered.
  photosPeopleMinScore: 'Min face match score', // confidence dropdown header, Vue2 PhotosPeopleView.vue:24-26
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
  photosSvNameSnapshotSavedAlbum: '"{name}" snapshot saved as a new album',
  photosSvAddedThisWeek: '+{n} this week',
  // P7a-T8 fix round 1 · I3: strip literal <b>, switch to <i18n-t> named slots (zero
  // v-html). Re-checked zh_CN.json source: both rows bold the whole "interpolation +
  // language-specific word" phrase (`<b>1 张新照片</b>` / `<b>{n} 张新照片</b>` are
  // symmetric) ⇒ both split into a base-sentence key + a bold-phrase key, not treated
  // differently (see SmartViewActivityFeed.vue header comment + task-8-report.md).
  photosSvActOneMatched: '{photo} auto-added',
  photosSvActOneMatchedBold: '1 new photo',
  photosSvActNMatched: '{photo} auto-added',
  photosSvActNMatchedBold: '{n} new photos',
  photosSvActivity: 'Activity',
  photosSvAdd: 'Add',
  photosSvAddAnother: 'Add another…',
  photosSvAddCondition: 'Add condition',
  photosSvAllMatches: 'All matches',
  photosSvAllSmartViews: 'All Smart Views',
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
  photosSvCopyQuerySv: 'Copy the query as a new SV',
  photosSvCreateSmartView: 'Create Smart View',
  photosSvDeleteName: 'Delete "{name}"?',
  photosSvDeleteSmartView: 'Delete Smart View',
  photosSvDescribePlainEnglishConditions: 'Describe it in plain English — conditions are inferred below',
  photosSvDescribeWantSetQuality: 'Describe what you want, set a quality threshold, and Nimo keeps it filled.',
  photosSvDone: 'Done',
  photosSvDuplicate: 'Duplicate',
  photosSvDuplicatedNameOpenCopy: 'Duplicated "{name}" — open the new copy from the list',
  photosSvEGSaraTokyo: 'e.g. Sara · Tokyo · sunsets',
  photosSvEGSceneSunset: 'e.g. scene: sunset',
  photosSvExport: 'Export',
  photosSvExportedDetail: 'Exported as {detail}',
  photosSvFamilyWeekends: 'Family weekends',
  photosSvFamilyWeekendsPark: 'Family weekends in the park',
  photosSvExportFile: 'file',
  photosSvIncludeVideos: 'Include videos',
  photosSvKeepLive: 'Keep it live',
  photosSvLastUpdate: 'Last update',
  photosSvLastUpdatedTime: 'Last updated {time}',
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
  photosSvNewCondition: 'New condition',
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
  photosSvSaveStaticAlbum: 'Save as static Album',
  photosSvSavedSearchKeepsItself: 'Saved search that keeps itself up to date',
  photosSvSavedSearchesStayLive: 'Saved searches that stay live. Nimo continuously evaluates new photos and adds matches that score above your threshold.',
  photosSvSettingsSection: 'Settings',
  photosSvSharpDogCatPortraits: 'Sharp dog and cat portraits',
  photosSvBadgeSmartView: 'Smart View',
  photosSvSmartViewNameDeleted: 'Smart View "{name}" deleted',
  photosSvSmartViewCreated: 'Smart View created',
  photosSvSmartViewRenamed: 'Smart View renamed',
  photosSvSmartViews: 'Smart Views',
  photosSvSmartViewsAutoUpdate: 'Smart Views auto-update is off',
  photosSvSnapshotCurrentMatchesStops: 'Snapshot the current matches — stops updating',
  photosSvStats: 'Stats',
  photosSvStrict: 'Strict',
  photosSvStrictOnlyHighestConfidence: 'Strict — only the highest-confidence matches.',
  photosSvSuggestions: 'Suggestions',
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
  photosSearchOpenSmartViews: 'Open in Smart Views →',
  photosSearchPeople: 'People',
  photosSearchTokPerson: 'person',
  photosSearchBadgePhoto: 'Photo',
  photosSearchTypePhotos: 'Photos',
  photosSearchPlaces: 'Places',
  photosSearchPreviousMonth: 'Previous month',
  photosSearchQuickRange: 'Quick range',
  photosSearchRecentSearches: 'Recent searches',
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
  // 终审 Minor 4:此处原有 photosSettingsSubtitle(Vue2 PhotosSettings.vue:19 顶栏
  // 副标题 "Storage · AI behavior")已删 —— 全仓零引用。AreaShell.vue:6 的 props 只有
  // `title`,没有承载副标题的位置,这行 Vue2 顶栏文案在 New-UI 里因此被刻意丢弃,不是漏迁。
  // 同 photosSvSettingsPending 的删除先例(zh_cn.ts 对应处)。
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
  // ── SP15-P1 Moments ──
  photosMoBadge: 'Moment',
  photosMoTypeTrip: 'Trip',
  photosMoTypePets: 'Pets',
  photosMoTypeFamily: 'Family',
  photosMoTypeTheme: 'Theme',
  photosMoAddedThisWeek: '+{n} this week',
  photosMoHeroTitle: 'Moments · For You',
  photosMoHeroDesc: 'Nimo automatically groups your best shots into moments — trips, people, and themes worth reliving.',
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
}
