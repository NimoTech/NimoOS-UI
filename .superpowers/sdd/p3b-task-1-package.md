# Task 1 review package — 4bfabfc..HEAD

## commits
f613947 sp8-ai P3b Task 1: skills-styles write-half CSS base + pause icon

## diff --stat
 src/ai/components/icons/AgentIcon.vue |   3 +
 src/ai/styles/skills-styles.scss      | 290 +++++++++++++++++++++++++++++++++-
 src/ai/styles/tokens.scss             |  11 ++
 3 files changed, 296 insertions(+), 8 deletions(-)

## diff -U10
diff --git a/src/ai/components/icons/AgentIcon.vue b/src/ai/components/icons/AgentIcon.vue
index 8932d9b..8fe21e5 100644
--- a/src/ai/components/icons/AgentIcon.vue
+++ b/src/ai/components/icons/AgentIcon.vue
@@ -13,20 +13,23 @@ const PATHS: Record<string, string> = {
   mic: '<rect x="8" y="3" width="4" height="9" rx="2" /><path d="M5 10a5 5 0 0 0 10 0M10 15v3M7 18h6" />',
   image: '<rect x="3" y="3" width="14" height="14" rx="2" /><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" /><path d="M3 13l4-4 4 4 3-3 3 3" />',
   folder: '<path d="M3 6a1 1 0 0 1 1-1h3l2 2h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6z" />',
   search: '<circle cx="9" cy="9" r="5" /><path d="M13 13l4 4" />',
   sparkle: '<path d="M10 3l1.5 4.5L16 9l-4.5 1.5L10 15l-1.5-4.5L4 9l4.5-1.5L10 3zM16 13l.7 1.8L18.5 15l-1.8.7L16 17.5l-.7-1.8L13.5 15l1.8-.7L16 13z" fill="currentColor" stroke="none" />',
   chev: '<path d="M7 5l5 5-5 5" />',
   chevDown: '<path d="M5 7l5 5 5-5" />',
   check: '<path d="M4 10l4 4 8-8" />',
   x: '<path d="M5 5l10 10M15 5L5 15" />',
   play: '<path d="M6 4l10 6-10 6V4z" fill="currentColor" stroke="none" />',
+  // SP8-P3b Task 1 —— TestPanel(P3b)运行态用。20 单位坐标系,stroke 走 currentColor,
+  // 不传具名色。放在 play 相邻处(同属媒体控制类图标)。
+  pause: '<path d="M7 4v12M13 4v12"/>',
   code: '<path d="M7 6l-4 4 4 4M13 6l4 4-4 4M11 4l-2 12" />',
   star: '<path d="M10 2l2.5 5.5 5.5.6-4 4 1 5.5L10 15l-5 2.6 1-5.5-4-4 5.5-.6L10 2z" fill="currentColor" stroke="none" />',
   download: '<path d="M10 3v10M5 9l5 5 5-5"/><path d="M3 17h14"/>',
   // SP8-P2b 验收反馈(2026-07-30)新增:外链/在新标签页打开。20 单位坐标系,无需 scale 包裹。
   // 「Open Phoenix」原本借用 download,语义不符(它不下载任何东西,是开一个网页)。
   external: '<path d="M11 3h6v6"/><path d="M17 3l-8 8"/><path d="M15 11.5V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4.5"/>',
   upload: '<path d="M10 17V7M5 11l5-5 5 5"/><path d="M3 3h14"/>',
   trash: '<path d="M3 5h14M8 5V3h4v2M5 5l1 12h8l1-12"/>',
   settings: '<g transform="scale(0.8333)"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></g>',
   // SP8-P2b Task 1 —— 1:1 取自 Vue2 src/views/AI/Skills/SkillIcon.vue:24。
diff --git a/src/ai/styles/skills-styles.scss b/src/ai/styles/skills-styles.scss
index cea865a..85d62fb 100644
--- a/src/ai/styles/skills-styles.scss
+++ b/src/ai/styles/skills-styles.scss
@@ -170,21 +170,39 @@
 .sk-item-off {
   font-size: 10px; font-weight: 600;
   text-transform: uppercase;
   letter-spacing: 0.04em;
   padding: 1px 6px;
   border-radius: 999px;
   background: var(--bg-chip);
   color: var(--text-tertiary);
 }
 
-// `.set-app .sk-add-btn`(Vue2:153-163)不移植 —— 留给 P3b。
+// Vue2 skills-styles.scss:153-163 —— 就地实现(scoped 到 `.set-app` 下的理由与
+// Vue2 相同:压过 `.set-app button { background: transparent }` 重置,见本仓
+// settings-styles.scss:344,specificity (0,1,1) < 这里的 (0,2,0))。
+.set-app .sk-add-btn {
+  display: inline-flex; align-items: center; justify-content: center;
+  width: 30px; height: 30px;
+  border-radius: 8px;
+  background: var(--accent);
+  // 【协调者预先解歧义①】Vue2 skills-styles.scss:158 原文本身就带纯白色前景声明
+  // (不是缺失,是本仓禁色字面量,需脱色成 token)——实底 accent 按钮上的白字,
+  // 复用既有 `--text-on-accent`(两套主题皆有值,tokens.scss:59,267),
+  // 与本档 .sk-pill-try:hover(:246)同一处理。Task 8 会往这个按钮里塞 AgentIcon 且
+  // 不传具名 color(走 currentColor 继承),这条 color 声明就是它的前景色来源。
+  color: var(--text-on-accent);
+  cursor: pointer;
+  transition: all 120ms ease;
+  box-shadow: var(--shadow-sm);
+  &:hover { background: var(--accent-hover); transform: translateY(-1px); }
+}
 
 // Vue2 skills-styles.scss:164-177
 .sk-col-empty {
   padding: 40px 16px;
   text-align: center;
   color: var(--text-tertiary);
   font-size: 13px;
   code {
     background: var(--bg-chip);
     padding: 1px 5px;
@@ -239,22 +257,67 @@
   color: var(--accent);
   border: 1px solid var(--accent-soft);
   transition: all 120ms ease;
   white-space: nowrap;
   flex-shrink: 0;
   cursor: pointer;
   // Vue2 skills-styles.scss:223 原为纯白色(hover 时反白,实底 --accent 背景上的字色)。
   &:hover { background: var(--accent); color: var(--text-on-accent); }
 }
 
-// `.sk-pill-more`(225-234)/`.sw`(235-259)/`.sk-menu`(260-288)不移植 —— 留给 P3b
-// (`.sw` 已存在于 sk-shared.scss,但本任务范围不接线,照 brief 表办)。
+// Vue2 skills-styles.scss:225-234 —— 无色字面量,原样搬。
+.sk-pill-more {
+  width: 32px; height: 32px;
+  border-radius: 50%;
+  display: grid; place-items: center;
+  color: var(--text-secondary);
+  cursor: pointer;
+  &:hover { background: var(--bg-chip); color: var(--text-primary); }
+}
+
+// `.sw`(Vue2:235-259)开工第一步 grep 复核:确认已存在于 sk-shared.scss:66-88
+// (SP8-P2a Task 6 已移植,含 --switch-thumb/--switch-thumb-shadow 两个 token 的
+// 颜色处理),不重复定义。
+
+// Vue2 skills-styles.scss:260-288
+.sk-menu {
+  position: absolute;
+  top: 38px; right: 0;
+  width: 220px;
+  background: var(--bg-elevated);
+  border: 1px solid var(--line);
+  border-radius: var(--r-md);
+  box-shadow: var(--shadow-lg);
+  padding: 4px;
+  z-index: 10;
+  transform-origin: top right;
+  button {
+    width: 100%;
+    text-align: left;
+    display: flex; align-items: center; gap: 9px;
+    padding: 8px 10px;
+    border-radius: var(--r-sm);
+    font-size: 13px; font-weight: 500;
+    color: var(--text-primary);
+    transition: background 100ms ease;
+    &:hover { background: var(--bg-chip); }
+    &[data-danger="true"] {
+      color: var(--danger);
+      // Vue2 skills-styles.scss:283 原为 iOS 红色约 8% 透明度背景字面量——
+      // 本档统一约定(头部说明 + .sk-item-tag data-kind="manual"/"slash" 先例,
+      // 本档 :146,151):用 color-mix 从当前语义色 --danger 派生等比例透明度,
+      // 不新造字面量。
+      &:hover { background: color-mix(in srgb, var(--danger) 8%, transparent); }
+    }
+  }
+  hr { border: 0; border-top: 1px solid var(--line-faint); margin: 4px 0; }
+}
 
 // Vue2 skills-styles.scss:289-301
 .sk-detail-body {
   flex: 1;
   overflow-y: auto;
   padding: 22px 22px 80px;
   min-height: 0;
 }
 .sk-detail-inner {
   max-width: 820px;
@@ -351,21 +414,153 @@
     }
   }
   .name { flex: 1; font-weight: 500; }
   .size {
     font-variant-numeric: tabular-nums;
     font-size: 11px;
     color: var(--text-tertiary);
   }
 }
 
