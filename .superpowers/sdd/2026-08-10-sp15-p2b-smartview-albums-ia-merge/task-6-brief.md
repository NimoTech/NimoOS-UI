## Task 6: 相册详情统计侧栏 + 更多菜单对齐

**Files:**
- Modify: `src/views/PhotosAlbumDetail.vue`
- Modify: `src/views/__tests__/PhotosAlbumDetail.test.ts`
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`（+3 键）

**Interfaces:**
- Consumes: `AlbumView.videoCount` / `AlbumView.dateStart` / `AlbumView.createdAt`（T1）
- Produces（T7 依赖）：`menuOpen` ref、`openConvertModal()` 函数存根（T6 里先只把菜单项
  接到一个 `openConvertModal` 上，函数体在 T7 填），以及 `smartViewDisabled` computed

**回源**：`git -C /home/nimo/NimoTech/NimoOS-UI show 939a7d3a:src/views/Photos/PhotosAlbumDetail.vue`
的 `:38-81`（更多菜单）、`:101-134`（统计侧栏）、`:249-298`（四个 computed + `distStyle`）。
**样式的现成范本在本仓**：`src/views/PhotosMomentDetail.vue:744-793`（模板）与
`:1059-1090`（`.sv-side-section` / `.sv-stat-*` / `.sv-distribution` / `.sv-dist-*` 规则）。

---

- [ ] **Step 1: 明确一条「不做」并写进代码注释**

**不要**把 `.album-hero-actions .bar-btn` 改名成 `.sv-action-btn`。回源核对结论：
Vue2 `photos.scss:3533-3538` 给 `.sv-action-btn` 的取值（暗胶囊 + 固定浅色 + blur）与
本仓 `PhotosAlbumDetail.vue:714-719` 已有的 `.album-hero-actions .bar-btn` 逐条等价，
换名是**视觉零变化**。Vue2 那条 `:not([data-primary="true"]):hover` 修补是为 Ask Nimo
的渐变按钮服务的，本页没有该按钮。在 `.album-hero-actions .bar-btn` 规则上方补一条
注释登记这个判断（含 Vue2 行号），免得后续评审当成漏移植。

- [ ] **Step 2: 写失败测试**

```ts
  it('shows a stats rail with photos, span, videos and created', async () => {
    const w = await mountDetail({
      album: { id: 'a1', name: 'A', assetCount: 12, dateStart: '2025-06-01', dateEnd: '2025-12-31', videoCount: 3, createdAt: '2026-02-01T00:00:00Z' },
      assets: [{ id: 'p1', takenAt: '2025-06-02' }],
    })
    const cells = w.findAll('[data-test="album-stat-cell"]')
    expect(cells).toHaveLength(4)
    expect(cells[0].text()).toContain('12')
    expect(cells[1].text()).toContain('Jun - Dec 2025')
    expect(cells[2].text()).toContain('3')
  })

  it('falls back to a dash when the span or the created date is unusable', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A', createdAt: 'not-a-date' }, assets: [] })
    const cells = w.findAll('[data-test="album-stat-cell"]')
    expect(cells[1].text()).toContain('—')
    expect(cells[3].text()).toContain('—')
  })

  it('reports zero videos rather than a dash when the album has none', async () => {
    // videoCount is not omitempty on the wire, so 0 is a real answer, not missing data.
    const w = await mountDetail({ album: { id: 'a1', name: 'A', videoCount: 0 }, assets: [] })
    expect(w.findAll('[data-test="album-stat-cell"]')[2].text()).toContain('0')
  })

  it('buckets members by month and omits the histogram when nothing carries a takenAt', async () => {
    const withDates = await mountDetail({
      album: { id: 'a1', name: 'A' },
      assets: [{ id: 'p1', takenAt: '2025-06-02' }, { id: 'p2', takenAt: '2025-06-09' }, { id: 'p3', takenAt: '2025-07-01' }],
    })
    expect(withDates.findAll('[data-test="album-dist-bar"]')).toHaveLength(2)
    const without = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [{ id: 'p1' }] })
    expect(without.find('[data-test="album-dist"]').exists()).toBe(false)
  })

  it('keeps the rail out of the photo grid\'s scroll container', async () => {
    // Both columns scroll independently; if the wrapper scrolled too, the rail would
    // scroll away with the photos (the exact defect PhotosMomentDetail was fixed for).
    const css = readFileSync(new URL('../PhotosAlbumDetail.vue', import.meta.url), 'utf8')
    expect(css).toMatch(/\.album-detail-body\s*\{[^}]*overflow:\s*hidden/)
  })

  it('gives the more menu an icon, a title and a hint per row', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [] })
    await w.find('[data-test="album-more-btn"]').trigger('click')
    expect(w.findAll('[data-test="album-menu-icon"]').length).toBeGreaterThanOrEqual(3)
    expect(w.find('[data-test="album-menu-rename"]').text()).toContain('修改相册名称')
  })

  it('offers Convert to Smart Album above the destructive separator', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [] })
    await w.find('[data-test="album-more-btn"]').trigger('click')
    expect(w.find('[data-test="album-menu-convert"]').exists()).toBe(true)
  })

  it('disables Convert to Smart Album when smart views are off', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [], aiFeatures: { smartview: false } })
    await w.find('[data-test="album-more-btn"]').trigger('click')
    expect(w.find('[data-test="album-menu-convert"]').attributes('disabled')).toBeDefined()
  })
