<script setup lang="ts">
// 迁移自 NimoOS-UI/src/components/Storage/raid/RaidDriveCard.vue(整卡点击 toggle、
// 右上勾选圈 SVG √、容量/类型/风险标,以及 :23-46 的健康信息展示:容量行分级健康色点 +
// 悬浮提示的型号/温度/通电时间/健康分进度条与百分比)。
//
// 📌 更正(2026-07-30):本文件此前的注释把温度/通电时长/悬浮提示说成"故障模拟器相关字段、
// 按 raidLevels.ts 迁移范围推迟" —— 那是**误归类**。Vue2 里这些是选盘卡片自身的常规信息展示;
// 故障模拟器是 RaidMatrix 里另一个弹窗(raidUtils 的 survival()/rebuildable()),两回事,
// 后者仍不在迁移范围。误归类导致这块被轻易推迟,用户 2026-07-28 实盘验收当场发现
// 「创建 RAID 时看不见磁盘健康状态」。
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

// Vue2 assignGroupColors 的 5 色循环 → 组件层把语义 key 映射到既有 theme token(不新增 token)。
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
// 外来阵列残留超块:可选,但要打警告标 —— 创建确认页会点名清除,请求带 wipe_raid_residue。
// array_name 来自盘上 mdadm 超块(不可信文本),只经模板插值渲染。
const hasResidue = computed(() => props.disk.raid?.role === 'residue')
const groupToken = computed(() => (props.groupKey ? GROUP_TOKEN_MAP[props.groupKey] : undefined))

// 健康信息展示(Vue2 RaidDriveCard.vue:64-72 的同名 computed)。
const temp = computed(() => tempDisplay(props.disk.temperature))
const tTone = computed(() => tempTone(props.disk.temperature))
const poh = computed(() => pohDisplay(props.disk.power_on_time))
const pTone = computed(() => pohTone(props.disk.power_on_time))
const healthScore = computed(() => diskHealthScore(props.disk))
const healthTone = computed(() => diskHealthTone(healthScore.value))

// 悬浮提示展开方向:默认向右(向上会被顶栏盖住),右侧放不下则翻左。进入卡片时量一次即可
// —— 提示只在 hover 期间可见,窗口尺寸变化会伴随新的一次 hover。
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
      <!-- 健康色点常显、按健康分分级着色(Vue2 :25)。此前写成 v-if="atRisk" 的二元风险点,
           而后端候选盘的 health 恒为空串 → 点永不出现 = 健康状态完全不可见。 -->
      <span class="rdc-dot" :class="`rdc-dot--${healthTone}`" aria-hidden="true"></span>
      <span class="rdc-cap">{{ fmtSize(disk.size) }}</span>
    </div>

    <div v-if="hasResidue" class="rdc-residue" :title="t('raidResidueExplain', { name: disk.raid?.array_name })">
      ⚠ {{ t('raidResidue') }}
    </div>

    <div v-if="groupToken" class="rdc-stripe" :style="{ background: `var(${groupToken})` }"></div>

    <!-- 悬浮提示(Vue2 :32-48):型号 / 温度 / 通电时间 / 健康分进度条 + 百分比。
         方向由 tipSide 决定:默认向右,右侧放不下翻左(Vue2 的向上被顶栏遮挡)。 -->
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
/* ⚠️ hover 时必须连卡片一起抬层。这句 transform 会让被悬停的卡片自己成为一个**层叠上下文**,
   于是 .rdc-tip 的 z-index 只在卡片内部有效、被关在里面 —— 后面的卡片和下方级别卡区块
   照 DOM 顺序盖在提示上(2026-07-30 用户实盘反馈"被其他东西挡住";静态截图不 hover 时不会暴)。
   抬 .rdc 自身才是解,单纯调大 .rdc-tip 的 z-index 无效。 */
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

/* 健康色点:三档语义色全部走 token —— Vue2 的绿/琥珀/红三个写死色值分别对应
   --sem-fg / --dem-fg / --remove-fg(色值本身不在此复述,color-guard 连注释一起扫) */
.rdc-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.rdc-dot--good { background: var(--sem-fg); }
.rdc-dot--warn { background: var(--dem-fg); }
.rdc-dot--bad { background: var(--remove-fg); }

/* 悬浮提示(Vue2 .rdc__tooltip)。卡片默认 overflow 可见。
   ⚠️ 方向与 Vue2 不同:Vue2 向上展开,而本区第一行紧贴顶栏会被盖住(用户实盘反馈),
   故改为**贴卡片侧边、垂直居中**展开,方向由 tipSide 判定。 */
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

/* 小三角指回卡片。--popup-bg 在暗色主题是渐变、不能用于 border-color,改用与之几乎同色的实心 --card */
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
