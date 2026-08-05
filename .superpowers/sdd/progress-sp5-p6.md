# SP5-P6 终端+日志 执行台账

计划: NimoOS-UI/docs/superpowers/plans/2026-07-22-vue3-migration-sp5-p6-console.md
基线: New-UI master@f8de371 · Service master@df4ba49
(开工前顺手单独提交了 P5 遗留的 YamlEditor 内边距 polish = f8de371)

## 任务状态

- [ ] T1 Service compose.containers 类型化
- [ ] T2 composeSettings 两修复(纯函数)
- [ ] T3 设置表单 UI(command 引导 + 网络禁用)+ i18n
- [ ] T4 tokenExpiry 提升 + terminalSocket 纯模块
- [ ] T5 xterm 依赖 + TerminalPane
- [ ] T6 useAppLogs + LogsPane
- [ ] T7 AppConsolePage + 路由 + 卡片入口
- [ ] T8 收口(回归/部署/台账/roadmap)

## Minor findings 汇总(留终审裁)

(暂无)

T1: complete (Service df4ba49..3bf15b3, review clean/Approved)
  Minor(终审裁): TDD RED 阶段 4 用例仅 2 个真失败(happy-path/非404重抛旧代码本就满足)——叙述性,不影响正确性
T2: complete (New-UI f8de371..47766f6, review clean/Approved)
  Minor(终审裁): ①string-original 编辑成空 tokens 无专测(现测用 array-original);②dict单网络+network_mode 并存组合无专测(代码正确 by inspection)
T3: complete (New-UI 47766f6..8b671b2, review clean/Approved)
  Minor(终审裁): ①单网络 guard 测试无 RED 阶段(纯回归守卫);②command hint 无 token 时也显示(plan 如此,且符合"事前引导"意图,非缺陷)
T4: complete (New-UI 8b671b2..3fcd252 两提交, 修复轮=close-during-refresh 代际守卫, 复审 Approved)
  Minor(终审裁): ①close() 二次调用重复发 closed(幂等无害);②并发 connect() 无守卫(T5 单发使用);③refresh 拒绝分支未 gate 代际(冗余 closed 发射,惰性一致)
T5: complete (New-UI 3fcd252..0b52b12, review clean/Approved)
  Minor(终审裁): ①TerminalPane.connect() 无重入守卫(现有两调用点被 status 门控,安全);②new WebSocket 同步抛无 try/catch(T4 遗留,恶意 URL 才触发)
  实现者备忘: vi.fn 箭头工厂不可 new(T6/T7 写 mock 注意用 function 表达式)
T6: complete (New-UI 0b52b12..591d632, review clean/Approved)
  ⚠️带进T7: LogsPane 无 appId watch——T7 必须按 id key 组件(或整页内容 key),防路由参数原地变化残留旧日志
  Minor(终审裁): XSS 测试用 appId 'a' 与同文件 'a1' 不一致(无功能影响)
T7: complete (New-UI 591d632..7ace966 两提交, 修复轮=load() mySeq 序号守卫防快速切换竞态+乱序回归测试, 复审 Approved)
  Minor(终审裁): ①seq 守卫注释写"module-scoped"实为实例闭包作用域(行为正确,注释不精确);②vitest.setup.ts 加 @xterm 全局 mock(lottie-web 同款先例,复审已核不遮蔽逐文件 mock)

## T8 收口(2026-07-22)

- 双仓全量回归:Service 117/117 + tsc build 绿;New-UI 210 文件/1154 测试 + vue-tsc 0 + vite build 绿(pnpm install 已刷共享包快照)
- 主题字面量自查:仅 TerminalPane xterm JS 主题对象一处(带注释豁免,与 --console-bg 同值)
- 整支终审(fable)= **Ready to merge (Yes)**:七条跨任务接缝全过(双 socket 窗口/轮询泄漏/token 新鲜度/写回刹车/i18n parity/渲染注入/用户决策贯彻);13 项 ledger Minor 全裁 accept
- 终审 follow-up 三小修(341e8cd):①服务切换在日志 tab 时强制回终端 tab(隐藏 fit → 80×24 PTY 锁死);②日志轮询 tick 在途守卫(防乱序旧日志回闪);③seq 注释 module→instance 措辞
- 终审记债(非本期):终端 token 走 WS query string 是后端契约(route/v1.go:77 QueryParam),会进网关/后端访问日志——后端票:改 ticket/subprotocol 握手
- 已部署 /app/(deploy.sh,GET 200)

