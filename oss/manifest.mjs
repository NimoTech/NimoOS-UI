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
  'design-export',

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
  // 相册面 = 一个域目录 + 13 个视图 + 16 个视图测试 + 2 个 i18n 分片 + 1 道分片守卫。
  // ⚠️ 逐条列、不用通配:DELETE 路径不存在即 exit 1,清单过期时要能立刻知道
  //    (2026-08-05 清点结果:`ls src/views | grep -i photo` = 13、
  //     `ls src/views/__tests__ | grep -i photo` = 16)。
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
  // 13 个视图
  'src/views/Photos.vue',
  'src/views/PhotosAlbumDetail.vue',
  'src/views/PhotosAlbums.vue',
  'src/views/PhotosFavorites.vue',
  'src/views/PhotosPeople.vue',
  'src/views/PhotosPersonDetail.vue',
  'src/views/PhotosPlaceAssets.vue',
  'src/views/PhotosPlaces.vue',
  'src/views/PhotosSearch.vue',
  'src/views/PhotosSettings.vue',
  'src/views/PhotosSmartViewDetail.vue',
  'src/views/PhotosSmartViews.vue',
  'src/views/PhotosTrash.vue',
  // 16 个视图测试
  'src/views/__tests__/Photos.integration.test.ts',
  'src/views/__tests__/Photos.lightbox.test.ts',
  'src/views/__tests__/Photos.route.test.ts',
  'src/views/__tests__/PhotosAlbumDetail.test.ts',
  'src/views/__tests__/PhotosAlbums.test.ts',
  'src/views/__tests__/PhotosFavorites.test.ts',
  'src/views/__tests__/photosGlassSurfaces.test.ts',
  'src/views/__tests__/photosLayoutHeightCap.test.ts',
  'src/views/__tests__/PhotosPeople.test.ts',
  'src/views/__tests__/PhotosPersonDetail.test.ts',
  'src/views/__tests__/PhotosPlaceAssets.test.ts',
  'src/views/__tests__/PhotosPlaces.test.ts',
  'src/views/__tests__/PhotosSearch.test.ts',
  'src/views/__tests__/PhotosSettings.test.ts',
  'src/views/__tests__/PhotosSmartViewDetail.test.ts',
  'src/views/__tests__/PhotosSmartViews.test.ts',
  'src/views/__tests__/PhotosTrash.test.ts',

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

  // SP14 T9(d4d3771)新增的孤儿测试:整份文件只有两条用例,一条直接断言 knowledge
  // 系统应用条目(已在上面 PATCH 摘掉),另一条"keys 去重"虽然本身与 AI 无关,但
  // 挂在同一个以 knowledge 命名的 describe 下、文件本身也是这次才新建的,不值得为它
  // PATCH 出一个只剩一条用例的空壳文件——整体删除。
  'src/home/apps/systemApps.test.ts',
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
  'src/photos.persons.test.ts',
  'src/photos.places.test.ts',
  'src/photos.uploads.test.ts',
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
    privateSha256: 'a82ed56d908a27a0a00f4fa325c3d2d300fb551c453202af18732a8e88944031' },

  // T11:AddPanel 去照片 tab(模板块 + tab 定义 + usePhotosStore 声明/import +
  // .lib-photo-* 样式四处一并删除;409 行附近 ic-photos 注释改泛化措辞)
  { path: 'src/home/components/AddPanel.vue', from: 'AddPanel.vue',
    privateSha256: '948b9dcae47cef319b93342e551a4f1dd65e358c63174df525dd457f44d656fe' },

  // T12:README 重写(面向外部开发者,私有版讲的是与 Vue 2 并存/绞杀迁移/同级克隆
  // Service —— 受众不同且后两条在开源包里都是假的,没有可继承内容,整文件替换)
  { path: 'README.md', from: 'README.md',
    privateSha256: 'bc30420593910b48cc5750dc759d646bea8db62a24ff400d1763e106f243c155' },
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
    find: `// 文件区(/files,SP4-P8)、应用区(/apps,SP5-P8)、存储区(/storage,SP6-P1)、相册区
// (/photos,SP7-P8b)、系统设置(/settings)与 KVM(/kvm,两者 SP9-P8)、AI 区(/ai,SP8-P6)
// 已全部活在本应用;SP1-SP9 迁移至此收官。
// photos / ai / vm 这三条留在表里不是死键 —— cutover 回退时(flag 置 1)就跳它们,所以是"回退目标"
// 而不是"主路径";这也是它们与 appstore/storage/settings 的区别(那三个在 Vue2 侧是模态弹窗、
// 没有自己的路由,回退只能落 /#/legacy 老桌面 —— settings 因此也用 '/#/legacy' 作回退目标,
// 落到老桌面后再点「设置」磁贴,由 Vue2 侧的 resolveEntryTarget('/settings') 判定弹老模态)。
// router 模块环(router→Home→…→本文件)只在运行时访问 push,ESM 延迟绑定安全。
const SYS_ROUTE: Record<string, string> = {
  photos: '/#/photos', ai: '/#/ai/agent', vm: '/#/kvm',
  settings: '/#/legacy',
}`,
    replace: `// 系统入口全部活在本应用内。
// router 模块环(router→Home→…→本文件)只在运行时访问 push,ESM 延迟绑定安全。
const SYS_ROUTE: Record<string, string> = {
  vm: '/kvm', settings: '/settings',
}` },
  { path: 'src/home/composables/useOpenAction.ts',
    find: `// 回退 flag(与 Vue2 strangler.js 的 strangler:disabled:<from> 命名一致):
// == '1' 时磁贴退回 Vue2 老页面(见 SYS_ROUTE 各自的目标),可逆 cutover。
// /apps = SP5-P8;/storage = SP6-P6(Vue2 桌面那三个存储入口共用同一把键,
// 同源共享 localStorage,所以置一次即两侧同时回退);/photos = SP7-P8b(与 Vue2
// strangler.js 的 migratedRoutes 里那条 /photos 共用同一把键,同理置一次两侧同时回退);
// /kvm 与 /settings = SP9-P8,同理一把键管两侧(/kvm 在 Vue2 的 migratedRoutes、
// /settings 在 migratedEntries)。
// /ai = SP8-P6,同理一把键管两侧(Vue2 侧在 migratedRoutes)。
// ⚠️ 键名取的是**路由路径**,不是磁贴 key —— vm 磁贴对应的键是 '/kvm'。
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
    find: `      if (key === 'knowledge') { router.push('/ai/knowledge'); return }
      window.location.href = SYS_ROUTE[key] || '/#/legacy'
      return`,
    replace: `      router.push(SYS_ROUTE[key] || '/')
      return` },
  { path: 'src/home/composables/useOpenAction.ts',
    find: `    // 桌面照片磁贴:cutover 后进应用内时间线。刻意不带 asset —— Vue2 这里也只是跳
    // /#/photos、不定位到具体某张(桌面磁贴的 key 是渐变色字符串,不是资产 id),
    // 界面 1:1 就该保持"点进相册首页"。flag 置 1 时退回 Vue2 老相册。
    else if (it.kind === 'photo') {
      if (cutoverDisabled('/photos')) window.location.href = '/#/photos'
      else router.push('/photos')
    }
    // 桌面 AI 小组件:cutover 后进应用内 Agent 页。flag 置 1 时退回 Vue2 老 Agent。
    else if (it.kind === 'widget' && it.key === 'ai') {
      if (cutoverDisabled('/ai')) window.location.href = '/#/ai/agent'
      else router.push('/ai/agent')
    }
  }

  function sendToAI(text?: string) {
    const q = (text || '').trim()
    // cutover 后走应用内路由:query 用对象形式交给 vue-router 编码,不手工拼串
    // (AgentPage.vue 的 onMounted 读 route.query.message,一次性消费后 router.replace 抹掉)。
    // flag 置 1 时退回 Vue2,那边只认拼好的 hash URL,所以保留 encodeURIComponent。
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
    find: `/* search-btn: glass pill with magnifier icon — matches 搜索组件.dc.html topbar button */
.search-btn { padding-left: 13px; }
.search-btn .ic { width: 17px; height: 17px; }

`,
    replace: '' },
  // 复审 Important①:上面 3 条删掉了搜索胶囊与 ⌘K 监听,但这条中文注释原文
  // "...保留搜索与主题切换" 完全没被摘到 —— 会作为静默泄漏(oss/forbidden.mjs
  // 的中文词表目前没有"搜索")随包发布。词表本身的修补是另一个任务的活,这里
  // 只改措辞,不提搜索。
  { path: 'src/home/components/HomeTopbar.vue',
    find: '保留搜索与主题切换', replace: '保留主题切换' },
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
    find: '//   - data().tabs (L855-863) —— 侧栏 rail 的 7 项\n//   - visibleTabs (L1034)    —— 非 admin 过滤掉 folder-permissions\n',
    replace: '//   - data().tabs (L855-863) / visibleTabs (L1034) —— 侧栏 rail 项与按角色的可见性裁剪\n' },
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
    find: "/** Vue2 visibleTabs:只有 admin 能看到 folder-permissions。role 缺失按非 admin 处理。 */\nexport function railTabsFor(role: string | undefined): readonly SettingsTab[] {\n  if (role === 'admin') return RAIL_TABS\n  return RAIL_TABS.filter((t) => t !== 'folder-permissions')\n}",
    replace: "/** rail 上没有按角色隐藏的项,直接返回全集(保留函数形状以免调用处发散)。 */\nexport function railTabsFor(): readonly SettingsTab[] {\n  return RAIL_TABS\n}" },

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
  { path: 'src/apps/util/systemApp.ts',
    find: " *  compose 任一 service 的 label `nimoos.system == \"true\"` 即幕后组件(AI agent 运行时 /\n *  Photos ML 后端等),桌面 appgrid 已按此隐藏;应用管理页也须隐藏,不然会漏出用户没主动装的容器。",
    replace: " *  compose 任一 service 的 label `nimoos.system == \"true\"` 即幕后组件(供其他应用使用的\n *  内部服务容器),桌面 appgrid 已按此隐藏;应用管理页也须隐藏,不然会漏出用户没主动装的容器。" },
  { path: 'src/settings/util/appPaths.ts',
    find: '// The backend returns four keys -- app_data / images / database / photos_data\n// (verified 2026-08-09). Vue 2 rendered only the first three until #103 added the\n// photos cache row; all four are rendered here.',
    replace: '// The backend may return additional keys beyond the ones listed in ORDER below;\n// only the keys in ORDER are rendered.' },
  // -- The file-header summary line also says "four rows" in the private source
  //    (Task 3's real behavior) -- the open-source side reverts to three rows below,
  //    so this description must match what the reverted code actually derives.
  { path: 'src/settings/util/appPaths.ts',
    find: '// 设置 · 应用 —— 「App 数据存储位置」四行的派生。',
    replace: '// 设置 · 应用 —— 「App 数据存储位置」三行的派生。' },
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
    find: '        // 系统幕后容器(nimoos.system=true,如 AI agent / Photos ML)不给用户看——\n        // 与桌面 appgrid 一致(后端 isSystemComposeApp 同款规则)。',
    replace: '        // 系统幕后容器(nimoos.system=true,供其他应用使用的内部服务容器)不给用户看——\n        // 与桌面 appgrid 一致(后端 isSystemComposeApp 同款规则)。' },
  { path: 'src/settings/panels/AppsPanel.vue',
    find: '// 「清理本地待上传缓存」= 政策三「做样子」:界面 1:1、按钮禁用、标注待相册区迁移完成后启用。\n//    数据源是**相册**的 IndexedDB 上传队列(Vue2 @/views/Photos/upload/idb.js),SP7 尚未迁。',
    // I5-guard(⑤b)复核:原 replace 仍带 "政策三「做样子」"(内部分级术语,FORBIDDEN 清单
    // 里的"做样子"本就是冲它去的,REPLACE-only 时代未覆盖到 PATCH,漏检)。
    replace: '// 「清理本地待上传缓存」:界面 1:1、按钮禁用——该功能依赖的后端能力尚未提供。\n//    数据源是本地 IndexedDB 上传队列(与文件区上传队列是两套独立实现,见下一行)。' },
  { path: 'src/settings/panels/AppsPanel.vue',
    find: '// 三块:① 「App 数据存储位置」four rows (app_data / images / database / photos_data;\n//         from Task 2\'s buildAppPathRows, photos_data is the fourth row Task 3 added,\n//         matching Vue 2 #103)',
    replace: '// 三块:① 「App 数据存储位置」三行(app_data / images / database,来自 Task2 buildAppPathRows)' },
  { path: 'src/settings/panels/AppsPanel.vue',
    find: "  database: 'settingsAppsDatabase',\n  photos_data: 'settingsAppsPhotosData',\n}",
    replace: "  database: 'settingsAppsDatabase',\n}" },
  // -- Two more comments in this file say "four rows" in the private source; revert
  //    both to "three rows" so they match the reverted (three-row) code below.
  { path: 'src/settings/panels/AppsPanel.vue',
    find: '// ── 取数(App 数据存储位置四行) ──────────────────────────────────────────',
    replace: '// ── 取数(App 数据存储位置三行) ──────────────────────────────────────────' },
  { path: 'src/settings/panels/AppsPanel.vue',
    find: '// 评审 Important #3:取数在途时不能渲染四行 0 值——尤其是「用户数据库」那行,pathText()',
    replace: '// 评审 Important #3:取数在途时不能渲染三行 0 值——尤其是「用户数据库」那行,pathText()' },
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
    find: '\n# Claude Code 本地状态(隔离 worktree、会话配置),不入库\n.claude/\n# .superpowers/ **入库** —— 台账是各期唯一的决策记录。SP7 曾把整个目录弄丢且 git 救不回,\n# SP9-P7 又发现 P5/P6 的台账只活在 gitignore 里。规则见 .superpowers/.gitignore:\n# 台账(.md)与自查截图(.png)进库,评审 diff / 备份 / 快照环境这类机器产物不进。\n',
    replace: '' },
  { path: '.gitignore',
    find: '\n# 时间机器验收测试台(T12):假后端 + 专用 vite 配置,只在本机验收用,不进版本库\nscripts/tmlab/\nvite.config.tmlab.ts',
    replace: '\n# 导出报告(含上游 commit hash),仅供本地追溯\n.export-report.txt' },

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
    find: `// 静默失效。本期实测命中 4 个文件(ClusterActionDialog / PersonRelGraph / PersonPlacesTab /
// PhotosTrash),当时恰好是绿的(非假绿),但两个隐患都成立。
`,
    replace: `// 静默失效。当初实测命中 4 个组件文件,当时恰好是绿的(非假绿),但两个隐患都成立。
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
    find: `  /* 相册无封面渐变占位(PhotosAlbums.vue / PhotosAlbumDetail.vue 曾各写一份逐字相同的
     linear-gradient(135deg, color-mix(accent 35%, panel-bg), accent),提成本 token 消灭
     重复;两处均改用它,见 THEMING.md 例外清单外的普通语义 token 用法)。 */
  --album-cover-fallback: linear-gradient(135deg, color-mix(in srgb, var(--accent) 35%, var(--panel-bg)), var(--accent));
