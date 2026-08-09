import type { FileEntry } from '../stores/files'

/**
 * Whether the backend already exposes this entry as a Samba share.
 *
 * The flag rides in as a *string* on the listing entry, so compare against
 * 'true' rather than truthiness. Single-entry menu gating and batch filtering
 * must both call this -- they used to disagree, which is how a batch share
 * could hit SHARE_ALREADY_EXISTS while the single-entry menu correctly hid
 * the action (pending-ledger F12).
 */
export function isAlreadyShared(e: FileEntry): boolean {
  return e.extensions?.share?.shared === 'true'
}

/**
 * Split a selection into the folders a batch share should actually create,
 * and a count of those skipped because they are already shared.
 *
 * Non-folders are dropped silently: sharing has always been folder-only, so
 * their presence is not something to report back to the user. `skipped` means
 * "would have been shared but already is", nothing else.
 */
export function shareableFolders(entries: FileEntry[]): { targets: FileEntry[]; skipped: number } {
  const folders = entries.filter((e) => e.is_dir)
  const targets = folders.filter((e) => !isAlreadyShared(e))
  return { targets, skipped: folders.length - targets.length }
}
