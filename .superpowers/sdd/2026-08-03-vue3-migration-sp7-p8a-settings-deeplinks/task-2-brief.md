## Task 2: i18n 键

**Files:**
- Modify: `src/i18n/zh_cn.ts`(尾部追加)、`src/i18n/en_us.ts`(尾部追加,**键序与 zh 逐字节一致**)
- Test: `src/i18n/parity.test.ts`(已存在,不改,跑它)

**Interfaces:**
- Produces: 下表全部键,供 T3–T10 消费。

**中文文案的权威**:Vue2 `src/assets/lang/zh_CN.json`。下表「zh 来源」列标 `json:<行号>` 的**必须**照 json 原文;标 `自拟` 的是 Vue2 组件里内联硬编码英文、json 里没有对应键的,自拟时在两个 locale 文件里写注释说明「Vue2 `PhotosSettings.vue:<行>` 内联英文,json 无键,自拟」。

**实施第一步:先把 json 里这些键逐个 grep 出来核对**,下表的中文是本计划书从 json 抄的,可能有误 —— 冲突以 json 为准并在 report 登记。

| 键名 | zh 来源 | zh 值 | en 值 |
|---|---|---|---|
| `photosSettingsTitle` | 自拟(Vue2 `:18` 内联 `Settings`) | 设置 | Settings |
| `photosSettingsSubtitle` | 自拟(`:19` 内联) | 存储 · AI 行为 | Storage · AI behavior |
| `photosSettingsHeroDesc` | 自拟(`:31` 内联) | Nimo 在你的 NAS 上做的一切 —— 什么在跑、跑在哪、占多少空间。 | Everything Nimo does on your NAS — what runs, where it runs, and how much space it takes. |
| `photosSettingsNavStorage` | 自拟(`:33`) | 存储 | Storage |
| `photosSettingsNavAi` | 自拟(`:34`) | AI 行为 | AI behavior |
| `photosSettingsStorage` | 自拟(`:46`) | 存储 | Storage |
| `photosSettingsVolume` | `json` "volume" | 容量 | volume |
| `photosSettingsFree` | `json` "free" | 可用 | free |
| `photosSettingsUsedOf` | `json` "used of" | 已用,共 | used of |
| `photosSettingsStorageUnavailable` | `json` "Storage info unavailable" | (照 json) | Storage info unavailable |
| `photosSettingsSegPhotos` | `json` "Photos" | 照片 | Photos |
| `photosSettingsSegVideos` | `json` "Videos" | 视频 | Videos |
| `photosSettingsSegRaw` | `json` "RAW originals" | (照 json) | RAW originals |
| `photosSettingsSegThumbs` | `json` "Thumbnail cache" | (照 json) | Thumbnail cache |
| `photosSettingsSegAi` | `json` "AI index" | AI 索引 | AI index |
| `photosSettingsSegOther` | `json` "Other data" | (照 json) | Other data |
| `photosSettingsSegFree` | 自拟(`:73` 内联 `Free`) | 可用 | Free |
| `photosSettingsRetentionLabel` | 自拟(`:81` 内联) | 最近删除保留期 | Recently Deleted retention |
| `photosSettingsRetentionDesc` | 自拟(`:82` 内联) | 已删除的照片在从 NAS 永久移除前保留多久。 | How long to keep deleted photos before they're permanently removed from the NAS. |
| `photosSettingsRetentionDay` | 自拟(`:87` 的 `{{d}}d`) | {n} 天 | {n}d |
| `photosSettingsRetentionFailed` | `json` "Failed to save retention" | (照 json) | Failed to save retention |
| `photosSettingsRescanLabel` | `json` "Rescan library" | 重扫图库 | Rescan library |
| `photosSettingsRescanDesc` | `json`(`:94` 的整句) | (照 json) | Scan all drives now and add new photos and videos to the library. |
| `photosSettingsRescanNow` | `json` "Rescan now" | 立即重扫 | Rescan now |
| `photosSettingsRescanning` | `json` "Rescanning…" | (照 json) | Rescanning… |
| `photosSettingsRescanStarted` | `json` "Library rescan started" | (照 json) | Library rescan started |
| `photosSettingsScanIntervalLabel` | `json` "Auto rescan interval" | 自动重扫间隔 | Auto rescan interval |
| `photosSettingsScanIntervalDesc` | `json`(`:105`) | (照 json) | How often to automatically scan all drives for new media. |
| `photosSettingsScanIntervalOff` | `json` "scan_interval_off" | (照 json) | Off |
| `photosSettingsCacheLabel` | `json` "Thumbnail cache" | (照 json) | Thumbnail cache |
| `photosSettingsCacheDesc` | `json`(`:117`) | (照 json) | Stale previews left behind by deleted photos. Active thumbnails are kept. |
| `photosSettingsClearCache` | `json` "Clear cache" | 清理缓存 | Clear cache |
| `photosSettingsClearing` | `json` "Clearing…" | (照 json) | Clearing… |
| `photosSettingsCleared` | `json` "Cleared" | (照 json) | Cleared |
| `photosSettingsCacheClearedToast` | `json` "Cache cleared" + "freed" 拼 | 缓存已清理 · 释放 {size} | Cache cleared · {size} freed |
| `photosSettingsCacheClearFailed` | `json` "Failed to clear cache" | (照 json) | Failed to clear cache |
| `photosSettingsAiTitle` | 自拟(`:135`) | AI 行为 | AI behavior |
| `photosSettingsAiSubtitle` | 自拟(`:136`) | Nimo 做什么,以及在哪里跑。 | What Nimo does, and where it runs. |
| `photosSettingsPrivacyTitle` | 自拟(`:145`) | 数据不出你的 NAS | Nothing leaves your NAS |
| `photosSettingsPrivacyBody` | 自拟(`:147-149`) | 所有推理 —— 人脸、场景、OCR、评分 —— 都在这台 NAS 上运行。不会有任何图片、向量或元数据被发往外部服务。 | All inference — faces, scenes, OCR, scoring — runs on this NAS. No image, embedding, or metadata is sent to any external service. |
| `photosSettingsFeaturesTitle` | 自拟(`:155`) | 功能 | Features |
| `photosSettingsFeaturesDesc` | 自拟(`:156`) | 关掉你不想让 Nimo 计算的项。关掉的功能会停止运行并释放算力。 | Turn off anything you don't want Nimo to compute. Off features stop running and free up cycles. |
| `photosSettingsFeatFaces` | `json` "Face recognition" | 人脸识别 | Face recognition |
| `photosSettingsFeatFacesDesc` | `json`(`:365`) | (照 json) | Group photos by person, find faces in new uploads. |
| `photosSettingsFeatScenes` | `json` "Scene & object detection" | 场景与物体识别 | Scene & object detection |
| `photosSettingsFeatScenesDesc` | `json`(`:366`) | (照 json) | Powers semantic search — photos turned off here stop being searchable by content. |
| `photosSettingsFeatOcr` | `json` "Text in photos (OCR)" | 图片文字识别(OCR) | Text in photos (OCR) |
| `photosSettingsFeatOcrDesc` | `json`(`:367`) | (照 json) | Search receipts, signs, slides, screenshots. |
| `photosSettingsFeatSmartview` | `json` "Smart Views" | 智能视图 | Smart Views |
| `photosSettingsFeatSmartviewDesc` | `json`(`:368`) | (照 json) | Show Smart Views in the sidebar and keep them evaluating new photos. |
| `photosSettingsFeatSaveFailed` | `json` "Failed to save AI settings" | (照 json) | Failed to save AI settings |
| `photosSettingsIndexTitle` | `json` "AI index" | AI 索引 | AI index |
| `photosSettingsIndexRebuilding` | `json` "Rebuilding…" | (照 json) | Rebuilding… |
| `photosSettingsIndexLastBuilt` | `json` "Last built" | (照 json) | Last built |
| `photosSettingsIndexNever` | `json` "never" | (照 json) | never |
| `photosSettingsIndexPct` | 自拟(`:176` 的 `{{pct}}% complete.`) | 已完成 {pct}%。 | {pct}% complete. |
| `photosSettingsIndexCoverage` | `json` "Covers" + "items. Rebuild after…" 拼 | 覆盖 {count} 项。从备份恢复或更换模型后请重建。 | Covers {count} items. Rebuild after restoring from backup or changing the model. |
| `photosSettingsRebuildIndex` | `json` "Rebuild index" | 重建索引 | Rebuild index |
| `photosSettingsRebuiltToast` | `json` "AI index rebuilt" | (照 json) | AI index rebuilt |
| `photosSettingsRebuildFailed` | `json` "Rebuild failed" | (照 json) | Rebuild failed |
| `photosSettingsRebuildStartFailed` | `json` "Failed to start rebuild" | (照 json) | Failed to start rebuild |
| `photosSettingsRecluster` | 自拟(`:189` 内联) | 重新聚类人脸 | Re-cluster faces |
| `photosSettingsReclusterStarted` | `json` "Face re-clustering started in background" | (照 json) | Face re-clustering started in background |
| `photosSettingsReclusterFailed` | `json` "Failed to start re-clustering" | (照 json) | Failed to start re-clustering |
| `photosSettingsFooterApp` | 自拟(`:196`) | Nimo 相册 | Nimo Photos |
| `photosSettingsRunningOn` | `json` "Running on" | (照 json) | Running on |
| `photosSettingsLibrarySince` | `json` "Library since" | (照 json) | Library since |
| `photosDeepLinkPhotoNotFound` | `json` "Photo not found" | (照 json) | Photo not found |
| `photosFavoritesLoadFailed` | 自拟(New-UI 新增失败态) | 收藏加载失败 | Couldn't load favorites |
| `photosAlbumLoadFailed` | 自拟(New-UI 新增失败态) | 相册加载失败 | Couldn't load this album |
| `photosRetry` | 自拟(两处失败态共用的重试按钮) | 重试 | Retry |

