# SDD ledger — plan: docs/superpowers/plans/2026-07-30-vue3-migration-sp7-p6a-places-map.md

> 台账落 `.sp7` 工作区(P5 台账事故后的约定:`NimoOS-UI/.superpowers/` 被 gitignore 且
> 曾整目录从磁盘消失,34 份 brief/report 永久丢失)。关键事实同步写进 roadmap(入 git 那份)。

基线: New-UI sp7-photos@6b700c7 (269 files / 2227 tests / tsc 0 / color-guard 248 / parity 3), Service sp7-photos@6275ead(**本期零改动**)

## 开工前探勘结论(2026-07-30)

- 体量实测:`PhotosPlacesView.vue` 1341 行 / `photos-places.scss` 1184 行 / topbar 38 行。**比 P5 的 ≈2500 行(PersonDetail 1561 + PeopleView ≈950)小** —— 单期本可装下,拆 P6a/P6b 是为隔断地图侧的手势/动画风险(jsdom 零覆盖),不是因为装不下。
- Service 侧 places 全套 11 方法 P0 已进包,本期零后端改动。
- `photos.places.*` 嵌套 i18n 键两 locale 都齐(insight/mapFilter/mapTheme/spot/cover/coverTab ≈40 条),译文直接取旧 json,不自拟。
- 三条范围决策(D5 地图主题全迁 / D6 跳库走独立路由 / D7 拆两子期)已写进 spec §1b。
- 7 处 Vue2 缺陷 + 一批死代码已写进 spec §7c 与 plan 的「不做」清单;**其中「经纬线」是 spec §7b 初稿的错误条目,已实证为死代码并在 plan Self-Review 里作废该半句**。
- 端口:开工时 5273 与 5277 都在监听,验收起服务前须先杀掉 5277 那个。

## 任务进度

(待填)
Task 1: 实现完成 (New-UI 6b700c7..76e0bf3, 12 新测试, 全量 270 文件/2239)
Task 1: 评审 Spec ✅ / quality Approved,2 Important → fix round 1/5 派出
  I1(plan-mandated): tie-break 测试用 2 项等 count 输入,无法区分「正确升序 tie-break」与「sort 完全没跑」——identity 数组本就升序 + JS 稳定排序使 ()=>0 变异是 no-op。brief Step 4 预测「两条必须红」本身写错了(实测只 1 条红),实现者的解释经复核成立。
  I2: 文件头注释照抄 brief 的「整文件 101 行」,实际 87 行 —— 正是本期「brief 数值必须回源核」那条铁律点名的失误类型。
Task 1: fix round 1/5 (2 Important + 1 Minor addressed, 0 open; commit 27d9bb1,仅测试+注释,生产码零改动)
Task 1: complete (commits 6b700c7..27d9bb1, review clean; 13 例, 全量 270 文件/2240)
Task 1: 教训(带下游): **brief 给的具体数值必须回 Vue2 源核** —— 头注释的「整文件 101 行」实际 87 行,是 plan 写错、实现者照抄。修法取「去掉具体行数只留路径」(行数会随上游再次失准)。后续任务凡引用 Vue2 行号/尺寸/色值/条数,一律回源核后再写。
Task 1: 教训(带下游): **两项等 count 的输入测不出 tie-break** —— identity 数组本就升序 + JS 稳定排序使 ()=>0 变异成 no-op。要区分「tie-break 正确」与「sort 没跑」必须让正确排序**真的重排**输入(counts [5,10,10] 三项);「tie-break 写反」这个变异原先零覆盖。同类:凡「决定性排序」的测试都要检查所选 fixture 是否会被变异区分。
Task 2: complete (New-UI 27d9bb1..7b367aa, review clean 零 Critical/Important; 41 例, 全量 271 文件/2276)
Task 2: 实现者反向纠正控制器两处(经评审独立推演确认成立):①删码变异 #4(去掉 active 的 String() 归一)不变红——Place.id 全链路类型恒为 string,brief 用例两侧本就是字符串;已补「运行时穿透 TS 传数字 activeId」的用例才抓得住(评审判该防线仍要留:下游 6 个组件任务完全可能有未归一的调用点)②删码变异 #7(splitScaleFor 的 hi*1.04 改 hi)不变红,且 **brief 建议的补救断言数学上不成立** —— 二分循环不变量是 clusters(hi)>=2 恒成立,所以「s/1.04 处应 <2 簇」对正确代码也失败。改为用同一批可信原语独立重算 hi 再断言 s ≈ hi*1.04。
Task 2: 事实更正: brief 引用的 Vue2 图例行号 :1032-1039 末端差一行,实际是 :1032/:1035/:1038(cosmetic)
Task 2: minor (deferred): countPhotos/countCountries 两个 reducer 零断言覆盖(不在 13 条约束内,但已导出给下游)
Task 2: minor (deferred): 为钉 hi*1.04 系数,测试里逐字复制了生产码的 22 步二分循环,测试与实现算法结构耦合(实现者称唯一可行钉法,评审接受);建议加注释提醒二分实现变更时同步改
Task 3: 实现完成 (New-UI 7b367aa..33c1ee5, 40 store 测试, 全量 272 文件/2316);8/8 变异逐个验过
Task 3: 评审 Spec ❌ / Needs fixes,2 Important → fix round 1/5 派出
  I1(真 bug,零覆盖): loadDetail(null) 与 clearDetail() 两条中断分支只 seq++ 并清 detail,从不 touch detailLoading;若此时有在途 loadDetail(id),它 finally 里的 `if (mine === seq)` 因 mine 已过期而跳过 → detailLoading 永久卡 true,无任何后续事件能复位。P6b 消费时表现为「清空详情后加载指示器永久转圈」。
  I2(覆盖缺口): coverBusy 在 setPlaceCover/resetPlaceCover 间共享这条**被声明为刻意设计**的语义无测试保护 —— 现有用例只验各自自重入,拆成两把独立锁全部 40 例仍绿。
