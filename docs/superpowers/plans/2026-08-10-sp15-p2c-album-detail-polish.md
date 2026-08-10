# SP15-P2c 相册详情打磨累积 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Vue2 `#114`–`#117` 四个提交收敛出的相册详情终态移植到 New-UI —— 相册详情整页换用智能视图详情的骨架，两个详情页的动作区与 ⋯ 菜单对齐成同一形态，Albums 页智能卡改为与手动相册卡同构。

**Architecture:** 三个视图文件的渲染层改造 + 两个新地基（一个共享 composable、一个 service/store 扩展）。数据层（`buildMixedAlbums`/`sortMixed`/双向互转/store actions）全部保留不动。相册详情从「hero 横幅 + 工具条横带 + 两列 body」换成智能视图详情同款的「`sv-detail-bar` + `sv-detail-layout`（主列滚动 / 侧栏独立滚动）」；两页的 ⋯ 菜单统一成五项并共用一个 fixed 定位 composable。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript · Pinia · vue-i18n · vitest + @vue/test-utils（jsdom）· 手写 scoped CSS（无框架）

## Global Constraints

以下每一条对**每个任务**都生效，任务正文不再重复。

1. **1:1 比对基准是 Vue2 源码，不是本计划里的代码块。** 靶子 `33b05636`，取源码一律
   `git -C /home/nimo/NimoTech/NimoOS-UI show 33b05636:<path>`。本计划引用的行号与片段只是导航坐标；
   **实现前必须打开靶子源码逐段核对**。（依据：P1 整支终审发现「计划给的代码块本身违反了计划自己的
   1:1 条款」——计划漏带了主行动按钮的配色属性，而逐任务评审对着计划比对，结构上看不见。）
2. **注释、测试描述、提交信息一律英文。** 已有的中文注释在你改到那一段时顺手翻译，不做无关扫荡。
   （P2b 一期栽了四次，每次都是"在改一个本来就是中文的文件，所以跟着写中文"。提交前跑
   `git diff --cached | grep -nP '^\+.*[\x{4e00}-\x{9fff}]'`，命中项若不在 i18n 值里就是违规。）
3. **颜色一律走 theme token。** 禁止新增 `#hex`/`rgb()`/`rgba()`/具名色。Vue2 源码里的
   `#FF6B5C` 一类字面量对应 New-UI 的 `--remove-fg`；`rgba(255,107,92,0.14)` 一类半透明底用
   `color-mix(in srgb, var(--remove-fg) 14%, transparent)`。
4. **新增 i18n 键必须同时进 `src/i18n/zh_cn.ts` 与 `src/i18n/en_us.ts`**，否则 `parity.test.ts` 红。
   中文值一律用本计划 §i18n 表里的**已取证值**，不要自己译。
5. **CSS 注释里不要让 `*` 紧贴 `/`** —— 会提前关闭注释块并吞掉后面整条规则，而五道门全部看不见
   （类名白名单 / 裸色扫描 / color-guard 只看源文本，vue-tsc 不看 CSS，build 不报错，jsdom 不做布局）。
6. **每个任务结束时跑覆盖测试 + `pnpm exec vue-tsc --noEmit`，然后提交。** 全量 `pnpm test` 只在
   T11 收尾跑一次（单次约 90 秒）。
7. **`oss/*.test.mjs` 断言工作树干净。** 台账/报告文件未提交时它报的失败是假红。跑它之前先提交。
8. **提交台账前先 `rm -f .superpowers/sdd/.gitignore`** —— `review-package` 脚本每跑一次就重建一次
   那个一行 `*` 的文件（机主 `0eec6ad` 专门删过它）。台账一律 `git add -f`。
9. **不部署、不推 origin、不合 master。**
10. **测试用例的 body 在本计划里有的写满、有的只给标题 —— 后者是有意为之，不是疏漏。**
    凡涉及组件 mount 的用例，夹具（mount 选项、store seed、mock 手法）**一律照该测试文件现有用例
    逐字抄**，不要照本计划编。理由：手编 fixture 在本仓已经栽过三次（裸信封 unwrap ×3、mdadm 丢
    faulty 行 ×1），而 P1 期计划里预测的用例数与 fixture 手法**全部**被实测推翻
    （`vi.spyOn(lb,'openAt')` 拦不住、`router.isReady()` 不等第二次导航、409 文案断言查的是个错译）。
    **给一个编造的 fixture，比给一个空 body 更危险** —— 前者会让实现者写出「因为错的理由而通过」的测试。
    标题即断言意图，是硬要求；实现路径由实现者读现场决定。**每个只给标题的用例都必须真的写出来并通过，
    不得跳过；跳过任何一条都要在报告里显式说明理由。**

---

## 取证结论（动手前已核实，直接用，不要重新调研）

| # | 事实 | 出处 |
|---|---|---|
| E1 | 后端 `GET /v1/photos/albums/:id/export` **已实现**，且在 JWT 豁免白名单（按路径后缀匹配） | `NimoOS-Photos/route/router.go:52`、`:178`；handler `route/v1/albums.go:84` |
| E2 | `exportFavoritesUrl()` 是同形前例，写法 `` return `/v1/photos/favorites/export${tokenQ('?')}` `` | `packages/service/src/photos.ts:140-141` |
| E3 | store 已有 `createAlbum`(`:97`) / `addAssetsToAlbum`(`:167`) / `saveAsAlbum`(`:205`)；service 已有 `batchAddToAlbum` | `src/photos/stores/albums.ts`、`packages/service/src/photos.ts:168` |
| E4 | **删 `SmartViewCard.vue` 与它的测试不需要改开源剥离清单** —— manifest 的 `DELETE` 表有 `'src/photos'` 整目录条目（`oss/manifest.mjs:90`），`src/photos/**` 下的文件被整体覆盖。`photosStripCoverage.test.mjs` 的 CASES 也只覆盖 `src/views`、`src/views/__tests__`、`packages/service/src` 三处 | `oss/manifest.mjs:90`、`oss/photosStripCoverage.test.mjs` 头部注释 |
| E5 | `.album-toolbar` 目前是**两条**兄弟选择器的锚点，删容器时必须重锚 | `src/views/PhotosAlbumDetail.vue:1021`、`:1026` |
| E6 | `sv-select-bar` 已存在于 SV 详情（P2a 建，带 `data-test="sv-select-bar"`），但 scoped ⇒ 相册详情要自写一份 CSS | `src/views/PhotosSmartViewDetail.assets.test.ts:180` 等 |
| E7 | **New-UI 的 SV 详情完全没有 Sort 与密度控件**（`sortBy`/`density`/`order-pill`/`sortMenu` 全仓零命中）⇒ T6 是新建，不是搬家 | grep `src/views/PhotosSmartViewDetail.vue` |
| E8 | SV 详情灯箱现在传的是 `store.matchedAssets`（未排序）⇒ T9 要改成排序后的列表 | `src/views/PhotosSmartViewDetail.vue:481` |
| E9 | `Photo.place` 字段存在，源自 `asset.placeName`，无则 `countryFromCoords` 按经纬度反查国家名 | `src/photos/util/assetToPhoto.ts:295`、`:367-373` |
| E10 | P2b 修的转换确认框在 `PhotosSmartViewDetail.vue`（`askConvertToAlbum`/`closeConvertToAlbum`/`doConvertToAlbum`，`:421-460`），**修复仍在** ⇒ `#117` 第一条子提交不重做 | `src/views/PhotosSmartViewDetail.vue:421` |

⚠️ **E4 推翻了 spec §2.3 的一句话**（"删文件必须同步开源剥离清单"）。spec 那句按当时未取证的判断写的，实际不需要。T10 据此简化，spec 不改（保留原文可看出判断是怎么修正的）。

---

## i18n 值表（全部已从靶子 `33b05636:src/assets/lang/zh_CN.json` 取证，禁止自行翻译）

New-UI 键名按本仓 `photosXxx` 驼峰惯例新造；中文值用下表右列。英文值用 Vue2 的键名原文。

