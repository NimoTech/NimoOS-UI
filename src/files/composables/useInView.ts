import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'

// 一次性进入视口检测:元素进入视口即置 true 并停止观察。
// 环境无 IntersectionObserver(如 jsdom)时降级为立即可见。
export function useInView(el: Ref<HTMLElement | null>): Ref<boolean> {
  const inView = ref(false)
  let observer: IntersectionObserver | null = null
  onMounted(() => {
    if (inView.value) return
    if (typeof IntersectionObserver === 'undefined') { inView.value = true; return }
    observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        inView.value = true
        observer?.disconnect()
        observer = null
      }
    })
    if (el.value) observer.observe(el.value)
  })
  onBeforeUnmount(() => { observer?.disconnect(); observer = null })
  return inView
}
