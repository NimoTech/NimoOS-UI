/**
 * Find which nav item is active based on path and route matching.
 * Finds the item with the longest matching route (best match).
 * @param path Current path (e.g. '/photos/favorites')
 * @param items Nav items with id and route
 * @returns The id of the matching nav item, or null if no match
 */
export function activeNavId(
  path: string,
  items: Array<{ id: string; route: string }>
): string | null {
  let best: string | null = null
  let bestLen = -1

  for (const it of items) {
    const hit = path === it.route || path.startsWith(it.route + '/')
    if (hit && it.route.length > bestLen) {
      best = it.id
      bestLen = it.route.length
    }
  }

  return best
}
