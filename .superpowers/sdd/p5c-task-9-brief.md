# SP8-P5c · Task 9 —— `SettingsView.vue` 下半(笔记根目录 + reka 迁移弹窗)

**本刀 = 把 T8 故意留空的下半插进去**,蓝本 `SettingsView.vue` 的这几块(**行号自己回源核,brief 会错**):
笔记区(约 `:66-124`:notesRoot 展示 + `openRootPicker` 折叠区 + `FolderBrowser` 接入 +
`onPick`/`dirProbe` 三档徽标 + 「仅指向」/「搬文件」两按钮 + 说明 note + 自动捕获开关)·
迁移确认弹窗(约 `:126-160`)· script 的 `notesSettings` / `rootPicker` / `dirProbe` / `migrating` /
`migrateAck` / `created()` / `browserRoots` / `openRootPicker` / `onPick` / `applyRoot` / `doMigrate` /
`closeMigrate` / `toggleAutoExtract`。

🔴 **本刀是本期最后一个内容刀**,做完只剩 T10(路由反转 + 收官)。

## 必读(按序,**不许跳**)

1. `.superpowers/sdd/p5c-common-constraints.md` —— **全文最新版**(已被协调者订正 26 次)。尤其
   §1.1 + **§1.3**、§3 的 **K1 / K7 / K17 / K27 / K29 / K30 / K34 / K35**、**§3.5 的 N16 / N21 + §3.6**、
   **§4.1(mock 层次,本刀是重灾区)**、**§4.3**、**§4.4**、§5.1、**§5.2(过期守卫)**、**§8.1 台账**、
   §9(**第七~第十条**)+ **§9.1 / §9.2 / §9.3(双向扫)**、**§12.4**、§10、§11、**§13**
2. `.superpowers/sdd/p5c-appendix-A-i18n.md` —— `aiKbSet*` 与通用键(**T1 已落地,不许新增**)
3. `.superpowers/sdd/p5c-appendix-D-classes.md` —— `kn-*` 段与 `.k-modal-*` 四类(**T2a 已搬,白名单 226**)
4. `.superpowers/sdd/p5c-fixtures/` —— `notes-settings.json` · `notes-dir-info-notes.json` · `wiki-candidates.json`
5. `.superpowers/sdd/p5c-plan.md` 的 **T9 节**
6. **先例(照它们抄,别自己发明)**:
   - `src/ai/knowledge/views/SettingsView.vue` + `SettingsView.test.ts`(**T8 的上半,你要在同一份文件里续写**)
   - `src/ai/knowledge/components/FolderBrowser.vue`(T3:`defineExpose({ reset })` 在这里)
   - `src/ai/knowledge/views/QueueView.vue` **`:190-208`** 与 `QueueView.test.ts` **`:127-130` 的 `withHost()`**
     (P5b 的 reka 弹窗 + **测试里在 body 备宿主**的唯一先例)
   - `src/ai/knowledge/views/IndexedFilesView.vue`(P5b 第二个 reka 弹窗)

**权威优先级:治理文件 + 附录 > 本 brief > 计划书。**
🔴 **本 brief 会出错**(T0 七处 · T3 一处 · T5 一处 · T6 六处 · T7 两处 · **T8 五处,其中 E-18 是「键名存在但语义不对、
照抄不报错却渲染错」**)—— **每个行号、每个键名自己回源双向核准**,核出错登记编号(上一个是 **E-21**)。

---

## 0. 起点

