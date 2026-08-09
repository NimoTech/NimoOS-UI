# SP15-P2b 智能视图并入 Albums·IA 合并 —— 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把智能视图并入相册区 —— Albums 页混排手动/智能相册并统一排序、创建面板融合智能
创建、原 Smart Views 页瘦身成 Moments「For You」专页，相册与智能相册之间可双向互转。

**Architecture:** 数据层先行（service 2 方法 + `SmartView.createdAt` + 两个 store action），
混排与排序抽成纯函数 `src/photos/util/mixedAlbums.ts` 单独可测；视图层按「Albums 页 → 创建
融合 → For You 瘦身 → 相册详情 → 两条互转」的依赖顺序推进。New-UI 的详情页是真路由，
Vue2 的同页面板切换、`?smartview=` 深链承接、`@redirect-albums` 三块整体不适用。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript strict · Pinia · vue-router 4 hash 路由 ·
vue-i18n 9 · vitest + jsdom · 手写 CSS（无框架）· `@nimotech/nimoos-service`（内联在
`packages/service/`）。

**Spec:** `docs/superpowers/specs/2026-08-10-sp15-p2b-smartview-albums-ia-merge-design.md`

---

## Global Constraints

以下每条都是**全期硬约束**，每个任务的要求隐含包含本节。

1. **1:1 靶子是 `939a7d3a`**，取 Vue2 源码一律
   `git -C /home/nimo/NimoTech/NimoOS-UI show 939a7d3a:<path>`。
   **绝不要用 `899af59b:`** —— 那是改造前的旧版本（`#112` 的父提交）。
2. **界面严格 1:1，逻辑照正确**：Vue2 的视觉照搬；Vue2 的 bug / 竞态 / 吞错**不照抄**，
   改成正确逻辑并在代码旁写偏离登记（带 Vue2 行号）。禁止无关重构。
3. **中文文案以 Vue2 `zh_CN.json` 为准**，不要自己翻译。本计划已把每个新键的中英取值
   逐字列出，照抄即可。
4. **颜色只能用 `src/styles/theme.css` 的 token**（`var(--…)`）。禁止 hex / `rgb()` /
   `rgba()` / 具名色。需要新语义就在 `theme.css` 里加 token 并在**两套主题块**都给值。
   例外只有两类（`.ic-*` 品牌渐变、第三方库内部主题），且必须就地写注释标明。
5. **CSS 注释里 `*` 不能紧贴 `/`**（`*/` 会提前关闭注释，错误恢复会吞掉整条规则，
   六道门全部照不出来）。注释里也不能出现 hex/rgba 字面量（color-guard 不剥注释）。
6. **新增 i18n 键必须同时加进 `src/i18n/zh_cn.photos.ts` 与 `src/i18n/en_us.photos.ts`**，
   否则 `src/i18n/parity.test.ts` 挂红。删死键同理两边都删。
7. **新增任何测试文件后，必须同步登记进 `oss/manifest.mjs`**。这条在 P1/P2a 已红四次；
   且开源导出守卫在脏工作树上会中止，所以**新测试只有提交之后才对泄漏守卫可见** ——
   预期会有第二轮修，不是意外。
8. **测试描述一律英文**（机主 2026-08-09 拍板）。代码注释一律英文。对话/台账中文。
9. **提交信息一律英文**：imperative subject、sentence case、正文解释**为什么**而不是
   复述 diff。
10. **异步写共享 state 必带过期守卫**（epoch/uuid），回归测试要走交错路径。这类竞态在
    本仓已被终审逮过四次。
11. **弹窗内的失败提示用内联**（`.set-danger` 类语义），不用 toast —— 答的是刚按的那个
    按钮，得钉在旁边、不自动消失。优先展示后端 `message`。
12. **不部署、不推 origin、不合 master。** 做完停在 `sp15-photos-moments` 分支上。
13. **每个任务结束前跑本任务相关的测试 + `pnpm exec vue-tsc --noEmit`**，绿了再提交。
    全套六道门在 Task 9 由控制器亲自复跑。
14. 已知非缺陷，跑测试时别追：jsdom `Not implemented: navigation` 噪声、
    `src/home/components/DesktopContextMenu.test.ts` 单跑时失败、
    `src/files/upload/persist.test.ts:55` 偶发红。

### 全期新增 i18n 键总表（22 个，两个 locale 逐字照抄）

在 `src/i18n/zh_cn.photos.ts` / `src/i18n/en_us.photos.ts` 里按**字母序**插进已有的
`photos*` 键之间（两个文件都按字母序维护）。各任务只加自己那几个，此表是全期总账。

| 键 | zh_cn | en_us | 引入任务 |
|---|---|---|---|
| `photosAlbumConvertFailed` | `'转换失败'` | `'Convert failed'` | T7 |
| `photosAlbumConverting` | `'转换中…'` | `'Converting…'` | T7 |
| `photosAlbumConvertLockHint` | `'现有 {n} 张照片将保持锁定，Nimo 会按这个主题持续加入新照片。'` | `'Your {n} photos stay locked in. Nimo will keep adding new matches for this theme.'` | T7 |
| `photosAlbumConvertSuggestHint` | `'Nimo 建议以下条件——最终匹配结果以智能相册创建时为准'` | `'Nimo suggests these conditions — final matching is decided when the Smart Album is created'` | T7 |
| `photosAlbumConvertToSmart` | `'转为智能相册'` | `'Convert to Smart Album'` | T6 |
| `photosAlbumConvertToSmartHint` | `'Nimo 会自动持续加入匹配的新照片'` | `'Nimo keeps adding matches automatically'` | T6 |
| `photosAlbumConvertedToSmart` | `'已转为智能相册'` | `'Converted to Smart Album'` | T7 |
| `photosAlbumRenameHint` | `'修改相册名称'` | `'Change the album name'` | T6 |
| `photosAlbumsNoneYetHint` | `'还没有相册——手动创建一个，或者让 Nimo 建一个会自动保持更新的智能相册。'` | `'No albums yet — create one manually, or let Nimo build a Smart Album that keeps itself updated.'` | T3 |
| `photosMoFollowsSmartViewSetting` | `'「时刻」跟随「智能视图」开关——可在以下位置重新开启'` | `'Moments follows the Smart Views setting — turn it back on in'` | T5 |
| `photosMoForYou` | `'为你推荐'` | `'For You'` | T5 |
| `photosSvActConvertedFromAlbum` | `'由相册转换而来'` | `'Converted from album'` | T8 |
| `photosSvActConvertedFromAlbumN` | `'由相册转换而来 · 锁定 {n} 张照片'` | `'Converted from album · {n} photos locked in'` | T8 |
| `photosSvConvertToAlbum` | `'转为普通相册'` | `'Convert to regular album'` | T8 |
| `photosSvConvertToAlbumBody` | `'停止自动更新，当前 {n} 张照片将固化为普通相册，主题与条件将被移除。'` | `'Auto-updates stop. The current {n} photos become fixed into a regular album — the theme and conditions will be removed.'` | T8 |
| `photosSvConvertToAlbumHint` | `'停止自动更新，固化当前已匹配的照片'` | `'Stop auto-updates and lock in the current matches'` | T8 |
| `photosSvConvertToAlbumTitle` | `'将「{name}」转为普通相册？'` | `'Convert "{name}" to a regular album?'` | T8 |
| `photosSvConvertedToAlbum` | `'已转为普通相册'` | `'Converted to regular album'` | T8 |
| `photosSvCreateSmartAlbum` | `'创建智能相册'` | `'Create Smart Album'` | T4 |
| `photosSvLetNimoDraft` | `'让 Nimo 起草'` | `'Let Nimo draft it'` | T4 |
| `photosSvLetNimoDraftHint` | `'描述主题，让 AI 帮你填充'` | `'Describe the theme, let AI fill it in'` | T4 |
| `photosSvSmartViewsOffCreateHint` | `'智能视图已关闭——请在「设置 · AI 行为」中重新开启后再创建。'` | `'Smart Views are turned off — re-enable them in Settings · AI behavior to create new ones.'` | T4 |

> `photosSvLetNimoDraft` / `photosSvLetNimoDraftHint` 两条来自 Vue2
> `sourceOptions` 的 `Let Nimo draft it` / `Describe the theme, let AI fill it in`
> （`939a7d3a:PhotosAlbumsView.vue:334`），它们在 `#112` 之前就已在 `zh_CN.json` 里，
> 所以不在 §1 的「新增」diff 里出现，但 New-UI 侧仍是新键。zh 取值照
> `git -C /home/nimo/NimoTech/NimoOS-UI show 939a7d3a:src/assets/lang/zh_CN.json | grep -n "Let Nimo draft"`
> 核对后照抄，**不要用本表的猜测值** —— 实现者第一步就是去核这两条。

### 全期删除的死键（5 个）

| 键 | 为什么死 | 删除任务 |
|---|---|---|
| `photosAlbumSortUpdated` | `updated` 排序选项被 Vue2 `#113` 移除 | T2 |
| `photosAlbumSortUpdatedHint` | 同上 | T2 |
| `photosSvSavedSearchesStayLive` | `sv-hero` 副标题随 SV 页瘦身删除 | T5 |
| `photosSvDescribeWantSetQuality` | 新建卡描述随新建卡删除 | T5 |
| `photosSvAllSmartViews` | 三处返回按钮改用既有 `photosAlbumBack` | T5 |

---

## 文件结构

| 文件 | 责任 | 任务 |
|---|---|---|
| `packages/service/src/photos.ts` | +2 转换端点的 HTTP 封装 | T1 |
| `packages/service/src/photos.convert.test.ts` | **新建**：两个端点的 URL / body / 返回断言 | T1 |
| `src/photos/stores/smartViews.ts` | `SmartView.createdAt` + `convertFromAlbum` action | T1 |
| `src/photos/stores/albums.ts` | `convertFromSmartView` action | T1 |
| `src/photos/util/albumView.ts` | `AlbumView` 扩 `videoCount`/`dateStart`；**删** `sortAlbums` | T1 / T2 |
| `src/photos/util/mixedAlbums.ts` | **新建**：混排判别联合 + `sortMixed` 纯函数（唯一排序实现） | T2 |
| `src/photos/util/__tests__/mixedAlbums.test.ts` | **新建**：混排 + 五档排序 + null-first | T2 |
| `src/views/PhotosAlbums.vue` | 混排网格 + AI 横幅 + 排序接线 + 创建面板宿主 | T3 / T4 |
| `src/photos/components/SmartViewCreateDialog.vue` | `embedded` / `initialName` 嵌入模式 | T4 |
| `src/views/PhotosSmartViews.vue` | 瘦身成 For You 专页 | T5 |
| `src/photos/components/PhotosSidebar.vue` | `labelKey` → `photosMoForYou` | T5 |
| `src/views/PhotosSmartViewDetail.vue` | 回链改道 + 转普通相册入口与确认框 | T5 / T8 |
| `src/views/PhotosSearch.vue` | 回链改道 | T5 |
| `src/views/PhotosAlbumDetail.vue` | 统计侧栏 + 更多菜单对齐 + 转智能接线 | T6 / T7 |
| `src/photos/components/AlbumConvertToSmartDialog.vue` | **新建**：转智能相册弹窗（自带请求与内联错误） | T7 |
| `src/photos/components/SmartViewActivityFeed.vue` | `converted_from_album` 两分支 | T8 |
| `src/i18n/{zh_cn,en_us}.photos.ts` | 22 新键 / 5 死键 | 各任务 |
| `oss/manifest.mjs` | 新测试文件登记 | 各任务 + T9 |

---

## Task 1: 数据层（service + store + AlbumView 扩字段）← 逐任务评审

**Files:**
- Modify: `packages/service/src/photos.ts`（在 `previewSmartView` 之后、
  `// ─── Smart view manual asset actions (SP15-P2a) ───` 之前插入）
- Create: `packages/service/src/photos.convert.test.ts`
- Modify: `src/photos/stores/smartViews.ts`
- Modify: `src/photos/stores/albums.ts`
- Modify: `src/photos/util/albumView.ts`
- Modify: `src/photos/util/__tests__/albumView.test.ts`
- Modify: `oss/manifest.mjs`
- Test: `packages/service/src/photos.convert.test.ts` ·
  `src/photos/stores/__tests__/smartViews.test.ts`（追加）·
  `src/photos/stores/__tests__/albums.test.ts`（追加）·
  `src/photos/util/__tests__/albumView.test.ts`（追加）

> 测试文件的**确切路径**先用
> `ls src/photos/stores/__tests__/ src/photos/util/__tests__/` 核一次；本仓测试与实现
> 同目录或同目录 `__tests__/` 两种形态都有，照该 store 已有测试的实际位置追加，
> **不要新建第二个位置**。

