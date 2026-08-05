# SDD ledger — plan: /home/nimo/NimoTech/NimoOS-UI/docs/superpowers/plans/2026-08-03-vue3-migration-sp7-p7b-filterbar.md

工作树:/home/nimo/NimoTech/.sp7/NimoOS-New-UI(分支 sp7-photos)
台账刻意落 .sp7(SP7 台账事故的教训:NimoOS-UI/.superpowers 曾整个消失)

Task 1: complete (commits 4c7ded7..4efa852, review clean)
Task 1: minor (deferred): photosFilterUtils.test.ts:89 的 `as never` 断言缺一行「为何需要绕过多余属性检查」的注释
Task 2: review 1 —— spec ❌ 一条(plan-mandated:.exif-funnel:hover 多了 Vue2 没有的 background)+ 4 条 Minor;两条点名风险(450ms 定时器 / glyph 逐字符)实测排除
Task 2: 人裁定(2026-08-03)—— 计划书那行 background 是控制器手滑,按「界面 1:1」铁律删掉,plan 文本以铁律为准
Task 2: minor (deferred): 角标/清除全部都挂 anyActive(只数可见维度)⇒ 不可见维度的幽灵值清不掉;可达性取决于 T4/T5 是否给不可见维度赋值(T5 已约定不赋)
Task 2: minor (deferred): 卸载解绑用例验的是 mock 调用而非真行为;点组件内部不关弹层的分支未覆盖;wrapper attachTo 后不 unmount 有跨用例残留
Task 2: fix round 1/5 (2 addressed, 0 open; commits fc2f2c8..0dff7f9)
Task 2: complete (commits 4efa852..0dff7f9, review clean)
Task 3: review 1 —— 生产代码(插槽位置/克制度)零问题;1 条 Important:测试另建第二个 i18n 实例 → 与 vitest.setup 的单例重复安装 → 每条新用例 7 条 [Vue warn](默认 reporter 不显示通过用例 stderr,实现者原结论「GREEN 后消失」被证伪)
Task 3: fix round 1 派单 —— 连带修 PhotosFilterBar.test.ts(同缺陷、同为本期新建文件);明确不碰 P7a 既有测试文件
Task 3: fix round 1/5 (1 addressed + 5 附加约束全 ADDRESSED, 0 open; commits dd8f8b7..5fa3f8e)
Task 3: complete (commits 0dff7f9..5fa3f8e, review clean)
Task 4: review 1 —— 实现层零缺陷(三处同源/facet 源/空月份/夹具数字手算复核全过);1 条 Important:新建了第 4 个覆盖 Photos.vue 的并行测试文件(判据用了文件名而非覆盖对象),脚手架与 Photos.integration.test.ts 逐行重复
Task 4: fix round 1 派单 —— 并入 Photos.integration.test.ts + 授权顺手拆该文件多余的 createI18n + 补灯箱翻页集回归锁(含变异验证)+ 补 places/cameras 维度贯通;明确不动 Photos.lightbox/route.test.ts
Task 4: D-note(评审观察项,非缺陷,不改代码)—— 标题副行 store.photoCount/videoCount 按 Vue2 保持全库数,而顶栏「N 项」按 D20 跟筛选减 ⇒ 筛选态下同屏两个数字会不一致(Vue2 副行同样是全库数,回源确认过);眼验时须向用户说明
Task 4: fix round 1/5 (3 必修 + 2 额外核实全 ADDRESSED, 0 open; commits d7a85b4..4f95e11);搬迁无损且「月份数」断言被加强而非削弱
Task 4: complete (commits 5fa3f8e..4f95e11, review clean)
Task 4: minor (deferred): places 维度未做端到端贯通(只补了 cameras);谓词层 T1 已有单测
Task 4: minor (deferred, 既有非本期): Photos.integration.test.ts 跑时有一条既有的 [Vue Router warn] 与一条 getAlbum is not a function 的 stderr,与本期无关
Task 4: 实证 —— `import PhotosFilterBar, { type ExifFilterValue } from '...vue'` 在 vue-tsc 下可用,未退化 ⇒ T5 按简报原样从 SFC 导入类型即可
Task 5: review 1 —— 实现层零缺陷(D19 两胶囊/空月份/计数与空态读未筛选数据/灯箱换筛选后集合/三处注释登记/未越界改 usePlaceAssets;夹具三个数字回源核算全对);2 条 Important 全在测试侧:①实现者自己踩过的 FilterBar 位置错误无断言锁(移到 crumb-spacer 之前三条全绿)②灯箱翻页集无回归锁(改回 assets.photos 26 条全绿)
Task 5: fix round 1 派单 —— 补两条回归锁(各带变异验证)+ 2 条 Minor(恒真断言的用例名订正+计数断言改精确匹配)
Task 5: 评审查实 —— 本页 .filter(m=>m.photos.length>0) 是防御性死代码(groupPhotosByMonth 遇照片才建桶 + 先筛后分组,永不产空桶);与 T4 不同(那边 months 后端预分桶、桶内筛,空月份真实存在)。按 brief 保留,补注释说明
Task 5: fix round 1/5 (2 必修 + 2 Minor + G/H/I 三条额外核实全 ADDRESSED, 0 open; commits e9d5d5e..5f578c9)
Task 5: complete (commits 4f95e11..5f578c9, review clean)
=== 五个任务全部完成,进入整期收尾:全量测试 + 整支终审 ===