Task 3: 申报核实: ①coverBusy 共享的语义判断成立(同一资源上互斥写,共享锁是合理收紧)但测试没钉住 → 转 I2 ②__resetForTest 不重置 seq 的偏离**成立**,评审独立推演确认字面重置会造成别名冲突(旧在途 mine=1 与重置后新 mine=1 相等 → 旧响应错误覆盖新详情),回归测试真能红 —— 这是实现者第三次合理反向纠正 brief
Task 3: 事实更正(带下游): brief 让「照 people.ts:326 的 __resetForTest 体例重置 seq」是失真引用 —— people store 根本没有 seq 计数器(它用的是 _purgeTimers)。后续任务引用既有体例时须先打开那个文件核实,不能照抄 brief 的引用。
Task 3: fix round 1/5 (2 Important + 1 Minor addressed, 0 open; commit 58d8757;三组删码验证逐个做:两处 detailLoading 分别删各自唯一变红、coverBusy 拆两把独立锁两条新测试同时变红)
Task 3: complete (New-UI 7b367aa..58d8757, review clean; 44 store 测试, 全量 272 文件/2320)
Task 4: 首轮 60a9dee(键双写 + 2 条 parity 专用断言;全量 272 文件/2322)
Task 4: **实现者回源查出 brief 键表 6 处出入并全部改正**(控制器已逐条核 zh_CN.json 确认):cities/countries/photos_count 是裸名词「城市/国家/张照片」(brief 误加量词)、{n} cities 实为「{n} 个城市」(brief 写「座」)、Sand/Mono 被 brief 误标「自拟」而 json 本有(「沙滩」「单色」;Ocean 实为「海洋」)、Reset view 实为「重置视图」(brief 写「复位视图」)
Task 4: 控制器裁定(第 4 处同类错误): brief 的术语表把 Current trip 定成「当前行程」,但 json 原文是「本次旅行」——**术语表是我未回源写下的,界面 1:1 铁律优先**,已令改回 json 原文。
Task 4: 事实(带下游,P6b 也适用): **Vue2 对「当前行程」这一概念有两种中文说法** —— 扁平键 Current trip = 「本次旅行」(图例/hero 标记/访问历史 pill),嵌套键 mapFilter.currentTripOnly = 「只看当前行程」(Filters 弹层)。按 1:1 照原样两边都保留、不统一,已要求在键旁注释登记;若产品要统一须两处一起改。
Task 4: complete (New-UI 58d8757..a04ca2b 共 2 提交, review clean 零 Critical/Important; 47 键双写 + 2 条 parity 专用断言, 全量 272 文件/2322)
Task 4: 评审独立复核: 34 个 json 来源键逐字比对全一致;六大洲键与 T2 的 REGION_LABEL_KEYS 逐字一致;P6a 模板 :760-1056 的 $t/pt 调用点零遗漏;P6b 范围键(spot/cover/insight)零越界;图例三个数字字面量确认未进 i18n;两 locale 键序逐字节一致无重复;追加的两条 parity 断言均为真断言
Task 4: minor (deferred): en_us.ts 的「Vue2 双说法」登记注释只放在 currentTripOnly 一处(靠指代引到 CurrentTrip),zh_cn.ts 则两处都有 —— 风格一致性
Task 5: 实现完成 (New-UI a04ca2b..0ab0b6c, 23 组件测试, 全量 273 文件/2347)
Task 5: 评审 Spec ✅ 结构零漏渲染(逐节点清点表核过) / Needs fixes,1 Important → fix round 1/5 派出
  I1: 三处 accent 透明度(is-active 背景 .10 / 边框 .30 / 缩略图遮罩 .18)用「就近取既有 token」而非新增精确 token;本仓已有 --drop-bg/--spark-fill/--orb-glow 三个「为精确匹配 Vue2 数值而新增」的先例,说明「层级不够须新增」指的是数值级精度。尤其缩略图遮罩主观选了偏差更大的 .24(而非更近的 .14),理由「更醒目」= 设计判断而非移植判断。