- 可写仓 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`,起点 **`7d6de6a`**(工作树干净)
- 三门基线(**T8 收官后评审复跑实测**):
  **`Test Files 326 passed (326)` / `Tests 3459 passed (3459)`** · `vue-tsc` 0 · `vite build` 0 · `.vue` **179**
- **本刀零新增文件**(在 T8 的两个文件里续写)→ 文件数仍 **326**、`.vue` 仍 **179**、`color-guard` **不变**
- 🔴 蓝本 `git -C /home/nimo/NimoTech/NimoOS-UI show main:src/views/AI/Knowledge/SettingsView.vue`(322 行)。
  **禁 `cat`/`Read` 那个仓的工作树;禁在那里 checkout / stash / 提交。**

---

## 1. 交付

**改**:`src/ai/knowledge/views/SettingsView.vue` · `src/ai/knowledge/views/SettingsView.test.ts`
**不新建、不改其它任何文件。** 🔴 尤其 `knowledge.scss`(T2a)· `knowledgeStyles.test.ts`(T8 已加中央守卫,**别再动**)·
`FolderBrowser.vue` / `folderBrowser.ts`(T3 已收官,**只 import,不改**)· `parser*`(T5/T6/T7)· `src/i18n/*` · **路由**(T10)。

---

## 2. 🔴 mock 层次(本刀是全期重灾区,§4.1)

| 你要 mock 的 | 形状 | 依据 |
|---|---|---|
| `service.notes.getSettings` / `putSettings` | 🔴 **camelCase `{ notesRoot, autoExtract }`,只有这两个字段** | `notes.ts:252-262` 走 `normalizeSettings`(`:131-137`)。**HTTP 层是 `notes_root`/`auto_extract`,而且还多带 `distill_roots` / `distill_daily_cap` / `background_model` 三个字段 —— `normalizeSettings` 把它们全丢掉了。** mock 写 snake_case 或多带字段都是错的 |
| `service.notes.dirInfo` | `{ exists: boolean, empty: boolean }`(包内 `!!` 归一) | `notes.ts:264-267` |
| `service.wiki.getCandidates` | 已归一化数组(空时 `[]`) | `wiki.ts:154-156` |
| `service.folder.getList`(经 `FolderBrowser`) | 🔴 **`unwrap()` 后的单层 `{ content: FolderEntry[] }`**,`FolderEntry = { name, path, is_dir }` | K28,T3 已定;**不是** fixture 里那个三层信封 |

⚠️ **`normalizeSettings` 的 `autoExtract: r.auto_extract !== false`** —— **`undefined` 归一成 `true`**。
蓝本 `data()` 默认值也是 `autoExtract: true`(约 `:206`)。**一致,照抄**,并**要有「后端漏字段」的用例**
(T8 评审的教训:只喂空串/正常值的边界用例是**假判别力**)。

🔴 **§4.4:三份 fixture 一律「抄进测试 + 注释标出处」,不许运行时读 `.superpowers/`**;
**抄完做程序化逐字节等价校验 + 变异验证**,贴输出。
🔴 **「同一方法在两个测试文件里被 mock 成不同形状」= red flag** —— 本刀会与 `FolderBrowser.test.ts` 共用
`service.folder.getList`,**自己比一遍**。

---

## 3. 逐条照抄要点

### 3.1 笔记区
- notesRoot 展示:`<code>{{ notesSettings.notesRoot || '/DATA/Notes' }}</code>` —— 🔴 **`|| '/DATA/Notes'` 兜底照抄**(N7 同族)。
- `openRootPicker()`(约 `:227-236`)**逐行照抄**:`open = !open`;**仅在打开时**清 `path = ''`、
  重置 `dirProbe = { state: '', migratable: false }`、调 `store.loadCandidates()`、
  `$nextTick(() => $refs.fb && $refs.fb.reset())` → Vue3 用 `nextTick()` + 模板 `ref` + `fb.value?.reset()`。
  ⚠️ **`loadCandidates()` 不传 `silent`**(治理交接项 #7:只有后台预取传 `silent`,用户主动路径不传)。
  ⚠️ Vue2 既有单测 `git show main:src/views/AI/Knowledge/__tests__/settingsViewRootPicker.spec.js`(38 行)
  描述了两条行为(**重开时清掉上次的 `path`** / **再点一次关闭不抛错**)—— **两条都要承接成用例**。
- **`onPick(path)` 的过期守卫**(约 `:238-249`):`path` 存下 → `dirProbe = { state:'loading', … }` →
  `await notesApi.dirInfo(path)` → 🔴 **`if (this.rootPicker.path !== path) return`**(蓝本自带注释
  「A later pick may have superseded this probe」)→ 置 `{ state:'done', migratable: !info.exists || info.empty }`;
  catch 里**同样有一次** `if (this.rootPicker.path === path)` 才置 `error`。**两处守卫都照抄。**
  🔴 **§5.2 + §9.1:回归测试必须走交错路径**(两次 `onPick` 交错,后发先回 → 断言 `dirProbe` 是后发那次的)。
  ⚠️ 本刀的守卫变量是**组件本地响应式 state**(`rootPicker.path`),不是模块级 —— **§9.1 的「两实例交错」这条
  自己判要不要做**:若判不需要,报告要写明理由(不是「跳过」,是「论证不适用」)。
- **三档徽标**:`dirProbe.state === 'loading'` → `.kn-badge[data-s="archived"]` `$t('Checking…')` ·
  `'done' && migratable` → `[data-s="curated"]` `$t('Empty folder · can migrate')` ·
  `'done' && !migratable` → `[data-s="draft"]` `$t('Not empty — point-to only')` ·
  🔴 **`state === 'error'` 时三档都不出**(没有第四个分支)—— **这一档也要用例**。
  ⚠️ `.kn-badge` 四档 P5b 已在 `knowledge.scss:1332-1343`,**别重复定义**。
- **两个按钮**:「仅指向」`:disabled="!rootPicker.path"`;
  🔴 **「搬文件到新目录…」`:disabled="!rootPicker.path || (dirProbe.state === 'done' && !dirProbe.migratable)"`**
  —— **两个条件、三种组合都要用例**。点它只是 `migrating = true`(**不发请求**)。
- **`.kn-pick-note`** 那段长说明文案(带中英文引号)—— **逐字照抄**,回附录 A 核准键名。
- **自动捕获开关**:`.k-sw` `:data-on="String(!!notesSettings.autoExtract)"`(🔴 `!!` 照抄);
  `v-if="!notesSettings.autoExtract"` 的 `.warn` 提示行 —— **两态都要用例**。
  ⚠️ **本机 `auto_extract: true` → 那行 `.warn` 不渲染**(治理 §13 已点名,是正确行为)。

### 3.2 🔴 K29 —— 迁移确认弹窗转 reka
蓝本(约 `:126-160`)是**裸 `.k-modal-bg` + `@click="closeMigrate"` + 内层 `@click.stop`**,不是 reka。
→ **转 reka 原语 + `DialogPortal` 的 `to` 指向 `.knowledge-app`**(K7 同族,SP8 已爆三次)。
- **照 `QueueView.vue:190-208` 与 `IndexedFilesView.vue` 的既有两个弹窗抄**,别自己发明。
- 🔴 **交接项 #3**:`DialogPortal to=".knowledge-app"` **只认第一个同名宿主** →
  **测试要自己在 body 里备好宿主**,先例 `QueueView.test.ts:127-130` 的 `withHost()`。
  **测 reka Teleport:挂载后先 `await nextTick()` 再查 `document`。**
- **弹窗内容逐字照抄**:`.k-modal-head` / `-title` / `-x`(带 `<KIcon name="x" :size="13"/>`)/ `-body` / `-foot`
  —— 🔴 **那四个 `.k-modal-*` 类是 T2a 本期才搬进 scss 的(K17 兑现)**,先 grep 确认存在。
  `.kn-mig-path`(旧路径 → `<KIcon name="arrowRight" :size="13" color="var(--warning)"/>` → 新路径,
  **`color=` 已是 `var()` 不是字面量**)· `.kn-mig-req` 三个 `<li>`(第一个 `<li>` 的 `<KIcon name="check">` 的
  `:color` 是**三元**:`dirProbe.state === 'done' && !migratable ? 'var(--danger)' : 'var(--success)'`,
  且带一个 `v-if` 的红色 `<b>` 补充句)· `.kn-checkline` 的 `<input type="checkbox" v-model="migrateAck"/>`。
- **底部两按钮**:`.k-btn.ghost` 取消 · `.k-btn.danger` `:disabled="!migrateAck"` +
  `<KIcon name="upload" :size="12"/>` + `$t('Start moving')`。
- `closeMigrate()`:`migrating = false; migrateAck = false`(**两个都清,照抄**)。
- `doMigrate()`:🔴 **先 `closeMigrate()` 再 `await applyRoot('migrate')`**(顺序照抄)。

### 3.3 🔴 K30 —— `applyRoot` 不回显后端 detail
蓝本(约 `:271-281`)catch 里读 `(e.response && e.response.data && e.response.data.detail) || e.message || e`
拼进 toast(自带注释「400 = non-empty target guard from the backend — surface as-is」)。
→ **本仓只弹固定 `aiKbOpFailed`**,**不回显任何后端文本**。
🔴 **落地判据 = 排除式断言**:让 `putSettings` reject 一个带可识别文本的错误,断言 toast/DOM
**`not.toContain(那段文本)`**。⚠️ **§9 第九条:探针文本别在源码注释里出现**(T6 栽过)。
成功路径:`notesSettings = await putSettings({ notesRoot: path, mode })` → `rootPicker.open = false` →
toast `$t('Notes folder updated')`。**`mode` 两个取值 `'adopt'` / `'migrate'` 各要用例。**

### 3.4 `toggleAutoExtract` / `created`
- `created()` → Vue3 用 `onMounted`(或 setup 顶层 `await` 前的调用,**照 T8 上半既有写法**):
  `try { notesSettings = await getSettings() } catch { /* keep defaults */ }` —— 🔴 **catch 吞错保默认值,照抄**
  (**要有用例**:`getSettings` reject 时页面仍渲染、`notesRoot` 走 `|| '/DATA/Notes'` 兜底)。
- `toggleAutoExtract()`:`next = !autoExtract` → `putSettings({ autoExtract: next })` →
  toast 二选一;catch 走 **K30**(固定键)。

### 3.5 N16 emoji
`📝 {{ $t('Knowledge notes') }}`(区标题,**emoji 在 `$t()` 外**)· `⚠️` 若本刀范围内有 —— **逐处回源核**。

---

## 4. 测试要求

### 4.1 🔴 §9.2 + §9.3 —— en 档强断言,**必须双向扫**
- **已知同族**(T8 已在同一文件里配过 N21 #1/#2/#5/#6 四对的断言)—— **本刀新增文案要再扫一遍**:
  「本刀新用到的键 × 全表」**双向**(zh 撞车看 en 是否不同 · **en 撞车看 zh 是否不同**)。
  🔴 **键数用「真实模块导入」计,不要文本解析**(T8 文本解析 1499,真实 **1503**)。
- 🔴 **T7 扫出 1 对、T8 扫出 2 对,都是协调者不知道的** → **这条不是形式**。
  有则配正/反向断言 + 探针;**没有也要在报告里写「已双向比对,本刀余零同族对」**。
- ⚠️ **别改 T8 已有的那四对断言**(它们已过评审)。

### 4.2 治理 §9 的通用纪律(**本期同族事故已十次**)
- 🔴 注入脚本整段/行首锚定 + **先断言注入真的落盘**(`grep -n`/`md5sum` + `assert hits==1`)。
- 🔴 报行号的断言用**保行版**剥注释(第八条)。
- 🔴 **否定式断言先剥注释 + 钉调用形状,不钉裸标识符**(第九条)。
- 🔴 **覆盖度自检的特征串必须独特,不能恒真**(第十条,T8 自捕:`</div>` 恒真)。
- 🔴 **工具本身会造假红**:跑测试**要能解析到 `Tests` 汇总行**才算有效结果(T7 评审栽过)。
- **§1.3**:探针**允许**临时写零改动清单里的文件(md5 证还原 + 不在提交里 + 收尾干净)。
  **怕越界而跳过探针才是真问题。**
- 属性态断言直接比字符串值两侧都比,**禁 `toBeUndefined()`**。
- 🔴 **「假判别力」自查**(T8 两次自捕):写完每条边界用例问一句「这条断言在实现写错时真的会红吗?」——
  拿不准就做探针。

### 4.3 必须有的用例(至少)
`openRootPicker` 开/关两态 + **重开清 stale path**(承接 Vue2 那两条既有行为)· `loadCandidates` 被调 ·
`fb.reset()` 被调 · **`onPick` 交错路径**(后发先回)· `dirProbe` **四态**(loading / done+migratable /
done+!migratable / **error**)· `migratable` 判据 `!exists || empty` 的**三种组合**(不存在 / 存在且空 / 存在非空)·
两个按钮的 disabled(「搬文件」**两个条件三组合**)· **reka 弹窗开关 + `withHost()`** ·
弹窗内 `<li>` 第一个的 `:color` 三元两侧 + `v-if` 红 `<b>` 两态 · `migrateAck` 门控 danger 按钮两侧 ·
`closeMigrate` 清两个 state · `doMigrate` **先关后发**的顺序 · `applyRoot` 两个 `mode` ·
**K30 两处 catch 的排除式断言**(`applyRoot` / `toggleAutoExtract`)· `created` catch 吞错保默认 ·
`autoExtract` 两态 + `.warn` 行两态 + **后端漏字段 → 归一成 true** · `notesRoot` 空 → `|| '/DATA/Notes'` 兜底

---

## 5. 测试门(提交前必须全过)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5c-t9-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5c-t9-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5c-t9-build.log 2>&1; echo "exit=$?"
```
- **全量,不许只跑子集**;**输出完整落盘,不许 `| tail`**;报告贴 `Test Files` / `Tests` 两行 + 红项完整用例名。
- **算术**:🔴 **文件数仍 326、`.vue` 仍 179、`color-guard` 不变**(本刀零新增文件)——
  只有用例数增加。**报告给实测终值。**