-// `.sk-test*` + `@keyframes skill-pulse`(392-513)不移植 —— 留给 P3b。
+// Test panel
+// Vue2 skills-styles.scss:392-398
+.sk-test {
+  border-radius: var(--r-lg);
+  background: var(--bg-elevated);
+  border: 1px solid var(--line);
+  overflow: hidden;
+  box-shadow: var(--shadow-sm);
+}
+// Vue2 skills-styles.scss:399-404
+.sk-test-head {
+  display: flex; align-items: center; gap: 10px;
+  padding: 12px 14px;
+  border-bottom: 1px solid var(--line-faint);
+  background: var(--bg-canvas);
+}
+// Vue2 skills-styles.scss:405-413
+.sk-test-pill {
+  font-size: 10px; font-weight: 700;
+  letter-spacing: 0.06em;
+  text-transform: uppercase;
+  padding: 2px 7px;
+  border-radius: 999px;
+  background: var(--accent-soft);
+  color: var(--accent);
+}
+// Vue2 skills-styles.scss:414-415
+.sk-test-title { font-size: 13px; font-weight: 600; }
+.sk-test-sub { font-size: 11px; color: var(--text-tertiary); }
+
+// Vue2 skills-styles.scss:417-444
+.sk-test-body { padding: 14px; }
+.sk-test-input {
+  display: flex; gap: 8px;
+  padding: 10px 12px;
+  border-radius: var(--r-md);
+  background: var(--bg-canvas);
+  border: 1px solid var(--line);
+  textarea {
+    flex: 1;
+    border: 0; outline: none; background: transparent; resize: none;
+    font-family: var(--font-sans);
+    font-size: 13px; line-height: 1.5;
+    color: var(--text-primary);
+    min-height: 36px;
+  }
+  button {
+    align-self: flex-end;
+    padding: 6px 12px;
+    font-size: 12px; font-weight: 500;
+    border-radius: var(--r-sm);
+    background: var(--accent);
+    // Vue2 skills-styles.scss:438 原为纯白色前景(实底 accent 按钮上的白字,
+    // 与 .sk-add-btn/.sk-pill-try:hover 同一场景)。复用既有 --text-on-accent。
+    color: var(--text-on-accent);
+    display: inline-flex; align-items: center; gap: 5px;
+    flex-shrink: 0;
+    cursor: pointer;
+    &[disabled] { background: var(--bg-chip); color: var(--text-quaternary); cursor: not-allowed; }
+  }
+}
+// Vue2 skills-styles.scss:445-479
+.sk-test-result {
+  margin-top: 12px;
+  background: var(--bg-sunken);
+  border: 1px solid var(--line-faint);
+  border-radius: var(--r-md);
+  padding: 12px 14px;
+  font-size: 13px;
+  line-height: 1.55;
+  color: var(--text-secondary);
+  .label {
+    display: flex; align-items: center; gap: 8px;
+    font-size: 11px;
+    text-transform: uppercase;
+    letter-spacing: 0.04em;
+    color: var(--text-tertiary);
+    font-weight: 600;
+    margin-bottom: 8px;
+    .bullet {
+      width: 6px; height: 6px; border-radius: 50%;
+      background: var(--success);
+      // Vue2 skills-styles.scss:465 原为 iOS 绿色约 18% 透明度发光圈字面量——
+      // 与 .sk-meta-cell 的「启用」态发光圈(本档 :302-306)完全同族同比例,
+      // 同样用 color-mix 从 --success 派生。
+      box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 18%, transparent);
+    }
+    &[data-state="running"] .bullet {
+      background: var(--accent);
+      animation: skill-pulse 1.4s ease-in-out infinite;
+    }
+  }
+  code {
+    font-family: var(--font-mono);
+    font-size: 12px;
+    background: var(--bg-elevated);
+    border: 1px solid var(--line-faint);
+    padding: 1px 5px;
+    border-radius: 4px;
+  }
+  .step-row {
+    display: flex; gap: 8px; align-items: flex-start;
+    margin: 4px 0;
+  }
+  .ex {
+    margin-top: 8px;
+    display: flex; flex-wrap: wrap; gap: 6px;
+    button {
+      font-size: 11.5px;
+      padding: 4px 9px;
+      border-radius: 999px;
+      background: var(--bg-elevated);
+      border: 1px solid var(--line);
+      color: var(--text-secondary);
+      transition: all 120ms ease;
+      cursor: pointer;
+      &:hover { border-color: var(--accent); color: var(--accent); }
+    }
+  }
+  .footer-note {
+    margin-top: 10px;
+    padding-top: 10px;
+    border-top: 1px solid var(--line-faint);
+    font-size: 11px;
+    color: var(--text-tertiary);
+    display: inline-flex; align-items: center; gap: 6px;
+  }
+}
+// Vue2 skills-styles.scss:508-511
+@keyframes skill-pulse {
+  0%,100% { opacity: 1; transform: scale(1); }
+  50%     { opacity: 0.6; transform: scale(0.85); }
+}
 
 // SKILL.md preview
 // Vue2 skills-styles.scss:514-547
 .sk-md {
   padding: 16px 18px;
   font-size: 13.5px;
   line-height: 1.65;
   color: var(--text-primary);
   pre {
     background: var(--bg-sunken);
@@ -445,26 +640,105 @@
     font-size: 15px; font-weight: 600; color: var(--text-primary);
     letter-spacing: normal; margin: 0;
   }
   .empty-sub {
     font-size: 13px; max-width: 320px;
     color: inherit; margin: 0;
   }
 }
 
 // `.sk-modal*`(575-616)已存在于 sk-shared.scss:96-136,`.sk-field*`(617-647)已存在
