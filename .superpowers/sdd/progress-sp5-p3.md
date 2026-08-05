# SP5-P3 安装+进度 执行台账

- Plan: NimoOS-UI/docs/superpowers/plans/2026-07-21-vue3-migration-sp5-p3-install-progress.md(docs 分支 e6ed167f)
- 起点:NimoOS-New-UI master@9080032 / NimoOS-Service sp3-shared-http@c9a081d
- 排期决策(用户 2026-07-21 拍板):维持 spec 原顺序 P3→P4→P5(自定义安装不提前)

## 任务状态

(执行中逐条追加)

## Minor findings 汇总(留终审 triage)

- Task 1: complete (Service c9a081d..09c00ea, review clean; Minor×2 记档:①报告未显式记录消费方核查 ②New-UI 883 计数未注明来源——均文档措辞类,无代码问题)
- ⚠️ 工作树预先存在的非本期改动(勿动勿提交):src/files/{FileRow,FileTile}.vue、viewers/ImageViewer.vue(+新 ImageViewer.test.ts)——疑似用户在制品,即 883 vs 880 的 +3 来源
- Task 2: complete (New-UI 9080032..fc9e94e, review clean; ⚠️×2 仅记录:isCompatible/archLabel 每调重建闭包(共享 ref 单例,无碍)、HardwareInfo.arch 必填下的运行时防御属加固)
- Task 3: complete (New-UI fc9e94e..6d676ec 共 2 提交;首轮评审 Important×2(begin 不复活 error 任务/dismiss-probe 竞态)+Minor×2,fixer 修齐 @6d676ec,复审反向验证 Approved,15/15;观察点记档:error 复活不刷新 title/icon——spec 未要求,非缺陷)
- Task 4: complete (New-UI 6d676ec..949142c, review Approved; 必要偏离:两 i18n 文件加 export default(brief 测试用 default import)——Minor 记债:default 导出(拍平)与具名 messages(嵌套)形状不一致,双源风险,勿再模仿;T6/T7 接线注意 @update:open 只改 open 不清 app)
- Task 5: complete (New-UI 949142c..97902f4, review Approved; Minor×3 记档:①FeaturedStrip 模板每卡两调 progress()(T6 换真实现如重可 computed 去重) ②FeaturedStrip 缺 installed+progress 同真显式用例 ③disabled 不 emit 未显式断言;既有夹具补字段=必填 prop 必然,无夹带)
- Task 6: complete (New-UI 97902f4..84fc2ea, review Approved; ⚠️记档:①pinia 须显式进 mount global.plugins 的测试基建发现——仅 StorePage.test.ts 已改,其余文件老写法待统一收口 ②商店列表卡对 error 任务显示普通安装钮=既定分期设计(错误态在详情页/已装页可见))
- Task 7: complete (New-UI 84fc2ea..e601ff4, review Approved 零遗留;appsStoreInstallSoon 已删,全仓零引用;测试 mock 重构=功能必需,断言无弱化)
- Task 8: complete (New-UI e601ff4..c59dd07, review Approved; Minor×2 记档:①InstallingAppCard 的 :class err 是死绑定(无对应选择器) ②空 apps 时 apps-grid 渲染空节点(既有模式非新引入);D6 语义完整性已核:store 订阅挂单例生命周期,页面 onUnmounted 不解绑 store 侧)
- Task 9: complete — 回归 Service 107/107+build ✓ / New-UI 929/929+tsc 0 ✓ / 主题自查零命中 ✓ / deploy.sh ✓ HTTP 200 ✓ bundle 含新码 ✓
- 终审(opus, 9080032..c59dd07 + Service c9a081d..09c00ea):**Ready to merge**。F1(受理前事件竞态)已由后端源码关掉:ComposeService.Install(compose_service.go)写盘后 go func 才发 install-begin,POST 受理即返;F2(后端持续不可达时 installing 不超时)=T3 复审既定取舍;F3=InstallingAppCard err 死绑定(Minor)。全部 Minor triage:无一必须本期修,留 P4+(i18n export default 双源建议 P4 统一)。
- ⚠️ 部署包含用户并行提交 946c340(files 区 ImageViewer 缩放修复,用户自己的工作,非 P3)。

## 收官坐标(2026-07-21)
- NimoOS-New-UI `master`@`c59dd07`(P3 末提交;其上还有用户自己的 946c340)
- NimoOS-Service `sp3-shared-http`@`09c00ea`
- docs `docs/vue3-migration-sp3`@`e6ed167f`(P3 计划)
- 均本地未推,用户自推。

