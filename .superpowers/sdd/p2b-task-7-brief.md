## Task 7: `SearchSection`（搜索）

**Files:**
- Create: `src/ai/components/settings/sections/SearchSection.vue`
- Create: `src/ai/components/settings/sections/SearchSection.test.ts`
- Modify: `src/ai/views/SettingsPage.vue`（映射表 `search` 项 + import）
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`

**Interfaces:**
- Consumes: `service.ai.getSearchSettings()` / `putSearchSettings(patch)` / `getFileindexStatus()` / `rescanFileindex()`；`SetSwitch`；`apiErrorMessage`；`copyText`（`src/files/util/clipboard`，AI 区已有跨区引用先例：`src/ai/components/stream/AssistantMessage.vue:10`）
- Produces: i18n 键 `aiCfgSave`（跨分区共用，本任务首次引入）

**Vue2 蓝本：** `sections/SearchSection.vue`（230 行）。Vue2 无既有测试。

### i18n（本任务新增 32 键）

| 新键名 | Vue2 key | zh_cn 值（逐字） | en_us 值（逐字） |
|---|---|---|---|
| `aiCfgSearch` **复用** | `Search` | 搜索 | Search |
| `aiCfgSearchDesc` | `searchDesc` | 配置 Agent 调用统一搜索时的默认行为,以及本地文件名索引的扫描范围与状态。 | Configure the Agent's default behavior for unified search, and the scan scope and status of the local filename index. |
| `aiCfgSearchRestartRequired` | `Root directory / index settings changed — restart the search service to apply.` | 根目录 / 索引设置已更改，需重启搜索服务后生效。 | Root directory / index settings changed — restart the search service to apply. |
| `aiCfgRetrievalParams` | `Retrieval parameters (live)` | 检索参数(即时生效) | Retrieval parameters (live) |
| `aiCfgLive` | `Live` | 即时生效 | Live |
| `aiCfgRetrievalBanner` | `Default sources and per-source result limits used when the Agent calls unified search.` | Agent 调用统一搜索时，默认搜索哪些来源、每路返回多少条。 | Default sources and per-source result limits used when the Agent calls unified search. |
| `aiCfgDefaultSources` | `Default sources:` | 默认搜索源: | Default sources: |
| `aiCfgSourceSemantic` | `Semantic` | 语义 | Semantic |
| `aiCfgSourceFilenames` | `Filenames` | 文件名 | Filenames |
| `aiCfgSourceImages` | `Images` | 图片 | Images |
| `aiCfgSelectAtLeastOneSource` | `Select at least one source.` | 至少选择一个搜索源。 | Select at least one source. |
| `aiCfgSemanticTopK` | `Semantic results:` | 语义返回数: | Semantic results: |
| `aiCfgFilenameTopK` | `Filename results:` | 文件名返回数: | Filename results: |
| `aiCfgImageTopK` | `Image results:` | 图片返回数: | Image results: |
| `aiCfgTotalCap` | `Total cap:` | 合计上限: | Total cap: |
| `aiCfgSave` | `Save` | 保存 | Save |
| `aiCfgFilenameIndex` | `Filename index` | 文件名索引 | Filename index |
| `aiCfgEnableFilenameIndex` | `Enable filename index` | 启用文件名索引 | Enable filename index |
| `aiCfgScanIntervalHours` | `Scan interval (hours):` | 扫描周期(小时): | Scan interval (hours): |
| `aiCfgAddRoot` | `Add root` | 添加根目录 | Add root |
| `aiCfgRescanNow` | `Rescan now` | 立即重扫 | Rescan now |
| `aiCfgFileindexSaveHint` | `Root directory changes take effect immediately…` | 根目录改动即时生效(后台自动重建索引);启用 / 扫描周期改动需重启。 | Root directory changes take effect immediately (index rebuilds in background). Enable / interval changes require a restart. |
| `aiCfgDiagnostics` | `Diagnostics` | 诊断 | Diagnostics |
| `aiCfgIndexStatus` | `Index status:` | 索引状态: | Index status: |
| `aiCfgIndexedFiles` | `Indexed files:` | 已索引文件数: | Indexed files: |
| `aiCfgInotifyLimit` | `inotify limit:` | inotify 当前上限: | inotify limit: |
| `aiCfgInotifyRecommended` | ` (recommended: {n})` | （推荐 {n}） | ` (recommended: {n})`（**英文值开头有一个空格，照抄；中文值没有**） |
| `aiCfgRaiseLimitHint` | `Increase the limit (run on host):` | 调大上限(需在宿主机执行): | Increase the limit (run on host): |
| `aiCfgWatchDegraded` | `⚠ File watching degraded…` | ⚠ 文件监视已降级为仅定时扫描(inotify 配额可能已耗尽)，实时更新会有延迟。 | ⚠ File watching degraded to polling only (inotify quota may be exhausted). Real-time updates will be delayed. |
| `aiCfgIndexReady` | `Ready` | 就绪 | Ready |
| `aiCfgIndexBuilding` | `Building` | 建立中 | Building |
| `aiCfgIndexDisabled` | `Disabled` | 未启用 | Disabled |
| `aiCfgCopyFailed` | `Copy failed — please select manually` | 复制失败,请手动选择 | Copy failed — please select manually |

复用键：`aiCopy`（复制）· `aiCopied`（已复制）· `aiCfgDelete`（删除）· `aiCfgSaved` · `aiCfgSaveFailed`。

- [ ] **Step 1: 写失败的测试（用例清单，24 条）**

mock 骨架同 Task 5（`vi.hoisted()` + `vi.mock('@nimotech/nimoos-service', …)`），额外 mock clipboard：

```ts
const h = vi.hoisted(() => ({
  getSearchSettings: vi.fn(), putSearchSettings: vi.fn(),
  getFileindexStatus: vi.fn(), rescanFileindex: vi.fn(),
  copyText: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: { ai: {
    getSearchSettings: h.getSearchSettings, putSearchSettings: h.putSearchSettings,
    getFileindexStatus: h.getFileindexStatus, rescanFileindex: h.rescanFileindex,
  } },
}))
vi.mock('../../../../files/util/clipboard', () => ({ copyText: h.copyText }))
```

**加载与回填（6 条）**
1. 完整 settings 全部回填：`default_sources`、四个数字、`fileindex_enabled`、`fileindex_scan_interval_h`、`fileindex_roots` 各自出现在对应控件上。
2. `getSearchSettings` 返回 `{ settings: {…} }` **和** 返回 `{ data: { settings: {…} } }` 两种信封都能取到（Vue2 `d.settings || d.data?.settings || {}` 的双兜底，**两条独立用例**）。
3. 字段缺失时的默认值：`semantic_top_k` 等缺失 → 5 / 5 / 5 / 15；`fileindex_roots` 缺失 → `['/DATA']`；`fileindex_scan_interval_h` 缺失 → 6。
4. `getSearchSettings` reject → 不抛、控件留默认值、仍然会去拉一次状态（`getFileindexStatus` 被调用 —— Vue2 `mounted` 里 `loadStatus()` 在 try/catch **之外**，这条锁的就是它）。
5. `getFileindexStatus` 返回 `{data:{…}}` 与直接返回 `{…}` 两种信封都能取（Vue2 `d.data || d`）。
6. `getFileindexStatus` reject → 诊断区渲染默认值（`disabled` / 0），不抛。

**检索参数（6 条）**
7. 点「语义」chip 取消勾选 → `data-on="false"`，再点勾回来。
8. 三个源全取消 → 显示「至少选择一个搜索源。」+ 保存按钮 `disabled`（对照组：有一个源时按钮可用）。
9. 点保存 → `putSearchSettings` 收到**恰好 5 个键**（`default_sources`/`semantic_top_k`/`filename_top_k`/`image_top_k`/`max_total_results`），**不含** fileindex 三键（Vue2 分两个按钮各发各的，别合并）。
10. 保存成功后显示「已保存」。
11. 源为空时点保存不发请求（防守卫被绕过）。
12. **保存失败弹 danger toast**（逻辑修正）+「保存中」复位。

**文件名索引（6 条）**
13. 点「添加根目录」→ 多一行空输入框；点某行删除 → 该行消失（用两行数据验证删的是对的那行）。
14. 保存 fileindex → payload 恰好 3 键，且 `fileindex_roots` **过滤掉纯空白项**（Vue2 `.filter(r => r.trim())`）。
15. 响应 `{restart_required:true}` → 顶部渲染「根目录 / 索引设置已更改…」警告条；`false`/缺失时不渲染（对照组）。
16. 响应两种信封（`resp.data.restart_required` 与 `resp.restart_required`）都能识别（Vue2 `resp.data || resp`）。
17. **保存失败弹 danger toast**（逻辑修正）。
18. 「立即重扫」→ `rescanFileindex()` 被调、按钮期间 disabled；`vi.useFakeTimers()` 推进 1500ms 后 `getFileindexStatus` 被再调一次（Vue2 的 `setTimeout(…, 1500)`）。**再补一条**：卸载后推进 1500ms，`getFileindexStatus` 不再被调（逻辑修正，Vue2 不清定时器）。

**诊断区（4 条）**
19. `status='ready'` → 「就绪」；`'scanning'` → 「建立中」；`'disabled'` → 「未启用」；未知值 → 原样显示（Vue2 的 `|| this.status.status` 兜底）。**四态一条用例内断言完，或拆两条都可。**
20. `inotify` 为 null → 不渲染 inotify 相关行（对照组：有值时渲染上限数字与「（推荐 N）」）。
21. `watch_degraded=true` → 渲染降级警告 `p.warn` + 渲染 `raise_cmd` 复制框；`max_user_watches < recommended` 也渲染复制框（**两个触发条件各一条用例**，Vue2 是 `||`）。
22. 点「复制」→ `copyText(raise_cmd)` 被调 + 成功弹「已复制」toast；`copyText` reject → 弹 warning toast「复制失败,请手动选择」（**逻辑修正**：Vue2 `copyCmd` 只写 `navigator.clipboard?.writeText(...)`，在 HTTP-IP 明文访问下 `navigator.clipboard` 是 `undefined`，可选链直接短路 —— **点了毫无反应也无提示**，这是真机上必然复现的缺陷）。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/ai/components/settings/sections/SearchSection.test.ts`
Expected: FAIL —— 组件不存在。