-// 于 sk-shared.scss:154-183,`.sk-trig-*`/`.sk-color-*`(648-685)不移植(留给 P3b),
-// `.sk-modal-foot`(686-697)已存在于 sk-shared.scss:139-150,`.sk-btn`(698-726)已
-// 存在于 sk-shared.scss:29-55,均不重复定义。
+// 于 sk-shared.scss:154-183,`.sk-modal-foot`(686-697)已存在于 sk-shared.scss:139-150,
+// `.sk-btn`(698-726)已存在于 sk-shared.scss:29-55,均不重复定义。
+
+// Vue2 skills-styles.scss:648-669 —— 无色字面量,原样搬。
+.sk-trig-options {
+  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
+}
+.sk-trig-option {
+  display: flex; flex-direction: column; gap: 4px;
+  padding: 10px 12px;
+  border-radius: var(--r-md);
+  background: var(--bg-canvas);
+  border: 1px solid var(--line);
+  cursor: pointer;
+  transition: all 120ms ease;
+  text-align: left;
+  &:hover { border-color: var(--line-strong); }
+  &[data-active="true"] {
+    border-color: var(--accent);
+    background: var(--accent-softer);
+    box-shadow: 0 0 0 3px var(--accent-softer);
+  }
+  .name { font-size: 13px; font-weight: 600; }
+  .desc { font-size: 11px; color: var(--text-tertiary); line-height: 1.35; }
+}
+
+// Vue2 skills-styles.scss:670-685
+.sk-color-row { display: flex; gap: 8px; align-items: center; }
+.sk-color-dot {
+  width: 28px; height: 28px;
+  border-radius: 9px;
+  cursor: pointer;
+  position: relative;
+  transition: transform 100ms ease;
+  // Vue2 skills-styles.scss:677 原为白色约 20% 透明度内描边发光字面量——
+  // 与 .sk-tile(本档 :123)的 --gloss-inset 同族(彩色色块 + 白色内描边发光),
+  // 但 Vue2 两处字面量透明度不同(约 20% 对约 18%)。按本仓
+  // 既有惯例(同族不同值 → 各开独立 token 以精确保留原值,先例 tokens.scss:175-180
+  // 的 --modal-scrim-soft 相对 --modal-scrim)新增 --gloss-inset-dot,不与
+  // --gloss-inset 合并复用(会引入可见的透明度漂移)。见 tokens.scss 新增处。
+  box-shadow: var(--gloss-inset-dot), var(--shadow-xs);
+  &:hover { transform: translateY(-1px); }
+  &[data-active="true"]::after {
+    content: ""; position: absolute; inset: -3px;
+    border-radius: 11px;
+    border: 2px solid var(--accent);
+  }
+  // 【偏离(公共约束 §3 偏离 8,brief §1.2 第二条)】Vue2 AddSkillModal.vue:61 用
+  // `:style="{ background: c.bg }"` 内联传底色字面量(渐变字符串)—— 本仓禁止内联
+  // 颜色。改为 `data-color` 属性 + 下面 7 条静态规则,值取 P3a Task 1 已建的
+  // `--grad-sk-*` 7 个 token(tokens.scss:228-234,已 grep 逐个复核存在且拼写一致)。
+  // 7 个 id(blue/purple/pink/orange/green/teal/slate)取自 Vue2 SkillTile.vue:18-26
+  // COLORS 的 key,与本仓 SkillTile.vue 的 SKILL_COLOR_IDS 逐一比对一致。Task 5
+  // (AddSkillModal 组件)负责在 dot 元素上写 `:data-color="c.id"`。
+  &[data-color="blue"]   { background: var(--grad-sk-blue); }
+  &[data-color="purple"] { background: var(--grad-sk-purple); }
+  &[data-color="pink"]   { background: var(--grad-sk-pink); }
+  &[data-color="orange"] { background: var(--grad-sk-orange); }
+  &[data-color="green"]  { background: var(--grad-sk-green); }
+  &[data-color="teal"]   { background: var(--grad-sk-teal); }
+  &[data-color="slate"]  { background: var(--grad-sk-slate); }
+}
 
 // `.sk-toast` + `@keyframes sk-toast-rise`(727-753)永不移植 —— 改用全局 AppToast
