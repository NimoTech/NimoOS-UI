## Task 4: 收尾门 + 验收清单

**Files:**
- Create: `docs/superpowers/2026-08-09-sp15-p2a-acceptance.md`

- [ ] **Step 1: 跑全部六门**

```bash
pnpm exec vue-tsc --noEmit
pnpm test
pnpm exec vitest run src/i18n/parity.test.ts
node oss/export.mjs --out /tmp/claude-1000/-home-nimo-NimoTech/408f1faf-fbff-4bcc-b9b8-351f4f14b0c2/scratchpad/oss-out --no-commit --allow-dirty-oss
pnpm build
pnpm exec vitest run src/styles
```

把**实测数字**（文件数 / 用例数）记进验收文档，不要写「全绿」了事。

- [ ] **Step 2: CSS 注释自查**

```bash
grep -n '\*/' src/views/PhotosSmartViewDetail.vue
```

逐条确认每个 `*/` 都是正常的注释终止符，没有「`*` 紧贴 `/`」提前关闭注释的写法。

- [ ] **Step 3: 写验收清单**

新建 `docs/superpowers/2026-08-09-sp15-p2a-acceptance.md`，**第 0 步与第 1 行提示照抄设计文档 §2.1/§2.2**：

> **第 0 步（必做）**：本机既有的 9 个智能视图全部是语义条件、`live=0`、从未评估，
> `smart_view_matches` 是 0 行。**先在界面上新建一个「日期」条件的智能视图并置为 live**，
> 等它评估出自动匹配行。五种条件里只有 `semantic` 走 CLIP（撞 BE-1），`date` 是纯 SQL。
>
> **第 1 行提示**：**「已排除（N）」在旧的 9 个视图上永远不会出现**，因为后端移除是分层的
> —— 只有移除「自动匹配」的照片才产生排除行，手动钉住的照片被移除是直接删行。
> 这是数据不足，不是本期缺陷。

其余步骤：加照片后张数在**详情页头部与列表卡片上同时**变化 · 加照片失败时 picker 保持打开 ·
pin 角标只出现在手动钉住的照片上 · 选择态下点瓦片不开灯箱 · 移除成功退出选择态、
失败保持选择态 · 已排除分节默认折叠、点开后点照片可恢复 · 恢复后该照片回到匹配网格 ·
**浅色与深色两套主题都要看**（压在照片上的 pin 角标与恢复提示）。

- [ ] **Step 4: 提交**

```bash
git add docs/superpowers/2026-08-09-sp15-p2a-acceptance.md
git commit -m "docs(sp15): record the P2a gate results and the acceptance list

The list opens by having the owner create a date-conditioned smart view, because
the excluded band cannot be reached otherwise: removal only produces an excluded
row for an automatically matched photo, and every existing view on this device is
semantic, paused and never evaluated."
```

---

## 自审记录

**Spec 覆盖**：spec §1.1 的五项 —— service/store 数据层 T1 · `pinned` T1 · 详情页四块交互 T3 ·
改名 T2 · i18n T3。spec §4 的四个「照抄会错」处 —— ① `#82` 原地合并是非问题 → T1 Step 8 的
`refreshStats` 注释与「store 只需替换数组项」的实现；② 回拉放 action 内部 → T1 Step 8；
③ 改名是还债不是 1:1 → T2 开头的限定与提交信息；④ P1 已付一半 → T2 只改 import。
spec §5 错误处理五条 → T3 Step 3。spec §6 六门 → T4。spec §10 验收两条死约束 → T4 Step 3。

**类型一致性**：`pinAssets`/`restoreAssets` 返回 `number`，`removeAssets` 返回
`{unpinned, excluded}` —— T1 定义、T3 消费，T3 的 `r.unpinned + r.excluded` 与之匹配。
`excluded` 是 `Photo[]`，`loadExcluded` 无返回值。`Photo.pinned: boolean` 在 T1 定义、
T3 模板消费。

**自审逮到并已就地修掉的三处**（原稿把不确定性推给了实现者，现已查实写死）：

1. **`photosSelectedCount` 的参数名是 `count` 不是 `n`**（`已选择 {count} 项`）。原稿的
   `t('photosSelectedCount', { n: … })` 会把 `{count}` 原样渲染成字面量 —— 单测未必照得出来
   （断言 `toContain('1')` 时 `已选择 {count} 项` 里没有 1，其实会红；但若断言写松就漏了）。
2. **Select/Cancel 不新建键**：复用 `photosPersonSelect`（`选择`）与 `photosCancel`（`取消`），
   与 P1 的 `PhotosMomentDetail.vue` 一致。原稿写的 `photosSelect` **不存在**。
3. **`submitLabel` 必须传函数**而不是字符串 —— `photosAlbumPickerAdd` 是 `添加({count})`，
   传死字符串会让计数不跟着选择动。照 `PhotosAlbums.vue:171-173` 的既有写法。
   同时 picker 的开合改用 `:open` + `@update:open`。`v-model:open` 在语法上同样成立
   （组件确实声明了 `open` prop 与 `update:open` emit），这里只是与两个既有调用点保持一致。
