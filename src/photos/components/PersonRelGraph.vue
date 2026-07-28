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
// scoped <style> 的 CSS 属性(CSS 里的 fill/stroke 认 var(),presentation
// attribute 不认,是两条不同的解析路径)。Vue2 已经对文字用了这招
// (class="rg-name",:33,48),这里是把同一招扩展到全部颜色。几何量
// (stroke-width/stroke-opacity/r/坐标)不是颜色,继续留在 attribute 上。
//
// 补齐 affordance(brief 明确要求,非 Vue2 行为):Vue2 关系图节点不可点,跳转
// 入口只在共现列表/横条。这里给卫星节点(不含中心)加 click → emit
// open-person,登记为主动补齐而非移植缺陷。
import { computed } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { PersonRelation } from '../composables/usePersonDetail'
import type { Person } from '../util/peopleView'

const props = defineProps<{
  relations: PersonRelation[]
  person: Person | null
}>()

const emit = defineEmits<{ (e: 'open-person', id: string | number): void }>()

// 常量,不必是 computed —— Vue2 :65 也是纯字面量 computed,这里保留同名局部量
// 方便下面的公式照抄参照 Vue2 变量名。
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

// Vue2 :68-85 positions computed —— 按 count 降序排列后按角度/距离公式摆放。
const positions = computed<NodePos[]>(() => {
  if (props.relations.length === 0) return []
  const sorted = [...props.relations].sort((a, b) => b.count - a.count)
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
/* 颜色一律走 CSS class(SVG presentation attribute 不认 var(),见脚本区顶部
   注释)。几何量(stroke-width/stroke-opacity/r/坐标)不是颜色,留在模板的
   attribute 上,不搬进这里。 */
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
