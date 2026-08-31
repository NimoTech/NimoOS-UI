// Map theme preset table + `resolveMapTheme` / `mapThemeStyleVars` /
// `swatchColors`. Ported line-by-line from the Vue 2 panel's src/views/Photos/PhotosPlacesView.vue:
//   :85-113   (mapTheme/customDotColor/customCityColor/mapThemes initial values in data())
//   :134-151  (currentTheme computed — the semantic source for resolveMapTheme)
//   :952/:974 (how the theme color gets injected into the zoombar's --accent and the <svg>'s background/--map-*)
// Consumers: src/photos/components/PlacesThemeMenu.vue (built alongside this module, renders the
// popover), src/photos/components/PlacesMap.vue (consumes mapThemeStyleVars()'s output as :style).
//
// ── This is a third exception category approved by the spec's D5 decision (a data-visualization palette, not an app skin) ──────────────
// The 28 color values below (4 presets × 7 fields: bg/land/dot + light.{bg,grid,dotBg,dot}) plus
// the two custom default colors are map-visualization colors the user can pick in the "Map theme"
// popover, orthogonal to New-UI's blue/white app themes (src/styles/theme.css): under the same
// app theme, the user can still freely switch between the 4 map presets; this set of values must
// be preserved as-is (each preset's light/dark tone pair is a product design decision, not legacy
// hardcoding that "forgot to be tokenized"). Precedent: src/photos/util/peopleView.ts's
// `PLACE_PALETTE` (the 7-color classification palette for the person-detail page's Places tab,
// registered under the same docs/THEMING.md §6 exception list). The values live in this .ts file
// rather than theme.css: color-guard (src/styles/color-guard.test.ts) only scans .vue <style>
// blocks and .css files, not .ts — this set of values was never meant to become 26 one-off theme
// tokens; placing them here is a deliberate choice, registered as one line in docs/THEMING.md §6.
//
// Landed Vue2 PR #106 sub-commits 1-3 (git show 78cf3335) that this
// module had not yet ported:
//  1. Contrast finals — every `light.dotBg` value below was bumped from its pre-#106 literal
//     (0.10/0.10/0.10/0.12) to the shipped final (0.30/0.32/0.32/0.34) so the unvisited land-dot
//     matrix reads against the near-white canvas as clearly as it does against the dark one.
//  2. Custom-mode picker remap — `resolveMapTheme`'s `'custom'` branch now matches what the two
//     pickers' labels actually promise: "Land dot color" feeds `dotBg` (a fixed-0.30-alpha wash
//     via `hexToRgba`, below), "City light color" feeds `dot` (a solid fill). The pre-#106
//     mapping had them backwards (dot ← land-picker's raw hex, grid ← city-picker's raw hex) —
//     Vue2 caught this via the same PR and renamed its own `customGridColor` field to
//     `customCityColor` once the field stopped meaning "grid line color"; this module's own
//     `CUSTOM_GRID_DEFAULT` export is renamed `CUSTOM_CITY_DEFAULT` for the identical reason.
//  3. Custom canvas follows app theme — `bg`/`grid` in custom mode now switch on `isLight`
//     (using `MAP_THEME_PRESETS[0]`'s dark/light pair) instead of being hardcoded to the dark
//     literal `#0A0A0C` regardless of theme — the pre-#106 behavior turned the map black the
//     moment a color was picked, even on a light app theme.
// None of this touches which *signal* selects light vs dark (see next paragraph) — sub-commits
// 1-3 are pure value/mapping fixes, orthogonal to sub-commit 4 (Task 5's perf port) and to the
// D5 signal-source paragraph below.
//
// "Trigger signal for the light variant" (D5): this task reverts P6a's original decision (reading
// the global `useThemeStore().theme`) and goes back to reading Photos' own private theme
// (`usePhotosTheme()`, sourced from the same signal as `.photos-root.is-light`) — consistent with
// the reasoning spec 2026-08-11 §4 already wrote for `usePhotosTheme.ts` itself ("a reversion to
// Vue2's private-switch semantics, overturning New-UI's earlier 'follow global only' decision");
// this just brings the map in line with that same rule, it isn't a new decision. The caller (the
// container component PhotosPlaces.vue) computes the isLight boolean from
// `usePhotosTheme().theme` and passes it in — this module's own functions stay pure, with no
// direct dependency on any store/composable.

