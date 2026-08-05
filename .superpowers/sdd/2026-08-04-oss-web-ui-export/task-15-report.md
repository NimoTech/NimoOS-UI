# Task 15 报告:正式出包 + 四道门 + 零历史 + 幂等 + 眼验

状态:**BLOCKED**(卡在第五道「构建产物禁词扫描」——红,详见下方,未自行放宽词表,等待用户裁决)。
除此之外的所有步骤均已跑完并附带实际命令输出。

## 0. 出包前三件小事(已提交)

commit `9a3b974` chore(oss): 出包前三处收尾(README Node 版本、lockfile 白名单已知盲区记账、MediaViewer 主题例外注释)

1. `oss/files/README.md`:「Node.js ≥ 20」→「Node.js ≥ 20.19(vite 7 engines 要求
   `^20.19.0 || >=22.12.0`,20.0-20.18 装完会撞引擎错误)」。只改冻结分身,`manifest.mjs`
   对 README.md 的 REPLACE 条目本来就不钉 `privateSha256`,不需要联动改。
2. `oss/forbidden.mjs`:在 `PNPM_LOCK_LINE` 的注释里补了一段「已知盲区」——这条"像不像
   lockfile 记录行"的形状规则只看行形状不看包名语义,如果哪天真引入一个整包名恰好含
   ai/search 语义的私有包(如假设的 `@nimotech/nimoos-search`),会被一并放行。
3. `oss/files/MediaViewer.vue`:给 artplayer 的 `theme: '#007AE5'` 补了
   `// theme-exception: ...` 注释。

提交前跑了 `npx vitest run oss/`:**113/113 全绿**。
提交后 `git status --porcelain` 只剩 3 个 design-export 删除态(符合预期,未被误动)。

## 1. 出包(`node oss/export.mjs`)

```
[oss] 1/6 前置检查
[oss]   New-UI 9a3b9747 · Service 7e84566b
[oss] 2/6 取源
[oss] 3/6 应用清单(DELETE 30 · REPLACE 4 · PATCH 150)
[oss] 4/6 内嵌共享包
[oss] 5/6 泄漏守卫
[oss]   ⚠ 1 个文件未做内容扫描(二进制/符号链接,预期内,不计入泄漏判定):
[oss]     ⚠ 未扫描:src/home/apps/icons/settings.png —— 判定为二进制,未扫描
[oss]   零真实泄漏命中(1 个预期内跳过已记录,见上方与 .export-report.txt)
[oss] 6/6 落盘
[oss] 完成 → /home/nimo/NimoTech/NimoOS-Web
```
六步全过,预期内的 1 条二进制跳过警告如期出现,EXIT=0。

## 2. 四道门

```
$ pnpm install     → 依赖安装成功(axios/vue/pinia/reka-ui/... 一览无缺)
$ pnpm test 2>&1 | tail -10
 Test Files  366 passed (366)
      Tests  3157 passed (3157)
TEST_EXIT=0

$ pnpm exec vue-tsc --noEmit
TSC_EXIT=0

$ pnpm build
...(chunk size 警告,Vite 正常噪音,非错误)
✓ built in 11.64s
BUILD_EXIT=0
```
三个 EXIT 全 0,测试文件数/例数与私有侧口径一致(366/3157)。

## 3. 第五道:构建产物禁词扫描 —— **红**(BLOCKED,未自行处理)

```
$ node -e "...scanTree('/home/nimo/NimoTech/NimoOS-Web/dist')..."
→ 64 条命中,EXIT=1
```
按词分布:`search:14 ai:27 parser:20 wiki:1 gallery:1 photo:1`(全部是 SOFT 词,**零 HARD 词命中**)。

我没有触碰 `oss/forbidden.mjs` 的任何白名单/词表——按要求原样报告。但做了尽调,排除了
"真的夹带了 AI/相册/搜索功能代码" 的可能性:

