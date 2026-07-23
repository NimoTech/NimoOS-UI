export function osmEmbedSrc(lat: number | null | undefined, lon: number | null | undefined, delta = 0.02): string {
  if (lat == null || lon == null) return ''
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`
}