`,
    replace: '' },
  // --avatar-fallback(PersonAvatar 专用)
  { path: 'src/styles/theme.css',
    find: `  /* 人物头像三级兜底的渐变实底(PersonAvatar.vue,SP7-P5)。目标是贴近 Vue2 5 处重复的
     linear-gradient(135deg,#6E5BFF,#4A3BD1)/(135deg,#8950F2,#6c3bcd)(两套并存本身不一致,
     这里统一成一份 token)。用 --accent 混黑代替写死紫色,保持"颜色一律走 token"红线;
     对比度实算见 PersonAvatar.vue 顶部注释与任务报告。 */
  --avatar-fallback: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #000));
`,
    replace: '' },
  // --place-row-* 三色(PlacesRail)
  { path: 'src/styles/theme.css',
    find: `  /* PlacesRail.vue(P6a-T5)选中城市行三处——Vue2 photos-places.scss:153-156/:163-167
     的 rgba(var(--accent-rgb), 0.10/0.30/0.18) 精确复刻(该视图只有深色设计,数值级
     精度要求专用 token,不从 --accent-soft 三档就近凑,同 --drop-bg/--spark-fill/
     --orb-glow 的既有先例)。 */
  --place-row-bg: rgba(138, 180, 255, 0.10);
  --place-row-border: rgba(138, 180, 255, 0.30);
  --place-thumb-active: rgba(138, 180, 255, 0.18);
`,
    replace: '' },
  // --pin-* 六色 + --pin-cluster-stroke(PlacesMap 图钉)
  { path: 'src/styles/theme.css',
    find: `  /* PlacesMap.vue(P6a-T6)图钉——Vue2 photos-places.scss:366-411 的
     rgba(var(--accent-rgb), α) 精确复刻。--accent-rgb 在 Vue2 明确标注
     theme-invariant(恒为 110,91,255),即这些 alpha 层在深浅两套 app 主题下都不变——
     图钉铺的是地图预设自己的画布(4 套预设 + 自定义色,深浅与 app 主题无关,custom 模式
     恒为黑底),不能按 app 主题去降 alpha,否则「浅色 app 主题 + custom 黑底」会把图钉
     洗没。故两套主题块 alpha 完全相同,只有 RGB 跟随本仓 --accent-rgb 深浅两档。 */
  --pin-bg: rgba(138, 180, 255, 0.16);
  --pin-stroke: rgba(138, 180, 255, 0.55);
  --pin-active-bg: rgba(138, 180, 255, 0.30);
  --pin-pulse: rgba(138, 180, 255, 0.25);
  --pin-cluster-hover-bg: rgba(138, 180, 255, 0.42);
  --pin-glow: rgba(138, 180, 255, 0.7);
  /* Vue2 原值是比 accent 更浅的淡紫 rgba(196,184,255,0.85),让簇读作"一组"而非单点;
     这里 RGB 改取本仓 --accent-text(169,198,255)——语义正是"比 accent 更浅/更可读的
     accent 色",alpha 精确复刻原值 0.85。 */
  --pin-cluster-stroke: rgba(169, 198, 255, 0.85);
`,
    replace: '' },
  // --place-current-trip
  { path: 'src/styles/theme.css',
    find: `  /* Vue2 原值 #34c759(当前行程绿,图例第四组也用),两套主题下都用同一个值——不用
     本仓 --good(它是青绿 #5fe3b0/#15754c,与 iOS 绿不同,是近似不是精确复刻)。 */
  --place-current-trip: #34c759;
`,
    replace: '' },
  // --place-home-base(PlaceDetailPanel)
  { path: 'src/styles/theme.css',
    find: `  /* PlaceDetailPanel.vue(P6b-T3)「常驻地」标记色——新增 token,精确复刻 Vue2
     photos-places.scss 内联 \`style="color:#c4b8ff"\`(:1078)。偏离登记(brief 字面要求
     两套主题给不同值,深色浅紫、浅色改深色向,同 --accent-text 的做法):这里改成
     **两套主题同值**,不跟随 app 主题深浅——它与紧邻的 --place-current-trip 用在完全
     相同的语境(.ttl-region 内,叠在 hero 暗化封面照片之上,该遮罩本身钉死恒为深色,
     与 app 是深色皮肤还是纸感皮肤无关),若照字面给浅色主题一个深紫版本,会在浅色 app
     主题下把深紫字压在恒暗的照片渐变上,直接违反本任务"hero 前景色红线"的对比度要求。
     不用 --accent-text 就近凑:那是"比 accent 更浅更可读"的语义(蓝色调),这里要与
     「本次旅行」并列的第二个状态色(紫色调),同 --pin-cluster-stroke 换基色不换语义的
     既有先例,但这里连 alpha/精确色值都直接照抄 Vue2 字面量(theme-invariant,同
     --place-current-trip 的既有先例)。 */
  --place-home-base: #c4b8ff;
`,
    replace: '' },
  // --map-dot-bg-fallback(PlacesMap 陆地点阵)
  { path: 'src/styles/theme.css',
    find: `  /* PlacesMap.vue(P6a-T6)陆地点阵底色的 CSS 回落值——theme-invariant,两套主题块同值。
     精确复刻 Vue2 photos-places.scss:347 的字面量 rgba(255,255,255,0.10)(该视图刻意不走
     --ink/文字色系,因为这层压在地图预设自己的深色画布上,与 app 主题无关)。
     不能用本仓 --fg-faint 顶替:深色 --fg-faint 是 rgba(255,255,255,0.52)(0.52 vs 0.10,
     陆地点阵会亮到盖过 --map-dot 的已访问点),浅色 --fg-faint 更是不透明的暖灰 #9a958a
     (铺在 custom 模式的纯黑地图画布上会变成一块不透明灰块)——评审 I1 实测复核过这条
     失效路径确实可达(Vue2 :150/:137 两条最常见路径的 dotBg 都是 null,即都吃 CSS 回落,
     不是罕见分支)。 */
  --map-dot-bg-fallback: rgba(255, 255, 255, 0.10);
`,
    replace: '' },
  // --float-bg(PlacesZoomBar 浮动药丸底)
  { path: 'src/styles/theme.css',
    find: `  /* PlacesZoomBar.vue(P6a-T8)垂直缩放滑杆的浮动药丸底——新增 token,精确复刻 Vue2
     photos.scss:49(NimoOS-UI 全局浮动条/FAB 共用底,不是 photos-places.scss 自己定义的)。
     本仓之前没有等价的"半透明浮动工具条底"token,--panel-bg(0.1)/--popup-bg(渐变,
     ~0.9-0.95)/--tool-bg(0.16,不透明纯色)都对不上这个扁平 0.85 的量级,故新增而非近似。 */
  --float-bg: rgba(20, 20, 28, 0.85);
`,
    replace: '' },
  // --zb-hover-bg / --zb-track-bg
  { path: 'src/styles/theme.css',
    find: `  /* 同上组件——Vue2 用 rgba(var(--ink), 0.08/0.12) 给 .zb-btn:hover 背景与 .zb-track 底色
     做"跟随文字色的透明度斜坡";本仓没有 --ink 这个 RGB 三元组 token。alpha 精确复刻
     Vue2 的 0.08/0.12,RGB 改取本仓 --fg 的真实分解值(dark #ffffff→255,255,255)——不照抄
     Vue2 light 主题里 --ink 的 (35,37,43)(该值本身只是 Vue2 注释自称的"AI --text-primary
     近似",不是设计精确值),同 --pin-cluster-stroke 的换基色先例。 */
  --zb-hover-bg: rgba(255, 255, 255, 0.08);
  --zb-track-bg: rgba(255, 255, 255, 0.12);
