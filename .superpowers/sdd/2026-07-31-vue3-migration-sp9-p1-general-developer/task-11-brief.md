## Task 11: DeveloperPanel —— HTTPS 开关 + 配置弹窗

**Files:**
- Create: `src/settings/components/WebUiHttpsDialog.vue`
- Create: `src/settings/components/WebUiHttpsDialog.test.ts`
- Modify: `src/settings/panels/DeveloperPanel.vue`
- Create: `src/settings/panels/DeveloperPanel.test.ts`

**Interfaces:**
- Consumes: `service.sys.getSSLConfig()` / `setSSLConfig(cfg)` / `uploadSSLCert(FormData)`、Task 3 原语、`Dialog.vue`、`useToast()`
- Produces:
  ```
  <WebUiHttpsDialog :open @update:open @saved />
  ```
  纯函数(放在同文件或 `src/settings/util/sslDate.ts`):
  ```ts
  export function formatSslDate(iso: string | undefined): string   // '0001-…' / 空 / 非法 → '---',否则 DD/MM/YYYY
  ```

- [ ] **Step 1: 写失败测试**

`src/settings/components/WebUiHttpsDialog.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'

// curl 实证 2026-07-31 GET /v1/gateway/ssl
const SSL = {
  enabled: false, port: '443', domain: 'nimoos.local', cert_type: 'auto',
  effective_time: '0001-01-01T00:00:00Z', expiration_time: '0001-01-01T00:00:00Z',
}
const state = { ssl: { ...SSL }, setCalls: [] as unknown[], uploadCalls: 0, setFail: false, uploadFail: false }

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      getSSLConfig: async () => ({ ...state.ssl }),
      setSSLConfig: async (c: unknown) => { state.setCalls.push(c); if (state.setFail) throw new Error('boom') },
      uploadSSLCert: async () => { state.uploadCalls++; if (state.uploadFail) throw new Error('boom') },
    },
  },
}))

import WebUiHttpsDialog from './WebUiHttpsDialog.vue'
import { formatSslDate } from '../util/sslDate'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const mountIt = (open = true) => mount(WebUiHttpsDialog, { props: { open }, global: { plugins: [i18n] } })

// jsdom 里 <input type=file> 的 files 是只读的,用 defineProperty 塞进去再触发 change ——
// 走的是组件真实的 @change 处理器,不必在生产组件上开测试后门。
async function pickFiles(w: ReturnType<typeof mountIt>, pem: File | null, crt: File | null) {
  const inputs = w.findAll('.wh-file')
  const set = async (i: number, f: File) => {
    Object.defineProperty(inputs[i].element, 'files', { value: [f], configurable: true })
    await inputs[i].trigger('change')
  }
  if (pem) await set(0, pem)
  if (crt) await set(1, crt)
}

beforeEach(() => {
  setActivePinia(createPinia())
  state.ssl = { ...SSL }; state.setCalls = []; state.uploadCalls = 0
  state.setFail = false; state.uploadFail = false
})

describe('formatSslDate', () => {
  it('Go 零值时间 → ---(实测本机就是 0001-01-01)', () => {
    expect(formatSslDate('0001-01-01T00:00:00Z')).toBe('---')
  })
  it('空 / undefined → ---', () => {
    expect(formatSslDate('')).toBe('---')
    expect(formatSslDate(undefined)).toBe('---')
  })
  it('非法日期 → ---(Vue2 用 try/catch 但 new Date 不抛,会输出 NaN/NaN/NaN —— 不照抄)', () => {
    expect(formatSslDate('不是日期')).toBe('---')
  })
  it('正常日期 → DD/MM/YYYY(对位 Vue2 formatDate)', () => {
    expect(formatSslDate('2027-03-09T10:00:00Z')).toMatch(/^\d{2}\/\d{2}\/2027$/)
  })
})

describe('WebUiHttpsDialog', () => {
  it('打开时拉配置并填入表单', async () => {
    const w = mountIt(); await flushPromises()
    expect((w.find('.wh-domain').element as HTMLInputElement).value).toBe('nimoos.local')
    expect((w.find('.wh-port').element as HTMLInputElement).value).toBe('443')
  })

  it('open=false 不拉配置', async () => {
    const svc = await import('@nimotech/nimoos-service')
    const spy = vi.spyOn(svc.service.sys, 'getSSLConfig')
    mountIt(false); await flushPromises()
    expect(spy).not.toHaveBeenCalled()
  })

  it('零值时间显示 ---', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.findAll('.wh-date').map((e) => e.text())).toEqual(['---', '---'])
  })

  it('cert_type=auto 时显示「下载 CA 证书」,不显示上传位', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.find('.wh-ca').exists()).toBe(true)
    expect(w.find('.wh-upload').exists()).toBe(false)
  })

  it('切到 custom 显示上传位,隐藏 CA 下载', async () => {
    const w = mountIt(); await flushPromises()
    await w.find('.wh-cert').setValue('custom')
    expect(w.find('.wh-upload').exists()).toBe(true)
    expect(w.find('.wh-ca').exists()).toBe(false)
  })

  it('auto 保存:只下发 4 个字段,不回传只读时间', async () => {
    const w = mountIt(); await flushPromises()
    await w.find('.wh-save').trigger('click'); await flushPromises()
    expect(state.setCalls).toEqual([{ enabled: false, domain: 'nimoos.local', port: '443', cert_type: 'auto' }])
    expect(state.uploadCalls).toBe(0)
  })

  it('保存成功后 emit saved 并关窗', async () => {
    const w = mountIt(); await flushPromises()
    await w.find('.wh-save').trigger('click'); await flushPromises()
    expect(w.emitted('saved')).toBeTruthy()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('保存配置失败不关窗(让用户能改了再试)', async () => {
    state.setFail = true
    const w = mountIt(); await flushPromises()
    await w.find('.wh-save').trigger('click'); await flushPromises()
    expect(w.emitted('update:open')).toBeFalsy()
  })

  it('custom 但只选了一个文件:提示要两个,不发上传也不发保存', async () => {
    const w = mountIt(); await flushPromises()
    await w.find('.wh-cert').setValue('custom')
    await pickFiles(w, new File(['x'], 'a.pem'), null)
    await w.find('.wh-save').trigger('click'); await flushPromises()
    expect(state.uploadCalls).toBe(0)
    expect(state.setCalls).toEqual([])
    expect(w.text()).toContain('请同时上传')
  })

  it('custom 且两个文件都选了:先上传再保存', async () => {
    const w = mountIt(); await flushPromises()
    await w.find('.wh-cert').setValue('custom')
    await pickFiles(w, new File(['x'], 'a.pem'), new File(['y'], 'b.crt'))
    await w.find('.wh-save').trigger('click'); await flushPromises()
    expect(state.uploadCalls).toBe(1)
    expect(state.setCalls).toHaveLength(1)
  })

  it('上传失败就不再保存配置(避免配置说 custom 而证书没上去)', async () => {
    state.uploadFail = true
    const w = mountIt(); await flushPromises()
    await w.find('.wh-cert').setValue('custom')
    await pickFiles(w, new File(['x'], 'a.pem'), new File(['y'], 'b.crt'))
    await w.find('.wh-save').trigger('click'); await flushPromises()
    expect(state.setCalls).toEqual([])
  })

  it('custom 但一个文件都没选:直接保存(沿用服务端已有证书)', async () => {
    state.ssl = { ...SSL, cert_type: 'custom' }
    const w = mountIt(); await flushPromises()
    await w.find('.wh-save').trigger('click'); await flushPromises()
    expect(state.uploadCalls).toBe(0)
    expect(state.setCalls).toHaveLength(1)
  })
})
```

