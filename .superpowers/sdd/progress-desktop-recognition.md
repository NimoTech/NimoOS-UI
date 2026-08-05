# 桌面 Docker 应用识别 — SDD 台账

**★ 已收尾(2026-07-15):用户真机验收通过**(图标+小组件自动上桌、深色模式修复确认"现在好了")。
交付:功能三仓落库 + 开发者文档 `docs/nimoos-app-label-spec.md` + **AI 专用规范 `docs/nimoos-app-ai-spec.md`(c8a81bd,给编程助手生成合规应用用)** + 示例容器 examples/demo-widget。
最终 HEAD:AppManagement feat/desktop-label-recognition @ 94774ee(未合 main,用户自定)· Service sp3-shared-http @ 11072fa · New-UI master @ c8a81bd。
演示容器 nimoos-demo-widget 仍在跑(:18080),清理:`sudo docker rm -f nimoos-demo-widget`。

Plan: NimoOS-UI/docs/superpowers/plans/2026-07-15-desktop-app-recognition.md
Spec: NimoOS-UI/docs/superpowers/specs/2026-07-15-desktop-app-recognition-design.md

起始坐标(2026-07-15):
- NimoOS-AppManagement main @ 788ff96(T1 起在 feat/desktop-label-recognition 分支)
- NimoOS-Service sp3-shared-http @ 600626a
- NimoOS-New-UI master @ 4035f9c

## 终审(opus,三仓整支)= Ready to merge(With fixes → fixes 完成 → Yes)
- 无 Critical。Important #1(autoPin 遇 200-空 appgrid 持久化清桌,docker 5s 枚举超时可触发)+ Minor 死代码 + Minor 测试 mock 对齐 → 已修 5de119e,复审确认(守卫语义/测试锁定/无新问题)。
- 记债(留):GridItem appwidget label 死分支;AppTile paused/restarting 也变暗(产品意图待确认);Go 测试双重等价判断;clampWidgetDecl 条件冗余;widget 声明但缺 nimoos.port → 无重试按钮的"无法连接"死角(配置错误场景,文档已提示);docker **部分**枚举失败(非空子集)仍会误 prune(固有局限)。
- 无效:AppIframeWidget src 翻 null 需手动重试(有重试按钮,可接受降级)。
- 建议真机验收加一条:重启 docker 观察守卫实效(桌面不被清)。

最终坐标:AppManagement feat/desktop-label-recognition @ 94774ee · Service sp3-shared-http @ d02efe8 · New-UI master @ 5de119e

## T12 部署(2026-07-15,用户授权)
- 后端:deploy.sh app-management → v1.9.3-alpha1+2.g94774ee 运行中
- 前端:New-UI deploy.sh → /app/ 200、/app/widget-kit.css 200(3459B)
- 冒烟:demo 容器(sudo docker,nimo 不在 docker 组)→ appgrid 返回 desktop:true + widget{path:/widget/,w:2,h:2} + title 演示小组件;widget 页/icon 均 200,页面含 nk-* 类
- 待用户浏览器验收:spec §8 八条 + docker 重启守卫实测
- **真机验收踩坑修复(2026-07-15)**:用户浏览器不显示 → 日志证实浏览器拿到 200+完整数据 → 根因 = **appgrid 生产响应是裸信封 {data,message} 无 success 字段,共享包 getGrid 先走 unwrap 必抛** → loadGrid 静默失败,容器应用从未进过 New-UI apps store(长期潜伏 bug,P3 file.ts 同款坑复现)。修:getGrid 先容忍 data 直取(Service @ 11072fa,79/79),New-UI pnpm install+redeploy(bundle index-Cz3fQAIj.js)。教训:信封坑单测测了三种形态,漏了生产真实形态——凡对接非标准信封端点,先 curl 真机响应写进测试。用户手删容器后 docker start 报 No such container = rm 已删本体,需重新 run(已解释)。
- **真机验收踩坑 2(白底白字,已修)**:蓝色模式小组件白底白字。根因两层:① widget 页(iframe)没声明 color-scheme,与桌面(dark)不一致 → Chrome 给透明 iframe 强制垫不透明白底 → kit 加 `color-scheme: dark`/light 同步声明(db5ae10);② 修复后仍白 → **网关静态服务器 Last-Modified = 进程启动时间**(所有文件同一时间戳),浏览器 If-Modified-Since 永远 304,固定文件名的 widget-kit.css 缓存永不更新(index.html 有 no-store、JS 带哈希故未受害)→ 重启 gateway 提升时间戳解当前局 + kit 引用模板统一加 `?v=2` 版本参数(aa579cb,demo 容器已重建)。**记债:NimoOS-Gateway 静态伺服应改用文件 mtime 做 Last-Modified**(影响所有固定名静态资源的更新分发)。

