# Final whole-branch review package — SP7-P8a (a6e0493..6c58488)

## Commits (本期全部)
6c58488 fix(photos): 设置页 toast 撞全局 toast 层级(全量收尾门,AppToast.zIndex.test.ts)
da90689 fix(photos): 杂项收口(P8a-T10)
1fed2bc fix(photos): P8a-T9 review fix — retry no longer clears loadError up front
b1f7c2c fix(photos): 收藏静默空网格 / 相册详情永久骨架 两处错误态收口(P8a-T9)
4b94094 feat(photos): ?q / ?album / ?person 深链兼容入口(P8a-T8)
ba8d122 feat(photos): ?asset / ?photoset 深链(P8a-T7,spec §6 契约)
1da9c2f test(photos): P8a-T6 review fix — pin network-level aiFeatures dedup + tighten spies
40bc33e feat(photos): 三项 config 挂账收编进 photosSettings store(P8a-T6)
1537bbe fix(photos): 补 ?section= 停留在本页时的 query-only 滚动路径(review Important 1)
6324470 feat(photos): 设置页容器 + /photos/settings 路由 + 侧栏入口(P8a-T5)
6a4d426 feat(photos): 设置页 AI 卡(P8a-T4)
04e6684 fix(photos): PhotosStorageCard 补 Rescan Now 覆盖 + data-test 钩子(P8a-T3 评审修复)
050b12f feat(photos): 设置页存储卡(P8a-T3)
29167c4 feat(photos): P8a i18n 键(设置页 + 深链 + 错误态)
46a5590 fix(photos): rebuildIndex 409 分支改回 Vue2 权威模式(P8a-T1 review fix)
df9cc07 feat(photos): photosSettings store(P8a-T1)

## Stat
 docs/THEMING.md                                    |   1 +
 src/i18n/__tests__/p8aKeys.test.ts                 |  70 ++++
 src/i18n/en_us.ts                                  | 110 +++++-
 src/i18n/zh_cn.ts                                  | 115 +++++-
 src/photos/components/PhotosAiCard.vue             | 340 ++++++++++++++++++
 src/photos/components/PhotosSidebar.vue            |  42 ++-
 src/photos/components/PhotosStorageCard.vue        | 342 ++++++++++++++++++
 .../components/__tests__/PhotosAiCard.test.ts      | 274 +++++++++++++++
 .../components/__tests__/PhotosSidebar.test.ts     |  92 ++++-
 .../components/__tests__/PhotosStorageCard.test.ts | 292 ++++++++++++++++
 .../__tests__/usePhotosDeepLinks.test.ts           | 356 +++++++++++++++++++
 src/photos/composables/usePersonDetail.ts          |   2 +
 src/photos/composables/usePhotosDeepLinks.ts       | 195 +++++++++++
 src/photos/composables/usePlaceAssets.ts           |   5 +
 src/photos/stores/__tests__/albums.test.ts         |  44 +++
 src/photos/stores/__tests__/favorites.test.ts      |  37 ++
 src/photos/stores/__tests__/settings.test.ts       | 384 +++++++++++++++++++++
 src/photos/stores/__tests__/timeline.test.ts       |  38 ++
 src/photos/stores/albums.ts                        |  18 +-
 src/photos/stores/favorites.ts                     |  22 +-
 src/photos/stores/settings.ts                      | 306 ++++++++++++++++
 src/photos/stores/timeline.ts                      |  34 ++
 src/photos/util/__tests__/httpErrors.test.ts       |   7 +
 src/photos/util/httpErrors.ts                      |  14 +-
 src/photos/util/storagePalette.ts                  |  65 ++++
 src/router/index.ts                                |   4 +
 src/styles/theme.css                               |  34 ++
 src/views/Photos.vue                               |  20 +-
 src/views/PhotosAlbumDetail.vue                    |  33 +-
 src/views/PhotosFavorites.vue                      |  35 +-
 src/views/PhotosPeople.vue                         |  31 +-
 src/views/PhotosPersonDetail.vue                   |   7 +-
 src/views/PhotosPlaceAssets.vue                    |   4 +
 src/views/PhotosSettings.vue                       | 212 ++++++++++++
 src/views/PhotosSmartViews.vue                     |  56 ++-
 src/views/__tests__/Photos.integration.test.ts     |  24 ++
 src/views/__tests__/PhotosAlbumDetail.test.ts      |  70 ++++
 src/views/__tests__/PhotosFavorites.test.ts        |  77 +++++
 src/views/__tests__/PhotosPeople.test.ts           |  43 +++
 src/views/__tests__/PhotosSettings.test.ts         | 363 +++++++++++++++++++
 src/views/__tests__/PhotosSmartViews.test.ts       |  50 ++-
 41 files changed, 4185 insertions(+), 83 deletions(-)

## Diff (-U10)
```diff
diff --git a/docs/THEMING.md b/docs/THEMING.md
index df0ea9b..b608da4 100644
--- a/docs/THEMING.md
+++ b/docs/THEMING.md
@@ -324,20 +324,21 @@ setTheme(t):  documentElement.dataset.theme = (t === 'blue' ? '' : t)   // blue
 
 以下颜色**故意不走主题 token**，是有意设计而非残留。每处代码须有注释说明原因：
 
 | 例外 | 位置 | 为何是有意例外 |
 |---|---|---|
 | `.ic-*` app 图标渐变（`.ic-files` / `.ic-photos` / `.ic-video` / `.ic-music` / `.ic-ai` / `.ic-backup` / `.ic-download` / `.ic-docker` / `.ic-vm` / `.ic-share` / `.ic-search` / `.ic-settings` / `.ic-users` / `.ic-storage` / `.ic-appstore` / `.ic-terminal` 等） | `theme.css` §「应用图标配色」 | **品牌识别色，皮肤无关**——文件蓝、照片虹彩、音乐粉紫等是产品视觉资产，两套主题都保持一致，不应随皮肤变。用户靠颜色识别应用。 |
 | 第三方库内部主题（如 CodeMirror 编辑器配色） | 引入该库的组件 | 库有自己的主题机制，颜色由库内部管理，无法用 CSS 变量穿透。应走该库自身的 theme 配置，而非硬塞 token。 |
 | `PLACE_PALETTE`（7 色循环：`#6E5BFF`/`#FF9AC2`/`#5AC8FA`/`#FFD60A`/`#34C759`/`#FF9F0A`/`#FF6B5C`） | `src/photos/util/peopleView.ts`（人物详情页地点 tab：迷你地图点 + 图例 + 地点卡片，消费于 `PersonPlacesTab.vue`） | **数据可视化分类色板**，不是主题皮肤色——同一张地图/图例上要把互不相同的地点互相区分开，颜色语义是"第几个数据系列"而不是"主题强调色"，两套主题下都必须保持同一组值不变。值放 `.ts`（不是 `theme.css`）刻意避免为 7 个数据系列各造一个一次性 token。 |
 | 地图主题预设 4×7 色 | `src/photos/util/placesMapThemes.ts` | 用户可选的地图可视化调色板，与应用主题正交（spec SP7 D5）；浅色变体由全局 data-theme 触发。 |
 | `--badge-photo`（`rgba(50,190,230,0.9)` 青）/ `--badge-video`（`rgba(255,149,10,0.92)` 橙）/ `--badge-ocr`（`rgba(16,185,129,0.92)` 翠绿） | `theme.css`（`:root` 与 `:root[data-theme="light"]` 均定义，同值）；消费于 `src/photos/components/SearchResultTile.vue` 的 `.type-badge[data-type="photo"\|"video"\|"ocr"]` | **数据可视化类别色**（与 `PLACE_PALETTE` 同类，但只有 3 个固定类别、且要在 scoped `<style>` 里按 `[data-type]` 属性选择器消费，故落地为 `theme.css` 里的具名 token 而非 `.ts` 数组）——同一批搜索结果卡片上要把"照片 / 视频 / OCR 命中"三种类别互相区分开，颜色语义是"第几类"而不是"主题强调色"，精确复刻 Vue2 `photos.scss:2768-2770` 的字面量，两套主题块给同一个值，不随皮肤深浅变化。不用 `--accent`/`--danger` 就近凑：那是"强调"/"危险"语义，与这里的"类别标识"语义不同。 |
