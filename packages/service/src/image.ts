export function createImage(getToken: () => string | null) {
  function base(path: string): string {
    const t = getToken()
    const tok = t ? `&token=${encodeURIComponent(t)}` : ''
    return `/v1/image?path=${encodeURIComponent(path)}${tok}`
  }
  return {
    thumbUrl(path: string): string {
      return `${base(path)}&type=thumbnail`
    },
    imageUrl(path: string, type?: string): string {
      return type ? `${base(path)}&type=${encodeURIComponent(type)}` : base(path)
    },
  }
}