**Interfaces:**
- Produces（T2/T3/T7/T8 依赖这些确切签名）：
  - `service.photos.convertAlbumToSmart(albumId: string | number, payload: { description: string; threshold: number; name?: string; conds?: string[]; includeVideos?: boolean }): Promise<unknown>`
  - `service.photos.convertSmartToAlbum(smartViewId: string | number): Promise<unknown>`
  - `interface SmartView { …; createdAt: string }`（新增字段，缺失归一成 `''`）
  - `smartViewsStore.convertFromAlbum(albumId: string | number, input: { description: string; threshold: number }): Promise<SmartView>` —— 成功返回新 SmartView 并已 `unshift` 进 `smartViews`；失败 **throw**
  - `albumsStore.convertFromSmartView(smartViewId: string): Promise<Record<string, unknown>>` —— 成功返回新 album 原始对象并已插入 `albums`；失败 **throw**
  - `interface AlbumView { …; videoCount: number; dateStart: string | null }`

---

- [ ] **Step 1: 核对后端契约（只读，不改代码）**

跑这三条，把输出贴进任务报告 —— 后面每一步都以它们为准，不要凭本计划的转述：

```bash
cd /home/nimo/NimoTech/NimoOS-Photos
sed -n '230,265p' route/v1/smartviews.go        # FromAlbum：请求字段 + 400/404
sed -n '286,315p' route/v1/albums.go            # FromSmartView：请求字段 + 400/404/409
grep -n "CreatedAt" service/smartview.go        # 确认 SmartView DTO 有 createdAt
```

预期结论：`POST /photos/smart-views/from-album` 收
`{albumId, name?, description, conds?, threshold, includeVideos?}`、返回**完整 SmartView**；
`POST /photos/albums/from-smartview` 收 `{smartViewId}`、返回**完整 Album**，撞名 **409**；
`service/smartview.go:23` 有 `CreatedAt time.Time \`json:"createdAt"\``。

**若任一条与预期不符，停下来在报告里写清差异，不要按本计划继续。**

- [ ] **Step 2: 写失败测试（service 层）**

Create `packages/service/src/photos.convert.test.ts`。harness 逐字照
`packages/service/src/photos.smartviewAssets.test.ts:1-20` 的既有形态（同一个仓、同一层）：

```ts
// SP15-P2b-T1: the two album <-> smart-view conversion endpoints. Verified against
// NimoOS-Photos/route/v1/smartviews.go (FromAlbum) and route/v1/albums.go
// (FromSmartView): both return the full new object, not a change count, and the
// album-name collision surfaces as HTTP 409.
import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPhotos } from './photos.js'

type Call = { method: string; url: string; body?: unknown }

function harness(reply: unknown = {}) {
  const calls: Call[] = []
  const http = {
    post: async (url: string, body?: unknown) => { calls.push({ method: 'post', url, body }); return { data: reply } },
  } as unknown as AxiosInstance
  return { calls, photos: createPhotos(http, () => 'TOK') }
}

describe('album <-> smart view conversion API', () => {
  it('convertAlbumToSmart posts albumId alongside the payload and returns the new smart view', async () => {
    const a = harness({ id: 'sv-new', name: 'Trip' })
    const out = await a.photos.convertAlbumToSmart('al-1', { description: 'sunsets', threshold: 80 })
    expect(out).toEqual({ id: 'sv-new', name: 'Trip' })
    expect(a.calls[0]).toMatchObject({
      method: 'post',
      url: '/photos/smart-views/from-album',
      body: { albumId: 'al-1', description: 'sunsets', threshold: 80 },
    })
  })

  it('convertAlbumToSmart keeps a numeric album id intact in the body', async () => {
    const a = harness({ id: 'sv-new' })
    await a.photos.convertAlbumToSmart(7, { description: 'x', threshold: 60 })
    expect((a.calls[0].body as { albumId: unknown }).albumId).toBe(7)
  })

  it('convertAlbumToSmart forwards the optional fields when given', async () => {
    const a = harness({ id: 'sv-new' })
    await a.photos.convertAlbumToSmart('al-1', {
      description: 'x', threshold: 70, name: 'N', conds: ['scene: sunset'], includeVideos: true,
    })
    expect(a.calls[0].body).toEqual({
      albumId: 'al-1', description: 'x', threshold: 70, name: 'N', conds: ['scene: sunset'], includeVideos: true,
    })
  })

  it('convertSmartToAlbum posts only smartViewId and returns the new album', async () => {
    const a = harness({ id: 'al-new', name: 'Trip' })
    const out = await a.photos.convertSmartToAlbum('sv-1')
    expect(out).toEqual({ id: 'al-new', name: 'Trip' })
    expect(a.calls[0]).toMatchObject({
      method: 'post', url: '/photos/albums/from-smartview', body: { smartViewId: 'sv-1' },
    })
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

```bash
pnpm exec vitest run packages/service/src/photos.convert.test.ts
```

预期：FAIL —— `photos.convertAlbumToSmart is not a function`。

- [ ] **Step 4: 实现两个 service 方法**

在 `packages/service/src/photos.ts` 的 `previewSmartView` 之后插入。**不要**给
`payload` 加默认值（Vue2 那个 `= {}` 默认参数在本仓没有调用方会用到，加了只会让
`description` 可能缺失而后端解析不出条件）：

```ts
    // ─── Album <-> smart view conversion (SP15-P2b) ───
    // Both endpoints convert in place and delete the source object, and both answer
    // with the full new object rather than a change count — the callers push straight
    // into their store and navigate to the new detail route, so a count would be
    // useless. `conds` is deliberately optional: leaving it out lets the backend's
    // svparser derive the conditions from `description`, the same path Create takes.
    async convertAlbumToSmart(
      albumId: string | number,
      payload: { description: string; threshold: number; name?: string; conds?: string[]; includeVideos?: boolean },
    ): Promise<unknown> {
      const res = await http.post('/photos/smart-views/from-album', { albumId, ...payload })
      return body<unknown>(res.data)
    },
    async convertSmartToAlbum(smartViewId: string | number): Promise<unknown> {
      const res = await http.post('/photos/albums/from-smartview', { smartViewId })
      return body<unknown>(res.data)
    },
```

- [ ] **Step 5: 跑测试确认通过**

```bash
pnpm exec vitest run packages/service/src/photos.convert.test.ts
```

预期：4 例全绿。

- [ ] **Step 6: 登记新测试文件到 oss/manifest.mjs**

`packages/service/src/photos.*.test.ts` 在 `oss/manifest.mjs` 里是**逐个枚举**的
（见 `'src/photos.smartviewAssets.test.ts'` 那一段）。在同一段里加：

```js
  'src/photos.convert.test.ts',
```

（注意：那份清单的路径是**相对内嵌共享包根**的，所以是 `src/photos.convert.test.ts`
而不是 `packages/service/src/...` —— 照它同段邻居的写法，不要自己推。）

- [ ] **Step 7: 写失败测试（`SmartView.createdAt`）**

在 smartViews store 的既有测试文件里追加：

```ts
  it('normalises createdAt off the wire and falls back to an empty string', () => {
    // The backend has always returned it (NimoOS-Photos service/smartview.go:23);
    // the front-end type simply never carried it until the global album sort needed it.
    const store = usePhotosSmartViews()
    store.__seedForTest?.([])
    expect(toSmartViewForTest({ id: 'a', createdAt: '2026-01-02T03:04:05Z' }).createdAt)
      .toBe('2026-01-02T03:04:05Z')
    expect(toSmartViewForTest({ id: 'a' }).createdAt).toBe('')
  })
```

⚠ `toSmartView` 是模块私有函数，**没有**导出。实现者两条路选一条，**不要新增
`__resetForTest` 之外的测试后门**：

- 优先：通过 `fetchSmartViews` 的既有 service mock 喂一条带/不带 `createdAt` 的原始
  对象，再断言 `store.smartViews[0].createdAt`（该文件已有此形态的用例，照抄）。
- 备选（仅当上一条在该文件里不可行）：把断言写成上面那样，并**同时**导出 `toSmartView`，
  在导出处写明「为测试导出，属归一函数、无副作用」。

- [ ] **Step 8: 跑测试确认失败，然后实现**

```bash
pnpm exec vitest run src/photos/stores/__tests__/smartViews.test.ts
```

预期 FAIL（`createdAt` 是 `undefined`）。然后：

- `interface SmartView` 在 `evaluatedAt` 之后加一行：

```ts
  // Present on the wire since the backend's first version (service/smartview.go:23).
  // Carried here from SP15-P2b onward because the Albums page's global sort ranks
  // manual albums and smart albums against each other by creation time.
  createdAt: string
```

- `toSmartView` 在 `evaluatedAt` 之后加一行：

```ts
    createdAt: String(r.createdAt ?? ''),
```

再跑，预期绿。

- [ ] **Step 9: 写失败测试（两个 store 的 convert action）**

smartViews store 测试追加（service mock 的形态照该文件既有用例）：

```ts
  it('convertFromAlbum unshifts the new smart view and returns it', async () => {
    // ...mock service.photos.convertAlbumToSmart -> { id: 'sv-new', name: 'N', createdAt: '2026-02-01T00:00:00Z' }
    const store = usePhotosSmartViews()
    const sv = await store.convertFromAlbum('al-1', { description: 'sunsets', threshold: 80 })
    expect(sv.id).toBe('sv-new')
    expect(store.smartViews[0].id).toBe('sv-new')
  })

  it('convertFromAlbum rethrows so the caller can keep its dialog open', async () => {
    // ...mock convertAlbumToSmart -> rejects
    const store = usePhotosSmartViews()
    await expect(store.convertFromAlbum('al-1', { description: 'x', threshold: 80 })).rejects.toBeTruthy()
    expect(store.smartViews).toHaveLength(0)
  })
```

albums store 测试追加：

```ts
  it('convertFromSmartView unshifts the new album and returns the raw object', async () => {
    // ...mock service.photos.convertSmartToAlbum -> { id: 'al-new', name: 'N', videoCount: 2 }
    const store = usePhotosAlbums()
    const album = await store.convertFromSmartView('sv-1')
    expect(album.id).toBe('al-new')
    expect(store.albums[0].id).toBe('al-new')
  })

  it('convertFromSmartView rethrows instead of swallowing the failure', async () => {
    // ...mock convertSmartToAlbum -> rejects
    const store = usePhotosAlbums()
    await expect(store.convertFromSmartView('sv-1')).rejects.toBeTruthy()
    expect(store.albums).toHaveLength(0)
  })
```

- [ ] **Step 10: 实现两个 action**

`src/photos/stores/smartViews.ts` —— 放在 `duplicateSmartView` 之后，并加进 `return {}`：

```ts
  // SP15-P2b: a manual album turns into a smart view in place. The backend pins every
  // existing member, deletes the album, and hands back the full new smart view, so the
  // only thing left to do here is put it at the head of the list — no refetch needed.
  //
  // Deviation from Vue2 (939a7d3a:PhotosAlbumsView.vue:728-743): its handler refetched
  // both lists and then pushed an optimistic copy as a belt-and-braces measure, because
  // its list page stays mounted while the detail panel swaps in. Here the caller
  // navigates to the new smart view's own route and any return to the list remounts and
  // refetches, so neither the double fetch nor the optimistic slot has anything to do.
  //
  // Rethrows on failure (this store's established contract, same as createSmartView):
  // the dialog decides what to show and stays open so the user can retry.
  async function convertFromAlbum(
    albumId: string | number,
    input: { description: string; threshold: number },
  ): Promise<SmartView> {
    const raw = await service.photos.convertAlbumToSmart(albumId, {
      description: input.description,
      threshold: input.threshold,
    })
    const created = toSmartView(raw)
    smartViews.value.unshift(created)
    return created
  }
```

`src/photos/stores/albums.ts` —— 放在 `saveAsAlbum` 之后，并加进 `return {}`：

```ts
  // SP15-P2b: a smart view solidifies into a manual album in place. Mirror image of
  // smartViews.convertFromAlbum — see its comment for why there is no refetch and no
  // optimistic slot. The raw backend object is stored as-is, matching this store's
  // convention of keeping albums unmapped (the views map them through albumToView).
  //
  // Rethrows on failure. Note this store's fetchAlbums deliberately swallows errors;
  // that is not the pattern to follow for a user-initiated write.
  async function convertFromSmartView(smartViewId: string): Promise<RawAlbum> {
    const raw = await service.photos.convertSmartToAlbum(smartViewId)
    const album = (raw ?? {}) as RawAlbum
    albums.value = [album, ...albums.value]
    return album
  }
```

**不要**给这两个 action 加 `busy` 守卫 —— 调用方（弹窗）自己持有 `converting` 状态并
用它 disable 按钮，在 store 里再加一层会让"失败后立刻重试"被静默吞掉。

- [ ] **Step 11: 跑测试确认通过**

```bash
pnpm exec vitest run src/photos/stores
```

- [ ] **Step 12: `AlbumView` 扩两个字段**

先在 `src/photos/util/__tests__/albumView.test.ts` 的 `albumToView` describe 里追加：

```ts
  it('carries videoCount and dateStart through for the detail sidebar and the global sort', () => {
    const v = albumToView({ id: 1, videoCount: 3, dateStart: '2025-06-01' }, 'x')
    expect(v.videoCount).toBe(3)
    expect(v.dateStart).toBe('2025-06-01')
  })
  it('defaults videoCount to 0 and dateStart to null when absent', () => {
    // videoCount is not omitempty on the wire (NimoOS-Photos service/types.go:179), so
    // the fallback only covers a partial fixture, not a real response.
    const v = albumToView({ id: 1 }, 'x')
    expect(v.videoCount).toBe(0)
    expect(v.dateStart).toBeNull()
  })
