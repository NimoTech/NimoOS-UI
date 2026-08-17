<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RaidReattachableMember } from '@nimotech/nimoos-service'

// "Reclaim member drive" banner card: when the array is degraded and
// status.reattachable_members is non-empty, the parent view (StorageRaidDetail) mounts this
// **before** the member list / replace-drive entry point — reclaiming pulls the array's own
// drive back in (mdadm --re-add's bitmap incremental resync), which is cheap and correct;
// replacing a drive requires wiping one drive and a full rebuild. So this card uses the accent
// color (a primary accent button), visually distinct from the replace entry's warning red
// (--remove-fg).
//
// role / last_update / serial come from the member superblock (raw mdadm strings) — rendered
// only via {{ }} interpolation, never concatenated as HTML (untrusted external strings, a hard
// line we don't cross).
const props = defineProps<{ members: RaidReattachableMember[]; busy?: boolean }>()
defineEmits<{ (e: 'reclaim'): void }>()
const { t } = useI18n()

// Prefers serial for displaying identity: device letters can get reused after unplugging/
// replugging, so path is only trustworthy for a drive that's currently present (the same
// lesson learned the hard way in raidReplace.ts); falls back to path only when the drive has
// no serial number (serial is '').
const serials = computed(() => props.members.map((m) => m.serial || m.path).join(', '))
</script>

<template>
  <article class="rrc-card">
    <div class="rrc-body">
      <p class="rrc-hint">{{ t('raidReclaimHint', { serials }) }}</p>
      <ul class="rrc-list">
        <li v-for="(m, i) in members" :key="i" class="rrc-row">
          <span class="rrc-id">{{ m.serial || m.path }}</span>
          <span v-if="m.serial && m.path" class="rrc-path">{{ m.path }}</span>
          <span class="rrc-meta">{{ m.role }} · {{ t('raidReclaimLastSync') }} {{ m.last_update }}</span>
        </li>
      </ul>
    </div>
    <button class="rrc-btn" type="button" :disabled="busy" @click="$emit('reclaim')">
      {{ t('raidReclaimBtn') }}
    </button>
  </article>
</template>

<style scoped>
.rrc-card {
  display: flex; align-items: center; gap: 14px; padding: 14px 16px;
  background: var(--card-bg); border: 1px solid var(--accent-soft-bd); border-radius: var(--radius-sm);
  margin-bottom: 14px;
}
.rrc-body { flex: 1; min-width: 0; }
.rrc-hint { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: var(--accent-text); }
.rrc-list { list-style: none; margin: 0; padding: 0; }
.rrc-row { display: flex; align-items: baseline; gap: 10px; font-size: 12px; padding: 2px 0; flex-wrap: wrap; }
.rrc-id { font-family: var(--num-font); font-weight: 600; color: var(--fg); }
.rrc-path { font-family: monospace; color: var(--fg-muted); }
.rrc-meta { color: var(--fg-muted); }
/* Primary button: solid accent fill — visually distinguished from the member row's "replace
   drive" danger-toned outlined button */
.rrc-btn {
  flex: none; border: none; border-radius: 999px; padding: 7px 16px;
  background: var(--accent); color: var(--on-accent);
  font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap;
}
.rrc-btn:hover { background: var(--accent2); }
.rrc-btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