export interface MapThemePreset {
  id: 'default' | 'ocean' | 'sand' | 'mono'
  nameKey: string // i18n key, e.g. photosPlacesThemeDefault
  descKey: string // i18n key, e.g. photosPlacesThemeDescDefault
  bg: string
  land: string
  dot: string
  light: { bg: string, grid: string, dotBg: string, dot: string }
}

// The 28 color values (4 presets × 7 fields) are copied character-for-character from Vue2's
// currentTheme/mapThemes final state (git show 78cf3335, the values after PR #106 sub-commit
// 1-2 landed — not one character may be changed). light.dotBg is the one field group this task
// changed across all 4 presets — it used to be 0.10/0.10/0.10/0.12 pre-#106; see below for the
// final values after PR #106 raised this contrast twice.
export const MAP_THEME_PRESETS: readonly MapThemePreset[] = [
  {
    id: 'default',
    nameKey: 'photosPlacesThemeDefault',
    descKey: 'photosPlacesThemeDescDefault',
    bg: '#0A0A0C', land: '#6E5BFF', dot: '#6E5BFF',
    light: { bg: 'oklch(0.975 0.004 80)', grid: 'rgba(28,28,30,0.07)', dotBg: 'rgba(28,28,30,0.30)', dot: '#6E5BFF' },
  },
  {
    id: 'ocean',
    nameKey: 'photosPlacesThemeOcean',
    descKey: 'photosPlacesThemeDescOcean',
    bg: '#0a121a', land: '#5AC8FA', dot: '#5AC8FA',
    light: { bg: 'oklch(0.97 0.008 230)', grid: 'rgba(10,100,160,0.08)', dotBg: 'rgba(10,100,160,0.32)', dot: '#0A84C2' },
  },
  {
    id: 'sand',
    nameKey: 'photosPlacesThemeSand',
    descKey: 'photosPlacesThemeDescSand',
    bg: '#1a1612', land: '#FF9F0A', dot: '#FF9F0A',
    light: { bg: 'oklch(0.97 0.008 80)', grid: 'rgba(120,80,0,0.08)', dotBg: 'rgba(120,80,0,0.32)', dot: '#C77800' },
  },
  {
    id: 'mono',
    nameKey: 'photosPlacesThemeMono',
    descKey: 'photosPlacesThemeDescMono',
    bg: '#0A0A0C', land: '#9aa0a6', dot: '#e0e0e0',
    light: { bg: 'oklch(0.975 0.004 80)', grid: 'rgba(28,28,30,0.08)', dotBg: 'rgba(28,28,30,0.34)', dot: '#3C4043' },
  },
] as const

// Custom color-picker defaults (Vue2 :86-87). The usePhotosPlaces store (T3) already validates
// and falls back to these same two values independently — the two literals are deliberately not
// shared through one module (the store has its own comment pointing back to the same Vue2 source
// lines); these are exported separately here for the popover component and this file's own tests
// to use, without creating a cross-module dependency. CUSTOM_CITY_DEFAULT is renamed by this task
// from CUSTOM_GRID_DEFAULT (same renaming rationale as Vue2's customGridColor→customCityColor,
// see the header comment's item 2 above) — the value itself is unchanged.
export const CUSTOM_DOT_DEFAULT = '#6E5BFF'
export const CUSTOM_CITY_DEFAULT = '#9C8EFF'

