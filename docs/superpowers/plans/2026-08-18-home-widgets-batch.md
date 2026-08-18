# Home Widget Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a timezone badge to the clock widget, make dock icons draggable again with a visible insertion preview, make the storage ring show real data, fit the ring gauge text inside its hole, and stop the GPU card presenting absent readings as zeros.

**Architecture:** Five of the six tasks are self-contained Vue 3 SFC edits in `NimoOS-New-UI`. Task 1 is a small Go handler in the separate `NimoOS` repository that exposes an already-working service method over HTTP. Logic that jsdom cannot observe (drop-target geometry, offset formatting) is extracted into pure functions under `src/home/grid/` and `src/home/util/` so it is unit-testable, leaving the SFCs as thin DOM wrappers.

**Tech Stack:** Vue 3 + TypeScript + vitest + @vue/test-utils + pinia (New-UI, pnpm@9.0.6); Go + Echo v4 (NimoOS backend); headless Chromium for visual evidence.

**Spec:** `docs/superpowers/specs/2026-08-18-home-widgets-batch-design.md` (in `NimoOS-New-UI`)

## Global Constraints

- **Commit messages: English only.** Imperative subject, sentence case, body explains *why* rather than restating the diff.
- **Code comments: English only.** Includes doc comments, test assertion messages, log lines, error text.
- **Always commit with `-s`.** The GitHub DCO bot blocks any non-merge commit lacking a `Signed-off-by:` trailer.
- **Nothing may touch `src/styles/theme.css`.** The New-UI working tree carries 14 uncommitted Time Machine files including that one; editing it would tangle this batch with work in progress. Reuse the existing `--accent` and `--drop-bg` tokens; add no new ones.
- **Never `git add -A` or `git commit -a`.** Stage named files only, or the uncommitted Time Machine changes get swept into these commits.
- **Scoped tests only.** The full New-UI suite takes ~295s and the repo owner has stopped it before. Run `pnpm vitest run <path>` for the files you touched.
- **Use `--reporter=verbose`.** vitest's default reporter does not print stderr from passing tests, so warnings hide.
- **New-UI package manager is pnpm@9.0.6.** Never yarn or npm.
- **New-UI branch:** `feat/2026-08-18-home` (already created, based on `master` @ `ff63cb47`).
- **`NimoOS` is a separate git repository** on branch `main`. Task 1 must create its own branch there. It has one untracked file, `route/v1/image_test.go`, that belongs to unrelated work — leave it alone.
- **`NimoOS` requires `CGO_ENABLED=1`** to build (mattn/go-sqlite3).
- Tasks 2, 3 and 5 change geometry or CSS. **jsdom cannot observe either** (`getBoundingClientRect` is always 0 there, and this repo has repeatedly shipped CSS that passed every test and still failed in a browser). Those three require real-Chromium screenshot evidence in addition to vitest.
- Chromium lives at `~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`. The Playwright npm/pip packages are **not** installed — drive the binary directly:
  ```
  ~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome --headless=new --no-sandbox \
    --hide-scrollbars --force-device-scale-factor=3 --window-size=900,500 \
    --virtual-time-budget=2500 --screenshot=/abs/out.png "file:///abs/page.html"
  ```
- vitest runs with **`TZ=UTC`** (`vite.config.ts:99`) and the i18n locale pinned to **`zh_cn`** (`vitest.setup.ts`). Assert Chinese copy, and never assume the machine's own timezone in a test.

---

## File Structure

**`NimoOS` (Go backend) — Task 1**
- Modify `route/v1/system.go` — add `GetSystemTimeZone` handler plus a testable `timeZoneResult` helper.
- Modify `route/v1.go` — register `GET /v1/sys/timezone`.
- Create `route/v1/timezone_test.go` — covers the helper's success and empty-reading branches.

**`NimoOS-New-UI` — Tasks 2-6**
- Create `src/home/util/timezone.ts` — `utcOffsetLabel()`, pure IANA-name → `UTC+8` formatting.
- Create `src/home/util/timezone.test.ts`.
- Create `src/home/composables/useHostTimezone.ts` — module-level singleton that fetches the host zone once.
- Create `src/home/composables/useHostTimezone.test.ts`.
- Modify `packages/service/src/sys.ts` — add `getTimeZone()`.
- Modify `src/home/components/widgets/ClockWidget.vue` — render the badge in the `wide` and `med` variants.
- Modify `src/home/components/widgets/ClockWidget.test.ts`.
- Modify `src/settings/util/systemConfig.ts` — change the stale `America/New_York` default.
- Modify `src/home/grid/dockMath.ts` — add pure `dropTarget()`.
- Modify `src/home/grid/dockMath.test.ts`.
- Modify `src/home/components/DockApp.vue` — suppress native image drag.
- Modify `src/home/components/HomeDock.vue` — call `dropTarget()` during the drag, render the placeholder.
- Modify `src/home/components/HomeDock.test.ts`.
- Modify `src/home/components/widgets/StorageWidget.vue` — drop `:arc="false"`.
- Modify `src/home/components/widgets/RingGauge.vue` — `line-height: 1`, wider hole, delete the dead `arc` prop and its three-colour CSS default.
- Modify `src/home/components/widgets/CpuWidget.vue` — gate the sparkline on height.
- Modify `src/home/components/widgets/CpuWidget.test.ts`.
- Modify `src/home/components/widgets/GpuWidget.vue` — absent readings render as an em dash; add the frequency row.
- Create `src/home/components/widgets/GpuWidget.test.ts`.
- Modify `src/i18n/zh_cn.base.ts` and `src/i18n/en_us.base.ts` — one new key, `widgetFreq`.

---

## Task 1: Backend route for the host timezone

**Repository:** `/home/nimo/NimoTech/NimoOS` (separate repo, currently on `main`)

**Files:**
- Modify: `route/v1/system.go` (add after `GetSystemPaths`, around line 415)
- Modify: `route/v1.go:117` (register next to the existing `/utilization` route)
- Test: `route/v1/timezone_test.go` (create)

**Interfaces:**
- Consumes: `service.MyService.System().GetTimeZone() string`, which already exists at `service/system.go:1702` and shells out to `/usr/share/nimoos/shell/helper.sh:34`. Verified by hand to return `Asia/Shanghai` on this device.
- Produces: `GET /v1/sys/timezone` → `{"success":200,"message":"ok","data":{"timezone":"Asia/Shanghai"}}`. On an unreadable timezone: `success: 500`, no `data`. Task 2 consumes this contract.

Return the IANA name only, never a numeric offset — the frontend derives the offset with `Intl`, which handles daylight saving for free and keeps calendar rules out of the backend.

- [ ] **Step 1: Create the branch**

```bash
cd /home/nimo/NimoTech/NimoOS
git checkout -b feat/2026-08-18-sys-timezone-route main
```

- [ ] **Step 2: Write the failing test**

Create `route/v1/timezone_test.go`:

```go
package v1

import (
	"testing"

	"github.com/NimoTech/NimoOS/pkg/utils/common_err"
)

// timeZoneResult is split out of GetSystemTimeZone precisely so these two
// branches can be exercised without standing up the service.MyService
// singleton, which a handler-level test would need.
func TestTimeZoneResult_TrimsAndWrapsAReading(t *testing.T) {
	// GetTimeZone shells out to awk, so a trailing newline is possible.
	code, res := timeZoneResult("Asia/Shanghai\n")
	if code != common_err.SUCCESS {
		t.Fatalf("a good reading should be a 200: got %d", code)
	}
	data, ok := res.Data.(map[string]string)
	if !ok {
		t.Fatalf("Data should be map[string]string, got %T", res.Data)
	}
	if data["timezone"] != "Asia/Shanghai" {
		t.Fatalf("surrounding whitespace should be trimmed: got %q", data["timezone"])
	}
}

func TestTimeZoneResult_ReportsAnUnreadableTimezoneAsAFailure(t *testing.T) {
	// GetTimeZone returns "" when the shell helper is missing or timedatectl fails.
	// Reporting that as a 200 with an empty string would make the frontend render
	// an empty badge instead of hiding it.
	code, res := timeZoneResult("   ")
	if code != common_err.SERVICE_ERROR {
		t.Fatalf("an empty reading should be a 500: got %d", code)
	}
	if res.Data != nil {
		t.Fatalf("a failure should carry no data: got %v", res.Data)
	}
}
```

- [ ] **Step 3: Run the test and confirm it fails**

```bash
cd /home/nimo/NimoTech/NimoOS
CGO_ENABLED=1 go test ./route/v1/ -run TestTimeZoneResult -v
```

Expected: FAIL to compile — `undefined: timeZoneResult`.

