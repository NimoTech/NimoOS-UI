/** Store app titles have inconsistent language key casing (v2 store = uppercase en_US, v1/containers = lowercase en_us);
 *  tolerate each case and fall back through available values, finally using id as last resort. Desktop home/stores/apps.ts follows the same convention. */
export function resolveAppTitle(t: Record<string, string> | undefined, fallback: string): string {
  if (!t) return fallback
  return t.zh_cn || t.en_us || t.en_US || t.zh_CN || Object.values(t)[0] || fallback
}

/** Vue2 ice_i18n equivalent lookup chain (common-i18n.js): custom (user-renamed) → current lang → en_us → en_US
 *  → any available value → fallback. Language key casing is inconsistent at the source; tolerate each case. */
export function resolveAppText(
  t: Record<string, string> | undefined,
  lang: string,
  fallback = '',
): string {
  if (!t) return fallback
  return t.custom || t[lang] || t.en_us || t.en_US || Object.values(t).find(Boolean) || fallback
}