+| `--photos-seg-video`（深 `#5e94ff` / 浅 `#3560d8`）/ `--photos-seg-raw`（深 `#ff9ac2` / 浅 `#c93f79`）/ `--photos-seg-ai`（深 `#ff9f0a` / 浅 `#a15f0a`）/ `--photos-seg-other`（深 `rgba(255,255,255,0.25)` / 浅 `rgba(28,27,25,0.25)`） | `theme.css`（`:root` 与 `:root[data-theme="light"]` 各给不同值）；消费于 `src/photos/util/storagePalette.ts` 的 `STORAGE_SEG_COLORS`，渲染于 `src/photos/components/PhotosStorageCard.vue` 的容量条 + 图例 | **数据可视化类别色**（与 `--badge-*` 同类）——设置页存储卡的容量条上要把 videos/RAW/AI 索引/其它数据四个类别互相区分开，颜色语义是"第几类数据"而不是"主题强调色"；photos 段与 thumbs 段复用既有 `--accent`/`--success`（不重造）。**与 `--badge-*` 的差异**：`--badge-*` 两套主题同值（Vue2 该视图只有一套设计），这四个 Vue2 深色原值（`PhotosSettings.vue:320/321/323`）铺在本仓浅色主题的纯白 `--card-bg` 上会偏灰、分段边界糊掉，故浅色档各自加深/提高饱和度（同色相）保持可辨识，两套主题给不同值。`other` 段精确复刻 Vue2 `rgba(var(--ink),0.25)` 的 alpha，RGB 换成本仓 `--fg` 的真实分解值（同 `--zb-hover-bg`/`--zb-track-bg` 的既定换基先例，本仓无 `--ink` 三元组 token）。 |
 
 注：`.ic-ai` 与 `.ic-all` / `.ic-app` 例外地**引用了** token（`--accent` / `--accent2` /
 `--orb-core` / `--all-bg` 等）——这部分仍随主题走，只有各图标的**固定品牌渐变**是例外。
 
 补充：`.grid-item .remove`、`.resize-handle::after`、`.media-play` 等全局规则里仍有个别
 `#fff` / `rgba(0,0,0,…)` 字面色（阴影、纯白箭头等中性值）。按 §0 约定，这些在收编硬编码色时
 应逐步 token 化；若判定为主题无关的纯中性值而保留，须在该行加注释说明。
 
 ---
 
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
index 44c36b3..e1b84f1 100644
--- a/src/i18n/en_us.ts
+++ b/src/i18n/en_us.ts
@@ -1254,22 +1254,23 @@ export default {
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
-  // P8 wiring point: see the matching zh_cn.ts comment.
-  photosSvSettingsPending: 'Settings page coming in P8',
+  // P8a-T6: photosSvSettingsPending ('Settings page coming in P8') removed here — zero
+  // references repo-wide. See the matching zh_cn.ts comment for why (the placeholder title
+  // for the AI-banner's non-clickable settings span, now a real RouterLink, §7e-9).
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
@@ -1567,11 +1568,116 @@ export default {
   snapBrowseRestoreFailed: 'Restore failed, please try again',
   snapBrowseRestoredPartial: 'Restored {ok} items, {fail} failed',
 
   tmEntry: 'Time Machine',
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
index fc5e688..d7814fb 100644
--- a/src/i18n/zh_cn.ts
+++ b/src/i18n/zh_cn.ts
@@ -1246,24 +1246,25 @@ export default {
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
-  // P8 接线点:智能视图列表页 AI 横幅里「设置 · AI 行为」目前渲染成不可点的 <span
-  // aria-disabled="true">,这个 title 说明原因。P8 建好设置页后把该 span 换成真链接/
-  // 路由跳转,这个键可保留复用为 tooltip,或按 P8 实际交互删除。
-  photosSvSettingsPending: '设置页待迁移(P8)',
+  // P8a-T6:此处原有 photosSvSettingsPending(「设置页待迁移(P8)」)已删 —— 全仓零引用。
+  // 它是智能视图列表页 AI 横幅里「设置 · AI 行为」不可点 <span aria-disabled="true"> 的
+  // title,P8a-T5 建好设置页后,T6 把该 span 换成真实 <RouterLink to="/photos/settings
+  // ?section=ai">(§7e-9),这个占位 title 键随之失去用途。同 :847 处 photosPersonSubtitle
+  // 的删除先例。
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
@@ -1572,11 +1573,117 @@ export default {
   snapBrowseRestoreFailed: '恢复失败,请稍后再试',
   snapBrowseRestoredPartial: '已恢复 {ok} 项,{fail} 项失败',
 
   tmEntry: '时间机器',
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
diff --git a/src/photos/components/PhotosAiCard.vue b/src/photos/components/PhotosAiCard.vue
new file mode 100644
index 0000000..a7df444
--- /dev/null
+++ b/src/photos/components/PhotosAiCard.vue
@@ -0,0 +1,340 @@
+<!--
+  SP7-P8a-T4: 设置页 AI 卡。
+  回源坐标:Vue2 PhotosSettings.vue:129-192(模板)、:283-291(rebuildTask watcher)、
+  :332-370(rebuildTask/indexing/indexedPct/coverageCount/lastBuiltText/featureRows)、
+  :458-486(rebuildIndex/doRecluster)。
+
+  卡片自己不弹 toast —— @toast 统一由 T5 容器承接,同 PhotosStorageCard.vue(T3)的既定分工。
+
+  接口边界记录(给 T5 实现者看):
+  - `about` 不在本卡调用 fetchAbout() —— 沿用 T3 的既定分工,by T5 容器统一取一次。
+    取数完成前 lastBuiltText 显示 'never'、coverageCount 显示 0(见下方 computed)。
+  - `rebuildTask` 从 timeline store 的 `tasks` 读,不在本卡另起一份任务轮询
+    (与 settings.ts 头部注释 "useTimelineStore() 必须在 setup 内部调用" 一致)。
+
+  偏离登记(按项目铁律"Vue2 的 bug 不照抄,改正确逻辑并注释登记"):
+  1. lastBuiltText 的 locale 缺陷 —— Vue2 :346 `new Date(iso).toLocaleString()` 不传
+     locale 参数,结果跟随浏览器/系统语言而非应用内选择的语言,中文界面下会出英文月份缩写
+     (与 spec §7c-2/§7e-4 同类缺陷)。改为显式跟随 i18n locale(套用
+     src/photos/util/relTime.ts:18-22、PlacesRail.vue:84、PlaceDetailPanel.vue:120、
+     PersonHero.vue:113 的既有写法:locale.replace('_','-') 转 BCP-47 标签,喂给
+     Intl.DateTimeFormat)。保留 toLocaleString() 的"日期+时间"语义(不是
+     toLocaleDateString() 的纯日期),故 Intl 选项里含 hour/minute。
+  2. rebuildTask 的"跳变"判据(:283-284)—— 必须是 old.status==='running' &&
+     new.status==='done' 才弹"已重建"toast,不是"当前状态是 done 就弹"。照搬这个跳变
+     判据,否则每次任务列表刷新(轮询/深链打开)都会重复弹同一条 toast。
+
+  颜色 token:本卡零新增 token —— 全部复用既有语义 token(--accent/--accent2/
+  --accent-soft/--sem-bg/--sem-fg/--sem-bd/--chip-bg/--chip-bg-hi/--border/--fg/
+  --on-accent/--divider/--fg-muted)。私隐横幅原色 Vue2 是精确的 iOS 绿
+  rgba(52,199,89,α)/#34C759,但本仓已有通用"成功/正向"语义 token --sem-*
+  (成功徽标、RAID 健康态等多处复用,色相是青绿而非苹方绿)——比照 T3 对
+  Vue2 字面量 #6E5BFF 就近映射到既有 --accent-soft/--accent 而不新增 token 的先例,
+  这里同样映射到既有 --sem-* 三件套,不为同一"成功/安全"语义再造一份几乎重复的
+  token。进度条渐变原色 Vue2 是 linear-gradient(#6E5BFF,#B8AAFF),这里用
+  linear-gradient(var(--accent), var(--accent2)) 复刻"强调色渐变"的观感,同样不新增。
+-->
+<script setup lang="ts">
+import { computed, ref, watch } from 'vue'
+import { useI18n } from 'vue-i18n'
+import { usePhotosSettingsStore, type PhotosAiFeatures } from '../stores/settings'
+import { useTimelineStore } from '../stores/timeline'
+
+const emit = defineEmits<{ toast: [{ icon: string; text: string }] }>()
+
+const { t, locale } = useI18n()
+const store = usePhotosSettingsStore()
+const timeline = useTimelineStore()
+
+// Vue2 PhotosSettings.vue:363-369 —— 顺序固定 faces → scenes → ocr → smartview。
+const featureRows = computed(() => [
+  { id: 'faces' as const, label: t('photosSettingsFeatFaces'), desc: t('photosSettingsFeatFacesDesc') },
+  { id: 'scenes' as const, label: t('photosSettingsFeatScenes'), desc: t('photosSettingsFeatScenesDesc') },
+  { id: 'ocr' as const, label: t('photosSettingsFeatOcr'), desc: t('photosSettingsFeatOcrDesc') },
+  { id: 'smartview' as const, label: t('photosSettingsFeatSmartview'), desc: t('photosSettingsFeatSmartviewDesc') },
+])
+
+async function toggleFeature(id: keyof PhotosAiFeatures): Promise<void> {
+  const next = !store.aiFeatures[id]
+  const ok = await store.setAiFeature(id, next)
+  if (!ok) {
+    emit('toast', { icon: 'shield', text: t('photosSettingsFeatSaveFailed') })
+  }
+}
+
+// Vue2 :332-337 —— rebuildTaskId 本地记住的那条优先,找不到再找任意 type==='rebuild' 的
+// 任务,再没有就 null。id 铁律:后端 id 可能是 string|number,统一转 String 比较
+// (同 PlacesRail.vue "id 铁律" 既有先例)。
+const rebuildTaskId = ref('')
+const rebuildTask = computed(() => {
+  const tasks = timeline.tasks
+  const byId = rebuildTaskId.value
+    ? tasks.find(x => String(x.id) === rebuildTaskId.value)
+    : undefined
+  return byId ?? tasks.find(x => x.type === 'rebuild') ?? null
+})
+
+// Vue2 :338 —— indexing = 有 rebuildTask 且状态为 running。
+const indexing = computed(() => rebuildTask.value?.status === 'running')
+// Vue2 :339 —— 后端 progress 是 0-1 的小数,不是百分数,故 *100 再取整。
+const indexedPct = computed(() => Math.round(((rebuildTask.value?.progress) || 0) * 100))
+// Vue2 :340 —— coverageCount 取 about.indexCoverage,about 取数前(null)兜底 0。
+const coverageCount = computed(() => store.about?.indexCoverage ?? 0)
+
+// Vue2 :341-351,偏离登记见文件头注释 1。
+const lastBuiltText = computed(() => {
+  const iso = store.about?.indexLastBuilt
+  if (!iso) return t('photosSettingsIndexNever')
+  try {
+    const tag = locale.value.replace('_', '-')
+    return new Intl.DateTimeFormat(tag, {
+      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
+    }).format(new Date(iso))
+  } catch {
+    // Vue2 :348-350 的 catch 分支同样回落到原始 iso 字符串。
+    return iso
+  }
+})
+
+// Vue2 :283-291 —— 只在 running→done 的跳变上弹"已重建"toast + 重拉 about;
+// error 状态弹失败 toast(不要求跳变,与源一致)。偏离登记见文件头注释 2。
+watch(rebuildTask, (task, old) => {
+  if (old && old.status === 'running' && task && task.status === 'done') {
+    const base = t('photosSettingsRebuiltToast')
+    emit('toast', { icon: 'sparkles', text: task.total ? `${base} · ${task.total}` : base })
+    void store.fetchAbout()
+  }
+  if (task && task.status === 'error') {
+    const base = t('photosSettingsRebuildFailed')
+    emit('toast', { icon: 'shield', text: task.error ? `${base}: ${task.error}` : base })
+  }
+})
+
+// Vue2 :458-473 —— settings.ts 的 rebuildIndex() 已经吞掉 409(自己刷一次任务列表并
+// 返回运行中任务的 id),这里只需要处理"非 409 失败"分支。
+async function doRebuild(): Promise<void> {
+  if (indexing.value) return
+  try {
+    rebuildTaskId.value = await store.rebuildIndex()
+  } catch {
+    emit('toast', { icon: 'shield', text: t('photosSettingsRebuildStartFailed') })
+  }
+}
+
+// Vue2 :474-486 —— 成功/失败都在 finally 里 3 秒后解禁,防连点。
+const reclustering = ref(false)
+async function doRecluster(): Promise<void> {
+  if (reclustering.value) return
+  reclustering.value = true
+  try {
+    await store.reclusterFaces()
+    emit('toast', { icon: 'sparkles', text: t('photosSettingsReclusterStarted') })
+  } catch {
+    emit('toast', { icon: 'shield', text: t('photosSettingsReclusterFailed') })
+  } finally {
+    setTimeout(() => { reclustering.value = false }, 3000)
+  }
+}
+</script>
+
+<template>
+  <section class="aic-card" id="ai">
+    <header class="aic-head">
+      <div class="aic-icon">
+        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
+      </div>
+      <div>
+        <h2 class="aic-title">{{ t('photosSettingsAiTitle') }}</h2>
+        <div class="aic-sub">{{ t('photosSettingsAiSubtitle') }}</div>
+      </div>
+    </header>
+
+    <div class="aic-privacy" data-test="privacy-banner">
+      <div class="aic-privacy-icon">
+        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
+      </div>
+      <div>
+        <div class="aic-privacy-title">{{ t('photosSettingsPrivacyTitle') }}</div>
+        <div class="aic-privacy-body">{{ t('photosSettingsPrivacyBody') }}</div>
+      </div>
+    </div>
+
+    <div class="aic-divider"></div>
+
+    <h3 class="aic-subhead">{{ t('photosSettingsFeaturesTitle') }}</h3>
+    <p class="aic-subhead-desc">{{ t('photosSettingsFeaturesDesc') }}</p>
+    <div class="aic-features">
+      <label v-for="f in featureRows" :key="f.id" class="aic-feature">
+        <div class="aic-feature-text">
+          <div class="lbl">{{ f.label }}</div>
+          <div class="desc">{{ f.desc }}</div>
+        </div>
+        <div
+          class="st-switch" :data-on="store.aiFeatures[f.id]" :data-test="`ai-switch-${f.id}`"
+          role="switch" :aria-checked="store.aiFeatures[f.id]" :aria-label="f.label"
+          @click="toggleFeature(f.id)"
+        ></div>
+      </label>
+    </div>
+
+    <div class="aic-divider"></div>
+
+    <h3 class="aic-subhead">{{ t('photosSettingsIndexTitle') }}</h3>
+    <div class="aic-row" style="padding-top:6px">
+      <div class="aic-row-text">
+        <div class="aic-row-label" v-if="indexing">{{ t('photosSettingsIndexRebuilding') }}</div>
+        <div class="aic-row-label" v-else>{{ t('photosSettingsIndexLastBuilt') }} {{ lastBuiltText }}</div>
+        <div class="aic-row-desc">
+          <template v-if="indexing">{{ t('photosSettingsIndexPct', { pct: indexedPct }) }}</template>
+          <template v-else>{{ t('photosSettingsIndexCoverage', { count: coverageCount }) }}</template>
+        </div>
+        <div v-if="indexing" class="aic-progress" data-test="index-progress"><div :style="{ width: indexedPct + '%' }"></div></div>
+      </div>
+      <button type="button" class="aic-btn" data-test="rebuild-index" :disabled="indexing" @click="doRebuild">
+        <span v-if="indexing" class="aic-spinner"></span>
+        <svg v-else viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
+        {{ indexing ? t('photosSettingsIndexRebuilding') : t('photosSettingsRebuildIndex') }}
+      </button>
+      <button type="button" class="aic-btn" data-test="recluster" :disabled="reclustering" @click="doRecluster" style="margin-left:8px">
+        <span v-if="reclustering" class="aic-spinner"></span>
+        <svg v-else viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
+        {{ t('photosSettingsRecluster') }}
+      </button>
+    </div>
+  </section>
+</template>
+
+<style scoped>
+.aic-card {
+  background: var(--card-bg);
+  border: 1px solid var(--card-border);
+  border-radius: var(--radius-sm);
+  box-shadow: var(--card-shadow);
+  padding: 20px 22px;
+  display: flex;
+  flex-direction: column;
+}
+
+.aic-head { display: flex; align-items: flex-start; gap: 12px; }
+
+.aic-icon {
+  width: 32px;
+  height: 32px;
+  flex-shrink: 0;
+  border-radius: 10px;
+  display: flex;
+  align-items: center;
+  justify-content: center;
+  background: var(--accent-soft);
+  color: var(--accent);
+}
+
+.aic-title { margin: 0; font-size: 15px; font-weight: 600; color: var(--fg); }
+.aic-sub { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }
+
+.aic-privacy {
+  display: flex;
+  gap: 10px;
+  padding: 12px 14px;
+  background: var(--sem-bg);
+  border: 1px solid var(--sem-bd);
+  border-radius: 10px;
+  margin: 14px 0 4px;
+}
+.aic-privacy-icon {
+  width: 26px;
+  height: 26px;
+  flex-shrink: 0;
+  margin-top: 1px;
+  border-radius: 7px;
+  background: var(--sem-bd);
+  color: var(--sem-fg);
+  display: flex;
+  align-items: center;
+  justify-content: center;
+}
+.aic-privacy-title { font-size: 12.5px; font-weight: 600; color: var(--sem-fg); margin-bottom: 4px; }
+.aic-privacy-body { font-size: 11.5px; color: var(--fg-muted); line-height: 1.5; }
+
+.aic-divider { height: 1px; background: var(--divider); margin: 16px 0; }
+
+.aic-subhead { font-size: 14px; font-weight: 600; color: var(--fg); margin: 0 0 4px; }
+.aic-subhead-desc { font-size: 11.5px; color: var(--fg-muted); line-height: 1.45; margin: 0 0 10px; max-width: 540px; }
+
+.aic-features { display: flex; flex-direction: column; }
+.aic-feature { display: flex; align-items: center; gap: 18px; padding: 11px 0; border-bottom: 1px solid var(--divider); cursor: pointer; }
+.aic-feature:last-child { border-bottom: 0; }
+.aic-feature-text { flex: 1; }
+.aic-feature-text .lbl { font-size: 13px; color: var(--fg); font-weight: 500; }
+.aic-feature-text .desc { font-size: 11.5px; color: var(--fg-muted); margin-top: 2px; line-height: 1.4; }
+
+/* 开关:照本仓既有惯例(settings/styles/settings.css .set-switch、
+   SnapshotSettingsDialog.vue .ss-switch)——关态描边+chip 底,开态实底 accent,
+   把手关态 --fg、开态 --on-accent("只在叠在 accent 实底上才可用",这里正是那种情形)。 */
+.st-switch {
+  position: relative;
+  width: 36px;
+  height: 20px;
+  flex-shrink: 0;
+  border-radius: 999px;
+  border: 1px solid var(--border);
+  background: var(--chip-bg);
+  cursor: pointer;
+  transition: background 0.15s var(--ease), border-color 0.15s var(--ease);
+}
+.st-switch::after {
+  content: "";
+  position: absolute;
+  top: 2px;
+  left: 2px;
+  width: 16px;
+  height: 16px;
+  border-radius: 50%;
+  background: var(--fg);
+  transition: left 0.18s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.15s var(--ease);
+}
+.st-switch[data-on="true"] { background: var(--accent); border-color: var(--accent); }
+.st-switch[data-on="true"]::after { left: 18px; background: var(--on-accent); }
+.st-switch:hover { background: var(--chip-bg-hi); }
+/* 本区已栽四次的坑:基类 `.st-switch:hover`(优先级 2)与变体
+   `.st-switch[data-on="true"]`(优先级 2)同权重——鼠标一进开关,若没有专门的
+   `[data-on]:hover` 规则,两条同优先级规则谁赢会退化成"谁在源码里写在后面",
+   而不是"变体理应保持自己的实底"。用第三个选择器把优先级明确抬高到 3,
+   开态开关 hover 时保持 accent 实底,不被基类的 hover 底色顶掉。 */
+.st-switch[data-on="true"]:hover { background: var(--accent); border-color: var(--accent); }
+
+.aic-row { display: flex; align-items: center; gap: 16px; }
+.aic-row-text { flex: 1; min-width: 0; }
+.aic-row-label { font-size: 13px; font-weight: 500; color: var(--fg); }
+.aic-row-desc { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }
+
+.aic-progress { height: 4px; border-radius: 99px; background: var(--divider); margin-top: 8px; overflow: hidden; }
+.aic-progress > div { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); transition: width 0.2s ease; }
+
+.aic-btn {
+  display: inline-flex;
+  align-items: center;
+  gap: 6px;
+  border: 1px solid var(--card-border);
+  background: var(--chip-bg);
+  color: var(--fg);
+  font-size: 12px;
+  padding: 7px 12px;
+  border-radius: 999px;
+  cursor: pointer;
+  flex-shrink: 0;
+}
+.aic-btn:hover:not(:disabled) { background: var(--chip-bg-hi); }
+.aic-btn:disabled { opacity: 0.5; cursor: default; }
+.aic-btn svg { flex-shrink: 0; }
+
+.aic-spinner {
+  width: 12px;
+  height: 12px;
+  border-radius: 50%;
+  border: 2px solid var(--chip-border);
+  border-top-color: var(--accent);
+  animation: aic-spin 0.8s linear infinite;
+}
+@keyframes aic-spin { to { transform: rotate(360deg); } }
+</style>
diff --git a/src/photos/components/PhotosSidebar.vue b/src/photos/components/PhotosSidebar.vue
index 9021f33..76eeb78 100644
--- a/src/photos/components/PhotosSidebar.vue
+++ b/src/photos/components/PhotosSidebar.vue
@@ -1,53 +1,70 @@
 <script setup lang="ts">
-import { computed, onUnmounted, watch } from 'vue'
+import { computed, onMounted, onUnmounted, watch } from 'vue'
 import { useRouter, useRoute } from 'vue-router'
 import { useI18n } from 'vue-i18n'
 import { useSidebarDrawer } from '../../composables/useSidebarDrawer'
 import { useTimelineStore } from '../stores/timeline'
+import { usePhotosSettingsStore } from '../stores/settings'
 import { renderSize } from '../../files/util/format'
 import { activeNavId } from '../util/activeNavId'
 
 const router = useRouter()
 const route = useRoute()
 const { t } = useI18n()
 const timeline = useTimelineStore()
+// P8a-T6 (§7e-15):侧栏是相册区全部页面共用组件,自己拉一次 aiFeatures 配置来决定是否
+// 隐藏 smart-views 条目。store 是单例,与任意视图各自的 onMounted 同帧挂载会并发调用
+// fetchAiFeatures() —— 并发去重收在 settings.ts 里(见该文件 fetchAiFeatures 头部注释),
+// 这里只管调用,不用关心去重细节。
+const settings = usePhotosSettingsStore()
+onMounted(() => { void settings.fetchAiFeatures() })
 
 // 抽屉态:注意必须解构(嵌套 ref 在模板里不会自动解包,drawer.isNarrow 恒真值是坑)——照 FilesSidebar。
 const { isNarrow, open: drawerOpen, close: closeDrawer } = useSidebarDrawer()
 
 // 任何路由变化后抽屉自动收起;桌面态 close 是 no-op。
 watch(() => route.fullPath, () => closeDrawer())
 
 // ESC 关抽屉,仅在窄屏打开时监听。
 function onDrawerKeydown(e: KeyboardEvent) { if (e.key === 'Escape') closeDrawer() }
 watch(drawerOpen, (o) => {
   if (o) document.addEventListener('keydown', onDrawerKeydown)
   else document.removeEventListener('keydown', onDrawerKeydown)
 })
 onUnmounted(() => document.removeEventListener('keydown', onDrawerKeydown))
 
 // 导航条目注册表。
-const NAV = [
+const NAV_ALL = [
   { id: 'library', route: '/photos', labelKey: 'photosLibrary' },
   { id: 'albums', route: '/photos/albums', labelKey: 'photosAlbums' },
   { id: 'people', route: '/photos/people', labelKey: 'photosPeople' },
   { id: 'places', route: '/photos/places', labelKey: 'photosPlaces' },
   // SP7-P7a-T4:插在 places 之后、favorites 之前,照 Vue2 PhotosSidebar.vue:114-118 的顺序
   // (library / albums / people / places / smart)。7 项(原 6 项),favorites/trash 下标各 +1。
   { id: 'smart-views', route: '/photos/smart-views', labelKey: 'photosSvSmartViews' },
   { id: 'favorites', route: '/photos/favorites', labelKey: 'photosFavorites' },
   { id: 'trash', route: '/photos/trash', labelKey: 'photosTrash' },
 ]
 
+// P8a-T6(§7e-15):Vue2 PhotosSidebar.vue:120-122 —— `ai.smartview === false` 时
+// `items.filter(i => i.id !== 'smart')`。判据必须是 `=== false`,不是 `!x`:aiFeatures.
+// smartview 的默认值与"取数失败/字段缺失"的兜底值都是 `true`,只有后端明确说关了才隐藏这一
+// 条——配置读取抖动/请求失败不该让导航条目消失,吓用户以为功能不见了。
+const NAV = computed(() =>
+  settings.aiFeatures.smartview === false
+    ? NAV_ALL.filter((n) => n.id !== 'smart-views')
+    : NAV_ALL,
+)
+
 function isActive(n: { id: string }): boolean {
-  return activeNavId(route.path, NAV) === n.id
+  return activeNavId(route.path, NAV.value) === n.id
 }
 
 // 存储条:usedText = totalBytes 人类可读;percent = (diskTotal-diskAvail)/diskTotal,除零守卫。
 const usedText = computed(() => renderSize(timeline.indexStatus.totalBytes))
 const usedPercent = computed(() => {
   const total = timeline.indexStatus.diskTotal
   if (!total) return 0
   const used = total - timeline.indexStatus.diskAvail
   return Math.min(100, Math.max(0, (used / total) * 100))
 })
@@ -72,20 +89,31 @@ const usedPercent = computed(() => {
         </li>
       </ul>
     </section>
     <section class="side-section storage-bar">
       <h4 class="side-title">{{ t('photosStorage') }}</h4>
       <div class="storage-bar-track">
         <div class="storage-bar-fill" :style="{ width: usedPercent + '%' }"></div>
       </div>
       <p class="storage-bar-text">{{ usedText }}</p>
     </section>
+
+    <!-- SP7-P8a-T5:侧栏底部设置入口,照 Vue2 PhotosSidebar.vue:34-35 的齿轮按钮(那边
+         @open-settings 是 emit 给挂着 open prop 的全屏 overlay;本仓是真路由,直接
+         router.push)。不改 NAV 数组/既有导航项顺序——T6 要接的"smart-views 条件隐藏"
+         同样改 NAV,两者互不打扰。 -->
+    <section class="side-section side-settings">
+      <button type="button" class="side-settings-btn" data-test="sidebar-settings-link" @click="router.push('/photos/settings')">
+        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
+        <span class="side-name">{{ t('photosSettingsTitle') }}</span>
+      </button>
+    </section>
   </aside>
 </template>
 
 <style scoped>
 /* 与 FilesSidebar/AppsSidebar 同一壳形态(玻璃面板 + 窄屏抽屉)。token 五件套照抄。 */
 .photos-sidebar {
   flex: 0 0 220px; align-self: stretch; box-sizing: border-box;
   display: flex; flex-direction: column; gap: 18px;
   padding: 14px; overflow-y: auto;
   background: var(--panel-bg); border: 1px solid var(--card-border);
@@ -101,20 +129,28 @@ const usedPercent = computed(() => {
 .side-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px; cursor: pointer; color: var(--fg); }
 .side-item:hover { background: var(--chip-bg-hi); }
 .side-item.active { background: color-mix(in srgb, var(--accent) 16%, transparent); }
 .side-name { flex: 1 1 auto; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
 
 .storage-bar { margin-top: auto; } /* 存储条压到侧栏底部 */
 .storage-bar-track { height: 6px; border-radius: 999px; background: var(--chip-bg-hi); overflow: hidden; }
 .storage-bar-fill { height: 100%; border-radius: 999px; background: var(--accent); }
 .storage-bar-text { margin: 6px 0 0; font-size: 12px; color: var(--fg-muted, #9aa4bf); }
 
+/* 设置入口:紧跟存储条之后,视觉上处于侧栏最底部。 */
+.side-settings-btn {
+  display: flex; align-items: center; gap: 8px; width: 100%; margin-top: 10px;
+  padding: 6px 8px; border: none; border-radius: 10px; background: transparent;
+  color: var(--fg); font: inherit; cursor: pointer;
+}
+.side-settings-btn:hover { background: var(--chip-bg-hi); }
+
 .side-scrim { position: fixed; inset: 0; z-index: 150; background: var(--overlay-bg); }
 .photos-sidebar.is-drawer {
   position: fixed; left: 0; top: 0; bottom: 0; z-index: 151; width: 250px;
   padding: 16px; background: var(--card-bg); backdrop-filter: var(--blur);
   border: none; border-right: 1px solid var(--card-border);
   border-radius: 0; box-shadow: none;
   transform: translateX(-105%); transition: transform 0.25s var(--ease);
 }
 .photos-sidebar.is-drawer.is-open { transform: none; }
 @media (prefers-reduced-motion: reduce) { .photos-sidebar.is-drawer { transition: none; } }
diff --git a/src/photos/components/PhotosStorageCard.vue b/src/photos/components/PhotosStorageCard.vue
new file mode 100644
index 0000000..9247070
--- /dev/null
+++ b/src/photos/components/PhotosStorageCard.vue
@@ -0,0 +1,342 @@
+<!--
+  SP7-P8a-T3: 设置页存储卡。
+  回源坐标:Vue2 PhotosSettings.vue:39-126(模板)、:299-331(capGB/freeGB/usedGB/
+  prunableBytes/scanIntervalOptions/breakdown/pctOf)、:382(fmt)、:405-457
+  (fmtBytes/clearCache/rescanNow/setScanInterval)。
+
+  卡片自己不弹 toast —— @toast 事件统一由 T5 的容器承接,同 Vue2 把 toast 状态放在容器
+  PhotosSettings.vue、showToast() 定义在 :487-491 一致。
+
+  接口边界记录(brief 的 Consumes 列表没点名,这里显式登记给 T5/T4 的实现者看):
+  - `about`/`deviceName` 直接读 store.about?.deviceName,不在本卡调用 fetchAbout()——
+    Vue2 mounted() 里 loadAbout() 与 loadStorage() 是同一个组件的两个并列调用,拆分后
+    "谁取 about" 没有强制归属;由本卡的姐妹组件(T5 容器,footer 也要 about.version)
+    统一取一次更省一次网络往返。取数完成前显示 Vue2 同款兜底 'NAS'。
+  - retentionDays/scanIntervalMinutes 同理不在本卡调用 fetchRetention()/fetchScanInterval()
+    (brief 的 Consumes 列表也没点这两个 action 名)——假定 T5 在挂载整页时统一取一次;
+    在那之前直接读 store 默认值(30/1440),取数落地后随 store 响应式更新。
+  - fetchStorage() **有**在 Consumes 列表里点名,所以本卡自己在 mounted 时调用一次
+    (与 Vue2 loadStorage() 对应),不依赖 T5。
+-->
+<script setup lang="ts">
+import { computed, onMounted, ref } from 'vue'
+import { useI18n } from 'vue-i18n'
+import { usePhotosSettingsStore } from '../stores/settings'
+import { fmtGB, fmtBytes, buildBreakdown, type StorageSegKey } from '../util/storagePalette'
+
+const emit = defineEmits<{ toast: [{ icon: string; text: string }] }>()
+
+const { t } = useI18n()
+const store = usePhotosSettingsStore()
+
+const deviceName = computed(() => store.about?.deviceName || 'NAS')
+
+const capGB = computed(() => (store.storage ? store.storage.diskTotalBytes / 1024 ** 3 : 0))
+const freeGB = computed(() => (store.storage ? store.storage.diskFreeBytes / 1024 ** 3 : 0))
+const usedGB = computed(() => Math.max(0, capGB.value - freeGB.value))
+const prunableBytes = computed(() => store.storage?.prunableBytes ?? 0)
+const breakdown = computed(() => (store.storage ? buildBreakdown(store.storage, usedGB.value) : []))
+function pctOf(gb: number): number {
+  return capGB.value > 0 ? (gb / capGB.value) * 100 : 0
+}
+
+const SEG_LABEL_KEYS: Record<StorageSegKey, string> = {
+  photos: 'photosSettingsSegPhotos',
+  videos: 'photosSettingsSegVideos',
+  raw: 'photosSettingsSegRaw',
+  thumbs: 'photosSettingsSegThumbs',
+  ai: 'photosSettingsSegAi',
+  other: 'photosSettingsSegOther',
+}
+
+const RETENTION_OPTIONS = [7, 15, 30, 60, 90] as const
+
+// Vue2 PhotosSettings.vue:304-311 的 scanIntervalOptions:6h/12h/24h/7d 这四个 label 在源里
+// 是裸字面量、从不过 $t(只有 off 那一档过 $t('scan_interval_off'))——它们是时长单位缩写
+// (小时/天),不是需要按语言翻译的自然语言句子,故照搬为字面量,不新增/复用 i18n key
+// (task-3-brief.md 的 ruling #1)。
+const scanIntervalOptions = computed(() => [
+  { min: 0, label: t('photosSettingsScanIntervalOff') },
+  { min: 360, label: '6h' },
+  { min: 720, label: '12h' },
+  { min: 1440, label: '24h' },
+  { min: 10080, label: '7d' },
+])
+
+async function selectRetention(d: number): Promise<void> {
+  const ok = await store.setRetention(d)
+  if (!ok) {
+    // Vue2 :254-262 的 retention watcher 失败时走 $buefy.toast(与本卡 showToast 完全不同的
+    // 提示组件,New-UI 没有等价物),不是 showToast(icon,...) 调用,所以源里没有一个可以照搬
+    // 的 icon 名。按语义最接近的既有 showToast 调用类比——":274-279" features 保存失败同样是
+    // "设置保存失败"场景,用的是 'shield' —— 这里同样取 'shield'。
+    emit('toast', { icon: 'shield', text: t('photosSettingsRetentionFailed') })
+  }
+}
+
+async function selectScanInterval(min: number): Promise<void> {
+  const ok = await store.setScanInterval(min)
+  if (!ok) {
+    // Vue2 :447-457 的失败分支同样走 $buefy.toast,文案还复用了 retention 的
+    // "Failed to save retention"(拷贝失误,不是本卡引入的新缺陷)。T2 没有为 scanInterval
+    // 单开一个失败文案键,本任务文件清单不含 i18n(不能新增/改键),故沿用同一个已存在的键,
+    // 与 Vue2 的实际文案选择保持一致——真正的修法是给 i18n 补一个专属键,挂账留给后续任务。
+    emit('toast', { icon: 'shield', text: t('photosSettingsRetentionFailed') })
+  }
+}
+
+const busy = ref(false)
+const cleared = ref(false)
+let clearedTimer: ReturnType<typeof setTimeout> | undefined
+
+async function clearCache(): Promise<void> {
+  if (busy.value) return
+  busy.value = true
+  try {
+    const freed = await store.pruneCache()
+    cleared.value = true
+    emit('toast', { icon: 'trash', text: t('photosSettingsCacheClearedToast', { size: fmtBytes(freed) }) })
+    // Vue2 :423 —— 清完必须重拉一次 storage,否则容量条/大数字不会反映刚清出的空间。
+    await store.fetchStorage()
+    clearTimeout(clearedTimer)
+    clearedTimer = setTimeout(() => { cleared.value = false }, 2000)
+  } catch {
+    emit('toast', { icon: 'trash', text: t('photosSettingsCacheClearFailed') })
+  } finally {
+    busy.value = false
+  }
+}
+
+const scanBusy = ref(false)
+async function rescanNow(): Promise<void> {
+  if (scanBusy.value) return
+  scanBusy.value = true
+  try {
+    await store.triggerScan()
+    emit('toast', { icon: 'check', text: t('photosSettingsRescanStarted') })
+  } catch {
+    // Vue2 :441 同样的拷贝缺陷("Failed to start rebuild",不是重扫专属文案),原因同上
+    // selectScanInterval 的注释——沿用 Vue2 实际选择的既有键,不新增。
+    emit('toast', { icon: 'trash', text: t('photosSettingsRebuildStartFailed') })
+  } finally {
+    scanBusy.value = false
+  }
+}
+
+onMounted(() => {
+  void store.fetchStorage()
+})
+</script>
+
+<template>
+  <section class="psc-card" id="storage">
+    <header class="psc-head">
+      <div class="psc-icon">
+        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
+          <rect x="3" y="4" width="18" height="16" rx="2" />
+          <path d="M3 10h18" />
+          <circle cx="7" cy="14" r="1" fill="currentColor" stroke="none" />
+        </svg>
+      </div>
+      <div>
+        <h2 class="psc-title">{{ t('photosSettingsStorage') }}</h2>
+        <div class="psc-sub">{{ deviceName }} &middot; {{ fmtGB(capGB) }} GB {{ t('photosSettingsVolume') }}</div>
+      </div>
+      <div class="psc-spacer"></div>
+      <div class="psc-headline" data-test="storage-headline">
+        <div v-if="store.storage" class="big">{{ fmtGB(freeGB) }} GB <span>{{ t('photosSettingsFree') }}</span></div>
+        <div v-else class="big">&mdash;</div>
+        <div v-if="store.storage" class="sub">{{ fmtGB(usedGB) }} GB {{ t('photosSettingsUsedOf') }} {{ fmtGB(capGB) }} GB</div>
+        <div v-else-if="store.storageError" class="sub">{{ t('photosSettingsStorageUnavailable') }}</div>
+      </div>
+    </header>
+
+    <div class="psc-bar">
+      <div
+        v-for="seg in breakdown" :key="seg.key" class="psc-bar-seg" data-test="bar-seg"
+        :title="`${t(SEG_LABEL_KEYS[seg.key])} · ${fmtGB(seg.gb)} GB`"
+        :style="{ width: pctOf(seg.gb) + '%', background: seg.color }"
+      ></div>
+      <div class="psc-bar-free" data-test="bar-free" :style="{ width: pctOf(freeGB) + '%' }"></div>
+    </div>
+    <div class="psc-legend">
+      <div v-for="seg in breakdown" :key="seg.key" class="psc-legend-row">
+        <span class="dot" :style="{ background: seg.color }"></span>
+        <span class="lbl">{{ t(SEG_LABEL_KEYS[seg.key]) }}</span>
+        <span class="val">{{ fmtGB(seg.gb) }} GB</span>
+      </div>
+      <div class="psc-legend-row">
+        <span class="dot psc-dot-free"></span>
+        <span class="lbl">{{ t('photosSettingsSegFree') }}</span>
+        <span class="val">{{ fmtGB(freeGB) }} GB</span>
+      </div>
+    </div>
+
+    <div class="psc-divider"></div>
+
+    <div class="psc-row">
+      <div class="psc-row-text">
+        <div class="psc-row-label">{{ t('photosSettingsRetentionLabel') }}</div>
+        <div class="psc-row-desc">{{ t('photosSettingsRetentionDesc') }}</div>
+      </div>
+      <div class="psc-seg" data-test="retention-seg">
+        <button
+          v-for="d in RETENTION_OPTIONS" :key="d" type="button" class="seg-btn"
+          :data-active="store.retentionDays === d" @click="selectRetention(d)"
+        >{{ t('photosSettingsRetentionDay', { n: d }) }}</button>
+      </div>
+    </div>
+
+    <div class="psc-row">
+      <div class="psc-row-text">
+        <div class="psc-row-label">{{ t('photosSettingsRescanLabel') }}</div>
+        <div class="psc-row-desc">{{ t('photosSettingsRescanDesc') }}</div>
+      </div>
+      <button type="button" class="psc-btn" data-test="rescan-now" :disabled="scanBusy" @click="rescanNow">
+        <span v-if="scanBusy" class="psc-spinner"></span>
+        {{ scanBusy ? t('photosSettingsRescanning') : t('photosSettingsRescanNow') }}
+      </button>
+    </div>
+
+    <div class="psc-row">
+      <div class="psc-row-text">
+        <div class="psc-row-label">{{ t('photosSettingsScanIntervalLabel') }}</div>
+        <div class="psc-row-desc">{{ t('photosSettingsScanIntervalDesc') }}</div>
+      </div>
+      <div class="psc-seg" data-test="scan-seg">
+        <button
+          v-for="opt in scanIntervalOptions" :key="opt.min" type="button" class="seg-btn"
+          :data-active="store.scanIntervalMinutes === opt.min" @click="selectScanInterval(opt.min)"
+        >{{ opt.label }}</button>
+      </div>
+    </div>
+
+    <div class="psc-row">
+      <div class="psc-row-text">
+        <div class="psc-row-label">{{ t('photosSettingsCacheLabel') }}</div>
+        <div class="psc-row-desc">{{ t('photosSettingsCacheDesc') }}</div>
+      </div>
+      <button type="button" class="psc-btn" data-test="clear-cache" :disabled="busy || !prunableBytes" @click="clearCache">
+        <svg v-if="!busy && !cleared" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
+        <span v-if="busy" class="psc-spinner"></span>
+        <svg v-if="cleared" class="psc-check" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
+        {{ busy ? t('photosSettingsClearing') : cleared ? t('photosSettingsCleared') : `${t('photosSettingsClearCache')} (${fmtBytes(prunableBytes)})` }}
+      </button>
+    </div>
+  </section>
+</template>
+
+<style scoped>
+.psc-card {
+  background: var(--card-bg);
+  border: 1px solid var(--card-border);
+  border-radius: var(--radius-sm);
+  box-shadow: var(--card-shadow);
+  padding: 20px 22px;
+  display: flex;
+  flex-direction: column;
+}
+
+.psc-head { display: flex; align-items: flex-start; gap: 12px; }
+
+.psc-icon {
+  width: 32px;
+  height: 32px;
+  flex-shrink: 0;
+  border-radius: 10px;
+  display: flex;
+  align-items: center;
+  justify-content: center;
+  background: var(--accent-soft);
+  color: var(--accent);
+}
+
+.psc-title { margin: 0; font-size: 15px; font-weight: 600; color: var(--fg); }
+.psc-sub { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }
+.psc-spacer { flex: 1; }
+
+.psc-headline { text-align: right; }
+.psc-headline .big { font-size: 20px; font-weight: 600; color: var(--fg); font-family: var(--num-font); }
+.psc-headline .big span { font-size: 12px; font-weight: 400; color: var(--fg-muted); margin-left: 4px; }
+.psc-headline .sub { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }
+
+.psc-bar {
+  display: flex;
+  height: 8px;
+  border-radius: 999px;
+  overflow: hidden;
+  background: var(--divider);
+  margin-top: 14px;
+}
+.psc-bar-seg { height: 100%; }
+.psc-bar-free { height: 100%; background: var(--divider); }
+
+.psc-legend { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 10px; }
+.psc-legend-row { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--fg-muted); }
+.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
+.psc-dot-free { background: var(--divider); border: 1px solid var(--card-border); }
+.val { color: var(--fg); font-weight: 500; }
+
+.psc-divider { height: 1px; background: var(--divider); margin: 16px 0; }
+
+.psc-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 0; }
+.psc-row-label { font-size: 13px; font-weight: 500; color: var(--fg); }
+.psc-row-desc { font-size: 12px; color: var(--fg-muted); margin-top: 2px; max-width: 360px; }
+
+.psc-seg {
+  display: inline-flex;
+  background: var(--chip-bg);
+  border: 1px solid var(--card-border);
+  border-radius: 999px;
+  padding: 2px;
+  gap: 2px;
+  flex-shrink: 0;
+}
+
+.seg-btn {
+  border: none;
+  background: transparent;
+  color: var(--fg-muted);
+  font-size: 12px;
+  padding: 6px 10px;
+  border-radius: 999px;
+  cursor: pointer;
+}
+.seg-btn:hover { background: var(--chip-bg-hi); }
+.seg-btn[data-active="true"] { background: var(--accent); color: var(--on-accent); }
+/* 本区已栽四次的坑:基类 `.seg-btn:hover`(优先级 2:一个类 + 一个伪类)与变体
+   `.seg-btn[data-active="true"]`(优先级 2:一个类 + 一个属性选择器)相等——同优先级下
+   源码顺序在.seg-btn:hover之后声明的[data-active]规则平时能压住,但鼠标一进按钮触发
+   `.seg-btn:hover`,若没有专门的 [data-active]:hover 规则,两条同优先级规则的胜负会变得
+   脆弱(依赖书写顺序而非语义)。变体必须自带 :hover 规则,用第三个选择器把优先级明确
+   抬高到 3,不依赖 tie-break。 */
+.seg-btn[data-active="true"]:hover { background: var(--accent); color: var(--on-accent); }
+
+.psc-btn {
+  display: inline-flex;
+  align-items: center;
+  gap: 6px;
+  border: 1px solid var(--card-border);
+  background: var(--chip-bg);
+  color: var(--fg);
+  font-size: 12px;
+  padding: 7px 12px;
+  border-radius: 999px;
+  cursor: pointer;
+  flex-shrink: 0;
+}
+.psc-btn:hover:not(:disabled) { background: var(--chip-bg-hi); }
+.psc-btn:disabled { opacity: 0.5; cursor: default; }
+.psc-btn svg { flex-shrink: 0; }
+.psc-check { color: var(--success); }
+
+.psc-spinner {
+  width: 12px;
+  height: 12px;
+  border-radius: 50%;
+  border: 2px solid var(--chip-border);
+  border-top-color: var(--accent);
+  animation: psc-spin 0.8s linear infinite;
+}
+@keyframes psc-spin { to { transform: rotate(360deg); } }
+</style>
diff --git a/src/photos/components/__tests__/PhotosAiCard.test.ts b/src/photos/components/__tests__/PhotosAiCard.test.ts
new file mode 100644
index 0000000..935e82c
--- /dev/null
+++ b/src/photos/components/__tests__/PhotosAiCard.test.ts
@@ -0,0 +1,274 @@
+// SP7-P8a-T4: PhotosAiCard.vue —— 设置页 AI 卡。
+// 回源坐标见 task-4-brief.md;Vue2 PhotosSettings.vue:129-192(模板)/:283-291(watcher)/
+// :332-370(computed)/:458-486(rebuildIndex/doRecluster)。
+//
+// 测试基建沿用 T3(PhotosStorageCard.test.ts)已验证过的既定做法(brief 草稿引用的
+// @pinia/testing / winningDeclaration 均不存在于本仓,详见该文件头注释):
+// - setActivePinia(createPinia()) 起真实 store,vi.spyOn(store, 'action') 按需 stub。
+// - mock 的是共享包 @nimotech/nimoos-service,不是 store 本身。
+// - hover 级联守卫用 cssCascade.ts 的 extractStyleBlock/winningHoverBackground。
+import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
+import { mount, flushPromises } from '@vue/test-utils'
+import { setActivePinia, createPinia } from 'pinia'
+import { nextTick } from 'vue'
+
+vi.mock('@nimotech/nimoos-service', () => ({
+  service: {
+    photos: {
+      getConfig: vi.fn(),
+      updateConfig: vi.fn(),
+      getStorage: vi.fn(),
+      getAbout: vi.fn(),
+      pruneCache: vi.fn(),
+      rebuildIndex: vi.fn(),
+      triggerScan: vi.fn(),
+      reclusterFaces: vi.fn(),
+      getTimeline: vi.fn(),
+      getStatus: vi.fn(),
+      listTasks: vi.fn(),
+    },
+  },
+}))
+
+import PhotosAiCard from '../PhotosAiCard.vue'
+import photosAiCardRaw from '../PhotosAiCard.vue?raw'
+import { usePhotosSettingsStore } from '../../stores/settings'
+import { useTimelineStore } from '../../stores/timeline'
+import { extractStyleBlock, winningHoverBackground } from './cssCascade'
+import type { TaskBusPayload } from '../../util/taskBus'
+
+function mountCard() {
+  const wrapper = mount(PhotosAiCard)
+  const store = usePhotosSettingsStore()
+  const timeline = useTimelineStore()
+  return { wrapper, store, timeline }
+}
+
+function rebuildTaskFixture(overrides: Partial<TaskBusPayload> = {}): TaskBusPayload {
+  return { id: 'rb-1', type: 'rebuild', status: 'running', progress: 0, ...overrides }
+}
+
+describe('PhotosAiCard', () => {
+  beforeEach(() => {
+    setActivePinia(createPinia())
+    vi.clearAllMocks()
+  })
+
+  afterEach(() => {
+    vi.useRealTimers()
+  })
+
+  it('4 个开关顺序固定 faces→scenes→ocr→smartview(Vue2 :363-369)', () => {
+    const { wrapper } = mountCard()
+    const switches = wrapper.findAll('[data-test^="ai-switch-"]')
+    expect(switches.map(s => s.attributes('data-test'))).toEqual([
+      'ai-switch-faces', 'ai-switch-scenes', 'ai-switch-ocr', 'ai-switch-smartview',
+    ])
+  })
+
+  it('点开关调 setAiFeature(id, 新值);失败时 emit toast', async () => {
+    const { wrapper, store } = mountCard()
+    vi.spyOn(store, 'setAiFeature').mockResolvedValue(false)
+    store.aiFeatures.faces = true
+    await nextTick()
+    await wrapper.get('[data-test="ai-switch-faces"]').trigger('click')
+    expect(store.setAiFeature).toHaveBeenCalledWith('faces', false)
+    await flushPromises()
+    const toasts = wrapper.emitted('toast')
+    expect(toasts).toBeTruthy()
+    expect(toasts![0]![0]).toMatchObject({ icon: 'shield' })
+  })
+
+  it('点开关成功不 emit toast', async () => {
+    const { wrapper, store } = mountCard()
+    vi.spyOn(store, 'setAiFeature').mockResolvedValue(true)
+    store.aiFeatures.scenes = true
+    await nextTick()
+    await wrapper.get('[data-test="ai-switch-scenes"]').trigger('click')
+    expect(store.setAiFeature).toHaveBeenCalledWith('scenes', false)
+    await flushPromises()
+    expect(wrapper.emitted('toast')).toBeFalsy()
+  })
+
+  it('indexedPct 把后端 0-1 小数换算成百分数(progress 0.42 → 42%)(Vue2 :339)', async () => {
+    const { wrapper, timeline } = mountCard()
+    timeline.tasks = [rebuildTaskFixture({ progress: 0.42 })]
+    await nextTick()
+    expect(wrapper.get('[data-test="index-progress"] > div').attributes('style')).toContain('42%')
+    expect(wrapper.text()).toContain('42')
+  })
+
+  it('rebuildTask 查找优先级:先 rebuildTaskId,再任意 type=rebuild(Vue2 :332-337)', async () => {
+    const { wrapper, store, timeline } = mountCard()
+    vi.spyOn(store, 'rebuildIndex').mockResolvedValue('rb-target')
+    // rb-other 先于 rb-target 出现在列表里,且是 type==='rebuild' 的唯一"后备命中"——
+    // 但它是 done 状态(不禁用按钮),用于证明"记住的 rebuildTaskId 命中后不再理会
+    // 列表里排在前面的其它 rebuild 任务"。rb-target 是 running + 90%,点击后 store 返回
+    // 它的 id,组件应绑定到它,而不是继续停留在后备命中的 rb-other 上。
+    timeline.tasks = [
+      rebuildTaskFixture({ id: 'rb-other', status: 'done', progress: 0.1 }),
+      rebuildTaskFixture({ id: 'rb-target', status: 'running', progress: 0.9 }),
+    ]
+    await nextTick()
+    expect(wrapper.get('[data-test="rebuild-index"]').attributes('disabled')).toBeUndefined()
+    await wrapper.get('[data-test="rebuild-index"]').trigger('click')
+    await flushPromises()
+    await nextTick()
+    // rebuildTaskId 记住了 'rb-target' —— 应该绑定到那条(90%),不是后备命中的 rb-other
+    expect(wrapper.text()).toContain('90')
+  })
+
+  it('rebuildTaskId 找不到匹配项时回退到任意 type=rebuild 的任务', async () => {
+    const { wrapper, timeline } = mountCard()
+    // 没有调用过 rebuildIndex(rebuildTaskId 仍是初始空串)——直接靠 type==='rebuild' 兜底命中
+    timeline.tasks = [rebuildTaskFixture({ id: 'rb-any', progress: 0.55 })]
+    await nextTick()
+    expect(wrapper.text()).toContain('55')
+  })
+
+  it('只在 running→done 的跳变上弹「已重建」toast,不在每次刷新都弹(Vue2 :283-284)', async () => {
+    const { wrapper, timeline } = mountCard()
+    // 先把任务置成 done(无 running 前态)→ 断言零 toast
+    timeline.tasks = [rebuildTaskFixture({ status: 'done' })]
+    await nextTick()
+    expect(wrapper.emitted('toast')).toBeFalsy()
+
+    // 再走 running → done → 断言恰好一条 toast
+    timeline.tasks = [rebuildTaskFixture({ status: 'running' })]
+    await nextTick()
+    expect(wrapper.emitted('toast')).toBeFalsy()
+    timeline.tasks = [rebuildTaskFixture({ status: 'done', total: 128 })]
+    await nextTick()
+    const toasts = wrapper.emitted('toast')
+    expect(toasts).toHaveLength(1)
+    expect(toasts![0]![0]).toMatchObject({ icon: 'sparkles' })
+    expect((toasts![0]![0] as { text: string }).text).toContain('128')
+
+    // 再刷新一次仍是 done(同状态,非跳变)→ 不应再弹第二条
+    timeline.tasks = [rebuildTaskFixture({ status: 'done', total: 128 })]
+    await nextTick()
+    expect(wrapper.emitted('toast')).toHaveLength(1)
+  })
+
+  it('running→done 跳变后重拉 about(Vue2 :286)', async () => {
+    const { wrapper, store, timeline } = mountCard()
+    const fetchSpy = vi.spyOn(store, 'fetchAbout').mockResolvedValue(undefined)
+    timeline.tasks = [rebuildTaskFixture({ status: 'running' })]
+    await nextTick()
+    timeline.tasks = [rebuildTaskFixture({ status: 'done' })]
+    await nextTick()
+    await flushPromises()
+    expect(fetchSpy).toHaveBeenCalledTimes(1)
+    // 确认这次报告没有虚报:done 之外的状态变化不应触发重拉
+    void wrapper
+  })
+
+  it('running→error 弹失败 toast(附 task.error),不要求跳变', async () => {
+    const { wrapper, timeline } = mountCard()
+    timeline.tasks = [rebuildTaskFixture({ status: 'error', error: 'disk full' })]
+    await nextTick()
+    const toasts = wrapper.emitted('toast')
+    expect(toasts).toHaveLength(1)
+    expect(toasts![0]![0]).toMatchObject({ icon: 'shield' })
+    expect((toasts![0]![0] as { text: string }).text).toContain('disk full')
+  })
+
+  it('lastBuilt 为空显示 never(Vue2 :343-344)', async () => {
+    const { wrapper, store } = mountCard()
+    store.about = { version: '1.0', deviceName: 'NAS', indexCoverage: 0, indexLastBuilt: '', librarySince: '' }
+    await nextTick()
+    expect(wrapper.text()).toContain('从未')
+  })
+
+  it('about 取数前(null)不崩溃,lastBuilt 显示 never、coverage 显示 0', async () => {
+    const { wrapper, store } = mountCard()
+    expect(store.about).toBeNull()
+    await nextTick()
+    expect(wrapper.text()).toContain('从未')
+    expect(wrapper.text()).toContain('覆盖 0')
+  })
+
+  it('lastBuilt 的日期跟随 i18n locale(Vue2 无 locale 参数是缺陷,本期改正)', async () => {
+    const { wrapper, store } = mountCard()
+    store.about = {
+      version: '1.0', deviceName: 'NAS', indexCoverage: 10,
+      indexLastBuilt: '2026-03-15T08:30:00Z', librarySince: '',
+    }
+    await nextTick()
+    const text = wrapper.text()
+    // zh 默认 locale 下 Intl.DateTimeFormat('zh-CN', {month:'short'}) 输出"3月"这类中文月份,
+    // 不应出现英文月份缩写(如 Mar)——反证 Vue2 缺陷(跟随系统/浏览器 locale)已被修正。
+    expect(text).not.toMatch(/\bMar\b/)
+    expect(text).toContain('2026')
+  })
+
+  it('recluster 点一次后 3 秒内禁用(防连点)(Vue2 :483-484)', async () => {
+    vi.useFakeTimers()
+    const { wrapper, store } = mountCard()
+    vi.spyOn(store, 'reclusterFaces').mockResolvedValue(true)
+    const btn = wrapper.get('[data-test="recluster"]')
+    await btn.trigger('click')
+    await flushPromises()
+    expect(wrapper.get('[data-test="recluster"]').attributes('disabled')).toBeDefined()
+    await vi.advanceTimersByTimeAsync(2999)
+    expect(wrapper.get('[data-test="recluster"]').attributes('disabled')).toBeDefined()
+    await vi.advanceTimersByTimeAsync(2)
+    expect(wrapper.get('[data-test="recluster"]').attributes('disabled')).toBeUndefined()
+  })
+
+  it('recluster 失败也在 3 秒后解禁(finally 分支)', async () => {
+    vi.useFakeTimers()
+    const { wrapper, store } = mountCard()
+    vi.spyOn(store, 'reclusterFaces').mockRejectedValue(new Error('boom'))
+    const btn = wrapper.get('[data-test="recluster"]')
+    await btn.trigger('click')
+    await flushPromises()
+    const toasts = wrapper.emitted('toast')
+    expect(toasts).toBeTruthy()
+    expect(toasts![0]![0]).toMatchObject({ icon: 'shield' })
+    expect(wrapper.get('[data-test="recluster"]').attributes('disabled')).toBeDefined()
+    await vi.advanceTimersByTimeAsync(3000)
+    expect(wrapper.get('[data-test="recluster"]').attributes('disabled')).toBeUndefined()
+  })
+
+  it('rebuild index 按钮 indexing 时禁用', async () => {
+    const { wrapper, timeline } = mountCard()
+    timeline.tasks = [rebuildTaskFixture({ status: 'running' })]
+    await nextTick()
+    expect(wrapper.get('[data-test="rebuild-index"]').attributes('disabled')).toBeDefined()
+  })
+
+  it('rebuild index 点击调 store.rebuildIndex();非 409 失败(store 抛出)时 emit 兜底 toast', async () => {
+    const { wrapper, store } = mountCard()
+    vi.spyOn(store, 'rebuildIndex').mockRejectedValue(new Error('boom'))
+    await wrapper.get('[data-test="rebuild-index"]').trigger('click')
+    await flushPromises()
+    expect(store.rebuildIndex).toHaveBeenCalledTimes(1)
+    const toasts = wrapper.emitted('toast')
+    expect(toasts).toBeTruthy()
+    expect(toasts![0]![0]).toMatchObject({ icon: 'shield' })
+  })
+
+  it('mount 时不主动取数(about/aiFeatures/tasks 一律不调用,由 T5 容器统一取)', () => {
+    const settingsStore = usePhotosSettingsStore()
+    const fetchAiSpy = vi.spyOn(settingsStore, 'fetchAiFeatures')
+    const fetchAboutSpy = vi.spyOn(settingsStore, 'fetchAbout')
+    const timelineStore = useTimelineStore()
+    const fetchTasksSpy = vi.spyOn(timelineStore, 'fetchTasks')
+    mount(PhotosAiCard)
+    expect(fetchAiSpy).not.toHaveBeenCalled()
+    expect(fetchAboutSpy).not.toHaveBeenCalled()
+    expect(fetchTasksSpy).not.toHaveBeenCalled()
+  })
+})
+
+describe('样式:开关 [data-on] 变体自带 hover 背景(本区已栽四次)', () => {
+  it('st-switch 的 hover 胜出规则同时含 :hover 与 data-on', () => {
+    expect(photosAiCardRaw.length).toBeGreaterThan(0)
+    const style = extractStyleBlock(photosAiCardRaw)
+    expect(style.length).toBeGreaterThan(0)
+    const winner = winningHoverBackground(style, ['st-switch'])
+    expect(winner.selector).toContain(':hover')
+    expect(winner.selector).toContain('data-on')
+  })
+})
diff --git a/src/photos/components/__tests__/PhotosSidebar.test.ts b/src/photos/components/__tests__/PhotosSidebar.test.ts
index 5779293..8bd7bd3 100644
--- a/src/photos/components/__tests__/PhotosSidebar.test.ts
+++ b/src/photos/components/__tests__/PhotosSidebar.test.ts
@@ -1,47 +1,60 @@
-import { describe, it, expect, beforeEach } from 'vitest'
+import { describe, it, expect, beforeEach, vi } from 'vitest'
 import { mount, flushPromises } from '@vue/test-utils'
 import { setActivePinia, createPinia } from 'pinia'
 import { createI18n } from 'vue-i18n'
 import { createRouter, createMemoryHistory } from 'vue-router'
 import { nextTick } from 'vue'
 import zh from '../../../i18n/zh_cn'
 import PhotosSidebar from '../PhotosSidebar.vue'
 import { useTimelineStore } from '../../stores/timeline'
+import { usePhotosSettingsStore } from '../../stores/settings'
 import { useSidebarDrawer, __resetSidebarDrawerForTest } from '../../../composables/useSidebarDrawer'
 
+// P8a-T6(§7e-15):侧栏现在自己也读一次 aiFeatures 配置(见 PhotosSidebar.vue 头部注释)。
+// 默认解析成 `{}`(readAiFeatures 对缺字段一律按开启处理,smartview 仍是 true)——这个默认值
+// 让本文件其余既有测试(挂载后同步断言 7 项)保持不变:那些断言都发生在 fetchAiFeatures()
+// 的 promise resolve 之前,读到的是 store 的初始值(全 true),不受这个 mock 影响。
+vi.mock('@nimotech/nimoos-service', () => ({
+  service: { photos: { getConfig: vi.fn() } },
+}))
+import { service } from '@nimotech/nimoos-service'
+
 const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
 
 const testRouter = createRouter({
   history: createMemoryHistory(),
   routes: [
     { path: '/', name: 'home', component: { template: '<div/>' } },
     { path: '/photos', name: 'photos', component: { template: '<div/>' } },
     { path: '/photos/favorites', name: 'photos-favorites', component: { template: '<div/>' } },
     { path: '/photos/trash', name: 'photos-trash', component: { template: '<div/>' } },
     { path: '/photos/albums', name: 'photos-albums', component: { template: '<div/>' } },
     { path: '/photos/albums/:id', name: 'photos-album-detail', component: { template: '<div/>' } },
     { path: '/photos/people', name: 'photos-people', component: { template: '<div/>' } },
     { path: '/photos/people/:id', name: 'photos-person-detail', component: { template: '<div/>' } },
     { path: '/photos/places', name: 'photos-places', component: { template: '<div/>' } },
     { path: '/photos/smart-views', name: 'photos-smart-views', component: { template: '<div/>' } },
+    // SP7-P8a-T5:设置入口的落点(见下方"设置入口"describe)。
+    { path: '/photos/settings', name: 'photos-settings', component: { template: '<div/>' } },
   ],
 })
 
 function mountSidebar() {
   return mount(PhotosSidebar, { global: { plugins: [i18n, testRouter] } })
 }
 
 describe('PhotosSidebar', () => {
   beforeEach(async () => {
     setActivePinia(createPinia())
     __resetSidebarDrawerForTest()
+    vi.mocked(service.photos.getConfig).mockReset().mockResolvedValue({})
     testRouter.push('/photos')
     await testRouter.isReady()
   })
 
   // SP7-P7a-T4:NAV 新增 smart-views,插在 places 之后、favorites 之前——原本 6 项变 7 项,
   // favorites/trash 的下标各 +1(原 4/5 → 现 5/6)。顺序照 Vue2 PhotosSidebar.vue:114-118
   // (library / albums / people / places / smart)。
   it('渲染七条导航项(照片库/相册/人物/地点/智能视图/收藏/最近删除),当前路由高亮', async () => {
     const w = mountSidebar()
     const items = w.findAll('.side-item')
@@ -229,11 +242,88 @@ describe('PhotosSidebar', () => {
     const d = useSidebarDrawer()
     d.isNarrow.value = true
     d.open.value = true
     mountSidebar()
     await nextTick()
     await testRouter.push('/')
     await flushPromises()
     await nextTick()
     expect(d.open.value).toBe(false)
   })
+
+  // SP7-P8a-T5:侧栏底部设置入口,指向 /photos/settings。不用 .side-item 选择器
+  // (那是 NAV 数组渲染出的既有 7 项,本条目是独立的新元素,故意用不同 class,不与
+  // 上面"7 条导航项"的既有断言互相干扰)。
+  describe('设置入口', () => {
+    it('侧栏底部存在设置入口', () => {
+      const w = mountSidebar()
+      expect(w.find('[data-test="sidebar-settings-link"]').exists()).toBe(true)
+      // 既有 7 项导航不受影响(不是新插进 NAV 数组的第 8 项)。
+      expect(w.findAll('.side-item')).toHaveLength(7)
+    })
+
+    it('点击设置入口 push 到 /photos/settings', async () => {
+      const w = mountSidebar()
+      await w.get('[data-test="sidebar-settings-link"]').trigger('click')
+      await flushPromises()
+      expect(testRouter.currentRoute.value.path).toBe('/photos/settings')
+    })
+  })
+
+  // P8a-T6(§7e-15):smartview 配置感知——Vue2 PhotosSidebar.vue:120-122 的
+  // `ai.smartview === false` 时 `items.filter(i => i.id !== 'smart')`。
+  describe('smartview 配置感知(§7e-15)', () => {
+    it('aiFeatures.smartview 为 false 时整条隐藏智能视图入口', async () => {
+      vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: { smartview: false } })
+      const w = mountSidebar()
+      await flushPromises()
+      await nextTick()
+      const items = w.findAll('.side-item')
+      expect(items).toHaveLength(6)
+      expect(items.some((i) => i.text().includes('智能视图'))).toBe(false)
+      // 剩下 6 项仍是原顺序去掉 smart-views 这一条(favorites/trash 紧跟 places)。
+      expect(items[3].text()).toContain('地点')
+      expect(items[4].text()).toContain('收藏')
+      expect(items[5].text()).toContain('最近删除')
+    })
+
+    // review fix(take-along):原标题「未确定(取数失败)」的外层「未确定」措辞会让人以为
+    // 这条测的是"尚未取到数"(fetch 还在途、还没 resolve)的那个分支——但下面 await
+    // flushPromises() 会先把 reject 结算掉,这里实际只走到了"取数失败"这个 catch 分支
+    // (恰好与初始值同为全 true,视觉上分不出来,但走的是不同代码路径)。标题去掉「未确定」,
+    // 明确写成"失败"。真正的"尚未取到数"分支由下面新增的同步用例补上。
+    it('smartview 请求失败(store 落入 catch 分支)时按开启显示,不吓用户', async () => {
+      vi.mocked(service.photos.getConfig).mockRejectedValue(new Error('boom'))
+      const w = mountSidebar()
+      await flushPromises()
+      await nextTick()
+      const items = w.findAll('.side-item')
+      expect(items).toHaveLength(7)
+      expect(items.some((i) => i.text().includes('智能视图'))).toBe(true)
+    })
+
+    // review fix(take-along):补上真正的"尚未取到数"分支——mount 之后不 flushPromises,
+    // fetchAiFeatures() 的 promise 还在途,store 的 aiFeatures 停在初始值(全 true)。
+    // 与上一条(失败分支落回全 true)在数值上恰好相同,但走的是不同代码路径(这里从没进过
+    // catch,是初始 ref 值),补这条才是名副其实的"加载中按开启显示"证明。
+    it('smartview 请求仍在途(尚未 resolve)时按开启显示,同步渲染 7 项', () => {
+      let resolveFn: ((v: Record<string, unknown>) => void) | undefined
+      vi.mocked(service.photos.getConfig).mockImplementation(
+        () => new Promise<Record<string, unknown>>((res) => { resolveFn = res }),
+      )
+      const w = mountSidebar()
+      const items = w.findAll('.side-item')
+      expect(items).toHaveLength(7)
+      expect(items.some((i) => i.text().includes('智能视图'))).toBe(true)
+      // 收尾:把挂起的 promise 结算掉,不让它泄漏到下一条用例。
+      resolveFn?.({})
+    })
+
+    it('挂载即调用一次 fetchAiFeatures(经 store 读配置,不直读 getConfig)', async () => {
+      const settings = usePhotosSettingsStore()
+      const spy = vi.spyOn(settings, 'fetchAiFeatures')
+      mountSidebar()
+      await flushPromises()
+      expect(spy).toHaveBeenCalledTimes(1)
+    })
+  })
 })
diff --git a/src/photos/components/__tests__/PhotosStorageCard.test.ts b/src/photos/components/__tests__/PhotosStorageCard.test.ts
new file mode 100644
index 0000000..740017c
--- /dev/null
+++ b/src/photos/components/__tests__/PhotosStorageCard.test.ts
@@ -0,0 +1,292 @@
+// SP7-P8a-T3: PhotosStorageCard.vue —— 设置页存储卡。
+// 回源坐标见 task-3-brief.md;Vue2 PhotosSettings.vue:39-126(模板)/:299-331(computed)/
+// :382(fmt)/:405-457(fmtBytes/五个动作方法)。
+//
+// 测试基建偏离登记(brief 与本仓实际不符,以本仓实测为准):
+// 1. brief 草稿用 `@pinia/testing` 的 `createTestingPinia({ stubActions: true })`,但本仓
+//    package.json 未装该包(`node_modules/.pnpm` 无 `@pinia/testing` 任何版本)。改用本仓
+//    settings.test.ts / AlbumPickerDialog.test.ts 的既定做法:`setActivePinia(createPinia())`
+//    起一个真实 store 实例,用 `vi.spyOn(store, 'action')` 单独按需 stub 需要控制返回值的
+//    action,其余走真实实现(mock 的是共享包 `@nimotech/nimoos-service`,不是 store 本身)。
+// 2. brief Step7 引用的 `winningDeclaration(css, [...], 'background', {hover, dataActive})`
+//    与 `readComponentStyle()` 在 `cssCascade.ts` 里都不存在——该文件实际只导出
+//    `extractStyleBlock`/`winningHoverBackground`/`parseCssRules`/`ownBackground`。改用
+//    `PhotosFilterChip.test.ts:107-114` 的既定写法:`?raw` 导入组件源码 → `extractStyleBlock`
+//    → `winningHoverBackground(style, ['seg-btn'])`,断言胜出选择器同时含 `:hover` 与
+//    `data-active`。
+import { describe, it, expect, vi, beforeEach } from 'vitest'
+import { mount, flushPromises } from '@vue/test-utils'
+import { setActivePinia, createPinia } from 'pinia'
+import { nextTick } from 'vue'
+import { fmtGB, fmtBytes, buildBreakdown } from '../../util/storagePalette'
+
+describe('storage 卡纯函数', () => {
+  it('fmtGB:>=100 取整,否则一位小数(Vue2 :382)', () => {
+    expect(fmtGB(100)).toBe('100')
+    expect(fmtGB(99.94)).toBe('99.9')
+    expect(fmtGB(0)).toBe('0.0')
+  })
+
+  it('fmtBytes:逐级进位,>=100 取整(Vue2 :405-413)', () => {
+    expect(fmtBytes(0)).toBe('0 B')
+    expect(fmtBytes(-1)).toBe('0 B')
+    expect(fmtBytes(512)).toBe('512 B') // 512 >= 100 ⇒ 取整
+    expect(fmtBytes(1536)).toBe('1.5 KB')
+    expect(fmtBytes(1024 ** 4 * 2)).toBe('2.0 TB')
+    // 单位表到 TB 为止,更大的值继续用 TB 表示(while 的 i < len-1 上界)
+    expect(fmtBytes(1024 ** 5)).toBe('1024 TB')
+  })
+
+  it('buildBreakdown:段序固定,other 仅在剩余 > 0.05 GB 时追加(Vue2 :327)', () => {
+    const GB = 1024 ** 3
+    const segs = buildBreakdown(
+      { photosBytes: 3 * GB, videosBytes: 2 * GB, rawBytes: GB, cacheBytes: 0, aiBytes: 0 },
+      10, // usedGB
+    )
+    expect(segs.map((s) => s.key)).toEqual(['photos', 'videos', 'raw', 'thumbs', 'ai', 'other'])
+    expect(segs.find((s) => s.key === 'other')!.gb).toBeCloseTo(4, 5)
+  })
+
+  it('buildBreakdown:剩余恰好 0.05 GB 不追加 other(边界是严格大于)', () => {
+    // 偏离登记(brief 自身的测试夹具数字有浮点误差,不是源码/brief 逻辑冲突):
+    // brief 草稿原用 `{photosBytes: 1GB}, usedGB=1.05` 意图让 other = 1.05-1 恰好命中 0.05,
+    // 但 `1.05 - 1` 在 IEEE-754 双精度下是 0.050000000000000044(> 0.05),不是精确的 0.05,
+    // 导致这条"边界不追加"的用例在原数字下必然误判为"追加"——这是计算机浮点减法的固有噪声,
+    // 与 buildBreakdown/Vue2 源的 `other > 0.05` 判据本身无关。改用 known=0(不含任何已知段)
+    // + usedGB=0.05,让 other = Math.max(0, 0.05 - 0) 与实现里的字面量 0.05 是同一个双精度
+    // 比特模式,真正落在边界上,不引入减法噪声。
+    const segs = buildBreakdown(
+      { photosBytes: 0, videosBytes: 0, rawBytes: 0, cacheBytes: 0, aiBytes: 0 },
+      0.05,
+    )
+    expect(segs.map((s) => s.key)).not.toContain('other')
+  })
+
+  it('buildBreakdown:负数字节按 0 处理(Vue2 :317 的 Math.max(0, b))', () => {
+    const segs = buildBreakdown(
+      { photosBytes: -1, videosBytes: 0, rawBytes: 0, cacheBytes: 0, aiBytes: 0 },
+      0,
+    )
+    expect(segs.find((s) => s.key === 'photos')!.gb).toBe(0)
+  })
+})
+
+// ---------------------------------------------------------------------------
+// 组件测试:真实 Pinia store + mock 共享包(不是 mock store 本身)
+// ---------------------------------------------------------------------------
+vi.mock('@nimotech/nimoos-service', () => ({
+  service: {
+    photos: {
+      getConfig: vi.fn(),
+      updateConfig: vi.fn(),
+      getStorage: vi.fn(),
+      getAbout: vi.fn(),
+      pruneCache: vi.fn(),
+      rebuildIndex: vi.fn(),
+      triggerScan: vi.fn(),
+      reclusterFaces: vi.fn(),
+    },
+  },
+}))
+
+import PhotosStorageCard from '../PhotosStorageCard.vue'
+import photosStorageCardRaw from '../PhotosStorageCard.vue?raw'
+import { usePhotosSettingsStore } from '../../stores/settings'
+import { extractStyleBlock, winningHoverBackground } from './cssCascade'
+
+const GB = 1024 ** 3
+
+function mountCard() {
+  const wrapper = mount(PhotosStorageCard)
+  const store = usePhotosSettingsStore()
+  return { wrapper, store }
+}
+
+describe('PhotosStorageCard', () => {
+  beforeEach(() => {
+    setActivePinia(createPinia())
+    vi.clearAllMocks()
+  })
+
+  it('storageError 时大数字位显示破折号 + 不可用副行', async () => {
+    const { wrapper, store } = mountCard()
+    store.storage = null
+    store.storageError = true
+    await nextTick()
+    expect(wrapper.get('[data-test="storage-headline"]').text()).toContain('—')
+    expect(wrapper.text()).toContain('不可用')
+  })
+
+  it('retention 5 档,当前档带 data-active', async () => {
+    const { wrapper, store } = mountCard()
+    store.retentionDays = 30
+    await nextTick()
+    const btns = wrapper.findAll('[data-test="retention-seg"] button')
+    expect(btns).toHaveLength(5)
+    expect(btns.filter((b) => b.attributes('data-active') === 'true')).toHaveLength(1)
+    expect(btns[2]!.attributes('data-active')).toBe('true') // [7,15,30,60,90] 的第三档
+  })
+
+  it('点 retention 档位调 setRetention;失败时 emit toast', async () => {
+    const { wrapper, store } = mountCard()
+    vi.spyOn(store, 'setRetention').mockResolvedValue(false)
+    await wrapper.findAll('[data-test="retention-seg"] button')[4]!.trigger('click')
+    expect(store.setRetention).toHaveBeenCalledWith(90)
+    await flushPromises()
+    expect(wrapper.emitted('toast')).toBeTruthy()
+  })
+
+  it('点 retention 档位成功不 emit toast', async () => {
+    const { wrapper, store } = mountCard()
+    vi.spyOn(store, 'setRetention').mockResolvedValue(true)
+    await wrapper.findAll('[data-test="retention-seg"] button')[0]!.trigger('click')
+    await flushPromises()
+    expect(wrapper.emitted('toast')).toBeFalsy()
+  })
+
+  it('scanInterval 5 档,off 档的值走 i18n(其余四档是单位缩写字面量,不过 $t)', async () => {
+    const { wrapper } = mountCard()
+    const btns = wrapper.findAll('[data-test="scan-seg"] button')
+    expect(btns).toHaveLength(5)
+    expect(btns.map((b) => b.text())).toEqual([
+      expect.not.stringMatching(/^\d/), '6h', '12h', '24h', '7d',
+    ])
+  })
+
+  it('点 scanInterval 档位调 setScanInterval;失败时 emit toast', async () => {
+    const { wrapper, store } = mountCard()
+    vi.spyOn(store, 'setScanInterval').mockResolvedValue(false)
+    await wrapper.findAll('[data-test="scan-seg"] button')[1]!.trigger('click')
+    expect(store.setScanInterval).toHaveBeenCalledWith(360)
+    await flushPromises()
+    expect(wrapper.emitted('toast')).toBeTruthy()
+  })
+
+  it('缓存按钮:prunableBytes 为 0 时禁用', async () => {
+    const { wrapper, store } = mountCard()
+    store.storage = {
+      diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 0,
+      photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
+    }
+    await nextTick()
+    expect(wrapper.get('[data-test="clear-cache"]').attributes('disabled')).toBeDefined()
+  })
+
+  it('缓存按钮:prunableBytes > 0 时可点', async () => {
+    const { wrapper, store } = mountCard()
+    store.storage = {
+      diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 512 * 1024 * 1024,
+      photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
+    }
+    await nextTick()
+    expect(wrapper.get('[data-test="clear-cache"]').attributes('disabled')).toBeUndefined()
+  })
+
+  it('清缓存成功后重拉 storage(Vue2 :423)且 emit 成功 toast', async () => {
+    const { wrapper, store } = mountCard()
+    store.storage = {
+      diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 512 * 1024 * 1024,
+      photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
+    }
+    await nextTick()
+    vi.spyOn(store, 'pruneCache').mockResolvedValue(1024 * 1024)
+    const fetchSpy = vi.spyOn(store, 'fetchStorage').mockResolvedValue(undefined)
+    await wrapper.get('[data-test="clear-cache"]').trigger('click')
+    await flushPromises()
+    expect(fetchSpy).toHaveBeenCalled()
+    expect(wrapper.emitted('toast')).toBeTruthy()
+  })
+
+  it('清缓存失败:emit 失败 toast,不重拉 storage', async () => {
+    const { wrapper, store } = mountCard()
+    store.storage = {
+      diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 512 * 1024 * 1024,
+      photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
+    }
+    await nextTick()
+    vi.spyOn(store, 'pruneCache').mockRejectedValue(new Error('boom'))
+    const fetchSpy = vi.spyOn(store, 'fetchStorage').mockResolvedValue(undefined)
+    await wrapper.get('[data-test="clear-cache"]').trigger('click')
+    await flushPromises()
+    expect(fetchSpy).not.toHaveBeenCalled()
+    expect(wrapper.emitted('toast')).toBeTruthy()
+  })
+
+  it('容量条段数 = breakdown 段数 + 1 个 free 段(评审 Important-take-along:精确断言,不是 >=5)', async () => {
+    const { wrapper, store } = mountCard()
+    const fixture = {
+      diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 512 * 1024 * 1024,
+      photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
+    }
+    store.storage = fixture
+    await nextTick()
+    // 期望段数从 buildBreakdown 本身派生(usedGB = capGB - freeGB = 60,已知段合计 58GB,
+    // other = 2GB > 0.05 会追加)——不写死数字,这样若换了 fixture 数值,期望值跟着走,
+    // 断言仍然是"组件真的把 buildBreakdown 的每一段都渲染出来了",而不是一个凑巧成立的下限。
+    const usedGB = fixture.diskTotalBytes / 1024 ** 3 - fixture.diskFreeBytes / 1024 ** 3
+    const expectedSegs = buildBreakdown(fixture, usedGB)
+    expect(expectedSegs.map((s) => s.key)).toEqual(['photos', 'videos', 'raw', 'thumbs', 'ai', 'other'])
+    expect(wrapper.findAll('[data-test="bar-seg"]')).toHaveLength(expectedSegs.length)
+    expect(wrapper.findAll('[data-test="bar-free"]')).toHaveLength(1)
+  })
+
+  it('mount 时自取一次 storage(fetchStorage 被调,矫正 T3 Consumes 接口列表里点名的动作)', () => {
+    const fetchSpy = vi.spyOn(usePhotosSettingsStore(), 'fetchStorage')
+    mount(PhotosStorageCard)
+    expect(fetchSpy).toHaveBeenCalled()
+  })
+
+  // 评审 Important-1:Rescan Now(rescanNow/triggerScan/scanBusy 守卫/成功 check toast/
+  // 失败兜底 toast)此前零覆盖——task-3-report.md 曾误报"已纳入组件与测试",实际未写。
+  // 补三条:成功、失败、忙时守卫(第一版报告的完整性声明有误,已在报告里如实登记,不是
+  // 悄悄改成"现在测了"就完事)。
+  it('Rescan Now 成功:调 triggerScan,emit check toast,scanBusy 复位', async () => {
+    const { wrapper, store } = mountCard()
+    vi.spyOn(store, 'triggerScan').mockResolvedValue(true)
+    const btn = wrapper.get('[data-test="rescan-now"]')
+    await btn.trigger('click')
+    await flushPromises()
+    expect(store.triggerScan).toHaveBeenCalledTimes(1)
+    const toasts = wrapper.emitted('toast')
+    expect(toasts).toBeTruthy()
+    expect(toasts![0]![0]).toMatchObject({ icon: 'check' })
+    expect(wrapper.get('[data-test="rescan-now"]').attributes('disabled')).toBeUndefined()
+  })
+
+  it('Rescan Now 失败:emit 兜底 toast(trash 图标,复用 photosSettingsRebuildStartFailed),scanBusy 复位', async () => {
+    const { wrapper, store } = mountCard()
+    vi.spyOn(store, 'triggerScan').mockRejectedValue(new Error('boom'))
+    const btn = wrapper.get('[data-test="rescan-now"]')
+    await btn.trigger('click')
+    await flushPromises()
+    const toasts = wrapper.emitted('toast')
+    expect(toasts).toBeTruthy()
+    expect(toasts![0]![0]).toMatchObject({ icon: 'trash' })
+    expect(wrapper.get('[data-test="rescan-now"]').attributes('disabled')).toBeUndefined()
+  })
+
+  it('Rescan Now 忙时守卫:在途请求未完成前再点一次不会触发第二次 triggerScan', async () => {
+    const { wrapper, store } = mountCard()
+    let release: (() => void) | undefined
+    vi.spyOn(store, 'triggerScan').mockImplementation(
+      () => new Promise<boolean>((res) => { release = () => res(true) }),
+    )
+    const btn = wrapper.get('[data-test="rescan-now"]')
+    await btn.trigger('click') // 不 await 完成,趁在途再点一次
+    expect(wrapper.get('[data-test="rescan-now"]').attributes('disabled')).toBeDefined()
+    await wrapper.get('[data-test="rescan-now"]').trigger('click')
+    expect(store.triggerScan).toHaveBeenCalledTimes(1)
+    release?.()
+    await flushPromises()
+  })
+})
+
+describe('样式:分段器 [data-active] 变体自带 hover 背景(本区已栽四次)', () => {
+  it('seg-btn 的 hover 胜出规则同时含 :hover 与 data-active', () => {
+    const style = extractStyleBlock(photosStorageCardRaw)
+    expect(style.length).toBeGreaterThan(0)
+    const winner = winningHoverBackground(style, ['seg-btn'])
+    expect(winner.selector).toContain(':hover')
+    expect(winner.selector).toContain('data-active')
+  })
+})
diff --git a/src/photos/composables/__tests__/usePhotosDeepLinks.test.ts b/src/photos/composables/__tests__/usePhotosDeepLinks.test.ts
new file mode 100644
index 0000000..8521583
--- /dev/null
+++ b/src/photos/composables/__tests__/usePhotosDeepLinks.test.ts
@@ -0,0 +1,356 @@
+// SP7-P8a-T7/T8: usePhotosDeepLinks —— ?asset / ?photoset / ?q / ?album / ?person 深链。
+// 回源:Vue2 NimoOS-UI src/views/Photos/PhotosTimeline.vue:364-377/:431-440/:441-465/
+// :491-523;?album 是 PhotosAlbumsView.vue:264 自己 mounted 里读(New-UI 统一收进本组合式)。
+//
+// 挂载套路照 Photos.lightbox.test.ts / PhotosPlaceAssets.test.ts 的既有先例:真实
+// useLightbox() 单例、真实 Pinia toast/people store(vi.spyOn)、真实 vue-router(query 走
+// router.push,不 mock useRoute)。service.photos.getAsset/listPersons 走
+// vi.mock('@nimotech/nimoos-service')。
+//
+// 断言全部落在 useLightbox() 的真实共享状态(open/list/index/current 等 module 级 ref)
+// 上,不 spy openAt 本身——`usePhotosDeepLinks()` 内部另调一次 `useLightbox()` 会拿到一个
+// 新的返回对象字面量,vi.spyOn(外层拿到的那个对象, 'openAt') 只替换外层对象自己的属性,
+// 不会拦到内部那份引用同一批 module 级函数的调用(踩过一次才发现:第一版这么写,openAt
+// 断言全部落空——已改成断言真实状态,顺带更贴合评审要求的"测真实行为,不只测 mock 被调")。
+// T8 沿用同一条纪律:?album/?person 的断言落在 router.currentRoute 的真实解析结果上
+// (fullPath/name/params/query),不落在 mock 调用参数的字符串形态上——brief 骨架给的
+// `router.replace.mock.calls[0][0].path` 断言只适配"手拼字符串路径"的实现;本文件选了
+// vue-router 具名路由 + params 的编码机制(见 usePhotosDeepLinks.ts 内注释),该实现下
+// replace 的调用参数没有 `.path` 字段,骨架那条断言打不中,改用真实解析后的路由状态断言。
+//
+// 与 task-7-brief.md 步骤 1 骨架的刻意偏离(已在 task-7-report.md 登记):
+//  1) 翻页集断言用真实 list.value / expect.objectContaining({id}),不是字面 `{ id: 'a' }`——
+//     实现按坐标笔记要求用 assetToPhoto({id}) 补全 Photo 的 25+ 必填字段(不能 `as unknown
+//     as Photo` 强转),产物不是裸 `{id}` 对象,brief 骨架那处字面匹配打不中。
+//  2) 不对 lb.openAt 用 vi.fn()/spy 断言调用参数(理由见上),改断言 open/list/index/
+//     current/hasPrev/hasNext 等真实状态。
+import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
+import { defineComponent } from 'vue'
+import { mount, flushPromises } from '@vue/test-utils'
+import { setActivePinia, createPinia } from 'pinia'
+import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
+import { usePhotosDeepLinks } from '../usePhotosDeepLinks'
+import { useLightbox } from '../../lightbox/useLightbox'
+import { useToast } from '../../../stores/toast'
+
+// lb.openAt 是真实单例,内部会连带调用 usePhotosFavorites() 的 recordView/reconcileFavIds
+// 与 hydrateDetail 的 getAsset 二次取详情——这几个不是本文件要测的行为,但缺 mock 会在
+// openAt 路径上抛未捕获异常污染测试运行(同 Photos.lightbox.test.ts / PhotosPlaceAssets.test.ts
+// 的既有先例)。T8 追加 listPersons——?person 的存在性校验会真的调用 usePhotosPeople().fetchPeople()。
+const svc = vi.hoisted(() => ({
+  photos: {
+    getAsset: vi.fn(),
+    getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
+    recordView: vi.fn().mockResolvedValue(undefined),
+    listFavoriteIds: vi.fn().mockResolvedValue([]),
+    listPersons: vi.fn().mockResolvedValue({ persons: [] }),
+  },
+}))
+vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))
+
+const lb = useLightbox()
+
+const Host = defineComponent({
+  setup() {
+    usePhotosDeepLinks()
+    return () => null
+  },
+})
+
+// T8 目标路由的占位组件——不复用 Host,避免 <router-view> 之外还额外挂一份
+// usePhotosDeepLinks()(本文件从不挂 <router-view>,Host 是直接 mount 的,但占位组件仍
+// 用最简单的空渲染,减少无关面。real 导航只改 router.currentRoute,不会重新渲染 Host)。
+const Blank = defineComponent({ render: () => null })
+
+function makeRouter(): ReturnType<typeof createRouter> {
+  const routes: RouteRecordRaw[] = [
+    { path: '/photos', name: 'photos', component: Host },
+    { path: '/photos/search', name: 'photos-search', component: Blank },
+    { path: '/photos/albums/:id', name: 'photos-album-detail', component: Blank },
+    { path: '/photos/people/:id', name: 'photos-person-detail', component: Blank },
+  ]
+  return createRouter({ history: createWebHashHistory('/app/'), routes })
+}
+
+// assets: id -> 明细响应(裸 asset 形状,取到即 resolve);不在表里的 id 一律 reject,
+// 模拟真实后端 404。opts.getAssetImpl 可整体替换取图实现(T8 的执行顺序用例需要一个可
+// 手动 resolve 的 pending promise,套不进"按 id 查表"的默认实现)。
+// 返回值追加 router(T7 的既有调用点不解构返回值,不受影响)——T8 的用例要断言真实
+// router.replace 调用 / router.currentRoute 解析结果。
+async function mountWithQuery(
+  query: Record<string, string>,
+  assets: Record<string, { id: string }> = {},
+  opts?: { getAssetImpl?: (id: string) => Promise<unknown> },
+) {
+  if (opts?.getAssetImpl) {
+    svc.photos.getAsset.mockImplementation(opts.getAssetImpl)
+  } else {
+    svc.photos.getAsset.mockImplementation(async (id: string) => {
+      if (id in assets) return assets[id]
+      throw new Error(`not found: ${id}`)
+    })
+  }
+  const router = makeRouter()
+  await router.push({ path: '/photos', query })
+  await router.isReady()
+  // 先完成初始导航,再挂 spy——不然"进入 /photos"这次 push 本身也会被记进 spy,
+  // 污染"组合式内部有没有调用 push/replace"的断言。
+  vi.spyOn(router, 'replace')
+  vi.spyOn(router, 'push')
+  const wrapper = mount(Host, { global: { plugins: [router] } })
+  return { wrapper, router }
+}
+
+beforeEach(() => {
+  setActivePinia(createPinia())
+  svc.photos.getAsset.mockReset()
+  svc.photos.recordView.mockClear()
+  svc.photos.listFavoriteIds.mockClear()
+  svc.photos.listPersons.mockReset()
+  svc.photos.listPersons.mockResolvedValue({ persons: [] })
+  localStorage.clear()
+  lb.__resetForTest()
+  vi.spyOn(console, 'error').mockImplementation(() => {})
+})
+
+afterEach(() => {
+  lb.__resetForTest()
+  vi.restoreAllMocks()
+})
+
+describe('usePhotosDeepLinks · ?asset', () => {
+  it('取到明细:以单张成集打开灯箱(prev/next 成 no-op)', async () => {
+    await mountWithQuery({ asset: 'a1' }, { a1: { id: 'a1' } })
+    await flushPromises()
+    expect(lb.open.value).toBe(true)
+    expect(lb.list.value).toHaveLength(1)
+    expect(lb.list.value[0].id).toBe('a1')
+    expect(lb.current.value?.id).toBe('a1')
+    // 单张成集意味着 prev/next 都是 no-op。
+    expect(lb.hasPrev.value).toBe(false)
+    expect(lb.hasNext.value).toBe(false)
+  })
+
+  it('取不到明细:弹 not-found toast,不开灯箱', async () => {
+    const toast = useToast()
+    const showSpy = vi.spyOn(toast, 'show')
+    await mountWithQuery({ asset: 'ghost' }, {})
+    await flushPromises()
+    expect(lb.open.value).toBe(false)
+    expect(showSpy).toHaveBeenCalledWith('未找到该图片', 3000)
+  })
+})
+
+describe('usePhotosDeepLinks · ?photoset', () => {
+  it('读到 ids 后立刻 removeItem(一次性交接,取明细之前就已消费)', async () => {
+    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['a', 'b', 'c'] }))
+    await mountWithQuery({ photoset: 'tok', active: 'b' }, { b: { id: 'b' } })
+    // 不 flushPromises——removeItem 发生在 consumePhotosetHandoff 内的同步代码段,
+    // 在 fetchPhoto 的 await 之前,mount() 一返回就该已经执行过。
+    expect(localStorage.getItem('nimo:photoset:tok')).toBeNull()
+  })
+
+  it('翻页集是全部 ids 的轻量对象,active 打头显示', async () => {
+    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['a', 'b', 'c'] }))
+    await mountWithQuery({ photoset: 'tok', active: 'b' }, { b: { id: 'b' } })
+    await flushPromises()
+    expect(lb.open.value).toBe(true)
+    expect(lb.list.value.map((p) => p.id)).toEqual(['a', 'b', 'c'])
+    expect(lb.index.value).toBe(1) // active='b' 打头显示 = list 里下标 1
+    expect(lb.current.value?.id).toBe('b')
+  })
+
+  it('active 不在 ids 里时取 ids[0](Vue2 :456)', async () => {
+    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['x', 'y'] }))
+    await mountWithQuery({ photoset: 'tok', active: 'not-in-list' }, { x: { id: 'x' } })
+    await flushPromises()
+    expect(lb.open.value).toBe(true)
+    expect(lb.current.value?.id).toBe('x')
+    expect(lb.index.value).toBe(0)
+    expect(svc.photos.getAsset).toHaveBeenCalledWith('x')
+  })
+
+  it('handoff 缺失:降级成 ?asset 行为(用 active,单张成集)', async () => {
+    await mountWithQuery({ photoset: 'gone', active: 'b' }, { b: { id: 'b' } })
+    await flushPromises()
+    expect(lb.open.value).toBe(true)
+    expect(lb.list.value).toHaveLength(1)
+    expect(lb.list.value[0].id).toBe('b')
+    expect(lb.hasPrev.value).toBe(false)
+    expect(lb.hasNext.value).toBe(false)
+  })
+
+  it('handoff 缺失且无 active:什么都不做,不弹 toast', async () => {
+    const toast = useToast()
+    const showSpy = vi.spyOn(toast, 'show')
+    await mountWithQuery({ photoset: 'gone' }, {})
+    await flushPromises()
+    expect(lb.open.value).toBe(false)
+    expect(showSpy).not.toHaveBeenCalled()
+    expect(svc.photos.getAsset).not.toHaveBeenCalled()
+  })
+
+  it('localStorage 抛异常时吞掉,不带崩页面,并按"handoff 缺失"降级', async () => {
+    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
+      throw new Error('denied')
+    })
+    // 若吞不掉(如变异验证④删掉 try/catch),openPhotoSetFromQuery 会在
+    // consumePhotosetHandoff 处直接 reject——mount() 本身不会同步抛(async 函数体内的
+    // 抛出会被包成 rejected promise,不会同步冒到这里),但降级路径也就走不到,下面的
+    // 灯箱状态断言会落空、变红。
+    await mountWithQuery({ photoset: 'tok', active: 'b' }, { b: { id: 'b' } })
+    getItemSpy.mockRestore()
+    await flushPromises()
+    // 异常被吞掉后 ids=[] → 走"handoff 缺失"降级路径,用 active 打开单张。
+    expect(lb.open.value).toBe(true)
+    expect(lb.list.value).toHaveLength(1)
+    expect(lb.list.value[0].id).toBe('b')
+  })
+
+  it('photoset 与 asset 同时存在时只走 photoset(Vue2 :370-374 的 if/else if)', async () => {
+    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['x'] }))
+    await mountWithQuery({ photoset: 'tok', asset: 'a1' }, { x: { id: 'x' }, a1: { id: 'a1' } })
+    await flushPromises()
+    expect(lb.open.value).toBe(true)
+    expect(lb.list.value.map((p) => p.id)).toEqual(['x'])
+    expect(lb.current.value?.id).toBe('x')
+    expect(svc.photos.getAsset).not.toHaveBeenCalledWith('a1')
+  })
+
+  it('ids 里的假值被过滤(Vue2 :446 的 .filter(Boolean))', async () => {
+    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['a', '', null, 'b'] }))
+    await mountWithQuery({ photoset: 'tok', active: 'b' }, { b: { id: 'b' } })
+    await flushPromises()
+    expect(lb.list.value.map((p) => p.id)).toEqual(['a', 'b'])
+  })
+})
+
+// SP7-P8a-T8:?q / ?album / ?person。回源 Vue2 PhotosTimeline.vue:491-494(?q)、
+// PhotosAlbumsView.vue:264(?album,该视图自己 mounted 里读)、PhotosTimeline.vue:509-523
+// (?person,_applyPersonFromQuery)。
+//
+// 三式都是"改路由"(与 ?asset/?photoset 的"开灯箱、不改路由"相对),统一走
+// router.replace——这是入口归一,不该在浏览器历史里留下 `/photos?q=`/`?album=`/`?person=`
+// 这条兼容态记录(用户按后退键应该跳出 /photos,不是回到还没归一之前的同一页)。
+describe('usePhotosDeepLinks · ?q', () => {
+  it('重定向到 /photos/search?q=,用 replace 不用 push', async () => {
+    const { router } = await mountWithQuery({ q: '猫' }, {})
+    await flushPromises()
+    expect(router.replace).toHaveBeenCalledWith(
+      expect.objectContaining({ path: '/photos/search', query: { q: '猫' } }),
+    )
+    expect(router.push).not.toHaveBeenCalled()
+  })
+
+  it('原样保留搜索词——含首尾空格与非 ASCII,不 trim 不转码', async () => {
+    const term = '  猫 咪  '
+    const { router } = await mountWithQuery({ q: term }, {})
+    await flushPromises()
+    expect(router.replace).toHaveBeenCalledWith(
+      expect.objectContaining({ path: '/photos/search', query: { q: term } }),
+    )
+  })
+})
+
+describe('usePhotosDeepLinks · ?album', () => {
+  it('跳转到相册详情路由', async () => {
+    const { router } = await mountWithQuery({ album: 'al1' }, {})
+    await flushPromises()
+    expect(router.currentRoute.value.name).toBe('photos-album-detail')
+    expect(router.currentRoute.value.params.id).toBe('al1')
+    expect(router.push).not.toHaveBeenCalled()
+  })
+
+  // Vue2 PhotosAlbumsView.vue:264 的 _applyRouteAlbum 对 id 未做任何 URL 编码就直接赋值
+  // 给组件本地状态(它从没走过"拼路径"这一步,同页面切面板不需要编码)。New-UI 把它变成
+  // 真实路径跳转后,不编码会让含 `/` 的 id 把路径截断成两段、匹配到完全不同的路由甚至
+  // 匹配失败——这是移植纪律要求"不照抄 Vue2 缺陷"的一条:改成正确编码,并在实现文件里
+  // 登记这条偏离。用具名路由 + params 让 vue-router 自己编码(encodeParam 对 `/` 也编,
+  // 效果等价于 encodeURIComponent),而不是手拼字符串再调 encodeURIComponent。
+  it('id 含 / 时做 URL 编码,不截断路径(Vue2 未编码是缺陷,已修)', async () => {
+    const { router } = await mountWithQuery({ album: 'a/b' }, {})
+    await flushPromises()
+    expect(router.currentRoute.value.name).toBe('photos-album-detail')
+    // 具名路由跳转后 vue-router 会把编码后的路径段自动解码回原值,params.id 应该是
+    // 原始未编码字符串——证明"跳对了地方",不是"跳到了一个恰好长得像的坏地址"。
+    expect(router.currentRoute.value.params.id).toBe('a/b')
+    // fullPath 是真实序列化出来的 URL,必须能看到编码后的斜杠(%2F),否则说明路径
+    // 是手拼未编码字符串、后端/路由匹配层面其实截断了。
+    expect(router.currentRoute.value.fullPath).toContain(encodeURIComponent('a/b'))
+  })
+})
+
+describe('usePhotosDeepLinks · ?person', () => {
+  it('存在:校验通过后跳详情路由', async () => {
+    svc.photos.listPersons.mockResolvedValueOnce({ persons: [{ id: 'p1' }] })
+    const { router } = await mountWithQuery({ person: 'p1' }, {})
+    await flushPromises()
+    expect(router.currentRoute.value.name).toBe('photos-person-detail')
+    expect(router.currentRoute.value.params.id).toBe('p1')
+    expect(router.push).not.toHaveBeenCalled()
+  })
+
+  it('不存在:静默摘掉 person 键、留在原地,不跳详情、不弹 toast(其余 query 键保留)', async () => {
+    const toast = useToast()
+    const showSpy = vi.spyOn(toast, 'show')
+    svc.photos.listPersons.mockResolvedValueOnce({ persons: [{ id: 'someone-else' }] })
+    const { router } = await mountWithQuery({ person: 'ghost', view: 'people' }, {})
+    await flushPromises()
+    expect(router.currentRoute.value.path).toBe('/photos')
+    expect(router.currentRoute.value.query).toEqual({ view: 'people' })
+    expect(showSpy).not.toHaveBeenCalled()
+  })
+
+  // 后端 id 有时是数字(同类先例:Place.Key 是 int32)。query 里的 person 值恒为字符串
+  // (URL 本身就是文本),用 `===` 直接比较字符串和数字永远不相等,会让存在的人物被误判
+  // 成"不存在"而被静默摘键——这是全区铁律,id 比较必须先 String() 归一。
+  it('id 比较走 String 归一——后端返数字 id 也认', async () => {
+    svc.photos.listPersons.mockResolvedValueOnce({ persons: [{ id: 42 }] })
+    const { router } = await mountWithQuery({ person: '42' }, {})
+    await flushPromises()
+    expect(router.currentRoute.value.name).toBe('photos-person-detail')
+    expect(router.currentRoute.value.params.id).toBe('42')
+  })
+
+  // usePhotosPeople().fetchPeople() 自身已经把网络失败吞掉(内部 console.error,不
+  // reject)——Vue2 :521-523 的 catch 对应到这里,失败路径与"id 不存在"在这个 store
+  // 实现下走的是同一条分支(people 列表保持为空 → 校验必不命中)。仍然显式测——万一
+  // store 实现变了(fetchPeople 开始 reject),这条要能第一时间失守报警。
+  it('fetchPeople 失败(网络错误):静默摘键,不跳详情、不抛异常', async () => {
+    svc.photos.listPersons.mockRejectedValueOnce(new Error('network'))
+    const { router } = await mountWithQuery({ person: 'x' }, {})
+    await flushPromises()
+    expect(router.currentRoute.value.path).toBe('/photos')
+    expect(router.currentRoute.value.query.person).toBeUndefined()
+  })
+})
+
+describe('usePhotosDeepLinks · 执行顺序(灯箱先开、路由后跳)', () => {
+  // Vue2 :371-377:photoset/asset(开灯箱)在 _applyUrlDeepLinks(改路由)之前执行。
+  // 灯箱路径是异步的(要等 fetchAssetDetail),路由改写路径(?q)本身是同步的——如果不
+  // 显式等灯箱那段结束再跑路由改写,同步的 router.replace 反而会抢在异步取图完成之前
+  // 执行,顺序在实际时序上就颠倒了。用一个手动可控的 pending promise 卡住取图,证明
+  // "取图没完成之前,路由绝不会跳"。
+  it('photoset 与 q 同时存在:先开灯箱、后跳路由', async () => {
+    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['x'] }))
+    let resolveAsset!: (v: unknown) => void
+    const pending = new Promise((resolve) => { resolveAsset = resolve })
+    const { router } = await mountWithQuery(
+      { photoset: 'tok', q: '猫' },
+      {},
+      { getAssetImpl: () => pending as Promise<unknown> },
+    )
+    await flushPromises()
+    // 取图还没 resolve:灯箱没开、路由也不该跳。若顺序颠倒(路由改写先跑),这里
+    // router.replace 已经被同步调用过了,下面这条会先变红。
+    expect(lb.open.value).toBe(false)
+    expect(router.replace).not.toHaveBeenCalled()
+
+    resolveAsset({ id: 'x' })
+    await flushPromises()
+    expect(lb.open.value).toBe(true)
+    expect(router.replace).toHaveBeenCalledWith(
+      expect.objectContaining({ path: '/photos/search', query: { q: '猫' } }),
+    )
+  })
+})
diff --git a/src/photos/composables/usePersonDetail.ts b/src/photos/composables/usePersonDetail.ts
index cc00045..736e1cd 100644
--- a/src/photos/composables/usePersonDetail.ts
+++ b/src/photos/composables/usePersonDetail.ts
@@ -1,19 +1,21 @@
 // 详情页数据编排。Ported from Vue2 NimoOS-UI src/views/Photos/PhotosPersonDetail.vue:596(watch)、:728-759(loadPerson/groupByMonth)。
 // 偏离登记 6:Vue2 没有任何竞态守卫,快速连点共现横条/关系图跳转别人时,慢的旧响应会覆盖新页面数据。
 // 这里用 useLightbox.hydrateDetail(useLightbox.ts:100-124)的同款 seq:每次 load 自增,回写前比对,过期直接丢弃。
 import { ref, shallowRef } from 'vue'
 import { service } from '@nimotech/nimoos-service'
 import { assetToPhoto, type Photo, type Month } from '../util/assetToPhoto'
 import { toPerson, monthKeyLabel, type Person } from '../util/peopleView'
 
 // Vue2 :741 硬编码 limit:300 / offset:0,无分页。照搬(改分页是新功能,记账留后续)。
