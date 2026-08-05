# SP5-P2 执行台账
Plan: NimoOS-UI/docs/superpowers/plans/2026-07-20-vue3-migration-sp5-p2-store-browse.md
Spec: NimoOS-UI/docs/superpowers/specs/2026-07-20-vue3-migration-sp5-apps-design.md(§3.8 P2 决策)

## 任务进度
- [x] T1 纯工具(resolveAppText/mapStoreApp/filterStoreApps)
- [x] T2 appstore store
- [x] T3 /apps/store 列表页(路由/侧栏/分类/作者/搜索/卡片/空错载态)
- [x] T4 SnapCarousel + FeaturedStrip
- [x] T5 详情页(meta/markdown/截图轮播/放大)
- [x] T6 回归 + 部署 + 记账

## SDD ledger
- Task 1: complete (New-UI 71d4ae7..2ccc498, review clean; Minor: 实现者报告测试计数与 diff 不符,纯报告瑕疵非代码缺陷)
- Task 2: complete (New-UI 2ccc498..6545b50, review clean; Minor×3 记档: ①categories 与 listApps 同 Promise.all 耦合失败 ②空分类时 length 判缓存重复拉 ③catch 路径 console.warn 噪音)
- Task 3: complete (New-UI c3715fe, TDD RED→GREEN, apps+i18n 全 51 pass、vue-tsc 0 错;pending review)
- Task 3: complete (New-UI 6545b50..c3715fe, review clean; Minor×3 记档: ①StorePage 防抖 timer 无 onUnmounted 清理 ②StoreCard 空 title 兜底字形 ③CategoryBar :key 用 name 假设唯一)
- Task 4: complete (New-UI 6de694f, TDD RED→GREEN, apps+i18n+SnapCarousel 全 55 pass、tsc 0 错、全仓 186/868 pass;pending review。发现并修 2 处:①brief 参考实现 page() 未乐观翻转 atStart/atEnd,jsdom disabled 按钮拦截 click 致第二次点击测试假失败,已加乐观翻转+注释 ②预存 StorePage 用例因共用 CATALOG fixture 被 Featured 带渲染重复卡片撑爆,已把断言收窄到 .apps-grid)
- Task 4: complete (New-UI c3715fe..6de694f, review clean; 两处偏离验证通过: page() 乐观端点翻转、StorePage 测试改域到 .apps-grid。Minor×2 记档: ①SnapCarousel 槽内容自变尺寸不触发 recalc(T5 截图懒载注意) ②showFeatured 三与门只测了 search 腿)
- Task 5: complete (New-UI 1ded8da, TDD RED→GREEN,实现与 brief 逐字一致零偏离;apps+i18n 58/58 pass、全仓 873/873 pass、vue-tsc 0 错;pending review)
- Task 5: complete (New-UI 6de694f..1ded8da, review clean; Minor×2 记档: ①ESC 监听绑整个页面生命周期而非仅 zoom 打开期 ②loadDetail 中途无 loading UI——均承自计划参考代码)
- Task 6: complete — 全量 873/873 + vue-tsc 0 + build 绿;主题自查(71d4ae7..HEAD 新增行)零命中;deploy /app/ HTTP 200;roadmap SP5 段补 P0 收尾/P1/P2 三行
- SP5-P2 收官坐标:New-UI master@1ded8da(2ccc498..1ded8da 共 5 提交:T1 utils→T2 store→T3 列表页→T4 轮播/Featured→T5 详情页);共享包零改动

