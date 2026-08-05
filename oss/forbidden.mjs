import fs from 'node:fs'
import path from 'node:path'

// ─── 硬禁词:出现即失败,无白名单 ────────────────────────────────────────────
// 注意 E4:spec §6.1 原本把 folderPermission 放在这里,那会让守卫永久红 ——
// UserFolderPermission 是成员文件夹授权的类型名,是保留面。已降为软禁词。
export const HARD = [
  ['相册', /相册/],
  ['Nimo AI', /Nimo\s*AI/i],
  ['ask nimo', /ask\s*nimo/i],
  ['transcript', /transcript/i],
  ['qdrant', /qdrant/i],
  ['ollama', /ollama/i],
  ['embedding', /embedding/i],
  ['CLIP', /\bCLIP\b/],
  ['immich', /immich/i],
  ['photos_data', /photos_data/i],
  ['wikiRoot', /wikiRoot/i],
  ['192.168.1.115', /192\.168\.1\.115/],

  // ── T6.5:中文硬禁词 ──────────────────────────────────────────────────
  // 本库注释与界面文案全中文,原词表只有「相册」一个中文词,是个大盲区(见
  // T6.5 brief 的实测表:搜索/照片/转录/说话人/知识库/向量化/智能 命中数原本全是 0)。
  // 以下四条已在全仓 grep 核实:所有出现都属于「该剥离的 AI/音频转录功能」,
  // 没有发现任何合法用法,故直接 HARD(不给白名单)。
  ['说话人', /说话人/],       // 音频转录的说话人分离/diarization,仅见于 MediaViewer/theme.css/speakerWave 一族
  ['知识库', /知识库/],       // RAG 知识库,仅见于 settingsFp(folder-permissions,AI 消费方)i18n 键
  ['向量化', /向量化/],       // 向量化/embedding 的中文说法,仅见于 Ask Nimo 音频问答文案
  ['问 Nimo', /问\s*Nimo/i], // "Ask Nimo" 的中文说法(audioAsk/audioAskEmpty),与「Nimo AI」分开收

  // ── T6.5 复审 Important③:英文侧配对词 ─────────────────────────────────
  // 「知识库」的英文孪生词。全仓 grep 核实(含 packages/service 与 ../NimoOS-Service):
  // knowledge/RAG 的所有出现——settingsFpKnowledge(Desc)、en_us.sp9.ts 的
  // 'Knowledge base'/'…knowledge base (RAG).'、knowledgeRootItems/knowledgeExcludeItems/
  // knowledgeCell/knowledgeKindOf、FolderPermColumn 的 'knowledge' 分支、'knowledge-root'/
  // 'knowledge-exclude' 字面量——全部集中在 folder-permissions 这一个 AI 消费方(四分区面板
  // 及其 util/test),零合法用法。用 \b 词边界,不会误伤 "acknowledge" 这类词(已 grep 确认
  // 全仓没有这个词)。
  ['knowledge', /\bknowledge\b/i],
  // RAG 只出现在 settingsFpKnowledgeDesc 的英文/中文值里(en_us.sp9.ts:245、zh_cn.sp9.ts:253),
  // 同样零合法用法。要求全大写 + 词边界,避免误伤"fragment"之类含 "rag" 子串的词。
  ['RAG', /\bRAG\b/],

  // 注意:评审同时问过「smart」(对应中文「智能」)要不要收。**不收,而且不应该收**——
  // 已用 `grep -rn -i smart --include='*.ts' --include='*.vue' src/` 核实全仓 12 处命中:
  // 10 处是硬盘 S.M.A.R.T. 健康检测(`src/storage/**`,如 `SMART 未过("false")→ 风险边框`、
  // `data.disks[*].health = "true" ← SMART 通过`、`100 分起扣:SMART 未过直接 0`),
  // 与 AI 完全无关;只有 2 处是真泄漏(`en_us.sp9.ts:238` 的 `settingsFpIntro: '...smart
  // feature's...'`、`en_us.ts:236` 的 `widgetAiDesc: 'Chat and smart suggestions'`,
  // 这两处已经通过它们的中文孪生键——`settingsFpIntro`/`widgetAiDesc` 的中文值命中
  // 「智能」——被抓到,T8 删中文键时英文键会一起被处理,不会漏)。10/12 是无关的磁盘功能,
  // 词表「宁可宽」不等于「宽到把无关功能的正常代码全染红」,故不收。后人看到「智能」有词、
  // 「smart」没词,不要顺手补上——先重读这段注释。
].map(([word, re]) => ({ word, re }))

/**
 * T6.5:把一段"已知合法的整行内容"转成整行精确匹配的正则(允许行首/行尾空白)。
 * 用于 allow 条目 —— 只匹配"这一行掐头去尾就是这段文本",行内任何增删都会让
 * 匹配失效,从而回落到"未豁免、按词表规则判断",不会带着新增的泄漏一起被放行。
 * 复审 Critical(2026-08-04)的教训:之前用「文件+关键词/键名子串」豁免,等于对
 * 整行甚至整个文件开洞——只要在被豁免的那一行混入真实 AI 泄漏也照样放行(复现
 * 见 转录/照片/搜索 三个词条各自的注释)。用 new RegExp(string) 构造而不是正则
 * 字面量,顺带省掉「行内本来就有 / 」时的转义麻烦。
 */
