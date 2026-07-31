<!--
  SP8-P5a Task 5 —— 知识库占位页(偏离 K7)。

  蓝本(Vue2)9 个子路由里,本批只落地 dashboard 一个,其余 8 个(search/wiki/
  notes/indexed-files/queue/roots/allowlist/settings)与独立的 /ai/parser、
  /ai/parser/test 两条路由暂时全部指向这个占位页,让 rail 保持蓝本的 9 项
  1:1(不删条目、不改跳转目标),分批把 '' 之外的子路由和 parser 路由换成
  真组件(见 deferred.ts 的 DEFERRED_TABS/isDeferred)。

  零 <style> 块:全部复用 knowledge.scss 已有的 .k-scroll/.k-empty* 类
  (R1——该样式表尚未被任何文件 import,视觉在 T10 落地 KnowledgeLayout.vue 之前
  不生效,这是预期的,不在本任务里补 import,避免和 T10 撞车)。
  文案是 aiKbDeferredTitle/aiKbDeferredHint 两个新造键(Vue2 没有对应文案)。
-->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="k-scroll">
    <div class="k-scroll-inner">
      <div class="k-empty">
        <div class="k-empty-illust" />
        <div class="k-empty-title">{{ t('aiKbDeferredTitle') }}</div>
        <div class="k-empty-sub">{{ t('aiKbDeferredHint') }}</div>
      </div>
    </div>
  </div>
</template>
