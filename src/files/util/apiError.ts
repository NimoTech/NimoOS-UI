// Reading a failure out of the shared HTTP client. There are exactly two shapes, and a helper
// that conflates them silently reports the wrong thing -- which is what happened here (see below).
//
// Path A -- HTTP 2xx carrying a non-200 envelope: packages/service/src/unwrap.ts throws
//   `Error & { code: number }`, where code is the envelope's `success` field (60001, 10009, ...).
// Path B -- non-2xx HTTP: axios throws an AxiosError whose `code` is a **string**
//   ('ERR_BAD_REQUEST' for 4xx, 'ERR_BAD_RESPONSE' for 5xx -- see createHttp in
//   packages/service/src/http.ts), with the numeric status on `response.status` and the envelope,
//   if any, on `response.data`.
//
// 🔴 The helper these two functions replace was `code ?? response.status`, duplicated in
// useDeckPreview.ts and snapshotRestore.ts. On path B axios's STRING code shadowed the numeric
// status, so the helper returned 'ERR_BAD_RESPONSE' and every `status === 404` test in both files
// was dead code. Measured on the production device:
//   GET /v1/file?path=/DATA/.snapshots/<absent>/Photos
//   -> AxiosError { code: 'ERR_BAD_RESPONSE', response: { status: 500, data: { success: 60001 } } }
//
// The two backends also disagree about where the meaning lives, so each caller must pick
// deliberately rather than share one "status":
//   - NimoOS core's file API answers HTTP 500 for an absent path; the meaning is the envelope code.
//   - LocalStorage's snapshot API answers a real HTTP 404/400/409 and puts a generic code in the
//     envelope; the meaning is the HTTP status.

/** Envelope `success` code, from either path. Undefined when the failure carried no numeric code. */
export function envelopeCodeOf(e: unknown): number | undefined {
  const err = e as { code?: unknown; response?: { data?: { success?: unknown } } } | undefined
  // Path A: unwrap() puts the envelope code straight on the error. A string code is axios's own
  // error kind, not an envelope code, so it must not be read as one.
  if (typeof err?.code === 'number') return err.code
  // Path B: the envelope survives on the response body.
  const success = err?.response?.data?.success
  return typeof success === 'number' ? success : undefined
}

/** HTTP status of a non-2xx response. Undefined for path A (the request itself succeeded). */
export function httpStatusOf(e: unknown): number | undefined {
  const err = e as { status?: unknown; response?: { status?: unknown } } | undefined
  const status = err?.response?.status ?? err?.status
  return typeof status === 'number' ? status : undefined
}

/** FILE_DOES_NOT_EXIST — NimoOS-Common utils/common_err/e.go, and the 60xxx "file" code range. */
export const FILE_DOES_NOT_EXIST = 60001

// One more wrinkle, and the reason callers below check both slots for 404: the workspace's standard
// envelope is `Result{ Success int, ... }` where **Success carries the HTTP status code**, so a
// plain "not found" can arrive as an envelope `success: 404` (path A) just as easily as an HTTP 404
// (path B). Services that answer with a common_err code instead (60001, INVALID_PARAMS, ...) are
// the exception, not the rule. Checking one slot only would miss the other -- which is what made
// the original conflated helper look reasonable in the first place.
