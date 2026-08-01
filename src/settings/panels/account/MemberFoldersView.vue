<script setup lang="ts">
// 成员文件夹授权 —— 对位 Vue2 AccountPanel state 5(:849-901)+ loadMemberFolders/
// openGrantFolder/submitGrantFolder/revokeFolder(:554-609)。
//
// ⛔ 授权 = 写 user_folder_permissions 表(**upsert**:同 user+path 只改 permission)
//    + 真 setfacl 改该目录 ACL(user.go:766-774);撤销 = 删表行 + setfacl -x(:806-816)。
// ⚠️ **NimoOS core 启动时只读打开这张表做文件区权限判定**(顶层 CLAUDE.md)——
//    授错会影响文件的可见性。
// ⚠️ 用户 2026-08-01 拍板本期不在真机上点(债务 D28);本机零成员,这一屏在真机上
//    进不去(要先建成员,而建成员本身也是不点的写操作)→ 全靠单测。
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

// 就地代际守卫(plan C8)。有第二个触发点:授权成功、撤销成功都会重新取数。
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
    // 🔧 plan C14:Vue2 这里也把失败吞成空数组 → 显示「未授权任何文件夹」而不是报错。
    folders.value = []
    loadFailed.value = true
  } finally {
    if (alive && mySeq === seq) loading.value = false
  }
}
loadFolders()

// ── 授权新文件夹(内联表单,Vue2 :855-872) ────────────────────────────
const showGrant = ref(false)
const newPath = ref('')
const newPermission = ref<'read' | 'write'>('read')
const grantError = ref('')
const grantBusy = ref(false)

function openGrant() {
  // Vue2 openGrantFolder(:567-572) 每次打开都重置
  newPath.value = ''
  newPermission.value = 'read'
  grantError.value = ''
  showGrant.value = true
}

async function submitGrant() {
  if (grantBusy.value) return
  grantError.value = ''
  const p = newPath.value.trim() // Vue2 :576 / :582 都 trim
  if (!p) {
    grantError.value = t('settingsAccEnterFolderPath')
    return
  }
  grantBusy.value = true
  try {
    // ⛔ 真写权限表 + setfacl —— 见文件头
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

// ── 撤销授权(二次确认) ───────────────────────────────────────────────
// ⚠️ 目标存非响应式变量、`@update:open` 只管可见性 —— reka 的 AlertDialogAction 在同一次
// 点击里就发 update:open(false) 且可能先跑(同 MembersSection.vue 与 UploadPanel.vue 的教训)。
const revokeOpen = ref(false)
const revokeMessage = ref('')
let revokeTarget: UserFolderPermission | null = null

function askRevoke(perm: UserFolderPermission) {
  revokeTarget = perm
  // Vue2 用 `<b>` 加粗路径;ui/AlertDialog 的 message 是纯文本 → 不加粗(已登记的微小差异)
  revokeMessage.value = `${t('settingsAccRevokePrefix')}${perm.path}?`
  revokeOpen.value = true
}

async function confirmRevoke() {
  const perm = revokeTarget
  revokeOpen.value = false
  if (!perm) return
  try {
    // perm_id 走 query string(共享包已封,见 users.ts 的注释)
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
    <!-- Vue2 :850-852 的三段式说明:前缀 + 成员名 + 后缀 -->
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
        <button class="set-btn" type="button" data-test="acc-perm-revoke" @click="askRevoke(perm)">
          🗑
        </button>
      </div>
      <!-- 🔧 plan C14:失败不再伪装成「未授权任何文件夹」 -->
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