```

再改 `albumView.ts`：`interface AlbumView` 加

```ts
  videoCount: number // P2b: the detail sidebar's Videos cell
  dateStart: string | null // P2b: raw taken_at of the earliest member; drives the 'date' sort
```

`albumToView` 的返回对象加

```ts
    videoCount: Number(a.videoCount ?? 0),
    dateStart: (a.dateStart as string | undefined) || null,
```

跑 `pnpm exec vitest run src/photos/util/__tests__/albumView.test.ts`，预期绿。

- [ ] **Step 13: vue-tsc + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add -A
git commit -m "feat(photos): add the album <-> smart view conversion data layer

The two endpoints have existed on the backend since before this UI work
(route/v1/smartviews.go FromAlbum, route/v1/albums.go FromSmartView) and both
answer with the full new object, so the store actions just put it at the head of
their list; there is no refetch and no optimistic slot because the callers
navigate to the new detail route and any return to a list remounts it.

SmartView gains createdAt. The field has been on the wire from the start
(service/smartview.go:23) but the front-end type never carried it, and the
Albums page's forthcoming global sort ranks manual and smart albums against each
other by creation time -- without the field every smart album would silently
fall into the missing-value branch and the tests would pass for the wrong
reason.

AlbumView gains videoCount and dateStart for the detail sidebar's Videos cell
and the 'date' sort's earliest-member semantics."
```

---

## Task 2: 混排模型与全局排序（纯函数） ← 逐任务评审

**Files:**
- Create: `src/photos/util/mixedAlbums.ts`
- Create: `src/photos/util/__tests__/mixedAlbums.test.ts`
- Modify: `src/photos/util/albumView.ts`（**删除** `sortAlbums`）
- Modify: `src/photos/util/__tests__/albumView.test.ts`（删除 `sortAlbums` 的 describe）
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`（删 2 死键）
- Modify: `oss/manifest.mjs`

**Interfaces:**
- Consumes: `AlbumView`（含 T1 新加的 `videoCount`/`dateStart`）、`SmartView`（含 T1 的 `createdAt`）
- Produces（T3 依赖这些确切签名）：
  - `export type MixedSortId = 'created' | 'name' | 'name-r' | 'count' | 'date'`
  - `export type MixedAlbumItem = { kind: 'user'; id: string | number; view: AlbumView } | { kind: 'smart'; id: string; sv: SmartView }`
  - `export function buildMixedAlbums(views: AlbumView[], svs: SmartView[]): MixedAlbumItem[]`
  - `export function sortMixed(items: MixedAlbumItem[], sort: MixedSortId | string): MixedAlbumItem[]`
- **`sortAlbums` 不再存在。** T3 之后它零调用方，留着就是死导出。

---

- [ ] **Step 1: 写失败测试**

Create `src/photos/util/__tests__/mixedAlbums.test.ts`：

```ts
// SP15-P2b-T2: the mixed manual/smart album list and the global sort that ranks both
// kinds against each other. Ported from Vue2 939a7d3a:PhotosAlbumsView.vue:381-393
// (smartAlbums / mixedAlbums) and :670-700 (applySort).
import { describe, it, expect } from 'vitest'
import { buildMixedAlbums, sortMixed, type MixedAlbumItem } from '../mixedAlbums'
import type { AlbumView } from '../albumView'
import type { SmartView } from '../../stores/smartViews'

const view = (o: Partial<AlbumView>): AlbumView => ({
  id: 'u', title: '', cover: null, count: 0, dateRange: '',
  createdAt: null, dateEnd: null, videoCount: 0, dateStart: null, ...o,
})
const sv = (o: Partial<SmartView>): SmartView => ({
  id: 's', name: '', description: '', conds: [], threshold: 0, live: false,
  includeVideos: false, count: 0, addedThisWeek: 0, seeds: [], median: 0,
  storageBytes: 0, distribution: new Array(10).fill(0), evaluatedAt: '', createdAt: '', ...o,
})
const ids = (items: MixedAlbumItem[]) => items.map((i) => String(i.id))

describe('buildMixedAlbums', () => {
  it('tags each entry with its kind and keeps the payload reachable', () => {
    const out = buildMixedAlbums([view({ id: 'u1', title: 'A' })], [sv({ id: 's1', name: 'B' })])
    const user = out.find((i) => i.kind === 'user')
    const smart = out.find((i) => i.kind === 'smart')
    expect(user?.kind === 'user' && user.view.title).toBe('A')
    expect(smart?.kind === 'smart' && smart.sv.name).toBe('B')
  })

  it('surfaces the id at the top level so callers do not reach into the payload for keys', () => {
    const out = buildMixedAlbums([view({ id: 7 })], [sv({ id: 's1' })])
    expect(ids(out).sort()).toEqual(['7', 's1'])
  })
})