```

> 最后那条读 SFC 文本的用例：**必须用 `node:fs` 读**，不要 `?raw` import
> （P2a-T4 已实证 `?raw` 在本仓测试里恒空，color-guard 曾因此空转）。照
> `src/views/__tests__/` 下 P2a 新增的那个同款用例的写法。

- [ ] **Step 3: 跑测试确认失败**

- [ ] **Step 4: 加 3 个 i18n 键**

`photosAlbumRenameHint`、`photosAlbumConvertToSmart`、`photosAlbumConvertToSmartHint`。
四个统计格的标签**复用 Moment 详情已有的键**：`photosMoPhotos` / `photosMoSpan` /
`photosMoByMonth`，以及 —— **Videos / Created 两格没有现成键**，先
`grep -n "photosMoStats\|photosSvStats\|Videos\|Created" src/i18n/zh_cn.photos.ts` 核一遍；
若确无，本任务再加两个（`photosAlbumStatVideos` = `'视频'` / `'Videos'`，
`photosAlbumStatCreated` = `'创建时间'` / `'Created'`），并在报告里更新总表。

- [ ] **Step 5: 实现四个 computed + `distStyle`**

`monthBuckets` / `distMax` / `distStyle` **逐字照 `PhotosMomentDetail.vue:341-364`**
（同一仓、同一段 Vue2 源、已过终审），把 `allAssets.value` 换成本页的 `photos.value`。
另加：

```ts
const DASH = '—'

// Vue2 :251-253: reuse the human-readable span the list already formats, not a second
// formatter.
const spanLabel = computed(() => album.value?.dateRange || DASH)

// Vue2 :260-262. videoCount is not omitempty on the wire (service/types.go:179), so 0 is
// a real answer; the ?? only covers a partial fixture.
const videoCountLabel = computed(() => (album.value?.videoCount ?? 0).toLocaleString(localeTag.value))