`src/settings/panels/DeveloperPanel.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'

const state = { ssl: { enabled: false, port: '443', domain: 'nimoos.local', cert_type: 'auto', effective_time: '', expiration_time: '' }, setCalls: [] as unknown[], setFail: false }
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      getSSLConfig: async () => ({ ...state.ssl }),
      setSSLConfig: async (c: unknown) => { state.setCalls.push(c); if (state.setFail) throw new Error('boom') },
      uploadSSLCert: async () => {},
    },
  },
}))

import DeveloperPanel from './DeveloperPanel.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const mountIt = () => mount(DeveloperPanel, { global: { plugins: [i18n] } })

beforeEach(() => {
  setActivePinia(createPinia())
  state.ssl = { ...state.ssl, enabled: false, cert_type: 'auto' }
  state.setCalls = []; state.setFail = false
})

describe('DeveloperPanel', () => {
  it('用返回按钮而不是标题,点它 emit open-tab general(P0 行为不变)', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.find('.set-section-title').exists()).toBe(false)
    await w.find('.set-back').trigger('click')
    expect(w.emitted('open-tab')).toEqual([['general']])
  })

  it('P0 的空态占位已拆掉', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(false)
  })

  it('渲染 HTTPS 开关,状态来自服务端', async () => {
    state.ssl.enabled = true
    const w = mountIt(); await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('关闭时不显示配置入口行(对位 Vue2 v-if="sslEnabled")', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.find('.dp-config').exists()).toBe(false)
  })

  it('开启时显示配置入口行', async () => {
    state.ssl.enabled = true
    const w = mountIt(); await flushPromises()
    expect(w.find('.dp-config').exists()).toBe(true)
  })

  it('拨开 HTTPS:下发 enabled:true 并补齐 domain/port/cert_type 兜底值', async () => {
    const w = mountIt(); await flushPromises()
    await w.find('[role="switch"]').trigger('click'); await flushPromises()
    expect(state.setCalls).toEqual([{ enabled: true, domain: 'nimoos.local', port: '443', cert_type: 'auto' }])
  })

  it('服务端字段为空时用 Vue2 的兜底值(nimoos.local / 443 / auto)', async () => {
    state.ssl = { ...state.ssl, domain: '', port: '', cert_type: '' }
    const w = mountIt(); await flushPromises()
    await w.find('[role="switch"]').trigger('click'); await flushPromises()
    expect(state.setCalls[0]).toEqual({ enabled: true, domain: 'nimoos.local', port: '443', cert_type: 'auto' })
  })

  it('下发失败时开关弹回(对位 Vue2 sslEnabled = !val)', async () => {
    state.setFail = true
    const w = mountIt(); await flushPromises()
    await w.find('[role="switch"]').trigger('click'); await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
  })

  it('点配置入口打开弹窗', async () => {
    state.ssl.enabled = true
    const w = mountIt(); await flushPromises()
    await w.find('.dp-config').trigger('click')
    expect(w.findComponent({ name: 'WebUiHttpsDialog' }).props('open')).toBe(true)
  })

  it('弹窗 saved 后重新拉配置(对位 Vue2 modal close → getSSLConfig)', async () => {
    state.ssl.enabled = true
    const svc = await import('@nimotech/nimoos-service')
    const spy = vi.spyOn(svc.service.sys, 'getSSLConfig')
    const w = mountIt(); await flushPromises()
    const before = spy.mock.calls.length
    w.findComponent({ name: 'WebUiHttpsDialog' }).vm.$emit('saved')
    await flushPromises()
    expect(spy.mock.calls.length).toBeGreaterThan(before)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm test src/settings/components/WebUiHttpsDialog.test.ts src/settings/panels/DeveloperPanel.test.ts 2>&1 | tail -12
```