- [ ] **Step 1: 先回源核对**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
for k in "volume" "free" "used of" "Storage info unavailable" "RAW originals" "Thumbnail cache" \
         "Other data" "Failed to save retention" "Rescan library" "Rescan now" "Rescanning…" \
         "Library rescan started" "Auto rescan interval" "scan_interval_off" "Clear cache" \
         "Clearing…" "Cleared" "Cache cleared" "freed" "Failed to clear cache" \
         "Face recognition" "Scene & object detection" "Text in photos (OCR)" "Smart Views" \
         "Failed to save AI settings" "AI index" "Rebuilding…" "Last built" "never" "Covers" \
         "Rebuild index" "AI index rebuilt" "Rebuild failed" "Failed to start rebuild" \
         "Face re-clustering started in background" "Failed to start re-clustering" \
         "Running on" "Library since" "Photo not found"; do
  printf '%-45s' "$k"; grep -F "\"$k\":" src/assets/lang/zh_CN.json || echo "  ⟵ json 里没有,需自拟"
done
```

把结果贴进 task report。**任何与上表不符的,以 json 为准。**

- [ ] **Step 2: 写失败测试**

新建 `src/i18n/__tests__/p8aKeys.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import zh from '../zh_cn'
import en from '../en_us'

const KEYS = [
  'photosSettingsTitle', 'photosSettingsSubtitle', 'photosSettingsHeroDesc',
  'photosSettingsNavStorage', 'photosSettingsNavAi',
  // …把上表全部键名列进来(实施时逐个抄全,不要省略)
  'photosDeepLinkPhotoNotFound', 'photosFavoritesLoadFailed',
  'photosAlbumLoadFailed', 'photosRetry',
] as const

