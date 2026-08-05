## Global Constraints

以下每条都适用于本期每个任务,不再逐任务重复。

- **工作区**:`/home/nimo/NimoTech/.sp7/NimoOS-New-UI`,分支 `sp7-photos`(基线 `a6e0493` = merge master 后)。Service 仓 `sp7-photos`@`a0cf09a`,**本期预期零改动**。
- **不合并 master、不跑 `./scripts/deploy.sh`**(用户 2026-08-03 硬约束:master 上不放 AI 与相册,要先发不含两块的快照版)。验收走已在跑的 dev server `:5277`。**5273 归 master、5288 归 SP8,勿占。**
- **不碰 Vue2 仓 `NimoOS-UI` 的产品代码**(只写 `docs/`)。特别是**不要往 `src/router/strangler.js` 加 `/photos` 行** —— 那会让快照版把 `/photos` 整页重定向进没有相册路由的新应用。
- **不碰 New-UI 主工作树** `/home/nimo/NimoTech/NimoOS-New-UI`(那里有 3 个 design-export 的 staged 删除,`checkout`/`stash` 会卷走)。
- **移植纪律**:界面严格 1:1 照 Vue2;Vue2 的 bug / 竞态 / 吞错**不照抄**,改成正确逻辑**并在代码里注释登记**。**禁止无关重构。**
- **保真移植的唯一权威是 Vue2 源,不是本计划书。** 本计划书给的每个数值(行号、档位、阈值、色值、文案)实施时都要回源复核;**发现本计划书与 Vue2 源冲突,以源为准并在 task report 里登记**(前几期有 1 条 Important 的根因就是计划书自己写错)。
- **颜色一律 token**(`var(--…)`,定义在 `src/styles/theme.css`,**两套主题块都要有值**)。`src/styles/color-guard.test.ts` 会扫,且**不剥 CSS 注释** —— 样式块注释里写字面 `#xxxxxx`/`rgba(...)` 也会判红,提到 Vue2 色值要用文字描述。`theme-exception` 的豁免窗口是**逐行状态机**,注释必须紧贴被豁免的那一条声明。
- **hover 特异性**:带 `.on`/`[data-on]`/`[data-active]` 变体的元素,变体必须自带 `:hover` 规则(本区已栽四次)。断言必须钉「胜出选择器含 `:hover`」,否则同优先级时源码顺序 tie-break 会静默通过。用 `src/photos/components/__tests__/cssCascade.ts` 自己算优先级。
- **i18n**:新键必须同时进 `src/i18n/zh_cn.ts` 与 `src/i18n/en_us.ts`,`src/i18n/parity.test.ts` 断言两文件键完全一致。**只追加不重排。** 中文文案以 Vue2 `src/assets/lang/zh_CN.json` 为准;JSON 里没有的(Vue2 组件内联硬编码英文)才自拟,自拟时在两个 locale 文件里加注释说明来源。
- **测试**:`vitest.setup.ts` 已把 `src/i18n` 单例装进 `config.global.plugins`,**测试文件不要另建 `createI18n(...)`**(会重复安装刷告警)。测试证据一律 `--reporter=verbose` 并数 `[Vue warn]` 条数(应为 0)—— 默认 reporter **不显示通过用例的 stderr**,上一期因此误判两次。测试里读 `.css` 文件一律用 `node:fs`(`?raw` 对 `.css` 恒返空串,读文件的守卫必须先断言取到的文本非空,否则整条守卫静默空转)。
- **每个任务只跑局部测试**(本任务触及的文件 + `pnpm exec vue-tsc --noEmit`);**全量只在整期收尾、交付前跑一次**。
- **计划书点名的不变量必须有断言锁住,并做变异验证**(临时改坏 → 确认变红 → 恢复)。
- **台账落 `.sp7/NimoOS-New-UI/.superpowers/sdd/2026-08-03-vue3-migration-sp7-p8a-settings-deeplinks/`**,收尾**不要删台账目录**(与 superpowers SDD 默认收尾步骤相反,这是本项目硬约定 —— SP7-P5 台账就是这么整个丢的)。

### 本期范围决策(用户 2026-08-03 拍板,须写回 spec)