- [ ] **Step 3: 实现 `src/settings/util/sslDate.ts`**

```ts
/**
 * 对位 Vue2 WebUIHTTPSModal.vue 的 formatDate + formattedEffectiveTime/formattedExpirationTime。
 * 实测本机两个时间都是 Go 的零值 '0001-01-01T00:00:00Z'(未签发证书),必须显示 '---'。
 *
 * 移植纪律:Vue2 的 formatDate 用 try/catch 兜底,但 `new Date('乱码')` **不抛异常** ——
 * 它返回 Invalid Date,于是 getDate() 全是 NaN,界面会显示 "NaN/NaN/NaN"。
 * 这里显式判 Number.isNaN。
 */
export function formatSslDate(iso: string | undefined): string {
  if (!iso || iso.startsWith('0001')) return '---'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '---'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getFullYear()}`
}
```

- [ ] **Step 4: 实现 `WebUiHttpsDialog.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 WebUIHTTPSModal.vue(334 行)。6 行:主域名 / 生效时间 / 过期时间 / 端口 /
// SSL 证书类型 /(auto 时)信任证书下载 或(custom 时)PEM+CRT 上传位。
// 保存顺序照 Vue2:custom 且选了文件 → 先上传证书,成功后才保存配置。
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type SSLConfig } from '@nimotech/nimoos-service'
import Dialog from '../../components/ui/Dialog.vue'
import { formatSslDate } from '../util/sslDate'
import { useToast } from '../../stores/toast'
import '../styles/settings.css'