- [ ] **Step 4: Implement the helper and the handler**

In `route/v1/system.go`, add after `GetSystemPaths` (which ends around line 415). `strings`, `model`, `common_err`, `service` and `echo` are all already imported by this file — add no imports.

```go
// timeZoneResult turns a raw GetTimeZone() reading into a response.
// Separated from the handler so both branches are testable without the
// service.MyService singleton.
func timeZoneResult(raw string) (int, model.Result) {
	tz := strings.TrimSpace(raw)
	if tz == "" {
		return common_err.SERVICE_ERROR, model.Result{
			Success: common_err.SERVICE_ERROR,
			Message: common_err.GetMsg(common_err.SERVICE_ERROR),
		}
	}
	return common_err.SUCCESS, model.Result{
		Success: common_err.SUCCESS,
		Message: common_err.GetMsg(common_err.SUCCESS),
		Data:    map[string]string{"timezone": tz},
	}
}

// @Summary get the host's IANA timezone name
// @Produce  application/json
// @Accept application/json
// @Tags sys
// @Security ApiKeyAuth
// @Success 200 {string} string "ok"
// @Router /sys/timezone [get]
//
// Only the IANA name is returned, deliberately without an offset: the caller
// derives the offset itself, which keeps daylight-saving rules out of this
// service. Note this is unrelated to the `timezone` field in the user's system
// config blob, which is a frontend display preference nothing here reads.
func GetSystemTimeZone(ctx echo.Context) error {
	code, res := timeZoneResult(service.MyService.System().GetTimeZone())
	return ctx.JSON(code, res)
}
```

- [ ] **Step 5: Register the route**

In `route/v1.go`, directly after the existing line 117 `v1SysGroup.GET("/utilization", v1.GetSystemUtilization)`:

```go
			v1SysGroup.GET("/timezone", v1.GetSystemTimeZone)
```

- [ ] **Step 6: Run the test and confirm it passes**

```bash
cd /home/nimo/NimoTech/NimoOS
CGO_ENABLED=1 go test ./route/v1/ -run TestTimeZoneResult -v
```

Expected: both tests PASS.

- [ ] **Step 7: Build to prove the whole package still compiles**

```bash
cd /home/nimo/NimoTech/NimoOS
CGO_ENABLED=1 go build -o /tmp/nimoos-tzcheck . && echo BUILD-OK
```

Expected: `BUILD-OK`.

- [ ] **Step 8: Commit**

```bash
cd /home/nimo/NimoTech/NimoOS
git add route/v1/system.go route/v1.go route/v1/timezone_test.go
git commit -s -m "feat(sys): expose the host timezone over HTTP

GetTimeZone() has worked for a long time but had no route, so the frontend
could not reach it and had to fall back on the timezone field in the user's
system config blob. That field is a display preference written by the old UI's
settings page, not the host's timezone, and on at least one device the two
disagree.

Only the IANA name is returned. The caller derives the offset, which keeps
daylight-saving rules out of this service."
```

- [ ] **Step 9: Deploy and verify against the real device**

The repo owner must be asked before deploying, because `deploy.sh` restarts the systemd unit. Once they agree:

```bash
/home/nimo/NimoTech/nimo_os_docs/scripts/deploy.sh nimoos
curl -s http://127.0.0.1/v1/sys/timezone
```

Expected exactly: `{"success":200,"message":"ok","data":{"timezone":"Asia/Shanghai"}}`

Record the real response verbatim in the task report. Do not hand-write a fixture for Task 2 from imagination — this repo has been burnt by invented fixtures before.

---

## Task 2: Clock timezone badge

**Repository:** `/home/nimo/NimoTech/NimoOS-New-UI`, branch `feat/2026-08-18-home`

**Files:**
- Create: `src/home/util/timezone.ts`
- Create: `src/home/util/timezone.test.ts`
- Create: `src/home/composables/useHostTimezone.ts`
- Create: `src/home/composables/useHostTimezone.test.ts`
- Modify: `packages/service/src/sys.ts` (add `getTimeZone` next to `getUtilization`)
- Modify: `src/home/components/widgets/ClockWidget.vue`
- Modify: `src/home/components/widgets/ClockWidget.test.ts`
- Modify: `src/settings/util/systemConfig.ts:36` (`SYSTEM_DEFAULTS.timezone`)

**Interfaces:**
- Consumes: `GET /v1/sys/timezone` from Task 1, envelope `{success, message, data:{timezone}}`.
- Produces:
  - `utcOffsetLabel(timeZone: string, at?: Date): string | null`
  - `useHostTimezone(): { zone: Ref<string | null> }`
  - `__resetHostTimezoneForTest(): void`
  - `service.sys.getTimeZone(): Promise<string>`

`Intl` behaviour was verified in node before writing this plan, so the formatter can rely on it:

| input | `timeZoneName: 'longOffset'` yields |
|---|---|
| `Asia/Shanghai` | `GMT+08:00` |
| `UTC` | `GMT+00:00` (not a bare `GMT`) |
| `America/New_York`, August | `GMT-04:00` |
| `America/New_York`, January | `GMT-05:00` (DST handled) |
| `Asia/Kolkata` | `GMT+05:30` |
| `Asia/Kathmandu` | `GMT+05:45` |
| `Not/AZone` or `''` | throws `RangeError` |

- [ ] **Step 1: Write the failing formatter test**

Create `src/home/util/timezone.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { utcOffsetLabel } from './timezone'

// A fixed instant, so a whole-hour zone and a DST zone can both be asserted.
const AUG = new Date('2026-08-18T04:00:00Z')
const JAN = new Date('2026-01-15T04:00:00Z')

describe('utcOffsetLabel', () => {
  it('drops the minutes for a whole-hour zone', () => {
    expect(utcOffsetLabel('Asia/Shanghai', AUG)).toBe('UTC+8')
  })
  it('keeps the minutes for a half- and quarter-hour zone', () => {
    expect(utcOffsetLabel('Asia/Kolkata', AUG)).toBe('UTC+5:30')
    expect(utcOffsetLabel('Asia/Kathmandu', AUG)).toBe('UTC+5:45')
  })
  it('renders UTC itself as UTC+0', () => {
    expect(utcOffsetLabel('UTC', AUG)).toBe('UTC+0')
  })
  it('follows daylight saving rather than a fixed table', () => {
    expect(utcOffsetLabel('America/New_York', AUG)).toBe('UTC-4')
    expect(utcOffsetLabel('America/New_York', JAN)).toBe('UTC-5')
  })
  // Intl throws RangeError on an unknown zone name. Returning null lets the caller
  // hide the badge; throwing would take the whole clock widget down with it.
  it('returns null instead of throwing for an unusable zone', () => {
    expect(utcOffsetLabel('Not/AZone', AUG)).toBeNull()
    expect(utcOffsetLabel('', AUG)).toBeNull()
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm vitest run src/home/util/timezone.test.ts --reporter=verbose
```

Expected: FAIL — cannot resolve `./timezone`.

- [ ] **Step 3: Implement the formatter**

Create `src/home/util/timezone.ts`:

```ts
/**
 * Formats an IANA zone name as a compact offset badge: `Asia/Shanghai` -> `UTC+8`.
 *
 * Intl's `longOffset` gives `GMT+08:00`; the whole-hour `:00` is dropped and the
 * leading zero trimmed, while half- and quarter-hour zones keep their minutes.
 * The offset is resolved at `at`, so daylight saving is handled by Intl rather
 * than by a table here.
 *
 * Returns null for a zone name Intl rejects, so a caller can hide the badge
 * instead of rendering something wrong.
 */
export function utcOffsetLabel(timeZone: string, at: Date = new Date()): string | null {
  let raw: string | undefined
  try {
    raw = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value
  } catch {
    return null // Intl throws RangeError on an unknown or empty zone name
  }
  const m = raw ? /^GMT([+-])(\d{2}):(\d{2})$/.exec(raw) : null
  if (!m) return null
  const [, sign, hh, mm] = m
  const hours = String(Number(hh))
  return mm === '00' ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${mm}`
}
```

- [ ] **Step 4: Run it and confirm it passes**

```bash
pnpm vitest run src/home/util/timezone.test.ts --reporter=verbose
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit the formatter**

```bash
git add src/home/util/timezone.ts src/home/util/timezone.test.ts
git commit -s -m "feat(home): format an IANA zone name as a UTC offset badge

Kept separate from the clock widget because the interesting cases -- daylight
saving, quarter-hour zones, and a zone name Intl rejects -- are worth asserting
directly, and jsdom cannot observe anything about the widget's layout anyway."
```

- [ ] **Step 6: Add the service method**

In `packages/service/src/sys.ts`, immediately after `getUtilization`:

