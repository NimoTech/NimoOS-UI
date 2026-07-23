const BROWSER_IMAGE_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'image/avif', 'image/bmp', 'image/svg+xml',
])
export function browserCanDisplayImage(mimeType: string | null | undefined): boolean {
  return BROWSER_IMAGE_MIME.has((mimeType || '').toLowerCase())
}
