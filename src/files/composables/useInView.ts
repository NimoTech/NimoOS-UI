import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'

// One-time viewport detection: element enters viewport, sets true, and stops observing.
// Degrades to immediately visible when IntersectionObserver is unavailable (e.g., jsdom).
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
