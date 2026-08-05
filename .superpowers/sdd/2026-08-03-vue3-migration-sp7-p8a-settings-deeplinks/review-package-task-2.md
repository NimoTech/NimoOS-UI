# Review package — Task 2 (46a5590..29167c4)

## Commits
29167c4 feat(photos): P8a i18n 键(设置页 + 深链 + 错误态)

## Stat
 src/i18n/__tests__/p8aKeys.test.ts |  70 ++++++++++++++++++++++++
 src/i18n/en_us.ts                  | 105 ++++++++++++++++++++++++++++++++++++
 src/i18n/zh_cn.ts                  | 106 +++++++++++++++++++++++++++++++++++++
 3 files changed, 281 insertions(+)

## Diff (-U6)
```diff
diff --git a/src/i18n/__tests__/p8aKeys.test.ts b/src/i18n/__tests__/p8aKeys.test.ts
new file mode 100644
index 0000000..7a606fc
--- /dev/null
+++ b/src/i18n/__tests__/p8aKeys.test.ts
@@ -0,0 +1,70 @@
+import { describe, it, expect } from 'vitest'
+import zh from '../zh_cn'
+import en from '../en_us'
+
+const KEYS = [
+  'photosSettingsTitle', 'photosSettingsSubtitle', 'photosSettingsHeroDesc',
+  'photosSettingsNavStorage', 'photosSettingsNavAi',
+  'photosSettingsStorage', 'photosSettingsVolume', 'photosSettingsFree',
+  'photosSettingsUsedOf', 'photosSettingsStorageUnavailable',
+  'photosSettingsSegPhotos', 'photosSettingsSegVideos', 'photosSettingsSegRaw',
+  'photosSettingsSegThumbs', 'photosSettingsSegAi', 'photosSettingsSegOther',
+  'photosSettingsSegFree',
+  'photosSettingsRetentionLabel', 'photosSettingsRetentionDesc',
+  'photosSettingsRetentionDay', 'photosSettingsRetentionFailed',
+  'photosSettingsRescanLabel', 'photosSettingsRescanDesc', 'photosSettingsRescanNow',
+  'photosSettingsRescanning', 'photosSettingsRescanStarted',
+  'photosSettingsScanIntervalLabel', 'photosSettingsScanIntervalDesc',
+  'photosSettingsScanIntervalOff',
+  'photosSettingsCacheLabel', 'photosSettingsCacheDesc', 'photosSettingsClearCache',
+  'photosSettingsClearing', 'photosSettingsCleared', 'photosSettingsCacheClearedToast',
+  'photosSettingsCacheClearFailed',
+  'photosSettingsAiTitle', 'photosSettingsAiSubtitle',
+  'photosSettingsPrivacyTitle', 'photosSettingsPrivacyBody',
+  'photosSettingsFeaturesTitle', 'photosSettingsFeaturesDesc',
+  'photosSettingsFeatFaces', 'photosSettingsFeatFacesDesc',
+  'photosSettingsFeatScenes', 'photosSettingsFeatScenesDesc',
+  'photosSettingsFeatOcr', 'photosSettingsFeatOcrDesc',
+  'photosSettingsFeatSmartview', 'photosSettingsFeatSmartviewDesc',
+  'photosSettingsFeatSaveFailed',
+  'photosSettingsIndexTitle', 'photosSettingsIndexRebuilding',
+  'photosSettingsIndexLastBuilt', 'photosSettingsIndexNever',
+  'photosSettingsIndexPct', 'photosSettingsIndexCoverage',
+  'photosSettingsRebuildIndex', 'photosSettingsRebuiltToast',
+  'photosSettingsRebuildFailed', 'photosSettingsRebuildStartFailed',
+  'photosSettingsRecluster', 'photosSettingsReclusterStarted',
+  'photosSettingsReclusterFailed',
+  'photosSettingsFooterApp', 'photosSettingsRunningOn', 'photosSettingsLibrarySince',
+  'photosDeepLinkPhotoNotFound', 'photosFavoritesLoadFailed',
+  'photosAlbumLoadFailed', 'photosRetry',
+] as const
+
+describe('P8a i18n 键', () => {
+  it('两个 locale 都定义了本期全部键,且值非空', () => {
+    for (const k of KEYS) {
+      expect(zh, `zh 缺 ${k}`).toHaveProperty(k)
+      expect(en, `en 缺 ${k}`).toHaveProperty(k)
+      expect(String((zh as Record<string, string>)[k]).trim().length, `zh ${k} 为空`).toBeGreaterThan(0)
+      expect(String((en as Record<string, string>)[k]).trim().length, `en ${k} 为空`).toBeGreaterThan(0)
+    }
+  })
+
+  it('zh 侧不残留英文占位(本期键的 zh 值不得与 en 值相同,除术语本身)', () => {
+    const SAME_OK = new Set<string>() // 本期无中英同形键;若出现真同形术语,加入白名单并在此注释说明理由
+    for (const k of KEYS) {
+      if (SAME_OK.has(k)) continue
+      const z = String((zh as Record<string, string>)[k])
+      const e = String((en as Record<string, string>)[k])
+      expect(z === e, `${k} 的 zh 与 en 相同,疑似漏译`).toBe(false)
+    }
+  })
+
+  it('带占位符的键两侧占位符集合一致', () => {
+    const ph = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(',')
+    for (const k of KEYS) {
+      const z = String((zh as Record<string, string>)[k])
+      const e = String((en as Record<string, string>)[k])
+      expect(ph(z), `${k} 占位符不一致`).toBe(ph(e))
+    }
+  })
+})
diff --git a/src/i18n/en_us.ts b/src/i18n/en_us.ts
index 44c36b3..7a46af0 100644
--- a/src/i18n/en_us.ts
+++ b/src/i18n/en_us.ts
@@ -1571,7 +1571,112 @@ export default {
   tmViewingFolder: 'Browsing earlier versions of {path}',
   tmEnter: 'Enter this snapshot',
   tmSettings: 'Snapshot settings',
   tmNoFolderAtTime: 'This folder did not exist yet',
   tmItemCount: '{n} items',
   tmRailJumpTo: 'Jump to the snapshot from {time}',
+
+  // ── SP7-P8a 相册设置页 + 深链 + 错误态 ──
+  // zh 文案权威 = Vue2 src/assets/lang/zh_CN.json;json 里没有对应键的(Vue2
+  // PhotosSettings.vue 内联硬编码英文)在该键上方单独注明「自拟」与 Vue2 行号。
+  // 本期不迁:主题开关(台账第二笔)· AI 入口(D1)· Sign out(D22)· 上传整块(D21)。
+  // 自拟(Vue2 PhotosSettings.vue:18 内联 "Settings")
+  photosSettingsTitle: 'Settings',
+  // 自拟(Vue2 PhotosSettings.vue:19 内联 "Storage · AI behavior")
+  photosSettingsSubtitle: 'Storage · AI behavior',
+  // 自拟(Vue2 PhotosSettings.vue:31 内联英文长句)
+  photosSettingsHeroDesc: 'Everything Nimo does on your NAS — what runs, where it runs, and how much space it takes.',
+  // 自拟(Vue2 PhotosSettings.vue:33 内联 "Storage")
+  photosSettingsNavStorage: 'Storage',
+  // 自拟(Vue2 PhotosSettings.vue:34 内联 "AI behavior")
+  photosSettingsNavAi: 'AI behavior',
+  // 自拟(Vue2 PhotosSettings.vue:46 内联 "Storage")
+  photosSettingsStorage: 'Storage',
+  photosSettingsVolume: 'volume',
+  photosSettingsFree: 'free',
+  photosSettingsUsedOf: 'used of',
+  photosSettingsStorageUnavailable: 'Storage info unavailable',
+  photosSettingsSegPhotos: 'Photos',
+  photosSettingsSegVideos: 'Videos',
+  photosSettingsSegRaw: 'RAW originals',
+  photosSettingsSegThumbs: 'Thumbnail cache',
+  photosSettingsSegAi: 'AI index',
+  photosSettingsSegOther: 'Other data',
+  // 自拟(Vue2 PhotosSettings.vue:72 内联 "Free"；图例里的"可用"行，与 photosSettingsFree 同义分用两处)
+  photosSettingsSegFree: 'Free',
+  // 自拟(Vue2 PhotosSettings.vue:81 内联 "Recently Deleted retention")
+  photosSettingsRetentionLabel: 'Recently Deleted retention',
+  // 自拟(Vue2 PhotosSettings.vue:82 内联长句)
+  photosSettingsRetentionDesc: "How long to keep deleted photos before they're permanently removed from the NAS.",
+  // 自拟(Vue2 PhotosSettings.vue:87 内联 "{{d}}d"，未走 $t)
+  photosSettingsRetentionDay: '{n}d',
+  photosSettingsRetentionFailed: 'Failed to save retention',
+  photosSettingsRescanLabel: 'Rescan library',
+  photosSettingsRescanDesc: 'Scan all drives now and add new photos and videos to the library.',
+  photosSettingsRescanNow: 'Rescan now',
+  photosSettingsRescanning: 'Rescanning…',
+  photosSettingsRescanStarted: 'Library rescan started',
+  photosSettingsScanIntervalLabel: 'Auto rescan interval',
+  photosSettingsScanIntervalDesc: 'How often to automatically scan all drives for new media.',
+  photosSettingsScanIntervalOff: 'Off',
+  // 自拟(Vue2 PhotosSettings.vue:116 内联 "Thumbnail cache"；同名 json 键"Thumbnail cache"
+  // 被 photosSettingsCacheLabel 复用，此处是同一段文案的两个引用点，取值一致)
+  photosSettingsCacheLabel: 'Thumbnail cache',
+  photosSettingsCacheDesc: 'Stale previews left behind by deleted photos. Active thumbnails are kept.',
+  photosSettingsClearCache: 'Clear cache',
+  photosSettingsClearing: 'Clearing…',
+  photosSettingsCleared: 'Cleared',
+  // json "Cache cleared" + "freed" 拼接键（Vue2 :422 运行时用 `·` 连接两个 $t 片段 +
+  // 原始字节数），此处收成一个带 {size} 占位符的完整句子。
+  photosSettingsCacheClearedToast: 'Cache cleared · {size} freed',
+  photosSettingsCacheClearFailed: 'Failed to clear cache',
+  // 自拟(Vue2 PhotosSettings.vue:135 内联 "AI behavior")
+  photosSettingsAiTitle: 'AI behavior',
+  // 自拟(Vue2 PhotosSettings.vue:136 内联 "What Nimo does, and where it runs.")
+  photosSettingsAiSubtitle: 'What Nimo does, and where it runs.',
+  // 自拟(Vue2 PhotosSettings.vue:145 内联 "Nothing leaves your NAS")
+  photosSettingsPrivacyTitle: 'Nothing leaves your NAS',
+  // 自拟(Vue2 PhotosSettings.vue:147-149 内联长句)
+  photosSettingsPrivacyBody: 'All inference — faces, scenes, OCR, scoring — runs on this NAS. No image, embedding, or metadata is sent to any external service.',
+  // 自拟(Vue2 PhotosSettings.vue:155 内联 "Features")
+  photosSettingsFeaturesTitle: 'Features',
+  // 自拟(Vue2 PhotosSettings.vue:156 内联长句)
+  photosSettingsFeaturesDesc: "Turn off anything you don't want Nimo to compute. Off features stop running and free up cycles.",
+  photosSettingsFeatFaces: 'Face recognition',
+  photosSettingsFeatFacesDesc: 'Group photos by person, find faces in new uploads.',
+  photosSettingsFeatScenes: 'Scene & object detection',
+  photosSettingsFeatScenesDesc: 'Powers semantic search — photos turned off here stop being searchable by content.',
+  photosSettingsFeatOcr: 'Text in photos (OCR)',
+  photosSettingsFeatOcrDesc: 'Search receipts, signs, slides, screenshots.',
+  photosSettingsFeatSmartview: 'Smart Views',
+  photosSettingsFeatSmartviewDesc: 'Show Smart Views in the sidebar and keep them evaluating new photos.',
+  photosSettingsFeatSaveFailed: 'Failed to save AI settings',
+  photosSettingsIndexTitle: 'AI index',
+  photosSettingsIndexRebuilding: 'Rebuilding…',
+  photosSettingsIndexLastBuilt: 'Last built',
+  photosSettingsIndexNever: 'never',
+  // 自拟——但并非纯自拟:Vue2 PhotosSettings.vue:176 渲染 `{{indexedPct}}% {{ $t('complete.') }}`,
+  // 数字未译、"complete." 是 json 键(译"已完成。")。英文语序恰好与 json 片段拼接一致。
+  photosSettingsIndexPct: '{pct}% complete.',
+  // json "Covers" + "items. Rebuild after restoring from backup or changing the model." 拼接键
+  // （Vue2 :177 运行时用 `$t('Covers') + coverageCount + $t('items. Rebuild after…')` 拼接）。
+  photosSettingsIndexCoverage: 'Covers {count} items. Rebuild after restoring from backup or changing the model.',
+  photosSettingsRebuildIndex: 'Rebuild index',
+  photosSettingsRebuiltToast: 'AI index rebuilt',
+  photosSettingsRebuildFailed: 'Rebuild failed',
+  photosSettingsRebuildStartFailed: 'Failed to start rebuild',
+  // 自拟(Vue2 PhotosSettings.vue:189 内联 "Re-cluster faces"，未走 $t)
+  photosSettingsRecluster: 'Re-cluster faces',
+  photosSettingsReclusterStarted: 'Face re-clustering started in background',
+  photosSettingsReclusterFailed: 'Failed to start re-clustering',
+  // 自拟(Vue2 PhotosSettings.vue:196 内联 "Nimo Photos")
+  photosSettingsFooterApp: 'Nimo Photos',
+  photosSettingsRunningOn: 'Running on',
+  photosSettingsLibrarySince: 'Library since',
+  photosDeepLinkPhotoNotFound: 'Photo not found',
+  // 自拟(New-UI 新增失败态，Vue2 无对应)
+  photosFavoritesLoadFailed: "Couldn't load favorites",
+  // 自拟(New-UI 新增失败态，Vue2 无对应)
+  photosAlbumLoadFailed: "Couldn't load this album",
+  // 自拟(New-UI 新增，两处失败态共用的重试按钮，Vue2 无对应)
+  photosRetry: 'Retry',
 }
diff --git a/src/i18n/zh_cn.ts b/src/i18n/zh_cn.ts
index fc5e688..e9dc18d 100644
--- a/src/i18n/zh_cn.ts
+++ b/src/i18n/zh_cn.ts
@@ -1576,7 +1576,113 @@ export default {
   tmViewingFolder: '正在查看 {path} 的历史版本',
   tmEnter: '进入此快照',
   tmSettings: '快照设置',
   tmNoFolderAtTime: '此时还没有这个文件夹',
   tmItemCount: '{n} 项',
   tmRailJumpTo: '跳转到 {time} 的快照',
+
+  // ── SP7-P8a 相册设置页 + 深链 + 错误态 ──
+  // zh 文案权威 = Vue2 src/assets/lang/zh_CN.json;json 里没有对应键的(Vue2
+  // PhotosSettings.vue 内联硬编码英文)在该键上方单独注明「自拟」与 Vue2 行号。
+  // 本期不迁:主题开关(台账第二笔)· AI 入口(D1)· Sign out(D22)· 上传整块(D21)。
+  // 自拟(Vue2 PhotosSettings.vue:18 内联 "Settings")
+  photosSettingsTitle: '设置',
+  // 自拟(Vue2 PhotosSettings.vue:19 内联 "Storage · AI behavior")
+  photosSettingsSubtitle: '存储 · AI 行为',
+  // 自拟(Vue2 PhotosSettings.vue:31 内联英文长句)
+  photosSettingsHeroDesc: 'Nimo 在你的 NAS 上做的一切 —— 什么在跑、跑在哪、占多少空间。',
+  // 自拟(Vue2 PhotosSettings.vue:33 内联 "Storage")
+  photosSettingsNavStorage: '存储',
+  // 自拟(Vue2 PhotosSettings.vue:34 内联 "AI behavior")
+  photosSettingsNavAi: 'AI 行为',
+  // 自拟(Vue2 PhotosSettings.vue:46 内联 "Storage")
+  photosSettingsStorage: '存储',
+  photosSettingsVolume: '容量',
+  photosSettingsFree: '可用',
+  photosSettingsUsedOf: '已用，共',
+  photosSettingsStorageUnavailable: '存储信息不可用',
+  photosSettingsSegPhotos: '照片',
+  photosSettingsSegVideos: '视频',
+  photosSettingsSegRaw: 'RAW 原片',
+  photosSettingsSegThumbs: '缩略图缓存',
+  photosSettingsSegAi: 'AI 索引',
+  photosSettingsSegOther: '其他数据',
+  // 自拟(Vue2 PhotosSettings.vue:72 内联 "Free"；图例里的"可用"行，与 photosSettingsFree 同义分用两处)
+  photosSettingsSegFree: '可用',
+  // 自拟(Vue2 PhotosSettings.vue:81 内联 "Recently Deleted retention")
+  photosSettingsRetentionLabel: '最近删除保留期',
+  // 自拟(Vue2 PhotosSettings.vue:82 内联长句)
+  photosSettingsRetentionDesc: '已删除的照片在从 NAS 永久移除前保留多久。',
+  // 自拟(Vue2 PhotosSettings.vue:87 内联 "{{d}}d"，未走 $t)
+  photosSettingsRetentionDay: '{n} 天',
+  photosSettingsRetentionFailed: '保存保留期失败',
+  photosSettingsRescanLabel: '重扫图库',
+  photosSettingsRescanDesc: '立即扫描所有分区，将新增的照片和视频加入图库。',
+  photosSettingsRescanNow: '立即重扫',
+  photosSettingsRescanning: '重扫中…',
+  photosSettingsRescanStarted: '已开始重扫图库',
+  photosSettingsScanIntervalLabel: '自动重扫间隔',
+  photosSettingsScanIntervalDesc: '每隔多久自动扫描所有分区以发现新媒体。',
+  photosSettingsScanIntervalOff: '关闭',
+  // 自拟(Vue2 PhotosSettings.vue:116 内联 "Thumbnail cache"；同名 json 键"Thumbnail cache"
+  // 被 photosSettingsCacheLabel 复用，此处是同一段文案的两个引用点，取值一致)
+  photosSettingsCacheLabel: '缩略图缓存',
+  photosSettingsCacheDesc: '已删除照片遗留的过期预览图。使用中的缩略图会保留。',
+  photosSettingsClearCache: '清理缓存',
+  photosSettingsClearing: '清理中…',
+  photosSettingsCleared: '已清理',
+  // json "Cache cleared" + "freed" 拼接键（Vue2 :422 运行时用 `·` 连接两个 $t 片段 +
+  // 原始字节数），此处收成一个带 {size} 占位符的完整句子。
+  photosSettingsCacheClearedToast: '缓存已清理 · {size} 已释放',
+  photosSettingsCacheClearFailed: '清理缓存失败',
+  // 自拟(Vue2 PhotosSettings.vue:135 内联 "AI behavior")
+  photosSettingsAiTitle: 'AI 行为',
+  // 自拟(Vue2 PhotosSettings.vue:136 内联 "What Nimo does, and where it runs.")
+  photosSettingsAiSubtitle: 'Nimo 做什么，以及在哪里跑。',
+  // 自拟(Vue2 PhotosSettings.vue:145 内联 "Nothing leaves your NAS")
+  photosSettingsPrivacyTitle: '数据不出你的 NAS',
+  // 自拟(Vue2 PhotosSettings.vue:147-149 内联长句)
+  photosSettingsPrivacyBody: '所有推理 —— 人脸、场景、OCR、评分 —— 都在这台 NAS 上运行。不会有任何图片、向量或元数据被发往外部服务。',
+  // 自拟(Vue2 PhotosSettings.vue:155 内联 "Features")
+  photosSettingsFeaturesTitle: '功能',
+  // 自拟(Vue2 PhotosSettings.vue:156 内联长句)
+  photosSettingsFeaturesDesc: '关掉你不想让 Nimo 计算的项。关掉的功能会停止运行并释放算力。',
+  photosSettingsFeatFaces: '人脸识别',
+  photosSettingsFeatFacesDesc: '按人物归组照片，并在新上传中识别人脸。',
+  photosSettingsFeatScenes: '场景与物体识别',
+  photosSettingsFeatScenesDesc: '语义搜索的基础——关闭后新照片将无法按内容搜索。',
+  photosSettingsFeatOcr: '图片文字识别（OCR）',
+  photosSettingsFeatOcrDesc: '搜索小票、路牌、幻灯片和截图中的文字。',
+  photosSettingsFeatSmartview: '智能视图',
+  photosSettingsFeatSmartviewDesc: '在侧栏显示智能视图，并持续评估新照片。',
+  photosSettingsFeatSaveFailed: 'AI 设置保存失败',
+  photosSettingsIndexTitle: 'AI 索引',
+  photosSettingsIndexRebuilding: '重建中…',
+  photosSettingsIndexLastBuilt: '上次构建于',
+  photosSettingsIndexNever: '从未',
+  // 自拟——但并非纯自拟:Vue2 PhotosSettings.vue:176 渲染 `{{indexedPct}}% {{ $t('complete.') }}`,
+  // 数字未译、"complete." 是 json 键(译"已完成。")。中文按语序把数字放到"已完成"之后，
+  // 而非逐字直译成"42% 已完成。"。
+  photosSettingsIndexPct: '已完成 {pct}%。',
+  // json "Covers" + "items. Rebuild after restoring from backup or changing the model." 拼接键
+  // （Vue2 :177 运行时用 `$t('Covers') + coverageCount + $t('items. Rebuild after…')` 拼接）。
+  photosSettingsIndexCoverage: '覆盖 {count} 个项目。从备份恢复或更换模型后建议重建。',
+  photosSettingsRebuildIndex: '重建索引',
+  photosSettingsRebuiltToast: 'AI 索引已重建',
+  photosSettingsRebuildFailed: '重建失败',
+  photosSettingsRebuildStartFailed: '启动重建失败',
+  // 自拟(Vue2 PhotosSettings.vue:189 内联 "Re-cluster faces"，未走 $t)
+  photosSettingsRecluster: '重新聚类人脸',
+  photosSettingsReclusterStarted: '人脸重新聚类已在后台开始',
+  photosSettingsReclusterFailed: '启动重新聚类失败',
+  // 自拟(Vue2 PhotosSettings.vue:196 内联 "Nimo Photos")
+  photosSettingsFooterApp: 'Nimo 相册',
+  photosSettingsRunningOn: '运行于',
+  photosSettingsLibrarySince: '建库于',
+  photosDeepLinkPhotoNotFound: '未找到该图片',
+  // 自拟(New-UI 新增失败态，Vue2 无对应)
+  photosFavoritesLoadFailed: '收藏加载失败',
+  // 自拟(New-UI 新增失败态，Vue2 无对应)
+  photosAlbumLoadFailed: '相册加载失败',
+  // 自拟(New-UI 新增，两处失败态共用的重试按钮，Vue2 无对应)
+  photosRetry: '重试',
 }
```
