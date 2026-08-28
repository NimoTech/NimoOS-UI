<script setup lang="ts">
// Settings · Account. 1:1 mapped to the Vue 2 panel's src/components/account/AccountPanel.vue (1276 lines),
// the settings area uses `<AccountPanel :isInline="true"/>` (SettingsPanel.vue:59-61).
//
// Shape notes: under isInline, Vue2 **hides the header title, keeps the bottom footer**
// (`<header v-if="!isInline">` / `<footer v-if="state !== 1">`), and the body swaps with state.
// New-UI therefore keeps the **in-panel state machine + bottom Back/Submit** shape instead of
// turning it into a pile of dialogs — SettingsSection's body area maps neatly onto the modal body area.
//
// state values match Vue2, but **there is no 2**:
//   1 = account / 3 = change password / 4 = crop avatar / 5 = member folder permissions / 6 = pick image from NAS
// 🔧 plan C10: state 2 "change username" has zero hits for `goto(2)`/`state = 2` across the whole repo
// (neither this component itself nor the two hosts, TopBar.vue:526 and SettingsPanel.vue:61, have an
// entry point) = dead code, not ported; likewise saveUser()/users.setUserInfo has no landing spot in the
// UI (the field is still filled in per spec §5.7).
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { service, type MemberInfo, type UserInfo } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import OwnerCard from './account/OwnerCard.vue'
import ChangePasswordForm from './account/ChangePasswordForm.vue'
import AvatarCropper from './account/AvatarCropper.vue'
import NasImagePicker from './account/NasImagePicker.vue'
import MembersSection from './account/MembersSection.vue'
import MemberFoldersView from './account/MemberFoldersView.vue'
import { readAccessToken } from '../util/avatar'
import { useAuth } from '../../composables/useAuth'
import { useToast } from '../../stores/toast'
import '../styles/settings.css'

type AccountState = 1 | 3 | 4 | 5 | 6

const { t } = useI18n()
const router = useRouter()
const toast = useToast()

const state = ref<AccountState>(1)
const user = ref<UserInfo | null>(null)
const isAdmin = computed(() => user.value?.role === 'admin')

// Avatar URL: version number auto-increments to bust the <img> cache after changing the avatar (Vue2 avatarVersion, :140).
const avatarVersion = ref(1)
const avatarSrc = computed(() => service.users.avatarPath(avatarVersion.value, readAccessToken()))

// Image pending crop. Two sources: a local file (objectURL, needs revoking) and a NAS pick (/v1/image URL, no revoke needed).
const pickedImageSrc = ref('')
let pickedIsObjectUrl = false

// Inline staleness guard (not extracted into a shared helper, plan C8). This panel **only fetches data
// once at mount, with no second trigger point**, so this guard protects against "the user switches tabs
// while the fetch is in flight" — the ref should not be touched after unmount.
// ⚠️ It **cannot be distinguished by any assertion** under jsdom (deleting both `if (!alive) return`
// checks leaves the test results completely unchanged — mutation testing confirmed this) → following the
// P3 StoragePanel precedent: keep the guard, **don't add a no-op test case just to have one**.
let alive = true

function releasePicked() {
  if (pickedIsObjectUrl && pickedImageSrc.value) URL.revokeObjectURL(pickedImageSrc.value)
  pickedIsObjectUrl = false
  pickedImageSrc.value = ''
}

// 🔧 plan C12: when Vue2 switches images it revokes **the previous one**, doesn't revoke on failure, and
// destroyed only revokes once → objectURL leaks. Here it's unified to "release the old value before
// assigning a new one + release on unmount".
function setPickedImage(src: string, isObjectUrl: boolean) {
  releasePicked()
  pickedImageSrc.value = src
  pickedIsObjectUrl = isObjectUrl
}

onUnmounted(() => {
  alive = false
  releasePicked()
})

/** Maps to Vue2's goto() (:192-214) state transition + cleanup. */
function goto(next: AccountState) {
  if (next === 1) releasePicked()
  state.value = next
}

/** Footer "Back". Branches map 1:1 to Vue2 :909:
 *  state 5 → back to 1 and clears activeMember; state 6 while in browse view → only back to the storage card grid; otherwise goto(1). */
function onBack() {
  if (state.value === 5) {
    activeMember.value = null
    goto(1)
    return
  }
  if (state.value === 6 && nasPicker.value?.view === 'browse') {
    nasPicker.value.backToStorages()
    return
  }
  goto(1)
}

function onOpenMember(m: MemberInfo) {
  activeMember.value = m
  goto(5)
}

function onNasPick(picked: { path: string; src: string }) {
  // NAS picks are /v1/image URLs, not objectURLs, so no revoke is needed (second arg false).
  setPickedImage(picked.src, false)
  goto(4)
}

