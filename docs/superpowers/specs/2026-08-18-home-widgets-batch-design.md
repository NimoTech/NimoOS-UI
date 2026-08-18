# Home widget batch: clock timezone, dock drag, ring gauges, GPU card

Date: 2026-08-18
Branch: `feat/2026-08-18-home`
Base: `master` @ `ff63cb47`

## Scope

Five changes to the Vue3 home (desktop) surface. Four came from the user
directly; the fifth (GPU card zero-values) was found while verifying whether the
backend exposes iGPU data, and the user pulled it into this batch.

An originally-requested sixth item — adding an iGPU gauge to the Processor card
— was **dropped after measurement**: the backend already reports the integrated
GPU and the existing GPU card already renders it. See "Evidence" below.

## Evidence gathered before design

All of this was measured on the device itself (this workspace runs on the NAS;
`nimo_os_docs/scripts/deploy.sh` is a local `sudo cp`), not inferred from code.

### Live utilization payload

`GET /v1/sys/utilization` on 2026-08-18 returned, for `gpu`:

```json
[{"index":0,"name":"Intel Corporation Wildcat Lake [Intel Graphics] (rev 01)",
  "vendor":"intel","utilization_gpu":0.687593423019428,"utilization_memory":0,
  "memory_total":0,"memory_used":0,"temperature":0,"freq_mhz":1000}]
```

Host hardware: `nvidia-smi` is installed but fails (`couldn't communicate with
the NVIDIA driver`), and `/sys/class/drm/card0/device/vendor` is `0x8086`. So
`GetGpuStatus()` (NimoOS/service/system.go:1937) returns exactly one entry, the
Intel iGPU, contributed by `scanIntelGpus()`.

`GpuWidget.vue` reads `store.gpu[0]`, so **the GPU card is already showing the
iGPU**. No iGPU gauge is needed on the Processor card.

NPU: a word-boundary grep for `NPU` across `NimoOS` and `NimoOS-Common` returns
nothing. There is no backend support to surface. Out of scope; not ticketed here.

### Ring gauge geometry

Measured in real Chromium (jsdom cannot do this — `getBoundingClientRect` is
always 0 there), replicating the Processor card at its default size. Grid cell is
92px (`GridCanvas.vue:72`) with `--gap: clamp(12px,1vw,16px)`, so a `w:4,h:2`
card is 416x200, content box 384x168, `cqmin = 168`:

| quantity | measured |
|---|---|
| ring diameter / radius | 57px / 28.6px |
| hole radius, `arc=true` path (`closest-side 78%`) | 22.3px |
| colour band width | 6.3px |
| text block height | 31px (Latin label) / 33px (CJK label) |
| hole chord at the text block's top edge | 32.0px / 30.3px |
| ink width of "42%" | ~34px |

**The text block is geometrically centred to within 0.01px.** The visible defect
is that it does not *fit*: the big number overflows the hole horizontally onto
the colour band, and the label touches the band at the bottom. The 2px
difference between Latin and CJK line boxes at the same `font-size: 10px` makes
the two rings in the Processor card spill by different amounts, which reads as
"one is more crooked than the other".

Arithmetic behind the chosen fix: with `line-height: 1` the block drops from
31px to 27px, its top edge moves to -13.5px, and the available chord grows to
2*sqrt(22.3^2 - 13.5^2) = 35.5px > 34px. **The line-height change alone is
sufficient**; enlarging the hole to 82% is margin, not the fix.

### Storage ring's three colours

`StorageWidget.vue` passes `:arc="false"`, so `RingGauge.vue`'s `arcStyle` is not
applied and the ring falls back to the CSS default background:

```css
conic-gradient(var(--good) 0 68%, var(--accent) 68% 84%, var(--ring-track) 84% 100%)
```

`68%` and `84%` are hardcoded constants inherited from CasaOS-era `base.css`.
**The three colours represent nothing** — the arc is identical whether the disk
is 3% or 93% full. Only the number in the middle is real. Every other widget
passes `arc` at its default `true`, whose inline gradient overrides this, which
is why Storage is the only ring that looks different.

### Dock drag

`DockApp.vue:4` renders `<img v-if="meta?.icon" :src="meta.icon" alt=""
loading="lazy" />` with **no `draggable="false"`**. Native HTML5 image dragging
takes over the gesture, which produces exactly the reported symptoms: a no-drop
(circle-slash) cursor, and dropping on a browser tab navigates to the icon URL.

This repo has already hit this failure mode and recorded the remedy. See
`src/photos/lightbox/PhotoImageViewer.vue:221`, whose comment notes that a text
selection can bypass `draggable="false"` and re-trigger native drag; it applies
`draggable="false"`, `-webkit-user-drag: none` and `user-select: none` together.
`src/files/viewers/ImageViewer.vue` does the same. The dock applies none of them.

