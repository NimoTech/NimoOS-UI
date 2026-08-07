/** Extensions the "Set as wallpaper" item is offered for. Ported verbatim from
 *  Vue2 mixins/mixin.js:52 -- note it includes svg and gif but not webp, which
 *  matches what the backend's GetImageExt accepts. */
export const WALLPAPER_EXT = ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'svg'] as const

export function canBeWallpaper(entry: { name: string; is_dir: boolean } | null): boolean {
  if (!entry || entry.is_dir) return false
  const dot = entry.name.lastIndexOf('.')
  if (dot < 0) return false
  const ext = entry.name.slice(dot + 1).toLowerCase()
  return (WALLPAPER_EXT as readonly string[]).includes(ext)
}
