## Task 1: core 转换核心(convertOfficeToPDF + 纯 helper,TDD)

**Files:**
- Create: `NimoOS/route/v1/preview.go`(helpers + 转换函数)
- Create: `NimoOS/route/v1/preview_test.go`(纯 helper 单测)
- Create: `NimoOS/route/v1/preview_integration_test.go`(build tag `integration`,真 soffice)

**Interfaces:**
- Produces:
  - `func isConvertibleOffice(ext string) bool` — ext(含点,大小写不敏感)∈ {.doc,.wps,.xls,.ppt,.pptx}。
  - `func sofficeArgs(profileDir, outdir, src string) []string` — 构造 soffice 命令参数。
  - `func convertOfficeToPDF(src string) ([]byte, error)` — 转换并返回 PDF 字节;内部 mkdtemp + 串行锁 + 私有 profile + 120s 超时 + defer 清理;失败返回 error。

- [ ] **Step 1: 写失败测试(纯 helper)**

Create `NimoOS/route/v1/preview_test.go`:
```go
package v1

import (
	"strings"
	"testing"
)

func TestIsConvertibleOffice(t *testing.T) {
	for _, ext := range []string{".doc", ".DOC", ".wps", ".xls", ".ppt", ".pptx"} {
		if !isConvertibleOffice(ext) {
			t.Errorf("expected %s convertible", ext)
		}
	}
	for _, ext := range []string{".docx", ".xlsx", ".csv", ".pdf", ".txt", ""} {
		if isConvertibleOffice(ext) {
			t.Errorf("expected %s NOT convertible", ext)
		}
	}
}

func TestSofficeArgs(t *testing.T) {
	args := sofficeArgs("/tmp/out/lo-profile", "/tmp/out", "/DATA/a.doc")
	joined := strings.Join(args, " ")
	for _, want := range []string{"--headless", "--convert-to pdf", "--outdir /tmp/out", "/DATA/a.doc", "-env:UserInstallation=file:///tmp/out/lo-profile"} {
		if !strings.Contains(joined, want) {
			t.Errorf("args missing %q; got %q", want, joined)
		}
	}
}
```

- [ ] **Step 2: 跑测试确认 RED**

Run:
```bash
cd /home/nimo/NimoTech/NimoOS && CGO_ENABLED=1 go test ./route/v1/ -run 'TestIsConvertibleOffice|TestSofficeArgs' 2>&1 | tail -15
```
Expected: 编译失败(`undefined: isConvertibleOffice` / `sofficeArgs`)。

- [ ] **Step 3: 实现 preview.go 的 helper + 转换函数**

