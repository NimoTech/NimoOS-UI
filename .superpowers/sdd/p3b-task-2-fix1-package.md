# Task 2 fix round 1 — b8357ee..HEAD

## commits
f4a859d sp8-ai P3b Task 2 fix: half-width punctuation + real byte constant (review T2)

## diff --stat
 src/ai/util/skillsErrorKey.test.ts |  7 +++--
 src/i18n/messageSyntax.test.ts     | 63 ++++++++++++++++++++++++++++++++++++++
 src/i18n/zh_cn.ts                  |  4 +--
 3 files changed, 70 insertions(+), 4 deletions(-)

## diff -U10
diff --git a/src/ai/util/skillsErrorKey.test.ts b/src/ai/util/skillsErrorKey.test.ts
index c6c4e75..2414e12 100644
--- a/src/ai/util/skillsErrorKey.test.ts
+++ b/src/ai/util/skillsErrorKey.test.ts
@@ -49,22 +49,25 @@ describe('createSkillErrorKey', () => {
   })
 
   it('maps "invalid file path in bundle"', () => {
     expect(createSkillErrorKey(errWith('invalid file path in bundle'))).toBe('aiSkErrBadPath')
   })
 
   it('maps "bundle exceeds size limits"', () => {
     expect(createSkillErrorKey(errWith('bundle exceeds size limits'))).toBe('aiSkErrBundleTooLarge')
   })
 
