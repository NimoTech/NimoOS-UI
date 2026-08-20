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
    // `service.sys` is a lazy getter that throws synchronously if initService()
    // hasn't run yet (e.g. a test mounting the clock without the service
    // package initialised). Reaching for it inside this .then() callback,
    // rather than calling it directly, turns that synchronous throw into a
    // rejection the .catch() below can see -- a throwing getter must be as
    // harmless to the badge as a failed HTTP request, never a crash.
    inFlight = Promise.resolve()
      .then(() => service.sys.getTimeZone())
      .then((tz) => { zone.value = tz || null })
      // An older backend has no such route, or the service isn't initialised
      // yet. Leaving the zone null hides the badge, which the spec prefers to
      // guessing from the browser -- and it also keeps inFlight settled, so a
      // synchronous throw doesn't leave every subsequent consumer retrying.
      //
      // The silence towards the user is deliberate; the silence towards whoever
      // is debugging is not. A missing badge has two innocent explanations -- the
      // clock's 2x2 and 1x2 variants never render one -- and this one broken
      // explanation, and nothing else distinguishes them.
      .catch((err) => {
        console.warn('[home] host timezone unavailable, clock offset badge hidden:', err)
        zone.value = null
      })
  }
  return { zone }
}