- **零真实品牌/私有路径泄漏**:对 `dist/` 全量 grep `nimoos-search|nimoos-parser|nimoos-photos|
  nimoos-ai|/v1/(ai|search|photos|parser)/|photos_data|qdrant|ollama|immich|wikiRoot|
  192\.168\.1\.115` —— **零命中**。唯一命中「nimoos」字面量的两处是
  `<title>NimoOS</title>`(index.html)和 `@nimotech/nimoos-service: initService() not ca[lled]`
  错误信息(共享包本来就该内嵌保留,不在剥离范围)。
- 64 条命中逐个抽样溯源,全部是**第三方库内部产物,不是我方代码**:
  - `parser`(20 条):pdf.js 真实存在的 `Parser` 类(`grep -c "class Parser\|new Parser"`
    命中 2 处于 `pdf.worker.min-*.mjs`),与 NimoOS-Parser 服务无关。
  - `gallery`(1 条):SheetJS/xlsx 库内嵌的 Excel 宏函数名字面量表(`GALLERY.AREA`、
    `GALLERY.3D.BAR` 等,Excel 97 宏函数名),与相册 app 无关。
  - `photo`(1 条):某文件类型嗅探库(file-type 一类)的 MIME 常量
    `image/vnd.ms-photo`、`image/vnd.adobe.photoshop`。
  - `wiki`(1 条):同一个 xlsx 库的内部字符串 `valueformat:1:text-wiki`(SheetJS 自己的
    格式标签,`text-wiki` 是它的內部命名),与 NimoOS-Wiki 服务无关。
  - `ai`(27 条):绝大多数是 Rollup/Vite 生成的两字母压缩导入别名(如
    `import{... ai as w ...}`),纯粹是压缩巧合;个别来自 lodash/codemirror 压缩代码里的
    正则/变量片段。
- 结论:**这是守卫工具本身的一处盲区,不是真实泄漏**——`oss/forbidden.mjs` 的整行扫描是
  为手写源码设计的,从未在这个流水线里针对"压缩后的第三方 vendor bundle"验证过(T15 是
  第一次真正跑这一步)。压缩产物里第三方库的类名/常量/压缩别名撞上通用软禁词,在统计上
  几乎不可避免。

**按你的要求,这里我不做任何决定**(不加白名单、不改词表、不判定"可以忽略")。留给你三选一:
1. 判定这 64 条确系噪音,允许发布,同时给 T15 补一条"构建产物扫描的已知局限"记账;
2. 要求给 `dist/` 扫描单独定制更严格的白名单(按文件+第三方库签名放行);
3. 要求改变第五道的扫描策略(比如只扫 `dist/` 里我方写的部分,或跳过压缩产物扫描,只信
   源码扫描 + 手工品牌词 grep)。

## 4. 零历史 / 无 remote / 幂等

```
$ git rev-list --count HEAD
1
$ git log --stat | head -5
commit d1b5db4f7d61b3bde2f104c51be89bda0d415603
Author: Tiansanchuan <1312528051@qq.com>
Date:   Tue Aug 4 09:13:55 2026 +0800
    NimoOS Web UI
$ git remote -v
(空)
$ grep -c . .export-report.txt
6
$ git check-ignore -v .export-report.txt
.gitignore:20:.export-report.txt	.export-report.txt
```
全部符合预期。

幂等性:重跑 `node oss/export.mjs`(六步照旧全过,同样 1 条预期内二进制跳过),之后
`git status --porcelain` 为空、`git rev-list --count HEAD` 仍是 1。**注意**:导出脚本会
整个重建 `/home/nimo/NimoTech/NimoOS-Web`(含 `node_modules`/`dist` 在内的产出树全部推倒
重来,只保留 `.git` 历史为 1 条提交这件事本身),所以幂等验证之后我重新跑了一遍
`pnpm install` 才能继续起 dev server —— 这是导出脚本的设计使然,不是异常。

## 5. 手工抽查

