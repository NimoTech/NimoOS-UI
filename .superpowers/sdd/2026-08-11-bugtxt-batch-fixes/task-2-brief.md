### Task 2: Bug 8 — 深色主题原生 select 弹出列表白底白字(console-svc)+ 守卫补洞

全仓唯一漏网的原生 `<select>` 是 `src/apps/views/AppConsolePage.vue:105` 的 `.console-svc`:背景 `var(--chip-bg)` 在深色主题是半透明白渐变,Chrome 把作者背景带进原生弹出列表 → 近白底 + `--fg: #ffffff` 白字。守卫测试 `src/styles/selectPopup.test.ts:140` 的正则 `/<select\b[^>]*>/g` 被该元素属性 `v-if="serviceNames.length > 1"` 里的 `>` 截断,拿不到 class 而静默跳过 —— 这是它漏网的原因。先修守卫(测试变红),再修样式(变绿)。

**Files:**
- Modify: `src/styles/selectPopup.test.ts:140`(select 标签提取正则)
- Modify: `src/apps/views/AppConsolePage.vue`(scoped style,`.console-svc:focus` 规则在 152 行,其后加 option 规则)

**Interfaces:**
- Consumes: 既有 token `--set-option-bg` / `--set-option-fg`(定义在 `src/styles/theme.sp9.css:108-109`(深)与 `:186-187`(浅),两套主题都有值,与已修复的 6 处 select 用法一致)
- Produces: 无新接口

- [ ] **Step 1: 修守卫正则(quote-aware)**

`src/styles/selectPopup.test.ts:140`:

```ts
// 旧
for (const m of template.matchAll(/<select\b[^>]*>/g)) {
// 新:属性值里可以有 >(如 v-if="a.length > 1"),必须跳过引号内内容再找标签闭合
for (const m of template.matchAll(/<select\b(?:"[^"]*"|'[^']*'|[^>])*>/g)) {
```

并在上方注释里补一句为什么(属性内 `>` 截断导致 console-svc 漏扫了一个发布周期)。

- [ ] **Step 2: 跑守卫,确认它现在逮到 console-svc(红)**

Run: `pnpm vitest run src/styles/selectPopup.test.ts`
Expected: FAIL,失败信息里列出 `AppConsolePage.vue  class="console-svc"`(若没红,说明正则没生效,停下排查,不许直接进 Step 3)

- [ ] **Step 3: 给 console-svc 钉住 option 实心底色**

在 `src/apps/views/AppConsolePage.vue` scoped style 的 `.console-svc:focus` 规则后加:

```css
/* Chrome 会把作者背景带进原生弹出列表:半透明渐变叠在默认白底上 ⇒ 深色主题下白底白字。
   与 .set-select 等 6 处同款修法:option 钉实心 token 底色。 */
.console-svc option,
.console-svc optgroup { background-color: var(--set-option-bg); color: var(--set-option-fg); }
```

- [ ] **Step 4: 跑守卫确认绿**

Run: `pnpm vitest run src/styles/selectPopup.test.ts`
Expected: PASS(含"至少扫到 10 个 select"的防空转用例)

- [ ] **Step 5: Commit**

```bash
git add src/styles/selectPopup.test.ts src/apps/views/AppConsolePage.vue
git commit -m "fix(apps): pin solid option colors on the console service select

The select-popup guard tokenized tags with /<select\b[^>]*>/ which is cut
short by '>' inside attribute values (v-if=\"... > 1\"), so console-svc was
silently skipped. Make the extractor quote-aware and fix the one select it
had been missing."
```

---