`,
    replace: '' },
  // --zb-thumb-shadow
  { path: 'src/styles/theme.css',
    find: `  /* .zb-thumb 把手投影第二层——Vue2 photos-places.scss:281 的 box-shadow 里
     \`0 1px 4px rgba(0,0,0,0.4)\` 从未随 Vue2 自己的深浅主题变化,theme-invariant,
     两套主题块同值(先例见 --place-current-trip)。 */
  --zb-thumb-shadow: rgba(0, 0, 0, 0.4);
`,
    replace: '' },
  // --warn-*(人脸识别关闭 / Photos AI 离线两条横幅)
  { path: 'src/styles/theme.css',
    find: `  /* 警告/降级语义(SP7-P5:人脸识别关闭、Photos AI 后端离线两条横幅)。对齐 Vue2 的
     #FF9F0A 系;深色主题直接取原值,浅色主题按本仓 --dem-* 的既有做法压暗前景保证对比度。 */
  --warn-fg: #ff9f0a;
  --warn-bg: rgba(255, 159, 10, 0.08);
  --warn-border: rgba(255, 159, 10, 0.32);
`,
    replace: '' },
  // --badge-photo/video/ocr(搜索结果媒体类别徽标)
  { path: 'src/styles/theme.css',
    find: `  /* SP7-P7a-T15:搜索结果卡片左上角媒体类别徽标(.type-badge[data-type])三色——
     数据可视化类别色（THEMING.md §0 第三类例外的变体：同一批结果里要把"照片/视频/
     OCR 命中"这三种互不相同的类别互相区分开，颜色语义是"第几类"而非"主题强调色"）。
     精确复刻 Vue2 photos.scss:2768-2770 的字面量,两套主题块同值——不随皮肤深浅走,
     同 --place-current-trip/--console-bg 的既有先例(同类先例见 THEMING.md §6)。
     不用 --accent/--danger 就近凑:它们是三个并列的类别标识,不是"强调"或"危险"语义。 */
  --badge-photo: rgba(50, 190, 230, 0.9);   /* 青 cyan */
  --badge-video: rgba(255, 149, 10, 0.92);  /* 橙 orange */
  --badge-ocr: rgba(16, 185, 129, 0.92);    /* 翠绿 emerald */
`,
    replace: '' },
  // --photos-seg-*(设置页容量条分段色)
  { path: 'src/styles/theme.css',
    find: `  /* SP7-P8a-T3:设置页存储卡容量条分段色(PhotosStorageCard.vue,消费于
     src/photos/util/storagePalette.ts 的 STORAGE_SEG_COLORS)——同上一组一样是**数据可视化
     类别色**:同一条容量条上要把 videos/raw/ai/other 四个互不相同的数据段互相区分开,
     颜色语义是"第几类数据"而不是"主题强调色"。photos 段用 --accent、thumbs 段用 --success
     (既有语义 token 直接复用,不新增),这四个是 Vue2 内联的、本仓无对应语义 token 的字面量,
     故新增。深色精确复刻 Vue2 PhotosSettings.vue:320/321/323 的字面量;浅色不能照抄深色值——
     videos 的中蓝、raw 的浅粉柔和色铺在本主题纯白 --card-bg 上会偏灰、分段边界糊掉,故各自
     加深/提高饱和度保持在白底上可辨识(同 --warn-fg 浅色把 #FF9F0A 压成 #96610a 保对比度的
     既定手法,但这里是三个并列的类别色而非单一警告语义,故各给独立值而非借用 --warn-fg)。 */
  --photos-seg-video: #5e94ff;
  --photos-seg-raw: #ff9ac2;
  --photos-seg-ai: #ff9f0a;
  /* other 段 Vue2 原值是 rgba(var(--ink),0.25)("跟随文字色的透明度斜坡"),本仓无 --ink
     三元组 token——同 --zb-hover-bg/--zb-track-bg 的既定换基先例:alpha 精确复刻 0.25,
     RGB 改取本仓 --fg 的真实分解值(dark #ffffff→255,255,255)。 */
  --photos-seg-other: rgba(255, 255, 255, 0.25);
`,
    replace: '' },
  // light:--album-cover-fallback
  { path: 'src/styles/theme.css',
    find: `  /* 相册无封面渐变占位(见 :root 同名 token 注释),白色纸感主题下取值同一份公式,
     --accent/--panel-bg 各自已按本主题定义,结果自然是本主题配色。 */
  --album-cover-fallback: linear-gradient(135deg, color-mix(in srgb, var(--accent) 35%, var(--panel-bg)), var(--accent));
`,
    replace: '' },
  // light:--avatar-fallback
  { path: 'src/styles/theme.css',
    find: `  /* 见 :root 同名 token 注释;白色纸感主题下 accent 更深,mix 百分比调到 70% 才不至于
     整块糊成近黑(对比度实算见 PersonAvatar.vue / 任务报告)。 */
  --avatar-fallback: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #000));
`,
    replace: '' },
  // light:--place-row-*
  { path: 'src/styles/theme.css',
    find: `  /* Vue2 该视图仅有深色设计,浅色值没有原件可照——按 accent 家族深→浅收敛惯例推导
     (.14→.11、.24→.20、.36→.30,约 ×0.83):.10→.08、.30→.25、.18→.15。 */
  --place-row-bg: rgba(59, 91, 219, 0.08);
  --place-row-border: rgba(59, 91, 219, 0.25);
  --place-thumb-active: rgba(59, 91, 219, 0.15);
`,
    replace: '' },
  // light:--pin-*
  { path: 'src/styles/theme.css',
    find: `  /* PlacesMap.vue(P6a-T6)图钉——见 :root 同名 token 注释:alpha 与 :root 完全相同
     (theme-invariant,铺在地图预设自己的画布上,不随 app 主题降 alpha),RGB 换成本仓
     浅色 --accent-rgb(59,91,219)。 */
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
    find: `  /* RGB 取本仓浅色 --accent-text(53,80,196),alpha 精确复刻 Vue2 原值 0.85(见 :root 同名注释)。 */
  --pin-cluster-stroke: rgba(53, 80, 196, 0.85);
`,
    replace: '' },
  // light:--place-current-trip
  { path: 'src/styles/theme.css',
    find: `  /* 两套主题同值,见 :root 同名注释。 */
  --place-current-trip: #34c759;
`,
    replace: '' },
  // light:--place-home-base
  { path: 'src/styles/theme.css',
    find: `  /* 两套主题同值,见 :root 同名注释(偏离登记:未按字面要求给浅色主题一个深紫版本,
     理由同 :root 块的完整登记——它与 --place-current-trip 语境完全相同,恒叠在
     hero 的固定暗化渐变之上,与 app 是深色还是纸感皮肤无关)。 */
  --place-home-base: #c4b8ff;
`,
    replace: '' },
  // light:--map-dot-bg-fallback
  { path: 'src/styles/theme.css',
    find: `  /* theme-invariant,两套主题块同值——见 :root 同名 token 注释(不用 --fg-faint 的理由同上,
     浅色 --fg-faint 是不透明暖灰 #9a958a,同样会在地图画布上变成一块不透明色块)。 */
  --map-dot-bg-fallback: rgba(255, 255, 255, 0.10);
`,
    replace: '' },
  // light:--float-bg
  { path: 'src/styles/theme.css',
    find: `  /* PlacesZoomBar.vue(P6a-T8)——见 :root 同名 token 注释。精确复刻 Vue2 photos.scss:84
     的浅色浮动条底字面量。 */
  --float-bg: rgba(255, 255, 255, 0.85);
`,
    replace: '' },
  // light:--zb-hover-bg / --zb-track-bg
  { path: 'src/styles/theme.css',
    find: `  /* 见 :root 同名 token 注释:alpha 与 :root 完全相同(0.08/0.12),RGB 换成本仓浅色
     --fg 的真实分解值(#1c1b19→28,27,25)。 */
  --zb-hover-bg: rgba(28, 27, 25, 0.08);
  --zb-track-bg: rgba(28, 27, 25, 0.12);
`,
    replace: '' },
  // light:--zb-thumb-shadow
  { path: 'src/styles/theme.css',
    find: `  /* 两套主题同值,见 :root 同名注释。 */
  --zb-thumb-shadow: rgba(0, 0, 0, 0.4);
`,
    replace: '' },
  // light:--warn-*
  { path: 'src/styles/theme.css',
    find: `  /* 警告/降级语义(见 :root 同名注释)。#FF9F0A 直接铺在纸感白底上只有 ~1.9:1,
     故前景压到深琥珀(同 --dem-fg 的 #92600c 一档),底/描边给纸感主题的实色。 */
  --warn-fg: #96610a;
  --warn-bg: #fdf3e2;
  --warn-border: #f0d7a6;
`,
    replace: '' },
  // light:--badge-*
  { path: 'src/styles/theme.css',
    find: `  /* SP7-P7a-T15:同 :root 同名注释——三个媒体类别徽标色,两套主题块同值,不随皮肤翻转。 */
  --badge-photo: rgba(50, 190, 230, 0.9);
  --badge-video: rgba(255, 149, 10, 0.92);
  --badge-ocr: rgba(16, 185, 129, 0.92);
`,
    replace: '' },
  // light:--photos-seg-*
  { path: 'src/styles/theme.css',
    find: `  /* SP7-P8a-T3:同 :root 同名注释——存储卡容量条分段色。浅色主题按可读性微调(不是照抄
     Vue2 唯一深色设计的原值):
     --photos-seg-video 从 Vue2 的中蓝 #5e94ff 加深到 #3560d8——纸感白底 --card-bg(#ffffff)
     上原值发灰、和相邻分段边界不够清楚,加深/提高饱和度后仍是同一色相的蓝。
     --photos-seg-raw 从 Vue2 的浅粉 #ff9ac2 加深到 #c93f79——浅粉铺在纯白底上几乎融进背景,
     压深成同色相的玫红以保证分段轮廓可辨。
     --photos-seg-ai 从 Vue2 的橙 #ff9f0a 压到 #a15f0a——同 --warn-fg 浅色档处理同一个字面量
     色值的既定手法(压暗保对比度),但这里是独立的类别标识 token,不直接借用 --warn-fg
     (那是"警告"语义,这里是"第几类数据"语义,同一个字面量色值、两个不同的 token)。 */
  --photos-seg-video: #3560d8;
  --photos-seg-raw: #c93f79;
  --photos-seg-ai: #a15f0a;
  /* alpha 与 :root 同为 0.25(精确复刻 Vue2 other 段 rgba(var(--ink),0.25)),RGB 换成本仓
     浅色 --fg 的真实分解值(#1c1b19→28,27,25)——同 --zb-hover-bg/--zb-track-bg 浅色档的既定
     换基公式。 */
  --photos-seg-other: rgba(28, 27, 25, 0.25);
`,
    replace: '' },

  // ── src/router/index.ts:13 个相册视图 import + 14 条 /photos* 路由 ────────────
  //    两段各自连续,整块摘。DELETE 表已删掉那 13 个 .vue 文件,不摘 import 的话开源侧
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
  { path: '/photos/search', name: 'photos-search', component: PhotosSearch },
  // SP7-P8a-T5:只追加,不重排——须排在最后一条既有 /photos/* 之后(router/index.test.ts
  // 用 node:fs 读源文本行序断言,而非 router.getRoutes(),见该测试文件注释)。
  { path: '/photos/settings', name: 'photos-settings', component: PhotosSettings },