Note: `onDragStart` also returns early unless `dock.expanded` is true, so drag is
only available after "All apps". That gate is intentional and is **kept** — the
user's report was about expanded mode.

### Timezone

The user asked for the host timezone, which turned out to have two conflicting
sources:

| source | value on this device |
|---|---|
| system config blob (`GET /v1/users/current/custom/system`) | `America/New_York` |
| host truth (`/etc/localtime`, `timedatectl`) | `Asia/Shanghai` |

The stale `America/New_York` was never chosen by a user. It is Vue2's
client-side default (`NimoOS-UI/.../SettingsPanel.vue:938-946`, which also
defaults `lang: 'en_us'` — and the stored blob has that too). `SettingsPanel.vue`
has a **deep watcher on the whole `barData`** (L1206-1222) that calls
`saveData()` on any change; loading the page executes
`this.barData = { ...this.barData, ...serverData }` (L1290), which trips that
watcher, which writes the merged blob back (L1309). Opening the old settings page
once was enough to persist the default.

`/v1/users/current/custom/system` is a plain UserService key-value blob; it does
not know what a timezone is and never reads the host. A grep of all Go source
finds **no backend consumer of the stored `timezone` field** — it is purely a
frontend display preference. Nothing has ever reconciled the two values; they are
two unrelated values that happen to share a name.

The host value is already obtainable: `NimoOS/service/system.go:1702
GetTimeZone()` shells out to `/usr/share/nimoos/shell/helper.sh:34`
(`timedatectl | grep "Time zone" | awk '{printf $3}'`). Verified by hand:

```
$ bash -c 'source /usr/share/nimoos/shell/helper.sh; GetTimeZone'
Asia/Shanghai
```

It works. It simply has no HTTP route.

## Design

### 1. Clock timezone badge

Backend (`NimoOS`): register `v1SysGroup.GET("/timezone", v1.GetSystemTimeZone)`
next to the existing `/utilization` route (`route/v1.go:117`), wrapping
`GetTimeZone()`. Standard envelope `Result{Success, Message, Data}` with
`Data = {"timezone": "Asia/Shanghai"}`.

Return the IANA name only, **not a numeric offset** — the frontend derives the
offset with `Intl`, which gets DST right for free and keeps the backend from
owning calendar rules.

Frontend:
- `packages/service/src/sys.ts` gains `getTimeZone()`.
- A module-level singleton (cached ref + single in-flight promise) fetches once;
  the clock must not issue a request per widget instance.
- `ClockWidget.vue` formats via
  `Intl.DateTimeFormat(undefined, { timeZone, timeZoneName: 'longOffset' })`,
  which yields `GMT+08:00`, normalised to `UTC+8` (drop a `:00` suffix, keep
  `:30` / `:45`).
- Placement: `wide` (2x4) bottom line becomes `<date> · <weekday> · UTC+8`;
  `med` (2x3) weekday line becomes `<weekday> · UTC+8`.

The clock's own time keeps using browser-local getters. That is consistent here
because the browser runs on the host. Degradation: if the route is missing (older
backend) or the request fails, **the badge is not rendered**. There is no `Intl`
fallback — the user explicitly rejected a dual-path source, and a wrong timezone
is worse than no badge.

Separately, `SYSTEM_DEFAULTS.timezone` in `src/settings/util/systemConfig.ts`
changes from `America/New_York` to follow the browser. This only helps machines
where the server has never stored the field; this device has a real stored value
and is not repaired by it. Documented as accepted debt below.

### 2. Dock drag: fix the cause, add an insertion preview

Cause fix, following the in-repo precedent: `DockApp.vue`'s `<img>` gets
`draggable="false"`, plus `-webkit-user-drag: none` and `user-select: none` so a
text selection cannot bypass it.

Insertion preview: `computeDropTarget()` already computes `{toZone, beforeKey}`
but is only called once, in `onDragEnd`. Call it from `onDragMove` as well and
store the result on the drag state; the template then renders a `.dock-ph`
placeholder at that position within the target zone (before the item whose key
matches `beforeKey`, or at the end when it is `null`).

Placeholder styling mirrors `GridGhost.vue`: `2px dashed var(--accent)` over
`var(--drop-bg)`, sized from `--app-size`. No new design tokens.

Two deliberate non-changes:
- The `expanded` gate stays. Enabling collapsed-mode drag is a separate
  behaviour change the user did not ask for.
- The dragged source keeps `opacity: 0` and therefore keeps occupying space,
  leaving a blank slot at its origin. `computeDropTarget`'s midX measurements
  depend on that; switching to `display: none` would make measurements jump as
  the pointer moves.

