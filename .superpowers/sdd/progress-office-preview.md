# 旧版 Office→PDF 预览 进度台账

plan: NimoOS-UI/docs/superpowers/plans/2026-07-07-office-preview-conversion.md
spec: NimoOS-UI/docs/superpowers/specs/2026-07-07-office-preview-conversion-design.md
bases: core NimoOS bc67419 (branch feat/office-preview) · Service d217c6b (sp3-shared-http) · New-UI 69027db (master)

## 任务进度
Task 1: complete (core bc67419..4c0b41c, review clean/PASS) — convertOfficeToPDF + isConvertibleOffice + sofficeArgs(route/v1/preview.go);defer RemoveAll 全路径清理、mutex 串行、120s 超时、失败三模式、safetext cmd.Err 检查、私有 profile 在 outdir 内。纯测 RED→GREEN + 真 soffice 集成 PASS(Task 1: complete (core bc67419..4c0b41c, review clean/PASS) — convertOfficeToPDF + isConvertibleOffice + sofficeArgs (route/v1/preview.go); defer RemoveAll 全路径清理、mutex 串行、120s 超时、失败三模式、safetext cmd.Err 检查、私有 profile 在 outdir 内。纯测 RED→GREEN + 真 soffice 集成 PASS(输出 %PDF)。CGO build 0。
Task 2: complete (core 4c0b41c..7396206, review clean) — GetFilePreview 处理器 + /v1/file/preview 路由;校验顺序 path→checkPathAccess→ext→soffice LookPath→convert;成功 ctx.Blob(pdf)、错误 Result JSON、soffice 缺失 SERVICE_ERROR 降级。两校验测试(echo httptest)。build 0。测试加 logger init(test-only,prod main.go 已 init)。
Task 3: complete (Service d217c6b..e62a4bc, review clean) — file.getPreviewBytes(/file/preview, arraybuffer, timeout 150000, 不 unwrap);65 全量 + tsc0;New-UI pnpm install(lockfile 未变)。
Task 4: complete (New-UI 69027db..7b94179, review clean) — panelMap: pdf-viewer=['pdf','doc','wps','xls','ppt','pptx']、doc-viewer=['docx']、excel-viewer=['xlsx','csv'](xls 移出);删未用 import;480 全量 + tsc0。
Task 5: complete (New-UI 7b94179..f996da3, review clean) — PdfViewer isConvert=fileExt!=='pdf' 选源(office→getPreviewBytes/pdf→getBytes)+ 转换态文案 filesViewerConverting;pdfjs 渲染/滚动/缩放/页码逻辑未动;480 全量 + tsc0 + build ok。
Task 6(收尾): 前端已 build+deploy /app/ HTTP 200(含 5844a75 终审 Minor#1 修:转换失败文案区分)。core 需用户 sudo 部署(deploy.sh nimoos)。core build 本地核验 OK。
终审(opus)=Ready to deploy,无 Critical/Important。Minor:①转换失败文案(已修 5844a75)②并发预览可能超 150s(串行设计,可接受,记验收)③无 file-exists 预检(可选,soffice fail-fast,跳过)。
待用户:①sudo 部署 core ②真机验收。

## 真机部署 + 修复(2026-07-07)
- 配 scoped 免密 sudo(/etc/sudoers.d/nimoos-deploy:nimo 对 systemctl nimoos*/cp 到 /usr/bin/nimoos* 免密),deploy.sh 可跑。
- core 部署后首次 curl /v1/file/preview → HTTP 500「文档转换失败」2ms。根因:NimoOS-Common safetext exec 包装(nexec)对带空格文件名(新建 DOC 文档.doc)报 "Shell Injection Detected",soffice 未运行即返回(repro 定位 arg[6]=路径)。
- 修(core ed32626):convertOfficeToPDF 改用标准库 os/exec(分参数经 execve、无 shell、无注入;路径已 checkPathAccess;同 migrate.go 对 rsync/docker 路径)。集成测试文件名改带空格回归。
- 重部署 core → curl /v1/file/preview(新建 DOC 文档.doc)= HTTP 200 application/pdf 174323 bytes %PDF 0.63s,临时目录零残留 ✓。
- 待用户浏览器验收 .doc/.xls/.ppt/.pptx 渲染。
坐标:core feat/office-preview@ed32626、Service sp3-shared-http@e62a4bc、New-UI master@5844a75。
