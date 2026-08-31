// useInfiniteScroll — IntersectionObserver wrapper for infinite scroll sentinel.
// Corresponds line-by-line to the required test checklist.
//
// Replicates Vue2 PhotosSearchView.vue :706-721 (observeLoadMoreSentinel/teardownLoadMoreObserver)
// semantics as a generic composable: teardown first; if enabled is false or target/root is empty,
// only teardown; otherwise new IntersectionObserver(cb, { root, rootMargin }) + observe(target).
//
// Vue2 :607-610 uses `watch(showLoadMoreSentinel) { if (show) this.$nextTick(() =>
// observe()) else teardown() }` — i.e., "after value changes, wait one frame then mount".
// Here we use Vue3's `watch([enabled, target], sync, { flush: 'post' })` for equivalent:
// flush:'post' ensures callback runs after DOM/ref updates, equivalent to Vue2's $nextTick.
//
// jsdom has no IntersectionObserver, so we stub one: record constructor params for each instance,
// observe/disconnect call counts, and expose a manual callback trigger hook (entries[0].isIntersecting).
// Stub on globalThis.IntersectionObserver, delete in afterEach to prevent leak to other test files
// (lesson learned before: global stubs of IO/ResizeObserver without restoration affect other tests in the same batch).
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useInfiniteScroll } from '../useInfiniteScroll'

interface FakeIOInstance {
  ctorArgs: [unknown, { root: unknown; rootMargin: string }]
  cb: (entries: { isIntersecting: boolean }[]) => void
  observeCalls: number
  disconnectCalls: number
}

let instances: FakeIOInstance[]
let observeTotal: number
let disconnectTotal: number

beforeEach(() => {
  instances = []
  observeTotal = 0
  disconnectTotal = 0
  ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
    inst: FakeIOInstance
    constructor(cb: (entries: { isIntersecting: boolean }[]) => void, options: { root: unknown; rootMargin: string }) {
      this.inst = { ctorArgs: [cb, options], cb, observeCalls: 0, disconnectCalls: 0 }
      instances.push(this.inst)
    }
    observe(_target: unknown) {
      this.inst.observeCalls++
      observeTotal++
    }
    disconnect() {
      this.inst.disconnectCalls++
      disconnectTotal++
    }
  }
})

afterEach(() => {
  delete (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver
})

// Mount a minimal host component to run useInfiniteScroll, so onUnmounted has a real component
// instance to attach to (calling directly outside a bare setup function silently skips onUnmounted
// due to no active instance).
function mountHost(opts: {
  enabled: Ref<boolean>
  target: Ref<HTMLElement | null>
  root: Ref<HTMLElement | null>
  onHit: () => void
  rootMargin?: string
}) {
  const Host = defineComponent({
    setup() {
      useInfiniteScroll(opts)
      return () => h('div')
    },
  })
  return mount(Host)
}

describe('useInfiniteScroll', () => {
  it('enabled=true and target/root both have values → observe called once, constructor params contain { root, rootMargin }', async () => {
    const target = document.createElement('div')
    const root = document.createElement('div')
    mountHost({ enabled: ref(true), target: ref(target), root: ref(root), onHit: () => {} })
    await nextTick()
    expect(instances).toHaveLength(1)
    expect(instances[0].observeCalls).toBe(1)
    expect(instances[0].ctorArgs[1]).toEqual({ root, rootMargin: '200px 0px' })
  })

  it('Manual trigger isIntersecting:true → onHit called', async () => {
    const target = document.createElement('div')
    const root = document.createElement('div')
    let hits = 0
    mountHost({ enabled: ref(true), target: ref(target), root: ref(root), onHit: () => { hits++ } })
    await nextTick()
    instances[0].cb([{ isIntersecting: true }])
    expect(hits).toBe(1)
  })

  it('Manual trigger isIntersecting:false → onHit not called', async () => {
    const target = document.createElement('div')
    const root = document.createElement('div')
    let hits = 0
    mountHost({ enabled: ref(true), target: ref(target), root: ref(root), onHit: () => { hits++ } })
    await nextTick()
    instances[0].cb([{ isIntersecting: false }])
    expect(hits).toBe(0)
  })

  it('enabled becomes false → disconnect called, observe no longer increments', async () => {
    const target = document.createElement('div')
    const root = document.createElement('div')
    const enabled = ref(true)
    mountHost({ enabled, target: ref(target), root: ref(root), onHit: () => {} })
    await nextTick()
    expect(observeTotal).toBe(1)
    enabled.value = false
    await nextTick()
    expect(disconnectTotal).toBe(1)
    expect(observeTotal).toBe(1) // no new observe
  })

  it('target from null to value → then observe (first frame target is null scenario)', async () => {
    const root = document.createElement('div')
    const target = ref<HTMLElement | null>(null)
    mountHost({ enabled: ref(true), target, root: ref(root), onHit: () => {} })
    await nextTick()
    expect(observeTotal).toBe(0)
    target.value = document.createElement('div')
    await nextTick()
    expect(observeTotal).toBe(1)
  })

  it('enabled alternates true/false/true → disconnect before each remount (observe and disconnect call counts balanced, no leak)', async () => {
    const target = document.createElement('div')
    const root = document.createElement('div')
    const enabled = ref(true)
    mountHost({ enabled, target: ref(target), root: ref(root), onHit: () => {} })
    await nextTick()
    enabled.value = false
    await nextTick()
    enabled.value = true
    await nextTick()
    enabled.value = false
    await nextTick()
    // Teardown once before each suspend: true→observe(1) / false→disconnect(1)+teardown-before-suspend(no-op)
    // / true→disconnect(no-op, already disconnected)+observe(1) / false→disconnect(1)
    // Express "no leak" using total balance: every instance that was observed is eventually disconnected.
    const observedInstances = instances.filter((i) => i.observeCalls > 0)
    for (const inst of observedInstances) {
      expect(inst.disconnectCalls).toBeGreaterThanOrEqual(1)
    }
    expect(observeTotal).toBe(2) // two true
    expect(disconnectTotal).toBeGreaterThanOrEqual(2) // at least two real disconnects (two false)
  })

  it('Component unmount → disconnect called', async () => {
    const target = document.createElement('div')
    const root = document.createElement('div')
    const w = mountHost({ enabled: ref(true), target: ref(target), root: ref(root), onHit: () => {} })
    await nextTick()
    expect(observeTotal).toBe(1)
    w.unmount()
    expect(disconnectTotal).toBe(1)
  })

  it('rootMargin is overridable', async () => {
    const target = document.createElement('div')
    const root = document.createElement('div')
    mountHost({ enabled: ref(true), target: ref(target), root: ref(root), onHit: () => {}, rootMargin: '50px 0px' })
    await nextTick()
    expect(instances[0].ctorArgs[1]).toEqual({ root, rootMargin: '50px 0px' })
  })
})
