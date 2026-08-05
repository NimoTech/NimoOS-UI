# Task 2 报告:i18n 键

## Step 1:回源核对(grep 逐字输出)

```
volume                                         "volume": "容量",
free                                           "free": "可用",
used of                                        "used of": "已用，共",
Storage info unavailable                       "Storage info unavailable": "存储信息不可用",
RAW originals                                  "RAW originals": "RAW 原片",
Thumbnail cache                                "Thumbnail cache": "缩略图缓存",
Other data                                     "Other data": "其他数据",
Failed to save retention                       "Failed to save retention": "保存保留期失败",
Rescan library                                 "Rescan library": "重扫图库",
Rescan now                                     "Rescan now": "立即重扫",
Rescanning…                                  "Rescanning…": "重扫中…",
Library rescan started                         "Library rescan started": "已开始重扫图库",
Auto rescan interval                           "Auto rescan interval": "自动重扫间隔",
scan_interval_off                              "scan_interval_off": "关闭",
Clear cache                                    "Clear cache": "清理缓存",
Clearing…                                    "Clearing…": "清理中…",
Cleared                                        "Cleared": "已清理",
Cache cleared                                  "Cache cleared": "缓存已清理",
freed                                          "freed": "已释放",
Failed to clear cache                          "Failed to clear cache": "清理缓存失败",
Face recognition                               "Face recognition": "人脸识别",
Scene & object detection                       "Scene & object detection": "场景与物体识别",
Text in photos (OCR)                           "Text in photos (OCR)": "图片文字识别（OCR）",
Smart Views                                    "Smart Views": "智能视图",
Failed to save AI settings                     "Failed to save AI settings": "AI 设置保存失败",
AI index                                       "AI index": "AI 索引",
Rebuilding…                                  "Rebuilding…": "重建中…",
Last built                                     "Last built": "上次构建于",
never                                          "never": "从未",
Covers                                         "Covers": "覆盖",
Rebuild index                                  "Rebuild index": "重建索引",
AI index rebuilt                               "AI index rebuilt": "AI 索引已重建",
Rebuild failed                                 "Rebuild failed": "重建失败",
Failed to start rebuild                        "Failed to start rebuild": "启动重建失败",
Face re-clustering started in background       "Face re-clustering started in background": "人脸重新聚类已在后台开始",
Failed to start re-clustering                  "Failed to start re-clustering": "启动重新聚类失败",
Running on                                     "Running on": "运行于",
Library since                                  "Library since": "建库于",
Photo not found                                "Photo not found": "未找到该图片",
```

全部 37 项均在 json 里命中,零 `⟵ json 里没有,需自拟`。

另补充核对了 brief loop 未覆盖但表中标 `json` 的几项(`Photos`/`Videos`/四条 desc 长句):

```
"Photos": "照片",
"Videos": "视频",
"Scan all drives now and add new photos and videos to the library.": "立即扫描所有分区，将新增的照片和视频加入图库。",
"How often to automatically scan all drives for new media.": "每隔多久自动扫描所有分区以发现新媒体。",
"Stale previews left behind by deleted photos. Active thumbnails are kept.": "已删除照片遗留的过期预览图。使用中的缩略图会保留。",
"Group photos by person, find faces in new uploads.": "按人物归组照片，并在新上传中识别人脸。",
"Powers semantic search — photos turned off here stop being searchable by content.": "语义搜索的基础——关闭后新照片将无法按内容搜索。",
"Search receipts, signs, slides, screenshots.": "搜索小票、路牌、幻灯片和截图中的文字。",
"Show Smart Views in the sidebar and keep them evaluating new photos.": "在侧栏显示智能视图，并持续评估新照片。",
"items. Rebuild after restoring from backup or changing the model.": "个项目。从备份恢复或更换模型后建议重建。",
```

也对照了实际 Vue2 源 `NimoOS-UI/src/views/Photos/PhotosSettings.vue`(brief 引用的行号全部逐一 grep -n 核实,除 `:73`→实际 `:72`(off-by-one,无实质影响)外全部精确命中)。

## Brief 与 json/源码的分歧,及处理