Task 5: 申报核实: 删码⑥ 的曲折成立且处置正确 —— .rail-place:hover 与 .rail-place.is-active **优先级相同(都是 0,2,0)**,胜负只由源码顺序决定;实现者停手定位后改成「断言存在同含 is-active 与 :hover 且优先度 (0,3,0) 严格高于基类的规则」,不依赖书写顺序,删掉专属 :hover 必红。评审补充判断:这条守卫防的不是 P5 那种「变体优先级天生更低必输」的事故,而是「两者优先级相等、靠书写顺序苟活」的更隐蔽脆弱态(CSS 重排/合并/格式化工具改顺序即复现)——加固合理且必要。
Task 5: 事实(带下游 T6/T9/T10): 「基类 :hover 压变体」在本仓有两种形态 —— ①变体优先级更低(0,1,0 vs 0,2,0)必输 = P5 事故原型 ②优先级相等(0,2,0)靠源码顺序苟活。**两种都要用变体自带 :hover 消解,断言要钉优先级而非顺序。**
Task 5: fix round 1/5 (1 Important addressed, 0 open; commit 4c70665;新增 --place-row-bg/--place-row-border/--place-thumb-active 三 token,深色=Vue2 原值精确复刻、浅色按 accent 家族 x0.83 推导并注释依据,进 THEMING.md)
Task 5: complete (New-UI a04ca2b..4c70665 共 2 提交, review clean; 23 组件测试, 全量 273 文件/2347)
Task 5: minor (deferred,交终审 triage): .rail-place .thumb 背景用 var(--chip-bg) 而 Vue2 是实底 #000(黑色信箱底 → 跟随主题的中性底)—— 这是一处**视觉偏离但代码里没有注释登记**,解释只在 report 里。按本期铁律「偏离必须在代码里注释登记」应补一行注释。
Task 5: 跨切面票(挂起,交终审): **本仓没有「每个颜色 token 在两套主题块都必须有值」的守卫** —— color-guard 只扫字面色值,一个 token 只在 :root 定义而漏了 :root[data-theme=light](或反之)会静默全绿通过,只在运行时视觉降级。实测删掉一个浅色 token 后 273/273 仍绿。
Task 5: 事实(带下游 T6/T10,决定色值口径): **Vue2 的 --accent-rgb 是 theme-invariant 的**(photos.scss:41 原注释「channel form of --accent, theme-invariant」,值恒为 110,91,255)—— 即 Vue2 里图钉那些 alpha 层在深浅两套主题下 **alpha 与 RGB 都不变**,只有地图画布底色随预设变。故 T6 的图钉 token 应「两套主题块 alpha 相同、只有 RGB 随本仓 accent 变」,不要照 T5 的 x0.83 推导(T5 那些面铺在 app 主题的卡片/面板上,按主题收敛 alpha 是站得住的;图钉铺在**地图预设自己的画布**上,画布明暗与 app 主题无关——custom 模式恒为黑底——按 app 主题降 alpha 会在「浅色 app 主题 + custom 黑底」组合下把图钉洗没)。
Task 5: 真机验收看点(P6a 收尾时看): Vue2 的图钉恒为其 accent 紫 #6E5BFF,恰好等于 default 地图预设的点色,所以两者在 default 下同色、在 ocean/sand/mono 下故意不同色;New-UI 的 accent 是蓝,于是**图钉与地图预设调色板不再同色**(结构照 Vue2、色相必然不同)。这是 D3「照 New-UI 设计语言重塑」+ D5 的必然结果,非缺陷,但要眼验四套预设下图钉都看得清。
Task 6: 实现完成 (New-UI 4c70665..d6ba958, 19 组件测试, 全量 274 文件/2368)
Task 6: 评审(opus) 结构零漏渲染零 Extra:模板 :972-1011 逐节点 + scss :333-436 逐规则清点全一致,五层图钉/两层 pin-scale/三处反缩放/8 token 两块 alpha 相同只换 RGB/theme-exception 位置与文本 全部合规;控制器给的 8 个 alpha 表逐个回源核对**全部准确**;删码五靶都是真靶
Task 6: 1 Important(控制器造成的第 6 处错误) → fix round 1/5 派出
  I1: `.world-dot` 的回落 `var(--map-dot-bg, var(--fg-faint))` —— **控制器指定的 --fg-faint 是错的**。这条回落不是死路径:Vue2 :974 只在 currentTheme.dotBg 为真时才注入 --map-dot-bg,而 :150(app 深色 + 任意预设)与 :137(custom 模式,底恒黑)**都返回 dotBg: null** → 最常见两条路径全走 CSS 回落。Vue2 回落是 scss:347 的 rgba(255,255,255,0.10) 字面量(刻意不走 --ink,因为压在地图自己的深色画布上);本仓 --fg-faint 深色是 rgba(255,255,255,0.52)、浅色是**不透明**暖灰 #9a958a → 陆地点阵亮 5 倍并盖过 visited 点、浅色+custom 黑底时不透明灰铺纯黑。**与本任务自己写下的 theme-invariant 论证自相矛盾。**