```ts
    // Returns the host's IANA zone name, e.g. "Asia/Shanghai". Deliberately not
    // the `timezone` field of the user's system config blob: that one is a
    // display preference the old UI's settings page wrote, and nothing keeps it
    // in step with the host. unwrap() throws on a non-200 envelope, which is what
    // callers use to decide the reading is unavailable.
    async getTimeZone(): Promise<string> {
      const res = await http.get('/sys/timezone')
      return unwrap<{ timezone: string }>(res.data)?.timezone ?? ''
    },
```

Note: the shared package is inlined (`file:packages/service`) and `vite.config.ts` keeps it out of `optimizeDeps`. Editing it requires restarting `pnpm dev` and a hard browser refresh before manual checks — vitest picks it up with no extra step.

- [ ] **Step 7: Write the failing composable test**

Create `src/home/composables/useHostTimezone.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const getTimeZone = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({ service: { sys: { getTimeZone } } }))

import { useHostTimezone, __resetHostTimezoneForTest } from './useHostTimezone'

beforeEach(() => {
  __resetHostTimezoneForTest()
  getTimeZone.mockReset()
})

describe('useHostTimezone', () => {
  it('exposes the fetched zone', async () => {
    getTimeZone.mockResolvedValue('Asia/Shanghai')
    const { zone } = useHostTimezone()
    await vi.waitFor(() => expect(zone.value).toBe('Asia/Shanghai'))
  })

  // The clock renders one instance per card, and the host timezone cannot change
  // without a reboot, so several consumers must not mean several requests.
  it('fetches once no matter how many consumers ask', async () => {
    getTimeZone.mockResolvedValue('Asia/Shanghai')
    useHostTimezone(); useHostTimezone(); useHostTimezone()
    await vi.waitFor(() => expect(getTimeZone).toHaveBeenCalledTimes(1))
  })

  // An older backend has no /sys/timezone route. The zone must stay null so the
  // badge is hidden; the spec rules out guessing with a browser-side fallback,
  // because a wrong timezone is worse than none.
  it('stays null when the request fails', async () => {
    getTimeZone.mockRejectedValue(new Error('404'))
    const { zone } = useHostTimezone()
    await vi.waitFor(() => expect(getTimeZone).toHaveBeenCalled())
    expect(zone.value).toBeNull()
  })

  it('treats an empty reading as unavailable', async () => {
    getTimeZone.mockResolvedValue('')
    const { zone } = useHostTimezone()
    await vi.waitFor(() => expect(getTimeZone).toHaveBeenCalled())
    expect(zone.value).toBeNull()
  })
})
```

- [ ] **Step 8: Run it and confirm it fails**

```bash
pnpm vitest run src/home/composables/useHostTimezone.test.ts --reporter=verbose
```

Expected: FAIL — cannot resolve `./useHostTimezone`.

- [ ] **Step 9: Implement the composable**

Create `src/home/composables/useHostTimezone.ts`:

```ts
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
```

- [ ] **Step 10: Run it and confirm it passes**

```bash
pnpm vitest run src/home/composables/useHostTimezone.test.ts --reporter=verbose
```

Expected: 4 tests PASS.

- [ ] **Step 11: Write the failing widget test**

The weekday copy is `clockWeekdays: '星期日,星期一,...'` (`src/i18n/zh_cn.base.ts:312`), and the suite is pinned to `zh_cn`. Append to `src/home/components/widgets/ClockWidget.test.ts` — add the mock at the top of the file, above the existing imports, because `vi.mock` is hoisted:

```ts
import { vi } from 'vitest'
const getTimeZone = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({ service: { sys: { getTimeZone } } }))
import { __resetHostTimezoneForTest } from '../../composables/useHostTimezone'
```

and add this block inside the existing `describe('ClockWidget')`:

```ts
  describe('timezone badge', () => {
    beforeEach(() => { __resetHostTimezoneForTest(); getTimeZone.mockReset() })

    it('shows the offset next to the weekday in the 2x3 variant', async () => {
      getTimeZone.mockResolvedValue('Asia/Shanghai')
      const w = mount(ClockWidget, { props: { item: item(3, 2) } })
      await vi.waitFor(() => expect(w.get('.wk').text()).toContain('UTC+8'))
      expect(w.get('.wk').text()).toContain('星期')
    })

    it('shows the offset on the date line in the 2x4 variant', async () => {
      getTimeZone.mockResolvedValue('Asia/Shanghai')
      const w = mount(ClockWidget, { props: { item: item(4, 2) } })
      await vi.waitFor(() => expect(w.get('.sub').text()).toContain('UTC+8'))
    })

    // A wrong timezone is worse than no timezone, so an unavailable reading
    // must leave the clock exactly as it was rather than render a placeholder.
    it('renders no badge when the host timezone is unavailable', async () => {
      getTimeZone.mockRejectedValue(new Error('404'))
      const w = mount(ClockWidget, { props: { item: item(3, 2) } })
      await vi.waitFor(() => expect(getTimeZone).toHaveBeenCalled())
      expect(w.text()).not.toContain('UTC')
      expect(w.get('.wk').text()).toContain('星期')
    })

    it('leaves the 2x2 and 1x2 variants alone', async () => {
      getTimeZone.mockResolvedValue('Asia/Shanghai')
      const sq = mount(ClockWidget, { props: { item: item(2, 2) } })
      const mini = mount(ClockWidget, { props: { item: item(2, 1) } })
      await vi.waitFor(() => expect(getTimeZone).toHaveBeenCalled())
      expect(sq.text()).not.toContain('UTC')
      expect(mini.text()).not.toContain('UTC')
    })
  })
```

Also import `beforeEach` from vitest at the top if the file does not already.

- [ ] **Step 12: Run it and confirm it fails**

```bash
pnpm vitest run src/home/components/widgets/ClockWidget.test.ts --reporter=verbose
```

Expected: the four new tests FAIL (no `UTC+8` in the output); the existing four still pass.

- [ ] **Step 13: Wire the badge into the widget**

In `src/home/components/widgets/ClockWidget.vue`, add to the script block:

```ts
import { useHostTimezone } from '../../composables/useHostTimezone'
import { utcOffsetLabel } from '../../util/timezone'

const { zone } = useHostTimezone()
// null whenever the host timezone is unknown or Intl rejects it, so the badge
// disappears rather than showing something wrong.
const tzBadge = computed(() => (zone.value ? utcOffsetLabel(zone.value, now.value) : null))
```

Change the `wide` and `med` branches of the template to:

```html
      <template v-if="variant === 'wide'">
        <span class="greet">{{ greeting }}</span>
        <span class="time" data-clock-time>{{ time }}</span>
        <span class="sub">{{ dateCN }} · {{ weekday }}<template v-if="tzBadge"> · {{ tzBadge }}</template></span>
      </template>
      <template v-else-if="variant === 'med'">
        <span class="wk">{{ weekday }}<template v-if="tzBadge"> · {{ tzBadge }}</template></span>
        <span class="time" data-clock-time>{{ time }}</span>
        <span class="sub">{{ dateCN }}</span>
      </template>
```

Leave the `square` and `mini` branches untouched — they have no weekday line.

Also extend the header comment's size-adaptive table so the next reader learns the badge only exists in two variants.

- [ ] **Step 14: Run it and confirm it passes**

```bash
pnpm vitest run src/home/components/widgets/ClockWidget.test.ts src/home/util/timezone.test.ts src/home/composables/useHostTimezone.test.ts --reporter=verbose
```

Expected: all PASS.

- [ ] **Step 15: Verify the badge actually fits, in a real browser**

The `med` weekday line is `max(12px, .257em)` on a base of `clamp(26px, 32cqmin, 70px)`, so appending ` · UTC+8` lengthens a line that sits beside the dial in a 308px card. Arithmetic says it fits; confirm it rather than trust that.

Build a standalone page that reproduces both variants at their real sizes — `w:3,h:2` is 308x200 and `w:4,h:2` is 416x200, given the 92px grid cell (`GridCanvas.vue:72`) and a 16px gap — copying `ClockWidget.vue`'s `.v-med` / `.v-wide` CSS verbatim and hardcoding `星期一 · UTC+8`. Screenshot it with the Chromium invocation from Global Constraints.

Confirm from the image: no text clipping, no wrap, no overlap with the dial. Attach the screenshot path to the task report. If it does not fit, stop and report — do not silently shrink a font, because the sizes are proportional ports of an approved design.

- [ ] **Step 16: Fix the stale timezone default**

In `src/settings/util/systemConfig.ts`, `SYSTEM_DEFAULTS.timezone` is `'America/New_York'`. That value is why this device's stored config disagrees with its host. Replace it so a machine whose server has never stored the field defaults to something true:

