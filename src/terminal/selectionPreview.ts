// One-line preview of a copied terminal selection for the "Copied: …" pill.
// Terminal selections routinely span lines and carry trailing pad spaces;
// collapse all whitespace so the pill stays a single row, and cap the length
// so a 200-line `cat` doesn't become a 200-line toast.
export const PREVIEW_MAX = 48

export function selectionPreview(text: string, max = PREVIEW_MAX): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  return flat.slice(0, max - 1).trimEnd() + '…'
}
