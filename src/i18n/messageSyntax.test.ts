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

  // aiSkScriptsHint / aiSkErrDescAngle both contain literal angle
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

  // Follow-up fix (review finding, Important): the zh_cn question marks for
  // aiSkUninstallTitle/aiSkDeleteTitle were accidentally typed as the full-width
  // U+FF1F, while the task spec's table and the authoritative source — the Vue2
  // panel's src/assets/lang/zh_CN.json:931-932 — both use the half-width U+003F,
  // violating the "no punctuation changes" hard constraint. At the time no
  // automated assertion covered these two keys' exact content; it was only
  // caught by manual character-by-character grep. This adds a programmatic
  // guard pinning that this batch's newly added aiSk* keys (74 keys introduced
  // in this task) contain no full-width ？/！/： in zh_cn.
  //
  // The scope is deliberately narrowed to "keys newly added in this batch"
  // rather than expanded to the full zh_cn.ts file: existing keys may
  // legitimately use full-width punctuation (e.g. it was confirmed earlier
  // that aiSkEmpty's authoritative source uses a half-width comma, but no
  // key-by-key check has been done across the whole file to confirm every
  // existing key's every punctuation mark matches its half-width authoritative
  // source). Sweeping all keys into this check risks encoding unverified
  // assumptions as assertions and creating new false positives. If a future
  // task wants to widen the coverage, it should first verify each key against
  // its authoritative source individually.
  describe('P3b Task 2 aiSk* keys — no accidental full-width punctuation', () => {
    // Corresponds one-to-one with the 74 newly added keys inside the matching
    // marker block in zh_cn.ts.
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

    it('aiSkUninstallTitle and aiSkDeleteTitle end with a half-width "?" (U+003F), matching the Vue 2 panel\'s src/assets/lang/zh_CN.json:931-932', () => {
      expect(zh.aiSkUninstallTitle).toBe('卸载这个技能?')
      expect(zh.aiSkUninstallTitle.codePointAt(zh.aiSkUninstallTitle.length - 1)).toBe(0x3f)
      expect(zh.aiSkDeleteTitle).toBe('删除这个技能?')
      expect(zh.aiSkDeleteTitle.codePointAt(zh.aiSkDeleteTitle.length - 1)).toBe(0x3f)
    })
  })

  // A review finding (ruling R7, Important): a RED probe during review showed
  // that flipping a half-width comma to full-width in aiKbDistillFromChats, and
  // renaming {n} to {count} in only one locale for aiKbRunningIndexed, both left the
  // full suite green (307/2742) — no existing guard covered this batch. Extending the
  // P3b Task 2 pattern above (same shape: a fixed key list + a scoped punctuation
  // scan) to this batch's 94 aiKb* keys (T8's main table; T5's aiKbDeferredTitle/
  // aiKbDeferredHint are new copy with no Vue2 source and are intentionally excluded).
  describe('P5a Task 8 aiKb* keys — no accidental full-width punctuation (except a registered Vue2-authentic one)', () => {
    // Matches the marked block of new keys in zh_cn.ts / en_us.ts (94 keys). Deliberately excludes the
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

  // A review finding (ruling R7, Important), second half: this batch's
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

  // 100 new aiKb* keys for the queue page (QueueView.vue) and
  // indexed-files page (IndexedFilesView.vue). Same shape as the P5a Task 8 guards
  // above (a fixed key list scoped to this batch + a punctuation scan + a
  // placeholder-parity check), extended per p5b-common-constraints.md §7 / the T1
  // task brief: this batch's full-width-punctuation exceptions are pinned with
  // `toBe` (not just excluded from the scan) because the brief explicitly calls for
  // "a strong assertion pinning the exact value with toBe, not the loose form of
  // just skipping the scan" — i.e. each of the 15 Vue2-authentic
  // full-width-punctuation values must be asserted verbatim, not merely skipped.
  describe('P5b Task 1 aiKb* keys — punctuation and placeholder guards', () => {
    // Matches the marked block of new keys in
    // zh_cn.ts / en_us.ts. 95 rows from
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

    // Review finding (Important I-1, fix round 1): the length-only check above only
    // pins the literal array in this test file — it says nothing about whether these
    // 100 keys actually exist in zh_cn.ts / en_us.ts. Reviewer's RED probe deleted
    // aiKbColFile from BOTH locales and the full suite stayed green (313/2878, zero
    // red): parity.test.ts only compares that the two locales' key sets match each
    // other (deleting from both keeps them equal), the length check above doesn't
    // look at the locales at all, and the punctuation-scan loop below silently
    // `continue`s past any key whose value isn't a string. This is the same
    // length-only shape as the P3b/P5a precedents this task was told to copy — the
    // brief's "same approach as P3b/P5a" carried the blind spot forward, not a slip in this
    // task. Closing it here so a future accidental delete/rename/locale-merge on any
    // of these 100 keys fails loudly instead of silently.
    it('every key in this batch is present as a string in both locales', () => {
      const missing = p5bTask1Keys.filter(
        (k) =>
          typeof (zh as Record<string, unknown>)[k] !== 'string' ||
          typeof (en as Record<string, unknown>)[k] !== 'string'
      )
      expect(missing).toEqual([])
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


  // 99 new aiKb* keys for the knowledge settings page (SettingsView.vue),
  // the Parser details page (ParserStatus.vue), the Parser test sandbox (ParserTest.vue)
  // and the folder picker (FolderBrowser.vue). Same shape as the guards above
  // (a fixed key list scoped to this batch + presence check + punctuation
  // scan + placeholder-parity check).
  //
  // Scope is deliberately this batch's 99 keys, never the whole file: aiResTurn /
  // aiResFilesInTurns intentionally differ between locales ({s} is an English plural
  // suffix) and would fail a file-wide placeholder-parity assertion — see the P5a Task 8
  // block above for the full rationale.
  //
  // Why the batch is 99 and not Appendix A's 98: coordinator ruling A-1 (2026-08-03) added
  // aiKbDeviceAuto rather than reusing the existing aiKbOriginAuto — same rendering today
  // (自动 / Auto), but that key means "distill job origin (manual|auto)" and a future edit
  // to distillation copy would silently change the inference-device selector. The appendix
  // was corrected in place (98 -> 99 new, 11 -> 10 reused).
  //
  // Four Vue2-authentic collisions / mistranslations in this batch are copied verbatim
  // (governance N21) and this guard must NOT be used to "tidy" them:
  //   1. aiKbResume ('Resume' -> 恢复) collides on the zh value with the existing
  //      aiKbRebuild ('Rebuild' -> 恢复). Vue2 mistranslating Rebuild is the wrong one;
  //      Resume -> 恢复 is correct. Both keys exist, both zh values stay 恢复.
  //   2. aiKbSetSandboxTitle ('Test Sandbox', SettingsView.vue:162) vs aiKbPrTestLink
  //      ('Test sandbox', ParserStatus.vue:6) — en differs only in letter case, zh is
  //      identical. Two independent keys so the English UI keeps the case difference.
  //   3. aiKbPrCcPowerSaving ('Power-saving') / aiKbPrCcFullPower ('Full power') collide on
  //      zh with aiKbCcPowerSaver ('Power saver') / aiKbCcFullSpeed ('Full speed') but the
  //      en strings differ — reusing those would render 'Power saver'/'Full speed' in the
  //      English UI, which is not 1:1 with Vue2. New keys are mandatory here.
  //   4. aiKbPrOcrHint's zh renders "真实索引的扫描件" for "truly scanned documents" (Vue2's
  //      own mistranslation) and uses ASCII -/x where en uses – (U+2013) / × (U+00D7).
  describe('P5c Task 1 aiKb* keys — punctuation and placeholder guards', () => {
    // Matches the marked block of new keys in zh_cn.ts /
    // en_us.ts: Appendix A §A.2's 98 rows plus
    // aiKbDeviceAuto (ruling A-1). All 99 have a Vue2-authoritative zh value — this batch
    // created zero new copy and left zero dead keys.
    const p5cTask1Keys = [
      'aiKbConcurrencyLevel', 'aiKbDeviceAuto', 'aiKbFbEmpty', 'aiKbFbLoadFailed',
      'aiKbFbLoading', 'aiKbFbNoVolumes', 'aiKbFbVolumes', 'aiKbInferenceDevice', 'aiKbPause',
      'aiKbPrCcFullPower', 'aiKbPrCcPowerSaving', 'aiKbPrDetailsTitle', 'aiKbPrFoldersTitle',
      'aiKbPrIndexedVectors', 'aiKbPrNoPending', 'aiKbPrOcrHint', 'aiKbPrOcrLabel',
      'aiKbPrQueueDone', 'aiKbPrQueueRunning', 'aiKbPrRecentFailures', 'aiKbPrResolvedHint',
      'aiKbPrTestLink', 'aiKbPrUnreachable', 'aiKbPtAsWellAs', 'aiKbPtBackLink',
      'aiKbPtChooseFile', 'aiKbPtChunksTitle', 'aiKbPtDefaults', 'aiKbPtDoclingToggle',
      'aiKbPtDragDrop', 'aiKbPtHelp1', 'aiKbPtHelpNoWrite', 'aiKbPtHelpPreviewOnly',
      'aiKbPtMaxSize', 'aiKbPtOcr', 'aiKbPtOverlapNote', 'aiKbPtProcessing',
      'aiKbPtQueryPlaceholder', 'aiKbPtReset', 'aiKbPtRun', 'aiKbPtScoredTitle',
      'aiKbPtSupports', 'aiKbPtTitle', 'aiKbPtTooBig', 'aiKbPtViaDocling', 'aiKbPtZeroChunks',
      'aiKbResume', 'aiKbResumed', 'aiKbSetAutoCapture', 'aiKbSetAutoCaptureCn',
      'aiKbSetAutoCaptureDesc', 'aiKbSetAutoCaptureOff', 'aiKbSetAutoCaptureOffWarn',
      'aiKbSetAutoCaptureOn', 'aiKbSetChange', 'aiKbSetChecking', 'aiKbSetConcurrencyDesc',
      'aiKbSetConcurrencySet', 'aiKbSetConcurrentFiles', 'aiKbSetCurrentlyUsing',
      'aiKbSetDangerZone', 'aiKbSetDeviceAutoCurrent', 'aiKbSetDeviceCn', 'aiKbSetDeviceSet',
      'aiKbSetDirEmptyMigratable', 'aiKbSetDirNotEmpty', 'aiKbSetMigrateAck',
      'aiKbSetMigrateNotEmpty', 'aiKbSetMigrateReq1', 'aiKbSetMigrateReq2',
      'aiKbSetMigrateReq3', 'aiKbSetMigrateStart', 'aiKbSetMigrateTitle', 'aiKbSetMoveFiles',
      'aiKbSetNotesFolder', 'aiKbSetNotesFolderCn', 'aiKbSetNotesFolderDesc',
      'aiKbSetNotesFolderUpdated', 'aiKbSetNotesSection', 'aiKbSetNotesSectionHint',
      'aiKbSetOcrCn', 'aiKbSetOcrOff', 'aiKbSetOcrOn', 'aiKbSetOcrOnlyScanned',
      'aiKbSetOcrTitle', 'aiKbSetOcrWarn', 'aiKbSetPickNote', 'aiKbSetPointToExisting',
      'aiKbSetRebuildAll', 'aiKbSetRebuildAllDesc', 'aiKbSetRebuildEllipsis',
      'aiKbSetSandboxHint', 'aiKbSetSandboxTitle', 'aiKbSetSelected', 'aiKbSetSvcPausedDesc',
      'aiKbSetSvcPausedLine', 'aiKbSetSvcRunningDesc', 'aiKbSetSvcRunningLine',
      'aiKbSwitchFailed',
    ] as const

    it('covers exactly the 99 keys this task added (list itself does not drift)', () => {
      expect(p5cTask1Keys.length).toBe(99)
    })

    // Carried forward from the P5b Task 1 review finding (Important I-1): the length check
    // above only pins the literal array in this file, it says nothing about whether the
    // keys exist in the locales. parity.test.ts only compares the two locales against each
    // other (deleting from both keeps them equal), and the punctuation loop below silently
    // `continue`s past a non-string value — so without this, an accidental delete/rename
    // would stay green.
    it('every key in this batch is present as a string in both locales', () => {
      const missing = p5cTask1Keys.filter(
        (k) =>
          typeof (zh as Record<string, unknown>)[k] !== 'string' ||
          typeof (en as Record<string, unknown>)[k] !== 'string'
      )
      expect(missing).toEqual([])
    })

    // (a) Full-width punctuation scan. Exceptions = Appendix A §A.5's 18 rows, re-scanned
    // independently by this task against `git show main:src/assets/lang/zh_CN.json` (the
    // added aiKbDeviceAuto value 自动 carries no full-width punctuation, so the count stays
    // 18 — measured, not assumed). Each exception is pinned with an exact `toBe` below
    // rather than merely skipped, per the brief: always write a strong assertion pinning
    // the exact value with toBe, not the loose form of merely skipping the scan. The
    // remaining 81 keys must scan clean.
    //
    // ⚠️ 。(U+3002) 「」(U+300C/300D) ·(U+00B7) —(U+2014) –(U+2013) …(U+2026) ×(U+00D7)
    // →(U+2192) are NOT in /[，；：？！（）]/ — do not add keys here because a value "looks
    // full-width"; only the regex's actual hits belong in this list.
    const fullWidthExceptions: Record<string, string> = {
      aiKbPrFoldersTitle: '待处理文件夹（top {top} / 共 {total} 组）',
      aiKbPrOcrHint: '慢 5-10x，只对真实索引的扫描件有用',
      aiKbPrRecentFailures: '最近失败（{n}）',
      aiKbPtChunksTitle: '切块结果（{n} 块）',
      aiKbPtDefaults: '默认 target=600, overlap=80, min=2（沙盒宽松值；生产用 600/80/5–20）。',
      aiKbPtDoclingToggle: 'docling 转出的 markdown（{n} 字符）',
      aiKbPtHelp1: '上传一个文件，看 Parser 怎么处理它（切块 + 嵌入 + 评分）。',
      aiKbPtMaxSize: '最大 30 MB。PDF 首次会触发模型权重下载（~200 MB，一次性）。',
      aiKbPtOcr: 'OCR（扫描 PDF）',
      aiKbPtOverlapNote: 'overlap 只对 plain 文本生效；markdown/source 按段落或函数边界切。',
      aiKbPtQueryPlaceholder: '（可选）输入 query，会计算每个 chunk 的余弦相似度',
      aiKbPtScoredTitle: 'Query 相似度排名（top {n}）',
      aiKbPtTooBig: '文件超过 30 MB，沙盒不支持',
      aiKbPtViaDocling: '（经 docling 转 markdown）',
      aiKbSetCurrentlyUsing: '当前用：',
      aiKbSetDeviceAutoCurrent: '自动（当前 {r}）',
      aiKbSetDeviceSet: '推理设备：{label}',
      aiKbSetSandboxHint: '单文件试解析，不写入索引',
    }

    it('registers exactly the 18 full-width-punctuation exceptions from Appendix A §A.5', () => {
      expect(Object.keys(fullWidthExceptions).length).toBe(18)
    })

    it('pins the exact zh_cn value (with its Vue2-authentic full-width punctuation) for each of the 18 registered exceptions', () => {
      for (const [key, value] of Object.entries(fullWidthExceptions)) {
        expect((zh as Record<string, unknown>)[key]).toBe(value)
      }
    })

    it('should not contain full-width ，；：？！（） in any zh_cn value from this batch (except the 18 registered exceptions)', () => {
      const fullWidthPunctuation = /[，；：？！（）]/
      const violations: Array<{ key: string; value: string }> = []
      for (const key of p5cTask1Keys) {
        if (key in fullWidthExceptions) continue
        const value = (zh as Record<string, unknown>)[key]
        if (typeof value !== 'string') continue
        if (fullWidthPunctuation.test(value)) violations.push({ key, value })
      }
      if (violations.length > 0) {
        const details = violations.map((v) => `${v.key} = "${v.value}"`).join('\n')
        expect.fail(
          `Found full-width ，；：？！（） in P5c Task 1 zh_cn values (should be half-width per the authoritative Vue2 zh_CN.json; if this is a legitimate Vue2-authentic exception, stop and report before adding it here):\n${details}`
        )
      }
    })

    // (b) Placeholder-name parity between zh_cn and en_us, scoped to this batch's 9 keys
    // that carry {…} interpolation (Appendix A §A.6, re-derived here by scanning the
    // shipped values rather than trusting the appendix table).
    const placeholderKeysWithInterpolation = [
      'aiKbPrFoldersTitle', 'aiKbPrRecentFailures', 'aiKbPrResolvedHint', 'aiKbPtChunksTitle',
      'aiKbPtDoclingToggle', 'aiKbPtScoredTitle', 'aiKbSetConcurrencySet',
      'aiKbSetDeviceAutoCurrent', 'aiKbSetDeviceSet',
    ] as const

    it('covers exactly the 9 keys in this batch that carry interpolation placeholders', () => {
      expect(placeholderKeysWithInterpolation.length).toBe(9)
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

  // 92 new aiKb* keys for the knowledge-base notes area (NotesView.vue,
  // NoteEditPane.vue, and the NOTE_TYPES/NOTE_SOURCES labelKey targets in
  // notesViewHelpers.js). Same shape as the P5a Task 8 / P5b Task 1 / P5c Task 1 guards
  // above (a fixed key list scoped to this batch + presence check + punctuation scan +
  // placeholder-parity check), per p5d-common-constraints.md §7 and this task's brief.
  //
  // Scope is deliberately this batch's 92 keys, never the whole file — see the P5a Task 8
  // block above for why a file-wide placeholder-parity assertion would be wrong (some
  // existing keys intentionally differ in placeholder shape between locales).
  //
  // 🔴 Two things this batch does differently from every prior P5* Task 1 guard:
  //
  //  (1) R10 — en is NOT assumed to equal the literal $t() English source string. P5a/P5b/
  //      P5c all measured zero en_US.json overrides; this batch has 2 real ones
  //      (aiKbNtDeleteBody2, aiKbNoteTypeNote — see the dedicated describe block below).
  //      Vue2's default AND fallback locale are both en_us (src/plugins/i18n.js:9-10), so
  //      the English UI genuinely renders en_US.json's value, not the $t() key.
  //
  //  (2) N32 — this batch has 12 collision groups (11 cross-key + 1 internal) where the zh
  //      value legitimately matches an unrelated existing key but the en value must NOT
  //      (or, for two mirror-direction rows, en collides but zh must not) — see the
  //      dedicated describe block below. Per p5c-common-constraints.md §9.2 (T6 review
  //      finding I-1): "only compare zh" assertions have ZERO discriminating power here —
  //      a probe that swapped in the forbidden key passed 47/47 existing assertions in P5c
  //      because none of them rendered the en value.
  describe('P5d Task 1 aiKb* keys — punctuation and placeholder guards', () => {
    // Matches the marked block of new keys in zh_cn.ts /
    // en_us.ts: Appendix A §A.2's 92 rows. All 92
    // have a Vue2-authoritative zh value — this batch created zero new copy and left zero
    // dead keys (N23's conflictMessage English string is deliberately NOT one of these 92;
    // it stays a hardcoded predicate-only string, never an i18n key).
    const p5dTask1Keys = [
      'aiKbAiDraft', 'aiKbArchived', 'aiKbCurated', 'aiKbNeAdoptedDisk', 'aiKbNeBackToList',
      'aiKbNeBasedOnRev', 'aiKbNeBold', 'aiKbNeBulletList', 'aiKbNeCodeBlock',
      'aiKbNeConfirmAsCurated', 'aiKbNeConflictBody', 'aiKbNeConflictMine',
      'aiKbNeConflictTheirs', 'aiKbNeConflictTitle', 'aiKbNeCopyMyBody', 'aiKbNeCopyPath',
      'aiKbNeDescPlaceholder', 'aiKbNeDraftBar1', 'aiKbNeDraftBar2', 'aiKbNeDraftBar3',
      'aiKbNeDraftBarSub', 'aiKbNeDraftCopied', 'aiKbNeEditDirectHint', 'aiKbNeFileManager',
      'aiKbNeFileOnDisk', 'aiKbNeH2', 'aiKbNeH3', 'aiKbNeItalic', 'aiKbNeKeepMine',
      'aiKbNeKeptMine', 'aiKbNeLastModified', 'aiKbNeMdPlaceholder', 'aiKbNeNChars',
      'aiKbNeNewFileHint', 'aiKbNeNewStatusHint', 'aiKbNeNotSavedYet',
      'aiKbNeOpenConversation', 'aiKbNePathCopied', 'aiKbNeProperties', 'aiKbNeQuote',
      'aiKbNeReferencedBy', 'aiKbNeRemoveTag', 'aiKbNeRevealFile', 'aiKbNeRichText',
      'aiKbNeSave', 'aiKbNeSaved', 'aiKbNeSavedRev', 'aiKbNeSaving', 'aiKbNeSource',
      'aiKbNeSourceConversation', 'aiKbNeSources', 'aiKbNeStrike', 'aiKbNeTagsPlaceholder',
      'aiKbNeTitlePlaceholder', 'aiKbNeUnsaved', 'aiKbNeUseDisk', 'aiKbNoteConfirmed',
      'aiKbNoteSrcAgent', 'aiKbNoteSrcHuman', 'aiKbNoteSrcPipeline', 'aiKbNoteTypeDigest',
      'aiKbNoteTypeInsight', 'aiKbNoteTypeNote', 'aiKbNoteTypeSummary', 'aiKbNtAllTypes',
      'aiKbNtArchive', 'aiKbNtArchiveInstead', 'aiKbNtConfirm', 'aiKbNtConfirmAll',
      'aiKbNtDelete', 'aiKbNtDeleteBody1', 'aiKbNtDeleteBody2', 'aiKbNtDeleteBody3',
      'aiKbNtDeleteTitle', 'aiKbNtEmptySub', 'aiKbNtEmptyTitle', 'aiKbNtInboxFootHint',
      'aiKbNtInboxSub', 'aiKbNtInboxTitle', 'aiKbNtListFoot', 'aiKbNtNDraftsConfirmed',
      'aiKbNtNewNote', 'aiKbNtNoMatch', 'aiKbNtNoteArchived', 'aiKbNtNoteDeleted',
      'aiKbNtOpenFolder', 'aiKbNtPathLead', 'aiKbNtPathTail', 'aiKbNtReviewOneByOne',
      'aiKbRelDaysAgo', 'aiKbRelHrAgo', 'aiKbRelMinAgo',
    ] as const

    it('covers exactly the 92 keys this task added (list itself does not drift)', () => {
      expect(p5dTask1Keys.length).toBe(92)
    })

    // Carried forward from the P5b Task 1 review finding (Important I-1): the length check
    // above only pins the literal array in this file, it says nothing about whether the
    // keys exist in the locales. parity.test.ts only compares the two locales against each
    // other (deleting from both keeps them equal), and the punctuation loop below silently
    // `continue`s past a non-string value — so without this, an accidental delete/rename
    // would stay green.
    it('every key in this batch is present as a string in both locales', () => {
      const missing = p5dTask1Keys.filter(
        (k) =>
          typeof (zh as Record<string, unknown>)[k] !== 'string' ||
          typeof (en as Record<string, unknown>)[k] !== 'string'
      )
      expect(missing).toEqual([])
    })

    // (a) Full-width punctuation scan. p5d-appendix-A-i18n.md §A.0② found that the 3
    // exceptions governance §7(a) predicted were ALL false positives — this language pack's
    // Chinese commas/parens are half-width (U+002C / U+0028-29), not full-width. The scan
    // over the real 92 shipped values hits exactly 1: aiKbNtDeleteTitle's trailing full-width
    // question mark (？ U+FF1F), a genuine Vue2-authentic exception. Pinned with an exact
    // `toBe` below rather than merely skipped, per the brief: always write a strong
    // assertion pinning the exact value with toBe. The remaining 91 keys must scan clean.
    //
    // ⚠️ 。(U+3002) 「」(U+300C/300D) ·(U+00B7) →(U+2192) …(U+2026) —(U+2014) are NOT in
    // /[，；：？！（）]/ — do not add keys here because a value "looks full-width"; only the
    // regex's actual hits belong in this list.
    const fullWidthExceptions: Record<string, string> = {
      aiKbNtDeleteTitle: '删除该笔记？',
    }

    it('registers exactly the 1 full-width-punctuation exception from Appendix A §A.5', () => {
      expect(Object.keys(fullWidthExceptions).length).toBe(1)
    })

    it('pins the exact zh_cn value (with its Vue2-authentic full-width punctuation) for the 1 registered exception', () => {
      for (const [key, value] of Object.entries(fullWidthExceptions)) {
        expect((zh as Record<string, unknown>)[key]).toBe(value)
      }
    })

    it('should not contain full-width ，；：？！（） in any zh_cn value from this batch (except the 1 registered exception)', () => {
      const fullWidthPunctuation = /[，；：？！（）]/
      const violations: Array<{ key: string; value: string }> = []
      for (const key of p5dTask1Keys) {
        if (key in fullWidthExceptions) continue
        const value = (zh as Record<string, unknown>)[key]
        if (typeof value !== 'string') continue
        if (fullWidthPunctuation.test(value)) violations.push({ key, value })
      }
      if (violations.length > 0) {
        const details = violations.map((v) => `${v.key} = "${v.value}"`).join('\n')
        expect.fail(
          `Found full-width ，；：？！（） in P5d Task 1 zh_cn values (should be half-width per the authoritative Vue2 zh_CN.json; if this is a legitimate Vue2-authentic exception, stop and report before adding it here):\n${details}`
        )
      }
    })

    // (b) Placeholder-name parity between zh_cn and en_us, scoped to this batch's 9 keys
    // that carry {…} interpolation (Appendix A §A.6, re-derived here by scanning the
    // shipped values rather than trusting the appendix table). All 9 use {n} (K42).
    const placeholderKeysWithInterpolation = [
      'aiKbNeBasedOnRev', 'aiKbNeKeptMine', 'aiKbNeNChars', 'aiKbNeSavedRev',
      'aiKbNtListFoot', 'aiKbNtNDraftsConfirmed', 'aiKbRelDaysAgo', 'aiKbRelHrAgo',
      'aiKbRelMinAgo',
    ] as const

    it('covers exactly the 9 keys in this batch that carry interpolation placeholders', () => {
      expect(placeholderKeysWithInterpolation.length).toBe(9)
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

  // p5d-appendix-A-i18n.md §A.0① / coordinator ruling R10: en_US.json is NOT the identity
  // map for every English $t() source string in this batch. Vue2's default AND fallback
  // locale are both en_us (src/plugins/i18n.js:9-10), so the English UI actually renders
  // en_US.json's override value — "1:1 fidelity is judged by the rendered value, not by
  // the $t() key". Only a
  // positive assertion has zero discriminating power here (a value accidentally set back to
  // the literal $t() source string would look "reasonable" to anyone skimming the diff) —
  // each key therefore also gets a reverse assertion pinning that it is NOT the literal
  // source string.
  describe('P5d Task 1 R10 — en_US.json overrides (en ≠ literal $t() source string)', () => {
    it('aiKbNtDeleteBody2 renders the en_US.json override "this cannot be undone." (with the trailing period), not the literal $t() source "this cannot be undone"', () => {
      expect((en as Record<string, unknown>).aiKbNtDeleteBody2).toBe('this cannot be undone.')
      expect((en as Record<string, unknown>).aiKbNtDeleteBody2).not.toBe('this cannot be undone')
    })

    it('aiKbNoteTypeNote renders the en_US.json override "Note", not the literal $t() source "Note item"', () => {
      expect((en as Record<string, unknown>).aiKbNoteTypeNote).toBe('Note')
      expect((en as Record<string, unknown>).aiKbNoteTypeNote).not.toBe('Note item')
    })
  })

  // p5d-common-constraints.md §7.1 / p5d-appendix-A-i18n.md §A.7.1: 11 cross-key collisions
  // (this batch's key legitimately shares ONE of {zh, en} with an unrelated existing key,
  // but the axis that actually renders differently must be pinned) plus 1 collision
  // internal to this batch. Per p5c-common-constraints.md §9.2 (T6 review finding I-1): a
  // "the zh values happen to match, that's fine" comment with no assertion is exactly the
  // shape that let a probe swap in the forbidden key and stay 47/47 green in P5c — so every
  // group here gets a real assertion on the axis that must diverge, not just prose.
  describe('P5d Task 1 N32 collision guards — this batch must not collapse onto an unrelated existing key', () => {
    // For 9 of the 11 rows the zh values collide (by design — same Chinese label used
    // elsewhere in the app) and it's the EN value that must stay distinct, so the English
    // UI doesn't silently start rendering copy borrowed from an unrelated feature area. Two
    // rows are the mirror direction (en collides, zh must stay distinct) — flagged with
    // axis: 'zh'.
    const crossKeyCollisions: Array<{ ref: string; newKey: string; forbiddenKey: string; axis: 'en' | 'zh' }> = [
      { ref: 'N32-3', newKey: 'aiKbNtOpenFolder', forbiddenKey: 'aiOpenInFileManager', axis: 'en' },
      { ref: 'N32-1', newKey: 'aiKbNtConfirm', forbiddenKey: 'appsSettingsConflictOk', axis: 'en' },
      { ref: 'N32-9', newKey: 'aiKbNtDelete', forbiddenKey: 'appsSettingsRemove', axis: 'en' },
      { ref: 'N32-4', newKey: 'aiKbNeSource', forbiddenKey: 'aiSkAddedBy', axis: 'en' },
      { ref: 'N32-10', newKey: 'aiKbNeRemoveTag', forbiddenKey: 'appsSettingsRemove', axis: 'zh' },
      { ref: 'N32-5', newKey: 'aiKbNeSources', forbiddenKey: 'aiSkAddedBy', axis: 'en' },
      { ref: 'N32-7', newKey: 'aiKbNePathCopied', forbiddenKey: 'filesCopiedPath', axis: 'zh' },
      { ref: 'N32-11', newKey: 'aiKbRelMinAgo', forbiddenKey: 'aiResMinutesAgo', axis: 'en' },
      { ref: 'N32-12', newKey: 'aiKbRelHrAgo', forbiddenKey: 'aiResHoursAgo', axis: 'en' },
      { ref: 'N32-6', newKey: 'aiKbRelDaysAgo', forbiddenKey: 'aiResDaysAgo', axis: 'en' },
      { ref: 'N32-2', newKey: 'aiKbNoteTypeNote', forbiddenKey: 'aiKbNavNotes', axis: 'en' },
    ]

    it('covers exactly the 11 cross-key collision groups from Appendix A §A.7.1', () => {
      expect(crossKeyCollisions.length).toBe(11)
    })

    for (const { ref, newKey, forbiddenKey, axis } of crossKeyCollisions) {
      it(`${ref}: ${newKey} must not collapse onto ${forbiddenKey} on the ${axis} axis`, () => {
        const zhNew = (zh as Record<string, unknown>)[newKey]
        const enNew = (en as Record<string, unknown>)[newKey]
        const zhForbidden = (zh as Record<string, unknown>)[forbiddenKey]
        const enForbidden = (en as Record<string, unknown>)[forbiddenKey]
        expect(typeof zhNew, `${newKey} zh`).toBe('string')
        expect(typeof enNew, `${newKey} en`).toBe('string')
        expect(typeof zhForbidden, `${forbiddenKey} zh`).toBe('string')
        expect(typeof enForbidden, `${forbiddenKey} en`).toBe('string')

        if (axis === 'en') {
          // zh collision is expected and NOT asserted against here (both keys legitimately
          // share the Chinese label) — the English UI is what must stay distinguishable.
          expect(enNew, `${newKey}.en must differ from ${forbiddenKey}.en`).not.toBe(enForbidden)
        } else {
          // Mirror direction: en collision is expected, zh must differ.
          expect(zhNew, `${newKey}.zh must differ from ${forbiddenKey}.zh`).not.toBe(zhForbidden)
        }
      })
    }

    // N32-8: collision internal to this batch. NoteEditPane.vue:86 ('Source') and :126
    // ('Sources') share the zh label 来源 but must keep independent en values so the
    // English UI still distinguishes singular/plural. Unlike the cross-key rows above,
    // both keys were written by this task, so both directions are pinned directly.
    it('aiKbNeSource and aiKbNeSources share zh (来源) but keep distinct en values (Source / Sources)', () => {
      expect((zh as Record<string, unknown>).aiKbNeSource).toBe('来源')
      expect((zh as Record<string, unknown>).aiKbNeSources).toBe('来源')
      expect((en as Record<string, unknown>).aiKbNeSource).toBe('Source')
      expect((en as Record<string, unknown>).aiKbNeSources).toBe('Sources')
      expect((en as Record<string, unknown>).aiKbNeSource).not.toBe((en as Record<string, unknown>).aiKbNeSources)
    })
  })

  // p5d-common-constraints.md K42: aiKbRelMinAgo/aiKbRelHrAgo/aiKbRelDaysAgo must NOT reuse
  // the existing aiKbMinAgo/aiKbHrAgo/aiKbDaysAgo — those use {m}/{h}/{d} placeholders
  // (indexedFilesView.ts:53-57), while this batch's relativeTime() (landing in T3)
  // interpolates with an `n` param. A placeholder-name-parity check alone (the (b) block
  // above) cannot catch a future "helpfully" swap onto the wrong existing key, because
  // aiKbMinAgo/aiKbHrAgo/aiKbDaysAgo also have internally-consistent zh/en {…} pairs — the
  // failure only shows up when you actually interpolate. So this renders through real
  // vue-i18n `t()` calls with an `{ n: 5 }` param and asserts a real "5" appears (not the
  // literal string "{n}"), and — as the reverse probe demonstrating why K42 exists — proves
  // the forbidden keys do NOT substitute when fed an `n` param (they're keyed on m/h/d).
  describe('P5d Task 1 K42 — relativeTime keys interpolate a real number via {n}, not a literal placeholder', () => {
    const relKeys = ['aiKbRelMinAgo', 'aiKbRelHrAgo', 'aiKbRelDaysAgo'] as const

    for (const key of relKeys) {
      it(`${key} interpolates {n} into a real number in zh_cn (not the literal "{n}")`, () => {
        const i18nZh = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
        const message = i18nZh.global.t(key, { n: 5 })
        expect(message).toContain('5')
        expect(message).not.toContain('{n}')
      })

      it(`${key} interpolates {n} into a real number in en_us (not the literal "{n}")`, () => {
        const i18nEn = createI18n({ legacy: false, locale: 'en_us', messages: { en_us: en } })
        const message = i18nEn.global.t(key, { n: 5 })
        expect(message).toContain('5')
        expect(message).not.toContain('{n}')
      })
    }

    it('reusing aiKbMinAgo/aiKbHrAgo/aiKbDaysAgo with the {n} param this batch actually passes would silently drop the number — the reason K42 forbids reuse', () => {
      const i18nZh = createI18n({
        legacy: false,
        locale: 'zh_cn',
        messages: { zh_cn: zh },
      })
      // These 3 keys are keyed on {m}/{h}/{d}, not {n}. Measured behavior (not assumed):
      // vue-i18n does NOT leave an unmatched placeholder as a literal "{m}" in the output —
      // it silently substitutes empty string for the unmatched name, so the rendered string
      // is missing its number entirely (e.g. " 分钟前" with no digit) rather than showing a
      // literal "{m}". Either failure mode is a real 1:1 break; this pins the one vue-i18n
      // actually produces.
      expect(i18nZh.global.t('aiKbMinAgo', { n: 5 })).not.toContain('5')
      expect(i18nZh.global.t('aiKbHrAgo', { n: 5 })).not.toContain('5')
      expect(i18nZh.global.t('aiKbDaysAgo', { n: 5 })).not.toContain('5')
    })
  })

  // 54 new aiKb* keys for the knowledge-base search area (SearchView.vue,
  // FileDetailDrawer.vue, KFileViewer.vue and searchAggregate.js's i18n.t('(Untitled)')). Same
  // shape as the P5a Task 8 / P5b Task 1 / P5c Task 1 / P5d Task 1 guards above (a fixed key list
  // scoped to this batch + presence check + punctuation scan + placeholder-parity check), per
  // p5e-common-constraints.md §7 / p5e-appendix-A-i18n.md §A.4 / this task's brief §3.
  //
  // Scope is deliberately this batch's 54 keys, never the whole file — see the P5a Task 8 block
  // above for why a file-wide placeholder-parity assertion would be wrong (aiResTurn /
  // aiResFilesInTurns intentionally differ, {s} being an English plural suffix).
  //
  // 🔴 Two things this batch does differently from the four prior P5* Task 1 guards:
  //
  //  (1) E-45 — the placeholder block below does NOT settle for "the rendered string no longer
  //      contains the literal {n}". Measured behavior: vue-i18n silently substitutes the empty
  //      string for an unmatched placeholder name, so "does not contain {n}" is true even when
  //      interpolation is completely broken = zero discriminating power. Every placeholder key
  //      here is instead rendered through real vue-i18n and pinned with an exact `toBe` on the
  //      fully interpolated result, in both locales.
  //
  //  (2) §7.1 / §9.2 / §9.3 — the bidirectional collision scan is re-run inside the test rather
  //      than only in the task's one-off script, and its result is pinned as an exact pair set.
  //      Governance names 14 high-risk same-value words for this batch (Download · Close ·
  //      Modified · Search · Results · Copied · High/Mid/Low · Similarity · files · matches ·
  //      Advanced · Enabled · Fast) and A-1 forbids reusing another area's key for any of them,
  //      "the key's naming semantics belong to a different area — if that area's copy changes
      //      later, it would silently break the search area". For 5 of the resulting pairs one
  //      axis genuinely diverges, so a wrong-key reuse would visibly change the rendered UI —
  //      those get real assertions. Per p5c §9.2 (T6 finding I-1) a zh-only assertion has zero
  //      discriminating power here, so the axis asserted is always the one that must diverge.
  describe('P5e Task 1 aiKb* keys — punctuation, placeholder and collision guards', () => {
    // Matches the marked block of new keys in zh_cn.ts / en_us.ts:
    // Appendix A §A.1's "Newly Added (54)" table. All 54 have a
    // Vue2-authoritative zh AND en value (63/63 Vue2 coverage measured, zero self-invented copy,
    // zero dead keys). The 9 further keys this batch REUSES (§A.1 "Reused") are deliberately absent
    // from this list: they were shipped and guarded by P5a Task 8 and are not this batch's copy.
    const p5eTask1Keys = [
      'aiKbFdBack', 'aiKbFdCopied', 'aiKbFdCopy', 'aiKbFdCopyFailed', 'aiKbFdDistill',
      'aiKbFdDistillFailed', 'aiKbFdDistillQueued', 'aiKbFdDownload', 'aiKbFdNextSection',
      'aiKbFdOpenFile', 'aiKbFdPage', 'aiKbFdPassage', 'aiKbFdPrevSection', 'aiKbFdResults',
      'aiKbFdSection', 'aiKbFdSummary', 'aiKbFvUnsupported', 'aiKbSrAdvOn', 'aiKbSrAdvanced',
      'aiKbSrCountFiles', 'aiKbSrCountMatches', 'aiKbSrDownloadFailed', 'aiKbSrEmptySub',
      'aiKbSrEmptyTipAllowlist', 'aiKbSrEmptyTipIndexed', 'aiKbSrEmptyTipKeyword',
      'aiKbSrEmptyTitle', 'aiKbSrErrorTitle', 'aiKbSrFileType', 'aiKbSrIdleSub',
      'aiKbSrIdleTitle', 'aiKbSrMatchPill', 'aiKbSrMatchTitle', 'aiKbSrModified',
      'aiKbSrMoreHint', 'aiKbSrMtimeAny', 'aiKbSrMtimeMonth', 'aiKbSrMtimeWeek',
      'aiKbSrMtimeYear', 'aiKbSrNoPath', 'aiKbSrNoPreviewToast', 'aiKbSrOpenFailed',
      'aiKbSrPlaceholder', 'aiKbSrPopupBlocked', 'aiKbSrQuality', 'aiKbSrQualityAccurate',
      'aiKbSrQualityFast', 'aiKbSrRelHigh', 'aiKbSrRelLow', 'aiKbSrRelMid', 'aiKbSrRerankWarn',
      'aiKbSrSimilarity', 'aiKbSrTopK', 'aiKbSrUntitled',
    ] as const

    // (c) "exactly N keys" drift guard. N = 54, measured (not taken from the appendix table):
    // 37 aiKbSr* + 16 aiKbFd* + 1 aiKbFv* (Appendix A §A.7's stem budget).
    it('covers exactly the 54 keys this task added (list itself does not drift)', () => {
      expect(p5eTask1Keys.length).toBe(54)
      expect(p5eTask1Keys.filter((k) => k.startsWith('aiKbSr')).length).toBe(37)
      expect(p5eTask1Keys.filter((k) => k.startsWith('aiKbFd')).length).toBe(16)
      expect(p5eTask1Keys.filter((k) => k.startsWith('aiKbFv')).length).toBe(1)
    })

    // Carried forward from the P5b Task 1 review finding (Important I-1): the length check above
    // only pins the literal array in this file, it says nothing about whether the keys exist in
    // the locales. parity.test.ts only compares the two locales against each other (deleting
    // from both keeps them equal), and the punctuation loop below silently `continue`s past a
    // non-string value — so without this, an accidental delete/rename would stay green.
    it('every key in this batch is present as a string in both locales', () => {
      const missing = p5eTask1Keys.filter(
        (k) =>
          typeof (zh as Record<string, unknown>)[k] !== 'string' ||
          typeof (en as Record<string, unknown>)[k] !== 'string'
      )
      expect(missing).toEqual([])
    })

    // The 9 reused keys (Appendix A §A.1 "Reused" / §A.1.1) must still exist — this batch's
    // SearchView/FileDetailDrawer copy depends on them without redefining them, so a later
    // cleanup that decides "nothing in the notes/dashboard area uses aiKbTry any more" would
    // silently blank out this area's UI too.
    it('the 9 reused aiKb* keys this batch depends on still exist in both locales', () => {
      const reused = [
        'aiKbClose', 'aiKbSampleContract', 'aiKbSampleIphone', 'aiKbSamplePythonAsync',
        'aiKbSampleSkating', 'aiKbSampleThyroid', 'aiKbSearch', 'aiKbStatusIndexed', 'aiKbTry',
      ]
      expect(reused.length).toBe(9)
      const missing = reused.filter(
        (k) =>
          typeof (zh as Record<string, unknown>)[k] !== 'string' ||
          typeof (en as Record<string, unknown>)[k] !== 'string'
      )
      expect(missing).toEqual([])
    })

    // Governance §0.1 / debt ticket D-3: the whole-table key-count snapshot that used to live as
    // an exact `toHaveLength` in SettingsView.test.ts is now a LOWER BOUND there, because an
    // exact count makes every future key-adding phase fail in an unrelated file (that trap cost
    // P5d one NEEDS_CONTEXT + ruling R15 + erratum E-43). Appendix A §A.4-2(c) also asks this
    // batch to pin a measured whole-table number; it is deliberately pinned the same way — as a
    // lower bound — so the "key total never drops" value is kept without re-creating the trap
    // D-3 just removed. Measured after this task landed: 1648 zh / 1648 en (real module import,
    // §9.3-2: text parsing under-counts) = 1595 baseline + 54 new − 1 deleted (the aiCfg*
    // knowledge-details placeholder key, governance §0.2 / D-9 — deliberately not named here so
    // that D-9's `grep -rw` self-proof keeps hitting only SettingsPage.vue's history comment).
    //
    // Correction (debt ticket M-4; honoring the "invert, don't delete" rule — the sentence
    // above is kept verbatim):
    // the stated REASON above ("deliberately not named here so that D-9's grep self-proof keeps
    // hitting only the history comment") was SUPERSEDED by ruling P5e-R13. R13 determined the
    // dilemma was false: this document's established dead-key grep convention already excludes
    // `*.test.ts`, so naming the key inside a test file keeps
    // D-9's self-proof literally true. The key IS named a few `it`s below, in the R13
    // anti-resurrection guard — that guard, not this sentence, is the current convention.
    // (Cite by entry ID P5e-R13 / D-9; do not cite file:line — line numbers will go stale as
    // the file changes.)
    //
    // Exact zh↔en key-set equality is parity.test.ts's job.
    // Cross-reference: 1648 is pinned as a lower bound in TWO independent
    // places — here and SettingsView.test.ts (the D-3 site). Both are lower bounds, so neither is a
    // cross-phase trap; they are deliberately not de-duplicated because they guard different
    // things (that file's is the historical snapshot, kept per "invert, don't delete").
    it('the whole locale table never shrinks below the count measured when this batch landed', () => {
      expect(Object.keys(zh).length).toBeGreaterThanOrEqual(1648)
      expect(Object.keys(en).length).toBeGreaterThanOrEqual(1648)
    })

    // 🔴 Coordinator ruling R13 — anti-resurrection guard for the key D-9 deleted.
    //
    // T1 originally omitted this guard to keep D-9's self-proof (`grep -rw <key> src/` hits only
    // SettingsPage.vue's history comment) literally true. That dilemma was determined to be false:
    // "hits only that comment" was originally a one-time self-proof that the key had "been cleanly
    // deleted", not a permanent constraint on the codebase — and this document's established
    // dead-key grep convention already excludes `*.test.ts`:
    //   grep -rlw --include='*.vue' --include='*.ts' -e "$k" src/ \
    //     | grep -v '^src/i18n/' | grep -v '\.test\.ts$'
    // ⇒ Putting the guard in the test file satisfies both goals with zero compromise.
    //
    // 🔴 Criterion = "adding it back to both locales at once must also fail red". Review proved single-locale resurrection would be
    // caught by parity.test.ts, but resurrecting it in BOTH locales left all 3984 tests green —
    // a confirmed guard gap, not a hypothetical one. Hence this asserts each locale independently.
    it('the D-9 deleted key stays deleted in BOTH locales (parity alone cannot catch a two-locale resurrection)', () => {
      expect('aiCfgKnowledgeSoon' in zh).toBe(false)
      expect('aiCfgKnowledgeSoon' in en).toBe(false)
    })

    // (a) Full-width punctuation scan. Exceptions re-measured by this task against the shipped
    // values (not copied from Appendix A §A.2.1): the regex hits exactly 5 of the 54 zh values,
    // and 0 of the 54 en values. Each is pinned with an exact `toBe` rather than merely skipped,
    // per the brief: "an exception list of exact values pinned with toBe". The remaining 49 must scan clean.
    //
    // ⚠️ 。(U+3002) 「」(U+300C/300D) ·(U+00B7) —(U+2014) …(U+2026) ×(U+00D7) are NOT in
    // /[，；：？！（）]/ — do not add a key here because a value "looks full-width"; only the
    // regex's actual hits belong in this list. Those characters are still copied verbatim and
    // several of them are pinned by the codepoint assertions further below.
    const fullWidthExceptions: Record<string, string> = {
      aiKbFdSummary: '为「{query}」找到 {n} 段相关内容，按相似度排序',
      aiKbSrEmptySub: '试试这些方式：',
      aiKbSrIdleSub: '输入任何自然语言，Nimo 在 NAS 上找到匹配文档。语义匹配，不只是关键词。',
      aiKbSrNoPreviewToast: '该格式暂不支持预览，请下载查看',
      aiKbSrRerankWarn: '排序质量暂不可用，已自动降级',
    }

    it('registers exactly the 5 full-width-punctuation exceptions measured in this batch', () => {
      expect(Object.keys(fullWidthExceptions).length).toBe(5)
    })

    it('pins the exact zh_cn value (with its Vue2-authentic full-width punctuation) for each of the 5 registered exceptions', () => {
      for (const [key, value] of Object.entries(fullWidthExceptions)) {
        expect((zh as Record<string, unknown>)[key]).toBe(value)
      }
    })

    it('should not contain full-width ，；：？！（） in any zh_cn value from this batch (except the 5 registered exceptions)', () => {
      const fullWidthPunctuation = /[，；：？！（）]/
      const violations: Array<{ key: string; value: string }> = []
      for (const key of p5eTask1Keys) {
        if (key in fullWidthExceptions) continue
        const value = (zh as Record<string, unknown>)[key]
        if (typeof value !== 'string') continue
        if (fullWidthPunctuation.test(value)) violations.push({ key, value })
      }
      if (violations.length > 0) {
        const details = violations.map((v) => `${v.key} = "${v.value}"`).join('\n')
        expect.fail(
          `Found full-width ，；：？！（） in P5e Task 1 zh_cn values (should be half-width per the authoritative Vue2 zh_CN.json; if this is a legitimate Vue2-authentic exception, stop and report before adding it here):\n${details}`
        )
      }
    })

    it('should not contain full-width ，；：？！（） in any en_us value from this batch (measured: 0 hits)', () => {
      const fullWidthPunctuation = /[，；：？！（）]/
      const violations = p5eTask1Keys.filter((k) => {
        const value = (en as Record<string, unknown>)[k]
        return typeof value === 'string' && fullWidthPunctuation.test(value)
      })
      expect(violations).toEqual([])
    })

    // Appendix A §A.2.2/§A.2.3 lists characters that the scan regex above cannot see but that
    // must still be byte-exact. The half-width comma in aiKbFdCopyFailed is the sharpest one:
    // it sits in a Chinese sentence, so "tidying" it to ，would look like a fix. Pinned by
    // codepoint, not just by string equality, so a failure message names the character.
    it('pins the codepoint-level characters the full-width scan cannot see (§A.2.2/§A.2.3)', () => {
      // Half-width comma U+002C, NOT full-width U+FF0C — Vue2's own value (§A.1.2 note on aiKbFdCopyFailed).
      expect((zh as Record<string, string>).aiKbFdCopyFailed).toBe('复制失败,请手动选择')
      expect((zh as Record<string, string>).aiKbFdCopyFailed.includes(',')).toBe(true)
      expect((zh as Record<string, string>).aiKbFdCopyFailed.includes('，')).toBe(false)
      // em dash U+2014 with one half-width space on each side.
      expect((zh as Record<string, string>).aiKbSrMoreHint).toBe('还有 {n} 段相关内容 — 点击查看')
      expect((zh as Record<string, string>).aiKbSrMoreHint).toContain(' — ')
      // 「」 U+300C / U+300D.
      expect((zh as Record<string, string>).aiKbSrEmptyTipAllowlist).toBe('去「索引范围」看看规则')
      expect((zh as Record<string, string>).aiKbFdSummary).toContain('「')
      expect((zh as Record<string, string>).aiKbFdSummary).toContain('」')
      // … U+2026 as ONE character, not three dots.
      expect((zh as Record<string, string>).aiKbSrPlaceholder).toBe('搜你的文档…')
      expect((zh as Record<string, string>).aiKbSrPlaceholder.endsWith('…')).toBe(true)
      expect((zh as Record<string, string>).aiKbSrPlaceholder.endsWith('...')).toBe(false)
      expect((en as Record<string, string>).aiKbSrPlaceholder.endsWith('…')).toBe(true)
      // 。U+3002 twice in aiKbSrIdleSub.
      expect(
        (zh as Record<string, string>).aiKbSrIdleSub.split('。').length - 1,
        'aiKbSrIdleSub 应有两个全角句号'
      ).toBe(2)
      // en side em dashes (§A.2.3).
      for (const k of ['aiKbFdCopyFailed', 'aiKbSrMoreHint', 'aiKbSrNoPreviewToast', 'aiKbSrIdleSub']) {
        expect((en as Record<string, string>)[k], `${k}.en 应含 em dash`).toContain('—')
      }
      // aiKbFdSummary's en really carries two half-width double quotes around {query}.
      expect((en as Record<string, string>).aiKbFdSummary).toBe(
        'Found {n} matching sections for "{query}", ranked by similarity'
      )
    })

    // (b) Placeholder-name parity between zh_cn and en_us, scoped to this batch's 6 keys that
    // carry {…} interpolation — re-derived by scanning the shipped values, not trusting Appendix
    // A §A.3. aiKbFdSummary is this batch's only two-placeholder key ({n} + {query}).
    const placeholderKeysWithInterpolation = [
      'aiKbFdPage', 'aiKbFdSection', 'aiKbFdSummary', 'aiKbSrMatchPill', 'aiKbSrMatchTitle',
      'aiKbSrMoreHint',
    ] as const

    it('covers exactly the 6 keys in this batch that carry interpolation placeholders', () => {
      expect(placeholderKeysWithInterpolation.length).toBe(6)
    })

    // Re-derive the list instead of only asserting its length: if a future edit adds a
    // placeholder to a 7th key, the length check above would stay green while the new key never
    // gets a parity check. This scans all 54 shipped values in both locales and demands the set
    // of placeholder-bearing keys is exactly the 6 above.
    it('no other key in this batch carries a {…} placeholder (list is derived from the shipped values, not assumed)', () => {
      const carries = (v: unknown) => typeof v === 'string' && /\{[a-zA-Z]+\}/.test(v)
      const found = p5eTask1Keys.filter(
        (k) => carries((zh as Record<string, unknown>)[k]) || carries((en as Record<string, unknown>)[k])
      )
      expect([...found].sort()).toEqual([...placeholderKeysWithInterpolation].sort())
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

    // 🔴 E-45: "the output no longer contains the literal {n}" is a ZERO-discriminating-power
    // assertion — vue-i18n silently substitutes the empty string for an unmatched placeholder
    // name, so renaming {n} to {m} in one locale still yields a string without "{n}". These
    // render through real vue-i18n with the params the product code actually passes and pin the
    // fully interpolated result, so a one-locale placeholder rename fails here.
    describe('E-45 — placeholders interpolate to the real value (not merely "no literal {n}")', () => {
      const zhI18n = () => createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
      const enI18n = () => createI18n({ legacy: false, locale: 'en_us', messages: { en_us: en } })

      const singleN: Array<{ key: string; zhOut: string; enOut: string }> = [
        { key: 'aiKbFdPage', zhOut: '第 7 页', enOut: 'Page 7' },
        { key: 'aiKbFdSection', zhOut: '第 7 段', enOut: 'Section 7' },
        { key: 'aiKbSrMatchPill', zhOut: '7 段匹配', enOut: '7 matches' },
        { key: 'aiKbSrMatchTitle', zhOut: '命中 7 段', enOut: '7 matching sections' },
        {
          key: 'aiKbSrMoreHint',
          zhOut: '还有 7 段相关内容 — 点击查看',
          enOut: '7 more matching sections — click to view',
        },
      ]

      // Review Minor-1: this was the only parameterised list in this block whose length
      // was not pinned (the other 54/5/6/5/9 lists all are). Without it, deleting an entry here
      // silently removes that key's interpolation `toBe` and all three gates stay green.
      it('the { n } interpolation list still covers exactly the 5 single-placeholder keys', () => {
        expect(singleN).toHaveLength(5)
      })

      for (const { key, zhOut, enOut } of singleN) {
        it(`${key} interpolates { n: 7 } into the exact rendered string in both locales`, () => {
          expect(zhI18n().global.t(key, { n: 7 })).toBe(zhOut)
          expect(enI18n().global.t(key, { n: 7 })).toBe(enOut)
        })
      }

      it('aiKbFdSummary (the batch\'s only two-placeholder key) interpolates BOTH {n} and {query}', () => {
        expect(zhI18n().global.t('aiKbFdSummary', { n: 3, query: '甲状腺' })).toBe(
          '为「甲状腺」找到 3 段相关内容，按相似度排序'
        )
        expect(enI18n().global.t('aiKbFdSummary', { n: 3, query: 'thyroid' })).toBe(
          'Found 3 matching sections for "thyroid", ranked by similarity'
        )
      })

      // The measurement behind E-45, kept as a live assertion rather than a prose claim: an
      // unmatched placeholder name renders as EMPTY, which is exactly why "not.toContain('{n}')"
      // cannot detect a broken placeholder. If a future vue-i18n upgrade changed this to leave
      // the literal token, this assertion goes red and the comment above needs revisiting.
      it('vue-i18n substitutes the empty string for an unmatched placeholder name (the reason the assertions above pin the full output)', () => {
        const rendered = zhI18n().global.t('aiKbFdSummary', { n: 3 }) // no `query` passed
        expect(rendered).toBe('为「」找到 3 段相关内容，按相似度排序')
        expect(rendered).not.toContain('{query}')
      })
    })

    // 🔴 §7.1 / §9.2 / §9.3 — bidirectional collision scan, re-run here over the shipped tables.
    // Appendix A §A.1.2 refuses reuse for all 14 governance-named high-risk values on the A-1
    // rationale ("the key's naming semantics belong to a different area — if that area's copy
    // changes later, it would silently break the search area"). For most of them BOTH
    // axes collide, so no assertion can distinguish the right key from the wrong one — the
    // protection there is that the components import the aiKb* key (T6/T7's concern). For these 5
    // pairs one axis genuinely diverges, so reusing the forbidden key WOULD visibly change the
    // rendered UI; those are asserted, and the pair set itself is pinned so a newly created
    // one-axis collision has to be registered rather than silently appearing.
    // 🔴 P5f Task 1 registration (2026-08-06): the set below grew 5 → 6. This guard's stated
    // purpose is "a newly created one-axis collision has to be registered rather than silently
    // appearing", and P5f's aiKbAlFileTypes ('文件类型' / 'File types') is exactly that — it
    // collides with P5e's aiKbSrFileType on zh while the en side stays distinct ('File types' vs
    // 'File type'). So this guard fired as designed and the pair is registered here with its own
    // real assertion. 🔴 §9.10 — the change is strictly ADDITIVE (one more entry, one more
    // generated `it`, count assertion 5 → 6); no existing assertion was relaxed, and the
    // set-equality assertion below is still exact.
    describe('P5e Task 1 §9.2/§9.3 bidirectional collision scan — the one-axis-divergent pairs', () => {
      const divergent: Array<{ newKey: string; forbiddenKey: string; axis: 'en' | 'zh' }> = [
        // Direction 1 (§9.2): zh collides, en must stay distinct.
        { newKey: 'aiKbSrAdvOn', forbiddenKey: 'aiSkEnable', axis: 'en' }, //  启用: Enabled vs Enable
        // Settings parity 2026-08-24 registered this pair (guard fired as designed): the Feishu
        // card's enable button ('启用' / 'Enable', verbatim from Vue2 channelsLarkEnable) collides
        // with aiKbSrAdvOn on zh while en stays distinct ('Enable' vs 'Enabled'). Additive per
        // §9.10 — one more entry, count 6 → 7, no existing assertion relaxed.
        { newKey: 'aiKbSrAdvOn', forbiddenKey: 'aiCfgChannelsLarkEnable', axis: 'en' }, // 启用: Enabled vs Enable
        { newKey: 'aiKbSrRelMid', forbiddenKey: 'appsSettingsCpuMedium', axis: 'en' }, // 中: Mid vs Medium
        { newKey: 'aiKbSrRelMid', forbiddenKey: 'aiThinkingMedium', axis: 'en' }, //      中: Mid vs Medium
        { newKey: 'aiKbSrFileType', forbiddenKey: 'aiKbAlFileTypes', axis: 'en' }, // 文件类型: File type vs File types
        // Direction 2 (§9.3, mirror): en collides, zh must stay distinct.
        { newKey: 'aiKbSrAdvOn', forbiddenKey: 'aiCfgChannelsEnabled', axis: 'zh' }, // Enabled: 启用 vs 已启用
        { newKey: 'aiKbSrAdvanced', forbiddenKey: 'appsSettingsSectionAdvanced', axis: 'zh' }, // Advanced: 高级筛选 vs 高级
      ]

      it('covers exactly the 7 one-axis-divergent pairs currently found by this scan (1 registered by settings parity 2026-08-24)', () => {
        expect(divergent.length).toBe(7)
      })

      for (const { newKey, forbiddenKey, axis } of divergent) {
        it(`${newKey} must not collapse onto ${forbiddenKey} on the ${axis} axis`, () => {
          const zhNew = (zh as Record<string, unknown>)[newKey]
          const enNew = (en as Record<string, unknown>)[newKey]
          const zhForbidden = (zh as Record<string, unknown>)[forbiddenKey]
          const enForbidden = (en as Record<string, unknown>)[forbiddenKey]
          expect(typeof zhNew, `${newKey} zh`).toBe('string')
          expect(typeof enNew, `${newKey} en`).toBe('string')
          expect(typeof zhForbidden, `${forbiddenKey} zh`).toBe('string')
          expect(typeof enForbidden, `${forbiddenKey} en`).toBe('string')
          if (axis === 'en') {
            expect(enNew, `${newKey}.en must differ from ${forbiddenKey}.en`).not.toBe(enForbidden)
          } else {
            expect(zhNew, `${newKey}.zh must differ from ${forbiddenKey}.zh`).not.toBe(zhForbidden)
          }
        })
      }

      // Pin the scan's OUTPUT, not just the hand-written table: re-run both directions over the
      // whole locale table for all 54 batch keys and demand the divergent-pair set is exactly
      // the 5 above. Without this, a future key elsewhere in the app that collides with one of
      // this batch's values on a single axis would appear silently, and the "register per
      // A-1/N21" discipline would have nothing enforcing it.
      it('the scan over the whole table finds exactly these 7 one-axis-divergent pairs (assume the coordinator table is incomplete — §7.1)', () => {
        const zhAll = zh as Record<string, string>
        const enAll = en as Record<string, string>
        const found: string[] = []
        for (const k of p5eTask1Keys) {
          for (const o of Object.keys(zhAll)) {
            if (o === k) continue
            const zhSame = zhAll[o] === zhAll[k]
            const enSame = enAll[o] === enAll[k]
            if (zhSame === enSame) continue // both collide, or neither — not a one-axis pair
            found.push(`${k}|${o}|${zhSame ? 'en' : 'zh'}`)
          }
        }
        expect(found.sort()).toEqual(
          divergent.map(({ newKey, forbiddenKey, axis }) => `${newKey}|${forbiddenKey}|${axis}`).sort()
        )
      })
    })
  })

  // 79 new aiKb* keys for the knowledge base's last three pages
  // (AllowlistView.vue, RootsView.vue, WikiView.vue — plus WikiView's OP_LABEL_KEYS and
  // AllowlistView's GROUPS_TEMPLATE.labelKey, which reach $t() through a variable and so never
  // appear literally in a template). Same shape as the five prior P5* Task 1 guards above (a fixed
  // key list scoped to this batch + presence check + punctuation scan + placeholder parity +
  // bidirectional collision scan), per p5f-common-constraints.md §7 / p5f-appendix-A-i18n.md /
  // this task's brief §2.
  //
  // Scope is deliberately this batch's 79 keys, never the whole file — see the P5a Task 8 block
  // above for why a file-wide placeholder-parity assertion would be wrong (aiResTurn /
  // aiResFilesInTurns intentionally differ, {s} being an English plural suffix).
  //
  // Three of this batch's strings (`Delete` / `Auto` / `Removed`) are byte-identical
  // in BOTH locales to existing aiKbNtDelete / aiKbOriginAuto / aiKbDeviceAuto / aiKbStatusRemoved
  // and were still created new, because those keys' semantic domains are the notes page / a note's
  // origin / the Parser device / an indexed file's status. A-1's rationale: "the key's naming
  // semantics belong to a different area — if that area's copy changes later, it would silently
  // break the knowledge base". Value assertions cannot express that decision (the values
  // are equal by construction), so it is pinned in a dedicated verification script instead.
  describe('P5f Task 1 aiKb* keys — punctuation, placeholder and collision guards', () => {
    // Matches the marked block of new keys in zh_cn.ts / en_us.ts:
    // Appendix A §A.6's 90 rows minus the 11 rows this
    // batch reuses. All 79 have a Vue2-authoritative zh AND en value (90/90 Vue2 coverage measured,
    // zero self-invented copy, zero dead keys).
    const p5fTask1Keys = [
      'aiKbAdd', 'aiKbAlAddFailed', 'aiKbAlAddFolderRule', 'aiKbAlAddRule', 'aiKbAlAddedExt',
      'aiKbAlAdvancedCustom', 'aiKbAlAllDeselected', 'aiKbAlAllSelected', 'aiKbAlAllow',
      'aiKbAlAllowDesc', 'aiKbAlDeleteFailed', 'aiKbAlDeleteRule', 'aiKbAlDeletedCleaning',
      'aiKbAlDeny', 'aiKbAlDenyDesc', 'aiKbAlEnabledSuffix', 'aiKbAlExampleHint',
      'aiKbAlFileTypes', 'aiKbAlFileTypesHint', 'aiKbAlFolderRules', 'aiKbAlGroupCode',
      'aiKbAlGroupDocuments', 'aiKbAlGroupText', 'aiKbAlLibrary', 'aiKbAlLibraryHint',
      'aiKbAlNoRules', 'aiKbAlNowIndexing', 'aiKbAlPathHint', 'aiKbAlPriorityFull',
      'aiKbAlPriorityHint', 'aiKbAlSaveFailed', 'aiKbAlSaveRule', 'aiKbAlSavedCleaning',
      'aiKbAlSelectAll', 'aiKbAlSelectNone', 'aiKbAlStoppedIndexing', 'aiKbRescanStarted',
      'aiKbRtAddMirror', 'aiKbRtAddRoot', 'aiKbRtAdvancedOptions', 'aiKbRtBackendTooOld',
      'aiKbRtDelete', 'aiKbRtDeleteHint', 'aiKbRtDeleteTitle', 'aiKbRtEmpty', 'aiKbRtPurgeFiles',
      'aiKbRtReadOnly', 'aiKbRtRescanNow', 'aiKbRtRootAdded', 'aiKbRtRootDeleted',
      'aiKbRtRootDisabled', 'aiKbRtRootEnabled', 'aiKbRtScanEvery', 'aiKbRtScanInterval',
      'aiKbRtSelectedPath', 'aiKbRtSubtitle', 'aiKbRtWatchAuto', 'aiKbRtWatchMode',
      'aiKbRtWatchScanOnly', 'aiKbWkCollapsed', 'aiKbWkContents', 'aiKbWkEmptySub',
      'aiKbWkEmptyTitle', 'aiKbWkItemCount', 'aiKbWkMaintained', 'aiKbWkNoSummarySub',
      'aiKbWkNoSummaryTitle', 'aiKbWkOpAdded', 'aiKbWkOpRemoved', 'aiKbWkOpRenamed',
      'aiKbWkOpUpdated', 'aiKbWkOpenFolder', 'aiKbWkRecentChanges', 'aiKbWkRenderNote',
      'aiKbWkRenderedView', 'aiKbWkRescanRoot', 'aiKbWkSummaryUpdated', 'aiKbWkTreeError',
      'aiKbWkViewSource',
    ] as const

    // (c) "exactly N keys" drift guard. N = 79, measured (not taken from the appendix table):
    // 35 aiKbAl* + 22 aiKbRt* + 20 aiKbWk* + 2 stemless (aiKbAdd is used by both Allowlist and
    // Roots, aiKbRescanStarted by both Roots and Wiki — p5f-common-constraints.md §7's stem rule
    // sends multi-page copy to the stemless aiKb* namespace).
    it('covers exactly the 79 keys this task added (list itself does not drift)', () => {
      expect(p5fTask1Keys.length).toBe(79)
      expect(p5fTask1Keys.filter((k) => k.startsWith('aiKbAl')).length).toBe(35)
      expect(p5fTask1Keys.filter((k) => k.startsWith('aiKbRt')).length).toBe(22)
      expect(p5fTask1Keys.filter((k) => k.startsWith('aiKbWk')).length).toBe(20)
      expect(p5fTask1Keys.filter((k) => !/^aiKb(Al|Rt|Wk)/.test(k)).length).toBe(2)
    })

    // Carried forward from the P5b Task 1 review finding (Important I-1): the length check above
    // only pins the literal array in this file, it says nothing about whether the keys exist in
    // the locales. parity.test.ts only compares the two locales against each other (deleting
    // from both keeps them equal), and the punctuation loop below silently `continue`s past a
    // non-string value — so without this, an accidental delete/rename would stay green.
    it('every key in this batch is present as a string in both locales', () => {
      const missing = p5fTask1Keys.filter(
        (k) =>
          typeof (zh as Record<string, unknown>)[k] !== 'string' ||
          typeof (en as Record<string, unknown>)[k] !== 'string'
      )
      expect(missing).toEqual([])
    })

    // The 11 reused keys (Appendix A §A.2 minus ruling R3's three) must still exist — this batch's
    // Allowlist/Roots/Wiki copy depends on them without redefining them, so a later cleanup that
    // decides "nothing in the search/notes area uses aiKbColPath any more" would silently blank
    // out these three pages too.
    it('the 11 reused aiKb* keys this batch depends on still exist in both locales', () => {
      const reused = [
        'aiKbCancel', 'aiKbColAction', 'aiKbColPath', 'aiKbLastScan', 'aiKbManageRoots',
        'aiKbNavRoots', 'aiKbNever', 'aiKbOpFailed', 'aiKbRealtimeWatch', 'aiKbRetry',
        'aiKbScheduledScanOnly',
      ]
      expect(reused.length).toBe(11)
      const missing = reused.filter(
        (k) =>
          typeof (zh as Record<string, unknown>)[k] !== 'string' ||
          typeof (en as Record<string, unknown>)[k] !== 'string'
      )
      expect(missing).toEqual([])
    })

    // 🔴 Key-count dual track (ruling R12, standing rule restated in p5f-common-constraints.md
    // §7): THIS batch's count is pinned exactly (the assertion above), the WHOLE table only as a
    // lower bound. An exact whole-table number is what debt ticket D-3 removed — it makes every
    // future key-adding phase go red in a file that has nothing to do with it (that trap cost P5d
    // one NEEDS_CONTEXT + ruling R15 + erratum E-43). Measured after this task landed: 1727 zh /
    // 1727 en (real module import via esbuild bundle → ESM import; §9.3-2: text parsing
    // under-counts) = 1648 baseline + 79 new, aiKb* 441 → 520.
    // Exact zh↔en key-set equality is parity.test.ts's job.
    it('the whole locale table never shrinks below the count measured when this batch landed', () => {
      expect(Object.keys(zh).length).toBeGreaterThanOrEqual(1727)
      expect(Object.keys(en).length).toBeGreaterThanOrEqual(1727)
    })

    // (a) Full-width punctuation scan. Exceptions re-measured by this task against the shipped
    // values (not copied from Appendix A §A.5): the regex hits exactly 9 of the 79 zh values, and
    // 0 of the 79 en values. Each is pinned with an exact `toBe` rather than merely skipped, per
    // the brief: "an exception list pinned with toBe". The remaining 70 must scan clean.
    //
    // ⚠️ 。(U+3002) 「」(U+300C/300D) ·(U+00B7) —(U+2014) …(U+2026) ×(U+00D7) are NOT in
    // /[，；：？！（）]/ — do not add a key here because a value "looks full-width"; only the
    // regex's actual hits belong in this list. Those characters are still copied verbatim and
    // several of them are pinned by the codepoint assertions further below.
    const fullWidthExceptions: Record<string, string> = {
      aiKbAlAdvancedCustom: '高级：自定义扩展名',
      aiKbAlDeletedCleaning: '已删除，正在清理受影响的文件…',
      aiKbAlExampleHint: '举例：禁止 /Downloads/* 后，该文件夹下所有文件停止索引',
      aiKbAlPathHint: '支持 * 通配符，如 /Photos/**/*.raw',
      aiKbAlPriorityFull: '优先级：禁止 > 允许 > 默认允许。例：禁止 /Downloads/* 下所有文件不被索引。',
      aiKbAlPriorityHint: '优先级：禁止 > 允许 > 默认允许',
      aiKbRtBackendTooOld: '后端版本过旧，请先部署 Wiki 服务更新。',
      aiKbRtDeleteHint: '知识库中的索引数据会保留；重新添加同一目录可直接复用。',
      aiKbRtEmpty: '尚未配置索引目录，知识库不会索引任何文件。',
    }

    it('registers exactly the 9 full-width-punctuation exceptions measured in this batch', () => {
      expect(Object.keys(fullWidthExceptions).length).toBe(9)
    })

    it('pins the exact zh_cn value (with its Vue2-authentic full-width punctuation) for each of the 9 registered exceptions', () => {
      for (const [key, value] of Object.entries(fullWidthExceptions)) {
        expect((zh as Record<string, unknown>)[key]).toBe(value)
      }
    })

    it('should not contain full-width ，；：？！（） in any zh_cn value from this batch (except the 9 registered exceptions)', () => {
      const fullWidthPunctuation = /[，；：？！（）]/
      const violations: Array<{ key: string; value: string }> = []
      for (const key of p5fTask1Keys) {
        if (key in fullWidthExceptions) continue
        const value = (zh as Record<string, unknown>)[key]
        if (typeof value !== 'string') continue
        if (fullWidthPunctuation.test(value)) violations.push({ key, value })
      }
      if (violations.length > 0) {
        const details = violations.map((v) => `${v.key} = "${v.value}"`).join('\n')
        expect.fail(
          `Found full-width ，；：？！（） in P5f Task 1 zh_cn values (should be half-width per the authoritative Vue2 zh_CN.json; if this is a legitimate Vue2-authentic exception, stop and report before adding it here):\n${details}`
        )
      }
    })

    it('should not contain full-width ，；：？！（） in any en_us value from this batch (measured: 0 hits)', () => {
      const fullWidthPunctuation = /[，；：？！（）]/
      const violations = p5fTask1Keys.filter((k) => {
        const value = (en as Record<string, unknown>)[k]
        return typeof value === 'string' && fullWidthPunctuation.test(value)
      })
      expect(violations).toEqual([])
    })

    // The scan regex above cannot see these, and every one of them looks like a typo a future
    // editor would "tidy". They are Vue2's own bytes and must survive verbatim (porting
    // discipline: the UI must be strictly 1:1, copy included). Pinned by codepoint membership, not just string equality, so a failure
    // message names the character.
    it('pins the codepoint-level characters the full-width scan cannot see', () => {
      const Z = zh as Record<string, string>
      // Half-width comma U+002C sitting inside a Chinese sentence — the sharpest one: "fixing" it to ，
      // would look like an improvement. Two keys carry it.
      expect(Z.aiKbWkEmptySub).toBe('添加知识根后,Wiki 导航会自动从你的目录生成。')
      expect(Z.aiKbWkEmptySub.includes(',')).toBe(true)
      expect(Z.aiKbWkEmptySub.includes('，')).toBe(false)
      expect(Z.aiKbWkRenderNote).toBe('本页由 {path} 渲染,索引服务在目录变化后自动重写')
      expect(Z.aiKbWkRenderNote.includes(',')).toBe(true)
      expect(Z.aiKbWkRenderNote.includes('，')).toBe(false)
      // Half-width question mark U+003F in a Chinese modal title.
      expect(Z.aiKbRtDeleteTitle).toBe('删除索引目录?')
      expect(Z.aiKbRtDeleteTitle.endsWith('?')).toBe(true)
      expect(Z.aiKbRtDeleteTitle.endsWith('？')).toBe(false)
      // Half-width parentheses U+0028/U+0029 in Chinese text — two keys.
      expect(Z.aiKbRtScanInterval).toBe('扫描间隔(小时)')
      expect(/[（）]/.test(Z.aiKbRtScanInterval)).toBe(false)
      expect(/[（）]/.test(Z.aiKbRtReadOnly)).toBe(false)
      expect(Z.aiKbRtReadOnly).toContain('(wiki 数据存放在中央目录)')
      // Double em dash U+2014 ×2 with NO surrounding spaces — Vue2 writes 「只读——可改用」.
      expect(Z.aiKbRtReadOnly).toContain('只读——可改用')
      // Single em dash U+2014 with one half-width space on each side (a different convention in
      // the same batch — both are Vue2's own).
      expect(Z.aiKbWkCollapsed).toBe('已折叠 — 内容不逐项索引')
      expect(Z.aiKbWkCollapsed).toContain(' — ')
      // … U+2026 as ONE character, not three dots.
      for (const k of ['aiKbAlSavedCleaning', 'aiKbAlDeletedCleaning'] as const) {
        expect(Z[k].endsWith('…'), `${k} 应以单字符省略号结尾`).toBe(true)
        expect(Z[k].endsWith('...'), `${k} 不许写成三个点`).toBe(false)
      }
      // Full-width full stop U+3002 twice in aiKbAlNoRules (and the half-width [ ] brackets Vue2 uses there).
      expect(Z.aiKbAlNoRules).toBe('还没有规则。点右上角 [+ 添加规则] 开始。')
      expect(Z.aiKbAlNoRules.split('。').length - 1).toBe(2)
      // en side em dashes: 4 keys carry U+2014 and none of them may become a hyphen.
      for (const k of [
        'aiKbAlNoRules', 'aiKbRtBackendTooOld', 'aiKbRtEmpty', 'aiKbRtReadOnly',
        'aiKbWkCollapsed', 'aiKbWkRenderNote',
      ] as const) {
        expect((en as Record<string, string>)[k], `${k}.en 应含 em dash`).toContain('—')
      }
      // aiKbAlLibraryHint really carries half-width double quotes around any, in BOTH locales.
      expect(Z.aiKbAlLibraryHint).toBe('填 "any" 表示所有存储库都生效')
      expect((en as Record<string, string>).aiKbAlLibraryHint).toBe(
        'Use "any" to apply to all libraries'
      )
    })

    // (b) Placeholder-name parity between zh_cn and en_us, scoped to this batch's 9 keys that
    // carry {…} interpolation — re-derived by scanning the shipped values, not trusting Appendix
    // A §A.1. The placeholder-name set is {ext, group, h, n, path, t} = 6 names over 9 keys.
    const placeholderKeysWithInterpolation = [
      'aiKbAlAddedExt', 'aiKbAlAllDeselected', 'aiKbAlAllSelected', 'aiKbAlNowIndexing',
      'aiKbAlStoppedIndexing', 'aiKbRtScanEvery', 'aiKbWkItemCount', 'aiKbWkRenderNote',
      'aiKbWkSummaryUpdated',
    ] as const

    it('covers exactly the 9 keys in this batch that carry interpolation placeholders', () => {
      expect(placeholderKeysWithInterpolation.length).toBe(9)
    })

    // Re-derive the list instead of only asserting its length: if a future edit adds a
    // placeholder to a 10th key, the length check above would stay green while the new key never
    // gets a parity check. This scans all 79 shipped values in both locales and demands the set
    // of placeholder-bearing keys is exactly the 9 above.
    it('no other key in this batch carries a {…} placeholder (list is derived from the shipped values, not assumed)', () => {
      const carries = (v: unknown) => typeof v === 'string' && /\{[a-zA-Z]+\}/.test(v)
      const found = p5fTask1Keys.filter(
        (k) =>
          carries((zh as Record<string, unknown>)[k]) || carries((en as Record<string, unknown>)[k])
      )
      expect([...found].sort()).toEqual([...placeholderKeysWithInterpolation].sort())
    })

    it('the placeholder-name set across this batch is exactly {ext, group, h, n, path, t}', () => {
      const pattern = /\{([a-zA-Z]+)\}/g
      const names = new Set<string>()
      for (const key of placeholderKeysWithInterpolation) {
        for (const locale of [zh, en] as Array<Record<string, unknown>>) {
          const value = locale[key]
          if (typeof value !== 'string') continue
          for (const m of value.matchAll(pattern)) names.add(m[1])
        }
      }
      expect([...names].sort()).toEqual(['ext', 'group', 'h', 'n', 'path', 't'])
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

    // 🔴 E-45: "the output no longer contains the literal {ext}" is a ZERO-discriminating-power
    // assertion — vue-i18n silently substitutes the empty string for an unmatched placeholder
    // name, so renaming {ext} to {e} in one locale still yields a string without "{ext}". These
    // render through real vue-i18n with the params the product code actually passes (Vue2
    // AllowlistView.vue:200/205/207/216, RootsView.vue:26, WikiView.vue:76/103/135) and pin the
    // fully interpolated result, so a one-locale placeholder rename fails here.
    describe('E-45 — placeholders interpolate to the real value (not merely "no literal {x}")', () => {
      const zhI18n = () => createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
      const enI18n = () => createI18n({ legacy: false, locale: 'en_us', messages: { en_us: en } })

      const cases: Array<{
        key: string
        params: Record<string, string | number>
        zhOut: string
        enOut: string
      }> = [
        { key: 'aiKbAlNowIndexing', params: { ext: '.log' }, zhOut: '已收录 .log', enOut: 'Now indexing .log' },
        { key: 'aiKbAlStoppedIndexing', params: { ext: '.log' }, zhOut: '已停止收录 .log', enOut: 'Stopped indexing .log' },
        { key: 'aiKbAlAddedExt', params: { ext: '.log' }, zhOut: '已添加 .log', enOut: 'Added .log' },
        // {group} is itself a $t() result in the product code ($t(g.labelKey)), so the two locales
        // legitimately get different group text — that is why each locale is pinned separately.
        { key: 'aiKbAlAllSelected', params: { group: '文档' }, zhOut: '已全选 文档', enOut: 'All 文档 selected' },
        { key: 'aiKbAlAllDeselected', params: { group: '文档' }, zhOut: '已全不选 文档', enOut: 'All 文档 deselected' },
        { key: 'aiKbRtScanEvery', params: { h: 6 }, zhOut: '每 6 小时扫描', enOut: 'Scan every 6 h' },
        { key: 'aiKbWkItemCount', params: { n: 3 }, zhOut: '3 项', enOut: '3 items' },
        { key: 'aiKbWkSummaryUpdated', params: { t: '3 天前' }, zhOut: '摘要更新于 3 天前', enOut: 'Summary updated 3 天前' },
        {
          key: 'aiKbWkRenderNote',
          params: { path: '/DATA/Docs/.wiki.md' },
          zhOut: '本页由 /DATA/Docs/.wiki.md 渲染,索引服务在目录变化后自动重写',
          enOut: 'This page renders /DATA/Docs/.wiki.md — the index service rewrites it after folder changes',
        },
      ]

      // Review Minor-1: pin the parameterised list's length too. Without it, deleting an
      // entry here silently removes that key's interpolation `toBe` and all three gates stay green.
      // It must also cover every placeholder-bearing key, not merely have the right length.
      it('the interpolation list covers exactly the 9 placeholder-bearing keys', () => {
        expect(cases).toHaveLength(9)
        expect(cases.map((c) => c.key).sort()).toEqual([...placeholderKeysWithInterpolation].sort())
      })

      for (const { key, params, zhOut, enOut } of cases) {
        it(`${key} interpolates ${JSON.stringify(params)} into the exact rendered string in both locales`, () => {
          expect(zhI18n().global.t(key, params)).toBe(zhOut)
          expect(enI18n().global.t(key, params)).toBe(enOut)
        })
      }

      // The measurement behind E-45, kept as a live assertion rather than a prose claim: an
      // unmatched placeholder name renders as EMPTY, which is exactly why "not.toContain('{ext}')"
      // cannot detect a broken placeholder. If a future vue-i18n upgrade changed this to leave
      // the literal token, this assertion goes red and the comment above needs revisiting.
      it('vue-i18n substitutes the empty string for an unmatched placeholder name (the reason the assertions above pin the full output)', () => {
        const rendered = zhI18n().global.t('aiKbAlNowIndexing', { wrongName: '.log' })
        expect(rendered).toBe('已收录 ')
        expect(rendered).not.toContain('{ext}')
      })
    })

    // 🔴 §7.1 / §9.2 / §9.3 — bidirectional collision scan, re-run here over the shipped tables.
    // This task re-ran the scan itself (brief §2-5 / ruling R7-②; "assume the coordinator's
    // table is incomplete") rather
    // than trusting Appendix A §A.3: 28 of the 90 blueprint strings collide with something already
    // in the table, and A-1 refuses reuse for every one of them whose same-value key belongs to
    // another area. For most pairs BOTH axes collide, so no assertion can distinguish the right key
    // from the wrong one — the protection there is that the components import the aiKb* key
    // (T4/T5/T6/T7's concern). For the pairs below exactly one axis diverges, so reusing the
    // forbidden key WOULD visibly change the rendered UI; those are asserted, and the pair set
    // itself is pinned so a newly created one-axis collision has to be registered rather than
    // silently appearing.
    //
    // 🔴 Two of these are WITHIN this batch and are the reason two seemingly duplicate keys exist:
    //   aiKbAlEnabledSuffix ("已启用"/"enabled", a per-group counter suffix) vs
    //   aiKbRtRootEnabled   ("已启用"/"Root enabled", a toast)      ← named by Appendix A §A.3.1
    //   aiKbRtRootDeleted   ("已删除"/"Root deleted", a toast) vs
    //   aiKbWkOpRemoved     ("已删除"/"Removed", a change-log op label) ← NOT in the appendix;
    //                        found by this task's own scan and reported as a new finding.
    // Merging either pair would silently rewrite the English UI of the other page.
    describe('P5f Task 1 §9.2/§9.3 bidirectional collision scan — the one-axis-divergent pairs', () => {
      const divergent: Array<{ newKey: string; forbiddenKey: string; axis: 'en' | 'zh' }> = [
        // Direction 1 (§9.2): zh collides, en must stay distinct.
        { newKey: 'aiKbAlAddFailed', forbiddenKey: 'aiCfgAddFailed', axis: 'en' }, //        添加失败: Add failed vs Failed to add
        { newKey: 'aiKbAlEnabledSuffix', forbiddenKey: 'aiCfgChannelsEnabled', axis: 'en' }, // 已启用: enabled vs Enabled
        { newKey: 'aiKbAlEnabledSuffix', forbiddenKey: 'aiKbRtRootEnabled', axis: 'en' }, //  已启用: enabled vs Root enabled (within batch)
        { newKey: 'aiKbAlEnabledSuffix', forbiddenKey: 'aiKbStatusActive', axis: 'en' }, //   已启用: enabled vs Active
        { newKey: 'aiKbAlEnabledSuffix', forbiddenKey: 'aiSkActive', axis: 'en' }, //         已启用: enabled vs Active
        { newKey: 'aiKbAlFileTypes', forbiddenKey: 'aiKbSrFileType', axis: 'en' }, //         文件类型: File types vs File type
        { newKey: 'aiKbAlGroupDocuments', forbiddenKey: 'aiKbDocumentsSuffix', axis: 'en' }, // 文档: Documents vs documents
        { newKey: 'aiKbRtDelete', forbiddenKey: 'appsSettingsRemove', axis: 'en' }, //         删除: Delete vs Remove
        { newKey: 'aiKbRtRootDeleted', forbiddenKey: 'aiCfgDeleted', axis: 'en' }, //         已删除: Root deleted vs Deleted
        { newKey: 'aiKbRtRootDeleted', forbiddenKey: 'aiKbStatusRemoved', axis: 'en' }, //    已删除: Root deleted vs Removed
        { newKey: 'aiKbRtRootDeleted', forbiddenKey: 'aiKbWkOpRemoved', axis: 'en' }, //      已删除: Root deleted vs Removed (within batch)
        { newKey: 'aiKbRtRootEnabled', forbiddenKey: 'aiCfgChannelsEnabled', axis: 'en' }, // 已启用: Root enabled vs Enabled
        { newKey: 'aiKbRtRootEnabled', forbiddenKey: 'aiKbAlEnabledSuffix', axis: 'en' }, //  已启用: Root enabled vs enabled (within batch, mirror)
        { newKey: 'aiKbRtRootEnabled', forbiddenKey: 'aiKbStatusActive', axis: 'en' }, //     已启用: Root enabled vs Active
        { newKey: 'aiKbRtRootEnabled', forbiddenKey: 'aiSkActive', axis: 'en' }, //           已启用: Root enabled vs Active
        { newKey: 'aiKbRtWatchAuto', forbiddenKey: 'aiCfgAutoPlaceholder', axis: 'en' }, //     自动: Auto vs auto
        { newKey: 'aiKbWkOpRemoved', forbiddenKey: 'aiCfgDeleted', axis: 'en' }, //           已删除: Removed vs Deleted
        { newKey: 'aiKbWkOpRemoved', forbiddenKey: 'aiKbRtRootDeleted', axis: 'en' }, //      已删除: Removed vs Root deleted (within batch, mirror)
        { newKey: 'aiKbWkOpRenamed', forbiddenKey: 'filesRename', axis: 'en' }, //             重命名: Renamed vs Rename
        // There used to also be a pair aiKbWkOpRenamed|filesUploadRename — filesUploadRename
        // became an orphaned, unreferenced key after the SP12 conflict-dialog rewrite and was
        // deleted, so this pair disappeared along with it. The same semantics (rename: Renamed vs
        // Rename) are still guarded by the filesRename / photosPersonMenuRename pairs below, so
        // coverage hasn't thinned out.
        // Direction 2 (§9.3, mirror): en collides, zh must stay distinct. This batch has exactly
        // one — Appendix A §A.3.1a calls it "this batch's only single-sided en collision" and it is the reason the
        // en direction cannot be skipped just because the zh column looks clean.
        { newKey: 'aiKbWkOpRemoved', forbiddenKey: 'addPanelRemovedToast', axis: 'zh' }, //  Removed: 已删除 vs 已移除

        // 🔴 6 pairs newly exposed by the merge. This table's discipline is "a newly appearing
        // single-axis collision must be registered, never allowed to appear silently"; these 6
        // pairs are not newly written copy — they were only exposed for the first time because
        // **the locale table grew larger after the merge**. On the sp8 branch the table only had
        // base (520 keys at the fork point) + ai; after the merge, the master-side SP7 Photos and
        // SP6 Storage keys were pulled in too, which is what exposed aiKb*'s single-axis collisions
        // with them. All 6 pairs are the same familiar type as ones already registered
        // (rename/delete/file-type), and the direction of divergence is correct in every case —
        // merging any of them would silently rewrite another page's UI, so they stay separate.
        { newKey: 'aiKbAlDeleteFailed', forbiddenKey: 'raidRemoveFailed', axis: 'en' }, //     删除失败: Delete failed vs Failed to delete array
        { newKey: 'aiKbAlFileTypes', forbiddenKey: 'photosSearchFileType', axis: 'en' }, //    文件类型: File types vs File type
        { newKey: 'aiKbWkOpRenamed', forbiddenKey: 'photosPersonMenuRename', axis: 'en' }, //  重命名: Renamed vs Rename
        { newKey: 'aiKbWkOpRenamed', forbiddenKey: 'photosPlacesSpotRename', axis: 'en' }, //  重命名: Renamed vs Rename
        { newKey: 'aiKbWkOpRenamed', forbiddenKey: 'photosSvRename', axis: 'en' }, //          重命名: Renamed vs Rename
        // Second single-sided en collision (zh must stay distinct):
        { newKey: 'aiKbWkOpRemoved', forbiddenKey: 'raidMemberRemoved', axis: 'zh' }, //     Removed: 已删除 vs 已移除
      ]

      it("covers exactly the 26 one-axis-divergent pairs found by this task's own scan (21 pre-existing + 6 newly exposed after merging − 1 removed with its orphan key)", () => {
        expect(divergent.length).toBe(26)
        expect(divergent.filter((d) => d.axis === 'zh').length).toBe(2)
        expect(divergent.filter((d) => d.axis === 'en').length).toBe(24)
      })

      for (const { newKey, forbiddenKey, axis } of divergent) {
        it(`${newKey} must not collapse onto ${forbiddenKey} on the ${axis} axis`, () => {
          const zhNew = (zh as Record<string, unknown>)[newKey]
          const enNew = (en as Record<string, unknown>)[newKey]
          const zhForbidden = (zh as Record<string, unknown>)[forbiddenKey]
          const enForbidden = (en as Record<string, unknown>)[forbiddenKey]
          expect(typeof zhNew, `${newKey} zh`).toBe('string')
          expect(typeof enNew, `${newKey} en`).toBe('string')
          expect(typeof zhForbidden, `${forbiddenKey} zh`).toBe('string')
          expect(typeof enForbidden, `${forbiddenKey} en`).toBe('string')
          if (axis === 'en') {
            expect(enNew, `${newKey}.en must differ from ${forbiddenKey}.en`).not.toBe(enForbidden)
          } else {
            expect(zhNew, `${newKey}.zh must differ from ${forbiddenKey}.zh`).not.toBe(zhForbidden)
          }
        })
      }

      // Pin the scan's OUTPUT, not just the hand-written table: re-run both directions over the
      // whole locale table for all 79 batch keys and demand the divergent-pair set is exactly the
      // 21 above. Without this, a future key elsewhere in the app that collides with one of this
      // batch's values on a single axis would appear silently, and the "register per A-1" discipline
      // would have nothing enforcing it.
      it('the scan over the whole table finds exactly these 26 one-axis-divergent pairs (assume the coordinator table is incomplete — §7.1)', () => {
        const zhAll = zh as Record<string, string>
        const enAll = en as Record<string, string>
        const found: string[] = []
        for (const k of p5fTask1Keys) {
          for (const o of Object.keys(zhAll)) {
            if (o === k) continue
            const zhSame = zhAll[o] === zhAll[k]
            const enSame = enAll[o] === enAll[k]
            if (zhSame === enSame) continue // both collide, or neither — not a one-axis pair
            found.push(`${k}|${o}|${zhSame ? 'en' : 'zh'}`)
          }
        }
        expect(found.sort()).toEqual(
          divergent
            .map(({ newKey, forbiddenKey, axis }) => `${newKey}|${forbiddenKey}|${axis}`)
            .sort()
        )
      })
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