```
$ grep -ri "相册\|nimo ai\|transcript\|qdrant\|ollama\|immich\|192.168.1.115\|\.wiki\.md\|SearchDialog" \
  /home/nimo/NimoTech/NimoOS-Web --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist
(无输出,exit 1)
```
零命中。

## 6. 眼验(dev server :5299,无头 Chromium,fake token 绕过路由守卫 + 拦截所有 `/v1/*`
请求模拟"无后端会话",与真机隔离,只验布局/入口,不验数据)

逐条结论(暗+亮色均截):

1. **桌面首屏** —— 看到了:时钟/存储/GPU/网络/处理器/最近事件 6 个系统小组件 + 4 个
   系统文件夹瓦片(Documents/Downloads/Media/Gallery)+ 右侧 5 个应用图标
   (文件/设置/AppStore/KVM/存储)。**无搜索胶囊、无 AI 组件、无照片磁贴**。内容行下方
   有明显留空区域(在 AddPanel 编辑态截图里能看到 2 行空网格占位,内容不重叠不溢出)。
   截图:`01-desktop-dark.png` / `01-desktop-light.png`
2. **Dock** —— 看到了:文件/存储/KVM/AppStore 4 项 + 一个"所有…"启动器图标(展开全部
   应用,非独立 app 项)。无相册、无 AI。同上两张截图底部。
3. **设置 rail** —— 看到了:通用/存储/网络/应用/终端与日志/系统状态,**共 6 项**,
   没有「文件夹权限」。截图:`03-settings-rail-dark.png` / `03-settings-rail-light.png`
   （对照源码 `src/settings/util/tabs.ts` 的 `RAIL_TABS = SETTINGS_TABS.slice(0, 6)`，
   `account`/`developer` 不在 rail 上,经由用户卡片单独入口)。
   **账号 tab 里的成员文件夹授权 —— 未能取证**:导航到 `/settings/account`
   (`05-account-dark.png`)只看到"本机所有者账户"卡片(改密/改头像/退出);
   `MembersSection`(成员列表入口)在源码里是 `v-if="isAdmin"` 且其数据来自后端
   `/v1/users` 一类接口,而成员文件夹授权面板(`MemberFoldersView`)又要求先点开一个
   真实成员(`activeMember`)。这条链路完全依赖真实多用户会话数据,在本次「拦截所有
   API」的纯前端隔离验证环境下到不了,不是代码被删——只是没有数据可显示这个入口。
4. **添加面板** —— 看到了:组件/应用/文件夹**三个 tab**,当前在"组件"tab,列出
   时间/存储/网络/最近事件/处理器/GPU 六种小组件,**没有"照片"tab**。
   截图:`04-addpanel-dark.png` / `04-addpanel-light.png`
5. **音频预览 —— 未能取证**:MediaViewer 是从文件列表里点开一个真实音频文件触发的
   (`viewer.openItem(...)`),而文件列表本身依赖 `GET /v1/folder` 返回真实目录内容,
   还牵涉 `loadRoots()`/卷显示名解析等前置链路。在"拦截全部 API 模拟无后端"的隔离环境
   下无法在不手编一整条虚构 fixture 链(违反本仓「手编 fixture 复发坑」的教训)的前提下
   可靠地把这一屏跑起来,故未取证。建议:若要补这一项,需要一台真实跑着网关+至少一个
   音频文件的设备。
6. **点设置磁贴 → `/settings`,点虚机磁贴 → `/kvm`** —— 已用**真实点击**(非直接改
   URL)验证:
   ```
   after clicking 设置 tile, url = http://127.0.0.1:5299/app/#/settings/general
   after clicking KVM tile, url = http://127.0.0.1:5299/app/#/kvm
   ```
   都不是白屏、不是 `/#/legacy`。
   附带观察(不做判定,仅记录):直接访问 `/kvm` 在暂无虚拟机数据时会自动弹出「创建新
   虚拟机」向导弹窗(`06-kvm-dark.png`/`06-kvm-light.png`);已确认 `document.documentElement
   .dataset.theme === 'light'` 且 `body` 背景色确实是浅色 `rgb(247,245,239)`(见
   `diag.mjs` 输出),但创建向导弹窗卡片本身在两套主题下视觉上是同一种深色卡片 ——
   这是 KVM 模块既有设计(SP9-P6 已实机验收关账),不在本次导出任务的评判范围内,只如实
   记录观察到的现象。