```ts
export const SYSTEM_DEFAULTS: Readonly<SystemBlob> = Object.freeze({
  // Vue2 defaulted this to America/New_York and its settings page persisted that
  // default on load, which is how devices ended up with a stored timezone that
  // has nothing to do with the host. Follow the browser instead, so an untouched
  // install at least agrees with the machine looking at it. This only helps
  // installs where the server has never stored the field; an existing wrong
  // value has to be corrected in the settings page by hand.
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  search_switch: true,
  recommend_switch: true,
  existing_apps_switch: true,
  rss_switch: false,
  disk_standby: 'never',
})
```

Every field other than `timezone` is byte-identical to what is there now. Leave
the existing doc comment above `SYSTEM_DEFAULTS` in place — it explains why
`lang` is deliberately absent, which is still true.

- [ ] **Step 17: Run the systemConfig and locale tests**

`src/stores/locale.test.ts` asserts against this blob, so it has to be checked too.

```bash
pnpm vitest run src/settings src/stores/locale.test.ts --reporter=verbose
```

Expected: PASS. If a test asserted the literal `America/New_York` as a default, update that test — the value was a defect, not a contract. Say so in the commit body.

- [ ] **Step 18: Commit**

```bash
git add packages/service/src/sys.ts src/home/composables/useHostTimezone.ts \
  src/home/composables/useHostTimezone.test.ts \
  src/home/components/widgets/ClockWidget.vue \
  src/home/components/widgets/ClockWidget.test.ts \
  src/settings/util/systemConfig.ts
git commit -s -m "feat(home): show the host's UTC offset on the clock

The 2x3 and 2x4 clock variants now carry the offset beside the weekday, read
from the new /sys/timezone route rather than from the timezone field in the
user's system config blob. That field is a display preference the old UI's
settings page persisted from its own client-side default, and on this device it
says America/New_York while the host is on Asia/Shanghai.

There is no browser-side fallback on purpose: when the reading is unavailable
the badge is simply absent, because a confidently wrong timezone is worse than
none.

The stale America/New_York default is also gone, which stops new installs
inheriting the same problem. Devices that already stored it need a manual fix
in the settings page; nothing here can distinguish a deliberate New York from
that accident."
```

---

## Task 3: Dock drag — fix the cause and add an insertion preview

**Files:**
- Modify: `src/home/grid/dockMath.ts`
- Modify: `src/home/grid/dockMath.test.ts`
- Modify: `src/home/components/DockApp.vue:4`
- Modify: `src/home/components/HomeDock.vue` (`computeDropTarget`, `onDragMove`, `resetDragState`, template, scoped styles)
- Modify: `src/home/components/HomeDock.test.ts`

**Interfaces:**
- Produces: `dropTarget(clientX, sepMidX, favSlots, moreSlots)` and `interface DockSlot { key: string; midX: number }` in `dockMath.ts`. Nothing outside `HomeDock.vue` consumes them.

Two independent defects:

1. **Dragging is broken outright.** `DockApp.vue:4` renders `<img v-if="meta?.icon" :src="meta.icon" alt="" loading="lazy" />` with no `draggable="false"`, so the browser's native HTML5 image drag steals the gesture: the cursor turns into a no-drop circle-slash and dropping on a browser tab navigates to the icon URL. This repo already has the remedy — `src/photos/lightbox/PhotoImageViewer.vue:221` notes that a text selection can bypass `draggable="false"` and re-trigger the native drag, so it pairs the attribute with `-webkit-user-drag: none` and `user-select: none`. `src/files/viewers/ImageViewer.vue` does the same. Apply all three.
2. **There is no insertion preview.** `computeDropTarget()` already computes `{toZone, beforeKey}` but runs only once, in `onDragEnd`.

Deliberate non-changes: `onDragStart`'s `if (!dock.expanded.value) return` gate stays, and the dragged source keeps `opacity: 0` so it still occupies space (`computeDropTarget`'s midX measurements depend on that; `display: none` would make them jump as the pointer moves).

- [ ] **Step 1: Write the failing pure-function test**

Append to `src/home/grid/dockMath.test.ts`:

```ts
import { dropTarget } from './dockMath'

// Slots are (key, midX) pairs read from the DOM by HomeDock. Extracted here
// because jsdom reports every getBoundingClientRect as 0, so a component test
// cannot say anything about where a drop lands.
describe('dropTarget', () => {
  const fav = [{ key: 'files', midX: 100 }, { key: 'photos', midX: 200 }]
  const more = [{ key: 'settings', midX: 400 }, { key: 'kvm', midX: 500 }]

  it('picks the favourites zone left of the separator and more to its right', () => {
    expect(dropTarget(120, 300, fav, more).toZone).toBe('fav')
    expect(dropTarget(420, 300, fav, more).toZone).toBe('more')
  })
  it('inserts before the nearest slot when dropped to its left', () => {
    expect(dropTarget(180, 300, fav, more).beforeKey).toBe('photos')
  })
  it('appends when dropped to the right of the nearest slot', () => {
    expect(dropTarget(230, 300, fav, more).beforeKey).toBeNull()
  })
  it('appends into an empty zone', () => {
    expect(dropTarget(120, 300, [], more)).toEqual({ toZone: 'fav', beforeKey: null })
  })
  // The separator is rendered only on desktop (v-if="!isMobile"), and the
  // pre-existing behaviour without one is to target the more zone.
  it('targets the more zone when there is no separator', () => {
    expect(dropTarget(10, null, fav, more).toZone).toBe('more')
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm vitest run src/home/grid/dockMath.test.ts --reporter=verbose
```

Expected: FAIL — `dropTarget` is not exported.

- [ ] **Step 3: Implement `dropTarget`**

Append to `src/home/grid/dockMath.ts`:

```ts
export interface DockSlot { key: string; midX: number }

/**
 * Decides where a dragged dock icon would land.
 *
 * `sepMidX` is the midpoint of the separator between the favourites and "more"
 * zones: a drop to its left targets 'fav', otherwise 'more'. Within the chosen
 * zone the nearest slot by midX wins, and the icon goes before it when the
 * pointer is to its left, otherwise to the end (`beforeKey === null`).
 *
 * Lifted out of HomeDock's computeDropTarget so the insertion preview and the
 * drop itself are driven by one decision, and so the decision is testable at all
 * — jsdom reports every getBoundingClientRect as 0.
 */
export function dropTarget(
  clientX: number,
  sepMidX: number | null,
  favSlots: DockSlot[],
  moreSlots: DockSlot[],
): { toZone: 'fav' | 'more'; beforeKey: string | null } {
  const toZone: 'fav' | 'more' = sepMidX != null && clientX < sepMidX ? 'fav' : 'more'
  const slots = toZone === 'fav' ? favSlots : moreSlots
  if (slots.length === 0) return { toZone, beforeKey: null }
  let best = slots[0]
  let bestDist = Math.abs(clientX - best.midX)
  for (const s of slots) {
    const d = Math.abs(clientX - s.midX)
    if (d < bestDist) { bestDist = d; best = s }
  }
  return { toZone, beforeKey: clientX < best.midX ? best.key : null }
}
```

- [ ] **Step 4: Run it and confirm it passes**

```bash
pnpm vitest run src/home/grid/dockMath.test.ts --reporter=verbose
```

Expected: all PASS, including the pre-existing `magScale` test.

- [ ] **Step 5: Write the failing component tests**

Append inside `describe('HomeDock')` in `src/home/components/HomeDock.test.ts`:

```ts
  // The reported symptom -- a no-drop cursor, and dropping on a browser tab
  // opening the icon image -- is the browser's own image drag, not this code.
  // PhotoImageViewer.vue:221 records that draggable="false" alone is not enough,
  // because a text selection re-enables the native drag.
  it('suppresses the browser\'s native image drag on dock icons', () => {
    useAppsStore()
    const w = mount(HomeDock)
    const imgs = w.findAll('.dock-app img')
    expect(imgs.length).toBeGreaterThan(0)
    for (const img of imgs) expect(img.attributes('draggable')).toBe('false')
  })

  it('shows an insertion placeholder while dragging and clears it afterwards', async () => {
    useAppsStore()
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click') // drag needs the expanded dock
    const nav = w.get('nav').element as HTMLElement
    nav.setPointerCapture = (() => {}) as never
    expect(w.find('.dock-ph').exists()).toBe(false)

    await w.get('.dock-app[data-app="settings"]').trigger('pointerdown', { pointerId: 3, clientX: 100, clientY: 100 })
    const move = new Event('pointermove') as PointerEvent
    Object.assign(move, { pointerId: 3, clientX: 140, clientY: 100 }) // crosses the 5px threshold
    window.dispatchEvent(move)
    await w.vm.$nextTick()
    expect(w.find('.dock-ph').exists()).toBe(true)

    const up = new Event('pointerup') as PointerEvent
    Object.assign(up, { pointerId: 3, clientX: 140, clientY: 100 })
    window.dispatchEvent(up)
    await w.vm.$nextTick()
    expect(w.find('.dock-ph').exists()).toBe(false)
  })

  // A click that never crosses the threshold must not flash a placeholder.
  it('shows no placeholder for a plain click', async () => {
    useAppsStore()
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click')
    await w.get('.dock-app[data-app="settings"]').trigger('pointerdown', { pointerId: 4, clientX: 100, clientY: 100 })
    const move = new Event('pointermove') as PointerEvent
    Object.assign(move, { pointerId: 4, clientX: 102, clientY: 100 }) // under the threshold
    window.dispatchEvent(move)
    await w.vm.$nextTick()
    expect(w.find('.dock-ph').exists()).toBe(false)
  })
```