1. **`photosSettingsIndexPct`(表格标「自拟」,实际部分来自 json)**
   Vue2 `PhotosSettings.vue:176`:`{{ indexedPct }}% {{ $t('complete.') }}`。
   `"complete."` **是 json 键**(`"已完成。"`),不是纯内联英文 —— brief 的「自拟」标注不准确。
   处理:视为「数字 + json 片段」的运行时拼接(与下面两个官方拼接键同形态)。
   - en 恰好与 json 片段顺序一致:`{pct}% complete.`
   - zh 若逐字直译成"42% 已完成。"不通顺,按中文语序改写成"已完成 42%。"(brief 给的 zh 值本就是这个顺序,予以采纳)。
   已在两个 locale 文件的该键上方加注释说明这个"非纯自拟"的来龙去脉。

2. **`photosSettingsSegFree` 行号**:brief 写 `:73`,实际 Vue2 源里 `>Free<` 在 `:72`。核对无损,按源码行号 `:72` 写注释。

其余全部行:表格 zh 值均与 json 逐字核对一致,无需改动。

## 自拟键清单(json 无对应键,Vue2 内联英文)

`photosSettingsTitle`(:18)、`photosSettingsSubtitle`(:19)、`photosSettingsHeroDesc`(:31)、
`photosSettingsNavStorage`(:33)、`photosSettingsNavAi`(:34)、`photosSettingsStorage`(:46)、
`photosSettingsSegFree`(:72,brief 误标 :73)、`photosSettingsRetentionLabel`(:81)、
`photosSettingsRetentionDesc`(:82)、`photosSettingsRetentionDay`(:87,`{{d}}d` 内联)、
`photosSettingsCacheLabel`(:116,内联 "Thumbnail cache",与同名 json 键复用同一译文)、
`photosSettingsAiTitle`(:135)、`photosSettingsAiSubtitle`(:136)、`photosSettingsPrivacyTitle`(:145)、
`photosSettingsPrivacyBody`(:147-149)、`photosSettingsFeaturesTitle`(:155)、`photosSettingsFeaturesDesc`(:156)、
`photosSettingsRecluster`(:189,内联 "Re-cluster faces")、`photosSettingsFooterApp`(:196,内联 "Nimo Photos")。

New-UI 新增(Vue2 无对应,失败态是本仓新建的):`photosFavoritesLoadFailed`、`photosAlbumLoadFailed`、`photosRetry`。

`photosSettingsIndexPct` 单独标注为"非纯自拟"(见上)。

其余全部 json 权威键(约 40 个)直接照抄 json 原文,不再赘述。

## 两个官方拼接键的构成理由

- **`photosSettingsCacheClearedToast`**:Vue2 `:422` 运行时是
  `` `${$t('Cache cleared')} · ${fmtBytes(freed)} ${$t('freed')}` ``。
  取 json 的「缓存已清理」+「已释放」两个片段,拼成一句带 `{size}` 占位的完整消息:
  zh `缓存已清理 · {size} 已释放` / en `Cache cleared · {size} freed`。字面顺序保持与源码拼接顺序一致,读起来自然。

- **`photosSettingsIndexCoverage`**:Vue2 `:177` 运行时是
  `` `${$t('Covers')} ${coverageCount} ${$t('items. Rebuild after restoring from backup or changing the model.')}` ``。
  取 json 的「覆盖」+「个项目。从备份恢复或更换模型后建议重建。」两个片段,原样拼接(json 片段本身已经是完整通顺的中文半句,拼接后即为
  `覆盖 {count} 个项目。从备份恢复或更换模型后建议重建。`),未改写措辞。
  en:`Covers {count} items. Rebuild after restoring from backup or changing the model.`

## TDD 证据

**RED**(Step 3,写完 `src/i18n/__tests__/p8aKeys.test.ts` 后,追加键之前跑):

```
$ pnpm exec vitest run src/i18n/__tests__/p8aKeys.test.ts --reporter=verbose
 FAIL  src/i18n/__tests__/p8aKeys.test.ts > P8a i18n 键 > 两个 locale 都定义了本期全部键,且值非空
AssertionError: zh 缺 photosSettingsTitle: expected { appTitle: ... } to have property "photosSettingsTitle"
 FAIL  src/i18n/__tests__/p8aKeys.test.ts > P8a i18n 键 > zh 侧不残留英文占位(...)
AssertionError: photosSettingsTitle 的 zh 与 en 相同,疑似漏译: expected true to be false
 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)
```
符合预期 —— 键尚未追加,`toHaveProperty` 必失败,且 `undefined === undefined` 触发"相同疑似漏译"误报(这是预期的中间态,追加键后自然消失)。

**GREEN**(Step 5,追加键后跑全部 i18n 测试):