=== 整期收尾 ===
全量测试:317 文件 / 3728 例全绿,exit 0(P7a 基线 315/3686 ⇒ +2 文件 +42 例,零新增失败);vue-tsc exit 0。终审独立复跑复核一致。
整支终审(opus,4c7ded7..5f578c9 共 9 提交):零 Critical,判 Ready to merge = With fixes。回源逐字核过 glyph(4 个)/ i18n 文案 / facet 源(Vue2 displayMonths 非搜索态即全库)/ D19 依据(Vue2 :167 确实丢 places),F1/F2 均落地有锁,未越界改 P7a 基元与 usePlaceAssets。
终审必修 I1:「筛到零不落那个空态」的理由被证伪 —— PhotosGrid 自己的空态用的是同两个 i18n 键(photosNoPhotos/photosNoPhotosHint),两分支文案逐字相同、用户看不出区别;Vue2 筛到零同样落这套文案(是 1:1)。门控不改,改注释措辞 + 改验收清单(控制器已改,原第 13 条作废)。
终审必修 I2:跳库页 facet 源「必须是未筛选全集」这条不变量零断言(改成 gridMonths 派生 29 条全绿)—— 同一不变量在两个宿主覆盖不对称。
终审建议 M1:跳库页 applyExifFilters 喂的是整个 filter(含 places),Vue2 :167 是显式投影 {years,cameras};改一行让 D19 在数据层自证,并让 T2 那条幽灵筛选挂账变不可达。
终审建议 M4:PhotosFilterBar.test.ts 的 attachTo 后不 unmount,document 监听残留(清 body 摘不掉)。
终审对计划书本身查出 3 处问题(实现方均正确绕过,属实现优于计划):①计划书三处让测试自建 createI18n,违反硬约束 5 ②winningHoverBackground 示例签名不存在 ③T5 那句 .filter 应标注为「刻意口径统一,非逻辑必需」。
终审新记债务:usePlaceAssets.months 已成死导出(M5,按禁无关重构保留不动);「筛到零缺 filter-aware 空态」是 Vue2 也没有的新功能,归 P8 或后续。
终审 triage:除 I1/I2 外全部可挂账;T4 D-note 判定「交付前只需口头说明,不改代码」。
修复波派单(唯一一次):I1 + I2 + M1 + M4,另 M3/M6/M7 只补测试注释不改逻辑。
修复波 re-review(定向复核 J/K/L/M 四点):全 ADDRESSED,零新增破坏,零越界,无变异残留,断言真实敏感 ⇒ 可以交付眼验。
修复波后全量复跑:317 文件 / 3730 例全绿,exit 0;vue-tsc exit 0。工作树干净。
坐标:New-UI sp7-photos@cd21178(4c7ded7..cd21178 共 10 提交)。Service 未改(6275ead)。未合 master、未跑 deploy.sh。
dev server :5277 实测:/app/ 200、PhotosFilterBar.vue 200、photosFilterUtils.ts 200,Vite 已自动吃到新代码,无需重启。
路线图 + plan 已回填并提交:NimoOS-UI@ebf81cbb。
=== P7b 收尾完成,等用户 :5277 眼验 ===
注:本工作区**刻意不删**(superpowers 的 SDD 流程默认收尾删工作区,但本项目台账保留是硬约定 —— P5 台账事故教训)。