-  it('maps "SKILL.md exceeds 32768 bytes (got 40000)" (case-insensitive)', () => {
-    expect(createSkillErrorKey(errWith('SKILL.md exceeds 32768 bytes (got 40000)'))).toBe(
+  // MaxSkillMDBytes = 50 * 1024 = 51200 (NimoOS-AI/service/skills_store.go:121); the
+  // error is fmt.Errorf("SKILL.md exceeds %d bytes (got %d)", MaxSkillMDBytes, size)
+  // at skills_store.go:155/229. Real limit, not a made-up number.
+  it('maps "SKILL.md exceeds 51200 bytes (got 60000)" (case-insensitive)', () => {
+    expect(createSkillErrorKey(errWith('SKILL.md exceeds 51200 bytes (got 60000)'))).toBe(
       'aiSkErrMdTooLarge'
     )
   })
 
   it('falls back to aiSkErrCreateFailed for an unrecognized backend string', () => {
     expect(createSkillErrorKey(errWith('something went sideways'))).toBe('aiSkErrCreateFailed')
   })
 
   it('falls back to aiSkErrCreateFailed when no error string can be extracted', () => {
     expect(createSkillErrorKey(new Error('network down'))).toBe('aiSkErrCreateFailed')
diff --git a/src/i18n/messageSyntax.test.ts b/src/i18n/messageSyntax.test.ts
index 6e6e93f..3dc6113 100644
--- a/src/i18n/messageSyntax.test.ts
+++ b/src/i18n/messageSyntax.test.ts
@@ -76,20 +76,83 @@ describe('i18n message syntax', () => {
       expect(message).toBe('描述里不能包含 < 和 >')
     })
 
     it('should resolve the literal angle brackets in en_us aiSkErrDescAngle', () => {
       const i18nEn = createI18n({ legacy: false, locale: 'en_us', messages: { en_us: en } })
       const message = i18nEn.global.t('aiSkErrDescAngle')
       expect(message).toBe('Description cannot contain < or >')
     })
   })
 
+  // SP8-P3b Task 2 后续修复(评审 Important):aiSkUninstallTitle/aiSkDeleteTitle 的
+  // zh_cn 问号被手抖打成了全角 U+FF1F，而任务书表格与权威源
+  // NimoOS-UI/src/assets/lang/zh_CN.json:931-932 都是半角 U+003F —— 违反「不许改
+  // 标点」硬约束，且当时没有任何自动化断言覆盖这两个键的具体内容，只靠人工逐字符
+  // grep 才抓到。这里补一条程序化守卫，钉死本期新增的这批 aiSk* 键（P3b Task 2 引入
+  // 的 74 个）在 zh_cn 里不出现全角 ？/！/：。
+  //
+  // 范围有意收窄到"本期新增键"，不扩到全量 zh_cn.ts：既有键可能合法使用全角标点
+  // （例如 P3a 期确认过 aiSkEmpty 权威源就是半角逗号，但没有逐一核对过全量文件里
+  // 每个既有键的每种标点是否都对应半角权威源），把全量键都卷进来风险是把未经核对的
+  // 假设编码成断言、制造新的误报。若后续任务要扩大覆盖面，应先逐键回权威源核对。
+  describe('P3b Task 2 aiSk* keys — no accidental full-width punctuation', () => {
+    // 与 zh_cn.ts 里 "// >>> SP8-P3b Task 2" ... "// <<< SP8-P3b Task 2" 标记块内的
+    // 74 个新增键一一对应（见 p3b-task-2-report.md 的"新增键清单"）。
+    const p3bTask2Keys = [
+      'aiSkAddedName', 'aiSkAddSkill', 'aiSkAddTitle', 'aiSkCopyMd', 'aiSkCreate',
+      'aiSkCreating', 'aiSkDelete', 'aiSkDeleteBody', 'aiSkDeletedName', 'aiSkDeleteFailed',
+      'aiSkDeleteSkill', 'aiSkDeleteTitle', 'aiSkDescFormHint', 'aiSkDescPlaceholder',
+      'aiSkDisable', 'aiSkDisableTemporarily', 'aiSkEnable', 'aiSkEnabledToast',
+      'aiSkErrBadId', 'aiSkErrBadPath', 'aiSkErrBundleTooLarge', 'aiSkErrCreateFailed',
+      'aiSkErrDescAngle', 'aiSkErrDescControl', 'aiSkErrDescRequired', 'aiSkErrDescSingleLine',
+      'aiSkErrDescTooLong', 'aiSkErrDuplicate', 'aiSkErrMdTooLarge', 'aiSkExport',
+      'aiSkFieldColor', 'aiSkFieldName', 'aiSkFilesSkippedTooBig', 'aiSkMdPlaceholderBody',
+      'aiSkMdPlaceholderHead', 'aiSkNameHint', 'aiSkNamePlaceholder', 'aiSkNPrevRuns',
+      'aiSkOptional', 'aiSkPausedToast', 'aiSkSavedLocally', 'aiSkScriptFiles',
+      'aiSkScriptsHint', 'aiSkTestBootstrapping', 'aiSkTestClosed', 'aiSkTestCompleted',
+      'aiSkTestDiscard', 'aiSkTestExamples', 'aiSkTestFailed', 'aiSkTestHint',
+      'aiSkTestHttpFailed', 'aiSkTestOffBadge', 'aiSkTestOffTitle', 'aiSkTestPill',
+      'aiSkTestPlaceholder', 'aiSkTestPlaceholderEx', 'aiSkTestRun', 'aiSkTestRunning',
+      'aiSkTestRunningLabel', 'aiSkTestTitle', 'aiSkTestTryName', 'aiSkTrigDescAuto',
+      'aiSkTrigDescManual', 'aiSkTrigDescSlash', 'aiSkTrigOptAuto', 'aiSkTrigOptSlash',
+      'aiSkTryDisabledBody', 'aiSkTryDisabledTitle', 'aiSkTryEnableAndTry', 'aiSkUninstall',
+      'aiSkUninstallBody', 'aiSkUninstalledName', 'aiSkUninstallTitle', 'aiSkUpdateFailed',
+    ] as const
+
+    it('covers exactly the 74 keys this task added (list itself does not drift)', () => {
+      expect(p3bTask2Keys.length).toBe(74)
+    })
+
+    it('should not contain full-width ？, ！ or ： in any zh_cn value from this batch', () => {
+      const fullWidthPunctuation = /[？！：]/
+      const violations: Array<{ key: string; value: string }> = []
+      for (const key of p3bTask2Keys) {
+        const value = (zh as Record<string, unknown>)[key]
+        if (typeof value !== 'string') continue
+        if (fullWidthPunctuation.test(value)) violations.push({ key, value })
+      }
+      if (violations.length > 0) {
+        const details = violations.map((v) => `${v.key} = "${v.value}"`).join('\n')
+        expect.fail(
+          `Found full-width ？/！/： in P3b Task 2 zh_cn values (should be half-width ?/!/: per the authoritative Vue2 zh_CN.json):\n${details}`
+        )
+      }
+    })
+
+    it('aiSkUninstallTitle and aiSkDeleteTitle end with a half-width "?" (U+003F), matching NimoOS-UI/src/assets/lang/zh_CN.json:931-932', () => {
+      expect(zh.aiSkUninstallTitle).toBe('卸载这个技能?')
+      expect(zh.aiSkUninstallTitle.codePointAt(zh.aiSkUninstallTitle.length - 1)).toBe(0x3f)
+      expect(zh.aiSkDeleteTitle).toBe('删除这个技能?')
+      expect(zh.aiSkDeleteTitle.codePointAt(zh.aiSkDeleteTitle.length - 1)).toBe(0x3f)
+    })
+  })
+
   describe('bare @ guard (unescaped @ detection)', () => {
     it('should not allow bare @ in any key (only {@} escapes or @:key references)', () => {
       const locales = [
         { name: 'zh_cn', messages: zh },
         { name: 'en_us', messages: en },
       ]
 
       const violations: Array<{ locale: string; key: string; value: string }> = []
 
       for (const { name, messages } of locales) {
diff --git a/src/i18n/zh_cn.ts b/src/i18n/zh_cn.ts
index 9edca66..5b7da79 100644
--- a/src/i18n/zh_cn.ts
+++ b/src/i18n/zh_cn.ts
@@ -1239,22 +1239,22 @@ export default {
   // 加粗行(见任务书 §2.3)在下方逐条标注为「Vue2 没有的新文案」。
   aiSkAddSkill: '添加技能',
   aiSkDisable: '禁用',
   aiSkEnable: '启用',
   aiSkDisableTemporarily: '临时禁用',
   aiSkCopyMd: '复制 SKILL.md',
   aiSkExport: '导出技能',
   aiSkUninstall: '卸载',
   aiSkDeleteSkill: '删除技能',
   aiSkDelete: '删除', // 拍板不复用 aiConfirm(P1a 弹窗标题误用按钮文案的历史遗留),按任务书新增
-  aiSkUninstallTitle: '卸载这个技能？',
-  aiSkDeleteTitle: '删除这个技能？',
+  aiSkUninstallTitle: '卸载这个技能?',
+  aiSkDeleteTitle: '删除这个技能?',
   // 新文案(D3 拍板):Vue2 SkillDetail.vue:161 承诺「以后可从内置目录重新安装」,
   // 但后端 service/skills.go:330-340 只写 uninstalled=1 标记、全仓无恢复接口 —— 说实话。
   aiSkUninstallBody:
     '技能将从这台 NAS 移除。此界面无法恢复,需要重装系统或手工把技能目录放回。',
   aiSkDeleteBody: '这会永久删除该技能及其 SKILL.md 文件,无法恢复。',
   aiSkNPrevRuns: '历史运行 {count} 次',
   aiSkEnabledToast: '技能已启用',
   aiSkPausedToast: '技能已暂停',
   aiSkUpdateFailed: '更新失败',
   aiSkUninstalledName: '已卸载 {name}',