onMounted(async () => {
  // Vue2's mounted is `if (this.$store.state.user.id === 0) updateUserInfo()` — it relies on the user
  // object already present in Vuex. New-UI has no global user store (session.setUser only writes a
  // localStorage string), so it **unconditionally fetches once**. This is a necessary deviation caused
  // by the shape difference, not a behavior change.
  try {
    const info = await service.users.getUserInfo()
    if (!alive) return
    user.value = info
  } catch {
    // If the fetch fails, treat it as no user info: username is empty, members section doesn't render. There's no other fallback for this screen.
    if (!alive) return
    user.value = null
  }
})

// Landing spot for the footer Submit. Vue2 :911-912 only has Submit in state 3 / 4 (state 2's is dead code, C10).
const pwdForm = ref<{ submit(): Promise<boolean> } | null>(null)
const cropper = ref<{ submit(): Promise<boolean> } | null>(null)
const nasPicker = ref<{ backToStorages(): void; view: 'storages' | 'browse' } | null>(null)
const activeMember = ref<MemberInfo | null>(null)
const submitting = ref(false)

async function onSubmit() {
  if (submitting.value) return
  submitting.value = true
  try {
    if (state.value === 3) {
      // ⛔ This step really changes the device owner's login credentials (see the file header of ChangePasswordForm.vue).
      const ok = await pwdForm.value?.submit()
      if (!ok) return // failure is shown inline by the form (C6); stay on state 3
      // 🔧 Vue2 shows nothing after a successful password change (:433 only calls goto(1)) → add a
      // panel-level toast to match the success prompt for "change avatar" (plan C1's "fix").
      toast.show(t('settingsAccUpdateOk'))
      goto(1)
    } else if (state.value === 4) {
      // ⛔ Writes the avatar file to disk; the backend uses log.Fatal for images it can't decode (see the file header of AvatarCropper.vue).
      const ok = await cropper.value?.submit()
      if (!ok) {
        // 🔧 Vue2 shows a toast "update failed" on failure (:456-459). Here the error is already shown
        // inline by the cropper (C6: more visible than a toast), so no extra toast is stacked on top;
        // stay on state 4 so the user can retry.
        return
      }
      toast.show(t('settingsAccUpdateOk'))
      avatarVersion.value++ // busts the <img> cache so the new avatar is visible immediately
      goto(1)
    }
  } finally {
    submitting.value = false
  }
}

function onPickLocalFile(src: string) {
  setPickedImage(src, true)
  goto(4)
}

function onInvalidFile() {
  // A panel-level toast is correct here (C6 is about not using a toast **inside a dialog**).
  toast.show(t('settingsAccPickImageOnly'))
}

function logout() {
  // Vue2 also fires $messageBus('account_setting_logout') (pure telemetry, New-UI has no publish
  // channel and it's invisible to the user) and SET_DEFAULT_WALLPAPER (New-UI has no wallpaper system
  // = existing debt D5) → neither is ported.
  useAuth().logout()
  router.push('/login')
}
</script>

<template>
  <SettingsSection :title="t('settingsTabAccount')">
    <!-- state 1: account card + members section (members section wired up in Task 10) -->
    <template v-if="state === 1">
      <OwnerCard
        :username="typeof user?.username === 'string' ? user.username : ''"
        :avatar-src="avatarSrc"
        @change-password="goto(3)"
        @pick-local-file="onPickLocalFile"
        @choose-from-nas="goto(6)"
        @logout="logout"
        @invalid-file="onInvalidFile"
      />
      <MembersSection v-if="isAdmin" data-test="acc-members" @open-member="onOpenMember" />
    </template>

    <ChangePasswordForm v-else-if="state === 3" ref="pwdForm" data-test="acc-pwd-form" />
    <AvatarCropper
      v-else-if="state === 4" ref="cropper" :src="pickedImageSrc"
      data-test="acc-cropper" :data-src="pickedImageSrc"
    />
    <MemberFoldersView
      v-else-if="state === 5 && activeMember" :member="activeMember"
      data-test="acc-member-folders"
    />
    <NasImagePicker
      v-else-if="state === 6" ref="nasPicker"
      data-test="acc-nas-picker" @pick="onNasPick"
    />

    <!-- Footer: maps to Vue2 :908-913 (kept even under isInline, only hidden in state 1) -->
    <div v-if="state !== 1" class="set-acc-foot" data-test="acc-footer">
      <button class="set-btn" type="button" data-test="acc-back" @click="onBack">
        {{ t('settingsAccBack') }}
      </button>
      <button
        v-if="state === 3 || state === 4" class="set-btn" type="button"
        :disabled="submitting" data-test="acc-submit" @click="onSubmit"
      >
        {{ t('settingsAccSubmit') }}
      </button>
    </div>
  </SettingsSection>
</template>