+// P8a-T10 挂账登记(只登记不改):这个 300 上限目前仍是唯一实现,没有"加载更多"/滚动分页——
+// 人物资产超过 300 张时,详情页只会显示前 300 张(与 Vue2 行为一致,不是本次回归)。
 const ASSET_LIMIT = 300
 
 export interface PersonRelation { personId: string | number; name?: string; coverFaceId?: string | number | null; count: number }
 export interface PersonPlace { placeName?: string | null; latitude?: number | null; longitude?: number | null }
 
 // 照 Vue2 groupByMonth :749-759:按 takenAt 的**前 7 位字符串**分桶(不解析 Date),
 // 键降序,'unknown' 桶靠稳定排序挪到末位。
 // 注意:**不复用 util/groupPhotosByMonth.ts** —— 那个用 new Date() 解析后取本地时区的年月,
 // 与字符串切片在跨时区/脏数据上结果不同;人物页保真走 Vue2 的字符串切片。
 export function groupPersonAssets(photos: Photo[]): Month[] {
diff --git a/src/photos/composables/usePhotosDeepLinks.ts b/src/photos/composables/usePhotosDeepLinks.ts
new file mode 100644
index 0000000..28b896d
--- /dev/null
+++ b/src/photos/composables/usePhotosDeepLinks.ts
@@ -0,0 +1,195 @@
+// SP7-P8a-T7/T8: 深链 ?asset / ?photoset / ?q / ?album / ?person ——
+// 回源:Vue2 NimoOS-UI src/views/Photos/PhotosTimeline.vue:364-377(mounted 里的分发)、
+// :431-440(_openAssetFromQuery)、:441-465(_openPhotoSetFromQuery)、:491-494(?q,
+// _applyUrlDeepLinks 内)、:509-523(?person,_applyPersonFromQuery)。
+// ?album 的 Vue2 出处不在这个文件——它是 PhotosAlbumsView.vue:264 自己 mounted() 里读的
+// (同页面切面板架构下,只有相册列表视图关心这个键)。New-UI 统一收进本组合式:三个键
+// 都是"/photos?xxx= 兼容入口 → 归一到真实路由"的入口归一,而不是"同页面内切换本地状态"。
+//
+// 挂载约定:usePhotosDeepLinks() 在 /photos 的 setup 里调一次,内部自行 onMounted——
+// 不装路由 watcher。这是一次性交接(?photoset 的 handoff 读完即 removeItem),不是
+// "同路由改查询参数"的场景;装 watcher 会让已被消费掉的 handoff 在后续 query 变化时
+// 被误判成"缺失"而重复触发降级路径。保持"一个键一个小函数"的结构。
+//
+// 执行顺序(Vue2 :371-377 的先后手):photoset/asset(开灯箱,不改路由)必须先跑完,
+// q/album/person(改路由)才跑。灯箱那段是异步的(要等 fetchAssetDetail),路由改写
+// 本身是同步的——如果不显式 await 灯箱那段结束,同步的 router.replace 反而会抢在异步
+// 取图完成之前执行,顺序就会在真实时序上颠倒。onMounted 因此包一层 IIFE 顺序 await。
+import { onMounted } from 'vue'
+import { useRoute, useRouter } from 'vue-router'
+import type { LocationQueryValue } from 'vue-router'
+import { useI18n } from 'vue-i18n'
+import { service } from '@nimotech/nimoos-service'
+import { useLightbox } from '../lightbox/useLightbox'
+import { usePhotosPeople } from '../stores/people'
+import { useToast } from '../../stores/toast'
+import { assetToPhoto, type Photo } from '../util/assetToPhoto'
+
+const PHOTOSET_KEY_PREFIX = 'nimo:photoset:'
+// 取不到明细时的 toast 停留时长,照 Vue2 :438 / :463 的 duration: 3000。
+const NOT_FOUND_TOAST_MS = 3000
+
+function firstQueryValue(v: LocationQueryValue | LocationQueryValue[]): string {
+  return (Array.isArray(v) ? v[0] : v) || ''
+}
+
+export function usePhotosDeepLinks(): void {
+  const route = useRoute()
+  const router = useRouter()
+  const { t } = useI18n()
+  const lb = useLightbox()
+  const toast = useToast()
+
+  // 按 id 取明细。失败(网络错误 / 404 / 响应假值)统一归为"取不到",不区分原因——
+  // 照 Vue2 fetchAssetDetail(NimoOS-UI src/store/modules/photos.js:611-619)的口径:
+  // 它自己 catch 后 console.error + 返回 null,调用方按 falsy 处理。
+  async function fetchPhoto(id: string): Promise<Photo | null> {
+    try {
+      const asset = await service.photos.getAsset(id)
+      return asset ? assetToPhoto(asset as unknown as Record<string, unknown>) : null
+    } catch (e) {
+      console.error('[photos-deeplinks] fetchPhoto', e)
+      return null
+    }
+  }
+
+  function notFoundToast(): void {
+    toast.show(t('photosDeepLinkPhotoNotFound'), NOT_FOUND_TOAST_MS)
+  }
+
+  // Vue2 :431-440 _openAssetFromQuery——单张成集,prev/next 成 no-op(与时间线是否
+  // 包含该图无关)。
+  async function openAssetFromQuery(id: string): Promise<void> {
+    const photo = await fetchPhoto(id)
+    if (photo) lb.openAt(photo, [photo])
+    else notFoundToast()
+  }
+
+  // 读一次性交接载荷:{ ids: string[] },key = 'nimo:photoset:' + token。
+  // 过期清理不在这里——2 分钟 TTL 归生产者侧(src/views/AI/Agent/services/openInApp.js:
+  // 76-85,从 key 名里解析时间戳写入),消费侧只做"读到就 removeItem",不做过期判断;
+  // 读不到(键不存在,包括已经被消费过、或已被生产者侧清理过)一律当作"没有交接"处理。
+  function consumePhotosetHandoff(token: string): string[] {
+    const key = PHOTOSET_KEY_PREFIX + token
+    try {
+      const raw = localStorage.getItem(key)
+      if (!raw) return []
+      const parsed = JSON.parse(raw) as { ids?: unknown[] }
+      // 照 Vue2 :447 的位置——parse 成功即 removeItem,即使后面取明细失败也已经消费掉
+      // (一次性交接语义,不因下游失败而"补发")。
+      localStorage.removeItem(key)
+      return (parsed.ids || []).filter(Boolean) as string[]
+    } catch {
+      // localStorage 读 / JSON.parse 异常必须吞掉——隐私模式 / 配额异常不能带崩整页
+      // (Vue2 :449 的 catch {}）。
+      return []
+    }
+  }
+
+  // Vue2 :441-465 _openPhotoSetFromQuery。
+  async function openPhotoSetFromQuery(token: string, activeId: string): Promise<void> {
+    const ids = consumePhotosetHandoff(token)
+    if (!ids.length) {
+      // handoff 缺失(键不存在 / 已被消费)→ 降级成 ?asset 行为;
+      // 连 activeId 也没有则什么都不做,静默(不弹 toast)。
+      if (activeId) await openAssetFromQuery(activeId)
+      return
+    }
+    const active = activeId && ids.includes(activeId) ? activeId : ids[0]
+    const photo = await fetchPhoto(active)
+    if (photo) {
+      // 翻页集只带 id 的轻量对象——Photo 是 25+ 必填字段的宽接口,用 assetToPhoto({id})
+      // 补齐默认值而非 `as unknown as Photo` 强转;灯箱自己会在导航时按需取每张的明细
+      // (useLightbox.ts:100-124 的 hydrateDetail)。
+      lb.openAt(photo, ids.map((id) => assetToPhoto({ id })))
+    } else {
+      notFoundToast()
+    }
+  }
+
+  // Vue2 :491-494(_applyUrlDeepLinks 内):`?q=<词>` 在 Vue2 里是"开搜索面板 + 就地
+  // 检索",New-UI 有独立的搜索路由(P7a 已建),所以归一成整页重定向:替换掉 `/photos`
+  // 这条兼容 URL,不留在浏览器历史里(用户按后退键该跳出 /photos,不是回到归一前的同页)。
+  // 搜索词原样传递——不 trim、不做任何转码(query 对象层面就是原始字符串,序列化成 URL
+  // 是 vue-router 自己的事,不需要也不应该在这里手工编码)。
+  function redirectSearchFromQuery(term: string): void {
+    router.replace({ path: '/photos/search', query: { q: term } })
+  }
+
+  // ?album=<id>:Vue2 是 PhotosAlbumsView.vue:264 让相册**列表**页自己校验 + 打开,不做
+  // 存在性检查(找不到才会静默清键,但这里 Vue2 从不校验存在——它就是直接赋值)。New-UI
+  // 有真实的相册详情路由,直接跳转,同样不加 Vue2 没有的校验(移植纪律:不做无关"改进"、
+  // 不擅自加校验)。
+  //
+  // 偏离登记(按铁律修正,不照抄):Vue2 那边是"同页面内切换本地状态",从没走过"把 id
+  // 拼进 URL 路径"这一步,所以从没编码过。New-UI 把它变成真实路径跳转后,不编码会让
+  // 含 `/`(或其他路径保留字符)的 id 把路径从中截断,匹配到别的路由甚至匹配失败——
+  // 这是要修的缺陷,不是要保真移植的行为。用具名路由 + params 让 vue-router 自己编码
+  // (encodeParam 对 `/` 也编,效果等价于 encodeURIComponent),优于手拼字符串再调
+  // encodeURIComponent——手拼还要操心两边的百分号编码规则是否完全一致,params 机制
+  // 从"构造/解析"两端都用同一套内部函数,不会出现编码和解码不对称的问题。
+  function redirectAlbumFromQuery(id: string): void {
+    router.replace({ name: 'photos-album-detail', params: { id } })
+  }
+
+  // ?person=<id>:Vue2 :509-523 _applyPersonFromQuery——先等 people 列表就绪,校验 id
+  // 存在才切页,不存在(或拉取失败)都静默清掉 query 里的 person 键、留在原地,不报错
+  // 不提示。
+  async function applyPersonFromQuery(id: string): Promise<void> {
+    const peopleStore = usePhotosPeople()
+    try {
+      await peopleStore.fetchPeople()
+      // id 比较走 String() 归一——全区铁律:后端 id 有时是数字(同类先例 Place.Key 是
+      // int32),query 里的 person 值恒为字符串(URL 本身是文本),`===` 直接比较字符串
+      // 和数字永远不相等,会让存在的人物被误判成"不存在"而被静默摘键。
+      const exists = peopleStore.people.some((p) => String(p.id) === String(id))
+      if (exists) {
+        redirectPersonFromQuery(id)
+      } else {
+        stripPersonFromQuery()
+      }
+    } catch (e) {
+      // Vue2 :521-523 的 catch。防御性兜底——usePhotosPeople().fetchPeople() 自身已经
+      // 把网络失败吞掉(内部 console.error,不 reject),这条 catch 目前不会被触发,留着
+      // 是防 store 实现变化时仍安全(不会让未捕获异常冒出去炸整个 onMounted 链)。
+      console.error('[photos-deeplinks] fetchPeople', e)
+      stripPersonFromQuery()
+    }
+  }
+
+  function redirectPersonFromQuery(id: string): void {
+    router.replace({ name: 'photos-person-detail', params: { id } })
+  }
+
+  // 静默摘掉 person 键、留在原地——不动其余 query 键,也不清 path(照 Vue2 mergeQuery
+  // 的语义:只动被摘的那一个键)。
+  function stripPersonFromQuery(): void {
+    const { person, ...rest } = route.query
+    void person
+    router.replace({ path: route.path, query: rest })
+  }
+
+  onMounted(() => {
+    void (async () => {
+      const photosetToken = firstQueryValue(route.query.photoset)
+      const assetId = firstQueryValue(route.query.asset)
+      // 优先级:photoset 优先于 asset(Vue2 :370-374 的 if / else if——两个都在时只走
+      // photoset,不是两个都触发)。这段必须先 await 完,q/album/person 的路由改写才能
+      // 跑(见文件头执行顺序说明)。
+      if (photosetToken) {
+        await openPhotoSetFromQuery(photosetToken, firstQueryValue(route.query.active))
+      } else if (assetId) {
+        await openAssetFromQuery(assetId)
+      }
+
+      // q/album/person:三个键各自独立、互不干扰(某个键缺失就跳过对应处理),都是
+      // "改路由"而不是"开灯箱"。
+      const q = firstQueryValue(route.query.q)
+      const albumId = firstQueryValue(route.query.album)
+      const personId = firstQueryValue(route.query.person)
+      if (q) redirectSearchFromQuery(q)
+      if (albumId) redirectAlbumFromQuery(albumId)
+      if (personId) await applyPersonFromQuery(personId)
+    })()
+  })
+}
diff --git a/src/photos/composables/usePlaceAssets.ts b/src/photos/composables/usePlaceAssets.ts
index ac18de8..d0bc443 100644
--- a/src/photos/composables/usePlaceAssets.ts
+++ b/src/photos/composables/usePlaceAssets.ts
@@ -57,14 +57,19 @@ export function usePlaceAssets(): UsePlaceAssetsReturn {
       // "失败保留旧数据"口径刻意不同:这里是「照片」标签页每次打开/切换 spot 都会重新
       // 查询的一次性结果,失败后留着上一个 spot 的照片会让用户误以为看到的是当前 spot 的
       // 内容——比展示空态更具误导性,所以清空。
       photos.value = []
       failed.value = true
     } finally {
       if (mine === seq) loading.value = false
     }
   }
 