Task 6: 事实更正(带下游 T9/T10,收紧版): color-guard 的 theme-exception 豁免窗口是**逐行状态机**(color-guard.test.ts:92-99):见到 theme-exception 开窗 → 同行扫裸色 → **该行含 `;` 或 `}` 则处理完即关窗**。推论:①注释写在被豁免声明的同一行或紧上方都有效 ②**注释写在选择器上方只能豁免规则体的第一条声明**(`.x {` 那行不含 `;`)③PhotosMiniMap.vue 的 .dot-person 先例之所以绿,是因为 stroke:#fff 恰好是该规则第一条声明 —— **它不能证明「挂规则前面」这种写法普遍安全**。
Task 6: fix round 1/5 (1 Important + 3 Minor addressed, 0 open; commit 4d8d007;新增 --map-dot-bg-fallback theme-invariant token 两块同值精确复刻 Vue2 rgba(255,255,255,0.10);删码逐个:回落换回 --fg-faint 必红、transform-box 与 transform-origin 分别删各自唯一红、删 .geo-pin:hover 整条必红)
Task 6: complete (New-UI 4c70665..4d8d007 共 2 提交, review clean; 19+ 组件测试, 全量 274 文件/2371)
Task 6: 登记(不改): .world-dot.is-visited 的 var(--map-dot, var(--accent)) 回落与 Vue2 :351 的 rgba(110,91,255,0.32) 不同,但 --map-dot 在 Vue2 :974 无条件注入、该回落不可达 —— 已在代码注释登记
Task 7: complete (New-UI 4d8d007..369697e, review clean 零 Critical/Important; 30 例, 全量 275 文件/2401)
Task 7: **首个「brief 的 Vue2 行号与全部魔数零出入」的任务**(前 6 个各有一处)
Task 7: 评审独立重算 7 组期望值(letterbox fit=0.8/ox=200 → (0,0)与(1000,500)、svgEl null →(500,250)、panelFrac 0.42/0.55 → x=290/225/500、zoomFrac 0/1/0.5、定点缩放不变量代数证明+数值验算、screenToVbScale=1.25 拖拽增量+125、easeOutCubic(0.5)=0.875)全部吻合,无反填
Task 7: 事实更正(控制器第 7 处错误,带下游): plan 写「zoomToCluster 的 +0.01 不能省 —— 否则裂不开的簇点了完全没反应」**是错的**。评审给出完整代数证明:`next = max(currentScale+0.01, splitScaleFor(...))`,而 splitScaleFor 可裂分支恒返 >= currentScale*1.04 >= currentScale+0.04(因 currentScale>=1),左支永不胜;裂不开分支返 MAX_SCALE,而 centerOn 自己的 min(MAX_SCALE, next) 把两种情形都夹回 MAX_SCALE。**故 +0.01 对任意合法 currentScale∈[1,16] 恒不可观测 = Vue2 死代码**(不只是 MAX_SCALE 边界)。照搬无害,保留;但「它是必需的」这个理由不成立。
Task 7: minor (deferred,交终审 triage): ①一条 it 标题是早期草稿遗留(写「已在 MAX_SCALE 时…」但测试体用 scale=10、断言 10.01),断言正确仅标签陈旧(同 P5 test:207 先例)②+0.01 的隔离测试靠 vi.spyOn 把 splitScaleFor 钉在真实函数永不产生的值上 = 用 mock 测实现细节(被指令允许,但注释里应写明「Vue2 遗留死代码,不代表任何用户可观测场景」,现报告只提了 MAX_SCALE 特例、结论范围小于实际)③zoomBy/setScale 无独立测试;screenToVbScale(null) 与 onPointerDown/Up 的 svgEl 为 null 防御分支未直接断言
Task 8: complete (New-UI 369697e..7439027, review clean **零缺陷** —— 本期第一个; 19 例, 全量 276 文件/2422)
Task 8: 评审独立重算轨道换算五点(clientY 100/300/200/0/999 → 16/1/8.5/16/1)全吻合,方向正确(顶=最大缩放);逐节点 + 逐 CSS 规则清点零漏
Task 8: 新增 4 token 经评审逐值回源核实**全部精确复刻非近似**: --float-bg(其实是 Vue2 photos.scss:49/:84 自己就有的全局 token,深 rgba(20,20,28,0.85)/浅 rgba(255,255,255,0.85),同名同语义=忠实移植不是命名陷阱)、--zb-hover-bg/--zb-track-bg(alpha 0.08/0.12 精确,浅色 RGB 改取本仓 --fg 真实分解值 28,27,25 而非照抄 Vue2 light --ink 的自认近似值 35,37,43,理由已在组件头与 theme.css 双处写明)、--zb-thumb-shadow(rgba(0,0,0,0.4),grep 确认 Vue2 该规则全文仅一处、确为 theme-invariant)
Task 8: minor (deferred): setFromEvent 除 rect.height 无零高度守卫(Vue2 同样没有,且 .zb-track 有固定 height:120px,理论风险)
Task 9: 实现完成 (New-UI 7439027..2f93ba0, 35 组件测试, 全量 277 文件/2459)
Task 9: 评审 结构/行为零缺陷:六段结构逐节点 + scss :199-231/:854-963 逐规则清点全一致;props.filter 从不就地改;「只填一头退回 all」两条独立用例;onDocKeydown 只有一处非-Esc 守卫无额外早退(避开 P5-T10 bug 形态);extraFilterCount 复用 T2 未重写
Task 9: 实现者删码时自查出一处 cssCascade 真假绿并修掉: count-row/region-row 的 .is-active 与基类 :hover **优先级相同(都是 3)**,不要求 winner.selector 含 :hover 的话,删掉变体 hover 规则后靠源码顺序 tie-break 会静默通过 —— 与 T5 同一形态,第二次出现
Task 9: **控制器裁定(驳回评审 1 Important)**: 评审判「.map-filter-pop 用 --popup-bg/--card-shadow-hi 是就近取,应新增 --filter-pop-bg/shadow 精确复刻 Vue2 的实底 #1A1A20 + 单层 rgba(0,0,0,0.6)」。**驳回,理由=与 spec D3 原文直接冲突**:D3 写明「照 New-UI 设计语言重塑(AreaShell/token/**组件体系**,同 SP4/SP5 前例);**布局结构与信息层级**照 Vue2」—— 弹层的底色与投影属「组件体系/surface treatment」归 New-UI,只有布局与信息层级照 Vue2。T5/T6/T8 之所以要新增精确 token,是因为那些是**内容色**(图钉色/选中行/滑杆轨道)在 New-UI 无对应约定;而**弹层 chrome 在本仓有既定约定**(ContextMenu/Dialog/AlertDialog 共用 --popup-bg/--card-shadow-hi),复用即 D3 要求的一致性。裁定:保留,但**必须在代码里注释登记该决策并引 D3**(偏离登记铁律)。
Task 9: 真机验收看点(P6a 收尾): --card-shadow-hi 深色含一层 inset 白色上缘高光(Vue2 那个扁平深色菜单没有),弹层浮在地图上时要眼验这层玻璃高光是否突兀;若用户不认可,改法=新增 --filter-pop-bg/--filter-pop-shadow 精确复刻 Vue2(评审已给出取值),T10 主题弹层需同步。
Task 9: fix round 1/5 (裁定登记 + 2 Minor addressed, 0 open; commit 1636ca0,纯注释改动,声明与断言零改动)
Task 9: complete (New-UI 7439027..1636ca0 共 2 提交, review clean; 35 组件测试, 全量 277 文件/2459)
Task 9: 事实(带下游 T10/T11 与后续期): **color-guard 不剥注释** —— color-guard.test.ts:86-104 对 style 块/`.css` 的每一行跑 HEX/FUNC 正则,没有任何注释剥离步骤。所以写在 `/* */` 注释里的字面 `#1A1A20` 或 `rgba(0,0,0,0.6)` 会像声明一样被扫到并判红。写「为什么不用 Vue2 那个色值」这类注释时,**必须用文字描述而不能引字面色值**(实现者首版就因此自触发 RED)。
Task 10: complete (New-UI 1636ca0..3cd2cb8, review clean **零缺陷** —— 本期第二个; 39 例(17 util + 22 组件), 全量 279 文件/2500)
Task 10: 评审逐值回源核对 4 预设 × 7 字段 = 28 个色值 + 2 个自定义默认色**全部逐字符吻合零漂移**;resolveMapTheme 四条分支语义全对(含 custom 不随主题变、深色分支 grid 取 land 而非 light.grid、未知 id 回落)、mapThemeStyleVars 的 --map-dot-bg 条件注入与 T6 的 --map-dot-bg-fallback 契约配合正确
Task 10: 事实更正(控制器第 8 处,仅计数): brief 说「26 个色值」实际是 28(4 预设 × 7 字段)。实现者未改任何值,只把 THEMING.md 新增行写成正确的「4×7 色」—— 处置正确
Task 10: hover 级联同优先级 tie 本期**第三次**出现(T5/T9/T10),三次都用「变体自带 :hover + 断言胜出选择器含 :hover」消解
Task 11: 实现完成 (New-UI 3cd2cb8..28d2d7a, 18 新用例 + 路由/侧栏测试更新, 全量 280 文件/2522);11 个任务实现完毕
Task 11: 评审(opus) 22 项接线逐个核过零错源零漏接:dotColor 取 resolvedTheme.dot(Vue2 :952 同源)非传 themeVars 字符串、autoPanTo 从 store.places 全量找而非 filteredPlaces(照 Vue2 :730 踩坑注释)、rail 拿「已过滤未搜索」而 map 拿同一引用、filter 未就地改、生命周期无只挂不摘、P6b 边界零越界、颜色零字面量;Vue2 节点与四段 CSS 规则清点零遗漏
Task 11: 1 Important → fix round 1/5 派出
  I1(真假绿): @pointerdown/move/up/cancel 四行靠 fallthrough attrs 落到 PlacesMap 单根 svg —— **删掉这四行 18 个用例全绿**。它承载地图最核心的拖拽平移,失效路径全静默(删行 / 后人给 PlacesMap 加 inheritAttrs:false / PlacesMap 将来变多根节点),而三处测试文件都不会红。实现者报称验证过,但那个 spy 验的是 wheel 的显式注册不是 pointer 透传,且是一次性手工实验未留版本库。