defineOptions({ name: 'WebUiHttpsDialog' })
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean]; saved: [] }>()

const { t } = useI18n()
const toast = useToast()

const cfg = ref<SSLConfig>({
  enabled: true, domain: 'nimoos.local', port: '443', cert_type: 'auto',
  effective_time: '', expiration_time: '',
})
const pemFile = ref<File | null>(null)
const crtFile = ref<File | null>(null)
const saving = ref(false)
const error = ref('')

watch(() => props.open, async (o) => {
  if (!o) return
  error.value = ''
  pemFile.value = null
  crtFile.value = null
  try {
    cfg.value = await service.sys.getSSLConfig()
  } catch (e) {
    console.warn('[settings] getSSLConfig failed', e)
  }
}, { immediate: true })

function onPick(which: 'pem' | 'crt', e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  if (which === 'pem') pemFile.value = f
  else crtFile.value = f
}

async function save() {
  error.value = ''
  saving.value = true
  try {
    if (cfg.value.cert_type === 'custom' && (pemFile.value || crtFile.value)) {
      // 只选一个不行:后端要成对的 pem + crt
      if (!pemFile.value || !crtFile.value) {
        error.value = t('settingsHttpsBothFiles')
        return
      }
      const fd = new FormData()
      fd.append('pem', pemFile.value)
      fd.append('crt', crtFile.value)
      try {
        await service.sys.uploadSSLCert(fd)
      } catch (e) {
        // 上传失败就不要再保存配置 —— 否则配置说 custom 而证书根本没上去
        console.warn('[settings] uploadSSLCert failed', e)
        error.value = t('settingsHttpsUploadFailed')
        return
      }
    }
    // 只下发这 4 个字段:effective_time / expiration_time 是后端只读产出
    await service.sys.setSSLConfig({
      enabled: cfg.value.enabled,
      domain: cfg.value.domain,
      port: String(cfg.value.port),
      cert_type: cfg.value.cert_type,
    })
    toast.show(t('settingsSaveSuccess'))
    emit('saved')
    emit('update:open', false)
  } catch (e) {
    console.warn('[settings] setSSLConfig failed', e)
    error.value = t('settingsSaveFailed')   // 不关窗,让用户改了再试
  } finally {
    saving.value = false
  }
}

function downloadCa() {
  window.open('/v1/gateway/ssl/ca', '_blank')
}
</script>

