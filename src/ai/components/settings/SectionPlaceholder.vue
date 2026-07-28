<!--
  SP8-P2a Task 8 —— 新建组件,Vue2 无对应蓝本(SP2a 范围外的 9 个分区 +
  skills/mcp 本期都没有真组件)。

  简单占位面板:`.set-inner` + `.sk-section` 包一层(与 Vue2 各 xxxSection.vue
  的根结构一致,如 ThinkingDefaultsSection.vue:1-2 的 `.set-inner`),内容只有
  一个标题 + 一段说明文字。用于:
    - 本任务(T8)阶段暂占「模型」组 4 个分区(models/providers/privacy/thinking),
      待 Task 9/10/11 各自把 SECTION_COMPONENTS 对应行换成真组件
    - `blacklist`/`execution`/`search`/`memory`/`observability` → SP8-P2b
    - `mcptokens`/`channels` → SP8-P2b
    - `skills` → SP8-P3,`mcp` → SP8-P4
-->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = defineProps<{ titleKey: string; bodyKey: string }>()

const { t } = useI18n()
</script>

<template>
  <div class="set-inner">
    <div class="sk-section">
      <h1 class="set-h1">{{ t(props.titleKey) }}</h1>
      <p class="set-desc">{{ t(props.bodyKey) }}</p>
    </div>
  </div>
</template>