## 真机验收清单(P3,用户浏览器执行)
1. /apps/store 挑未装小应用点「安装」→ 按钮变「安装中 n%」,详情页同步进度条。
2. 安装期间切去首页再回 /apps → 顶部出现安装中卡片(进度还在推进)= 后台继续。
3. 装完:卡片消失、应用浮出已装列表、商店卡片变「已安装」徽章(不刷新页面)。
4. 挑带安装前须知的应用(如 actualbudget)→ 先弹「安装前须知」markdown,取消不装、确认才装。
5. 故意装端口冲突应用(与已装同端口)→ toast 提示被占端口(80/tcp 形),不发起安装。
6. 安装失败场景(可断网拉镜像)→ /apps 出错误卡(后端 message),「知道了」可清;详情页可重试。
7. amd64 机器上找 arm-only 应用(如有)→ 安装钮禁用 + 详情页「与本机架构(amd64)不兼容」。
8. 窄屏(<768px)复查商店卡/详情/安装中卡布局。
9. 浅色主题(data-theme=light)复查进度条/错误文案/弹窗配色。

## 验收补丁(2026-07-21,用户验收反馈)
- 🐛 补丁①@635c354(已部署,全量 935/935+tsc 0):用户报「卸载无提示、点两次图标才消失」。根因=后端启停/重启/卸载全是受理即返(SetStatus/Uninstall 内 go func),P1 store 在 POST 返回即 resolve:①「处理中」瞬间被清(视觉上无反馈) ②begin 挂的 30s 兜底定时器被取消,uninstall-end 一丢(buffer=1,卸载时容器事件洪峰易丢)→ 无人再刷新=图标永久残留,用户只能再点一次。修:setStatus/uninstall 受理后不收敛,pending 保持到 end/error 事件或 30s 兜底;uninstall-end 事件先 evict(图标立即消失)再重拉。update 保持原样(「已是最新」无事件,真更新由 update-begin 接管)。
- 📖 非 bug 解释②:用户问「install 后好久 0% 在干什么」——后端进度按「整层完成数/总层数」算(image.go pullImageProgress,只在 Pull complete 时 +1),大镜像第一层没下完前一直 0%,期间实际在拉取 Docker 镜像。行为与 Vue2 一致(同一事件源)。可选 UX 优化(未做,征用户意见):percent=0 时显示「正在拉取镜像…」替代 0%。
- 🐛 补丁②@081806a(已部署,939/939+tsc 0):用户报「刷新页面后进度条全消失、installed 里也没有、再点安装提示已在下载中」。根因=installProgress 任务表纯内存:刷新丢登记表,begin 早已发过不再来,后续 progress 事件被 D5 守卫(防 update 流污染)当陌生人丢弃 → 进度永久不可见;再点安装被后端 400(已存在)。修:任务表落 localStorage(key `nimoos:install-progress`,watch flush:sync 同步落盘),store 创建时恢复 + installing 任务重新武装 watchdog(页面关着时装完/装挂都由探测收敛);error 任务也随刷新恢复可 dismiss。顺带:useInstallFlow.test.ts beforeEach 补 localStorage.clear(持久化后跨用例串染)。
- 补丁③@d3b79b4(已部署,939/939):用户拍板「卸载确认框默认勾选删除用户数据」——推翻 P1 的「默认不勾」决定。每次打开重置回勾选;取消勾选仍可保数据。
- 补丁④@ffacc33(已部署,CSS-only):用户报安装前须知里整行长命令撑破弹窗。根因=markdown 围栏代码块渲染成 <pre> 默认不折行。修:PreInstallTips 与 StoreAppDetailPage 描述区 :deep(pre) 改 pre-wrap+break-all 框内折行 + overflow-wrap:anywhere 兜底长 URL/inline code;pre code 去重复底色。jsdom 测不了布局,真机眼验(bigbear 系应用 tips 可复现)。

## ✅ P3 用户验收通过关账(2026-07-21)
- 验收期补丁④轮:①@635c354 卸载收敛时序 ②@081806a 进度 localStorage 持久化 ③@d3b79b4 卸载默认勾删数据 ④@ffacc33 代码块折行。
- 收尾一并提交用户在制的文件区改动 @f035ea0(FavoriteStar 仅目录 + ImageViewer 拖拽夹边界,465/465 files 区绿)。
- **最终坐标:New-UI `master`@`f035ea0`(工作树干净)、Service `sp3-shared-http`@`09c00ea`、docs `docs/vue3-migration-sp3`@`e6ed167f`。均本地未推,用户自推。**
- 已部署 /app/ 与 HEAD 内容一致(最后一次 deploy 构建时已含全部改动)。
