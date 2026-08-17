import os from 'node:os'
import path from 'node:path'

// ⚠️ 关于范围(E10):用户 2026-08-04 拍板 —— sp7-photos / sp8-ai 两支在快照发布后
// 仍要合进 master。本清单目前只覆盖 master 上的 AI/相册残留面;两支合流后必须为
// src/photos/** 与 src/ai/** 两个完整功能区扩张(路由、i18n 分片、数十个测试文件)。
// 单源 + 导出脚本这套架构正是为此选的,不要退回一次性快照。

const HERE = path.dirname(new URL(import.meta.url).pathname)
export const OSS_DIR = HERE
export const NEW_UI = path.resolve(HERE, '..')
// 产出目录有两个,对应两种意图,**默认必须是安全的那个**:
//   · PREVIEW_OUT —— 不带 --publish 时用。落在系统临时目录下,被 rsync --delete 清空
//     也没有任何损失,想跑几遍跑几遍。
//   · PUBLISH_OUT —— 只有显式 --publish 才用。这是**真实公开仓**,写进去意味着
//     rsync --delete 覆盖它 + git commit --amend 改掉它的 HEAD。
//
// 🔴 这两个常量以前是**一个**(DEFAULT_OUT,直接指向公开仓)。2026-08-08 出过事故:
// `node oss/export.mjs --help` —— 脚本既不认识 --help 又不校验未知参数,当成"没传参"
// 处理,于是按默认值真的覆盖并提交了公开仓(4957653 → 548e53c,靠 reset --hard 还原,
// GitHub 上的 origin/main 未受影响)。拆成两个常量 + 参数白名单是那次事故的修复:
// **危险动作必须是显式的,安全动作才是默认的**。改动前先读 oss/cli-args.test.mjs。
export const PREVIEW_OUT = path.join(os.tmpdir(), 'nimoos-web-preview')
export const PUBLISH_OUT = path.resolve(HERE, '../../NimoOS-Web')

