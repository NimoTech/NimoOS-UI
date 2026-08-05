<script setup lang="ts">
// P6b-T5: PlaceInsights.vue —— 地点详情面板的"Nimo 发现"洞察卡片段。逐段照 Vue2
// NimoOS-UI src/views/Photos/PhotosPlacesView.vue:1174-1184(模板)移植;样式照
// photos-places.scss:729-756(跳过 :756-762 的 `.insight-card .meta`——模板里
// insight-card 内从未出现过 .meta 元素,是死 CSS,不迁)。
//
// spec §7c-4 硬要求:零 v-html。task-5-brief.md 原文引用的"P5-T13 先例"其实是反例——
// PersonRelationsTab.vue:19-29 最终选择的是"转义参数 + v-html",不是 <i18n-t>。本组件
// 按 spec 的**要求**(零 v-html)执行,不按它的**引证**;这条已在 plan 的 Self-Review
// 里登记,详见 task-5-report.md。四种后端形状(mostPhotographed/topSpot/companions/home)
// 各自的插值集合不同(有的要加粗某个参数、有的完全没有加粗参数),只能逐形状写死一条
// <i18n-t keypath scope="global">,不存在能通用四种形状的单一模板。
//
// 偏离登记 8(T1 已定,util/placesInsight.ts insightKey()):后端 key 是 Vue2 时代的
// 点分嵌套键,New-UI 用扁平驼峰键;未知 key 时 insightKey() 返回 null——这里据此让
// 该卡片整体不渲染 + console.warn 一次,不像 Vue2 的 pt() 那样把内部 key 原文吐给用户。
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PlaceInsight } from '../stores/places'
import { insightKey, joinCompanionNames } from '../util/placesInsight'

const props = defineProps<{ insights: PlaceInsight[] }>()
const { t } = useI18n()

interface RenderableInsight {
  ico: string
  k: string
  params: Record<string, unknown>
}

// 过滤掉未知 key 的卡片(偏离登记 8)。console.warn 只在这里触发一次每张未知卡片——
// computed 按引用缓存,props.insights 不变就不会重复警告。
const renderable = computed<RenderableInsight[]>(() => {
  const out: RenderableInsight[] = []
  for (const ins of props.insights) {
    const k = insightKey(ins.key)
    if (k === null) {
      console.warn('[photos-places] unknown insight key, skipping card', ins.key)
      continue
    }
    out.push({ ico: ins.ico, k, params: ins.params })
  }
  return out
})

// 图标三分支(brief §A-3):ico 恰有 sparkles/person/home 三值(后端契约,
// NimoOS-Photos/service/places.go:526-560),未知值回落 sparkles。
type IconName = 'sparkles' | 'person' | 'home'
function iconName(ico: string): IconName {
  return ico === 'person' || ico === 'home' ? ico : 'sparkles'
}
</script>

<template>
  <!-- 偏离登记(brief §A-1 写的是 v-if="insights.length > 0",此处改用
       renderable.length:若全部传入的 insight 都是未知 key,过滤后 renderable 为空,
       整段只剩一个光秃秃的"Nimo 发现"标题、没有任何卡片——这比 Vue2 更糟(Vue2 至少
       会把内部 key 吐给用户,好歹有内容),故这里让整段跟着一起消失。) -->
  <div v-if="renderable.length > 0" class="detail-section">
    <h4>
      {{ t('photosPlacesNimoNoticed') }}
    </h4>
    <div class="insights">
      <div v-for="(ins, idx) in renderable" :key="idx" class="insight-card">
        <span class="ico">
          <svg
            v-if="iconName(ins.ico) === 'sparkles'" data-test="insight-ico-sparkles"
            viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          ><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
          <svg
            v-else-if="iconName(ins.ico) === 'person'" data-test="insight-ico-person"
            viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          ><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
          <svg
            v-else data-test="insight-ico-home"
            viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          ><path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" /></svg>
        </span>

        <!-- 四个后端形状各一条 <i18n-t> 具名插槽,零 v-html(spec §7c-4)。keypath 由
             T1 的 insightKey() 给出,四条固定字符串比对(不是动态拼 keypath)对齐
             renderable 已过滤过的键集合。 -->
        <i18n-t v-if="ins.k === 'photosPlacesInsightTopSpot'" :keypath="ins.k" tag="span" scope="global">
          <template #spot>
            <b>{{ ins.params.spot }}</b>
          </template>
          <template #count>
            {{ ins.params.count }}
          </template>
        </i18n-t>
        <i18n-t v-else-if="ins.k === 'photosPlacesInsightCompanions'" :keypath="ins.k" tag="span" scope="global">
          <template #names>
            <b>{{ joinCompanionNames(ins.params.names) }}</b>
          </template>
        </i18n-t>
        <i18n-t v-else-if="ins.k === 'photosPlacesInsightHome'" :keypath="ins.k" tag="span" scope="global">
          <template #base>
            <b>{{ t('photosPlacesInsightHomeBase') }}</b>
          </template>
          <template #trips>
            {{ ins.params.trips }}
          </template>
          <template #count>
            {{ ins.params.count }}
          </template>
        </i18n-t>
        <!-- 剩下唯一形状:photosPlacesInsightMostPhotographed,只有 {count},无加粗参数。 -->
        <i18n-t v-else :keypath="ins.k" tag="span" scope="global">
          <template #count>
            {{ ins.params.count }}
          </template>
        </i18n-t>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* token 映射(Vue2 → New-UI,同 PlaceDetailPanel.vue 文件头 §6 既定表):--text-1/2/3 →
   --fg/--fg-muted/--fg-subtle;--surface-2 → --chip-bg;--line → --card-border;
   --r-sm → --radius-sm。本组件是独立 SFC,scoped 样式不跨组件边界生效(Vue 的
   scoped CSS 只把父级 scope 属性透传给子组件的根节点,不会透传给子组件模板内部的
   后代元素——PlaceDetailPanel.vue 里已有的 `.detail-section h4` 规则够不着这里的
   <h4>),故这里需要自己一份等价的标题样式,同 PersonPlacesTab.vue 的既有先例
   (该文件同样各自持有自己的 .detail-section 样式,不依赖跨组件共享)。 */
.detail-section h4 {
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--fg-subtle);
  margin: 0 0 10px;
  line-height: 1.4;
}

.insights {
  display: flex; flex-direction: column;
  gap: 10px;
}
.insight-card {
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: 10px;
  padding: 10px 12px;
  background: var(--chip-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--fg-muted);
  line-height: 1.5;
}
.insight-card .ico {
  width: 24px; height: 24px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--accent-soft);
  color: var(--accent-text);
  border-radius: 50%;
  margin-top: 1px;
}
.insight-card b { color: var(--fg); font-weight: 600; }
</style>
