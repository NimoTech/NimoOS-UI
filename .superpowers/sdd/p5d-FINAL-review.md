# SP8-P5d 全支终审(final whole-branch review)

审阅者坐标:只读核查 + 探针,`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`。
BASE `23515cd` → HEAD `be72e95`(18 提交)。**全程未提交、未部署、未 kill/重起任何 dev server**
(`:5288` pid 1159107 / `:5277` pid 15948 / `:5299` pid 299874 三者收尾时仍在监听,均未碰)。
所有探针一律 `cp` 存副本 → 行首/字符串锚定注入 → 先证注入落盘 → 副本覆盖 → `md5sum` 逐字节比对;
**零 `git checkout` / `git restore` / `git stash`**。收尾 `git status --porcelain` 为空,HEAD 仍 `be72e95`。

---

## 0. 总判定

**✅ 可以交付用户验收。**

理由:三门自己重跑与收官口径逐项吻合;92 个新键**零死键**(本终审第一次可真验的项,已验);
四类跨刀问题里没有一条 Critical;三处协调者裁定(R2 / R15 / R16)与 T5 那次错误裁定的回退
**四项复核全部成立**;本终审自己挑的 4 组守卫变异里 3 组见血、1 组坐实了**既有**(非本期)覆盖空洞。
新发现集中在**守卫覆盖范围**与**台账/治理文件的可继承性**,均不影响本期产品代码的正确性。

---

## 1. 🔴 死键核查(92 键)—— **真死键 0 条**

方法(不采信 T1「后续刀会用」的推断):

```bash
git diff 23515cd..be72e95 -- src/i18n/zh_cn.ts | grep '^+' \
  | grep -oE "^\+\s*([A-Za-z_][A-Za-z0-9_]*):" | sed -E 's/^\+\s*//; s/:$//' | sort   # → 92 行
# 逐键、**词边界**匹配(避免 aiKbNeSave ⊂ aiKbNeSaved 这类子串假命中)
while read -r k; do
  prod=$(grep -rlw --include='*.vue' --include='*.ts' -e "$k" src/ \
         | grep -v '^src/i18n/' | grep -v '\.test\.ts$')
  [ -z "$prod" ] && echo "DEAD: $k"
done < keys.txt          # → 零输出
```

- **92/92 都有生产消费点**(不含 i18n 本体、不含 `.test.ts`)。
- 85 条是模板/脚本里的直接 `t('key')`;剩余 **7 条是间接消费**,已逐条落地核实,**不是死键**:
  `aiKbNoteType{Note,Summary,Insight,Digest}` / `aiKbNoteSrc{Human,Agent,Pipeline}`
  写在 `src/ai/knowledge/util/notesViewHelpers.ts:33-36 / 51-53` 的 `labelKey` 字段上,
  由 `NotesView.vue:365,391,393` 与 `NoteEditPane.vue:697,724` 的 `t(m.labelKey)` / `t(typeMeta(...).labelKey)` 渲染。
- 消费点分布:`NoteEditPane.vue` 55 · `NotesView.vue` 26(含 3 条与 NoteEditPane 共用)· `notesViewHelpers.ts` 10。

⚠️ **但本期确实新产生了 1 条死键**,只不过不在这 92 条里 —— 见 §7 Minor-2(`aiCfgKnowledgeSoon`)。

---

## 2. 🔴 收官口径:七个数字自己实测 + 三门自己重跑

| 项 | 口径 | 本终审实测 | 命令 / 证据 | 结论 |
|---|---|---|---|---|
| 测试文件数 | 331 | **331** | `pnpm test` → `Test Files 331 passed (331)`;`find src -name '*.test.ts' \| wc -l` = 331 | ✅ |
| 用例数 | 3958 | **3958** | `pnpm test` → `Tests 3958 passed (3958)` | ✅ |
| `.vue` | 182 | **182** | `git ls-files src \| grep -c '\.vue$'` = 182(base `23515cd` 为 179 → +3) | ✅ |
| `aiKb*` | 387 | **387 / 387** | 真实模块导入(见下)`Object.keys(zh).filter(k=>k.startsWith('aiKb')).length` | ✅ |
| 全表键数 | 1595 / 1595 | **1595 / 1595** | 真实模块导入,zh/en 各自独立量,且 `zh-only`/`en-only` 两个差集**均为空** | ✅ |
| color-guard | +3 | **184(base 181,+3)** | 见下方推导 | ✅(口径成立,但含义需澄清 —— §6 Minor-1) |
| 依赖四包 | `@tiptap/*@2.27.2` + `tiptap-markdown@0.8.10` | **完全一致** | `package.json:30-32,53` 声明 `^2.27.2` ×3 + `^0.8.10`;`node_modules/*/package.json` 实测解析 `2.27.2 / 2.27.2 / 2.27.2 / 0.8.10`;`pnpm-lock.yaml:70,133` 同;**未多装** `@tiptap/core`(peer,只在 `.pnpm/@tiptap+core@2.27.2_@tiptap+pm@2.27.2`)、`extension-highlight`、`extension-typography` | ✅ |

