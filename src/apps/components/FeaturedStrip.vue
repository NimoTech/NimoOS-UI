<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SnapCarousel from '../../components/SnapCarousel.vue'
import StoreCard from './StoreCard.vue'
import type { StoreApp } from '../util/storeApp'

defineProps<{ items: StoreApp[]; installed: (id: string) => boolean }>()
defineEmits<{ open: [id: string] }>()
const { t } = useI18n()
</script>

<template>
  <section v-if="items.length" class="featured-strip">
    <h2 class="featured-title">{{ t('appsStoreFeatured') }}</h2>
    <SnapCarousel :aria-label="t('appsStoreFeatured')">
      <StoreCard
        v-for="a in items" :key="a.id"
        class="featured-card" :app="a" :installed="installed(a.id)"
        @open="$emit('open', a.id)"
      />
    </SnapCarousel>
  </section>
</template>

<style scoped>
.featured-strip { margin-bottom: 18px; }
.featured-title { font-size: 15px; font-weight: 600; margin: 0 0 10px; color: var(--fg); }
.featured-card { width: 280px; }
</style>