In jsdom every rect is zero, so `dropTarget` will report `toZone: 'more'`, `beforeKey: null` and the placeholder lands at the end of the more zone. That is fine — these tests assert that a placeholder exists during a drag and not otherwise; *where* it goes is Step 1's job and the screenshot's.

- [ ] **Step 6: Run them and confirm they fail**

```bash
pnpm vitest run src/home/components/HomeDock.test.ts --reporter=verbose
```

Expected: the `draggable` test FAILS (attribute absent) and both placeholder tests FAIL (no `.dock-ph`). The pre-existing tests still pass.

- [ ] **Step 7: Suppress the native image drag**

In `src/home/components/DockApp.vue`, change line 4 to:

```html
      <img v-if="meta?.icon" :src="meta.icon" alt="" loading="lazy" draggable="false" />
```

and give the component a scoped style block (it currently has none — keep the trailing comment about global styles):

```html
<style scoped>
/* The dock's own pointer-based drag has to win over the browser's native image
   drag, which otherwise hijacks the gesture: no-drop cursor, and dropping on a
   tab navigates to the icon URL. draggable="false" is not sufficient on its own
   — a text selection re-enables the native drag — so selection is disabled too.
   Same three-part remedy as PhotoImageViewer.vue:221 and ImageViewer.vue. */
.dock-app {
  user-select: none;
  -webkit-user-select: none;
}
.dock-app img {
  -webkit-user-drag: none;
}
</style>
```

- [ ] **Step 8: Drive the placeholder from the existing drop decision**

In `src/home/components/HomeDock.vue`:

Add to the `DragState` interface and the `reactive` initialiser:

```ts
  toZone: 'fav' | 'more' | null
  beforeKey: string | null
```
```ts
  toZone: null,
  beforeKey: null,
```

Rewrite `computeDropTarget` as a thin DOM reader over the pure function, keeping its signature so `onDragEnd` is unchanged:

```ts
import { dropTarget, type DockSlot } from '../grid/dockMath'

function computeDropTarget(clientX: number, _clientY: number): { toZone: 'fav' | 'more'; beforeKey: string | null } {
  if (!root.value) return { toZone: 'more', beforeKey: null }

  const sepRect = root.value.querySelector<HTMLElement>('.dock-sep')?.getBoundingClientRect()
  const sepMidX = sepRect ? (sepRect.left + sepRect.right) / 2 : null

  // The dragged item is excluded but still occupies its slot (it is hidden with
  // opacity, not display), which is what keeps these midpoints stable mid-drag.
  const slots = (zone: string): DockSlot[] => {
    const out: DockSlot[] = []
    root.value?.querySelectorAll<HTMLElement>(`[data-zone="${zone}"] .dock-app[data-app]`).forEach((btn) => {
      if (btn.dataset.app === drag.key) return
      const r = btn.getBoundingClientRect()
      out.push({ key: btn.dataset.app!, midX: r.left + r.width / 2 })
    })
    return out
  }

  return dropTarget(clientX, sepMidX, slots('fav'), slots('more'))
}
```

At the end of `onDragMove`, after the ghost position is set, record the live decision:

```ts
  // Same call the drop uses, so the preview cannot disagree with the outcome.
  const t = computeDropTarget(e.clientX, e.clientY)
  drag.toZone = t.toZone
  drag.beforeKey = t.beforeKey
```

And clear it in `resetDragState`:

```ts
  drag.toZone = null
  drag.beforeKey = null
```

- [ ] **Step 9: Render the placeholder**

Still in `HomeDock.vue`, replace the two zone blocks:

```html
      <div class="dock-zone" data-zone="fav">
        <template v-for="k in favVisible" :key="k">
          <span v-if="showPh('fav', k)" class="dock-app dock-ph" aria-hidden="true">
            <span class="dock-ic" /><span class="dock-label">&#8203;</span>
          </span>
          <DockApp :app-key="k" />
        </template>
        <span v-if="showPh('fav', null)" class="dock-app dock-ph" aria-hidden="true">
          <span class="dock-ic" /><span class="dock-label">&#8203;</span>
        </span>
      </div>
      <span v-if="!isMobile" class="dock-sep" />
      <div v-if="!isMobile" class="dock-zone dock-more" data-zone="more" :inert="!dock.expanded.value || undefined">
        <template v-for="k in dock.moreKeys.value" :key="k">
          <span v-if="showPh('more', k)" class="dock-app dock-ph" aria-hidden="true">
            <span class="dock-ic" /><span class="dock-label">&#8203;</span>
          </span>
          <DockApp :app-key="k" />
        </template>
        <span v-if="showPh('more', null)" class="dock-app dock-ph" aria-hidden="true">
          <span class="dock-ic" /><span class="dock-label">&#8203;</span>
        </span>
      </div>
```

with the helper in the script block:

```ts
/**
 * True when the insertion placeholder belongs at this position: in the zone the
 * drop is currently targeting, immediately before `key` (or at the end when
 * `key` is null).
 */
function showPh(zone: 'fav' | 'more', key: string | null): boolean {
  return drag.active && drag.toZone === zone && drag.beforeKey === key
}
```

The placeholder reuses the global `.dock-app`, `.dock-ic` and `.dock-label` classes so its box model matches a real icon exactly — `.dock-app` is a `width: var(--app-size)` grid with a 6px gap and `.dock-ic` is a square of the same width (`theme.css:882-898`). The zero-width space keeps the label line's height without any visible text. Add to `HomeDock.vue`'s scoped styles:

```css
/* Insertion preview, mirroring the desktop grid's drop ghost (GridGhost.vue) so
   the two surfaces read the same. Reuses --accent and --drop-bg; theme.css is
   off-limits for this batch. */
.dock-ph { pointer-events: none; }
.dock-ph .dock-ic {
  border: 2px dashed var(--accent);
  background: var(--drop-bg);
  box-shadow: none;
}
```

- [ ] **Step 10: Run the tests and confirm they pass**

```bash
pnpm vitest run src/home/components/HomeDock.test.ts src/home/grid/dockMath.test.ts src/home/components/DockApp.test.ts --reporter=verbose
```

(Drop `DockApp.test.ts` from the list if it does not exist.)

Expected: all PASS, pre-existing ones included — in particular the "pointerdown alone does NOT capture the pointer" test, which guards expanded-mode clicks.

- [ ] **Step 11: Verify in a real browser that dragging works and the frame appears**

vitest cannot show that the native drag is gone, because jsdom has no native drag. This has to be seen.

Start the dev server (`pnpm dev`), open the desktop, click "全部应用" to expand the dock, then drag an icon. Confirm all four:
1. the cursor is **not** a no-drop circle-slash;
2. a dashed frame appears between icons and follows the pointer across slots;
3. releasing reorders the icons to where the frame was;
4. dragging onto a browser tab does **not** open the icon image.

If the repo owner is not available to drive this by hand, take a screenshot mid-drag through CDP instead: attach to the page, `Input.dispatchMouseEvent` a press and a move past the 5px threshold, then `Page.captureScreenshot`. Reaching the real page needs `access_token`, `refresh_token`, **`version`** and `user` in localStorage — omitting `version` makes `router/guard.ts` clear the token and bounce to `/login` with no visible error — and navigation must be a fresh `Page.navigate` to `.../app/?probe=1#/` rather than a `Page.reload`.

Attach the screenshot path to the task report.

- [ ] **Step 12: Commit**

