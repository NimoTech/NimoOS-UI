## Task 2: core 预览端点 + 路由注册

**Files:**
- Modify: `NimoOS/route/v1/preview.go`(加 `GetFilePreview` 处理器)
- Modify: `NimoOS/route/v1/preview_test.go`(加处理器校验测试)
- Modify: `NimoOS/route/v1.go`(注册 `GET /file/preview`)

**Interfaces:**
- Consumes:`convertOfficeToPDF`、`isConvertibleOffice`(Task 1);`checkPathAccess`(现有 `route/v1/file.go`)。
- Produces:`func GetFilePreview(ctx echo.Context) error` —— `GET /v1/file/preview?path=`;成功 `ctx.Blob(200,"application/pdf",data)`;错误返回 `model.Result` JSON。

- [ ] **Step 1: 写失败测试(处理器校验)**

在 `NimoOS/route/v1/preview_test.go` 追加(顶部 import 加 `"net/http"`, `"net/http/httptest"`, `"github.com/labstack/echo/v4"`, `"github.com/NimoTech/NimoOS/pkg/utils/common_err"`):
```go
func TestGetFilePreview_MissingPath(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/v1/file/preview", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	_ = GetFilePreview(c)
	if rec.Code != common_err.CLIENT_ERROR {
		t.Fatalf("missing path: want %d got %d", common_err.CLIENT_ERROR, rec.Code)
	}
}

func TestGetFilePreview_UnsupportedExt(t *testing.T) {
	e := echo.New()
	// 无 user_id/user_role header → checkPathAccess 视为本地内部调用,放行,进入 ext 校验
	req := httptest.NewRequest(http.MethodGet, "/v1/file/preview?path=/DATA/a.txt", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	_ = GetFilePreview(c)
	if rec.Code != common_err.CLIENT_ERROR {
		t.Fatalf("bad ext: want %d got %d", common_err.CLIENT_ERROR, rec.Code)
	}
}
```

- [ ] **Step 2: 跑测试确认 RED**

Run:
```bash
cd /home/nimo/NimoTech/NimoOS && CGO_ENABLED=1 go test ./route/v1/ -run 'TestGetFilePreview' 2>&1 | tail -12
```
Expected: 编译失败(`undefined: GetFilePreview`)。

- [ ] **Step 3: 实现 GetFilePreview**

在 `NimoOS/route/v1/preview.go` 追加 import `"net/http"`、`osexec "os/exec"`、`"path/filepath"`(已有)、`"github.com/labstack/echo/v4"`、`"github.com/NimoTech/NimoOS/model"`、`"github.com/NimoTech/NimoOS/pkg/utils/common_err"`、`"github.com/NimoTech/NimoOS-Common/utils/logger"`、`"go.uber.org/zap"`;然后:
```go
// GetFilePreview 把旧版 Office(doc/wps/xls/ppt/pptx)转成 PDF 返回。
// 响应体是原始 PDF 字节(application/pdf),非 Result 信封;错误时返回 Result JSON + 非 2xx。
func GetFilePreview(ctx echo.Context) error {
	filePath := ctx.QueryParam("path")
	if len(filePath) == 0 {
		return ctx.JSON(common_err.CLIENT_ERROR, model.Result{
			Success: common_err.INVALID_PARAMS,
			Message: common_err.GetMsg(common_err.INVALID_PARAMS),
		})
	}
	if err := checkPathAccess(ctx, filePath); err != nil {
		return err
	}
	if !isConvertibleOffice(filepath.Ext(filePath)) {
		return ctx.JSON(common_err.CLIENT_ERROR, model.Result{
			Success: common_err.INVALID_PARAMS,
			Message: "unsupported preview format",
		})
	}
	if _, err := osexec.LookPath("soffice"); err != nil {
		return ctx.JSON(common_err.SERVICE_ERROR, model.Result{
			Success: common_err.SERVICE_ERROR,
			Message: "文档转换组件(LibreOffice)未安装",
		})
	}
	data, err := convertOfficeToPDF(filePath)
	if err != nil {
		logger.Error("file preview convert failed", zap.String("path", filePath), zap.Error(err))
		return ctx.JSON(common_err.SERVICE_ERROR, model.Result{
			Success: common_err.SERVICE_ERROR,
			Message: "文档转换失败",
		})
	}
	return ctx.Blob(http.StatusOK, "application/pdf", data)
}
```
（注:`osexec "os/exec"` 是标准库,用于 `LookPath`;转换用的 `nexec` 是 safetext 包,勿混。)

- [ ] **Step 4: 跑测试确认 GREEN**

Run:
```bash
cd /home/nimo/NimoTech/NimoOS && CGO_ENABLED=1 go test ./route/v1/ -run 'TestGetFilePreview|TestIsConvertibleOffice|TestSofficeArgs' 2>&1 | tail -8
```
Expected: PASS。

- [ ] **Step 5: 注册路由**

编辑 `NimoOS/route/v1.go`,在 `v1FileGroup.GET("/content", v1.GetFilerContent)` 一行之后加:
```go
			v1FileGroup.GET("/preview", v1.GetFilePreview) // 旧版 Office → PDF 预览
```

- [ ] **Step 6: 全量构建 + 包测试**

Run:
```bash
cd /home/nimo/NimoTech/NimoOS && CGO_ENABLED=1 go build ./... && CGO_ENABLED=1 go test ./route/v1/ 2>&1 | tail -8
```
Expected: 构建成功;route/v1 测试 PASS。

- [ ] **Step 7: Commit**

```bash
cd /home/nimo/NimoTech/NimoOS
git add route/v1/preview.go route/v1/preview_test.go route/v1.go
git commit -m "feat(file): GET /v1/file/preview 端点(checkPathAccess+ext校验+soffice缺失降级)"
```

---