describe('sortMixed', () => {
  // Titles, counts and dates are deliberately staggered across the two kinds so that a
  // comparator that only ever looks at one kind's field cannot pass.
  const items = buildMixedAlbums(
    [
      view({ id: 'u1', title: 'Beta', count: 3, createdAt: '2026-01-01T00:00:00Z', dateStart: '2024-01-01' }),
      view({ id: 'u2', title: 'Delta', count: 9, createdAt: '2025-01-01T00:00:00Z', dateStart: '2026-01-01' }),
    ],
    [
      sv({ id: 's1', name: 'Alpha', count: 5, createdAt: '2026-06-01T00:00:00Z' }),
      sv({ id: 's2', name: 'Gamma', count: 1, createdAt: '' }),
    ],
  )

  it('sorts by name across both kinds, not smart-first', () => {
    expect(ids(sortMixed(items, 'name'))).toEqual(['s1', 'u1', 's2', 'u2'])
    expect(ids(sortMixed(items, 'name-r'))).toEqual(['u2', 's2', 'u1', 's1'])
  })

  it('sorts by photo count descending across both kinds', () => {
    expect(ids(sortMixed(items, 'count'))).toEqual(['u2', 's1', 'u1', 's2'])
  })

  // THE POINT OF THIS TASK. Vue2 939a7d3a:PhotosAlbumsView.vue:686-693 puts a missing
  // timestamp FIRST, with its own comment explaining why: treating it as epoch 0 would
  // bury it at the end instead. This is the opposite of what albumView.sortAlbums used
  // to assert ("缺失记 0 排最后"), and reverting it is a regression, not a cleanup.
  it('ranks a missing createdAt FIRST, not last', () => {
    expect(ids(sortMixed(items, 'created'))).toEqual(['s2', 's1', 'u1', 'u2'])
  })

  it('ranks a missing date FIRST too, and reads dateStart for manual albums', () => {
    // u2's dateStart (2026) beats u1's (2024) even though u1 was created later, which is
    // what proves 'date' does not just fall through to createdAt for manual albums.
    // Smart albums have no earliest-member aggregate, so they fall back to createdAt
    // (Vue2 :684) -- a real degradation, not a defect.
    expect(ids(sortMixed(items, 'date'))).toEqual(['s2', 'u2', 's1', 'u1'])
  })

  it('leaves the order untouched for an unknown sort id', () => {
    expect(ids(sortMixed(items, 'zzz'))).toEqual(ids(items))
  })

  it('does not mutate its input', () => {
    const before = ids(items)
    sortMixed(items, 'name')
    expect(ids(items)).toEqual(before)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm exec vitest run src/photos/util/__tests__/mixedAlbums.test.ts
```

预期：FAIL —— 模块不存在。

- [ ] **Step 3: 实现 `mixedAlbums.ts`**

Create `src/photos/util/mixedAlbums.ts`：

```ts
// SP15-P2b: the Albums page shows manual albums and smart albums in one grid, ranked
// against each other by a single sort control. Ported from Vue2
// 939a7d3a:PhotosAlbumsView.vue:381-393 (smartAlbums / mixedAlbums) and :670-700
// (applySort).
//
// This lives in a pure module rather than in the view for one reason: the comparators
// have to read a different field per kind and treat a missing timestamp specially, and
// that is exactly the kind of branch where a component-level test passes for the wrong
// reason (the same trap momentLayout.ts was pulled out for in P1).
//
// Deviation from Vue2, registered: its `applySort` sorts in place and returns the same
// array. Here it returns a new one, matching the convention the rest of this directory
// already follows.
//
// Supersedes albumView.sortAlbums, which was deleted in the same commit: once the page
// renders a mixed list there is no caller left for an AlbumView-only comparator, and
// keeping both would mean two copies of the same comparators drifting apart.
import type { AlbumView } from './albumView'
import type { SmartView } from '../stores/smartViews'

export type MixedSortId = 'created' | 'name' | 'name-r' | 'count' | 'date'

export type MixedAlbumItem =
  | { kind: 'user'; id: string | number; view: AlbumView }
  | { kind: 'smart'; id: string; sv: SmartView }

// Vue2 :392 concatenates smart then user and lets the sort decide the final order; the
// same here. The pre-sort order is only observable through the 'unknown sort id' path.
export function buildMixedAlbums(views: AlbumView[], svs: SmartView[]): MixedAlbumItem[] {
  return [
    ...svs.map((sv): MixedAlbumItem => ({ kind: 'smart', id: sv.id, sv })),
    ...views.map((view): MixedAlbumItem => ({ kind: 'user', id: view.id, view })),
  ]
}

function titleOf(item: MixedAlbumItem): string {
  return item.kind === 'smart' ? item.sv.name : item.view.title
}

function countOf(item: MixedAlbumItem): number {
  return item.kind === 'smart' ? item.sv.count : item.view.count
}

// null means "no usable timestamp". Kept distinct from 0 on purpose -- see byMsDesc.
function msOf(raw: string | null | undefined): number | null {
  if (!raw) return null
  const t = Date.parse(raw)
  return isNaN(t) ? null : t
}

function createdMs(item: MixedAlbumItem): number | null {
  return msOf(item.kind === 'smart' ? item.sv.createdAt : item.view.createdAt)
}

// Vue2 :679-685. A manual album's 'date taken' is the taken_at of its earliest member;
// a smart album has no equivalent aggregate on the wire, so it falls back to createdAt.
// That fallback is a documented degradation, not a bug to fix here.
function dateTakenMs(item: MixedAlbumItem): number | null {
  if (item.kind === 'user') return msOf(item.view.dateStart)
  return createdMs(item)
}

// Vue2 :686-693, including the reason its comment gives: a missing timestamp sorts
// FIRST. Coercing it to 0 would send it to the very end instead, which is the opposite
// of the intent -- an album whose creation time cannot be compared should not be
// presented as the oldest thing in the library.
function byMsDesc(get: (i: MixedAlbumItem) => number | null) {
  return (a: MixedAlbumItem, b: MixedAlbumItem): number => {
    const av = get(a)
    const bv = get(b)
    if (av === null && bv === null) return 0
    if (av === null) return -1
    if (bv === null) return 1
    return bv - av
  }
}

export function sortMixed(items: MixedAlbumItem[], sort: MixedSortId | string): MixedAlbumItem[] {
  const arr = [...items]
  if (sort === 'name') arr.sort((a, b) => titleOf(a).localeCompare(titleOf(b)))
  else if (sort === 'name-r') arr.sort((a, b) => titleOf(b).localeCompare(titleOf(a)))
  else if (sort === 'count') arr.sort((a, b) => countOf(b) - countOf(a))
  else if (sort === 'date') arr.sort(byMsDesc(dateTakenMs))
  else if (sort === 'created') arr.sort(byMsDesc(createdMs))
  return arr
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm exec vitest run src/photos/util/__tests__/mixedAlbums.test.ts
```

全 8 例绿。若 `name` / `date` 两条的期望顺序与实现不符，**先手算一遍夹具**再改 —— 不要
为了让测试变绿而改期望值。

- [ ] **Step 5: 删除 `sortAlbums` 及其测试**

- `src/photos/util/albumView.ts`：删掉整个 `export function sortAlbums(...)`（含它上方
  那段 `// Verbatim port of PhotosAlbumsView.vue:359-370` 注释块）。在文件顶部注释里
  补一行：

```ts
// SP15-P2b: sortAlbums was removed here -- the Albums page now renders a mixed
// manual/smart list and sorts it through util/mixedAlbums.ts, which is the single
// remaining comparator implementation. albumToView / formatAlbumSpan / sortAlbumPhotos
// are unaffected and still have callers.
```

- `src/photos/util/__tests__/albumView.test.ts`：删掉整个 `describe('sortAlbums', …)`，
  并把 import 里的 `sortAlbums` 去掉。

- [ ] **Step 6: 删 2 个死 i18n 键**

`src/i18n/zh_cn.photos.ts` 与 `src/i18n/en_us.photos.ts` 各删两行：
`photosAlbumSortUpdated` / `photosAlbumSortUpdatedHint`。

> 这两个键此刻仍被 `PhotosAlbums.vue` 的 `sortOptions` 引用 —— **T2 结束时该文件会因此
> 编译不过**。这是刻意的顺序：T3 第一步就是重写 `sortOptions`。为了让 T2 能独立提交，
> **本步顺手把 `PhotosAlbums.vue` 的 `sortOptions` 里那一项与 `SortId` 里的 `'updated'`
> 一并删掉，并把 `sort` 的初值从 `'updated'` 改成 `'created'`**，其余不动（网格仍走
> 旧的 `views` computed —— T3 再换）。同时修 `src/views/__tests__/PhotosAlbums.test.ts`
> 里那条依赖 `默认 sort='updated'` 的断言（约 :135），改成断言默认 `created` 下按
> `createdAt` 降序。

- [ ] **Step 7: 跑相关测试 + 类型检查**

```bash
pnpm exec vitest run src/photos/util src/views/__tests__/PhotosAlbums.test.ts src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit
```

- [ ] **Step 8: 登记新测试文件**

`oss/manifest.mjs` 里 `src/photos` 是**整目录**剥离（见清单里那行 `'src/photos'`），
所以 `src/photos/util/__tests__/mixedAlbums.test.ts` **不需要**单独登记。
跑一次确认：

```bash
node oss/export.mjs --out /tmp/claude-1000/-home-nimo-NimoTech/4bd5688e-62a4-4e15-b431-6eedc1501e05/scratchpad/oss-t2 --no-commit --allow-dirty-oss
```

零泄漏即可。**若报出该文件**，说明整目录剥离的假设错了，按报错提示登记并在报告里写明。

- [ ] **Step 9: 提交**

```bash
git add -A
git commit -m "feat(photos): rank manual and smart albums with one comparator

The Albums page is about to show both kinds in a single grid, so the sort has to
read a different field per kind and can no longer live in an AlbumView-only
helper. sortAlbums is deleted rather than kept alongside the new module: with the
page on a mixed list it has no caller, and two copies of the same comparators
would drift.

The missing-timestamp rule is inverted from what this repo asserted before. Vue 2
puts an unusable createdAt first and says why -- coercing it to epoch 0 buries it
at the end, presenting an album whose creation time cannot be compared as the
oldest thing in the library. The test names that intent so a later reader does
not 'fix' it back.

The 'updated' sort option goes away with its two now-dead copy keys, and the
default moves to 'created'."
```

---

## Task 3: Albums 页混排网格 + AI 停更横幅 ← 逐任务评审

**Files:**
- Modify: `src/views/PhotosAlbums.vue`
- Modify: `src/views/__tests__/PhotosAlbums.test.ts`
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`（+1 键）

**Interfaces:**
- Consumes: `buildMixedAlbums` / `sortMixed` / `MixedAlbumItem` / `MixedSortId`（T2）、
  `usePhotosSmartViews`、`usePhotosSettingsStore`、`SmartViewCard`
- Produces（T4 依赖）：`PhotosAlbums.vue` 里的 `aiSmartViewOff` computed、
  `createOpen` / `newAlbumTitle` / `newAlbumSource` refs

**回源**：`git -C /home/nimo/NimoTech/NimoOS-UI show 939a7d3a:src/views/Photos/PhotosAlbumsView.vue`
的 `:39-133`（banner + body + 混排 section）、`:320-393`（computed）。

---

- [ ] **Step 1: 写失败测试**

在 `src/views/__tests__/PhotosAlbums.test.ts` 追加（mock 形态照该文件既有用例，
**smartViews store 也要 seed**）：

```ts
  it('renders smart albums and manual albums in one grid', async () => {
    // 2 manual + 1 smart => 3 cards plus the create tile.
    const w = await mountAlbums({
      albums: [{ id: 'u1', name: 'A' }, { id: 'u2', name: 'B' }],
      smartViews: [{ id: 's1', name: 'S', seeds: ['x'], conds: [], count: 4 }],
    })
    expect(w.findAll('[data-test="album-card"]')).toHaveLength(2)
    expect(w.findAll('[data-test="sv-card"]')).toHaveLength(1)
  })

  it('counts both kinds in the header total', async () => {
    const w = await mountAlbums({ albums: [{ id: 'u1', name: 'A' }], smartViews: [{ id: 's1', name: 'S' }] })
    expect(w.text()).toContain('2')
  })

  it('opens the smart view detail route when a smart card is clicked', async () => {
    const w = await mountAlbums({ albums: [], smartViews: [{ id: 's1', name: 'S' }] })
    await w.find('[data-test="sv-card"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/photos/smart-views/s1')
  })

  it('shows the smart-views-off banner only when the backend says it is off', async () => {
    const off = await mountAlbums({ albums: [], aiFeatures: { smartview: false } })
    expect(off.find('[data-test="albums-ai-banner"]').exists()).toBe(true)
    // Missing field and fetch failure both mean "on" -- never scare the user.
    const unknown = await mountAlbums({ albums: [], aiFeatures: {} })
    expect(unknown.find('[data-test="albums-ai-banner"]').exists()).toBe(false)
  })

  it('swaps the section subtitle for the nothing-yet copy when both kinds are empty', async () => {
    const empty = await mountAlbums({ albums: [], smartViews: [] })
    expect(empty.text()).toContain('还没有相册')
    const some = await mountAlbums({ albums: [{ id: 'u1', name: 'A' }], smartViews: [] })
    expect(some.text()).not.toContain('还没有相册')
  })

  it('keeps the manual grid alive when the smart view fetch fails', async () => {
    // fetchSmartViews swallows its own errors (store contract); the page must not gate
    // the manual half on it.
    const w = await mountAlbums({ albums: [{ id: 'u1', name: 'A' }], smartViewsFails: true })
    expect(w.findAll('[data-test="album-card"]')).toHaveLength(1)
  })
```

> `data-test="sv-card"` 是 `SmartViewCard.vue` 根节点上的既有标记 —— 先
> `grep -n 'data-test' src/photos/components/SmartViewCard.vue` 核实它的真实值，
> **用真实值，不要用本计划猜的**。若该组件没有 `data-test`，就在本任务里给它加一个
> （根节点，值 `sv-card`），并在报告里登记。

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts
```

- [ ] **Step 3: 加 1 个 i18n 键**

两个 locale 各加一行（按字母序插进 `photosAlbums*` 一族）：

```ts
  photosAlbumsNoneYetHint: '还没有相册——手动创建一个，或者让 Nimo 建一个会自动保持更新的智能相册。',
```

```ts
  photosAlbumsNoneYetHint: 'No albums yet — create one manually, or let Nimo build a Smart Album that keeps itself updated.',
```

- [ ] **Step 4: 改 `PhotosAlbums.vue` 的 script**

新增 import 与 store：

```ts
import SmartViewCard from '../photos/components/SmartViewCard.vue'
import { usePhotosSmartViews } from '../photos/stores/smartViews'
import { usePhotosSettingsStore } from '../photos/stores/settings'
import { buildMixedAlbums, sortMixed, type MixedSortId } from '../photos/util/mixedAlbums'
```

```ts
const smartViews = usePhotosSmartViews()
const settings = usePhotosSettingsStore()
```

`SortId` 类型换成 `MixedSortId`（删掉本文件里自己那份联合类型），`sort` 初值已在 T2
改成 `'created'`。`sortOptions` 五项（label/hint 沿用既有键，`created` 那项已存在）。

把 `views` computed 换成：

```ts
// SP15-P2b (Vue2 939a7d3a:PhotosAlbumsView.vue:391-393): one grid for both kinds, ranked
// by the single Sort control -- smart albums are no longer pinned to the front.
const mixedItems = computed(() =>
  sortMixed(
    buildMixedAlbums(
      albums.albums.map((a) => albumToView(a, t('photosAlbumUntitled'))),
      smartViews.smartViews,
    ),
    sort.value,
  ),
)
```

`isEmpty` 改成同时看两类；并加 AI 开关 computed：

```ts
const isEmpty = computed(() => albums.albumsLoaded && mixedItems.value.length === 0)

// Vue2 :79-85 moved this banner from the smart-views page to here along with the smart
// albums themselves. `=== false` is load-bearing: a missing field and a failed fetch both
// mean "on" (settings.ts already encodes that), and only an explicit off should warn.
const aiSmartViewOff = computed(() => settings.aiFeatures.smartview === false)
```

`onMounted` 里补两个 fetch（并行发起，**不要**用 `Promise.all` 串一个深链等待 ——
New-UI 没有 Vue2 那套 `_applyRouteDeepLink`）：

```ts
onMounted(() => {
  void albums.fetchAlbums()
  // Both fetches are fire-and-forget: the two halves of the grid render independently,
  // so a smart-view failure must not gate the manual albums. Vue2 :414-417 awaited both
  // because its deep-link arbitration needed them together -- New-UI has no such
  // arbitration (usePhotosDeepLinks sends ?smartview= straight to the detail route).
  void smartViews.fetchSmartViews()
  void settings.fetchAiFeatures()
  document.addEventListener('mousedown', onDocMousedown)
  document.addEventListener('keydown', onDocKeydown)
})
```

加智能卡片的打开函数：

```ts
function openSmartCard(id: string): void {
  router.push('/photos/smart-views/' + id)
}
```

- [ ] **Step 5: 改 `PhotosAlbums.vue` 的 template**

- 头部计数 `views.length` → `mixedItems.length`
- 在 `.albums-scroll` 内、`<section>` **之前**插 AI 横幅。**照 `PhotosSmartViews.vue:169-186`
  的既有 `.svs-banner` 标记与类名逐字复制过来**（含 `--dem-*` token 与那两条偏离登记
  注释的要点），`data-test` 改成 `albums-ai-banner`：

```html
        <div v-if="aiSmartViewOff" class="albums-ai-banner" data-test="albums-ai-banner">
          <div class="albums-ai-banner-icon">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
          </div>
          <div>
            <div class="albums-ai-banner-title">{{ t('photosSvSmartViewsAutoUpdate') }}</div>
            <div class="albums-ai-banner-desc">
              {{ t('photosSvTheseSavedSearchesStay') }}
              <RouterLink class="albums-ai-banner-link" data-test="albums-settings-link" to="/photos/settings?section=ai">{{ t('photosPeopleFacesOffLink') }}</RouterLink>
            </div>
          </div>
        </div>
```

- 分区副标题按空/非空二选一（Vue2 `:91-93`）：

```html
            <span class="albums-section-hint">
              {{ mixedItems.length ? t('photosAlbumsMineHint') : t('photosAlbumsNoneYetHint') }}
            </span>
```

- 网格 `v-for` 改成按 `kind` 分派（`album-create` 磁贴保持在最前，Vue2 `:96-100` 同位）：

```html
              <template v-for="item in mixedItems" :key="item.kind + '-' + item.id">
                <SmartViewCard v-if="item.kind === 'smart'" :sv="item.sv" @open="openSmartCard" />
                <div
                  v-else
                  class="album-card"
                  data-test="album-card"
                  :data-id="item.view.id"
                  @click="openCard(item.view)"
                >
                  <!-- 原有 album-card 内部结构整块保留,只把 view.xxx 换成 item.view.xxx -->
                </div>
              </template>
```

> ⚠ `:key` 必须带 kind 前缀（Vue2 `:104`/`:111` 同样用 `'sv-' + item.id` 与 `item.id`
> 两套 key）—— 手动相册的数字 id 与智能相册的字符串 id 可能撞。

- [ ] **Step 6: 补 `PhotosAlbums.vue` 的样式**

`.albums-ai-banner*` 四条规则从 `PhotosSmartViews.vue` 的 `.svs-banner*` 复制并改名。
**只改类名，取值一个字都不要动**（两页同一横幅，视觉必须一致）。另外：
`.album-grid` 的 `minmax(220px, 1fr)` 与 `SmartViewCard` 期待的 `minmax(320px, 1fr)`
不同 —— **不要改 `.album-grid`**。智能卡在 220px 列宽下会更窄，这是混排的既有代价，
Vue2 侧 `.album-grid-user` 也是同一处境（`photos.scss` 里两套网格各自独立）。
在样式块里就此写一条登记注释，说明为什么不统一列宽。

- [ ] **Step 7: 跑测试 + 类型检查 + color-guard**

```bash
pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts src/styles src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit
```

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "feat(photos): mix smart albums into the Albums grid

Smart albums now sit in the same grid as manual ones, ranked by the one Sort
control instead of being pinned to the front, and the smart-views-off banner
moves here with them.

The two fetches stay fire-and-forget. Vue 2 awaited both before applying deep
links because its album-vs-smartview arbitration needed them together; New-UI has
no such arbitration -- usePhotosDeepLinks sends ?smartview= straight to the detail
route -- so gating the manual half on the smart half would only mean a smart-view
outage blanks albums that loaded fine.

Grid keys carry a kind prefix: a manual album's numeric id and a smart album's
string id can otherwise collide."
```

---

## Task 4: 创建融合（嵌入式智能创建表单） ← 逐任务评审

**Files:**
- Modify: `src/photos/components/SmartViewCreateDialog.vue`
- Modify: `src/views/PhotosAlbums.vue`
- Modify: `src/photos/components/__tests__/SmartViewCreateDialog.test.ts`（追加）
- Modify: `src/views/__tests__/PhotosAlbums.test.ts`（追加）
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`（+4 键）

**Interfaces:**
- Consumes: T3 的 `aiSmartViewOff` / `createOpen` / `newAlbumTitle` / `newAlbumSource`
- Produces:
  - `SmartViewCreateDialog` props 变为
    `withDefaults(defineProps<{ open: boolean; embedded?: boolean; initialName?: string }>(), { embedded: false, initialName: '' })`
  - `PhotosAlbums.vue` 的 `SourceId` 增加 `'nimo'`

**回源**：`939a7d3a:src/views/Photos/PhotosSmartAlbumCreate.vue:1-30`（嵌入模式的两层
类名与理由）、`:232-241`（两个 prop）、`:271-277`（`effectiveName` / `canSubmit`）、
`:325`（`onScrimClick`）；`939a7d3a:PhotosAlbumsView.vue:147-225`（宿主面板）、
`:329-336`（四个 source）、`:519-530`（`selectSource` / `confirmCreate` 短路）、
`:575-578`（`onSmartAlbumCreated`）。

---

- [ ] **Step 1: 核对 `Let Nimo draft it` 两句的 zh 取值（只读）**

```bash
git -C /home/nimo/NimoTech/NimoOS-UI show 939a7d3a:src/assets/lang/zh_CN.json \
  | grep -n "Let Nimo draft it\|Describe the theme, let AI fill it in"
```

把实际值写进任务报告，并用它替换总表里 `photosSvLetNimoDraft` /
`photosSvLetNimoDraftHint` 的猜测值。**总表那两行是待核值，不是权威。**

- [ ] **Step 2: 写失败测试（弹窗嵌入模式）**

```ts
  it('embedded mode drops its own scrim, header and name field', async () => {
    const w = mountDialog({ open: true, embedded: true, initialName: 'Trip' })
    expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-close-btn"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-name-input"]').exists()).toBe(false)
  })

  it('embedded mode submits the host-supplied name, live as the host edits it', async () => {
    const w = mountDialog({ open: true, embedded: true, initialName: '' })
    // Empty host name => cannot submit even with a description present.
    await w.find('[data-test="sv-desc-textarea"]').setValue('sunsets')
    expect(w.find('[data-test="sv-confirm-btn"]').attributes('disabled')).toBeDefined()
    // The host field is the single source of truth, not a copy seeded on open, so a name
    // typed after picking the nimo option still arrives.
    await w.setProps({ initialName: 'Trip' })
    expect(w.find('[data-test="sv-confirm-btn"]').attributes('disabled')).toBeUndefined()
    await w.find('[data-test="sv-confirm-btn"]').trigger('click')
    expect(createSmartView).toHaveBeenCalledWith(expect.objectContaining({ name: 'Trip' }))
  })

  it('standalone mode still owns its scrim, header and name field', () => {
    const w = mountDialog({ open: true })
    expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-name-input"]').exists()).toBe(true)
  })

  it('embedded mode does not close on a click inside its own root', async () => {
    // The host panel owns the scrim; a stray self-click here must not shut the panel.
    const w = mountDialog({ open: true, embedded: true, initialName: 'Trip' })
    await w.find('[data-test="sv-embed-host"]').trigger('click')
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('embedded mode leaves Escape to the host', async () => {
    const w = mountDialog({ open: true, embedded: true, initialName: 'Trip' })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
  })
```

- [ ] **Step 3: 跑测试确认失败，然后实现弹窗侧**

props/emits：

```ts
const props = withDefaults(defineProps<{
  open: boolean
  // Vue2 939a7d3a:PhotosSmartAlbumCreate.vue:232-240. Embedded mode is what the Albums
  // page's "Let Nimo draft it" option renders in place of its own footer.
  embedded?: boolean
  initialName?: string
}>(), { embedded: false, initialName: '' })
```

名字取值（Vue2 `:271-273`）：

```ts
// Embedded mode reads the host's Album name field live rather than copying it into the
// draft on open. Vue2 :237-239 explains why: a one-time seed leaves the user stuck if
// they pick the nimo option before typing a name.
const effectiveName = computed(() => (props.embedded ? props.initialName : draft.name).trim())
```

`canSubmit` 与 `confirm` 里的 `draft.name.trim()` 全部换成 `effectiveName.value`。

Esc / 关闭（Vue2 `:325`）：

```ts
function close(): void {
  // In embedded mode the host panel owns dismissal -- it has the scrim, the Cancel
  // button and the Escape handler. Emitting from here would close the smart form while
  // leaving the host panel open around an empty hole.
  if (props.embedded) {
    emit('close')
    return
  }
  emit('update:open', false)
}
```

⚠ 这会引出一个契约问题：嵌入态"取消"要通知宿主关整个面板，而 `update:open` 语义是
"关我自己"。**加一个 `close` emit**：

```ts
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'created', id: string): void
  // Embedded mode only: the host closes its whole panel. Vue2 :322 emits the same event.
  (e: 'close'): void
}>()
```

`watch(() => props.open)` 里那段 `document.addEventListener('keydown', …)` 改成
**只在非嵌入态挂**：

```ts
      if (!props.embedded) document.addEventListener('keydown', onDocumentKeydown)
```

（`onUnmounted` / `else` 分支里的 `removeEventListener` 保持无条件调用 —— 摘一个没挂过的
监听是 no-op，加条件反而会在 prop 中途变化时漏摘。）

`confirm` 成功后：嵌入态 emit `created` + `close`；独立态维持现状。

template 两层根节点（Vue2 `:20-21`，含 `display:contents` 的理由）：

```html
  <Transition name="sv-modal">
    <div
      v-if="open"
      :class="embedded ? 'sv-embed-host' : 'sv-modal-scrim'"
      :data-test="embedded ? 'sv-embed-host' : 'sv-modal-scrim'"
      @click.self="onRootClick"
    >
      <div class="sv-modal" :class="{ 'sv-modal-embedded': embedded }" :role="embedded ? undefined : 'dialog'" :aria-label="embedded ? undefined : t('photosSvNewSmartView')">
        <div v-if="!embedded" class="sv-modal-head"> … 原样 … </div>
```

名字字段整段包 `v-if="!embedded"`；提交按钮文案嵌入态用 `photosSvCreateSmartAlbum`、
独立态维持 `photosSvCreateSmartView`。

```ts
function onRootClick(): void {
  if (!props.embedded) close()
}
```

样式（照 Vue2 `photos-smartview.scss` 那两条新规则，理由注释一并搬）：

```css
/* Embedded mode: this wrapper removes itself from the box model so the host panel's
   flex column hands the remaining height straight to .sv-modal, instead of this
   style-less div being sized by its content and then clipped. Vue2 photos-smartview.scss
   .sv-modal-embed-host. */
.sv-embed-host { display: contents; }
/* Strip only the standalone chrome (fixed width, radius, border, shadow, viewport-relative
   max-height) -- the host already provides those. The flex column and overflow:hidden stay,
   because .sv-modal-body / .sv-modal-form / .sv-modal-side rely on them for their own
   scrolling; without flex:1;min-height:0 a short viewport clips the submit button out of
   reach. */
.sv-modal.sv-modal-embedded {
  width: auto; max-width: none; max-height: none;
  flex: 1 1 auto; min-height: 0;
  background: transparent; border: 0; border-radius: 0; box-shadow: none;
}
```

- [ ] **Step 4: 跑弹窗测试确认通过**

```bash
pnpm exec vitest run src/photos/components/__tests__/SmartViewCreateDialog.test.ts
```

- [ ] **Step 5: 加 4 个 i18n 键**

`photosSvCreateSmartAlbum` / `photosSvLetNimoDraft` / `photosSvLetNimoDraftHint` /
`photosSvSmartViewsOffCreateHint`，取值见总表（前两条用 Step 1 核到的真值）。

- [ ] **Step 6: 写失败测试（宿主侧）**

```ts
  it('offers a fourth fill option that drafts a smart album', async () => {
    const w = await mountAlbums({ albums: [] })
    await w.find('[data-test="albums-new-btn"]').trigger('click')
    expect(w.find('[data-test="source-nimo"]').exists()).toBe(true)
  })

  it('disables the nimo option and explains why when smart views are off', async () => {
    const w = await mountAlbums({ albums: [], aiFeatures: { smartview: false } })
    await w.find('[data-test="albums-new-btn"]').trigger('click')
    const opt = w.find('[data-test="source-nimo"]')
    expect(opt.attributes('disabled')).toBeDefined()
    expect(opt.attributes('title')).toContain('智能视图已关闭')
    await opt.trigger('click')
    expect(w.find('[data-test="sv-embed-host"]').exists()).toBe(false)
  })

  it('swaps its own footer for the embedded smart form when nimo is picked', async () => {
    const w = await mountAlbums({ albums: [] })
    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.find('[data-test="source-nimo"]').trigger('click')
    expect(w.find('[data-test="sv-embed-host"]').exists()).toBe(true)
    // Two submit entry points side by side would be ambiguous, so the host footer goes.
    expect(w.find('[data-test="albums-confirm-create"]').exists()).toBe(false)
  })

  it('never creates an empty manual album when nimo is the picked source', async () => {
    // Vue2 :525-530 short-circuits here; the old behaviour created a throwaway album first.
    const w = await mountAlbums({ albums: [] })
    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.find('[data-test="albums-name-input"]').setValue('Trip')
    await w.find('[data-test="source-nimo"]').trigger('click')
    await w.find('[data-test="albums-name-input"]').trigger('keydown.enter')
    expect(createAlbum).not.toHaveBeenCalled()
  })

  it('closes the whole panel once the embedded form reports success', async () => {
    const w = await mountAlbums({ albums: [] })
    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.find('[data-test="source-nimo"]').trigger('click')
    w.findComponent(SmartViewCreateDialog).vm.$emit('created', 'sv-new')
    await nextTick()
    expect(w.find('[data-test="albums-create-modal"]').exists()).toBe(false)
    // Vue2 :575-578 stays on the list -- the new card is already there because the store
    // unshifted it. No navigation.
    expect(push).not.toHaveBeenCalledWith('/photos/smart-views/sv-new')
  })
```

- [ ] **Step 7: 实现宿主侧**

- `SourceId` 加 `'nimo'`；`sourceOptions` 加第 4 项（`label`/`hint` 用新键）
- 加 `nimoSourceDisabled`（= `aiSmartViewOff`，**不要**再写一个同义 computed，直接复用）
- source 按钮从 `@click="newAlbumSource = s.id"` 改成 `@click="selectSource(s)"`，并加
  `:disabled` 与 `:title`：

```ts
// Vue2 :521-524: clicking the disabled option is a no-op, the same defensive guard the
// old standalone New Smart Album button had.
function selectSource(s: { id: SourceId }): void {
  if (s.id === 'nimo' && nimoSourceDisabled.value) return
  newAlbumSource.value = s.id
}
```

- `confirmCreate` 顶部短路：

```ts
  // Vue2 :525-530: with nimo picked, the panel body *is* the smart form and it owns its
  // own submit. Falling through here used to create a throwaway empty manual album first.
  if (newAlbumSource.value === 'nimo') return
```

- 模态根节点加宽类：`:class="{ 'albums-modal-wide': newAlbumSource === 'nimo' }"`
- 面板脚 `v-if="newAlbumSource !== 'nimo'"`；其后挂嵌入表单：

```html
        <SmartViewCreateDialog
          v-if="newAlbumSource === 'nimo'"
          :open="true"
          embedded
          :initial-name="newAlbumTitle"
          @created="onSmartAlbumCreated"
          @close="closeCreate"
        />
```

```ts
function onSmartAlbumCreated(): void {
  // Vue2 :575-578: close the shared panel and stay on the list. The card is already
  // visible -- smartViews.createSmartView unshifted it -- so there is nothing to insert
  // and nowhere to navigate.
  closeCreate()
}
```

⚠ **把常驻挂载的那个 `<SmartViewCreateDialog>` 留在原处不要动** —— 本页原本没有它；
只新增这一个嵌入实例。它由 `v-if` 控制，因此**每次选中 nimo 都是全新挂载**，
`watch(open, …, { immediate: true })` 会在挂载时跑一次重置 —— 这正是需要的行为。

- 样式（Vue2 `photos.scss` 的 `.albums-modal.albums-modal-wide`）：

```css
/* The embedded form is a two-column layout (body + preview rail); 440px cannot hold it.
   Widen to the standalone dialog's own width and become a flex column so the embedded
   .sv-modal's flex:1 has something to fill. */
.albums-modal.albums-modal-wide {
  width: min(820px, 100%); max-height: calc(100vh - 80px);
  display: flex; flex-direction: column; overflow: hidden;
}
.albums-source-item:disabled { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 8: 跑测试 + 类型检查 + color-guard，然后提交**

```bash
pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts src/photos/components/__tests__/SmartViewCreateDialog.test.ts src/styles src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit
git add -A
git commit -m "feat(photos): fold smart-album creation into the New album panel

Picking 'Let Nimo draft it' now swaps the panel body for the smart-view form
instead of opening a second modal, and the host's own footer hides so there is
only ever one submit button on screen.

The embedded form reads the host's name field live rather than copying it once on
open: a user who picks the nimo option before typing a name would otherwise have
no way to supply one.

Escape and the scrim stay with the host in embedded mode. The dialog owning them
too would tear down the smart form while leaving the host panel open around an
empty hole.

confirmCreate short-circuits for the nimo source -- the old fall-through created
a throwaway empty album before handing off."
```

---

## Task 5: For You 专页 + 侧栏标签 + 回链改道

**Files:**
- Modify: `src/views/PhotosSmartViews.vue`
- Modify: `src/photos/components/PhotosSidebar.vue`
- Modify: `src/views/PhotosSmartViewDetail.vue`（**只改 3 处回链与文案**，其余留 T8）
- Modify: `src/views/PhotosSearch.vue`（1 处回链）
- Modify: `src/views/__tests__/PhotosSmartViews.test.ts`
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`（+2 键，−3 死键）

**Interfaces:**
- Consumes: 无新增
- Produces: `/photos/smart-views` 路由此后**只渲染 Moments**；`photosSvAllSmartViews` 不再存在

**回源**：`939a7d3a:src/views/Photos/PhotosSmartViewsView.vue` 全文（317 行）、
`939a7d3a:PhotosSidebar.vue:115-122`。

---

- [ ] **Step 1: 写失败测试**

```ts
  it('renders the Moments band as the page\'s only hero', async () => {
    const w = await mountSmartViews({ moments: [{ id: 'm1', title: 'T' }] })
    expect(w.find('h1').text()).toContain('时刻')
    // Everything the smart-view list used to own is gone from this page.
    expect(w.find('[data-test="sv-hero-create"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-create-card"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-skeleton"]').exists()).toBe(false)
    expect(w.findAll('[data-test="sv-card"]')).toHaveLength(0)
  })

  it('shows the slim settings hint instead of the band when smart views are off', async () => {
    const w = await mountSmartViews({ moments: [{ id: 'm1' }], aiFeatures: { smartview: false } })
    expect(w.find('[data-test="mo-section"]').exists()).toBe(false)
    expect(w.find('[data-test="mo-off-hint"]').exists()).toBe(true)
  })

  it('shows neither the band nor the hint when there are simply no moments', async () => {
    // The real device has zero rows in the moments table, so this is the everyday state.
    const w = await mountSmartViews({ moments: [] })
    expect(w.find('[data-test="mo-section"]').exists()).toBe(false)
    expect(w.find('[data-test="mo-off-hint"]').exists()).toBe(false)
  })

  it('no longer fetches the smart view list on this page', async () => {
    await mountSmartViews({ moments: [] })
    expect(fetchSmartViews).not.toHaveBeenCalled()
  })
```

侧栏与回链各一条：

```ts
  // PhotosSidebar.test.ts
  it('labels the smart-views entry For You after the IA merge', () => {
    expect(mountSidebar().find('[data-nav-id="smart-views"]').text()).toContain('为你推荐')
  })
```

```ts
  // PhotosSmartViewDetail.test.ts
  it('sends the back button to Albums, where smart albums now live', async () => {
    const w = await mountDetail({ sv: { id: 's1', name: 'S' } })
    await w.find('[data-test="sv-detail-back"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/photos/albums')
  })
```

> `data-test="sv-detail-back"` 现在**不存在**（`:547` 那个按钮没有标记）。本任务给三个
> 返回入口各加一个 `data-test`，值分别 `sv-detail-back` / `sv-not-found-back`（已有）/
> 删除后的跳转无 DOM（用 `push` 断言）。

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 加 2 键、删 3 死键**

加 `photosMoForYou`、`photosMoFollowsSmartViewSetting`。
删 `photosSvSavedSearchesStayLive`、`photosSvDescribeWantSetQuality`、
`photosSvAllSmartViews`（两个 locale 各删 3 行）。

- [ ] **Step 4: 瘦身 `PhotosSmartViews.vue`**

删掉：`SmartViewCard` / `SmartViewCreateDialog` 两个 import 与用法、`usePhotosSmartViews`
store 与 `store.fetchSmartViews()`、`createOpen` / `openCreate` / `onCardOpen` /
`onCreated` / `defineExpose({ createOpen })`、`.sv-hero` 整块、骨架屏整块、
`.sv-grid` 智能视图网格与新建卡整块，以及它们的全部样式规则
（`.sv-hero*` / `.sv-create-btn*` / `.sv-create-card*` / `.sv-skel-card`）。
`.sv-grid` 本体**保留** —— `.mo-grid` 与它并存叠加。

保留并改动：
- 原 `svs-banner`（完整版）**移除**，换成精简提示（Vue2 `:26-31`）：

```html
        <div v-if="showMoments" class="mo-section" data-test="mo-section"> … 原样 … </div>
        <!-- Vue2 :26-31: with the band hidden this page is nearly blank, so a one-line
             pointer to Settings replaces it. The full stop-updates banner moved to the
             Albums page along with the smart albums; it is not duplicated here. -->
        <div v-else-if="aiSmartViewOff" class="mo-off-hint" data-test="mo-off-hint">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
          <span>
            {{ t('photosMoFollowsSmartViewSetting') }}
            <RouterLink class="mo-off-hint-link" to="/photos/settings?section=ai">{{ t('photosPeopleFacesOffLink') }}</RouterLink>
          </span>
        </div>
```

- `.mo-hero h2` → `h1`（Vue2 `:19`：升为页面唯一 h1，字号仍 32px 不变），样式选择器
  同步改成 `.mo-hero h1`
- `.mo-off-hint` 的琥珀色一律用 `--dem-fg/--dem-bg/--dem-bd` 家族（与原 `.svs-banner`
  同款，**不要**写字面量）

- [ ] **Step 5: 侧栏标签**

`src/photos/components/PhotosSidebar.vue:44`：

```ts
  // SP15-P2b (Vue2 939a7d3a:PhotosSidebar.vue:118): the page behind this entry is now a
  // Moments-only "For You" page -- the smart albums moved into Albums. Only the label
  // changes; id and route stay so the ?view=smart deep link and the hide-when-off filter
  // keep working.
  { id: 'smart-views', route: '/photos/smart-views', labelKey: 'photosMoForYou' },
```

- [ ] **Step 6: 回链改道 4 处**

`src/views/PhotosSmartViewDetail.vue` 的 `:361` / `:540` / `:547` 与
`src/views/PhotosSearch.vue:499`：`'/photos/smart-views'` → `'/photos/albums'`。
两个按钮的文案 `photosSvAllSmartViews` → `photosAlbumBack`。在 `:547` 上方写偏离登记：

```html
            <!-- Deviation from Vue 2, registered. 939a7d3a:PhotosSmartViewDetail.vue:5 still
                 labels this button "All Smart Views" even though #112 made its @back return to
                 the Albums list -- Vue 2 shipped a button whose label lies about where it goes.
                 A misleading label is a user-visible defect rather than a styling choice, so
                 this port keeps Vue 2's destination and fixes the label, reusing the album
                 detail page's existing photosAlbumBack (PhotosAlbumDetail.vue:433) rather than
                 adding a key. photosSvAllSmartViews is deleted in the same commit. -->
```

- [ ] **Step 7: 跑测试 + 类型检查 + color-guard，然后提交**

```bash
pnpm exec vitest run src/views/__tests__ src/photos/components/__tests__/PhotosSidebar.test.ts src/styles src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit
```

> ⚠ 全 `src/views/__tests__` 都要跑：删掉 `defineExpose({ createOpen })` 与创建入口会
> 让 `PhotosSmartViews.test.ts` 里若干旧用例失效，那些用例要**删掉**（对应功能已迁走），
> 不是改断言让它继续绿。在报告里列出删了哪几条、各自迁到了 T3/T4 的哪条。

```bash
git add -A
git commit -m "feat(photos): slim the smart-views page into Moments For You

The smart-view grid, its hero, the create tile and the create dialog all moved to
the Albums page in the previous commits, so this page keeps only the Moments band
and promotes its heading to the page's single h1. The full stop-updates banner
went to Albums with the smart albums; a one-line pointer to Settings stands in
here, because with the band hidden the page would otherwise be blank.

Three back links and the search page's 'view smart views' link now go to Albums.
Vue 2 left these labelled 'All Smart Views' while sending the user to the album
list -- a button whose label lies about its destination. The destination is Vue 2's;
the label is not, and photosSvAllSmartViews is deleted rather than reworded."
```

---

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

## Task 7: 相册 → 智能相册

**Files:**
- Create: `src/photos/components/AlbumConvertToSmartDialog.vue`
- Create: `src/photos/components/__tests__/AlbumConvertToSmartDialog.test.ts`
- Modify: `src/views/PhotosAlbumDetail.vue`
- Modify: `src/views/__tests__/PhotosAlbumDetail.test.ts`
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`（+6 键）

**Interfaces:**
- Consumes: `smartViewsStore.convertFromAlbum`（T1）、`inferChips`（`../util/smartViewSuggest`）、
  `PhotosThreshSlider`（props `{ value, min?, max? }`，emit `input(v: number)`）、
  T6 的 `convertOpen` ref
- Produces:
  - `AlbumConvertToSmartDialog` props:
    `defineProps<{ open: boolean; albumId: string | number; albumName: string; albumCount: number }>()`
  - emits: `(e: 'update:open', v: boolean)` · `(e: 'converted', sv: SmartView)`

**回源**：`939a7d3a:PhotosAlbumDetail.vue:142-206`（弹窗模板）、`:294-298`（`convertChips`）、
`:310-345`（`openConvertModal` / `closeConvert` / `confirmConvert`）。

---

- [ ] **Step 1: 写失败测试（弹窗）**

```ts
  it('previews inferred conditions from the description, live', async () => {
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    expect(w.find('[data-test="convert-chips"]').exists()).toBe(false)
    await w.find('[data-test="convert-desc"]').setValue('sunsets in tokyo')
    expect(w.findAll('[data-test="convert-chip"]').length).toBeGreaterThan(0)
  })

  it('blocks submit until a description is present', async () => {
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    expect(w.find('[data-test="convert-submit"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="convert-desc"]').setValue('sunsets')
    expect(w.find('[data-test="convert-submit"]').attributes('disabled')).toBeUndefined()
    // Whitespace is not a description.
    await w.find('[data-test="convert-desc"]').setValue('   ')
    expect(w.find('[data-test="convert-submit"]').attributes('disabled')).toBeDefined()
  })

  it('sends only description and threshold, letting the backend parse the conditions', async () => {
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    await w.find('[data-test="convert-desc"]').setValue('  sunsets  ')
    await w.find('[data-test="convert-submit"]').trigger('click')
    expect(convertFromAlbum).toHaveBeenCalledWith('a1', { description: 'sunsets', threshold: 80 })
  })

  it('emits the new smart view and closes on success', async () => {
    convertFromAlbum.mockResolvedValue({ id: 'sv-new', name: 'A' })
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    await w.find('[data-test="convert-desc"]').setValue('sunsets')
    await w.find('[data-test="convert-submit"]').trigger('click')
    await flushPromises()
    expect(w.emitted('converted')?.[0]?.[0]).toMatchObject({ id: 'sv-new' })
    expect(w.emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('stays open and reports the failure inline so the user can retry', async () => {
    convertFromAlbum.mockRejectedValue(new Error('boom'))
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    await w.find('[data-test="convert-desc"]').setValue('sunsets')
    await w.find('[data-test="convert-submit"]').trigger('click')
    await flushPromises()
    expect(w.emitted('update:open')).toBeUndefined()
    expect(w.find('[data-test="convert-error"]').text()).toContain('转换失败')
    // Retry must be possible immediately -- the busy flag has to be cleared.
    expect(w.find('[data-test="convert-submit"]').attributes('disabled')).toBeUndefined()
  })

  it('reuses the existing duplicate-name copy for a 409', async () => {
    convertFromAlbum.mockRejectedValue({ response: { status: 409 } })
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    await w.find('[data-test="convert-desc"]').setValue('sunsets')
    await w.find('[data-test="convert-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="convert-error"]').text()).toContain('已存在')
  })

  it('refuses to close while the request is in flight', async () => {
    // Vue2 :317-320 guards closeConvert the same way.
    let release: (v: unknown) => void = () => {}
    convertFromAlbum.mockReturnValue(new Promise((r) => { release = r }))
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    await w.find('[data-test="convert-desc"]').setValue('sunsets')
    await w.find('[data-test="convert-submit"]').trigger('click')
    await w.find('[data-test="convert-cancel"]').trigger('click')
    expect(w.emitted('update:open')).toBeUndefined()
    release({ id: 'sv-new' })
  })

  it('resets the draft each time it opens', async () => {
    // Persistent mount + prop-driven visibility: reset belongs in watch(open), not
    // onMounted (this area's recurring trap).
    const w = mountConvert({ open: false, albumId: 'a1', albumName: 'A', albumCount: 12 })
    await w.setProps({ open: true })
    await w.find('[data-test="convert-desc"]').setValue('sunsets')
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    expect((w.find('[data-test="convert-desc"]').element as HTMLTextAreaElement).value).toBe('')
  })
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 加 6 个 i18n 键**

`photosAlbumConvertSuggestHint`、`photosAlbumConvertLockHint`、`photosAlbumConverting`、
`photosAlbumConvertedToSmart`、`photosAlbumConvertFailed`，取值见总表。
409 复用**既有** `photosAlbumNameExists`（不新增）。第 6 个是 `photosAlbumConvertToSmart`
—— T6 已加，本任务只是消费。**核一遍别重复加。**

- [ ] **Step 4: 实现 `AlbumConvertToSmartDialog.vue`**

结构照 `SmartViewCreateDialog.vue` 的 `.sv-modal-scrim` / `.sv-modal` / `.sv-modal-head` /
`.sv-modal-body`（**单列**：`grid-template-columns: 1fr`，本弹窗没有预览侧栏）/
`.sv-modal-foot` 五段；样式规则从该文件逐条复制（scoped 不跨组件）。要点：

```ts
const props = defineProps<{ open: boolean; albumId: string | number; albumName: string; albumCount: number }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'converted', sv: SmartView): void }>()

const desc = ref('')
const thresh = ref(80)
const converting = ref(false)
const errorText = ref('')

// Vue2 :296-298. Read-only preview: what actually takes effect is whatever the backend's
// svparser makes of `description`, so these chips are not editable and are not sent.
const chips = computed(() => inferChips(desc.value))
const canSubmit = computed(() => desc.value.trim().length > 0 && !converting.value)

// Persistent mount + prop-driven visibility, so the reset lives here rather than in
// onMounted -- this area's third repeat of that trap (see SmartViewCreateDialog's header).
watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  desc.value = ''
  thresh.value = 80
  errorText.value = ''
  converting.value = false
})

function close(): void {
  // Vue2 :317-320: no dismissal mid-flight, or the user loses track of whether it landed.
  if (converting.value) return
  emit('update:open', false)
}

async function submit(): Promise<void> {
  if (!canSubmit.value) return
  converting.value = true
  errorText.value = ''
  try {
    const sv = await smartViews.convertFromAlbum(props.albumId, {
      description: desc.value.trim(),
      threshold: thresh.value,
    })
    emit('converted', sv)
    emit('update:open', false)
    toast.show(t('photosAlbumConvertedToSmart'))
  } catch (e) {
    console.error('[album-convert-to-smart] submit', e)
    // Inline, not a toast: this answers the button the user just pressed, so it belongs
    // next to it and must not time out. A 409 reuses the album pages' existing wording
    // rather than adding a second phrasing of the same thing (Vue2's final review round
    // made the same call).
    errorText.value = isConflict(e) ? t('photosAlbumNameExists') : t('photosAlbumConvertFailed')
  } finally {
    // Cleared even on failure -- the dialog stays open precisely so retry is one click.
    converting.value = false
  }
}
```

模板要点（文案键对应总表）：标题 `photosAlbumConvertToSmart` + 副标题
`photosAlbumConvertToSmartHint`；描述 textarea 复用 `photosSvNimoMatch` /
`photosSvDescribePlainEnglishConditions` / `photosSvSunsetsSaraOurTokyo` 三个既有键；
chips 段标题 `photosAlbumConvertSuggestHint`（`v-if="chips.length"`）；阈值段用
`<PhotosThreshSlider :value="thresh" @input="thresh = $event" />` + `photosSvQualityThreshold`
+ `≥ {{ thresh }}%`；锁定提示 `photosAlbumConvertLockHint`（`{ n: albumCount }`）；
脚部 Cancel（`photosCancel`，`data-test="convert-cancel"`）+ 提交（`data-test="convert-submit"`，
文案 `converting ? photosAlbumConverting : photosAlbumConvertToSmart`）；
错误行 `<div v-if="errorText" class="convert-error" data-test="convert-error">`，
颜色用 `--remove-fg` token。

Esc 处理照 `SmartViewCreateDialog` 的 `watch(open)` 挂/摘 document 监听形态，
**且 `converting` 时 Esc 也不关**（走同一个 `close()`）。

- [ ] **Step 5: 跑弹窗测试确认通过**

- [ ] **Step 6: 详情页接线 + 测试**

`PhotosAlbumDetail.vue` 挂弹窗并处理成功：

```html
  <AlbumConvertToSmartDialog
    v-if="album"
    :open="convertOpen"
    :album-id="album.id"
    :album-name="album.title"
    :album-count="album.count"
    @update:open="convertOpen = $event"
    @converted="onConverted"
  />
```

```ts
// Vue2 :721-743 closes the album detail, refetches both lists, then opens the new smart
// view's detail. Here the navigation does all of that: the source album no longer exists
// server-side, and the destination route loads the new smart view itself. No refetch, no
// nextTick dance -- Vue2 needed those because two mergeQuery calls in one tick raced over
// the same query snapshot, and New-UI has no query-based deep link here at all.
function onConverted(sv: SmartView): void {
  void router.push('/photos/smart-views/' + sv.id)
}
```

详情页测试追加：

```ts
  it('navigates to the new smart view once the conversion lands', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [] })
    w.findComponent(AlbumConvertToSmartDialog).vm.$emit('converted', { id: 'sv-new' })
    await nextTick()
    expect(push).toHaveBeenCalledWith('/photos/smart-views/sv-new')
  })
```

- [ ] **Step 7: 登记新测试文件（若需要）+ 跑门 + 提交**

`src/photos/components/__tests__/` 在 `oss/manifest.mjs` 里由整目录 `'src/photos'` 覆盖，
预期**无需登记**。跑一次导出核实：

```bash
pnpm exec vitest run src/photos/components/__tests__/AlbumConvertToSmartDialog.test.ts src/views/__tests__/PhotosAlbumDetail.test.ts src/styles src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit
node oss/export.mjs --out /tmp/claude-1000/-home-nimo-NimoTech/4bd5688e-62a4-4e15-b431-6eedc1501e05/scratchpad/oss-t7 --no-commit --allow-dirty-oss
git add -A
git commit -m "feat(photos): let a manual album become a smart album

The more menu's Convert entry opens a dialog that takes a plain-language theme and
a quality threshold, previews the conditions inferred from the theme, and says
plainly that the current members stay locked in. Only the description and the
threshold are sent: the conditions that actually take effect are whatever the
backend's parser makes of the description, the same path Create takes, so
presenting the preview as a promise would be a lie.

Failure keeps the dialog open with an inline message and the button re-enabled,
because the answer belongs next to the button that was just pressed and retry
should be one click. A name collision reuses the album pages' existing wording.

Success simply navigates to the new smart view. Vue 2 also refetched both lists
and stepped through nextTick, but it had to: its list page stayed mounted and two
query rewrites in one tick raced over the same snapshot. Here the source album is
gone server-side and the destination route loads the smart view itself."
```

---

## Task 8: 智能相册 → 普通相册 + 活动流文案

**Files:**
- Modify: `src/views/PhotosSmartViewDetail.vue`
- Modify: `src/views/__tests__/PhotosSmartViewDetail.test.ts`
- Modify: `src/photos/components/SmartViewActivityFeed.vue`
- Modify: `src/photos/components/__tests__/SmartViewActivityFeed.test.ts`
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`（+7 键）

**Interfaces:**
- Consumes: `albumsStore.convertFromSmartView`（T1）
- Produces: 无（本任务是叶子）

**回源**：`git -C /home/nimo/NimoTech/NimoOS-UI diff 899af59b 939a7d3a -- src/views/Photos/PhotosSmartViewDetail.vue`
（78 行的完整 diff：菜单项、确认弹窗、`activityText` 分支、四个方法）。

---

- [ ] **Step 1: 写失败测试**

```ts
  it('offers Convert to regular album above the destructive separator', async () => {
    const w = await mountDetail({ sv: { id: 's1', name: 'S', count: 12 } })
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    const menu = w.find('[data-test="sv-more-menu"]')
    const html = menu.html()
    expect(menu.find('[data-test="sv-more-convert"]').exists()).toBe(true)
    // Grouped with rename/duplicate, i.e. before the separator, not next to Delete.
    expect(html.indexOf('sv-more-convert')).toBeLessThan(html.indexOf('sv-export-sep'))
  })

  it('asks for confirmation and spells out that the theme is discarded', async () => {
    const w = await mountDetail({ sv: { id: 's1', name: 'S', count: 12 } })
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-convert"]').trigger('click')
    expect(w.find('[data-test="sv-more-menu"]').exists()).toBe(false)
    const body = w.find('[data-test="sv-convert-confirm"]').text()
    expect(body).toContain('12')
    expect(body).toContain('主题与条件将被移除')
  })

  it('navigates to the new album on success', async () => {
    convertFromSmartView.mockResolvedValue({ id: 'al-new' })
    const w = await mountDetail({ sv: { id: 's1', name: 'S', count: 12 } })
    await openConvertConfirm(w)
    await w.find('[data-test="sv-convert-ok"]').trigger('click')
    await flushPromises()
    expect(push).toHaveBeenCalledWith('/photos/albums/al-new')
  })

  it('keeps the confirmation open with an inline message when it fails', async () => {
    convertFromSmartView.mockRejectedValue(new Error('boom'))
    const w = await mountDetail({ sv: { id: 's1', name: 'S', count: 12 } })
    await openConvertConfirm(w)
    await w.find('[data-test="sv-convert-ok"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="sv-convert-confirm"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-convert-error"]').text()).toContain('转换失败')
    expect(push).not.toHaveBeenCalledWith(expect.stringContaining('/photos/albums/'))
  })

  it('reuses the duplicate-name copy for a 409', async () => {
    convertFromSmartView.mockRejectedValue({ response: { status: 409 } })
    const w = await mountDetail({ sv: { id: 's1', name: 'S', count: 12 } })
    await openConvertConfirm(w)
    await w.find('[data-test="sv-convert-ok"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="sv-convert-error"]').text()).toContain('已存在')
  })

  it('one Escape closes the convert confirmation along with any other open overlay', async () => {
    // The existing invariant on this page: three independent ifs, never an early return.
    const w = await mountDetail({ sv: { id: 's1', name: 'S', count: 12 } })
    await openConvertConfirm(w)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(w.find('[data-test="sv-convert-confirm"]').exists()).toBe(false)
  })

  it('does not dismiss the confirmation mid-flight', async () => {
    let release: (v: unknown) => void = () => {}
    convertFromSmartView.mockReturnValue(new Promise((r) => { release = r }))
    const w = await mountDetail({ sv: { id: 's1', name: 'S', count: 12 } })
    await openConvertConfirm(w)
    await w.find('[data-test="sv-convert-ok"]').trigger('click')
    await w.find('[data-test="sv-convert-cancel"]').trigger('click')
    expect(w.find('[data-test="sv-convert-confirm"]').exists()).toBe(true)
    release({ id: 'al-new' })
  })
```

活动流测试追加：

```ts
  it('renders the converted-from-album event, with the locked-in count when available', () => {
    const w = mountFeed([{ id: '1', eventType: 'converted_from_album', detail: '', assetIds: ['a', 'b'], occurredAt: NOW }])
    expect(w.text()).toContain('锁定 2 张照片')
  })

  it('falls back to the count-free wording when the event carries no asset ids', () => {
    const w = mountFeed([{ id: '1', eventType: 'converted_from_album', detail: '', assetIds: [], occurredAt: NOW }])
    expect(w.text()).toContain('由相册转换而来')
    expect(w.text()).not.toContain('锁定')
  })

  it('still drops genuinely unknown event types', () => {
    const w = mountFeed([{ id: '1', eventType: 'no_such_thing', detail: '', assetIds: [], occurredAt: NOW }])
    expect(w.findAll('[data-test="sv-activity-row"]')).toHaveLength(0)
  })
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 加 7 个 i18n 键**

`photosSvConvertToAlbum`、`photosSvConvertToAlbumHint`、`photosSvConvertToAlbumTitle`、
`photosSvConvertToAlbumBody`、`photosSvConvertedToAlbum`、
`photosSvActConvertedFromAlbum`、`photosSvActConvertedFromAlbumN`。取值见总表。
失败文案复用 T7 已加的 `photosAlbumConvertFailed` 与既有 `photosAlbumNameExists`。

- [ ] **Step 4: 活动流两分支**

`SmartViewActivityFeed.vue`：`Kind` union 加 `'convertedFromAlbumN' | 'convertedFromAlbum'`，
`rows` 的 `switch` 加一个 case（放在 `renamed` 之后、`default` 之前）：

```ts
      // The backend records this when ConvertFromAlbum finishes; assetIds is the original
      // album's full membership, so the count is real when present. Absent is defensive
      // only -- keep the count-free wording rather than printing "0 photos locked in".
      case 'converted_from_album': {
        const n = (a.assetIds && a.assetIds.length) || 0
        out.push({ a, kind: n > 0 ? 'convertedFromAlbumN' : 'convertedFromAlbum', n })
        break
      }
```

模板里照该文件既有分支的形态加两行（**零 `v-html`**，这两句 Vue2 侧不含 `<b>`，
所以是纯文本插值，不需要 P7a 那套「主句键 + 加粗短语键」拆分）。

- [ ] **Step 5: 详情页菜单项 + 内联确认框**

菜单项插在 duplicate 之后、`<div class="sv-export-sep" />` **之前**（Vue2 diff 明写
「放在 Delete 分隔线上方，与 Rename/Duplicate 同组」），形态照该文件既有 `sv-export-item`：

```html
                  <button type="button" class="sv-export-item" data-test="sv-more-convert" @click="askConvertToAlbum">
                    <div class="sv-export-icon"> … album/plus svg … </div>
                    <div>
                      <div class="sv-export-title">{{ t('photosSvConvertToAlbum') }}</div>
                      <div class="sv-export-desc">{{ t('photosSvConvertToAlbumHint') }}</div>
                    </div>
                  </button>
```

确认框照该文件既有 `.sv-confirm-*` 整块复制（`:819-833`），改文案与 `data-test`，
**并加一行内联错误**：

```html
    <Transition name="sv-confirm">
    <div v-if="convertToAlbumOpen" class="sv-confirm-scrim" data-test="sv-convert-confirm" @click.self="closeConvertToAlbum">
      <div class="sv-confirm-panel">
        <div class="sv-confirm-icon"> … album svg … </div>
        <div class="sv-confirm-title">{{ t('photosSvConvertToAlbumTitle', { name: sv?.name }) }}</div>
        <div class="sv-confirm-body">{{ t('photosSvConvertToAlbumBody', { n: fmtNum(sv?.count ?? 0) }) }}</div>
        <div v-if="convertError" class="sv-confirm-error" data-test="sv-convert-error">{{ convertError }}</div>
        <div class="sv-confirm-foot">
          <button type="button" class="sv-confirm-cancel" data-test="sv-convert-cancel" :disabled="convertingToAlbum" @click="closeConvertToAlbum">{{ t('photosCancel') }}</button>
          <button type="button" class="sv-confirm-ok" data-test="sv-convert-ok" :disabled="convertingToAlbum" @click="doConvertToAlbum">
            {{ convertingToAlbum ? t('photosAlbumConverting') : t('photosSvConvertToAlbum') }}
          </button>
        </div>
      </div>
    </div>
    </Transition>
```

⚠ 提交按钮**不加** `.danger` —— 这不是破坏性删除，Vue2 用的也是 `trash-btn-cta`
（普通主行动）而非 danger 档。`.sv-confirm-error` 新增一条规则，颜色用 `--remove-fg`。

script：

```ts
const convertToAlbumOpen = ref(false)
const convertingToAlbum = ref(false)
const convertError = ref('')

function askConvertToAlbum(): void {
  moreOpen.value = false
  convertError.value = ''
  convertToAlbumOpen.value = true
}

function closeConvertToAlbum(): void {
  if (convertingToAlbum.value) return
  convertToAlbumOpen.value = false
}

async function doConvertToAlbum(): Promise<void> {
  const s = sv.value
  if (!s || convertingToAlbum.value) return
  convertingToAlbum.value = true
  convertError.value = ''
  try {
    const album = await albums.convertFromSmartView(s.id)
    convertToAlbumOpen.value = false
    toast.show(t('photosSvConvertedToAlbum'))
    // Vue2 :631-647 emits to its host, which closes the panel, refetches both lists and
    // opens the new album. Here the destination is a real route that loads the album
    // itself, and the smart view no longer exists server-side.
    void router.push('/photos/albums/' + String(album.id))
  } catch (e) {
    console.error('[photos-smartviews] convertToAlbum', e)
    convertError.value = isConflict(e) ? t('photosAlbumNameExists') : t('photosAlbumConvertFailed')
  } finally {
    convertingToAlbum.value = false
  }
}
```

⚠ **`anyOverlayOpen` 与 `onDocumentKeydown` 都要把 `convertToAlbumOpen` 加进去**
（该页硬约束：三个 `if` 各自独立、禁止提前 `return`；现在是四个）。
`onDocumentKeydown` 里那行走 `closeConvertToAlbum()` 而不是直接置 false ——
否则 Esc 能在请求在途时关掉弹窗，与 Cancel 的守卫不一致。

- [ ] **Step 6: 顺手清 P2a 挂账的中文注释**

`src/views/PhotosSmartViewDetail.vue` 约 `:1168-1173` 有一条 P2a 修复轮写下的**中文
模板注释**（P2a 台账 PARKED 项，明写「fold it into whichever task next edits that file」）。
本任务正在编辑该文件 ⇒ **翻成英文**，内容不变。先用
`grep -n "修复\|评审\|轮" src/views/PhotosSmartViewDetail.vue` 定位（行号会因本任务的
改动而漂移，不要照搬 1168）。

- [ ] **Step 7: 跑门 + 提交**

```bash
pnpm exec vitest run src/views/__tests__/PhotosSmartViewDetail.test.ts src/photos/components/__tests__/SmartViewActivityFeed.test.ts src/styles src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit
git add -A
git commit -m "feat(photos): let a smart album freeze into a regular one

The more menu gains the reverse of Task 7, grouped with rename and duplicate
rather than beside Delete, and its confirmation says all three consequences out
loud -- updates stop, the current members are fixed, the theme and conditions go
away. It is not dressed up as reversible.

Failure keeps the confirmation open with an inline message, matching the forward
direction. Escape routes through the same guard as Cancel, so an in-flight request
cannot be dismissed from the keyboard either; convertToAlbumOpen joins the page's
existing rule that one Escape closes every open overlay via independent ifs.

The activity feed learns converted_from_album. The backend records the original
album's full membership on that event, so the count is real when present; the
count-free wording is the defensive branch, not '0 photos locked in'.

Also translates the one Chinese template comment P2a parked for whichever task
next edited this file."
```

---

## Task 9: 收尾（六门 + 验收清单 + 整支终审）

**Files:**
- Create: `docs/superpowers/2026-08-10-sp15-p2b-acceptance.md`
- Modify: `oss/manifest.mjs`（若前面任务漏登记）
- Modify: `.superpowers/sdd/<本期目录>/progress.md`（台账）

**Interfaces:** 无

---

- [ ] **Step 1: 提交台账，让工作树干净**

```bash
rm -f .superpowers/sdd/.gitignore
git add -f .superpowers/sdd
git status --short   # 必须为空,oss 门断言干净工作树 —— 不要 stash 绕过
```

- [ ] **Step 2: 六门逐个跑（控制器亲自跑，不转述实现者的话）**

```bash
pnpm exec vue-tsc --noEmit
pnpm test
pnpm exec vitest run src/i18n/parity.test.ts
node oss/export.mjs --out /tmp/claude-1000/-home-nimo-NimoTech/4bd5688e-62a4-4e15-b431-6eedc1501e05/scratchpad/oss-final --no-commit --allow-dirty-oss
pnpm build
pnpm exec vitest run src/styles
```

把六个真实数字（文件数/用例数、parity 条数、oss 的 DELETE/REPLACE/PATCH 与泄漏数、
build 秒数、styles 条数）抄进台账。**预期 oss 门第一次可能红** —— 新测试文件只有提交
之后才对泄漏守卫可见（Global Constraints §7），补登记后重跑。

- [ ] **Step 3: 与 master 做只读合并预演**

```bash
git merge-tree --write-tree master HEAD >/dev/null && echo "no conflict" || echo "CONFLICT"
```

结论写进台账。**本期不合并**，只记录。

- [ ] **Step 4: 写验收清单**

Create `docs/superpowers/2026-08-10-sp15-p2b-acceptance.md`。**第 0 步必须逐字写上**：

> **第 0 步（必读，否则会验出假缺陷）**：`/photos/smart-views` 现在是「时刻 · 为你推荐」
> 专页。真机 `moments` 表是 **0 行**，Vue2 与 New-UI 都在无时刻时**隐藏整个分区** ⇒
> **打开这页看到近乎空白是预期行为，不是本期缺陷**。要看到内容，先在浏览器 F12 控制台
> 发一次 `POST /v1/photos/moments/recompute`（带 `localStorage` 里的 token；Photos 的
> localhost 白名单是 fail-closed 精确匹配，`curl` 直打必 401），再刷新。
> P1 与 P2a 已各栽一次同款假缺陷。

其余步骤按这个顺序写，每步都写清**从哪个 URL 出发、点什么、看什么**：

1. `/photos/albums` —— 手动 5 + 智能 9 混排共 14 张卡 + 新建磁贴；头部计数显示 14
2. Sort 下拉只有 5 项（**没有**「最近更新」）；默认「最近添加」；逐项切换，确认智能卡
   与手动卡**交错**出现而不是智能全在前
3. 点任意智能卡 → 落到 `/photos/smart-views/<id>` 详情；点返回 → 回 `/photos/albums`，
   按钮文案是「相册」
4. `新建相册` → 填名字 → 选「让 Nimo 起草」→ 面板变宽、出现双栏智能表单、原来的
   `取消/创建相册` 脚消失；此时**回头改名字**，确认提交按钮的可用性随之变化
5. 在嵌入表单里填主题 → 提交 → 面板整体关闭、新卡片立即出现在列表里（**不跳转**）
6. 设置里关掉 AI 智能视图开关 → `/photos/albums` 顶部出现完整停更横幅；`新建相册` 面板
   里「让 Nimo 起草」置灰且悬停有提示文字；`/photos/smart-views` 出现一行精简提示；
   侧栏「为你推荐」条目消失。**验完把开关打开**
7. 任意相册详情 → 右侧出现统计侧栏四格（照片数 / 时间跨度 / 视频 / 创建时间）+ 按月
   直方图；**滚动照片网格，确认侧栏不跟着滚**
8. 相册详情 `⋯` → 三项都有图标 + 标题 + 描述；`转为智能相册` 在分隔线上方
9. 点`转为智能相册` → 填主题（用**日期类**描述，如「2025 年 6 月」，避开语义条件）→
   提交 → 落到新智能相册详情；回 `/photos/albums` 确认原相册已消失、新智能相册在列表里
10. 该智能相册详情 `⋯` → `转为普通相册` → 确认框写明「主题与条件将被移除」+ 张数 →
    确认 → 落到新相册详情；右栏活动流出现「由相册转换而来 · 锁定 N 张照片」
11. 浅色 / 深色主题各走一遍第 1、4、7、10 步，确认无白底白字、无雾白
12. 侧栏 `为你推荐` 标签；地址栏手打 `/photos?view=smart` 确认仍落到该页

并写明**降级声明**：本机 9 个智能视图全是语义条件且从未评估（撞 BE-1，
`text.token_embedding.weight` 缺失）；新建的智能相册若用语义条件，匹配数恒 0 —— 照 SP14
`#136`/`#141` 的先例**提前声明，不假装验过**。第 9 步之所以指定日期类描述就是为了绕开它。

- [ ] **Step 5: 派整支终审（最强模型）**

一个 subagent，只读，输入是 `git diff master...HEAD` 全量 + spec + 本 plan。要求它专查
逐任务评审**结构上看不见**的东西：

- 跨任务不一致（T3 的 `mixedItems` 与 T4 的 `newAlbumSource` 交互、T6 的 `convertOpen`
  桩与 T7 的实体是否对齐）
- **「因为错的理由而通过」的测试**（本区已出现 4+5 次）：逐条问「把实现改坏，这条会红吗」
- 1:1 破坏：自己翻译的文案、照抄 token 名却换了视觉语境、Vue2 有而漏移植的行为
- 遗留死码/死键（`sortAlbums` 真的没了吗？5 个死键真的两个 locale 都删了吗？）
- 竞态：三个新弹窗的 `busy` 守卫与 Esc/scrim/Cancel 三条关闭路径是否一致
- CSS：注释里的 `*/`、裸色字面量、`:deep` 漏写、scoped 规则跨组件失效

修完后**重跑六门**并把新数字写进台账。

- [ ] **Step 6: 台账收尾**

在 `progress.md` 里写清：九个任务的提交哈希、六门最终数字、终审逮到了什么、
**挂账项**（未部署 / 未推 / 未合 master / 12 步验收一步未跑）、以及计划被实测推翻的每一处
（往期经验：每期都有 6–8 处，必须逐条留档）。

```bash
rm -f .superpowers/sdd/.gitignore
git add -f .superpowers/sdd docs/superpowers/2026-08-10-sp15-p2b-acceptance.md
git commit -m "docs(sp15): close the P2b ledger with gate results and the acceptance list"
```

---

## 自查（写完计划后逐条核过）

**Spec 覆盖**：§1.1 的 11 条 → T1(10) / T2(2) / T3(1) / T4(3,4) / T5(5,6) / T6(7) /
T7(8 前半) / T8(8 后半,9) / 全期(11)。§3 四条「照抄会错」→ T6-Step1(①) / T2(②) /
T1-Step10(③) / T1-Step8(④)。§5.2 回链表 → T5-Step6。§7 六门 → T9-Step2。§10 验收 → T9-Step4。
**无遗漏。**

**占位符**：无 TBD/TODO。三处刻意的「先核实再写」（T4-Step1 的两个 zh 取值、
T6-Step4 的两个统计标签键、T1 与 T5 的测试文件确切路径）都写明了核实命令与失败时的处置，
不是「自行决定」。

**类型一致**：`convertFromAlbum(albumId, {description, threshold})` 在 T1 定义、T7 消费，
签名一致；`convertFromSmartView(smartViewId)` 在 T1 定义、T8 消费，一致；
`MixedAlbumItem` / `sortMixed` 在 T2 定义、T3 消费，一致；`AlbumConvertToSmartDialog` 的
四个 prop 在 T7 的 Interfaces 与模板里一致；`SmartViewCreateDialog` 新增的 `close` emit
在 T4 内自洽（宿主绑 `@close="closeCreate"`）。
