<template>
  <header class="topbar">
    <div class="brand">NimoOS</div>
    <div class="status">
      <a class="bar-btn" href="/">← 返回主应用</a>
      <button class="bar-btn add-btn" @click="$emit('add')">+ 添加</button>
      <button class="bar-btn edit-btn" :aria-pressed="editing" @click="toggleEdit()">{{ editing ? '完成' : '✎ 编辑' }}</button>
    </div>
  </header>
</template>
<script setup lang="ts">
import { useEditMode } from '../composables/useEditMode'
defineEmits<{ add: [] }>()
const { editing, toggleEdit } = useEditMode()
</script>
<style scoped>
/* topbar layout — base.css:29 */
.topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; height: 40px; padding: 0 20px; }

/* brand — base.css:30 + skin-spatial.css:163 */
.brand { display: flex; align-items: center; gap: 11px; font-weight: 600; font-size: 16px; letter-spacing: -0.2px; font-family: var(--brand-font, inherit); text-shadow: 0 1px 4px rgba(8, 12, 28, 0.4); }

/* status area — base.css:35 */
.status { display: flex; justify-content: flex-end; align-items: center; gap: 10px; color: var(--fg-muted); font-size: 13px; }

/* glass chip button — base.css:37-40 */
.bar-btn { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 13px; border: 1px solid var(--chip-border); border-radius: var(--chip-radius, 999px); background: var(--chip-bg); color: var(--fg); font-size: 13px; font-weight: 500; cursor: pointer; backdrop-filter: var(--blur); transition: background 0.2s, border-color 0.2s, box-shadow 0.2s; text-decoration: none; }
.bar-btn:hover { background: var(--chip-bg-hi); }
.bar-btn .icon { width: 16px; height: 16px; }

/* add-btn is a bar-btn variant — no extra overrides needed */

/* edit-btn active — maps #editBtn[aria-pressed="true"] from base.css:41 */
.edit-btn[aria-pressed='true'] { border-color: var(--accent); color: var(--accent); }
</style>