**真实模块导入的取数法**(避免文本解析少算,也避免在仓里留临时 vitest 文件):

```bash
cp src/i18n/zh_cn.ts $SP/zh.mjs && cp src/i18n/en_us.ts $SP/en.mjs   # 两文件零 import,可直接当 ESM 跑
node --input-type=module -e "import zh from '$SP/zh.mjs'; import en from '$SP/en.mjs'; …"
# → zh keys = 1595 / en keys = 1595 / aiKb* zh = 387 / aiKb* en = 387 / zh-only = [] / en-only = []
```

**color-guard +3 的推导**:`src/styles/color-guard.test.ts` 与 base `23515cd` **逐字节相同**
(`diff <(git show 23515cd:src/styles/color-guard.test.ts) src/styles/color-guard.test.ts` 为空),
它的用例数是 `import.meta.glob('../**/*.vue' | '../**/*.css')` 命中数的纯函数
→ `.vue` 179→182 即 `it` 181→184。实测当前 `Tests 184 passed (184)`。

**三门(本终审自己跑,全量、不 `| tail` 截断)**:

| 门 | 结果 |
|---|---|
| `pnpm test` | `Test Files 331 passed (331)` / `Tests 3958 passed (3958)`,**exit 0**,零 flaky(§0.4 两条已知噪声本轮未出现) |
| `pnpm exec vue-tsc --noEmit` | **exit 0**,日志 **0 行** |
| `pnpm build` | **exit 0**,`✓ built in 13.54s`(唯一输出是既有的 >500kB chunk 提示,非错误) |

---

## 3. 🔴 §③ 「产品代码对、守卫为零」的最后一遍扫

本终审自选 4 组变异(**不复用逐刀评审做过的那些**),按怀疑度排序。

### P1 —— 🔴 命中:`color-guard.test.ts` 对**独立 `.css` 文件**的扫描是**空壳**(既有缺陷,非本期引入)

怀疑动机:`color-guard` 用 Vite `?raw`,而本仓铁律(MEMORY / `knowledgeStyles.test.ts` 头注释③)明写
「vitest 的 CSSEnablerPlugin 把样式源整体替换成空串,`?raw` 恒空」。**那 `color-guard` 自己怎么办?**

诊断探针(注入 → 取证 → 还原,`md5 64a58989f1f88da98089b1194d619483` 复原一致):

```
Received: "TOTAL=184 EMPTY=2 [../files/viewers/viewers.css,./theme.css] VUE=182/emptyVue=0 CSS=…=0,…=0"
```

结论,三点:

1. **182 个 `.vue` 条目内容全部非空 → `color-guard` 对 `.vue` 的 `<style>` 块是有牙的**(本期 +3 那部分见 Minor-1)。
2. **2 个 `.css` 条目内容都是空串 → `.css` 侧两条用例是纯空壳**。`src/files/viewers/viewers.css`
   实有 2 处 hex(都在 `var()` fallback 里、本来合法),`src/styles/theme.css` 实有 105 行 hex + 117 行 `rgba(`
   —— 若真被扫会炸,现在 0ms 通过。
3. 顺带扒出一处**逻辑死代码**:`color-guard.test.ts:65` 的 `if (rel === 'styles/theme.css') continue`
   **从未生效** —— Vite 对与 importer 同目录的文件把 glob key 归一成 `./theme.css`,
   `rel = path.replace(/^\.\.\//,'')` 得到的是 `./theme.css`,不等于 `'styles/theme.css'`。
   theme.css 之所以不报红,靠的是「内容恰好为空」这个**巧合**,不是那句 `continue`。

**归属**:`color-guard.test.ts` 与两个 `.css` 都早于本期,**不是 P5d 的缺陷**,但它是本档
「产品代码对、守卫为零」家族里目前**规模最大的一处**,且与 **D-5** 同源。→ 见 §7 Important-1。

### P2 —— 两头验 R17 新守卫(`<script>` 块注释色字面量)