+  // P8a-T10 挂账登记(只登记不改):这个 `months` 已经是死导出——唯一消费方
+  // views/PhotosPlaceAssets.vue 在 P7b 加 EXIF 筛选时改成自己对 assets.photos.value 现算
+  // 一份筛选后的 gridMonths(该文件 :130-139 有完整理由),不再读这里的 months。按"禁止无关
+  // 重构"保留这个字段(改接口/删字段不是本次任务范围),但下次改这个组合式函数时不要假设
+  // 它还有消费方——先 grep 一遍确认。
   const months = computed(() => groupPhotosByMonth(photos.value))
 
   return { photos, months, loading, loaded, failed, load }
 }
diff --git a/src/photos/stores/__tests__/albums.test.ts b/src/photos/stores/__tests__/albums.test.ts
index 2d76fd0..ac5b573 100644
--- a/src/photos/stores/__tests__/albums.test.ts
+++ b/src/photos/stores/__tests__/albums.test.ts
@@ -40,20 +40,64 @@ describe('photosAlbums store', () => {
     })
     it('reject → albumsLoaded 仍为 false + console.error 被调', async () => {
       const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
       ;(service.photos.listAlbums as any).mockRejectedValueOnce(new Error('net'))
       const s = usePhotosAlbums()
       await s.fetchAlbums()
       expect(s.albumsLoaded).toBe(false)
       expect(errSpy).toHaveBeenCalled()
       errSpy.mockRestore()
     })
+    // Task 9(P4 遗留收口):新增 loadError,语义与 albumsLoaded 完全独立——失败时
+    // loadError=true 但 albumsLoaded 仍保持 false(不可合并/不可互相替代)。
+    it('fetchAlbums 失败:loadError 置真,albumsLoaded 保持假', async () => {
+      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
+      ;(service.photos.listAlbums as any).mockRejectedValueOnce(new Error('net'))
+      const s = usePhotosAlbums()
+      await s.fetchAlbums()
+      expect(s.loadError).toBe(true)
+      expect(s.albumsLoaded).toBe(false)
+      errSpy.mockRestore()
+    })
+    it('重试成功后 loadError 归假', async () => {
+      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
+      ;(service.photos.listAlbums as any).mockRejectedValueOnce(new Error('net'))
+      const s = usePhotosAlbums()
+      await s.fetchAlbums()
+      expect(s.loadError).toBe(true)
+      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 1, name: 'A' }])
+      await s.fetchAlbums()
+      expect(s.loadError).toBe(false)
+      expect(s.albumsLoaded).toBe(true)
+      errSpy.mockRestore()
+    })
+    it('成功路径 loadError 保持假', async () => {
+      const s = usePhotosAlbums()
+      await s.fetchAlbums()
+      expect(s.loadError).toBe(false)
+    })
+    // 评审 Important 1 补的挡门用例:重试本身也失败——loadError 必须仍然是真(不能被
+    // "进入重试"这件事本身清空),albums/albumsLoaded 的状态也要与"一次都没成功过"一致。
+    it('reject → retry → reject:结束后 loadError 仍为真,albums/albumsLoaded 与未成功过一致', async () => {
+      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
+      ;(service.photos.listAlbums as any).mockRejectedValueOnce(new Error('e1'))
+      const s = usePhotosAlbums()
+      await s.fetchAlbums()
+      expect(s.loadError).toBe(true)
+
+      ;(service.photos.listAlbums as any).mockRejectedValueOnce(new Error('e2'))
+      await s.fetchAlbums() // 重试,仍失败
+      expect(s.loadError).toBe(true)
+      expect(s.albums).toEqual([])
+      expect(s.albumsLoaded).toBe(false)
+      errSpy.mockRestore()
+    })
   })
 
   describe('跨类型 String 归一(铁律)', () => {
     it("albumById('7') 命中后端返回的数字 id 7", async () => {
       ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 7, name: 'A' }])
       const s = usePhotosAlbums()
       await s.fetchAlbums()
       expect(s.albumById('7')).toEqual({ id: 7, name: 'A' })
       expect(s.albumById(7)).toEqual({ id: 7, name: 'A' })
     })
diff --git a/src/photos/stores/__tests__/favorites.test.ts b/src/photos/stores/__tests__/favorites.test.ts
index bcb8a80..5cf3eff 100644
--- a/src/photos/stores/__tests__/favorites.test.ts
+++ b/src/photos/stores/__tests__/favorites.test.ts
@@ -77,16 +77,53 @@ describe('photosFavorites store', () => {
     expect(s.favoritesList?.length).toBe(1)
     expect(s.favoritesMonths[0].key).toBe('2026-05')
   })
   it('fetchFavorites 失败:favoritesList 置空但 favoritesLoaded 保持 false(与"确认零收藏"可区分,留给视图重试)', async () => {
     ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('network'))
     const s = usePhotosFavorites()
     await s.fetchFavorites()
     expect(s.favoritesList).toEqual([])
     expect(s.favoritesLoaded).toBe(false)
   })
+  // Task 9(P3 遗留收口):新增 loadError 标志,语义与 favoritesLoaded 完全独立——
+  // 失败时 loadError=true 但 favoritesLoaded 仍保持 false(两者不可合并/不可互相替代)。
+  it('fetchFavorites 失败:loadError 置真,favoritesLoaded 保持假(两者语义不同)', async () => {
+    ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('network'))
+    const s = usePhotosFavorites()
+    await s.fetchFavorites()
+    expect(s.loadError).toBe(true)
+    expect(s.favoritesLoaded).toBe(false)
+  })
+  it('重试成功后 loadError 归假', async () => {
+    ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('network'))
+    const s = usePhotosFavorites()
+    await s.fetchFavorites()
+    expect(s.loadError).toBe(true)
+    await s.fetchFavorites() // 重试:这次成功(mockRejectedValueOnce 只吃一次)
+    expect(s.loadError).toBe(false)
+    expect(s.favoritesLoaded).toBe(true)
+  })
+  it('成功路径 loadError 保持/归假(不会被残留的上次失败污染)', async () => {
+    const s = usePhotosFavorites()
+    await s.fetchFavorites()
+    expect(s.loadError).toBe(false)
+  })
+  // 评审 Important 1 补的挡门用例:重试本身也失败——loadError 必须仍然是真(不能被"进入
+  // 重试"这件事本身清空),favoritesList/favoritesLoaded 的状态也要与"一次都没成功过"一致。
+  it('reject → retry → reject:结束后 loadError 仍为真,favoritesList/favoritesLoaded 与未成功过一致', async () => {
+    ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('e1'))
+    const s = usePhotosFavorites()
+    await s.fetchFavorites()
+    expect(s.loadError).toBe(true)
+
+    ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('e2'))
+    await s.fetchFavorites() // 重试,仍失败
+    expect(s.loadError).toBe(true)
+    expect(s.favoritesList).toEqual([])
+    expect(s.favoritesLoaded).toBe(false)
+  })
   it('exportZip 走 exportFavoritesUrl', () => {
     const s = usePhotosFavorites()
     s.exportZip()
     expect(service.photos.exportFavoritesUrl).toHaveBeenCalled()
   })
 })
diff --git a/src/photos/stores/__tests__/settings.test.ts b/src/photos/stores/__tests__/settings.test.ts
new file mode 100644
index 0000000..b6acd25
--- /dev/null
+++ b/src/photos/stores/__tests__/settings.test.ts
@@ -0,0 +1,384 @@
+// Test doubles for the shared HTTP package. Photos v1 backend has no standard
+// envelope, so `service.photos.*` already resolve to bare bodies (see
+// ../../../../../NimoOS-Service/src/photos.ts) — mocks below mirror that.
+import { describe, it, expect, vi, beforeEach } from 'vitest'
+import { setActivePinia, createPinia } from 'pinia'
+import { usePhotosSettingsStore } from '../settings'
+
+vi.mock('@nimotech/nimoos-service', () => ({
+  service: {
+    photos: {
+      getConfig: vi.fn(),
+      updateConfig: vi.fn(),
+      getStorage: vi.fn(),
+      getAbout: vi.fn(),
+      pruneCache: vi.fn(),
+      rebuildIndex: vi.fn(),
+      triggerScan: vi.fn(),
+      reclusterFaces: vi.fn(),
+    },
+  },
+}))
+import { service } from '@nimotech/nimoos-service'
+// Cross-store mock idiom follows trash.test.ts's precedent (mock the whole
+// `../timeline` module rather than a real Pinia store instance). Unlike
+// trash.test.ts's fire-and-forget `fetchTimeline`, rebuildIndex's 409 branch
+// actually *reads* `tasks` after calling `fetchTasks()` — so the mock's
+// `fetchTasks` populates `tasks` as a side effect (mirroring the real
+// timeline store's fetchTasks() populating its own `tasks` ref), letting a
+// mutation test that deletes the `await timeline.fetchTasks()` call catch it
+// (tasks would stay empty instead of being populated).
+vi.mock('../timeline', () => ({ useTimelineStore: vi.fn() }))
+import { useTimelineStore } from '../timeline'
+
+describe('photosSettings store · aiFeatures', () => {
+  beforeEach(() => {
+    setActivePinia(createPinia())
+    vi.clearAllMocks()
+  })
+
+  it('缺字段一律按开启(Vue2 `d.xEnabled !== false` 口径)', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
+    const s = usePhotosSettingsStore()
+    await s.fetchAiFeatures()
+    expect(s.aiFeatures).toEqual({ faces: true, scenes: true, ocr: true, smartview: true })
+    expect(s.aiFeaturesLoaded).toBe(true)
+  })
+
+  it('只有显式 false 才关', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({
+      aiFeatures: { faces: false, scenes: true, ocr: 0, smartview: null },
+    })
+    const s = usePhotosSettingsStore()
+    await s.fetchAiFeatures()
+    // ocr: 0 与 smartview: null 都不是显式 false ⇒ 按开启
+    expect(s.aiFeatures).toEqual({ faces: false, scenes: true, ocr: true, smartview: true })
+  })
+
+  it('真实后端形状(扁平 xxxEnabled 字段,非 aiFeatures 嵌套)也要读对', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({
+      watchDirs: ['/DATA/Gallery'],
+      retentionDays: 30,
+      facesEnabled: false,
+      scenesEnabled: true,
+      ocrEnabled: false,
+      smartViewEnabled: true,
+    })
+    const s = usePhotosSettingsStore()
+    await s.fetchAiFeatures()
+    expect(s.aiFeatures).toEqual({ faces: false, scenes: true, ocr: false, smartview: true })
+  })
+
+  it('取数失败:按全开处理,且 aiFeaturesLoaded 保持 false(可与「确认全关」区分)', async () => {
+    vi.mocked(service.photos.getConfig).mockRejectedValue(new Error('boom'))
+    const s = usePhotosSettingsStore()
+    await s.fetchAiFeatures()
+    expect(s.aiFeatures).toEqual({ faces: true, scenes: true, ocr: true, smartview: true })
+    expect(s.aiFeaturesLoaded).toBe(false)
+  })
+})
+
+// P8a-T6:侧栏(全相册区共用组件)与各视图现在都会在各自 onMounted 里调
+// fetchAiFeatures() —— store 是单例,同一帧内多个消费方挂载会并发调用。这两条锁住
+// 「在途去重」的两个必要行为:去重生效 + 不是永久缓存。
+describe('photosSettings store · fetchAiFeatures 在途去重(P8a-T6)', () => {
+  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
+
+  it('fetchAiFeatures 并发去重:两个消费方同时挂载只发一次 getConfig', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
+    const s = usePhotosSettingsStore()
+    const [a, b] = await Promise.all([s.fetchAiFeatures(), s.fetchAiFeatures()])
+    expect(service.photos.getConfig).toHaveBeenCalledTimes(1)
+    // 两个并发调用者拿到的是同一次取数的结果,不是各自独立的返回值对象身份要求,但值必须一致。
+    expect(a).toEqual(b)
+  })
+
+  it('去重不是永久缓存:上一次结算后再调会重新发请求', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
+    const s = usePhotosSettingsStore()
+    await s.fetchAiFeatures()
+    await s.fetchAiFeatures()
+    expect(service.photos.getConfig).toHaveBeenCalledTimes(2)
+  })
+
+  it('三个并发调用者同样只发一次(不是"恰好 2 个"才生效的偶然实现)', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
+    const s = usePhotosSettingsStore()
+    await Promise.all([s.fetchAiFeatures(), s.fetchAiFeatures(), s.fetchAiFeatures()])
+    expect(service.photos.getConfig).toHaveBeenCalledTimes(1)
+  })
+})
+
+describe('photosSettings store · setAiFeature', () => {
+  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
+
+  it('保存成功:开关落到新值', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
+    vi.mocked(service.photos.updateConfig).mockResolvedValue(undefined)
+    const s = usePhotosSettingsStore()
+    await s.fetchAiFeatures()
+    const ok = await s.setAiFeature('faces', false)
+    expect(ok).toBe(true)
+    expect(s.aiFeatures.faces).toBe(false)
+  })
+
+  it('写回时把当前 watchDirs/retentionDays 随同回传(共享包 updateConfig 是位置参数,watchDirs 必填且后端非空校验)', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({
+      watchDirs: ['/DATA/Gallery', '/DATA/Media'],
+      retentionDays: 45,
+      facesEnabled: true, scenesEnabled: true, ocrEnabled: true, smartViewEnabled: true,
+    })
+    vi.mocked(service.photos.updateConfig).mockResolvedValue(undefined)
+    const s = usePhotosSettingsStore()
+    await s.fetchAiFeatures()
+    await s.setAiFeature('ocr', false)
+    expect(service.photos.updateConfig).toHaveBeenCalledWith(
+      ['/DATA/Gallery', '/DATA/Media'],
+      45,
+      true,
+      { scenesEnabled: true, ocrEnabled: false, smartViewEnabled: true },
+    )
+  })
+
+  it('保存失败:开关回滚到上一个已知好值(Vue2 :274-278 的回滚语义)', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
+    vi.mocked(service.photos.updateConfig).mockRejectedValue(new Error('boom'))
+    const s = usePhotosSettingsStore()
+    await s.fetchAiFeatures()
+    const ok = await s.setAiFeature('ocr', false)
+    expect(ok).toBe(false)
+    expect(s.aiFeatures.ocr).toBe(true) // 回滚
+  })
+
+  it('乐观更新:await 之前开关已是新值(UI 立即响应,不等网络)', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
+    let release: (() => void) | undefined
+    vi.mocked(service.photos.updateConfig).mockImplementation(
+      () => new Promise<void>((res) => { release = res }),
+    )
+    const s = usePhotosSettingsStore()
+    await s.fetchAiFeatures()
+    const p = s.setAiFeature('scenes', false)
+    expect(s.aiFeatures.scenes).toBe(false) // 在途已生效,写回前还有一次 getConfig() 微任务才到 updateConfig
+    await vi.waitFor(() => { if (!release) throw new Error('updateConfig not yet called') })
+    release?.()
+    await p
+  })
+})
+
+describe('photosSettings store · storage & about', () => {
+  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
+
+  it('取数成功:storage 落值、storageError 假', async () => {
+    vi.mocked(service.photos.getStorage).mockResolvedValue({
+      diskTotalBytes: 2e12, diskFreeBytes: 1e12, prunableBytes: 5e8,
+      photosBytes: 3e11, videosBytes: 2e11, rawBytes: 1e11, cacheBytes: 1e10, aiBytes: 5e9,
+    })
+    const s = usePhotosSettingsStore()
+    await s.fetchStorage()
+    expect(s.storage?.diskTotalBytes).toBe(2e12)
+    expect(s.storageError).toBe(false)
+  })
+
+  it('取数失败:storage 置 null 且 storageError 为真(Vue2 :387-397 的两分支)', async () => {
+    vi.mocked(service.photos.getStorage).mockRejectedValue(new Error('boom'))
+    const s = usePhotosSettingsStore()
+    await s.fetchStorage()
+    expect(s.storage).toBeNull()
+    expect(s.storageError).toBe(true)
+  })
+
+  it('后端返空体也算失败态(Vue2 :391 的 storageError = !this.storage)', async () => {
+    vi.mocked(service.photos.getStorage).mockResolvedValue(null as never)
+    const s = usePhotosSettingsStore()
+    await s.fetchStorage()
+    expect(s.storageError).toBe(true)
+  })
+
+  it('fetchAbout 成功落值', async () => {
+    vi.mocked(service.photos.getAbout).mockResolvedValue({
+      version: '1.2.3', deviceName: 'NAS', indexCoverage: 80,
+      indexLastBuilt: '2026-08-01T00:00:00Z', librarySince: '2020-01-01T00:00:00Z',
+    })
+    const s = usePhotosSettingsStore()
+    await s.fetchAbout()
+    expect(s.about?.deviceName).toBe('NAS')
+  })
+
+  it('fetchAbout 失败置 null', async () => {
+    vi.mocked(service.photos.getAbout).mockRejectedValue(new Error('boom'))
+    const s = usePhotosSettingsStore()
+    await s.fetchAbout()
+    expect(s.about).toBeNull()
+  })
+})
+
+describe('photosSettings store · retention & scanInterval 回滚', () => {
+  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
+
+  it('setRetention 失败要回滚 —— Vue2 的 retention watcher 只弹 toast 不回滚,是缺陷,本期改正', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({ retentionDays: 30 })
+    vi.mocked(service.photos.updateConfig).mockRejectedValue(new Error('boom'))
+    const s = usePhotosSettingsStore()
+    await s.fetchRetention()
+    const ok = await s.setRetention(90)
+    expect(ok).toBe(false)
+    expect(s.retentionDays).toBe(30)
+  })
+
+  it('setScanInterval 失败要回滚(Vue2 :447-457 本就有 prev 回滚)', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({ scanInterval: 1440 })
+    vi.mocked(service.photos.updateConfig).mockRejectedValue(new Error('boom'))
+    const s = usePhotosSettingsStore()
+    await s.fetchScanInterval()
+    const ok = await s.setScanInterval(0)
+    expect(ok).toBe(false)
+    expect(s.scanIntervalMinutes).toBe(1440)
+  })
+
+  it('scanInterval 允许 0(关闭自动重扫)—— 不能被 `|| 1440` 之类的假值兜底吃掉', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({ scanInterval: 0 })
+    const s = usePhotosSettingsStore()
+    await s.fetchScanInterval()
+    expect(s.scanIntervalMinutes).toBe(0)
+  })
+
+  it('setScanInterval 写回时把 scanInterval 放进 extra 参数,watchDirs/retention 用当前值回传', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({
+      watchDirs: ['/DATA/Gallery'], retentionDays: 30, scanInterval: 1440,
+    })
+    vi.mocked(service.photos.updateConfig).mockResolvedValue(undefined)
+    const s = usePhotosSettingsStore()
+    await s.setScanInterval(360)
+    expect(service.photos.updateConfig).toHaveBeenCalledWith(
+      ['/DATA/Gallery'], 30, undefined, { scanInterval: 360 },
+    )
+  })
+})
+
+describe('photosSettings store · rebuildIndex 的 409 分支', () => {
+  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
+
+  it('正常路径返回新 taskId', async () => {
+    vi.mocked(service.photos.rebuildIndex).mockResolvedValue({ taskId: 't-1' })
+    const s = usePhotosSettingsStore()
+    await expect(s.rebuildIndex()).resolves.toBe('t-1')
+  })
+
+  it('409 = 已有重建在跑:不抛错,调用 timeline.fetchTasks() 刷新一次后返回运行中那条 rebuild 任务的 id(Vue2 :458-473)', async () => {
+    vi.mocked(service.photos.rebuildIndex).mockRejectedValue({ response: { status: 409 } })
+    // fetchTasks 的 mock 实现负责把 tasks 填充为「刷新后」的样子 —— 断言的是 rebuildIndex
+    // 真的调用了 fetchTasks() 才拿到这条任务,而不是提前埋好的静态状态(见文件头注释)。
+    const timeline = { tasks: [] as Array<{ id: string; type: string }>, fetchTasks: vi.fn() }
+    timeline.fetchTasks.mockImplementation(async () => {
+      timeline.tasks = [{ id: 't-running', type: 'rebuild' }]
+    })
+    vi.mocked(useTimelineStore).mockReturnValue(timeline as never)
+    const s = usePhotosSettingsStore()
+    await expect(s.rebuildIndex()).resolves.toBe('t-running')
+    expect(timeline.fetchTasks).toHaveBeenCalledTimes(1)
+  })
+
+  it('409 但刷新后的任务列表里没有 rebuild 类型任务:返回空字符串', async () => {
+    vi.mocked(service.photos.rebuildIndex).mockRejectedValue({ response: { status: 409 } })
+    const timeline = { tasks: [] as Array<{ id: string; type: string }>, fetchTasks: vi.fn() }
+    timeline.fetchTasks.mockImplementation(async () => {
+      timeline.tasks = [{ id: 'u-1', type: 'upload' }]
+    })
+    vi.mocked(useTimelineStore).mockReturnValue(timeline as never)
+    const s = usePhotosSettingsStore()
+    await expect(s.rebuildIndex()).resolves.toBe('')
+  })
+
+  it('非 409 错误照常抛出', async () => {
+    vi.mocked(service.photos.rebuildIndex).mockRejectedValue({ response: { status: 500 } })
+    const s = usePhotosSettingsStore()
+    await expect(s.rebuildIndex()).rejects.toBeTruthy()
+  })
+})
+
+describe('photosSettings store · pruneCache / triggerScan / reclusterFaces', () => {
+  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
+
+  it('pruneCache 返回 freedBytes', async () => {
+    vi.mocked(service.photos.pruneCache).mockResolvedValue({ freedBytes: 12345 })
+    const s = usePhotosSettingsStore()
+    await expect(s.pruneCache()).resolves.toBe(12345)
+  })
+
+  it('pruneCache 空体按 0 处理', async () => {
+    vi.mocked(service.photos.pruneCache).mockResolvedValue(null as never)
+    const s = usePhotosSettingsStore()
+    await expect(s.pruneCache()).resolves.toBe(0)
+  })
+
+  it('pruneCache 失败向上抛(视图层负责 toast,同 Vue2 各动作)', async () => {
+    vi.mocked(service.photos.pruneCache).mockRejectedValue(new Error('boom'))
+    const s = usePhotosSettingsStore()
+    await expect(s.pruneCache()).rejects.toBeTruthy()
+  })
+
+  it('triggerScan 成功返回 true', async () => {
+    vi.mocked(service.photos.triggerScan).mockResolvedValue(undefined)
+    const s = usePhotosSettingsStore()
+    await expect(s.triggerScan()).resolves.toBe(true)
+  })
+
+  it('triggerScan 失败向上抛', async () => {
+    vi.mocked(service.photos.triggerScan).mockRejectedValue(new Error('boom'))
+    const s = usePhotosSettingsStore()
+    await expect(s.triggerScan()).rejects.toBeTruthy()
+  })
+
+  it('reclusterFaces 成功返回 true', async () => {
+    vi.mocked(service.photos.reclusterFaces).mockResolvedValue(undefined)
+    const s = usePhotosSettingsStore()
+    await expect(s.reclusterFaces()).resolves.toBe(true)
+  })
+
+  it('reclusterFaces 失败向上抛', async () => {
+    vi.mocked(service.photos.reclusterFaces).mockRejectedValue(new Error('boom'))
+    const s = usePhotosSettingsStore()
+    await expect(s.reclusterFaces()).rejects.toBeTruthy()
+  })
+})
+
+describe('photosSettings store · reset', () => {
+  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
+
+  it('reset 恢复所有字段到文档默认值', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({
+      aiFeatures: { faces: false }, retentionDays: 90, scanInterval: 0,
+    })
+    vi.mocked(service.photos.getStorage).mockResolvedValue({
+      diskTotalBytes: 1, diskFreeBytes: 1, prunableBytes: 1,
+      photosBytes: 1, videosBytes: 1, rawBytes: 1, cacheBytes: 1, aiBytes: 1,
+    })
+    vi.mocked(service.photos.getAbout).mockResolvedValue({
+      version: '1.0.0', deviceName: 'test-nas', indexCoverage: 42,
+      indexLastBuilt: '2026-01-01T00:00:00Z', librarySince: '2020-01-01T00:00:00Z',
+    })
+    const s = usePhotosSettingsStore()
+    await s.fetchAiFeatures()
+    await s.fetchRetention()
+    await s.fetchScanInterval()
+    await s.fetchStorage() // storage 非空、storageError 假
+    await s.fetchAbout()   // about 非空(修 Minor 3:此前从未取过,断言是空判定平凡真)
+    // storage/storageError 在本店里由同一次 fetchStorage 联动置值,取不到「storage 非空
+    // 且 storageError 为真」同时成立的真实路径 —— 直接写 ref 造一个非默认值,只是为了让
+    // reset() 之后的 storageError 断言不再平凡为真(修 Minor 3),不代表真实调用路径。
+    s.storageError = true
+    // reset 前哨兵:证明下面的 reset() 断言不是从默认值开始的空转
+    expect(s.about).not.toBeNull()
+    expect(s.storage).not.toBeNull()
+    expect(s.storageError).toBe(true)
+    s.reset()
+    expect(s.aiFeatures).toEqual({ faces: true, scenes: true, ocr: true, smartview: true })
+    expect(s.aiFeaturesLoaded).toBe(false)
+    expect(s.retentionDays).toBe(30)
+    expect(s.scanIntervalMinutes).toBe(1440)
+    expect(s.storage).toBeNull()
+    expect(s.storageError).toBe(false)
+    expect(s.about).toBeNull()
+  })
+})
diff --git a/src/photos/stores/__tests__/timeline.test.ts b/src/photos/stores/__tests__/timeline.test.ts
index e1d92c1..19c4999 100644
--- a/src/photos/stores/__tests__/timeline.test.ts
+++ b/src/photos/stores/__tests__/timeline.test.ts
@@ -237,11 +237,49 @@ describe('photos-timeline store', () => {
     svc.photos.getStatus.mockResolvedValue({ pending: 0, indexed: 0, error: 0, queueLen: 0, totalBytes: 0, galleryDir: '', diskTotal: 0, diskAvail: 0, mlReady: null })
     s.startIndexPoll()
     await Promise.resolve()
     s.ingestTaskBus({ id: 't1', type: 'index', status: 'running' })
     s.__resetForTest()
     expect(s.tasks).toEqual([])
     const callsAfterReset = svc.photos.getStatus.mock.calls.length
     await vi.advanceTimersByTimeAsync(20000)
     expect(svc.photos.getStatus.mock.calls.length).toBe(callsAfterReset)
   })