**最终坐标:New-UI `master`@341e8cd(f8de371..341e8cd 共 8 提交,含开工前 P5 遗留 polish f8de371)、Service `master`@3bf15b3(1 提交)**

T8: complete(待用户真机验收后关账)

## 验收轮补丁(2026-07-22)

- **补丁①(后端,AppManagement main@bfe4390,已部署重启)**:容器停止后终端假活根因——DockerTerminal 的容器→WS 转发协程 EOF 退出但从不关 WS(且 WsReaderCopy 写死管道错误被忽略,Common helper.go:407),浏览器永远收不到 close。修=WsWriterCopy 返回后主动 conn.Close(),前端现成断开遮罩即刻弹出。Vue2 同病,此修两边同吃。注:SSH 终端(core wsssh)同款隐患,归 SP9 顺修。
- **补丁②(New-UI master@3112acb,已部署)**:设置页「YAML」标签页——验收澄清:用户否决的是 YAML 内启发式检查,不是标签页本身。useAppSettings 扩 toYaml/replaceFromYaml/saveYaml+parseError(serializeModel 抽共享);双 tab 互斥渲染(表单/ YAML 保存钮结构性不可能相撞);form→yaml 带修改、yaml→form 解析失败阻断且保留编辑;YAML 保存同 dry_run→PUT 管线,冲突红条列端口;appsSettingsNetworkMulti 文案改指 YAML 标签页。⛔ 无任何前端内容检查。评审 Approved(三条命名风险全核过)。全量 1165 绿。
- 挂机 >3h 说明已给用户:token 3h 过期只影响“新建连接”那一刻,连前预刷新已兜住;已开终端不受影响。