`,
    replace: '' },

  // ── src/components/AppToast.zIndex.test.ts:去相册两处点名 ──────────────────
  //    这道闸是**全仓约定守卫**(toast 必须高于所有模态遮罩),开源版要保留 —— 它 glob 全仓
  //    样式块、相册文件删掉后自然不再被扫到。要摘的只有两处点名:①文件头注释里举例的三条
  //    相册失败路径与 .pd-scrim/.cad-overlay ②末尾单独钉那两个相册遮罩的 it.each 块
  //    (整块删:它只有相册两条,前面那条 glob 全量断言仍在)。
  { path: 'src/components/AppToast.zIndex.test.ts',
    find: `// 为什么需要一条测试:遮罩都带 backdrop-filter,压在遮罩下方的 toast 不是"偏灰"而是
// **完全读不到**。本期评审抓到的真实后果 —— 三条「失败了但刻意保留弹窗让用户重试」的路径
// (人物改名失败 / 建相册失败 / 命名未命名人物失败)全部把失败原因藏在 z-index 220 的
// .pd-scrim / .cad-overlay 底下,用户只看到按钮"没反应",反复重试。
`,
    replace: `// 为什么需要一条测试:遮罩都带 backdrop-filter,压在遮罩下方的 toast 不是"偏灰"而是
