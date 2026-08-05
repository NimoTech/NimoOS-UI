// SP7-P7a-T15: useInfiniteScroll —— 无限滚动 sentinel 的 IntersectionObserver 封装。
// 逐条对应 task-15-brief.md「必含测试清单」A 段 + 结构规格 A.1-A.3。
//
// 照搬 Vue2 PhotosSearchView.vue :706-721(observeLoadMoreSentinel/teardownLoadMoreObserver)
// 的语义,做成通用 composable:teardown 先断开;enabled 为假或 target/root 为空只 teardown;
// 否则 new IntersectionObserver(cb, { root, rootMargin }) + observe(target)。
//
// Vue2 :607-610 用 `watch(showLoadMoreSentinel) { if (show) this.$nextTick(() =>
// observe()) else teardown() }`——即"值变化后,等一帧再挂"。这里用 Vue3 的
// `watch([enabled, target], sync, { flush: 'post' })` 做等价手法:flush:'post' 保证
// 回调在 DOM/ref 更新之后运行,等价于 Vue2 的 $nextTick。
//
// jsdom 没有 IntersectionObserver,下面自己 stub 一个:记录每个实例的构造参数、
// observe/disconnect 调用次数,并暴露一个手动触发回调的钩子(entries[0].isIntersecting)。
// stub 挂在 globalThis.IntersectionObserver,afterEach 里删除以免渗漏到别的测试文件
// (P7a 全期教训:IO/ResizeObserver 类全局 stub 不复原会影响同批跑的其他测试)。
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

// 挂一个最小宿主组件跑 useInfiniteScroll,好让 onUnmounted 有真实组件实例可挂
// (直接在裸 setup 函数外调用会因为没有 active instance 而静默跳过 onUnmounted)。
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
  it('enabled=true 且 target/root 都有值 → observe 被调一次,构造参数含 { root, rootMargin }', async () => {
    const target = document.createElement('div')
    const root = document.createElement('div')
    mountHost({ enabled: ref(true), target: ref(target), root: ref(root), onHit: () => {} })
    await nextTick()
    expect(instances).toHaveLength(1)
    expect(instances[0].observeCalls).toBe(1)
    expect(instances[0].ctorArgs[1]).toEqual({ root, rootMargin: '200px 0px' })
  })

  it('手动触发 isIntersecting:true → onHit 被调', async () => {
    const target = document.createElement('div')
    const root = document.createElement('div')
    let hits = 0
    mountHost({ enabled: ref(true), target: ref(target), root: ref(root), onHit: () => { hits++ } })
    await nextTick()
    instances[0].cb([{ isIntersecting: true }])
    expect(hits).toBe(1)
  })

  it('手动触发 isIntersecting:false → onHit 不被调', async () => {
    const target = document.createElement('div')
    const root = document.createElement('div')
    let hits = 0
    mountHost({ enabled: ref(true), target: ref(target), root: ref(root), onHit: () => { hits++ } })
    await nextTick()
    instances[0].cb([{ isIntersecting: false }])
    expect(hits).toBe(0)
  })

  it('enabled 变假 → disconnect 被调、observe 不再新增', async () => {
    const target = document.createElement('div')
    const root = document.createElement('div')
    const enabled = ref(true)
    mountHost({ enabled, target: ref(target), root: ref(root), onHit: () => {} })
    await nextTick()
    expect(observeTotal).toBe(1)
    enabled.value = false
    await nextTick()
    expect(disconnectTotal).toBe(1)
    expect(observeTotal).toBe(1) // 没有新增 observe
  })

  it('target 从 null 变有值 → 才 observe(首帧 target 为 null 的场景)', async () => {
    const root = document.createElement('div')
    const target = ref<HTMLElement | null>(null)
    mountHost({ enabled: ref(true), target, root: ref(root), onHit: () => {} })
    await nextTick()
    expect(observeTotal).toBe(0)
    target.value = document.createElement('div')
    await nextTick()
    expect(observeTotal).toBe(1)
  })

  it('enabled 反复 true/false/true → 每次重挂前都 disconnect(observe 与 disconnect 调用次数配平,无泄漏)', async () => {
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
    // 每次挂起前都先 teardown 一次:true→observe(1) / false→disconnect(1)+挂起前teardown(no-op)
    // / true→disconnect(no-op,已断开)+observe(1) / false→disconnect(1)
    // 用总量配平表达"无泄漏":每一次真正 observe 过的实例,最终都被 disconnect 过。
    const observedInstances = instances.filter((i) => i.observeCalls > 0)
    for (const inst of observedInstances) {
      expect(inst.disconnectCalls).toBeGreaterThanOrEqual(1)
    }
    expect(observeTotal).toBe(2) // 两次 true
    expect(disconnectTotal).toBeGreaterThanOrEqual(2) // 至少两次真正断开(两次 false)
  })

  it('组件卸载 → disconnect 被调', async () => {
    const target = document.createElement('div')
    const root = document.createElement('div')
    const w = mountHost({ enabled: ref(true), target: ref(target), root: ref(root), onHit: () => {} })
    await nextTick()
    expect(observeTotal).toBe(1)
    w.unmount()
    expect(disconnectTotal).toBe(1)
  })

  it('rootMargin 可覆写', async () => {
    const target = document.createElement('div')
    const root = document.createElement('div')
    mountHost({ enabled: ref(true), target: ref(target), root: ref(root), onHit: () => {}, rootMargin: '50px 0px' })
    await nextTick()
    expect(instances[0].ctorArgs[1]).toEqual({ root, rootMargin: '50px 0px' })
  })
})
