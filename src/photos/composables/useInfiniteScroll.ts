// SP7-P7a-T15: useInfiniteScroll —— 无限滚动 sentinel 的 IntersectionObserver 封装。
// Ported from Vue2 NimoOS-UI src/views/Photos/PhotosSearchView.vue:
//   :706-721 (observeLoadMoreSentinel/teardownLoadMoreObserver)
//   :607-610 (showLoadMoreSentinel watcher,决定何时挂/摘观察器)
//
// 语义 1:1 照搬——teardown() 先断开旧观察器;enabled 为假、或 target/root 任一为空,
// 只做 teardown;否则新建 IntersectionObserver(root/rootMargin 可配)并 observe(target)。
//
// Vue2 :607-610 是 `watch(showLoadMoreSentinel) { if (show) this.$nextTick(() =>
// this.observeLoadMoreSentinel()) else this.teardownLoadMoreObserver() }`——值变化后,
// 等一帧(下一次 DOM 更新之后)再挂,好让 v-if 刚渲染出来的 sentinel DOM 节点已经存在。
// Vue3 里 `watch(sources, cb, { flush: 'post' })` 是这个"等一帧再跑"的等价手法(回调
// 会在本次响应式更新触发的 DOM 更新完成之后运行),这里用它代替 $nextTick,注释登记
// 这个映射关系。
//
// 额外加了 `immediate: true`(Vue2 原 watcher 没有):Vue2 的 showLoadMoreSentinel 恒
// 从 false 起步(依赖 moreExpanded,初始必为 false),"挂观察器"永远发生在一次真实的
// false→true 变化里,天然不需要 immediate。但本 composable 是通用件,不能假设调用方
// 传入的 enabled/target 初始状态——若调用时两者已经就绪(测试即是这种用法),不给
// immediate 会导致 sync() 从未运行、observe 永远不会被调用。加 immediate 不改变
// Vue2 的实际可观察行为(真实宿主 PhotosSearchGrid.vue 里 showSentinel 同样从 false
// 起步,首次运行只会命中"只 teardown"分支,是无副作用的空转)。
import { onUnmounted, watch, type Ref } from 'vue'

export interface UseInfiniteScrollOptions {
  target: Ref<HTMLElement | null>
  root: Ref<HTMLElement | null>
  enabled: Ref<boolean>
  onHit: () => void
  rootMargin?: string
}

export function useInfiniteScroll(opts: UseInfiniteScrollOptions): void {
  let io: IntersectionObserver | null = null

  function teardown(): void {
    if (io) {
      io.disconnect()
      io = null
    }
  }

  function sync(): void {
    teardown()
    if (!opts.enabled.value) return
    const target = opts.target.value
    const root = opts.root.value
    if (!target || !root) return
    io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) opts.onHit()
      },
      { root, rootMargin: opts.rootMargin ?? '200px 0px' },
    )
    io.observe(target)
  }

  watch([opts.enabled, opts.target], sync, { flush: 'post', immediate: true })

  onUnmounted(teardown)
}