| New-UI 键名 | Vue2 键 | zh_cn 值 | 用在 |
|---|---|---|---|
| `photosDetailAbout` | `About` | 关于 | T4 |
| `photosDetailType` | `Type` | 类型 | T4 |
| `photosDetailCreated` | `Created` | 创建于 | T4 |
| `photosDetailTimeSpan` | `Time span` | 时间跨度 | T4 |
| `photosDetailPlace` | `Place` | 地点 | T4 |
| `photosDetailCreatedAt` | `Created {date}` | 创建于 {date} | T3 |
| `photosDetailItems` | `items` | 项 | T3 |
| `photosDetailVideos` | `videos` | 视频 | T3 |
| `photosSortLabel` | `Sort:` | 排序： | T3/T6 |
| `photosSortManual` | `Manual order` | 手动排序 | T3 |
| `photosSortTaken` | `Date taken` | 拍摄日期 | T3/T6 |
| `photosSortAdded` | `Date added` | 添加日期 | T3 |
| `photosSortScore` | `Match score` | 匹配分数 | T6 |
| `photosDensityComfort` | `Comfortable` | 舒适 | T3/T6 |
| `photosDensityCompact` | `Compact` | 紧凑 | T3/T6 |
| `photosMenuRename` | `Rename` | 重命名 | T5/T7 |
| `photosMenuDuplicate` | `Duplicate` | 复制 | T5/T7 |
| `photosMenuDownloadZip` | `Download as ZIP` | 下载为 ZIP | T5/T7 |
| `photosMenuConvert` | `Convert` | 转换 | T5/T7 |
| `photosMenuDelete` | `Delete` | 删除 | T5/T7 |
| `photosMenuRenameAlbumHint` | `Change the album name` | 修改相册名称 | T5 |
| `photosMenuDuplicateHint` | `Copy the photos as a new album` | 把照片复制为一个新相册 | T5 |
| `photosMenuZipHint` | `{n} photos · ~{mb} MB` | {n} 张照片 · 约 {mb} MB | T5 |
| `photosMenuConvertToSmartHint` | `Turn into a Smart Album that keeps updating` | 转为持续自动更新的智能相册 | T5 |
| `photosMenuDeleteAlbumHint` | `Photos stay in your library` | 照片仍保留在你的图库中 | T5 |

**已存在、直接复用的键**（勿新造）：`photosAlbumLabel`(相册) · `photosMoStats`(统计) · `photosMoPhotos`(照片) ·
`photosAlbumStatVideos`(视频) · `photosCancel` · `photosPersonSelect` · `photosSvAddPhotos` ·
`photosSvPause`/`photosSvResume` · 智能视图关闭提示句（Vue2 `Smart Views are turned off — …` →
「智能视图已关闭——请在「设置 · AI 行为」中重新开启后再创建。」，New-UI 已有，T5 复用勿新造）。

**T11 要清理的孤儿键**：靶子里 `Rename album` / `Add condition` 两个键已**不存在**（改短 / 删功能所致）。
New-UI 对应的 `photosAlbumRename`、`photosAlbumRenameHint`、`photosAlbumConvertToSmart`、
`photosAlbumConvertToSmartHint`、`photosAlbumDelete`、`photosAlbumDeleteHint` 在 T5 换成新键后
是否还有消费者，T11 逐个 grep 后决定去留 —— **grep 确认零消费者才删**。

---

## 文件结构

| 文件 | 责任 | 任务 |
|---|---|---|
| `src/photos/composables/useFixedMenuPosition.ts`（新建） | ⋯ 菜单 fixed 定位：开时按触发按钮 rect 算位置、空间不足向上翻转、scroll/resize 时关闭 | T1 |
| `src/photos/composables/__tests__/useFixedMenuPosition.test.ts`（新建） | 上者的单测 | T1 |
| `packages/service/src/photos.ts` | 加 `exportAlbumZipUrl(id)` | T2 |
| `src/photos/stores/albums.ts` | 加 `duplicateAlbum(id)` | T2 |
| `src/views/PhotosAlbumDetail.vue` | 主战场：骨架换血 / 侧栏三节 / 菜单五项 / 编辑态浮条 | T3–T6 |
| `src/views/PhotosSmartViewDetail.vue` | 动作区重排 / 侧栏动作节 / 菜单五项 / 删 Add condition / 灯箱排序 | T6–T9 |
| `src/views/PhotosAlbums.vue` | 智能卡同构渲染 + 创建卡尺寸 | T10 |
| `src/photos/components/SmartViewCard.vue` + 其测试 | **删除** | T10 |
| `src/i18n/zh_cn.ts` / `en_us.ts` | 随各任务增删，T11 清孤儿 | T3–T11 |

---

## Task 1: `useFixedMenuPosition` composable

**Files:**
- Create: `src/photos/composables/useFixedMenuPosition.ts`
- Test: `src/photos/composables/__tests__/useFixedMenuPosition.test.ts`

**Vue2 源码坐标:** `33b05636:src/views/Photos/fixedMoreMenu.js`（全文 80 行，是个 Options API mixin）

**Interfaces:**
- Produces: `useFixedMenuPosition(open: Ref<boolean>, btnRef: Ref<HTMLElement | null>): { menuStyle: Ref<Record<string, string>> }`
  T5 与 T7 都会消费它。

**适配点（Vue2 mixin → Vue 3 composable）:**
- mixin 的 `data.moreMenuStyle` → 返回的 `menuStyle` ref；宿主用 `:style="menuStyle"` 绑到 `.sv-export-menu`
- mixin 的 `watch.moreOpen` → `watch(open, ...)`
- mixin 的 `beforeDestroy` → `onBeforeUnmount`（**Vue 3 里 `beforeDestroy` 已改名，照抄会静默不生效**）
- `this.$refs.moreBtn` → 传入的 `btnRef`
- 关闭时把 `open.value = false` 的写权交给 composable（scroll/resize 监听要能关菜单），所以 `open` 收
  `Ref<boolean>` 而不是只读值

**照搬不改的行为（逐条对应靶子）:**
- 估算高度 `340`（五项菜单）
- 右缘对齐：`right: (window.innerWidth - rect.right) + 'px'`
- `zIndex: 260`
- 向下展开 `top: (rect.bottom + 6) + 'px'`；空间不足**且上方空间更大**时向上翻转
  `bottom: (window.innerHeight - rect.top + 6) + 'px'`
- scroll 监听用 **capture**（`true`），否则捕获不到 `.sv-detail-side` 的内部滚动

- [ ] **Step 1: 写失败测试**