-// (公共约束 §3 偏离 3)。`.sk-confirm*`(754-773)不移植 —— 留给 P3b。
+// (公共约束 §3 偏离 3)。
+
+// Vue2 skills-styles.scss:754-773 —— 无色字面量,原样搬。
+.sk-confirm { width: min(420px, 100%); }
+.sk-confirm-body {
+  padding: 22px 22px 8px;
+  text-align: left;
+  h3 { font-size: 16px; font-weight: 600; margin: 0 0 6px; letter-spacing: -0.01em; }
+  p { font-size: 13px; color: var(--text-secondary); margin: 0; line-height: 1.5; }
+}
+.sk-confirm-skill {
+  margin-top: 12px;
+  padding: 10px 12px;
+  display: flex; align-items: center; gap: 10px;
+  background: var(--bg-canvas);
+  border: 1px solid var(--line-faint);
+  border-radius: var(--r-md);
+  .skill-line { flex: 1; min-width: 0; }
+  .name { font-size: 13px; font-weight: 600; }
+  .runs { font-size: 11px; color: var(--text-tertiary); }
+}
 
 // Spinner (for list loading)
 // Vue2 skills-styles.scss:774-781
 .sk-spinner {
   width: 18px; height: 18px;
   border-radius: 50%;
   border: 2px solid var(--line);
   border-top-color: var(--accent);
   animation: sk-spin 700ms linear infinite;
 }
