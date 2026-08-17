<script setup lang="ts">
// Member folder authorization — maps to Vue2 AccountPanel state 5 (:849-901) +
// loadMemberFolders/openGrantFolder/submitGrantFolder/revokeFolder(:554-609).
//
// ⛔ Granting = writes the user_folder_permissions table (**upsert**: same user+path only
//    changes the permission) + a real setfacl on that directory's ACL (user.go:766-774);
//    revoking = deletes the table row + setfacl -x (:806-816).
// ⚠️ **NimoOS core opens this table read-only at startup to decide file-area permissions**
//    (top-level CLAUDE.md) — granting the wrong thing affects file visibility.
// ⚠️ The user decided on 2026-08-01 not to click through this on real hardware this cycle
//    (debt D28); this device has zero members, so this screen is unreachable on real hardware
//    (you'd first have to create a member, and creating a member is itself a write op we're
//    not clicking through) → relies entirely on unit tests.
import { onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type MemberInfo, type UserFolderPermission } from '@nimotech/nimoos-service'
import AlertDialog from '../../../components/ui/AlertDialog.vue'
import { formatMemberDate } from '../../util/memberFormat'
import { useToast } from '../../../stores/toast'
import '../../styles/settings.css'

const props = defineProps<{ member: MemberInfo }>()
const { t } = useI18n()
const toast = useToast()

const folders = ref<UserFolderPermission[]>([])
const loading = ref(false)
const loadFailed = ref(false)

// In-place generation guard (plan C8). Has a second trigger point: successful grants and
// successful revokes both refetch the data.
let alive = true
let seq = 0
onUnmounted(() => {
  alive = false
})

async function loadFolders() {
  const mySeq = ++seq
  loading.value = true
  try {
    const list = await service.users.getMemberFolders(props.member.id)
    if (!alive || mySeq !== seq) return
    folders.value = list
    loadFailed.value = false
  } catch {
    if (!alive || mySeq !== seq) return
    // 🔧 plan C14: Vue2 also swallows the failure here into an empty array → shows
    // "no folders granted" instead of an error.
    folders.value = []
    loadFailed.value = true
  } finally {
    if (alive && mySeq === seq) loading.value = false
  }
}
loadFolders()

// ── Grant a new folder (inline form, Vue2 :855-872) ────────────────────────────
const showGrant = ref(false)
const newPath = ref('')
const newPermission = ref<'read' | 'write'>('read')
const grantError = ref('')
const grantBusy = ref(false)

function openGrant() {
  // Vue2 openGrantFolder(:567-572) resets on every open
  newPath.value = ''
  newPermission.value = 'read'
  grantError.value = ''
  showGrant.value = true
}

async function submitGrant() {
  if (grantBusy.value) return
  grantError.value = ''
  const p = newPath.value.trim() // Vue2 :576 / :582 both trim
  if (!p) {
    grantError.value = t('settingsAccEnterFolderPath')
    return
  }
  grantBusy.value = true
  try {
    // ⛔ Really writes the permissions table + setfacl — see the file header
    await service.users.grantMemberFolder(props.member.id, p, newPermission.value)
    showGrant.value = false
    await loadFolders()
    toast.show(t('settingsAccFolderGranted'))
  } catch (e) {
    const r = e as { response?: { data?: { message?: string } }; message?: string }
    grantError.value = r?.response?.data?.message || r?.message || t('settingsAccGrantFailed')
  } finally {
    grantBusy.value = false
  }
}

// ── Revoke access (with confirmation) ───────────────────────────────────────────────
// ⚠️ The target is stored in a non-reactive variable, and `@update:open` only handles
// visibility — reka's AlertDialogAction fires update:open(false) within the same click
// and may run first (same lesson as MembersSection.vue and UploadPanel.vue).
const revokeOpen = ref(false)
const revokeMessage = ref('')
let revokeTarget: UserFolderPermission | null = null

function askRevoke(perm: UserFolderPermission) {
  revokeTarget = perm
  // Vue2 bolds the path with `<b>`; ui/AlertDialog's message is plain text → not bolded (a logged minor difference)
  revokeMessage.value = `${t('settingsAccRevokePrefix')}${perm.path}?`
  revokeOpen.value = true
}

