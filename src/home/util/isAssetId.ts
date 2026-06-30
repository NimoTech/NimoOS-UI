// engine.js 261
export function isAssetId(k: unknown): boolean {
  return typeof k === 'string' && !!k && !k.includes('gradient')
}