```ts
// src/photos/composables/__tests__/useFixedMenuPosition.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref, nextTick, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useFixedMenuPosition } from '../useFixedMenuPosition'

// Mounting a host component is what gives onBeforeUnmount an owner instance; calling the
// composable bare would warn and silently skip the teardown path this suite must cover.
function mountHost(rect: Partial<DOMRect>) {
  const open = ref(false)
  const btnRef = ref<HTMLElement | null>(null)
  let menuStyle!: ReturnType<typeof useFixedMenuPosition>['menuStyle']
  const Host = defineComponent({
    setup() {
      const el = document.createElement('button')
      el.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}), ...rect }) as DOMRect
      btnRef.value = el
      menuStyle = useFixedMenuPosition(open, btnRef).menuStyle
      return () => h('div')
    },
  })
  const wrapper = mount(Host)
  return { open, wrapper, get style() { return menuStyle.value } }
}

afterEach(() => { vi.restoreAllMocks() })

describe('useFixedMenuPosition', () => {
  it('opens downward and right-aligns to the button when there is room below', async () => {
    window.innerHeight = 1000
    window.innerWidth = 1200
    const h1 = mountHost({ top: 100, bottom: 130, right: 900 })
    h1.open.value = true
    await nextTick()
    expect(h1.style.position).toBe('fixed')
    expect(h1.style.top).toBe('136px')          // rect.bottom + 6
    expect(h1.style.right).toBe('300px')        // innerWidth - rect.right
    expect(h1.style.bottom).toBeUndefined()
    expect(h1.style.zIndex).toBe(260)
  })

  it('flips upward when the space below is smaller than the estimate and the space above is larger', async () => {
    window.innerHeight = 1000
    window.innerWidth = 1200
    // spaceBelow = 1000 - 900 = 100 < 340, and rect.top (870) > 100 -> flip
    const h1 = mountHost({ top: 870, bottom: 900, right: 900 })
    h1.open.value = true
    await nextTick()
    expect(h1.style.bottom).toBe('136px')        // innerHeight - rect.top + 6
    expect(h1.style.top).toBeUndefined()
  })

  it('does not flip when the space below is short but the space above is even shorter', async () => {
    window.innerHeight = 400
    window.innerWidth = 1200
    // spaceBelow = 400 - 300 = 100 < 340, but rect.top (270) > 100 -> flips.
    // Use a genuinely smaller top to prove the second half of the condition is load-bearing.
    const h1 = mountHost({ top: 50, bottom: 300, right: 900 })
    h1.open.value = true
    await nextTick()
    expect(h1.style.top).toBe('306px')
    expect(h1.style.bottom).toBeUndefined()
  })

  it('closes the menu on a scroll anywhere in the page, including inside a scroll container', async () => {
    const h1 = mountHost({ top: 100, bottom: 130, right: 900 })
    h1.open.value = true
    await nextTick()
    // capture-phase listener: dispatching on an inner node must still reach it
    const inner = document.createElement('div')
    document.body.appendChild(inner)
    inner.dispatchEvent(new Event('scroll', { bubbles: false }))
    await nextTick()
    expect(h1.open.value).toBe(false)
  })

  it('closes the menu on resize', async () => {
    const h1 = mountHost({ top: 100, bottom: 130, right: 900 })
    h1.open.value = true
    await nextTick()
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(h1.open.value).toBe(false)
  })

  it('removes its listeners when the menu closes, so a later scroll cannot touch state', async () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const h1 = mountHost({ top: 100, bottom: 130, right: 900 })
    h1.open.value = true
    await nextTick()
    h1.open.value = false
    await nextTick()
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), true)
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('removes its listeners on unmount while still open', async () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const h1 = mountHost({ top: 100, bottom: 130, right: 900 })
    h1.open.value = true
    await nextTick()
    h1.wrapper.unmount()
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), true)
  })

  it('is a no-op when the trigger ref is null', async () => {
    const open = ref(false)
    const btnRef = ref<HTMLElement | null>(null)
    let style!: ReturnType<typeof useFixedMenuPosition>['menuStyle']
    const Host = defineComponent({
      setup() { style = useFixedMenuPosition(open, btnRef).menuStyle; return () => h('div') },
    })
    mount(Host)
    open.value = true
    await nextTick()
    expect(style.value).toEqual({})
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/photos/composables/__tests__/useFixedMenuPosition.test.ts`
Expected: FAIL —— `Failed to resolve import "../useFixedMenuPosition"`

- [ ] **Step 3: 实现**

```ts
// src/photos/composables/useFixedMenuPosition.ts
// SP15-P2c Task 1. Vue 3 port of Vue2's fixedMoreMenu.js mixin (33b05636:src/views/Photos/
// fixedMoreMenu.js), shared by both detail pages' sidebar "..." menus.
//
// Why fixed at all: the menu is a position:absolute child of .sv-detail-side, which is
// overflow-y:auto. Once the menu grew to five entries it no longer fit the sidebar's visible
// box and got clipped -- the owner reported it as "the menu is pinned under something".
// Switching to position:fixed and computing the coordinates from the trigger button's rect
// takes it out of the scroll container's clipping entirely.
//
// Owner ruling 2026-08-10 (spec 3.4): share the LOGIC, not the view. The menu markup and its
// CSS stay duplicated in each page -- P2b's keep-the-duplication ruling rests on scoped styles
// not crossing SFC boundaries, which says nothing about plain TypeScript.
import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

// Height of a five-entry menu, used only to decide the flip. Vue2 used the same constant and
// deliberately did not measure per-frame -- an estimate is enough for a flip decision.
const ESTIMATED_MENU_HEIGHT = 340

export function useFixedMenuPosition(
  open: Ref<boolean>,
  btnRef: Ref<HTMLElement | null>,
): { menuStyle: Ref<Record<string, string | number>> } {
  const menuStyle = ref<Record<string, string | number>>({})
  let onScrollOrResize: (() => void) | null = null

  function unbind(): void {
    if (!onScrollOrResize) return
    // Must pass the same capture flag that addEventListener used, or the removal is a no-op.
    window.removeEventListener('scroll', onScrollOrResize, true)
    window.removeEventListener('resize', onScrollOrResize)
    onScrollOrResize = null
  }

  function bind(): void {
    unbind()
    onScrollOrResize = () => { open.value = false }
    // Capture phase: a scroll inside .sv-detail-side does not bubble to window, so a
    // bubble-phase listener would never fire for the one container that matters most here.
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
  }

  function place(): void {
    const btn = btnRef.value
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const style: Record<string, string | number> = {
      position: 'fixed',
      right: `${window.innerWidth - rect.right}px`,
      zIndex: 260,
    }
    if (spaceBelow < ESTIMATED_MENU_HEIGHT && rect.top > spaceBelow) {
      style.bottom = `${window.innerHeight - rect.top + 6}px`
    } else {
      style.top = `${rect.bottom + 6}px`
    }
    menuStyle.value = style
    bind()
  }

  // A watcher rather than wiring every close site: open.value goes false from click-outside,
  // from the menu entries themselves, and from Escape. Centralising here means none of those
  // call sites has to remember to unbind.
  watch(open, (isOpen) => { if (isOpen) place(); else unbind() })

  onBeforeUnmount(unbind)

  return { menuStyle }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/photos/composables/__tests__/useFixedMenuPosition.test.ts`
Expected: PASS，8 例。

- [ ] **Step 5: 变异验证（必做，报告里逐条写结果）**

逐个改坏再改回，确认对应测试变红：
1. 把 `true`（capture）从 `addEventListener('scroll', …)` 去掉 → 「closes on a scroll inside a scroll container」应红
2. 把翻转条件的 `&& rect.top > spaceBelow` 删掉 → 「does not flip when the space above is even shorter」应红
3. 把 `onBeforeUnmount(unbind)` 删掉 → 「removes its listeners on unmount」应红

**任一条没变红就说明那条测试是白写的，必须先修测试再继续。**

- [ ] **Step 6: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add src/photos/composables/useFixedMenuPosition.ts src/photos/composables/__tests__/useFixedMenuPosition.test.ts
git commit -m "feat(photos): add the shared fixed-position menu composable"
```

---

## Task 2: service `exportAlbumZipUrl` + store `duplicateAlbum`

**Files:**
- Modify: `packages/service/src/photos.ts`（在 `exportFavoritesUrl` 附近，`:140`）
- Modify: `src/photos/stores/albums.ts`（在 `saveAsAlbum` 之后，`:205` 附近）
- Test: `packages/service/src/photos.albums.test.ts`、`src/photos/stores/__tests__/albums.test.ts`

**Interfaces:**
- Produces: `service.photos.exportAlbumZipUrl(id: string | number): string` —— T5 消费
- Produces: `albums.duplicateAlbum(id: string | number): Promise<RawAlbum>` —— T5 消费

**取证依据:** E1（后端端点已存在且 JWT 豁免）、E2（favorites 同形前例）、E3（store 已有组合件）。

**适配点:**
- Vue2 注释写「后端端点并行开发中」——**这句已过期**，端点 `route/router.go:178` 已实装。
- `exportAlbumZipUrl` 照抄 `exportFavoritesUrl` 的 `tokenQ('?')` 手法，路径换 `albums/${id}/export`。
- `duplicateAlbum` = `createAlbum(新名)` + `addAssetsToAlbum(新 id, 原成员 id 列表)`。
  新名规则照靶子：`33b05636:src/views/Photos/PhotosAlbumDetail.vue` 的 `duplicateAlbum` 方法，
  **实现前打开核对命名后缀与是否复制封面**。
- 复用 `saveAsAlbum` 还是新写，由实现者读完 `saveAsAlbum`(`:205`) 后决定；若复用，在注释里登记为什么
  它的语义正好吻合。**若两者语义不同（例如 saveAsAlbum 不搬顺序），必须新写，不要硬套。**
- 需要重入守卫（照 store 内既有 `duplicateBusy`(`smartViews.ts:170`) 的写法）——
  P1 终审逮到过「`doDelete` 是全页唯一没有重入守卫的写操作，双击会为一次成功的删除报失败」。

- [ ] **Step 1: 写失败测试（service 层）**

```ts
// packages/service/src/photos.albums.test.ts — append
it('builds the album zip export url with the auth token in the query', () => {
  setToken('tok123')
  expect(service.photos.exportAlbumZipUrl(7)).toBe('/v1/photos/albums/7/export?token=tok123')
})

