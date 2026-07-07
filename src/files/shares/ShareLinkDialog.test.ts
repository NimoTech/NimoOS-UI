import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, DOMWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { i18n } from '../../i18n'
import ShareLinkDialog from './ShareLinkDialog.vue'

// reka-ui's Dialog teleports its content to <body>, outside the mounted
// wrapper's own DOM subtree (see src/components/ui/Dialog.test.ts and
// NewItemDialog.test.ts) — mount with attachTo: document.body, await one
// nextTick for the Portal content to land, then query document.body directly.
const body = () => new DOMWrapper(document.body)

beforeEach(() => setActivePinia(createPinia()))
afterEach(() => { document.body.innerHTML = '' })

describe('ShareLinkDialog', () => {
  it('open 时渲染 host+name 的 UNC/SMB 路径', async () => {
    Object.defineProperty(window, 'location', { value: { hostname: '10.0.0.5' }, writable: true })
    mount(ShareLinkDialog, {
      props: { open: true, name: 'Docs' },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })
    await nextTick()
    const html = body().html()
    expect(html).toContain('\\\\10.0.0.5\\Docs')
    expect(html).toContain('smb://10.0.0.5/Docs')
  })
})