+
+  // P8a-T10(P1 挂账):照 Vue2 scheduleTaskRemove(store/modules/photos.js:50-58,
+  // _onTaskBus :1388-1402)——非 index 类型的 done 任务 5s 后自动从列表移除。
+  it('ingestTaskBus: 非 index 类型 done 任务 5s 后从列表移除(边界:4999ms 仍在,+2ms 已移除)', () => {
+    const s = useTimelineStore()
+    s.ingestTaskBus({ id: 'ocr-1', type: 'ocr', status: 'done' })
+    expect(s.tasks).toHaveLength(1)
+    vi.advanceTimersByTime(4999)
+    expect(s.tasks).toHaveLength(1)
+    vi.advanceTimersByTime(2)
+    expect(s.tasks).toHaveLength(0)
+  })
+
+  it('ingestTaskBus: index 类型的 done 任务不走 5s 过期(留给 fetchIndexStatus 的 idle 对账)', () => {
+    const s = useTimelineStore()
+    s.ingestTaskBus({ id: 'idx-1', type: 'index', status: 'done' })
+    vi.advanceTimersByTime(5001)
+    expect(s.tasks).toHaveLength(1) // 计时器不管 index,只有 idle 对账才会摘掉它
+  })
+
+  it('ingestTaskBus: done 任务的移除计时器在同 id 再次 running 时取消', () => {
+    const s = useTimelineStore()
+    s.ingestTaskBus({ id: 'ocr-1', type: 'ocr', status: 'done' })
+    vi.advanceTimersByTime(3000)
+    s.ingestTaskBus({ id: 'ocr-1', type: 'ocr', status: 'running', current: 1, total: 10 })
+    vi.advanceTimersByTime(5000) // 若旧计时器没被取消,这里会把复活的任务错误摘掉
+    expect(s.tasks).toHaveLength(1)
+    expect(s.tasks[0]).toMatchObject({ status: 'running' })
+  })
+
+  it('__resetForTest 清掉挂起的 done 移除计时器(不留潜在的跨测试污染)', () => {
+    const s = useTimelineStore()
+    s.ingestTaskBus({ id: 'ocr-1', type: 'ocr', status: 'done' })
+    s.__resetForTest()
+    expect(s.tasks).toEqual([])
+    // 计时器已随 reset 清掉;之后即使继续推进时间也不该抛错或访问已重置的 state。
+    expect(() => vi.advanceTimersByTime(10000)).not.toThrow()
+  })
 })
