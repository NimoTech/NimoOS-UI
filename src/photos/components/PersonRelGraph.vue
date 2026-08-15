<script setup lang="ts">
// Task 13 (SP7-P5 人物): PersonRelGraph.vue —— 关系图(SVG 力导图)。逐字照搬
// Vue2 NimoOS-UI src/views/Photos/PhotosRelGraph.vue(94 行)的全部几何数值:
// viewBox 0 0 760 400、center {x:380,y:200}、中心圈 r=34(clip r=31、图片
// 62x62)、中心光晕 r=90、卫星角度 (i/n)*2π-π/2、距离 100+(1-count/maxCount)*110、
// 节点半径 18+strength*10(外环+2)、连线宽 1+strength*2.2、连线不透明度
// 0.20+strength*0.55、计数胶囊 28x16 rx=8 在连线中点、名字字号 13/11。
// maxCount = Math.max(...counts, 1) 防除零(全部 count 为 0 时 strength=0,
// 不产生 0/0=NaN)。
//
// 颜色改造(本任务最大的坑,登记原因):SVG presentation attribute(fill=""/
// stroke="" 直接写在元素上)不认 CSS var() —— Vue2 因此把 6 处颜色硬编码成字面
// 十六进制(:5,6,13,18,20,25,38)。这里把这 6 处全部改成 class,颜色规则写进
// scoped 样式块的 CSS 属性(CSS 里的 fill/stroke 认 var(),presentation
// attribute 不认,是两条不同的解析路径)。Vue2 已经对文字用了这招
// (class="rg-name",:33,48),这里是把同一招扩展到全部颜色。几何量
// (stroke-width/stroke-opacity/r/坐标)不是颜色,继续留在 attribute 上。
//
// 补齐 affordance(brief 明确要求,非 Vue2 行为):Vue2 关系图节点不可点,跳转
// 入口只在共现列表/横条。这里给卫星节点(不含中心)加 click → emit
// open-person,登记为主动补齐而非移植缺陷。
//
// Task 6 (Plan D, PR 137 gap-close): three behaviors ported from Vue2 NimoOS-UI commit
// 03245590 (PhotosRelGraph.vue) that were missing here —
//  1) MAX_GRAPH_NODES = 12 cap on positions (Vue2 :64/:73 `.slice(0, MAX_GRAPH_NODES)`);
//     the empty-state gate also switched from `relations.length > 0` to `positions.length > 0`
//     to match (Vue2 diff: same rename).
//  2) Avatar-fallback: a gradient-filled disc + initial-letter <text> painted UNDER each
//     avatar <image> (center + every satellite) — if the image 404s it simply never covers
//     them, no onerror handler needed (Vue2's own comment, ported verbatim). Colors go through
//     CSS classes, not literal hex on the SVG presentation attributes (see the color-rework
//     note above) — `.rg-avatar-fallback-stop`'s two stops share one accent-derived color at
//     different opacities (matching this component's own `.rg-glow-stop` technique) rather
//     than Vue2's two literal hex tones, since this app's color rule forbids fixed literals.
//  3) Empty state `.rg-empty` (title + hint) when there are no co-appearances at all — ported
//     from Vue2's own scoped style block (photos-people.scss doesn't have this rule; the
//     brief's controller ruling puts it there directly with this task, not Task 1).
//
// Unnamed-person fallback (one of the 5 "Unnamed person fallback" spots the brief calls out):
// centerName and the satellite name label both fall back to photosPersonUnnamedTitle — same
// key PersonHero.vue/topbar already use. Ported verbatim from Vue2's own asymmetry: the
// *displayed* satellite name falls back (`pos.name || $t('Unnamed person')`), but the *initial*
// glyph under a satellite is computed from the RAW name (`initial(pos.name)`, not the
// fallback-substituted text) — an unnamed satellite therefore shows a bare fallback disc with
// no letter. The center avatar's initial, by contrast, IS computed from the already-substituted
// `centerName` (Vue2 :92 `initial(centerName)`), so an unnamed center shows "U". Both read
// exactly as Vue2's real diff, not independently re-derived.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { personInitial } from '../util/peopleView'
import type { PersonRelation } from '../composables/usePersonDetail'
import type { Person } from '../util/peopleView'

const props = defineProps<{
  relations: PersonRelation[]
  person: Person | null
}>()

const emit = defineEmits<{ (e: 'open-person', id: string | number): void }>()

const { t } = useI18n()

const MAX_GRAPH_NODES = 12

// 常量,不必是 computed —— Vue2 :65 也是纯字面量 computed,这里保留同名局部量
// 方便下面的公式照抄参照 Vue2 变量名。
const center = { x: 380, y: 200 }

const centerName = computed(() => props.person?.name || t('photosPersonUnnamedTitle'))
const centerHref = computed(() =>
  props.person ? service.photos.personFaceThumbnailUrl(props.person.id, props.person.coverFaceId) : '',
)

function initial(name: string | null | undefined): string {
  return personInitial(name)
}

interface NodePos {
  id: string | number
  name?: string
  coverFaceId?: string | number | null
  count: number
  x: number
  y: number
  strength: number
}