| # | 决策 | 依据 |
|---|---|---|
| **D19** | **P8 拆 P8a / P8b。** P8a = 设置页 + 深链 + 错误态 + 杂项 + 台账,全在 `sp7-photos` 分支、零 master 改动、零 Vue2 仓改动。P8b(快照发布后)= 两个 cutover 触点 + 合流 + 部署 + 全区回归。 | 触点② 那行进 Vue2 master 会让不含相册的快照版 `/photos` 重定向到没有相册路由的新应用 ⇒ 快照坏掉 |
| **D20** | **桌面磁贴翻向(`useOpenAction.ts:10` 的 `SYS_ROUTE.photos`)推 P8b**,不在本期提前做。 | 单独做会让分支上桌面磁贴指向新相册、而 Vue2 深链仍走老 UI,两入口行为不一致,回退实测也做不完整 |
| **D21** | **上传子系统整块不做**(TUS 队列 683 行 js + 上传抽屉 196 + 文件卡 198 + 上传视图 978 + 上传顶栏 54 + DropZone 110,全部不迁),**不建 `/photos/upload` 路由**。 | 用户直接拍板。回源实证:上传**视图**那 1142 行本就是不可达死代码(见下方「回源实证」);抽屉那条真链用户明示不做。**spec §3 路由表的 `/photos/upload` 与 §5 P8 行的「上传视图/抽屉」须订正** |
| **D22** | **设置页底部的「Sign out」不迁。** | New-UI 已有全局登出(`src/settings/panels/AccountPanel.vue:167` → `useAuth().logout()`);Vue2 那颗自己手写清 4 个 localStorage 键 + 跳 `/logout`,与 New-UI 登出通道不一致。按偏离登记 |
| **D23** | **P5 挂账的 zh 三键英式空格保留原样**(`'{name} 的照片'` 读作「小明 的照片」不改)。 | 用户拍板「保留原样」,严格 1:1 |

### D21 的连带后果(已向用户申明,登记在此)

1. **SP9 转来的「清理本地待上传缓存」按钮无法接线** —— 它读的就是相册上传队列的 IndexedDB(`src/settings/panels/AppsPanel.vue:152-154` 的政策三「做样子」态)。**维持禁用+标注态,债务 D13 继续挂账,本期关不掉。**
2. **P1 挂账「`idle` 守卫换成真上传队列态」做不了** —— 没有队列可读。维持现状 + 登记。
3. **P8b cutover 之后,新相册没有任何上传入口。** 要往相册加照片只能走文件区拖进 `/DATA/Gallery` 或退回 Vue2 老相册。上传可后续单开一期补。

### 回源实证(实施时不必重查,但结论要写进代码注释/台账)

- **上传视图 1142 行是不可达死代码**:`activeNav === 'upload'` 才渲染 `PhotosUploadView`,但 ①`PhotosSidebar.vue` 的 `nav1`/`nav2` 无 `upload` 条目 ②`PhotosTimeline.vue:477` 的 `NAV_KEYS = ['albums','people','places','smart','favs','trash']` 不含 `'upload'`,故 `?view=upload` 也进不去 ③全仓 `grep "activeNav\s*=\s*'upload'"` 零命中。`PhotosDropZone` 已于 2026-07-07 注释停用(`PhotosTimeline.vue:13/56/1151`)。与 D17(archive 六环)同形态。
- **`photoset` 的 2 分钟过期清理归生产者侧**(`src/views/AI/Agent/services/openInApp.js:76-85`,从 key 名里解析时间戳),消费侧只做「读 → `removeItem` 一次性交接」。**spec §2 把它写在消费段是措辞不精确,须订正。** 载荷形状 `{ ids: string[] }`,key 前缀 `nimo:photoset:`。
- **`isConflict` 只有 1 处 live 调用点**(`src/photos/components/AlbumPickerDialog.vue:143`),不是开工 prompt 说的 3 处。
- **`photosPersonSubtitle` 死键已在 P7a 终审 Minor 8 删除**(`src/i18n/zh_cn.ts:847` 注释留证),开工 prompt 里那条已不成立。
- **共享包 photos 域已有本期需要的全部方法**:`getConfig` / `updateConfig` / `getStorage` / `getAbout` / `pruneCache` / `rebuildIndex` / `triggerScan` / `reclusterFaces`(`.sp7/NimoOS-Service/src/photos.ts:43/47/63/67/80/84/88/238`)。**本期零共享包改动。**
- **New-UI 至今零 query 深链处理**:`grep 'route.query'` 在 `views/Photos.vue`、`PhotosPeople.vue`、`PhotosPlaces.vue`、`PhotosAlbums.vue` 全部零命中,只有 `views/PhotosSearch.vue:56` 读自己的 `?q`。五式深链全部是新建。

---