7. **⌘K / Ctrl+K 无反应** —— 已验证:同一 fresh page,按键前后 `page.url()` 与整页
   HTML 字节长度**完全一致**(`urlChanged=false domChanged=false`),说明没有任何东西
   被打开或改变。截图:`07a-cmdk-before-{dark,light}.png` / `07b-cmdk-after-{dark,light}.png`
   两两比对肉眼也看不出差异。
8. **手机断点(390×844)** —— 看到了:纵向单列小组件、底部 dock 5 个图标(文件/存储/
   KVM/AppStore/全部启动器),**无照片磁贴**,只有主题切换按钮、**没有添加/编辑入口**
   (对照源码注释"≤720px 手机启动器为只读:隐藏添加/编辑入口"符合预期)。
   截图:`08-mobile-launcher-dark.png` / `08-mobile-launcher-light.png`

截图目录:`/home/nimo/NimoTech/NimoOS-New-UI/.superpowers/sdd/2026-08-04-oss-web-ui-export/shots/`
(共 16 张:01/02×2/03/04/05/06/07a/07b × dark+light,08 × dark+light)

## 7. 私有侧收尾

`git status --porcelain` 目前只剩 3 个 design-export 删除态(未动),三处 T15 小修补已经
在开工前提交为 `9a3b974`,不需要再提交。

## 遗留疑问 / 待裁决

1. **第 3 节的构建产物扫描红灯是本报告唯一的阻塞项**,需要你三选一裁决(见第 3 节末尾)。
2. 账号 tab 的成员文件夹授权、音频预览两屏因为纯前端隔离环境缺数据/缺文件而未能取证,
   如需补齐需要一台真实跑着网关(和至少一个音频文件)的设备。
3. KVM 创建向导弹窗在两套主题下卡片视觉一致(深色)——只是观察记录,不在本次任务评判
   范围,如果需要单独立项复核可以另开小票。

**不做验收判定,以上均为取证陈述,最终是否可以发布由你决定。**

---

# 修复轮追加(裁决执行:选项 3 变体——重新定义第五道门的判据)

控制器裁决:64 条命中不是真泄漏(硬禁词 0、中文软禁词 0、三类结构性成因逐条溯源清楚),
**但不接受"就此放行、只记账"这个选项** —— 要求把判据本身改对(选项 2/3 混合):
dist 扫描换一套自己的判据(硬禁词 + 中文软禁词,排除 ASCII 软禁词),不碰 HARD/SOFT 词表,
不放宽源码树扫描口径。以下是这一轮的完整落地记录。commit `6cec8d0`。

## 1. 新 dist 扫描判据:`scanDist()`(`oss/forbidden.mjs`)

三点理由(逐字写进了源码注释,不重复展开):
1. 这道门防的是"我方内容(i18n 值/注释)被打进 bundle",不是审查第三方库内部写了什么。
2. ASCII 软禁词是通用英文子串,压缩产物里第三方库类名/内嵌数据/压缩别名/base64 撞上它们
   统计上几乎不可避免;硬禁词 0、中文软禁词 0 这两个"0"恰恰是"我方内容漏进 bundle"唯一
   会亮的信号类别(我方文案以中文为主,硬禁词是无歧义标记)。
3. `exactLine()` 逐行白名单在压缩产物里结构性失效——整个文件常挤在第 1 行,路径也被
   内容哈希重命名,继续按"文件+整行"配白名单等价于把白名单退化成"这个哈希文件名就放行",
   是"放宽词表"的另一种写法。