describe('P8a i18n 键', () => {
  it('两个 locale 都定义了本期全部键,且值非空', () => {
    for (const k of KEYS) {
      expect(zh, `zh 缺 ${k}`).toHaveProperty(k)
      expect(en, `en 缺 ${k}`).toHaveProperty(k)
      expect(String((zh as Record<string, string>)[k]).trim().length, `zh ${k} 为空`).toBeGreaterThan(0)
      expect(String((en as Record<string, string>)[k]).trim().length, `en ${k} 为空`).toBeGreaterThan(0)
    }
  })

  it('zh 侧不残留英文占位(本期键的 zh 值不得与 en 值相同,除术语本身)', () => {
    const SAME_OK = new Set(['photosSettingsSegPhotos']) // 若某键中英同形,加进白名单并说明
    for (const k of KEYS) {
      if (SAME_OK.has(k)) continue
      const z = String((zh as Record<string, string>)[k])
      const e = String((en as Record<string, string>)[k])
      expect(z === e, `${k} 的 zh 与 en 相同,疑似漏译`).toBe(false)
    }
  })

  it('带占位符的键两侧占位符集合一致', () => {
    const ph = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(',')
    for (const k of KEYS) {
      const z = String((zh as Record<string, string>)[k])
      const e = String((en as Record<string, string>)[k])
      expect(ph(z), `${k} 占位符不一致`).toBe(ph(e))
    }
  })
})
```

- [ ] **Step 3: 运行确认失败**

Run: `pnpm exec vitest run src/i18n/__tests__/p8aKeys.test.ts --reporter=verbose`
Expected: FAIL — `zh 缺 photosSettingsTitle`

- [ ] **Step 4: 追加键到两个 locale 文件**

在两个文件**尾部**追加(只追加不重排),用一段注释开头:

```ts
  // ── SP7-P8a 相册设置页 + 深链 + 错误态 ──
  // zh 文案权威 = Vue2 src/assets/lang/zh_CN.json;json 里没有对应键的(Vue2
  // PhotosSettings.vue 内联硬编码英文)在该键上方单独注明「自拟」与 Vue2 行号。
  // 本期不迁:主题开关(台账第二笔)· AI 入口(D1)· Sign out(D22)· 上传整块(D21)。
```

- [ ] **Step 5: 运行本期键测试 + parity**

Run: `pnpm exec vitest run src/i18n --reporter=verbose`
Expected: 全 PASS(含既有 `parity.test.ts`)

- [ ] **Step 6: 扫重复键**(merge master 后的已知风险,本期新增键也要扫)

```bash
python3 - <<'EOF'
import re, collections
for f in ['src/i18n/zh_cn.ts','src/i18n/en_us.ts']:
    keys=[m.group(1).strip("'") for l in open(f,encoding='utf-8')
          if (m:=re.match(r"^  ([A-Za-z_$][\w$]*|'[^']+'):", l))]
    dup=[k for k,v in collections.Counter(keys).items() if v>1]
    print(f, len(keys), 'keys; dup:', dup or 'none')
EOF
```
Expected: 两文件键数相同、`dup: none`

- [ ] **Step 7: Commit**

```bash
git add src/i18n/zh_cn.ts src/i18n/en_us.ts src/i18n/__tests__/p8aKeys.test.ts
git commit -m "feat(photos): P8a i18n 键(设置页 + 深链 + 错误态)"
```

---

