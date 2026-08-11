## Task 4: MomentCard.vue

**Files:**
- Create: `src/photos/components/MomentCard.vue`
- Test: `src/photos/components/__tests__/MomentCard.test.ts`
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`

**Interfaces:**
- Consumes: `Moment`（Task 3）· `MomentSize` / `MomentTemplate`（Task 2）· `service.photos.thumbnailUrl`
- Produces: `<MomentCard :moment :size :template @open="(id: string) => …" />`

**新增 i18n 键**（两个 locale 都加）：

| 键 | zh_cn | en_us |
|---|---|---|
| `photosMoBadge` | `时刻` | `Moment` |
| `photosMoTypeTrip` | `行程` | `Trip` |
| `photosMoTypePets` | `宠物` | `Pets` |
| `photosMoTypeFamily` | `家人` | `Family` |
| `photosMoTypeTheme` | `主题` | `Theme` |
| `photosMoAddedThisWeek` | `本周 +{n}` | `+{n} this week` |

> `photosMoAddedThisWeek` 的中文取自既有 `photosSvAddedThisWeek`（`zh_cn.photos.ts:612`）的同款措辞——**不要自己另译**。

- [ ] **Step 1: 写失败的测试**

新建 `src/photos/components/__tests__/MomentCard.test.ts`：

```ts
// SP15-P1-T4: MomentCard.vue —— 逐条照 Vue2 899af59b:PhotosSmartViewsView.vue:367-433
// 内联组件 MomentCard 移植。五种拼贴形态各断言一次 img 数量与顺序。
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'