- **RED(必须报红)**:在 `NoteEditPane.vue` 的 `<script setup>` 首行后注入 `// PROBE 蓝本原色 #ff9500 探针`
  → **精确报红**:`× components/NoteEditPane.vue —— <script> 块注释里零 hex / rgb() / hsl() 色字面量`,
  `Tests 1 failed | 293 passed (294)`。**新守卫有真牙,不是空壳。**
- **反面(暴露残余空洞)**:同一位置改成 `// PROBE 蓝本原色 white 与 black 探针`
  → `knowledgeStyles.test.ts` + `color-guard.test.ts` 合跑 **478 passed,零报红**。
  → **`<script>` 块注释里的「具名色」全仓零守卫**(R17 那条只断 `#hex` 与 `rgb()/hsl()`,见 `:1259-1263`)。

还原 `md5 173b677139d9656a29c77e0fe13e6314` 一致。

### P3 —— 🔴 命中:§0.3 第 4 个位置(`.ts` 文件)**完全裸奔**

在 `src/ai/knowledge/util/notesViewHelpers.ts` 首行注入
`// PROBE §0.3 位置4 探针:注释里的 #ff9500 / rgba(255,149,0,.14) / white`
→ **`pnpm test` 全量 331 / 3958 全绿**。
→ `.ts` 里的色字面量(注释与字符串两者)**没有任何守卫**。
现存唯一相关断言是 T3 的 K40 定向断言(只钉 `NOTE_TYPES` 那 4 个 `color` 字段的值恰为
`var(--grad-note-*)`),**新增第 5 个条目、或任何别处的 `.ts` 色字面量都不会红**。
还原 `md5 03b4c1aba6bc6455677532d611bb5aa1` 一致。

### P4 —— 未命中(守卫健康):R8 / R9 两条集合相等断言

往 `knowledge.scss` 的 `.k-btn` 块内注入两行 `.kn-bogus-probe{…}` + `.bogusnonk{…}`
→ **3 条守卫同时报红**:「没有搬多(白名单 293)」+「非 k* 辅助类都在登记表内」+
「登记表恰好等于文件里真实存在的非 k* 类(R8 终值 16)」,`Tests 3 failed | 291 passed (294)`。
还原 `md5 5b198dc3bd478e971f3c91a2a51b980d` 一致。→ **R8/R9 两条不是空壳,双向都咬。**

### 🔴 §0.3 四个位置 —— 现在各由谁守 / 还有谁裸奔

| 位置 | hex / `rgb()` / `hsl()` | 具名色(`white`/`black`…) | 范围 |
|---|---|---|---|
| ① `.vue` 的 `<template>` | ✅ `knowledgeStyles.test.ts:1210`「模板内零 hex/rgb/hsl」(**贪婪抽整块文本**,连 `<!-- -->` 模板注释与 `:style` 对象字面量一并覆盖) | ✅ `:1219` 按**属性值位置**扫(`color/background/border/box-shadow/fill/stroke`) | 仅 `KNOWLEDGE_VUE_FILES`(13)+ `COMPONENTS_VUE_FILES`(70);**其余全仓裸奔** |
| ② `.vue` 的 `<style>` | ✅ `color-guard.test.ts`(实测对 `.vue` 有牙) | ❌ **全仓零覆盖 = D-5** | 全仓 182 `.vue`;本期 3 个新 `.vue` 按 K44 零 `<style>` 块 → 不咬本期 |
| ②′ 独立 `.css` | 🔴 **空壳**(P1:`?raw` 恒空,2/2 条目内容为空) | ❌ | 2 个文件,既有缺陷 |
| ②″ `.scss`(`knowledge.scss`) | ✅ `knowledgeStyles.test.ts:479`「token 声明层之外,全文**含注释**零色字面量」 | ✅ 同条,8 个具名色 + `lab/lch/hwb/color()`,且已修过 `\b` 与连字符的假阳性 | 只 `knowledge.scss`(`color-guard` 压根不扫 `.scss` = M-1) |
| ③ `.vue` 的 `<script>` 注释 | ✅ **R17 新守卫**(`:1259`,P2 实证有牙) | 🔴 **裸奔**(P2 反面实证) | 仅 `KNOWLEDGE_VUE_FILES`(13) |
| ④ `.ts` 的注释 / 字符串 | 🔴 **完全裸奔**(P3 实证) | 🔴 **完全裸奔** | 全仓;仅 T3 的 K40 4 字段定向断言算局部覆盖 |

### 「反转不删」留成注释的原文 —— 与现状是否相符

逐处核过,**没有一处与现状矛盾到会误导人**,一条 Minor:

