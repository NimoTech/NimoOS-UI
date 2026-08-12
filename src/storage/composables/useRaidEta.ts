import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RaidStatus } from '@nimotech/nimoos-service'
import { etaDurationParts, etaCompletionParts } from '../util/raidEta'

// 重建 ETA 展示(移植 Vue2 etaDisplayMixin,commit 028837e8):每 5 秒在「剩余约 X」
// 与「预计今天/明天/某日 HH:mm 完成」之间交替。
//
// 优先后端的 rebuild_eta_seconds(按重建位置推进速率估算 —— 位图增量同步时诚实;
// 内核的 rebuild_finish 只按已拷贝字节算,增量时会膨胀到几周),只有老后端不带该
// 字段时才回退内核原始字符串(带「预计完成」标签,与回退前的展示一致)。
// eta === -1(没有重建/样本还不够)→「正在估算剩余时间…」。
//
// 返回的 etaText 是自足的整句 —— 为空(既无 eta 也无 legacy 串)时调用方不渲染。
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
      // 老后端:没有 rebuild_eta_seconds 字段 → 回退内核原样串(带标签,自足)
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