## Task 6 真机验收清单(待用户浏览器逐条验,jsdom 测不了的)
- [ ] /app/#/apps/store:商店列表出现(目录来自 store.nimoos.io);卡片 icon/标题/tagline/分类正确
- [ ] Featured 推荐带显示且可左右翻页(scroll-snap 贴齐、端点按钮禁用);已装应用带「已安装」徽章
- [ ] 分类 chips 切换 → 列表变化(后端过滤);地址栏 ?category= 同步,刷新后状态保持(深链)
- [ ] 作者下拉(全部/官方/NimoOS/社区)切换生效
- [ ] 搜索:输入即过滤(250ms 防抖);搜索时 Featured 带隐藏;无结果显示空态;清空恢复
- [ ] 详情页:点卡片进入;icon/标题/tagline/分类/开发者;描述 Markdown 渲染正常(链接/加粗/列表)
- [ ] 截图轮播:scroll-snap 横滑 + 翻页钮;点截图放大,再点/ESC 关闭
- [ ] 未装应用「安装」点击 → toast「安装功能将在下一期开放」;已装应用显示「已安装」徽章
- [ ] 深链直达 /app/#/apps/store/<id>(新标签打开)→ 详情正常、已装判定正确
- [ ] 侧栏:「应用商店」项在列表页与详情页都高亮;「已装应用」互切正常
- [ ] 窄屏(手机):侧栏抽屉、分类 chips 横滑、卡片网格单列、截图轮播可触摸滑动
- [ ] 浅色主题(data-theme=light)整页无发灰/白底穿帮
- [ ] 旧 UI 对照:/#/legacy 商店弹窗全程可用(安全网未动)
- 终审(opus, 71d4ae7..1ded8da):With fixes——2 Important(①SnapCarousel 内容后载端点钮失效 ②loadCatalog 乱序竞态)+2 修前 triage(③categories/listApps Promise.all 耦合 ④防抖无卸载清理)。单个 fixer 一次修齐 @4aea700(MutationObserver+capture load 监听 / mySeq 单调守卫含 finally / categories 自 catch 解耦 / onUnmounted clearTimeout),复审=Yes 全过,878/878+tsc 0。ride-along 6 项 Minor 留档本文件上方各 Task 行。
- 最终收官坐标:New-UI master@4aea700(2ccc498..4aea700 共 6 提交)、NimoOS-UI docs 分支@2e176350;已重新部署 /app/ HTTP 200

## 验收补丁轮(2026-07-20,用户首轮真机反馈)
- @606a028(880/880+tsc 0,已部署 /app/ HTTP 200):①FeaturedStrip 重做成 Vue2 同款富卡(16:9 thumbnail 定比占位防跳动+icon/标题行+安装钮/已装徽章,thumbnail 404 隐藏留占位底);②StoreCard 加「安装」钮(未装显示,@click.stop emit install→StorePage 占位 toast appsStoreInstallSoon,同详情页);③mapStoreApp 补 thumbnail 字段;④SnapCarousel 箭头 30→36px、字号 24、flex 居中+光学上移 1px(主页 Featured 与详情页截图同吃);⑤CategoryBar 窄屏(≤768px)chips 改 flex-wrap 多行(原横向溢出把过滤项挡屏外);⑥img 补 decoding=async、icon/thumbnail 加 --chip-bg 占位底(加载慢时有底色不空白)。
- 用户反馈中的非 bug 项:REQUIRE MEMORY 未显示=用户自己拍板的 §3.8-3 挂账 P4(spec 已记,非遗漏);「下一期要做自定义下载(自定义安装)」=已记账,spec 里排 P5,可视 P3 结束后提前。
- 验收轮2 @9080032(已部署):SnapCarousel 翻页钮改 swiper 风格——绝对定位覆盖轮播两侧、垂直居中 40px 圆钮、SVG 箭头(替换 ‹› 字符,矢量居中根治偏移);到端点整颗淡出(内容不足一屏时两侧都不出现)。截图放大镜光标方案待用户选(A 自定义光标/B 悬停遮罩图标/C 角落按钮)。
- 关账(2026-07-21 用户拍板):截图放大光标保持系统原生 zoom-in/zoom-out,不做 A/B/C 方案(用户:不改了,收尾)。**SP5-P2 收官,最终坐标 New-UI master@9080032**(2ccc498..9080032 共 8 提交:5 主体+终审修复+验收补丁两轮)。