- [ ] **Step 3: 加 i18n 键 + 实现组件**

状态与逻辑（逐字照用；模板按 Vue2 `:1-140` 逐行搬，`$t` 按上表换键、`SkillIcon` → `AgentIcon`、`:value` → `:model-value`）：

```ts
type SourceKey = 'semantic' | 'filenames' | 'images'
interface Inotify { max_user_watches: number; recommended: number; raise_cmd: string }
interface FileindexStatus {
  status: string; indexed_count: number; watch_degraded: boolean; inotify: Inotify | null
}

const sources = ref<SourceKey[]>(['semantic', 'filenames', 'images'])
const semanticTopK = ref(5)
const filenameTopK = ref(5)
const imageTopK = ref(5)
const maxTotal = ref(15)
const fiEnabled = ref(true)
const scanIntervalH = ref(6)
const roots = ref<string[]>(['/DATA'])
const restartRequired = ref(false)
const status = ref<FileindexStatus>({ status: 'disabled', indexed_count: 0, watch_degraded: false, inotify: null })
const saving = ref(false)
const rescanning = ref(false)
const savedAt = ref(0)
let savedTimer: ReturnType<typeof setTimeout> | null = null
let rescanTimer: ReturnType<typeof setTimeout> | null = null

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    ready: t('aiCfgIndexReady'), scanning: t('aiCfgIndexBuilding'), disabled: t('aiCfgIndexDisabled'),
  }
  return map[status.value.status] || status.value.status      // Vue2 :167 同款兜底
})

onMounted(async () => {
  try {
    const d = (await service.ai.getSearchSettings()) as {
      settings?: Record<string, unknown>; data?: { settings?: Record<string, unknown> }
    }
    const s = d.settings || d.data?.settings || {}
    sources.value = (s.default_sources as SourceKey[]) || sources.value
    semanticTopK.value = (s.semantic_top_k as number) ?? 5
    filenameTopK.value = (s.filename_top_k as number) ?? 5
    imageTopK.value = (s.image_top_k as number) ?? 5
    maxTotal.value = (s.max_total_results as number) ?? 15
    fiEnabled.value = !!s.fileindex_enabled
    scanIntervalH.value = (s.fileindex_scan_interval_h as number) ?? 6
    roots.value = ((s.fileindex_roots as string[]) && (s.fileindex_roots as string[]).slice()) || ['/DATA']
  } catch {
    /* Vue2 :180 同样静默 */
  }
  void loadStatus()      // Vue2 :181 —— 在 try/catch 之外,设置拉失败也要拉状态
})

onUnmounted(() => {
  if (savedTimer) clearTimeout(savedTimer)
  if (rescanTimer) clearTimeout(rescanTimer)   // 逻辑修正:Vue2 :212 的 setTimeout 无人清,
                                                // 卸载后仍会回来 setState(测试第 18 条锁这个)
})

async function loadStatus() {
  try {
    const d = (await service.ai.getFileindexStatus()) as { data?: FileindexStatus } & FileindexStatus
    status.value = (d.data || d) as FileindexStatus
  } catch {
    /* Vue2 :188 同样静默,保留默认值 */
  }
}

function markSaved() {
  savedAt.value = 1
  if (savedTimer) clearTimeout(savedTimer)
  savedTimer = setTimeout(() => { savedAt.value = 0 }, 2000)
}

async function saveParams() {
  if (sources.value.length === 0) return
  saving.value = true
  try {
    await service.ai.putSearchSettings({
      default_sources: sources.value,
      semantic_top_k: semanticTopK.value,
      filename_top_k: filenameTopK.value,
      image_top_k: imageTopK.value,
      max_total_results: maxTotal.value,
    })
    markSaved()
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger')   // 逻辑修正:Vue2 :191-204 无 catch
  } finally {
    saving.value = false
  }
}

async function saveFileindex() {
  saving.value = true
  try {
    const resp = (await service.ai.putSearchSettings({
      fileindex_enabled: fiEnabled.value,
      fileindex_roots: roots.value.filter((r) => r.trim()),
      fileindex_scan_interval_h: scanIntervalH.value,
    })) as { data?: { restart_required?: boolean }; restart_required?: boolean }
    const body = resp.data || resp
    restartRequired.value = !!body.restart_required
    markSaved()
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger')   // 逻辑修正
  } finally {
    saving.value = false
  }
}

async function rescan() {
  rescanning.value = true
  try {
    await service.ai.rescanFileindex()
    if (rescanTimer) clearTimeout(rescanTimer)
    rescanTimer = setTimeout(() => { void loadStatus() }, 1500)
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger')   // 逻辑修正
  } finally {
    rescanning.value = false
  }
}

async function copyCmd() {
  const cmd = status.value.inotify?.raise_cmd
  if (!cmd) return
  // 逻辑修正:Vue2 :215-217 只写 `navigator.clipboard?.writeText(cmd)` —— 明文 HTTP
  // 访问(http://192.168.x.x)不是安全上下文,navigator.clipboard 为 undefined,
  // 可选链短路 → 点了毫无反应也无提示。改用仓库既有的 copyText(带 execCommand 兜底)。
  try {
    await copyText(cmd)
    toast.show(t('aiCopied'))
  } catch {
    toast.show(t('aiCfgCopyFailed'), 3000, 'warning')
  }
}

function toggleSource(k: SourceKey) {
  const i = sources.value.indexOf(k)
  if (i < 0) sources.value.push(k)
  else sources.value.splice(i, 1)
}
```

