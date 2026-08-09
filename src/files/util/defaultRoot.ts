// /DATA is the one mount the product guarantees exists (LocalStorage creates it
// and its default subdirectories on startup), so it is the last-resort landing
// spot when everything else is unknown.
export const DATA_ROOT = '/DATA'

// Deciding where "/files" with no path should land. Returning an empty string
// used to be possible -- when the disk list had failed to load there was no
// root to navigate to, and the route sync simply returned, leaving the page
// blank forever with no error and no way out.
export function resolveDefaultRoot({ persisted, diskRoot }: { persisted: string; diskRoot: string }): string {
  return persisted || diskRoot || DATA_ROOT
}
