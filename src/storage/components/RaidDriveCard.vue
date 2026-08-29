<script setup lang="ts">
// Ported from the Vue 2 panel's src/components/Storage/raid/RaidDriveCard.vue (whole-card click toggles,
// top-right checkmark-circle SVG √, capacity/type/risk badge, plus the health info display at
// :23-46: capacity-row tiered health dot + hover tooltip model/temperature/power-on time/health-score
// progress bar and percentage).
//
// 📌 Correction (2026-07-30): an earlier comment in this file described temperature/power-on time/
// the hover tooltip as "failure-simulator-related fields, deferred per raidLevels.ts migration
// scope" — that was a **misclassification**. In Vue2 these are the drive-picker card's own ordinary
// info display; the failure simulator is a different dialog in RaidMatrix (raidUtils's
// survival()/rebuildable()) — an unrelated feature that is indeed still out of migration scope.
// The misclassification let this get deferred too easily, and the user caught it on the spot
// during real-hardware acceptance on 2026-07-28: "can't see disk health status when creating a RAID."
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fmtSize } from '../../home/util/format'
import { tipSide } from '../util/tipSide'
import {
  isDiskAtRisk, tempDisplay, tempTone, pohDisplay, pohTone,
  diskHealthScore, diskHealthTone, type RaidDisk,
} from '../util/raidLevels'

const props = defineProps<{ disk: RaidDisk; selected: boolean; groupKey?: string }>()
defineEmits<{ (e: 'toggle'): void }>()

// Vue2 assignGroupColors' 5-color cycle → the component layer maps semantic keys to existing theme tokens (no new tokens added).
const GROUP_TOKEN_MAP: Record<string, string> = {
  'group-a': '--accent',
  'group-b': '--accent2',
  'group-c': '--sem-fg',
  'group-d': '--dem-fg',
  'group-e': '--nrm-fg',
}

const { t } = useI18n()

const isSsd = computed(() => props.disk.disk_type === 'SSD')
const atRisk = computed(() => isDiskAtRisk(props.disk))
// Leftover superblocks from a foreign array: optional, but must show a warning badge — the create-confirmation page calls it out for wiping, and the request carries wipe_raid_residue.
// array_name comes from the on-disk mdadm superblock (untrusted text), rendered only via template interpolation.
const hasResidue = computed(() => props.disk.raid?.role === 'residue')
const groupToken = computed(() => (props.groupKey ? GROUP_TOKEN_MAP[props.groupKey] : undefined))

// Health info display (same-named computed properties as Vue2 RaidDriveCard.vue:64-72).
const temp = computed(() => tempDisplay(props.disk.temperature))
const tTone = computed(() => tempTone(props.disk.temperature))
const poh = computed(() => pohDisplay(props.disk.power_on_time))
const pTone = computed(() => pohTone(props.disk.power_on_time))
const healthScore = computed(() => diskHealthScore(props.disk))
const healthTone = computed(() => diskHealthTone(healthScore.value))

// Tooltip expansion direction: defaults to the right (expanding upward would be covered by the top bar), flips left if there's no room on the right. Measuring once on card entry is enough
// — the tooltip is only visible during hover, and a window resize will come with a fresh hover.
const root = ref<HTMLElement | null>(null)
const side = ref<'left' | 'right'>('right')
function decideSide(): void {
  const el = root.value
  if (!el || typeof el.getBoundingClientRect !== 'function') return
  side.value = tipSide(el.getBoundingClientRect(), window.innerWidth)
}
</script>

<template>
  <article
    ref="root"
    class="rdc"
    :class="{ 'rdc--selected': selected, 'rdc--risk': atRisk }"
    @click="$emit('toggle')"
    @mouseenter="decideSide"
  >
    <div class="rdc-check" :class="{ 'rdc-check--on': selected }">
      <svg v-if="selected" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M2 6.5l2.5 2.5L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>

    <div class="rdc-icon" :class="isSsd ? 'rdc-icon--ssd' : 'rdc-icon--hdd'" aria-hidden="true">
      {{ isSsd ? 'SSD' : 'HDD' }}
    </div>

    <div class="rdc-name" :title="disk.path">{{ disk.path }}</div>

    <div class="rdc-meta">
      <!-- Health dot is always shown, colored by health-score tier (Vue2 :25). It used to be written as
           a binary risk dot with v-if="atRisk", and since the backend candidate drive's health is always
           an empty string → the dot never appeared = health status was completely invisible. -->
      <span class="rdc-dot" :class="`rdc-dot--${healthTone}`" aria-hidden="true"></span>
      <span class="rdc-cap">{{ fmtSize(disk.size) }}</span>
    </div>

    <div v-if="hasResidue" class="rdc-residue" :title="t('raidResidueExplain', { name: disk.raid?.array_name })">
      ⚠ {{ t('raidResidue') }}
    </div>

    <div v-if="groupToken" class="rdc-stripe" :style="{ background: `var(${groupToken})` }"></div>

    <!-- Hover tooltip (Vue2 :32-48): model / temperature / power-on time / health-score progress bar + percentage.
         Direction is decided by tipSide: defaults right, flips left if there's no room on the right (Vue2's upward direction gets covered by the top bar). -->
    <div class="rdc-tip" :class="`rdc-tip--${side}`">
      <div class="rdc-tip-model">{{ disk.model }}</div>
      <div class="rdc-tip-row">
        <span class="rdc-tip-l">{{ t('raidDriveTemp') }}</span>
        <span class="rdc-tip-v rdc-tip-temp" :class="`rdc-tip-v--${tTone}`">{{ temp }}</span>
      </div>
      <div class="rdc-tip-row">
        <span class="rdc-tip-l">{{ t('raidDrivePowerOn') }}</span>
        <span class="rdc-tip-v rdc-tip-poh" :class="`rdc-tip-v--${pTone}`">{{ poh }}</span>
      </div>
      <div class="rdc-tip-bar-wrap">
        <div class="rdc-tip-bar">
          <div class="rdc-tip-bar-fill" :class="`rdc-tip-bar-fill--${healthTone}`" :style="{ width: healthScore + '%' }"></div>
        </div>
        <span class="rdc-tip-pct">{{ healthScore }}%</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.rdc {
  position: relative;
  background: var(--card-bg);
  border: 1.5px solid var(--card-border);
  border-radius: var(--radius-xs);
  padding: 10px 10px 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  transition: border-color 0.18s, box-shadow 0.18s, transform 0.18s;
}
/* ⚠️ Hovering must raise the card's own stacking layer along with it. This transform makes the
   hovered card become its own **stacking context**, so .rdc-tip's z-index only applies inside
   the card and gets trapped there — later cards and lower-level card sections cover the tooltip
   per DOM order (2026-07-30 the user reported "covered by something else" on real hardware;
   a static non-hover screenshot won't reveal it). Raising .rdc itself is the fix; simply bumping
   .rdc-tip's z-index does nothing. */