Task 11: 申报核实: ①「写错成 @pickPin」**不会**假绿(Vue 的 emit 会 camelize 回退,驼峰照样生效);「漏绑」会红(vm.$emit 走真实 emit 通道);DOM→emit 那一半由 PlacesMap.test.ts:253-272 真实 trigger 覆盖 —— 两半拼齐,故按 Minor 计。**但实现者漏报了同一处真缺口 = pointer 四行**(转 I1)②图例第四组文案「本次旅行」落地正确,brief 清单写「当前行程」是概念转述,实现者按 i18n 实际值落地判断正确
Task 11: 事实(带下游 P6b): Vue 的 emit 解析先查 `on<Event-Name>` 再 camelize 回退查 `onEventName` —— 所以模板上把 kebab emit 写成驼峰**照样生效**,不是缺陷、不需要测试守;真正需要守的是**漏绑**与**透传机制**(fallthrough attrs / inheritAttrs / 多根节点)。
Task 11: fix round 1/5 (1 Important + 5 Minor addressed, 0 open; commit 10d2237;删码逐个:整组删四行 @pointer* 必红、单删 @pointermove 必红、M1 分流改无条件 setMapTheme 必红、M2 条件放回 !attempted 必红、M3 选择器降回 0,2,0 并前移必红)
Task 11: complete (New-UI 3cd2cb8..10d2237 共 2 提交, review clean; 18+8 用例, 全量 280 文件/2530)
Task 11: 教训(带下游 P6b,测试卫生): **async mount helper 会吃掉 microtask 从而掩盖首帧状态**。mountView() 里 `await router.isReady()` + mount() + `await flushPromises()` + `await $nextTick()` 会把 onMounted 内部触发的响应式重渲染全部冲干净 —— 于是「首帧渲染的是哪个分支」这类断言恒绿。要测首帧必须**绕开 async helper、直接 mount() 后立刻断言**(onMounted 回调本身是同步跑的,它排的重渲染才是延到下一个 microtask)。实现者自查发现并已修,评审独立复核现象成立。