**最终坐标更新:New-UI `master`@3112acb、Service `master`@3bf15b3、AppManagement `main`@bfe4390(领先 origin,用户自推)**
- **补丁③(New-UI master@HEAD,已部署)**:YAML 编辑器/日志面板滚动条可见可拖——两个根因:①CM6 `.cm-scroller` 未开 overflow:auto,内容一长是外层盒子滚走整个编辑器(gutter 跟着跑);②全局滚动条拇指色随主题翻转,浅色主题下深拇指落在固定深底(monokai/--console-bg)上不可见。修=CM6 固定高度标准配方(scroller 内滚,外层 hidden)+ 新 token `--console-scroll-thumb(/-hover)` 两主题块同值亮色(console-bg 同款先例)。YamlEditor+LogsPane 同吃。
- **补丁④(New-UI,已部署)**:YAML 编辑器滚动条真身——补丁③只修了样式,真根因=高度链断:apps-layout 只有 min-height:100%(内容驱动),editor height:100% 分母是 auto→编辑器随内容长高永不内部溢出,滚的是整页。修=YAML 标签激活时 .apps-layout.yaml-mode{height:100%}+.apps-main{min-height:0} 定高,编辑器内滚;表单/其它标签保持文档式整页滚。设置页+自定义安装页(同病)一起修。教训:滚动条不出现先查"谁在滚"(高度链),再查样式可见性。
- **补丁⑤(New-UI,已部署)**:终端/日志面板从写死 480px 改 flex 占满剩余空间(控制台页整体切定高布局 height:100%,同补丁④分母原理);终端受益=连接时 fit 量到更大可视区,PTY 行列数随之更大。min-height:320px 兜底极矮视口。
- **补丁⑥(New-UI,已部署)**:滚动条穿圆角修复(用户截图实锤)——WebKit `::-webkit-scrollbar-track { margin: <radius> }` 让轨道两端避开圆角,滚动条只落直边段(YamlEditor 让 var(--radius)=28px,LogsPane 让 12px;轨道 margin 只在滚动条自身轴向生效,横竖条都对)。终端天然免疫=xterm 内容区 inset 8px。答用户"复用"问:yaml/logs 本就共用同组 --console-scroll-thumb token,差异只在容器圆角几何。
- **补丁⑦(New-UI@e32b0f7,已部署)**:YamlEditor 圆角 28px(--radius 卡片档)→12px,与终端/日志面板统一(用户拍板);滚动条轨道让位同步改 12px。自定义安装页的 YAML 编辑器同组件跟着变。背景事实(答用户问):项目只有颜色是强制 token,圆角仅大卡片档有 token(--radius 28/--radius-sm 18),中小控件 6-16px 全是手写字面量——深底控制台面板档今后按 12px 惯例走。
- **补丁⑧(双端,已部署)**:①**后端修 PTY 尺寸从未生效**(AppManagement@HEAD)——CreateContainerShellSession 只设 Env COLUMNS/LINES(shell 多不理会),从未调 ContainerExecResize,内核 PTY 恒 80x24;480px 小窗时代 xterm≈80 列碰巧掩盖,补丁⑤全屏后 200 列错位显形=「长命令提前换行、退格删不净上一行」(上键历史正常=shell 功能与宽度无关)。修=attach 后补 ContainerExecResize(TIOCSWINSZ),尺寸失败仅告警不断会话。②**终端滚动条归队**(New-UI)——xterm-viewport 原用全局主题翻转滚动条(深底隐形隐患)+host 四边 inset 8px;改 token 亮拇指同款配方,host 右侧贴边,track margin 4+inset 8=距框上下 12px 右 3px,与 YAML/日志逐像素对齐(YAML/日志本就同数,异类是终端)。
- 验收补丁⑨ (306f257): 用户要求滚动条与边框距离整体加大——三面板统一改为:scrollbar 宽 16、拇指透明边框 5px(两侧间隙 3→5px)、轨道端距 16px(终端 = host inset 8 + track margin 8;日志/YAML = track margin 16)。纯 CSS,console 测试 18/18 + vue-tsc 通过,已部署。
- 验收补丁⑨-2: 用户反馈 16px 版"没区别"(部署核实无误,应是缓存+幅度太小)→ 再加大一档:两侧间隙 8px(width 22/border 8)、上下端距 22px(终端 inset 8 + margin 14)。已部署并在产物 CSS 中核实 3 处 width:22px。
- 验收补丁⑨-3 (真根因): 用户截图证明滚动条始终是"细条贴角"——Chrome 121+ 一旦设置标准 scrollbar-width/scrollbar-color 就整个忽略 ::-webkit-scrollbar 定制,此前所有宽度/边距调整从未生效(只有颜色生效)。修复:标准属性包进 @supports not selector(::-webkit-scrollbar)(仅 Firefox 生效),三面板同改。教训:滚动条两套写法混用时,Chrome 新版以标准属性为准并禁用 webkit 定制;"改了没变化"要先确认规则是否真的命中。
- 验收补丁⑨-4 (最终根因+换方案): theme.css 对 * 全局设置标准 scrollbar-width/color → Chrome 121+ 对全应用禁用 ::-webkit-scrollbar 定制,组件级 @supports 守卫挡不住全局规则;且标准滚动条贴死滚动容器边缘、无属性可调间距。放弃 webkit 定制,改容器内缩:终端 host inset 10px、日志 pre margin 右/下 10px、YAML .cm-editor padding 上右下 10px(cm-content 上下 padding 相应收到 2px);删除全部死 webkit 块。教训:全局 * 级标准滚动条属性会让整个应用的 webkit 滚动条定制变死代码;调滚动条间距的通用解是缩滚动容器,不是改滚动条。
- 验收补丁⑨-5 (d9b8fca): 用户反馈两处不对称——终端滚动条下端离框远(xterm 整数行余数堆底部→term-host 列向 flex 垂直居中对半分);YAML 水平滚动条左端贴框(内圈 padding 此前没缩左边→.cm-editor padding 补齐四边 10px,gutter 自身 padding-left 10→4)。测试 18/18,已部署。
- 验收补丁⑨-6 (ea51c56): 日志 Refresh 取消独占顶栏 → 右上角悬浮小按钮(透明底/半透明/hover 提亮,与终端 ⛶ 同款);错误信息悬浮左上角;pre 补 margin-top 10px。测试 18/18,已部署。
- 验收补丁⑨-7: Refresh 悬浮按钮恢复实体样式(chip 边框底色),right 12→28px 让开滚动条;disabled 半透明。已部署。
--- P6 关账(2026-07-22):全量 210 文件/1165 用例 + vue-tsc 双清;roadmap 已记补丁③–⑥(d5b91d6d);memory 已更新。终坐标:New-UI master@dff28c4、AppManagement main@30dff84、Service master@3bf15b3。
