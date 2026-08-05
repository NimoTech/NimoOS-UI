# SDD ledger — plan: docs/superpowers/plans/2026-07-28-vue3-migration-sp7-p5-people.md

> ⚠ **本文件是抢救重建版(2026-07-30)。** 原件在 `NimoOS-UI/.superpowers/sdd/2026-07-28-vue3-migration-sp7-p5-people/progress.md`,
> 于 2026-07-30 的验收会话期间连同整个 `NimoOS-UI/.superpowers/` 目录一起从磁盘消失
> (`.superpowers/` 被 `.gitignore:45` 忽略 → git 无法恢复)。下方 Task 0–16 至「P5 收官」
> 各段是从会话上下文里的原文逐字回写,内容完整;**同目录的 17 份 task-N-brief.md、
> 17 份 task-N-report.md、final-fix-report.md 以及 SP7 全区台账 `progress-sp7.md`
> 未被读取过,无法恢复,已永久丢失**。评审 diff(`review-*.diff`,26 份)在本目录完好。
> 教训:gitignored 台账没有任何冗余,应与 P3/P4 一样在 `.sp7` 工作区留副本。

基线: New-UI sp7-photos@46ebcb8 (252 files/1652 tests), Service sp7-photos@3f346ad
Task 0: complete (Service 3f346ad..6275ead, review clean; minor deferred: 无 token+有 ver 组合用例缺)
Task 1: complete (New-UI 46ebcb8..6bc69f2, review clean; 27 新测试, 全量 253/1679)
Task 1: minor (deferred): 头注释「统一谓词」措辞略过;mergeReasonKey 的 params 类型可收紧
Task 1: 注意(带 T3): mergeReasonKey 用的键名 photosPeopleMergeReasonNamed/Unnamed 必须与 T3 键表一致(已一致)
Task 2: fix round 1/5 派出(3 必修:in-flight 探针测试/finally 身份守卫/三处偏离注释+错字;+2 便宜覆盖。裁定不改:_purgeTimers 模块作用域=计划要求)
Task 2: fix round 1/5 (4 addressed, 0 open; commits f9c0923..cf06885;复审用真实变异实验证明两条探针各自独立变红)
Task 2: complete (New-UI 6bc69f2..cf06885, review clean; 52 store 测试, 全量 254/1731)
Task 2: minor (deferred): timer 占位 unsafe cast;注释 '不reset' 缺空格;_purgeTimers 模块作用域(计划要求,裁定保留)
Task 2: 事实更正(带下游): brief 的 setPersonCover ?? null 写错了,Vue2 :1124-1125 是 !== undefined —— 实现已按 Vue2 纠正
Task 3: 首轮 DONE_WITH_CONCERNS(e334b2e,119 键)→ 控制器裁定后补做 3 项(dismiss aria 键 / detach 单复数 6 键 / 「集群」术语换成人物),评审前修
Task 3: complete (New-UI cf06885..96d6b10, review clean; 123 键双写, 全量 255/1743)
Task 3: minor (deferred): photosPersonUnknownPlace 中文「未知」为自拟(zh_CN.json 无裸 Unknown)
Task 3: 事实更正: brief 的 '{idx}/{total}' 少了空格,Vue2 原文是 '{idx} / {total}',已按源码
Task 4: 首个实现者 a7efcfb 被 API 额度中断(worldMap.ts+2 测试已落盘未提交, MiniMap.vue 缺);已查工作树实况后 resume 续做
Task 4: complete (New-UI 96d6b10..4b6207d, review clean; 9 新测试, 全量 257/1753)
Task 4: parked — viewBox 最小跨度钳制分支无覆盖(LON_PAD*2===MIN_LON_SPAN 致该分支仅在贴近 ±180/±90 时可达)— ruling: 继承自 Vue2 的测试盲区非本期回归,评审判 Approved,留 P6 复用时补边界点位测试
Task 4: minor (deferred): .mini-map-root 用 var(--card) 在浅色主题是白底(Vue2 只有深色设计),P6 视觉决策
Task 5: fix round 1/5 派出(1 必修:头像首字母/图标前景 --on-accent → 钉死浅色 + theme-exception;评审几何推演推翻「居中字形够不到暗角」,先例 PhotosAlbumDetail.vue:733)
Task 5: fix round 1/5 (1 addressed, 0 open; commits 3668123..2f5ed4a)
Task 5: complete (New-UI 4b6207d..2f5ed4a, review clean; 11 测试, 全量 258/1765)
Task 5: 教训(带下游): --on-accent 不能用于 --avatar-fallback 渐变实底;--line-stronger 不存在改用 --card-border
Task 6: 首轮 25f9516(32 用例,含变异检验)→ 控制器裁定后补做 3 项(补 2 个 i18n 键+悬停提示样式 / 收藏星标位置搬进 PersonAvatar 按 Vue2 几何 / 日期 locale 跟随 i18n),评审前修
Task 6: 评审(opus) Spec ✅ / quality Approved,4 条关键路径思想实验均能红;1 Important(公共组件星标固定 24px 小尺寸盖脸 + size=24→0px 断言把坏视觉钉成契约)+ 6 Minor
Task 6: fix round 1/5 派出(星标随尺寸缩放/top 参考系差 6px/卸载监听假绿测试/Named 头像缺发丝描边/叠层头像 32→28px/encodeURIComponent/漏登记注释)
Task 6: 发现(记录) photos-people.scss:165 的 .face-grid-md .fav-mark translateX(20px) 在 Vue2 是死代码(Named 分区只含非收藏项),故 84px 档从未绘制过
Task 6: fix round 1/5 (7 addressed, 0 open; commits e8042af..08d188e;复审独立重算 48/24px 几何确认星标已在圆外)
Task 6: complete (New-UI 2f5ed4a..08d188e, review clean; 手写用例 +37, 全量 259/1803)
Task 6: minor (deferred): 报告 §9.1 自验比值 0.92-0.94 与复审重算 1.12-1.15 不符(文档口径,结论方向不变);PersonAvatar 在 size=24 且 fav 时星标右缘溢出头像约 10px(当前无消费方,提醒 T7/T10/T13)
Task 6: minor (deferred): PhotosAlbums.vue:218 引用全仓无定义的 .btn-primary(既存缺陷,非本期引入)
Task 7: 首轮 72be7b6(24+18 用例)→ 控制器裁定 4 条界面 1:1 判断题:补装饰环 / 补 Name 标签(批新键 photosPersonNameLabel)/ 删除键改回 Vue2 实底红 / 两键拼句通过;评审前修
Task 7: fix round 1/5 (4 裁定项 addressed; commits 72be7b6..3650dc5)
Task 7: 评审 2 Important → fix round 2/5 派出(delete 头部标题错位丢 Vue2 一整句[补键 photosPersonDeleteClusterTitle,zh 避「集群」用「删除这组人脸」]/ delete 重入守卫测试假绿,要求删码验证)
Task 7: fix round 2/5 (2 addressed, 0 open; commits 3650dc5..910a37d)
Task 7: complete (New-UI 08d188e..910a37d, review clean; 25+42 用例, 全量 260/1838)
Task 7: 事实(带下游): Vue2 delete 弹窗是「头部标题 Delete face cluster」+「警示条自己的标题 Delete this person group? + br + 正文」两层;新键 photosPersonDeleteClusterTitle zh 用「删除这组人脸」避「集群」
Task 8: 首轮 b368664(+24 用例;移除两条装饰性守卫并做删码验证;PersonAvatar 加 shape 加性扩展)→ 控制器裁定:补真 nimo-logo.png 资产(New-UI 原本零 logo 资产),其余 4 条通过
Task 8: fix 轮被 API 额度二次中断(logo 资产已落盘+import/模板已改未提交, .mrd-logo CSS 未收尾);已查实况后 resume 续做;3 个新键经控制器核验合规(组 A/组 B 无「集群」)
Task 8: 评审 Spec ✅(logo 真资产 md5 一致/守卫移除论证经复核成立/index 钳制与 Esc 删码实测能红);1 Important=reviewOpen=false 那行无测试可证伪(生产码正确,覆盖漏洞;失效路径=T7 mergePersonInto finally 重拉建议致弹窗自弹)
Task 8: fix round 1/5 派出(只补一条回归测试 + 删码验证)
Task 8: fix round 1/5 (1 addressed, 0 open; commit 256bec0,仅测试文件 +32 行,生产码零改动,删码验证复现诊断)
Task 8: complete (New-UI 910a37d..256bec0, review clean; 全量 261/1863)
Task 8: 事实(带下游): store 的 accept/rejectMergeSuggestion 先同步 filter 再 await,是审阅弹窗防重入的隐式依赖(改顺序会失效,代码已注释)
Task 9: 首轮 86d7441(6 用例)→ 评审 1 Important:seq 守卫检查点②(Promise.all 后)零覆盖 —— 逐个删码才暴露(只删 :62 全绿),两处一起删的验证方式掩盖了盲区
Task 9: fix round 1/5 派出(补两组 deferred 控制 places/assets 的场景 + 逐个删码验证)
教训(方法论,带下游): 删码验证必须**逐个**删守卫,不能多处一起删 —— 否则前置守卫会遮蔽后置守卫的覆盖盲区
Task 9: fix round 1/5 (1 addressed, 0 open; commit f93def6 仅测试 +65 行;双向逐个删码验证:删 :62 → 新测试红、删 :54 → 原测试红)
Task 9: complete (New-UI 256bec0..f93def6, review clean; 全量 262/1872)
Task 10: complete (New-UI f93def6..c5f0ece, review clean 零 Critical/Important; 全量 263/1898)
Task 10: 三条自主偏离经评审逐条核实成立:①fallback 渐变不叠 blur/opacity(Vue2 scss:1420-1426 未解除父规则=真 bug)②scrim 用固定暗渐变而非 --bg(浅色 --bg=#f7f5ef 近白会洗白内容区,照 PhotosAlbumDetail.vue:598-601 先例)③钉死浅色取值落在仓内既有 .7~.92 区间
Task 10: TDD 期间靠删码验证发现真 bug:onDocKeydown 早退致两菜单同开时 Esc 只关一个,已修+测试钉住
Task 10: minor (deferred) 交终审 triage: PhotosPeople.vue:356-361(T6 产出)有同类 Esc 早退写法,可达性低(点另一下拉会先被 document mousedown 关掉)
Task 10: minor (deferred): hero 浅色前景 .72/#fff 未真机像素比对;菜单展开高度在 overflow:hidden 下是否裁边(Vue2 同样存在)—— 均列真机验收看点
Task 11: 首轮 1798117(14 用例,2 次逐个删码验证;实现者主动交代 TDD 顺序违规并自行纠正)
Task 11: 控制器裁定(核 Vue2 :874-880):整格点击的 selectionMode 分支放组件内(它已收该 prop),不下推 T14;要求补两条负向断言 + 删码验证
Task 11: fix round 1/5 (裁定项 addressed; commits 1798117..a2a8955)
Task 11: 评审 1 Critical → fix round 2/5 派出:瓦片勾选圈/移出按钮漏 Vue2 hover 淡入(:1148-1216 默认 opacity:0),后果=非选择态每张照片常驻圈+X
Task 11: 评审替实现者补做了移出按钮 .stop 的删码验证 —— 覆盖确实存在(实现者自陈过于保守)
Task 11: fix round 2/5 (1 Critical addressed, 0 open; commit 9ef45ba;复审逐条比对 Vue2 :1148-1216 无漂移,6 条 style 断言均为真断言)
Task 11: complete (New-UI c5f0ece..9ef45ba, review clean; 22 组件用例, 全量 264/1921)
Task 11: minor (deferred): 瓦片两个按钮缺 Vue2 的「hover 自身变色」规则(.tile-check:hover 变深 / .tile-detach:hover 变危险色)及对应 transition 属性 —— 初版就缺,非 fix 引入;隐藏态按钮仍可键盘聚焦(照抄 Vue2,已注释登记)
Task 11: minor (deferred): style 文本断言用正则不剥注释,理论误报风险(color-guard 同源),当前无触发
Task 12: 首轮 f6fd0f4(+16 用例;countryFromCoords 改 export 纯加性;PLACE_PALETTE 放 .ts + THEMING.md 例外清单)
Task 12: 控制器裁定(核 Vue2 :156-162):各 tab 自己渲染 .detail-section-title(标题在 tab 模板块内),补键 photosPersonPlacesTitle/Sub;此裁定同样适用 T13
Task 12: 实现者诚实记录: 组件级链路测试因 colorPoints 的 colorMap||PALETTE[0] 兜底遮蔽 modulo bug,单测才是真守卫
Task 12: fix round 1/5 (段落标题裁定项 addressed; commits f6fd0f4..9eb4fbb)
Task 12: complete (New-UI 9ef45ba..9eb4fbb, review clean 零 Critical/Important; 全量 265/1939)
Task 12: 顺带修了 Vue2 一处潜在 bug:Vue2 只给地图空态加了 this person 兜底、标题用裸 person.name(空名会渲染出前置空格),New-UI 用 displayName 统一(评审判为 brief 许可的修正)
Task 12: minor (deferred): PersonPlace 接口在 peopleView.ts 与 usePersonDetail.ts 手写重复(为避循环 import,结构类型下不一致无编译信号);THEMING.md 表格行未点明与 .ic-* 同类
Task 13: 首轮 9744ef7(+32 用例;几何零漂移;SVG 6 处硬编码色全进 scoped CSS;v-html 改为转义插值参数,评审推演确认闭合风险)
Task 13: 评审 2 Important → fix round 1/5 派出:①共现列表头像应 36px(**brief 写错成 32,以 Vue2 scss:547 为准**,控制器已核)②兜底断言只堵 #hex 不堵 rgba()(Vue2 原码 :20 恰有一处 rgba,该路径真实存在)
教训(带下游): brief 给的具体数值也要回源核 —— 本次头像尺寸就是信了 brief 快照未回 Vue2 源(同 P2 教训)
Task 13: fix round 1/5 (2 Important + 2 Minor addressed, 0 open; commit 33c62dd;注入 rgba 破坏性验证过)
Task 13: complete (New-UI 9eb4fbb..33c62dd, review clean; 全量 267/1973)
Task 13: minor (deferred): PersonRelGraph 未迁 Vue2 :198 的 :key=person.id(理由:纯 computed 无内部状态)—— T14 真机验收切换人物时留意关系图过渡态
Task 14: 首轮 4a465cd(+57 用例,全量 268/2031;守卫 7 加 2 不加,4 次逐个删码验证;httpErrors 加 isNotFound;补 12 键)
Task 14: 控制器裁定:①共现头像 72px(**brief 又写错成 56**,scss:701 为准)—— 本期第二次 brief 数值错 ②补 info 弹窗(Vue2 :845-851)对 ③背景 toast 实为两条(brief 说四条不准)④批准补 photosPersonLoadFailed/photosPersonRetry 区分「加载失败+重试」与「人物不存在」(T9 加 failed 标志的目的,亦补 P4 遗留同类账)
Task 14: fix round 1/5 (裁定 2 项 addressed; commits 4a465cd..b28358d;实现者再纠正控制器一处:背景 toast 是四句全不同,已补两键分流)
Task 14: 评审(opus) 2 Important + 9 Minor → fix round 2/5 派出:①coverFaceId 在容器边界丢「字段缺席 vs 显式 null」语义(后端返 {} 会把 hero 打回渐变)②四处按钮图标漏渲染(其中背景网格时长角标与同期 T11 自相矛盾)+ 便宜 Minor 3/4/6/7/9
Task 14: 后端票(挂起,交终审 triage): photosPersonMergedToast 的 en 仍是 'Cluster merged into' (Vue2 是 'Merged into'),跨文件消费非本次新增
Task 14: 跨切面票(挂起): 三条「刻意保留弹窗」的失败 toast 被 z-index 220 遮罩压住(AppToast 仅 60),T5 AlbumPickerDialog 同款既有模式 —— 建议提高 toast 层级或改弹窗内联错误行
Task 14: fix round 2/5 (2 Important + 5 Minor addressed, 0 open; commit fd1b5f4;复审独立确认 store 改动纯加性——全仓仅 PhotosPersonDetail 消费 setPersonCover;累计 11 组逐个删码验证)
Task 14: complete (New-UI 33c62dd..fd1b5f4, review clean; 本页 70 例 + store 53 例, 全量 268/2045)
Task 14: minor (deferred): test:207 用例标题仍写「loading 短路 + 按钮 disabled」而两机制已按 Minor 3 删除(纯标签陈旧,断言正确)
Task 15: 首轮 50fcb88(+19 用例,全量 268/2064;3 组逐个删码验证)
Task 15: 评审 Spec ✅ / quality Approved;1 Important=报告宿主枚举不实(漏 PhotosPersonDetail 这第 4 个灯箱宿主,因已有 Pinia 故无实际故障)→ fix round 1/5 派出(仅改报告 + 改用 grep 全量枚举法)
Task 15: fix round 1/5 (1 addressed, 0 open; 仅报告更正,零代码改动;grep 全量确认恰四处宿主且均已挂 Pinia,四宿主+PhotoLightbox 合跑 6 文件/163 绿)
Task 15: complete (New-UI fd1b5f4..50fcb88, review clean; 全量 268/2064)
Task 16: complete (New-UI 50fcb88..caa6e19, review clean 零 issue; 全量 268/2068)。P5 全 17 任务实现完成

## 整支终审(opus, 46ebcb8..caa6e19 共 33 提交)
- 判 Not ready to merge:5 Important + 十余 Minor。已验证干净:8 处 --on-accent 全合法 / id 铁律 23 处比较点全通过 / i18n 165 新键两 locale 键序逐字节相同+零重复+零「集群」+纯追加(rebase 冲突面未放大)/ 十几处 theme-exception 程序化扫描零违规 / 范围收口全部落实(Ask Nimo·recluster·死 action·?person= 深链零痕迹)/ 越界文件零
- 5 Important:①失败 toast 被 z-index 220 遮罩压住致三条偏离登记的修复全不生效 ②收藏人物 accent 内环被 img 盖住(inset 阴影绘制顺序) ③容器九条动作回写无身份守卫→切人物时跨人物串写(后退键可复现) ④删除 toast label 主路径给错键 ⑤hero 两下拉改 absolute 后被 overflow:hidden 裁(长人名换行必现)
- 台账 18 条 deferred/parked 逐条 triage:2 条必修(已并入修复波)、16 条留后续
## 终审修复波(一次性,5ba2ab4 + f659cdd)
- 5 Important + 11 Minor 全修;**修复波又纠正了终审/控制器三处**:①z-index 300 仍会被本仓 1000/1001 一档压住→取 1100 ②I2 的外发光在 Vue2 本就被 .ring 的 overflow:hidden 裁掉=死代码,不照抄 ③M3 detach 图标生效值 15px(模板 20px 被样式覆盖)
- I5 选型:终审建议的「让 .hero-bg 自己裁」CSS 上不成立(元素自身 overflow 管不了自己的 filter 输出,blur 外溢需祖先裁)→ 新增专职 .hero-clip 层,.person-hero 去 overflow;不回退 fixed
- 6 次逐个删码验证;复审(sonnet)独立复现 I1/I3/M11 三处并核实 I2/I5 两个 CSS 论断成立 → all addressed
- 复审指出报告 M11 自验叙述有一处不实(revert 后实际 1 红非 2 红,因污染区首词 theme-exception 反而开了豁免窗口=静默放行而非可见误报)—— 不影响修复有效性
## P5 收官(2026-07-29)
- 控制器独立复跑:**269 文件 / 2213 passed** + tsc exit 0 + color-guard/i18n 264 passed;两仓工作树干净
- 最终坐标:New-UI sp7-photos@**f659cdd**(46ebcb8..f659cdd 共 35 提交)、Service sp7-photos@**6275ead**(唯一一处改动=personFaceThumbnailUrl 加 ver)
- 待用户 :5277 真机眼验

## 真机验收轮(2026-07-30,用户 :5277 眼验)—— 关账
用户反馈四条,逐条定性后处置:

**① 关系页共现列表恒为空 → 定性=后端,前端不改。**
前端对 `relations` 零过滤(`usePersonDetail.ts:67` 原样渲染 `getPerson` 响应内嵌字段)。共现由后端 SQL 算(`NimoOS-Photos/service/persons.go:419`),条件=同一 asset 上有 ≥2 条 `face_detections` 且都归到 person。查真机库实况:**32 条人脸分布在 32 张不同 asset 上,每张恰好 1 张脸,全库零多脸 asset** → 所有人的关系页必然为空。追因:用户那两张照片(`微信图片_..._38_2.jpg` / `..._39_2.jpg`)背景玻璃柜后确有两人,但 immich-ml 只交回一张脸(小脸+反光玻璃+模糊,低于容器默认置信度门槛;请求未传 minScore)。后端入库(`service/indexer.go:1043`)不做分数/尺寸过滤,ML 给几张存几张 → 漏检在 ML 侧。
**顺带发现的后端真 bug(已报,用户定"后端不管")**:`asset_exif` 对该 asset 宽高存反了(存 4096×3072,实际 3072×4096),而 `FaceThumbnail`(`service/persons.go:985`)按 `实际宽/exif宽` 缩放 bbox → 裁歪,人物「a」的头像根本不是脸。
**用户前提的一处未结论**:「a」与长名人物是否同一人 —— bbox 定位显示「a」取自照片 39 靠左那位、长名取自照片 38 中间那位,指向两个不同的人,但人脸并排比对被中断,**未最终确认**。

**② 弹窗变体按钮 hover 后整颗变白看不见 → 定性=前端,已修。**
`.cad-btn:hover` / `.mrd-btn:hover`(0,2,0)压过只有一个类的 `.cad-btn-danger` / `.cad-btn-primary` / `.mrd-btn-primary`(0,1,0),hover 时实底/渐变背景被 `--chip-bg-hi` 顶掉、文字仍是钉死白色/`--on-accent` → 白底白字,两套主题都中。修法照详情页 `PhotosPersonDetail.vue:1142/1151` 的既有正确写法(变体自带 :hover 背景);primary 的背景声明**刻意不带** `:not(:disabled)`(禁用态同样被夺走背景)。全仓程序化扫描确认只此两处。
新增测试辅助 `__tests__/cssCascade.ts`:jsdom 不算级联也进不了 hover 态,改为解析 `<style>` 原文按 CSS 优先级算出胜出的 background 再断言归属 + 一条防漂移等值断言;两处均删码验证。

**③ 「显示 N 张单照片人物」开关看不到 → 定性=非缺陷(数据所致)。**
显示条件与 Vue2 `PhotosPeopleView.vue:180` **逐字相同**。用户库里 11 个未命名人物全是 2 张照片(每张真实照片在 `/DATA/NIMO/Image/` 与 `/DATA/NIMO/openvino_demo/output/` 各存一份,被当成两个 asset 各检出一张脸)→ `hiddenSingletonCount=0`,按设计不渲染。**该开关因此本期未获真机实证**,挂账:待有单照片人物的库再验。

**④ 未命名人物点击只出菜单、进不去详情页 → Vue2 原样行为,非漏做;用户拍板补入口。**
Vue2 `:189` 未命名卡片整格 `@click` 即 `openClusterMenu`,菜单 `:213-231` 只有命名/合并/删除三项,全 Vue2 列表页无任何通往未命名人物详情页的路径。用户选定方案=菜单顶部加「查看这些照片」(只看不改的动作排在三个改数据的动作前),复用已命名卡片的 `openPerson`(共用 encodeURIComponent 守卫)。
**连带补两处从未可达的 `{name}` 兜底**(入口一开,未命名人物首次走到详情页,Vue2 那边这条路走不到所以那些槶位从来没人管):`PersonHero` 标题兜底「未命名人物」(trim 判定)、洞察卡兜底「这个人」(与 `PersonPlacesTab.vue:51` 同口径)。顶栏(`|| photosPeople`)、移出/明细文案(`displayName`)、建相册默认名(id 前缀)原本已有兜底,逐个扫过确认无缺口。

### 验收轮坐标与门
- New-UI `sp7-photos`@**6b700c7**(f659cdd..6b700c7,1 提交);Service 未改(仍 6275ead)
- 全量 **2227 passed / 269 文件**(f659cdd 时 2213,验收轮 +14:hover 级联 6 + 菜单入口 2 + hero 兜底 3 + 洞察卡兜底 3)+ tsc exit 0 + color-guard 248 + i18n parity 3
- i18n 2 新键双写:`photosPersonViewPhotos` / `photosPersonUnnamedTitle`
- 全量里 2 条 `Not implemented: navigation` 为既有 jsdom 噪声(已 stash 改动在基线复跑比对,同样 2 条)

### 验收轮教训
- **界面 1:1 的"疑似漏做"要先回源核条件再答**:单照片开关的条件与 Vue2 逐字相同,看不到是数据所致;凭印象答"漏了"会白改一版。
- **CSS 级联缺陷 jsdom 测不到,但可以"自己算优先级"来测**:比"断言修复形状"强得多——它钉的是不变量(hover 时胜出的 background 必须属于变体),任何等效修法都放行,把 hover 背景还给基类就红。
- **一旦补了新入口,必须把该页所有从未可达的槶位扫一遍**:本次 hero 标题与洞察卡就是这样带出来的;Vue2 走不到的路径 = 没人管过的兜底。
- **gitignored 台账零冗余**:本文件原件(在 `NimoOS-UI/.superpowers/`)在验收会话期间随整个目录消失,34 份 task brief/report 与 SP7 全区 `progress-sp7.md` 永久丢失。台账应与 P3/P4 一样落在 `.sp7` 工作区。

### 留后续(挂账)
- 后端票(用户定"不管",仅登记):① immich-ml 人脸召回过低(小脸/反光/模糊场景,可考虑给 `facial-recognition` 请求传更低 `minScore`)② `asset_exif` 宽高存反 + `FaceThumbnail` 用 exif 宽高缩放 bbox → 人脸头像裁歪 ③ `photosPersonMergedToast` 的 en 文案仍是 'Cluster merged into'
- zh 文案 3 个键是 `'{name} 的…'` / `'{name} 与…'` 英式排版,中文名代入读作「小明 的照片」;对已命名人物同样存在,非本轮引入,待用户定是否去空格
- 单照片人物开关未获真机实证(库内无单照片人物)
- 「a」与长名人物是否同一人未最终确认(人脸并排比对被中断)
- f659cdd 时的 16 条 deferred/parked 仍在(见上方终审段)