async function confirmRevoke() {
  const perm = revokeTarget
  revokeOpen.value = false
  if (!perm) return
  try {
    // perm_id goes through the query string (already wrapped by the shared package, see the comment in users.ts)
    await service.users.revokeMemberFolder(props.member.id, perm.id)
    await loadFolders()
    toast.show(t('settingsAccAccessRevoked'))
  } catch {
    toast.show(t('settingsAccRevokeFailed'))
  }
}
</script>

<template>
  <div class="set-perm">
    <!-- Vue2 :850-852's three-part copy: prefix + member name + suffix -->
    <p class="set-perm-intro" data-test="acc-perm-intro">
      {{ t('settingsAccFoldersAccessiblePrefix') }}<b>{{ member.username }}</b>{{ t('settingsAccSystemDiskBlocked') }}
    </p>

    <div v-if="showGrant" class="set-mem-form" data-test="acc-perm-form">
      <p v-if="grantError" class="set-danger" data-test="acc-perm-error">{{ grantError }}</p>
      <div class="set-net-field">
        <input
          v-model="newPath" class="set-input" type="text" :disabled="grantBusy"
          placeholder="/DATA/Downloads" data-test="acc-perm-path"
        >
      </div>
      <div class="set-net-field">
        <select v-model="newPermission" class="set-select" :disabled="grantBusy" data-test="acc-perm-permission">
          <option value="read">{{ t('settingsAccReadOnly') }}</option>
          <option value="write">{{ t('settingsAccReadWrite') }}</option>
        </select>
      </div>
      <div class="set-mem-form-foot">
        <button class="set-btn" type="button" data-test="acc-perm-cancel" @click="showGrant = false">
          {{ t('settingsCancel') }}
        </button>
        <button class="set-btn" type="button" :disabled="grantBusy" data-test="acc-perm-submit" @click="submitGrant">
          {{ t('settingsAccGrant') }}
        </button>
      </div>
    </div>

    <div v-if="!showGrant" class="set-perm-add">
      <button class="set-btn" type="button" data-test="acc-perm-add" @click="openGrant">
        + {{ t('settingsAccAddFolder') }}
      </button>
    </div>

    <p v-if="loading" class="set-fp-empty">…</p>
    <template v-else>
      <div v-for="perm in folders" :key="perm.id" class="set-mem-row" data-test="acc-perm-row">
        <div class="set-mem-row-main">
          <p class="set-perm-path">{{ perm.path }}</p>
          <p class="set-mem-meta">
            <span class="set-fp-tag" data-test="acc-perm-badge">
              {{ perm.permission === 'write' ? t('settingsAccReadWrite') : t('settingsAccReadOnly') }}
            </span>
            &nbsp;{{ formatMemberDate(perm.created_at) }}
          </p>
        </div>
        <!-- Monochrome glyph + aria-label, same rationale as MembersSection.vue -->
        <button
          class="set-btn" type="button" :aria-label="t('settingsAccRevoke')"
          data-test="acc-perm-revoke" @click="askRevoke(perm)"
        >
          ✕
        </button>
      </div>
      <!-- 🔧 plan C14: failure no longer masquerades as "no folders granted" -->
      <p v-if="loadFailed" class="set-danger" data-test="acc-perm-load-error">
        {{ t('settingsAccFoldersLoadFailed') }}
      </p>
      <p v-else-if="!folders.length && !showGrant" class="set-fp-empty" data-test="acc-perm-empty">
        {{ t('settingsAccNoFoldersGranted') }}
      </p>
    </template>

    <AlertDialog
      :open="revokeOpen"
      :title="t('settingsAccRevoke')"
      :message="revokeMessage"
      :confirm-text="t('settingsAccRevoke')"
      :cancel-text="t('settingsCancel')"
      destructive
      @update:open="revokeOpen = $event"
      @confirm="confirmRevoke"
    />
  </div>
</template>

<style scoped>
.set-perm-intro { margin: 0 0 16px; font-size: 13px; color: var(--fg-muted); }
.set-perm-add { display: flex; justify-content: flex-end; margin-bottom: 12px; }
.set-perm-path { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85rem; color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
