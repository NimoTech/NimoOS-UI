<script setup lang="ts">
// 纯展示日志控制台外壳:深色控制台底 + 圆角 + 右上角浮动工具条 + 贴底自动滚动。
// 抽取自 src/apps/console/LogsPane.vue(应用控制台日志页),现由它与设置区「终端与日志」
// 的系统日志卡(src/settings/panels/terminal/LogsCard.vue)共用同一套外观与滚动行为。
// 不含任何取数/轮询逻辑——纯 props(text/emptyText)in、slot(tools/default)out。
//
// 布局细节可由调用方通过 CSS 自定义属性覆盖(默认值与原 LogsPane 完全一致,保证应用
// 控制台迁移后零视觉变化):--log-console-tools-top/-right(工具条浮层位置)、
// --log-console-pad-top(日志正文顶部内边距,设置区靠它给工具条让出净空)、
// --log-console-min-height/-max-height(设置区不在定高 flex 布局里,需要自己的高度上限)。
import { nextTick, ref, watch } from 'vue'

defineOptions({ name: 'LogConsole', inheritAttrs: false })
const props = defineProps<{ text: string; emptyText?: string }>()
const box = ref<HTMLElement | null>(null)

// 贴底自动滚动:仅当当前视口已经在(或接近)底部时才追加滚动到新内容尾部(阈值 40px)——
// 用户正上翻查看历史日志时不打断其滚动位置(照搬 LogsPane 原实现)。
watch(() => props.text, () => {
  const el = box.value
  if (!el) return
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  if (atBottom) void nextTick(() => { el.scrollTop = el.scrollHeight })
})
</script>

<template>
  <div class="log-console">
    <div class="log-console-tools"><slot name="tools" /></div>
    <slot />
    <pre ref="box" v-bind="$attrs" class="log-console-pre">{{ text || emptyText }}</pre>
  </div>
</template>

<style scoped>
.log-console {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: var(--log-console-min-height, 320px);
  max-height: var(--log-console-max-height, none);
  border-radius: 12px;
  overflow: hidden;
  background: var(--console-bg);
}
.log-console-tools {
  position: absolute;
  top: var(--log-console-tools-top, 10px);
  right: var(--log-console-tools-right, 28px);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
}
/* margin 上/右/下 10px:滚动条贴死滚动容器边缘且不可调距,把容器内缩才能让它离开圆角框
   (2026-07-22 真机踩坑:theme.css 对 * 设了标准 scrollbar-width/color,Chrome 121+
   因此禁用全部 ::-webkit-scrollbar 定制,此前的宽度/track margin 都是死代码)
   padding-top 单列成变量:设置区用它给浮层工具条让出净空,应用控制台不覆盖,原样 10px。 */
.log-console-pre {
  flex: 1;
  margin: 10px 10px 10px 0;
  padding: var(--log-console-pad-top, 10px) 14px 10px;
  overflow: auto;
  color: var(--console-fg);
  font: 13px/1.5 Consolas, Monaco, monospace;
  white-space: pre-wrap;
  word-break: break-all;
}
/* 固定深底上的拇指用固定亮色 token:全局滚动条色随主题翻转,浅色主题下深拇指在
   --console-bg 上不可见 */
.log-console-pre {
  scrollbar-width: thin;
  scrollbar-color: var(--console-scroll-thumb) transparent;
}
</style>