实现:`scanDist(rootDir)` 只用 `HARD`(全部,不分中英文)+ `SOFT` 里 `word` 含中文字符
的条目(`isChineseWord()` 用 `/[一-龥]/` 判断,不硬编码词名单,词表增删自动跟着分类)。
HARD/SOFT 词表定义本身一个字没动——`scanDist` 只是新的消费方,用不同的过滤条件读它们。

**白名单机制也换了**:压缩产物里"文件+行号"定位失效,改成 `DIST_ALLOW`——内容子串精确
匹配,只认逐字摘自源码的字符串本身,不看文件/行号。命中后**只把这段子串本身挖空成等长
空白再继续扫描同一行的其余内容**,不是跳过整行——压缩产物一行可能是几十 KB 的整个模块,
跳过整行会连同一行里其余的真实泄漏一起放过(这条已经用「关键用例」单测钉死,见下)。
当前 `DIST_ALLOW` 只有两条(T15 实测到的、当前 dist 构建里仅有的两处合法内容撞中文软
禁词):`照片库、个人 NAS、启动卷`(raidLevel1Usecase)、`搜索应用…`(appsStoreSearch)。

**顺带修的一个真 bug**:源码树的 `MAX_BYTES`(2MB)是为手写文件定的,套到 dist 上会把
真实的大 vendor chunk(本仓主 chunk 3.4MB、Excel 查看器 chunk 1.6MB)当成"预期外跳过"
判 fatal——恰恰是内容最多、最该扫的文件被跳过。新增 `DIST_MAX_BYTES = 64MB` 专供
`scanDist` 使用,不动 `MAX_BYTES`(源码树扫描不受影响)。

## 2. 品牌/私有路径 grep 制度化(T15 报告第 3 节提到的手工 grep)

`scanDist` 内置 `BRAND_RE = /nimoos-search|nimoos-parser|nimoos-photos|nimoos-ai|\/v1\/(ai|search|photos|parser)\//`,
命中标 `word: 'brand-leak'`,与其他 leak 一视同仁地 fatal。`photos_data|qdrant|ollama|
immich|wikiRoot|192\.168\.1\.115` 已在 HARD 表覆盖,这里不重复收;只新增 HARD/SOFT 都
没有的两类信号(私有服务名字面量、四个被剥离服务的网关路由前缀)。已验证不会误伤合法
内嵌的 `@nimotech/nimoos-service`(`nimoos-service` 不含 `nimoos-search/parser/photos/ai`
任一子串)。

新增 `oss/scan-dist.mjs` 作为第五道门的固定 CLI 入口(替代原来一次性的 `node -e "..."`
内联脚本),用法:`node oss/scan-dist.mjs <dist目录>`。

## 3. 单元测试(`oss/dist-scan.test.mjs`,17 例)

覆盖:硬禁词照常抓、中文软禁词照常抓、四类真实噪音形态(pdf.js 的 `Parser` 类、xlsx 的
`GALLERY.*`/MIME 常量、Rollup 压缩别名 `ai`/`search`、`speaker`/`folderPermission` 纯
ASCII 哨兵)不再命中、**关键用例**(白名单文本与真实泄漏挤在同一压缩行时,真实泄漏仍必须
被抓到——验证挖空子串而非跳过整行)、品牌 grep 四种路由前缀 + 私有服务名命中且不误伤
`@nimotech/nimoos-service`、体积上限单独放宽（3MB 大文件不被跳过）、二进制/符号链接仍
留痕跳过。

## 4. 必做的负向验证(两个方向都用真实 `pnpm build` 实测,非单测模拟)

**正向必抓**:备份 `NimoOS-Web/src/App.vue`(`cp`,非 git),在模板里插入一个隐藏 `<span>`,
文本含真实泄漏(中文软禁词「转录」):

```html
<span style="display:none">LEAK_PROBE_这里混进了一句真实转录内容测试_TAG</span>
```

