<script setup lang="ts">
// 设置 · 账户。1:1 对位 Vue2 NimoOS-UI/src/components/account/AccountPanel.vue(1276 行),
// 设置区用的是 `<AccountPanel :isInline="true"/>`(SettingsPanel.vue:59-61)。
//
// 形态说明:Vue2 在 isInline 下**隐藏头部标题、保留底部页脚**
// (`<header v-if="!isInline">` / `<footer v-if="state !== 1">`),正文区随 state 换。
// New-UI 这里因此保持**面板内状态机 + 底部 Back/Submit** 的形态,不改成一堆弹窗 ——
// SettingsSection 的正文区正好对位模态正文区。
//
// state 取值与 Vue2 一致,但**没有 2**:
//   1 = 账号 / 3 = 改密 / 4 = 裁剪头像 / 5 = 成员文件夹授权 / 6 = 从 NAS 选图
// 🔧 plan C10:state 2「更改用户名」全仓 `goto(2)`/`state = 2` 零命中(本组件自身与
// TopBar.vue:526、SettingsPanel.vue:61 两个宿主都没有入口)= 死代码,不移植;
// 连带 saveUser()/users.setUserInfo 在界面上没有落点(域仍按 spec §5.7 补全了)。
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { service, type UserInfo } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import OwnerCard from './account/OwnerCard.vue'
import ChangePasswordForm from './account/ChangePasswordForm.vue'
import AvatarCropper from './account/AvatarCropper.vue'
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

// 头像 URL:版本号自增用于换头像后击穿 <img> 缓存(Vue2 avatarVersion,:140)。
const avatarVersion = ref(1)
const avatarSrc = computed(() => service.users.avatarPath(avatarVersion.value, readAccessToken()))

// 待裁剪图片。两种来源:本地文件(objectURL,需要 revoke)与 NAS 选图(/v1/image URL,不需要)。
const pickedImageSrc = ref('')
let pickedIsObjectUrl = false

// 就地过期守卫(不抽公共 helper,plan C8)。本面板**只在挂载时取一次数、没有第二个触发点**,
// 所以这个守卫防的是「取数在途时用户切走 tab」——卸载后不该再动 ref。
// ⚠️ 它在 jsdom 下**无法被断言区分**(删掉两处 `if (!alive) return` 测试结果完全不变,
// 已做变异验证)→ 按 P3 StoragePanel 的先例:守卫保留,**测试里不留空转用例**。
let alive = true

function releasePicked() {
  if (pickedIsObjectUrl && pickedImageSrc.value) URL.revokeObjectURL(pickedImageSrc.value)
  pickedIsObjectUrl = false
  pickedImageSrc.value = ''
}

// 🔧 plan C12:Vue2 换图时 revoke 的是**上一张**、失败时不 revoke、destroyed 只 revoke 一次
// → objectURL 泄漏。这里统一成「赋新值前先释放旧值 + 卸载时释放」。
function setPickedImage(src: string, isObjectUrl: boolean) {
  releasePicked()
  pickedImageSrc.value = src
  pickedIsObjectUrl = isObjectUrl
}

onUnmounted(() => {
  alive = false
  releasePicked()
})

/** 对位 Vue2 goto()(:192-214) 的状态切换 + 清理。 */
function goto(next: AccountState) {
  if (next === 1) releasePicked()
  state.value = next
}

onMounted(async () => {
  // Vue2 mounted 是 `if (this.$store.state.user.id === 0) updateUserInfo()` —— 依赖 Vuex 里
  // 已有的用户对象。New-UI 没有全局 user store(session.setUser 只写 localStorage 字符串),
  // 所以**无条件取一次**。这是形态差异导致的必要偏离,不是行为改动。
  try {
    const info = await service.users.getUserInfo()
    if (!alive) return
    user.value = info
  } catch {
    // 取不到就当没有用户信息:用户名空、成员区不渲染。这一屏没有别的降级手段。
    if (!alive) return
    user.value = null
  }
})

// 页脚 Submit 的落点。Vue2 :911-912 只在 state 3 / 4 有 Submit(state 2 那个是死代码,C10)。
const pwdForm = ref<{ submit(): Promise<boolean> } | null>(null)
const cropper = ref<{ submit(): Promise<boolean> } | null>(null)
const submitting = ref(false)

async function onSubmit() {
  if (submitting.value) return
  submitting.value = true
  try {
    if (state.value === 3) {
      // ⛔ 这一步会真改机主的登录凭据(见 ChangePasswordForm.vue 的文件头)。
      const ok = await pwdForm.value?.submit()
      if (!ok) return // 失败由表单内联显示(C6),留在 state 3
      // 🔧 Vue2 改密成功后什么都不提示(:433 只 goto(1))→ 补一个面板级 toast,
      // 与「更改头像」成功的提示保持一致(plan C1 的「改正确」)。
      toast.show(t('settingsAccUpdateOk'))
      goto(1)
    } else if (state.value === 4) {
      // ⛔ 会往磁盘写头像文件;后端对解不开的图片用 log.Fatal(见 AvatarCropper.vue 文件头)。
      const ok = await cropper.value?.submit()
      if (!ok) {
        // 🔧 Vue2 失败时弹 toast「更新失败」(:456-459)。这里错误已由裁剪器内联显示
        // (C6:比 toast 更可见),不再叠一个 toast;留在 state 4 让用户重试。
        return
      }
      toast.show(t('settingsAccUpdateOk'))
      avatarVersion.value++ // 击穿 <img> 缓存,新头像立刻可见
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
  // 面板级提示用 toast 是对的(C6 说的是**弹窗内**不要用 toast)。
  toast.show(t('settingsAccPickImageOnly'))
}

function logout() {
  // Vue2 还发了 $messageBus('account_setting_logout')(纯埋点,New-UI 无 publish 通道、
  // 用户不可见)与 SET_DEFAULT_WALLPAPER(New-UI 无壁纸系统 = 既有债务 D5)→ 两者都不移植。
  useAuth().logout()
  router.push('/login')
}
</script>

<template>
  <SettingsSection :title="t('settingsTabAccount')">
    <!-- state 1:账号卡 + 成员区(成员区在 Task 10 接) -->
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
      <!-- Task 10 填:成员区 -->
      <div v-if="isAdmin" data-test="acc-members" />
    </template>

    <ChangePasswordForm v-else-if="state === 3" ref="pwdForm" data-test="acc-pwd-form" />
    <AvatarCropper
      v-else-if="state === 4" ref="cropper" :src="pickedImageSrc"
      data-test="acc-cropper" :data-src="pickedImageSrc"
    />
    <!-- Task 11 填:成员文件夹授权 -->
    <div v-else-if="state === 5" data-test="acc-member-folders" />
    <!-- Task 9 填:从 NAS 选图 -->
    <div v-else-if="state === 6" data-test="acc-nas-picker" />

    <!-- 页脚:对位 Vue2 :908-913(isInline 下也保留,只在 state 1 隐藏) -->
    <div v-if="state !== 1" class="set-acc-foot" data-test="acc-footer">
      <button class="set-btn" type="button" data-test="acc-back" @click="goto(1)">
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
