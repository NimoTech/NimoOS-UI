// Maps the scheduler's stable error code strings (see scheduler.ts `humanize`)
// to zh_cn i18n keys. Unknown/unmapped codes fall back to the generic server error.
const CODE_TO_KEY: Record<string, string> = {
  duplicate: 'filesUploadErrDuplicate',
  expired: 'filesUploadErrExpired',
  no_space: 'filesUploadErrNoSpace',
  protected: 'filesUploadErrProtected',
  bad_name: 'filesUploadErrBadName',
  server: 'filesUploadErrServer',
  network: 'filesUploadErrNetwork',
}

export function uploadErrorKey(code: string): string {
  return CODE_TO_KEY[code] ?? 'filesUploadErrServer'
}