// Vue2 :68-85 positions computed —— 按 count 降序排列后按角度/距离公式摆放。
// Task 6: truncate to MAX_GRAPH_NODES after sorting (Vue2 :73 `.slice(0, MAX_GRAPH_NODES)`) —
// prevents a person with a lot of relations from squashing the graph into an unreadable knot.
const positions = computed<NodePos[]>(() => {
  if (props.relations.length === 0) return []
  const sorted = [...props.relations].sort((a, b) => b.count - a.count).slice(0, MAX_GRAPH_NODES)
  const maxCount = Math.max(...sorted.map((r) => r.count), 1) // 防除零(brief 硬约束)
  return sorted.map((rel, i) => {
    const angle = (i / sorted.length) * Math.PI * 2 - Math.PI / 2
    const dist = 100 + (1 - rel.count / maxCount) * 110
    return {
      id: rel.personId,
      name: rel.name,
      coverFaceId: rel.coverFaceId,
      count: rel.count,
      x: center.x + Math.cos(angle) * dist,
      y: center.y + Math.sin(angle) * dist,
      strength: rel.count / maxCount,
    }
  })
})

function midX(pos: NodePos): number {
  return (center.x + pos.x) / 2
}
function midY(pos: NodePos): number {
  return (center.y + pos.y) / 2
}
function nodeRadius(pos: NodePos): number {
  return 18 + pos.strength * 10
}
function thumbUrl(pos: NodePos): string {
  return service.photos.personFaceThumbnailUrl(pos.id, pos.coverFaceId)
}
</script>

<template>
  <!-- Task 6: gate switched from `relations.length > 0` to `positions.length > 0` (Vue2's own
       diff makes the same rename) so the MAX_GRAPH_NODES cap can't accidentally desync from
       what actually renders — positions is already the capped, empty-when-no-relations list. -->
  <svg v-if="positions.length > 0" viewBox="0 0 760 400" width="100%" height="400">
    <defs>
      <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" class="rg-glow-stop" stop-opacity="0.35" />
        <stop offset="100%" class="rg-glow-stop" stop-opacity="0" />
      </radialGradient>
      <!-- Task 6: avatar-fallback gradient (Vue2 :10-13 `#rgAvatarFallback`) — ported as a
           single accent-derived color at two opacities (`.rg-avatar-fallback-stop`), not
           Vue2's two literal hex tones, per this component's own established color-rework
           technique (see script-block comment). -->
      <linearGradient id="rgAvatarFallback" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" class="rg-avatar-fallback-stop" />
        <stop offset="100%" class="rg-avatar-fallback-stop" stop-opacity="0.75" />
      </linearGradient>
    </defs>
    <circle class="rg-glow" :cx="center.x" :cy="center.y" r="90" fill="url(#centerGlow)" />

    <line
      v-for="pos in positions" :key="'e' + pos.id" class="rg-edge"
      :x1="center.x" :y1="center.y" :x2="pos.x" :y2="pos.y"
      :stroke-opacity="0.20 + pos.strength * 0.55"
      :stroke-width="1 + pos.strength * 2.2" stroke-linecap="round"
    />

    <g v-for="pos in positions" :key="'l' + pos.id">
      <rect
        class="rg-pill" :x="midX(pos) - 14" :y="midY(pos) - 9" width="28" height="16" rx="8"
      />
      <text
        :x="midX(pos)" :y="midY(pos) + 3" text-anchor="middle"
        font-size="10" class="rg-pill-text"
        font-family="ui-monospace, monospace"
      >{{ pos.count }}</text>
    </g>

    <g>
      <circle class="rg-center-ring" :cx="center.x" :cy="center.y" r="34" stroke-width="2" />
      <!-- Task 6: fallback disc + initial painted UNDER the avatar (Vue2 :34-39 comment,
           ported verbatim) — if the <image> below fails to load it simply never covers this,
           no onerror handler needed. initial() reads the already-fallback-substituted
           centerName (Vue2 :92 `initial(centerName)`), so an unnamed center shows "U". -->
      <circle :cx="center.x" :cy="center.y" r="31" fill="url(#rgAvatarFallback)" />
      <text
        v-if="initial(centerName)" :x="center.x" :y="center.y + 6" text-anchor="middle"
        font-size="18" font-weight="600" class="rg-avatar-initial"
      >{{ initial(centerName) }}</text>
      <clipPath id="centerClip">
        <circle :cx="center.x" :cy="center.y" r="31" />
      </clipPath>
      <image
        class="rg-center-img" :href="centerHref"
        :x="center.x - 31" :y="center.y - 31" width="62" height="62"
        clip-path="url(#centerClip)" preserveAspectRatio="xMidYMid slice"
      />
      <text
        :x="center.x" :y="center.y + 56" text-anchor="middle"
        font-size="13" font-weight="600" class="rg-name rg-center-name"
      >{{ centerName }}</text>
    </g>

    <g
      v-for="pos in positions" :key="'n' + pos.id" class="rg-node"
      @click="emit('open-person', pos.id)"
    >
      <circle class="rg-node-ring" :cx="pos.x" :cy="pos.y" :r="nodeRadius(pos) + 2" stroke-width="1" />
      <!-- Task 6: same fallback disc + initial as the center avatar above. initial() here
           reads the RAW pos.name (Vue2 :48 `initial(pos.name)`, NOT the fallback-substituted
           display name below) — an unnamed satellite therefore shows a bare fallback disc
           with no letter, matching Vue2's own asymmetry exactly (see script-block comment). -->
      <circle :cx="pos.x" :cy="pos.y" :r="nodeRadius(pos)" fill="url(#rgAvatarFallback)" />
      <text
        v-if="initial(pos.name)" :x="pos.x" :y="pos.y + 4" text-anchor="middle"
        font-size="12" font-weight="600" class="rg-avatar-initial"
      >{{ initial(pos.name) }}</text>
      <clipPath :id="'clip_' + pos.id">
        <circle :cx="pos.x" :cy="pos.y" :r="nodeRadius(pos)" />
      </clipPath>
      <image
        class="rg-node-img" :href="thumbUrl(pos)"
        :x="pos.x - nodeRadius(pos)" :y="pos.y - nodeRadius(pos)"
        :width="nodeRadius(pos) * 2" :height="nodeRadius(pos) * 2"
        :clip-path="'url(#clip_' + pos.id + ')'"
        preserveAspectRatio="xMidYMid slice"
      />
      <text
        :x="pos.x" :y="pos.y + nodeRadius(pos) + 14" text-anchor="middle"
        font-size="11" font-weight="500" class="rg-name rg-name-dim"
      >{{ pos.name || t('photosPersonUnnamedTitle') }}</text>
    </g>
  </svg>
  <!-- Task 6 (Plan D, PR 137 gap-close): empty state when this person has no co-appearances
       at all — ported from Vue2 :55-58, styles transcribed into
       src/photos/styles/vue2-parity/photos-people.scss (`.rg-empty`, controller ruling: this
       rule lands with this task, not Task 1). -->
  <div v-else class="rg-empty" data-test="rel-graph-empty">
    <div class="t">{{ t('photosPersonRelGraphEmptyTitle') }}</div>
    <div class="d">{{ t('photosPersonRelGraphEmptySub') }}</div>
  </div>
