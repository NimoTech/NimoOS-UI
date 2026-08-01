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

  // SP8-P5a Task 8 review finding (裁定 R7,Important):RED probe during review showed
  // that flipping a half-width comma to full-width in aiKbDistillFromChats, and
  // renaming {n} to {count} in only one locale for aiKbRunningIndexed, both left the
  // full suite green (307/2742) — no existing guard covered this batch. Extending the
  // P3b Task 2 pattern above (same shape: a fixed key list + a scoped punctuation
  // scan) to this batch's 94 aiKb* keys (T8's main table; T5's aiKbDeferredTitle/
  // aiKbDeferredHint are new copy with no Vue2 source and are intentionally excluded).
  describe('P5a Task 8 aiKb* keys — no accidental full-width punctuation (except a registered Vue2-authentic one)', () => {
    // Matches the >>> SP8-P5a Task 8 ... <<< SP8-P5a Task 8 marked block in zh_cn.ts /
    // en_us.ts (see p5a-task-8-report.md "新增 94 条" list). Deliberately excludes the
    // 2 keys T5 already landed (aiKbDeferredTitle/aiKbDeferredHint) — those are new
    // copy with no Vue2 source, out of scope for a Vue2-punctuation guard.
    const p5aTask8Keys = [
      'aiKbKnowledgeBase', 'aiKbBrowse', 'aiKbStatus', 'aiKbIndexer', 'aiKbLastSynced',
      'aiKbRefresh', 'aiKbRefreshed', 'aiKbOffline', 'aiKbPaused', 'aiKbRunningIndexed',
      'aiKbMore', 'aiKbServiceOfflineBanner', 'aiKbNavDashboard', 'aiKbNavSearch',
      'aiKbNavWiki', 'aiKbNavNotes', 'aiKbNavIndexedFiles', 'aiKbNavQueue', 'aiKbNavRoots',
      'aiKbNavAllowlist', 'aiKbNavSettings', 'aiKbTitleWikiMap', 'aiKbTitleJobQueue',
      'aiKbTitleAdvancedSettings', 'aiKbJustNow', 'aiKbMinAgo', 'aiKbHrAgo', 'aiKbDaysAgo',
      'aiKbOpFailed', 'aiKbOnboardTitle', 'aiKbOnboardBody', 'aiKbAddRoot',
      'aiKbCheckScopeFirst', 'aiKbGoDeeper', 'aiKbSearchPlaceholder', 'aiKbThreeLayersTip',
      'aiKbSearch', 'aiKbTry', 'aiKbWhatsInside', 'aiKbWikiMap', 'aiKbKnowledgeRootsSuffix',
      'aiKbWatchSplit', 'aiKbSemanticVectors', 'aiKbDocumentsSuffix', 'aiKbVectorChunks',
      'aiKbVectorSplit', 'aiKbDistilledNotes', 'aiKbNotesSuffix', 'aiKbToConfirm',
      'aiKbNotesSplit', 'aiKbGlueTitle', 'aiKbGlueFileId', 'aiKbGlueRootId',
      'aiKbGlueSessionId', 'aiKbLayerWikiDesc', 'aiKbLayerVecDesc', 'aiKbLayerNoteDesc',
      'aiKbHowOrganized', 'aiKbManageRoots', 'aiKbLevelSpace', 'aiKbLevelProject',
      'aiKbRealtimeWatch', 'aiKbScheduledScanOnly', 'aiKbReconciling', 'aiKbLastScan',
      'aiKbNever', 'aiKbDisabledRoots', 'aiKbRestoreInRootMgmt', 'aiKbWhatsHappening',
      'aiKbIndexingNFiles', 'aiKbFilesPerMin', 'aiKbEta', 'aiKbWaitingForParser',
      'aiKbAllSynced', 'aiKbDoneLast10m', 'aiKbThrottle', 'aiKbAutoIndexPaused',
      'aiKbAdjustInAdvanced', 'aiKbCcPowerSaver', 'aiKbCcBalanced', 'aiKbCcFullSpeed',
      'aiKbQueueHealth', 'aiKbPending', 'aiKbRunning', 'aiKbFailed', 'aiKbAutoDistill',
      'aiKbDistilledRecently', 'aiKbDistillFromChats', 'aiKbNoNewInsights',
      'aiKbSampleThyroid', 'aiKbSamplePythonAsync', 'aiKbSampleContract',
      'aiKbSampleIphone', 'aiKbSampleSkating',
    ] as const

    it('covers exactly the 94 keys this task added (list itself does not drift)', () => {
      expect(p5aTask8Keys.length).toBe(94)
    })

    // Only aiKbServiceOfflineBanner is exempted, and only because the Vue2 source
    // itself uses a full-width comma there (confirmed via `git show
    // main:src/assets/lang/zh_CN.json`, the "The index service is temporarily
    // offline…" entry — codepoint U+FF0C). Do not add further exceptions here without
    // stopping and reporting first: every addition narrows what this guard catches.
    const fullWidthExceptions = new Set(['aiKbServiceOfflineBanner'])

    it('should not contain full-width ，；：？！（） in any zh_cn value from this batch (except the registered Vue2-authentic exception)', () => {
      const fullWidthPunctuation = /[，；：？！（）]/
      const violations: Array<{ key: string; value: string }> = []
      for (const key of p5aTask8Keys) {
        if (fullWidthExceptions.has(key)) continue
        const value = (zh as Record<string, unknown>)[key]
        if (typeof value !== 'string') continue
        if (fullWidthPunctuation.test(value)) violations.push({ key, value })
      }
      if (violations.length > 0) {
        const details = violations.map((v) => `${v.key} = "${v.value}"`).join('\n')
        expect.fail(
          `Found full-width ，；：？！（） in P5a Task 8 zh_cn values (should be half-width per the authoritative Vue2 zh_CN.json; if this is a legitimate Vue2-authentic exception, stop and report before adding it here):\n${details}`
        )
      }
    })

    it('aiKbServiceOfflineBanner keeps its Vue2-authentic full-width comma (registered exception stays exercised, not just declared)', () => {
      expect(zh.aiKbServiceOfflineBanner).toBe('索引服务暂时离线，部分功能可能不可用')
      expect(zh.aiKbServiceOfflineBanner.includes('，')).toBe(true)
    })
  })

  // SP8-P5a Task 8 review finding (裁定 R7,Important),second half: this batch's
  // interpolation placeholders ({n}/{m}/{h}/{d}/{a}/{b}/{c}/{t}/{v}) must name the
  // same set of tokens in zh_cn and en_us — a mismatch silently breaks vue-i18n
  // interpolation in one locale only. Deliberately scoped to only this batch's 94
  // keys: a full-file version would immediately fail on 2 pre-existing, intentional
  // mismatches — aiResTurn (zh `{n,time}` vs en `{n,s,time}`) and aiResFilesInTurns
  // (zh `{files,turns}` vs en `{files,s,turns}`) — where the extra `{s}` in English is
  // a plural suffix (see src/ai/.../ResourcesTab.vue:223,228). Future batches (P5b–
  // P5f etc.) that want this coverage should add their own key list here rather than
  // widening this one to "all keys".
  describe('P5a Task 8 aiKb* keys — interpolation placeholder parity between zh_cn and en_us', () => {
    const placeholderKeysWithInterpolation = [
      'aiKbRunningIndexed', 'aiKbMinAgo', 'aiKbHrAgo', 'aiKbDaysAgo', 'aiKbWatchSplit',
      'aiKbVectorChunks', 'aiKbVectorSplit', 'aiKbToConfirm', 'aiKbNotesSplit',
      'aiKbDisabledRoots', 'aiKbIndexingNFiles', 'aiKbDoneLast10m', 'aiKbDistilledRecently',
    ] as const

    it('covers exactly the 13 keys in this batch that carry interpolation placeholders', () => {
      expect(placeholderKeysWithInterpolation.length).toBe(13)
    })

    it('zh_cn and en_us use the same set of {…} placeholder names for each of these keys', () => {
      const placeholderPattern = /\{([a-zA-Z]+)\}/g
      const namesOf = (value: string) => {
        const names: string[] = []
        let m: RegExpExecArray | null
        while ((m = placeholderPattern.exec(value)) !== null) names.push(m[1])
        return names.sort()
      }

      const violations: Array<{ key: string; zhNames: string[]; enNames: string[] }> = []
      for (const key of placeholderKeysWithInterpolation) {
        const zhValue = (zh as Record<string, unknown>)[key]
        const enValue = (en as Record<string, unknown>)[key]
        if (typeof zhValue !== 'string' || typeof enValue !== 'string') continue
        const zhNames = namesOf(zhValue)
        const enNames = namesOf(enValue)
        if (JSON.stringify(zhNames) !== JSON.stringify(enNames)) {
          violations.push({ key, zhNames, enNames })
        }
      }
      if (violations.length > 0) {
        const details = violations
          .map((v) => `${v.key}: zh=[${v.zhNames.join(',')}] en=[${v.enNames.join(',')}]`)
          .join('\n')
        expect.fail(`Found mismatched {…} placeholder names between locales:\n${details}`)
      }
    })
  })

  // SP8-P5b Task 1: 100 new aiKb* keys for the queue page (QueueView.vue) and
  // indexed-files page (IndexedFilesView.vue). Same shape as the P5a Task 8 guards
  // above (a fixed key list scoped to this batch + a punctuation scan + a
  // placeholder-parity check), extended per p5b-common-constraints.md §7 / the T1
  // task brief: this batch's full-width-punctuation exceptions are pinned with
  // `toBe` (not just excluded from the scan) because the brief explicitly calls for
  // "钉死确切值的强断言,不是「跳过扫描」的松形式" — i.e. each of the 15 Vue2-authentic
  // full-width-punctuation values must be asserted verbatim, not merely skipped.
  describe('P5b Task 1 aiKb* keys — punctuation and placeholder guards', () => {
    // Matches the >>> SP8-P5b Task 1 ... <<< SP8-P5b Task 1 marked block in
    // zh_cn.ts / en_us.ts (see p5b-task-1-report.md "新增键清单"). 95 rows from
    // Appendix A §A.1 (all have a Vue2-authentic zh value) + 4 from §A.2 (new copy,
    // K16/K18/K19) + 1 from §A.4 (aiKbStatusIndexing, K20) = 100.
    const p5bTask1Keys = [
      'aiKbAll', 'aiKbAllCaughtUp', 'aiKbCancel', 'aiKbCancelFailed', 'aiKbCancelSelected',
      'aiKbCancelled', 'aiKbCancelledNSelected', 'aiKbCannotCancel', 'aiKbClear',
      'aiKbClearFailedConfirmBody', 'aiKbClearFailedConfirmTitle', 'aiKbClearFailedErr',
      'aiKbClearFailedRecords', 'aiKbClearFilters', 'aiKbClearSelected', 'aiKbClearedNFailed',
      'aiKbClose', 'aiKbColAction', 'aiKbColFile', 'aiKbColPath', 'aiKbColSize', 'aiKbColTime',
      'aiKbColType', 'aiKbColVectors', 'aiKbConfirmClear', 'aiKbConfirmRebuildN',
      'aiKbFailedOnly', 'aiKbLegacy', 'aiKbLegacyDoc', 'aiKbLegacyDocTip', 'aiKbLoadErrorLabel',
      'aiKbMonthsAgo', 'aiKbNFailedRecords', 'aiKbNIndexedFiles', 'aiKbNPendingJobs',
      'aiKbNRetried', 'aiKbNRunningJobs', 'aiKbNSelected', 'aiKbNoFailedDistill',
      'aiKbNoFailedJobs', 'aiKbNoMatchSub', 'aiKbNoMatchTitle', 'aiKbNoRunningJobs',
      'aiKbOriginAuto', 'aiKbOriginManual', 'aiKbOverExplicitCap', 'aiKbPagerNext',
      'aiKbPagerPrev', 'aiKbPathPrefix', 'aiKbPerPage', 'aiKbPollTip', 'aiKbPolling',
      'aiKbQueueEmpty', 'aiKbQueuedNJobs', 'aiKbRebuild', 'aiKbRebuildAllBody1',
      'aiKbRebuildAllBody2', 'aiKbRebuildAllInRoot', 'aiKbRebuildAllOverCap',
      'aiKbRebuildAllTip', 'aiKbRebuildAllTitle', 'aiKbRebuildCapHint', 'aiKbRebuildFailed',
      'aiKbRebuildRowTip', 'aiKbRebuildSelectedN', 'aiKbRebuilding', 'aiKbRequeued',
      'aiKbRetry', 'aiKbRetryAllFailed', 'aiKbRetryFailedErr', 'aiKbRetrySelected', 'aiKbRoot',
      'aiKbScopeDistill', 'aiKbScopeIndex', 'aiKbSelectAllTip', 'aiKbSelectFilesHint',
      'aiKbShowingFirst200', 'aiKbShowingFirstN', 'aiKbShowingRange', 'aiKbSkipped',
      'aiKbSortAsc', 'aiKbSortDesc', 'aiKbSortIndexTime', 'aiKbSortVectorCount',
      'aiKbStatusActive', 'aiKbStatusError', 'aiKbStatusIndexed', 'aiKbStatusRemoved',
      'aiKbTombstonedNoSelect', 'aiKbTombstonedTip', 'aiKbTotalDone', 'aiKbTotalDoneLabel',
      'aiKbTypePrefix', 'aiKbZeroVec', 'aiKbZeroVecTip', 'aiKbQueueAllPendingDone',
      'aiKbQueueNoRunningNow', 'aiKbRetriedAllFailed', 'aiKbLoadErrorBody', 'aiKbStatusIndexing',
    ] as const

    it('covers exactly the 100 keys this task added (list itself does not drift)', () => {
      expect(p5bTask1Keys.length).toBe(100)
    })

    // (a) Full-width punctuation scan. Exceptions = Appendix A §A.5 (15 rows — NOT the
    // 11 the plan doc originally claimed; governance §12 E-3 found 1 false positive
    // and 5 misses in that draft). Per the task brief, every exception here is pinned
    // with an exact `toBe` assertion (not silently excluded from the scan), so a
    // future edit that drifts one of these 15 values away from its Vue2-authentic
    // full-width punctuation shows up here instead of just vanishing from the scan.
    const fullWidthExceptions: Record<string, string> = {
      aiKbClearFailedConfirmTitle: '清空失败记录？',
      aiKbLoadErrorBody: '无法读取已收录文件列表，请稍后重试。',
      aiKbLoadErrorLabel: '加载失败：',
      aiKbNoFailedJobs: '全部正常，索引服务运行中。',
      aiKbNoMatchSub: '没有匹配的文件。试着放宽路径 / 类型前缀，或把状态切到「全部」。',
      aiKbOverExplicitCap: '超过 {cap} 上限，请改用整库重建',
      aiKbPollTip: '只要还有索引中的行，每 30 秒自动刷新',
      aiKbRebuildAllBody1: '将强制全部重新索引当前筛选匹配的 {n} 个文件，可能耗时数分钟。',
      aiKbRebuildAllBody2: '后端会先墓碑再重新入队，旧的搜索内容会被新内容覆盖。',
      aiKbRebuildAllOverCap:
        '共 {n} 个文件，超过单次 {cap} 上限，服务器可能会拒绝（400）。请缩小路径前缀后分批重建。',
      aiKbRebuildAllTitle: '重建整个匹配集合？',
      aiKbRebuildCapHint: '重建匹配文件超过 {cap} 上限，请用更精确的路径前缀缩小范围后分批重建',
      aiKbShowingFirst200: '仅展示前 200 条；批量操作仍会处理全部。',
      aiKbTombstonedTip: '已删除，需 rescan 复活',
      aiKbZeroVecTip: '已索引但没有可搜索内容（不是错误）',
    }

    it('registers exactly the 15 full-width-punctuation exceptions from Appendix A §A.5', () => {
      expect(Object.keys(fullWidthExceptions).length).toBe(15)
    })

    it('pins the exact zh_cn value (with its Vue2-authentic full-width punctuation) for each of the 15 registered exceptions', () => {
      for (const [key, value] of Object.entries(fullWidthExceptions)) {
        expect((zh as Record<string, unknown>)[key]).toBe(value)
      }
    })

    it('should not contain full-width ，；：？！（） in any zh_cn value from this batch (except the 15 registered exceptions)', () => {
      const fullWidthPunctuation = /[，；：？！（）]/
      const violations: Array<{ key: string; value: string }> = []
      for (const key of p5bTask1Keys) {
        if (key in fullWidthExceptions) continue
        const value = (zh as Record<string, unknown>)[key]
        if (typeof value !== 'string') continue
        if (fullWidthPunctuation.test(value)) violations.push({ key, value })
      }
      if (violations.length > 0) {
        const details = violations.map((v) => `${v.key} = "${v.value}"`).join('\n')
        expect.fail(
          `Found full-width ，；：？！（） in P5b Task 1 zh_cn values (should be half-width per the authoritative Vue2 zh_CN.json; if this is a legitimate Vue2-authentic exception, stop and report before adding it here):\n${details}`
        )
      }
    })

    // (b) Placeholder-name parity between zh_cn and en_us, scoped to this batch's 20
    // keys that carry {…} interpolation (Appendix A §A.6). Deliberately NOT widened
    // to the whole file: aiResTurn / aiResFilesInTurns intentionally differ ({s} is
    // an English plural suffix) — see the P5a Task 8 block above for the full
    // rationale. Each future batch adds its own scoped list here.
    const placeholderKeysWithInterpolation = [
      'aiKbCancelledNSelected', 'aiKbClearFailedConfirmBody', 'aiKbClearedNFailed',
      'aiKbConfirmRebuildN', 'aiKbMonthsAgo', 'aiKbNFailedRecords', 'aiKbNIndexedFiles',
      'aiKbNPendingJobs', 'aiKbNRetried', 'aiKbNRunningJobs', 'aiKbNSelected',
      'aiKbOverExplicitCap', 'aiKbQueuedNJobs', 'aiKbRebuildAllBody1', 'aiKbRebuildAllOverCap',
      'aiKbRebuildAllTip', 'aiKbRebuildCapHint', 'aiKbRebuildSelectedN', 'aiKbShowingFirstN',
      'aiKbShowingRange',
    ] as const

    it('covers exactly the 20 keys in this batch that carry interpolation placeholders', () => {
      expect(placeholderKeysWithInterpolation.length).toBe(20)
    })

    it('zh_cn and en_us use the same set of {…} placeholder names for each of these keys', () => {
      const placeholderPattern = /\{([a-zA-Z]+)\}/g
      const namesOf = (value: string) => {
        const names: string[] = []
        let m: RegExpExecArray | null
        while ((m = placeholderPattern.exec(value)) !== null) names.push(m[1])
        return names.sort()
      }

      const violations: Array<{ key: string; zhNames: string[]; enNames: string[] }> = []
      for (const key of placeholderKeysWithInterpolation) {
        const zhValue = (zh as Record<string, unknown>)[key]
        const enValue = (en as Record<string, unknown>)[key]
        if (typeof zhValue !== 'string' || typeof enValue !== 'string') continue
        const zhNames = namesOf(zhValue)
        const enNames = namesOf(enValue)
        if (JSON.stringify(zhNames) !== JSON.stringify(enNames)) {
          violations.push({ key, zhNames, enNames })
        }
      }
      if (violations.length > 0) {
        const details = violations
          .map((v) => `${v.key}: zh=[${v.zhNames.join(',')}] en=[${v.enNames.join(',')}]`)
          .join('\n')
        expect.fail(`Found mismatched {…} placeholder names between locales:\n${details}`)
      }
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
