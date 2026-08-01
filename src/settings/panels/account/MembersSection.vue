<script setup lang="ts">
// 成员区 —— 对位 Vue2 AccountPanel state 1 下半(:664-712)+ loadMembers/openAddMember/
// submitAddMember/deleteMember(:469-536)。
//
// ⛔ 添加会真 useradd + chpasswd 写 /etc/shadow + setfacl(user.go:845-870);
//    删除会 userdel + **os.RemoveAll(该用户数据目录)**(user.go:656-672,不可撤销)。
//    用户 2026-08-01 拍板:本期两条都不在真机上点、整块挂账(债务 D28)。
// ⚠️ 本机 GET /v1/users/members 实测返回 [] → 真机上只看得到「暂无成员」空态,
//    成员行 / folder_count / 时间格式化只有单测。
// ⚠️ 后端只隐藏调用者本人、**不隐藏其它管理员**(user.go:694-697)→ 列表里可能出现
//    role==='admin' 的行,**不要按 role 过滤**。
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

// 就地代际守卫(plan C8)。本组件**有第二个触发点**:添加成功、删除成功后都会重新取数,
// 所以「前一次取数还在飞、后一次已回来」是真实路径,用 seq 区分。
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
    // 🔧 plan C14:Vue2 这里 `catch { this.members = [] }` 把失败吞成空列表 → 界面显示
    // 「暂无成员」而不是报错,与同屏兄弟(NAS 那几处会报错)不一致。这里显式区分。
    members.value = []
    loadFailed.value = true
  } finally {
    if (alive && mySeq === seq) loading.value = false
  }
}
loadMembers()

// ── 添加成员(内联表单,Vue2 :674-691) ─────────────────────────────────
const showAdd = ref(false)
const newUsername = ref('')
const newPassword = ref('')
const newConfirmation = ref('')
const addError = ref('')
const addBusy = ref(false)

function openAdd() {
  // Vue2 openAddMember(:481-487) 每次打开都清空三个输入与错误
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
    // ⛔ 真建 Linux 用户 —— 见文件头
    await service.users.createMember(newUsername.value, newPassword.value)
    showAdd.value = false
    await loadMembers()
    toast.show(t('settingsAccMemberAdded'))
  } catch (e) {
    // C6:表单内联报错,优先后端 message(Vue2 也是内联 b-notification,这点一致)
    const r = e as { response?: { data?: { message?: string } }; message?: string }
    addError.value = r?.response?.data?.message || r?.message || t('settingsAccMemberAddFailed')
  } finally {
    addBusy.value = false
  }
}

// ── 删除成员(二次确认,Vue2 deleteMember :520-536) ────────────────────
// ⚠️ 目标存在**非响应式**变量里、`@update:open` 只管可见性,不能在那里清目标 ——
// reka-ui 的 AlertDialogAction 在**同一次点击**里就会发 update:open(false),且可能先跑,
// 在那里清掉目标会让随后的 confirm 读到 null、什么都不删(本组件第一版就这么错过,
// 两条用例翻红才逮到)。同 files/components/UploadPanel.vue:116-126 的既有教训。
// 取消后残留的 deleteTarget 无害:它只被 confirmDelete 读,且下次 askDelete 会覆盖。
const deleteOpen = ref(false)
let deleteTarget: MemberInfo | null = null

const deleteMessage = ref('')
function askDelete(m: MemberInfo) {
  deleteTarget = m
  // Vue2 用 `<b>` 加粗名字;ui/AlertDialog 的 message 是纯文本 → 不加粗(已登记的微小差异)
  deleteMessage.value = `${t('settingsAccDelete')} ${m.username}?`
  deleteOpen.value = true
}

async function confirmDelete() {
  const m = deleteTarget
  deleteOpen.value = false
  if (!m) return
  try {
    // ⛔ 不可撤销:userdel + os.RemoveAll(用户数据目录)
    await service.users.deleteUser(m.id)
    await loadMembers()
    toast.show(t('settingsAccDeleted'))
  } catch {
    // 面板级操作 → 用 toast 是对的(Vue2 同款)
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

    <!-- 添加成员内联表单 -->
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
        <button class="set-btn" type="button" data-test="acc-member-settings" @click="emit('open-member', m)">
          ⚙
        </button>
        <button class="set-btn" type="button" data-test="acc-member-delete" @click="askDelete(m)">
          🗑
        </button>
      </div>
      <!-- 🔧 plan C14:失败不再伪装成空态 -->
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