## 2026-07-16 行为变更:停止就消失(用户拍板)
- 用户反馈:容器关闭后图标+小组件仍留桌面须手动清理。原 spec"stopped 保留变暗"是有意设计,经用户确认改为**停止/删除均自动消失**。
- 修复(New-UI):① `apps.desktopDecls()` 只算 running 容器(status 缺省视为运行);② `layout.autoPin()` 用 **45s 缺席宽限期去抖**(missingSince Map)替代原"全空守卫"——同时修掉"删除最后一个 desktop 应用永久残留"的记债(5de119e 已知代价)。抖动/短暂 restart <45s 不清桌,真停止约 1 分钟内消失,重新 run ≤30s 回桌(位置重排)。
- 两份规范文档(label-spec §补充 / ai-spec 行为模型)已同步改。后端不动(appgrid 仍返回停止容器,老 UI 应用列表依赖)。
- 记债状态更新:"docker 部分枚举失败(非空子集)误 prune"从"立即误清"降级为"持续缺席 >45s 才误清,恢复后自动回桌"(仍是固有局限,危害已大幅缩小)。

## 2026-07-16 追修:明确停止立即清理 + 无头浏览器闭环验证
- 用户复测反馈"停止后灰图标仍需手动清"。取证(服务端 home_layout/home_seen_apps + Playwright 无头驱动真实 /app/ 页):**上一版修复本身生效**(停止后 ~60-75s 清理并持久化),用户现象 = ①seen 旧记忆致运行中不再自动上桌(历史状态,清理后自愈)②强刷重置内存计时器 + 未等满宽限期。
- 追加改进:`stoppedDesktopKeys()`(exited/dead)→ autoPin 第三参**立即清理**——后端积极报告的停止不是抖动,无需 45s 宽限;宽限期仅保留给"从列表彻底消失"(rm/枚举抖动)。restarting/paused 走宽限兜底。
- 无头验证(chrome-headless-shell 驱动部署版,截 Authorization 头走 localhost 免验):start→≤30s 图标+widget+iframe 上桌;stop→**下一次轮询即消失**并 POST 持久化。Dock 启动器仍列停止应用=既有语义,不改。
- AI 契约正本已迁 NimoOS-AI skill desktop-app-builder:同步 SKILL.md+app-contract.md,**BuiltinSeedVersion 8→9**,已部署 ai 服务并确认 .version=9 落盘。New-UI @9d59048 已部署。

## Minor findings(留给终审 triage)

## Log
Task 1: complete (commits 788ff96..7074dda, review clean) — ParseDesktopLabels 4/4. Minor: WidgetH 注释不对称(留终审)
Task 2: complete (commits 7074dda..527535d, review clean) — ApplyDesktopMeta + MyAppList 5 字段 + 裸容器分支接线, 9/9. Minor: 部分 label 子集用例缺(低风险)、测试 Icon:"" 冗余
Task 4: complete (NimoOS-Service 600626a..d02efe8, review clean) — AppGridItem 加 desktop/widget 类型, 78/78
Task 11: complete (New-UI a5dd7f5..05561ff, review clean, 零 issue) — widget-kit.css + 开发者文档 + 示例容器,文档逐条对照实现核实
Task 10: complete (New-UI 6dd8434..a5dd7f5, review + fix + 复审) — AddPanel 应用小组件卡 + dupWidget 三处统一判重 + AppTile 停止态, 677 全绿。修复:status undefined 不变暗(a5dd7f5)。Minor(终审 triage): paused/restarting 也变暗(产品意图待确认);useOpenAction 'LinkApp' vs 后端 'link' 大小写既有不一致
Task 9: complete (New-UI 0fc4214..6dd8434, review clean) — Home 30s 轮询+focus 刷新+loadServerSeen 接线, 674 全绿。Minor(终审 triage): autoPin 遇后端瞬时 200 [] 会拔掉全部已上桌 desktop 应用(下轮恢复但位置丢),T7 语义所致非本 diff 引入;DIMS 字面量与 useAddPanel 重复(brief 原文)
Task 8: complete (New-UI aa9bf9a..0fc4214, review + fix + 复审 + 测试补强) — appWidgetUrl + AppIframeWidget + WidgetCard/GridItem 接入 + i18n×4。修复:超时 timer 随条件失效清理 + 停止态重置 failed(46e417b);回归用例已验证旧代码变红(0fc4214)。Minor: GridItem label appwidget 分支不可达(WidgetCard 先接管,brief 原文如此);src 翻 null 且 failed=true 时恢复需手动重试(有重试按钮,可接受)
Task 7: complete (New-UI 04f5ebd..aa9bf9a, review clean) — autoPin + seen 双持久化, 667 全绿。Minor: layout.ts changed 死代码一行;autoPin 测试未按 layout.persist.test.ts 惯例 mock service+fakeTimers(留终审)
Task 6: complete (New-UI e74d7b4..04f5ebd, review clean) — appwidget kind + APP_WIDGET_SIZE + sizeOfItem + clampSize 签名升级, 662/662+tsc0
Task 5: complete (New-UI 4035f9c..e74d7b4, review clean) — apps store 透传 + clampWidgetDecl + desktopDecls + icon 绝对化, 7/7+tsc0. Minor: clampWidgetDecl 条件冗余(brief 原文如此)
Task 3: complete (commits 527535d..94774ee, review clean) — openapi desktop/widget + codegen 重生成(codegen/ 本仓 gitignore,生成物不入库=repo 惯例,deploy 构建用工作区生成文件)+ Container/V2 双适配器。Minor: 测试双重等价判断(en_us==DefaultLanguage)、V2 分支无独立单测(超本任务范围)。后端 T1-T3 完,AppManagement feat/desktop-label-recognition @ 94774ee
