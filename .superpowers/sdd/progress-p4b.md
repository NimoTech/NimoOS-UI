# SP4-P4b 重查看器(PDF/Word/Excel)进度台账

plan: NimoOS-UI/docs/superpowers/plans/2026-07-06-vue3-migration-sp4-p4b-heavy-viewers.md
spec: NimoOS-UI/docs/superpowers/specs/2026-07-06-vue3-migration-sp4-p4b-heavy-viewers-design.md
base: New-UI c735bfd (master) · Service 21c2c52 (sp3-shared-http)

## 任务进度

Task 1: complete (端点验证) — GET /v1/file?path=/DATA/…md → HTTP 200 size=6808=原始大小,出完整原始字节 ✓。localhost 跳 JWT(符合预期);header 认证+401 自愈由源码已读实 + 真机>3h 项覆盖。回退方案未触发。
Task 2: complete (New-UI c735bfd..e98e476, review clean) — @vue-office pdf1.6.5/docx1.6.3/excel1.7.14 + vue-demi0.14.10,三包均声明 vue-demi peer 支持 Vue3,无需应急分支
Task 3: complete (Service 21c2c52..d217c6b, review clean) — file.getBytes(path):Promise<ArrayBuffer> GET /file arraybuffer 不 unwrap;13/13 file.test + 64 全量 + tsc0;New-UI 已 pnpm install(lockfile 未变,file: 依赖正常)
Task 4: complete (New-UI e98e476..b6710f0, review clean) — useOfficeBytes composable(三态/disposed 守卫,disposed 测经真 unmount 生命周期验证)+ 共享 CSS(viewers.css)+ 3 i18n 键;475 全量 + tsc0 + build ok
Task 5: complete (New-UI b6710f0..fffeff3, review clean) — PdfViewer(薄,委托 useOfficeBytes)+ panelMap pdf-viewer + registry;**build 门通过:vite build 解析 @vue-office/pdf OK**(Vue3/Vite 兼容已证实,chunk~2.1MB 懒加载);476 全量 + tsc0
Task 6: complete (New-UI fffeff3..c174ad1, review clean) — DocViewer(@vue-office/docx doc/docx/wps,薄)+ panelMap/registry doc-viewer;vite build @vue-office/docx OK;477 全量 + tsc0
Task 7: complete (New-UI c174ad1..a70d64e, review clean) — ExcelViewer(@vue-office/excel xls/xlsx/csv,薄)+ panelMap/registry excel-viewer;vite build @vue-office/excel OK;478 全量 + tsc0
Task 8: complete (New-UI a70d64e..81315e0) — panelMap 加 ppt/pptx→null 回归测试(Vue2 parity,无 resolveOpen.test.ts 故只此一处);全量 479/479 + tsc0 + vite build 绿(chunk 提示:PdfViewer~2.05MB/ExcelViewer~1.68MB 超 500kB 警告,非阻断,懒加载已生效);`bash scripts/deploy.sh` 部署 /app/,`curl /app/` → HTTP 200;bundle grep 命中 DocViewer/ExcelViewer/PdfViewer/index chunk,查看器码确认在 bundle。roadmap `docs/vue3-migration-sp3`@**f86c068a** 已加 P4b✅ 行(仅改 roadmap 一个文件,未碰仓内并行 auth/home 未提交改动)。

## ✅ SP4-P4b 完成(subagent-driven,2026-07-06)

- New-UI `master` HEAD = **81315e0**;全量 479/479 测试 + vue-tsc 0 + vite build 绿 + 部署 /app/ HTTP 200。
- 提交序:e98e476(@vue-office 依赖)→b6710f0(useOfficeBytes+样式+i18n)→fffeff3(PdfViewer)→c174ad1(DocViewer)→a70d64e(ExcelViewer)→81315e0(ppt→null 回归测试)。
- roadmap `docs/vue3-migration-sp3`@**f86c068a** 已勾 P4b。均本地无 remote,推 GitHub 由用户。
- 遗留 Minor:无(Task 1-7 各自 review clean;本任务范围内未发现新增 issue)。产物层面唯一提示是 rollup 的 chunk-size warning(>500kB),这是重库(pdf.js/exceljs 等)固有体积,已通过 registry 懒加载隔离,非本任务需处理项。

## 真机验收清单(交用户,jsdom 测不了)

