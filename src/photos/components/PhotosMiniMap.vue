<script setup lang="ts">
import { computed } from 'vue'
import { MAP_H, MAP_W, WORLD_DOTS, project } from '../util/worldMap'

/* Padding added around the GPS cluster bounding box, in degrees. */
const LON_PAD = 20
const LAT_PAD = 15
/* Minimum visible span so the view never collapses to a single point. */
const MIN_LON_SPAN = 40
const MIN_LAT_SPAN = 30

interface MiniMapPoint {
  latitude: number
  longitude: number
  color: string
}

const props = defineProps<{
  /* Each item: { latitude, longitude, color }. */
  points?: MiniMapPoint[]
  /* Text shown in empty-state overlay when no valid GPS points exist. */
  emptyText?: string
}>()

/* Expose WORLD_DOTS for the template v-for. */
const worldDots = WORLD_DOTS

/* Filter out entries that lack valid lat/lon numbers. */
const validPoints = computed(() => (props.points || []).filter(
  p => p
    && typeof p.latitude === 'number'
    && typeof p.longitude === 'number'
    && !Number.isNaN(p.latitude)
    && !Number.isNaN(p.longitude),
))

/* Compute the SVG viewBox string.
   When GPS points exist, zoom to the cluster bounding box plus padding
   (clamped to a minimum span so a single location still renders clearly).
   When no points exist, show the full world map. */
const viewBox = computed(() => {
  const pts = validPoints.value
  if (!pts.length)
    return `0 0 ${MAP_W} ${MAP_H}`

  /* Bounding box in geographic coordinates. */
  const lons = pts.map(p => p.longitude)
  const lats = pts.map(p => p.latitude)
  let minLon = Math.min(...lons)
  let maxLon = Math.max(...lons)
  let minLat = Math.min(...lats)
  let maxLat = Math.max(...lats)

  /* Expand by padding, then clamp to valid coordinate range. */
  minLon = Math.max(minLon - LON_PAD, -180)
  maxLon = Math.min(maxLon + LON_PAD, 180)
  minLat = Math.max(minLat - LAT_PAD, -90)
  maxLat = Math.min(maxLat + LAT_PAD, 90)

  /* Guarantee minimum angular span so single-point views stay readable. */
  const lonSpan = maxLon - minLon
  if (lonSpan < MIN_LON_SPAN) {
    const lonMid = (minLon + maxLon) / 2
    minLon = Math.max(lonMid - MIN_LON_SPAN / 2, -180)
    maxLon = Math.min(lonMid + MIN_LON_SPAN / 2, 180)
  }
  const latSpan = maxLat - minLat
  if (latSpan < MIN_LAT_SPAN) {
    const latMid = (minLat + maxLat) / 2
    minLat = Math.max(latMid - MIN_LAT_SPAN / 2, -90)
    maxLat = Math.min(latMid + MIN_LAT_SPAN / 2, 90)
  }

  /* Convert geographic bounds to SVG viewBox coordinates.
     project() maps lon/lat -> {x, y} in the full MAP_W x MAP_H canvas.
     Top-left is the projected north-west corner; bottom-right is south-east. */
  const topLeft = project(minLon, maxLat)
  const bottomRight = project(maxLon, minLat)
  const vx = topLeft.x
  const vy = topLeft.y
  const vw = bottomRight.x - topLeft.x
  const vh = bottomRight.y - topLeft.y

  return `${vx} ${vy} ${vw} ${vh}`
})

/* Pre-project person GPS points for template rendering. */
const projectedPoints = computed(() => validPoints.value.map(pt => ({
  ...project(pt.longitude, pt.latitude),
  color: pt.color,
})))
</script>

<template>
  <div class="mini-map-root">
    <svg
      class="mini-map-svg"
      :viewBox="viewBox"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <!-- Background land dots -->
      <circle
        v-for="(d, i) in worldDots"
        :key="`bg-${i}`"
        class="dot-bg"
        :cx="d.x"
        :cy="d.y"
        r="1.3"
      />
      <!-- Person GPS points: color is data from props (PLACE_PALETTE), not a style -->
      <circle
        v-for="(pt, i) in projectedPoints"
        :key="`pt-${i}`"
        class="dot-person"
        :cx="pt.x"
        :cy="pt.y"
        r="4"
        :fill="pt.color"
        stroke-width="1.5"
      />
    </svg>
    <!-- Empty state overlay -->
    <div v-if="!validPoints.length" class="mini-map-empty">
      <span>{{ emptyText || 'No location data yet' }}</span>
    </div>
  </div>
</template>

<style scoped>
/* Task 6 (Plan E, 2026-08-15) shadowing-cleanup fix: `width`/`height`/`background` deleted —
   they duplicated (and, worse, mis-shadowed) parity's own `.map-card .mini-map-root` rule
   (src/photos/styles/vue2-parity/photos-people.scss:652-660, which also carries the
   `.photos-root.is-light` override this component's own single `background: var(--card)`
   literal had no equivalent for). This is the same shadowing pattern already fixed elsewhere
   in this codebase (see views/PhotosSearch.vue's own style-block header comment, "Scoped
   [data-v-xxx] specificity always won over the correct plain parity selector of the same
   name") — a component's own scoped `.mini-map-root[data-v-xxx] { background: var(--card) }`
   and parity's plain `.map-card .mini-map-root { background: var(--surface-1) }` carry equal
   selector-count specificity, so the LOCAL rule was winning regardless of the light/dark
   override existing in parity at all. This was the actual "light-theme mini-map has the wrong
   (white) background" bug: `--card` resolves to pure white (hex FFFFFF) in the light theme
   block (theme.css) — a flat white, not the warm off-white `oklch(0.975 0.004 80)` Vue2's own
   light-mode mini-map uses
   (photos-people.scss:658-660) — so every mount, dark or light, was silently rendering
   `--card`'s value instead of parity's `--surface-1` / light-override pair. Deleting the local
   rule lets parity govern directly, same as every other shadowing cleanup in this codebase.
   `position`/`border-radius`/`overflow` survive: parity's own rule doesn't set them (parity
   only sets width/height/background), so they're genuinely local, not duplicates. */
.mini-map-root {
  position: relative;
  border-radius: inherit;
  overflow: hidden;
}

/* SVG fills container entirely. */
.mini-map-svg {
  display: block;
  width: 100%;
  height: 100%;
}

/* Land background dots — muted, theme-aware via CSS class (no inline var() on SVG). */
.dot-bg {
  fill: var(--fg-faint);
}

/* theme-exception: 描边固定白色,不随主题切换——环要在任意主题底色上都能
   撑开任意 PLACE_PALETTE 填充色(fill 本身是逐点数据,由 :fill 绑定,见上)
   同例见 PhotosGrid.vue 的 .tile-vid 徽标(固定 chrome 叠加在可变内容上) */
.dot-person {
  stroke: #fff;
}

/* Empty state centred text overlay. */
.mini-map-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.mini-map-empty span {
  font-size: 12.5px;
  color: var(--fg-muted);
  background: var(--overlay-bg);
  backdrop-filter: blur(5px) saturate(180%);
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
}
</style>
