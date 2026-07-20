/** store 应用 title 的语言键大小写不统一(v2 商店=大写 en_US,v1/容器=小写 en_us),
 *  逐一容忍再回退任意可用值,最后才用 id。桌面 home/stores/apps.ts 同款约定。 */
export function resolveAppTitle(t: Record<string, string> | undefined, fallback: string): string {
  if (!t) return fallback
  return t.zh_cn || t.en_us || t.en_US || t.zh_CN || Object.values(t)[0] || fallback
}

/** Vue2 ice_i18n 同款取值链(common-i18n.js):custom(用户改名)→ 当前 lang → en_us → en_US
 *  → 任意可用值 → fallback。语言键大小写在源头就不统一,逐一容忍。 */
export function resolveAppText(
  t: Record<string, string> | undefined,
  lang: string,
  fallback = '',
): string {
  if (!t) return fallback
  return t.custom || t[lang] || t.en_us || t.en_US || Object.values(t).find(Boolean) || fallback
}
