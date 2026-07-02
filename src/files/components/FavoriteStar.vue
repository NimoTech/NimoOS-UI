<script setup lang="ts">
import { computed } from 'vue'
import { useFavoritesStore } from '../stores/favorites'

const props = defineProps<{ path: string; name: string }>()
const favorites = useFavoritesStore()
const active = computed(() => favorites.isFavorite(props.path))
function toggle() {
  if (active.value) favorites.remove(props.path)
  else favorites.add({ name: props.name, path: props.path })
}
</script>

<template>
  <button class="favorite-star" :class="{ active }" :aria-pressed="active" @click.stop="toggle">{{ active ? '★' : '☆' }}</button>
</template>

<style scoped>
.favorite-star { background: none; border: none; cursor: pointer; color: var(--fg-muted, #9aa4bf); font-size: 15px; line-height: 1; padding: 2px 4px; }
.favorite-star.active { color: var(--accent, #f5c451); }
</style>