- 已知噪声(只它们红就复跑一次并说明,**不要顺手改**):
  `src/files/upload/persist.test.ts > persist > dropPersisted removes record + blob and frees budget` ·
  `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。
- **Service 仓零改动** → 不需要跨仓 `pnpm build` / `pnpm install`。
- ⚠️ **本页此刻未上路由**(rail「系统设置」仍是占位页,T10 才反转)→ 浏览器里看不到,**这是预期**。

---

## 6. 硬约束

- 禁 `git add -A` / `git add .`;禁 rebase / reset / stash / merge / push;不跑 `./scripts/deploy.sh`;
  不写 `/var/lib`;不改任何后端仓;**不动 `:5288` 的 dev server**。
- **一个任务 = 一个语义提交**,提交后 `git show --stat HEAD` + `git status` 自查。报告 **`git add -f`**。
- **禁碰** `/home/nimo/NimoTech/NimoOS-New-UI`(SP6/SP9)与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(SP7,有并发会话)。
- 🔴 **§1.1 全期零改动清单**一行都不许动 + **本刀额外零改动**:`knowledge.scss` · `knowledgeStyles.test.ts` ·
  `parser-styles.scss` / `parserStyles.test.ts` · 两个 Parser 页及其测试 · `parserStore.ts` · `knowledgeStore.ts` 本体 ·
  **`FolderBrowser.vue` / `folderBrowser.ts`(只 import,不改)** · `src/i18n/*` · **`knowledgeRoutes.ts` / `deferred.ts`**。
  需要改 → **停下写 `NEEDS_CONTEXT`**。
- 🔴 **不许新增 i18n 键**。缺键 = T1 漏了 → **`NEEDS_CONTEXT` 停下**。
- 🔴 **不许动 T8 上半的任何 DOM / script / 断言**(已过评审)—— 只**插入**下半。
  报告要自证:`git diff` 里上半那些行零改动。

---

## 7. 报告契约

完整报告写 `.superpowers/sdd/p5c-task-9-report.md`(**`git add -f`**),至少含(治理 §10):
- 逐条对照:**蓝本 `SettingsView.vue:行` → New-UI `:行`**(下半全覆盖)。
  🔴 **New-UI 侧行号用脚本重算**(T7 因手写行号陈旧被评审报 Important)。
- 🔴 **mock 层次逐条自证**(§4.1 四行表):`notes.*` **camelCase 且只有两个字段** ·
  `folder.getList` **单层** · 与 `FolderBrowser.test.ts` 的形状一致性自查
- 🔴 **K29 reka 弹窗**:改法 + `DialogPortal to` + **测试里 `withHost()` 的写法**(先例行号)
- 🔴 **K30 两处排除式断言**(含探针文本没撞注释的说明)
- 🔴 **`onPick` 交错路径**用例名 + **§9.1「两实例交错」是做了还是论证不适用**(要给理由)
- 🔴 **§9.2/§9.3 双向扫结论**(键数用真实模块导入;有同族对就给断言,没有也要写明)
- **§4.4 三份 fixture 抄本 + 等价校验 + 变异验证输出**(用不到的说明为什么不抄)
- **承接 Vue2 既有单测 `settingsViewRootPicker.spec.js` 两条行为**的用例名
- **RED 探针的两段输出**(至少 5 条:`onPick` 拿掉守卫 / K30 拼回 detail / 「搬文件」disabled 条件删一半 /
  `migratable` 判据改成 `&&` / reka 宿主拿掉)+ 还原确认 + `git status` 干净
- 三门完整终值 · **文件数 326 / `.vue` 179 不变**的自证
- **§3 的 K1–K35 里本刀命中的每一条显式申报** · **§3.5 的 N1–N22 + §3.6 里本刀命中的**
- **「T8 上半零改动」的自证** · **「本页未上路由 = 预期」**的说明
- 拿不准的一律 `NEEDS_CONTEXT` 列出来,**不要自己拍**

返回给协调者 **≤15 行**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
提交 sha · 一行三门结果 · 文件数/`.vue` 是否不变 · 双向 en 扫结论一行 · `onPick` 交错测试一行 ·
RED 探针几条全过 · 顾虑。
