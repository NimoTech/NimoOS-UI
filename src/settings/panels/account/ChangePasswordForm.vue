<script setup lang="ts">
// 改密表单 —— 对位 Vue2 AccountPanel state 3(:723-744)+ savePassword(:415-440)。
//
// ⛔ 这个表单提交后端会 chpasswd **写 /etc/shadow**(NimoOS-UserService route/v1/user.go:403),
// 而 SSH 与 Web 登录都读 /etc/shadow —— 改的是机主本机的登录凭据,**不可撤销**。
// 开发期一次都没真发过(plan D 表 / 债务 D26),覆盖靠单测。
//
// 🔧 plan C1 改正两处 Vue2 行为(不是自由发挥):
//   ① Vue2 把失败信息塞进 `b-notification` 且带 auto-close(会自己消失,用户可能没看见)
//      → 改成常驻内联 .set-danger,下次提交才清(C6:弹窗/表单内报错不用 toast)。
//   ② Vue2 成功后**什么提示都没有**,只 goto(1) → 成功 toast 由宿主补(与「更改头像」一致)。
// 校验:Vue2 靠 vee-validate 的 required/min:5 + 自己在 savePassword 里比一次 confirmation。
// 这里自己校验(New-UI 无 vee-validate),顺序 = 空 → 不一致,与 Vue2 可见行为等价。
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import '../../styles/settings.css'

const { t } = useI18n()

const oriPassword = ref('')
const password = ref('')
const confirmation = ref('')
const error = ref('')
const busy = ref(false)

async function submit(): Promise<boolean> {
  if (busy.value) return false
  error.value = ''
  if (!oriPassword.value || !password.value || !confirmation.value) {
    error.value = t('settingsAccFillAllFields')
    return false
  }
  if (password.value !== confirmation.value) {
    error.value = t('settingsAccPwdMismatch')
    return false
  }
  busy.value = true
  try {
    await service.users.changePassword(oriPassword.value, password.value)
    oriPassword.value = ''
    password.value = ''
    confirmation.value = ''
    return true
  } catch (e) {
    const r = e as { response?: { data?: { message?: string } }; message?: string }
    error.value = r?.response?.data?.message || r?.message || String(e)
    return false
  } finally {
    busy.value = false
  }
}
defineExpose({ submit })
</script>

<template>
  <div class="set-acc-pwd">
    <!-- 蜜罐:防浏览器把用户名自动填充打到别处(Vue2 :725 逐字照抄这套内联样式) -->
    <input
      type="text" autocomplete="username" aria-hidden="true" tabindex="-1"
      style="position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0;"
    >

    <p v-if="error" class="set-danger" data-test="acc-pwd-error">{{ error }}</p>

    <!-- .set-net-field 包一层:否则吃到 .set-input 的 width:92px(plan C7,P2 实测被截断过) -->
    <div class="set-net-field">
      <input
        v-model="oriPassword" class="set-input" type="password" autocomplete="new-password"
        :disabled="busy" :placeholder="t('settingsAccOriPassword')" data-test="acc-pwd-ori"
      >
    </div>
    <div class="set-net-field">
      <input
        v-model="password" class="set-input" type="password" autocomplete="new-password"
        :disabled="busy" :placeholder="t('settingsAccNewPassword')" data-test="acc-pwd-new"
      >
    </div>
    <div class="set-net-field">
      <input
        v-model="confirmation" class="set-input" type="password" autocomplete="new-password"
        :disabled="busy" :placeholder="t('settingsAccConfirmNewPassword')" data-test="acc-pwd-cfm"
      >
    </div>
  </div>
</template>

<style scoped>
.set-acc-pwd { position: relative; display: flex; flex-direction: column; gap: 14px; max-width: 420px; }
</style>
