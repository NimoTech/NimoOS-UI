import { describe, it, expect } from 'vitest'
import { createI18n } from 'vue-i18n'
import zh from './zh_cn'
import en from './en_us'

describe('i18n message syntax', () => {
  describe('aiComposerPlaceholder and aiSlashNoFolders keys', () => {
    it('should resolve correctly in zh_cn and contain literal @', () => {
      const i18nZh = createI18n({
        legacy: false,
        locale: 'zh_cn',
        messages: { zh_cn: zh },
      })
      const message = i18nZh.global.t('aiComposerPlaceholder')
      expect(message).toContain('@')
      expect(message).toBe('问 Nimo，或输入 @ 引用文件…')
    })

    it('should resolve correctly in en_us aiComposerPlaceholder and contain literal @', () => {
      const i18nEn = createI18n({
        legacy: false,
        locale: 'en_us',
        messages: { en_us: en },
      })
      const message = i18nEn.global.t('aiComposerPlaceholder')
      expect(message).toContain('@')
      expect(message).toBe('Ask Nimo, or type @ to reference a file…')
    })

    it('should resolve correctly in en_us aiSlashNoFolders and contain literal @', () => {
      const i18nEn = createI18n({
        legacy: false,
        locale: 'en_us',
        messages: { en_us: en },
      })
      const message = i18nEn.global.t('aiSlashNoFolders')
      expect(message).toContain('@')
      expect(message).toBe('No visible directories — use @ to select one first')
    })

    it('should resolve correctly in zh_cn aiSlashNoFolders and contain literal @', () => {
      const i18nZh = createI18n({
        legacy: false,
        locale: 'zh_cn',
        messages: { zh_cn: zh },
      })
      const message = i18nZh.global.t('aiSlashNoFolders')
      expect(message).toContain('@')
      expect(message).toBe('还没有可见目录 —— 先用 @ 选一个')
    })
  })

  // SP8-P3b Task 2: aiSkScriptsHint / aiSkErrDescAngle both contain literal angle
  // brackets, written as {'<'}/{'>'} escapes (probe confirmed vue-i18n 9 renders bare
  // <>  without erroring too, but logs an "[intlify] Detected HTML" console warning —
  // the escaped form renders identically without that warning, so it's what's shipped).
  // Same failure mode as the P1c1 bare-@ incident this file was created to guard
  // against: pin the resolved rendering so a future edit that breaks the escape shows
  // up here instead of silently mangling the UI.
  describe('aiSkScriptsHint and aiSkErrDescAngle keys (angle-bracket escapes)', () => {
    it('should resolve the literal angle brackets in zh_cn aiSkScriptsHint', () => {
      const i18nZh = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
      const message = i18nZh.global.t('aiSkScriptsHint')
      expect(message).toBe('文件会保存在 bundle 的 scripts/<name> 路径下。')
    })

    it('should resolve the literal angle brackets in en_us aiSkScriptsHint', () => {
      const i18nEn = createI18n({ legacy: false, locale: 'en_us', messages: { en_us: en } })
      const message = i18nEn.global.t('aiSkScriptsHint')
      expect(message).toBe('Files are stored inside scripts/<name> in the bundle.')
    })

    it('should resolve the literal angle brackets in zh_cn aiSkErrDescAngle', () => {
      const i18nZh = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
      const message = i18nZh.global.t('aiSkErrDescAngle')
      expect(message).toBe('描述里不能包含 < 和 >')
    })

    it('should resolve the literal angle brackets in en_us aiSkErrDescAngle', () => {
      const i18nEn = createI18n({ legacy: false, locale: 'en_us', messages: { en_us: en } })
      const message = i18nEn.global.t('aiSkErrDescAngle')
      expect(message).toBe('Description cannot contain < or >')
    })
  })

  // SP8-P3b Task 2 后续修复(评审 Important):aiSkUninstallTitle/aiSkDeleteTitle 的
  // zh_cn 问号被手抖打成了全角 U+FF1F，而任务书表格与权威源
  // NimoOS-UI/src/assets/lang/zh_CN.json:931-932 都是半角 U+003F —— 违反「不许改
  // 标点」硬约束，且当时没有任何自动化断言覆盖这两个键的具体内容，只靠人工逐字符
  // grep 才抓到。这里补一条程序化守卫，钉死本期新增的这批 aiSk* 键（P3b Task 2 引入
  // 的 74 个）在 zh_cn 里不出现全角 ？/！/：。
  //
  // 范围有意收窄到"本期新增键"，不扩到全量 zh_cn.ts：既有键可能合法使用全角标点
  // （例如 P3a 期确认过 aiSkEmpty 权威源就是半角逗号，但没有逐一核对过全量文件里
  // 每个既有键的每种标点是否都对应半角权威源），把全量键都卷进来风险是把未经核对的
  // 假设编码成断言、制造新的误报。若后续任务要扩大覆盖面，应先逐键回权威源核对。
  describe('P3b Task 2 aiSk* keys — no accidental full-width punctuation', () => {
    // 与 zh_cn.ts 里 "// >>> SP8-P3b Task 2" ... "// <<< SP8-P3b Task 2" 标记块内的
    // 74 个新增键一一对应（见 p3b-task-2-report.md 的"新增键清单"）。
    const p3bTask2Keys = [
      'aiSkAddedName', 'aiSkAddSkill', 'aiSkAddTitle', 'aiSkCopyMd', 'aiSkCreate',
      'aiSkCreating', 'aiSkDelete', 'aiSkDeleteBody', 'aiSkDeletedName', 'aiSkDeleteFailed',
      'aiSkDeleteSkill', 'aiSkDeleteTitle', 'aiSkDescFormHint', 'aiSkDescPlaceholder',
      'aiSkDisable', 'aiSkDisableTemporarily', 'aiSkEnable', 'aiSkEnabledToast',
      'aiSkErrBadId', 'aiSkErrBadPath', 'aiSkErrBundleTooLarge', 'aiSkErrCreateFailed',
      'aiSkErrDescAngle', 'aiSkErrDescControl', 'aiSkErrDescRequired', 'aiSkErrDescSingleLine',
      'aiSkErrDescTooLong', 'aiSkErrDuplicate', 'aiSkErrMdTooLarge', 'aiSkExport',
      'aiSkFieldColor', 'aiSkFieldName', 'aiSkFilesSkippedTooBig', 'aiSkMdPlaceholderBody',
      'aiSkMdPlaceholderHead', 'aiSkNameHint', 'aiSkNamePlaceholder', 'aiSkNPrevRuns',
      'aiSkOptional', 'aiSkPausedToast', 'aiSkSavedLocally', 'aiSkScriptFiles',
      'aiSkScriptsHint', 'aiSkTestBootstrapping', 'aiSkTestClosed', 'aiSkTestCompleted',
      'aiSkTestDiscard', 'aiSkTestExamples', 'aiSkTestFailed', 'aiSkTestHint',
      'aiSkTestHttpFailed', 'aiSkTestOffBadge', 'aiSkTestOffTitle', 'aiSkTestPill',
      'aiSkTestPlaceholder', 'aiSkTestPlaceholderEx', 'aiSkTestRun', 'aiSkTestRunning',
      'aiSkTestRunningLabel', 'aiSkTestTitle', 'aiSkTestTryName', 'aiSkTrigDescAuto',
      'aiSkTrigDescManual', 'aiSkTrigDescSlash', 'aiSkTrigOptAuto', 'aiSkTrigOptSlash',
      'aiSkTryDisabledBody', 'aiSkTryDisabledTitle', 'aiSkTryEnableAndTry', 'aiSkUninstall',
      'aiSkUninstallBody', 'aiSkUninstalledName', 'aiSkUninstallTitle', 'aiSkUpdateFailed',
    ] as const

    it('covers exactly the 74 keys this task added (list itself does not drift)', () => {
      expect(p3bTask2Keys.length).toBe(74)
    })

    it('should not contain full-width ？, ！ or ： in any zh_cn value from this batch', () => {
      const fullWidthPunctuation = /[？！：]/
      const violations: Array<{ key: string; value: string }> = []
      for (const key of p3bTask2Keys) {
        const value = (zh as Record<string, unknown>)[key]
        if (typeof value !== 'string') continue
        if (fullWidthPunctuation.test(value)) violations.push({ key, value })
      }
      if (violations.length > 0) {
        const details = violations.map((v) => `${v.key} = "${v.value}"`).join('\n')
        expect.fail(
          `Found full-width ？/！/： in P3b Task 2 zh_cn values (should be half-width ?/!/: per the authoritative Vue2 zh_CN.json):\n${details}`
        )
      }
    })

    it('aiSkUninstallTitle and aiSkDeleteTitle end with a half-width "?" (U+003F), matching NimoOS-UI/src/assets/lang/zh_CN.json:931-932', () => {
      expect(zh.aiSkUninstallTitle).toBe('卸载这个技能?')
      expect(zh.aiSkUninstallTitle.codePointAt(zh.aiSkUninstallTitle.length - 1)).toBe(0x3f)
      expect(zh.aiSkDeleteTitle).toBe('删除这个技能?')
      expect(zh.aiSkDeleteTitle.codePointAt(zh.aiSkDeleteTitle.length - 1)).toBe(0x3f)
    })
  })

  describe('bare @ guard (unescaped @ detection)', () => {
    it('should not allow bare @ in any key (only {@} escapes or @:key references)', () => {
      const locales = [
        { name: 'zh_cn', messages: zh },
        { name: 'en_us', messages: en },
      ]

      const violations: Array<{ locale: string; key: string; value: string }> = []

      for (const { name, messages } of locales) {
        for (const [key, value] of Object.entries(messages)) {
          if (typeof value !== 'string') continue

          // Look for bare @ that is NOT:
          // 1. Part of {'@'} escape (vue-i18n literal interpolation)
          // 2. Part of @:key linked-message reference

          // Replace all valid @ patterns so we can detect any remaining bare @
          let testValue = value
          // Remove {'@'} escapes (handles both {'@'} and {'something'} patterns)
          testValue = testValue.replace(/\{'[^']*'\}/g, '')
          // Remove @:key patterns
          testValue = testValue.replace(/@:[a-zA-Z0-9_.]+/g, '')

          // Now check if there's any remaining @ in the string
          if (testValue.includes('@')) {
            violations.push({ locale: name, key, value })
          }
        }
      }

      if (violations.length > 0) {
        const details = violations
          .map((v) => `${v.locale}::${v.key} = "${v.value}"`)
          .join('\n')
        expect.fail(
          `Found bare @ in messages (must use {'@'} for literal @ or @:key for linked messages):\n${details}`
        )
      }
    })
  })
})