- ✅ `NotesView.vue:78-83` 头注释已由 T7 改写成「T6 曾内联占位、T7 已换回真 import、占位实现随之删除」——
  与现状一致(`grep -rn 'kn-edit-pane-stub\|NoteEditPanePlaceholder' src/` 只剩 `NotesView.test.ts` 的守卫与说明,
  产品代码零命中)。
- ✅ `SettingsPage.vue:183-190`(`onDetailsClick` 原文留注释)、`deferred.test.ts` / `knowledgeRoutes.test.ts`
  的第五代反转注释,均**带日期戳、且新块写在旧块之后**,现状写在最后一块里,读法明确。
- ⚠️ **Minor**:`knowledgeRoutes.ts:49-51`(P5c-T10 那一代)用**现在时**写「剩下 **5** 个子路由
  (`search`/`wiki`/`roots`/`allowlist`/**`notes`**)仍指 KnowledgeDeferred」,已被 :53-58 的 P5d-T10 块
  订正成 4 个。旧块有日期戳、属本档既定编年体写法,但那句现在时容易被跳读者当成现状。**不阻塞。**

---

## 4. 🔴 三处协调者裁定 + 那次错误裁定回退 —— 复核结论

### R2(`tiptap-markdown@^0.8.10`)—— ✅ **裁定正确,治理 K37/A-7 的 `^0.6.1` 确实是错的**

```bash
git -C /home/nimo/NimoTech/NimoOS-UI show 7a6ee6b7:package.json | grep -nE tiptap
#  74:    "tiptap-markdown": "^0.8.10"      ← 蓝本原文,坐实 E-36
git -C /home/nimo/NimoTech/NimoOS-UI show 7a6ee6b7:pnpm-lock.yaml | grep -n tiptap-markdown
#  7933:  tiptap-markdown@0.8.10:           ← 蓝本锁文件解析 0.8.10
```

- 本仓实际安装解析 = **`0.8.10`**(不是 `2.x`、不是 `0.6.1`),`@tiptap/*` 三包 = `2.27.2`,仍在 **v2 线**
  → K37「锁 v2、不许 v3」的实质约束未破。**装错版本这个最难回退的风险不存在。**
- ⚠️ **一处口径差异,不构成缺陷但应登记**:蓝本三个 `@tiptap/*` 直接依赖写的是 `^2.0.4`、锁文件解析
  **`2.10.3`**(见蓝本 lock `:17149` 的 `tiptap-markdown@0.8.10(@tiptap/core@2.10.3(...))`),
  裁定 R2 钉的是 **`2.27.2`**(v2 线最新)。蓝本用 `@tiptap/vue-2`、我们必须换 `@tiptap/vue-3`,
  「逐字同版本」本来就不可能;`2.10.3 → 2.27.2` 是同 major 内的前进,风险低。
  **但它是一处未在裁定书里写明理由的偏离**,建议补一行留痕(→ Minor-3)。

### R15(全表键数快照 `1503 → 实测值`)—— ✅ **完全成立**

- `SettingsView.test.ts:1887-1888` 现值 **`toHaveLength(1595)`** ×2,与本终审真实模块导入实测
  **1595 / 1595 逐字吻合**(不是 `1503+92` 的算式产物 —— 我另验了 zh/en 两档差集均为空,即 92 键与既有键零重名)。
- 旧值保留为注释,`:1883-1886`:「原为 1503(P5c-T9 引入的快照…)P5d-T1 加 92 键后订正为 1595 ——
  **依据协调者裁定 R15 / E-43**」,**引条目编号、不引 `file:line`**,合本档纪律。
- **越权核查通过**:`git show 56f8849 --numstat -- src/ai/knowledge/views/SettingsView.test.ts` = **`8  4`**
  —— 恰好是「注释 1 行改写 + 断言 2 行 + 5 行说明注释」,**T1 对该文件一字未多改**。
  该文件本期另外 2 处改动(`:209` 注释 / `:1567-1569` K36 3 行)是 **T9** 的独立授权,与 R15 无关。
- 未被改成 `toBeGreaterThanOrEqual`、未挪走、未删除 → 未越权重构 P5c 已评审的守卫。✅

### R16(`openConflict()` 由 T7 实现)—— ✅ **完全成立**

- `grep -rn openConflict src/` :**产品代码里只有一处函数定义** ——
  `src/ai/knowledge/components/NoteEditPane.vue:483 async function openConflict()`;
  `addTag()` 同样只有一处 `:393`。**零重复实现**(T8 复用,未重写)。
- **位置合理**:定义在 `<script setup>` 函数体,`save()` 的 catch(`:571 await openConflict()`)是唯一调用点
  —— 状态设置属上半 `save()` 链路,不是 UI 层。
- **上半没有留半个弹窗 UI**:冲突弹窗 markup **只有一处**,在 `:764-801`(T8 产出,`git show 71eab1f` 归属清晰),
  T7 的模板段(顶栏/草稿横幅/主列)零 `DialogRoot`。
- E-46(计划书 §T8 与 §T7 DoD-9 自相矛盾)独立复核成立:没有 `openConflict()`,DoD-9 的
  「`conflict` state 被设上」确实**不可观测**。

### T5 那次错误裁定的回退 —— ✅ **逐字节干净,零残留**

```bash
git diff 11ad79b..f43f9ad -- src/        # → 0 行
git diff --name-only 11ad79b..f43f9ad    # → 只有 .superpowers/sdd/p5d-task-5-report.md
```

另查残留(这是「回退不彻底」最常见的形态):

- `stripComments()`(`:23-27`)**恰好 2 个 `.replace`**(块注释 + 行首行注释),
  修复轮 1 加的 `<!--[\s\S]*?-->` 第三档**已完全消失**,`grep '<!--\[\\s\\S\]'` 零命中。
- `namedColorOffensesInValues` 只有 2 个调用点(`:1223` / `:1378`),**两处都不套 `stripComments`**
  → 与回退前完全一致,没有留下「半截包一层、半截不包」的分叉,也没有死 helper。

---

## 5. 跨刀一致性

### 两个弹窗(T6 删除确认 / T8 冲突)—— ✅ **同一套口径,逐项对齐**

| 维度 | `NotesView.vue:418-452` | `NoteEditPane.vue:764-801` | 先例 `SettingsView.vue:581+` |
|---|---|---|---|
| import | `DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle`(`:93`) | 同,逐字(`:264`) | 同 |
| Portal | `to=".knowledge-app" defer` | `to=".knowledge-app" defer` | 同 |
| Overlay / Content | `.k-modal-bg` / `.k-modal` + `:aria-describedby="undefined"` | 同 | 同 |
| 标题 | `<DialogTitle as-child>` 套在蓝本自己的 `.k-modal-title` div 上,**不加 `VisuallyHidden`** | 同 | 同(蓝本本来就有可见标题) |
| open 绑定 | `:open="!!deleting" @update:open="onDeleteOpenChange"` | `:open="!!conflict" @update:open="onConflictOpenChange"` | 同族 |
| K36 断言强度 | `NotesView.test.ts:645-652`:`role='dialog'` + `titleEl.id === aria-labelledby`(**元素身份**)+ `querySelectorAll('[id]')` **恰好 1** | `NoteEditPane.test.ts:859-866`:**逐字同款** | T9 给 `SettingsView.test.ts:1567-1569` 补的 3 行也是同款 |
| 测试宿主 | `withHost()` 造 `div.knowledge-app` 挂 body(`:141-146`) | 逐字同款(`:808-813`) | — |

→ 三处 K36 断言强度**完全齐平**,且都强于治理点名的 `IndexedFilesView.test.ts:1947`(= **E-48** 成立)。

### 三个新 `.vue` 的写法 —— ✅ **自相一致**

- **过期守卫**:`NotesView.vue:159-175` `let reloadEpoch = 0` / `NoteEditPane.vue:588-606` `let loadEpoch = 0`
  —— 都是**组件实例级**(`<script setup>` 函数体内)、都是 `const epoch = ++x` + `if (epoch !== x) return`、
  都 inline 不抽公共 guard(合「别抽公共 guard」的既定纪律)。`NotesMarkdownEditor.vue` 无异步取数,不涉及。
- **`data-*` 风格**:三文件共 32 处 `data-*`,**所有 `:data-*` 动态绑定一律 `String(...)`**
  (`data-open`/`data-on` ×14/`data-s`/`data-dirty`),测试侧一律断 `'true'`/`'false'` 字符串。零例外。
- **定位器策略**:一致地用语义类 + `[data-*]` 属性选择器(`.kn-note-row[data-s="draft"]` 这类),
  不用 `nth-child`;T8 按 DoD-11 把 T7 两条会撞第二个同类元素的断言加了 `.kn-edit-top` 祖先前缀,
  并另加 2 条用例程序化证明「加固前命中 2 / 加固后 1」(`NoteEditPane.test.ts:533-542`)—— 加固方向正确。
- **K/N 申报注释格式**:统一为 `【K<n> / N<n> —— 一句话 + 治理节号】` + 引「蓝本 `file:line`」与「附录 B §B.x 行号」,
  **不写色值**(R17 修完后,三文件**全文** hex/rgb/hsl **零命中**、词边界具名色**零命中**,已实扫)。
- 引用完整性:`NotesMarkdownEditor.vue` 确实被 `NoteEditPane.vue:271` 静态 import 并在 `:673` 使用,
  不是孤岛;三个新 `.vue` 都已进 `KNOWLEDGE_VUE_FILES`(13/13,且 `:1191` 有 `listVueFiles` 集合相等防漂移)。

### K45 落地 —— ✅ 位置与守法都对,且有第二道网

- `knowledge.scss:813-822`:`&.text {background: transparent; color: var(--accent)}` + `&.text:hover`,
  插在 `&.danger` **之后**、`&:disabled` **之前**,与蓝本
  `src/views/AI/Knowledge/styles/knowledge.scss:1569-1570` 的源序与取值逐字一致(已 `git show` 比对)。
- 计数断言(`knowledgeStyles.test.ts:399-404`)**已按 T0 复审的 deferred minor 锚定在 `.k-btn { … }` 区间内**
  (`findKBtnBlockRange` 做花括号配对,不是「下一个 `\n}`」),兑现了那条 deferred 项。
- ⚠️ 一处**用例名过宽**:标题写「`&.text` **只在** `.k-btn{…}` 作用域内出现」,但断言只在区间**内**计数,
  没有断言区间**外**为 0。P5e 若把蓝本 `:1569` 原样(顶层 `.k-btn.text {…}`)重复搬,这条不会红。
  **但不构成缺口** —— K44 那条「顶层裸选择器集合恰等于 `['.nme-content .ProseMirror']`」会报红,
  两道网互补。建议 P5e 顺手把标题改准(→ Minor-4)。

---

## 6. 债务与遗留项完整性

### 逐条核「是否真落在文件里」(不是只存在于台账)

| # | 内容 | 在文件里的锚点 | 咬谁 |
|---|---|---|---|
| **D-1** | `.k-btn.text` | **已解决** = K45 落地(`knowledge.scss:813`)+ 附录 D §D.4.1 的 P5e 交接项 | — |
| **D-2** | `tiptap-markdown` 版本 | **已解决** = R2 + `package.json:53` | — |
| **D-3** | 全表键数快照嵌在 task-scoped 用例里 | ✅ **有代码锚点**:`SettingsView.test.ts:1885` 明写「D-3 已挂账交 P5e 拍板」 | 🔴 **P5e / P5f 每期必咬一次** |
| **D-4** | 92 键里约 68 条的值只有一次性脚本校验、vitest 只断 `typeof` | ❌ **只在台账**,`grep -rn 'D-4' src/` 零命中 | P5e/P5f 会继续放大(是全仓策略问题,不该在 P5d 内改) |
| **D-5** | `<style>` 块 CSS **具名色**扫描全仓零覆盖 | ❌ **只在台账** | 🔴 **P5e/P5f 只要写 `<style>` 块就咬**;且本终审 P1 发现它比登记的更宽(独立 `.css` 连 hex 都是空壳) |
| **D-6** | `sourceRefs.path` / 非空 `backlinks` 用构造 fixture,待真样本回填 | ✅ `p5d-fixtures/README.md`(§4 / `:57-74` 契约表);但 `grep -rn 'D-6' src/` 零命中 | 低;P5e 若碰 notes 相关端点顺带 |
| **U-1** | 上游 `NimoOS-Service/src/notes.test.ts` 给 `cancelDistillJob` 补用例 | ❌ 只在 `p5d-task-0-report.md:227` / `p5d-task-3-brief.md:78`;**Service 仓内零痕迹** | 低(P5d 零调用点);但 Service 仓永远看不到它 |
| **A-8 票**(Agent `?session=` 深链) | ✅ **有代码锚点**:`openInApp.ts:113-122` 写明「交接票…(P5e/P5f,依据裁定 A-8)」 | P5e/P5f |
| **clipboard 前端票**(HTTP 非安全上下文无 `execCommand` 兜底) | ✅ **有代码锚点**:`NoteEditPane.vue:218-221` + `NoteEditPane.test.ts:614` | 真机 HTTP-IP 访问下复制会静默失败 → 属**用户验收可见项** |
| **E-31 ~ E-48** | 18 条勘误 | ✅ 每条都能在 `.superpowers/sdd/*.md` 里 grep 到(逐条实测) | 见下方 Important-2 |

### 🔴 会咬 P5e / P5f 的,按优先级

1. **D-3**(必咬,且红在与该期无关的文件里)—— P5e 开工第一件事就得拍板。
2. **D-5 + 本终审 P1**(`<style>`/`.css` 色扫覆盖)—— P5e 的搜索区若写 `<style>` 块或新增 `.css`,**零保护**。
   P1 顺带给出了修法:`color-guard` 的 `.css` 分支必须换 `node:fs`(`?raw` 恒空),
   并把 `rel === 'styles/theme.css'` 改成能匹配 `./theme.css` 的判断,否则一改成 `node:fs` 就会被 theme.css 炸红。
3. **§0.3 位置 ③ 的具名色 + 位置 ④ 的 `.ts`**(P2 反面 / P3)—— 两处零覆盖,补法与 R17 同形态、同一份文件清单。
4. **K45 / K43 的「P5e 不许重复搬」** —— 附录 D §D.4.1 已写死,两道网都在,风险已控。
5. **D-4**(68 条键值无常驻守卫)—— 全仓策略题,建议 P5e 与 D-3 一起拍板,别再逐期累加。

### 台账漏记的真实遗留项(本终审新增)

见 §7 的 Important-2 / Important-3 与 Minor-2 / Minor-3 / Minor-5。

---

## 7. 发现(Critical / Important / Minor)

**Critical:0 条。**

### Important

- **I-1** `src/styles/color-guard.test.ts:15-16,49-50,65` —— **独立 `.css` 文件的色扫是空壳**:
  `?raw` 在 vitest 下恒空,2/2 条 `.css` 用例搜索域为空;`:65` 的 theme.css 跳过判断因 Vite 把同目录
  glob key 归一成 `./theme.css` 而**从未生效**(theme.css 不报红纯靠内容为空的巧合)。
  **既有缺陷、非本期引入**(该文件与 base 逐字节相同),但与 **D-5** 同源、且本档已因
  「`?raw` 恒空」栽过一次。取证:
  `git diff <(git show 23515cd:src/styles/color-guard.test.ts) src/styles/color-guard.test.ts`(为空)+
  §3-P1 的 DIAG 探针 `Received: "TOTAL=184 EMPTY=2 [../files/viewers/viewers.css,./theme.css] VUE=182/emptyVue=0"`。
  **建议**:并入 D-5,交 P5e 一次修掉(改 `node:fs` + 修 theme.css 判断,两步必须同时做)。
- **I-2** `.superpowers/sdd/p5d-common-constraints.md:1-14` —— **治理文件从未被订正,也不提裁定书**:
  18 条已查实的错(`WHITELIST_226` / `^0.6.1` / 「`NON_K_HELPER_CLASSES` 保持 10」/ K36 先例指向更弱的
  `IndexedFilesView.test.ts:1947` …)原文仍在,文件头的「权威优先级」把治理排在计划书之上却
  **一字未提 `p5d-coordinator-rulings-T0.md`**(`grep -n 'rulings\|裁定书\|R1\b\|R15\|R16\|R17'` 零命中)。
  P5e/P5f 若照治理自己写的必读顺序读,会被误导。三份 `p5d-` 附录已订正且已提交,是部分缓解。
  **建议**:在治理文件头加一句「本文件已知 18 处错,冲突处以 `p5d-coordinator-rulings-T0.md` 为准」。
- **I-3** `.superpowers/sdd/`(gitignore 覆盖)—— **本期 49 个台账文件里 30 个未被 git 跟踪**,
  包括**权威最高的裁定书**与**整期骨架的台账**:
  ```bash
  comm -23 <(ls .superpowers/sdd | grep ^p5d | sort) \
           <(git ls-files .superpowers/sdd | sed 's|.*/||' | grep ^p5d | sort)
  # → p5d-coordinator-rulings-T0.md · p5d-progress.md · 全部 11 份 brief ·
  #   全部 11 份 review + 4 份 rereview
  git log --oneline -1 -- .superpowers/sdd/p5d-progress.md    # → 零输出(从未提交)
  ```
  因 `.gitignore:6` 盖着 `.superpowers/`,`git status` 全程干净、**没有任何东西会警告**。
  这正是计划书 §0.1 点名的 SP7 事故向量(「SP7 曾把整个 `.superpowers` 目录弄丢过」)。
  实现者的 19 份 report / 治理 / 附录 / fixtures 都 `git add -f` 了,**协调者自己的文件全没有**。
  **建议**:收官前 `git add -f` 这 30 个文件(不在我的授权内,故未执行)。

### Minor

- **M-1** 「color-guard **+3**」这个收官数字**成立但含义要写清**:3 个新 `.vue` 里
  `NotesView.vue` / `NoteEditPane.vue` 按 K44 **零 `<style>` 块**、`NotesMarkdownEditor.vue` 的
  `<style` 唯一命中在 `:24` 的注释里 → **新增这 3 条用例当前搜索域为空(空壳但有未来牙口)**,
  与 T5 那 45/70 组件文件同一性质。T10 评审那张表把「color-guard +3」的证据填成了
  `knowledgeStyles.test.ts` 的 3 处清单登记(`:1034/:1035/:1042`),**两者不是同一件事**。
  取证:`grep -c '<style' <三文件>` = 0/0/1(第 3 个是注释)。
- **M-2** 🔴 **本期新产生 1 条死键,台账未记**:`src/i18n/{zh_cn,en_us}.ts` 的 **`aiCfgKnowledgeSoon`**
  在 T9 把占位 `<button>`+toast 反转成 `<router-link>` 后**零生产消费点** ——
  `grep -rn aiCfgKnowledgeSoon src/` 只剩 `src/ai/views/SettingsPage.vue:187`,而那一行**在注释里**
  (「反转不删」保留的原文)。按本档纪律键应保留,但**应登记成交接项**,否则将来任何死键审计都会捡到它却查不到来历。
- **M-3** 裁定 R2 把 `@tiptap/*` 钉在 **`2.27.2`**,而蓝本锁文件解析的是 **`2.10.3`**
  (`git -C NimoOS-UI show 7a6ee6b7:pnpm-lock.yaml | grep -n 'tiptap-markdown@0.8.10('` → `:17149` 含 `@tiptap/core@2.10.3`)。
  同 major、风险低,且 `vue-2 → vue-3` 本就无法逐字同版本 —— 但这处偏离**未在裁定书里写明理由**,建议补一行留痕。
- **M-4** `src/ai/styles/knowledgeStyles.test.ts:399` 用例名「`&.text` **只在** `.k-btn{…}` 作用域内出现」
  比断言实际做的事宽(只在区间内计数,未断区间外为 0)。实际无缺口(K44 顶层集合相等断言兜住),
  建议 P5e 顺手把标题改准,免得后人当成已守。
- **M-5** `src/ai/knowledge/knowledgeRoutes.ts:49-51`(P5c-T10 那一代注释)用现在时写「剩下 **5** 个子路由…
  `notes`…仍指 KnowledgeDeferred」,已被 `:53-58` 订正。编年体写法本身合规,只是跳读易误解。
- **M-6** 台账两处数字与 `git` 实测不符(不影响任何结论):① Task 8 记 `NoteEditPane.vue` **+410/−21**,
  实际 `git log --numstat` 是 **+391/−19**(431 + 372 = 803 = 现文件行数,自洽);
  ② 台账在 Task 10「评审已派」之后**没有收尾行** —— `p5d-task-10-review.md` 其实已完整落盘且判定
  **规格 ✅ / 质量 ✅ / 零 Critical-Important-Minor**,但台账缺「Task 10: complete」与整期收官行。

---

## 8. ⚠️ 无法核验项(归用户验收)

1. **真机/真浏览器行为**:`/app/#/ai/knowledge` → rail 第 4 项「笔记」的实际渲染、
   `/ai/settings` 顶栏「详情」跳 `/ai/knowledge` 的实际导航、`?id=` 深链、
   tiptap 富文本在真浏览器里的编辑/工具栏高亮/Markdown 互转。全部只有 jsdom 覆盖。
2. **clipboard**:`copyPath` / `copyMine` 按 N 系列照抄蓝本、**无 `execCommand` 兜底**
   → 用户若以 HTTP-IP 访问(非安全上下文),复制会**静默失败**。已开票并写进 `NoteEditPane.vue:218-221`,
   但这是**用户验收时看得见的行为**,应主动告知。
3. **真实笔记 `.md` 文件的读写**:保存/归档/删除/冲突(409)对磁盘文件与后端 revision 的真实效果。
   冲突弹窗三动作全部只有 mock 覆盖;`sourceRefs.path` 与非空 `backlinks` 两个分支用的是
   **按 K41 接口构造的最小 fixture**(D-6,真机无样本)。
4. **`pointerDownOutside` 的 `setTimeout(0)`** 在真浏览器事件序下的稳定性(T6 评审已列为无法核验)。
5. **协调者给出的 base 基线 3515 本身是否正确** —— 只能核 base→HEAD 的差值自洽,不能回溯验基线。
