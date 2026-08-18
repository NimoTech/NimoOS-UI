import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'

// Module-level singleton, the same shape useDock.ts uses. The host's timezone
// cannot change without a reboot, so one fetch per page load is enough however
// many clock cards are on the desktop.
const zone = ref<string | null>(null)
let inFlight: Promise<void> | null = null

/** Reset singleton state — call in test beforeEach. */
export function __resetHostTimezoneForTest() {
  zone.value = null
  inFlight = null
}

export function useHostTimezone() {
  if (!inFlight) {
    inFlight = service.sys
      .getTimeZone()
      .then((tz) => { zone.value = tz || null })
      // An older backend has no such route. Leaving the zone null hides the
      // badge, which the spec prefers to guessing from the browser.
      .catch(() => { zone.value = null })
  }
  return { zone }
}