const svc = vi.hoisted(() => ({
  photos: { thumbnailUrl: vi.fn((id: string, size: string) => `mock://${id}/${size}`) },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import MomentCard from '../MomentCard.vue'
import type { Moment } from '../../stores/moments'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function fullMoment(over: Partial<Moment> = {}): Moment {
  return {
    id: 'm1', title: 'Bozeman', subtitle: 'Nov 2016', place: 'Bozeman',
    recipeKey: 'trip:1', coverAssetId: 'c1', featuredAssetIds: ['f1', 'f2'],
    assetCount: 42, addedThisWeek: 3, coverRatio: 1.5,
    timeFrom: '', timeTo: '', updatedAt: '', ...over,
  }
}

function mountCard(over: Partial<Moment> = {}, size = 'standard', template = 'T1', locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return mount(MomentCard, {
    props: { moment: fullMoment(over), size, template },
    global: { plugins: [makeI18n(locale)] },
  })
}

describe('拼贴形态', () => {
  it('T1 / T2 / T4 渲染三张图:封面 + 两张精选,顺序固定', () => {
    for (const tpl of ['T1', 'T2', 'T4']) {
      const w = mountCard({}, 'standard', tpl)
      const srcs = w.findAll('.mo-collage img').map((i) => i.attributes('src'))
      expect(srcs).toEqual(['mock://c1/large', 'mock://f1/large', 'mock://f2/large'])
      expect(w.find('.sv-collage-main').exists()).toBe(true)
    }
  })

  it('T3 渲染两张图:封面 + 唯一精选', () => {
    const w = mountCard({ featuredAssetIds: ['f1'] }, 'standard', 'T3')
    expect(w.findAll('.mo-collage img').map((i) => i.attributes('src')))
      .toEqual(['mock://c1/large', 'mock://f1/large'])
  })

  it('single 只渲染封面一张,并挂 mo-collage-single', () => {
    const w = mountCard({ featuredAssetIds: [] }, 'standard', 'single')
    expect(w.findAll('.mo-collage img')).toHaveLength(1)
    expect(w.find('.mo-collage').classes()).toContain('mo-collage-single')
  })

  it('精选 id 不足时不渲染 src 为 undefined 的 img(不照抄 Vue2 的越界下标)', () => {
    // Vue2 模板在 T1 分支里硬取 featured_asset_ids[0]/[1],数组只有 1 项时第二个
    // <img> 的 src 是 undefined —— 浏览器会对当前页发一次多余请求。这里跳过缺失格。
    const w = mountCard({ featuredAssetIds: ['f1'] }, 'standard', 'T1')
    const srcs = w.findAll('.mo-collage img').map((i) => i.attributes('src'))
    expect(srcs.every((s) => typeof s === 'string' && s.length > 0)).toBe(true)
  })
})

describe('尺寸类', () => {
  it('wide / tall 分别挂 mo-card-wide / mo-card-tall,standard 两个都不挂', () => {
    expect(mountCard({}, 'wide').find('.mo-card').classes()).toContain('mo-card-wide')
    expect(mountCard({}, 'tall').find('.mo-card').classes()).toContain('mo-card-tall')
    const std = mountCard({}, 'standard').find('.mo-card').classes()
    expect(std).not.toContain('mo-card-wide')
    expect(std).not.toContain('mo-card-tall')
  })

  it('data-id 落在卡片根节点上(拖拽排序按它读 DOM 顺序)', () => {
    expect(mountCard().find('.mo-card').attributes('data-id')).toBe('m1')
  })
})

describe('meta 行', () => {
  it('类型胶囊按 recipeKey 前缀映射四档', () => {
    expect(mountCard({ recipeKey: 'trip:1' }, 'standard', 'T1', 'en_us').text()).toContain('Trip')
    expect(mountCard({ recipeKey: 'profile:pets' }, 'standard', 'T1', 'en_us').text()).toContain('Pets')
    expect(mountCard({ recipeKey: 'profile:family' }, 'standard', 'T1', 'en_us').text()).toContain('Family')
    expect(mountCard({ recipeKey: 'theme:food' }, 'standard', 'T1', 'en_us').text()).toContain('Theme')
  })

  it('addedThisWeek 为 0 时不渲染绿色徽标', () => {
    expect(mountCard({ addedThisWeek: 0 }).find('.mo-week-badge').exists()).toBe(false)
    expect(mountCard({ addedThisWeek: 2 }).find('.mo-week-badge').exists()).toBe(true)
  })

  it('place 为空时不渲染地点胶囊', () => {
    expect(mountCard({ place: '' }).findAll('.sv-cond')).toHaveLength(1)  // 只剩类型胶囊
  })

  it('张数走 locale 千分位(不是裸 toLocaleString)', () => {
    expect(mountCard({ assetCount: 12345 }, 'standard', 'T1', 'en_us').text()).toContain('12,345')
  })
})

describe('交互', () => {
  it('点击 emit open 并只传 id', async () => {
    const w = mountCard()
    await w.find('.mo-card').trigger('click')
    expect(w.emitted('open')).toEqual([['m1']])
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/photos/components/__tests__/MomentCard.test.ts --reporter=verbose`
Expected: FAIL —— 找不到 `../MomentCard.vue`

- [ ] **Step 3: 先补 i18n 键，再实现组件**

在 `src/i18n/zh_cn.photos.ts` 与 `src/i18n/en_us.photos.ts` 各加上文表格里的 6 个键（放在既有 `photosSv*` 块之后，新起一段注释 `// ── SP15-P1 Moments ──`）。

新建 `src/photos/components/MomentCard.vue`：

```vue
<script setup lang="ts">
// SP15-P1-T4: MomentCard.vue —— Moments 分区的马赛克卡片。
// 逐段照 Vue2 NimoOS-UI 899af59b:src/views/Photos/PhotosSmartViewsView.vue:367-433
// 的内联组件 MomentCard 移植;样式照 photos-smartview.scss:186-268。
// 拼贴/meta 结构与 SmartViewCard.vue 对齐(三行 meta 不变),故复用 .sv-card/.sv-collage/
// .sv-meta 这套类名,只叠加 .mo-* 覆盖规则 —— 与 Vue2 同一手法。
//
// 偏离登记:
//  1) emit('open', id) 只传 id 字符串,不传整个 moment 对象(照 SmartViewCard.vue:32 的
//     既有先例)—— 详情页从 store byId 现取,消灭引用陈旧。
//  2) 精选格越界不渲染空 <img>:Vue2 模板在 T1/T2/T4 分支硬取 featuredAssetIds[0] 与
//     [1],数组只有 1 项时第二个 <img> 的 src 是 undefined,浏览器会对当前页面 URL 再发
//     一次多余请求。这里逐格判存在,缺的格子不渲染。(界面 1:1 不受影响 —— 走到这个分支
//     本身就意味着 pickMomentTemplate 判过 n>=2,是防御。)
//  3) 张数千分位跟 i18n locale(`toLocaleString(localeTag)`),不是 Vue2 的裸
//     `toLocaleString()`(跟浏览器 locale,不确定)。
//  4) 橙色徽标:Vue2 是 `linear-gradient(135deg,#FF9F0A,#FF6B5C)` 与
//     `rgba(255,159,10,0.15)/#FF9F0A` 字面量。本仓禁裸色,改用已存在的 --warn-fg /
//     --warn-bg token(theme.css:155-157 与 :511-513,两套主题都有取值,不新增 token)。
//     渐变退为 --warn-fg 实底 —— 本仓无第二个橙色 token 可组渐变,登记为外观性偏离。
//  5) .mo-card .sv-name 的两行截断照抄(scss:254-259)。
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { Moment } from '../stores/moments'
import type { MomentSize, MomentTemplate } from '../util/momentLayout'

const props = defineProps<{ moment: Moment; size: MomentSize; template: MomentTemplate }>()
const emit = defineEmits<{ (e: 'open', id: string): void }>()

const { t, locale } = useI18n()
// BCP-47 转换(本仓既定写法,见 SmartViewCard.vue:38)。
const localeTag = computed(() => locale.value.replace('_', '-'))

// 三格/两格/一格的数据源,逐格判存在(偏离登记 2)。
const collageIds = computed<string[]>(() => {
  const cover = props.moment.coverAssetId
  const f = props.moment.featuredAssetIds
  if (props.template === 'single') return [cover].filter(Boolean)
  if (props.template === 'T3') return [cover, f[0]].filter(Boolean)
  return [cover, f[0], f[1]].filter(Boolean)
})

const typeLabel = computed(() => {
  const key = props.moment.recipeKey || ''
  if (key.startsWith('trip')) return t('photosMoTypeTrip')
  if (key.includes('pets')) return t('photosMoTypePets')
  if (key.includes('family')) return t('photosMoTypeFamily')
  return t('photosMoTypeTheme')
})

function thumbUrl(id: string): string {
  return service.photos.thumbnailUrl(id, 'large')
}
</script>

<template>
  <div
    class="sv-card mo-card"
    :class="{ 'mo-card-wide': size === 'wide', 'mo-card-tall': size === 'tall' }"
    :data-id="moment.id"
    @click="emit('open', moment.id)"
  >
    <div
      class="sv-collage mo-collage"
      :class="{
        'mo-collage-single': template === 'single',
        'mo-tpl-t2': template === 'T2',
        'mo-tpl-t3': template === 'T3',
        'mo-tpl-t4': template === 'T4',
      }"
    >
      <img
        v-for="(id, i) in collageIds" :key="id"
        :class="{ 'sv-collage-main': i === 0 }" :src="thumbUrl(id)" alt=""
      >
      <div class="sv-collage-overlay" />
      <div class="sv-collage-badge mo-badge">
        <svg
          width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        ><path d="M12 2l2.6 6.3L21 9.6l-4.7 4.3 1.3 6.4L12 17l-5.6 3.3 1.3-6.4L3 9.6l6.4-1.3z" /></svg>
        {{ t('photosMoBadge') }}
      </div>
    </div>
    <div class="sv-meta">
      <h3 class="sv-name">
        {{ moment.title }}
      </h3>
      <div class="sv-conds">
        <span class="sv-cond">{{ typeLabel }}</span>
        <span v-if="moment.place" class="sv-cond">{{ moment.place }}</span>
      </div>
      <div class="sv-stats">
        <b>{{ moment.assetCount.toLocaleString(localeTag) }}</b> {{ t('photosSvPhotosCount') }}
        <span v-if="moment.addedThisWeek > 0" class="mo-week-badge">{{ t('photosMoAddedThisWeek', { n: moment.addedThisWeek }) }}</span>
        <span style="flex:1" />
        <span v-if="moment.subtitle" class="mo-span-mini">{{ moment.subtitle }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 卡片外壳/拼贴/meta 三块与 SmartViewCard.vue 同规格(Vue2 复用 .sv-card 类,本仓 scoped
   样式不跨组件继承,故在此重述必要的几条,而不是把 SmartViewCard 的样式提成全局)。 */
.sv-card {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.sv-card:hover { transform: translateY(-2px); box-shadow: var(--card-shadow-hi); }

.sv-collage {
  position: relative;
  display: grid;
  gap: 2px;
  background: var(--bg);
}
/* 拼贴留白修复(照 scss:198-218):显式 1fr 轨道的 auto 最小尺寸会被竖图固有高撑破,
   同排卡片被最高者拉齐、矮卡下方留白。轨道钉死 minmax(0, 1fr) 并清零 img 最小尺寸。
   马赛克卡的拼贴高度由 .mo-grid 的固定行高单位决定,不是固定 16 比 9。 */
.mo-collage {
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  flex: 1;
  min-height: 0;
}
.mo-collage img { width: 100%; height: 100%; object-fit: cover; display: block; min-width: 0; min-height: 0; }
.sv-collage-main { grid-row: 1 / span 2; }

/* T2 上大下双(高卡专属):封面占上方两份、两张精选横排占下方一份。 */
.mo-tpl-t2 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: minmax(0, 2fr) minmax(0, 1fr); }
.mo-tpl-t2 .sv-collage-main { grid-column: 1 / span 2; grid-row: 1; }

/* T3 左右对半(n 等于 1 的兜底):只有一行,覆盖掉 .sv-collage-main 默认的跨两行。 */
.mo-tpl-t3 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
.mo-tpl-t3 .sv-collage-main { grid-row: 1; }

/* T4 三联横排(宽卡专属):结构同 T1,只把列比例从 2fr 比 1fr 收窄到 11fr 比 9fr。 */
.mo-tpl-t4 { grid-template-columns: minmax(0, 11fr) minmax(0, 9fr); }

/* single:单图绝对定位铺满。 */
.mo-collage-single { display: block; }
.mo-collage-single img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }

.sv-collage-overlay {
  position: absolute; bottom: 0; left: 0; right: 0; height: 70%; pointer-events: none;
  /* theme-exception: 拼贴底部渐变遮罩,为压在照片上的徽标提供跨主题恒定对比度
     (同 SmartViewCard.vue .sv-collage-overlay 的先例)。 */
  background: linear-gradient(to top, rgba(0, 0, 0, 0.85), transparent);
}
.sv-collage-badge {
  position: absolute; top: 10px; left: 10px;
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px 3px 6px;
  border-radius: var(--chip-radius, 999px);
  backdrop-filter: var(--blur);
  font-size: 10.5px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.04em;
}
/* Vue2 是 #FF9F0A → #FF6B5C 的渐变;本仓无第二个橙色 token,退为 --warn-fg 实底
   (外观性偏离,已在文件头登记)。 */
.mo-badge {
  background: var(--warn-fg);
  /* theme-exception: 徽标文字压在照片拼贴之上,需要跨主题恒定浅色前景,禁用
     --on-accent(同 SmartViewCard.vue .sv-collage-badge 的先例与理由)。 */
  color: #fff;
}

.sv-meta {
  padding: 14px 16px 16px;
  /* flex 子项省略的必要条件:父级 flex-direction column 下默认 min-width auto。 */
  min-width: 0;
}
.sv-name {
  font-size: 15px; font-weight: 600; margin: 0 0 4px; letter-spacing: -0.01em;
  /* 超长标题最多两行(scss:254-259)。 */
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.sv-conds { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px; }
.sv-cond { padding: 2px 8px; border-radius: var(--chip-radius, 999px); background: var(--chip-bg); color: var(--fg-muted); font-size: 11px; }
.sv-stats { display: flex; align-items: center; gap: 10px; font-size: 11.5px; color: var(--fg-subtle); font-variant-numeric: tabular-nums; }
.sv-stats b { color: var(--fg); font-weight: 600; }
.mo-week-badge { color: var(--success); }
.mo-span-mini {
  display: inline-flex; align-items: center;
  padding: 2px 7px; border-radius: var(--chip-radius, 999px);
  background: var(--warn-bg); color: var(--warn-fg);
  font-weight: 600; white-space: nowrap;
}
</style>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/photos/components/__tests__/MomentCard.test.ts src/i18n/parity.test.ts --reporter=verbose`
Expected: PASS，11 个卡片用例 + parity 9/9

- [ ] **Step 5: 提交**

```bash
git add src/photos/components/MomentCard.vue src/photos/components/__tests__/MomentCard.test.ts src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts
git commit -m "feat(photos): add the moment card

Five collage shapes, driven entirely by the size/template props the layout
module computes. The one behavioural change from Vue 2: empty collage slots are
skipped rather than rendered as an <img> with an undefined src, which the
browser resolves against the current page and fetches for nothing.

The amber badge loses its gradient. This repo has a single warn token, and the
theming rule forbids the literal second stop Vue 2 used."
```

---

