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
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; }
.brand { font-weight: 600; letter-spacing: .5px; }
.status { display: flex; gap: 8px; }
.bar-btn { background: rgba(255,255,255,.08); border: 0; color: inherit; padding: 6px 12px; border-radius: 10px; font-size: 13px; text-decoration: none; cursor: pointer; }
.bar-btn[aria-pressed='true'] { background: var(--accent); color: #061018; }
</style>
