# Task 2 Report: core 预览端点 + 路由注册

## What was implemented

- `route/v1/preview.go`: added `GetFilePreview(ctx echo.Context) error`.
  - `GET /v1/file/preview?path=` handler.
  - Missing `path` query param → `400` (`common_err.CLIENT_ERROR`) JSON `model.Result{Success: common_err.INVALID_PARAMS, Message: common_err.GetMsg(...)}`.
  - Delegates to existing `checkPathAccess(ctx, filePath)` (route/v1/file.go, same package) for auth; on error, returns whatever `checkPathAccess` writes (localhost calls with no `user_id`/`user_role` headers are treated as internal and pass through).
  - Unsupported extension (`!isConvertibleOffice(filepath.Ext(filePath))`) → `400` JSON `model.Result{Success: common_err.INVALID_PARAMS, Message: "unsupported preview format"}`.
  - `soffice` missing (`osexec.LookPath("soffice")` fails, stdlib `os/exec`, aliased `osexec` to avoid clashing with the existing `nexec` safetext wrapper used by `convertOfficeToPDF`) → `500` (`common_err.SERVICE_ERROR`) JSON with a Chinese "LibreOffice not installed" message — graceful degrade, no crash.
  - Conversion failure (`convertOfficeToPDF` error) → logs via `logger.Error` (zap) then `500` JSON `model.Result{Success: common_err.SERVICE_ERROR, Message: "文档转换失败"}`.
  - Success → `ctx.Blob(http.StatusOK, "application/pdf", data)` — raw PDF bytes, NOT a `Result` envelope.
- `route/v1/preview_test.go`: added `TestGetFilePreview_MissingPath` and `TestGetFilePreview_UnsupportedExt` per the brief, plus a package `init()` that calls `logger.LogInitConsoleOnly()` (see "Self-review / concerns" below for why this was necessary).
- `route/v1.go`: registered `v1FileGroup.GET("/preview", v1.GetFilePreview) // 旧版 Office → PDF 预览` immediately after the existing `v1FileGroup.GET("/content", v1.GetFilerContent)` line.

## TDD Evidence

### RED

```
$ cd /home/nimo/NimoTech/NimoOS && CGO_ENABLED=1 go test ./route/v1/ -run 'TestGetFilePreview' 2>&1 | tail -12
# github.com/NimoTech/NimoOS/route/v1 [github.com/NimoTech/NimoOS/route/v1.test]
route/v1/preview_test.go:41:6: undefined: GetFilePreview
route/v1/preview_test.go:53:6: undefined: GetFilePreview
FAIL	github.com/NimoTech/NimoOS/route/v1 [build failed]
FAIL
```

Confirmed RED as expected: compile failure on `undefined: GetFilePreview`, before the handler existed.

Note: after adding just the handler (no other changes), a first GREEN attempt actually panicked at runtime (not a test assertion failure) — see "Self-review / concerns" for the root cause and fix, then genuine GREEN below.

### GREEN

```
$ cd /home/nimo/NimoTech/NimoOS && CGO_ENABLED=1 go test ./route/v1/ -run 'TestGetFilePreview|TestIsConvertibleOffice|TestSofficeArgs' -v 2>&1 | tail -8
=== RUN   TestIsConvertibleOffice
--- PASS: TestIsConvertibleOffice (0.00s)
=== RUN   TestSofficeArgs
--- PASS: TestSofficeArgs (0.00s)
=== RUN   TestGetFilePreview_MissingPath
--- PASS: TestGetFilePreview_MissingPath (0.00s)
=== RUN   TestGetFilePreview_UnsupportedExt
2026-07-07T09:52:21.049+0800	info	Checking path access	{"path": "/DATA/a.txt", "userID": "", "role": "", "remoteIP": "192.0.2.1", "func": "v1.checkPathAccess", ...}
--- PASS: TestGetFilePreview_UnsupportedExt (0.00s)
PASS
ok  	github.com/NimoTech/NimoOS/route/v1	0.005s
```

## Build + route/v1 test result

```
$ cd /home/nimo/NimoTech/NimoOS && CGO_ENABLED=1 go build ./... && CGO_ENABLED=1 go test ./route/v1/ 2>&1 | tail -8
(build: no output, exit 0)
ok  	github.com/NimoTech/NimoOS/route/v1	0.006s
```

Full `-v` run of the package shows all 4 relevant tests PASS plus one pre-existing, unrelated `SKIP` (`TestGetSambaSharesList`, explicitly marked in-source as "always failing, skipped to unblock releasing — MUST FIX!" — pre-existing, not touched by this task).

`codegen/message_bus/api.go` was already present (gitignored, previously generated) — `go generate ./...` was not needed this run.

## Files changed + commit

- `route/v1/preview.go` (+43 lines: imports + `GetFilePreview`)
- `route/v1/preview_test.go` (+36 lines: 2 new tests + `init()` for logger)
- `route/v1.go` (+1 line: route registration)

```
commit 7396206
feat(file): GET /v1/file/preview 端点(checkPathAccess+ext校验+soffice缺失降级)
 3 files changed, 80 insertions(+)
```

## Self-review / concerns

- **Deviation from brief, necessary fix**: after implementing `GetFilePreview` exactly per the brief and re-running the two new tests, `TestGetFilePreview_UnsupportedExt` **panicked** (not a clean test failure) with a nil-pointer dereference inside `go.uber.org/zap`, traced to `checkPathAccess` (route/v1/file.go:91) calling `logger.Info(...)` where the package-global `NimoOS-Common/utils/logger` zap logger (`loggers *zap.Logger`) is `nil` until explicitly initialized via `logger.LogInitConsoleOnly()` or `logger.LogInit(...)`. No existing test in `route/v1` previously exercised `checkPathAccess` (the pre-existing `preview_test.go`/`samba_test.go` don't call it), so this gap was latent and never triggered before this task. `NimoOS/service/other_test.go` already calls `logger.LogInitConsoleOnly()` for the same reason in a different package.
  - Fix: added a package-level `init()` in `route/v1/preview_test.go` calling `logger.LogInitConsoleOnly()` — this is the documented "for unit tests" helper (see its doc comment in `NimoOS-Common/utils/logger/log.go`), uses `sync.Once` internally so it's safe if other test files in the package add their own init later, and only touches a file already in this task's allowed file list (no scope creep into `file.go` or other packages).
  - This is a one-line, additive, test-only change; it does not alter `checkPathAccess` or any production code path.
- Both new tests exercise the real, unmodified `checkPathAccess` (not a mock) — confirms the brief's assumption that a request with no `user_id`/`user_role` headers is treated as a local/internal call and passes through to ext validation.
- `common_err.INVALID_PARAMS` (4000) is reused for both the missing-path and unsupported-ext cases, matching the brief's example code exactly (brief's own snippet uses `INVALID_PARAMS` for both `Success` fields even though the two `Message` strings differ) — this is what was literally specified, not something I embellished.
- Did not add an integration-level test for the soffice-missing / soffice-present branches (LookPath success, conversion success/failure) — out of scope per the brief, which only asked for the two validation tests; `preview_integration_test.go` (Task 1, `//go:build integration`) already covers the real-soffice conversion path end-to-end.
- No other files were touched; `git status --short` before commit showed exactly the three files in the brief's allow-list.
