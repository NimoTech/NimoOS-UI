## Task 7: 深链 `?asset` 与 `?photoset`

**Files:**
- Create: `src/photos/composables/usePhotosDeepLinks.ts`
- Test: `src/photos/composables/__tests__/usePhotosDeepLinks.test.ts`
- Modify: `src/views/Photos.vue`(挂 composable)

**Interfaces:**
- Consumes: `useLightbox()` 的 `openAt(photo, entryList, startMsArg?, query?)`(`src/photos/lightbox/useLightbox.ts:55`);`service.photos.getAsset`(经 timeline store 的明细取数,回源确认 New-UI 侧的等价 action 名);`useToast()`;T2 的 `photosDeepLinkPhotoNotFound`。
- Produces:
  ```ts
  export function usePhotosDeepLinks(): void   // 在 /photos 的 setup 里调一次,内部自行 onMounted
  ```

**回源坐标**:Vue2 `PhotosTimeline.vue:364-377`(mounted 里的分发)、`:431-440`(`_openAssetFromQuery`)、`:441-465`(`_openPhotoSetFromQuery`)。契约见 spec §6。

**逐条 1:1 契约**

1. **优先级**:`photoset` 优先于 `asset`(Vue2 `:370-374` 的 `if / else if`)——两个都在时只走 `photoset`。
2. **`?asset=<id>`**:按 id 取明细 → `openAt(photo, [photo])`(**翻页集只有它自己**,prev/next 成 no-op,与时间线是否包含它无关)。取不到 → toast `photosDeepLinkPhotoNotFound`。
3. **`?photoset=<token>&active=<id>`**:
   - 读 `localStorage['nimo:photoset:' + token]`,`JSON.parse(raw).ids` 过滤假值;
   - **读到就立刻 `removeItem`(一次性交接)**,即使后续取明细失败也已经删掉了(照 Vue2 `:447` 的位置 —— 在 parse 之后、取明细之前);
   - `ids` 为空(handoff 已被消费 / 键不存在)→ **降级成 `?asset` 行为**(用 `activeId`),`activeId` 也没有则静默什么都不做;
   - `active` 不在 `ids` 里时取 `ids[0]`(`:456`);
   - 翻页集是 `ids.map(id => ({ id }))` —— **只带 id 的轻量对象**,灯箱自己按需取每张的明细;
   - 取明细失败 → toast。
   - **`localStorage` 读/parse 异常必须吞掉**(`:449` 的 `catch {}`)—— 隐私模式 / 配额异常下不能把整页带崩。
4. **2 分钟过期清理不在消费侧**(归生产者 `openInApp.js:76-85`)—— 在注释里写明,免得后续期以为漏了。

- [ ] **Step 1: 写失败测试**

```ts
// src/photos/composables/__tests__/usePhotosDeepLinks.test.ts
describe('usePhotosDeepLinks · ?asset', () => {
  it('取到明细:以单张成集打开灯箱(prev/next 成 no-op)', async () => {
    const { lb } = mountWithQuery({ asset: 'a1' }, { 'a1': { id: 'a1' } })
    await flushPromises()
    expect(lb.openAt).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1' }),
      [expect.objectContaining({ id: 'a1' })],
    )
  })

  it('取不到明细:弹 not-found toast,不开灯箱', async () => { /* … */ })
})

describe('usePhotosDeepLinks · ?photoset', () => {
  beforeEach(() => localStorage.clear())

  it('读到 ids 后立刻 removeItem(一次性交接)', async () => {
    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['a', 'b', 'c'] }))
    mountWithQuery({ photoset: 'tok', active: 'b' }, { b: { id: 'b' } })
    expect(localStorage.getItem('nimo:photoset:tok')).toBeNull()
  })

  it('翻页集是全部 ids 的轻量 {id} 对象,active 打头显示', async () => {
    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['a', 'b', 'c'] }))
    const { lb } = mountWithQuery({ photoset: 'tok', active: 'b' }, { b: { id: 'b' } })
    await flushPromises()
    expect(lb.openAt).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b' }),
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    )
  })

  it('active 不在 ids 里时取 ids[0](Vue2 :456)', async () => { /* … */ })

  it('handoff 缺失:降级成 ?asset 行为(用 active)', async () => {
    const { lb } = mountWithQuery({ photoset: 'gone', active: 'b' }, { b: { id: 'b' } })
    await flushPromises()
    expect(lb.openAt).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b' }),
      [expect.objectContaining({ id: 'b' })],   // 单张成集 = asset 行为
    )
  })

  it('handoff 缺失且无 active:什么都不做,不弹 toast', async () => { /* … */ })

  it('localStorage 抛异常时吞掉,不带崩页面', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    expect(() => mountWithQuery({ photoset: 'tok', active: 'b' }, {})).not.toThrow()
  })

  it('photoset 与 asset 同时存在时只走 photoset(Vue2 :370-374 的 if/else if)', async () => {
    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['x'] }))
    const { lb } = mountWithQuery({ photoset: 'tok', asset: 'a1' }, { x: { id: 'x' } })
    await flushPromises()
    expect(lb.openAt).toHaveBeenCalledTimes(1)
    expect(lb.openAt.mock.calls[0][0]).toMatchObject({ id: 'x' })
  })

  it('ids 里的假值被过滤(Vue2 :446 的 .filter(Boolean))', async () => { /* ['a', '', null, 'b'] → [a, b] */ })
})
```

- [ ] **Step 2–4: 运行确认失败 → 实现 → 确认通过**

Run: `pnpm exec vitest run src/photos/composables/__tests__/usePhotosDeepLinks.test.ts --reporter=verbose`

- [ ] **Step 5: 变异验证 + Commit**

变异验证:①把 `removeItem` 挪到取明细成功之后 → 「立刻 removeItem」应变红 ②把 `if/else if` 改成两个 `if` → 「只走 photoset」应变红 ③删掉 `.filter(Boolean)` → 假值过滤用例应变红 ④删掉 `try/catch` → localStorage 异常用例应变红。

```bash
git add src/photos/composables/usePhotosDeepLinks.ts \
        src/photos/composables/__tests__/usePhotosDeepLinks.test.ts src/views/Photos.vue
git commit -m "feat(photos): ?asset / ?photoset 深链(P8a-T7,spec §6 契约)"
```

---

