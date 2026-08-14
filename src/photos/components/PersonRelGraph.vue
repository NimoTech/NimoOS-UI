<script setup lang="ts">
// Task 13 (SP7-P5 people): PersonRelGraph.vue — relationship graph (SVG force-directed graph). Copied verbatim
// all geometric values from Vue2 NimoOS-UI src/views/Photos/PhotosRelGraph.vue (94 lines):
// viewBox 0 0 760 400, center {x:380,y:200}, center circle r=34 (clip r=31, image
// 62x62), center glow r=90, satellite angle (i/n)*2π-π/2, distance 100+(1-count/maxCount)*110,
// node radius 18+strength*10 (outer ring +2), line width 1+strength*2.2, line opacity
// 0.20+strength*0.55, count pill 28x16 rx=8 at line midpoint, name font size 13/11.
// maxCount = Math.max(...counts, 1) guards against division by zero (when all counts are 0, strength=0,
// doesn't produce 0/0=NaN).
//
// Color refactoring (biggest pitfall in this task, logged reason): SVG presentation attribute (fill=""/
// stroke="" written directly on elements) doesn't recognize CSS var() — Vue2 therefore hard-coded 6 color locations as literal
// hex (:5,6,13,18,20,25,38). Here we change all 6 locations to classes, color rules written into
// scoped style block's CSS properties (fill/stroke in CSS recognizes var(), presentation
// attribute doesn't, they're two different parsing paths). Vue2 already used this trick for text
// (class="rg-name", :33,48), here we extend the same trick to all colors. Geometric quantities
// (stroke-width/stroke-opacity/r/coordinates) are not colors, stay on attributes.
//
// Fill in affordance (explicitly required by brief, not Vue2 behavior): Vue2 relationship graph nodes aren't clickable, navigation
// entry is only in co-occurrence list/bar. Here we add click → emit
// open-person to satellite nodes (excluding center), logged as proactive supplement not ported gap.
import { computed } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { PersonRelation } from '../composables/usePersonDetail'
import type { Person } from '../util/peopleView'

const props = defineProps<{
  relations: PersonRelation[]
  person: Person | null
}>()

const emit = defineEmits<{ (e: 'open-person', id: string | number): void }>()

// Constants, don't need to be computed — Vue2 :65 is also a pure literal computed, we keep the same-name local value
// for convenience so the formulas below can copy-paste Vue2 variable names.
const center = { x: 380, y: 200 }

const centerName = computed(() => props.person?.name ?? '')
const centerHref = computed(() =>
  props.person ? service.photos.personFaceThumbnailUrl(props.person.id, props.person.coverFaceId) : '',
)

interface NodePos {
  id: string | number
  name?: string
  coverFaceId?: string | number | null
  count: number
  x: number
  y: number
  strength: number
}

// Vue2 :68-85 positions computed — sort by count descending, then position by angle/distance formula.
const positions = computed<NodePos[]>(() => {
  if (props.relations.length === 0) return []
  const sorted = [...props.relations].sort((a, b) => b.count - a.count)
  const maxCount = Math.max(...sorted.map((r) => r.count), 1) // guard against division by zero (brief hard constraint)
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
  <svg v-if="relations.length > 0" viewBox="0 0 760 400" width="100%" height="400">
    <defs>
      <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" class="rg-glow-stop" stop-opacity="0.35" />
        <stop offset="100%" class="rg-glow-stop" stop-opacity="0" />
      </radialGradient>
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
      >{{ pos.name }}</text>
    </g>
  </svg>
</template>

<style scoped>
/* Colors all go through CSS classes (SVG presentation attribute doesn't recognize var(), see top of script
   comment). Geometric quantities (stroke-width/stroke-opacity/r/coordinates) are not colors, stay in template
   attributes, not moved here. */
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
.rg-name {
  fill: var(--fg);
}
.rg-name-dim {
  fill: var(--fg-muted);
}
.rg-node {
  cursor: pointer;
}
</style>
