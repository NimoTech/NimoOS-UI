/* Data layer for folder-permissions — **explicitly a stub implementation for this
 * milestone (SP9-P4)**.
 *
 * Why it's a stub: Vue2's folderPermissionsStore.js (132 lines) is a **six-way
 * aggregator**, depending on:
 *   wiki.getCandidates/getRoots/createRoot/patchRootEnabled  → the `wiki` domain has
 *                                                              **no SP assigned yet**,
 *                                                              user has already signed
 *                                                              off on carrying it as
 *                                                              debt (debt D12)
 *   api.get/post/delete('/ai/parser/allowlist/folders')       → via AI proxy, SP8
 *   ai.getSearchSettings / putSearchSettings                  → SP8
 *   ai.listBlacklist / addBlacklistPattern / removeBlacklistPattern → SP8
 *   photos.getConfig / updateConfig                           → SP7
 * Neither the sp7-photos nor the sp8-ai branch has been merged into master yet, so
 * per spec §3.1 **policy three**: build the UI complete to match Vue2, leave the
 * data source and write operations stubbed and flagged in the UI, and after the
 * merge **only this file's fetchSnapshot / execute functions need to be swapped in
 * to wire it up — the UI doesn't need to be redone** (debt D11).
 *
 * ⚠️ Things to do when wiring this up (for whoever picks up debt D11):
 *   1. fetchSnapshot: follow Vue2 folderPermissionsStore.js:25-54's Promise.all +
 *      safe() six-way concurrency — record each path's failure as offline
 *      independently, don't let one failing path take down the whole screen. Note
 *      that search's response nests the value under `settings`
 *      (GET /v1/search/settings → {restart_fields,runtime_fields,settings:{fileindex_roots}}),
 *      while the PUT body is a **flat** patch shape.
 *   2. execute: dispatch per action, following :56-86.
 *   3. Flip WIRED to true — the UI's "data source not wired yet" notice bar will
 *      disappear automatically (see FolderPermissionsPanel.vue).
 *   4. Add the delete button / toggle back to the panel's list rows (the spot is
 *      already commented in the template), going through planToggle + execute +
 *      a full refresh (Vue2 :101-111's semantics: **refresh fully regardless of
 *      success or failure**, since a timeout doesn't mean the write didn't land).
 */
import type { FolderPermAction, FolderPermSnapshot } from './folderPermissions'

/** Whether a real data source has been wired up for this milestone. false → the UI
 *  shows "data source not wired yet" and disables all write operations. */
export const WIRED = false

/** An all-empty snapshot with all four paths marked offline. Marking all four
 *  offline=true is **deliberate**: each of Vue2's sections renders a "service
 *  offline" badge and hides the list and add button when offline, which is exactly
 *  the correct visual form for "no data" this milestone — no need to invent another
 *  empty state. */
export function emptySnapshot(): FolderPermSnapshot {
  return {
    candidates: [],
    searchRoots: [],
    wikiRoots: [],
    denyRules: [],
    blacklist: [],
    photos: { auto: false, dirs: [], stale: false },
    offline: { search: true, knowledge: true, ai: true, photos: true },
  }
}

/** This milestone **doesn't call any API**. Kept async so the signature stays
 *  unchanged when wiring it up — zero changes for consumers. */
export async function fetchSnapshot(): Promise<FolderPermSnapshot> {
  return emptySnapshot()
}

/** Write operations are never allowed to happen this milestone. Throws instead of
 *  silently no-op-ing — if someone accidentally wires up a call site in the future,
 *  it must be immediately visible in tests/console, not silently do nothing. */
export async function execute(actions: FolderPermAction[]): Promise<void> {
  void actions
  throw new Error('folder-permissions writes are not wired yet (SP9-P4, debt D11)')
}