diff --git a/src/ai/styles/tokens.scss b/src/ai/styles/tokens.scss
index 483f94f..57d5614 100644
--- a/src/ai/styles/tokens.scss
+++ b/src/ai/styles/tokens.scss
@@ -145,20 +145,28 @@
   --danger-soft-faint: rgba(215, 73, 59, 0.06);
   /* Lighter purple gradient stop (McpCallCard tile) — decorative, not redefined
      per-theme, same convention as --purple itself not being redefined in dark. */
   --purple-light: #C18CFF;
   --teal-soft: rgba(48, 176, 199, 0.12);
   /* Fixed-darkness scrim for photo-thumbnail hover overlays — intentionally same
      value in both themes (a darkening overlay on an image, not a UI surface). */
   --scrim-dark: rgba(0, 0, 0, 0.35);
   /* Tiny inset gloss highlight on colored tiles (McpCallCard) — same in both themes. */
   --gloss-inset: inset 0 0 0 0.5px rgba(255, 255, 255, 0.18);
+  /* SP8-P3b Task 1 — same "colored chip + white inset gloss" family as
+     --gloss-inset above, used by .sk-color-dot (skills-styles.scss) in the
+     AddSkillModal color picker. Vue2 source (skills-styles.scss:677) uses a
+     distinct opacity (0.2) from --gloss-inset's 0.18 — kept as its own token to
+     preserve Vue2's exact value rather than drift by reusing --gloss-inset
+     (same precedent as --modal-scrim-soft being separate from --modal-scrim
+     below). Theme-invariant chrome, same in both themes. */
+  --gloss-inset-dot: inset 0 0 0 0.5px rgba(255, 255, 255, 0.2);
 
   /* SP8-P1b Task 9 — SearchImageLightbox is a fullscreen black "stage" (a photo
      viewer chrome, like Photos/Preview), intentionally theme-invariant — same
      rationale as --scrim-dark/--gloss-inset above, not a skin surface. */
   --overlay-scrim: rgba(0, 0, 0, 0.92);
   --overlay-fg-strong: rgba(255, 255, 255, 0.95);
   --overlay-fg-soft: rgba(255, 255, 255, 0.6);
   --overlay-chip-bg: rgba(255, 255, 255, 0.1);
   --overlay-chip-bg-hover: rgba(255, 255, 255, 0.2);
   --overlay-chip-border: rgba(255, 255, 255, 0.16);