.rdc:hover { transform: translateY(-1px); border-color: var(--accent); z-index: 60; }
.rdc--selected { border: 2px solid var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.rdc--risk { border-color: var(--remove-fg); }

.rdc-check {
  position: absolute; top: 7px; right: 7px;
  width: 16px; height: 16px; border-radius: 50%;
  border: 1.5px solid var(--chip-border); background: var(--card-bg);
  display: grid; place-items: center; color: var(--fg);
}
.rdc-check svg { width: 10px; height: 10px; }
.rdc-check--on { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }

.rdc-icon {
  width: 36px; height: 40px; border-radius: 6px;
  background: var(--nrm-bg); border: 1px solid var(--nrm-bd);
  display: flex; align-items: flex-end; justify-content: center;
  padding-bottom: 3px;
  font-size: 7px; font-weight: 700; color: var(--nrm-fg); letter-spacing: 0.1em;
}

.rdc-name {
  font-size: 11px; font-weight: 600; color: var(--fg);
  text-align: center; max-width: 96px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  padding: 0 4px;
}

.rdc-meta { display: flex; align-items: center; gap: 4px; }
.rdc-cap { font-size: 10px; color: var(--fg-muted); }
.rdc-residue { font-size: 10px; line-height: 1.2; color: var(--dem-fg); }

/* Health dot: all three severity tiers go through tokens — Vue2's three hardcoded tier colors
   correspond to --sem-fg / --dem-fg / --remove-fg (the color values themselves aren't repeated
   here; the color-guard scans comment text too) */
.rdc-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.rdc-dot--good { background: var(--sem-fg); }
.rdc-dot--warn { background: var(--dem-fg); }
.rdc-dot--bad { background: var(--remove-fg); }

/* Hover tooltip (Vue2 .rdc__tooltip). Card's overflow is visible by default.
   ⚠️ Direction differs from Vue2: Vue2 expands upward, but this section's first row sits right
   against the top bar and gets covered (per user real-hardware feedback), so it's changed to
   expand **flush against the card's side, vertically centered**, with direction decided by tipSide. */
.rdc-tip {
  display: none;
  flex-direction: column;
  gap: 5px;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: var(--popup-bg);
  border: 1px solid var(--border);
  color: var(--fg);
  border-radius: var(--radius-xs);
  padding: 10px 12px;
  font-size: 11px;
  white-space: nowrap;
  box-shadow: var(--panel-shadow);
  z-index: 50;
  pointer-events: none;
}
.rdc:hover .rdc-tip { display: flex; }

.rdc-tip--right { left: calc(100% + 8px); }
.rdc-tip--left { right: calc(100% + 8px); }

/* Small triangle points back at the card. --popup-bg is a gradient in the dark theme and can't be used for border-color, so use --card instead, a solid color nearly matching it */
.rdc-tip::after {
  content: "";
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  border: 6px solid transparent;
}
.rdc-tip--right::after { left: -12px; border-right-color: var(--card); }
.rdc-tip--left::after { right: -12px; border-left-color: var(--card); }

.rdc-tip-model { font-size: 10px; color: var(--fg-faint); margin-bottom: 2px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
.rdc-tip-row { display: flex; justify-content: space-between; gap: 16px; }
.rdc-tip-l { color: var(--fg-faint); }
.rdc-tip-v { font-weight: 500; color: var(--fg-muted); }
.rdc-tip-v--good { color: var(--sem-fg); }
.rdc-tip-v--warn { color: var(--dem-fg); }
.rdc-tip-v--bad { color: var(--remove-fg); }

.rdc-tip-bar-wrap { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
.rdc-tip-bar { flex: 1; height: 3px; border-radius: 99px; background: var(--nrm-bg); overflow: hidden; }
.rdc-tip-bar-fill { height: 100%; border-radius: 99px; background: var(--sem-fg); }
.rdc-tip-bar-fill--warn { background: var(--dem-fg); }
.rdc-tip-bar-fill--bad { background: var(--remove-fg); }
.rdc-tip-pct { font-size: 10px; color: var(--fg-faint); flex-shrink: 0; }

.rdc-stripe {
  position: absolute; left: 6px; right: 6px; bottom: 4px;
  height: 3px; border-radius: 2px;
}
</style>