## P6a 全 11 任务实现完成(2026-07-30)
- 最终坐标:New-UI sp7-photos@**10d2237**(6b700c7..10d2237),Service 未改(仍 6275ead)
- 门:全量 **280 文件 / 2530 passed**(基线 269/2227,净增 11 文件/303 例)+ tsc exit 0 + color-guard + i18n parity 四道全绿
- 零缺陷任务:T8、T10;fix round 1 即收:T1/T3/T5/T6/T9/T11;零 fix:T2/T4(T4 有一轮裁定)/T7
- **控制器(plan)累计 8 处错误被实现者/评审纠正**:①T1 行数 101→87 ②T2 删码断言数学不成立 ③T3 people.ts 体例引用失真 ④T4 i18n 键表 6 处文案 + 术语表 Current trip ⑤T5 色值该新增精确 token 而非近似 ⑥T6 陆地点阵回落值 --fg-faint 给错(活路径)⑦T7 「+0.01 不能省」理由不成立(实为 Vue2 死代码)⑧T10 色值计数 26→28

## 整支终审(opus, 6b700c7..10d2237 共 18 提交)
- 判 **With fixes**:零 Critical / 4 Important / 10 Minor。跨任务一致性四类(组件契约、色值口径、hover 级联、theme-exception 位置)逐项核过**全通**;**16 个新 token 两套主题块程序化核过零缺口**(:root 129 项 / light 116 项,差集 13 项全是非颜色结构量);THEMING 登记 16/16 一一对应;47 个 i18n 键两 locale 键序逐字节同、零重复零死键零漏键;**5 个 rebase 冲突文件全纯追加零删除**(zh_cn +62/-0、en_us +57/-0、router +2/-0、theme.css +81/-0、THEMING +17/-0);Vue2 死代码清单**一条未迁**;P6b 边界零越界;抽查 5 处高风险移植(28 色值 / buildPins·splitScaleFor·filterPlaces / 图钉五层与反缩放 / letterbox 定点缩放 / 容器接线)全部逐字对得上源码
- 两处控制器裁定经独立复核**均站得住**:①弹层 chrome 走 D3(--popup-bg 有 12+ 调用点、--card-shadow-hi 12 个文件,含 ContextMenu/Dialog 两个通用原语 → 确非「就近凑」)②CurrentTrip 按 json 原文
- 4 Important:I1 color-scheme: dark 照抄 Vue2 致浅色主题下原生日期控件不可读(三道门全测不出;**本仓 theme.css:19/:232 已按主题分设 color-scheme,组件那行是在覆盖根节点的主题感知值 → 删掉即可**)· I2 usePlacesView.ts:174 的「+0.01 不能省」注释与测试标题仍在断言本期已被证伪的因果(台账记了事实但没回流到代码)· I3 rail 的「过滤后为空」显示成「还没有带位置信息的照片」(New-UI 新增路径,无 Vue2 免责)· I4 retryLoad 不做首屏自动选中,与 Vue2「每次成功加载都选」口径不一致且未登记
- 终审的方法论建议(带 P6b):**每次 fix 轮改动一个值/结论时,grep 该结论在代码注释里的所有出现处一并改** —— 本期 8 处控制器错误里有三处事实进了台账却没回流到注释(I2 的 +0.01、M1 的 26/28、M2 的 zh_cn 段首)
- **跨切面票升级为可执行方案(留独立小票/P6b)**:「token 两块齐备」守卫 —— 终审给了算法:解析 theme.css 两块(跳注释)→ 集合差 → 用非颜色结构量白名单(当前 13 项:--font/--radius/--radius-sm/--ease/--stroke/--gap/--app-size/--icon-radius/--dock-radius/--chip-radius/--num-font/--clock-weight/--card-hover)过滤 → 断言剩余为空。附带好处:白名单本身成为「哪些量刻意只放 :root」的可执行文档
- **新跨切面票(留独立小票)**:color-guard 增一条 —— 样式块中出现单值 `color-scheme: dark|light`(非 `light dark`)即要求同行/上一行有 theme-exception 注释。I1 暴露的盲区:它不是颜色字面量但效果等价于钉死一套主题,可覆盖全仓所有原生控件(date/time/number/select/滚动条)
- 文件体量终审判定:**不必再拆**(PhotosPlaces.vue 486 行里样式 152 + 注释登记 ~60 + 逻辑 ~180;placesMap.ts 347 行是 11 个互不依赖纯函数;PlacesFilterMenu.vue 414 行里样式 197 + 裁定论证注释 ~70)
- P6b 两个接缝提醒:①共享包有 resetSpotName(photos.ts:287)但 store 无对应 action,spot 弹窗「恢复默认名」需补(重入守卫复用 spotBusy)②hasDetailPanel 从 () => false 换成真实状态时 visibleCenterVb 的 panelFrac 首次真正生效,autoPanTo/centerOn/zoomBy/setScale 四条通路落点都会变,建议那期把四条的居中断言补成「面板打开时」版本
## 终审修复波(一次性,6f4ba61)
- 4 Important + 9 Minor + 1 便宜守卫全修;scoped 复审 **14/14 ADDRESSED,零 new breakage**
- I1 修法比终审建议更干净:本仓 theme.css 的 :root 与 light 块**本来就按主题分设了 color-scheme**,组件那行写死的 dark 是在覆盖它 → 删掉即可;并新增 color-guard 守卫(单值 color-scheme 须带 theme-exception,`light dark` 放行)
- 过程事故(实现者主动申报):修复中途误用 `git checkout --` 抹掉过 I1 的真修改(整个文件回退到修复波前),当场发现并重做,后续删码验证改成手工 Edit 切换。**复审已逐条核实 14 项都真在 diff 里、无一条被抹掉未补回。**
- 复审留的一个疑问已由控制器关掉:color-guard 的 `rel === styles/theme.css` 排除子**确实生效**(glob 是从 src/styles/ 出发的 `../**/*.css`,key 形如 `../styles/theme.css`,`rel` 归一后正是 `styles/theme.css`),不是死代码