### 3. Storage ring: two colours, driven by real data

Remove `:arc="false"` from `StorageWidget.vue`. It then uses the same inline
gradient as CPU / memory / GPU: accent up to the true used percentage, track
beyond. The arc and the number in the middle finally agree.

`StorageWidget.vue:3` is the **only** place in the repo that passes `arc`, so
after this the prop has no callers. Delete the `arc` prop from `RingGauge.vue`
and apply the gradient unconditionally rather than leaving an unused option
behind.

### 4. Processor card

- `RingGauge.vue`: add `line-height: 1` to the text block (this is the actual
  overflow fix and it also equalises Latin vs CJK); widen the hole from 78% to
  82% for margin.
- `RingGauge.vue`: delete the hardcoded 68%/84% three-colour CSS default
  background, together with the now-callerless `arc` prop (see change 3). It is
  dead code, and leaving it in place misleads the next reader. The hole
  percentage therefore lives in one place only, the inline gradient.
- `CpuWidget.vue`: gate the Sparkline on `item.w > 2 && item.h > 2` instead of
  `item.w > 2`.

Accepted consequence: `defaultLayout.ts:22` gives the Processor card `w:4, h:2`,
so with this gate **the sparkline no longer appears in the default layout** and
only returns if the user grows the card to three rows. The user was told this and
chose to keep the default height at 2.

### 5. GPU card: stop presenting zeros as readings

`GpuWidget.vue`, for the iGPU shape measured above:
- `temperature`, `memory_total` and `utilization_memory` equal to `0` render as
  an em dash, not `0℃` / `0 B` / `0%`. An iGPU has no VRAM and its sysfs exposes
  no temperature; zero means "absent", not "cold".
- Add a frequency row showing `freq_mhz` — on integrated graphics it is the only
  field with a genuine value, and it is currently dropped entirely.
- Keep one decimal on utilization so `0.687` does not round to `0%`.
- `heatColor` no longer derives the ring colour from an absent temperature.
  `heatColor` is `t == null ? accent : t < 60 ? good : ...` (`util/format.ts:25`),
  so a reported `0` currently takes the `t < 60` branch and paints the ring
  `--good` — a fake "cool green". Pass nothing rather than `0` so it falls to the
  neutral `--accent` branch.

The existing "no GPU, no card" gating (`AddPanel.vue:231` filtered on
`liveStats.gpuPresent`, plus `reconcileGpu.ts`) is correct and unchanged. It
shows the card here because the backend genuinely reports a GPU.

## Testing

TDD per item: failing test first.

Vitest covers the data-shaped changes — timezone formatting and its degradation
path, the `arc` removal, the sparkline gate, and the GPU zero/em-dash mapping.

Items 2 and 4 are geometry and CSS, which **jsdom cannot observe**
(`getBoundingClientRect` is always 0, and this repo has been bitten before by CSS
that passed every test and still failed in a browser). Those two additionally
require real-Chromium screenshot evidence. Chromium is at
`~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`; invoke it with
`--headless=new --no-sandbox --force-device-scale-factor=3 --screenshot=...`.
A working ring-geometry probe was built during design at
`/tmp/claude-1000/-home-nimo-NimoTech/30777c28-04dd-4494-866d-88701c163be5/scratchpad/ring2.html`
— that path is session-scoped and may be gone; the numbers it produced are
recorded in "Evidence" above, and it is quicker to rebuild it from those than to
rely on the file surviving.

Per repo convention, run scoped tests only — the full suite takes ~295s.

## Parallelisation and constraints

Four independent groups: `{1}`, `{2}`, `{3 -> 4}`, `{5}`. Item 3 must land before
item 4, because 4 deletes the CSS default that 3 makes dead.

**Hard constraint: nothing may touch `src/styles/theme.css`.** The working tree
carries 14 uncommitted Time Machine files including that one; editing it would
tangle this batch with work in progress. The placeholder reuses `--accent` and
`--drop-bg`; no new tokens.

Also: do not `git add -A` or `git commit -a`. Stage named files only, or the
uncommitted Time Machine changes will be swept into these commits.

## Known defects recorded, not fixed here

- This device's stored `system.timezone` is `America/New_York` and no code path
  repairs an already-stored value. Changing it requires picking Shanghai in the
  settings page by hand. A "follow host" option in the timezone dropdown would
  fix it properly, but that is a new feature beyond this batch.
- No NPU support exists anywhere in the backend. Surfacing NPU metrics needs a
  new collector in NimoOS core first.
- `GpuWidget` reads only `gpu[0]`. On a host with both a discrete card and an
  iGPU, the iGPU is silently dropped. Not reachable on this device (no working
  NVIDIA driver), so not addressed.