`pnpm build` → `BUILD_EXIT=0` → 确认编译进了主 chunk(`grep -c 转录 dist/assets/index-Cv-kYtdp.js` → `1`)→
跑 `node oss/scan-dist.mjs`:

```
✗ assets/index-Cv-kYtdp.js:18 [转录] `,ne=r.needIndent?...
[scan-dist] 命中 1 处。
EXIT=1
```

**被抓到。** `cp` 还原 `App.vue`,`diff` 确认与备份逐字节一致。

**反向必放过**:同样手法插入纯 ASCII 软禁词噪音:

```html
<span style="display:none">LEAK_PROBE_photo gallery search ai parser wiki speaker folderPermission grid demo_TAG</span>
```

`pnpm build` → `BUILD_EXIT=0` → 确认编译进 `dist/assets/index-BiHBVOBo.js` → 跑
`node oss/scan-dist.mjs`:

```
[scan-dist] 零命中(180 个预期内跳过已记录,见上方)
EXIT=0
```

**未被抓到,如期。** 为证明这不是"判据从来抓不到任何东西"的假阴性,而是刻意收窄:直接对
含探针内容的那一行跑私有仓的**全量**词表判断(`scanText`,HARD+全部 SOFT,不限中英文),
命中 10 处——`photo/gallery/search/speaker/ai/parser/wiki/folderPermission`(注入的 8 个
ASCII 词全部命中)外加 `照片/搜索`(该行本身混有 raidLevel1Usecase/appsStoreSearch 的合法
中文内容,这两个是已知白名单目标,不是新泄漏)。证明:同一行内容,用旧的不区分语言的
判据**会**命中这些 ASCII 词,新判据**不会**——是策略调整生效,不是探针从未真正进入 bundle。
`cp` 还原 `App.vue`,`diff` 确认逐字节一致;`git status --porcelain`(NimoOS-Web)全程为空。

## 5. 顺手小改善(e):`--exclude node_modules`

`oss/export.mjs` 落盘步骤的 `rsync -a --delete` 补了 `--exclude node_modules`(不排除
`dist`——理由写进了代码注释:陈旧构建产物不该被当成"这次的构建"去过第五道门)。新增
`oss/export-rsync.test.mjs`:构造一个已存在 node_modules 哨兵文件 + 陈旧 dist 哨兵文件的
`--out` 目录,重新导出后断言 node_modules 哨兵文件还在、dist 哨兵文件被清空。真实流水线里
也验证过:两次连续 `node oss/export.mjs`(幂等性检查那步)之后 `ls node_modules` 仍然存在,
不需要重新 `pnpm install`。

## 6. 波形颜色证据(d):组件级测试,取到证据(非真机截图)

私有仓的 `MediaViewer.vue` 与导出产物 `oss/files/MediaViewer.vue` 模板不同(私有版还留着
`waveSpeakerMode`/`speakerColor`,导出版已被 T10 拆掉),而且相对导入(`./ViewerShell.vue`
等)只有在真正导出的产物树里才能正确解析——因此新增 `oss/media-wave.test.mjs`:`beforeAll`
用与 `tree.test.mjs` 同一套机制(临时导出一份产物树,放在仓库内部 `oss/.tmp-media-wave-test/`
而不是系统 `/tmp`——Vite 的模块服务器默认只服务 `fs.allow` 范围内的文件,系统 `/tmp` 在
范围外,直接 `import()` 会被拒绝),再动态 `import()` 里面真实的 `src/files/viewers/MediaViewer.vue`。

按项目已有教训(CLAUDE.md 记忆:"New-UI 按钮 hover 变白坑"——jsdom 不会完整跑 CSS 级联,
`getComputedStyle` 对 `var()` 链不可靠),**没有**依赖 `getComputedStyle` 去读最终颜色值,
而是三层拼起来的解析链断言:
1. 挂载渲染:桩一个音频文件(mock `service.file.fileUrl` + 桩 `HTMLMediaElement.prototype.play`
   兜住 jsdom 未实现自动播放导致的未捕获异常),断言 `.np-wave-bar` 确实渲染出多个竖条节点
   (不是 0 个/挂载失败)。
2. 静态读取该组件编译后的 `<style>` 源码,确认 `.np-wave-bar` 引用 `var(--wave-none)`、
   `.np-wave-bar.played` 引用 `var(--accent)`(两个不同 token,证明"有颜色变化"而非两态同色)。
3. 静态读取导出产物的 `theme.css`,确认 `--wave-none` 在 `:root` 与
   `:root[data-theme="light"]` 两套主题块里都有定义。

4 个断言全部通过(见下方最终验收输出)。**如实说明局限**:这不是像素级截图,是"挂载渲染 +
token 引用链 + 两套主题都有值"三层证据,证明这条颜色链路结构上是通的;浏览器最终渲染
(抗锯圆角/透明度叠加等视觉细节)仍需要真机复核——若要补齐纯视觉的最后一环,需要一台真实
跑着网关且有至少一个音频文件的设备,与前任报告第 6 节第 5 条记录的缺口一致,归入下方
遗留项。

## 7. 重跑正式出包 + 五道门完整输出(commit 6cec8d0,工作树干净,未带 --allow-dirty-oss)

```
$ cd NimoOS-New-UI && git status --porcelain
 D "design-export/Audio Speaker Segmentation.html"
 D design-export/audio-waveform-design-kit.html
 D design-export/design-final.html