</template>

<style scoped>
/* 颜色一律走 CSS class(SVG presentation attribute 不认 var(),见脚本区顶部
   注释)。几何量(stroke-width/stroke-opacity/r/坐标)不是颜色,留在模板的
   attribute 上,不搬进这里。 */
/* Task 5 (Plan D) shadowing cleanup: `.rg-name`/`.rg-name-dim` duplicated parity's own
   `.rel-graph-wrap svg .rg-name`/`.rg-name-dim` rules (this SVG only ever renders inside
   `.rel-graph-wrap`, per PersonRelationsTab.vue's template) and have been deleted — parity
   now governs directly with `fill: var(--text-1)`/`var(--text-2)`.

   Everything else below (`.rg-glow-stop`/`.rg-edge`/`.rg-pill`/`.rg-pill-text`/
   `.rg-center-ring`/`.rg-node-ring`/`.rg-node`) has no parity anchor at all — parity only
   transcribed the two text-fill rules above. Vue2's own PhotosRelGraph.vue hardcodes these as
   literal hex on SVG presentation attributes (fill set to Vue2's old purple, can't hold var() — see
   script-block comment), and this app deliberately does not transcribe that literal purple:
   same reasoning already established for `.rel-insight-card` (PersonRelationsTab.vue) — a
   fixed accent-colored decoration should follow *this* app's live --accent rather than stay
   frozen to Vue2's old theme's literal hex. These are this SVG's only consumer (no other
   component draws it), so kept local rather than adding single-consumer rules to the shared
   parity file. */
.rg-glow-stop {
  stop-color: var(--accent);
}
.rg-edge {
  stroke: var(--accent);
}
.rg-pill {
  fill: var(--overlay-bg);
  stroke: var(--card-border);
}
.rg-pill-text {
  fill: var(--fg);
}
.rg-center-ring {
  fill: var(--panel-bg);
  stroke: var(--accent);
}
.rg-node-ring {
  fill: var(--panel-bg);
  stroke: var(--card-border);
}
.rg-node {
  cursor: pointer;
}
/* Task 6 (Plan D, PR 137 gap-close): avatar-fallback disc + initial-letter text (Vue2 :10-13
   `#rgAvatarFallback` gradient + :35-39/:97-99 initial <text>s). `.rg-avatar-fallback-stop` is
   reused for both <stop>s (same technique as `.rg-glow-stop` above) — a single accent-derived
   color at two opacities, not Vue2's two literal hex tones (see script-block comment).
   `.rg-avatar-initial`'s fill is `--on-accent`: this text sits directly on the accent-derived
   fallback disc, which is exactly the saturated-accent-solid precondition `--on-accent` is
   for (same rule already established in PersonHero.vue's "pinned foreground color" red-line
   section). */
.rg-avatar-fallback-stop {
  stop-color: var(--accent);
}
.rg-avatar-initial {
  fill: var(--on-accent);
}
</style>
