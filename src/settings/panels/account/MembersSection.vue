<script setup lang="ts">
// Members section —— maps to the lower half of Vue2 AccountPanel state 1 (:664-712) +
// loadMembers/openAddMember/submitAddMember/deleteMember (:469-536).
//
// ⛔ Adding a member really runs useradd + chpasswd, writing /etc/shadow + setfacl (user.go:845-870);
//    deleting really runs userdel + **os.RemoveAll(that user's data directory)** (user.go:656-672, irreversible).
//    User decided on 2026-08-01: neither action gets clicked on a real device this cycle — both are parked as debt (D28).
// ⚠️ On this machine GET /v1/users/members verified to return [] → on the real device you only ever
//    see the "no members" empty state; the member row / folder_count / date formatting are unit-test only.
// ⚠️ The backend only hides the caller themselves, **it does not hide other admins** (user.go:694-697) →
//    a row with role==='admin' may show up in the list — **do not filter by role**.
import { onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type MemberInfo } from '@nimotech/nimoos-service'
import AlertDialog from '../../../components/ui/AlertDialog.vue'
import { formatMemberDate, validateNewMember } from '../../util/memberFormat'
import { useToast } from '../../../stores/toast'
import '../../styles/settings.css'

const emit = defineEmits<{ 'open-member': [member: MemberInfo] }>()
const { t } = useI18n()
const toast = useToast()

const members = ref<MemberInfo[]>([])
const loading = ref(false)
const loadFailed = ref(false)

// In-place generation guard (plan C8). This component **has a second trigger point**:
// both a successful add and a successful delete re-fetch, so "the previous fetch is still
// in flight when the next one returns" is a real path — use seq to tell them apart.
let alive = true
let seq = 0
onUnmounted(() => {
  alive = false
})

async function loadMembers() {
  const mySeq = ++seq
  loading.value = true
  try {
    const list = await service.users.getMembers()
    if (!alive || mySeq !== seq) return
    members.value = list
    loadFailed.value = false
  } catch {
    if (!alive || mySeq !== seq) return
    // 🔧 plan C14: Vue2's `catch { this.members = [] }` here swallows failures into an empty
    // list → the UI shows "no members" instead of an error, inconsistent with its sibling
    // panels on the same screen (the NAS ones do show an error). Distinguish explicitly here.
    members.value = []
    loadFailed.value = true
  } finally {
    if (alive && mySeq === seq) loading.value = false
  }
}
loadMembers()

// ── Add member (inline form, Vue2 :674-691) ─────────────────────────────────
const showAdd = ref(false)
const newUsername = ref('')
const newPassword = ref('')
const newConfirmation = ref('')
const addError = ref('')
const addBusy = ref(false)

function openAdd() {
  // Vue2 openAddMember (:481-487) clears all three inputs and the error every time it opens
  newUsername.value = ''
  newPassword.value = ''
  newConfirmation.value = ''
  addError.value = ''
  showAdd.value = true
}

const ADD_ERROR_KEY = {
  empty: 'settingsAccFillAllFields',
  tooShort: 'settingsAccPwdMin6',
  mismatch: 'settingsAccPwdMismatch',
} as const

async function submitAdd() {
  if (addBusy.value) return
  addError.value = ''
  const bad = validateNewMember(newUsername.value, newPassword.value, newConfirmation.value)
  if (bad) {
    addError.value = t(ADD_ERROR_KEY[bad])
    return
  }
  addBusy.value = true
  try {
    // ⛔ Really creates a Linux user —— see file header
    await service.users.createMember(newUsername.value, newPassword.value)
    showAdd.value = false
    await loadMembers()
    toast.show(t('settingsAccMemberAdded'))
  } catch (e) {
    // C6: inline error in the form, prefer the backend message (Vue2 also uses an inline b-notification here, consistent)
    const r = e as { response?: { data?: { message?: string } }; message?: string }
    addError.value = r?.response?.data?.message || r?.message || t('settingsAccMemberAddFailed')
  } finally {
    addBusy.value = false
  }
}

// ── Delete member (confirmation dialog, Vue2 deleteMember :520-536) ────────────────────
// ⚠️ The target lives in a **non-reactive** variable; `@update:open` only handles
// visibility, so the target must not be cleared there —— reka-ui's AlertDialogAction
// fires update:open(false) within the **same click**, and may run first; clearing the
// target there would make the subsequent confirm read null and delete nothing (this
// component's first version got this wrong exactly this way — caught only when two test
// cases went red). Same lesson as the existing one at files/components/UploadPanel.vue:116-126.
// A leftover deleteTarget after cancel is harmless: it is only read by confirmDelete, and the
// next askDelete overwrites it.
const deleteOpen = ref(false)
let deleteTarget: MemberInfo | null = null

