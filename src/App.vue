<template>
  <div class="screen">
    <header class="topbar">
      <a class="back" href="/">← 返回主应用</a>
    </header>
    <router-view />
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.topbar { display: flex; align-items: center; padding: 12px 16px; }
.back { color: var(--accent); text-decoration: none; font-size: 14px; }
</style>
