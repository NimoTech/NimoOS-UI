/// <reference types="node" />
// Reference the node types explicitly instead of adding "node" to tsconfig's types array (same as color-guard.test.ts:8-10).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'
import { SETTINGS_TABS } from '../util/tabs'
import { PANEL_BY_TAB } from './index'

const i18n = createI18n({
  legacy: false,
  locale: 'zh_cn',
  messages: { zh_cn: { ...zh, ...zhSp9 } },
})

describe('9 tab skeletons', () => {
  it('every tab resolves to a component', () => {
    for (const t of SETTINGS_TABS) {
      expect(PANEL_BY_TAB[t], t).toBeTruthy()
    }
    expect(Object.keys(PANEL_BY_TAB)).toHaveLength(10)
  })

  // Since P1, general has real content (see GeneralPanel.integration.test.ts) and no longer has .set-skeleton;
  // developer has had real content since Task 11 too (see DeveloperPanel.test.ts), likewise no longer a bare skeleton.
  // Since P2, network also has real content (see network/NetworkPanel.integration.test.ts) — it calls
  // service.network.getInterfaces() and useUtilization (MessageBus + /sys/utilization),
  // but this file is a **zero-mock** bare-skeleton test, so mounting it throws because getHttp() isn't initialized.
  // Since P3, system-status also has real content (see SystemStatusPanel.test.ts) — for the same reason it calls
  // service.sys.getGatewayComponents(); the exclusion reason matches network.
  // Since P3, terminal also has real content (see TerminalPanel.test.ts) — for the same reason it calls
  // service.sys.getLogs(); the exclusion reason matches network/system-status.
  // Since Task 7, storage also has real content (capacity overview + navigation entry card, see StoragePanel.test.ts) —
  // for the same reason it calls service.storage.list() and uses useRouter(); the exclusion reason matches the above.
  // Since Task 9, apps also has real content (four data-location rows + Docker cache cleanup + upload-cache placeholder, see
  // AppsPanel.test.ts) — for the same reason it calls service.sys.getSystemPaths()/service.storage.list() and uses
  // useToast() (pinia); the exclusion reason matches the above.
  // Since P4, folder-permissions and account also have real content
  // (see FolderPermissionsPanel.test.ts / AccountPanel.test.ts) — **at this point all 9 tabs are fully implemented,
  // so there's no longer any target left for the skeleton spot-check** (the original it.each and the "skeleton copy keys all have translations" case are retired along with it).
  // Replaced with the closing assertion below: no tab should render .set-skeleton anymore.
  //
  // Why not prove this by mounting each one: 7 of the 9 panels call real APIs / use useRouter / use pinia,
  // and this file is a **zero-mock** synchronous test (see the exclusion reasons for each stage above). So scan the source instead.
  //
  // ⚠️ What we check is the **`settingsSkeletonHint`** copy key, **not the `.set-skeleton` class name** —
  // the latter has been reused by AppsPanel / StoragePanel as a "fetch in flight" loading placeholder (their tests
  // assert `.set-skeleton` exists first, then doesn't after flush), so using the class name as the criterion would always fail.
  // That copy key is only used by the P0 empty-skeleton template, so **zero references** now means all 9 tabs are fully implemented.
  it('all 9 tabs are fully implemented: no panel still renders the P0 skeleton hint copy', () => {
    // ⚠️ Resolve the directory with fileURLToPath(import.meta.url) — **do not use `new URL('.', import.meta.url).pathname`**
    // — under vitest the latter gives a path relative to root, and readdir will ENOENT (same as color-guard.test.ts).
    const dir = path.dirname(fileURLToPath(import.meta.url))
    const leftovers: string[] = []
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) walk(p)
        else if (e.name.endsWith('.vue') && fs.readFileSync(p, 'utf8').includes('settingsSkeletonHint')) {
          leftovers.push(path.relative(dir, p))
        }
      }
    }
    walk(dir)
    expect(leftovers).toEqual([])
  })

  // SP18: the bare "unavailable" empty state moved inside TerminalSecuritySection,
  // which is now admin-gated (useSessionStore().isAdmin) and only reachable after the
  // async getSettings() load settles — so it's no longer a synchronous, zero-mock
  // assertion target. TerminalPanel now calls useSessionStore() unconditionally in
  // setup(), which requires an active Pinia (same exclusion reason as the `apps` case
  // below). Real interaction (admin gate, load-failure fallback, save/confirm flow) is
  // covered by TerminalPanel.test.ts and TerminalSecuritySection.test.ts (both mock
  // service.terminal). This test keeps only the static, mock-free assertion: no
  // section title, and the logs card is present regardless of admin state.
  it('terminal has no title (matches Vue2 L51); now a real logs card + admin-only security section (SP18)', () => {
    setActivePinia(createPinia())
    const w = mount(PANEL_BY_TAB.terminal, { global: { plugins: [i18n] } })
    expect(w.find('.set-section-head').exists()).toBe(false)
    expect(w.find('[data-test="logs-pre"]').exists()).toBe(true)
    expect(w.find('[data-test="mode-row"]').exists()).toBe(false) // no admin user in localStorage
  })

  // storage's real interactions (capacity accounting, the 8% heuristic, navigating to /storage, failure empty state, staleness guard) have moved to
  // StoragePanel.test.ts (with service/router mocks). This file only pins down one static marker verifiable with zero mocks:
  // the entry-card button is unaffected by whether the async fetch has settled — it's present immediately after mount (not gated behind a v-if).
  it('storage has real content (overview + entry card), no longer a bare skeleton', async () => {
    const w = mount(PANEL_BY_TAB.storage, { global: { plugins: [i18n] } })
    // Review Important #3 added a real loading state: .set-skeleton renders before the fetch settles (not an oversight,
    // it avoids exposing a stretch of fake zero readings before settling) — here we first pin down that it does go through the loading state, then flush until settled and
    // assert it's no longer a skeleton.
    expect(w.find('.set-skeleton').exists()).toBe(true)
    expect(w.find('.set-store-entry').exists()).toBe(true) // entry card isn't gated by the loading state
    await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(false)
    expect(w.find('.set-store-entry').exists()).toBe(true)
  })

  // apps's real interactions (displayNames converting to virtual paths, migration dialog linkage, Docker cleanup double-confirm, prune
  // success/failure toasts) have moved to AppsPanel.test.ts (with service mocks). This file only pins down one static marker verifiable
  // with zero mocks: the four data-location rows always render (whether the fetch has settled doesn't affect the row count, same precedent as storage).
  // AppsPanel uses useToast() (a pinia store), so it needs an active Pinia even with zero mocks, otherwise
  // the setup() phase throws with "no active Pinia" — installed only inside this one it(), without affecting other cases.
  it('apps has real content (four data-location rows + Docker cleanup + upload-cache placeholder), no longer a bare skeleton', async () => {
    setActivePinia(createPinia())
    const w = mount(PANEL_BY_TAB.apps, { global: { plugins: [i18n] } })
    // Review Important #3 added a real loading state: .set-skeleton renders before both APIs settle (not
    // an oversight, it avoids exposing four rows of fake zero readings before settling) — here we pin down that it does go through the loading state.
    expect(w.find('.set-skeleton').exists()).toBe(true)
    await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(false)
    expect(w.findAll('.set-app-row')).toHaveLength(4)
    expect(w.find('.set-app-prune').exists()).toBe(true)
    expect(w.find('.set-app-pending-btn').attributes('disabled')).toBeDefined()
  })

  // developer's "back button replaces the title / click bubbles open-tab general" case has moved to
  // DeveloperPanel.test.ts — since Task 11 this component calls real APIs (getSSLConfig, etc.),
  // panels.test.ts keeps a zero-mock bare-skeleton test (same precedent as general above).

  // general's "developer entry row still last and can emit open-tab" case has moved to
  // GeneralPanel.integration.test.ts — since P1 this component calls real APIs,
  // panels.test.ts keeps a zero-mock bare-skeleton test (see the task brief Step 4).

  // This spot-check originally used network, but since P2 it's no longer a skeleton → switched to storage, which was still a skeleton;
  // since Task 7 storage is no longer a skeleton either → switched to apps, which was still a skeleton;
  // The "skeleton copy keys all have translations" case (which moved over time from network → storage → apps → folder-permissions →
  // account) has no skeleton left to check as of P4, and was retired along with the case above. The completeness of tab-title translations
  // is guarded jointly by util/tabs.test.ts (the full TAB_LABEL_KEY table) + i18n/parity.test.ts.
})

describe('disabled settings row hover does not turn accent color', () => {
  it('.set-list-item.clickable:hover is qualified with :not(:disabled)', () => {
    const css = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../styles/settings.css'),
      'utf8',
    )
    // Assert against the source text: jsdom doesn't do cascading and can't enter the hover state, so getComputedStyle can't read a result.
    const hoverRules = css.match(/\.set-list-item\.clickable[^{]*:hover[^{]*\{/g) ?? []
    expect(hoverRules.length).toBeGreaterThan(0) // guard against a no-op: if the rule gets renamed this should fail red, not silently pass
    for (const r of hoverRules) expect(r).toContain(':not(:disabled)')
  })
})