@@ -301,20 +309,23 @@
   --danger-soft-border: rgba(240, 119, 107, 0.24);
   --purple-soft: rgba(175, 82, 222, 0.18);
   --purple-soft-border: rgba(175, 82, 222, 0.26);
   --purple-soft-faint: rgba(175, 82, 222, 0.11);
   --success-soft-faint: rgba(79, 184, 112, 0.11);
   --danger-soft-faint: rgba(240, 119, 107, 0.1);
   --purple-light: #C18CFF;
   --teal-soft: rgba(48, 176, 199, 0.2);
   --scrim-dark: rgba(0, 0, 0, 0.35);
   --gloss-inset: inset 0 0 0 0.5px rgba(255, 255, 255, 0.18);
+  /* SP8-P3b Task 1 — dark-theme value for --gloss-inset-dot above (same value as
+     light block — theme-invariant, see comment there). */
+  --gloss-inset-dot: inset 0 0 0 0.5px rgba(255, 255, 255, 0.2);
 
   /* SP8-P1b Task 9 — same values as light block (all theme-invariant chrome, see
      comments there); dark-theme copies exist only to satisfy "every token has a
      value in both blocks" for tokens that aren't var()-composed. */
   --overlay-scrim: rgba(0, 0, 0, 0.92);
   --overlay-fg-strong: rgba(255, 255, 255, 0.95);
   --overlay-fg-soft: rgba(255, 255, 255, 0.6);
   --overlay-chip-bg: rgba(255, 255, 255, 0.1);
   --overlay-chip-bg-hover: rgba(255, 255, 255, 0.2);
   --overlay-chip-border: rgba(255, 255, 255, 0.16);
