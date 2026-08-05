# Task 1 Report: core 转换核心 (convertOfficeToPDF + 纯 helper)

## What was implemented

In `NimoOS/route/v1/` (branch `feat/office-preview`):

- **`preview.go`** — `isConvertibleOffice(ext string) bool` (case-insensitive membership in
  `.doc/.wps/.xls/.ppt/.pptx`), `sofficeArgs(profileDir, outdir, src string) []string` (pure
  arg builder), and `convertOfficeToPDF(src string) ([]byte, error)`: mkdtemp outdir (deferred
  `RemoveAll` — success/failure/timeout all clean up, no caching), package-level `sync.Mutex`
  (`sofficeGate`) serializing soffice invocations, private `lo-profile` UserInstallation dir
  inside outdir, `context.WithTimeout` at 120s, invocation via the safetext wrapper
  `nexec "github.com/NimoTech/NimoOS-Common/utils/exec"` with a `cmd.Err` check right after
  construction, non-zero-exit handling, and an exit-0-but-no-.pdf fallback that scans outdir
  for any `.pdf` file before giving up.
- **`preview_test.go`** — pure unit tests for `isConvertibleOffice` and `sofficeArgs` (no I/O,
  no soffice needed).
- **`preview_integration_test.go`** — `//go:build integration` tagged end-to-end test: builds
  a real `.doc` via `soffice --convert-to doc` (stdlib `os/exec`, not the safetext wrapper —
  test-only setup), then calls `convertOfficeToPDF` on it and asserts the result starts with
  `%PDF`.

All three files match the brief's code verbatim, except one cosmetic `gofmt -w` pass on
`preview_integration_test.go` that reformatted the one-line `min(a, b int) int { if ... }`
helper into standard multi-line brace style (behavior unchanged; verified tests still pass
after reformat).

## TDD Evidence

**RED** (after creating only `preview_test.go`, before `preview.go` existed):

```
$ CGO_ENABLED=1 go test ./route/v1/ -run 'TestIsConvertibleOffice|TestSofficeArgs' 2>&1 | tail -15
# github.com/NimoTech/NimoOS/route/v1 [github.com/NimoTech/NimoOS/route/v1.test]
route/v1/preview_test.go:10:7: undefined: isConvertibleOffice
route/v1/preview_test.go:15:6: undefined: isConvertibleOffice
route/v1/preview_test.go:22:10: undefined: sofficeArgs
FAIL	github.com/NimoTech/NimoOS/route/v1 [build failed]
FAIL
```

**GREEN** (after creating `preview.go`):

```
$ CGO_ENABLED=1 go test ./route/v1/ -run 'TestIsConvertibleOffice|TestSofficeArgs' -v 2>&1 | tail -12
=== RUN   TestIsConvertibleOffice
--- PASS: TestIsConvertibleOffice (0.00s)
=== RUN   TestSofficeArgs
--- PASS: TestSofficeArgs (0.00s)
PASS
ok  	github.com/NimoTech/NimoOS/route/v1	0.005s
```

## Integration test result (real soffice)

soffice is installed (`/usr/bin/soffice`). Ran with the `integration` build tag:

```
$ CGO_ENABLED=1 go test -tags integration ./route/v1/ -run TestConvertOfficeToPDF_RealSoffice -v 2>&1 | tail -12
=== RUN   TestConvertOfficeToPDF_RealSoffice
--- PASS: TestConvertOfficeToPDF_RealSoffice (1.02s)
PASS
ok  	github.com/NimoTech/NimoOS/route/v1	1.029s
```

**PASSED (not skipped)** — the test built a real `.doc` via soffice, then `convertOfficeToPDF`
converted it back to a real PDF whose first 4 bytes are `%PDF`, confirming the full
mkdtemp→lock→UserInstallation-profile→timeout-context→soffice-invoke→read-pdf pipeline works
end-to-end on this machine.

## `CGO_ENABLED=1 go build ./...`

```
$ CGO_ENABLED=1 go build ./...
(exit 0, no output)
```

Also ran `go vet ./route/v1/...` — clean, no issues.

## Pre-existing environment note (not part of this task's changes)

Before any of the above would compile, the repo's `codegen/message_bus/api.go` (referenced by
`common/message.go`) did not exist yet — it's a `//go:generate`-produced oapi-codegen client
sourced from the sibling `../NimoOS-MessageBus/api/message_bus/openapi.yaml` (per repo
conventions, gitignored, regenerated locally). Ran `go generate ./...` once at the repo root to
produce it; this is a one-time local build-environment step, unrelated to and untouched by this
task's diff (`git status` confirms it's not tracked/staged).

## Files changed + commit

- `route/v1/preview.go` (new)
- `route/v1/preview_test.go` (new)
- `route/v1/preview_integration_test.go` (new)

Commit: `4c0b41c` — `feat(file): convertOfficeToPDF 旧版 Office→PDF(LibreOffice,串行/私有profile/超时/转完即删)`

```
$ git show --stat HEAD
 route/v1/preview.go                    | 78 ++++++++++++++++++
 route/v1/preview_integration_test.go   | 40 ++++++++++
 route/v1/preview_test.go               | 33 ++++++++
 3 files changed, 151 insertions(+)
```

## Self-review / concerns

- No blocking concerns. Implementation matches the brief's exact code.
- Sole deviation: `gofmt -w` reformatted the single-line `min()` helper in the integration test
  file into idiomatic multi-line form (Go 1.21+ actually has a builtin `min`, so this local
  helper only matters on older toolchains still targeted by this module; behavior identical
  either way — confirmed by re-running both pure and integration tests after the format pass,
  both still PASS).
- `convertOfficeToPDF` is a pure primitive with no HTTP wiring yet — Task 2 will add the
  handler that calls it, wires up `isConvertibleOffice`-based routing, and decides
  content-type / download-fallback behavior on error.
- The package-level `sofficeGate sync.Mutex` means concurrent preview requests for different
  files will queue behind each other (by design, per the brief's comment on soffice's per-process
  memory/startup cost) — worth keeping in mind if Task 2's handler doesn't itself impose a
  request timeout shorter than 120s, since a queued request could wait nearly 2 minutes behind
  a stuck conversion before its own conversion even starts.