// Vue2 :263-271. Vue2 replaced its own "Recently added" cell with this one in the final
// review round: that cell read createdAt too, so it duplicated this one and, on an old
// album, read as though new photos had just arrived.
const createdLabel = computed(() => {
  const raw = album.value?.createdAt
  if (!raw) return DASH
  const d = new Date(raw)
  if (isNaN(d.getTime())) return DASH
  return d.toLocaleDateString(localeTag.value, { month: 'short', day: 'numeric', year: 'numeric' })
})
```

> `localeTag` 在本文件可能还不存在 —— 若无，照 `PhotosMomentDetail.vue` 的
> `const localeTag = computed(() => locale.value.replace('_', '-'))` 加一份（本仓铁律：
> 裸传 `'zh_cn'` 给 `toLocaleString` 会抛 `RangeError`）。

- [ ] **Step 6: 实现双栏 body + 侧栏模板**

把 `<div class="album-photos-wrap scroll">…</div>` 整块外面包一层：

```html
          <!-- Vue2 :90-93: the body is already a 1fr/320px grid; dropping .no-rail is all it
               takes. Its own overflow becomes hidden because each column scrolls itself --
               if the wrapper scrolled too, the rail would scroll away with the photos. -->
          <div class="album-detail-body">
            <div class="album-photos-wrap scroll"> … 原样 … </div>
            <aside class="sv-detail-side" data-test="album-side">
              <div class="sv-side-section">
                <h3>{{ t('photosMoStats') }}</h3>
                <div class="sv-stat-grid">
                  <div class="sv-stat-cell" data-test="album-stat-cell">
                    <div class="v">{{ (album.count).toLocaleString(localeTag) }}</div>
                    <div class="l">{{ t('photosMoPhotos') }}</div>
                  </div>
                  <div class="sv-stat-cell" data-test="album-stat-cell">
                    <div class="v">{{ spanLabel }}</div>
                    <div class="l">{{ t('photosMoSpan') }}</div>
                  </div>
                  <div class="sv-stat-cell" data-test="album-stat-cell">
                    <div class="v">{{ videoCountLabel }}</div>
                    <div class="l">{{ t('photosAlbumStatVideos') }}</div>
                  </div>
                  <div class="sv-stat-cell" data-test="album-stat-cell">
                    <div class="v">{{ createdLabel }}</div>
                    <div class="l">{{ t('photosAlbumStatCreated') }}</div>
                  </div>
                </div>
              </div>
              <div v-if="monthBuckets.length" class="sv-side-section" data-test="album-dist">
                <h3>{{ t('photosMoByMonth') }}</h3>
                <div class="sv-distribution">
                  <div
                    v-for="(b, i) in monthBuckets" :key="b.key" class="sv-dist-bar"
                    data-test="album-dist-bar" :style="distStyle(b, i)" :title="b.label + ' · ' + b.count"
                  />
                </div>
                <div class="sv-dist-x">
                  <span>{{ monthBuckets[0].label }}</span>
                  <span>{{ monthBuckets[monthBuckets.length - 1].label }}</span>
                </div>
              </div>
            </aside>
          </div>