const deleteMessage = ref('')
function askDelete(m: MemberInfo) {
  deleteTarget = m
  // Vue2 bolds the name with `<b>`; ui/AlertDialog's message is plain text → not bolded (a minor, already-logged difference)
  deleteMessage.value = `${t('settingsAccDelete')} ${m.username}?`
  deleteOpen.value = true
}

async function confirmDelete() {
  const m = deleteTarget
  deleteOpen.value = false
  if (!m) return
  try {
    // ⛔ Irreversible: userdel + os.RemoveAll(user data directory)
    await service.users.deleteUser(m.id)
    await loadMembers()
    toast.show(t('settingsAccDeleted'))
  } catch {
    // A panel-level action → a toast is the right call here (Vue2 does the same)
    toast.show(t('settingsAccDeleteFailed'))
  }
}
</script>

<template>
  <div class="set-mem">
    <div class="set-mem-head">
      <span class="set-mem-title">{{ t('settingsAccMembers') }}</span>
      <button class="set-btn" type="button" data-test="acc-member-add" @click="openAdd">
        + {{ t('settingsAccAdd') }}
      </button>
    </div>

    <!-- Add-member inline form -->
    <div v-if="showAdd" class="set-mem-form" data-test="acc-member-form">
      <p v-if="addError" class="set-danger" data-test="acc-member-error">{{ addError }}</p>
      <div class="set-net-field">
        <input
          v-model="newUsername" class="set-input" type="text" :disabled="addBusy"
          :placeholder="t('settingsAccUsername')" data-test="acc-member-username"
        >
      </div>
      <div class="set-net-field">
        <input
          v-model="newPassword" class="set-input" type="password" autocomplete="new-password"
          :disabled="addBusy" :placeholder="t('settingsAccPassword')" data-test="acc-member-password"
        >
      </div>
      <div class="set-net-field">
        <input
          v-model="newConfirmation" class="set-input" type="password" autocomplete="new-password"
          :disabled="addBusy" :placeholder="t('settingsAccConfirmPassword')" data-test="acc-member-confirm"
        >
      </div>
      <div class="set-mem-form-foot">
        <button class="set-btn" type="button" data-test="acc-member-cancel" @click="showAdd = false">
          {{ t('settingsCancel') }}
        </button>
        <button class="set-btn" type="button" :disabled="addBusy" data-test="acc-member-submit" @click="submitAdd">
          {{ t('settingsConfirm') }}
        </button>
      </div>
    </div>

    <p v-if="loading" class="set-fp-empty">…</p>
    <template v-else>
      <div v-for="m in members" :key="m.id" class="set-mem-row" data-test="acc-member-row">
        <div class="set-mem-row-main">
          <p class="set-mem-name">{{ m.username }}</p>
          <p class="set-mem-meta">
            {{ m.folder_count }} {{ t('settingsAccFoldersUnit') }} &nbsp;·&nbsp;
            {{ t('settingsAccCreatedAt') }}: {{ formatMemberDate(m.created_at) }}
          </p>
        </div>
        <!-- Icon buttons use **monochrome glyphs + aria-label**, consistent with the existing
             convention in this repo (SettingsRow.vue:28's `›`, PowerFlow.vue:60's `⟳`,
             AppActionsMenu.vue:10's `⋮`). Avoid code points like ⚙/🗑 that platforms render as
             **colorful emoji** — that clashes with this UI's monochrome visual language, and
             glyph shapes vary wildly across platforms (headless renders them as blank boxes).
             Vue2 uses mdi icons there (cog-outline / delete-outline); New-UI has no icon font. -->
        <button
          class="set-btn" type="button" :aria-label="t('settingsAccMembers')"
          data-test="acc-member-settings" @click="emit('open-member', m)"
        >
          ›
        </button>
        <button
          class="set-btn" type="button" :aria-label="t('settingsAccDelete')"
          data-test="acc-member-delete" @click="askDelete(m)"
        >
          ✕
        </button>
      </div>
      <!-- 🔧 plan C14: failures are no longer disguised as an empty state -->
      <p v-if="loadFailed" class="set-danger" data-test="acc-members-load-error">
        {{ t('settingsAccMembersLoadFailed') }}
      </p>
      <p v-else-if="!members.length && !showAdd" class="set-fp-empty" data-test="acc-members-empty">
        {{ t('settingsAccNoMembers') }}
      </p>
    </template>

    <AlertDialog
      :open="deleteOpen"
      :title="t('settingsAccDelete')"
      :message="deleteMessage"
      :confirm-text="t('settingsAccDelete')"
      :cancel-text="t('settingsCancel')"
      destructive
      @update:open="deleteOpen = $event"
      @confirm="confirmDelete"
    />
  </div>
</template>
