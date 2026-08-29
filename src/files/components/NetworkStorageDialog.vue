<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import Dialog from '../../components/ui/Dialog.vue'
import { useToast } from '../../stores/toast'
import { useMountsStore } from '../stores/mounts'
import { parseAddress, readHosts, addHost, writeHosts, type SambaHost } from '../util/sambaHistory'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'connected', mountPoint: string): void }>()
const { t } = useI18n()
const toast = useToast()
const mounts = useMountsStore()

const GUEST = 'guest'
const address = ref('')
const isGuest = ref(true)
const username = ref('')
const password = ref('')
const connecting = ref(false)
const hosts = ref<SambaHost[]>([])

watch(() => props.open, (o) => {
  if (!o) return
  address.value = ''; isGuest.value = true; username.value = ''; password.value = ''; connecting.value = false
  hosts.value = readHosts()
})

// Can connect when address is valid (protocol/host); non-guest requires username/password
const canConnect = computed(() => {
  const { protocol, host } = parseAddress(address.value)
  if (!protocol || !host) return false
  if (!isGuest.value && (!username.value || !password.value)) return false
  return true
})

async function connect() {
  const { protocol, host } = parseAddress(address.value)
  if (!protocol || !host) { toast.show(t('filesMountInvalidAddress')); return }
  if (!isGuest.value && (!username.value || !password.value)) { toast.show(t('filesMountCredsRequired')); return }
  connecting.value = true
  try {
    const { mountPoint } = await service.samba.createConnection({
      host,
      username: isGuest.value ? GUEST : username.value,
      password: isGuest.value ? GUEST : password.value,
    })
    writeHosts(addHost(hosts.value, { host, guest: isGuest.value, username: username.value }))
    await mounts.loadMounts()
    emit('connected', mountPoint)
    emit('update:open', false)
  } catch (e) {
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
    toast.show(msg || t('filesMountConnectFailed'))
  } finally {
    connecting.value = false
  }
}
</script>

<template>
  <Dialog :open="open" :title="t('filesMountConnectNetwork')" @update:open="emit('update:open', $event)">
    <div class="net-form">
      <label class="net-label">{{ t('filesMountServerAddress') }}</label>
      <input
        class="ui-input"
        list="samba-hosts"
        :placeholder="'smb://192.168.1.1'"
        v-model="address"
        @keyup.enter="canConnect && connect()"
      />
      <datalist id="samba-hosts">
        <option v-for="h in hosts" :key="h.host" :value="'smb://' + h.host" />
      </datalist>
      <p class="net-hint">{{ t('filesMountAddressHint') }}</p>

      <label class="net-switch">
        <span>{{ t('filesMountConnectAsGuest') }}</span>
        <input type="checkbox" v-model="isGuest" />
      </label>

      <template v-if="!isGuest">
        <label class="net-label">{{ t('filesMountUsername') }}</label>
        <input class="ui-input" v-model="username" name="username" />
        <label class="net-label">{{ t('filesMountPassword') }}</label>
        <input class="ui-input" type="password" v-model="password" name="password" />
      </template>
    </div>
    <template #footer>
      <button class="ui-btn" @click="emit('update:open', false)">{{ t('filesCancel') }}</button>
      <button class="ui-btn primary" :disabled="!canConnect || connecting" @click="connect">
        {{ connecting ? t('filesMountConnecting') : t('filesMountConnect') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.net-form { display: flex; flex-direction: column; gap: 8px; }
.net-label { font-size: 13px; color: var(--fg-muted, #9aa4bf); }
.net-hint { font-size: 12px; color: var(--fg-muted, #9aa4bf); margin: 0; }
.net-switch { display: flex; align-items: center; justify-content: space-between; margin: 6px 0; font-size: 14px; }
.ui-input { width: 100%; box-sizing: border-box; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--chip-border, rgba(255,255,255,0.16)); background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); font-size: 14px; outline: none; }
.ui-input:focus { border-color: var(--accent, #6ea8fe); }
.ui-btn { padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border, rgba(255,255,255,0.14)); background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); cursor: pointer; font-size: 13px; }
.ui-btn.primary { background: color-mix(in srgb, var(--accent, #6ea8fe) 32%, transparent); border-color: var(--accent, #6ea8fe); }
.ui-btn:disabled { opacity: 0.4; cursor: default; }
</style>