**Vue2 里有一个死字段不要移植**：`_active`（`SearchSection.vue:174` 存了一份 fileindex 的「当前生效值」，注释说是用来判断 restart-required，但**通篇再没读过** —— 真正的 `restartRequired` 是后端响应里的 `restart_required`）。不移植它，并在报告里申报「Vue2 死字段，未移植」。

模板结构清单（三个 `.sk-section` + 一个条件警告条，照此核对）：`.set-banner.warn`（restartRequired）· 检索参数段（`.set-chips` 三个 `.set-chip[data-on]`、四个数字 `input.set-input.num`、`.set-actions` 里 `button.sk-btn.primary` + `.hint`）· 文件名索引段（`SetSwitch` + 数字框 + `.dir-row` 循环 + `.dir-add` + 两个按钮 + `.hint`）· 诊断段（`.diag` 里若干 `.diag-row`、`.set-copy` 里只读输入框 + `.set-copybtn`、`p.warn`）。

- [ ] **Step 4: 跑测试确认通过（24 例）+ 接映射表 + 全量测试门 + 提交**

```bash
pnpm test src/ai/components/settings/sections/SearchSection.test.ts
pnpm test && pnpm exec vue-tsc --noEmit && pnpm build
git add src/ai/components/settings/sections/SearchSection.vue \
        src/ai/components/settings/sections/SearchSection.test.ts \
        src/ai/views/SettingsPage.vue src/ai/views/SettingsPage.test.ts \
        src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "SP8-P2b Task 7: SearchSection(搜索,修 copyCmd 明文 HTTP 静默失败 + 三处吞错)"
git show --stat HEAD && git status
```

---

