## Task 5: For You 分区接进智能视图页

**Files:**
- Modify: `src/views/PhotosSmartViews.vue`
- Test: `src/views/PhotosSmartViews.moments.test.ts`（新建；既有该页测试文件不动，避免与 `sp12-files-fixes` 之外的并发面冲突）
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`

**Interfaces:**
- Consumes: `usePhotosMoments`（Task 3）· `MomentCard`（Task 4）
- Produces: 页面顶部的 `.mo-section` 区块与 `.mo-grid` 容器（`ref="moGrid"`，Task 6 的拖拽挂在它上面）

**新增 i18n 键**：

| 键 | zh_cn | en_us |
|---|---|---|
| `photosMoHeroTitle` | `时刻 · 为你推荐` | `Moments · For You` |
| `photosMoHeroDesc` | `Nimo 会自动把你最好的照片聚成时刻 —— 行程、人物，以及值得重温的主题。` | `Nimo automatically groups your best shots into moments — trips, people, and themes worth reliving.` |

- [ ] **Step 1: 写失败的测试**

新建 `src/views/PhotosSmartViews.moments.test.ts`：

```ts
// SP15-P1-T5: 智能视图页顶部的 Moments · For You 分区。
// 靶子是 Vue2 899af59b:PhotosSmartViewsView.vue:31-44(mo-section)+ :46(sv-hero 拿到
// sv-hero-secondary 分隔线)+ :455(showMoments 门控)。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../i18n/zh_cn'
import en from '../i18n/en_us'

const svc = vi.hoisted(() => ({
  photos: {
    thumbnailUrl: vi.fn((id: string, size: string) => `mock://${id}/${size}`),
    listMoments: vi.fn(async () => []),
    listSmartViews: vi.fn(async () => []),
    getConfig: vi.fn(async () => ({})),
    reorderMoments: vi.fn(async () => ({})),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosSmartViews from './PhotosSmartViews.vue'
import { usePhotosMoments, type Moment } from '../photos/stores/moments'
import { usePhotosSettingsStore } from '../photos/stores/settings'

function makeMoment(over: Partial<Moment> = {}): Moment {
  return {
    id: 'm1', title: 'Bozeman', subtitle: 'Nov 2016', place: 'Bozeman',
    recipeKey: 'trip:1', coverAssetId: 'c1', featuredAssetIds: ['f1', 'f2'],
    assetCount: 42, addedThisWeek: 0, coverRatio: 1.5,
    timeFrom: '', timeTo: '', updatedAt: '', ...over,
  }
}

function makeRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/photos/smart-views/:id', component: { template: '<div/>' } },
      { path: '/photos/moments/:id', name: 'photos-moment-detail', component: { template: '<div/>' } },
      { path: '/photos/settings', component: { template: '<div/>' } },
    ],
  })
}

async function mountPage() {
  const router = makeRouter()
  await router.push('/')
  await router.isReady()
  const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh, en_us: en } })
  const w = mount(PhotosSmartViews, { global: { plugins: [i18n, router] } })
  await new Promise((r) => setTimeout(r, 0))
  return { w, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('分区门控', () => {
  it('无时刻时整个分区不渲染(Vue2 showMoments 的核心语义)', async () => {
    const { w } = await mountPage()
    expect(w.find('[data-test="mo-section"]').exists()).toBe(false)
  })

  it('有时刻时渲染分区,标题与副标题来自 i18n', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment()]
    const { w } = await mountPage()
    expect(w.find('[data-test="mo-section"]').exists()).toBe(true)
    expect(w.text()).toContain('时刻 · 为你推荐')
  })

  it('aiFeatures.smartview 为 false 时,即使有时刻也不渲染分区', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment()]
    const settings = usePhotosSettingsStore()
    settings.aiFeatures.smartview = false
    const { w } = await mountPage()
    expect(w.find('[data-test="mo-section"]').exists()).toBe(false)
  })

  it('aiFeatures.smartview 缺字段时按开启处理(不吓用户)', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment()]
    const { w } = await mountPage()
    expect(w.find('[data-test="mo-section"]').exists()).toBe(true)
  })
})

describe('网格', () => {
  it('每条时刻渲染一张卡,尺寸/模板取自 store 的 sizeMap', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ id: 'a' }), makeMoment({ id: 'b', coverRatio: 0.6 })]
    const { w } = await mountPage()
    const cards = w.findAll('.mo-card')
    expect(cards).toHaveLength(2)
    expect(cards[1].classes()).toContain('mo-card-tall')
  })

  it('点击卡片跳 /photos/moments/:id', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ id: 'zz' })]
    const { w, router } = await mountPage()
    await w.find('.mo-card').trigger('click')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/photos/moments/zz')
  })
})

describe('与智能视图 hero 的关系', () => {
  it('分区出现时,下方 sv-hero 拿到 sv-hero-secondary 分隔线类', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment()]
    const { w } = await mountPage()
    expect(w.find('.sv-hero').classes()).toContain('sv-hero-secondary')
  })

  it('分区不出现时 sv-hero 不带该类', async () => {
    const { w } = await mountPage()
    expect(w.find('.sv-hero').classes()).not.toContain('sv-hero-secondary')
  })
})

