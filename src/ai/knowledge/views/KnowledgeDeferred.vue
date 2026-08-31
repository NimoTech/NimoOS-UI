<!--
  Knowledge base placeholder page (deviation K7).

  Of the 9 child routes in the blueprint (Vue2), this batch lands only dashboard,
  the other 8 (search/wiki/notes/indexed-files/queue/roots/allowlist/settings) and
  two separate routes /ai/parser and /ai/parser/test all temporarily point to this
  placeholder page, keeping the rail at blueprint's 9 items 1:1 (do not delete
  items, do not change jump targets), phased replacement of child routes other than
  dashboard and parser routes with real components (see deferred.ts DEFERRED_TABS/
  isDeferred).

  No <style> block: entirely reuse .k-scroll/.k-empty* classes already in
  knowledge.scss (R1 — this stylesheet is not yet imported by any file, visuals
  do not take effect until T10 lands KnowledgeLayout.vue, this is expected, do not
  add import in this task, avoid collision with T10). Copy text is two new keys
  aiKbDeferredTitle/aiKbDeferredHint (Vue2 has no corresponding copy).
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
