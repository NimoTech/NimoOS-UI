### Task 3: `SmartViewCard.vue` —— 拼贴卡 + D15 占位态

**Files:**
- Create: `src/photos/components/SmartViewCard.vue`
- Create: `src/photos/components/__tests__/SmartViewCard.test.ts`
- Modify(按需): `src/styles/theme.css` + `docs/THEMING.md`
- Read-only 参考: `PhotosSmartViewsView.vue:244-285`(整个内联组件)、`photos-smartview.scss:26-117`

**Interfaces:**
- Consumes: `type SmartView`(T2)、T1 的键、`service.photos.thumbnailUrl`
- Produces:
  ```ts
  // props
  { sv: SmartView }
  // emits
  (e: 'open', id: string): void      // Vue2 emit 的是整个 sv 对象;New-UI 只给 id
                                     // (详情页自己 byId 取,§7e-2 的配套)
  ```

**结构规格(逐段照 Vue2 `:256-283`,漏渲染是最高频缺陷 —— 对着源码从头扫到尾、列清点表再动手):**

1. 根 `.sv-card`(`@click` → `emit('open', String(props.sv.id))`,`cursor: pointer`)。
2. `.sv-collage`(拼贴区):
   - `.sv-collage-main`(大图,占左侧)+ 两张小图(右侧上下)。**Vue2 `:252-253` 是 `main = sv.seeds[0]`、`rest = sv.seeds.slice(1)`,然后渲染 `rest[0]` / `rest[1]`。**
   - **D15 占位态**:`seeds` 少于 3 条时,缺的格子渲染 `.sv-collage-ph` 占位块(中性底 + 居中的 sparkles 图标),**不渲染 `<img>`**。三个格子各自独立判断(`seeds[0]` / `seeds[1]` / `seeds[2]` 是否存在)。占位底色用 `--chip-bg`、图标色用 `--fg-subtle`(**不要新增 token,先 grep 确认这两个存在**)。写注释登记 D15 与 Vue2 的差异(Vue2 会去时间线 `allPhotos` 拿无关照片冒充)。
   - 图片 `src` 走 `service.photos.thumbnailUrl(seedId, 'large')`。
   - `.sv-collage-overlay`(底部渐变遮罩,Vue2 `scss:51-55` 是写死深色到透明)→ **钉死 + `theme-exception`**。
   - `.sv-collage-badge`(左上):sparkles 图标(9px)+ `photosSvBadgeSmartView`。**压在照片上 ⇒ 前景钉死浅色 + `theme-exception`,禁用 `--on-accent`。**
   - `.sv-collage-status`(右上,`:data-paused="!sv.live"`):`.live-dot` + `sv.live ? photosSvLive : photosSvPaused`。**同样钉死浅色。** `[data-paused="true"]` 变体改点色(Vue2 `scss:88-90`)。
3. `.sv-meta`:
   - `.sv-name`(`<h3>`,`sv.name`)。**Vue2 `scss:94` 没有截断** —— 长名会撑破卡片;New-UI 加 `.one-line` 等价三件套(`overflow:hidden; text-overflow:ellipsis; white-space:nowrap`)**并且父级要 `min-width: 0`**(flex 子项省略的必要条件,P6b-T4 教训)。**偏离登记。**
   - `.sv-conds`:前 3 条 `sv.conds.slice(0, 3)` 各一个 `.sv-cond`;`sv.conds.length > 3` 时再一个 `.sv-cond` 显示 `+{N}`(N = `conds.length - 3`)。
   - `.sv-stats`:`<b>{count 千分位}</b>` + `photosSvPhotosCount`;`sv.addedThisWeek > 0` 时一个绿色 span(`photosSvAddedThisWeek`,`{n}`);`<span style="flex:1">` 撑开;`.sv-thresh-mini` 显示 `≥ {threshold}%`。
   - **千分位跟 locale**(偏离登记 12):`sv.count.toLocaleString(locale)`,`locale` 从 `useI18n().locale.value` 取。
   - **绿色**:Vue2 `:278` 是内联 `style="color:#34C759"`。改成 class + token(**先 grep `theme.css` 找现成的成功/正向色,没有再新增并两套主题给值 + THEMING.md 登记**)。