```bash
git add src/home/grid/dockMath.ts src/home/grid/dockMath.test.ts \
  src/home/components/DockApp.vue src/home/components/HomeDock.vue \
  src/home/components/HomeDock.test.ts
git commit -s -m "fix(home): let dock icons be dragged, and show where they will land

Dock icons could not be reordered at all: their <img> had no draggable=\"false\",
so the browser's native image drag took the gesture, showed a no-drop cursor,
and turned a drop on a tab into a navigation to the icon URL. The remedy is the
three-part one already recorded in PhotoImageViewer.vue -- the attribute alone
is not enough, because a text selection re-enables the native drag.

The drop position was also invisible until the icon was released. The decision
now runs on every pointer move and renders a dashed frame at the insertion
point, reusing the desktop grid's drop-ghost look. It is the same call the drop
itself makes, so the preview cannot disagree with the result.

The drop-target maths moved into dockMath.ts because jsdom reports every
getBoundingClientRect as 0, which left it untestable where it was."
```

---

## Task 4: Storage ring shows real data

**Files:**
- Modify: `src/home/components/widgets/StorageWidget.vue:3`
- Create: `src/home/components/widgets/StorageWidget.test.ts`

**Interfaces:**
- Produces: nothing new. Task 5 depends on this landing first, because it deletes the CSS default this change makes dead.

`StorageWidget.vue:3` passes `:arc="false"`, so `RingGauge`'s `arcStyle` never applies and the ring falls back to the CSS default background, a `conic-gradient(var(--good) 0 68%, var(--accent) 68% 84%, var(--ring-track) 84% 100%)` inherited from CasaOS-era `base.css`. **Those three colours represent nothing**: the arc is identical at 3% and at 93% full. Only the number in the middle is real. `StorageWidget.vue:3` is the repo's only `arc` caller.

- [ ] **Step 1: Write the failing test**

Create `src/home/components/widgets/StorageWidget.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useLiveStatsStore } from '../../stores/liveStats'
import StorageWidget from './StorageWidget.vue'
import type { LayoutItem } from '../../grid/types'

const item = (w: number, h: number): LayoutItem => ({ id: 'i', kind: 'widget', key: 'storage', c: 1, r: 1, w, h })

describe('StorageWidget', () => {
  beforeEach(() => setActivePinia(createPinia()))

  // The ring used to fall back to a hardcoded 68%/84% three-colour gradient that
  // ignored the disk entirely, so the arc and the number in the middle disagreed.
  // The arc must now be driven by the same percentage as the text.
  it('drives the ring arc from the real used percentage', () => {
    const s = useLiveStatsStore()
    s.ingest({ disk: { size: 1000, avail: 250, used: 750, health: true }, cpu: null, mem: null, gpu: null, net: null } as any)
    const w = mount(StorageWidget, { props: { item: item(4, 2) } })
    const ring = w.get('.ring')
    expect(ring.text()).toContain('75%')
    expect(ring.attributes('style')).toContain('--p: 75')
    // The dead three-colour fallback keyed off these hardcoded stops.
    expect(ring.attributes('style')).not.toContain('68%')
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm vitest run src/home/components/widgets/StorageWidget.test.ts --reporter=verbose
```

Expected: FAIL — the element has no inline `style`, because `arc=false` suppresses `arcStyle`.

- [ ] **Step 3: Remove the `arc` override**

In `src/home/components/widgets/StorageWidget.vue`, line 3:

```html
    <RingGauge :percent="pct" :label="t('widgetUsed')" />
```

- [ ] **Step 4: Run it and confirm it passes**

```bash
pnpm vitest run src/home/components/widgets/StorageWidget.test.ts --reporter=verbose
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/home/components/widgets/StorageWidget.vue src/home/components/widgets/StorageWidget.test.ts
git commit -s -m "fix(home): drive the storage ring from the real used percentage

The widget passed arc=false, which suppressed RingGauge's data-driven gradient
and left the ring on a CSS fallback whose colours change at a hardcoded 68% and
84%. The arc looked identical whether the disk was 3% or 93% full; only the
number in the middle was ever real, which is why this was the one ring on the
desktop that looked different from the others."
```

---

## Task 5: Fit the ring gauge text, and hide the sparkline in a two-row card

**Files:**
- Modify: `src/home/components/widgets/RingGauge.vue`
- Modify: `src/home/components/widgets/CpuWidget.vue:9`
- Modify: `src/home/components/widgets/CpuWidget.test.ts`

**Interfaces:**
- Consumes: Task 4 must have landed — `StorageWidget.vue` was the only caller passing `arc`, so the prop and the CSS default it selected are dead code once that is done.
- Produces: `RingGauge`'s props narrow to `{ percent, label, color? }`; `arc` is gone.

Measured in real Chromium on the Processor card at its default `w:4,h:2` (416x200 given the 92px cell and 16px gap, so `cqmin = 168`):

| quantity | measured |
|---|---|
| ring diameter / radius | 57px / 28.6px |
| hole radius (`closest-side 78%`) | 22.3px |
| band width | 6.3px |
| text block height | 31px (Latin label) / 33px (CJK label) |
| hole chord at the block's top edge | 32.0px / 30.3px |
| ink width of "42%" | ~34px |
| number's ink centre vs ring centre | 0.00px |
| label's ink centre vs ring centre | **-7.52px** |

Two independent defects, and the reported "not centred" is only half of one of them.

**Horizontal: the label really is off-centre.** `<s>` is `display: block`, so its box width comes from the wider `<b>` (36.17px for "42%"), and its computed `text-align` is `start`. The label's 21.13px of ink sits flush left in that box, so its centre is **7.52px left of the ring's centre** — 13% of a 57px ring, and by far the most visible part of the complaint. The number, by contrast, is exactly centred. Only `text-align: center` fixes this; `line-height` does nothing for it.

**Vertical: the block is centred but does not fit.** `place-items: center` puts the block dead centre (0.01px), but it is taller than the hole, so the number overflows sideways onto the band and the label touches it from below. The 2px gap between an 11px Latin line box and a 13px CJK one at the same `font-size: 10px` makes the Processor card's two rings spill unequally, which reads as one being more crooked than the other.

With `line-height: 1` the block drops to 27px, its top edge to -13.5px, and the chord grows to `2*sqrt(22.3^2 - 13.5^2) = 35.5px > 34px`. **That handles the fit on its own**; widening the hole to 82% is margin.

- [ ] **Step 1: Write the failing tests**

Append to `src/home/components/widgets/CpuWidget.test.ts`:

```ts
  // The Processor card is w:4,h:2 by default (defaultLayout.ts:22) and at that
  // height the chart is squeezed against the rings, so it is gated on height too.
  it('hides the sparkline in a two-row card', () => {
    const s = useLiveStatsStore()
    s.ingest({ cpu: { percent: 42, num: 6, temperature: 50 }, mem: { usedPercent: 70, total: 16e9 }, disk: null, gpu: null, net: null } as any)
    const w = mount(CpuWidget, { props: { item: item(4, 2) } })
    expect(w.find('.chart-box').exists()).toBe(false)
    expect(w.find('.ring-pair').exists()).toBe(true) // the rings stay
  })

  it('shows the sparkline once the card is tall enough', () => {
    const s = useLiveStatsStore()
    s.ingest({ cpu: { percent: 42, num: 6, temperature: 50 }, mem: { usedPercent: 70, total: 16e9 }, disk: null, gpu: null, net: null } as any)
    const w = mount(CpuWidget, { props: { item: item(4, 3) } })
    expect(w.find('.chart-box').exists()).toBe(true)
  })
```

Create `src/home/components/widgets/RingGauge.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RingGauge from './RingGauge.vue'

describe('RingGauge', () => {
  it('always renders the data-driven gradient', () => {
    const w = mount(RingGauge, { props: { percent: 42, label: 'CPU' } })
    const style = w.get('.ring').attributes('style') ?? ''
    expect(style).toContain('--p: 42')
    // The old three-colour fallback keyed off these hardcoded stops; nothing may
    // select it any more.
    expect(style).not.toContain('68%')
  })

  it('renders an em dash rather than a percentage when there is no reading', () => {
    const w = mount(RingGauge, { props: { percent: null, label: 'CPU' } })
    expect(w.get('.ring').text()).toContain('—')
  })
})
```

- [ ] **Step 2: Run them and confirm they fail**

```bash
pnpm vitest run src/home/components/widgets/CpuWidget.test.ts src/home/components/widgets/RingGauge.test.ts --reporter=verbose
```

Expected: the "hides the sparkline" test FAILS (the chart renders at `h:2`); `RingGauge.test.ts`'s first test may already pass, since `arc` defaults to true — that is fine, it is a regression guard for Step 4.

- [ ] **Step 3: Gate the sparkline on height**

In `src/home/components/widgets/CpuWidget.vue`, line 9:

```html
    <Sparkline v-if="item.h > 2" :points="store.cpuHist" />
```

The surrounding `<template v-else>` already means `item.w > 2`, so this reads as `w > 2 && h > 2`.

Add a comment above it:

```html
    <!-- The chart needs a third row: at h=2 (the default size, defaultLayout.ts:22)
         it is squeezed against the rings with no usable height. -->
```

- [ ] **Step 4: Fit the ring text and delete the dead `arc` path**

Rewrite `src/home/components/widgets/RingGauge.vue` as:

```html
<template>
  <div class="ring" :style="arcStyle">
    <div class="ring-txt"><b>{{ percent == null ? '—' : percent + '%' }}</b><s>{{ label }}</s></div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(defineProps<{ percent: number | null; label: string; color?: string }>(), {
  color: 'var(--accent)',
})
// The hole is 82%, not the 78% this started at: at the smallest ring the card
// produces (57px, so a 22.3px hole radius) the percentage's ink was ~34px wide
// against a 32px chord at the text's top edge, so the number spilled onto the
// colour band. Measured in Chromium; jsdom cannot see any of this.
const arcStyle = computed(() => ({
  '--p': String(props.percent || 0),
  background: `radial-gradient(closest-side, var(--ring-hole) 82%, transparent 83%), conic-gradient(${props.color} calc(var(--p)*1%), var(--ring-track) 0)`,
}))
</script>
<style scoped>
/* base.css:142-145 — ring gauge (conic-gradient w/ design tokens).
   The background is always the inline data-driven gradient above; the hardcoded
   68%/84% three-colour fallback that used to live here was only ever selected by
   arc=false, which no caller passes since the storage widget stopped doing it. */
.ring { position: relative; display: grid; place-items: center; width: clamp(64px, 42cqmin, 124px); aspect-ratio: 1; border-radius: 50%; min-width: 0; }
/* Both declarations are load-bearing; they fix two different things.
   text-align: center -- <s> is display:block, so its box is as wide as the
   percentage above it, and the default `start` alignment left the label's ink
   7.52px left of the ring's centre on a 57px ring. That off-centre label is the
   defect people actually notice.
   line-height: 1 -- without it the block is 31px tall for a Latin label and 33px
   for a CJK one, taller than the hole, so the number pressed out onto the band
   and the two rings in the Processor card spilled by different amounts for no
   visible reason. Pinning it to the font size makes the block 27px and identical
   in both scripts. */
.ring-txt { line-height: 1; text-align: center; }
.ring b { font-size: clamp(16px, 11cqmin, 26px); font-weight: 600; font-family: var(--num-font, inherit); }
.ring s { text-decoration: none; display: block; margin-top: 2px; font-size: clamp(10px, 5cqmin, 13px); color: var(--fg-muted); }
</style>
```

Note the inner `div` gains the class `ring-txt`; the CSS above targets it rather than a bare element selector.

- [ ] **Step 5: Run the tests and confirm they pass**

Every ring-bearing widget is affected, so run all of them:

```bash
pnpm vitest run src/home/components/widgets/ --reporter=verbose
```

Expected: all PASS. If any test asserted `arc`, delete that assertion — the prop is gone on purpose, and say so in the commit body.

- [ ] **Step 6: Prove the text now fits, in a real browser**

Build a standalone page reproducing the Processor card at 416x200 with `container-type: size`, `.ring-pair` / `.ring-col` copied from `CpuWidget.vue` and the new `RingGauge` CSS, one ring with a Latin label (`CPU`) and one with a CJK label (`内存`), plus the inline `arcStyle`. Draw a 1px hairline across each ring's vertical centre as a reference. Screenshot at `--force-device-scale-factor=3`.

Confirm from the image:
1. **each label's ink is horizontally centred on its ring** — this is the defect that prompted the task, and the one a `text-align` regression would silently bring back;
2. neither percentage touches the colour band;
3. neither label touches it;
4. the two rings look identical in placement despite one label being CJK;
5. the band is still clearly visible (82% leaves ~5px at this size — check it did not vanish).

Measure item 1 rather than eyeballing it: select the label's text node with a
`Range` and compare `getBoundingClientRect()`'s centre against the ring's. The
element box is *not* the ink box for a block-level label, which is exactly how
this defect stayed invisible — report the delta, which should be ~0px against
the -7.52px measured before the fix.

Report the measured hole radius, block height and chord alongside the screenshot path. If the band reads as too thin, report it and stop rather than picking a new number unilaterally — the ring is a ported design.

- [ ] **Step 7: Commit**

```bash
git add src/home/components/widgets/RingGauge.vue src/home/components/widgets/RingGauge.test.ts \
  src/home/components/widgets/CpuWidget.vue src/home/components/widgets/CpuWidget.test.ts
git commit -s -m "fix(home): centre the ring gauge label and fit the text inside the ring

Two defects with one symptom. The label was genuinely off-centre: <s> is
display:block, so its box is as wide as the percentage above it, and the default
`start` alignment left its ink 7.52px left of the centre of a 57px ring. The
number, meanwhile, was centred to within 0.01px -- it was merely too big for the
hole. At the smallest ring a card produces the percentage's ink is ~34px wide
against a 32px chord at its top edge, so it pressed out onto the colour band and
the label touched it from below. text-align fixes the first, line-height the
second; the hole going from 78% to 82% is margin.

It also makes the Processor card's two rings match. A CJK label's line box is
13px where a Latin one is 11px at the same font size, so the memory ring spilled
further than the CPU ring for a reason nothing on screen explained.

The dead arc prop and the hardcoded 68%/84% fallback it selected are gone; the
storage widget was the only caller and no longer passes it.

The sparkline is now gated on height as well as width, since the default
Processor card is two rows tall and the chart has no room there."
```

---

## Task 6: GPU card stops presenting absent readings as zeros

**Files:**
- Modify: `src/home/components/widgets/GpuWidget.vue`
- Create: `src/home/components/widgets/GpuWidget.test.ts`
- Modify: `src/i18n/zh_cn.base.ts` (after line 300, `widgetModel`)
- Modify: `src/i18n/en_us.base.ts` (after line 300, `widgetModel`)

**Interfaces:**
- Consumes: the `gpu[]` element shape from `GET /v1/sys/utilization`. Measured on this device on 2026-08-18:

```json
{"index":0,"name":"Intel Corporation Wildcat Lake [Intel Graphics] (rev 01)",
 "vendor":"intel","utilization_gpu":0.687593423019428,"utilization_memory":0,
 "memory_total":0,"memory_used":0,"temperature":0,"freq_mhz":1000}
```

- Produces: a new i18n key `widgetFreq`. There is no Vue2 counterpart to copy the Chinese from — `NimoOS-UI` has no frequency string and no GPU widget file — so `频率` / `Frequency` is a new string, chosen to match the neighbouring one-word labels (`温度`, `显存`, `型号`).

The host has no working NVIDIA driver (`nvidia-smi` fails) and one Intel GPU at `/sys/class/drm/card0`, so `gpu[0]` is the integrated GPU. The card is correct to be showing it — the existing "no GPU, no card" gating (`AddPanel.vue:231` on `liveStats.gpuPresent`, plus `reconcileGpu.ts`) is right and stays untouched. The problem is what it shows: three of four stat rows are absent readings rendered as real zeros, and `freq_mhz` — the one field with a genuine value on integrated graphics — is dropped entirely.

`heatColor` is `t == null ? 'var(--accent)' : t < 60 ? 'var(--good)' : ...` (`src/home/util/format.ts:25`), so a reported `0` takes the `t < 60` branch and paints the ring a confident "cool green" from a temperature the driver never gave.

- [ ] **Step 1: Write the failing test**

