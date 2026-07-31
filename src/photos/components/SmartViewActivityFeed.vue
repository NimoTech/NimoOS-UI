<script setup lang="ts">
// SP7-P7a-T8: SmartViewActivityFeed.vue —— 智能视图详情页右栏第 4 段:活动流。
// 照 Vue2 NimoOS-UI src/views/Photos/PhotosSmartViewDetail.vue:211-229(模板)、
// :270-280(activityText)、:318-324(activity computed,`seeds: a.assetIds`)移植;
// 样式 photos-smartview.scss:606-625(+ :211-221 的占位缩略图内联 style,改成 class)。
//
// ── 未知 eventType(structural spec 表格最后一行,照 P6b insight 未知 key 的同款处置,
//    登记)──────────────────────────────────────────────────────────────────────
// Vue2 activityText() 的 default 分支(:278)把后端原始 eventType 字符串直接渲染给
// 用户。New-UI 改成:该行整体跳过 + console.warn 一次,不让内部枚举值泄漏到界面上。
//
// ── 零 v-html(§7e-6)────────────────────────────────────────────────────────
// matched(1 张)/matched(N 张)两种文案都要加粗一部分——Vue2 用 v-html 拼字符串,这里
// 改用 <i18n-t> 具名插槽。photosSvActOneMatched 的"1"是静态字面量,拆成主句键
// + 新增的 photosSvActOneMatchedBold 加粗词键;photosSvActNMatched 的 {n} 是真插值,
// 直接开槽(i18n 编辑细节见 zh_cn.ts/en_us.ts 旁注,任务报告里也登记了两种处理的取舍)。
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { relTime } from '../util/relTime'
import type { SmartViewActivity } from '../stores/smartViews'

const props = defineProps<{ activity: SmartViewActivity[]; now?: number }>()

const { t, locale } = useI18n()

type Kind = 'created' | 'updated' | 'matchedOne' | 'matchedN' | 'exported' | 'renamed'
interface Row { a: SmartViewActivity; kind: Kind; n: number }

// 未知 eventType 在这里被过滤掉(不进 rows),因此模板里不需要任何"默认/兜底"分支——
// 这本身就是「跳过该行」这个处置的实现位置。
const rows = computed<Row[]>(() => {
  const out: Row[] = []
  for (const a of props.activity) {
    switch (a.eventType) {
      case 'created':
        out.push({ a, kind: 'created', n: 0 })
        break
      case 'updated':
        out.push({ a, kind: 'updated', n: 0 })
        break
      case 'matched': {
        // 照搬 Vue2 :271:`(a.assetIds && a.assetIds.length) || 0`。
        const n = (a.assetIds && a.assetIds.length) || 0
        out.push({ a, kind: n === 1 ? 'matchedOne' : 'matchedN', n })
        break
      }
      case 'exported':
        out.push({ a, kind: 'exported', n: 0 })
        break
      case 'renamed':
        out.push({ a, kind: 'renamed', n: 0 })
        break
      default:
        console.warn('[photos-smartviews] unknown activity eventType', a.eventType)
    }
  }
  return out
})

function thumbSrc(id: string): string {
  return service.photos.thumbnailUrl(id, 'large')
}
function timeOf(a: SmartViewActivity): string {
  return relTime(a.occurredAt, props.now ?? Date.now(), t, locale.value)
}
</script>

<template>
  <div class="sv-side-section">
    <h3>{{ t('photosSvActivity') }}</h3>
    <div class="sv-activity" data-test="sv-activity-feed">
      <div v-for="row in rows" :key="row.a.id" class="sv-activity-row" data-test="sv-activity-row">
        <div class="sv-activity-thumbs">
          <template v-if="row.a.assetIds.length > 0">
            <img v-for="s in row.a.assetIds.slice(0, 3)" :key="s" :src="thumbSrc(s)" alt="">
          </template>
          <div v-else class="sv-activity-placeholder" data-test="sv-activity-placeholder">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
          </div>
        </div>
        <div style="flex:1;min-width:0">
          <div class="sv-activity-text" data-test="sv-activity-text">
            <template v-if="row.kind === 'created'">{{ t('photosSvSmartViewCreated') }}</template>
            <template v-else-if="row.kind === 'updated'">{{ t('photosSvConditionsSettingsUpdated') }}</template>
            <i18n-t v-else-if="row.kind === 'matchedOne'" keypath="photosSvActOneMatched" tag="span" scope="global">
              <template #photo><b>{{ t('photosSvActOneMatchedBold') }}</b></template>
            </i18n-t>
            <i18n-t v-else-if="row.kind === 'matchedN'" keypath="photosSvActNMatched" tag="span" scope="global">
              <template #n><b>{{ row.n }}</b></template>
            </i18n-t>
            <template v-else-if="row.kind === 'exported'">{{ t('photosSvExportedDetail', { detail: row.a.detail || t('photosSvExportFile') }) }}</template>
            <template v-else-if="row.kind === 'renamed'">{{ t('photosSvSmartViewRenamed') }}</template>
          </div>
          <div class="sv-activity-time">{{ timeOf(row.a) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 段标题同 SmartViewSidePanel.vue 的 .sv-side-section h3(scss:528-536)——两个组件各自
   scoped,不能跨组件共享样式,这里另写一份等价定义(同本区既有先例:PlaceInsights.vue
   与 PlaceDetailPanel.vue 各自持有一份 .detail-section h4)。 */
.sv-side-section { margin-bottom: 24px; }
.sv-side-section h3 {
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--fg-faint); margin: 0 0 10px;
}

/* ── 活动流(scss:606-625)── */
.sv-activity { display: flex; flex-direction: column; gap: 10px; }
.sv-activity-row { display: flex; gap: 8px; font-size: 11.5px; align-items: flex-start; }
.sv-activity-thumbs { display: flex; gap: 2px; flex-shrink: 0; }
.sv-activity-thumbs img { width: 26px; height: 26px; border-radius: 4px; object-fit: cover; }
/* Vue2 :219-221 内联 style(width/height/border-radius/background/display/
   align-items/justify-content)逐属性对照迁移;图标色 --accent-hi → --accent-text
   (同文件头 token 映射)。 */
.sv-activity-placeholder {
  width: 26px; height: 26px; border-radius: 4px; background: var(--accent-soft);
  display: flex; align-items: center; justify-content: center; color: var(--accent-text);
}
.sv-activity-text { flex: 1; color: var(--fg-muted); line-height: 1.4; }
.sv-activity-text b { color: var(--fg); font-weight: 600; }
.sv-activity-time { color: var(--fg-subtle); font-size: 10.5px; }
</style>