diff --git a/src/photos/stores/albums.ts b/src/photos/stores/albums.ts
index 78bc89a..8056aa3 100644
--- a/src/photos/stores/albums.ts
+++ b/src/photos/stores/albums.ts
@@ -8,20 +8,24 @@ import { service } from '@nimotech/nimoos-service'
 import { assetToPhoto, type Photo } from '../util/assetToPhoto'
 
 type RawAlbum = Record<string, unknown>
 
 export const usePhotosAlbums = defineStore('photosAlbums', () => {
   // Vue2 state.albums 存的是**原始后端对象**(视图层再 map 成 AlbumView),照搬。
   const albums = ref<RawAlbum[]>([])
   // New-UI 增:空态门控。只在 fetchAlbums 成功路径置 true,失败留 false 可重试
   // (P3 血泪:无条件置位会让瞬时失败与「确认零相册」不可区分)。
   const albumsLoaded = ref(false)
+  // Task 9 (P8a, P4 遗留收口): 独立失败标志——绝不与 albumsLoaded 合并/复用。
+  // albumsLoaded 仅成功路径置真是刻意的(见上方注释);一次瞬时失败必须能被视图区分出
+  // 「加载失败」而不是「还在骨架屏」,这就是 loadError 存在的唯一理由。
+  const loadError = ref(false)
   const albumAssetsByID = ref<Record<string, Photo[]>>({})
   const albumAssetsLoading = ref<Record<string, boolean>>({})
 
   // ── 读取辅助(全部 String 归一:路由 params.id 恒为字符串,后端 id 可能是数字)──
   function key(id: string | number): string { return String(id) }
   function albumById(id: string | number): RawAlbum | null {
     return albums.value.find((a) => key(a.id as string | number) === key(id)) ?? null
   }
   function assetsOf(id: string | number): Photo[] { return albumAssetsByID.value[key(id)] ?? [] }
   function isLoadingAssets(id: string | number): boolean { return albumAssetsLoading.value[key(id)] === true }
@@ -46,26 +50,37 @@ export const usePhotosAlbums = defineStore('photosAlbums', () => {
     const idx = albums.value.findIndex((a) => key(a.id as string | number) === key(id))
     if (idx < 0) return
     const next = albums.value.slice()
     next[idx] = { ...next[idx], ...patch }
     albums.value = next
   }
 
   // ── actions ──
 
   // Vue2 :910-917 —— 全量覆盖,catch 只打日志不抛(唯一「吞错」的 album action)。
+  // Task 9 correction: `loadError` used to be reset to false at the top of
+  // this function (before the await). That created a window, on every retry
+  // (success *or* failure), where loadError was already false but
+  // albumsLoaded was still false too — i.e. a transient "nothing failed"
+  // reading during a fetch that hasn't settled yet. Clearing loadError only
+  // on confirmed success means the failure UI stays continuously visible
+  // from the first failure until a retry actually succeeds — no window
+  // where a consumer can observe "not failed, not loaded" and draw the
+  // wrong conclusion.
   async function fetchAlbums(): Promise<void> {
     try {
       const res = (await service.photos.listAlbums()) as unknown[]
       albums.value = ((res ?? []) as RawAlbum[])
       albumsLoaded.value = true // 仅成功路径
+      loadError.value = false
     } catch (e) {
+      loadError.value = true
       console.error('[photos-albums] fetchAlbums', e)
     }
   }
 
   // Vue2 :900-904 —— 无 try/catch,异常上抛给视图层 toast;成功后重拉列表并返回新相册。
   async function createAlbum(name: string): Promise<RawAlbum> {
     const created = (await service.photos.createAlbum(name)) as RawAlbum
     await fetchAlbums()
     return created
   }
@@ -175,23 +190,24 @@ export const usePhotosAlbums = defineStore('photosAlbums', () => {
   async function saveAsAlbum(name: string, assetIds: Array<string | number>): Promise<RawAlbum> {
     const created = (await service.photos.createAlbum(name)) as RawAlbum
     await service.photos.batchAddToAlbum(created.id as string | number, assetIds)
     await fetchAlbums()
     return created
   }
 
   function __resetForTest(): void {
     albums.value = []
     albumsLoaded.value = false
+    loadError.value = false
     albumAssetsByID.value = {}
     albumAssetsLoading.value = {}
   }
 
   return {
-    albums, albumsLoaded, albumAssetsByID, albumAssetsLoading,
+    albums, albumsLoaded, loadError, albumAssetsByID, albumAssetsLoading,
     albumById, assetsOf, isLoadingAssets,
     fetchAlbums, createAlbum, deleteAlbum, fetchAlbumAssets,
     renameAlbum, setAlbumCover, reorderAlbumAssets,
     addAssetsToAlbum, removeAssetsFromAlbum, saveAsAlbum,
     __resetForTest,
   }
 })
diff --git a/src/photos/stores/favorites.ts b/src/photos/stores/favorites.ts
index 6e7b589..a9e55e1 100644
--- a/src/photos/stores/favorites.ts
+++ b/src/photos/stores/favorites.ts
@@ -10,20 +10,25 @@ import { service } from '@nimotech/nimoos-service'
 import { assetToPhoto, type Photo, type Month } from '../util/assetToPhoto'
 import { groupPhotosByMonth } from '../util/groupPhotosByMonth'
 
 const VIEW_THROTTLE_MS = 60_000
 
 export const usePhotosFavorites = defineStore('photosFavorites', () => {
   const favIds = ref<Set<string>>(new Set())
   const favIdsLoaded = ref(false)
   const favoritesList = ref<Photo[] | null>(null)
   const favoritesLoaded = ref(false)
+  // Task 9 (P8a, P3 遗留收口): 独立失败标志——绝不与 favoritesLoaded 合并/复用。
+  // favoritesLoaded 仅成功路径置真是刻意的(见下方 fetchFavorites 注释);一次瞬时失败
+  // 必须能被视图区分出「加载失败」而不是「正在加载」或「确认为空」,这就是 loadError 存在
+  // 的唯一理由。
+  const loadError = ref(false)
   // Non-reactive view-report throttle ledger — mirrors Vue2's non-reactive
   // `state._viewReportTs`, avoiding a render trigger on every photo view.
   const _viewTs = new Map<string, number>()
 
   function isFav(id: string | number): boolean {
     return favIds.value.has(String(id))
   }
   const favoritesMonths = computed<Month[]>(() => groupPhotosByMonth(favoritesList.value ?? []))
 
   async function reconcileFavIds(): Promise<void> {
@@ -31,30 +36,44 @@ export const usePhotosFavorites = defineStore('photosFavorites', () => {
       const ids = await service.photos.listFavoriteIds()
       favIds.value = new Set(((ids as unknown[]) ?? []).map((v) => String(v)))
       favIdsLoaded.value = true
     } catch (e) {
       // leave favIds as-is on failure
       console.error('[photos-favorites] reconcileFavIds', e)
     }
   }
 
   async function fetchFavorites(): Promise<void> {
+    // Task 9 correction: `loadError` used to be reset to false at the top of
+    // this function (before the await), mirroring the "reset before attempt"
+    // instruction this task started with. That was wrong: it created a
+    // window, on every retry (success *or* failure), where loadError was
+    // false but favoritesLoaded was still false too — and the Favorites view
+    // has no dedicated "loading" branch, so during that window it fell
+    // through to the v-else branch and rendered an empty grid, transiently
+    // reproducing the exact P3 defect this task exists to fix. Clearing
+    // loadError only on confirmed success means the failure UI stays
+    // continuously visible from the first failure until a retry actually
+    // succeeds — no window where the view can fall through to the wrong
+    // branch.
     try {
       const list = (await service.photos.listFavorites()) as unknown[]
       favoritesList.value = (list ?? []).map((a) => assetToPhoto(a as Record<string, unknown>))
       // Only mark loaded on success — a transient fetch failure must stay
       // distinguishable from "confirmed zero favorites", otherwise consumers
       // gating a refetch on `!favoritesLoaded` (e.g. the Favorites view) would
       // permanently mask real favorites behind an empty state.
       favoritesLoaded.value = true
+      loadError.value = false
     } catch (e) {
       favoritesList.value = []
+      loadError.value = true
       console.error('[photos-favorites] fetchFavorites', e)
     }
   }
 
   // Single-item optimistic flip + failure rollback (true to Vue2 toggleFav:
   // flips again to roll back, not a snapshot restore).
   async function toggle(id: string | number): Promise<void> {
     const key = String(id)
     const wasFav = favIds.value.has(key)
     const flipped = new Set(favIds.value)
@@ -95,19 +114,20 @@ export const usePhotosFavorites = defineStore('photosFavorites', () => {
   function exportZip(): void {
     const url = service.photos.exportFavoritesUrl()
     if (typeof window !== 'undefined') window.location.href = url
   }
 
   function __resetForTest(): void {
     favIds.value = new Set()
     favIdsLoaded.value = false
     favoritesList.value = null
     favoritesLoaded.value = false
+    loadError.value = false
     _viewTs.clear()
   }
 
   return {
-    favIds, favIdsLoaded, favoritesList, favoritesLoaded,
+    favIds, favIdsLoaded, favoritesList, favoritesLoaded, loadError,
     isFav, favoritesMonths,
     reconcileFavIds, fetchFavorites, toggle, recordView, exportZip, __resetForTest,
   }
 })
diff --git a/src/photos/stores/settings.ts b/src/photos/stores/settings.ts
new file mode 100644
index 0000000..201589c
--- /dev/null
+++ b/src/photos/stores/settings.ts
@@ -0,0 +1,306 @@
+// Ported (behavior unchanged, types added) from Vue2 NimoOS-UI
+// views/Photos/PhotosSettings.vue:234-297 (data + two watchers), :387-486
+// (five actions + loadStorage/loadAbout), :500-526 (mounted initial fetches)
+// and store/modules/photos.js:1249-1306 (setAiFaces/setAiFeatures/
+// fetchAiFeatures) + :1413-1438 (fetchTrashRetention/setTrashRetention/
+// fetchScanInterval/setScanInterval).
+//
+// This store is the shared config/storage/about cache for the settings page
+// (Tasks 3-6). It also folds in retention/scanInterval — duplicated on
+// purpose against trash.ts's own fetchRetention/setRetention (that copy
+// stays; the trash view is out of scope here, see task report "concerns").
+//
+// rebuildIndex()'s 409 branch reads timeline.ts's existing `tasks` list (via
+// its fetchTasks() action) rather than taking a caller-supplied lookup
+// callback — see the comment at rebuildIndex() below and the task report's
+// fix-up log for why an earlier revision used a callback instead.
+//
+// IMPORTANT (brief-vs-shared-package discrepancy, resolved in favor of the
+// shared package's actual signature — see task report): the shared package's
+// `updateConfig` is NOT `updateConfig(patch: object)`. Its real signature
+// (.sp7/NimoOS-Service/src/photos.ts:48-62) is positional:
+//   updateConfig(watchDirs: string[], retentionDays?, facesEnabled?, extra?)
+// `watchDirs` is unconditionally included in the request body (no way to
+// omit it), and the backend rejects an empty watchDirs list. Vue2 handles
+// this by re-reading getConfig() immediately before every updateConfig call
+// and re-sending the current watchDirs (setAiFaces :1249-1256, setAiFeatures
+// :1281-1291, setTrashRetention :1419-1425, setScanInterval :1432-1438) —
+// every write in this store follows that same read-then-write shape.
+//
+// P8a-T6 (2026-08-04): folded PhotosPeople.vue's and PhotosSmartViews.vue's own
+// onMounted-direct getConfig reads into this store's fetchAiFeatures (§7e-10
+// debt), added an in-flight dedup to fetchAiFeatures (see the comment at its
+// definition — the sidebar is a config consumer too now, §7e-15), and wired
+// PhotosSmartViews.vue's dead-link settings banner to a real route (§7e-9).
+import { defineStore } from 'pinia'
+import { ref } from 'vue'
+import { service } from '@nimotech/nimoos-service'
+import { useTimelineStore } from './timeline'
+
+export interface PhotosAiFeatures {
+  faces: boolean
+  scenes: boolean
+  ocr: boolean
+  smartview: boolean
+}
+
+export interface PhotosStorageInfo {
+  diskTotalBytes: number
+  diskFreeBytes: number
+  prunableBytes: number
+  photosBytes: number
+  videosBytes: number
+  rawBytes: number
+  cacheBytes: number
+  aiBytes: number
+}
+
+export interface PhotosAboutInfo {
+  version: string
+  deviceName: string
+  indexCoverage: number
+  indexLastBuilt: string
+  librarySince: string
+}
+
+const ALL_ON: PhotosAiFeatures = { faces: true, scenes: true, ocr: true, smartview: true }
+
+// Vue2 store/modules/photos.js:1297-1302 的读法:**只有显式 false 才关**,缺字段/请求失败
+// 一律按开启处理(宁可多显示一个入口,也不要因为一次配置读取抖动就把功能藏起来吓用户)。
+// 真实后端是扁平字段(`facesEnabled`/`scenesEnabled`/`ocrEnabled`/`smartViewEnabled`,注意
+// smartViewEnabled 的驼峰与其它三个不同),直接挂在 getConfig() 的返回体上,没有 `aiFeatures`
+// 嵌套键 —— 这里同时兼容测试夹具使用的 `{ aiFeatures: {...} }` 嵌套形状与短字段名。
+function readAiFeatures(cfg: Record<string, unknown> | null | undefined): PhotosAiFeatures {
+  const ai = (cfg?.aiFeatures ?? cfg ?? {}) as Record<string, unknown>
+  const on = (v: unknown): boolean => v !== false
+  return {
+    faces: on(ai.faces ?? ai.facesEnabled),
+    scenes: on(ai.scenes ?? ai.scenesEnabled),
+    ocr: on(ai.ocr ?? ai.ocrEnabled),
+    smartview: on(ai.smartview ?? ai.smartViewEnabled),
+  }
+}
+
+export const usePhotosSettingsStore = defineStore('photos-settings', () => {
+  const aiFeatures = ref<PhotosAiFeatures>({ ...ALL_ON })
+  // 仅成功路径置真 —— 与 favorites.ts:44 同一口径:一次取数失败必须与「确认全关」可区分,
+  // 否则以 !loaded 为重取判据的消费方会把真实配置永久掩在默认值后面。
+  const aiFeaturesLoaded = ref(false)
+  const storage = ref<PhotosStorageInfo | null>(null)
+  const storageError = ref(false)
+  const about = ref<PhotosAboutInfo | null>(null)
+  const retentionDays = ref(30)
+  const scanIntervalMinutes = ref(1440)
+
+  // P8a-T6:多个消费方(侧栏 + 各视图各自的 onMounted)现在都会挂载并各调一次
+  // fetchAiFeatures() —— 侧栏是相册区全局共用组件,与任意一个视图同帧挂载,朴素实现会在
+  // 一次页面加载里对 getConfig 发出两次并发请求。这里加一个「在途去重」:多个并发调用共享
+  // 同一个 in-flight promise。**刻意不做成永久缓存** —— promise 在 finally 里落回 null,
+  // 下一次(不在途时)调用会重新发请求,保持"设置页保存后再进列表页能看到最新值"这条既有
+  // 语义(没有人会指望这个 store 只在应用生命周期内取一次)。形状照 Vue2
+  // store/modules/photos.js:1307-1315 的 `_restoreUploadsPromise`(模块级变量持有的
+  // in-flight promise 让并发调用者复用同一次请求),但语义不同:那处是"全局只运行一次,永久
+  // 不重置"的迁移幂等;这里在 finally 清空,只做"同一帧内的并发去重",不是永久缓存。
+  let aiFeaturesInFlight: Promise<PhotosAiFeatures> | null = null
+
+  async function fetchAiFeatures(): Promise<PhotosAiFeatures> {
+    if (aiFeaturesInFlight) return aiFeaturesInFlight
+    aiFeaturesInFlight = (async () => {
+      try {
+        const cfg = (await service.photos.getConfig()) as Record<string, unknown>
+        aiFeatures.value = readAiFeatures(cfg)
+        aiFeaturesLoaded.value = true
+      } catch (e) {
+        aiFeatures.value = { ...ALL_ON }
+        console.error('[photos-settings] fetchAiFeatures', e)
+      }
+      return aiFeatures.value
+    })()
+    try {
+      return await aiFeaturesInFlight
+    } finally {
+      aiFeaturesInFlight = null
+    }
+  }
+
+  // Vue2 :263-281 是一个 features 的 deep watcher,靠 _suppressFeaturesWatch + $nextTick
+  // 抑制「从后端同步初值」时的回写。New-UI 改成显式 action(点开关才调),**没有 watcher,
+  // 那套抑制标志整套不需要** —— 这不是重构掉功能,是同一意图在显式调用模型下的直接对应物。
+  // 乐观更新 + 失败回滚:与 Vue2 一致(:274-275 把 features 退回 _lastGoodFeatures)。
+  //
+  // 写回前重读一次 getConfig() 取当前 watchDirs/retentionDays 随同回传 —— 见文件头注释,
+  // 共享包 updateConfig 的 watchDirs 是必填位置参数,后端对空 watchDirs 有非空校验
+  // (同 Vue2 setAiFeatures :1281-1291)。
+  async function setAiFeature(id: keyof PhotosAiFeatures, on: boolean): Promise<boolean> {
+    const prev = { ...aiFeatures.value }
+    aiFeatures.value = { ...prev, [id]: on }
+    try {
+      const next = aiFeatures.value
+      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
+      const watchDirs = (cfg?.watchDirs as string[] | undefined) ?? []
+      const retention = cfg?.retentionDays as number | undefined
+      await service.photos.updateConfig(watchDirs, retention, next.faces, {
+        scenesEnabled: next.scenes,
+        ocrEnabled: next.ocr,
+        smartViewEnabled: next.smartview,
+      })
+      return true
+    } catch (e) {
+      aiFeatures.value = prev
+      console.error('[photos-settings] setAiFeature', id, e)
+      return false
+    }
+  }
+
+  async function fetchStorage(): Promise<void> {
+    try {
+      const res = (await service.photos.getStorage()) as unknown as PhotosStorageInfo | null
+      storage.value = res ?? null
+      // Vue2 :391 —— 后端返空体也算失败态(裸 JSON 直出,Photos v1 无信封,204 空体是可能的)
+      storageError.value = !storage.value
+    } catch (e) {
+      storage.value = null
+      storageError.value = true
+      console.error('[photos-settings] fetchStorage', e)
+    }
+  }
+
+  async function fetchAbout(): Promise<void> {
+    try {
+      const res = (await service.photos.getAbout()) as unknown as PhotosAboutInfo | null
+      about.value = res ?? null
+    } catch (e) {
+      about.value = null
+      console.error('[photos-settings] fetchAbout', e)
+    }
+  }
+
+  async function fetchRetention(): Promise<void> {
+    try {
+      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
+      const d = Number(cfg?.retentionDays)
+      if (d > 0) retentionDays.value = d
+    } catch (e) {
+      console.error('[photos-settings] fetchRetention', e)
+    }
+  }
+
+  // Vue2 :254-262 的 retention watcher 保存失败**只弹 toast、不回滚** ⇒ UI 上停在用户选的档位
+  // 而后端还是旧值,下次打开设置又跳回去。按铁律「Vue2 的 bug 不照抄」补回滚,与同文件
+  // :447-457 的 setScanInterval(本就有 prev 回滚)口径对齐。
+  async function setRetention(days: number): Promise<boolean> {
+    const prev = retentionDays.value
+    retentionDays.value = days
+    try {
+      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
+      const watchDirs = (cfg?.watchDirs as string[] | undefined) ?? []
+      await service.photos.updateConfig(watchDirs, days)
+      return true
+    } catch (e) {
+      retentionDays.value = prev
+      console.error('[photos-settings] setRetention', e)
+      return false
+    }
+  }
+
+  // scanInterval 允许 0(= 关闭自动重扫,见 Vue2 :306 的 scan_interval_off 档),
+  // 所以判据用 Number.isFinite 而不是真值判断 —— `cfg.scanInterval || 1440` 会把 0 吃成 1440。
+  async function fetchScanInterval(): Promise<void> {
+    try {
+      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
+      const v = Number(cfg?.scanInterval)
+      if (Number.isFinite(v) && v >= 0) scanIntervalMinutes.value = v
+    } catch (e) {
+      console.error('[photos-settings] fetchScanInterval', e)
+    }
+  }
+
+  async function setScanInterval(minutes: number): Promise<boolean> {
+    const prev = scanIntervalMinutes.value
+    scanIntervalMinutes.value = minutes
+    try {
+      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
+      const watchDirs = (cfg?.watchDirs as string[] | undefined) ?? []
+      const retention = cfg?.retentionDays as number | undefined
+      await service.photos.updateConfig(watchDirs, retention, undefined, { scanInterval: minutes })
+      return true
+    } catch (e) {
+      scanIntervalMinutes.value = prev
+      console.error('[photos-settings] setScanInterval', e)
+      return false
+    }
+  }
+
+  // 取数失败保守默认(0),失败已 console.error 登记;动作类(pruneCache/triggerScan/
+  // reclusterFaces/rebuildIndex 非 409 分支)失败**向上抛**,视图层负责弹 toast,
+  // 与 Vue2 各动作方法里 showToast 的位置一致(store 只做数据/回滚,不做 UI 提示)。
+  async function pruneCache(): Promise<number> {
+    const res = (await service.photos.pruneCache()) as { freedBytes?: number } | null
+    return res?.freedBytes ?? 0
+  }
+
+  // 409 = 后端已有一个重建在跑。Vue2 PhotosSettings.vue:458-473 此时 dispatch 一次
+  // 'photos/fetchTasks'(一次性刷新,不是新轮询)、再在本地任务列表里找
+  // type==='rebuild' 的那条绑定显示进度,**不报错**。这里同样调用 timeline store 现成的
+  // fetchTasks() 一次并读它的 tasks —— "不要另建一份任务轮询" 指的是不要在本 store 里再起
+  // 一个 setInterval/poller,消费 timeline 已有的刷新动作和状态不算违反。useTimelineStore()
+  // 必须在 action 内部调用(而非模块顶层),否则在 Pinia 激活前调用会报错。
+  async function rebuildIndex(): Promise<string> {
+    try {
+      const res = (await service.photos.rebuildIndex()) as { taskId?: string } | null
+      return res?.taskId ?? ''
+    } catch (e) {
+      const status = (e as { response?: { status?: number } })?.response?.status
+      if (status === 409) {
+        const timeline = useTimelineStore()
+        await timeline.fetchTasks()
+        const running = timeline.tasks.find(t => t.type === 'rebuild')
+        return running?.id != null ? String(running.id) : ''
+      }
+      throw e
+    }
+  }
+
+  async function triggerScan(): Promise<boolean> {
+    await service.photos.triggerScan()
+    return true
+  }
+
+  async function reclusterFaces(): Promise<boolean> {
+    await service.photos.reclusterFaces()
+    return true
+  }
+
+  function reset(): void {
+    aiFeatures.value = { ...ALL_ON }
+    aiFeaturesLoaded.value = false
+    storage.value = null
+    storageError.value = false
+    about.value = null
+    retentionDays.value = 30
+    scanIntervalMinutes.value = 1440
+  }
+
+  return {
+    aiFeatures,
+    aiFeaturesLoaded,
+    storage,
+    storageError,
+    about,
+    retentionDays,
+    scanIntervalMinutes,
+    fetchAiFeatures,
+    setAiFeature,
+    fetchStorage,
+    fetchAbout,
+    fetchRetention,
+    setRetention,
+    fetchScanInterval,
+    setScanInterval,
+    pruneCache,
+    rebuildIndex,
+    triggerScan,
+    reclusterFaces,
+    reset,
+  }
+})
diff --git a/src/photos/stores/timeline.ts b/src/photos/stores/timeline.ts
index 1110ce8..6493680 100644
--- a/src/photos/stores/timeline.ts
+++ b/src/photos/stores/timeline.ts
@@ -44,20 +44,33 @@ function emptyIndexStatus(): IndexStatus {
     diskAvail: 0,
     mlReady: null,
   }
 }
 
 // Module-level poll timer (singleton by design, mirroring the Vue2 module-level
 // _pollTimer): survives across store-instance boundaries within one page
 // lifecycle, so __resetForTest() must clear it explicitly between tests.
 let _pollTimer: ReturnType<typeof setInterval> | null = null
 
+// P8a-T10(P1 挂账):照 Vue2 module-scope taskTimers + scheduleTaskRemove
+// (store/modules/photos.js:8,50-58)——done 任务的延迟移除计时器,按 id 去重(同 id 再次
+// 调度会先清掉旧的)。同样是模块级单例,__resetForTest() 必须显式清掉。
+const _doneRemovalTimers = new Map<string | number, ReturnType<typeof setTimeout>>()
+
+function _cancelDoneRemoval(id: string | number): void {
+  const t = _doneRemovalTimers.get(id)
+  if (t !== undefined) {
+    clearTimeout(t)
+    _doneRemovalTimers.delete(id)
+  }
+}
+
 export const useTimelineStore = defineStore('photos-timeline', () => {
   const timelineGroups = ref<TimelineGroup[]>([])
   const loading = ref(false)
   const indexStatus = ref<IndexStatus>(emptyIndexStatus())
   const tasks = ref<TaskBusPayload[]>([])
 
   const months = computed<Month[]>(() => timelineGroups.value.map(g => groupToMonth(g)))
   const allPhotos = computed(() => months.value.flatMap(m => m.photos))
   const isIndexing = computed(() => indexStatus.value.pending > 0 || indexStatus.value.queueLen > 0)
   const photoCount = computed(() => allPhotos.value.filter(p => !p.isVideo).length)
@@ -150,20 +163,39 @@ export const useTimelineStore = defineStore('photos-timeline', () => {
 
   function ingestTaskBus(evt: unknown) {
     const task = unwrapTaskBusPayload(evt)
     if (!task || !task.id) return
     const idx = tasks.value.findIndex(t => t.id === task.id)
     if (idx >= 0) {
       tasks.value.splice(idx, 1, { ...tasks.value[idx], ...task })
     } else {
       tasks.value.push(task)
     }
+
+    // P8a-T10(P1 挂账,照 Vue2 _onTaskBus store/modules/photos.js:1382-1402):非 index 类型
+    // 的 done 任务 5s 后自动从列表移除;running 事件说明任务复活,取消挂起的移除计时器。
+    // index 类型故意不接这套计时器——它由 fetchIndexStatus 的 idle 对账(:118-120,按后端
+    // pending/queueLen 真实进度收尾)负责摘除,两套机制同时管一种任务类型会变成任务列表的
+    // 第二个真相源(违反"不建第二个任务列表源"的约束)。Vue2 源里 index 其实也会走这个计时器
+    // (只在 face 任务已存在时才改成立即摘除),但 New-UI 早在 timeline.ts 落地 fetchIndexStatus
+    // 时就已经用 idle 对账取代了 index 的收尾路径,这里维持既有分工,不重新引入计时器竞争。
+    if (task.status === 'running') {
+      _cancelDoneRemoval(task.id)
+    } else if (task.status === 'done' && task.type !== 'index') {
+      _cancelDoneRemoval(task.id)
+      const id = task.id
+      const timer = setTimeout(() => {
+        _doneRemovalTimers.delete(id)
+        tasks.value = tasks.value.filter(t => t.id !== id)
+      }, 5000)
+      _doneRemovalTimers.set(id, timer)
+    }
   }
 
   async function deleteAssets(ids: string[]): Promise<number> {
     let successCount = 0
     for (const id of ids) {
       try {
         await service.photos.deleteAsset(id)
         successCount++
       } catch (e) {
         console.error('[photos-timeline] deleteAsset', id, e)
@@ -180,20 +212,22 @@ export const useTimelineStore = defineStore('photos-timeline', () => {
   // in this codebase would if they needed a test-only teardown hook.
   function resetState() {
     timelineGroups.value = []
     loading.value = false
     indexStatus.value = emptyIndexStatus()
     tasks.value = []
   }
 
   function __resetForTest() {
     stopIndexPoll()
+    for (const t of _doneRemovalTimers.values()) clearTimeout(t)
+    _doneRemovalTimers.clear()
     resetState()
   }
 
   return {
     timelineGroups,
     loading,
     indexStatus,
     tasks,
     months,
     allPhotos,
diff --git a/src/photos/util/__tests__/httpErrors.test.ts b/src/photos/util/__tests__/httpErrors.test.ts
index 1e045aa..7dce5f8 100644
--- a/src/photos/util/__tests__/httpErrors.test.ts
+++ b/src/photos/util/__tests__/httpErrors.test.ts
@@ -21,11 +21,18 @@ describe('isConflict', () => {
   it('response.status 非 409 → false', () => {
     const err = Object.assign(new Error('bad request'), { response: { status: 400 } })
     expect(isConflict(err)).toBe(false)
   })
 
   it('非对象/null/undefined → false(不假设异常形状,避免二次抛错)', () => {
     expect(isConflict(null)).toBe(false)
     expect(isConflict(undefined)).toBe(false)
     expect(isConflict('plain string error')).toBe(false)
   })
+
+  it('P8a-T10:词边界对齐 isNotFound —— 不把 4090 / 1409 误判成 409', () => {
+    expect(isConflict(new Error('code 4090'))).toBe(false)
+    expect(isConflict(new Error('req 1409 failed'))).toBe(false)
+    expect(isConflict(new Error('HTTP 409'))).toBe(true)
+    expect(isConflict(Object.assign(new Error('x'), { response: { status: 409 } }))).toBe(true)
+  })
 })
diff --git a/src/photos/util/httpErrors.ts b/src/photos/util/httpErrors.ts
index 6bb713a..d856155 100644
--- a/src/photos/util/httpErrors.ts
+++ b/src/photos/util/httpErrors.ts
@@ -5,31 +5,31 @@
 // 判断 409(重名):`e?.response?.status === 409` 或 message 含 409——对未知形状的异常安全,
 // 不假设 e 一定带 response/message,避免二次抛错。message 兜底是 T5 修过的既有行为,原样保留
 // (不是新加的宽松化)。
 export function isConflict(e: unknown): boolean {
   if (!e || typeof e !== 'object') return false
   const response = (e as { response?: unknown }).response
   if (response && typeof response === 'object' && (response as { status?: unknown }).status === 409) {
     return true
   }
   const message = (e as { message?: unknown }).message
-  return /409/.test(String(message ?? ''))
+  return /\b409\b/.test(String(message ?? ''))
 }
 
 // Task 14(SP7-P5 人物):404 判定,与 isConflict 同一套形状容忍策略。
 // 唯一用途是「设为关键照片」——后端用 404 专门表达"这张照片里没有这个人的脸",
 // 需要与其它失败区分成两句不同文案(照 Vue2 PhotosPersonDetail.vue:656-660)。
-// 终审 Minor 14:原注释说"与 isConflict 保持同一风格"是**不实的** —— 两者刻意不同:
-//   isConflict 用裸 /409/(无词边界),isNotFound 用 /\b404\b/(有词边界)。
-// 有边界的这条更严:它不会把 4040 / 1404 / "x-404y" 这类含 404 的字串误判成 404。
-// 方向对的是 isNotFound;isConflict 的宽松是既有行为,收紧它会改变 T5/T7/T8 三处已上线的
-// 「相册重名」判定,超出本期范围 —— 记账留后续,这里只把注释改成如实描述,不动 isConflict。
-// 形状容忍策略(不假设 e 一定带 response/message)两者一致,那部分确实同款。
+// P8a-T10:isConflict 已加词边界(`/\b409\b/`),与本函数的 `/\b404\b/` 对齐——两者都不会把
+// 4090/1409/4040/1404 这类含 409/404 的字串误判成冲突/未找到。回源实测 isConflict 的 live
+// 调用点有 5 处(AlbumPickerDialog.vue:143、PhotosFavorites.vue:114、PhotosAlbumDetail.vue:204、
+// PhotosPersonDetail.vue:484、PhotosAlbums.vue:145),均为「message 兜底」分支的收紧,不影响
+// `response.status === 409` 主判定路径。形状容忍策略(不假设 e 一定带 response/message)两者
+// 一致,那部分确实同款。
 export function isNotFound(e: unknown): boolean {
   if (!e || typeof e !== 'object') return false
   const response = (e as { response?: unknown }).response
   if (response && typeof response === 'object' && (response as { status?: unknown }).status === 404) {
     return true
   }
   const message = (e as { message?: unknown }).message
   return /\b404\b/.test(String(message ?? ''))
 }
diff --git a/src/photos/util/storagePalette.ts b/src/photos/util/storagePalette.ts
new file mode 100644
index 0000000..56ad0a0
--- /dev/null
+++ b/src/photos/util/storagePalette.ts
@@ -0,0 +1,65 @@
+// SP7-P8a-T3: 存储条的分段调色板 + 纯格式化函数。照 D5 / PLACE_PALETTE(P5-T12)/
+// placesMapThemes.ts(P6a)/ --badge-photo 等(P7a-T15)的既定先例:**数据可视化调色板**
+// 归 docs/THEMING.md 第0约定第三类例外 —— photos/thumbs 两段直接引用既有语义 token,
+// 其余三段(videos/raw/ai)与 other 段是 Vue2 内联的、与主题皮肤无关的分类识别色,值落在
+// theme.css 的具名 token 里(同 --badge-* 的落地方式,不是散落在 <style> 块里的字面量,
+// 也不是本 .ts 文件里的字面量——那样会在两套主题间失去"跟随皮肤微调对比度"的能力)。
+//
+// 「palette」这个文件名承载的不只是调色板——fmtGB/fmtBytes/buildBreakdown 三个格式化/
+// 分段纯函数也放在这里,是任务文件结构的既定安排(task-3-brief.md),不要拆文件。
+export const STORAGE_SEG_COLORS = {
+  photos: 'var(--accent)',
+  videos: 'var(--photos-seg-video)',
+  raw: 'var(--photos-seg-raw)',
+  thumbs: 'var(--success)',
+  ai: 'var(--photos-seg-ai)',
+  other: 'var(--photos-seg-other)',
+} as const
+
+export type StorageSegKey = keyof typeof STORAGE_SEG_COLORS
+
+export interface StorageSeg { key: StorageSegKey; gb: number; color: string }
+
+export interface StorageBytes {
+  photosBytes: number
+  videosBytes: number
+  rawBytes: number
+  cacheBytes: number
+  aiBytes: number
+}
+
+// Vue2 PhotosSettings.vue:382
+export function fmtGB(g: number): string {
+  return g >= 100 ? g.toFixed(0) : g.toFixed(1)
+}
+
+// Vue2 PhotosSettings.vue:405-413
+const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const
+export function fmtBytes(b: number): string {
+  if (!b || b <= 0) return '0 B'
+  let i = 0
+  let v = b
+  while (v >= 1024 && i < BYTE_UNITS.length - 1) {
+    v /= 1024
+    i++
+  }
+  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${BYTE_UNITS[i]}`
+}
+
+// Vue2 PhotosSettings.vue:313-330 —— 段序固定;other 段只在「已用总量减去已知段合计」
+// 严格大于 0.05 GB 时追加(小于这个量的零头不值得画一段)。
+const OTHER_THRESHOLD_GB = 0.05
+export function buildBreakdown(bytes: StorageBytes, usedGB: number): StorageSeg[] {
+  const gb = (b: number): number => Math.max(0, b) / 1024 ** 3
+  const segs: StorageSeg[] = [
+    { key: 'photos', gb: gb(bytes.photosBytes), color: STORAGE_SEG_COLORS.photos },
+    { key: 'videos', gb: gb(bytes.videosBytes), color: STORAGE_SEG_COLORS.videos },
+    { key: 'raw', gb: gb(bytes.rawBytes), color: STORAGE_SEG_COLORS.raw },
+    { key: 'thumbs', gb: gb(bytes.cacheBytes), color: STORAGE_SEG_COLORS.thumbs },
+    { key: 'ai', gb: gb(bytes.aiBytes), color: STORAGE_SEG_COLORS.ai },
+  ]
+  const known = segs.reduce((a, s) => a + s.gb, 0)
+  const other = Math.max(0, usedGB - known)
+  if (other > OTHER_THRESHOLD_GB) segs.push({ key: 'other', gb: other, color: STORAGE_SEG_COLORS.other })
+  return segs
+}
diff --git a/src/router/index.ts b/src/router/index.ts
index b51b9a5..f4ec513 100644
--- a/src/router/index.ts
+++ b/src/router/index.ts
@@ -25,20 +25,21 @@ import PhotosFavorites from '../views/PhotosFavorites.vue'
 import PhotosTrash from '../views/PhotosTrash.vue'
 import PhotosAlbums from '../views/PhotosAlbums.vue'
 import PhotosAlbumDetail from '../views/PhotosAlbumDetail.vue'
 import PhotosPeople from '../views/PhotosPeople.vue'
 import PhotosPersonDetail from '../views/PhotosPersonDetail.vue'
 import PhotosPlaces from '../views/PhotosPlaces.vue'
 import PhotosPlaceAssets from '../views/PhotosPlaceAssets.vue'
 import PhotosSmartViews from '../views/PhotosSmartViews.vue'
 import PhotosSmartViewDetail from '../views/PhotosSmartViewDetail.vue'
 import PhotosSearch from '../views/PhotosSearch.vue'
+import PhotosSettings from '../views/PhotosSettings.vue'
 import { authGuard } from './guard'
 
 const routes: RouteRecordRaw[] = [
   { path: '/', name: 'home', component: Home },
   { path: '/files', name: 'files', component: Files },
   { path: '/files/shares', name: 'files-shares', component: SharesPage },
   { path: '/files/drop', name: 'files-drop', component: DropPage },
   { path: '/apps', name: 'apps', component: InstalledAppsPage },
   { path: '/apps/store', name: 'apps-store', component: StorePage },
   { path: '/apps/store/:id', name: 'apps-store-detail', component: StoreAppDetailPage },
@@ -61,20 +62,23 @@ const routes: RouteRecordRaw[] = [
   { path: '/photos/trash', name: 'photos-trash', component: PhotosTrash },
   { path: '/photos/albums', name: 'photos-albums', component: PhotosAlbums },
   { path: '/photos/albums/:id', name: 'photos-album-detail', component: PhotosAlbumDetail },
   { path: '/photos/people', name: 'photos-people', component: PhotosPeople },
   { path: '/photos/people/:id', name: 'photos-person-detail', component: PhotosPersonDetail },
   { path: '/photos/places', name: 'photos-places', component: PhotosPlaces },
   { path: '/photos/places/:key', name: 'photos-place-assets', component: PhotosPlaceAssets },
   { path: '/photos/smart-views', name: 'photos-smart-views', component: PhotosSmartViews },
   { path: '/photos/smart-views/:id', name: 'photos-smart-view-detail', component: PhotosSmartViewDetail },
   { path: '/photos/search', name: 'photos-search', component: PhotosSearch },
+  // SP7-P8a-T5:只追加,不重排——须排在最后一条既有 /photos/* 之后(router/index.test.ts
+  // 用 node:fs 读源文本行序断言,而非 router.getRoutes(),见该测试文件注释)。
+  { path: '/photos/settings', name: 'photos-settings', component: PhotosSettings },
   { path: '/login', name: 'login', component: Login, meta: { public: true } },
   { path: '/welcome', name: 'welcome', component: Welcome, meta: { public: true } },
 ]
 
 export const router = createRouter({
   history: createWebHashHistory('/app/'),
   routes,
 })
 
 // 正常登录逻辑(无探针):见 guard.ts。无 token 时查一次 status 分流 login/welcome。
diff --git a/src/styles/theme.css b/src/styles/theme.css
index 234f322..4653f6e 100644
--- a/src/styles/theme.css
+++ b/src/styles/theme.css
@@ -156,20 +156,37 @@
   /* SP7-P7a-T15:搜索结果卡片左上角媒体类别徽标(.type-badge[data-type])三色——
      数据可视化类别色（THEMING.md §0 第三类例外的变体：同一批结果里要把"照片/视频/
      OCR 命中"这三种互不相同的类别互相区分开，颜色语义是"第几类"而非"主题强调色"）。
      精确复刻 Vue2 photos.scss:2768-2770 的字面量,两套主题块同值——不随皮肤深浅走,
      同 --place-current-trip/--console-bg 的既有先例(同类先例见 THEMING.md §6)。
      不用 --accent/--danger 就近凑:它们是三个并列的类别标识,不是"强调"或"危险"语义。 */
   --badge-photo: rgba(50, 190, 230, 0.9);   /* 青 cyan */
   --badge-video: rgba(255, 149, 10, 0.92);  /* 橙 orange */
   --badge-ocr: rgba(16, 185, 129, 0.92);    /* 翠绿 emerald */
 
+  /* SP7-P8a-T3:设置页存储卡容量条分段色(PhotosStorageCard.vue,消费于
+     src/photos/util/storagePalette.ts 的 STORAGE_SEG_COLORS)——同上一组一样是**数据可视化
+     类别色**:同一条容量条上要把 videos/raw/ai/other 四个互不相同的数据段互相区分开,
+     颜色语义是"第几类数据"而不是"主题强调色"。photos 段用 --accent、thumbs 段用 --success
+     (既有语义 token 直接复用,不新增),这四个是 Vue2 内联的、本仓无对应语义 token 的字面量,
+     故新增。深色精确复刻 Vue2 PhotosSettings.vue:320/321/323 的字面量;浅色不能照抄深色值——
+     videos 的中蓝、raw 的浅粉柔和色铺在本主题纯白 --card-bg 上会偏灰、分段边界糊掉,故各自
+     加深/提高饱和度保持在白底上可辨识(同 --warn-fg 浅色把 #FF9F0A 压成 #96610a 保对比度的
+     既定手法,但这里是三个并列的类别色而非单一警告语义,故各给独立值而非借用 --warn-fg)。 */
+  --photos-seg-video: #5e94ff;
+  --photos-seg-raw: #ff9ac2;
+  --photos-seg-ai: #ff9f0a;
+  /* other 段 Vue2 原值是 rgba(var(--ink),0.25)("跟随文字色的透明度斜坡"),本仓无 --ink
+     三元组 token——同 --zb-hover-bg/--zb-track-bg 的既定换基先例:alpha 精确复刻 0.25,
+     RGB 改取本仓 --fg 的真实分解值(dark #ffffff→255,255,255)。 */
+  --photos-seg-other: rgba(255, 255, 255, 0.25);
+
   /* P6 终端/日志控制台(终端语义固定深色,不随主题翻转;两套主题块同值,与 Vue2 旧实现一致) */
   --console-bg: #1e1e1e;
   --console-fg: #d4d4d4;
   /* 固定深底区域(monokai 编辑器/日志/终端)的滚动条拇指:全局滚动条颜色随主题翻转,
      浅色主题下会变成深拇指、落在这些固定深底上不可见——故单独给亮色拇指,两套主题同值 */
   --console-scroll-thumb: rgba(255, 255, 255, 0.32);
   --console-scroll-thumb-hover: rgba(255, 255, 255, 0.5);
 
   /* 时间机器覆盖层。跟随主题(用户拍板):深色是深空,浅色是纸感 —— 两套各自成立,
      不是一套深色硬塞进浅色主题里。 */
@@ -431,20 +448,37 @@
      故前景压到深琥珀(同 --dem-fg 的 #92600c 一档),底/描边给纸感主题的实色。 */
   --warn-fg: #96610a;
   --warn-bg: #fdf3e2;
   --warn-border: #f0d7a6;
 
   /* SP7-P7a-T15:同 :root 同名注释——三个媒体类别徽标色,两套主题块同值,不随皮肤翻转。 */
   --badge-photo: rgba(50, 190, 230, 0.9);
   --badge-video: rgba(255, 149, 10, 0.92);
   --badge-ocr: rgba(16, 185, 129, 0.92);
 
+  /* SP7-P8a-T3:同 :root 同名注释——存储卡容量条分段色。浅色主题按可读性微调(不是照抄
+     Vue2 唯一深色设计的原值):
+     --photos-seg-video 从 Vue2 的中蓝 #5e94ff 加深到 #3560d8——纸感白底 --card-bg(#ffffff)
+     上原值发灰、和相邻分段边界不够清楚,加深/提高饱和度后仍是同一色相的蓝。
+     --photos-seg-raw 从 Vue2 的浅粉 #ff9ac2 加深到 #c93f79——浅粉铺在纯白底上几乎融进背景,
+     压深成同色相的玫红以保证分段轮廓可辨。
+     --photos-seg-ai 从 Vue2 的橙 #ff9f0a 压到 #a15f0a——同 --warn-fg 浅色档处理同一个字面量
+     色值的既定手法(压暗保对比度),但这里是独立的类别标识 token,不直接借用 --warn-fg
+     (那是"警告"语义,这里是"第几类数据"语义,同一个字面量色值、两个不同的 token)。 */
+  --photos-seg-video: #3560d8;
+  --photos-seg-raw: #c93f79;
+  --photos-seg-ai: #a15f0a;
+  /* alpha 与 :root 同为 0.25(精确复刻 Vue2 other 段 rgba(var(--ink),0.25)),RGB 换成本仓
+     浅色 --fg 的真实分解值(#1c1b19→28,27,25)——同 --zb-hover-bg/--zb-track-bg 浅色档的既定
+     换基公式。 */
+  --photos-seg-other: rgba(28, 27, 25, 0.25);
+
   /* P6 终端/日志控制台(终端语义固定深色,不随主题翻转;两套主题块同值,与 Vue2 旧实现一致) */
   --console-bg: #1e1e1e;
   --console-fg: #d4d4d4;
   /* 固定深底区域(monokai 编辑器/日志/终端)的滚动条拇指:全局滚动条颜色随主题翻转,
      浅色主题下会变成深拇指、落在这些固定深底上不可见——故单独给亮色拇指,两套主题同值 */
   --console-scroll-thumb: rgba(255, 255, 255, 0.32);
   --console-scroll-thumb-hover: rgba(255, 255, 255, 0.5);
 
   /* 时间机器 —— 浅色纸感:没有星空(--tm-star 透明),背景是米白 + 极淡光晕 */
   --tm-bg:
diff --git a/src/views/Photos.vue b/src/views/Photos.vue
index c9470a1..f1a78d9 100644
--- a/src/views/Photos.vue
+++ b/src/views/Photos.vue
@@ -25,36 +25,39 @@ import { useRouter } from 'vue-router'
 import AreaShell from '../components/shell/AreaShell.vue'
 import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
 import PhotosSearchBar from '../photos/components/PhotosSearchBar.vue'
 import PhotosToolbar from '../photos/components/PhotosToolbar.vue'
 import PhotosGrid from '../photos/components/PhotosGrid.vue'
 import PhotosSelectionToolbar from '../photos/components/PhotosSelectionToolbar.vue'
 import AlbumPickerDialog from '../photos/components/AlbumPickerDialog.vue'
 import PhotosFilterBar, { type ExifFilterValue } from '../photos/components/PhotosFilterBar.vue'
 import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
 import { useLightbox } from '../photos/lightbox/useLightbox'
+import { usePhotosDeepLinks } from '../photos/composables/usePhotosDeepLinks'
 import { useTimelineStore } from '../photos/stores/timeline'
 import { usePhotosFavorites } from '../photos/stores/favorites'
 import { useToast } from '../stores/toast'
 import { useMessageBus } from '../composables/useMessageBus'
 import { unwrapTaskBusPayload, type TaskBusPayload } from '../photos/util/taskBus'
 import { createTaskDoneCoalescer } from '../photos/util/taskDoneCoalescer'
 import { matchesTab } from '../photos/util/tabFilter'
 import { applyExifFilters } from '../photos/util/photosFilterUtils'
 import type { Photo } from '../photos/util/assetToPhoto'
 
 const { t } = useI18n()
 const router = useRouter()
 const store = useTimelineStore()
 const toast = useToast()
 const bus = useMessageBus()
 const lb = useLightbox()
+// Task 7(P8a):深链 ?asset / ?photoset——composable 内部自行 onMounted,这里只挂一次。
+usePhotosDeepLinks()
 
 // Default tab: aligned with Vue2 NimoOS-UI src/views/Photos/PhotosTimeline.vue's
 // `data() { tab: 'photo' }` — 'all' was an unsanctioned drift introduced during
 // the port (SP7-P1 review finding), sanctioned fix.
 const tab = ref('photo')
 const density = ref('comfortable')
 const selected = ref<Array<string | number>>([])
 
 // P7b-T4:EXIF 筛选态。照 Vue2 PhotosTimeline.vue:116 的 activeFilters,但只保留三个
 // facet 键——Vue2 那个对象上还挂着 placeKey/spotKey 两个 spot 跳转用的键,New-UI 的
@@ -147,28 +150,37 @@ function messageFor(task: TaskBusPayload): string | null {
 const doneCoalescer = createTaskDoneCoalescer<TaskBusPayload>({
   messageFor,
   // 4000ms, aligned with Vue2's task-done toast duration (NimoOS-UI
   // src/views/Photos/PhotosTimeline.vue:329 `$buefy.toast.open({..., duration: 4000})`).
   emit: (message) => toast.show(message, 4000),
 })
 
 // Ingest-time done-transition detection: capture whether this task was
 // already 'done' before the store merges the new event in, so a task that
 // stays 'done' across repeated events (or re-ingests) is only announced once.
-// 已知边界——fetchIndexStatus 的 idle 对账会移除 index 任务,若其后迟到重复
-// done 事件会二次 toast;P8 任务条落地时与 scheduleTaskRemove 一并收口。
+// P8a-T10 修:原先用 `store.tasks.find(...).status === 'done'` 判断"是否已经宣布过"——
+// fetchIndexStatus 的 idle 对账(timeline.ts:118-120)会把 done 的 index 任务从
+// store.tasks 里摘掉,若之后又收到一条迟到的重复 done 事件,find 返回 undefined,
+// 旧判断误判成"没宣布过"从而二次 toast。改用一个不依赖任务是否还在列表里的 id 集合:
+// 一旦某个 id 被宣布过就记住,直到它以 running 状态"复活"(同 id 复用于新一轮任务)才
+// 允许再宣布一次——与 store 侧 5s 过期计时器的"running 取消计时器"同一条重置信号。
+const announcedTaskIds = new Set<string | number>()
+
 function onTaskProgress(_props: unknown, raw: unknown) {
   const payload = unwrapTaskBusPayload(raw)
   if (!payload || payload.id == null) return
-  const wasDone = store.tasks.find((task) => task.id === payload.id)?.status === 'done'
+  if (payload.status === 'running') {
+    announcedTaskIds.delete(payload.id)
+  }
   store.ingestTaskBus(raw)
-  if (payload.status === 'done' && !wasDone) {
+  if (payload.status === 'done' && !announcedTaskIds.has(payload.id)) {
+    announcedTaskIds.add(payload.id)
     const merged = store.tasks.find((task) => task.id === payload.id) || payload
     doneCoalescer.push(merged)
   }
 }
 
 // Socket.io reconnects (initial connect too) can miss task.progress events
 // while disconnected; re-sync on every 'connect' (Vue2 PhotosTimeline:78-82).
 function onSocketConnect() {
   void store.fetchTasks()
   void store.fetchIndexStatus()
diff --git a/src/views/PhotosAlbumDetail.vue b/src/views/PhotosAlbumDetail.vue
index bbb0a1f..8f5ea13 100644
--- a/src/views/PhotosAlbumDetail.vue
+++ b/src/views/PhotosAlbumDetail.vue
@@ -209,20 +209,37 @@ async function commitTitle(): Promise<void> {
 }
 
 // Minor 修正:同 PhotosAlbums.vue:85-87 的具名函数写法,把导航调用从模板内联表达式挪出来——
 // 模板里内联 `@click="router.push(...)"` 会把返回的 promise 挂在事件处理器上不管,导航被
 // 取消/重复时 reject 没人接住(vue-router 的已知坑,console 会打未捕获 rejection);这里额外
 // 加 `void` 显式标记"不关心其 resolve/reject"。
 function goToAlbumsList(): void {
   void router.push('/photos/albums')
 }
 
+// Task 9(P8a,P4 遗留收口):fetchAlbums 失败时 albumsLoaded 保持假(见 albums.ts 注释,
+// 刻意不变),旧实现下 `!album && !albums.albumsLoaded` 因此恒真 → 永久停在骨架屏。新增
+// loadError 分支(见模板,优先级在骨架分支之前)+ 这个重试入口,直接重新调用同一个 fetch。
+// 评审 Important 1 修正:本地 retrying 守卫——fetchAlbums 只在成功时才清 loadError
+// (见 albums.ts 同批修正注释),所以按钮本身不再需要靠"清空态"给用户即时反馈;这个 ref
+// 补上这份反馈(disabled),同时顺带堵住连点两次重试派发两个并发 fetch 的口子。
+const retryingAlbums = ref(false)
+async function retryAlbums(): Promise<void> {
+  if (retryingAlbums.value) return
+  retryingAlbums.value = true
+  try {
+    await albums.fetchAlbums()
+  } finally {
+    retryingAlbums.value = false
+  }
+}
+
 // ── Hero:编辑态/⋯菜单 ──
 function toggleEditMode(): void {
   edit.value = !edit.value
   if (!edit.value) selected.value.clear()
 }
 function askConfirmDelete(): void {
   menuOpen.value = false
   confirmDelete.value = true
 }
 
@@ -346,22 +363,36 @@ watch([edit, sortBy], () => {
 watch(gridRef, () => {
   void nextTick(() => drag.refresh())
 })
 </script>
 
 <template>
   <AreaShell :title="album ? album.title : t('photosAlbumsTitle')">
     <div class="photos-layout">
       <PhotosSidebar />
       <main class="photos-main">
+        <!-- Task 9(P4 遗留收口):失败态优先级在骨架分支之前——loadError 一旦为真,
+             albumsLoaded 仍是假(刻意,见 albums.ts 注释),不该再落进骨架分支永久显示
+             "正在加载"。 -->
+        <div v-if="albums.loadError" class="empty-state" data-test="album-load-error">
+          <div class="empty-state-title">{{ t('photosAlbumLoadFailed') }}</div>
+          <button
+            type="button"
+            class="bar-btn"
+            data-test="album-retry"
+            :disabled="retryingAlbums"
+            @click="retryAlbums"
+          >{{ t('photosRetry') }}</button>
+        </div>
+
         <!-- 还没加载完:骨架 -->
-        <div v-if="!album && !albums.albumsLoaded" class="album-loading" data-test="album-loading">
+        <div v-else-if="!album && !albums.albumsLoaded" class="album-loading" data-test="album-loading">
           <div class="album-hero album-hero-skeleton"></div>
         </div>
 
         <!-- 加载完了确实没有:New-UI 补齐项 -->
         <div v-else-if="notFound" class="empty-state" data-test="album-not-found">
           <div class="empty-state-title">{{ t('photosAlbumNotFoundTitle') }}</div>
           <div class="empty-state-desc">{{ t('photosAlbumNotFoundHint') }}</div>
           <button
             type="button"
             class="bar-btn"
diff --git a/src/views/PhotosFavorites.vue b/src/views/PhotosFavorites.vue
index 6854299..aa7eba9 100644
--- a/src/views/PhotosFavorites.vue
+++ b/src/views/PhotosFavorites.vue
@@ -140,20 +140,38 @@ async function onBatchDelete(ids: Array<string | number>) {
   selected.value = []
   await fav.fetchFavorites()
 }
 
 function onOpenTile(photo: Photo, _list: undefined, startMs: number) {
   // 翻页集 = tab 过滤后的收藏集(与所见一致,和下方 PhotosToolbar 计数同一份数据源/谓词)。
   const filtered = fav.favoritesMonths.flatMap((m) => m.photos).filter((p) => matchesTab(p, tab.value))
   lb.openAt(photo, filtered, startMs)
 }
 
+// Task 9(P8a,P3 遗留收口):fetchFavorites 失败时 favoritesLoaded 保持假(见
+// favorites.ts 注释,刻意不变),旧实现下 isEmpty 因此恒假 → 落进下面的 v-else 渲染一个
+// 空网格,没有任何失败提示。新增 loadError 分支(见模板,优先级在 isEmpty 之前)+ 这个重试
+// 入口,直接重新调用同一个 fetch。
+// 评审 Important 1 修正:本地 retrying 守卫——fetchFavorites 只在成功时才清 loadError
+// (见 favorites.ts 同批修正注释),所以按钮本身不再需要靠"清空态"给用户即时反馈;这个
+// ref 补上这份反馈(disabled),同时顺带堵住连点两次重试派发两个并发 fetch 的口子。
+const retryingFavorites = ref(false)
+async function retryFavorites(): Promise<void> {
+  if (retryingFavorites.value) return
+  retryingFavorites.value = true
+  try {
+    await fav.fetchFavorites()
+  } finally {
+    retryingFavorites.value = false
+  }
+}
+
 function onExport() {
   fav.exportZip()
   toast.show(t('photosFavExporting'), 4000)
 }
 
 async function onLightboxDelete(id: string | number) {
   // 灯箱已在用户确认删除时自行 close(PhotoLightbox.vue doDelete),这里不重复关闭。
   await store.deleteAssets([String(id)])
   toast.show(t('photosDeletedToast', { count: 1 }), 4000)
   void fav.fetchFavorites()
@@ -180,21 +198,33 @@ onMounted(() => {
           <button
             type="button"
             class="fav-save-album"
             data-test="fav-save-album-btn"
             :disabled="!(fav.favoritesList?.length)"
             @click="openSaveAlbum"
           >{{ t('photosFavSaveAlbum') }}</button>
           <span class="fav-count">{{ t('photosFavCount', { count: fav.favoritesList?.length ?? 0 }) }}</span>
         </div>
 
-        <div v-if="isEmpty" class="empty-state" data-test="fav-empty">
+        <!-- Task 9(P3 遗留收口):失败态优先级在空态之前——loadError 一旦为真,就不该
+             再落进(旧代码里恒假的)isEmpty 分支渲染一个没有任何提示的空网格。 -->
+        <div v-if="fav.loadError" class="empty-state" data-test="fav-load-error">
+          <div class="empty-state-title">{{ t('photosFavoritesLoadFailed') }}</div>
+          <button
+            type="button"
+            class="bar-btn"
+            data-test="fav-retry"
+            :disabled="retryingFavorites"
+            @click="retryFavorites"
+          >{{ t('photosRetry') }}</button>
+        </div>
+        <div v-else-if="isEmpty" class="empty-state" data-test="fav-empty">
           <div class="empty-state-title">{{ t('photosFavEmptyTitle') }}</div>
           <div class="empty-state-desc">{{ t('photosFavEmptyHint') }}</div>
         </div>
         <template v-else>
           <!-- Task 15A: hero 统计三卡 —— 照 Vue2 PhotosFavoritesView.vue:56-84,只在非空分支渲染
                (Vue2 :47-53/:54 的 v-if/v-else,空态整页走别的分支,三卡不渲染)。 -->
           <div class="fav-stats">
             <div class="fav-stat-card">
               <div class="label">{{ t('photosFavStatTopPerson') }}</div>
               <div class="value">{{ byPerson[0] ? byPerson[0][0] : '—' }}</div>
@@ -359,16 +389,19 @@ onMounted(() => {
 .favsave-note { font-size: 11.5px; color: var(--fg-muted); margin-top: 10px; line-height: 1.5; }
 .favsave-foot { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }
 .favsave-btn-ghost { padding: 8px 16px; border-radius: 9px; border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); font: inherit; font-size: 13px; cursor: pointer; }
 .favsave-btn-ghost:hover { background: var(--chip-bg-hi); }
 .favsave-btn-cta { padding: 8px 18px; border-radius: 9px; border: 0; background: var(--accent); color: var(--on-accent); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
 .favsave-btn-cta:disabled { opacity: 0.5; cursor: not-allowed; }
 
 .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 80px 20px; color: var(--fg-muted); text-align: center; }
 .empty-state-title { font-size: 16px; font-weight: 600; color: var(--fg); }
 .empty-state-desc { font-size: 13px; }
+/* 评审 Take-along:与 PhotosAlbumDetail.vue 的同款失败态间距对齐(该文件 .empty-state
+   .bar-btn 已有此规则),否则两个失败屏视觉不一致。 */
+.empty-state .bar-btn { margin-top: 10px; }
 
 /* ≤768px:侧栏已收抽屉(PhotosSidebar.is-drawer 脱离文档流),布局单列 */
 @media (max-width: 768px) {
   .photos-layout { gap: 0; }
 }
 </style>
diff --git a/src/views/PhotosPeople.vue b/src/views/PhotosPeople.vue
index f0eeca2..9298812 100644
--- a/src/views/PhotosPeople.vue
+++ b/src/views/PhotosPeople.vue
@@ -37,41 +37,42 @@
 //  6) 铁律:一切「当前项 === 循环项」「按 id 找对象」用 String 值比较,不用引用相等。
 //  7) Vue2 :97 在设置链接后硬编码了一个英文句点(中文界面下中西混排,且无法本地化)——
 //     不复制,详见该处行内注释。
 //
 // T3 漏掉的两条文案由协调者补给(zh_CN.json:2072 / :2079),已加进两个 locale 并照 Vue2 渲染:
 // photosPeopleMinScore(置信度下拉小标题,:24-26)、photosPeopleClusterHint(未命名卡片
 // 悬停提示,:204,连同 scss:242-243 的 .ct / .name-action 悬停互换一起补齐)。
 import { computed, onMounted, onUnmounted, ref } from 'vue'
 import { useI18n } from 'vue-i18n'
 import { useRouter } from 'vue-router'
-import { service } from '@nimotech/nimoos-service'
 import AreaShell from '../components/shell/AreaShell.vue'
 import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
 import PersonAvatar from '../photos/components/PersonAvatar.vue'
 import ClusterActionDialog from '../photos/components/ClusterActionDialog.vue'
 import MergeReviewDialog, { type MergeSuggestion } from '../photos/components/MergeReviewDialog.vue'
 import { usePhotosPeople } from '../photos/stores/people'
 import { useTimelineStore } from '../photos/stores/timeline'
+import { usePhotosSettingsStore } from '../photos/stores/settings'
 import { useToast } from '../stores/toast'
 import {
   mergeConfidencePct, mergeReasonKey, sortNamed, unnamedCountAt, type Person,
 } from '../photos/util/peopleView'
 
 type FilterId = 'all' | 'family' | 'friend' | 'work' | 'recent'
 type SortId = 'freq' | 'name' | 'recent' | 'oldest'
 type DialogMode = 'name' | 'merge' | 'delete'
 
 const { t, locale } = useI18n()
 const router = useRouter()
 const people = usePhotosPeople()
 const timeline = useTimelineStore()
+const settings = usePhotosSettingsStore()
 const toast = useToast()
 
 // Vue2 :448
 const CONFIDENCE_OPTIONS = [50, 60, 70, 80, 90, 95]
 
 // Vue2 data() :461-472。sort 刻意不持久化(照 Vue2);confidence/showSingletons 在 store 里持久化。
 const filter = ref<FilterId>('all')
 const sort = ref<SortId>('freq')
 const showUnnamed = ref(true)
 const confidenceOpen = ref(false)
@@ -88,23 +89,25 @@ const reviewIdx = ref(0)
 // 评审必修 2(第二轮,已删除 deletingSubmitting ref):删除路径原来也仿照这个形状加了
 // 一个独立的 `deletingSubmitting` ref,但评审做了删码验证——`onSubmitDelete` 全程没有
 // `await`(purgePersonWithUndo 同步返回 undo 闭包),函数体在一次 dispatchEvent 里跑完,
 // `dialog.value = null` 在函数体内**同步**发生,早于任何"守卫复位"的必要性。把这个 ref
 // 整段(声明/置位/finally 复位)删掉后,回归测试依然绿,因为挡住第二次调用的从来是
 // `onSubmitDelete` 开头的 `!dialog.value` 短路,不是这个 ref——ref 只是"标准形状"的
 // 装饰,没有实际保护价值。已在 fix 报告里记录这次删码验证的具体做法与结果,这里不再
 // 加回这个 ref。命名/合并两条路径的 async 守卫经评审确认确凿有效,不受影响。
 const namingSubmitting = ref(false)
 const mergingSubmitting = ref(false)
-// aiFeatures.faces 的临时来源:本仓没有 settings store(归 P8),onMounted 直接读一次
-// /photos/config。失败或字段缺失一律按 true(不显示警告横幅,宁可不吓用户)。
-const facesEnabled = ref(true)
+// P8a-T6(§7e-10):facesEnabled 曾经是本页自己 onMounted 直读一次 /photos/config 的临时
+// 实现(P8 归属前没有共享 store)。现在改读 T1 的 photosSettings store —— 语义不变:缺
+// 字段/请求失败一律按开启处理(不显示警告横幅,宁可不吓用户),这条防御性语义已经在
+// store.fetchAiFeatures() 里落实(readAiFeatures 的 `on()` 判据),这里只是消费,不重复实现。
+const facesEnabled = computed(() => settings.aiFeatures.faces)
 
 const confMenuRef = ref<HTMLElement | null>(null)
 const sortMenuRef = ref<HTMLElement | null>(null)
 const clusterMenuRef = ref<HTMLElement | null>(null)
 
 // 随 locale 热切换重新求值(照 PhotosAlbums.vue:52-60 的既有教训:computed 而非常量固化一份)。
 const sortOptions = computed(() => [
   { id: 'freq' as SortId, label: t('photosPeopleSortFreq'), hint: t('photosPeopleSortFreqHint') },
   { id: 'name' as SortId, label: t('photosPeopleSortName'), hint: t('photosPeopleSortNameHint') },
   { id: 'recent' as SortId, label: t('photosPeopleSortRecent'), hint: t('photosPeopleSortRecentHint') },
@@ -322,21 +325,23 @@ async function onSubmitName(name: string): Promise<void> {
 // (未捕获拒绝)。这里改成 await + 只在成功路径弹成功 toast;失败弹 photosPersonMergeFailed;
 // 无论成败都在 finally 关弹窗(照 brief:"finally 关弹窗 + 复位",合并这条不像命名那样让
 // 用户留在弹窗里重试——目标人物是从候选列表里点的,不是打字输入,失败重开菜单重新选更清楚)。
 async function onSubmitMerge(targetId: string | number): Promise<void> {
   if (!dialog.value || mergingSubmitting.value) return
   const fromId = dialog.value.person.id
   const targetName = people.personById(targetId)?.name ?? ''
   mergingSubmitting.value = true
   try {
     await people.mergePersonInto(fromId, targetId)
-    toast.show(t('photosPersonMergedToast', { name: targetName }))
+    // P8a-T10:与上方 confirmMergeTo(:266)同一兜底,目标未命名(或 personById 找不到)时不
+    // 渲染成「已合并到「」」。
+    toast.show(t('photosPersonMergedToast', { name: targetName || t('photosPersonMergeAsSame') }))
   } catch {
     toast.show(t('photosPersonMergeFailed'))
   } finally {
     dialog.value = null
     mergingSubmitting.value = false
   }
 }
 
 // 照 Vue2 confirmDelete :661-674,purgePersonWithUndo 同步返回 undo 闭包(不是 Promise,
 // 不 await)。评审必修 2:这条路径**不需要**独立的 in-flight 守卫 ref——函数体全程无
@@ -366,37 +371,27 @@ function onDocMousedown(e: MouseEvent): void {
   if (sortOpen.value && sortMenuRef.value && !sortMenuRef.value.contains(target)) sortOpen.value = false
   if (clusterMenu.value && clusterMenuRef.value && !clusterMenuRef.value.contains(target)) clusterMenu.value = null
 }
 function onDocKeydown(e: KeyboardEvent): void {
   if (e.key !== 'Escape') return
   if (clusterMenu.value) { clusterMenu.value = null; return }
   if (confidenceOpen.value) { confidenceOpen.value = false; return }
   if (sortOpen.value) sortOpen.value = false
 }
 
-async function loadFacesEnabled(): Promise<void> {
-  try {
-    const cfg = await service.photos.getConfig()
-    const ai = cfg?.aiFeatures as { faces?: unknown } | undefined
-    facesEnabled.value = ai?.faces !== false
-  } catch (e) {
-    // 失败按开启处理:宁可不显示警告,也不要因为一次配置读取抖动就吓用户。
-    console.error('[photos-people] getConfig', e)
-    facesEnabled.value = true
-  }
-}
-
 onMounted(() => {
   // Vue2 :526-527 每次进页面都重拉,不做 loaded 去重,照搬。
   void people.fetchPeople()
   void people.fetchMergeSuggestions()
-  void loadFacesEnabled()
+  // P8a-T6:改读共享 photosSettings store(§7e-10)。侧栏(PhotosSidebar,本页也挂载它)
+  // 同帧也会调用 fetchAiFeatures() —— 并发去重收在 settings.ts 里,这里不需要关心。
+  void settings.fetchAiFeatures()
   document.addEventListener('mousedown', onDocMousedown)
   document.addEventListener('keydown', onDocKeydown)
 })
 onUnmounted(() => {
   document.removeEventListener('mousedown', onDocMousedown)
   document.removeEventListener('keydown', onDocKeydown)
 })
 </script>
 
 <template>
diff --git a/src/views/PhotosPersonDetail.vue b/src/views/PhotosPersonDetail.vue
index 998d4e8..1e15937 100644
--- a/src/views/PhotosPersonDetail.vue
+++ b/src/views/PhotosPersonDetail.vue
@@ -410,21 +410,26 @@ function onSaveHero(): void {
 }
 
 // 6) 合并到他人(Vue2 confirmMerge :715-727)。
 // 守卫判断:弹窗在 finally 才关(await 之后),在途期间确认按钮可点 —— 守卫有防护价值。
 async function confirmMerge(): Promise<void> {
   const target = mergeTarget.value
   if (!target || !detail.person.value || merging.value) return
   merging.value = true
   try {
     await people.mergePersonInto(personId.value, target.id)
-    toast.show(t('photosPersonMergedToast', { name: target.name }))
+    // P8a-T10:与 PhotosPeople.vue 的合并 toast 同一兜底,目标未命名时不渲染成「已合并到「」」。
+    // 注:mergeCandidates(:184-188)只取 people.named,name.trim() 恒非空(偏离登记 J);
+    // target 又是候选点击时捕获的对象引用,confirm 前的任何 store 写(patchPerson/fetchPeople)
+    // 都是整体替换而非原地改,不会回写到这个引用上——按当前接线这条兜底分支不可达,纯防御性
+    // 补齐(与另外两处保持一致,防未来候选池放开到含未命名时悄悄回归空书名号)。
+    toast.show(t('photosPersonMergedToast', { name: target.name || t('photosPersonMergeAsSame') }))
     void router.push('/photos/people')            // Vue2 是 $emit('back')
   } catch {
     toast.show(t('photosPersonMergeFailed'))      // 偏离登记 H:停在当前页(照 Vue2)
   } finally {
     merging.value = false
     closeMerge()                                  // 成功失败都关(照 Vue2 :726)
   }
 }
 
 // 7) 删除人物(Vue2 confirmDeletePerson :959-972)。
diff --git a/src/views/PhotosPlaceAssets.vue b/src/views/PhotosPlaceAssets.vue
index 7ad2b37..597043b 100644
--- a/src/views/PhotosPlaceAssets.vue
+++ b/src/views/PhotosPlaceAssets.vue
@@ -117,20 +117,24 @@ function showWholeCity(): void {
 // `matchedSpot` 在"详情还没到位"(currentDetail 为 null)与"详情到位但确实没这个 spot"两种
 // 情形下的值**都是 null**——Vue 的 `watch` 对新旧值做 `hasChanged` 比较,null→null 判定为
 // 未变化,回调根本不会跑,降级就成了死代码(有对应的删码验证用例钉住)。watch 一个"确定会换
 // 新引用"的量,再在回调里读 matchedSpot.value,才能保证"详情从无到有"这一刻必然触发一次判断。
 watch(currentDetail, (d) => {
   if (d && spotKey.value && !matchedSpot.value) showWholeCity()
 })
 
 // ── 结构规格 6:网格 + 灯箱 ────────────────────────────────────────────────────
 // P7b-T5:EXIF 筛选态(同 T4 形状)。D19:只留年份/相机两个胶囊——见上方 import 处注释。
+// P8a-T10 挂账登记(只登记不改):`places` 这个 EXIF 维度在本页从未端到端贯通过——
+// PLACE_CHIP_KEYS 不含 'places' 故 UI 从不渲染/不产出这个胶囊,下面 gridMonths 也只投影
+// years/cameras 两个键给 applyExifFilters(:146-150)。exifFilter.places 恒为 []。P7b 只把
+// cameras 维度接通,places 维度的"未贯通"是本页刻意设计(见下方注释),不是遗漏。
 const exifFilter = ref<ExifFilterValue>({ years: [], places: [], cameras: [] })
 const PLACE_CHIP_KEYS = ['years', 'cameras'] as const
 
 // 不改 usePlaceAssets 的 months(那是 P6b 的组件,禁无关重构)——本页自己再算一份筛选后
 // 的月份分组,并丢掉空月份(同 T4 的理由:月份刻度尺读的是未按标签页过滤的 months,这里
 // 同理不读 assets.months.value,自己对 assets.photos.value 先筛再分组)。
 //
 // fix round 1 Minor 1(评审):这里的调用顺序是「先筛后分组」——groupPhotosByMonth
 // (util/groupPhotosByMonth.ts:15-23)的桶是遇到照片才创建,永不产出空桶,所以本页这个
 // `.filter(m => m.photos.length > 0)` 在结构上不可能剔掉任何东西,是防御性死代码。仍然
diff --git a/src/views/PhotosSettings.vue b/src/views/PhotosSettings.vue
new file mode 100644
index 0000000..e5935d6
--- /dev/null
+++ b/src/views/PhotosSettings.vue
@@ -0,0 +1,212 @@
+<!--
+  SP7-P8a-T5: 设置页容器 —— 把 T3(存储卡)、T4(AI 卡)接成一个真路由页面
+  `/photos/settings`,壳照 PhotosAlbums.vue:184-276 的 AreaShell/.photos-layout/
+  .photos-main 结构复制(该文件头注释已说明这层布局刻意逐视图重复、不抽公共,这里
+  同样不抽)。
+
+  回源坐标:Vue2 PhotosSettings.vue:1-36(壳 + hero + 快速导航)、:194-214(页脚 + toast)、
+  :383-386(scrollTo)、:487-491(showToast,2800ms)、:497-526(mounted 取数)、
+  :527-530(卸载清理)。
+
+  ── 架构偏离登记(四条,均按项目铁律"Vue2 的 bug/结构不照抄,改正确逻辑并注释登记") ──
+  1. Vue2 是 `position:fixed;inset:0;z-index:500` 的全屏 overlay,自带一份
+     `<photos-sidebar>` 与自己的 topbar,靠 `open` prop 开合。New-UI 走真路由 +
+     AreaShell:回主页由 AreaShell 顶栏/PhotosSidebar.side-top 提供,本页只按
+     PhotosAlbums.vue 的既定结构挂**一份** PhotosSidebar(与本区每个 /photos/* 视图
+     一致),不是"AreaShell 自动生成侧栏"——AreaShell.vue 本身没有侧栏概念,这层去重
+     是"整页只有一份 PhotosSidebar 副本"而不是"完全不挂"。测试见下方守卫用例。
+  2. 没有 `open` prop、没有 ESC 关闭、没有 `$emit('close')`——路由页靠浏览器返回键,
+     与本区其它视图一致。因此也没有 Vue2 :497-501/:527-528 的全局 keydown 监听。
+  3. Vue2 的 `themeMixin`/`photosThemeClass`(相册私有明暗主题开关)不迁——台账第二笔,
+     整个迁移期都不做。
+  4. 页脚的「Sign out」不迁(D22)——New-UI 已有全局登出
+     (`src/settings/panels/AccountPanel.vue:167` → `useAuth().logout()`),Vue2 那颗
+     自己手清 4 个 localStorage 键 + 跳 `/logout`,与 New-UI 登出通道不一致。
+
+  实现记录(非四条强制登记之列,但同样是与源的可见差异,如实记录):toast 只保留文字,
+  不渲染 Vue2 `photos-icon :name="toast.icon"` 那个图标——本仓相册区没有 PhotosIcon.vue
+  等价物(已 grep 确认零命中),T12 PhotosFilterChip.vue 头注释"偏离登记 1"就是同一结论
+  (没有就不建一份迷你 icon 映射表)。本仓全局 toast(AppToast.vue)也是纯文字胶囊、
+  没有图标,这里的视觉与本仓既有 toast 保持一致而非重建 Vue2 的图标+紫色配色。
+
+  取数分工(接口债务,已与 T3/T4 对齐,详见两卡头注释与 task-5-report.md):
+  fetchStorage() 由 PhotosStorageCard 自己在其 onMounted 里调用,本容器**不重复调用**;
+  本容器 mounted 时只调用 fetchAbout/fetchRetention/fetchScanInterval/fetchAiFeatures
+  这四个(Vue2 :497-526 的五个取数里去掉 loadStorage,即由子组件承接的那个)。
+
+  `?section=` 深链:接的是 route.query.section,值只认 'storage'/'ai'(包含 Vue2
+  `settings=1`"只是打开、不滚动"语义在内的其它任何值,一律忽略、不滚动)。T6 的
+  「Settings · AI behavior」链接会指向 `/photos/settings?section=ai`。
+  两条路径都处理(评审 Important 1,2026-08-04 补齐):①挂载时(`onMounted` +
+  `nextTick`)②挂载之后 query 才变化时(不带 `immediate` 的 `watch(() =>
+  route.query.section, ...)`)——后者补的是"用户已经停留在本页,手改地址栏 query 或
+  未来某个页面内链接指向本页只是 section 不同"这种 vue-router 4 不会重新 mount 组件
+  的场景。两条路径共用同一个 `scrollToSection`/`isSectionId` 判据,不允许各自维护
+  一份白名单然后漂开。
+-->
+<script setup lang="ts">
+import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
+import { useI18n } from 'vue-i18n'
+import { useRoute } from 'vue-router'
+import AreaShell from '../components/shell/AreaShell.vue'
+import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
+import PhotosStorageCard from '../photos/components/PhotosStorageCard.vue'
+import PhotosAiCard from '../photos/components/PhotosAiCard.vue'
+import { usePhotosSettingsStore } from '../photos/stores/settings'
+
+interface ToastPayload { icon: string; text: string }
+
+const { t, locale } = useI18n()
+const route = useRoute()
+const settings = usePhotosSettingsStore()
+
+const pageRef = ref<HTMLElement | null>(null)
+
+// Vue2 :302 —— about 取数前兜底 'NAS'。
+const deviceName = computed(() => settings.about?.deviceName || 'NAS')
+
+// Vue2 :352-361,偏离登记同 T4 AI 卡头注释「偏离登记 1」——不传 locale 会跟随系统语言
+// 而非应用内选择的语言。这里显式套用 relTime.ts/PlacesRail.vue 等既有写法转 BCP-47。
+// 与 lastBuiltText(T4)不同:Vue2 :359-361 这里的 catch 分支回落到空字符串而不是原始
+// iso(源本身如此,照搬,不是本条的偏离)。
+const librarySinceText = computed(() => {
+  const iso = settings.about?.librarySince
+  if (!iso) return ''
+  try {
+    const tag = locale.value.replace('_', '-')
+    return new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso))
+  } catch {
+    return ''
+  }
+})
+
+// Vue2 :383-386 —— 找不到目标元素时是 no-op,不抛错(jsdom 无 scrollIntoView 实现,
+// 测试里 spy 掉即可,不需要真的滚动)。
+function scrollTo(id: string): void {
+  const el = pageRef.value?.querySelector('#' + id)
+  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
+}
+
+// 白名单只在这一处判定,mounted 路径与"页面已停留、query 变化"路径共用同一个函数,
+// 不允许各自维护一份判据然后慢慢漂开(评审 Important 1 的裁定原话)。
+type SectionId = 'storage' | 'ai'
+function isSectionId(v: unknown): v is SectionId {
+  return v === 'storage' || v === 'ai'
+}
+function scrollToSection(section: unknown): void {
+  if (isSectionId(section)) scrollTo(section)
+}
+
+const toast = ref<ToastPayload | null>(null)
+let toastTimer: ReturnType<typeof setTimeout> | undefined
+
+// Vue2 :487-491 —— 承接两张卡片 @toast 上来的事件;重复触发必须先 clearTimeout 再
+// 重新排定,否则第一条的定时器会提前把第二条 toast 也一并掐掉(变异验证锁住这条)。
+function showToast(payload: ToastPayload): void {
+  toast.value = payload
+  clearTimeout(toastTimer)
+  toastTimer = setTimeout(() => { toast.value = null }, 2800)
+}
+
+onMounted(() => {
+  void settings.fetchAbout()
+  void settings.fetchRetention()
+  void settings.fetchScanInterval()
+  void settings.fetchAiFeatures()
+
+  void nextTick(() => scrollToSection(route.query.section))
+})
+
+// 评审 Important 1(2026-08-04):vue-router 4 对同一路由组件只 query 变化不重新
+// mount——若用户已经停留在本页(比如手改地址栏 query,或未来某个页面内链接指向本页
+// 只是 section 不同),仅靠 onMounted 那一次滚动够不到这种情形。这里补一个不带
+// immediate 的 watch:mounted 时不重复触发(watch 默认不在装配时跑一次),只在挂载
+// *之后* query 真的变化时才滚——与 mounted 路径共用同一个 scrollToSection/isSectionId
+// 判据,不会各自维护一份白名单然后漂开。目标元素(#storage/#ai)是无条件渲染的静态内容,
+// 不随 section 变化增删,故这里不需要像 mounted 路径那样等 nextTick。
+watch(() => route.query.section, (section) => scrollToSection(section))
+
+onUnmounted(() => {
+  clearTimeout(toastTimer)
+})
+</script>
+
+<template>
+  <AreaShell :title="t('photosSettingsTitle')">
+    <div class="photos-layout">
+      <PhotosSidebar />
+      <main class="photos-main">
+        <div ref="pageRef" class="ps-scroll scroll">
+          <div class="ps-hero">
+            <h1>{{ t('photosSettingsTitle') }}</h1>
+            <p>{{ t('photosSettingsHeroDesc') }}</p>
+            <div class="ps-quicknav">
+              <a href="#storage" @click.prevent="scrollTo('storage')">{{ t('photosSettingsNavStorage') }}</a>
+              <a href="#ai" @click.prevent="scrollTo('ai')">{{ t('photosSettingsNavAi') }}</a>
+            </div>
+          </div>
+
+          <PhotosStorageCard @toast="showToast" />
+          <PhotosAiCard @toast="showToast" />
+
+          <footer class="ps-footer">
+            <div class="ps-footer-app">
+              {{ t('photosSettingsFooterApp') }}<template v-if="settings.about?.version"> &middot; v{{ settings.about.version }}</template>
+            </div>
+            <div class="ps-footer-host">
+              {{ t('photosSettingsRunningOn') }} {{ deviceName }}<template v-if="librarySinceText"> &middot; {{ t('photosSettingsLibrarySince') }} {{ librarySinceText }}</template>
+            </div>
+          </footer>
+        </div>
+      </main>
+    </div>
+  </AreaShell>
+
+  <transition name="ps-toast">
+    <div v-if="toast" class="ps-toast" data-test="settings-toast" role="status" aria-live="polite">{{ toast.text }}</div>
+  </transition>
+</template>
+
+<style scoped>
+.photos-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
+.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }
+
+.ps-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; padding: 4px 4px 24px; }
+
+.ps-hero h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 6px; color: var(--fg); }
+.ps-hero p { font-size: 13px; color: var(--fg-muted); margin: 0 0 12px; max-width: 640px; }
+.ps-quicknav { display: flex; gap: 16px; }
+.ps-quicknav a { color: var(--accent-text); font-size: 13px; font-weight: 500; text-decoration: none; }
+.ps-quicknav a:hover { text-decoration: underline; }
+
+.ps-footer { display: flex; flex-direction: column; gap: 2px; padding: 12px 4px 4px; }
+.ps-footer-app { font-size: 12.5px; font-weight: 600; color: var(--fg); }
+.ps-footer-host { font-size: 12px; color: var(--fg-muted); }
+
+/* 评审 Important(2026-08-04,全量收尾门捕获):视觉上借用本仓全局 toast(AppToast.vue)
+   的样式语言(见头注释「实现记录」),但这颗是**页面局部**的浮层,不是全局 toast 本尊——
+   千万别照抄 AppToast.vue 那条"必须高于全仓所有模态遮罩"的 1100,那条硬约束只对*那一个*
+   全局单例成立(docs/THEMING.md §8:"toast 必须高于全仓所有模态遮罩"里的"toast"专指
+   AppToast.vue)。这里原先抄错成 1100,与全局 toast 撞层,`AppToast.zIndex.test.ts` 直接判红
+   ——那条守卫是仓库级的,任何浮层只要 z-index ≥ 1100 就会被判定为"会压住全局 toast"。
+   本设置页局部 toast 只需要盖住**这一页自己会渲染的东西**,按 §8 的阶梯落在"局部固定条
+   60–150"这一档;但本页会挂一份 PhotosSidebar(架构偏离登记 1),它的窄屏抽屉
+   `.photos-sidebar.is-drawer` 是 151(`side-scrim` 遮罩 150)——已经超出该档标称上限,是仓库
+   既有事实,不是本处引入的。160 贴着清过这两个真实存在的同页浮层(151/150),同时远低于
+   200 起的"区级/通用弹窗遮罩"整条band,更远低于 1100 的全局 toast,不会跟任何东西同层。
+   见下方本文件内的守卫用例(锁 <1100;不锁 <1000/<200,因为约定本身只钉 toast 这一条硬线,
+   其余数值是本处依据实测同页浮层做出的选择,不是仓库级不变量)。 */
+.ps-toast {
+  position: fixed; left: 50%; bottom: 32px; transform: translateX(-50%); z-index: 160;
+  padding: 10px 18px; border-radius: 999px; border: 1px solid var(--chip-border);
+  background: var(--toast-bg); color: var(--toast-fg, var(--fg)); font-size: 13px;
+  box-shadow: var(--card-shadow-hi); backdrop-filter: var(--blur); white-space: nowrap;
+  pointer-events: none;
+}
+.ps-toast-enter-active, .ps-toast-leave-active { transition: opacity 0.2s, transform 0.2s var(--ease, ease); }
+.ps-toast-enter-from, .ps-toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }
+
+@media (max-width: 768px) {
+  .photos-layout { gap: 0; }
+}
+</style>
diff --git a/src/views/PhotosSmartViews.vue b/src/views/PhotosSmartViews.vue
index 39c56f7..5110ddb 100644
--- a/src/views/PhotosSmartViews.vue
+++ b/src/views/PhotosSmartViews.vue
@@ -1,64 +1,66 @@
 <script setup lang="ts">
 // SP7-P7a-T4: PhotosSmartViews.vue —— 智能视图列表页(壳 + AI 横幅 + hero + 网格 + 新建卡)。
 // 逐段照 Vue2 NimoOS-UI src/views/Photos/PhotosSmartViewsView.vue:14-38(列表部分,
 // 详情/弹窗部分归其余任务)、内联横幅 :15-19、hero :22-30、网格 :31-38 移植;
 // 样式照 photos-smartview.scss:4-25(hero/create-btn/grid)+ :118-145(create-card)。
 // 壳照 PhotosPeople.vue 头部注释的既定形态复制(AreaShell/.photos-layout/PhotosSidebar/
 // .photos-main,含 ≤768px 的 gap:0),不抽公共(P3/P4 既定)。
 //
 // 本任务范围(brief 结构规格 1-9):
 //  1) 外壳
-//  2) AI 横幅——`aiSmartViewOff` 的读法照 PhotosPeople.vue:379 的 P5 先例(onMounted 直读
-//     一次 getConfig,缺字段/失败一律按开启处理,不吓用户)。
+//  2) AI 横幅——`aiSmartViewOff` 读 T1 的 photosSettings store(P8a-T6 折进去的,见下方
+//     script 头部注释;缺字段/失败一律按开启处理,不吓用户,语义与折之前一致)。
 //  3) hero(标题 + 副标题 + 创建按钮)
 //  4) 网格(SmartViewCard v-for + 末尾新建卡)
 //  5) 加载态用骨架(New-UI 新增,Vue2 没有);listLoaded 且空列表时**不加空态**——那张
 //     新建卡本身就是这页的空态(照 Vue2 的信息层级,登记见 task-4-report.md)。
 //  6) 创建弹窗挂载点:T4 只留 `createOpen` state + 两个入口 @click 置真;T5 已把
 //     <SmartViewCreateDialog v-model:open="createOpen" @created="onCreated"/> 接上
 //     (created 后跳详情页,同 onCardOpen 的目标路径)。
 //
 // 偏离登记:
-//  1) Vue2 :15 的横幅链接是 <a href="javascript:void(0)">,点击 $emit('open-settings',
-//     'ai')。New-UI 设置页归 P8(尚不存在),渲染成不可点的 <span aria-disabled="true">,
-//     title 走新增键 photosSvSettingsPending(「设置页待迁移(P8)」)—— P8 接线点在此,
-//     届时把这个 span 换成真链接/路由跳转。
+//  1) [P8a-T6 已接线,不再是偏离] Vue2 :15 的横幅链接是 <a href="javascript:void(0)">,
+//     点击 $emit('open-settings', 'ai')。设置页在 P8a-T5 落地后(/photos/settings?section=
+//     ai),这里换成真实的 <RouterLink>(§7e-9)—— 原先占位用的 photosSvSettingsPending
+//     键随之成为死键,已从两个 locale 文件删除(见提交信息)。
 //  2) Vue2 :19 在链接文字后还有一个裸英文句点(`</a>.`),中文界面下会中西混排且不在
 //     任何可翻译串里——不复制(同 PhotosPeople.vue 偏离登记 7 的先例)。
 //  3) 横幅琥珀色:Vue2 是内联 rgba(255,159,10,…)/#FF9F0A 字面量,这里改用本仓既有的
 //     --dem-fg/--dem-bg/--dem-bd 家族(grep theme.css 已确认两套主题都有取值,PhotosTrash.vue
 //     的 warn 语义已是这套 token 的既定先例,不新增 token)。
 //  4) .sv-create-btn 背景:Vue2 是 linear-gradient(135deg, var(--accent), var(--accent-hi))
 //     渐变,本仓没有 --accent-hi(Global Constraints §33),改用 var(--accent) 实底 +
 //     hover 时 filter: brightness(1.08)(照 PhotosPersonDetail.vue:1142 等既有先例)。
 //     fix round 1 · I2:这条只解释了背景色的替换,**不覆盖** Vue2 hover 态的
 //     transform: translateY(-1px)(上浮)——那是与颜色 token 无关的独立视觉属性,
 //     之前被静默丢了,已在样式块补回(两者可共存)。
-import { onMounted, ref } from 'vue'
+import { computed, onMounted, ref } from 'vue'
 import { useI18n } from 'vue-i18n'
 import { useRouter } from 'vue-router'
-import { service } from '@nimotech/nimoos-service'
 import AreaShell from '../components/shell/AreaShell.vue'
 import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
 import SmartViewCard from '../photos/components/SmartViewCard.vue'
 import SmartViewCreateDialog from '../photos/components/SmartViewCreateDialog.vue'
 import { usePhotosSmartViews } from '../photos/stores/smartViews'
+import { usePhotosSettingsStore } from '../photos/stores/settings'
 
 const { t } = useI18n()
 const router = useRouter()
 const store = usePhotosSmartViews()
+const settings = usePhotosSettingsStore()
 
-// aiFeatures.smartview 的临时来源:本仓没有 settings store(归 P8),onMounted 直接读一次
-// /photos/config。失败或字段缺失一律按开启处理(宁可不吓用户),照 PhotosPeople.vue:376-386
-// 的 loadFacesEnabled 先例。
-const aiSmartViewOff = ref(false)
+// P8a-T6(§7e-10):aiFeatures.smartview 曾经是本页自己 onMounted 直读一次 /photos/config
+// 的临时实现(P8 归属前没有共享 store)。现在改读 T1 的 photosSettings store —— 语义不变:
+// 缺字段/请求失败一律按开启处理(不显示横幅,不吓用户),这条防御性语义已经在
+// store.fetchAiFeatures() 里落实,这里只是消费。
+const aiSmartViewOff = computed(() => settings.aiFeatures.smartview === false)
 
 // T5:创建弹窗已接线(T4 的 TODO 兑现)。createOpen 通过 v-model:open 传给
 // SmartViewCreateDialog;创建成功后弹窗 emit('created', id),这里直接跳详情页
 // (同 onCardOpen 的目标路径)。
 const createOpen = ref(false)
 function openCreate(): void {
   createOpen.value = true
 }
 
 function onCardOpen(id: string): void {
@@ -68,58 +70,49 @@ function onCardOpen(id: string): void {
 function onCreated(id: string): void {
   router.push('/photos/smart-views/' + id)
 }
 
 // 测试观测点:T4 不挂真弹窗(T5 才建),没有 DOM 可断言"弹窗真的开了"——照
 // PlacesMap.vue 的既有 defineExpose 先例,暴露这个 ref 供测试直接读取,而不是新增一个
 // 纯为了测试存在的隐藏 DOM 标记节点。T5 接上真弹窗后,这个 ref 仍会是 v-model:open 的
 // 绑定目标,defineExpose 可以留着或按 T5 实际需要收窄。
 defineExpose({ createOpen })
 
-async function loadAiSmartViewOff(): Promise<void> {
-  try {
-    const cfg = await service.photos.getConfig()
-    const ai = cfg?.aiFeatures as { smartview?: unknown } | undefined
-    aiSmartViewOff.value = ai?.smartview === false
-  } catch (e) {
-    console.error('[photos-smartviews] getConfig', e)
-    aiSmartViewOff.value = false
-  }
-}
-
 onMounted(() => {
   void store.fetchSmartViews()
-  void loadAiSmartViewOff()
+  // 侧栏(PhotosSidebar,本页也挂载它)同帧也会调用 fetchAiFeatures() —— 并发去重收在
+  // settings.ts 里,这里不需要关心。
+  void settings.fetchAiFeatures()
 })
 </script>
 
 <template>
   <AreaShell :title="t('photosTitle')">
     <div class="photos-layout">
       <PhotosSidebar />
       <main class="photos-main">
         <!-- ── AI 横幅(Vue2 :15-19,内联 style 改 class)── -->
         <div v-if="aiSmartViewOff" class="svs-banner" data-test="svs-ai-banner">
           <div class="svs-banner-icon">
             <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
           </div>
           <div class="svs-banner-body">
             <div class="svs-banner-title">{{ t('photosSvSmartViewsAutoUpdate') }}</div>
             <div class="svs-banner-desc">
               {{ t('photosSvTheseSavedSearchesStay') }}
-              <!-- 偏离登记 1:设置页归 P8,不可点;偏离登记 2:不复制 Vue2 链接后的裸英文句点。 -->
-              <span
+              <!-- §7e-9:真实路由链接,替换掉原来的不可点占位 span(偏离登记 1 已解除,
+                   见文件头注释)。偏离登记 2:不复制 Vue2 链接后的裸英文句点。 -->
+              <RouterLink
                 class="svs-banner-link"
-                aria-disabled="true"
                 data-test="svs-settings-link"
-                :title="t('photosSvSettingsPending')"
-              >{{ t('photosPeopleFacesOffLink') }}</span>
+                to="/photos/settings?section=ai"
+              >{{ t('photosPeopleFacesOffLink') }}</RouterLink>
             </div>
           </div>
         </div>
 
         <!-- ── hero(Vue2 :22-30)── -->
         <div class="sv-hero">
           <div class="sv-hero-text">
             <h1>{{ t('photosSvSmartViews') }}</h1>
             <p>{{ t('photosSvSavedSearchesStayLive') }}</p>
           </div>
@@ -171,22 +164,23 @@ onMounted(() => {
   background: var(--dem-bg); border: 1px solid var(--dem-bd); border-radius: 10px;
   display: flex; gap: 10px; align-items: flex-start;
 }
 .svs-banner-icon {
   width: 26px; height: 26px; border-radius: 7px;
   background: color-mix(in srgb, var(--dem-fg) 18%, transparent); color: var(--dem-fg);
   display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;
 }
 .svs-banner-title { font-size: 12.5px; font-weight: 600; color: var(--dem-fg); }
 .svs-banner-desc { font-size: 11.5px; color: var(--fg-muted); margin-top: 3px; line-height: 1.5; }
-/* 不可点的设置链接标注(偏离登记 1):保留 Vue2 视觉上的强调下划线,但不是 <a>。 */
-.svs-banner-link { color: var(--accent-text); text-decoration: underline; cursor: default; }
+/* §7e-9:真实路由链接,保留 Vue2 视觉上的强调下划线(Vue2 :19 的 `<a>` 本身也没有独立
+   hover 规则,这里 1:1 不额外加)。 */
+.svs-banner-link { color: var(--accent-text); text-decoration: underline; cursor: pointer; }
 
 /* ── hero(scss:5-19)── */
 .sv-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 28px; }
 .sv-hero-text h1 { font-size: 26px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 4px; color: var(--fg); }
 .sv-hero-text p { font-size: 13.5px; color: var(--fg-muted); margin: 0; max-width: 520px; line-height: 1.5; }
 .sv-create-btn {
   display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto;
   padding: 9px 16px; border-radius: 99px; border: 0;
   background: var(--accent); color: var(--on-accent);
   font: inherit; font-weight: 500; font-size: 13px; cursor: pointer;
diff --git a/src/views/__tests__/Photos.integration.test.ts b/src/views/__tests__/Photos.integration.test.ts
index 1befea8..8bc5e3c 100644
--- a/src/views/__tests__/Photos.integration.test.ts
+++ b/src/views/__tests__/Photos.integration.test.ts
@@ -356,20 +356,44 @@ describe('Photos.vue integration', () => {
     const progress = handlerFor('nimoos.photos.task.progress')
     progress(undefined, { id: 't1', type: 'index', status: 'done', current: 5, total: 5 })
     await vi.advanceTimersByTimeAsync(2600)
     expect(showSpy).toHaveBeenCalledTimes(1)
 
     progress(undefined, { id: 't1', type: 'index', status: 'done', current: 5, total: 5 })
     await vi.advanceTimersByTimeAsync(2600)
     expect(showSpy).toHaveBeenCalledTimes(1) // 仍是 1 次,未再入队
   })
 
+  // P8a-T10(P1 挂账,onTaskProgress 头部注释记的已知边界):fetchIndexStatus 的 idle 对账会把
+  // done 的 index 任务从 store.tasks 里摘掉;若之后又收到一条迟到的重复 done 事件,旧的
+  // `wasDone = store.tasks.find(...).status === 'done'` 判断因为任务已经不在列表里而失效
+  // (find 返回 undefined),会把这条迟到事件误判成"第一次看到",再次 toast。
+  it('P8a-T10:index 任务被 idle 对账摘除后,迟到的重复 done 事件不二次 toast', async () => {
+    vi.useFakeTimers()
+    await mountPhotos()
+    const store = useTimelineStore()
+    const toast = useToast()
+    const showSpy = vi.spyOn(toast, 'show')
+
+    const progress = handlerFor('nimoos.photos.task.progress')
+    progress(undefined, { id: 't1', type: 'index', status: 'done', current: 5, total: 5 })
+    await vi.advanceTimersByTimeAsync(2600)
+    expect(showSpy).toHaveBeenCalledTimes(1)
+
+    // 复现 timeline.ts fetchIndexStatus 的 idle 对账效果(:118-120):直接把这条任务从列表摘掉。
+    store.tasks = store.tasks.filter((t) => t.id !== 't1')
+
+    progress(undefined, { id: 't1', type: 'index', status: 'done', current: 5, total: 5 })
+    await vi.advanceTimersByTimeAsync(2600)
+    expect(showSpy).toHaveBeenCalledTimes(1) // 仍是 1 次——不能因为任务已被摘除就二次宣布
+  })
+
   it('unmount 时取消 coalescer 的挂起计时器与 socket 订阅', async () => {
     vi.useFakeTimers()
     const w = await mountPhotos()
     const toast = useToast()
     const showSpy = vi.spyOn(toast, 'show')
 
     const progress = handlerFor('nimoos.photos.task.progress')
     progress(undefined, { id: 't1', type: 'index', status: 'done', current: 5, total: 5 })
     w.unmount()
     await vi.advanceTimersByTimeAsync(3000)
diff --git a/src/views/__tests__/PhotosAlbumDetail.test.ts b/src/views/__tests__/PhotosAlbumDetail.test.ts
index ff1e428..9128044 100644
--- a/src/views/__tests__/PhotosAlbumDetail.test.ts
+++ b/src/views/__tests__/PhotosAlbumDetail.test.ts
@@ -149,20 +149,90 @@ describe('PhotosAlbumDetail.vue', () => {
     expect(hero.attributes('style')).toContain('mock://thumb/cover-1/large')
   })
 
   it('albumsLoaded=false(还没加载完)→ 渲染加载骨架,不是"相册不存在"', async () => {
     svc.photos.listAlbums.mockImplementation(() => new Promise(() => {}))
     const { w } = await mountView('999')
     expect(w.find('[data-test="album-loading"]').exists()).toBe(true)
     expect(w.find('[data-test="album-not-found"]').exists()).toBe(false)
   })
 
+  // Task 9(P4 遗留收口):fetchAlbums 失败时 albumsLoaded 保持假(见 albums.ts 注释),
+  // 旧实现下 `!album && !albums.albumsLoaded` 恒真 → 永久停在骨架屏。新增 loadError 分支
+  // 必须拦在骨架分支之前。
+  it('相册列表加载失败时渲染失败态而非永久骨架(P4 遗留)', async () => {
+    svc.photos.listAlbums.mockRejectedValueOnce(new Error('net'))
+    const { w } = await mountView('7')
+    expect(w.find('[data-test="album-load-error"]').exists()).toBe(true)
+    expect(w.text()).toContain('相册加载失败')
+    expect(w.find('[data-test="album-loading"]').exists()).toBe(false)
+  })
+
+  // 变异验证挡门用例①:失败态分支若被挪到骨架分支之后,本用例应变红
+  // (loadError=true 时骨架仍会先命中 v-if,失败态永远出不来)。
+  it('失败态优先于骨架态(loadError 真 + albumsLoaded 假 ⇒ 出失败态,不出骨架)', async () => {
+    svc.photos.listAlbums.mockRejectedValueOnce(new Error('net'))
+    const { w } = await mountView('999')
+    const albums = usePhotosAlbums()
+    expect(albums.loadError).toBe(true)
+    expect(albums.albumsLoaded).toBe(false)
+    expect(w.find('[data-test="album-load-error"]').exists()).toBe(true)
+    expect(w.find('[data-test="album-loading"]').exists()).toBe(false)
+  })
+
+  // 变异验证挡门用例②的姊妹用例:仍在飞行中(未失败)必须继续走骨架态,不能被
+  // loadError 分支误吞——若 loadError 在成功路径也被误置真,这条与上面那条会一起说明
+  // 分支被合并/语义被破坏。
+  it('正在加载(未失败)仍走骨架态,不出失败态', async () => {
+    svc.photos.listAlbums.mockImplementation(() => new Promise(() => {}))
+    const { w } = await mountView('999')
+    const albums = usePhotosAlbums()
+    expect(albums.loadError).toBe(false)
+    expect(w.find('[data-test="album-loading"]').exists()).toBe(true)
+    expect(w.find('[data-test="album-load-error"]').exists()).toBe(false)
+  })
+
+  // 评审 Important 1 补的挡门用例(这一条才是真正钉住不变量的那条,不是 store 那条):
+  // 重试本身也失败——失败态必须持续可见,不能落回骨架分支(旧实现的 loadError 上来即清
+  // false 会让骨架分支在 albumsLoaded 仍为假时于重试飞行期短暂命中,见 albums.ts 同批
+  // 修正注释)。
+  it('相册失败态重试仍失败(reject→retry→reject)→ 失败态持续可见,不出现骨架', async () => {
+    svc.photos.listAlbums.mockRejectedValueOnce(new Error('e1'))
+    const { w } = await mountView('999')
+    expect(w.find('[data-test="album-load-error"]').exists()).toBe(true)
+
+    svc.photos.listAlbums.mockRejectedValueOnce(new Error('e2'))
+    await w.find('[data-test="album-retry"]').trigger('click')
+    await flushPromises()
+    await w.vm.$nextTick()
+
+    expect(w.find('[data-test="album-load-error"]').exists()).toBe(true)
+    expect(w.find('[data-test="album-loading"]').exists()).toBe(false)
+  })
+
+  it('相册失败态的重试按钮重新调 fetchAlbums,成功后失败态消失', async () => {
+    svc.photos.listAlbums.mockRejectedValueOnce(new Error('net'))
+    const { w } = await mountView('7')
+    const albums = usePhotosAlbums()
+    expect(albums.loadError).toBe(true)
+    const fetchSpy = vi.spyOn(albums, 'fetchAlbums')
+
+    await w.find('[data-test="album-retry"]').trigger('click')
+    await flushPromises()
+    await w.vm.$nextTick()
+
+    expect(fetchSpy).toHaveBeenCalled()
+    expect(albums.loadError).toBe(false)
+    expect(w.find('[data-test="album-load-error"]').exists()).toBe(false)
+    expect(w.text()).toContain('Trip')
+  })
+
   it('fetchAlbums 完成后仍找不到该 id → 渲染"相册不存在"+返回按钮,点击返回 /photos/albums', async () => {
     svc.photos.listAlbums.mockResolvedValue([rawAlbum(1, { name: 'Other' })])
     const { w, router } = await mountView('999')
     expect(w.find('[data-test="album-not-found"]').exists()).toBe(true)
     const pushSpy = vi.spyOn(router, 'push')
     await w.find('[data-test="album-not-found-back"]').trigger('click')
     expect(pushSpy).toHaveBeenCalledWith('/photos/albums')
   })
 
   it('资产加载中且无数据 → 渲染 6 个骨架瓦片', async () => {
diff --git a/src/views/__tests__/PhotosFavorites.test.ts b/src/views/__tests__/PhotosFavorites.test.ts
index 44a03a6..cda24da 100644
--- a/src/views/__tests__/PhotosFavorites.test.ts
+++ b/src/views/__tests__/PhotosFavorites.test.ts
@@ -98,20 +98,97 @@ describe('PhotosFavorites.vue', () => {
   it('favoritesLoaded 且列表空 → 渲染空态,不渲染 PhotosGrid', async () => {
     const w = await mountView()
     const fav = usePhotosFavorites()
     expect(fav.favoritesLoaded).toBe(true)
     expect(w.find('[data-test="fav-empty"]').exists()).toBe(true)
     expect(w.text()).toContain('暂无收藏')
     expect(w.find('.photos-grid-root').exists()).toBe(false)
     expect(w.find('.fav-export').attributes('disabled')).toBeDefined()
   })
 
+  // Task 9(P3 遗留收口):fetchFavorites 失败时 favoritesLoaded 保持假(见 favorites.ts
+  // 注释),旧实现下 isEmpty 因此恒假 → 落进 v-else 渲染一个空网格,没有任何失败提示。
+  // 新增 loadError 分支必须拦在最前面。
+  it('加载失败时渲染失败态而非空网格(P3 遗留)', async () => {
+    svc.photos.listFavorites.mockRejectedValueOnce(new Error('network'))
+    const w = await mountView()
+    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(true)
+    expect(w.text()).toContain('收藏加载失败')
+    expect(w.find('[data-test="fav-empty"]').exists()).toBe(false)
+    expect(w.find('.photos-grid-root').exists()).toBe(false)
+  })
+
+  it('失败态的重试按钮重新调 fetchFavorites,成功后失败态消失', async () => {
+    svc.photos.listFavorites.mockRejectedValueOnce(new Error('network'))
+    const w = await mountView()
+    const fav = usePhotosFavorites()
+    expect(fav.loadError).toBe(true)
+    const fetchSpy = vi.spyOn(fav, 'fetchFavorites')
+
+    svc.photos.listFavorites.mockResolvedValueOnce([photo('a')])
+    await w.find('[data-test="fav-retry"]').trigger('click')
+    await flushPromises()
+    await w.vm.$nextTick()
+
+    expect(fetchSpy).toHaveBeenCalled()
+    expect(fav.loadError).toBe(false)
+    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(false)
+    expect(w.find('.photos-grid-root').exists()).toBe(true)
+  })
+
+  // 评审 Important 1 补的挡门用例(这一条才是真正钉住不变量的那条,不是 store 那条):
+  // 重试本身也失败——失败态必须持续可见,不能出现"清空态再重新失败"的闪烁,更不能在
+  // in-flight 期间落到网格分支(旧实现的 loadError 上来即清 false 会让这里在重试飞行期
+  // 短暂重演 P3 的裸网格症状,见 favorites.ts 同批修正注释)。
+  // 用受控 promise 卡住重试的 in-flight 窗口——如果 loadError 在进入重试时就被提前清空
+  // (评审纠正前的错误设计),这个窗口里 favoritesLoaded 也还是假,isEmpty 因此为假,会
+  // 落进 v-else 渲染裸网格,原样重演 P3 症状。断言必须卡在 flushPromises 之前才能看见
+  // 这个窗口;等 promise resolve/reject 之后再断言只能看到"最终态",看不见过程,抓不住
+  // 这个缺陷(已在变异验证里踩过一次这个坑,记录见 task-9-report.md 附加修复报告)。
+  it('失败态重试仍失败(reject→retry→reject)→ in-flight 期间与结束后失败态都持续可见,不出现网格', async () => {
+    svc.photos.listFavorites.mockRejectedValueOnce(new Error('e1'))
+    const w = await mountView()
+    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(true)
+
+    let rejectRetry: (e: Error) => void = () => {}
+    svc.photos.listFavorites.mockImplementationOnce(
+      () => new Promise((_resolve, reject) => { rejectRetry = reject }),
+    )
+    await w.find('[data-test="fav-retry"]').trigger('click')
+    await w.vm.$nextTick()
+
+    // in-flight:重试还没落定,失败态必须继续可见,不能落到网格分支。
+    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(true)
+    expect(w.find('.photos-grid-root').exists()).toBe(false)
+    expect(w.find('[data-test="fav-empty"]').exists()).toBe(false)
+
+    rejectRetry(new Error('e2'))
+    await flushPromises()
+    await w.vm.$nextTick()
+
+    // 落定后(仍失败):失败态持续可见。
+    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(true)
+    expect(w.find('.photos-grid-root').exists()).toBe(false)
+    expect(w.find('[data-test="fav-empty"]').exists()).toBe(false)
+  })
+
+  // 关键区分(brief 明确要求的挡门用例):成功但列表为空 —— 必须仍走空态,不能被
+  // loadError 分支误吞。
+  it('确认为零收藏(成功但列表空)仍走空态,不走失败态', async () => {
+    const w = await mountView()
+    const fav = usePhotosFavorites()
+    expect(fav.loadError).toBe(false)
+    expect(fav.favoritesLoaded).toBe(true)
+    expect(w.find('[data-test="fav-empty"]').exists()).toBe(true)
+    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(false)
+  })
+
   it('列表非空 → 渲染 PhotosGrid(:months = favoritesMonths),导出按钮启用', async () => {
     svc.photos.listFavorites.mockResolvedValue([photo('a'), photo('b')])
     const w = await mountView()
     expect(w.find('[data-test="fav-empty"]').exists()).toBe(false)
     expect(w.find('.photos-grid-root').exists()).toBe(true)
     expect(w.findAll('.tile')).toHaveLength(2)
     expect(w.find('.fav-export').attributes('disabled')).toBeUndefined()
   })
 
   it('点导出按钮 → fav.exportZip 被调 + toast', async () => {
diff --git a/src/views/__tests__/PhotosPeople.test.ts b/src/views/__tests__/PhotosPeople.test.ts
index 236e9d0..b889dcd 100644
--- a/src/views/__tests__/PhotosPeople.test.ts
+++ b/src/views/__tests__/PhotosPeople.test.ts
@@ -29,20 +29,21 @@ const svc = vi.hoisted(() => ({
   },
 }))
 vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))
 
 import PhotosPeople from '../PhotosPeople.vue'
 // 评审 Important 2 的样式断言用:jsdom 不做级联/伪元素计算,只能对 <style> 原文做结构断言
 // (同 color-guard.test.ts / PersonAssetGrid.test.ts 的既有 `?raw` 先例)。
 import photosPeopleRaw from '../PhotosPeople.vue?raw'
 import { usePhotosPeople } from '../../photos/stores/people'
 import { useTimelineStore } from '../../photos/stores/timeline'
+import { usePhotosSettingsStore } from '../../photos/stores/settings'
 import { useToast } from '../../stores/toast'
 
 const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
 
 function makeRouter() {
   return createRouter({
     history: createWebHashHistory('/app/'),
     routes: [
       { path: '/photos/people', name: 'photos-people', component: PhotosPeople },
       { path: '/photos/people/:id', name: 'photos-person', component: { template: '<div/>' } },
@@ -97,23 +98,46 @@ beforeEach(() => {
 // 用 afterEach(不是 beforeEach,理由同上引处)兜底清空。
 afterEach(() => {
   usePhotosPeople().__resetForTest()
 })
 
 describe('PhotosPeople.vue — 生命周期与分区', () => {
   it('onMounted 拉人物 + 拉合并建议 + 读一次 getConfig', async () => {
     await mountView()
     expect(svc.photos.listPersons).toHaveBeenCalledTimes(1)
     expect(svc.photos.mergeSuggestions).toHaveBeenCalledTimes(1)
+    // getConfig 现在经由 photosSettings store 的 fetchAiFeatures() 间接调用(§7e-10 收编
+    // 见下一条用例),仍是「一次页面加载只读一次」—— 本页与它挂载的 PhotosSidebar 同帧各调
+    // 一次 fetchAiFeatures(),store 内部的在途去重(settings.ts)把两次并发调用合并成
+    // 一次真实请求,这条断言同时也是对去重生效的端到端印证。
     expect(svc.photos.getConfig).toHaveBeenCalledTimes(1)
   })
 
+  // P8a-T6(§7e-10):facesEnabled 折进 photosSettings store,视图不再自己直读 getConfig。
+  // брief 给的字面断言 `expect(service.photos.getConfig).not.toHaveBeenCalled()` 与上一条
+  // 既有测试互相矛盾(store 的 fetchAiFeatures 内部仍会调 getConfig,mock 是在 service 层,
+  // 分不清"视图直读"与"经 store 间接读"——两条断言不可能同时成立)。已在任务报告里登记这处
+  // brief-vs-既有测试冲突,改用能真正区分"视图直读 vs 经 store 读"的断言:spy 住 store 的
+  // fetchAiFeatures action,证明 onMounted 调的是这个 action 而不是自己再包一层 getConfig。
+  // review fix(take-along,收紧断言):原来是 `toHaveBeenCalled()`。收紧前手动验证了真实
+  // 次数——`mountView()` 挂的是完整 `PhotosPeople`(模板里含 `<PhotosSidebar />`,T6 也给
+  // 侧栏接了 fetchAiFeatures),挂载后 spy 记录的是**两次** action 调用(本页自身 + 它挂的
+  // 那份侧栏各一次),不是 1 次——临时改成 `toHaveBeenCalledTimes(1)` 手动跑过,确认会失败
+  // (got 2 times)才定的这个数字。真正的网络级去重证明是上一条既有测试(:104-113,断言
+  // `getConfig` 恰好 1 次、且不 spy action),这条只锁"调的是 store 而不是自己包一层"。
+  it('facesEnabled 读 store 而非自己调 getConfig(onMounted 走 settings.fetchAiFeatures,含它挂的侧栏共 2 次 action 调用)', async () => {
+    const settings = usePhotosSettingsStore()
+    const spy = vi.spyOn(settings, 'fetchAiFeatures')
+    await mountView()
+    expect(spy).toHaveBeenCalledTimes(2)
+  })
+
   // ── 评审 Important 2:收藏人物的 accent 内环 ────────────────────────────────
   it('Pinned 头像带 data-fav="true",Named 头像是 "false"(选择器条件的数据来源)', async () => {
     const { w } = await mountView()
     const pinnedAvatar = w.get('[data-test="pinned-card"] .person-avatar')
     expect(pinnedAvatar.attributes('data-fav')).toBe('true')
     for (const card of w.findAll('[data-test="named-card"] .person-avatar')) {
       expect(card.attributes('data-fav')).toBe('false')
     }
   })
 
@@ -592,20 +616,39 @@ describe('PhotosPeople.vue — T7 三态弹窗接线:合并', () => {
     await openMenuDialog(w, 'menu-merge')
     const candidate = w.get('[data-test="cad-candidate"]')
     await candidate.trigger('click')
     await candidate.trigger('click') // 第二次点击在第一次未 resolve 前触发(弹窗此刻仍开着)
     await flushPromises()
 
     expect(svc.photos.mergePersons).toHaveBeenCalledTimes(1)
     resolveMerge?.()
     await flushPromises()
   })
+
+  // P8a-T10:targetName 之前没有兜底,目标未命名(或 personById 在提交那一刻找不到)时会渲染成
+  // 「已合并到「」」。personById 是即时重查(不是候选点击时捕获的对象),所以可以在点击候选前
+  // 用 patchPerson 把目标改名为空,模拟"确认前名字变空"的防御性场景(不是伪造——真实并发改名/
+  // 数据刷新都会走同一条 personById 重查路径)。
+  it('P8a-T10:目标名字为空 → toast 兜底为"同一个人",不渲染成「已合并到「」」', async () => {
+    const { w } = await mountView()
+    const toast = useToast()
+    const people = usePhotosPeople()
+    await openMenuDialog(w, 'menu-merge')
+    const first = w.get('[data-test="cad-candidate"]')
+    expect(first.attributes('data-id')).toBe('42') // Alice,count 最高排第一
+    people.patchPerson(42, { name: '' })
+    await first.trigger('click')
+    await flushPromises()
+
+    expect(toast.toasts[0]!.text).toBe(`已合并到「${zh.photosPersonMergeAsSame}」`)
+    expect(toast.toasts[0]!.text).not.toMatch(/「」/)
+  })
 })
 
 describe('PhotosPeople.vue — T7 三态弹窗接线:删除', () => {
   it('成功:purgePersonWithUndo 被调 → 弹窗关闭 → toast 带 5000ms 与 undo action', async () => {
     const { w } = await mountView()
     const people = usePhotosPeople()
     const toast = useToast()
     const purgeSpy = vi.spyOn(people, 'purgePersonWithUndo')
     const toastSpy = vi.spyOn(toast, 'show')
     await openMenuDialog(w, 'menu-delete')
diff --git a/src/views/__tests__/PhotosSettings.test.ts b/src/views/__tests__/PhotosSettings.test.ts
new file mode 100644
index 0000000..f554b0b
--- /dev/null
+++ b/src/views/__tests__/PhotosSettings.test.ts
@@ -0,0 +1,363 @@
+// SP7-P8a-T5: PhotosSettings.vue —— 设置页容器,接 T3(存储卡)/T4(AI 卡)+ 真路由
+// `/photos/settings` + 侧栏入口。回源坐标见 task-5-brief.md 头部与组件文件头注释。
+//
+// 两张卡各自已有专属单测(PhotosStorageCard.test.ts/PhotosAiCard.test.ts)覆盖卡内部
+// 逻辑,这里用 global.stubs 顶替成两个最小 stub(各自带 #storage/#ai 锚点 + 一个能
+// emit('toast', ...) 的触发器),只验证容器自己的接线,不重复测卡内部行为——照
+// PhotosSearch.test.ts:1056-1060 的既定 stub 写法。
+//
+// 测试基建偏离登记(brief 与本仓实际不符,以本仓实测为准,详见 task-5-report.md):
+// 1. brief Step1 的守卫用例断言"不挂第二份侧栏"写的是
+//    `wrapper.findComponent(PhotosSidebar).exists()` 应为 false——但 AreaShell.vue 本身
+//    没有侧栏概念(已读源码确认,只有 header/slot),侧栏是每个 /photos/* 视图自己在壳内挂
+//    一份(PhotosAlbums.vue:187 的既定先例,本组件同构照抄)。若真按 `false` 断言,等于要求
+//    本页完全不挂侧栏——那是实打实的 UX 回归(用户进设置页看不到导航),且直接违反本任务
+//    dispatch 明确要求的"照 PhotosAlbums.vue 结构复制"。改为断言"恰好一份"
+//    (`findAllComponents(...).length === 1`),这才是"不重复挂"这条不变量真正要守住的东西。
+// 2. brief Step1 的"挂载时拉齐五项数据"与 Interface Debt 段("你的容器必须且只能调用这四个,
+//    fetchStorage 归 StorageCard 自己")矛盾——本文件以后者为准(更具体、更权威),断言四个
+//    显式 action + 一条"fetchStorage 未被容器调用"的反向锁定(防止日后有人加回去造成双取数)。
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
+import { readFileSync } from 'node:fs'
+import { flushPromises, mount } from '@vue/test-utils'
+import { createPinia, setActivePinia } from 'pinia'
+import { createRouter, createWebHashHistory } from 'vue-router'
+
+// P8a-T6 review fix (Important 1): getConfig 加进 mock——之前是空对象 `photos: {}`,
+// 意味着任何真实(未 spy)的 fetchAiFeatures 调用都会在调用 `service.photos.getConfig()`
+// 时同步抛 TypeError(不是函数),被 fetchAiFeatures 自己的 try/catch 吞掉,行为上凑巧
+// "看起来"正确但完全没有验证到"只发一次真实网络请求"这条不变量——新增的网络级去重用例
+// (见下方 describe)需要一个真的 vi.fn() 才能数调用次数。
+vi.mock('@nimotech/nimoos-service', () => ({ service: { photos: { getConfig: vi.fn() } } }))
+
+import PhotosSettings from '../PhotosSettings.vue'
+import photosSettingsRaw from '../PhotosSettings.vue?raw'
+import PhotosSidebar from '../../photos/components/PhotosSidebar.vue'
+import { service } from '@nimotech/nimoos-service'
+import { usePhotosSettingsStore } from '../../photos/stores/settings'
+import { extractStyleBlock } from '../../photos/components/__tests__/cssCascade'
+
+const StorageStub = {
+  template:
+    '<section id="storage" data-test="storage-card-stub" @click="$emit(\'toast\', { icon: \'trash\', text: \'toast-from-storage\' })"></section>',
+}
+const AiStub = {
+  template:
+    '<section id="ai" data-test="ai-card-stub" @click="$emit(\'toast\', { icon: \'sparkles\', text: \'toast-from-ai\' })"></section>',
+}
+
+function makeRouter(path: string) {
+  const router = createRouter({
+    history: createWebHashHistory('/app/'),
+    routes: [
+      { path: '/', name: 'home', component: { template: '<div/>' } },
+      { path: '/photos/settings', name: 'photos-settings', component: PhotosSettings },
+    ],
+  })
+  router.push(path)
+  return router
+}
+
+async function mountView(path = '/photos/settings') {
+  const router = makeRouter(path)
+  await router.isReady()
+  const w = mount(PhotosSettings, {
+    global: {
+      plugins: [router],
+      stubs: { PhotosStorageCard: StorageStub, PhotosAiCard: AiStub },
+    },
+  })
+  await flushPromises()
+  await w.vm.$nextTick()
+  return w
+}
+
+// 同 mountView,但把 router 一并交回去——评审 Important 1 的两条用例需要在挂载*之后*
+// 再 router.push 同一路由只改 query,验证"用户已经停留在本页"这条路径(watch,不是
+// mounted 那次)。不改 mountView 本身的返回形状,避免动到上面所有既有用例的解构写法。
+async function mountViewWithRouter(path = '/photos/settings') {
+  const router = makeRouter(path)
+  await router.isReady()
+  const w = mount(PhotosSettings, {
+    global: {
+      plugins: [router],
+      stubs: { PhotosStorageCard: StorageStub, PhotosAiCard: AiStub },
+    },
+  })
+  await flushPromises()
+  await w.vm.$nextTick()
+  return { w, router }
+}
+
+// jsdom 不实现 scrollIntoView(brief ruling #2)——手动记录调用在哪个元素上,不依赖
+// vitest mock 的 this-context API 版本差异。
+let scrollCalls: Element[]
+// 同时记录每次 querySelector 的参数字符串——"?section= 非法值不滚动"这条不变量,如果只
+// 靠 scrollIntoView 是否被调来判断会失真:页面里唯一存在的两个 id 就是 storage/ai,任何
+// "非法" 取值(如 Vue2 settings=1 场景的 '1')天然查不到元素,scrollIntoView 不会被调,
+// 不管白名单守卫在不在都一样——这条不变量测不出变异。真正要锁住的是"scrollTo 有没有被
+// 调用过",用 querySelector 的调用参数直接证明,不依赖它是否命中真实元素。另外
+// '#1' 是不合法的 CSS id 选择器(数字开头),jsdom 真实 querySelector 会抛 SyntaxError——
+// 这里转发给真实实现但吞掉该错误,不让它变成未处理的 rejection 污染其它用例。
+let queryCalls: string[]
+beforeEach(() => {
+  localStorage.clear()
+  setActivePinia(createPinia())
+  vi.mocked(service.photos.getConfig).mockReset().mockResolvedValue({})
+  scrollCalls = []
+  queryCalls = []
+  const realQuerySelector = Element.prototype.querySelector
+  Element.prototype.querySelector = function (this: Element, selectors: string) {
+    queryCalls.push(selectors)
+    try {
+      return realQuerySelector.call(this, selectors)
+    } catch {
+      return null
+    }
+  }
+  Element.prototype.scrollIntoView = function (this: Element) { scrollCalls.push(this) }
+})
+afterEach(() => {
+  // 防御性收尾:若某条用例中途抛错,不让 fake timers 状态漏到下一条用例。
+  vi.useRealTimers()
+  vi.restoreAllMocks()
+})
+
+describe('PhotosSettings 容器', () => {
+  it('挂载时调用 fetchAbout/fetchRetention/fetchScanInterval/fetchAiFeatures 四项,不重复调用 fetchStorage', async () => {
+    const store = usePhotosSettingsStore()
+    const fetchAbout = vi.spyOn(store, 'fetchAbout').mockResolvedValue(undefined)
+    const fetchRetention = vi.spyOn(store, 'fetchRetention').mockResolvedValue(undefined)
+    const fetchScanInterval = vi.spyOn(store, 'fetchScanInterval').mockResolvedValue(undefined)
+    const fetchAiFeatures = vi.spyOn(store, 'fetchAiFeatures').mockResolvedValue(store.aiFeatures)
+    const fetchStorage = vi.spyOn(store, 'fetchStorage').mockResolvedValue(undefined)
+
+    await mountView()
+
+    expect(fetchAbout).toHaveBeenCalledTimes(1)
+    expect(fetchRetention).toHaveBeenCalledTimes(1)
+    expect(fetchScanInterval).toHaveBeenCalledTimes(1)
+    // P8a-T6:本页头部注释(:14-17)自己说了"整页只有一份 PhotosSidebar 副本",而 T6 给
+    // PhotosSidebar 也接了 fetchAiFeatures()(§7e-15,侧栏要用 aiFeatures.smartview 决定
+    // 是否隐藏智能视图入口)——本页自身 + 它挂载的这一份侧栏,同帧各调一次,是 2 次
+    // *action 调用*,不是 2 次网络请求(settings.ts 的在途去重把并发调用合并成 1 次
+    // getConfig,见 settings.test.ts 的去重用例)。这条断言从 1 改成 2 是行为的真实变化,
+    // 不是放宽断言掩盖回归。
+    expect(fetchAiFeatures).toHaveBeenCalledTimes(2)
+    expect(fetchStorage).not.toHaveBeenCalled()
+  })
+
+  // P8a-T6 review fix (Important 1):上一条用例把 fetchAiFeatures spy 成
+  // `.mockResolvedValue(...)`,店里真正的去重代码(settings.ts 里 `aiFeaturesInFlight` 那段)
+  // 根本没有跑到——那条断言只证明了"本页 + 它挂的侧栏各调了一次 action",证明不了"两次 action
+  // 调用最终只打了一次真实网络请求"。这里不 spy `fetchAiFeatures`,让真实实现跑起来,直接在
+  // HTTP 层(`service.photos.getConfig`,mock 但未替换实现的 vi.fn())数调用次数——这才是
+  // §7e-15 需要的那条不变量:侧栏与页面自身同帧各触发一次 action,必须只落地一次请求。
+  //
+  // fetchRetention/fetchScanInterval 必须单独 spy 掉(mockResolvedValue,不让真实实现跑):
+  // 这两个 action 各自也会调 service.photos.getConfig()(为了拿当前 watchDirs/retentionDays
+  // 随写回一起回传,settings.ts 头部注释里的"读了再写"模式),与 aiFeatures 的去重是两件不
+  // 相关的事——第一次没 spy 它们时手动跑过,得到 3 次调用(去重后的 1 次 aiFeatures + 1 次
+  // fetchRetention + 1 次 fetchScanInterval),不是去重失效,是测试没有把无关的 getConfig
+  // 来源隔离干净。fetchAbout 不碰 getConfig,不需要 spy。
+  it('§7e-15 网络级去重证明:PhotosSettings 自身 + 它挂的 PhotosSidebar 同帧各调一次 fetchAiFeatures,真实 getConfig 只发一次', async () => {
+    const store = usePhotosSettingsStore()
+    vi.spyOn(store, 'fetchRetention').mockResolvedValue(undefined)
+    vi.spyOn(store, 'fetchScanInterval').mockResolvedValue(undefined)
+    await mountView()
+    expect(service.photos.getConfig).toHaveBeenCalledTimes(1)
+  })
+
+  it('承接卡片的 toast 事件并在 2800ms 后消失', async () => {
+    // 先用真实定时器完成挂载(mountView 内部的 flushPromises 靠 setTimeout(0) 落地,
+    // 若先开 fake timers 会卡死——挂载稳定后才切 fake timers,只接管 toast 计时这一段)。
+    const w = await mountView()
+    vi.useFakeTimers()
+
+    await w.get('[data-test="storage-card-stub"]').trigger('click')
+    expect(w.find('[data-test="settings-toast"]').exists()).toBe(true)
+    expect(w.get('[data-test="settings-toast"]').text()).toBe('toast-from-storage')
+
+    await vi.advanceTimersByTimeAsync(2799)
+    expect(w.find('[data-test="settings-toast"]').exists()).toBe(true)
+
+    await vi.advanceTimersByTimeAsync(2)
+    expect(w.find('[data-test="settings-toast"]').exists()).toBe(false)
+    vi.useRealTimers()
+  })
+
+  it('连续两次 toast:第二次重置计时,不被第一次的定时器提前掐掉', async () => {
+    const w = await mountView()
+    vi.useFakeTimers()
+
+    await w.get('[data-test="storage-card-stub"]').trigger('click') // t=0,text=toast-from-storage
+    await vi.advanceTimersByTimeAsync(2000) // t=2000,仍在第一条的 2800ms 窗口内
+    expect(w.find('[data-test="settings-toast"]').exists()).toBe(true)
+
+    await w.get('[data-test="ai-card-stub"]').trigger('click') // t=2000,重置为 text=toast-from-ai
+    await vi.advanceTimersByTimeAsync(800) // t=2800(相对第一条的原计时器到点)
+    // 若 clearTimeout 没生效,第一条的旧定时器会在这一刻把 toast 提前清掉——这里必须仍可见,
+    // 且文本是第二条(证明真的重置了,不是凑巧还没到期)。
+    expect(w.find('[data-test="settings-toast"]').exists()).toBe(true)
+    expect(w.get('[data-test="settings-toast"]').text()).toBe('toast-from-ai')
+
+    await vi.advanceTimersByTimeAsync(2000) // t=4800,相对第二条(t=2000 起 2800ms)到点
+    expect(w.find('[data-test="settings-toast"]').exists()).toBe(false)
+    vi.useRealTimers()
+  })
+
+  it('?section=ai 挂载后滚到 AI 卡', async () => {
+    const w = await mountView('/photos/settings?section=ai')
+    expect(scrollCalls).toHaveLength(1)
+    expect(scrollCalls[0]).toBe(w.get('#ai').element)
+  })
+
+  it('?section=storage 挂载后滚到存储卡', async () => {
+    const w = await mountView('/photos/settings?section=storage')
+    expect(scrollCalls).toHaveLength(1)
+    expect(scrollCalls[0]).toBe(w.get('#storage').element)
+  })
+
+  it('?section= 缺失时不滚动', async () => {
+    await mountView('/photos/settings')
+    expect(scrollCalls).toHaveLength(0)
+    expect(queryCalls).not.toContain('#storage')
+    expect(queryCalls).not.toContain('#ai')
+  })
+
+  // 不能只靠 scrollCalls 判定:页面里唯一存在的两个 id 就是 storage/ai,任何"非法"取值
+  // (如 Vue2 settings=1 场景的字符串 '1')天然查不到元素、scrollIntoView 天然不会被调——
+  // 不管白名单守卫在不在都一样,这条不变量单靠 scrollCalls 测不出变异(已实测验证,见
+  // task-5-report.md 变异验证记录)。真正要锁住的是"scrollTo(非法值) 有没有被调用过",
+  // 用 querySelector 的调用参数直接证明——若白名单被去掉,scrollTo('1') 会被调,进而触发
+  // 一次 `querySelector('#1')`,即便查不到元素依然会留下这条调用记录。
+  it('?section= 非法值(如 "1",Vue2 里 settings=1 只表示"打开"而非目标 id)时不滚动', async () => {
+    await mountView('/photos/settings?section=1')
+    expect(scrollCalls).toHaveLength(0)
+    expect(queryCalls).not.toContain('#1')
+  })
+
+  // 评审 Important 1(2026-08-04):vue-router 4 对同一路由组件只 query 变化不重新
+  // mount——用户已经停留在 /photos/settings(无 section)时,若 query 变成
+  // ?section=ai(手改地址栏,或未来页面内某个指向本页的链接),onMounted 不会重触发,
+  // 必须靠 watch 补上这条路径。
+  it('已停留在本页时 query 才变为 ?section=ai——watch 路径补上滚动(不靠重新 mount)', async () => {
+    const { w, router } = await mountViewWithRouter('/photos/settings')
+    expect(scrollCalls).toHaveLength(0) // mounted 时没有 section,先确认起点确实没滚
+
+    await router.push('/photos/settings?section=ai') // 只改 query,同一路由组件不重新 mount
+    await flushPromises()
+    await w.vm.$nextTick()
+
+    expect(scrollCalls).toHaveLength(1)
+    expect(scrollCalls[0]).toBe(w.get('#ai').element)
+  })
+
+  // 同一条路径上白名单依旧生效——不能因为补了 watch 就把非法值放过去。
+  it('已停留在本页时 query 才变为 ?section=1(非法值)——watch 路径同样不滚动', async () => {
+    const { w, router } = await mountViewWithRouter('/photos/settings')
+
+    await router.push('/photos/settings?section=1')
+    await flushPromises()
+    await w.vm.$nextTick()
+
+    expect(scrollCalls).toHaveLength(0)
+    expect(queryCalls).not.toContain('#1')
+  })
+
+  it('页脚:version 缺失时不渲染 "· v" 片段', async () => {
+    const store = usePhotosSettingsStore()
+    vi.spyOn(store, 'fetchAbout').mockImplementation(async () => {
+      store.about = { version: '', deviceName: 'MyNAS', indexCoverage: 0, indexLastBuilt: '', librarySince: '' }
+    })
+    const w = await mountView()
+    expect(w.find('.ps-footer-app').text()).not.toMatch(/·\s*v/)
+  })
+
+  it('页脚:version 存在时渲染 "· v{version}"', async () => {
+    const store = usePhotosSettingsStore()
+    vi.spyOn(store, 'fetchAbout').mockImplementation(async () => {
+      store.about = { version: '2.3.0', deviceName: 'MyNAS', indexCoverage: 0, indexLastBuilt: '', librarySince: '' }
+    })
+    const w = await mountView()
+    expect(w.get('.ps-footer-app').text()).toContain('v2.3.0')
+  })
+
+  it('页脚:librarySince 缺失时整段不渲染', async () => {
+    const store = usePhotosSettingsStore()
+    vi.spyOn(store, 'fetchAbout').mockImplementation(async () => {
+      store.about = { version: '1.0.0', deviceName: 'MyNAS', indexCoverage: 0, indexLastBuilt: '', librarySince: '' }
+    })
+    const w = await mountView()
+    expect(w.get('.ps-footer-host').text()).not.toContain('建库于')
+  })
+
+  it('页脚:librarySince 存在时渲染 "· 建库于 {date}"', async () => {
+    const store = usePhotosSettingsStore()
+    vi.spyOn(store, 'fetchAbout').mockImplementation(async () => {
+      store.about = { version: '1.0.0', deviceName: 'MyNAS', indexCoverage: 0, indexLastBuilt: '', librarySince: '2026-01-15T00:00:00Z' }
+    })
+    const w = await mountView()
+    expect(w.get('.ps-footer-host').text()).toContain('建库于')
+  })
+
+  it('页脚:运行于 {deviceName},about 缺失时兜底 NAS', async () => {
+    const w = await mountView()
+    expect(w.get('.ps-footer-host').text()).toContain('运行于')
+    expect(w.get('.ps-footer-host').text()).toContain('NAS')
+  })
+
+  // 架构偏离守卫 1/2(见文件头 + 组件头注释四条登记)。
+  it('侧栏只挂一份(不是"AreaShell 自动生成"、也不是重复挂两份)', async () => {
+    const w = await mountView()
+    expect(w.findAllComponents(PhotosSidebar)).toHaveLength(1)
+  })
+
+  it('不渲染登出入口(D22)', async () => {
+    const w = await mountView()
+    expect(w.text()).not.toMatch(/登出|Sign out/)
+  })
+
+  it('快速导航:点击锚点滚动到对应卡片', async () => {
+    const w = await mountView()
+    await w.get('.ps-quicknav a[href="#ai"]').trigger('click')
+    expect(scrollCalls).toHaveLength(1)
+    expect(scrollCalls[0]).toBe(w.get('#ai').element)
+    await w.get('.ps-quicknav a[href="#storage"]').trigger('click')
+    expect(scrollCalls).toHaveLength(2)
+    expect(scrollCalls[1]).toBe(w.get('#storage').element)
+  })
+})
+
+// 全量收尾门(459 文件/5893 例)捕获的真实回归:.ps-toast 曾抄错成 1100,与全局 toast
+// (AppToast.vue,同为 1100)同层——AppToast.zIndex.test.ts 是仓库级守卫,但那条测试要扫
+// 全仓 459 个文件才跑,单任务范围内看不到。这里补一条局部守卫,失败更快、且不依赖全仓
+// glob,只钉本文件自己的产物。只锁"严格低于 1100"这一条硬线(docs/THEMING.md §8 唯一
+// 钉死的不变量);不额外锁 <1000/<200——那些是本处依据同页实测浮层(PhotosSidebar 的
+// 窄屏抽屉 151/遮罩 150)做出的选择,不是仓库级约定,锁死具体数值只会让下次合理调整变红。
+describe('z-index 层级(docs/THEMING.md §8)', () => {
+  it('.ps-toast 的 z-index 严格低于全局 toast(1100)——本页局部浮层不得借用全局 toast 的层级', () => {
+    const style = extractStyleBlock(photosSettingsRaw)
+    expect(style.length).toBeGreaterThan(0)
+    const block = /\.ps-toast\s*\{([^}]*)\}/.exec(style)
+    expect(block, '.ps-toast 规则块未找到').toBeTruthy()
+    const zMatch = /z-index\s*:\s*(\d+)/.exec((block as RegExpExecArray)[1])
+    expect(zMatch, '.ps-toast 规则块里没有 z-index 声明').toBeTruthy()
+    const z = Number((zMatch as RegExpExecArray)[1])
+    expect(z).toBeLessThan(1100)
+  })
+})
+
+describe('路由:/photos/settings 只追加,不重排', () => {
+  it('/photos/settings 出现在源文本里最后一条既有 /photos/* 路由(/photos/search)之后', () => {
+    // ⚠️ 用 node:fs 读源文本行序断言,不用 router.getRoutes()——vue-router 4 的
+    // getRoutes() 会把动态段路由排到静态之前(P6b 已查实,global-constraints.md 记录)。
+    const src = readFileSync('src/router/index.ts', 'utf8')
+    expect(src.length).toBeGreaterThan(0)
+    const idxSettings = src.indexOf("'/photos/settings'")
+    const idxSearch = src.indexOf("'/photos/search'")
+    expect(idxSettings).toBeGreaterThan(-1)
+    expect(idxSearch).toBeGreaterThan(-1)
+    expect(idxSettings).toBeGreaterThan(idxSearch)
+  })
+})
diff --git a/src/views/__tests__/PhotosSmartViews.test.ts b/src/views/__tests__/PhotosSmartViews.test.ts
index 0a84ee4..e38925b 100644
--- a/src/views/__tests__/PhotosSmartViews.test.ts
+++ b/src/views/__tests__/PhotosSmartViews.test.ts
@@ -22,34 +22,38 @@ const svc = vi.hoisted(() => ({
     previewSmartView: vi.fn().mockResolvedValue({ count: 0, seeds: [], thresholdActive: true }),
   },
 }))
 vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))
 
 import PhotosSmartViews from '../PhotosSmartViews.vue'
 // 评审既有先例(PhotosPeople.test.ts):`?raw` 只用于对 <style> 原文做结构断言,不用于
 // 行为断言。
 import photosSmartViewsRaw from '../PhotosSmartViews.vue?raw'
 import { usePhotosSmartViews } from '../../photos/stores/smartViews'
+import { usePhotosSettingsStore } from '../../photos/stores/settings'
 // fix round 1 · I1/I2:先锚定规则体、再断言属性(全文件级 toContain 不算断言)。
 // parseCssRules/extractStyleBlock 是本区既有的样式块结构断言工具(SmartViewCard.test.ts
 // 已用过),不重新发明。
 import { extractStyleBlock, parseCssRules } from '../../photos/components/__tests__/cssCascade'
 
 const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
 
 function makeRouter() {
   return createRouter({
     history: createWebHashHistory('/app/'),
     routes: [
       { path: '/photos/smart-views', name: 'photos-smart-views', component: PhotosSmartViews },
       // T4 尚不建详情路由(归后续任务),这里放一个桩路由让 router.push 的目标路径真实可解析。
       { path: '/photos/smart-views/:id', name: 'photos-smart-view-detail-stub', component: { template: '<div/>' } },
+      // P8a-T6(§7e-9):AI 横幅里的设置链接指向 /photos/settings?section=ai——桩路由让
+      // RouterLink 真的能解析出 href,不然 vue-router 会警告"no match"。
+      { path: '/photos/settings', name: 'photos-settings-stub', component: { template: '<div/>' } },
     ],
   })
 }
 
 async function mountView() {
   const router = makeRouter()
   router.push('/photos/smart-views')
   await router.isReady()
   const w = mount(PhotosSmartViews, { global: { plugins: [i18n, router] } })
   await flushPromises()
@@ -96,20 +100,46 @@ beforeEach(() => {
 })
 afterEach(() => {
   usePhotosSmartViews().__resetForTest()
 })
 
 describe('PhotosSmartViews.vue — 拉取', () => {
   it('onMounted 调 store.fetchSmartViews() 一次(即 service.photos.listSmartViews 被调一次)', async () => {
     await mountView()
     expect(svc.photos.listSmartViews).toHaveBeenCalledTimes(1)
   })
+
+  // P8a-T6(§7e-10):aiSmartViewOff 折进 photosSettings store,本页不再自己直读 getConfig
+  // —— onMounted 走 settings.fetchAiFeatures(),同 PhotosPeople.vue 的收编先例。
+  //
+  // review fix(take-along,收紧断言):原来是 `toHaveBeenCalled()`,改紧到
+  // `toHaveBeenCalledTimes(...)` 之前先手动验证了真实次数——`mountView()` 挂的是完整
+  // `PhotosSmartViews`(模板里含 `<PhotosSidebar />`,T6 也给侧栏接了 fetchAiFeatures),
+  // 挂载后 spy 记录的是**两次** action 调用(本页自身 + 它挂的那份侧栏各一次),不是 1 次
+  // ——同 PhotosPeople.test.ts:104-112、PhotosSettings.test.ts 的既有先例(那两处也是 2,
+  // 理由相同)。曾经临时改成 `toHaveBeenCalledTimes(1)` 手动跑过,确认会失败(got 2 times)
+  // 才定的这个数字,不是照抄评审建议的字面值。
+  it('aiSmartViewOff 读 store 而非自己调 getConfig(onMounted 走 settings.fetchAiFeatures,含它挂的侧栏共 2 次 action 调用)', async () => {
+    const settings = usePhotosSettingsStore()
+    const spy = vi.spyOn(settings, 'fetchAiFeatures')
+    await mountView()
+    expect(spy).toHaveBeenCalledTimes(2)
+  })
+
+  // review fix(Important 1):上一条 spy 的是 store 的 action,不是网络层——这里不 spy
+  // fetchAiFeatures,让真实实现跑起来,直接在 HTTP 层(`svc.photos.getConfig`)数调用次数,
+  // 证明"页面自身 + 它挂的侧栏同帧各调一次 action"最终只落地一次真实请求(§7e-15 需要的
+  // 那条不变量,settings.ts 的 aiFeaturesInFlight 去重)。
+  it('§7e-15 网络级去重证明:PhotosSmartViews 自身 + 它挂的 PhotosSidebar 同帧各调一次 fetchAiFeatures,真实 getConfig 只发一次', async () => {
+    await mountView()
+    expect(svc.photos.getConfig).toHaveBeenCalledTimes(1)
+  })
 })
 
 describe('PhotosSmartViews.vue — 三态渲染', () => {
   it('listLoading && !listLoaded → 渲染骨架,不渲染网格卡片(首帧断言,绕开 flushPromises)', async () => {
     let resolveFn: ((v: unknown[]) => void) | undefined
     svc.photos.listSmartViews.mockImplementation(() => new Promise((res) => { resolveFn = res }))
     const router = makeRouter()
     router.push('/photos/smart-views')
     await router.isReady()
     const w = mount(PhotosSmartViews, { global: { plugins: [i18n, router] } })
@@ -154,31 +184,35 @@ describe('PhotosSmartViews.vue — AI 横幅三态', () => {
     const { w } = await mountView()
     expect(w.find('[data-test="svs-ai-banner"]').exists()).toBe(false)
   })
 
   it('getConfig reject → 横幅不在,不吓用户', async () => {
     svc.photos.getConfig.mockRejectedValue(new Error('boom'))
     const { w } = await mountView()
     expect(w.find('[data-test="svs-ai-banner"]').exists()).toBe(false)
   })
 
-  it('横幅里的设置链接是 <span> 且带 aria-disabled="true",不是 <a href>;点它不触发导航', async () => {
+  // P8a-T6(§7e-9):原来的不可点 <span aria-disabled="true"> 换成真实的 <RouterLink>,指向
+  // /photos/settings?section=ai(T5 建的设置页深链入口)。brief 给的断言用的 data-test id
+  // 是 `sv-ai-settings-link`,与本文件/组件既有的 `svs-settings-link` 命名不一致——沿用本文件
+  // 已建立的既有命名,不为了字面对齐 brief 而改 data-test id(已在任务报告里登记这处
+  // brief-vs-既有约定冲突)。
+  it('AI behavior 链接是真路由链接,指向 /photos/settings?section=ai(§7e-9)', async () => {
     svc.photos.getConfig.mockResolvedValue({ aiFeatures: { smartview: false } })
     const { w, router } = await mountView()
-    const link = w.find('[data-test="svs-settings-link"]')
-    expect(link.exists()).toBe(true)
-    expect(link.element.tagName).toBe('SPAN')
-    expect(link.attributes('aria-disabled')).toBe('true')
-    expect(link.attributes('href')).toBeUndefined()
-    const pushSpy = vi.spyOn(router, 'push')
+    const link = w.get('[data-test="svs-settings-link"]')
+    expect(link.attributes('aria-disabled')).toBeUndefined()
+    expect(link.attributes('href')).toContain('/photos/settings')
     await link.trigger('click')
-    expect(pushSpy).not.toHaveBeenCalled()
+    await flushPromises()
+    expect(router.currentRoute.value.path).toBe('/photos/settings')
+    expect(router.currentRoute.value.query.section).toBe('ai')
   })
 })
 
 // T5 升级(brief 明确要求):T4 只能断言内部 createOpen state(弹窗组件当时还不存在);
 // SmartViewCreateDialog.vue 接线后,断言升级为「弹窗真渲染」——两个入口点击后
 // .sv-modal-scrim 真的出现在 DOM 里,而不只是读一个内部 ref。
 describe('PhotosSmartViews.vue — 创建入口(T5:弹窗真渲染)', () => {
   it('点 hero 创建按钮 → SmartViewCreateDialog 的 scrim 真渲染', async () => {
     const { w } = await mountView()
     expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(false)
```