```
$ pnpm exec vitest run src/i18n --reporter=verbose
 ✓ src/i18n/i18n.test.ts (1 test)
 ✓ src/i18n/__tests__/p8aKeys.test.ts (3 tests)
 ✓ src/i18n/__tests__/people.i18n.test.ts (11 tests)
 ✓ src/i18n/parity.test.ts (10 tests)
 Test Files  4 passed (4)
      Tests  25 passed (25)
```
`[Vue warn]` 出现次数:**0**(--reporter=verbose 全量核对,未见任何 stderr 告警)。

**变异验证**(临时改坏→确认变红→已恢复):
1. 把 en `photosSettingsRetentionDay` 的 `{n}d` 改成 `{x}d` → 占位符一致性测试变红(`Expected: "{x}" Received: "{n}"`),验证占位符断言真的生效。
2. 把 zh `photosSettingsRebuildIndex` 改成英文 `'Rebuild index'`(模拟漏译)→ "zh 与 en 相同,疑似漏译" 测试变红。
两次变异均已恢复(重新执行 Step 4 的追加,内容与变异前逐字一致,已用 diff/grep 核实)。

⚠️ **过程事故与恢复**:验证第 2 条变异时误用 `git checkout -- src/i18n/zh_cn.ts` 想撤销单个字段的临时改动,结果把整份**未提交**的 `zh_cn.ts`(含本任务全部 71 个新键)整体打回 HEAD 前状态。已发现并**逐字重新执行一次 Step 4 的追加编辑**(内容与首次追加时完全相同,逐段核对无遗漏),随后重新跑通 Step 5/Step 6/vue-tsc 全绿。en_us.ts 因该条命令只指定了 zh 文件,未受影响。此事故不影响最终交付内容,但记录在案作为过程瑕疵。

## Step 6:重复键扫描(最终版本)

```
src/i18n/zh_cn.ts 1461 keys; dup: none
src/i18n/en_us.ts 1461 keys; dup: none
```
两文件键数相同(1461 = 基线 1390 + 本期 71 键),`dup: none`。另外用 Python 脚本核实两文件键名**顺序完全一致**(`same order: True`),满足"键序逐字节一致"的约束。

## 局部测试证据(补充)

```
$ pnpm exec vue-tsc --noEmit
(无输出,类型检查通过)
```

## 文件改动

- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/i18n/zh_cn.ts`(尾部追加 71 键 + 说明注释,仅追加)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/i18n/en_us.ts`(尾部追加 71 键,键序与 zh 逐字节一致)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/i18n/__tests__/p8aKeys.test.ts`(新建守卫测试)

提交:`29167c4 feat(photos): P8a i18n 键(设置页 + 深链 + 错误态)`

## 自查(Self-Review)

- **完整性**:brief 表格 71 行(不含表头)全部落地于两文件,测试 `KEYS` 数组逐一列出,与表格行数一致(已手工点算 71 个键名,与追加的 71 个 key 一一对应)。
- **文案质量**:所有 `json` 权威行逐字取自 zh_CN.json/en_US.json;`自拟` 行读起来是产品文案而非机翻腔(如"Nimo 在你的 NAS 上做的一切"而非逐字直译);两个拼接键改写为通顺整句而非简单空格粘连。
- **纪律**:两文件均只在文件末尾追加(diff 显示 `+211` 行、无删除/无中间插入);未涉及任何组件文件;`SAME_OK` 白名单按指示改为空集(brief 里 `photosSettingsSegPhotos` 那条豁免确认是错的,照片≠Photos,已不再豁免,测试证明该键 zh/en 不同因此无需豁免也能通过)。
- **测试有效性**:通过两次变异验证(占位符改名、zh 值抄成 en 值)证明守卫测试会真的抓到"漏译"和"占位符不一致",不是空转的"文件能 parse 就过"。

## 关注点(Concerns)

1. `photosSettingsIndexPct` 的"非纯自拟"性质(json 里其实有 `"complete."` 半个片段)是本次核对中发现的一个 brief 标注不准之处,已在报告和代码注释里登记,供后续任务/终审参考。
2. 过程中出现了一次 `git checkout --` 误伤未提交文件的事故(见上文"过程事故与恢复"),已完整恢复并重新验证,但如实登记以防遗漏。
3. `photosSettingsCacheLabel` 与 json 里通用的 `"Thumbnail cache"` 键(用于 `photosSettingsSegThumbs`)是两个独立键但取值相同 —— 这是 Vue2 源码里同一句英文被两个不同 UI 位置各自内联/引用的结果,已在注释里说明,非本任务引入的重复劳动。