Create `NimoOS/route/v1/preview.go`:
```go
package v1

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	nexec "github.com/NimoTech/NimoOS-Common/utils/exec"
)

var convertibleExts = map[string]bool{
	".doc": true, ".wps": true, ".xls": true, ".ppt": true, ".pptx": true,
}

// soffice 每个进程 ~200MB、~3s 启动;串行化避免并发起多个。转换是慢操作,
// 但各 HTTP 请求在各自 goroutine,此锁只护 soffice 生成,不阻塞其它 API。
var sofficeGate sync.Mutex

const sofficeTimeout = 120 * time.Second

func isConvertibleOffice(ext string) bool {
	return convertibleExts[strings.ToLower(ext)]
}

// 私有 UserInstallation profile 避开 LibreOffice 全局 profile 锁死;profile 放 outdir 内,随清理一并删。
func sofficeArgs(profileDir, outdir, src string) []string {
	return []string{
		"--headless",
		"-env:UserInstallation=file://" + profileDir,
		"--convert-to", "pdf",
		"--outdir", outdir,
		src,
	}
}

// convertOfficeToPDF 把 src(旧版 Office)转成 PDF 字节返回。临时目录 defer 删除——
// 成功/失败/超时都不留残留(不缓存)。任何失败返回 error,调用方降级为「无法预览+下载」。
func convertOfficeToPDF(src string) ([]byte, error) {
	outdir, err := os.MkdirTemp("", "nimoos-preview-")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(outdir)
	profileDir := filepath.Join(outdir, "lo-profile")

	sofficeGate.Lock()
	defer sofficeGate.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), sofficeTimeout)
	defer cancel()

	cmd := nexec.CommandContext(ctx, "soffice", sofficeArgs(profileDir, outdir, src)...)
	if cmd.Err != nil { // safetext 拒绝了某个参数
		return nil, cmd.Err
	}
	out, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("soffice failed: %w (%s)", err, string(out))
	}

	// LibreOffice 通常写 <basename>.pdf;偶发命名不同 → 兜底扫 outdir 里第一个 .pdf。
	base := strings.TrimSuffix(filepath.Base(src), filepath.Ext(src)) + ".pdf"
	data, err := os.ReadFile(filepath.Join(outdir, base))
	if err != nil {
		entries, _ := os.ReadDir(outdir)
		for _, e := range entries {
			if !e.IsDir() && strings.EqualFold(filepath.Ext(e.Name()), ".pdf") {
				data, err = os.ReadFile(filepath.Join(outdir, e.Name()))
				break
			}
		}
	}
	if err != nil || len(data) == 0 {
		return nil, fmt.Errorf("soffice produced no pdf output")
	}
	return data, nil
}
```

- [ ] **Step 4: 跑测试确认 GREEN**

Run:
```bash
cd /home/nimo/NimoTech/NimoOS && CGO_ENABLED=1 go test ./route/v1/ -run 'TestIsConvertibleOffice|TestSofficeArgs' 2>&1 | tail -8
```
Expected: PASS(`ok ... route/v1`)。

- [ ] **Step 5: 写真 soffice 集成测试(build tag)**

Create `NimoOS/route/v1/preview_integration_test.go`:
```go
//go:build integration

package v1

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

// 真 LibreOffice 端到端:先用 soffice 自己造一个 .doc,再 convertOfficeToPDF 转回 PDF。
func TestConvertOfficeToPDF_RealSoffice(t *testing.T) {
	if _, err := exec.LookPath("soffice"); err != nil {
		t.Skip("soffice not installed")
	}
	dir := t.TempDir()
	txt := filepath.Join(dir, "src.txt")
	if err := os.WriteFile(txt, []byte("hello preview test"), 0o644); err != nil {
		t.Fatal(err)
	}
	// 造 .doc
	if err := exec.Command("soffice", "--headless", "--convert-to", "doc", "--outdir", dir, txt).Run(); err != nil {
		t.Fatalf("build .doc: %v", err)
	}
	doc := filepath.Join(dir, "src.doc")
	data, err := convertOfficeToPDF(doc)
	if err != nil {
		t.Fatalf("convert: %v", err)
	}
	if len(data) < 4 || string(data[:4]) != "%PDF" {
		t.Fatalf("expected PDF magic, got %d bytes prefix %q", len(data), string(data[:min(4, len(data))]))
	}
}

func min(a, b int) int { if a < b { return a }; return b }
```

- [ ] **Step 6: 跑集成测试(soffice 已装)**

Run:
```bash
cd /home/nimo/NimoTech/NimoOS && CGO_ENABLED=1 go test -tags integration ./route/v1/ -run TestConvertOfficeToPDF_RealSoffice -v 2>&1 | tail -12
```
Expected: PASS(真转换出 `%PDF`);若机器无 soffice 则 SKIP。

- [ ] **Step 7: Commit**

```bash
cd /home/nimo/NimoTech/NimoOS
git add route/v1/preview.go route/v1/preview_test.go route/v1/preview_integration_test.go
git commit -m "feat(file): convertOfficeToPDF 旧版 Office→PDF(LibreOffice,串行/私有profile/超时/转完即删)"
```

---

