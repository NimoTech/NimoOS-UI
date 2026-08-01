<script setup lang="ts">
// 账号卡 —— 对位 Vue2 AccountPanel.vue state 1 上半(:630-662)。
// 左侧:「本机所有者账户」小标 + 大号用户名 + 三个按钮;右侧:108px 圆形头像。
//
// 🔧 plan C11:Vue2 选完本地文件后走 FileReader → 嗅探魔数算出 image.type,但那个 type
// **模板里零引用**(死代码)。这里只产出 objectURL 交给宿主,不做嗅探。
// 🔧 plan C12:objectURL 的生命周期由**宿主**统一管(赋新值前 revoke 旧值 + 卸载时 revoke),
// 本组件只负责 create 并往上报,不自己 revoke —— 否则宿主还没用就被释放了。
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

// 真机实测 GET /v1/users/avatar 返回 404(DB avatar 为空串且两个兜底 svg 都不存在),
// 所以失败兜底不是可选项。换头像后宿主会把版本号 +1 → src 变 → 清掉失败态重试。
watch(
  () => props.avatarSrc,
  () => {
    avatarFailed.value = false
  },
)

// Vue2 mounted 里 document.addEventListener('click', closeAvatarMenu),destroyed 摘掉。
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

        <!-- @click.stop:别让这一层的点击冒到 document 上把刚打开的菜单又关掉 -->
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