function exactLine(literal) {
  const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^\\s*${escaped}\\s*$`)
}

/**
 * T14:pnpm-lock.yaml 是自动生成文件,不是手写代码 —— "整行精确匹配"这套武器在这里
 * 起不到应有的作用(依赖升级一次,精确到字节的哈希/版本号锚点全部作废,逼着后人重新
 * 手抄一遍,起不到"拦住手工夹带泄漏"的效果)。改用"这一行长得像 pnpm-lock 里的包名/
 * resolution/version/specifier 记录行"的**形状**规则:
 *   `resolution:` / `version:` / `specifier:` 这三个字面量键,或
 *   `'?@?[\w@/.-]+'?:` —— 可选引号 + 可选 @scope + 包名字符集(字母数字@/.-)+
 *   可选引号 + 冒号,覆盖 `'@babel/parser@7.29.7':`、`engine.io-parser@2.2.1:`、
 *   `yargs-parser: 13.1.2` 这几种 pnpm-lock 真实出现过的写法。
 * 只用于词表宁可宽也要收的 ai/search(第三方包名含这两个子串的情况事实上无法穷举:
 * @codemirror/search、未来任何名字带 "ai" 的包)。parser 走另一条更窄的路径(见下方
 * parser 词条注释)—— photo/gallery/transcript/wiki 这几个词完全不给 lockfile 开洞,
 * 依赖名里真出现就应该被抓到人工看一眼。
 *
 * ★ 已知盲区(T15 记账,非缺陷修复):这条"形状"规则只看一行像不像 lockfile 记录行,
 * 不看包名具体是什么 —— 所以理论上,如果哪天真的引入了一个整包名恰好含 ai/search
 * 语义的私有包(例如假设的 `@nimotech/nimoos-search`),这条规则会像放行 `@codemirror/search`
 * 一样把它也放行,不会被抓到人工看一眼。当前 lockfile 里没有这种包(已 grep 核实),
 * 但后人往 lockfile 引入新依赖时,如果包名本身就是要剥离的私有服务名,不能指望这条
 * 守卫拦住 —— 需要人工留意包名,或者在这里为该具体包名加一条排除规则。
 */
const PNPM_LOCK_LINE = /^\s+(resolution|version|specifier|'?@?[\w@/.-]+'?:)/

// ─── 软禁词 + 精确白名单 ────────────────────────────────────────────────────
// allow 的每一项是「文件正则 + 该文件里允许的整行正则」。按文件+内容豁免,
// 绝不按行号 —— 行号会漂,漂了豁免就失效,然后人就会去放宽词表。
export const SOFT = [
  {
    word: 'photo',
    re: /photo/i,
    allow: [
      { file: /src\/files\/util\/fileCategories\.ts$/, re: /APPLICATION_PHOTOSHOP/ },
      { file: /src\/files\/util\/icons\.ts$/, re: /folder-pictures|APPLICATION_PHOTOSHOP/ },
      { file: /src\/apps\/util\/importNormalize\.ts$/, re: /'pictures',\s*'photo'|除 config\/download\/pictures\/photo\/media 外/ },
      // T14:importNormalize.test.ts —— 同一份 Vue2 逐字移植的关键字表(volumeAutoCheck)
      // 的测试用例,'photo'/'pictures' 是 Docker 容器路径关键字,不是相册 app。整行精确
      // 匹配(exactLine),不是给整个文件的 'photo' 开洞。
      { file: /src\/apps\/util\/importNormalize\.test\.ts$/, re: exactLine("['/photo', 'myapp', '/DATA/Gallery'],") },
      { file: /src\/apps\/util\/importNormalize\.test\.ts$/, re: exactLine("it('pins Vue2 per-keyword case-sensitivity: config/download/pictures/photo/media are lowercase-literal only', () => {") },
      { file: /src\/apps\/util\/importNormalize\.test\.ts$/, re: exactLine('// \'photo\'/\'pictures\' are lowercase-only in Vue2 — capitalized "Photo" must NOT match, falls to default.') },
      { file: /src\/apps\/util\/importNormalize\.test\.ts$/, re: exactLine("expect(volumeAutoCheck('/Photo', 'myapp')).toBe('/DATA/AppData/myapp/Photo')") },
      // T14:'Photos'(大写 P)在文件区/快照(时间机器)测试里全部是**举例用的普通文件夹名**
      // (与 Documents/Media 同类),不是被删除的相册 app —— 相册 app 的字面量是小写
      // kind:'photo'(已被 T9/T11 的 PATCH 从 defaultLayout/AddPanel/GridItem 等处删净,
      // 见 tree.test.ts 对应断言)。全部整行精确匹配,不是给文件按子串开洞。
      { file: /src\/files\/composables\/useDeckPreview\.test\.ts$/, re: exactLine("const setup = (names: string[], relPath = 'Photos') => {") },
      { file: /src\/files\/composables\/useDeckPreview\.test\.ts$/, re: exactLine("expect(getListMock).toHaveBeenCalledWith('/DATA/.snapshots/snap1/Photos')") },
      { file: /src\/files\/composables\/useDeckPreview\.test\.ts$/, re: exactLine("const relPath = ref('Photos')") },
      { file: /src\/files\/composables\/useFileOps\.test\.ts$/, re: exactLine("useFilesStore().currentPath = '/DATA/.snapshots/snap1/Photos'") },
      { file: /src\/files\/composables\/useFileOps\.test\.ts$/, re: exactLine("useFilesStore().currentPath = '/DATA/Photos'") },
      { file: /src\/files\/snapshot\/SnapshotBanner\.test\.ts$/, re: exactLine("const INFO = { mount: '/DATA', snapshotName: '20260713T061900Z_manual_改版前', relPath: 'Photos' }") },
      { file: /src\/files\/snapshot\/TimeMachineBar\.test\.ts$/, re: exactLine("const w = mountIt({ folderText: '正在查看 /磁盘/Photos 的历史版本' })") },
      { file: /src\/files\/snapshot\/TimeMachineBar\.test\.ts$/, re: exactLine("expect(w.find('.tm-bar-folder').text()).toContain('/磁盘/Photos')") },
      { file: /src\/files\/snapshot\/TimeMachineOverlay\.test\.ts$/, re: exactLine("props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: 'Photos', folderLabel: '/磁盘/Photos', ...props },") },
      { file: /src\/files\/snapshot\/TimeMachineOverlay\.test\.ts$/, re: exactLine("expect(w.find('.tm-bar-folder').text()).toContain('/磁盘/Photos')") },
      { file: /src\/files\/snapshot\/TimeMachineOverlay\.test\.ts$/, re: exactLine("expect(w.emitted('select')?.[0]?.[0]).toBe('/DATA/.snapshots/20260730T143000Z_manual_x/Photos')") },
      // 同一行文本重复出现 5 次(148/160/172/192/203),exactLine 天然覆盖每一处重复。
      { file: /src\/files\/snapshot\/TimeMachineOverlay\.test\.ts$/, re: exactLine("props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: 'Photos', folderLabel: '/磁盘/Photos' },") },
      { file: /src\/files\/snapshot\/TimeMachineOverlay\.test\.ts$/, re: exactLine('volume-uuid="u-data" mount-point="/DATA" rel-path="Photos" folder-label="/磁盘/Photos"') },
      { file: /src\/files\/snapshot\/TimeMachineOverlay\.vue$/, re: exactLine('// /Photos/2024 打开时间机器、进去后被扔回卷根还得一层层点回来。卡片展示的就是当前') },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("files.currentPath = '/DATA/Photos'") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("files.currentPath = '/DATA/.snapshots/snap1/Photos'") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("expect(s.browseInfo).toEqual({ mount: '/DATA', snapshotName: 'snap1', relPath: 'Photos' })") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("useFilesStore().currentPath = '/DATA/.snapshots/snap1/Photos'") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("restoreMock.mockResolvedValue({ restored_path: '/DATA/Photos/a.jpg.restored-1' })") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("await s.restore([{ path: '/DATA/.snapshots/snap1/Photos/a.jpg' }])") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("expect(useToast().msg).toContain('/DATA/Photos/a.jpg.restored-1')") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("restoreMock.mockResolvedValue({ restored_path: '/DATA/Photos/a.restored-1' })") },
      { file: /src\/files\/stores\/snapshotBrowse\.test\.ts$/, re: exactLine("expect(useToast().msg).toContain('/DATA/Photos/a.restored-1')") },
      // dropEntries.test.ts:'photo.jpg' 是拖拽上传测试里的通用示例文件名(与 video.mp4/
      // notes.txt 同一 fixture),不是相册 app —— 对 Photos 模块的点名注释已被 T14 的
      // manifest PATCH 改掉,这两行是纯粹的示例文件名,保留。
      { file: /src\/files\/upload\/dropEntries\.test\.ts$/, re: exactLine("fileEntry('photo.jpg', '/Folder/photo.jpg'),") },
      { file: /src\/files\/upload\/dropEntries\.test\.ts$/, re: exactLine("expect(rels).toEqual(['Folder/.hidden', 'Folder/notes.txt', 'Folder/photo.jpg', 'Folder/video.mp4'])") },
      { file: /src\/files\/util\/snapshotPath\.test\.ts$/, re: exactLine("expect(parseSnapshotBrowsePath('/DATA/.snapshots/snap1/Photos/2024')).toEqual({") },
      { file: /src\/files\/util\/snapshotPath\.test\.ts$/, re: exactLine("mount: '/DATA', snapshotName: 'snap1', relPath: 'Photos/2024',") },
      { file: /src\/files\/util\/snapshotPath\.test\.ts$/, re: exactLine("it('有相对路径就拼上', () => { expect(liveVolumePath('/DATA', 'Photos/2024')).toBe('/DATA/Photos/2024') })") },
      { file: /src\/files\/util\/snapshotPath\.test\.ts$/, re: exactLine("await expect(resolveExitTarget({ mount: '/DATA', snapshotName: 's1', relPath: 'Photos/2024' }, dirExists))") },
      { file: /src\/files\/util\/snapshotPath\.test\.ts$/, re: exactLine(".resolves.toBe('/DATA/Photos/2024')") },
      { file: /src\/files\/util\/snapshotPath\.test\.ts$/, re: exactLine("expect(dirExists).toHaveBeenCalledWith('/DATA/Photos/2024')") },
      { file: /src\/files\/util\/snapshotPath\.test\.ts$/, re: exactLine("expect(parseSnapshotsContainerPath('/DATA/Photos')).toBeNull()") },
      { file: /src\/files\/util\/snapshotPath\.test\.ts$/, re: exactLine("it('取相对卷根的路径', () => { expect(relPathUnderMount('/DATA', '/DATA/Photos/2024')).toBe('Photos/2024') })") },
      { file: /src\/files\/util\/snapshotPath\.test\.ts$/, re: exactLine("it('容忍两侧末尾斜杠', () => { expect(relPathUnderMount('/DATA/', '/DATA/Photos/')).toBe('Photos') })") },
      { file: /src\/files\/util\/snapshotRestore\.test\.ts$/, re: exactLine("const restore = vi.fn().mockResolvedValue({ restored_path: '/DATA/Photos/a.jpg.restored-1' })") },
      { file: /src\/files\/util\/snapshotRestore\.test\.ts$/, re: exactLine("item: { path: '/DATA/.snapshots/snap1/Photos/a.jpg' },") },
      { file: /src\/files\/util\/snapshotRestore\.test\.ts$/, re: exactLine("expect(restore).toHaveBeenCalledWith({ volume_uuid: 'u-data', snapshot: 'snap1', path: 'Photos/a.jpg' })") },
      { file: /src\/files\/util\/snapshotRestore\.test\.ts$/, re: exactLine("expect(r).toEqual({ ok: true, restoredPath: '/DATA/Photos/a.jpg.restored-1' })") },
      { file: /src\/files\/util\/snapshotRestore\.test\.ts$/, re: exactLine("item: { path: '/DATA/Photos/a.jpg' }, info: INFO, listVolumes: async () => VOLS, restore: async () => ({}),") },
      // en_us.base.ts / raidLevels.ts:raidLevel1Usecase 的英文原文,zh_cn.base.ts 的中文孪生值
      // (2026-08-05 SP7-P8b:两个 locale 主文件已改名 *.base.ts —— 内容原地未动,只是
      //  多了 3 行合并出口 zh_cn.ts/en_us.ts。下面所有 locale 例外的 file 正则跟着改名,
      //  **词表一个字没放宽**,匹配的还是同样那几行。)
      // (照片库、个人 NAS、启动卷)已经是既有白名单 —— 这是同一条 RAID 用途说明的英文侧,
      // 与相册 app 无关(brief 指定保留面)。
      { file: /src\/i18n\/en_us\.base\.ts$/, re: exactLine("raidLevel1Usecase: 'Photo library, personal NAS, boot volumes',") },
      { file: /src\/storage\/util\/raidLevels\.ts$/, re: exactLine("usecase: 'Photo library, personal NAS, boot volumes',") },
      // avatar.test.ts:'photo.WEBP' 是头像上传扩展名判断的通用示例文件名。
      { file: /src\/settings\/util\/avatar\.test\.ts$/, re: exactLine("expect(isAllowedImageFile('photo.WEBP', 'application/octet-stream')).toBe(true)") },
      // Files.test.ts:同 snapshot 系列,'Photos' 全部是举例用的普通文件夹名。
      { file: /src\/views\/Files\.test\.ts$/, re: exactLine("router.push('/files/NimoOS-HD/Photos'); await router.isReady()") },
      { file: /src\/views\/Files\.test\.ts$/, re: exactLine("router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Photos'); await router.isReady()") },
      { file: /src\/views\/Files\.test\.ts$/, re: exactLine("const w = await mountFiles('/DATA/Photos')") },
    ],
  },
  {
    word: 'gallery',
    re: /gallery/i,
    allow: [
      { file: /src\/files\/util\/protect\.ts$/, re: /\/DATA\/Gallery|'Gallery'/ },
      { file: /src\/files\/util\/icons\.ts$/, re: /Gallery/ },
      { file: /src\/settings\/util\/migrateBrowse\.ts$/, re: /Gallery/ },
      { file: /src\/settings\/panels\/AppsPanel\.vue$/, re: /Gallery/ },
      { file: /src\/home\/grid\/defaultLayout\.ts$/, re: /\/DATA\/Gallery/ },
      { file: /src\/i18n\/(zh_cn|en_us)\.ts$/, re: /Gallery/ },
      // E6:Vue2 逐字移植的路径归一(应用导入时的目录归一化),/DATA/Gallery 是
      // LocalStorage 开机自建的系统目录,与相册功能无关,是保留面。
      { file: /src\/apps\/util\/importNormalize\.ts$/, re: /\/DATA\/Gallery/ },
      // T14:以下全部是上面这些"Gallery=系统默认文件夹"实现文件各自的**测试镜像**,
      // 练的是同一条已经被判定为保留面的代码路径,不是相册 app。整行精确匹配。
      { file: /src\/apps\/util\/importNormalize\.test\.ts$/, re: exactLine("['/pictures', 'myapp', '/DATA/Gallery'],") },
      { file: /src\/apps\/util\/importNormalize\.test\.ts$/, re: exactLine("['/photo', 'myapp', '/DATA/Gallery'],") },
      { file: /packages\/service\/src\/samba\.test\.ts$/, re: exactLine("{ id: 1, path: '/DATA/Documents' }, { id: 2, path: '/DATA/Gallery' },") },
      { file: /packages\/service\/src\/samba\.test\.ts$/, re: exactLine("expect(res).toEqual([{ id: 1, path: '/DATA/Documents' }, { id: 2, path: '/DATA/Gallery' }])") },
      { file: /src\/files\/util\/clipboard\.test\.ts$/, re: exactLine("await copyText('/NimoOS-HD/Gallery/x.jpg')") },
      { file: /src\/files\/util\/clipboard\.test\.ts$/, re: exactLine("expect(copied).toBe('/NimoOS-HD/Gallery/x.jpg')") },
      { file: /src\/files\/util\/icons\.test\.ts$/, re: exactLine("expect(iconNameFor({ name: 'Gallery', is_dir: true })).toBe('folder-pictures')") },
      { file: /src\/files\/util\/protect\.test\.ts$/, re: exactLine("expect(PROTECTED).toEqual(['AppData', 'Documents', 'Downloads', 'Gallery', 'Media'])") },
      { file: /src\/home\/components\/FolderTile\.test\.ts$/, re: exactLine("const w = mount(FolderTile, { props: mk('Gallery', '/DATA/Gallery') })") },
      { file: /src\/home\/components\/FolderTile\.test\.ts$/, re: exactLine("expect(w.text()).toContain('Gallery')") },
      { file: /src\/home\/components\/GridItem\.click\.test\.ts$/, re: exactLine("const item: LayoutItem = { id: 'i', kind: 'folder', key: 'Gallery', path: '/DATA/Gallery', c: 1, r: 1, w: 1, h: 1 }") },
      { file: /src\/home\/components\/GridItem\.click\.test\.ts$/, re: exactLine("expect(router.push).toHaveBeenCalledWith({ path: '/files', query: { path: '/DATA/Gallery' } })") },
      { file: /src\/home\/composables\/useOpenAction\.test\.ts$/, re: exactLine("openItem({ id: 'i', kind: 'folder', key: 'Gallery', path: '/DATA/Gallery', c: 1, r: 1, w: 1, h: 1 } as LayoutItem)") },
      { file: /src\/home\/composables\/useOpenAction\.test\.ts$/, re: exactLine("expect(router.push).toHaveBeenCalledWith({ path: '/files', query: { path: '/DATA/Gallery' } })") },
      { file: /src\/settings\/panels\/AppsPanel\.test\.ts$/, re: exactLine("expect(w.findAll('.set-app-row')[2].text()).toContain('/Documents & Downloads & Gallery & Media')") },
      { file: /src\/settings\/util\/migrateBrowse\.test\.ts$/, re: exactLine("'/media/Backup/Gallery', '/media/Backup/Media',") },
      { file: /src\/settings\/util\/migrateBrowse\.test\.ts$/, re: exactLine("it.each(['AppData', 'Documents', 'Downloads', 'Gallery', 'Media', '.docker', '.containerd'])(") },
    ],
  },
  {
    word: 'search',
    re: /search/i,
    allow: [
      { file: /src\/apps\/stores\/installedApps\.ts$/, re: /filterStoreApps|searchInput/ },
      // 2026-08-05(SP7-P8b):两个 locale 主文件改名 *.base.ts,路径跟着改。
      { file: /src\/i18n\/(zh_cn|en_us)\.base\.ts$/, re: /appsStoreSearch/ },
      // composeSettings.ts:'DAC_READ_SEARCH' 是 Linux capability 常量名(compose
      // cap_add/cap_drop 白名单的一项),与搜索功能无关。
      { file: /src\/apps\/util\/composeSettings\.ts$/, re: exactLine("'DAC_READ_SEARCH',") },
      // widget-kit.css:第三方桌面小组件开发指南里的示例 JS 代码片段(读 iframe 的
      // location.search 取 theme/lang 参数),是给第三方开发者看的用法说明,与
      // NimoOS-Search 服务无关。
      { file: /public\/widget-kit\.css$/, re: exactLine('*     const q = new URLSearchParams(location.search)') },
      // T14 复审:原来这里按"文件+子串"(query.search|searchInput|...)豁免 StorePage.vue
      // 整个文件——等于对文件里任何一行含这些子串的内容开洞,包括在这些行后面追加真实
      // AI/Search 泄漏也照样放行(同 T6.5 复审 Critical 抓到的 搜索/照片 那个洞是一类
      // 问题)。收紧为整行精确匹配:StorePage.vue 是应用商店的分类/作者/关键字过滤器
      // (spec §3.1 三个深链参数之一),与被删除的 NimoOS-Search 服务/SearchDialog.vue
      // 无关,9 处全部逐字摘自源码。
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('// 深链三参(spec §3.1):?category= / ?author= / ?search=,单一事实源=路由 query') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine("const search = computed(() => (typeof route.query.search === 'string' && route.query.search) || '')") },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('const searchInput = ref(search.value)') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('watch(searchInput, (v) => {') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine("if ((v || '') === search.value) return") },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('router.replace({ query: { ...route.query, search: v || undefined } })') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine("watch(search, (v) => { if (v !== searchInput.value) searchInput.value = v })") },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('const shown = computed(() => filterStoreApps(items.value, search.value))') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('const showFeatured = computed(() => category.value === ALL && author.value === ALL && !search.value)') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('<label class="store-search">') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('<input v-model="searchInput" type="search" :placeholder="t(\'appsStoreSearch\')" />') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('.store-search { flex: 1 1 200px; }') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('.store-search input {') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('.store-search input:focus { border-color: var(--accent-soft-bd); }') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('.store-search input::placeholder { color: var(--fg-muted); }') },
      // StorePage.test.ts:同一功能的测试镜像(6 处命中,4 条不重复的行文本——两行各自
      // 重复出现两次,exactLine 天然覆盖两处)。
      { file: /src\/apps\/views\/StorePage\.test\.ts$/, re: exactLine("await w.get('.store-search input').setValue('jelly')") },
      { file: /src\/apps\/views\/StorePage\.test\.ts$/, re: exactLine("expect(replace).toHaveBeenCalledWith({ query: { search: 'jelly' } })") },
      { file: /src\/apps\/views\/StorePage\.test\.ts$/, re: exactLine("it('?search= 生效时前端过滤;点卡片进详情', async () => {") },
      { file: /src\/apps\/views\/StorePage\.test\.ts$/, re: exactLine("routeQuery.search = 'jelly'") },
      // findIndex / findLastIndex 等标准库方法名里没有 search;binarySearch 之类若出现须显式登记
      // pnpm-lock.yaml(根目录 + 内嵌的 packages/service):第三方依赖名/resolution/
      // integrity 哈希里含 "search" 子串纯属噪声(@codemirror/search 等)——这是自动生成
      // 内容,不是手写代码,"整行精确匹配"在这里起不到"防止夹带真实泄漏"的作用(锚点会
      // 随依赖升级漂移),改用"这一行长得像 pnpm-lock 的包名/resolution/version/specifier
      // 记录行"的形状规则。只豁免这一个词,photo/gallery/transcript/wiki 在 lockfile 里
      // 仍然报(见下方 parser 的窄口径对比)。
      { file: /(^|\/)pnpm-lock\.yaml$/, re: PNPM_LOCK_LINE },
    ],
  },
  { word: 'speaker', re: /speaker/i, allow: [] },   // 拆完应零命中,留着当哨兵

  // ── T6.5:中文软禁词 ──────────────────────────────────────────────────
  // 搜索/照片/转录 三个字面上比硬禁词常见,已实测在本仓存在合法用法(见各自
  // allow 注释的 grep 证据),按纪律「禁止放宽词表消除误报」只能精确白名单。
  //
  // 复审 Critical(2026-08-04):最初这三个词的 allow 有的按「文件 + 键名子串」
  // (如 /appsStoreSearch/、/raidLevel1Usecase/)、有的按「文件 + 单字/短词」
  // (如 StorePage.vue 整体 /搜索/)豁免 —— 两种写法都等于"对整行甚至整个文件开洞":
  // 只要在被豁免的那一行(哪怕只是追加内容)混入真实 AI 泄漏,旧写法照样放行。
  // 复审用两条构造样本复现了这个洞:
  //   - raidLevel1Usecase 值改成"照片库、个人 NAS、启动卷(这里的照片会自动生成向量做相似检索)"
  //     ——/raidLevel1Usecase/ 只看键名,不管值写了什么,永远放行。
  //   - StorePage.vue 插入"// 商店页新增语音搜索:...(接入 Nimo 大模型做语义排序)"
  //     ——整文件通配的 /搜索/ 照样放行这一整行,包括后面那句真泄漏。
  // 改法:全部换成 exactLine() 整行精确匹配(见下方定义)。行内任何增删都会让匹配
  // 失效、退回"未豁免",不会带着新增泄漏一起被放行。两条构造样本已重新验证:
  // 收紧前放行、收紧后正确命中(证据见 oss/forbidden.test.mjs 与 task-6.5-report.md)。
  {
    word: '转录',
    re: /转录/,
    allow: [
      // zh_cn.ts:663/678/682 —— RAID 级别文案的来源说明("逐字转录自
      // RaidDetailPanel.vue/raidUtils.js"),是文档意义上的"抄录/转写",
      // 与音频转录(AI)功能无关。已用 grep 核实:这三行是本仓 转录 出现
      // 在 zh_cn.ts 里唯二不属于 audio* 转录键的地方。逐行精确匹配,不是关键词。
      { file: /src\/i18n\/zh_cn\.base\.ts$/, re: exactLine('// 逐字转录自 NimoOS-UI RaidDetailPanel.vue L267-290(levelFaultTolerance/levelReadSpeed/levelWriteSpeed,按 level 0/1/5/6)') },
      { file: /src\/i18n\/zh_cn\.base\.ts$/, re: exactLine('// read/write 为该表原始 1-5 评分(5、4),转录为评分文本。') },
      { file: /src\/i18n\/zh_cn\.base\.ts$/, re: exactLine("// desc:raidUtils.js 源文件中 desc 字段本身即占位字符串(如 'RAID 0 Description'),逐字转录(非我方发明)") },
    ],
  },
  {
    word: '照片',
    re: /照片/,
    allow: [
      // raidLevel1Usecase:RAID 用途说明("照片库、个人 NAS、启动卷"),与相册 app 无关
      // (brief 指定保留面)。锚定整行(键名+值),不是只锚键名 —— 见上方复审 Critical 的复现证据。
      { file: /src\/i18n\/zh_cn\.base\.ts$/, re: exactLine("raidLevel1Usecase: '照片库、个人 NAS、启动卷',") },
      // ImageViewer 是通用图片文件查看器(Files 区),"照片"在这里是"图片内容"的泛称,
      // 不是被剥离的 Photos 相册 app。--media-overlay-shadow 同一 token 只被这里消费(已 grep 核实)。
      { file: /src\/files\/viewers\/ImageViewer\.vue$/, re: exactLine('瓦片接缝会在照片上显出白色网格细线(真机截图实证过);去掉后缩放会触发重绘,无缝。 */') },
      { file: /src\/styles\/theme\.css$/, re: exactLine('/* 媒体(照片/视频)上方浮层的投影:内容颜色不可控,白图上纯白浮层会隐形,') },
    ],
  },
  {
    word: '搜索',
    re: /搜索/,
    allow: [
      // appsStoreSearch:应用商店筛选框(brief 指定保留面),与 NimoOS-Search 服务无关。锚定整行。
      { file: /src\/i18n\/zh_cn\.base\.ts$/, re: exactLine("appsStoreSearch: '搜索应用…',") },
      // StorePage 这三行注释是"应用商店按关键字过滤"语义,与 AI 语义搜索无关。逐行精确匹配,
      // 不是给整个文件的"搜索"二字开洞 —— 见上方复审 Critical 的复现证据。
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('// 搜索输入:250ms 防抖(Vue2 同款)后写 query;外部 query 变化(后退)回灌输入框') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('// 分类/作者是后端参数:query 变化即重拉;搜索纯前端不重拉') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('// 推荐带只在「未过滤未搜索」的首屏语境显示——过滤/搜索时列表就是用户要的答案,带子是噪音') },
      { file: /src\/apps\/views\/StorePage\.test\.ts$/, re: exactLine("it('搜索输入 250ms 防抖后 replace 路由 query(前端过滤,深链)', async () => {") },
      { file: /src\/apps\/views\/StorePage\.test\.ts$/, re: exactLine("it('Featured 带只在 无搜索+全部分类+全部来源 时显示', async () => {") },
      // Files.vue:粘贴上传的"焦点在输入框(重命名/搜索等)"是 Files 区自己的文件名过滤输入框,
      // 不是被删除的 SearchDialog/NimoOS-Search。
      { file: /src\/views\/Files\.vue$/, re: exactLine('// 焦点在输入框(重命名/搜索等)时不抢浏览器默认粘贴;剪贴板只有文字时静默忽略。') },
    ],
  },
  // 智能:brief 点名的候选软禁词,但全仓 grep 核实后目前没有找到非 AI 的合法用法
  // (2026-08-04:src/home/components/SearchDialog.vue、MediaViewer.vue、audioTranscripts.ts、
  // zh_cn.ts/zh_cn.sp9.ts 里全部出现都属于要剥离的 AI 功能)。仍然放 SOFT 而不是 HARD——
  // 「智能」是通用词,未来任何非 AI 功能(如磁盘/网络的"智能识别")都可能合法用到它,
  // 一旦出现应加白名单而不是被迫放宽词表。当前 allow 为空,等同哨兵:任何命中都是待办。
  { word: '智能', re: /智能/, allow: [] },
  // 语义搜索:brief 特别警告"语义"单字词命中 51 个 CSS token 注释文件,禁止收单字。
  // 这里只收词组"语义搜索"。当前全仓 0 命中(sp7-photos/sp8-ai 合并前语义搜索功能还
  // 没有落地到 New-UI),先占位当哨兵,防止未来该功能被引入后悄悄漏进开源包。
  { word: '语义搜索', re: /语义搜索/, allow: [] },
  {
    word: 'ai',
    // 词边界:不碰中文、chain、main、Chairman。
    //
    // 第二轮复审 Important:第一轮的 alt2(要求 "AI" 前面不挨字母,即只认 "AI" 打头的
    // camelCase/PascalCase,如 AIService)漏掉了 "AI" 结尾的驼峰,比如 sendToAI/chatAI/
    // openAIRequest —— sendToAI 恰恰是本仓真实存在、且正是这次要清除的 AI 链路的核心
    // 函数名(src/home/composables/useOpenAction.ts:54 等 8 处),守卫必须抓到它。
    //
    // 改成两条子规则:
    //   alt1(大小写不敏感):独立词 ai/AI/Ai/aI,前面不挨字母、后面不挨"小写"字母 ——
    //        覆盖裸词 "ai"/"AI"、"AI 总结"、"AI-powered"、"AIService"(后面跟大写 S 不算挨着)。
    //   alt2(首字母 A 强制大写,第二个字母不区分大小写):前面挨一个小写字母、后面不挨
    //        小写字母 —— 覆盖"驼峰词尾的 Ai/AI",如 sendToAI、chatAI、openAIRequest,
    //        以及第三轮复审补的 widgetAiSend、pathFromAiPattern、askNimoAi(本仓 i18n 键/
    //        函数名的真实书写形态是首字母大写、第二个字母小写的 "Ai",不是全大写 "AI")。
    //
    // ★★★ 警告(两轮复审都在这条上栽过,后人别再栽):alt2 的第一个字母 A 必须
    // 强制大写(写成 `A[Ii]`),绝不能写成 `[Aa][Ii]`、也不能对这个 alt 整体套 /i。
    // src/settings/util/timezones.ts 里有真实存在的 Asia/Shanghai、Asia/Dubai —— 那里的
    // "ai" 是全小写,前面接小写字母、后面到词尾。一旦 alt2 允许首字母小写 a,
    // Shanghai/Dubai/Thai/bonsai 会立刻全部变成误报,而它们是本仓合法字符串。
    // 首字母强制大写这条边界,就是把"合法英文单词里的 ai"和"人为造的 Ai/AI 缩写"分开的
    // 唯一依据 —— 后人若想"顺手统一大小写",请先重新读这段注释再动手。
    //
    // 代价:const AIRPORT=1 这类"AI"后面直接接大写字母的全大写标识符仍会被 alt1 命中
    // (机场号码/常量名一类罕见样式)。按纪律「词表宁可宽」接受这个已知的假阳性,不为它
    // 收窄规则去冒漏掉真实 AI 代码的风险。
    re: /(?<![A-Za-z])[Aa][Ii](?![a-z])|(?<=[a-z])A[Ii](?![a-z])/,
    allow: [
      // E5:局部变量 ai = anchorIndex(files.ts 的 shift 选区)
      { file: /src\/files\/stores\/files\.ts$/, re: /\bai\b\s*[=<,)\]]|\[lo,\s*hi\]/ },
      // T14:APPLICATION_ILLUSTRATOR 的 'ai' 是 Adobe Illustrator 的文件扩展名(与 'eps'
      // 同一常量),文件分类表的单一真源,与 AI 功能无关。
      { file: /src\/files\/util\/fileCategories\.ts$/, re: exactLine("export const APPLICATION_ILLUSTRATOR = ['ai', 'eps']") },
      // T14:三个文件夹图标 svg 内嵌了 base64 编码的位图(旧版图标资源的 data URI 兜底),
      // "ai" 只是 base64 字符集里随机出现的子串,与 AI 功能无关。按文件精确限定 ——
      // folder-root.svg 的整条 xlink:href 数据 URI 在同一行;folder-hdd.svg/folder-usb.svg
      // 是数据 URI 换行后的纯 base64 续行(除字母数字 +/= 外不含任何其他字符,真实代码
      // 不会写出这种形状的行,不会误伤)。
      { file: /src\/files\/assets\/icons\/folder-root\.svg$/, re: /data:image\/png;base64,/ },
      { file: /src\/files\/assets\/icons\/folder-hdd\.svg$/, re: /^\s*[A-Za-z0-9+/=]+\s*$/ },
      { file: /src\/files\/assets\/icons\/folder-usb\.svg$/, re: /^\s*[A-Za-z0-9+/=]+\s*$/ },
      // pnpm-lock.yaml:同 search 词条的注释 —— 自动生成文件,用"像不像 pnpm-lock 记录行"
      // 的形状规则,而不是逐字锚定(依赖升级就作废)。
      { file: /(^|\/)pnpm-lock\.yaml$/, re: PNPM_LOCK_LINE },
    ],
  },
  {
    word: 'parser',
    re: /\bparser\b/i,
    allow: [
      // T14:pnpm-lock.yaml 里真实存在的 7 个第三方包,名字含 "parser" 但都是知名的
      // 通用解析器库(Babel/CSS/引擎协议/CLI 参数),与私有的 NimoOS-Parser(RAG 索引
      // 服务)毫无关系。刻意不用 search/ai 那条"像不像 lockfile 记录行"的宽口径 ——
      // 这里按**包名精确枚举**,如果 lockfile 里哪天真的出现 nimoos-parser 或任何其他
      // 新的 "*-parser" 依赖,这条正则不会匹配到它,仍然会被抓到人工看一眼。
      { file: /(^|\/)pnpm-lock\.yaml$/, re: /@babel\/(helper-string-)?parser\b|@csstools\/css-(parser-algorithms|color-parser)\b|(?:engine|socket)\.io-parser\b|yargs-parser\b/ },
    ],
  },
  { word: 'wiki', re: /wiki/i, allow: [] },
  {
    word: 'folderPermission',
    re: /folderPermission/i,
    allow: [
      // E4:成员文件夹授权,与 AI 无关,保留面
      { file: /.*/, re: /UserFolderPermission/ },
    ],
  },
]

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB —— 超限的文件跳过,但留痕(见 scanTree)
const SNIFF_BYTES = 8 * 1024 // 只抽查开头 8KB 判二进制,足够且快

// T14(B2):这两条"预期内跳过"文案原来只在 scanTree() 里出现一次、又在 export.mjs 的
// isExpectedSkip() 里被第二次逐字硬编码比对——两处措辞必须逐字相同,改一个标点(比如
// 顿号变逗号)就会让 export.mjs 的分类静默滑到"预期外→fatal"那一侧,而且没有任何测试
// 会发现(tree.test.mjs 跑导出用的是 --skip-guard,根本不经过这段分类逻辑)。提成
// 具名常量 + 导出的 isExpectedSkip(),让 scanTree 和 export.mjs 共享同一份字面量 ——
// 结构上排除"两处文案漂移"这种可能性,而不是指望人工保持同步。
export const SKIP_REASON_SYMLINK = '符号链接,未跟随、未扫描'
export const SKIP_REASON_BINARY = '判定为二进制,未扫描'

/**
 * 判断一条 __skipped__ 记录是"预期内"(二进制/符号链接,只警告、不算失败)还是
 * "预期外"(读取失败/stat 失败/超过体积上限/目录读取失败,仍然 fatal)。
 * 精确匹配 SKIP_REASON_SYMLINK / SKIP_REASON_BINARY 这两条固定文案;其余一律落入
 * "预期外"——这也让 scanTree 未来新增的任何跳过原因默认按"预期外"处理,不会因为
 * 这里没跟着更新而被静默放过。
 */
export function isExpectedSkip(excerpt) {
  return excerpt === SKIP_REASON_SYMLINK || excerpt === SKIP_REASON_BINARY
}

/**
 * 二进制启发式:开头 8KB 里出现 NUL 字节就判定为二进制。比按扩展名判断可靠 ——
 * 这棵树里确实混着真二进制(例如 src/home/apps/icons/*.png),按 utf8 硬读会
 * 产生乱码触发的垃圾误报,还慢。
 */
function looksBinary(buf) {
  const n = Math.min(buf.length, SNIFF_BYTES)
  for (let i = 0; i < n; i++) {
    if (buf[i] === 0) return true
  }
  return false
}

function allowed(rules, relPath, line) {
  return rules.some((r) => r.file.test(relPath) && r.re.test(line))
}

/** 扫一段文本。返回命中列表(空数组 = 干净)。 */
export function scanText(relPath, text) {
  const out = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const { word, re } of HARD) {
      if (re.test(line)) out.push({ word, line: i + 1, excerpt: line.trim().slice(0, 160) })
    }
    for (const { word, re, allow } of SOFT) {
      if (re.test(line) && !allowed(allow, relPath, line)) {
        out.push({ word, line: i + 1, excerpt: line.trim().slice(0, 160) })
      }
    }
  }
  return out
}

/**
 * 递归扫整棵树。排除法,不是白名单法:除 `.git`/`node_modules`/`dist` 目录外,
 * **每个文件都读**。跳过绝不静默 —— 每次跳过都在返回数组里追加一条
 * `word: '__skipped__'` 的记录,消费方(Task 14 的导出流程)一旦看到这个
 * 哨兵词就知道该文件没有被内容扫描过,得自己决定要不要额外处理。
 * 纪律 #3 的精神是「守卫烂掉的标准路径是静默豁免」——不留痕的跳过等于悄悄开了个口子。
 *
 * 跳过的情形:
 *   ① 符号链接(不跟随,不管指向文件还是目录) —— 第二轮复审 Important:本仓
 *      `.claude/worktrees/NimoOS-Service` 是一个指向目录的符号链接。
 *      `readdirSync(..., {withFileTypes:true})` 内部用 lstat,`Dirent.isDirectory()`
 *      对符号链接返回 false(不跟随),会落进"文件"分支;而 `fs.statSync`/
 *      `fs.readFileSync` 默认跟随符号链接,对指向目录的链接跟读会直接抛
 *      `EISDIR` 崩掉整个扫描。改成先用 `Dirent.isSymbolicLink()` 识别并跳过 ——
 *      符号链接指向的真实内容如果本就在树内,会通过它的真实路径被正常扫到,
 *      不会因为跳过链接本身而漏扫。
 *   ② 体积超过 MAX_BYTES 的
 *   ③ 开头 8KB 判定为二进制的(looksBinary)
 *   ④ 任何 stat/read/readdir 失败的(权限问题、竞态删除等)—— 兜底 try/catch,绝不静默丢帧。
 *      第三轮复审顺带加固:目录本身的 `readdirSync` 之前没包 try/catch,子目录若在遍历
 *      途中被并发删除、或没有读权限,会像符号链接那次一样让整个 scanTree 崩掉;现在也
 *      计入 __skipped__。
 */
export function scanTree(rootDir) {
  const findings = []
  const skip = (rel, excerpt) => findings.push({ file: rel, word: '__skipped__', line: 0, excerpt })

  const walk = (dir) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch (err) {
      skip(path.relative(rootDir, dir) || '.', `目录读取失败,未扫描:${err.message}`)
      return
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name)
      const rel = path.relative(rootDir, abs)

      if (e.isSymbolicLink()) {
        skip(rel, SKIP_REASON_SYMLINK)
        continue
      }
      if (e.isDirectory()) {
        if (e.name === '.git' || e.name === 'node_modules' || e.name === 'dist') continue
        walk(abs)
        continue
      }

      let stat
      try {
        stat = fs.statSync(abs)
      } catch (err) {
        skip(rel, `stat 失败,未扫描:${err.message}`)
        continue
      }
      if (stat.size > MAX_BYTES) {
        skip(rel, `超过 ${MAX_BYTES} 字节上限,未扫描`)
        continue
      }

      let buf
      try {
        buf = fs.readFileSync(abs)
      } catch (err) {
        skip(rel, `读取失败,未扫描:${err.message}`)
        continue
      }
      if (looksBinary(buf)) {
        skip(rel, SKIP_REASON_BINARY)
        continue
      }
      for (const f of scanText(rel, buf.toString('utf8'))) findings.push({ file: rel, ...f })
    }
  }
  walk(rootDir)
  return findings
}

// ─── T15:dist 扫描 —— 构建产物是第二道后备闸,判据与源码树扫描不同 ─────────────
//
// 为什么不能直接把 scanTree 指向 dist/ 了事(T15 实测过,64 条命中,逐条溯源见
// task-15-report.md):
//   1. **这道门防的是"我方内容(i18n 值/注释)被打进 bundle",不是审查第三方库内部
//      写了什么。** 源码树扫描(scanText/scanTree,原样不动,仍是主防线)已经在
//      "我方代码进产物之前"拦过一轮;dist 扫描的职责窄得多——只确认"打包这一步
//      没有意外夹带我方泄漏",不是重新审查 pdf.js/xlsx 这些第三方库的实现。
//   2. **ASCII 软禁词(photo/gallery/search/ai/parser/wiki/speaker/folderPermission）
//      是通用英文子串**,压缩产物里第三方库类名(pdf.js 的 `Parser` 类)、内嵌数据
//      (xlsx 的 Excel 97 宏函数表 `GALLERY.AREA`）、MIME 常量
//      (`image/vnd.ms-photo`)、Rollup 生成的两字母压缩导入别名、SVG 里内嵌的
//      base64 二进制数据,在这个规模的产物里撞上通用英文子串统计上几乎不可避免。
//      T15 实测:64 条命中里硬禁词 0、中文软禁词 0,64 条全部是 ASCII 软禁词。
//      **那两个 0 恰恰是"我方内容漏进 bundle"唯一会亮的信号类别**——我方注释/文案
//      以中文为主,硬禁词是无歧义的品牌/技术栈标记,压缩后的第三方 ASCII 代码不会
//      偶然含中文或我方品牌词。
//   3. **exactLine() 那套逐行白名单在压缩产物里结构性失效。** 构建后整个文件常常
//      挤在第 1 行(如 `assets/index-*.css`),路径也被内容哈希重命名
//      (`public/widget-kit.css` 变成 `widget-kit.css`,白名单的 file 正则直接失配)。
//      继续按"文件+整行"配白名单,等价于把白名单退化成"只要出现在这个哈希文件名
//      的产物里就放行"——那正是本项目明令禁止的"放宽词表"的另一种写法,而且哈希
//      文件名每次构建都变,维护上也不可持续。
//
// 因此:dist 扫描只用 **HARD(全部,不分中英文)+ SOFT 里 word 含中文字符的条目**,
// 明确排除纯 ASCII 的 SOFT 词。判断"是不是中文词"用 /[一-龥]/ 测试 word 本身,
// 不硬编码词名单——以后 HARD/SOFT 加新词,这条判据自动跟着分类,不会漏。
// HARD/SOFT 词表定义本身一个字不动;这里只是消费方,用不同的过滤条件读它们。

/** word 本身含中文字符即判定为"中文词"。不硬编码词名单,词表增删自动跟着分类。 */
function isChineseWord(word) {
  return /[一-龥]/.test(word)
}

/**
 * dist 专用内容白名单:压缩产物里"文件+行号"定位失效,改成**内容子串精确匹配**——
 * 只认逐字摘自源码的字符串本身,不看文件/行号。这两条是 T15 实测到的、当前 dist
 * 构建里仅有的两处"我方合法内容撞上中文软禁词"(均已在源码树白名单里逐行豁免过,
 * 见 forbidden.mjs SOFT 表 照片/搜索 词条的注释):
 *   - raidLevel1Usecase 的 RAID 用途说明("照片库…"),与相册 app 无关。
 *   - appsStoreSearch 的应用商店筛选框占位符,与 NimoOS-Search 服务无关。
 * 与源码树 exactLine() 同一条纪律:任何增删都会让子串匹配失效、退回"未豁免",
 * 不会带着新泄漏一起被放行。命中后**只把这段子串本身替换成等长空白再继续扫描
 * 同一行的其余内容**——不是跳过整行,因为压缩产物里一行可能是几十 KB 的整个模块,
 * 跳过整行会连同一行里其余的真实泄漏一起放过。
 */
const DIST_ALLOW = [
  '照片库、个人 NAS、启动卷',
  '搜索应用…',
]

/**
 * T15(b):品牌/私有路径 grep 制度化——原来只在 T15 报告里手工跑过一次、免疫压缩
 * (查的是服务名/路由前缀这种整串字面量,不是英文子串,不会被压缩打散),现在固定
 * 成 dist 扫描的一部分,命中即 fatal。`nimoos-search|nimoos-parser|nimoos-photos|
 * nimoos-ai` 四个私有服务名不会与合法内嵌的 `@nimotech/nimoos-service` 共享包
 * 混淆——"service" 不是这四个词里任何一个的子串,也不是它们的父串。
 * `photos_data|qdrant|ollama|immich|wikiRoot|192\.168\.1\.115` 已经在 HARD 表里
 * 覆盖,这里不重复收;只新增 HARD/SOFT 都没有的两类信号:私有服务名字面量、
 * `/v1/(ai|search|photos|parser)/` 这四个被剥离服务的网关路由前缀。
 */
const BRAND_RE = /nimoos-search|nimoos-parser|nimoos-photos|nimoos-ai|\/v1\/(ai|search|photos|parser)\//

// dist 专属的体积上限:MAX_BYTES(2MB)是为源码树的手写文件定的,真实构建产物里
// 单个 vendor chunk 轻松超过它(本仓实测 index-*.js 主 chunk 3.4MB、Excel 查看器
// chunk 1.6MB)——如果沿用 2MB 上限,恰恰是内容最多、最该扫的大文件被当成"预期外
// 跳过"而 fatal,逼着人每次都去扩体积上限,形同虚设。dist 扫描的输入是构建产物,
// 数量少(几十到上百个 chunk),体积大但读入内存毫无压力,直接放宽到 64MB——
// 真出现比这更大的单文件才值得让人停下来看一眼。
const DIST_MAX_BYTES = 64 * 1024 * 1024

/**
 * 扫构建产物(dist/)。与 scanTree 结构相同(二进制/符号链接跳过、留痕、
 * __skipped__ 哨兵、isExpectedSkip 复用),但判词逻辑是上面这套专属规则
 * (不是 scanText),体积上限也单独放宽(DIST_MAX_BYTES,理由见上)。
 * 品牌 grep 命中打 word: 'brand-leak'。
 */
export function scanDist(rootDir) {
  const words = [...HARD, ...SOFT.filter((s) => isChineseWord(s.word))]
  const findings = []
  const skip = (rel, excerpt) => findings.push({ file: rel, word: '__skipped__', line: 0, excerpt })

  const walk = (dir) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch (err) {
      skip(path.relative(rootDir, dir) || '.', `目录读取失败,未扫描:${err.message}`)
      return
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name)
      const rel = path.relative(rootDir, abs)

      if (e.isSymbolicLink()) {
        skip(rel, SKIP_REASON_SYMLINK)
        continue
      }
      if (e.isDirectory()) {
        walk(abs)
        continue
      }

      let stat
      try {
        stat = fs.statSync(abs)
      } catch (err) {
        skip(rel, `stat 失败,未扫描:${err.message}`)
        continue
      }
      if (stat.size > DIST_MAX_BYTES) {
        skip(rel, `超过 ${DIST_MAX_BYTES} 字节上限,未扫描`)
        continue
      }

      let buf
      try {
        buf = fs.readFileSync(abs)
      } catch (err) {
        skip(rel, `读取失败,未扫描:${err.message}`)
        continue
      }
      if (looksBinary(buf)) {
        skip(rel, SKIP_REASON_BINARY)
        continue
      }

      const text = buf.toString('utf8')
      const lines = text.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // 只把已知合法子串本身"挖空"成等长空白,不跳过整行——压缩产物一行可能
        // 是几十 KB 的整个模块,跳过整行会放过同一行里其余的真实泄漏。
        let scanLine = line
        for (const allow of DIST_ALLOW) {
          if (scanLine.includes(allow)) scanLine = scanLine.split(allow).join(' '.repeat(allow.length))
        }
        for (const { word, re } of words) {
          if (re.test(scanLine)) findings.push({ file: rel, line: i + 1, word, excerpt: line.trim().slice(0, 160) })
        }
        if (BRAND_RE.test(scanLine)) {
          findings.push({ file: rel, line: i + 1, word: 'brand-leak', excerpt: line.trim().slice(0, 160) })
        }
      }
    }
  }
  walk(rootDir)
  return findings
}