// **完全读不到**——用户只看到按钮"没反应",反复重试。
` },
  { path: 'src/components/AppToast.zIndex.test.ts',
    find: `  // 本期评审命中的三条路径的两个具体遮罩,单独钉一遍(上一条即使被人放宽也还有这道)。
  it.each([
    ['src/views/PhotosPersonDetail.vue', '.pd-scrim'],
    ['src/photos/components/ClusterActionDialog.vue', '.cad-overlay'],
  ])('%s 的 %s 低于 toast', (rel, selector) => {
    const src = Object.entries(files).find(([p]) => relOf(p) === rel)?.[1]
    expect(src, \`\${rel} 未被 glob 收到\`).toBeTruthy()
    const css = styleText(rel, src as string)
    // 取该选择器所在规则块里的 z-index。
    const block = new RegExp(\`\\\\\${selector}\\\\s*\\\\{([^}]*)\\\\}\`).exec(css)
    expect(block, \`\${rel} 里找不到 \${selector} 规则块\`).toBeTruthy()
    const z = zIndexes((block as RegExpExecArray)[1])
    expect(z.length, \`\${selector} 规则块里没有 z-index\`).toBe(1)
    expect(z[0]).toBeLessThan(toastZ)
  })
`,
    replace: '' },

  // ── src/router/index.test.ts:相册路由的 14 条断言整块删除 ──────────────────
  //    本文件除开头两条 /files 用例外全是相册路由(命中 + "只追加不重排"顺序断言)。
  //    连带摘掉 `./index.ts?raw` 那个 import 与它上面的说明注释 —— 原文只被顺序断言用到,
  //    留着会是未使用变量(开源侧 vue-tsc 直接红)。
  { path: 'src/router/index.test.ts',
    find: `// 评审 M5:原来这里的注释声称"完整的顺序/未重排断言见 PhotosPlaces.test.ts",但那份文件
// 只用 \`?raw\` 取 PhotosPlaces.vue 自己的样式块做 pointer-events 断言,从未读过 router/index.ts
// 的源文本——那句话是不实的。真正的顺序/未重排断言就近放在这里,用 \`?raw\` 读原始文本核对。
import routerIndexRaw from './index.ts?raw'
`,
    replace: '' },
  { path: 'src/router/index.test.ts',
    find: `  it('/photos/favorites 命中 photos-favorites 路由', () => {
    const m = router.resolve('/photos/favorites')
    expect(m.name).toBe('photos-favorites')
  })
  it('/photos/trash 命中 photos-trash 路由', () => {
    const m = router.resolve('/photos/trash')
    expect(m.name).toBe('photos-trash')
  })
  it('/photos/albums 命中 photos-albums 路由', () => {
    const m = router.resolve('/photos/albums')
    expect(m.name).toBe('photos-albums')
  })
  it('/photos/albums/7 命中 photos-album-detail 路由,params.id 为字符串 "7"', () => {
    const m = router.resolve('/photos/albums/7')
    expect(m.name).toBe('photos-album-detail')
    expect(m.params.id).toBe('7')
  })
  it('/photos/people 命中 photos-people 路由', () => {
    const m = router.resolve('/photos/people')
    expect(m.name).toBe('photos-people')
  })
  it('/photos/people/7 命中 photos-person-detail 路由,params.id 为字符串 "7"', () => {
    const m = router.resolve('/photos/people/7')
    expect(m.name).toBe('photos-person-detail')
    expect(m.params.id).toBe('7')
  })
  it('/photos/places 命中 photos-places 路由', () => {
    const m = router.resolve('/photos/places')
    expect(m.name).toBe('photos-places')
  })

  // P6a-T11:只追加,不重排——新路由必须夹在 /photos/people/:id 与 /login 之间,且两者
  // 本身的相对顺序不能被打乱(评审 M5:之前这条断言只存在于一句不实的注释里,这里补真的)。
  it('/photos/places 追加在 /photos/people/:id 之后、/login 之前(只追加,不重排)', () => {
    const peopleDetailIdx = routerIndexRaw.indexOf(\`{ path: '/photos/people/:id'\`)
    const placesIdx = routerIndexRaw.indexOf(\`{ path: '/photos/places'\`)
    const loginIdx = routerIndexRaw.indexOf(\`{ path: '/login'\`)
    expect(peopleDetailIdx).toBeGreaterThan(-1)
    expect(placesIdx).toBeGreaterThan(peopleDetailIdx)
    expect(loginIdx).toBeGreaterThan(placesIdx)
  })

  // SP7-P7a-T4:/photos/smart-views 命中真实注册的路由(用产线单例 router.resolve 真解析,
  // 不是 spy push——同上面每一条既有路由断言的既定写法)。
  it('/photos/smart-views 命中 photos-smart-views 路由', () => {
    const m = router.resolve('/photos/smart-views')
    expect(m.name).toBe('photos-smart-views')
  })

  // 只追加,不重排——新路由必须夹在 /photos/places/:key 与 /login 之间,且两者本身的
  // 相对顺序不能被打乱(同上 P6a-T11 的既有手法,行序比较而非 getRoutes() 下标——vue-router 4
  // 会把动态段路由排到静态之前,P6b-T9 实测过,下标比较会得出错误结论)。
  it('/photos/smart-views 追加在 /photos/places/:key 之后、/login 之前(只追加,不重排)', () => {
    const placesKeyIdx = routerIndexRaw.indexOf(\`{ path: '/photos/places/:key'\`)
    const smartViewsIdx = routerIndexRaw.indexOf(\`{ path: '/photos/smart-views'\`)
    const loginIdx = routerIndexRaw.indexOf(\`{ path: '/login'\`)
    expect(placesKeyIdx).toBeGreaterThan(-1)
    expect(smartViewsIdx).toBeGreaterThan(placesKeyIdx)
    expect(loginIdx).toBeGreaterThan(smartViewsIdx)
  })

  // SP7-P7a-T6:/photos/smart-views/:id 详情路由,同上既定手法(行序比较 + 真 resolve)。
  it('/photos/smart-views/7 命中 photos-smart-view-detail 路由,params.id 为字符串 "7"', () => {
    const m = router.resolve('/photos/smart-views/7')
    expect(m.name).toBe('photos-smart-view-detail')
    expect(m.params.id).toBe('7')
  })

  it('/photos/smart-views/:id 追加在 /photos/smart-views 之后、/login 之前(只追加,不重排)', () => {
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
    find: `/* P6a-T4:地点域键的完整性与术语守卫。 */
describe('photosPlaces 键(SP7-P6a)', () => {
  it('六个大洲键齐备,且 regionLabelKey 的返回值全部有译文', async () => {
    const { regionLabelKey } = await import('../photos/util/placesMap')
    for (const id of ['asia', 'americas', 'europe', 'africa', 'oceania', 'antarctica']) {
      const k = regionLabelKey(id)!
      expect(zh).toHaveProperty(k)
      expect(en).toHaveProperty(k)
    }
  })

  it('中文文案不含工程词「簇」「聚类」「气泡」', () => {
    const bad = Object.entries(zh)
      .filter(([k]) => k.startsWith('photosPlaces'))
      .filter(([, v]) => typeof v === 'string' && /簇|聚类|气泡/.test(v))
    expect(bad).toEqual([])
  })

  /* P6b-T1:地点详情面板键的完整性与插值槽守卫。 */
  it('P6b 地点键在两个 locale 都存在且无空值', () => {
    const keys = ['photosPlacesHomeBase', 'photosPlacesSpotResetName', 'photosPlacesCoverPageInfo',
      'photosPlacesInsightHome', 'photosPlacesInsightHomeBase', 'photosPlacesVisitHistory']
    for (const k of keys) {
      expect(String((zh as Record<string, unknown>)[k] ?? '')).not.toBe('')
      expect(String((en as Record<string, unknown>)[k] ?? '')).not.toBe('')
    }
  })
  it('insight 键的插值占位符两个 locale 完全一致(漏一个槽 <i18n-t> 会静默丢内容)', () => {
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
    find: `// SP7-P8b:本文件从"一整份文案表"改成几行的**合并出口**,真正的内容拆成几块:
//   zh_cn.base.ts   —— 全区共用 + 各区自己的文案
//   zh_cn.photos.ts —— 相册区那 702 个 photos* 键
//   zh_cn.ai.ts     —— AI 区那 1207 个 ai* 键(SP8-P6 合流时加入)
//
// 为什么拆:开源版没有相册区、也没有 AI 区,\`oss/manifest.mjs\` 要把这两块文案剥掉。
// 原先那些键散在主文件 90 多个区段里,剥它们意味着上百条锚点补丁 × 2 语言 —— 而 PATCH
// 要求锚点命中恰好 1 次,以后**改任何一条相册/AI 文案都会把开源导出打红**。拆开之后
// 开源侧只需:删掉 zh_cn.photos.ts / zh_cn.ai.ts 两个文件 + 把下面那两行展开补丁掉。
//
// 为什么保留本文件作为出口(而不是让消费方各自 import 几块):全仓有 40+ 个测试
// \`import zh from '…/i18n/zh_cn'\` 自建 createI18n,把它们逐个改成"再多 import 一块"既吵
// 又会在下次分片时重演。出口不动,消费方就一行都不用改。
//
// 注意:SP9 那一片(zh_cn.sp9.ts)**不在本出口里** —— 它在 i18n/index.ts 与
// parity.test.ts 里各自单独并进来,与这里的 base/photos/ai 是两套装配路径。
`,
    //    ⚠️ 措辞受 tree.test.mjs「PATCH 的 replace 内容也不含固定清单里的词」那道守卫约束:
    //    期号只允许以**文件名**形式出现(正则 /\bSP\d(?!\.ts)/i 的 (?!\.ts) 豁免),所以
    //    下面写 "zh_cn.sp9.ts 那一片" 而不是 "sp9 那一片"。第一版写成后者被守卫逮到。
    replace: `// 中文文案(默认 / fallback locale)。
//
// 注意:zh_cn.sp9.ts 那一片**不在本出口里** —— 它在 i18n/index.ts 与
// parity.test.ts 里各自单独并进来,与这里的 base 是两套装配路径。
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
    find: "/* ---- P4c: 应用 / 文件夹 / 照片 磁贴结构 ---- */\n",
    replace: "/* ---- P4c: 应用 / 文件夹 磁贴结构 ---- */\n" },
  // :root 说话人配色注释 + --spk-1..5(锚点跨过 --wave-none,见下条单独删 --wave-dim)
  { path: 'src/styles/theme.css',
    find: "  /* 说话人配色(音频转录/波形,最多 5 色循环;dark 用亮版;避开金色以免与星标混淆) */\n  --spk-1: oklch(0.74 0.13 250);   /* 蓝 */\n  --spk-2: oklch(0.72 0.13 305);   /* 紫 */\n  --spk-3: oklch(0.77 0.12 190);   /* 青 */\n  --spk-4: oklch(0.73 0.15 18);    /* 珊瑚 */\n  --spk-5: oklch(0.79 0.14 150);   /* 绿 */\n",
    replace: "" },
  // :root --wave-dim(--wave-none 保留,两者不连续,分开删)
  { path: 'src/styles/theme.css',
    find: "  --wave-dim: var(--fg-faint);     /* 波形:过滤时被弱化的竖条 */\n",
    replace: "" },
  // light 主题同一批 --spk-1..5
  { path: 'src/styles/theme.css',
    find: "  /* 说话人配色(白色纸感用暗版,同 hue 系) */\n  --spk-1: oklch(0.52 0.15 255);\n  --spk-2: oklch(0.50 0.16 305);\n  --spk-3: oklch(0.53 0.12 200);\n  --spk-4: oklch(0.55 0.18 22);\n  --spk-5: oklch(0.52 0.15 150);\n",
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
    find: "/* 照片磁贴 */\n.kind-photo { padding: 0; }\n.photo-thumb { display: block; width: 100%; height: 100%; border-radius: var(--radius, 28px); border: 1px solid var(--card-border); box-shadow: var(--icon-shadow); }\n",
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
    find: `  it('回退 flag strangler:disabled:/settings==1 时 settings 退回 /#/legacy 老桌面', () => {
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
    find: `  it('回退 flag strangler:disabled:/kvm==1 时 vm 退回 Vue2 全页 /#/kvm(不是 /#/legacy)', () => {
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
    find: `  it('五把 flag 逐条独立:只关 /kvm,settings/storage/appstore/photos 都照走应用内路由', () => {
    localStorage.setItem('strangler:disabled:/kvm', '1')
    const { openApp } = useOpenAction()
    openApp('settings'); expect(router.push).toHaveBeenCalledWith('/settings')
    openApp('storage'); expect(router.push).toHaveBeenCalledWith('/storage')
    openApp('appstore'); expect(router.push).toHaveBeenCalledWith('/apps/store')
    openApp('photos'); expect(router.push).toHaveBeenCalledWith('/photos')
    expect(hrefs.length).toBe(0)
    localStorage.removeItem('strangler:disabled:/kvm')
  })
  it('只关 /settings 时 vm 仍走应用内 /kvm(反向隔离)', () => {
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
    find: `  it('回退 flag strangler:disabled:/apps==1 时 appstore 退回 /#/legacy', () => {
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
    find: `  it('回退 flag strangler:disabled:/storage==1 时 storage 退回 /#/legacy', () => {
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
    find: `  it('photo 磁贴应用内 push /photos(SP7-P8b cutover)', () => {
    const { openItem } = useOpenAction()
    openItem({ id: 'i', kind: 'photo', key: 'abc', c: 1, r: 1, w: 2, h: 2 } as LayoutItem)
    expect(router.push).toHaveBeenCalledWith('/photos')
    expect(hrefs.length).toBe(0)
  })
  it('photo 磁贴:回退 flag 置 1 时退回 Vue2 /#/photos', () => {
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
    find: `  it('photos 磁贴应用内 router.push /photos(SP7-P8b cutover)', () => {
    const { openApp } = useOpenAction()
    openApp('photos')
    expect(router.push).toHaveBeenCalledWith('/photos')
    expect(hrefs.length).toBe(0)
  })
  it('回退 flag strangler:disabled:/photos==1 时 photos 退回 Vue2 /#/photos(不是 /#/legacy)', () => {
    localStorage.setItem('strangler:disabled:/photos', '1')
    const { openApp } = useOpenAction()
    openApp('photos')
    expect(hrefs[0]).toBe('/#/photos')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/photos')
  })
  it('photos 那把 flag 不影响 storage / appstore', () => {
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
    find: `// SP9-P8:Home 挂的 SearchDialog 用 useRoute()/useRouter() 消费深链 ?q=,
// 所以挂载必须带 router 插件(最小 memory 路由表,不引真实 src/router)。
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
    find: `    // SP9-P8:Home 挂的 SearchDialog 用 useRoute()/useRouter(),挂载必须带 router 插件。
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
    // 顺序:files(r1) → photo(r2) → folder(r3)
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
    // 顺序:files(r1) → folder(r3)
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

  it('非 admin 看不到 folder-permissions(Vue2 visibleTabs L1034)', () => {
    expect(railTabsFor('user')).not.toContain('folder-permissions')
    expect(railTabsFor('user')).toHaveLength(7)
  })

  it('role 缺失按非 admin 处理(保守:不泄漏管理项)', () => {
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
    find: `  // P4 起 folder-permissions 与 account 也填了真实内容
  // (见 FolderPermissionsPanel.test.ts / AccountPanel.test.ts)——**至此 9 个 tab 全部实现完毕,
  // 骨架抽查已经没有对象了**(原来那条 it.each 与「骨架的文案 key 都有译文」两条随之收口)。`,
    replace: `  // account 也填了真实内容(见 AccountPanel.test.ts)——**至此所有 tab 全部实现完毕,
  // 骨架抽查已经没有对象了**(原来那条 it.each 与「骨架的文案 key 都有译文」两条随之收口)。` },
  // -- Important (review round 2): this file asserts against the live AppsPanel, whose
  //    ORDER got reverted to three rows above -- if this test file keeps asserting 4,
  //    the open-source repo would ship a test that is guaranteed to fail. Revert the
  //    row count and the two "four rows" wordings in the surrounding comments/title so
  //    the description matches what the reverted component actually renders.
  { path: 'src/settings/panels/panels.test.ts',
    find: '  // Task 9 起 apps 也填了真实内容(数据位置四行 + Docker 缓存清理 + 待上传缓存做样子,见',
    // 跟上面 P4 那条同一处理:丢掉 "TaskN 起" 这个内部期号前缀,句子从主语直接起;顺手把
    // "做样子"(FORBIDDEN 词表内部分级术语)也换掉——两个词此前从未入过 PATCH 的 replace,
    // 一直未受检地随 find/replace 同步演进,这次为了改行数措辞把这句纳入 PATCH,一起洗白。
    replace: '  // apps 也填了真实内容(数据位置三行 + Docker 缓存清理 + 待上传缓存占位,见' },
  { path: 'src/settings/panels/panels.test.ts',
    find: '  // 的静态标记:四行数据位置骨架恒定渲染(取数是否落定不影响行数,同 storage 的既有先例)。',
    replace: '  // 的静态标记:三行数据位置骨架恒定渲染(取数是否落定不影响行数,同 storage 的既有先例)。' },
  { path: 'src/settings/panels/panels.test.ts',
    find: `  it('apps has real content (four data-location rows + Docker cleanup + upload-cache placeholder), no longer a bare skeleton', async () => {
    setActivePinia(createPinia())
    const w = mount(PANEL_BY_TAB.apps, { global: { plugins: [i18n] } })
    // 评审 Important #3 新增了真实加载态:两个接口都落定前先渲染 .set-skeleton(不是
    // 遗漏,是避免落定前露四行 0 值假读数),这里先钉住"确实经过了加载态"。
    expect(w.find('.set-skeleton').exists()).toBe(true)
    await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(false)
    expect(w.findAll('.set-app-row')).toHaveLength(4)`,
    replace: `  it('apps has real content (three data-location rows + Docker cleanup + upload-cache placeholder), no longer a bare skeleton', async () => {
    setActivePinia(createPinia())
    const w = mount(PANEL_BY_TAB.apps, { global: { plugins: [i18n] } })
    // 评审 Important #3 新增了真实加载态:两个接口都落定前先渲染 .set-skeleton(不是
    // 遗漏,是避免落定前露三行 0 值假读数),这里先钉住"确实经过了加载态"。
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
    replace: `  it('渲染三行数据位置 —— 后端给了 4 个 key(含未知的第 4 个 key),界面 1:1 只显示 3 行', async () => {
    const w = mountPanel()
    await flushPromises()
    const rows = w.findAll('.set-app-row')
    expect(rows).toHaveLength(3)
    expect(rows[0].text()).toContain('App 数据')
    expect(rows[1].text()).toContain('App 镜像集')
    expect(rows[2].text()).toContain('用户数据库')
  })` },
  { path: 'src/settings/panels/AppsPanel.test.ts',
    find: '  it(\'清理本地待上传缓存行:UI 在、按钮禁用、带待相册区迁移的标注(政策三"做样子")\', async () => {',
    // I5-guard(⑤b)复核:原标题仍带 "政策三"做样子""(REPLACE-only 时代未覆盖到 PATCH,漏检)。
    replace: '  it(\'清理本地待上传缓存行:UI 在、按钮禁用、带禁用态标注\', async () => {' },
  { path: 'src/settings/panels/AppsPanel.test.ts',
    find: "    expect(w.text()).toContain('待相册区迁移完成后启用')\n",
    replace: "    expect(w.text()).toContain('该功能所需的后端能力尚未提供')\n" },
  // -- The comment right above this test still said "four rows" in the private source
  //    (Task 3's real behavior); the open-source side reverts to three, so the comment
  //    describing the guard has to match what the reverted code actually renders.
  { path: 'src/settings/panels/AppsPanel.test.ts',
    find: '  // 评审 Important #3:取数在途时不能渲染四行 0 值假读数(尤其是「用户数据库」那行,',
    replace: '  // 评审 Important #3:取数在途时不能渲染三行 0 值假读数(尤其是「用户数据库」那行,' },
  { path: 'src/settings/panels/AppsPanel.test.ts',
    find: "  it('stays on the loading skeleton (no zero-value fake rows) while fetching; renders the real four rows only after both endpoints settle', async () => {",
    replace: "  it('取数在途渲染加载骨架,不渲染 0 值假读数;两个接口都落定后才渲染真实三行', async () => {" },
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

  it('取数失败时三行仍在(空路径),不白屏', async () => {
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
    replace: `  it('恒返回 3 行且顺序固定 —— 后端给了 4 个 key(含未知的第 4 个 key),只渲染前 3 行', () => {
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
    replace: `  it('后端 data 为 null / 缺 key 时给出空路径 0 大小的三行,不抛', () => {
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
    find: "  it('refresh 过滤系统幕后容器(nimoos.system=true,如 AI agent / Photos ML)', async () => {",
    replace: "  it('refresh 过滤系统幕后容器(nimoos.system=true,供其他应用使用的内部服务容器)', async () => {" },

  // ── systemApp.test.ts:文件头注释独立复述了同一段解释,同样点名 Photos ML,
  //    与 systemApp.ts 源文件那处 T7 洗白对齐(该文件本身不在 REPLACE/PATCH 表里
  //    改过,是测试文件自己写的第二份类似文案)─────────────────────────────────
  { path: 'src/apps/util/systemApp.test.ts',
    find: `// 后端 isSystemComposeApp(route/v2/internal_web.go)的前端等价物:
// compose 任一 service 的 label \`nimoos.system == "true"\` 即系统幕后组件,
// 应从面向用户的应用管理页隐藏(agent 运行时 / Photos ML 后端等)。
`,
    replace: `// 后端 isSystemComposeApp(route/v2/internal_web.go)的前端等价物:
// compose 任一 service 的 label \`nimoos.system == "true"\` 即系统幕后组件,
// 应从面向用户的应用管理页隐藏(供其他应用使用的内部服务容器等)。
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
    useAppsStore() // 系统 6 应用就位
    const d = useDock()
    expect(d.favKeys.value).toEqual(['files', 'photos', 'ai', 'vm', 'appstore'])
    expect(d.moreKeys.value).toContain('settings') // 第 6 个系统应用进 more
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
    useAppsStore() // 系统 5 应用就位
    const d = useDock()
    expect(d.favKeys.value).toEqual(['files', 'storage', 'vm', 'appstore'])
    expect(d.moreKeys.value).toContain('settings') // 第 5 个系统应用进 more
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
    d.reorder('settings', 'fav', 'photos') // settings(more) 插到 photos 前
    expect(d.favKeys.value).toEqual(['files', 'settings', 'photos'])
  })`,
    replace: `  it('moves a more-key into favorites before a given key', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files', 'vm'])
    d.reorder('settings', 'fav', 'vm') // settings(more) 插到 vm 前
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
  // 回退可逆也要在 dock 这条链路上验一次:flag 命中时仍整页跳老桌面,且 dock 照样收起。
  it('expanded: 回退 flag strangler:disabled:/settings==1 时 settings 仍整页跳 /#/legacy', async () => {
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
    find: `  // SP9-P8 cutover:settings 从整页跳 /#/legacy 改成应用内 router.push('/settings')。
  // 断言方式与 useOpenAction.test.ts 同一套(那里是单元级,这里是 dock 点击链路级)。
`,
    replace: `  // settings 磁贴走应用内路由。断言方式与 useOpenAction.test.ts 同一套
  // (那里是单元级,这里是 dock 点击链路级)。
` },
  // 全部应用抽屉的应用总数:oss 只有 5 个系统应用(files/storage/vm/appstore/settings,
  // T6 删了 photos/ai),抽屉里 .dock-app 数量恒等于 apps.order.length = 5,不是私有版的 6
  { path: 'src/home/components/HomeDock.test.ts',
    find: `    // 全量 = fav(5) + more(≥1,含设置),多于 dock 条上的 4+1
    expect(sheet!.querySelectorAll('.dock-app').length).toBeGreaterThanOrEqual(6)`,
    replace: `    // 全量 = oss 全部 5 个系统应用(fav 4 + more 里的 settings),多于 dock 条上的 4+1
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
    find: '复用于搜索、文件预览、Welcome 等一切滚动区',
    replace: '复用于文件预览、Welcome 等一切滚动区' },
  // theme.css:"2.6 环形图 / 迷你图 / AI 光球"分节标题——AiWidget 的光球 token(--orb-core/
  // --orb-glow)T8 已经删了,但标题文字本身被漏网,直接点名"AI"。环形图/迷你图两个真实
  // token(--ring-*/--spark-*)与 AI 无关,标题掐掉后半截即可。
  { path: 'src/styles/theme.css',
    find: '/* 2.6 环形图 / 迷你图 / AI 光球 */',
    replace: '/* 2.6 环形图 / 迷你图 */' },
  // theme.css:两套主题块里"扩展/语义 token"注释各点名了一次 SearchDialog(已删组件)
  // 作为 token 的历史来源说明,MediaViewer 是仍然保留的真实消费方,原样留着。
  { path: 'src/styles/theme.css',
    find: '扩展/语义 token(SearchDialog·MediaViewer 提升为全局;每套主题都给值)。见 THEMING.md §2.12',
    replace: '扩展/语义 token(MediaViewer 提升为全局;每套主题都给值)。见 THEMING.md §2.12' },
  { path: 'src/styles/theme.css',
    find: '扩展/语义 token(白色纸感,取自 SearchDialog/MediaViewer 原浅色板)',
    replace: '扩展/语义 token(白色纸感,取自 MediaViewer 原浅色板)' },

  // StartAppDialog.vue:spinner 样式注释拿已删的 SearchDialog 当参照物,改成不点名。
  { path: 'src/home/components/StartAppDialog.vue',
    find: '/* 与 SearchDialog .spinner 同款:--ring-track 底圈 + --accent 顶弧 */',
    replace: '/* 复用统一 spinner 样式:--ring-track 底圈 + --accent 顶弧 */' },

  // GridItem.vue:CSS 注释里还留着"app/folder/photo"三态,但 'photo' 这个 kind 连同
  // PhotoTile 已经被前面的补丁删干净了——这句纯文字描述没跟着改,补上。
  { path: 'src/home/components/GridItem.vue',
    find: 'is not clipped on app/folder/photo items',
    replace: 'is not clipped on app/folder items' },
  // MobileHome.vue:同一处道理,"photo 磁贴占 2×2"这个分句描述的是已删的 photo 磁贴。
  { path: 'src/home/components/MobileHome.vue',
    find: '图标区:行高=列宽 → 格子恒为正方形;photo 磁贴占 2×2,dense 回填空洞',
    replace: '图标区:行高=列宽 → 格子恒为正方形,dense 回填空洞' },
  // gridMath.test.ts:clampSize 是通用的尺寸吸附逻辑,测试标题里仍在举例"photo"这个
  // 已经不存在的 kind——它不是测试内容(测试本体用的是 kind:'app'),只是标题文字。
  { path: 'src/home/grid/gridMath.test.ts',
    find: "it('snaps app/folder/photo to nearest of 1x1 or 2x2', () => {",
    replace: "it('snaps app/folder to nearest of 1x1 or 2x2', () => {" },

  // dropEntries.ts / dropEntries.test.ts:拖拽上传的通用文件收集逻辑,注释里拿已删的
  // Photos 模块的 collectFilesFromDataTransfer 函数名当对比对象——直接点名了私有功能
  // 内部的函数名,改成不点名的表述,行为对比本身(不按媒体类型过滤/不跳过隐藏文件)保留。
  { path: 'src/files/upload/dropEntries.ts',
    find: '。与 Photos 的 collectFilesFromDataTransfer 不同:不按媒体',
    replace: '。不按媒体' },
  { path: 'src/files/upload/dropEntries.test.ts',
    find: "    // Unlike Photos' collectFilesFromDataTransfer, the file manager's drop path",
    replace: '    // The file manager\'s drop path' },

  // Files.vue:旧格式深链来源说明里点名了 Vue2 时代的 "AI" 功能(打开文件位置的入口
  // 之一),AI 功能整个已经不存在,来源说明改成不点名的"旧版"。
  { path: 'src/views/Files.vue',
    find: '来源:Vue2 AI「打开文件位置」、上传通知、',
    replace: '来源:旧版「打开文件位置」、上传通知、' },

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
    find: `  it('storage 与 apps 两把 flag 互不干扰', () => {
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
    find: '// P8 cutover:dock 的 files 图标改应用内 router.push,需 mock 路由单例(vi.mock 会被提升到 import 前)。',
    replace: '// dock 的 files 图标走应用内 router.push,需 mock 路由单例(vi.mock 会被提升到 import 前)。' },
  { path: 'src/home/components/GridItem.click.test.ts',
    find: '// P8 cutover:文件夹瓦片改应用内 router.push,需 mock 路由单例(vi.mock 会被提升到 import 前)。',
    replace: '// 文件夹瓦片走应用内 router.push,需 mock 路由单例(vi.mock 会被提升到 import 前)。' },
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: '// P8 cutover:文件入口改应用内 router.push,需 mock 路由单例(vi.mock 会被提升到 import 前)。',
    replace: '// 文件入口走应用内 router.push,需 mock 路由单例(vi.mock 会被提升到 import 前)。' },
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: "  it('appstore 磁贴应用内 router.push /apps/store(SP5-P8 cutover)', () => {",
    replace: "  it('appstore 磁贴应用内 router.push /apps/store', () => {" },
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: "  it('storage 磁贴应用内 router.push /storage(SP6-P6 cutover)', () => {",
    replace: "  it('storage 磁贴应用内 router.push /storage', () => {" },
  { path: 'src/files/drop/protocol.ts',
    find: '// 硬约束:P8 翻 strangler 前新旧页面并存互传,任何形状/数值改动都会破坏兼容。',
    replace: '// 硬约束:该协议用于页面间互传,任何形状/数值改动都会破坏兼容。' },

  // ── I6:vite.config.ts 直接点名 Claude Code,与「删 CLAUDE.md 因为它是最直白的
  //    AI 辅助开发标记」的理由自相矛盾。exclude 数组本身保留(功能无害)。────────
  { path: 'vite.config.ts',
    find: '    // Claude Code 的隔离 worktree 会出现在 .claude/worktrees/ 下(含整个仓库副本),',
    replace: '    // 本机可能存在 .claude/ 等工具目录(含整个仓库副本),' },

  // ── I7a:注释里泄露内部 SDD 台账路径(.superpowers/sdd/sp9/...)与债务编号。──
  { path: 'src/settings/util/ifaceForm.ts',
    find: '// → 写路径的正确性只能靠这里的单测(见台账 .superpowers/sdd/sp9/03-p2.md 债务 D18)。',
    replace: '// → 写路径的正确性只能靠这里的单测(该接口没有安全的真机验证途径)。' },

  // ── M1:package.json 的 name 是私有仓名(new-ui 暗示存在一个 old UI)。────────
  { path: 'package.json',
    find: '  "name": "nimoos-new-ui",', replace: '  "name": "nimoos-web",' },

  // ── M2:scripts/deploy.sh 注释里写着私有仓名。──────────────────────────────
  { path: 'scripts/deploy.sh',
    find: '# 构建 NimoOS-New-UI 并部署到 Gateway 的 /app/ 静态目录。',
    replace: '# 构建本项目并部署到 Gateway 的 /app/ 静态目录。' },

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
  it('主路由表已展开 knowledge 路由', async () => {
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
    find: `  <!-- SP8-P2b 验收第 3 轮(2026-07-30):AI 区在前台时,给自己套上 AI 的 toast 作用域与
       明暗。不这么做的话本组件读的是全局蓝黑主题的半透明白底 + 白字,画在 AI 浅色页面上
       完全看不见(AI 区所有 toast 都收不到反馈)。根因与 token 取值见
       src/ai/stores/aiTheme.ts 的 aiSurfaces 注释、样式在 tokens.scss 的 .ai-toast-scope。
       不在 AI 区时两个绑定都不生效 —— 桌面/文件/应用区观感零变化(用户明确要求)。 -->
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
    find: `   —— 用户以为按钮没响应,反复重试(2026-07-30 用户在「创建令牌」弹窗里点复制复现)。
   【SP8-P6-T3 合流】取 sp8 的 10100 而非 master 的 1100:AI 区随本次合流进入主干,
   它的 SearchImageLightbox / SearchFileDrawer 坐在 10000、SearchFullResults 9999,
   1100 会被它们压住。10100 是"高于全仓最高的 10000、且留出余量"的最小安全值。
   本元素 pointer-events: none,置顶不会拦截任何点击。守卫见 AppToast.test.ts 末条。 */`,
    replace: `   —— 用户以为按钮没响应,反复重试(2026-07-30 用户在「创建令牌」弹窗里点复制复现)。
   取值 10100:留足余量,高于全仓任何浮层。本元素 pointer-events: none,置顶不会拦截
   任何点击。守卫见 AppToast.test.ts 末条。 */`,
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
// 【SP8-P2b 验收第 3 轮,用户 2026-07-30 拍板】AI 区在前台时,提示条要跟随 AI 的明暗主题
// (否则白底白字看不见,详见 aiTheme.test.ts 的说明)。离开 AI 区必须完全恢复原样 ——
// 用户明确要求「桌面零影响」,所以「不在 AI 区时不带任何额外 class / data-theme」这条
// 同样要钉住。
describe('AppToast —— AI 区 toast 作用域', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('不在 AI 区:不带 ai-toast-scope、不带 data-theme(桌面零影响)', () => {
    const w = mount(AppToast)
    const root = w.find('.toast-stack')
    expect(root.classes()).not.toContain('ai-toast-scope')
    expect(root.attributes('data-theme')).toBeUndefined()
  })

  it('AI 区在前台:带 ai-toast-scope,且 data-theme 跟随 AI 主题', async () => {
    const ai = useAiTheme()
    ai.enterAiSurface()
    const w = mount(AppToast)
    const root = w.find('.toast-stack')
    expect(root.classes()).toContain('ai-toast-scope')
    expect(root.attributes('data-theme')).toBe(ai.theme)
  })

  it('AI 区内切换明暗:data-theme 跟着变(弹窗/提示不用关掉重开)', async () => {
    const ai = useAiTheme()
    ai.enterAiSurface()
    const w = mount(AppToast)
    const before = w.find('.toast-stack').attributes('data-theme')
    ai.toggleTheme()
    await w.vm.$nextTick()
    const after = w.find('.toast-stack').attributes('data-theme')
    expect(after).not.toBe(before)
    expect(after).toBe(ai.theme)
  })

  it('离开 AI 区后恢复:class 与 data-theme 都撤掉', async () => {
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
    find: `// \`1100\`,AI 区的 SearchImageLightbox/SearchFileDrawer 是 \`10000\`、SearchFullResults 是 \`9999\`
// (全仓 grep 实测的最高层)。提示条是**最顶层反馈**,必须盖在这些之上,否则任何弹窗打开时`,
    replace: `// \`1100\`,而全仓 grep 实测的最高浮层坐在 \`10000\`。
// 提示条是**最顶层反馈**,必须盖在这些之上,否则任何弹窗打开时` },

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
describe('AI 区 cutover(SP8-P6)', () => {
  it('ai 磁贴应用内 router.push /ai/agent', () => {
    const { openApp } = useOpenAction()
    openApp('ai')
    expect(router.push).toHaveBeenCalledWith('/ai/agent')
    expect(hrefs.length).toBe(0)
  })

  it('flag 置 1 时 ai 磁贴退回 Vue2 /#/ai/agent', () => {
    localStorage.setItem('strangler:disabled:/ai', '1')
    const { openApp } = useOpenAction()
    openApp('ai')
    expect(router.push).not.toHaveBeenCalled()
    expect(hrefs).toEqual(['/#/ai/agent'])
  })

  it('桌面 AI 小组件应用内 router.push /ai/agent', () => {
    const { openItem } = useOpenAction()
    openItem({ kind: 'widget', key: 'ai' } as LayoutItem)
    expect(router.push).toHaveBeenCalledWith('/ai/agent')
    expect(hrefs.length).toBe(0)
  })

  it('flag 置 1 时 AI 小组件退回 Vue2', () => {
    localStorage.setItem('strangler:disabled:/ai', '1')
    const { openItem } = useOpenAction()
    openItem({ kind: 'widget', key: 'ai' } as LayoutItem)
    expect(router.push).not.toHaveBeenCalled()
    expect(hrefs).toEqual(['/#/ai/agent'])
  })

  it('sendToAI 应用内带 message query(对象形式,不手工编码)', () => {
    const { sendToAI } = useOpenAction()
    sendToAI('帮我找 发票 & 收据')
    expect(router.push).toHaveBeenCalledWith({ path: '/ai/agent', query: { message: '帮我找 发票 & 收据' } })
    expect(hrefs.length).toBe(0)
  })

  it('sendToAI 空文本不带 query', () => {
    const { sendToAI } = useOpenAction()
    sendToAI('   ')
    expect(router.push).toHaveBeenCalledWith({ path: '/ai/agent' })
  })

  it('knowledge 磁贴走应用内路由 /ai/knowledge(SP14 #98,无回退目标)', () => {
    const { openApp } = useOpenAction()
    openApp('knowledge')
    expect(router.push).toHaveBeenCalledWith('/ai/knowledge')
    expect(hrefs.length).toBe(0)
  })

  it('flag 置 1 时 sendToAI 退回 Vue2 并保持 encodeURIComponent 拼串', () => {
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
    find: `// SP8-P6-T4:i18n 分片不相交守卫(常驻)。
//
// 背景与三条安全前提见 photosSlice.test.ts 顶部注释:分片靠对象展开合并
// (\`{...base, ...photos, ...ai}\`),重复键会被后展开的静默覆盖 —— git 不报冲突,
// parity.test.ts 只测「合并后」的键集,两语言若以同样方式撞车、合并结果仍然相等,
// parity 也照过。这类错误此前完全无声。
//
// 本文件补 photosSlice.test.ts 没覆盖的三个缺口(该文件已经守住了「三片(base/
// photos/ai)两两不相交」「出口是纯合并」,不在此重复):
//
//   ① 真实分片是 **4 片**,不是 3 片。\`zh_cn.sp9.ts\` / \`en_us.sp9.ts\` 不经过
//      \`zh_cn.ts\` / \`en_us.ts\` 那个出口 —— 它在 \`src/i18n/index.ts\` 里单独并入
//      (\`{ ...zh, ...zhSp9 }\`),是第二条独立的装配路径。photosSlice.test.ts 只验
//      \`zh_cn.ts\` 出口(base+photos+ai),漏掉了 sp9 这一片与其余三片的撞车风险,
//      而 sp9 是整个 SP9 期文案,体量(459 键)不小。
//   ② ai 分片自身的前缀守卫(该分片是 T3 新建的,还没有专属守卫)。
//   ③ 两语言分片结构对称 —— 每一片 zh 与 en 的键集须完全一致。若两语言各自以
//      不同方式撞车,「合并后键数相等」这类聚合检查会失明(键数凑巧相等但键不同)。
//
// 「无损划分」这条刻意验证**真实装配路径**:import '../index' 拿到的 createI18n
// 实例(index.ts 里 \`messages.zh_cn\` / \`messages.en_us\`),而不是只测 zh_cn.ts 那个
// 不含 sp9 的出口 —— 后者会漏掉 sp9 分片撞车的可能性。`,
    replace: `// i18n 分片不相交守卫(常驻)。
//
// 文案分成两片文件,靠对象展开合并(\`{ ...base, ...shard }\`),重复键会被后展开的
// 静默覆盖 —— git 不报冲突,而 parity.test.ts 只测「合并后」的键集:两语言若以同样
// 方式撞车、合并结果仍然相等,parity 也照过。这类错误此前完全无声。
//
// 本文件补 parity.test.ts 没覆盖的三个缺口:
//
//   ① parity 的「分片不得覆盖基座已有 key」**只查了 zh 一侧**
//      (parity.test.ts 里 \`Object.keys(zhSp9).filter((k) => k in zhBase)\`)。
//      只在英文侧撞车时:合并后两语言键集仍然相等 → parity 第一条绿;zh 侧没撞 →
//      parity 那条也绿。结果是英文文案被静默覆盖而无人看守。下面双语各查一遍。
//   ② **真实装配路径**。\`src/i18n/index.ts\` 才是产线把两片并起来的地方
//      (\`{ ...zh, ...zhSp9 }\`),而 parity.test.ts 自己手写了一遍合并公式、根本不
//      import index.ts。本文件的「无损划分」刻意读 index.ts 装出来的 createI18n
//      实例,「index.ts 有没有真把分片并进去」才有覆盖 —— 全仓仅此一处。
//   ③ 两语言**逐片**结构对称。parity 断言的是「合并后」的集合,跨片错位(某键在
//      zh 的基座里、却在 en 的分片里)合并后仍然相等,逐片比较才看得见。` },

  //    (b)(c) 摘掉两组 import(4 行)。⚠️ 剩下的 sp9 两行是**保留原文**,不经
  //           replace payload —— 冻结分身守卫按设计不管它们(见上方长注释)。
  { path: 'src/i18n/__tests__/shardDisjoint.test.ts',
    find: "import zhPhotos from '../zh_cn.photos'\nimport zhAi from '../zh_cn.ai'\n", replace: '' },
  { path: 'src/i18n/__tests__/shardDisjoint.test.ts',
    find: "import enPhotos from '../en_us.photos'\nimport enAi from '../en_us.ai'\n", replace: '' },

  //    (d) zh 侧不相交:六对 → 一对
  { path: 'src/i18n/__tests__/shardDisjoint.test.ts',
    find: `describe('zh 四片两两不相交(base / photos / ai / sp9)', () => {
  it('六对组合全部不相交', () => {
    expect(overlap(zhBase as Dict, zhPhotos as Dict), 'base × photos').toEqual([])
    expect(overlap(zhBase as Dict, zhAi as Dict), 'base × ai').toEqual([])
    expect(overlap(zhBase as Dict, zhSp9 as Dict), 'base × sp9').toEqual([])
    expect(overlap(zhPhotos as Dict, zhAi as Dict), 'photos × ai').toEqual([])
    expect(overlap(zhPhotos as Dict, zhSp9 as Dict), 'photos × sp9').toEqual([])
    expect(overlap(zhAi as Dict, zhSp9 as Dict), 'ai × sp9').toEqual([])
  })
})`,
    replace: `describe('zh 两片不相交(基座 / zh_cn.sp9.ts)', () => {
  it('基座与分片不相交', () => {
    expect(overlap(zhBase as Dict, zhSp9 as Dict), '基座 × 分片').toEqual([])
  })
})`},

  //    (e) en 侧不相交:这条是 parity 缺的那一条,注释里把理由钉死,免得后人又删
  { path: 'src/i18n/__tests__/shardDisjoint.test.ts',
    find: `describe('en 四片两两不相交(base / photos / ai / sp9)', () => {
  it('六对组合全部不相交', () => {
    expect(overlap(enBase as Dict, enPhotos as Dict), 'base × photos').toEqual([])
    expect(overlap(enBase as Dict, enAi as Dict), 'base × ai').toEqual([])
    expect(overlap(enBase as Dict, enSp9 as Dict), 'base × sp9').toEqual([])
    expect(overlap(enPhotos as Dict, enAi as Dict), 'photos × ai').toEqual([])
    expect(overlap(enPhotos as Dict, enSp9 as Dict), 'photos × sp9').toEqual([])
    expect(overlap(enAi as Dict, enSp9 as Dict), 'ai × sp9').toEqual([])
  })
})`,
    replace: `// ⚠️ 别删这个 describe:它是 parity.test.ts **没有**的那一条。parity 的
// 「分片不得覆盖基座已有 key」只查 zh 侧,只在英文侧撞车时它整套断言全绿
// (合并后两语言键集仍相等、zh 侧确实没撞),英文文案就这么被静默覆盖。
describe('en 两片不相交(基座 / en_us.sp9.ts)', () => {
  it('基座与分片不相交', () => {
    expect(overlap(enBase as Dict, enSp9 as Dict), '基座 × 分片').toEqual([])
  })
})`},

  //    (f) 无损划分:判别力边界注释重写 + 两个求和从四项收到两项
  { path: 'src/i18n/__tests__/shardDisjoint.test.ts',
    find: `  // 用真实 i18n 实例的 messages,而不是重新手写一遍 {...a, ...b, ...c, ...d} ——
  // 否则本测试和被测代码用同一条(可能同样错的)装配公式,查不出装配路径本身写错的情况。
  //
  // 这条断言的判别力边界(独立评审做过变异实测,结论记在这里免得后人误读):
  //   能抓:某个分片游离在真实装配路径之外(比如以后新增第五片却忘了在 index.ts 里并进
  //     去),或真实 messages 里混进了这四个已知分片之外的来源。sp9×ai 定向撞车的变异
  //     (往 zh_cn.sp9.ts 塞一个与 zh_cn.ai.ts 重名的键)会同时把这条和「两两不相交」
  //     一起打红 —— 这也是 shardDisjoint.test.ts 存在的核心理由:同一变异下
  //     photosSlice.test.ts 的 12 条断言全绿、完全失明(它没有 sp9 这一片)。
  //   抓不到:某个分片内部纯删除/纯增加而不撞名的情况 —— 例如从 zh_cn.sp9.ts 删掉
  //     一个键。这时「四片键数之和」与「真实装配后键数」两边同步减 1,等式在集合论上
  //     恒成立(只要「四片两两不相交」这个前提没被破坏),此断言必然保持绿,不代表
  //     文案没被误删。防"误删文案"要靠别的手段(比如 messageSyntax.test.ts 那类值域
  //     检查,或对已知键名做存在性断言),不归本条断言管。
  const realMessages = i18n.global.messages.value as Record<string, Dict>

  it('zh_cn: base+photos+ai+sp9 键数之和 == messages.zh_cn 键数', () => {
    const sum = Object.keys(zhBase as Dict).length + Object.keys(zhPhotos as Dict).length +
      Object.keys(zhAi as Dict).length + Object.keys(zhSp9 as Dict).length
    expect(sum).toBe(Object.keys(realMessages.zh_cn).length)
  })

  it('en_us: base+photos+ai+sp9 键数之和 == messages.en_us 键数', () => {
    const sum = Object.keys(enBase as Dict).length + Object.keys(enPhotos as Dict).length +
      Object.keys(enAi as Dict).length + Object.keys(enSp9 as Dict).length
    expect(sum).toBe(Object.keys(realMessages.en_us).length)
  })
})

describe('ai 分片前缀守卫', () => {
  it('zh_cn.ai.ts 键全部以 ai 开头', () => {
    const bad = Object.keys(zhAi as Dict).filter((k) => !k.startsWith('ai'))
    expect(bad, \`非 ai 前缀键: \${bad.join(', ')}\`).toEqual([])
  })

  it('en_us.ai.ts 键全部以 ai 开头', () => {
    const bad = Object.keys(enAi as Dict).filter((k) => !k.startsWith('ai'))
    expect(bad, \`非 ai 前缀键: \${bad.join(', ')}\`).toEqual([])
  })
})`,
    replace: `  // 用真实 i18n 实例的 messages,而不是重新手写一遍 {...a, ...b} —— 否则本测试和
  // 被测代码用同一条(可能同样错的)装配公式,查不出装配路径本身写错的情况。
  // **全仓只有这里**对 src/i18n/index.ts 的真实装配结果下断言。
  //
  // 这条断言的判别力边界(记在这里免得后人误读):
  //   能抓:某个分片游离在真实装配路径之外(比如以后新增一片却忘了在 index.ts 里
  //     并进去),或真实 messages 里混进了这两个已知分片之外的来源。
  //   抓不到:某个分片内部纯删除/纯增加而不撞名的情况 —— 例如从分片里删掉一个键。
  //     这时「两片键数之和」与「真实装配后键数」两边同步减 1,等式在集合论上恒成立
  //     (只要「两片不相交」这个前提没被破坏),此断言必然保持绿,不代表文案没被
  //     误删。防"误删文案"要靠别的手段(对已知键名做存在性断言之类),不归本条管。
  const realMessages = i18n.global.messages.value as Record<string, Dict>

  it('zh_cn: 两片键数之和 == messages.zh_cn 键数', () => {
    const sum = Object.keys(zhBase as Dict).length + Object.keys(zhSp9 as Dict).length
    expect(sum).toBe(Object.keys(realMessages.zh_cn).length)
  })

  it('en_us: 两片键数之和 == messages.en_us 键数', () => {
    const sum = Object.keys(enBase as Dict).length + Object.keys(enSp9 as Dict).length
    expect(sum).toBe(Object.keys(realMessages.en_us).length)
  })
})`},

  //    (g) 逐片中英对称:摘掉 photos / ai 两条,注释改写
  { path: 'src/i18n/__tests__/shardDisjoint.test.ts',
    find: `describe('两语言分片结构对称(每一片 zh 与 en 键集完全一致)', () => {
  // photos 这一条与 photosSlice.test.ts「两语言键集完全一致」重复 —— 保留是为了让
  // 本文件本身就是「四片对称性」的完整清单,不必跳去另一个文件才能确认 photos 也被
  // 覆盖到。base / ai / sp9 三条是本文件独有,此前没有任何测试守这三片的中英对称。
  it('base 分片: zh 与 en 键集完全一致', () => {
    expect(Object.keys(zhBase as Dict).sort()).toEqual(Object.keys(enBase as Dict).sort())
  })

  it('photos 分片: zh 与 en 键集完全一致', () => {
    expect(Object.keys(zhPhotos as Dict).sort()).toEqual(Object.keys(enPhotos as Dict).sort())
  })

  it('ai 分片: zh 与 en 键集完全一致', () => {
    expect(Object.keys(zhAi as Dict).sort()).toEqual(Object.keys(enAi as Dict).sort())
  })

  it('sp9 分片: zh 与 en 键集完全一致', () => {
    expect(Object.keys(zhSp9 as Dict).sort()).toEqual(Object.keys(enSp9 as Dict).sort())
  })
})`,
    replace: `describe('两语言逐片结构对称(每一片 zh 与 en 键集完全一致)', () => {
  // parity.test.ts 断言的是「合并后」的集合,跨片错位(某键在 zh 的基座里、却在
  // en 的分片里)合并后仍然相等 —— 只有逐片比较才看得见。这两条是本文件独有。
  it('基座: zh 与 en 键集完全一致', () => {
    expect(Object.keys(zhBase as Dict).sort()).toEqual(Object.keys(enBase as Dict).sort())
  })

  it('分片: zh 与 en 键集完全一致', () => {
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
    find: "    expect(sheets.length, '独立样式表一个都没读到(`?raw` 恒空的老坑)').toBeGreaterThan(5)",
    replace: "    // 本树共 5 个独立样式表(全部是 .css);阈值 4 = 「5 个一个不少地读到了非空内容」。\n    expect(sheets.length, '独立样式表一个都没读到(`?raw` 恒空的老坑)').toBeGreaterThan(4)" },

  // ── 注释洗白:sp8-ai 合流往**保留面**的文件里带进来的 7 处点名 ────────────
  //    这 7 处是 2026-08-06 实测跑完整导出、泄漏守卫在 New-UI 侧命中的全部内容
  //    (Service 侧另有 977 处,归 T8)。全是注释,与 T7/T14 两轮"注释洗白"同性质:
  //    代码行为一字不改,只把指向已删功能区的点名换成不点名的等价措辞。

  //    ① AppToast.zIndex.test.ts:引用了两个已删测试文件当"先例"。守卫本身保留。
  { path: 'src/components/AppToast.zIndex.test.ts',
    find: `// 空壳 —— 守卫会"绿"得毫无判别力。这正是 photosSlice.test.ts / knowledgeStyles.test.ts
// 文件头记的同一个坑(「读盘一律 node:fs,\`?raw\` 恒空」),这里沿用它们的既定手法。`,
    replace: `// 空壳 —— 守卫会"绿"得毫无判别力。本仓另有几处样式守卫踩过同一个坑,
// 既定手法是「读盘一律 node:fs,\`?raw\` 恒空」,这里沿用。` },

  //    ②③ clipboard.ts / clipboard.test.ts:reka 焦点陷阱那段根因说明里点名了
  //       复现路径所在的页面。根因与修法与那个页面无关(是 reka DialogContent 的
  //       通用行为),把页面名换成"设置页/弹窗"即可,技术内容一字不动。
  { path: 'src/files/util/clipboard.ts',
    find: `// 原本一律挂 document.body,结果**弹窗里的复制全部失败**(用户实测:AI 设置页页面上的复制
// 正常,「创建令牌」弹窗里三个都复制不到东西)。根因在 reka 的焦点陷阱`,
    replace: `// 原本一律挂 document.body,结果**弹窗里的复制全部失败**(用户实测:设置页页面上的复制
// 正常,弹窗里的复制按钮一个都复制不到东西)。根因在 reka 的焦点陷阱` },
  { path: 'src/files/util/clipboard.test.ts',
    find: `// 【SP8-P2b 验收第 4 轮,2026-07-30】用户实测:AI 设置页**页面上**的复制正常,**「创建令牌」
// 弹窗里的三个复制全部失败(剪贴板里什么都没有)**。`,
    replace: `// 【2026-07-30 用户实测】设置页**页面上**的复制正常,**弹窗里的复制按钮
// 全部失败(剪贴板里什么都没有)**。` },

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
    find: '  // /app/#/ai/* 验收」的能力一条不少,还额外覆盖了 /v3 与 MessageBus WS。',
    replace: '  // /app/#/ 验收」的能力一条不少,还额外覆盖了 /v3 与 MessageBus WS。' },
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
