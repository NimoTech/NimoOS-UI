## Task 1: The 2x2 GPU card shows only its ring

**Files:**
- Modify: `src/home/components/widgets/GpuWidget.vue` (template lines 2-11, and the `.pill*` rules at lines 78-83)
- Modify: `src/home/components/widgets/GpuWidget.test.ts`

**Interfaces:**
- Produces: nothing other tasks consume. Independent of Tasks 2-6; may be done first or last.

**Why this reverses an earlier commit.** A commit on this same branch added a frequency pill at 2x2, so the one field integrated graphics reports would be visible at the default size. The owner then looked at the rendered card and found the pills do not fit at 2x2 at all — they are clipped mid-glyph, so the substitution only changed which clipped label was unreadable. The frequency stays available by widening the card. **Say this in the commit body**, or the diff reads as undoing a fix for no reason.

- [ ] **Step 1: Update the two tests that pin the removed behaviour**

In `src/home/components/widgets/GpuWidget.test.ts`:

The test `shows rounded usage and temperature` mounts at `item(2)` and asserts `'61℃'`. Temperature lives only in the `w > 2` branch, so it will no longer render at 2x2. Change that test to mount at `item(4)`, keeping both assertions:

```ts
  it('shows rounded usage and temperature', () => {
    const s = useLiveStatsStore()
    s.ingest({ cpu: null, mem: null, disk: null, net: null, gpu: [{ utilization_gpu: 33.4, temperature: 61, utilization_memory: 20, memory_total: 8e9, name: 'NV' }] } as any)
    // Mounted wide: at the default 2x2 the card is the ring alone, so temperature
    // is only on the page from three columns up.
    const w = mount(GpuWidget, { props: { item: item(4) } })
    expect(w.text()).toContain('33%')
    expect(w.text()).toContain('61℃')
  })
```

Delete the test `shows the frequency at the default 2x2 size, in place of the empty VRAM pill` entirely — it asserts exactly the behaviour being removed — and add in its place:

```ts
  // The 2x2 card is the ring alone. Pills do not fit at that size: the reference
  // screenshot showed them clipped through the middle of the word "Frequency",
  // which is why substituting one pill for another did not help. Everything the
  // pills carried is on the wide card.
  it('renders only the ring at the default 2x2 size, with no pills', () => {
    const w = mountWith(IGPU, 2)
    expect(w.find('.ring').exists()).toBe(true)
    expect(w.findAll('.pill').length).toBe(0)
    expect(w.get('.ring').text()).toContain('0.7%')
  })

  it('still shows temperature, VRAM and frequency once the card is widened', () => {
    const w = mountWith(IGPU, 4)
    const rows = w.findAll('.stat').map((r) => r.text())
    expect(rows.some((r) => r.includes('温度') && r.includes('—'))).toBe(true)
    expect(rows.some((r) => r.includes('频率') && r.includes('1000'))).toBe(true)
  })
```

- [ ] **Step 2: Run the tests and confirm they fail**

```
pnpm vitest run src/home/components/widgets/GpuWidget.test.ts --reporter=verbose
```

Expected: `renders only the ring at the default 2x2 size, with no pills` FAILS because `.pill` elements are still present. The reworked `shows rounded usage and temperature` should already pass at `item(4)`.

- [ ] **Step 3: Remove the pill branch**

In `src/home/components/widgets/GpuWidget.vue`, delete the comment block and the whole `<div v-if="item.w <= 2" class="pill-grid">` element (template lines 3-11), and change the `v-else` on the stats block to `v-if="item.w > 2"`. The `.ring-row.solo` line above stays exactly as it is, so the ring renders at every size:

```html
<template>
  <div class="ring-row solo"><RingGauge :percent="usage" :label="t('widgetUsage')" :color="col" /></div>
  <!-- At 2x2 — the card's default size (registry.ts:27) — the ring is the whole
       card. Pills were tried there and do not fit: they render clipped through the
       middle of their own labels. Temperature, VRAM and frequency are on the wide
       card below. -->
  <div v-if="item.w > 2" class="stats">
```

Then delete the six now-unused `.pill*` rules (lines 78-83 of the `<style scoped>` block): `.pill-grid`, `.card-in > .pill-grid`, `.card-in > .pill-grid .pill`, `.pill`, `.pill s`, `.pill b`.

Leave every computed alone — `temp`, `vram`, `memUse` and `freq` are all still used by the stats branch, and `col` still feeds the ring.

- [ ] **Step 4: Run the tests and confirm they pass**

```
pnpm vitest run src/home/components/widgets/GpuWidget.test.ts --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 5: Check nothing else asserted the pills**

```
pnpm vitest run src/home/components/widgets/ --reporter=verbose
```

Expected: PASS. If another widget test referenced `.pill`, update it and say so in the commit body.

- [ ] **Step 6: Build**

```
pnpm build
```

Expected: success. This catches an orphaned CSS selector or a template typo that vitest can miss.

- [ ] **Step 7: Commit**

```
git add src/home/components/widgets/GpuWidget.vue src/home/components/widgets/GpuWidget.test.ts
```
```
git commit -s -m "fix(home): make the 2x2 GPU card the ring alone

This reverses the frequency pill added earlier on this branch, knowingly. That
change put the frequency where the VRAM pill had been so the one field integrated
graphics reports would be visible at the card's default size. Looking at the
rendered card shows why it did not work: at 2x2 the pills do not fit at all and
are clipped through the middle of their own labels, so the substitution only
changed which unreadable label was on screen.

The ring is what fits at that size, so that is what the card shows. Temperature,
VRAM and frequency are unchanged on the wide card, one column up.

The test that pinned the pill behaviour is gone; the one asserting temperature at
2x2 now mounts wide, where temperature actually lives."
```

---

