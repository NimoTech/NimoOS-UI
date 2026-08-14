import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import SkModal from './SkModal.vue'

// reka's Portal target defaults to '.set-app' (settings page root element). Manually create one in tests,
// also prove "content actually lands in this container, not directly under document.body" — this is exactly
// what D1 prevents: token scope escape.
function withHost() {
  const host = document.createElement('div')
  host.className = 'set-app'
  document.body.appendChild(host)
  return host
}

describe('SkModal', () => {
  let host: HTMLElement
  beforeEach(() => { host = withHost() })
  afterEach(() => { document.body.innerHTML = '' })

  it('when open=false, render nothing inside modal', async () => {
    mount(SkModal, { props: { open: false, title: 'Title' }, attachTo: document.body })
    await nextTick()
    expect(host.querySelector('.sk-modal')).toBeNull()
  })

  it('when open=true, render content in .set-app container (not directly under body)', async () => {
    mount(SkModal, {
      props: { open: true, title: 'Token Created' },
      slots: { default: '<p class="probe">Body text</p>' },
      attachTo: document.body,
    })
    await nextTick()
    const modal = host.querySelector('.sk-modal')
    expect(modal).not.toBeNull()
    expect(host.querySelector('.sk-modal-title')?.textContent).toBe('Token Created')
    expect(host.querySelector('.sk-modal-body .probe')?.textContent).toBe('Body text')
    // critical assertion: modal node must have .set-app in ancestor chain, or all AI section tokens fail
    expect(modal!.closest('.set-app')).toBe(host)
  })

  it('footer slot renders in .right of .sk-modal-foot', async () => {
    mount(SkModal, {
      props: { open: true, title: 't' },
      slots: { footer: '<button class="fbtn">Done</button>' },
      attachTo: document.body,
    })
    await nextTick()
    expect(host.querySelector('.sk-modal-foot .right .fbtn')?.textContent).toBe('Done')
  })

  it('when footer slot absent, don\'t render footer (Vue2 token modal has footer, pairing code same structure, robot form also has; keep slot optional)', async () => {
    mount(SkModal, { props: { open: true, title: 't' }, attachTo: document.body })
    await nextTick()
    expect(host.querySelector('.sk-modal-foot')).toBeNull()
  })

  it('clicking close button emits update:open=false', async () => {
    const w = mount(SkModal, { props: { open: true, title: 't' }, attachTo: document.body })
    await nextTick()
    const x = host.querySelector('.sk-x') as HTMLElement
    expect(x).not.toBeNull()
    x.click()
    await nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  // SP8-P3b Task 5 — footerLeft slot (consumed by AddSkillModal: left "save locally on this NAS"
  // explanation, right cancel/create buttons), pure incremental, don't change any existing assertions above.
  it('footerLeft slot renders as preceding sibling of .right (both columns coexist)', async () => {
    mount(SkModal, {
      props: { open: true, title: 't' },
      slots: {
        footerLeft: '<span class="save-note-probe">Save note</span>',
        footer: '<button class="fbtn2">Create</button>',
      },
      attachTo: document.body,
    })
    await nextTick()
    const foot = host.querySelector('.sk-modal-foot') as HTMLElement
    expect(foot).not.toBeNull()
    const left = foot.querySelector('.save-note-probe')
    const right = foot.querySelector('.right .fbtn2')
    expect(left).not.toBeNull()
    expect(right).not.toBeNull()
    // left column must precede .right in DOM order (visually on its left, not nested inside .right)
    expect(left!.compareDocumentPosition(right!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(right!.closest('.right')).not.toBeNull()
    expect(left!.closest('.right')).toBeNull()
  })

  it('footerLeft only, no footer, still render .sk-modal-foot (logic must be self-consistent, no consumer yet does this)', async () => {
    mount(SkModal, {
      props: { open: true, title: 't' },
      slots: { footerLeft: '<span class="only-left-probe">Left only</span>' },
      attachTo: document.body,
    })
    await nextTick()
    expect(host.querySelector('.sk-modal-foot')).not.toBeNull()
    expect(host.querySelector('.only-left-probe')).not.toBeNull()
  })

  it('portalTo can override (leave opening for non-settings-page reuse)', async () => {
    const other = document.createElement('div')
    other.id = 'other-host'
    document.body.appendChild(other)
    mount(SkModal, { props: { open: true, title: 't', portalTo: '#other-host' }, attachTo: document.body })
    await nextTick()
    expect(other.querySelector('.sk-modal')).not.toBeNull()
    expect(host.querySelector('.sk-modal')).toBeNull()
  })
})