// Ported character-for-character from Vue2 :67-79: #RGB / #RRGGBB → rgba() at the given alpha. Used by the custom map
// theme so a picked land-dot colour renders as a wash (unlit) instead of a solid fill, keeping
// the lit-vs-unlit hierarchy the presets have. Non-hex input passes through unchanged (Vue2's
// own degrade path when the browser's `<input type="color">` somehow yields a non-hex string).
export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(String(hex ?? '').trim())
  if (!m) return hex
  let h = m[1]
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = Number.parseInt(h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

export interface ResolvedMapTheme {
  bg: string
  dot: string
  grid: string
  dotBg: string | null
}

/**
 * Pure-function version of Vue2's currentTheme computed (:134-151, the final state after #106
 * sub-commit 3).
 * - mapTheme === 'custom' (#106 sub-commit 3 remap):
 *   - bg/grid follow isLight — light takes the corresponding field off MAP_THEME_PRESETS[0].light;
 *     dark's bg is the deep-space literal `#0A0A0C`, grid is the literal `rgba(255,255,255,0.04)`
 *     (the same number as --map-grid's CSS fallback value — custom mode injects it unconditionally
 *     so that CSS fallback never actually fires, but the value is kept consistent with it anyway).
 *     Pre-#106, bg was a constant dark literal regardless of the app theme — that was exactly the
 *     bug this fixes (the moment a color got picked, the map went black even on a light theme).
 *   - dot takes customCityColor directly (the "City light color" picker's current value, a solid
 *     fill, no conversion).
 *   - dotBg takes customDotColor run through hexToRgba(…, 0.30) — a wash (the "Land dot color"
 *     picker, fixed at 0.30 alpha, matching the presets' own dotBg semantics: both mean "the
 *     translucent base color for an unlit land-dot").
 *   Pre-#106, dot/grid connected directly to customDotColor/customGridColor's raw hex instead
 *   (which didn't match either picker's own label, "Land dot color"/"City light color", at all;
 *   dotBg was always null).
 * - Otherwise look up the preset by id, falling back to MAP_THEME_PRESETS[0] if not found.
 * - If isLight and the preset has a light variant: all four fields come from light.*.
 * - Otherwise (dark, the default path): bg/dot come from the preset itself, **grid takes the land
 *   field** (this is what Vue2 :150 actually does, not the more intuitive-sounding "a grid field"
 *   — Vue2's preset objects have no separate grid field at all; the dark map's grid lines use the
 *   same color as the land dots). dotBg is always null (the dark branch never supplies a
 *   land-dot background color).
 */
export function resolveMapTheme(
  mapTheme: string,
  customDotColor: string,
  customCityColor: string,
  isLight: boolean,
): ResolvedMapTheme {
  if (mapTheme === 'custom') {
    const base = MAP_THEME_PRESETS[0]
    return {
      bg: isLight ? base.light.bg : base.bg,
      grid: isLight ? base.light.grid : 'rgba(255,255,255,0.04)',
      dot: customCityColor,
      dotBg: hexToRgba(customDotColor, 0.30),
    }
  }
  const preset = MAP_THEME_PRESETS.find((p) => p.id === mapTheme) ?? MAP_THEME_PRESETS[0]
  if (isLight && preset.light) {
    return { bg: preset.light.bg, dot: preset.light.dot, grid: preset.light.grid, dotBg: preset.light.dotBg }
  }
  return { bg: preset.bg, dot: preset.dot, grid: preset.land, dotBg: null }
}

/**
 * Vue2 :974's injection point: `Object.assign({ background, --map-dot, --map-grid }, dotBg ? { --map-dot-bg } : {})`.
 * `--map-dot-bg` is only added to the result when dotBg is non-null — PlacesMap.vue's `.world-dot`
 * relies on `var(--map-dot-bg, var(--map-dot-bg-fallback))` to pick up this conditional fallback
 * semantics; if this were changed to inject unconditionally, the ground dot matrix would lose its
 * own fallback color under the dark theme.
 */
// --map-grid has no consumer here — its only consumer in Vue2 is .world-graticule /
// .world-equator (the lat/long grid), and that rule set has been judged dead code and explicitly
// not ported (PlacesMap.vue doesn't render any lat/long grid elements). This still copies Vue2's
// unconditional injection of --map-grid — not an oversight, just noted (following the same
// pattern as the note already made for --map-dot's fallback at PlacesMap.vue:122-124).
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
 * Used by the small swatch squares in the popover: each light/dark state takes the preset's
 * corresponding bg/dot (Vue2 :921-922's two ternaries).
 * Unlike resolveMapTheme — this always serves only the preset's own preview color, and doesn't
 * touch the 'custom' branch (custom has no concrete preset object; the two color blocks in the
 * popover are two <input type="color">s that don't go through this function).
 */
export function swatchColors(p: MapThemePreset, isLight: boolean): { bg: string, dot: string } {
  if (isLight) return { bg: p.light.bg, dot: p.light.dot }
  return { bg: p.bg, dot: p.dot }
}
