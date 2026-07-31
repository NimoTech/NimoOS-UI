<script setup lang="ts">
// SP7-P7a-T5 fix round 1 · I1(Important):PhotosThreshSlider.vue —— 智能视图「质量阈值」
// 滑块基元(range + 三档标尺:宽松/平衡/严格),从 SmartViewCreateDialog.vue 抽出。
//
// 根因(评审判定,plan 的错不是任务的错):T5 brief 给的 scss read 区间 `:659-1013`
// 没盖到真正生效的滑块规则 `photos-smartview.scss:543-563`(优先级 (0,2,0),压过
// `photos.scss:2817` 的单类 `.sv-slider`),导致首版只写了 `.sv-slider { width: 100% }`,
// 全仓零 `slider-thumb`/`accent-color` —— 真机上会退化成浏览器默认灰控件。已回源逐行核过
// Vue2 生效规则,原样移植(见下方样式块注释)。
//
// 抽成独立组件的理由(控制器决定):同一套「range + 三档标尺」标记在本期要用三次——本任务、
// T8(详情页右栏阈值段)、T14(保存为智能视图弹层),三处标记完全相同,scoped SFC 下各写
// 一份就是 14 行样式重复三遍。
//
// ⚠ 契约已冻结,T8/T14 会照此签名消费,不要随意改动:
//   props: { value: number; min?: number; max?: number }   // 默认 min 50 / max 99
//   emits: (e: 'input', v: number): void                    // 即时,不做 debounce(节流是消费方的事)
// 照 Vue2 `:113-114` 的既定写法:range 用 :value + @input,不是 v-model。
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{ value: number; min?: number; max?: number }>(), {
  min: 50,
  max: 99,
})
const emit = defineEmits<{ (e: 'input', v: number): void }>()

const { t } = useI18n()

function onInput(e: Event): void {
  emit('input', Number((e.target as HTMLInputElement).value))
}
</script>

<template>
  <input
    type="range" :min="props.min" :max="props.max" :value="props.value" class="sv-slider"
    data-test="pts-range" @input="onInput"
  >
  <div class="sv-slider-marks">
    <span>{{ t('photosSvLoose') }}</span><span>{{ t('photosSvBalanced') }}</span><span>{{ t('photosSvStrict') }}</span>
  </div>
</template>

<style scoped>
/* 逐条照搬 Vue2 photos-smartview.scss:543-563(真正生效的规则,优先级 (0,2,0),压过
   photos.scss:2817 的单类 .sv-slider;控制器已回源逐行核过)。Vue2 原值摘要(不逐字引用
   完整声明,避免注释里出现字面颜色函数写法):轨道是 appearance:none 的渐变条(左侧
   accent 25% 透明度、右侧 accent 实色),thumb 是 18px 圆、白底、2px accent 描边、
   accent 40% 透明度的投影光晕。本仓没有那个逐 RGB 分量的 accent token(Global
   Constraints §33),两处半透明 accent 用既有 --accent-soft-2 就近取(dark .24 / light .20,比 --accent-soft 的
   .14/.11 更接近 Vue2 原值的 .25/.4 量级)。 */
.sv-slider {
  appearance: none;
  width: 100%;
  height: 6px;
  background: linear-gradient(to right, var(--accent-soft-2), var(--accent));
  border-radius: 99px;
  outline: 0;
  /* fix round 1 · M1(task-8 评审同批发现,控制器授权补):Vue2 `photos.scss:2817` 的
     低优先级裸 `.sv-slider` 把 `cursor: pointer` 挂在轨道本身上,未被高优先级规则覆盖,
     照样合并生效——之前只在 thumb 伪元素上给了指针光标,轨道本身漏了。 */
  cursor: pointer;
}
.sv-slider::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  /* theme-exception: 滑块圆点跨主题固定浅色,叠在 accent 渐变轨 + accent 描边之上,不用
     --on-accent——它默认深色主题下是深藏青,会失去这里需要的"白点"识别度(这是 Vue2 的
     刻意设计,不是可以随主题变化的语义色)。 */
  background: white;
  border: 2px solid var(--accent);
  box-shadow: 0 2px 8px var(--accent-soft-2);
  cursor: pointer;
}
/* Vue2 只写了 webkit 前缀,Firefox 下会退化成默认控件——这是补 Vue2 的缺,不是照搬
   (登记:Vue2 源码里没有这条,New-UI 主动补齐,私有前缀选择器必须独立声明才生效,不能
   靠逗号合并 selector list,否则整条规则在两个引擎下都失效)。 */
.sv-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  /* theme-exception: 同上方 ::-webkit-slider-thumb 的固定浅色理由。 */
  background: white;
  border: 2px solid var(--accent);
  box-shadow: 0 2px 8px var(--accent-soft-2);
  cursor: pointer;
}
.sv-slider-marks {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--fg-subtle);
  margin-top: 4px;
}
</style>
