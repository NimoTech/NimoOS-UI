### Task 1: `filesStore` 选中状态 + actions

**Files:**
- Modify: `src/files/stores/files.ts`
- Modify: `src/files/stores/files.test.ts`(追加一个 `describe`)

**Interfaces:**
- Consumes:`sortedEntries`/`entries`/`load`(现有)。
- Produces(store 追加):
  ```ts
  selected: Ref<Set<string>>            // 真实路径集
  selectionAnchor: Ref<string | null>
  isSelected(path: string): boolean
  selectedCount: ComputedRef<number>
  allSelected: ComputedRef<boolean>
  toggleSelect(path: string): void       // 翻转 + 设 anchor
  selectOnly(path: string): void         // 只选该项 + 设 anchor
  selectRange(path: string): void        // anchor→path 按 sortedEntries 顺序整段并入;无 anchor 退化 selectOnly
  selectAll(): void                      // 选中 sortedEntries 全部
  clearSelection(): void
  setSelection(paths: string[]): void    // 替换选中(框选用)
  ```

- [ ] **Step 1: 写失败测试**(追加到 `src/files/stores/files.test.ts` 末尾,新 describe)

```ts
describe('filesStore selection', () => {
  beforeEach(() => setActivePinia(createPinia()))

  function seed() {
    const files = useFilesStore()
    files.entries = [
      { name: 'Alpha', path: '/DATA/Alpha', is_dir: true },
      { name: 'Zeta', path: '/DATA/Zeta', is_dir: true },
      { name: 'a.txt', path: '/DATA/a.txt', is_dir: false, size: 10 },
      { name: 'b.txt', path: '/DATA/b.txt', is_dir: false, size: 20 },
    ] as any
    files.setSort('name', 'asc') // sortedEntries: Alpha, Zeta, a.txt, b.txt
    return files
  }

  it('toggleSelect flips membership and sets the anchor', () => {
    const files = seed()
    files.toggleSelect('/DATA/a.txt')
    expect(files.isSelected('/DATA/a.txt')).toBe(true)
    expect(files.selectedCount).toBe(1)
    files.toggleSelect('/DATA/a.txt')
    expect(files.isSelected('/DATA/a.txt')).toBe(false)
    expect(files.selectedCount).toBe(0)
  })

  it('selectOnly clears others; selectAll selects everything', () => {
    const files = seed()
    files.toggleSelect('/DATA/a.txt')
    files.selectOnly('/DATA/b.txt')
    expect(files.selectedCount).toBe(1)
    expect(files.isSelected('/DATA/b.txt')).toBe(true)
    files.selectAll()
    expect(files.selectedCount).toBe(4)
    expect(files.allSelected).toBe(true)
  })

  it('selectRange selects the contiguous span in sortedEntries order (anchor→target)', () => {
    const files = seed()
    files.toggleSelect('/DATA/Alpha')      // anchor = Alpha (index 0)
    files.selectRange('/DATA/a.txt')       // index 2 → span [Alpha, Zeta, a.txt]
    expect([...files.selected].sort()).toEqual(['/DATA/Alpha', '/DATA/Zeta', '/DATA/a.txt'].sort())
  })

  it('selectRange without an anchor degrades to selectOnly', () => {
    const files = seed()
    files.selectRange('/DATA/Zeta')
    expect([...files.selected]).toEqual(['/DATA/Zeta'])
  })

  it('setSelection replaces the whole selection; clearSelection empties it', () => {
    const files = seed()
    files.setSelection(['/DATA/a.txt', '/DATA/b.txt'])
    expect(files.selectedCount).toBe(2)
    files.clearSelection()
    expect(files.selectedCount).toBe(0)
    expect(files.selectionAnchor).toBe(null)
  })

  it('load clears the selection (per-directory)', async () => {
    const files = seed()
    files.toggleSelect('/DATA/a.txt')
    expect(files.selectedCount).toBe(1)
    await files.load('/DATA')
    expect(files.selectedCount).toBe(0)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/stores/files.test.ts`
Expected: FAIL(`files.toggleSelect is not a function` 等)

- [ ] **Step 3: 写实现**(在 `src/files/stores/files.ts`)

在 `load` 函数体**最前面**加一行清空选中(函数声明 `clearSelection` 会被提升,可先调后定义):
```ts
  async function load(realPath: string) {
    clearSelection()
    loading.value = true
```
在 `setSort` 之后、`return {...}` 之前,加选中状态与 actions:
```ts
  const selected = ref<Set<string>>(new Set())
  const selectionAnchor = ref<string | null>(null)

  function isSelected(path: string): boolean {
    return selected.value.has(path)
  }
  const selectedCount = computed(() => selected.value.size)
  const allSelected = computed(
    () => entries.value.length > 0 && sortedEntries.value.every((e) => selected.value.has(e.path)),
  )
  function clearSelection() {
    selected.value = new Set()
    selectionAnchor.value = null
  }
  function setSelection(paths: string[]) {
    selected.value = new Set(paths)
  }
  function toggleSelect(path: string) {
    const next = new Set(selected.value)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    selected.value = next
    selectionAnchor.value = path
  }
  function selectOnly(path: string) {
    selected.value = new Set([path])
    selectionAnchor.value = path
  }
  function selectRange(path: string) {
    const list = sortedEntries.value
    const anchor = selectionAnchor.value
    if (!anchor) { selectOnly(path); return }
    const ai = list.findIndex((e) => e.path === anchor)
    const bi = list.findIndex((e) => e.path === path)
    if (ai === -1 || bi === -1) { toggleSelect(path); return }
    const [lo, hi] = ai <= bi ? [ai, bi] : [bi, ai]
    const next = new Set(selected.value)
    for (let i = lo; i <= hi; i++) next.add(list[i].path)
    selected.value = next
  }
  function selectAll() {
    selected.value = new Set(sortedEntries.value.map((e) => e.path))
  }
```
把返回对象改为(追加 10 个成员,勿删原有):
```ts
  return {
    displayNames, disks, entries, currentPath, loading, loadRoots, defaultRootReal, load,
    viewMode, sort, order, sortedEntries, setView, setSort,
    selected, selectionAnchor, isSelected, selectedCount, allSelected,
    toggleSelect, selectOnly, selectRange, selectAll, clearSelection, setSelection,
  }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/stores/files.test.ts`
Expected: PASS(原 4 用例 + 新 6 用例)

- [ ] **Step 5: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && git add src/files/stores/files.ts src/files/stores/files.test.ts
git commit -m "feat(files): selection state in filesStore (toggle/range/all/clear, per-dir clear)"
```

---