## P6a 关账(2026-07-31)
- 控制器独立复跑四道门:**全量 2667 passed / 280 文件** + tsc exit 0 + color-guard & i18n parity 409 passed;两仓工作树干净
- 最终坐标:New-UI sp7-photos@**6f4ba61**(6b700c7..6f4ba61 共 20 提交)、Service 未改(仍 6275ead)
- 基线对比:269 文件/2227 → 280 文件/2667(净增 11 文件 / 440 例,其中约 137 例来自新增的 color-scheme 守卫按文件逐个生成)
- **未合并 master**(spec §9 既定:合流时点与顺序[与 sp8-ai 的先后]归用户决策);**未跑 deploy.sh**(SP7 全程不碰真机 /app/)
- 待用户 :5277 真机眼验;四条看点见 roadmap 的 P6a 段「真机验收看点」
- **台账按用户约定保留在 .sp7,不删**(P5 台账事故后的新约定 —— 与 SDD 技能默认的「终审通过后 rm -rf workspace」冲突时,以用户约定为准)

## 真机验收轮 1(2026-07-31,用户 :5277 眼验)
用户两条反馈,**均定性为照搬过来的 Vue2 缺陷**(非本期回归),按「Vue2 的 bug 不照抄」铁律修 + 注释登记。坐标 fa0df48。

