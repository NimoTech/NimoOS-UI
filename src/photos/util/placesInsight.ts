// The backend insights' i18n keys are dot-separated nested keys from the Vue2 era
// (NimoOS-Photos/service/places.go:526-560, exactly four of them); New-UI uses flat camelCase
// keys, hence the need for a mapping table (following the P6a regionLabelKey precedent).
// Deviation logged 8: Vue2 `pt(ins.key)` renders the raw key to the user for an unknown key;
// here we return null instead, and the caller skips that card and console.warns — so a new
// backend insight never leaks an internal key into the UI.
export const INSIGHT_KEY_MAP: Readonly<Record<string, string>> = Object.freeze({
  'photos.places.insight.mostPhotographed': 'photosPlacesInsightMostPhotographed',
  'photos.places.insight.topSpot': 'photosPlacesInsightTopSpot',
  'photos.places.insight.companions': 'photosPlacesInsightCompanions',
  'photos.places.insight.home': 'photosPlacesInsightHome',
})

export function insightKey(backendKey: string): string | null {
  return INSIGHT_KEY_MAP[backendKey] ?? null
}

// Deviation logged 9: the backend's params.names is a Go []string (places.go:550-551); Vue2
// interpolates it directly → renders as a comma-joined string with no space. Here we explicitly
// join with ' · ', matching the same convention used for the visit-record faces on the same page
// (Vue2 :1229 `(v.faces || []).join(' · ')`).
export function joinCompanionNames(names: unknown): string {
  if (Array.isArray(names)) {
    return names.map((n) => String(n ?? '')).filter((s) => s !== '').join(' · ')
  }
  return typeof names === 'string' ? names : ''
}
