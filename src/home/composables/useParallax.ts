/**
 * useParallax — sets --mx/--my CSS custom properties on document.documentElement
 * on pointermove, throttled via requestAnimationFrame.
 * Values are normalised to −0.5..0.5 (0 = centre of viewport).
 * No-op when prefers-reduced-motion: reduce is active.
 * Returns a stop() function that removes the listener and cancels pending rAF.
 */
export function useParallax(): { stop: () => void } {
  // Guard: reduced-motion check
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return { stop: () => {} }
  }

  let rafId: number | null = null
  let pendingX = 0
  let pendingY = 0

  function onPointerMove(e: MouseEvent): void {
    pendingX = e.clientX / window.innerWidth - 0.5
    pendingY = e.clientY / window.innerHeight - 0.5

    if (rafId !== null) return // already scheduled, coalesce

    rafId = requestAnimationFrame(() => {
      rafId = null
      document.documentElement.style.setProperty('--mx', String(pendingX))
      document.documentElement.style.setProperty('--my', String(pendingY))
    })
  }

  window.addEventListener('pointermove', onPointerMove as EventListener)

  function stop(): void {
    window.removeEventListener('pointermove', onPointerMove as EventListener)
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  return { stop }
}