// 主工作树 index 里长期躺着 3 个 design-export/* 的删除态,不属任何一方(spec §10.3)
export const DIRTY_ALLOW = [/design-export\//]

/** 类 1 · 整体删除。路径不存在即 exit 1(清单过期了要知道)。 */
export const DELETE = [
  'oss',                                  // 第一条:机制自己不进产物

  // 主页:搜索面板 / 照片磁贴 / AI 组件
  'src/home/components/SearchDialog.vue',
  'src/home/components/PhotoTile.vue',
  'src/home/components/widgets/AiWidget.vue',
  'src/home/stores/photos.ts',
  'src/home/apps/icons/photos.svg',
  'src/home/apps/icons/ai.svg',
  // SP14 T9(d4d3771):knowledge 桌面磁贴用的图标,同属 AI 区,同一批删除。
  'src/home/apps/icons/knowledge.svg',
  // 零消费方孤儿工具(T6 删完 bindPhotos、PhotoTile.vue 已在本表):
  // src/home/stores/photos.test.ts 仍直接 import 它,但那份测试本身是
  // "测试同步:整体删除的 9 个"之一(T13 填齐),不在本任务改动范围。
  'src/home/util/isAssetId.ts',

  // 音频转录(waveform.ts 保留 —— 它解码 PCM 画真实波形,不涉 AI)
  'src/files/viewers/audioTranscripts.ts',
  'src/files/viewers/speakerWave.ts',

  // 设置「文件夹权限」整个 tab。folderBrowser 删完后零消费方(E3),一并删
  'src/settings/panels/FolderPermissionsPanel.vue',
  'src/settings/panels/folderPerm',
  'src/settings/util/folderPermissions.ts',
  'src/settings/util/folderPermissionsSnapshot.ts',
  'src/settings/util/folderPermissionsView.ts',
  'src/settings/util/folderBrowser.ts',
  'src/settings/util/folderBrowser.test.ts',

  // 文档 / AI 辅助开发痕迹 / 设计稿(E7/E8:用户拍板一份文档都不带)
  'docs',
  'CLAUDE.md',
  // 'design-export' 已在 2ad712f8 从私有仓删除,这里不再需要(留着会触发 stale 硬失败)

  // 各期台账(2026-08-05 起入库,见 .superpowers/.gitignore)。282 份报告里写满了
  // 内部决策、后端接口实测、AI/相册/搜索的设计过程 —— 属于 E7「一份文档都不带」的范围,
  // 只是它在 08-05 之前是 gitignore 的、git archive 拿不到,所以从前不用列。
  '.superpowers',

  // SP9-P7:搜索面板的视图层纯函数模块 + composable。唯一消费方 SearchDialog.vue /
  // SearchDialog.test.ts 都在本表里,整目录零消费方。
  // ⚠️ 必须整目录删,不能只删词表命中的那几个:词表(forbidden.mjs 的 search 条目)只
  //    命中 types.ts / reasons.ts / reasons.test.ts / buildSearchView.ts /
  //    buildSearchView.test.ts,而 degrade.ts / degrade.test.ts / useSearchQuery.ts /
  //    useSearchQuery.test.ts 一个词都不命中 —— 偏偏 useSearchQuery.ts 第 3 行
  //    `import { buildSearchView } from './buildSearchView'`。只删命中的那批,产出树
  //    的类型检查与测试必红,而泄漏守卫和 tree 测试全绿(它们只扫词、不构建产物)。
  //    这正是 tree.test.mjs 末尾那道"产物树能构建"门存在的理由。
  'src/home/search',

  // ═══ SP7-P8b 合流(2026-08-05):相册区整块不进开源版 ═══════════════════════
  // 本表开篇那条"两支合流后必须为 src/photos/** 扩张"的备注,兑现的就是这一段。
  // 相册面 = 一个域目录 + 14 个视图 + 19 个视图测试 + 2 个 i18n 分片 + 1 道分片守卫。
  // ⚠️ 逐条列、不用通配:DELETE 路径不存在即 exit 1,清单过期时要能立刻知道
  //    (2026-08-05 清点结果:`ls src/views | grep -i photo` = 13、
  //     `ls src/views/__tests__ | grep -i photo` = 16)。
  //    Recounted 2026-08-09 (SP15-P1): 14 views, and 19 view tests — 17 in views/__tests__/
  //    plus the 2 that SP15 put next to their views. The route/import counts below were
  //    recounted from src/router/index.ts at the same time.
  'src/photos',                                   // 组件/store/composable/灯箱/util 全区
  // i18n 分片:702 个 photos* 键。它们当初就是为了能在这里一行删掉才从主文件拆出来的
  // (拆之前散在 90 多个区段,剥它们要约 90 条锚点补丁 × 2 语言,改一条文案就打红导出)。
  'src/i18n/zh_cn.photos.ts',
  'src/i18n/en_us.photos.ts',
  'src/i18n/__tests__/photosSlice.test.ts',       // 守的是分片本身,分片没了它就无意义
  // 这两份是**纯相册键**的 i18n 守卫(P8a 的 71 键清单 / P5 人物键抽样),分片删掉之后
  // 它们断言的键一个都不存在,留着必红。
  'src/i18n/__tests__/p8aKeys.test.ts',
  'src/i18n/__tests__/people.i18n.test.ts',
  // 14 views (SP15-P1-T7 added PhotosMomentDetail.vue)
  'src/views/Photos.vue',
  'src/views/PhotosAlbumDetail.vue',
  'src/views/PhotosAlbums.vue',
  'src/views/PhotosFavorites.vue',
  'src/views/PhotosMomentDetail.vue',
  'src/views/PhotosPeople.vue',
  'src/views/PhotosPersonDetail.vue',
  'src/views/PhotosPlaceAssets.vue',
  'src/views/PhotosPlaces.vue',
  'src/views/PhotosSearch.vue',
  'src/views/PhotosSettings.vue',
  'src/views/PhotosSmartViewDetail.vue',
  'src/views/PhotosSmartViews.vue',
  'src/views/PhotosTrash.vue',
  // 22 view tests. ⚠️ The first three are NOT under __tests__/: SP15-P1's T5 and T7 and
  // SP15-P2a's T3 put their tests next to the view, unlike the other 19 in this area — do not
  // assume a glob covers them. (T5's went unregistered and left the leak guard red on 12 hits,
  // the same omission as packages/service/src/photos.moments.test.ts; both are fixed here.)
  'src/views/PhotosMomentDetail.test.ts',
  'src/views/PhotosSmartViewDetail.assets.test.ts',
  'src/views/PhotosSmartViews.moments.test.ts',
  // SP15-P3: bucket-mode wiring test for Photos.vue.
  'src/views/__tests__/Photos.buckets.test.ts',
  'src/views/__tests__/Photos.integration.test.ts',
  'src/views/__tests__/Photos.lightbox.test.ts',
  'src/views/__tests__/Photos.route.test.ts',
  'src/views/__tests__/PhotosAlbumDetail.test.ts',
  'src/views/__tests__/PhotosAlbums.test.ts',
  'src/views/__tests__/PhotosFavorites.test.ts',
  'src/views/__tests__/photosGlassSurfaces.test.ts',
  'src/views/__tests__/photosLayoutHeightCap.test.ts',
  // Fix-8 round 2 (owner acceptance, 2026-08-14): guard that every sibling-of-`.app` overlay
  // (lightbox/scrims/select-bar/toast) keeps an explicit z-index above `.app`'s own — see that
  // test's own header comment and acceptance-fix-report.md §F8-r2.
  'src/views/__tests__/photosOverlayZIndex.test.ts',
  // SP15-P2a task 4: the carried-in [data-selected] defect fix's own test, added under
  // __tests__/ (unlike the three siblings named in the comment above) so a plain glob over
  // this directory does still find it — it is listed here anyway because this table is
  // enumerated on principle, not because a glob would miss it.
  'src/views/__tests__/PhotosMomentDetail.selectionHighlight.test.ts',
  'src/views/__tests__/PhotosPeople.test.ts',
  'src/views/__tests__/PhotosPersonDetail.test.ts',
  'src/views/__tests__/PhotosPlaceAssets.test.ts',
  'src/views/__tests__/PhotosPlaces.test.ts',
  'src/views/__tests__/PhotosSearch.test.ts',
  'src/views/__tests__/PhotosSettings.test.ts',
  'src/views/__tests__/PhotosSmartViewDetail.test.ts',
  'src/views/__tests__/PhotosSmartViews.test.ts',
  'src/views/__tests__/PhotosTrash.test.ts',

  // 2026-08-14(相册 vue2-parity 两批合流带进来的两个守卫):它们守的是
  // src/photos/styles/vue2-parity/*.scss 与其它区之间的类名/keyframes 冲突,
  // 而且各自钉了 `expect(parityFiles.length).toBeGreaterThan(0)` —— 相册整域删掉后
  // 扫不到任何 parity 文件,留着必红(不是"变空转",是直接失败)。整体删除。
  // 保留面的同类守卫(color-guard.test.ts / AppToast.zIndex.test.ts)不受影响:
  // 它们扫的是全仓 .vue/.css,不依赖相册目录。
  'src/styles/class-collision-guard.test.ts',
  'src/styles/keyframes-guard.test.ts',

  // (搜索 demo 的鱼 public/demo/fish_video_poster.jpg 已于终审 cleanup 批从私有仓
  //  直接删除 —— 它在私有版也是零引用的孤儿,不必再由本清单剥离。DELETE 条目路径
  //  不存在会 exit 1,所以这条必须一并撤掉。)

  // ═══ SP8-P6 合流(2026-08-06):AI 区整块不进开源版 ═══════════════════════════
  // 本表开篇那条"两支合流后必须为 src/photos/** 与 src/ai/** 两个完整功能区扩张"的
  // 备注,上一节兑现了相册那一半,这一节兑现 AI 那一半。开源版没有 AI 助手 / 知识库 /
  // Parser / 技能 / MCP。
  // 实测(2026-08-06):`find src/ai -type f | wc -l` = 276 —— 组件 / store / composable /
  // 知识库 / parser / 技能 / MCP / 样式 / util / 类型 / 测试全部收在这一个域目录里
  // (含 src/ai/styles/tokens.scss 那组 AI 专用 token),一条目录规则即整块剥除,
  // 与相册的 'src/photos' 同一形状。
  'src/ai',
  // i18n 分片:AI 区那 1207 个 ai* 键。与相册分片同理 —— 当初从主文件拆出去,就是为了
  // 这里能一行删掉,不必打上百条锚点补丁 × 2 语言(改一条 AI 文案就打红导出)。
  'src/i18n/zh_cn.ai.ts',
  'src/i18n/en_us.ai.ts',
  // (shardDisjoint.test.ts **不在这里** —— 修复轮 1 撤回了原先的整体删除,改成
  //  PATCH 成两片版保留,理由见下方 PATCH 段 SP8-P6-T7 那节的「两片版守卫」小节。)
  // 整份文件是 **AI 文案**的 vue-i18n 语法守卫:13 个 describe 里 12 个直接点名
  // aiComposer* / aiSlash* / aiSk* / aiKb*,这些键全在已删的 ai 分片里。
  // 唯一看起来通用的末条「bare @ guard」(遍历全部键找未转义的 @)同样只服务 AI ——
  // 实测 `grep -c "@"`:zh_cn.ai.ts 13 处、en_us.ai.ts 12 处,而 base / photos / sp9
  // 这 6 个分片文件全是 0。产出树里它会遍历一组永远不含 @ 的键,是零判别力的空壳。
  'src/i18n/messageSyntax.test.ts',

  // 测试同步:整体删除的 9 个孤儿测试(T13;每个都已核实其唯一/主要消费的模块已在
  // 上面 DELETE 掉,不是"混合型",不能靠 PATCH 抠用例保留部分覆盖率——见 task-13-report.md)
  'src/home/stores/photos.test.ts',                       // import photos.ts(已删)+ isAssetId.ts(已删)
  'src/home/components/PhotoTile.test.ts',                // import PhotoTile.vue(已删)
  'src/home/components/SearchDialog.test.ts',             // import SearchDialog.vue(已删)
  'src/home/components/widgets/AiWidget.test.ts',         // import AiWidget.vue(已删)
  'src/files/viewers/speakerWave.test.ts',                // import speakerWave.ts(已删)
  'src/settings/panels/FolderPermissionsPanel.test.ts',   // import FolderPermissionsPanel.vue(已删)
  'src/settings/util/folderPermissions.test.ts',          // import folderPermissions.ts(已删)
  'src/settings/util/folderPermissionsSnapshot.test.ts',  // import folderPermissionsSnapshot.ts(已删)
  'src/settings/util/folderPermissionsView.test.ts',      // import folderPermissionsView.ts(已删)
  // FolderPickerDialog.test.ts 不用单列:它在 'src/settings/panels/folderPerm'(上面已整目录删除)里面。

  // src/home/apps/systemApps.test.ts 不再整体删除 —— 见下面 PATCH 段。任务复审
  // Important:这份 DELETE 的旧理由("只有两条 knowledge 用例")已经过期,SP18 给
  // 这份文件加了 kvm+terminal 的服务门控 describe(公开面功能,terminal 磁贴与
  // kvm 磁贴都原样保留在开源版里)。整体删除会让开源版把 terminal 磁贴的门控行为
  // 发布出去却零测试覆盖,连带静默丢掉本来就该保留的 kvm 门控用例——改成 PATCH,
  // 只摘掉 knowledge 专属的 describe 块,kvm/terminal 那个 describe 原样保留。
]

/** Service 侧的整体删除(相对 packages/service/)。 */
export const SERVICE_DELETE = [
  'src/photos.ts',
  'src/photos.test.ts',
  // SP7-P8b 合流(2026-08-05):P0 把 photos 域从 4 个方法扩到 60+,测试也跟着按子域拆成
  // 6 个文件。旧清单只列了 photos.test.ts,这 6 个是新增的 —— 漏了它们,内嵌共享包里会
  // 留下整套相册接口测试(泄漏守卫实测命中 303 处,过半出自这里)。
  'src/photos.albums.test.ts',
  'src/photos.favorites.test.ts',
  // SP15-P1-T1/T2 added a seventh sibling and did not list it here, so the leak guard has been
  // red since (`oss/tree.test.mjs > 泄漏守卫 > 不带 --skip-guard 也能跑通`, 5 hits in this one
  // file). Same omission the comment above describes, same remedy.
  'src/photos.moments.test.ts',
  'src/photos.persons.test.ts',
  'src/photos.places.test.ts',
  // SP15-P2a-T1 added an eighth sibling (the smart view pin/remove/restore/excluded endpoints)
  // and did not list it here either, so the leak guard went red again — 15 hits, all in this one
  // file. Third time for this exact omission; the remedy is unchanged.
  'src/photos.smartviewAssets.test.ts',
  // SP15-P2b-T1 added a ninth sibling (album <-> smart view conversion). Same omission
  // pattern as the two comments above — the leak guard would go red without this line.
  'src/photos.convert.test.ts',
  // Photos parity plan A, task 1 (2026-08-12): the upload capability was removed from the
  // service layer entirely, so photos.uploads.test.ts is gone. Its sprite-hover coverage
  // (spriteMeta/spriteUrl/previewUrl, unrelated to uploads) moved to photos.sprite.test.ts,
  // which still needs an entry here — same omission pattern as the comments above.
  'src/photos.sprite.test.ts',
  'src/photos.views.test.ts',
  // SP9-P7:search 域(agentTool 四源聚合 + 归一化)。开源版没有 Search/AI 服务,
  // 唯一消费方是已删的 SearchDialog.vue / src/home/search/**。
  // 光删这两个文件不够 —— index.ts 里还有三处接线(见下方 SERVICE_PATCH),
  // 不打那三个补丁的话内嵌共享包直接构建失败,而词表守卫与 tree 测试全绿。
  'src/search.ts',
  'src/search.test.ts',

  // SP8-P6-T8(2026-08-06):Service 仓自己的台账目录。
  // 私有侧 2026-08-05 起把 .superpowers/ 从 gitignore 拿掉改成入库(台账丢过一次),
  // New-UI 那份当时就进了上面的 DELETE 表(第 54 行),**Service 这份一直漏着** ——
  // `git archive HEAD` 会把 32 份 SP7 期台账原样带进 packages/service/。
  // 实测:产物树泄漏命中 977 处里有 437 处出自这一个目录。既有问题、不是本刀造成的,
  // 但它就在 SERVICE_DELETE 的地盘上,一并补。
  '.superpowers',

  // SP8-P6-T8(2026-08-06):AI 域四个模块 + 各自的测试。
  // 开源版没有 AI 助手 / 知识库 / 笔记 / Wiki 导航。取证(见 p6-task-8-report.md):
  //   · service.ai / service.notes / service.wiki 的调用点**全部**落在已删的 src/ai/**;
  //   · 具名导出 isDistillableName / DISTILL_EXTS / createRootBody 同上;
  //   · sse.ts 是通用 SSE 助手,但 Service 仓内除 index.ts 的再导出外无人 import 它,
  //     消费端 sseRequest 的两个调用点(src/ai/services/agentTransport.ts、
  //     skillTestTransport.ts)也都在 src/ai/** 里 —— 删掉 AI 域后 sse.ts 即成孤儿。
  // 🔴 只删这八个文件不够:index.ts 里还有 13 处接线(4 import + 1 具名导出项 +
  // 3 条 export…from + 2 条 export type + 3 个 getter),见下方 SERVICE_PATCH。
  // 不打那些补丁的话内嵌共享包直接构建失败,而词表守卫与 tree 测试可能全绿。
  'src/ai.ts',
  'src/ai.test.ts',
  'src/notes.ts',
  'src/notes.test.ts',
  'src/sse.ts',
  'src/sse.test.ts',
  'src/wiki.ts',
  'src/wiki.test.ts',
]

/** 类 2 · 整文件替换,各带私有侧哈希钉。T10-T13 填。 */
export const REPLACE = [
  // T9:桌面默认布局重排(开源版无照片磁贴/AI 组件,坐标整体重排,PATCH 无可继承内容)
  //
  // SP14 T9(commit d4d3771)复核:私有侧新增一条 `{ kind: 'app', key: 'knowledge', c: 10,
  // r: 2, ... }`(见 task-9 报告)—— knowledge 是 AI 区磁贴,`oss/files/defaultLayout.ts`
  // 本就不含任何 photos/ai 磁贴(整份布局早已重排,见上一行注释),所以这次漂移**不需要**
  // 同步 OSS 侧,只需把下面的哈希钉更新为新值(已现场核过 `oss/files/defaultLayout.ts`
  // 内容,不是删哈希钉绕过检查)。
  { path: 'src/home/grid/defaultLayout.ts', from: 'defaultLayout.ts',
    privateSha256: '952b6427d6e61832395b6133cb9e51e2c2747dcf98c7c6a2d4d7788b016cba34' },

  // T10:MediaViewer 拆转录面板(摘要/转录/Ask 三 tab、说话人分色、章节过滤全删;
  // 保留自绘播放器 + 真实波形 + 视频/图片通路 + 封面元数据)
  { path: 'src/files/viewers/MediaViewer.vue', from: 'MediaViewer.vue',
    privateSha256: 'cdcf9a6d4cb75ffcfc7ad8b638602a73e57a7e94f24c29ccae51579563f1fd05' },

  // T11:AddPanel 去照片 tab(模板块 + tab 定义 + usePhotosStore 声明/import +
  // .lib-photo-* 样式四处一并删除;409 行附近 ic-photos 注释改泛化措辞)
  { path: 'src/home/components/AddPanel.vue', from: 'AddPanel.vue',
    privateSha256: '7faf9cf8605b22bb37f811d616543e80016961551f53dc99379cce3d4b13f01f' },

  // T12:README 重写(面向外部开发者,私有版讲的是与 Vue 2 并存/绞杀迁移/同级克隆
  // Service —— 受众不同且后两条在开源包里都是假的,没有可继承内容,整文件替换)
  { path: 'README.md', from: 'README.md',
    privateSha256: 'd7e224513d27be1f10e3d68e153d775e4b6d6e0feea451f65c6ae2411488a722' },
]

/** 类 3 · 锚点补丁。命中次数必须恰好 1 次。T6-T9 填。 */
export const PATCH = [
  // ═══════════════════ T6:桌面(home)侧 ═══════════════════════════════════

  // ── systemApps.ts:去 photos / ai 两条系统应用 + import + glyph ──────────
  { path: 'src/home/apps/systemApps.ts',
    find: "import iconPhotos from './icons/photos.svg'\nimport iconAi from './icons/ai.svg'\n",
    replace: '' },
  { path: 'src/home/apps/systemApps.ts',
    find: "  photos: '<rect x=\"3.5\" y=\"4.5\" width=\"17\" height=\"15\" rx=\"3\"/><circle cx=\"8.8\" cy=\"9.3\" r=\"1.5\"/><path d=\"m4 17 5-4 3.5 2.6L16 13l4.5 3.5\"/>',\n",
    replace: '' },
  { path: 'src/home/apps/systemApps.ts',
    find: "  ai: '<path d=\"M12 3.5c.45 3.3 1.7 4.55 5 5-3.3.45-4.55 1.7-5 5-.45-3.3-1.7-4.55-5-5 3.3-.45 4.55-1.7 5-5Z\"/>',\n",
    replace: '' },
  { path: 'src/home/apps/systemApps.ts',
    find: "  { key: 'photos', name: 'Photos', label: 'appPhotos', cls: 'ic-photos', glyph: G.photos, icon: iconPhotos },\n  { key: 'ai', name: 'AI', label: 'appAi', cls: 'ic-ai', glyph: G.ai, icon: iconAi },\n",
    replace: '' },

  // ── systemApps.ts:去 knowledge 系统应用(SP14 T9,commit d4d3771)── 同上一段
  //    photos/ai 的处理是同一批加进来的第三条系统应用,同样按 import/glyph/条目三处摘除。
  { path: 'src/home/apps/systemApps.ts',
    find: "import iconKnowledge from './icons/knowledge.svg'\n",
    replace: '' },
  { path: 'src/home/apps/systemApps.ts',
    find: "  book: '<path d=\"M4.5 5.5A2 2 0 0 1 6.5 3.5H19v15H6.5a2 2 0 0 0-2 2Z\"/><path d=\"M9 7.5h6M9 11h6\"/>',\n",
    replace: '' },
  { path: 'src/home/apps/systemApps.ts',
    find: "  { key: 'knowledge', name: 'Knowledge', label: 'appKnowledge', cls: 'ic-knowledge', glyph: G.book, icon: iconKnowledge },\n",
    replace: '' },

  // ── systemApps.test.ts:只摘 knowledge 专属 describe(任务复审 Important,见上面
  //    DELETE 表的注释)—— 这份文件不再整体删除。knowledge 的两条用例都要去掉:
  //    第一条直接断言 `a.key === 'knowledge'` / `'appKnowledge'`,第二条("keys are
  //    unique")本身与 knowledge 无关,只是恰好挂在同一个 describe 下,把它提出来
  //    保留(用的是 SYSTEM_APP_KEYS,不摘的话这个 import 会变成死代码)。摘完之后
  //    紧接着的 kvm/terminal 门控 describe 原样不动 —— 它是公开面功能(kvm 磁贴与
  //    SP18 新增的 terminal 磁贴都留在开源版里),不受这条 PATCH 影响,也不受下面
  //    FORBIDDEN 词表守卫约束(那条守卫只查 REPLACE 与 PATCH.replace 的字面内容,
  //    这段 describe 标题里的 "SP17"/"SP18" 是原文保留、不是本条 PATCH 写入的,
  //    与 src/home/stores/apps.test.ts 那份原样导出的 "KVM tile gating (SP17 #125)"
  //    describe 是同一情形)。
  { path: 'src/home/apps/systemApps.test.ts',
    find: `describe('SYSTEM_APPS -- knowledge (SP14 #98)', () => {
  it('knowledge is registered with an i18n label and an icon', () => {
    const k = SYSTEM_APPS.find((a) => a.key === 'knowledge')
    expect(k).toBeDefined()
    expect(k!.label).toBe('appKnowledge')
    expect(k!.icon).toBeTruthy()
  })

  it('keys are unique (Dock and AddPanel both dedupe by key)', () => {
    expect(new Set(SYSTEM_APP_KEYS).size).toBe(SYSTEM_APP_KEYS.length)
  })
})`,
    replace: `it('keys are unique (Dock and AddPanel both dedupe by key)', () => {
  expect(new Set(SYSTEM_APP_KEYS).size).toBe(SYSTEM_APP_KEYS.length)
})` },

  // ── useDock.ts:DEFAULT_FAV 换成开源版的 4 项(补上 storage —— 它在开源版
  //    的默认桌面上没有磁贴,Dock 是唯一入口) ─────────────────────────────
  { path: 'src/home/composables/useDock.ts',
    find: "const DEFAULT_FAV = ['files', 'photos', 'ai', 'vm', 'appstore']",
    replace: "const DEFAULT_FAV = ['files', 'storage', 'vm', 'appstore']" },

  // ── useOpenAction.ts:SYS_ROUTE 拍成内部路由(§8.2 的有意偏离)──────────
  //    ⚠️ SP8-P6-T7 重抓锚点:T5(c547c9d)的 AI cutover 把本文件四处都改了 ——
  //    注释多了 AI 区那一段、SYS_ROUTE 多了 ai 一条、cutoverDisabled 注释多了 /ai 一行、
  //    openApp 多了 ai 分支、openItem 的 widget 分支与 sendToAI 整体重写。四条既有锚点
  //    因此全部 hits=0。下面是 T5 之后现场 sed 抓到的逐字文本;replace 侧一律不变
  //    (开源版的目标形态与 SP9-P8 那轮定下的一致:无 cutover flag、无 AI、无相册)。
  { path: 'src/home/composables/useOpenAction.ts',
    find: `// Files section (/files, SP4-P8), Apps section (/apps, SP5-P8), Storage section (/storage, SP6-P1), Photos section
// (/photos, SP7-P8b), Settings (/settings) and KVM (/kvm, both SP9-P8), AI section (/ai, SP8-P6)
// all now live in this app; SP1-SP9 migration is finalized here.
// photos / ai / vm are not dead keys left in the table —— at cutover rollback (flag set to 1)
// they redirect through them, so they are "rollback targets" not "main paths"; this is also the difference
// from appstore/storage/settings (those three are modal dialogs on Vue2, have no own routes,
// rollback can only land on /#/legacy legacy desktop —— settings therefore also uses '/#/legacy' as rollback target;
// after landing there, clicking the "settings" tile is decided by Vue2's resolveEntryTarget('/settings') to pop modal).
// router module cycle (router → Home → ... → this file) only accesses push at runtime; ESM lazy binding is safe.
const SYS_ROUTE: Record<string, string> = {
  photos: '/#/photos', ai: '/#/ai/agent', vm: '/#/kvm',
  settings: '/#/legacy',
}`,
    replace: `// Every system entry point lives inside this app.
// The router module cycle (router -> Home -> ... -> this file) only touches push at runtime, so ESM lazy binding is safe.
const SYS_ROUTE: Record<string, string> = {
  vm: '/kvm', settings: '/settings',
}` },
  { path: 'src/home/composables/useOpenAction.ts',
    find: `// Fallback flag (naming consistent with Vue2's strangler.js strangler:disabled:<from>):
// == '1' when tile falls back to Vue2 old page (see SYS_ROUTE fallback targets), reversible cutover.
// /apps = SP5-P8; /storage = SP6-P6 (the three storage entry points on Vue2 desktop share the same key,
// same-origin shared localStorage, so setting once rolls back both sides); /photos = SP7-P8b (shares the same key
// with the /photos in Vue2's strangler.js migratedRoutes, setting once rolls back both sides);
// /kvm and /settings = SP9-P8, similarly one key controls both sides (/kvm in Vue2's migratedRoutes,
// /settings in migratedEntries).
// /ai = SP8-P6, similarly one key controls both sides (Vue2 side in migratedRoutes).
// ⚠️ Key name uses the **route path**, not the tile key —— vm tile's key is '/kvm'.
function cutoverDisabled(from: string): boolean {
  try { return localStorage.getItem(\`strangler:disabled:\${from}\`) === '1' } catch { return false }
}`,
    replace: '' },
  // SP14 T9(commit d4d3771)重抓锚点,03e6ba1 又把 knowledge 分支上方的解释性注释从
  // 3 行拉长到 7 行,同一个六行代码 + 注释 + knowledge 分支的大锚点两期内碎了两次——
  // 碎因都不是代码变了,是注释被改写/加长。原来这是一条从 appstore 到 tail 的单一
  // find/replace,注释文本被夹在中间,锚点体量因此跟着注释一起膨胀,每次改注释都要
  // 重新过一遍整段 replace。拆成三条,把"会变"和"不会变"分开:
  //   A —— appstore..ai 六行 if,纯代码,两次注释改写都没动过它,不会再因为改注释碎。
  //   B1 —— knowledge 分支上方那段解释性注释,单独摘掉;它是唯一真正会变的部分,
  //         下次被改写只碎这一条,四行触达,不牵连 A/B2。
  //   B2 —— knowledge 分支 + 尾部兜底,纯代码,同样不含注释文本。
  // 这是 apply.mjs 纯字面子串匹配(无正则)能做到的极限:删除注释这件事本身必须
  // 逐字匹配到被删的注释,做不到"锚点完全免疫于注释重写";能做的只是不让它
  // 拖着两侧的代码锚点一起碎。三条拼起来产出与拆分前逐字相同。
  { path: 'src/home/composables/useOpenAction.ts',
    find: `      if (key === 'appstore' && !cutoverDisabled('/apps')) { router.push('/apps/store'); return }
      if (key === 'storage' && !cutoverDisabled('/storage')) { router.push('/storage'); return }
      if (key === 'photos' && !cutoverDisabled('/photos')) { router.push('/photos'); return }
      if (key === 'settings' && !cutoverDisabled('/settings')) { router.push('/settings'); return }
      if (key === 'vm' && !cutoverDisabled('/kvm')) { router.push('/kvm'); return }
      if (key === 'ai' && !cutoverDisabled('/ai')) { router.push('/ai/agent'); return }`,
    // 开源版没有任何 cutover flag(私有主干那几个分支全靠 cutoverDisabled 才存在),
    // 而 settings / vm 在开源版的 SYS_ROUTE 里已经指向应用内路由(/settings、/kvm)——
    // 所以这两个 key 由 B2 兜底的 router.push(SYS_ROUTE[key] || '/') 即可,不再重复
    // 写成两个 if(那只是一层无谓的间接)。photos / ai 在开源版整个不存在。
    replace: `      if (key === 'appstore') { router.push('/apps/store'); return }
      if (key === 'storage') { router.push('/storage'); return }` },
  { path: 'src/home/composables/useOpenAction.ts',
    find: `      // Knowledge: an in-app route built at SP8 (eleven routes, nine-item rail);
      // Vue 2 has no counterpart entry for it, so there is nowhere to fall back to
      // and no strangler:disabled flag is set here (unlike ai/photos/vm/settings above).
      // Consequence: setting strangler:disabled:/ai = '1' only rolls the AI tile
      // back to Vue 2 (line above) -- the Knowledge tile keeps routing into this
      // app regardless, because it has no Vue 2 counterpart to roll back to. That
      // partial rollback is correct by necessity, not an oversight.
`,
    replace: '' },
  { path: 'src/home/composables/useOpenAction.ts',
    // knowledge 与 ai/photos 同属 AI 区,开源版本就不存在这个 key(defaultLayout.ts
    // 早已不含任何 AI 磁贴),处理方式与 ai/photos 一致:整行去掉,不补等价行。
    // terminal(SP18)不属于这次摘除范围 —— 它是公开面功能(settings 那边的
    // terminal rail tab 一直留在 REPLACE 里),原样保留只是措辞去掉"knowledge above"
    // 这个在开源版不存在的指代。
    find: `      if (key === 'knowledge') { router.push('/ai/knowledge'); return }
      // Terminal: SP18 in-app route. Like knowledge above, Vue2 no longer exists
      // on-device (retired 08-07), so there is no fallback target and no
      // strangler:disabled flag — the tile always routes into this app.
      if (key === 'terminal') { router.push('/terminal'); return }
      window.location.href = SYS_ROUTE[key] || '/#/legacy'
      return`,
    replace: `      // Terminal has no counterpart to fall back to, so it always routes
      // into this app.
      if (key === 'terminal') { router.push('/terminal'); return }
      router.push(SYS_ROUTE[key] || '/')
      return` },
  { path: 'src/home/composables/useOpenAction.ts',
    find: `    // Desktop photo tile: after cutover, enter in-app timeline. Deliberately no asset —— Vue2 here also just jumps
    // to /#/photos, not to a specific photo (desktop tile's key is a gradient color string, not an asset id),
    // UI 1:1 should maintain "entering photos home". flag set to 1 falls back to Vue2 old album.
    else if (it.kind === 'photo') {
      if (cutoverDisabled('/photos')) window.location.href = '/#/photos'
      else router.push('/photos')
    }
    // Desktop AI widget: after cutover, enter in-app Agent page. flag set to 1 falls back to Vue2 old Agent.
    else if (it.kind === 'widget' && it.key === 'ai') {
      if (cutoverDisabled('/ai')) window.location.href = '/#/ai/agent'
      else router.push('/ai/agent')
    }
  }

  function sendToAI(text?: string) {
    const q = (text || '').trim()
    // After cutover, use in-app router: query passed to vue-router as object form for encoding, not manually concatenated
    // (AgentPage.vue's onMounted reads route.query.message, consumed once then router.replace clears it).
    // flag set to 1 falls back to Vue2, which only recognizes pre-built hash URL, so keep encodeURIComponent.
    if (cutoverDisabled('/ai')) {
      window.location.href = '/#/ai/agent' + (q ? '?message=' + encodeURIComponent(q) : '')
      return
    }
    router.push(q ? { path: '/ai/agent', query: { message: q } } : { path: '/ai/agent' })
  }

  return { openApp, openItem, sendToAI }`,
    replace: `  }

  return { openApp, openItem }` },

  // ── grid/types.ts:Kind 去 'photo' ────────────────────────────────────────
  { path: 'src/home/grid/types.ts',
    find: "export type Kind = 'widget' | 'app' | 'folder' | 'photo' | 'appwidget'",
    replace: "export type Kind = 'widget' | 'app' | 'folder' | 'appwidget'" },

  // ── registry.ts:WIDGETS.ai + ICON.ai ────────────────────────────────────
  { path: 'src/home/widgets/registry.ts',
    find: "  ai: '<path d=\"M12 3.5c.45 3.3 1.7 4.55 5 5-3.3.45-4.55 1.7-5 5-.45-3.3-1.7-4.55-5-5 3.3-.45 4.55-1.7 5-5Z\"/>',\n",
    replace: '' },
  { path: 'src/home/widgets/registry.ts',
    find: "  ai:      { title: 'widgetAiTitle', icon: ICON.ai, desc: 'widgetAiDesc', min: [2, 2], max: [4, 4], default: [4, 4] },\n",
    replace: '' },

  // ── WidgetCard.vue:一行 + import(churn 高,绝不整文件替换)──────────────
  { path: 'src/home/components/widgets/WidgetCard.vue',
    find: "import AiWidget from './AiWidget.vue'\n", replace: '' },
  { path: 'src/home/components/widgets/WidgetCard.vue',
    find: '  ai: AiWidget,\n', replace: '' },

  // ── GridItem.vue ────────────────────────────────────────────────────────
  { path: 'src/home/components/GridItem.vue',
    find: "    <PhotoTile v-else-if=\"item.kind === 'photo'\" :item=\"item\" />\n", replace: '' },
  { path: 'src/home/components/GridItem.vue',
    find: "import PhotoTile from './PhotoTile.vue'\n", replace: '' },
  { path: 'src/home/components/GridItem.vue',
    find: "  if (props.item.kind === 'app' || props.item.kind === 'folder' || props.item.kind === 'photo') openItem(props.item)",
    replace: "  if (props.item.kind === 'app' || props.item.kind === 'folder') openItem(props.item)" },

  // ── MobileHome.vue ──────────────────────────────────────────────────────
  { path: 'src/home/components/MobileHome.vue',
    find: "        class=\"m-tile\" :class=\"[`kind-${it.kind}`, { 'm-photo': it.kind === 'photo' }]\"",
    replace: '        class="m-tile" :class="[`kind-${it.kind}`]"' },
  { path: 'src/home/components/MobileHome.vue',
    find: "        <PhotoTile v-else :item=\"it\" />\n", replace: '' },
  { path: 'src/home/components/MobileHome.vue',
    find: "import PhotoTile from './PhotoTile.vue'\n", replace: '' },
  { path: 'src/home/components/MobileHome.vue',
    find: "const tiles = computed(() => ordered.value.filter((i) => i.kind === 'app' || i.kind === 'folder' || i.kind === 'photo'))",
    replace: "const tiles = computed(() => ordered.value.filter((i) => i.kind === 'app' || i.kind === 'folder'))" },
  { path: 'src/home/components/MobileHome.vue',
    find: '.m-photo { grid-column: span 2; grid-row: span 2; }\n', replace: '' },

  // ── layout.ts:bindPhotos 函数体 + return 导出 ──────────────────────────
  // brief 原锚点只摘了 return{} 里的导出名,函数体本身(第 87-97 行,引用
  // isAssetId 与 kind === 'photo')会留下来 —— 现场 sed 取出整段一并删除。
  { path: 'src/home/stores/layout.ts',
    find: `  function bindPhotos(ids: (string | number)[]) {
    let i = 0
    items.value = items.value.map((it) => {
      if (it.kind === 'photo' && !isAssetId(it.key) && ids[i] != null) {
        const next = { ...it, key: String(ids[i]) }
        i++
        return next
      }
      return it
    })
  }

`,
    replace: '' },
  { path: 'src/home/stores/layout.ts',
    find: ', bindPhotos,', replace: ',' },
  // 复审 Important③:bindPhotos 函数体没了之后,isAssetId 变成死 import(该文件
  // 只有 bindPhotos 用它)。isAssetId.ts 这个文件本身归 DELETE 表处理,不在此改。
  { path: 'src/home/stores/layout.ts',
    find: "import { isAssetId } from '../util/isAssetId'\n", replace: '' },

  // ── homeUi.ts:search 四项 ───────────────────────────────────────────────
  { path: 'src/home/stores/homeUi.ts',
    find: "  // Global search palette (SearchDialog). Opened by the topbar search button and ⌘K/Ctrl+K.\n  const searchOpen = ref(false)\n",
    replace: '' },
  { path: 'src/home/stores/homeUi.ts',
    find: "  function setSearch(v: boolean) { searchOpen.value = v }\n  function openSearch() { searchOpen.value = true }\n  function closeSearch() { searchOpen.value = false }\n",
    replace: '' },
  { path: 'src/home/stores/homeUi.ts',
    find: '  return { editing, searchOpen, spawnGhost, toggleEdit, setSearch, openSearch, closeSearch, showToast }',
    replace: '  return { editing, spawnGhost, toggleEdit, showToast }' },

  // ── HomeTopbar.vue:搜索胶囊按钮 + ⌘K 监听 + .search-btn 样式(brief 未给
  //    逐字文本,现场 sed 取出) ─────────────────────────────────────────
  { path: 'src/home/components/HomeTopbar.vue',
    find: `      <button class="bar-btn search-btn" :aria-label="t('topbarSearch')" :title="t('topbarSearchKbd')" @click="homeUi.openSearch()">
        <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
        <span>{{ t('topbarSearch') }}</span>
      </button>
`,
    replace: '' },
  { path: 'src/home/components/HomeTopbar.vue',
    find: `
// ⌘K / Ctrl+K opens the search palette. (Esc-to-close is handled by the dialog itself.)
function onKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); homeUi.openSearch() }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
`,
    replace: '' },
  { path: 'src/home/components/HomeTopbar.vue',
    find: `/* search-btn: glass pill with magnifier icon — matches search component.dc.html topbar button */
.search-btn { padding-left: 13px; }
.search-btn .ic { width: 17px; height: 17px; }

`,
    replace: '' },
  // Review Important①: the three entries above drop the search pill and the ⌘K listener, but this
  // comment still advertises the search entry — it would ship as a silent leak (forbidden.mjs does
  // not list this wording). Fixing the word list is a separate task; here we only reword, without
  // mentioning search. (Anchor re-pointed 2026-08-14: the comment was translated to English upstream.)
  { path: 'src/home/components/HomeTopbar.vue',
    find: 'keep search and theme toggle', replace: 'keep the theme toggle' },
  // 复审 Important②:上面删掉 onKey/onMounted/onUnmounted 三行后,这个 import
  // 变成死代码(全文件再无第二处使用 onMounted/onUnmounted,已用 grep 核实)。
  { path: 'src/home/components/HomeTopbar.vue',
    find: "import { onMounted, onUnmounted } from 'vue'\n", replace: '' },

  // ── views/Home.vue:SearchDialog 挂载 + 两个 import + photos store 用量
  //    (brief 未给逐字文本,现场 sed 取出四处) ─────────────────────────────
  { path: 'src/views/Home.vue',
    find: '    <SearchDialog />\n', replace: '' },
  { path: 'src/views/Home.vue',
    find: "import SearchDialog from '../home/components/SearchDialog.vue'\n", replace: '' },
  { path: 'src/views/Home.vue',
    find: "import { usePhotosStore } from '../home/stores/photos'\n", replace: '' },
  { path: 'src/views/Home.vue',
    find: 'const photos = usePhotosStore()\n', replace: '' },
  { path: 'src/views/Home.vue',
    find: `
  photos.loadAssets().then(() => layout.bindPhotos(photos.assets.map((a) => a.id))).catch((e) => console.warn('[home] photos', e))
`,
    replace: '' },

  // ── useAddPanel.ts:curTab 联合类型 + 尺寸表分支 ─────────────────────────
  { path: 'src/home/composables/useAddPanel.ts',
    find: "const curTab = ref<'widget' | 'app' | 'folder' | 'photo'>('widget')",
    replace: "const curTab = ref<'widget' | 'app' | 'folder'>('widget')" },
  { path: 'src/home/composables/useAddPanel.ts',
    find: "    if (kind === 'photo') return [2, 2]\n", replace: '' },

  // ═══════════════════ T7:设置侧 + Service 侧 + 注释洗白 + .gitignore ══════

  // ── HomeTopbar.vue:T6 删完搜索按钮与 ⌘K 监听后剩下的 2 行死代码 ─────────
  { path: 'src/home/components/HomeTopbar.vue',
    find: "import { useHomeUiStore } from '../stores/homeUi'\n", replace: '' },
  { path: 'src/home/components/HomeTopbar.vue',
    find: 'const homeUi = useHomeUiStore()\n', replace: '' },

  // ── tabs.ts:去 folder-permissions,rail 7→6,railTabsFor 退化为恒等 ──────
  // 头部映射注释也点了名(现场 sed 取出,brief 未给):按角色裁剪的那一整项功能
  // 已经不存在,继续保留具体名字和旧计数只是死文档,一并改写。
  { path: 'src/settings/util/tabs.ts',
    find: '//   - data().tabs (L855-863) -- the 7 sidebar rail items\n//   - visibleTabs (L1034)    -- non-admin filters out folder-permissions\n',
    replace: '//   - data().tabs (L855-863) / visibleTabs (L1034) -- sidebar rail items and role-based visibility\n' },
  // SP17:lan-devices(Vue2 #93)插进了 system-status 与 folder-permissions 之间,且是
  // 公开面功能(局域网设备发现,不含任何管理员专属信息)——FIND 锚点跟着私有侧新增的这一行走,
  // REPLACE 仍只摘掉 folder-permissions,lan-devices 保留在开源产物里。
  { path: 'src/settings/util/tabs.ts',
    find: "  'system-status',\n  'lan-devices',\n  'folder-permissions',\n  'account',",
    replace: "  'system-status',\n  'lan-devices',\n  'account'," },
  { path: 'src/settings/util/tabs.ts',
    find: "/** The 8 tabs visible on the sidebar rail (account / developer have their own entry points, not on the rail). */\nexport const RAIL_TABS: readonly SettingsTab[] = SETTINGS_TABS.slice(0, 8)",
    replace: "/** The 7 tabs visible on the sidebar rail (account / developer have their own entry points, not on the rail). */\nexport const RAIL_TABS: readonly SettingsTab[] = SETTINGS_TABS.slice(0, 7)" },
  { path: 'src/settings/util/tabs.ts',
    find: "  'folder-permissions': 'settingsTabFolderPermissions',\n", replace: '' },
  { path: 'src/settings/util/tabs.ts',
    find: "/** Vue2 visibleTabs: only admin sees folder-permissions. Missing role is treated as non-admin. */\nexport function railTabsFor(role: string | undefined): readonly SettingsTab[] {\n  if (role === 'admin') return RAIL_TABS\n  return RAIL_TABS.filter((t) => t !== 'folder-permissions')\n}",
    replace: "/** No rail item is hidden by role here; return the whole set (the signature is kept so callers stay uniform). */\nexport function railTabsFor(): readonly SettingsTab[] {\n  return RAIL_TABS\n}" },

  // ── panels/index.ts ─────────────────────────────────────────────────────
  { path: 'src/settings/panels/index.ts',
    find: "import FolderPermissionsPanel from './FolderPermissionsPanel.vue'\n", replace: '' },
  { path: 'src/settings/panels/index.ts',
    find: "  'folder-permissions': FolderPermissionsPanel,\n", replace: '' },

  // ── SettingsShell.vue:railTabsFor 的唯一非测试调用处,少一个实参 ─────────
  { path: 'src/settings/components/SettingsShell.vue',
    find: "const railTabs = computed(() =>\n  railTabsFor(typeof user.value.role === 'string' ? user.value.role : undefined),\n)",
    replace: 'const railTabs = computed(() => railTabsFor())' },

  // ── E2:systemConfig 的 search_switch(索引签名已保证读改写不丢未知字段)──
  { path: 'src/settings/util/systemConfig.ts',
    find: '  search_switch?: boolean\n', replace: '' },
  { path: 'src/settings/util/systemConfig.ts',
    find: '  search_switch: true,\n', replace: '' },

  // ── 注释洗白(代码一个字节不动)────────────────────────────────────────
  // 2026-08-14:color-guard 是保留面的全仓守卫,文件头那段"相册 parity 目录整目录豁免"
  // 的登记在开源版没有对应物(相册整域已删),连同它引用的内部 spec 路径一并摘掉。
  // 代码不动:当前扫描面本来就不含 .scss。
  { path: 'src/styles/color-guard.test.ts',
    find: `//
// Registered exemption (owner's call 2026-08-11, see docs/superpowers/specs/2026-08-11-photos-vue2-parity-reskin-design.md §4):
// src/photos/styles/vue2-parity/*.scss is the pixel source of truth from the old Vue2 repo, with its own .photos-root-scoped token system,
// so the whole directory is exempt from this guard. The current scan surface (.vue style blocks + .css) doesn't include .scss anyway; if .scss is ever brought into scope,
// this directory's exclusion must be kept.
`,
    replace: '' },
  { path: 'src/apps/util/systemApp.ts',
    find: " *  If any service in compose has the label `nimoos.system == \"true\"`, it is a background component (AI agent runtime /\n *  Photos ML backend, etc.); the desktop appgrid already hides these. The app management page must also hide them,",
    replace: " *  If any service in compose has the label `nimoos.system == \"true\"`, it is a background component (an\n *  internal service container used by other apps); the desktop appgrid already hides these. The app management page must also hide them," },
  { path: 'src/settings/util/appPaths.ts',
    find: '// The backend returns four keys -- app_data / images / database / photos_data\n// (verified 2026-08-09). Vue 2 rendered only the first three until #103 added the\n// photos cache row; all four are rendered here.',
    replace: '// The backend may return additional keys beyond the ones listed in ORDER below;\n// only the keys in ORDER are rendered.' },
  // -- The file-header summary line also says "four rows" in the private source
  //    (Task 3's real behavior) -- the open-source side reverts to three rows below,
  //    so this description must match what the reverted code actually derives.
  { path: 'src/settings/util/appPaths.ts',
    find: '// Settings / Apps -- derivation of the four "App data storage location" rows.',
    replace: '// Settings / Apps -- derivation of the three "App data storage location" rows.' },
  // -- photos_data is a HARD-banned word (forbidden.mjs): Task 3 (private-side) gives
  //    the App data location panel a fourth "photos cache" row, backed by the
  //    /v1/sys/paths photos_data key -- this is exactly the landing path for the
  //    Photos feature, and the open-source side has no Photos, so this row and its
  //    underlying logic must be stripped entirely, not just the comment mentioning it.
  //    The PATCH entries below revert appPaths.ts / migrateBrowse.ts / AppsPanel.vue
  //    back to the three-row version (reverting code, not hiding the literal --
  //    TypeScript string-literal type members get compiled into runtime
  //    arrays/object literals in the bundle, so a comment-only fix would not be enough).
  { path: 'src/settings/util/appPaths.ts',
    find: "export type AppPathKey = 'app_data' | 'images' | 'database' | 'photos_data'",
    replace: "export type AppPathKey = 'app_data' | 'images' | 'database'" },
  { path: 'src/settings/util/appPaths.ts',
    find: "const ORDER: AppPathKey[] = ['app_data', 'images', 'database', 'photos_data']",
    replace: "const ORDER: AppPathKey[] = ['app_data', 'images', 'database']" },
  { path: 'src/settings/util/migrateBrowse.ts',
    find: "  if (type === 'photos_data') return [`${b}/.system_data/photos`]\n",
    replace: '' },
  { path: 'src/settings/util/migrateBrowse.ts',
    find: "consulted, so such entries would be dead code (Vue 2 #105 reached the same result).",
    replace: 'consulted, so such entries would be dead code here.' },
  { path: 'src/apps/stores/installedApps.ts',
    find: '        // System background containers (nimoos.system=true, e.g. AI agent / Photos ML) are hidden from users —\n        // consistent with the desktop appgrid (same rule as backend isSystemComposeApp).',
    replace: '        // System background containers (nimoos.system=true, internal service containers used by other apps) are hidden from users —\n        // consistent with the desktop appgrid (same rule as backend isSystemComposeApp).' },
  { path: 'src/settings/panels/AppsPanel.vue',
    find: '// "Clear local pending-upload cache" = policy 3 "for show": UI is 1:1, button disabled, labeled as\n//    enabled once the Photos area migration is done.\n//    The data source is the **Photos** area\'s IndexedDB upload queue (Vue2 @/views/Photos/upload/idb.js),\n//    not yet migrated as of SP7.',
    // I5-guard(⑤b)复核:原 replace 仍带 "政策三「做样子」"(内部分级术语,FORBIDDEN 清单
    // 里的"做样子"本就是冲它去的,REPLACE-only 时代未覆盖到 PATCH,漏检)。
    replace: '// "Clear local pending-upload cache": UI is 1:1, button disabled — the backend capability this\n//    feature depends on is not available yet.\n//    The data source is a local IndexedDB upload queue (a separate implementation from the files\n//    area\'s upload queue, see the next line).' },
  { path: 'src/settings/panels/AppsPanel.vue',
    find: '// Three sections: ① "App data storage location" four rows (app_data / images / database / photos_data;\n//         from Task 2\'s buildAppPathRows, photos_data is the fourth row Task 3 added,\n//         matching Vue 2 #103)',
    replace: '// Three sections: ① "App data storage location" three rows (app_data / images / database;\n//         from buildAppPathRows)' },
  { path: 'src/settings/panels/AppsPanel.vue',
    find: "  database: 'settingsAppsDatabase',\n  photos_data: 'settingsAppsPhotosData',\n}",
    replace: "  database: 'settingsAppsDatabase',\n}" },
  // -- Two more comments in this file say "four rows" in the private source; revert
  //    both to "three rows" so they match the reverted (three-row) code below.
  { path: 'src/settings/panels/AppsPanel.vue',
    find: '// ── Fetching data (the four "App data storage location" rows) ──────────────────────────────────────────',
    replace: '// ── Fetching data (the three "App data storage location" rows) ───────────────────────────────────────' },
  { path: 'src/settings/panels/AppsPanel.vue',
    find: '// Review Important #3: must not render the four rows with 0 values while the fetch is still in flight',
    replace: '// Review Important #3: must not render the three rows with 0 values while the fetch is still in flight' },
  // -- The settingsAppsPhotosData key ("Photos Cache" / HARD-banned word "相册") only
  //    feeds the fourth row reverted above; once reverted, this key has zero consumers
  //    on the open-source side, so delete it from both locales together -- no orphan.
  { path: 'src/i18n/zh_cn.sp9.ts',
    find: "  settingsAppsDatabase: '用户数据库',\n  settingsAppsPhotosData: '相册缓存',\n",
    replace: "  settingsAppsDatabase: '用户数据库',\n" },
  { path: 'src/i18n/en_us.sp9.ts',
    find: "  settingsAppsDatabase: 'User Database',\n  settingsAppsPhotosData: 'Photos Cache',\n",
    replace: "  settingsAppsDatabase: 'User Database',\n" },

  // ── .gitignore(E9:用户 2026-08-04 拍板)─────────────────────────────────
  // 2026-08-05 私有侧把 .superpowers/ 从 gitignore 拿掉改成入库(台账丢过一次),
  // 锚点跟着改。开源侧两行都不需要:.claude/ 本就不导出,.superpowers/ 已在 DELETE 表。
  { path: '.gitignore',
    find: '\n# Claude Code local state (isolated worktrees, session config) — not committed\n.claude/\n# .superpowers/ IS committed — the ledgers are the only decision record per sprint. SP7 once\n# lost the whole directory with no git recovery, and SP9-P7 found the P5/P6 ledgers only\n# existed in gitignore. Rules live in .superpowers/.gitignore:\n# ledgers (.md) and self-check screenshots (.png) go in; review diffs / backups / snapshot-env machine artifacts stay out.\n',
    replace: '' },
  { path: '.gitignore',
    find: '\n# Time-machine acceptance test bench (T12): fake backend + dedicated vite config, local acceptance only, not versioned\nscripts/tmlab/\nvite.config.tmlab.ts',
    replace: '\n# Export report (carries the upstream commit hash) — local traceability only\n.export-report.txt' },

  // ═══════════════════ T8:i18n 四个 locale + theme.css ═══════════════════

  // ── src/i18n/zh_cn.base.ts(全区文案基座,8 处锚点,共 44 键)────────────────
  //    2026-08-05(SP7-P8b):原 zh_cn.ts 已改名 base、并新增 3 行合并出口 zh_cn.ts,
  //    锚点路径跟着改。相册那 702 键不在这里剥 —— 它们整块进了 zh_cn.photos.ts,
  //    由 DELETE 表整体删掉(见类 1),这也是当初拆分片的目的。
  // 11 个 audio 转录键(brief 漏登记的部分;audioSkipBack/Forward/Speed 播放器控件保留)
  { path: 'src/i18n/zh_cn.base.ts',
    find: "  audioSummary: '摘要',\n  audioTranscript: '转录文稿',\n  audioAsk: '问 Nimo',\n  audioAskPlaceholder: '关于这段音频，尽管问…',\n  audioAskEmpty: '这段音频的转录已向量化 — 关于内容尽管问 Nimo。',\n  audioAskDemo: '(demo 占位) 转录已向量化。接入 AI 后端后，这里会根据音频内容作答，并附上可跳转的时间戳。',\n  audioHighlightsOnly: '只看重点',\n  audioShowAll: '显示全部',\n  audioSpeakerAll: '全部',\n  audioChapters: '章节',\n  audioAllChapters: '全部章节',\n",
    replace: "" },
  // appPhotos/appAi:systemApps.ts 对应条目已在 T6 删除;appKnowledge 是 SP14 T9 追加的
  // 第三个同类孤儿键(knowledge 系统应用条目已在上面的 systemApps.ts PATCH 段摘掉)。
  { path: 'src/i18n/zh_cn.base.ts',
    find: "  appPhotos: '照片',\n  appAi: 'Nimo AI',\n  appKnowledge: '知识库',\n",
    replace: "" },
  { path: 'src/i18n/zh_cn.base.ts',
    find: "  widgetAiTitle: 'AI 助手',\n  widgetAiDesc: '对话与智能建议',\n",
    replace: "" },
  // widgetAi* 其余 7 键:AiWidget.vue 已整体删除(DELETE 表),全部孤儿
  { path: 'src/i18n/zh_cn.base.ts',
    find: "  widgetAiGreetShort: '晚上好',\n  widgetAiGreet: '晚上好，有什么可以帮你？',\n  widgetAiPlaceholder: '发消息给 AI 助手…',\n  widgetAiSend: '发送',\n  widgetAiPrompt1: '整理最近的照片',\n  widgetAiPrompt2: '查找 2024 旅行视频',\n  widgetAiPrompt3: '分析存储使用情况',\n",
    replace: "" },
  // addPanelTabPhoto:T11 删 AddPanel 照片 tab 后的孤儿键,此处先清 i18n 侧
  { path: 'src/i18n/zh_cn.base.ts',
    find: "  addPanelTabPhoto: '照片',\n",
    replace: "" },
  { path: 'src/i18n/zh_cn.base.ts',
    find: "  addPanelNoPhotos: '暂无照片',\n",
    replace: "" },
  // topbarSearch(Kbd):HomeTopbar.vue 搜索胶囊按钮已在 T6 删除
  { path: 'src/i18n/zh_cn.base.ts',
    find: "  topbarSearch: '搜索',\n  topbarSearchKbd: '搜索 (⌘K)',\n",
    replace: "" },
  // "主页:搜索面板"整节 18 键:SearchDialog.vue 已整体删除(DELETE 表)
  { path: 'src/i18n/zh_cn.base.ts',
    find: "  // ── 主页:搜索面板 ──\n  searchPlaceholder: '你在找什么?',\n  searchClose: '关闭',\n  searchSearching: '搜索中…',\n  searchResultsCount: '{count} 条结果',\n  searchOpenAlbum: '打开相册 ›',\n  searchAlbumMatches: '在 AI 相册找到 {count} 个匹配(图片 / 视频)',\n  searchOpenFolder: '打开文件夹 ›',\n  searchOpenFolderTitle: '在文件中打开此文件夹',\n  searchAskTitle: '向 Nimo AI 询问「{query}」',\n  searchAskSub: '把它发送给 AI 助手,获得基于你文件的回答',\n  searchAskGo: '询问 ›',\n  searchAskButton: 'Ask Nimo',\n  searchHint: '输入关键词并回车,搜索图片、文档、视频、音频与设置',\n  searchTabAll: '全部结果',\n  searchTabDocuments: '文档',\n  searchTabImages: '图片',\n  searchTabAudio: '音频',\n  searchTabVideos: '视频',\n",
    replace: "" },

  // ── src/i18n/en_us.base.ts(与上面 8 条逐条成对,parity.test.ts 的前置)──────
  { path: 'src/i18n/en_us.base.ts',
    find: "  audioSummary: 'Summary',\n  audioTranscript: 'Transcript',\n  audioAsk: 'Ask Nimo',\n  audioAskPlaceholder: 'Ask anything about this audio…',\n  audioAskEmpty: 'This transcript is vectorized — ask Nimo about anything in it.',\n  audioAskDemo: '(demo) This transcript is vectorized. Once the AI backend is connected, answers grounded in the audio — with clickable timestamps — will appear here.',\n  audioHighlightsOnly: 'Highlights only',\n  audioShowAll: 'Show all',\n  audioSpeakerAll: 'All',\n  audioChapters: 'Chapters',\n  audioAllChapters: 'All chapters',\n",
    replace: "" },
  { path: 'src/i18n/en_us.base.ts',
    find: "  appPhotos: 'Photos',\n  appAi: 'Nimo AI',\n  appKnowledge: 'Knowledge',\n",
    replace: "" },
  { path: 'src/i18n/en_us.base.ts',
    find: "  widgetAiTitle: 'AI Assistant',\n  widgetAiDesc: 'Chat and smart suggestions',\n",
    replace: "" },
  { path: 'src/i18n/en_us.base.ts',
    find: "  widgetAiGreetShort: 'Good evening',\n  widgetAiGreet: 'Good evening — how can I help?',\n  widgetAiPlaceholder: 'Message the AI assistant…',\n  widgetAiSend: 'Send',\n  widgetAiPrompt1: 'Organize recent photos',\n  widgetAiPrompt2: 'Find 2024 travel videos',\n  widgetAiPrompt3: 'Analyze storage usage',\n",
    replace: "" },
  { path: 'src/i18n/en_us.base.ts',
    find: "  addPanelTabPhoto: 'Photos',\n",
    replace: "" },
  { path: 'src/i18n/en_us.base.ts',
    find: "  addPanelNoPhotos: 'No photos',\n",
    replace: "" },
  { path: 'src/i18n/en_us.base.ts',
    find: "  topbarSearch: 'Search',\n  topbarSearchKbd: 'Search (⌘K)',\n",
    replace: "" },
  // 交接清单盲区(E1):settingsFpIntro 那一条不在这批里,英文侧本身就没有任何词命中,靠这份成对表兜底,见下方 sp9 块
  { path: 'src/i18n/en_us.base.ts',
    find: "  // ── Home: search palette ──\n  searchPlaceholder: 'what are u looking for',\n  searchClose: 'Close',\n  searchSearching: 'Searching…',\n  searchResultsCount: '{count} results',\n  searchOpenAlbum: 'Open Album ›',\n  searchAlbumMatches: 'Found {count} matches in AI Album (images / videos)',\n  searchOpenFolder: 'Open folder ›',\n  searchOpenFolderTitle: 'Open this folder in Files',\n  searchAskTitle: 'Ask Nimo AI about “{query}”',\n  searchAskSub: 'Send this to the AI assistant for an answer grounded in your files',\n  searchAskGo: 'Ask ›',\n  searchAskButton: 'Ask Nimo',\n  searchHint: 'Type a keyword and press Enter to search images, documents, videos, audio and settings',\n  searchTabAll: 'All results',\n  searchTabDocuments: 'Documents',\n  searchTabImages: 'Images',\n  searchTabAudio: 'Audio',\n  searchTabVideos: 'Videos',\n",
    replace: "" },

  // ── 两处"保留文件里顺带提到相册"的注释,改写措辞(不删代码)────────────────
  //    stores/toast.ts:`action` 参数的来历注释举了相册回收站的撤销 pill 做例子;
  //    color-guard.test.ts:实测命中的 4 个文件名里有 3 个是相册组件。两处都只是**举例**,
  //    代码本身与相册无关且必须保留,故改写成不点名的等价说法。
  { path: 'src/stores/toast.ts',
    find: "// `action` (Task 9, SP7-P3 photos trash view): optional inline affordance (e.g.\n",
    replace: "// `action`: optional inline affordance (e.g.\n" },
  { path: 'src/styles/color-guard.test.ts',
    find: `// stops working on these files. This round's scan hit 4 files (ClusterActionDialog / PersonRelGraph / PersonPlacesTab /
// PhotosTrash) — they happened to be passing at the time (not a false pass), but both hazards were real.
`,
    replace: `// stops working on these files. The scan at the time hit 4 component files — they happened to be passing (not a false pass), but both hazards were real.
` },

  // ── src/styles/theme.css:相册专用 token 组整块删除 ─────────────────────────
  //    这些 token 的消费方(src/photos/** 与 13 个相册视图)已在 DELETE 表,删完全部成为
  //    孤儿;且它们的注释逐条引用 Vue2 photos.scss / photos-places.scss 的行号,属 E7
  //    「一份内部文档都不带」的范围。照既有 --spk-*/--orb-* 的处理方式整组删(注释与 token
  //    一起),而不是把注释改写成泛化措辞留下孤儿 token。
  //    深浅两套主题块各一份,逐块成对。**未删的相册孤儿 token**:--divider / --panel-bg-solid
  //    ——名字通用、无相册字样、不触发任何禁词,留着零成本,删了反而可能被后来人重新发明。
  // --album-cover-fallback(PhotosAlbums/PhotosAlbumDetail 专用)
  { path: 'src/styles/theme.css',
    find: `  /* Album no-cover gradient placeholder (PhotosAlbums.vue / PhotosAlbumDetail.vue each used
     to have their own byte-for-byte copy of
     linear-gradient(135deg, color-mix(accent 35%, panel-bg), accent); lifted into a token
     to kill the duplication -- both sites now use this, see THEMING.md's plain semantic-token
     usage outside the exceptions list). */
  --album-cover-fallback: linear-gradient(135deg, color-mix(in srgb, var(--accent) 35%, var(--panel-bg)), var(--accent));
`,
    replace: '' },
  // --avatar-fallback(PersonAvatar 专用)
  { path: 'src/styles/theme.css',
    find: `  /* Person avatar's third-tier fallback gradient fill (PersonAvatar.vue, SP7-P5). Aims to
     match Vue2's five duplicated copies of
     linear-gradient(135deg,#6E5BFF,#4A3BD1)/(135deg,#8950F2,#6c3bcd) (the two variants
     already disagreed with each other; unified into a single token here). Mixes --accent
     with darkening instead of hardcoding a fixed accent hue, keeping the "colors always go
     through a token" line intact; the actual contrast math lives in PersonAvatar.vue's
     top-of-file comment and the task report. */
  --avatar-fallback: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #000));
`,
    replace: '' },
  // --place-row-* 三色(PlacesRail)
  { path: 'src/styles/theme.css',
    find: `  /* PlacesRail.vue (P6a-T5) selected-city row, three spots -- an exact port of Vue2
     photos-places.scss:153-156/:163-167's rgba(var(--accent-rgb), 0.10/0.30/0.18) (that
     view only ever had a dark design; the numeric precision required calls for a
     dedicated token instead of settling for one of --accent-soft's three tiers, following
     the existing precedent set by --drop-bg/--spark-fill/--orb-glow). */
  --place-row-bg: rgba(138, 180, 255, 0.10);
  --place-row-border: rgba(138, 180, 255, 0.30);
  --place-thumb-active: rgba(138, 180, 255, 0.18);
`,
    replace: '' },
  // --pin-* 六色 + --pin-cluster-stroke(PlacesMap 图钉)
  { path: 'src/styles/theme.css',
    find: `  /* PlacesMap.vue (P6a-T6) map pins -- an exact port of Vue2 photos-places.scss:366-411's
     rgba(var(--accent-rgb), α). Vue2 explicitly marks --accent-rgb theme-invariant
     (permanently 110,91,255), meaning these alpha layers don't change between the dark and
     light app themes -- the pins sit on the map preset's own canvas (4 presets plus a
     custom color, independent of the app theme's light/dark state; custom mode always has
     a dark backdrop), so alpha can't be lowered to follow the app theme, or a "light app
     theme + dark custom backdrop" combination would wash the pins out entirely. So both
     theme blocks share identical alpha; only the RGB follows this repo's dark/light
     --accent-rgb pair. */
  --pin-bg: rgba(138, 180, 255, 0.16);
  --pin-stroke: rgba(138, 180, 255, 0.55);
  --pin-active-bg: rgba(138, 180, 255, 0.30);
  --pin-pulse: rgba(138, 180, 255, 0.25);
  --pin-cluster-hover-bg: rgba(138, 180, 255, 0.42);
  --pin-glow: rgba(138, 180, 255, 0.7);
  /* Vue2's original value is a pale-lilac rgba(196,184,255,0.85), lighter than accent, so
     a cluster reads as "a group" rather than a single point; here the RGB is swapped for
     this repo's --accent-text (169,198,255) -- its semantics are exactly "an
     accent-derived hue that's lighter/more readable than accent", with the alpha an exact
     port of the original 0.85. */
  --pin-cluster-stroke: rgba(169, 198, 255, 0.85);
`,
    replace: '' },
  // --place-current-trip
  { path: 'src/styles/theme.css',
    find: `  /* Vue2's original value #34c759 (the current-trip color, also used by the legend's fourth
     group), the same value in both themes -- not reusing this repo's --good (that's a
     teal-leaning #5fe3b0/#15754c, distinct from the iOS hue, an approximation rather than
     an exact port). */
  --place-current-trip: #34c759;
`,
    replace: '' },
  // --place-home-base(PlaceDetailPanel)
  { path: 'src/styles/theme.css',
    find: `  /* PlaceDetailPanel.vue (P6b-T3) "home base" marker color -- a new token, an exact port
     of Vue2 photos-places.scss's inline \`style="color:#c4b8ff"\` (:1078). Deviation on
     record (the brief literally asks for different values per theme: dark stays light
     violet, light shifts toward a deeper tone, the same approach as --accent-text): here
     it's changed to **the same value in both themes**, not following the app theme's
     light/dark split -- it sits in exactly the same context as its neighbor
     --place-current-trip (inside .ttl-region, layered over the hero's darkened cover
     photo, and that scrim is itself pinned permanently dark regardless of whether the app
     skin is dark or paper-toned); giving the light theme a deeper-violet version as the
     brief literally asks would push that deep-violet text onto a permanently dark photo
     gradient in the light app theme, a direct violation of this task's "hero foreground
     color line". Not settling for --accent-text either: that token's semantics are
     "lighter/more readable than accent" (an azure-leaning hue), while this one needs to be
     the second status color paired alongside "current trip" (a violet-leaning hue) --
     following the same swap-the-base-hue-but-not-the-semantics precedent as
     --pin-cluster-stroke, except here even the alpha/exact color value is copied straight
     from the Vue2 literal (theme-invariant, the same precedent as --place-current-trip). */
  --place-home-base: #c4b8ff;
`,
    replace: '' },
  // --map-dot-bg-fallback(PlacesMap 陆地点阵)
  { path: 'src/styles/theme.css',
    find: `  /* PlacesMap.vue (P6a-T6) land-dot-grid base color CSS fallback -- theme-invariant, same
     value in both theme blocks. An exact port of Vue2 photos-places.scss:347's literal
     rgba(255,255,255,0.10) (that view deliberately avoids the --ink/text-color family,
     because this layer sits over the map preset's own dark canvas, independent of the
     app theme). This can't be swapped for this repo's --fg-faint: dark theme's --fg-faint
     is rgba(255,255,255,0.52) (0.52 vs 0.10 -- the land dot grid would brighten enough to
     overpower --map-dot's visited-point markers), and light theme's --fg-faint is worse
     still, an opaque warm neutral #9a958a (which turns into a solid tinted block when laid
     over custom mode's plain dark map canvas) -- review I1 re-verified this failure path
     is genuinely reachable (Vue2's two most common paths, :150/:137, both leave dotBg
     null, i.e. both fall through to this CSS default -- not a rare branch). */
  --map-dot-bg-fallback: rgba(255, 255, 255, 0.10);
`,
    replace: '' },
  // --float-bg(PlacesZoomBar 浮动药丸底)
  { path: 'src/styles/theme.css',
    find: `  /* PlacesZoomBar.vue (P6a-T8) vertical zoom slider's floating pill background -- a new
     token, an exact port of Vue2 photos.scss:49 (NimoOS-UI's shared global floating-bar/FAB
     background, not something photos-places.scss defines on its own). This repo had no
     equivalent "translucent floating toolbar background" token before -- --panel-bg (0.1),
     --popup-bg (a gradient, ~0.9-0.95), and --tool-bg (0.16, an opaque flat color) all miss
     this flat 0.85 magnitude, hence a new token rather than an approximation. */
  --float-bg: rgba(20, 20, 28, 0.85);
`,
    replace: '' },
  // --zb-hover-bg / --zb-track-bg
  { path: 'src/styles/theme.css',
    find: `  /* Same component -- Vue2 uses rgba(var(--ink), 0.08/0.12) for .zb-btn:hover's background
     and .zb-track's base color, an "alpha ramp that follows the text color"; this repo has
     no --ink RGB-triple token. The alpha is an exact port of Vue2's 0.08/0.12, but the RGB
     is swapped for this repo's --fg's actual decomposed value (dark theme #ffffff ->
     255,255,255) -- not copied from Vue2's light-theme --ink value of (35,37,43) (that
     value is, per Vue2's own comment, only an approximation of "AI --text-primary", not a
     precise design value), following the same base-hue-swap precedent as
     --pin-cluster-stroke. */
  --zb-hover-bg: rgba(255, 255, 255, 0.08);
  --zb-track-bg: rgba(255, 255, 255, 0.12);
`,
    replace: '' },
  // --zb-thumb-shadow
  { path: 'src/styles/theme.css',
    find: `  /* .zb-thumb handle's second shadow layer -- Vue2 photos-places.scss:281's box-shadow
     \`0 1px 4px rgba(0,0,0,0.4)\` never varied across Vue2's own dark/light themes,
     theme-invariant, same value in both theme blocks (precedent: --place-current-trip). */
  --zb-thumb-shadow: rgba(0, 0, 0, 0.4);
`,
    replace: '' },
  // --warn-*(人脸识别关闭 / Photos AI 离线两条横幅)
  { path: 'src/styles/theme.css',
    find: `  /* Warning/degraded semantics (SP7-P5: the face-recognition-disabled and Photos AI
     backend-offline banners). Aligned with Vue2's #FF9F0A family; the dark theme takes
     the original value directly, the light theme darkens the foreground for contrast
     following this repo's existing --dem-* approach. */
  --warn-fg: #ff9f0a;
  --warn-bg: rgba(255, 159, 10, 0.08);
  --warn-border: rgba(255, 159, 10, 0.32);
`,
    replace: '' },
  // --badge-photo/video/ocr(搜索结果媒体类别徽标)
  { path: 'src/styles/theme.css',
    find: `  /* SP7-P7a-T15: the three colors for the search result card's top-left media-category
     badge (.type-badge[data-type]) -- data-visualization category colors (a variant of
     THEMING.md §0's third exception category: the same result set needs to tell "photo /
     video / OCR hit" categories apart from each other, so the color semantics are "which
     category" rather than "theme accent"). An exact port of Vue2 photos.scss:2768-2770's
     literals, same value in both theme blocks -- doesn't follow the skin's light/dark
     state, the same precedent as --place-current-trip/--console-bg (see THEMING.md §6 for
     the same category of precedent). Not settling for --accent/--danger: those three are
     parallel category labels, not an "emphasis" or "danger" semantic. */
  --badge-photo: rgba(50, 190, 230, 0.9);   /* cyan */
  --badge-video: rgba(255, 149, 10, 0.92);  /* amber */
  --badge-ocr: rgba(16, 185, 129, 0.92);    /* emerald */
`,
    replace: '' },
  // --photos-seg-*(设置页容量条分段色)
  { path: 'src/styles/theme.css',
    find: `  /* SP7-P8a-T3: settings page storage card's capacity bar segment colors
     (PhotosStorageCard.vue, consumed by src/photos/util/storagePalette.ts's
     STORAGE_SEG_COLORS) -- like the previous group, these are **data-visualization
     category colors**: the same capacity bar needs to tell the four distinct data
     segments videos/raw/ai/other apart, so the color semantics are "which data category"
     rather than "theme accent". The photos segment reuses --accent, the thumbs segment
     reuses --success (existing semantic tokens reused as-is, no new ones needed); these
     four are Vue2-inline literals with no matching semantic token in this repo, hence new
     ones. Dark theme is an exact port of Vue2 PhotosSettings.vue:320/321/323's literals;
     light theme can't just copy the dark values -- videos' mid-tone and raw's soft pale
     tint both wash out and blur the segment boundaries against this theme's fully opaque
     --card-bg (#ffffff), so each is darkened/saturated to stay legible on a pale
     background (the same established technique as --warn-fg's light-theme handling,
     which darkens #FF9F0A to #96610a for contrast -- but these are three parallel
     category labels rather than a single warning semantic, so each gets its own
     independent value instead of borrowing --warn-fg). */
  --photos-seg-video: #5e94ff;
  --photos-seg-raw: #ff9ac2;
  --photos-seg-ai: #ff9f0a;
  /* The other segment's Vue2 original value is rgba(var(--ink),0.25) (an "alpha ramp that
     follows the text color"), and this repo has no --ink RGB-triple token -- following the
     same established base-hue-swap precedent as --zb-hover-bg/--zb-track-bg: alpha is an
     exact port of 0.25, RGB is swapped for this repo's --fg's actual decomposed value
     (dark theme #ffffff -> 255,255,255). */
  --photos-seg-other: rgba(255, 255, 255, 0.25);
`,
    replace: '' },
  // light:--album-cover-fallback
  { path: 'src/styles/theme.css',
    find: `  /* Album no-cover gradient placeholder (see the :root token of the same name's comment);
     the paper theme uses the same formula, and since --accent/--panel-bg are each already
     defined for this theme, the result naturally comes out in this theme's colors. */
  --album-cover-fallback: linear-gradient(135deg, color-mix(in srgb, var(--accent) 35%, var(--panel-bg)), var(--accent));
`,
    replace: '' },
  // light:--avatar-fallback
  { path: 'src/styles/theme.css',
    find: `  /* See the :root token of the same name's comment; the paper theme's accent is deeper, so
     the mix percentage is raised to 70% to avoid the whole thing blurring into a near-dark
     blob (actual contrast math is in PersonAvatar.vue / the task report). */
  --avatar-fallback: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #000));
`,
    replace: '' },
  // light:--place-row-*
  { path: 'src/styles/theme.css',
    find: `  /* Vue2 only ever designed a dark version of this view, so there's no original to copy
     for the light value -- derived using the accent family's dark->light convergence
     convention (.14->.11, .24->.20, .36->.30, roughly x0.83): .10->.08, .30->.25,
     .18->.15. */
  --place-row-bg: rgba(59, 91, 219, 0.08);
  --place-row-border: rgba(59, 91, 219, 0.25);
  --place-thumb-active: rgba(59, 91, 219, 0.15);
`,
    replace: '' },
  // light:--pin-*
  { path: 'src/styles/theme.css',
    find: `  /* PlacesMap.vue (P6a-T6) map pins -- see the :root token of the same name's comment:
     alpha is identical to :root's (theme-invariant, sits on the map preset's own canvas,
     doesn't lower alpha to follow the app theme), RGB is swapped for this repo's light
     theme --accent-rgb (59,91,219). */
  --pin-bg: rgba(59, 91, 219, 0.16);
  --pin-stroke: rgba(59, 91, 219, 0.55);
  --pin-active-bg: rgba(59, 91, 219, 0.30);
  --pin-pulse: rgba(59, 91, 219, 0.25);
  --pin-cluster-hover-bg: rgba(59, 91, 219, 0.42);
  --pin-glow: rgba(59, 91, 219, 0.7);
`,
    replace: '' },
  // light:--pin-cluster-stroke
  { path: 'src/styles/theme.css',
    find: `  /* RGB is taken from this repo's light theme --accent-text (53,80,196), alpha is an
     exact port of Vue2's original 0.85 (see the :root token of the same name's comment). */
  --pin-cluster-stroke: rgba(53, 80, 196, 0.85);
`,
    replace: '' },
  // light:--place-current-trip
  { path: 'src/styles/theme.css',
    find: `  /* Same value in both themes, see the :root token of the same name's comment. */
  --place-current-trip: #34c759;
`,
    replace: '' },
  // light:--place-home-base
  { path: 'src/styles/theme.css',
    find: `  /* Same value in both themes, see the :root token of the same name's comment (deviation
     on record: didn't give the light theme a deeper-violet version as literally required
     -- the reasoning is the same as the :root block's full write-up: it sits in exactly
     the same context as --place-current-trip, permanently layered over the hero's fixed
     darkening gradient, independent of whether the app skin is dark or paper-toned). */
  --place-home-base: #c4b8ff;
`,
    replace: '' },
  // light:--map-dot-bg-fallback
  { path: 'src/styles/theme.css',
    find: `  /* theme-invariant, same value in both theme blocks -- see the :root token of the same
     name's comment (same reasoning as above for not using --fg-faint: light theme's
     --fg-faint is an opaque warm neutral #9a958a, which would likewise turn into a solid
     tinted block over the map canvas). */
  --map-dot-bg-fallback: rgba(255, 255, 255, 0.10);
`,
    replace: '' },
  // light:--float-bg
  { path: 'src/styles/theme.css',
    find: `  /* PlacesZoomBar.vue (P6a-T8) -- see the :root token of the same name's comment. An
     exact port of Vue2 photos.scss:84's light-theme floating-bar-background literal. */
  --float-bg: rgba(255, 255, 255, 0.85);
`,
    replace: '' },
  // light:--zb-hover-bg / --zb-track-bg
  { path: 'src/styles/theme.css',
    find: `  /* See the :root token of the same name's comment: alpha is identical to :root's
     (0.08/0.12), RGB is swapped for this repo's light theme --fg's actual decomposed
     value (#1c1b19 -> 28,27,25). */
  --zb-hover-bg: rgba(28, 27, 25, 0.08);
  --zb-track-bg: rgba(28, 27, 25, 0.12);
`,
    replace: '' },
  // light:--zb-thumb-shadow
  { path: 'src/styles/theme.css',
    find: `  /* Same value in both themes, see the :root token of the same name's comment. */
  --zb-thumb-shadow: rgba(0, 0, 0, 0.4);
`,
    replace: '' },
  // light:--warn-*
  { path: 'src/styles/theme.css',
    find: `  /* Warning/degraded semantics (see the :root token of the same name's comment). #FF9F0A
     laid directly over the paper theme's pale background is only ~1.9:1, so the
     foreground is darkened to a deep amber (matching --dem-fg's #92600c tier), while the
     background/border get the paper theme's solid tints. */
  --warn-fg: #96610a;
  --warn-bg: #fdf3e2;
  --warn-border: #f0d7a6;
`,
    replace: '' },
  // light:--badge-*
  { path: 'src/styles/theme.css',
    find: `  /* SP7-P7a-T15: same as the :root token of the same name's comment -- the three media
     category badge colors, same value in both theme blocks, doesn't flip with the skin. */
  --badge-photo: rgba(50, 190, 230, 0.9);
  --badge-video: rgba(255, 149, 10, 0.92);
  --badge-ocr: rgba(16, 185, 129, 0.92);
`,
    replace: '' },
  // light:--photos-seg-*
  { path: 'src/styles/theme.css',
    find: `  /* SP7-P8a-T3: same as the :root token of the same name's comment -- storage card
     capacity bar segment colors. The light theme tunes these for legibility (not a
     straight copy of Vue2's only-ever-dark design):
     --photos-seg-video is deepened from Vue2's mid-tone azure #5e94ff to #3560d8 -- the
     original value looked washed-out and made segment boundaries unclear against this
     theme's fully opaque --card-bg (#ffffff); deepening/saturating it keeps the same hue
     family.
     --photos-seg-raw is deepened from Vue2's pale pink #ff9ac2 to #c93f79 -- the pale pink
     nearly disappeared into a plain pale background, so it's darkened into a rose of the
     same hue to keep the segment outline legible.
     --photos-seg-ai is darkened from Vue2's amber #ff9f0a to #a15f0a -- the same
     established technique as --warn-fg's light-theme handling of the identical literal
     color value (darken for contrast), but this is an independent category-label token
     that doesn't directly borrow --warn-fg (that one is the "warning" semantic, this one
     is the "which data category" semantic -- the same literal color value, two different
     tokens). */
  --photos-seg-video: #3560d8;
  --photos-seg-raw: #c93f79;
  --photos-seg-ai: #a15f0a;
  /* alpha matches :root's 0.25 (an exact port of Vue2's other segment's
     rgba(var(--ink),0.25)), RGB is swapped for this repo's light theme --fg's actual
     decomposed value (#1c1b19 -> 28,27,25) -- the same established base-hue-swap formula
     as --zb-hover-bg/--zb-track-bg's light tier. */
  --photos-seg-other: rgba(28, 27, 25, 0.25);
`,
    replace: '' },

  // ── src/router/index.ts:14 个相册视图 import + 14 条 /photos* 路由 ────────────
  //    两段各自连续,整块摘。DELETE 表已删掉那 14 个 .vue 文件,不摘 import 的话开源侧
  //    vite build 直接找不到模块 —— 这两条补丁与 DELETE 是配对的,少一边都不行。
  { path: 'src/router/index.ts',
    find: `import Photos from '../views/Photos.vue'
import PhotosFavorites from '../views/PhotosFavorites.vue'
import PhotosTrash from '../views/PhotosTrash.vue'
import PhotosAlbums from '../views/PhotosAlbums.vue'
import PhotosAlbumDetail from '../views/PhotosAlbumDetail.vue'
import PhotosPeople from '../views/PhotosPeople.vue'
import PhotosPersonDetail from '../views/PhotosPersonDetail.vue'
import PhotosPlaces from '../views/PhotosPlaces.vue'
import PhotosPlaceAssets from '../views/PhotosPlaceAssets.vue'
import PhotosSmartViews from '../views/PhotosSmartViews.vue'
import PhotosSmartViewDetail from '../views/PhotosSmartViewDetail.vue'
import PhotosMomentDetail from '../views/PhotosMomentDetail.vue'
import PhotosSearch from '../views/PhotosSearch.vue'
import PhotosSettings from '../views/PhotosSettings.vue'
`,
    replace: '' },
  { path: 'src/router/index.ts',
    find: `  { path: '/photos', name: 'photos', component: Photos },
  { path: '/photos/favorites', name: 'photos-favorites', component: PhotosFavorites },
  { path: '/photos/trash', name: 'photos-trash', component: PhotosTrash },
  { path: '/photos/albums', name: 'photos-albums', component: PhotosAlbums },
  { path: '/photos/albums/:id', name: 'photos-album-detail', component: PhotosAlbumDetail },
  { path: '/photos/people', name: 'photos-people', component: PhotosPeople },
  { path: '/photos/people/:id', name: 'photos-person-detail', component: PhotosPersonDetail },
  { path: '/photos/places', name: 'photos-places', component: PhotosPlaces },
  { path: '/photos/places/:key', name: 'photos-place-assets', component: PhotosPlaceAssets },
  { path: '/photos/smart-views', name: 'photos-smart-views', component: PhotosSmartViews },
  { path: '/photos/smart-views/:id', name: 'photos-smart-view-detail', component: PhotosSmartViewDetail },
  // SP15-P1-T7: append only, never reorder — router/index.test.ts asserts the source line order.
  { path: '/photos/moments/:id', name: 'photos-moment-detail', component: PhotosMomentDetail },
  { path: '/photos/search', name: 'photos-search', component: PhotosSearch },
  // SP7-P8a-T5: append only, never reorder — must come after the last existing /photos/*
  // (router/index.test.ts asserts source-text line order via node:fs, not router.getRoutes(); see that test file's comments).
  { path: '/photos/settings', name: 'photos-settings', component: PhotosSettings },
`,
    replace: '' },

  // ── src/components/AppToast.zIndex.test.ts:去相册两处点名 ──────────────────
  //    这道闸是**全仓约定守卫**(toast 必须高于所有模态遮罩),开源版要保留 —— 它 glob 全仓
  //    样式块、相册文件删掉后自然不再被扫到。要摘的只有两处点名:①文件头注释里举例的三条
  //    相册失败路径与 .pd-scrim/.cad-overlay ②末尾单独钉那两个相册遮罩的 it.each 块
  //    (整块删:它只有相册两条,前面那条 glob 全量断言仍在)。
  { path: 'src/components/AppToast.zIndex.test.ts',
    find: `// Why this needs a test: the scrims all carry backdrop-filter, so a toast buried under one is not
// "a bit gray" but **completely unreadable**. Real consequence caught in this sprint's review —
// three "failed but the dialog is deliberately kept open for retry" paths (rename person failed /
// create album failed / name unnamed person failed) all hid the failure reason under the
// z-index 220 .pd-scrim / .cad-overlay (since Plan D Task 4: renamed to .person-dialog-scrim,
// now 200, via the Vue2-parity stylesheet — still below toast either way); users only saw a
// button that "did nothing" and kept retrying.
`,
    replace: `// Why this needs a test: the scrims all carry backdrop-filter, so a toast buried under one is not
// "a bit gray" but **completely unreadable** — users only see a button that "did nothing" and keep retrying.
` },
  { path: 'src/components/AppToast.zIndex.test.ts',
    find: `  // Pin the two concrete scrims from the three review-hit paths individually (even if someone relaxes the previous test, this one remains).
  //
  // Plan D Task 4 update: both rules moved out of their component's own local \`<style
  // scoped>\` block (now deleted) into the global parity stylesheet — \`.pd-scrim\` was
  // renamed to the Vue2 anchor \`.person-dialog-scrim\` and now lives in
  // photos-people.scss; \`.cad-overlay\` kept its name (ClusterActionDialog.vue's classes
  // don't change per Plan D) but its rule now lives in that same parity file too. Point
  // both rows at the file that actually carries the rule now.
  it.each([
    ['src/photos/styles/vue2-parity/photos-people.scss', '.person-dialog-scrim'],
    ['src/photos/styles/vue2-parity/photos-people.scss', '.cad-overlay'],
  ])('%s %s is below toast', (rel, selector) => {
    const src = Object.entries(files).find(([p]) => relOf(p) === rel)?.[1]
    expect(src, \`\${rel} not collected by glob\`).toBeTruthy()
    const css = styleText(rel, src as string)
    // Take the z-index from the rule block containing this selector.
    const block = new RegExp(\`\\\\\${selector}\\\\s*\\\\{([^}]*)\\\\}\`).exec(css)
    expect(block, \`Cannot find \${selector} rule block in \${rel}\`).toBeTruthy()
    const z = zIndexes((block as RegExpExecArray)[1])
    expect(z.length, \`No z-index in \${selector} rule block\`).toBe(1)
    expect(z[0]).toBeLessThan(toastZ)
  })
`,
    replace: '' },

  // ── src/router/index.test.ts:相册路由的 14 条断言整块删除 ──────────────────
  //    本文件除开头两条 /files 用例外全是相册路由(命中 + "只追加不重排"顺序断言)。
  //    连带摘掉 `./index.ts?raw` 那个 import 与它上面的说明注释 —— 原文只被顺序断言用到,
  //    留着会是未使用变量(开源侧 vue-tsc 直接红)。
  { path: 'src/router/index.test.ts',
    find: `// Review M5: this comment used to claim the full ordering / no-reorder assertion lives in
// PhotosPlaces.test.ts, but that file only uses \`?raw\` to read PhotosPlaces.vue's own style
// block for a pointer-events assertion, and never reads the source text of router/index.ts —
// that claim was inaccurate. The real ordering / no-reorder assertion lives right here instead,
// checked against the raw source via \`?raw\`.
import routerIndexRaw from './index.ts?raw'
`,
    replace: '' },
  { path: 'src/router/index.test.ts',
    find: `  it('/photos/favorites matches the photos-favorites route', () => {
    const m = router.resolve('/photos/favorites')
    expect(m.name).toBe('photos-favorites')
  })
  it('/photos/trash matches the photos-trash route', () => {
    const m = router.resolve('/photos/trash')
    expect(m.name).toBe('photos-trash')
  })
  it('/photos/albums matches the photos-albums route', () => {
    const m = router.resolve('/photos/albums')
    expect(m.name).toBe('photos-albums')
  })
  it('/photos/albums/7 matches the photos-album-detail route, params.id is the string "7"', () => {
    const m = router.resolve('/photos/albums/7')
    expect(m.name).toBe('photos-album-detail')
    expect(m.params.id).toBe('7')
  })
  it('/photos/people matches the photos-people route', () => {
    const m = router.resolve('/photos/people')
    expect(m.name).toBe('photos-people')
  })
  it('/photos/people/7 matches the photos-person-detail route, params.id is the string "7"', () => {
    const m = router.resolve('/photos/people/7')
    expect(m.name).toBe('photos-person-detail')
    expect(m.params.id).toBe('7')
  })
  it('/photos/places matches the photos-places route', () => {
    const m = router.resolve('/photos/places')
    expect(m.name).toBe('photos-places')
  })

  // P6a-T11: append-only, no reordering — the new route must sit between /photos/people/:id
  // and /login, and their own relative order must not be disturbed (review M5: this assertion
  // used to exist only as an inaccurate comment; this backfills the real one).
  it('/photos/places is appended after /photos/people/:id and before /login (append-only, no reordering)', () => {
    const peopleDetailIdx = routerIndexRaw.indexOf(\`{ path: '/photos/people/:id'\`)
    const placesIdx = routerIndexRaw.indexOf(\`{ path: '/photos/places'\`)
    const loginIdx = routerIndexRaw.indexOf(\`{ path: '/login'\`)
    expect(peopleDetailIdx).toBeGreaterThan(-1)
    expect(placesIdx).toBeGreaterThan(peopleDetailIdx)
    expect(loginIdx).toBeGreaterThan(placesIdx)
  })

  // SP7-P7a-T4: /photos/smart-views matches the actually registered route (resolved for real
  // via the production router singleton's router.resolve, not a spy push — same established
  // pattern as every existing route assertion above).
  it('/photos/smart-views matches the photos-smart-views route', () => {
    const m = router.resolve('/photos/smart-views')
    expect(m.name).toBe('photos-smart-views')
  })

  // Append-only, no reordering — the new route must sit between /photos/places/:key and
  // /login, and their own relative order must not be disturbed (same established technique as
  // P6a-T11 above: compare line order in the source, not getRoutes() index — vue-router 4 sorts
  // dynamic-segment routes ahead of static ones, confirmed in P6b-T9, so comparing indexes
  // would reach the wrong conclusion).
  it('/photos/smart-views is appended after /photos/places/:key and before /login (append-only, no reordering)', () => {
    const placesKeyIdx = routerIndexRaw.indexOf(\`{ path: '/photos/places/:key'\`)
    const smartViewsIdx = routerIndexRaw.indexOf(\`{ path: '/photos/smart-views'\`)
    const loginIdx = routerIndexRaw.indexOf(\`{ path: '/login'\`)
    expect(placesKeyIdx).toBeGreaterThan(-1)
    expect(smartViewsIdx).toBeGreaterThan(placesKeyIdx)
    expect(loginIdx).toBeGreaterThan(smartViewsIdx)
  })

  // SP7-P7a-T6: /photos/smart-views/:id detail route, same established technique as above (line-order comparison + a real resolve).
  it('/photos/smart-views/7 matches the photos-smart-view-detail route, params.id is the string "7"', () => {
    const m = router.resolve('/photos/smart-views/7')
    expect(m.name).toBe('photos-smart-view-detail')
    expect(m.params.id).toBe('7')
  })

  it('/photos/smart-views/:id is appended after /photos/smart-views and before /login (append-only, no reordering)', () => {
    const listIdx = routerIndexRaw.indexOf(\`{ path: '/photos/smart-views'\`)
    const detailIdx = routerIndexRaw.indexOf(\`{ path: '/photos/smart-views/:id'\`)
    const loginIdx = routerIndexRaw.indexOf(\`{ path: '/login'\`)
    expect(listIdx).toBeGreaterThan(-1)
    expect(detailIdx).toBeGreaterThan(listIdx)
    expect(loginIdx).toBeGreaterThan(detailIdx)
  })
`,
    replace: '' },

  // ── src/i18n/parity.test.ts:P6a/P6b 的地点域键守卫整块删除 ────────────────
  //    它断言 photosPlaces* 键齐备、中文不含工程词、insight 插值槽两语言一致 —— 分片删掉
  //    之后这些键一个都不存在。前半段(locale parity / 值非空 / 分片不覆盖基座)与相册无关,
  //    保留。这里连块首那行注释一起摘,免得留下悬空注释。
  { path: 'src/i18n/parity.test.ts',
    find: `/* P6a-T4: completeness and terminology guard for the places-domain keys. */
describe('photosPlaces keys (SP7-P6a)', () => {
  it('all six continent keys are present, and every regionLabelKey return value has a translation', async () => {
    const { regionLabelKey } = await import('../photos/util/placesMap')
    for (const id of ['asia', 'americas', 'europe', 'africa', 'oceania', 'antarctica']) {
      const k = regionLabelKey(id)!
      expect(zh).toHaveProperty(k)
      expect(en).toHaveProperty(k)
    }
  })

  it('the Chinese copy avoids the engineering words 「簇」「聚类」「气泡」', () => {
    const bad = Object.entries(zh)
      .filter(([k]) => k.startsWith('photosPlaces'))
      .filter(([, v]) => typeof v === 'string' && /簇|聚类|气泡/.test(v))
    expect(bad).toEqual([])
  })

  /* P6b-T1: completeness and interpolation-slot guard for the place detail panel keys. */
  it('the P6b place keys exist in both locales with no empty values', () => {
    const keys = ['photosPlacesHomeBase', 'photosPlacesSpotResetName', 'photosPlacesCoverPageInfo',
      'photosPlacesInsightHome', 'photosPlacesInsightHomeBase', 'photosPlacesVisitHistory']
    for (const k of keys) {
      expect(String((zh as Record<string, unknown>)[k] ?? '')).not.toBe('')
      expect(String((en as Record<string, unknown>)[k] ?? '')).not.toBe('')
    }
  })
  it('insight keys have identical interpolation slots in both locales (a missing slot makes <i18n-t> silently drop content)', () => {
    const slots = (s: string) => (s.match(/\\{[a-zA-Z]+\\}/g) ?? []).sort()
    for (const k of ['photosPlacesInsightMostPhotographed', 'photosPlacesInsightTopSpot',
      'photosPlacesInsightCompanions', 'photosPlacesInsightHome']) {
      expect(slots(String((zh as Record<string, string>)[k]))).toEqual(slots(String((en as Record<string, string>)[k])))
    }
  })
})
`,
    replace: '' },

  // ── src/i18n/{zh_cn,en_us}.ts:合并出口去掉 photos 与 ai 两路 ──────────────
  //    分片文件已在 DELETE 表,这里只需把出口里的 import 与展开摘掉。**改一行文案不会
  //    动这里** —— 这正是 SP7-P8b / SP8-P6 把相册与 AI 文案拆出去换来的:开源侧对这两区
  //    文案的耦合从上百条锚点收敛成下面这 4 条,且锚的是结构、不是文案。
  //    ⚠️ SP8-P6-T7 重抓:T3 把出口从 3 行改成 4 行(多一片 ai),下面两条 find 因此
  //    hits=0,已按现场 sed 的逐字文本换成 4 行版。
  { path: 'src/i18n/zh_cn.ts',
    find: "import base from './zh_cn.base'\nimport photos from './zh_cn.photos'\nimport ai from './zh_cn.ai'\n\nexport default { ...base, ...photos, ...ai }\n",
    replace: "import base from './zh_cn.base'\n\nexport default { ...base }\n" },
  { path: 'src/i18n/en_us.ts',
    find: "import base from './en_us.base'\nimport photos from './en_us.photos'\nimport ai from './en_us.ai'\n\nexport default { ...base, ...photos, ...ai }\n",
    replace: "import base from './en_us.base'\n\nexport default { ...base }\n" },
  //    出口文件头那段"为什么拆"的注释整段撤掉:开源版里既没有相册区也没有 AI 区,解释
  //    "这两区文案怎么剥离"既无意义又泄露内部流程(E7)。zh 侧是长段、en 侧是两行,分别处理。
  //    ⚠️ SP8-P6-T7 重抓:T3 重写了 zh 侧整段文件头(多了 ai 分片那一行、多了末尾那段
  //    "sp9 不在本出口里"的装配说明),原锚点 hits=0;en 侧原锚点仍命中,但 T3 在它下面
  //    加了第二行点名 en_us.ai.ts —— 只换第一行会把那行 AI 说明留在公开仓,故把锚点扩到两行。
  //    末尾那段"sp9 走第二条装配路径"的提醒与相册/AI 无关、在产出树里依然成立(sp9 分片
  //    是保留面),故不整段丢掉,改写成只提 base 的版本一并留下。
  { path: 'src/i18n/zh_cn.ts',
    find: `// SP7-P8b: this file changed from "one whole copy table" into a few-line **merge outlet**; the real content is split into pieces:
//   zh_cn.base.ts   — copy shared across areas + each area's own copy
//   zh_cn.photos.ts — the 702 photos* keys of the Photos area
//   zh_cn.ai.ts     — the 1207 ai* keys of the AI area (added during the SP8-P6 merge)
//
// Why split: the OSS edition has no Photos area and no AI area; \`oss/manifest.mjs\` must
// strip those two blocks of copy. Those keys used to be scattered across 90+ sections of
// the main file; stripping them meant hundreds of anchor patches × 2 languages — and PATCH
// requires each anchor to match exactly once, so **any future edit to a photos/AI string
// would break the OSS export**. After the split, the OSS side only needs to delete
// zh_cn.photos.ts / zh_cn.ai.ts and patch away the two spread lines below.
//
// Why keep this file as the outlet (instead of having consumers import the pieces
// themselves): 40+ tests across the repo do \`import zh from '…/i18n/zh_cn'\` and build their
// own createI18n; changing each to "import one more piece" is noisy and would repeat at the
// next sharding. With the outlet unchanged, consumers change zero lines.
//
// Note: the SP9 shard (zh_cn.sp9.ts) is **not part of this outlet** — it is merged in
// separately in i18n/index.ts and parity.test.ts; that is a second assembly path distinct from base/photos/ai here.
`,
    //    ⚠️ 措辞受 tree.test.mjs「PATCH 的 replace 内容也不含固定清单里的词」那道守卫约束:
    //    期号只允许以**文件名**形式出现(正则 /\bSP\d(?!\.ts)/i 的 (?!\.ts) 豁免),所以
    //    下面写 "zh_cn.sp9.ts 那一片" 而不是 "sp9 那一片"。第一版写成后者被守卫逮到。
    replace: `// Chinese copy (default / fallback locale).
//
// Note: the zh_cn.sp9.ts shard is **not part of this outlet** — it is merged in separately
// in i18n/index.ts and parity.test.ts; that is a second assembly path distinct from base here.
` },
  { path: 'src/i18n/en_us.ts',
    find: `// SP7-P8b:合并出口 —— 拆分理由与结构说明见 zh_cn.ts 的文件头注释(两语言逐条成对)。
// SP8-P6 合流:新增 ai 一片(en_us.ai.ts),与 zh 侧逐条对应。
`,
    replace: `// English copy. Key set must stay in parity with zh_cn (see parity.test.ts).
` },

  // ── src/i18n/zh_cn.sp9.ts(folder-permissions 整个四分区,26 键;
  //    FolderPermissionsPanel.vue + folderPerm/ 已在 DELETE 表整体删除,
  //    这 26 个键零消费方——brief 原文只点了 8-10 个样本键,实数 26,已重新核验)──
  { path: 'src/i18n/zh_cn.sp9.ts',
    find: "  settingsTabFolderPermissions: '文件夹权限',\n",
    replace: "" },
  // settingsFpIntro 在这个块里(盲区键,英文侧值只含 smart,守卫不收,靠本条手动清)
  { path: 'src/i18n/zh_cn.sp9.ts',
    find: "  // ── SP9-P4 folder-permissions(四分区) ─────────────────────────────────\n  settingsFpIntro: '在下方各分区分别管理每个智能功能的文件夹。',\n  settingsFpDataPending: '数据源待相册区(SP7)与 AI 区(SP8)合并后接入。',  // 🆕本期新增\n  settingsFpFilenameIndex: '文件名索引',\n  settingsFpServiceOffline: '服务离线',\n  settingsFpFilenameDesc: '纳入文件名搜索索引的文件夹。',\n  settingsFpNoFolders: '暂无文件夹。',\n  settingsFpKnowledge: '知识库',\n  settingsFpKnowledgeDesc: '纳入知识库(RAG)索引的文件夹。',\n  settingsFpIndexedFolders: '索引目录',\n  settingsFpExcludedSubfolders: '排除的子目录',\n  settingsFpAddExclusion: '添加排除',\n  settingsFpNoExclusions: '暂无排除。',\n  settingsFpAiHidden: '禁止 AI 访问的文件夹',\n  settingsFpCurrentUserOnly: '仅当前用户',\n  settingsFpAiDesc: 'AI agent 永远无法看到这些文件夹。',\n  settingsFpNoAiBlocked: '未禁止任何文件夹——除内置系统黑名单外,AI 可访问全部。',\n  settingsFpPhotos: '照片',\n  settingsFpUpdateRequired: '需要更新',\n  settingsFpPhotosDesc: '照片库监视的文件夹。',\n  settingsFpPhotosAuto: '自动模式:Photos 当前监视以下文件夹(动态跟随挂载卷)。',\n  settingsFpSwitchManual: '转为手动管理',\n  settingsFpPhotosStale: 'Photos 服务需要更新后才能在此管理其目录。',\n  settingsFpCoveredBy: '已被 {p} 覆盖',\n  settingsFpGlobRules: '另有 {n} 条模式规则(如 *.key)在 AI 设置中管理。',\n  settingsFpAddFolder: '添加文件夹',\n\n",
    replace: "" },

  // ── src/i18n/en_us.sp9.ts(与上面成对)────────────────────────────────────
  { path: 'src/i18n/en_us.sp9.ts',
    find: "  settingsTabFolderPermissions: 'Folder Permissions',\n",
    replace: "" },
  { path: 'src/i18n/en_us.sp9.ts',
    find: "  // ── SP9-P4 folder-permissions ─────────────────────────────────────────\n  settingsFpIntro: 'Manage each smart feature\\'s folders in its own section below.',\n  settingsFpDataPending: 'Data source pending: to be wired after the Photos (SP7) and AI (SP8) areas are merged.',\n  settingsFpFilenameIndex: 'Filename index',\n  settingsFpServiceOffline: 'Service offline',\n  settingsFpFilenameDesc: 'Folders scanned into the filename search index.',\n  settingsFpNoFolders: 'No folders configured.',\n  settingsFpKnowledge: 'Knowledge base',\n  settingsFpKnowledgeDesc: 'Folders indexed into the knowledge base (RAG).',\n  settingsFpIndexedFolders: 'Indexed folders',\n  settingsFpExcludedSubfolders: 'Excluded subfolders',\n  settingsFpAddExclusion: 'Add exclusion',\n  settingsFpNoExclusions: 'No exclusions.',\n  settingsFpAiHidden: 'Folders hidden from AI',\n  settingsFpCurrentUserOnly: 'Current user only',\n  settingsFpAiDesc: 'The AI agent can never see these folders.',\n  settingsFpNoAiBlocked: 'No folders blocked — the AI may access everything except the built-in system blacklist.',\n  settingsFpPhotos: 'Photos',\n  settingsFpUpdateRequired: 'Update required',\n  settingsFpPhotosDesc: 'Folders watched for the photo library.',\n  settingsFpPhotosAuto: 'Automatic mode: Photos currently watches the folders below (follows mounted volumes).',\n  settingsFpSwitchManual: 'Switch to manual management',\n  settingsFpPhotosStale: 'Photos service needs an update before its column can be managed here.',\n  settingsFpCoveredBy: 'Covered by {p}',\n  settingsFpGlobRules: '{n} pattern rules (e.g. *.key) are managed in AI settings.',\n  settingsFpAddFolder: 'Add folder',\n\n",
    replace: "" },

  // ── SP9-P7:两个 sp9 分片里"Search"整节 20 键(searchReason* 7 / searchBadge* 3 /
  //    searchSource* 3 / searchNoticePrefix 1 / searchEmpty* 3 / searchError* 2 /
  //    searchRetry 1)。SearchDialog.vue 与 src/home/search/** 都已整体删除,20 键全是
  //    孤儿。连同小节标题注释一起删(注释里点名 SearchDialog / spec 章节号 / demo,
  //    本项目发布的是源码本身,注释会逐字进公开仓库)。
  //    锚点从小节前的空行开始吃,避免删完在 kvmToggleCustom 与 `}` 之间留一个空行。
  { path: 'src/i18n/zh_cn.sp9.ts',
    find: "\n  // ── SP9-P7 Search ──(SearchDialog 接真后端;spec §7.5/§7.6/§7.8)\n  // 排序理由标签(reasons.ts 产 key、这里给文案)。demo 时代那些带计数的英文标签\n  // (Body match ×9 / Transcript match ×3)后端根本不返回,是编的,故新标签不带数字。\n  searchReasonFilename: '文件名命中',\n  searchReasonFilenameFuzzy: '文件名相关',\n  searchReasonBody: '正文命中',\n  searchReasonTranscript: '转写命中',\n  searchReasonOcr: '图片文字命中',\n  searchReasonCaption: '图片内容命中',\n  searchReasonSemantic: '语义相关',\n  // 来源徽标(取代 demo 的「98%」准确率——四源分数互不可比,百分比是编的)。\n  // 中文取自 Vue2 zh_CN.json 的 \"Semantic\" / \"Filenames\";OCR 沿用现状不译。\n  searchBadgeSemantic: '语义',\n  searchBadgeFilename: '文件名',\n  searchBadgeOcr: 'OCR',\n  // 降级提示条:哪些源本次没参与。三条源文案逐字取自 Vue2 zh_CN.json。\n  searchSourceSemantic: '语义搜索不可用',\n  searchSourceImages: '图片搜索不可用',\n  searchSourceFilenames: '文件名搜索不可用',\n  searchNoticePrefix: '本次未参与搜索：',\n  // 三种空态(spec §7.8):「没搜到」与「后端没就绪」必须分得开。\n  searchEmptyNoMatch: '没有匹配的文件',   // Vue2 zh_CN.json 逐字\n  searchEmptyNoRoots: '没有可搜索的目录',\n  searchEmptyNotReady: '搜索后端未就绪',\n  // 错误态(请求失败)。标题逐字取自 Vue2 zh_CN.json。\n  searchErrorTitle: '搜索失败',\n  searchErrorHint: '搜索服务当前不可用,请稍后重试',\n  searchRetry: '重试',\n",
    replace: "" },
  { path: 'src/i18n/en_us.sp9.ts',
    find: "\n  // ── SP9-P7 Search ── (SearchDialog wired to the real backend; spec §7.5/§7.6/§7.8)\n  // Ranking-reason chips (reasons.ts produces the key, the copy lives here). The demo-era\n  // labels carried counts (Body match ×9 / Transcript match ×3) that the backend never\n  // returns — they were invented, so the new labels carry no numbers.\n  searchReasonFilename: 'Filename match',\n  searchReasonFilenameFuzzy: 'Filename related',\n  searchReasonBody: 'Body match',\n  searchReasonTranscript: 'Transcript match',\n  searchReasonOcr: 'Text in image',\n  searchReasonCaption: 'Image content match',\n  searchReasonSemantic: 'Semantically related',\n  // Source badges (replacing the demo's \"98%\" accuracy — the four sources' scores are\n  // not comparable, so the percentage was fabricated). Copy from Vue2's \"Semantic\" /\n  // \"Filenames\"; OCR keeps the existing wording.\n  searchBadgeSemantic: 'Semantic',\n  searchBadgeFilename: 'Filenames',\n  searchBadgeOcr: 'OCR',\n  // Degradation notice: which sources sat this search out.\n  searchSourceSemantic: 'Semantic search unavailable',\n  searchSourceImages: 'Photo search unavailable',\n  searchSourceFilenames: 'Filename search unavailable',\n  searchNoticePrefix: 'Not included in this search:',\n  // Three empty states (spec §7.8): \"found nothing\" must stay distinguishable from\n  // \"backend was not up\".\n  searchEmptyNoMatch: 'No matching files',\n  searchEmptyNoRoots: 'No searchable folders',\n  searchEmptyNotReady: 'Search backend not ready',\n  // Error state (request failed).\n  searchErrorTitle: 'Search failed',\n  searchErrorHint: 'The search service is unavailable, please retry',\n  searchRetry: 'Retry',\n",
    replace: "" },

  // ── 复审 Important:settingsAppsPendingDisabledHint 是活键(AppsPanel.vue 保留组件消费),
  //    不能删,但值里点名"相册区/Photos section"——改值不删键,措辞比照 T7 洗白先例
  //    (只说后端能力未就绪,不提功能区名字/迁移计划)。顺带清掉暴露分期开发状态的行内注释。
  { path: 'src/i18n/zh_cn.sp9.ts',
    find: "  settingsAppsPendingDisabledHint: '待相册区迁移完成后启用',                          // 🆕(本期新增标注,做样子)\n",
    replace: "  settingsAppsPendingDisabledHint: '该功能所需的后端能力尚未提供',\n" },
  { path: 'src/i18n/en_us.sp9.ts',
    find: "  settingsAppsPendingDisabledHint: 'Available after the Photos section is migrated',\n",
    replace: "  settingsAppsPendingDisabledHint: 'Requires backend support that is not available yet',\n" },

  // ── 复审第二轮:两个 sp9 locale 文件的头注释——本项目发布的是源码本身(export.mjs
  //    产出源码树,不经 vite 压缩),注释会逐字进公开仓库,不是"构建产物剥注释"就能豁免的。
  //    第 1 行直接点名被剔除的 Search 功能区(真实 scanner 命中),第 2 行提 sp7/sp8(相册/AI
  //    分支代号)+"并行开发"+ 内部 spec 章节号,守卫抓不到但同样是私有开发状态泄漏。
  //    第 3 行(提 parity.test.ts,仓内正常引用)不构成泄漏,保留不动。
  { path: 'src/i18n/zh_cn.sp9.ts',
    find: "// SP9(收尾视图:系统设置 / KVM / Search)文案分片。\n// 与 sp7/sp8 并行开发,分片可让三线几乎不在 i18n 上相撞(spec §4.2 / §9.3)。\n",
    replace: "// 设置 / KVM 等页面的文案分片。\n// 拆成独立文件是为了减少多人协作时的 i18n 合并冲突。\n" },
  { path: 'src/i18n/en_us.sp9.ts',
    find: "// SP9 (final views: Settings / KVM / Search) locale shard. See zh_cn.sp9.ts.\n",
    replace: "// Settings / KVM locale shard. See zh_cn.sp9.ts.\n" },

  // ── src/styles/theme.css(E11:说话人/orb/照片磁贴 token 与类,--wave-none 保留)──
  // 分节标题去掉"照片"(应用/文件夹磁贴结构本身保留)
  { path: 'src/styles/theme.css',
    find: "/* ---- P4c: app / folder / photo tile structure ---- */\n",
    replace: "/* ---- P4c: app / folder tile structure ---- */\n" },
  // :root 说话人配色注释 + --spk-1..5(锚点跨过 --wave-none,见下条单独删 --wave-dim)
  { path: 'src/styles/theme.css',
    find: "  /* Speaker palette (audio transcript/waveform, cycles through up to 5 hues; dark theme\n     uses the brighter set; avoids gold so it doesn't get confused with the star highlight) */\n  --spk-1: oklch(0.74 0.13 250);   /* azure */\n  --spk-2: oklch(0.72 0.13 305);   /* violet */\n  --spk-3: oklch(0.77 0.12 190);   /* cyan */\n  --spk-4: oklch(0.73 0.15 18);    /* coral */\n  --spk-5: oklch(0.79 0.14 150);   /* emerald */\n",
    replace: "" },
  // :root --wave-dim(--wave-none 保留,两者不连续,分开删)
  { path: 'src/styles/theme.css',
    find: "  --wave-dim: var(--fg-faint);     /* waveform: bars dimmed while filtering */\n",
    replace: "" },
  // light 主题同一批 --spk-1..5
  { path: 'src/styles/theme.css',
    find: "  /* Speaker palette (paper theme uses the deeper set, same hue family) */\n  --spk-1: oklch(0.52 0.15 255);\n  --spk-2: oklch(0.50 0.16 305);\n  --spk-3: oklch(0.53 0.12 200);\n  --spk-4: oklch(0.55 0.18 22);\n  --spk-5: oklch(0.52 0.15 150);\n",
    replace: "" },
  // light 主题 --wave-dim
  { path: 'src/styles/theme.css',
    find: "  --wave-dim: var(--fg-faint);\n",
    replace: "" },
  // :root --orb-core/--orb-glow,唯一消费方 AiWidget.vue 已删
  { path: 'src/styles/theme.css',
    find: "  --orb-core: #2a3566;\n  --orb-glow: rgba(138, 180, 255, 0.5);\n",
    replace: "" },
  // light 主题同一对
  { path: 'src/styles/theme.css',
    find: "  --orb-core: #d9def5;\n  --orb-glow: rgba(59, 91, 219, 0.4);\n",
    replace: "" },
  { path: 'src/styles/theme.css',
    find: "@keyframes pulse { 50% { box-shadow: 0 0 54px var(--orb-glow); } }\n",
    replace: "" },
  // "照片磁贴"分节标题 + .kind-photo + .photo-thumb
  { path: 'src/styles/theme.css',
    find: "/* Photo tile */\n.kind-photo { padding: 0; }\n.photo-thumb { display: block; width: 100%; height: 100%; border-radius: var(--radius, 28px); border: 1px solid var(--card-border); box-shadow: var(--icon-shadow); }\n",
    replace: "" },
  { path: 'src/styles/theme.css',
    find: ".ic-photos   { background: conic-gradient(from 20deg, #ff735f, #ffd54f, #60e27c, #55baff, #ca83ff, #ff735f); }\n",
    replace: "" },
  // .ic-ai 消费的 --orb-core 已随上面删除,该规则本身也删
  { path: 'src/styles/theme.css',
    find: ".ic-ai       { background: radial-gradient(circle at 64% 24%, var(--accent2), transparent 40%), radial-gradient(circle at 28% 80%, var(--accent), transparent 46%), var(--orb-core, #1a2050); }\n",
    replace: "" },
  // .ic-knowledge:SP14 T9(d4d3771)追加,同属 AI 区磁贴配色,连注释一起删
  // (systemApps.ts 里 cls: 'ic-knowledge' 那条已在上面摘掉,这里是零消费方孤儿规则)。
  { path: 'src/styles/theme.css',
    find: "/* SP14 #98: matches the amber gradient baked into knowledge.svg's own <linearGradient>\n   (#D97706 -> #FBBF24) -- same brand-identity exception as the rest of this block. */\n.ic-knowledge { background: linear-gradient(145deg, #fbbf24, #d97706 65%, #b45309); }\n",
    replace: "" },
  { path: 'src/styles/theme.css',
    find: ".ic-search   { background: linear-gradient(145deg, #c4b5fd, #8b5cf6 60%, #6d28d9); }\n",
    replace: "" },
  // .photo-thumb.has-img 两条
  { path: 'src/styles/theme.css',
    find: ".photo-thumb.has-img { background: none; overflow: hidden; }\n.photo-thumb.has-img img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; display: block; }\n",
    replace: "" },
  // 从共享 transition 规则的选择器列表里摘掉 .kind-photo .photo-thumb,其余 3 个选择器保留
  { path: 'src/styles/theme.css',
    find: ".kind-folder .folder-ic,\n.kind-photo .photo-thumb { transition: transform .18s var(--ease, ease), box-shadow .18s var(--ease, ease), filter .18s var(--ease, ease); }",
    replace: ".kind-folder .folder-ic { transition: transform .18s var(--ease, ease), box-shadow .18s var(--ease, ease), filter .18s var(--ease, ease); }" },
  // 同上,z-index 提升规则
  { path: 'src/styles/theme.css',
    find: ".grid-item:not(.editing).kind-folder:hover,\n.grid-item:not(.editing).kind-photo:hover { z-index: 6; }",
    replace: ".grid-item:not(.editing).kind-folder:hover { z-index: 6; }" },
  // 同上,悬停放大规则(声明体本身不含 photo 相关内容,保留)
  { path: 'src/styles/theme.css',
    find: ".grid-item:not(.editing).kind-folder:hover .folder-ic,\n.grid-item:not(.editing).kind-photo:hover .photo-thumb {",
    replace: ".grid-item:not(.editing).kind-folder:hover .folder-ic {" },
  // 同上,按压反馈规则
  { path: 'src/styles/theme.css',
    find: ".grid-item:not(.editing).kind-folder:active .folder-tile,\n.grid-item:not(.editing).kind-photo:active .photo-thumb { transform: scale(.95); transition: transform .1s var(--ease, ease); }",
    replace: ".grid-item:not(.editing).kind-folder:active .folder-tile { transform: scale(.95); transition: transform .1s var(--ease, ease); }" },

  // ═══════════════════ T13:测试同步(混合型文件抠用例/改内容) ══════════════

  // ── useOpenAction.test.ts:断言 window.location.href 的用例,在开源版
  //    SYS_ROUTE/cutoverDisabled 改法下行为已变(§8.2 有意偏离),整块删除 ──────
  // SP9-P8:settings / vm 各有一对用例。**正向那两条(router.push /settings、/kvm)在开源版
  // 依然成立**(SYS_ROUTE 已指内部路由,由兜底那句 push 出去),保留;只删两条 flag 回退用例。
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: `  it('when fallback flag strangler:disabled:/settings==1, settings should fall back to legacy desktop /#/legacy', () => {
    localStorage.setItem('strangler:disabled:/settings', '1')
    const { openApp } = useOpenAction()
    openApp('settings')
    expect(hrefs[0]).toBe('/#/legacy')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/settings')
  })
`,
    replace: '' },
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: `  it('when fallback flag strangler:disabled:/kvm==1, vm should fall back to Vue2 full page /#/kvm (not /#/legacy)', () => {
    localStorage.setItem('strangler:disabled:/kvm', '1')
    const { openApp } = useOpenAction()
    openApp('vm')
    expect(hrefs[0]).toBe('/#/kvm')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/kvm')
  })
`,
    replace: '' },
  // 两条跨 flag 隔离用例:开源版一把 flag 都没有(且 photos 不存在),整块删。
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: `  it('five flags are independent: only disabling /kvm, while settings/storage/appstore/photos still use in-app router', () => {
    localStorage.setItem('strangler:disabled:/kvm', '1')
    const { openApp } = useOpenAction()
    openApp('settings'); expect(router.push).toHaveBeenCalledWith('/settings')
    openApp('storage'); expect(router.push).toHaveBeenCalledWith('/storage')
    openApp('appstore'); expect(router.push).toHaveBeenCalledWith('/apps/store')
    openApp('photos'); expect(router.push).toHaveBeenCalledWith('/photos')
    expect(hrefs.length).toBe(0)
    localStorage.removeItem('strangler:disabled:/kvm')
  })
  it('when only /settings is disabled, vm should still use in-app /kvm (reverse isolation)', () => {
    localStorage.setItem('strangler:disabled:/settings', '1')
    const { openApp } = useOpenAction()
    openApp('vm')
    expect(router.push).toHaveBeenCalledWith('/kvm')
    expect(hrefs.length).toBe(0)
    localStorage.removeItem('strangler:disabled:/settings')
  })
`,
    replace: '' },
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: `  it('when fallback flag strangler:disabled:/apps==1, appstore should fall back to /#/legacy', () => {
    localStorage.setItem('strangler:disabled:/apps', '1')
    const { openApp } = useOpenAction()
    openApp('appstore')
    expect(hrefs[0]).toBe('/#/legacy')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/apps')
  })
`,
    replace: '' },
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: `  it('when fallback flag strangler:disabled:/storage==1, storage should fall back to /#/legacy', () => {
    localStorage.setItem('strangler:disabled:/storage', '1')
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(hrefs[0]).toBe('/#/legacy')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/storage')
  })
`,
    replace: '' },
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: `  it('photo tile should use in-app push /photos (SP7-P8b cutover)', () => {
    const { openItem } = useOpenAction()
    openItem({ id: 'i', kind: 'photo', key: 'abc', c: 1, r: 1, w: 2, h: 2 } as LayoutItem)
    expect(router.push).toHaveBeenCalledWith('/photos')
    expect(hrefs.length).toBe(0)
  })
  it('photo tile: when fallback flag is set to 1, should fall back to Vue2 /#/photos', () => {
    localStorage.setItem('strangler:disabled:/photos', '1')
    const { openItem } = useOpenAction()
    openItem({ id: 'i', kind: 'photo', key: 'abc', c: 1, r: 1, w: 2, h: 2 } as LayoutItem)
    expect(hrefs[0]).toBe('/#/photos')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/photos')
  })
`,
    replace: '' },
  // SP7-P8b 新增的三条 photos 磁贴用例:开源版没有相册区,'photos' 不是系统应用,
  // 三条全删(前两条断言相册路由,第三条断言"photos 的 flag 不影响别人")。
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: `  it('photos tile should use in-app router.push /photos (SP7-P8b cutover)', () => {
    const { openApp } = useOpenAction()
    openApp('photos')
    expect(router.push).toHaveBeenCalledWith('/photos')
    expect(hrefs.length).toBe(0)
  })
  it('when fallback flag strangler:disabled:/photos==1, photos should fall back to Vue2 /#/photos (not /#/legacy)', () => {
    localStorage.setItem('strangler:disabled:/photos', '1')
    const { openApp } = useOpenAction()
    openApp('photos')
    expect(hrefs[0]).toBe('/#/photos')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/photos')
  })
  it('the photos flag should not affect storage / appstore', () => {
    localStorage.setItem('strangler:disabled:/photos', '1')
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(router.push).toHaveBeenCalledWith('/storage')
    openApp('appstore')
    expect(router.push).toHaveBeenCalledWith('/apps/store')
    expect(hrefs.length).toBe(0)
    localStorage.removeItem('strangler:disabled:/photos')
  })
`,
    replace: '' },
  // beforeEach 里那三把 flag 的清理也跟着撤(开源版无任何 cutover flag)
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: "  localStorage.removeItem('strangler:disabled:/photos')\n  localStorage.removeItem('strangler:disabled:/settings')\n  localStorage.removeItem('strangler:disabled:/kvm')\n",
    replace: '' },

  // ── Home.integration.test.ts / Home.p4b.test.ts:P8 给 mount(Home) 加的 router 脚手架 ──
  // 私有版加它是因为 Home 无条件挂的那个面板组件消费 useRoute()/useRouter()(深链 ?q=)。
  // 开源版该组件整个删掉,且 Home 其余子组件**一个都不用** useRoute(已 grep 核实)——
  // 于是 router 插件在产物里成了纯脚手架,连同注释一并撤回 P8 之前的形态。
  // (顺带:注释里提到的组件名本身也是被删的东西,tree.test.mjs「混合型测试文件保留,
  //  但里面不再提被删的东西」那条会抓它 —— 这条补丁正是被那道门逼出来的。)
  { path: 'src/views/Home.integration.test.ts',
    find: "import { createRouter, createMemoryHistory } from 'vue-router'\n", replace: '' },
  { path: 'src/views/Home.integration.test.ts',
    find: `// SP9-P8: the SearchDialog mounted by Home consumes the deep link ?q= via useRoute()/useRouter(),
// so mounting must include the router plugin (a minimal memory route table, not the real src/router).
function makeRouter() {
  return createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
}

function mountHome() {
  return mount(Home, { global: { plugins: [i18n, makeRouter()] } })
}`,
    replace: `function mountHome() {
  return mount(Home, { global: { plugins: [i18n] } })
}` },
  { path: 'src/views/Home.p4b.test.ts',
    find: "import { createRouter, createMemoryHistory } from 'vue-router'\n", replace: '' },
  { path: 'src/views/Home.p4b.test.ts',
    find: `    // SP9-P8: the SearchDialog mounted by Home uses useRoute()/useRouter(), so mounting must include the router plugin.
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
    const w = mount(Home, { global: { plugins: [i18n, router] } })`,
    replace: '    const w = mount(Home, { global: { plugins: [i18n] } })' },

  // ── HomeTopbar.test.ts:唯一的搜索胶囊用例,组件本身已在 T6 删掉 .search-btn ───
  { path: 'src/home/components/HomeTopbar.test.ts',
    find: `  it('search button opens the search palette', async () => {
    const ui = useHomeUiStore()
    const w = mount(HomeTopbar)
    expect(ui.searchOpen).toBe(false)
    await w.get('.search-btn').trigger('click')
    expect(ui.searchOpen).toBe(true)
  })
`,
    replace: '' },

  // ── GridItem.click.test.ts:唯一的照片瓦片点击用例,'photo' 已不是合法 Kind ──
  { path: 'src/home/components/GridItem.click.test.ts',
    find: `  it('clicking a photo pushes /photos(SP7-P8b cutover)', async () => {
    const item: LayoutItem = { id: 'p', kind: 'photo', key: 'linear-gradient(0,#000)', c: 1, r: 1, w: 2, h: 2 }
    const w = mount(GridItem, { props: { item } })
    await w.get('[data-id="p"]').trigger('click')
    expect(router.push).toHaveBeenCalledWith('/photos')
    expect(hrefs.length).toBe(0)
  })
`,
    replace: '' },

  // ── MobileHome.test.ts:mock 里的 sendToAI(T6 已删该函数)+ seed() 的照片项 +
  //    随之改变的瓦片计数/顺序断言 + 唯一的照片瓦片专项用例(整块删除)────────
  { path: 'src/home/components/MobileHome.test.ts',
    find: `vi.mock('../composables/useOpenAction', () => ({
  useOpenAction: () => ({ openItem, openApp: vi.fn(), sendToAI: vi.fn() }),
}))
`,
    replace: `vi.mock('../composables/useOpenAction', () => ({
  useOpenAction: () => ({ openItem, openApp: vi.fn() }),
}))
` },
  { path: 'src/home/components/MobileHome.test.ts',
    find: `  layout.items = [
    item({ id: 'w1', kind: 'widget', key: 'clock', c: 1, r: 1, w: 2, h: 2 }),
    item({ key: 'files', c: 3, r: 1 }),
    item({ id: 'ph', kind: 'photo', key: 'linear-gradient(#fff,#000)', c: 4, r: 2, w: 2, h: 2 }),
    item({ id: 'fd', kind: 'folder', key: 'Documents', c: 1, r: 3, path: '/DATA/Documents' }),
  ]
`,
    replace: `  layout.items = [
    item({ id: 'w1', kind: 'widget', key: 'clock', c: 1, r: 1, w: 2, h: 2 }),
    item({ key: 'files', c: 3, r: 1 }),
    item({ id: 'fd', kind: 'folder', key: 'Documents', c: 1, r: 3, path: '/DATA/Documents' }),
  ]
` },
  { path: 'src/home/components/MobileHome.test.ts',
    find: `  it('splits widgets (full-width) from tiles (icon grid) in desktop visual order', () => {
    seed()
    const w = mount(MobileHome, { global: { plugins: [i18n] } })
    expect(w.findAll('.m-widget')).toHaveLength(1)
    const tiles = w.findAll('.m-tile')
    expect(tiles).toHaveLength(3)
    expect(tiles.map((t) => t.classes().some((c) => c === 'kind-app' || c === 'kind-photo' || c === 'kind-folder')))
      .toEqual([true, true, true])
    // Order: files (r1) → photo (r2) → folder (r3)
    expect(tiles[0].classes()).toContain('kind-app')
    expect(tiles[1].classes()).toContain('kind-photo')
    expect(tiles[2].classes()).toContain('kind-folder')
  })
`,
    replace: `  it('splits widgets (full-width) from tiles (icon grid) in desktop visual order', () => {
    seed()
    const w = mount(MobileHome, { global: { plugins: [i18n] } })
    expect(w.findAll('.m-widget')).toHaveLength(1)
    const tiles = w.findAll('.m-tile')
    expect(tiles).toHaveLength(2)
    expect(tiles.map((t) => t.classes().some((c) => c === 'kind-app' || c === 'kind-folder')))
      .toEqual([true, true])
    // Order: files (r1) → folder (r3)
    expect(tiles[0].classes()).toContain('kind-app')
    expect(tiles[1].classes()).toContain('kind-folder')
  })
` },
  { path: 'src/home/components/MobileHome.test.ts',
    find: `  it('marks photo tiles as 2x2 spans', () => {
    seed()
    const w = mount(MobileHome, { global: { plugins: [i18n] } })
    expect(w.find('.m-photo').exists()).toBe(true)
    expect(w.find('.m-photo').classes()).toContain('kind-photo')
  })

`,
    replace: '' },

  // ── defaultLayout.test.ts:两条坐标无关的通用断言全部保留(覆盖新 15 项布局),
  //    只有 WIDGETS registry 计数从 7→6(ai 小组件已删)需要改 ──────────────────
  { path: 'src/home/grid/defaultLayout.test.ts',
    find: `  it('carries min/max/default for the 7 widgets', () => {
    expect(Object.keys(WIDGETS).sort()).toEqual(['ai', 'clock', 'cpu', 'events', 'gpu', 'network', 'storage'])
`,
    replace: `  it('carries min/max/default for the 6 widgets', () => {
    expect(Object.keys(WIDGETS).sort()).toEqual(['clock', 'cpu', 'events', 'gpu', 'network', 'storage'])
` },

  // ── tabs.test.ts:folder-permissions 已删(9→8 tab,7→6 rail),railTabsFor 退化
  //    为无参恒等 —— 4 处旧签名调用 railTabsFor(role) 会编译报错,连同它测的
  //    「按角色隐藏 folder-permissions」这整块行为(已不存在)一起删除 ──────────
  { path: 'src/settings/util/tabs.test.ts',
    find: `  isSettingsTab,
  railTabsFor,
} from './tabs'`,
    replace: `  isSettingsTab,
} from './tabs'` },
  // SP17 起私有侧的两条标题已经是英文(Task 2 brief 直接给的英文文案,不再提 "Vue2"),
  // 这两条 FIND/REPLACE 跟着改成英文;lan-devices 是公开面功能,保留在 REPLACE 里,只摘
  // folder-permissions。
  { path: 'src/settings/util/tabs.test.ts',
    find: `  it('has 10 tabs in Vue2 order (8 rail items + account + developer)', () => {
    expect(SETTINGS_TABS).toEqual([
      'general',
      'storage',
      'network',
      'apps',
      'terminal',
      'system-status',
      'lan-devices',
      'folder-permissions',
      'account',
      'developer',
    ])
  })`,
    replace: `  it('has 9 tabs in a fixed order (7 rail items + account + developer)', () => {
    expect(SETTINGS_TABS).toEqual([
      'general',
      'storage',
      'network',
      'apps',
      'terminal',
      'system-status',
      'lan-devices',
      'account',
      'developer',
    ])
  })` },
  { path: 'src/settings/util/tabs.test.ts',
    find: `  it('the rail holds 8 items -- account has its own entry, developer sits inside general', () => {
    expect(RAIL_TABS).toEqual([
      'general',
      'storage',
      'network',
      'apps',
      'terminal',
      'system-status',
      'lan-devices',
      'folder-permissions',
    ])
  })`,
    replace: `  it('the rail holds 7 items -- account has its own entry, developer sits inside general', () => {
    expect(RAIL_TABS).toEqual([
      'general',
      'storage',
      'network',
      'apps',
      'terminal',
      'system-status',
      'lan-devices',
    ])
  })` },
  { path: 'src/settings/util/tabs.test.ts',
    find: `
  it('admin sees all 8 rail items', () => {
    expect(railTabsFor('admin')).toEqual(RAIL_TABS)
  })

  it('a non-admin does not see folder-permissions (Vue2 visibleTabs L1034)', () => {
    expect(railTabsFor('user')).not.toContain('folder-permissions')
    expect(railTabsFor('user')).toHaveLength(7)
  })

  it('a missing role is treated as non-admin (conservative: does not leak admin entries)', () => {
    expect(railTabsFor(undefined)).not.toContain('folder-permissions')
  })
})
`,
    replace: `
})
` },

  // ── panels.test.ts:folder-permissions 那个 tab 没了,PANEL_BY_TAB 键数 9→8,
  //    历史注释里有一处点名了已删的 FolderPermissionsPanel.test.ts(悬空引用)───
  { path: 'src/settings/panels/panels.test.ts',
    find: '    expect(Object.keys(PANEL_BY_TAB)).toHaveLength(10)\n',
    replace: '    expect(Object.keys(PANEL_BY_TAB)).toHaveLength(9)\n' },
  { path: 'src/settings/panels/panels.test.ts',
    find: `  // Since P4, folder-permissions and account also have real content
  // (see FolderPermissionsPanel.test.ts / AccountPanel.test.ts) — **at this point all 9 tabs are fully implemented,
  // so there's no longer any target left for the skeleton spot-check** (the original it.each and the "skeleton copy keys all have translations" case are retired along with it).`,
    replace: `  // account also has real content (see AccountPanel.test.ts) — **at this point all tabs are fully implemented,
  // so there's no longer any target left for the skeleton spot-check** (the original it.each and the "skeleton copy keys all have translations" case are retired along with it).` },
  // -- Important (review round 2): this file asserts against the live AppsPanel, whose
  //    ORDER got reverted to three rows above -- if this test file keeps asserting 4,
  //    the open-source repo would ship a test that is guaranteed to fail. Revert the
  //    row count and the two "four rows" wordings in the surrounding comments/title so
  //    the description matches what the reverted component actually renders.
  { path: 'src/settings/panels/panels.test.ts',
    find: '  // Since Task 9, apps also has real content (four data-location rows + Docker cache cleanup + upload-cache placeholder, see',
    // 跟上面 P4 那条同一处理:丢掉 "TaskN 起" 这个内部期号前缀,句子从主语直接起;顺手把
    // "做样子"(FORBIDDEN 词表内部分级术语)也换掉——两个词此前从未入过 PATCH 的 replace,
    // 一直未受检地随 find/replace 同步演进,这次为了改行数措辞把这句纳入 PATCH,一起洗白。
    replace: '  // apps also has real content (three data-location rows + Docker cache cleanup + upload-cache placeholder, see' },
  { path: 'src/settings/panels/panels.test.ts',
    find: '  // with zero mocks: the four data-location rows always render (whether the fetch has settled doesn\'t affect the row count, same precedent as storage).',
    replace: '  // with zero mocks: the three data-location rows always render (whether the fetch has settled doesn\'t affect the row count, same precedent as storage).' },
  { path: 'src/settings/panels/panels.test.ts',
    find: `  it('apps has real content (four data-location rows + Docker cleanup + upload-cache placeholder), no longer a bare skeleton', async () => {
    setActivePinia(createPinia())
    const w = mount(PANEL_BY_TAB.apps, { global: { plugins: [i18n] } })
    // Review Important #3 added a real loading state: .set-skeleton renders before both APIs settle (not
    // an oversight, it avoids exposing four rows of fake zero readings before settling) — here we pin down that it does go through the loading state.
    expect(w.find('.set-skeleton').exists()).toBe(true)
    await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(false)
    expect(w.findAll('.set-app-row')).toHaveLength(4)`,
    replace: `  it('apps has real content (three data-location rows + Docker cleanup + upload-cache placeholder), no longer a bare skeleton', async () => {
    setActivePinia(createPinia())
    const w = mount(PANEL_BY_TAB.apps, { global: { plugins: [i18n] } })
    // Review Important #3 added a real loading state: .set-skeleton renders before both APIs settle (not
    // an oversight, it avoids exposing three rows of fake zero readings before settling) — here we pin down that it does go through the loading state.
    expect(w.find('.set-skeleton').exists()).toBe(true)
    await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(false)
    expect(w.findAll('.set-app-row')).toHaveLength(3)` },

  // ── AppsPanel.test.ts:fixture 第 4 个 key 改名(photos_data 是 HARD 禁词,
  //    且组件本身只认 app_data/images/database,第 4 个 key 叫什么都无所谓)+
  //    待上传缓存禁用态标注的断言跟着 T7 洗白后的新文案走(HARD 禁词「相册」)──
  { path: 'src/settings/panels/AppsPanel.test.ts',
    find: "  photos_data: { path: '/DATA/.system_data/photos', size: 6242024935 },\n",
    replace: "  other_data: { path: '/DATA/.system_data/other', size: 6242024935 },\n" },
  // -- Task 3 (private-side) turned these three test cases into real assertions about
  //    the fourth row (photos cache, 4 rows) instead of just a title string -- once
  //    appPaths.ts/AppsPanel.vue are reverted to the three-row version, these three
  //    cases must revert as whole blocks too; patching only the title would leave them
  //    asserting a row count the component no longer renders (a false green).
  { path: 'src/settings/panels/AppsPanel.test.ts',
    find: `  it('renders all four data-location rows -- backend sent 4 keys (incl. photos_data), all four render (#103)', async () => {
    const w = mountPanel()
    await flushPromises()
    const rows = w.findAll('.set-app-row')
    expect(rows).toHaveLength(4)
    expect(rows[0].text()).toContain('App 数据')
    expect(rows[1].text()).toContain('App 镜像集')
    expect(rows[2].text()).toContain('用户数据库')
    expect(rows[3].text()).toContain('相册缓存')
  })`,
    replace: `  it('renders three data-location rows -- the backend sent 4 keys (one of them unknown), the UI shows only 3', async () => {
    const w = mountPanel()
    await flushPromises()
    const rows = w.findAll('.set-app-row')
    expect(rows).toHaveLength(3)
    expect(rows[0].text()).toContain('App 数据')
    expect(rows[1].text()).toContain('App 镜像集')
    expect(rows[2].text()).toContain('用户数据库')
  })` },
  { path: 'src/settings/panels/AppsPanel.test.ts',
    find: '  it(\'clear-local-pending-uploads row: UI is present, button disabled, labeled as pending photos-migration ("just for show" per policy 3)\', async () => {',
    // I5-guard(⑤b)复核:原标题仍带 "政策三"做样子""(REPLACE-only 时代未覆盖到 PATCH,漏检)。
    replace: "  it('clear-local-pending-uploads row: present, button disabled, carries the disabled-state note', async () => {" },
  { path: 'src/settings/panels/AppsPanel.test.ts',
    find: "    expect(w.text()).toContain('待相册区迁移完成后启用')\n",
    replace: "    expect(w.text()).toContain('该功能所需的后端能力尚未提供')\n" },
  // -- The comment right above this test still said "four rows" in the private source
  //    (Task 3's real behavior); the open-source side reverts to three, so the comment
  //    describing the guard has to match what the reverted code actually renders.
  { path: 'src/settings/panels/AppsPanel.test.ts',
    find: '  // Review Important #3: while the fetch is in flight, must not render four rows of fake',
    replace: '  // Review Important #3: while the fetch is in flight, must not render three rows of fake' },
  { path: 'src/settings/panels/AppsPanel.test.ts',
    find: "  it('stays on the loading skeleton (no zero-value fake rows) while fetching; renders the real four rows only after both endpoints settle', async () => {",
    replace: "  it('stays on the loading skeleton (no zero-value fake rows) while fetching; renders the real three rows only after both endpoints settle', async () => {" },
  { path: 'src/settings/panels/AppsPanel.test.ts',
    find: `    resolveStorage(RAW_STORAGE)
    await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(false)
    expect(w.findAll('.set-app-row')).toHaveLength(4)
  })

  it('still shows four rows (with empty paths) when the fetch fails -- no blank screen', async () => {
    getSystemPaths.mockRejectedValue(new Error('boom'))
    const w = mountPanel()
    await flushPromises()
    expect(w.findAll('.set-app-row')).toHaveLength(4)
  })`,
    replace: `    resolveStorage(RAW_STORAGE)
    await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(false)
    expect(w.findAll('.set-app-row')).toHaveLength(3)
  })

  it('still shows three rows (with empty paths) when the fetch fails -- no blank screen', async () => {
    getSystemPaths.mockRejectedValue(new Error('boom'))
    const w = mountPanel()
    await flushPromises()
    expect(w.findAll('.set-app-row')).toHaveLength(3)
  })` },

  // ── appPaths.test.ts:同一份 fixture 的 photos_data 键改名(HARD 禁词)────────
  { path: 'src/settings/util/appPaths.test.ts',
    find: "  photos_data: { path: '/DATA/.system_data/photos', size: 6242024935 },\n",
    replace: "  other_data: { path: '/DATA/.system_data/other', size: 6242024935 },\n" },
  // -- Task 3 (private-side) also turned these two tests into assertions of a real 4
  //    (rather than the original "backend sent 4 keys but only 3 render" intent), and
  //    added a new test exercising the fourth-row derivation end to end -- once
  //    appPaths.ts is reverted to the three-row version, the first two tests' length
  //    assertions and the new test must revert/delete along with it; patching only the
  //    title string is not enough.
  { path: 'src/settings/util/appPaths.test.ts',
    find: `  it('always returns 4 rows in a fixed order -- backend sent 4 keys (incl. photos_data), all four render (#103)', () => {
    const rows = buildAppPathRows(PATHS, [SYS_VOL])
    expect(rows.map((r) => r.key)).toEqual(['app_data', 'images', 'database', 'photos_data'])
  })`,
    replace: `  it('always returns 3 rows in a fixed order -- the backend sent 4 keys (one of them unknown), only the first 3 are built', () => {
    const rows = buildAppPathRows(PATHS, [SYS_VOL])
    expect(rows.map((r) => r.key)).toEqual(['app_data', 'images', 'database'])
  })` },
  { path: 'src/settings/util/appPaths.test.ts',
    find: `  it('gives four empty-path, zero-size rows (not a throw) when backend data is null / missing keys', () => {
    const rows = buildAppPathRows(null, [SYS_VOL])
    expect(rows).toHaveLength(4)
    expect(rows[0]).toMatchObject({ path: '', size: 0 })
  })

  it('derives a fourth row for the photos cache (Vue2 #103)', () => {
    const paths = {
      app_data: { path: '/DATA/AppData', size: 6037987 },
      database: { path: '/DATA', size: 3557039799 },
      images: { path: '/DATA/.system_data/.docker & .containerd', size: 58125438307 },
      photos_data: { path: '/DATA/.system_data/photos', size: 6281536962 },
    }
    const rows = buildAppPathRows(paths, [])
    expect(rows.map((r) => r.key)).toEqual(['app_data', 'images', 'database', 'photos_data'])
    expect(rows[3].path).toBe('/DATA/.system_data/photos')
    expect(rows[3].size).toBe(6281536962)
  })`,
    replace: `  it('gives three empty-path, zero-size rows (not a throw) when backend data is null / missing keys', () => {
    const rows = buildAppPathRows(null, [SYS_VOL])
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ path: '', size: 0 })
  })` },

  // -- migrateBrowse.test.ts: the two test cases Task 3 added likewise follow the
  //    browseDestPaths/appPaths.ts photos_data branch back down -- the "destination
  //    lands in .system_data/photos" test is deleted as a whole block (that branch has
  //    already been PATCHed out of migrateBrowse.ts, so the assertion would fall
  //    through to database's four-directory branch and genuinely fail); the dot-filter
  //    test only used photos_data as a fourth type value to exercise one more case, not
  //    the point of the test, so swapping out the literal is enough -- no need to
  //    delete the whole thing.
  { path: 'src/settings/util/migrateBrowse.test.ts',
    find: `  it('points the photos cache at <target>/.system_data/photos (matches migrate.go)', () => {
    expect(browseDestPaths('photos_data', '/media/Backup')).toEqual([
      '/media/Backup/.system_data/photos',
    ])
    expect(browseDestPaths('photos_data', '/media/Backup/')).toEqual([
      '/media/Backup/.system_data/photos',
    ])
  })
`,
    replace: '' },
  { path: 'src/settings/util/migrateBrowse.test.ts',
    find: `  it('drops dot-prefixed folders before the blocked list is ever consulted (Vue2 #105)', () => {
    // #105 found the dot entries in the blocked list to be dead code: the dot filter
    // below already removed them. Same holds here, which is why photos_data adds no
    // \`.system_data\` entry to \`blocked\`.
    const items = [
      mk('.system_data', '/DATA/.system_data'),
      mk('.docker', '/DATA/.docker'),
      mk('Backup', '/DATA/Backup'),
    ]
    for (const type of ['app_data', 'images', 'database', 'photos_data'] as const) {`,
    replace: `  it('drops dot-prefixed folders before the blocked list is ever consulted', () => {
    // The dot filter below already removes any dot-prefixed folder before the blocked
    // list is even consulted, so an entry like \`.system_data\` would be dead code here.
    const items = [
      mk('.system_data', '/DATA/.system_data'),
      mk('.docker', '/DATA/.docker'),
      mk('Backup', '/DATA/Backup'),
    ]
    for (const type of ['app_data', 'images', 'database'] as const) {` },

  // ── installedApps.test.ts:注释点名 AI agent / Photos ML,措辞对齐 T7 洗白后
  //    的孪生产品代码注释(installedApps.ts 同一行,已在上面改过) ─────────────
  { path: 'src/apps/stores/installedApps.test.ts',
    find: "  it('refresh filters system background containers (nimoos.system=true, e.g. AI agent / Photos ML)', async () => {",
    replace: "  it('refresh filters system background containers (nimoos.system=true, internal service containers used by other apps)', async () => {" },

  // ── systemApp.test.ts:文件头注释独立复述了同一段解释,同样点名 Photos ML,
  //    与 systemApp.ts 源文件那处 T7 洗白对齐(该文件本身不在 REPLACE/PATCH 表里
  //    改过,是测试文件自己写的第二份类似文案)─────────────────────────────────
  { path: 'src/apps/util/systemApp.test.ts',
    find: `// Frontend equivalent of the backend's isSystemComposeApp (route/v2/internal_web.go):
// if any compose service has the label \`nimoos.system == "true"\` it is a behind-the-scenes system component
// and should be hidden from the user-facing app management page (agent runtime / Photos ML backend, etc.).
`,
    replace: `// Frontend equivalent of the backend's isSystemComposeApp (route/v2/internal_web.go):
// if any compose service has the label \`nimoos.system == "true"\` it is a behind-the-scenes system component
// and should be hidden from the user-facing app management page (internal service containers used by other apps, etc.).
` },

  // ── locale.test.ts:mock blob 里的 search_switch(E2 已从 systemConfig 类型删除
  //    该字段;这条用例本意是测"读-改-写保留未知字段",字段叫什么不影响语义,
  //    换个不涉及被删功能的占位字段名即可)────────────────────────────────────
  { path: 'src/stores/locale.test.ts',
    find: `    getCustomStorage.mockResolvedValueOnce({ timezone: 'UTC', search_switch: true })
    await useLocaleStore().persist('en_us')
    expect(setCustomStorage).toHaveBeenCalledTimes(1)
    expect(setCustomStorage.mock.calls[0]?.[0]).toBe('system')
    expect(setCustomStorage.mock.calls[0]?.[1]).toEqual({ timezone: 'UTC', search_switch: true, lang: 'en_us' })
`,
    replace: `    getCustomStorage.mockResolvedValueOnce({ timezone: 'UTC', other_flag: true })
    await useLocaleStore().persist('en_us')
    expect(setCustomStorage).toHaveBeenCalledTimes(1)
    expect(setCustomStorage.mock.calls[0]?.[0]).toBe('system')
    expect(setCustomStorage.mock.calls[0]?.[1]).toEqual({ timezone: 'UTC', other_flag: true, lang: 'en_us' })
` },

  // ── eventMap.test.ts:i18nName() 只是拿 JSON 取字段做单测,样本值恰好写成
  //    HARD 禁词「相册」,换成任意非候选词的中文即可(eventMap.ts 本身与 AI/相册
  //    无关,零消费方核实见 task-13-report.md/chinese-leaks.md T13 节)────────
  { path: 'src/home/util/eventMap.test.ts',
    find: `    expect(i18nName('{"zh_cn":"相册"}')).toBe('相册')
`,
    replace: `    expect(i18nName('{"zh_cn":"文档"}')).toBe('文档')
` },

  // ── useDock.test.ts / useDock.reorder.test.ts:DEFAULT_FAV 已从 5 项(含
  //    photos/ai)改成 4 项(files/storage/vm/appstore,T6),且 systemApps 里
  //    已经没有 photos/ai 这两个 key 了 —— apps.app('photos'/'ai') 恒 undefined,
  //    setFav 会把它们过滤掉,断言必须换成 oss 版仍然存在的 key ──────────────
  { path: 'src/home/composables/useDock.test.ts',
    find: `  it('defaults favKeys to the 5 dock keys and computes moreKeys as the rest', () => {
    useAppsStore() // the 6 system apps are in place
    const d = useDock()
    expect(d.favKeys.value).toEqual(['files', 'photos', 'ai', 'vm', 'appstore'])
    expect(d.moreKeys.value).toContain('settings') // the 6th system app goes into more
    expect(d.moreKeys.value).not.toContain('files')
  })
  it('setFav persists to localStorage', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files', 'photos'])
    expect(JSON.parse(localStorage.getItem('nimoos.home.dockfav')!)).toEqual(['files', 'photos'])
    expect(d.moreKeys.value).toContain('ai')
  })`,
    replace: `  it('defaults favKeys to the 4 dock keys and computes moreKeys as the rest', () => {
    useAppsStore() // the 5 system apps are in place
    const d = useDock()
    expect(d.favKeys.value).toEqual(['files', 'storage', 'vm', 'appstore'])
    expect(d.moreKeys.value).toContain('settings') // the 5th system app goes into more
    expect(d.moreKeys.value).not.toContain('files')
  })
  it('setFav persists to localStorage', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files', 'storage'])
    expect(JSON.parse(localStorage.getItem('nimoos.home.dockfav')!)).toEqual(['files', 'storage'])
    expect(d.moreKeys.value).toContain('vm')
  })` },
  { path: 'src/home/composables/useDock.reorder.test.ts',
    find: `  it('moves a more-key into favorites before a given key', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files', 'photos'])
    d.reorder('settings', 'fav', 'photos') // settings (from more) inserted before photos
    expect(d.favKeys.value).toEqual(['files', 'settings', 'photos'])
  })`,
    replace: `  it('moves a more-key into favorites before a given key', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files', 'vm'])
    d.reorder('settings', 'fav', 'vm') // settings (from more) inserted before vm
    expect(d.favKeys.value).toEqual(['files', 'settings', 'vm'])
  })` },
  { path: 'src/home/composables/useDock.reorder.test.ts',
    find: `  it('moves a fav-key out to more (drop at end of more)', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files', 'photos', 'ai'])
    d.reorder('ai', 'more', null)
    expect(d.favKeys.value).not.toContain('ai')
  })`,
    replace: `  it('moves a fav-key out to more (drop at end of more)', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files', 'storage', 'vm'])
    d.reorder('vm', 'more', null)
    expect(d.favKeys.value).not.toContain('vm')
  })` },
  // 复审:注释里点名的示例 key 'photos'/'ai' 也已经不存在了(纯注释,不影响断言,
  // 但会让人以为这两个 key 还在 —— 顺手换成仍然存在的示例)
  { path: 'src/home/composables/useDock.reorder.test.ts',
    find: "    // moreKeys should now contain all other apps including 'photos', 'ai', etc.\n",
    replace: "    // moreKeys should now contain all other apps besides 'files', etc.\n" },
  { path: 'src/home/composables/useDock.reorder.test.ts',
    find: `  it('reorder more→fav: inserts before a given fav key', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files', 'photos'])
    // settings is in more; reorder into fav before 'photos'
    d.reorder('settings', 'fav', 'photos')
    expect(d.favKeys.value).toEqual(['files', 'settings', 'photos'])
    expect(d.moreKeys.value).not.toContain('settings')
  })`,
    replace: `  it('reorder more→fav: inserts before a given fav key', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files', 'vm'])
    // settings is in more; reorder into fav before 'vm'
    d.reorder('settings', 'fav', 'vm')
    expect(d.favKeys.value).toEqual(['files', 'settings', 'vm'])
    expect(d.moreKeys.value).not.toContain('settings')
  })` },

  // ── 复审(实测 pnpm test 才发现,brief 原始清单没覆盖到)────────────────────
  // HomeDock.test.ts:点击 dock 上的 settings 图标。
  // ⚠️ 这里**原来有一条 PATCH**,把私有版的 `expect(hrefs[0]).toBe('/#/legacy')` 改写成
  //    `expect(router.push).toHaveBeenCalledWith('/settings')` —— SP9-P8 之后**私有版自己
  //    就是这么断言的**(settings 磁贴已翻应用内路由),补丁因此变成恒等变换,已删除。
  //    留这段注释是为了让后人知道它是被有意撤掉的,不是漏了。
  // 剩下要处理的只有 P8 新加的那条 flag 回退用例:开源版无 flag,整块删。
  { path: 'src/home/components/HomeDock.test.ts',
    find: `
  // Fallback reversibility also needs one verification on dock's path: when flag is hit, still full-page jump to old desktop, dock collapses normally.
  it('expanded: fallback flag strangler:disabled:/settings==1 still full-page jumps settings to /#/legacy', async () => {
    useAppsStore()
    localStorage.setItem('strangler:disabled:/settings', '1')
    const hrefs: string[] = []
    Object.defineProperty(window, 'location', { configurable: true, value: { hostname: 'h', set href(v: string) { hrefs.push(v) }, get href() { return '' } } })
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click')
    await w.get('.dock-app[data-app="settings"]').trigger('click')
    expect(hrefs[0]).toBe('/#/legacy')
    expect(router.push).not.toHaveBeenCalled()
    expect(w.get('.dock-toggle').attributes('aria-expanded')).toBe('false')
  })
`,
    replace: '' },
  // 私有版那条正向用例的注释里提到 cutover / #/legacy(开源版没有这段历史),改掉措辞。
  { path: 'src/home/components/HomeDock.test.ts',
    find: `  // SP9-P8 cutover: settings changed from full-page jump /#/legacy to in-app router.push('/settings').
  // Assertion pattern same as useOpenAction.test.ts (that's unit level, this is dock click flow level).
`,
    replace: `  // The settings tile uses in-app routing. Same assertion style as useOpenAction.test.ts
  // (that one is at unit level, this one at the dock click-path level).
` },
  // 全部应用抽屉的应用总数:oss 只有 5 个系统应用(files/storage/vm/appstore/settings,
  // T6 删了 photos/ai),抽屉里 .dock-app 数量恒等于 apps.order.length = 5,不是私有版的 6
  { path: 'src/home/components/HomeDock.test.ts',
    find: `    // Full set = fav(5) + more(≥1, includes settings), more than 4+1 on dock bar
    expect(sheet!.querySelectorAll('.dock-app').length).toBeGreaterThanOrEqual(6)`,
    replace: `    // Full set = all 5 system apps (fav 4 + settings under more), more than the 4+1 on the dock bar
    expect(sheet!.querySelectorAll('.dock-app').length).toBeGreaterThanOrEqual(5)` },

  // ── SettingsShell.test.ts:railTabsFor 不再按角色过滤,"admin 看到 folder-
  //    permissions" 这整条用例测的行为已经不存在,整块删除(同 tabs.test.ts 那 3 条)──
  { path: 'src/settings/components/SettingsShell.test.ts',
    find: `  it('admin rail has 8 items and includes folder-permissions', async () => {
    localStorage.setItem('user', JSON.stringify({ username: 'nimo', role: 'admin' }))
    const { w } = await mountShell()
    const items = w.findAll('.set-rail-item')
    expect(items).toHaveLength(8)
    expect(items.map((i) => i.attributes('data-tab'))).toContain('folder-permissions')
  })

`,
    replace: '' },

  // ═══════════════════ T14:守卫接入后新发现的真泄漏(注释/fixture 洗白) ══════
  // 这些都不是"该整块删除的功能"(那是 T6-T13 的活),而是散落的**文字残留**——
  // 注释里直接点名已删组件/服务,或测试 fixture 里混进了真机抓取的敏感值。
  // 词表本身不放宽(qdrant/相册等仍是硬/软禁词),这里只改导出产物里的这几行文字。

  // theme.css:全局滚动条注释列了三个复用场景,其中"搜索"指向已删的 SearchDialog——
  // 去掉这一个场景名,"文件预览/Welcome"两个保留场景不受影响。
  { path: 'src/styles/theme.css',
    find: "a scroll region -- search, file preview, Welcome, and more",
    replace: "a scroll region -- file preview, Welcome, and more" },
  // theme.css:"2.6 环形图 / 迷你图 / AI 光球"分节标题——AiWidget 的光球 token(--orb-core/
  // --orb-glow)T8 已经删了,但标题文字本身被漏网,直接点名"AI"。环形图/迷你图两个真实
  // token(--ring-*/--spark-*)与 AI 无关,标题掐掉后半截即可。
  { path: 'src/styles/theme.css',
    find: '/* 2.6 Ring chart / sparkline / AI orb */',
    replace: '/* 2.6 Ring chart / sparkline */' },
  // theme.css:两套主题块里"扩展/语义 token"注释各点名了一次 SearchDialog(已删组件)
  // 作为 token 的历史来源说明,MediaViewer 是仍然保留的真实消费方,原样留着。
  { path: 'src/styles/theme.css',
    find: 'Extended/semantic tokens (promoted to global from SearchDialog/MediaViewer; every theme\n     gives these a value). See THEMING.md §2.12',
    replace: 'Extended/semantic tokens (promoted to global from MediaViewer; every theme\n     gives these a value). See THEMING.md §2.12' },
  { path: 'src/styles/theme.css',
    find: 'Extended/semantic tokens (paper theme, taken from SearchDialog/MediaViewer\'s original\n     light-theme palette)',
    replace: "Extended/semantic tokens (paper theme, taken from MediaViewer's original\n     light-theme palette)" },

  // StartAppDialog.vue:spinner 样式注释拿已删的 SearchDialog 当参照物,改成不点名。
  { path: 'src/home/components/StartAppDialog.vue',
    find: '/* Same style as SearchDialog .spinner: --ring-track bottom ring + --accent top arc */',
    replace: '/* Reuses the shared spinner style: --ring-track base ring + --accent top arc */' },

  // GridItem.vue:CSS 注释里还留着"app/folder/photo"三态,但 'photo' 这个 kind 连同
  // PhotoTile 已经被前面的补丁删干净了——这句纯文字描述没跟着改,补上。
  { path: 'src/home/components/GridItem.vue',
    find: 'is not clipped on app/folder/photo items',
    replace: 'is not clipped on app/folder items' },
  // MobileHome.vue:同一处道理,"photo 磁贴占 2×2"这个分句描述的是已删的 photo 磁贴。
  { path: 'src/home/components/MobileHome.vue',
    find: 'Icon area: row-height = column-width → grid always square; photo tiles span 2×2, dense backfills holes',
    replace: 'Icon area: row-height = column-width → grid cells are always square, dense backfills holes' },
  // gridMath.test.ts:clampSize 是通用的尺寸吸附逻辑,测试标题里仍在举例"photo"这个
  // 已经不存在的 kind——它不是测试内容(测试本体用的是 kind:'app'),只是标题文字。
  { path: 'src/home/grid/gridMath.test.ts',
    find: "it('snaps app/folder/photo to nearest of 1x1 or 2x2', () => {",
    replace: "it('snaps app/folder to nearest of 1x1 or 2x2', () => {" },

  // dropEntries.ts / dropEntries.test.ts:拖拽上传的通用文件收集逻辑,注释里拿已删的
  // Photos 模块的 collectFilesFromDataTransfer 函数名当对比对象——直接点名了私有功能
  // 内部的函数名,改成不点名的表述,行为对比本身(不按媒体类型过滤/不跳过隐藏文件)保留。
  { path: 'src/files/upload/dropEntries.ts',
    find: ". Unlike Photos'\n// collectFilesFromDataTransfer: no media type filtering",
    replace: '. No media type filtering' },
  { path: 'src/files/upload/dropEntries.test.ts',
    find: "    // Unlike Photos' collectFilesFromDataTransfer, the file manager's drop path",
    replace: '    // The file manager\'s drop path' },

  // Files.vue:旧格式深链来源说明里点名了 Vue2 时代的 "AI" 功能(打开文件位置的入口
  // 之一),AI 功能整个已经不存在,来源说明改成不点名的"旧版"。
  { path: 'src/views/Files.vue',
    find: 'sources: Vue2 AI\'s "open\n  // file location", upload notifications',
    replace: 'sources: the legacy "open\n  // file location", upload notifications' },

  // useIsoBrowser.test.ts:LISTING 是真机 curl 抓的 /DATA 根目录真实内容,其中
  // '.wiki.md' 是 NimoOS-Wiki 在真实设备上生成的文件——这份 fixture 只是用来验证
  // "只保留目录与 .iso"的过滤逻辑,任何一个非目录非 .iso 的文件名都能达到同样的测试
  // 效果,换成不影射真实设备文件的占位名,过滤逻辑(is_dir:false 且非 .iso → 被剔除)
  // 不受影响。
  { path: 'src/kvm/composables/useIsoBrowser.test.ts',
    find: "  { name: '.wiki.md', path: '/DATA/.wiki.md', is_dir: false, is_symlink: false, size: 2558 },",
    replace: "  { name: 'notes.txt', path: '/DATA/notes.txt', is_dir: false, is_symlink: false, size: 2558 }," },

  // SystemStatusPanel.test.ts / components.test.ts:GET /v1/gateway/components 的真机
  // fixture 里 'external' 分组下真实列出了 Qdrant——这暴露了私有部署真的跑着 Qdrant
  // (Search/Parser 的依赖,两者都已从这份导出里剔除)。分组渲染逻辑只关心 category 字段,
  // 具体服务名对测试断言无意义,换成不指向任何具体第三方服务的占位名。
  { path: 'src/settings/panels/SystemStatusPanel.test.ts',
    find: "  { name: 'Qdrant', category: 'external', version: '1.18.1', status: 'online', error: '', probed_at: '2026-08-01T02:15:55Z' },",
    replace: "  { name: 'External Component', category: 'external', version: '1.18.1', status: 'online', error: '', probed_at: '2026-08-01T02:15:55Z' }," },
  { path: 'src/settings/panels/SystemStatusPanel.test.ts',
    find: "    expect(w.text()).toContain('Qdrant')",
    replace: "    expect(w.text()).toContain('External Component')" },
  { path: 'src/settings/util/components.test.ts',
    find: "  { name: 'Qdrant', category: 'external', version: '1.18.1', status: 'online', error: '', probed_at: '2026-08-01T02:15:55Z' },",
    replace: "  { name: 'External Component', category: 'external', version: '1.18.1', status: 'online', error: '', probed_at: '2026-08-01T02:15:55Z' }," },

  // Home.integration.test.ts:vi.mock('@nimotech/nimoos-service') 里还 mock 着
  // service.photos——Home.vue 早就不导入 usePhotosStore 了(见上面 T7 的补丁与
  // tree.test.ts 的断言),这一行是纯粹的死 mock,顺手删掉而不是留着当活化石。
  { path: 'src/views/Home.integration.test.ts',
    find: "      photos: { listAssets: vi.fn(async () => []), thumbnailUrl: vi.fn(() => '') },\n",
    replace: '' },

  // ═══════════════════ 修复波(2026-08-04 final-review 发布前必修)═══════════

  // ── I3:theme.css 5 个孤儿 token(SearchDialog/MediaViewer/AiWidget 唯一消费方
  //    均已被本清单 DELETE/REPLACE 掉,定义留在门面文件 theme.css 里会误导读者
  //    以为还有搜索高亮/转录高光功能)。8 行 = 深色块 4 行 + 浅色块 4 行。────────
  { path: 'src/styles/theme.css',
    find: '  --hit-bg: rgba(255, 224, 138, 0.3); --hit-fg: #ffe08a;\n', replace: '' },
  { path: 'src/styles/theme.css',
    find: '  --hl-star: #e8c06a;\n', replace: '' },
  { path: 'src/styles/theme.css',
    find: '  --brand-shadow: 0 12px 30px rgba(120, 150, 255, 0.45);\n', replace: '' },
  { path: 'src/styles/theme.css',
    find: '  --inner-bg-hi: rgba(255, 255, 255, 0.22);\n', replace: '' },
  { path: 'src/styles/theme.css',
    find: '  --brand-shadow: 0 12px 30px rgba(59, 91, 219, 0.3);\n', replace: '' },
  { path: 'src/styles/theme.css',
    find: '  --inner-bg-hi: #f0eee8;\n', replace: '' },
  { path: 'src/styles/theme.css',
    find: '  --hit-bg: #fce8a6; --hit-fg: #5a4a12;\n', replace: '' },
  { path: 'src/styles/theme.css',
    find: '  --hl-star: #c9992f;\n', replace: '' },

  // ── I4:产出树里残留的 strangler/cutover 措辞与一条恒真测试。IDX 6/IDX 7 的
  //    replace payload 已在上面直接改掉(cutoverDisabled 死代码整块删除、
  //    调用点去掉恒 false 的守卫)。这里补 8 条:删恒真用例、清理 beforeEach、
  //    洗白 3 处 "P8 cutover:" 注释与 2 处 it() 标题、洗白 protocol.ts 注释。──
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: `  it('storage and apps flags should not interfere with each other', () => {
    localStorage.setItem('strangler:disabled:/apps', '1')
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(router.push).toHaveBeenCalledWith('/storage')
    expect(hrefs.length).toBe(0)
    localStorage.removeItem('strangler:disabled:/apps')
  })
`, replace: '' },
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: `  hrefs = []; opens = []
  localStorage.removeItem('strangler:disabled:/apps')
  localStorage.removeItem('strangler:disabled:/storage')
`, replace: `  hrefs = []; opens = []
` },
  { path: 'src/home/components/HomeDock.test.ts',
    find: '// P8 cutover: dock\'s files icon changed to in-app router.push, need to mock router singleton (vi.mock is hoisted before imports).',
    replace: "// The dock's files icon uses in-app router.push, so the router singleton has to be mocked (vi.mock is hoisted above imports)." },
  { path: 'src/home/components/GridItem.click.test.ts',
    find: '// P8 cutover: folder tiles changed to in-app router.push, need to mock router singleton (vi.mock gets hoisted before import).',
    replace: '// Folder tiles use in-app router.push, so the router singleton has to be mocked (vi.mock is hoisted above imports).' },
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: '// P8 cutover: the files entry now uses in-app router.push, so the router singleton must be mocked (vi.mock is hoisted above imports).',
    replace: '// The files entry uses in-app router.push, so the router singleton must be mocked (vi.mock is hoisted above imports).' },
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: "  it('appstore tile should use in-app router.push /apps/store (SP5-P8 cutover)', () => {",
    replace: "  it('appstore tile should use in-app router.push /apps/store', () => {" },
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: "  it('storage tile should use in-app router.push /storage (SP6-P6 cutover)', () => {",
    replace: "  it('storage tile should use in-app router.push /storage', () => {" },
  { path: 'src/files/drop/protocol.ts',
    find: '// Hard constraint: before P8 strangler flip, old and new pages coexist and interoperate;\n// any shape/value changes break compatibility.',
    replace: '// Hard constraint: this protocol carries transfers between pages; any shape/value change\n// breaks compatibility.' },

  // ── I6:vite.config.ts 直接点名 Claude Code,与「删 CLAUDE.md 因为它是最直白的
  //    AI 辅助开发标记」的理由自相矛盾。exclude 数组本身保留(功能无害)。────────
  { path: 'vite.config.ts',
    find: "    // Claude Code's isolated worktrees appear under .claude/worktrees/ (each a full repo\n    // copy); without the exclusion, vitest recurses into them, runs other sessions' tests,\n    // and fails en masse.",
    replace: "    // Tool directories such as .claude/ may hold full repo copies on a developer machine;\n    // without the exclusion, vitest recurses into them, runs other sessions' tests,\n    // and fails en masse." },

  // ── I7a:注释里泄露内部 SDD 台账路径(.superpowers/sdd/sp9/...)与债务编号。──
  { path: 'src/settings/util/ifaceForm.ts',
    find: `// -> the write path's correctness can only be covered by the unit tests here (see ledger
// .superpowers/sdd/sp9/03-p2.md, debt D18).`,
    replace: `// -> the write path's correctness can only be covered by the unit tests here (there is no
// safe way to verify this endpoint on a real machine).` },

  // ── M1:package.json 的 name 是私有仓名(new-ui 暗示存在一个 old UI)。────────
  { path: 'package.json',
    find: '  "name": "nimoos-new-ui",', replace: '  "name": "nimoos-web",' },

  // ── M2:scripts/deploy.sh 注释里写着私有仓名。──────────────────────────────
  { path: 'scripts/deploy.sh',
    find: "# Build NimoOS-New-UI and deploy to the Gateway's /app/ static directory.",
    replace: "# Build this project and deploy to the Gateway's /app/ static directory." },

  // ═══════════════ SP8-P6-T7 合流(2026-08-06):AI 区剥离 ═══════════════════
  // src/ai 整域与两个 i18n 分片走 DELETE。下面收的是**域外**那些引用它的文件 ——
  // Step 1 实测清单(`grep -rln` 排除 src/ai 自身)共 8 个:AppToast.vue /
  // AppToast.test.ts / router/index.ts / router/index.test.ts / i18n/zh_cn.ts /
  // i18n/en_us.ts / __tests__/shardDisjoint.test.ts / __tests__/photosSlice.test.ts。
  // 后两个与 messageSyntax.test.ts 走 DELETE(理由见 DELETE 表),两个 i18n 出口在
  // 上面 T8 那节处理,余下 4 个在这里打补丁。

  // ── src/router/index.ts:三个 import + 四条 /ai 路由 ───────────────────────
  //    /ai/skills 与 /ai/mcp 没有独立路由(T5 提交信息记明:REDIRECT_BEFORE_GUARD=true,
  //    Step 6 那两条 redirect 按实证结论跳过),所以这里只有 redirect + agent +
  //    settings + 展开的 knowledgeRoutes 四条。
  { path: 'src/router/index.ts',
    find: "import AgentPage from '../ai/views/AgentPage.vue'\nimport SettingsPage from '../ai/views/SettingsPage.vue'\nimport { knowledgeRoutes } from '../ai/knowledge/knowledgeRoutes'\n",
    replace: '' },
  { path: 'src/router/index.ts',
    find: "  { path: '/ai', redirect: '/ai/agent' },\n  { path: '/ai/agent', name: 'ai-agent', component: AgentPage },\n  { path: '/ai/settings', name: 'ai-settings', component: SettingsPage },\n  ...knowledgeRoutes,\n",
    replace: '' },

  // ── src/router/index.test.ts:knowledge 路由那条用例 ───────────────────────
  //    上面 T13 那节的补丁已经摘掉 14 条相册断言(那条锚点未受本次合流影响,实测仍
  //    hits=1),这里补 T3 新加的这一条。它断言 /ai/knowledge、/ai/knowledge/notes、
  //    /ai/parser/test 三条路径存在 —— knowledgeRoutes 已随上一条补丁摘掉,留着必红。
  //    锚点从块前的空行开始吃,避免删完在上一条用例与 `})` 之间留一个空行。
  { path: 'src/router/index.test.ts',
    find: `
  it('the main route table has expanded the knowledge routes', async () => {
    const { router } = await import('./index')
    const paths = router.getRoutes().map((r) => r.path)
    expect(paths).toContain('/ai/knowledge')
    expect(paths).toContain('/ai/knowledge/notes')
    expect(paths).toContain('/ai/parser/test')
  })
`,
    replace: '' },

  // ── src/components/AppToast.vue:AI 主题作用域 ─────────────────────────────
  //    本组件是**全局**提示条(开源版保留),但 SP8-P2b 给它接了 AI 区的明暗跟随:
  //    模板上两个绑定 + 一个 import + 一行 store 取用 + 顶部那段解释注释。aiTheme 这个
  //    store 在 src/ai/stores/ 下(已整域删除),不摘 import 直接构建失败。
  //    ⚠️ 三处 token(--toast-warn-* / --toast-danger-*)与 [data-tier] 两条 CSS 规则
  //    **保留** —— 实测(2026-08-06)它们是 SP8-P1c2 的通用 severity 分级,消费方就是本
  //    组件自己(`grep -rn -- '--toast-warn'` 只有 theme.css 定义 + 本文件使用 +
  //    src/ai/styles/tokens.scss 的 AI 侧覆写,后者随 src/ai 一起没了),不是 AI 专用。
  //    spec D8 原写"AI 专用 theme token 整组删"是笔误,已按实测收窄为"theme.css 不动"。
  { path: 'src/components/AppToast.vue',
    find: `  <!-- SP8-P2b acceptance round 3 (2026-07-30): while the AI area is in the foreground, wrap
       ourselves in the AI toast scope and its light/dark theme. Without this, the component reads
       the global blue-black theme's translucent white background + white text, which is completely
       invisible on the AI light pages (no AI-area toast feedback ever reaches the user). Root cause
       and token values: aiSurfaces comment in src/ai/stores/aiTheme.ts; styles in tokens.scss
       .ai-toast-scope. Outside the AI area both bindings are inert — desktop/files/apps areas look
       exactly the same (explicit user requirement). -->
  <transition-group
    name="toast" tag="div" class="toast-stack"
    :class="{ 'ai-toast-scope': aiTheme.aiSurfaceActive }"
    :data-theme="aiTheme.aiSurfaceActive ? aiTheme.theme : undefined"
  >`,
    replace: `  <transition-group name="toast" tag="div" class="toast-stack">` },
  { path: 'src/components/AppToast.vue',
    find: "import { useAiTheme } from '../ai/stores/aiTheme'\n", replace: '' },
  { path: 'src/components/AppToast.vue',
    find: 'const aiTheme = useAiTheme()\n', replace: '' },
  //    z-index 那段注释点名了 AI 区三个已删组件并写着"SP8-P6-T3 合流"。**数值 10100 不动**
  //    (它仍高于产出树里最高的 .sk-modal-bg = 1100,改小反而要重新论证,且下方
  //    AppToast.test.ts 末条守卫断言 > 10000);只把理由改写成不点名 AI 的版本。
  { path: 'src/components/AppToast.vue',
    find: `   (reproduced 2026-07-30: user clicked copy in the "create token" dialog).
   [SP8-P6-T3 merge] take sp8's 10100 rather than master's 1100: the AI area lands on trunk with
   this merge, and its SearchImageLightbox / SearchFileDrawer sit at 10000, SearchFullResults 9999,
   so 1100 would be buried under them. 10100 is the smallest safe value that is "above the repo's
   highest 10000, with headroom".
   This element has pointer-events: none, so being on top never intercepts clicks. Guard: last
   test in AppToast.test.ts. */`,
    replace: `   (reproduced 2026-07-30: user clicked copy in the "create token" dialog).
   The value 10100 keeps plenty of headroom above every overlay in the repo.
   This element has pointer-events: none, so being on top never intercepts clicks. Guard: last
   test in AppToast.test.ts. */`,
  },

  // ── src/components/AppToast.test.ts:AI 作用域那 4 条用例 + import ──────────
  //    本文件是混合型:前 8 条(渲染/堆叠/action/三档 tier)与 AI 无关,保留;
  //    中间那个 describe 整块测的是 aiTheme 跟随(store 已删),整块摘掉;
  //    末尾 z-index 守卫保留(它读 AppToast.vue 源文本断言 > 10000,与 AI 无关),
  //    只洗掉注释里点名的两个 AI 组件。
  { path: 'src/components/AppToast.test.ts',
    find: "import { useAiTheme } from '../ai/stores/aiTheme'\n", replace: '' },
  { path: 'src/components/AppToast.test.ts',
    find: `
// [SP8-P2b acceptance round 3, user decision 2026-07-30] While the AI area is in the foreground,
// the toast must follow the AI light/dark theme (otherwise white-on-white is invisible, see the
// notes in aiTheme.test.ts). Leaving the AI area must restore everything exactly — the user
// explicitly required "zero impact on the desktop", so "no extra class / data-theme outside the
// AI area" must be pinned as well.
describe('AppToast — AI area toast scoping', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('Not in AI area: no ai-toast-scope, no data-theme (zero impact on desktop)', () => {
    const w = mount(AppToast)
    const root = w.find('.toast-stack')
    expect(root.classes()).not.toContain('ai-toast-scope')
    expect(root.attributes('data-theme')).toBeUndefined()
  })

  it('AI area in foreground: has ai-toast-scope, data-theme follows AI theme', async () => {
    const ai = useAiTheme()
    ai.enterAiSurface()
    const w = mount(AppToast)
    const root = w.find('.toast-stack')
    expect(root.classes()).toContain('ai-toast-scope')
    expect(root.attributes('data-theme')).toBe(ai.theme)
  })

  it('Toggling light/dark inside AI area: data-theme changes (dialogs/toasts do not need to be closed and reopened)', async () => {
    const ai = useAiTheme()
    ai.enterAiSurface()
    const w = mount(AppToast)
    const before = w.find('.toast-stack').attributes('data-theme')
    ai.toggleTheme()
    await w.vm.\$nextTick()
    const after = w.find('.toast-stack').attributes('data-theme')
    expect(after).not.toBe(before)
    expect(after).toBe(ai.theme)
  })

  it('After leaving AI area, restore: both class and data-theme are removed', async () => {
    const ai = useAiTheme()
    ai.enterAiSurface()
    const w = mount(AppToast)
    expect(w.find('.toast-stack').classes()).toContain('ai-toast-scope')
    ai.leaveAiSurface()
    await w.vm.\$nextTick()
    expect(w.find('.toast-stack').classes()).not.toContain('ai-toast-scope')
    expect(w.find('.toast-stack').attributes('data-theme')).toBeUndefined()
  })
})
`,
    replace: '' },
  { path: 'src/components/AppToast.test.ts',
    find: `// scrim at \`sk-shared.scss:102\` is \`1100\`, and the AI area's SearchImageLightbox/SearchFileDrawer
// are \`10000\`, SearchFullResults \`9999\` (the highest layers found by a repo-wide grep). The toast
// is the **topmost feedback** and must cover all of these, otherwise the user gets no feedback`,
    replace: `// scrim at \`sk-shared.scss:102\` is \`1100\`, while the highest overlay found by a repo-wide grep
// sits at \`10000\`. The toast is the **topmost feedback** and must cover all of these,
// otherwise the user gets no feedback` },

  // ── src/home/composables/useOpenAction.test.ts:T5 新加的 AI cutover 整块 ──
  //    上面 T13 / 修复波两节已有 11 条锚点打在本文件上(实测均未受本次合流影响,
  //    仍 hits=1)。这里补 T5(c547c9d)追加的两处:beforeEach 里的 /ai flag 清理,
  //    与文件末尾那个 describe(测 openApp('ai') / widget 小组件 / sendToAI,
  //    三者在开源版都已由上面的产品码补丁摘掉)。
  //    SP14 T9(commit d4d3771)重抓:describe 内部中间插了一条 knowledge 用例(现共 8 条),
  //    原 7-用例锚点因此 hits=0。knowledge 与 ai 同属被摘掉的产品码分支,replace 仍是
  //    整块清空,find 只是照现场文本扩到 8 条,不需要单独处理 knowledge 那一条。
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: "  localStorage.removeItem('strangler:disabled:/ai')\n", replace: '' },
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: `
describe('AI section cutover (SP8-P6)', () => {
  it('ai tile should use in-app router.push /ai/agent', () => {
    const { openApp } = useOpenAction()
    openApp('ai')
    expect(router.push).toHaveBeenCalledWith('/ai/agent')
    expect(hrefs.length).toBe(0)
  })

  it('when flag is set to 1, ai tile should fall back to Vue2 /#/ai/agent', () => {
    localStorage.setItem('strangler:disabled:/ai', '1')
    const { openApp } = useOpenAction()
    openApp('ai')
    expect(router.push).not.toHaveBeenCalled()
    expect(hrefs).toEqual(['/#/ai/agent'])
  })

  it('desktop AI widget should use in-app router.push /ai/agent', () => {
    const { openItem } = useOpenAction()
    openItem({ kind: 'widget', key: 'ai' } as LayoutItem)
    expect(router.push).toHaveBeenCalledWith('/ai/agent')
    expect(hrefs.length).toBe(0)
  })

  it('when flag is set to 1, AI widget should fall back to Vue2', () => {
    localStorage.setItem('strangler:disabled:/ai', '1')
    const { openItem } = useOpenAction()
    openItem({ kind: 'widget', key: 'ai' } as LayoutItem)
    expect(router.push).not.toHaveBeenCalled()
    expect(hrefs).toEqual(['/#/ai/agent'])
  })

  it('sendToAI should use in-app with message query (object form, not manually encoded)', () => {
    const { sendToAI } = useOpenAction()
    sendToAI('帮我找 发票 & 收据')
    expect(router.push).toHaveBeenCalledWith({ path: '/ai/agent', query: { message: '帮我找 发票 & 收据' } })
    expect(hrefs.length).toBe(0)
  })

  it('sendToAI with empty text should not include query', () => {
    const { sendToAI } = useOpenAction()
    sendToAI('   ')
    expect(router.push).toHaveBeenCalledWith({ path: '/ai/agent' })
  })

  it('knowledge tile should use in-app router /ai/knowledge (SP14 #98, no fallback target)', () => {
    const { openApp } = useOpenAction()
    openApp('knowledge')
    expect(router.push).toHaveBeenCalledWith('/ai/knowledge')
    expect(hrefs.length).toBe(0)
  })

  it('when flag is set to 1, sendToAI should fall back to Vue2 and maintain encodeURIComponent string concatenation', () => {
    localStorage.setItem('strangler:disabled:/ai', '1')
    const { sendToAI } = useOpenAction()
    sendToAI('发票 & 收据')
    expect(router.push).not.toHaveBeenCalled()
    expect(hrefs).toEqual(['/#/ai/agent?message=' + encodeURIComponent('发票 & 收据')])
  })
})
`,
    replace: '' },

  // ── package.json:AI 独占的 5 个运行时/类型依赖 ────────────────────────────
  //    逐个用 \`grep -rl <包名> src | grep -v '^src/ai/'\` 实测过消费方(2026-08-06):
  //      @tiptap/pm · @tiptap/starter-kit · @tiptap/vue-3 · tiptap-markdown
  //        —— 笔记编辑器,src/ai 之外零消费方(总消费文件 1/1/4/2,全在 src/ai 下)。
  //      dompurify + @types/dompurify —— 唯一消费方 src/ai/markdown/renderMarkdown.ts。
  //    对照组(**不删**):markdown-it 有 4 个域外消费方(文件预览器 / 应用商店详情 /
  //    预装提示 / 更新弹窗),vue-advanced-cropper / composerize / yaml 同理都有域外消费方。
  //    ⚠️ pnpm-lock.yaml 里对应的 importers 记录不会跟着删(export.mjs 只重写 file: 路径),
  //    产出树的 lockfile 因此与 package.json 有漂移。tree.test.mjs 的"产物树能构建"门
  //    用的是 \`pnpm install --no-frozen-lockfile\`(见该文件注释),不受影响;但产出仓里
  //    \`CI=true pnpm install\` 会因 ERR_PNPM_OUTDATED_LOCKFILE 失败 —— 已知代价,记在
  //    p6-task-7-report.md,留给发布前统一处理。
  { path: 'package.json',
    find: '    "@tiptap/pm": "^2.27.2",\n    "@tiptap/starter-kit": "^2.27.2",\n    "@tiptap/vue-3": "^2.27.2",\n',
    replace: '' },
  { path: 'package.json',
    find: '    "tiptap-markdown": "^0.8.10",\n', replace: '' },
  { path: 'package.json',
    find: '    "dompurify": "^3.4.12",\n', replace: '' },
  { path: 'package.json',
    find: '    "@types/dompurify": "^3.2.0",\n', replace: '' },

  // ── 两片版守卫:src/i18n/__tests__/shardDisjoint.test.ts(修复轮 1 · Important 1)─
  //    第一版把整份文件放进了 DELETE,理由是"它守的三件事 parity.test.ts 都有"。
  //    独立评审逐条驳回,复核后**三条全部不成立**,已撤回:
  //      ① parity 的「分片不得覆盖基座已有 key」只查 zh 侧
  //         (parity.test.ts:31 `Object.keys(zhSp9).filter(k => k in zhBase)`),
  //         **没有 en 侧对应断言**。只在英文侧撞车时:合并后两语言键集仍相等 →
  //         parity 第一条绿;zh 侧没撞 → parity 那条也绿 —— 英文文案被静默覆盖而
  //         零守卫。而基座与 sp9 分片**都是保留面**,这个盲区会真的留在产出树里。
  //      ② 「键数之和 == 真实 messages 键数」刻意 import '../index' 走**真实装配
  //         路径**(见该文件 20-22 / 63-65 行)。全仓**只有这一个文件**碰
  //         src/i18n/index.ts 的装配结果 —— parity.test.ts 自己手写
  //         `{...zhBase, ...zhSp9}`,根本不 import index.ts。删掉之后"index.ts 有没有
  //         真把分片并进去"在产出树里零覆盖,而 index.ts 与分片都是保留面。
  //      ③ parity 断言的是**合并后**集合;跨片错位(某键在 zh 的基座里却在 en 的
  //         分片里)合并后仍相等,per-shard 对称性丢失 —— 该文件 106-108 行自己就
  //         写着"base / ai / sp9 三条是本文件独有,此前没有任何测试守这三片的中英对称"。
  //
  //    🔴 为什么用 PATCH 而不是评审建议的 REPLACE + 哈希钉:**REPLACE 这条路走不通**。
  //    冻结分身要能跑就必须含 `import zhSp9 from '../zh_cn.sp9'`(ESM 裸说明符,不带
  //    .ts),而 tree.test.mjs 的「REPLACE 表里每一个冻结分身都不含固定清单里的词」
  //    会把它按 /\bsp[789]\b(?!\.ts)/i 判成期号泄漏 —— 那条 (?!\.ts) 豁免只覆盖**带
  //    扩展名**的文件名引用,覆盖不到 import 说明符。已用正则实测确认命中。
  //    走通它只有两条路:放宽那条豁免(= 削弱别人的守卫,本项目明令禁止),或把
  //    import 写成动态拼字符串(为躲守卫而混淆,更糟)。PATCH 没有这个问题:import
  //    行属**保留原文**,不经 replace payload,那道守卫按设计就不管它;而 replace
  //    payload 本身仍受同一条守卫约束(下面每段措辞都按它写,期号一律用文件名形式)。
  //    评审要的产物("产物树里放一份两片版守卫")一条不少地达成,只是换了载体。
  //
  //    🔴 变异实测(2026-08-06,在产物树上做,两次都已还原):
  //      · 往产物树 zh_cn.sp9.ts 插一个与 zh_cn.base.ts 重名的键 → zh 侧那条红 ✔
  //      · 只往 en_us.sp9.ts 插 en-only 撞车(zh 侧不插)→ **en 侧那条红** ✔
  //        (这正是 parity.test.ts 漏掉、第一版删除会放回去的那一类)
  //    详见 .superpowers/sdd/p6-task-7-report.md §9。

  //    (a) 文件头:整段重写成两片版(原文点名 photosSlice.test.ts / photos / ai)
  { path: 'src/i18n/__tests__/shardDisjoint.test.ts',
    find: `// SP8-P6-T4: standing guard that the i18n shards stay disjoint.
//
// Background and the three safety premises are in photosSlice.test.ts's top comment:
// shards are combined by object spread (\`{...base, ...photos, ...ai}\`), so a duplicate key
// is silently overwritten by whichever spread comes last -- git reports no conflict, and
// parity.test.ts only checks the *merged* key set, so if both languages collide the same
// way the merged results still match and parity passes too. This class of mistake used to
// be completely silent.
//
// This file covers the three gaps photosSlice.test.ts leaves (that file already pins
// "the three shards (base/photos/ai) are pairwise disjoint" and "the entry point is a
// pure merge", neither of which is repeated here):
//
//   ① There are **4** real shards, not 3. \`zh_cn.sp9.ts\` / \`en_us.sp9.ts\` do not go
//      through the \`zh_cn.ts\` / \`en_us.ts\` entry point -- they are merged separately in
//      \`src/i18n/index.ts\` (\`{ ...zh, ...zhSp9 }\`), a second, independent assembly path.
//      photosSlice.test.ts only checks the \`zh_cn.ts\` entry point (base+photos+ai), so it
//      misses the risk of sp9 colliding with the other three, and sp9 is a whole sprint's
//      worth of copy (459 keys) -- not a small shard.
//   ② A prefix guard for the ai shard itself (that shard was added in T3 and had no
//      guard of its own).
//   ③ Per-shard structural symmetry between the two languages -- every shard's zh and en
//      key sets must be identical. If the two languages each collide in a different way,
//      an aggregate check like "the merged key counts are equal" goes blind (the counts
//      happen to match while the keys differ).
//
// The "lossless partition" case deliberately exercises the **real assembly path**: the
// createI18n instance obtained via import '../index' (\`messages.zh_cn\` / \`messages.en_us\`
// inside index.ts), rather than only the zh_cn.ts entry point, which does not include sp9
// and would therefore miss the possibility of an sp9 collision.`,
    replace: `// Standing guard that the i18n shards stay disjoint.
//
// The copy is split across two files and combined by object spread
// (\`{ ...base, ...shard }\`), so a duplicate key is silently overwritten by whichever
// spread comes last -- git reports no conflict, and parity.test.ts only checks the
// *merged* key set: if both languages collide the same way the merged results still
// match and parity passes too. This class of mistake used to be completely silent.
//
// This file covers three gaps parity.test.ts leaves:
//
//   ① parity's "a shard must not override a key the base already has" **only checks the
//      zh side** (\`Object.keys(zhSp9).filter((k) => k in zhBase)\` in parity.test.ts).
//      When only the English side collides, the merged key sets are still equal so
//      parity's first case passes, and the zh side really did not collide so that case
//      passes too. English copy gets silently overwritten with nothing watching. Both
//      languages are checked below.
//   ② The **real assembly path**. \`src/i18n/index.ts\` is where the two shards actually
//      get combined in production (\`{ ...zh, ...zhSp9 }\`), while parity.test.ts writes
//      the merge formula out again itself and never imports index.ts. The "lossless
//      partition" case below deliberately reads the createI18n instance index.ts built,
//      so "did index.ts really merge the shard in" is covered -- the only place in the
//      repo that does.
//   ③ **Per-shard** structural symmetry between the two languages. parity asserts on the
//      *merged* set, so a cross-shard misplacement (a key in zh's base but in en's shard)
//      still compares equal after merging; only a per-shard comparison sees it.` },

  //    (b)(c) 摘掉两组 import(4 行)。⚠️ 剩下的 sp9 两行是**保留原文**,不经
  //           replace payload —— 冻结分身守卫按设计不管它们(见上方长注释)。
  { path: 'src/i18n/__tests__/shardDisjoint.test.ts',
    find: "import zhPhotos from '../zh_cn.photos'\nimport zhAi from '../zh_cn.ai'\n", replace: '' },
  { path: 'src/i18n/__tests__/shardDisjoint.test.ts',
    find: "import enPhotos from '../en_us.photos'\nimport enAi from '../en_us.ai'\n", replace: '' },

  //    (d) zh 侧不相交:六对 → 一对
  { path: 'src/i18n/__tests__/shardDisjoint.test.ts',
    find: `describe('zh: the four shards are pairwise disjoint (base / photos / ai / sp9)', () => {
  it('all six pairings are disjoint', () => {
    expect(overlap(zhBase as Dict, zhPhotos as Dict), 'base × photos').toEqual([])
    expect(overlap(zhBase as Dict, zhAi as Dict), 'base × ai').toEqual([])
    expect(overlap(zhBase as Dict, zhSp9 as Dict), 'base × sp9').toEqual([])
    expect(overlap(zhPhotos as Dict, zhAi as Dict), 'photos × ai').toEqual([])
    expect(overlap(zhPhotos as Dict, zhSp9 as Dict), 'photos × sp9').toEqual([])
    expect(overlap(zhAi as Dict, zhSp9 as Dict), 'ai × sp9').toEqual([])
  })
})`,
    replace: `describe('zh: the two shards are disjoint (base / zh_cn.sp9.ts)', () => {
  it('base and shard are disjoint', () => {
    expect(overlap(zhBase as Dict, zhSp9 as Dict), 'base × shard').toEqual([])
  })
})`},

  //    (e) en 侧不相交:这条是 parity 缺的那一条,注释里把理由钉死,免得后人又删
  { path: 'src/i18n/__tests__/shardDisjoint.test.ts',
    find: `describe('en: the four shards are pairwise disjoint (base / photos / ai / sp9)', () => {
  it('all six pairings are disjoint', () => {
    expect(overlap(enBase as Dict, enPhotos as Dict), 'base × photos').toEqual([])
    expect(overlap(enBase as Dict, enAi as Dict), 'base × ai').toEqual([])
    expect(overlap(enBase as Dict, enSp9 as Dict), 'base × sp9').toEqual([])
    expect(overlap(enPhotos as Dict, enAi as Dict), 'photos × ai').toEqual([])
    expect(overlap(enPhotos as Dict, enSp9 as Dict), 'photos × sp9').toEqual([])
    expect(overlap(enAi as Dict, enSp9 as Dict), 'ai × sp9').toEqual([])
  })
})`,
    replace: `// ⚠️ Do not delete this describe: it is the one parity.test.ts does **not** have.
// parity's "a shard must not override a key the base already has" only checks the zh
// side, so when the collision is on the English side its whole set of assertions stays
// green (the merged key sets are still equal, and the zh side really did not collide) --
// and English copy gets silently overwritten.
describe('en: the two shards are disjoint (base / en_us.sp9.ts)', () => {
  it('base and shard are disjoint', () => {
    expect(overlap(enBase as Dict, enSp9 as Dict), 'base × shard').toEqual([])
  })
})`},

  //    (f) 无损划分:判别力边界注释重写 + 两个求和从四项收到两项
  { path: 'src/i18n/__tests__/shardDisjoint.test.ts',
    find: `  // Read the real i18n instance's messages instead of hand-writing {...a, ...b, ...c, ...d}
  // again -- otherwise this test and the code under test would share the same (possibly
  // equally wrong) assembly formula and could never catch the assembly path itself being
  // wrong.
  //
  // What this assertion can and cannot discriminate (an independent review ran mutation
  // tests; the conclusion is recorded here so nobody misreads it later):
  //   Catches: a shard drifting outside the real assembly path (say a fifth shard is added
  //     later and nobody merges it in index.ts), or the real messages picking up a source
  //     beyond these four known shards. A targeted sp9×ai collision (planting a key in
  //     zh_cn.sp9.ts that also exists in zh_cn.ai.ts) turns this red together with the
  //     pairwise-disjoint cases -- which is the core reason shardDisjoint.test.ts exists:
  //     under that same mutation all 12 assertions in photosSlice.test.ts stay green and
  //     completely blind (it has no sp9 shard).
  //   Misses: a pure deletion or pure addition inside one shard that collides with
  //     nothing -- say removing a key from zh_cn.sp9.ts. Then "the sum of the four shards'
  //     key counts" and "the assembled key count" both drop by 1, and the equation holds
  //     by set theory (as long as the pairwise-disjoint premise is intact), so this stays
  //     green without meaning that no copy was lost. Guarding against accidental copy
  //     deletion needs other means (value-range checks like messageSyntax.test.ts, or
  //     existence assertions on known key names); it is not this assertion's job.
  const realMessages = i18n.global.messages.value as Record<string, Dict>

  it('zh_cn: base+photos+ai+sp9 key counts sum to the messages.zh_cn key count', () => {
    const sum = Object.keys(zhBase as Dict).length + Object.keys(zhPhotos as Dict).length +
      Object.keys(zhAi as Dict).length + Object.keys(zhSp9 as Dict).length
    expect(sum).toBe(Object.keys(realMessages.zh_cn).length)
  })

  it('en_us: base+photos+ai+sp9 key counts sum to the messages.en_us key count', () => {
    const sum = Object.keys(enBase as Dict).length + Object.keys(enPhotos as Dict).length +
      Object.keys(enAi as Dict).length + Object.keys(enSp9 as Dict).length
    expect(sum).toBe(Object.keys(realMessages.en_us).length)
  })
})

describe('ai shard prefix guard', () => {
  it('every zh_cn.ai.ts key starts with ai', () => {
    const bad = Object.keys(zhAi as Dict).filter((k) => !k.startsWith('ai'))
    expect(bad, \`keys without the ai prefix: \${bad.join(', ')}\`).toEqual([])
  })

  it('every en_us.ai.ts key starts with ai', () => {
    const bad = Object.keys(enAi as Dict).filter((k) => !k.startsWith('ai'))
    expect(bad, \`keys without the ai prefix: \${bad.join(', ')}\`).toEqual([])
  })
})`,
    replace: `  // Read the real i18n instance's messages instead of hand-writing {...a, ...b} again --
  // otherwise this test and the code under test would share the same (possibly equally
  // wrong) assembly formula and could never catch the assembly path itself being wrong.
  // **This is the only place in the repo** that asserts on what src/i18n/index.ts really
  // assembled.
  //
  // What this assertion can and cannot discriminate (recorded here so nobody misreads it
  // later):
  //   Catches: a shard drifting outside the real assembly path (say another shard is
  //     added later and nobody merges it in index.ts), or the real messages picking up a
  //     source beyond these two known shards.
  //   Misses: a pure deletion or pure addition inside one shard that collides with
  //     nothing -- say removing a key from the shard. Then "the sum of the two shards'
  //     key counts" and "the assembled key count" both drop by 1, and the equation holds
  //     by set theory (as long as the disjoint premise is intact), so this stays green
  //     without meaning that no copy was lost. Guarding against accidental copy deletion
  //     needs other means (existence assertions on known key names and the like); it is
  //     not this assertion's job.
  const realMessages = i18n.global.messages.value as Record<string, Dict>

  it('zh_cn: the two shards\\' key counts sum to the messages.zh_cn key count', () => {
    const sum = Object.keys(zhBase as Dict).length + Object.keys(zhSp9 as Dict).length
    expect(sum).toBe(Object.keys(realMessages.zh_cn).length)
  })

  it('en_us: the two shards\\' key counts sum to the messages.en_us key count', () => {
    const sum = Object.keys(enBase as Dict).length + Object.keys(enSp9 as Dict).length
    expect(sum).toBe(Object.keys(realMessages.en_us).length)
  })
})`},

  //    (g) 逐片中英对称:摘掉 photos / ai 两条,注释改写
  { path: 'src/i18n/__tests__/shardDisjoint.test.ts',
    find: `describe('per-shard symmetry between the two languages (each shard has identical zh and en key sets)', () => {
  // The photos case overlaps with photosSlice.test.ts's "both languages have identical key
  // sets" -- it is kept so that this file is a complete inventory of four-shard symmetry on
  // its own, without having to open another file to confirm photos is covered too. The
  // base / ai / sp9 cases are unique to this file; nothing guarded those three shards'
  // zh/en symmetry before.
  it('base shard: zh and en key sets are identical', () => {
    expect(Object.keys(zhBase as Dict).sort()).toEqual(Object.keys(enBase as Dict).sort())
  })

  it('photos shard: zh and en key sets are identical', () => {
    expect(Object.keys(zhPhotos as Dict).sort()).toEqual(Object.keys(enPhotos as Dict).sort())
  })

  it('ai shard: zh and en key sets are identical', () => {
    expect(Object.keys(zhAi as Dict).sort()).toEqual(Object.keys(enAi as Dict).sort())
  })

  it('sp9 shard: zh and en key sets are identical', () => {
    expect(Object.keys(zhSp9 as Dict).sort()).toEqual(Object.keys(enSp9 as Dict).sort())
  })
})`,
    replace: `describe('per-shard symmetry between the two languages (each shard has identical zh and en key sets)', () => {
  // parity.test.ts asserts on the *merged* set, so a cross-shard misplacement (a key in
  // zh's base but in en's shard) still compares equal after merging -- only a per-shard
  // comparison sees it. These two cases are unique to this file.
  it('base: zh and en key sets are identical', () => {
    expect(Object.keys(zhBase as Dict).sort()).toEqual(Object.keys(enBase as Dict).sort())
  })

  it('shard: zh and en key sets are identical', () => {
    expect(Object.keys(zhSp9 as Dict).sort()).toEqual(Object.keys(enSp9 as Dict).sort())
  })
})`},

  // ── src/components/AppToast.zIndex.test.ts:取数有效性闸的样式表计数阈值 ────
  //    这条是 T3 加的"守卫别空转"元断言,产出树里**实跑会红**(2026-08-06 在产物树上
  //    `pnpm exec vitest run` 实测到,vue-tsc 抓不到这类失败,故必须真跑一遍)。
  //    原因:阈值 `> 5` 是按私有仓 14 个独立样式表(5 个 .css + 9 个 .scss)定的,而那
  //    9 个 .scss **全部**在 src/ai/styles/ 下(实测 `find src -name '*.scss'`,9/9),
  //    随 src/ai 一起删掉之后产出树只剩 5 个 .css —— `expect(5).toBeGreaterThan(5)` 必红。
  //    改成 `> 4` 而不是删掉这条断言:产出树共 5 个样式表,阈值 4 的语义正是"5 个一个
  //    不少地读到了非空内容",`?raw` 恒空的老坑一旦复发(读到 0 个)照样立刻打红,
  //    判别力与私有侧等价 —— 这不是放宽,是按产出树的真实规模重新钉紧。
  { path: 'src/components/AppToast.zIndex.test.ts',
    find: "    expect(sheets.length, 'Standalone stylesheets not read at all (old pitfall: `?raw` always empty)').toBeGreaterThan(5)",
    replace: "    // This tree has 5 standalone stylesheets (all .css); threshold 4 means \"all 5 were read with non-empty content\".\n    expect(sheets.length, 'Standalone stylesheets not read at all (old pitfall: `?raw` always empty)').toBeGreaterThan(4)" },

  // ── 注释洗白:sp8-ai 合流往**保留面**的文件里带进来的 7 处点名 ────────────
  //    这 7 处是 2026-08-06 实测跑完整导出、泄漏守卫在 New-UI 侧命中的全部内容
  //    (Service 侧另有 977 处,归 T8)。全是注释,与 T7/T14 两轮"注释洗白"同性质:
  //    代码行为一字不改,只把指向已删功能区的点名换成不点名的等价措辞。

  //    ① AppToast.zIndex.test.ts:引用了两个已删测试文件当"先例"。守卫本身保留。
  { path: 'src/components/AppToast.zIndex.test.ts',
    find: `// with zero discriminating power. This is the same pit recorded at the top of photosSlice.test.ts /
// knowledgeStyles.test.ts ("always read from disk via node:fs; \`?raw\` is always empty"), and we
// follow their established approach here.`,
    replace: `// with zero discriminating power. A few other style guards in this repo hit the same pit; the
// established approach is "always read from disk via node:fs; \`?raw\` is always empty", and we
// follow it here.` },

  //    ②③ clipboard.ts / clipboard.test.ts:reka 焦点陷阱那段根因说明里点名了
  //       复现路径所在的页面。根因与修法与那个页面无关(是 reka DialogContent 的
  //       通用行为),把页面名换成"设置页/弹窗"即可,技术内容一字不动。
  { path: 'src/files/util/clipboard.ts',
    find: `// Originally always attached to document.body, but **all copies in dialogs fail**
// (user test: copy on the AI settings page works, but all three copies in the "Create Token"
// dialog fail). Root cause is reka's focus trap`,
    replace: `// Originally always attached to document.body, but **all copies in dialogs fail**
// (user test: copy on the settings page works, but no copy button inside a dialog copies
// anything). Root cause is reka's focus trap` },
  { path: 'src/files/util/clipboard.test.ts',
    find: `// SP8-P2b round 4 acceptance, 2026-07-30 — user test: copy on the AI settings **page**
// works, but all three copy buttons in the **"Create Token" dialog** fail
// (clipboard is empty).`,
    replace: `// [2026-07-30 user test] Copying on the settings **page** works, but **none of the copy
// buttons inside a dialog copy anything (the clipboard stays empty)**.` },

  //    ④⑤⑥ userProfile.ts:三处点名(AI 侧栏 / AgentSidebar / AI 区)。这个 store
  //         本身是保留面(任何渲染头像的组件都能用),只是它的文件头讲的是"能力从
  //         哪个组件搬过来的"。搬出处已随 src/ai 删除,改成不点名的等价描述。
  { path: 'src/stores/userProfile.ts',
    find: "// `$EventBus` 'avatar-changed' event and every subscriber (incl. the AI\n// sidebar) re-fetched it. New-UI has no event bus, and — more importantly —\n",
    replace: "// `$EventBus` 'avatar-changed' event and every subscriber re-fetched it.\n// New-UI has no event bus, and — more importantly —\n" },
  { path: 'src/stores/userProfile.ts',
    find: "// right place: `avatarVersion` used to be a local ref inside AgentSidebar\n// (only the AI sidebar's `<img>` would ever change); it now lives here, at\n",
    replace: "// right place: `avatarVersion` used to be a local ref inside one sidebar\n// component (the only `<img>` that would ever change); it now lives here, at\n" },
  { path: 'src/stores/userProfile.ts',
    find: '// and reloads the image. No event bus, no changes needed in the AI area.\n',
    replace: '// and reloads the image. No event bus, no changes needed anywhere else.\n' },

  //    ⑦ vite.config.ts:dev proxy 那段合流说明拿 /app/#/ai/* 当例子。转发规则本身
  //      与举的例子无关(它转发的是 /app/ 之外的一切),去掉 ai 这一段路径即可。
  //      ⚠️ 锚点**只吃带 ai 的那一行**,不连上一行一起换:上一行含 "Vue2",而
  //      tree.test.mjs 那道守卫禁止 replace 内容出现该词(第一版连着换被逮到)。
  //      上一行属于"保留原文"、不经 replace 写入,不受该守卫管辖,也不在泄漏词表里。
  { path: 'vite.config.ts',
    find: 'then enter /app/#/ai/* for acceptance',
    replace: 'then enter /app/#/ for acceptance' },
]

