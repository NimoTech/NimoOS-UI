// Task 10(SP7-P6a Places - Map main view): Map theme preset table + `resolveMapTheme` / `mapThemeStyleVars` /
// `swatchColors`. Each line mirrors Vue2 NimoOS-UI src/views/Photos/PhotosPlacesView.vue:
//   :85-113   (Initial values of mapTheme/customDotColor/customGridColor/mapThemes in data())
//   :134-151  (currentTheme computed — semantic source for resolveMapTheme)
//   :952/:974 (How theme colors are injected into zoombar's --accent and <svg>'s background/--map-*)
// Consumers: src/photos/components/PlacesThemeMenu.vue (built in this task, popup display),
// src/photos/components/PlacesMap.vue (T6, consumes mapThemeStyleVars() output as :style).
//
// ── This is the third category of exception approved by spec SP7 D5 (data visualization palette, not app skin) ──────────────
// The following 28 color values (4 presets × 7 fields: bg/land/dot + light.{bg,grid,dotBg,dot}) plus two custom
// defaults are the map visualization colors that users can select in the "Map Theme" popup.
// They are orthogonal to New-UI's two app themes—blue/white (src/styles/theme.css): users can freely switch
// between 4 map presets under the same app theme. These color values must be preserved as-is (the light/dark
// color tones of each preset are product design decisions, not forgotten tokenization remnants). For precedent,
// see `PLACE_PALETTE` in src/photos/util/peopleView.ts (P5-T12, 7-color categorical palette for the Places tab
// in people detail view, registered in the same section of docs/THEMING.md §6). Values are in this .ts file
// rather than theme.css: the color-guard (src/styles/color-guard.test.ts) only scans .vue <style> blocks
// and .css files, not .ts — this color set should never spawn 26 one-off theme tokens. Placing it here is
// intentional, already registered in docs/THEMING.md §6.
//
// The "light variant trigger signal" is the only semantic change in this period (D5) relative to Vue2: Vue2
// reads the photos-private `$store.state.photos.theme`; New-UI instead reads the global
// `useThemeStore().theme === 'light'` (src/stores/theme.ts is already a reactive ref, no need for a new
// MutationObserver) — the caller (container component) pre-computes the isLight boolean and passes it in,
// so this module's functions remain pure and do not directly depend on any store.

export interface MapThemePreset {
  id: 'default' | 'ocean' | 'sand' | 'mono'
  nameKey: string // i18n key, e.g. photosPlacesThemeDefault
  descKey: string // i18n key, e.g. photosPlacesThemeDescDefault
  bg: string
  land: string
  dot: string
  light: { bg: string, grid: string, dotBg: string, dot: string }
}

// 28 color values (4 presets × 7 fields) copied verbatim from Vue2 :88-113, not a single character may change
// (fidelity preservation contract, see the line-by-line source verification table in the task report).
export const MAP_THEME_PRESETS: readonly MapThemePreset[] = [
  {
    id: 'default',
    nameKey: 'photosPlacesThemeDefault',
    descKey: 'photosPlacesThemeDescDefault',
    bg: '#0A0A0C', land: '#6E5BFF', dot: '#6E5BFF',
    light: { bg: 'oklch(0.975 0.004 80)', grid: 'rgba(28,28,30,0.07)', dotBg: 'rgba(28,28,30,0.10)', dot: '#6E5BFF' },
  },
  {
    id: 'ocean',
    nameKey: 'photosPlacesThemeOcean',
    descKey: 'photosPlacesThemeDescOcean',
    bg: '#0a121a', land: '#5AC8FA', dot: '#5AC8FA',
    light: { bg: 'oklch(0.97 0.008 230)', grid: 'rgba(10,100,160,0.08)', dotBg: 'rgba(10,100,160,0.10)', dot: '#0A84C2' },
  },
  {
    id: 'sand',
    nameKey: 'photosPlacesThemeSand',
    descKey: 'photosPlacesThemeDescSand',
    bg: '#1a1612', land: '#FF9F0A', dot: '#FF9F0A',
    light: { bg: 'oklch(0.97 0.008 80)', grid: 'rgba(120,80,0,0.08)', dotBg: 'rgba(120,80,0,0.10)', dot: '#C77800' },
  },
  {
    id: 'mono',
    nameKey: 'photosPlacesThemeMono',
    descKey: 'photosPlacesThemeDescMono',
    bg: '#0A0A0C', land: '#9aa0a6', dot: '#e0e0e0',
    light: { bg: 'oklch(0.975 0.004 80)', grid: 'rgba(28,28,30,0.08)', dotBg: 'rgba(28,28,30,0.12)', dot: '#3C4043' },
  },
] as const

