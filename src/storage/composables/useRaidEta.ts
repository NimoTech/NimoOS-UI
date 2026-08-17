import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RaidStatus } from '@nimotech/nimoos-service'
import { etaDurationParts, etaCompletionParts } from '../util/raidEta'

// Rebuild ETA display (ported from the Vue2 etaDisplayMixin, commit 028837e8): every
// 5 seconds it alternates between "about X remaining" and "expected to finish
// today/tomorrow/on a given date at HH:mm".
//
// Prefers the backend's rebuild_eta_seconds (estimated from the rebuild position's
// advance rate — honest during bitmap incremental sync; the kernel's rebuild_finish
// only counts bytes already copied, which balloons to weeks during incremental sync),
// and only falls back to the raw kernel string (with the "expected to finish" label,
// matching the pre-fallback display) when an old backend does not send that field.
// eta === -1 (no rebuild in progress / not enough samples yet) → "estimating remaining
// time…".
//
// The returned etaText is a self-contained sentence — the caller renders nothing when
// it is empty (neither an eta nor a legacy string).
export function useRaidEta(status: () => RaidStatus | null | undefined) {
  const { t } = useI18n()
  const flip = ref(false)
  let timer: number | undefined
  onMounted(() => { timer = window.setInterval(() => { flip.value = !flip.value }, 5000) })
  onUnmounted(() => { clearInterval(timer) })

  function durationText(seconds: number): string {
    const p = etaDurationParts(seconds)
    if (!p) return ''
    if (p.days > 0) return t('raidEtaDurationDhm', { d: p.days, h: p.hours, m: p.minutes })
    if (p.hours > 0) return t('raidEtaDurationHm', { h: p.hours, m: p.minutes })
    if (p.minutes >= 1) return t('raidEtaDurationM', { m: p.minutes })
    return t('raidEtaUnderMinute')
  }

  const etaText = computed(() => {
    const s = status()
    const eta = s?.rebuild_eta_seconds
    if (eta == null) {
      // Old backend: no rebuild_eta_seconds field → fall back to the kernel's raw string (with label, self-contained)
      const legacy = typeof s?.rebuild_finish === 'string' ? s.rebuild_finish : ''
      return legacy ? `${t('raidRebuildFinish')} ${legacy}` : ''
    }
    if (eta < 0) return t('raidEtaCalculating')
    if (!flip.value) return t('raidEtaRemaining', { duration: durationText(eta) })
    const c = etaCompletionParts(eta)
    if (!c) return t('raidEtaCalculating')
    if (c.dayType === 'today') return t('raidEtaDoneToday', { time: c.time })
    if (c.dayType === 'tomorrow') return t('raidEtaDoneTomorrow', { time: c.time })
    return t('raidEtaDoneDate', { m: c.month, d: c.day, time: c.time })
  })

  return { etaText }
}