- [ ] PDF:打开渲染、多页滚动、下载、关闭、ESC。
- [ ] Word(docx/doc/wps):渲染、下载、关闭。
- [ ] Excel(xls/xlsx/csv):渲染、多 sheet 切换、下载、关闭。
- [ ] 损坏/超大文件 → error 态 + 「改为下载」可用。
- [ ] **挂机 >3h 后打开重文件** → 自动刷新成功打开(验 401 自愈,相对 Vue2 的关键改进)。
- [ ] ppt/pptx 点击 = 直接下载(不弹查看器)。
Task 8: complete (New-UI a70d64e..81315e0 test 回归 + NimoOS-UI f86c068a roadmap tick[仅 roadmap.md,auth/home 未动], review clean) — ppt/pptx→null 回归;479 全量 + tsc0 + vite build ok;deploy /app/ HTTP 200;bundle 含 Pdf/Doc/Excel viewer chunk

== 全部 8 任务完成,进最终整支评审 ==

## 最终整支评审(opus)= Ready to merge
无 Critical/Important。跨任务不变量全部验证:①一条刷新路径(getBytes /file→/v1/file arraybuffer,401 重放复用同 config→responseType 存活,>3h 自愈真生效);②真实路径仅进 API 不泄漏 UI(title 用 name);③disposed 守卫共享无漂移;④panelMap 三处(PanelType/filePanelMap/registry)Record 强制一致 7 键;⑤三查看器纯薄仅差 @vue-office import/tag;⑥download/close 接线正确,重查看器无翻页故无 stale-item;⑦ppt/pptx→下载 Vue2 对等(first vs last-match 等价:csv 不在 TEXT_CSS 的 tsv 里,三组互不相交)。
两条 Minor(均无需改码,真机验收核对):
  1. 加载遮罩若 @vue-office 某构建渲染但不发 @rendered 事件则 loading 遮罩不消失(jsdom 测不出)——真机重点验 **Excel .csv**(@vue-office/excel 1.7.14,CSV-via-ArrayBuffer 是六格式里最不确定的);发 @error 则走「改为下载」兜底。
  2. `list` prop 传入三查看器但未用(与可翻页查看器契约统一,intentional,保留)。

## 状态:代码完成 + 已部署 /app/ + 全评审通过。待用户真机验收(清单见上)。

## 真机验收修复轮(2026-07-06)
用户反馈:doc/docx 无法预览、pdf 要单页、xlsx 好、xlml 下载。
- **根因(systematic-debugging)**:用户的 new.docx/.doc 都是 OLE2 二进制(magic d0cf11e0,非 zip PK),docx-preview 只解 OOXML→必报 JSZip "not a zip"。**非代码 bug**。curl /v1/file 证实字节完整;真 .docx(PK)与 xlsx 同路径可渲染。jsdom 测不出(@vue-office 在 jsdom 不发 @error,误报 rendered=true)——magic bytes 是权威证据。
- **修**:①doc-viewer 只映射 .docx,.doc/.wps 落下载(panelMap ['docx'],去 APPLICATION_VND_MS_WORD import);②useOfficeBytes 加 errorDetail,JSZip/central-directory 错误→中文「旧版二进制/损坏」提示;③PdfViewer 弃 @vue-office/pdf 改 pdfjs-dist@6.1.200 单页(prev/next+页码+适宽,worker 走 ?url;loadingTask.destroy 清理;render 代次守卫防翻页竞态;getPage 全包 try/catch;errorDetail 对齐)。@vue-office/pdf 已移除。
- commits(New-UI master):9fbd068 pdfjs 单页、c53ad85 doc落下载+友好错误、7e9c640 终审修复(翻页竞态/getPage兜底/errorDetail)。480→更多测试通过,tsc0,build ok(worker asset 1.25MB .mjs 独立 chunk,PdfViewer 433KB),deploy /app/ 200。
- **评审(sonnet)findings**:3 Important(翻页竞态/getPage 未包 catch/PdfViewer 缺 errorDetail)已修;Minor 未做=**cMap/standard_fonts 未配置→非嵌入 CJK 字体 PDF 可能乱码**(待用户真机验中文 PDF;若乱码再用 vite-plugin-static-copy 拷 pdfjs cmaps 到 /app/cmaps 并设 cMapUrl)。
- **待用户真机验收**:PDF 单页+翻页+中文字体、真 .docx 渲染、.doc/.wps 下载、xlsx 回归。
