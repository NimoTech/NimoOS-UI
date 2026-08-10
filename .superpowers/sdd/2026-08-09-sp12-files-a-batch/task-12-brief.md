### Task 12: 时间机器 —— 预览失败允许自愈

**用户看到什么**：卡堆里某张卡的预览因为网络抖动加载失败，退成纯文字卡后**永远不会自己恢复**，哪怕网络早就好了；只有拨到别的刻度再拨回来（换掉可见集合）才绕得开。

**根因**：`useDeckPreview.ts:96` 的守卫是 `if (!previews.value[name]) fetchOne(...)` —— `failed` 也是一个真值条目，于是被当成「已经拉过」。

**Files:**
- Modify: `src/files/composables/useDeckPreview.ts:93-99`
- Test: `src/files/composables/useDeckPreview.test.ts`

- [ ] **Step 1: 写失败的测试**

```ts
it('retries a preview that failed once the visible set changes again', async () => {
  const getList = vi.fn()
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValue({ content: [{ name: 'a.txt', is_dir: false }] })
  // 装配照该文件既有用例
  const visible = ref(['snapA'])
  const { previews } = useDeckPreview({ mountPoint: () => '/DATA', relPath: () => '', visibleNames: () => visible.value })
  await flushPromises()
  expect(previews.value.snapA.status).toBe('failed')

  visible.value = ['snapA', 'snapB'] // 拨一格刻度
  await flushPromises()
  expect(previews.value.snapA.status).toBe('ready')
})

it('does not retry a preview that came back 404 (missing)', async () => {
  // "那时候还没有这个文件夹" 是稳定事实，不是抖动 —— 重试只是白打请求
  const getList = vi.fn().mockRejectedValue({ code: 404 })
  const visible = ref(['snapA'])
  const { previews } = useDeckPreview({
    mountPoint: () => '/DATA', relPath: () => '', visibleNames: () => visible.value,
  })
  const snapACalls = () => getList.mock.calls.filter((c) => String(c[0]).includes('snapA')).length

  await flushPromises()
  expect(previews.value.snapA.status).toBe('missing')
  expect(snapACalls()).toBe(1)

  visible.value = ['snapA', 'snapB'] // 拨一格刻度
  await flushPromises()
  expect(snapACalls()).toBe(1) // 仍然是 1：missing 不重试
})
```

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/files/composables/useDeckPreview.test.ts
```

- [ ] **Step 3: 实现**

```ts
for (const name of opts.visibleNames()) {
  const cached = previews.value[name]
  // A `failed` entry means the request blew up -- usually a blip. It used to
  // count as "already fetched" and the card stayed a text card for as long as
  // it remained visible, even after the network came back. `missing` (404) is
  // a stable fact about that snapshot and is never retried.
  if (!cached || cached.status === 'failed') fetchOne(name, epoch)
}
```

> **不会变成重试风暴**：`previews` 不在这个 `watch` 的来源里，所以写入 `failed` 不会自触发。重试只发生在下一次真的换目录/换卷/拨刻度时。

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm exec vitest run src/files/composables/useDeckPreview.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add src/files/composables/useDeckPreview.ts src/files/composables/useDeckPreview.test.ts
git commit -m "fix(files): retry snapshot card previews that failed

A failed entry counted as already-fetched, so a card that lost one request
to a network blip stayed a plain text card until the folder changed."
```

---