**① 时间范围可以选出倒置区间(结束早于起始)→ 已修。**
Vue2 `PhotosPlacesView.vue:846-856` 两个 `<input type="date">` 互不约束,`filterPlaces` 对倒置区间筛出零结果 → 用户看到空地图却不知道为什么。修法三层:①原生约束 `:max="filter.customEnd || undefined"` / `:min="filter.customStart || undefined"`(**用 undefined 而非空串**,`min=""` 在部分内核行为不确定)②逻辑兜底:`timeFilter` 判据从「两头都填」收紧为「两头都填**且** end >= start」,非法区间按「区间还没填好」处理 → `timeFilter = all`,与既有「只填一头 → all」语义一致 ③日期串是定长 `YYYY-MM-DD`,**字符串字典序比较即等于日期先后**,不需要 new Date()(已在注释写明,免得后人以为漏了解析)。注意是 **`>=` 不是 `>`** —— 单日区间(两端同一天)合法,有专门用例钉住。

**② Filters/主题弹层被缩放条穿透 → 已修(z-index 4 → 7)。**
根因:Vue2 `photos-places.scss:199-207` 的 `.map-toolbar` 与 `:234-245` 的 `.map-zoombar` **z-index 都是 4**;而 `.map-toolbar` 因 `position:absolute` + 非 auto 的 z-index **自成层叠上下文** → 弹层内部写的 `z-index: 30` 只在工具栏内竞争、跨不过同级 zoombar;同 z-index 由 DOM 顺序决胜,模板里 zoombar 在 toolbar **之后** → 缩放条画在弹层上面。而 zoombar 是 `left:16px; top:50%`(左侧垂直居中)、Filters chip 在工具栏最左且弹层往下掉 → **两者必然重叠**。Vue2 有一模一样的 z-index 值与 DOM 顺序,所以这个缺陷 Vue2 就有。
修法:`.map-toolbar` 的 z-index 提到 **7**。层级梯度:地图家具(zoombar/legend/stats)= 4、`.map-tip` = 5、Vue2 给 P6b 详情面板留的 = 6、工具栏及其弹层 = 7。**测试钉的是不变量**(toolbar 的 z-index 严格大于 zoombar/legend/stats/tip 四者)而非写死 7,任何等效层级调整都放行、降回 4 就红;因 zoombar 样式在 `PlacesZoomBar.vue` 而非容器里,测试读了两个文件的源文本。
**刻意没做**:不动两个弹层自己的 `z-index: 30`(在工具栏内部是对的);不把弹层挪出工具栏做 portal(超范围且会破坏「点外部关闭」的容器 ref 判定);不动 `.map-toolbar` 的 `pointer-events: none` + `> * { auto }`(防透明带吃掉地图拖拽的硬约束,有程序化断言)。

**验收轮 1 坐标与门**:New-UI sp7-photos@**fa0df48**(Service 未改);全量 **2675 passed / 280 文件**(fa0df48 前 2667,+8:日期 6 + z-index 1 + 属性缺省 1)+ tsc exit 0 + color-guard & parity 409 全绿;5 个 rebase 冲突文件仍全部零删除。5 处删码验证(倒置判据 2、max/min 属性各 1、z-index 1)逐个变红后手工 Edit 还原(**不用 git checkout --**,上一轮有人这样做把真修改一起抹了)。

## P6a 收尾关账(2026-07-31,用户指示收尾)
- 最终坐标:New-UI sp7-photos@**fa0df48**(6b700c7..fa0df48 共 21 提交)、Service 未改(仍 6275ead)
- 门(控制器独立复跑):**全量 2675 passed / 280 文件** + tsc exit 0 + color-guard & i18n parity 409 passed;两仓工作树干净
- **未合并 master**(spec §9:合流时点与与 sp8-ai 的先后归用户决策);**未跑 deploy.sh**(SP7 全程不碰真机 /app/;用户曾要求部署,已说明 sp7-photos 落后 master 60+ 提交、不含 SP6 存储区工作,部署会把已部署待验收的 SP6 cutover 从 /app/ 抹掉 → 改走 :5277 dev server,用户接受)
- 5277 dev server 已停(未误杀 .sp8 的 5288)
- **⚠ 验收覆盖面**:用户报了 2 条(倒置日期区间、弹层被缩放条穿透)后即指示收尾;**roadmap P6a 段列的 4 条「只能真机眼验」看点未获明确反馈,仍属未证实**(窄屏塌高 / 弹层玻璃高光 / 四套预设下图钉可辨性 / 浅色+custom 黑底可读性)。P6b 或合流部署后补验。
- 台账按用户约定保留在 .sp7 不删(与 SDD 技能默认的「终审通过后 rm -rf workspace」冲突时以用户约定为准)