$ node oss/export.mjs
[oss] 1/6 前置检查
[oss]   New-UI 6cec8d00 · Service 7e84566b
[oss] 2/6 取源
[oss] 3/6 应用清单(DELETE 30 · REPLACE 4 · PATCH 150)
[oss] 4/6 内嵌共享包
[oss] 5/6 泄漏守卫
[oss]   ⚠ 1 个文件未做内容扫描(二进制/符号链接,预期内,不计入泄漏判定):
[oss]     ⚠ 未扫描:src/home/apps/icons/settings.png —— 判定为二进制,未扫描
[oss]   零真实泄漏命中(1 个预期内跳过已记录,见上方与 .export-report.txt)
[oss] 6/6 落盘
[oss] 完成 → /home/nimo/NimoTech/NimoOS-Web

$ cd NimoOS-Web && pnpm install   # (二次安装,验证 node_modules 未被清空后仍能正常装)
Done in 3.5s

$ pnpm test 2>&1 | tail -6
 Test Files  366 passed (366)
      Tests  3157 passed (3157)
TEST_EXIT=0

$ pnpm exec vue-tsc --noEmit; echo "TSC_EXIT=$?"
TSC_EXIT=0

$ pnpm build 2>&1 | tail -4
✓ built in 21.00s
BUILD_EXIT=0

$ cd NimoOS-New-UI && node oss/scan-dist.mjs /home/nimo/NimoTech/NimoOS-Web/dist 2>&1 | tail -3
[scan-dist] 零命中(180 个预期内跳过已记录,见上方)
SCANDIST_EXIT=0

$ cd NimoOS-Web && git rev-list --count HEAD
1
$ git remote -v
(空)
$ grep -c . .export-report.txt
6
$ git check-ignore -v .export-report.txt
.gitignore:20:.export-report.txt	.export-report.txt

$ grep -ri "相册\|nimo ai\|transcript\|qdrant\|ollama\|immich\|192.168.1.115\|\.wiki\.md\|SearchDialog" \
    . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist
