<script setup lang="ts">
// Account card -- mirrors Vue2 AccountPanel.vue state 1, upper half (:630-662).
// Left side: "local owner account" small label + large username + three buttons;
// right side: 108px round avatar.
//
// plan C11: after picking a local file, Vue2 runs it through FileReader -> sniffs the
// magic bytes to compute image.type, but that type is **never referenced in the
// template** (dead code). Here we only produce an objectURL and hand it to the host,
// without sniffing.
// plan C12: the objectURL's lifecycle is managed entirely by the **host** (revoke the
// old value before assigning a new one + revoke on unmount); this component only
// creates the URL and reports it upward, it never revokes it itself -- otherwise it
// could be freed before the host even uses it.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isAllowedImageFile } from '../../util/avatar'
import '../../styles/settings.css'

const props = defineProps<{ username: string; avatarSrc: string }>()
const emit = defineEmits<{
  'change-password': []
  'pick-local-file': [src: string]
  'choose-from-nas': []
  logout: []
  'invalid-file': []
}>()

const { t } = useI18n()
const menuOpen = ref(false)
const avatarFailed = ref(false)
const initial = computed(() => (props.username || '').slice(0, 1).toUpperCase())

// Measured on a real device: GET /v1/users/avatar returns 404 (the avatar field in the
// DB is an empty string and neither fallback svg exists), so the failure fallback is
// not optional. After changing the avatar, the host bumps the version number +1 -> src
// changes -> clears the failed state to retry.
watch(
  () => props.avatarSrc,
  () => {
    avatarFailed.value = false
  },
)

// Vue2's mounted hook does document.addEventListener('click', closeAvatarMenu), removed in destroyed.
function closeMenu() {
  menuOpen.value = false
}
onMounted(() => document.addEventListener('click', closeMenu))
onUnmounted(() => document.removeEventListener('click', closeMenu))

function onFileSelected(e: Event) {
  menuOpen.value = false
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (!f) return
  if (!isAllowedImageFile(f.name, f.type)) {
    input.value = ''
    emit('invalid-file')
    return
  }
  emit('pick-local-file', URL.createObjectURL(f))
}
</script>

<template>
  <div class="set-acc-card">
    <div class="set-acc-main">
      <p class="set-acc-owner-label">{{ t('settingsAccOwnerLabel') }}</p>
      <h1 class="set-acc-username" data-test="acc-username">{{ username }}</h1>
      <div class="set-acc-actions">
        <button class="set-btn" type="button" data-test="acc-change-password" @click.stop="emit('change-password')">
          {{ t('settingsAccChangePassword') }}
        </button>

        <!-- @click.stop: keep clicks on this layer from bubbling up to document and closing the menu we just opened -->
        <div class="set-acc-avatar-picker" @click.stop>
          <button class="set-btn" type="button" data-test="acc-change-avatar" @click="menuOpen = !menuOpen">
            {{ t('settingsAccChangeAvatar') }}
          </button>
          <div v-if="menuOpen" class="set-acc-avatar-menu" data-test="acc-avatar-menu">
            <label class="set-acc-avatar-opt">
              <span>{{ t('settingsAccUploadFromDevice') }}</span>
              <input
                class="set-acc-file-input" type="file" accept="image/*"
                data-test="acc-file-input" @change="onFileSelected"
              >
            </label>
            <button
              class="set-acc-avatar-opt" type="button" data-test="acc-nas"
              @click="menuOpen = false; emit('choose-from-nas')"
            >
              {{ t('settingsAccChooseFromNas') }}
            </button>
          </div>
        </div>

        <button class="set-btn set-acc-logout" type="button" data-test="acc-logout" @click.stop="emit('logout')">
          {{ t('settingsAccLogout') }}
        </button>
      </div>
    </div>
    <div class="set-acc-avatar-wrap">
      <img
        v-if="!avatarFailed" class="set-acc-avatar" :src="avatarSrc" alt=""
        data-test="acc-avatar-img" @error="avatarFailed = true"
      >
      <span v-else class="set-acc-avatar set-acc-avatar-initial" data-test="acc-avatar-fallback">{{ initial }}</span>
    </div>
  </div>
</template>