Create `src/home/components/widgets/GpuWidget.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useLiveStatsStore } from '../../stores/liveStats'
import GpuWidget from './GpuWidget.vue'
import type { LayoutItem } from '../../grid/types'

const item = (w: number, h: number): LayoutItem => ({ id: 'i', kind: 'widget', key: 'gpu', c: 1, r: 1, w, h })

// Captured verbatim from GET /v1/sys/utilization on the device, 2026-08-18.
// An integrated GPU reports no temperature and no VRAM, so those arrive as 0.
const IGPU = {
  index: 0,
  name: 'Intel Corporation Wildcat Lake [Intel Graphics] (rev 01)',
  vendor: 'intel',
  utilization_gpu: 0.687593423019428,
  utilization_memory: 0,
  memory_total: 0,
  memory_used: 0,
  temperature: 0,
  freq_mhz: 1000,
}

const DISCRETE = {
  index: 0, name: 'NVIDIA GeForce RTX 4070', vendor: 'nvidia',
  utilization_gpu: 43.5, utilization_memory: 61, memory_total: 12884901888,
  memory_used: 7858000000, temperature: 54, freq_mhz: 0,
}

describe('GpuWidget', () => {
  beforeEach(() => setActivePinia(createPinia()))

  const mountWith = (gpu: unknown, w = 4) => {
    const s = useLiveStatsStore()
    s.ingest({ gpu: [gpu], cpu: null, mem: null, disk: null, net: null } as any)
    return mount(GpuWidget, { props: { item: item(w, 2) } })
  }

  // An integrated GPU has no VRAM and its sysfs exposes no temperature. Zero
  // means "absent", and printing it as 0℃ / 0 B states something false.
  it('renders absent readings as an em dash, not as zeros', () => {
    const w = mountWith(IGPU)
    expect(w.text()).not.toContain('0℃')
    expect(w.text()).not.toContain('0 B')
    const rows = w.findAll('.stat').map((r) => r.text())
    expect(rows.some((r) => r.includes('温度') && r.includes('—'))).toBe(true)
    expect(rows.some((r) => r.includes('显存') && r.includes('—'))).toBe(true)
  })

  // freq_mhz is the only field with a real value on integrated graphics and was
  // not rendered at all.
  it('shows the clock frequency when the backend reports one', () => {
    const w = mountWith(IGPU)
    const rows = w.findAll('.stat').map((r) => r.text())
    expect(rows.some((r) => r.includes('频率') && r.includes('1000'))).toBe(true)
  })

  it('omits the frequency row when there is no reading', () => {
    const w = mountWith(DISCRETE)
    expect(w.findAll('.stat').map((r) => r.text()).some((r) => r.includes('频率'))).toBe(false)
  })

  // 0.687% is a real reading. Rounding it to 0% throws the only signal away.
  it('keeps a decimal so a lightly loaded GPU does not read as idle', () => {
    const w = mountWith(IGPU)
    expect(w.get('.ring').text()).toContain('0.7%')
  })

  it('still renders real readings from a discrete card', () => {
    const w = mountWith(DISCRETE)
    expect(w.text()).toContain('54℃')
    expect(w.get('.ring').text()).toContain('43.5%')
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm vitest run src/home/components/widgets/GpuWidget.test.ts --reporter=verbose
```

Expected: FAIL — `0℃` present, no 频率 row, ring reads `1%`.

- [ ] **Step 3: Add the i18n key**

After `widgetModel` in both catalogues (line 300 in each):

`src/i18n/zh_cn.base.ts`:
```ts
  widgetFreq: '频率',
```
`src/i18n/en_us.base.ts`:
```ts
  widgetFreq: 'Frequency',
```

- [ ] **Step 4: Stop rendering absent readings as zeros**

In `src/home/components/widgets/GpuWidget.vue`, replace the computed block with:

```ts
// An integrated GPU reports temperature 0 and memory_total 0 because the driver
// exposes neither, not because it is cold and has no memory. Treat 0 in these
// fields as "absent" so the row shows an em dash; freq_mhz is the one field
// integrated graphics does fill in, so it earns a row of its own.
const nz = (v: unknown): number | null => (typeof v === 'number' && v > 0 ? v : null)

const usage = computed(() => {
  const u = g.value && g.value.utilization_gpu
  // One decimal, not a round(): an idling integrated GPU sits under 1%, and
  // rounding turns its only live signal into a flat 0%.
  return typeof u === 'number' ? Math.round(u * 10) / 10 : null
})
const tempC = computed(() => nz(g.value && g.value.temperature))
const temp = computed(() => (tempC.value == null ? '—' : Math.round(tempC.value) + '℃'))
const vramTotal = computed(() => nz(g.value && g.value.memory_total))
const vram = computed(() => (vramTotal.value == null ? '—' : fmtSize(vramTotal.value)))
const memUse = computed(() => {
  const m = nz(g.value && g.value.utilization_memory)
  return m == null ? '—' : Math.round(m) + '%'
})
const freq = computed(() => {
  const f = nz(g.value && g.value.freq_mhz)
  return f == null ? null : Math.round(f) + ' MHz'
})
// Pass the absent temperature through as null so heatColor takes its neutral
// branch. A literal 0 lands in `t < 60` and paints a confident "cool green" from
// a reading that does not exist (util/format.ts:25).
const col = computed(() => heatColor(tempC.value))
```

`RingGauge` takes `percent: number | null` and renders `percent + '%'`, so a one-decimal number needs no change there.

In the template's wide `.stats` block, add the frequency row after VRAM usage and keep it out of the way when absent:

```html
    <div v-else class="stats">
      <div class="stat"><span>{{ t('widgetModel') }}</span><b>{{ g && g.name ? g.name : '—' }}</b></div>
      <div class="stat"><span>{{ t('widgetTemp') }}</span><b>{{ temp }}</b></div>
      <div class="stat"><span>{{ t('widgetVram') }}</span><b>{{ vram }}</b></div>
      <div class="stat"><span>{{ t('widgetVramUsage') }}</span><b>{{ memUse }}</b></div>
      <div v-if="freq" class="stat"><span>{{ t('widgetFreq') }}</span><b>{{ freq }}</b></div>
    </div>
```

Leave the narrow (`item.w <= 2`) `.pill-grid` branch's two pills as they are — they now read `—` through the same computeds, which is the point, and there is no room for a third pill.

- [ ] **Step 5: Run it and confirm it passes**

```bash
pnpm vitest run src/home/components/widgets/GpuWidget.test.ts --reporter=verbose
```

Expected: 5 tests PASS.

- [ ] **Step 6: Check nothing else asserted the old strings**

```bash
pnpm vitest run src/home/ src/ai/util/systemTiles.test.ts --reporter=verbose
```

Expected: PASS. `systemTiles.ts` also reads utilization, so it is worth the extra path.

- [ ] **Step 7: Commit**

```bash
git add src/home/components/widgets/GpuWidget.vue src/home/components/widgets/GpuWidget.test.ts \
  src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -s -m "fix(home): stop the GPU card stating absent readings as zeros

On a host whose only GPU is integrated -- which is this device, since nvidia-smi
cannot reach a driver -- three of the card's four rows were false. The driver
exposes no temperature and no VRAM, so the backend sends 0, and the widget
printed 0℃ and 0 B as though it had measured them. The ring colour was computed
from that same absent temperature, so heatColor's t < 60 branch painted a
confident \"cool\" green.

freq_mhz, the one field integrated graphics does fill in, was not rendered at
all; it now gets a row, shown only when there is a reading.

Utilization keeps one decimal. An idling integrated GPU sits under 1%, and
rounding flattened its only live signal to 0%.

Which GPUs get a card is unchanged: the existing gpuPresent gating is correct,
and it shows this one because the backend genuinely reports a GPU."
```

---

## Final verification (after all tasks)

- [ ] **Step 1: Run every touched suite together**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm vitest run src/home src/settings src/stores/locale.test.ts --reporter=verbose
```

Expected: PASS. Do not run the full suite.

- [ ] **Step 2: Type-check and build**

```bash
pnpm build
```

Expected: success. This is the gate that catches a `RingGauge` caller still passing `arc`, which vitest can miss.

- [ ] **Step 3: Confirm the Time Machine work is still uncommitted and untouched**

```bash
git status --short
```

Expected: exactly the same 14 modified files that were there at the start —
`src/files/composables/useDeckPreview.ts`, the seven `src/files/snapshot/TimeMachine*` files and their tests, `src/files/util/timeMachineMath.ts`, `src/i18n/en_us.base.ts`, `src/i18n/zh_cn.base.ts`, `src/styles/theme.css` — with the two i18n files now legitimately also carrying Task 6's `widgetFreq`. **`src/styles/theme.css` must show no change from this batch.** If it does, revert that hunk.

- [ ] **Step 4: Report**

Summarise per task: what changed, the test command and its result, and for Tasks 2, 3 and 5 the screenshot paths. Name anything deferred. Do not push — the repo owner asks for pushes explicitly.

---

## Deferred, recorded in the spec

- This device's stored `system.timezone` is `America/New_York` and no code path repairs an already-stored value; it needs a manual pick in the settings page. A "follow host" option in that dropdown would fix it properly and is a separate feature.
- No NPU support exists anywhere in the backend; surfacing NPU metrics needs a collector in NimoOS core first.
- `GpuWidget` reads only `gpu[0]`, so on a host with both a discrete card and an integrated one the integrated GPU is silently dropped. Not reachable on this device.
- With the sparkline gated on height and the default Processor card two rows tall, the chart no longer appears in the default layout. The repo owner was told and chose to keep the default at 2.