(无输出,GREP_EXIT=1)
```

**五道门全绿**(TEST_EXIT=0、TSC_EXIT=0、BUILD_EXIT=0、SCANDIST_EXIT=0,加上手工抽查零命中
共五项)。测试文件数/例数(366/3157)与前一轮完全一致(判据调整只影响 dist 扫描,不影响
产出树本身)。

## 8. 幂等性(第二轮)

```
$ cd NimoOS-New-UI && node oss/export.mjs   # 六步照旧全过,同样 1 条预期内二进制跳过
$ cd NimoOS-Web && git status --porcelain
(空)
$ git rev-list --count HEAD
1
$ ls node_modules >/dev/null 2>&1 && echo "node_modules survived idempotent re-export"
node_modules survived idempotent re-export
```

幂等性干净(`git status --porcelain` 为空、历史仍是 1),且这一轮额外验证了 (e) 的效果在
真实流水线里生效(不只是单测):第二次导出后 `node_modules` 原样还在,不需要重新 `pnpm install`。

## 9. 私有侧全量测试门(oss/ + 全项目)

```
$ cd NimoOS-New-UI && npx vitest run oss/
 Test Files  6 passed (6)
      Tests  130 passed (130)

$ npx vitest run   # 全项目(含新增 4 个 oss 测试文件:dist-scan/media-wave/export-rsync + 既有)
 Test Files  358 passed (358)
      Tests  3208 passed (3208)
```
(命令为 `npx vitest run > log 2>&1; echo EXIT=$?`,`log` 里 0 处 fail/failed 字样,汇总行为
`358 passed (358)`/`3208 passed (3208)`,无跳过/无失败。)

`oss/` 从 113 例(前任交接时点)涨到 130 例:新增 `dist-scan.test.mjs`(含体积上限用例,
共 12 例)、`export-rsync.test.mjs`(1 例)、`media-wave.test.mjs`(4 例)、外加对既有
`forbidden.test.mjs` 无改动——3 个新测试文件、净增 17 例(113→130,与实测一致)。
全项目实测两个时间点都记了下来:加完 dist-scan+media-wave(还没加 export-rsync)时
`357 files / 3207 tests`;加完 export-rsync 之后(即当前状态)`358 files / 3208 tests`——
一条既有测试都没变红,全部是新增。

## 10. 私有侧收尾提交

```
$ git add oss/forbidden.mjs oss/export.mjs oss/dist-scan.test.mjs oss/export-rsync.test.mjs \
    oss/media-wave.test.mjs oss/scan-dist.mjs
$ git commit -m "feat(oss): dist 扫描定制判据(硬禁词+中文软禁词+品牌grep) + 波形色测试 + rsync 保留 node_modules"
[master 6cec8d0] ...
$ git status --porcelain
 D "design-export/Audio Speaker Segmentation.html"
 D design-export/audio-waveform-design-kit.html
 D design-export/design-final.html
```
只剩那 3 个本就不属于本任务、也不属于任何人的 design-export 删除态,未被误动。

## 11. 遗留项(更新)

1. 第 3 节原来的三选一阻塞项已解决(本轮修复轮)。
2. **音频预览的像素级视觉证据仍缺失**——本轮补的是组件级结构性证据(挂载渲染 + token 引用
   链 + 两套主题都定义),不是截图。如需最后一环像素级复核,需要一台真实跑着网关、且有
   至少一个音频文件的设备,与前任报告第 6 节第 5 条一致,建议一并处理。
3. 账号 tab 的成员文件夹授权眼验仍缺失(前任报告第 6 节第 3 条,未在本轮范围内重新尝试,
   原因不变:需要真实多用户会话数据)。
4. KVM 创建向导弹窗视觉观察(前任报告第 6 节第 6 条附带观察)——如前述,不在评判范围,
   仅记录。
5. `DIST_ALLOW` 目前只有 2 条(当前 dist 构建实测到的合法内容)。这是"精确白名单宁可细"
   纪律的产物,不是缺陷——如果未来 sp7-photos/sp8-ai 合流后出现新的合法中文软禁词内容被
   编译进 bundle,`scan-dist.mjs` 会如期报红,届时按同样纪律加新的精确子串,不是放宽判据。

**不做最终发布判定,以上均为取证陈述。**
