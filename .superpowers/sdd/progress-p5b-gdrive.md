# SP4-P5b 增补:Google Drive BYO 凭据表单(2026-07-17)

Spec/plan:`NimoOS-UI/docs/superpowers/{specs,plans}/2026-07-17-vue3-migration-sp4-p5b-gdrive-byo*`(docs 分支 bdd6f357)。
用户拍板:任务简单,免 spec/plan 评审,直接执行(inline TDD,非 subagent-driven)。

Base:NimoOS-New-UI `master`@67303fb、NimoOS-Service `sp3-shared-http`@600626a。

## 任务

- [x] T1 共享包 `driver.googleDriveCustomAuth`(Service @3db8136,85/85 + build;RED→GREEN)
- [x] T2 `GoogleDriveAuthDialog.vue` + i18n 双语 6 键(New-UI @38b52d1;组件 5 测 + parity)
- [x] T3 FilesSidebar 分流(Google→表单框,Dropbox/OneDrive 照旧;`openAuthWindow` 抽出复用;New-UI @1907a69;分流 3 测)
- [x] T4 门禁+部署:全量 724/724、vue-tsc 0、build ok;deploy /app/ HTTP 200,bundle 含 `filesGdriveTitle`。

## 关键实证(开工前)

- 运行中 core 二进制已带 `POST /v1/driver/google_drive/auth`(curl:真值→标准信封 `{data:{auth_url}}`,auth_url 带 `${HOST}`+`state` 内嵌 sid)。
- **后端已知 bug(不修,记录)**:driver.go 错误分支 `ctx.JSON(common_err.INVALID_PARAMS=4000,…)`——4000 非法 HTTP 状态 → 实际 HTTP 200 空 body。前端 trim 非空校验使其不可达;共享包 unwrap 对空 body 抛错兜底。修它需 ldflags 重烤 core(保 Dropbox/OneDrive 烤入凭据),不值当。
- Vue2 参照与 GitHub origin/main 逐字节一致(GoogleDriveAuthModal/MountActionButton/driver.js 三文件 diff 空)。

## 真机验收(待用户,需其 Google Cloud 凭据,OAuth 往返无法代测)

侧栏「+」→ Google Drive → 弹表单(标题/提示/「如何获取?」链接开 `/guide/google-drive.html`)→
填凭据(Google 控制台 redirect URI 须为 `https://cloudoauth.nimopc.com`)→ 授权窗 → 授权后云盘区出现 + toast。
留空/纯空格不可提交;后端报错透出 message。Dropbox/OneDrive 回归:仍直接开授权窗。