/** Service 侧的锚点补丁(相对 packages/service/)。T7 填。 */
export const SERVICE_PATCH = [
  // 注:这里原本的第 1 条补丁把内嵌包的入口从 ./dist/index.js 改指 ./src/index.ts
  // (理由:export.mjs 用 git archive 取源,而 dist/ 在 .gitignore 里拿不到,消费方
  // 会 "Failed to resolve entry for package" —— T13 是第一个真在产出树里跑
  // pnpm install && pnpm test 的任务,才暴露出这个洞)。
  // **SP13(2026-08-07)起该补丁已上游化**:私有仓 packages/service/package.json
  // 本身就指 ./src/index.ts,原补丁的 find 锚点必然失配,故删除。
  { path: 'src/index.ts', find: "import { createPhotos } from './photos.js'\n", replace: '' },
  { path: 'src/index.ts', find: 'PhotoAsset, ', replace: '' },
  { path: 'src/index.ts',
    find: '  get photos(): ReturnType<typeof createPhotos> {\n    return createPhotos(getHttp() as AxiosInstance, () => getConfig().getToken())\n  },\n',
    replace: '' },
  { path: 'src/types.ts',
    find: 'export interface PhotoAsset { id: string | number; [k: string]: unknown }\n', replace: '' },

  // ── SP9-P7:index.ts 的三处 search 接线(SERVICE_DELETE 删掉 src/search.ts 之后
  //    这三行全都指向不存在的模块,内嵌共享包直接构建失败)。────────────────────
  { path: 'src/index.ts', find: "import { createSearch } from './search.js'\n", replace: '' },
  { path: 'src/index.ts',
    find: "export type { SearchSource, SearchFilePath, SearchCite, SemanticHit, FileNameHit, ImageHit, NoteHit, NormalizedAggregate } from './search.js'\n",
    replace: '' },
  { path: 'src/index.ts',
    find: '  get search(): ReturnType<typeof createSearch> {\n    return createSearch(getHttp() as AxiosInstance)\n  },\n',
    replace: '' },

  // ── SP8-P6-T8:index.ts 的 13 处 AI 域接线(SERVICE_DELETE 删掉 ai/notes/sse/wiki
  //    四个模块之后,这些行全都指向不存在的模块,内嵌共享包直接构建失败)。
  //    锚点是 2026-08-06 从 NimoOS-Service@ac39cd7 的 src/index.ts 现场逐字抓的,
  //    不是照抄 brief —— 本项目「手编锚点」已栽过多次。────────────────────────────
  { path: 'src/index.ts', find: "import { createAi } from './ai.js'\n", replace: '' },
  { path: 'src/index.ts', find: "import { sseRequest } from './sse.js'\n", replace: '' },
  { path: 'src/index.ts', find: "import { createNotes } from './notes.js'\n", replace: '' },
  { path: 'src/index.ts', find: "import { createWiki } from './wiki.js'\n", replace: '' },
  // 具名导出行:整行换整行(比抠 ', sseRequest' 更稳 —— 后者依赖那个逗号的位置)。
  { path: 'src/index.ts',
    find: 'export { initService, getHttp, refreshAccessToken, parseUtil, UPLOAD_TUS_ENDPOINT, networkErrorText, sseRequest }\n',
    replace: 'export { initService, getHttp, refreshAccessToken, parseUtil, UPLOAD_TUS_ENDPOINT, networkErrorText }\n' },
  { path: 'src/index.ts', find: "export { isDistillableName, DISTILL_EXTS } from './notes.js'\n", replace: '' },
  { path: 'src/index.ts', find: "export { createRootBody } from './wiki.js'\n", replace: '' },
  { path: 'src/index.ts', find: "export type { SseOptions, SseOutcome } from './sse.js'\n", replace: '' },
  { path: 'src/index.ts',
    find: "export type { Note, CreateNoteFields, UpdateNoteFields, NotesSettings, SettingsFields, NotesDistillSettings, DistillSettingsPatch, DistillJob, DistillJobsView } from './notes.js'\n",
    replace: '' },
  { path: 'src/index.ts',
    find: "export type { WikiRoot, WikiCandidate, WikiTreeNode, WikiChildMapEntry, WikiRecentChange, WikiNode } from './wiki.js'\n",
    replace: '' },
  { path: 'src/index.ts',
    find: '  get ai(): ReturnType<typeof createAi> {\n    return createAi(getHttp() as AxiosInstance, () => getConfig().getToken())\n  },\n',
    replace: '' },
  { path: 'src/index.ts',
    find: '  get notes(): ReturnType<typeof createNotes> {\n    return createNotes(getHttp() as AxiosInstance)\n  },\n',
    replace: '' },
  { path: 'src/index.ts',
    find: '  get wiki(): ReturnType<typeof createWiki> {\n    return createWiki(getHttp() as AxiosInstance)\n  },\n',
    replace: '' },
]
