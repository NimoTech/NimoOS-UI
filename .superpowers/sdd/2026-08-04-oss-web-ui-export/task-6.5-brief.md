# Task 6.5(计划外新增):给泄漏守卫补中文词条

**Files:**
- Modify: `oss/forbidden.mjs`(词表 + 白名单)
- Test: `oss/forbidden.test.mjs`(追加用例)
- Create: `.superpowers/sdd/2026-08-04-oss-web-ui-export/chinese-leaks.md`(交接清单,不进 git)

**为什么临时插这个任务**

`oss/forbidden.mjs` 是整条导出流水线上**唯一**能拦住「AI/相册/搜索痕迹漏进开源包」的闸。
但它的词表里**只有「相册」一个中文词** —— 而本代码库的注释与界面文案是**全中文的**。

已实测的盲区(`scanText('src/x.ts', '// 这里提到<词>')` 的命中数):

| 词 | 出现在几个源文件 | 守卫命中 |
|---|---|---|
| 搜索 | 8 | **0** |
| 照片 | 7 | **0** |
| 转录 | 4 | **0** |
| 说话人 | 4 | **0** |
| 知识库 | 2 | **0** |
| 向量化 | 3 | **0** |
| 智能 | 5 | **0** |

Task 6 的评审就是被这个盲区绊到的:`HomeTopbar.vue` 里一句
`/* …保留搜索与主题切换 */` 会原样进开源包,而守卫抓不到 —— 那是一处**静默**泄漏,
没有任何门会拦住它。

必须在 T7–T13 之前补上,否则那 7 个任务各自漏下的中文痕迹会一直堆到 T14 才一起爆,
而且 T14 会膨胀成一个巨型任务。

---

## 目标

1. 给 `HARD` / `SOFT` 补中文词条,使「用中文写的 AI/相册/搜索痕迹」也会被抓到。
2. 用**精确白名单**处理由此产生的误报 —— **禁止用放宽词表来消除误报**(这是本项目的铁律)。
3. 产出一份交接清单,把现存的中文泄漏按「归属哪个后续任务」分类,供 T7/T8/T11/T13 直接消费。

## 非目标

- **不修**任何中文泄漏本身(那是 T7/T8/T11/T13 各自的活)。本任务只让守卫**看得见**它们。
- 不动 `oss/manifest.mjs` / `oss/apply.mjs` / `oss/export.mjs`。
- 不动 `src/**` 任何产品代码。

---

## 词条设计要求

### 候选硬禁词(出现即失败,无白名单)

先自己核实每一条在本仓的实际出现情况,再决定放 HARD 还是 SOFT。**判据**:
若一个词在本仓的**所有**出现都属于「该剥离的功能」→ HARD;若存在合法用法 → SOFT + 精确白名单。

至少要覆盖这些语义:相册(已有)· 转录 · 说话人 · 知识库 · 向量化 · Ask Nimo 的中文说法。

### 候选软禁词(需要白名单)

`搜索` · `照片` · `智能`。这三个一定有合法用法,例如:

- **应用商店的筛选框**:`appsStoreSearch: '搜索应用…'`、`StorePage.vue` 里的筛选提示 —— **保留面**
- **RAID 用途说明**:`raidLevel1Usecase: '照片库、个人 NAS、启动卷'` —— 与相册 app 无关,**保留面**
- **系统目录**:`/DATA/Gallery` 的中文显示名若有 —— **保留面**
- `智能` 可能出现在与 AI 无关的措辞里,自己查

### 一个重要的坑:「语义」不要收

实测「语义」出现在 **51 个**源文件里,绝大多数是「语义 token」「语义化命名」这类 CSS/设计系统用语,
与 AI 的「语义搜索」无关。收它会制造巨量误报,**不要收**。
若你认为确实需要覆盖「语义搜索」这个组合,只收**词组**(如 `语义搜索`),不要收单字词。

### 白名单纪律(与既有实现一致)

- 一律按「文件正则 + 该文件里允许的整行正则」豁免,**绝不按行号**。
- 白名单宁可细、词表宁可宽。**禁止**为了消除误报而删词或放宽正则。