4. **token 映射**:`--text-1/2/3/4` → `--fg` / `--fg-muted` / `--fg-subtle` / `--fg-faint`;`--surface-2` → `--chip-bg`;`--line` → `--card-border`;`--r-lg`/`--r-sm` → `--radius` / `--radius-sm`;`--font-display` → `--font`;卡片底 `--surface-1` → `--card-bg`;卡片 hover 抬升照 Vue2 `scss:36-39`,阴影用 `--card-shadow-hi`。
5. **`.sv-card:hover` 与任何变体不冲突**(本组件无 hover 变体),但 `.sv-cond` 有无 hover 要回源核 `scss:96-102`;若有则按硬约束加 cssCascade 断言。

- [ ] **Step 1: 写失败测试**

必含用例:
- 结构清点:`.sv-collage` / `.sv-collage-badge` / `.sv-collage-status` / `.sv-name` / `.sv-conds` / `.sv-stats` / `.sv-thresh-mini` 各存在。
- **拼贴三格 × 4 种 seeds 长度**:`seeds.length === 0` → 3 个 `.sv-collage-ph`、0 个 `img`;`=== 1` → 1 img + 2 占位;`=== 2` → 2 img + 1 占位;`>= 3` → 3 img + 0 占位。**这 4 条是 D15 的主守卫。**
- `thumbnailUrl` 被调用的参数是 `(seeds[i], 'large')`,**不许断言字面 URL**。
- 条件 chips:`conds.length === 2` → 2 个 `.sv-cond` 且无 `+N`;`=== 3` → 3 个无 `+N`;`=== 7` → 4 个,最后一个文本含 `+4`。
- 状态 pill:`live: true` → 文案是 `photosSvLive` 的值且 `data-paused` 为 `"false"`;`live: false` → `photosSvPaused` 且 `"true"`。
- `addedThisWeek === 0` → 那个绿 span **不渲染**;`> 0` → 渲染且含数字。
- 点卡片 → `open` 事件,payload 是 **字符串** id(后端给数字 `7` 时也断言收到 `'7'`)。
- **千分位跟 locale**:`count: 1234` 在 `zh_cn` 与 `en_us` 下都渲染成 `1,234`(两个 locale 的分组符相同,**这条只能钉住「传了 locale 参数」不能区分值**)→ 改为**读组件源文本**断言 `toLocaleString(` 后面**有参数**(正则 `/toLocaleString\(\s*[a-zA-Z]/`),并注释说明为何用源文本断言。
- **前景色合规**:读样式块,断言 `.sv-collage-badge` / `.sv-collage-status` 所在规则**不含** `--on-accent`;每条钉死色声明的同行或紧上一行有 `theme-exception` 注释,且注释文本不含 `;` / `}` / 字面 `#`。
- **名称截断**:`.sv-name` 规则体含 `text-overflow: ellipsis`,且其父 `.sv-meta`(或 `.sv-name` 自身所在 flex 容器)含 `min-width: 0`。**先锚定规则体再断言属性**。
- **渐变遮罩**:`.sv-collage-overlay` 规则体含 `linear-gradient`(先锚定规则体)。

- [ ] **Step 2: 跑测试确认失败** — `pnpm exec vitest run src/photos/components/__tests__/SmartViewCard.test.ts`

- [ ] **Step 3: 实现(含按需新增绿色 token 两套主题 + THEMING.md 登记)**

- [ ] **Step 4: 跑测试 + color-guard,逐个删码验证**

Run: `pnpm exec vitest run src/photos/components/__tests__/SmartViewCard.test.ts src/styles/color-guard.test.ts`

删码清单:①占位态的 `v-if`/`v-else` 三处任取一处删掉 → 对应 seeds 长度用例红;②`+N` 的 `v-if` → 7 条件用例红;③`slice(0, 3)` → 3 条件用例红(会渲染 7 个);④`emit('open', String(...))` 的 `String()` → 数字 id 用例红;⑤`toLocaleString` 的 locale 参数 → 源文本正则用例红;⑥`.sv-name` 的 `text-overflow` → 截断用例红;⑦`min-width: 0` → 截断用例的第二条断言红。

- [ ] **Step 5: Commit**

```bash
git add src/photos/components/SmartViewCard.vue src/photos/components/__tests__/SmartViewCard.test.ts src/styles/theme.css docs/THEMING.md
git commit -m "feat(photos): P7a-T3 智能视图卡片 —— 拼贴 + D15 占位态 + 状态 pill"
```

---