describe('拉取', () => {
  it('挂载时拉一次 moments', async () => {
    await mountPage()
    expect(svc.photos.listMoments).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/views/PhotosSmartViews.moments.test.ts --reporter=verbose`
Expected: FAIL —— `[data-test="mo-section"]` 找不到

- [ ] **Step 3: 实现**

先在两个 locale 文件加上表格里的 2 个键。

在 `src/views/PhotosSmartViews.vue` 的 `<script setup>` 里追加：

```ts
import MomentCard from '../photos/components/MomentCard.vue'
import { usePhotosMoments } from '../photos/stores/moments'

const moments = usePhotosMoments()

// 照 Vue2 899af59b:PhotosSmartViewsView.vue:455 —— 无时刻时整个分区隐藏,且跟随
// aiFeatures.smartview 开关。**真机上 moments 表常年 0 行(见 spec §2),所以"打开页面
// 看不到这个分区"是预期行为,不是缺陷。**
const showMoments = computed(() => !aiSmartViewOff.value && moments.moments.length > 0)

function onMomentOpen(id: string): void {
  router.push('/photos/moments/' + id)
}
```

`onMounted` 里追加 `void moments.fetchMoments()`。

模板里，在 AI 横幅之后、`<!-- ── hero ── -->` 之前插入：

```vue
        <!-- ── Moments · For You(Vue2 899af59b :31-44)── -->
        <div v-if="showMoments" class="mo-section" data-test="mo-section">
          <div class="mo-hero">
            <div>
              <h2>{{ t('photosMoHeroTitle') }}</h2>
              <p>{{ t('photosMoHeroDesc') }}</p>
            </div>
          </div>
          <div ref="moGrid" class="sv-grid mo-grid">
            <MomentCard
              v-for="m in moments.moments" :key="m.id" :moment="m"
              :size="moments.sizeMap[m.id]?.size ?? 'standard'"
              :template="moments.sizeMap[m.id]?.template ?? 'T1'"
              @open="onMomentOpen"
            />
          </div>
        </div>
```

把 hero 那行改成 `<div class="sv-hero" :class="{ 'sv-hero-secondary': showMoments }">`，并加 `const moGrid = ref<HTMLElement | null>(null)`。

`<style scoped>` 追加：

```css
/* ── Moments · For You 分区(Vue2 photos-smartview.scss:144-186)── */
.mo-section { margin-bottom: 36px; }
.mo-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 16px; }
/* 偏离登记:Vue2 用 var(--font-display) —— 本仓 theme.css 没有这个 token(grep 零命中),
   不新增,继承页面字体。 */
.mo-hero h2 { font-size: 32px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 4px; color: var(--fg); }
.mo-hero p { font-size: 13.5px; color: var(--fg-muted); margin: 0; max-width: 520px; line-height: 1.5; }

/* Moments 在上方时,下面的智能视图 hero 补一条分隔线。 */
.sv-hero.sv-hero-secondary { padding-top: 24px; border-top: 1px solid var(--divider); }

/* .mo-grid 与 .sv-grid 并存,只叠加马赛克专属规则,不碰 .sv-grid 本体。
   dense 密排 + 固定行高:卡高 = span 乘 132px 再加 (span - 1) 乘 16px 的 gap。 */
.mo-grid { margin-bottom: 4px; grid-auto-flow: row dense; grid-auto-rows: 132px; }
/* 三档 span。高卡用双类选择器顶掉 baseline 的单类选择器,不依赖书写顺序。 */
.mo-grid :deep(.mo-card) { grid-row: span 3; }
.mo-grid :deep(.mo-card-wide) { grid-column: span 2; }
.mo-grid :deep(.mo-card.mo-card-tall) { grid-row: span 5; }

/* 窄容器降级:sv-grid 的 auto-fill minmax(320px, 1fr) 在低于三列临界宽度时降到 1 至 2 列,
   宽卡横占两列会顶到列数上限,直接用 media 退回一列。高卡纵向占位不受列数影响。 */
@media (max-width: 1055px) {
  .mo-grid :deep(.mo-card-wide) { grid-column: span 1; }
}
```

> **注意 `:deep()`**：`.mo-card` 是子组件根节点，scoped 样式默认选不中它的 grid span——这是与 Vue2 全局 scss 的结构性差异，必须用 `:deep()`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/views/PhotosSmartViews.moments.test.ts src/i18n/parity.test.ts --reporter=verbose`
Expected: PASS，9 个分区用例 + parity 9/9

- [ ] **Step 5: 提交**

```bash
git add src/views/PhotosSmartViews.vue src/views/PhotosSmartViews.moments.test.ts src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts
git commit -m "feat(photos): show the For You moments band on the smart views page

Placement follows Vue 2 at #111, before #112 moved smart views out to the
albums page — that move is P2's job and pulling it in early would blur the two
phases together.

The grid span rules need :deep(). The card is a child component root, which
scoped styles cannot reach, so the mosaic sizing would silently do nothing
otherwise. Vue 2 had no such problem because its stylesheet was global."
```

---