// Custom color picker defaults (Vue2 :86-87). The usePhotosPlaces store (T3) validates and falls back to these two
// values independently — the two literals are intentionally not shared across modules (the store has its own comment
// pointing back to the same Vue2 source line). Exported separately here for use by the popup component and other tests
// in this file; cross-module dependencies should be avoided.
export const CUSTOM_DOT_DEFAULT = '#6E5BFF'
export const CUSTOM_GRID_DEFAULT = '#9C8EFF'

export interface ResolvedMapTheme {
  bg: string
  dot: string
  grid: string
  dotBg: string | null
}

/**
 * Pure-function version of Vue2 currentTheme computed (:134-151).
 * - mapTheme === 'custom': custom mode passes through as-is regardless of app theme lightness (:135-138 comments),
 *   bg is always the hardcoded dark literal here, dotBg is always null.
 * - Otherwise, look up the preset by id, fall back to MAP_THEME_PRESETS[0] if not found.
 * - isLight and preset has light variant: take all four fields from light.*.
 * - Otherwise (dark, default path): bg/dot come from the preset itself, **grid comes from the land field** (the
 *   actual implementation at :150, not the obvious grid field — Vue2's preset object has no independent grid field;
 *   the dark map grid lines use the land dot color). dotBg is always null (dark branch never provides land dot background).
 */
export function resolveMapTheme(
  mapTheme: string,
  customDotColor: string,
  customGridColor: string,
  isLight: boolean,
): ResolvedMapTheme {
  if (mapTheme === 'custom') {
    return { bg: '#0A0A0C', dot: customDotColor, grid: customGridColor, dotBg: null }
  }
  const preset = MAP_THEME_PRESETS.find((p) => p.id === mapTheme) ?? MAP_THEME_PRESETS[0]
  if (isLight && preset.light) {
    return { bg: preset.light.bg, dot: preset.light.dot, grid: preset.light.grid, dotBg: preset.light.dotBg }
  }
  return { bg: preset.bg, dot: preset.dot, grid: preset.land, dotBg: null }
}

/**
 * Injection point from Vue2 :974: `Object.assign({ background, --map-dot, --map-grid }, dotBg ? { --map-dot-bg } : {})`.
 * `--map-dot-bg` is only added to the result when dotBg is not null — PlacesMap.vue (T6)'s `.world-dot`
 * relies on `var(--map-dot-bg, var(--map-dot-bg-fallback))` to consume this conditional expansion fallback
 * semantics; if this is changed to unconditional injection, the land dots in dark theme will lose their own fallback color.
 */
// Review M5: --map-grid has no consumers in P6a — its only consumer in Vue2 is .world-graticule /
// .world-equator (latitude/longitude grid lines), and those rules have been determined to be dead code in this
// period and explicitly not migrated (PlacesMap.vue doesn't render any latitude/longitude line elements). Here we still
// mirror Vue2's unconditional injection of --map-grid; this is not an omission, just a notation (following the pattern
// of the notation already done for --map-dot fallback in PlacesMap.vue:122-124).
export function mapThemeStyleVars(t: ResolvedMapTheme): Record<string, string> {
  const vars: Record<string, string> = {
    background: t.bg,
    '--map-dot': t.dot,
    '--map-grid': t.grid,
  }
  if (t.dotBg !== null) vars['--map-dot-bg'] = t.dotBg
  return vars
}

/**
 * For use by color swatches in the popup: light/dark states each take the preset's corresponding bg/dot
 * (the two ternary expressions at Vue2 :921-922).
 * Unlike resolveMapTheme — here we only ever serve preview colors of the preset itself, not the 'custom' branch
 * (custom has no concrete preset object; those two color blocks in the popup are two <input type="color"> elements
 * that don't go through this function).
 */
export function swatchColors(p: MapThemePreset, isLight: boolean): { bg: string, dot: string } {
  if (isLight) return { bg: p.light.bg, dot: p.light.dot }
  return { bg: p.bg, dot: p.dot }
}