it('builds the album zip export url without a query when there is no token', () => {
  setToken('')
  expect(service.photos.exportAlbumZipUrl(7)).toBe('/v1/photos/albums/7/export')
})
```

> `setToken` 的实际名字以该测试文件里 `exportFavoritesUrl` 现有用例的写法为准 —— **打开文件照抄它的
> 夹具，不要照本计划猜**（P2b 的 T1 就因为计划没提到 5 个夹具文件而让 vue-tsc 变红）。

- [ ] **Step 2: 写失败测试（store 层）**

```ts
// src/photos/stores/__tests__/albums.test.ts — append
it('duplicates an album by creating a new one and batch-adding the source members', async () => {
  const s = usePhotosAlbums()
  s.__resetForTest()
  // seed one album with two assets, then assert BOTH calls happen and in this order
  // (create first -- the batch-add needs the new id).
  const created = await s.duplicateAlbum('1')
  expect(createSpy).toHaveBeenCalledBefore(addSpy)
  expect(addSpy).toHaveBeenCalledWith(created.id, ['a1', 'a2'])
})

it('prepends the duplicate to the album list so it is visible without a refetch', async () => {
  // assert the new album is at index 0 of the store's list
})

it('ignores a second duplicate call while the first is still in flight', async () => {
  // the re-entry guard: fire twice without awaiting, assert createAlbum ran once
})