<template>
  <Dialog :open="open" :title="t('settingsHttpsTitle')" @update:open="emit('update:open', $event)">
    <div class="wh-body">
      <label class="wh-row">
        <span class="wh-key">{{ t('settingsHttpsDomain') }}</span>
        <input v-model="cfg.domain" class="set-input wh-domain" type="text" :disabled="saving" />
      </label>

      <div class="wh-row">
        <span class="wh-key">{{ t('settingsHttpsEffective') }}</span>
        <span class="wh-date">{{ formatSslDate(cfg.effective_time) }}</span>
      </div>
      <div class="wh-row">
        <span class="wh-key">{{ t('settingsHttpsExpiration') }}</span>
        <span class="wh-date">{{ formatSslDate(cfg.expiration_time) }}</span>
      </div>

      <label class="wh-row">
        <span class="wh-key">{{ t('settingsHttpsPort') }}</span>
        <input v-model="cfg.port" class="set-input wh-port" type="text" inputmode="numeric" :disabled="saving" />
      </label>

      <label class="wh-row">
        <span class="wh-key">{{ t('settingsHttpsCert') }}</span>
        <select v-model="cfg.cert_type" class="set-select wh-cert" :disabled="saving">
          <option value="auto">{{ t('settingsHttpsCertAuto') }}</option>
          <option value="custom">{{ t('settingsHttpsCertCustom') }}</option>
        </select>
      </label>

      <div v-if="cfg.cert_type === 'auto'" class="wh-row">
        <span class="wh-key">{{ t('settingsHttpsTrust') }}</span>
        <button class="set-btn wh-ca" type="button" @click="downloadCa">
          {{ t('settingsHttpsDownloadCa') }}
        </button>
      </div>

      <div v-else class="wh-row wh-upload">
        <span class="wh-key">{{ t('settingsHttpsCertFiles') }}</span>
        <span class="wh-files">
          <label class="set-btn">
            PEM
            <input type="file" class="wh-file" :disabled="saving" @change="onPick('pem', $event)" />
          </label>
          <label class="set-btn">
            CRT
            <input type="file" class="wh-file" :disabled="saving" @change="onPick('crt', $event)" />
          </label>
        </span>
      </div>

      <p v-if="pemFile || crtFile" class="wh-picked">
        <span v-if="pemFile">PEM: {{ pemFile.name }}</span>
        <span v-if="crtFile">CRT: {{ crtFile.name }}</span>
      </p>
      <p v-if="error" class="set-danger">{{ error }}</p>
    </div>

    <template #footer>
      <button class="set-btn primary wh-save" type="button" :disabled="saving" @click="save">
        {{ t('settingsSave') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.wh-body { display: flex; flex-direction: column; gap: 4px; min-width: min(480px, 84vw); }
.wh-row {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 12px 0; border-bottom: 1px solid var(--border); font-size: 14px;
}
.wh-row:last-of-type { border-bottom: 0; }
.wh-key { color: var(--fg-muted); flex: 0 0 auto; }
.wh-date { font-weight: 500; }
.wh-files { display: flex; gap: 8px; }
.wh-file { display: none; }
.wh-picked {
  display: flex; flex-direction: column; gap: 2px; margin: 4px 0 0;
  font-size: 12px; color: var(--fg-muted); text-align: right;
}
</style>
```

- [ ] **Step 5: 实现 `DeveloperPanel.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L326-348(developer 分支)+ getSSLConfig / toggleHTTPS。
// 头部用返回按钮而不是 h1(Vue2 L52-56),P0 已经这么做了,保持不变。
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type SSLConfig } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import SettingsRow from '../components/SettingsRow.vue'
import SettingsSwitch from '../components/SettingsSwitch.vue'
import WebUiHttpsDialog from '../components/WebUiHttpsDialog.vue'
import { useToast } from '../../stores/toast'
import '../styles/settings.css'

const { t } = useI18n()
const toast = useToast()
const emit = defineEmits<{ 'open-tab': [tab: string] }>()

const cfg = ref<SSLConfig | null>(null)
const enabled = ref(false)
const busy = ref(false)
const dialogOpen = ref(false)

async function load() {
  try {
    const c = await service.sys.getSSLConfig()
    cfg.value = c
    enabled.value = c.enabled
  } catch (e) {
    console.warn('[settings] getSSLConfig failed', e)
  }
}
onMounted(load)

async function toggle(next: boolean) {
  if (busy.value) return
  const prev = enabled.value
  enabled.value = next
  busy.value = true
  try {
    // 兜底值逐字照 Vue2 toggleHTTPS(L1324-1330):域名 nimoos.local、端口 443、证书 auto
    await service.sys.setSSLConfig({
      enabled: next,
      domain: cfg.value?.domain || 'nimoos.local',
      port: String(cfg.value?.port || '443'),
      cert_type: cfg.value?.cert_type || 'auto',
    })
    toast.show(t('settingsSaveSuccess'))
  } catch (e) {
    enabled.value = prev            // 对位 Vue2 sslEnabled = !val
    console.warn('[settings] setSSLConfig failed', e)
    toast.show(t('settingsSaveFailed'))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <SettingsSection
    :title="t('settingsTabDeveloper')"
    back-to="general"
    @back="emit('open-tab', $event)"
  >
    <div class="set-list">
      <SettingsRow :label="t('settingsHttps')">
        <template #control>
          <SettingsSwitch
            :model-value="enabled"
            :label="t('settingsHttps')"
            :disabled="busy"
            @update:model-value="toggle"
          />
        </template>
      </SettingsRow>

      <!-- 只在 HTTPS 开启后才出现(对位 Vue2 v-if="sslEnabled") -->
      <SettingsRow
        v-if="enabled"
        class="dp-config"
        :label="t('settingsHttpsConfig')"
        clickable
        @click="dialogOpen = true"
      />
    </div>

    <WebUiHttpsDialog
      :open="dialogOpen"
      @update:open="dialogOpen = $event"
      @saved="load"
    />
  </SettingsSection>
</template>
```

> `.dp-config` 作为 class 传给 `SettingsRow` 会落在其根元素(`.set-row-wrap`)上,而测试里 `w.find('.dp-config').trigger('click')` 点的是根 div、不是内部的 `<button>`。**实现时确认**:要么测试改成 `.dp-config .set-list-item`,要么给 `SettingsRow` 的可点 `button` 加一个可传入的 class。**取前者**,不动共用原语。

- [ ] **Step 6: 跑测试确认通过 + 任务门 + 提交**

```bash
pnpm test src/settings 2>&1 | tail -8
pnpm test 2>&1 | tail -8
pnpm exec vue-tsc --noEmit
git status --short
git add src/settings/util/sslDate.ts src/settings/components/WebUiHttpsDialog.vue \
        src/settings/components/WebUiHttpsDialog.test.ts src/settings/panels/DeveloperPanel.test.ts
git commit src/settings/util/sslDate.ts src/settings/components/WebUiHttpsDialog.vue \
           src/settings/components/WebUiHttpsDialog.test.ts \
           src/settings/panels/DeveloperPanel.vue src/settings/panels/DeveloperPanel.test.ts \
  -m "feat(settings): developer 页 HTTPS 开关 + 配置弹窗(SP9-P1)

- 开关下发失败弹回;配置入口只在 HTTPS 开启后出现(对位 Vue2 v-if)
- custom 证书:先上传成对的 PEM+CRT,上传失败就不保存配置
  (否则配置写着 custom 而证书没上去)
- 只下发 4 个字段,effective_time/expiration_time 是后端只读产出
- formatSslDate 显式判 Invalid Date:Vue2 的 try/catch 拦不住
  new Date('乱码')(它不抛,只是返回 NaN 日期),会显示 NaN/NaN/NaN"
```

---

