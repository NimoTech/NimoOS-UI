// SP7-P8b:相册区文案分片。
//
// 为什么独立成文件:①SP9 起的分片约定(新键只落分片,免得几条并行线在同一文件上相撞,
// 见 src/i18n/index.ts 的注释)②**更要紧的是开源导出** —— 开源版没有相册区,而给 700 多行
// 文案写锚点补丁会让以后改任何一条相册文案都把导出打红(oss/manifest.mjs 的 PATCH 要求命中
// 恰好 1 次);抽成独立文件后,开源侧只需把这两个分片整体删掉 + 改 index.ts 一行。
//
// 内容是从 zh_cn.base.ts(即原 zh_cn.ts)原样搬来的 photos* 前缀键(顺序、注释、行尾标记全部保留),
// 一个字没改 —— 等价性由 __tests__/photosSlice.test.ts 与抽取当时的 JSON 快照逐键比对证明。
export default {
  // ── 相册 ──
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
  photosSelectedCount: '已选择 {count} 项',
  photosDelete: '删除',
  photosCancel: '取消',
  photosNoPhotos: '暂无照片',
  photosNoPhotosHint: '照片入库后会出现在这里',
  photosUnknownDate: '未知日期',
  photosDeletedToast: '{count} 项已移入最近删除',
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
  // ── 相册:收藏视图 ──
  photosFavTitle: '收藏',
  photosFavEmptyTitle: '暂无收藏',
  photosFavEmptyHint: '在任意照片上点 ★ 即可收藏，收藏会永久保留。',
  photosFavExport: '下载为 ZIP',
  photosFavExporting: '开始打包下载…',
  photosFavCount: '{count} 张收藏',
  // Task 3 (Plan H) review fix: hero stats sub-line -- Vue2 bolds ONLY the raw
  // number (`<b>{{ photoCount }}</b> {{ $t('photos_count') }}`), the noun sits
  // outside <b>, so these are noun-only keys (not "{n} photos" one-piece
  // strings) matching Vue2 PhotosFavoritesView.vue:11-12's photos_count/videos
  // copy exactly ('张照片'/'视频', no quantifier word).
  photosFavHeroPhotosNoun: '张照片',
  photosFavHeroVideosNoun: '视频',
  photosFavHeroKeptForever: '永久保留',
  // Task 4 (Plan H):置顶精选条(服务端排序 top5,GET /favorites/top)—— 对应 Vue2
  // PhotosFavoritesView.vue:89-90。
  photosFavPinnedTitle: '精选亮点',
  photosFavPinnedSub: '你最常收藏的瞬间 · Nimo 精选',
  // Task 5 (Plan H):幻灯片播放 —— 对应 Vue2 PhotosFavoritesView.vue:18-19(入口按钮)/
  // :237-273(播放层:关闭、上一张/下一张、暂停/播放、三档速度)。
  photosFavSlideshow: '幻灯片播放',
  photosFavSlideClose: '关闭 (Esc)',
  photosFavSlidePrev: '上一张 (←)',
  photosFavSlideNext: '下一张 (→)',
  // 评审 Minor 4:补 Vue2 :256 播放/暂停按钮的 title(值取自 NimoOS-UI/src/assets/lang/zh_CN.json:2244)。
  photosFavSlidePlayPause: '播放/暂停 (空格)',
  photosFavSlideSpeed: '速度',
  photosFavSlideFast: '快',
  photosFavSlideNormal: '正常',
  photosFavSlideSlow: '慢',
  // ── 相册:最近删除视图 ──
  photosTrashTitle: '最近删除',
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
  photosTrashSortDaysLeft: '剩余天数',
  photosTrashSortRecent: '最近删除',
  photosTrashUndo: '撤销',
  // ── 相册:分桶标题 ──
  photosTrashBucketUrgent: '1–7 天内删除',
  photosTrashBucketSoon: '8–14 天内删除',
  photosTrashBucketLater: '15–21 天内删除',
  photosTrashBucketFresh: '最近删除',
  photosTrashBucketUrgentDesc: '将在一周内删除',
  photosTrashBucketSoonDesc: '将在两周内删除',
  photosTrashBucketLaterDesc: '将在三周内删除',
  photosTrashBucketFreshDesc: '最近删除的项',
  // ── 相册:确认弹窗 ──
  photosTrashRestoreAllTitle: '恢复全部 {count} 项？',
  photosTrashRestoreAllBody: '它们会回到原来的位置，重新出现在资料库、相册和时间线中。',
  photosTrashDeleteSelTitle: '永久删除 {count} 项？',
  photosTrashDeleteSelBody: '这将立即从 NAS 中清除,此操作无法撤销。',
  photosTrashEmptyTitle2: '永久删除全部 {count} 项？',
  photosTrashEmptyBody: '这将在 NAS 上释放 {size} MB,原始文件将无法恢复。',
  // ── 相册:Toast ──
  photosTrashRestoredToast: '{count} 项已恢复到资料库',
  photosTrashPurgedToast: '{count} 项已永久删除 · 释放 {size} MB',
  photosTrashEmptiedToast: '最近删除已清空 · 释放 {size} MB',
  // Task 12 (SP15-P3): while pages remain, the freed-size figure is only computed from the
  // loaded subset — these size-less variants are used instead until trashExhausted.
  photosTrashEmptiedToastPartial: '最近删除已清空',
  photosTrashEmptyBodyPartial: '这将释放 NAS 上的空间，原始文件将无法恢复。',
  photosTrashRestoreFailed: '恢复失败',
  photosTrashDeleteFailed: '删除失败',
  photosTrashEmptyFailed: '清空失败',
  photosFavExportFailed: '导出失败',
  // ── 相册:侧栏 / 列表页 ──
  photosAlbums: '相册',
  photosAlbumsTitle: '相册',
  photosAlbumsCount: '{count} 个相册',
  photosAlbumsMine: '我的相册',
  photosAlbumsMineHint: '你创建的相册',
  photosAlbumNew: '新建相册',
  photosAlbumNewHint: '点击创建或询问 Nimo',
  photosAlbumUntitled: '未命名',
  // SP15-P2b Task 3: the mixed grid's section subtitle when both manual and smart albums
  // are empty (939a7d3a:PhotosAlbumsView.vue). Inserted here, next to the rest of the
  // "no albums" copy cluster, rather than by the photosAlbums* family's scattered global
  // order.
  // fix round 1 (Important 3): photosAlbumsEmptyTitle/photosAlbumsEmptyHint, which used to
  // sit right above this key, are deleted (grep-confirmed zero other consumers) -- they
  // backed a standalone empty-state panel that duplicated this subtitle's own "还没有相册"
  // copy once smart albums joined the grid. Vue2 has no such panel either (see the matching
  // PhotosAlbums.vue comment), so removing it is a 1:1 correction, not a feature cut.
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
  // ── 相册:新建相册模态 ──
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
  // ── 相册:详情页 ──
  photosAlbumBack: '相册',
  photosAlbumLabel: '相册',
  photosAlbumClickToRename: '点击重命名',
  photosAlbumEdit: '编辑',
  photosAlbumDone: '完成',
  photosAlbumRenameHint: '修改相册名称',
  photosAlbumConvertToSmart: '转为智能相册',
  photosAlbumConvertToSmartHint: 'Nimo 会自动持续加入匹配的新照片',
  // Task 5 (#117 短标题): "..." 菜单主标题改短——Rename/Duplicate/Download as ZIP 三项复用既有
  // 短键(photosSvRename/photosSvDuplicate/photosFavExport,与靶子译文逐字一致),Delete 复用
  // photosDelete;只有 Convert 没有现成的通用短键,新增这一个。
  // Task 11 孤儿清理:photosAlbumRename 失去了唯一引用,已删;photosAlbumConvertToSmart
  // 留下——AlbumConvertToSmartDialog 的标题/确认按钮仍在用它。
  photosAlbumMenuConvert: '转换',
  // Whole-branch review, Important 2: the "..." menu's Convert entry has its own desc in the
  // target (33b05636 PhotosAlbumDetail.vue:266 "Turn into a Smart Album that keeps updating",
  // zh_CN.json:2836). It is NOT the same string as photosAlbumConvertToSmartHint above, which
  // the target uses only as the convert modal's subtitle (:375) -- the menu entry pointed at
  // that one for the whole phase because this key was specified in the plan's i18n table but
  // never created. AlbumConvertToSmartDialog.vue stays on the modal key.
  photosAlbumMenuConvertHint: '转为持续自动更新的智能相册',
  // Task 5:Duplicate 项的 desc——靶子字面 "Copy the photos as a new album"(33b05636
  // zh_CN.json:"把照片复制为一个新相册")。
  photosAlbumDuplicateHint: '把照片复制为一个新相册',
  // ── Task 7: 相册 → 智能相册转换弹窗 ──
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
  // Whole-branch review, Important 3: the target keeps the select bar's copy and the tile
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
  // SP15-P2c Task 3: the detail-page skeleton shared with the smart-view detail page.
  // photosDetailItems/photosDetailVideos are the lowercase header-stats words that follow a
  // bold number ("12 items"), not the sidebar stat-cell captions (photosMoPhotos /
  // photosAlbumStatVideos) -- the English differs in case, so they are separate keys.
  photosDetailCreatedAt: '创建于 {date}',
  photosDetailItems: '项',
  photosDetailVideos: '视频',
  // Task 4: About section's "Time span" row label. Distinct from photosMoTime (moment detail's
  // own About row calls its third field "Time", a different label for a different thing).
  photosDetailTimeSpan: '时间跨度',
  photosAlbumCurrentCover: '当前封面',
  photosAlbumSetCover: '设为相册封面',
  photosAlbumEmptyTitle: '相册是空的',
  photosAlbumEmptyHint: '点「添加照片」从图库中挑选。',
  // New-UI 补齐项(Vue2 无独立详情路由,不会出现此情形):直链/刷新进入一个不存在的相册 id。
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
  // ── 相册:库选择器(添加照片) ──
  photosAlbumPickerTitle: '添加照片到「{name}」',
  photosAlbumPickerEmpty: '没有可添加的照片。',
  photosAlbumPickerAlready: '已在相册中',
  photosAlbumPickerAdding: '添加中…',
  photosAlbumPickerAdd: '添加({count})',
  photosAlbumPickerDiscard: '还有未保存的选择,确定关闭吗?',
  photosAlbumPickerDiscardConfirm: '确定',
  photosAlbumAddedToast: '已添加 {count} 项到「{name}」',
  photosAlbumAddFailed: '添加失败',
  // ── 相册:相册选择器(加入相册) ──
  photosAddToAlbum: '加入相册',
  photosAddToAlbumTitle: '加入相册',
  photosAddToAlbumEmpty: '还没有相册,先新建一个。',
  photosAddToAlbumNew: '+ 新建相册',
  // ── 相册:收藏视图 Save as Album ──
  photosFavSaveAlbum: '存为相册',
  photosFavSaveAlbumTitle: '把收藏存为相册',
  photosFavSaveAlbumDefault: '收藏 · {year}',
  // 评审 Important 2:补 Vue2 PhotosFavoritesView.vue:267-268/279-281 的副标题+脚注(T3
  // 键清单漏列)。中文值取自 NimoOS-UI/src/assets/lang/zh_CN.json:2187/2231。
  photosFavSaveAlbumSub: '将 {count} 张收藏的照片快照保存为新相册',
  photosFavSavedToast: '「{name}」已保存 · {count} 张照片',
  photosFavSaveFailed: '保存失败',
  photosFavSaveAlbumNote: '相册会成为静态快照 —— 收藏新照片时不会自动更新。你可以随时再新建一个。',
  // ── 相册:人物(SP7-P5,task-3)。中文值逐字取自 NimoOS-UI/src/assets/lang/zh_CN.json,
  // 用同句英文原文当 key 查出。术语统一:Unnamed clusters→"未命名人物",不用"簇/聚类"
  // (下方标注 [聚类→人物] 的几条为按此规则改写,原查得译文含"聚类" 二字)。
  photosPeople: '人物',
  // Plan D Task 2 (re-shell): PhotosTopbar's `sub` line, for this page's index route. Vue2
  // PhotosPeopleTopbar.vue:37's index-state subtitle is "Face clusters · {named} named ·
  // {unnamed} unnamed"; this key's task brief gave the count portion verbatim but deliberately
  // dropped the "Face clusters ·" prefix (per the brief itself), so only the count clause is
  // kept here — not a missed transcription.
  photosPeopleTopbarSub: '{named} 个已命名 · {unnamed} 个未命名',
  photosPeopleNamed: '{n} 个已命名',
  photosPeopleUnnamedClusters: '{n} 个未命名人物', // [聚类→人物],原文 "{n} 个未命名聚类"
  photosPeopleIndexedUpTo: '人脸索引更新至 {date}',
  photosPeopleConfidence: '置信度 ≥ {n}%',
  photosPeopleConfidenceOption: '≥ {n}%',
  photosPeopleClusters: '{n} 个人物', // [聚类→人物],原文 "{n} 个聚类"
  photosPeopleFilterAll: '全部',
  photosPeopleFilterFamily: '家人',
  photosPeopleFilterFriends: '朋友',
  photosPeopleFilterWork: '工作',
  photosPeopleFilterRecent: '最近',
  // Vue2 是两个分开的 $t('Sort:') + $t(label),New-UI 合成单键,zh 取 "排序：" 原译文拼接
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
  photosPeopleMergeFound: 'Nimo 发现了 {n} 个可能的合并',
  // 术语红线:"集群"同"簇/聚类"一类工程词,面向用户文案不用,改"两组人脸/已合并到"(fix-1)
  photosPeopleMergeReasonNamed: '两组人脸高度相似（{pct}%），可能都是 {name}。',
  photosPeopleMergeReasonUnnamed: '两组人脸高度相似（{pct}%），可能是同一个人。',
  photosPeopleMergeReview: '查看',
  // ★ New-UI 补齐:Vue2 该关闭按钮无 title/aria(a11y 缺口),New-UI 必须补 aria-label,协调者已给定文案(fix-1)
  photosPeopleMergeDismissAll: '忽略全部合并建议',
  photosPeoplePinned: '置顶',
  photosPeoplePinnedHint: '你收藏的人物',
  photosPeopleNamedSection: '已命名',
  photosPeopleNamedHint: '{n} 个，按频率排序',
  photosPeopleUnnamedSection: '未命名人物', // 术语规则直给,不查表(表里是"未命名聚类")
  photosPeopleUnnamedHint: '{n} 个人物 · 点击命名、合并或删除', // [聚类→人物]
  photosPeopleHideSingle: '隐藏单张照片',
  photosPeopleShowSingle: '显示 {n} 张单照片',
  photosPeopleHide: '隐藏',
  photosPeopleShow: '显示',
  photosPeoplePhotosCount: '{n} 张照片',
  // 用户验收新增键(Vue2 无对应原文):未命名人物菜单的详情页入口 + 详情页 hero 在人物
  // 无名字时的兜底标题。Vue2 里未命名人物根本进不去详情页,所以这两处它都不需要文案。
  photosPersonViewPhotos: '查看这些照片',
  photosPersonUnnamedTitle: '未命名人物',
  photosPersonNameThis: '为这个人命名…',
  photosPersonMergeExisting: '合并到已有人物…',
  photosPersonDeleteCluster: '删除这个人物', // 术语红线:原查得"删除集群",改掉"集群"(fix-1)
  photosPersonNameTitle: '为这个人命名',
  photosPersonNamePlaceholder: '如 Sara / Lily / 老松',
  photosPersonNameHint: '命名后 Nimo 会把 {n} 张照片中包含这张脸的都归到这个人名下，以后新导入也会自动识别。',
  photosPersonSaveName: '保存名字',
  photosPersonNamedToast: '「{name}」已添加 · {count} 张照片',
  photosPersonMergeTitle: '合并到已有人物',
  photosPersonMergeSearch: '搜索现有人物…',
  photosPersonNoMatch: '没有匹配的人物',
  photosPersonMergedToast: '已合并到「{name}」', // 术语红线:原查得"集群已合并到…",去掉"集群"(fix-1)
  photosPersonMergeFailed: '合并失败', // ★ New-UI 补齐,brief 已直给中文
  photosPersonDeleteTitle: '删除这个人物分组？',
  photosPersonDeleteBody: '照片会保留。人物分组与识别记录将被永久删除。你可以在 5 秒内撤销。',
  photosPersonConfirmDelete: '确认删除',
  photosPersonDeletedToast: '{label} 已删除',
  photosPersonUndo: '撤销',
  photosPersonMergeSuggestTitle: '可能的合并 {idx} / {total}',
  photosPersonMergeSuggestConfidence: '置信度 {n}%',
  photosPersonNotAMatch: '不是同一个人',
  // Vue2 是 $t('Merge as') + 内嵌名字,New-UI 合成单键
  photosPersonMergeAs: '合并为 {name}',
  photosPersonMergeAsSame: '同一个人',
  // T8 新增(brief 列举的键里没有,确认缺失后补的):Vue2 审阅弹窗两列对比下方的固定标签
  // $t('Cluster A')/$t('Cluster B')(:400,418),旧仓 zh_CN.json:1993-1994 原译"集群 A/B"——
  // "集群"触犯本期术语红线(同 :803 fix-1 的先例),改用"组 A/B"。
  photosPersonMergeGroupA: '组 A',
  photosPersonMergeGroupB: '组 B',
  // T8 新增:Vue2 审阅弹窗理由条的品牌前缀 $t('Nimo:')(:423),旧仓 zh_CN.json:2091 原译
  // 就是字面 "Nimo:"(品牌名,中英一致,不翻译)。
  photosPersonMergeNimoLead: 'Nimo:',
  // T8 新增:Vue2 onRejectReview 拒绝后的 toast 文案 $t('Suggestion dismissed')(:613)。
  // accept 路径复用既有 photosPersonMergedToast(:812)而不是另建一个"Merged as…"键——
  // 两句在 Vue2 里字面不同,但语义都是"已合并到 X",同 mergeReason/PersonAvatar 的既有
  // 统一惯例(把 Vue2 里重复的同义文案收成一份),已在任务报告里登记这条不是疏漏。
  photosPersonMergeDismissedToast: '已忽略该合并建议',
  // Plan D Task 3: photosPersonSubtitle ("Person detail · faces & relations") is revived. Final
  // review Minor 8 (back in the earlier P5 phase) deleted it, on the grounds that the detail
  // page's topbar was AreaShell at the time (title only, hidden entirely on desktop), so Vue2
  // PhotosPeopleTopbar.vue:36's detail-state subtitle had nowhere to live. Task 3 re-shelled
  // PhotosPersonDetail.vue onto PhotosTopbar (title/sub/back props), which is exactly that
  // detail-state slot — this key is genuinely needed again now. Don't confuse it with
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
  // Task 8 (Plan D): the hero's three buttons filled in (Vue2 PhotosPersonDetail.vue:89-91). The
  // click here is a no-op (wiring belongs to Plan G); this only adds copy and visuals first.
  photosPersonAskAbout: '问 Nimo 关于 {name}',
  // ★ New-UI 补齐(Task 10):Vue2 :33 该按钮字面是通用的 $t('Edit')(胶囊触发按钮本身的
  // 文案,不是下面三个菜单项),本仓 photosAlbumEdit/topbarEdit 等既有"编辑"键都各自绑定
  // 别的具体场景(相册网格编辑态/桌面编辑态),语义不是"打开这个人物的重命名/合并/删除菜单"——
  // 不复用会在那些键改动时被无关连累,故单独开一个人物专属键。
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
  // Vue2 :884-897 单/复数各一套文案,fix-2 起改为 4 条全加(此前只留复数通用形式已删)
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
  // 终审 Minor 10:这句英文原文 `Rename failed` 在旧仓 zh_CN.json 里**有**对应译文
  // "重命名失败",★(= 本仓自拟)标错了;按分支纪律「译文一律从旧仓查同句英文原文」
  // 改回原译,不再用自拟的"改名失败"。
  photosPersonRenamedFailed: '重命名失败',
  photosPersonAlbumCreatedToast: '已创建相册 · {name}', // ★
  // 终审 Minor 10:同上 —— `Could not create album` 在 zh_CN.json 里有原译"相册创建失败",
  // ★ 标错了,改回原译(原为自拟的"无法创建相册")。
  photosPersonAlbumFailed: '相册创建失败',
  // ── 终审 Minor 9/10 复核结论 ─────────────────────────────────────────────
  // 以下这批带 ★ 的键:★ 的含义是「Vue2 没有这句文案,本仓自拟」(约定见 :788 / :813)。
  // 终审要求逐条回旧仓 zh_CN.json 复核,已核完:这批的英文原句在 zh_CN.json 里**确实不存在**
  // (`Could not update group` / `Could not update favorite` / `No photos for this person yet` /
  //  `Person not found` / `Back to people` / `No people yet` / `Nimo groups faces…` /
  //  `Show all {n}` / `Show less` 均查无此条),所以 ★ 对它们是准确的,译文按术语惯例自拟成立。
  // 唯独上面 photosPersonRenamedFailed / photosPersonAlbumFailed 两条查得到原译,已改回(Minor 10)。
  // Final-review follow-up (fix round, Plan D): the ★ that used to sit on `photosPersonNotFound`/
  // `photosPersonBack` below has gone stale — Vue2 commit 03245590 later added matching copy for
  // both (`Person not found` / `Back to People`, PhotosPersonDetail.vue:471/473, part of the same
  // fallback-branch source this task's I1 re-anchor draws from), so they are no longer "no Vue2
  // copy, authored here." ★ removed from both.
  photosPersonRelationFailed: '无法更新分组', // ★
  photosPersonFavFailed: '无法更新收藏', // ★
  photosPersonNoPhotos: '这个人还没有照片', // ★
  photosPersonNotFound: '找不到这个人物',
  photosPersonBack: '返回人物',
  photosPeopleEmptyTitle: '还没有识别出人物', // ★
  // Task 6 (Plan D, PR#137 gap-close): replaces the old single `photosPeopleEmptyHint` —
  // Vue2 #137 splits into two copy branches (face recognition on/off); translation taken from
  // Vue2 commit 03245590's own zh_CN.json translation.
  photosPeopleEmptyHintFaces: '照片索引过程中会自动识别人脸，人物很快会出现在这里。',
  photosPeopleEmptyHintNoFaces: '开启人脸识别后，即可在照片中发现人物。',
  photosPersonShowAll: '查看全部 {n} 张', // ★
  photosPersonShowLess: '收起', // ★
  photosPersonPlacesLegend: '常去地点',
  photosPersonNoPlaces: '暂无 {name} 的位置数据',
  photosPersonNimoRead: 'Nimo 的解读',
  // Task 8 (Plan D): the rel-insight-card's bottom "Dig deeper" button (Vue2
  // PhotosPersonDetail.vue:228-230 `.nimo-btn`). The click is a no-op (wiring belongs to Plan G).
  photosPersonDigDeeper: '深挖',
  photosPersonInsightWith: '{name} 最常与 <b>{other}</b> 一起出现。',
  photosPersonInsightWithUnnamed: '{name} 与一位未命名的人一起出现。',
  photosPersonInsightPlaces2: '他们的照片集中在 <b>{place1}</b> 和 <b>{place2}</b>。',
  photosPersonInsightPlace1: '他们的照片集中在 <b>{place}</b>。',
  photosPersonInsightNone: '{name} 的照片还不够多，暂无法生成洞察。',
  photosPersonUnknownPlace: '未知', // zh_CN.json 无裸 "Unknown" 条目,按同文件 "Unknown date"→"未知日期" 的既有惯例取"未知",见报告疑虑项
  // SP7-P5 task-6 补:T3 漏掉的两条界面文案,协调者已从 zh_CN.json 查得原译文给定
  // (:2072 / :2079)。追加在段末,不重排既有键。
  photosPeopleMinScore: '最低人脸匹配分数', // 置信度下拉小标题,Vue2 PhotosPeopleView.vue:24-26
  photosPeopleClusterHint: '+ 命名 / 合并 / 删除', // 未命名卡片悬停提示,Vue2 :204
  // T7 协调者补:ClusterActionDialog 命名模式的 <label>,原文 zh_CN.json:49 "Name": "名称"。
  // 追加在段末,不重排既有键。
  photosPersonNameLabel: '名称',
  // T7 评审必修 1 补:delete 模式头部标题槶位,对应 Vue2 PhotosPeopleView.vue:262
  // $t('Delete face cluster')(区别于警示条内部自己的标题行 photosPersonDeleteTitle,
  // 二者是两句不同文案,不能共用一个键)。zh_CN.json:2006 原译文是"删除面部集群",但
  // "集群"触犯本期术语红线(T3 已清掉四处"集群"),这里改用"删除这组人脸"。
  photosPersonDeleteClusterTitle: '删除这组人脸',
  // 协调者裁定补(Task 12 fix):地点 tab 的段落标题归 tab 组件自己渲染
  // (Vue2 PhotosPersonDetail.vue :156-162 在 v-if="tab==='map'" 块内,是该 tab
  // 自己的一部分;T13 的关系 tab 同理各有自己的段落标题)。译文取自 zh_CN.json
  // :2138(Places with {name})与 :2233(Where you've photographed them, all-time)。
  // 追加在段末,不重排既有键。
  photosPersonPlacesTitle: '{name} 去过的地方',
  photosPersonPlacesSub: '你在此人所有照片中拍摄过的地点',
  // Task 13 补:关系 tab 的段落标题/图例/共现计数短语(译文取自 zh_CN.json
  // :2148 Relationship graph / :2019 Edge thickness.../ :2039 Frequent (200+) /
  // :2120 Occasional / :1996 Co-appearance / :2114 {n} photos together)。
  // photosPersonInsightWith 等洞察拼句键已在段中(:895-900),这里只补图区自己的文案。
  // 追加在段末,不重排既有键。
  photosPersonGraphTitle: '关系图谱',
  photosPersonGraphSub: '连线粗细 = 共同出现次数',
  photosPersonGraphLegendFrequent: '频繁 (200+)',
  photosPersonGraphLegendOccasional: '偶尔',
  photosPersonCoappearTitle: '共同出现',
  photosPersonPhotosTogether: '共同出现 {n} 张照片',
  // Task 6 (Plan D, PR#137 gap-close): the relation-graph empty state; translation taken from
  // Vue2 commit 03245590's own zh_CN.json translation.
  photosPersonRelGraphEmptyTitle: '暂无同框记录',
  photosPersonRelGraphEmptySub: '当这个人与其他人同框出现在照片里时，关系图会显示在这里。',
  // Task 14 补(容器 + 六个弹窗;brief 的键清单里没有,逐段核对 Vue2
  // PhotosPersonDetail.vue 后确认本仓确实缺失才补的,行号见各条注释)。
  // 译文一律从旧仓 zh_CN.json 查同句英文原文;查不到的按已确立的术语惯例直给。
  // 追加在段末,不重排既有键。
  photosPersonSameFrameSub: '与 {name} 同框出现的人', // Vue2 :112
  photosPersonRenameHint: '这个名字会在这张脸出现的所有地方生效。', // Vue2 :776
  photosPersonAlbumHint: '{n} 张照片将被加入这个相册。', // Vue2 :861
  photosPersonAlbumNameFallback: '人物 {id}', // Vue2 :855
  photosPersonNoPhotosTitle: '暂无可用照片', // Vue2 :847
  photosPersonNoPhotosAlbumHint: '这个人还没有可加入相册的照片。', // Vue2 :848
  photosPersonHeroSub: '选择一张照片作为背景大图', // Vue2 :339
  photosPersonMergeIntoSub: '所有照片都会转移到目标人物', // Vue2 :388
  // 终审 Minor 9:原译是 `Merge into {name}`→"合并到 {name}"(zh_CN.json),自拟时多加了
  // 「」书名号 —— 按纪律改回原译。
  photosPersonMergeConfirm: '合并到 {name}', // Vue2 :428(选中态)
  // 终审 Minor 9:原译是 `Select a person`→"选择一个人物"(zh_CN.json),自拟时加了"请"。
  photosPersonMergeSelectPrompt: '选择一个人物', // Vue2 :428(未选中态)
  // Vue2 :962 $t('Unnamed person') —— 删除 toast 里未命名人物的占位标签。术语与
  // photosPeopleUnnamedSection 同为"未命名人物",但那是分区标题、语义不同,不共用键。
  photosPersonUnnamedLabel: '未命名人物',
  // 偏离登记 1:Vue2 :943 detach 失败只 console.error(用户看不到任何反馈),这里补 toast。
  photosPersonDetachFailed: '移除失败',
  // Task 14 fix(协调者裁定 3):brief 说「Vue2 有四条 toast,合成两条」,回源核对
  // 发现两个入口各有自己的一对文案且语义确实不同 —— onUseKeyPhoto(:681,683)是"重置回
  // 关键照片",onSaveHero(:694,696)是"改成选中的这张"。两对分别用键,不合并。
  photosPersonHeroResetToast: '背景已重置为关键照片', // Vue2 :681
  photosPersonHeroResetFailed: '重置背景失败', // Vue2 :683
  // Task 14 fix(协调者裁定 4):加载失败与「没有这个人」必须可区分(T9 的 failed 标志
  // 正是为此而加;Vue2 只 console.error,视图分不清)。同时补重试入口 —— P4 遗留过一条
  // 同类账(详情页加载失败 → 永久骨架、无错误态无重试),本期不再留。
  photosPersonLoadFailed: '无法加载这个人物',
  // Task 6 (Plan D, PR#137 gap-close): the load-failed/person-not-found fallback states were each
  // missing a description line — translation taken from Vue2 commit 03245590's own zh_CN.json
  // translation.
  photosPersonLoadFailedHint: '请检查网络连接后重试。',
  photosPersonNotFoundHint: '该人物可能已被删除或合并。',
  photosPersonRetry: '重试',
  // T14 评审 Minor 4:详情页删除确认弹窗的头部标题。Vue2 :304 是 `Delete person?`,
  // 与 T7 警示条内部那句 photosPersonDeleteTitle(`Delete this person group?` /
  // "删除这个人物分组?")是两句不同文案 —— ClusterActionDialog.vue:66 的注释早已声明
  // 二者不可共用键,原实现错用了后者。译文取自旧仓 zh_CN.json:2009。
  photosPersonDeletePersonTitle: '删除人物？',
  // T14 评审 Minor 6:Vue2 :310-312 的正文是两档灰的两句话。既有 photosPersonDeleteBody
  // 把三句合成了一条(且已被 T7 ClusterActionDialog.vue:230 消费,不能改动),这里为详情页
  // 的两档渲染另开两键;文字与既有那条逐字一致,只是拆开。
  photosPersonDeleteKeptBody: '照片会保留。人物分组与识别记录将被永久删除。',
  photosPersonDeleteUndoHint: '你可以在 5 秒内撤销。',
  // ── Photos: Favorites hero-stats three cards (Task 15A, SP7-P5) —— 值取自
  // 旧仓 zh_CN.json:1986/2045/2099/2119/2210/2211。
  photosFavStatTopPerson: '出镜最多的人',
  photosFavStatTopPlace: '去得最多的地方',
  photosFavStatByYear: '按年份',
  photosFavStatInYear: '于 {year} 年',
  photosFavStatYearsTotal: '共 {n} 年',
  photosFavNoFaces: '暂无人脸',
  // ── Task 6 (Plan H):地点筛选下拉 —— Vue2 PhotosFavoritesView.vue:412-416/353-360。
  photosFavFilterPlaces: '地点',
  photosFavFilterClear: '清除筛选',
  // ── 终审 Minor 6 / 7:hero 上的短文案 ────────────────────────────────────────
  // M6:Vue2 :38/:41 的 Edit 下拉两项是**短动词**(`Rename` / `Merge into…`),原实现塞的是
  // photosPersonRename / photosPersonMergeInto —— 那两个键同时是弹窗 <h*> 标题(「重命名人物」/
  // 「合并到另一个人物」),读起来像整句,英文 24 字符在 12.5px 下还会撑宽 min-width:170px 的菜单。
  // 译文取自旧仓 zh_CN.json:`Rename`→"重命名"、`Merge into…`→"合并到…"。
  photosPersonMenuRename: '重命名',
  photosPersonMenuMergeInto: '合并到…',
  // M7:Vue2 :26 未收藏态的 title 是 `Mark as favorite`(不是通用的 `Favorite`)。
  // 译文取自旧仓 zh_CN.json:`Mark as favorite`→"标记为收藏"。取消收藏那支复用既有
  // photosUnfavorite("取消收藏"),与 zh_CN.json 的 `Remove favorite`→"取消收藏" 一致。
  photosPersonMarkFavorite: '标记为收藏',
  // ── SP7-P6a T4:地点域(地图主视图)i18n 键 ──────────────────────────────────
  // 键表来源:task-4-brief.md;译文一律回源核对 NimoOS-UI/src/assets/lang/zh_CN.json,
  // 出入已在任务报告里列出(brief 快照与 json 实际值不一致的几处按 json 为准更正)。
  photosPlaces: '地点',
  photosPlacesCities: '城市', // json 实际值(zh_CN.json:1990),非 brief 快照的"座城市"
  photosPlacesCountries: '国家', // json 实际值(:2002),非 brief 快照的"个国家"
  // Task 1(Plan E 换壳):地点主视图 PhotosTopbar 的 sub 行——译文取自 zh_CN.json:2518
  // (与 en_US.json:2442 同一英文 key 对应的中文值),回源 Vue2 PhotosPlacesTopbar.vue:34。
  photosPlacesTopbarSub: '{cities} 个城市 · {countries} 个国家 · 由 Nimo 建立索引',
  photosPlacesPhotos: '张照片',
  photosPlacesSearchPlaceholder: '搜索城市或国家',
  photosPlacesCityCount: '{n} 个城市', // json 实际值(:2084),非 brief 快照的"{n} 座城市"
  photosPlacesPhotoCount: '{n} 张照片', // 与既有 photosPeoplePhotosCount 文案相同但语义域不同,各自留键
  photosPlacesFilters: '筛选',
  photosPlacesTimeRange: '时间范围',
  photosPlacesStartDate: '起始日期',
  photosPlacesEndDate: '结束日期',
  photosPlacesMinPhotos: '最少照片数',
  photosPlacesRegion: '区域',
  // 注:Vue2 对"当前行程"这个概念有两种不同中文说法(此处 mapFilter.currentTripOnly
  // 的勾选项是"只看当前行程",下面 :photosPlacesCurrentTrip 的裸标签是"本次旅行")——
  // 界面 1:1 铁律高于术语统一,两处照 Vue2 原样各自保留,不擅自统一。若产品决定统一
  // 措辞,请两处一起改。
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
  photosPlacesThemeOcean: '海洋', // json 确有此译文,brief 标"自拟"有误
  photosPlacesThemeSand: '沙滩', // json 实际值,非 brief 快照自拟的"沙色"
  photosPlacesThemeMono: '单色', // json 实际值,非 brief 快照自拟的"黑白"
  photosPlacesThemeDescDefault: '紫色点 + 黑色背景',
  photosPlacesThemeDescOcean: '青绿调 + 深色背景',
  photosPlacesThemeDescSand: '暖黄 + 浅调背景',
  photosPlacesThemeDescMono: '黑白灰',
  photosPlacesZoomIn: '放大',
  photosPlacesZoomOut: '缩小',
  photosPlacesResetView: '重置视图', // json 实际值,非 brief 快照的"复位视图"
  // 协调者裁定(fix-1):json 原译是"本次旅行"(图例第四组/hero 当前行程标记/访问历史
  // pill 都用它)。此前按 brief 的术语表误写成"当前行程"——那份术语表本身是协调者凭印象
  // 写的,没回源核对,是同类第四处错误(T1/T2/T3 各纠正过一处)。界面 1:1 铁律高于术语表,
  // 改回 json 原文。上面 currentTripOnly 的"只看当前行程"是 Vue2 自身对同一概念的另一种
  // 说法,两处不统一是 Vue2 的现状,照原样保留,不要因为看着像漏改就"顺手"统一。
  photosPlacesCurrentTrip: '本次旅行',
  // 大洲标签:zh_CN.json 无 Asia/Americas/Europe/Africa/Oceania/Antarctica 任何译文,确认缺失后自拟。
  photosPlacesRegionAsia: '亚洲',
  photosPlacesRegionAmericas: '美洲',
  photosPlacesRegionEurope: '欧洲',
  photosPlacesRegionAfrica: '非洲',
  photosPlacesRegionOceania: '大洋洲',
  photosPlacesRegionAntarctica: '南极洲',
  // 以下五条 Vue2 无对应(New-UI 补齐),自拟:
  photosPlacesEmpty: '还没有带位置信息的照片',
  photosPlacesEmptyHint: '相册会在索引照片时读取 GPS 信息',
  photosPlacesSearchEmpty: '没有匹配「{q}」的城市',
  photosPlacesLoadFailed: '地点加载失败', // 照 P5-T14 的 photosPersonLoadFailed 先例
  photosPlacesRetry: '重试', // 本仓惯例每域独立 Retry 键(见 photosPersonRetry/appWidgetRetry 等),不复用
  // 评审 I3(New-UI 新增,无 Vue2 对应):rail 空态原来恒显 photosPlacesEmpty,即使全量
  // 地点非空、只是当前筛选条件过滤成了零结果——用户会误以为索引坏了。这里补一个专门
  // 区分"过滤后为空"与"本来就没有位置数据"的文案。
  photosPlacesFilterEmpty: '没有符合当前筛选条件的城市',
  // ── SP7-P6b T1: Places detail panel i18n keys ──────────────────────────────
  // 42 条取自 NimoOS-UI/src/assets/lang/zh_CN.json 原文(逐条回源核对,零出入);
  // 3 条自拟(D8 + 偏离登记 6,见下方各自的行内注释)。
  photosPlacesHomeBase: '常驻地',
  // 注:zh_CN.json 里 trip/trips 两个 key 的中文译文同为"次旅行"(单复数在中文不体现),
  // 照 json 原样各自保留一键,不合并。
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
  photosPlacesSpotResetName: '恢复默认名', // 自拟(D8),Vue2 无对应键
  photosPlacesSpotRenameFailed: '地点重命名失败', // 自拟(偏离登记 6),Vue2 无对应键
  photosPlacesCoverFailed: '封面更新失败', // 自拟(偏离登记 6),Vue2 无对应键
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
  // 与既有 photosPlacesAll(筛选面板"全部")同值不同语义域(封面选择的分类 tab),各留一键。
  photosPlacesCoverTabAll: '全部',
  photosPlacesInsightMostPhotographed: '你拍得最多的地方——共 {count} 张。',
  // 去掉原 json 的 <b> 标签,{spot} 改为插值槽(<i18n-t> 只能对插值位开槽)。
  photosPlacesInsightTopSpot: '{spot} 是主要拍摄点——{count} 张。',
  photosPlacesInsightCompanions: '在这里和 {names} 同框。',
  // 偏离登记 10:原 json 是"你的<b>大本营</b>——…",加粗的静态词"大本营"拆成 {base} 插槽,
  // 见下方 photosPlacesInsightHomeBase。
  photosPlacesInsightHome: '你的{base}——{trips} 次行程共 {count} 张。',
  // 注:与上方 photosPlacesHomeBase("常驻地")是 Vue2 对同一概念的两种不同说法——
  // 前者是筛选/列表语境的用词,这里是 insight 文案里加粗词的原文("大本营")。
  // 界面 1:1 铁律高于术语统一,两处照 Vue2 原样各自保留,不擅自合并。
  photosPlacesInsightHomeBase: '大本营',
  // ---- P7a-T1: 智能视图(Smart Views)107 键,追加于 photosPlacesInsightHomeBase 之后 ----
  // (表里原列 115 行,其中 8 行与既有键值重复,按 brief 第 7 条改为复用既有键,未新增,见任务报告)
  // Whole-branch review, Minor 6: photosSvAddedThisWeek ("+{n} this week") was SmartViewCard.vue's
  // only consumer. That component was deleted this phase (Task 10); grep confirmed zero consumers
  // left, so the key is removed here in both locales.
  // P7a-T8 fix round 1 · I3:去掉字面 <b>,改 <i18n-t> 具名插槽(零 v-html)。回源核实
  // zh_CN.json 后两条都是"插值 + 语言相关静态词"整个短语加粗(`<b>1 张新照片</b>` /
  // `<b>{n} 张新照片</b>` 形态完全对称)⇒ 都拆成主句键 + 加粗短语键,不再区分对待
  // (详见 SmartViewActivityFeed.vue 文件头注释与 task-8-report.md fix round 1 章节)。
  photosSvActOneMatched: '{photo} 已自动添加',
  photosSvActOneMatchedBold: '1 张新照片',
  photosSvActNMatched: '{photo} 已自动添加',
  photosSvActNMatchedBold: '{n} 张新照片',
  // Task 8: converted_from_album activity row (reverse of Task 7's convertFromAlbum). No
  // <b> in Vue2 for either branch, so these are plain text keys -- no split main-clause +
  // bold-phrase pair like the matched rows above.
  photosSvActConvertedFromAlbum: '由相册转换而来',
  photosSvActConvertedFromAlbumN: '由相册转换而来 · 锁定 {n} 张照片',
  photosSvActivity: '活动',
  photosSvAddAnother: '添加另一个…',
  photosSvAllMatches: '全部匹配',
  // P7a-T8:<b> 只包住插值 {n} ⇒ 直接开槽,去掉字面 <b></b>(零 v-html)。
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
  // ── Task 8: smart album -> regular album conversion (reverse of Task 7) ──
  photosSvConvertToAlbum: '转为普通相册',
  photosSvConvertToAlbumHint: '停止自动更新，固化当前已匹配的照片',
  photosSvConvertToAlbumTitle: '将「{name}」转为普通相册？',
  photosSvConvertToAlbumBody: '停止自动更新，当前 {n} 张照片将固化为普通相册，主题与条件将被移除。',
  photosSvConvertedToAlbum: '已转为普通相册',
  photosSvCopyQuerySv: '将查询复制为新的智能视图',
  // SP15-P2b Task 4: embedded-mode label for the same submit button that reads
  // photosSvCreateSmartView in standalone mode (Vue2 PhotosSmartAlbumCreate.vue's own
  // hard-coded 'Create Smart Album' string, ported here as a key since this file merges
  // both modes into one component).
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
  // SP15-P2b Task 4 (Vue2 939a7d3a:PhotosAlbumsView.vue's `sourceOptions`, 4th entry --
  // verbatim from zh_CN.json:1987-1988, not the plan's guessed values).
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
  photosSvSettingsSection: '设置', // 偏离登记:json['Settings']=系统设置,但此处是智能视图右栏段标题误用全局键(Vue2 文案 bug),这里刻意取「设置」而非回源值
  photosSvSharpDogCatPortraits: '清晰的猫狗写真',
  photosSvBadgeSmartView: '智能视图',
  photosSvSmartViewNameDeleted: '智能视图「{name}」已删除',
  photosSvSmartViewCreated: '智能视图已创建',
  photosSvSmartViewRenamed: '智能视图已重命名',
  photosSvSmartViews: '智能视图',
  photosSvSmartViewsAutoUpdate: '智能视图自动更新已关闭',
  // SP15-P2b Task 4: disabled-option title on the Albums "New album" panel's 4th fill
  // choice when the smartview AI feature is off.
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
  // P8a-T6:此处原有 photosSvSettingsPending(「设置页待迁移(P8)」)已删 —— 全仓零引用。
  // 它是智能视图列表页 AI 横幅里「设置 · AI 行为」不可点 <span aria-disabled="true"> 的
  // title,P8a-T5 建好设置页后,T6 把该 span 换成真实 <RouterLink to="/photos/settings
  // ?section=ai">(§7e-9),这个占位 title 键随之失去用途。同 :847 处 photosPersonSubtitle
  // 的删除先例。
  // ---- P7a-T6: 详情页外壳新增键(T1 的 107 键之外,brief §结构规格 1/2/4/8) ----
  // New-UI 新增路径:byId(id) 找不到这一项(手改地址栏 / 旧书签),Vue2 无此分支——见
  // task-6-report.md 偏离登记。
  photosSvNotFound: '找不到这个智能视图',
  // T6 阶段搜索路由(T16 才建)不存在,「在搜索中细化」渲染成 disabled + 此 title；
  // T16 接线时把这个键与本组件里对应的 disabled 一起删掉(注释已在组件里登记接线点)。
  // 改名失败的 toast(Vue2 :512-513 无 catch,New-UI 补上,偏离登记):照
  // photosAlbumRenameFailed / photosPersonRenamedFailed 的既定命名与文案。
  photosSvRenameFailed: '重命名失败',
  // 暂停/恢复自动更新失败的 toast(Store 纪律:向上抛出的 action 必须在视图层 catch → toast,
  // Vue2 本无对应路径——那套本地 paused 状态从不失败,因为它压根不等后端响应)。
  photosSvUpdateFailed: '更新失败',
  // 删除/复制失败的 toast(Vue2 均无 catch,New-UI 补上,照既定命名惯例)。
  photosSvDeleteFailed: '删除失败',
  photosSvDuplicateFailed: '复制失败',
  // ── SP15-P2a: manual asset actions ──
  // Chinese values are Vue2's own zh_CN.json entries for the same English source strings,
  // not fresh translations. Five more strings this screen needs are already in this file
  // under other names and are reused rather than duplicated: photosPersonSelect ('选择'),
  // photosCancel ('取消'), photosSelectedCount ('已选择 {count} 项' — note the parameter is
  // `count`, not `n`), photosAlbumPickerTitle and photosMoAddSelected ('添加所选' — the
  // static label Vue2 :288 hands this screen's picker, not the album pages' counting one).
  // Final review, finding 2: this key shipped as '加照片', a local shortening nobody asked
  // for. Vue2's own zh_CN.json:2020 says `"Add photos": "添加照片"`, and the neighbouring
  // reused photosAlbumPickerTitle already renders 添加照片到「…」, so the screen contradicted
  // itself as well as the source. Corrected to the Vue2 value; the rule stands that the
  // Chinese here is copied from Vue2, never translated here.
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
  // ── SP15-P2c Task 6: the smart-view detail header's sort capsule + the edit-mode bar's
  // empty-selection hint. Chinese values are Vue2's own zh_CN.json entries for the same
  // English source strings (:2145 "Match score", :2012 "Click to select"), not fresh
  // translations. Everything else the rebuilt row needs already exists in this file and is
  // reused verbatim rather than duplicated: photosAlbumSort ('排序：'), photosAlbumSortTaken
  // ('拍摄日期'), photosAlbumEdit ('编辑'), photosAlbumDone ('完成'),
  // photosDensityComfortable ('舒适'), photosDensityCompact ('紧凑'), photosSelectedCount,
  // photosSvAddPhotos and photosSvRemoveFromView.
  photosSortScore: '匹配分数',
  photosSvClickToSelect: '点击选择',
  // ---- P7a-T9: 搜索面板(过滤条 + 弹层)54 键,照 Vue2 PhotosSearchView.vue 的
  // 英文键逐条核对(zh 值取自 Vue2 src/assets/lang/zh_CN.json),接在文件末尾追加,
  // 不与前面已有键重排。与 T1 已加键语义相同的(Cancel/Close 等)不重复添加。 ----
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
  // fix round 1 · I3:PhotosSearchBar 的 placeholder 新键(追加,不重排)。回源
  // NimoOS-UI/src/assets/lang/zh_CN.json:2405 的英文原文 "Search photos, people,
  // places, or describe in a sentence…" 对应译文(文案回源铁律,不自己译)。
  photosSearchSearchBarPlaceholder: '搜索照片、人物、地点，或用一句话描述…',
  // ── SP7-P8a 相册设置页 + 深链 + 错误态 ──
  // zh 文案权威 = Vue2 src/assets/lang/zh_CN.json;json 里没有对应键的(Vue2
  // PhotosSettings.vue 内联硬编码英文)在该键上方单独注明「自拟」与 Vue2 行号。
  // 本期不迁:主题开关(台账第二笔)· AI 入口(D1)· Sign out(D22)· 上传整块(D21)。
  // 自拟(Vue2 PhotosSettings.vue:18 内联 "Settings")
  photosSettingsTitle: '设置',
  // 终审 Minor 4:此处原有 photosSettingsSubtitle(「存储 · AI 行为」,对应 Vue2
  // PhotosSettings.vue:19 顶栏副标题)已删 —— 全仓零引用。AreaShell.vue:6 的 props 只有
  // `title`,没有承载副标题的位置,这行 Vue2 顶栏文案在 New-UI 里因此被刻意丢弃,不是漏迁。
  // 同 :1256 处 photosSvSettingsPending 的删除先例。
  // 自拟(Vue2 PhotosSettings.vue:31 内联英文长句)
  photosSettingsHeroDesc: 'Nimo 在你的 NAS 上做的一切 —— 什么在跑、跑在哪、占多少空间。',
  // 自拟(Vue2 PhotosSettings.vue:33 内联 "Storage")
  photosSettingsNavStorage: '存储',
  // 自拟(Vue2 PhotosSettings.vue:34 内联 "AI behavior")
  photosSettingsNavAi: 'AI 行为',
  // 自拟(Vue2 PhotosSettings.vue:46 内联 "Storage")
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
  // 自拟(Vue2 PhotosSettings.vue:72 内联 "Free"；图例里的"可用"行，与 photosSettingsFree 同义分用两处)
  photosSettingsSegFree: '可用',
  // 自拟(Vue2 PhotosSettings.vue:81 内联 "Recently Deleted retention")
  photosSettingsRetentionLabel: '最近删除保留期',
  // 自拟(Vue2 PhotosSettings.vue:82 内联长句)
  photosSettingsRetentionDesc: '已删除的照片在从 NAS 永久移除前保留多久。',
  // 自拟(Vue2 PhotosSettings.vue:87 内联 "{{d}}d"，未走 $t)
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
  // 自拟(Vue2 PhotosSettings.vue:116 内联 "Thumbnail cache"；同名 json 键"Thumbnail cache"
  // 被 photosSettingsCacheLabel 复用，此处是同一段文案的两个引用点，取值一致)
  photosSettingsCacheLabel: '缩略图缓存',
  photosSettingsCacheDesc: '已删除照片遗留的过期预览图。使用中的缩略图会保留。',
  photosSettingsClearCache: '清理缓存',
  photosSettingsClearing: '清理中…',
  photosSettingsCleared: '已清理',
  // json "Cache cleared" + "freed" 拼接键（Vue2 :422 运行时用 `·` 连接两个 $t 片段 +
  // 原始字节数），此处收成一个带 {size} 占位符的完整句子。
  photosSettingsCacheClearedToast: '缓存已清理 · {size} 已释放',
  photosSettingsCacheClearFailed: '清理缓存失败',
  // 自拟(Vue2 PhotosSettings.vue:135 内联 "AI behavior")
  photosSettingsAiTitle: 'AI 行为',
  // 自拟(Vue2 PhotosSettings.vue:136 内联 "What Nimo does, and where it runs.")
  photosSettingsAiSubtitle: 'Nimo 做什么，以及在哪里跑。',
  // 自拟(Vue2 PhotosSettings.vue:145 内联 "Nothing leaves your NAS")
  photosSettingsPrivacyTitle: '数据不出你的 NAS',
  // 自拟(Vue2 PhotosSettings.vue:147-149 内联长句)
  photosSettingsPrivacyBody: '所有推理 —— 人脸、场景、OCR、评分 —— 都在这台 NAS 上运行。不会有任何图片、向量或元数据被发往外部服务。',
  // 自拟(Vue2 PhotosSettings.vue:155 内联 "Features")
  photosSettingsFeaturesTitle: '功能',
  // 自拟(Vue2 PhotosSettings.vue:156 内联长句)
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
  // 自拟——但并非纯自拟:Vue2 PhotosSettings.vue:176 渲染 `{{indexedPct}}% {{ $t('complete.') }}`,
  // 数字未译、"complete." 是 json 键(译"已完成。")。中文按语序把数字放到"已完成"之后，
  // 而非逐字直译成"42% 已完成。"。
  photosSettingsIndexPct: '已完成 {pct}%。',
  // json "Covers" + "items. Rebuild after restoring from backup or changing the model." 拼接键
  // （Vue2 :177 运行时用 `$t('Covers') + coverageCount + $t('items. Rebuild after…')` 拼接）。
  photosSettingsIndexCoverage: '覆盖 {count} 个项目。从备份恢复或更换模型后建议重建。',
  photosSettingsRebuildIndex: '重建索引',
  photosSettingsRebuiltToast: 'AI 索引已重建',
  photosSettingsRebuildFailed: '重建失败',
  photosSettingsRebuildStartFailed: '启动重建失败',
  // 自拟(Vue2 PhotosSettings.vue:189 内联 "Re-cluster faces"，未走 $t)
  photosSettingsRecluster: '重新聚类人脸',
  photosSettingsReclusterStarted: '人脸重新聚类已在后台开始',
  photosSettingsReclusterFailed: '启动重新聚类失败',
  photosSettingsAppearance: '外观',
  photosSettingsThemeDark: '深色',
  photosSettingsThemeLight: '浅色',
  // 自拟(Vue2 PhotosSettings.vue:196 内联 "Nimo Photos")
  photosSettingsFooterApp: 'Nimo 相册',
  photosSettingsRunningOn: '运行于',
  photosSettingsLibrarySince: '建库于',
  photosDeepLinkPhotoNotFound: '未找到该图片',
  // 自拟(New-UI 新增失败态，Vue2 无对应)
  photosFavoritesLoadFailed: '收藏加载失败',
  // 自拟(New-UI 新增失败态，Vue2 无对应)
  photosAlbumLoadFailed: '相册加载失败',
  // 自拟(New-UI 新增，两处失败态共用的重试按钮，Vue2 无对应)
  photosRetry: '重试',
  // SP15-P3 Task 11: NimoOS-Photos#54 turned an absent limit on GET /photos/favorites into
  // 500 rather than "everything" — these two keys are new-UI-only pagination copy, no Vue2
  // equivalent (Vue2 never paged this endpoint).
  photosLoadedSubsetHint: '统计基于已加载的前 {n} 项',
  photosLoadMore: '加载更多',
  // ── SP15-P1 Moments ──
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
  // SP15-P2b Task 5: the sidebar entry's new label (was "Smart Views"), and the slim
  // settings hint shown when the band is hidden.
  photosMoForYou: '为你推荐',
  photosMoFollowsSmartViewSetting: '「时刻」跟随「智能视图」开关——可在以下位置重新开启',
  // SP15-P1-T6: shown when moments.reorder() fails a drag-drop and reverts to server order.
  photosMoOrderSaveFailed: '排序保存失败',
  // ── SP15-P1-T7: moment detail page (Vue2 899af59b:PhotosMomentDetail.vue) ──
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
  // fix round 1 · finding 4: shown when the moment list itself could not be fetched.
  // Deliberately says nothing about whether the moment exists — we do not know.
  photosMoLoadFailed: '时刻加载失败',
  // ── SP15-P1-T8: the two photo grids ──
  photosMoAllPhotos: '全部照片',
  // Same Chinese wording as filesViewerLoading/aiMentionLoading/etc. — not a fresh
  // translation, this repo's existing generic "loading" ellipsis.
  photosMoLoading: '加载中…',
  photosMoNoPhotosYet: '这个时刻还没有照片。',
  // ── SP15-P1-T9: adding photos to the moment / removing them from it ──
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
  // ── SP15-P1-T10: save as album / delete moment ──
  // Six of the brief's proposed keys already exist verbatim elsewhere in this repo and are
  // reused rather than duplicated (see PhotosMomentDetail.vue file-header deviation 19):
  // photosPlacesToastOpen ('打开'), photosSvPhotosStayLibrary ('照片仍保留在你的图库中'),
  // photosSvDeleteName ('删除「{name}」？'), photosSvDeleteFailed ('删除失败'), photosCancel
  // ('取消'), photosDelete ('删除'). The seven below are the genuinely new ones — all Vue 2's
  // own zh_CN copy, taken verbatim from 899af59b:src/assets/lang/zh_CN.json.
  photosMoSaveAsAlbum: '保存为相册',
  photosMoAlbumCreated: '已创建相册「{name}」· {count} 张照片',
  // Vue 2's own translation (:1960) — not '已存在' as the brief's draft test assumed; a test
  // asserting that substring would be checking a mistranslation, not this feature's real copy.
  photosMoAlbumExists: '已有同名相册',
  photosMoAlbumFailed: '相册创建失败',
  photosMoDeleteMoment: '删除时刻',
  photosMoDeleteBody: '该时刻会被删除。图库中的 {n} 张照片不受影响。',
  photosMoDeleted: '时刻「{name}」已删除',
  // ── Task 3(壳 + 侧栏重刻):sidebar-head 主题切换按钮的 title,照 Vue2
  // PhotosSidebar.vue:29 的 $t('Switch to dark theme')/$t('Switch to light theme')。
  photosSwitchToDarkTheme: '切换到深色主题',
  photosSwitchToLightTheme: '切换到浅色主题',
  // ── Task 4(顶栏重刻):顶栏折叠按钮的 title,照 Vue2 PhotosTopbar.vue:3 的
  // $t('Toggle sidebar')。KVM 区已有同文案键 kvmToggleSidebar,但该键按 kvm 前缀命名
  // 约定专属 KVM 区,本区另起 photos 前缀键而非跨区复用,与本仓"键名按区前缀"的既有惯例
  // 一致(不是漏查复用)。
  photosToggleSidebar: '切换侧边栏',
  // ── Fix-3 item 7(owner acceptance,2026-08-13,Plan F pull-forward):PhotosTopbar 的
  // 搜索模式返回键 title,对应 Vue2 PhotosTopbar.vue:8 的 $t('Back (Esc)')——New-UI 这里
  // 没有 Esc 语义(搜索页是真路由,Esc 已被浮层统一治理占用),故文案改成描述真实去向
  // (返回照片库),不照抄带 "(Esc)" 字样的原文。
  photosSearchBackToLibrary: '返回照片库',
  // ── Task 7 (Plan D, SP7-P5 People): the Hidden people section + hide action + duplicate-name
  // dupconfirm flow ──
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
}