---

## 交接清单的格式要求

写进 `.superpowers/sdd/2026-08-04-oss-web-ui-export/chinese-leaks.md`,按**归属任务**分组,
每条给出 `文件:行` + 原文片段 + 一句「为什么这是泄漏」。归属判断依据:

| 归属 | 范围 |
|---|---|
| T7 | 设置区(`src/settings/**`)· Service 侧 · 注释洗白 · `.gitignore` |
| T8 | i18n 四个 locale 文件 · `src/styles/theme*.css` |
| T9 | `src/home/grid/defaultLayout.ts` |
| T10 | `src/files/viewers/MediaViewer.vue` |
| T11 | `src/home/components/AddPanel.vue` |
| T13 | 所有 `*.test.ts` |
| T14 | 需要加白名单的误报 · 以及不属于上面任何一档的零散项 |
| 已解决 | 已被 DELETE 表整体删除的文件里的命中(列出来但标注「随文件删除」) |

**这份清单是本任务最有价值的产出** —— 它决定后面 7 个任务各自还要补多少。

---

## Steps

- [ ] **Step 1:先测量,别先改**

在**产出树**上跑一次守卫,拿到当前基线。产出树用:

```bash
node oss/export.mjs --out /tmp/t65-tree --skip-guard --no-commit --allow-dirty-oss
```

然后对 `/tmp/t65-tree` 用你自己写的一次性脚本扫上面那些候选中文词(**先不改 forbidden.mjs**),
把命中逐条列出来。**这一步的输出就是交接清单的原料。**

注意:产出树里此刻仍有一批「后面任务才会删/改」的文件(`AddPanel.vue`、`defaultLayout.ts`、
`MediaViewer.vue`、全部 `*.test.ts`),它们的命中要归到对应任务,不要当成"必须现在修"。

- [ ] **Step 2:写失败测试**

在 `oss/forbidden.test.mjs` 追加一个 describe,断言:
- 中文痕迹**必须命中**:至少覆盖「保留搜索与主题切换」这类注释、「转录」「说话人」「知识库」「向量化」
- 合法中文用法**必须不命中**:`appsStoreSearch: '搜索应用…'`(i18n 文件)· `raidLevel1Usecase: '照片库、个人 NAS、启动卷'`(i18n 文件)· 含「语义 token」的 CSS 注释
- 用**真实文件里的原样文本**做样本,别自编简化版(本项目历史上手编 fixture 栽过三次)

- [ ] **Step 3:跑测试确认失败**

```bash
pnpm exec vitest run oss/forbidden.test.mjs
```
预期:新增的「必须命中」用例红。

- [ ] **Step 4:改词表**

按「词条设计要求」加 HARD/SOFT 词条与精确白名单。每加一条,重跑 Step 1 的扫描脚本,
观察新增命中里哪些是真泄漏、哪些是误报,误报**只能**加白名单。

- [ ] **Step 5:跑测试确认通过 + 既有用例不许变红**

```bash
pnpm exec vitest run oss/forbidden.test.mjs   # 含既有 13 例
pnpm exec vitest run oss/tree.test.mjs        # 17 例,确认没被牵连
```

- [ ] **Step 6:写交接清单**

按上面的格式写 `chinese-leaks.md`。

- [ ] **Step 7:提交(注意 pathspec)**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add oss/forbidden.mjs oss/forbidden.test.mjs
git commit -m "feat(oss): 泄漏守卫补中文词条(本库注释全中文,原词表只有「相册」一个中文词)"
```

(`chinese-leaks.md` 在 `.superpowers/` 下,是 gitignore 的,不入库。)

---

## 验收

1. 中文痕迹会被抓到:`scanText` 对「保留搜索与主题切换」「转录文稿」「说话人」等返回非空
2. 合法中文用法零误报:应用商店筛选、RAID 照片库用途说明、CSS 语义 token
3. `oss/forbidden.test.mjs` 全绿(既有 13 例 + 新增),输出干净无告警
4. `oss/tree.test.mjs` 17 例仍全绿
5. `chinese-leaks.md` 按归属任务分组、每条带 `文件:行` 与原文