```

样式：`.album-detail-body`、`.sv-detail-side`、`.sv-side-section*`、`.sv-stat-*`、
`.sv-distribution`、`.sv-dist-*` 七组规则**从 `PhotosMomentDetail.vue:1059-1090` 逐条复制**
（scoped 样式不跨组件，必须重述；那份已是本仓的既定取值，**不要重新发明**）。
`.album-detail-body` 本身：

```css
.album-detail-body {
  flex: 1 1 auto; min-height: 0;
  display: grid; grid-template-columns: 1fr 320px; gap: 0;
  overflow: hidden;
}
```

并补 `≤768px` 单列回落（照 `PhotosMomentDetail.vue` 那段 media query）。

- [ ] **Step 7: 更多菜单对齐 `sv-export-item` 形态**

把 `.album-more-menu` 内的两个 `.album-more-item` 换成三项 `sv-export-item` 结构
（图标格 + 标题 + 描述），中间插 Convert、分隔线在 Delete 之上。标记与类名照
`PhotosSmartViewDetail.vue:671-693` 的既有形态，图标 SVG 也从那里取（rename 用铅笔、
convert 用 sparkles、delete 用垃圾桶）：

```html
                  <div v-if="menuOpen" class="sv-export-menu album-more-menu" data-test="album-menu">
                    <button type="button" class="sv-export-item" data-test="album-menu-rename" @click="menuOpen = false; startTitleEdit()">
                      <div class="sv-export-icon" data-test="album-menu-icon"> … 铅笔 svg … </div>
                      <div>
                        <div class="sv-export-title">{{ t('photosAlbumRename') }}</div>
                        <div class="sv-export-desc">{{ t('photosAlbumRenameHint') }}</div>
                      </div>
                    </button>
                    <button
                      type="button" class="sv-export-item" data-test="album-menu-convert"
                      :disabled="smartViewDisabled"
                      :title="smartViewDisabled ? t('photosSvSmartViewsOffCreateHint') : undefined"
                      @click="openConvertModal"
                    >
                      <div class="sv-export-icon" data-test="album-menu-icon"> … sparkles svg … </div>
                      <div>
                        <div class="sv-export-title">{{ t('photosAlbumConvertToSmart') }}</div>
                        <div class="sv-export-desc">{{ t('photosAlbumConvertToSmartHint') }}</div>
                      </div>
                    </button>
                    <div class="sv-export-sep" />
                    <button type="button" class="sv-export-item sv-export-item-danger" data-test="album-menu-delete" @click="askConfirmDelete">
                      <div class="sv-export-icon sv-export-icon-danger" data-test="album-menu-icon"> … 垃圾桶 svg … </div>
                      <div>
                        <div class="sv-export-title">{{ t('photosAlbumDelete') }}</div>
                        <div class="sv-export-desc">{{ t('photosAlbumDeleteHint') }}</div>
                      </div>
                    </button>
                  </div>
```

`.sv-export-menu` / `.sv-export-item*` / `.sv-export-icon*` / `.sv-export-sep` 的规则同样
**从 `PhotosSmartViewDetail.vue` 的样式块逐条复制**（scoped 不跨组件）。
删掉本文件里已无引用的 `.album-more-item*` 三条旧规则。

⚠ Vue2 用内联 `style="color:#FF6B5C"` 表达 danger；本仓已有
`.sv-export-item-danger` / `.sv-export-icon-danger` 两个类走 `--remove-fg` token ——
**用类，不要内联字面量**（Global Constraints §4）。

`smartViewDisabled` + 桩函数：

```ts
const settings = usePhotosSettingsStore()
// Same criterion as the Albums page's nimo fill option (Vue2 :226-229 passes it down as a
// prop; here both pages read the one settings store instead of threading it through).
const smartViewDisabled = computed(() => settings.aiFeatures.smartview === false)

// Body lands in Task 7 together with the dialog it opens.
function openConvertModal(): void {
  if (smartViewDisabled.value) return
  menuOpen.value = false
  convertOpen.value = true
}
const convertOpen = ref(false)
```

`onMounted` 里补 `void settings.fetchAiFeatures()`（并发去重已收在 store 内）。

- [ ] **Step 8: 跑测试 + 类型检查 + color-guard，然后提交**

```bash
pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts src/styles src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit
git add -A
git commit -m "align the album detail page with the smart view layout

The album detail page gains the stats rail its smart-view counterpart has had all
along -- photos, span, videos, created, plus the by-month histogram -- and its
more menu takes the same icon/title/hint shape so the two details stop looking
like different products.

The rail sits in a two-column body whose own overflow is hidden: each column
scrolls itself, and a scrolling wrapper would carry the rail away with the photos.

The Videos cell replaces what Vue 2 first shipped as 'Recently added'. That cell
read createdAt, so it duplicated the Created cell and, on an old album, read as
though new photos had just arrived.

The header buttons are deliberately not renamed to .sv-action-btn. Vue 2's values
for that class and this repo's existing .album-hero-actions .bar-btn are
equivalent line for line, so the rename would be a visually empty diff."
```

---