it('clears the in-flight guard after a failure so a retry can proceed', async () => {
  // first call rejects; a second call must still be able to run
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm exec vitest run packages/service/src/photos.albums.test.ts src/photos/stores/__tests__/albums.test.ts`
Expected: FAIL —— `exportAlbumZipUrl is not a function` / `duplicateAlbum is not a function`

- [ ] **Step 4: 实现两处**

service 层（`packages/service/src/photos.ts`，紧跟 `exportFavoritesUrl`）：

```ts
    // SP15-P2c Task 2. Same GET + token shape as exportFavoritesUrl above: the backend serves
    // this as a plain download URL the browser navigates to, and Photos exempts the
    // `/albums/:id/export` suffix from JWT so the query token is the only credential
    // (NimoOS-Photos route/router.go:52, :178).
    exportAlbumZipUrl(id: string | number): string {
      return `/v1/photos/albums/${id}/export${tokenQ('?')}`
    },
```

store 层（`src/photos/stores/albums.ts`，紧跟 `saveAsAlbum`）。下面是骨架，**成员 id 的取法与新名
规则必须先读靶子的 `duplicateAlbum` 方法核对**（`33b05636:src/views/Photos/PhotosAlbumDetail.vue`）：

```ts
  // SP15-P2c Task 2. Vue2 does this purely on the front end -- there is no duplicate endpoint
  // (33b05636 PhotosAlbumDetail.vue duplicateAlbum). Create the new album first, because the
  // batch add needs its id.
  const duplicateBusy = ref(false)
  async function duplicateAlbum(id: string | number): Promise<RawAlbum> {
    // Re-entry guard, same shape as smartViews.ts:170's duplicateBusy. Without it a double
    // click creates two albums, and P1's final review caught exactly this class of bug on the
    // one write path that lacked a guard.
    if (duplicateBusy.value) throw new Error('duplicate already in flight')
    duplicateBusy.value = true
    try {
      const source = albumById(id)
      if (!source) throw new Error('album not found')
      const assetIds = assetsOf(id).map((p) => p.id)
      const created = await createAlbum(/* name per the target's rule */)
      if (assetIds.length) await addAssetsToAlbum(created.id, assetIds)
      return created
    } finally {
      // Always clear, so a failed attempt does not wedge the button for the rest of the session.
      duplicateBusy.value = false
    }
  }
```

`createAlbum` 已经把新相册 prepend 进列表（见其实现），所以不需要再手动 unshift ——
**动手前确认这一点仍然成立**，若不成立则补，并在注释里登记。
`return` 时记得把 `duplicateAlbum` 与 `duplicateBusy` 一起加进 store 的返回对象
（SP17 栽过：Pinia store 的 ref 漏写 return 不报错，外部读恒 `undefined`）。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm exec vitest run packages/service/src/photos.albums.test.ts src/photos/stores/__tests__/albums.test.ts`

- [ ] **Step 6: 变异验证**

1. 去掉重入守卫 → 「ignores a second duplicate call」应红
2. 把 `tokenQ('?')` 换成写死 `''` → 「with the auth token」应红
3. 失败路径不清守卫 → 「clears the in-flight guard after a failure」应红

- [ ] **Step 7: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add packages/service/src/photos.ts packages/service/src/photos.albums.test.ts src/photos/stores/albums.ts src/photos/stores/__tests__/albums.test.ts
git commit -m "feat(photos): add album zip export url and album duplication"
```

---

> **2026-08-10 pre-flight 修正（控制器，执行前）**：原计划把「删 `.album-toolbar`」（T3）与
> 「编辑态按钮落到底部浮条」（原 T6）拆成两个任务 —— 但那两个按钮就住在被删的容器里，拆开会让
> T4/T5 两个任务期间功能缺失，且 T3 的既有测试无处可搬。**原 T6 已并入 T3**，`.sv-side-actions`
> 容器改由 T5 自建（原 T4 不再建空壳）。**任务数 12 → 11，原 T7-T12 顺延为 T6-T11。**
> 这与 P2b「删共享比较器 + 视图仍调用它」是同一形状的计划缺陷，这次在派工前扫出来了。

## Task 3: 相册详情骨架换血 + 编辑态底部浮条

**Files:**
- Modify: `src/views/PhotosAlbumDetail.vue`（模板 `:520-690`、CSS `:949-952`/`:1013-1026`、脚本 `coverBgImage` 等）
- Test: `src/views/__tests__/PhotosAlbumDetail.test.ts`

**Vue2 源码坐标:** `33b05636:src/views/Photos/PhotosAlbumDetail.vue:1-130`（顶栏 + 双栏骨架 + sv-header + 动作排 + 网格）

**这一步删掉的:**
- `.album-hero` / `.album-hero-bg` / `.album-hero-inner` / `.album-hero-text` / `.album-hero-badge` /
  `.album-hero-sub` / `.album-hero-actions` 整块（模板 `:522-629`）及其全部 CSS
- `coverBgImage` computed（脚本 `:112-120`）—— 删后 grep 确认 `--album-cover-fallback` token
  在 `PhotosAlbums.vue` 还有消费者，**token 本身不要删**
- `.album-toolbar` 整条横带（模板 `:631-690`）及 `.album-toolbar-muted`/`-spacer`/`-group` 三条 CSS
- `photosAlbumItemsShown` 键的使用（"{n} items shown" 与 stats 行的 "N items" 字面重复，Vue2 明确删掉）

**这一步建立的:**
- `.sv-detail-bar`：左 back「相册」（`photosAlbumBack`，P2b 已有），右 `photosDetailCreatedAt`
  （`createdLabel` 为占位符时整个 span 不渲染）
- `.sv-detail-layout` > `.sv-detail-main`（`.sv-header` + `.album-photos-wrap`）+ `aside.sv-detail-side`
- `.sv-header`：`<h1>`（标题 span 可点改名 / input 编辑态 / 日期胶囊 `.sv-cond` 同行）+ `.sv-header-stats`
- `.sv-actions`：`Sort:` 文案 + `.order-pill` 排序胶囊 + 分隔线 + Edit·Done + 分隔线 + 密度二钮
  - **Sort 与密度只在 `!edit` 时渲染；Edit·Done 常驻**
  - 两条 `.album-detail-actions-sep` 分隔线，只在相邻的 Sort/density 实际渲染时才带出
- **编辑态底部浮条 `.sv-select-bar`**（原 T6，pre-flight 并入本任务）：`.album-toolbar` 被删后
  「移除选中 / 添加照片」两个按钮的新家。形态与 SV 详情一致
  （**New-UI 参照物：`src/views/PhotosSmartViewDetail.vue` 的 `sv-select-bar`，E6，P2a 建**）。
  - SV 详情那份是 scoped ⇒ **自写一份 CSS**（延续 P2b 的 KEEP THE DUPLICATION 裁定），
    CSS 块上写一条登记注释指明与 `PhotosSmartViewDetail.vue` 同源
  - **保留既有的 `removing` 重入守卫**（`:69`，P2b 终审 Minor 6 加的），搬家时不要丢
  - 选中数为 0 时浮条不渲染（照 SV 详情既有行为）
  - 离开编辑态要清空选择态 —— P1 终审逮到过同类形状（「切 id 只清资产不清选择态 ⇒
    把 A 的照片 id 发给 B 的接口」）

**E5 重锚（关键，无自动门可见）:** 现有两条兄弟选择器

```
:1021  .album-toolbar[data-edit="true"] ~ .album-detail-body .tile[data-cover="true"]::after { display: none; }
:1026  .album-toolbar[data-edit="true"] ~ .album-detail-body .tile { outline: 1px dashed var(--card-border); outline-offset: -1px; }
```

靶子的做法是把编辑态标记打在网格容器自己身上：`<div class="album-photos-wrap" :data-edit="edit">`。
⇒ 两条改写成 `.album-photos-wrap[data-edit="true"] .tile…`，**不再是兄弟选择器**。
改完后 grep 全文件确认没有别的规则还以 `.album-toolbar` 或 `.album-detail-body` 为锚。

**适配点（New-UI 与 Vue2 的差异）:**
- Vue2 用内联 `style="…"` 写 h1 编辑态 input 的样式（含 `font-family:var(--font-display)`）。
  **本仓没有 `--font-display`**（P1 已登记）⇒ 用 `.sv-header h1` 已有的字体设定，input 只补必要的
  背景/边框/圆角，全部走 token，不写内联颜色。
- Vue2 的 `photos-icon` 组件 → New-UI 用内联 `<svg>`（照本文件既有 svg 的写法）。
- Vue2 `density === 'comfort'`，New-UI 现有值是 `'comfortable'`。**保持 New-UI 现值**，不要为了
  1:1 去改内部枚举（那是不可见的内部命名，改了会波及既有测试且无视觉收益）。

- [ ] **Step 1: 写失败测试**

```ts
// src/views/__tests__/PhotosAlbumDetail.test.ts — 新增一组
describe('P2c detail skeleton', () => {
  it('renders the detail bar with a back button and the created date', async () => {
    const w = await mountDetail()
    expect(w.find('.sv-detail-bar').exists()).toBe(true)
    expect(w.find('.sv-detail-bar .back').exists()).toBe(true)
  })

  it('omits the created date entirely when the album has no creation timestamp', async () => {
    // createdLabel falls back to the em-dash placeholder -> the span must not render at all
  })

  it('no longer renders the cover hero or the toolbar band', async () => {
    const w = await mountDetail()
    expect(w.find('.album-hero').exists()).toBe(false)
    expect(w.find('.album-toolbar').exists()).toBe(false)
  })

  it('renders the two-column layout with the main column and the sidebar', async () => {
    const w = await mountDetail()
    expect(w.find('.sv-detail-layout .sv-detail-main .sv-header').exists()).toBe(true)
    expect(w.find('.sv-detail-layout > .sv-detail-side').exists()).toBe(true)
  })

  it('puts the date range pill on the h1 row, not in a separate chips row', async () => {
    const w = await mountDetail({ dateRange: '2026-01 – 2026-03' })
    expect(w.find('.sv-header h1 .sv-cond').text()).toBe('2026-01 – 2026-03')
  })

  it('shows the items count and hides the videos count when there are no videos', async () => {
    // videoCount 0 -> only one stat span
  })

  it('hides sort and density in edit mode but keeps Edit/Done', async () => {
    const w = await mountDetail()
    await w.find('[data-test="album-edit-toggle"]').trigger('click')
    expect(w.find('.order-pill').exists()).toBe(false)
    expect(w.find('.density').exists()).toBe(false)
    expect(w.find('[data-test="album-edit-toggle"]').exists()).toBe(true)
  })

  it('marks the photo grid wrapper with the edit flag so the cover badge and tile outline rules can key off it', async () => {
    const w = await mountDetail()
    await w.find('[data-test="album-edit-toggle"]').trigger('click')
    expect(w.find('.album-photos-wrap').attributes('data-edit')).toBe('true')
  })

  it('still opens the lightbox from a tile click outside edit mode', async () => {
    // regression guard: the grid moved into a new container, the click path must survive
  })

  // ── 编辑态底部浮条（原 T6，pre-flight 并入）──
  it('shows the select bar only in edit mode with at least one selection', async () => {})
  it('removes the selected photos and keeps the guard against a double click', async () => {})
  it('opens the library picker from the select bar', async () => {})
  it('hides the select bar again after leaving edit mode', async () => {})
  it('clears the selection when leaving edit mode so a later edit session starts empty', async () => {})
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts`

- [ ] **Step 3: 改模板 + CSS + 脚本**

按上面「删掉的 / 建立的 / E5 重锚 / 适配点」四段执行。**打开靶子源码逐段比对**，不要照本计划的散文重建。

- [ ] **Step 4: 搬家既有测试**

`.album-toolbar` / `.album-hero` 的既有断言会红。**逐条搬家，不是删除** —— 每条断言在新结构里找到对应
落点。搬完后在任务报告里**逐条点名**列出：原断言 → 新家。
（依据：P1 Task 9 的 Step 0 搬走 8 条断言，报告说全部 re-home，评审逐条点名才发现第 8 条真丢了。）

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts src/i18n/parity.test.ts src/styles`

- [ ] **Step 6: 变异验证**

1. 把 `.album-photos-wrap` 的 `:data-edit="edit"` 删掉 → 「marks the photo grid wrapper」应红
2. 让 Sort/density 在编辑态也渲染 → 「hides sort and density in edit mode」应红
3. 把日期胶囊挪回独立 chips 行 → 「puts the date range pill on the h1 row」应红
4. 去掉 `removing` 重入守卫 → 「keeps the guard against a double click」应红
5. 离开编辑态不清选择态 → 「clears the selection when leaving edit mode」应红

- [ ] **Step 7: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add src/views/PhotosAlbumDetail.vue src/views/__tests__/PhotosAlbumDetail.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "refactor(photos): rebuild the album detail on the smart-view skeleton"
```

---

## Task 4: 相册详情侧栏三节

**Files:**
- Modify: `src/views/PhotosAlbumDetail.vue`（`aside.sv-detail-side` 内，现 `:731-760`）
- Test: `src/views/__tests__/PhotosAlbumDetail.test.ts`

**Vue2 源码坐标:** `33b05636:src/views/Photos/PhotosAlbumDetail.vue:145-300`（侧栏三节）
+ `:591-613`（`placesAgg`/`placesLabel`/`placesTitle`）+ `timeSpanLabel`

**建立:**
- About 节：`.sv-side-section` > `h3` + 四行 `.mo-about-row`（Type / Created / Time span / Place）
- Stats 节：**从 4 格裁到 2 格**（Photos / Videos），删掉 Span 与 Created 两格
- 按月直方图：**保持不动**（P2b Task 6 已建）

**新增 computed（照靶子实现，不要自创）:**
- `timeSpanLabel`：优先 `album.dateRange`；缺失时按已加载成员 `takenAt` 现算最早/最晚；都没有用占位符
- `placesAgg`：对已加载成员的 `p.place` 计频，按频次降序（E9：字段存在）
- `placesLabel`：前 3 个用 ` · ` 连接，多出的写 `+N`；空则占位符
- `placesTitle`：全部地点带计数，`name (count)` 用 ` · ` 连接；空则空串（给 `:title` 用）

**适配点:**
- Vue2 的占位符是字面量 `'—'`。New-UI 若已有占位符常量则复用；没有就用同一个 em dash，
  并让 T3 的「createdLabel 为占位符时不渲染 created span」与它判定一致 ——
  **两处必须用同一个来源**，否则改一处会静默漏另一处。

- [ ] **Step 1: 写失败测试**

```ts
describe('P2c detail sidebar', () => {
  it('renders the About section with type, created, time span and place rows', async () => {
    const w = await mountDetail()
    const rows = w.findAll('.sv-side-section .mo-about-row')
    expect(rows).toHaveLength(4)
  })

  it('shows the top three places joined by a middle dot and a +N remainder', async () => {
    // 5 distinct places -> "A · B · C +2", ordered by frequency not by first appearance
  })

  it('orders places by frequency, not by the order they appear in the asset list', async () => {
    // a place appearing once first and a place appearing three times later -> the frequent one leads
  })

  it('puts every place with its count in the title attribute', async () => {
    expect(w.find('[data-test="album-about-place"] b').attributes('title')).toBe('Paris (3) · Rome (1)')
  })

  it('falls back to the placeholder when no member has a place', async () => {
    // and the title attribute must be empty, not the placeholder
  })

  it('derives the time span from loaded members when the album carries no dateRange', async () => {
  })

  it('renders exactly two stat cells, photos and videos', async () => {
    const cells = w.findAll('.sv-stat-grid .sv-stat-cell')
    expect(cells).toHaveLength(2)
  })

  it('keeps the monthly histogram section', async () => {
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — `pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts`

- [ ] **Step 3: 实现侧栏三节 + 三个 computed**

- [ ] **Step 4: 跑测试确认通过** — 同上 + `src/i18n/parity.test.ts src/styles`

- [ ] **Step 5: 变异验证**

1. 把 `placesAgg` 的降序排序去掉 → 「orders places by frequency」应红
2. 把 Stats 恢复成 4 格 → 「exactly two stat cells」应红
3. 空地点时返回占位符而非空串给 `:title` → 「title attribute must be empty」应红

- [ ] **Step 6: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add src/views/PhotosAlbumDetail.vue src/views/__tests__/PhotosAlbumDetail.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(photos): give the album detail sidebar an About section and trim its stats"
```

---

## Task 5: 相册详情 ⋯ 菜单五项 + fixed 定位

**Files:**
- Modify: `src/views/PhotosAlbumDetail.vue`（`aside.sv-detail-side` 顶部）
- Test: `src/views/__tests__/PhotosAlbumDetail.test.ts`

**Vue2 源码坐标:** `33b05636:src/views/Photos/PhotosAlbumDetail.vue:212-283`（五项菜单全文）

**本任务自建 `.sv-side-actions` 容器**（pre-flight 修正：原计划让 T4 建空壳，改由这里连内容一起建），
位置在 `aside.sv-detail-side` 顶部、About 节之上。New-UI 只放 ⋯ 菜单一个按钮
（Slideshow 不做，spec §1.2），容器仍用 `flex-wrap` 形态以便与 SV 详情侧一致。

**Interfaces:**
- Consumes: T1 的 `useFixedMenuPosition(open, btnRef)`；T2 的 `exportAlbumZipUrl` / `duplicateAlbum`

**五项（顺序照靶子，不可调换）:** Rename · Duplicate · Download as ZIP · Convert · Delete

| 项 | 主标题 | desc | 行为 |
|---|---|---|---|
| Rename | `photosMenuRename` | `photosMenuRenameAlbumHint` | 关菜单 + `startTitleEdit()` |
| Duplicate | `photosMenuDuplicate` | `photosMenuDuplicateHint` | T2 的 `duplicateAlbum` |
| Download as ZIP | `photosMenuDownloadZip` | `photosMenuZipHint`（`{n}` = 张数，`{mb}` = `Math.round(count * 3.2)`） | 导航到 T2 的 URL |
| Convert | `photosMenuConvert` | `photosMenuConvertToSmartHint` | 现有 `openConvertModal`，`smartViewDisabled` 时置灰 + title 提示 |
| Delete | `photosMenuDelete` | `photosMenuDeleteAlbumHint` | 现有 `askConfirmDelete`，danger 配色 |

**适配点:**
- 主标题**改短**（`Rename album`→`Rename` 等），desc 行保留原文案区分语境 —— 这是 `#117` 的明确改动。
- Convert 的置灰提示句复用 New-UI 已有的智能视图关闭提示键，**不要新造近义文案**（Vue2 注释明写此意）。
- danger 配色：Vue2 用 `#FF6B5C` 内联，New-UI 用 `.sv-export-item-danger`（本文件 SV 详情侧已有同款）。
- `~{mb} MB` 的 3.2 是 Vue2 写死的每张估算 MB 数，**照抄这个常量**并在注释里登记它是估算而非真实体积。
- ⋯ 按钮需要两个 ref：`morePopRef`（click-outside 判定，已有）与新的 `moreBtnRef`（给 composable 取 rect）。
  **两个都要保留** —— composable 只管定位，不管 click-outside。

- [ ] **Step 1: 写失败测试**

```ts
describe('P2c album more menu', () => {
  it('renders exactly five entries in the target order', async () => {
    const titles = w.findAll('.sv-export-title').map((n) => n.text())
    expect(titles).toEqual(['重命名', '复制', '下载为 ZIP', '转换', '删除'])
  })

  it('duplicates the album and closes the menu', async () => {})

  it('does not fire a second duplicate while the first is in flight', async () => {})

  it('navigates to the zip url built by the service', async () => {})

  it('shows the estimated size in the zip entry description', async () => {
    // 10 photos -> "10 张照片 · 约 32 MB"
  })

  it('disables Convert and shows the smart-views-off title when the feature is off', async () => {})

  it('keeps Convert clickable when the feature is on', async () => {})

  it('applies the fixed position style to the menu when it opens', async () => {
    expect(w.find('.sv-export-menu').attributes('style')).toContain('position: fixed')
  })

  it('closes the menu when clicking outside it', async () => {
    // regression: morePopRef must still work now that the menu is position:fixed
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现菜单五项 + 接线 composable**

- [ ] **Step 4: 跑测试确认通过** — `pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts src/i18n/parity.test.ts src/styles`

- [ ] **Step 5: 变异验证**

1. 调换 Duplicate 与 Download as ZIP 的顺序 → 「five entries in the target order」应红
2. 去掉 `smartViewDisabled` 的 `:disabled` → 「disables Convert」应红
3. 不把 `menuStyle` 绑到菜单根节点 → 「applies the fixed position style」应红

- [ ] **Step 6: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add src/views/PhotosAlbumDetail.vue src/views/__tests__/PhotosAlbumDetail.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(photos): align the album menu on the five-entry shape"
```

## Task 6: SV 详情头部动作排重排 + Sort/密度新建

**Files:**
- Modify: `src/views/PhotosSmartViewDetail.vue`（`.sv-actions` `:663-705`）
- Test: `src/views/PhotosSmartViewDetail.test.ts`（或该页现有的测试文件，以实际文件名为准）

**Vue2 源码坐标:** `33b05636:src/views/Photos/PhotosSmartViewDetail.vue:45-90`

**⚠️ E7：New-UI 的 SV 详情完全没有 Sort 与密度控件 —— 本任务是新建，不是搬家。**

**终态头部 `.sv-actions` 排布:**
`Sort:` + 排序胶囊（`!edit`）→ 分隔线 → **Pause/Resume**（常驻）→ **Edit·Done**（常驻）→ 分隔线 → 密度二钮（`!edit`）

**排序选项（SV 侧只有两项，与相册侧的三项不同）:** `Match score`(`photosSortScore`) / `Date taken`(`photosSortTaken`)

**密度枚举值必须与相册侧一致**（T3 已确定沿用 New-UI 现值 `'comfortable'` / `'compact'`，
而不是 Vue2 的 `'comfort'`）。两页不一致会让共享的 `.density` CSS 与 `data-active` 判定各写一套。

**搬走的（去向 T7）:** Refine in search、⋯ 菜单
**改形态的:** Add photos + Select → 由 Edit·Done 一个按钮进出编辑态；Add photos 落到编辑态底部浮条

**适配点:**
- P2a 建的 `selecting` 状态与 `sv-select-bar` 已存在 ⇒ Edit·Done 复用 `selecting` 语义还是新建 `edit`，
  由实现者读完现有代码决定，**并在注释里登记选择理由**。若复用，注意按钮文案从「选择/取消」变成
  「编辑/完成」，对应键从 `photosPersonSelect`/`photosCancel` 换成 `photosSvEdit` 一类 ——
  **文案键换了，就要 grep 旧键是否还有别的消费者**。
- P2a 的既有测试会因选择器/文案变化而红：**逐条搬家，不是删除**，报告里逐条点名（同 T3 Step 4）。

- [ ] **Step 1: 写失败测试**

```ts
it('renders sort and density in the header outside edit mode', async () => {})
it('offers match score and date taken as the two sort options', async () => {})
it('keeps pause and edit visible in edit mode while sort and density disappear', async () => {})
it('no longer renders refine-in-search in the header', async () => {})
it('enters and leaves edit mode from the single edit toggle', async () => {})
it('shows add-photos in the bottom select bar rather than the header', async () => {})
```

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现**
- [ ] **Step 4: 搬家 P2a 既有测试，逐条点名**
- [ ] **Step 5: 跑测试确认通过**
- [ ] **Step 6: 变异验证** —— 让 Sort 在编辑态也渲染 → 对应用例应红；把 Refine 留在头部 → 「no longer renders」应红
- [ ] **Step 7: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add src/views/PhotosSmartViewDetail.vue src/views/PhotosSmartViewDetail*.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(photos): rebuild the smart-view header actions with sort and density"
```

---

## Task 7: SV 详情侧栏动作节 + ⋯ 菜单五项统一

**Files:**
- Modify: `src/views/PhotosSmartViewDetail.vue`（`aside.sv-detail-side` `:850+`、原菜单 `:705-780`）
- Test: `src/views/PhotosSmartViewDetail.test.ts`

**Vue2 源码坐标:** `33b05636:src/views/Photos/PhotosSmartViewDetail.vue:127-225`

**Interfaces:** Consumes T1 的 `useFixedMenuPosition`

**⚠️ 五项菜单在两页是「同一形态、不同后端」，不要跨页复用 T2 的相册版实现:**

| 菜单项 | 相册详情（T5） | 智能视图详情（本任务） |
|---|---|---|
| Duplicate | T2 新写的 `albums.duplicateAlbum` | **已有的 `smartViews.duplicateSmartView`**（`smartViews.ts:342`），不要改用相册版 |
| Download as ZIP | T2 新写的 `exportAlbumZipUrl`（`/albums/:id/export`） | **SV 页现有的 `downloadZip`**（走 `/smart-views/:id/export`），只搬位置不换端点 |
| Convert | 转成智能相册 | 转成普通相册（现有 `askConvertToAlbum`） |

两页的 Convert 是**方向相反**的两件事，共用的只有菜单里的位置与文案键。

**做:**
- 侧栏顶部新建 `.sv-side-actions`：**Refine in search**（从头部搬来）+ ⋯ 菜单按钮
- ⋯ 菜单从「Export 区两项 + 更多区四项」合并成**统一五项**：
  Rename · Duplicate · Download as ZIP · Convert · Delete
  - 原 Export 区的 ZIP（`sv-export-zip`）并入第三项
  - 原 Export 区的「存为静态相册」（`sv-export-album`）—— **打开靶子核对它在终态里是否还存在**；
    Vue2 的第四项 Convert 语义是"转为普通相册"，与"存为静态相册"可能是同一件事的两个入口。
    若是同一件事，合并并在注释里登记；若不是，报告里说明并保留。**不要凭本计划的猜测直接删。**
- 接 T1 的 fixed 定位

- [ ] **Step 1: 写失败测试**

```ts
it('renders the sidebar action section with refine and the more button', async () => {})
it('renders exactly five menu entries in the target order', async () => {})
it('no longer renders a separate export section in the menu', async () => {})
it('applies the fixed position style when the menu opens', async () => {})
it('still closes the menu on an outside click', async () => {})
it('keeps the convert-to-album confirmation flow working from the new entry', async () => {})
```

> 最后一条是防 P2b 那条 Important 复发（转换确认框的主行动配色 + Escape 守卫，E10）。

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现**
- [ ] **Step 4: 跑测试确认通过**
- [ ] **Step 5: 变异验证** —— 不绑 `menuStyle` → fixed 用例应红；打乱顺序 → 顺序用例应红
- [ ] **Step 6: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add src/views/PhotosSmartViewDetail.vue src/views/PhotosSmartViewDetail*.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(photos): move the smart-view actions into the sidebar and unify its menu"
```

---

## Task 8: 删除 SV 详情的 Add condition 入口

**Files:**
- Modify: `src/views/PhotosSmartViewDetail.vue`（`.sv-header-conds` `:648-652`）
- Modify: `src/photos/components/SmartViewConditionEditor.vue`（以实际路径为准）
- Test: 对应测试文件

**Vue2 源码坐标:** `33b05636:src/views/Photos/PhotosSmartViewDetail.vue:26-30`（注释说明）+ `:700-710`
（`openAddCond`/`closeAddCond`/`submitCond`/`addCondSuggestion` 四个方法被删）

**机主裁定（spec §3.3）:** 跟着删。这是 Vue2 侧的产品决定（注释原文「用户追加需求」），不是遗漏。

**做:**
- 删「添加条件」按钮与它的弹出层
- **保留** `remove`（条件胶囊上的 ✕）
- 删掉只服务于 add 的方法与状态；`grep` 确认删干净，无死代码残留
- 若 `SmartViewConditionEditor` 删掉 add 后只剩 remove，考虑组件是否还有存在必要 ——
  **由实现者判断并在报告里说明**，不要为了少改文件而留一个只剩一半的组件壳

- [ ] **Step 1: 写失败测试**

```ts
it('no longer offers an add-condition entry', async () => {
  expect(w.find('[data-test="sv-add-cond"]').exists()).toBe(false)
})
it('still lets a condition be removed from its chip', async () => {})
it('leaves no orphaned add-condition handlers behind', () => {
  // read the SFC source and assert the four removed identifiers are gone
})
```

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现删除**
- [ ] **Step 4: 跑测试确认通过**
- [ ] **Step 5: 死代码复查** — `grep -n "openAddCond\|closeAddCond\|submitCond\|addCondSuggestion\|addCond" src/`，
  以及被删 i18n 键的消费者复查（零消费者才删键）
- [ ] **Step 6: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add -A src/views/PhotosSmartViewDetail.vue src/photos/components/ src/i18n/
git commit -m "feat(photos): drop the add-condition entry from the smart-view detail"
```

---

## Task 9: SV 详情灯箱导航序对齐当前排序

**Files:**
- Modify: `src/views/PhotosSmartViewDetail.vue`（`:481` 的 `lb.openAt`）
- Test: `src/views/PhotosSmartViewDetail.assets.test.ts`

**Vue2 源码坐标:** `33b05636` 的 `#117` 子提交「SV 详情灯箱导航序对齐当前排序」

**取证依据 E8:** 现在传的是 `store.matchedAssets`（未排序）。T6 建立了 `sortBy` 后，网格按排序渲染，
而灯箱仍按原始顺序导航 ⇒ 用户在灯箱里按「下一张」会跳到屏幕上并不相邻的照片。

**Interfaces:** Consumes T6 的 `sortBy`

**做:** 把 `lb.openAt(p, store.matchedAssets, 0)` 的第二参数换成**与网格同一份排序后的列表**，
且起始下标要用该照片在排序后列表里的位置（**不是恒定 0**，除非现有实现的第三参数另有语义 ——
打开 `useLightbox` 核对 `openAt(photo, entryList, startMs?, query?)` 的第三参数究竟是什么，
P1 记忆里登记的签名第三参数是 `startMs`，不是下标）。

- [ ] **Step 1: 写失败测试**

```ts
it('hands the lightbox the same order the grid is showing', async () => {
  // switch sort to date-taken, click the third tile, assert the list passed to openAt
  // is the sorted list and its first element matches the grid's first tile
})
it('keeps the lightbox order in step after the sort changes while it is closed', async () => {})
```

- [ ] **Step 2: 跑测试确认失败**

> 注意 P1 的教训：`vi.spyOn(lb, 'openAt')` **拦不住** —— `useLightbox()` 每次返回新的对象字面量。
> 用该文件既有的 lightbox 断言手法（打开被测组件已 mock 的模块），不要照搬 spyOn。

- [ ] **Step 3: 实现**
- [ ] **Step 4: 跑测试确认通过**
- [ ] **Step 5: 变异验证** —— 把参数改回 `store.matchedAssets` → 首条应红
- [ ] **Step 6: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add src/views/PhotosSmartViewDetail.vue src/views/PhotosSmartViewDetail.assets.test.ts
git commit -m "fix(photos): open the lightbox in the order the smart-view grid shows"
```

---

## Task 10: Albums 页智能卡同构渲染 + 删 SmartViewCard

**Files:**
- Modify: `src/views/PhotosAlbums.vue`（`:411` 的 `<SmartViewCard>`、`:24` 的 import、CSS）
- Delete: `src/photos/components/SmartViewCard.vue`
- Delete: `src/photos/components/__tests__/SmartViewCard.test.ts`
- Test: `src/views/__tests__/PhotosAlbums.test.ts`

**Vue2 源码坐标:** `33b05636:src/views/Photos/PhotosAlbumsView.vue:93-146`（同构卡片 + 创建卡）

**做:**
1. 智能卡改成与手动相册卡同构的内联渲染：
   `.album-card` > `.album-cover`（`<img>` 取 `seeds[0]`，空则 `.album-cover-fallback`）
   + `.al-smart-badge`（Smart View 角标）+ `.al-live-dot`（Live/Paused 呼吸点）
   + `.album-title` + `.album-meta`（`{n} photos` · Live/Paused）
2. **不再上卡面:** 三图拼贴、条件 chips、阈值胶囊
3. `New album` 创建卡尺寸对齐相册卡：虚线框收窄到 `.album-create-cover`，
   外层补两行 `visibility:hidden` 的隐形文字行（与 `.album-title`/`.album-meta` 同规格），
   **不用硬编码 px** —— 随主题/字号自然对齐
4. 删 `SmartViewCard.vue` 与它的测试

**E4：删这两个文件不需要改开源剥离清单**（`oss/manifest.mjs:90` 的 `'src/photos'` 整目录条目已覆盖）。
删完仍要跑一次 `pnpm exec vitest run oss/` 确认（工作树先提交干净，见 Global Constraint 7）。

**保留不动:** `buildMixedAlbums` / `sortMixed` / `item.kind` / 网格 `:key` 的 kind 前缀。
（P2b Task 3 已查明 kind 前缀不可被测试观测 —— Vue 的 `isSameVNodeType` 比较 (type, key) 对，
两种卡是不同 vnode 类型，永远不会混淆。**别再花一轮去给它写测试**，注释已在文件里登记原因。
本任务把智能卡从组件改成 `<div>` 之后两种卡变成同一 vnode 类型，**这个结论随之失效** ——
届时 kind 前缀就真的是载荷了，请补一条同 raw id 的渲染测试。）

**Vue2 的 `al-live-dot` 坑（`#116` 第二条子提交）:** 后代选择器不匹配导致呼吸点渲染成空心点，
Vue2 专门补了显式样式。**照抄那条修复**，不要只搬第一条子提交。

- [ ] **Step 1: 写失败测试**

```ts
it('renders a smart album with the same card shape as a manual album', async () => {
  expect(w.findAll('.album-card')).toHaveLength(2)   // one manual, one smart
  expect(w.find('.sv-card').exists()).toBe(false)
})
it('uses the first seed as the smart card cover', async () => {})
it('falls back to the neutral cover when the smart view has no seeds', async () => {
  expect(w.find('.album-cover-fallback').exists()).toBe(true)
  expect(w.find('.album-cover img').exists()).toBe(false)   // never an empty-src img
})
it('shows the smart badge and the live dot on the cover', async () => {})
it('shows the paused state in both the dot and the meta row', async () => {})
it('no longer puts conditions or the threshold on the card face', async () => {})
it('opens the smart view detail when the card is clicked', async () => {})
it('renders both cards when a manual album and a smart view share a raw id', async () => {
  // now load-bearing: both cards are plain divs, so the kind prefix in :key is the only
  // thing keeping Vue from treating them as the same vnode
})
it('gives the create tile the same total height as an album card', async () => {
  expect(w.find('.album-create .album-title').attributes('style')).toContain('visibility: hidden')
})
```

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现同构卡片 + 创建卡 + 删组件**
- [ ] **Step 4: 跑测试确认通过** — `pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts src/styles src/i18n/parity.test.ts`
- [ ] **Step 5: 变异验证**

1. 去掉 `:key` 的 kind 前缀 → 「shares a raw id」用例应红（**这次必须真的红** —— 若仍不红，
   说明测试没能构造出同 vnode 类型的冲突，报告里如实说明，不要假装通过）
2. 空 seeds 时渲染 `<img>` → 「never an empty-src img」应红
3. 删掉 `al-live-dot` 的显式样式 → 若无测试覆盖，在报告中说明这是 CSS-only 无法被 jsdom 观测

- [ ] **Step 6: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add -A src/views/PhotosAlbums.vue src/views/__tests__/PhotosAlbums.test.ts src/photos/components/
git commit -m "refactor(photos): render smart albums with the manual album card shape"
```

---

## Task 11: i18n 孤儿清理 + 收尾全量门

**Files:**
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`
- 台账：`.superpowers/sdd/2026-08-10-sp15-p2c-.../`

**做:**

- [ ] **Step 1: 孤儿键清点**

对 T5/T7 换掉的旧键逐个 grep，**零消费者才删**：

```bash
for k in photosAlbumRename photosAlbumRenameHint photosAlbumConvertToSmart \
         photosAlbumConvertToSmartHint photosAlbumDelete photosAlbumDeleteHint \
         photosAlbumItemsShown photosFavExport photosSvSaveStaticAlbum \
         photosSvRename photosSvDuplicate photosSvConvertToAlbum photosSvDeleteSmartView; do
  echo "== $k: $(grep -rn "$k" src/ --include=*.vue --include=*.ts | grep -v 'src/i18n/' | wc -l) 处消费"
done
```

**注意 `photosMoPhotos` 这类被多页共用的键，删之前务必看清消费者是不是全在本期改动范围内。**

- [ ] **Step 2: 跑 parity** — `pnpm exec vitest run src/i18n/parity.test.ts`

- [ ] **Step 3: 提交 i18n 清理**

```bash
git add src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "chore(photos): drop the i18n keys the menu rework orphaned"
```

- [ ] **Step 4: 提交台账（先删 review-package 重建的 gitignore）**

```bash
rm -f .superpowers/sdd/.gitignore
git add -f .superpowers/sdd/
git commit -m "docs(sp15): record the P2c task ledger and per-task reports"
```

- [ ] **Step 5: 干净工作树上跑六门**

```bash
git status --short          # 必须为空，否则 oss 门报假红
pnpm exec vue-tsc --noEmit
pnpm test
pnpm exec vitest run src/i18n/parity.test.ts src/styles
pnpm exec vitest run oss/
pnpm build
git merge-tree --write-tree master HEAD | head -3
```

六门全绿才算 code-complete。任何一门红都要修到绿，**不要在报告里把红解释成"已知问题"**。

- [ ] **Step 6: 写真机验收清单**

产出 `docs/superpowers/2026-08-10-sp15-p2c-acceptance.md`。**第 0 步必须写明的预期行为**
（spec §5.3，这是 P2b 终审那条 Critical 的直接教训 —— 上一期的验收清单预先声明"空白是预期"，
机主照单验收就会签字通过一个真正坏掉的页面）：

- 真机数据：albums 5 / album_assets 40 / smart_views 9（全 paused，从未评估）/ moments 0
- **Place 行**：相册成员无 GPS 时显示占位符是预期，不是缺陷
- **但**：相册详情页面本身、头部、侧栏三节、⋯ 菜单**必须都能看见** ——
  若整页空白或某一节整块不出现，那是缺陷，不是"数据为空"

清单必须逐条写出**点击路径**（P4 的教训：面板内状态机/弹窗才能到达的屏，不写路径机主找不到）。
重点覆盖：**Download as ZIP 真机点一次**（jsdom 验不出来）· **短视口下侧栏 ⋯ 菜单向上翻转** ·
**编辑态底部浮条** · **Albums 页两种卡片等高**。

- [ ] **Step 7: 提交验收清单**

```bash
git add docs/superpowers/2026-08-10-sp15-p2c-acceptance.md
git commit -m "docs(sp15): write the P2c real-device acceptance checklist"
```

---

## 收尾整支终审

11 个任务全部关账后，对整支 `<base>..HEAD` 做一次 opus 整支终审。**终审人必须拿到的上下文:**

- 靶子是 `33b05636`，比对基准是 Vue2 源码不是本计划
- P2b 终审 8 个 Important 里 6 个是 1:1 视觉破绽（配色/文案/间距/尺寸），任何自动门看不见 ——
  终审要专门看这一类
- 本期删了 `.album-toolbar` 与 `.album-hero` 两个容器，**兄弟选择器与后代选择器的失效是重点**
- P1/P2a/P2b 的终审各逮到过「逐任务评审结构上看不见」的跨任务缺陷（重入守卫缺失、切 id 不清选择态、
  主行动丢配色），本期任务多、跨两个详情页，同类风险更高
